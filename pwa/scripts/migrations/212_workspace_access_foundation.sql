-- 212_workspace_access_foundation.sql
--
-- 目的: 研究機関ワークスペース向けメールリンク認証 (email OTP + 署名Cookie) の DB 基盤 (新設分のみ)。
-- 出自: 回収元 amd-os-access-recovery-artifacts の 211_workspace_email_access.sql を
--       Phase A の作業単位に合わせて foundation (本ファイル) / security closure (213) に分割した。
--       ECR (institution_assessments) と SPS (seed_sps_assessments) はこのペアのどちらでも
--       合算・再計算しない。既存テーブルの anon 遮断は 213 側でのみ行う (本ファイルでは行わない)。
--
-- スコープ (本ファイル):
--   1. 新規テーブル7個: workspace_user_accounts / institution_workspaces /
--      institution_workspace_memberships / institution_workspace_project_scopes /
--      institution_workspace_seed_scopes / project_access_memberships /
--      workspace_access_audit_logs
--      -> 全テーブル RLS 有効・anon/一般authenticated ポリシーなし (= is_admin() admin + service_role のみ)。
--         外部ワークスペースユーザーは signOut({scope:'local'}) 後の署名Cookieでのみ動くため、
--         Supabase authenticated セッションでこれらのテーブルに触れる経路は元々存在しない。
--   2. institution_workspaces に is_publicly_listed (bool, default false) を新設し、
--      status (active/paused) とは独立させる。公開トップページの表示条件は
--      status='active' AND is_publicly_listed=true のみ。今回は 'ehime' 1件のみ true。
--   3. p30 (愛媛大学エコシステム構築PJ) を ehime ワークスペースの project scope に
--      status='active', shared_surface='summary' (サマリのみ共有、rich workspace は非共有) で登録する。
--      p21 (法人としてはまだ設立していない個別 PJ) は project scope に含めない。
--      seed scope 側は institution 段階かPJ化済みかで絞り込みをしない: inst_ehime に紐づく seed は
--      現時点の全件をそのまま登録する。PJ化 (project_id 紐付け) されている seed も除外しない
--      — institution workspace からの可視性と、PJ個別workspaceの自動共有可否は別軸のため。
--
-- 既存テーブル (institutions / institution_assessments / institution_projects / seed_projects /
--   projects / members / project_members / seed_funding / seed_news / seed_contact_log) の
--   anon 遮断・authenticated ゲート化は本ファイルでは一切行わない (= 213_workspace_access_security_closure.sql)。
--
-- 冪等性: CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS / DROP POLICY IF EXISTS + CREATE POLICY /
--         ON CONFLICT ... DO UPDATE / DO NOTHING。seed 投入件数は固定値を assert せず、0件だった場合のみ異常とみなす。
-- ロールバック: ファイル末尾にコメントアウトした「安全な」手動ロールバックSQLを記載 (自動実行はしない)。
--         安全ロールバックは本ファイルで新設した機能 (7テーブル・ehime ワークスペース) の pause/revoke のみを
--         行い、RLS の無効化は一切行わない。
--
-- 不変条件 (再実行安全性): セクション10の ON CONFLICT は institution_workspaces.status /
--         is_publicly_listed、institution_workspace_project_scopes.status / shared_surface、
--         institution_workspace_seed_scopes.status を 'active'/TRUE へ書き戻さない。
--         既存行が手動で paused/revoked にされていれば、その停止・失効状態はこの migration の
--         再実行後もそのまま維持される。'active'/TRUE が入るのは INSERT で新規に行が作られた
--         ときだけ (= ON CONFLICT の分岐には入らない初回実行時のみ)。
--
-- 明示トランザクション: 本ファイルの実行部分 (セクション1〜10) は BEGIN/COMMIT で1トランザクションに
--         包む。途中で例外が出た場合 (RAISE EXCEPTION 含む) は全体がロールバックされ、
--         一部テーブルだけ作成された中途半端な状態を残さない。
--
-- 適用後に必ず python3 -X utf8 scripts/dump_schema.py で db_schema.md を再生成すること。

BEGIN;

-- =====================================================================
-- 1. 新規テーブル: workspace_user_accounts
-- =====================================================================
CREATE TABLE IF NOT EXISTS workspace_user_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  email_normalized TEXT GENERATED ALWAYS AS (lower(btrim(email))) STORED,
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  display_name TEXT,
  status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'active', 'suspended')),
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (email_normalized)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_user_accounts_auth_user_id
  ON workspace_user_accounts (auth_user_id) WHERE auth_user_id IS NOT NULL;

COMMENT ON TABLE workspace_user_accounts IS
  '外部 (研究機関/PJ関係者) ワークスペースユーザーの識別台帳。email が唯一の識別子。DB登録済みメンバーシップのみが認可根拠 (emailドメイン一致だけでは認可しない)。';
