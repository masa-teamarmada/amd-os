import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { unzipSync, strFromU8 } from "fflate";
import {
  createCapitalPlanXlsx,
  type FrozenCapitalPlanVersion,
} from "../src/lib/capital-plan-xlsx.ts";
import {
  editableValue,
  type CapitalPlan,
  type ValidationIssue,
} from "../src/lib/capital-plan.ts";

function buildFixturePlan(): CapitalPlan {
  return {
    id: "plan-1",
    name: "テスト資本政策",
    holders: [
      { id: "h-founder", name: "=1+1<script>創業者タロウ'\"", kind: "founder" },
      { id: "h-investor", name: "VCキャピタル", kind: "investor" },
      { id: "h-esop", name: "ESOPプール", kind: "esop_pool" },
      { id: "h-note", name: "ノート投資家", kind: "investor" },
    ],
    events: [
      {
        id: "e-incorp",
        type: "incorporation",
        label: "設立",
        order: 0,
        date: "2024-01-01",
        status: "confirmed",
        allocations: [
          { id: "a-1", holderId: "h-founder", shareClass: "common", shares: editableValue(1000, "input") },
        ],
      },
      {
        id: "e-seed",
        type: "equity_issue",
        label: "シード",
        order: 1,
        date: "2025-01-01",
        status: "confirmed",
        calculationBasis: "manual",
        preMoneyValuation: editableValue(400_000_000, "input"),
        postMoneyValuation: editableValue(500_000_000, "input"),
        pricePerShare: editableValue(100_000, "confirmed"),
        primaryRaise: editableValue(100_000_000, "input"),
        newShares: editableValue(1000, "calculated"),
        allocations: [
          {
            id: "a-2",
            holderId: "h-investor",
            shareClass: "preferred",
            shares: editableValue(1000, "calculated"),
            amount: editableValue(100_000_000, "input"),
            pricePerShare: editableValue(100_000, "confirmed"),
            note: "=1+1 formula injection attempt",
          },
          {
            id: "a-3",
            holderId: "h-esop",
            shareClass: "option",
            shares: editableValue(200, "override"),
          },
        ],
      },
      {
        id: "e-pool",
        type: "option_pool",
        label: "追加SOプール",
        order: 2,
        date: "2025-02-01",
        status: "confirmed",
        poolSize: editableValue(100, "input"),
        allocations: [
          { id: "a-4", holderId: "h-esop", shareClass: "option", shares: editableValue(100, "input") },
        ],
      },
      {
        id: "e-split",
        type: "share_split",
        label: "株式分割",
        order: 3,
        date: "2025-03-01",
        status: "confirmed",
        splitRatio: editableValue(2, "input"),
        allocations: [],
      },
      {
        id: "e-secondary",
        type: "secondary",
        label: "セカンダリ譲渡",
        order: 4,
        date: "2025-04-01",
        status: "confirmed",
        allocations: [
          {
            id: "a-5",
            holderId: "h-founder",
            shareClass: "common",
            shares: editableValue(-100, "input"),
            amount: editableValue(1_000_000, "input"),
          },
          {
            id: "a-6",
            holderId: "h-investor",
            shareClass: "common",
            shares: editableValue(100, "input"),
            amount: editableValue(1_000_000, "input"),
          },
        ],
      },
      {
        id: "e-note",
        type: "convertible_issue",
        label: "転換前証券発行",
        order: 5,
        date: "2025-05-01",
        status: "planned",
        conversionCap: editableValue(600_000_000, "input"),
        conversionDiscount: editableValue(0.2, "input"),
        allocations: [
          { id: "a-7", holderId: "h-note", shareClass: "convertible", shares: editableValue(500, "input") },
        ],
      },
    ],
  };
}

function buildFrozenVersion(overrides: Partial<FrozenCapitalPlanVersion> = {}): FrozenCapitalPlanVersion {
  const plan = buildFixturePlan();
  const validation: ValidationIssue[] = [
    { severity: "warning", code: "fractional_shares", message: "端数株式の警告テスト", eventId: "e-seed" },
  ];
  return {
    plan,
    plan_name: "テスト資本政策",
    version: 3,
    source_revision: "rev-abc123",
    published_at: "2026-07-01T00:00:00.000Z",
    published_by: "まさ",
    document_json: JSON.stringify(plan),
    status: "frozen",
    validation,
    ...overrides,
  };
}

