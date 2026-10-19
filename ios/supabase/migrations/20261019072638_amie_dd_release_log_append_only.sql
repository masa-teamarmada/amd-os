-- Preserve release entries; the application can append and read, not rewrite history.
revoke update,delete,truncate,references,trigger on public.dd_report_releases from service_role;
