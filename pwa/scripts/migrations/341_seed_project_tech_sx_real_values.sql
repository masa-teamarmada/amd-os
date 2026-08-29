-- 341_seed_project_tech_sx_real_values.sql
-- SX (p21) の技術台帳を、実測値・実試算で入れ直す。
--
-- 340 では project_knowledge の断片しか見ておらず、培養条件を9項目すべて「未測定」として入れてしまった。
-- まさの指摘 (2026-08-29):
--   「これまでのMTGで何度も杉浦先生言ってるよ。だからnotionの『文字起こし』を見てと言ったの」
--   「SXの処理単価、めちゃくちゃ高くない? こないだちこちゃんが作ったコスト試算表見てないの?」
--
-- 値の出所は source_cache の生データ:
--   gmeet_minutes 2025-11-05「MTG コバシロボティクス<>愛媛大杉浦先生」(32,860字) = 培養の制御条件
--   drive ★SolvioraX_m³換算版 (2026-05-19) = リアクターの運転条件
--   drive SX_コスト試算_260716 / 260730、project_cost_assumptions (cm_p21_260820) = 単価と原価
--   gmeet_minutes 2026-01-20 SX定例、2025-12-23 int-PS2 = 対象元素の状態
-- 単位は m³ で書く (「立方メートル」と綴らない。まさ確定 2026-08-29)。

begin;

delete from project_tech_entries where project_id = 'p21';
delete from project_tech_topics where project_id = 'p21';

insert into project_tech_topics
  (tech_topic_id, project_id, block_kind, title, summary, body_md, tech_domain, sort_order,
   confidentiality, source_kind, source_ref, created_by, updated_by)
