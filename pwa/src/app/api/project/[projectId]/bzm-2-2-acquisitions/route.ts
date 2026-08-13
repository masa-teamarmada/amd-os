import { NextResponse } from "next/server";
import {
  normalizeBzm22AcquisitionRow,
  type Bzm22AcquisitionApiPayload,
} from "@/lib/bzm-2-2-acquisitions";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMember } from "@/lib/supabase/api-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * BZM 2.2 獲得台帳の読み取り。
 * 正本: pwa/spec/4-6-bzm-22-acquisition-ledger-current-spec.md
 *
 * 第1段は読み取り専用。ここから返る値は J/P/Q/S・SPS・戦略余力のどの計算にも入らない。
 * 並びは occurred_on の新しい順 (点数順に並べ替えない)。
 */
export async function GET(req: Request, ctx: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await ctx.params;
  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }

  const auth = await requireMember();
  if (!auth.ok) return auth.errorResponse;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("project_bzm_2_2_acquisitions")
    .select("*")
    .eq("project_id", projectId)
    .eq("status", "active")
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const acquisitions = (data ?? []).map((row) =>
    normalizeBzm22AcquisitionRow(row as Record<string, unknown>),
  );

  const payload: Bzm22AcquisitionApiPayload = {
    projectId,
    displayOnly: acquisitions.every((item) => item.numericBinding === "display_only"),
    acquisitions,
  };

  return NextResponse.json(payload, {
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}