// --- Reject non-frozen / missing version input -----------------------------

assert.throws(
  () => createCapitalPlanXlsx({ ...buildFrozenVersion(), status: "draft" as unknown as "frozen" }),
  /frozen/,
  "must reject non-frozen input",
);

assert.throws(
  () => createCapitalPlanXlsx({ ...buildFrozenVersion(), version: undefined as unknown as number }),
  /バージョン/,
  "must reject missing version",
);

assert.throws(
  () =>
    createCapitalPlanXlsx({
      ...buildFrozenVersion(),
      validation: [{ severity: "error", code: "post_below_pre", message: "テストエラー", eventId: "e-seed" }],
    }),
  /検証エラー/,
  "must reject input with blocking validation errors",
);

// --- Generate a real xlsx ----------------------------------------------------

const version = buildFrozenVersion();
const bytes = createCapitalPlanXlsx(version);
assert.ok(bytes.length > 0, "should produce non-empty bytes");

const files = unzipSync(bytes);
const fileNames = Object.keys(files);

assert.ok(fileNames.includes("[Content_Types].xml"), "must include content types part");
assert.ok(fileNames.includes("xl/workbook.xml"), "must include workbook.xml");
assert.ok(fileNames.includes("xl/charts/chart1.xml"), "must include a chart part");
assert.ok(fileNames.includes("xl/drawings/drawing1.xml"), "must include a drawing part");

const workbookXml = strFromU8(files["xl/workbook.xml"]);
for (const sheetName of ["提出情報", "資本政策", "投資家別", "潜在株式・譲渡", "検算"]) {
  assert.ok(workbookXml.includes(sheetName), `workbook must reference sheet ${sheetName}`);
}

// --- Version / metadata present ---------------------------------------------

const coreXml = strFromU8(files["docProps/core.xml"]);
assert.ok(coreXml.includes("rev-abc123"), "core.xml must carry source revision");
assert.ok(coreXml.includes("v3"), "core.xml must carry frozen version number");

const sheet1Xml = strFromU8(files["xl/worksheets/sheet1.xml"]);
assert.ok(sheet1Xml.includes("rev-abc123"), "submission info sheet must show source revision");
assert.ok(sheet1Xml.includes("2026-07-01"), "submission info sheet must show published_at");
assert.ok(sheet1Xml.includes(xmlEscapeCheck("まさ")), "submission info sheet must show published_by");
assert.ok(sheet1Xml.includes("凍結済み"), "submission info sheet must show frozen status");

// --- Chart: vertical 100%-stacked column chart, not horizontal bar ----------

const chartXml = strFromU8(files["xl/charts/chart1.xml"]);
assert.ok(chartXml.includes('<c:barDir val="col"/>'), "chart must be a COLUMN (vertical) chart, not a bar chart");
assert.ok(chartXml.includes('<c:grouping val="percentStacked"/>'), "chart must be 100%-stacked");
assert.ok(!chartXml.includes('val="bar"'), "chart must not use horizontal bar direction");
// one <c:ser> per holder (4 holders in fixture: founder, investor, esop, note holder)
const serCount = (chartXml.match(/<c:ser>/g) ?? []).length;
assert.equal(serCount, 4, "chart must have one series per holder");