values (
  'ptt_sx_principle', 'p21', 'article',
  '高熱性シアノバクテリアで排水を処理するとはどういうことか',
  '何を使って水の中の何を取り除いているか。培養とリアクターの2段構成で、成立を決めるのはどの値か。',
$md$
シアノバクテリアは光合成をする細菌。高熱性の株は、常温で増える株より高い温度で増える。

排水処理に高い温度で働く株を使う利点は三つある。雑菌が増えにくいので培養が安定する。反応が速い。工場から出た排水が熱いまま処理でき、冷ます工程が要らない。

SX が狙うのは、重金属を含む排水と、色のついた排水。細胞が金属を取り込むか細胞の表面に吸着させることで、水から金属を取り除く。同時に光合成で二酸化炭素を消費する。既存の排水処理は薬品を入れて沈殿させ、金属は汚泥として産業廃棄物になる。ここが置き換えの狙いどころで、金属を回収して売れるなら処理費の一部を取り返せる。

## 装置は2段構成

杉浦先生の設計は、最適な条件で細胞を継続して培養する段と、その細胞を回収して排水槽で使う段に分かれる (2025-11-05)。培養側はチューブ型で、以前ユーグレナで使われた浅いプール型 (レースウェイ型) より光の制御がしやすい。難点は放熱しやすいこと。

培養側で効くのは温度・pH・光・二酸化炭素濃度の四つ。排水処理側で効くのは、水に溶けている金属の濃度、菌体1グラムあたりが取り込める金属の量、水がリアクターに留まる時間の三つ。下の二つの表がそれぞれの現在値。

## いま何が決まっていて、何が動くか

培養側の条件は杉浦先生が値を持っている。動くのは排水処理側で、とくに菌体1グラムあたりの取り込み量 (取り込み効率) が事業の成否を決める。同じ量の水を処理するのに必要な菌体量が変わり、菌体をつくる費用がそのまま原価に乗るため。この値は資料によって 30 mg/g-DCW (銅、実測値は15超) と 50 mg/g-DCW (コスト試算の置き値) で食い違っており、下の表では両方を出典つきで並べている。

もう一つ動くのは、菌体を何回使い回せるか。現在のコスト試算は「1回で使い捨て」という最も保守的な置き方で、10回を超えると培養の費用は誤差になる。
$md$,
  '培養', 10, 'confidential', 'meeting',
  '2025-11-05 MTG コバシロボティクス<>愛媛大杉浦先生 (文字起こし)',
  'amie', 'amie'
), (
  'ptt_sx_culture', 'p21', 'condition',
  '培養の成立条件',
  '杉浦先生がチューブ型装置の制御条件として挙げた値 (2025-11-05)。',
  null, '培養', 20, 'confidential', 'meeting',
  '2025-11-05 MTG コバシロボティクス<>愛媛大杉浦先生 (文字起こし)',
  'amie', 'amie'
), (
  'ptt_sx_reactor', 'p21', 'condition',
  'リアクターの運転条件',
  '排水を処理する側の値。取り込み効率と滞留時間が原価を決める。',
  null, '排水処理', 30, 'confidential', 'literature',
  '★SolvioraX_m³換算版 (2026-05-19) / SX_コスト試算 (cm_p21_260820)',
  'amie', 'amie'
), (
  'ptt_sx_elements', 'p21', 'condition',
  '対象にできる物質',
  'どの金属をどこまで確かめてあるか。実測のある元素と、これから評価する元素を分ける。',
  null, '排水処理', 40, 'confidential', 'meeting',
  'SX定例MTG (2026-01-20) / 月次業務報告書 / int-PS2 (2025-12-23)',
  'amie', 'amie'
), (
  'ptt_sx_compare', 'p21', 'matrix',
  '排水処理方式の星取り表',
  'SX と既存の物理化学処理・生物処理を6つの軸で比べる。空欄は調べていないところ。',
  null, '排水処理', 50, 'internal', 'literature',
  'SX_コスト試算_260716 / 260730 / project_cost_assumptions (cm_p21_260820)',
  'amie', 'amie'
), (
  'ptt_sx_price', 'p21', 'record',
  '処理単価と原価の見立ての推移',
  '同じ技術でも用途で原価が20倍違う。いつ何を根拠に単価が動いたか。',
  null, '排水処理', 60, 'internal', 'literature',
  'SX_コスト試算 各版 / 260714 EWIR action deck',
  'amie', 'amie'
), (
  'ptt_sx_record', 'p21', 'record',
  '装置と実験の到達実績',
  '装置と試験がいつどこまで進んだか。',
  null, '培養', 70, 'internal', 'meeting',
  'project_knowledge (p21 tech) / SX定例MTG',
  'amie', 'amie'
);

insert into project_tech_entries
  (tech_entry_id, tech_topic_id, project_id, row_label, col_label, value_min, value_max, value_text, unit,
   rating, condition_text, observed_on, confidence, source_kind, source_ref, note, sort_order, created_by, updated_by)
values
-- 培養の成立条件 (2025-11-05 杉浦先生)
('pte_sx_k01', 'ptt_sx_culture', 'p21', '培養温度', null, 45, 70, null, '℃',
 null, '実際に使う範囲', '2025-11-05', 'high', 'meeting', '2025-11-05 杉浦先生 (文字起こし)',
 '生物としてはもっと広い範囲で生きるが、運転はこの範囲で制御する', 10, 'amie', 'amie'),
('pte_sx_k02', 'ptt_sx_culture', 'p21', 'pH', null, 7.5, 7.5, '程度', null,
 null, '培養槽内', '2025-11-05', 'high', 'meeting', '2025-11-05 杉浦先生 (文字起こし)',
 '空気と二酸化炭素を交互に入れることで制御できると見ている', 20, 'amie', 'amie'),
('pte_sx_k03', 'ptt_sx_culture', 'p21', '二酸化炭素濃度', null, 0.03, 10, '空気中の濃度から10%まで', '%',
 null, '培養槽へ供給する気体', '2025-11-05', 'high', 'meeting', '2025-11-05 杉浦先生 (文字起こし)',
 '濃度を上げると増殖が速くなるが、途中で頭打ちになる。そこで光強度を上げて調整する', 30, 'amie', 'amie'),
