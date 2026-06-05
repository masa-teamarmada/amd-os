-- 130_company_media_storage_bucket.sql
--
-- Private storage bucket for company content media imported from reviewed
-- source systems. media_assets keeps only Supabase Storage paths, not raw
-- Notion file URLs.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'company-media',
  'company-media',
  false,
  52428800,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types,
  updated_at = now();

drop policy if exists company_media_service_role_all on storage.objects;
create policy company_media_service_role_all
  on storage.objects
  for all
  to service_role
  using (bucket_id = 'company-media')
  with check (bucket_id = 'company-media');
