/**
 * GET /api/progress/events?projectId=...&ym=...
 *
 * 月次モーダル右下の「進捗イベント」セクションのデータ。
 * 2026-05-12 改修: member_activities の新列 (initiative_origin / impact / depth /
 *   raw_metadata.responsibilities) を ProgressEvent にマップ。これにより EventsSection の
 *   「先手力」「起点バッジ」「責任配分」が復活する。member_id NULL 許容 (= MS なし PJ で
 *   誰か特定不能なイベントも返す)。
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/api-auth";

interface ProgressEvent {
  eventId: string;
  eventTitle: string;
  eventDescription?: string;
  status: string;
  initiativeOrigin?: string;
  impact?: number;
  depth?: number;
  rejectReason?: string;
  originLostReason?: string;
  responsibilities?: Array<{ memberId: string; memberName?: string; responsibility: number }>;
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  const ym = searchParams.get("ym");

  if (!projectId || !ym) {
    return NextResponse.json({ error: "projectId and ym required" }, { status: 400 });
  }

  const supabase = auth.supabase;

  const { data: activities } = await supabase
    .from("member_activities")
    .select(
      "id, member_id, source, source_item_id, milestone_id, title, content_preview, item_date, extracted_at, initiative_origin, impact, depth, raw_metadata, reject_reason, origin_lost_reason"
    )
    .eq("project_id", projectId)
    .eq("ym", ym)
    .order("item_date", { ascending: false, nullsFirst: false })
    .limit(80);

  // members の code_name 解決用 (= 主担当 + responsibilities[] の表示名解決)
  const memberIds = new Set<string>();
  for (const a of activities ?? []) {
    if (a.member_id) memberIds.add(a.member_id);
    const meta = (a.raw_metadata ?? {}) as { responsibilities?: Array<{ memberId?: string }> };
    for (const r of meta.responsibilities ?? []) {
      if (r.memberId) memberIds.add(r.memberId);
    }
  }
  let memberMap: Record<string, string> = {};
  if (memberIds.size > 0) {
    const { data: members } = await supabase
      .from("members")
      .select("member_id, code_name")
      .in("member_id", Array.from(memberIds));
    memberMap = Object.fromEntries(
      (members ?? []).map((m: { member_id: string; code_name: string | null }) => [
        m.member_id,
        m.code_name || m.member_id,
      ])
    );
  }

  const events: ProgressEvent[] = (activities ?? []).map((a) => {
    const meta = (a.raw_metadata ?? {}) as { responsibilities?: Array<{ memberId?: string; responsibility?: number }> };
    const responsibilities = (meta.responsibilities ?? [])
      .map((r) => ({
        memberId: r.memberId || "",
        memberName: r.memberId ? memberMap[r.memberId] : undefined,
        responsibility: typeof r.responsibility === "number" ? r.responsibility : 0,
      }))
      .filter((r) => !!r.memberId);

    const memberName = a.member_id ? memberMap[a.member_id] : null;
    const descriptionParts = [
      memberName ? `by ${memberName}` : null,
      a.content_preview || null,
      a.item_date ? String(a.item_date).slice(0, 10) : null,
    ].filter((s): s is string => !!s);

    return {
      eventId: a.id,
      eventTitle: a.title || (a.content_preview ? String(a.content_preview).slice(0, 80) : "(無題)"),
      eventDescription: descriptionParts.join(" · ") || undefined,
      status: "active",
      initiativeOrigin: (a.initiative_origin as string | null) ?? "unknown",
      impact: (a.impact as number | null) ?? undefined,
      depth: (a.depth as number | null) ?? undefined,
      rejectReason: (a.reject_reason as string | null) ?? undefined,
      originLostReason: (a.origin_lost_reason as string | null) ?? undefined,
      responsibilities: responsibilities.length > 0 ? responsibilities : undefined,
    };
  });

  return NextResponse.json({ ok: true, events });
}
