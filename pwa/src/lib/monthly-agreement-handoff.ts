import { createHash } from "node:crypto";
import { hashMonthlyAgreementTerms, projectScopedSnapshot } from "./monthly-work-agreement.ts";
import type { MonthlyWorkAgreementBundle } from "./monthly-work-agreement-types.ts";

export type AgreementNoticeKind = "revision_requested" | "reagreement_requested" | "agreement_completed";
export type AgreementNoticeState = "pending" | "sending" | "sent" | "failed" | "uncertain" | "cancelled" | "needs_attention";
export type AgreementNotice = {
  id: string; kind: AgreementNoticeKind; ym: string; memberId: string; projectId: string;
  recipientMemberId: string; termsHash: string; title: string; text: string; requestId?: string;
};
export type AgreementNoticeRecord = { job: AgreementNotice; state: AgreementNoticeState; attemptedAt?: string; attemptCount?: number; errorCode?: string };
export type AgreementNoticeOutcome = { id: string; state: AgreementNoticeState | "held" | "busy"; errorCode?: string };

const BASE = "https://amd-os-pwa.vercel.app";
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const yen = (n: number) => `${Math.round(n).toLocaleString("ja-JP")}円`;
const month = (ym: string) => `${ym.slice(0, 4)}年${Number(ym.slice(4))}月`;

