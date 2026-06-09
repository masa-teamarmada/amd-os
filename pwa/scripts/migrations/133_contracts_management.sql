-- 133_contracts_management.sql
-- 契約管理MVP。実ファイル本体は Google Drive
-- `共有ドライブ/ARMADA/a3_backoffice/契約` 配下に置き、OSにはmetadata/linkだけを保存する。

CREATE TABLE IF NOT EXISTS public.contracts (
  contract_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL REFERENCES public.projects(project_id) ON DELETE RESTRICT,
  contract_title text NOT NULL,
  counterparty_name text,
  contract_type text NOT NULL DEFAULT 'contract',
  status text NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned','drafting','under_review','awaiting_signature','signed','stalled','cancelled')),
  expected_signing_date date,
  planned_at timestamptz NOT NULL DEFAULT now(),
  detected_at timestamptz,
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  signed_at timestamptz,
  nudge_after_days integer NOT NULL DEFAULT 14 CHECK (nudge_after_days BETWEEN 1 AND 120),
  signal_confidence numeric CHECK (signal_confidence IS NULL OR (signal_confidence >= 0 AND signal_confidence <= 1)),
  review_required boolean NOT NULL DEFAULT true,
  review_status text NOT NULL DEFAULT 'pending'
    CHECK (review_status IN ('pending','accepted','rejected','not_needed')),
  source_summary text,
  source_refs_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  drive_folder_id text,
  signed_document_id uuid,
  created_by text,
  updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.contracts IS
  '契約予定枠/契約ステータスの正本。契約書ファイル本体はDrive、OSはmetadata/linkのみ保持。';
COMMENT ON COLUMN public.contracts.drive_folder_id IS
  '共有ドライブ/ARMADA/a3_backoffice/契約 配下の契約別folder id。未解決ならNULLでcredential/folder blockerとして扱う。';
COMMENT ON COLUMN public.contracts.source_refs_json IS
  'source_cache / project_meeting_summaries / Drive file metadata 等への短い参照。raw本文は保存しない。';

CREATE TABLE IF NOT EXISTS public.contract_documents (
  document_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(contract_id) ON DELETE CASCADE,
  project_id text NOT NULL REFERENCES public.projects(project_id) ON DELETE RESTRICT,
  document_kind text NOT NULL DEFAULT 'revision'
    CHECK (document_kind IN ('draft','revision','redline','signed','other')),
  version_label text NOT NULL DEFAULT 'v1',
  drive_file_id text NOT NULL,
  drive_folder_id text,
  web_view_link text NOT NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL DEFAULT 'application/octet-stream',
  file_size_bytes bigint NOT NULL DEFAULT 0,
  source_kind text NOT NULL DEFAULT 'manual_drive_link',
  received_at timestamptz NOT NULL DEFAULT now(),
  uploaded_by text,
  is_latest boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.contract_documents IS
  '契約書バージョン履歴。Drive file ID / webViewLink / metadataのみ保存し、契約書本文はDBに保存しない。';
COMMENT ON COLUMN public.contract_documents.document_kind IS
  'draft / revision / redline / signed / other。押印版は signed。';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'contracts_signed_document_fk'
      AND conrelid = 'public.contracts'::regclass
  ) THEN
    ALTER TABLE public.contracts
      ADD CONSTRAINT contracts_signed_document_fk
      FOREIGN KEY (signed_document_id)
      REFERENCES public.contract_documents(document_id)
      ON DELETE SET NULL
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.contract_signals (
  signal_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid REFERENCES public.contracts(contract_id) ON DELETE SET NULL,
  project_id text NOT NULL REFERENCES public.projects(project_id) ON DELETE RESTRICT,
  source_kind text NOT NULL
    CHECK (source_kind IN ('gmail','drive','calendar','slack','notion','manual')),
  source_table text NOT NULL DEFAULT 'source_cache',
  source_id text NOT NULL,
  source_url text,
  title text NOT NULL,
  snippet text NOT NULL DEFAULT '',
  detected_terms text[] NOT NULL DEFAULT ARRAY[]::text[],
  signal_type text NOT NULL DEFAULT 'contract',
  confidence numeric NOT NULL DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  review_required boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'candidate'
    CHECK (status IN ('candidate','accepted','rejected','linked')),
  detected_at timestamptz NOT NULL DEFAULT now(),
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_kind, source_table, source_id, signal_type)
);

COMMENT ON TABLE public.contract_signals IS
  '5生データから検出した契約予兆候補。candidate/reviewを基本にし、自動予定枠は高確度のみ。';
COMMENT ON COLUMN public.contract_signals.snippet IS
  '短い根拠抜粋のみ。契約書本文・メール全文・議事録全文は保存しない。';

