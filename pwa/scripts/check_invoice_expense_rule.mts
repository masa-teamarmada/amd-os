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

// 立替の非課税は、編集・請求書明細・概算のすべてで 0% のまま扱う。
const reimbursementPage = fs.readFileSync(new URL("../src/app/(app)/reimburse/page.tsx", import.meta.url), "utf8");
const iosInvoiceStep = fs.readFileSync(new URL("../../ios/AMDOS/Features/Routine/InvoiceStepView.swift", import.meta.url), "utf8");
const iosInvoiceModels = fs.readFileSync(new URL("../../ios/AMDOS/Core/Models/RoutineModels.swift", import.meta.url), "utf8");
const iosSupabaseService = fs.readFileSync(new URL("../../ios/AMDOS/Core/Services/SupabaseService.swift", import.meta.url), "utf8");
assert.match(reimbursementPage, /taxRate: String\(item\.tax_rate \?\? 0\.1\)/, "立替編集で 0% を 10% に戻さない");
assert.match(iosInvoiceModels, /let taxRate: Double\?/, "iOS請求書プレビューが立替税率を持つ");
assert.match(iosSupabaseService, /\.select\("description, amount, date, category, tax_rate"\)/, "iOS請求書プレビューが立替税率を取得する");
assert.match(iosSupabaseService, /taxRate: r\.taxRate/, "iOS請求書プレビューへ立替税率を渡す");
assert.match(iosInvoiceStep, /private var reimbursementTaxYen: Double/, "iOS請求書が立替税額を明細ごとに計算する");
assert.match(iosInvoiceStep, /item\.taxRate \?\? 0\.1/, "iOS請求書で未設定の立替税率だけ10%に補完する");
assert.match(iosInvoiceStep, /Text\("消費税（概算）"\)/, "iOS請求書の税額表示を税率別の概算として示す");

const rateExpression = edge.match(/const taxRatePercent = ([^;]+);/ )?.[1];
assert.ok(rateExpression, "freee 明細の税率変換がある");
const freeeRate = new Function("r", `return ${rateExpression}`) as (r: { tax_rate: number | null }) => number;
for (const [rate, expected] of [[0, 0], [0.08, 8], [0.1, 10], [null, 10]] as const) {
  assert.equal(freeeRate({ tax_rate: rate }), expected, `freee 明細の税率 ${String(rate)}`);
}
assert.match(edge, /tax_rate: taxRatePercent,/, "変換した税率を freee 明細に渡す");
assert.match(edge, /taxRatePercent !== 0 && taxRatePercent !== 8 && taxRatePercent !== 10/, "想定外の税率を請求前に拒否する");

const itemTaxExpression = dialog.match(/\(sum, item\) => sum \+ (Math\.round\(Number\(item\.amount \?\? 0\) \* \(item\.tax_rate \?\? 0\.1\)\))/ )?.[1];
assert.ok(itemTaxExpression, "立替ごとの概算税額を計算する");
const addItemTax = new Function("sum", "item", `return sum + ${itemTaxExpression}`) as (
  sum: number,
  item: { amount: number; tax_rate: number },
) => number;
const taxRates = [0, 0.08, 0.1];
const reimbTax = taxRates.reduce((sum, tax_rate) => addItemTax(sum, { amount: 1000, tax_rate }), 0);
assert.equal(reimbTax, 180, "0%・8%・10% の立替を個別に計算する");
assert.equal(Math.round(1000 * 0.1) + reimbTax, 280, "基本行 10% と立替税率を分ける");
assert.match(dialog, /const grossTotal = netTotal \+ reimbYen \+ taxEstimate;/, "概算合計に税率別の税額を使う");

console.log("invoice expense billing rule: ok");
