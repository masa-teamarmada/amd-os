#!/usr/bin/env node
'use strict';
/*
 * BZM 3.0 — OS の画面が読む係数表と計算結果を書き出す
 *
 * 目的: モデルページ（`model/MODEL_VERSION_LEDGER.md`）§5・§6 で確定した式に入る**すべての係数**を、
 *   値・単位・根拠レベル・正本の節・一言の説明つきで機械可読にし、あわせて
 *   型 × 規制属性 × 証拠水準ごとの前向き計算の結果を持たせる。
 *   シーズ詳細やPJコックピットは、この JSON を読んで式とパラメータを描く。
 *
 * なぜ JSON へ書き出すか:
 *   (a) 前向き計算は1件あたり約2分半かかる。画面のリクエストの中では走らせられない。
 *   (b) 画面が値を書き起こすと、参照実装と画面が静かにずれる。値の出所は `bzm30_forward.cjs` の
 *       CFG 一本にし、根拠（節・レベル）だけをここで対応づける。
 *
 * 使い方:
 *   node model/tools/bzm30_export.cjs                 … 係数表だけを書き出す（数秒）
 *   node model/tools/bzm30_export.cjs --grid          … 型×規制×証拠水準の格子も計算する（数十分）
 *   node model/tools/bzm30_export.cjs --grid --from <dir>  … 事前に並列計算した結果の JSON を取り込む
 *
 * 出力: pwa/src/lib/bzm30/tier0.json
 */

const fs = require('node:fs');
const path = require('node:path');
const { CFG, runTheta, gateSequence } = require('./bzm30_forward.cjs');

const REPO = path.resolve(__dirname, '..', '..');
const OUT = path.join(REPO, 'pwa', 'src', 'lib', 'bzm30', 'tier0.json');

const TYPES = ['F1', 'F2', 'F3', 'F4'];
const REGS = ['REG0', 'REG1', 'REG2'];

// ─────────────────────────────────────────────── 証拠水準の段階（§6.I-1-4）

const STAGES = [
  { stage: 0, label: 'T1 前', note: '論文・提案のみ。原理実証の記録がまだ外部から検証できない' },
  { stage: 1, label: 'T1 原理実証', note: '主張する機能が統制条件で成立し、第三者に検証可能な記録になっている' },
  { stage: 2, label: 'T2 再現性', note: '手順書化され、実験者または装置を変えた再現が確認されている' },
  { stage: 3, label: 'T3 実環境・実規模／治験第I相', note: '実使用条件または規模を上げた条件で性能が確認されている' },
  { stage: 4, label: 'M2 有償PoC／治験第II相／規格試験', note: '需要家が独立の当事者として重要性のある対価を払って評価を完了した' },
  { stage: 5, label: 'M3 量産条件の提示／治験第III相', note: '量産時の価格・数量・品質の条件が権限者の署名つき文書で出た' },
  { stage: 6, label: 'M4 採用決定・量産契約／承認', note: '量産契約の締結、または権限者署名のある採用決定。ここから価値が発生する' },
];

/**
 * 証拠水準 → その型・規制の列で「次に越えるゲート」。
 * 段階の定義（§6.I-1-4）は「越えた段階」なので、次に越えるゲートはその1つ先になる。
 * 列にそのゲートが無い型・規制では、段階を上げる次のゲートまで繰り上げる。
 */
function gateForStage(type, reg, stage) {
  const seq = gateSequence(type, reg);
  // 段階を上げるゲートの並び（stageAfter と同じ対応。列に出てくる順）
  const stageOf = {
    T1: 1, T2: 2, T3: 3, M2: 4, M3: 5, M4: 6,
    T4trial1: 3, T4trial2: 4, T4trialMD: 4, T4trial3: 5,
    T4shonin: 6, T4shoninMD: 6, T4kikaku: 4,
  };
  if (stage <= 0) return seq[0];
  // 「その段階をすでに越えている」ので、越えた最後のゲートの次の位置から始める
  let lastIdx = -1;
  for (let i = 0; i < seq.length; i += 1) {
    const s = stageOf[seq[i]];
    if (s !== undefined && s <= stage) lastIdx = i;
  }
  if (lastIdx < 0) return seq[0];
  // 列の最後のゲートまで越えている段階は、次に越えるゲートが無い（量産契約に到達済み）。
  // 前向き計算は「次に越えるゲート」を要る形なので、この段階は格子から外す。
  if (lastIdx >= seq.length - 1) return null;
  return seq[lastIdx + 1];
}

