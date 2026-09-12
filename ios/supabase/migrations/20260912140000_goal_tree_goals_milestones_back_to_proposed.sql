-- 2026-09-11 にえいみが作った到達点とMS 16行を、承認待ちへ戻す。
-- まさ確定 2026-09-12「えいみに入れてもらう場合には、おれが承認してから追加にしないとだめだ」
-- 「１つずつOS上で承認すればいいだけじゃないの？」
--
-- 位置は動かさない。parent_id と contribution はそのまま残したうえで、
-- 承認時に同じ値へ戻るよう proposed_parent_id / proposed_contribution へ写す
-- （proposal_accept は parent_id = proposed_parent_id を書くため、写さないと
--  承認した瞬間にMSが根へ飛ぶ）。
-- 反映前の全16行は Drive の
-- p21_sx/260911_ゴールツリー移行前のスナップショット/260912_到達点MSを提案へ戻す前の16行.json
-- に退避済み。

update project_questions
set review_state = 'proposed',
    proposed_parent_id = parent_id,
    proposed_contribution = contribution,
    proposal_reason = '2026-09-11 にえいみがシーズンの到達点・MSとして起票した。まさの承認待ち'
where deleted_at is null
  and created_at >= '2026-09-11'
  and question_kind in ('goal', 'milestone')
  and review_state = 'accepted';
