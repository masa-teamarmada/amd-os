-- 368_seed_project_tech_cx_build_20260904.sql
-- 2026-09-04 BUILD鮫島さん訪問の文字起こしから、CX (p20) 技術タブへ技術事実を足す。
--
-- 一次情報: Notion「【訪問】Build鮫島さん ※ 東京開催 @今日 11:00」文字起こし全文
--           https://app.notion.com/p/3d197749c60880e0a2a5c4961595d7e0
--
-- 方針 (spec 3-20 の 3.4):
--   - 既存行は書き換えない。今日の発言は別の行として足す。
--   - 資料 (OIST審査用ピッチ資料 2026-08-27) と食い違うものは、双方に needs_check を立てて
--     check_reason に「何を、誰に、いつ確かめるか」を書く。
--   - 文字起こしは自動生成で聞き取りが不明瞭な箇所があるため、確度は下げて置く。
--   - 金額・市場規模はここへ持ち込まない (コスト試算タブ / 事業計画が正本)。

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '45s';
SELECT pg_advisory_xact_lock(hashtext('seed_project_tech_cx_build_20260904'));

-- ── 1. 到達実績 (ptt_cx_record) ───────────────────────────────────────────────
INSERT INTO public.project_tech_entries (
  tech_entry_id, tech_topic_id, project_id, row_label, col_label,
  value_min, value_max, value_text, unit, rating, condition_text,
  observed_on, confidence, source_kind, source_ref, source_url, note, sort_order,
  needs_check, check_reason
) VALUES
(
  'pte_cx_b0904_r92', 'ptt_cx_record', 'p20',
  '超伝導線材の細線化 (実加工)', NULL,
  40, 40, 'HTSテープ (幅4mm) を半導体の微細加工技術で細線化。先週その成果が形になったと説明された', 'µm', NULL,
  '山内さんが発案・実行。従来は機械加工では傷が入り、レーザーでは周囲まで溶けるため細線化できなかった',
  '2026-09-04', 'medium', 'meeting',
  '2026-09-04 BUILD鮫島さん訪問 文字起こし',
  'https://app.notion.com/p/3d197749c60880e0a2a5c4961595d7e0',
  '「40µm、オーダーとしては10µmまでいくでしょう」という説明。コイル化とADRへの実装はこれから',
  92, true,
  'OIST審査用ピッチ資料 (2026-08-27) は 10µm の加工に成功と記載 (pte_cx_p_pw30 / pte_cx_p_r80)。当日の口頭説明は「40µm、オーダーとしては10µmまでいく」で、実加工済みの線幅がどちらか確定しない。次回定例で神谷氏・山内氏に実測の線幅と測定日を確認する'
),
(
  'pte_cx_b0904_r94', 'ptt_cx_record', 'p20',
  '120mK の連続保持時間', NULL,
  NULL, NULL, '数時間の連続保持。止めたのは運転都合であり、望めば延ばせるという説明', NULL, NULL,
  NULL,
  '2026-09-04', 'medium', 'meeting',
  '2026-09-04 BUILD鮫島さん訪問 文字起こし',
  'https://app.notion.com/p/3d197749c60880e0a2a5c4961595d7e0',
  NULL,
  94, true,
  '何時間かの実数と、そのときの冷却負荷 (µW) が未取得。連続運転性能として対外説明に使うなら、運転ログの実測を神谷氏から受け取る'
),
(
  'pte_cx_b0904_r96', 'ptt_cx_record', 'p20',
  '120mK 到達データの出所と内製機の現在地', NULL,
  NULL, NULL, '120mKのデータは約20年前にNASAと共同で出したもので、ニオブチタン (低温超伝導) コイルによる実績。現在は全て内製で作り直しており、120mKには「若干まだ達していない」が時間の問題という説明', NULL, NULL,
  NULL,
  '2026-09-04', 'medium', 'meeting',
  '2026-09-04 BUILD鮫島さん訪問 文字起こし',
  'https://app.notion.com/p/3d197749c60880e0a2a5c4961595d7e0',
  '高温超伝導体でADR磁石を作るのは研究者の長年の夢であり、120mKはまだ低温超伝導体での実績である点が要点',
  96, true,
  '内製機の現在の到達温度が確定しない。2026-06-16 の記録は126mK (pte_cx_p_r65)、審査資料 p14 は「120mKを安定保持しながら連続運転に成功」(pte_cx_p_r70)、当日は鮫島さんが「以前のお話だと190mK」と述べ、神谷氏の発言も文字起こし上「同じ100mKまでは行った」と「120mKには達していない」が混在する。内製機の実測値と測定日を神谷氏へ確認し、対外資料の書き方を揃える'
),
(
  'pte_cx_b0904_r98', 'ptt_cx_record', 'p20',
  'TES と可搬式ADRのパッケージ化', NULL,
  NULL, NULL, 'TESは開発済みで、現行アーキテクチャの冷凍機の性能で足りる。可搬式の小型冷凍機としてパッケージ化し、第一号として販売する', NULL, NULL,
  '量子計測・X線計測・光量子コンピュータ向け。ダークマター探索、ビームライン、プラズマ診断も用途として挙がった',
  '2026-09-04', 'high', 'meeting',
  '2026-09-04 BUILD鮫島さん訪問 文字起こし',
  'https://app.notion.com/p/3d197749c60880e0a2a5c4961595d7e0',
  '可搬式の調整用冷凍機は意外に人気があるという説明',
  98, false, NULL
);

