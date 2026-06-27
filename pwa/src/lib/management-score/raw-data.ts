import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

type Axis = "initiative" | "finance" | "retention" | "pipeline" | "direction";
type RunStatus = "running" | "success" | "partial" | "failed";

interface RawSignal {
  ym: string;
  axis: Axis;
  source_kind: string;
  source_table: string;
  source_id: string;
  signal_key: string;
  signal_value_numeric?: number | null;
  signal_value_text?: string | null;
  project_id?: string | null;
  observed_at?: string | null;
  confidence?: number;
  weight_hint?: number;
  payload?: Record<string, unknown>;
}

interface CollectOptions {
  ym?: string;
  includeFreee?: boolean;
  freeeStartDate?: string;
  freeeEndDate?: string;
}

interface CollectResult {
  ok: boolean;
  ym: string;
  runId: string;
  status: RunStatus;
  counts: Record<string, number>;
  errors: string[];
}

interface FreeeBalanceNode {
  id?: number | string;
  account_item_id?: number | string;
  account_item_name?: string;
  account_category_name?: string;
  name?: string;
  account_category?: string;
  total_line?: boolean;
  hierarchy_level?: number;
  closing_balance?: number | string;
  opening_balance?: number | string;
  debit_amount?: number | string;
  credit_amount?: number | string;
  balances?: FreeeBalanceNode[];
  items?: FreeeBalanceNode[];
  children?: FreeeBalanceNode[];
  [key: string]: unknown;
}

interface QueryLike<T extends Record<string, unknown>> extends PromiseLike<{ data: T[] | null; error: { message: string } | null }> {
  eq(column: string, value: unknown): QueryLike<T>;
  gte(column: string, value: unknown): QueryLike<T>;
  lt(column: string, value: unknown): QueryLike<T>;
  lte(column: string, value: unknown): QueryLike<T>;
  or(filters: string): QueryLike<T>;
}

type ProgressRow = {
  id: string;
  milestone_key: string;
  ym: string;
  progress_pct: number | string | null;
  consumed_pt: number | string | null;
  source: string | null;
  confirmed_at: string | null;
  note: string | null;
};

type MilestoneMeta = {
  milestone_id: string;
  plan_cycle_id: string | null;
  title: string | null;
  points: number | string | null;
  tag: string | null;
  goal_level: string | null;
  is_active: boolean | null;
  success_criteria: string | null;
  period_start_ym: string | null;
  target_ym: string | null;
};

type PlanCycleMeta = {
  plan_cycle_id: string;
  project_id: string | null;
  status: string | null;
  budget_yen: number | string | null;
  total_points: number | string | null;
  period_start_ym: string | null;
  period_end_ym: string | null;
};

const PM_LOCKED_PROGRESS_SOURCES = new Set([
  "pm_manual",
  "pm_confirmed",
  "pm_rejected",
  "criteria_toggle",
  "tsukuyomi_revision",
]);

const INTERNAL_PROGRESS_TITLE_PATTERNS = [
  /月次ルーティン/i,
  /monthly[-_\s]?routine/i,
  /内部/i,
  /AMD OS/i,
  /management score/i,
];

function currentYmJST(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return `${jst.getUTCFullYear()}${String(jst.getUTCMonth() + 1).padStart(2, "0")}`;
}

function ymToDateRange(ym: string) {
  const year = Number(ym.slice(0, 4));
  const month = Number(ym.slice(4, 6));
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const end = new Date(Date.UTC(year, month, 0));
  const endDate = `${end.getUTCFullYear()}-${String(end.getUTCMonth() + 1).padStart(2, "0")}-${String(end.getUTCDate()).padStart(2, "0")}`;
  return { startDate, endDate };
}

function monthStartIso(ym: string) {
  return `${ym.slice(0, 4)}-${ym.slice(4, 6)}-01T00:00:00.000Z`;
}

function nextYm(ym: string): string {
  let year = Number(ym.slice(0, 4));
  let month = Number(ym.slice(4, 6)) + 1;
  if (month > 12) {
    year += 1;
    month = 1;
  }
  return `${year}${String(month).padStart(2, "0")}`;
}

function dateToYm(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  const match = value.match(/^(\d{4})-(\d{2})/);
  return match ? `${match[1]}${match[2]}` : null;
}

function signalEventYm(row: { ym?: unknown; signal_date?: unknown; confirmed_at?: unknown; created_at?: unknown }): string | null {
  return dateToYm(row.signal_date) ?? (typeof row.ym === "string" ? row.ym : null) ?? dateToYm(row.confirmed_at) ?? dateToYm(row.created_at);
}

function signalInTargetMonth(row: { ym?: unknown; signal_date?: unknown; confirmed_at?: unknown; created_at?: unknown }, ym: string): boolean {
  return signalEventYm(row) === ym;
}

function signalKnownByTargetMonth(row: { ym?: unknown; signal_date?: unknown; confirmed_at?: unknown; created_at?: unknown }, ym: string): boolean {
  const eventYm = signalEventYm(row);
  return Boolean(eventYm && eventYm <= ym);
}

type StrategySignalRow = {
  signal_id: string;
  project_id: string;
  ym: string | null;
  signal_type: string;
  status: string;
  decision_state: string;
  impact_level: string;
  title: string;
  summary: string;
  confidence: number;
  signal_date?: string | null;
  confirmed_at?: string | null;
  created_at: string;
  signal_scope?: string | null;
  applies_to_company_score?: boolean | null;
  pipeline_status?: string | null;
  pipeline_probability?: number | string | null;
  expected_amount_yen?: number | string | null;
  expected_contract_ym?: string | null;
  company_score_axis?: string | null;
  scope_reason?: string | null;
};

function isCompanyScoreStrategySignal(row: { project_id?: unknown; signal_scope?: unknown; applies_to_company_score?: unknown }): boolean {
  if (row.applies_to_company_score === true) {
    const scope = String(row.signal_scope || "");
    return scope === "company" || scope === "cross_project";
  }
  if (row.applies_to_company_score === false) return false;
  // migration 118 backfill完了までは p00 暫定guardを fallback として残す。
  return String(row.project_id || "") === "p00";
}

function pipelineProbability(row: { pipeline_probability?: unknown; confidence?: unknown }): number {
  return asNumber(row.pipeline_probability) ?? asNumber(row.confidence) ?? 0;
}

function isHighConfidencePipelineCandidate(row: { signal_type?: unknown; status?: unknown; confidence?: unknown; pipeline_status?: unknown; pipeline_probability?: unknown; company_score_axis?: unknown }): boolean {
  const status = String(row.pipeline_status || "");
  const probability = pipelineProbability(row);
  const isPipeline = String(row.company_score_axis || "") === "pipeline" || String(row.signal_type) === "commercial_progress";
  return (
    isPipeline
    && String(row.status) === "candidate"
    && (
      ["high_confidence", "contracting", "contracted"].includes(status)
      || probability >= 0.75
    )
  );
}

