-- 455_dd_packages.sql
--
-- 目的:
--   投資家・金融機関向けのDDパッケージを、コックピット・ワークスペースと独立した第3の領域として追加する。
--   設計: pwa/spec/5-17-dd-package-current-spec.md（2026-09-30 まさ依頼「SOLのDDパッケージ」）。
--
-- 不変条件:
--   - DDへ入れる根拠は dd_package_grants の行だけ。project_access_memberships / institution_workspace_memberships を
--     参照も作成もしない。DDの付与はワークスペースへ入る根拠にならず、その逆もない。
--   - 入れる領域（どのパッケージか）と、できる操作（capabilities: dd.view / dd.download）を別の列で持つ。
--   - 外部へ出る中身は dd_item_publications（追記のみ・更新も削除もできない）だけ。元データを直接読ませない。
--   - dd_package_items.published_publication_id が外部に見せる版。NULL なら非公開。新しい項目は NULL で作る。
--   - 公開版は dd_publish_item() だけが作る。版番号・content hash を DB が決め、元データの参照（source_refs）を必ず持つ。
--   - 添付ファイルの公開版は private Storage 'dd-publication-files' に公開時点の実体を複製する。元資料の上書きは流れない。
--   - 全テーブル RLS 有効。anon / 一般 authenticated の直接権限なし。admin は SELECT だけ。書込みは service_role のサーバ経路。
--   - パッケージ・付与・項目・公開版の行変更は、同じ transaction で workspace_access_audit_logs へ記録する（258 の trigger 関数を再利用）。
--   - 物理削除はしない（trigger で拒否）。止めるときは status を変える。
--
-- SOL（p21）の初期データ:
--   パッケージ1件を status='draft'（管理者だけが確認できる未公開）で作る。付与は作らない（投資家への招待は今回しない）。
--   掲載項目の選択と公開はまさが管理画面で行う。
--
-- 冪等性: CREATE ... IF NOT EXISTS、policy / trigger は DROP + CREATE。SOLのパッケージは ON CONFLICT DO NOTHING。

BEGIN;

SELECT set_config('app.workspace_migration', '455', true);

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('dd-publication-files', 'dd-publication-files', FALSE, 104857600)
ON CONFLICT (id) DO UPDATE
SET public = FALSE,
    file_size_limit = EXCLUDED.file_size_limit;

-- ---------------------------------------------------------------------
-- 1. パッケージ
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.dd_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL REFERENCES public.projects(project_id) ON DELETE RESTRICT,
  slug TEXT NOT NULL,
  title TEXT NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 200),
  notice_text TEXT CHECK (notice_text IS NULL OR char_length(notice_text) <= 2000),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'closed')),
  created_by_member_id TEXT REFERENCES public.members(member_id) ON DELETE RESTRICT,
  updated_by_member_id TEXT REFERENCES public.members(member_id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT dd_packages_slug_format
    CHECK (slug = lower(slug) AND slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(slug) <= 64),
  UNIQUE (slug),
  UNIQUE (id, project_id)
);

COMMENT ON TABLE public.dd_packages IS
  'DDパッケージ（投資家・金融機関向けの開示面）。status: draft=管理者だけが確認できる未公開 / open=付与された人だけが閲覧できる / closed=誰も閲覧できない。';

