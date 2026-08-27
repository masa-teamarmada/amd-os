/**
 * 「クライアント入金月」と「メンバー支払月」の取り違えを止めるラチェット。
 *
 * 実行: npm run test:payment-month-usage
 * 正本: pwa/src/lib/payment-groups.ts / 仕様は manual 6-5。
 *
 * billing_cycles の1行から導ける「月」は2つあり、意味が違う。
 *   clientReceiptYmForCycle … クライアントからAMDへ入金される月 (売上・入金予定・資金繰り)
 *   memberPayoutYmForCycle  … AMDからメンバーへ払う月 (報酬・配賦・支払通知書)
 *
 * 両方 string を返すので、取り違えてもコンパイルは通ってしまう。実際に2026-08-26、
 * 月初合意・役員配賦・経営スコアの3か所が入金月でメンバー配賦を数えており、
 * 同じ月を開いているのに支払通知書と金額が食い違っていた。
 *
 * そこで「報酬・配賦・支払通知書を扱うファイルは入金月の関数を呼ばない」を機械で見る。
 * 例外を増やしたいときは、なぜその画面が入金月を必要とするのかを添えて EXCEPTIONS へ書く。
 */

import fs from "node:fs";
import path from "node:path";

const SRC = path.join(import.meta.dirname, "..", "src");

/** メンバーへ払う話をしているファイル。ここでは入金月の関数を使わない */
const MEMBER_PAYOUT_FILES = [
  "src/app/api/admin/payouts/route.ts",
  "src/app/api/cron/payout-reward-cache-refresh/route.ts",
  "src/app/api/cron/payout-notice-prebuild/route.ts",
  "src/components/admin/AdminPayoutsClient.tsx",
  "src/lib/monthly-work-agreement.ts",
  "src/lib/monthly-work-agreement-payout-gate.ts",
  "src/lib/finance/officer-compensation.ts",
  "src/lib/reward-member-breakdown.ts",
];

/** 入金月を使ってよい理由が明確なもの */
const EXCEPTIONS: Record<string, string> = {
  "src/lib/payment-groups.ts": "入金確認グループそのものを組む場所",
  "src/app/(app)/management-score/page.tsx": "入金予定・入金実績の資金繰り表。報酬側は memberPayoutYmForCycle を使う",
};

const CLIENT_FN = "clientReceiptYmForCycle";
const MEMBER_FN = "memberPayoutYmForCycle";
const RETIRED = ["effectivePaymentYmForCycle", "effectiveMemberPayoutYmForCycle"];

let failures = 0;
function fail(message: string) {
  failures++;
  console.error(`✗ ${message}`);
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const files = walk(SRC);
const repoRel = (file: string) => path.relative(path.join(import.meta.dirname, ".."), file);

for (const file of files) {
  const rel = repoRel(file);
  const text = fs.readFileSync(file, "utf8");

  for (const retired of RETIRED) {
    if (text.includes(`${retired}(`)) {
      fail(`${rel}: 旧名 ${retired} が残っている。意味が読める ${CLIENT_FN} / ${MEMBER_FN} を使う`);
    }
  }

  if (!text.includes(`${CLIENT_FN}(`)) continue;
  if (EXCEPTIONS[rel]) continue;
  if (MEMBER_PAYOUT_FILES.includes(rel)) {
    fail(`${rel}: メンバーへの支払を扱うファイルで ${CLIENT_FN} (クライアント入金月) を呼んでいる。${MEMBER_FN} を使う`);
    continue;
  }
  // 報酬・配賦を扱っていそうなのに入金月を使っているファイルは、増えた時点で気づけるようにする
  const looksLikePayout =
    /reward_paid_at|reward_summary_json|payout_notices|monthly_reward_payout/.test(text) &&
    !/expectedNetForCycle|confirmedDeposits|入金/.test(text);
  if (looksLikePayout) {
    fail(
      `${rel}: 報酬データを扱いながら ${CLIENT_FN} を呼んでいる。メンバーへ払う月なら ${MEMBER_FN} を使い、` +
        `入金月が正しいなら scripts/check_payment_month_usage.mts の EXCEPTIONS へ理由つきで追加する`
    );
  }
}

// メンバー支払月の関数が、入金確認と支払済みを見ていること (前倒し規則が消えていないこと)
const groups = fs.readFileSync(path.join(SRC, "lib", "payment-groups.ts"), "utf8");
const memberFnBody = groups.slice(groups.indexOf(`export function ${MEMBER_FN}(`));
if (!memberFnBody.includes("payment_confirmed_at")) {
  fail(`payment-groups.ts: ${MEMBER_FN} が payment_confirmed_at を見ていない (入金済みなのに支払月が後ろへずれる)`);
}
if (!memberFnBody.includes("reward_paid_at")) {
  fail(`payment-groups.ts: ${MEMBER_FN} が reward_paid_at を見ていない (支払済みの月が動いてしまう)`);
}

if (failures > 0) {
  console.error(`payment month usage contract: ${failures} 件 失敗`);
  process.exit(1);
}
console.log("payment month usage contract: OK");
