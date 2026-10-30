import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/api-auth";
import { renderMonthlyReportPdf } from "@/lib/monthly-report-pdf-render";

export const runtime = "nodejs";
export const maxDuration = 60;

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" } as const;
const MAX_PDF_BYTES = 4 * 1024 * 1024;

function errorResponse(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status, headers: PRIVATE_HEADERS });
}

/** Download the selected saved report body without changing its PDF or Drive records. */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const { searchParams } = request.nextUrl;
  const projectId = searchParams.get("projectId") || "";
  const ym = searchParams.get("ym") || "";
  const kind = searchParams.get("kind") || "";
  if (!/^[A-Za-z0-9_-]+$/.test(projectId) || !/^\d{4}(0[1-9]|1[0-2])$/.test(ym) || !["internal", "submission"].includes(kind)) {
    return errorResponse("PJ・版・対象月を確認してください。", 400);
  }

  const db = auth.supabase;
  let version = "";
  if (kind === "internal") {
    const { data, error } = await db.from("monthly_reports")
      .select("final_content,draft_content,status")
      .eq("project_id", projectId).eq("ym", ym).maybeSingle();
    if (error) return errorResponse("報告書を確認できませんでした。", 500);
    if (data?.status === "invalid" || (!data?.final_content?.trim() && !data?.draft_content?.trim())) {
      return errorResponse("この版の報告書はまだありません。", 404);
    }
    if (!data.final_content?.trim()) version = "draft";
  } else {
    const { data, error } = await db.from("monthly_reports_external")
      .select("body_md")
      .eq("project_id", projectId).eq("ym", `${ym.slice(0, 4)}-${ym.slice(4)}`).maybeSingle();
    if (error) return errorResponse("報告書を確認できませんでした。", 500);
    if (!data?.body_md?.trim()) return errorResponse("この版の報告書はまだありません。", 404);
  }

  try {
    const printUrl = new URL(`/project/${encodeURIComponent(projectId)}/report/${ym}/print`, request.url);
    printUrl.searchParams.set("template", kind);
    if (version) printUrl.searchParams.set("version", version);
    const cookie = request.headers.get("cookie") || "";
    const authorization = request.headers.get("authorization");
    const page = await fetch(printUrl, {
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      headers: { cookie, ...(authorization ? { authorization } : {}) },
    });
    if (!page.ok) return errorResponse("報告書の印刷画面を取得できませんでした。", 502);
    const pdf = await renderMonthlyReportPdf(await page.text(), process.env.MONTHLY_REPORT_CHROME_PATH);
    if (pdf.length > MAX_PDF_BYTES) return errorResponse("PDFの容量が大きすぎます。", 413);

    const fileName = `月次業務報告書_${ym.slice(0, 4)}年${Number(ym.slice(4))}月_チームアルマダ.pdf`;
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        ...PRIVATE_HEADERS,
        "Content-Type": "application/pdf",
        "Content-Length": String(pdf.length),
        "Content-Disposition": `attachment; filename="monthly-report-${ym}.pdf"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[admin monthly report download]", error instanceof Error ? error.message : "PDF rendering failed");
    return errorResponse("PDFを作成できませんでした。もう一度試してください。", 502);
  }
}
