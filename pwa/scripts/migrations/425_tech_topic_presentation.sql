-- 425: 技術台帳のトピックに「社外に出す資料と同じ形で見せる」表示情報 presentation (jsonb) を足し、SOL（p21）の競合比較の公開可3枚へ入れる（2026-09-14 まさ）。
-- まさ「PDFの比較表めっちゃよく出来てるから、この３つそのままOSにも入れておいてほしい」
-- - presentation = { heading 見出し, eyecatch 表の上の一文, lead その下の説明, note 表の下の注記, self_col 自社として色を付ける列, highlight_rows 強調する行 }。
--   星取り表 (block_kind = 'matrix') で presentation があるとき、画面は PDF と同じ並び (見出し → 一文 → 説明 → 表 → 注記) で出す。無いトピックの見た目は変えない。
-- - 3枚の文は VC 提出用の PDF (Drive p21_sol/260914_競合比較_VC提出用) と同じ。PDF は以後この列から作る。
-- 書き換えは、424 のあとに誰も3枚を書き換えていないときだけ当てる（止まったら何も書かない）。生成: scratchpad v425/build425.py（コミットしない）。
begin;
alter table project_tech_topics add column if not exists presentation jsonb;
do $do$ begin
  if not exists (select 1 from pg_constraint where conname = 'project_tech_topics_presentation_object') then
    alter table project_tech_topics add constraint project_tech_topics_presentation_object check (presentation is null or jsonb_typeof(presentation) = 'object');
  end if;
end $do$;
comment on column project_tech_topics.presentation is $t$星取り表を社外に出す資料と同じ形で見せる表示情報。{heading, eyecatch, lead, note, self_col, highlight_rows}。null なら通常の星取り表。仕様 pwa/spec/3-20 §5.4$t$;
do $do$ declare n int; m timestamptz; begin
  select count(*), max(updated_at) into n, m from project_tech_topics where project_id = $t$p21$t$ and tech_topic_id in ($t$ptt_sx_compare$t$, $t$ptt_sx_compare_methods$t$, $t$ptt_sx_comp_fuel$t$) and presentation is null;
  if n <> 3 then raise exception '公開可の3枚が想定と違う（無いか、すでに presentation がある）: % 件', n; end if;
  if m > timestamptz $t$2026-09-14 10:29:15+00$t$ then raise exception '424 のあとに3枚が書き換えられている: %', m; end if;
end $do$;
update project_tech_topics set presentation = $j${"heading": "競合の会社との比較", "eyecatch": "色素を分解でき、レアアースとほかの金属の両方を取れるのは、SolvioraX だけである。", "lead": "排水や廃液から金属や色を取る新しい技術の会社8社と比べた（各社の欄は各社の公開資料による、2026年9月時点）。SolvioraX の鉛・Dy・Nd はラボの速報。", "note": "「—」は対象外、または生きものを使わない方式。「?」は公開資料で確認できないところ。「狙う液」「段階」の行は記号を付けず、事実を並べた。費用は液の種類と規模で大きく変わるため比べていない。", "self_col": "SolvioraX", "highlight_rows": ["生きた細胞が金属を取り込む"]}$j$::jsonb, updated_by = $t$amie$t$, updated_at = now() where tech_topic_id = $t$ptt_sx_compare$t$ and project_id = $t$p21$t$;
update project_tech_topics set presentation = $j${"heading": "既存の方式との比較", "eyecatch": "既存の排水処理に足す形で入る。生きた細胞に金属を取り込ませ、色素も分解する方式は、既存の5つの方式にはない。", "lead": "工場の排水処理でいま使われている5つの方式と比べた。金属を含む排水には凝集沈殿とイオン交換・キレート樹脂、色のついた排水には凝集沈殿と活性汚泥が標準で、色が残るときにオゾン・フェントン酸化や活性炭を足す。活性汚泥も生きた微生物を使うが、役目は有機物の分解で、金属は取らない。", "note": "「—」は対象外、または生きものを使わない方式。「?」は公開資料で確認できないところ。「段階」の行は記号を付けず、事実を並べた。", "self_col": "SolvioraX", "highlight_rows": ["生きた細胞が金属を取り込む"]}$j$::jsonb, updated_by = $t$amie$t$, updated_at = now() where tech_topic_id = $t$ptt_sx_compare_methods$t$ and project_id = $t$p21$t$;
update project_tech_topics set presentation = $j${"heading": "燃料の比較", "eyecatch": "排水処理で先に売上を立て、燃料は上乗せの事業として育てる。", "lead": "藻類・シアノバクテリアから燃料をつくる国内の主な取り組みと、撤退・方針転換した海外の例、比べる基準として使用済み食用油からつくる燃料を並べた。各社で段階も規模も違うので、記号は付けず事実を並べた。", "note": "藻類の燃料は、どの社も量産のコストが下がらないことが壁になってきた（ちとせグループは、藻類バイオマスの生産コストを現状の10分の1にできれば競争力を持つ、と説明している）。", "self_col": "SolvioraX", "highlight_rows": []}$j$::jsonb, updated_by = $t$amie$t$, updated_at = now() where tech_topic_id = $t$ptt_sx_comp_fuel$t$ and project_id = $t$p21$t$;
notify pgrst, 'reload schema';
commit;
