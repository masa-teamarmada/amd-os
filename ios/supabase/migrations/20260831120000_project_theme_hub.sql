-- 20260831120000_project_theme_hub.sql
--
-- ZMP(p19) 4テーマ作業ハブの土台。既存の project_management_tracks /
-- project_management_track_value_milestones / project_management_* 運用スキーマ /
-- project_meeting_summaries / workspace_documents を正本のまま再利用し、
-- 新規テーブルはテーマのプロフィール文、会議・書類のテーマ紐付け(多対多)、
-- 「ファイル未着手の予定成果物」、MTG/書類を運用チェーンへ結ぶ最小限の
-- 型付き関連メタデータに限定する。
--
-- 本ファイルは root review (/tmp/amie-zmp-theme.imx1hK/phase1-review.md) の
-- 6件の指摘を反映した改訂版。各セクションに [Rn] で対応する指摘番号を明記する。
--
-- 参照した既存正本 (pwa/scripts/migrations/):
--   182_project_scoped_workspace.sql      -- amd_os_can_access_project(project_id) 等
--   183_project_management_workspace.sql  -- amd_os_can_manage_project_shared_data,
--                                              project_management_touch_updated_at,
--                                              project_management_block_authenticated_delete
--   200_project_management_tasks.sql      -- milestone_id NOT NULL, task guard trigger
--   273_project_management_tracks.sql     -- (project_id, track) 複合FKパターン
--   024_project_meeting_summaries.sql     -- meeting_id TEXT PK, project_id TEXT NOT NULL
--   216_workspace_document_rooms.sql      -- document_id UUID PK, project_id TEXT NULLABLE
--
-- 冪等性: CREATE TABLE IF NOT EXISTS / ON CONFLICT DO UPDATE / UPDATE ... WHERE /
--         ADD CONSTRAINT IF NOT EXISTS相当のガード。本migrationはrootが検証後に適用する。
--         workerはこのファイルをDBへ適用しない。

BEGIN;

-- =====================================================================
-- 1. p19 の track を4テーマへ整理 (リネーム+分割。物理削除なし)
--    既存: okudoor(1) / katsushika_hydrogen(2) / kr_management_reform(3)
--    変更後: kr_management_reform(1) / katsushika_hydrogen(2)
--            / okudoor_operations(3, 旧okudoor) / okudoor_system(4, 新規)
--    root review: 変更不要 (good) と確認済み。無修正で維持。
-- =====================================================================

-- 1-1. KR経営改革: ラベルは既存のまま、表示順のみ先頭へ
UPDATE public.project_management_tracks
SET sort_order = 1, updated_at = now()
WHERE project_id = 'p19' AND track_key = 'kr_management_reform';

-- 1-2. 水素循環PJ: ラベルをまさ確定の表記へ変更、表示順2位
UPDATE public.project_management_tracks
SET label = '水素循環PJ', short_label = '水素', sort_order = 2, updated_at = now()
WHERE project_id = 'p19' AND track_key = 'katsushika_hydrogen';

-- 1-3. OkuDoor運営: 既存 track_key 'okudoor' をリネーム(UPDATE。ON UPDATE CASCADE で
--      project_management_track_value_milestones.track_key も自動追従)。
--      この時点で旧okudoorに紐づく3MS(運営2件+システム1件)は一旦すべて
--      okudoor_operations 側へ移る。システム1件は次のステップで再配置する。
UPDATE public.project_management_tracks
SET track_key = 'okudoor_operations', label = 'OkuDoor運営', short_label = 'OkuDoor運営',
    sort_order = 3, updated_at = now()
WHERE project_id = 'p19' AND track_key = 'okudoor';

-- 1-4. OkuDoorシステム開発＆運用: 新規track (冪等insert)
INSERT INTO public.project_management_tracks (project_id, track_key, label, short_label, accent, sort_order)
VALUES ('p19', 'okudoor_system', 'OkuDoorシステム開発＆運用', 'システム', '#4c6a8f', 4)
ON CONFLICT (project_id, track_key) DO UPDATE SET
  label = EXCLUDED.label,
  short_label = EXCLUDED.short_label,
  accent = EXCLUDED.accent,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

-- 1-5. 「OkuDoorシステム開発」value MSの接続を okudoor_operations から
--      okudoor_system へ再配置 (id/進捗は不変、track_keyのみ変更)。
UPDATE public.project_management_track_value_milestones
SET track_key = 'okudoor_system', sort_order = 1, updated_at = now()
WHERE project_id = 'p19'
  AND track_key = 'okudoor_operations'
  AND milestone_id IN (
    SELECT vm.milestone_id
    FROM public.value_milestones vm
    JOIN public.value_plan_cycles vpc ON vpc.plan_cycle_id = vm.plan_cycle_id
    WHERE vpc.project_id = 'p19'
      AND vm.title = 'OkuDoorシステム開発'
      AND vm.is_active = true
  );

-- 1-6. 事後assert: 4テーマ、9接続、4/2/2/1配置、sort_order 1..4
DO $$
DECLARE
  v_kr int; v_h2 int; v_ops int; v_sys int; v_tracks int;
