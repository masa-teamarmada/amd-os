/**
 * GET /api/admin/weekly?weekStart=YYYY-MM-DD
 *
 * /admin/weekly 用。member_activities(source='member_weekly') を週内全件取得し、
 * PJ × メンバーのマトリクスを描画するための payload を返す。
 *
 * weekStart は JST 月曜日。省略時は今週 (= JST 月-日)。
 * 加えて、表示週の月曜が属する月 (ym) の billing_cycles.reward_summary_json から
 * member × PJ の月次報酬 (totalPay) を返す。報酬は週次ではなく月次の値。
 * service_role で読むので、admin guard 必須。
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/api-auth";

export const runtime = "nodejs";

interface MemberRow {
  member_id: string;
  code_name: string;
  email: string;
  status: string | null;
}

interface ProjectRow {
  project_id: string;
  project_name: string;
}

interface ActivityRow {
  id: string;
  member_id: string;
  project_id: string | null;
  source: string;
  title: string | null;
  content_preview: string | null;
  item_date: string | null;
  raw_metadata: Record<string, unknown> | null;
}

interface ActivityOut {
  id: string;
  memberId: string;
  projectId: string;
  source: string;
  sourceKind: string;
  sourceUrl: string | null;
  title: string;
  contentPreview: string;
  itemDate: string | null;
}

function dateKeyJST(date: Date) {
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return `${jst.getUTCFullYear()}-${String(jst.getUTCMonth() + 1).padStart(2, "0")}-${String(jst.getUTCDate()).padStart(2, "0")}`;
}

function currentMondayJST(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const daysFromMonday = (jst.getUTCDay() + 6) % 7;
  const startJst = new Date(Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate()));
  startJst.setUTCDate(startJst.getUTCDate() - daysFromMonday);
  return `${startJst.getUTCFullYear()}-${String(startJst.getUTCMonth() + 1).padStart(2, "0")}-${String(startJst.getUTCDate()).padStart(2, "0")}`;
}

function isWeeklyTargetMember(m: MemberRow): boolean {
  if ((m.status || "").toLowerCase() !== "active") return false;
  const email = (m.email || "").trim().toLowerCase();
  if (!email.endsWith("@team-armada.jp")) return false;
  if (m.code_name === "info" || m.code_name === "つくよみ") return false;
  return true;
}

function plainPreview(value: string | null | undefined, max = 110) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

interface RewardCellOut {
  projectId: string;
  memberId: string;
  totalPay: number;
}

/** reward_summary_json.members[] を camelCase / snake_case 両対応でパース (payouts route と同方針) */
function parseRewardMembers(json: unknown): Array<{ memberId: string; totalPay: number }> {
  if (!json || typeof json !== "object") return [];
  const members = (json as Record<string, unknown>).members;
  if (!Array.isArray(members)) return [];
  const out: Array<{ memberId: string; totalPay: number }> = [];
  for (const entry of members) {
    if (!entry || typeof entry !== "object") continue;
    const r = entry as Record<string, unknown>;
    const memberId =
      typeof r.memberId === "string" ? r.memberId
      : typeof r.member_id === "string" ? r.member_id
      : null;
    if (!memberId) continue;
    const totalPayRaw = r.totalPay ?? r.total_pay;
    const totalPay = typeof totalPayRaw === "number" && Number.isFinite(totalPayRaw)
      ? Math.round(totalPayRaw)
      : 0;
    out.push({ memberId, totalPay });
  }
  return out;
}

function displayableActivity(row: ActivityRow): boolean {
  const meta = row.raw_metadata || {};
  const rawSourceKind = typeof meta.source_kind === "string" ? meta.source_kind : row.source;
  const sourceSubkind = typeof meta.source_subkind === "string" ? meta.source_subkind : "";
  if (rawSourceKind === "gmail" && sourceSubkind !== "sent" && sourceSubkind !== "draft") return false;
  return true;
}

