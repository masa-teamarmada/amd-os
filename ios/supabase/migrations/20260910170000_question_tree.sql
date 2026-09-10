-- 20260910170000_question_tree.sql
--
-- 問いの木。`目的 → 成立条件 → 工程` の3階層を廃止し、
-- 問い / やること / 分かったこと の3型へ畳む土台を作る。
-- 正本: pwa/spec/3-21-question-tree-current-spec.md（まさ確定 2026-09-10）
--
-- 本ファイルは新テーブルの追加のみで、既存テーブルには一切触らない。
-- 既存データの移行は 20260910171000_question_tree_backfill.sql で行い、
-- 旧テーブルの撤去は新画面が本番で動いたあと、まさの確認を経て別途行う。
--
-- 再利用する既存の土台（pwa/scripts/migrations/183_project_management_workspace.sql）:
--   amd_os_can_access_project(text)
--   amd_os_can_manage_project_shared_data(text)
--   project_management_touch_updated_at()
--   project_management_block_authenticated_delete()
--   project_management_audit_fields()
--
-- 冪等性: CREATE TABLE IF NOT EXISTS / CREATE OR REPLACE / DROP ... IF EXISTS。

BEGIN;

-- =====================================================================
-- 1. 問い — 答えが出れば閉じるもの
--    論点 / 仮説 / 決めること / 目的 / 成立条件 をこの1型へ畳む。
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.project_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL REFERENCES public.projects(project_id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.project_questions(id) ON DELETE SET NULL,
  contribution text CHECK (contribution IN ('required', 'alternative')),
  title text NOT NULL,
  background text,
  question_kind text NOT NULL DEFAULT 'open' CHECK (question_kind IN ('open', 'decision')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'answered', 'dropped')),
  answer text,
  answered_on date,
  answered_by text,
  drop_reason text,
  confidence text NOT NULL DEFAULT 'unknown' CHECK (confidence IN ('high', 'medium', 'low', 'unknown')),
  owner_label text NOT NULL DEFAULT '担当未確認',
  due_date date,
  origin_kind text NOT NULL DEFAULT 'manual' CHECK (origin_kind IN ('manual', 'meeting', 'automation', 'migrated')),
  origin_ref text,
  origin_question_id uuid REFERENCES public.project_questions(id) ON DELETE SET NULL,
  sort_order integer NOT NULL DEFAULT 0,
  last_verified_at date NOT NULL DEFAULT current_date,
  created_by text,
  updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by text,
  version integer NOT NULL DEFAULT 1,
  client_token uuid,
  CONSTRAINT project_questions_no_self_parent
    CHECK (parent_id IS NULL OR parent_id <> id),
  -- 根は親から見た役割を持たない。子は必ず required か alternative のどちらか。
  CONSTRAINT project_questions_contribution_pairs_with_parent
    CHECK ((parent_id IS NULL AND contribution IS NULL) OR (parent_id IS NOT NULL AND contribution IS NOT NULL)),
  -- 閉じるには答えが1行あればよい。逆に、答えなしで閉じることはできない。
  CONSTRAINT project_questions_answered_needs_answer
    CHECK (status <> 'answered' OR (answer IS NOT NULL AND length(btrim(answer)) > 0)),
  -- 追わないと決めた枝は、理由を残す。
  CONSTRAINT project_questions_dropped_needs_reason
    CHECK (status <> 'dropped' OR (drop_reason IS NOT NULL AND length(btrim(drop_reason)) > 0))
);

COMMENT ON TABLE public.project_questions IS
  '問い。答えが出れば閉じるもの。論点・仮説・決めること・目的・成立条件をこの1型で表す。'
  '親子は単一親の木で、contribution が required なら親の必須条件、alternative なら代替候補。';
COMMENT ON COLUMN public.project_questions.origin_question_id IS
  'どの問いを議論していて生まれたか。答えを出す過程で派生した枝の出どころを保持する。';
COMMENT ON COLUMN public.project_questions.contribution IS
  'required = これが解けないと親は解けない / alternative = これが解ければ親に答えが出る（他の代替は不要）。';

