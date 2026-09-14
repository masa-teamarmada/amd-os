-- 415: 414 で入れた SX 技術タブ「競合比較」の見やすさの手直し（2026-09-14、本番の画面で確認して直した分）。
-- 1) 先頭の星取り表の題を「排水処理と金属回収の星取り表 — …」にする。左のトピック一覧は「 — 」より前だけを出すので、414 の題では「星取り表」とだけ出て燃料の星取り表と見分けにくかった。
-- 2) 星取り表のマスの要確認の理由を短くする。マスの幅が狭く、理由の赤字が値より長くなって行が伸びていた。確かめる相手と中身は各観点のトピックと「SXが負けるところ」に書いてある。
-- 3) 汚泥のマスの注記を短くする。
-- 4) 燃料の星取り表の SX のコストのマスを「数倍」から「大きく上回る」にする（同日の燃料の試算の置き直しで、基準が売価の10倍を超えた。数字はコスト試算（燃料）のタブが正本）。
begin;
do $do$ begin if not exists (select 1 from project_tech_topics where tech_topic_id = $t$ptt_sx_compare$t$ and tech_domain = $t$競合比較$t$) then raise exception '414 が未適用'; end if; end $do$;
update project_tech_topics set title = $t$排水処理と金属回収の星取り表 — SXは何と比べられるか$t$, updated_by = $t$amie$t$, updated_at = now() where tech_topic_id = $t$ptt_sx_compare$t$;
update project_tech_entries set check_reason = $t$染色排水の実液で測る$t$, updated_by = $t$amie$t$, updated_at = now() where tech_entry_id = $t$pte_sx_cmp_s0101$t$ and needs_check;
update project_tech_entries set check_reason = $t$混ざった液で測る$t$, updated_by = $t$amie$t$, updated_at = now() where tech_entry_id = $t$pte_sx_cmp_s0301$t$ and needs_check;
update project_tech_entries set check_reason = $t$濃度ごとに測る$t$, updated_by = $t$amie$t$, updated_at = now() where tech_entry_id = $t$pte_sx_cmp_s0401$t$ and needs_check;
update project_tech_entries set check_reason = $t$公表値を探す$t$, updated_by = $t$amie$t$, updated_at = now() where tech_entry_id = $t$pte_sx_cmp_s0502$t$ and needs_check;
update project_tech_entries set check_reason = $t$資料を探す$t$, updated_by = $t$amie$t$, updated_at = now() where tech_entry_id = $t$pte_sx_cmp_s0503$t$ and needs_check;
update project_tech_entries set check_reason = $t$メーカー資料で確かめる$t$, updated_by = $t$amie$t$, updated_at = now() where tech_entry_id = $t$pte_sx_cmp_s0504$t$ and needs_check;
update project_tech_entries set check_reason = $t$使い回せる回数を確かめる$t$, updated_by = $t$amie$t$, updated_at = now() where tech_entry_id = $t$pte_sx_cmp_s0701$t$ and needs_check;
update project_tech_entries set check_reason = $t$現場実証で原価を取る$t$, updated_by = $t$amie$t$, updated_at = now() where tech_entry_id = $t$pte_sx_cmp_s0801$t$ and needs_check;
update project_tech_entries set check_reason = $t$公表値を探す$t$, updated_by = $t$amie$t$, updated_at = now() where tech_entry_id = $t$pte_sx_cmp_s0802$t$ and needs_check;
update project_tech_entries set check_reason = $t$水処理メーカーに聞く$t$, updated_by = $t$amie$t$, updated_at = now() where tech_entry_id = $t$pte_sx_cmp_s0804$t$ and needs_check;
update project_tech_entries set check_reason = $t$ヒアリングで取る$t$, updated_by = $t$amie$t$, updated_at = now() where tech_entry_id = $t$pte_sx_cmp_s0807$t$ and needs_check;
update project_tech_entries set note = $t$処分25〜50円/kg（業者の相場）$t$, updated_by = $t$amie$t$, updated_at = now() where tech_entry_id = $t$pte_sx_cmp_s0703$t$;
update project_tech_entries set value_text = $t$試算では売価200円/Lを大きく上回る$t$, updated_by = $t$amie$t$, updated_at = now() where tech_entry_id = $t$pte_sx_cmp_f0601$t$;
do $do$ declare n int; begin select count(*) into n from project_tech_entries where tech_topic_id = $t$ptt_sx_compare$t$ and needs_check and length(check_reason) > 14; if n > 0 then raise exception '長い理由が残っている: % 件', n; end if; end $do$;
commit;
