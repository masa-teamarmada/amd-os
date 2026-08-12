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
assert.match(kiyoPage, /<AdminInvoicesPage embedded \/>/, "請求書の発行UIをきよへ埋め込む");
assert.match(kiyoPage, /<AdminPayoutsPage embedded \/>/, "メンバー支払の通知書発行・送付UIをきよへ埋め込む");
assert.match(reimbursePage, /embedded = false/, "立替画面は埋め込み時も同じwrite workflowを使う");
assert.match(catalog, /id: "admin-kiyo"[^\n]*title: "きよ"[^\n]*navLabel: "きよ"/, "adminメニュー名を『きよ』に固定する");

// 3taskはタブとして扱う（丸角カード群への回帰禁止）
assert.match(kiyoPage, /role="tablist"/, "3taskはtablistとして扱う");
assert.match(kiyoPage, /role="tab"/, "各taskはtab roleを持つ");
assert.match(kiyoPage, /aria-selected=\{selected\}/, "選択状態をaria-selectedで示す");
assert.match(kiyoPage, /role="tabpanel"/, "選択中の作業面をtabpanelとして関連付ける");
assert.match(kiyoPage, /aria-labelledby=\{`kiyo-tab-\$\{activeTask\}`\}/, "tabpanelを選択中tabへ関連付ける");
assert.doesNotMatch(kiyoPage, /rounded-lg border px-4 py-3/, "3taskをrounded-lgな個別カードへ回帰させない");
assert.doesNotMatch(kiyoPage, /grid gap-2 sm:grid-cols-3/, "3taskをカードgridへ回帰させない");

// 高密度dense operations UI契約: 見出し/タブ/本文の余白は4/8/12px系に収める
assert.match(kiyoPage, /mb-2/, "きよ見出し下の余白は8px系に収める");
assert.match(kiyoPage, /mb-3/, "タブ下の余白は12px系に収める");
assert.doesNotMatch(kiyoPage, /mb-5|mb-6/, "きよ見出し・タブの余白を20px以上に緩めない");
assert.match(kiyoPage, /min-h-11/, "タブのタップ領域は44px以上を維持する");

console.log("admin kiyo workspace contract: ok");
