#!/usr/bin/env node
'use strict';
/*
 * BZM 3.0 — 前向きの積み上げ計算（参照実装）
 *
 * 目的: 係数の分野別初期値 v2 を、紙の上の表ではなく計算で検査する。
 *   (a) 縮退検査: 工程の型4 × 規制属性3 で、評価期間内に M4 へ到達する確率と9区分の分布
 *   (b) 絶対水準の検算: 到達したシナリオに条件づけた M4 到達月数の平均
 *   (c) 感度: 悲観束・楽観束と、係数ごとの弾力性
 *   (d) 単調性: 選択した19対象と自走力ゼロの確率の局所摂動で、符号を実測する
 *
 * 計算法は格子上の数値計算（モデルページ §2 の確定。乱数の試行は用いない）。
 *
 * 宣言する近似（近似誤差はモデルページ §5.8 が要求する「状態の束ね方の明示」にあたる）:
 *   A1 自由資金と使途制限資金を合算した単一の残高で近似し、充当不能分を型別の係数で控除する
 *   A2 受託契約を、契約なし／12か月の確認前／12か月に満たないと確認済みの3状態で近似する。
 *      受託依存の自立は (1-contractExit)^11 の分だけ吸収し、同じ契約では再判定しない。
 *   A3 稼働用途は M4 到達後の解析的な裾で扱う。反復収入自立には裾の qSelf 倍を付け、そのあとも元の用途を継続して、
 *      量産契約・申し出で決着したら残りの割合（max(0, q - qSelf)）だけを足す
 *   A4 権利・承認の残件を「残件数」だけで持ち、種類別の会議暦は平均の解決率へ畳む
 *   A5 滞留の自動分岐を、ハザード位置での付加ハザードで近似する
 *   A6 天井を1に正規化する。出力の価値は「年額の国内純増1円あたりの現在価値」
 *
 * 担い手は月ごとの空席の周辺確率で平均する（既定64通り、機能2を含む案件は128通り）。
 * 月内の和は厳密に計算するが、経路に沿った空席の持続・選別は保持しない（近似A20）。
 */

// ─────────────────────────────────────────────────────────── 係数（v3 の初期値）

const CFG = {
  T: 240,                    // 評価期間（月）
  qLic: 0.60,                // 互換用の未使用値。申し出の価値には出口別の qExit を使う
  d: 0.020,                  // 社会的割引率（年・実質）
  planDeadline: 60,          // 計画期限（月）。期限内／期限後の資本自立を分ける

  // I-2 基準の所要月数 M_g（変換規約 κ = 1/M_res。Mmin は最短準備期間）
  Mg: {
    F1: { T1: 14, T2: 10, T3: 28, M2: 15, M3: 14, M4: 16 },
    F2: { T1: 12, T2:  9, T3: 22, M2: 13, M3: 18, M4: 14 },
    F3: { T1:  7, T2:  5, T3: 10, M2:  7, M3: 10, M4: 10 },
    F4: { T1:  7, T2:  5, T3: 10, M2:  5, M3: 10, M4:  8 },
  },
  minShare: 0.40,            // M_g のうち最短準備期間が占める割合
  scale: 1.00,               // 絶対水準の共通倍率（較正パラメータ）

  // I-3 空席の遅延 d_{f,g}（疎行列。非ゼロは 6.A-2 の主担当機能のマスだけ）
  //   機能: 1 エバンジェリスト / 2 技術の核 / 3 用途と需要家 / 4 意思決定 / 5 資金調達 / 6 対外交渉 / 7 組織
  dOther: 0.05,              // 主担当でない機能の空席
  dMain: {
    T1: { 2: 1.00 }, T2: { 2: 1.00 }, T3: { 2: 1.00 },
    T4prep: { 6: 0.25, 2: 0.35 },
    T4trial: { 6: 0.30, 2: 0.35 },
    M2: { 3: 0.30, 1: 0.35 },
    M3: { 3: 0.30, 6: 0.25 },
    M4: { 6: 0.30, 4: 0.20 },
  },
  kSup: 1 / 12,              // 移せる機能（3〜7）が AMD の供給過程で埋まる率
  kEva: 1 / 18,              // エバンジェリスト機能の探索（e が乗る）。kEva < kSup を制約として宣言

  // 担い手乗数（案A。φ と ν_k に効く。式の改訂として承認事項）
  dPhi: { 1: 0.30, 5: 0.25 },
  dNu:  { 1: 0.35, 6: 0.15 },

  // I-4 採択
  oppRate: 0.50,             // 応募できる機会が視野に入る率（件／月）
  phiBase: 0.28,             // 基準の案件の1回の応募確率。新関数形の初期値 C（未較正）（2026-11-12 の改訂の案）
  zPub: 3000,                // 1件あたりの補給額（万円）
  mgPhi: [0.60, 0.85, 1.00, 1.15, 1.35, 1.35, 1.35],  // 証拠水準（段階0〜6）

  // 民間調達
  nuEq: 0.030,               // 会社化後の民間調達の到来率（件／月）
  zEq: { REG0: 10000, REG1: 10000, REG2: 50000 },   // 1件あたり（万円）。規制の重い領域は1回の調達規模が大きい
  incStage: { REG0: 4, REG1: 4, REG2: 3 },          // R3 会社化の需要の証拠の段階（REG-2 は有償PoC が列に無いため T3・治験I 相当）
  incExtraMonths: 6,         // R3 会社化の資金の条件の、準備の余裕（月）。会社化は、会社化後の必要支出の (hUnder + この値) か月分以上の残高を要する（根拠の水準 C。2026-11-12 の改訂の案）

  // I-5 申し出
  // 出口の到来率は分野で構造が違う。創薬・医療機器は導出（ライセンス）と M&A が主経路で、
  // 量産契約（M4）へ自力で到達する経路はほとんど通らない（まさ 2026-08-25）
  // M&A の到来率は #2026-08-29-3 で REG0・REG1 を大きく下げた。DTSU の M&A は相当限定的で、
  // あるのはポジティブな M&A ばかり（進んだ案件への申し出は m_g^offer が段階の分だけ残す）。
  // REG2 は維持——創薬・医療機器は導出と M&A が業界の主経路。
  nuK: {
    REG0: { lic: 0.0030, ma: 0.0004, ips: 0.0010 },
    REG1: { lic: 0.0030, ma: 0.0004, ips: 0.0010 },
    REG2: { lic: 0.0060, ma: 0.0050, ips: 0.0012 },
  },
  nuKSoft: { lic: 0.0025, ma: 0.0010, ips: 0.0008 },   // F3・F4（ソフト・サービス型）は事業買収が実際に起きる分、素材・装置系より高め
  // 承継者が残りの市場ゲートを越える確率。買収側は資源と継続の意思を持つので高い
  qExit: { lic: 0.60, ma: 0.75, ips: 0.45 },

  // 撤退の四経路（改訂 N1。#2026-08-27-1）。資金切れ・不成立の先を単一の終端にしない
  exitPath: {
    pUse: 0.35,      // ①用途転換（未着手の用途が残り、技術系ゲートを越えているとき）
    // ②③は #2026-08-29-3 で大幅に下げた。「R&Dの余力が尽きて仕方なく買ってもらう」M&A・ライセンスは
    // 基本的に起きない。「よほど戦略余力が高い案件なら」の判別は m_q（無風期間の乗数）が担う
    pLic: 0.05,      // ③ライセンスへの畳み込み（証拠水準 gLic 以上）
    pCls: 0.02,      // ②出口クラスの転換（会社化済み・証拠水準 gCls 以上）
    gLic: 3,         // ③が立つ証拠水準（T3・治験I相 以上）
    gCls: 4,         // ②が立つ証拠水準（M2・治験II相・規格試験 以上）
    licDisc: 0.70,   // 自走をあきらめた状態のライセンスは条件が悪い分の割引
  },
  qRet: 0,           // ④研究への返却は価値を積まない。後に誰かが事業化するなら、それは別の案件として数える
                     // （まさ 2026-08-27「再起するとしたら、もうそのときは別PJとして認識すればいいだけ」）
  uLeftDef: 0,       // 未着手の用途がどれだけ残るか（0〜1）。用途1本の Tier 0 では 0

  // 会社化前は、資金は前進の速度を変えるだけで、資金切れという終端を持たない（#2026-08-29-1）。
  // 資金がほぼ無いあいだ（残高が最低格子）は、次に越えるゲートの種類で前進を分ける（#2026-11-11-1）。
  // T1・T2 は研究室の研究として進む。ほかのゲートは事業化に使える資金が要るので前進しない。受託の契約中は進む。
  // 支出は大学の基盤で回る。証拠の陳腐化と消失は効き続ける。較正する係数ではなく、規約。
  preIncAdvResearch: 1,   // T1・T2
  preIncAdvContract: 1,   // T1・T2 以外で、受託の契約中
  preIncAdvOther: 0,      // T1・T2 以外で、受託の契約が無い
  preIncBurnMult: 0,     // 同・支出は引かない（研究室の維持は大学の基盤で回る）

  // 無風期間 t_q（外から見えるポジティブな動きが出ていない月数）→ 申し出到来率の乗数 m_q（#2026-08-29-1）。
  // まさ 2026-08-29「12か月でc=0.5、24か月でc=0.1くらいになるように落としていってほしい。
  // 2年間ニュースがないってもはや死んでるに近いよ。」あいだは区分線形、36か月以上は下限。
  // c の概算（記録の無い案件）も同じ目盛りを使う（入力を作る側が引く。§6.I-9-1）。
  quietAnchors: [[0, 1.0], [12, 0.5], [24, 0.1], [36, 0.05]],

  // 経済性の乗数（改訂 N2。#2026-08-27-1）。「筋がいいから金が付く」を式に入れる
  pRef: 300,         // 基準の天井（億円／年の純増）。ここで乗数が 1 になる
  betaP: { pub: 0.25, eq: 0.45 },  // 天井の効き。公的採択は抑え、民間調達は強く
  betaM: 0.40,       // 単位採算が黒字で立つ用途が一つでもあることの上乗せ
  mEconClamp: [0.4, 2.5],
  mgOffer: [0.20, 0.35, 0.50, 1.00, 1.60, 2.20, 2.50],
  nuC: 0.05,                 // 受託の申し出（型によらず一本）
  rRef: 69.3,                // 万円／月（4型の r 既定 {60,60,80,80} の幾何平均）
  mgNuC: [0.5, 0.5, 0.8, 0.8, 1.3, 1.3, 1.3],
  qUnresolved: 0.15,         // 評価期間の終わりに未決着の質量へ付ける価値の係数（裾に対する割合。参照実装の近似。#2026-11-12-1）
  contractExit: 1 / 12,      // 受託契約の1か月の満了確率（平均12か月）
  contractFloor: 0.10,       // R5 受ける下限（契約月額がバーンレートのこの割合以上。等号は受ける）

  // I-6 権利・承認（残件数へ畳んだ平均の解決率）
  betaBar: 0.18,             // 月次。会議暦と準備期間を平均で畳んだ値
  R0: 2,                     // 評価日の残件数

  // I-7 消失
  lamComp: 0.030, lamDem: 0.020, lamCore: 0.008,   // 年率
  lamObs: 0.05,              // 稼働用途の陳腐化（年率）

  // I-8 受託がゲート通過を遅らせる度合い
  gamma: { same: 0.0, near: 0.5, unrelated: 1.0 },

  // I-9 案件パラメータの事前分布（Tier 0）
  cNodes: [[0.55, 0.25], [1.00, 0.50], [1.82, 0.25]],   // 対数正規 GSD 1.65 の3点
  psiByStage: [0.45, 0.65, 0.80, 0.92, 0.92, 0.92, 0.92],
  psiSpread: 0.15,
  kIP: 0.55,
  sigmaNodes: [[-1, 0.25], [0, 0.50], [1, 0.25]],
  eMed: 0.50,
  // 自走力 r は「工数を全部割いたときに案件へ残る額（直接費を引いた後の粗利）」。売上ではない。
  // 売上のまま扱うと、受託の遂行に要る工数が支出側に現れず、資本自立が自明に成立してしまう。
  rDef: { F1: 60, F2: 60, F3: 90, F4: 130 },   // 万円／月（会社化前・間接経費控除後の粗利）
  rPostMult: 4.0,            // 会社化後の自走力の倍率（会社として受託・サンプル販売ができる）
  rHighMult: 2.5,            // 事前分布の上側の点（対数正規の裾。中央値の何倍か）
  // 量産契約より前に立つ売上（有償PoC・サンプル販売・初期出荷）。型と段階ごとの月額（万円／月。会社化前。段階0〜6）。根拠の水準 C。
  // 型の既定の支出（muPre）から得られる金額を固定した比較用の表で、売上の実証値ではない。案件の支出を変えても、この表は変えない
  // （支出の個別入力と売上の個別入力は独立。2026-11-12 の改訂の案）
  preSalesMonthly: {
    F1: [0, 0, 0, 15, 52.5, 120, 150],
    F2: [0, 0, 0, 13, 45.5, 104, 130],
    F3: [0, 0, 0, 10, 35, 80, 100],
    F4: [0, 0, 0, 9, 31.5, 72, 90],
  },
  yPostMult: 2.0,            // 会社化後の倍率
  qSelf: 0.35,               // 受託・サービスで資本自立したときに立つ産業の、天井に対する割合（要件3）
  rZeroProb: 0.25,
  rhoMax: { F1: 0.3, F2: 0.3, F3: 0.3, F4: 0.5 },

  // バーンレート（案件が自ら調達した資金で賄う支出だけ。万円／月）
  muPre:  { F1: 150, F2: 130, F3: 100, F4: 90 },
  muPost: { F1: 450, F2: 400, F3: 350, F4: 330 },
  restrictedWaste: 0.15,     // 使途制限で充当できない割合（A1 の控除）

  // 価値の側
  phiU0: 0.25, phiU1: 0.55,  // φ_u = φ0 + φ1·κ_IP
  // 国内立地差の水準。#2026-09-02-1 で反実仮想の控除をモデルから外したので、
  // この係数は前向き計算に入らない。§5.8 の追加的貢献 V^add = (1 - alphaLoc)·V = 0.15·V への
  // 換算にだけ使う（全案件一律の定数倍なので、順位も比も動かさない）。
  alphaLoc: 0.85,
  rampMonths: 12,            // 稼働度の立ち上がり
  Hc: 120,                   // 継続価値の延長

  // 規則（Tier 0 既定）
  kExit: 3,                  // R2 撤退の不成立回数
  gStar: { REG0: 3, REG1: 3, REG2: 2 },   // R4 申し出の検討開始段階
  hUnder: 6,                 // R6 残り月数
  // 追加調達の試み（教科書 第7章 7.3.7 項。2026-11-15 の改訂）。会社化後、初回自走の前に、資金が尽きたときと R6 に当たったときに、
  // 四経路の判定の前に置く。p は機能5の充足時の成立確率で、空席なら (1 - dPhi[5]) 倍。months は成立時に足す総必要支出の月数、
  // max は会社化から初回自走までの回数の上限、discount は出資前の価格の割引（持分の配分だけを変え、この計算には入らない）。根拠の水準 C
  dr: { p: 0.40, months: 12, max: 2, discount: 0.3 },
  stallShare: 0.15,          // A5 滞留の自動分岐（ハザード比）
  sigmaMult: {               // 倍率を直接置く（指数形をやめる）
    phi:   { '-1': 0.61, '0': 1.0, '1': 1.65 },
    offer: { '-1': 0.67, '0': 1.0, '1': 1.49 },
    nuC:   { '-1': 0.74, '0': 1.0, '1': 1.35 },
    lam:   { '-1': 0.74, '0': 1.0, '1': 1.35 },
  },
};

