-- 159_monthly_report_v2.sql
--
-- L2M-1 月次報告書 v2 のための schema 整備。
--   - projects 側 = 月次報告書を作る上での PJ メタ (業務内容 / 必要性 / 命名 / 禁止語例外)
--   - contracts 側 = 税込/税抜 と、送付先確認用の to: マッチ用 email 一覧
--   - project_documents 側 = 顧客へ正式に渡した時刻
--   - monthly_reports_external = 顧客向け月次報告書本文 (生成結果 + jargon check 結果)
--   - llm_prompt_revisions = llm_prompts の本文書き換え履歴
--   - llm_prompts seed = v2 プロンプトの key を確保 (body は後で admin UI から流す)
--
-- 設計参照: L2M-1 (= manual/spec の月次報告書章) と KUTE 版 PDF 生成ロジックの移植。
--
-- 適用方法:
--   python -X utf8 scripts/apply_ddl.py scripts/migrations/159_monthly_report_v2.sql

-- ============================================================================
-- 1. projects: 月次報告書まわりのメタ
-- ============================================================================

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS work_content jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS monthly_report_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS report_local_alias text,
  ADD COLUMN IF NOT EXISTS report_extra_allow_terms text[] NOT NULL DEFAULT ARRAY[]::text[];

COMMENT ON COLUMN public.projects.work_content IS
  '業務内容の配列。各要素は {name: string, description?: string}。月次報告書冒頭の業務内容セクションに直接使う。admin UI の projects 編集画面で編集する。';
COMMENT ON COLUMN public.projects.monthly_report_required IS
  '顧客向け月次報告書 (L2M-1 external) の生成が必要かどうか。TRUE のものだけ月末 cron が走る。';
COMMENT ON COLUMN public.projects.report_local_alias IS
  'ローカル output ディレクトリ命名に使う短縮名。例: KUTE / SX / AMD。NULL の場合は project_id を fallback に使う。';
COMMENT ON COLUMN public.projects.report_extra_allow_terms IS
  '月次報告書 jargon check の禁止語 allow_list。PJ 固有で許可したい用語を入れる (例: KUTE プロジェクトでは "AMD" を許容、など)。';

-- ============================================================================
-- 2. contracts: 税込/税抜 + 送付確認 to: マッチ用
-- ============================================================================

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS tax_basis text,
  ADD COLUMN IF NOT EXISTS recipient_emails text[] NOT NULL DEFAULT ARRAY[]::text[];

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'contracts_tax_basis_check'
      AND conrelid = 'public.contracts'::regclass
  ) THEN
    ALTER TABLE public.contracts
      ADD CONSTRAINT contracts_tax_basis_check
      CHECK (tax_basis IS NULL OR tax_basis IN ('included','excluded'));
  END IF;
END $$;

COMMENT ON COLUMN public.contracts.tax_basis IS
  '契約金額の税基準。included = 税込, excluded = 税抜。月次報告書の請求金額表記に直結。NULL は未登録扱い。';
COMMENT ON COLUMN public.contracts.recipient_emails IS
  '月次報告書送付確認用の to: マッチ用 email 一覧。Gmail の送信履歴と突き合わせて「正しい宛先に出ているか」を検証する。';

-- ============================================================================
-- 3. project_documents: 顧客への正式納品時刻
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'project_documents'
  ) THEN
    ALTER TABLE public.project_documents
      ADD COLUMN IF NOT EXISTS delivered_to_client_at timestamptz;

    COMMENT ON COLUMN public.project_documents.delivered_to_client_at IS
      '顧客に正式に渡した日時。NULL = 未送付 / 内部保存のみ。月次報告書 PDF を送付確認した時点でこの列が埋まる。';
  END IF;
END $$;

-- ============================================================================
-- 4. monthly_reports_external: 顧客向け月次報告書本文
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.monthly_reports_external (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL REFERENCES public.projects(project_id) ON DELETE CASCADE,
  ym text NOT NULL,
  body_md text NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  generated_by_model text,
  pdf_drive_url text,
  pdf_local_path text,
  jargon_check_status text,
  jargon_check_findings jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT monthly_reports_external_jargon_status_check
    CHECK (jargon_check_status IS NULL OR jargon_check_status IN ('clean','warning','failed')),
  CONSTRAINT monthly_reports_external_ym_check
    CHECK (ym ~ '^[0-9]{4}-[0-9]{2}$'),
  CONSTRAINT monthly_reports_external_project_ym_unique
    UNIQUE (project_id, ym)
);

