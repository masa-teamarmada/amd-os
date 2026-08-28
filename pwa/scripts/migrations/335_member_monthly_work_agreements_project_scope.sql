-- 335_member_monthly_work_agreements_project_scope.sql
-- 月初合意をPJ単位で成立させる。
--
-- それまでの合意は member × 月 の1件で、参加している全PJをまとめて1回押す形だった。
-- 自分の額が妥当かどうかは、同じ原資を分け合う他の人の額を並べないと判断できないので、
-- そのPJの配分表 (全メンバーの担当・消化pt・発生額・支払額) を見た上でPJごとに合意する
-- (まさ確定 2026-08-28「1人1人が自分の額だけ合意するのではなく、PJごとに合意をするようにしたい」)。
--
-- project_id が NULL の既存行は、PJ単位化する前の member 全体合意として残す。
-- 既存の合意を無効化して全員へ再合意を求めることはしない。

ALTER TABLE public.member_monthly_work_agreements
  ADD COLUMN IF NOT EXISTS project_id text REFERENCES public.projects(project_id);

COMMENT ON COLUMN public.member_monthly_work_agreements.project_id IS
  '合意したPJ。NULL は PJ単位化 (2026-08-28) 前の、member 全体をまとめた合意。';

-- 旧: (ym, member_id) WHERE status='agreed' … member 単位で active な合意は1件
-- 新: (ym, member_id, project_id) … PJ単位で active な合意は1件。旧行は project_id NULL を '*' に畳む
DROP INDEX IF EXISTS public.member_monthly_work_agreements_one_active_agreed;

CREATE UNIQUE INDEX IF NOT EXISTS member_monthly_work_agreements_one_active_agreed
  ON public.member_monthly_work_agreements(ym, member_id, coalesce(project_id, '*'))
  WHERE status = 'agreed';

CREATE INDEX IF NOT EXISTS idx_member_monthly_work_agreements_ym_member_project
  ON public.member_monthly_work_agreements(ym, member_id, project_id);
