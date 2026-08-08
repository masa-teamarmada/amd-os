-- 237: 関係先台帳へ「PoC実現可能性」「顧客有望度」の判断2軸を追加する。
-- 既存のconfidenceは情報の確からしさ(確認済み/推定/要確認/未確認)であって商談の見込みではないため、
-- 見込み判断をconfidenceへ相乗りさせず独立した列にする (2026-08-06 まさ指摘)。
-- 値は high / medium / low のみ。未評価はNULLで表し、推測で埋めない。

alter table project_management_partners
  add column if not exists poc_likelihood text
    check (poc_likelihood in ('high', 'medium', 'low')),
  add column if not exists customer_value text
    check (customer_value in ('high', 'medium', 'low')),
  add column if not exists value_note text;

comment on column project_management_partners.poc_likelihood is
  'PoCを実施させてもらえる可能性。high/medium/low、未評価はNULL。confidence(情報の確からしさ)とは別軸。';
comment on column project_management_partners.customer_value is
  '顧客としての有望度(支払意欲・回収価値)。high/medium/low、未評価はNULL。';
comment on column project_management_partners.value_note is
  '有望度・実現可能性をそう判断した理由の1行メモ。例: 排液処理が生産量のボトルネック。';
