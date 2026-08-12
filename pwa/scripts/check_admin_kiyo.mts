import assert from "node:assert/strict";
import fs from "node:fs";

const kiyoPage = fs.readFileSync(new URL("../src/app/(app)/admin/kiyo/page.tsx", import.meta.url), "utf8");
const reimbursePage = fs.readFileSync(new URL("../src/app/(app)/reimburse/page.tsx", import.meta.url), "utf8");
const catalog = fs.readFileSync(new URL("../src/lib/surface-catalog.ts", import.meta.url), "utf8");

assert.match(kiyoPage, /absolute: "きよ - AMD OS"/, "page titleは『きよ』に固定する");
assert.match(kiyoPage, />きよ<\/h1>/, "画面見出しは『きよ』に固定する");
assert.doesNotMatch(kiyoPage, /読み取り専用|read-only/, "きよを確認専用画面へ戻さない");

for (const task of ["reimbursements", "invoices", "payouts"]) {
  assert.match(kiyoPage, new RegExp(`id: "${task}"`), `${task} taskをきよに置く`);
  assert.match(kiyoPage, new RegExp(`/admin/kiyo\\?task=\\$\\{task\\.id\\}`), "task切替後も/admin/kiyoに留まる");
}

assert.match(kiyoPage, /<ReimburseWorkspace embedded \/>/, "立替の申請・承認UIをきよへ埋め込む");
assert.match(kiyoPage, /<AdminInvoicesPage \/>/, "請求書の発行UIをきよへ埋め込む");
assert.match(kiyoPage, /<AdminPayoutsPage \/>/, "メンバー支払の通知書発行・送付UIをきよへ埋め込む");
assert.match(reimbursePage, /embedded = false/, "立替画面は埋め込み時も同じwrite workflowを使う");
assert.match(catalog, /id: "admin-kiyo"[^\n]*title: "きよ"[^\n]*navLabel: "きよ"/, "adminメニュー名を『きよ』に固定する");

console.log("admin kiyo workspace contract: ok");
