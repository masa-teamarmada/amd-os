-- 239: 関係先の「次回面談」欄
--
-- 背景 (2026-08-06 まさ):
--   次回面談が確定したときに、その場で書き込める場所が台帳に無かった。
--   next_commitment（次にやること）と due_date は「こちらが何をするか」の欄で、
--   面談そのものの予定とは別物。訪問前日に見たいのは
--   「いつ・現地かオンラインか・何を持っていくか」の3点なので専用の列にする。
--
--   日時は date + 時刻テキストで持つ。「9月上旬」「午後」のように
--   確定度が揃わない予定が実際に混ざるため、時刻を time 型で縛らない。
--   形式は onsite / online / hybrid / phone の4値 + null(未定)。

alter table project_management_partners
  add column if not exists next_meeting_on date,
  add column if not exists next_meeting_time text,
  add column if not exists next_meeting_mode text
    check (next_meeting_mode in ('onsite', 'online', 'hybrid', 'phone')),
  add column if not exists next_meeting_place text,
  add column if not exists next_meeting_prep text;

comment on column project_management_partners.next_meeting_on is '次回面談の日付。未定なら null。';
comment on column project_management_partners.next_meeting_time is
  '次回面談の開始時刻。「14:00」「午後」など確定度が揃わないためテキストで保持する。';
comment on column project_management_partners.next_meeting_mode is
  '次回面談の形式。onsite(現地訪問)/online/hybrid/phone、null は未定。';
comment on column project_management_partners.next_meeting_place is
  '次回面談の場所。現地なら訪問先、オンラインなら接続先のメモ。';
comment on column project_management_partners.next_meeting_prep is
  '次回面談までに準備すべきもの。持参物・事前送付資料・確認しておく情報。';