// ─────────────────────────────────────────────── 係数のメタ（値は CFG が唯一の出所）

/**
 * 根拠レベルの語（§6.I-1-2）:
 *   A = 公開統計または AMD の実測値から直接引ける
 *   B = 制度の設計・文献から水準が導出されている
 *   C = 暫定の置き
 *   規約 / 確定 = 値そのものが規約または承認で決まっており、較正の対象ではない
 */
const G = {
  TIME: '期間と割引',
  GATE: 'ゲートの基準速度',
  TEAM: '担い手の充足',
  FUND: '資金調達（採択と民間調達）',
  ECON: '経済性の乗数',
  OFFER: '実現の申し出と受託',
  EXIT: '撤退の四経路',
  RIGHTS: '権利・承認',
  LOSS: '消失',
  THETA: '案件パラメータの事前分布',
  CASH: '資金繰り（バーンレートと売上）',
  VALUE: '価値の側',
  RULE: '計画規則（Tier 0 既定）',
};

const fmtPct = (x) => `${(100 * x).toFixed(1)}%`;
const fmtMan = (x) => `${x.toLocaleString('ja-JP')} 万円`;

/** 係数1件。value は必ず CFG から引く（画面と実装がずれないため）。 */
function P(group, key, symbol, name, display, level, section, note, usedIn) {
  return { group, key, symbol, name, display, level, section, note, usedIn };
}

