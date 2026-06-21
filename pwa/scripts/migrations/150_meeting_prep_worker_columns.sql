-- 150_meeting_prep_worker_columns.sql
-- H-1 MTG Prep Worker (= 自動準備セッション) のための prep_* 列を追加。
--
-- 背景: まさ要求 (2026-06-22) で、翌48h の upcoming MTG ごとに Codex Cloud automation を
-- 動的 spawn し、文脈ロード→着地点draft→Drive資料draft→Notion議事録draft→readiness 計算まで
-- 完遂して待機する仕組み「MTG Prep Worker」を追加する。worker が生成した状態は既存の
-- `project_meeting_summaries` (upcoming row) に prep_* 列としてぶら下げる。
--
-- 既存の `prep_status` (text、25列目) は H-1 routine が source_kinds と並んで「準備状況」を
-- 短く書く既存仕様のため、衝突を避けて `prep_*` の prefix を使う新規列で分離する。
--
-- 設計正本: pwa/spec/3-3-meeting-flow-current-spec.md 末尾「MTG Prep Worker」節 /
--          pwa/scheduled-tasks/amd-os-l6-meeting-prep-*/SKILL.md

ALTER TABLE project_meeting_summaries
  ADD COLUMN IF NOT EXISTS prep_readiness_score      int4,
  ADD COLUMN IF NOT EXISTS prep_readiness_reasons    jsonb,
  ADD COLUMN IF NOT EXISTS prep_draft_md             text,
  ADD COLUMN IF NOT EXISTS prep_drive_asset_id       text,
  ADD COLUMN IF NOT EXISTS prep_notion_page_id       text,
  ADD COLUMN IF NOT EXISTS prep_worker_session_id    text,
  ADD COLUMN IF NOT EXISTS prep_worker_session_url   text,
  ADD COLUMN IF NOT EXISTS prep_worker_status        text,
  ADD COLUMN IF NOT EXISTS prep_worker_spawned_at    timestamptz,
  ADD COLUMN IF NOT EXISTS prep_worker_ready_at      timestamptz,
  ADD COLUMN IF NOT EXISTS prep_concierge_nudged_at  timestamptz;

COMMENT ON COLUMN project_meeting_summaries.prep_readiness_score IS
  'MTG Prep Worker が計算した準備度合い 0-100。80↑=緑(準備OK) / 50-79=黄(もう一押し) / <50=赤(まだ何もない)。重み: アジェンダ30+持参資料25+前回next_actions消化20+相手側コンテキスト15+アサイン明確10。設計正本 pwa/spec/3-3-meeting-flow-current-spec.md「MTG Prep Worker」節。';
COMMENT ON COLUMN project_meeting_summaries.prep_readiness_reasons IS
  'prep_readiness_score の内訳 jsonb。例: {"agenda":{"score":25,"max":30,"note":"Notion page あり、章立て確認済"},"docs":{"score":18,"max":25,"note":"...","items":[...]}, ...}';
COMMENT ON COLUMN project_meeting_summaries.prep_draft_md IS
  'Worker が生成した着地点 / 背景 / 過去同シリーズの流れ / 想定質問 / 持参物 を含む Markdown draft。まさが session に入った時の第一声として読み上げる。本ページ/本資料には自動反映しない。';
COMMENT ON COLUMN project_meeting_summaries.prep_drive_asset_id IS
  'Worker が PJfolder/YYMMDD_MTG名_prep/ 配下に置いた資料 draft の Drive file ID。MTG本資料 (meeting_assets) ではなく draft フォルダ。';
COMMENT ON COLUMN project_meeting_summaries.prep_notion_page_id IS
  'Worker が作成したアジェンダ草案入りの Notion 議事録ページ ID。既存の notion_url に未連携の MTG では、これが cockpit MTGカードの notion_url として表示される。';
COMMENT ON COLUMN project_meeting_summaries.prep_worker_session_id IS
  'Codex Cloud automation run ID。spawner が 1 MTG = 1 run で動的登録した worker run。';
COMMENT ON COLUMN project_meeting_summaries.prep_worker_session_url IS
  'まさが Slack DM / cockpit から tap する Codex Cloud session URL (例: https://codex.cloud.openai.com/runs/{run_id})。worker 終了後も idle session として残り、まさが入ると prep_draft_md を文脈に対話を継続できる。';
COMMENT ON COLUMN project_meeting_summaries.prep_worker_status IS
  'spawning / preparing / ready / failed。spawner spawn 完了 = spawning、worker 文脈ロード中 = preparing、prep_draft_md / drive draft / notion draft / readiness 揃って待機 = ready、起動失敗 = failed。';
COMMENT ON COLUMN project_meeting_summaries.prep_worker_spawned_at IS
  'spawner が worker を Codex Cloud で動的登録した時刻。';
COMMENT ON COLUMN project_meeting_summaries.prep_worker_ready_at IS
  'worker が prep_draft_md / drive draft / notion draft / readiness を upsert して待機状態に到達した時刻。これを基準に nudge cron が拾う。';
COMMENT ON COLUMN project_meeting_summaries.prep_concierge_nudged_at IS
  'つくよみ nudge cron が まさ専用 Slack DM を送信した時刻。重複送信防止に使う。';

-- 探索性向上: ready 待機の MTG を nudge cron が引くための部分 index
CREATE INDEX IF NOT EXISTS idx_pms_prep_worker_ready
  ON project_meeting_summaries (prep_worker_status, meeting_start_at)
  WHERE prep_worker_status = 'ready' AND prep_concierge_nudged_at IS NULL;
