/**
 * GET /api/progress/events?projectId=...&ym=...
 *
 * 月次モーダル右下の「進捗イベント」セクションのデータ。
 * 旧実装は GAS rewardDashboard を bridge 経由で叩いていたが:
 *  - GAS bridge env が未設定の環境では空配列が返って「イベントデータなし」になる
 *  - GAS への round trip で数十秒かかってモーダル表示がブロックされる
 * (BUGS.md / design/routine.md 参照)
 *
 * 今は Supabase の `member_activities` を直接取って ProgressEvent 形式にマップする。
 * cron `/api/cron/member-activities` が毎日 04:00 JST に書き込んでる。
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/api-auth";

interface ProgressEvent {
  eventId: string;
  eventTitle: string;
  eventDescription?: string;
  status: string;
  initiativeOrigin?: string;
  rejectReason?: string;
  originLostReason?: string;
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

  // member_activities (cron member-activities が書く)
  const { data: activities } = await supabase
    .from("member_activities")
    .select("id, member_id, source, source_item_id, milestone_id, title, content_preview, item_date, extracted_at")
    .eq("project_id", projectId)
    .eq("ym", ym)
    .order("item_date", { ascending: false })
    .limit(80);

  // members の code_name 解決用
  const memberIds = Array.from(new Set((activities ?? []).map((a) => a.member_id).filter(Boolean)));
  let memberMap: Record<string, string> = {};
  if (memberIds.length > 0) {
    const { data: members } = await supabase
      .from("members")
      .select("member_id, code_name")
      .in("member_id", memberIds);
    memberMap = Object.fromEntries((members ?? []).map((m: { member_id: string; code_name: string | null }) => [m.member_id, m.code_name || m.member_id]));
  }

  const events: ProgressEvent[] = (activities ?? []).map((a) => ({
    eventId: a.id,
    eventTitle: a.title || (a.content_preview ? a.content_preview.slice(0, 80) : "(無題)"),
    eventDescription: [
      memberMap[a.member_id] && `by ${memberMap[a.member_id]}`,
      a.source,
      a.item_date && a.item_date.slice(0, 10),
    ].filter(Boolean).join(" · "),
    status: "active",
  }));

  return NextResponse.json({ ok: true, events });
}
