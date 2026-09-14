-- 418: SX 技術タブ「対象にできる物質」の色素・染料の行 (pte_sx_e13) の数値欄に残っていた目標値 (90% 以上) を、条件の文へ移す。
-- 417 で値を「○ 様々な着色廃液で透明化を確認 (ラボ)」に直したとき、数値欄 (value_min = 90, unit = %) を消し忘れ、
-- 画面に「90% 以上 (○ 様々な着色廃液で透明化を確認 (ラボ))」と出て、90% を実測したように読めた (本番の画面で見つけた)。
-- 90% は 2026-02-28 の戦略案の技術目標 (メチレンブルーの脱色率、30分以内) で、実測ではない。
-- 417 のあとに誰かが書き換えていたら何もせずに止める。
begin;
do $do$ begin
  if not exists (
    select 1 from project_tech_entries
    where tech_entry_id = 'pte_sx_e13' and project_id = 'p21'
      and updated_at = timestamptz '2026-09-14 07:27:36.617204+00'
      and value_min = 90 and value_max is null and unit = '%'
  ) then
    raise exception '色素・染料の行が 417 のあとに書き換えられている';
  end if;
end $do$;
update project_tech_entries
set value_min = null,
    unit = null,
    condition_text = $t$目標はメチレンブルーの脱色率90%以上・30分以内 (2026-02-28 の戦略案)。モデル色素は15分で濃度が半分 (事業概要 v1.7)。実廃液は染色3種・食品2試料などをラボで評価$t$,
    updated_by = 'amie',
    updated_at = now()
where tech_entry_id = 'pte_sx_e13' and project_id = 'p21';
commit;
