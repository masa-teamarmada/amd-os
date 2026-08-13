-- 277_microsoft_graph_tokens.sql
--
-- Microsoft Graph (M365) 連携のトークン置き場。
-- まさ確定 2026-08-13:「さきにおれのmicrosoftアカウントでテストしようよ」。
-- 石原先生のM365から進捗データを取る前に、まさ自身のMicrosoftアカウントで
-- 委任同意フローと予定の読み取りが成立するかを確認するための基盤。
--
-- 設計:
--   - member_google_oauth_tokens はPKが member_id 単独でproviderを増やせないため、別テーブルにする
--   - RLSは service_role のみ (Google側と同じ)。adminにも直接は開けない。
--     トークンはサーバー側のroute経由でしか触らせない
--   - refresh_token は長期有効な秘密値。これを持つ行は監査対象なので、
--     取得・更新の時刻と、同意したスコープを必ず残す
--   - 本文・メールは保存しない。第1波のスコープは Calendars.Read のみ

CREATE TABLE IF NOT EXISTS public.member_microsoft_oauth_tokens (
  member_id text PRIMARY KEY,
  account_label text,
  account_kind text CHECK (account_kind IN ('personal', 'work_school', 'unknown')),
  tenant_id text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  scopes text[] NOT NULL DEFAULT '{}'::text[],
  last_authorized_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.member_microsoft_oauth_tokens IS
  'Microsoft Graph の委任同意トークン。1メンバー1アカウント。service_roleのみ触れる。第1波のスコープはCalendars.Readのみで、メール本文・予定本文は保存しない。';
COMMENT ON COLUMN public.member_microsoft_oauth_tokens.account_kind IS
  'personal=個人用Microsoftアカウント(consumers) / work_school=職場・学校アカウント(Entra IDテナント)。大学テナント特有の同意制限は personal では再現できないため、検証結果の読み替えに使う。';

CREATE OR REPLACE FUNCTION public.touch_member_microsoft_oauth_tokens_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS touch_updated_at ON public.member_microsoft_oauth_tokens;
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.member_microsoft_oauth_tokens
  FOR EACH ROW EXECUTE FUNCTION public.touch_member_microsoft_oauth_tokens_updated_at();

ALTER TABLE public.member_microsoft_oauth_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS member_microsoft_oauth_tokens_service_role ON public.member_microsoft_oauth_tokens;
CREATE POLICY member_microsoft_oauth_tokens_service_role ON public.member_microsoft_oauth_tokens
  FOR ALL TO public USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- =====================================================================
-- OAuth の state (CSRF対策 + 開始者の同定)。短命。
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.microsoft_oauth_states (
  state text PRIMARY KEY,
  member_id text NOT NULL,
  redirect_after text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

COMMENT ON TABLE public.microsoft_oauth_states IS
  'Microsoft OAuth の state。callbackで使い捨て、期限切れは拒否する。';

ALTER TABLE public.microsoft_oauth_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS microsoft_oauth_states_service_role ON public.microsoft_oauth_states;
CREATE POLICY microsoft_oauth_states_service_role ON public.microsoft_oauth_states
  FOR ALL TO public USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='member_microsoft_oauth_tokens') THEN
    RAISE EXCEPTION 'member_microsoft_oauth_tokens が作成されていない';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='microsoft_oauth_states') THEN
    RAISE EXCEPTION 'microsoft_oauth_states が作成されていない';
  END IF;
END $$;
