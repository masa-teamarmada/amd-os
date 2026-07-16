-- 173_private_wiki_person_context_fields.sql
--
-- Add structured private person-context fields to the admin-only private wiki.
-- Existing tags are intentionally kept for compatibility, but the PWA UI/API no
-- longer uses them as the editing/filtering surface.

alter table public.private_wiki_entries
  add column if not exists birthday_label text,
  add column if not exists origin_label text,
  add column if not exists residence_label text,
  add column if not exists contact_context text,
  add column if not exists family_note text,
  add column if not exists taboo_note text;

comment on column public.private_wiki_entries.birthday_label is
  'Short birthday label for private relationship context. Text is used because year/month/day may be partial.';
comment on column public.private_wiki_entries.origin_label is
  'Private origin or hometown label. Admin-only; do not expose to public profiles.';
comment on column public.private_wiki_entries.residence_label is
  'Private current residence label. Admin-only; do not expose to public profiles.';
comment on column public.private_wiki_entries.contact_context is
  'Private note about where/how AMD knows this person and useful touchpoints.';
comment on column public.private_wiki_entries.family_note is
  'Private family context note. Keep minimal and admin-only.';
comment on column public.private_wiki_entries.taboo_note is
  'Private taboo / sensitive-topic note. Keep minimal and admin-only.';
