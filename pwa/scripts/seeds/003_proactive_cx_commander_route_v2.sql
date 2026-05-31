-- Align CX proactive routing with the active CX commander thread.
-- Older CX commander threads became unavailable / errored, while the outbox
-- state has already been recovered. This seed only updates the future route.

update public.project_commander_threads
set
  commander_thread_id = '019e7e30-fb87-7c90-a133-659222d400d6',
  thread_label = 'CX司令塔',
  status = 'active',
  updated_at = now()
where project_id = 'p20'
  and institution_id = 'inst_nims';
