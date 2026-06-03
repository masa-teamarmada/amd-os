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

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function dateKeyJST(date: Date) {
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return `${jst.getUTCFullYear()}-${pad2(jst.getUTCMonth() + 1)}-${pad2(jst.getUTCDate())}`;
}

function weeklyWindowEndKeysJST() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const daysFromMonday = (jst.getUTCDay() + 6) % 7;
  const mondayJst = new Date(Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate()));
  mondayJst.setUTCDate(mondayJst.getUTCDate() - daysFromMonday);
  const today18Utc = Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate(), 18, 0, 0) - 9 * 60 * 60 * 1000;
  const latestEndUtc = now.getTime() < today18Utc ? today18Utc - 86400000 : today18Utc;
  const keys: string[] = [];
  for (let cursor = new Date(mondayJst.getTime()); ; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const endUtc = Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate(), 18, 0, 0) - 9 * 60 * 60 * 1000;
    if (endUtc > latestEndUtc) break;
    keys.push(dateKeyJST(new Date(endUtc)));
  }
  return keys.length ? keys : [dateKeyJST(new Date(latestEndUtc))];
}

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

  const results: Record<string, unknown>[] = [];
  for (const windowEnd of weeklyWindowEndKeysJST()) {
    const cronUrl = new URL("/api/cron/member-weekly-activities", req.nextUrl.origin);
    cronUrl.searchParams.set("memberId", member.member_id);
    cronUrl.searchParams.set("windowEnd", windowEnd);
    cronUrl.searchParams.set("interactive", "1");
    const cronRes = await fetch(cronUrl, {
      method: "GET",
      headers: { Authorization: `Bearer ${cronSecret}` },
      cache: "no-store",
    });
    const result = (await cronRes.json().catch(() => ({ ok: false, error: "cron response not JSON" }))) as Record<
      string,
      unknown
    >;
    results.push(result);
    if (!cronRes.ok || result.ok === false || result.disabled === true) {
      return NextResponse.json(
        {
          ok: false,
          error: typeof result.error === "string"
            ? result.error
            : typeof result.reason === "string"
              ? result.reason
              : `cron failed (${cronRes.status})`,
          cronResponse: result,
        },
        { status: cronRes.ok ? 503 : cronRes.status }
      );
    }
  }

  const sum = (key: string) => results.reduce((total, row) => total + (typeof row[key] === "number" ? row[key] as number : 0), 0);

  return NextResponse.json({
    ok: true,
    memberId: member.member_id,
    codeName: member.code_name,
    calendarStatus: member.google_calendar_status,
    calendarWarning,
    windows: results.map((row) => ({
      windowKey: row.windowKey,
      windowStart: row.windowStart,
      windowEnd: row.windowEnd,
      saved: row.saved,
    })),
    sourceCacheEvidence: sum("sourceCacheEvidence"),
    gmailEvidence: sum("gmailEvidence"),
    calendarEvidence: sum("calendarEvidence"),
    meetingSummaryEvidence: sum("meetingSummaryEvidence"),
    evidenceCount: sum("evidenceCount"),
    fusionGroups: sum("fusionGroups"),
    saved: sum("saved"),
  });
}