BEGIN
  SELECT count(*) INTO v_tracks FROM public.project_management_tracks
    WHERE project_id = 'p19' AND track_key IN ('kr_management_reform','katsushika_hydrogen','okudoor_operations','okudoor_system');
  IF v_tracks <> 4 THEN
    RAISE EXCEPTION 'p19 track count is %, expected 4', v_tracks;
  END IF;

  SELECT count(*) INTO v_kr FROM public.project_management_track_value_milestones WHERE project_id = 'p19' AND track_key = 'kr_management_reform';
  SELECT count(*) INTO v_h2 FROM public.project_management_track_value_milestones WHERE project_id = 'p19' AND track_key = 'katsushika_hydrogen';
  SELECT count(*) INTO v_ops FROM public.project_management_track_value_milestones WHERE project_id = 'p19' AND track_key = 'okudoor_operations';
  SELECT count(*) INTO v_sys FROM public.project_management_track_value_milestones WHERE project_id = 'p19' AND track_key = 'okudoor_system';

  IF v_kr <> 4 THEN RAISE EXCEPTION 'kr_management_reform milestone count is %, expected 4', v_kr; END IF;
  IF v_h2 <> 2 THEN RAISE EXCEPTION 'katsushika_hydrogen milestone count is %, expected 2', v_h2; END IF;
  IF v_ops <> 2 THEN RAISE EXCEPTION 'okudoor_operations milestone count is %, expected 2', v_ops; END IF;
  IF v_sys <> 1 THEN RAISE EXCEPTION 'okudoor_system milestone count is %, expected 1', v_sys; END IF;
END $$;

-- =====================================================================
-- 1B. [R5] 複合FKを可能にするための最小限の追加UNIQUE制約
--     project_meeting_summaries.meeting_id / workspace_documents.document_id は
--     既にPK(単独列)で一意。ここへ (project_id, id列) の複合UNIQUEを追加しても
--     既存の一意性・既存データ・既存RLS・既存クエリには一切影響しない
--     (PKはそのまま、追加のUNIQUE制約が1本増えるだけ)。
--     これにより「テーマ⇔MTG」「テーマ⇔書類」のブリッジ行は、
--     trigger頼みではなく複合FKでcross-project混入をDB制約として拒否できる。
--     project_meeting_summaries の pms_read_anon 等RLSは一切変更しない。
-- =====================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'project_meeting_summaries_project_meeting_uq'
      AND conrelid = 'public.project_meeting_summaries'::regclass
  ) THEN
    ALTER TABLE public.project_meeting_summaries
      ADD CONSTRAINT project_meeting_summaries_project_meeting_uq UNIQUE (project_id, meeting_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'workspace_documents_project_document_uq'
      AND conrelid = 'public.workspace_documents'::regclass
  ) THEN
    ALTER TABLE public.workspace_documents
      ADD CONSTRAINT workspace_documents_project_document_uq UNIQUE (project_id, document_id);
  END IF;
END $$;

-- =====================================================================
-- 2. project_theme_profiles: テーマの目的/現状などの内部文面
--    project_management_tracks は project_management_tracks_read
--    (FOR SELECT TO public USING (true)) で匿名読取可能なため、
--    内部文面は本テーブルへ隔離しauthenticated限定で保護する。
--    [R1] SELECT: amd_os_can_access_project(project_id) へ変更 (旧: amd_os_is_member())
--    [R1] 書込み: amd_os_can_manage_project_shared_data(project_id) (旧: is_admin()単独)
--    [R5] soft-delete列 + 物理削除拒否trigger + version自動採番を追加
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.project_theme_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL,
  track_key text NOT NULL,
  purpose_md text,
  current_state_md text,
  next_focus_note text,
  created_by_member_id text REFERENCES public.members(member_id) ON DELETE SET NULL,
  updated_by_member_id text REFERENCES public.members(member_id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by text,
  version int4 NOT NULL DEFAULT 1,
  UNIQUE (project_id, track_key),
  FOREIGN KEY (project_id, track_key)
    REFERENCES public.project_management_tracks (project_id, track_key)
    ON UPDATE CASCADE ON DELETE CASCADE
);

COMMENT ON TABLE public.project_theme_profiles IS
  'テーマ(project_management_tracks)ごとの目的/現状などの内部向け文面。project_management_tracksは匿名読取可のためここへ隔離しauthenticated限定で保護する。';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_theme_profiles TO authenticated, service_role;
ALTER TABLE public.project_theme_profiles ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS project_theme_profiles_touch_updated_at ON public.project_theme_profiles;
CREATE TRIGGER project_theme_profiles_touch_updated_at
BEFORE UPDATE ON public.project_theme_profiles
FOR EACH ROW EXECUTE FUNCTION public.project_management_touch_updated_at();

DROP TRIGGER IF EXISTS project_theme_profiles_block_delete ON public.project_theme_profiles;
CREATE TRIGGER project_theme_profiles_block_delete
BEFORE DELETE ON public.project_theme_profiles
FOR EACH ROW EXECUTE FUNCTION public.project_management_block_authenticated_delete();

DROP POLICY IF EXISTS project_theme_profiles_member_select ON public.project_theme_profiles;
CREATE POLICY project_theme_profiles_member_select
ON public.project_theme_profiles FOR SELECT TO authenticated
USING (public.amd_os_can_access_project(project_id) AND deleted_at IS NULL);

DROP POLICY IF EXISTS project_theme_profiles_manager_insert ON public.project_theme_profiles;
CREATE POLICY project_theme_profiles_manager_insert
ON public.project_theme_profiles FOR INSERT TO authenticated
WITH CHECK (public.amd_os_can_manage_project_shared_data(project_id));