// 規制ゲートの定義（準備は乗数が乗る。審査は決定的な期間で乗数が乗らない）
const REG_GATES = {
  'T4souden':   { kind: 'prep+review', M: 6,  review: 2,  pass: 0.95, main: 'T4prep' },
  'T4kikaku':   { kind: 'prep+review', M: 9,  review: 3,  pass: 0.85, main: 'T4prep' },
  'T4trial1':   { kind: 'tech',        M: 24, pass: 0.60, main: 'T4trial' },
  'T4trial2':   { kind: 'tech',        M: 36, pass: 0.33, main: 'T4trial' },
  'T4trial3':   { kind: 'tech',        M: 48, pass: 0.55, main: 'T4trial' },
  'T4trialMD':  { kind: 'tech',        M: 24, pass: 0.70, main: 'T4trial' },
  'T4shonin':   { kind: 'prep+review', M: 12, review: 11, pass: 0.90, main: 'T4prep' },
  'T4shoninMD': { kind: 'prep+review', M: 9,  review: 12, pass: 0.90, main: 'T4prep' },
  'T4hoken':    { kind: 'prep+review', M: 2,  review: 3,  pass: 0.95, main: 'T4prep' },
};

function gateSequence(type, reg) {
  const soft = (type === 'F3' || type === 'F4');
  if (reg === 'REG0') return soft ? ['T1','T2','M2','T3','M3','M4'] : ['T1','T2','T3','M2','M3','M4'];
  if (reg === 'REG1') return soft ? ['T1','T2','M2','T3','T4kikaku','M3','M4']
                                  : ['T1','T2','T3','M2','T4kikaku','M3','M4'];
  // REG-2: 制度の区分に沿った列。F1 は医薬品型、F2 は医療機器型、F3/F4 はプログラム医療機器型
  if (type === 'F1') return ['T1','T2','T4souden','T3','T4trial1','T4trial2','T4trial3','T4shonin','T4hoken','M3','M4'];
  if (type === 'F2') return ['T1','T2','T4souden','T3','T4trialMD','T4shoninMD','M3','M4'];
  return ['T1','T2','T4souden','M2','T3','T4shoninMD','M3','M4'];
}

// 証拠水準の段階（I-1 の目盛り）
function stageAfter(gate) {
  if (gate === 'T1') return 1;
  if (gate === 'T2') return 2;
  if (gate === 'T3') return 3;
  if (gate === 'M2') return 4;
  if (gate === 'M3') return 5;
  if (gate === 'M4') return 6;
  // T4-* も証拠水準を上げる。相を越えることは、審査側・需要家・投資家から見て
  // 技術・市場のゲートと同等かそれ以上の証拠になる（第1ラウンド監査 群5 の縮退検査で判明）
  if (gate === 'T4trial1') return 3;
  if (gate === 'T4trial2' || gate === 'T4trialMD') return 4;
  if (gate === 'T4trial3') return 5;
  if (gate === 'T4shonin' || gate === 'T4shoninMD') return 6;
  if (gate === 'T4kikaku') return 4;
  return null;   // T4-相談・T4-保険収載は段階を上げない
}

// ─────────────────────────────────────────────────────────── 位置の連鎖を組む

function buildPositions(type, reg, cfg) {
  const seq = gateSequence(type, reg);
  const pos = [];
  const gateStart = [];
  for (let gi = 0; gi < seq.length; gi++) {
    const g = seq[gi];
    gateStart.push(pos.length);
    const rg = REG_GATES[g];
    let M, kind, mainKey, pass = 1.0, Mnom;
    if (rg) {
      Mnom = rg.M; M = rg.M * cfg.scale; kind = rg.kind; mainKey = rg.main; pass = rg.pass;
    } else {
      Mnom = cfg.Mg[type][g]; M = cfg.Mg[type][g] * cfg.scale;
      kind = (g[0] === 'T') ? 'tech' : 'market';
      mainKey = g;
    }
    // 名目 M が小さいゲートは待ち時間を持たせない（準備＋審査だけにする）。判定は scale を掛ける前で行う
    const tiny = (Mnom <= 2);
    const mmin = tiny ? Math.max(1, Math.round(M)) : Math.max(1, Math.round(M * cfg.minShare));
    const mres = tiny ? 0 : Math.max(1, M - mmin);
    for (let k = 0; k < mmin; k++) pos.push({ gi, gate: g, role: 'prep', mainKey, kind });
    if (mres > 0) pos.push({ gi, gate: g, role: 'hazard', mainKey, kind, kres: 1 / mres, pass: (kind === 'tech' && rg) ? pass : 1.0 });
    if (rg && rg.review) {
      for (let k = 0; k < rg.review; k++) pos.push({ gi, gate: g, role: 'review', mainKey, kind });
      pos[pos.length - 1].reviewEnd = true;
      pos[pos.length - 1].pass = pass;
    }
  }
  // 各位置から見た「越えた段階」
  let st = 0; const stageAt = [];
  for (let i = 0; i < pos.length; i++) { stageAt.push(st); const s = (i + 1 < pos.length && pos[i+1].gi !== pos[i].gi) ? stageAfter(pos[i].gate) : null; if (s !== null) st = Math.max(st, s); }
  return { seq, pos, gateStart, stageAt, nPos: pos.length };
}

// ─────────────────────────────────────────────────────────── 担い手の充足（厳密な期待値）

// 機能1 は探索過程（e·kEva）、機能3〜7 は供給過程（kSup）。機能2 は既定で充足。
// funcs（#2026-08-29-2。init.funcs）: 評価日の充足 0〜1。
//   f1Observed（0 または 1）は機能1の現在の実働確認。1 なら機能1の空席確率は全月 0、0 なら従来どおり評価日の空席から探索が始まる。
//   f2 は「1 - 充足」が時間不変の空席確率（移せない機能なので供給過程では埋まらない）。
//   f3〜7 は「評価日に確率 f で充足済み、残り (1-f) が供給過程で埋まる」。省略はいままでの扱い。
function vacancyProbs(t, e, cfg, funcs) {
  const p = {};
  // f1Observed は、評価日の機能1の実働確認（充足確認は 1、空席確認は 0）。省略は従来の条件つき計算（評価日から探索を始める）。
  // 現在の充足と将来の探索の見込み e を別の入力として扱い、同じ実働で両方を動かさない（2026-11-12 の改訂の案）
  const f1Observed = funcs ? funcs.f1Observed : undefined;
  if (f1Observed !== undefined && f1Observed !== 0 && f1Observed !== 1)
    throw new Error('f1Observed は実働確認に基づく 0 または 1');
  p[1] = (1 - (f1Observed ?? 0)) * Math.exp(-e * cfg.kEva * t);
  p[2] = (funcs && funcs.f2 !== undefined) ? Math.min(1, Math.max(0, 1 - funcs.f2)) : 0;
  for (const f of [3,4,5,6,7]) {
    const base = Math.exp(-cfg.kSup * t);
    const f0 = funcs ? funcs['f' + f] : undefined;
    p[f] = (f0 !== undefined) ? Math.min(1, Math.max(0, 1 - f0)) * base : base;
  }
  return p;
}

// 空席パターンにわたる E[1 - exp(-K·η)] を厳密に計算する。
// 既定は機能 1,3,4,5,6,7 の 64 通り。機能2 の空席を指定した案件だけ 7 機能 128 通りへ広げる。
const FUNCS = [1,3,4,5,6,7];
const FUNCS7 = [1,2,3,4,5,6,7];
function expectedAdvance(K, dmap, pv, dOther, list) {
  const L = list || FUNCS;
  const n = L.length;
  let acc = 0;
  for (let m = 0; m < (1 << n); m++) {
    let w = 1, eta = 1;
    for (let b = 0; b < n; b++) {
      const f = L[b], vac = (m >> b) & 1;
      w *= vac ? pv[f] : (1 - pv[f]);
      if (w === 0) break;
      if (vac) eta *= (1 - (dmap[f] !== undefined ? dmap[f] : dOther));
    }
    if (w === 0) continue;
    acc += w * (1 - Math.exp(-K * eta));
  }
  return acc;
}
// 乗数型（φ・ν）の担い手乗数の期待値
function expectedMult(dmap, pv, list) {
  const L = list || FUNCS;
  const n = L.length;
  let acc = 0;
  for (let m = 0; m < (1 << n); m++) {
    let w = 1, mu = 1;
    for (let b = 0; b < n; b++) {
      const f = L[b], vac = (m >> b) & 1;
      w *= vac ? pv[f] : (1 - pv[f]);
      if (w === 0) break;
      if (vac && dmap[f] !== undefined) mu *= (1 - dmap[f]);
    }
    if (w === 0) continue;
    acc += w * mu;
  }
  return acc;
}

