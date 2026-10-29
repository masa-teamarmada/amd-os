import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { requireAdmin } from "@/lib/supabase/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getGoogleAuthAsync } from "@/lib/sources/google";

export const runtime = "nodejs";

// Vercel の buffered body 上限 (4.5MB) より十分下。通常の支払通知書PDFは1.7MB前後。
const MAX_PDF_BYTES = 4 * 1024 * 1024;
const YM_RE = /^\d{6}$/;
const MEMBER_ID_RE = /^[A-Za-z0-9_-]+$/;
const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" } as const;

function isValidYm(ym: string): boolean {
  if (!YM_RE.test(ym)) return false;
  const month = Number(ym.slice(4, 6));
  return month >= 1 && month <= 12;
}

function errorResponse(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status, headers: NO_STORE_HEADERS });
}

/** DB保存済み pdf_url からだけ fileId を取り出す。想定外のURL形式は常に拒否する。 */
function extractTrustedDriveFileId(pdfUrl: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(pdfUrl);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" || parsed.hostname !== "drive.google.com") return null;
  // 認証情報埋め込みURLや非標準ポートは、正規のDrive直リンクではないため拒否する。
  if (parsed.username || parsed.password || parsed.port) return null;

  const fileMatch = parsed.pathname.match(/^\/file\/d\/([A-Za-z0-9_-]+)(?:\/.*)?$/);
  if (fileMatch) return fileMatch[1];

  if (parsed.pathname === "/open") {
    const id = parsed.searchParams.get("id");
    if (id && /^[A-Za-z0-9_-]+$/.test(id)) return id;
  }
  return null;
}

/**
 * GAS/ネイティブPDF生成のファイル名規約 支払通知書_{noticeNo}_{memberId}_{ym}.pdf と一致するかを見る。
 * 強制再発行などで ym のあとに補足が付く場合もあるため、終端ではなく「_memberId_ym」を含むことを見るが、
 * ym の直後が数字で続く(別の年月へ桁が延びている)ケースは拒否し、_memberId_ym の境界を厳密に判定する
 * (payout-notice-native-mail.ts の送付前チェックと同じ考え方)。
 */
function isTrustedNoticeFilename(name: string, memberId: string, ym: string): boolean {
  if (!name.startsWith("支払通知書_") || !name.endsWith(".pdf")) return false;
  const escapedMemberId = memberId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const boundary = new RegExp(`_${escapedMemberId}_${ym}(?:\\.pdf$|[^0-9])`);
  return boundary.test(name);
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    auth.errorResponse.headers.set("Cache-Control", "private, no-store");
    return auth.errorResponse;
  }

  const url = new URL(req.url);
  const ym = (url.searchParams.get("ym") || "").trim();
  const memberId = (url.searchParams.get("memberId") || "").trim();
  if (!isValidYm(ym) || !memberId || !MEMBER_ID_RE.test(memberId)) {
    return errorResponse("支払年月またはメンバー番号の形式が正しくありません", 400);
  }

  const admin = createAdminClient();
  const { data: notice, error: dbError } = await admin
    .from("payout_notices")
    .select("pdf_url")
    .eq("member_id", memberId)
    .eq("ym", ym)
    .maybeSingle();
  if (dbError) {
    return errorResponse("支払通知書の確認中にエラーが発生しました", 500);
  }
  const pdfUrl = typeof notice?.pdf_url === "string" ? notice.pdf_url : "";
  if (!pdfUrl) {
    return errorResponse("この支払月・メンバーの支払通知書PDFはまだありません", 404);
  }

  const fileId = extractTrustedDriveFileId(pdfUrl);
  if (!fileId) {
    return errorResponse("保存されているPDFの保存先を確認できませんでした", 500);
  }

  const driveAuth = await getGoogleAuthAsync();
  if (!driveAuth) {
    return errorResponse("Drive読取用の認証が設定されていません", 500);
  }
  const drive = google.drive({ version: "v3", auth: driveAuth });

  let metadata;
  try {
    metadata = await drive.files.get({
      fileId,
      fields: "id,name,mimeType,size,trashed",
      supportsAllDrives: true,
    });
  } catch {
    return errorResponse("Driveから支払通知書PDFの情報を取得できませんでした", 502);
  }

  const name = String(metadata.data.name || "");
  const size = Number(metadata.data.size || 0);
  if (
    metadata.data.trashed ||
    metadata.data.mimeType !== "application/pdf" ||
    !isTrustedNoticeFilename(name, memberId, ym) ||
    !Number.isFinite(size) ||
    size <= 0
  ) {
    return errorResponse("保存されているPDFの内容を確認できませんでした", 409);
  }
  if (size > MAX_PDF_BYTES) {
    return errorResponse("支払通知書PDFのサイズが上限を超えているため表示できません", 413);
  }

  let pdf: Buffer;
  try {
    const downloaded = await drive.files.get(
      { fileId, alt: "media", supportsAllDrives: true },
      { responseType: "arraybuffer" },
    );
    pdf = Buffer.from(downloaded.data as ArrayBuffer);
  } catch {
    return errorResponse("支払通知書PDFの読み込みに失敗しました", 502);
  }

  if (pdf.length > MAX_PDF_BYTES) {
    return errorResponse("支払通知書PDFのサイズが上限を超えているため表示できません", 413);
  }
  if (pdf.length !== size || pdf.subarray(0, 5).toString("ascii") !== "%PDF-") {
    return errorResponse("支払通知書PDFの読み込み結果が保存内容と一致しませんでした", 502);
  }

  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Content-Length": String(pdf.length),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
