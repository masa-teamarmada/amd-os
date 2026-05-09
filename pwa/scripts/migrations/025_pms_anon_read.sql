-- 025: project_meeting_summaries の SELECT を anon にも開放
--
-- 024 で TO authenticated のみだったが、PWA は anon key で read-only
-- (supabase-data.ts 冒頭のコメント参照: 「PWAからはanon keyでread-only」)
-- → SX cockpit でデータが見えなかった事故 (2026-05-08)。
-- 書き込みは引き続き service_role 経由 (GAS / Edge Function) でのみ。

DROP POLICY IF EXISTS pms_read_authenticated ON project_meeting_summaries;
DROP POLICY IF EXISTS pms_read_anon ON project_meeting_summaries;

CREATE POLICY pms_read_anon
  ON project_meeting_summaries
  FOR SELECT
  TO anon, authenticated
  USING (true);
