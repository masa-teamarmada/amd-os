/**
 * シーズの登録情報を、BZM 3.0 の入力へ写す。
 *
 * BZM 3.0 は案件を「工程の型 × 規制属性」で分類し、証拠水準・資金・権利残件・会社化の
 * 観測状態を与えて前向きに計算する（モデルページ §5・§6）。シーズ側に何が埋まっていて
 * 何が空かを、この層で一覧にする。**埋まっていない項目を既定値で埋めたことにしない**——
 * どこまでが観測で、どこからが Tier 0 の既定かが画面から見えることを最優先にする。
 *
 * 【入力の出どころは2系統】
 * 1. `seed_bzm30_inputs` / `seed_value_ceilings`（migration 331）… 案件ごとに調べて入れた値。これが最優先
 * 2. シーズの登録情報と旧の一次選別の帯 … 1 が無いときの手がかり
 *
 * 【承認待ちの2つの写像】
 * モデルページの規律（model/README.md (b)）により、正本に無い当てはめ規則は
 * まさの承認まで本番表示に使わない。下の2表は**書いてあるが既定では効かない**。
 * 承認が下りたら対応するフラグを true にする（それだけで画面に入る）。
 *   1. 分野レーン → 工程の型 × 規制属性
 *   2. 旧の段階仮説 S0〜S5 → BZM 3.0 の証拠水準 0〜6
 * 案件ごとに調べた値（1 系統）は、この写像を通さないので承認を待たずに画面へ出る。
 */

import type { Seed, SeedDetail, SeedScreeningBandDetail } from "@/types/seeds";
import type { SeedBzm30Ceiling, SeedBzm30Dto } from "./seed-score";

export type ProcessType = "F1" | "F2" | "F3" | "F4";
export type RegClass = "REG0" | "REG1" | "REG2";

export const PROCESS_TYPE_LABEL: Record<ProcessType, string> = {
  F1: "F1 プロセス型（素材・化学・バイオ生産）",
  F2: "F2 組立・デバイス型（部品統合と歩留まり）",
  F3: "F3 ソフトウェア・データ型",
  F4: "F4 サービス・手法型（計測・解析・受託）",
};

export const REG_CLASS_LABEL: Record<RegClass, string> = {
  REG0: "REG-0 監督官庁の事前承認が不要",
  REG1: "REG-1 規格・認証が必要",
  REG2: "REG-2 監督官庁の承認が律速",
};

export const STAGE_LABEL: Record<number, string> = {
  0: "段階0（T1 前）",
  1: "段階1（原理実証 T1 を通過）",
  2: "段階2（再現性 T2 を通過）",
  3: "段階3（実環境・実規模の検証 T3／治験第I相を通過）",
  4: "段階4（有償PoC M2／治験第II相／規格試験を通過）",
  5: "段階5（量産条件の提示 M3／治験第III相を通過）",
  6: "段階6（採用決定・量産契約 M4／承認を通過）",
};

// ───────────────────────────────── 承認待ちの写像 1: 分野レーン → 型 × 規制

export const LANE_ASSIGNMENT_APPROVED = false;

export const LANE_ASSIGNMENT: Record<string, { type: ProcessType; reg: RegClass; reason: string }> = {
  materials: { type: "F1", reg: "REG0", reason: "素材・化学のプロセス。規模を上げると挙動が非線形に変わる型で、事前承認は要らない" },
  gx_circular: { type: "F1", reg: "REG0", reason: "資源回収・分解・転換の化学プロセス。装置よりプロセスが律速" },
  life: { type: "F1", reg: "REG2", reason: "バイオ生産で、医薬・再生医療・食品機能性表示のいずれかで監督官庁の承認が律速する" },
  gx_energy: { type: "F2", reg: "REG1", reason: "発電・蓄電・変換の装置。系統連系と型式認証の規格が要る" },
  robo: { type: "F2", reg: "REG1", reason: "機構と制御の組立。機械安全・電気用品の認証が要る" },
  ict: { type: "F3", reg: "REG0", reason: "ソフトウェア・データ。技術ゲートより市場ゲートが律速する" },
};

// ───────────────────────────────── 承認待ちの写像 2: 段階仮説 → 証拠水準

export const STAGE_ASSIGNMENT_APPROVED = false;

