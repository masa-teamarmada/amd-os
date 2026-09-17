-- 444: SOL（p21）のビジネスモデル。443 で案C の中身を役割で書き直したとき、選択肢の「C × 要る許可」の要確認の理由（check_reason）に
--   「菌の工程を提供する」の言い回しが残っていた（本番の画面の確認で見つけた）。443 と同じ言い方にそろえる。
--   2026-09-17 まさ「上乗せ売上の「処理業者の工場に菌の工程を入れる」が何を指してるのかが理解できない。廃液回収事業のこと？」
-- 書き換える文が変わっていたら、何も書かずに止まる。生成: scratchpad gen444.py（コミットしない）。
begin;
do $do$ begin
  if (select md5(coalesce(check_reason, '')) from project_tech_entries where tech_entry_id = $t$pte_sol_bm_opt_023$t$ and project_id = $t$p21$t$) is distinct from $t$fae5ef3ca02f0bc9c3c76664f86f80ab$t$ then raise exception 'pte_sol_bm_opt_023.check_reason が 443 の後に書き換えられている'; end if;
end $do$;
update project_tech_entries set check_reason = $c$既存の処理業者の工場の中和・沈殿の後に菌の処理段階を置き、SOLが菌体と処理装置を納めて金属を取り出すとき、SOLに処分業の許可が要るか（委託・請負など契約の形による）。愛媛県に聞く$c$, updated_by = $t$amie$t$, updated_at = now() where tech_entry_id = $t$pte_sol_bm_opt_023$t$ and project_id = $t$p21$t$;
do $do$ begin
  if exists (select 1 from project_tech_topics t, jsonb_each_text(to_jsonb(t)) where t.project_id = $t$p21$t$ and value like '%菌の工程%') then raise exception 'トピックに「菌の工程」が残っている'; end if;
  if exists (select 1 from project_tech_entries e, jsonb_each_text(to_jsonb(e)) where e.project_id = $t$p21$t$ and value like '%菌の工程%') then raise exception '行に「菌の工程」が残っている'; end if;
end $do$;
commit;
