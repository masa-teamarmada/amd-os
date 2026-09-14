-- 421: SX の区分「競合比較」の社外に出す表（既存の方式との星取り表）の出典に、社内の資料名がそのまま入っていたので、読み手に分かる名前へ直す。
-- 凝集沈殿の「汚泥0.5〜2.5kg/m³」の出典が「SX_コスト試算_260716（2026-07-29 市場ヒアリングの整理）」だった（417 の星取り表から 420 で既存の方式の表へ移したマス）。
-- 中身は同じ資料で、名前だけを「水処理の市場ヒアリングの整理（2026-07-29、SolvioraX）」にする。VC に出す PDF の出典の一覧に社内の資料名を出さないため。
-- 420 のあとに誰かが書き換えていたら何もせずに止める。
begin;
do $do$ begin
  if not exists (
    select 1 from project_tech_entries
    where tech_entry_id = 'pte_sx_cmpme_070_02' and project_id = 'p21'
      and source_ref = 'SX_コスト試算_260716（2026-07-29 市場ヒアリングの整理）'
      and updated_at = timestamptz '2026-09-14 08:20:54.193168+00'
  ) then
    raise exception '凝集沈殿の汚泥のマスが 420 のあとに書き換えられている';
  end if;
end $do$;
update project_tech_entries
set source_ref = $t$水処理の市場ヒアリングの整理（2026-07-29、SolvioraX）$t$,
    updated_by = 'amie',
    updated_at = now()
where tech_entry_id = 'pte_sx_cmpme_070_02' and project_id = 'p21';
commit;
