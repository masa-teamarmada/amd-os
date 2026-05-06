-- 009_project_ventures_rls_writes.sql
--
-- 008 で作った 3 テーブル (project_ventures / project_xrl_log / project_events) は
-- SELECT only の RLS で、PWA から書き込もうとすると `42501 row-level security` で弾かれていた。
-- ここで書き込み policy を追加する:
--
-- - admin_all: 既存 PJ 系テーブル (projects, project_members, project_config) と同パターン。
--             auth ユーザーが members.is_admin=true なら ALL 操作許可。
-- - service_role_bypass: server-side API (narrative / xrl-propose) が service_role key で直叩く用。
--
-- DEV_MODE で誰でも書きたい場合は WITH CHECK (true) に緩めるが、ここは admin 限定が筋。

DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['project_ventures', 'project_xrl_log', 'project_events']) LOOP
    EXECUTE format('DROP POLICY IF EXISTS admin_all ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY admin_all ON public.%I FOR ALL USING (is_admin()) WITH CHECK (is_admin())', t
    );
    EXECUTE format('DROP POLICY IF EXISTS service_role_bypass ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY service_role_bypass ON public.%I FOR ALL USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'')', t
    );
  END LOOP;
END $$;
