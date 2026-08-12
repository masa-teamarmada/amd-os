/**
 * POST /api/notifications/feedback
 *
 * Phase 4 通知に対するまさからの修正依頼を l2_feedbacks に INSERT する。
 * 上流 (GAS 155 / gas/074 / PWA progress-estimator) は
 * 「過去のフィードバック」を LLM プロンプトに含めて再抽出する。
 * 通知に出た候補は「はい」だけで正本反映する。
 * candidate/tentative 系の L2 は yes=active/confirmed、no=rejected/invalid。
 * protocols は UI 正本に合わせて yes=confirmed。
 * meeting_summary は通知に出る時点で抽出済み・確定保存済みなので、「はい」は確認マーク (feedback 記録 + 既読化) のみ。再抽出しない。
 *
 * Body:
 *   {
 *     l2_kind: 'member_knowledge'|'project_knowledge'|'protocols'|'ms_progress'|'ms_progress_revision'|'meeting_summary'|'project_registry_diff'|'xrl_evidence'|'project_strategy_signal'|'textbook_insight'|'news_mention'|'action_item'|'coverage_gap'|'guardrail_match',
 *     target_id: string,            // code_name (member系) / project_id (PJ系)
 *     scope_key?: string,            // ym (PJ系) / 'global' (member系) — default 'global'
 *     notification_id?: string,      // 関連 l2_notifications (optional)
 *     meeting_id?: string,           // 関連 meeting_notifications (optional)
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
      "action_item",
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

  if (args.l2Kind === "news_mention") {
    return updateMediaMentionReviewStatus({
      supabase: args.supabase,
      scopeKey: args.scopeKey,
      reviewStatus: "confirmed",
    });
  }

  if (args.l2Kind === "coverage_gap") {
    // 「はい」= まさが「これは確かに未OS化の gap だ」と認める。
    // proposed_target_l2 が自動反映可能なものはこの場で実ルートまで完了し、
    // routed_to に行き先を残す。手動後処理を標準経路にしない。
    const now = new Date().toISOString();
    const { data: gap, error: gapError } = await args.supabase
      .from("l2_coverage_gaps")
      .select("gap_id, source, source_ref, source_hash, title, summary, salience_score, proposed_target_l2, gap_class, project_id, scope, due_at, review_status, routed_to, evidence_refs_json, detected_at")
      .eq("gap_id", args.scopeKey)
      .maybeSingle();
    if (gapError) return { applied: false, message: gapError.message };
    if (!gap) return { applied: false, message: `coverage_gap not found: ${args.scopeKey}` };
    if (gap.review_status === "rejected") {
      return { applied: false, message: `coverage_gap already rejected: ${args.scopeKey}`, row: gap };
    }

    const routeResult = await routeCoverageGapIfSupported({
      supabase: args.supabase,
      gap: gap as CoverageGapRow,
      createdBy: args.createdBy,
      feedbackText: args.feedbackText,
      now,
    });
    if (routeResult.error) return { applied: false, message: routeResult.error, row: gap };

    const patch: Record<string, unknown> = {
      review_status: "confirmed",
      reviewed_at: now,
      updated_at: now,
    };
    if (routeResult.routedTo) {
      patch.routed_to = routeResult.routedTo;
      patch.routed_at = now;
    }

    const { data, error } = await args.supabase
      .from("l2_coverage_gaps")
      .update(patch)
      .eq("gap_id", args.scopeKey)
      .neq("review_status", "rejected")
      .select("gap_id, proposed_target_l2, gap_class, review_status, routed_to");
    if (error) return { applied: false, message: error.message };
    const row = (data ?? [])[0] as Record<string, unknown> | undefined;
    const target = row ? String(row.proposed_target_l2 ?? "未確定") : "";
    return {
      applied: (data ?? []).length > 0,
      message: [
        `confirmed coverage_gap: ${(data ?? []).length}${target ? ` (本来の入れ先候補=${target})` : ""}`,
        routeResult.message,
      ].filter(Boolean).join(" / "),
      row: { gap: data, routed: routeResult.row },
    };
  }

  if (args.l2Kind === "action_item") {
    return updateActionItemReviewStatus({
      supabase: args.supabase,
      actionId: args.scopeKey,
      reviewStatus: "confirmed",
      feedbackText: args.feedbackText,
      createdBy: args.createdBy,
    });
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

type CoverageGapRow = {
  gap_id: string;
  source: string | null;
  source_ref: string | null;
  source_hash: string | null;
  title: string | null;
  summary: string | null;
  salience_score: number | string | null;
  proposed_target_l2: string | null;
  gap_class: string | null;
  project_id: string | null;
  scope: string | null;
  due_at: string | null;
  review_status: string | null;
  routed_to: string | null;
  evidence_refs_json: unknown;
  detected_at: string | null;
};

async function routeCoverageGapIfSupported(args: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  gap: CoverageGapRow;
  createdBy: string | null;
  feedbackText: string;
  now: string;
}): Promise<{ routedTo?: string; message?: string; row?: unknown; error?: string }> {
  const target = normalizeCoverageTarget(args.gap.proposed_target_l2);
  if (target === "shareholder_meeting") {
    return routeGovernanceMeetingCoverageGap(args);
  }
  if (target === "important_document") {
    return routeImportantDocumentCoverageGap(args);
  }
  if (target !== "strategy_signal") {
    return {
      message: target
        ? `route not automated yet: ${target}`
        : "route skipped: proposed_target_l2 is empty",
    };
  }

  const projectId = String(args.gap.project_id || "").trim();
  if (!projectId) return { error: "coverage_gap strategy_signal route requires project_id" };

  const signalRow = buildStrategySignalFromCoverageGap(args.gap, {
    projectId,
    createdBy: args.createdBy,
    feedbackText: args.feedbackText,
    now: args.now,
  });

  const { data, error } = await args.supabase
    .from("project_strategy_signals")
    .upsert(signalRow, { onConflict: "project_id,scope_key,signal_type,source_hash" })
    .select("signal_id, project_id, ym, signal_type, title, status, source_hash")
    .single();
  if (error) return { error: `project_strategy_signals route failed: ${error.message}` };
  const signalId = String(data?.signal_id || "");
  return {
    routedTo: signalId ? `project_strategy_signals:${signalId}` : "project_strategy_signals",
    message: signalId ? `routed project_strategy_signals:${signalId}` : "routed project_strategy_signals",
    row: data,
  };
}

/**
 * 正式書類候補は、通知で採用された時だけ追記型の正本へ移す。
 * raw本文・URL・BZM現行revisionは書かず、allowlistしたlineage/facts/接続候補だけを保存する。
 */
