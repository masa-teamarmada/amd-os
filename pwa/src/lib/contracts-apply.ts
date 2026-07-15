import type { SupabaseClient } from "@supabase/supabase-js";
import { parseSeasonBufferTotal } from "@/lib/finance/season-finance";
import { termsHaveOperationalDetail } from "@/lib/project-contract-terms";

/**
 * Contract Apply — contract_terms (status='applied') を契約正本とOSの3層に書き戻す。
 *
 *   ⓪ contracts.operational_terms_json     … 契約単位の実務条件正本 / AMD当事者確認
 *   ① projects.contract_terms_json         … 契約メタ正本 (月額 / 期間 / pool / cap / 出典)
 *   ② projects.fee_type / fee_amount / start_ym / end_ym … 月次収支シミュレータの固定収益入力
 *   ③ billing_cycles.budget_yen (+ contract 由来であることの印)        … 月別PJ予算 / 変動契約の月別売上根拠
 *
 * 正本 spec: pwa/spec/5-6-contracts-management-current-spec.md「契約抽出 → projects / billing_cycles 反映 (Contract Apply)」。
 *
 * 設計の肝:
 * - applied にしたのは人 (admin が /admin/contracts でレビュー) なので「金額の出所は契約」と保証される。
 *   Contract Apply は applied term の値を機械的に正本へ流すだけ。恣意的な数学操作はしない。
 * - NDA等の terms_only は ⓪① だけを更新し、PJの料金・期間・請求cycleを変更しない。
 * - 売上契約は end_ym を必ず設定する (CX 無期限計上事故の再発防止)。monthly_fixed で end_ym=null を残さない。
 * - schedule_based / 月別金額が違う契約は ② の一律額にせず ③ の月別 budget_yen に展開する。
 * - monthly_fixed でも、既存の一括生成行に売上額が残らないよう、未確定の月別PJ予算と現行 plan cycle 原資を契約 cap へ整合する。
 * - 月別 budget_yen は contract_terms の reward_cap_yen をそのまま使う (= 請求額 税抜 × 0.65 相当)。
 *   billing_distribution_json に reward_cap_yen が無い場合だけ round(amount_tax_excl * 0.65) で補う。
 */

export const REWARD_RATE = 0.65;

export type ContractMonthlyPlan = {
  ym: string;
  /** 請求額 (税抜) = OS 上の売上。billing_cycles.budget_reported_amount に入る額 */
  amountTaxExcl: number;
  /** PJ 予算 = 報酬原資 = budget_yen。請求額 × 0.65 が基本 */
  budgetYen: number;
};

export type ContractApplyPlan = {
  projectId: string;
  termId: string;
  contractId: string | null;
  /** terms_only はPJの料金・期間・請求cycleを変更せず、実務条件だけを反映する。 */
  mode: "monthly_fixed" | "schedule_based" | "terms_only";
  /** ② projects 列 */
  feeType: "monthly_fixed" | "variable" | null;
  feeAmount: number | null;
  startYm: string | null;
  endYm: string | null;
  /** ① contract_terms_json に畳む値 */
  contractTermsJson: Record<string, unknown>;
  /** ③ 月別 billing_cycles 反映行 (schedule_based は売上根拠も兼ねる) */
  monthly: ContractMonthlyPlan[];
  /** monthly_fixed の未確定 billing_cycles / plan cycle を契約 cap へ整合する行 */
  monthlyFixedBudgetRows: ContractMonthlyPlan[];
  warnings: string[];
};

type AppliedTermRow = {
  term_id: string;
  contract_id: string | null;
  project_id: string;
  contract_title: string | null;
  counterparty_name: string | null;
  source_title: string | null;
  source_url: string | null;
  contract_no: string | null;
  quote_no: string | null;
  period_start_ym: string | null;
  period_end_ym: string | null;
  amount_tax_excl: number | string | null;
  amount_tax_incl: number | string | null;
  billing_distribution: string | null;
  fee_type_hint: string | null;
  billing_distribution_json: Record<string, unknown> | null;
  extracted_terms_json: Record<string, unknown> | null;
  status: string | null;
};