('pte_sx_k04', 'ptt_sx_culture', 'p21', '光の波長 (赤)', null, 650, 650, 'おおよその値', 'nm',
 null, 'クロロフィルの吸収波長', '2025-11-05', 'high', 'meeting', '2025-11-05 杉浦先生 (文字起こし)',
 '一般的なLEDの波長で足りる。専用の波長をあつらえる必要はない', 40, 'amie', 'amie'),
('pte_sx_k05', 'ptt_sx_culture', 'p21', '光の波長 (青)', null, 440, 457, null, 'nm',
 null, 'クロロフィルの吸収波長', '2025-11-05', 'high', 'meeting', '2025-11-05 杉浦先生 (文字起こし)',
 '白色光でも育つが、使われない波長が多く無駄になる', 50, 'amie', 'amie'),
('pte_sx_k06', 'ptt_sx_culture', 'p21', '光強度', null, null, null, '絶対値の指定なし。増殖が鈍ったら1.5倍へ上げるなど可変で制御', null,
 null, null, '2025-11-05', 'medium', 'meeting', '2025-11-05 杉浦先生 (文字起こし)',
 '屋外光だけでは足りず、実験室では光を足す前提', 60, 'amie', 'amie'),
('pte_sx_k07', 'ptt_sx_culture', 'p21', '倍加時間', null, 15, 15, null, 'h',
 null, '45℃・二酸化炭素3%', '2026-05-19', 'medium', 'literature', '★SolvioraX_m³換算版 (2026-05-19)',
 '細胞の数が2倍になるまでの時間。培養にかかる日数と菌体の原価を決める', 70, 'amie', 'amie'),
('pte_sx_k08', 'ptt_sx_culture', 'p21', '連続で監視する項目', null, null, null, 'OD (730nm付近の吸光度) / pH / 光強度 / 槽内温度 / 二酸化炭素と空気', null,
 null, null, '2025-11-05', 'high', 'meeting', '2025-11-05 杉浦先生 (文字起こし)',
 'いまは手作業。これを自動制御にしたいというのが装置化の要望', 80, 'amie', 'amie'),
('pte_sx_k09', 'ptt_sx_culture', 'p21', '培養装置の形式', null, null, null, 'チューブ型', null,
 null, null, '2025-11-05', 'high', 'meeting', '2025-11-05 杉浦先生 (文字起こし)',
 '浅いプール型 (レースウェイ型) より光を制御しやすい。難点は放熱しやすいこと', 90, 'amie', 'amie'),
('pte_sx_k10', 'ptt_sx_culture', 'p21', '培養装置の容量 (実験機)', null, 50, 100, null, 'L',
 null, '長さ6m程度。実験室の最長辺が8m', '2025-11-05', 'high', 'meeting', '2025-11-05 杉浦先生 (文字起こし)',
 null, 100, 'amie', 'amie'),
('pte_sx_k11', 'ptt_sx_culture', 'p21', '使っている株', null, null, null, '野生株 (遺伝子組み換えではない)', null,
 null, null, '2026-01-20', 'high', 'meeting', '2026-01-20 SX定例MTG (文字起こし)',
 '重金属の取り込みを強めた遺伝子組み換え株もあるが、完全な開放系では使えず、外へ出すには手続きが要る', 110, 'amie', 'amie'),
('pte_sx_k12', 'ptt_sx_culture', 'p21', '培地の費用', null, 65, 65, null, '円/L',
 null, '工業用試薬を想定', '2026-05-19', 'medium', 'literature', '★SolvioraX_m³換算版 (2026-05-19)',
 '研究用の130円/Lから半減させた置き値', 120, 'amie', 'amie'),