DROP POLICY IF EXISTS project_theme_profiles_manager_update ON public.project_theme_profiles;
CREATE POLICY project_theme_profiles_manager_update
ON public.project_theme_profiles FOR UPDATE TO authenticated
USING (public.amd_os_can_manage_project_shared_data(project_id))
WITH CHECK (public.amd_os_can_manage_project_shared_data(project_id));

DROP POLICY IF EXISTS project_theme_profiles_service_all ON public.project_theme_profiles;
CREATE POLICY project_theme_profiles_service_all
ON public.project_theme_profiles FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- =====================================================================
-- 3. project_theme_meetings: project_meeting_summaries とテーマの多対多リンク
--    会議本文は複製しない。project_meeting_summariesのRLSはここでは変更しない。
--    [R5] 複合FK (project_id, meeting_id) で cross-project混入をDB制約として拒否
--         (旧: BEFORE triggerでの手動チェック → 削除し複合FKへ置換)
--    [R1] RLSをamd_os_can_access_project / amd_os_can_manage_project_shared_dataへ
--    [R4] client_token: 「新規MTG作成+テーマ紐付け」を1関数で行う際の冪等キー
--         (既存MTGを既存テーマへ単純リンクする場合は自然な複合UNIQUEで
--          ON CONFLICT DO NOTHINGだけで retry-safe。client_tokenは
--          「新規作成を伴う」ケースのみ必要)
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.project_theme_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL,
  track_key text NOT NULL,
  meeting_id text NOT NULL,
  client_token uuid,
  sort_order integer NOT NULL DEFAULT 0,
  created_by_member_id text REFERENCES public.members(member_id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by text,
  version int4 NOT NULL DEFAULT 1,
  UNIQUE (project_id, track_key, meeting_id),
  FOREIGN KEY (project_id, track_key)
    REFERENCES public.project_management_tracks (project_id, track_key)
    ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (project_id, meeting_id)
    REFERENCES public.project_meeting_summaries (project_id, meeting_id)
    ON UPDATE CASCADE ON DELETE CASCADE
);

COMMENT ON TABLE public.project_theme_meetings IS
  'project_meeting_summariesとテーマの関連(多対多)。1件のMTGは複数テーマに属せる。会議本文はここに複製しない。project_idはcross-project混入防止の複合FKのために保持する。';

CREATE UNIQUE INDEX IF NOT EXISTS project_theme_meetings_client_token_uq
  ON public.project_theme_meetings (project_id, track_key, client_token)
  WHERE client_token IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_theme_meetings TO authenticated, service_role;
ALTER TABLE public.project_theme_meetings ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS project_theme_meetings_touch_updated_at ON public.project_theme_meetings;
CREATE TRIGGER project_theme_meetings_touch_updated_at
BEFORE UPDATE ON public.project_theme_meetings
FOR EACH ROW EXECUTE FUNCTION public.project_management_touch_updated_at();

DROP TRIGGER IF EXISTS project_theme_meetings_block_delete ON public.project_theme_meetings;
CREATE TRIGGER project_theme_meetings_block_delete
BEFORE DELETE ON public.project_theme_meetings
FOR EACH ROW EXECUTE FUNCTION public.project_management_block_authenticated_delete();

DROP POLICY IF EXISTS project_theme_meetings_member_select ON public.project_theme_meetings;
CREATE POLICY project_theme_meetings_member_select
ON public.project_theme_meetings FOR SELECT TO authenticated
USING (public.amd_os_can_access_project(project_id) AND deleted_at IS NULL);

DROP POLICY IF EXISTS project_theme_meetings_manager_insert ON public.project_theme_meetings;
CREATE POLICY project_theme_meetings_manager_insert
ON public.project_theme_meetings FOR INSERT TO authenticated
WITH CHECK (public.amd_os_can_manage_project_shared_data(project_id));

DROP POLICY IF EXISTS project_theme_meetings_manager_update ON public.project_theme_meetings;
CREATE POLICY project_theme_meetings_manager_update
ON public.project_theme_meetings FOR UPDATE TO authenticated
USING (public.amd_os_can_manage_project_shared_data(project_id))
WITH CHECK (public.amd_os_can_manage_project_shared_data(project_id));

DROP POLICY IF EXISTS project_theme_meetings_service_all ON public.project_theme_meetings;
CREATE POLICY project_theme_meetings_service_all
ON public.project_theme_meetings FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- =====================================================================
-- 4. project_theme_documents: workspace_documents とテーマの多対多リンク
--    [R5] 複合FK (project_id, document_id) で cross-project混入をDB制約として拒否
--    [R5] upload_status='active'以外(pending/failed/archived)はリンク新規作成を拒否
--         (archivedがこのスキーマの「論理削除済み」に相当。trigger必須、FK不可)
--    [R1] RLSをamd_os_can_access_project / amd_os_can_manage_project_shared_dataへ
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.project_theme_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL,
  track_key text NOT NULL,
  document_id uuid NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_by_member_id text REFERENCES public.members(member_id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by text,
  version int4 NOT NULL DEFAULT 1,
  UNIQUE (project_id, track_key, document_id),
  FOREIGN KEY (project_id, track_key)
    REFERENCES public.project_management_tracks (project_id, track_key)
    ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (project_id, document_id)
    REFERENCES public.workspace_documents (project_id, document_id)
    ON UPDATE CASCADE ON DELETE CASCADE
);

