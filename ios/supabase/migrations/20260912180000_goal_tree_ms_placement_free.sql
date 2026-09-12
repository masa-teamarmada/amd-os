-- MSの置き場所の縛りを外す（まさ確定 2026-09-12）。本番へは MCP で反映済み。記録として残す。
--
-- まさ「営利100億はMSに存在しなくない？ MSにしないで。MSにしちゃってるから、出資の確約のMSに
--       ネストできない」「それぞれの項目ごとに論点、仮説、TODOと選べるところにMSを追加して、
--       自分でMSかどうか決められるようにして」
--
-- これまで「MSは到達点の直下だけ」をtriggerで縛っていた。そのせいでMSの下にMSを置けず、
-- ある行をMSにするかどうかを人が決められなかった。縛りを外し、どの行でもMSにできるようにする。
-- 「到達点は根だけ」の CHECK（project_questions_goal_is_root）はそのまま残す。

drop trigger if exists project_questions_goal_tree_placement on project_questions;
drop function if exists assert_goal_tree_placement();

update project_questions
set question_kind = 'open'
where id = '21000000-2026-4000-8000-000000009101';
