import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/api-auth";

/**
 * 旧手動生成API。
 *
 * ここからAnthropic APIを呼ぶと、月末の定額内ライターとは別に従量課金が発生する。
 * 社内版は月末routineで生成し、画面では非LLMの直接編集だけ許可する。
 */
export async function POST() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;
  return NextResponse.json(
    {
      error: "この画面からのAI生成は停止中です。社内版は月末の定額内処理で生成し、必要な修正は本文を直接編集してください。",
      code: "PAID_REPORT_GENERATION_DISABLED",
    },
    { status: 410 }
  );
}
