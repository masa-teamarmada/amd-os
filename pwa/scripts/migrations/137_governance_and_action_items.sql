-- 137_governance_and_action_items.sql
--
-- 目的: 「要対応案件 (期日つき) + 株主/キャップテーブル + 総会開催履歴・決議 +
--        バリュエーション」を OS に持たせる。起点は JOYCLE 臨時株主総会 (2026-06-05)
--        招集通知が OS に一切抽出されていなかった取りこぼし事故。
--        設計正本: pwa/design/governance_action_items.md
--
-- 新規 4 テーブル (OS に equity/cap table/valuation/汎用 action item は未存在):
--   1. action_items                 : 汎用「要対応」(meeting_action_items の MTG 限定とは別)
--   2. project_shareholders         : 株主 / キャップテーブル (AMD/まさ保有もここ)
--   3. project_valuation_rounds     : 資金調達ラウンド / バリュエーション
--   4. project_shareholder_meetings : 総会/取締役会 開催履歴 + 決議
--
-- RLS 方針 (cap table/valuation は最機密 → 標準 OS 形の anon SELECT true は採らない):
--   - service_role ALL  : cron / API / outbox applier の書き込み経路
--   - is_admin() ALL    : 管理 UI からの read/write (admin gate 配下表示)
--   - anon / authenticated への付与なし (一般メンバー・公開読み取り禁止)
--
-- 適用: python -X utf8 scripts/apply_ddl.py scripts/migrations/137_governance_and_action_items.sql
--       適用後 python3 -X utf8 scripts/dump_schema.py で db_schema.md 再生成。

-- ============================================================
-- 1. action_items (汎用「要対応」)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.action_items (
  action_id          text PRIMARY KEY,
  project_id         text REFERENCES public.projects(project_id),
  scope              text NOT NULL DEFAULT 'project',   -- project / company / personal
  category           text,                              -- governance/legal/finance/contract/hr/tax/admin/other
  title              text NOT NULL,
  summary            text,
  due_at             timestamptz,
  status             text NOT NULL DEFAULT 'open',       -- open/in_progress/responded/done/expired/dismissed
  priority           text,                               -- critical/high/medium/low
  action_url         text,
  assignee_member_id text,
  source             text,                               -- gmail/drive/calendar/slack/notion/manual
  source_ref         text,
  source_hash        text UNIQUE,
  detected_at        timestamptz DEFAULT now(),
  responded_at       timestamptz,
  response_note      text,
  scheduled_nudge_at timestamptz,
  last_nudged_at     timestamptz,
  review_status      text DEFAULT 'candidate',           -- candidate/confirmed/rejected
  metadata_json      jsonb,
  created_by         text,
  updated_by         text,
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS action_items_project_idx   ON public.action_items(project_id);
CREATE INDEX IF NOT EXISTS action_items_status_due_idx ON public.action_items(status, due_at);
CREATE INDEX IF NOT EXISTS action_items_review_idx     ON public.action_items(review_status);

ALTER TABLE public.action_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "action_items_service" ON public.action_items;
CREATE POLICY "action_items_service" ON public.action_items
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "action_items_admin" ON public.action_items;
CREATE POLICY "action_items_admin" ON public.action_items
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================
-- 2. project_shareholders (株主 / キャップテーブル)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.project_shareholders (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       text NOT NULL REFERENCES public.projects(project_id),
  holder_type      text,                 -- amd/masa/founder/vc/angel/employee/other
  holder_name      text NOT NULL,
  holder_member_id text,                 -- members.member_id (AMD 内部の場合)
  share_class      text,                 -- 普通株/優先株AAA種/優先株AA種/優先株2nd ...
  shares           bigint,
  ownership_pct    numeric(6,3),
  invested_yen     bigint,
  as_of_ym         text,
  is_current       boolean DEFAULT true,
  source_ref       text,
  notes            text,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS project_shareholders_project_idx ON public.project_shareholders(project_id);

ALTER TABLE public.project_shareholders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "project_shareholders_service" ON public.project_shareholders;
CREATE POLICY "project_shareholders_service" ON public.project_shareholders
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "project_shareholders_admin" ON public.project_shareholders;
CREATE POLICY "project_shareholders_admin" ON public.project_shareholders
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================
-- 3. project_valuation_rounds (資金調達ラウンド / バリュエーション)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.project_valuation_rounds (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          text NOT NULL REFERENCES public.projects(project_id),
  round_name          text,
  round_date          date,
  round_ym            text,
  pre_money_yen       bigint,
  post_money_yen      bigint,
  raised_yen          bigint,
  price_per_share_yen numeric,
  lead_investor       text,
  source_ref          text,
  notes               text,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS project_valuation_rounds_project_idx ON public.project_valuation_rounds(project_id);

ALTER TABLE public.project_valuation_rounds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "project_valuation_rounds_service" ON public.project_valuation_rounds;
CREATE POLICY "project_valuation_rounds_service" ON public.project_valuation_rounds
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "project_valuation_rounds_admin" ON public.project_valuation_rounds;
CREATE POLICY "project_valuation_rounds_admin" ON public.project_valuation_rounds
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================
-- 4. project_shareholder_meetings (総会/取締役会 開催履歴 + 決議)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.project_shareholder_meetings (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        text NOT NULL REFERENCES public.projects(project_id),
  meeting_type      text,               -- agm/egm/board
  meeting_date      date,
  meeting_ym        text,
  location          text,
  agenda_summary    text,
  resolutions_json  jsonb,              -- [{title, type, result}]
  amd_response      text,               -- proxy/attended/consented/abstained/none
  amd_response_at   timestamptz,
  related_action_id text,               -- 論理リンク -> action_items.action_id
  attachments_json  jsonb,
  source_ref        text,
  notes             text,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS project_shareholder_meetings_project_idx ON public.project_shareholder_meetings(project_id, meeting_date);

ALTER TABLE public.project_shareholder_meetings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "project_shareholder_meetings_service" ON public.project_shareholder_meetings;
CREATE POLICY "project_shareholder_meetings_service" ON public.project_shareholder_meetings
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "project_shareholder_meetings_admin" ON public.project_shareholder_meetings;
CREATE POLICY "project_shareholder_meetings_admin" ON public.project_shareholder_meetings
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
