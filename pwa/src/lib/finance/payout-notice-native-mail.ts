import { randomUUID } from "node:crypto";
import { google } from "googleapis";
import { getGoogleAuthAsync } from "../sources/google.ts";

const EXPECTED_FROM = "keiri@team-armada.jp";
const EMAIL_RE = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
const MAX_PDF_BYTES = 10 * 1024 * 1024;

export type PayoutNoticeMailInput = {
  to: string;
  bcc: string[];
  subject: string;
  body: string;
  memberId: string;
  ym: string;
  pdfDriveFileId: string;
};

function encodedHeader(value: string): string {
  if (/[\r\n]/.test(value)) throw new Error("メールの見出しに改行は使えません");
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function base64Lines(data: Buffer): string {
  return data.toString("base64").match(/.{1,76}/g)?.join("\r\n") ?? "";
}

/** 添付・宛先・差出人を固定してMIMEを作る。ここでは送信しない。 */
export function buildPayoutNoticeMime(input: PayoutNoticeMailInput, pdf: Buffer, boundary = `amd-payout-${randomUUID()}`): string {
  if (!EMAIL_RE.test(input.to) || input.bcc.some((email) => !EMAIL_RE.test(email))) {
    throw new Error("支払通知書メールの宛先が不正です");
  }
  if (!/^\d{6}$/.test(input.ym) || !/^[A-Za-z0-9_-]+$/.test(input.memberId)) {
    throw new Error("支払通知書メールの年月またはメンバー番号が不正です");
  }
  if (!input.subject.trim() || !input.body.trim() || pdf.length === 0 || pdf.length > MAX_PDF_BYTES) {
    throw new Error("支払通知書メールの本文または添付PDFが不正です");
  }
  if (/[\r\n]/.test(boundary)) throw new Error("メールの境界文字が不正です");

  const fileName = `支払通知書_${input.ym}_${input.memberId}.pdf`;
  const headers = [
    `From: ${encodedHeader("team ARMADA 経理")} <${EXPECTED_FROM}>`,
    `To: ${input.to}`,
    ...(input.bcc.length ? [`Bcc: ${input.bcc.join(", ")}`] : []),
    `Subject: ${encodedHeader(input.subject.trim())}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
  ];
  const body = input.body.replace(/\r?\n/g, "\r\n");
  return [
    ...headers,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    base64Lines(Buffer.from(body, "utf8")),
    `--${boundary}`,
    'Content-Type: application/pdf; name="payout_notice.pdf"',
    "Content-Transfer-Encoding: base64",
    `Content-Disposition: attachment; filename="payout_notice.pdf"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    "",
    base64Lines(pdf),
    `--${boundary}--`,
    "",
  ].join("\r\n");
}

/** GAS送付経路の置換候補。専用OAuth権限と二重送信防止の接続が揃うまで呼ばない。 */
export async function sendPayoutNoticeMailNative(input: PayoutNoticeMailInput): Promise<{ gmailMessageId: string }> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.PAYOUT_NOTICE_GMAIL_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("支払通知書送付用のGoogle認証がありません");
  }
  const gmailAuth = new google.auth.OAuth2(clientId, clientSecret);
  gmailAuth.setCredentials({ refresh_token: refreshToken });
  const gmail = google.gmail({ version: "v1", auth: gmailAuth });
  const alias = await gmail.users.settings.sendAs.get({ userId: "me", sendAsEmail: EXPECTED_FROM });
  if (alias.data.sendAsEmail?.toLowerCase() !== EXPECTED_FROM || alias.data.verificationStatus !== "accepted") {
    throw new Error("経理アドレスの送信権限を確認できません");
  }

  const driveAuth = await getGoogleAuthAsync();
  if (!driveAuth) throw new Error("支払通知書PDFのDrive読取権限がありません");
  const drive = google.drive({ version: "v3", auth: driveAuth });
  const metadata = await drive.files.get({
    fileId: input.pdfDriveFileId,
    fields: "id,name,mimeType,size,trashed",
    supportsAllDrives: true,
  });
  if (metadata.data.trashed || metadata.data.mimeType !== "application/pdf" ||
      !metadata.data.name?.startsWith(`支払通知書_`) ||
      !metadata.data.name.includes(`_${input.memberId}_${input.ym}`) ||
      Number(metadata.data.size) <= 0 || Number(metadata.data.size) > MAX_PDF_BYTES) {
    throw new Error("送付用PDFの保存内容が支払通知書と一致しません");
  }
  const downloaded = await drive.files.get({ fileId: input.pdfDriveFileId, alt: "media", supportsAllDrives: true }, { responseType: "arraybuffer" });
  const pdf = Buffer.from(downloaded.data as ArrayBuffer);
  if (pdf.length !== Number(metadata.data.size) || pdf.subarray(0, 5).toString("ascii") !== "%PDF-") {
    throw new Error("送付用PDFの読戻しに失敗しました");
  }
  const mime = buildPayoutNoticeMime(input, pdf);
  const sent = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: Buffer.from(mime, "utf8").toString("base64url") },
  });
  if (!sent.data.id) throw new Error("支払通知書メールの送信結果IDを取得できませんでした");
  return { gmailMessageId: sent.data.id };
}
