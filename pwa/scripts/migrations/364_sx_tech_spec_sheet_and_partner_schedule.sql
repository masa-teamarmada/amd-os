-- 364_sx_tech_spec_sheet_and_partner_schedule.sql
-- まさ確定 (2026-09-04):
--   (1) 訪問日程は技術ではないので技術タブから外し、進捗管理側の関係先へ持たせる。
--   (2) 技術タブの一番上に「シアノバクテリアの性能一覧」を置く。
--       生きられる環境 / 力を発揮する条件 / 取り込める元素 / 生み出せるもの / 株による違いを1枚で読む。
--
-- 境界:
--   - 性能一覧は既存トピックの再掲。値の正本は各トピック側 (pte_* をsource_refに明記) と
--     コスト試算タブに残し、ここでは二重の正本を作らない。
--   - 2026-09-02 の配布資料で分かった各社の排液の状況は関係先 (project_management_partners) へ入れる。
--   - 訪問日程の正本は関係先タブ。技術タブには残さない。

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SELECT pg_advisory_xact_lock(hashtext('sx_tech_spec_sheet_and_partner_schedule'));

-- ══ 1. 技術タブから訪問日程の行を外す ═══════════════════════════════════════
DELETE FROM public.project_tech_entries
WHERE project_id = 'p21' AND tech_entry_id = 'pte_sx_ef06';

UPDATE public.project_tech_entries SET
  note = 'せとのわ 太田社長が事前に工場長・総務部長へ説明し、原液に近い廃液の提供を依頼してくださった。訪問日程と次の約束は関係先タブが正本。',
  check_reason = '原液の採取位置、成分、レアアースの含有量、実証試験の可否を訪問時に確認する',
  updated_by = 'amie', updated_at = now()
WHERE project_id = 'p21' AND tech_entry_id = 'pte_sx_ef04';

UPDATE public.project_tech_entries SET
  condition_text = '工場の廃液処理装置の見学時に調達。培養試験中',
  updated_by = 'amie', updated_at = now()
WHERE project_id = 'p21' AND tech_entry_id = 'pte_sx_ef02';

UPDATE public.project_tech_entries SET
  note = '訪問時は製造が止まっていたため、後日郵送で受け取ることになった。受領時期は関係先タブが正本。',
  updated_by = 'amie', updated_at = now()
WHERE project_id = 'p21' AND tech_entry_id = 'pte_sx_ef03';

UPDATE public.project_tech_topics SET
  body_md = $body$
模擬排液での結果は、実排液に入っている他の成分で簡単に崩れる。だから「どこの、どの工程の、どういう性状の液か」を、試験の結果とは別に残す。

食品工場の排液は、有機物が多いことがそのまま評価方法の制約になる。炭素が多いとICP-MSで金属を測れないので、処理の前後でCOD値を測って成分が減ったかを見る。

排液を受け取る位置も性状を決める。メイト社から前回受け取った液は1次処理後と2次処理後のもので、原液ではなかった。原液に近い液の提供は了承が取れている。

訪問日程・次の約束・調整中の相手は、進捗管理の関係先タブが正本。ここには性状だけを置く。
  $body$,
  check_reason = '各社の排液について、採取位置、成分表、pH、COD、対象金属の濃度を受領時に確定する',
  updated_by = 'amie', updated_at = now()
WHERE tech_topic_id = 'ptt_sx_effluent_sources';

