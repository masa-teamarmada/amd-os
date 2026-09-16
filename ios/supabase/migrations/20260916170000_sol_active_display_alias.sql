-- p21の現行台帳に残る旧略称を、表示用の現行略称SOLへそろえる。
-- 内部キー、source_ref、接点履歴・証跡の原題は履歴として保持する。
BEGIN;

UPDATE public.project_management_partners
SET
  owner_label = replace(owner_label, 'SX', 'SOL'),
  current_ball_owner = replace(current_ball_owner, 'SX', 'SOL'),
  next_ball_owner = replace(next_ball_owner, 'SX', 'SOL'),
  agreed_scope = replace(agreed_scope, 'SX', 'SOL'),
  next_commitment = replace(next_commitment, 'SX', 'SOL'),
  target_state = replace(target_state, 'SX', 'SOL'),
  updated_at = now()
WHERE project_id = 'p21'
  AND deleted_at IS NULL
  AND concat_ws('', owner_label, current_ball_owner, next_ball_owner, agreed_scope, next_commitment, target_state) LIKE '%SX%';

UPDATE public.project_management_partner_commitments
SET
  owner_label = replace(owner_label, 'SX', 'SOL'),
  sx_owner = replace(sx_owner, 'SX', 'SOL'),
  updated_at = now()
WHERE project_id = 'p21'
  AND deleted_at IS NULL
  AND concat_ws('', owner_label, sx_owner) LIKE '%SX%';

UPDATE public.project_management_partner_work_items
SET
  handoff_to = replace(handoff_to, 'SX', 'SOL'),
  owner_label = replace(owner_label, 'SX', 'SOL'),
  completion_criteria = replace(completion_criteria, 'SX', 'SOL'),
  updated_at = now()
WHERE project_id = 'p21'
  AND deleted_at IS NULL
  AND concat_ws('', handoff_to, owner_label, completion_criteria) LIKE '%SX%';

UPDATE public.project_management_action_items
SET owner_label = replace(owner_label, 'SX', 'SOL'), updated_at = now()
WHERE project_id = 'p21' AND deleted_at IS NULL AND owner_label LIKE '%SX%';

UPDATE public.project_management_decisions
SET
  owner_label = replace(owner_label, 'SX', 'SOL'),
  context = replace(context, 'SX', 'SOL'),
  updated_at = now()
WHERE project_id = 'p21'
  AND deleted_at IS NULL
  AND concat_ws('', owner_label, context) LIKE '%SX%';

UPDATE public.project_management_issues
SET
  owner_label = replace(owner_label, 'SX', 'SOL'),
  background = replace(background, 'SX', 'SOL'),
  updated_at = now()
WHERE project_id = 'p21'
  AND deleted_at IS NULL
  AND concat_ws('', owner_label, background) LIKE '%SX%';

UPDATE public.project_management_hypotheses
SET owner_label = replace(owner_label, 'SX', 'SOL'), updated_at = now()
WHERE project_id = 'p21' AND deleted_at IS NULL AND owner_label LIKE '%SX%';

DO $$
DECLARE residual_count integer;
BEGIN
  SELECT count(*) INTO residual_count
  FROM public.project_management_partners
  WHERE project_id = 'p21' AND deleted_at IS NULL
    AND concat_ws('', owner_label, current_ball_owner, next_ball_owner, agreed_scope, next_commitment, target_state) LIKE '%SX%';
  IF residual_count <> 0 THEN
    RAISE EXCEPTION 'SOL active partner display alias migration incomplete: % residual rows', residual_count;
  END IF;
END $$;

COMMIT;
