import { formatMillionJpy } from "./bzm-2-2-pilot-ui.ts";

export type Bzm22DisplayValueContext = {
  projectId: string;
  projectName: string;
  parameterKey: string;
  unit: string;
};

const VALUE_LABELS: Record<string, string> = {
  JPY: "日本円",
  nominal: "名目値",
  real: "実質値",
  low: "慎重",
  base: "基準",
  high: "強気",
  true: "はい",
  false: "いいえ",
  registered: "登録済み",
  shadow_only: "比較計算のみ（実行承認なし）",
  company: "会社",
  company_economic: "会社の経済C/F",
  company_only: "会社視点",
  "company perspective": "会社視点",
  "registered policy path": "登録中の進め方",
  "selected-control-forward-path": "登録中の進め方に沿う将来経路",
  "pre-tax provisional": "税引前の暫定値",
  pre_tax: "税引前",
  current_integrated_policy: "現在の統合方針",
  staged_capital_light_policy: "段階投資・資本軽量方針",
  partner_or_license_alternative: "提携・ライセンス代替方針",
  continue_and_resolve_gates: "継続し、未解決条件を順に解消",
  continue_prototype_and_customer_validation: "試作と顧客検証を継続",
  fundraise_and_public_program_parallel: "資金調達と公的支援を並行",
  historical_terminal_closeout: "終了済み経路の履歴整理",
  prototype_or_pre_scale: "試作・量産準備前",
  "prototype_or_pre-scale": "試作・量産準備前",
  pre_incorporation: "設立前",
  "project/company management": "PJ・会社の経営陣",
  partial_or_unknown: "一部確認済み・残り未確認",
  partial_or_restricted: "一部確認済み・使途制限あり",
  unknown_or_partial: "未確認または一部確認",
  mixed: "確認水準が混在",
  partial: "一部確認済み",
  possible_not_confirmed: "実行可能性はあるが未確認",
  conditional_nonbinding: "条件付き・拘束力なし",
  not_required_for_immediate_step: "直近工程には不要",
  active_proxy_input: "計算に使う登録値",
  multiplicative_identity_audit_only: "監査用の中立値",
  mixed_document_and_imputation: "資料確認と推定を併用",
  structurally_not_computable: "構造上算出不可",
};

const EXACT_TEXT_LABELS: Record<string, string> = {
  "2.2-provisional-full-imputation": "BZM 2.2 暫定全項目推定版",
  "not_applicable_registered_current_control_shadow_only": "登録中の進め方を固定して評価（方針選択なし）",
  "not_applicable_no_argmax_shadow_only": "方針選択を行わないため同順位判定なし",
  "not aggregated in this company-perspective run": "会社視点のこの試算では集計対象外",
  "not_applicable_to_current_company_perspective: public fiscal and social benefit vectors remain separate": "会社視点の試算には合算せず、公的便益と社会便益を別に保持",
  "company/project controller": "会社・PJの意思決定主体",
  "project_board_or_authorized_management": "取締役会または権限を付与された経営陣",
  "company dynamic net project value subject to target and hard-failure contract": "目標条件と重大失敗条件の制約下で、会社の動的な正味PJ価値を評価",
  "maximize company-perspective dynamic net project value subject to cash, rights, authority and commitment constraints": "現金・権利・権限・相手方の確約を制約として、会社視点の動的な正味PJ価値を最大化",
  "five-source evidence via canonical OS refs": "AMD OS正規参照による5種類の根拠",
  "global Calendar/Notion inventories": "Calendar・Notionの全体台帳",
  "OS DB full table inventory": "AMD OS DBの全表台帳",
  "BRL; paid-PoC and cost evidence": "BRL。有償PoCとコスト根拠",
  "excluded from forward objective; retained only as disclosure": "将来評価には不算入。開示用にだけ保持",
  "company/university/board/counterparty authority checked per action; unknown is not executable": "会社・大学・取締役会・相手方の権限を行動ごとに確認。未確認の行動は実行不可",
  "board_or_delegated_management": "取締役会または委任を受けた経営陣",
  "counterparty and rights-holder consent remains action-specific": "相手方・権利者の同意は行動ごとに確認",
  "registered goal path reaches repeatable commercial/strategic success state": "登録経路が、反復可能な商用・戦略成功状態へ到達",
  "capital_self_reliance_or_license_or_failure": "資本面の自立・ライセンス・失敗のいずれかで終端",
  "multiple; canonical event level": "複数。個別相手はイベント台帳で確認",
  multiple: "複数の相手方",
  "native JPY; no FX": "日本円建て・為替換算なし",
  not_applicable_jpy: "日本円建てのため為替換算なし",
  "native-currency identity": "日本円をそのまま使用",
  "JPY-native": "日本円をそのまま使用",
  "transition_cf only; financing cash excluded; actual-grant cash is zero unless receipt observed": "状態遷移C/Fだけに算入。資金調達cashは除外し、助成金は入金を観測するまで0円",
  transition_cf_once: "状態遷移C/Fへ一度だけ算入",
  "economic CF only once": "経済C/Fへ一度だけ算入",
  "cash feasibility only; grant cash is economic only when newly received": "資金繰りの実行可能性だけに反映。助成金は新規入金を観測した時だけ経済C/Fへ算入",
  "opens only evidenced controls": "根拠を確認できた操作だけを実行可能にする",
  "none unless contracted price/quantity/royalty": "契約済みの価格・数量・ロイヤルティがない限り終端価値へ反映しない",
  "parallel where resource constraints are met": "資源制約を満たす範囲で並行実行",
  monthly_1_to_60: "M1〜M60の月次",
};

