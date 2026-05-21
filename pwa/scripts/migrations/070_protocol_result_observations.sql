create table if not exists public.protocol_result_observations (
  id uuid primary key default gen_random_uuid(),
  protocol_id text not null references public.protocols(protocol_id) on delete cascade,
  protocol_example_id uuid references public.protocol_examples(id) on delete cascade,
  project_id text references public.projects(project_id),
  observed_on date not null,
  horizon text not null default 'immediate'
    check (horizon in ('immediate', '1m', '3m', '6m', '12m', '24m', 'long_term')),
  valence text not null default 'mixed'
    check (valence in ('positive', 'negative', 'mixed', 'neutral', 'unknown')),
  confidence text not null default 'medium'
    check (confidence in ('low', 'medium', 'high')),
  summary text not null,
  evidence_source_type text,
  evidence_source_id text,
  evidence_url text,
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists idx_protocol_result_observations_protocol
  on public.protocol_result_observations (protocol_id, observed_on desc);

create index if not exists idx_protocol_result_observations_example
  on public.protocol_result_observations (protocol_example_id, observed_on desc);

comment on table public.protocol_result_observations is
  'Temporal outcome ledger for AMD protocol examples. Results are observations over time, not a single overwritten verdict.';