-- =====================================================================
-- 2. やること — 実行すれば終わるもの
--    工程 / 予定日MS / タスク / 検証 / 技術試験 / 決定後の行動 をこの1型へ畳む。
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.project_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL REFERENCES public.projects(project_id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.project_actions(id) ON DELETE SET NULL,
  title text NOT NULL,
  detail text,
  action_kind text NOT NULL DEFAULT 'work' CHECK (action_kind IN ('work', 'measure')),
  -- unassessed（進捗未登録）と not_started（着手していないと人が宣言した）は別物。
  -- 既定は unassessed。0%と偽らず「分からない」を保つ（まさ確定、旧spec 3-16から継承）。
  status text NOT NULL DEFAULT 'unassessed'
    CHECK (status IN ('unassessed', 'not_started', 'running', 'blocked', 'done', 'dropped')),
  owner_label text NOT NULL DEFAULT '担当未確認',
  planned_start date,
  planned_end date,
  actual_end date,
  date_certainty text NOT NULL DEFAULT 'provisional' CHECK (date_certainty IN ('confirmed', 'provisional')),
  progress_pct integer NOT NULL DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
  blocker text,
  done_criteria text,
  done_evidence text,
  target text,
  actual text,
  unit text,
  origin_kind text NOT NULL DEFAULT 'manual' CHECK (origin_kind IN ('manual', 'meeting', 'automation', 'migrated')),
  origin_ref text,
  origin_question_id uuid REFERENCES public.project_questions(id) ON DELETE SET NULL,
  sort_order integer NOT NULL DEFAULT 0,
  last_verified_at date NOT NULL DEFAULT current_date,
  created_by text,
  updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by text,
  version integer NOT NULL DEFAULT 1,
  client_token uuid,
  CONSTRAINT project_actions_no_self_parent
    CHECK (parent_id IS NULL OR parent_id <> id),
  CONSTRAINT project_actions_date_order
    CHECK (planned_start IS NULL OR planned_end IS NULL OR planned_start <= planned_end),
  CONSTRAINT project_actions_done_needs_actual_end
    CHECK (status <> 'done' OR actual_end IS NOT NULL)
);

COMMENT ON TABLE public.project_actions IS
  'やること。実行すれば終わるもの。工程はparent_idの入れ子で表し、深さの制限は設けない。'
  'action_kind = measure は問いに答えを出すための行為（測る・調べる・見積もる・相手に聞く）。';
COMMENT ON COLUMN public.project_actions.target IS '測定系のときだけ埋まる目標値。単位は unit。';

-- =====================================================================
-- 3. 分かったこと — 事実と出どころ
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.project_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL REFERENCES public.projects(project_id) ON DELETE CASCADE,
  summary text NOT NULL,
  finding_kind text NOT NULL DEFAULT 'neutral'
    CHECK (finding_kind IN ('supports', 'contradicts', 'neutral', 'missing')),
  observed_on date,
  source_label text NOT NULL DEFAULT '出どころ未確認',
  source_url text,
  confidence text NOT NULL DEFAULT 'unknown' CHECK (confidence IN ('high', 'medium', 'low', 'unknown')),
  from_action_id uuid REFERENCES public.project_actions(id) ON DELETE SET NULL,
  sort_order integer NOT NULL DEFAULT 0,
  last_verified_at date NOT NULL DEFAULT current_date,
  created_by text,
  updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by text,
  version integer NOT NULL DEFAULT 1,
  client_token uuid
);

COMMENT ON TABLE public.project_findings IS
  '分かったこと。根拠と反証をこの1型で表す。外部由来でも出どころを必ず持つ。'
  'missing は「分かっていないことが分かった」を表す。';

-- =====================================================================
-- 4. つなぎ
--    問いとやることは多対多。1回の測定が複数の問いに答えることを表せる。
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.project_question_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL REFERENCES public.projects(project_id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.project_questions(id) ON DELETE CASCADE,
  action_id uuid NOT NULL REFERENCES public.project_actions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (question_id, action_id)
);

CREATE TABLE IF NOT EXISTS public.project_question_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL REFERENCES public.projects(project_id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.project_questions(id) ON DELETE CASCADE,
  finding_id uuid NOT NULL REFERENCES public.project_findings(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (question_id, finding_id)
);

CREATE TABLE IF NOT EXISTS public.project_action_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL REFERENCES public.projects(project_id) ON DELETE CASCADE,
  predecessor_action_id uuid NOT NULL REFERENCES public.project_actions(id) ON DELETE CASCADE,
  successor_action_id uuid NOT NULL REFERENCES public.project_actions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (predecessor_action_id, successor_action_id),
  CONSTRAINT project_action_dependencies_no_self
    CHECK (predecessor_action_id <> successor_action_id)
);

-- =====================================================================
-- 5. 親子ガード — 同一PJであること、循環しないこと
-- =====================================================================

CREATE OR REPLACE FUNCTION public.project_questions_parent_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  cursor_id uuid;
  parent_project text;
  depth integer := 0;
