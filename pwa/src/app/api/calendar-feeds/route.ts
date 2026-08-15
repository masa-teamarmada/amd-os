/**
 * 予定表の公開URL(ICS)の登録・一覧・同期。
 *
 * 認証: admin (members.is_admin=true)。
 *
 * **feed_url はレスポンスへ返さない。** 知っていれば認証なしで相手の予定が読めるため、
 * 一覧では末尾4文字の指紋だけを見せる。
 *
 * GET  … 登録済みフィードと直近の取り込み状況
 * POST … { action: "register" | "sync" | "update_status" }
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { feedFingerprint } from "@/lib/calendar-ics";
import { syncCalendarFeed } from "@/lib/calendar-feed-sync";

export const dynamic = "force-dynamic";

async function authorize(): Promise<{ ok: true; actor: string } | { ok: false; res: NextResponse }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
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
  return { ok: true, actor: member.code_name || user.email };
}

export async function GET(req: NextRequest) {
  const authz = await authorize();
  if (!authz.ok) return authz.res;

  const projectId = req.nextUrl.searchParams.get("projectId");
  const db = createAdminClient();

  let sourceQuery = db
    .from("calendar_feed_sources")
    .select(
      "id,project_id,owner_label,feed_url,provider,visibility_level,status,consent_note,last_fetched_at,last_fetch_status,last_event_count",
    )
    .order("created_at");
  if (projectId) sourceQuery = sourceQuery.eq("project_id", projectId);

  const { data: sources, error } = await sourceQuery;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const sourceIds = (sources ?? []).map((row) => String(row.id));
  let events: Array<Record<string, unknown>> = [];
  if (sourceIds.length > 0) {
    const { data: eventRows } = await db
      .from("calendar_feed_events")
      .select("id,source_id,project_id,summary,location,starts_at,ends_at,is_all_day,link_state,disappeared_at")
      .in("source_id", sourceIds)
      .is("disappeared_at", null)
      .order("starts_at", { ascending: true })
      .limit(200);
    events = eventRows ?? [];
  }

  return NextResponse.json({
    // feed_url は返さない。指紋だけ。
    sources: (sources ?? []).map((row) => ({
      id: row.id,
      projectId: row.project_id,
      ownerLabel: row.owner_label,
      urlFingerprint: feedFingerprint(String(row.feed_url)),
      provider: row.provider,
      visibilityLevel: row.visibility_level,
      status: row.status,
      consentNote: row.consent_note,
      lastFetchedAt: row.last_fetched_at,
      lastFetchStatus: row.last_fetch_status,
      lastEventCount: row.last_event_count,
    })),
    events: events.map((row) => ({
      id: row.id,
      sourceId: row.source_id,
      summary: row.summary,
      location: row.location,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      isAllDay: row.is_all_day,
      linkState: row.link_state,
    })),
  });
}

export async function POST(req: NextRequest) {
  const authz = await authorize();
  if (!authz.ok) return authz.res;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action ?? "");
  const db = createAdminClient();

  if (action === "register") {
    const projectId = String(body.project_id ?? "").trim();
    const ownerLabel = String(body.owner_label ?? "").trim();
    const feedUrl = String(body.feed_url ?? "").trim();
    const visibilityLevel = String(body.visibility_level ?? "title_location");
    const consentNote = body.consent_note ? String(body.consent_note) : null;

    if (!projectId || !ownerLabel || !feedUrl) {
      return NextResponse.json(
        { error: "project_id / owner_label / feed_url は必須" },
        { status: 400 },
      );
    }
    if (!/^https:\/\//i.test(feedUrl)) {
      return NextResponse.json({ error: "feed_url は https だけを受け付ける" }, { status: 400 });
    }

    const { data, error } = await db
      .from("calendar_feed_sources")
      .upsert(
        {
          project_id: projectId,
          owner_label: ownerLabel,
          feed_url: feedUrl,
          visibility_level: visibilityLevel,
          consent_note: consentNote,
          status: "active",
        },
        { onConflict: "project_id,feed_url" },
      )
      .select("id")
      .maybeSingle();
    if (error || !data) {
      return NextResponse.json({ error: error?.message || "登録に失敗した" }, { status: 500 });
    }

    // 登録直後に1回取り込んで、URLが本当に読めるかその場で確かめる。
    const result = await syncCalendarFeed(String(data.id));
    return NextResponse.json({ ok: true, sourceId: data.id, sync: result });
  }

  if (action === "sync") {
    const sourceId = String(body.source_id ?? "").trim();
    if (!sourceId) return NextResponse.json({ error: "source_id は必須" }, { status: 400 });
    const result = await syncCalendarFeed(sourceId);
    return NextResponse.json({ ok: result.ok, sync: result });
  }

  if (action === "update_status") {
    const sourceId = String(body.source_id ?? "").trim();
    const status = String(body.status ?? "");
    if (!sourceId || !["active", "paused", "revoked"].includes(status)) {
      return NextResponse.json({ error: "source_id と status(active/paused/revoked) が必要" }, { status: 400 });
    }
    const { error } = await db.from("calendar_feed_sources").update({ status }).eq("id", sourceId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