// 1回の応募の採択確率。倍率は -log(1-p) に掛けてから確率へ戻す。どんな入力でも 0〜1 に収まる（2026-11-12 の改訂の案）
function awardPhi(phiBase, multiplier) {
  if (!Number.isFinite(phiBase) || phiBase < 0 || phiBase > 1)
    throw new RangeError('phiBase は0〜1の有限値');
  if (!Number.isFinite(multiplier) || multiplier < 0)
    throw new RangeError('採択の倍率は0以上の有限値');
  if (phiBase === 0 || multiplier === 0) return 0;
  if (phiBase === 1) return 1;
  return -Math.expm1(Math.log1p(-phiBase) * multiplier);
}

// 月内の機能1・5の4パターンについて、変換後の月次確率を平均する（2026-11-12 の改訂の案）
function expectedAwardProbability(cfg, multiplier, pv) {
  if (!Number.isFinite(cfg.oppRate) || cfg.oppRate < 0)
    throw new RangeError('oppRate は0以上の有限値（件／月）');
  const d1 = cfg.dPhi[1] ?? 0, d5 = cfg.dPhi[5] ?? 0;
  for (const x of [pv[1], pv[5], d1, d5]) {
    if (!Number.isFinite(x) || x < 0 || x > 1)
      throw new RangeError('空席確率と空席の減衰係数は0〜1');
  }
  // 到来率ゼロのときも入力の定義域を検査する。
  awardPhi(cfg.phiBase, multiplier);
  let acc = 0;
  for (let mask = 0; mask < 4; mask++) {
    const v1 = (mask & 1) !== 0, v5 = (mask & 2) !== 0;
    const w = (v1 ? pv[1] : 1 - pv[1])
            * (v5 ? pv[5] : 1 - pv[5]);
    if (w === 0) continue;
    const mEta = (v1 ? 1 - d1 : 1) * (v5 ? 1 - d5 : 1);
    const phi = awardPhi(cfg.phiBase, multiplier * mEta);
    acc += w * -Math.expm1(-cfg.oppRate * phi);
  }
  return acc;
}

// ─────────────────────────────────────────────────────────── 資金の格子

function moneyGrid(cfg, muPre, muPost) {
  // 資金の刻みはバーンレートに合わせる（支出は加算なので対数格子では毎月が1区間に満たず、分布が人工的に拡散する）。
  // 吸収（資金切れ）の近傍を細かく、遠方を粗く: 0 → 線形（刻み = 会社化前バーンの半分） → 対数の裾。
  const step = muPre / (cfg.gridFine || 2);
  const linTop = 18 * muPost;                 // 会社化後18か月分までは線形
  const g = [0];
  for (let v = step; v <= linTop; v += step) g.push(v);
  // 線形部に正の節点が無い場合は刻み 1 つ分を置く。対数部の上端は 40億円と線形部の最終節点の 4 倍のうち大きい方
  // （大きな支出の入力でも節点が昇順を保つ。#2026-11-12-1）
  if (g.length === 1) g.push(step);
  const hi = Math.log(Math.max(4e5, 4 * g[g.length - 1]));   // 40億円（万円単位で 400000）
  const lo = Math.log(g[g.length - 1] * 1.05);
  const nLog = 28;
  for (let i = 0; i < nLog; i++) g.push(Math.exp(lo + (hi - lo) * i / (nLog - 1)));
  return g;
}

// ─────────────────────────────────────────────────────────── 価値の裾（M4 到達後）

// 裾の価値。延長終端の月を有限和に含める（#2026-11-12-1）
function tailSplit(tM4, cfg, kip) {
  const phiU = cfg.phiU0 + cfg.phiU1 * kip;
  const discount = Math.pow(1 + cfg.d, -1 / 12);
  const surv = 1 - cfg.lamObs / 12;
  const q = surv * discount;
  if (!Number.isInteger(tM4) || tM4 < 0 ||
      !Number.isInteger(cfg.rampMonths) || cfg.rampMonths < 1 ||
      !(discount > 0) || !(surv >= 0 && surv <= 1) || !(q < 1))
    throw new Error('裾の月数、陳腐化、割引率では有限の永久価値を計算できない');
  // 延長終端の月（T+Hc）を有限和へ含め、その月の生存量に翌月開始の年金係数を掛ける。
  // 有限和の最後の月に生存の減衰を掛けないことが、永久年金との時刻をそろえる条件（#2026-11-12-1）。
  // 稼働の開始が延長終端に近い場合（申し出の後）は、立ち上がりが終わる月まで有限和を伸ばしてから年金へ移す。
  // 月は 1 から数える（月の時刻。評価日の月 0 には価値が立たない）。稼働が始まる月が立ち上がりの 1 か月目
  const first = Math.max(1, tM4);
  // 加算のループ変数に大きな絶対月を使わない（極端に大きい稼働月で t++ が変わらなくなる）。開始からの相対月 h で回す
  const last = Math.max(cfg.T + cfg.Hc - first, cfg.rampMonths - 1);
  const end = first + last;
  let v = 0, inT = 0, s = 1;
  for (let h = 0; h <= last; h++) {
    const t = first + h;
    const ramp = Math.min(1, (h + 1) / cfg.rampMonths);
    // 反実仮想の控除は #2026-09-02-1 で外した。スコアはその案件が国内に立てる付加価値を
    // 案件ごとに数えるもので、他者が同じ用途を実現していたかどうかでは差し引かない（§3）。
    const inc = Math.pow(discount, t) * s * ramp * phiU / 12;
    v += inc; if (t <= cfg.T) inT += inc;
    if (h < last) s *= surv;
  }
  const perp = Math.pow(discount, end) * s * phiU / 12 * q / (1 - q);
  return { inT, beyond: v - inT + perp, total: v + perp };
}

// 無風期間 → 乗数 m_q（区分線形。#2026-08-29-1）。未観測（undefined/null）は 1。
function quietMultOf(months, cfg) {
  if (months === undefined || months === null) return 1;
  const a = cfg.quietAnchors;
  if (months <= a[0][0]) return a[0][1];
  for (let i = 1; i < a.length; i++) {
    if (months <= a[i][0]) {
      const [x0, y0] = a[i - 1], [x1, y1] = a[i];
      return y0 + (y1 - y0) * (months - x0) / (x1 - x0);
    }
  }
  return a[a.length - 1][1];
}

// 撤退の四経路（改訂 N1）。到達した質量 wF を四つへ分け、②③④は終端して価値を積む。
// 戻り値は ①用途転換へ回す質量（呼び出し側が位置を戻して継続させる）。
function exitPaths(wF, stage, inc, uLeft, cfg, O, tl, tlIn, mEcon) {
  const E = cfg.exitPath;
  let pUse = (uLeft > 0 && stage >= 1) ? E.pUse * uLeft : 0;
  // 天井が大きい案件は、自走が続かなくなっても引き受け手が見つかりやすい（改訂 N2 の四経路への適用）。
  // 証拠水準の閾値は据え置く——見せる証拠が無ければ市場が大きくても相手は現れない。
  const me = (mEcon === undefined) ? 1 : mEcon;
  let pLicF = (stage >= E.gLic) ? E.pLic * me : 0;
  let pCls  = (stage >= E.gCls && inc === 1) ? E.pCls * me : 0;
  const sum = pUse + pLicF + pCls;
  if (sum > 1) { pUse /= sum; pLicF /= sum; pCls /= sum; }
  const pRet = Math.max(0, 1 - (pUse + pLicF + pCls));
  // 9区分への割当: ③→ライセンス、②→M&A、④→撤退（研究への返却の価値は0）。
  // ①用途転換は終端しない（呼び出し側が位置を戻して計算を続ける）ので、9区分へは足さない。
  // outcome.pivot は 0 を保つ。用途転換を経て実現形に達した排他的な区分は、runOneClassified の nineOutcome.pivot に持つ
  O.lic += wF * pLicF;
  O.ma  += wF * pCls;
  O.exit += wF * pRet;
  const q = pLicF * cfg.qExit.lic * E.licDisc + pCls * cfg.qExit.ma + pRet * cfg.qRet;
  return { use: wF * pUse, v: wF * q * tl, vIn: wF * q * tlIn };
}

// ─────────────────────────────────────────────────────────── 本体

