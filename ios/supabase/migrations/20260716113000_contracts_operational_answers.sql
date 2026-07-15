-- 契約管理で、契約1件の同一性と秘密保持の確認結果を構造化する。
-- 契約本文は保存せず、確認結果と短い根拠だけを保持する。

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS canonical_contract_id uuid,
  ADD COLUMN IF NOT EXISTS confidentiality_coverage text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS confidentiality_survival_note text,
  ADD COLUMN IF NOT EXISTS confidentiality_note text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'contracts_canonical_contract_fk'
      AND conrelid = 'public.contracts'::regclass
  ) THEN
    ALTER TABLE public.contracts
      ADD CONSTRAINT contracts_canonical_contract_fk
      FOREIGN KEY (canonical_contract_id)
      REFERENCES public.contracts(contract_id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'contracts_confidentiality_coverage_check'
      AND conrelid = 'public.contracts'::regclass
  ) THEN
    ALTER TABLE public.contracts
      ADD CONSTRAINT contracts_confidentiality_coverage_check
      CHECK (confidentiality_coverage IN ('in_contract','separate_nda','not_included','unknown'));
  END IF;
END $$;

COMMENT ON COLUMN public.contracts.canonical_contract_id IS
  '同じ契約に属する旧取込行・作業記録が参照する契約正本ID。NULLの旧データは表示時の保守的な同一性判定を使う。';
COMMENT ON COLUMN public.contracts.confidentiality_coverage IS
  '秘密保持の確認結果。契約本文、別NDA、含まない、未確認を区別する。';
COMMENT ON COLUMN public.contracts.confidentiality_survival_note IS
  '秘密保持義務の存続期間に関する短い確認メモ。契約本文は保存しない。';
COMMENT ON COLUMN public.contracts.confidentiality_note IS
  '秘密保持の根拠文書・条項等の短い確認メモ。契約本文は保存しない。';

CREATE INDEX IF NOT EXISTS idx_contracts_canonical_contract
  ON public.contracts(canonical_contract_id, last_activity_at DESC);
