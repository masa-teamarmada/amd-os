import assert from "node:assert/strict";
import { buildPayoutNoticeMime } from "../src/lib/finance/payout-notice-native-mail.ts";

const input = {
  to: "member@example.com",
  bcc: ["owner@example.com"],
  subject: "支払通知書のご案内",
  body: "確認をお願いします。",
  memberId: "ID003",
  ym: "202609",
  pdfDriveFileId: "sample-drive-id",
};
const mime = buildPayoutNoticeMime(input, Buffer.from("%PDF-test"), "test-boundary");
assert.ok(mime.includes("<keiri@team-armada.jp>"));
assert.ok(mime.includes("To: member@example.com"));
assert.ok(mime.includes("Bcc: owner@example.com"));
assert.ok(mime.includes("Content-Type: application/pdf"));
assert.ok(mime.includes(Buffer.from("%PDF-test").toString("base64")));
assert.throws(() => buildPayoutNoticeMime({ ...input, to: "bad\r\nBcc: x@example.com" }, Buffer.from("%PDF-test")), /宛先が不正/);
assert.throws(() => buildPayoutNoticeMime({ ...input, subject: "題名\r\nBcc: x@example.com" }, Buffer.from("%PDF-test")), /改行は使えません/);
assert.throws(() => buildPayoutNoticeMime(input, Buffer.alloc(0)), /添付PDFが不正/);
console.log("native payout notice mail contract: OK (sendなし)");