async function routeImportantDocumentCoverageGap(args: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  gap: CoverageGapRow;
  createdBy: string | null;
  feedbackText: string;
  now: string;
}): Promise<{ routedTo?: string; message?: string; row?: unknown; error?: string }> {
  const projectId = String(args.gap.project_id || "").trim();
  if (!projectId) return { error: "重要書類の追加先プロジェクトがない" };
  const evidence = objectValue(args.gap.evidence_refs_json);
  const candidate = objectValue(evidence.important_document);
  if (textValue(candidate.candidate_kind) !== "important_document" || textValue(candidate.review_status) !== "candidate") {
    return { error: "重要書類のcandidate証跡がない" };
  }
  if (textValue(candidate.project_id) !== projectId) return { error: "重要書類候補のプロジェクトが一致しない" };
  if (textValue(candidate.source_hash) !== textValue(args.gap.source_hash)) return { error: "重要書類候補のsource hashが一致しない" };

  const contentSha256 = textValue(candidate.content_sha256).toLowerCase();
  const sourceHash = textValue(candidate.source_hash).toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(contentSha256) || !/^[0-9a-f]{64}$/.test(sourceHash)) {
    return { error: "重要書類候補のcontent/source hashが不正" };
  }
  const periodStart = ymdValue(candidate.reporting_period_start);
  const periodEnd = ymdValue(candidate.reporting_period_end);
  if (!periodStart || !periodEnd || periodStart > periodEnd) return { error: "重要書類候補の対象期間が不正" };

  const lineage = sanitizeImportantDocumentLineage(candidate.lineage);
  const facts = sanitizeImportantDocumentFacts(candidate.facts);
  const bzmCandidates = sanitizeImportantDocumentBzmCandidates(candidate.bzm_input_candidates);
  const rawLineageCount = Array.isArray(candidate.lineage) ? Math.min(candidate.lineage.length, 50) : 0;
  const rawFactCount = Array.isArray(candidate.facts) ? Math.min(candidate.facts.length, 100) : 0;
  const rawBzmCount = Array.isArray(candidate.bzm_input_candidates) ? Math.min(candidate.bzm_input_candidates.length, 100) : 0;
  if (lineage.length === 0 || facts.length === 0 || bzmCandidates.length === 0) {
    return { error: "重要書類候補のlineage、facts、BZM接続候補のいずれかが空" };
  }
  if (lineage.length !== rawLineageCount || facts.length !== rawFactCount || bzmCandidates.length !== rawBzmCount) {
    return { error: "重要書類候補にallowlist検査を通らないfieldがある" };
  }
  if (Array.isArray(candidate.monthly_actuals) && candidate.monthly_actuals.length > 0) {
    return { error: "年度重要書類候補に月次実績を混在させない" };
  }
  const forbiddenValueFact = facts.find((fact) =>
    ["financing_cash_flow", "grant_deposit", "grant_commitment_cap"].includes(String(fact.temporal_class))
    && (fact.include_in_revenue === true || fact.include_in_company_value === true));
  if (forbiddenValueFact) return { error: `重要書類候補の会計分類が不正: ${String(forbiddenValueFact.fact_key)}` };

  const version = objectValue(candidate.version);
  const versionRank = Math.max(1, Math.floor(numberValue(version.rank, 1)));
  const versionState = ["canonical_candidate", "superseded_candidate"].includes(textValue(version.state))
    ? textValue(version.state)
    : "canonical_candidate";
  const db = getServiceClient();
  const { data: existing, error: existingError } = await db
    .from("project_important_documents")
    .select("important_document_id, project_id, document_class, reporting_period_end, content_sha256, status")
    .eq("project_id", projectId)
    .eq("content_sha256", contentSha256)
    .maybeSingle();
  if (existingError) return { error: `重要書類の重複確認に失敗: ${existingError.message}` };
  if (existing) {
    const id = String(existing.important_document_id || "");
    return {
      routedTo: id ? `project_important_documents:${id}` : "project_important_documents",
      message: "同じ内容hashの重要書類はすでに正本化済み",
      row: { ...existing, already_existed: true },
    };
  }

  const missingFields = Array.isArray(candidate.missing_fields)
    ? candidate.missing_fields.slice(0, 100).map((value) => limitedText(value, 120)).filter(Boolean)
    : [];
  const row = {
    project_id: projectId,
    source_gap_id: args.gap.gap_id,
    source_hash: sourceHash,
    content_sha256: contentSha256,
    document_class: limitedText(candidate.document_class, 120) || "important_document",
    document_title: limitedText(candidate.title, 500) || "正式書類",
    company_name: limitedText(candidate.company_name, 300),
    mime_type: limitedText(candidate.mime_type, 160),
    reporting_period_start: periodStart,
    reporting_period_end: periodEnd,
    balance_sheet_date: ymdValue(candidate.balance_sheet_date),
    audited: candidate.audited === true,
    audit_opinion: ["unqualified", "other", "unknown"].includes(textValue(candidate.audit_opinion))
      ? textValue(candidate.audit_opinion)
      : "unknown",
    audit_signed_on: ymdValue(candidate.audit_signed_on),
    canonical_file_id: limitedText(candidate.canonical_file_id, 300),
    lineage_json: lineage,
    version_family_key: limitedText(version.family_key, 500),
    version_rank: versionRank,
    version_state: versionState,
    facts_json: facts,
    bzm_input_candidates_json: bzmCandidates,
    missing_fields_json: missingFields,
    status: "confirmed",
    confirmed_by: args.createdBy || "notification_feedback",
    confirmed_at: args.now,
    updated_at: args.now,
  };
  if (!row.company_name || !row.mime_type || !row.canonical_file_id || !row.version_family_key) {
    return { error: "重要書類候補の必須metadataが不足" };
  }
  const { data, error } = await db
    .from("project_important_documents")
    .insert(row)
    .select("important_document_id, project_id, document_class, reporting_period_start, reporting_period_end, content_sha256, audited, status")
    .single();
  if (error) return { error: `重要書類の正本化に失敗: ${error.message}` };
  const id = String(data?.important_document_id || "");
  return {
    routedTo: id ? `project_important_documents:${id}` : "project_important_documents",
    message: "重要書類を内容hash単位で1件正本化した。BZM入力は候補のまま分離した",
    row: data,
  };
}

