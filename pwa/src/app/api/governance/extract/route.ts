import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Gmail/Drive/Calendar 等から抽出した「総会・取締役会・書面決議」候補の入口。
// 既定は review 候補として l2_coverage_gaps に積む。apply=true のときだけ
// project_shareholder_meetings に canonical insert する。

type Resolution = { title?: string | null; type?: string | null; result?: string | null };
type Attachment = { name?: string | null; url?: string | null; kind?: string | null };

type GovernanceMeetingCandidate = {
  project_id?: string | null;
  meeting_type?: string | null;
  meeting_date?: string | null;
  location?: string | null;
  agenda_summary?: string | null;
  resolutions_json?: unknown;
  resolutions?: Resolution[] | null;
  amd_response?: string | null;
  amd_response_at?: string | null;
  related_action_id?: string | null;
  attachments_json?: unknown;
  attachments?: Attachment[] | null;
  source?: string | null;
  source_ref?: string | null;
  source_hash?: string | null;
  notes?: string | null;
};

async function authorize(req: NextRequest): Promise<boolean> {
  const auth = req.headers.get("authorization") || "";
  const cronSecret = process.env.CRON_SECRET || "";
  if (cronSecret && auth === `Bearer ${cronSecret}`) return true;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return false;
  const { data: member } = await supabase.from("members").select("is_admin").eq("email", user.email.toLowerCase()).maybeSingle();
  return !!member?.is_admin;
}

function text(value: unknown, max = 1000) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function meetingYm(date: string | null) {
  return date && /^\d{4}-\d{2}/.test(date) ? date.replace(/-/g, "").slice(0, 6) : null;
}

function stableHash(item: GovernanceMeetingCandidate) {
  const provided = String(item.source_hash || "").trim();
  if (provided) return provided;
  const payload = JSON.stringify({
    project_id: item.project_id ?? null,
    meeting_type: item.meeting_type ?? null,
    meeting_date: item.meeting_date ?? null,
    source_ref: item.source_ref ?? null,
    agenda_summary: item.agenda_summary ?? null,
  });
  return createHash("sha256").update(payload).digest("hex");
}

function normalizeMeetingType(value: string | null | undefined) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "board";
  if (["agm", "annual", "annual_general_meeting", "定時株主総会"].includes(raw)) return "agm";
  if (["egm", "extraordinary", "extraordinary_general_meeting", "臨時株主総会"].includes(raw)) return "egm";
  if (["board", "board_meeting", "取締役会"].includes(raw)) return "board";
  if (["board_written", "board_written_resolution", "取締役書面決議", "取締役会書面決議"].includes(raw)) return "board_written_resolution";
  if (["shareholder_written", "shareholder_written_resolution", "株主総会書面決議", "株主書面決議"].includes(raw)) return "shareholder_written_resolution";
  return raw.slice(0, 80);
}

function asJsonArray(value: unknown, fallback: unknown) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(fallback)) return fallback;
  return [];
}

function buildMeetingRow(item: GovernanceMeetingCandidate, sourceHash: string) {
  const meetingDate = text(item.meeting_date, 20);
  const source = text(item.source, 40) || "gmail";
  const sourceRef = text(item.source_ref, 300) || `hash:${sourceHash}`;
  const sourceNote = `source=${source}; source_hash=${sourceHash}`;
  const notes = [text(item.notes, 2000), sourceNote].filter(Boolean).join("\n");

  return {
    project_id: text(item.project_id, 40),
    meeting_type: normalizeMeetingType(item.meeting_type),
    meeting_date: meetingDate,
    meeting_ym: meetingYm(meetingDate),
    location: text(item.location, 200),
    agenda_summary: text(item.agenda_summary, 3000),
    resolutions_json: asJsonArray(item.resolutions_json, item.resolutions),
    amd_response: text(item.amd_response, 80),
    amd_response_at: text(item.amd_response_at, 80),
    related_action_id: text(item.related_action_id, 140),
    attachments_json: asJsonArray(item.attachments_json, item.attachments),
    source_ref: sourceRef,
    notes,
  };
}