-- ---------------------------------------------------------------------
-- 2. 閲覧権限（入れる領域 = パッケージ、できる操作 = capabilities）
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.dd_package_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL,
  project_id TEXT NOT NULL,
  user_account_id UUID NOT NULL REFERENCES public.workspace_user_accounts(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'invited'
    CHECK (status IN ('invited', 'active', 'suspended', 'revoked')),
  capabilities TEXT[] NOT NULL DEFAULT ARRAY['dd.view']::TEXT[],
  organization_name TEXT CHECK (organization_name IS NULL OR char_length(organization_name) <= 200),
  note TEXT CHECK (note IS NULL OR char_length(note) <= 1000),
  expires_at TIMESTAMPTZ,
  granted_by_member_id TEXT REFERENCES public.members(member_id) ON DELETE RESTRICT,
  updated_by_member_id TEXT REFERENCES public.members(member_id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT dd_package_grants_capabilities_known
    CHECK (capabilities <@ ARRAY['dd.view', 'dd.download']::TEXT[] AND 'dd.view' = ANY (capabilities)),
  UNIQUE (package_id, user_account_id),
  FOREIGN KEY (package_id, project_id)
    REFERENCES public.dd_packages(id, project_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS dd_package_grants_account_idx
  ON public.dd_package_grants(user_account_id);

COMMENT ON TABLE public.dd_package_grants IS
  'DD閲覧権限。外部アカウント × パッケージ。ワークスペースの所属とは独立で、ワークスペースへ入る根拠にならない。停止済み（suspended / revoked）の行は作成では復活せず、明示的な更新だけで戻る。';
COMMENT ON COLUMN public.dd_package_grants.capabilities IS
  'できる操作。dd.view=閲覧（必須） / dd.download=添付資料のダウンロード。';

-- ---------------------------------------------------------------------
-- 3. 掲載項目（内部の選択。外部へは公開版だけが出る）
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.dd_package_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL,
  project_id TEXT NOT NULL,
  section_key TEXT NOT NULL CHECK (section_key IN (
    'business', 'technology', 'market', 'economics', 'capital', 'ip_contracts_team', 'evidence'
  )),
  item_kind TEXT NOT NULL CHECK (item_kind IN (
    'document', 'tech_topic', 'funding_plan', 'capital_policy', 'cost_model'
  )),
  source_key TEXT NOT NULL CHECK (char_length(source_key) BETWEEN 3 AND 300),
  source_options JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(source_options) = 'object'),
  title TEXT NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 200),
  summary TEXT CHECK (summary IS NULL OR char_length(summary) <= 1000),
  unverified_notes JSONB NOT NULL DEFAULT '[]'::JSONB CHECK (jsonb_typeof(unverified_notes) = 'array'),
  evidence_item_ids UUID[] NOT NULL DEFAULT '{}'::UUID[],
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  published_publication_id UUID,
  created_by_member_id TEXT REFERENCES public.members(member_id) ON DELETE RESTRICT,
  updated_by_member_id TEXT REFERENCES public.members(member_id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (package_id, item_kind, source_key),
  UNIQUE (id, package_id),
  FOREIGN KEY (package_id, project_id)
    REFERENCES public.dd_packages(id, project_id) ON DELETE RESTRICT,
  CONSTRAINT dd_package_items_archived_unpublished
    CHECK (status = 'active' OR published_publication_id IS NULL)
);

CREATE INDEX IF NOT EXISTS dd_package_items_package_idx
  ON public.dd_package_items(package_id, section_key, sort_order);

COMMENT ON TABLE public.dd_package_items IS
  'DDに載せる候補の選択（内部）。外部に見えるのは published_publication_id が指す公開版だけ。新しい項目は NULL（非公開）で作る。';
COMMENT ON COLUMN public.dd_package_items.source_options IS
  '公開版の作り方の選択（例: 資本政策のどのラウンドまで載せるか）。公開時に payload へ反映され、版の content hash に入る。';

-- ---------------------------------------------------------------------
-- 4. 公開版（追記のみ）
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.dd_item_publications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL,
  package_id UUID NOT NULL,
  project_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  item_kind TEXT NOT NULL,
  section_key TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  payload JSONB NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  source_refs JSONB NOT NULL CHECK (jsonb_typeof(source_refs) = 'array' AND jsonb_array_length(source_refs) > 0),
  source_as_of TIMESTAMPTZ,
  unverified_notes JSONB NOT NULL DEFAULT '[]'::JSONB CHECK (jsonb_typeof(unverified_notes) = 'array'),
  evidence_item_ids UUID[] NOT NULL DEFAULT '{}'::UUID[],
  file_storage_path TEXT,
  file_name TEXT,
  file_mime_type TEXT,
  file_size_bytes BIGINT,
  file_sha256 TEXT,
  content_hash TEXT NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  note TEXT CHECK (note IS NULL OR char_length(note) <= 1000),
  published_by_member_id TEXT NOT NULL REFERENCES public.members(member_id) ON DELETE RESTRICT,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (item_id, revision),
  UNIQUE (id, item_id),
  FOREIGN KEY (item_id, package_id)
    REFERENCES public.dd_package_items(id, package_id) ON DELETE RESTRICT,
  CONSTRAINT dd_item_publications_file_complete CHECK (
    (file_storage_path IS NULL AND file_name IS NULL AND file_mime_type IS NULL
      AND file_size_bytes IS NULL AND file_sha256 IS NULL)
    OR (file_storage_path IS NOT NULL AND file_name IS NOT NULL AND file_mime_type IS NOT NULL
      AND file_size_bytes >= 0 AND file_sha256 ~ '^[0-9a-f]{64}$')
  )
);

COMMENT ON TABLE public.dd_item_publications IS
  'DD項目の公開版。追記のみで、更新・削除は trigger で拒否する。payload は許可した項目だけを持つ表示用データ、source_refs は元データの表・ID・版・時点。';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'dd_package_items_published_publication_fkey'
  ) THEN
    ALTER TABLE public.dd_package_items
      ADD CONSTRAINT dd_package_items_published_publication_fkey
      FOREIGN KEY (published_publication_id, id)
      REFERENCES public.dd_item_publications(id, item_id) ON DELETE RESTRICT;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------