/**
 * ガバナンス候補の採用は、承認済みの候補だけを会社概要の開催履歴へ1行追加する。
 * 候補検出時に保持していたメール参照や添付URLは、この正本行の表示用データへ持ち込まない。
 */
async function routeGovernanceMeetingCoverageGap(args: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  gap: CoverageGapRow;
  createdBy: string | null;
  feedbackText: string;
  now: string;
}): Promise<{ routedTo?: string; message?: string; row?: unknown; error?: string }> {
  const projectId = String(args.gap.project_id || "").trim();
  if (!projectId) return { error: "開催履歴の追加先プロジェクトがない" };

  const evidence = objectValue(args.gap.evidence_refs_json);
  const candidate = objectValue(evidence.governance_meeting);
  const candidateProjectId = textValue(candidate.project_id);
  if (candidateProjectId && candidateProjectId !== projectId) {
    return { error: "開催履歴候補のプロジェクトが一致しない" };
  }

  const agenda = limitedText(candidate.agenda_summary, 3000) || limitedText(args.gap.summary, 3000);
  if (!agenda) return { error: "開催履歴に追加する議題が確認できない" };

  const meetingDate = ymdValue(candidate.meeting_date);
  const meetingType = normalizeGovernanceMeetingType(textValue(candidate.meeting_type));
  const sourceRef = limitedText(candidate.source_ref, 300) || limitedText(args.gap.source_ref, 300) || null;
  const row = {
    project_id: projectId,
    meeting_type: meetingType,
    meeting_date: meetingDate,
    meeting_ym: meetingDate ? meetingDate.replace(/-/g, "").slice(0, 6) : null,
    location: limitedText(candidate.location, 200) || null,
    agenda_summary: agenda,
    resolutions_json: sanitizeGovernanceResolutions(candidate.resolutions_json),
    amd_response: limitedText(candidate.amd_response, 80) || null,
    amd_response_at: limitedText(candidate.amd_response_at, 80) || null,
    related_action_id: limitedText(candidate.related_action_id, 140) || null,
    attachments_json: sanitizeGovernanceAttachments(candidate.attachments_json),
    // source_ref は重複防止・監査用だけに使い、通知カードや開催履歴の表示内容には出さない。
    source_ref: sourceRef,
    notes: [
      "通知で確認済みの開催履歴候補から追加。",
      args.feedbackText ? `承認コメント: ${limitedText(args.feedbackText, 500)}` : null,
    ].filter(Boolean).join("\n"),
    updated_at: args.now,
  };

  const db = getServiceClient();
  let existingId: string | null = null;
  if (sourceRef) {
    const { data, error } = await db
      .from("project_shareholder_meetings")
      .select("id")
      .eq("project_id", projectId)
      .eq("source_ref", sourceRef)
      .limit(1);
    if (error) return { error: `開催履歴の重複確認に失敗: ${error.message}` };
    existingId = data?.[0]?.id ? String(data[0].id) : null;
  }
  if (!existingId) {
    let query = db
      .from("project_shareholder_meetings")
      .select("id")
      .eq("project_id", projectId)
      .eq("meeting_type", meetingType)
      .eq("agenda_summary", agenda);
    query = meetingDate ? query.eq("meeting_date", meetingDate) : query.is("meeting_date", null);
    const { data, error } = await query.limit(1);
    if (error) return { error: `開催履歴の重複確認に失敗: ${error.message}` };
    existingId = data?.[0]?.id ? String(data[0].id) : null;
  }
  if (existingId) {
    return {
      routedTo: `project_shareholder_meetings:${existingId}`,
      message: "開催履歴はすでに追加済み",
      row: { id: existingId, already_existed: true },
    };
  }

  const { data, error } = await db
    .from("project_shareholder_meetings")
    .insert(row)
    .select("id, project_id, meeting_type, meeting_date, agenda_summary")
    .single();
  if (error) return { error: `開催履歴の追加に失敗: ${error.message}` };
  const id = String(data?.id || "");
  return {
    routedTo: id ? `project_shareholder_meetings:${id}` : "project_shareholder_meetings",
    message: "会社概要の総会・取締役会に開催履歴を1件追加した",
    row: data,
  };
}

