/**
 * POST /api/notifications/feedback
 *
 * Phase 4 通知に対するまさからの修正依頼を l2_feedbacks に INSERT する。
 * 上流 (GAS 155 / gas/074 / PWA progress-estimator) は
 * 「過去のフィードバック」を LLM プロンプトに含めて再抽出する。
 * 通知に出た候補は「はい」だけで正本反映する。
 * candidate/tentative 系の L2 は yes=active/confirmed、no=rejected/invalid。
 * protocols は UI 正本に合わせて yes=confirmed。
 * meeting_summary 通知は legacy。新規の議事録作成通知は作らず、既存分の「はい」は確認マーク (feedback 記録 + 既読化) のみ。再抽出しない。
 *
 * Body:
 *   {
 *     l2_kind: 'member_knowledge'|'project_knowledge'|'protocols'|'ms_progress'|'ms_progress_revision'|'meeting_summary'|'project_registry_diff'|'xrl_evidence'|'project_strategy_signal'|'textbook_insight'|'guardrail_match',
 *     target_id: string,            // code_name (member系) / project_id (PJ系)
 *     scope_key?: string,            // ym (PJ系) / 'global' (member系) — default 'global'
 *     notification_id?: string,      // 関連 l2_notifications (optional)
 *     meeting_id?: string,           // legacy meeting feedback 用 (optional)
 *     feedback_text: string          // comment action では必須。yes/no では任意コメント
 *     action?: 'yes'|'no'|'comment'  // 通知への回答。yes は安全なものだけDB反映も行う
 *   }
 *
 * 認証: Supabase Auth セッションが必要 (RLS で authenticated INSERT)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { syncRewardSummaryForCycle } from "@/lib/reward-summary";

/**
 * ms_progress_revision の yes/no applier は RLS を跨いで
 * ms_progress_revisions / milestone_monthly_progress 等を書くため
 * service client を使う (= /api/progress/revisions PATCH と同じ方式)。
 */
function getServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/**
 * GET /api/notifications/feedback?l2_kind=...&target_id=...&scope_key_prefix=...&limit=...
 *
 * まさが過去に投げた修正依頼の履歴を取得する。
 * cockpit (= CockpitStrategySignals 等) の各カードに「過去のつくよみ修正依頼」セクションを
 * 表示するために使う (= まさ #34 短期 2026-05-25)。
 *
 * Query:
 *   l2_kind: 'project_strategy_signal' / 'meeting_summary' / etc (必須)
 *   target_id: project_id or code_name (必須)
 *   scope_key_prefix: scope_key の前方一致フィルタ (任意、未指定なら全部)
 *   limit: default 100
 *
 * 認証: Supabase Auth セッション必要 (POST と同じく admin のみ)
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const email = user.email?.toLowerCase() ?? "";
    if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const { data: member } = await supabase
      .from("members")
      .select("code_name, is_admin")
      .eq("email", email)
      .maybeSingle();
    if (!member?.is_admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const l2Kind = String(searchParams.get("l2_kind") ?? "").trim();
    const targetId = String(searchParams.get("target_id") ?? "").trim();
    const scopeKeyPrefix = String(searchParams.get("scope_key_prefix") ?? "").trim();
    const limit = Math.min(500, Math.max(1, Number(searchParams.get("limit") ?? "100")));
    if (!l2Kind || !targetId) {
      return NextResponse.json({ error: "l2_kind and target_id are required" }, { status: 400 });
    }
    let query = supabase
      .from("l2_feedbacks")
      .select("feedback_id, l2_kind, target_id, scope_key, feedback_text, status, created_by, created_at, applied_count, last_applied_at")
      .eq("l2_kind", l2Kind)
      .eq("target_id", targetId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (scopeKeyPrefix) query = query.like("scope_key", `${scopeKeyPrefix}%`);
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, feedbacks: data ?? [] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const email = user.email?.toLowerCase() ?? "";
    if (!email) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const { data: member } = await supabase
      .from("members")
      .select("code_name, is_admin")
      .eq("email", email)
      .maybeSingle();
    if (!member?.is_admin) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const l2Kind = String(body.l2_kind ?? "").trim();
    const targetId = String(body.target_id ?? "").trim();
    const scopeKey = String(body.scope_key ?? "global").trim();
    const feedbackText = String(body.feedback_text ?? "").trim();
    const actionRaw = String(body.action ?? "comment").trim().toLowerCase();
    const action = ["yes", "no", "comment"].includes(actionRaw) ? actionRaw : "comment";
    const notificationId = body.notification_id ? String(body.notification_id) : null;
    const meetingId = body.meeting_id ? String(body.meeting_id) : null;

    if (!l2Kind || !targetId || (action === "comment" && !feedbackText)) {
      return NextResponse.json({ error: "l2_kind, target_id and feedback_text/action are required" }, { status: 400 });
    }

    const allowedKinds = new Set([
      "member_knowledge",
      "project_knowledge",
      "protocols",
      "ms_progress",
      "project_member_candidate",
      "project_contact_candidate",
      "raw_data_gap",
      "project_config_gap",
      "ms_progress_revision",
      "ms_schedule_delay",
      "project_registry_diff",
      "xrl_evidence",
      "project_strategy_signal",
      "textbook_insight",
      "founding_members",
      "meeting_summary",
      "news_mention",
      "coverage_gap",
      "guardrail_match",
    ]);
    if (!allowedKinds.has(l2Kind)) {
      return NextResponse.json({ error: `unknown l2_kind: ${l2Kind}` }, { status: 400 });
    }

    // 作成者: members.email = auth user.email から code_name を resolve
    const createdBy = member.code_name ?? email;

    const actionLabel = action === "yes" ? "はい" : action === "no" ? "いいえ" : "コメント";
    const storedFeedbackText = action === "comment"
      ? feedbackText
      : `[${actionLabel}]${feedbackText ? ` ${feedbackText}` : ""}`;

    const insertRow = {
      l2_kind: l2Kind,
      target_id: targetId,
      scope_key: scopeKey,
      notification_id: notificationId,
      meeting_id: meetingId,
      feedback_text: storedFeedbackText.slice(0, 4000),
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

    const applyResult = action === "yes"
      ? await applyApprovedNotification({ supabase, l2Kind, targetId, scopeKey, notificationId, meetingId, feedbackText, feedbackId: data.feedback_id, createdBy })
      : action === "no"
        ? await rejectNotificationCandidates({ supabase, l2Kind, targetId, scopeKey, notificationId, feedbackText, createdBy })
        : { applied: false, message: "comment only" };

    await supabase.from("tsukuyomi_learnings").insert({
      scope: "notification_response",
      scope_key: `${l2Kind}:${targetId}`,
      content: [
        `通知回答: ${actionLabel}`,
        `kind=${l2Kind}`,
        `target=${targetId}`,
        `scope=${scopeKey}`,
        feedbackText ? `comment=${feedbackText}` : "",
        applyResult.applied ? `applied=${applyResult.message}` : `not_applied=${applyResult.message}`,
      ].filter(Boolean).join("\n"),
      source: "notification_feedback",
      source_ref: data.feedback_id,
      created_by: createdBy,
    });

    // ⚡ 即時再抽出を発火 (= 修正依頼を出した瞬間に LLM プロンプトに含めて再抽出)
    // GAS Web App の runFunc を fire-and-forget で叩く。失敗しても feedback INSERT 自体は成功扱い。
    // - member_knowledge: nav_member_knowledge_extractOne_(codeName, memberId, {force:true})
    // - project_knowledge / protocols / ms_progress: 当面は次回 cron まで待つ (= 仕組みは動く、即時化は後追い)
    // - meeting_summary: 再抽出しない。通知に出る時点で抽出済み・確定保存済みなので「はい」は確認マークのみ。
    //   誤抽出修正は cockpit の POST /api/meeting-summary/manual-update に一本化済み (2026-05-29)
    // - project_strategy_signal: 対話型 /api/notifications/feedback/dialog/* を別経路で使う (= 旧 reextractStrategySignalImmediate は廃止、2026-05-25 #71 まさ確定)
    // - ms_progress_revision: GAS 再抽出の対象外 (= revision の confirm/discard が完結処理)
    if (l2Kind !== "meeting_summary" && l2Kind !== "project_strategy_signal" && l2Kind !== "ms_progress_revision" && l2Kind !== "guardrail_match") {
      void triggerImmediateReExtraction({ l2Kind, targetId, scopeKey, meetingId, feedbackText: storedFeedbackText, feedbackId: data.feedback_id }).catch((e) => {
        console.warn("[feedback] immediate re-extract failed:", e);
      });
    }

    return NextResponse.json({ ok: true, feedback: data, action, applyResult });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function applyApprovedNotification(args: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  l2Kind: string;
  targetId: string;
  scopeKey: string;
  notificationId?: string | null;
  meetingId?: string | null;
  feedbackText: string;
  feedbackId: string;
  createdBy: string | null;
}): Promise<{ applied: boolean; message: string; row?: unknown }> {
  if (args.l2Kind === "meeting_summary") {
    return applyMeetingSummaryFeedback(args);
  }

  if (args.l2Kind === "member_knowledge") {
    const { data, error } = await args.supabase
      .from("member_knowledge")
      .update({ status: "active", updated_at: new Date().toISOString() })
      .eq("code_name", args.targetId)
      .eq("status", "candidate")
      .select("id, category, summary");
    if (error) return { applied: false, message: error.message };
    return { applied: (data ?? []).length > 0, message: `activated member_knowledge: ${(data ?? []).length}`, row: data };
  }

  if (args.l2Kind === "project_knowledge") {
    const query = args.supabase
      .from("project_knowledge")
      .update({ status: "active", updated_at: new Date().toISOString() })
      .eq("project_id", args.targetId)
      .eq("source", "l2_hourly_extract")
      .eq("status", "candidate");
    const scopedQuery = /^\d{6}$/.test(args.scopeKey)
      ? query.gte("updated_at", `${args.scopeKey.slice(0, 4)}-${args.scopeKey.slice(4, 6)}-01T00:00:00.000Z`)
      : query;
    const { data, error } = await scopedQuery.select("id, category, entity_name");
    if (error) return { applied: false, message: error.message };
    return { applied: (data ?? []).length > 0, message: `activated project_knowledge: ${(data ?? []).length}`, row: data };
  }

  if (args.l2Kind === "protocols") {
    const protocolId = args.scopeKey.match(/:protocol:([^:]+)$/)?.[1] ?? null;
    let query = args.supabase
      .from("protocols")
      .update({ status: "confirmed", updated_at: new Date().toISOString() })
      .eq("status", "candidate");
    query = protocolId ? query.eq("protocol_id", protocolId) : query;
    const { data, error } = await query.select("protocol_id, title, status");
    if (error) return { applied: false, message: error.message };
    return { applied: (data ?? []).length > 0, message: `confirmed protocols: ${(data ?? []).length}`, row: data };
  }

  if (args.l2Kind === "founding_members") {
    const { data, error } = await args.supabase
      .from("project_founding_members")
      .update({ status: "active", updated_at: new Date().toISOString() })
      .eq("project_id", args.targetId)
      .eq("status", "tentative")
      .gte("updated_at", args.scopeKey)
      .select("id, person_name, role, category");
    if (error) return { applied: false, message: error.message };
    return { applied: (data ?? []).length > 0, message: `activated founding_members: ${(data ?? []).length}`, row: data };
  }

  if (args.l2Kind === "project_member_candidate") {
    const memberId = extractScopePart(args.scopeKey, "member-candidate");
    if (!memberId) return { applied: false, message: "member_id not found in scope_key" };

    const { data: member, error: memberError } = await args.supabase
      .from("members")
      .select("member_id, code_name, status")
      .eq("member_id", memberId)
      .maybeSingle();
    if (memberError) return { applied: false, message: memberError.message };
    if (!member) return { applied: false, message: `member not found: ${memberId}` };

    const joinYm = args.scopeKey.match(/\b(20\d{4})\b/)?.[1] ?? null;
    const { data: row, error } = await args.supabase
      .from("project_members")
      .upsert(
        {
          project_id: args.targetId,
          member_id: memberId,
          role: "通知候補から承認",
          role_label: "メンバー",
          is_active: true,
          join_ym: joinYm,
          is_pm: false,
          is_pl: false,
          is_closer: false,
        },
        { onConflict: "project_id,member_id" }
      )
      .select()
      .single();
    if (error) return { applied: false, message: error.message };
    return { applied: true, message: `project_members upserted: ${args.targetId}/${memberId}`, row };
  }

  if (args.l2Kind === "project_contact_candidate") {
    const emails = extractEmails(`${args.scopeKey}\n${args.feedbackText}`);
    if (emails.length === 0) return { applied: false, message: "email not found in scope_key/comment" };
    const reportEmails = await filterProjectReportEmails(args.supabase, emails);
    if (reportEmails.length === 0) {
      return { applied: false, message: "skipped projects.report_emails: only internal/member emails found" };
    }

    const { data: project, error: projectError } = await args.supabase
      .from("projects")
      .select("project_id, report_emails")
      .eq("project_id", args.targetId)
      .maybeSingle();
    if (projectError) return { applied: false, message: projectError.message };
    if (!project) return { applied: false, message: `project not found: ${args.targetId}` };

    const current = String(project.report_emails || "");
    const merged = mergeCommaValues(current, reportEmails);
    const { data: row, error } = await args.supabase
      .from("projects")
      .update({ report_emails: merged })
      .eq("project_id", args.targetId)
      .select("project_id, report_emails")
      .single();
    if (error) return { applied: false, message: error.message };
    return { applied: true, message: `projects.report_emails updated: ${reportEmails.join(", ")}`, row };
  }

  if (args.l2Kind === "ms_progress") {
    return { applied: false, message: "ms_progress approval still uses monthly modal revision confirmation" };
  }

  if (args.l2Kind === "ms_progress_revision") {
    return confirmMsProgressRevision({
      supabase: args.supabase,
      targetId: args.targetId,
      scopeKey: args.scopeKey,
      notificationId: args.notificationId,
      createdBy: args.createdBy,
    });
  }

  if (args.l2Kind === "project_registry_diff") {
    const query = args.supabase
      .from("project_registry_diffs")
      .select("*")
      .eq("project_id", args.targetId)
      .in("status", ["pending", "accepted"]);
    const scopedQuery = args.scopeKey === "global"
      ? query.is("ym", null)
      : query.eq("ym", args.scopeKey);
    const { data: diffs, error } = await scopedQuery.order("created_at", { ascending: true }).limit(20);
    if (error) return { applied: false, message: error.message };
    if (!diffs || diffs.length === 0) return { applied: false, message: "no pending project_registry_diffs" };

    const results: string[] = [];
    for (const diff of diffs) {
      const applied = await applyRegistryDiff({
        supabase: args.supabase,
        projectId: args.targetId,
        diff,
        createdBy: args.createdBy,
      });
      results.push(applied.message);
      if (applied.applied) {
        await args.supabase
          .from("project_registry_diffs")
          .update({
            status: "applied",
            reviewed_by: args.createdBy,
            review_comment: args.feedbackText || null,
            reviewed_at: new Date().toISOString(),
            applied_at: new Date().toISOString(),
          })
          .eq("diff_id", diff.diff_id);
      }
    }
    return { applied: results.some((m) => m.startsWith("applied:")), message: results.join(" / ") };
  }

  if (args.l2Kind === "xrl_evidence") {
    return updateXrlEvidenceCandidates({
      supabase: args.supabase,
      targetId: args.targetId,
      scopeKey: args.scopeKey,
      notificationId: args.notificationId,
      status: "confirmed",
      createdBy: args.createdBy,
    });
  }

  if (args.l2Kind === "project_strategy_signal") {
    return updateStrategySignalCandidates({
      supabase: args.supabase,
      targetId: args.targetId,
      scopeKey: args.scopeKey,
      notificationId: args.notificationId,
      status: "confirmed",
      createdBy: args.createdBy,
    });
  }

  if (args.l2Kind === "textbook_insight") {
    return updateTextbookInsightCandidates({
      supabase: args.supabase,
      targetId: args.targetId,
      scopeKey: args.scopeKey,
      notificationId: args.notificationId,
      status: "approved",
      feedbackText: args.feedbackText,
      createdBy: args.createdBy,
    });
  }

  if (args.l2Kind === "coverage_gap") {
    // 「はい」= まさが「これは確かに未OS化の gap だ」と認める。gap を confirmed にする。
    // proposed_target_l2 (= action_item / shareholder_meeting 等) への実ルートは、
    // 既存の admin UI / 抽出器に委ねる (= ここでは gap の確定と routed_to 記録まで)。
    // scope_key = gap_id (= extract route が scope_key に gap_id を入れている)。
    const now = new Date().toISOString();
    const { data, error } = await args.supabase
      .from("l2_coverage_gaps")
      .update({ review_status: "confirmed", reviewed_at: now, routed_at: now, updated_at: now })
      .eq("gap_id", args.scopeKey)
      .eq("review_status", "candidate")
      .select("gap_id, proposed_target_l2, gap_class");
    if (error) return { applied: false, message: error.message };
    const row = (data ?? [])[0] as Record<string, unknown> | undefined;
    const target = row ? String(row.proposed_target_l2 ?? "未確定") : "";
    return {
      applied: (data ?? []).length > 0,
      message: `confirmed coverage_gap: ${(data ?? []).length}${target ? ` (本来の入れ先候補=${target})` : ""}`,
      row: data,
    };
  }

  if (args.l2Kind === "guardrail_match") {
    const now = new Date().toISOString();
    const { data, error } = await args.supabase
      .from("guardrail_matches")
      .update({ status: "acknowledged", updated_at: now })
      .eq("match_id", args.scopeKey)
      .in("status", ["open", "snoozed"])
      .select("match_id, card_id, title:target_title, severity, status");
    if (error) return { applied: false, message: error.message };
    const rows = data ?? [];
    for (const row of rows) {
      await args.supabase.from("guardrail_feedbacks").insert({
        match_id: row.match_id,
        card_id: row.card_id,
        action: "acknowledge",
        feedback_text: args.feedbackText || null,
        created_by: args.createdBy,
      });
    }
    return {
      applied: rows.length > 0,
      message: `acknowledged guardrail_match: ${rows.length}`,
      row: rows,
    };
  }

  return { applied: false, message: `no automatic apply handler for ${args.l2Kind}` };
}

/**
 * legacy MTGサマリ通知の「はい・反映」承認。
 *
 * 新規の議事録作成通知は廃止済み。既存の MTGサマリ通知に対する「はい」は
 * 「確認した」マーク (feedback 記録 + 既読化) であり、再抽出する対象は存在しない。
 *
 * かつて (2026-05-21) は固有名詞の修正コメントを付けた「はい」で Notion から再抽出して直す
 * "修正依頼ルート" があったが、誤抽出修正は cockpit の「議事録を手動修正」
 * (POST /api/meeting-summary/manual-update) に一本化された (2026-05-29) ため、通知側の同期再抽出は
 * 不要になり廃止した。手動 (manual:) / 対話 (dialogue:) / 予定枠 (upcoming:) 由来のサマリは
 * そもそも Notion ページを持たず、再抽出すると必ず notion_page_not_found で承認が弾かれていた
 * (2026-06-02 事故)。
 */