-- 5. trigger: updated_at、追記のみ、物理削除の拒否、同一 transaction の監査
-- ---------------------------------------------------------------------

DO $$
DECLARE v_table TEXT;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['dd_packages', 'dd_package_grants', 'dd_package_items'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS workspace_touch_updated_at ON public.%I', v_table);
    EXECUTE format('CREATE TRIGGER workspace_touch_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.workspace_touch_updated_at()', v_table);
  END LOOP;

  EXECUTE 'DROP TRIGGER IF EXISTS workspace_reject_update ON public.dd_item_publications';
  EXECUTE 'CREATE TRIGGER workspace_reject_update BEFORE UPDATE ON public.dd_item_publications FOR EACH ROW EXECUTE FUNCTION public.workspace_reject_mutation()';

  FOREACH v_table IN ARRAY ARRAY['dd_packages', 'dd_package_grants', 'dd_package_items', 'dd_item_publications'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS workspace_reject_hard_delete ON public.%I', v_table);
    EXECUTE format('CREATE TRIGGER workspace_reject_hard_delete BEFORE DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.workspace_reject_mutation()', v_table);
    EXECUTE format('DROP TRIGGER IF EXISTS workspace_security_row_audit ON public.%I', v_table);
    EXECUTE format('CREATE TRIGGER workspace_security_row_audit AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.workspace_record_security_row_mutation()', v_table);
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------
-- 6. 公開する（版番号と content hash は DB が決める）
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.dd_publish_item(
  p_item_id UUID,
  p_actor_member_id TEXT,
  p_payload JSONB,
  p_source_refs JSONB,
  p_source_as_of TIMESTAMPTZ,
  p_unverified_notes JSONB,
  p_file JSONB DEFAULT NULL,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_item public.dd_package_items%ROWTYPE;
  v_current public.dd_item_publications%ROWTYPE;
  v_revision INTEGER;
  v_hash TEXT;
  v_publication_id UUID;
  v_evidence UUID[];
BEGIN
  IF p_item_id IS NULL OR NULLIF(btrim(p_actor_member_id), '') IS NULL
     OR p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object'
     OR p_source_refs IS NULL OR jsonb_typeof(p_source_refs) <> 'array'
     OR jsonb_array_length(p_source_refs) = 0
     OR p_unverified_notes IS NULL OR jsonb_typeof(p_unverified_notes) <> 'array'
     OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_unverified_notes) note WHERE jsonb_typeof(note) <> 'string')
     OR (p_file IS NOT NULL AND jsonb_typeof(p_file) <> 'object') THEN
    RAISE EXCEPTION 'dd publish request is incomplete';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.member_id = p_actor_member_id AND m.status = 'active' AND m.is_admin = TRUE
  ) THEN
    RAISE EXCEPTION 'active AMD admin actor is required';
  END IF;

  SELECT * INTO v_item FROM public.dd_package_items WHERE id = p_item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'dd item not found'; END IF;
  IF v_item.status <> 'active' THEN RAISE EXCEPTION 'dd item is archived'; END IF;

  -- 根拠資料は、同じパッケージの有効な資料項目だけを残す（別パッケージや自分自身は指せない）。
  SELECT COALESCE(array_agg(e.id ORDER BY e.ord), '{}'::UUID[]) INTO v_evidence
  FROM (
    SELECT DISTINCT ON (i.id) i.id, u.ord
    FROM unnest(v_item.evidence_item_ids) WITH ORDINALITY AS u(item_id, ord)
    JOIN public.dd_package_items i
      ON i.id = u.item_id AND i.package_id = v_item.package_id
     AND i.item_kind = 'document' AND i.status = 'active' AND i.id <> v_item.id
    ORDER BY i.id, u.ord
  ) e;

  v_hash := encode(digest(jsonb_build_object(
    'itemKind', v_item.item_kind,
    'sectionKey', v_item.section_key,
    'title', v_item.title,
    'summary', v_item.summary,
    'payload', p_payload,
    'unverifiedNotes', p_unverified_notes,
    'evidenceItemIds', to_jsonb(v_evidence),
    'fileSha256', p_file ->> 'sha256'
  )::TEXT, 'sha256'), 'hex');

  IF v_item.published_publication_id IS NOT NULL THEN
    SELECT * INTO v_current FROM public.dd_item_publications WHERE id = v_item.published_publication_id;
    IF FOUND AND v_current.content_hash = v_hash THEN
      RETURN jsonb_build_object(
        'publicationId', v_current.id, 'revision', v_current.revision,
        'unchanged', TRUE, 'contentHash', v_current.content_hash
      );
    END IF;
  END IF;

  SELECT COALESCE(max(revision), 0) + 1 INTO v_revision
  FROM public.dd_item_publications WHERE item_id = v_item.id;

  INSERT INTO public.dd_item_publications (
    item_id, package_id, project_id, revision, item_kind, section_key, title, summary,
    payload, source_refs, source_as_of, unverified_notes, evidence_item_ids,
    file_storage_path, file_name, file_mime_type, file_size_bytes, file_sha256,
    content_hash, note, published_by_member_id
  ) VALUES (
    v_item.id, v_item.package_id, v_item.project_id, v_revision, v_item.item_kind,
    v_item.section_key, v_item.title, v_item.summary,
    p_payload, p_source_refs, p_source_as_of, p_unverified_notes, v_evidence,
    p_file ->> 'storagePath', p_file ->> 'name', p_file ->> 'mimeType',
    NULLIF(p_file ->> 'sizeBytes', '')::BIGINT, p_file ->> 'sha256',
    v_hash, NULLIF(btrim(p_note), ''), p_actor_member_id
  ) RETURNING id INTO v_publication_id;

  UPDATE public.dd_package_items
     SET published_publication_id = v_publication_id,
         updated_by_member_id = p_actor_member_id
   WHERE id = v_item.id;

  RETURN jsonb_build_object(
    'publicationId', v_publication_id, 'revision', v_revision,
    'unchanged', FALSE, 'contentHash', v_hash
  );
