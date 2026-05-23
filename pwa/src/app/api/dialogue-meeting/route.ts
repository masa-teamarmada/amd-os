/**
 * POST /api/dialogue-meeting
 *
 * まさ × えいみ経営会議の議論ログを `project_meeting_summaries` に 1 行 upsert する。
 *
 * - meeting_id  = "dialogue:{project_id}:{YYYYMMDD-HHMMSS}"   (= 自動生成、衝突回避は秒精度で十分)
 * - source_kinds = "dialogue"
 * - decided / progress / next_actions / risks にバケツ分け
 *
 * cockpit の `CockpitMeetingSummary` が `source_kinds` 無関係に meeting_date DESC で
 * 表示するため、UI 側の修正なしでそのまま「経営会議ログ」がコックピット MTGサマリ欄に並ぶ。
 *
 * 会社全体スコープの議論は `project_id='p00'` を指定。
 *
 * 認証: admin (members.is_admin=true) または Authorization: Bearer ${CRON_SECRET}。
 *
 * Body:
 *   {
 *     project_id: string,            // "p21" / "p00" 等
 *     meeting_date?: string,         // "YYYY-MM-DD" (default = today JST)
 *     ym?: string,                   // "202605" (default = meeting_date から)
 *     title?: string,                // (default = "まさ × えいみ経営会議 (YYYY-MM-DD)")
 *     summary_short: string,         // 1 行サマリ
 *     decided?: string[],
 *     progress?: string[],
 *     next_actions?: string[],
 *     risks?: string[],
 *     related_signal_ids?: string[], // 紐付けた project_strategy_signals.signal_id 配列
 *     generated_by_model?: string,   // (default = "claude-opus-4-7")
 *   }
 *
 * Returns: { ok: true, meeting: ProjectMeetingSummary, mode: 'inserted'|'updated' }
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function sha256(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function nowJstParts(): { ymd: string; hms: string; ym: string } {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const iso = jst.toISOString();
  return {
    ymd: iso.slice(0, 10),
    hms: iso.slice(11, 19).replace(/:/g, ""),
    ym: iso.slice(0, 4) + iso.slice(5, 7),
  };
}

function ensureStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter((v) => v.length > 0)
    .slice(0, 30);
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
  const projectId = String(body.project_id ?? "").trim();
  const summaryShort = String(body.summary_short ?? "").trim();
  if (!projectId || !summaryShort) {
    return NextResponse.json({ error: "project_id and summary_short are required" }, { status: 400 });
  }

  const { ymd: todayYmd, hms, ym: todayYm } = nowJstParts();
  const meetingDate = typeof body.meeting_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.meeting_date)
    ? body.meeting_date
    : todayYmd;
  const ym = typeof body.ym === "string" && /^\d{6}$/.test(body.ym)
    ? body.ym
    : meetingDate.slice(0, 4) + meetingDate.slice(5, 7);
  const title = typeof body.title === "string" && body.title.trim()
    ? body.title.trim()
    : `まさ × えいみ経営会議 (${meetingDate})`;
  const decided = ensureStringArray(body.decided);
  const progress = ensureStringArray(body.progress);
  const nextActions = ensureStringArray(body.next_actions);
  const risks = ensureStringArray(body.risks);
  const relatedSignalIds = ensureStringArray(body.related_signal_ids);
  const generatedByModel = typeof body.generated_by_model === "string" && body.generated_by_model
    ? body.generated_by_model
    : "claude-opus-4-7";

  const meetingId = `dialogue:${projectId}:${todayYmd.replace(/-/g, "")}-${hms || "120000"}`;
  const sourceHash = sha256([
    projectId,
    meetingDate,
    title,
    summaryShort,
    ...decided,
    ...progress,
    ...nextActions,
    ...risks,
  ].join("\n"));

  const now = new Date().toISOString();
  const row: Record<string, unknown> = {
    meeting_id: meetingId,
    project_id: projectId,
    ym,
    meeting_date: meetingDate,
    meeting_start_at: now,
    title: title.slice(0, 500),
    summary_short: summaryShort.slice(0, 2000),
    decided,
    progress,
    next_actions: nextActions,
    risks,
    source_hash: sourceHash,
    source_kinds: "dialogue",
    generated_by_model: generatedByModel,
    gmail_thread_ids: [],
    notion_url: null,
    notion_page_id: null,
    calendar_event_id: null,
    source_url: relatedSignalIds.length > 0
      ? `internal://strategy-signals/${relatedSignalIds.join(",")}`
      : null,
    generated_at: now,
    updated_at: now,
  };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("project_meeting_summaries")
    .upsert(row, { onConflict: "meeting_id" })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, meeting: data, mode: "inserted", related_signal_ids: relatedSignalIds });
}
