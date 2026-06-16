alter table public.projects
  add column if not exists governance_watch_shareholder_meetings boolean not null default false,
  add column if not exists governance_watch_board_meetings boolean not null default false;

comment on column public.projects.governance_watch_shareholder_meetings is
  'D-14G governance sweep: search this project report_emails for shareholder meeting / general meeting signals.';

comment on column public.projects.governance_watch_board_meetings is
  'D-14G governance sweep: search this project report_emails for board meeting / written resolution signals.';

update public.projects
set
  governance_watch_shareholder_meetings = true,
  governance_watch_board_meetings = true,
  updated_at = now()
where project_id in ('p00', 'p07', 'p24');
