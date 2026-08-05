-- 立替精算の未承認リマインド (24時間ごとの再送信) 用の列。
-- reminder_last_sent_at が null のときは created_at を起点にする。
alter table public.reimbursements
  add column if not exists reminder_last_sent_at timestamptz,
  add column if not exists reminder_sent_count integer not null default 0;
