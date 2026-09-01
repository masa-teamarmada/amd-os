-- シーズ評価の加点材料として、経営チームの状況と紹介経路を持てるようにする。
-- AMD は Before Zero で経営機能を外から供給するため、CEO候補の経営経験と、
-- 研究者本人の人脈から経営者が出てきたか (リファラル) は評価に効く。
-- 機微なので研究機関向け公開ビュー (SEED_PUBLIC_VIEW_COLUMNS) には含めない。
alter table public.seeds add column if not exists management_team_note text;
alter table public.seeds add column if not exists referral_note text;

comment on column public.seeds.management_team_note is
  '経営チームの状況。CEO/CTO候補、経営経験、研究者との役割分担。AMD内部のみ。研究機関向け公開ビューには含めない。';
comment on column public.seeds.referral_note is
  '紹介経路・リファラル。誰の紹介で来たか、研究者本人の人脈から経営人材が出ているか。AMD内部のみ。研究機関向け公開ビューには含めない。';
