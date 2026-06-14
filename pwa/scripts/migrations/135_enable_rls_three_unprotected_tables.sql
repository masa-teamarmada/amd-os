-- 135_enable_rls_three_unprotected_tables.sql
--
-- 目的: RLS が無効のまま anon に SELECT/INSERT/UPDATE/DELETE 全権が開いていた
--       3 テーブルを塞ぐ。Supabase security advisor が ERROR (rls_disabled_in_public)
--       で検出。OS 内の他の全テーブルは RLS 有効なので、これらは DDL 時の取りこぼし。
--
-- 影響テーブル (いずれも経営データ):
--   - milestone_monthly_contribution_allocations : メンバー別の報酬配分 (最機密)
--   - project_graduation_signals                 : PJ 卒業判定スコア
--   - protocol_result_observations               : プロトコル結果観察
--
-- 採用パターン (OS 標準形を踏襲):
--   - anon SELECT (true)         : PWA 表示用の公開読み取り (既存テーブルと同じ)
--   - service_role ALL           : cron / API の書き込み経路 (実際の write は全て service_role)
--   - admin (is_admin()) ALL     : 将来の管理 UI からの書き込み用 (報酬配分は特に admin 限定が筋)
--   - anon / authenticated の書き込みは付与しない (= 改竄・削除を塞ぐ)
--
-- 書き込み経路の裏取り (2026-06-14):
--   - milestone_monthly_contribution_allocations: src/lib/reward-summary.ts 経由、
--     呼び出し API/cron は全て SUPABASE_SERVICE_ROLE_KEY クライアント
--   - project_graduation_signals: src/app/api/cron/graduation-detection/route.ts のみ、
--     createAdminClient (= service_role)
--   - protocol_result_observations: admin/protocols/page.tsx は .select のみ (読み取り)。
--     書き込み経路は現状コードに無い (将来用)
--
-- => service_role ALL があれば既存の書き込みは全て通る。anon 書き込みを塞いでも回帰なし。
--
-- 適用状況: 2026-06-14 に Supabase MCP apply_migration で本番適用済み。
--           advisor 再実行で rls_disabled_in_public ERROR 3 件消滅を確認。

-- ============================================================
-- 1. milestone_monthly_contribution_allocations (報酬配分・最機密)
-- ============================================================
ALTER TABLE public.milestone_monthly_contribution_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mmca_anon_read" ON public.milestone_monthly_contribution_allocations;
CREATE POLICY "mmca_anon_read"
  ON public.milestone_monthly_contribution_allocations
  FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS "mmca_service_role_all" ON public.milestone_monthly_contribution_allocations;
CREATE POLICY "mmca_service_role_all"
  ON public.milestone_monthly_contribution_allocations
  FOR ALL TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "mmca_admin_all" ON public.milestone_monthly_contribution_allocations;
CREATE POLICY "mmca_admin_all"
  ON public.milestone_monthly_contribution_allocations
  FOR ALL TO public
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================
-- 2. project_graduation_signals (PJ 卒業判定スコア)
-- ============================================================
ALTER TABLE public.project_graduation_signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pgs_anon_read" ON public.project_graduation_signals;
CREATE POLICY "pgs_anon_read"
  ON public.project_graduation_signals
  FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS "pgs_service_role_all" ON public.project_graduation_signals;
CREATE POLICY "pgs_service_role_all"
  ON public.project_graduation_signals
  FOR ALL TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "pgs_admin_all" ON public.project_graduation_signals;
CREATE POLICY "pgs_admin_all"
  ON public.project_graduation_signals
  FOR ALL TO public
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================
-- 3. protocol_result_observations (プロトコル結果観察)
-- ============================================================
ALTER TABLE public.protocol_result_observations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pro_anon_read" ON public.protocol_result_observations;
CREATE POLICY "pro_anon_read"
  ON public.protocol_result_observations
  FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS "pro_service_role_all" ON public.protocol_result_observations;
CREATE POLICY "pro_service_role_all"
  ON public.protocol_result_observations
  FOR ALL TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "pro_admin_all" ON public.protocol_result_observations;
CREATE POLICY "pro_admin_all"
  ON public.protocol_result_observations
  FOR ALL TO public
  USING (is_admin())
  WITH CHECK (is_admin());
