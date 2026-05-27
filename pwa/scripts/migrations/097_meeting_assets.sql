-- 097_meeting_assets.sql
-- MTGサマリにスクショ/資料/画面キャプチャを添付するための private asset store.

CREATE TABLE IF NOT EXISTS public.meeting_assets (
  asset_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id text NOT NULL REFERENCES public.project_meeting_summaries(meeting_id) ON DELETE CASCADE,
  project_id text NOT NULL,
  storage_bucket text NOT NULL DEFAULT 'meeting-assets',
  storage_path text NOT NULL UNIQUE,
  file_name text NOT NULL,
  media_type text NOT NULL,
  file_size_bytes bigint NOT NULL DEFAULT 0,
  asset_kind text NOT NULL DEFAULT 'upload'
    CHECK (asset_kind IN ('upload', 'paste', 'screen_capture', 'notion_image', 'generated')),
  caption text,
  extracted_text text,
  source_url text,
  sort_order integer NOT NULL DEFAULT 0,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.meeting_assets IS
  'MTGサマリに紐づくスクショ/資料/画面キャプチャ。実ファイルは private Supabase Storage meeting-assets bucket に保存する。';
COMMENT ON COLUMN public.meeting_assets.asset_kind IS
  'upload=file select/drop, paste=clipboard paste, screen_capture=getDisplayMedia snapshot, notion_image=Notion block import, generated=system generated.';
COMMENT ON COLUMN public.meeting_assets.extracted_text IS
  '将来のOCR/vision抽出結果。画像そのものではなく、短いテキスト化された根拠だけを保存する。';

CREATE INDEX IF NOT EXISTS idx_meeting_assets_meeting
  ON public.meeting_assets(meeting_id, sort_order, created_at);

CREATE INDEX IF NOT EXISTS idx_meeting_assets_project
  ON public.meeting_assets(project_id, created_at DESC);

DROP TRIGGER IF EXISTS meeting_assets_updated_at ON public.meeting_assets;
CREATE TRIGGER meeting_assets_updated_at
  BEFORE UPDATE ON public.meeting_assets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.meeting_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS meeting_assets_admin_select ON public.meeting_assets;
CREATE POLICY meeting_assets_admin_select
  ON public.meeting_assets
  FOR SELECT
  TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS meeting_assets_admin_insert ON public.meeting_assets;
CREATE POLICY meeting_assets_admin_insert
  ON public.meeting_assets
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS meeting_assets_admin_update ON public.meeting_assets;
CREATE POLICY meeting_assets_admin_update
  ON public.meeting_assets
  FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS meeting_assets_admin_delete ON public.meeting_assets;
CREATE POLICY meeting_assets_admin_delete
  ON public.meeting_assets
  FOR DELETE
  TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS meeting_assets_service_role_all ON public.meeting_assets;
CREATE POLICY meeting_assets_service_role_all
  ON public.meeting_assets
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'meeting-assets',
  'meeting-assets',
  false,
  26214400,
  ARRAY['image/png','image/jpeg','image/webp','image/gif','application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS meeting_assets_storage_admin_select ON storage.objects;
CREATE POLICY meeting_assets_storage_admin_select
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'meeting-assets'
    AND is_admin()
  );

DROP POLICY IF EXISTS meeting_assets_storage_service_role_all ON storage.objects;
CREATE POLICY meeting_assets_storage_service_role_all
  ON storage.objects
  FOR ALL
  TO service_role
  USING (bucket_id = 'meeting-assets')
  WITH CHECK (bucket_id = 'meeting-assets');
