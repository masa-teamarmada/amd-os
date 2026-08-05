/**
 * 立替精算の Slack nudge。
 *
 * 経緯: 旧実装は GAS 側 (`gas/ReimburseApi.js` の REIMBURSE_NOTIFY_QUEUE_JSON ワーカー) にあり、
 * スプレッドシート `DB_Reimbursements` への書き込みを起点にしていた。
 * PWA は Supabase `reimbursements` へ直接書くようになったため、その起点が消えて通知が一度も飛ばなくなっていた。
 * ここが現行の正本 = PWA の申請 API から admin へ DM する。
 *
 * 送信失敗は申請の成否に影響させない (呼び出し側で warning 扱い)。
 */

import { WebClient } from "@slack/web-api";
import type { createAdminClient } from "@/lib/supabase/admin";

const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_BASE_URL || "https://amd-os-pwa.vercel.app";

const CATEGORY_LABELS: Record<string, string> = {
  transport: "交通費",
  lodging: "宿泊",
  supplies: "消耗品",
  meal: "会議費",
  other: "その他",
};

export type ReimbursementNotifyResult = {
  sent: number;
  targets: number;
  error: string | null;
};

function fmtYen(value: number) {
  return `¥${Math.round(value).toLocaleString("ja-JP")}`;
}

/**
 * 申請が submitted で入ったことを admin へ DM する。
 * 申請者本人が admin の場合は自分宛てを除く。
 */
export async function notifyAdminsOnReimbursementSubmitted(
  db: ReturnType<typeof createAdminClient>,
  input: {
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
  }
): Promise<ReimbursementNotifyResult> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return { sent: 0, targets: 0, error: "SLACK_BOT_TOKEN 未設定" };

  try {
    const { data, error } = await db
      .from("members")
      .select("member_id, code_name, email, slack_id")
      .eq("is_admin", true)
      .eq("status", "active")
      .not("slack_id", "is", null);
    if (error) throw error;

    const applicantEmail = input.createdBy.toLowerCase();
    const targets = (data ?? []).filter(
      (member) => member.slack_id && String(member.email ?? "").toLowerCase() !== applicantEmail
    );
    if (targets.length === 0) return { sent: 0, targets: 0, error: null };

    const applicantName = await resolveApplicantName(db, applicantEmail);
    const categoryLabel = CATEGORY_LABELS[input.category] ?? input.category;
    const text = `立替申請: ${input.projectName} / ${applicantName} / ${fmtYen(input.amount)}`;
    const lines = [
      `*立替の承認依頼* — ${input.projectName}`,
      `申請者: ${applicantName}`,
      `発生日: ${input.date} / ${categoryLabel} / *${fmtYen(input.amount)}*`,
      `摘要: ${input.description || "-"}`,
      `領収書: ${input.receiptCount > 0 ? `${input.receiptCount}件` : "添付なし"}`,
    ];
    if (input.driveLink) lines.push(`共有ドライブ: ${input.driveLink}`);

    const blocks = [
      { type: "section", text: { type: "mrkdwn", text: lines.join("\n") } },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "立替を確認する" },
            style: "primary",
            url: `${APP_BASE_URL}/reimburse`,
          },
        ],
      },
    ];

    const client = new WebClient(token);
    let sent = 0;
    const failures: string[] = [];
    for (const target of targets) {
      try {
        const open = await client.conversations.open({ users: target.slack_id as string });
        const channel = open.channel?.id || (target.slack_id as string);
        await client.chat.postMessage({ channel, text, blocks });
        sent += 1;
      } catch (e) {
        failures.push(`${target.code_name || target.member_id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    return { sent, targets: targets.length, error: failures.length > 0 ? failures.join(" / ") : null };
  } catch (e) {
    return { sent: 0, targets: 0, error: e instanceof Error ? e.message : String(e) };
  }
}

async function resolveApplicantName(db: ReturnType<typeof createAdminClient>, email: string) {
  const { data } = await db.from("members").select("code_name").eq("email", email).maybeSingle();
  return String(data?.code_name ?? "").trim() || email;
}
