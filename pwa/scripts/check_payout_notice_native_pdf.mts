import assert from "node:assert/strict";
import { buildPayoutNoticeHtml } from "../src/lib/finance/payout-notice-native-pdf.ts";

const input = {
  ym: "202609", memberId: "ID003", noticeNo: "PN202609-001",
  payeeName: "表示テスト", payeeAddress: "", invoiceRegistrationNumber: "",
  issuedAtJst: "2026-09-25T21:30:00+09:00", rewardYen: 145_575,
  rewards: [{ description: "SOL 4〜6月発生分の一部", amountYen: 145_575 }],
  reimbursements: [
    { description: "立替精算 SX 07/09 ビザスクインタビュー4本", amountYen: 66_000 },
    { description: "立替精算 SX 07/24 エキスパートインタビュー費用", amountYen: 16_500 },
  ],
};
const logos = { mark: "data:image/png;base64,AA==", logotype: "data:image/png;base64,AA==" };
const html = buildPayoutNoticeHtml(input, logos);

for (const text of ["4〜6月発生分の一部", "145,575円", "14,558円", "66,000円", "16,500円", "82,500円", "242,633円", "2026年9月30日"]) {
  assert.ok(html.includes(text), `${text} が通知書に無い`);
}
assert.ok(html.indexOf("66,000円") < html.indexOf("16,500円"), "立替明細の順序が変わった");
assert.throws(() => buildPayoutNoticeHtml({ ...input, rewardYen: 145_576 }, logos), /一致しません/);
assert.throws(() => buildPayoutNoticeHtml({ ...input, reimbursements: [{ description: "", amountYen: 66_000 }] }, logos), /明細が不正/);
const escaped = buildPayoutNoticeHtml({ ...input, payeeName: "<script>alert(1)</script>" }, logos);
assert.ok(!escaped.includes("<script>"), "宛名のHTMLがそのまま埋め込まれた");

console.log("native payout notice PDF contract: OK");