-- リアクターの運転条件
('pte_sx_r01', 'ptt_sx_reactor', 'p21', '対象金属の濃度', null, 50, 50, null, 'ppm',
 null, '基準ケース', '2026-05-19', 'high', 'literature', '★SolvioraX_m³換算版 / コスト試算 (V-401)',
 '目標は300ppm。濃い排水ほど1m³あたりの採算が良くなる', 10, 'amie', 'amie'),
('pte_sx_r02', 'ptt_sx_reactor', 'p21', '取り込み効率 (銅)', null, 30, 30, null, 'mg/g-DCW',
 null, '銅の場合', '2026-05-19', 'medium', 'literature', '★SolvioraX_m³換算版 (2026-05-19)',
 '実測値は15超。菌体1グラムあたりが取り込める金属の量で、事業の成否を決める最重要の値', 20, 'amie', 'amie'),
('pte_sx_r03', 'ptt_sx_reactor', 'p21', '取り込み効率 (コスト試算の置き値)', null, 50, 50, null, 'mg/g-DCW',
 null, '0.05 g金属/g菌体', '2026-08-20', 'low', 'estimate', 'project_cost_assumptions cm_p21_260820 (V-402、確度H)',
 '★m³換算版の30 mg/g-DCWと食い違う。どちらを採るかで必要菌体量が1.7倍変わるため、次のMTGで確定させる', 30, 'amie', 'amie'),
('pte_sx_r04', 'ptt_sx_reactor', 'p21', '金属の除去速度', null, 75, 75, null, 'mg/L・h',
 null, null, '2026-05-19', 'medium', 'literature', '★SolvioraX_m³換算版 (2026-05-19)',
 '実測値は50超', 40, 'amie', 'amie'),
('pte_sx_r05', 'ptt_sx_reactor', 'p21', '滞留時間 (基準)', null, 1, 1, null, 'h',
 null, '基準ケース', '2026-05-19', 'medium', 'literature', '★SolvioraX_m³換算版 (2026-05-19)',
 'コスト試算では反応時間4時間で置き、1/4/8時間で感度をみている', 50, 'amie', 'amie'),
('pte_sx_r06', 'ptt_sx_reactor', 'p21', '滞留時間 (単体の金属)', null, 0.5, 0.5, null, 'h',
 null, '金属が1種類のとき', '2026-05-19', 'medium', 'literature', '★SolvioraX_m³換算版 (2026-05-19)',
 null, 60, 'amie', 'amie'),
('pte_sx_r07', 'ptt_sx_reactor', 'p21', '滞留時間 (複数の金属が混在)', null, 24, 24, null, 'h',
 null, '混合排水', '2026-05-19', 'medium', 'literature', '★SolvioraX_m³換算版 (2026-05-19)',
 '単体の48倍。実際の工場排水は混合が普通なので、ここが処理量の上限を決める', 70, 'amie', 'amie'),
('pte_sx_r08', 'ptt_sx_reactor', 'p21', '運転時の菌体濃度', null, 5, 5, null, 'g-DCW/L',
 null, null, '2026-08-20', 'high', 'literature', 'project_cost_assumptions cm_p21_260820',
 null, 80, 'amie', 'amie'),
('pte_sx_r09', 'ptt_sx_reactor', 'p21', '菌体の回収率', null, 90, 90, null, '%',
 null, null, '2026-08-20', 'low', 'estimate', 'project_cost_assumptions cm_p21_260820 (V-501、確度H)',
 null, 90, 'amie', 'amie'),
('pte_sx_r10', 'ptt_sx_reactor', 'p21', '菌体の使用回数', null, 1, 1, null, '回',
 null, '現在の置き方', '2026-08-20', 'low', 'estimate', 'project_cost_assumptions cm_p21_260820',
 '1 = 再利用せず毎回新品という最も保守的な仮定。10回を超えると培養の費用は誤差になる。色素分解なら数十回使い回せる可能性があるが未確認', 100, 'amie', 'amie'),
