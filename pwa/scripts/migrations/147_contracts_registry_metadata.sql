-- 147_contracts_registry_metadata.sql
-- 契約台帳としての表示単位を明示するための非破壊metadata拡張。
-- Drive抽出物は contract_documents に残し、contracts は「契約/契約ファミリー」だけを台帳表示する。

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS canonical_title text,
  ADD COLUMN IF NOT EXISTS registry_status text NOT NULL DEFAULT 'candidate',
  ADD COLUMN IF NOT EXISTS effective_date date,
  ADD COLUMN IF NOT EXISTS expiration_date date,
  ADD COLUMN IF NOT EXISTS renewal_notice_date date,
  ADD COLUMN IF NOT EXISTS renewal_type text,
  ADD COLUMN IF NOT EXISTS contract_value_yen bigint,
  ADD COLUMN IF NOT EXISTS business_owner text,
  ADD COLUMN IF NOT EXISTS ledger_notes text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'contracts_registry_status_check'
      AND conrelid = 'public.contracts'::regclass
  ) THEN
    ALTER TABLE public.contracts
      ADD CONSTRAINT contracts_registry_status_check
      CHECK (registry_status IN ('candidate','accepted','evidence_only','rejected'));
  END IF;
END $$;

COMMENT ON COLUMN public.contracts.canonical_title IS
  '契約台帳で表示する正規タイトル。Drive folder名ではなく契約/契約書名を入れる。';
COMMENT ON COLUMN public.contracts.registry_status IS
  '契約台帳への採用状態。accepted/candidateのみ契約リスト表示、evidence_only/rejectedは関連資料として保持。';
COMMENT ON COLUMN public.contracts.effective_date IS
  '契約の発効日。未抽出ならNULL。';
COMMENT ON COLUMN public.contracts.expiration_date IS
  '契約の終了/満了日。未抽出ならNULL。';
COMMENT ON COLUMN public.contracts.renewal_notice_date IS
  '更新停止/解約通知期限。未抽出ならNULL。';
COMMENT ON COLUMN public.contracts.renewal_type IS
  '自動更新/都度更新/固定期間などの更新種別。';
COMMENT ON COLUMN public.contracts.contract_value_yen IS
  '契約金額または年額/月額換算前の主要金額。未抽出ならNULL。';
COMMENT ON COLUMN public.contracts.business_owner IS
  '契約の業務責任者。';
COMMENT ON COLUMN public.contracts.ledger_notes IS
  '台帳整理時の短いメモ。契約本文や秘密情報は入れない。';

CREATE INDEX IF NOT EXISTS idx_contracts_registry_status
  ON public.contracts(registry_status, status, last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_contracts_key_dates
  ON public.contracts(expiration_date, renewal_notice_date, effective_date);
