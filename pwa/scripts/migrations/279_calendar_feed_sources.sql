-- 279_calendar_feed_sources.sql
--
-- 予定表の公開URL (ICS) を入口にする。2026-08-15 実測の判定を受けた設計変更。
--
-- 背景: 愛媛大テナントはユーザー同意を無効化しており、Microsoft公式の検証済みアプリ
-- (Graph Explorer) ですら Calendars.Read で「管理者の承認が必要」と出た
-- (EHM_OS_M365_VERDICT_20260815.md)。委任同意(OAuth)経由でのカレンダー取得は、
-- 大学情報部門の承認が下りるまで成立しない。
--
-- 代替として、Outlookの「予定表を公開する」で発行できるICS URLを使う。
--   - OAuthも管理者承認も不要。本人が1回URLを発行してAMDへ渡すだけ
--   - 公開範囲を「タイトルと場所を閲覧可能」にすると、ICSに DESCRIPTION (本文) が
--     構造的に含まれない。本文を読まないという設計方針がMicrosoft側で強制される
--   - 実測 (まさの愛媛大アカウント): HTTP 200、SUMMARY / DTSTART / DTEND / LOCATION /
--     UID / STATUS が取得でき、DESCRIPTION は0件
--
-- 安全上の扱い:
--   - **URL自体が秘密値**。知っている人は認証なしで予定を読める。RLSはservice_roleのみ、
--     DTOやログへ出さない。表示するのは末尾4文字のフィンガープリントだけ
--   - 提供者が「公開取り消し」を押せばURLは即座に無効になる。AMD側の失効処理は不要
--   - 取り込むのは件名・日時・場所・UIDのみ。本文・添付・参加者メールは保存しない

CREATE TABLE IF NOT EXISTS public.calendar_feed_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL,
  owner_label text NOT NULL,
  feed_url text NOT NULL,
  provider text NOT NULL DEFAULT 'outlook_published_ics'
    CHECK (provider IN ('outlook_published_ics', 'google_ics', 'other_ics')),
  visibility_level text NOT NULL DEFAULT 'title_location'
    CHECK (visibility_level IN ('availability_only', 'title_location', 'full_details')),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'revoked')),
  consent_note text,
  last_fetched_at timestamptz,
  last_fetch_status text,
  last_event_count integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, feed_url)
);

COMMENT ON TABLE public.calendar_feed_sources IS
  '予定表の公開URL(ICS)の登録。feed_urlは認証なしで読める秘密値なのでservice_roleのみ。委任同意(OAuth)が大学テナントで通らないため、この経路を第1波の入口にする。';
COMMENT ON COLUMN public.calendar_feed_sources.visibility_level IS
  '提供者がOutlook側で選んだ公開範囲。title_location では ICS に DESCRIPTION が含まれない。full_details を登録する場合は本文を保存しない実装であることを確認する。';
COMMENT ON COLUMN public.calendar_feed_sources.consent_note IS
  '誰がいつ、どの範囲で公開に同意したか。相手の許諾の記録なので必ず埋める。';

-- =====================================================================
-- 取り込んだ予定。本文・添付・参加者メールは持たない。
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.calendar_feed_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES public.calendar_feed_sources(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  event_uid text NOT NULL,
  summary text NOT NULL,
  location text,
  starts_at timestamptz,
  ends_at timestamptz,
  is_all_day boolean NOT NULL DEFAULT false,
  ics_status text,
  linked_milestone_id uuid,
  link_state text NOT NULL DEFAULT 'unlinked'
    CHECK (link_state IN ('unlinked', 'suggested', 'confirmed', 'ignored')),
  link_confidence text NOT NULL DEFAULT 'unknown'
    CHECK (link_confidence IN ('unknown', 'low', 'medium', 'high')),
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  disappeared_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_id, event_uid)
);

COMMENT ON TABLE public.calendar_feed_events IS
  '公開ICSから取り込んだ予定。件名・日時・場所・UIDのみ。本文/添付/参加者メールは保存しない。linked_milestone_idはAMDが確認して結ぶもので、自動確定はしない。';
COMMENT ON COLUMN public.calendar_feed_events.link_state IS
  'unlinked=未紐づけ / suggested=OSが候補を出した / confirmed=人が確認した / ignored=業務と無関係と判断。suggestedを確定扱いしない。';
COMMENT ON COLUMN public.calendar_feed_events.disappeared_at IS
  'フィードから消えた時刻。予定の削除は取り込み側では確定できないので、行は消さず印だけ付ける。';

CREATE INDEX IF NOT EXISTS idx_calendar_feed_events_source ON public.calendar_feed_events (source_id);
CREATE INDEX IF NOT EXISTS idx_calendar_feed_events_project_start ON public.calendar_feed_events (project_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_calendar_feed_events_milestone ON public.calendar_feed_events (linked_milestone_id);

-- =====================================================================
-- updated_at
-- =====================================================================
CREATE OR REPLACE FUNCTION public.touch_calendar_feed_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['calendar_feed_sources', 'calendar_feed_events'])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS touch_updated_at ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.touch_calendar_feed_updated_at()',
      t
    );
  END LOOP;
END $$;

-- =====================================================================
-- RLS: service_role のみ。feed_url は認証なしで予定が読めるURLなので、
-- adminのブラウザセッションにも直接は開けない (サーバー側routeを通す)。
-- =====================================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['calendar_feed_sources', 'calendar_feed_events'])
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_service_role', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO public USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'')',
      t || '_service_role', t
    );
  END LOOP;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='calendar_feed_sources') THEN
    RAISE EXCEPTION 'calendar_feed_sources が作成されていない';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='calendar_feed_events') THEN
    RAISE EXCEPTION 'calendar_feed_events が作成されていない';
  END IF;
END $$;
