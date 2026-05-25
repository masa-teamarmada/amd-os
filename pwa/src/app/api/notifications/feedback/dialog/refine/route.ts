/**
 * POST /api/notifications/feedback/dialog/refine
 *
 * まさ #34 対話型修正依頼 (2026-05-25 #71 確定):
 *  まさが「やり直し」または「追加コメント」を押したときに、過去の conversation を context に
 *  Anthropic Sonnet で **新しい proposed を生成** して返す。**DB 永続化はしない**。
 *
 * Body:
 *   {
 *     l2_kind: 'project_strategy_signal',
 *     target_id: string,                    // project_id
 *     scope_key: string,
 *     conversation: DialogMessage[],         // これまでの会話 (= start からの全部)
 *     additional_hint?: string,              // 「やり直し」だけならこちらに「もう一度別案を」等
 *     additional_feedback?: string           // 「追加コメント」ならこちらにまさの追加発言
 *   }
 *   (= additional_hint と additional_feedback のどちらか or 両方が必要)
 *
 * Response:
 *   {
 *     ok: true,
 *     proposed, reasoning, applied_feedback_summary,
 *     conversation: DialogMessage[]   // 更新済み (= user 追加発言 + assistant 新 proposed)
 *   }
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
    const additionalHint = String(body.additional_hint ?? "").trim();
    const additionalFeedback = String(body.additional_feedback ?? "").trim();
    const conversationIn = Array.isArray(body.conversation) ? (body.conversation as DialogMessage[]) : [];

    if (l2Kind !== "project_strategy_signal") {
      return NextResponse.json({ error: `l2_kind ${l2Kind} not supported yet` }, { status: 400 });
    }
    if (!targetId || !scopeKey) {
      return NextResponse.json({ error: "target_id and scope_key are required" }, { status: 400 });
    }
    if (!conversationIn.length) {
      return NextResponse.json({ error: "conversation is empty (call /start first)" }, { status: 400 });
    }
    if (!additionalHint && !additionalFeedback) {
      return NextResponse.json({ error: "additional_hint or additional_feedback is required" }, { status: 400 });
    }
    if (conversationIn.length > 30) {
      return NextResponse.json({ error: "conversation too long (>30 turns), confirm or restart" }, { status: 400 });
    }

    const ctxRes = await fetchSignalContext({ targetId, scopeKey });
    if (!ctxRes.ok) return NextResponse.json({ error: ctxRes.message }, { status: 404 });
    const context = ctxRes.context;

    const userContent = additionalFeedback
      ? additionalFeedback
      : `（やり直し依頼）${additionalHint || "別案を見せて"}`;
    const conversation: DialogMessage[] = [...conversationIn, { role: "user", content: userContent }];

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
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
