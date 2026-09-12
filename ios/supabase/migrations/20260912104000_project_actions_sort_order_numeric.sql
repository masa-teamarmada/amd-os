-- タスクの手動並べ替え（OSスイートの「やること」と同じ方式）。
-- あちらは sort_order が Double で、動かした1行だけ「前後の中点」に書き換える。
-- 整数のままだと中点が取れず、動かすたびに周り全部を振り直すことになるので型を合わせる。
-- 既存の値（10刻み）はそのまま。10 と 20 のあいだに 15 が入るようになるだけ。
alter table public.project_actions
  alter column sort_order type numeric using sort_order::numeric;