function limitedText(value: unknown, max: number): string {
  return textValue(value).replace(/\s+/g, " ").trim().slice(0, max);
}

function normalizeGovernanceMeetingType(value: string): string {
  const raw = value.trim().toLowerCase();
  if (["agm", "annual", "annual_general_meeting", "定時株主総会"].includes(raw)) return "agm";
  if (["egm", "extraordinary", "extraordinary_general_meeting", "臨時株主総会"].includes(raw)) return "egm";
  if (["board_written", "board_written_resolution", "取締役書面決議", "取締役会書面決議"].includes(raw)) return "board_written_resolution";
  if (["shareholder_written", "shareholder_written_resolution", "株主書面決議", "株主総会書面決議"].includes(raw)) return "shareholder_written_resolution";
  return "board";
}

function sanitizeGovernanceResolutions(value: unknown): Array<Record<string, string>> {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 50).flatMap((entry) => {
    if (typeof entry === "string") {
      const title = limitedText(entry, 500);
      return title ? [{ title }] : [];
    }
    const item = objectValue(entry);
    const title = limitedText(item.title ?? item.resolution ?? item.summary, 500);
    if (!title) return [];
    const status = limitedText(item.status, 80);
    return [{ title, ...(status ? { status } : {}) }];
  });
}

function sanitizeGovernanceAttachments(value: unknown): Array<Record<string, string | number>> {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 20).flatMap((entry) => {
    const item = objectValue(entry);
    const name = limitedText(item.name ?? item.filename, 240);
    if (!name) return [];
    const mimeType = limitedText(item.mime_type ?? item.mimeType, 120);
    const kind = limitedText(item.kind, 80);
    const size = Number(item.size_bytes ?? item.size);
    return [{
      name,
      ...(mimeType ? { mime_type: mimeType } : {}),
      ...(kind ? { kind } : {}),
      ...(Number.isFinite(size) && size >= 0 ? { size_bytes: Math.floor(size) } : {}),
    }];
  });
}

function sanitizeImportantDocumentLineage(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 50).flatMap((entry) => {
    const item = objectValue(entry);
    const fileId = limitedText(item.file_id, 300);
    if (!fileId) return [];
    const parents = Array.isArray(item.parent_folders)
      ? item.parent_folders.slice(0, 20).map((parent) => limitedText(parent, 300)).filter(Boolean)
      : [];
    const extractionMethod = ["native_text", "pdf_text", "ocr", "unavailable"].includes(textValue(item.extraction_method))
      ? textValue(item.extraction_method)
      : "unavailable";
    const extractionStatus = ["available", "partial", "missing"].includes(textValue(item.extraction_status))
      ? textValue(item.extraction_status)
      : "missing";
    return [{
      file_id: fileId,
      parent_folders: parents,
      created_at: limitedText(item.created_at, 80) || null,
      modified_at: limitedText(item.modified_at, 80) || null,
      extraction_method: extractionMethod,
      extraction_status: extractionStatus,
    }];
  });
}

function sanitizeImportantDocumentFacts(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  const temporalClasses = new Set([
    "monthly_actual",
    "period_end_balance",
    "annual_cumulative",
    "financing_cash_flow",
    "grant_deposit",
    "grant_commitment_cap",
  ]);
  const valueStatuses = new Set(["observed", "calculated", "partial", "missing"]);
  const factStatuses = new Set(["reported", "received_on_account", "conditional_cap", "missing"]);
  return value.slice(0, 100).flatMap((entry) => {
    const item = objectValue(entry);
    const factKey = limitedText(item.fact_key, 160);
    const temporalClass = textValue(item.temporal_class);
    const valueStatus = textValue(item.value_status);
    const factStatus = textValue(item.status);
    if (!factKey || !temporalClasses.has(temporalClass) || !valueStatuses.has(valueStatus) || !factStatuses.has(factStatus)) return [];
    const rawValue = item.value_yen;
    const amount = rawValue === null || rawValue === undefined ? null : Number(rawValue);
    if (amount !== null && !Number.isFinite(amount)) return [];
    const provenance = objectValue(item.provenance);
    const provenanceFileId = limitedText(provenance.file_id, 300);
    const provenanceHash = textValue(provenance.content_sha256).toLowerCase();
    const evidenceHash = textValue(provenance.evidence_sha256).toLowerCase();
    const pageValue = Number(provenance.page);
    const cleanProvenance = provenanceFileId && /^[0-9a-f]{64}$/.test(provenanceHash) && /^[0-9a-f]{64}$/.test(evidenceHash)
      ? {
          file_id: provenanceFileId,
          content_sha256: provenanceHash,
          section: limitedText(provenance.section, 200),
          page: Number.isInteger(pageValue) && pageValue > 0 ? pageValue : null,
          evidence_text: limitedText(provenance.evidence_text, 220),
          evidence_sha256: evidenceHash,
          extraction_method: ["native_text", "pdf_text", "ocr"].includes(textValue(provenance.extraction_method))
            ? textValue(provenance.extraction_method)
            : "unavailable",
          observation_kind: "document",
        }
      : null;
    if (valueStatus === "observed" && !cleanProvenance) return [];
    return [{
      fact_key: factKey,
      label: limitedText(item.label, 200),
      value_yen: amount,
      value_status: valueStatus,
      temporal_class: temporalClass,
      period_start: ymdValue(item.period_start),
      period_end: ymdValue(item.period_end),
      as_of_date: ymdValue(item.as_of_date),
      due_at: ymdValue(item.due_at),
      due_precision: ["day", "month", "fiscal_year", "none"].includes(textValue(item.due_precision))
        ? textValue(item.due_precision)
        : "none",
      status: factStatus,
      accounting_treatment: limitedText(item.accounting_treatment, 500),
      include_in_revenue: item.include_in_revenue === true,
      include_in_company_value: item.include_in_company_value === true,
      provenance: cleanProvenance,
    }];
  });
}

