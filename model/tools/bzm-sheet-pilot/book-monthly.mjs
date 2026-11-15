// 書籍 v1.2.3 第4〜7章の「1か月の遷移」を単独で呼べる形にした部品。
// 参照実装の確率エンジンの書き直しではない。次を分けて扱う:
//   - モデルの確率（probs）: 式から計算して返す。
//   - 与えられた結果（events.outcomes）: 観測済みの出来事。明示された項目だけ反映し、未指定は「未観測」として記録する。
// ゲート表・資金額・規則の値は config / state から受け取る（グローバルな推測値は置かない）。
// 書籍が定めていない選択肢は missing / unsupported に記録し、黙って補わない。
//
// 公開API:
//   stepBookMonth(state, config, events) -> { state, probs, log, missing, unobserved, terminated }
//   replayObserved(state, config, eventsByMonth) -> { state, months[] }
//   openingState({...}) / advanceProbability / etaFor / awardProbability / offerRates / contractArrivalRate
//   lossMonthlyRate / selfSufficient12 / additionalFundingParams / contractNet / textbookCases / BOOK_MONTHLY_EXAMPLES
//
// 対応範囲（§7.1.1 の7手順）:
//   1 確定期限（使途限定資金の失効 ℓ、期限月の機会の除去）
//   2 消失（結果が与えられた場合のみ反映）
//   3 前進（準備期間→確率判定、受託の (1-γρ)、会社化前の資金なし停止）、応募（資格を署名付きで明示したものだけ）、
//     オファー到来、受託の引き合い
//   4 R2（直前までの不成立回数）、R3、R4、R5、R7
//   5 資金更新（式2.5。自由資金と使途限定資金を別帳簿、収入の二重計上を検査）
//   6 初回自走（12か月）、R6、追加調達（§7.3.7）、4つの分岐の選択肢の提示
//   7 履歴更新（不成立回数、応募の不成立、月の進行）
// 未対応（unsupported として記録）: 参照実装の確率的な受託契約の満了、滞留の自動不成立の繰り返し加算（最初の1回だけ、g.stagnationThreshold を与えたときに対応。閾値は stagnationThreshold() で計算）、
//   株式出資の到来を含む確率標本抽出、分岐後の価値計算（第8章）、初回自走後の元用途の追跡。

export const BOOK_VERSION = 'v1.2.3';

// ---- 書籍の既定値（config で上書きできる。出典の章節を併記） ----
export const BOOK_D_TABLE = { // §5.3 機能が空席のときの前進率の低下
  T1: { 2: 1.0 }, T2: { 2: 1.0 }, T3: { 2: 1.0 },
  T4prep: { 6: 0.25, 2: 0.35 }, T4trial: { 6: 0.30, 2: 0.35 },
  M2: { 3: 0.30, 1: 0.35 }, M3: { 3: 0.30, 6: 0.25 }, M4: { 6: 0.30, 4: 0.20 },
  other: 0.05,
};
export const MG_AWARD = [0.60, 0.85, 1.00, 1.15, 1.35, 1.35, 1.35]; // §6.1 段階0..6
export const MSIGMA_AWARD = { headwind: 0.61, neutral: 1.00, tail: 1.65 };
export const D_PHI = { 1: 0.30, 5: 0.25 }; // §5.5 採択
export const D_NU = { 1: 0.35, 6: 0.15 }; // §5.5 オファー
export const MG_OFFER = [0.20, 0.35, 0.50, 1.00, 1.60, 2.20, 2.50];
export const MSIGMA_OFFER = { headwind: 0.67, neutral: 1.00, tail: 1.49 };
export const OFFER_BASE_REG0 = { license: 0.0030, ipSale: 0.0010, acquisition: 0.0004 };
export const MG_CONTRACT = [0.5, 0.5, 0.8, 0.8, 1.3, 1.3, 1.3]; // §6.6.1
export const MSIGMA_CONTRACT = { headwind: 0.74, neutral: 1.00, tail: 1.35 };
export const R_REF = 69.3;
export const DEFAULT_RULES = { // §7.4.1 の基本設定
  kPivot: 2, kExit: 3, markup: 1.15, hUnder: 6, hInc: 12,
  rhoMax: 0.3, floorFraction: 0.1, applications: 1,
  additional: { pFilled: 0.40, dPhi5: 0.25, months: 12, maxAttempts: 2 },
};
const EXP = Math.exp;
const round6 = (x) => Math.round(x * 1e6) / 1e6;

// ---- 確率・率の関数（式を評価するだけ。結果の抽選はしない） ----

/** §4.2 ゲートの準備期間と待ち。M_g<=2 は確率的な待ちなし。 */
export function gateTimes(M) {
  const Mmin = Math.round(0.40 * M); // 28 -> 11
  const Mres = M - Mmin;
  return { M, Mmin, Mres, kappa: M <= 2 ? null : 1 / Mres, stochastic: M > 2 };
}