COMMENT ON TABLE public.project_theme_documents IS
  'workspace_documentsとテーマの関連(多対多)。同一documentが複数テーマから参照される。project_idはcross-project混入防止の複合FKのために保持する。';

CREATE OR REPLACE FUNCTION public.check_project_theme_documents_active()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_status text;
BEGIN
  -- [final-fixes #1] soft-deleting (or re-saving an already soft-deleted row without
  -- retargeting document_id) must not require the linked document to still be active,
  -- otherwise a stale association can never be cleaned up. Restoring (deleted_at ->
  -- NULL) and any document_id change still go through the active check below.
  IF TG_OP = 'UPDATE' AND NEW.deleted_at IS NOT NULL
     AND NEW.document_id = OLD.document_id AND NEW.project_id = OLD.project_id THEN
    RETURN NEW;
  END IF;

  SELECT wd.upload_status INTO v_status
  FROM public.workspace_documents wd
  WHERE wd.document_id = NEW.document_id;

  IF v_status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'document % is not active (status=%)', NEW.document_id, v_status
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS project_theme_documents_active_check ON public.project_theme_documents;
CREATE TRIGGER project_theme_documents_active_check
BEFORE INSERT OR UPDATE OF document_id, deleted_at ON public.project_theme_documents
FOR EACH ROW EXECUTE FUNCTION public.check_project_theme_documents_active();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_theme_documents TO authenticated, service_role;
ALTER TABLE public.project_theme_documents ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS project_theme_documents_touch_updated_at ON public.project_theme_documents;
CREATE TRIGGER project_theme_documents_touch_updated_at
BEFORE UPDATE ON public.project_theme_documents
FOR EACH ROW EXECUTE FUNCTION public.project_management_touch_updated_at();

DROP TRIGGER IF EXISTS project_theme_documents_block_delete ON public.project_theme_documents;
CREATE TRIGGER project_theme_documents_block_delete
BEFORE DELETE ON public.project_theme_documents
FOR EACH ROW EXECUTE FUNCTION public.project_management_block_authenticated_delete();

DROP POLICY IF EXISTS project_theme_documents_member_select ON public.project_theme_documents;
CREATE POLICY project_theme_documents_member_select
ON public.project_theme_documents FOR SELECT TO authenticated
USING (public.amd_os_can_access_project(project_id) AND deleted_at IS NULL);

DROP POLICY IF EXISTS project_theme_documents_manager_insert ON public.project_theme_documents;
CREATE POLICY project_theme_documents_manager_insert
ON public.project_theme_documents FOR INSERT TO authenticated
WITH CHECK (public.amd_os_can_manage_project_shared_data(project_id));

DROP POLICY IF EXISTS project_theme_documents_manager_update ON public.project_theme_documents;
CREATE POLICY project_theme_documents_manager_update
ON public.project_theme_documents FOR UPDATE TO authenticated
USING (public.amd_os_can_manage_project_shared_data(project_id))
WITH CHECK (public.amd_os_can_manage_project_shared_data(project_id));

DROP POLICY IF EXISTS project_theme_documents_service_all ON public.project_theme_documents;
CREATE POLICY project_theme_documents_service_all
ON public.project_theme_documents FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- =====================================================================
-- 5. project_theme_deliverables: ファイル未着手の「予定成果物」
--    完成後は同一 workspace_documents 行を linked_document_id で参照する
--    (新規documentを複製しない)。project_idがtrack_key経由でも
--    document経由でも複合FKにできない(linked_document_idはNULL許容かつ
--    ON DELETE SET NULLは対象列のみへ効かせたいため、単独列FK+triggerのまま)。
--    [R5] linked_document_idもupload_status='active'以外を拒否
--    [R1] RLSをamd_os_can_access_project / amd_os_can_manage_project_shared_dataへ
--    [R4] client_token: 予定成果物そのものの新規作成を retry-safe にする冪等キー
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.project_theme_deliverables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL,
  track_key text NOT NULL,
  title text NOT NULL,
  description_md text,
  owner_member_id text REFERENCES public.members(member_id) ON DELETE SET NULL,
  due_on date,
  status text NOT NULL DEFAULT 'planned',
  linked_document_id uuid,
  client_token uuid,
  sort_order integer NOT NULL DEFAULT 0,
  created_by_member_id text REFERENCES public.members(member_id) ON DELETE SET NULL,
  updated_by_member_id text REFERENCES public.members(member_id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by text,
  version int4 NOT NULL DEFAULT 1,
  CHECK (status IN ('planned', 'in_progress', 'submitted', 'linked', 'cancelled')),
  CHECK (linked_document_id IS NULL OR status IN ('linked', 'submitted')),
  CHECK (status <> 'linked' OR linked_document_id IS NOT NULL),
  FOREIGN KEY (project_id, track_key)
    REFERENCES public.project_management_tracks (project_id, track_key)
    ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (linked_document_id)
    REFERENCES public.workspace_documents (document_id)
    ON DELETE SET NULL
);

COMMENT ON TABLE public.project_theme_deliverables IS
  'テーマの予定成果物。ファイルが無い段階でも予定として保持し、完成後は既存workspace_documents行をlinked_document_idで参照する(複製しない)。';

