-- 223_monthly_report_edit_history.sql
-- 月次報告書 (社内版 monthly_reports / 提出版 monthly_reports_external) の
-- 完全な編集履歴。誰が (member / automation / system / legacy) いつ何を
-- (generate / draft_save / confirm / external_save) 変更したかと、変更前後の
-- 本文全文を残す。書き込み経路は2系統:
--   1. RPC (monthly_report_internal_save / monthly_report_external_save):
--      本文更新 + 履歴INSERTを1トランザクションにまとめる正規経路。PWAの
--      手動保存はすべてここを通る。
--   2. AFTER トリガー (monthly_report_history_capture_*):
--      RPCを経由しない直接UPDATE/INSERT (将来のroutine / GAS / script) も
--      取りこぼさない安全網。RPC実行中はtransaction-local設定
--      app.mrh_bypass_triggerでトリガー側の二重挿入を止める。
-- 過去の手動編集差分は復元不能なため、既存行は「詳細差分なしlegacy」として
-- 安全にseedする (content_before/after=NULL, detail_available=false)。

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. monthly_report_edit_history 本体
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.monthly_report_edit_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL REFERENCES public.projects(project_id) ON DELETE CASCADE,
  ym text NOT NULL CHECK (ym ~ '^[0-9]{6}$'),
  report_kind text NOT NULL CHECK (report_kind IN ('internal', 'external')),
  action text NOT NULL CHECK (action IN ('generate', 'draft_save', 'confirm', 'external_save', 'legacy_seed')),
  actor_kind text NOT NULL CHECK (actor_kind IN ('member', 'automation', 'system', 'legacy')),
  actor_member_id text REFERENCES public.members(member_id) ON DELETE SET NULL,
  actor_label text,
  content_before text,
  content_after text,
  changed_sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  detail_available boolean NOT NULL DEFAULT true,
  source text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.monthly_report_edit_history IS
  '月次報告書 (社内版/提出版) の完全編集履歴。本文保存と同一トランザクションで追記する校正台帳。append-only (UPDATE/DELETE禁止)。';
COMMENT ON COLUMN public.monthly_report_edit_history.report_kind IS 'internal = monthly_reports (社内版) / external = monthly_reports_external (提出版)。';
COMMENT ON COLUMN public.monthly_report_edit_history.action IS 'generate=自動生成 / draft_save=下書き保存 / confirm=確定版反映 / external_save=提出版保存 / legacy_seed=このmigrationでの過去行seed。';
COMMENT ON COLUMN public.monthly_report_edit_history.actor_kind IS 'member=人間 (members解決済み) / automation=routine・cron / system=アプリ内部処理 / legacy=このmigration seed時点で人物解決できなかった過去記録。';
COMMENT ON COLUMN public.monthly_report_edit_history.actor_member_id IS 'actor_kind=member のときの members.member_id。';
COMMENT ON COLUMN public.monthly_report_edit_history.actor_label IS 'actor_kind=member 以外の表示名 (例: "AMD OS (自動生成)")。memberでも解決失敗時のfallback表示に使う。';
COMMENT ON COLUMN public.monthly_report_edit_history.content_before IS '変更前の本文全文。初回生成やlegacy seedはNULL。';
COMMENT ON COLUMN public.monthly_report_edit_history.content_after IS '変更後の本文全文。';
COMMENT ON COLUMN public.monthly_report_edit_history.changed_sections IS '変更された章見出し (H1/H2) の配列。一覧の軽量表示に使う。legacy seedは空配列。';
COMMENT ON COLUMN public.monthly_report_edit_history.detail_available IS 'false = content_before/afterが無い (legacy seed)。UIは「詳細差分なし」を出す。';
COMMENT ON COLUMN public.monthly_report_edit_history.source IS '書き込み元識別子 (例: pwa:manual-update / pwa:report-fix / direct:monthly_reports / legacy:monthly_reports)。';

CREATE INDEX IF NOT EXISTS idx_monthly_report_edit_history_lookup
  ON public.monthly_report_edit_history (project_id, ym, report_kind, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'monthly_report_edit_history_changed_sections_array_check'
      AND conrelid = 'public.monthly_report_edit_history'::regclass
  ) THEN
    ALTER TABLE public.monthly_report_edit_history
      ADD CONSTRAINT monthly_report_edit_history_changed_sections_array_check
      CHECK (jsonb_typeof(changed_sections) = 'array');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.monthly_report_edit_history_reject_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'monthly_report_edit_history is append-only';
END;
$$;

