-- 373_cash_accounts_freee_link.sql
-- 「現金と融資」の口座を freee 会計の口座と結びつけ、毎日 freee から入出金を取り込めるようにする。
--
-- まさ依頼 (2026-09-05):
--   「これさ、dailyでfreee会計から新しい取引結果を追加できるようになってる?」
--   → なっていなかったので、その経路を作る。
--
-- 二重に増やさないための境界:
--   きよのスプレッドシートから取り込んだ過去の実績と、freee から取り込む実績が同じ日を
--   カバーすると、同じ取引が2行に見える。そこで口座ごとに `freee_sync_from` を置き、
--   **その日以降の実績だけを freee から取る**。それより前はスプレッドシート由来のまま残す。
--   スプレッドシート側に入っている未来日の行は「予定」なので消さない。実績が freee から
--   届いたら、対応する予定行をきよが消す運用にする (画面で取り込み元が分かる)。

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SELECT pg_advisory_xact_lock(hashtext('cash_accounts_freee_link'));

ALTER TABLE public.cash_accounts
  -- freee の口座種別。'bank_account' / 'credit_card' / 'wallet'。
  ADD COLUMN IF NOT EXISTS freee_walletable_type TEXT,
  ADD COLUMN IF NOT EXISTS freee_walletable_id BIGINT,
  -- この日以降の実績を freee から取る。空なら freee からは取り込まない。
  ADD COLUMN IF NOT EXISTS freee_sync_from DATE,
  ADD COLUMN IF NOT EXISTS freee_synced_at TIMESTAMPTZ;

-- freee の明細 id は int の範囲に収まらないことがあるので広げておく。
ALTER TABLE public.cash_ledger_entries
  ALTER COLUMN source_row TYPE BIGINT;

CREATE INDEX IF NOT EXISTS idx_cash_ledger_entries_source
  ON public.cash_ledger_entries(source, entry_date);

COMMIT;