CREATE UNIQUE INDEX IF NOT EXISTS project_theme_deliverables_client_token_uq
  ON public.project_theme_deliverables (project_id, track_key, client_token)
  WHERE client_token IS NOT NULL;

CREATE OR REPLACE FUNCTION public.check_project_theme_deliverables_document_match()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  doc_project_id text;
  doc_status text;
BEGIN
  IF NEW.linked_document_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- [final-fixes #1] soft-deleting a deliverable (or re-saving one already
  -- soft-deleted, without retargeting linked_document_id) must not require the
  -- linked document to still be active, otherwise a stale association can never
  -- be cleaned up. Restoring (deleted_at -> NULL) and any linked_document_id
  -- change still go through the active check below.
  IF TG_OP = 'UPDATE' AND NEW.deleted_at IS NOT NULL
     AND NEW.linked_document_id = OLD.linked_document_id AND NEW.project_id = OLD.project_id THEN
    RETURN NEW;
  END IF;

  SELECT wd.project_id, wd.upload_status INTO doc_project_id, doc_status
  FROM public.workspace_documents wd
  WHERE wd.document_id = NEW.linked_document_id;

  IF doc_project_id IS NULL THEN
    RAISE EXCEPTION 'document % not found in workspace_documents', NEW.linked_document_id
      USING ERRCODE = '23503';
  END IF;

  IF doc_project_id IS DISTINCT FROM NEW.project_id THEN
    RAISE EXCEPTION 'project_id % does not match linked document % project %',
      NEW.project_id, NEW.linked_document_id, doc_project_id
      USING ERRCODE = '23514';
  END IF;

  IF doc_status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'linked document % is not active (status=%)', NEW.linked_document_id, doc_status
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS check_document_match ON public.project_theme_deliverables;
CREATE TRIGGER check_document_match
BEFORE INSERT OR UPDATE OF linked_document_id, deleted_at, project_id ON public.project_theme_deliverables
  FOR EACH ROW EXECUTE FUNCTION public.check_project_theme_deliverables_document_match();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_theme_deliverables TO authenticated, service_role;
ALTER TABLE public.project_theme_deliverables ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS project_theme_deliverables_touch_updated_at ON public.project_theme_deliverables;
CREATE TRIGGER project_theme_deliverables_touch_updated_at
BEFORE UPDATE ON public.project_theme_deliverables
FOR EACH ROW EXECUTE FUNCTION public.project_management_touch_updated_at();

DROP TRIGGER IF EXISTS project_theme_deliverables_block_delete ON public.project_theme_deliverables;
CREATE TRIGGER project_theme_deliverables_block_delete
BEFORE DELETE ON public.project_theme_deliverables
FOR EACH ROW EXECUTE FUNCTION public.project_management_block_authenticated_delete();

DROP POLICY IF EXISTS project_theme_deliverables_member_select ON public.project_theme_deliverables;
CREATE POLICY project_theme_deliverables_member_select
ON public.project_theme_deliverables FOR SELECT TO authenticated
USING (public.amd_os_can_access_project(project_id) AND deleted_at IS NULL);

DROP POLICY IF EXISTS project_theme_deliverables_manager_insert ON public.project_theme_deliverables;
CREATE POLICY project_theme_deliverables_manager_insert
ON public.project_theme_deliverables FOR INSERT TO authenticated
WITH CHECK (public.amd_os_can_manage_project_shared_data(project_id));

DROP POLICY IF EXISTS project_theme_deliverables_manager_update ON public.project_theme_deliverables;
CREATE POLICY project_theme_deliverables_manager_update
ON public.project_theme_deliverables FOR UPDATE TO authenticated
USING (public.amd_os_can_manage_project_shared_data(project_id))
WITH CHECK (public.amd_os_can_manage_project_shared_data(project_id));

DROP POLICY IF EXISTS project_theme_deliverables_service_all ON public.project_theme_deliverables;
CREATE POLICY project_theme_deliverables_service_all
ON public.project_theme_deliverables FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- =====================================================================
-- 6. [R3] project_theme_work_links: 会議/書類を運用チェーンへ結ぶ
--    最小限の型付き関連メタデータ。
--
--    既存の正本チェーンで直接FKが既にある組は複製しない:
--      issue <-> milestone   : 既存 project_management_milestone_issue_links
--      decision -> issue     : 既存 project_management_decisions.issue_id (nullable)
--      action_item -> decision: 既存 project_management_action_items.decision_id (NOT NULL)
--      task -> milestone     : 既存 project_management_tasks.milestone_id (本migrationで
--                               nullable化、§7参照)
--    本テーブルが埋める空白は、会議(meeting)・書類(document)・予定成果物(deliverable)を
--    課題/タスク/決定/マイルストーンへ結ぶ経路 (これらは既存正本にFK列を持たない)。
--
--    ポリモーフィックな関連 (from_kind/to_kind で参照先テーブルが変わる) のため、
--    単一の複合FKでは表現できない。エンドポイントの実在・同一project_id・
--    非アーカイブ状態は BEFORE trigger で検証する (これがtrigger-onlyでの検証が
--    避けられない唯一の箇所であることを明記する)。
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.project_theme_work_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL,
  track_key text NOT NULL,
  from_kind text NOT NULL CHECK (from_kind IN ('meeting', 'document', 'issue', 'task', 'milestone', 'decision', 'deliverable')),
  from_id text NOT NULL,
  to_kind text NOT NULL CHECK (to_kind IN ('meeting', 'document', 'issue', 'task', 'milestone', 'decision', 'deliverable')),
  to_id text NOT NULL,
  relation text NOT NULL DEFAULT 'relates_to' CHECK (relation IN ('relates_to', 'discussed_in', 'produced', 'resolved_by')),
  client_token uuid,
  created_by_member_id text REFERENCES public.members(member_id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by text,
  version int4 NOT NULL DEFAULT 1,
  CHECK (NOT (from_kind = to_kind AND from_id = to_id)),
  UNIQUE (project_id, from_kind, from_id, to_kind, to_id, relation),
  FOREIGN KEY (project_id, track_key)
    REFERENCES public.project_management_tracks (project_id, track_key)
    ON UPDATE CASCADE ON DELETE CASCADE
);