// init（省略可）で案件ごとの観測状態を与える。省略時は Tier 0 の代表案件の前提（先頭ゲート・
// 会社化前・バーンレート18か月分の資金・権利残件 R0）で、従来と同じ結果になる。
//   init = { gate: 'T3', cashMan: 15000, rightsOpen: 1, incorporated: true, underContract: false }
//   gate       … 次に越えるゲートの名前（その型・規制の列にあるもの）。位置はそのゲートの先頭に置く
//   cashMan    … 自由資金の残高（万円）。省略時はバーンレート18か月分
//   rightsOpen … 権利・承認の未解決の残件数（0〜cfg.R0）
//   incorporated … 会社化済みか
//   underContract … 受託契約中か
//   m4Reached  … 評価日にすでに量産契約（M4）へ到達済み（真なら月 0 に吸収する）
//   incRightsMode … 'none'（既定）または 'all'。'all' は全残件が会社化を止める案件で、残件があるあいだ会社化しない（R3。2026-11-12 の改訂の案）
function runOne(type, reg, cfg, theta, init) {
  const { c, psi, sigma, e, r } = theta;
  if (!Number.isFinite(r) || r < 0) throw new Error('r は0以上の有限値');
  const B = buildPositions(type, reg, cfg);
  const P = B.nPos;
  // 案件ごとのバーンレート（#2026-08-29-2）: 評価日の会社化状態の側の μ を差し替える。
  // 会社化前の観測支出が会社化後の既定を上回る場合は、会社化後もその値を下限にする（会社化で支出は下がらない）。
  let muPre = cfg.muPre[type], muPost = cfg.muPost[type];
  if (init && init.burnMan !== undefined) {
    if (!(init.burnMan > 0)) throw new Error('burnMan は正の数（万円／月）');
    if (init.incorporated) muPost = init.burnMan;
    else { muPre = init.burnMan; muPost = Math.max(muPost, init.burnMan); }
  }
  // 会社化後の計画バーン（#2026-08-29-3）。会社化前の案件が設立後の計画支出を渡す
  // （スモールスタート計画を型の既定で上書きしない）。max(計画値, 評価日の観測) で
  // 会社化時に支出が下がらない単調性だけを保つ。
  if (init && !init.incorporated && init.burnPostMan !== undefined) {
    if (!(init.burnPostMan > 0)) throw new Error('burnPostMan は正の数（万円／月）');
    muPost = Math.max(init.burnPostMan, init.burnMan !== undefined ? init.burnMan : 0);
  }
  const grid = moneyGrid(cfg, muPre * (1 + cfg.restrictedWaste), muPost * (1 + cfg.restrictedWaste));
  const S = grid.length;
  // X: 0 契約なし、1 契約中（12か月続くかの確認前）、2 契約中（12か月に満たないと確認済み）。#2026-11-12-1
  // 資本自立の判定（改訂1-1）は、受託の稼ぎが必要な場合に判定月を含む12か月の継続確率 (1 - 満了確率)^11 の分だけを数える
  const pLong = Math.pow(1 - cfg.contractExit, 11);
  // I: 0 会社化前、1 + k 会社化後で追加調達を k 回試みた（k = 0〜dr.max。第7章 7.3.7 項）
  const drMax = cfg.dr ? cfg.dr.max : 0;
  if (!Number.isInteger(drMax) || drMax < 0) throw new Error('dr.max は 0 以上の整数');
  const NR = cfg.R0 + 1, NI = 2 + drMax, NX = 3, NN = cfg.kExit;   // 不成立の回数 N が kExit に達した枝は put の前で終端か N=0 の用途転換へ分かれるので、N=kExit の領域は使わない
  const st_x = NN, st_i = NN * NX, st_R = NN * NX * NI;
  const st_s = NN * NX * NI * NR, st_p = st_s * S;
  const SZ = P * S * NR * NI * NX * NN;
  let cur = new Float64Array(SZ), nxt = new Float64Array(SZ);

  const gStar = cfg.gStar[reg];
  const rhoMax = cfg.rhoMax[type];
  // R3 会社化の資金の条件: 会社化後の必要支出（15%の上乗せを含む）の Hinc か月分。Hinc = h_under + incExtraMonths（既定 6 + 6 = 12 か月。根拠の水準 C）。
  // 権利の残件は、incRightsMode が 'all'（全残件が会社化を止める）のときだけ会社化を止める。既定は 'none'（2026-11-12 の改訂の案）
  const incRightsMode = (init && init.incRightsMode) ?? 'none';
  if (incRightsMode !== 'none' && incRightsMode !== 'all')
    throw new Error('incRightsMode は none または all。混在は条件別計画で確認する');
  const incCash = muPost * (1 + cfg.restrictedWaste) * (cfg.hUnder + cfg.incExtraMonths);
  const incBlocked = (Rb) => incRightsMode === 'all' && Rb > 0;
  // R5 受託の下限: 契約月額（rhoMax・自走力。会社化後は rPostMult 倍）が、その月の初めの状態のバーンレートの
  // contractFloor 以上なら新規の受託を受ける。既に契約中の状態には再適用しない（#2026-11-12-1）
  const acceptOK = [0, 1].map((i) => rhoMax * r * (i === 1 ? cfg.rPostMult : 1)
                                     >= cfg.contractFloor * (i === 1 ? muPost : muPre) * (1 + cfg.restrictedWaste));
  // 八機能の充足（#2026-08-29-2）。機能2 の空席を指定した案件は 7 機能 128 通りへ広げ、
  // 恒久喪失率 λ^core を外す（同じ喪失を率と状態で二回数えない）
  const funcs = init && init.funcs ? init.funcs : null;
  const f2Vacant = Boolean(funcs && funcs.f2 !== undefined && funcs.f2 < 1);
  const funcsList = f2Vacant ? FUNCS7 : FUNCS;
  const lamCoreEff = f2Vacant ? 0 : cfg.lamCore;
  // 年率は連続時間のハザード。月次ハザード h = 年率/12 の 1 か月の消失確率は 1 - exp(-h)（#2026-11-12-1）。
  // 陳腐化（lamObs）は §6.E-3 の離散式 1 - lamObs/12、受託契約の満了は月次確率 1/12 のまま（変換しない）
  const lamYear = cfg.lamComp * (1.6 - 1.2 * cfg.kIP) * cfg.sigmaMult.lam[String(sigma)]
                  + cfg.lamDem + lamCoreEff;
  const lamMonth = -Math.expm1(-lamYear / 12);
  const surv1 = Math.exp(-lamYear / 12);

  // 価値の裾を前計算する（状態に依らないので月ごとに一度だけ）
  // 月の時刻 m（評価日からの経過月。最初の将来月が 1）ごとに、必要な月だけ計算して覚える。
  // 申し出のあとの稼働の月は T を超えることがある（#2026-11-12-1）。
  const tailMemo = new Map();
  const tailAt = (m) => { let sp = tailMemo.get(m); if (!sp) { sp = tailSplit(m, cfg, cfg.kIP); tailMemo.set(m, sp); } return sp; };

  let p0 = 0, R0 = cfg.R0, inc0 = 0, x0 = 0, drUsed0 = 0;
  let s0 = muPre * 18;
  if (init) {
    if (init.gate !== undefined) {
      const gi = B.seq.indexOf(init.gate);
      if (gi < 0) throw new Error(`未知のゲート ${init.gate}。${type}×${reg} の列: ${B.seq.join(', ')}`);
      p0 = B.gateStart[gi];
    }
    if (init.incorporated) { inc0 = 1; s0 = muPost * 18; }
    if (init.cashMan !== undefined) {
      if (!(init.cashMan >= 0)) throw new Error('cashMan は 0 以上の数（万円）');
      s0 = init.cashMan;
    }
    if (init.rightsOpen !== undefined) {
      if (!Number.isInteger(init.rightsOpen) || init.rightsOpen < 0 || init.rightsOpen > cfg.R0)
        throw new Error(`rightsOpen は 0〜${cfg.R0} の整数`);
      R0 = init.rightsOpen;
    }
    if (init.underContract) x0 = 1;
    if (init.drUsed !== undefined) {
      if (!init.incorporated) throw new Error('drUsed は会社化済みの入力だけが持てる');
      if (!Number.isInteger(init.drUsed) || init.drUsed < 0 || init.drUsed > drMax)
        throw new Error(`drUsed は 0〜${drMax} の整数`);
      drUsed0 = init.drUsed;
    }
  }
  // ①用途転換に回れる余地（改訂 N1）と、経済性の乗数（改訂 N2）
  const uLeft = (init && init.uLeft !== undefined) ? init.uLeft : cfg.uLeftDef;
  // 無風期間の乗数 m_q（#2026-08-29-1）。実現の申し出の到来率と、四経路の引き受け手の現れやすさ（②③）に掛かる
  const mQuiet = quietMultOf(init && init.quietMonths, cfg);
  const mPos = (init && init.unitMarginPositive !== undefined) ? init.unitMarginPositive : true;
  const pNetOku = (init && init.pNetOku !== undefined) ? init.pNetOku : cfg.pRef;
  // 基準化: 天井が pRef で、単位採算が黒字で立つ用途があるとき 1 になる（φ_base の基準の案件と一致させる）。
  // 基準化しないと、採択率の基準値そのものを二重に持ち上げてしまう。
  const mEcon = (bp) => {
    const v = Math.pow(Math.max(1e-6, pNetOku) / cfg.pRef, bp)
            * (1 + cfg.betaM * (mPos ? 1 : 0)) / (1 + cfg.betaM);
    return Math.min(cfg.mEconClamp[1], Math.max(cfg.mEconClamp[0], v));
  };
  const mEconPub = mEcon(cfg.betaP.pub), mEconEq = mEcon(cfg.betaP.eq);
  // 初期質量は put の定義のあとで、月次と同じ線形補間で配る（#2026-11-12-1）

  const O = { indep_in: 0, indep_out: 0, indep_m4: 0, indep_rev: 0, lic: 0, ma: 0, ips: 0, pivot: 0, exit: 0, liq: 0, cont: 0 };
  let vAcc = 0, vIn = 0, m4mass = 0, m4monthSum = 0;
  // 計測（設立の時期の比較用。確率と価値は変えない。2026-11-12 の改訂の案）。配列は長さ T+1（評価日 0 と月 1〜T）の確率質量
  //   firstInc … 初めて会社化した月（会社化済みの入力は月 0 に 1）。会社化後に決着しても質量は保つ
  //   firstM4 … 当該用途の量産契約（M4）へ初めて届いた月（到達済みの入力は月 0 に 1）。反復収入の資本自立のあとの到達も含む
  //   firstRevenueIndependence … 反復収入による資本自立へ初めて届いた月
  //   firstCashShortfall … 会社化後の資金更新で残高が 0 以下になり、四経路の判定に入った初回の質量（会社化後の資金ゼロの入力は月 0）
  //   m4AfterRevenueIndependence … 反復収入の資本自立のあとに M4 へ届いた量（firstM4 の内訳）
  //   r6BranchMass … R6（残り月数が h_under を切る）で四経路の判定に入った量。資金不足とは別に数える。追加調達が成立した分は含めない
  //   drAttempt … 追加調達を試みた量（回数の期待値。同じ道筋が2回試みれば2回数える）。drSuccess … そのうち成立した量（第7章 7.3.7 項）
  const meas = {
    firstInc: new Array(cfg.T + 1).fill(0), firstM4: new Array(cfg.T + 1).fill(0),
    firstRevenueIndependence: new Array(cfg.T + 1).fill(0), firstCashShortfall: new Array(cfg.T + 1).fill(0),
    m4AfterRevenueIndependence: 0, r6BranchMass: 0, drAttempt: 0, drSuccess: 0,
  };
  let pivotKilled = 0;        // ピボットの分類用の追跡計算（cfg.traceNoPivot）で、用途転換の手前で止めた質量（2026-11-12 の改訂の案）
  let pivotTransitions = 0;   // 用途転換の通過量（反復を含む期待回数。終端確率ではないので 1 を超えうる。#2026-11-12-1）

  // 前計算: 月 × 位置の前進確率、担い手乗数
  const advC = new Float64Array((cfg.T + 1) * P);
  const advCx = new Float64Array((cfg.T + 1) * P);   // 受託契約中（rho = rho_max）の前進確率
  // 会社化前は機能7（組織の構築と運営）の空席を罰しない（§6.B-1）。会社化前用の前進確率（機能7を外した列挙）を別に持つ（#2026-11-12-1）
  const advPre = new Float64Array((cfg.T + 1) * P);
  const advPreX = new Float64Array((cfg.T + 1) * P);
  const preFuncs = funcsList.filter((f) => f !== 7);
  const gamNear = cfg.gamma.near;
  const nuM = new Float64Array(cfg.T + 1);
  // 追加調達の一回の成立確率。機能5の空席の確率の分だけ (1 - dPhi[5]) 倍に下げる（第7章 7.3.7 項）
  const drPm = new Float64Array(cfg.T + 1);
  // 公的採択の月次確率は、月×段階で前計算する（空席4パターンの平均を含む）（2026-11-12 の改訂の案）
  const nAwardStages = cfg.mgPhi.length;
  const awardP = new Float64Array((cfg.T + 1) * nAwardStages);
  const sgPhiAward = cfg.sigmaMult.phi[String(sigma)];
  for (let t = 0; t <= cfg.T; t++) {
    const pv = vacancyProbs(t, e, cfg, funcs);
    for (let stage = 0; stage < nAwardStages; stage++) {
      awardP[t * nAwardStages + stage] = expectedAwardProbability(
        cfg, sgPhiAward * cfg.mgPhi[stage] * mEconPub, pv);
    }
    nuM[t] = expectedMult(cfg.dNu, pv, funcsList);
    if (drMax > 0) drPm[t] = Math.min(1, Math.max(0, cfg.dr.p * (1 - (cfg.dPhi[5] ?? 0) * pv[5])));
    for (let p = 0; p < P; p++) {
      const q = B.pos[p];
      if (q.role !== 'hazard') continue;
      const Kbase = q.kres * ((q.kind === 'tech') ? psi : 1) * c;
      const dm = cfg.dMain[q.mainKey] || {};
      const kx = Kbase * Math.max(0, 1 - gamNear * rhoMax);
      advC[t * P + p] = expectedAdvance(Kbase, dm, pv, cfg.dOther, funcsList);
      advCx[t * P + p] = expectedAdvance(kx, dm, pv, cfg.dOther, funcsList);
      advPre[t * P + p] = expectedAdvance(Kbase, dm, pv, cfg.dOther, preFuncs);
      advPreX[t * P + p] = expectedAdvance(kx, dm, pv, cfg.dOther, preFuncs);
    }
  }
  // ①用途転換の戻り先: 市場系ゲートの先頭（技術系の到達は保つ）
  let posMarketHead = -1;
  for (let q0 = 0; q0 < P; q0++) if (B.pos[q0].kind === 'market') { posMarketHead = q0; break; }

  // 位置ごとの M4 までの残り月数（申し出の価値づけに使う）。月ごとに、申し出時点の前進確率から計算する（#2026-11-12-1）:
  // 現在の位置を含め、準備・審査の位置は各 1 か月、待ち位置は平均待ち月数 1/前進確率（受託の遅れを外した値）を足す。
  // 前進確率 0 の待ち位置が残るなら無限大（申し出のあとの稼働価値は 0）。切り上げた月数が T を超えてもその月の裾を使う
  const remM = new Float64Array(P);
  const TAIL_ZERO = { total: 0, inT: 0 };

  // 位置ごとの静的な情報
  const posRole = new Int8Array(P), posNext = new Int32Array(P), posHead = new Int32Array(P);
  const posPass = new Float64Array(P), posStage = new Int32Array(P), posIsM4 = new Int8Array(P);
  const posIsResearch = new Int8Array(P), posGi = new Int32Array(P);
  for (let p = 0; p < P; p++) {
    const q = B.pos[p];
    posRole[p] = q.role === 'hazard' ? 1 : (q.reviewEnd ? 2 : 0);
    posNext[p] = p + 1;
    posHead[p] = B.gateStart[q.gi];
    posPass[p] = q.pass !== undefined ? q.pass : 1.0;
    posStage[p] = B.stageAt[p];
    posIsM4[p] = (q.gate === 'M4') ? 1 : 0;
    posIsResearch[p] = (q.gate === 'T1' || q.gate === 'T2') ? 1 : 0;
    posGi[p] = q.gi;
  }

  // 資本自立のあとの計算（2026-11-12 の改訂の案）。
  // 反復収入による資本自立へ届いたあとは、資金格子を外した別の配列で元の用途を追う。会社化の標識は到達時の値を保つ。
  // 契約は遅れを計算する有無だけ（12か月の再判定はしない）。
  const selfSize = P * NR * NI * 2 * NN;
  let selfCur = new Float64Array(selfSize), selfNxt = new Float64Array(selfSize);
  const selfDiag = { seeded: 0, m4: 0, lic: 0, ips: 0, ma: 0,
    researchLost: 0, serviceOnly: 0, remaining: 0, extra: 0, extraIn: 0,
    baseline: 0, baselineIn: 0, preInc: 0, size: selfSize, fundedSize: SZ };
  const selfIndex = (p, R, I, X, N) => ((((p * NR + R) * NI + I) * 2 + X) * NN + N);
  function selfPut(arr, p, R, I, X, N, w) {
    if (w > 0) arr[selfIndex(p, R, I, X, N)] += w;
  }
  function selfExtra(w, q, sp) {
    // 同じ稼働月における qSelf 分を控除し、残りの割合だけを足す。
    const z = w * Math.max(0, q - cfg.qSelf);
    const v = z * sp.total, vi = z * sp.inT;
    vAcc += v; vIn += vi; selfDiag.extra += v; selfDiag.extraIn += vi;
  }
  function continueSelf(t, month, spNow) {
    for (let p = 0; p < P; p++) {
      const stage = posStage[p], role = posRole[p];
      const mo = cfg.mgOffer[stage] * (0.4 + 1.2 * cfg.kIP)
        * cfg.sigmaMult.offer[String(sigma)] * nuM[t] * mQuiet;
      const nk = reg === 'REG0' && (type === 'F3' || type === 'F4') ? cfg.nuKSoft : cfg.nuK[reg];
      const pl = -Math.expm1(-nk.lic * mo), pi = -Math.expm1(-nk.ips * mo), pa = -Math.expm1(-nk.ma * mo);
      const pc = -Math.expm1(-cfg.nuC * Math.sqrt(r / cfg.rRef)
        * cfg.sigmaMult.nuC[String(sigma)] * cfg.mgNuC[stage]);
      const offMonth = month + Math.ceil(remM[p]);
      const spOff = Number.isFinite(offMonth) ? tailAt(offMonth) : TAIL_ZERO;
      for (let R = 0; R < NR; R++) for (let I = 0; I < NI; I++)
      for (let X = 0; X < 2; X++) for (let N = 0; N < NN; N++) {
        let w = selfCur[selfIndex(p,R,I,X,N)];
        if (w === 0) continue;
        // 消失は元の用途の追加価値だけを止める。自立の区分と基礎価値は確定済み。
        selfDiag.researchLost += w * lamMonth; w *= surv1;
        if (stage >= gStar && R === 0) {
          const wl = w * pl, wi = w * (1-pl) * pi, wm = w * (1-pl) * (1-pi) * (I >= 1 ? pa : 0);
          selfDiag.lic += wl; selfDiag.ips += wi; selfDiag.ma += wm;
          selfExtra(wl, cfg.qExit.lic, spOff); selfExtra(wi, cfg.qExit.ips, spOff); selfExtra(wm, cfg.qExit.ma, spOff);
          w -= wl + wi + wm;
        }
        const pRes = R > 0 ? -Math.expm1(-cfg.betaBar) : 0;
        for (let rb = 0; rb < 2; rb++) {
          const Rb = rb === 0 && R > 0 ? R-1 : R;
          const wR = R > 0 ? w * (rb === 0 ? pRes : 1-pRes) : (rb === 0 ? w : 0);
          if (wR === 0) continue;
          for (let xb = 0; xb < 2; xb++) {
            const Xn = xb;
            const pOn = X === 0 ? (acceptOK[I > 0 ? 1 : 0] ? pc : 0) : 1-cfg.contractExit;
            const wX = wR * (xb === 1 ? pOn : 1-pOn);
            if (wX === 0) continue;
            for (let pb = 0; pb < 4; pb++) {
              let pn, wP, dn, reached = false;
              if (role === 1) {
                let adv = I === 0 ? (X ? advPreX[t*P+p] : advPre[t*P+p])
                                  : (X ? advCx[t*P+p] : advC[t*P+p]);
                if (posIsM4[p] && Rb > 0) adv = 0;
                const pass = posPass[p], stall = cfg.stallShare * adv;
                if (pb === 0) { pn=posNext[p]; wP=wX*adv*pass; dn=0; reached=pn>=P; }
                else if (pb === 1) { pn=posHead[p]; wP=wX*adv*(1-pass); dn=1; }
                else if (pb === 2) { pn=p; wP=wX*(1-adv)*stall; dn=1; }
                else { pn=p; wP=wX*(1-adv)*(1-stall); dn=0; }
              } else if (role === 2) {
                if (pb === 0) { pn=posNext[p]; wP=wX*posPass[p]; dn=0; reached=pn>=P; }
                else if (pb === 1) { pn=posHead[p]; wP=wX*(1-posPass[p]); dn=1; }
                else continue;
              } else {
                if (pb !== 0) continue;
                pn=posNext[p]; wP=wX; dn=0; reached=pn>=P;
              }
              if (wP === 0) continue;
              const Nn = reached || posGi[pn] !== posGi[p] ? 0 : N+dn;
              if (Nn >= cfg.kExit) { selfDiag.serviceOnly += wP; continue; }
              if (reached) {
                selfDiag.m4 += wP; selfExtra(wP, 1, spNow);
                meas.firstM4[month] += wP; meas.m4AfterRevenueIndependence += wP;
                m4mass += wP; m4monthSum += wP*month;
              } else selfPut(selfNxt,pn,Rb,I,Xn,Nn,wP);
            }
          }
        }
      }
    }
  }

  // 資金の格子への配分（分岐なしで書き込む）
  const gLast = grid[S - 1];
  function put(arr, p, sVal, R, I, X, N, w) {
    if (w <= 1e-16) return;
    if (sVal <= 0) {
      if (I >= 1) { O.exit += w; return; }   // 会社化後の資金ゼロは撤退
      sVal = grid[1];                          // 会社化前の資金ゼロは終端しない（最低の格子点で、前進停止の判定を続ける）
    }
    const baseIdx = p * st_p + R * st_R + I * st_i + X * st_x + N;
    if (sVal >= gLast) { arr[baseIdx + (S - 1) * st_s] += w; return; }
    if (sVal <= grid[1]) { arr[baseIdx + st_s] += w; return; }
    let lo = 1, hi = S - 1;
    while (lo + 1 < hi) { const mid = (lo + hi) >> 1; if (grid[mid] <= sVal) lo = mid; else hi = mid; }
    const f = Math.max(0, Math.min(1, (sVal - grid[lo]) / (grid[lo + 1] - grid[lo])));
    arr[baseIdx + lo * st_s] += w * (1 - f);
    arr[baseIdx + (lo + 1) * st_s] += w * f;
  }

  if (inc0 === 1) meas.firstInc[0] = 1;
  // 評価日にすでに量産契約（M4）へ到達済みという観測は、そのあとの資金の状態によらず、初回到達の計測の月 0 に残す
  if (init && init.m4Reached === true) meas.firstM4[0] = 1;
  // 会社化後に評価日の資金がゼロなら、月 0 で撤退（四経路は介さない）
  if (inc0 === 1 && s0 === 0) {
    O.exit = 1;
    meas.firstCashShortfall[0] = 1;
    return { outcome: O, diag: { pivotTransitions, pivotKilled, ...meas }, v: 0, vIn: 0, cRatio: null, m4mass: 0, m4mean: null };
  }
  // 評価日にすでに量産契約（M4）へ到達済みなら、月 0 に吸収する（次に越えるゲートが無い。#2026-11-12-1）。
  // 初期の稼働年齢は入力に無いので、最初の将来月を立ち上がりの 1 か月目とする
  if (init && init.m4Reached === true) {
    const sp0 = tailAt(0);
    O.indep_m4 = 1; O.indep_in = 1;
    return { outcome: O, diag: { pivotTransitions, pivotKilled, ...meas }, v: sp0.total, vIn: sp0.inT,
             cRatio: sp0.total > 0 ? 1 - sp0.inT / sp0.total : null, m4mass: 1, m4mean: 0 };
  }
  put(cur, p0, s0, R0, inc0 === 1 ? 1 + drUsed0 : 0, x0, 0, 1);

  for (let t = 0; t < cfg.T; t++) {
    nxt.fill(0);
    selfNxt.fill(0);
    // t は月初の状態、month は今月の遷移の決着時刻（最初の将来月が 1、評価期間の最終月が T）
    const month = t + 1;
    { let acc = 0; for (let p = P - 1; p >= 0; p--) {
        const prob = advC[t * P + p];
        acc += (posRole[p] === 1) ? (prob > 0 ? 1 / prob : Infinity) : 1;
        remM[p] = acc;
    } }
    const spNow = tailAt(month);
    const nm = nuM[t], tail = spNow.total, tailIn = spNow.inT;
    // 資本自立に届いたあとの質量を1か月進める（今月の到達分は、このあとの自立の判定で翌月用の配列へ入る）
    continueSelf(t, month, spNow);
    const sgOffer = cfg.sigmaMult.offer[String(sigma)];
    const sgPhi = cfg.sigmaMult.phi[String(sigma)];
    const sgNuC = cfg.sigmaMult.nuC[String(sigma)];
    const ipFac = 0.4 + 1.2 * cfg.kIP;
    for (let p = 0; p < P; p++) {
      const stage = posStage[p], role = posRole[p];
      const advBase = advC[t * P + p], advBaseX = advCx[t * P + p];
      const advBasePre = advPre[t * P + p], advBasePreX = advPreX[t * P + p];
      const moBase = cfg.mgOffer[stage] * ipFac * sgOffer * nm * mQuiet;
      const nk = (reg === 'REG0' && (type === 'F3' || type === 'F4')) ? cfg.nuKSoft : cfg.nuK[reg];
      const pLic = 1 - Math.exp(-nk.lic * moBase);
      const pIps = 1 - Math.exp(-nk.ips * moBase);
      const pMA = 1 - Math.exp(-nk.ma * moBase);
      // 公的採択: 4パターンの月次確率を平均済み。経済性は変換の内側（改訂 N2）。0.03〜0.70 と 0.999 の切断は廃止（2026-11-12 の改訂の案）
      const pAward = awardP[t * nAwardStages + stage];
      const pEqBase = 1 - Math.exp(-cfg.nuEq * cfg.mgPhi[stage] * sgPhi * nm * mEconEq);
      const zEqV = cfg.zEq[reg];
      const incTh = cfg.incStage[reg];
      // r = 0 の案件には受託の申し出が来ない（#2026-11-12-1）
      const mc = Math.sqrt(Math.max(r, 0) / cfg.rRef) * sgNuC * cfg.mgNuC[stage];
      const pC = 1 - Math.exp(-cfg.nuC * mc);   // 申し出の到来確率。受諾は契約月額が下限以上のときだけ（pAcc）
      const offerOK = (stage >= gStar);
      // 申し出で決着しても、承継者が残りの市場ゲートを越えなければ国内付加価値は立たない（6.A-2）
      const offMonth = month + Math.ceil(remM[p]);
      const spOff = Number.isFinite(offMonth) ? tailAt(offMonth) : TAIL_ZERO;
      const tl = spOff.total, tlIn = spOff.inT;
      for (let si = 1; si < S; si++) {
        const sVal = grid[si];
        const bs = p * st_p + si * st_s;
        for (let R = 0; R < NR; R++) for (let I = 0; I < NI; I++) for (let X = 0; X < NX; X++) for (let N = 0; N < NN; N++) {
          let w = cur[bs + R * st_R + I * st_i + X * st_x + N];
          if (w < 1e-15) continue;

          // 2. 消失
          O.exit += w * lamMonth; w *= surv1;

          // 3-4. 実現の申し出（残件ゼロ・段階が g* 以上で受諾）
          if (offerOK && R === 0) {
            const pa = (I >= 1) ? pMA : 0;
            const wl = w * pLic, wi = w * (1 - pLic) * pIps, wm = w * (1 - pLic) * (1 - pIps) * pa;
            O.lic += wl; O.ips += wi; O.ma += wm;
            const qw = wl * cfg.qExit.lic + wi * cfg.qExit.ips + wm * cfg.qExit.ma;
            vAcc += qw * tl; vIn += qw * tlIn;
            w -= (wl + wi + wm);
            if (w < 1e-15) continue;
          }

          const pRes = (R > 0) ? (1 - Math.exp(-cfg.betaBar)) : 0;
          for (let rb = 0; rb < 2; rb++) {
            const Rb = (rb === 0 && R > 0) ? R - 1 : R;
            const wR = (R > 0) ? (rb === 0 ? w * pRes : w * (1 - pRes)) : (rb === 0 ? w : 0);
            if (wR < 1e-15) continue;

            for (let xb = 0; xb < 2; xb++) {
              let Xn, wX;
              if (X === 0) { const pAcc = acceptOK[I > 0 ? 1 : 0] ? pC : 0; Xn = xb; wX = xb === 1 ? wR * pAcc : wR * (1 - pAcc); }
              else { Xn = xb === 0 ? 0 : X; wX = xb === 0 ? wR * cfg.contractExit : wR * (1 - cfg.contractExit); }
              if (wX < 1e-15) continue;

              // 会社化前・資金がほぼ無いあいだ: T1・T2 は進み、ほかは受託の契約中だけ進む（#2026-11-11-1）
              const preAdvMult = (si === 1 && I === 0)
                ? (posIsResearch[p] === 1 ? cfg.preIncAdvResearch : (X >= 1 ? cfg.preIncAdvContract : cfg.preIncAdvOther)) : 1;
              // 位置の分岐
              for (let pb = 0; pb < 4; pb++) {
                let pn, wP, dn, reached = false;
                if (preAdvMult === 0 && role !== 1) {
                  // 停止は準備・審査の位置にも先に効く（待ち位置だけでなく）。位置と不成立回数を保つ（#2026-11-12-1）
                  if (pb !== 0) continue;
                  pn = p; wP = wX; dn = 0;
                } else if (role === 1) {
                  let pa2 = (I === 0) ? (X >= 1 ? advBasePreX : advBasePre) : (X >= 1 ? advBaseX : advBase);
                  pa2 *= preAdvMult;
                  if (posIsM4[p] === 1 && Rb > 0) pa2 = 0;
                  const pass = posPass[p], pStall = cfg.stallShare * pa2;
                  if (pb === 0) { pn = posNext[p]; wP = wX * pa2 * pass; dn = 0; reached = pn >= P; }
                  else if (pb === 1) { pn = posHead[p]; wP = wX * pa2 * (1 - pass); dn = 1; }
                  else if (pb === 2) { pn = p; wP = wX * (1 - pa2) * pStall; dn = 1; }
                  else { pn = p; wP = wX * (1 - pa2) * (1 - pStall); dn = 0; }
                } else if (role === 2) {
                  if (pb === 0) { pn = posNext[p]; wP = wX * posPass[p]; dn = 0; reached = pn >= P; }
                  else if (pb === 1) { pn = posHead[p]; wP = wX * (1 - posPass[p]); dn = 1; }
                  else continue;
                } else {
                  if (pb !== 0) continue;
                  pn = posNext[p]; wP = wX; dn = 0; reached = pn >= P;
                }
                if (wP < 1e-15) continue;
                // 不成立の回数は同じゲートについて数える。次のゲートへ通過したら 0 へ戻す
                // （準備・待ち・審査の位置の移動と、同じゲートの再試行では保持する。#2026-11-12-1）
                let Nn = (reached || posGi[pn] !== posGi[p]) ? 0 : N + dn;
                if (Nn >= cfg.kExit) {
                  const ep = exitPaths(wP, stage, I > 0 ? 1 : 0, uLeft, cfg, O, tl, tlIn, mEconEq * mQuiet);
                  vAcc += ep.v; vIn += ep.vIn;
                  if (ep.use <= 1e-15) continue;
                  if (posMarketHead < 0) throw new Error('用途転換の市場系ゲートが無い');
                  // 追跡計算（ピボットの分類用）では、用途転換へ入る質量をここで止める。価値も撤退も付けない（2026-11-12 の改訂の案）
                  if (cfg.traceNoPivot === true) { pivotKilled += ep.use; continue; }
                  // 用途転換の分は、市場系ゲートの先頭へ戻り不成立の回数を 0 にするだけで、今月の解決（権利）・契約の開始と満了・
                  // 会社化・資金の更新は同じ月に一度だけ通す（旧は月初の状態へ戻して今月の更新を飛ばしていた。#2026-11-12-1）
                  pivotTransitions += ep.use;
                  wP = ep.use; pn = posMarketHead; Nn = 0; reached = false;
                }

                if (reached) {
                  m4mass += wP; m4monthSum += wP * month;
                  meas.firstM4[month] += wP;
                  vAcc += wP * tail; vIn += wP * tailIn; O.indep_m4 += wP;
                  if (month <= cfg.planDeadline) O.indep_in += wP; else O.indep_out += wP;
                  continue;
                }

                // 4. 会社化（R3）。需要の証拠の段階と、月初の残高が会社化後の必要支出の Hinc か月分以上、の両方がそろった月に行う。
                //    受託の契約中という標識と、権利の残件の数では会社化しない（残件で止めるのは incRightsMode='all' のときだけ）（2026-11-12 の改訂の案）
                let In = I;
                if (I === 0 && !incBlocked(Rb) && stage >= incTh && sVal >= incCash) In = 1;
                if (I === 0 && In === 1) meas.firstInc[month] += wP;

                // 5. 資金
                const muFull = (In >= 1 ? muPost : muPre) * (1 + cfg.restrictedWaste);
                const mu = (si === 1 && In === 0) ? muFull * cfg.preIncBurnMult : muFull;   // 資金がほぼ無いあいだは支出を引かない（大学の基盤）
                const rEff = r * (In >= 1 ? cfg.rPostMult : 1);
                // 量産前の売上は、型と段階の月額表を、案件の支出と独立に置く（個別の支出との比は掛けない。2026-11-12 の改訂の案）
                const yEff = cfg.preSalesMonthly[type][stage] * (In >= 1 ? cfg.yPostMult : 1);
                const income = (Xn >= 1 ? rhoMax * rEff : 0) + yEff;
                const base = sVal - mu + income;
                const pEq = (In >= 1) ? pEqBase : 0;

                // 6. 資本自立（反復可能な稼ぎが必要支出を賄う）
                let XnF = Xn;
                if (income >= muFull) {
                  // 売上だけで賄えるなら全量が自立。受託の稼ぎが要るときは、契約が12か月続く確率の分だけ数え、
                  // 残りは「12か月に満たない契約」（X=2）として先へ進める。X=2 のあいだは同じ判定を繰り返さない
                  let fAbs = 1;
                  if (yEff < muFull) { fAbs = Xn === 1 ? pLong : 0; XnF = 2; }
                  const wA = wP * fAbs;
                  if (wA > 0) {
                    // 初回の資本自立。区分と裾の qSelf 倍を付けたあと、元の用途の計算を別の配列で続ける
                    selfDiag.seeded += wA;
                    meas.firstRevenueIndependence[month] += wA;
                    if (In === 0) selfDiag.preInc += wA;
                    selfDiag.baseline += wA * tail * cfg.qSelf;
                    selfDiag.baselineIn += wA * tailIn * cfg.qSelf;
                    selfPut(selfNxt, pn, Rb, In, Xn >= 1 ? 1 : 0, Nn, wA);
                    O.indep_rev += wA;
                    if (month <= cfg.planDeadline) O.indep_in += wA; else O.indep_out += wA;
                    vAcc += wA * tail * cfg.qSelf; vIn += wA * tailIn * cfg.qSelf;
                  }
                  wP -= wA;
                  if (wP < 1e-15) continue;
                }

                for (let fb = 0; fb < 3; fb++) {
                  let sn, wF;
                  if (fb === 0) { sn = base + cfg.zPub; wF = wP * pAward; }
                  else if (fb === 1) { sn = base + zEqV; wF = wP * (1 - pAward) * pEq; }
                  else { sn = base; wF = wP * (1 - pAward) * (1 - pEq); }
                  if (wF < 1e-15) continue;
                  // 追加調達の試み（第7章 7.3.7 項）。会社化後で試みた回数が上限未満なら、四経路の前に一回試みる。
                  // 成立の分は総必要支出の dr.months か月分を足し、回数を一つ進めて事業を続ける。入金は収支の価値に数えない
                  const drLeft = In >= 1 && (In - 1) < drMax;
                  if (sn <= 0) {
                    if (In === 0) { put(nxt, pn, grid[1], Rb, In, XnF, Nn, wF); continue; }  // 会社化前: 終端しない（最低格子に留まり、速度が落ちるだけ）
                    if (drLeft) {
                      const wS = wF * drPm[t];
                      meas.drAttempt += wF; meas.drSuccess += wS;
                      put(nxt, pn, sn + cfg.dr.months * muFull, Rb, In + 1, XnF, Nn, wS);
                      wF -= wS;
                      if (wF < 1e-15) continue;
                    }
                    // 会社化後: 清算。四経路のうち②③だけが立ちうる（①用途転換は法人を畳むのでできない）
                    meas.firstCashShortfall[month] += wF;
                    const ep = exitPaths(wF, stage, In > 0 ? 1 : 0, uLeft, cfg, O, tl, tlIn, mEconEq * mQuiet);
                    vAcc += ep.v; vIn += ep.vIn;
                    O.liq += ep.use;
                    continue;
                  }
                  // R6: 会社化後に、月末残高を総必要支出（15%上乗せ込み）で割った月数が h_under を切ったら四経路を判定する。
                  // 未確定の公募の採択確率と残り月数の積による延命は用いない。会社化前には無い（2026-11-12 の改訂の案）
                  const hLeft = sn / muFull;
                  if (In >= 1 && hLeft < cfg.hUnder) {
                    if (drLeft) {
                      const wS = wF * drPm[t];
                      meas.drAttempt += wF; meas.drSuccess += wS;
                      put(nxt, pn, sn + cfg.dr.months * muFull, Rb, In + 1, XnF, Nn, wS);
                      wF -= wS;
                      if (wF < 1e-15) continue;
                    }
                    meas.r6BranchMass += wF;
                    const ep = exitPaths(wF, stage, In > 0 ? 1 : 0, uLeft, cfg, O, tl, tlIn, mEconEq * mQuiet);
                    vAcc += ep.v; vIn += ep.vIn;
                    if (ep.use > 1e-15 && posMarketHead >= 0) {
                      if (cfg.traceNoPivot === true) pivotKilled += ep.use;
                      else { put(nxt, posMarketHead, sn, Rb, In, XnF, 0, ep.use); pivotTransitions += ep.use; }
                    }
                    continue;
                  }
                  put(nxt, pn, sn, Rb, In, XnF, Nn, wF);
                }
              }
            }
          }
        }
      }
    }
    const tmp = cur; cur = nxt; nxt = tmp;
    const stmp = selfCur; selfCur = selfNxt; selfNxt = stmp;
  }
  let rest = 0; for (let i = 0; i < SZ; i++) rest += cur[i];
  O.cont = rest;
  const spEnd = tailAt(cfg.T);
  vAcc += rest * spEnd.total * cfg.qUnresolved; vIn += rest * spEnd.inT * cfg.qUnresolved;

  selfDiag.remaining = selfCur.reduce((a, b) => a + b, 0);
  return { outcome: O, diag: { pivotTransitions, pivotKilled, self: selfDiag, ...meas }, v: vAcc, vIn, cRatio: vAcc > 0 ? 1 - vIn / vAcc : null,
           m4mass, m4mean: m4mass > 0 ? m4monthSum / m4mass : null };
}

