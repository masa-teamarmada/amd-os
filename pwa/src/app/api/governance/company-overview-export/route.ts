import { Buffer } from "node:buffer";
import { NextRequest, NextResponse } from "next/server";
import { GET as getCompanyOverview } from "../route";
import { createCompanyOverviewXlsx } from "@/lib/company-overview-xlsx";
import { type CompanyOverviewData } from "@/lib/company-overview";
import { requireMember } from "@/lib/supabase/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function noStoreJson(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function safeFilename(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "_");
}

/**
 * GET /api/governance/company-overview-export?projectId=...&projectName=...
 *
 * Company Overview本体と同じmember境界・同じGET結果を、既存のPWA Excel生成器へ渡す。
 * Mac用に別のDB queryやworkbook実装を持たないことで、PWAの7sheetを正本のまま返す。
 */
export async function GET(req: NextRequest) {
  const auth = await requireMember();
  if (!auth.ok) {
    auth.errorResponse.headers.set("Cache-Control", "no-store");
    return auth.errorResponse;
  }

  const projectId = req.nextUrl.searchParams.get("projectId")?.trim();
  if (!projectId) return noStoreJson({ ok: false, error: "projectId required" }, 400);

  const sourceResponse = await getCompanyOverview(req);
  if (!sourceResponse.ok) {
    const sourceError = await sourceResponse.json().catch(() => null) as { error?: string } | null;
    return noStoreJson(
      { ok: false, error: sourceError?.error || "会社概要データを取得できませんでした" },
      sourceResponse.status,
    );
  }

  const source = await sourceResponse.json().catch(() => null) as (CompanyOverviewData & { ok?: boolean; error?: string }) | null;
  if (!source || source.ok !== true) {
    return noStoreJson({ ok: false, error: source?.error || "会社概要データの形式が不正です" }, 500);
  }

  const requestedProjectName = req.nextUrl.searchParams.get("projectName")?.trim();
  const projectName = requestedProjectName || source.profile?.legal_name?.trim() || projectId;

  try {
    const bytes = createCompanyOverviewXlsx(projectName, source);
    const filename = `${safeFilename(projectName)}_会社概要_cap-table.xlsx`;
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": XLSX_CONTENT_TYPE,
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="company-overview.xlsx"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "会社概要Excelの生成に失敗しました";
    return noStoreJson({ ok: false, error: message }, 500);
  }
}