COMMENT ON TABLE public.project_theme_work_links IS
  'テーマ内の作業チェーン(会議→課題→書類/作業→決定→マイルストーン)のうち、既存正本テーブルに直接FKが無い組(会議/書類/予定成果物が絡む関連)だけを保持する。既にFKで表現済みの組(issue<->milestone, decision->issue, action_item->decision, task->milestone)はここへ複製しない。';

CREATE UNIQUE INDEX IF NOT EXISTS project_theme_work_links_client_token_uq
  ON public.project_theme_work_links (project_id, track_key, client_token)
  WHERE client_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS project_theme_work_links_from_idx
  ON public.project_theme_work_links (project_id, from_kind, from_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS project_theme_work_links_to_idx
  ON public.project_theme_work_links (project_id, to_kind, to_id) WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.project_theme_work_link_endpoint_project(p_kind text, p_id text)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  v_project text;
BEGIN
  CASE p_kind
    WHEN 'meeting' THEN
      SELECT project_id INTO v_project FROM public.project_meeting_summaries WHERE meeting_id = p_id;
    WHEN 'document' THEN
      SELECT project_id INTO v_project FROM public.workspace_documents
        WHERE document_id = p_id::uuid AND upload_status = 'active';
    WHEN 'issue' THEN
      SELECT project_id INTO v_project FROM public.project_management_issues
        WHERE id = p_id::uuid AND deleted_at IS NULL;
    WHEN 'task' THEN
      SELECT project_id INTO v_project FROM public.project_management_tasks
        WHERE id = p_id::uuid AND deleted_at IS NULL;
    WHEN 'milestone' THEN
      SELECT project_id INTO v_project FROM public.project_management_milestones
        WHERE id = p_id::uuid AND deleted_at IS NULL;
    WHEN 'decision' THEN
      SELECT project_id INTO v_project FROM public.project_management_decisions
        WHERE id = p_id::uuid AND deleted_at IS NULL;
    WHEN 'deliverable' THEN
      SELECT project_id INTO v_project FROM public.project_theme_deliverables
        WHERE id = p_id::uuid AND deleted_at IS NULL;
    ELSE
      RAISE EXCEPTION 'unsupported link endpoint kind %', p_kind USING ERRCODE = '23514';
  END CASE;
  RETURN v_project;
EXCEPTION
  WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'invalid id % for endpoint kind %', p_id, p_kind USING ERRCODE = '22P02';
END $$;

CREATE OR REPLACE FUNCTION public.project_theme_work_links_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  from_project text;
  to_project text;
BEGIN
  -- [final-fixes #1] soft-deleting a link (or re-saving one already soft-deleted,
  -- without retargeting either endpoint) must not require both endpoints to still
  -- be active, otherwise a stale association (e.g. its task got archived) can
  -- never be unlinked. Restoring (deleted_at -> NULL) and any endpoint change
  -- still go through the full endpoint check below.
  IF TG_OP = 'UPDATE' AND NEW.deleted_at IS NOT NULL
     AND NEW.project_id = OLD.project_id
     AND NEW.from_kind = OLD.from_kind AND NEW.from_id = OLD.from_id
     AND NEW.to_kind = OLD.to_kind AND NEW.to_id = OLD.to_id THEN
    RETURN NEW;
  END IF;

  from_project := public.project_theme_work_link_endpoint_project(NEW.from_kind, NEW.from_id);
  to_project := public.project_theme_work_link_endpoint_project(NEW.to_kind, NEW.to_id);

  IF from_project IS NULL THEN
    RAISE EXCEPTION '% % not found or inactive', NEW.from_kind, NEW.from_id USING ERRCODE = '23503';
  END IF;
  IF to_project IS NULL THEN
    RAISE EXCEPTION '% % not found or inactive', NEW.to_kind, NEW.to_id USING ERRCODE = '23503';
  END IF;
  IF from_project <> NEW.project_id OR to_project <> NEW.project_id THEN
    RAISE EXCEPTION 'link endpoints must stay inside project %', NEW.project_id USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS project_theme_work_links_guard ON public.project_theme_work_links;
CREATE TRIGGER project_theme_work_links_guard
BEFORE INSERT OR UPDATE ON public.project_theme_work_links
FOR EACH ROW EXECUTE FUNCTION public.project_theme_work_links_guard();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_theme_work_links TO authenticated, service_role;
ALTER TABLE public.project_theme_work_links ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS project_theme_work_links_touch_updated_at ON public.project_theme_work_links;
CREATE TRIGGER project_theme_work_links_touch_updated_at
BEFORE UPDATE ON public.project_theme_work_links
FOR EACH ROW EXECUTE FUNCTION public.project_management_touch_updated_at();

DROP TRIGGER IF EXISTS project_theme_work_links_block_delete ON public.project_theme_work_links;
CREATE TRIGGER project_theme_work_links_block_delete
BEFORE DELETE ON public.project_theme_work_links
FOR EACH ROW EXECUTE FUNCTION public.project_management_block_authenticated_delete();

DROP POLICY IF EXISTS project_theme_work_links_member_select ON public.project_theme_work_links;
CREATE POLICY project_theme_work_links_member_select
ON public.project_theme_work_links FOR SELECT TO authenticated
USING (public.amd_os_can_access_project(project_id) AND deleted_at IS NULL);

DROP POLICY IF EXISTS project_theme_work_links_manager_insert ON public.project_theme_work_links;
CREATE POLICY project_theme_work_links_manager_insert
ON public.project_theme_work_links FOR INSERT TO authenticated
WITH CHECK (public.amd_os_can_manage_project_shared_data(project_id));

DROP POLICY IF EXISTS project_theme_work_links_manager_update ON public.project_theme_work_links;
CREATE POLICY project_theme_work_links_manager_update
ON public.project_theme_work_links FOR UPDATE TO authenticated
USING (public.amd_os_can_manage_project_shared_data(project_id))
WITH CHECK (public.amd_os_can_manage_project_shared_data(project_id));

DROP POLICY IF EXISTS project_theme_work_links_service_all ON public.project_theme_work_links;
CREATE POLICY project_theme_work_links_service_all
ON public.project_theme_work_links FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- =====================================================================
-- 7. [R2] project_management_tasks: 運用マイルストーン無しでも
--    タスクを作成できるよう milestone_id を additive に nullable化する。
--    ダミーの親マイルストーンを捏造せず、project_theme_deliverablesを
--    タスクの並行真実にもしない。milestone_id が NULL の場合は
--    track (= テーマ) が必須であることをCHECKで強制する
--    (trackは既にmigration 273で (project_id, track) 複合FKにより
--    project_management_tracksを参照しているため、「有効なテーマに
--    紐づく」という要件を追加テーブル無しで満たせる)。
--
--    既存consumer側でmilestone_id前提の集計/表示がある場合は
--    Phase2でNULL許容へ対応する必要がある (phase1.md §5の既知の懸念)。
-- =====================================================================

ALTER TABLE public.project_management_tasks
  ALTER COLUMN milestone_id DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'project_management_tasks_standalone_needs_track'
      AND conrelid = 'public.project_management_tasks'::regclass
  ) THEN
    ALTER TABLE public.project_management_tasks
      ADD CONSTRAINT project_management_tasks_standalone_needs_track
      CHECK (milestone_id IS NOT NULL OR track IS NOT NULL);
  END IF;
