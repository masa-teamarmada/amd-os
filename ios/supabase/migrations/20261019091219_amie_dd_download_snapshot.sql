-- NULL follows the editable edition. A saved release serves cached files only.
alter table public.dd_report_editions add column download_snapshot jsonb;
alter table public.dd_report_editions add constraint dd_report_download_snapshot_shape check (
 download_snapshot is null or (
  jsonb_typeof(download_snapshot)='object'
  and coalesce(download_snapshot->>'documentVersion' ~ '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$',false)
  and coalesce(download_snapshot->>'revision' ~ '^[1-9][0-9]*$',false)
  and coalesce(download_snapshot->>'sourceSha256' ~ '^[a-f0-9]{64}$',false)
  and coalesce(download_snapshot->>'layoutVersion' ~ '^layout-v[1-9][0-9]*$',false)
  and coalesce(length(download_snapshot->>'title')>0,false)
 )
);
