-- 310_workspace_document_decks.sql
--
-- 目的:
--   資料室HTMLを「パワポ同様に編集できるUI」へ移行するための土台
--   (spec/2-8-workspace-document-deck-editor-plan.md の §3)。
--   Phase 0 で必要なのは workspace_document_revisions だが、
--   3表は同じ設計単位なので1 migration で作る。
--
-- 不変条件:
--   - workspace_documents が正本の所有者。3表とも document_id で ON DELETE CASCADE。
--   - decks.model がモデル正本。HTML/PDF/PPTX はそこからの生成物であり、逆流させない。
--   - revisions は追記のみ。復元は「復元後の内容を新しい版として積む」で表現し、履歴を壊さない。
--   - private Storage の生URLを保存しない (storage_path だけを持つ)。
--   - 画像は assets 参照。model JSON に base64 を埋めない。
--
-- 冪等性:
--   CREATE TABLE/INDEX は IF NOT EXISTS、policy/trigger は DROP+CREATE。
--   適用後は dump_schema.py で design/db_schema.md を再生成する。

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. workspace_document_decks — 構造化モデル正本 (1資料 = 最大1モデル)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workspace_document_decks (
  document_id UUID PRIMARY KEY
    REFERENCES public.workspace_documents(document_id) ON DELETE CASCADE,
  schema_version INT NOT NULL CHECK (schema_version >= 1),
  model JSONB NOT NULL,
  model_sha256 TEXT NOT NULL CHECK (model_sha256 ~ '^[0-9a-f]{64}$'),
  published_sha256 TEXT CHECK (published_sha256 ~ '^[0-9a-f]{64}$'),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by_account_id UUID
    REFERENCES public.workspace_user_accounts(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.workspace_document_decks IS
  '資料室スライドエディタの構造化モデル正本。HTML/PDF/PPTXはここからの生成物。';
COMMENT ON COLUMN public.workspace_document_decks.model IS
  'デッキモデル JSON (spec/2-8 §3.2)。画像はassetId参照で、base64を埋めない。';
COMMENT ON COLUMN public.workspace_document_decks.model_sha256 IS
  '現在のmodelのsha256。編集保存時の楽観ロック鍵。';
COMMENT ON COLUMN public.workspace_document_decks.published_sha256 IS
  '最後に公開HTMLへ反映したmodelのsha256。model_sha256と違えば未公開の変更がある。';

CREATE INDEX IF NOT EXISTS idx_workspace_document_decks_updated
  ON public.workspace_document_decks (updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_workspace_document_decks_unpublished
  ON public.workspace_document_decks (updated_at DESC)
  WHERE published_sha256 IS DISTINCT FROM model_sha256;

-- ---------------------------------------------------------------------------
-- 2. workspace_document_revisions — 版履歴 (追記のみ)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workspace_document_revisions (
  revision_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL
    REFERENCES public.workspace_documents(document_id) ON DELETE CASCADE,
  revision_no INT NOT NULL CHECK (revision_no >= 1),
  kind TEXT NOT NULL CHECK (kind IN ('deck_model', 'html_source')),
  model JSONB,
  storage_bucket TEXT,
  storage_path TEXT,
  content_sha256 TEXT NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  byte_size BIGINT NOT NULL CHECK (byte_size >= 0),
  note TEXT,
  pinned BOOLEAN NOT NULL DEFAULT FALSE,
  created_by_account_id UUID
    REFERENCES public.workspace_user_accounts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT workspace_document_revisions_unique_no UNIQUE (document_id, revision_no),
  CONSTRAINT workspace_document_revisions_payload CHECK (
    (kind = 'deck_model'  AND model IS NOT NULL AND storage_path IS NULL AND storage_bucket IS NULL)
    OR
    (kind = 'html_source' AND model IS NULL AND storage_path IS NOT NULL AND storage_bucket IS NOT NULL)
  )
);

COMMENT ON TABLE public.workspace_document_revisions IS
  '資料室資料の版履歴。追記のみで、復元も「新しい版を積む」で表現する。spec/1-4 の既知欠落を埋める表。';
COMMENT ON COLUMN public.workspace_document_revisions.kind IS
  'deck_model=モデルJSONの版 / html_source=HTMLソースの版 (実体はStorageの退避object)。';
COMMENT ON COLUMN public.workspace_document_revisions.pinned IS
  'TRUEの版は保持件数の上限を超えても自動削除しない (承認版・提出版の保全用)。';
COMMENT ON COLUMN public.workspace_document_revisions.note IS
  '版の理由メモ。秘密値・生transcriptを書かない。';

CREATE INDEX IF NOT EXISTS idx_workspace_document_revisions_listing
  ON public.workspace_document_revisions (document_id, revision_no DESC);

CREATE INDEX IF NOT EXISTS idx_workspace_document_revisions_pinned
  ON public.workspace_document_revisions (document_id, revision_no DESC)
  WHERE pinned;

-- ---------------------------------------------------------------------------
-- 3. workspace_document_assets — デッキが参照する画像等
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workspace_document_assets (
  asset_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL
    REFERENCES public.workspace_documents(document_id) ON DELETE CASCADE,
  storage_bucket TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  byte_size BIGINT NOT NULL CHECK (byte_size >= 0),
  width INT CHECK (width > 0),
  height INT CHECK (height > 0),
  content_sha256 TEXT CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  created_by_account_id UUID
    REFERENCES public.workspace_user_accounts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT workspace_document_assets_unique_object UNIQUE (storage_bucket, storage_path)
);

COMMENT ON TABLE public.workspace_document_assets IS
  '資料室デッキが参照する画像等。公開HTMLではdata:URIへ埋め込むが、編集中は参照のまま保つ。';

CREATE INDEX IF NOT EXISTS idx_workspace_document_assets_document
  ON public.workspace_document_assets (document_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 4. trigger / RLS / grant — workspace_documents と同じ境界に揃える
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS workspace_document_decks_touch_updated_at ON public.workspace_document_decks;
CREATE TRIGGER workspace_document_decks_touch_updated_at
  BEFORE UPDATE ON public.workspace_document_decks
  FOR EACH ROW EXECUTE FUNCTION public.touch_workspace_access_updated_at();

ALTER TABLE public.workspace_document_decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_document_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_document_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspace_document_decks_admin_all ON public.workspace_document_decks;
CREATE POLICY workspace_document_decks_admin_all
  ON public.workspace_document_decks
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS workspace_document_decks_service_role_all ON public.workspace_document_decks;
CREATE POLICY workspace_document_decks_service_role_all
  ON public.workspace_document_decks
  FOR ALL TO service_role
  USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS workspace_document_revisions_admin_all ON public.workspace_document_revisions;
CREATE POLICY workspace_document_revisions_admin_all
  ON public.workspace_document_revisions
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS workspace_document_revisions_service_role_all ON public.workspace_document_revisions;
CREATE POLICY workspace_document_revisions_service_role_all
  ON public.workspace_document_revisions
  FOR ALL TO service_role
  USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS workspace_document_assets_admin_all ON public.workspace_document_assets;
CREATE POLICY workspace_document_assets_admin_all
  ON public.workspace_document_assets
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS workspace_document_assets_service_role_all ON public.workspace_document_assets;
CREATE POLICY workspace_document_assets_service_role_all
  ON public.workspace_document_assets
  FOR ALL TO service_role
  USING (TRUE) WITH CHECK (TRUE);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_document_decks TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_document_revisions TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_document_assets TO authenticated, service_role;

COMMIT;

-- 安全なロールバックは削除ではなく機能停止で行う:
--   資料室UIから版履歴・デッキ編集の導線を外す (= APIは残るが誰も呼ばない)。
--   3表のDROPは、退避済みStorage objectを参照不能にするため自動ロールバックに含めない。
