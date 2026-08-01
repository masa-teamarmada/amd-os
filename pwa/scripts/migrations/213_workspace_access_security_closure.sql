-- 213_workspace_access_security_closure.sql
--
-- 目的: 212_workspace_access_foundation.sql と対になる P0 セキュリティ閉鎖。
-- 背景: 本番 anon key での直接プロービングにより、当初想定の5テーブルに加えて
--       projects / members / project_members / seed_funding / seed_news / seed_contact_log
--       の計11テーブルが読み取り可能な状態にあることが判明 (P0)。
--       内訳 (2系統):
--         - institutions / institution_assessments: 108_institution_readiness_ers.sql で RLS 有効化済みだが、
--           その時点の設計 (amd_score 系と同型) で anon read を意図的に付与していた
--           (institutions_anon_read / institution_assessments_anon_read 等)。今回はこの anon read を撤去する。
--         - projects / members / project_members: pwa/scripts/migrations/ (apply_ddl.py の適用対象、現行運用) には
--           これら3テーブルの ENABLE ROW LEVEL SECURITY が一度も無い。別系統の pwa/supabase/migrations/
--           (Supabase CLI 形式、20260409000000_initial_schema.sql) には RLS 有効化 + admin_all 等のポリシー定義が
--           あるが、この系統が本番に適用された記録がなく、本番の実際の RLS 状態は不明瞭 (未適用で無効なまま
--           の可能性が高い)。135_enable_rls_three_unprotected_tables.sql と同種の取りこぼしとして扱う。
--       いずれのケースも「現在本番に何というポリシーが存在するか」を過去のmigration文面だけから確定できないため、
--       下記の各節は pg_policies を動的に走査して既存ポリシーを全て削除してから正本ポリシーを作り直す方式にした
--       (テーブル名・列名・ポリシー名を想像で書かない = リポジトリ運用ルールの徹底)。
--
-- 追加P0 (本ファイル初版の後、本番 pg_policies を直接照会して判明):
--       外部ワークスペースの server DTO が読む4テーブルが、上記11テーブルの網から漏れていた。
--         - seed_sps_assessments: 187_seed_sps_assessments.sql の authenticated_all が
--           USING (auth.uid() IS NOT NULL) の汎用チェックのまま。members に載っていない外部
--           ワークスペースユーザーでも、Supabase セッションを持っている間は SPS の生の軸値
--           (mu_a/mu_i/mu_g/trl/brl/... と evaluator/axis_evidence) を read/write できてしまう。
--           外部ユーザーは email OTP callback 直後に scope:local signOut して署名Cookieへ移る設計だが、
--           「セッションが一瞬でも成立する」前提の上に機密を置かない (多層防御)。
--         - value_plan_cycles / value_milestones / milestone_monthly_progress: anon_read が true。
--           anon key だけで全PJのMS計画・進捗率を読める。外部共有ワークスペースはこの3テーブルを
--           allowlist 列だけに絞って見せる設計なので、素通しの anon read が残っていると
--           「DTOで絞る」という設計自体が無意味になる。
--       これら4テーブルを本ファイルのセクション4・5として閉じ、対象は計15テーブルになった。
--       外部ワークスペースの server DTO (src/lib/external-project-workspace.ts /
--       src/lib/institution-workspace-data.ts) は createAdminClient() = service_role で読むため、
--       authenticated/anon 側を閉じても外部画面の表示は壊れない。内部OSのクライアント直読み
--       (mypage / notifications / cockpit) は members に載った authenticated ユーザーなので
--       amd_os_is_member() が真になり従来どおり読める。これら3テーブルへの書き込みは、
--       既存の admin クライアント直書きは is_admin()、API/cron は service_role の経路を維持する。
--
-- スコープ (本ファイル):
--   1. institutions / institution_assessments / projects / members / project_members の anon 遮断。
--      authenticated read は amd_os_is_member() ゲート、write は is_admin() + service_role のみ
--      (機密データ (契約金額・報酬・住所・銀行口座等) のため anon read は一切付与しない)。
--   2. institution_projects / seed_projects の既存ポリシーを同じ方式で作り直す
--      (207_institution_seed_project_domains.sql 由来の _admin_all / _service_role は同義の内容で再作成)。
--   3. seeds / seed_funding / seed_news / seed_contact_log の既存ポリシー
--      (024_seeds_overhaul.sql 由来の anon_read / authenticated_all / service_role_bypass 等) を
--      全削除し、読み取り・書き込みとも amd_os_is_member() ゲートで作り直す
--      (旧 auth.uid() IS NOT NULL の汎用チェックから統一。seed write は amd_os_is_member() を満たす
--      内部メンバーのみに限定し、外部ワークスペースユーザーはここに直接書き込めない)。
--   4. seed_sps_assessments の既存ポリシー (187 由来の authenticated_all / service_role_bypass 等) を
--      全削除し、read/insert/update/delete とも amd_os_is_member() ゲートで作り直す
--      (セクション3の seeds 系と同じ形)。
--   5. value_plan_cycles / value_milestones / milestone_monthly_progress の既存ポリシー
--      (anon_read=true を含む) を全削除し、authenticated read は amd_os_is_member() ゲート、
--      write は is_admin() + service_role のみにする (セクション1・2と同じ形)。
--      既存の admin クライアント直書きは is_admin()、API/cron は service_role で従来どおり許可する。
--
-- ECR (institution_assessments) と SPS (seed_sps_assessments) は本 migration でも合算・再計算しない。
-- セクション4が seed_sps_assessments に対して行うのはポリシーの張り替えだけで、
-- mu_a/mu_i/mu_g/potential/trl/brl/grl/srl/hrl 等の軸値および評価行そのものには
-- INSERT / UPDATE / DELETE を一切行わない (ECR 側 institution_assessments も同様)。
-- 212 で新設した7テーブルはこのファイルでは一切変更しない。
--
-- 冪等性: DROP POLICY IF EXISTS + CREATE POLICY / pg_policies 動的走査による全削除→再作成。
-- ロールバック: ファイル末尾にコメントアウトした「安全な」手動ロールバックSQLを記載 (自動実行はしない)。
--         安全ロールバックは pause/revoke 相当の記録のみを残す。anon read の復活や RLS の無効化は
--         一切行わない (旧 anon 全開放状態への巻き戻りを防ぐため、意図的に手順を含めていない)。
--
-- 明示トランザクション: 本ファイルの実行部分 (セクション1〜5) は BEGIN/COMMIT で1トランザクションに
--         包む。テーブルごとに pg_policies を全削除してから作り直す構成のため、途中で例外が出ると
--         一部テーブルだけ anon 遮断済み・残りは旧ポリシーのままという中途半端な状態になり得る。
--         全体を1トランザクションにすることで、失敗時は元の (212 適用前と同じ) ポリシー状態に
--         ロールバックされる。
--
-- 適用後に必ず python3 -X utf8 scripts/dump_schema.py で db_schema.md を再生成すること。