function sanitizeImportantDocumentBzmCandidates(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 100).flatMap((entry) => {
    const item = objectValue(entry);
    const parameterKey = limitedText(item.parameter_key, 180);
    const sourceFactKey = limitedText(item.source_fact_key, 160);
    const valueStatus = textValue(item.value_status);
    if (!parameterKey || !sourceFactKey || !["observed", "calculated", "missing"].includes(valueStatus)) return [];
    const rawValue = item.value;
    const amount = rawValue === null || rawValue === undefined ? null : Number(rawValue);
    if (amount !== null && !Number.isFinite(amount)) return [];
    return [{
      parameter_key: parameterKey,
      value: amount,
      unit: "JPY",
      value_status: valueStatus,
      information_date: ymdValue(item.information_date),
      temporal_scope: limitedText(item.temporal_scope, 120),
      use_rule: limitedText(item.use_rule, 500),
      source_fact_key: sourceFactKey,
      review_status: "candidate",
    }];
  });
}

function buildStrategySignalFromCoverageGap(
  gap: CoverageGapRow,
  opts: { projectId: string; createdBy: string | null; feedbackText: string; now: string }
): Record<string, unknown> {
  const evidence = objectValue(gap.evidence_refs_json);
  const sourceTitle = cleanOneLine(textValue(evidence.title) || stripCoverageGapTitle(gap.title) || "Coverage gap");
  const rawSignal = extractBetween(gap.summary || "", "raw transcriptには", "が出ているが")
    || extractBetween(gap.summary || "", "Notion文字起こしには", "が出ているが")
    || cleanOneLine(gap.summary || "");
  const missingContext = extractBetween(gap.summary || "", "H-1保存結果では", "可能性がある")
    || extractBetween(gap.summary || "", "H-1保存結果は", "。")
    || "H-1要約では薄くなった重要文脈";
  const signalTitleCore = rawSignal
    ? `${sourceTitle}: ${truncateText(rawSignal, 92)}`
    : `${sourceTitle}: H-1 reviewer が拾った経営ハイライト`;
  const signalTitle = truncateText(signalTitleCore, 180);
  const signalDate = ymdValue(evidence.meeting_date)
    || ymdValue(gap.due_at)
    || ymdValue(gap.detected_at)
    || ymdValue(opts.now);
  const ym = signalDate ? signalDate.slice(0, 7).replace("-", "") : null;
  const sourceRefs = [{
    kind: "coverage_gap",
    gap_id: gap.gap_id,
    source: gap.source,
    source_ref: gap.source_ref,
    source_hash: gap.source_hash,
    source_url: textValue(evidence.notion_url) || textValue(evidence.source_url) || null,
    meeting_id: textValue(evidence.meeting_id) || textValue(evidence.calendar_event_id) || null,
    snippet: truncateText(rawSignal || gap.summary || "", 260),
  }];
  const summaryParts = [
    `${sourceTitle}で、${rawSignal || "H-1要約から漏れた可能性がある重要文脈"} が確認された。`,
    `H-1 reviewer では「${truncateText(cleanOneLine(missingContext), 160)}」として検知され、Coverage Scanner の承認によりD-6経営ハイライトへ自動昇格した。`,
    opts.feedbackText ? `承認コメント: ${truncateText(cleanOneLine(opts.feedbackText), 220)}` : "",
  ].filter(Boolean);
  const salience = numberValue(gap.salience_score, 0.6);

  return {
    project_id: opts.projectId,
    ym,
    signal_date: signalDate,
    signal_type: inferStrategySignalType(`${gap.title || ""}\n${gap.summary || ""}`),
    title: signalTitle,
    summary: truncateText(summaryParts.join("\n"), 1200),
    impact_level: salience >= 0.75 ? "high" : "medium",
    decision_state: "observed",
    status: "confirmed",
    source_refs_json: sourceRefs,
    source_hash: `coverage-gap:${gap.source_hash || gap.gap_id}`,
    confidence: Math.max(0.5, Math.min(0.95, salience)),
    extraction_run_id: gap.gap_id,
    created_by: opts.createdBy || "notification_feedback",
    confirmed_by: opts.createdBy || "notification_feedback",
    confirmed_at: opts.now,
    updated_at: opts.now,
    polarity: inferStrategySignalPolarity(`${gap.title || ""}\n${gap.summary || ""}`),
    score_impact_summary: "H-1で薄まった経営判断をD-6へ自動昇格",
    signal_scope: "project",
    applies_to_company_score: false,
    scope_reason: "Coverage Scanner のH-1 reviewer由来。まずPJ内の経営ハイライトとして反映し、会社スコア対象化は別途D-6/Management Score側で判断する。",
  };
}