const KEY_LABELS: Record<string, string> = {
  trl: "TRL",
  brl: "BRL",
  grl: "GRL",
  srl: "SRL",
  hrl: "HRL",
  status: "状態",
  stage: "段階",
  bottleneck: "最大のネック",
  controller: "意思決定主体",
  openingUnrestrictedCash: "期首自由資金",
  openingRestrictedCash: "期首使途制限資金",
  minimumCash: "最低必要資金",
  noFinancingFirstCliffMonth: "資金調達なしで最初に資金不足となる月",
  probability: "確度",
  timing: "時期",
  amount: "金額",
  terms: "条件",
  opexModifier: "運営費倍率",
  capexModifier: "設備投資倍率",
  modifier: "終端価値倍率",
  evidenceStatus: "根拠状態",
  definition: "定義",
  firstPathLossMonth: "最初の経路喪失月",
  chronicDeclineSignal: "慢性的低下の信号",
  qStressProxy: "逆風耐久指数",
  authorityApprovedActionCount: "権限確認済み行動数",
  shadowActionCount: "比較計算だけの行動数",
  formula: "評価式",
  discountRate: "割引率",
  scenarioBundle: "前提ケース",
};

const GATE_LABELS: Record<string, string> = {
  real_effluent_reproducibility: "実廃液での再現性",
  paid_poc_and_unit_economics: "有償PoCと単位採算",
  company_rights_team_and_funding: "会社・権利・チーム・資金",
  repeatable_scaled_deployment: "反復可能なスケール展開",
  full_horizon_liquidity_package_proxy_before_first_cliff: "最初の資金不足前に全期間の資金を確保",
  cash_runway: "資金余力",
  rights_and_authority: "権利・権限",
  counterparty_commitment: "相手方の確約",
  technical_and_market_evidence: "技術・市場の根拠",
};

const TERM_LABELS: Record<string, string> = {
  "university-held project research award; not unrestricted company cash": "大学保有の研究費で、会社が自由に使える資金ではない",
  "multiple discussions including DD; no signed terms": "DDを含む複数協議。署名済み条件はない",
  "PoC/co-development path; no binding amount": "PoC・共同開発の経路。拘束力のある金額はない",
};

