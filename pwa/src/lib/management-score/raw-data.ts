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

function textIncludesAny(value: unknown, patterns: string[]) {
  const text = String(value ?? "").toLowerCase();
  return patterns.some((pattern) => text.includes(pattern.toLowerCase()));
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

async function collectInternalSignals(supabase: SupabaseClient, ym: string): Promise<RawSignal[]> {
  const [memberActivities, budgetActuals, actuals, billing, financeItems, receiptEvents, projects, milestones, freezes, meetings, seeds, seedContacts, registryDiffs, knowledge, scoreInputs, protocols, ventures, atlasSignals, macroIndex] = await Promise.all([
    fetchAll(supabase, "member_activities", "id,member_id,project_id,ym,source,source_item_id,title,content_preview,item_date,raw_metadata,milestone_id,initiative_origin,impact,depth,reject_reason", (q) => q.eq("ym", ym)),
    fetchAll(supabase, "company_budget_actual_monthly", "ym,scope,project_id,category,account_name,budget_amount_yen,actual_amount_yen,variance_yen,cash_amount_yen,runway_months,budget_version,freee_account_item_id,freee_partner_id,budget_payload,actual_payload", (q) => q.eq("ym", ym)),
    fetchAll(supabase, "company_actual_monthly", "id,ym,scope,project_id,category,account_name,actual_amount_yen,freee_account_item_id,freee_partner_id,source_ref,raw_hash,payload,imported_at", (q) => q.eq("ym", ym)),
    fetchAll(supabase, "billing_cycles", "id,project_id,ym,budget_yen,status,meeting_start_at,report_fixed_at,invoice_sent_at,payment_confirmed_at,budget_confirmed_at,invoice_issued_at,invoice_ym,freee_invoice_number,updated_at", (q) => q.eq("ym", ym)),
    fetchAll(supabase, "company_finance_recurring_items", "id,status,item_kind,display_name,vendor_name,category,amount_yen,frequency,start_ym,end_ym,budget_forward_fill,auto_debit,withdrawal_account,payment_method,source_kind,source_ref,last_receipt_at,last_budget_synced_at,notes,updated_at"),
    fetchAll(supabase, "company_finance_receipt_events", "id,recurring_item_id,ym,receipt_date,vendor_name,amount_yen,payment_method,withdrawal_account,subject,source_kind,source_ref,raw_hash,status,created_at,updated_at", (q) => q.or(`ym.eq.${ym},created_at.gte.${monthStartIso(ym)}`).lt("created_at", monthEndExclusiveIso(ym))),
    fetchAll(supabase, "projects", "project_id,project_name,status,client_name,start_ym,end_ym,fee_type,fee_amount,freee_partner_id,freeze_from_ym,restart_expected_ym,updated_at"),
    fetchAll(supabase, "milestone_monthly_progress", "id,milestone_key,ym,progress_pct,consumed_pt,source,confirmed_at,note", (q) => q.eq("ym", ym)),
    fetchAll(supabase, "project_freeze_periods", "period_id,project_id,freeze_from_ym,restart_ym,status,reason,source,source_ref,updated_at"),
    fetchAll(supabase, "project_meeting_summaries", "meeting_id,project_id,ym,meeting_date,title,summary_short,decided,progress,next_actions,risks,source_hash,source_url,updated_at", (q) => q.eq("ym", ym)),
    fetchAll(supabase, "seeds", "id,title,summary,org_name,domain_lane,trl,brl,hrl,status,amd_rating,next_action,source,source_detail,created_at,updated_at,spun_off_project_id"),
    fetchAll(supabase, "seed_contact_log", "id,seed_id,contacted_on,method,amd_member_id,note,next_action,created_at,updated_at", (q) => q.gte("contacted_on", `${ym.slice(0, 4)}-${ym.slice(4, 6)}-01`).lt("contacted_on", `${nextYm(ym).slice(0, 4)}-${nextYm(ym).slice(4, 6)}-01`)),
    fetchAll(supabase, "project_registry_diffs", "diff_id,project_id,ym,scope_key,diff_kind,target_table,target_key,proposed_patch_json,evidence_refs_json,confidence,status,created_at,updated_at", (q) => q.or(`ym.eq.${ym},created_at.gte.${monthStartIso(ym)}`).lt("created_at", monthEndExclusiveIso(ym))),
    fetchAll(supabase, "project_knowledge", "id,project_id,category,entity_name,fact_text,confidence,source,status,updated_at", (q) => q.gte("updated_at", monthStartIso(ym)).lt("updated_at", monthEndExclusiveIso(ym))),
    fetchAll(supabase, "amd_score_inputs", "id,project_id,evaluated_at,mu_a,mu_i,mu_g,trl,brl,grl,srl,hrl,frl,frl_grit,frl_resilience,evaluator,notes,updated_at", (q) => q.lte("evaluated_at", monthEndExclusiveIso(ym))),
    fetchAll(supabase, "protocols", "id,protocol_id,project_id,title,status,importance,source,tags,is_universal,kind,created_at,updated_at"),
    fetchAll(supabase, "project_ventures", "project_id,lane,lanes,display_name,outcome_pattern,amd_role,amd_support_started_at,amd_support_ended_at,updated_at"),
    fetchAll(supabase, "atlas_signals", "id,title,content,source_url,source_type,domain,suggested_tags,importance,status,submitted_at,reviewed_at,metadata", (q) => q.gte("submitted_at", monthStartIso(ym)).lt("submitted_at", monthEndExclusiveIso(ym))),
    fetchAll(supabase, "macro_index_log", "id,lane,observed_at,index_value,policy_density,budget_amount,investment_amount,policy_mention_count,raw_signal_count,computed_at", (q) => q.gte("observed_at", `${ym.slice(0, 4)}-${ym.slice(4, 6)}-01`).lte("observed_at", ymToDateRange(ym).endDate)),
  ]);

  const signals: RawSignal[] = [];

  for (const row of memberActivities) {
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

  for (const row of milestones) {
    signals.push(signal({
      ym,
      axis: "retention",
      source_kind: "progress",
      source_table: "milestone_monthly_progress",
      source_id: String(row.id),
      signal_key: row.confirmed_at ? "milestone:confirmed_progress" : "milestone:estimated_progress",
      signal_value_numeric: asNumber(row.progress_pct),
      signal_value_text: String(row.source || ""),
      observed_at: row.confirmed_at ? String(row.confirmed_at) : null,
      confidence: row.confirmed_at ? 0.9 : 0.6,
      weight_hint: asNumber(row.consumed_pt) ?? 1,
      payload: row,
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
    signals.push(signal({
      ym,
      axis: "retention",
      source_kind: "meeting_summary",
      source_table: "project_meeting_summaries",
      source_id: String(row.meeting_id),
      signal_key: textIncludesAny(risksText, ["停止", "失注", "予算", "遅延", "リスク"]) ? "meeting:risk" : "meeting:progress",
      signal_value_numeric: (Array.isArray(row.progress) ? row.progress.length : 0) - (Array.isArray(row.risks) ? row.risks.length : 0),
      signal_value_text: String(row.summary_short || row.title || ""),
      project_id: String(row.project_id),
      observed_at: row.meeting_date ? `${row.meeting_date}T00:00:00.000Z` : null,
      confidence: 0.7,
      weight_hint: 1 + (Array.isArray(row.decided) ? row.decided.length : 0),
      payload: { ...row, nextText, decidedText, risksText },
    }));
  }

  for (const row of seeds) {
    signals.push(signal({
      ym,
      axis: "pipeline",
      source_kind: "seed",
      source_table: "seeds",
      source_id: String(row.id),
      signal_key: `seed:${row.status || "unknown"}`,
      signal_value_numeric: asNumber(row.amd_rating),
      signal_value_text: String(row.title || ""),
      project_id: row.spun_off_project_id ? String(row.spun_off_project_id) : null,
      observed_at: row.updated_at ? String(row.updated_at) : null,
      confidence: 0.65,
      weight_hint: asNumber(row.amd_rating) ?? 1,
      payload: row,
    }));
  }

  for (const row of seedContacts) {
    signals.push(signal({
      ym,
      axis: "pipeline",
      source_kind: "seed_contact",
      source_table: "seed_contact_log",
      source_id: String(row.id),
      signal_key: "seed:contacted",
      signal_value_numeric: 1,
      signal_value_text: String(row.next_action || row.note || ""),
      observed_at: row.contacted_on ? `${row.contacted_on}T00:00:00.000Z` : null,
      confidence: 0.8,
      weight_hint: 2,
      payload: row,
    }));
  }

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

  for (const row of scoreInputs) {
    signals.push(signal({
      ym,
      axis: "direction",
      source_kind: "amd_score",
      source_table: "amd_score_inputs",
      source_id: String(row.id),
      signal_key: "amd_score:latest_project_score_inputs",
      signal_value_numeric: [
        asNumber(row.trl),
        asNumber(row.brl),
        asNumber(row.grl),
        asNumber(row.srl),
        asNumber(row.hrl),
        asNumber(row.frl),
      ].filter((n): n is number => n !== null).reduce((a, b, _, arr) => a + b / arr.length, 0),
      signal_value_text: String(row.evaluator || ""),
      project_id: String(row.project_id),
      observed_at: row.evaluated_at ? String(row.evaluated_at) : null,
      confidence: 0.7,
      weight_hint: 1,
      payload: row,
    }));
  }

  for (const row of protocols) {
    signals.push(signal({
      ym,
      axis: "direction",
      source_kind: "protocol",
      source_table: "protocols",
      source_id: String(row.id),
      signal_key: `protocol:${row.status || "unknown"}:${row.kind || "pattern"}`,
      signal_value_numeric: asNumber(row.importance),
      signal_value_text: String(row.title || ""),
      project_id: row.project_id ? String(row.project_id) : null,
      observed_at: row.updated_at ? String(row.updated_at) : null,
      confidence: 0.7,
      weight_hint: asNumber(row.importance) ?? 1,
      payload: row,
    }));
  }

  for (const row of ventures) {
    signals.push(signal({
      ym,
      axis: "direction",
      source_kind: "venture_portfolio",
      source_table: "project_ventures",
      source_id: String(row.project_id),
      signal_key: `venture:${row.outcome_pattern || "unknown"}`,
      signal_value_text: String(row.display_name || row.project_id),
      project_id: String(row.project_id),
      observed_at: row.updated_at ? String(row.updated_at) : null,
      confidence: 0.75,
      weight_hint: row.amd_support_ended_at ? 0.5 : 2,
      payload: row,
    }));
  }

  for (const row of atlasSignals) {
    signals.push(signal({
      ym,
      axis: "direction",
      source_kind: "atlas",
      source_table: "atlas_signals",
      source_id: String(row.id),
      signal_key: `atlas:${row.domain || "unknown"}:${row.importance || "medium"}`,
      signal_value_text: String(row.title || ""),
      observed_at: row.submitted_at ? String(row.submitted_at) : null,
      confidence: 0.55,
      weight_hint: row.importance === "high" ? 3 : row.importance === "low" ? 0.5 : 1,
      payload: row,
    }));
  }

  for (const row of macroIndex) {
    signals.push(signal({
      ym,
      axis: "direction",
      source_kind: "macro_index",
      source_table: "macro_index_log",
      source_id: String(row.id),
      signal_key: `macro:${row.lane || "unknown"}`,
      signal_value_numeric: asNumber(row.index_value),
      signal_value_text: String(row.lane || ""),
      observed_at: row.observed_at ? `${row.observed_at}T00:00:00.000Z` : null,
      confidence: 0.65,
      weight_hint: asNumber(row.raw_signal_count) ?? 1,
      payload: row,
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
    const internal = await collectInternalSignals(supabase, ym);
    counts.internal = internal.length;
    await insertSignals(supabase, runId, internal);

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
