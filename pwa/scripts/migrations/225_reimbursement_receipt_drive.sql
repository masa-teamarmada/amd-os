-- 225: 立替精算の領収書を共有ドライブ a3_backoffice へ二重保存した記録を持つ
--
-- 既存の Supabase Storage (reimbursement-receipts) は一次保管のまま残し、
-- 経理側が Drive だけで完結できるよう Drive 側の file id / link を控える。
-- Drive アップロードは best effort なので、失敗しても申請自体は成立する = 全列 nullable / 既定空配列。

alter table public.reimbursements
  add column if not exists receipt_drive_folder_id text,
  add column if not exists receipt_drive_file_ids jsonb not null default '[]'::jsonb,
  add column if not exists receipt_drive_links jsonb not null default '[]'::jsonb;

comment on column public.reimbursements.receipt_drive_folder_id is
  '領収書を格納した共有ドライブ a3_backoffice/立替精算領収書/<YYYY-MM> フォルダの Drive folder id';
comment on column public.reimbursements.receipt_drive_file_ids is
  'Drive へ複製した領収書ファイルの file id 配列 (receipt_file_names と同順、失敗時は欠ける)';
comment on column public.reimbursements.receipt_drive_links is
  'Drive 領収書の webViewLink 配列 (receipt_drive_file_ids と同順)';