async function canonicalExists(db: ReturnType<typeof createAdminClient>, row: ReturnType<typeof buildMeetingRow>) {
  if (!row.project_id) return true;
  if (row.source_ref) {
    const { data, error } = await db
      .from("project_shareholder_meetings")
      .select("id")
      .eq("project_id", row.project_id)
      .eq("source_ref", row.source_ref)
      .limit(1);
    if (!error && data && data.length > 0) return true;
  }

  let q = db
    .from("project_shareholder_meetings")
    .select("id")
    .eq("project_id", row.project_id)
    .eq("meeting_type", row.meeting_type);
  q = row.meeting_date ? q.eq("meeting_date", row.meeting_date) : q.is("meeting_date", null);
  if (row.agenda_summary) q = q.eq("agenda_summary", row.agenda_summary);
  const { data } = await q.limit(1);
  return !!data?.length;
}

function notificationFor(kind: "coverage_gap" | "shareholder_meeting", targetId: string, scopeKey: string, item: GovernanceMeetingCandidate) {
  const source = text(item.source, 40) || "gmail";
  const meetingType = normalizeMeetingType(item.meeting_type);
  const title = item.agenda_summary || item.source_ref || "総会・取締役会候補";
  return {
    l2_kind: kind,
    target_id: targetId,
    scope_key: scopeKey,
    title: kind === "coverage_gap" ? `ガバナンス履歴候補: ${String(title).slice(0, 100)}` : `ガバナンス履歴追加: ${String(title).slice(0, 100)}`,
    summary: item.notes || `${source} 由来の ${meetingType} 候補`,
    saved_count: 1,
    total_count: 1,
    importance: /written|書面|board/.test(meetingType) ? 8 : 6,
    notified_at: new Date().toISOString(),
    metadata_json: {
      proposed_target_l2: "shareholder_meeting",
      source,
      source_ref: item.source_ref ?? null,
      meeting_type: meetingType,
      meeting_date: item.meeting_date ?? null,
    },
  };
}

export async function POST(req: NextRequest) {
  if (!(await authorize(req))) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const items: GovernanceMeetingCandidate[] = Array.isArray(body?.items) ? body.items : [];
  if (items.length === 0) return NextResponse.json({ ok: false, error: "items[] required" }, { status: 400 });

  const apply = body?.apply === true || body?.mode === "apply";
  const dryRun = body?.dry_run === true || body?.dryRun === true;
  const db = createAdminClient();
  const nowIso = new Date().toISOString();

  let inserted = 0;
  let skipped = 0;
  let notified = 0;
  const previews: Record<string, unknown>[] = [];
  const notifications: Record<string, unknown>[] = [];

  for (const item of items) {
    const projectId = text(item.project_id, 40);
    const agenda = text(item.agenda_summary, 3000);
    if (!projectId || !agenda) {
      skipped++;
      continue;
    }

    const sourceHash = stableHash(item);
    const row = buildMeetingRow(item, sourceHash);
    previews.push(row);
    if (dryRun) continue;

    if (apply) {
      if (await canonicalExists(db, row)) {
        skipped++;
        continue;
      }
      const { data, error } = await db.from("project_shareholder_meetings").insert(row).select("id").single();
      if (error) {
        skipped++;
        continue;
      }
      inserted++;
      notifications.push(notificationFor("shareholder_meeting", projectId, data.id as string, item));
      continue;
    }

    const gapId = `cg:${sourceHash}`.slice(0, 120);
    const { data: existing } = await db.from("l2_coverage_gaps").select("gap_id").eq("source_hash", sourceHash).limit(1);
    if (existing?.length) {
      skipped++;
      continue;
    }

    const { error } = await db.from("l2_coverage_gaps").insert({
      gap_id: gapId,
      source: text(item.source, 40) || "gmail",
      source_ref: row.source_ref,
      source_hash: sourceHash,
      title: agenda.slice(0, 300),
      summary: item.notes ?? null,
      salience_score: 0.9,
      matched_patterns: {
        kind: "governance_meeting",
        meeting_type: row.meeting_type,
        written_resolution: /written|書面/.test(`${row.meeting_type}\n${row.location}`),
      },
      proposed_target_l2: "shareholder_meeting",
      gap_class: "extractor_miss",
      project_id: projectId,
      scope: "project",
      due_at: null,
      evidence_refs_json: { governance_meeting: row },
      review_status: "candidate",
      created_by: "governance_extract",
      detected_at: nowIso,
    });
    if (error) {
      skipped++;
      continue;
    }
    inserted++;
    notifications.push(notificationFor("coverage_gap", projectId, gapId, item));
  }

  if (!dryRun && notifications.length > 0) {
    const { error } = await db.from("l2_notifications").insert(notifications);
    if (!error) notified = notifications.length;
  }

  return NextResponse.json({ ok: true, mode: apply ? "apply" : "candidate", dryRun, inserted, skipped, notified, previews });
}
