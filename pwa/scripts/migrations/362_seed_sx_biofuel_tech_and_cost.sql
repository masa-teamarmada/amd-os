-- 362_seed_sx_biofuel_tech_and_cost.sql
-- SX 技術タブへバイオ燃料の技術到達点・量産条件を追加し、
-- コスト試算タブへ販売価格・総原価上限・未取得原価を整理する。
--
-- 境界:
--   - ラボで燃料化した経験と段階導入の方向は 2026-04-28 SX定例の発言。
--   - 2,000 L級の出力、販売価格、総原価上限は 2026-08-19 内部検討資料の試算。
--   - 現行製造原価、設備占有面積、量産時の生産性は未取得。

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '45s';
SELECT pg_advisory_xact_lock(hashtext('seed_sx_biofuel_tech_and_cost_20260903'));

INSERT INTO public.project_tech_topics (
  tech_topic_id, project_id, block_kind, title, summary, body_md, tech_domain,
  sort_order, status, confidentiality, source_kind, source_ref,
  created_by, updated_by, needs_check, check_reason, updated_at
) VALUES (
  'ptt_sx_biofuel',
  'p21',
  'record',
  'バイオ燃料の到達点と量産条件',
  'ラボで確認した燃料化、既存燃料への段階導入、2,000 L級の出力試算、量産・原価で未確認の条件を分けて記録する。',
  $body$
バイオ燃料は、排水処理と同じシアノバクテリア培養基盤から広がる事業候補。2026-04-28 のSX定例では、ラボスケールで燃料を作った経験があり、最初から燃料を全量置換するのではなく、既存燃料へ数%を混合するコプロセッシングから入る開発経路が話された。

2026-08-19 の内部試算では、2,000 L級設備から年間48〜130 kg、燃料密度0.88 kg/Lで年間55〜148 Lを得る置き値を使っている。この値は実測ではなく試算。年間40,000,000 Lを同じ設備の単純増設で作ると約270,000〜727,000基が必要になるため、量産では1基当たり出力、連続運転、設備集約、有効敷地面積を別に設計する必要がある。

重金属回収では金属を回収すると菌体が死ぬため、光合成を続ける燃料生産とは同時に行わず、別工程または別ラインとして設計する。

販売価格の仮説と必要原価は置けているが、SX方式の現行製造原価はまだ取得できていない。したがって「原価目標が公的な研究開発目標から外れていない」ことと、「SX方式で採算が実証された」ことは分けて扱う。
  $body$,
  'バイオ燃料',
  65,
  'active',
  'confidential',
  'meeting',
  'SX定例MTG (2026-04-28) / 260819 バイオ燃料アップサイド検討資料 / project_tech_entries pte_sx_e04・pte_sx_l05',
  'amie',
  'amie',
  true,
  '実出力、有効敷地面積、連続運転時の生産性、培養から燃料化までの製造原価、SAF委託加工の歩留まりと費用を取得する',
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
    'pte_sx_bf01', 'ptt_sx_biofuel', 'p21', 'ラボスケールでの燃料化', null,
    null, null, '燃料を作った経験あり', null, null,
    '生産量・再現回数・分析条件は議事録に数値なし', '2026-04-28',
    'medium', 'meeting', 'SX定例MTG (2026-04-28)',
    '研究者発言による到達点。定量データの所在は未確認。', 10,
    'amie', 'amie', true,
    '燃料量、脂質含有率、回収率、分析法、反復回数を実験記録で確認する', now()
  ),
  (
    'pte_sx_bf02', 'ptt_sx_biofuel', 'p21', '初期の市場導入経路', null,
    null, null, '既存燃料へ数%を混合するコプロセッシング', null, null,
    '燃料の全量置換より先に、部分混合で導入実績を作る', '2026-04-28',
    'medium', 'meeting', 'SX定例MTG (2026-04-28)',
    '研究開発の方向として話された内容。顧客・規格・混合率は未確定。', 20,
    'amie', 'amie', true,
    '対象燃料、許容混合率、供給先、品質規格、実証条件を確定する', now()
  ),
  (
    'pte_sx_bf03', 'ptt_sx_biofuel', 'p21', '2,000 L級設備の年間燃料量', null,
    48, 130, '試算値', 'kg/年', null,
    '脂質含有率20%、油分回収率85%、FAME転換率95%、バッチ相当期間5〜15日を置いた内部試算', '2026-08-19',
    'low', 'estimate', '260819 バイオ燃料アップサイド検討資料',
    '実測値ではない。燃料密度0.88 kg/Lで55〜148 L/年に相当。', 30,
    'amie', 'amie', true,
    '年間出力を実測し、前提ごとの実測値へ置き換える', now()
  ),
  (
    'pte_sx_bf04', 'ptt_sx_biofuel', 'p21', '2,000 L級設備の年間燃料量（体積換算）', null,
    55, 148, '48〜130 kg/年を密度0.88 kg/Lで換算', 'L/年', null,
    '設備1基当たり。設備の有効敷地面積は未取得', '2026-08-19',
    'low', 'estimate', '260819 バイオ燃料アップサイド検討資料',
    'NEDOのL/日/haと比較するには、通路・補機・回収設備を含む有効敷地面積が必要。', 40,
    'amie', 'amie', true,
    '設備1基の有効敷地面積を測り、面積生産性へ換算する', now()
  ),
  (
    'pte_sx_bf05', 'ptt_sx_biofuel', 'p21', '年間40,000,000 Lに必要な設備数', null,
    270000, 727000, '現状出力を単純増設した場合', '基', null,
    '2033年度の検証用売上シナリオ80億円、販売価格200円/Lから逆算', '2026-08-19',
    'low', 'estimate', '260819 バイオ燃料アップサイド検討資料',
    '需要予測ではなく量産成立性を測る検証用シナリオ。単純増設では成立しないことを示す。', 50,
    'amie', 'amie', true,
    '連続運転、設備集約、複数拠点を含む量産方式へ置き換えて再試算する', now()
  ),
  (
    'pte_sx_bf06', 'ptt_sx_biofuel', 'p21', '排水処理との工程関係', null,
    null, null, '重金属回収と燃料生産は別工程・別ライン', null, null,
    '重金属回収では菌体が死ぬ。燃料生産は光合成を継続させる必要がある', '2026-08-29',
    'medium', 'meeting', 'project_tech_entries pte_sx_l05',
    '培養基盤は共有できる可能性があるが、同じ菌体を同時利用する前提ではない。', 60,
    'amie', 'amie', true,
    '培養・排水処理・燃料回収の物質収支と設備境界を工程図で確定する', now()
  )