// Each series' category ref must point at the 資本政策 header row (event labels),
// and its value ref must point at that holder's FD% row (last of the 6 per-holder rows).
const catRefs = [...chartXml.matchAll(/<c:cat><c:strRef><c:f>([^<]+)<\/c:f>/g)].map((m) => m[1]);
assert.ok(
  catRefs.every((ref) => ref === "&apos;資本政策&apos;!$B$2:$G$2"),
  "every series category ref must point at the event header row of 資本政策",
);
// Fixed rows before holders: title, header, date, type, status, basis, pre, post, price,
// raise, cumulativeRaise, newIssuedShares, newFdShares, issued, fd, optionPool, split,
// conversionTerms, holderSection = 19 rows (1-indexed rows 1..19); holders start at row 20.
// Each holder occupies 6 rows (flow shares, paid amount, post issued, issued%, post FD, FD%),
// so holder N's FD% row is at 1-based row 20 + 6*N - 1.
const valRefs = [...chartXml.matchAll(/<c:val><c:numRef><c:f>([^<]+)<\/c:f>/g)].map((m) => m[1]);
assert.deepEqual(
  valRefs,
  [1, 2, 3, 4].map((n) => `&apos;資本政策&apos;!$B$${19 + 6 * n}:$G$${19 + 6 * n}`),
  "each series value ref must point at the correct holder's FD% row",
);

const drawingRels = strFromU8(files["xl/drawings/_rels/drawing1.xml.rels"]);
assert.ok(drawingRels.includes("chart1.xml"), "drawing rels must point at chart1.xml");

const policySheetRels = strFromU8(files["xl/worksheets/_rels/sheet2.xml.rels"]);
assert.ok(policySheetRels.includes("drawing1.xml"), "資本政策 sheet rels must reference drawing1.xml");

const sheet2Xml = strFromU8(files["xl/worksheets/sheet2.xml"]);
assert.ok(sheet2Xml.includes("<drawing"), "資本政策 sheet must embed the drawing");

// --- Holder / event data and formulas appear correctly ----------------------

assert.ok(sheet2Xml.includes("設立"), "資本政策 sheet must include event labels");
assert.ok(sheet2Xml.includes("シード"), "資本政策 sheet must include event labels");
assert.ok(sheet2Xml.includes("VCキャピタル"), "資本政策 sheet must include holder names");
assert.ok(sheet2Xml.includes("ESOPプール"), "資本政策 sheet must include holder names");

// --- New event-level rows: status, cumulative raise, new issued/FD shares, option
// pool, split ratio, conversion terms ------------------------------------------

assert.ok(sheet2Xml.includes("ステータス"), "資本政策 sheet must include an event status row");
assert.ok(sheet2Xml.includes("確定"), "資本政策 sheet must render confirmed status label");
assert.ok(sheet2Xml.includes("計画"), "資本政策 sheet must render planned status label");
assert.ok(sheet2Xml.includes("累計調達額"), "資本政策 sheet must include a cumulative raise row");
assert.ok(sheet2Xml.includes("新規発行株式数（発行済分）"), "資本政策 sheet must include a new-issued-shares row");
assert.ok(sheet2Xml.includes("新規発行株式数（完全希薄化後分）"), "資本政策 sheet must include a new-FD-shares row");
assert.ok(sheet2Xml.includes("オプションプールサイズ"), "資本政策 sheet must include an option pool row");
assert.ok(sheet2Xml.includes("株式分割比率"), "資本政策 sheet must include a split ratio row");
assert.ok(sheet2Xml.includes("転換条件"), "資本政策 sheet must include a conversion terms row");
assert.ok(sheet2Xml.includes("Cap: "), "資本政策 sheet must render the convertible cap amount");
assert.ok(sheet2Xml.includes("Discount: "), "資本政策 sheet must render the convertible discount");

// --- New per-holder rows: event flow shares, paid amount, post issued shares,
// issued %, post FD shares, FD % --------------------------------------------

assert.ok(sheet2Xml.includes("イベント内株式移動数"), "資本政策 sheet must include per-holder event flow shares rows");
assert.ok(sheet2Xml.includes("イベント内払込・対価"), "資本政策 sheet must include per-holder paid amount rows");
assert.ok(sheet2Xml.includes("発行済比率"), "資本政策 sheet must include per-holder issued percentage rows");
assert.ok(sheet2Xml.includes("完全希薄化後株式数（累計）"), "資本政策 sheet must include per-holder post FD shares rows");
assert.ok(sheet2Xml.includes("完全希薄化後比率"), "資本政策 sheet must include per-holder FD percentage rows");