('pte_sx_r11', 'ptt_sx_reactor', 'p21', 'カートリッジの寿命', null, 50, 50, null, 'm³/本',
 null, null, '2026-05-19', 'low', 'literature', '★SolvioraX_m³換算版 (2026-05-19)',
 'コスト試算では菌体保持モジュールの耐用を50バッチで置き、20/50/100回で感度をみている', 110, 'amie', 'amie'),
('pte_sx_r12', 'ptt_sx_reactor', 'p21', '処理流量 (試算の前提)', null, 10, 10, null, 'm³/h',
 null, '8時間/日 × 300日/年', '2026-08-11', 'high', 'literature', 'SX_コスト試算_260730',
 '既存の1000m³タンクを流用する前提', 120, 'amie', 'amie'),

-- 対象にできる物質
('pte_sx_e01', 'ptt_sx_elements', 'p21', '銅', null, null, null, '取り込み効率の実測あり (30 mg/g-DCW、実測値15超)', null,
 null, null, '2026-05-19', 'high', 'literature', '★SolvioraX_m³換算版 (2026-05-19)',
 'JAFCOが銅回収に強い関心 (2026-05-13)', 10, 'amie', 'amie'),
('pte_sx_e02', 'ptt_sx_elements', 'p21', '鉛', null, null, null, 'ペロブスカイト太陽電池の排水で初期検討', null,
 null, '水に溶けた金属イオンが対象', '2026-06-19', 'medium', 'meeting', 'ファインケム株式会社 打合せ (2026-06-19)',
 '申請書では鉛・クロム・ヒ素の適用評価を明確にすることが要件', 20, 'amie', 'amie'),
('pte_sx_e03', 'ptt_sx_elements', 'p21', 'コバルト', null, null, null, '太陽石油から廃液を受領して試験予定', null,
 null, null, '2026-01-20', 'medium', 'meeting', '2026-01-20 SX定例MTG (文字起こし)',
 null, 30, 'amie', 'amie'),
('pte_sx_e04', 'ptt_sx_elements', 'p21', 'クロム', null, null, null, '適用評価が必要 (未実施)', null,
 null, null, '2025-12-23', 'medium', 'meeting', 'int-PS2 todo整理 (2025-12-23 文字起こし)',
 '廃液が手に入らなくても、意図的に溶かして検証する案がある', 40, 'amie', 'amie'),
('pte_sx_e05', 'ptt_sx_elements', 'p21', 'ヒ素', null, null, null, '適用評価が必要 (未実施)', null,
 null, null, '2025-12-23', 'medium', 'meeting', 'int-PS2 todo整理 (2025-12-23 文字起こし)',
 null, 50, 'amie', 'amie'),
('pte_sx_e06', 'ptt_sx_elements', 'p21', 'レアアース', null, null, null, '評価対象領域として色素脱色より優先', null,
 null, null, '2026-08-28', 'high', 'literature', 'SX_月次業務報告書 202608',
 'せとのわ経由でメイト社のレアアース含有廃液を入手交渉中', 60, 'amie', 'amie'),
('pte_sx_e07', 'ptt_sx_elements', 'p21', '色素 (金属以外)', null, null, null, '分解の用途。原価は金属回収の18分の1', null,
 null, null, '2026-07-13', 'high', 'literature', '260714 SolvioraX EWIR action deck',
 '菌体を使い回せる可能性があり、そこが金属回収との原価差を生んでいる', 70, 'amie', 'amie'),
('pte_sx_e08', 'ptt_sx_elements', 'p21', '取り込みの仕組み', null, null, null, '取り込むトランスポーターと還元の経路が要る', null,
 null, null, '2026-01-16', 'medium', 'meeting', '杉浦先生ヒアリング (2026-01-16 文字起こし)',
 '取り込みを強めるタンパク質を1つ入れた株では取り込み量が増えた。2つ目を入れても伸びはその程度', 80, 'amie', 'amie'),

