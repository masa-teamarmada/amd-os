/**
 * POST /api/notifications/feedback
 *
 * Phase 4 通知に対するまさからの修正依頼を l2_feedbacks に INSERT する。
 * 上流 (GAS 155 / PWA progress-estimator) は次回抽出時に
 * 「過去のフィードバック」を LLM プロンプトに含めて再抽出する。
 *
 * Body:
 *   {
 *     l2_kind: 'member_knowledge'|'project_knowledge'|'protocols'|'ms_progress'|'meeting_summary',
 *     target_id: string,            // code_name (member系) / project_id (PJ系)
 *     scope_key?: string,            // ym (PJ系) / 'global' (member系) — default 'global'
 *     notification_id?: string,      // 関連 l2_notifications (optional)
 *     meeting_id?: string,           // 関連 meeting_notifications (optional)
 *     feedback_text: string          // 必須
 *   }
 *
 * 認証: Supabase Auth セッションが必要 (RLS で authenticated INSERT)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const l2Kind = String(body.l2_kind ?? "").trim();
    const targetId = String(body.target_id ?? "").trim();
    const scopeKey = String(body.scope_key ?? "global").trim();
    const feedbackText = String(body.feedback_text ?? "").trim();
    const notificationId = body.notification_id ? String(body.notification_id) : null;
    const meetingId = body.meeting_id ? String(body.meeting_id) : null;

    if (!l2Kind || !targetId || !feedbackText) {
      return NextResponse.json({ error: "l2_kind, target_id, feedback_text are required" }, { status: 400 });
    }

    const allowedKinds = new Set([
      "member_knowledge",
      "project_knowledge",
      "protocols",
      "ms_progress",
      "meeting_summary",
    ]);
    if (!allowedKinds.has(l2Kind)) {
      return NextResponse.json({ error: `unknown l2_kind: ${l2Kind}` }, { status: 400 });
    }

    // 作成者: members.email = auth user.email から code_name を resolve
    let createdBy: string | null = null;
    if (user.email) {
      const { data: m } = await supabase
        .from("members")
        .select("code_name")
        .eq("email", user.email)
        .maybeSingle();
      createdBy = m?.code_name ?? user.email;
    }

    const insertRow = {
      l2_kind: l2Kind,
      target_id: targetId,
      scope_key: scopeKey,
      notification_id: notificationId,
      meeting_id: meetingId,
      feedback_text: feedbackText.slice(0, 4000),
      status: "active",
      created_by: createdBy,
    };

    const { data, error } = await supabase
      .from("l2_feedbacks")
      .insert(insertRow)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, feedback: data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
