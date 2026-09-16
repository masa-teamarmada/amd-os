import crypto from "crypto";
import { NextRequest, NextResponse, after } from "next/server";
import { WebClient } from "@slack/web-api";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  applyReimbursementDecision,
  type ReimbursementDecisionAction,
} from "@/lib/reimbursement-decision";
import { confirmPaymentGroup, verifyPaymentConfirmationToken } from "@/lib/payment-confirmation";
import { decideWorkspaceAccessRequest } from "@/lib/workspace-access-request-decision";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Slack の Interactivity (Block Kit ボタン) 受け口。
 *
 * 経緯: 旧経路は Slack → Cloud Run → GAS `doPost` → Cache キュー → 1 分トリガーの
 * `slackInteractiveWorker` → PWA API、という 3 ホップだった。GAS は結局 PWA の API を
 * 叩くだけの中継役で、1 分トリガーぶんの遅延と障害点を足しているだけだったため、
 * Slack から直接ここへ届かせて処理も PWA 内で完結させる (2026-08-13)。
 *
 * 旧経路の GAS コード (`gas/80_SlackWebhook.js` / `gas/081_SlackInteractive.js`) は
 * 切り戻し用に残してある。Slack アプリの Interactivity Request URL を Cloud Run に
 * 戻せば旧経路へ復帰できる。
 *
 * Slack は 3 秒以内の応答を要求するので、検証だけして即 200 を返し、
 * 本処理は `after()` で走らせて結果をスレッド返信する。
 */

const REIMBURSEMENT_ACTIONS = new Set<string>([
  "reimb_approve",
  "reimb_reject",
  "reimb_admin_approve",
  "reimb_admin_reject",
]);

const WORKSPACE_ACCESS_ACTIONS = new Set<string>([
  "workspace_access_approve",
  "workspace_access_reject",
]);

const DECISION_LABELS: Record<string, string> = {
  reimb_approve: "✅ PM承認済み（admin待ち）",
  reimb_reject: "❌ PM差戻し",
  reimb_admin_approve: "✅ admin承認済み",
  reimb_admin_reject: "❌ admin却下",
};

/** 同一インスタンス内での連打吸収。状態遷移側でも二重反映は防いでいる (保険)。 */
const recentClicks = new Map<string, number>();
const DEDUPE_WINDOW_MS = 30_000;

function isDuplicate(key: string): boolean {
  const now = Date.now();
  for (const [k, at] of recentClicks) {
    if (now - at > DEDUPE_WINDOW_MS) recentClicks.delete(k);
  }
  if (recentClicks.has(key)) return true;
  recentClicks.set(key, now);
  return false;
}

/**
 * 署名検証に使う secret 一覧。
 *
 * ボタンを押したときの payload は「そのメッセージを投稿したアプリ」の signing secret で
 * 署名される。AMD OS では立替カードを「つくよみ」アプリが、他の通知を「えいみ」アプリが
 * 投稿しており、両方の Interactivity をこの受け口へ向けているため、secret は複数持てる
 * ようにしてある。`SLACK_SIGNING_SECRET` にカンマ区切りで並べる (2026-08-21)。
 */