const FACT_LABELS: Record<string, string> = {
  "PSI GAP fund Step2 award total JPY78m observed; disbursement schedule missing": "PSI GAPファンド Step 2採択 ¥78Mは観測済み。入金日程は未確認",
  "reactor patent filed and real-effluent/cost validation progressing": "リアクター特許は出願済み。実廃液・コスト検証を継続中",
  "multiple PoC, corporate-development and VC paths documented; commitment levels remain heterogeneous": "複数のPoC・事業会社・VC経路は記録済み。確約水準にはばらつきがある",
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function formatRate(value: number) {
  return `${(value * 100).toFixed(value * 100 % 1 === 0 ? 0 : 1)}%`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function compactOriginal(value: unknown) {
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  if (!serialized) return "未登録";
  return serialized.length > 800 ? `${serialized.slice(0, 800)}…` : serialized;
}

function translateGate(value: string) {
  return GATE_LABELS[value] ?? value.replaceAll("_", "・");
}

function translateText(value: string, context: Bzm22DisplayValueContext) {
  if (VALUE_LABELS[value]) return VALUE_LABELS[value];
  if (EXACT_TEXT_LABELS[value]) return EXACT_TEXT_LABELS[value];
  if (TERM_LABELS[value]) return TERM_LABELS[value];
  if (FACT_LABELS[value]) return FACT_LABELS[value];
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return formatDate(value);
  if (/^sha256:[a-f0-9]+$/i.test(value)) return `${context.projectName}の入力スナップショット（照合ID ${value.slice(7, 15)}…）`;
  if ((context.parameterKey === "initial_state_id" || context.parameterKey === "state_id") && value.includes(":")) {
    const dateMatch = value.match(/(\d{4})-?(\d{2})-?(\d{2})$/);
    return `${context.projectName}・${dateMatch ? `${dateMatch[1]}年${dateMatch[2]}月${dateMatch[3]}日時点` : "評価日時点"}の状態`;
  }
  if (context.parameterKey === "model_id" && value === "BZM") return "BZM 2.2";
  if (context.parameterKey === "owner") return `${value}（評価対象PJ）`;
  if (context.parameterKey === "cashflow_event_id") return `${context.projectName}の集約経済C/F`;
  if (context.parameterKey === "economic_event_group_key") return `${context.projectName}の将来経済経路`;
  if (context.parameterKey === "intervention_id") return `${context.projectName}の支出連動状態遷移`;
  if (context.parameterKey === "tax_subject_ref" && value === "company/project controller") return "会社・PJの意思決定主体";
  if (/[ぁ-んァ-ヶ一-龠]/.test(value)) return value;
  return `原文: ${value}`;
}

function formatFundingItem(item: Record<string, unknown>, context: Bzm22DisplayValueContext) {
  const stage = String(item.stage ?? "未分類");
  const amount = typeof item.amount === "number" ? formatMillionJpy(item.amount) : "金額未登録";
  const timing = typeof item.timing === "string" ? item.timing.replace("..", "〜") : "時期未登録";
  const probability = typeof item.probability === "number" ? `確度${formatRate(item.probability)}` : "確度未登録";
  const stageLabel = context.projectId === "p21" && stage === "restricted_award" && item.amount === 78
    ? "PSI GAPファンド Step 2採択"
    : stage === "restricted_award"
      ? "使途制限付き助成金・研究費"
      : stage === "vc_dd"
        ? "VC DD"
        : stage === "corporate_codevelopment"
          ? "共同開発"
          : translateText(stage, context);
  const terms = typeof item.terms === "string" ? `（${translateText(item.terms, context)}）` : "";
  return `${stageLabel}：${amount}・${timing}・${probability}${terms}`;
}

function formatStateVector(value: Record<string, unknown>, context: Bzm22DisplayValueContext) {
  const parts: string[] = [];
  for (const [key, raw] of Object.entries(value)) {
    if (key === "facts" || key === "evidence") {
      const facts = Array.isArray(raw) ? raw.map((entry) => translateText(String(entry), context)).join("／") : compactOriginal(raw);
      parts.push(`根拠: ${facts}`);
      continue;
    }
    if (key === "gateProbabilities" && Array.isArray(raw)) {
      parts.push(raw.filter(isRecord).map((gate) => {
        const label = translateGate(String(gate.key ?? "条件"));
        const base = typeof gate.base === "number" ? formatRate(gate.base) : "未登録";
        return `${label} ${base}`;
      }).join("／"));
      continue;
    }
    const label = KEY_LABELS[key] ?? translateGate(key);
    if (typeof raw === "number") parts.push(`${label} ${raw}`);
    else if (typeof raw === "boolean") parts.push(`${label} ${raw ? "あり" : "なし"}`);
    else if (typeof raw === "string") parts.push(`${label} ${translateText(raw, context)}`);
    else parts.push(`${label} ${compactOriginal(raw)}`);
  }
  return parts.join("／");
}

function formatCashState(value: Record<string, unknown>) {
  const unrestricted = typeof value.openingUnrestrictedCash === "number" ? formatMillionJpy(value.openingUnrestrictedCash) : "未登録";
  const restricted = typeof value.openingRestrictedCash === "number" ? formatMillionJpy(value.openingRestrictedCash) : "未登録";
  const minimum = typeof value.minimumCash === "number" ? formatMillionJpy(value.minimumCash) : "未登録";
  const cliff = typeof value.noFinancingFirstCliffMonth === "number" ? `M${value.noFinancingFirstCliffMonth}` : "未登録";
  return `期首自由資金 ${unrestricted}／期首使途制限資金 ${restricted}／最低必要資金 ${minimum}／資金調達なしの最初の資金不足 ${cliff}`;
}

function formatConstraintVector(value: unknown[], context: Bzm22DisplayValueContext) {
  return value.filter(isRecord).map((constraint) => {
    const label = translateGate(String(constraint.key ?? "制約"));
    const margin = isRecord(constraint.margin) ? constraint.margin : {};
    const base = margin.base;
    const unit = margin.unit === "months" ? "か月" : margin.unit === "confirmed-path count" ? "経路" : margin.unit === "registered gates remaining" ? "条件" : "段階";
    const status = typeof constraint.status === "string" ? translateText(constraint.status, context) : "状態未登録";
    return `${label} ${typeof base === "number" ? `${base}${unit}` : "未登録"}（${status}）`;
  }).join("／");
}

function formatTypedEffect(value: unknown[], context: Bzm22DisplayValueContext) {
  if (context.parameterKey === "funding_effect" || context.parameterKey === "financing_status") {
    return value.filter(isRecord).map((item) => formatFundingItem(item, context)).join("／");
  }
  return value.map((entry) => {
    if (!isRecord(entry)) return translateText(String(entry), context);
    if (context.parameterKey === "cost_effect") {
      return `${translateText(String(entry.id ?? "方針"), context)}：運営費${entry.opexModifier ?? "—"}倍・設備投資${entry.capexModifier ?? "—"}倍`;
    }
    if (context.parameterKey === "action_set_effect") {
      return `${translateText(String(entry.id ?? "方針"), context)}：${translateText(String(entry.availability ?? "未登録"), context)}`;
    }
    if (context.parameterKey === "terminal_effect") {
      return `${translateText(String(entry.id ?? "方針"), context)}：終端価値${entry.modifier ?? "—"}倍`;
    }
    if (context.parameterKey === "information_effect") {
      return `${translateGate(String(entry.key ?? "条件"))}：${translateText(String(entry.evidenceStatus ?? "未登録"), context)}`;
    }
    if (context.parameterKey === "transition_effect") {
      const deltas = isRecord(entry.stateDelta)
        ? Object.entries(entry.stateDelta).map(([key, raw]) => `${key} ${typeof raw === "number" && raw >= 0 ? "+" : ""}${raw}`).join("・")
        : compactOriginal(entry.stateDelta);
      return `${translateGate(String(entry.key ?? "条件"))}：${deltas}`;
    }
    return formatStateVector(entry, context);
  }).join("／");
}

function formatArray(value: unknown[], context: Bzm22DisplayValueContext): string {
  if (value.length === 0) return "なし";
  if (context.parameterKey === "financing_status" || context.unit === "typed_effect_spec") return formatTypedEffect(value, context);
  if (context.unit === "constraint_vector") return formatConstraintVector(value, context);
  if (context.parameterKey === "source_ref") {
    const os = value.filter((entry) => String(entry).startsWith("os_db:")).length;
    const calendar = value.filter((entry) => String(entry).startsWith("calendar:")).length;
    const drive = value.filter((entry) => String(entry).startsWith("drive:")).length;
    return `正規参照 ${value.length}件（AMD OS ${os}件・Calendar ${calendar}件${drive ? `・Drive ${drive}件` : ""}）`;
  }
  if (context.parameterKey === "timing" && value.length > 0) {
    return `${value[0]}〜${value.at(-1)}（${value.length}か月）`;
  }
  if (context.parameterKey === "cashflow_event_id") return `${context.projectName}の月次経済C/F ${value.length}件（M1〜M${value.length}）`;
  if (context.parameterKey === "economic_event_group_key") return `${context.projectName}の月次経済イベント ${value.length}か月（M1〜M${value.length}）`;
  if ((context.parameterKey === "transition_cf" || context.parameterKey === "model_amount_million_jpy") && value.every((entry) => typeof entry === "number")) {
    const numbers = value as number[];
    const total = numbers.reduce((sum, entry) => sum + entry, 0);
    return `${numbers.length}か月：M1 ${formatMillionJpy(numbers[0])} → M${numbers.length} ${formatMillionJpy(numbers.at(-1) ?? 0)}／単純合計 ${formatMillionJpy(total)}`;
  }
  if (context.parameterKey === "sequence") {
    return value.filter(isRecord).map((entry) => `${translateGate(String(entry.gate ?? "条件"))}（M${entry.month ?? "—"}）`).join(" → ");
  }
  if (context.parameterKey === "p_phys") {
    return value.filter(isRecord).map((entry) => {
      const probability = typeof entry.conditionalProbability === "number" ? formatRate(entry.conditionalProbability) : "未登録";
      return `${translateGate(String(entry.gateKey ?? "条件"))} ${probability}・M${entry.month ?? "—"}`;
    }).join("／");
  }
  if (context.parameterKey === "information_gain") {
    return value.filter(isRecord).map((entry) => `${translateGate(String(entry.gateKey ?? "条件"))}の判定情報`).join("／");
  }
  if (context.parameterKey === "transition_id" || context.parameterKey === "next_state_id") {
    const labels = value.map((entry) => String(entry).split(":").at(-2) ?? String(entry)).map(translateGate);
    return `${context.projectName}の状態遷移 ${labels.join(" → ")}`;
  }
  if (context.parameterKey === "action_id_bundle_id" || context.parameterKey === "custom_components" || context.parameterKey === "intervention_id") {
    return value.map((entry) => translateText(String(entry), context)).join("／");
  }
  if (context.parameterKey === "component_kinds") {
    const labels: Record<string, string> = { "technical validation": "技術検証", "market validation": "市場検証", funding: "資金", "rights/team": "権利・チーム", "information acquisition": "情報獲得" };
    return value.map((entry) => labels[String(entry)] ?? translateText(String(entry), context)).join("／");
  }
  if (context.parameterKey === "shared_resources") {
    const labels: Record<string, string> = { "management attention": "経営陣の注意資源", "researcher time": "研究者の時間", equipment: "設備", cash: "現金" };
    return value.map((entry) => labels[String(entry)] ?? translateText(String(entry), context)).join("／");
  }
  if (value.every((entry) => typeof entry !== "object")) {
    const formatted = value.map((entry) => formatBzm22RegisteredValue(entry, context));
    if (formatted.length <= 8) return formatted.join("、");
    return `${formatted.slice(0, 4).join("、")} … ${formatted.at(-1)}（全${formatted.length}件）`;
  }
  return value.map((entry) => isRecord(entry) ? formatStateVector(entry, context) : compactOriginal(entry)).join("／");
}

function formatObject(value: Record<string, unknown>, context: Bzm22DisplayValueContext) {
  if (context.parameterKey === "cash_state") return formatCashState(value);
  if (context.parameterKey === "valuation_rule") {
    const rate = typeof value.discountRate === "number" ? formatRate(value.discountRate) : "未登録";
    return `会社の経済C/F（資金調達による現金を除外）を年率${rate}で割り引き、条件通過と終端価値を評価（${translateText(String(value.scenarioBundle ?? "base"), context)}ケース）`;
  }
  if (["technical_state", "manufacturing_state", "market_state", "rights_state", "organization_state", "public_social_benefit_vector", "belief_state"].includes(context.parameterKey)) {
    return formatStateVector(value, context);
  }
  if (["q_plan_pi0_Hv", "V_r_pi0", "Omega_d", "Delta_V_r_given_d"].includes(context.parameterKey) && value.status === "structurally_not_computable") {
    return "反実仮想の基準方針が未登録のため構造上算出不可。登録値から逆算・創作しない";
  }
  if (context.parameterKey === "slack_state") {
    const constraints = Array.isArray(value.constraintMargins) ? formatConstraintVector(value.constraintMargins, context) : "制約未登録";
    const stress = typeof value.qStressProxy === "number" ? formatRate(value.qStressProxy) : "未登録";
    return `制約余力: ${constraints}／逆風耐久指数 ${stress}／最初の経路喪失 M${value.firstPathLossMonth ?? "—"}／権限確認済み ${value.authorityApprovedActionCount ?? 0}件`;
  }
  return formatStateVector(value, context);
}

export function formatBzm22RegisteredValue(value: unknown, context: Bzm22DisplayValueContext): string {
  if (value === null || value === undefined || value === "") return "未登録";
  if (typeof value === "boolean") return value ? "はい" : "いいえ";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "未登録";
    if (/million_jpy/i.test(context.unit)) return formatMillionJpy(value);
    if (/probability|annual_decimal|decimal/i.test(context.unit)) return formatRate(value);
    const unitLabel = context.unit === "months" ? "か月" : context.unit === "count" ? "件" : "";
    return `${new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 4 }).format(value)}${unitLabel}`;
  }
  if (typeof value === "string") return translateText(value, context);
  if (Array.isArray(value)) return formatArray(value, context);
  if (isRecord(value)) return formatObject(value, context);
  return `原文: ${compactOriginal(value)}`;
}
