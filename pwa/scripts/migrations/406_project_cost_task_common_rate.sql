-- 406: コスト試算の作業ごとの作業単価（project_cost_tasks.hourly_rate）を使わない形にする（2026-09-14 まさFB）
--
-- まさ「工数単価は共通で１つのパラメータで入力するようにして。現状だと工程ごとに単価を決める仕様になっているけど、それぞれで変えることは想定してないので」。
-- 作業の年額は、前提の共通の作業単価（role_key labor_rate）の1つだけで出す。画面と API は hourly_rate を読まず、書かせない。
--   - hourly_rate は空欄（null）だけを許す。適用前に全行が空欄であることを確かめた（作業の行を持つ試算は SX の1件、18行）
--   - 列は残す。値を持たない列なので、消さなくても計算と画面には効かない
--
-- 既存の行は変えない（総コストは変わらない）。SX のデータの並べ直しは 407。
-- 計算は pwa/src/lib/project-cost-model.ts。仕様は pwa/spec/5-13-project-cost-model-current-spec.md。

begin;

alter table project_cost_tasks drop constraint if exists project_cost_tasks_hourly_rate_check;
alter table project_cost_tasks add constraint project_cost_tasks_hourly_rate_check
  check (hourly_rate is null);

comment on column project_cost_tasks.hourly_rate is '使わない（常に空欄）。作業単価は前提の共通の作業単価（role_key labor_rate）の1つだけで、作業ごとには持たない（2026-09-14 まさ）。migration 406';

commit;
