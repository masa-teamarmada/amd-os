-- 374_link_cash_accounts_to_freee.sql
-- 「現金と融資」の口座を freee 会計の口座に結びつける。
--
-- freee 側の口座 (2026-09-05 に /api/cron/freee-cash-ledger-sync?dryRun=1 で実機確認):
--   3225706 bank_account ＰａｙＰａｙ銀行（API）           残高 750,209  同期 token_refresh_error  最終 2026-08-27
--   4598288 bank_account 商工組合中央金庫　水戸支店        残高 334,279  同期 disabled
--   3311743 bank_account 三菱ＵＦＪ（法人）（API） 土浦支店 残高  19,109  同期 token_refresh_error  最終 2026-04-06
--   2868545 bank_account みずほ（法人）（API）             残高 0        同期 disabled  ← 使っていないので結びつけない
--
-- freee_sync_from は「スプレッドシート由来の実績が終わる日の翌日」に置く。
-- こうすると同じ取引を2か所から取って二重に増やすことがない。
--   PayPay銀行  スプシの実績は 2026-09-04 まで → 09-05 から freee
--   商工中金    スプシの実績は 2026-08-05 まで → 08-06 から freee
--   UFJ         スプシの記録は 2023-12-18 まで → 12-19 から freee
--
-- 注意: 2026-09-05 時点で PayPay銀行 と 三菱UFJ は freee 側の銀行連携が切れており
-- (token_refresh_error)、商工中金は同期そのものが無効。freee に新しい明細が入らないので、
-- この結びつけを入れても当面は取り込む行が増えない。まさが freee で銀行連携をつなぎ直すと動く。

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SELECT pg_advisory_xact_lock(hashtext('link_cash_accounts_to_freee'));

UPDATE public.cash_accounts SET
  freee_walletable_type = 'bank_account', freee_walletable_id = 3225706,
  freee_sync_from = DATE '2026-09-05', updated_at = NOW()
WHERE account_id = 'paypay';

UPDATE public.cash_accounts SET
  freee_walletable_type = 'bank_account', freee_walletable_id = 4598288,
  freee_sync_from = DATE '2026-08-06', updated_at = NOW()
WHERE account_id = 'shokochukin';

UPDATE public.cash_accounts SET
  freee_walletable_type = 'bank_account', freee_walletable_id = 3311743,
  freee_sync_from = DATE '2023-12-19', updated_at = NOW()
WHERE account_id = 'ufj';

COMMIT;
