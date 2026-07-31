import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/api-auth";
import { runWeeklyReconciliation } from "@/lib/finance/freee-reconciliation-client";

export const runtime = "nodejs";
export const maxDuration = 300;

function isCronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && req.headers.get("authorization") === `Bearer ${secret}`);
}

/**
 * 毎週木曜10:00 JST本実行の週次freee会計照合cron。pwa/vercel.jsonのcron schedule参照。
 * dryRun=1でadminが手動プレビュー実行できる（review-onlyのadmin_manual runとしては
 * /api/admin/finance/reconciliation を使う。このrouteはcron本実行 or その場dry-run確認専用）。
 */
export async function GET(req: NextRequest) {
  const cronOk = isCronAuthorized(req);
  if (!cronOk) {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.errorResponse;
  }

  const dryRun = req.nextUrl.searchParams.get("dryRun") === "1";
  const jstRunDateParam = req.nextUrl.searchParams.get("jstRunDate");
  const db = createAdminClient();

  try {
    const result = await runWeeklyReconciliation(db, {
      triggeredBy: cronOk ? "cron" : "admin_manual",
      dryRun: cronOk ? dryRun : true,
      jstRunDate: jstRunDateParam ?? undefined,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