function applyMeetingSummaryFeedback(args: {
  meetingId?: string | null;
  scopeKey: string;
}): { applied: boolean; message: string } {
  const meetingId = String(args.meetingId || args.scopeKey || "").trim();
  return {
    applied: true,
    message: meetingId ? `meeting summary acknowledged: ${meetingId}` : "meeting summary acknowledged",
  };
}

async function rejectNotificationCandidates(args: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  l2Kind: string;
  targetId: string;
  scopeKey: string;
  notificationId?: string | null;
  feedbackText: string;
  createdBy: string | null;
}): Promise<{ applied: boolean; message: string; row?: unknown }> {
  if (args.l2Kind === "ms_progress_revision") {
    return discardMsProgressRevision({
      supabase: args.supabase,
      targetId: args.targetId,
      scopeKey: args.scopeKey,
      notificationId: args.notificationId,
      createdBy: args.createdBy,
    });
  }

  if (args.l2Kind === "project_registry_diff") {
    const query = args.supabase
      .from("project_registry_diffs")
      .update({
        status: "rejected",
        reviewed_by: args.createdBy,
        review_comment: args.feedbackText || null,
        reviewed_at: new Date().toISOString(),
      })
      .eq("project_id", args.targetId)
      .in("status", ["pending", "accepted"]);
    const scopedQuery = args.scopeKey === "global"
      ? query.is("ym", null)
      : query.eq("ym", args.scopeKey);
    const { data, error } = await scopedQuery.select("diff_id");
    if (error) return { applied: false, message: error.message };
    return { applied: false, message: `rejected registry diffs: ${(data ?? []).length}`, row: data };
  }

  if (args.l2Kind === "xrl_evidence") {
    return updateXrlEvidenceCandidates({
      supabase: args.supabase,
      targetId: args.targetId,
      scopeKey: args.scopeKey,
      notificationId: args.notificationId,
      status: "rejected",
      createdBy: args.createdBy,
    });
  }

  if (args.l2Kind === "project_strategy_signal") {
    return updateStrategySignalCandidates({
      supabase: args.supabase,
      targetId: args.targetId,
      scopeKey: args.scopeKey,
      notificationId: args.notificationId,
      status: "rejected",
      createdBy: args.createdBy,
    });
  }

  if (args.l2Kind === "textbook_insight") {
    return updateTextbookInsightCandidates({
      supabase: args.supabase,
      targetId: args.targetId,
      scopeKey: args.scopeKey,
      notificationId: args.notificationId,
      status: "rejected",
      feedbackText: args.feedbackText,
      createdBy: args.createdBy,
    });
  }

  if (args.l2Kind === "founding_members") {
    const { data, error } = await args.supabase
      .from("project_founding_members")
      .update({
        status: "invalid",
        notes: args.feedbackText ? `通知で不採用: ${args.feedbackText}` : "通知で不採用",
        updated_at: new Date().toISOString(),
      })
      .eq("project_id", args.targetId)
      .eq("status", "tentative")
      .gte("updated_at", args.scopeKey)
      .select("id, person_name");
    if (error) return { applied: false, message: error.message };
    return { applied: false, message: `rejected founding_members: ${(data ?? []).length}`, row: data };
  }

  if (args.l2Kind === "member_knowledge") {
    const { data, error } = await args.supabase
      .from("member_knowledge")
      .update({ status: "rejected", updated_at: new Date().toISOString() })
      .eq("code_name", args.targetId)
      .eq("status", "candidate")
      .select("id");
    if (error) return { applied: false, message: error.message };
    return { applied: false, message: `rejected member_knowledge: ${(data ?? []).length}`, row: data };
  }

  if (args.l2Kind === "project_knowledge") {
    const query = args.supabase
      .from("project_knowledge")
      .update({ status: "rejected", updated_at: new Date().toISOString() })
      .eq("project_id", args.targetId)
      .eq("source", "l2_hourly_extract")
      .eq("status", "candidate");
    const scopedQuery = /^\d{6}$/.test(args.scopeKey)
      ? query.gte("updated_at", `${args.scopeKey.slice(0, 4)}-${args.scopeKey.slice(4, 6)}-01T00:00:00.000Z`)
      : query;
    const { data, error } = await scopedQuery.select("id");
    if (error) return { applied: false, message: error.message };
    return { applied: false, message: `rejected project_knowledge: ${(data ?? []).length}`, row: data };
  }

  if (args.l2Kind === "protocols") {
    const protocolId = args.scopeKey.match(/:protocol:([^:]+)$/)?.[1] ?? null;
    let query = args.supabase
      .from("protocols")
      .update({ status: "rejected", updated_at: new Date().toISOString() })
      .eq("status", "candidate");
    query = protocolId ? query.eq("protocol_id", protocolId) : query;
    const { data, error } = await query.select("protocol_id");
    if (error) return { applied: false, message: error.message };
    return { applied: false, message: `rejected protocols: ${(data ?? []).length}`, row: data };
  }

  if (args.l2Kind === "coverage_gap") {
    // 「いいえ」= noise / 不要。gap を rejected にし、tsukuyomi_learnings (上流で INSERT 済) で
    // 類似 salience を次回抑制する。scope_key = gap_id。
    const { data, error } = await args.supabase
      .from("l2_coverage_gaps")
      .update({ review_status: "rejected", reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("gap_id", args.scopeKey)
      .eq("review_status", "candidate")
      .select("gap_id");
    if (error) return { applied: false, message: error.message };
    return { applied: false, message: `rejected coverage_gap: ${(data ?? []).length}`, row: data };
  }

  if (args.l2Kind === "guardrail_match") {
    const now = new Date().toISOString();
    const { data, error } = await args.supabase
      .from("guardrail_matches")
      .update({ status: "dismissed", resolved_at: now, updated_at: now })
      .eq("match_id", args.scopeKey)
      .in("status", ["open", "acknowledged", "snoozed"])
      .select("match_id, card_id, target_title, severity, status");
    if (error) return { applied: false, message: error.message };
    const rows = data ?? [];
    for (const row of rows) {
      await args.supabase.from("guardrail_feedbacks").insert({
        match_id: row.match_id,
        card_id: row.card_id,
        action: "dismiss",
        feedback_text: args.feedbackText || null,
        created_by: args.createdBy,
      });
    }
    return {
      applied: false,
      message: `dismissed guardrail_match: ${rows.length}`,
      row: rows,
    };
  }

  return { applied: false, message: "rejected" };
}

async function applyRegistryDiff(args: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  projectId: string;
  diff: Record<string, unknown>;
  createdBy: string | null;
}): Promise<{ applied: boolean; message: string; row?: unknown }> {
  const targetTable = String(args.diff.target_table ?? "");
  const patch = (args.diff.proposed_patch_json ?? {}) as Record<string, unknown>;

  if (targetTable === "project_members") {
    const memberId = typeof patch.member_id === "string" ? patch.member_id : null;
    if (!memberId) return { applied: false, message: "skipped project_members: member_id missing" };
    const payload: Record<string, unknown> = {
      project_id: args.projectId,
      member_id: memberId,
      is_active: typeof patch.is_active === "boolean" ? patch.is_active : true,
      role: typeof patch.role === "string" ? patch.role : "通知候補から承認",
      role_label: typeof patch.role_label === "string" ? patch.role_label : "メンバー",
      is_pm: typeof patch.is_pm === "boolean" ? patch.is_pm : false,
      is_pl: typeof patch.is_pl === "boolean" ? patch.is_pl : false,
      is_closer: typeof patch.is_closer === "boolean" ? patch.is_closer : false,
    };
    if (typeof patch.join_ym === "string") payload.join_ym = patch.join_ym;
    if (typeof patch.leave_ym === "string") payload.leave_ym = patch.leave_ym;
    const { data, error } = await args.supabase
      .from("project_members")
      .upsert(payload, { onConflict: "project_id,member_id" })
      .select()
      .single();
    if (error) return { applied: false, message: error.message };
    return { applied: true, message: `applied: project_members ${args.projectId}/${memberId}`, row: data };
  }

  if (targetTable === "projects") {
    const emails = [
      ...(typeof patch.report_emails === "string" ? extractEmails(patch.report_emails) : []),
      ...(typeof patch.email === "string" ? extractEmails(patch.email) : []),
      ...(Array.isArray(patch.emails) ? patch.emails.flatMap((v) => typeof v === "string" ? extractEmails(v) : []) : []),
    ];
    if (emails.length === 0) return { applied: false, message: "skipped projects: no report_emails/email patch" };
    const reportEmails = await filterProjectReportEmails(args.supabase, emails);
    if (reportEmails.length === 0) {
      return { applied: false, message: "skipped projects.report_emails: only internal/member emails found" };
    }
    const { data: project, error: projectError } = await args.supabase
      .from("projects")
      .select("project_id, report_emails")
      .eq("project_id", args.projectId)
      .maybeSingle();
    if (projectError) return { applied: false, message: projectError.message };
    if (!project) return { applied: false, message: `project not found: ${args.projectId}` };
    const merged = mergeCommaValues(String(project.report_emails || ""), reportEmails);
    const { data, error } = await args.supabase
      .from("projects")
      .update({ report_emails: merged })
      .eq("project_id", args.projectId)
      .select("project_id, report_emails")
      .single();
    if (error) return { applied: false, message: error.message };
    return { applied: true, message: `applied: projects.report_emails ${reportEmails.join(", ")}`, row: data };
  }

  if (targetTable === "project_partners") {
    const partnerName = typeof patch.partner_name === "string" ? patch.partner_name : null;
    const partnerType = typeof patch.partner_type === "string" ? patch.partner_type : "collab";
    if (!partnerName || !["collab", "customer"].includes(partnerType)) {
      return { applied: false, message: "skipped project_partners: partner_name/partner_type missing" };
    }
    const payload = {
      project_id: args.projectId,
      partner_name: partnerName,
      partner_type: partnerType,
      partner_role: typeof patch.partner_role === "string" ? patch.partner_role : null,
      notes: typeof patch.notes === "string" ? patch.notes : `通知候補から承認${args.createdBy ? ` by ${args.createdBy}` : ""}`,
    };
    const { data, error } = await args.supabase
      .from("project_partners")
      .insert(payload)
      .select()
      .single();
    if (error) return { applied: false, message: error.message };
    return { applied: true, message: `applied: project_partners ${partnerName}`, row: data };
  }

  return { applied: false, message: `skipped unsupported target_table: ${targetTable}` };
}

function extractScopePart(scopeKey: string, marker: string): string | null {
  const parts = scopeKey.split(":").map((p) => p.trim()).filter(Boolean);
  const idx = parts.indexOf(marker);
  return idx >= 0 ? parts[idx + 1] || null : null;
}

function extractEmails(text: string): string[] {
  const matches = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
  return Array.from(new Set(matches.map((m) => m.trim().toLowerCase())));
}

function mergeCommaValues(current: string, additions: string[]): string {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of [...current.split(","), ...additions]) {
    const value = raw.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out.join(", ");
}

function objectValue(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function textValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function xrlNotificationYm(scopeKey: string): string {
  if (scopeKey === "global") return "global";
  return scopeKey.match(/20\d{4}/)?.[0] ?? scopeKey;
}

async function loadNotificationMetadata(
  supabase: Awaited<ReturnType<typeof createClient>>,
  notificationId?: string | null
): Promise<Record<string, unknown>> {
  if (!notificationId) return {};
  const { data, error } = await supabase
    .from("l2_notifications")
    .select("metadata_json")
    .eq("notification_id", notificationId)
    .maybeSingle();
  if (error) return {};
  return objectValue(data?.metadata_json);
}

/**
 * ms_progress_revision 通知の revision 行を特定する。
 * 第一候補: l2_notifications.metadata_json.revision_id (progress-estimator が必ず入れる)。
 * フォールバック: scope_key = `${ym}:${msKey}` から pending revision を特定。
 */
async function resolveMsProgressRevision(args: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  db: ReturnType<typeof getServiceClient>;
  targetId: string;
  scopeKey: string;
  notificationId?: string | null;
}): Promise<{ revision: Record<string, unknown> | null; message: string }> {
  const meta = await loadNotificationMetadata(args.supabase, args.notificationId);
  const revisionId = textValue(meta.revision_id);

  if (revisionId) {
    const { data, error } = await args.db
      .from("ms_progress_revisions")
      .select("*")
      .eq("id", revisionId)
      .maybeSingle();
    if (error) return { revision: null, message: error.message };
    if (data) return { revision: data as Record<string, unknown>, message: `revision ${revisionId}` };
  }

  const scopeMatch = args.scopeKey.match(/^(\d{6}):(.+)$/);
  if (!scopeMatch) {
    return { revision: null, message: "revision_id not in metadata and scope_key unparsable" };
  }
  const [, ym, milestoneId] = scopeMatch;
  const { data: rows, error } = await args.db
    .from("ms_progress_revisions")
    .select("*")
    .eq("project_id", args.targetId)
    .eq("milestone_id", milestoneId)
    .eq("ym", ym)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) return { revision: null, message: error.message };
  const row = (rows ?? [])[0] as Record<string, unknown> | undefined;
  return {
    revision: row ?? null,
    message: row ? `pending revision for ${milestoneId}/${ym}` : `no pending revision for ${milestoneId}/${ym}`,
  };
}

