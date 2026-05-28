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

function sha256(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function todayJstYmd(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
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

  // ON CONFLICT (project_id, scope_key, signal_type, source_hash) → update
  const { data, error } = await admin
    .from("project_strategy_signals")
    .upsert(row, { onConflict: "project_id,scope_key,signal_type,source_hash" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, signal: data, mode: "inserted" });
}
