-- まさ確定 2026-09-12「タスクとかゴールツリーは、おれが自分で入れないといけない。
-- えいみに入れてもらう場合には、おれが承認してから追加にしないとだめだ」
-- → まさが手で入れたのではない行（前の管理表から機械で移した／議事録／つくよみ）を
--   「提案」へ戻す。承認するまで木にもタスクにもガントにも出ない。
-- 木への紐づけは消さず proposed_question_id へ写し、承認で元の場所へ戻す。
-- 変更前の全行は Drive（p21_sx/260911_ゴールツリー移行前のスナップショット/
-- 260912_提案へ戻す前の全行.json）へ退避済み。

update public.project_actions a
   set proposed_question_id = coalesce(a.proposed_question_id, sub.question_id)
  from (
    select distinct on (action_id) action_id, question_id
    from public.project_question_actions
    order by action_id, question_id
  ) sub
 where a.id = sub.action_id
   and a.deleted_at is null
   and a.review_state = 'accepted'
   and a.origin_kind <> 'manual';

update public.project_actions
   set review_state = 'proposed',
       proposal_reason = coalesce(
         proposal_reason,
         case origin_kind
           when 'migrated' then '前の管理表から機械で移した行。まさの承認を経ていないので提案へ戻した（2026-09-12）'
           when 'meeting' then '議事録から入った行。まさの承認を経ていないので提案へ戻した（2026-09-12）'
           when 'automation' then 'つくよみが拾った行。まさの承認を経ていないので提案へ戻した（2026-09-12）'
           else 'まさの承認を経ていないので提案へ戻した（2026-09-12）'
         end)
 where deleted_at is null
   and review_state = 'accepted'
   and origin_kind <> 'manual';