function buildParams(cfg) {
  const out = [];

  // ── 期間と割引
  out.push(P(G.TIME, 'T', 'T', '評価期間', `${cfg.T} か月（20年）`, '確定', '6.E-2',
    'この先何か月ぶんを計算に入れるか。全案件で同じ値を使う。ここから先は継続価値が受け持つ', ['Π', 'v']));
  out.push(P(G.TIME, 'd', 'd', '社会的割引率', `年 ${(100 * cfg.d).toFixed(1)}%（実質）`, '確定', '6.E-1',
    '将来の価値を現在の価値へ直す率。リスクの上乗せをしない——失敗はシナリオの確率で数えているため', ['Π']));
  out.push(P(G.TIME, 'planDeadline', null, '計画期限', `${cfg.planDeadline} か月`, 'C', '5.8',
    '9区分の「期限内の資本自立」と「期限後の資本自立」を分ける境目。評価期間とは別の量', ['q_o']));
  out.push(P(G.TIME, 'Hc', 'H_C', '継続価値の延長', `${cfg.Hc} か月`, '確定', '6.E-3',
    '評価期間の終わりから、さらに何か月ぶん既定の規則で延長して価値を積むか', ['C']));
  out.push(P(G.TIME, 'Lu', 'L_u', '前倒し期間', `${cfg.Lu} か月`, '確定', '6.E-3',
    'この案件が無くても他者が同じ用途を実現していたはずの時期までの距離。ここを過ぎると貢献は立地差だけになる', ['Π']));
  out.push(P(G.TIME, 'rampMonths', null, '稼働度の立ち上がり', `${cfg.rampMonths} か月・線形`, '確定', '6.I-10',
    '量産契約から満額の稼働へ届くまでの月数。価値と売上の両方に掛かる', ['Π', 'y']));

  // ── ゲートの基準速度
  out.push(P(G.GATE, 'Mg', 'M_g', 'ゲートの基準所要月数', TYPES.map((t) =>
    `${t}: ${Object.entries(cfg.Mg[t]).map(([g, m]) => `${g} ${m}`).join(' / ')}`).join('｜'), 'C', '6.I-2-1',
    '型ごとの、そのゲートを越えるのにかかる標準の月数。このうち4割は最短準備期間で、残りの月数の逆数が前進の速さになる', ['p^adv']));
  out.push(P(G.GATE, 'minShare', 'M^{\\mathrm{min}}_g', '最短準備期間の割合', `${fmtPct(cfg.minShare)}（基準月数のうち）`, '規約', '6.I-1-1',
    'この期間は何をしても通過しない。残りの期間だけが確率的な待ち時間になる', ['p^adv']));
  out.push(P(G.GATE, 'scale', '\\mathrm{scale}', '所要月数の共通倍率', `${cfg.scale.toFixed(2)}`, 'C', '6.I-2-1',
    '全ゲートの所要月数に一律に掛かる較正パラメータ。実測が入ったらここで水準を合わせる', ['p^adv']));

  // ── 担い手の充足
  out.push(P(G.TEAM, 'dMain', 'd_{f,g}', '主担当機能の空席の遅延', Object.entries(cfg.dMain).map(([g, m]) =>
    `${g}: ${Object.entries(m).map(([f, d]) => `機能${f} ${d.toFixed(2)}`).join(' / ')}`).join('｜'), 'C', '6.I-3-1',
    'そのゲートを主に担う機能が空いているとき、前進の速さがどれだけ落ちるか。空席は減点ではなく遅延として効く', ['η']));
  out.push(P(G.TEAM, 'dOther', 'd_{\\mathrm{other}}', '主担当でない機能の空席の遅延', cfg.dOther.toFixed(2), 'C', '6.I-3-1',
    '主担当以外の機能が空いているときの遅延。一律の値', ['η']));
  out.push(P(G.TEAM, 'kSup', 'k_{\\mathrm{sup}}', '移せる機能が埋まる速さ', `月 ${(cfg.kSup).toFixed(3)}（平均 ${Math.round(1 / cfg.kSup)} か月）`, 'C', '6.I-3-2',
    '用途開拓・意思決定・資金調達・対外交渉・組織の5機能は、AMD の供給で埋まる。評価時点の空席そのものは罰しない', ['η']));
  out.push(P(G.TEAM, 'kEva', 'k_{\\mathrm{eva}}', 'エバンジェリスト機能の探索の速さ', `月 ${(cfg.kEva).toFixed(3)}（平均 ${Math.round(1 / cfg.kEva)} か月、e が乗る）`, 'C', '6.I-3-2',
    '技術の意義と到達点を説明して需要家・投資家・審査側の判断を動かす機能。移せないので探索で埋める', ['η']));
  out.push(P(G.TEAM, 'dPhi', null, '採択に効く担い手乗数', Object.entries(cfg.dPhi).map(([f, d]) => `機能${f} ${d.toFixed(2)}`).join(' / '), 'C', '6.I-3-3',
    '質の高い担い手が埋まっていれば採択される確率も上がる。前進の速さだけが変わるのではない', ['φ']));
  out.push(P(G.TEAM, 'dNu', null, '申し出に効く担い手乗数', Object.entries(cfg.dNu).map(([f, d]) => `機能${f} ${d.toFixed(2)}`).join(' / '), 'C', '6.I-3-3',
    'ライセンス・M&A・知財売却の引き合いの来やすさに効く担い手の空席', ['ν_k']));

  // ── 資金調達
  out.push(P(G.FUND, 'oppRate', null, '応募できる機会が視野に入る率', `月 ${cfg.oppRate.toFixed(2)} 件`, 'C', '6.I-4',
    '公募の一覧を持たない Tier 0 の近似。毎月これだけの数の応募機会が現れると置く', ['φ']));
  out.push(P(G.FUND, 'phiBase', '\\phi_{\\mathrm{base}}', '制度混合の基準採択率', fmtPct(cfg.phiBase), 'C', '6.I-4-1',
    '基準の案件（証拠水準3・無風・担い手が埋まっている）が応募したときの採択率', ['φ']));
  out.push(P(G.FUND, 'zPub', null, '公的採択1件あたりの補給額', fmtMan(cfg.zPub), 'C', '6.I-4-2',
    '採択されたときに入る資金。使途制限資金として入る', ['s^r']));
  out.push(P(G.FUND, 'mgPhi', null, '証拠水準による採択率の倍率', cfg.mgPhi.map((v, i) => `段階${i} ${v.toFixed(2)}`).join(' / '), 'C', '6.I-4-1',
    '審査側から見える証拠の水準が上がるほど採択されやすい', ['φ']));
  out.push(P(G.FUND, 'nuEq', '\\nu^{\\mathrm{eq}}', '会社化後の民間調達の到来率', `月 ${cfg.nuEq.toFixed(3)} 件`, 'C', '6.I-4-3',
    '会社になってはじめて開く経路。会社化前はゼロ', ['s^f']));
  out.push(P(G.FUND, 'zEq', null, '民間調達1件あたりの金額', Object.entries(cfg.zEq).map(([r, v]) => `${r}: ${fmtMan(v)}`).join(' / '), 'C', '6.I-4-3',
    '規制の重い領域は1回の調達規模が大きい', ['s^f']));
  out.push(P(G.FUND, 'incStage', null, '会社化に要る需要の証拠の段階', Object.entries(cfg.incStage).map(([r, v]) => `${r}: 段階${v}`).join(' / '), 'C', '6.I-9-3',
    '「需要の証拠」と「資金の目処」の両方が立ったら会社化する、の前者の水準', ['ι']));

  // ── 経済性の乗数
  out.push(P(G.ECON, 'pRef', 'P^{\\mathrm{ref}}', '経済性の乗数の基準の天井', `${cfg.pRef} 億円／年`, 'C', '6.I-4-1',
    'この天井のときに乗数が 1 になる。「筋がいいから資金が付く」を式に入れるための基準点', ['m_θ']));
  out.push(P(G.ECON, 'betaP', '\\beta_P', '天井が資金調達に効く強さ', `公的採択 ${cfg.betaP.pub} ／ 民間調達 ${cfg.betaP.eq}`, 'C', '6.I-4-1',
    '天井が大きい案件ほど資金が付きやすい。民間のほうが強く効く', ['m_θ']));
  out.push(P(G.ECON, 'betaM', '\\beta_m', '単位採算が黒字で立つことの上乗せ', cfg.betaM.toFixed(2), 'C', '6.I-4-1',
    '支払上限が量産原価の下限を上回る用途が一つでもあるか', ['m_θ']));
  out.push(P(G.ECON, 'mEconClamp', null, '経済性の乗数の上下限', `${cfg.mEconClamp[0]} 〜 ${cfg.mEconClamp[1]}`, 'C', '6.I-4-1',
    '天井の大きさだけで採択率が際限なく動かないように切る', ['m_θ']));

  // ── 申し出と受託
  out.push(P(G.OFFER, 'nuK', '\\nu_k', '実現の申し出の到来率', Object.entries(cfg.nuK).map(([r, m]) =>
    `${r}: ライセンス ${m.lic} / M&A ${m.ma} / 知財売却 ${m.ips}`).join('｜'), 'C', '6.I-5-1',
    '毎月これだけの率でライセンス・M&A・知財売却の引き合いが来る。創薬・医療機器は導出とM&Aが主経路', ['ν_k']));
  out.push(P(G.OFFER, 'nuKSoft', null, 'ソフト・サービス型の申し出の到来率',
    `ライセンス ${cfg.nuKSoft.lic} / M&A ${cfg.nuKSoft.ma} / 知財売却 ${cfg.nuKSoft.ips}`, 'C', '6.I-5-1',
    'F3・F4 は M&A が主経路になる', ['ν_k']));
  out.push(P(G.OFFER, 'qExit', 'q_k', '承継者が残りの市場ゲートを越える確率',
    `M&A ${cfg.qExit.ma} / ライセンス ${cfg.qExit.lic} / 知財売却 ${cfg.qExit.ips}`, 'C', '6.I-10',
    '申し出で決着したあと、引き受けた側が量産まで届けられるか。買収側は資源と継続の意思を持つので高い', ['Π']));
  out.push(P(G.OFFER, 'mgOffer', null, '証拠水準による申し出の倍率', cfg.mgOffer.map((v, i) => `段階${i} ${v.toFixed(2)}`).join(' / '), 'C', '6.I-5-1',
    '見せられる証拠が増えるほど引き合いは来やすい', ['ν_k']));
  out.push(P(G.OFFER, 'nuC', '\\nu_c', '受託の申し出の到来率', `月 ${cfg.nuC.toFixed(2)} 件`, 'C', '6.I-5-2',
    '受託・有償PoC の引き合いが成立する率。型によらず一本', ['χ']));
  out.push(P(G.OFFER, 'mgNuC', null, '証拠水準による受託の倍率', cfg.mgNuC.map((v, i) => `段階${i} ${v.toFixed(1)}`).join(' / '), 'C', '6.I-5-2',
    '実績が積み上がるほど受託の話は来やすい', ['ν_c']));
  out.push(P(G.OFFER, 'contractExit', null, '受託契約の満了の速さ', `月 ${cfg.contractExit.toFixed(3)}（平均 ${Math.round(1 / cfg.contractExit)} か月）`, 'C', '6.I-5-2',
    '契約中は工数の割り当てを勝手に下げられない。その拘束が解ける速さ', ['χ']));
  out.push(P(G.OFFER, 'gamma', '\\gamma', '受託がゲート通過を遅らせる度合い',
    `同源 ${cfg.gamma.same} / 隣接 ${cfg.gamma.near} / 無関係 ${cfg.gamma.unrelated}`, 'C', '6.I-8',
    '本業技術の検証を兼ねる受託（同源）は前進を食わない。無関係な受託は工数のぶんだけ遅らせる', ['p^adv']));
  out.push(P(G.OFFER, 'rhoMax', '\\rho_{\\max}', '受託に割く工数の上限', Object.entries(cfg.rhoMax).map(([t, v]) => `${t}: ${v}`).join(' / '), '確定', '6.D-1',
    '計画規則 R5 の既定。サービス・手法型だけ高い', ['ρ']));

  // ── 撤退の四経路
  out.push(P(G.EXIT, 'exitPath.pUse', '\\pi^{\\mathrm{use}}', '①用途転換の基準確率', cfg.exitPath.pUse.toFixed(2), 'C', '5.7-2',
    '自走が続かなくなったとき、未着手の用途が残っていれば別の用途へ移る。ここだけは終端せず計算が続く', ['q_o']));
  out.push(P(G.EXIT, 'exitPath.pLic', '\\pi^{\\mathrm{lic}}', '③ライセンスへの畳み込みの確率', cfg.exitPath.pLic.toFixed(2), 'C', '5.7-2',
    '証拠水準が一定以上なら、自走をあきらめてもライセンスの相手は現れる', ['q_o']));
  out.push(P(G.EXIT, 'exitPath.pCls', '\\pi^{\\mathrm{cls}}', '②出口クラスの転換の確率', cfg.exitPath.pCls.toFixed(2), 'C', '5.7-2',
    '会社化済みで証拠水準が高いとき、M&A・知財売却へ切り替わる', ['q_o']));
  out.push(P(G.EXIT, 'exitPath.gLic', null, '③が立つ証拠水準', `段階 ${cfg.exitPath.gLic} 以上`, 'C', '5.7-2',
    '見せる証拠が無ければライセンスの相手も現れない', ['q_o']));
  out.push(P(G.EXIT, 'exitPath.gCls', null, '②が立つ証拠水準', `段階 ${cfg.exitPath.gCls} 以上`, 'C', '5.7-2',
    '買い手が付くには有償PoC 以上の証拠が要る', ['q_o']));
  out.push(P(G.EXIT, 'exitPath.licDisc', null, '畳み込みライセンスの条件の割引', cfg.exitPath.licDisc.toFixed(2), 'C', '5.7-2',
    '自走をあきらめた状態で結ぶライセンスは条件が悪くなる', ['Π']));
  out.push(P(G.EXIT, 'qRet', 'q_{\\mathrm{ret}}', '④研究への返却からの到達確率', cfg.qRet.toFixed(2), 'C', '5.7-2',
    '権利が研究機関へ戻ったあと、後に誰かの手で用途へ届く確率。ゼロにはしない', ['Π']));
  out.push(P(G.EXIT, 'kExit', 'k_{\\mathrm{exit}}', '撤退の四経路へ分岐する不成立の回数', `${cfg.kExit} 回`, '確定', '6.D-1',
    '同じゲートで不成立がこの回数に達したら、四経路への分岐を判定する', ['q_o']));
  out.push(P(G.EXIT, 'hUnder', '\\underline h', '自走を続けない資金の残り月数', `${cfg.hUnder} か月`, '確定', '6.D-1',
    '残りの資金がこれを切り、かつ間に合う資金調達の機会が無いとき、四経路へ分岐する', ['q_o']));
  out.push(P(G.EXIT, 'stallShare', null, '滞留の自動分岐', cfg.stallShare.toFixed(2), 'C', '6.I-11-3',
    '同じゲートに留まり続けることを、不成立と同等に数えるための比率', ['n']));

  // ── 権利・承認
  out.push(P(G.RIGHTS, 'betaBar', '\\beta_i', '権利・承認の解決率', `月 ${cfg.betaBar.toFixed(2)}（平均 ${(1 / cfg.betaBar).toFixed(1)} か月）`, 'C', '6.I-6',
    '職務発明の帰属・共同出願の同意・利益相反の承認などが片づく速さ。会議暦と準備期間を平均で畳んだ値', ['p^res']));
  out.push(P(G.RIGHTS, 'R0', 'R_0', '評価日の権利・承認の残件数', `${cfg.R0} 件`, 'C', '6.I-9-3',
    'Tier 0 の既定。未解決の残件は、紐づくゲート・資金調達・会社化・申し出の受諾を塞ぐ', ['R']));

  // ── 消失
  out.push(P(G.LOSS, 'lamComp', '\\lambda^{\\mathrm{comp}}', '競合による消失率', `年 ${fmtPct(cfg.lamComp)}`, 'C', '6.I-7',
    '他者に先を越されて用途そのものが無くなる率。専有可能性と追い風で上下する', ['λ']));
  out.push(P(G.LOSS, 'lamDem', '\\lambda^{\\mathrm{dem}}', '需要側の消失率', `年 ${fmtPct(cfg.lamDem)}`, 'C', '6.I-7',
    '需要そのものが消える率', ['λ']));
  out.push(P(G.LOSS, 'lamCore', '\\lambda^{\\mathrm{core}}', '技術の核の恒久喪失率', `年 ${fmtPct(cfg.lamCore)}`, 'C', '6.I-7',
    '研究者の異動・定年で技術の核が戻らなくなる率', ['λ']));
  out.push(P(G.LOSS, 'lamObs', '\\lambda^{\\mathrm{obs}}', '稼働用途の陳腐化', `年 ${fmtPct(cfg.lamObs)}`, '確定', '6.E-3',
    '量産に届いたあと、陳腐化・代替で稼働から落ちる率', ['Π']));

  // ── 案件パラメータの事前分布
  out.push(P(G.THETA, 'cNodes', 'c', '変換能力の事前分布',
    cfg.cNodes.map(([v, w]) => `${v.toFixed(2)}（重み ${fmtPct(w)}）`).join(' / '), 'C', '6.I-9-1',
    '投入した資源あたりどれだけ前進を生むかの乗数。対数正規（幾何標準偏差 1.65）を3点で表す', ['p^adv']));
  out.push(P(G.THETA, 'psiByStage', '\\psi', '技術の核の成立の事前分布（証拠水準別）',
    cfg.psiByStage.map((v, i) => `段階${i} ${v.toFixed(2)}`).join(' / '), 'C', '6.I-9-1',
    '再現性とスケール時の性能。技術系ゲートの前進確率に乗り、これが立たないとどの用途も稼働に入らない', ['p^adv']));
  out.push(P(G.THETA, 'psiSpread', null, '技術の核の事前分布の幅', `±${cfg.psiSpread.toFixed(2)}（重み 25/50/25%）`, 'C', '6.I-9-1',
    '中央値の上下へ振った3点で不確かさを表す', ['p^adv']));
  out.push(P(G.THETA, 'kIP', '\\kappa_{\\mathrm{IP}}', '専有可能性', cfg.kIP.toFixed(2), 'C', '6.I-9-3',
    'Tier 0 の既定（単独出願済み）。国内で発生させられる割合・競合の消失率・申し出の到来率の三つに効く', ['φ_u', 'λ^comp', 'ν_k']));
  out.push(P(G.THETA, 'sigmaNodes', '\\sigma', '産官学モメンタムの事前分布',
    cfg.sigmaNodes.map(([v, w]) => `${v > 0 ? '追い風' : v < 0 ? '逆風' : '無風'}（重み ${fmtPct(w)}）`).join(' / '), 'C', '6.I-9-1',
    '分野に風が吹いているか。公募の採択率・予算額、民間投資額、正統性の事象の3項目で判定する', ['φ', 'ν', 'λ^comp']));
  out.push(P(G.THETA, 'sigmaMult', null, '産官学モメンタムの倍率',
    Object.entries(cfg.sigmaMult).map(([k, m]) => `${k}: 逆風 ${m['-1']} / 無風 ${m['0']} / 追い風 ${m['1']}`).join('｜'), 'C', '6.I-1-4',
    '風の向きが、採択・申し出・受託・競合消失のそれぞれをどれだけ動かすか', ['φ', 'ν', 'λ^comp']));
  out.push(P(G.THETA, 'eMed', 'e', 'エバンジェリスト機能が埋まる見込み', cfg.eMed.toFixed(2), 'C', '6.I-9-1',
    '未探索なら中立に置く。探索して担い手が見つからないと分かったときだけ下げる。肩書・名義は入力にしない', ['η']));

  // ── 資金繰り
  out.push(P(G.CASH, 'muPre', '\\mu^{\\mathrm{pre}}', '会社化前のバーンレート', Object.entries(cfg.muPre).map(([t, v]) => `${t}: ${fmtMan(v)}／月`).join(' / '), 'C', '6.I-9-2',
    '案件が自ら調達した資金で賄う支出だけを数える。大学が負担している人件費・設備・間接費は数えない', ['s^f']));
  out.push(P(G.CASH, 'muPost', '\\mu^{\\mathrm{post}}', '会社化後のバーンレート', Object.entries(cfg.muPost).map(([t, v]) => `${t}: ${fmtMan(v)}／月`).join(' / '), 'C', '6.I-9-2',
    'ビジネス側1〜2名と家賃・社会保険・顧問料を含む。会社化がスコアを下げることがあるのはここが効くため', ['s^f']));
  out.push(P(G.CASH, 'restrictedWaste', null, '使途制限で充当できない割合', fmtPct(cfg.restrictedWaste), 'C', '6.I-9-2',
    '公的資金は充てられる支出が限定される。その充当できない分', ['s^r']));
  out.push(P(G.CASH, 'rDef', 'r', '自走力の既定', Object.entries(cfg.rDef).map(([t, v]) => `${t}: ${fmtMan(v)}／月`).join(' / '), 'C', '6.I-9-1',
    '工数を全部割いたときに案件へ残る額（直接費を引いた後の粗利）。売上ではない。案件ごとの調査が入ったら上書きする', ['s^f']));
  out.push(P(G.CASH, 'rPostMult', null, '会社化後の自走力の倍率', `${cfg.rPostMult.toFixed(1)} 倍`, 'C', '6.I-9-1',
    '会社として受託・サンプル販売ができるようになる分', ['s^f']));
  out.push(P(G.CASH, 'rHighMult', null, '自走力の事前分布の上側', `中央値の ${cfg.rHighMult.toFixed(1)} 倍`, 'C', '6.I-9-1',
    '対数正規の裾。重み 20%', ['s^f']));
  out.push(P(G.CASH, 'rZeroProb', null, '自走力ゼロの確率', fmtPct(cfg.rZeroProb), 'C', '6.I-9-1',
    '受託で稼げる型を持っていない案件の割合', ['s^f']));
  out.push(P(G.CASH, 'yByStage', 'y_t', '量産契約より前に立つ売上', cfg.yByStage.map((v, i) => `段階${i} ${v.toFixed(2)}`).join(' / '), 'C', '6.I-10',
    '有償PoC・サンプル販売・初期出荷。会社化前バーンレートに対する割合で置く。産業創出価値とは別の量で、資金繰りにだけ効く', ['s^f']));
  out.push(P(G.CASH, 'yPostMult', null, '会社化後の売上の倍率', `${cfg.yPostMult.toFixed(1)} 倍`, 'C', '6.I-10', '', ['s^f']));
  out.push(P(G.CASH, 'qSelf', 'q_{\\mathrm{self}}', '受託・サービスで資本自立したときの産業の大きさ', cfg.qSelf.toFixed(2), 'C', '6.I-10',
    'シーズ本来の用途の天井に対する割合。「事業化がうまくいかなくても、稼げる産業を作れるならそれだけで産業創出効果がある」を計算に乗せる', ['Π']));

  // ── 価値の側
  out.push(P(G.VALUE, 'phiU', '\\phi_u', '国内で発生させられる割合', `${cfg.phiU0} + ${cfg.phiU1} × κ_IP（Tier 0 では ${(cfg.phiU0 + cfg.phiU1 * cfg.kIP).toFixed(3)}）`, 'C', '6.I-10',
    '用途の年額のうち、この案件系（承継者を含む）が国内で発生させられる取り分。専有可能性で決まる', ['Π']));
  out.push(P(G.VALUE, 'alphaNow', '\\alpha_u(0)', '評価日の反実仮想の控除率', cfg.alphaNow.toFixed(2), 'C', '6.I-10',
    'この案件が無くても他者が実現していた分の控除。前倒し期間までの水準。案件ごとの調査項目で、Tier 0 は暫定', ['Π']));
  out.push(P(G.VALUE, 'alphaLoc', '\\alpha_u(\\infty)', '立地差だけが残る控除率', cfg.alphaLoc.toFixed(2), 'C', '6.I-10',
    '前倒し期間を過ぎると、貢献として残るのは国内立地差の分（15%）だけになる', ['Π']));
  out.push(P(G.VALUE, 'qLic', null, '未決着の継続の価値の割引', cfg.qLic.toFixed(2), 'C', '6.I-10',
    '評価期間の終わりに決着していない分を、どれだけ割り引いて価値に数えるか', ['Π']));

  // ── 計画規則
  out.push(P(G.RULE, 'gStar', 'g^{*}', '実現の申し出を検討し始める段階', Object.entries(cfg.gStar).map(([r, v]) => `${r}: 段階${v}`).join(' / '), '確定', '6.D-1',
    '監督官庁の承認が律速する領域は、審査に入る前のライセンスアウトを既定で許す', ['q_o']));

  return out;
}