const sheet3Xml = strFromU8(files["xl/worksheets/sheet3.xml"]);
assert.ok(sheet3Xml.includes("VCキャピタル"), "投資家別 sheet must include investor rows");
assert.ok(sheet3Xml.includes("preferred"), "投資家別 sheet must include share class");

// --- Investor sheet: event/status/holder/kind/flow type/share class/amount/shares/
// price/target FD %/source columns, sign-based secondary buyer/seller labels ----

assert.ok(sheet3Xml.includes("ステータス"), "投資家別 sheet must include a status column");
assert.ok(sheet3Xml.includes("区分"), "投資家別 sheet must include a holder kind column");
assert.ok(sheet3Xml.includes("移動区分"), "投資家別 sheet must include a flow type column");
assert.ok(sheet3Xml.includes("投資家"), "投資家別 sheet must render investor kind label");
assert.ok(sheet3Xml.includes("譲渡人（売り手）"), "投資家別 sheet must label the negative-shares secondary row as a seller");
assert.ok(sheet3Xml.includes("譲受人（買い手）"), "投資家別 sheet must label the positive-shares secondary row as a buyer");
assert.ok(sheet3Xml.includes("新規発行"), "投資家別 sheet must label positive non-secondary rows as new issuance");

const sheet5Xml = strFromU8(files["xl/worksheets/sheet5.xml"]);
assert.ok(sheet5Xml.includes("fractional_shares"), "検算 sheet must include validation issue codes");
assert.ok(sheet5Xml.includes("端数株式の警告テスト"), "検算 sheet must include validation messages");
assert.ok(sheet5Xml.includes("シード"), "検算 sheet must include override entries with event label");

// --- No protect-holder / disclaimer leakage from company-overview-xlsx ------

const allSheetXml = fileNames
  .filter((name) => name.startsWith("xl/worksheets/sheet"))
  .map((name) => strFromU8(files[name]))
  .join("\n");
assert.ok(!allSheetXml.includes("protected"), "must not carry over protect-holder concept");
assert.ok(!allSheetXml.includes("★"), "must not carry over protected-holder star marker");
assert.ok(!allSheetXml.includes("未保存の仮シミュレーション"), "must not carry over disclaimer banner text");

// --- company-overview-xlsx.ts must no longer define the obsolete unsaved
// next-round-scenario sheet or the protect-holder helper it depended on -------

const companyOverviewXlsxSource = readFileSync(
  fileURLToPath(new URL("../src/lib/company-overview-xlsx.ts", import.meta.url)),
  "utf8",
);
assert.ok(
  !companyOverviewXlsxSource.includes("nextRoundScenarioSheet"),
  "company-overview-xlsx.ts must not define/call the obsolete unsaved next-round-scenario sheet",
);
assert.ok(
  !companyOverviewXlsxSource.includes("pickProtectedHolder"),
  "company-overview-xlsx.ts must not define/call the obsolete protect-holder picker",
);
assert.ok(
  !companyOverviewXlsxSource.includes("computeNextRoundScenario"),
  "company-overview-xlsx.ts must not import the next-round scenario engine",
);
assert.ok(
  !companyOverviewXlsxSource.includes("未保存の仮シミュレーション"),
  "company-overview-xlsx.ts must not carry the unsaved-simulation disclaimer banner text",
);
assert.ok(
  !companyOverviewXlsxSource.includes("protectHolderName"),
  "company-overview-xlsx.ts must not reference protectHolderName",
);

// --- Formula / XML injection safety -----------------------------------------

// Holder name contains =1+1, <script>, quotes — must not appear as raw executable content.
assert.ok(!sheet2Xml.includes("<script>"), "holder name script tag must be XML-escaped");
assert.ok(sheet2Xml.includes("&lt;script&gt;"), "holder name script tag must be escaped as entities");
// A leading '=' in text content must be neutralized with a leading apostrophe marker.
assert.ok(
  /t="inlineStr"[^>]*><is><t[^>]*>&apos;=1\+1/.test(sheet2Xml) || sheet2Xml.includes("&apos;=1+1"),
  "leading '=' in holder name must be neutralized against formula injection",
);
assert.ok(sheet3Xml.includes("&apos;=1+1 formula injection attempt") || !sheet3Xml.includes("<f>=1+1"), "note field formula trigger must be neutralized, not turned into a live formula");
assert.ok(!sheet3Xml.includes("<f>=1+1"), "must never emit adversarial input as a live <f> formula");