/**
 * ms_progress_revision 通知の「はい」承認。
 * /api/progress/revisions PATCH(confirm) と同一の正本反映:
 *   milestone_monthly_progress upsert (source='tsukuyomi_revision')
 *   → revision confirmed → tsukuyomi_learnings → member_ms_activities 学習追記
 *   → reward_summary 再同期。
 * 確認されない限りデフォルト月割り値 (routine_auto) が有効のまま、が本契約。
 */
async function confirmMsProgressRevision(args: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  targetId: string;
  scopeKey: string;
  notificationId?: string | null;
  createdBy: string | null;
}): Promise<{ applied: boolean; message: string; row?: unknown }> {
  const db = getServiceClient();
  const resolved = await resolveMsProgressRevision({ ...args, db });
  const revision = resolved.revision;
  if (!revision) return { applied: false, message: `ms_progress_revision: ${resolved.message}` };
  const status = String(revision.status || "");
  if (status !== "pending") {
    return { applied: false, message: `ms_progress_revision already ${status}` };
  }

  const now = new Date().toISOString();
  const revisionDbId = String(revision.id);
  const milestoneId = String(revision.milestone_id);
  const ym = String(revision.ym);
  const projectId = String(revision.project_id);

  const { data: msRows } = await db
    .from("value_milestones")
    .select("points")
    .eq("milestone_id", milestoneId)
    .limit(1);
  const points = Number(msRows?.[0]?.points || 0);
  const revisedPct = Math.max(0, Math.min(100, Number(revision.revised_pct || 0)));
  const consumedPt = Math.round(points * revisedPct / 100 * 100) / 100;
  const revisedNote = String(revision.revised_note || "");

  const { error: progressError } = await db
    .from("milestone_monthly_progress")
    .upsert(
      {
        milestone_key: milestoneId,
        ym,
        progress_pct: revisedPct,
        consumed_pt: consumedPt,
        source: "tsukuyomi_revision",
        confirmed_at: now,
        note: revisedNote,
      },
      { onConflict: "milestone_key,ym" }
    );
  if (progressError) return { applied: false, message: progressError.message };

  await db
    .from("ms_progress_revisions")
    .update({ status: "confirmed", confirmed_by: args.createdBy, confirmed_at: now })
    .eq("id", revisionDbId);

  await db.from("tsukuyomi_learnings").insert({
    scope: "msActivity",
    scope_key: projectId,
    content: revisedNote || `MS ${milestoneId} の修正提案を採用`,
    source: "ms_revision_confirmed",
    source_ref: revisionDbId,
    created_by: args.createdBy,
  });

  const { data: respRows } = await db
    .from("milestone_responsibility")
    .select("member_id")
    .eq("milestone_id", milestoneId);
  for (const resp of respRows || []) {
    const { data: existing } = await db
      .from("member_ms_activities")
      .select("learned_addendum")
      .eq("member_id", resp.member_id)
      .eq("milestone_id", milestoneId)
      .eq("ym", ym)
      .maybeSingle();
    const current = String(existing?.learned_addendum || "").trim();
    const addendum = `つくよみ修正学習: ${revisedNote}`.trim();
    await db
      .from("member_ms_activities")
      .upsert(
        {
          member_id: resp.member_id,
          milestone_id: milestoneId,
          ym,
          learned_addendum: current ? `${current}\n${addendum}` : addendum,
          generated_at: now,
        },
        { onConflict: "member_id,milestone_id,ym" }
      );
  }

  let rewardMessage = "";
  try {
    await syncRewardSummaryForCycle(db, projectId, ym);
    rewardMessage = " / reward_summary synced";
  } catch (err) {
    rewardMessage = ` / reward sync failed: ${err instanceof Error ? err.message : String(err)}`;
  }

  return {
    applied: true,
    message: `confirmed ms_progress_revision ${milestoneId}/${ym}: ${revisedPct}% (consumed ${consumedPt}pt)${rewardMessage}`,
    row: { revision_id: revisionDbId, milestone_id: milestoneId, ym, progress_pct: revisedPct, consumed_pt: consumedPt },
  };
}

