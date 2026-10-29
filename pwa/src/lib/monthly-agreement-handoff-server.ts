import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildMonthlyWorkAgreementBundle } from "./monthly-work-agreement.ts";
import type { MonthlyWorkAgreementBundle } from "./monthly-work-agreement-types.ts";
import { deliverAgreementNotice, planAgreementNotices, type AgreementNotice, type AgreementNoticeRecord, type AgreementNoticeState, type AgreementNoticeLedger, type AgreementNoticeOutcome, type AgreementNoticeKind } from "./monthly-agreement-handoff.ts";

const ACTION = "monthly_agreement_handoff";
export const agreementNoticeDeliveryEnabled = () => process.env.AMIE_MONTHLY_AGREEMENT_NOTIFICATIONS_ENABLED === "1";
export type AgreementHandoffTarget = { ym: string; memberId: string; projectIds?: string[]; requestIds?: string[]; kind: AgreementNoticeKind };
type QueueResult = { state: "held" | "queued" | "nothing_to_send" | "failed"; jobs: AgreementNotice[]; errorCode?: string };

/** A release must name every permitted event. No scope, no external delivery. */
export function agreementNoticeScopeAllows(input: Pick<AgreementNotice, "kind" | "ym" | "memberId" | "projectId"> & Partial<Pick<AgreementNotice, "recipientMemberId">>): boolean {
  if (!agreementNoticeDeliveryEnabled()) return false;
  const prefix = [input.kind, input.ym, input.memberId, input.projectId].join(":") + ":";
  const scopes = (process.env.AMIE_MONTHLY_AGREEMENT_NOTIFICATIONS_SCOPE || "").split(",").map(s => s.trim());
  return input.recipientMemberId
    ? scopes.includes(prefix + input.recipientMemberId)
    : scopes.some(scope => scope.startsWith(prefix) && /^ID\d+$/.test(scope.slice(prefix.length)));
}

export async function prepareAgreementHandoff(db: SupabaseClient, target: AgreementHandoffTarget, knownBundle?: MonthlyWorkAgreementBundle): Promise<AgreementNotice[]> {
  if (knownBundle && (knownBundle.ym !== target.ym || knownBundle.member.memberId !== target.memberId)) throw new Error("agreement_handoff_bundle_mismatch");
  const [bundle, admins] = await Promise.all([
    knownBundle || buildMonthlyWorkAgreementBundle(db, { ym: target.ym, memberId: target.memberId, viewerMemberId: target.memberId }),
    db.from("members").select("member_id").eq("is_admin", true).eq("status", "active"),
  ]);
  if (admins.error) throw new Error("agreement_handoff_admin_lookup_failed");
  return planAgreementNotices(bundle, target.kind, (admins.data || []).map(m => String(m.member_id)), target.projectIds, target.requestIds);
}

/** Preview is read-only even if the deployment is enabled. No contacts, financial conditions or agreement rows are changed. */
export async function queueAgreementHandoff(db: SupabaseClient, target: AgreementHandoffTarget, enabled = agreementNoticeDeliveryEnabled(), knownBundle?: MonthlyWorkAgreementBundle): Promise<QueueResult> {
  try {
    const jobs = await prepareAgreementHandoff(db, target, knownBundle);
    if (!enabled) return { state: "held", jobs };
    const scopedJobs = jobs.filter(agreementNoticeScopeAllows);
    if (jobs.length && !scopedJobs.length) return { state: "held", jobs: [] };
    for (const job of scopedJobs) {
      const record: AgreementNoticeRecord = { job, state: "pending" };
      const { error } = await db.from("billing_log").insert({ id: job.id, project_id: job.projectId, ym: job.ym, action: ACTION, actor: "amie_monthly_agreement_handoff", detail: record });
      if (error && error.code !== "23505") throw new Error("agreement_handoff_queue_failed");
    }
    return { state: scopedJobs.length ? "queued" : "nothing_to_send", jobs: scopedJobs };
  } catch { return { state: "failed", jobs: [], errorCode: "agreement_handoff_preparation_failed" }; }
}