function isHighConfidencePipelineActiveForYm(row: StrategySignalRow, ym: string): boolean {
  if (!isHighConfidencePipelineCandidate(row)) return false;
  if (!signalKnownByTargetMonth(row, ym)) return false;
  const eventYm = signalEventYm(row);
  const expectedYm = typeof row.expected_contract_ym === "string" ? row.expected_contract_ym : null;
  // 期待契約月が未来/当月なら pipeline として継続、未設定でも event 月だけは拾う。
  return Boolean(!expectedYm || expectedYm >= ym || eventYm === ym);
}

function isConfirmed(row: { status?: unknown }): boolean {
  return String(row.status) === "confirmed";
}

function monthEndExclusiveIso(ym: string) {
  return monthStartIso(nextYm(ym));
}

function stableHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function uniq(values: unknown[]): string[] {
  return Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean)));
}

export function isPmLockedProgressSource(source: unknown): boolean {
  return PM_LOCKED_PROGRESS_SOURCES.has(String(source || ""));
}

function isInternalProgressTitle(value: unknown): boolean {
  const text = String(value || "");
  return INTERNAL_PROGRESS_TITLE_PATTERNS.some((pattern) => pattern.test(text));
}

export function isManagementScoreRetentionProgressEligible(
  row: Pick<ProgressRow, "milestone_key" | "source">,
  milestone?: Partial<MilestoneMeta> | null,
  plan?: Partial<PlanCycleMeta> | null
): { eligible: boolean; reason: string } {
  const milestoneKey = String(row.milestone_key || "");
  const source = String(row.source || "");
  const projectId = String(plan?.project_id || "");
  const points = asNumber(milestone?.points) ?? 0;
  const title = String(milestone?.title || "");
  const isActive = milestone?.is_active;

  if (!isPmLockedProgressSource(source)) {
    return { eligible: false, reason: source === "routine_auto" ? "routine_auto の機械按分MS" : "PM locked ではないMS進捗" };
  }
  if (projectId.toLowerCase() === "p00" || milestoneKey.startsWith("MS-p00-")) {
    return { eligible: false, reason: "p00 / AMD内部運用MS" };
  }
  if (points <= 0) {
    return { eligible: false, reason: "points=0 のMS" };
  }
  if (isActive === false) {
    return { eligible: false, reason: "廃止済みMS" };
  }
  if (isInternalProgressTitle(title)) {
    return { eligible: false, reason: "内部運用 / 廃止済み月次ルーティンMS" };
  }
  return { eligible: true, reason: "PM locked かつ契約履行・会社継続の補助材料として扱えるMS進捗" };
}

function textIncludesAny(value: unknown, patterns: string[]) {
  const text = String(value ?? "").toLowerCase();
  return patterns.some((pattern) => text.includes(pattern.toLowerCase()));
}

function normalizeRetentionText(value: string): string {
  return value.replace(/請求項/g, "クレーム");
}

function textList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item : JSON.stringify(item)))
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (value == null) return [];
  const text = String(value).trim();
  return text ? [text] : [];
}

const RETENTION_STRONG_NEGATIVE_PATTERNS = [
  "失注",
  "解約",
  "打ち切り",
  "契約終了",
  "契約停止",
  "継続停止",
  "支援停止",
  "予算難",
  "予算不足",
  "予算未確保",
  "予算縮小",
  "入金遅延",
  "支払遅延",
  "支払い遅延",
  "未払い",
  "請求未回収",
  "凍結",
  "freeze",
];

const RETENTION_CONDITIONAL_NEGATIVE_PATTERNS = [
  "停止",
  "中止",
  "見送り",
  "遅延",
  "滞留",
  "リスク",
  "難航",
  "未確定",
];

const RETENTION_BUSINESS_CONTEXT_PATTERNS = [
  "amd",
  "チームアルマダ",
  "契約",
  "継続",
  "更新",
  "支援",
  "受託",
  "委託",
  "売上",
  "請求",
  "入金",
  "支払",
  "支払い",
  "予算",
  "報酬",
  "稼働",
  "体制",
  "pm",
  "顧客",
  "クライアント",
  "取り分",
  "ランウェイ",
];

const RETENTION_OPERATING_CONTEXT_PATTERNS = [
  "amd",
  "チームアルマダ",
  "支援",
  "受託",
  "委託",
  "売上",
  "請求",
  "入金",
  "支払",
  "支払い",
  "予算",
  "報酬",
  "稼働",
  "体制",
  "pm",
  "顧客",
  "クライアント",
  "取り分",
  "ランウェイ",
];

const PROJECT_INTERNAL_ONLY_PATTERNS = [
  "技術実証",
  "100mk",
  "nmr",
  "mri",
  "poc",
  "センサー",
  "知財",
  "創業株主",
  "エクイティ",
  "出資",
  "資本",
  "特許",
  "実験",
  "研究",
  "装置",
  "dd",
  "投資判断",
];

const RETENTION_STRONG_POSITIVE_PATTERNS = [
  "支援継続",
  "契約更新",
  "契約継続",
  "次期契約",
  "来期契約",
  "追加契約",
  "予算確保",
  "受注",
  "請求",
  "入金",
];

export interface MeetingRetentionClassification {
  signalKey: "meeting:retention_risk" | "meeting:retention_positive" | "meeting:context";
  signalScore: number;
  appliesToCompanyScore: boolean;
  evidenceText: string | null;
  matchedRisks: string[];
  matchedPositives: string[];
  excludedRisks: string[];
  scopeReason: string;
}

function isCompanyRetentionRisk(text: string): boolean {
  const normalized = normalizeRetentionText(text);
  const hasStrongNegative = textIncludesAny(normalized, RETENTION_STRONG_NEGATIVE_PATTERNS);
  const hasConditionalNegative = textIncludesAny(normalized, RETENTION_CONDITIONAL_NEGATIVE_PATTERNS);
  const hasBusinessContext = textIncludesAny(normalized, RETENTION_BUSINESS_CONTEXT_PATTERNS);
  const hasOperatingContext = textIncludesAny(normalized, RETENTION_OPERATING_CONTEXT_PATTERNS);
  const hasProjectInternalContext = textIncludesAny(normalized, PROJECT_INTERNAL_ONLY_PATTERNS);
  if (hasProjectInternalContext && !hasOperatingContext) return false;
  return hasStrongNegative || (hasConditionalNegative && hasBusinessContext);
}