/**
 * ms_progress_revision 通知の「いいえ」。
 * revision を discarded にするだけで milestone_monthly_progress は触らない
 * (= デフォルト月割り値が有効のまま)。同値の再提案は progress-estimator 側が抑止する。
 */
async function discardMsProgressRevision(args: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  targetId: string;
  scopeKey: string;
  notificationId?: string | null;
  createdBy: string | null;
}): Promise<{ applied: boolean; message: string; row?: unknown }> {
  const db = getServiceClient();
  const resolved = await resolveMsProgressRevision({ ...args, db });
  const revision = resolved.revision;
  if (!revision) return { applied: false, message: `ms_progress_revision: ${resolved.message}` };
  const status = String(revision.status || "");
  if (status !== "pending") {
    return { applied: false, message: `ms_progress_revision already ${status}` };
  }
  const revisionDbId = String(revision.id);
  const { error } = await db
    .from("ms_progress_revisions")
    .update({ status: "discarded", confirmed_by: args.createdBy, confirmed_at: new Date().toISOString() })
    .eq("id", revisionDbId);
  if (error) return { applied: false, message: error.message };
  return {
    applied: false,
    message: `discarded ms_progress_revision ${String(revision.milestone_id)}/${String(revision.ym)} (デフォルト月割りが有効のまま)`,
    row: { revision_id: revisionDbId },
  };
}

