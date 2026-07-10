-- proactive_todos: Gmail-origin AMD action requests
-- 2026-07-10

ALTER TABLE public.proactive_todos
  DROP CONSTRAINT IF EXISTS proactive_todos_trigger_check;

ALTER TABLE public.proactive_todos
  ADD CONSTRAINT proactive_todos_trigger_check
  CHECK (trigger_kind IN (
    'meeting_next_action',
    'next_meeting_prep',
    'email_action_request'
  ));

COMMENT ON COLUMN public.proactive_todos.trigger_kind IS
  'meeting_next_action / next_meeting_prep / email_action_request';