// ピボットの分類（まとまり5。2026-11-12 の改訂の案）。
// 金額を積む通常の計算を1回、用途転換へ入る質量をそこで止める追跡計算を同じ入力で1回行う。
// 追跡計算の終端への到達量は、一度も転換していない道筋の到達量。通常計算との差が、一度以上転換した道筋の最終到達先ごとの量になる。
// outcome は最終到達先の集計（報告用）として残し、排他的な9区分は nineOutcome に持つ。
// 未着手の用途が無い（uLeft が 0）入力は、転換が起きないので追跡計算を省く。
function makeRunOneClassified(runOneFn) {
  const positive = ['indep_in', 'indep_out', 'lic', 'ma', 'ips'];
  const nineKeys = [...positive, 'pivot', 'exit', 'liq', 'cont'];
  const sum = (o) => nineKeys.reduce((a, k) => a + (o[k] ?? 0), 0);
  const tolerance = 1e-8;      // 負の差と、分類前後の同じ数の合計の検査
  // 確率の合計の検査は 1e-6。A26（小さい質量の省略）で、9区分の合計は 1 から最大 約 9e-9 離れる（格子の全点の実測。F1×REG2・段階3）。
  // 1e-8 では限界に近く、全点を回すスコアの計算が検査で止まりうる。設立の時期の比較の仕様（§9.2）も 1e-6 を使う（2026-11-12 の改訂の案）
  const massTolerance = 1e-6;
  return function runOneClassified(type, reg, cfg, theta, init) {
    if (cfg.traceNoPivot === true) throw new Error('追跡用の指定を通常評価へ渡せない');
    const full = runOneFn(type, reg, cfg, theta, init);
    const uLeft = init?.uLeft ?? cfg.uLeftDef;
    const trace = uLeft > 0
      ? runOneFn(type, reg, { ...cfg, traceNoPivot: true }, theta, init)
      : full;
    const pivotByFinal = {};
    let pivot = 0;
    for (const k of positive) {
      const difference = full.outcome[k] - trace.outcome[k];
      if (difference < -tolerance) throw new Error('ピボット分類の負の差: ' + k);
      pivotByFinal[k] = Math.max(0, difference);
      pivot += pivotByFinal[k];
    }
    const nineOutcome = Object.fromEntries(positive.map((k) => [k, trace.outcome[k]]));
    Object.assign(nineOutcome, { pivot, exit: full.outcome.exit, liq: full.outcome.liq, cont: full.outcome.cont });
    if (Math.abs(sum(nineOutcome) - sum(full.outcome)) > tolerance)
      throw new Error('分類前後の確率の合計が不一致');
    if (Math.abs(sum(full.outcome) - 1) > massTolerance ||
        Math.abs(sum(trace.outcome) + (trace.diag.pivotKilled ?? 0) - 1) > massTolerance)
      throw new Error('終端と追跡停止の確率の合計が不一致');
    return { ...full, nineOutcome, diag: { ...full.diag, pivotByFinal, pivotKilled: undefined } };
  };
}
const runOneClassified = makeRunOneClassified(runOne);