function isCompanyRetentionPositive(text: string): boolean {
  const normalized = normalizeRetentionText(text);
  const hasStrongPositive = textIncludesAny(normalized, RETENTION_STRONG_POSITIVE_PATTERNS);
  const hasOperatingContext = textIncludesAny(normalized, RETENTION_OPERATING_CONTEXT_PATTERNS);
  const hasProjectInternalContext = textIncludesAny(normalized, PROJECT_INTERNAL_ONLY_PATTERNS);
  if (hasProjectInternalContext && !hasOperatingContext) return false;
  const hasContractContinuation = textIncludesAny(normalized, ["契約"]) && textIncludesAny(normalized, ["継続", "更新", "延長", "追加", "増額", "次期", "来期"]);
  const hasSupportContinuation = textIncludesAny(normalized, ["支援"]) && textIncludesAny(normalized, ["継続", "延長", "追加", "拡大", "次期", "来期"]);
  return hasStrongPositive || hasContractContinuation || hasSupportContinuation;
}

export function classifyMeetingRetentionSignalForManagementScore(row: Record<string, unknown>): MeetingRetentionClassification {
  const risks = textList(row.risks);
  const positives = [
    ...textList(row.decided),
    ...textList(row.progress),
    ...textList(row.next_actions),
  ];
  const matchedRisks = risks.filter(isCompanyRetentionRisk);
  const matchedPositives = positives.filter(isCompanyRetentionPositive);
  const excludedRisks = risks.filter((item) => !matchedRisks.includes(item));

  if (matchedRisks.length > 0) {
    const score = -Math.min(18, 6 + (matchedRisks.length - 1) * 3);
    return {
      signalKey: "meeting:retention_risk",
      signalScore: score,
      appliesToCompanyScore: true,
      evidenceText: matchedRisks[0],
      matchedRisks,
      matchedPositives,
      excludedRisks,
      scopeReason: "契約・予算・入金・支援継続など会社の既存PJ継続に直接効くrisk",
    };
  }

  if (matchedPositives.length > 0) {
    const score = Math.min(12, 4 + (matchedPositives.length - 1) * 2);
    return {
      signalKey: "meeting:retention_positive",
      signalScore: score,
      appliesToCompanyScore: true,
      evidenceText: matchedPositives[0],
      matchedRisks,
      matchedPositives,
      excludedRisks,
      scopeReason: "契約更新・支援継続・追加予算など会社の既存PJ継続を支えるsignal",
    };
  }

  return {
    signalKey: "meeting:context",
    signalScore: 0,
    appliesToCompanyScore: false,
    evidenceText: null,
    matchedRisks,
    matchedPositives,
    excludedRisks,
    scopeReason: "技術・出資・知財・調査不足などPJ内部文脈のためManagement Score継続軸から除外",
  };
}

function signal(input: RawSignal): RawSignal {
  return {
    confidence: 0.7,
    weight_hint: 1,
    payload: {},
    signal_value_numeric: null,
    signal_value_text: null,
    project_id: null,
    observed_at: null,
    ...input,
  };
}

async function fetchAll<T extends Record<string, unknown>>(
  supabase: SupabaseClient,
  table: string,
  select: string,
  configure?: (query: QueryLike<T>) => QueryLike<T>
): Promise<T[]> {
  let query = supabase.from(table).select(select) as unknown as QueryLike<T>;
  if (configure) query = configure(query);
  const { data, error } = await query;
  if (error) throw new Error(`${table}: ${error.message}`);
  return data ?? [];
}

async function fetchByIn<T extends Record<string, unknown>>(
  supabase: SupabaseClient,
  table: string,
  select: string,
  column: string,
  values: unknown[]
): Promise<T[]> {
  const ids = uniq(values);
  const rows: T[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    if (chunk.length === 0) continue;
    const { data, error } = await supabase.from(table).select(select).in(column, chunk);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...((data ?? []) as unknown as T[]));
  }
  return rows;
}

