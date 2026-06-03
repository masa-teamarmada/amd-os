-- 122_rls_policyless_tables_backfill.sql
--
-- 目的: RLS 有効なのにポリシーが 1 件も無いテーブルを救済する。
-- PostgreSQL の RLS は「有効 + ポリシー無し = 全行 deny」が仕様。
-- service_role は RLS をバイパスするため automation / cron からは書き込めるが、
-- ブラウザの supabase クライアント (anon / authenticated JWT) からは常に 0 件になる。
--
-- 実害が確認された事例 (2026-06-02):
--   ms_progress 通知「CX: 5月MS進捗を5件見直す？」で saved_count=5 と件数は出るのに、
--   展開すると「抽出された行が見つかりませんでした」。原因は ms_progress_revisions の
--   ポリシー欠落でブラウザから revision 5 件が読めなかったこと。
--
-- 方針: 隣接する公開/権限テーブルのポリシーパターンに揃える。
--   - 公開表示系 (兄弟が anon_read(true) のもの) : anon_read + admin_all + service_role bypass
--   - authenticated 限定系 : authenticated rw + service_role bypass
--   - 内部設定 / セッション系 : service_role bypass のみ (クライアント非公開)
--
-- すべて DROP POLICY IF EXISTS で冪等化 (CREATE POLICY は冪等でないため)。

-- =====================================================================
-- 公開表示系: ブラウザから直読みされる。兄弟テーブルが anon_read(true) のもの
-- =====================================================================

-- ms_progress_revisions: MS進捗の修正案。milestone_monthly_progress と同じ通知画面に並ぶ。
-- (NotificationsClient.tsx が client component で直読み)
drop policy if exists "anon_read" on public.ms_progress_revisions;
create policy "anon_read" on public.ms_progress_revisions for select to public using (true);
drop policy if exists "admin_all" on public.ms_progress_revisions;
create policy "admin_all" on public.ms_progress_revisions for all to public using (is_admin()) with check (is_admin());
drop policy if exists "service_role_bypass" on public.ms_progress_revisions;
create policy "service_role_bypass" on public.ms_progress_revisions for all to public using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- member_ms_activities: メンバーの MS 活動。member_activities と同じ性質、mypage が直読み。
drop policy if exists "anon_read" on public.member_ms_activities;
create policy "anon_read" on public.member_ms_activities for select to public using (true);
drop policy if exists "admin_all" on public.member_ms_activities;
create policy "admin_all" on public.member_ms_activities for all to public using (is_admin()) with check (is_admin());
drop policy if exists "service_role_bypass" on public.member_ms_activities;
create policy "service_role_bypass" on public.member_ms_activities for all to public using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- ms_progress_proposals: revisions と対の「提案」。将来クライアント表示を見据え同パターン。
drop policy if exists "anon_read" on public.ms_progress_proposals;
create policy "anon_read" on public.ms_progress_proposals for select to public using (true);
drop policy if exists "admin_all" on public.ms_progress_proposals;
create policy "admin_all" on public.ms_progress_proposals for all to public using (is_admin()) with check (is_admin());
drop policy if exists "service_role_bypass" on public.ms_progress_proposals;
create policy "service_role_bypass" on public.ms_progress_proposals for all to public using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- =====================================================================
-- authenticated 限定系: ログインユーザーの読み書き + service_role bypass
-- monthly_report_revision_messages / monthly_report_revisions と同じパターン
-- =====================================================================

-- ms_revision_messages: 修正案のやりとり。現状 route.ts (service_role) のみだが将来 client 化に備える。
drop policy if exists "authenticated_rw" on public.ms_revision_messages;
create policy "authenticated_rw" on public.ms_revision_messages for all to public using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
drop policy if exists "service_role_bypass" on public.ms_revision_messages;
create policy "service_role_bypass" on public.ms_revision_messages for all to public using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- ms_proposal_messages: 提案のやりとり。messages 系と同パターン。
drop policy if exists "authenticated_rw" on public.ms_proposal_messages;
create policy "authenticated_rw" on public.ms_proposal_messages for all to public using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
drop policy if exists "service_role_bypass" on public.ms_proposal_messages;
create policy "service_role_bypass" on public.ms_proposal_messages for all to public using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- navigator_history: ナビゲーター履歴 (ログインユーザー操作ログ)。
drop policy if exists "authenticated_rw" on public.navigator_history;
create policy "authenticated_rw" on public.navigator_history for all to public using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
drop policy if exists "service_role_bypass" on public.navigator_history;
create policy "service_role_bypass" on public.navigator_history for all to public using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- payout_agreement: 報酬合意。金額系のため anon には出さず authenticated + service_role に限定。
drop policy if exists "authenticated_rw" on public.payout_agreement;
create policy "authenticated_rw" on public.payout_agreement for all to public using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
drop policy if exists "service_role_bypass" on public.payout_agreement;
create policy "service_role_bypass" on public.payout_agreement for all to public using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- =====================================================================
-- 内部系: クライアント非公開。service_role bypass のみ
-- =====================================================================

-- tsukuyomi_sessions: つくよみ batch のセッション。クライアント非公開。
drop policy if exists "service_role_bypass" on public.tsukuyomi_sessions;
create policy "service_role_bypass" on public.tsukuyomi_sessions for all to public using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- llm_model_config: LLM モデル設定。内部設定のためクライアント非公開。
drop policy if exists "service_role_bypass" on public.llm_model_config;
create policy "service_role_bypass" on public.llm_model_config for all to public using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
