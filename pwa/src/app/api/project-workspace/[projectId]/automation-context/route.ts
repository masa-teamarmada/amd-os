import { NextRequest, NextResponse } from "next/server";
import { loadSxWorkspaceOperatingContext } from "@/lib/sx-workspace-operating-context-server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

async function authorized(request: NextRequest) {
  const auth = request.headers.get("authorization") || "";
  const secret = process.env.WORKFLOW_SECRET || process.env.CRON_SECRET || "";
  if (secret && auth === `Bearer ${secret}`) return true;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return false;
  const { data: member } = await supabase
    .from("members")
    .select("is_admin")
    .eq("email", user.email.toLowerCase())
    .maybeSingle();
  return member?.is_admin === true;
}

function dateParam(value: string | null) {
  if (!value) return null;
  const date = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  if (!(await authorized(request))) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  const { projectId } = await params;
  if (projectId !== "p21") {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  const sinceRaw = request.nextUrl.searchParams.get("since");
  const untilRaw = request.nextUrl.searchParams.get("until");
  const since = dateParam(sinceRaw);
  const until = dateParam(untilRaw);
  if ((sinceRaw && !since) || (untilRaw && !until) || (since && until && since > until)) {
    return NextResponse.json({ ok: false, error: "invalid_date_range" }, { status: 400 });
  }
  try {
    const context = await loadSxWorkspaceOperatingContext({ projectId, since, until });
    return NextResponse.json({ ok: true, context });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "workspace context failed" },
      { status: 500 },
    );
  }
}
