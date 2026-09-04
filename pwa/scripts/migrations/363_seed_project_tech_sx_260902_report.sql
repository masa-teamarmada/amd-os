-- 363_seed_project_tech_sx_260902_report.sql
-- 杉浦先生から共有された「SX 定例報告会_260902」(配布資料) を技術タブへ反映する。
--
-- 境界:
--   - 2026-09-02 定例の内容は既に Notion 文字起こし経由で一部入っている (migration 348/349/350 系の後、
--     pte_sx_r19〜r23 / d11 / d14〜d16 / l13 / l14 / e03)。ここは配布資料が一次情報として足す分だけを扱う。
--   - 足すもの: 実排液の入手元と性状 (社名つき) / 有機物が多い排液の評価方法 / 鉄取り込み試験の液組成の限定 /
--     取り込み量の元数値 (2.5 mg-Fe / 47 mg-DCW) / 次に何を測れば確定するか。
--   - 既存行は消さず、出典に配布資料を足して check_reason を具体化する (spec 3-20 の 3.4)。
--   - 会社訪問の日程そのものはPJコックピット側の正本。ここには排液が取れる見込みとしてのみ1行で置く。

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '45s';
SELECT pg_advisory_xact_lock(hashtext('seed_project_tech_sx_260902_report'));

-- ── 1. 新トピック: PoC用の実排液 (入手元と性状) ───────────────────────────────
INSERT INTO public.project_tech_topics (
  tech_topic_id, project_id, block_kind, title, summary, body_md, tech_domain,
  sort_order, status, confidentiality, source_kind, source_ref,
  created_by, updated_by, needs_check, check_reason, updated_at
) VALUES (
  'ptt_sx_effluent_sources',
  'p21',
  'condition',
  'PoC用の実排液 — どこの何を、どの位置で受け取るか',
  '試験に使える実排液を、出す会社・処理工程のどの位置の液か・分かっている性状で並べる。模擬排液で出た値が実排液で再現するかを判定する前提になる。',
  $body$
模擬排液での結果は、実排液に入っている他の成分で簡単に崩れる。だから「どこの、どの工程の、どういう性状の液か」を、試験の結果とは別に残す。

食品工場の排液は、有機物が多いことがそのまま評価方法の制約になる。炭素が多いとICP-MSで金属を測れないので、処理の前後でCOD値を測って成分が減ったかを見る。

排液を受け取る位置も性状を決める。メイト社から前回受け取った液は1次処理後と2次処理後のもので、原液ではなかった。原液に近い液の提供は了承が取れている。
  $body$,
  '排水処理',
  47,
  'active',
  'confidential',
  'meeting',
  'SX 定例報告会_260902 (杉浦先生 配布資料)',
  'amie',
  'amie',
  true,
  '各社の排液について、採取位置、成分表、pH、COD、対象金属の濃度を受領時に確定する',
  now()
)
ON CONFLICT (tech_topic_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  body_md = EXCLUDED.body_md,
  tech_domain = EXCLUDED.tech_domain,
  sort_order = EXCLUDED.sort_order,
  status = EXCLUDED.status,
  confidentiality = EXCLUDED.confidentiality,
  source_kind = EXCLUDED.source_kind,
  source_ref = EXCLUDED.source_ref,
  updated_by = EXCLUDED.updated_by,
  needs_check = EXCLUDED.needs_check,
  check_reason = EXCLUDED.check_reason,
  updated_at = now();

INSERT INTO public.project_tech_entries (
  tech_entry_id, tech_topic_id, project_id, row_label, col_label,
  value_min, value_max, value_text, unit, rating, condition_text, observed_on,
  confidence, source_kind, source_ref, note, sort_order,
  created_by, updated_by, needs_check, check_reason, updated_at
) VALUES
  (
    'pte_sx_ef01', 'ptt_sx_effluent_sources', 'p21', 'オカベ (食品工場)', null,
    null, null, 'COD 2,000。砂糖・みりん・醤油・ブドウ糖を含む。pH 5', null, null,
    '入手済み。培養試験を実施済み', '2026-09-02',
    'medium', 'meeting', 'SX 定例報告会_260902 (杉浦先生 配布資料)',
    '高濃度の砂糖とブドウ糖でシアノバクテリアが死ぬのではと見ていたが、培養試験では「エサ」として増えた。43時間後にpHが8程度まで上がったのは成分を使ったためと見ている。', 10,
    'amie', 'amie', true,
    '成分はオカベ社の申告値。処理前後のCOD値をSX側で実測し、成分が減っているかを確認する', now()
  ),
  (
    'pte_sx_ef02', 'ptt_sx_effluent_sources', 'p21', '日本食研 (食品工場)', null,
    null, null, '成分不明 (油分を含む)。pH 4.3', null, null,
    '8/25の訪問で工場の廃液処理装置を見学し調達。9/1の週から培養試験中', '2026-09-02',
    'medium', 'meeting', 'SX 定例報告会_260902 (杉浦先生 配布資料)',
    '試験3日目の時点では、オカベ排液のようには増えていない。', 20,
    'amie', 'amie', true,
    '成分表を入手する。試験を続けて、必要に応じてCOD値を測定する', now()
  ),
  (
    'pte_sx_ef03', 'ptt_sx_effluent_sources', 'p21', 'ユナイテッドシルク', null,
    null, null, '繭を脆化した際に出る細かい繊維を含む排水', null, null,
    '先方の現行処理は「酸処理 → 中和 → 排水」で、BODとCODは基準を満たしている', '2026-08-25',
    'high', 'meeting', 'SX 定例報告会_260902 (杉浦先生 配布資料)',
    '8/25の訪問時は製造が止まっていたため、後日郵送で受け取ることになった。', 30,
    'amie', 'amie', true,
    '実液を受領し、酸処理と中和のどの位置から採るかを確定する (受入手順は pte_sx_d07 で中和後・希釈前としている)', now()
  ),
  (
    'pte_sx_ef04', 'ptt_sx_effluent_sources', 'p21', 'メイト', null,
    null, null, '前回受領分は1次処理後と2次処理後の液。原液に近い液の提供は了承済み', null, null,
    '先方もレアアース回収を計画中で、環境負荷の低い方法を探していた', '2026-09-02',
    'high', 'meeting', 'SX 定例報告会_260902 (杉浦先生 配布資料)',
    'せとのわ 太田社長が事前に工場長・総務部長へ説明し、原液に近い廃液の提供を依頼してくださった。9/8に訪問し、実証試験の可能性まで相談する。', 40,
    'amie', 'amie', true,
    '9/8訪問で、原液の採取位置、成分、レアアースの含有量、実証試験の可否を確認する', now()
  ),
  (
    'pte_sx_ef05', 'ptt_sx_effluent_sources', 'p21', 'クボタ', null,
    null, null, '対象外 (排水処理を行っていない)', null, null,
    '打合せは行わない', '2026-09-02',
    'high', 'meeting', 'SX 定例報告会_260902 (杉浦先生 配布資料)',
    null, 50,
    'amie', 'amie', false, null, now()
  ),
  (
    'pte_sx_ef06', 'ptt_sx_effluent_sources', 'p21', '調整中の入手先', null,
    null, null, '愛知時計電気 (NDA締結済・訪問調整中)、石垣 (香川)、アドバンテック、住友金属鉱山 別子事業所 (10/2訪問)、ハタダ (10/2・廃液回収)', null, null,
    '排液がまだ手元に無い相手。性状は未取得', '2026-09-02',
    'medium', 'meeting', 'SX 定例報告会_260902 (杉浦先生 配布資料)',
    '訪問日程そのものはPJコックピット側の正本。ここでは試験に使える排液の見込みとして持つ。', 60,
    'amie', 'amie', true,
    '受領時に、採取位置、成分、pH、対象金属の濃度をこの表へ足す', now()
  ),
  (
    'pte_sx_ef07', 'ptt_sx_effluent_sources', 'p21', '有機物が多い排液の測り方', null,
    null, null, 'ICP-MSは使えない (炭素が多く測定不可)。COD値で評価する', null, null,
    '食品工場の排液のように有機物濃度が高い場合', '2026-09-02',
    'high', 'meeting', 'SX 定例報告会_260902 (杉浦先生 配布資料)',
    '金属を個別に定量できないため、処理の前後でCOD値を比べて成分が減ったかを見る。金属の取り込み量を出したい場合は、別の前処理か別の分析法が要る。', 70,
    'amie', 'amie', true,
    'COD測定を実施し、処理前後の差を記録する。金属側の定量方法を決める', now()
  )
ON CONFLICT (tech_entry_id) DO UPDATE SET
  tech_topic_id = EXCLUDED.tech_topic_id,
  row_label = EXCLUDED.row_label,
  value_min = EXCLUDED.value_min,
  value_max = EXCLUDED.value_max,
  value_text = EXCLUDED.value_text,
  unit = EXCLUDED.unit,
  condition_text = EXCLUDED.condition_text,
  observed_on = EXCLUDED.observed_on,
  confidence = EXCLUDED.confidence,
  source_kind = EXCLUDED.source_kind,
  source_ref = EXCLUDED.source_ref,
  note = EXCLUDED.note,
  sort_order = EXCLUDED.sort_order,
  updated_by = EXCLUDED.updated_by,
  needs_check = EXCLUDED.needs_check,
  check_reason = EXCLUDED.check_reason,
  updated_at = now();

-- ── 2. 鉄取り込み試験の液組成 (リアクターの運転条件へ追加) ─────────────────────
INSERT INTO public.project_tech_entries (
  tech_entry_id, tech_topic_id, project_id, row_label, col_label,
  value_min, value_max, value_text, unit, rating, condition_text, observed_on,
  confidence, source_kind, source_ref, note, sort_order,
  created_by, updated_by, needs_check, check_reason, updated_at
) VALUES
  (
    'pte_sx_r24', 'ptt_sx_reactor', 'p21', '鉄取り込み試験に使った液の組成', null,
    null, null, '培地成分を含まず、水と Fe(NO₃)₃ のみ', null, null,
    '2026-09-02 報告の鉄模擬排液 (pte_sx_r19〜r22 の試験条件)', '2026-09-02',
    'high', 'meeting', 'SX 定例報告会_260902 (杉浦先生 配布資料)',
    'pHが2.6から上がったのは培地の緩衝作用ではなく鉄を取り込んだためだ、と読める条件。逆に言うと、この試験は栄養のない水で行っており、実排水では共存する成分の影響を受ける。', 240,
    'amie', 'amie', true,
    '培地成分や共存イオンのある実排水で、同じ取り込み量とpH上昇が出るかを確認する', now()
  ),
  (
    'pte_sx_r25', 'ptt_sx_reactor', 'p21', '強化株1の鉄取り込み量 (元の測定値)', null,
    null, null, '2.5 mg-Fe / 47 mg-DCW', null, null,
    'OD5・鉄模擬排液・24時間の単回試験。pte_sx_r21 の5.3%はこの値から算出', '2026-09-02',
    'medium', 'meeting', 'SX 定例報告会_260902 (杉浦先生 配布資料)',
    '割合ではなく実測の重量。菌体をどれだけ入れれば何mgの鉄を取れるかを試算するときはこちらを使う。', 215,
    'amie', 'amie', true,
    '再現性実験で同じ値が出るかを確認する', now()
  )
ON CONFLICT (tech_entry_id) DO UPDATE SET
  tech_topic_id = EXCLUDED.tech_topic_id,
  row_label = EXCLUDED.row_label,
  value_text = EXCLUDED.value_text,
  condition_text = EXCLUDED.condition_text,
  observed_on = EXCLUDED.observed_on,
  confidence = EXCLUDED.confidence,
  source_kind = EXCLUDED.source_kind,
  source_ref = EXCLUDED.source_ref,
  note = EXCLUDED.note,
  sort_order = EXCLUDED.sort_order,
  updated_by = EXCLUDED.updated_by,
  needs_check = EXCLUDED.needs_check,
  check_reason = EXCLUDED.check_reason,
  updated_at = now();

-- ── 3. 既存の 2026-09-02 由来の行に、配布資料を出典として足し、次に何を測るかを具体化する ──
UPDATE public.project_tech_entries SET
  source_ref = '2026-09-02 SX定例MTG（Notion文字起こし・直後のSX共有） / SX 定例報告会_260902 (杉浦先生 配布資料)',
  check_reason = '再現性実験、Fe消費の半減期による野生型と強化株1の比較、pHを中性付近へ調整した条件での取り込み試験、強化株2 (TmtA遺伝子3つ) での同一試験を行って確定する',
  updated_by = 'amie',
  updated_at = now()
WHERE project_id = 'p21' AND tech_entry_id IN ('pte_sx_r19','pte_sx_r20','pte_sx_r21','pte_sx_r22','pte_sx_e03');

UPDATE public.project_tech_entries SET
  note = '元の測定値は 2.5 mg-Fe / 47 mg-DCW (pte_sx_r25)。培地成分を含まない水と Fe(NO₃)₃ のみの液での単回試験。',
  updated_by = 'amie',
  updated_at = now()
WHERE project_id = 'p21' AND tech_entry_id = 'pte_sx_r21';

UPDATE public.project_tech_entries SET
  note = '強化株1は50 ppmを全量取り込んだため、これが上限とは限らない。野生型はOD5で40 ppmが最大だった。',
  updated_by = 'amie',
  updated_at = now()
WHERE project_id = 'p21' AND tech_entry_id = 'pte_sx_r20';

UPDATE public.project_tech_entries SET
  value_text = '初期pH2.6から24時間後、野生型は約3.3、強化株1は6.2まで上昇し、ただの水に近くなった',
  note = 'この液には培地成分が入っておらず、水と Fe(NO₃)₃ のみ。鉄の取り込みに比例してpHが上がったと読める。通常この酸性度ではシアノバクテリアは光合成できず死滅する。',
  source_ref = '2026-09-02 SX定例MTG（Notion文字起こし・直後のSX共有） / SX 定例報告会_260902 (杉浦先生 配布資料)',
  check_reason = 'pHを中性付近へ調整した条件でも同じ取り込みが起きるかを確認する (工場ごとにpHが違うため)',
  updated_by = 'amie',
  updated_at = now()
WHERE project_id = 'p21' AND tech_entry_id = 'pte_sx_r22';

-- 培養試験の2件に、どの会社の排液かを入れる (これまで「食品系排液A / B」で社名が無かった)
UPDATE public.project_tech_entries SET
  row_label = 'オカベ排液の培養試験 (食品系排液A)',
  value_text = '50%排液条件で対照より増殖。43時間でpH5→約8',
  condition_text = 'COD 2,000・砂糖・みりん・醤油・ブドウ糖を含む食品工場排液を50%添加',
  note = '高濃度の糖でシアノバクテリアが死ぬと見ていたが、エサとして増えた。増殖が速い分、排液中の成分は減っているはず。評価はCOD値の測定で行う予定 (ICP-MSは炭素が多く測定不可)。',
  source_ref = '2026-09-02 SX定例MTG（Notion文字起こし・直後のSX共有） / SX 定例報告会_260902 (杉浦先生 配布資料)',
  check_reason = '処理前後のCOD値を測り、どの成分がどれだけ減ったかを確認する',
  updated_by = 'amie',
  updated_at = now()
WHERE project_id = 'p21' AND tech_entry_id = 'pte_sx_d14';

UPDATE public.project_tech_entries SET
  row_label = '日本食研排液の培養試験 (食品系排液B)',
  condition_text = '成分不明 (油分を含む) の食品工場排液。9/1の週から培養継続中',
  note = '試験3日目の時点で、オカベ排液のようには増えていない。初期pHは4.3。',
  source_ref = '2026-09-02 SX定例MTG（Notion文字起こし・直後のSX共有） / SX 定例報告会_260902 (杉浦先生 配布資料)',
  check_reason = '試験を続け、必要に応じてCOD値を測定する。成分表を先方から入手する',
  updated_by = 'amie',
  updated_at = now()
WHERE project_id = 'p21' AND tech_entry_id = 'pte_sx_d15';

UPDATE public.project_tech_entries SET
  note = 'TmtA (重金属結合タンパク質) が鉄と結合しているという間接的な結果。杉浦先生は「新しい発見」としている。直接の結合実験は未実施。',
  source_ref = '2026-09-02 SX定例MTG（Notion文字起こし・直後のSX共有） / SX 定例報告会_260902 (杉浦先生 配布資料)',
  check_reason = '再現性実験と、Fe消費の半減期による野生型と強化株1の比較で裏づける。TmtAと鉄の直接的な結合実験は未実施',
  updated_by = 'amie',
  updated_at = now()
WHERE project_id = 'p21' AND tech_entry_id = 'pte_sx_d16';

UPDATE public.project_tech_entries SET
  source_ref = '2026-09-02 SX定例MTG（Notion文字起こし・直後のSX共有） / SX 定例報告会_260902 (杉浦先生 配布資料)',
  check_reason = '培養が試験可能な菌体量に達したら、野生型・強化株1と同じ鉄取り込み試験を行う',
  updated_by = 'amie',
  updated_at = now()
WHERE project_id = 'p21' AND tech_entry_id = 'pte_sx_d11';

UPDATE public.project_tech_entries SET
  note = '砂糖やブドウ糖を高濃度で含む食品工場排液でも死滅せず、対照より速く増えた。成分を取り込んでいると見ているが、どの経路で利用しているかは未確定。',
  source_ref = '2026-09-02 SX定例MTG（Notion文字起こし・直後のSX共有） / SX 定例報告会_260902 (杉浦先生 配布資料)',
  check_reason = '処理前後のCOD値を測り、どの成分が減ったかを確認する',
  updated_by = 'amie',
  updated_at = now()
WHERE project_id = 'p21' AND tech_entry_id = 'pte_sx_l02';

COMMIT;
