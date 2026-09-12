-- 「仮説」と「どれか1つでよい」を別の軸に分ける（まさ確定 2026-09-12）。
--
-- まさ「仮説って、別にどれか１つ立てば足りるってわけじゃないよ。仮説はそれぞれ検証されるべき。
--       一方で、どれか１つが完了すればOKっていう論点もあるわけで、
--       その選択は論点か仮説か、じゃない別の選択が必要だよ」
--
-- これまで contribution（required / alternative）1つで「その行が何か」と
-- 「親がどう解けるか」の両方を表していた。2つに分ける。
--   - question_kind に hypothesis（仮説）を足す。行そのものの種類。
--   - children_logic を親側に持つ。all＝子が全部そろって解ける / any＝どれか1つで解ける。

alter table project_questions
  drop constraint project_questions_question_kind_check;

alter table project_questions
  add constraint project_questions_question_kind_check
  check (question_kind = any (array['open', 'hypothesis', 'decision', 'goal', 'milestone']));

alter table project_questions
  add column if not exists children_logic text not null default 'all';

alter table project_questions
  add constraint project_questions_children_logic_check
  check (children_logic = any (array['all', 'any']));

comment on column project_questions.children_logic is
  'この問いが解けるのに、子が全部そろう必要があるか（all）、どれか1つでよいか（any）。既定は all。まさ確定 2026-09-12';

-- 既存データの引き継ぎ。
-- 1) 子が全部 alternative の親だけ any にする。必須と混ざっている親は all のまま
--    （どちらも要る読みが安全側。1件だけ該当し、まさへ報告する）。
update project_questions p
set children_logic = 'any'
where p.deleted_at is null
  and exists (select 1 from project_questions c
              where c.parent_id = p.id and c.deleted_at is null)
  and not exists (select 1 from project_questions c
                  where c.parent_id = p.id and c.deleted_at is null
                    and c.contribution is distinct from 'alternative');

-- 2) これまで alternative だった行は「仮説」にする。決めることはそのまま。
update project_questions
set question_kind = 'hypothesis'
where deleted_at is null
  and contribution = 'alternative'
  and question_kind = 'open';
