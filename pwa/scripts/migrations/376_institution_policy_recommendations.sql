-- 376_institution_policy_recommendations.sql
-- /institutions「支援プログラム比較」タブの下段に出す、AMDが規程類へ盛り込むべき論点と推奨の台帳。
-- 論点は比較表の列 (institution_policy_items) に紐づけ、統計 (整備済み機関数など) は
-- institution_policy_assessments から画面が自動計算する。推奨文・条件・根拠はここが正本で、
-- adminが画面から編集する (LLMや設計文書にハードコードしない)。

create table if not exists institution_policy_recommendations (
  recommendation_id text primary key,
  policy_item_id text references institution_policy_items(policy_item_id) on delete set null,
  topic text not null,
  stance text not null default 'open'
    check (stance in ('recommend', 'conditional', 'not_recommend', 'open')),
  recommendation text not null,
  conditions text,
  rationale text,
  evidence_note text,
  stat_note text,
  sort_order int not null default 100,
  is_active boolean not null default true,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_institution_policy_recommendations_order
  on institution_policy_recommendations(sort_order)
  where is_active;

alter table institution_policy_recommendations enable row level security;

drop policy if exists institution_policy_recommendations_member_read on institution_policy_recommendations;
drop policy if exists institution_policy_recommendations_admin_all on institution_policy_recommendations;
drop policy if exists institution_policy_recommendations_service_role on institution_policy_recommendations;

create policy institution_policy_recommendations_member_read
  on institution_policy_recommendations for select to authenticated using (amd_os_is_member());
create policy institution_policy_recommendations_admin_all
  on institution_policy_recommendations for all to authenticated using (is_admin()) with check (is_admin());
create policy institution_policy_recommendations_service_role
  on institution_policy_recommendations for all to service_role using (true) with check (true);

comment on table institution_policy_recommendations is
  'AMDが大学発SU関連規程へ盛り込むべき論点と推奨。/institutions 支援プログラム比較タブ下段。統計は institution_policy_assessments から画面が算出する。';
