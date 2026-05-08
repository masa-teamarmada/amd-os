-- 017_vc_rls_writes.sql
--
-- 016 で作った 6 テーブルは SELECT only の RLS で、PWA edit ページからの保存が
-- `42501 row-level security` で弾かれていた。書き込み policy を追加する。
--
-- VC List は AMD メンバーは全員フルアクセスする方針 (role gate なし)。
-- - authenticated_all: ログイン済みなら誰でも ALL 操作 OK
-- - service_role_bypass: cron route (vc-news-ingest / seed-vcs) や server-side
--                       admin client から service_role key で直叩く用

DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'vcs',
    'vc_funds',
    'vc_investments',
    'vc_contacts',
    'project_vc_relations',
    'vc_news'
  ]) LOOP
    EXECUTE format('DROP POLICY IF EXISTS authenticated_all ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY authenticated_all ON public.%I FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL)',
      t
    );
    EXECUTE format('DROP POLICY IF EXISTS service_role_bypass ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY service_role_bypass ON public.%I FOR ALL USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'')',
      t
    );
  END LOOP;
END $$;