-- ── 2. 冷却パワー (ptt_cx_power) ──────────────────────────────────────────────
INSERT INTO public.project_tech_entries (
  tech_entry_id, tech_topic_id, project_id, row_label, col_label,
  value_min, value_max, value_text, unit, rating, condition_text,
  observed_on, confidence, source_kind, source_ref, source_url, note, sort_order,
  needs_check, check_reason
) VALUES
(
  'pte_cx_b0904_pw90', 'ptt_cx_power', 'p20',
  '細線化による冷却パワー向上 (当日の口頭説明)', NULL,
  2, 3, NULL, '倍', NULL,
  '同じサイズのまま磁場の切り替えを速くすることで効く。超伝導線の交流損失が律速',
  '2026-09-04', 'medium', 'meeting',
  '2026-09-04 BUILD鮫島さん訪問 文字起こし',
  'https://app.notion.com/p/3d197749c60880e0a2a5c4961595d7e0',
  'ADRへ実装して我々の期待どおりであれば、という前提つきの説明',
  90, true,
  'OIST審査用ピッチ資料 p14/p28 は理論値で10倍 (pte_cx_p_pw60)。当日の口頭説明は2〜3倍。何に対する比か、どの条件での見込みかを神谷氏へ確認して揃えないと、資料と口頭説明が矛盾する'
),
(
  'pte_cx_b0904_pw92', 'ptt_cx_power', 'p20',
  '細線化が難しかった理由 (従来工法)', NULL,
  NULL, NULL, '高温超伝導体は工場から幅4mmのテープで供給される。機械加工では傷が入り、レーザーでは周囲まで溶けるため細線化できず、業界共通の壁になっていた', NULL, NULL,
  '半導体の微細加工プロセスを使うときれいに分割できる、というのが今回の発案',
  '2026-09-04', 'high', 'meeting',
  '2026-09-04 BUILD鮫島さん訪問 文字起こし',
  'https://app.notion.com/p/3d197749c60880e0a2a5c4961595d7e0',
  '低温超伝導体 (ニオブチタン) では細線化が既に最先端技術として確立しており、それを高温超伝導体でやりたいというのが研究者の長年の夢',
  92, false, NULL
),
(
  'pte_cx_b0904_pw94', 'ptt_cx_power', 'p20',
  '交流損失の低減 (当日の口頭説明)', NULL,
  NULL, NULL, '線を細くすると交流損失が下がる。当日は「10分の1に抑えられる」という説明', NULL, NULL,
  '磁場切り替え時のエネルギー損失',
  '2026-09-04', 'low', 'meeting',
  '2026-09-04 BUILD鮫島さん訪問 文字起こし',
  'https://app.notion.com/p/3d197749c60880e0a2a5c4961595d7e0',
  NULL,
  94, true,
  '文字起こしの聞き取りが不明瞭で、10分の1が交流損失なのか線幅なのかが確定しない。審査資料 p14/p28 のシミュレーション値 (従来比1/10以下、pte_cx_p_pw50) と同じものかを神谷氏へ確認する'
);

-- ── 3. 到達温度の目標と限界 (ptt_cx_temp) ─────────────────────────────────────
INSERT INTO public.project_tech_entries (
  tech_entry_id, tech_topic_id, project_id, row_label, col_label,
  value_min, value_max, value_text, unit, rating, condition_text,
  observed_on, confidence, source_kind, source_ref, source_url, note, sort_order,
  needs_check, check_reason
) VALUES
(
  'pte_cx_b0904_t08', 'ptt_cx_temp', 'p20',
  '水素液化に要る温度', NULL,
  20, 20, NULL, 'K', NULL,
  'mK帯の極低温より技術難易度は低いという説明',
  '2026-09-04', 'high', 'meeting',
  '2026-09-04 BUILD鮫島さん訪問 文字起こし',
  'https://app.notion.com/p/3d197749c60880e0a2a5c4961595d7e0',
  '引き合いはあるが事業計画の数字には入れていない。神谷氏は静止型が最終形だと考えている',
  80, false, NULL
);