// θ の格子で重ねる
// 案件パラメータのうち、案件ごとに観測・判定して置ける成分は init で固定できる。
// 固定しなかった成分は、これまでどおり事前分布の格子で重ねる。
//   init.sigma … 産官学モメンタム（-1 逆風 / 0 無風 / +1 追い風）。§6.I-1-4 の手続きで判定した値
//   init.e     … エバンジェリスト機能が埋まる見込み（0〜1）
//   init.kIP   … 専有可能性（0〜1）。取り分 φ_u と競合の消失率に効く
//   init.rMan  … 自走力の実額（万円／月）。改訂 M3
//   init.c     … 変換能力の推定値（#2026-08-29-1）。渡すと cNodes の中心を c へ置き換える。
//                幅は GSD 1.65 のまま（点推定にすると不確かさが消える）
//   init.quietMonths … 無風期間（ポジティブな動きが出ていない月数。#2026-08-29-1）。
//                申し出到来率と四経路②③に乗数 m_q が掛かる。未観測は渡さない（乗数 1）
//   init.funcs … 八機能の充足（#2026-08-29-2）。例 { f2: 0, f4: 0.3 }。0〜1。
//                f2 < 1 を指定した案件は 7 機能 128 通りで計算し、λ^core を外す。
//                f3〜7 は「評価日に確率 f で充足済み、残りが供給過程で埋まる」。省略は既定の扱い
//                f1Observed は機能1（エバンジェリスト）の現在の実働確認で、数値 0 または 1 だけを受ける。
//                例 { f1Observed: 1, f2: 1 }。1 なら機能1の空席確率は全月 0。0 またはキーの省略なら従来の探索の式。
//                省略は「空席を観測した」という意味ではない。将来の探索の見込み e は別に渡し、この項目では上書きしない。
//                init へ直接渡す null は入力の誤り（入力行の funcs_f1_observed が null のときは、toInit が省略する）
//   init.burnMan … 案件ごとのバーンレート（万円／月。#2026-08-29-2）。評価日の会社化状態の側の μ を
//                差し替える。会社化前の観測が会社化後の既定を上回る場合は会社化後もその値を下限にする
//   init.burnPostMan … 会社化後の計画バーン（万円／月。#2026-08-29-3）。会社化前の案件だけが使える。
//                設立後のスモールスタート計画を型の既定で上書きしないための口
function runTheta(type, reg, cfg, init) {
  const seq = gateSequence(type, reg);
  const MEAS_ARR = ['firstInc', 'firstM4', 'firstRevenueIndependence', 'firstCashShortfall'];
  const MEAS_SCALAR = ['m4AfterRevenueIndependence', 'r6BranchMass', 'drAttempt', 'drSuccess'];
  const aggMeas = { firstInc: null, firstM4: null, firstRevenueIndependence: null, firstCashShortfall: null,
    m4AfterRevenueIndependence: 0, r6BranchMass: 0, drAttempt: 0, drSuccess: 0 };
  const agg = { outcome: {}, nineOutcome: {}, pivotByFinal: {}, v: 0, vIn: 0, m4mass: 0, m4meanW: 0, pivotTransitions: 0 };
  const vs = [];
  // ψ の中央値は評価の開始時点の段階で一度だけ決め、月次では変えない（#2026-11-12-1）。
  // 段階は init.gate の開始位置が「すでに越えた段階」。M4 到達済みの入力は段階6。
  let psiStage = 0;
  if (init && init.m4Reached === true) psiStage = 6;
  else if (init && init.gate !== undefined) {
    const start = buildPositions(type, reg, cfg);
    const gi = start.seq.indexOf(init.gate);
    if (gi < 0) throw new Error(`未知のゲート ${init.gate}。${type}×${reg} の列: ${start.seq.join(', ')}`);
    psiStage = start.stageAt[start.gateStart[gi]];
  }
  const psiMed = cfg.psiByStage[Math.min(cfg.psiByStage.length - 1, psiStage)];
  const cfgL = (init && init.kIP !== undefined) ? Object.assign(JSON.parse(JSON.stringify(cfg)), { kIP: init.kIP }) : cfg;
  const sigmaNodes = (init && init.sigma !== undefined) ? [[init.sigma, 1.0]] : cfgL.sigmaNodes;
  const eVal = (init && init.e !== undefined) ? init.e : cfgL.eMed;
  const rBase = (init && init.rMan !== undefined) ? init.rMan : cfgL.rDef[type];
  // 変換能力 c の案件ごとの推定（#2026-08-29-1）: 分布の中心を置き換え、幅（GSD 1.65）は保つ。
  // 既定の cNodes は中央値 1.0 なので、各節点に c を掛けるだけでよい。
  const cNodesEff = (init && init.c !== undefined)
    ? cfgL.cNodes.map(([cv, w]) => [cv * init.c, w])
    : cfgL.cNodes;
  for (const [c, wc] of cNodesEff) {
    for (const dp of [-1, 0, 1]) {
      const psi = Math.min(0.98, Math.max(0.05, psiMed + dp * cfgL.psiSpread));
      const wp = dp === 0 ? 0.5 : 0.25;
      for (const [sigma, ws] of sigmaNodes) {
        for (const [r, wr] of rNodes(cfgL, rBase)) {
          const w = wc * wp * ws * wr;
          const res = runOneClassified(type, reg, cfgL, { c, psi, sigma, e: eVal, r }, init);
          for (const k of Object.keys(res.outcome)) agg.outcome[k] = (agg.outcome[k] || 0) + w * res.outcome[k];
          for (const k of Object.keys(res.nineOutcome)) agg.nineOutcome[k] = (agg.nineOutcome[k] || 0) + w * res.nineOutcome[k];
          for (const [k, x] of Object.entries(res.diag.pivotByFinal)) agg.pivotByFinal[k] = (agg.pivotByFinal[k] || 0) + w * x;
          agg.v += w * res.v; agg.vIn += w * res.vIn; agg.m4mass += w * res.m4mass;
          agg.pivotTransitions += w * (res.diag?.pivotTransitions ?? 0);
          // 計測は、格子の各点の配列を同じ重みで足す（点ごとの中央値の平均などは取らない）
          for (const k of MEAS_ARR) {
            const src = res.diag?.[k];
            if (!src) continue;
            if (!aggMeas[k]) aggMeas[k] = new Array(src.length).fill(0);
            for (let i = 0; i < src.length; i++) aggMeas[k][i] += w * src[i];
          }
          for (const k of MEAS_SCALAR) aggMeas[k] += w * (res.diag?.[k] ?? 0);
          if (res.m4mean !== null) agg.m4meanW += w * res.m4mass * res.m4mean;
          vs.push([res.v, w]);
        }
      }
    }
  }
  vs.sort((a, b) => a[0] - b[0]);
  const quant = (p) => { let acc = 0; for (const [v, w] of vs) { acc += w; if (acc >= p) return v; } return vs[vs.length - 1][0]; };
  return { seq, outcome: agg.outcome, nineOutcome: agg.nineOutcome, diag: { pivotTransitions: agg.pivotTransitions, pivotByFinal: agg.pivotByFinal, ...aggMeas }, v: agg.v, cRatio: agg.v > 0 ? 1 - agg.vIn / agg.v : null, pM4: agg.m4mass,
           m4mean: agg.m4mass > 0 ? agg.m4meanW / agg.m4mass : null,
           v10: quant(0.10), v50: quant(0.50), v90: quant(0.90) };
}

