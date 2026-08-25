/**
 * freee の出金 → メンバーへの報酬支払い の照合規則の検査。
 *
 * 実行: npm run test:member-payout-matching
 * 正本: pwa/src/lib/finance/member-payout-matching.ts / 仕様は manual 6-5。
 *
 * ここで守るのは、実データで一度踏んだ落とし穴。
 *   - 同じ日に同じ金額の振込が2件あっても、どちらも取りこぼさない
 *   - 経費の立替 (カード決済など) を報酬の支払いに数えない
 *   - 旧字体の氏名 (輕部/軽部・宮﨑/宮崎) を同一人物として扱う
 *   - 支払通知書の税込額と一致した振込から、振込名義を学習する
 */

import {
  buildSettlements,
  extractTransferName,
  mergeOutflows,
  normalizeName,
  taxIncludedYen,
  type FreeeExpenseDeal,
  type FreeeWalletTxn,
  type SettlementMemberRow,
  type SettlementNoticeRow,
} from "../src/lib/finance/member-payout-matching.ts";

let failures = 0;

function check(label: string, condition: boolean, detail?: unknown) {
  if (condition) return;
  failures++;
  console.error(`✗ ${label}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
}

const members: SettlementMemberRow[] = [
  { member_id: "ID003", code_name: "かる", member_name: "輕部 琢真", contractor_name: "輕部 琢真" },
  { member_id: "ID004", code_name: "こう", member_name: "宮﨑 航一", contractor_name: "福田 航一" },
  { member_id: "ID007", code_name: "ちこ", member_name: "遠藤 千穂", contractor_name: "株式会社chiko" },
  { member_id: "ID013", code_name: "かず", member_name: "坂本 和子", contractor_name: "坂本 和子" },
];

const notices: SettlementNoticeRow[] = [
  { member_id: "ID003", ym: "202605", notice_no: "PN202605-001", total_yen: 731_740, sent_at: "2026-05-31T00:00:00Z" },
  { member_id: "ID007", ym: "202605", notice_no: "PN202605-002", total_yen: 457_684, sent_at: "2026-05-31T00:00:00Z" },
];

// --- 名寄せの基本 ---------------------------------------------------------
check("旧字体の氏名が新字体と一致する", normalizeName("輕部 琢真") === normalizeName("軽部　琢真"));
check("宮﨑と宮崎が一致する", normalizeName("宮﨑 航一") === normalizeName("宮崎 航一"));
check("株式会社の有無で一致が壊れない", normalizeName("株式会社chiko") === normalizeName("chiko"));
check("振込名義を取り出せる", extractTransferName("振込 カルベ　タクマ") === "カルベタクマ", extractTransferName("振込 カルベ　タクマ"));
check("振込手数料は名義として扱わない", extractTransferName("振込手数料") === null);
check("振込以外の摘要は名義として扱わない", extractTransferName("AMAZON CO JP armada02") === null);
check("税込額の換算", taxIncludedYen(731_740) === 804_914, taxIncludedYen(731_740));

// --- 同日同額の2件を取りこぼさない ---------------------------------------
const sameDayTxns: FreeeWalletTxn[] = [
  { id: 1, date: "2026-04-30", entry_side: "expense", amount: 88_000, description: "振込 サカモト　カズコ" },
  { id: 2, date: "2026-04-30", entry_side: "expense", amount: 88_000, description: "振込 ヤマダ　リヨウハ" },
];
const sameDayOutflows = mergeOutflows({ deals: [], walletTxns: sameDayTxns, partnerNames: new Map() });
check("同じ日・同じ金額の振込を1件に潰さない", sameDayOutflows.length === 2, sameDayOutflows.length);

// --- 取引と口座明細の二重計上を避ける ------------------------------------
const deal: FreeeExpenseDeal = {
  id: 100,
  partner_id: 900,
  issue_date: "2026-06-30",
  amount: 10_296,
  details: [{ description: "" }],
  payments: [{ id: 5000, date: "2026-06-30", amount: 10_296 }],
};
const dealTxn: FreeeWalletTxn = { id: 3, date: "2026-06-30", entry_side: "expense", amount: 10_296, description: "振込 ミヤザキ　コウイチ" };
const merged = mergeOutflows({ deals: [deal], walletTxns: [dealTxn], partnerNames: new Map([["900", "宮崎 航一"]]) });
check("同じ支出が取引と口座明細にあっても1件になる", merged.length === 1, merged.length);
check("口座明細へ取引先名が補われる", merged[0]?.partnerName === "宮崎 航一", merged[0]?.partnerName);

// --- 報酬の支払いと経費立替の区別 ----------------------------------------
const mixed = mergeOutflows({
  deals: [
    {
      id: 200,
      partner_id: 901,
      issue_date: "2026-05-20",
      amount: 3_440,
      details: [{ description: "打合せ" }],
      payments: [{ id: 5001, date: "2026-05-20", amount: 3_440 }],
    },
  ],
  walletTxns: [
    { id: 10, date: "2026-05-29", entry_side: "expense", amount: 804_914, description: "振込 カルベ　タクマ" },
    { id: 11, date: "2026-05-20", entry_side: "expense", amount: 3_440, description: "喫茶室ルノアール armada02" },
  ],
  partnerNames: new Map([["901", "輕部 琢真"]]),
});
const mixedResult = buildSettlements({ outflows: mixed, members, notices, aliases: [] });
check("カード決済の経費立替を報酬の支払いに数えない", mixedResult.settlements.every((row) => row.amountYen !== 3_440), mixedResult.settlements.map((row) => row.amountYen));
check("口座振込は報酬の支払いとして拾う", mixedResult.settlements.some((row) => row.amountYen === 804_914));

const karube = mixedResult.settlements.find((row) => row.amountYen === 804_914);
check("通知書の税込額一致でメンバーが決まる", karube?.memberId === "ID003", karube?.memberId);
check("通知書と結び付く", karube?.noticeYm === "202605", karube?.noticeYm);
check("金額一致は高い確度になる", karube?.confidence === "high", karube?.confidence);
check("振込名義を学習する", mixedResult.learnedAliases.some((alias) => alias.alias === "カルベタクマ" && alias.memberId === "ID003"), mixedResult.learnedAliases);

// --- 学習済みの名義は金額が違っても効く ----------------------------------
const laterTxn = mergeOutflows({
  deals: [],
  walletTxns: [{ id: 20, date: "2026-08-31", entry_side: "expense", amount: 123_456, description: "振込 カルベ　タクマ" }],
  partnerNames: new Map(),
});
const learned = buildSettlements({
  outflows: laterTxn,
  members,
  notices,
  aliases: [{ alias: "カルベタクマ", member_id: "ID003" }],
});
check("学習済み名義で後の振込も拾う", learned.settlements[0]?.memberId === "ID003", learned.settlements[0]);
check("金額が通知書と違えば確度は下がる", learned.settlements[0]?.confidence !== "high", learned.settlements[0]?.confidence);

// --- 振込手数料ぶんの目減りを同一支払として扱う --------------------------
const feeTxn = mergeOutflows({
  deals: [],
  walletTxns: [{ id: 30, date: "2026-05-29", entry_side: "expense", amount: 503_452 - 440, description: "振込 カ）チコ" }],
  partnerNames: new Map(),
});
const feeResult = buildSettlements({ outflows: feeTxn, members, notices, aliases: [{ alias: "チコ", member_id: "ID007" }] });
check("振込手数料ぶんの差は同じ支払として扱う", feeResult.settlements[0]?.amountMatch === "within_transfer_fee", feeResult.settlements[0]?.amountMatch);

if (failures > 0) {
  console.error(`member payout matching contract: ${failures} 件 失敗`);
  process.exit(1);
}
console.log("member payout matching contract: OK");