COMMENT ON COLUMN workspace_user_accounts.status IS
  'invited=招待済未ログイン / active=利用中 / suspended=利用停止。';
COMMENT ON COLUMN workspace_user_accounts.auth_user_id IS
  'Supabase Auth (email OTP) でリンクされた auth.users.id。callback成立後にのみ設定。ログイン中も通常セッションは即 scope:local signOut し、以後は署名Cookieのみで運用する。';

-- =====================================================================
-- 2. 新規テーブル: institution_workspaces
-- =====================================================================
CREATE TABLE IF NOT EXISTS institution_workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL,
  institution_id TEXT NOT NULL UNIQUE REFERENCES institutions(institution_id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'paused' CHECK (status IN ('active', 'paused')),
  is_publicly_listed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (slug)
);

CREATE INDEX IF NOT EXISTS idx_institution_workspaces_institution_id
  ON institution_workspaces (institution_id);

COMMENT ON TABLE institution_workspaces IS
  '研究機関向け外部ワークスペース。1機関 = 1行 (slugでルーティング)。';
COMMENT ON COLUMN institution_workspaces.status IS
  'active=運用中 / paused=一時停止 (メンバーシップ判定には影響、公開一覧の条件は is_publicly_listed と別軸)。';
COMMENT ON COLUMN institution_workspaces.is_publicly_listed IS
  '公開トップページ (/) に名前を出す明示的な公開同意フラグ。status とは独立。true でも status<>active なら非表示。';

-- =====================================================================
-- 3. 新規テーブル: institution_workspace_memberships
-- =====================================================================
CREATE TABLE IF NOT EXISTS institution_workspace_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES institution_workspaces(id) ON DELETE CASCADE,
  user_account_id UUID NOT NULL REFERENCES workspace_user_accounts(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member', 'readonly')),
  status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'active', 'suspended', 'revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, user_account_id)
);

CREATE INDEX IF NOT EXISTS idx_institution_workspace_memberships_user
  ON institution_workspace_memberships (user_account_id);
CREATE INDEX IF NOT EXISTS idx_institution_workspace_memberships_workspace
  ON institution_workspace_memberships (workspace_id);

COMMENT ON TABLE institution_workspace_memberships IS
  'workspace_user_accounts × institution_workspaces の所属。institution scope 単独では PJ workspace への rich アクセスは付与しない (project_access_memberships が別途必要)。';
COMMENT ON COLUMN institution_workspace_memberships.role IS
  'owner=機関側の管理担当 / member=通常メンバー / readonly=閲覧のみ。';
COMMENT ON COLUMN institution_workspace_memberships.status IS
  'invited=招待済未参加 / active=有効 / suspended=一時停止 / revoked=剥奪。';

-- =====================================================================
-- 4. 新規テーブル: institution_workspace_project_scopes
-- =====================================================================
CREATE TABLE IF NOT EXISTS institution_workspace_project_scopes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES institution_workspaces(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'revoked')),
  shared_surface TEXT NOT NULL DEFAULT 'summary' CHECK (shared_surface IN ('summary', 'workspace')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_institution_workspace_project_scopes_workspace
  ON institution_workspace_project_scopes (workspace_id);

COMMENT ON TABLE institution_workspace_project_scopes IS
  '機関ワークスペースに紐づけて開示するPJの明示allowlist。p30(愛媛大学エコシステムPJ)はここに shared_surface=summary で入るが、p21のような個別PJのrich workspaceは自動連動させない。';
COMMENT ON COLUMN institution_workspace_project_scopes.status IS
  'active=公開中 / paused=一時停止 / revoked=剥奪。';
COMMENT ON COLUMN institution_workspace_project_scopes.shared_surface IS
  'summary=サマリ情報のみ開示 / workspace=機関ワークスペース内で拡張情報を開示。どちらも /project/[id]/workspace のアクセスは付与せず、project_access_memberships が別途必要。';

-- =====================================================================
-- 5. 新規テーブル: institution_workspace_seed_scopes
-- =====================================================================
CREATE TABLE IF NOT EXISTS institution_workspace_seed_scopes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES institution_workspaces(id) ON DELETE CASCADE,
  seed_id UUID NOT NULL REFERENCES seeds(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, seed_id)
);

CREATE INDEX IF NOT EXISTS idx_institution_workspace_seed_scopes_workspace
  ON institution_workspace_seed_scopes (workspace_id);

COMMENT ON TABLE institution_workspace_seed_scopes IS
  '機関ワークスペースに紐づけて開示する個別seedのallowlist。institution_id が一致する seed は、PJに紐付いているかどうかに関わらず対象にする (PJ化済みかどうかでフィルタしない)。';