function shapeActivity(row: ActivityRow): { sourceKind: string; sourceUrl: string | null; title: string; contentPreview: string } {
  const meta = row.raw_metadata || {};
  const rawSourceKind = typeof meta.source_kind === "string" ? meta.source_kind : row.source;
  const sourceKind = rawSourceKind === "source_cache" && typeof meta.source_subkind === "string"
    ? meta.source_subkind
    : rawSourceKind;
  const sourceSubkind = typeof meta.source_subkind === "string" ? meta.source_subkind : "";
  const sourceUrl = typeof meta.source_url === "string" ? meta.source_url : null;
  const rawTitle = row.title || "今週の活動";
  const title = rawTitle.replace(/^(メール|予定|gmail|calendar):\s*/i, "").replace(/^Re:\s*/i, "");

  if (rawSourceKind === "source_cache" && sourceKind.startsWith("gmail")) {
    return { sourceKind, sourceUrl, title: rawTitle, contentPreview: plainPreview(row.content_preview) };
  }
  if (sourceKind === "gmail") {
    const action = sourceSubkind === "draft" ? "返信ドラフトを作成" : "メールを送信";
    return {
      sourceKind,
      sourceUrl,
      title: `${action}: ${title}`,
      contentPreview: plainPreview(row.content_preview) || "メール本文ではなく、送信/下書きという行動だけを活動として表示しています。",
    };
  }
  if (sourceKind === "calendar") {
    const action = sourceSubkind === "organizer" ? "予定を主催" : "予定に参加";
    const cleanedTitle = title.replace(/^(予定を主催|予定に参加):\s*/i, "");
    return { sourceKind, sourceUrl, title: `${action}: ${cleanedTitle}`, contentPreview: plainPreview(row.content_preview) };
  }
  if (sourceKind === "meeting_summary") {
    return { sourceKind, sourceUrl, title, contentPreview: plainPreview(row.content_preview) };
  }
  return { sourceKind, sourceUrl, title: rawTitle, contentPreview: plainPreview(row.content_preview) };
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const weekStartParam = req.nextUrl.searchParams.get("weekStart");
  const weekStartKey = weekStartParam && /^\d{4}-\d{2}-\d{2}$/.test(weekStartParam)
    ? weekStartParam
    : currentMondayJST();

  // JST 月曜日 00:00 → UTC ISO
  const [y, m, d] = weekStartKey.split("-").map(Number);
  const startUtc = new Date(Date.UTC(y, m - 1, d, 0, 0, 0) - 9 * 60 * 60 * 1000);
  const endUtc = new Date(startUtc.getTime() + 7 * 86400000);
  const startIso = startUtc.toISOString();
  const endIso = endUtc.toISOString();
  const weekEndKey = dateKeyJST(new Date(endUtc.getTime() - 86400000));

  // 報酬は表示週の月曜が属する月の月次計算を使う
  const rewardYm = `${y}${String(m).padStart(2, "0")}`;

  const db = createAdminClient();
  const [membersRes, activitiesRes, billingRes] = await Promise.all([
    db.from("members").select("member_id, code_name, email, status"),
    db
      .from("member_activities")
      .select("id, member_id, project_id, source, title, content_preview, item_date, raw_metadata")
      .eq("source", "member_weekly")
      .gte("item_date", startIso)
      .lt("item_date", endIso)
      .order("item_date", { ascending: false, nullsFirst: false })
      .limit(2000),
    db
      .from("billing_cycles")
      .select("project_id, reward_summary_json")
      .eq("ym", rewardYm),
  ]);

  if (membersRes.error) {
    return NextResponse.json({ ok: false, error: membersRes.error.message }, { status: 500 });
  }
  if (activitiesRes.error) {
    return NextResponse.json({ ok: false, error: activitiesRes.error.message }, { status: 500 });
  }
  if (billingRes.error) {
    return NextResponse.json({ ok: false, error: billingRes.error.message }, { status: 500 });
  }

  const allMembers = (membersRes.data ?? []) as MemberRow[];
  const targetMembers = allMembers.filter(isWeeklyTargetMember);
  const memberById = new Map(allMembers.map((m) => [m.member_id, m]));

  const activitiesRaw = (activitiesRes.data ?? []) as ActivityRow[];
  const activities: ActivityOut[] = activitiesRaw
    .filter((row) => row.project_id && displayableActivity(row))
    .map((row) => {
      const shape = shapeActivity(row);
      return {
        id: row.id,
        memberId: row.member_id,
        projectId: row.project_id as string,
        source: row.source,
        sourceKind: shape.sourceKind,
        sourceUrl: shape.sourceUrl,
        title: shape.title,
        contentPreview: shape.contentPreview,
        itemDate: row.item_date,
      };
    });

  // 月次報酬: billing_cycles.reward_summary_json → member × PJ の totalPay
  const rewards: RewardCellOut[] = [];
  for (const row of (billingRes.data ?? []) as Array<{ project_id: string; reward_summary_json: unknown }>) {
    for (const rm of parseRewardMembers(row.reward_summary_json)) {
      if (rm.totalPay === 0) continue;
      rewards.push({ projectId: row.project_id, memberId: rm.memberId, totalPay: rm.totalPay });
    }
  }

  // 活動に登場する PJ + 報酬が発生している PJ + メンバーの参照を解決
  const projectIds = Array.from(
    new Set([...activities.map((a) => a.projectId), ...rewards.map((r) => r.projectId)]),
  );
  const projectsMap = new Map<string, ProjectRow>();
  if (projectIds.length > 0) {
    const projectsRes = await db
      .from("projects")
      .select("project_id, project_name")
      .in("project_id", projectIds);
    if (projectsRes.error) {
      return NextResponse.json({ ok: false, error: projectsRes.error.message }, { status: 500 });
    }
    for (const row of (projectsRes.data ?? []) as ProjectRow[]) {
      projectsMap.set(row.project_id, row);
    }
  }

  // 列 = PJ: 活動があった PJ ∪ 今月報酬がある PJ。活動件数多い順 (報酬のみの PJ は後ろ)
  const projectCounts = new Map<string, number>();
  for (const a of activities) {
    projectCounts.set(a.projectId, (projectCounts.get(a.projectId) || 0) + 1);
  }
  const projectsOut = projectIds
    .map((projectId) => ({ projectId, count: projectCounts.get(projectId) || 0 }))
    .sort((a, b) => b.count - a.count || a.projectId.localeCompare(b.projectId))
    .map(({ projectId }) => ({
      projectId,
      projectName: projectsMap.get(projectId)?.project_name || projectId,
    }));

  // 行 = メンバー: active 人間メンバー + 活動 or 報酬があったメンバー (system 含む) を union、code_name 昇順
  const memberIdsWithActivity = new Set(activities.map((a) => a.memberId));
  const memberIdsToShow = new Set<string>([
    ...targetMembers.map((m) => m.member_id),
    ...memberIdsWithActivity,
    ...rewards.map((r) => r.memberId),
  ]);
  const membersOut = Array.from(memberIdsToShow)
    .map((id) => {
      const m = memberById.get(id);
      return {
        memberId: id,
        codeName: m?.code_name || id,
      };
    })
    .sort((a, b) => a.codeName.localeCompare(b.codeName, "ja"));

  return NextResponse.json({
    ok: true,
    weekStart: weekStartKey,
    weekEnd: weekEndKey,
    members: membersOut,
    projects: projectsOut,
    activities,
    rewardYm,
    rewards,
  });
}
