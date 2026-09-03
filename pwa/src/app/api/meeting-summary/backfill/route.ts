/**
 * POST /api/meeting-summary/backfill
 *
 * 欠損した開催済み議事録を、後から正規の手順で埋める。
 *
 * 既存の2経路では埋められない:
 *   - `/api/meeting-summary/manual-update` は行が無いと 404 を返す
 *   - `/api/meeting-summary/narrate` は upcoming 行と source_kinds='upcoming' を除外する
 * そのため今までは手作業でDBへ直接入れるしかなく、正規手順が存在しなかった。
 *
 * 約束:
 *   - 予定カード (`upcoming:` 行) は消さない。確定版を `meeting_id=<calendar_event_id>` の
 *     別行として作る。2026-06-10 の p07 手動取り込みと 2026-09-02 の p21 の前例に合わせる。
 *   - 議事録本文は Phase D-1 と同じ品質gateを通す。summary_short と配列だけの直書きは通さない。
 *   - 既存の確定版がある場合は既定で上書きしない (`overwrite: true` を明示したときだけ)。
 *   - 埋めたら欠損台帳を `recovered` にする。
 *   - `dry_run` 既定 true。実際に書くのは `"dry_run": false` を明示したときだけ。
 */

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { checkNarrative } from "@/lib/meeting/narrative-gate";

export const dynamic = "force-dynamic";

type Authorized = { ok: true; createdBy: string } | { ok: false; res: NextResponse };

async function authorize(req: NextRequest): Promise<Authorized> {
  const auth = req.headers.get("authorization") || "";
  const workflowSecret = process.env.WORKFLOW_SECRET || process.env.CRON_SECRET || "";
  if (workflowSecret && auth === `Bearer ${workflowSecret}`) return { ok: true, createdBy: "workflow" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) {
    return { ok: false, res: NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 }) };
  }
  const { data: member } = await supabase
    .from("members")
    .select("code_name, is_admin")
    .eq("email", user.email.toLowerCase())
    .maybeSingle();
  if (!member?.is_admin) {
    return { ok: false, res: NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 }) };
  }
  return { ok: true, createdBy: member.code_name || user.email };
}

function text(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => (typeof v === "string" ? v.trim() : String(v ?? "").trim()))
    .filter(Boolean)
    .slice(0, 80);
}

/** `2026-08-19T07:00:00Z` -> `{ date: '2026-08-19', ym: '202608' }` (JST基準) */
function jstParts(startAt: string): { date: string; ym: string } | null {
  const time = Date.parse(startAt);
  if (!Number.isFinite(time)) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(time)).reduce<Record<string, string>>((acc, p) => ({ ...acc, [p.type]: p.value }), {});
  if (!parts.year || !parts.month || !parts.day) return null;
  return { date: `${parts.year}-${parts.month}-${parts.day}`, ym: `${parts.year}${parts.month}` };
}

export async function POST(req: NextRequest) {
  const authz = await authorize(req);
  if (!authz.ok) return authz.res;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });

  const dryRun = body.dry_run !== false;
  const overwrite = body.overwrite === true;

  const calendarEventId = text(body.calendar_event_id, 300);
  const projectId = text(body.project_id, 40);
  const title = text(body.title, 500);
  const meetingStartAt = text(body.meeting_start_at, 60);
  const sourceKinds = text(body.source_kinds, 200);
  const narrative = typeof body.narrative_md === "string" ? body.narrative_md.trim() : "";

  if (!calendarEventId || !projectId || !title || !meetingStartAt) {
    return NextResponse.json({
      ok: false,
      error: "calendar_event_id, project_id, title, meeting_start_at are required",
    }, { status: 400 });
  }
  if (calendarEventId.startsWith("upcoming:")) {
    return NextResponse.json({
      ok: false,
      error: "calendar_event_id に upcoming: 接頭辞を渡さない。確定版は接頭辞なしの meeting_id で作る",
    }, { status: 400 });
  }
  if (!sourceKinds || sourceKinds === "none" || sourceKinds === "upcoming") {
    return NextResponse.json({
      ok: false,
      error: "source_kinds には実際に読めた取得元を入れる (例: notion+calendar)。none / upcoming は確定版にしない",
    }, { status: 400 });
  }

  const when = jstParts(meetingStartAt);
  if (!when) return NextResponse.json({ ok: false, error: "meeting_start_at が日時として読めない" }, { status: 400 });

  // 議事録本文は自動抽出と同じgateを通す。手動backfillを抜け道にしない。
  const gate = checkNarrative(narrative);
  if (!gate.ok) {
    return NextResponse.json({ ok: false, error: gate.message, code: gate.code }, { status: 422 });
  }

  const admin = createAdminClient();

  const { data: existing, error: existingError } = await admin
    .from("project_meeting_summaries")
    .select("meeting_id,narrative_md,source_kinds")
    .eq("meeting_id", calendarEventId)
    .maybeSingle();
  if (existingError) {
    return NextResponse.json({ ok: false, error: existingError.message }, { status: 500 });
  }
  if (existing && !overwrite) {
    return NextResponse.json({
      ok: false,
      error: "確定版が既にある。上書きするなら overwrite: true を明示する",
      existing_source_kinds: existing.source_kinds ?? null,
    }, { status: 409 });
  }

  const row = {
    meeting_id: calendarEventId,
    calendar_event_id: calendarEventId,
    project_id: projectId,
    ym: when.ym,
    meeting_date: when.date,
    meeting_start_at: meetingStartAt,
    title,
    source_kinds: sourceKinds,
    summary_short: text(body.summary_short, 2000) || title,
    decided: stringArray(body.decided),
    progress: stringArray(body.progress),
    next_actions: stringArray(body.next_actions),
    risks: stringArray(body.risks),
    narrative_md: narrative,
    notion_url: text(body.notion_url, 1000) || null,
    notion_page_id: text(body.notion_page_id, 200) || null,
    gmail_thread_ids: stringArray(body.gmail_thread_ids),
    prep_source_meeting_id: text(body.prep_source_meeting_id, 300) || null,
    source_hash: text(body.source_hash, 200) || null,
    generated_at: new Date().toISOString(),
    generated_by_model: text(body.generated_by_model, 200) || "manual-backfill",
  };

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dry_run: true,
      would_write: { ...row, narrative_md: `(${narrative.length}字)` },
      replaces_existing: Boolean(existing),
    });
  }

  const { data, error } = await admin
    .from("project_meeting_summaries")
    .upsert(row, { onConflict: "meeting_id" })
    .select("meeting_id,project_id,meeting_date,title,source_kinds")
    .single();
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  // 台帳を閉じる。gate 側も観測で閉じるが、埋めた側でも即座に閉じておく。
  const { error: ledgerError } = await admin
    .from("meeting_minutes_backfill_ledger")
    .update({ status: "recovered", last_outcome: "backfilled_via_api", last_error: null })
    .eq("calendar_event_id", calendarEventId);

  return NextResponse.json({
    ok: true,
    dry_run: false,
    meeting: data,
    backfilled_by: authz.createdBy,
    ledger_closed: !ledgerError,
    ledger_error: ledgerError?.message ?? null,
  });
}
