/**
 * POST /api/notifications/feedback/dialog/confirm
 *
 * まさ #34 対話型修正依頼 (2026-05-25 #71 確定):
 *  まさが「適用」を押したときに、提案された signal で **DB を確定更新** + l2_feedbacks に
 *  conversation 全体を 1 行 INSERT + 過去 feedbacks の applied_count++。
 *
 * Body:
 *   {
 *     l2_kind: 'project_strategy_signal',
 *     target_id: string,                    // project_id
 *     scope_key: string,
 *     conversation: DialogMessage[],         // start/refine で更新された最終 conversation
 *     proposed: ProposedSignal,              // 確定する改訂案 (= conversation 末尾 assistant.proposed と同じ前提)
 *     applied_feedback_summary?: string      // optional、UI から渡せれば表示用
 *   }
 *
 * Response:
 *   { ok: true, signal_id: string, feedback_id: string }
 */
import { NextRequest, NextResponse } from "next/server";
import {
  applyProposal,
  fetchSignalContext,
  requireAdmin,
  type DialogMessage,
  type ProposedSignal,
} from "@/lib/strategy-signal-dialog";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const l2Kind = String(body.l2_kind ?? "").trim();
    const targetId = String(body.target_id ?? "").trim();
    const scopeKey = String(body.scope_key ?? "").trim();
    const conversationIn = Array.isArray(body.conversation) ? (body.conversation as DialogMessage[]) : [];
    const proposedIn = (body.proposed as Partial<ProposedSignal>) || {};
    const appliedFeedbackSummary = String(body.applied_feedback_summary ?? "").trim();

    if (l2Kind !== "project_strategy_signal") {
      return NextResponse.json({ error: `l2_kind ${l2Kind} not supported yet` }, { status: 400 });
    }
    if (!targetId || !scopeKey) {
      return NextResponse.json({ error: "target_id and scope_key are required" }, { status: 400 });
    }
    if (!conversationIn.length) {
      return NextResponse.json({ error: "conversation is empty" }, { status: 400 });
    }
    if (!proposedIn.title || !proposedIn.summary) {
      return NextResponse.json({ error: "proposed.title and proposed.summary are required" }, { status: 400 });
    }

    const ctxRes = await fetchSignalContext({ targetId, scopeKey });
    if (!ctxRes.ok) return NextResponse.json({ error: ctxRes.message }, { status: 404 });
    const context = ctxRes.context;

    const proposed: ProposedSignal = {
      title: String(proposedIn.title),
      summary: String(proposedIn.summary),
      impact_level: String(proposedIn.impact_level || context.current.impact_level),
      signal_type: String(proposedIn.signal_type || context.current.signal_type),
      polarity: proposedIn.polarity == null ? null : String(proposedIn.polarity),
      score_impact_summary: proposedIn.score_impact_summary == null ? null : String(proposedIn.score_impact_summary),
    };

    const applyRes = await applyProposal({
      context,
      conversation: conversationIn,
      proposed,
      appliedFeedbackSummary,
      createdBy: auth.code_name || auth.email,
    });
    if (!applyRes.ok) return NextResponse.json({ error: applyRes.message }, { status: 500 });

    return NextResponse.json({
      ok: true,
      signal_id: applyRes.signal_id,
      feedback_id: applyRes.feedback_id,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
