-- 270_workspace_work_desk.sql
--
-- 機関ワークスペースの「業務デスク」基盤 (EHM_OS_DESIGN_DRAFT_20260813.md 論点11-A、まさ承認 2026-08-13)。
-- 石原先生の産連業務ポートフォリオ (29業務+) を、期限レーダー / 止まるものDB / 領域別一覧として
-- 管理するためのケース台帳。6月設計 (EHM_OS_ISHIHARA_WORK_WRAP_SPEC_v0_20260620.md) のケース管理の実装。
--
-- 設計判断:
--   - 石原先生専用テーブルにせず、institution_workspaces 配下の汎用「業務ケース」にする
--     (他機関へ横展開したとき同じ器を使う)。
--   - 入力憲法: 先生に入力させない。行は AMD が既存資料 (Excel/Notion/会議メモ) から代理登録し、
--     data_status で「未確認 (スナップショット由来)」と「本人確認済み」を分ける。
--   - 締切は 1業務:N件 (募集締切/審査/開催日等)。日付精度 (day/month/vague) を持ち、
--     不明な日付を確定日に丸めない (SX関係先台帳と同じ規律)。
--   - RLS は 212 の7テーブルと同じ default-deny (is_admin() + service_role のみ)。
--     外部 (石原先生本人) への表示は、外部専用DTOを作る段階で別途開ける。
--
-- 冪等性: CREATE TABLE IF NOT EXISTS / DROP POLICY IF EXISTS + CREATE POLICY。

-- =====================================================================
-- 1. workspace_work_cases: 業務ケース台帳
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.workspace_work_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.institution_workspaces(id) ON DELETE RESTRICT,
  case_code text NOT NULL,                 -- 'Y-01' 等。出典資料のID体系を保持
  title text NOT NULL,
  domain text NOT NULL,                    -- '1 YURUGAS運営・基盤' 等 (出典の領域表記そのまま)
  case_kind text,                          -- 定常(年間) / プロジェクト / 申請(締切) / 連携 / フォローアップ 等
  status_label text,                       -- 運営中 / 公開準備(v4) 等 (本人の表記を保持)
  frequency_deadline_note text,            -- 「頻度・締切」列の原文
  stakeholders text,                       -- 関係者
  next_action text,
  waiting_on text,                         -- 待ち先 (止まるものDB: 誰/何を待って止まっているか)
  waiting_since date,
  notes text,
  data_status text NOT NULL DEFAULT 'unconfirmed'
    CHECK (data_status IN ('unconfirmed', 'confirmed', 'stale')),
  source_note text,                        -- 出典 (例: 石原_業務一覧_研究開発OS用_1.xlsx 2026-06末版)
  last_confirmed_at date,                  -- 本人/一次資料で現況確認できた日
  priority_wave smallint,                  -- 巻き取りの段階 (1=締切駆動, 2=定常運営, 3=横断支援)
  sort_order integer,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, case_code)
);

COMMENT ON TABLE public.workspace_work_cases IS
  '機関ワークスペースの業務デスク: 機関側キーパーソンの業務ポートフォリオ台帳。行はAMDが代理登録し、data_statusで未確認/確認済みを分ける (入力憲法: 本人に入力させない)。';
COMMENT ON COLUMN public.workspace_work_cases.waiting_on IS
  '止まるものDB: この業務が誰/何を待って止まっているか。空なら停滞なし。';
COMMENT ON COLUMN public.workspace_work_cases.data_status IS
  'unconfirmed=スナップショット由来で本人未確認 / confirmed=本人or一次資料で確認済み / stale=確認から時間が経ち再確認が必要';

-- =====================================================================
-- 2. workspace_work_case_deadlines: 業務ケースの締切 (1:N)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.workspace_work_case_deadlines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.workspace_work_cases(id) ON DELETE CASCADE,
  label text NOT NULL,                     -- '募集締切' '二次審査' '最終審査会' 等
  due_date date,                           -- 精度が vague の場合は NULL 可
  due_precision text NOT NULL DEFAULT 'day'
    CHECK (due_precision IN ('day', 'month', 'vague')),
  status text NOT NULL DEFAULT 'unconfirmed'
    CHECK (status IN ('unconfirmed', 'upcoming', 'done', 'passed', 'cancelled')),
  sort_order integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.workspace_work_case_deadlines IS
  '業務ケースの締切・節目。due_precision=month は「月しか分からない」を確定日に丸めないための精度表示 (SX関係先台帳と同じ規律)。status=unconfirmed はスナップショット由来で経過/完了が未確認。';

CREATE INDEX IF NOT EXISTS idx_work_case_deadlines_case ON public.workspace_work_case_deadlines (case_id);
CREATE INDEX IF NOT EXISTS idx_work_case_deadlines_due ON public.workspace_work_case_deadlines (due_date);
CREATE INDEX IF NOT EXISTS idx_work_cases_workspace ON public.workspace_work_cases (workspace_id);

-- =====================================================================
-- 3. updated_at trigger (212 の touch 関数を再利用)
-- =====================================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'workspace_work_cases',
    'workspace_work_case_deadlines'
  ])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS touch_updated_at ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.touch_workspace_access_updated_at()',
      t
    );
  END LOOP;
END $$;

-- =====================================================================
-- 4. RLS: default-deny。is_admin() admin + service_role のみ (212 と同一方式)。
-- =====================================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'workspace_work_cases',
    'workspace_work_case_deadlines'
  ])
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_admin_all', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO public USING (public.is_admin()) WITH CHECK (public.is_admin())',
      t || '_admin_all', t
    );

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_service_role_all', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO public USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'')',
      t || '_service_role_all', t
    );
  END LOOP;
END $$;
