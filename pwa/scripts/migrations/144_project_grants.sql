-- 144_project_grants.sql
--
-- 目的: 各PJが獲得した助成金・補助金・委託費 (NEDO / SBIR / JST / 文科省 / 経産省 / 自治体 等) を
--        構造化して持つ。2つの用途:
--          (1) 営業アピール: AMD全体の累計獲得助成金額をダッシュボードに出す (累計調達額カードと並ぶ)
--          (2) コックピット: 各PJが「今なんの助成金/補助金を受けているか」を表示する
--        起点: まさ依頼 2026-06-17。現状 助成金は project_strategy_signals の自由文 (「柏市補助金」
--        「SBIR/NEDO」等) に散在するだけで構造化された置き場が無かった。
--        設計正本: pwa/design/governance_action_items.md (助成金章を追補)
--
-- RLS 方針: 助成金は cap table ほど機密でなく、営業アピール資産。
--   - service_role ALL          : cron / API / 集計経路の書き込み
--   - is_admin() ALL            : 管理 UI からの read/write
--   - authenticated SELECT true : ログイン済みメンバーは read 可 (コックピットで自PJの受給状況を見る)
--   - anon への付与なし
--
-- 適用: python -X utf8 scripts/apply_ddl.py scripts/migrations/144_project_grants.sql
--       適用後 python3 -X utf8 scripts/dump_schema.py で db_schema.md 再生成。

CREATE TABLE IF NOT EXISTS public.project_grants (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      text NOT NULL REFERENCES public.projects(project_id),
  grant_name      text NOT NULL,                    -- 案件/制度の表示名 (例: SBIRフェーズ2 / 柏市スタートアップ補助金)
  agency          text,                             -- 交付元 (NEDO / JST / 文科省 / 経産省 / 自治体名 等)
  grant_type      text,                             -- 助成金 / 補助金 / 委託費 / SBIR / 補給金 等
  amount_yen      bigint,                           -- 採択額 / 交付決定額 (= アピール数字)
  disbursed_yen   bigint,                           -- 実入金額 (任意, キャッシュ把握用)
  status          text NOT NULL DEFAULT 'active',   -- applied/adopted/active/completed/rejected/withdrawn
  is_current      boolean DEFAULT true,             -- 現在受給中としてコックピットに出すか
  adopted_date    date,                             -- 採択 / 交付決定日
  period_start_ym text,                             -- 事業期間 開始ym
  period_end_ym   text,                             -- 事業期間 終了ym
  source_ref      text,                             -- gmail/drive/手入力 等の根拠
  notes           text,
  created_by      text,
  updated_by      text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS project_grants_project_idx ON public.project_grants(project_id);
CREATE INDEX IF NOT EXISTS project_grants_status_idx  ON public.project_grants(status);

ALTER TABLE public.project_grants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_grants_service" ON public.project_grants;
CREATE POLICY "project_grants_service" ON public.project_grants
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "project_grants_admin" ON public.project_grants;
CREATE POLICY "project_grants_admin" ON public.project_grants
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "project_grants_read" ON public.project_grants;
CREATE POLICY "project_grants_read" ON public.project_grants
  FOR SELECT TO authenticated USING (true);
