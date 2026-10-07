-- 487 applied. Correct the stored fallback to match 円/m³; annual budget remains an assumption.
begin;
select set_config('amd.cost_change_reason','488: 管理配賦の保存単価の単位を訂正。年額1.5億は前提へ保持し、円/m³の明細単価は7.5とする。新しい計算結果は不変。旧クライアントの未対応price_ruleでも年額をm³単価として扱わせない。',true);
do $guard$ begin
  if not exists(select 1 from project_cost_items where cost_item_id='ci_amie_overhead' and unit_price=150000000 and unit_price_unit='円/m³') then
    raise exception '488: overhead input drift or already applied';
  end if;
end $guard$;
update project_cost_items set unit_price=7.5,
note='量産時の仮予算1.5億円/年（前提行）÷オンサイト事業全体の排水量2000万m³＝7.5円/m³。明細単価7.5は前提未設定時の保存値で、前提があれば年額÷処理量へ連動する。実体制からの見積は未確認。月次計画の管理費と合算せず今回そこを変更しない。金属・燃料の収益で補填しない。'
where cost_item_id='ci_amie_overhead';
commit;
