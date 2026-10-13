-- 503_shokochukin_ledger_only_and_sep_transfers.sql
-- 商工中金の口座を「freee とつなげない口座」として扱い、OS の入出金明細を正にする。
-- あわせて、きよのスプレッドシートに書き漏れていた 9/30 の振込と、PayPay銀行の初回返済を記録する。
--
-- 経緯 (2026-10-13 まさ):
--   商工中金の口座は freee と連携できない。freee の残高は 2026-02-16 の 334,279 円で止まっていて、
--   口座残高の月末合計がその値のまま毎月数えられていた。
--   2026-09-30 に PayPay銀行から自社名義 (商工中金) へ 400,000 円を2回振り込んでいる
--   (freee の PayPay銀行明細)。スプレッドシートには1回分しか書かれていない (手入力の書き漏れ)。
--   同じ日の PayPay銀行明細「約定返済」30,000 円は、PayPay銀行ビジネスローンの初回返済。

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SELECT pg_advisory_xact_lock(hashtext('shokochukin_ledger_only'));

-- ── 1. 商工中金は freee から実績を取らない ──
-- freee_sync_from を空にすると、取り込み cron は対象から外し、月末残高は OS の明細から積み上げる
-- (src/lib/finance/freee-cash-balances.ts の overlayLedgerOnlyBalances)。
-- freee_walletable_id は残す。月末残高の内訳で freee 側の同じ口座を差し替えるのに使う。
UPDATE public.cash_accounts
SET freee_sync_from = NULL, updated_at = NOW()
WHERE account_id = 'shokochukin';

-- ── 2. 9/30 の2回目の 400,000 円 ──
-- source='manual' の行は、スプレッドシートの取り込みで入れ替わらない。
INSERT INTO public.cash_ledger_entries
  (account_id, entry_date, seq, counterparty, withdrawal, deposit, balance, note, is_planned, source)
SELECT 'shokochukin', DATE '2026-09-30',
       COALESCE((SELECT MAX(seq) + 1 FROM public.cash_ledger_entries
                 WHERE account_id = 'shokochukin' AND entry_date = DATE '2026-09-30'), 0),
       'PayPay銀行から振替', 0, 400000, NULL,
       'freee の PayPay銀行明細で 9/30 に自社名義へ 400,000 円×2回。スプレッドシートは1回分だけだったので、2回目を OS で追加 (2026-10-13 えいみ)。',
       FALSE, 'manual'
WHERE NOT EXISTS (
  SELECT 1 FROM public.cash_ledger_entries
  WHERE account_id = 'shokochukin' AND entry_date = DATE '2026-09-30' AND source = 'manual' AND deposit = 400000
);

-- ── 3. PayPay銀行ビジネスローンの初回返済 ──
-- 内訳は推定。利息 = 1,400,000 × 14.0% ÷ 365 × 26日 (9/4→9/30) = 13,961 円、残りを元金とした。
INSERT INTO public.loan_events (loan_id, event_date, kind, amount, principal_amount, interest_amount, is_planned, note, source)
SELECT 'paypay_2026', DATE '2026-09-30', 'repayment', 30000, 16039, 13961, FALSE,
       'freee の PayPay銀行明細「約定返済」30,000 円。元金と利息の内訳は日割りでの推定。', 'freee'
WHERE NOT EXISTS (
  SELECT 1 FROM public.loan_events
  WHERE loan_id = 'paypay_2026' AND event_date = DATE '2026-09-30' AND kind = 'repayment'
);

COMMIT;