/**
 * 旧の一次選別で置いた段階仮説（S0〜S5）を、BZM 3.0 の証拠水準（0〜6）へ写す。
 * 旧側の定義は bzm/SEED_STAGE_AXIS_TEMPLATE_2026-08-15.md §1、
 * BZM 3.0 側は モデルページ §6.I-1-4。
 */
export const STAGE_ASSIGNMENT: Record<string, { stage: number; reason: string }> = {
  S0: { stage: 0, reason: "構想・原理提示（論文・提案のみ）。原理実証 T1 をまだ越えていない" },
  S1: { stage: 1, reason: "ラボ実証（再現データの実績・実験室規模）。原理実証 T1 の通過に当たる" },
  S2: { stage: 2, reason: "プロトタイプ・オフサイト実証（試作機・ベンチ機）。再現性 T2 の通過に当たる" },
  S3: { stage: 3, reason: "オンサイト実証（実環境・顧客先での試験実績）。実環境・実規模の検証 T3 の通過に当たる" },
  S4: { stage: 4, reason: "有償実証・初期顧客（対価を伴う検証の実績）。有償PoC M2 の通過に当たる" },
  S5: { stage: 4, reason: "事業化準備（量産設計・調達活動）。量産条件の提示 M3 は権限者の署名つき文書を要求するので、段階4 に留める" },
};

// ───────────────────────────────── 金額の公開ゲート

/**
 * 算出済みの金額を画面に出してよいか。
 *
 * **2026-08-27 に true へ戻した。** 一度 false にしたのは、その日の午前の算出が
 * OS にある資金繰り・議事録・契約・知財・創業メンバーを一度も読まずに、
 * XRL と月報1か月分だけで入力を決めていたためだった（まさ「一旦隠しておいて」）。
 *
 * 同じ日の午後に、`project_id` を持つ165テーブルの棚卸しから始めて入力を埋め直した。
 * 何をどこまで読んだかは [model/cases/INVENTORY.md](../../../../model/cases/INVENTORY.md)、
 * 案件ごとの根拠は `seed_bzm30_inputs` の各 `*_reason` 欄にあり、
 * シーズ詳細の「入力の充足」の表の5列目にそのまま出る。
 *
 * **まだ埋まっていないものが残っている。** 出どころの色（観測 / Tier 0 既定 / 未調査 /
 * 承認待ち）と、その列の根拠の文がそれを見せる。とくに:
 *   - 産官学モメンタム σ は21件すべて未記入（区分ごとの産業統計がOSに無い）
 *   - バーンレートは記録しても**計算に入らない**（参照実装が案件ごとの値を受け取らない）
 */
export const BZM30_SCORES_PUBLISHED = true;

// ───────────────────────────────── 入力の一覧

export interface Bzm30SeedInput {
  key: string;
  symbol: string | null;
  name: string;
  value: string;
  /** 観測から埋まっているか。false なら Tier 0 の既定か未調査 */
  filled: boolean;
  origin: "観測" | "Tier 0 既定" | "未調査" | "承認待ち";
  source: string;
}

/**
 * 円を読める単位へ。**1億円未満は万円で出す。**
 * 億円へ丸めると、手元資金 2,500万円（チャレナジー）や 7,800万円（SolvioraX）が
 * 「0 億円」になって、資金が尽きている案件と資金が入っていない案件の区別がつかなくなる。
 */
const oku = (yen: number) =>
  Math.abs(yen) >= 1e8
    ? `${(yen / 1e8).toLocaleString("ja-JP", { maximumFractionDigits: 1 })} 億円`
    : `${(yen / 1e4).toLocaleString("ja-JP", { maximumFractionDigits: 0 })} 万円`;

const CONFIDENCE_LABEL: Record<string, string> = { high: "確度 高", medium: "確度 中", low: "確度 低" };

/** 用途の天井を合計して、価値の式に入る年額の純増（円）を出す。未調査の用途は数えない。 */
export function ceilingTotalYen(ceilings: SeedBzm30Ceiling[]): number | null {
  let total = 0;
  let known = false;
  for (const c of ceilings) {
    if (c.ceiling_yen === null) continue;
    known = true;
    total += c.ceiling_yen - (c.displacement_yen ?? 0);
  }
  return known ? total : null;
}

