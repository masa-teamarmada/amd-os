-- 445: SOL（p21）の会社設立日を 2027-04-01 にそろえる。
--   2026-09-17 まさ「設立は20270401」。ゴールツリーの「NewCo設立」（期限 2027-04-01）、ビジネスモデル、月次試算表（FY2027 を 2027-04 から計上）とそろえる。
--   migration 273（2026-08-13）で 2027-02-01 にしていた次の3つを戻す:
--   ① project_ventures.founded_at ② 紹介文（short_description）と沿革（narrative_text。273 が「2027年4月」を「2027年2月」へ置き換えた箇所と、設立予定の日付）
--   ③ active 資本政策の設立イベント（sx-incorporation）の日付。事業計画タブの設立月はこの値から読む（無いときはコードの SX_INCORPORATION_DATE）。
-- 書き換える値が変わっていたら、何も書かずに止まる。生成: scratchpad gen445.py（コミットしない）。
begin;
do $do$ begin
  if (select founded_at from project_ventures where project_id = $t$p21$t$) is distinct from date $t$2027-02-01$t$ then raise exception 'p21 の founded_at が 2027-02-01 でない'; end if;
  if (select md5(coalesce(short_description, '')) from project_ventures where project_id = $t$p21$t$) is distinct from $t$85fad06f675ec031899d05bd313ea1ec$t$ then raise exception 'p21 の short_description が書き換えられている'; end if;
  if (select md5(coalesce(narrative_text, '')) from project_ventures where project_id = $t$p21$t$) is distinct from $t$46fba29fea38696e33d33f7737f13a7c$t$ then raise exception 'p21 の narrative_text が書き換えられている'; end if;
  if (select count(*) from project_capital_plans where project_id = $t$p21$t$ and status = $t$active$t$) <> 1 then raise exception 'p21 の active 資本政策が1件でない'; end if;
  if (select revision from project_capital_plans where id = $t$9a6fb7cd-8f57-4456-92a5-8df486a55ae3$t$) is distinct from 2 then raise exception '資本政策の revision が 2 でない（ほかで書き換えられている）'; end if;
  if (select count(*) from project_capital_plans p, jsonb_array_elements(p.document_json -> 'events') e
      where p.id = $t$9a6fb7cd-8f57-4456-92a5-8df486a55ae3$t$ and e ->> 'id' = $t$sx-incorporation$t$ and e ->> 'date' = $t$2027-02-01$t$) <> 1 then raise exception '資本政策の設立イベントが 2027-02-01 でない'; end if;
end $do$;
update project_ventures
set founded_at = date $t$2027-04-01$t$,
    short_description = $sd$シアノバクテリア排水処理 / PSI Step2 / 2027-04設立目標$sd$,
    narrative_text = $nt$[{"date":"2023-01-06","title":"石原裕香氏がSolvioraXの前身となる研究に産連メンバーとして参画","detail":"愛媛大学におけるシアノバクテリア排水処理技術の研究開発フェーズから、産学連携の要員として石原裕香氏がプロジェクトに参画。後のSolvioraXの事業化に向けた基盤構築に貢献した。"},{"date":"2025-07-01","title":"愛媛大学にてシアノバクテリア排水処理技術の事業化検討を開始","detail":"杉浦美羽氏がPIを務める愛媛大学の研究室で、シアノバクテリアを用いた排水処理技術の事業化に向けた検討がPSI Step2フェーズとして本格的に始動した。技術成熟度はTRL4、ビジネス成熟度はBRL2と評価された。"},{"date":"2026-01-01","title":"AMDによるFounder Studioプログラムの支援を開始","detail":"愛媛大学発のディープテックPJ「SolvioraX」は、株式会社チームアルマダ（AMD）のFounder Studioプログラムによる支援を受け、事業化に向けた戦略策定やリソース確保を加速させた。"},{"date":"2026-04-01","title":"PJ設立準備を開始し、排水処理契約候補の獲得が見込まれる","detail":"2027年4月のPJ設立に向けた準備が本格化。同時に、シアノバクテリア排水処理技術の導入に関心を示す企業との契約候補が見込まれる段階に至り、ビジネス成熟度はBRL3に向上した。"},{"date":"2026-05","title":"2027年4月のPJ設立に向けた事業化計画と技術検証を推進","detail":"シアノバクテリア排水処理技術のラボ検証を継続しつつ、2027年4月のSolvioraX PJ設立目標に向けた具体的な事業化戦略の検討と計画策定を推進。ビジネス成熟度はBRL3を維持した。"},{"date":"2026-05-21","title":"特定企業との単独深耕リスクを認識し、多角的な協業を検討","detail":"ダイキアクシス社との連携が深まる中で、他の水処理メーカーとの協業機会を逸する戦略リスクが認識された。事業の幅とバリュエーションを確保するため、複数の企業との並行関係を維持する方向性が検討された。"},{"date":"2027-04-01","title":"シアノバクテリア排水処理技術を事業化するPJ「SolvioraX」設立予定","detail":"愛媛大学発のシアノバクテリア排水処理技術を社会実装するディープテックPJ「SolvioraX」が設立される予定。持続可能な水環境ソリューションの提供を目指し、本格的な事業活動を開始する。"}]$nt$,
    updated_at = now()
where project_id = $t$p21$t$;
with target as (
  select p.id, p.revision, pos.ordinality - 1 as event_index
  from project_capital_plans p
  cross join lateral jsonb_array_elements(p.document_json -> 'events') with ordinality as pos(event_json, ordinality)
  where p.id = $t$9a6fb7cd-8f57-4456-92a5-8df486a55ae3$t$ and pos.event_json ->> 'id' = $t$sx-incorporation$t$
)
update project_capital_plans p
set document_json = jsonb_set(p.document_json, array['events', target.event_index::text, 'date'], to_jsonb($t$2027-04-01$t$::text), false),
    revision = p.revision + 1,
    updated_at = now()
from target
where p.id = target.id and p.revision = target.revision;
do $do$ begin
  if (select founded_at from project_ventures where project_id = $t$p21$t$) is distinct from date $t$2027-04-01$t$ then raise exception 'founded_at が 2027-04-01 になっていない'; end if;
  if exists (select 1 from project_ventures where project_id = $t$p21$t$ and (coalesce(short_description, '') || coalesce(narrative_text, '')) ~ '2027年2月|2027-02') then raise exception '紹介文・沿革に 2027年2月 が残っている'; end if;
  if (select count(*) from project_capital_plans p, jsonb_array_elements(p.document_json -> 'events') e
      where p.id = $t$9a6fb7cd-8f57-4456-92a5-8df486a55ae3$t$ and e ->> 'id' = $t$sx-incorporation$t$ and e ->> 'date' = $t$2027-04-01$t$) <> 1 then raise exception '資本政策の設立イベントが 2027-04-01 になっていない'; end if;
  if (select revision from project_capital_plans where id = $t$9a6fb7cd-8f57-4456-92a5-8df486a55ae3$t$) is distinct from 3 then raise exception '資本政策の revision が 3 になっていない'; end if;
end $do$;
commit;