BEGIN;

-- =====================================================================
-- 1. 既存5テーブルの anon 遮断 (institutions / institution_assessments / projects / members / project_members)
-- =====================================================================
DO $$
DECLARE t TEXT; pol RECORD;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'institutions',
    'institution_assessments',
    'projects',
    'members',
    'project_members'
  ])
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t);
    END LOOP;

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.amd_os_is_member())',
      t || '_authenticated_read', t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO public USING (public.is_admin()) WITH CHECK (public.is_admin())',
      t || '_admin_all', t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO public USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'')',
      t || '_service_role_all', t
    );
  END LOOP;
END $$;

-- =====================================================================
-- 2. institution_projects / seed_projects: 既存ポリシーを pg_policies 動的走査で全削除してから
--    207_institution_seed_project_domains.sql 由来の _admin_all / _service_role と同義の内容で作り直し、
--    _anon_read の代わりに amd_os_is_member() ゲートの _authenticated_read を新設する。
-- =====================================================================
DO $$
DECLARE t TEXT; pol RECORD;
BEGIN
  FOR t IN SELECT unnest(ARRAY['institution_projects', 'seed_projects'])
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t);
    END LOOP;

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.amd_os_is_member())',
      t || '_authenticated_read', t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO public USING (public.is_admin()) WITH CHECK (public.is_admin())',
      t || '_admin_all', t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO public USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'')',
      t || '_service_role', t
    );
  END LOOP;
END $$;

-- =====================================================================
-- 3. seeds / seed_funding / seed_news / seed_contact_log:
--    既存ポリシー (024_seeds_overhaul.sql 由来の anon_read / authenticated_all / service_role_bypass 等) を
--    pg_policies 動的走査で全削除してから、読み取り・書き込みとも amd_os_is_member() ゲートで作り直す
--    (旧 auth.uid() IS NOT NULL の汎用チェックから統一)。service_role_bypass は同義の内容で作り直す。
--    write (insert/update/delete) は amd_os_is_member() を満たす内部メンバーのみに限定する
--    (外部ワークスペースユーザーはここへ直接書き込めない — 署名Cookie経由のサーバー側 service_role のみ)。
-- =====================================================================
DO $$
DECLARE t TEXT; pol RECORD;
BEGIN
  FOR t IN SELECT unnest(ARRAY['seeds', 'seed_funding', 'seed_news', 'seed_contact_log'])
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t);
    END LOOP;

    EXECUTE format(
      'CREATE POLICY authenticated_read ON public.%I FOR SELECT TO authenticated USING (public.amd_os_is_member())',
      t
    );
    EXECUTE format(
      'CREATE POLICY authenticated_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (public.amd_os_is_member())',
      t
    );
    EXECUTE format(
      'CREATE POLICY authenticated_update ON public.%I FOR UPDATE TO authenticated USING (public.amd_os_is_member()) WITH CHECK (public.amd_os_is_member())',
      t
    );
    EXECUTE format(
      'CREATE POLICY authenticated_delete ON public.%I FOR DELETE TO authenticated USING (public.amd_os_is_member())',
      t
    );
    EXECUTE format(
      'CREATE POLICY service_role_bypass ON public.%I FOR ALL TO public USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'')',
      t
    );
  END LOOP;