function lane(seed: Seed): { type: ProcessType; reg: RegClass; reason: string } | null {
  if (!seed.domain_lane) return null;
  return LANE_ASSIGNMENT[seed.domain_lane] ?? null;
}

/** 帯の段階仮説（下限〜上限）を証拠水準の区間へ。承認前は null。 */
export function stageRange(band: SeedScreeningBandDetail | null): { lower: number; upper: number; reason: string } | null {
  if (!STAGE_ASSIGNMENT_APPROVED || !band?.stage_lower) return null;
  const lo = STAGE_ASSIGNMENT[band.stage_lower];
  const hi = STAGE_ASSIGNMENT[band.stage_upper ?? band.stage_lower] ?? lo;
  if (!lo) return null;
  return { lower: lo.stage, upper: hi.stage, reason: lo.reason };
}

/** 会社化しているか。シーズに紐づく AMD PJ に会社名が入っていれば会社化済みと読む。 */
function incorporatedFromProjects(detail: SeedDetail | null): { yes: boolean; via: string } | null {
  const link = detail?.project_links?.find((p) => p.venture_name);
  if (link) return { yes: true, via: `${link.project_name}（${link.venture_name}）` };
  if (detail?.project_links?.length) return { yes: false, via: `${detail.project_links[0].project_name}（会社名の登録なし）` };
  return null;
}

/**
 * このシーズについて、BZM 3.0 の式に入る値を並べる。
 * 画面はこの並びをそのまま表にする。
 */