-- 星取り表
('pte_sx_c11', 'ptt_sx_compare', 'p21', '顧客が払う単価', 'SX (自社)', 500, 500, null, '円/m³',
 'fair', '想定売上単価', '2026-08-20', 'medium', 'literature', 'project_cost_assumptions cm_p21_260820 (確度C)',
 '既存処理が500円/m³前後という前提から置いた値。用途別の実勢価格では未検証', 11, 'amie', 'amie'),
('pte_sx_c12', 'ptt_sx_compare', 'p21', '顧客が払う単価', '既存の物理化学処理', 500, 500, '前後', '円/m³',
 'fair', '市場の競争環境の目安', '2026-07-29', 'medium', 'literature', 'SX_コスト試算_260716',
 '同じ水準に置いている。ここを上回る価格は通らないという前提', 12, 'amie', 'amie'),
('pte_sx_c13', 'ptt_sx_compare', 'p21', '顧客が払う単価', '既存の生物処理', null, null, '未確認', null,
 'unknown', null, null, 'unverified', 'manual', null, 'エキスパート面談で取る対象', 13, 'amie', 'amie'),

('pte_sx_c21', 'ptt_sx_compare', 'p21', 'SX側の原価', 'SX (自社)', 467.63, 467.63, null, '円/m³',
 'poor', '色素分解ケース・既存タンク流用', '2026-08-11', 'medium', 'literature', 'SX_コスト試算_260730',
 '売価500円の93.5%を原価が占める。目標は300〜400円/m³。金属回収ケースでは原価10,780円/m³で桁が違う', 21, 'amie', 'amie'),
('pte_sx_c22', 'ptt_sx_compare', 'p21', 'SX側の原価', '既存の物理化学処理', null, null, '対象外', null,
 'na', null, null, 'high', 'manual', null, '比較しているのは顧客が払う単価のほう', 22, 'amie', 'amie'),
('pte_sx_c23', 'ptt_sx_compare', 'p21', 'SX側の原価', '既存の生物処理', null, null, '対象外', null,
 'na', null, null, 'high', 'manual', null, null, 23, 'amie', 'amie'),

('pte_sx_c31', 'ptt_sx_compare', 'p21', '重金属の回収', 'SX (自社)', null, null, '取り込んだ菌体を酸処理して回収', null,
 'good', null, '2026-07-13', 'medium', 'literature', '260714 SolvioraX EWIR action deck',
 '銅で取り込み効率の実測あり。回収した金属を売れれば処理費の一部を取り返せる', 31, 'amie', 'amie'),
('pte_sx_c32', 'ptt_sx_compare', 'p21', '重金属の回収', '既存の物理化学処理', null, null, '汚泥として除去', null,
 'fair', null, null, 'medium', 'literature', null,
 '薬品で沈殿させるため金属は汚泥に混ざる。取り出して売るのは難しい', 32, 'amie', 'amie'),
('pte_sx_c33', 'ptt_sx_compare', 'p21', '重金属の回収', '既存の生物処理', null, null, '対象外', null,
 'na', null, null, 'medium', 'literature', null, '有機物の分解が目的の方式', 33, 'amie', 'amie'),

('pte_sx_c41', 'ptt_sx_compare', 'p21', '二酸化炭素', 'SX (自社)', null, null, '光合成で消費', null,
 'excellent', null, null, 'high', 'meeting', 'project_knowledge (p21 market)',
 '既存の排水処理課題とカーボンニュートラルを同時に扱う点が訴求軸', 41, 'amie', 'amie'),
('pte_sx_c42', 'ptt_sx_compare', 'p21', '二酸化炭素', '既存の物理化学処理', null, null, '未確認', null,
 'unknown', null, null, 'unverified', 'manual', null, '薬品の製造分を含めた排出量は調べていない', 42, 'amie', 'amie'),
('pte_sx_c43', 'ptt_sx_compare', 'p21', '二酸化炭素', '既存の生物処理', null, null, '未確認', null,
 'unknown', null, null, 'unverified', 'manual', null, null, 43, 'amie', 'amie'),

