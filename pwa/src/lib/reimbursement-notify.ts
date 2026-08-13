/**
 * 立替精算の Slack nudge。
 *
 * 経緯: 旧実装は GAS 側 (`gas/ReimburseApi.js` の REIMBURSE_NOTIFY_QUEUE_JSON ワーカー) にあり、
 * スプレッドシート `DB_Reimbursements` への書き込みを起点にしていた。
 * PWA は Supabase `reimbursements` へ直接書くようになったため、その起点が消えて通知が一度も飛ばなくなっていた。
 * ここが現行の正本 = PWA の申請 API と cron から admin / 申請者へ DM する。
 *
 * 送信タイミング:
 *   1. 申請時 (`POST /api/reimbursements` の mode=create) — admin 全員 + 申請者本人
 *   2. 未承認のまま 24 時間経過するごと (`/api/cron/reimbursement-reminders`) — admin 全員 + 申請者本人
 *
 * 送信失敗は申請の成否に影響させない (呼び出し側で warning 扱い)。
 */

import { WebClient } from "@slack/web-api";
import type { createAdminClient } from "@/lib/supabase/admin";

type Db = ReturnType<typeof createAdminClient>;

const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_BASE_URL || "https://amd-os-pwa.vercel.app";

/** 承認待ちと見なさない (= リマインドを止める) status。 */
const CLOSED_STATUSES = new Set(["approved", "rejected", "paid"]);

/** リマインド間隔。まさ指示 = 24 時間ごと。 */
const REMINDER_INTERVAL_MS = 24 * 60 * 60 * 1000;

const CATEGORY_LABELS: Record<string, string> = {
  transport: "交通費",
  lodging: "宿泊",
  supplies: "消耗品",
  meal: "会議費",
  other: "その他",
};

const STATUS_LABELS: Record<string, string> = {
  submitted: "申請中 (PM 承認待ち)",
  pmApproved: "PM 承認済 (admin 承認待ち)",
  pmapproved: "PM 承認済 (admin 承認待ち)",
};

export type ReimbursementNotifyResult = {
  sent: number;
  targets: number;
  error: string | null;
};

export type ReimbursementSummary = {
  reimbursementId: string;
  projectId: string;
  projectName: string;
  date: string;
  category: string;
  amount: number;
  description: string;
  createdBy: string;
  receiptCount: number;
  driveLink: string | null;
  /** 承認判断に必要な移動区間。交通費以外は null。 */
  transportMode?: string | null;
  transportFrom?: string | null;
  transportTo?: string | null;
  transportTrip?: string | null;
  /** Slack の承認ボタンを出し分けるための現在の状態。 */
  status?: string;
};

const TRANSPORT_MODE_LABELS: Record<string, string> = {
  train: "電車",
  bus: "バス",
  taxi: "タクシー",
  car: "自家用車",
  other: "その他",
};

const TRANSPORT_TRIP_LABELS: Record<string, string> = {
  oneway: "片道",
  round: "往復",
};

const EMPTY_RESULT: ReimbursementNotifyResult = { sent: 0, targets: 0, error: null };

function fmtYen(value: number) {
  return `¥${Math.round(value).toLocaleString("ja-JP")}`;
}

type SlackTarget = { slackId: string; label: string };

/**
 * 申請が submitted で入ったことを admin へ DM する。
 * 申請者本人が admin の場合は自分宛てを除く (本人向けは notifyApplicantOnReimbursementSubmitted)。
 */
export async function notifyAdminsOnReimbursementSubmitted(
  db: Db,
  input: ReimbursementSummary
): Promise<ReimbursementNotifyResult> {
  const client = slackClient();
  if (!client) return { ...EMPTY_RESULT, error: "SLACK_BOT_TOKEN 未設定" };

  try {
    const applicantEmail = input.createdBy.toLowerCase();
    const targets = await loadAdminTargets(db, applicantEmail);
    if (targets.length === 0) return EMPTY_RESULT;

    const applicantName = await resolveMemberName(db, applicantEmail);
    const text = `立替申請: ${input.projectName} / ${applicantName} / ${fmtYen(input.amount)}`;
    const lines = [
      `*立替の承認依頼* — ${input.projectName}`,
      `申請者: ${applicantName}`,
      ...detailLines(input),
    ];
    return await dmMany(client, targets, text, lines, { ...input, status: input.status || "submitted" });
  } catch (e) {
    return { ...EMPTY_RESULT, error: e instanceof Error ? e.message : String(e) };
  }
}