function normalizeCoverageTarget(value: string | null): string {
  const v = String(value || "").trim().toLowerCase();
  if (["strategy_signal", "project_strategy_signal", "d-6", "d6"].includes(v)) return "strategy_signal";
  if (["action_item", "action_items", "governance_action_item"].includes(v)) return "action_item";
  if (["shareholder_meeting", "governance", "project_shareholder_meeting"].includes(v)) return "shareholder_meeting";
  if (["important_document", "project_important_document", "formal_document"].includes(v)) return "important_document";
  return v;
}

function inferStrategySignalType(text: string): string {
  if (/リスク|訴訟|督促|解約|破綻|資金繰り|期限超過/.test(text)) return "risk";
  if (/VC前提|前提|方針|判断|転換|ピボット|破れ/.test(text)) return "strategic_pivot";
  if (/契約|商談|PoC|PR|顧客|売上|共同開発|サンプル/.test(text)) return "commercial_progress";
  if (/提携|協業|パートナー/.test(text)) return "partnership";
  if (/資金調達|投資|VC|株式|ラウンド/.test(text)) return "funding";
  return "business_progress";
}

function inferStrategySignalPolarity(text: string): string {
  if (/リスク|訴訟|督促|解約|破綻|資金繰り|期限超過/.test(text)) return "risk";
  if (/前提|方針|判断|転換|ピボット|破れ/.test(text)) return "pivot";
  if (/採択|受賞|契約|PoC|PR|共同開発|資金調達|投資/.test(text)) return "forward";
  return "forward";
}