function xmlEscapeCheck(v: string) {
  return v;
}

// --- New-issued-shares row must not count secondary buyer shares as new issuance,
// and the new-FD-shares row must derive positive allocations when newShares is
// absent for incorporation/option_pool/convertible_issue, but stay zero/blank for
// secondary and share_split -----------------------------------------------------

// e-secondary in the fixture has a buyer allocation of +100 shares with no newShares
// field set on the event; the new-issued-shares row for that event column must be 0,
// not 100 (which would wrongly count the secondary buyer as new issuance).
{
  const rowsXml = sheet2Xml.match(/<row[^>]*>[\s\S]*?<\/row>/g) ?? [];
  const newIssuedRow = rowsXml.find((r) => r.includes("新規発行株式数（発行済分）"));
  assert.ok(newIssuedRow, "new-issued-shares row must be present");
  // sheet2 columns: A=label, B=設立, C=シード, D=追加SOプール, E=株式分割, F=セカンダリ譲渡, G=転換前証券発行
  const secondaryCellMatch = newIssuedRow!.match(/<c r="F\d+"[^>]*>(?:<v>([^<]*)<\/v>)?/);
  const secondaryCellValue = secondaryCellMatch?.[1];
  assert.ok(
    secondaryCellValue == null || secondaryCellValue === "" || Number(secondaryCellValue) === 0,
    `new-issued-shares row must not count secondary buyer shares as new issuance (found: ${secondaryCellValue})`,
  );

  const newFdRow = rowsXml.find((r) => r.includes("新規発行株式数（完全希薄化後分）"));
  assert.ok(newFdRow, "new-FD-shares row must be present");
  // e-pool (D column) has no newShares field but has +100 option shares: must fall back to 100.
  const poolCellMatch = newFdRow!.match(/<c r="D\d+"[^>]*>(?:<v>([^<]*)<\/v>)?/);
  assert.equal(Number(poolCellMatch?.[1]), 100, "new-FD-shares must derive positive allocations for option_pool when newShares is absent");
  // e-split (E column) is a share_split: must stay zero/blank even though it has no allocations.
  const splitCellMatch = newFdRow!.match(/<c r="E\d+"[^>]*>(?:<v>([^<]*)<\/v>)?/);
  const splitCellValue = splitCellMatch?.[1];
  assert.ok(
    splitCellValue == null || splitCellValue === "" || Number(splitCellValue) === 0,
    `new-FD-shares row must be zero/blank for share_split (found: ${splitCellValue})`,
  );
  // e-secondary (F column) must also stay zero/blank.
  const secondaryFdCellMatch = newFdRow!.match(/<c r="F\d+"[^>]*>(?:<v>([^<]*)<\/v>)?/);
  const secondaryFdCellValue = secondaryFdCellMatch?.[1];
  assert.ok(
    secondaryFdCellValue == null || secondaryFdCellValue === "" || Number(secondaryFdCellValue) === 0,
    `new-FD-shares row must be zero/blank for secondary (found: ${secondaryFdCellValue})`,
  );
  // e-note (G column) is convertible_issue with no newShares but +500 convertible shares: must fall back to 500.
  const noteCellMatch = newFdRow!.match(/<c r="G\d+"[^>]*>(?:<v>([^<]*)<\/v>)?/);
  assert.equal(Number(noteCellMatch?.[1]), 500, "new-FD-shares must derive positive allocations for convertible_issue when newShares is absent");
}

// --- potentialDilutionSheet (sheet4, 潜在株式・譲渡) must have exactly one header row --

const sheet4Xml = strFromU8(files["xl/worksheets/sheet4.xml"]);
const sheet4HeaderOccurrences = (sheet4Xml.match(/株主・割当/g) ?? []).length;
assert.equal(sheet4HeaderOccurrences, 1, "潜在株式・譲渡 sheet must not have a duplicated header row");

console.log("capital plan xlsx: ok");