async function updateXrlEvidenceCandidates(args: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  targetId: string;
  scopeKey: string;
  notificationId?: string | null;
  status: "confirmed" | "rejected";
  createdBy: string | null;
}): Promise<{ applied: boolean; message: string; row?: unknown }> {
  const meta = await loadNotificationMetadata(args.supabase, args.notificationId);
  const ym = xrlNotificationYm(args.scopeKey);
  const axis = textValue(meta.axis).toLowerCase();
  const evidenceKind = textValue(meta.evidence_kind);
  const sourceHash = textValue(meta.evidence_source_hash);
  const now = new Date().toISOString();

  const run = async (includeSourceHash: boolean) => {
    let query = args.supabase
      .from("project_xrl_evidence")
      .update({
        status: args.status,
        confirmed_by: args.createdBy,
        confirmed_at: now,
        updated_at: now,
      })
      .eq("project_id", args.targetId)
      .eq("status", "candidate");
    query = ym === "global" ? query.is("ym", null) : query.eq("ym", ym);
    query = axis ? query.eq("axis", axis) : query;
    query = evidenceKind ? query.eq("evidence_kind", evidenceKind) : query;
    query = includeSourceHash && sourceHash ? query.eq("source_hash", sourceHash) : query;
    return query.select("evidence_id, axis, evidence_kind, summary, source_hash");
  };

  const exact = await run(true);
  if (exact.error) return { applied: false, message: exact.error.message };
  if ((exact.data ?? []).length > 0 || !sourceHash) {
    return {
      applied: (exact.data ?? []).length > 0,
      message: `${args.status} xrl evidence: ${(exact.data ?? []).length}`,
      row: exact.data,
    };
  }

  const fallback = await run(false);
  if (fallback.error) return { applied: false, message: fallback.error.message };
  return {
    applied: (fallback.data ?? []).length > 0,
    message: `${args.status} xrl evidence: ${(fallback.data ?? []).length}`,
    row: fallback.data,
  };
}

