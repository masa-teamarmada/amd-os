alter table public.projects
  add column if not exists project_type text not null default 'standard',
  add column if not exists fee_type text,
  add column if not exists fee_amount numeric,
  add column if not exists invoice_send_deadline_rule text,
  add column if not exists payment_due_rule text,
  add column if not exists invoice_send_manual boolean not null default false,
  add column if not exists invoice_to_emails text,
  add column if not exists invoice_cc_emails text,
  add column if not exists invoice_bcc_emails text;

update public.projects
set project_type = 'standard'
where project_type is null;
