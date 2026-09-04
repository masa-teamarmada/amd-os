-- 371_cash_ledger_and_loans.sql
-- きよが Google スプレッドシート「収支」で手入力している口座の入出金を AMD OS へ移し、
-- あわせて PayPay銀行 / 商工中金 の借入残高を同じ画面で追えるようにする。
--
-- まさ依頼 (2026-09-04):
--   「PayPay銀行から年利14.0%で借りる。何度も借りたり返したりするので利子が確認できるシミュレーターを admin に作って。
--     きよの収支スプシを移植して、そこに PayPay銀行・商工中金 両方の融資残高も載せて」
--
-- 一次情報: https://docs.google.com/spreadsheets/d/1Q8cEnutfJzgdEXKIRDb4wUGAe6ON1MMiiz3irCrj1YA
--   タブ「2026年_PayPay」「2025年_PayPay」「商工中金」「UFJ通帳」
--
-- 正本境界:
--   - 会計の正本は freee (pwa/manual/6-10, 6-11)。この4テーブルは「口座を今いくら持っていて、
--     借入がいくら残っているか」の現金側だけを持つ。損益・仕訳をここで再現しない。
--   - `/admin/kiyo` の「00 お金の流れ」は freee 試算表から損益を見る画面で、こちらとは別物。
--     あちらは損益、こちらは現金と借入。数字が一致しないのは正常 (6-11 の「損益と現金を分ける」)。
--   - 役員報酬や個人口座の額が読めるため admin 専用。member / anon には出さない。

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SELECT pg_advisory_xact_lock(hashtext('cash_ledger_and_loans'));

-- ── 1. 口座マスタ ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cash_accounts (
  account_id   TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  short_name   TEXT NOT NULL,
  institution  TEXT NOT NULL,
  -- この口座が何に使われているか。画面にそのまま出す。
  purpose      TEXT,
  sort_order   INT NOT NULL DEFAULT 100,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 2. 入出金明細 (スプシの各行に対応) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cash_ledger_entries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    TEXT NOT NULL REFERENCES public.cash_accounts(account_id) ON DELETE CASCADE,
  entry_date    DATE NOT NULL,
  -- 同じ日に複数行あるときのスプシ上の並び。残高の再現に要る。
  seq           INT NOT NULL DEFAULT 0,
  counterparty  TEXT,
  -- 通帳に出る振込名義 (カナ)。相手先と別に持つ列がスプシにあるため分けて保つ。
  transfer_name TEXT,
  withdrawal    BIGINT NOT NULL DEFAULT 0,
  deposit       BIGINT NOT NULL DEFAULT 0,
  -- スプシに書かれていた残高。OS 側で積み上げた値と突き合わせて食い違いを見つけるために原本を残す。
  balance       BIGINT,
  category      TEXT,
  target_month  TEXT,
  note          TEXT,
  -- 未来日の見込み行。スプシは実績と予定を同じ表に並べている。
  is_planned    BOOLEAN NOT NULL DEFAULT FALSE,
  source        TEXT NOT NULL DEFAULT 'sheet_import',
  -- 取り込み元スプシの行番号 (1始まり)。再取込のときに同じ行を二重に増やさない。
  source_row    INT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cash_ledger_entries_source_row_uniq UNIQUE (account_id, source, source_row)
);

CREATE INDEX IF NOT EXISTS idx_cash_ledger_entries_account_date
  ON public.cash_ledger_entries(account_id, entry_date, seq);

-- ── 3. 融資契約 ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.loans (
  loan_id         TEXT PRIMARY KEY,
  lender          TEXT NOT NULL,
  short_name      TEXT NOT NULL,
  -- 返済が引き落とされる口座。
  account_id      TEXT REFERENCES public.cash_accounts(account_id),
  -- 年利。0.1400 = 年14.0%。
  annual_rate     NUMERIC(7,5) NOT NULL,
  -- 日割り計算の分母。日本の銀行実務は 365 日 (うるう年も 365 で切る契約が多い)。
  day_count_basis INT NOT NULL DEFAULT 365,
  -- 'equal_principal' = 毎月おなじ元金を返す (商工中金)
  -- 'revolving'       = 枠の中で何度でも借りて返す (PayPay銀行のビジネスローン)
  repayment_type  TEXT NOT NULL,
  contracted_on   DATE,
  drawdown_on     DATE,
  -- 当初の借入額 (equal_principal 用)。
  principal_amount BIGINT,
  -- 借入枠 (revolving 用)。
  credit_limit    BIGINT,
  term_months     INT,
  first_due_on    DATE,
  note            TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT loans_repayment_type_check
    CHECK (repayment_type IN ('equal_principal', 'equal_installment', 'revolving', 'bullet'))
);

-- ── 4. 借入・返済のできごと ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.loan_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id          TEXT NOT NULL REFERENCES public.loans(loan_id) ON DELETE CASCADE,
  event_date       DATE NOT NULL,
  -- 'drawdown' = 借りた / 'repayment' = 返した
  kind             TEXT NOT NULL,
  -- 口座を実際に出入りした総額。返済なら元金 + 利息。
  amount           BIGINT NOT NULL,
  principal_amount BIGINT,
  interest_amount  BIGINT,
  -- 予定表の行 (まだ引き落とされていない)。
  is_planned       BOOLEAN NOT NULL DEFAULT FALSE,
  note             TEXT,
  source           TEXT NOT NULL DEFAULT 'sheet_import',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT loan_events_kind_check CHECK (kind IN ('drawdown', 'repayment', 'fee'))
);