/** 申請を受け付けたことを申請者本人へ DM する。 */
export async function notifyApplicantOnReimbursementSubmitted(
  db: Db,
  input: ReimbursementSummary
): Promise<ReimbursementNotifyResult> {
  const client = slackClient();
  if (!client) return { ...EMPTY_RESULT, error: "SLACK_BOT_TOKEN 未設定" };

  try {
    const applicantEmail = input.createdBy.toLowerCase();
    const target = await loadMemberTarget(db, applicantEmail);
    if (!target) return EMPTY_RESULT;

    const text = `立替申請を受け付けた: ${input.projectName} / ${fmtYen(input.amount)}`;
    const lines = [
      `*立替申請を受け付けたよ* — ${input.projectName}`,
      ...detailLines(input),
      "承認されるまで、admin へは 24 時間ごとにリマインドが飛ぶ。",
    ];
    return await dmMany(client, [target], text, lines);
  } catch (e) {
    return { ...EMPTY_RESULT, error: e instanceof Error ? e.message : String(e) };
  }
}

export type ReminderRunResult = {
  pending: number;
  reminded: number;
  adminSent: number;
  applicantSent: number;
  errors: string[];
};

/**
 * 承認されないまま 24 時間経過した立替を洗い出し、admin と申請者へ再送信する。
 * approved / rejected / paid になった時点で対象から外れる (= 承認されれば自動で止まる)。
 */