/** The feature switch avoids even building a bundle on a deployment where external delivery is held. */
export async function queueAndScheduleAgreementHandoff(
  db: SupabaseClient,
  target: AgreementHandoffTarget,
  schedule: (task: () => Promise<void>) => void,
  knownBundle?: MonthlyWorkAgreementBundle,
): Promise<{ state: QueueResult["state"]; count: number; errorCode?: string }> {
  if (!agreementNoticeDeliveryEnabled()) return { state: "held", count: 0 };
  const scopedProjectIds = target.projectIds?.filter(projectId => agreementNoticeScopeAllows({ ...target, projectId }));
  if (!scopedProjectIds?.length) return { state: "held", count: 0 };
  const queued = await queueAgreementHandoff(db, { ...target, projectIds: scopedProjectIds }, true, knownBundle);
  if (queued.state === "queued" && queued.jobs.length) {
    schedule(async () => { try { await dispatchAgreementHandoffs(db, true, queued.jobs.map(j => j.id)); } catch { /* durable outbox remains for the daily retry */ } });
  }
  return { state: queued.state, count: queued.jobs.length, ...(queued.errorCode ? { errorCode: queued.errorCode } : {}) };
}

export function agreementBillingLogLedger(db: SupabaseClient): AgreementNoticeLedger {
  return {
    async claim(job, now) {
      const { data, error } = await db.from("billing_log").select("detail").eq("id", job.id).eq("action", ACTION).maybeSingle();
      if (error || !data) throw new Error("agreement_handoff_record_missing");
      const previous = data.detail as AgreementNoticeRecord;
      if (previous.state === "sending") {
        const attempted = Date.parse(previous.attemptedAt || "");
        if (!Number.isFinite(attempted) || Date.parse(now) - attempted > 240_000) {
          const { error: expiryError } = await db.from("billing_log").update({ detail: { ...previous, state: "uncertain", errorCode: "acknowledgement_unknown" } }).eq("id", job.id).eq("action", ACTION).eq("detail->>state", "sending");
          if (expiryError) throw new Error("agreement_handoff_expiry_failed");
          return "uncertain";
        }
        return "busy";
      }
      if (!["pending", "failed"].includes(previous.state)) return previous.state;
      if (previous.state === "failed" && (previous.attemptCount || 0) >= 3) {
        const { error: holdError } = await db.from("billing_log").update({ detail: { ...previous, state: "needs_attention", errorCode: "retry_limit_reached" } })
          .eq("id", job.id).eq("action", ACTION).eq("detail->>state", "failed");
        if (holdError) throw new Error("agreement_handoff_retry_hold_failed");
        return "needs_attention";
      }
      const { data: claimed, error: claimError } = await db.from("billing_log").update({ detail: { ...previous, state: "sending", attemptedAt: now, attemptCount: (previous.attemptCount || 0) + 1, errorCode: undefined } })
        .eq("id", job.id).eq("action", ACTION).eq("detail->>state", previous.state).select("id");
      if (claimError) throw new Error("agreement_handoff_claim_failed");
      return claimed?.length ? "claimed" : "busy";
    },
    async finish(job, state, result) {
      const { data, error } = await db.from("billing_log").select("detail").eq("id", job.id).eq("action", ACTION).single();
      if (error) throw new Error("agreement_handoff_ack_read_failed");
      const { data: saved, error: saveError } = await db.from("billing_log").update({ detail: { ...data.detail, state, ...result, ...(state === "sent" ? { sentAt: new Date().toISOString() } : {}) } })
        .eq("id", job.id).eq("action", ACTION).eq("detail->>state", "sending").select("id");
      if (saveError || !saved?.length) throw new Error("agreement_handoff_ack_save_failed");
    },
  };
}