async function updateStrategySignalCandidates(args: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  targetId: string;
  scopeKey: string;
  notificationId?: string | null;
  status: "confirmed" | "rejected";
  createdBy: string | null;
}): Promise<{ applied: boolean; message: string; row?: unknown }> {
  const meta = await loadNotificationMetadata(args.supabase, args.notificationId);
  const ym = xrlNotificationYm(args.scopeKey);
  const signalType = textValue(meta.signal_type);
  const sourceHash = textValue(meta.signal_source_hash);
  const now = new Date().toISOString();

  const run = async (includeSourceHash: boolean) => {
    let query = args.supabase
      .from("project_strategy_signals")
      .update({
        status: args.status,
        confirmed_by: args.createdBy,
        confirmed_at: now,
        updated_at: now,
      })
      .eq("project_id", args.targetId)
      .eq("status", "candidate");
    query = ym === "global" ? query.is("ym", null) : query.eq("ym", ym);
    query = signalType ? query.eq("signal_type", signalType) : query;
    query = includeSourceHash && sourceHash ? query.eq("source_hash", sourceHash) : query;
    return query.select("signal_id, signal_type, title, source_hash, status");
  };

  const exact = await run(true);
  if (exact.error) return { applied: false, message: exact.error.message };
  if ((exact.data ?? []).length > 0 || !sourceHash) {
    return {
      applied: (exact.data ?? []).length > 0,
      message: `${args.status} strategy signals: ${(exact.data ?? []).length}`,
      row: exact.data,
    };
  }

  const fallback = await run(false);
  if (fallback.error) return { applied: false, message: fallback.error.message };
  return {
    applied: (fallback.data ?? []).length > 0,
    message: `${args.status} strategy signals: ${(fallback.data ?? []).length}`,
    row: fallback.data,
  };
}