/** §4.1 式(4.1) p = 1 - exp(-κ ψ c η (1-γρ))。M_g<=2 は準備後に確率1。 */
export function advanceProbability({ M, psi = 1, c = 1, eta = 1, gamma = 0, rho = 0, rateZero = false }) {
  const t = gateTimes(M);
  if (!t.stochastic) return rateZero ? 0 : 1;
  if (rateZero) return 0;
  return 1 - EXP(-t.kappa * psi * c * eta * (1 - gamma * rho));
}

/**
 * §7.3.3 滞留の 85% 点（率が一定のとき）。準備 Mmin か月のあと、月の確率 p で
 * 1-(1-p)^n >= quantile となる最小の n を判定回数とする。months = 準備 + n（ゲート開始から）。
 * elapsedInGate を渡すと、評価日からの月数 monthsFromNow = months - elapsedInGate も返す。
 */
export function stagnationThreshold({ M, psi = 1, c = 1, eta = 1, gamma = 0, rho = 0, quantile = 0.85, elapsedInGate = 0 }) {
  const prep = gateTimes(M).Mmin;
  const p = advanceProbability({ M, psi, c, eta, gamma, rho });
  const judgements = p >= 1 ? 1 : Math.ceil(Math.log(1 - quantile) / Math.log(1 - p));
  const months = prep + judgements;
  return { prep, p, judgements, months, monthsFromNow: months - elapsedInGate };
}

/** §5.3 η = 空席の機能 f の (1-d_f,g) の積。機能7（会社側）は会社化前は除外。 */
export function etaFor({ etaKey, vacant = [], incorporated = false, dTable = BOOK_D_TABLE }) {
  const row = dTable[etaKey] || {};
  let eta = 1;
  for (const f of vacant) {
    if (f === 7 && !incorporated) continue;
    eta *= 1 - (row[f] ?? dTable.other);
  }
  return eta;
}

/** §6.1 mθ = clip((ΣP/300)^β ・(1+βm・1[∃u m_u>0])/(1+βm), 0.4, 2.5) */
export function momentumMultiplier({ sumP, beta = 0.25, betaM = 0.40, hasMomentum = false }) {
  const v = (sumP / 300) ** beta * (1 + betaM * (hasMomentum ? 1 : 0)) / (1 + betaM);
  return Math.min(2.5, Math.max(0.4, v));
}

/** §6.1 φ = 1-(1-0.28)^M, M = mσ・mg・mφη・mθ。vacant は空席の機能番号。 */
export function awardProbability({ stage, sigma = 'neutral', vacant = [], sumP, hasMomentum = false, base = 0.28 }) {
  const mphi = Object.entries(D_PHI).reduce((a, [f, d]) => a * (vacant.includes(Number(f)) ? 1 - d : 1), 1);
  const M = MSIGMA_AWARD[sigma] * MG_AWARD[stage] * mphi * momentumMultiplier({ sumP, hasMomentum });
  return 1 - (1 - base) ** M;
}
export function awardProbabilityFromM(M, base = 0.28) { return 1 - (1 - base) ** M; }

/** §6.2.3 月に機会が現れる近似。応募は最大1件。 */
export function monthlyAwardApprox({ phi, opportunityRate }) { return phi * (1 - EXP(-opportunityRate)); }

/** §6.5.4 m_q の線形補間（無風期間の月数）: 0→1.0, 12→0.5, 24→0.1, 36以上→0.05 */
export function quietMultiplier(months) {
  const pts = [[0, 1.0], [12, 0.5], [24, 0.1], [36, 0.05]];
  if (months >= 36) return 0.05;
  for (let i = 0; i < pts.length - 1; i++) {
    const [a, va] = pts[i], [b, vb] = pts[i + 1];
    if (months <= b) return va + (vb - va) * (months - a) / (b - a);
  }
  return 0.05;
}

/** §6.5 ν_k = base・(0.4+1.2κIP)・mg・mσ・mν_η・m_q（発生率）と、月の確率 1-exp(-ν) */
export function offerRates({ stage, sigma = 'neutral', kappaIP, vacant = [], quietMonths, incorporated = false, base = OFFER_BASE_REG0 }) {
  const mnu = Object.entries(D_NU).reduce((a, [f, d]) => a * (vacant.includes(Number(f)) ? 1 - d : 1), 1);
  const common = (0.4 + 1.2 * kappaIP) * MG_OFFER[stage] * MSIGMA_OFFER[sigma] * mnu * quietMultiplier(quietMonths);
  const rate = {
    license: base.license * common,
    ipSale: base.ipSale * common,
    acquisition: incorporated ? base.acquisition * common : 0, // 会社化前は0
  };
  const prob = Object.fromEntries(Object.entries(rate).map(([k, v]) => [k, 1 - EXP(-v)]));
  return { rate, prob };
}

/** §6.6.1 式(6.7) 受託の引き合い ν_c = 0.05 (r/rref)^½ mσ mg */
export function contractArrivalRate({ r, stage, sigma = 'neutral' }) {
  return 0.05 * Math.sqrt(r / R_REF) * MSIGMA_CONTRACT[sigma] * MG_CONTRACT[stage];
}