END $$;

-- =====================================================================
-- 4. seed_sps_assessments:
--    187_seed_sps_assessments.sql 由来の authenticated_all は USING (auth.uid() IS NOT NULL) の
--    汎用チェックで、members に載っていない外部ワークスペースユーザーでも Supabase セッションが
--    成立している間は SPS の生の軸値と評価者・根拠まで read/write できる状態だった。
--    pg_policies 動的走査で既存ポリシーを全削除し、セクション3の seeds 系と同じ
--    amd_os_is_member() ゲート (read/insert/update/delete) + service_role へ張り替える。
--    ゲート関数は全セクションで schema 修飾して書く (search_path 非依存)。
--    本節はポリシーだけを張り替える。SPS の軸値・評価行に対する DML は一切行わない
--    (合算・再計算・補完もしない — 計算式は pwa/src/lib/seed-sps.ts に一本化のまま)。
-- =====================================================================
DO $$
DECLARE t TEXT := 'seed_sps_assessments'; pol RECORD;
BEGIN
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t);
  END LOOP;

  EXECUTE format(
    'CREATE POLICY authenticated_read ON public.%I FOR SELECT TO authenticated USING (public.amd_os_is_member())',
    t
  );
  EXECUTE format(
    'CREATE POLICY authenticated_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (public.amd_os_is_member())',
    t
  );
  EXECUTE format(
    'CREATE POLICY authenticated_update ON public.%I FOR UPDATE TO authenticated USING (public.amd_os_is_member()) WITH CHECK (public.amd_os_is_member())',
    t
  );
  EXECUTE format(
    'CREATE POLICY authenticated_delete ON public.%I FOR DELETE TO authenticated USING (public.amd_os_is_member())',
    t
  );
  EXECUTE format(
    'CREATE POLICY service_role_bypass ON public.%I FOR ALL TO public USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'')',
    t
  );
END $$;

-- =====================================================================
-- 5. value_plan_cycles / value_milestones / milestone_monthly_progress:
--    本番 pg_policies では anon_read が true のままで、anon key だけで全PJのMS計画・進捗率を
--    読める状態だった。外部共有ワークスペースはこの3テーブルを allowlist 列だけに絞って見せる
--    設計 (src/lib/external-project-workspace.ts) なので、素通しの anon read が残っていると
--    DTO で絞る意味が無くなる。pg_policies 動的走査で既存ポリシーを全削除し、
--    authenticated read は amd_os_is_member() ゲート、write は is_admin() + service_role のみにする
--    (セクション1・2と同じ形)。
--    影響範囲: 外部ワークスペースの server DTO は service_role で読むので壊れない。内部OSの
--    クライアント直読み (mypage / notifications / cockpit) は members に載った authenticated
--    ユーザーなのでゲートを通る。3テーブルへの既存の admin クライアント直書きは is_admin()、
--    API/cron の書き込みは service_role のポリシーで従来どおり通る。
-- =====================================================================
DO $$
DECLARE t TEXT; pol RECORD;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'value_plan_cycles',
    'value_milestones',
    'milestone_monthly_progress'
  ])
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t);
    END LOOP;

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.amd_os_is_member())',
      t || '_authenticated_read', t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO public USING (public.is_admin()) WITH CHECK (public.is_admin())',
      t || '_admin_all', t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO public USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'')',
      t || '_service_role_all', t
    );
  END LOOP;
END $$;

COMMIT;

-- =====================================================================
-- 安全ロールバック (手動。自動実行しない。DDL適用担当が必要に応じてコメントを外して実行する)
--
-- 方針: このファイルが閉じた anon 経路 (セクション1・2・3 の11テーブルに加え、セクション5 の
--       value_plan_cycles / value_milestones / milestone_monthly_progress) の再開、および
--       セクション4 で撤去した汎用 authenticated (auth.uid() IS NOT NULL) の復活、
--       RLS の無効化は絶対に行わない。
--       ロールバックが必要な事態が起きても、まず 212 側の pause/revoke (ehime workspace の
--       status='paused' 化) で外部アクセス経路を止めることを優先し、本ファイルの
--       ポリシー構成 (authenticated + amd_os_is_member() ゲート) はそのまま維持する。
-- =====================================================================
-- (このファイルには実行可能なロールバック手順を用意しない。anon read の復活・RLS 無効化は
--  事故防止のため意図的に手順化しない。ロールバックが必要な場合は個別に安全な代替ポリシーを
--  設計してから別 migration として追加する。)
