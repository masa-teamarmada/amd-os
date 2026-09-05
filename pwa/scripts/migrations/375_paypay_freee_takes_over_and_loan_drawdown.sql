-- 375_paypay_freee_takes_over_and_loan_drawdown.sql
-- PayPay銀行の実績を、2026-08-01 から freee 由来に一本化する。
-- あわせて、freee の明細で分かった PayPay銀行ビジネスローンの借入を記録する。
--
-- 経緯 (2026-09-05):
--   まさが freee 側の PayPay銀行の銀行連携をつなぎ直した。取り込んでみたところ、
--   きよのスプレッドシート由来の残高 2,722,802 円に対し、銀行の実残高は 722,657 円だった。
--   freee の明細を見ると、原因は2件。
--     2026-09-04  ビジネスローン借入   +1,400,000  → 残高 2,722,802
--     2026-09-04  振込 コエヅカ キヨウコ -2,000,000  → 残高   722,802
--   スプレッドシートは借入の入金までは書かれていて、200万円の振込が書かれていなかった。
--   前に「2026-09-07 の行で 200 万のズレ」として見えていたものの正体がこれ。
--
-- 方針:
--   実績は freee (銀行の実記録) を正にする。スプレッドシート由来の同じ期間の行は消す。
--   きよが書いた備考や対象月は失われるが、原本のスプレッドシートには残っている。
--   2026-09-05 以降の予定行は消さない (freee にはまだ無く、きよの見込みとして要る)。

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SELECT pg_advisory_xact_lock(hashtext('paypay_freee_takes_over'));

-- ── 1. freee がカバーしている期間のスプレッドシート由来の行を外す ──
DELETE FROM public.cash_ledger_entries
WHERE account_id = 'paypay'
  AND source LIKE 'sheet:%'
  AND entry_date BETWEEN DATE '2026-08-01' AND DATE '2026-09-04';

-- ── 2. PayPay銀行の借入枠から 2026-09-04 に 1,400,000 円を実行した ──
-- freee の明細「ビジネスローン借入」より。口座の入金 (cash_ledger_entries) とは別の帳簿なので
-- 二重計上にはならない。片方は現金が増えたこと、こちらは借金が増えたこと。
INSERT INTO public.loan_events (loan_id, event_date, kind, amount, principal_amount, interest_amount, is_planned, note, source)
SELECT 'paypay_2026', DATE '2026-09-04', 'drawdown', 1400000, 1400000, NULL, FALSE,
       'freee の PayPay銀行明細「ビジネスローン借入」。同日に 2,000,000 円を肥塚さんへ振り込んでいる。', 'freee'
WHERE NOT EXISTS (
  SELECT 1 FROM public.loan_events
  WHERE loan_id = 'paypay_2026' AND event_date = DATE '2026-09-04' AND kind = 'drawdown'
);

-- ── 3. この口座は 2026-08-01 以降を freee から取る ──
UPDATE public.cash_accounts
SET freee_sync_from = DATE '2026-08-01', updated_at = NOW()
WHERE account_id = 'paypay';

COMMIT;
