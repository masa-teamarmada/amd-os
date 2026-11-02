-- AION2 recognition alerts are private coordination records for the local monitor.
-- Only the server-side service role can read or change them.
create table public.aion2_verification_alerts (
  id uuid primary key,
  created_at timestamptz not null default now(),
  deadline_at timestamptz,
  slack_channel_id text,
  slack_message_ts text,
  status text not null default 'pending'
    check (status in ('pending', 'acknowledged', 'expired', 'cancelled')),
  acknowledged_at timestamptz,
  finalized_at timestamptz
);

create index aion2_verification_alerts_created_at_idx
  on public.aion2_verification_alerts (created_at desc);

alter table public.aion2_verification_alerts enable row level security;
revoke all on public.aion2_verification_alerts from anon, authenticated;
grant all on public.aion2_verification_alerts to service_role;
