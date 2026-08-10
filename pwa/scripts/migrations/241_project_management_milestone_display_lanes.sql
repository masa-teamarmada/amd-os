-- 241: MS を複数のガントグループ（レーン）にまたがって表示できるようにする。
--
-- これまで MS の表示レーンは track（= 接続する成果のトラック）だけで決まっていたため、
-- 「事業開発と技術開発の両方にかかるゲート」を 1 件の MS として置けなかった。
-- display_lane_keys が NULL / 空のときは従来どおり track から導出する（既存行は無変更）。
alter table public.project_management_milestones
  add column if not exists display_lane_keys text[];

alter table public.project_management_milestones
  drop constraint if exists project_management_milestones_display_lane_keys_check;

alter table public.project_management_milestones
  add constraint project_management_milestones_display_lane_keys_check
  check (
    display_lane_keys is null
    or display_lane_keys <@ array['business_development', 'technology_development', 'organization']::text[]
  );

comment on column public.project_management_milestones.display_lane_keys is
  'ガントで MS を表示するグループ（レーン）キーの配列。NULL/空なら track から導出する既定挙動。';
