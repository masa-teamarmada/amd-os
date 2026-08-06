-- 週次管制の「状態」に手入力専用の未着手を追加する。
-- deriveMilestoneStatus は not_started を生成しない = 人が「まだ着手していない」と宣言した時だけ入る値。
ALTER TABLE public.project_management_milestones
  DROP CONSTRAINT IF EXISTS project_management_milestones_status_check;
ALTER TABLE public.project_management_milestones
  ADD CONSTRAINT project_management_milestones_status_check
  CHECK (status IN ('not_started', 'unassessed', 'on_track', 'attention', 'at_risk', 'blocked', 'completed'));

ALTER TABLE public.project_management_tasks
  DROP CONSTRAINT IF EXISTS project_management_tasks_status_check;
ALTER TABLE public.project_management_tasks
  ADD CONSTRAINT project_management_tasks_status_check
  CHECK (status IN ('not_started', 'unassessed', 'on_track', 'attention', 'at_risk', 'blocked', 'completed'));