DROP TRIGGER IF EXISTS monthly_report_edit_history_append_only ON public.monthly_report_edit_history;
CREATE TRIGGER monthly_report_edit_history_append_only
  BEFORE UPDATE OR DELETE ON public.monthly_report_edit_history
  FOR EACH ROW EXECUTE FUNCTION public.monthly_report_edit_history_reject_mutation();

ALTER TABLE public.monthly_report_edit_history ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'monthly_report_edit_history' AND policyname = 'monthly_report_edit_history_admin_select') THEN
    CREATE POLICY monthly_report_edit_history_admin_select
      ON public.monthly_report_edit_history
      FOR SELECT
      TO authenticated
      USING (is_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'monthly_report_edit_history' AND policyname = 'monthly_report_edit_history_admin_insert') THEN
    CREATE POLICY monthly_report_edit_history_admin_insert
      ON public.monthly_report_edit_history
      FOR INSERT
      TO authenticated
      WITH CHECK (is_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'monthly_report_edit_history' AND policyname = 'monthly_report_edit_history_service_role_all') THEN
    CREATE POLICY monthly_report_edit_history_service_role_all
      ON public.monthly_report_edit_history
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. 見出し (H1/H2) 差分ヘルパー — トリガー経由 (RPC非経由) の直接書込み用
--    fallback。RPC経由の書込みはJS側で正確なdiffを計算してp_changed_sectionsに渡す。
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.monthly_report_history_diff_sections(before_text text, after_text text)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  before_headings text[];
  after_headings text[];
  changed text[] := ARRAY[]::text[];
  h text;
BEGIN
  before_headings := ARRAY(
    SELECT trim(both from m[1]) FROM regexp_matches(COALESCE(before_text, ''), '^#{1,2}[ \t]+(.+)$', 'ng') AS m
  );
  after_headings := ARRAY(
    SELECT trim(both from m[1]) FROM regexp_matches(COALESCE(after_text, ''), '^#{1,2}[ \t]+(.+)$', 'ng') AS m
  );
  FOREACH h IN ARRAY after_headings LOOP
    IF NOT (h = ANY(before_headings)) THEN
      changed := array_append(changed, h);
    END IF;
  END LOOP;
  FOREACH h IN ARRAY before_headings LOOP
    IF NOT (h = ANY(after_headings)) THEN
      changed := array_append(changed, h);
    END IF;
  END LOOP;
  IF array_length(changed, 1) IS NULL AND before_text IS DISTINCT FROM after_text THEN
    changed := ARRAY['本文（章内変更）'];
  END IF;
  RETURN to_jsonb(changed);
END;
$$;

COMMENT ON FUNCTION public.monthly_report_history_diff_sections(text, text) IS
  'H1/H2見出しの追加・削除を見る簡易diff。見出し不変の章内変更は「本文（章内変更）」と記録する。RPC経由ではJS側が正確な章名を計算する。';

-- ---------------------------------------------------------------------------
-- 3. AFTER トリガー — RPCを経由しない書込みの安全網
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.monthly_report_history_capture_internal()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_action text;
  v_before text;
  v_after text;
