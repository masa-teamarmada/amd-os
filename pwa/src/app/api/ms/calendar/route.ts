/**
 * GET /api/ms/calendar
 *
 * 連携済みMicrosoftアカウントの直近予定を読む。読むだけで、DBへは保存しない。
 * 「委任同意で実際にデータが取れるか」を本人が自分の目で確かめるための面。
 *
 * 認証: AMD内部メンバー本人のトークンのみ。他人のトークンは引かない。
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  fetchUpcomingEvents,
  getMsGraphConfig,
  getUsableAccessToken,
  markUsed,
  MsGraphNotConfiguredError,
} from "@/lib/microsoft-graph";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: member } = await supabase
    .from("members")
    .select("member_id")
    .eq("email", user.email.toLowerCase())
    .maybeSingle();
  if (!member?.member_id) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let config;
  try {
    config = getMsGraphConfig(req.nextUrl.origin);
  } catch (error) {
    if (error instanceof MsGraphNotConfiguredError) {
      return NextResponse.json({ error: "not_configured" }, { status: 503 });
    }
    throw error;
  }

  let usable;
  try {
    usable = await getUsableAccessToken(String(member.member_id), config);
  } catch (error) {
    return NextResponse.json(
      { error: "refresh_failed", detail: (error instanceof Error ? error.message : String(error)).slice(0, 300) },
      { status: 502 },
    );
  }
  if (!usable) return NextResponse.json({ connected: false, events: [] });

  const days = Math.min(90, Math.max(1, Number(req.nextUrl.searchParams.get("days") || 28)));
  try {
    const events = await fetchUpcomingEvents(usable.accessToken, days);
    await markUsed(String(member.member_id));
    return NextResponse.json({
      connected: true,
      account: {
        label: usable.stored.accountLabel,
        kind: usable.stored.accountKind,
        authorizedAt: usable.stored.lastAuthorizedAt,
        scopes: usable.stored.scopes,
      },
      days,
      events,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "graph_failed", detail: (error instanceof Error ? error.message : String(error)).slice(0, 300) },
      { status: 502 },
    );
  }
}