// ─────────────────────────────────────────────── 格子の計算

function runGrid(fromDir) {
  const grid = [];
  for (const type of TYPES) {
    for (const reg of REGS) {
      const seq = gateSequence(type, reg);
      for (const s of STAGES) {
        const gate = gateForStage(type, reg, s.stage);
        if (gate === null) continue;
        if (s.stage > 0 && !seq.includes(gate)) continue;
        const cached = fromDir ? readCached(fromDir, type, reg, s.stage) : null;
        const r = cached || runTheta(type, reg, CFG, s.stage === 0 ? undefined : { gate });
        grid.push({
          type, reg, stage: s.stage, gate,
          nGates: seq.length,
          v10: round(r.v10), v50: round(r.v50), v90: round(r.v90), v: round(r.v),
          pM4: round(r.pM4), m4mean: r.m4mean === null ? null : Math.round(r.m4mean),
          cRatio: r.cRatio === null ? null : round(r.cRatio),
          outcome: Object.fromEntries(Object.entries(r.outcome).map(([k, v2]) => [k, round(v2)])),
        });
        process.stderr.write(`  ${type}×${reg} 段階${s.stage}（${gate}）… V中央 ${round(r.v50)}\n`);
      }
    }
  }
  return grid;
}

function readCached(dir, type, reg, stage) {
  const f = path.join(dir, `out_${type}_${reg}_s${stage}.json`);
  if (!fs.existsSync(f)) return null;
  const raw = fs.readFileSync(f, 'utf8').trim();
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

const round = (x) => (typeof x === 'number' ? Math.round(x * 1e6) / 1e6 : x);

// ─────────────────────────────────────────────── 出力

function main() {
  const args = process.argv.slice(2);
  const withGrid = args.includes('--grid');
  const fromIdx = args.indexOf('--from');
  const fromDir = fromIdx >= 0 ? args[fromIdx + 1] : null;

  const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : null;

  const payload = {
    model_version: 'bzm-3.0',
    approval_ref: '2026-08-27-1',
    canon: 'model/MODEL_VERSION_LEDGER.md（モデルページ §5・§6）',
    reference_impl: 'model/tools/bzm30_forward.cjs',
    note: 'V は天井（用途ごとの国内の年額の付加価値、円）を 1 に正規化した現在価値。円のスコアは天井を掛けて出す。',
    approximations: [
      'A1 自由資金と使途制限資金を合算した単一の残高で近似し、充当不能分を型別の係数で控除する',
      'A2 受託契約を「契約なし／契約中」の2状態にし、残り拘束月数を満了ハザードで近似する',
      'A3 稼働用途は量産契約の到達後の解析的な裾で扱い、受託由来のサービス用途は価値に入れない',
      'A4 権利・承認の残件を残件数だけで持ち、種類別の会議暦は平均の解決率へ畳む',
      'A5 滞留の自動分岐を、ハザード位置での付加ハザードで近似する',
      'A6 天井を1に正規化する',
    ],
    numeric_error: '格子の刻みを 1/2 と 1/8 で比べた差は 2.0〜2.5%。V は有効数字2桁で読む（§6.I-11-1）',
    stages: STAGES,
    params: buildParams(CFG),
    grid: withGrid ? runGrid(fromDir) : (prev ? prev.grid : []),
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(payload, null, 1)}\n`, 'utf8');
  process.stderr.write(`\n書き出した: ${path.relative(REPO, OUT)}（係数 ${payload.params.length} 件 / 格子 ${payload.grid.length} 行）\n`);
}

module.exports = { STAGES, gateForStage, buildParams, TYPES, REGS };

if (require.main === module) main();
