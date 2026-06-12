/**
 * POST /api/notifications/feedback/dialog/start
 *
 * まさ #34 対話型修正依頼 (2026-05-25 #71 確定):
 *  まさが「⚠️ つくよみに修正依頼」ボタンを押して初回 textarea 送信したときに、
 *  Anthropic Sonnet で提案を 1 つ生成して返す。**DB 永続化はしない** (= 確定時のみ INSERT)。
 *
 * Body:
 *   {
 *     l2_kind: 'project_strategy_signal',  // 当面は D-6 のみ対応
 *     target_id: string,                    // project_id
 *     scope_key: string,                    // 'YYYYMM:strategy:<hashPrefix>'
 *     initial_feedback: string              // まさの最初の修正依頼テキスト
 *   }
 *
 * Response (success):
 *   {
 *     ok: true,
 *     proposed: { title, summary, impact_level, signal_type, polarity, score_impact_summary },
 *     reasoning: string,
 *     applied_feedback_summary: string,
 *     conversation: DialogMessage[],   // [{role:user, content:initial_feedback}, {role:assistant, proposed, reasoning, applied_feedback_summary}]
 *     current: ProposedSignal           // 現在の signal (= 修正前)、UI diff 表示用
 *   }
 *
 * 設計の正本: pwa/design/feedback_dialog.md (案 A)
 * helper: pwa/src/lib/strategy-signal-dialog.ts
 */
import { NextRequest, NextResponse } from "next/server";
import {
  fetchSignalContext,
  generateProposal,
  requireAdmin,
  type DialogMessage,
} from "@/lib/strategy-signal-dialog";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const l2Kind = String(body.l2_kind ?? "").trim();
    const targetId = String(body.target_id ?? "").trim();
    const scopeKey = String(body.scope_key ?? "").trim();
    const initialFeedback = String(body.initial_feedback ?? "").trim();

    if (l2Kind !== "project_strategy_signal") {
      return NextResponse.json({ error: `l2_kind ${l2Kind} not supported yet (only project_strategy_signal)` }, { status: 400 });
    }
    if (!targetId || !scopeKey || !initialFeedback) {
      return NextResponse.json({ error: "target_id, scope_key, initial_feedback are required" }, { status: 400 });
    }

    const ctxRes = await fetchSignalContext({ targetId, scopeKey });
    if (!ctxRes.ok) return NextResponse.json({ error: ctxRes.message }, { status: 404 });
    const context = ctxRes.context;

    const conversation: DialogMessage[] = [{ role: "user", content: initialFeedback }];
    const genRes = await generateProposal({ context, conversation });
    if (!genRes.ok) return NextResponse.json({ error: genRes.message }, { status: 502 });

    conversation.push({
      role: "assistant",
      proposed: genRes.proposed,
      reasoning: genRes.reasoning,
      applied_feedback_summary: genRes.applied_feedback_summary,
    });

    return NextResponse.json({
      ok: true,
      proposed: genRes.proposed,
      reasoning: genRes.reasoning,
      applied_feedback_summary: genRes.applied_feedback_summary,
      conversation,
      current: context.current,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