function num(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function text(value: unknown, maxLength = 240) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maxLength) : "";
}

function optionalText(value: unknown, maxLength = 240) {
  const normalized = text(value, maxLength);
  return normalized || null;
}

function booleanOrNull(value: unknown): boolean | null {
  if (value === true || value === "true" || value === "あり" || value === "可" || value === "yes") return true;
  if (value === false || value === "false" || value === "なし" || value === "不可" || value === "no") return false;
  return null;
}

function ymToInt(ym: string): number {
  return /^\d{6}$/.test(ym) ? Number(ym) : 0;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function hasContractReserveBuffer(contractTermsJson: unknown): boolean {
  const terms = asRecord(contractTermsJson);
  return num(
    terms.companyReserveBufferYen ??
      terms.company_reserve_buffer_yen ??
      terms.reserveBufferYen ??
      terms.reserve_buffer_yen,
  ) > 0;
}

function isMutableBillingStatus(status: string | null | undefined): boolean {
  return !status || status === "not_started";
}

/** start..end (inclusive) の ym 列を返す */
export function enumerateYms(startYm: string, endYm: string): string[] {
  if (!/^\d{6}$/.test(startYm) || !/^\d{6}$/.test(endYm)) return [];
  const out: string[] = [];
  let y = Number(startYm.slice(0, 4));
  let m = Number(startYm.slice(4, 6));
  const endY = Number(endYm.slice(0, 4));
  const endM = Number(endYm.slice(4, 6));
  // 安全弁: 最大 120 ヶ月
  for (let guard = 0; guard < 120; guard += 1) {
    const ym = `${y}${String(m).padStart(2, "0")}`;
    out.push(ym);
    if (y > endY || (y === endY && m >= endM)) break;
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return out;
}

type MonthlyEntry = { ym?: string; amount_tax_excl?: unknown; reward_cap_yen?: unknown; budget_yen?: unknown };

/**
 * applied term から 3 層反映プランを純粋関数で導出する。DB は触らない (テスト可能性のため)。
 * 値の出所は applied term だけ。ここで金額を作り変えない。
 */
export function deriveContractApplyPlan(term: AppliedTermRow): ContractApplyPlan | { error: string } {
  if (term.status !== "applied") {
    return { error: `term ${term.term_id} は status='${term.status}' (applied のみ反映可)` };
  }
  const projectId = term.project_id;
  const dist = (term.billing_distribution || "review_required").toLowerCase();
  const feeHint = (term.fee_type_hint || "unknown").toLowerCase();
  const bdj = (term.billing_distribution_json || {}) as Record<string, unknown>;
  const extractedTerms = (term.extracted_terms_json || {}) as Record<string, unknown>;
  const warnings: string[] = [];

  // 期間。term の period_*_ym を最優先、無ければ billing_distribution_json の months から導出
  const monthlyArr = Array.isArray(bdj.monthly) ? (bdj.monthly as MonthlyEntry[]) : [];
  const monthsFromArr = monthlyArr.map((e) => String(e.ym || "")).filter((ym) => /^\d{6}$/.test(ym));
  const startYm = term.period_start_ym || monthsFromArr[0] || "";
  const endYm = term.period_end_ym || monthsFromArr[monthsFromArr.length - 1] || "";

  const contractTermsBase: Record<string, unknown> = {
    contractStartYm: startYm || null,
    contractEndYm: endYm || null,
    billingStartYm: startYm || null,
    renewalType: optionalText(extractedTerms.renewal_type ?? extractedTerms.renewalType, 1000),
    sourceTitle: term.source_title || term.contract_title || null,
    sourceRef: `contract_terms:${term.term_id}`,
    sourceUrl: term.source_url || null,
    counterpartyName: term.counterparty_name || null,
    contractNo: term.contract_no || null,
    quoteNo: term.quote_no || null,
    paymentTerms: optionalText(extractedTerms.payment_terms ?? extractedTerms.paymentTerms, 1000),
    taxTreatment: optionalText(extractedTerms.tax_treatment ?? extractedTerms.taxTreatment, 1000),
    scopeSummary: optionalText(extractedTerms.scope_summary ?? extractedTerms.scopeSummary, 1000),
    deliverablesRequired: booleanOrNull(extractedTerms.deliverables_required ?? extractedTerms.deliverablesRequired),
    deliverablesNote: optionalText(extractedTerms.deliverables_note ?? extractedTerms.deliverablesNote, 1000),
    acceptanceTerms: optionalText(extractedTerms.acceptance_terms ?? extractedTerms.acceptanceTerms, 1000),
    monthlyReportSubmissionRule: optionalText(
      extractedTerms.monthly_report_submission_rule ?? extractedTerms.monthlyReportSubmissionRule,
    ),
    monthlyReportSubmissionTiming: optionalText(
      extractedTerms.monthly_report_submission_timing ?? extractedTerms.monthlyReportSubmissionTiming,
    ),
    monthlyReportSubmissionDeadline: optionalText(
      extractedTerms.monthly_report_submission_deadline ?? extractedTerms.monthlyReportSubmissionDeadline,
    ),
    monthlyReportSubmissionFormat: optionalText(
      extractedTerms.monthly_report_submission_format ?? extractedTerms.monthlyReportSubmissionFormat,
    ),
    monthlyReportSubmissionRequiredItems: optionalText(
      extractedTerms.monthly_report_submission_required_items ?? extractedTerms.monthlyReportSubmissionRequiredItems,
    ),
    monthlyReportSubmissionNote: optionalText(
      extractedTerms.monthly_report_submission_note ?? extractedTerms.monthlyReportSubmissionNote,
    ),
    expenseReimbursementAllowed: booleanOrNull(
      extractedTerms.expense_reimbursement_allowed ?? extractedTerms.expenseReimbursementAllowed,
    ),
    expenseReimbursementNote: optionalText(
      extractedTerms.expense_reimbursement_note ?? extractedTerms.expenseReimbursementNote,
    ),
    ipOwnership: optionalText(extractedTerms.ip_ownership ?? extractedTerms.ipOwnership, 1000),
    usageRights: optionalText(extractedTerms.usage_rights ?? extractedTerms.usageRights, 1000),
    publicityRights: optionalText(extractedTerms.publicity_rights ?? extractedTerms.publicityRights, 1000),
    confidentialitySummary: optionalText(
      extractedTerms.confidentiality_summary ?? extractedTerms.confidentialitySummary,
      1000,
    ),
    confidentialitySurvival: optionalText(
      extractedTerms.confidentiality_survival ?? extractedTerms.confidentialitySurvival,
      1000,
    ),
    subcontractingTerms: optionalText(
      extractedTerms.subcontracting_terms ?? extractedTerms.subcontractingTerms,
      1000,
    ),
    exclusivityTerms: optionalText(extractedTerms.exclusivity_terms ?? extractedTerms.exclusivityTerms, 1000),
    terminationTerms: optionalText(extractedTerms.termination_terms ?? extractedTerms.terminationTerms, 1000),
    liabilityTerms: optionalText(extractedTerms.liability_terms ?? extractedTerms.liabilityTerms, 1000),
    governingLawJurisdiction: optionalText(
      extractedTerms.governing_law_jurisdiction ?? extractedTerms.governingLawJurisdiction,
      1000,
    ),
    specialTerms: optionalText(extractedTerms.special_terms ?? extractedTerms.specialTerms, 1000),
    appliedAt: new Date().toISOString(),
  };

  if (!/^\d{6}$/.test(startYm) || !/^\d{6}$/.test(endYm)) {
    if (!termsHaveOperationalDetail(contractTermsBase)) {
      return { error: `term ${term.term_id} に契約期間 (period_start_ym/period_end_ym) がなく、反映できる実務条件も無い` };
    }
    return {
      projectId,
      termId: term.term_id,
      contractId: term.contract_id,
      mode: "terms_only",
      feeType: null,
      feeAmount: null,
      startYm: null,
      endYm: null,
      contractTermsJson: {
        ...contractTermsBase,
        amountTaxExclTotal: num(term.amount_tax_excl) || null,
        amountTaxInclTotal: num(term.amount_tax_incl) || null,
        billingDistribution: "terms_only",
        notes: "Contract Apply (terms_only) 実務条件のみ反映",
      },
      monthly: [],
      monthlyFixedBudgetRows: [],
      warnings: ["契約期間または金額が未確定のため、PJ料金・期間・請求cycleは変更していない"],
    };
  }
  if (ymToInt(endYm) < ymToInt(startYm)) {
    return { error: `term ${term.term_id} の period_end_ym(${endYm}) < period_start_ym(${startYm})` };
  }

  // ── schedule_based: 月別に金額が違う → ③ 月別 budget_yen 展開、② は variable ──
  if (dist === "schedule_based" || (monthlyArr.length > 0 && dist !== "monthly_average")) {
    if (monthlyArr.length === 0) {
      return { error: `term ${term.term_id} は schedule_based だが billing_distribution_json.monthly が空` };
    }
    const monthly: ContractMonthlyPlan[] = [];
    for (const e of monthlyArr) {
      const ym = String(e.ym || "");
      if (!/^\d{6}$/.test(ym)) continue;
      const amountTaxExcl = num(e.amount_tax_excl);
      const budgetYen = e.reward_cap_yen != null ? num(e.reward_cap_yen)
        : e.budget_yen != null ? num(e.budget_yen)
        : Math.round(amountTaxExcl * REWARD_RATE);
      monthly.push({ ym, amountTaxExcl, budgetYen });
    }
    if (monthly.length === 0) {
      return { error: `term ${term.term_id} schedule_based: 有効な月別行が無い` };
    }
    const rewardPool = num(bdj.total_reward_cap_yen) || monthly.reduce((s, m) => s + m.budgetYen, 0);
    return {
      projectId,
      termId: term.term_id,
      contractId: term.contract_id,
      mode: "schedule_based",
      feeType: "variable",
      feeAmount: null,
      startYm,
      endYm,
      contractTermsJson: {
        ...contractTermsBase,
        monthlyFeeYen: null,
        rewardPoolYen: rewardPool || null,
        monthlyRewardCapYen: null,
        monthlySchedule: monthly.map((m) => ({ ym: m.ym, budgetYen: m.budgetYen, amountTaxExcl: m.amountTaxExcl })),
        amountTaxExclTotal: num(term.amount_tax_excl) || monthly.reduce((s, m) => s + m.amountTaxExcl, 0),
        amountTaxInclTotal: num(term.amount_tax_incl) || null,
        billingDistribution: "schedule_based",
        notes: (bdj.basis ? `billing: ${String(bdj.basis)}. ` : "") + "Contract Apply (schedule_based) 自動反映",
      },
      monthly,
      monthlyFixedBudgetRows: [],
      warnings,
    };
  }

  // ── monthly_fixed / monthly_average: 毎月同額 → ② に固定収益、③ は触らない ──
  const months = enumerateYms(startYm, endYm);
  let monthlyFee = num(bdj.monthly_tax_excl);
  if (monthlyFee <= 0) {
    // 期間総額 / 月数 で月割 (contract_total など)
    const total = num(term.amount_tax_excl);
    if (total > 0 && months.length > 0) {
      monthlyFee = Math.round(total / months.length);
      warnings.push(`monthly_tax_excl が無いので 総額 ${total} / ${months.length}ヶ月 = ${monthlyFee} で月割`);
    }
  }
  if (monthlyFee <= 0) {
    return { error: `term ${term.term_id} monthly_fixed: 月額 (monthly_tax_excl or 総額/月数) を導出できない` };
  }
  if (feeHint !== "monthly_fixed" && feeHint !== "contract_total" && dist !== "monthly_average") {
    warnings.push(`fee_type_hint='${feeHint}' / billing_distribution='${dist}' を monthly_fixed として反映`);
  }
  const monthlyCap = num(bdj.monthly_payout_cap_65) || Math.round(monthlyFee * REWARD_RATE);
  const rewardPool = monthlyCap * months.length;
  const monthlyFixedBudgetRows = months.map((ym) => ({
    ym,
    amountTaxExcl: monthlyFee,
    budgetYen: monthlyCap,
  }));

  return {
    projectId,
    termId: term.term_id,
    contractId: term.contract_id,
    mode: "monthly_fixed",
    feeType: "monthly_fixed",
    feeAmount: monthlyFee,
    startYm,
    endYm,
    contractTermsJson: {
      ...contractTermsBase,
      monthlyFeeYen: monthlyFee,
      rewardPoolYen: rewardPool || null,
      monthlyRewardCapYen: monthlyCap || null,
      amountTaxExclTotal: num(term.amount_tax_excl) || monthlyFee * months.length,
      amountTaxInclTotal: num(term.amount_tax_incl) || null,
      billingDistribution: "monthly_fixed",
      notes: "Contract Apply (monthly_fixed) 自動反映",
    },
    monthly: [],
    monthlyFixedBudgetRows,
    warnings,
  };
}

export type ContractApplyResult = {
  projectId: string;
  termId: string;
  mode: ContractApplyPlan["mode"];
  feeType: string | null;
  startYm: string | null;
  endYm: string | null;
  monthlyApplied: number;
  monthlyFixedBudgetApplied: number;
  planCyclesReconciled: number;
  warnings: string[];
};

/**
 * deriveContractApplyPlan の結果を実際の契約正本とPJ/請求へ書き戻す。
 * billing_cycles は upsert (project_id, ym)。既に budget_confirmed 済みの月は budget_yen を上書きしない
 * (人が確定した請求額確定を契約 apply で巻き戻さない)。
 */
export async function applyContractTerms(
  db: SupabaseClient,
  termId: string,
  actor: string,
): Promise<ContractApplyResult> {
  const { data: term, error: termErr } = await db
    .from("contract_terms")
    .select(
      "term_id, contract_id, project_id, contract_title, counterparty_name, source_title, source_url, contract_no, quote_no, period_start_ym, period_end_ym, amount_tax_excl, amount_tax_incl, billing_distribution, fee_type_hint, billing_distribution_json, extracted_terms_json, status",
    )
    .eq("term_id", termId)
    .maybeSingle();
  if (termErr) throw termErr;
  if (!term) throw new Error(`contract_terms ${termId} が見つからない`);

  const plan = deriveContractApplyPlan(term as AppliedTermRow);
  if ("error" in plan) throw new Error(plan.error);

  const now = new Date().toISOString();
  const { data: existingProject, error: existingProjectErr } = await db
    .from("projects")
    .select("contract_terms_json")
    .eq("project_id", plan.projectId)
    .maybeSingle();
  if (existingProjectErr) throw existingProjectErr;
  const currentContractTerms = asRecord((existingProject as { contract_terms_json?: unknown } | null)?.contract_terms_json);
  const verifiedTerms = {
    ...plan.contractTermsJson,
    verifiedAt: now,
    verifiedBy: actor,
  };
  let currentContract: Record<string, unknown> | null = null;
  if (plan.contractId) {
    const contractPatch: Record<string, unknown> = {
      relationship_scope: "amd_contract",
      is_current_for_project: true,
      registry_status: "accepted",
      review_required: false,
      review_status: "accepted",
      amd_entity_name: "株式会社チームアルマダ",
      party_confirmation_note: "Contract Applyで当事者・条件をレビュー済み",
      party_confirmed_at: now,
      party_confirmed_by: actor,
      operational_terms_json: verifiedTerms,
      updated_by: actor,
      updated_at: now,
    };
    if (term.contract_title) contractPatch.canonical_title = term.contract_title;
    if (term.counterparty_name) contractPatch.counterparty_name = term.counterparty_name;
    const { data: updatedContract, error: contractErr } = await db
      .from("contracts")
      .update(contractPatch)
      .eq("contract_id", plan.contractId)
      .select("contract_id,canonical_title,contract_title,contract_type,status,counterparty_name,effective_date,expiration_date,renewal_type,renewal_notice_date")
      .maybeSingle();
    if (contractErr) throw contractErr;
    if (updatedContract) {
      currentContract = {
        contractId: updatedContract.contract_id,
        title: updatedContract.canonical_title || updatedContract.contract_title,
        contractType: updatedContract.contract_type,
        status: updatedContract.status,
        signatureStatus: updatedContract.status === "signed" ? "押印済み記録" : "署名完了は未確認",
        counterpartyName: updatedContract.counterparty_name,
        effectiveDate: updatedContract.effective_date,
        expirationDate: updatedContract.expiration_date,
        renewalType: updatedContract.renewal_type,
        renewalNoticeDate: updatedContract.renewal_notice_date,
        terms: verifiedTerms,
      };
    }
  }
  const existingCurrentContracts = Array.isArray(currentContractTerms.currentContracts)
    ? currentContractTerms.currentContracts.filter((item) => item && typeof item === "object") as Array<Record<string, unknown>>
    : [];
  const currentContracts = currentContract
    ? [
        ...existingCurrentContracts.filter((item) => item.contractId !== plan.contractId),
        currentContract,
      ]
    : existingCurrentContracts;
  const mergedContractTermsJson = {
    ...currentContractTerms,
    ...verifiedTerms,
    ...(currentContract ? { currentContracts } : {}),
  };

  // ① + ② projects 更新
  const projectsPatch: Record<string, unknown> = {
    contract_terms_json: mergedContractTermsJson,
    updated_at: now,
  };
  if (plan.mode !== "terms_only") {
    projectsPatch.fee_type = plan.feeType;
    projectsPatch.fee_amount = plan.feeType === "monthly_fixed" ? plan.feeAmount : null;
    projectsPatch.start_ym = plan.startYm;
    projectsPatch.end_ym = plan.endYm; // 売上契約は必ず設定 (無期限計上事故防止)
  }
  const { error: projErr } = await db.from("projects").update(projectsPatch).eq("project_id", plan.projectId);
  if (projErr) throw projErr;

  // ③ billing_cycles 月別 (schedule_based のみ)
  let monthlyApplied = 0;
  if (plan.monthly.length > 0) {
    // 既存 cycle の status を引いて、確定済み月は budget_yen を上書きしない
    const { data: existing, error: exErr } = await db
      .from("billing_cycles")
      .select("ym, status")
      .eq("project_id", plan.projectId)
      .in("ym", plan.monthly.map((m) => m.ym));
    if (exErr) throw exErr;
    const lockedYms = new Set(
      (existing ?? [])
        .filter((r: { status: string | null }) =>
          ["budget_confirmed", "allocation_confirmed", "invoice_sent", "payment_confirmed"].includes(r.status || ""))
        .map((r: { ym: string }) => r.ym),
    );

    const rows = plan.monthly
      .filter((m) => !lockedYms.has(m.ym))
      .map((m) => ({
        project_id: plan.projectId,
        ym: m.ym,
        budget_yen: m.budgetYen,
        contract_source_term_id: plan.termId,
        updated_at: now,
      }));
    if (rows.length > 0) {
      const { error: bcErr } = await db
        .from("billing_cycles")
        .upsert(rows, { onConflict: "project_id,ym" });
      if (bcErr) throw bcErr;
      monthlyApplied = rows.length;
    }
  }

  let monthlyFixedBudgetApplied = 0;
  let planCyclesReconciled = 0;
  const shouldReconcileMonthlyFixed = plan.mode === "monthly_fixed"
    && plan.monthlyFixedBudgetRows.length > 0
    && !hasContractReserveBuffer(mergedContractTermsJson);

  if (shouldReconcileMonthlyFixed) {
    const budgetByYm = new Map(plan.monthlyFixedBudgetRows.map((m) => [m.ym, m.budgetYen]));
    const { data: existingCycles, error: fixedCycleErr } = await db
      .from("billing_cycles")
      .select("ym, status, budget_yen")
      .eq("project_id", plan.projectId)
      .in("ym", plan.monthlyFixedBudgetRows.map((m) => m.ym));
    if (fixedCycleErr) throw fixedCycleErr;

    const lockedMismatches = ((existingCycles ?? []) as Array<{ ym: string; status: string | null; budget_yen: unknown }>)
      .filter((cycle) => !isMutableBillingStatus(cycle.status))
      .filter((cycle) => num(cycle.budget_yen) !== (budgetByYm.get(cycle.ym) ?? 0));
    if (lockedMismatches.length > 0) {
      const detail = lockedMismatches
        .map((cycle) => `${cycle.ym}: ${num(cycle.budget_yen)} != ${budgetByYm.get(cycle.ym) ?? 0}`)
        .join(", ");
      throw new Error(`monthly_fixed 契約 cap と確定済み billing_cycles が不一致のため反映不可: ${detail}`);
    }

    const mutableYms = new Set(
      ((existingCycles ?? []) as Array<{ ym: string; status: string | null }>)
        .filter((cycle) => isMutableBillingStatus(cycle.status))
        .map((cycle) => cycle.ym),
    );
    const existingYms = new Set(((existingCycles ?? []) as Array<{ ym: string }>).map((cycle) => cycle.ym));
    const fixedRows = plan.monthlyFixedBudgetRows
      .filter((m) => mutableYms.has(m.ym) || !existingYms.has(m.ym))
      .map((m) => ({
        project_id: plan.projectId,
        ym: m.ym,
        status: "not_started",
        budget_yen: m.budgetYen,
        budget_buffer_amount: 0,
        contract_source_term_id: null,
        updated_at: now,
      }));
    if (fixedRows.length > 0) {
      const { error: fixedUpsertErr } = await db
        .from("billing_cycles")
        .upsert(fixedRows, { onConflict: "project_id,ym" });
      if (fixedUpsertErr) throw fixedUpsertErr;
      monthlyFixedBudgetApplied = fixedRows.length;
    }

    const { data: planCycles, error: planCycleErr } = await db
      .from("value_plan_cycles")
      .select("plan_cycle_id, period_start_ym, period_end_ym, status, budget_yen, buffer_breakdown_json")
      .eq("project_id", plan.projectId)
      .in("status", ["active", "confirmed", "draft"]);
    if (planCycleErr) throw planCycleErr;

    for (const cycle of (planCycles ?? []) as Array<{
      plan_cycle_id: string;
      period_start_ym: string | null;
      period_end_ym: string | null;
      budget_yen: unknown;
      buffer_breakdown_json: unknown;
    }>) {
      const start = cycle.period_start_ym || "";
      const end = cycle.period_end_ym || "";
      if (!/^\d{6}$/.test(start) || !/^\d{6}$/.test(end)) continue;
      if (parseSeasonBufferTotal(cycle.buffer_breakdown_json)) continue;
      const reconciledBudget = plan.monthlyFixedBudgetRows
        .filter((m) => m.ym >= start && m.ym <= end)
        .reduce((sum, m) => sum + m.budgetYen, 0);
      if (reconciledBudget <= 0 || num(cycle.budget_yen) === reconciledBudget) continue;
      const { error: pcUpdateErr } = await db
        .from("value_plan_cycles")
        .update({ budget_yen: reconciledBudget })
        .eq("plan_cycle_id", cycle.plan_cycle_id);
      if (pcUpdateErr) throw pcUpdateErr;
      planCyclesReconciled += 1;
    }
  }

  // 監査ログ
  await db.from("billing_log").insert({
    project_id: plan.projectId,
    ym: plan.startYm || now.slice(0, 7).replace("-", ""),
    action: "contract_applied",
    actor,
    detail: {
      term_id: plan.termId,
      mode: plan.mode,
      fee_type: plan.feeType,
      fee_amount: plan.feeAmount,
      start_ym: plan.startYm,
      end_ym: plan.endYm,
      monthly_applied: monthlyApplied,
      monthly_fixed_budget_applied: monthlyFixedBudgetApplied,
      plan_cycles_reconciled: planCyclesReconciled,
      skipped_monthly_fixed_reconcile_reason: plan.mode === "monthly_fixed" && !shouldReconcileMonthlyFixed
        ? "contract_or_season_buffer_present"
        : null,
      warnings: plan.warnings,
      applied_at: now,
    },
  });

  return {
    projectId: plan.projectId,
    termId: plan.termId,
    mode: plan.mode,
    feeType: plan.feeType,
    startYm: plan.startYm,
    endYm: plan.endYm,
    monthlyApplied,
    monthlyFixedBudgetApplied,
    planCyclesReconciled,
    warnings: plan.warnings,
  };
}
