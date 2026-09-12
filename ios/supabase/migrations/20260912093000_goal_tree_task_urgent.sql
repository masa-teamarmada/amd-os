-- タスクタブ（OSスイートの「やること」と同じ設計）
-- 正本: masa/ORCHESTRATION_APP_DESIGN.md と orchestration-board の Todo 実装。
-- あちらの todo_items が持つ urgent（緊急）を、PJのTODO側にも持たせる。
-- 他の列は既存で足りる: title / detail(note) / status+actual_end(completed_at) /
-- sort_order（手動並び替え）。
alter table public.project_actions
  add column if not exists urgent boolean not null default false;

create index if not exists project_actions_urgent_idx
  on public.project_actions (project_id, urgent)
  where urgent = true and deleted_at is null;