export function buildSeedInputs(
  seed: Seed,
  detail: SeedDetail | null,
  band: SeedScreeningBandDetail | null,
  bzm30?: SeedBzm30Dto | null,
): Bzm30SeedInput[] {
  const out: Bzm30SeedInput[] = [];
  const rec = bzm30?.input ?? null;
  const ceilings = bzm30?.ceilings ?? [];
  const assign = lane(seed);
  const laneLabel = seed.domain_lane ?? "未分類";

  // ── 分類（型 × 規制）
  if (rec?.process_type && rec?.reg_class) {
    const prov = rec.classification_confidence === "provisional";
    out.push({
      key: "tau_proc", symbol: "\\tau_{\\mathrm{proc}}", name: "工程の型",
      value: `${PROCESS_TYPE_LABEL[rec.process_type]}${prov ? "（仮）" : ""}`,
      filled: true, origin: "観測",
      source: rec.classification_reason ?? "案件ごとに判定した値",
    });
    out.push({
      key: "reg", symbol: null, name: "規制属性",
      value: `${REG_CLASS_LABEL[rec.reg_class]}${prov ? "（仮）" : ""}`,
      filled: true, origin: "観測",
      source: rec.classification_reason ?? "案件ごとに判定した値",
    });
  } else if (LANE_ASSIGNMENT_APPROVED && assign) {
    out.push({
      key: "tau_proc", symbol: "\\tau_{\\mathrm{proc}}", name: "工程の型",
      value: PROCESS_TYPE_LABEL[assign.type], filled: true, origin: "観測",
      source: `分野「${laneLabel}」から。${assign.reason}`,
    });
    out.push({
      key: "reg", symbol: null, name: "規制属性",
      value: REG_CLASS_LABEL[assign.reg], filled: true, origin: "観測",
      source: `分野「${laneLabel}」から。${assign.reason}`,
    });
  } else {
    out.push({
      key: "tau_proc", symbol: "\\tau_{\\mathrm{proc}}", name: "工程の型",
      value: "未判定", filled: false, origin: assign ? "承認待ち" : "未調査",
      source: assign
        ? `分野「${laneLabel}」からの割り当ては用意してあるが、当てはめ規則がまだモデルページに載っていない`
        : "このシーズが何を作るのか（素材・装置・ソフト・サービス）の判定が要る",
    });
    out.push({
      key: "reg", symbol: null, name: "規制属性",
      value: "未判定", filled: false, origin: assign ? "承認待ち" : "未調査",
      source: "監督官庁の承認・規格認証が要るかどうかの判定が要る",
    });
  }

  // ── 天井（価値の式に直接入る、いちばん効く入力）
  const total = ceilingTotalYen(ceilings);
  if (ceilings.length > 0) {
    for (const c of ceilings) {
      const known = c.ceiling_yen !== null;
      const sales = c.market_sales_yen !== null ? `売上ベース ${oku(c.market_sales_yen)}` : null;
      const rate = c.value_added_rate !== null ? `付加価値率 ${(c.value_added_rate * 100).toFixed(0)}%` : null;
      out.push({
        key: `P_bar:${c.use_case}`, symbol: "\\bar P_u",
        name: `天井（${c.use_case}）`,
        value: known ? `${oku(c.ceiling_yen as number)}／年` : "保留",
        filled: known, origin: known ? "観測" : "未調査",
        source: [
          c.source,
          [sales, rate].filter(Boolean).join(" × ") || null,
          c.confidence ? CONFIDENCE_LABEL[c.confidence] : null,
          c.note,
        ].filter(Boolean).join("。"),
      });
      if ((c.displacement_yen ?? 0) > 0) {
        out.push({
          key: `delta:${c.use_case}`, symbol: "\\delta_u",
          name: `置き換え分（${c.use_case}）`,
          value: `${oku(c.displacement_yen)}／年`, filled: true, origin: "観測",
          source: "国内の既存事業から奪う分。天井から引いて純増を出す",
        });
      }
    }
  } else {
    out.push({
      key: "P_bar", symbol: "\\bar P_u", name: "天井（用途ごとの国内の年額の付加価値）",
      value: seed.market_size_range ?? "未調査",
      filled: false, origin: "未調査",
      source: seed.market_size_range
        ? `シーズ登録の「市場規模」は ${seed.market_size_range}。売上ベースなら付加価値へ直す必要がある（産業連関表の該当部門の付加価値率）`
        : "用途を洗い出し、用途ごとに国内の年額を産業統計から引く。売上ではなく付加価値（売上から原材料・外注を引いた分）",
    });
    out.push({
      key: "delta", symbol: "\\delta_u", name: "置き換え分（国内の既存事業から奪う分）",
      value: "未調査", filled: false, origin: "未調査",
      source: "国内に既存の産業がある市場へ入る場合、天井から引く。ここを引かないと純増を大きく見誤る",
    });
  }

  // ── 観測状態
  const sr = stageRange(band);
  if (rec?.evidence_stage !== null && rec?.evidence_stage !== undefined) {
    out.push({
      key: "g0", symbol: "g_0", name: "評価日の証拠水準",
      value: STAGE_LABEL[rec.evidence_stage] ?? `段階${rec.evidence_stage}`,
      filled: true, origin: "観測",
      source: rec.evidence_stage_reason ?? "案件ごとに判定した値",
    });
  } else {
    out.push({
      key: "g0", symbol: "g_0", name: "評価日の証拠水準",
      value: sr
        ? (sr.lower === sr.upper ? `段階 ${sr.lower}` : `段階 ${sr.lower}〜${sr.upper}`)
        : band?.stage_lower ? "未判定" : "段階0（T1 前）＝Tier 0 既定",
      filled: Boolean(sr),
      origin: sr ? "観測" : band?.stage_lower ? "承認待ち" : "Tier 0 既定",
      source: sr
        ? `${sr.reason}（旧の段階仮説 ${band?.stage_lower}〜${band?.stage_upper} から）`
        : band?.stage_lower
          ? `旧の段階仮説 ${band.stage_lower}〜${band.stage_upper} は登録済みだが、証拠水準への当てはめ規則がまだモデルページに載っていない`
          : "外部から検証可能なゲートの通過記録（査読論文・第三者再現・実環境試験・有償PoC）が要る",
    });
  }

  const inc = incorporatedFromProjects(detail);
  const incKnown = rec?.incorporated !== null && rec?.incorporated !== undefined;
  out.push({
    key: "iota", symbol: "\\iota_0", name: "会社化",
    value: incKnown ? (rec.incorporated ? "済み" : "未") : inc ? (inc.yes ? "済み" : "未") : "未（Tier 0 既定）",
    filled: incKnown || Boolean(inc), origin: incKnown || inc ? "観測" : "Tier 0 既定",
    source: rec?.incorporated_reason
      ?? (inc ? `AMD PJ ${inc.via} から` : incKnown ? "案件ごとに確認した値" : "シーズに紐づく AMD PJ が無いので、会社化していないものとして計算する"),
  });

  const cashKnown = rec?.free_cash_yen !== null && rec?.free_cash_yen !== undefined;
  out.push({
    key: "cash", symbol: "s^{\\mathrm{f}}_0", name: "評価日の自由資金",
    value: cashKnown ? `${oku(rec.free_cash_yen as number)}${rec.free_cash_as_of ? `（${rec.free_cash_as_of} 時点）` : ""}` : "会社化前バーンレートの18か月分（Tier 0 既定）",
    filled: cashKnown, origin: cashKnown ? "観測" : "Tier 0 既定",
    source: rec?.free_cash_reason
      ?? (cashKnown
        ? `実額${rec.free_cash_as_of ? `（${rec.free_cash_as_of} 時点）` : ""}。撤退の確率を直接動かす`
        : "実額が入ると撤退の確率が大きく動く。手元資金の残高の確認が要る"),
  });

  // バーンレートは**前向き計算に入らない**（参照実装は工程の型と会社化の有無から既定値を引く）。
  // それでも表に出すのは、既定値が実績と何倍ずれているかが見えないと、
  // 資金の残り月数を読み違えるため（BUGS.md 2026-08-27 の2件目）。
  const burnKnown = rec?.burn_rate_yen_month !== null && rec?.burn_rate_yen_month !== undefined;
  out.push({
    key: "burn", symbol: "\\mu_t", name: "バーンレート（参考・計算には入らない）",
    value: burnKnown
      ? `${((rec.burn_rate_yen_month as number) / 1e4).toLocaleString("ja-JP", { maximumFractionDigits: 0 })} 万円／月`
      : "工程の型と会社化の有無から引く既定値（Tier 0 既定）",
    filled: false, origin: burnKnown ? "承認待ち" : "Tier 0 既定",
    source: rec?.burn_rate_reason
      ?? "参照実装は案件ごとのバーンレートを受け取らず、モデルページ §6.I-9-2 の型別の既定値で計算する。実績を入れる経路がまだ無い",
  });

  const ucKnown = rec?.under_contract !== null && rec?.under_contract !== undefined;
  out.push({
    key: "x0", symbol: "x_0", name: "評価日に受託契約中か",
    value: ucKnown ? (rec.under_contract ? "受託契約中" : "受託契約なし") : "受託契約なし（Tier 0 既定）",
    filled: ucKnown, origin: ucKnown ? "観測" : "Tier 0 既定",
    source: rec?.under_contract_reason
      ?? "受託中は工数の一部が受託へ向くのでゲートの前進が遅くなる一方、稼ぎが入って資金が延びる",
  });

  const rightsKnown = rec?.rights_open !== null && rec?.rights_open !== undefined;
  out.push({
    key: "rights", symbol: "R_0", name: "権利・承認の未解決の残件",
    value: rightsKnown
      ? `${rec.rights_open} 件`
      : seed.ip_status ? `2件（Tier 0 既定）／登録の記載: ${seed.ip_status}` : "2件（Tier 0 既定）",
    filled: rightsKnown, origin: rightsKnown ? "観測" : "Tier 0 既定",
    source: rec?.rights_open_reason
      ?? "職務発明の帰属・共同出願の同意・ライセンス条件・利益相反の承認の4種を数える",
  });

  // ── 案件パラメータ
  const cKnown = rec?.conversion_c !== null && rec?.conversion_c !== undefined;
  out.push({
    key: "c", symbol: "c", name: "変換能力",
    value: cKnown ? `${Number(rec.conversion_c).toFixed(2)}` : "1.00（分野の基準どおり。Tier 0 既定）",
    filled: cKnown, origin: cKnown ? "観測" : "Tier 0 既定",
    source: rec?.conversion_c_reason
      ?? "アクションに掛かった費用と得られた戦略余力の増分の比率を、直近に重みを置いた移動平均で持つ。記録が無い案件は無風期間から概算する（モデルページ §5.3・§6.I-9-1）",
  });

  const quietKnown = rec?.quiet_months !== null && rec?.quiet_months !== undefined;
  out.push({
    key: "t_q", symbol: "t_q", name: "無風期間（ポジティブな動きが出ていない月数）",
    value: quietKnown ? `${Number(rec.quiet_months).toFixed(0)} か月` : "未観測（乗数 1.0）",
    filled: quietKnown, origin: quietKnown ? "観測" : "Tier 0 既定",
    source: rec?.quiet_months_reason
      ?? "資金調達の成立・製品化・提携・受賞・大型採択などの公開の動きが最後に観測されてからの月数。長いほどライセンス・M&A の引き合いが来にくくなる（12か月で0.5倍・24か月で0.1倍）",
  });

  const kipKnown = rec?.kappa_ip !== null && rec?.kappa_ip !== undefined;
  out.push({
    key: "kIP", symbol: "\\kappa_{\\mathrm{IP}}", name: "専有可能性",
    value: kipKnown ? `${Number(rec.kappa_ip).toFixed(2)}` : "0.55（単独出願済みの想定。Tier 0 既定）",
    filled: kipKnown, origin: kipKnown ? "観測" : "Tier 0 既定",
    source: rec?.kappa_ip_reason ?? "請求範囲の広さ・他者特許との抵触・代替経路の塞がり具合から推定する",
  });

  const sigmaKnown = rec?.sigma !== null && rec?.sigma !== undefined;
  out.push({
    key: "sigma", symbol: "\\sigma", name: "産官学モメンタム",
    value: sigmaKnown
      ? ((rec.sigma as number) > 0 ? "追い風" : (rec.sigma as number) < 0 ? "逆風" : "無風")
      : "逆風／無風／追い風を 25 / 50 / 25% で重ねる（Tier 0 既定）",
    filled: sigmaKnown, origin: sigmaKnown ? "観測" : "Tier 0 既定",
    source: rec?.sigma_reason
      ?? "直近24か月と その前の24か月を比べ、公的公募の採択率・予算額、民間投資額、正統性の事象の3項目で判定する",
  });

  const eKnown = rec?.evangelist_e !== null && rec?.evangelist_e !== undefined;
  out.push({
    key: "e", symbol: "e", name: "エバンジェリスト機能が埋まる見込み",
    value: eKnown ? `${Number(rec.evangelist_e).toFixed(2)}` : "0.50（未探索は中立。Tier 0 既定）",
    filled: eKnown, origin: eKnown ? "観測" : "Tier 0 既定",
    source: rec?.evangelist_e_reason
      ?? "関係者の棚卸し（研究室出身者・長期の共同研究者・共同出願者）。探索して見つからないと分かったときだけ下げる",
  });

  const rKnown = rec?.self_revenue_yen_month !== null && rec?.self_revenue_yen_month !== undefined;
  out.push({
    key: "r", symbol: "r", name: "自走力（受託などで案件へ残る粗利）",
    value: rKnown ? `${((rec.self_revenue_yen_month as number) / 1e4).toLocaleString("ja-JP")} 万円／月` : "工程の型ごとの既定値",
    filled: rKnown, origin: rKnown ? "観測" : "Tier 0 既定",
    source: rec?.self_revenue_note
      ?? "その案件が実際に何を受託するのかを書いたうえで置く。売上ではなく直接費を引いた後の粗利",
  });

  const marginKnown = rec?.unit_margin_positive !== null && rec?.unit_margin_positive !== undefined;
  out.push({
    key: "w_u", symbol: "w_u", name: "支払上限と量産原価の下限",
    value: marginKnown
      ? (rec.unit_margin_positive ? "黒字で立つ用途がある" : "黒字で立つ用途がまだ無い")
      : seed.first_customer_candidate ? `未調査（顧客候補: ${seed.first_customer_candidate}）` : "未調査",
    filled: marginKnown, origin: marginKnown ? "観測" : "未調査",
    source: rec?.unit_margin_reason
      ?? "この差が黒字で立つ用途が一つも無いと、経済性の乗数が下がり資金が付かなくなる",
  });

  if (total !== null) {
    out.push({
      key: "total", symbol: null, name: "価値の式に入る年額の純増（合計）",
      value: `${oku(total)}／年`, filled: true, origin: "観測",
      source: "用途ごとの天井から置き換え分を引いて足したもの。この額に、下の v を掛けると金額になる",
    });
  }

  return out;
}

/** 入力の充足の要約（画面の見出しに出す）。 */
export function inputSummary(inputs: Bzm30SeedInput[]): { filled: number; total: number; blockers: string[] } {
  const filled = inputs.filter((i) => i.filled).length;
  const blockers = inputs
    .filter((i) => !i.filled && (i.key.startsWith("P_bar") || i.key === "tau_proc" || i.key === "g0"))
    .map((i) => i.name);
  return { filled, total: inputs.length, blockers };
}
