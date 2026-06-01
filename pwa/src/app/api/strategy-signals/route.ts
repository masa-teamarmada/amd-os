/**
 * POST /api/strategy-signals
 *
 * L2 ⑨ 経営ハイライト (`project_strategy_signals`) への dialogue 経路 CRUD ハブ。
 *
 * 呼び元 (dialogue 経路のみ):
 *   - 提案前の論点整理セッション内で、確定経営判断を書き込む
 *   - 既存 candidate を confirm / reject に状態遷移する
 *
 * daily 抽出 (= Codex automation `amd-os`) は outbox + applier 経由なので
 * このAPIを使わない。outbox/applier 詳細は `pwa/design/project_strategy_signals.md` 参照。
 *
 * 認証: admin (members.is_admin=true) または Authorization: Bearer ${CRON_SECRET}。
 *
 * Body:
 *   {
 *     action: 'create' | 'update' | 'confirm' | 'reject',
 *
 *     signal_id?: string,           // update / confirm / reject 用
 *
 *     project_id?: string,          // create 用 (= "p21" / "p00")
 *     ym?: string | null,           // "202605" or null (PJ全体スコープ)
 *     signal_date?: string,         // "YYYY-MM-DD" (default = today JST)
 *     signal_type?:
 *       | 'management_decision' | 'business_progress' | 'strategic_pivot'
 *       | 'commercial_progress' | 'partnership' | 'funding'
 *       | 'ip_regulatory' | 'risk' | 'next_move',
 *     title?: string,
 *     summary?: string,
 *     impact_level?: 'low' | 'medium' | 'high' | 'critical',
 *     decision_state?: 'observed' | 'proposed' | 'decided' | 'executing' | 'revised',
 *     status?: 'candidate' | 'confirmed' | 'rejected' | 'archived',
 *     source_refs?: unknown[],      // [{kind, ref_id, snippet, source_url, hash}] 等
 *     source_hash?: string,         // 省略時は title+summary+signal_type+project_id+ym で SHA-256
 *     confidence?: number,          // 0-1
 *     signal_scope?: 'company' | 'project' | 'cross_project',
 *     applies_to_company_score?: boolean,
 *     pipeline_status?: 'prospect' | 'high_confidence' | 'contracting' | 'contracted' | 'lost' | 'deferred',
 *     pipeline_probability?: number,
 *     expected_amount_yen?: number,
 *     expected_contract_ym?: string, // YYYYMM
 *     company_score_axis?: 'pipeline' | 'funding' | 'runway' | 'finance' | 'capacity' | 'decision' | 'resource_allocation' | 'revenue',
 *     scope_reason?: string,
 *     created_by?: string,          // 'daily_routine' / 'dialogue' / 'まさ' / 'えいみ' 等
 *     confirmed_by?: string,
 *   }
 *
 * 同一 (project_id, scope_key, signal_type, source_hash) はテーブル UNIQUE で重複防止される。
 * `action='create'` は ON CONFLICT で update に倒す (= idempotent)。
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const VALID_TYPES = new Set([
  "management_decision",
  "business_progress",
  "strategic_pivot",
  "commercial_progress",
  "partnership",
  "funding",
  "ip_regulatory",
  "risk",
  "next_move",
]);
const VALID_IMPACT = new Set(["low", "medium", "high", "critical"]);
const VALID_STATE = new Set(["observed", "proposed", "decided", "executing", "revised"]);
const VALID_STATUS = new Set(["candidate", "confirmed", "rejected", "archived"]);
const VALID_SIGNAL_SCOPE = new Set(["company", "project", "cross_project"]);
const VALID_PIPELINE_STATUS = new Set(["prospect", "high_confidence", "contracting", "contracted", "lost", "deferred"]);
const VALID_COMPANY_SCORE_AXIS = new Set(["pipeline", "funding", "runway", "finance", "capacity", "decision", "resource_allocation", "revenue"]);

function sha256(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function todayJstYmd(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

function addCompanyScoreFields(patch: Record<string, unknown>, body: Record<string, unknown>) {
  if (typeof body.signal_scope === "string" && VALID_SIGNAL_SCOPE.has(body.signal_scope)) {
    patch.signal_scope = body.signal_scope;
  }
  if (typeof body.applies_to_company_score === "boolean") {
    patch.applies_to_company_score = body.applies_to_company_score;
  }
  if (typeof body.pipeline_status === "string" && VALID_PIPELINE_STATUS.has(body.pipeline_status)) {
    patch.pipeline_status = body.pipeline_status;
  }
  if (typeof body.pipeline_probability === "number") {
    patch.pipeline_probability = Math.max(0, Math.min(1, body.pipeline_probability));
  }
  if (typeof body.expected_amount_yen === "number" && Number.isFinite(body.expected_amount_yen)) {
    patch.expected_amount_yen = body.expected_amount_yen;
  }
  if (typeof body.expected_contract_ym === "string" && /^\d{6}$/.test(body.expected_contract_ym)) {
    patch.expected_contract_ym = body.expected_contract_ym;
  }
  if (typeof body.company_score_axis === "string" && VALID_COMPANY_SCORE_AXIS.has(body.company_score_axis)) {
    patch.company_score_axis = body.company_score_axis;
  }
  if (typeof body.scope_reason === "string") {
    patch.scope_reason = body.scope_reason.slice(0, 1000);
  }
}

function validateCompanyScoreFields(row: Record<string, unknown>): string | null {
  if (row.applies_to_company_score === true) {
    const scope = String(row.signal_scope || "");
    if (scope !== "company" && scope !== "cross_project") {
      return "applies_to_company_score=true requires signal_scope company/cross_project";
    }
    if (!row.company_score_axis) {
      return "applies_to_company_score=true requires company_score_axis";
    }
    if (!row.scope_reason) {
      return "applies_to_company_score=true requires scope_reason";
    }
  }
  if (row.pipeline_status && row.company_score_axis && row.company_score_axis !== "pipeline") {
    return "pipeline_status requires company_score_axis=pipeline";
  }
  if (row.status === "candidate" && row.applies_to_company_score === true && row.company_score_axis === "pipeline") {
    const probability = typeof row.pipeline_probability === "number" ? row.pipeline_probability : Number(row.confidence ?? 0);
    if (!Number.isFinite(probability) || probability < 0.75) {
      return "candidate company pipeline requires pipeline_probability/confidence >= 0.75";
    }
  }
  return null;
}

async function authorize(req: NextRequest): Promise<{ ok: true; createdBy: string } | { ok: false; res: NextResponse }> {
  const auth = req.headers.get("authorization") || "";
  const cronSecret = process.env.CRON_SECRET || "";
  if (cronSecret && auth === `Bearer ${cronSecret}`) {
    return { ok: true, createdBy: "cron" };
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) {
    return { ok: false, res: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }
  const { data: member } = await supabase
    .from("members")
    .select("code_name, is_admin")
    .eq("email", user.email.toLowerCase())
    .maybeSingle();
  if (!member?.is_admin) {
    return { ok: false, res: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  return { ok: true, createdBy: member.code_name || user.email };
}

export async function POST(req: NextRequest) {
  const authz = await authorize(req);
  if (!authz.ok) return authz.res;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action ?? "create").trim().toLowerCase();
  if (!["create", "update", "confirm", "reject"].includes(action)) {
    return NextResponse.json({ error: `unknown action: ${action}` }, { status: 400 });
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();

  if (action === "confirm" || action === "reject") {
    const signalId = String(body.signal_id ?? "").trim();
    if (!signalId) {
      return NextResponse.json({ error: "signal_id is required for confirm/reject" }, { status: 400 });
    }
    const status = action === "confirm" ? "confirmed" : "rejected";
    const confirmedBy = (body.confirmed_by ? String(body.confirmed_by) : authz.createdBy) || "dialogue";
    const decisionState = body.decision_state && VALID_STATE.has(String(body.decision_state))
      ? String(body.decision_state)
      : action === "confirm" ? "decided" : undefined;

    const patch: Record<string, unknown> = {
      status,
      confirmed_by: confirmedBy,
      confirmed_at: now,
      updated_at: now,
    };
    if (decisionState) patch.decision_state = decisionState;
    addCompanyScoreFields(patch, body);

    const { data: existing, error: existingError } = await admin
      .from("project_strategy_signals")
      .select("*")
      .eq("signal_id", signalId)
      .single();
    if (existingError || !existing) {
      return NextResponse.json({ error: existingError?.message || "signal not found" }, { status: 404 });
    }
    const validationError = validateCompanyScoreFields({ ...existing, ...patch });
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

    const { data, error } = await admin
      .from("project_strategy_signals")
      .update(patch)
      .eq("signal_id", signalId)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, signal: data, mode: "updated" });
  }

  if (action === "update") {
    const signalId = String(body.signal_id ?? "").trim();
    if (!signalId) return NextResponse.json({ error: "signal_id is required for update" }, { status: 400 });

    const patch: Record<string, unknown> = { updated_at: now };
    if (typeof body.ym === "string" || body.ym === null) patch.ym = body.ym;
    if (typeof body.signal_date === "string") patch.signal_date = body.signal_date;
    if (typeof body.title === "string") patch.title = body.title.slice(0, 500);
    if (typeof body.summary === "string") patch.summary = body.summary.slice(0, 4000);
    if (typeof body.signal_type === "string" && VALID_TYPES.has(body.signal_type)) patch.signal_type = body.signal_type;
    if (typeof body.impact_level === "string" && VALID_IMPACT.has(body.impact_level)) patch.impact_level = body.impact_level;
    if (typeof body.decision_state === "string" && VALID_STATE.has(body.decision_state)) patch.decision_state = body.decision_state;
    if (typeof body.status === "string" && VALID_STATUS.has(body.status)) patch.status = body.status;
    if (Array.isArray(body.source_refs)) patch.source_refs_json = body.source_refs;
    if (typeof body.confidence === "number") patch.confidence = Math.max(0, Math.min(1, body.confidence));
    if (typeof body.confirmed_by === "string") patch.confirmed_by = body.confirmed_by;
    addCompanyScoreFields(patch, body);

    const { data: existing, error: existingError } = await admin
      .from("project_strategy_signals")
      .select("*")
      .eq("signal_id", signalId)
      .single();
    if (existingError || !existing) {
      return NextResponse.json({ error: existingError?.message || "signal not found" }, { status: 404 });
    }
    const validationError = validateCompanyScoreFields({ ...existing, ...patch });
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

    const { data, error } = await admin
      .from("project_strategy_signals")
      .update(patch)
      .eq("signal_id", signalId)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, signal: data, mode: "updated" });
  }

  // action === "create"
  const projectId = String(body.project_id ?? "").trim();
  const signalType = String(body.signal_type ?? "").trim();
  const title = String(body.title ?? "").trim();
  const summary = String(body.summary ?? "").trim();
  if (!projectId || !signalType || !title || !summary) {
    return NextResponse.json({ error: "project_id, signal_type, title, summary are required" }, { status: 400 });
  }
  if (!VALID_TYPES.has(signalType)) {
    return NextResponse.json({ error: `unknown signal_type: ${signalType}` }, { status: 400 });
  }

  const ymRaw = body.ym;
  const ym = typeof ymRaw === "string" && /^\d{6}$/.test(ymRaw) ? ymRaw : null;
  const signalDate = typeof body.signal_date === "string" ? body.signal_date : todayJstYmd();
  const impactLevel = typeof body.impact_level === "string" && VALID_IMPACT.has(body.impact_level) ? body.impact_level : "medium";
  const decisionState = typeof body.decision_state === "string" && VALID_STATE.has(body.decision_state) ? body.decision_state : "proposed";
  const status = typeof body.status === "string" && VALID_STATUS.has(body.status) ? body.status : "candidate";
  const sourceRefs = Array.isArray(body.source_refs) ? body.source_refs : [];
  const confidence = typeof body.confidence === "number" ? Math.max(0, Math.min(1, body.confidence)) : 0.6;
  const createdBy = typeof body.created_by === "string" && body.created_by ? body.created_by : authz.createdBy;
  const confirmedBy = typeof body.confirmed_by === "string" ? body.confirmed_by : (status === "confirmed" ? createdBy : null);

  const baseHash = typeof body.source_hash === "string" && body.source_hash
    ? body.source_hash
    : sha256([projectId, ym || "global", signalType, title, summary].join("\n"));

  const row: Record<string, unknown> = {
    project_id: projectId,
    ym,
    signal_date: signalDate,
    signal_type: signalType,
    title: title.slice(0, 500),
    summary: summary.slice(0, 4000),
    impact_level: impactLevel,
    decision_state: decisionState,
    status,
    source_refs_json: sourceRefs,
    source_hash: baseHash,
    confidence,
    created_by: createdBy,
    confirmed_by: confirmedBy,
    confirmed_at: status === "confirmed" ? now : null,
    updated_at: now,
  };
  addCompanyScoreFields(row, body);
  const validationError = validateCompanyScoreFields(row);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

  // ON CONFLICT (project_id, scope_key, signal_type, source_hash) → update
  const { data, error } = await admin
    .from("project_strategy_signals")
    .upsert(row, { onConflict: "project_id,scope_key,signal_type,source_hash" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, signal: data, mode: "inserted" });
}
