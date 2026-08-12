/**
 * proactive-todo-extract cron — proactive_todos のライフサイクル維持のみ (daily 09:15 JST)
 *
 * 仕様正本: pwa/spec/2-4-proactive-todo-current-spec.md
 *
 * 経緯 (2026-08-12 まさ確定):
 *   旧実装は「MTG next_actions の文字列ヒューリスティック」「Gmail 依頼文の文字列ヒューリスティック」
 *   で候補を自動生成し、その後に別 gate が LLM で後段フィルタする
 *   2段構えだった。これはまさが「候補自体が悪い後段filter方式」として明示的に否定した設計であり、
 *   候補生成 (このファイル) は amd-os-proactive-heartbeat (Codex 抽出 → 非LLM apply で
 *   attention_state='approved' を直接書く) へ一本化した。
 *
 *   このファイルは新規候補を一切書かない。既存 proactive_todos 行に対する
 *   ライフサイクル維持 (期限超過の red 昇格 / blocked の自動復帰) だけを行う。
 *
 * 参照: pwa/scheduled-tasks/amd-os-proactive-heartbeat/SKILL.md
 */

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

const BLOCKED_RESURFACE_DAYS = 3;

function isPastIso(iso: string): boolean {
  return new Date(iso).getTime() < Date.now();
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();

  // ============================================
  // Stage 1: 期限超過 open todo を red に昇格
  // ============================================
  const { data: openOverdue } = await db
    .from("proactive_todos")
    .select("id")
    .eq("status", "open")
    .eq("priority", "normal")
    .eq("due_basis", "explicit")
    .lt("due_at", new Date().toISOString());
  let escalated = 0;
  for (const r of openOverdue ?? []) {
    const { error } = await db
      .from("proactive_todos")
      .update({ priority: "red" })
      .eq("id", r.id);
    if (!error) escalated++;
  }

  // ============================================
  // Stage 2: blocked で BLOCKED_RESURFACE_DAYS 日経過したら open に復帰
  // ============================================
  const resurfaceThreshold = new Date(Date.now() - BLOCKED_RESURFACE_DAYS * 86400_000).toISOString();
  const { data: blockedToResurface } = await db
    .from("proactive_todos")
    .select("id, due_at, due_basis")
    .eq("status", "blocked")
    .lt("updated_at", resurfaceThreshold);
  let resurfaced = 0;
  for (const r of blockedToResurface ?? []) {
    const overdue = r.due_basis === "explicit" && isPastIso(String(r.due_at));
    const { error } = await db
      .from("proactive_todos")
      .update({ status: "open", priority: overdue ? "red" : "normal" })
      .eq("id", r.id);
    if (!error) resurfaced++;
  }

  return NextResponse.json({
    ok: true,
    escalated_to_red: escalated,
    resurfaced_from_blocked: resurfaced,
  });
}