/** §7.1.2 消失 λ = 競合 + 需要側 + 技術の目利き（年率）。月の率は λ/12、月の確率は 1-exp(-λ/12) */
export function lossMonthlyRate({ comp, dem, core }) {
  const lambda = comp + dem + core;
  return { lambda, monthlyRate: lambda / 12, monthlyProb: 1 - EXP(-lambda / 12) };
}

/** §6.6.4 契約の月次の純額。大学経由は直接費控除後に間接経費率を引く。 */
export function contractNet(c) {
  if (c.net != null) return c.net;
  const afterDirect = c.gross - (c.directCost ?? 0);
  const indirect = c.university ? afterDirect * (c.indirectRate ?? 0) : 0;
  return afterDirect - indirect;
}

/** §7.3.7 追加調達の値。機能5が空席なら p は 0.40×(1-dφ5)=0.30 */
export function additionalFundingParams({ f5Vacant, rules = DEFAULT_RULES }) {
  const a = rules.additional;
  return { p: f5Vacant ? a.pFilled * (1 - a.dPhi5) : a.pFilled, months: a.months, maxAttempts: a.maxAttempts };
}

/**
 * §7.1.1 手順6 / §2.4.5 12か月の自走判定。
 * k=1..months の各月で 収入(k) + 受託の稼ぎ(k, 残り契約月内のみ) - (固定支出 + 購入費(k)) >= 0 を確認する。
 * revenue / purchases は稼働度を掛けた後の月額（関数 k=>number）。
 */
export function selfSufficient12({ months = 12, spend, revenue = () => 0, purchases = () => 0, contractEarn = 0, contractRemaining = 0 }) {
  const margins = [];
  for (let k = 1; k <= months; k++) {
    const earn = k <= contractRemaining ? contractEarn : 0;
    margins.push(revenue(k) + earn - (spend + purchases(k)));
  }
  const shortfallMonths = margins.map((m, i) => (m < 0 ? i + 1 : null)).filter(Boolean);
  return { ok: shortfallMonths.length === 0, margins, shortfallMonths };
}

// ---- 開始状態 ----

/** 評価日の開始状態。elapsedInGate は現ゲートに入ってからの経過月（準備残 = M_min - 経過、下限0）。 */
export function openingState({ gates, gateIdx = 0, elapsedInGate = 0, sr = 0, sf = 0, stage = 0, incorporated = false,
  projectFunded = true, vacant = [], contract = null, openItems = 0, opportunities = [], passedGates = [] }) {
  const g = gates[gateIdx];
  return {
    month: 0, gateIdx, gateElapsed: elapsedInGate, autoStagnation: {}, prepRemaining: g ? Math.max(0, gateTimes(g.M).Mmin - elapsedInGate) : 0,
    sr, sf, stage, incorporated, projectFunded, vacant, contract, openItems, opportunities, passedGates,
    firstSelfSuffMonth: null, failures: {}, pivotConsidered: {}, additionalAttempts: 0,
    receivables: [], seenReceiptIds: [], awardFailures: 0, terminated: null,
  };
}

const clone = (o) => structuredClone(o);

function branchOptions(s, config) {
  const b = config.branches || {};
  const opts = ['return_to_research'];
  if (s.stage >= (b.licenseMinStage ?? 3)) opts.push('license_switch');
  if (s.incorporated && s.stage >= (b.acquisitionMinStage ?? 4)) opts.push('acquisition_handover');
  if (b.pivotCandidates > 0) opts.push('pivot'); // 未着手の用途が入力にあるときだけ
  return opts;
}

/**
 * 1か月の遷移。state は直前月末の状態（month=最後に処理した月）。処理するのは month+1。
 * events: {
 *   restrictedExpiry?: number,            // 手順1 の失効額 ℓ（明示値）
 *   outcomes?: {                          // 与えられた結果。未指定は未観測（起きなかったとは断定しない）
 *     loss?: boolean,
 *     advance?: 'pass'|'fail',
 *     registryFailure?: boolean,          // 登録簿に記録された不成立（確率判定とは別）
 *     award?: { id, won, amount?, schedule?: [{month, amount}], ledger?: 'restricted'|'free' },
 *     offer?: 'license'|'ipSale'|'acquisition',
 *     contract?: { gross|net, directCost?, indirectRate?, university?, ledger, rho, gamma?, remainingMonths?, countedIn? },
 *     foundingEquity?: number,            // 会社化と同月、支払い前に自由資金へ入る
 *     equity?: number,                    // 会社化の判定後に有効
 *     additionalFunding?: boolean,
 *   },
 *   demandReady?: boolean,                // R3 の需要側条件（入力で与える。config.r3.requiredGateId があれば通過履歴からも判定）
 *   contractAfterIncorporation?: {...},   // 会社化月に結び直す契約
 *   receipts?: [{ id, amount, ledger }],  // その他の入金。id の重複は二重計上として拒否
 * }
 * config: { gates, spending:{preInc,postInc,postIncResearch}, rules?, loss?, preProdSales?, salesLedger?, recurring?, award?, offers?, contractArrival?, r3?, r4?, branches? }
 */