async function collectInternalSignals(supabase: SupabaseClient, ym: string): Promise<RawSignal[]> {
  // v4 (2026-05-26 まさ #82, #83, #84):
  // - 戦略接近度の入力を 6 つに全面差し替え (= ファンド / 連携機関 / OS導入 / マネタイズ / 属人脱却 / 成功卒業)
  // - pipeline 軸の seed 在庫加点を廃止、 commercial_progress stage 中心に切り替え
  // - initiative 軸で卒業 PJ (= amd_support_ended_at IS NOT NULL) を除外
  // - 削除した入力: seeds / seed_contact_log / amd_score_inputs / protocols / atlas_signals / macro_index_log
  // - 追加した入力: project_strategy_signals (= funding/commercial_progress) / project_partners
  const [
    memberActivities,
    budgetActuals,
    actuals,
    billing,
    financeItems,
    receiptEvents,
    projects,
    milestones,
    freezes,
    meetings,
    registryDiffs,
    knowledge,
    ventures,
    strategySignals,
    projectPartners,
  ] = await Promise.all([
    fetchAll(supabase, "member_activities", "id,member_id,project_id,ym,source,source_item_id,title,content_preview,item_date,raw_metadata,milestone_id,initiative_origin,impact,depth,reject_reason", (q) => q.eq("ym", ym)),
    fetchAll(supabase, "company_budget_actual_monthly", "ym,scope,project_id,category,account_name,budget_amount_yen,actual_amount_yen,variance_yen,cash_amount_yen,runway_months,budget_version,freee_account_item_id,freee_partner_id,budget_payload,actual_payload", (q) => q.eq("ym", ym)),
    fetchAll(supabase, "company_actual_monthly", "id,ym,scope,project_id,category,account_name,actual_amount_yen,freee_account_item_id,freee_partner_id,source_ref,raw_hash,payload,imported_at", (q) => q.eq("ym", ym)),
    fetchAll(supabase, "billing_cycles", "id,project_id,ym,budget_yen,status,meeting_start_at,report_fixed_at,invoice_sent_at,payment_confirmed_at,budget_confirmed_at,invoice_issued_at,invoice_ym,freee_invoice_number,updated_at", (q) => q.eq("ym", ym)),
    fetchAll(supabase, "company_finance_recurring_items", "id,status,item_kind,display_name,vendor_name,category,amount_yen,frequency,start_ym,end_ym,budget_forward_fill,auto_debit,withdrawal_account,payment_method,source_kind,source_ref,last_receipt_at,last_budget_synced_at,notes,updated_at"),
    fetchAll(supabase, "company_finance_receipt_events", "id,recurring_item_id,ym,receipt_date,vendor_name,amount_yen,payment_method,withdrawal_account,subject,source_kind,source_ref,raw_hash,status,created_at,updated_at", (q) => q.or(`ym.eq.${ym},created_at.gte.${monthStartIso(ym)}`).lt("created_at", monthEndExclusiveIso(ym))),
    fetchAll(supabase, "projects", "project_id,project_name,status,client_name,start_ym,end_ym,fee_type,fee_amount,freee_partner_id,updated_at"),
    fetchAll(supabase, "milestone_monthly_progress", "id,milestone_key,ym,progress_pct,consumed_pt,source,confirmed_at,note", (q) => q.eq("ym", ym)),
    fetchAll(supabase, "project_freeze_periods", "period_id,project_id,freeze_from_ym,restart_ym,status,reason,source,source_ref,updated_at"),
    fetchAll(supabase, "project_meeting_summaries", "meeting_id,project_id,ym,meeting_date,title,summary_short,decided,progress,next_actions,risks,source_hash,source_url,updated_at", (q) => q.eq("ym", ym)),
    fetchAll(supabase, "project_registry_diffs", "diff_id,project_id,ym,scope_key,diff_kind,target_table,target_key,proposed_patch_json,evidence_refs_json,confidence,status,created_at,updated_at", (q) => q.or(`ym.eq.${ym},created_at.gte.${monthStartIso(ym)}`).lt("created_at", monthEndExclusiveIso(ym))),
    fetchAll(supabase, "project_knowledge", "id,project_id,category,entity_name,fact_text,confidence,source,status,updated_at", (q) => q.gte("updated_at", monthStartIso(ym)).lt("updated_at", monthEndExclusiveIso(ym))),
    fetchAll(supabase, "project_ventures", "project_id,lane,lanes,outcome_pattern,amd_role,amd_support_started_at,amd_support_ended_at,updated_at"),
    fetchAll(supabase, "project_strategy_signals", "signal_id,project_id,ym,signal_type,impact_level,decision_state,status,title,summary,confidence,signal_date,confirmed_at,created_at,updated_at,signal_scope,applies_to_company_score,pipeline_status,pipeline_probability,expected_amount_yen,expected_contract_ym,company_score_axis,scope_reason", (q) => q.or("status.eq.confirmed,status.eq.candidate")),
    fetchAll(supabase, "project_partners", "id,project_id,partner_name,partner_type,partner_role,is_sold,created_at,updated_at"),
  ]);

  const progressRows = milestones as ProgressRow[];
  const milestoneMetaRows = await fetchByIn<MilestoneMeta>(
    supabase,
    "value_milestones",
    "milestone_id,plan_cycle_id,title,points,tag,goal_level,is_active,success_criteria,period_start_ym,target_ym",
    "milestone_id",
    progressRows.map((row) => row.milestone_key)
  );
  const milestoneById = new Map(milestoneMetaRows.map((row) => [String(row.milestone_id), row]));
  const planCycleRows = await fetchByIn<PlanCycleMeta>(
    supabase,
    "value_plan_cycles",
    "plan_cycle_id,project_id,status,budget_yen,total_points,period_start_ym,period_end_ym",
    "plan_cycle_id",
    milestoneMetaRows.map((row) => row.plan_cycle_id)
  );
  const planById = new Map(planCycleRows.map((row) => [String(row.plan_cycle_id), row]));

  // 卒業 PJ 識別 (= 先手力評価対象外 + direction の成功卒業加点用)
  // outcome_pattern in ('rocket','lifted','smb') AND amd_support_ended_at IS NOT NULL = 成功卒業 (= まさ #85)
  const graduatedPjSet = new Set<string>();
  const successGraduatedPjs: Array<{ project_id: string; outcome_pattern: string; ended_at: string }> = [];
  for (const row of ventures as Array<{ project_id: string; outcome_pattern: string; amd_support_ended_at: string | null }>) {
    if (row.amd_support_ended_at) {
      graduatedPjSet.add(String(row.project_id));
      if (["rocket", "lifted", "smb"].includes(String(row.outcome_pattern))) {
        successGraduatedPjs.push({ project_id: String(row.project_id), outcome_pattern: String(row.outcome_pattern), ended_at: String(row.amd_support_ended_at) });
      }
    }
  }
  const MASA_MEMBER_ID = "ID001"; // まさ識別 (= members.member_id="ID001", code_name="まさ", 属人脱却率の分母から除外)

  const signals: RawSignal[] = [];

  // v4: 卒業 PJ (= amd_support_ended_at IS NOT NULL) は先手力評価対象から除外 (= まさ #83)
  // 「AMD が育てた組織が自走 → 他人主導 events が出ても歓迎」 のため減点しない
  for (const row of memberActivities) {
    if (graduatedPjSet.has(String(row.project_id))) continue;
    const impact = asNumber(row.impact) ?? 0;
    const depth = asNumber(row.depth) ?? 0;
    signals.push(signal({
      ym,
      axis: "initiative",
      source_kind: "os_internal",
      source_table: "member_activities",
      source_id: String(row.id),
      signal_key: `initiative_origin:${row.initiative_origin || "unknown"}`,
      signal_value_numeric: impact * depth,
      signal_value_text: String(row.initiative_origin || "unknown"),
      project_id: String(row.project_id),
      observed_at: row.item_date ? String(row.item_date) : null,
      confidence: row.initiative_origin ? 0.75 : 0.35,
      weight_hint: Math.max(1, impact),
      payload: row,
    }));
  }

  // v4: 属人脱却率 (= direction 軸)
  // まさ以外の AMD member が amd_proposed events を起こした比率 (= 全 amd_proposed events 中)
  // 卒業 PJ は除外
  const amdProposedActiveEvents = memberActivities.filter((row) =>
    String(row.initiative_origin) === "amd_proposed" && !graduatedPjSet.has(String(row.project_id))
  );
  const nonMasaAmdProposed = amdProposedActiveEvents.filter((row) => String(row.member_id) !== MASA_MEMBER_ID).length;
  const allAmdProposed = amdProposedActiveEvents.length;
  const nonMasaRatio = allAmdProposed > 0 ? nonMasaAmdProposed / allAmdProposed : 0;
  signals.push(signal({
    ym,
    axis: "direction",
    source_kind: "non_masa_initiative",
    source_table: "member_activities",
    source_id: `non_masa_initiative:${ym}`,
    signal_key: "direction:non_masa_initiative",
    signal_value_numeric: nonMasaRatio,
    signal_value_text: `${nonMasaAmdProposed}/${allAmdProposed}`,
    confidence: allAmdProposed >= 5 ? 0.75 : 0.4,
    weight_hint: 1,
    payload: { nonMasaAmdProposed, allAmdProposed, ratio: nonMasaRatio, masa_member_id: MASA_MEMBER_ID },
  }));

  for (const row of budgetActuals) {
    signals.push(signal({
      ym,
      axis: "finance",
      source_kind: "budget_actual_view",
      source_table: "company_budget_actual_monthly",
      source_id: `${row.scope}:${row.project_id || "company"}:${row.category}:${row.account_name || ""}:${row.budget_version || ""}`,
      signal_key: `budget_actual:${row.category}`,
      signal_value_numeric: asNumber(row.variance_yen),
      signal_value_text: row.budget_version ? String(row.budget_version) : null,
      project_id: row.project_id ? String(row.project_id) : null,
      confidence: row.actual_payload ? 0.85 : 0.55,
      weight_hint: Math.abs(asNumber(row.variance_yen) ?? 0),
      payload: row,
    }));
  }

  for (const row of actuals) {
    signals.push(signal({
      ym,
      axis: "finance",
      source_kind: "freee_actual",
      source_table: "company_actual_monthly",
      source_id: String(row.id),
      signal_key: `actual:${row.category}`,
      signal_value_numeric: asNumber(row.actual_amount_yen),
      project_id: row.project_id ? String(row.project_id) : null,
      observed_at: row.imported_at ? String(row.imported_at) : null,
      confidence: 0.9,
      weight_hint: Math.abs(asNumber(row.actual_amount_yen) ?? 0),
      payload: row,
    }));
  }

  for (const row of billing) {
    const delayed = !row.payment_confirmed_at && row.invoice_sent_at;
    signals.push(signal({
      ym,
      axis: "finance",
      source_kind: "billing",
      source_table: "billing_cycles",
      source_id: String(row.id),
      signal_key: delayed ? "billing:sent_unpaid" : `billing:${row.status || "unknown"}`,
      signal_value_numeric: asNumber(row.budget_yen),
      signal_value_text: String(row.status || ""),
      project_id: String(row.project_id),
      observed_at: row.updated_at ? String(row.updated_at) : null,
      confidence: 0.85,
      weight_hint: Math.abs(asNumber(row.budget_yen) ?? 0),
      payload: row,
    }));
  }

  for (const row of financeItems) {
    const startYm = String(row.start_ym || "");
    const endYm = row.end_ym ? String(row.end_ym) : null;
    const activeInMonth = row.status === "active" && startYm <= ym && (!endYm || endYm >= ym);
    if (!activeInMonth) continue;
    const debitState = row.auto_debit === true ? "auto_debit" : row.auto_debit === false ? "manual_payment" : "auto_debit_unknown";
    signals.push(signal({
      ym,
      axis: "finance",
      source_kind: "finance_recurring_item",
      source_table: "company_finance_recurring_items",
      source_id: String(row.id),
      signal_key: `recurring:${debitState}`,
      signal_value_numeric: asNumber(row.amount_yen),
      signal_value_text: String(row.display_name || row.vendor_name || ""),
      observed_at: row.updated_at ? String(row.updated_at) : null,
      confidence: row.auto_debit === null ? 0.45 : 0.75,
      weight_hint: Math.abs(asNumber(row.amount_yen) ?? 0),
      payload: row,
    }));
  }

  for (const row of receiptEvents) {
    signals.push(signal({
      ym,
      axis: "finance",
      source_kind: "finance_receipt",
      source_table: "company_finance_receipt_events",
      source_id: String(row.id),
      signal_key: `receipt:${row.status || "candidate"}`,
      signal_value_numeric: asNumber(row.amount_yen),
      signal_value_text: String(row.vendor_name || row.subject || ""),
      observed_at: row.receipt_date ? String(row.receipt_date) : row.created_at ? String(row.created_at) : null,
      confidence: row.status === "synced" || row.status === "confirmed" ? 0.85 : 0.55,
      weight_hint: Math.abs(asNumber(row.amount_yen) ?? 0),
      payload: row,
    }));
  }

  for (const row of projects) {
    const activeInMonth = row.status === "active" && (!row.start_ym || String(row.start_ym) <= ym) && (!row.end_ym || String(row.end_ym) >= ym);
    signals.push(signal({
      ym,
      axis: "retention",
      source_kind: "project_master",
      source_table: "projects",
      source_id: String(row.project_id),
      signal_key: activeInMonth ? "project:active_in_month" : `project:${row.status || "unknown"}`,
      signal_value_numeric: asNumber(row.fee_amount),
      signal_value_text: String(row.status || ""),
      project_id: String(row.project_id),
      observed_at: row.updated_at ? String(row.updated_at) : null,
      confidence: 0.8,
      weight_hint: Math.abs(asNumber(row.fee_amount) ?? 1),
      payload: row,
    }));
  }

  for (const row of progressRows) {
    const milestone = milestoneById.get(String(row.milestone_key)) ?? null;
    const plan = milestone?.plan_cycle_id ? planById.get(String(milestone.plan_cycle_id)) ?? null : null;
    const eligibility = isManagementScoreRetentionProgressEligible(row, milestone, plan);
    if (!eligibility.eligible) continue;
    const pmLocked = isPmLockedProgressSource(row.source);
    signals.push(signal({
      ym,
      axis: "retention",
      source_kind: "progress",
      source_table: "milestone_monthly_progress",
      source_id: String(row.id),
      signal_key: pmLocked ? "milestone:confirmed_progress" : "milestone:estimated_progress",
      signal_value_numeric: asNumber(row.progress_pct),
      signal_value_text: String(row.source || ""),
      project_id: plan?.project_id ? String(plan.project_id) : null,
      observed_at: row.confirmed_at ? String(row.confirmed_at) : null,
      confidence: pmLocked ? 0.9 : 0.6,
      weight_hint: asNumber(row.consumed_pt) ?? 1,
      payload: {
        ...row,
        management_score_progress_eligible: true,
        progress_source_quality: pmLocked ? "pm_locked" : "estimated",
        scope_reason: eligibility.reason,
        milestone_title: milestone?.title ?? null,
        milestone_points: milestone?.points ?? null,
        milestone_tag: milestone?.tag ?? null,
        milestone_is_active: milestone?.is_active ?? null,
        plan_cycle_id: milestone?.plan_cycle_id ?? null,
        plan_project_id: plan?.project_id ?? null,
        plan_status: plan?.status ?? null,
      },
    }));
  }

  for (const row of freezes) {
    const activeFreeze = row.status === "active" && String(row.freeze_from_ym) <= ym && (!row.restart_ym || String(row.restart_ym) > ym);
    if (!activeFreeze) continue;
    signals.push(signal({
      ym,
      axis: "retention",
      source_kind: "freeze",
      source_table: "project_freeze_periods",
      source_id: String(row.period_id),
      signal_key: "project:active_freeze",
      signal_value_numeric: -1,
      signal_value_text: String(row.reason || ""),
      project_id: String(row.project_id),
      observed_at: row.updated_at ? String(row.updated_at) : null,
      confidence: 0.9,
      weight_hint: 5,
      payload: row,
    }));
  }

  for (const row of meetings) {
    const risksText = JSON.stringify(row.risks ?? []);
    const nextText = JSON.stringify(row.next_actions ?? []);
    const decidedText = JSON.stringify(row.decided ?? []);
    const meetingRetention = classifyMeetingRetentionSignalForManagementScore(row);
    signals.push(signal({
      ym,
      axis: "retention",
      source_kind: "meeting_summary",
      source_table: "project_meeting_summaries",
      source_id: String(row.meeting_id),
      signal_key: meetingRetention.signalKey,
      signal_value_numeric: meetingRetention.signalScore,
      signal_value_text: meetingRetention.evidenceText || String(row.summary_short || row.title || ""),
      project_id: String(row.project_id),
      observed_at: row.meeting_date ? `${row.meeting_date}T00:00:00.000Z` : null,
      confidence: meetingRetention.appliesToCompanyScore ? 0.75 : 0.45,
      weight_hint: Math.max(1, Math.abs(meetingRetention.signalScore)),
      payload: {
        ...row,
        nextText,
        decidedText,
        risksText,
        applies_to_company_score: meetingRetention.appliesToCompanyScore,
        company_score_axis: meetingRetention.appliesToCompanyScore ? "retention" : null,
        scope_reason: meetingRetention.scopeReason,
        matched_retention_risks: meetingRetention.matchedRisks,
        matched_retention_positive: meetingRetention.matchedPositives,
        excluded_retention_risks: meetingRetention.excludedRisks,
      },
    }));
  }

  // v4: seeds / seed_contact_log の在庫加点を廃止 (= まさ #79、 「ネット拾いシーズが pipeline 点を上げる」 問題)
  // seeds は AMD Score 側 (= 21 章) の入力として別途使う、 management-score の pipeline 入力からは外す

  for (const row of registryDiffs) {
    signals.push(signal({
      ym,
      axis: "pipeline",
      source_kind: "registry_diff",
      source_table: "project_registry_diffs",
      source_id: String(row.diff_id),
      signal_key: `registry_diff:${row.diff_kind || "unknown"}:${row.status || "pending"}`,
      signal_value_numeric: asNumber(row.confidence),
      signal_value_text: String(row.target_key || row.scope_key || ""),
      project_id: String(row.project_id),
      observed_at: row.created_at ? String(row.created_at) : null,
      confidence: asNumber(row.confidence) ?? 0.5,
      weight_hint: row.status === "pending" ? 2 : 1,
      payload: row,
    }));
  }

  for (const row of knowledge) {
    if (String(row.project_id || "") !== "p00") continue;
    const text = `${row.category || ""} ${row.entity_name || ""} ${row.fact_text || ""}`;
    const axis: Axis = textIncludesAny(text, ["紹介", "新規", "相談", "案件", "候補", "提案"]) ? "pipeline" : "retention";
    signals.push(signal({
      ym,
      axis,
      source_kind: "project_knowledge",
      source_table: "project_knowledge",
      source_id: String(row.id),
      signal_key: `knowledge:${row.category || "unknown"}`,
      signal_value_text: String(row.fact_text || row.entity_name || ""),
      project_id: String(row.project_id),
      observed_at: row.updated_at ? String(row.updated_at) : null,
      confidence: row.confidence === "high" ? 0.85 : row.confidence === "low" ? 0.35 : 0.6,
      weight_hint: axis === "pipeline" ? 2 : 1,
      payload: row,
    }));
  }

  // ===== v4 戦略接近度 6 入力 (= まさ #82) =====
  // 削除: amd_score_inputs / protocols / venture_portfolio (= 旧形式) / atlas_signals / macro_index_log
  // 追加: funding / partner_growth / amd_os_install / monetization / non_masa_initiative (= 上で実装済) / graduation

  // 入力 1: ファンド設立進捗 (= project_strategy_signals signal_type='funding' confirmed)
  const companyStrategySignals = (strategySignals as StrategySignalRow[]).filter(isCompanyScoreStrategySignal);
  const strategySignalsForMonth = companyStrategySignals.filter((row) =>
    (signalInTargetMonth(row, ym) && isConfirmed(row))
    || isHighConfidencePipelineActiveForYm(row, ym)
  );
  const strategySignalsKnownByMonth = companyStrategySignals.filter((row) =>
    signalKnownByTargetMonth(row, ym) && isConfirmed(row)
  );

  const fundingSignals = strategySignalsKnownByMonth.filter((r) => String(r.signal_type) === "funding");
  for (const row of fundingSignals) {
    signals.push(signal({
      ym,
      axis: "direction",
      source_kind: "funding",
      source_table: "project_strategy_signals",
      source_id: String(row.signal_id),
      signal_key: `funding:${row.decision_state || "proposed"}`,
      signal_value_text: String(row.title || ""),
      project_id: String(row.project_id),
      observed_at: row.created_at ? String(row.created_at) : null,
      confidence: asNumber(row.confidence) ?? 0.7,
      weight_hint: row.impact_level === "critical" ? 3 : row.impact_level === "high" ? 2 : 1,
      payload: row,
    }));
  }
  // 集計 signal (= calculate.ts が「累積 confirmed funding 件数」 を読む)
  signals.push(signal({
    ym,
    axis: "direction",
    source_kind: "funding_aggregate",
    source_table: "project_strategy_signals",
    source_id: `funding_aggregate:${ym}`,
    signal_key: "direction:fund_setup_count",
    signal_value_numeric: fundingSignals.length,
    signal_value_text: `${fundingSignals.length} 件 confirmed funding`,
    confidence: 0.75,
    payload: { count: fundingSignals.length, project_ids: fundingSignals.map((r) => r.project_id) },
  }));

  // 入力 2: 連携研究機関数 (= project_partners、 university / research_institute)
  const researchPartners = (projectPartners as Array<{ id: string; project_id: string; partner_name: string; partner_type: string; created_at: string }>).filter((r) => {
    const t = String(r.partner_type || "").toLowerCase();
    return t.includes("university") || t.includes("research") || t.includes("研究") || t.includes("大学");
  });
  signals.push(signal({
    ym,
    axis: "direction",
    source_kind: "partner_growth",
    source_table: "project_partners",
    source_id: `partner_growth:${ym}`,
    signal_key: "direction:research_partner_count",
    signal_value_numeric: researchPartners.length,
    signal_value_text: `${researchPartners.length} 件 research/university partners`,
    confidence: 0.75,
    payload: { count: researchPartners.length, partners: researchPartners.map((r) => ({ project_id: r.project_id, name: r.partner_name, type: r.partner_type })) },
  }));

  // 入力 3: AMD OS 導入進捗 (= amd_os_installations)
  // テーブル未作成の間は 0 件ではなく data_missing として保存し、score 悪化には混ぜない。
  signals.push(signal({
    ym,
    axis: "direction",
    source_kind: "direction_data_missing",
    source_table: "amd_os_installations",
    source_id: `amd_os_install:${ym}`,
    signal_key: "direction:amd_os_install_count:data_missing",
    signal_value_numeric: null,
    signal_value_text: "amd_os_installations テーブル未作成 (= data_missing)",
    confidence: 0.2,
    weight_hint: 0,
    payload: {
      data_state: "data_missing",
      missing_source: "amd_os_installations",
      score_eligible: false,
      display_eligible: true,
      count: null,
      note: "amd_os_installations テーブル未実装、 Phase 4 で追加予定。未実装は方向性悪化ではなく信頼度低下として扱う。",
    },
  }));

  // 入力 4: マネタイズ仮説の前進 (= project_strategy_signals signal_type='commercial_progress' & decision_state='decided')
  const monetizationSignals = strategySignalsForMonth.filter((r) =>
    (String(r.signal_type) === "commercial_progress" || String(r.company_score_axis || "") === "pipeline")
    && (
      String(r.decision_state) === "decided"
      || String(r.decision_state) === "executing"
      || isHighConfidencePipelineCandidate(r)
    )
  );
  signals.push(signal({
    ym,
    axis: "direction",
    source_kind: "monetization_aggregate",
    source_table: "project_strategy_signals",
    source_id: `monetization_aggregate:${ym}`,
    signal_key: "direction:monetization_decided_count",
    signal_value_numeric: monetizationSignals.length,
    signal_value_text: `${monetizationSignals.length} 件 decided/executing commercial progress`,
    confidence: 0.75,
    payload: { count: monetizationSignals.length, project_ids: monetizationSignals.map((r) => r.project_id) },
  }));

  // 入力 5: 属人脱却率 (= 上の memberActivities ループ後で実装済)

  // 入力 6: PJ 成功卒業進捗 (= project_ventures.outcome_pattern IN (rocket,lifted,smb) AND amd_support_ended_at IS NOT NULL)
  signals.push(signal({
    ym,
    axis: "direction",
    source_kind: "graduation",
    source_table: "project_ventures",
    source_id: `graduation:${ym}`,
    signal_key: "direction:success_graduation_count",
    signal_value_numeric: successGraduatedPjs.length,
    signal_value_text: `${successGraduatedPjs.length} 件 success graduation (rocket/lifted/smb)`,
    confidence: 0.85,
    payload: { count: successGraduatedPjs.length, projects: successGraduatedPjs },
  }));

  // ===== v4 pipeline 軸: commercial_progress stage 別 (= まさ #79 で seed 加点を廃止し Gmail/Slack 案件追跡に切り替え) =====
  const commercialSignals = strategySignalsForMonth.filter((r) =>
    String(r.signal_type) === "commercial_progress" || String(r.company_score_axis || "") === "pipeline"
  );
  for (const row of commercialSignals) {
    const probability = pipelineProbability(row);
    const stage = row.pipeline_status || row.decision_state || "proposed";
    const amount = asNumber(row.expected_amount_yen);
    const amountWeight = amount === null ? 1 : Math.max(1, Math.min(3, amount / 1_000_000));
    signals.push(signal({
      ym,
      axis: "pipeline",
      source_kind: "commercial_progress",
      source_table: "project_strategy_signals",
      source_id: String(row.signal_id),
      signal_key: `commercial:${stage}`,
      signal_value_text: String(row.title || ""),
      project_id: String(row.project_id),
      observed_at: row.created_at ? String(row.created_at) : null,
      confidence: probability || asNumber(row.confidence) || 0.7,
      weight_hint: Math.max(row.impact_level === "critical" ? 3 : row.impact_level === "high" ? 2 : 1, amountWeight),
      payload: { ...row, management_score_reason: row.scope_reason || null, pipeline_probability: probability },
    }));
  }

  return signals;
}

