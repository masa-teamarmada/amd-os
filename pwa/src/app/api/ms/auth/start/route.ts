/**
 * GET /api/ms/auth/start
 *
 * Microsoft の同意画面へ送り出す。押した本人が自分のブラウザで同意するだけで、
 * パスワードはAMD側へ渡らない (代理ログインはしない)。
 *
 * 認証: AMD内部メンバー (members に居ること)。
 * state はDBへ短命保存し、callbackで使い捨てる。
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { buildAuthorizeUrl, getMsGraphConfig, MsGraphNotConfiguredError } from "@/lib/microsoft-graph";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { data: member } = await supabase
    .from("members")
    .select("member_id")
    .eq("email", user.email.toLowerCase())
    .maybeSingle();
  if (!member?.member_id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let config;
  try {
    config = getMsGraphConfig(req.nextUrl.origin);
  } catch (error) {
    if (error instanceof MsGraphNotConfiguredError) {
      return NextResponse.json(
        {
          error: "not_configured",
          message:
            "MS_GRAPH_CLIENT_ID / MS_GRAPH_CLIENT_SECRET が未設定。Entra IDでアプリ登録し、Vercelの環境変数へ入れる必要がある。",
        },
        { status: 503 },
      );
    }
    throw error;
  }

  const state = crypto.randomUUID();
  const db = createAdminClient();
  const { error } = await db.from("microsoft_oauth_states").insert({
    state,
    member_id: member.member_id,
    redirect_after: req.nextUrl.searchParams.get("next") || "/settings/microsoft",
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  });
  if (error) {
    return NextResponse.json({ error: "state_save_failed" }, { status: 500 });
  }

  return NextResponse.redirect(buildAuthorizeUrl(config, state));
}
