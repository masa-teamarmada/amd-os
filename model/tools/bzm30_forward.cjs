#!/usr/bin/env node
'use strict';
/*
 * BZM 3.0 — 前向きの積み上げ計算（参照実装）
 *
 * 目的: 係数の分野別初期値 v2 を、紙の上の表ではなく計算で検査する。
 *   (a) 縮退検査: 工程の型4 × 規制属性3 で、評価期間内に M4 へ到達する確率と9区分の分布
 *   (b) 絶対水準の検算: 到達したシナリオに条件づけた M4 到達月数の平均
 *   (c) 感度: 悲観束・楽観束と、係数ごとの弾力性
 *   (d) 単調性: 全係数の数値微分で符号を実測する
 *
 * 計算法は格子上の数値計算（モデルページ §2 の確定。乱数の試行は用いない）。
 *
 * 宣言する近似（近似誤差はモデルページ §5.8 が要求する「状態の束ね方の明示」にあたる）:
 *   A1 自由資金と使途制限資金を合算した単一の残高で近似し、充当不能分を型別の係数で控除する
 *   A2 受託契約を「契約なし／契約中」の2状態にし、残り拘束月数を満了ハザード（平均12か月）で近似する
 *   A3 稼働用途は M4 到達後の解析的な裾で扱い、受託由来のサービス用途は価値に入れない
 *   A4 権利・承認の残件を「残件数」だけで持ち、種類別の会議暦は平均の解決率へ畳む
 *   A5 滞留の自動分岐を、ハザード位置での付加ハザードで近似する
 *   A6 天井を1に正規化する。出力の価値は「年額の国内純増1円あたりの現在価値」
 *
 * 担い手の充足は評価日からの経過月だけで決まる（AMD の供給過程・探索過程）ので状態に持たず、
 * 空席パターン64通りの厳密な期待値として毎月・ゲートごとに前計算する（近似ではない）。
 */

// ─────────────────────────────────────────────────────────── 係数（v3 の初期値）

