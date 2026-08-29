-- 326_project_cost_notes.sql
-- コスト試算タブに、数字そのものではない「読むために要る文章」を持たせる。
--
-- 320〜325 では変数・明細・確認事項しか持てず、原典スプレッドシートにあった次が落ちていた:
--   - ②シートの「見る意味」列 (各指標が何を見るためのものか)
--   - 投資回収を保留にした理由と、次段階での2分割の設計方針
--   - ③シートの注記行 (撹拌機の扱い / 3層の寿命概念 / オンライン濃度計 / 供給先按分の注意)
-- あわせて、外部ベンチマークの出典と、版が変わったときの落差もここへ置く。
--
-- section で描画位置が決まる:
--   caveat        … 注意して読むところ (表の手前)
--   benchmark     … 外部ベンチマークと出典 (成立ラインの近く)
--   reading_guide … この表の読み方 (サマリー表の後)
--   history       … 版の履歴 (末尾)

BEGIN;

create table if not exists project_cost_notes (
  cost_note_id text primary key,
  cost_model_id text not null references project_cost_models(cost_model_id) on delete cascade,
  section text not null
    check (section in ('caveat', 'benchmark', 'reading_guide', 'history')),
  title text not null,
  body_md text,
  source_url text,
  source_label text,
  visibility text not null default 'amd_internal'
    check (visibility in ('amd_internal', 'workspace_shared')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_cost_notes_model_idx
  on project_cost_notes(cost_model_id, section, sort_order);

alter table project_cost_notes enable row level security;

drop policy if exists project_cost_notes_member_read on project_cost_notes;
drop policy if exists project_cost_notes_admin_all on project_cost_notes;
drop policy if exists project_cost_notes_service_role on project_cost_notes;
create policy project_cost_notes_member_read on project_cost_notes
  for select to authenticated using (amd_os_is_member());
create policy project_cost_notes_admin_all on project_cost_notes
  for all to authenticated using (is_admin()) with check (is_admin());
create policy project_cost_notes_service_role on project_cost_notes
  for all to service_role using (true) with check (true);

COMMIT;