COMMENT ON COLUMN institution_workspace_seed_scopes.status IS
  'active=公開中 / paused=一時停止 / revoked=剥奪。';

-- =====================================================================
-- 6. 新規テーブル: project_access_memberships
-- =====================================================================
CREATE TABLE IF NOT EXISTS project_access_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_account_id UUID NOT NULL REFERENCES workspace_user_accounts(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'contributor' CHECK (role IN ('manager', 'contributor', 'readonly')),
  status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'active', 'suspended', 'revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_account_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_project_access_memberships_user
  ON project_access_memberships (user_account_id);
CREATE INDEX IF NOT EXISTS idx_project_access_memberships_project
  ON project_access_memberships (project_id);

COMMENT ON TABLE project_access_memberships IS
  '外部ユーザーが個別PJの共有ワークスペース (/project/[id]/workspace) に入れるための直接付与。institution workspace 所属だけでは自動発生しない。';
COMMENT ON COLUMN project_access_memberships.role IS
  'manager=PJ側の管理担当 / contributor=通常参加者 / readonly=閲覧のみ。';
COMMENT ON COLUMN project_access_memberships.status IS
  'invited=招待済未参加 / active=有効 / suspended=一時停止 / revoked=剥奪。';

-- =====================================================================
-- 7. 新規テーブル: workspace_access_audit_logs
-- =====================================================================
CREATE TABLE IF NOT EXISTS workspace_access_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  user_account_id UUID REFERENCES workspace_user_accounts(id) ON DELETE SET NULL,
  email TEXT,
  workspace_id UUID REFERENCES institution_workspaces(id) ON DELETE SET NULL,
  project_id TEXT REFERENCES projects(project_id) ON DELETE SET NULL,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workspace_access_audit_logs_user
  ON workspace_access_audit_logs (user_account_id);
CREATE INDEX IF NOT EXISTS idx_workspace_access_audit_logs_created_at
  ON workspace_access_audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workspace_access_audit_logs_event_type
  ON workspace_access_audit_logs (event_type);

COMMENT ON TABLE workspace_access_audit_logs IS
  '外部ワークスペース認証・アクセス制御の監査ログ。email-start/callback/logout/route access denied/admin操作を記録。書き込みはservice_role経由のみ (クライアントから直接書かせない)。';
COMMENT ON COLUMN workspace_access_audit_logs.detail IS
  'イベントの補足情報 (JSONB)。生コンテンツ本文・URL・トークン/署名/パスワード等の秘匿値は絶対に入れない。event_type / 件数 / 判定結果など、監査に必要な最小限のメタデータのみを書き込む。';

-- =====================================================================
-- 8. updated_at 自動更新トリガ (新規7テーブル中、6テーブルに適用。audit_logsはinsert-onlyのため対象外)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.touch_workspace_access_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'workspace_user_accounts',
    'institution_workspaces',
    'institution_workspace_memberships',
    'institution_workspace_project_scopes',
    'institution_workspace_seed_scopes',
    'project_access_memberships'
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
-- 9. 新規7テーブルの RLS: 全テーブル default-deny。is_admin() admin + service_role のみ。
--    外部ユーザーは署名Cookie経由のサーバー側 (service_role) からしかこれらに触れない。
-- =====================================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'workspace_user_accounts',
    'institution_workspaces',
    'institution_workspace_memberships',
    'institution_workspace_project_scopes',
    'institution_workspace_seed_scopes',
    'project_access_memberships',
    'workspace_access_audit_logs'
  ])
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_admin_all', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin())',
      t || '_admin_all', t
    );

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_service_role_all', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO public USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'')',
      t || '_service_role_all', t
    );
  END LOOP;
END $$;

-- =====================================================================
-- 10. Ehime University ワークスペース seed 投入 (slug='ehime')
--     p30 のみ status='active' / shared_surface='summary'、p21 は project scope に含めない。
--     seed scope は inst_ehime に紐づく seed を PJ化状況で絞り込まずそのまま登録する。
-- =====================================================================
DO $$
DECLARE
  v_institution_id TEXT;
  v_workspace_id UUID;
  v_project_count INTEGER;
  v_seed_scope_count INTEGER;