CREATE INDEX IF NOT EXISTS idx_loan_events_loan_date
  ON public.loan_events(loan_id, event_date);

-- ── 5. 権限 ─────────────────────────────────────────────────────────────────
-- 会社の口座残高・借入・役員報酬の振込額が読めるので admin 限定にする。
-- member 読みも作らない (6-11 の money-flow API と同じ扱い)。
ALTER TABLE public.cash_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cash_accounts_admin_all ON public.cash_accounts;
CREATE POLICY cash_accounts_admin_all ON public.cash_accounts
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS cash_accounts_service_role ON public.cash_accounts;
CREATE POLICY cash_accounts_service_role ON public.cash_accounts
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

ALTER TABLE public.cash_ledger_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cash_ledger_entries_admin_all ON public.cash_ledger_entries;
CREATE POLICY cash_ledger_entries_admin_all ON public.cash_ledger_entries
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS cash_ledger_entries_service_role ON public.cash_ledger_entries;
CREATE POLICY cash_ledger_entries_service_role ON public.cash_ledger_entries
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS loans_admin_all ON public.loans;
CREATE POLICY loans_admin_all ON public.loans
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS loans_service_role ON public.loans;
CREATE POLICY loans_service_role ON public.loans
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

ALTER TABLE public.loan_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS loan_events_admin_all ON public.loan_events;
CREATE POLICY loan_events_admin_all ON public.loan_events
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS loan_events_service_role ON public.loan_events;
CREATE POLICY loan_events_service_role ON public.loan_events
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ── 6. 口座と融資の初期登録 ─────────────────────────────────────────────────
INSERT INTO public.cash_accounts (account_id, name, short_name, institution, purpose, sort_order) VALUES
  ('paypay',      'PayPay銀行 ビジネス口座', 'PayPay銀行', 'PayPay銀行',
   '会社のメイン口座。売上の入金、メンバーへの支払、税金や社会保険料の引き落としがここを通る。', 10),
  ('shokochukin', '商工組合中央金庫 口座',   '商工中金',   '商工組合中央金庫',
   '商工中金からの借入と、その毎月の返済が引き落とされる口座。', 20),
  ('ufj',         '三菱UFJ銀行 口座',        'UFJ',        '三菱UFJ銀行',
   '社会保険料の引き落としなど、限られた用途で残っている口座。', 30)
ON CONFLICT (account_id) DO UPDATE SET
  name = EXCLUDED.name, short_name = EXCLUDED.short_name, institution = EXCLUDED.institution,
  purpose = EXCLUDED.purpose, sort_order = EXCLUDED.sort_order, updated_at = NOW();

-- 商工中金: 2026-01-19 に 5,000,000 円を実行。翌月 2/5 から毎月 5 日前後に元金均等で返済。
-- 返済額はスプシ「商工中金」タブの予定表 (2026/2〜2027/1) が一次情報。
-- 年利はスプシに書かれていないため、実際の返済額から逆算した推定値を入れる (seed 側の注記参照)。
INSERT INTO public.loans (
  loan_id, lender, short_name, account_id, annual_rate, repayment_type,
  contracted_on, drawdown_on, principal_amount, term_months, first_due_on, note
) VALUES (
  'shokochukin_2026', '商工組合中央金庫', '商工中金', 'shokochukin', 0.02500, 'equal_principal',
  '2026-01-19', '2026-01-19', 5000000, 60, '2026-02-05',
  '2026-01-19 に 5,000,000 円を実行し、同日 PayPay銀行へ全額移した。毎月の返済は商工中金口座から引き落とし。'
  || '年利はスプシに記載が無く、返済予定額 (元金 83,333 円 + 利息) から逆算した推定 2.5%。契約書で確認して置き換える。'
) ON CONFLICT (loan_id) DO UPDATE SET
  lender = EXCLUDED.lender, short_name = EXCLUDED.short_name, account_id = EXCLUDED.account_id,
  repayment_type = EXCLUDED.repayment_type, contracted_on = EXCLUDED.contracted_on,
  drawdown_on = EXCLUDED.drawdown_on, principal_amount = EXCLUDED.principal_amount,
  term_months = EXCLUDED.term_months, first_due_on = EXCLUDED.first_due_on,
  note = EXCLUDED.note, updated_at = NOW();

-- PayPay銀行: 2026-09-04 にまさが借入を決めた枠。年利 14.0% はまさ確定。
-- 何度も借りて返す使い方なので repayment_type = 'revolving'、利息は日割りで数える。
INSERT INTO public.loans (
  loan_id, lender, short_name, account_id, annual_rate, repayment_type,
  contracted_on, credit_limit, note
) VALUES (
  'paypay_2026', 'PayPay銀行', 'PayPay銀行', 'paypay', 0.14000, 'revolving',
  '2026-09-04', NULL,
  '年利 14.0% (まさ 2026-09-04)。枠の中で借りたり返したりする前提なので、利息は「残っている元金 × 年利 ÷ 365 × 日数」で日割りで積む。借入枠の金額は契約が確定したら入れる。'
) ON CONFLICT (loan_id) DO UPDATE SET
  annual_rate = EXCLUDED.annual_rate, repayment_type = EXCLUDED.repayment_type,
  contracted_on = EXCLUDED.contracted_on, note = EXCLUDED.note, updated_at = NOW();

COMMIT;
