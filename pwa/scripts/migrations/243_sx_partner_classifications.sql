-- 243: 関係先の「分類」を複数選択にする
--
-- 背景 (2026-08-08 まさ指示):
--   関係先リストのタブ分け(旧「表示」)を「分類」と改名し、「技術協力先」タブを追加する。
--   1社が「PoC候補先かつ技術協力先」のように複数の分類へ属せるよう、単一値の
--   poc_category に代わって text[] の classifications を分類の正本にする。
--   既存データは poc_category と VC role (shareholder_investor) から backfill する。
--   poc_category 列は後方互換のため残し、API が classifications の先頭のPoC系値を
--   同期して書き込む (読み手の旧コードを壊さない)。

alter table project_management_partners
  add column if not exists classifications text[] not null default '{}'
    check (classifications <@ array['poc_candidate','tech_partner','sample_provider','sample_route','vc']::text[]);

-- 既存の単一区分をそのまま分類へ引き継ぐ
update project_management_partners
set classifications = array[poc_category]
where poc_category is not null and classifications = '{}';

-- VC role を持つ関係先へ 'vc' 分類を付与する
update project_management_partners p
set classifications = p.classifications || '{vc}'
where exists (
  select 1 from project_management_partner_roles r
  where r.partner_id = p.id and r.role_kind = 'shareholder_investor'
) and not ('vc' = any(p.classifications));