async function getStoredFreeeRefreshToken(supabase: SupabaseClient): Promise<string | null> {
  const { data, error } = await supabase
    .from("freee_oauth_tokens")
    .select("refresh_token")
    .eq("token_key", "default")
    .maybeSingle();
  if (error) return null;
  return typeof data?.refresh_token === "string" && data.refresh_token ? data.refresh_token : null;
}

async function saveFreeeRefreshToken(
  supabase: SupabaseClient,
  token: { refresh_token?: string; company_id?: string | number; scope?: string; external_cid?: string }
) {
  if (!token.refresh_token) return;
  await supabase
    .from("freee_oauth_tokens")
    .upsert({
      token_key: "default",
      refresh_token: token.refresh_token,
      company_id: token.company_id ? String(token.company_id) : process.env.FREEE_COMPANY_ID ?? null,
      scope: token.scope ?? null,
      external_cid: token.external_cid ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "token_key" });
}

async function getFreeeAccessToken(supabase: SupabaseClient): Promise<string> {
  const clientId = process.env.FREEE_CLIENT_ID;
  const clientSecret = process.env.FREEE_CLIENT_SECRET;
  const refreshToken = await getStoredFreeeRefreshToken(supabase) || process.env.FREEE_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("FREEE_CLIENT_ID / FREEE_CLIENT_SECRET / FREEE_REFRESH_TOKEN not configured");
  }
  const res = await fetch("https://accounts.secure.freee.co.jp/public_api/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ grant_type: "refresh_token", client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken }),
  });
  if (!res.ok) throw new Error(`freee token refresh failed: ${res.status} ${await res.text()}`);
  const data = await res.json() as { access_token?: string; refresh_token?: string; company_id?: string | number; scope?: string; external_cid?: string };
  if (!data.access_token) throw new Error("freee token response did not include access_token");
  if (data.refresh_token && data.refresh_token !== refreshToken) {
    process.env.FREEE_REFRESH_TOKEN = data.refresh_token;
    await saveFreeeRefreshToken(supabase, data);
  }
  return data.access_token;
}

