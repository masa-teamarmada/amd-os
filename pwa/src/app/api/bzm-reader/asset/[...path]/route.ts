import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/api-auth";
import { bzmContentDir } from "@/lib/bzm-content-dir";

/**
 * GET /api/bzm-reader/asset/<bzm からの相対パス> — 原稿フォルダ内の図を配る。
 * 書斎は管理者限定なので、図も管理者だけに返す。bzm/ の外へ出る指定（.. や絶対パス）と、
 * 図以外の拡張子（原稿 md など）は拒む。設計正本: pwa/design/bzm_reader.md §7
 */

const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const { path: segments } = await params;
  let rel: string;
  try {
    rel = segments.map((s) => decodeURIComponent(s)).join("/");
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  // NUL を含む指定は fs が例外を投げる前に拒む
  if (!rel || rel.includes("\0") || path.isAbsolute(rel)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const contentType = CONTENT_TYPES[path.extname(rel).toLowerCase()];
  if (!contentType) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const root = bzmContentDir();
  const resolved = path.resolve(root, rel);
  const inside = path.relative(root, resolved);
  if (!inside || inside.startsWith("..") || path.isAbsolute(inside)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: Buffer;
  try {
    body = fs.readFileSync(resolved);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "Cache-Control": "private, max-age=3600",
    "X-Content-Type-Options": "nosniff",
  };
  // SVG は直接開かれたときにスクリプトが走らないよう、読み込みを全部止める
  if (contentType === "image/svg+xml") {
    headers["Content-Security-Policy"] = "default-src 'none'; style-src 'unsafe-inline'";
  }
  return new NextResponse(new Uint8Array(body), { status: 200, headers });
}