CREATE TABLE IF NOT EXISTS public.contract_nudges (
  nudge_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(contract_id) ON DELETE CASCADE,
  project_id text NOT NULL REFERENCES public.projects(project_id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'candidate'
    CHECK (status IN ('candidate','review_queued','sent','skipped','cancelled')),
  nudge_reason text NOT NULL DEFAULT 'signed_document_missing',
  candidate_at timestamptz NOT NULL DEFAULT now(),
  due_at timestamptz,
  stale_days integer NOT NULL DEFAULT 0,
  slack_channel_id text,
  dry_run_message text NOT NULL DEFAULT '',
  sent_at timestamptz,
  sent_by text,
  slack_message_ts text,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.contract_nudges IS
  '押印版未保存の契約予定枠に対するSlack nudge候補/履歴。初期運用はdry-run/review queueのみ。';

CREATE INDEX IF NOT EXISTS idx_contracts_project_status
  ON public.contracts(project_id, status, last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_contracts_review
  ON public.contracts(review_required, review_status, planned_at DESC);
CREATE INDEX IF NOT EXISTS idx_contract_documents_contract
  ON public.contract_documents(contract_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_contract_signals_project_status
  ON public.contract_signals(project_id, status, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_contract_nudges_status
  ON public.contract_nudges(status, candidate_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_contract_documents_one_latest
  ON public.contract_documents(contract_id)
  WHERE is_latest;

CREATE UNIQUE INDEX IF NOT EXISTS idx_contract_documents_one_signed_latest
  ON public.contract_documents(contract_id)
  WHERE document_kind = 'signed' AND is_latest;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'contracts_updated_at'
  ) THEN
    CREATE TRIGGER contracts_updated_at
      BEFORE UPDATE ON public.contracts
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'contract_documents_updated_at'
  ) THEN
    CREATE TRIGGER contract_documents_updated_at
      BEFORE UPDATE ON public.contract_documents
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'contract_signals_updated_at'
  ) THEN
    CREATE TRIGGER contract_signals_updated_at
      BEFORE UPDATE ON public.contract_signals
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'contract_nudges_updated_at'
  ) THEN
    CREATE TRIGGER contract_nudges_updated_at
      BEFORE UPDATE ON public.contract_nudges
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_nudges ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'contracts' AND policyname = 'contracts_admin_select') THEN
    CREATE POLICY contracts_admin_select ON public.contracts FOR SELECT TO authenticated USING (is_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'contracts' AND policyname = 'contracts_admin_insert') THEN
    CREATE POLICY contracts_admin_insert ON public.contracts FOR INSERT TO authenticated WITH CHECK (is_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'contracts' AND policyname = 'contracts_admin_update') THEN
    CREATE POLICY contracts_admin_update ON public.contracts FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'contracts' AND policyname = 'contracts_service_role_all') THEN
    CREATE POLICY contracts_service_role_all ON public.contracts FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'contract_documents' AND policyname = 'contract_documents_admin_select') THEN
    CREATE POLICY contract_documents_admin_select ON public.contract_documents FOR SELECT TO authenticated USING (is_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'contract_documents' AND policyname = 'contract_documents_admin_insert') THEN
    CREATE POLICY contract_documents_admin_insert ON public.contract_documents FOR INSERT TO authenticated WITH CHECK (is_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'contract_documents' AND policyname = 'contract_documents_admin_update') THEN
    CREATE POLICY contract_documents_admin_update ON public.contract_documents FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'contract_documents' AND policyname = 'contract_documents_service_role_all') THEN
    CREATE POLICY contract_documents_service_role_all ON public.contract_documents FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'contract_signals' AND policyname = 'contract_signals_admin_select') THEN
    CREATE POLICY contract_signals_admin_select ON public.contract_signals FOR SELECT TO authenticated USING (is_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'contract_signals' AND policyname = 'contract_signals_admin_insert') THEN
    CREATE POLICY contract_signals_admin_insert ON public.contract_signals FOR INSERT TO authenticated WITH CHECK (is_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'contract_signals' AND policyname = 'contract_signals_admin_update') THEN
    CREATE POLICY contract_signals_admin_update ON public.contract_signals FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'contract_signals' AND policyname = 'contract_signals_service_role_all') THEN
    CREATE POLICY contract_signals_service_role_all ON public.contract_signals FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'contract_nudges' AND policyname = 'contract_nudges_admin_select') THEN
    CREATE POLICY contract_nudges_admin_select ON public.contract_nudges FOR SELECT TO authenticated USING (is_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'contract_nudges' AND policyname = 'contract_nudges_insert') THEN
    CREATE POLICY contract_nudges_insert ON public.contract_nudges FOR INSERT TO authenticated WITH CHECK (is_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'contract_nudges' AND policyname = 'contract_nudges_update') THEN
    CREATE POLICY contract_nudges_update ON public.contract_nudges FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'contract_nudges' AND policyname = 'contract_nudges_service_role_all') THEN
    CREATE POLICY contract_nudges_service_role_all ON public.contract_nudges FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
