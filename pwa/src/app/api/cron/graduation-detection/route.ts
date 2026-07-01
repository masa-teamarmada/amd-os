/**
 * GET /api/cron/graduation-detection
 *
 * 卒業フェーズ検出 (= まさ #84 確定、 manual 4-6 / 39 章)。
 * 月次 cron で全 active PJ について 6 シグナルを集計、
 * readiness_score 70% 以上の PJ を project_strategy_signals に candidate insert する。
 *
 * vercel.json で「0 20 1 * *」 = 月初 1 日 05:00 JST に実行。
 * 手動再実行は ?ym=YYYYMM で対象月指定可能。
 *
 * 認証: Authorization: Bearer ${CRON_SECRET}
 */
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getBackgroundAnthropic } from "@/lib/anthropic-client";
import { createAdminClient } from "@/lib/supabase/admin";
import { runGraduationDetection } from "@/lib/graduation-detection/calculate";

export const maxDuration = 300;

function currentYmJST(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return `${jst.getUTCFullYear()}${String(jst.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get("authorization") || "";
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }

  if (process.env.ALLOW_PWA_LLM_CRONS !== "1") {
    return NextResponse.json({
      ok: true,
      disabled: true,
      reason: "LLM-backed PWA background cron is disabled; graduation detection should run only after explicit owner approval.",
      saved: 0,
    });
  }

  try {
    const ym = req.nextUrl.searchParams.get("ym") || currentYmJST();
    // ANTHROPIC_API_KEY が set かつ llm_prompts.graduation_detection.* が is_active=TRUE のとき
    // signal 1 (talker_ratio) と signal 3 (report_attribution) が LLM 経路で埋まる。
    // 片方だけ active でも OK。 両方 inactive なら従来通り 0 で保存され、 readiness_score は
    // signal 2/4/5/6 だけから計算される (= MVP 通り)。
    // ALLOW_PWA_LLM_CRONS ガードは上で通過済み。key があるときだけ background client を作り、
    // 無ければ null (= signal 2/4/5/6 だけで readiness_score を計算する MVP モード)。
    const anthropic: Anthropic | null = process.env.ANTHROPIC_API_KEY
      ? getBackgroundAnthropic("cron/graduation-detection")
      : null;
    const result = await runGraduationDetection(createAdminClient(), ym, anthropic);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[cron/graduation-detection]", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "unknown error" },
      { status: 500 },
    );
  }
}