('pte_sx_c51', 'ptt_sx_compare', 'p21', '廃棄物', 'SX (自社)', null, null, '使用済み菌体を酸処理へ回す', null,
 'fair', null, null, 'medium', 'literature', 'SX_コスト試算 (残渣処分・廃液処理を計上)',
 '菌体そのものの処分費は残渣処分6円/m³・廃液処理4円/m³として計上済み', 51, 'amie', 'amie'),
('pte_sx_c52', 'ptt_sx_compare', 'p21', '廃棄物', '既存の物理化学処理', null, null, '産業廃棄物として発生', null,
 'poor', null, '2026-07-07', 'medium', 'meeting', '2026-07-07 ビザスク面談 (山田様)',
 '産廃の委託先が逼迫しているという現場感が出ている', 52, 'amie', 'amie'),
('pte_sx_c53', 'ptt_sx_compare', 'p21', '廃棄物', '既存の生物処理', null, null, '余剰汚泥が出る', null,
 'fair', null, null, 'medium', 'literature', null, null, 53, 'amie', 'amie'),

('pte_sx_c61', 'ptt_sx_compare', 'p21', '運転に要る人手', 'SX (自社)', null, null, '1バッチ5.75時間 (循環方式) / 7.5時間 (投入方式)', null,
 'unknown', '100m³ケース', '2026-08-20', 'high', 'literature', 'project_cost_assumptions (中島試算シート)',
 '人件費単価は4,000円/h で計上', 61, 'amie', 'amie'),
('pte_sx_c62', 'ptt_sx_compare', 'p21', '運転に要る人手', '既存の物理化学処理', null, null, '未確認', null,
 'unknown', null, null, 'unverified', 'manual', null, null, 62, 'amie', 'amie'),
('pte_sx_c63', 'ptt_sx_compare', 'p21', '運転に要る人手', '既存の生物処理', null, null, '未確認', null,
 'unknown', null, null, 'unverified', 'manual', null, null, 63, 'amie', 'amie'),

-- 単価と原価の推移
('pte_sx_p01', 'ptt_sx_price', 'p21', '想定処理単価', null, 2500, 3000, null, '円/m³',
 null, '事業計画上の想定単価', '2026-03-30', 'high', 'meeting', '2026-03-30 SX MTG',
 '当初5,000円から調整した値。この後の試算で大きく下がる', 10, 'amie', 'amie'),
('pte_sx_p02', 'ptt_sx_price', 'p21', '想定処理単価', null, 8000, 8000, '顧客請求額として', '円/m³',
 null, 'リアクター処理工程の置き値', '2026-05-19', 'medium', 'literature', '★SolvioraX_m³換算版 (2026-05-19)',
 'この版では変動費が桁違いに大きく、大幅赤字と出ていた (培養液量の計算式に要検証の指摘あり)', 20, 'amie', 'amie'),
('pte_sx_p03', 'ptt_sx_price', 'p21', '総原価 (金属回収)', null, 10780, 10780, null, '円/m³',
 null, '1回使用して酸処理・既存設備流用', '2026-07-13', 'medium', 'literature', '260714 SolvioraX EWIR action deck',
 '98%がOPEX。菌体生産と充填・品質確認・酸処理で約90%を占める。シアノ投入量2.185 kg-DCW/m³', 30, 'amie', 'amie'),
('pte_sx_p04', 'ptt_sx_price', 'p21', '総原価 (色素分解)', null, 595, 595, null, '円/m³',
 null, '10L補充・既存設備流用', '2026-07-13', 'medium', 'literature', '260714 SolvioraX EWIR action deck',
 'シアノ補充1.2 L/m³。金属回収の18分の1。用途で原価が桁違いになる', 40, 'amie', 'amie'),
