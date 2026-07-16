-- 179_project_capital_plans.sql
--
-- 各 PJ の資本政策プラン（設立からIPOまでの複数ラウンドを1本の資本イベント列
-- として保存する、社内承認・VC提出に使う実運用の台帳）を、全 AMD メンバーが
-- 閲覧・編集できる working ledger として保存する。
-- project_capital_plans = 編集可能な作業中プラン（楽観ロック用の revision 付き）。
-- project_capital_plan_versions = freeze 時に確定した JSON の append-only 履歴。
--
-- destructive DDL は行わない。

-- ============================================================
-- 1. 作業中シナリオ（member visible / editable）
-- ============================================================
CREATE TABLE IF NOT EXISTS public.project_capital_plans (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id             text NOT NULL REFERENCES public.projects(project_id),
  name                   text NOT NULL,
  status                 text NOT NULL DEFAULT 'active',
  revision               integer NOT NULL DEFAULT 1,
  document_json          jsonb NOT NULL DEFAULT '{}'::jsonb,
  latest_frozen_version  integer,
  created_by_email       text,
  updated_by_email       text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_capital_plans_status_check
    CHECK (status IN ('active', 'archived')),
  CONSTRAINT project_capital_plans_revision_check
    CHECK (revision >= 1)
);

CREATE INDEX IF NOT EXISTS project_capital_plans_project_idx
  ON public.project_capital_plans(project_id, status, updated_at DESC);

-- ============================================================
-- 2. freeze された確定版（append-only、変更不可）
-- ============================================================
CREATE TABLE IF NOT EXISTS public.project_capital_plan_versions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id              uuid NOT NULL REFERENCES public.project_capital_plans(id) ON DELETE CASCADE,
  project_id           text NOT NULL REFERENCES public.projects(project_id),
  version              integer NOT NULL,
  source_revision      integer NOT NULL,
  document_json        jsonb NOT NULL,
  validation_summary   jsonb,
  published_by_email   text,
  published_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_capital_plan_versions_version_check
    CHECK (version >= 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS project_capital_plan_versions_plan_version_uniq
  ON public.project_capital_plan_versions(plan_id, version);
CREATE INDEX IF NOT EXISTS project_capital_plan_versions_project_idx
  ON public.project_capital_plan_versions(project_id, plan_id, version DESC);

-- ============================================================
-- 3. AMD member 権限
-- 会社概要タブ（migration 174）と同じ方針: 全 AMD メンバーが全 PJ を
-- 閲覧・編集できる。public.amd_os_is_member() は 174 で定義済みのため再利用する。
-- ============================================================
ALTER TABLE public.project_capital_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_capital_plan_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_capital_plans_members" ON public.project_capital_plans;
CREATE POLICY "project_capital_plans_members" ON public.project_capital_plans
  FOR ALL TO authenticated USING (public.amd_os_is_member()) WITH CHECK (public.amd_os_is_member());
DROP POLICY IF EXISTS "project_capital_plans_service" ON public.project_capital_plans;
CREATE POLICY "project_capital_plans_service" ON public.project_capital_plans
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- versions は append-only: authenticated member は SELECT のみ。
-- INSERT は service role（管理 API 経由）のみが行う。UPDATE/DELETE は
-- どのロールにも許可しない（下記トリガーでも二重に禁止する）。
DROP POLICY IF EXISTS "project_capital_plan_versions_members" ON public.project_capital_plan_versions;
CREATE POLICY "project_capital_plan_versions_members" ON public.project_capital_plan_versions
  FOR SELECT TO authenticated USING (public.amd_os_is_member());
DROP POLICY IF EXISTS "project_capital_plan_versions_service" ON public.project_capital_plan_versions;
CREATE POLICY "project_capital_plan_versions_service" ON public.project_capital_plan_versions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- 4. append-only 強制トリガー（RLS を迂回する経路があっても防御）
-- freeze された版は誰も UPDATE/DELETE できない。
-- ============================================================
CREATE OR REPLACE FUNCTION public.project_capital_plan_versions_block_write()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'project_capital_plan_versions is append-only: % not allowed', TG_OP;
END;
$$;

DROP TRIGGER IF EXISTS project_capital_plan_versions_no_update ON public.project_capital_plan_versions;
CREATE TRIGGER project_capital_plan_versions_no_update
  BEFORE UPDATE ON public.project_capital_plan_versions
  FOR EACH ROW EXECUTE FUNCTION public.project_capital_plan_versions_block_write();

DROP TRIGGER IF EXISTS project_capital_plan_versions_no_delete ON public.project_capital_plan_versions;
CREATE TRIGGER project_capital_plan_versions_no_delete
  BEFORE DELETE ON public.project_capital_plan_versions
  FOR EACH ROW EXECUTE FUNCTION public.project_capital_plan_versions_block_write();

-- ============================================================
-- 5. freeze を1トランザクションで原子化する SECURITY DEFINER 関数
-- latest_frozen_version の更新と version insert が分離していると、
-- insert 失敗時に「latest_frozen_version だけ進んで実体が無い」壊れた
-- ポインタが残り得る。plan 行を FOR UPDATE でロックし、revision 検証・
-- version insert・latest_frozen_version 更新を単一トランザクションで行う。
-- append-only trigger（上記4）はこの関数内でも有効（UPDATE/DELETE を防ぐのは
-- versions テーブルのみなので、この関数が行う versions への INSERT は妨げない）。
-- ============================================================
CREATE OR REPLACE FUNCTION public.freeze_capital_plan(
  p_plan_id uuid,
  p_expected_revision integer,
  p_validation_summary jsonb,
  p_published_by_email text
) RETURNS TABLE (plan jsonb, version jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan public.project_capital_plans%ROWTYPE;
  v_version public.project_capital_plan_versions%ROWTYPE;
  v_next_version integer;
BEGIN
  SELECT * INTO v_plan
  FROM public.project_capital_plans
  WHERE id = p_plan_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'plan not found: %', p_plan_id USING ERRCODE = 'AMD02';
  END IF;

  IF v_plan.revision <> p_expected_revision THEN
    RAISE EXCEPTION 'revision conflict: expected % current %', p_expected_revision, v_plan.revision
      USING ERRCODE = 'AMD01';
  END IF;

  v_next_version := COALESCE(v_plan.latest_frozen_version, 0) + 1;

  INSERT INTO public.project_capital_plan_versions (
    plan_id, project_id, version, source_revision, document_json, validation_summary, published_by_email
  ) VALUES (
    v_plan.id, v_plan.project_id, v_next_version, p_expected_revision, v_plan.document_json,
    p_validation_summary, p_published_by_email
  )
  RETURNING * INTO v_version;

  UPDATE public.project_capital_plans
  SET latest_frozen_version = v_next_version,
      updated_by_email = p_published_by_email,
      updated_at = now()
  WHERE id = v_plan.id
  RETURNING * INTO v_plan;

  RETURN QUERY SELECT to_jsonb(v_plan), to_jsonb(v_version);
END;
$$;

REVOKE ALL ON FUNCTION public.freeze_capital_plan(uuid, integer, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.freeze_capital_plan(uuid, integer, jsonb, text) TO service_role;