COMMENT ON TABLE public.monthly_reports_external IS
  'L2M-1 外部 (顧客向け) 月次報告書の正本。body_md は LLM 生成結果、PDF は body_md からレンダリング。1 PJ × 1 ym で UNIQUE。再生成は UPDATE で上書き、履歴は llm_prompt_revisions 側で取る。';
COMMENT ON COLUMN public.monthly_reports_external.project_id IS
  'projects.project_id (FK)。CASCADE で消す。';
COMMENT ON COLUMN public.monthly_reports_external.ym IS
  '対象年月 (YYYY-MM)。';
COMMENT ON COLUMN public.monthly_reports_external.body_md IS
  '月次報告書本文 (Markdown)。LLM 生成結果をそのまま保存。PDF レンダリングはここから派生。';
COMMENT ON COLUMN public.monthly_reports_external.generated_at IS
  '生成完了時刻 (LLM call が成功して body_md が確定した時刻)。';
COMMENT ON COLUMN public.monthly_reports_external.generated_by_model IS
  '生成に使った model id (例: claude-opus-4-7)。';
COMMENT ON COLUMN public.monthly_reports_external.pdf_drive_url IS
  '生成 PDF の Google Drive 共有リンク。';
COMMENT ON COLUMN public.monthly_reports_external.pdf_local_path IS
  'ローカル output ディレクトリ上の PDF 相対パス (= projects.report_local_alias 配下)。再現/再生成用。';
COMMENT ON COLUMN public.monthly_reports_external.jargon_check_status IS
  '禁止語チェック結果。clean = 問題なし / warning = 軽微 / failed = 必須修正。projects.report_extra_allow_terms を考慮した上での判定。';
COMMENT ON COLUMN public.monthly_reports_external.jargon_check_findings IS
  '禁止語チェックの詳細 (検出された語 / 該当文脈)。jsonb 配列で複数の検出を保持。';

CREATE INDEX IF NOT EXISTS idx_monthly_reports_external_project_ym
  ON public.monthly_reports_external(project_id, ym DESC);
CREATE INDEX IF NOT EXISTS idx_monthly_reports_external_generated_at
  ON public.monthly_reports_external(generated_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'monthly_reports_external_updated_at'
  ) THEN
    CREATE TRIGGER monthly_reports_external_updated_at
      BEFORE UPDATE ON public.monthly_reports_external
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

ALTER TABLE public.monthly_reports_external ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'monthly_reports_external' AND policyname = 'monthly_reports_external_admin_select') THEN
    CREATE POLICY monthly_reports_external_admin_select
      ON public.monthly_reports_external
      FOR SELECT
      TO authenticated
      USING (is_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'monthly_reports_external' AND policyname = 'monthly_reports_external_admin_insert') THEN
    CREATE POLICY monthly_reports_external_admin_insert
      ON public.monthly_reports_external
      FOR INSERT
      TO authenticated
      WITH CHECK (is_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'monthly_reports_external' AND policyname = 'monthly_reports_external_admin_update') THEN
    CREATE POLICY monthly_reports_external_admin_update
      ON public.monthly_reports_external
      FOR UPDATE
      TO authenticated
      USING (is_admin())
      WITH CHECK (is_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'monthly_reports_external' AND policyname = 'monthly_reports_external_admin_delete') THEN
    CREATE POLICY monthly_reports_external_admin_delete
      ON public.monthly_reports_external
      FOR DELETE
      TO authenticated
      USING (is_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'monthly_reports_external' AND policyname = 'monthly_reports_external_service_role_all') THEN
    CREATE POLICY monthly_reports_external_service_role_all
      ON public.monthly_reports_external
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- ============================================================================
-- 5. llm_prompt_revisions: llm_prompts の本文書き換え履歴
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.llm_prompt_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_key text NOT NULL,
  body_before text,
  body_after text NOT NULL,
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.llm_prompt_revisions IS
  'llm_prompts の body 書き換え履歴。admin UI で prompt を save するたびに 1 行追加。body_before は直前の値、body_after は今回保存した値。';
