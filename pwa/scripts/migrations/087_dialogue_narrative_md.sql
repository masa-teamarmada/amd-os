-- 087_dialogue_narrative_md.sql
-- 提案前の論点整理セッション (= source_kinds='dialogue') の議事録を、初めて読む人でも
-- 背景 → 議論プロセス → 提案 → 残課題 が分かる narrative として保存する列。
-- decided / progress / next_actions / risks 配列とは別に、LLM 生成の markdown narrative を
-- 1 本のストーリーとして保持する。

ALTER TABLE project_meeting_summaries
  ADD COLUMN IF NOT EXISTS narrative_md TEXT;

COMMENT ON COLUMN project_meeting_summaries.narrative_md IS
  'dialogue meeting (= 提案前の論点整理セッション) を初見でも追えるよう、background / discussion / proposal / open_questions の 4 セクションを Markdown で書いた narrative。dialogue 以外の meeting では基本 NULL。LLM 経由で生成し、まさが編集すれば確定値とする。';