END $$;

ALTER TABLE public.project_management_tasks
  ADD COLUMN IF NOT EXISTS client_token uuid;

CREATE UNIQUE INDEX IF NOT EXISTS project_management_tasks_client_token_uq
  ON public.project_management_tasks (project_id, client_token)
  WHERE client_token IS NOT NULL;

COMMENT ON COLUMN public.project_management_tasks.milestone_id IS
  'マイルストーン配下のタスクの場合に設定。テーマ単位の未着手タスク(milestone未確定)はNULLを許容し、その場合はtrackが必須 (project_management_tasks_standalone_needs_track)。';

CREATE OR REPLACE FUNCTION public.project_management_task_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  milestone_project text;
  parent_project text;
  parent_milestone uuid;
  parent_track text;
  parent_deleted timestamptz;
  creates_cycle boolean;
BEGIN
  IF NEW.milestone_id IS NOT NULL THEN
    SELECT project_id INTO milestone_project
    FROM public.project_management_milestones
    WHERE id = NEW.milestone_id AND deleted_at IS NULL;
    IF milestone_project IS NULL OR milestone_project <> NEW.project_id THEN
      RAISE EXCEPTION 'task milestone must stay inside the project' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.parent_task_id IS NOT NULL THEN
    SELECT project_id, milestone_id, track, deleted_at
      INTO parent_project, parent_milestone, parent_track, parent_deleted
    FROM public.project_management_tasks
    WHERE id = NEW.parent_task_id;
    IF parent_project IS NULL OR parent_deleted IS NOT NULL
       OR parent_project <> NEW.project_id
       OR parent_milestone IS DISTINCT FROM NEW.milestone_id
       OR (NEW.milestone_id IS NULL AND parent_track IS DISTINCT FROM NEW.track) THEN
      RAISE EXCEPTION 'parent task must be active and in the same project, milestone and theme' USING ERRCODE = '23514';
    END IF;
    IF NEW.parent_task_id = NEW.id THEN
      RAISE EXCEPTION 'task cannot be its own parent' USING ERRCODE = '23514';
    END IF;
    WITH RECURSIVE ancestors(id, parent_task_id) AS (
      SELECT t.id, t.parent_task_id
      FROM public.project_management_tasks t
      WHERE t.id = NEW.parent_task_id
      UNION ALL
      SELECT t.id, t.parent_task_id
      FROM public.project_management_tasks t
      JOIN ancestors a ON t.id = a.parent_task_id
      WHERE t.project_id = NEW.project_id
    )
    SELECT EXISTS (SELECT 1 FROM ancestors WHERE id = NEW.id) INTO creates_cycle;
    IF creates_cycle THEN
      RAISE EXCEPTION 'task hierarchy would create a cycle' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- [final-fixes #5] track is now part of the parent-match check for standalone
-- (milestone-less) tasks, so it must also be in the trigger's UPDATE OF list;
-- otherwise a bare `UPDATE ... SET track = ...` would silently skip re-validation.
DROP TRIGGER IF EXISTS project_management_tasks_guard ON public.project_management_tasks;
CREATE TRIGGER project_management_tasks_guard
BEFORE INSERT OR UPDATE OF project_id, milestone_id, parent_task_id, track
ON public.project_management_tasks
FOR EACH ROW EXECUTE FUNCTION public.project_management_task_guard();

-- =====================================================================
-- 8. [R4] 新規MTG作成+テーマ紐付けの原子的操作。
--    project_meeting_summaries(新規行) と project_theme_meetings(リンク行) の
--    2テーブルにまたがる唯一の「新規作成を伴う」書き込みのため、
--    1つのplpgsql関数内で両方のINSERTを行い、単一トランザクションとして
--    atomicにする (関数内で例外が出れば呼び出し全体がROLLBACKする)。
--
--    冪等性: p_client_token を渡すと、まずproject_theme_meetingsを
--    (project_id, track_key, client_token) で検索し、既にリンク済みなら
--    新規作成をスキップして既存meeting_idをそのまま返す。ネットワーク
--    タイムアウト後のクライアント再送でも、会議行・リンク行のどちらも
--    重複作成されない。
--
--    server-onlyを関数GRANTレベルでも強制する (service_roleのみ実行可)。
--    他の書き込み経路 (既存MTGを既存テーマへ単純リンク/予定成果物新規作成/
--    タスク新規作成/project_theme_work_links新規作成) は、いずれも単一
--    テーブルへの ON CONFLICT (client_tokenまたは自然な複合UNIQUE) DO NOTHING
--    insertで retry-safe にできるため、専用関数を追加しない
--    (phase1.md §4に一覧を明記)。
-- =====================================================================

CREATE OR REPLACE FUNCTION public.theme_hub_create_meeting_and_link(
  p_project_id text,
  p_track_key text,
  p_title text,
  p_meeting_date date,
  p_summary_short text,
  p_client_token uuid,
  p_created_by_member_id text
) RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_existing_meeting_id text;
  v_meeting_id text;
BEGIN
  -- [final-fixes #6] client_token is mandatory: an optional token made the retry
  -- guarantee true only for callers that happened to pass one. Every caller must
  -- now supply an idempotency key.
  IF p_client_token IS NULL THEN
    RAISE EXCEPTION 'p_client_token is required' USING ERRCODE = '22004';
  END IF;

  SELECT meeting_id INTO v_existing_meeting_id
  FROM public.project_theme_meetings
  WHERE project_id = p_project_id AND track_key = p_track_key AND client_token = p_client_token;
  IF v_existing_meeting_id IS NOT NULL THEN
    RETURN v_existing_meeting_id;
  END IF;

  v_meeting_id := gen_random_uuid()::text;

  INSERT INTO public.project_meeting_summaries (
    meeting_id, project_id, ym, meeting_date, title, summary_short, generated_by_model
  ) VALUES (
    v_meeting_id, p_project_id, to_char(p_meeting_date, 'YYYY-MM'), p_meeting_date, p_title,
    COALESCE(p_summary_short, ''), 'theme_hub_manual'
  );

  INSERT INTO public.project_theme_meetings (
    project_id, track_key, meeting_id, client_token, created_by_member_id
  ) VALUES (
    p_project_id, p_track_key, v_meeting_id, p_client_token, p_created_by_member_id
  );

  RETURN v_meeting_id;
END;
$$;

REVOKE ALL ON FUNCTION public.theme_hub_create_meeting_and_link(text, text, text, date, text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.theme_hub_create_meeting_and_link(text, text, text, date, text, uuid, text) TO service_role;

-- =====================================================================
-- 9. 事後assert (本migration全体の自己検証)
-- =====================================================================

DO $$
BEGIN
  IF to_regclass('public.project_theme_profiles') IS NULL THEN
    RAISE EXCEPTION 'project_theme_profiles was not created';
  END IF;
  IF to_regclass('public.project_theme_meetings') IS NULL THEN
    RAISE EXCEPTION 'project_theme_meetings was not created';
  END IF;
  IF to_regclass('public.project_theme_documents') IS NULL THEN
    RAISE EXCEPTION 'project_theme_documents was not created';
  END IF;
  IF to_regclass('public.project_theme_deliverables') IS NULL THEN
    RAISE EXCEPTION 'project_theme_deliverables was not created';
  END IF;
  IF to_regclass('public.project_theme_work_links') IS NULL THEN
    RAISE EXCEPTION 'project_theme_work_links was not created';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'project_management_tasks'
      AND column_name = 'milestone_id' AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION 'project_management_tasks.milestone_id is still NOT NULL';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'project_meeting_summaries_project_meeting_uq'
  ) THEN
    RAISE EXCEPTION 'project_meeting_summaries_project_meeting_uq missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'workspace_documents_project_document_uq'
  ) THEN
    RAISE EXCEPTION 'workspace_documents_project_document_uq missing';
  END IF;
END $$;

COMMIT;