const CFG = {
  T: 240,                    // 評価期間（月）
  qLic: 0.60,                // 申し出で決着したとき、承継者が残りの市場ゲートを越える確率（根拠レベル C）
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
  phiBase: 0.28,             // 制度混合の基準採択率（基準化条件つき。I-4 参照）
  zPub: 3000,                // 1件あたりの補給額（万円）
  mgPhi: [0.60, 0.85, 1.00, 1.15, 1.35, 1.35, 1.35],  // 証拠水準（段階0〜6）

  // 民間調達
  nuEq: 0.030,               // 会社化後の民間調達の到来率（件／月）
  zEq: { REG0: 10000, REG1: 10000, REG2: 50000 },   // 1件あたり（万円）。規制の重い領域は1回の調達規模が大きい
  incStage: { REG0: 4, REG1: 4, REG2: 3 },          // R3 会社化の需要の証拠の段階（REG-2 は有償PoC が列に無いため T3・治験I 相当）

  // I-5 申し出
  // 出口の到来率は分野で構造が違う。創薬・医療機器は導出（ライセンス）と M&A が主経路で、
  // 量産契約（M4）へ自力で到達する経路はほとんど通らない（まさ 2026-08-25）
  nuK: {
    REG0: { lic: 0.0030, ma: 0.0015, ips: 0.0010 },
    REG1: { lic: 0.0030, ma: 0.0018, ips: 0.0010 },
    REG2: { lic: 0.0060, ma: 0.0050, ips: 0.0012 },
  },
  nuKSoft: { lic: 0.0025, ma: 0.0025, ips: 0.0008 },   // F3・F4（ソフト・サービス型）は M&A が主
  // 承継者が残りの市場ゲートを越える確率。買収側は資源と継続の意思を持つので高い
  qExit: { lic: 0.60, ma: 0.75, ips: 0.45 },

  // 撤退の四経路（改訂 N1。#2026-08-27-1）。資金切れ・不成立の先を単一の終端にしない
  exitPath: {
    pUse: 0.35,      // ①用途転換（未着手の用途が残り、技術系ゲートを越えているとき）
    pLic: 0.30,      // ③ライセンスへの畳み込み（証拠水準 gLic 以上）
    pCls: 0.20,      // ②出口クラスの転換（会社化済み・証拠水準 gCls 以上）
    gLic: 3,         // ③が立つ証拠水準（T3・治験I相 以上）
    gCls: 4,         // ②が立つ証拠水準（M2・治験II相・規格試験 以上）
    licDisc: 0.70,   // 自走をあきらめた状態のライセンスは条件が悪い分の割引
  },
  qRet: 0,           // ④研究への返却は価値を積まない。後に誰かが事業化するなら、それは別の案件として数える
                     // （まさ 2026-08-27「再起するとしたら、もうそのときは別PJとして認識すればいいだけ」）
  uLeftDef: 0,       // 未着手の用途がどれだけ残るか（0〜1）。用途1本の Tier 0 では 0

  // 会社化前は、資金は前進の速度を変えるだけで、資金切れという終端を持たない（#2026-08-29-1）。
  // 資金がほぼ無いあいだは前進が遅れ、支出は大学の基盤で回る。証拠の陳腐化と消失は効き続ける。
  preIncAdvMult: 0.35,   // 会社化前・資金がほぼ無いあいだ（残高が最低格子）の前進の速さ
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
  contractExit: 1 / 12,      // 受託契約の満了ハザード

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
  // 量産契約より前に立つ売上（有償PoC・サンプル販売・初期出荷）。会社化前バーンレートに対する割合
  yByStage: [0, 0, 0, 0.10, 0.35, 0.80, 1.00],
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
  alphaLoc: 0.85,            // 前倒し期間 L_u 以降の控除率（立地差だけが残る）
  alphaNow: 0.30,            // 評価日の控除率（案件ごとの調査項目。既定は暫定）
  Lu: 36,                    // 前倒し期間（月）。6.E-3 の確定値のうち「競合が活発」側を Tier 0 既定にする
  rampMonths: 12,            // 稼働度の立ち上がり
  Hc: 120,                   // 継続価値の延長

  // 規則（Tier 0 既定）
  kExit: 3,                  // R2 撤退の不成立回数
  gStar: { REG0: 3, REG1: 3, REG2: 2 },   // R4 申し出の検討開始段階
  hUnder: 6,                 // R6 残り月数
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
//   f2 は「1 - 充足」が時間不変の空席確率（移せない機能なので供給過程では埋まらない）。
//   f3〜7 は「評価日に確率 f で充足済み、残り (1-f) が供給過程で埋まる」。省略はいままでの扱い。
function vacancyProbs(t, e, cfg, funcs) {
  const p = {};
  p[1] = Math.exp(-e * cfg.kEva * t);
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

// ─────────────────────────────────────────────────────────── 資金の格子

function moneyGrid(cfg, muPre, muPost) {
  // 資金の刻みはバーンレートに合わせる（支出は加算なので対数格子では毎月が1区間に満たず、分布が人工的に拡散する）。
  // 吸収（資金切れ）の近傍を細かく、遠方を粗く: 0 → 線形（刻み = 会社化前バーンの半分） → 対数の裾。
  const step = muPre / (cfg.gridFine || 2);
  const linTop = 18 * muPost;                 // 会社化後18か月分までは線形
  const g = [0];
  for (let v = step; v <= linTop; v += step) g.push(v);
  const hi = Math.log(4e5 * 1);               // 40億円（万円単位で 400000）
  const lo = Math.log(g[g.length - 1] * 1.05);
  const nLog = 28;
  for (let i = 0; i < nLog; i++) g.push(Math.exp(lo + (hi - lo) * i / (nLog - 1)));
  return g;
}

// ─────────────────────────────────────────────────────────── 価値の裾（M4 到達後）

function tailSplit(tM4, cfg, kip) {
  const phiU = cfg.phiU0 + cfg.phiU1 * kip;
  const dm = Math.pow(1 + cfg.d, 1 / 12) - 1;
  const surv = 1 - cfg.lamObs / 12;
  let v = 0, inT = 0;
  const end = cfg.T + cfg.Hc;
  let s = 1;
  for (let t = tM4; t < end; t++) {
    const h = t - tM4;
    const ramp = Math.min(1, (h + 1) / cfg.rampMonths);
    const alpha = (t < cfg.Lu) ? cfg.alphaNow : cfg.alphaLoc;
    const inc = Math.pow(1 + dm, -t) * s * ramp * phiU * (1 - alpha) / 12;
    v += inc; if (t < cfg.T) inT += inc;
    s *= surv;
  }
  // 延長終端で生き残っている分の永久年金
  const q = surv / Math.pow(1 + cfg.d, 1 / 12);
  const ann = q / (1 - q);
  const perp = Math.pow(1 + dm, -end) * s * phiU * (1 - cfg.alphaLoc) / 12 * ann;
  return { inT, beyond: v - inT + perp, total: v + perp };
}
function tailValue(tM4, cfg, kip) { return tailSplit(tM4, cfg, kip).total; }

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
  // 9区分への割当: ③→ライセンス、②→M&A、④→撤退（価値はゼロにしない）、①→ピボット
  O.lic += wF * pLicF;
  O.ma  += wF * pCls;
  O.exit += wF * pRet;
  O.pivot += wF * pUse;
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
function runOne(type, reg, cfg, theta, init) {
  const { c, psi, sigma, e, r } = theta;
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
  const grid = moneyGrid(cfg, muPre * (1 + cfg.restrictedWaste), muPost * (1 + cfg.restrictedWaste));
  const S = grid.length;
  const NR = cfg.R0 + 1, NI = 2, NX = 2, NN = cfg.kExit + 1;
  const st_x = NN, st_i = NN * NX, st_R = NN * NX * NI;
  const st_s = NN * NX * NI * NR, st_p = st_s * S;
  const SZ = P * S * NR * NI * NX * NN;
  let cur = new Float64Array(SZ), nxt = new Float64Array(SZ);

  const gStar = cfg.gStar[reg];
  const rhoMax = cfg.rhoMax[type];
  // 八機能の充足（#2026-08-29-2）。機能2 の空席を指定した案件は 7 機能 128 通りへ広げ、
  // 恒久喪失率 λ^core を外す（同じ喪失を率と状態で二回数えない）
  const funcs = init && init.funcs ? init.funcs : null;
  const f2Vacant = Boolean(funcs && funcs.f2 !== undefined && funcs.f2 < 1);
  const funcsList = f2Vacant ? FUNCS7 : FUNCS;
  const lamCoreEff = f2Vacant ? 0 : cfg.lamCore;
  const lamMonth = (cfg.lamComp * (1.6 - 1.2 * cfg.kIP) * cfg.sigmaMult.lam[String(sigma)]
                    + cfg.lamDem + lamCoreEff) / 12;
  const surv1 = 1 - lamMonth;

  // 価値の裾を前計算する（状態に依らないので月ごとに一度だけ）
  const TAIL = new Float64Array(cfg.T + 2), TAIL_IN = new Float64Array(cfg.T + 2);
  for (let t = 0; t <= cfg.T + 1; t++) { const sp = tailSplit(t, cfg, cfg.kIP); TAIL[t] = sp.total; TAIL_IN[t] = sp.inT; }

  let p0 = 0, R0 = cfg.R0, inc0 = 0, x0 = 0;
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
  let i0 = 1; while (i0 < S - 1 && grid[i0 + 1] <= s0) i0++;
  cur[p0 * st_p + i0 * st_s + R0 * st_R + inc0 * st_i + x0 * st_x] = 1;

  const O = { indep_in: 0, indep_out: 0, indep_m4: 0, indep_rev: 0, lic: 0, ma: 0, ips: 0, pivot: 0, exit: 0, liq: 0, cont: 0 };
  let vAcc = 0, vIn = 0, m4mass = 0, m4monthSum = 0;

  // 前計算: 月 × 位置の前進確率、担い手乗数
  const advC = new Float64Array((cfg.T + 1) * P);
  const advCx = new Float64Array((cfg.T + 1) * P);   // 受託契約中（rho = rho_max）の前進確率
  const gamNear = cfg.gamma.near;
  const phiM = new Float64Array(cfg.T + 1), nuM = new Float64Array(cfg.T + 1);
  for (let t = 0; t <= cfg.T; t++) {
    const pv = vacancyProbs(t, e, cfg, funcs);
    phiM[t] = expectedMult(cfg.dPhi, pv, funcsList);
    nuM[t] = expectedMult(cfg.dNu, pv, funcsList);
    for (let p = 0; p < P; p++) {
      const q = B.pos[p];
      if (q.role !== 'hazard') continue;
      const Kbase = q.kres * ((q.kind === 'tech') ? psi : 1) * c;
      advC[t * P + p] = expectedAdvance(Kbase, cfg.dMain[q.mainKey] || {}, pv, cfg.dOther, funcsList);
      advCx[t * P + p] = expectedAdvance(Kbase * Math.max(0, 1 - gamNear * rhoMax),
                                         cfg.dMain[q.mainKey] || {}, pv, cfg.dOther, funcsList);
    }
  }
  // ①用途転換の戻り先: 市場系ゲートの先頭（技術系の到達は保つ）
  let posMarketHead = -1;
  for (let q0 = 0; q0 < P; q0++) if (B.pos[q0].kind === 'market') { posMarketHead = q0; break; }

  // 位置ごとの M4 までの残り月数（申し出の価値づけに使う）
  const remM = new Float64Array(P);
  { let acc = 0; for (let p = P - 1; p >= 0; p--) { remM[p] = acc; acc += 1; } }

  // 位置ごとの静的な情報
  const posRole = new Int8Array(P), posNext = new Int32Array(P), posHead = new Int32Array(P);
  const posPass = new Float64Array(P), posStage = new Int32Array(P), posIsM4 = new Int8Array(P);
  for (let p = 0; p < P; p++) {
    const q = B.pos[p];
    posRole[p] = q.role === 'hazard' ? 1 : (q.reviewEnd ? 2 : 0);
    posNext[p] = p + 1;
    posHead[p] = B.gateStart[q.gi];
    posPass[p] = q.pass !== undefined ? q.pass : 1.0;
    posStage[p] = B.stageAt[p];
    posIsM4[p] = (q.gate === 'M4') ? 1 : 0;
  }

  // 資金の格子への配分（分岐なしで書き込む）
  const gLast = grid[S - 1];
  function put(arr, p, sVal, R, I, X, N, w) {
    if (w <= 1e-16) return;
    if (sVal <= 0) { O.exit += w; return; }
    const baseIdx = p * st_p + R * st_R + I * st_i + X * st_x + N;
    if (sVal >= gLast) { arr[baseIdx + (S - 1) * st_s] += w; return; }
    let lo = 1, hi = S - 1;
    while (lo + 1 < hi) { const mid = (lo + hi) >> 1; if (grid[mid] <= sVal) lo = mid; else hi = mid; }
    const f = Math.max(0, Math.min(1, (sVal - grid[lo]) / (grid[lo + 1] - grid[lo])));
    arr[baseIdx + lo * st_s] += w * (1 - f);
    arr[baseIdx + (lo + 1) * st_s] += w * f;
  }

  for (let t = 0; t < cfg.T; t++) {
    nxt.fill(0);
    const pm = phiM[t], nm = nuM[t], tail = TAIL[t], tailIn = TAIL_IN[t];
    const sgOffer = cfg.sigmaMult.offer[String(sigma)];
    const sgPhi = cfg.sigmaMult.phi[String(sigma)];
    const sgNuC = cfg.sigmaMult.nuC[String(sigma)];
    const ipFac = 0.4 + 1.2 * cfg.kIP;
    for (let p = 0; p < P; p++) {
      const stage = posStage[p], role = posRole[p];
      const advBase = advC[t * P + p], advBaseX = advCx[t * P + p];
      const moBase = cfg.mgOffer[stage] * ipFac * sgOffer * nm * mQuiet;
      const nk = (reg === 'REG0' && (type === 'F3' || type === 'F4')) ? cfg.nuKSoft : cfg.nuK[reg];
      const pLic = 1 - Math.exp(-nk.lic * moBase);
      const pIps = 1 - Math.exp(-nk.ips * moBase);
      const pMA = 1 - Math.exp(-nk.ma * moBase);
      const phiEff = Math.min(0.70, Math.max(0.03, cfg.phiBase * sgPhi * cfg.mgPhi[stage] * pm));
      // 改訂 N2: 天井の純増と単位採算が、採択率と民間調達の到来率に効く
      const pAward = Math.min(0.999, cfg.oppRate * phiEff * mEconPub);
      const pEqBase = 1 - Math.exp(-cfg.nuEq * cfg.mgPhi[stage] * sgPhi * nm * mEconEq);
      const zEqV = cfg.zEq[reg];
      const incTh = cfg.incStage[reg];
      const mc = Math.pow(Math.max(r, 1) / cfg.rRef, 0.5) * sgNuC * cfg.mgNuC[stage];
      const pC = 1 - Math.exp(-cfg.nuC * mc);
      const offerOK = (stage >= gStar);
      // 申し出で決着しても、承継者が残りの市場ゲートを越えなければ国内付加価値は立たない（6.A-2）
      const offIdx = Math.min(cfg.T, t + Math.round(remM[p]));
      const tl = TAIL[offIdx], tlIn = TAIL_IN[offIdx];
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
            const pa = (I === 1) ? pMA : 0;
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
              if (X === 0) { Xn = xb; wX = xb === 1 ? wR * pC : wR * (1 - pC); }
              else { Xn = xb === 0 ? 0 : 1; wX = xb === 0 ? wR * cfg.contractExit : wR * (1 - cfg.contractExit); }
              if (wX < 1e-15) continue;

              // 位置の分岐
              for (let pb = 0; pb < 4; pb++) {
                let pn, wP, dn, reached = false;
                if (role === 1) {
                  let pa2 = (X === 1) ? advBaseX : advBase;
                  if (si === 1 && I === 0) pa2 *= cfg.preIncAdvMult;   // 会社化前・資金がほぼ無いあいだは前進が遅い
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
                const Nn = N + dn;
                if (Nn >= cfg.kExit) {
                  const ep = exitPaths(wP, stage, I, uLeft, cfg, O, tl, tlIn, mEconEq * mQuiet);
                  vAcc += ep.v; vIn += ep.vIn;
                  if (ep.use > 1e-15 && posMarketHead >= 0)
                    put(nxt, posMarketHead, sVal, R, I, X, 0, ep.use);   // 履歴の不成立回数は 0 へ戻す
                  continue;
                }

                if (reached) {
                  m4mass += wP; m4monthSum += wP * t;
                  vAcc += wP * tail; vIn += wP * tailIn; O.indep_m4 += wP;
                  if (t <= cfg.planDeadline) O.indep_in += wP; else O.indep_out += wP;
                  continue;
                }

                // 4. 会社化
                let In = I;
                if (I === 0 && Rb === 0 && stage >= incTh && (Xn === 1 || sVal > muPost * 6)) In = 1;

                // 5. 資金
                const muFull = (In === 1 ? muPost : muPre) * (1 + cfg.restrictedWaste);
                const mu = (si === 1 && In === 0) ? muFull * cfg.preIncBurnMult : muFull;   // 資金がほぼ無いあいだは支出を引かない（大学の基盤）
                const rEff = r * (In === 1 ? cfg.rPostMult : 1);
                const yEff = cfg.yByStage[stage] * muPre * (In === 1 ? cfg.yPostMult : 1);
                const income = (Xn === 1 ? rhoMax * rEff : 0) + yEff;
                const base = sVal - mu + income;
                const pEq = (In === 1) ? pEqBase : 0;

                // 6. 資本自立（反復可能な稼ぎが必要支出を賄う）
                if (income >= muFull) {
                  O.indep_rev += wP;
                  if (t <= cfg.planDeadline) O.indep_in += wP; else O.indep_out += wP;
                  vAcc += wP * tail * cfg.qSelf; vIn += wP * tailIn * cfg.qSelf;
                  continue;
                }

                for (let fb = 0; fb < 3; fb++) {
                  let sn, wF;
                  if (fb === 0) { sn = base + cfg.zPub; wF = wP * pAward; }
                  else if (fb === 1) { sn = base + zEqV; wF = wP * (1 - pAward) * pEq; }
                  else { sn = base; wF = wP * (1 - pAward) * (1 - pEq); }
                  if (wF < 1e-15) continue;
                  if (sn <= 0) {
                    if (In === 0) { put(nxt, pn, grid[1], Rb, In, Xn, Nn, wF); continue; }  // 会社化前: 終端しない（最低格子に留まり、速度が落ちるだけ）
                    // 会社化後: 清算。四経路のうち②③だけが立ちうる（①用途転換は法人を畳むのでできない）
                    const ep = exitPaths(wF, stage, In, uLeft, cfg, O, tl, tlIn, mEconEq * mQuiet);
                    vAcc += ep.v; vIn += ep.vIn;
                    O.liq += ep.use; O.pivot -= ep.use;
                    continue;
                  }
                  const hLeft = sn / mu;
                  if (In === 1 && hLeft < cfg.hUnder && pAward * hLeft < 0.30) {   // R6 は会社の判断。会社化前には無い
                    const ep = exitPaths(wF, stage, In, uLeft, cfg, O, tl, tlIn, mEconEq * mQuiet);
                    vAcc += ep.v; vIn += ep.vIn;
                    if (ep.use > 1e-15 && posMarketHead >= 0) put(nxt, posMarketHead, sn, Rb, In, Xn, 0, ep.use);
                    continue;
                  }
                  put(nxt, pn, sn, Rb, In, Xn, Nn, wF);
                }
              }
            }
          }
        }
      }
    }
    const tmp = cur; cur = nxt; nxt = tmp;
  }
  let rest = 0; for (let i = 0; i < SZ; i++) rest += cur[i];
  O.cont = rest;
  vAcc += rest * TAIL[cfg.T] * 0.15; vIn += rest * TAIL_IN[cfg.T] * 0.15;

  return { outcome: O, v: vAcc, vIn, cRatio: vAcc > 0 ? 1 - vIn / vAcc : null,
           m4mass, m4mean: m4mass > 0 ? m4monthSum / m4mass : null };
}

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
//   init.burnMan … 案件ごとのバーンレート（万円／月。#2026-08-29-2）。評価日の会社化状態の側の μ を
//                差し替える。会社化前の観測が会社化後の既定を上回る場合は会社化後もその値を下限にする
function runTheta(type, reg, cfg, init) {
  const seq = gateSequence(type, reg);
  const agg = { outcome: {}, v: 0, vIn: 0, m4mass: 0, m4meanW: 0 };
  const vs = [];
  const psiMed = cfg.psiByStage[0];
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
        for (const [r, wr] of [[0, cfgL.rZeroProb], [rBase, 0.55], [rBase * cfgL.rHighMult, 0.20]]) {
          const w = wc * wp * ws * wr;
          const res = runOne(type, reg, cfgL, { c, psi, sigma, e: eVal, r }, init);
          for (const k of Object.keys(res.outcome)) agg.outcome[k] = (agg.outcome[k] || 0) + w * res.outcome[k];
          agg.v += w * res.v; agg.vIn += w * res.vIn; agg.m4mass += w * res.m4mass;
          if (res.m4mean !== null) agg.m4meanW += w * res.m4mass * res.m4mean;
          vs.push([res.v, w]);
        }
      }
    }
  }
  vs.sort((a, b) => a[0] - b[0]);
  const quant = (p) => { let acc = 0; for (const [v, w] of vs) { acc += w; if (acc >= p) return v; } return vs[vs.length - 1][0]; };
  return { seq, outcome: agg.outcome, v: agg.v, cRatio: agg.v > 0 ? 1 - agg.vIn / agg.v : null, pM4: agg.m4mass,
           m4mean: agg.m4mass > 0 ? agg.m4meanW / agg.m4mass : null,
           v10: quant(0.10), v50: quant(0.50), v90: quant(0.90) };
}

