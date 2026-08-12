import type { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/api-auth";

type ContractTermsOperatorAuth =
  | { ok: true; actor: string; errorResponse: null }
  | { ok: false; actor: null; errorResponse: NextResponse };

export async function requireContractTermsOperator(req: Request): Promise<ContractTermsOperatorAuth> {
  const automationSecret = process.env.CONTRACTS_EXTRACT_SECRET || process.env.CRON_SECRET;
  const authorization = req.headers.get("authorization") || "";
  if (automationSecret && authorization === `Bearer ${automationSecret}`) {
    return { ok: true, actor: "automation:contract-terms-review", errorResponse: null };
  }

  const admin = await requireAdmin();
  if (!admin.ok) return { ok: false, actor: null, errorResponse: admin.errorResponse };
  return { ok: true, actor: admin.user.email || "admin", errorResponse: null };
}
