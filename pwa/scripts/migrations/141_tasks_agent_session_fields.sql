-- 141_tasks_agent_session_fields.sql
--
-- Codex / Claude Code のえいみが会話中に発生した作業を `/tasks` へ登録し、
-- どのAIセッションで進行しているかをOS上で辿れるようにする。
-- 既存 task row は維持し、非破壊の列追加と参照用 index だけを行う。

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS agent_kind text,
  ADD COLUMN IF NOT EXISTS agent_session_id text,
  ADD COLUMN IF NOT EXISTS agent_session_url text,
  ADD COLUMN IF NOT EXISTS agent_session_label text;

CREATE INDEX IF NOT EXISTS idx_tasks_agent_session
  ON public.tasks(agent_kind, agent_session_id)
  WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_tasks_source_active
  ON public.tasks(task_source, active);

COMMENT ON COLUMN public.tasks.agent_kind IS
  'AI/operator surface that registered or is driving the task, e.g. codex, claude_code, agent.';

COMMENT ON COLUMN public.tasks.agent_session_id IS
  'Codex / Claude Code session or thread id associated with the current task work.';

COMMENT ON COLUMN public.tasks.agent_session_url IS
  'Optional URL/protocol link for opening the associated AI session.';

COMMENT ON COLUMN public.tasks.agent_session_label IS
  'Human-readable label for the associated AI session link.';
