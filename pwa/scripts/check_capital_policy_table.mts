import assert from "node:assert/strict";
import { buildCapitalPolicyTable, type CompanyOverviewData } from "../src/lib/company-overview.ts";

/**
 * 資本政策表（会社概要タブ）の回帰防止。
 * 実データ (CLG / p24) を縮約したフィクスチャで、ラウンド列の積み上げ、
 * SO の顕在/潜在分離、未登場株主の「－」判定、時価総額の導出を固定する。
 */

const round = (id: string, name: string, date: string, price: number, pre: number | null, post: number | null) => ({
  id,
  round_name: name,
  round_date: date,
  round_ym: date.slice(0, 7).replace("-", ""),
  pre_money_yen: pre,
  post_money_yen: post,
  raised_yen: null,
  price_per_share_yen: price,
  lead_investor: null,
  source_ref: null,
  notes: null,
});

const entry = (
  holderType: string,
  holderName: string,
  securityClass: string,
  outstanding: number,
  diluted: number,
  paidIn = 0,
) => ({
  id: `${holderName}-${securityClass}-${outstanding}-${diluted}`,
  holder_type: holderType,
  holder_name: holderName,
  security_class: securityClass,
  outstanding_delta: outstanding,
  diluted_delta: diluted,
  paid_in_yen_delta: paidIn,
});

const data: CompanyOverviewData = {
  profile: null,
  shareholders: [],
  convertibles: [],
  financialPeriods: [],
  meetings: [],
  actionItems: [],
  rounds: [
    round("r-a", "Series A", "2018-07-31", 676, null, 1_279_365_828),
    round("r-b", "Series B", "2020-07-31", 3380, 6_396_829_140, 6_991_949_120),
    round("r-c", "Series C", "2022-08-05", 3800, 7_979_521_200, 9_194_001_200),
    // 台帳イベントに紐づかない計画ラウンドは資本政策表の列にしない
    round("r-plan", "計画ラウンド", "2026-02-01", 1900, 4_597_000_600, 4_797_000_600),
  ],
  transactions: [
    {
      id: "t-a",
      project_id: "p24",
      round_id: "r-a",
      effective_on: "2018-07-31",
      transaction_type: "opening_balance",
      description: "Series A完了時点の残高",
      status: "confirmed",
      source_ref: null,
      notes: null,
      project_equity_entries: [
        entry("founder", "清水 敦史", "普通株式", 1_013_978, 1_013_978),
        entry("employee", "役職員", "普通株式", 51_500, 51_500),
        entry("employee", "役職員", "新株予約権", 0, 131_666),
        entry("vc", "リアルテックファンド", "普通株式", 458_580, 458_580),
        entry("corporate", "THK", "普通株式", 44_379, 44_379),
      ],
    },
    {
      id: "t-b",
      project_id: "p24",
      round_id: "r-b",
      effective_on: "2020-07-31",
      transaction_type: "new_issue",
      description: "Series B",
      status: "confirmed",
      source_ref: null,
      notes: null,
      project_equity_entries: [
        entry("vc", "リアルテックファンド", "普通株式", 14_071, 14_071, 47_559_980),
        entry("corporate", "THK", "普通株式", 29_585, 29_585, 99_997_300),
        entry("employee", "役職員", "新株予約権", 0, 100_000),
      ],
    },
    {
      id: "t-c",
      project_id: "p24",
      round_id: "r-c",
      effective_on: "2022-08-05",
      transaction_type: "new_issue",
      description: "Series C",
      status: "confirmed",
      source_ref: null,
      notes: null,
      project_equity_entries: [
        entry("vc", "株式会社前澤ファンド", "A1種優先株式", 237_033, 237_033, 607_240_000),
        entry("employee", "役職員", "普通株式", -50_500, -50_500),
        entry("employee", "役職員", "新株予約権", 0, -148_083),
      ],
    },
    {
      // planned は資本政策表に含めない
      id: "t-planned",
      project_id: "p24",
      round_id: "r-plan",
      effective_on: "2026-02-01",
      transaction_type: "new_issue",
      description: "計画",
      status: "planned",
      source_ref: null,
      notes: null,
      project_equity_entries: [entry("other", "FUNDINNO", "普通株式", 105_263, 105_263, 200_000_000)],
    },
  ],
};