export function stepBookMonth(state, config, events = {}) {
  const s = clone(state);
  const rules = { ...DEFAULT_RULES, ...(config.rules || {}) };
  const out = events.outcomes || {};
  const log = [], missing = [], unobserved = [], probs = {};
  if (s.terminated) return { state: s, probs, log: ['終端済み'], missing, unobserved, terminated: s.terminated };
  const t = s.month + 1;
  const inc0 = s.incorporated, stage0 = s.stage, contract0 = s.contract;
  const bal0 = { sf: s.sf, sr: s.sr };
  const spendPre = config.spending.preInc, spendPost = config.spending.postInc;
  const needMonthly = (inc0 ? spendPost : spendPre) * rules.markup;
  const obs = (name, v) => { if (v === undefined) unobserved.push(name); return v; };

  // 手順1: 確定期限
  const ell = events.restrictedExpiry || 0;
  if (ell) { s.sr -= ell; log.push(`1: 失効 ${ell}`); }
  s.opportunities = (s.opportunities || []).filter((o) => !(o.deadlineMonth != null && o.deadlineMonth <= t));

  // 手順2: 消失
  if (config.loss) probs.loss = lossMonthlyRate(config.loss).monthlyProb;
  if (obs('loss', out.loss) === true) {
    s.month = t; s.terminated = { reason: 'loss', month: t };
    return { state: s, probs, log: [...log, '2: 消失'], missing, unobserved, terminated: s.terminated };
  }

  // 手順3: 確率過程（月初状態で判定）
  const g = config.gates[s.gateIdx];
  let advanced = false, failureObserved = false;
  if (g) {
    const contractFunds = !!contract0 && (contract0.countedIn ?? 'c') !== 'none';
    const rateZero = !inc0 && g.gated && !contractFunds && !s.projectFunded;
    if (s.prepRemaining > 0) {
      s.prepRemaining -= 1;
      log.push(`3: ${g.id} 準備中（残 ${s.prepRemaining}）`);
    } else {
      const eta = etaFor({ etaKey: g.etaKey || g.id, vacant: s.vacant, incorporated: inc0, dTable: config.dTable });
      probs.advance = advanceProbability({
        M: g.M, psi: g.psi ?? 1, c: config.c ?? 1, eta, rateZero,
        gamma: contract0 ? contract0.gamma ?? 0 : 0, rho: contract0 ? contract0.rho ?? 0 : 0,
      });
      probs.eta = eta;
      const o = obs('advance', out.advance);
      if (o === 'pass') advanced = true;
      if (o === 'fail') failureObserved = true;
    }
  }
  if (out.registryFailure === true) failureObserved = true;

  // §6.7 / §7.1.1: 手順3で通知された権利の確認は、手順4の R3・R4 より前に未了件数を減らす。
  // out.rightsResolved は確認済みの件数（または重複を除いた ID の配列）。未指定なら変えない。
  if (out.rightsResolved !== undefined) {
    const req = Array.isArray(out.rightsResolved) ? new Set(out.rightsResolved).size : Number(out.rightsResolved);
    if (!Number.isFinite(req) || req < 0) missing.push('rightsResolved が不正');
    else {
      const n = Math.min(req, s.openItems);
      if (req > s.openItems) missing.push(`確認済み権利 ${req} 件が未了 ${s.openItems} 件を超過（未了分だけ反映）`);
      s.openItems -= n;
      log.push(`3: 権利確認 ${n} 件（未了 ${s.openItems}）`);
    }
  }

  // 応募（R7）。資格が署名つきで明示されたものだけ、上限件数まで
  const apps = [];
  for (const o of s.opportunities) {
    const e = o.eligibility;
    if (!e || e.confirmed !== true) { missing.push(`応募資格が未確認: ${o.id}`); continue; }
    if (apps.length < rules.applications) apps.push(o);
  }
  if (apps.length && config.award) {
    probs.award = awardProbability({ stage: stage0, sigma: config.award.sigma, vacant: s.vacant, sumP: config.award.sumP, hasMomentum: config.award.hasMomentum });
    probs.awardApplication = apps.map((a) => a.id);
  }
  // オファー到来・受託の引き合い（確率のみ。結果は outcomes）
  if (config.offers) probs.offer = offerRates({ stage: stage0, vacant: s.vacant, incorporated: inc0, ...config.offers }).prob;
  if (config.contractArrival) probs.contract = 1 - EXP(-contractArrivalRate({ stage: stage0, ...config.contractArrival }));

  // 手順4: 規則（R2 は直前までの不成立回数だけ）
  let branchTrigger = null;
  if (g) {
    const n = s.failures[g.id] || 0;
    probs.failuresBefore = n;
    if (n >= rules.kExit) branchTrigger = 'R2';
    else if (n >= rules.kPivot && !s.pivotConsidered[g.id]) { s.pivotConsidered[g.id] = true; probs.pivotReview = true; log.push(`4: R2 用途変更の検討（${g.id} 不成立 ${n}回）`); }
  }
  if (advanced) {
    s.passedGates = [...(s.passedGates || []), g.id];
    s.stage = g.stage; s.gateIdx += 1; s.gateElapsed = -1; // 手順7で +1 され、新ゲートの経過は0から
    const ng = config.gates[s.gateIdx];
    s.prepRemaining = ng ? gateTimes(ng.M).Mmin : 0; // 通過月は次ゲートの準備に数えない
    log.push(`3: ${g.id} 通過 → 段階 ${s.stage}`);
  }
  // R3 会社化
  const r3 = config.r3 || {};
  let incorporatedNow = false;
  if (!inc0 && r3) {
    const demand = events.demandReady ?? (r3.requiredGateId ? (s.passedGates || []).includes(r3.requiredGateId) : undefined);
    if (demand === undefined) missing.push('R3 需要側条件が未指定');
    const founding = out.foundingEquity || 0;
    const need = (rules.hInc) * spendPost * rules.markup;
    const bal = bal0.sf + founding; // 自由資金のみ（使途限定資金は会社の支払いに充てない）
    if (demand && s.openItems === 0 && bal >= need) {
      incorporatedNow = true; s.incorporated = true;
      s.sf += founding; // 支払い前に入金
      if (events.contractAfterIncorporation) s.contract = clone(events.contractAfterIncorporation);
      log.push(`4: R3 会社化（${bal} >= ${need}）`);
    } else if (demand) log.push(`4: R3 未成立（残高 ${bal}, 必要 ${need}, 残件 ${s.openItems}）`);
  }
  // 会社化の判定後に有効な出資
  if (s.incorporated && out.equity) s.sf += out.equity;
  // R4 オファーの受諾（ライセンス→知財売却→買収。買収は月初に会社化済み）
  const r4 = config.r4 || {};
  if (out.offer && r4.gStar != null && stage0 >= r4.gStar && s.openItems === 0) {
    const order = ['license', 'ipSale', 'acquisition'];
    if (order.includes(out.offer) && (out.offer !== 'acquisition' || inc0)) {
      s.month = t; s.terminated = { reason: 'offer', kind: out.offer, month: t };
      return { state: s, probs, log: [...log, `4: R4 ${out.offer} 受諾`], missing, unobserved, terminated: s.terminated };
    }
    missing.push(`オファー ${out.offer} は受諾条件を満たさない`);
  } else if (out.offer) log.push('4: R4 検討開始前または残件ありのためオファー不受諾');
  // R5 受託の開始（次月から収入。月初の会社化状態で下限を判定）
  if (out.contract) {
    const c = out.contract;
    const floor = rules.floorFraction * (inc0 ? spendPost : spendPre);
    const amount = c.gross ?? c.net;
    const okR5 = amount >= floor && (c.rho ?? 0) <= (config.rhoMax ?? rules.rhoMax);
    if (okR5) { s.contractPending = clone(c); log.push('4: R5 受託を受諾（次月から）'); } else log.push(`4: R5 受託を不受諾（${amount} / 下限 ${floor}）`);
  }
  // 応募の結果（採択ならば入金予定へ。資格の上限を超える額は拒否）
  let awardLost = false;
  if (out.award) {
    const a = out.award;
    const app = apps.find((x) => x.id === a.id);
    if (!app) missing.push(`応募していない機会の結果: ${a.id}`);
    else if (a.won === false) awardLost = true;
    else if (a.won === true) {
      const lim = app.eligibility.maxAmount;
      if (lim != null && a.amount > lim) missing.push(`採択額が資格の上限を超過: ${a.id}`);
      else if (!a.schedule) missing.push(`入金日程が未指定: ${a.id}`);
      else for (const p of a.schedule) s.receivables.push({ month: p.month, amount: p.amount, ledger: a.ledger || 'restricted' });
    }
  } else if (apps.length) unobserved.push('award');

  // 手順5: 資金更新（式2.5）。自由・使途限定を別帳簿のまま扱う
  const add = { sf: 0, sr: 0 };
  const credit = (ledger, amt) => { add[ledger === 'restricted' ? 'sr' : 'sf'] += amt; };
  const cNow = incorporatedNow ? s.contract : contract0;
  if (cNow && (cNow.countedIn ?? 'c') === 'c') credit(cNow.ledger || 'free', contractNet(cNow));
  const salesStage = s.stage; // ゲート判定と会社化の後の段階・状態を使う
  const sales = config.preProdSales ? config.preProdSales[salesStage]?.[s.incorporated ? 'post' : 'pre'] ?? 0 : 0;
  if (sales && s.gateIdx < (config.productionGateIdx ?? Infinity)) credit(config.salesLedger || 'free', sales);
  const due = s.receivables.filter((r) => r.month === t);
  s.receivables = s.receivables.filter((r) => r.month !== t);
  for (const r of due) credit(r.ledger, r.amount);
  for (const r of events.receipts || []) {
    if (s.seenReceiptIds.includes(r.id)) { missing.push(`入金IDの重複（二重計上を拒否）: ${r.id}`); continue; }
    s.seenReceiptIds.push(r.id); credit(r.ledger, r.amount);
  }
  // 支出: 使途限定資金で賄える研究の支出を先に割り付け、不足を自由資金へ
  let muR = 0, muF = 0;
  if (!s.incorporated) {
    const spend = s.projectFunded ? spendPre : 0;
    muR = Math.min(spend, Math.max(0, s.sr)); muF = spend - muR;
  } else {
    const research = config.spending.postIncResearch ?? 0;
    muR = Math.min(research, Math.max(0, s.sr)); muF = (research - muR) + (spendPost - research);
  }
  s.sr = s.sr - muR + add.sr;
  s.sf = s.sf - muF + add.sf;
  s.sr = round6(s.sr); s.sf = round6(s.sf);
  log.push(`5: 支出 使途限定 ${muR} / 自由 ${muF}、収入 使途限定 ${round6(add.sr)} / 自由 ${round6(add.sf)}`);

  // 受託契約の更新（開始は次月、残り月の減算と満了）
  if (s.contract && s.contract.remainingMonths != null) {
    s.contract.remainingMonths -= 1;
    if (s.contract.remainingMonths <= 0) s.contract = null;
  }
  if (s.contractPending) { s.contract = s.contractPending; delete s.contractPending; }

  // 手順6: 初回自走・R6・追加調達・4つの分岐
  let selfSuff = null;
  if (config.recurring) {
    const rc = config.recurring(s);
    selfSuff = selfSufficient12(rc);
    probs.selfSufficient12 = selfSuff.ok;
  }
  let branch = branchTrigger;
  if (s.incorporated && s.firstSelfSuffMonth == null) {
    if (selfSuff?.ok) { s.firstSelfSuffMonth = t; log.push('6: 初回自走を記録'); }
    else {
      const need6 = rules.hUnder * spendPost * rules.markup;
      const funded = s.sf > 0 && s.sf >= need6;
      if (!funded) {
        const f5Vacant = s.vacant.includes(5);
        const ap = additionalFundingParams({ f5Vacant, rules });
        probs.additionalFunding = ap.p;
        if (s.additionalAttempts < ap.maxAttempts) {
          s.additionalAttempts += 1;
          const r = obs('additionalFunding', out.additionalFunding);
          if (r === true) { s.sf = round6(s.sf + ap.months * spendPost * rules.markup); log.push('6: 追加調達が成立'); }
          else branch = branch || 'funds';
        } else branch = branch || 'funds';
      }
    }
  }
  if (branch) {
    s.terminated = { reason: 'branch', trigger: branch, month: t, options: branchOptions(s, config) };
    log.push(`6: 4つの分岐へ（${branch}）。選べる行き先: ${s.terminated.options.join(', ')}`);
  }

  // 手順7: 履歴更新
  if (g) s.gateElapsed = (s.gateElapsed ?? 0) + 1;
  if (g && failureObserved) s.failures[g.id] = (s.failures[g.id] || 0) + 1;
  // §7.3.3 滞留: g.stagnationThreshold（ゲート開始からの月数）を与えたときだけ、経過が閾値を超えた月に
  // そのゲートの不成立を1回だけ加える（R2 は翌月の手順4で見る）。繰り返しの加算は書籍に規則がなく行わない。
  // 未観測（outcomes.advance 未指定）は不成立ではなく、この自動加算とも別に扱う。
  if (g && !advanced && g.stagnationThreshold != null && s.gateElapsed > g.stagnationThreshold && !s.autoStagnation[g.id]) {
    s.autoStagnation[g.id] = t;
    s.failures[g.id] = (s.failures[g.id] || 0) + 1;
    log.push(`7: ${g.id} 滞留が閾値 ${g.stagnationThreshold} か月を超過、不成立を1回加算`);
  }
  if (awardLost) s.awardFailures += 1;
  s.month = t;
  return { state: s, probs, log, missing, unobserved, terminated: s.terminated };
}