ON CONFLICT (tech_entry_id) DO UPDATE SET
  tech_topic_id = EXCLUDED.tech_topic_id,
  project_id = EXCLUDED.project_id,
  row_label = EXCLUDED.row_label,
  col_label = EXCLUDED.col_label,
  value_min = EXCLUDED.value_min,
  value_max = EXCLUDED.value_max,
  value_text = EXCLUDED.value_text,
  unit = EXCLUDED.unit,
  rating = EXCLUDED.rating,
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

INSERT INTO public.project_cost_notes (
  cost_note_id, cost_model_id, section, title, body_md,
  source_url, source_label, visibility, sort_order, updated_at
) VALUES
  (
    'cn_260820_b4', 'cm_p21_260820', 'benchmark',
    'バイオ燃料：販売価格と総原価の成立ライン',
    $note$
排水処理の円/m³モデルとは別に、バイオ燃料を円/Lで見るための参考試算。

| 製品 | 市場参照価格 | 計画上の売価 | 粗利30%に必要な総原価上限 | 現在地 |
|---|---:|---:|---:|---|
| FAME系バイオディーゼル | 約183円/L | 200円/L | **140円/L** | 培養からFAME化までの現行原価は未取得 |
| SAF | 約309円/L | 350円/L | **245円/L** | 上流原価、委託加工費、歩留まりは未取得 |
| SAF上振れ | — | 400円/L | **280円/L** | 販売先と加工先の条件確認が必要 |

内部検討資料が参照するNEDOのバイオジェット燃料コスト目標は100〜200円/L。FAMEで必要な140円/Lはこの目標帯に入るため、**目標原価だけを見て経済的に不可能とは判断できない**。一方、SX方式の実原価を測った結果ではないため、採算実証済みとは扱わない。
    $note$,
    null,
    '260819 バイオ燃料アップサイド検討資料（外部参照値は同資料の出典欄）',
    'amd_internal', 40, now()
  ),
  (
    'cn_260820_c6', 'cm_p21_260820', 'caveat',
    'バイオ燃料原価は排水処理の計算結果へ混ぜない',
    'このタブ上部の4シナリオと総コスト目標300円/m³は、工場排液を処理する事業のモデル。バイオ燃料の140〜280円/Lは、販売価格と粗利率から逆算した**許容原価**で、現在の製造原価ではない。単位も工程範囲も異なるため合算・直接比較しない。',
    null,
    '260820 SXコスト試算 / 260819 バイオ燃料アップサイド検討資料',
    'amd_internal', 60, now()
  ),
  (
    'cn_260820_r4', 'cm_p21_260820', 'reading_guide',
    'バイオ燃料：次に取得するコスト情報',
    $note$
バイオ燃料の採算を判定するには、次の順で実測・見積へ置き換える。

1. **上流生産性** — 年間燃料量、有効敷地面積、運転日数、連続運転率
2. **培養・回収原価** — 培地、CO2、光・温度制御、撹拌、濃縮、脱水、油分抽出
3. **変換原価** — 脂質含有率、油分回収率、FAME転換率、触媒、残渣処理
4. **SAF後半工程** — HEFAの歩留まり、水素化精製・分解・異性化・蒸留・混合の委託費
5. **販売までの費用** — 品質検査、規格適合、認証、物流

最初の判定は、FAMEなら総原価140円/L以下、SAFなら245円/L以下へ届く経路があるか。実測が入るまでは、成立ラインと現行原価を分けて読む。
    $note$,
    null,
    '260819 バイオ燃料アップサイド検討資料',
    'amd_internal', 40, now()
  )
ON CONFLICT (cost_note_id) DO UPDATE SET
  section = EXCLUDED.section,
  title = EXCLUDED.title,
  body_md = EXCLUDED.body_md,
  source_url = EXCLUDED.source_url,
  source_label = EXCLUDED.source_label,
  visibility = EXCLUDED.visibility,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

UPDATE public.project_cost_models
SET updated_at = now(),
    updated_by = 'amie'
WHERE cost_model_id = 'cm_p21_260820';

DO $verify$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.project_tech_topics
    WHERE tech_topic_id = 'ptt_sx_biofuel' AND project_id = 'p21' AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'SX biofuel tech topic was not stored';
  END IF;

  IF (SELECT count(*) FROM public.project_tech_entries WHERE tech_topic_id = 'ptt_sx_biofuel') <> 6 THEN
    RAISE EXCEPTION 'Expected 6 SX biofuel tech entries';
  END IF;

  IF (SELECT count(*) FROM public.project_cost_notes WHERE cost_model_id = 'cm_p21_260820' AND cost_note_id IN ('cn_260820_b4','cn_260820_c6','cn_260820_r4')) <> 3 THEN
    RAISE EXCEPTION 'Expected 3 SX biofuel cost notes';
  END IF;
END $verify$;

COMMIT;
