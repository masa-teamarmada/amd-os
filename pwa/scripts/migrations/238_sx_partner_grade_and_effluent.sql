-- 238: 関係先の顧客評価グレードと排液プロファイル、やり取り履歴の本文保存
--
-- 背景 (2026-08-06 まさ判断):
--   PoC実現可能性と顧客有望度の2軸から合成していた優先度は、
--   「排液がもらえるか」を過大評価していた。まさの判断基準は
--   「顧客として見込みがあるか」が第一優先で、軸は (1) ペインの高さ
--   (2) 単価の高い（需要の高い）重金属が排出されているか の2つ。
--   排液提供の可否はそれより大幅に劣後する。
--   よって合成ではなく、独立した評価カラム poc_grade を持たせて
--   関係先リストの最左に置く。s / a / b / x の4値 + null(未評価)。
--
--   あわせて判断根拠となる排液プロファイル（成分・年間排出量・年間処理コスト）を
--   関係先の列として持たせる。単位や表記が企業ごとに揺れるため text で保持し、
--   議事録の表現をそのまま残せるようにする。
--
--   議事録本文は既存の「やり取り履歴」に紐づけて全文保存する。
--   共有リンク（plaud等）は期限切れで消えるため、source_ref だけでは残らない。

alter table project_management_partners
  add column if not exists poc_grade text
    check (poc_grade in ('s', 'a', 'b', 'x')),
  add column if not exists effluent_components text,
  add column if not exists effluent_volume_annual text,
  add column if not exists effluent_cost_annual text;

comment on column project_management_partners.poc_grade is
  '顧客としての見込み評価。s/a/b/x、null は未評価。ペインの高さと単価の高い重金属の有無で判断し、排液提供の可否は劣後させる。';
comment on column project_management_partners.effluent_components is '排液中の成分（議事録表現のまま保持）';
comment on column project_management_partners.effluent_volume_annual is '年間の排液排出量（単位込みのテキスト）';
comment on column project_management_partners.effluent_cost_annual is '排液処理にかけている年間コスト（単位込みのテキスト）';

alter table project_management_partner_interactions
  add column if not exists detail_md text;

comment on column project_management_partner_interactions.detail_md is
  '議事録など接点の本文。外部共有リンクが失効しても内容が残るよう全文を保存する。';