// 自走力 r の3点（0・中央値・高）の重み。ゼロの質量 p を動かしても総和が 1 のままになるよう、
// 残りの二点は 55:20 の比で配り直す（#2026-11-12-1）。既定 p=0.25 は元の 0.55・0.20 をそのまま返す。
function rNodes(cfg, rBase) {
  const p = cfg.rZeroProb;
  if (!Number.isFinite(p) || p < 0 || p > 1) throw new RangeError('rZeroProb は 0〜1');
  if (p === 0.25) return [[0, 0.25], [rBase, 0.55], [rBase * cfg.rHighMult, 0.20]];
  const high = (1 - p) * (0.20 / 0.75);
  return [[0, p], [rBase, (1 - p) - high], [rBase * cfg.rHighMult, high]];
}

module.exports = { CFG, runOne, runOneClassified, runTheta, gateSequence, buildPositions };

// ─────────────────────────────────────────────────────────── 実行

if (require.main === module) {
  const mode = process.argv[2] || 'degen';
  const clone = (o) => JSON.parse(JSON.stringify(o));

  if (mode === 'degen') {
    console.log('# 縮退検査 — 工程の型 × 規制属性（Tier 0 既定、天井=1 に正規化）\n');
    console.log('| 型 | 規制 | ゲート数 | M4到達 | 到達月数の平均 | M4到達または反復収入自立 | うちM4到達 | うち反復収入自立 | ライセンス | 知財売却 | M&A | 撤退 | 清算 | 未決着 | V(10%) | V(中央) | V(90%) | 継続価値の比率 |');
    console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
    for (const type of ['F1','F2','F3','F4']) {
      for (const reg of ['REG0','REG1','REG2']) {
        const t0 = Date.now();
        const r = runTheta(type, reg, CFG);
        const o = r.outcome;
        const pc = (x) => (100 * (x || 0)).toFixed(1) + '%';
        console.log(`| ${type} | ${reg} | ${r.seq.length} | ${pc(r.pM4)} | ${r.m4mean !== null ? r.m4mean.toFixed(0) + 'か月' : '—'} | ${pc((o.indep_in||0)+(o.indep_out||0))} | ${pc(o.indep_m4)} | ${pc(o.indep_rev)} | ${pc(o.lic)} | ${pc(o.ips)} | ${pc(o.ma)} | ${pc(o.exit)} | ${pc(o.liq)} | ${pc(o.cont)} | ${r.v10.toFixed(3)} | ${r.v50.toFixed(3)} | ${r.v90.toFixed(3)} | ${r.cRatio!==null?pc(r.cRatio):'—'} |`);
      }
    }
  }

  if (mode === 'sens') {
    // 選択した係数の水準を ×1.1 / ÷1.1 に動かす。確率は0.999以下へ切る。
    // 実際に計算が読む係数を動かす（#2026-11-12-1）:
    //   nuLic … ライセンスの到来率は CFG の直下に無く、分野別の nuK[reg].lic（F3・F4×REG0 は nuKSoft.lic）を使う
    //   qLic  … 承継者の到達確率は qExit.lic が価値に掛かる（M&A・知財売却の qExit は動かさない）
    const PROB = new Set(['phiBase','restrictedWaste','stallShare','dOther']);
    const applyKnob = (cfg, key, factor, type, reg) => {
      if (key === 'nuLic') {
        const nk = (reg === 'REG0' && (type === 'F3' || type === 'F4')) ? cfg.nuKSoft : cfg.nuK[reg];
        nk.lic *= factor;
      } else if (key === 'qLic') {
        cfg.qExit.lic = Math.min(0.999, cfg.qExit.lic * factor);
      } else {
        const v = cfg[key] * factor;
        if (!Number.isFinite(v)) throw new Error(`感度対象に数値が無い: ${key}`);
        cfg[key] = PROB.has(key) ? Math.min(0.999, v) : v;
      }
      return cfg;
    };
    // 差分商の分母は、係数の実際の相対間隔（確率の上限 0.999 で切れたときも、実際に動かした幅を使う）（#2026-11-12-1）
    const knobValue = (cfg, key, type, reg) => {
      if (key === 'nuLic') {
        return (reg === 'REG0' && (type === 'F3' || type === 'F4'))
          ? cfg.nuKSoft.lic : cfg.nuK[reg].lic;
      }
      return key === 'qLic' ? cfg.qExit.lic : cfg[key];
    };
    const elasticity = (vu, vd, v0, ku, kd, k0) => {
      if (v0 === 0 || k0 === 0 || ku === kd) return null;
      return ((vu - vd) / v0) / ((ku - kd) / k0);
    };
    // alphaLoc・alphaNow・Lu は #2026-09-02-1 で前向き計算から外したので、振る対象ではない。
    // なお ±10% の摂動は、正本が離散の水準を定義している係数の差を捉えられない（§6.I-1-3）。
    const knobs = [
      ['scale', 'M_g 共通倍率'], ['phiBase', 'φ 基準採択率'],
      ['oppRate', '機会の到来率'], ['nuLic', 'ライセンス到来率'], ['betaBar', '承認の解決率'],
      ['lamComp', '競合の消失率'], ['lamDem', '需要の消失率'], ['lamObs', '陳腐化'],
      ['kSup', '機能の供給速度'], ['kEva', 'エバンジェリスト探索'], ['nuC', '受託の到来率'],
      ['nuEq', '民間調達の到来率'], ['stallShare', '滞留の分岐'], ['phiU0', 'φ_u 切片'],
      ['phiU1', 'φ_u 傾き'],   // 自走力ゼロの確率は、r の3点の混合で別に測る（下）
      ['restrictedWaste', '充当できない割合'], ['dOther', '主担当でない空席'],
      ['qLic', 'ライセンスの承継者到達確率 qExit.lic'], ['kIP', '専有可能性'],
    ];
    for (const [type, reg] of [['F1','REG0'],['F3','REG0'],['F1','REG2']]) {
      console.log(`\n## ${type} × ${reg}（代表1点、選択した19対象＋自走力ゼロの分布感度）\n`);
      const base = clone(CFG);
      const th = { c: 1.0, psi: base.psiByStage[0], sigma: 0, e: base.eMed, r: base.rDef[type] * (1 - base.rZeroProb) };
      const v0 = runOne(type, reg, base, th).v;
      console.log(`基準の V = ${v0.toFixed(4)}（天井の年額1円あたりの現在価値）\n`);
      console.log('| 係数 | 意味 | V(水準×1.1、確率は上限適用) | V(水準÷1.1) | 弾力性 | 単調性 |');
      console.log('|---|---|---|---|---|---|');
      const rows = [];
      for (const [k, label] of knobs) {
        const up = applyKnob(clone(base), k, 1.1, type, reg);
        const dn = applyKnob(clone(base), k, 1 / 1.1, type, reg);
        const vu = runOne(type, reg, up, th).v, vd = runOne(type, reg, dn, th).v;
        rows.push([k, label, vu, vd, elasticity(vu, vd, v0,
          knobValue(up, k, type, reg), knobValue(dn, k, type, reg),
          knobValue(base, k, type, reg))]);
      }
      rows.sort((a, b) => Math.abs(b[4] ?? 0) - Math.abs(a[4] ?? 0));
      for (const [k, label, vu, vd, el] of rows)
        console.log(`| ${k} | ${label} | ${vu.toFixed(4)} | ${vd.toFixed(4)} | ${el === null ? '定義できない' : el.toFixed(3)} | ${(vu - v0) * (v0 - vd) >= 0 ? '単調' : '**反転**'} |`);
      // 自走力ゼロの確率: r の3点（0・中央値・高）の条件付き価値を1回ずつ計算し、重みの規則（rNodes）で混ぜる。
      // 代表1点の表とは分母（期待値）が違うので、上の順位と束には混ぜない（#2026-11-12-1）
      {
        const rBaseX = base.rDef[type];
        const rValues = [0, rBaseX, rBaseX * base.rHighMult].map((r) => runOne(type, reg, base, Object.assign({}, th, { r })).v);
        const rMix = (pz) => rNodes(Object.assign({}, base, { rZeroProb: pz }), rBaseX).reduce((sum, nd, i) => sum + nd[1] * rValues[i], 0);
        const p0 = base.rZeroProb;
        const pu = Math.min(0.999, p0 * 1.1), pd = p0 / 1.1;
        const rz0 = rMix(p0), rzu = rMix(pu), rzd = rMix(pd);
        const rzel = elasticity(rzu, rzd, rz0, pu, pd, p0);
        console.log('\n### 自走力ゼロの確率の感度（r の3点だけを混合）\n');
        console.log('| 基準の期待値 | 上側 | 下側 | 弾力性 |');
        console.log('|---|---|---|---|');
        console.log(`| ${rz0.toFixed(6)} | ${rzu.toFixed(6)} | ${rzd.toFixed(6)} | ${rzel === null ? '定義できない' : rzel.toFixed(6)} |`);
      }
      const validRows = rows.filter((row) => row[4] !== null);
      const dir = {}; for (const [k, , , , el] of validRows) dir[k] = el >= 0 ? 1 : -1;
      const mkBundle = (keys, s) => { const cc = clone(base); for (const k of keys) applyKnob(cc, k, dir[k] * s > 0 ? 1.4 : 1 / 1.4, type, reg); return cc; };
      const mkAll = (s) => mkBundle(Object.keys(dir), s);
      const top5 = validRows.slice(0, 5).map(r => r[0]);
      const mkTop = (s) => mkBundle(top5, s);
      console.log(`\n選択した19対象の包絡: 悲観 ${runOne(type,reg,mkAll(-1),th).v.toFixed(4)} / 基準 ${v0.toFixed(4)} / 楽観 ${runOne(type,reg,mkAll(1),th).v.toFixed(4)}`);
      console.log(`上位5係数だけの束（この19対象の中での幅）: 悲観 ${runOne(type,reg,mkTop(-1),th).v.toFixed(4)} / 基準 ${v0.toFixed(4)} / 楽観 ${runOne(type,reg,mkTop(1),th).v.toFixed(4)}`);
      console.log(`（上位5: ${top5.join(', ')}）`);
      // σ の3点感度
      const vs = [-1,0,1].map(sg => runOne(type, reg, base, Object.assign({}, th, { sigma: sg })).v);
      console.log(`σ の3点感度: 逆風 ${vs[0].toFixed(4)} / 無風 ${vs[1].toFixed(4)} / 追い風 ${vs[2].toFixed(4)}`);
      // 割引率の感度
      for (const dd of [0.01, 0.04]) { const cc = clone(base); cc.d = dd; process.stdout.write(`d=${dd}: ${runOne(type,reg,cc,th).v.toFixed(4)}  `); }
      console.log('');
    }
  }

  if (mode === 'conv') {
    console.log('# 格子の収束検査（代表1点。c=1、psi=0.45、sigma=0、e=0.5、r=0.75r_base。刻み＝会社化前バーンレートの1/n）\n');
    console.log('| 組 | 1/1 | 1/2（採用） | 1/4 | 1/8 | 1/2 対 1/4 | 1/2 対 1/8 |');
    console.log('|---|---|---|---|---|---|---|');
    for (const [type, reg] of [['F1','REG0'],['F2','REG0'],['F3','REG0'],['F4','REG0'],['F1','REG2']]) {
      const th = { c: 1.0, psi: CFG.psiByStage[0], sigma: 0, e: CFG.eMed, r: CFG.rDef[type] * (1 - CFG.rZeroProb) };
      const vs = [1,2,4,8].map(gf => { const cc = clone(CFG); cc.gridFine = gf; return runOne(type, reg, cc, th).v; });
      const pc = (a,b) => (100 * Math.abs(a - b) / b).toFixed(2) + '%';
      console.log(`| ${type}×${reg} | ${vs[0].toFixed(4)} | ${vs[1].toFixed(4)} | ${vs[2].toFixed(4)} | ${vs[3].toFixed(4)} | ${pc(vs[2],vs[1])} | ${pc(vs[3],vs[1])} |`);
    }
  }

  if (mode === 'calib') {
    console.log('# 絶対水準の較正 — 共通倍率 scale と、到達に条件づけた M4 到達月数\n');
    console.log('| scale | F1×REG0 到達 | 到達月数 | F2×REG0 到達 | 到達月数 | F3×REG0 到達 | 到達月数 |');
    console.log('|---|---|---|---|---|---|---|');
    for (const sc of [0.7, 0.85, 1.0, 1.15, 1.3]) {
      const cfg = clone(CFG); cfg.scale = sc;
      const out = [];
      for (const type of ['F1','F2','F3']) {
        const r = runTheta(type, 'REG0', cfg);
        out.push(`${(100*r.pM4).toFixed(1)}%`, r.m4mean !== null ? r.m4mean.toFixed(0) : '—');
      }
      console.log(`| ${sc} | ${out.join(' | ')} |`);
    }
  }
}
