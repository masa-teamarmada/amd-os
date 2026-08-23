import { NextResponse } from "next/server";
import {
  buildAmdContributionsPayload,
  normalizeActivityRow,
  normalizeMeetingRow,
  type AmdContributionItem,
} from "@/lib/amd-contributions";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMember } from "@/lib/supabase/api-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** 1回で返す上限。超えたら truncated を立てて「これで全部ではない」と画面へ出す。 */
const ITEM_LIMIT = 400;

/**
 * 「AMDがこのPJへ行ってきたこと」の読み取り。
 * 正本: pwa/spec/4-7-amd-contributions-current-spec.md
 *
 * 生データ (member_activities / project_meeting_summaries) からその場で組む。
 * 専用の入力欄・専用テーブルを持たないので、人が書き足す運用にならない。
 */
export async function GET(req: Request, ctx: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await ctx.params;
  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }

  const auth = await requireMember();
  if (!auth.ok) return auth.errorResponse;

  const supabase = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const [activityRes, meetingRes, memberRes] = await Promise.all([
    supabase
      .from("member_activities")
      .select("id,member_id,ym,source,title,content_preview,item_date,extracted_at")
      .eq("project_id", projectId)
      .order("item_date", { ascending: false, nullsFirst: false })
      .limit(ITEM_LIMIT),
    supabase
      .from("project_meeting_summaries")
      .select("meeting_id,ym,meeting_date,title,summary_short,decided,source_kinds")
      .eq("project_id", projectId)
      .lte("meeting_date", today)
      .order("meeting_date", { ascending: false })
      .limit(ITEM_LIMIT),
    supabase.from("members").select("member_id,code_name"),
  ]);

  const firstError = activityRes.error || meetingRes.error || memberRes.error;
  if (firstError) {
    return NextResponse.json({ error: firstError.message }, { status: 500 });
  }

  const codeNames = new Map<string, string>(
    (memberRes.data ?? []).map((row) => [String(row.member_id), String(row.code_name || row.member_id)]),
  );
  const codeNameOf = (memberId: string) => codeNames.get(memberId) || memberId;

  const items: AmdContributionItem[] = [
    ...(activityRes.data ?? [])
      .map((row) => normalizeActivityRow(row as Record<string, unknown>, codeNameOf)),
    ...(meetingRes.data ?? [])
      // 予定はまだ「行ってきたこと」ではない。
      .filter((row) => String(row.source_kinds ?? "") !== "upcoming")
      .map((row) => normalizeMeetingRow(row as Record<string, unknown>)),
  ].filter((item): item is AmdContributionItem => item !== null);

  const payload = buildAmdContributionsPayload({
    projectId,
    items,
    truncated: (activityRes.data ?? []).length >= ITEM_LIMIT || (meetingRes.data ?? []).length >= ITEM_LIMIT,
  });

  return NextResponse.json(payload, {
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}