-- ── 4. 業界の実用化状況 (ptt_cx_industry) ─────────────────────────────────────
INSERT INTO public.project_tech_entries (
  tech_entry_id, tech_topic_id, project_id, row_label, col_label,
  value_min, value_max, value_text, unit, rating, condition_text,
  observed_on, confidence, source_kind, source_ref, source_url, note, sort_order,
  needs_check, check_reason
) VALUES
(
  'pte_cx_b0904_ind60', 'ptt_cx_industry', 'p20',
  'ヘリウムの伸び (過去20年)', NULL,
  30, 60, '過去20年で30〜60倍になったという説明', '倍', NULL,
  '希釈冷凍機がヘリウムに依存しているため、量子コンピュータ投資の制約になりうる',
  '2026-09-04', 'low', 'meeting',
  '2026-09-04 BUILD鮫島さん訪問 文字起こし',
  'https://app.notion.com/p/3d197749c60880e0a2a5c4961595d7e0',
  '当日は、日本が量子コンピュータへ投じた予算をヘリウム制約で止めないためにも磁気冷凍が要る、という筋立てで語られた',
  60, true,
  '文字起こしでは需要と価格のどちらが30〜60倍なのか判別できない。既に置いてある年間需要 4〜6万L / 供給 2.2〜3万L (pte_cx_p_ind40 / pte_cx_p_ind50) との関係も未整理。一次統計にあたって確定させる'
);

-- ── 5. 既存行の要確認を、今日わかったことで具体化する ─────────────────────────
UPDATE public.project_tech_entries SET
  needs_check = true,
  check_reason = '2026-09-04 の BUILD 訪問では、120mKのデータは約20年前のNASA共同研究でニオブチタン (低温超伝導) コイルを使って出したものであり、内製化した現行機では120mKに「若干まだ達していない」と説明された (pte_cx_b0904_r96)。資料 p14 の「120mKを安定保持しながら連続運転に成功」がどの機体・どの時点の実績を指すのかを神谷氏へ確認する。あわせて資料 p14 の出典が 2021年 MT27 の概念設計発表になっており、実証時期と結びついていない',
  updated_at = now()
WHERE tech_entry_id = 'pte_cx_p_r70';

UPDATE public.project_tech_entries SET
  needs_check = true,
  check_reason = '2026-06-16 の記録は126mK付近。審査資料 (2026-08-27) は120mK安定保持。2026-09-04 の BUILD 訪問では鮫島さんが「以前のお話だと190mK」と述べ、神谷氏の説明も文字起こし上は揺れている (pte_cx_b0904_r96)。内製機の実測値と測定日を神谷氏へ確認し、この行の値を確定させる',
  updated_at = now()
WHERE tech_entry_id = 'pte_cx_p_r65';

UPDATE public.project_tech_entries SET
  confidence = 'medium',
  needs_check = true,
  check_reason = '2026-09-04 の BUILD 訪問では「40µm、オーダーとしては10µmまでいくでしょう」と説明され、先週形になったのは40µm と読める (pte_cx_b0904_r92)。10µm が実加工済みなのか見込みなのかを神谷氏・山内氏へ確認する。従来限界を100µmとする記載も、当日説明の「工場出荷は幅4mmのテープ」と噛み合っていない',
  updated_at = now()
WHERE tech_entry_id = 'pte_cx_p_pw30';

UPDATE public.project_tech_entries SET
  check_reason = '出願が完了しているか、出願準備中かを確認する。審査資料に「出願済み」と書いているため、事実と違うと信用問題になる。あわせて 2026-09-04 の BUILD 訪問での説明 (40µmが先週形になった / 10µmはオーダーとしての見込み) と、この行の「10µm 加工に成功」の関係を確定させる (pte_cx_b0904_r92)',
  updated_at = now()
WHERE tech_entry_id = 'pte_cx_p_r80';

UPDATE public.project_tech_entries SET
  needs_check = true,
  check_reason = '行名が「量子コンピュータ / 水素液化に要る温度」で 20mK になっているが、2026-09-04 の BUILD 訪問では水素液化は 20K と説明されている (pte_cx_b0904_t08)。20mK は超伝導方式の量子コンピュータ側の値であり、単位の違う2用途を1行にまとめると読み違える。神谷氏の確認後に行を分ける',
  updated_at = now()
WHERE tech_entry_id = 'pte_cx_t03';

-- ── 6. トピックの出典に今回の一次情報を足す ──────────────────────────────────
UPDATE public.project_tech_topics SET
  source_ref = source_ref || ' / 2026-09-04 BUILD鮫島さん訪問 文字起こし',
  updated_at = now()
WHERE tech_topic_id IN ('ptt_cx_record','ptt_cx_power','ptt_cx_temp','ptt_cx_industry');

COMMIT;