BEGIN
  -- p30 = 愛媛大学エコシステム構築PJ であることを再確認 (207 の assert と同じ前提)
  SELECT institution_id INTO v_institution_id
  FROM institution_projects
  WHERE project_id = 'p30';

  IF v_institution_id IS NULL THEN
    RAISE EXCEPTION 'institution_projects に project_id=p30 が見つからない';
  END IF;

  IF v_institution_id <> 'inst_ehime' THEN
    RAISE EXCEPTION 'p30 の institution_id が inst_ehime ではない (実際: %)', v_institution_id;
  END IF;

  -- ワークスペース本体 (公開許諾済み、稼働中)。
  -- ON CONFLICT では status / is_publicly_listed を意図的に更新しない: 既存行が admin 操作で
  -- paused / FALSE にされていた場合、この migration の再実行だけで active / TRUE に戻ってしまう
  -- (= 停止したはずのワークスペースが勝手に再開する) 事故を防ぐため。'active'/TRUE が入るのは
  -- 新規 INSERT のときだけ (= ON CONFLICT に落ちない初回実行時のみ)。
  INSERT INTO institution_workspaces (slug, institution_id, name, status, is_publicly_listed)
  VALUES ('ehime', v_institution_id, '愛媛大学', 'active', TRUE)
  ON CONFLICT (slug) DO UPDATE SET
    institution_id = EXCLUDED.institution_id,
    name = EXCLUDED.name,
    updated_at = NOW()
  RETURNING id INTO v_workspace_id;

  IF v_workspace_id IS NULL THEN
    SELECT id INTO v_workspace_id FROM institution_workspaces WHERE slug = 'ehime';
  END IF;

  -- project scope: p30 のみ、shared_surface='summary' (rich workspace は共有しない)。p21 は絶対に入れない。
  -- ON CONFLICT は DO NOTHING: status / shared_surface は admin が pause/revoke した後の状態を
  -- 保持する。再実行で active に戻さない (institution_workspaces と同じ不変条件)。
  INSERT INTO institution_workspace_project_scopes (workspace_id, project_id, status, shared_surface)
  VALUES (v_workspace_id, 'p30', 'active', 'summary')
  ON CONFLICT (workspace_id, project_id) DO NOTHING;

  SELECT count(*) INTO v_project_count
  FROM institution_workspace_project_scopes
  WHERE workspace_id = v_workspace_id AND project_id = 'p30';

  IF v_project_count <> 1 THEN
    RAISE EXCEPTION 'ehime workspace の project scope に p30 が一意に存在しない (実際: %件)', v_project_count;
  END IF;

  IF EXISTS (
    SELECT 1 FROM institution_workspace_project_scopes
    WHERE workspace_id = v_workspace_id AND project_id = 'p21'
  ) THEN
    RAISE EXCEPTION 'ehime workspace の project scope に p21 が含まれている (禁止)';
  END IF;

  -- seed scope: inst_ehime に紐づく seed を PJ化 (project_id 紐付け) の有無でフィルタせず全件登録する。
  -- ON CONFLICT は DO NOTHING: status は admin が pause/revoke した後の状態を保持する
  -- (project scope と同じ不変条件 — 再実行で active に戻さない)。
  INSERT INTO institution_workspace_seed_scopes (workspace_id, seed_id, status)
  SELECT v_workspace_id, id, 'active'
  FROM seeds
  WHERE institution_id = 'inst_ehime'
  ON CONFLICT (workspace_id, seed_id) DO NOTHING;

  SELECT count(*) INTO v_seed_scope_count
  FROM institution_workspace_seed_scopes
  WHERE workspace_id = v_workspace_id;

  IF v_seed_scope_count = 0 THEN
    RAISE EXCEPTION 'ehime workspace の seed scope が0件 (inst_ehime の seed が投入されていない)';
  END IF;

  RAISE NOTICE 'ehime workspace 投入完了 (workspace_id=%, project_scope=1(p30,summary), seed_scope=%件)', v_workspace_id, v_seed_scope_count;
END $$;

COMMIT;

-- =====================================================================
-- 安全ロールバック (手動。自動実行しない。DDL適用担当が必要に応じてコメントを外して実行する)
--
-- 方針: この migration が新設した「ワークスペース機能」のみを pause/revoke する。
--       RLS の無効化は絶対に行わない。
-- =====================================================================
-- BEGIN;
--
-- -- 10 の投入データは削除せず、ワークスペースと scope 行を pause/revoke するだけに留める
-- UPDATE institution_workspaces SET status = 'paused', updated_at = NOW() WHERE slug = 'ehime';
-- UPDATE institution_workspace_project_scopes SET status = 'revoked', updated_at = NOW()
--   WHERE workspace_id = (SELECT id FROM institution_workspaces WHERE slug = 'ehime');
-- UPDATE institution_workspace_seed_scopes SET status = 'revoked', updated_at = NOW()
--   WHERE workspace_id = (SELECT id FROM institution_workspaces WHERE slug = 'ehime');
--
-- COMMIT;
--
-- -- 上記だけで新機能は事実上無効化される (institution_workspaces.status<>'active' により
-- -- ワークスペースへのログイン・表示経路が閉じる)。新規7テーブルの RLS (is_admin()/service_role のみ) は
-- -- このロールバックでは一切変更しない。RLS を無効化する操作は、このリポジトリの運用上ここでは
-- -- 絶対に行わない。
