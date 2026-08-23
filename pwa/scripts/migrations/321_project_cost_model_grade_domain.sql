-- 321_project_cost_model_grade_domain.sql
-- 260820シートが実際に使っている確度グレード (A/B/C/H) と出所 (推測) を受け入れる。
-- 当初 S/A/H を想定したが、正本側のグレード体系に合わせる。
alter table project_cost_assumptions drop constraint if exists project_cost_assumptions_confidence_check;
alter table project_cost_items drop constraint if exists project_cost_items_confidence_check;
alter table project_cost_assumptions add constraint project_cost_assumptions_confidence_check
  check (confidence is null or confidence in ('S','A','B','C','H'));
alter table project_cost_items add constraint project_cost_items_confidence_check
  check (confidence is null or confidence in ('S','A','B','C','H'));
alter table project_cost_assumptions drop constraint if exists project_cost_assumptions_source_kind_check;
alter table project_cost_items drop constraint if exists project_cost_items_source_kind_check;
alter table project_cost_assumptions add constraint project_cost_assumptions_source_kind_check
  check (source_kind is null or source_kind in ('先生回答','予測','推測','仮置き','推定','要検証','実測','出所不明'));
alter table project_cost_items add constraint project_cost_items_source_kind_check
  check (source_kind is null or source_kind in ('先生回答','予測','推測','仮置き','推定','要検証','実測','出所不明'));