COMMENT ON COLUMN public.llm_prompt_revisions.prompt_key IS
  'llm_prompts.prompt_key と同じ key。FK は張らない (= llm_prompts 行が削除されても履歴は残す)。';
COMMENT ON COLUMN public.llm_prompt_revisions.body_before IS
  '書き換え前の本文。最初の save では NULL。';
COMMENT ON COLUMN public.llm_prompt_revisions.body_after IS
  '書き換え後の本文 (= save 時点の llm_prompts.body)。';
COMMENT ON COLUMN public.llm_prompt_revisions.updated_by IS
  '保存実行者の email。';
COMMENT ON COLUMN public.llm_prompt_revisions.updated_at IS
  '保存時刻 (= llm_prompts.updated_at と一致する想定)。';

CREATE INDEX IF NOT EXISTS idx_llm_prompt_revisions_key_updated
  ON public.llm_prompt_revisions(prompt_key, updated_at DESC);

ALTER TABLE public.llm_prompt_revisions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'llm_prompt_revisions' AND policyname = 'llm_prompt_revisions_admin_select') THEN
    CREATE POLICY llm_prompt_revisions_admin_select
      ON public.llm_prompt_revisions
      FOR SELECT
      TO authenticated
      USING (is_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'llm_prompt_revisions' AND policyname = 'llm_prompt_revisions_admin_insert') THEN
    CREATE POLICY llm_prompt_revisions_admin_insert
      ON public.llm_prompt_revisions
      FOR INSERT
      TO authenticated
      WITH CHECK (is_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'llm_prompt_revisions' AND policyname = 'llm_prompt_revisions_service_role_all') THEN
    CREATE POLICY llm_prompt_revisions_service_role_all
      ON public.llm_prompt_revisions
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- ============================================================================
-- 6. llm_prompts seed: L2M-1 v2 用の prompt_key を確保
--    body は後で admin UI から流すので placeholder のまま。
--    既存行がある場合は description / model / max_tokens / notes だけ最新化する
--    (本文は admin が編集している可能性があるので上書きしない)。
-- ============================================================================

INSERT INTO public.llm_prompts (prompt_key, description, body, model, max_tokens, is_active, notes)
VALUES (
  'l2m1.monthly_report.internal.v2',
  'L2M-1 内部向け月次報告書 v2 の生成 prompt。生データ (Slack/Drive/Calendar/Notion/Gmail) を入力に、社内レビュー向けの月次レポート本文 (Markdown) を生成する。',
  '',
  'claude-opus-4-7',
  16000,
  false,
  '初期は空。admin/llm-prompts で本文を入力し is_active=TRUE にすると routine が DB の prompt を使う (空のときはコード側の fallback)。'
)
ON CONFLICT (prompt_key) DO UPDATE SET
  description = EXCLUDED.description,
  model = EXCLUDED.model,
  max_tokens = EXCLUDED.max_tokens,
  notes = EXCLUDED.notes,
  updated_at = now();

INSERT INTO public.llm_prompts (prompt_key, description, body, model, max_tokens, is_active, notes)
VALUES (
  'l2m1.monthly_report.external.v2',
  'L2M-1 外部 (顧客向け) 月次報告書 v2 の生成 prompt。社内 internal レポートと生データを入力に、顧客に渡す月次報告書本文 (Markdown) を生成する。jargon (社内用語) は projects.report_extra_allow_terms を例外として、それ以外は禁止語チェックの対象。',
  '',
  'claude-opus-4-7',
  16000,
  false,
  '初期は空。admin/llm-prompts で本文を入力し is_active=TRUE にすると routine が DB の prompt を使う。projects.work_content / contracts.tax_basis / contracts.recipient_emails を context として渡す前提。'
)
ON CONFLICT (prompt_key) DO UPDATE SET
  description = EXCLUDED.description,
  model = EXCLUDED.model,
  max_tokens = EXCLUDED.max_tokens,
  notes = EXCLUDED.notes,
  updated_at = now();