END;
$$;

COMMENT ON FUNCTION public.dd_publish_item(UUID, TEXT, JSONB, JSONB, TIMESTAMPTZ, JSONB, JSONB, TEXT) IS
  'DD項目の公開版を1件作り、外部に見せる版をそれへ切り替える。版番号と content hash は DB が決める。未確認事項は管理者の記入分と元データから自動で拾った分を合わせたものを受け取る。内容が現在の公開版と同じなら新しい版を作らない。service_role だけが呼ぶ。';

-- ---------------------------------------------------------------------
-- 7. 権限: RLS 有効、anon / 一般 authenticated の直接権限なし、admin は SELECT だけ
-- ---------------------------------------------------------------------

DO $$
DECLARE v_table TEXT;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['dd_packages', 'dd_package_grants', 'dd_package_items', 'dd_item_publications'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', v_table);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_table || '_admin_select', v_table);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.is_admin())',
      v_table || '_admin_select', v_table
    );
    EXECUTE format('GRANT SELECT ON TABLE public.%I TO authenticated', v_table);
  END LOOP;
END;
$$;

-- 公開版は dd_publish_item() だけが作る。service_role からも直接の INSERT はさせない。
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.dd_item_publications FROM service_role;
GRANT SELECT ON TABLE public.dd_item_publications TO service_role;

REVOKE ALL ON FUNCTION public.dd_publish_item(UUID, TEXT, JSONB, JSONB, TIMESTAMPTZ, JSONB, JSONB, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dd_publish_item(UUID, TEXT, JSONB, JSONB, TIMESTAMPTZ, JSONB, JSONB, TEXT)
  TO service_role;

-- ---------------------------------------------------------------------
-- 8. SOL（p21）のパッケージ。未公開（draft）で作り、付与は作らない
-- ---------------------------------------------------------------------

INSERT INTO public.dd_packages (project_id, slug, title, notice_text, status)
VALUES (
  'p21',
  'sol',
  'SolvioraX DD資料',
  '投資判断のための検討資料。各項目は公開日時点で確認した内容で、公開版・元データの基準日・未確認事項を項目ごとに示す。',
  'draft'
)
ON CONFLICT (slug) DO NOTHING;

DO $$
DECLARE
  v_status TEXT;
  v_grants INTEGER;
BEGIN
  SELECT status INTO v_status FROM public.dd_packages WHERE slug = 'sol' AND project_id = 'p21';
  IF v_status IS NULL THEN RAISE EXCEPTION 'SOL DD package was not created'; END IF;
  SELECT count(*) INTO v_grants FROM public.dd_package_grants;
  IF v_grants <> 0 THEN RAISE EXCEPTION 'dd grants must not be created by this migration (found %)', v_grants; END IF;
END;
$$;

-- OS全体のデータ変更履歴（amd_os_data_change_history）へ新しい4テーブルを入れる（新テーブル追加時の決まり）。
SELECT public.amd_os_refresh_data_change_history_triggers();

NOTIFY pgrst, 'reload schema';

COMMIT;
