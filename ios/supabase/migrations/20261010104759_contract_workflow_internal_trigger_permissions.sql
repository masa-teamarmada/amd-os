-- Trigger helpers are internal. Only server-side service operations may invoke workflow code.
begin;
revoke all on function public.workflow_enqueue_event(), public.workflow_guard_signed_status(), public.workflow_invalidate() from public, anon, authenticated;
grant execute on function public.workflow_enqueue_event(), public.workflow_guard_signed_status(), public.workflow_invalidate() to service_role;
commit;