BEGIN
  IF NEW.parent_id IS NULL THEN RETURN NEW; END IF;

  SELECT project_id INTO parent_project FROM public.project_questions WHERE id = NEW.parent_id;
  IF parent_project IS NULL THEN
    RAISE EXCEPTION 'parent question % not found', NEW.parent_id USING ERRCODE = '23503';
  END IF;
  IF parent_project <> NEW.project_id THEN
    RAISE EXCEPTION 'parent question belongs to another project' USING ERRCODE = '23514';
  END IF;

  cursor_id := NEW.parent_id;
  WHILE cursor_id IS NOT NULL LOOP
    IF cursor_id = NEW.id THEN
      RAISE EXCEPTION 'circular parent reference on project_questions' USING ERRCODE = '23514';
    END IF;
    depth := depth + 1;
    IF depth > 100 THEN
      RAISE EXCEPTION 'question tree deeper than 100 levels' USING ERRCODE = '23514';
    END IF;
    SELECT parent_id INTO cursor_id FROM public.project_questions WHERE id = cursor_id;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.project_actions_parent_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  cursor_id uuid;
  parent_project text;
  depth integer := 0;
BEGIN
  IF NEW.parent_id IS NULL THEN RETURN NEW; END IF;

  SELECT project_id INTO parent_project FROM public.project_actions WHERE id = NEW.parent_id;
  IF parent_project IS NULL THEN
    RAISE EXCEPTION 'parent action % not found', NEW.parent_id USING ERRCODE = '23503';
  END IF;
  IF parent_project <> NEW.project_id THEN
    RAISE EXCEPTION 'parent action belongs to another project' USING ERRCODE = '23514';
  END IF;

  cursor_id := NEW.parent_id;
  WHILE cursor_id IS NOT NULL LOOP
    IF cursor_id = NEW.id THEN
      RAISE EXCEPTION 'circular parent reference on project_actions' USING ERRCODE = '23514';
    END IF;
    depth := depth + 1;
    IF depth > 100 THEN
      RAISE EXCEPTION 'action tree deeper than 100 levels' USING ERRCODE = '23514';
    END IF;
    SELECT parent_id INTO cursor_id FROM public.project_actions WHERE id = cursor_id;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.project_action_dependency_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  predecessor_project text;
  successor_project text;
BEGIN
  SELECT project_id INTO predecessor_project FROM public.project_actions WHERE id = NEW.predecessor_action_id;
  SELECT project_id INTO successor_project FROM public.project_actions WHERE id = NEW.successor_action_id;
  IF predecessor_project IS NULL OR successor_project IS NULL THEN
    RAISE EXCEPTION 'dependency references a missing action' USING ERRCODE = '23503';
  END IF;
  IF predecessor_project <> NEW.project_id OR successor_project <> NEW.project_id THEN
    RAISE EXCEPTION 'dependency crosses projects' USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    WITH RECURSIVE chain AS (
      SELECT d.successor_action_id AS node
      FROM public.project_action_dependencies d
      WHERE d.predecessor_action_id = NEW.successor_action_id
      UNION
      SELECT d.successor_action_id
      FROM public.project_action_dependencies d
      JOIN chain c ON d.predecessor_action_id = c.node
    )
    SELECT 1 FROM chain WHERE node = NEW.predecessor_action_id
  ) THEN
    RAISE EXCEPTION 'circular dependency on project_action_dependencies' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.project_question_link_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  question_project text;
  target_project text;
BEGIN
  SELECT project_id INTO question_project FROM public.project_questions WHERE id = NEW.question_id;
  IF TG_TABLE_NAME = 'project_question_actions' THEN
    SELECT project_id INTO target_project FROM public.project_actions WHERE id = NEW.action_id;
  ELSE
    SELECT project_id INTO target_project FROM public.project_findings WHERE id = NEW.finding_id;
  END IF;

  IF question_project IS NULL OR target_project IS NULL THEN
    RAISE EXCEPTION 'link references a missing row' USING ERRCODE = '23503';
  END IF;
  IF question_project <> NEW.project_id OR target_project <> NEW.project_id THEN
    RAISE EXCEPTION 'link crosses projects' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS project_questions_parent_guard ON public.project_questions;
CREATE TRIGGER project_questions_parent_guard
  BEFORE INSERT OR UPDATE OF parent_id, project_id ON public.project_questions
  FOR EACH ROW EXECUTE FUNCTION public.project_questions_parent_guard();

DROP TRIGGER IF EXISTS project_actions_parent_guard ON public.project_actions;
CREATE TRIGGER project_actions_parent_guard
  BEFORE INSERT OR UPDATE OF parent_id, project_id ON public.project_actions
  FOR EACH ROW EXECUTE FUNCTION public.project_actions_parent_guard();

