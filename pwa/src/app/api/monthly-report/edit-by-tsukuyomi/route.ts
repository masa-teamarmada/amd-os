/**
 * 旧AI修正API。
 * 月末の定額内生成と混同される従量課金経路なので、互換レスポンスだけ残して停止する。
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/supabase/api-auth";

export async function POST() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.errorResponse;
  return NextResponse.json(
    {
      ok: false,
      message: "従量課金APIを使うAI修正は停止中です。月次モーダルから社内版または提出版を開き、紙面上で直接修正してください。",
      code: "PAID_REPORT_EDIT_DISABLED",
    },
    { status: 410 }
  );
}