('pte_sx_p05', 'ptt_sx_price', 'p21', '市場の競争目安', null, 500, 500, null, '円/m³',
 null, '既存処理の水準', '2026-07-29', 'medium', 'literature', 'SX_コスト試算_260716',
 'この水準の案件ではSX側の原価圧縮が主戦場になり、300〜400円/m³の達成が目標', 50, 'amie', 'amie'),
('pte_sx_p06', 'ptt_sx_price', 'p21', '総原価 (現行試算)', null, 467.63, 467.63, null, '円/m³',
 null, '既存1000m³タンク流用・膜交換4年', '2026-08-11', 'medium', 'literature', 'SX_コスト試算_260730',
 'OPEX 336.45円 + 設備負担。売価500円の93.5%を占め、利益率が薄い。投資回収5.61年で目安の5年を超過', 60, 'amie', 'amie'),
('pte_sx_p07', 'ptt_sx_price', 'p21', '想定売上単価 (現行)', null, 500, 500, null, '円/m³',
 null, '共通前提', '2026-08-20', 'medium', 'estimate', 'project_cost_assumptions cm_p21_260820 (確度C)',
 'コスト試算タブの前提と同じ値。ここを動かすと4シナリオが再計算される', 70, 'amie', 'amie'),

-- 装置と実験の到達実績
('pte_sx_d01', 'ptt_sx_record', 'p21', 'バイオ装置 (マニホールド型)', null, 180, 180, '実験室へ納品・設置', 'kg',
 null, '村上氏の考案。透明な水槽4本で細胞を循環', '2026-03-31', 'high', 'meeting', 'project_knowledge (p21 tech)',
 '当初の想定50kgを大きく超えた重量。観察用の窓と二酸化炭素の導入口を持つ', 10, 'amie', 'amie'),
('pte_sx_d02', 'ptt_sx_record', 'p21', '技術成熟度 (TRL)', null, null, null, '5 から 6 へ移行の見込み', null,
 null, '培養実験の開始による', '2026-04-01', 'high', 'meeting', 'project_knowledge (p21 tech)',
 '月内の時点。日付は月初で置いている', 20, 'amie', 'amie'),
('pte_sx_d03', 'ptt_sx_record', 'p21', '47リットル 縦型培養装置', null, 47, 47, '試運転できる状態', 'L',
 null, null, '2026-05-01', 'high', 'meeting', 'project_knowledge (p21 tech)',
 '外部へ公開するときはヒーター部分を外し、計器類をぼかす方針', 30, 'amie', 'amie'),
('pte_sx_d04', 'ptt_sx_record', 'p21', '評価用の排水サンプル', null, 5, 5, '繊維染色3種 / 磁性材料2種', '種',
 null, 'レアアース分析・pH調整・吸着試験の対象', '2026-06-24', 'high', 'meeting', '2026-06-24 SX定例MTG',
 null, 40, 'amie', 'amie'),
('pte_sx_d05', 'ptt_sx_record', 'p21', 'リアクターの特許出願', null, null, null, '弁理士と内容を打合せ', null,
 null, '出願完了まで約1か月の見込み', '2026-04-02', 'high', 'meeting', 'project_knowledge (p21 tech)',
 '出願完了後に佐竹氏と共同でリアクター製作へ入る予定', 50, 'amie', 'amie'),
('pte_sx_d06', 'ptt_sx_record', 'p21', '比較実験用の株', null, null, null, '別株の液体培養を開始', null,
 null, '試験可能な細胞量まで約1か月と少し', '2026-08-18', 'high', 'literature', 'SX 定例報告会 (2026-08-18)',
 null, 60, 'amie', 'amie'),
('pte_sx_d07', 'ptt_sx_record', 'p21', '実排液の受入手順', null, null, null, '食品工場は油水分離後〜調整槽流入部、シルク素材加工は中和後・希釈前', null,
 null, '初期評価の対象位置を確定', '2026-08-28', 'high', 'literature', 'SX_月次業務報告書 202608',
 '酸性の原液はそのままでは評価対象にできない', 70, 'amie', 'amie');

commit;
