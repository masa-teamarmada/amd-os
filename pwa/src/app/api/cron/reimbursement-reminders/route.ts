import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/api-auth";
import { sendReimbursementApprovalReminders } from "@/lib/reimbursement-notify";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * 未承認の立替を 24 時間ごとに admin + 申請者へリマインドする。
 * LLM は使わないので ALLOW_PWA_LLM_CRONS 封鎖の対象外。
 * 毎日 JST 10:00 に走り、前回送信 (無ければ申請時) から 24 時間経過した行だけを送る。
 */
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";
  return bearer === secret || req.nextUrl.searchParams.get("secret") === secret;
}

async function run(req: NextRequest) {
  if (!isAuthorized(req)) {
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const db = createAdminClient();
    const result = await sendReimbursementApprovalReminders(db);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return run(req);
}

export async function POST(req: NextRequest) {
  return run(req);
}
