import assert from "node:assert/strict";
import fs from "node:fs";
import { expenseReimbursementBillingRule } from "../src/lib/project-contract-terms.ts";

assert.deepEqual(
  expenseReimbursementBillingRule({ expenseReimbursementAllowed: false, expenseReimbursementNote: "上乗せ不可" }),
  { allowed: false, note: "上乗せ不可" },
  "PJ運用条件の上乗せ不可を読む",
);
assert.deepEqual(
  expenseReimbursementBillingRule({
    expenseReimbursementAllowed: false,
    currentContracts: [{ terms: { expenseReimbursementAllowed: true, expenseReimbursementNote: "契約書で別途請求可" } }],
  }),
  { allowed: true, note: "契約書で別途請求可" },
  "現行契約の条件をPJ運用条件より優先する",
);
assert.deepEqual(
  expenseReimbursementBillingRule({ expenseReimbursementNote: "要確認" }),
  { allowed: null, note: "要確認" },
  "メモだけを可否へ推測変換しない",
);

const queue = fs.readFileSync(new URL("../src/components/admin/AdminInvoiceIssueQueue.tsx", import.meta.url), "utf8");
const dialog = fs.readFileSync(new URL("../src/components/admin/AdminInvoiceIssueDialog.tsx", import.meta.url), "utf8");
const edge = fs.readFileSync(new URL("../../ios/supabase/functions/issue-invoice/index.ts", import.meta.url), "utf8");
const migration = fs.readFileSync(new URL("../../ios/supabase/migrations/20260812143000_enforce_invoice_expense_rule.sql", import.meta.url), "utf8");

assert.match(queue, /請求書作成/, "作成モーダルを開く入口は『請求書作成』と表示する");
assert.match(dialog, /請求書を発行/, "freeeへ送る最終操作だけは『請求書を発行』と表示する");
assert.match(queue, /aria-label=\{`\$\{ymDisplay\(row\.ym\)\}の過去滞留を解消`\}/, "過去滞留は解消操作としてクリックできる");
assert.match(queue, /請求月を更新/, "過去滞留の詳細内で請求月を更新できる");
assert.match(queue, /expenseRule\.allowed === true[\s\S]*approvedReimbursementTotal/, "上乗せ可のPJだけ立替を請求候補へ加える");
assert.match(edge, /expenseReimbursementAllowed === true \? reimbursementSnapshot\.billable : \[\]/, "実発行も上乗せ可のPJだけ立替明細を加える");
assert.match(migration, /project_id = 'p21'/, "SXの上乗せ不可をPJ正本へ反映する");
assert.match(migration, /reimbursement_rule_missing/, "立替がある未抽出PJの発行claimを拒否する");
assert.match(migration, /v_expense_allowed AND v_pending_count > 0/, "上乗せ可のPJだけ未承認立替を発行blockerにする");

console.log("invoice expense billing rule: ok");