-- ══ 2. 技術タブの一番上に置く性能一覧 ═══════════════════════════════════════
INSERT INTO public.project_tech_topics (
  tech_topic_id, project_id, block_kind, title, summary, body_md, tech_domain,
  sort_order, status, confidentiality, source_kind, source_ref,
  created_by, updated_by, needs_check, check_reason, updated_at
) VALUES (
  'ptt_sx_spec_sheet',
  'p21',
  'condition',
  'シアノバクテリアの性能一覧',
  'どういう環境なら生きられるか、どういう条件で力を発揮するか、何を取り込めて何を生み出せるか、強化株で何が変わるかを1枚にまとめる。',
  $body$
この表はまとめ。値そのものの正本は下の各トピック (培養の成立条件 / リアクターの運転条件 / 対象にできる物質 / 使えなくなる条件 / 排液から取れる有価物 / バイオ燃料) にあり、金額はコスト試算タブにある。ここを直すときは元のトピックも直す。

⚠ が付いている行は、実測が無い・資料間で値が食い違う・単回の試験しかない行。値の下に赤字で、何を確かめれば確定するかが出る。
  $body$,
  '性能まとめ',
  5,
  'active',
  'confidential',
  'manual',
  '技術タブの各トピックからの再掲 (出典は行ごとに記載)',
  'amie',
  'amie',
  false,
  null,
  now()
)
ON CONFLICT (tech_topic_id) DO UPDATE SET
  block_kind = EXCLUDED.block_kind,
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
  -- 【生きられる環境】
  ('pte_sx_ss01','ptt_sx_spec_sheet','p21','【生きられる環境】温度',null,
   45,70,'運転はこの範囲。生き物としては70〜90℃まで活動する','℃',null,
   '培養・処理とも','2025-11-05','high','meeting','2025-11-05 杉浦先生 (pte_sx_k01 / k14)',
   '高温で運転できることが処理の速さに効いている。',10,'amie','amie',false,null,now()),
  ('pte_sx_ss02','ptt_sx_spec_sheet','p21','【生きられる環境】低い温度',null,
   null,null,'死なないが増えない',null,null,
   '河川の水温程度','2026-01-20','high','meeting','2026-01-20 SX定例MTG (pte_sx_k15 / k23)',
   '外へ流れ出ても大量に繁殖しない、という環境影響の説明に使える。バイオフィルムも作らない。',20,'amie','amie',false,null,now()),
  ('pte_sx_ss03','ptt_sx_spec_sheet','p21','【生きられる環境】pH (培養槽)',null,
   7.5,7.5,'程度',null,null,
   '放っておくと上がるので、7.5へ戻す制御が要る','2025-11-05','high','meeting','2025-11-05 杉浦先生 (pte_sx_k02 / k16)',
   null,30,'amie','amie',false,null,now()),
  ('pte_sx_ss04','ptt_sx_spec_sheet','p21','【生きられる環境】pH (酸性の排液)',null,
   2.6,null,'pH2.6の鉄模擬排液で成立した単回試験あり。現場の酸性排水はpH2〜5が多い',null,null,
   '培地成分を含まない水とFe(NO₃)₃のみの液。実排水では未確認','2026-09-02','low','meeting','2026-09-02 SX定例MTG / SX 定例報告会_260902 (pte_sx_r22 / l14)',
   '通常この酸性度では光合成できず死ぬ。鉄を取り込むにつれてpHが上がった。',40,'amie','amie',true,
   'pHを中性付近へ調整した条件と、実排水での再現を確認する',now()),
  ('pte_sx_ss05','ptt_sx_spec_sheet','p21','【生きられる環境】塩分',null,
   null,null,'海水がベースの排液では死ぬ',null,null,
   'モリブデンの試験が失敗した原因','2026-02-17','high','meeting','2026-02-17 SX定例MTG (pte_sx_l01 / e05)',
   null,50,'amie','amie',true,'どの塩分濃度から成立しなくなるかの境目が未測定',now()),
  ('pte_sx_ss06','ptt_sx_spec_sheet','p21','【生きられる環境】光',null,
   null,null,'赤650nm・青440〜457nm。市販のLEDで足りる。紫外線だけの光源は不可',null,null,
   'クロロフィルの吸収波長','2025-11-05','high','meeting','2025-11-05 杉浦先生 (pte_sx_k04 / k05 / l12)',
   '処理のときはルームライト程度で足りる。強い光は要らない。',60,'amie','amie',false,null,now()),
  ('pte_sx_ss07','ptt_sx_spec_sheet','p21','【生きられる環境】二酸化炭素',null,
   0.03,10,'空気中の濃度から10%まで','%',null,
   '培養槽へ供給する気体','2025-11-05','high','meeting','2025-11-05 杉浦先生 (pte_sx_k03 / k13)',
   '炭素源は二酸化炭素。足りないと増殖が途中で止まる。濃度を上げるほど速くなるが頭打ちになる。',70,'amie','amie',false,null,now()),
  ('pte_sx_ss08','ptt_sx_spec_sheet','p21','【生きられる環境】使えない相手',null,
   null,null,'光合成を阻害する農薬・薬剤、界面活性剤が多い液、海水ベースの液',null,null,
   '光合成する生き物を使う以上、構造的に処理できない','2026-03-19','high','meeting','2026-03-19 SX定例MTG (pte_sx_l03 / l11 / l01)',
   '詳しくは「使えなくなる条件」のトピック。',80,'amie','amie',false,null,now()),
  -- 【力を発揮する条件】
  ('pte_sx_ss09','ptt_sx_spec_sheet','p21','【力を発揮する条件】増える速さ (標準)',null,
   15,15,'倍加時間','h',null,
   '45℃・二酸化炭素3%','2026-05-19','medium','literature','★SolvioraX_m³換算版 (pte_sx_k07)',
   '細胞の数が2倍になるまでの時間。培養日数と菌体の原価を決める。',90,'amie','amie',false,null,now()),
  ('pte_sx_ss10','ptt_sx_spec_sheet','p21','【力を発揮する条件】増える速さ (工場の排ガス利用)',null,
   4.8,4.8,'従来比。倍加時間は約6時間','倍',null,
   '排液を培地代わりにし、二酸化炭素6.5%の排ガスを吹き込む','2026-01-20','medium','meeting','2026-01-20 SX定例MTG (pte_sx_k18)',
   '杉浦先生「本当に分裂時間が6時間というのを初めて見ました」。本人が予備的な実験と明言。',100,'amie','amie',true,
   '予備的な実験。再現と条件の切り分けが要る',now()),
  ('pte_sx_ss11','ptt_sx_spec_sheet','p21','【力を発揮する条件】処理の速さ',null,
   null,null,'45℃で約30分 / 室温で2〜3時間',null,null,
   '金属が1種類のとき。光はルームライト程度','2026-01-20','high','meeting','2026-01-20 SX定例MTG (pte_sx_k17 / r06)',
   '高い温度で運転する利点がここに出ている。',110,'amie','amie',false,null,now()),
  ('pte_sx_ss12','ptt_sx_spec_sheet','p21','【力を発揮する条件】金属が混ざったとき',null,
   0.5,24,'単体30分 → 混在24時間 (48倍)','h',null,
   '実際の工場排水は混合が普通','2026-05-19','medium','literature','★SolvioraX_m³換算版 (pte_sx_f02 / r07)',
   '処理時間が原価を決めるので、混合排水の扱いが事業性の分かれ目になる。',120,'amie','amie',true,
   '混合の内訳ごとに処理時間を測る。元素間の優先順位は記録が無い',now()),
  ('pte_sx_ss13','ptt_sx_spec_sheet','p21','【力を発揮する条件】有機物のある排液',null,
   null,null,'食品工場の排液で対照より速く増えた',null,null,
   'COD 2,000の食品系排液を50%添加。43時間でpH5→約8','2026-09-02','medium','meeting','2026-09-02 SX定例MTG / SX 定例報告会_260902 (pte_sx_d14 / l02)',
   '高濃度の糖で死ぬと見ていたが、逆に「エサ」として増えた。ただし利用経路は未確定。',130,'amie','amie',true,
   '処理前後のCOD値を測り、どの成分が減ったかを確認する',now()),
  -- 【取り込めるもの】
  ('pte_sx_ss14','ptt_sx_spec_sheet','p21','【取り込めるもの】実験で確認済み',null,
   null,null,'銅 / 鉄 / ニッケル / 反応性窒素',null,null,
   '銅は取り込み効率30 mg/g-DCW、除去速度75 mg/L・h','2026-05-19','high','measurement','★SolvioraX_m³換算版・SX定例MTG (pte_sx_e01〜e04)',
   '煮豆排液の実試験では鉄を完全に除去できた。',140,'amie','amie',false,null,now()),
  ('pte_sx_ss15','ptt_sx_spec_sheet','p21','【取り込めるもの】試験中・これから',null,
   null,null,'レアアース / コバルト / カドミウム / 鉛 / クロム / ヒ素 / 亜鉛 / アルミ / モリブデン / 色素',null,null,
   '排液の調達段階か、評価前の段階','2026-08-28','medium','manual','技術タブ「対象にできる物質」 (pte_sx_e05〜e14)',
   'モリブデンは海水ベースの排液で一度失敗。色素は目標値のみで実試験は未達。',150,'amie','amie',true,
   '元素ごとに、どこまで確かめたかは「対象にできる物質」を見る',now()),
  ('pte_sx_ss16','ptt_sx_spec_sheet','p21','【取り込めるもの】鉄の取り込み量 (野生型)',null,
   40,40,'24時間で取り込める上限','ppm',null,
   'OD5・鉄模擬排液・24時間の単回試験','2026-09-02','medium','measurement','2026-09-02 SX定例MTG / SX 定例報告会_260902 (pte_sx_r19)',
   'めっき工場の排水は鉄が500ppm程度になりうるという現場情報がある。',160,'amie','amie',true,
   '再現性実験と、実排水での確認',now()),
  ('pte_sx_ss17','ptt_sx_spec_sheet','p21','【取り込めるもの】元素の選好',null,
   null,null,'鉄と亜鉛は速度が速く濃度も高い傾向。元素間の優先順位は記録が無い',null,null,
   'メタロチオネイン強化株での基礎実験','2026-08-18','low','meeting','SX 定例報告会 (2026-08-18) (pte_sx_f01 / f03)',
   '「重金属が好き」は対外説明用の言い回しで、選好を示すデータではない。',170,'amie','amie',true,
   '複数金属が共存する条件で、どれから取り込むかを測る',now()),
  -- 【生み出せるもの】
  ('pte_sx_ss18','ptt_sx_spec_sheet','p21','【生み出せるもの】バイオ燃料',null,
   48,130,'2,000 L級設備で年間 (試算値)','kg/年',null,
   'ラボで燃料化した経験あり。市場導入は既存燃料への数%混合から','2026-08-19','low','estimate','260819 バイオ燃料アップサイド検討資料 (pte_sx_bf01〜bf05)',
   '実測ではなく試算。重金属回収は菌体が死ぬので、燃料生産とは別ラインになる。',180,'amie','amie',true,
   '実出力、連続運転時の生産性、培養から燃料化までの製造原価を取得する',now()),
  ('pte_sx_ss19','ptt_sx_spec_sheet','p21','【生み出せるもの】ケルセチン',null,
   null,null,'カルコンから変換された可能性 (同定されていない)',null,null,
   '煮豆排液で色素が除去されず色が濃くなった現象の説明として','2026-07-01','low','literature','SX_NIMAME_INTERNAL_SHARE_20260702.pdf (pte_sx_v02)',
   '「有価物が取れた」と語られているのはこれ。可能性の指摘であって確認された物質ではない。',190,'amie','amie',true,
   '同定 / 収率 / 精製コスト / 品質保証の4点が未確認のまま止まっている',now()),
  ('pte_sx_ss20','ptt_sx_spec_sheet','p21','【生み出せるもの】その他の有価物の候補',null,
   null,null,'フィコシアニン (菌体側の青色成分) / イソフラボン / ポリフェノール',null,null,
   '煮豆排液の試験で挙がった候補。アントシアニンは期待薄','2026-07-01','low','literature','SX_NIMAME_INTERNAL_SHARE_20260702.pdf (pte_sx_v03〜v06)',
   'フィコシアニンは排液由来ではなく、自社の菌がもともと持っている成分。',200,'amie','amie',true,
   '同定も収率も未確認。事業計画のアップサイドにも入っていない',now()),
  ('pte_sx_ss21','ptt_sx_spec_sheet','p21','【生み出せるもの】回収した金属',null,
   85,95,'菌体から金属を取り出す側の回収率','%',null,
   '取り込んだ菌体を酸処理して回収','2026-05-19','low','literature','★SolvioraX_m³換算版 (85%) / SolvioraX_CAPEX_OPEX_v2 (95%) (pte_sx_r15)',
   '資料によって値が違う。既存の物理化学処理では金属が汚泥に混ざるため取り出して売るのは難しく、ここが差になる。',210,'amie','amie',true,
   '85%と95%のどちらを採るか。実測で確定する',now()),
  ('pte_sx_ss22','ptt_sx_spec_sheet','p21','【生み出せるもの】二酸化炭素の吸収',null,
   null,null,'光合成で消費する',null,null,
   '排水処理とカーボンニュートラルを同時に扱う訴求軸','2026-08-29','high','manual','技術タブ「排水処理方式の星取り表」 (pte_sx_c41)',
   '2,000L培養で反応性窒素580 kg/年を削減できるという試算もある。',220,'amie','amie',false,null,now()),
  ('pte_sx_ss23','ptt_sx_spec_sheet','p21','【生み出せるもの】事業計画での置き方',null,
   0,0,'主ケースでは有価物の収入を見込んでいない','円/m³',null,
   '未確認のものを収入に入れない、という保守的な置き方','2026-07-01','medium','literature','SX_NIMAME_INTERNAL_SHARE_20260702.pdf (pte_sx_v07 / v11)',
   'アップサイドは「バイオ燃料・レアアース回収・カーボンクレジット」の3つ。煮豆由来の有価物は入っていない。金額はコスト試算タブが正本。',230,'amie','amie',false,null,now()),
  -- 【株による違い】
  ('pte_sx_ss24','ptt_sx_spec_sheet','p21','【株による違い】いま使っている株',null,
   null,null,'野生株 (遺伝子組み換えではない)',null,null,
   '通常の運転','2026-01-20','high','meeting','2026-01-20 SX定例MTG (pte_sx_k11)',
   null,240,'amie','amie',false,null,now()),
  ('pte_sx_ss25','ptt_sx_spec_sheet','p21','【株による違い】強化株1 (TmtA 遺伝子2つ)',null,
   50,null,'24時間で50 ppmを全量取り込み。上限は未到達','ppm',null,
   'OD5・鉄模擬排液 (培地成分なし)・24時間の単回試験','2026-09-02','medium','measurement','2026-09-02 SX定例MTG / SX 定例報告会_260902 (pte_sx_r20 / r21 / r25 / d16)',
   '野生型は40 ppmが最大。取り込み量は2.5 mg-Fe / 47 mg-DCW (乾燥菌体重量の5.3%)。pHを2.6から6.2まで上げ、ただの水に近くした。重金属結合タンパク質TmtAが鉄と結合しているという間接的な結果 (杉浦先生いわく新しい発見)。',250,'amie','amie',true,
   '再現性実験、Fe消費の半減期による野生型との比較、pHを中性付近へ調整した条件での取り込み試験',now()),
  ('pte_sx_ss26','ptt_sx_spec_sheet','p21','【株による違い】強化株2 (TmtA 遺伝子3つ)',null,
   null,null,'試験前。約100mLまで培養中',null,null,
   '試験できる菌体量まで増殖中','2026-09-02','high','meeting','2026-09-02 SX定例MTG / SX 定例報告会_260902 (pte_sx_d11)',
   'さらに鉄の取り込みを強めたねらいの株。性能はまだ何も測れていない。',260,'amie','amie',true,
   '菌体量が揃い次第、野生型・強化株1と同じ鉄取り込み試験を行う',now()),
  ('pte_sx_ss27','ptt_sx_spec_sheet','p21','【株による違い】強化株を使うときの制約',null,
   null,null,'完全な開放系では使えない。外へ出すには選抜用の遺伝子を外す操作と手続きが要る',null,null,
   '遺伝子組み換え株を実運用する場合','2026-01-20','high','meeting','2026-01-20 SX定例MTG (pte_sx_l07 / k11)',
   '取り込み性能が上がっても、そのまま現場へ持って行けるわけではない。',270,'amie','amie',false,null,now()),
  ('pte_sx_ss28','ptt_sx_spec_sheet','p21','【株による違い】株を改変できること自体の価値',null,
   null,null,'高温性シアノバクテリアはゲノムのコピー数が多く、改変が世界的に難しい',null,null,
   '改変にはゲノム配列が分かっている必要がある','2026-03-19','high','meeting','2026-03-19 SX定例MTG (pte_sx_k24)',
   'このバイオのノウハウ自体が技術的な優位性になっている。',280,'amie','amie',false,null,now())
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

COMMIT;