DROP TRIGGER IF EXISTS project_action_dependency_guard ON public.project_action_dependencies;
CREATE TRIGGER project_action_dependency_guard
  BEFORE INSERT OR UPDATE ON public.project_action_dependencies
  FOR EACH ROW EXECUTE FUNCTION public.project_action_dependency_guard();

DROP TRIGGER IF EXISTS project_question_actions_link_guard ON public.project_question_actions;
CREATE TRIGGER project_question_actions_link_guard
  BEFORE INSERT OR UPDATE ON public.project_question_actions
  FOR EACH ROW EXECUTE FUNCTION public.project_question_link_guard();

DROP TRIGGER IF EXISTS project_question_findings_link_guard ON public.project_question_findings;
CREATE TRIGGER project_question_findings_link_guard
  BEFORE INSERT OR UPDATE ON public.project_question_findings
  FOR EACH ROW EXECUTE FUNCTION public.project_question_link_guard();

-- =====================================================================
-- 6. 索引
-- =====================================================================

CREATE INDEX IF NOT EXISTS project_questions_tree_idx
  ON public.project_questions (project_id, parent_id, sort_order);
CREATE INDEX IF NOT EXISTS project_questions_open_due_idx
  ON public.project_questions (project_id, status, due_date);
CREATE INDEX IF NOT EXISTS project_questions_origin_idx
  ON public.project_questions (project_id, origin_question_id);
CREATE UNIQUE INDEX IF NOT EXISTS project_questions_client_token_uq
  ON public.project_questions (project_id, client_token)
  WHERE client_token IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS project_actions_tree_idx
  ON public.project_actions (project_id, parent_id, sort_order);
CREATE INDEX IF NOT EXISTS project_actions_schedule_idx
  ON public.project_actions (project_id, status, planned_end);
CREATE INDEX IF NOT EXISTS project_actions_kind_idx
  ON public.project_actions (project_id, action_kind, status);
CREATE UNIQUE INDEX IF NOT EXISTS project_actions_client_token_uq
  ON public.project_actions (project_id, client_token)
  WHERE client_token IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS project_findings_observed_idx
  ON public.project_findings (project_id, observed_on DESC);
CREATE INDEX IF NOT EXISTS project_findings_action_idx
  ON public.project_findings (project_id, from_action_id);

CREATE INDEX IF NOT EXISTS project_question_actions_action_idx
  ON public.project_question_actions (project_id, action_id);
CREATE INDEX IF NOT EXISTS project_question_findings_finding_idx
  ON public.project_question_findings (project_id, finding_id);
CREATE INDEX IF NOT EXISTS project_action_dependencies_successor_idx
  ON public.project_action_dependencies (project_id, successor_action_id);

-- =====================================================================
-- 7. 権限・RLS・監査
--    既存の project_management_* と同じ契約に揃える。
-- =====================================================================

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'project_questions', 'project_actions', 'project_findings',
    'project_question_actions', 'project_question_findings', 'project_action_dependencies'
  ] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated, service_role', table_name);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', table_name || '_member_select', table_name);
    IF table_name IN ('project_questions', 'project_actions', 'project_findings') THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.amd_os_can_access_project(project_id) AND deleted_at IS NULL)', table_name || '_member_select', table_name);
    ELSE
      EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.amd_os_can_access_project(project_id))', table_name || '_member_select', table_name);
    END IF;

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', table_name || '_manager_insert', table_name);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.amd_os_can_manage_project_shared_data(project_id))', table_name || '_manager_insert', table_name);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', table_name || '_manager_update', table_name);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.amd_os_can_manage_project_shared_data(project_id)) WITH CHECK (public.amd_os_can_manage_project_shared_data(project_id))', table_name || '_manager_update', table_name);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', table_name || '_service_all', table_name);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)', table_name || '_service_all', table_name);
  END LOOP;
END $$;

-- つなぎテーブルは物理削除を許す（リンクを外す操作がそのまま削除になるため）。
-- 3つの主テーブルは論理削除だけを許し、変更を field_audit へ残す。
DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['project_questions', 'project_actions', 'project_findings'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', table_name || '_touch_updated_at', table_name);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.project_management_touch_updated_at()', table_name || '_touch_updated_at', table_name);

    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', table_name || '_block_delete', table_name);
    EXECUTE format('CREATE TRIGGER %I BEFORE DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.project_management_block_authenticated_delete()', table_name || '_block_delete', table_name);

    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', table_name || '_field_audit', table_name);
    EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.project_management_audit_fields()', table_name || '_field_audit', table_name);
  END LOOP;
END $$;

COMMIT;
