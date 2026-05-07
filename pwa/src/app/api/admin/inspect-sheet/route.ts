/**
 * GET /api/admin/inspect-sheet?spreadsheetId=...&gid=...
 *
 * Google スプレッドシートの該当タブを読んで、ヘッダ行 + サンプル行を返す。
 * PJ メアドのデータ復元で、列構造を確認するための用途。
 *
 * 必要 env: GOOGLE_OAUTH_* (Vercel production にセット済前提)
 */

import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getGoogleAuthAsync } from "@/lib/sources/google";
import { requireAdmin } from "@/lib/supabase/api-auth";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const { searchParams } = new URL(req.url);
  const spreadsheetId = searchParams.get("spreadsheetId");
  const gidStr = searchParams.get("gid");
  if (!spreadsheetId) {
    return NextResponse.json({ error: "spreadsheetId required" }, { status: 400 });
  }
  const gid = gidStr ? Number(gidStr) : null;

  const googleAuth = await getGoogleAuthAsync();
  if (!googleAuth) {
    return NextResponse.json({ error: "GOOGLE_OAUTH_* env が未設定" }, { status: 500 });
  }

  try {
    const sheets = google.sheets({ version: "v4", auth: googleAuth });
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const tabs = (meta.data.sheets ?? []).map((s) => ({
      title: s.properties?.title,
      sheetId: s.properties?.sheetId,
    }));

    // gid 指定があればそのタブ、無ければ最初のタブ
    let targetTitle: string | undefined;
    if (gid !== null) {
      targetTitle = tabs.find((t) => t.sheetId === gid)?.title ?? undefined;
      if (!targetTitle) {
        return NextResponse.json({ error: `gid=${gid} が見つからない`, tabs }, { status: 404 });
      }
    } else {
      targetTitle = tabs[0]?.title ?? undefined;
    }

    const valuesRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${targetTitle}!A1:Z200`,
    });
    const rows = valuesRes.data.values ?? [];
    return NextResponse.json({
      ok: true,
      tabs,
      targetTitle,
      header: rows[0] ?? [],
      sample: rows.slice(0, 12),
      totalRows: rows.length,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
