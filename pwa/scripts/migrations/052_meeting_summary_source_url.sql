-- 052_meeting_summary_source_url.sql
--
-- project_meeting_summaries.source_url を追加。
-- Slack スレッド URL / Drive 議事録ファイル URL / Calendar event URL 等、
-- ソースに依らない一般化 URL を入れるための列 (= notion_url は Notion 議事録専用に固定)。

ALTER TABLE project_meeting_summaries
  ADD COLUMN IF NOT EXISTS source_url TEXT NULL;

COMMENT ON COLUMN project_meeting_summaries.source_url IS
  'ソースに依存しない議事録 URL。Slack permalink / Drive file URL / Calendar event URL 等。
   Notion 由来は notion_url を優先使用 (legacy 列、Notion 限定)。';