/** 観測結果の再生。eventsByMonth[t] が月 t の events。 */
export function replayObserved(state, config, eventsByMonth) {
  const months = []; let cur = state;
  const last = Math.max(...Object.keys(eventsByMonth).map(Number));
  for (let t = state.month + 1; t <= last && !cur.terminated; t++) {
    const r = stepBookMonth(cur, config, eventsByMonth[t] || {});
    months.push({ month: t, ...r }); cur = r.state;
  }
  return { state: cur, months };
}

// ---- 書籍の数値例（印刷値は書籍本文から転記。実装の出力は run() が計算する） ----
const T3_GATE = { M: 28, psi: 0.8 };
const OBSERVED_VACANT = [3, 4, 5, 6]; // §5.3.5 / §7.2 の観測された空席（機能1・2は充足、機能7は会社化前で除外）
const sc1Config = () => ({
  gates: [
    { id: 'T3', M: 28, stage: 3, psi: 0.8, gated: true },
    { id: 'M2', M: 15, stage: 4, psi: 1, gated: true }, // §4.9 表: M2 F1 の標準 M=15（準備 6）
  ],
  spending: { preInc: 150, postInc: 450, postIncResearch: 150 },
  preProdSales: { 3: { pre: 15, post: 30 }, 4: { pre: 52.5, post: 105 } }, // 段階0〜2の売上は本文にない（未指定は0扱い）
  r3: { requiredGateId: 'M2' }, r4: { gStar: 3 },
});