export async function sendReimbursementApprovalReminders(db: Db, now = new Date()): Promise<ReminderRunResult> {
  const result: ReminderRunResult = { pending: 0, reminded: 0, adminSent: 0, applicantSent: 0, errors: [] };

  const client = slackClient();
  if (!client) {
    result.errors.push("SLACK_BOT_TOKEN 未設定");
    return result;
  }

  const { data, error } = await db
    .from("reimbursements")
    .select(
      "reimbursement_id, project_id, project_name, date, category, amount, description, status, created_by, created_at, transport_mode, transport_from, transport_to, transport_trip, receipt_storage_paths, receipt_drive_links, reminder_last_sent_at, reminder_sent_count"
    )
    .not("status", "in", `(${[...CLOSED_STATUSES].join(",")})`)
    .order("created_at", { ascending: true });
  if (error) {
    result.errors.push(error.message);
    return result;
  }

  const rows = data ?? [];
  result.pending = rows.length;

  const due = rows.filter((row) => {
    const base = Date.parse(String(row.reminder_last_sent_at || row.created_at || ""));
    if (Number.isNaN(base)) return false;
    return now.getTime() - base >= REMINDER_INTERVAL_MS;
  });
  if (due.length === 0) return result;

  const admins = await loadAdminTargets(db, null);

  for (const row of due) {
    try {
      const applicantEmail = String(row.created_by ?? "").toLowerCase();
      const applicantName = await resolveMemberName(db, applicantEmail);
      const summary: ReimbursementSummary = {
        reimbursementId: String(row.reimbursement_id),
        projectId: String(row.project_id ?? ""),
        projectName: String(row.project_name || row.project_id || ""),
        date: String(row.date ?? ""),
        category: String(row.category ?? ""),
        amount: Number(row.amount ?? 0),
        description: String(row.description ?? ""),
        createdBy: applicantEmail,
        receiptCount: Array.isArray(row.receipt_storage_paths) ? row.receipt_storage_paths.length : 0,
        driveLink: firstLink(row.receipt_drive_links),
        transportMode: row.transport_mode ? String(row.transport_mode) : null,
        transportFrom: row.transport_from ? String(row.transport_from) : null,
        transportTo: row.transport_to ? String(row.transport_to) : null,
        transportTrip: row.transport_trip ? String(row.transport_trip) : null,
        status: String(row.status ?? ""),
      };
      const waitingDays = elapsedDays(String(row.created_at ?? ""), now);
      const statusLabel = STATUS_LABELS[String(row.status ?? "")] ?? String(row.status ?? "");

      // 申請者本人が admin の場合は本人向け DM に寄せる (二重送信を避ける)。
      const applicantTarget = await loadMemberTarget(db, applicantEmail);
      const adminTargets = admins.filter((t) => t.slackId !== applicantTarget?.slackId);
      const adminText = `【未承認】立替申請: ${summary.projectName} / ${applicantName} / ${fmtYen(summary.amount)}`;
      const adminLines = [
        `*立替が ${waitingDays} 日間 未承認のまま* — ${summary.projectName}`,
        `申請者: ${applicantName}`,
        `状態: ${statusLabel}`,
        ...detailLines(summary),
      ];
      const adminResult = await dmMany(client, adminTargets, adminText, adminLines, summary);
      result.adminSent += adminResult.sent;
      if (adminResult.error) result.errors.push(`${summary.reimbursementId} admin: ${adminResult.error}`);

      if (applicantTarget) {
        const applicantText = `立替がまだ承認されてない: ${summary.projectName} / ${fmtYen(summary.amount)}`;
        const applicantLines = [
          `*申請した立替がまだ承認されてないよ* — ${summary.projectName}`,
          `状態: ${statusLabel} / 申請から ${waitingDays} 日`,
          ...detailLines(summary),
          "admin にもリマインドを送った。",
        ];
        const applicantResult = await dmMany(client, [applicantTarget], applicantText, applicantLines);
        result.applicantSent += applicantResult.sent;
        if (applicantResult.error) result.errors.push(`${summary.reimbursementId} applicant: ${applicantResult.error}`);
      }

      const { error: updateError } = await db
        .from("reimbursements")
        .update({
          reminder_last_sent_at: now.toISOString(),
          reminder_sent_count: Number(row.reminder_sent_count ?? 0) + 1,
        })
        .eq("reimbursement_id", row.reimbursement_id);
      if (updateError) result.errors.push(`${summary.reimbursementId} update: ${updateError.message}`);
      result.reminded += 1;
    } catch (e) {
      result.errors.push(`${row.reimbursement_id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return result;
}

function slackClient(): WebClient | null {
  const token = process.env.SLACK_BOT_TOKEN;
  return token ? new WebClient(token) : null;
}

function detailLines(input: ReimbursementSummary): string[] {
  const categoryLabel = CATEGORY_LABELS[input.category] ?? input.category;
  const lines = [
    `発生日: ${input.date} / ${categoryLabel} / *${fmtYen(input.amount)}*`,
    `摘要: ${input.description || "-"}`,
  ];

  if (input.category === "transport" && (input.transportFrom || input.transportTo || input.transportMode)) {
    const detail = [
      input.transportMode ? TRANSPORT_MODE_LABELS[input.transportMode] ?? input.transportMode : null,
      input.transportTrip ? TRANSPORT_TRIP_LABELS[input.transportTrip] ?? input.transportTrip : null,
    ].filter(Boolean).join(" / ");
    const route = `${input.transportFrom || "出発未記入"} → ${input.transportTo || "到着未記入"}`;
    lines.push(`区間: ${route}${detail ? ` (${detail})` : ""}`);
    if (input.transportTrip === "round") {
      lines.push(`内訳: 片道 ${fmtYen(input.amount / 2)} × 2`);
    }
  }

  lines.push(`領収書: ${input.receiptCount > 0 ? `${input.receiptCount}件` : "添付なし"}`);
  if (input.driveLink) lines.push(`共有ドライブ: ${input.driveLink}`);
  return lines;
}

/**
 * Slack の承認ボタン。押下は Slack → `/api/slack/interactive` で直接 Supabase へ反映される
 * (2026-08-13 に Cloud Run → GAS キュー経由から移行)。状態に応じて PM 承認 / admin 承認を出し分ける。
 */
function approvalButtons(input: ReimbursementSummary) {
  const status = String(input.status ?? "submitted");
  const value = JSON.stringify({ reimbursementId: input.reimbursementId });

  const pair = status === "submitted"
    ? { approve: { id: "reimb_approve", label: "PM承認" }, reject: { id: "reimb_reject", label: "差戻し" } }
    : status === "pmApproved" || status === "pmapproved"
      ? { approve: { id: "reimb_admin_approve", label: "admin承認" }, reject: { id: "reimb_admin_reject", label: "却下" } }
      : null;
  if (!pair) return [];

  return [
    { type: "button", action_id: pair.approve.id, text: { type: "plain_text", text: pair.approve.label }, style: "primary", value },
    { type: "button", action_id: pair.reject.id, text: { type: "plain_text", text: pair.reject.label }, style: "danger", value },
  ];
}

function elapsedDays(createdAt: string, now: Date): number {
  const started = Date.parse(createdAt);
  if (Number.isNaN(started)) return 0;
  return Math.max(1, Math.floor((now.getTime() - started) / (24 * 60 * 60 * 1000)));
}

function firstLink(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  const first = value.find((v) => typeof v === "string" && v.trim());
  return first ? String(first) : null;
}

/** admin かつ active かつ slack_id を持つメンバー。excludeEmail は宛先から除く。 */
async function loadAdminTargets(db: Db, excludeEmail: string | null): Promise<SlackTarget[]> {
  const { data, error } = await db
    .from("members")
    .select("member_id, code_name, email, slack_id")
    .eq("is_admin", true)
    .eq("status", "active")
    .not("slack_id", "is", null);
  if (error) throw error;

  return (data ?? [])
    .filter((m) => m.slack_id)
    .filter((m) => !excludeEmail || String(m.email ?? "").toLowerCase() !== excludeEmail)
    .map((m) => ({ slackId: String(m.slack_id), label: String(m.code_name || m.member_id) }));
}

async function loadMemberTarget(db: Db, email: string): Promise<SlackTarget | null> {
  if (!email) return null;
  const { data } = await db
    .from("members")
    .select("member_id, code_name, slack_id")
    .eq("email", email)
    .maybeSingle();
  if (!data?.slack_id) return null;
  return { slackId: String(data.slack_id), label: String(data.code_name || data.member_id) };
}

async function resolveMemberName(db: Db, email: string) {
  const { data } = await db.from("members").select("code_name").eq("email", email).maybeSingle();
  return String(data?.code_name ?? "").trim() || email;
}

async function dmMany(
  client: WebClient,
  targets: SlackTarget[],
  text: string,
  lines: string[],
  /** 承認者向けのときだけ渡す。Slack 上で承認 / 却下まで完結させる。 */
  approvalFor?: ReimbursementSummary
): Promise<ReimbursementNotifyResult> {
  if (targets.length === 0) return EMPTY_RESULT;

  const elements = [
    ...(approvalFor ? approvalButtons(approvalFor) : []),
    {
      type: "button",
      text: { type: "plain_text", text: "OSで見る" },
      url: `${APP_BASE_URL}/reimburse`,
    },
  ];

  const blocks = [
    { type: "section", text: { type: "mrkdwn", text: lines.join("\n") } },
    { type: "actions", elements },
  ];

  let sent = 0;
  const failures: string[] = [];
  for (const target of targets) {
    try {
      const open = await client.conversations.open({ users: target.slackId });
      const channel = open.channel?.id || target.slackId;
      await client.chat.postMessage({ channel, text, blocks });
      sent += 1;
    } catch (e) {
      failures.push(`${target.label}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { sent, targets: targets.length, error: failures.length > 0 ? failures.join(" / ") : null };
}
