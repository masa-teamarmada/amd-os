/**
 * POST /api/notifications/feedback
 *
 * Phase 4 通知に対するまさからの修正依頼を l2_feedbacks に INSERT する。
 * 上流 (GAS 155 / gas/074 / PWA progress-estimator) は
 * 「過去のフィードバック」を LLM プロンプトに含めて再抽出する。
 * 通知に出た候補は「はい」だけで正本反映する。
 * candidate/tentative 系の L2 は yes=active/confirmed、no=rejected/invalid。
 * meeting_summary の「はい」は、反映完了まで同期的に確認する。
 *
 * Body:
 *   {
 *     l2_kind: 'member_knowledge'|'project_knowledge'|'protocols'|'ms_progress'|'meeting_summary'|'project_registry_diff'|'xrl_evidence'|'project_strategy_signal',
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
      "project_registry_diff",
      "xrl_evidence",
      "project_strategy_signal",
      "founding_members",
      "meeting_summary",
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

    if (action === "yes" && l2Kind === "meeting_summary" && !applyResult.applied) {
      return NextResponse.json(
        { error: applyResult.message || "meeting summary re-extraction failed", feedback: data, action, applyResult },
        { status: 502 }
      );
    }

    // ⚡ 即時再抽出を発火 (= 修正依頼を出した瞬間に LLM プロンプトに含めて再抽出)
    // GAS Web App の runFunc を fire-and-forget で叩く。失敗しても feedback INSERT 自体は成功扱い。
    // - meeting_summary: nav_meeting_processOneEvent_(meetingId, projectId) で 1 event 強制再抽出
    // - member_knowledge: nav_member_knowledge_extractOne_(codeName, memberId, {force:true})
    // - project_knowledge / protocols / ms_progress: 当面は次回 cron まで待つ (= 仕組みは動く、即時化は後追い)
    if (!(action === "yes" && l2Kind === "meeting_summary")) {
      void triggerImmediateReExtraction({ l2Kind, targetId, scopeKey, meetingId }).catch((e) => {
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
      .update({ status: "active", updated_at: new Date().toISOString() })
      .eq("status", "candidate");
    query = protocolId ? query.eq("protocol_id", protocolId) : query;
    const { data, error } = await query.select("protocol_id, title, status");
    if (error) return { applied: false, message: error.message };
    return { applied: (data ?? []).length > 0, message: `activated protocols: ${(data ?? []).length}`, row: data };
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

  return { applied: false, message: `no automatic apply handler for ${args.l2Kind}` };
}

async function applyMeetingSummaryFeedback(args: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  targetId: string;
  scopeKey: string;
  meetingId?: string | null;
}): Promise<{ applied: boolean; message: string; row?: unknown }> {
  const meetingId = String(args.meetingId || args.scopeKey || "").trim();
  if (!meetingId) return { applied: false, message: "meeting_id missing" };

  const gasResult = await triggerImmediateReExtraction({
    l2Kind: "meeting_summary",
    targetId: args.targetId,
    scopeKey: args.scopeKey,
    meetingId,
  });
  const result = gasResult?.data?.result;
  if (!gasResult?.ok || !result?.ok) {
    const message = gasResult?.error || result?.message || result?.action || "GAS re-extraction failed";
    return { applied: false, message };
  }

  const summaryShort = typeof result.summaryShort === "string" ? result.summaryShort.trim() : "";
  if (summaryShort) {
    const { data, error } = await args.supabase
      .from("meeting_notifications")
      .update({ summary_short: summaryShort, updated_at: new Date().toISOString() })
      .eq("meeting_id", meetingId)
      .select("meeting_id, summary_short")
      .maybeSingle();
    if (error) {
      return { applied: false, message: `summary regenerated but notification update failed: ${error.message}` };
    }
    return { applied: true, message: `meeting summary regenerated: ${result.action || "updated"}`, row: data };
  }

  return { applied: true, message: `meeting summary regenerated: ${result.action || "updated"}` };
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
 */
async function triggerImmediateReExtraction(args: {
  l2Kind: string;
  targetId: string;
  scopeKey: string;
  meetingId: string | null;
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