export function textbookCases() { return BOOK_MONTHLY_EXAMPLES; }

export const BOOK_MONTHLY_EXAMPLES = [
  {
    id: 'ex4.1', section: '§4.1', label: 'T3 F1×REG-0 の月の前進確率',
    run() {
      const t = gateTimes(28);
      const p = (o) => advanceProbability({ M: 28, ...o });
      return {
        Mmin: t.Mmin, Mres: t.Mres,
        pPsi1: p({ psi: 1 }), pPsi08: p({ psi: 0.8 }),
        pEta: p({ psi: 0.8, eta: 0.95 ** 4 }),
        pHalf: p({ psi: 0.8, gamma: 0.5, rho: 0.2 }), pFull: p({ psi: 0.8, gamma: 1, rho: 0.2 }),
      };
    },
    expect: [
      { key: 'Mmin', printed: 11, tol: 0 }, { key: 'Mres', printed: 17, tol: 0 },
      { key: 'pPsi1', printed: 0.057, tol: 0.0006 }, { key: 'pPsi08', printed: 0.046, tol: 0.0006 },
      { key: 'pEta', printed: 0.038, tol: 0.0006 }, { key: 'pHalf', printed: 0.041, tol: 0.0006 },
      { key: 'pFull', printed: 0.037, tol: 0.0006 },
    ],
  },
  {
    id: 'ex4.3', section: '§4.3', label: '評価日がT3の5か月目: 準備残6、判定は7か月目から、累積確率',
    run() {
      const gates = [{ id: 'T3', M: 28, stage: 3, psi: 0.8, gated: true }];
      const st = openingState({ gates, elapsedInGate: 5, stage: 2 });
      const cum = (eta, n) => 1 - (1 - advanceProbability({ M: 28, psi: 0.8, eta })) ** n;
      return { prepRemaining: st.prepRemaining, firstJudgment: st.prepRemaining + 1,
        cum8: cum(1, 2), cum24: cum(1, 18), cum24eta: cum(0.95 ** 4, 18) };
    },
    expect: [
      { key: 'prepRemaining', printed: 6, tol: 0 }, { key: 'firstJudgment', printed: 7, tol: 0 },
      { key: 'cum8', printed: 0.09, tol: 0.005 }, { key: 'cum24', printed: 0.57, tol: 0.005 }, { key: 'cum24eta', printed: 0.50, tol: 0.005 },
    ],
  },
  {
    id: 'ex5.3', section: '§5.3', label: 'ゲート別の η（空席の機能の数から）',
    // §5.3.5: 六つのゲートすべてで空席は機能 3・4・5・6（機能 1・2 は充足、機能 7 は会社化前のため除外）。
    run() {
      const v = OBSERVED_VACANT;
      const e = (etaKey) => etaFor({ etaKey, vacant: v });
      return { T3: e('T3'), M2: e('M2'), M3: e('M3'), M4: e('M4'), T4prep: e('T4prep'), T4trial: e('T4trial') };
    },
    expect: [
      { key: 'T3', printed: 0.815, tol: 0.001 }, { key: 'M2', printed: 0.600, tol: 0.001 },
      { key: 'M3', printed: 0.474, tol: 0.001 }, { key: 'M4', printed: 0.505, tol: 0.001 },
      { key: 'T4prep', printed: 0.643, tol: 0.001 }, { key: 'T4trial', printed: 0.600, tol: 0.001 },
    ],
  },
  {
    id: 'ex6.1', section: '§6.1', label: '採択確率（段階1・2、機能1・5の充足）',
    run() {
      const a = (stage, vacant) => awardProbability({ stage, vacant, sumP: 70, hasMomentum: true });
      return {
        s1Both: a(1, [1, 5]), s2Both: a(2, [1, 5]), s2f5: a(2, [5]), s2Filled: a(2, []),
        ex63: awardProbabilityFromM(0.315), monthly: monthlyAwardApprox({ phi: 0.28, opportunityRate: 0.5 }),
      };
    },
    expect: [
      { key: 's1Both', printed: 0.09686721, tol: 1e-6 }, { key: 's2Both', printed: 0.11296028, tol: 1e-6 },
      { key: 's2f5', printed: 0.15737769, tol: 1e-6 }, { key: 's2Filled', printed: 0.20412669, tol: 1e-6 },
      { key: 'ex63', printed: 0.09830484, tol: 1e-6 }, { key: 'monthly', printed: 0.11017142, tol: 1e-6 },
    ],
  },
  {
    id: 'ex6.4', section: '§6.4', label: 'ライセンスのオファー（段階2と、シナリオ2の段階5）',
    run() {
      const s2 = offerRates({ stage: 2, kappaIP: 0.5, vacant: [6], quietMonths: 3 }); // 機能1は充足、機能6（対外交渉と契約）は空席
      const s5 = offerRates({ stage: 5, kappaIP: 0.5, vacant: [], quietMonths: 3, incorporated: true });
      return { mq: quietMultiplier(3), s2License: s2.rate.license, s2Prob: s2.prob.license, s2Acq: s2.rate.acquisition,
        s5License: s5.rate.license, s5Acq: s5.rate.acquisition };
    },
    expect: [
      { key: 'mq', printed: 0.875, tol: 1e-9 }, { key: 's2License', printed: 0.00112, tol: 0.00001 },
      { key: 's2Prob', printed: 0.0011, tol: 0.0001 }, { key: 's2Acq', printed: 0, tol: 0 },
      { key: 's5License', printed: 0.005775, tol: 1e-6 }, { key: 's5Acq', printed: 0.00077, tol: 1e-6 },
    ],
  },
  {
    id: 'ex6.6', section: '§6.6', label: '共同研究の純額と受託の引き合い',
    run() {
      return {
        net: contractNet({ gross: 60, directCost: 48, indirectRate: 0.30, university: true }),
        nu: contractArrivalRate({ r: 60, stage: 2 }), nuHigh: contractArrivalRate({ r: 150, stage: 2 }),
        factorSource: 1 - 0 * 0.2,
      };
    },
    expect: [
      { key: 'net', printed: 8.4, tol: 1e-9 }, { key: 'nu', printed: 0.037, tol: 0.0005 },
      { key: 'nuHigh', printed: 0.059, tol: 0.0005 },
    ],
  },
  {
    id: 'ex7.1', section: '§7.1.2', label: '消失の月率（年5.80%）',
    run: () => lossMonthlyRate({ comp: 0.058, dem: 0, core: 0 }),
    expect: [{ key: 'monthlyRate', printed: 0.00483, tol: 0.000005 }],
  },
  {
    id: 'ex7.2', section: '§7.1.4/§2.4.5', label: '評価日の翌月（1か月目）: 使途限定 2558.4、自由 0',
    run() {
      const cfg = { ...sc1Config(), rules: {}, award: { sigma: 'neutral', sumP: 70, hasMomentum: true },
        offers: { kappaIP: 0.5, quietMonths: 3 }, contractArrival: { r: 60 },
        recurring: () => ({ spend: 450, revenue: () => 0, purchases: () => 0, contractEarn: 8.4, contractRemaining: 12 }) };
      const contract = { gross: 60, directCost: 48, indirectRate: 0.3, university: true, ledger: 'restricted', rho: 0.2, gamma: 0 };
      const st = openingState({ gates: cfg.gates, elapsedInGate: 5, sr: 2700, sf: 0, stage: 2, vacant: OBSERVED_VACANT,
        contract, openItems: 2,
        opportunities: [{ id: 'A', eligibility: { confirmed: true, signedBy: '評価者' } }] });
      const r = stepBookMonth(st, cfg, { outcomes: { award: { id: 'A', won: false } } });
      return { sr: r.state.sr, sf: r.state.sf, prepRemaining: r.state.prepRemaining, incorporated: r.state.incorporated ? 1 : 0,
        terminated: r.terminated ? 1 : 0, awardFailures: r.state.awardFailures, selfSuff: r.probs.selfSufficient12 ? 1 : 0,
        award: r.probs.award,
        contractProb: r.probs.contract, offerLicense: r.probs.offer.license };
    },
    expect: [
      { key: 'sr', printed: 2558.4, tol: 1e-6 }, { key: 'sf', printed: 0, tol: 1e-9 },
      { key: 'prepRemaining', printed: 5, tol: 0 }, { key: 'incorporated', printed: 0, tol: 0 }, { key: 'terminated', printed: 0, tol: 0 },
      { key: 'awardFailures', printed: 1, tol: 0 }, { key: 'award', printed: 0.157378, tol: 1e-6 },
      { key: 'selfSuff', printed: 0, tol: 0 }, { key: 'contractProb', printed: 0.037, tol: 0.001 },
      { key: 'offerLicense', printed: 0.0011, tol: 0.0001 },
    ],
  },
  {
    id: 'ex7.3', section: '§7.3.3', label: 'T3 の滞留 85% 点: 開始から61か月、評価日（経過5）から56か月',
    run() {
      const eta = 0.95 ** 4; // §5.3.5 の T3 の η（空席 3・4・5・6）
      const a = stagnationThreshold({ M: 28, psi: 0.8, eta });
      const b = stagnationThreshold({ M: 28, psi: 0.8, eta, elapsedInGate: 5 });
      return { fromStart: a.months, fromEval: b.monthsFromNow, prep: a.prep, judgements: a.judgements };
    },
    expect: [
      { key: 'fromStart', printed: 61, tol: 0 }, { key: 'fromEval', printed: 56, tol: 0 },
    ],
  },
];
// 備考: ex7.2 の award 確率（約0.157378）は f5 空席・f1 充足の状態で awardProbability が与える値で、ex6.1 の s2f5 が同じ値を印刷値と照合する。
// 機能の空席集合は呼び出し側が state.vacant で与える（既定の推測はしない）。

void T3_GATE;
