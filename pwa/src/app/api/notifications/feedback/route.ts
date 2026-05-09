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

    // ⚡ 即時再抽出を発火 (= 修正依頼を出した瞬間に LLM プロンプトに含めて再抽出)
    // GAS Web App の runFunc を fire-and-forget で叩く。失敗しても feedback INSERT 自体は成功扱い。
    // - meeting_summary: nav_meeting_processOneEvent_(meetingId, projectId) で 1 event 強制再抽出
    // - member_knowledge: nav_member_knowledge_extractOne_(codeName, memberId, {force:true})
    // - project_knowledge / protocols / ms_progress: 当面は次回 cron まで待つ (= 仕組みは動く、即時化は後追い)
    void triggerImmediateReExtraction({ l2Kind, targetId, scopeKey, meetingId }).catch((e) => {
      console.warn("[feedback] immediate re-extract failed:", e);
    });

    return NextResponse.json({ ok: true, feedback: data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** 修正依頼が入った瞬間に対応する 1 件を force 再抽出する。
 *  GAS Web App の pwaApi/runFunc にリクエストを fire-and-forget で送る。
 */
async function triggerImmediateReExtraction(args: {
  l2Kind: string;
  targetId: string;
  scopeKey: string;
  meetingId: string | null;
}): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_GAS_WEBAPP_URL || "";
  const apiKey = process.env.NEXT_PUBLIC_GAS_API_KEY || "";
  if (!baseUrl || !apiKey) return;

  let fn = "";
  let fnArgs: unknown[] = [];

  if (args.l2Kind === "meeting_summary" && args.meetingId) {
    fn = "nav_meeting_processOneEvent_";
    fnArgs = [args.meetingId, args.targetId];
  } else if (args.l2Kind === "member_knowledge") {
    // member_id は GAS 側で resolve できないので targetId(code_name) と "" を渡す → GAS 側で resolve
    fn = "nav_member_knowledge_extractOne_";
    fnArgs = [args.targetId, "", { force: true }];
  } else if (args.l2Kind === "project_knowledge") {
    fn = "nav_project_knowledge_extractOneForYm_";
    fnArgs = [args.targetId, args.scopeKey, { force: true }];
  } else if (args.l2Kind === "protocols") {
    fn = "nav_protocol_extractOneForYm_";
    fnArgs = [args.targetId, args.scopeKey, { force: true }];
  } else {
    return; // 不明 kind は再抽出しない (= 次回 cron 待ち)
  }

  const argsEnc = encodeURIComponent(JSON.stringify(fnArgs));
  const url = `${baseUrl}?mode=pwaApi&key=${encodeURIComponent(apiKey)}&action=runFunc&fn=${encodeURIComponent(fn)}&args=${argsEnc}`;

  // member_knowledge は member_id が必要なので resolve してから渡す
  if (args.l2Kind === "member_knowledge") {
    try {
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = await createClient();
      const { data: m } = await supabase.from("members").select("member_id").eq("code_name", args.targetId).maybeSingle();
      const memberId = m?.member_id ?? "";
      const argsEnc2 = encodeURIComponent(JSON.stringify([args.targetId, memberId, { force: true }]));
      const url2 = `${baseUrl}?mode=pwaApi&key=${encodeURIComponent(apiKey)}&action=runFunc&fn=${encodeURIComponent(fn)}&args=${argsEnc2}`;
      await fetch(url2, { method: "GET", signal: AbortSignal.timeout(60000) });
      return;
    } catch (e) {
      console.warn("[feedback] member resolve failed:", e);
    }
  }

  // GAS Web App は GET / 60 秒タイムアウト想定
  await fetch(url, { method: "GET", signal: AbortSignal.timeout(60000) });
}