function numberValue(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function cleanOneLine(value: string): string {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function truncateText(value: string, max: number): string {
  const text = cleanOneLine(value);
  return text.length > max ? `${text.slice(0, Math.max(0, max - 1))}…` : text;
}

function extractBetween(value: string, start: string, end: string): string {
  const source = String(value || "");
  const i = source.indexOf(start);
  if (i < 0) return "";
  const from = i + start.length;
  const j = source.indexOf(end, from);
  if (j < 0) return "";
  return cleanOneLine(source.slice(from, j));
}

function stripCoverageGapTitle(value: string | null): string {
  return cleanOneLine(String(value || "")
    .replace(/^H-1要約で/, "")
    .replace(/^未OS化の可能性:\s*/, "")
    .replace(/が薄まった可能性/g, "")
    .replace(/が議事録なしになった可能性/g, ""));
}

function ymdValue(value: unknown): string | null {
  const text = textValue(value);
  const match = text.match(/20\d{2}-\d{2}-\d{2}/);
  return match ? match[0] : null;
}

/**
 * MTGサマリ通知の「はい・反映」承認。
 *
 * MTGサマリは通知に出る時点で既に Notion 議事録から抽出され、`project_meeting_summaries` /
 * `meeting_notifications` に確定保存されている (= 通知が立つ = 抽出完了)。よって通知の「はい」は
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

  if (args.l2Kind === "news_mention") {
    return updateMediaMentionReviewStatus({
      supabase: args.supabase,
      scopeKey: args.scopeKey,
      reviewStatus: "rejected",
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

  if (args.l2Kind === "action_item") {
    return updateActionItemReviewStatus({
      supabase: args.supabase,
      actionId: args.scopeKey,
      reviewStatus: "rejected",
      feedbackText: args.feedbackText,
      createdBy: args.createdBy,
    });
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

async function updateActionItemReviewStatus(args: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  actionId: string;
  reviewStatus: "confirmed" | "rejected";
  feedbackText: string;
  createdBy: string | null;
}): Promise<{ applied: boolean; message: string; row?: unknown }> {
  const now = new Date().toISOString();
  const { data: actionItem, error: actionItemError } = await args.supabase
    .from("action_items")
    .select("action_id, project_id, title, status, review_status, metadata_json")
    .eq("action_id", args.actionId)
    .maybeSingle();
  if (actionItemError) return { applied: false, message: actionItemError.message };
  if (!actionItem) return { applied: false, message: `action_item not found: ${args.actionId}` };

  const meta = actionItem.metadata_json && typeof actionItem.metadata_json === "object" && !Array.isArray(actionItem.metadata_json)
    ? actionItem.metadata_json as Record<string, unknown>
    : {};
  const isContractAction = meta.category === "contract" || /契約|DocuSign/i.test(String(actionItem.title));
  if (isContractAction) {
    const contractId = String(meta.contract_id ?? "").trim();
    const nextStatus = String(meta.contract_status_after ?? "").trim();
    const allowedStatuses = new Set(["planned", "drafting", "under_review", "awaiting_signature", "signed", "stalled", "cancelled"]);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(contractId) || !allowedStatuses.has(nextStatus)) {
      return { applied: false, message: "契約を特定できないため契約台帳は更新しない" };
    }
    // The route has already verified the acting admin. Contracts have their
    // own RLS boundary, so make this canonical transition with the server-side
    // client instead of leaving an accepted decision as feedback-only.
    const contractDb = getServiceClient();
    const { data: contractRows, error: contractError } = await contractDb
      .from("contracts")
      .update({ status: nextStatus, last_activity_at: now, updated_at: now, updated_by: args.createdBy })
      .eq("contract_id", contractId)
      .eq("project_id", actionItem.project_id)
      .select("contract_id, contract_title, status, last_activity_at");
    if (contractError) return { applied: false, message: contractError.message };
    if ((contractRows ?? []).length !== 1) return { applied: false, message: "対象の契約を1件に確定できないため契約台帳は更新しない" };
  }
  const { data, error } = await args.supabase
    .from("action_items")
    .update({
      review_status: args.reviewStatus,
      response_note: args.feedbackText || null,
      responded_at: now,
      updated_at: now,
      updated_by: args.createdBy,
    })
    .eq("action_id", args.actionId)
    .in("review_status", ["candidate", args.reviewStatus])
    .select("action_id, project_id, title, status, review_status");
  if (error) return { applied: false, message: error.message };
  const rows = data ?? [];
  return {
    applied: args.reviewStatus === "confirmed" && rows.length > 0,
    message: `${args.reviewStatus} action_item: ${rows.length}`,
    row: rows,
  };
}

async function updateMediaMentionReviewStatus(args: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  scopeKey: string;
  reviewStatus: "confirmed" | "rejected";
}): Promise<{ applied: boolean; message: string; row?: unknown }> {
  const mentionId = args.scopeKey.startsWith("media:") ? args.scopeKey.slice("media:".length) : args.scopeKey;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(mentionId)) {
    return { applied: false, message: "invalid media mention scope_key" };
  }
  const now = new Date().toISOString();
  const { data, error } = await args.supabase
    .from("project_media_mentions")
    .update({
      verified: args.reviewStatus === "confirmed",
      dismissed: args.reviewStatus === "rejected",
      updated_at: now,
    })
    .eq("id", mentionId)
    .eq("verified", false)
    .eq("dismissed", false)
    .select("id, project_id, title, verified, dismissed");
  if (error) return { applied: false, message: error.message };
  const rows = data ?? [];
  return {
    applied: args.reviewStatus === "confirmed" && rows.length > 0,
    message: `${args.reviewStatus} news_mention: ${rows.length}`,
    row: rows,
  };
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
  const originKind = textValue(meta.origin_kind);
  const isExternalResearch = originKind === "external_research";
  const now = new Date().toISOString();

  if (isExternalResearch && !sourceHash) {
    return { applied: false, message: "external research feedback requires signal_source_hash" };
  }

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
    query = isExternalResearch ? query.eq("origin_kind", "external_research") : query;
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

  // 外部リサーチは通知が指した1件だけを採否する。hash不一致時に同月・同種別へ
  // 広げると、別候補まで一括採用/見送りになるため fallback しない。
  if (isExternalResearch) {
    return { applied: false, message: "external research candidate not found for notification hash" };
  }

  const fallback = await run(false);
  if (fallback.error) return { applied: false, message: fallback.error.message };
  return {
    applied: (fallback.data ?? []).length > 0,
    message: `${args.status} strategy signals: ${(fallback.data ?? []).length}`,
    row: fallback.data,
  };
}

const MANAGEMENT_KNOWLEDGE_CATEGORIES = new Set([
  "commercialization_route",
  "coalition_design",
  "pricing",
  "sales",
  "finance",
  "governance",
  "organization",
  "fundraising",
  "legal",
  "operations",
  "other",
]);
const MANAGEMENT_KNOWLEDGE_MATURITIES = new Set(["raw_note", "hypothesis", "field_tested", "playbook"]);

type TextbookInsightCandidate = {
  candidate_id: string;
  target_id: string;
  scope_key: string;
  title: string;
  body_md: string;
  source_hash: string | null;
  source_tables: unknown;
  metadata_json: unknown;
  confidentiality: string | null;
  insight_type: string | null;
  target_bzm_slug: string | null;
};

function textbookDestinationKind(metadata: Record<string, unknown>): "bzm_textbook" | "management_knowledge" {
  return textValue(metadata.destination_kind) === "management_knowledge"
    ? "management_knowledge"
    : "bzm_textbook";
}

function textList(value: unknown, max = 32): string[] {
  const values = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  return Array.from(new Set(values.map((entry) => textValue(entry)).filter(Boolean))).slice(0, max);
}

function compactText(value: unknown, max: number): string {
  return textValue(value).replace(/\s+/g, " ").slice(0, max).trim();
}

async function findTextbookInsightCandidate(args: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  targetId: string;
  scopeKey: string;
  candidateId: string;
  sourceHash: string;
}): Promise<{ row: TextbookInsightCandidate | null; error: string | null }> {
  const select = "candidate_id, target_id, scope_key, title, body_md, source_hash, source_tables, metadata_json, confidentiality, insight_type, target_bzm_slug";
  let query = args.supabase
    .from("textbook_insight_candidates")
    .select(select)
    .eq("target_id", args.targetId)
    .eq("status", "candidate");
  if (args.candidateId) query = query.eq("candidate_id", args.candidateId);
  else if (args.sourceHash) query = query.eq("source_hash", args.sourceHash);
  else query = query.eq("scope_key", args.scopeKey);
  const { data, error } = await query.order("created_at", { ascending: false }).limit(2);
  if (error) return { row: null, error: error.message };
  if ((data ?? []).length !== 1) {
    return {
      row: null,
      error: (data ?? []).length === 0 ? "textbook insight candidate not found or already answered" : "textbook insight candidate is ambiguous",
    };
  }
  return { row: data![0] as TextbookInsightCandidate, error: null };
}

async function saveManagementKnowledgeFromTextbookCandidate(args: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  candidate: TextbookInsightCandidate;
  feedbackText: string;
  createdBy: string | null;
}): Promise<{ applied: boolean; message: string; row?: unknown }> {
  const metadata = objectValue(args.candidate.metadata_json);
  const sourceRef = `textbook_insight:${args.candidate.candidate_id}`;
  const categoryRaw = textValue(metadata.management_category);
  const maturityRaw = textValue(metadata.management_maturity);
  const category = MANAGEMENT_KNOWLEDGE_CATEGORIES.has(categoryRaw) ? categoryRaw : "operations";
  const maturity = MANAGEMENT_KNOWLEDGE_MATURITIES.has(maturityRaw) ? maturityRaw : "hypothesis";
  const body = textValue(args.candidate.body_md).slice(0, 30000);
  const summary = compactText(body, 2000) || compactText(args.candidate.title, 2000);
  if (!summary) return { applied: false, message: "management knowledge summary is empty" };
  const sourceTables = textList(args.candidate.source_tables, 20);
  const sourceKind = sourceTables.includes("project_meeting_summaries") ? "meeting" : "codex";
  const confidenceRaw = Number(metadata.management_confidence);
  const confidence = Number.isFinite(confidenceRaw) ? Math.max(0, Math.min(1, Math.round(confidenceRaw * 100) / 100)) : 0.5;
  const { data: project, error: projectError } = await args.supabase
    .from("projects")
    .select("project_id")
    .eq("project_id", args.candidate.target_id)
    .maybeSingle();
  if (projectError) return { applied: false, message: projectError.message };

  const { data: existing, error: existingError } = await args.supabase
    .from("management_knowledge_entries")
    .select("id, title")
    .eq("source_ref", sourceRef)
    .eq("title", args.candidate.title)
    .maybeSingle();
  if (existingError) return { applied: false, message: existingError.message };

  let entryRow: { id: string; title: string } | null = existing;
  if (!entryRow) {
    const { data: inserted, error: insertError } = await args.supabase
      .from("management_knowledge_entries")
      .insert({
        project_id: project?.project_id ?? null,
        title: args.candidate.title.slice(0, 220),
        category,
        maturity,
        tags: textList(metadata.management_tags),
        summary,
        body_md: body,
        reusable_when: textValue(metadata.management_reusable_when).slice(0, 2000) || null,
        next_check: textValue(metadata.management_next_check).slice(0, 2000) || null,
        source_kind: sourceKind,
        source_ref: sourceRef,
        source_excerpt: compactText(body, 1800) || null,
        confidence,
        status: "active",
        metadata_json: {
          textbook_candidate_id: args.candidate.candidate_id,
          candidate_source_hash: args.candidate.source_hash,
          destination_kind: "management_knowledge",
          practice_kind: textValue(metadata.practice_kind) || null,
          confidentiality: args.candidate.confidentiality || null,
        },
        created_by: args.createdBy,
        updated_by: args.createdBy,
      })
      .select("id, title")
      .single();
    if (insertError) return { applied: false, message: insertError.message };
    entryRow = inserted;
  }
  if (!entryRow) return { applied: false, message: "management knowledge entry was not returned" };

  const now = new Date().toISOString();
  const { data: updated, error: updateError } = await args.supabase
    .from("textbook_insight_candidates")
    .update({
      status: "applied",
      reviewed_by: args.createdBy,
      review_comment: args.feedbackText || null,
      reviewed_at: now,
      applied_at: now,
      applied_by: args.createdBy,
      updated_at: now,
      metadata_json: {
        ...metadata,
        destination_kind: "management_knowledge",
        management_knowledge_entry_id: entryRow.id,
      },
    })
    .eq("candidate_id", args.candidate.candidate_id)
    .eq("status", "candidate")
    .select("candidate_id, status");
  if (updateError) return { applied: false, message: updateError.message };
  if ((updated ?? []).length !== 1) return { applied: false, message: "management knowledge saved but candidate status was not updated" };
  return { applied: true, message: `saved management knowledge entry: ${entryRow.id}`, row: entryRow };
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
  const notificationMeta = await loadNotificationMetadata(args.supabase, args.notificationId);
  const candidateId = textValue(notificationMeta.candidate_id);
  const sourceHash = textValue(notificationMeta.candidate_source_hash);
  const found = await findTextbookInsightCandidate({
    supabase: args.supabase,
    targetId: args.targetId,
    scopeKey: args.scopeKey,
    candidateId,
    sourceHash,
  });
  if (!found.row || found.error) return { applied: false, message: found.error || "textbook insight candidate not found" };

  const candidateMetadata = objectValue(found.row.metadata_json);
  if (args.status === "approved" && textbookDestinationKind(candidateMetadata) === "management_knowledge") {
    return saveManagementKnowledgeFromTextbookCandidate({
      supabase: args.supabase,
      candidate: found.row,
      feedbackText: args.feedbackText,
      createdBy: args.createdBy,
    });
  }

  const now = new Date().toISOString();
  const { data, error } = await args.supabase
    .from("textbook_insight_candidates")
    .update({
      status: args.status,
      reviewed_by: args.createdBy,
      review_comment: args.feedbackText || null,
      reviewed_at: now,
      updated_at: now,
    })
    .eq("candidate_id", found.row.candidate_id)
    .eq("status", "candidate")
    .select("candidate_id, title, target_bzm_slug, insight_type, metadata_json, confidentiality, bzm_review_required, bzm_review_status, theory_change_scope, status");
  if (error) return { applied: false, message: error.message };
  return {
    applied: (data ?? []).length === 1,
    message: `${args.status} textbook insight candidates: ${(data ?? []).length}`,
    row: data,
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