BEGIN
  IF current_setting('app.mrh_bypass_trigger', true) = 'true' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_action := 'generate';
    v_before := NULL;
    v_after := COALESCE(NEW.final_content, NEW.draft_content);
  ELSIF NEW.final_content IS DISTINCT FROM OLD.final_content AND NEW.final_content IS NOT NULL THEN
    v_action := 'confirm';
    v_before := OLD.final_content;
    v_after := NEW.final_content;
  ELSIF NEW.draft_content IS DISTINCT FROM OLD.draft_content THEN
    v_action := 'draft_save';
    v_before := OLD.draft_content;
    v_after := NEW.draft_content;
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.monthly_report_edit_history (
    project_id, ym, report_kind, action, actor_kind, actor_member_id, actor_label,
    content_before, content_after, changed_sections, detail_available, source
  ) VALUES (
    NEW.project_id, NEW.ym, 'internal', v_action,
    COALESCE(NULLIF(current_setting('app.mrh_actor_kind', true), ''), 'automation'),
    NULLIF(current_setting('app.mrh_actor_member_id', true), ''),
    COALESCE(NULLIF(current_setting('app.mrh_actor_label', true), ''), 'AMD OS automation (direct write)'),
    v_before, v_after,
    public.monthly_report_history_diff_sections(v_before, v_after),
    true,
    COALESCE(NULLIF(current_setting('app.mrh_source', true), ''), 'direct:monthly_reports')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS monthly_reports_history_capture ON public.monthly_reports;
CREATE TRIGGER monthly_reports_history_capture
  AFTER INSERT OR UPDATE OF draft_content, final_content ON public.monthly_reports
  FOR EACH ROW EXECUTE FUNCTION public.monthly_report_history_capture_internal();

CREATE OR REPLACE FUNCTION public.monthly_report_history_capture_external()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_action text;
  v_before text;
BEGIN
  IF current_setting('app.mrh_bypass_trigger', true) = 'true' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.body_md IS NOT DISTINCT FROM OLD.body_md THEN
    RETURN NEW;
  END IF;

  v_action := CASE WHEN TG_OP = 'INSERT' THEN 'generate' ELSE 'external_save' END;
  v_before := CASE WHEN TG_OP = 'UPDATE' THEN OLD.body_md ELSE NULL END;

  INSERT INTO public.monthly_report_edit_history (
    project_id, ym, report_kind, action, actor_kind, actor_member_id, actor_label,
    content_before, content_after, changed_sections, detail_available, source
  ) VALUES (
    NEW.project_id, replace(NEW.ym, '-', ''), 'external', v_action,
    COALESCE(NULLIF(current_setting('app.mrh_actor_kind', true), ''), 'automation'),
    NULLIF(current_setting('app.mrh_actor_member_id', true), ''),
    COALESCE(NULLIF(current_setting('app.mrh_actor_label', true), ''), 'AMD OS automation (direct write)'),
    v_before, NEW.body_md,
    public.monthly_report_history_diff_sections(v_before, NEW.body_md),
    true,
    COALESCE(NULLIF(current_setting('app.mrh_source', true), ''), 'direct:monthly_reports_external')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS monthly_reports_external_history_capture ON public.monthly_reports_external;
CREATE TRIGGER monthly_reports_external_history_capture
  AFTER INSERT OR UPDATE OF body_md ON public.monthly_reports_external
  FOR EACH ROW EXECUTE FUNCTION public.monthly_report_history_capture_external();

-- ---------------------------------------------------------------------------
-- 4. RPC — 本文保存 + 履歴追記を1トランザクションにする正規経路
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.monthly_report_internal_save(
  p_project_id text,
  p_ym text,
  p_action text,
  p_content text,
  p_actor_member_id text,
  p_actor_kind text,
  p_actor_label text,
  p_changed_sections jsonb DEFAULT '[]'::jsonb,
  p_source text DEFAULT 'pwa',
  p_force boolean DEFAULT false
)
RETURNS public.monthly_reports
LANGUAGE plpgsql
AS $$
DECLARE
  v_before public.monthly_reports;
  v_after public.monthly_reports;
  v_report_id text := p_project_id || '_' || p_ym;
  v_content_before text;
  v_content_after text;
BEGIN
  IF current_user <> 'service_role' AND NOT COALESCE(public.is_admin(), false) THEN
    RAISE EXCEPTION 'admin role is required' USING ERRCODE = '42501';
  END IF;
  IF p_action NOT IN ('draft_save', 'confirm') THEN
    RAISE EXCEPTION 'invalid action % for monthly_report_internal_save', p_action;
  END IF;
  IF p_ym !~ '^[0-9]{6}$' THEN
    RAISE EXCEPTION 'ym must be YYYYMM';
  END IF;
  IF p_content IS NULL THEN
    RAISE EXCEPTION 'content is required';
  END IF;

  -- 同じPJ・対象月への並行保存を直列化し、履歴のbefore/afterを必ず直前版へつなぐ。
  PERFORM pg_advisory_xact_lock(hashtextextended('monthly_report_internal:' || p_project_id || ':' || p_ym, 0));
  PERFORM set_config('app.mrh_bypass_trigger', 'true', true);

  SELECT * INTO v_before FROM public.monthly_reports WHERE project_id = p_project_id AND ym = p_ym;

  IF p_action = 'draft_save' THEN
    INSERT INTO public.monthly_reports (report_id, project_id, ym, draft_content, status)
    VALUES (v_report_id, p_project_id, p_ym, p_content, CASE WHEN v_before.final_content IS NOT NULL THEN v_before.status ELSE 'draft' END)
    ON CONFLICT (project_id, ym) DO UPDATE
      SET draft_content = EXCLUDED.draft_content,
          status = CASE WHEN public.monthly_reports.final_content IS NOT NULL THEN public.monthly_reports.status ELSE 'draft' END;
  ELSE
    IF v_before.id IS NULL OR v_before.draft_content IS NULL THEN
      RAISE EXCEPTION 'no draft content to confirm' USING ERRCODE = 'P0001';
    END IF;
    IF v_before.final_content IS NOT NULL AND NOT p_force THEN
      RAISE EXCEPTION '確定済みの社内版を置き換えるには force が必要です' USING ERRCODE = 'P0002';
    END IF;
    UPDATE public.monthly_reports
      SET draft_content = p_content,
          final_content = p_content,
          status = 'fixed',
          fixed_at = now(),
          confirmed_by = p_actor_label
      WHERE project_id = p_project_id AND ym = p_ym;
  END IF;

  SELECT * INTO v_after FROM public.monthly_reports WHERE project_id = p_project_id AND ym = p_ym;

  IF p_action = 'confirm' THEN
    v_content_before := v_before.final_content;
    v_content_after := v_after.final_content;
  ELSE
    v_content_before := v_before.draft_content;
    v_content_after := v_after.draft_content;
  END IF;

  IF p_action = 'draft_save' AND v_content_before IS NOT DISTINCT FROM v_content_after THEN
    PERFORM set_config('app.mrh_bypass_trigger', 'false', true);
    RETURN v_after;
  END IF;

  INSERT INTO public.monthly_report_edit_history (
    project_id, ym, report_kind, action, actor_kind, actor_member_id, actor_label,
    content_before, content_after, changed_sections, detail_available, source
  ) VALUES (
    p_project_id, p_ym, 'internal', p_action, p_actor_kind, p_actor_member_id, p_actor_label,
    v_content_before, v_content_after, COALESCE(p_changed_sections, '[]'::jsonb), true, p_source
  );

  PERFORM set_config('app.mrh_bypass_trigger', 'false', true);
  RETURN v_after;
END;
$$;

COMMENT ON FUNCTION public.monthly_report_internal_save(text, text, text, text, text, text, text, jsonb, text, boolean) IS
  '社内版月次報告書の本文保存 (draft_save/confirm) と履歴追記を1トランザクションで行う正規RPC。PWAの手動保存 (manual-update / report/fix) はこれ経由。';

CREATE OR REPLACE FUNCTION public.monthly_report_external_save(
  p_project_id text,
  p_ym text,
  p_content text,
  p_jargon_check_status text,
  p_jargon_check_findings jsonb,
  p_generated_by_model text,
  p_actor_member_id text,
  p_actor_kind text,
  p_actor_label text,
  p_changed_sections jsonb DEFAULT '[]'::jsonb,
  p_source text DEFAULT 'pwa'
)
RETURNS public.monthly_reports_external
LANGUAGE plpgsql
AS $$
DECLARE
  v_before public.monthly_reports_external;
  v_after public.monthly_reports_external;
  v_ym_hyphen text := left(p_ym, 4) || '-' || right(p_ym, 2);
BEGIN
  IF current_user <> 'service_role' AND NOT COALESCE(public.is_admin(), false) THEN
    RAISE EXCEPTION 'admin role is required' USING ERRCODE = '42501';
  END IF;
  IF p_ym !~ '^[0-9]{6}$' THEN
    RAISE EXCEPTION 'ym must be YYYYMM';
  END IF;
  IF p_content IS NULL THEN
    RAISE EXCEPTION 'content is required';
  END IF;

  -- INSERT初回を含む並行保存を直列化し、2件目のbeforeを1件目のafterへつなぐ。
  PERFORM pg_advisory_xact_lock(hashtextextended('monthly_report_external:' || p_project_id || ':' || p_ym, 0));
  PERFORM set_config('app.mrh_bypass_trigger', 'true', true);

  SELECT * INTO v_before FROM public.monthly_reports_external WHERE project_id = p_project_id AND ym = v_ym_hyphen;

  INSERT INTO public.monthly_reports_external (project_id, ym, body_md, generated_at, generated_by_model, jargon_check_status, jargon_check_findings, updated_at)
  VALUES (p_project_id, v_ym_hyphen, p_content, now(), p_generated_by_model, p_jargon_check_status, p_jargon_check_findings, now())
  ON CONFLICT (project_id, ym) DO UPDATE
    SET body_md = EXCLUDED.body_md,
        jargon_check_status = EXCLUDED.jargon_check_status,
        jargon_check_findings = EXCLUDED.jargon_check_findings,
        updated_at = now();

  SELECT * INTO v_after FROM public.monthly_reports_external WHERE project_id = p_project_id AND ym = v_ym_hyphen;

  IF v_before.body_md IS NOT DISTINCT FROM v_after.body_md THEN
    PERFORM set_config('app.mrh_bypass_trigger', 'false', true);
    RETURN v_after;
  END IF;

  INSERT INTO public.monthly_report_edit_history (
    project_id, ym, report_kind, action, actor_kind, actor_member_id, actor_label,
    content_before, content_after, changed_sections, detail_available, source
  ) VALUES (
    p_project_id, p_ym, 'external', 'external_save', p_actor_kind, p_actor_member_id, p_actor_label,
    v_before.body_md, v_after.body_md, COALESCE(p_changed_sections, '[]'::jsonb), true, p_source
  );

  PERFORM set_config('app.mrh_bypass_trigger', 'false', true);
  RETURN v_after;
END;
$$;

COMMENT ON FUNCTION public.monthly_report_external_save(text, text, text, text, jsonb, text, text, text, text, jsonb, text) IS
  '提出版月次報告書の本文保存と履歴追記を1トランザクションで行う正規RPC。PWAの external-manual-update はこれ経由。';

REVOKE ALL ON FUNCTION public.monthly_report_internal_save(text, text, text, text, text, text, text, jsonb, text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.monthly_report_external_save(text, text, text, text, jsonb, text, text, text, text, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.monthly_report_internal_save(text, text, text, text, text, text, text, jsonb, text, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.monthly_report_external_save(text, text, text, text, jsonb, text, text, text, text, jsonb, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.monthly_report_history_diff_sections(text, text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. legacy seed — 既存行を「詳細差分なし」の legacy 記録として安全に積む
-- ---------------------------------------------------------------------------

INSERT INTO public.monthly_report_edit_history (
  project_id, ym, report_kind, action, actor_kind, actor_member_id, actor_label,
  content_before, content_after, changed_sections, detail_available, source, created_at
)
SELECT mr.project_id, mr.ym, 'internal', 'generate', 'automation', NULL,
  'AMD OS (自動生成) — legacy seed', NULL, NULL, '[]'::jsonb, false, 'legacy:monthly_reports', mr.generated_at
FROM public.monthly_reports mr
WHERE mr.generated_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.monthly_report_edit_history h
    WHERE h.project_id = mr.project_id AND h.ym = mr.ym AND h.report_kind = 'internal'
      AND h.action = 'generate' AND h.source = 'legacy:monthly_reports'
  );

INSERT INTO public.monthly_report_edit_history (
  project_id, ym, report_kind, action, actor_kind, actor_member_id, actor_label,
  content_before, content_after, changed_sections, detail_available, source, created_at
)
SELECT mr.project_id, mr.ym, 'internal', 'confirm',
  CASE WHEN m.member_id IS NOT NULL THEN 'member' ELSE 'legacy' END,
  m.member_id,
  COALESCE(m.member_name, m.code_name, mr.confirmed_by, '不明') || ' — legacy seed',
  NULL, NULL, '[]'::jsonb, false, 'legacy:monthly_reports', mr.fixed_at
FROM public.monthly_reports mr
LEFT JOIN LATERAL (
  SELECT mm.member_id, mm.code_name, mm.member_name FROM public.members mm
  WHERE mm.code_name = mr.confirmed_by OR mm.member_name = mr.confirmed_by
  LIMIT 1
) m ON true
WHERE mr.fixed_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.monthly_report_edit_history h
    WHERE h.project_id = mr.project_id AND h.ym = mr.ym AND h.report_kind = 'internal'
      AND h.action = 'confirm' AND h.source = 'legacy:monthly_reports'
  );

INSERT INTO public.monthly_report_edit_history (
  project_id, ym, report_kind, action, actor_kind, actor_member_id, actor_label,
  content_before, content_after, changed_sections, detail_available, source, created_at
)
SELECT
  mre.project_id, replace(mre.ym, '-', ''), 'external',
  CASE WHEN mre.generated_by_model = 'manual-edit' THEN 'external_save' ELSE 'generate' END,
  CASE WHEN mre.generated_by_model = 'manual-edit' THEN 'legacy' ELSE 'automation' END,
  NULL,
  CASE
    WHEN mre.generated_by_model = 'manual-edit' THEN '管理者による手動編集 — legacy seed'
    ELSE 'AMD OS (' || COALESCE(mre.generated_by_model, '自動生成') || ') — legacy seed'
  END,
  NULL, NULL, '[]'::jsonb, false, 'legacy:monthly_reports_external', mre.generated_at
FROM public.monthly_reports_external mre
WHERE NOT EXISTS (
  SELECT 1 FROM public.monthly_report_edit_history h
  WHERE h.project_id = mre.project_id AND h.ym = replace(mre.ym, '-', '') AND h.report_kind = 'external'
    AND h.source = 'legacy:monthly_reports_external'
);

COMMIT;
