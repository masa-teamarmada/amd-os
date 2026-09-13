-- 394: コスト試算の作業リスト（2026-09-13 まさFB）
--
-- 「人件費を除くと」の併記はやめ、作業ごとに工数と作業単価を入れて人件費を制御する。
-- 1行 = 1つの作業。年額 = 年間回数 ×（1回の工数 × 作業単価 ＋ 1回の経費）。
--
-- 年間回数は、固定の回数か、試算の物量に連動させる（count_driver）。
--   fixed         … count_per_year をそのまま使う
--   batch         … 年間バッチ数
--   visit         … 訪問回数 = 年間バッチ数 ÷ max(菌体使用回数, 1回の搬入でまかなうバッチ数)
--   module_swap   … モジュール交換回数 = 年間バッチ数 ÷ モジュール耐用バッチ数
--   membrane_swap … 膜交換回数 = 1 ÷ 膜交換年数
-- 作業単価が空欄の行は、前提の共通の作業単価（role_key = labor_rate）を使う。
-- 1回の工数が空欄の行は「未確認」として0時間で計算する。
-- 菌体の製造拠点（scenario = '中央培養'）の作業は第1段の年ごとの固定費に入るので、回数は固定だけを許す。
--
-- 計算は pwa/src/lib/project-cost-model.ts。仕様は pwa/spec/5-13-project-cost-model-current-spec.md。

begin;

create table if not exists project_cost_tasks (
  cost_task_id text primary key,
  cost_model_id text not null references project_cost_models(cost_model_id) on delete cascade,
  -- 中央培養 = 顧客工場ではなく、SX側の1拠点でまとめて菌体を育てる「菌体の製造拠点」
  scenario text not null
    check (scenario in ('循環', '投入', '共通', '中央培養')),
  strain text check (strain is null or strain in ('enhanced', 'wild')),
  application text check (application is null or application in ('dye', 'metal')),
  group_label text,
  label text not null,
  hours_per_occurrence numeric check (hours_per_occurrence is null or hours_per_occurrence >= 0),
  count_driver text not null default 'fixed'
    check (count_driver in ('fixed', 'batch', 'visit', 'module_swap', 'membrane_swap')),
  count_per_year numeric check (count_per_year is null or count_per_year >= 0),
  hourly_rate numeric check (hourly_rate is null or hourly_rate >= 0),
  expense_per_occurrence numeric not null default 0 check (expense_per_occurrence >= 0),
  confidence text check (confidence is null or confidence in ('S', 'A', 'B', 'C', 'H')),
  source_kind text
    check (source_kind is null or source_kind in ('先生回答', '予測', '推測', '仮置き', '推定', '要検証', '実測', '出所不明', '資料記載')),
  owner text,
  note text,
  visibility text not null default 'amd_internal'
    check (visibility in ('amd_internal', 'workspace_shared')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_cost_tasks_central_fixed_check
    check (scenario <> '中央培養' or count_driver = 'fixed'),
  constraint project_cost_tasks_fixed_count_check
    check (count_driver <> 'fixed' or count_per_year is not null)
);

create index if not exists project_cost_tasks_model_idx
  on project_cost_tasks(cost_model_id, sort_order);

alter table project_cost_tasks enable row level security;

-- project_cost_items と同じ形: read = ログイン済みAMDメンバー、write = admin、service_role は全権。
drop policy if exists project_cost_tasks_member_read on project_cost_tasks;
drop policy if exists project_cost_tasks_admin_all on project_cost_tasks;
drop policy if exists project_cost_tasks_service_role on project_cost_tasks;
create policy project_cost_tasks_member_read on project_cost_tasks
  for select to authenticated using (amd_os_is_member());
create policy project_cost_tasks_admin_all on project_cost_tasks
  for all to authenticated using (is_admin()) with check (is_admin());
create policy project_cost_tasks_service_role on project_cost_tasks
  for all to service_role using (true) with check (true);

comment on table project_cost_tasks is 'コスト試算の作業リスト。年額 = 年間回数 ×（1回の工数 × 作業単価 ＋ 1回の経費）。migration 394';
comment on column project_cost_tasks.count_driver is '年間回数の決め方。fixed=固定 / batch=年間バッチ数 / visit=訪問回数 / module_swap=モジュール交換回数 / membrane_swap=膜交換回数';
comment on column project_cost_tasks.hours_per_occurrence is '1回の工数（人時）。null は未確認で0時間として計算する';
comment on column project_cost_tasks.hourly_rate is '作業単価（円/時）。null は前提の共通の作業単価（labor_rate）を使う';
comment on column project_cost_tasks.expense_per_occurrence is '1回あたりの経費（車両費・部材・外注費など、円）';

commit;
