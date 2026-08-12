import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/supabase/api-auth";
import {
  applyReimbursementDecision,
  ReimbursementDecisionError,
  type ReimbursementDecisionAction,
} from "@/lib/reimbursement-decision";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.errorResponse;

  try {
    const body = (await req.json()) as { reimbursementId?: string; action?: string };
    const result = await applyReimbursementDecision(createAdminClient(), {
      reimbursementId: String(body.reimbursementId ?? ""),
      action: String(body.action ?? "") as ReimbursementDecisionAction,
      approverEmail: auth.user.email,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const status = error instanceof ReimbursementDecisionError ? error.status : 500;
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