const table = buildCapitalPolicyTable(data);

// confirmed の3イベントだけが列になる
assert.equal(table.columns.length, 3);
assert.deepEqual(table.columns.map((column) => column.roundLabel), ["Series A", "Series B", "Series C"]);
assert.equal(table.columns.every((column) => !column.cells.FUNDINNO), true);

const [seriesA, seriesB, seriesC] = table.columns;

// 顕在株と完全希薄化後の積み上げ
assert.equal(seriesA.total.shares, 1_568_437);
assert.equal(seriesA.total.options, 131_666);
assert.equal(seriesB.total.shares, 1_612_093);
assert.equal(seriesB.total.options, 231_666);
assert.equal(seriesC.total.shares, 1_798_626);
assert.equal(seriesC.total.options, 83_583);

// SOは「完全希薄化後 - 顕在」で分離する
assert.equal(seriesA.cells["役職員"].shares, 51_500);
assert.equal(seriesA.cells["役職員"].options, 131_666);
assert.equal(seriesB.cells["役職員"].newOptions, 100_000);
assert.equal(seriesC.cells["役職員"].newShares, -50_500);
assert.equal(seriesC.cells["役職員"].shares, 1_000);
assert.equal(seriesC.cells["役職員"].options, 83_583);

// まだ登場していない株主はその列にセルを持たない（画面は「－」表示）
assert.equal(seriesA.cells["株式会社前澤ファンド"], undefined);
assert.equal(seriesB.cells["株式会社前澤ファンド"], undefined);
assert.equal(seriesC.cells["株式会社前澤ファンド"].present, true);
// 小計は登場済みメンバーがいれば実数を出す（前澤未登場のSeries Bでもリアルテック分は出る）
assert.equal(
  table.groups.find((group) => group.holderType === "vc")!.subtotals[1].shares,
  472_651,
);

// 比率
assert.equal(seriesC.cells["清水 敦史"].ownershipPct.toFixed(2), ((1_013_978 / 1_798_626) * 100).toFixed(2));
assert.equal(seriesC.cells["株式会社前澤ファンド"].ownershipPct.toFixed(2), ((237_033 / 1_798_626) * 100).toFixed(2));
assert.equal(
  seriesC.cells["株式会社前澤ファンド"].dilutedPct.toFixed(2),
  ((237_033 / (1_798_626 + 83_583)) * 100).toFixed(2),
);

// ラウンド指標。発行価額・pre/post はラウンド登録値を優先し、無ければ台帳から導出する
assert.equal(seriesB.pricePerShareYen, 3380);
assert.equal(seriesB.raisedYen, 147_557_280);
assert.equal(seriesA.cumulativeRaisedYen, 0);
assert.equal(seriesB.cumulativeRaisedYen, 147_557_280);
assert.equal(seriesC.cumulativeRaisedYen, 147_557_280 + 607_240_000);
assert.equal(seriesA.preMoneyYen, null, "最初の列にはpreを作らない");
assert.equal(seriesB.preMoneyYen, 6_396_829_140);
assert.equal(seriesC.postMoneyYen, 9_194_001_200);
assert.equal(seriesC.postMoneyDilutedYen, (1_798_626 + 83_583) * 3800);

// 株主区分のグルーピングと小計
assert.deepEqual(table.groups.map((group) => group.holderType), ["founder", "vc", "corporate", "employee"]);
const vcGroup = table.groups.find((group) => group.holderType === "vc")!;
assert.deepEqual(vcGroup.holderNames, ["リアルテックファンド", "株式会社前澤ファンド"]);
assert.equal(vcGroup.subtotals[2].shares, 472_651 + 237_033);
assert.equal(vcGroup.subtotals[2].paidInYen, 607_240_000);

// 株式イベントが無いPJは列0件（画面はラウンド一覧テーブルにフォールバック）
assert.deepEqual(buildCapitalPolicyTable({ ...data, transactions: [] }), { columns: [], groups: [] });

console.log("capital policy table tests passed");
