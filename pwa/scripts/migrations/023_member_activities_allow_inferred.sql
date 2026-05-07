-- 023: member_activities.source の check 制約に 'inferred' / 'manual' / 'cron_l2_extract' を追加
--
-- 旧 check は ['slack','notion','gmail','gmeet','drive'] のみ許容だが、
-- cron `member-activities` route は LLM 推論結果を 'inferred' として書き込むため
-- check 違反でずっと 0 件しか書けなかった。

alter table member_activities drop constraint if exists member_activities_source_check;
alter table member_activities add constraint member_activities_source_check
  check (source = ANY (ARRAY[
    'slack'::text, 'notion'::text, 'gmail'::text, 'gmeet'::text, 'drive'::text,
    'inferred'::text, 'manual'::text, 'cron_l2_extract'::text
  ]));