function signingSecrets(): string[] {
  return (process.env.SLACK_SIGNING_SECRET || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Slack の署名検証。secret 未設定なら常に不許可 (無防備な受け口を作らない)。 */
function verifySlackSignature(raw: string, signature: string, timestamp: string): boolean {
  const secrets = signingSecrets();
  if (secrets.length === 0 || !signature || !timestamp) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(Date.now() / 1000 - ts) > 60 * 5) return false;

  const given = Buffer.from(signature);
  return secrets.some((secret) => {
    const expected = Buffer.from(
      `v0=${crypto.createHmac("sha256", secret).update(`v0:${timestamp}:${raw}`).digest("hex")}`
    );
    return expected.length === given.length && crypto.timingSafeEqual(expected, given);
  });
}

function slackClient(): WebClient | null {
  const token = process.env.SLACK_BOT_TOKEN;
  return token ? new WebClient(token) : null;
}

/** Slack user id → メール。members.slack_id を正本にし、無ければ Slack プロフィールで補う。 */
async function resolveEmail(
  db: ReturnType<typeof createAdminClient>,
  client: WebClient | null,
  slackUserId: string,
): Promise<string> {
  if (!slackUserId) return "";

  const { data } = await db
    .from("members")
    .select("email")
    .eq("slack_id", slackUserId)
    .maybeSingle();
  const fromDb = String(data?.email ?? "").trim().toLowerCase();
  if (fromDb) return fromDb;

  if (!client) return "";
  try {
    const info = await client.users.info({ user: slackUserId });
    return String(info.user?.profile?.email ?? "").trim().toLowerCase();
  } catch {
    return "";
  }
}

async function resolveMember(
  db: ReturnType<typeof createAdminClient>,
  client: WebClient | null,
  slackUserId: string,
): Promise<{ memberId: string; email: string } | null> {
  if (!slackUserId) return null;
  const { data } = await db
    .from("members")
    .select("member_id,email,status")
    .eq("slack_id", slackUserId)
    .eq("status", "active")
    .maybeSingle();
  if (data?.member_id) {
    return { memberId: String(data.member_id), email: String(data.email ?? "").trim().toLowerCase() };
  }
  const email = await resolveEmail(db, client, slackUserId);
  if (!email) return null;
  const { data: byEmail } = await db
    .from("members")
    .select("member_id,email,status")
    .eq("email", email)
    .eq("status", "active")
    .maybeSingle();
  return byEmail?.member_id
    ? { memberId: String(byEmail.member_id), email: String(byEmail.email ?? email).trim().toLowerCase() }
    : null;
}

async function replyInThread(
  client: WebClient | null,
  channel: string,
  threadTs: string,
  text: string,
) {
  if (!client || !channel || !threadTs) return;
  try {
    await client.chat.postMessage({ channel, thread_ts: threadTs, text });
  } catch {
    // 通知の失敗で反映結果を巻き戻さない。
  }
}

type SlackAction = { action_id?: string; value?: string };
type SlackPayload = {
  type?: string;
  actions?: SlackAction[];
  user?: { id?: string };
  channel?: { id?: string };
  message?: { ts?: string };
};

async function handleReimbursement(
  client: WebClient | null,
  payload: SlackPayload,
  actionId: string,
  actionValue: string,
) {
  const channel = String(payload.channel?.id ?? "");
  const threadTs = String(payload.message?.ts ?? "");

  let parsed: { reimbursementId?: string } = {};
  try {
    parsed = actionValue ? JSON.parse(actionValue) : {};
  } catch {
    parsed = {};
  }
  const reimbursementId = String(parsed.reimbursementId ?? "").trim();
  if (!reimbursementId) {
    await replyInThread(client, channel, threadTs, "⚠️ 立替IDが取れなかった。OSから承認してください");
    return;
  }

  const db = createAdminClient();
  const approverEmail = await resolveEmail(db, client, String(payload.user?.id ?? ""));

  try {
    const result = await applyReimbursementDecision(db, {
      reimbursementId,
      action: actionId as ReimbursementDecisionAction,
      approverEmail,
    });
    const label = DECISION_LABELS[actionId] ?? "✅ 反映済み";
    await replyInThread(
      client,
      channel,
      threadTs,
      `${label}（${result.projectName} / ${reimbursementId} / by ${approverEmail || "unknown"}）`,
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await replyInThread(client, channel, threadTs, `⚠️ 反映できなかった（${reimbursementId}）\n${message}`);
  }
}

async function handlePaymentConfirm(
  client: WebClient | null,
  payload: SlackPayload,
  actionValue: string,
) {
  const channel = String(payload.channel?.id ?? "");
  const threadTs = String(payload.message?.ts ?? "");

  let parsed: { token?: string } = {};
  try {
    parsed = actionValue ? JSON.parse(actionValue) : {};
  } catch {
    parsed = {};
  }
  const token = String(parsed.token ?? "").trim();
  if (!token) {
    await replyInThread(client, channel, threadTs, "⚠️ 入金確認のトークンが取れなかった");
    return;
  }

  try {
    const tokenPayload = verifyPaymentConfirmationToken(token);
    const result = await confirmPaymentGroup(createAdminClient(), tokenPayload, {
      amountYen: tokenPayload.expectedAmountYen,
      source: "slack_expected",
      actor: tokenPayload.recipientSlackId
        ? `slack:${tokenPayload.recipientSlackId}`
        : "slack:payment-confirm",
      note: "Slack button: expected amount received",
    });
    await replyInThread(
      client,
      channel,
      threadTs,
      `✅ 入金を記録した（${tokenPayload.projectId} / ${tokenPayload.invoiceYm} / 反映 ${result.updated}件 / 記録済み ${result.alreadyConfirmed}件）`,
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await replyInThread(client, channel, threadTs, `⚠️ 入金の記録に失敗した\n${message}`);
  }
}

async function handleWorkspaceAccessDecision(
  client: WebClient | null,
  payload: SlackPayload,
  actionId: string,
  actionValue: string,
) {
  const channel = String(payload.channel?.id ?? "");
  const threadTs = String(payload.message?.ts ?? "");
  let parsed: { requestId?: string } = {};
  try {
    parsed = actionValue ? JSON.parse(actionValue) : {};
  } catch {
    parsed = {};
  }
  const requestId = String(parsed.requestId ?? "").trim();
  if (!requestId) {
    await replyInThread(client, channel, threadTs, "⚠️ アクセス要求IDが取れなかった。管理画面から確認して");
    return;
  }

  const db = createAdminClient();
  const actor = await resolveMember(db, client, String(payload.user?.id ?? ""));
  // このDMの決定権は、通知先であるまさ本人だけに限定する。転送や共有画面から
  // 別adminが押しても権限付与しない。
  if (actor?.memberId !== "ID001") {
    await replyInThread(client, channel, threadTs, "⚠️ このアクセス要求をSlackで決められるのは、まさのみ");
    return;
  }

  const decision = actionId === "workspace_access_approve" ? "approved" : "rejected";
  try {
    const result = await decideWorkspaceAccessRequest(db, {
      requestId,
      decision,
      actorMemberId: actor.memberId,
      source: "slack",
    });
    if (result.alreadyDecided) {
      const label = result.status === "approved" ? "許可済み" : "許可しないで確定済み";
      await replyInThread(client, channel, threadTs, `ℹ️ この要求はすでに「${label}」（${result.email}）`);
      return;
    }
    if (result.status === "approved") {
      await replyInThread(
        client,
        channel,
        threadTs,
        `✅ 閲覧を許可した（${result.email} / ${result.workspaceName ?? result.workspaceSlug ?? "ワークスペース"}）\n本人がもう一度ログイン操作すると、ログインリンクが届くよ。`,
      );
    } else {
      await replyInThread(client, channel, threadTs, `⛔ 許可しないで確定した（${result.email}）`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await replyInThread(client, channel, threadTs, `⚠️ 決定を反映できなかった。管理画面で確認して\n${message.slice(0, 240)}`);
  }
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const signature = req.headers.get("x-slack-signature") || "";
  const timestamp = req.headers.get("x-slack-request-timestamp") || "";

  if (!verifySlackSignature(raw, signature, timestamp)) {
    // secret の個数だけ返す (値は出さない)。複数アプリぶんの secret が本番へ
    // 届いているかを、押下テストなしで切り分けるための診断。
    return new NextResponse(`invalid signature (secrets=${signingSecrets().length})`, {
      status: 401,
    });
  }

  const payloadStr = new URLSearchParams(raw).get("payload") || "";
  if (!payloadStr) return new NextResponse("", { status: 200 });

  let payload: SlackPayload;
  try {
    payload = JSON.parse(payloadStr) as SlackPayload;
  } catch {
    return new NextResponse("", { status: 200 });
  }

  const action = (payload.actions ?? [])[0] ?? {};
  const actionId = String(action.action_id ?? "").trim();
  const actionValue = String(action.value ?? "");
  if (!actionId) return new NextResponse("", { status: 200 });

  const dedupeKey = [
    payload.user?.id ?? "",
    payload.channel?.id ?? "",
    payload.message?.ts ?? "",
    actionId,
  ].join("|");
  if (isDuplicate(dedupeKey)) return new NextResponse("", { status: 200 });

  const client = slackClient();

  if (REIMBURSEMENT_ACTIONS.has(actionId)) {
    after(() => handleReimbursement(client, payload, actionId, actionValue));
  } else if (actionId === "payment_confirm_expected") {
    after(() => handlePaymentConfirm(client, payload, actionValue));
  } else if (WORKSPACE_ACCESS_ACTIONS.has(actionId)) {
    after(() => handleWorkspaceAccessDecision(client, payload, actionId, actionValue));
  }

  // 未知の action_id は黙って 200。リンクボタン等で毎回叩かれるため。
  return new NextResponse("", { status: 200 });
}
