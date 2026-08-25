/**
 * 立替精算を支払通知書へ合算する規則の検査。
 *
 * 実行: npm run test:payout-reimbursements
 * 正本: pwa/src/lib/finance/payout-reimbursements.ts / 仕様は manual 6-5。
 *
 * ここで守るのは金額事故に直結する規則。
 *   - admin 承認済みだけを載せる (PM承認どまり・却下は載せない)
 *   - 別の支払月へ載せ済み (billed_ym) のものは二度と拾わない = 二重払いを防ぐ
 *   - 同じ支払月へ載せ済みのものは、再発行しても同じ内容になるよう拾い直す
 *   - 支払月の月末までに承認されたものだけを載せる
 */

import {
  reimbursementTotalYen,
  selectPayableReimbursements,
  type ReimbursementRow,
} from "../src/lib/finance/payout-reimbursements.ts";

let failures = 0;
function check(label: string, condition: boolean, detail?: unknown) {
  if (condition) return;
  failures++;
  console.error(`✗ ${label}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
}

const memberByEmail = new Map([
  ["taku@team-armada.jp", "ID003"],
  ["abichan@team-armada.jp", "ID009"],
]);

const rows: ReimbursementRow[] = [
  {
    reimbursement_id: "r1",
    project_id: "p21",
    project_name: "SX",
    date: "2026-07-09",
    amount: 66_000,
    status: "approved",
    created_by: "taku@team-armada.jp",
    admin_approved_at: "2026-08-07T08:41:55.965Z",
    billed_ym: null,
  },
  {
    reimbursement_id: "r2",
    project_id: "p21",
    project_name: "SX",
    date: "2026-07-24",
    amount: 16_500,
    status: "approved",
    created_by: "taku@team-armada.jp",
    admin_approved_at: "2026-08-07T08:41:57.542Z",
    billed_ym: null,
  },
  {
    reimbursement_id: "r3",
    date: "2026-06-01",
    amount: 5_000,
    status: "pmApproved",
    created_by: "taku@team-armada.jp",
    admin_approved_at: null,
    billed_ym: null,
  },
  {
    reimbursement_id: "r4",
    date: "2026-05-01",
    amount: 3_000,
    status: "approved",
    created_by: "taku@team-armada.jp",
    admin_approved_at: "2026-06-01T00:00:00.000Z",
    billed_ym: "202606",
  },
  {
    reimbursement_id: "r5",
    date: "2026-07-30",
    amount: 990,
    status: "approved",
    created_by: "abichan@team-armada.jp",
    admin_approved_at: "2026-08-07T09:00:00.000Z",
    billed_ym: null,
  },
  {
    reimbursement_id: "r6",
    date: "2026-07-30",
    amount: 1_980,
    status: "rejected",
    created_by: "abichan@team-armada.jp",
    admin_approved_at: "2026-08-07T09:00:00.000Z",
    billed_ym: null,
  },
];

const aug = selectPayableReimbursements(rows, memberByEmail, "202608");
check("8月支払分に承認済み2件が乗る", reimbursementTotalYen(aug.get("ID003")) === 82_500, reimbursementTotalYen(aug.get("ID003")));
check("PM承認どまりは乗せない", !(aug.get("ID003") ?? []).some((row) => row.reimbursementId === "r3"));
check("却下は乗せない", !(aug.get("ID009") ?? []).some((row) => row.reimbursementId === "r6"));
check("別の支払月へ載せ済みは乗せない", !(aug.get("ID003") ?? []).some((row) => row.reimbursementId === "r4"));
check("別メンバーの分は混ざらない", reimbursementTotalYen(aug.get("ID009")) === 990, reimbursementTotalYen(aug.get("ID009")));

const jul = selectPayableReimbursements(rows, memberByEmail, "202607");
check("承認が支払月の月末より後なら、その月には乗せない", (jul.get("ID003") ?? []).length === 0, jul.get("ID003"));

const jun = selectPayableReimbursements(rows, memberByEmail, "202606");
check("同じ支払月へ載せ済みのものは再発行のために拾い直す", (jun.get("ID003") ?? []).some((row) => row.reimbursementId === "r4"), jun.get("ID003"));

const zero = selectPayableReimbursements(
  [{ reimbursement_id: "r7", amount: 0, status: "approved", created_by: "taku@team-armada.jp", admin_approved_at: "2026-08-01T00:00:00.000Z", billed_ym: null }],
  memberByEmail,
  "202608"
);
check("0円の申請は乗せない", (zero.get("ID003") ?? []).length === 0);

const unknownMember = selectPayableReimbursements(
  [{ reimbursement_id: "r8", amount: 1_000, status: "approved", created_by: "someone@example.com", admin_approved_at: "2026-08-01T00:00:00.000Z", billed_ym: null }],
  memberByEmail,
  "202608"
);
check("メンバー台帳に無い申請者は乗せない", unknownMember.size === 0);

if (failures > 0) {
  console.error(`payout reimbursement contract: ${failures} 件 失敗`);
  process.exit(1);
}
console.log("payout reimbursement contract: OK");