async function sendViaExistingAmieSender(db: SupabaseClient, job: AgreementNotice) {
  const { data: member, error } = await db.from("members").select("member_id,slack_id,status,is_admin").eq("member_id", job.recipientMemberId).maybeSingle();
  if (error || member?.status !== "active" || !/^[UW][A-Z0-9]+$/.test(member.slack_id || "") || (job.kind !== "reagreement_requested" && !member.is_admin)) return { ok: false, errorCode: "recipient_not_available" };
  const base = process.env.NEXT_PUBLIC_GAS_WEBAPP_URL;
  const key = process.env.NEXT_PUBLIC_GAS_API_KEY || process.env.PWA_API_KEY || process.env.CRON_SECRET;
  if (!base || !key) return { ok: false, errorCode: "sender_connection_missing" };
  const url = new URL(base);
  url.searchParams.set("mode", "pwaApi"); url.searchParams.set("key", key); url.searchParams.set("action", "runFunc");
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fn: "slackNotifyPostToChannelTsukuyomi_", args: [member.slack_id, { text: job.text }] }), signal: AbortSignal.timeout(40_000) });
  if (!response.ok) throw new Error("sender_result_unknown");
  const result = await response.json();
  const posted = result?.data?.result;
  if (!result?.ok || !posted) throw new Error("sender_result_unknown");
  if (!posted.ok) return { ok: false, errorCode: "slack_rejected" };
  return { ok: true, channel: String(posted.channel || ""), messageTs: String(posted.ts || "") };
}

/** Retries only existing, bounded outbox rows. It never discovers every member or creates historical notices. */
export async function dispatchAgreementHandoffs(db: SupabaseClient, enabled = agreementNoticeDeliveryEnabled(), onlyIds?: string[]): Promise<AgreementNoticeOutcome[]> {
  if (!enabled) return [];
  let query = db.from("billing_log").select("id,detail").eq("action", ACTION).in("detail->>state", ["pending", "failed", "sending"]).order("created_at").limit(50);
  if (onlyIds) query = query.in("id", onlyIds);
  const { data: rows, error } = await query;
  if (error) throw new Error("agreement_handoff_outbox_read_failed");
  const ledger = agreementBillingLogLedger(db);
  const bundles = new Map<string, Awaited<ReturnType<typeof buildMonthlyWorkAgreementBundle>>>();
  const results: AgreementNoticeOutcome[] = [];
  for (const row of rows || []) {
    const record = row.detail as AgreementNoticeRecord;
    const job = record.job;
    if (!agreementNoticeScopeAllows(job)) continue;
    if (results.length >= 3) break;
    try {
      const cacheKey = `${job.ym}:${job.memberId}`;
      let bundle = bundles.get(cacheKey);
      if (!bundle) { bundle = await buildMonthlyWorkAgreementBundle(db, { ym: job.ym, memberId: job.memberId, viewerMemberId: job.memberId }); bundles.set(cacheKey, bundle); }
      const planned = planAgreementNotices(bundle, job.kind, [job.recipientMemberId], [job.projectId], job.requestId ? [job.requestId] : []);
      const current = planned.find(p => p.id === job.id);
      if (!current && record.state !== "sending") {
        const { error: cancelError } = await db.from("billing_log").update({ detail: { ...record, state: "cancelled", errorCode: "conditions_changed" } }).eq("id", row.id).eq("action", ACTION).eq("detail->>state", record.state);
        if (cancelError) throw new Error("agreement_handoff_cancel_failed");
        results.push({ id: job.id, state: "cancelled", errorCode: "conditions_changed" }); continue;
      }
      results.push(await deliverAgreementNotice(current || job, { enabled, ledger, send: j => sendViaExistingAmieSender(db, j) }));
    } catch { results.push({ id: job.id, state: record.state, errorCode: "handoff_processing_failed" }); }
  }
  return results;
}
