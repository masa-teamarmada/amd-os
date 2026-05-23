/**
 * POST /api/mypage/weekly-activities/refresh
 *
 * /mypage の「今週やったこと」を即時抽出するための auth user 向けエンドポイント。
 * - requireAuth で Supabase Auth 済みユーザーを確認
 * - email から `members.member_id` を resolve
 * - 内部で `/api/cron/member-weekly-activities?memberId=<id>` を CRON_SECRET 付きで叩く
 *
 * cron route はそのまま再利用 (= 同じ抽出ロジック / dedup / upsert)。
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/supabase/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.errorResponse;

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET not configured" }, { status: 500 });
  }

  const db = createAdminClient();
  const { data: member, error: memberError } = await db
    .from("members")
    .select("member_id, code_name, google_calendar_status, status")
    .eq("email", auth.user.email.toLowerCase())
    .maybeSingle();
  if (memberError) {
    return NextResponse.json({ ok: false, error: memberError.message }, { status: 500 });
  }
  if (!member || member.status !== "active") {
    return NextResponse.json({ ok: false, error: "Active member not found for this account" }, { status: 404 });
  }
  const calendarWarning = member.google_calendar_status !== "connected"
    ? "本人カレンダーはまだOSから読めないが、他の共有済みメンバーのカレンダー/議事録/source_cacheに参加者として出ている活動は抽出する。"
    : null;

  const cronUrl = new URL("/api/cron/member-weekly-activities", req.nextUrl.origin);
  cronUrl.searchParams.set("memberId", member.member_id);
  const cronRes = await fetch(cronUrl, {
    method: "GET",
    headers: { Authorization: `Bearer ${cronSecret}` },
    cache: "no-store",
  });
  const result = (await cronRes.json().catch(() => ({ ok: false, error: "cron response not JSON" }))) as Record<
    string,
    unknown
  >;
  if (!cronRes.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: typeof result.error === "string" ? result.error : `cron failed (${cronRes.status})`,
        cronResponse: result,
      },
      { status: cronRes.status }
    );
  }

  return NextResponse.json({
    ok: true,
    memberId: member.member_id,
    codeName: member.code_name,
    calendarStatus: member.google_calendar_status,
    calendarWarning,
    ...result,
  });
}