async function freeeGet(supabase: SupabaseClient, path: string): Promise<unknown> {
  const token = await getFreeeAccessToken(supabase);
  const companyId = process.env.FREEE_COMPANY_ID;
  const sep = path.includes("?") ? "&" : "?";
  const url = `https://api.freee.co.jp${path}${companyId ? `${sep}company_id=${companyId}` : ""}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`freee GET ${path}: ${res.status} ${(await res.text()).slice(0, 500)}`);
  return res.json();
}

function walkFreeeBalances(value: unknown, out: FreeeBalanceNode[] = []): FreeeBalanceNode[] {
  if (!value || typeof value !== "object") return out;
  if (Array.isArray(value)) {
    value.forEach((item) => walkFreeeBalances(item, out));
    return out;
  }
  const node = value as FreeeBalanceNode;
  if (
    node.account_item_id !== undefined ||
    node.account_item_name !== undefined ||
    (node.name !== undefined && (node.closing_balance !== undefined || node.debit_amount !== undefined || node.credit_amount !== undefined))
  ) {
    out.push(node);
  }
  for (const key of ["balances", "items", "children"]) {
    if (Array.isArray(node[key])) walkFreeeBalances(node[key], out);
  }
  for (const key of Object.keys(node)) {
    const child = node[key];
    if (child && typeof child === "object" && !Array.isArray(child)) walkFreeeBalances(child, out);
  }
  return out;
}

function freeeCategory(node: FreeeBalanceNode): string {
  const label = `${node.account_category || ""} ${node.account_category_name || ""} ${node.account_item_name || ""} ${node.name || ""}`;
  if (textIncludesAny(label, ["売上", "収益", "revenue", "sales"])) return "revenue";
  if (textIncludesAny(label, ["売上原価", "仕入", "外注", "cogs"])) return "cost_member";
  if (textIncludesAny(label, ["役員報酬", "給与", "法定福利", "人件費"])) return "fixed_cost";
  if (textIncludesAny(label, ["営業利益", "operating"])) return "operating_profit";
  if (textIncludesAny(label, ["費用", "経費", "expense", "販売費", "販売管理費", "一般管理費"])) return "fixed_cost";
  return "other_actual";
}

function freeeMonthlyAmount(node: FreeeBalanceNode, category: string): number {
  const debit = asNumber(node.debit_amount);
  const credit = asNumber(node.credit_amount);
  if (debit !== null || credit !== null) {
    if (category === "revenue") return (credit ?? 0) - (debit ?? 0);
    return (debit ?? 0) - (credit ?? 0);
  }
  return asNumber(node.closing_balance) ?? 0;
}

async function importFreeeActuals(supabase: SupabaseClient, ym: string, startDate: string, endDate: string): Promise<RawSignal[]> {
  const endpoint = `/api/1/reports/trial_pl?start_date=${startDate}&end_date=${endDate}`;
  const payload = await freeeGet(supabase, endpoint);
  const nodes = walkFreeeBalances(payload);
  const sourceRef = `freee:trial_pl:${ym}:${startDate}:${endDate}`;
  const rows = nodes
    .map((node) => {
      const category = freeeCategory(node);
      const amount = freeeMonthlyAmount(node, category);
      const accountId = String(node.account_item_id ?? node.id ?? stableHash(node).slice(0, 16));
      return {
        ym,
        scope: "company",
        project_id: null,
        category,
        account_name: String(node.account_item_name || node.account_category_name || node.name || accountId),
        actual_amount_yen: Math.round(amount),
        freee_account_item_id: accountId,
        freee_partner_id: null,
        source_ref: sourceRef,
        raw_hash: stableHash(node),
        payload: node as Record<string, unknown>,
      };
    })
    .filter((row) => row.account_name && row.actual_amount_yen !== 0);

  await supabase.from("company_actual_monthly").delete().eq("ym", ym).eq("scope", "company").eq("source_ref", sourceRef);
  if (rows.length > 0) {
    const { error } = await supabase.from("company_actual_monthly").insert(rows);
    if (error) throw new Error(`company_actual_monthly insert: ${error.message}`);
  }

  return rows.map((row) => signal({
    ym,
    axis: "finance",
    source_kind: "freee_trial_pl",
    source_table: "freee.trial_pl",
    source_id: `${row.freee_account_item_id}:${row.account_name}`,
    signal_key: `freee_actual:${row.category}`,
    signal_value_numeric: row.actual_amount_yen,
    signal_value_text: row.account_name,
    confidence: 0.9,
    weight_hint: Math.abs(row.actual_amount_yen),
    payload: row.payload,
  }));
}

async function insertSignals(supabase: SupabaseClient, runId: string, rows: RawSignal[]) {
  if (rows.length === 0) return;
  const payload = rows.map((row) => ({
    ...row,
    run_id: runId,
    source_hash: stableHash(row.payload ?? {}),
    payload: row.payload ?? {},
    confidence: row.confidence ?? 0.5,
    weight_hint: row.weight_hint ?? 1,
  }));
  for (let i = 0; i < payload.length; i += 500) {
    const chunk = payload.slice(i, i + 500);
    const { error } = await supabase
      .from("amd_management_score_raw_signals")
      .upsert(chunk, { onConflict: "ym,axis,source_table,source_id,signal_key" });
    if (error) throw new Error(`raw_signals upsert: ${error.message}`);
  }
}

async function deleteReplaceableRawSignals(supabase: SupabaseClient, ym: string) {
  const { error } = await supabase
    .from("amd_management_score_raw_signals")
    .delete()
    .eq("ym", ym)
    .neq("source_kind", "freee_actual");
  if (error) throw new Error(`raw_signals cleanup: ${error.message}`);
}

export async function collectManagementScoreRawData(
  supabase: SupabaseClient,
  options: CollectOptions = {}
): Promise<CollectResult> {
  const ym = options.ym || currentYmJST();
  const dateRange = ymToDateRange(ym);
  const startDate = options.freeeStartDate ?? dateRange.startDate;
  const endDate = options.freeeEndDate ?? dateRange.endDate;
  const errors: string[] = [];
  const counts: Record<string, number> = {};
  const { data: run, error: runError } = await supabase
    .from("amd_management_score_source_runs")
    .insert({
      ym,
      source_kind: options.includeFreee ? "os_internal+freee" : "os_internal",
      source: "management_score_raw_collector",
      status: "running",
      params: { includeFreee: !!options.includeFreee, startDate, endDate },
    })
    .select("id")
    .single();
  if (runError || !run) throw new Error(`source run insert failed: ${runError?.message || "no row"}`);
  const runId = String(run.id);

  try {
    // 🔧 2026-05-27 バグ修正: freee 取り込みを **internal collect より先に** 走らせる必要がある。
    //
    // 旧設計: collectInternalSignals → importFreeeActuals の順だと、 internal 内で fetch する
    // `company_budget_actual_monthly` (= VIEW) が `company_actual_monthly` を JOIN してるため、
    // freee actual がまだ company_actual_monthly に未投入の状態で view を fetch してしまい、
    // 売上高 ¥2.72M などの freee 由来 actual 行が raw_signals に乗らないバグがあった
    // (= まさが freee で売上仕訳しても evidence で「実績 0 円」 と表示される事故、 2026-05-27)。
    //
    // 修正: freee → internal の順にして、 internal が view fetch するとき既に
    // company_actual_monthly に freee actual が入ってる状態にする。
    if (options.includeFreee) {
      try {
        await supabase
          .from("amd_management_score_raw_signals")
          .delete()
          .eq("ym", ym)
          .eq("source_table", "freee.trial_pl");
        await supabase
          .from("amd_management_score_raw_signals")
          .delete()
          .eq("ym", ym)
          .eq("source_kind", "freee_actual");
        const freeeSignals = await importFreeeActuals(supabase, ym, startDate ?? ymToDateRange(ym).startDate, endDate ?? ymToDateRange(ym).endDate);
        counts.freee = freeeSignals.length;
        await insertSignals(supabase, runId, freeeSignals);
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
        counts.freee = 0;
      }
    }

    await deleteReplaceableRawSignals(supabase, ym);
    const internal = await collectInternalSignals(supabase, ym);
    counts.internal = internal.length;
    await insertSignals(supabase, runId, internal);

    const status: RunStatus = errors.length ? "partial" : "success";
    await supabase
      .from("amd_management_score_source_runs")
      .update({ status, stats: counts, error: errors.join("\n") || null, finished_at: new Date().toISOString() })
      .eq("id", runId);
    return { ok: !errors.length, ym, runId, status, counts, errors };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await supabase
      .from("amd_management_score_source_runs")
      .update({ status: "failed", stats: counts, error: message, finished_at: new Date().toISOString() })
      .eq("id", runId);
    throw error;
  }
}