module.exports = { CFG, runOne, runTheta, gateSequence, buildPositions };

// ─────────────────────────────────────────────────────────── 実行

if (require.main === module) {
  const mode = process.argv[2] || 'degen';
  const clone = (o) => JSON.parse(JSON.stringify(o));

  if (mode === 'degen') {
    console.log('# 縮退検査 — 工程の型 × 規制属性（Tier 0 既定、天井=1 に正規化）\n');
    console.log('| 型 | 規制 | ゲート数 | M4到達 | 到達月数の平均 | 資本自立 | うちM4由来 | うち反復収入由来 | ライセンス | 知財売却 | M&A | 撤退 | 清算 | 未決着 | V(10%) | V(中央) | V(90%) | 継続価値の比率 |');
    console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
    for (const type of ['F1','F2','F3','F4']) {
      for (const reg of ['REG0','REG1','REG2']) {
        const t0 = Date.now();
        const r = runTheta(type, reg, CFG);
        const o = r.outcome;
        const pc = (x) => (100 * (x || 0)).toFixed(1) + '%';
        console.log(`| ${type} | ${reg} | ${r.seq.length} | ${pc(r.pM4)} | ${r.m4mean ? r.m4mean.toFixed(0) + 'か月' : '—'} | ${pc((o.indep_in||0)+(o.indep_out||0))} | ${pc(o.indep_m4)} | ${pc(o.indep_rev)} | ${pc(o.lic)} | ${pc(o.ips)} | ${pc(o.ma)} | ${pc(o.exit)} | ${pc(o.liq)} | ${pc(o.cont)} | ${r.v10.toFixed(3)} | ${r.v50.toFixed(3)} | ${r.v90.toFixed(3)} | ${r.cRatio!==null?pc(r.cRatio):'—'} |`);
      }
    }
  }

  if (mode === 'sens') {
    // 型ごとに振り方を変える（率型は乗数、確率型はオッズ比、期間型は乗数）
    // 全係数を同じ定義（水準の ×1.1 / ÷1.1）で振る。確率型は 0.999 で切る。
    const PROB = new Set(['alphaLoc','alphaNow','phiBase','restrictedWaste','rZeroProb','stallShare','dOther','qLic']);
    const bump = (base, k, f) => {
      // 控除率は 1 に近いので、意味を持つ量（貢献として残る割合 1-α）の側を振る
      if (k === 'alphaLoc' || k === 'alphaNow') return Math.max(0.001, 1 - (1 - base[k]) * f);
      const v = base[k] * f;
      return PROB.has(k) ? Math.min(0.999, v) : v;
    };
    const knobs = [
      ['alphaLoc', '貢献として残る割合 1-α'], ['scale', 'M_g 共通倍率'], ['phiBase', 'φ 基準採択率'],
      ['oppRate', '機会の到来率'], ['nuLic', 'ライセンス到来率'], ['betaBar', '承認の解決率'],
      ['lamComp', '競合の消失率'], ['lamDem', '需要の消失率'], ['lamObs', '陳腐化'],
      ['kSup', '機能の供給速度'], ['kEva', 'エバンジェリスト探索'], ['nuC', '受託の到来率'],
      ['nuEq', '民間調達の到来率'], ['stallShare', '滞留の分岐'], ['phiU0', 'φ_u 切片'],
      ['phiU1', 'φ_u 傾き'], ['Lu', '前倒し期間'], ['rZeroProb', '自走力ゼロの確率'],
      ['restrictedWaste', '充当できない割合'], ['dOther', '主担当でない空席'],
      ['qLic', '承継者の到達確率'], ['kIP', '専有可能性'],
    ];
    for (const [type, reg] of [['F1','REG0'],['F3','REG0'],['F1','REG2']]) {
      console.log(`\n## ${type} × ${reg}（θ は中央値の1点）\n`);
      const base = clone(CFG);
      const th = { c: 1.0, psi: base.psiByStage[0], sigma: 0, e: base.eMed, r: base.rDef[type] * (1 - base.rZeroProb) };
      const v0 = runOne(type, reg, base, th).v;
      console.log(`基準の V = ${v0.toFixed(4)}（天井の年額1円あたりの現在価値）\n`);
      console.log('| 係数 | 意味 | V(+10%) | V(−10%) | 弾力性 | 単調性 |');
      console.log('|---|---|---|---|---|---|');
      const rows = [];
      for (const [k, label] of knobs) {
        const up = clone(base); up[k] = bump(base, k, 1.1);
        const dn = clone(base); dn[k] = bump(base, k, 1 / 1.1);
        const vu = runOne(type, reg, up, th).v, vd = runOne(type, reg, dn, th).v;
        rows.push([k, label, vu, vd, ((vu - vd) / v0) / 0.2]);
      }
      rows.sort((a, b) => Math.abs(b[4]) - Math.abs(a[4]));
      for (const [k, label, vu, vd, el] of rows)
        console.log(`| ${k} | ${label} | ${vu.toFixed(4)} | ${vd.toFixed(4)} | ${el.toFixed(3)} | ${(vu - v0) * (v0 - vd) >= 0 ? '単調' : '**反転**'} |`);
      const dir = {}; for (const [k, , , , el] of rows) dir[k] = el >= 0 ? 1 : -1;
      const mkAll = (s) => { const cc = clone(base); for (const k of Object.keys(dir)) cc[k] = bump(base, k, dir[k] * s > 0 ? 1.4 : 1 / 1.4); return cc; };
      const top5 = rows.slice(0, 5).map(r => r[0]);
      const mkTop = (s) => { const cc = clone(base); for (const k of top5) cc[k] = bump(base, k, dir[k] * s > 0 ? 1.4 : 1 / 1.4); return cc; };
      console.log(`\n全係数の包絡: 悲観 ${runOne(type,reg,mkAll(-1),th).v.toFixed(4)} / 基準 ${v0.toFixed(4)} / 楽観 ${runOne(type,reg,mkAll(1),th).v.toFixed(4)}`);
      console.log(`上位5係数だけの束（報告に使う幅）: 悲観 ${runOne(type,reg,mkTop(-1),th).v.toFixed(4)} / 基準 ${v0.toFixed(4)} / 楽観 ${runOne(type,reg,mkTop(1),th).v.toFixed(4)}`);
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
    console.log('# 格子の収束検査（θ は中央値の1点。刻み＝会社化前バーンレートの 1/n）\n');
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
        out.push(`${(100*r.pM4).toFixed(1)}%`, r.m4mean ? r.m4mean.toFixed(0) : '—');
      }
      console.log(`| ${sc} | ${out.join(' | ')} |`);
    }
  }
}