async function updateTextbookInsightCandidates(args: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  targetId: string;
  scopeKey: string;
  notificationId?: string | null;
  status: "approved" | "rejected";
  feedbackText: string;
  createdBy: string | null;
}): Promise<{ applied: boolean; message: string; row?: unknown }> {
  const meta = await loadNotificationMetadata(args.supabase, args.notificationId);
  const sourceHash = textValue(meta.candidate_source_hash);
  const candidateId = textValue(meta.candidate_id);
  const now = new Date().toISOString();

  const run = async (includeExact: boolean) => {
    let query = args.supabase
      .from("textbook_insight_candidates")
      .update({
        status: args.status,
        reviewed_by: args.createdBy,
        review_comment: args.feedbackText || null,
        reviewed_at: now,
        updated_at: now,
      })
      .eq("target_id", args.targetId)
      .eq("status", "candidate");
    if (includeExact && candidateId) query = query.eq("candidate_id", candidateId);
    if (includeExact && sourceHash && !candidateId) query = query.eq("source_hash", sourceHash);
    if (!includeExact) query = query.eq("scope_key", args.scopeKey);
    return query.select("candidate_id, title, target_bzm_slug, insight_type, metadata_json, confidentiality, bzm_review_required, bzm_review_status, theory_change_scope, status");
  };

  if (candidateId || sourceHash) {
    const exact = await run(true);
    if (exact.error) return { applied: false, message: exact.error.message };
    if ((exact.data ?? []).length > 0 || candidateId || sourceHash) {
      return {
        applied: (exact.data ?? []).length > 0,
        message: `${args.status} textbook insight candidates: ${(exact.data ?? []).length}`,
        row: exact.data,
      };
    }
  }

  const fallback = await run(false);
  if (fallback.error) return { applied: false, message: fallback.error.message };
  return {
    applied: (fallback.data ?? []).length > 0,
    message: `${args.status} textbook insight candidates: ${(fallback.data ?? []).length}`,
    row: fallback.data,
  };
}

async function filterProjectReportEmails(
  supabase: Awaited<ReturnType<typeof createClient>>,
  emails: string[]
): Promise<string[]> {
  const normalized = Array.from(new Set(emails.map((email) => email.trim().toLowerCase()).filter(Boolean)));
  if (normalized.length === 0) return [];
  const { data, error } = await supabase
    .from("members")
    .select("email")
    .not("email", "is", null);
  if (error) throw new Error(error.message);
  const memberEmails = new Set(
    (data ?? [])
      .map((row) => String(row.email || "").trim().toLowerCase())
      .filter(Boolean)
  );
  return normalized.filter((email) => !email.endsWith("@team-armada.jp") && !memberEmails.has(email));
}

/** 修正依頼が入った瞬間に対応する 1 件を force 再抽出する。
 *  GAS Web App の pwaApi/runFunc にリクエストを送る。
 *
 *  D-6 project_strategy_signal は対話型 (= /api/notifications/feedback/dialog/*) に置換済み
 *  なので、ここでは扱わない (= 呼び出し側で l2Kind === 'project_strategy_signal' を弾く)。
 *  旧 reextractStrategySignalImmediate (= 一方通行 update) は 2026-05-25 #71 まさ確定で廃止。
 */
async function triggerImmediateReExtraction(args: {
  l2Kind: string;
  targetId: string;
  scopeKey: string;
  meetingId: string | null;
  feedbackText?: string;
  feedbackId?: string;
}): Promise<GasRunResponse | null> {
  const baseUrl = process.env.NEXT_PUBLIC_GAS_WEBAPP_URL || "";
  const apiKey = process.env.NEXT_PUBLIC_GAS_API_KEY || process.env.CRON_SECRET || "";
  if (!baseUrl) return { ok: false, error: "NEXT_PUBLIC_GAS_WEBAPP_URL missing" };

  let fn = "";
  let fnArgs: unknown[] = [];

  if (args.l2Kind === "meeting_summary" && args.meetingId) {
    fn = "nav_meeting_processOneEvent_";
    fnArgs = [args.meetingId, args.targetId, { force: true }];
  } else if (args.l2Kind === "member_knowledge") {
    // member_id は GAS 側で resolve できないので targetId(code_name) と "" を渡す → GAS 側で resolve
    fn = "nav_member_knowledge_extractOne_";
    fnArgs = [args.targetId, "", { force: true }];
  } else if (args.l2Kind === "project_knowledge") {
    fn = "nav_project_knowledge_extractOneForYm_";
    fnArgs = [args.targetId, args.scopeKey, { force: true }];
  } else if (args.l2Kind === "protocols") {
    fn = "nav_protocol_extractOneForYm_";
    const ym = args.scopeKey.match(/^(20\d{4}):protocol:/)?.[1] ?? args.scopeKey;
    fnArgs = [args.targetId, ym, { force: true }];
  } else {
    return null; // 不明 kind は再抽出しない (= 次回 cron 待ち)
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
      return fetchGasRunFunc(url2);
    } catch (e) {
      console.warn("[feedback] member resolve failed:", e);
    }
  }

  // GAS Web App は GET / 60 秒タイムアウト想定
  return fetchGasRunFunc(url);
}

type GasRunResponse = {
  ok?: boolean;
  error?: string;
  data?: {
    fn?: string;
    ms?: number;
    result?: {
      ok?: boolean;
      action?: string;
      message?: string;
      summaryShort?: string;
      [key: string]: unknown;
    };
  };
};

async function fetchGasRunFunc(url: string): Promise<GasRunResponse> {
  const res = await fetch(url, { method: "GET", signal: AbortSignal.timeout(120000) });
  const text = await res.text();
  let json: GasRunResponse;
  try {
    json = JSON.parse(text) as GasRunResponse;
  } catch {
    return { ok: false, error: `GAS returned non-JSON (${res.status}): ${text.slice(0, 200)}` };
  }
  if (!res.ok) {
    return { ok: false, error: json.error || `GAS HTTP ${res.status}` };
  }
  return json;
}
