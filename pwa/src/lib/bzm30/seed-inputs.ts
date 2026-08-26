/**
 * シーズの登録情報を、BZM 3.0 の入力へ写す。
 *
 * BZM 3.0 は案件を「工程の型 × 規制属性」で分類し、証拠水準・資金・権利残件・会社化の
 * 観測状態を与えて前向きに計算する（モデルページ §5・§6）。シーズ側に何が埋まっていて
 * 何が空かを、この層で一覧にする。**埋まっていない項目を既定値で埋めたことにしない**——
 * どこまでが観測で、どこからが Tier 0 の既定かが画面から見えることを最優先にする。
 *
 * 【承認待ちの2つの写像】
 * モデルページの規律（model/README.md (b)）により、正本に無い当てはめ規則は
 * まさの承認まで本番表示に使わない。下の2表は**書いてあるが既定では効かない**。
 * 承認が下りたら対応するフラグを true にする（それだけで画面に入る）。
 *   1. 分野レーン → 工程の型 × 規制属性
 *   2. 旧の段階仮説 S0〜S5 → BZM 3.0 の証拠水準 0〜6
 */

import type { Seed, SeedDetail, SeedScreeningBandDetail } from "@/types/seeds";

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

// ───────────────────────────────── 入力の一覧

export interface Bzm30SeedInput {
  key: string;
  symbol: string | null;
  name: string;
  /** このシーズでの値。埋まっていなければ何が要るかを書く */
  value: string;
  /** 観測から埋まっているか。false なら Tier 0 の既定か未調査 */
  filled: boolean;
  /** 値の出どころ */
  origin: "観測" | "Tier 0 既定" | "未調査" | "承認待ち";
  /** どこから来たか、または何を調べれば埋まるか */
  source: string;
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
function incorporated(detail: SeedDetail | null): { yes: boolean; via: string } | null {
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
): Bzm30SeedInput[] {
  const out: Bzm30SeedInput[] = [];
  const assign = lane(seed);
  const laneLabel = seed.domain_lane ?? "未分類";

  // ── 分類（型 × 規制）
  if (LANE_ASSIGNMENT_APPROVED && assign) {
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
  out.push({
    key: "P_bar", symbol: "\\bar P_u", name: "天井（用途ごとの国内の年額の付加価値）",
    value: seed.market_size_range ?? "未調査",
    filled: Boolean(seed.market_size_range), origin: seed.market_size_range ? "観測" : "未調査",
    source: seed.market_size_range
      ? "シーズ登録の「市場規模」。売上ベースなら付加価値へ直す必要がある（産業連関表の該当部門の付加価値率）"
      : "用途を洗い出し、用途ごとに国内の年額を産業統計から引く。売上ではなく付加価値（売上から原材料・外注を引いた分）",
  });
  out.push({
    key: "delta", symbol: "\\delta_u", name: "置き換え分（国内の既存事業から奪う分）",
    value: "未調査", filled: false, origin: "未調査",
    source: "国内に既存の産業がある市場へ入る場合、天井から引く。ここを引かないと純増を大きく見誤る",
  });

  // ── 観測状態
  const sr = stageRange(band);
  out.push({
    key: "g0", symbol: "g_0", name: "評価日の証拠水準",
    value: sr
      ? (sr.lower === sr.upper ? `段階 ${sr.lower}` : `段階 ${sr.lower}〜${sr.upper}`)
      : band?.stage_lower
        ? "未判定"
        : "段階0（T1 前）＝Tier 0 既定",
    filled: Boolean(sr),
    origin: sr ? "観測" : band?.stage_lower ? "承認待ち" : "Tier 0 既定",
    source: sr
      ? `${sr.reason}（旧の段階仮説 ${band?.stage_lower}〜${band?.stage_upper} から）`
      : band?.stage_lower
        ? `旧の段階仮説 ${band.stage_lower}〜${band.stage_upper} は登録済みだが、証拠水準への当てはめ規則がまだモデルページに載っていない`
        : "外部から検証可能なゲートの通過記録（査読論文・第三者再現・実環境試験・有償PoC）が要る",
  });
  const inc = incorporated(detail);
  out.push({
    key: "iota", symbol: "\\iota_0", name: "会社化",
    value: inc ? (inc.yes ? "済み" : "未") : "未（Tier 0 既定）",
    filled: Boolean(inc), origin: inc ? "観測" : "Tier 0 既定",
    source: inc ? `AMD PJ ${inc.via} から` : "シーズに紐づく AMD PJ が無いので、会社化していないものとして計算する",
  });
  out.push({
    key: "cash", symbol: "s^{\\mathrm{f}}_0", name: "評価日の自由資金",
    value: "会社化前バーンレートの18か月分（Tier 0 既定）", filled: false, origin: "Tier 0 既定",
    source: "実額が入ると撤退の確率が大きく動く。手元資金の残高の確認が要る",
  });
  out.push({
    key: "rights", symbol: "R_0", name: "権利・承認の未解決の残件",
    value: seed.ip_status ? `2件（Tier 0 既定）／登録の記載: ${seed.ip_status}` : "2件（Tier 0 既定）",
    filled: false, origin: "Tier 0 既定",
    source: "職務発明の帰属・共同出願の同意・ライセンス条件・利益相反の承認の4種を数える",
  });

  // ── 案件パラメータ
  out.push({
    key: "kIP", symbol: "\\kappa_{\\mathrm{IP}}", name: "専有可能性",
    value: "0.55（単独出願済みの想定。Tier 0 既定）", filled: false, origin: "Tier 0 既定",
    source: "請求範囲の広さ・他者特許との抵触・代替経路の塞がり具合から推定する",
  });
  out.push({
    key: "sigma", symbol: "\\sigma", name: "産官学モメンタム",
    value: "逆風／無風／追い風を 25 / 50 / 25% で重ねる（Tier 0 既定）", filled: false, origin: "Tier 0 既定",
    source: "直近24か月と その前の24か月を比べ、公的公募の採択率・予算額、民間投資額、正統性の事象の3項目で判定する",
  });
  out.push({
    key: "e", symbol: "e", name: "エバンジェリスト機能が埋まる見込み",
    value: "0.50（未探索は中立。Tier 0 既定）", filled: false, origin: "Tier 0 既定",
    source: "関係者の棚卸し（研究室出身者・長期の共同研究者・共同出願者）。探索して見つからないと分かったときだけ下げる",
  });
  out.push({
    key: "r", symbol: "r", name: "自走力（受託などで案件へ残る粗利）",
    value: "工程の型ごとの既定値", filled: false, origin: "Tier 0 既定",
    source: "その案件が実際に何を受託するのかを書いたうえで置く。売上ではなく直接費を引いた後の粗利",
  });
  out.push({
    key: "w_u", symbol: "w_u", name: "支払上限と量産原価の下限",
    value: seed.first_customer_candidate ? `顧客候補: ${seed.first_customer_candidate}` : "未調査",
    filled: false, origin: "未調査",
    source: "この差が黒字で立つ用途が一つも無いと、経済性の乗数が下がり資金が付かなくなる",
  });

  return out;
}

/** 入力の充足の要約（画面の見出しに出す）。 */
export function inputSummary(inputs: Bzm30SeedInput[]): { filled: number; total: number; blockers: string[] } {
  const filled = inputs.filter((i) => i.filled).length;
  const blockers = inputs
    .filter((i) => !i.filled && (i.key === "P_bar" || i.key === "tau_proc" || i.key === "g0"))
    .map((i) => i.name);
  return { filled, total: inputs.length, blockers };
}