export function agreementNoticeId(key: string): string {
  const h = createHash("sha256").update(key).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** Only real changes in work/payment produce a new key; reference-table order and cache timestamps do not. */
export function planAgreementNotices(bundle: MonthlyWorkAgreementBundle, kind: AgreementNoticeKind, adminIds: string[], projectIds?: string[], requestIds?: string[]): AgreementNotice[] {
  const jobs: AgreementNotice[] = [];
  if (kind === "revision_requested") {
    for (const request of bundle.revisionRequests) {
      if (request.status !== "open" || (requestIds && !requestIds.includes(request.id))) continue;
      if (projectIds && !projectIds.includes(request.projectId || "__all__")) continue;
      const project = bundle.snapshot.projects.find(p => p.projectId === request.projectId);
      const projectId = request.projectId || "__all__";
      const title = `${bundle.member.codeName}から${month(bundle.ym)}稼働分の修正要望`;
      const text = [esc(title), `対象：${esc(project?.projectName || "月全体")}`, `要望：${esc(request.body)}`, "内容と金額への影響を確認してください。", `<${BASE}/admin/monthly-work-agreements?ym=${bundle.ym}|月初合意の修正要望を開く>`].join("\n");
      for (const recipientMemberId of [...new Set(adminIds)].filter(id => id !== bundle.member.memberId)) {
        const key = [kind, request.id, recipientMemberId].join(":");
        jobs.push({ id: agreementNoticeId(key), kind, ym: bundle.ym, memberId: bundle.member.memberId, projectId, recipientMemberId, termsHash: request.snapshotHash || "", requestId: request.id, title, text });
      }
    }
    return jobs;
  }
  for (const project of bundle.snapshot.projects) {
    if (projectIds && !projectIds.includes(project.projectId)) continue;
    const agreement = bundle.projectAgreements.find(a => a.projectId === project.projectId);
    if (!agreement || !bundle.tableReady || bundle.member.excludeFromPayoutNotice || project.expectedRewardYen == null || project.expectedRewardYen <= 0) continue;
    if (bundle.revisionRequests.some(r => r.status === "open" && (!r.projectId || r.projectId === project.projectId))) continue;
    if (kind === "reagreement_requested" && (agreement.status !== "needs_reagreement" || !agreement.canAgree)) continue;
    if (kind === "agreement_completed" && agreement.status !== "agreed") continue;
    const scoped = projectScopedSnapshot(bundle.snapshot, project.projectId)!;
    const termsHash = hashMonthlyAgreementTerms(scoped);
    const explanation = bundle.expectedRewardChangeExplanations.find(e => e.projectId === project.projectId);
    const manualReason = bundle.amountChangeReasons.find(r => r.projectId === project.projectId)?.reason;
    const reason = manualReason || explanation?.details.join("\n") || "担当する仕事の変更点をOSで確認してください。";
    const before = explanation?.beforeYen;
    const amount = before != null && before !== project.expectedRewardYen
      ? `${yen(before)} → ${yen(project.expectedRewardYen)}（税抜、差額${project.expectedRewardYen > before ? "+" : ""}${yen(project.expectedRewardYen - before)}）`
      : `${yen(project.expectedRewardYen)}（税抜）`;
    const title = `${project.projectName} ${month(bundle.ym)}稼働分：${kind === "reagreement_requested" ? "条件変更・再合意のお願い" : `${bundle.member.codeName}の合意が完了`}`;
    const link = kind === "reagreement_requested"
      ? `${BASE}/monthly-agreement?ym=${bundle.ym}&memberId=${encodeURIComponent(bundle.member.memberId)}&projectId=${encodeURIComponent(project.projectId)}`
      : `${BASE}/admin/payouts?ym=${project.paymentYm || bundle.ym}`;
    const text = kind === "reagreement_requested"
      ? [esc(title), `合意する額：${amount}`, ...(project.paymentYm ? [`支払予定月：${month(project.paymentYm)}`] : []), `変更理由：${esc(reason)}`, "内容を確認して「合意する」を押してください。", `<${link}|OSで変更内容を確認して再合意する>`].join("\n")
      : [esc(title), `合意した額：${yen(project.expectedRewardYen)}（税抜）`, ...(project.paymentYm ? [`支払予定月：${month(project.paymentYm)}`] : []), "本人の合意が保存されました。支払通知書ページで入金状況と発行条件を確認してください。", `<${link}|支払通知書を確認する>`].join("\n");
    const recipients = kind === "reagreement_requested" ? [bundle.member.memberId] : [...new Set(adminIds)].filter(id => id !== bundle.member.memberId);
    for (const recipientMemberId of recipients) {
      const key = [kind, bundle.ym, bundle.member.memberId, project.projectId, termsHash, recipientMemberId].join(":");
      jobs.push({ id: agreementNoticeId(key), kind, ym: bundle.ym, memberId: bundle.member.memberId, projectId: project.projectId, recipientMemberId, termsHash, title, text });
    }
  }
  return jobs;
}

export interface AgreementNoticeLedger {
  claim(job: AgreementNotice, now: string): Promise<AgreementNoticeState | "claimed" | "busy">;
  finish(job: AgreementNotice, state: AgreementNoticeState, detail: { errorCode?: string; channel?: string; messageTs?: string }): Promise<void>;
}

/** No retries after an ambiguous network result; a human must inspect Slack before deciding to resend. */
export async function deliverAgreementNotice(job: AgreementNotice, input: {
  enabled: boolean; ledger: AgreementNoticeLedger; now?: string;
  send: (job: AgreementNotice) => Promise<{ ok: boolean; channel?: string; messageTs?: string; errorCode?: string }>;
}): Promise<AgreementNoticeOutcome> {
  if (!input.enabled) return { id: job.id, state: "held" };
  const claimed = await input.ledger.claim(job, input.now || new Date().toISOString());
  if (claimed !== "claimed") return { id: job.id, state: claimed };
  let result: Awaited<ReturnType<typeof input.send>>;
  try { result = await input.send(job); }
  catch {
    await input.ledger.finish(job, "uncertain", { errorCode: "delivery_confirmation_required" });
    return { id: job.id, state: "uncertain", errorCode: "delivery_confirmation_required" };
  }
  const state = result.ok ? "sent" : "failed";
  // If Slack accepted the message but acknowledgement storage fails, leave sending and never post again automatically.
  await input.ledger.finish(job, state, result);
  return { id: job.id, state, ...(result.errorCode ? { errorCode: result.errorCode } : {}) };
}
