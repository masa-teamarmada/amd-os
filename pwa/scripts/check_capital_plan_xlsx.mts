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
        calculationBasis: "valuation_and_investment",
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
    project_name: "テスト株式会社",
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
  /凍結済み/,
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
assert.ok(sheet1Xml.includes("会社名"), "submission info sheet must show a company-name row");
assert.ok(sheet1Xml.includes("テスト株式会社"), "submission info sheet must show the project's legal name independently of plan_name");
assert.ok(sheet1Xml.includes("プラン名"), "submission info sheet must show a plan-name row");
assert.ok(sheet1Xml.includes("テスト資本政策"), "submission info sheet must still show plan_name");

// --- Chart: vertical 100%-stacked column chart, not horizontal bar ----------

const chartXml = strFromU8(files["xl/charts/chart1.xml"]);
assert.ok(chartXml.includes('<c:barDir val="col"/>'), "chart must be a COLUMN (vertical) chart, not a bar chart");
assert.ok(chartXml.includes('<c:grouping val="percentStacked"/>'), "chart must be 100%-stacked");
assert.ok(!chartXml.includes('val="bar"'), "chart must not use horizontal bar direction");
// one <c:ser> per holder (4 holders in fixture: founder, investor, esop, note holder)
const serCount = (chartXml.match(/<c:ser>/g) ?? []).length;
assert.equal(serCount, 4, "chart must have one series per holder");

// Chart layout constants, mirrored from capital-plan-xlsx.ts: the native chart occupies
// dedicated blank rows above the event table so it never overlays data. 1 title row +
// 17 reserved chart rows + 1 spacer row = the event-label header row sits at 0-indexed
// row 19 (Excel row 20, 1-indexed).
const CHART_RESERVED_ROWS = 17;
const CHART_SPACER_ROWS = 1;
/** Extra columns of margin past the last event column when sizing the chart's right edge, mirrored from capital-plan-xlsx.ts. */
const CHART_RIGHT_COL_MARGIN = 3;
const POLICY_HEADER_ROW_INDEX = 1 + CHART_RESERVED_ROWS + CHART_SPACER_ROWS; // 19 (0-indexed)
const POLICY_HEADER_ROW_1INDEXED = POLICY_HEADER_ROW_INDEX + 1; // 20
const POLICY_METRIC_ROWS_AFTER_HEADER = 17;
const POLICY_FIXED_ROWS = POLICY_HEADER_ROW_INDEX + 1 + POLICY_METRIC_ROWS_AFTER_HEADER; // 37 (0-indexed, first holder row)

// Each series' category ref must point at the 資本政策 event-label header row (relocated
// to row 20 to make room for the chart), and its value ref must point at that holder's
// FD% row (last of the 6 per-holder rows).
const catRefs = [...chartXml.matchAll(/<c:cat><c:strRef><c:f>([^<]+)<\/c:f>/g)].map((m) => m[1]);
assert.ok(
  catRefs.every((ref) => ref === `&apos;資本政策&apos;!$B$${POLICY_HEADER_ROW_1INDEXED}:$G$${POLICY_HEADER_ROW_1INDEXED}`),
  "every series category ref must point at the relocated event-label header row of 資本政策 (row 20)",
);
// Each holder occupies 6 rows (flow shares, paid amount, post issued, issued%, post FD, FD%),
// so holder N's FD% row is at 1-based row POLICY_FIXED_ROWS + 6*N.
const valRefs = [...chartXml.matchAll(/<c:val><c:numRef><c:f>([^<]+)<\/c:f>/g)].map((m) => m[1]);
assert.deepEqual(
  valRefs,
  [1, 2, 3, 4].map((n) => `&apos;資本政策&apos;!$B$${POLICY_FIXED_ROWS + 6 * n}:$G$${POLICY_FIXED_ROWS + 6 * n}`),
  "each series value ref must point at the correct holder's FD% row",
);

// Series titles must be the actual holder names (literal, not a cell reference that could
// resolve to Excel's "Series 1" default), and must not be the generic placeholder.
const seriesTitles = [...chartXml.matchAll(/<c:tx><c:v>([^<]+)<\/c:v><\/c:tx>/g)].map((m) => m[1]);
const rawHolderNamesInOrder = ["=1+1<script>創業者タロウ'\"", "VCキャピタル", "ESOPプール", "ノート投資家"];
assert.deepEqual(
  seriesTitles,
  rawHolderNamesInOrder.map(xmlEscapeForChart),
  "series titles must be the actual holder names in holder order",
);
assert.ok(
  seriesTitles.every((t) => !/^Series ?\d+$/i.test(t)),
  "series titles must never fall back to Excel's generic 'Series N' placeholder",
);

// Chart anchor: dedicated rows above the event table (never overlays row 20+ data), and a
// right edge that scales with the number of events (6 in the fixture); see the dedicated
// 2/3/6/10-event regression block below for the general N -> toCol relationship.
const drawingXml = strFromU8(files["xl/drawings/drawing1.xml"]);
const fromMatch = drawingXml.match(/<xdr:from><xdr:col>(\d+)<\/xdr:col><xdr:colOff>(\d+)<\/xdr:colOff><xdr:row>(\d+)<\/xdr:row>/);
const toMatch = drawingXml.match(/<xdr:to><xdr:col>(\d+)<\/xdr:col><xdr:colOff>(\d+)<\/xdr:colOff><xdr:row>(\d+)<\/xdr:row>/);
assert.ok(fromMatch && toMatch, "chart drawing must have a two-cell anchor with from/to rows");
const anchorFromCol = Number(fromMatch![1]);
const anchorFromColOffset = Number(fromMatch![2]);
const anchorFromRow = Number(fromMatch![3]);
const anchorToCol = Number(toMatch![1]);
const anchorToColOffset = Number(toMatch![2]);
const anchorToRow = Number(toMatch![3]);
assert.equal(anchorFromRow, 1, "chart top edge must start at 0-indexed row 1 (Excel row 2)");
assert.ok(
  anchorToRow <= POLICY_HEADER_ROW_INDEX,
  `chart bottom edge (row ${anchorToRow}) must sit at or above the event-label header row (row ${POLICY_HEADER_ROW_INDEX}), never overlapping table data`,
);

// Anchor-offset correction: reviewer evidence from an actual render of 資本政策.png (6 events)
// showed native bar centers sitting ~51px right of their event-column centers, though category
// spacing exactly matched the event-column width — the whole plot area was offset, not the
// spacing. The fix shifts the entire two-cell anchor (both edges) left by ~51px without
// changing its width: left edge moves off column B (col 1, offset 0) into wide column A
// (col 0) at 221px (272px column-A width minus the 51px shift); right edge moves one column
// left (rightCol-1, offset 0) into the margin column at 16px (67px default column width minus
// the 51px shift) — both derived from the same 51px correction, so the drawing's pixel width
// is unchanged.
const EMU_PER_PIXEL = 9525;
assert.equal(anchorFromCol, 0, "chart left edge must move into column A (col 0), not stay at column B (col 1)");
assert.equal(
  anchorFromColOffset,
  221 * EMU_PER_PIXEL,
  "chart left edge offset must be exactly 221px (272px column-A width minus the 51px artifact-measured shift), in EMU",
);
assert.equal(
  anchorToColOffset,
  16 * EMU_PER_PIXEL,
  "chart right edge offset must be exactly 16px (67px default column width minus the 51px artifact-measured shift), in EMU",
);
// 6 events in the fixture: rightCol = 6+1+3 = 10, so the shifted right-edge column
// (rightCol-1) must be exactly 9 — right edge must scale with event count with no floor.
assert.equal(anchorToCol, 9, "chart right edge column (rightCol-1) must scale with the number of events, with no minimum-width floor");

// --- Chart anchor right edge / category range must scale with event count for
// N = 2, 3, 6, 10 events, with no minimum-width floor (rightCol = N+1+margin(3),
// toCol = rightCol-1 = N+3) ---------------------------------------------------

function colLetter(index: number): string {
  let n = index + 1;
  let result = "";
  while (n > 0) {
    const remainder = (n - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

function buildPlanWithNEvents(n: number): CapitalPlan {
  return {
    id: `plan-n${n}`,
    name: `N=${n} イベントプラン`,
    holders: [{ id: "h-founder", name: "創業者", kind: "founder" }],
    events: Array.from({ length: n }, (_, i) => ({
      id: `e-${i}`,
      type: "equity_issue" as const,
      label: `イベント${i + 1}`,
      order: i,
      date: `2025-0${(i % 9) + 1}-01`,
      status: "confirmed" as const,
      calculationBasis: "manual" as const,
      allocations: [
        {
          id: `a-${i}`,
          holderId: "h-founder",
          shareClass: "common" as const,
          shares: editableValue((i + 1) * 100, "input"),
          amount: editableValue((i + 1) * 100_000, "input"),
          pricePerShare: editableValue(1000, "confirmed"),
        },
      ],
    })),
  };
}

for (const n of [2, 3, 6, 10]) {
  const nPlan = buildPlanWithNEvents(n);
  const nVersion: FrozenCapitalPlanVersion = {
    plan: nPlan,
    plan_name: `N=${n}`,
    project_name: `N=${n} 株式会社`,
    version: 1,
    source_revision: `rev-n${n}`,
    published_at: "2026-07-01T00:00:00.000Z",
    published_by: "まさ",
    document_json: JSON.stringify(nPlan),
    status: "frozen",
    validation: [],
  };
  const nBytes = createCapitalPlanXlsx(nVersion);
  const nFiles = unzipSync(nBytes);
  const nDrawingXml = strFromU8(nFiles["xl/drawings/drawing1.xml"]);
  const nToMatch = nDrawingXml.match(/<xdr:to><xdr:col>(\d+)<\/xdr:col>/);
  assert.ok(nToMatch, `N=${n}: drawing must have a to-col anchor`);
  const expectedToCol = n + CHART_RIGHT_COL_MARGIN; // rightCol(N+1+margin) - 1 = N+margin
  assert.equal(
    Number(nToMatch![1]),
    expectedToCol,
    `N=${n}: chart right edge column must be ${expectedToCol} (N+1+margin-1), with no minimum-width floor`,
  );

  const nChartXml = strFromU8(nFiles["xl/charts/chart1.xml"]);
  const nCatRefs = [...nChartXml.matchAll(/<c:cat><c:strRef><c:f>([^<]+)<\/c:f>/g)].map((m) => m[1]);
  const expectedLastCol = colLetter(n);
  assert.ok(
    nCatRefs.length > 0 && nCatRefs.every((ref) => ref.endsWith(`:$${expectedLastCol}$${POLICY_HEADER_ROW_1INDEXED}`)),
    `N=${n}: every category ref must span through column ${expectedLastCol} (the last event column)`,
  );
  assert.ok(
    nCatRefs.every((ref) => ref.includes(`$B$${POLICY_HEADER_ROW_1INDEXED}:`)),
    `N=${n}: every category ref must start at column B (the first event column)`,
  );
}

const drawingRels = strFromU8(files["xl/drawings/_rels/drawing1.xml.rels"]);
assert.ok(drawingRels.includes("chart1.xml"), "drawing rels must point at chart1.xml");

const policySheetRels = strFromU8(files["xl/worksheets/_rels/sheet2.xml.rels"]);
assert.ok(policySheetRels.includes("drawing1.xml"), "資本政策 sheet rels must reference drawing1.xml");

const sheet2Xml = strFromU8(files["xl/worksheets/sheet2.xml"]);
assert.ok(sheet2Xml.includes("<drawing"), "資本政策 sheet must embed the drawing");

// The event-label header row (containing event labels as column headers) must actually be
// relocated to row 20 (1-indexed) in the sheet XML, with only blank reserved/spacer rows above it.
{
  const rowsXml = sheet2Xml.match(/<row r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g) ?? [];
  const headerRowXml = rowsXml.find((r) => r.startsWith(`<row r="${POLICY_HEADER_ROW_1INDEXED}"`));
  assert.ok(headerRowXml, `event-label header row must be present at row ${POLICY_HEADER_ROW_1INDEXED}`);
  assert.ok(headerRowXml!.includes("設立"), "relocated header row must contain the event labels");
  assert.ok(headerRowXml!.includes("シード"), "relocated header row must contain the event labels");
  // Rows 2..19 (1-indexed) must be blank reserved chart rows / spacer, not data.
  for (let r = 2; r < POLICY_HEADER_ROW_1INDEXED; r++) {
    const rowXml = rowsXml.find((x) => x.startsWith(`<row r="${r}"`));
    if (!rowXml) continue; // omitted empty rows are fine
    assert.ok(
      !/<is>/.test(rowXml) && !/<v>/.test(rowXml),
      `row ${r} must stay blank (reserved for the chart), found content: ${rowXml}`,
    );
  }
}

function xmlEscapeForChart(v: string) {
  return v.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

// --- Holder / event data and formulas appear correctly ----------------------

assert.ok(sheet2Xml.includes("設立"), "資本政策 sheet must include event labels");
assert.ok(sheet2Xml.includes("シード"), "資本政策 sheet must include event labels");
assert.ok(
  sheet2Xml.includes("テスト株式会社｜資本政策"),
  "資本政策 sheet title must include the project_name (not just 提出情報)",
);
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
assert.ok(sheet2Xml.includes("上限評価額: "), "資本政策 sheet must render the convertible cap amount");
assert.ok(sheet2Xml.includes("割引率: "), "資本政策 sheet must render the convertible discount");

// --- calculationBasis must render as a compact Japanese label, never the raw
// identifier, so it does not overflow across the ~124 event columns ----------

assert.ok(sheet2Xml.includes("算出方法"), "資本政策 sheet must include a calculation-basis row");
assert.ok(sheet2Xml.includes("手動"), "資本政策 sheet must render the manual calculation-basis label");
assert.ok(sheet2Xml.includes("評価額＋投資額"), "資本政策 sheet must render the valuation_and_investment calculation-basis label");
assert.ok(!sheet2Xml.includes("calculationBasis"), "資本政策 sheet must never leak the raw calculationBasis field name");
assert.ok(!sheet2Xml.includes("manual<"), "資本政策 sheet must never leak the raw 'manual' identifier");
for (const rawIdentifier of ["valuation_and_investment", "price_and_shares", "ownership_target"]) {
  assert.ok(!sheet2Xml.includes(rawIdentifier), `資本政策 sheet must never leak the raw calculationBasis identifier "${rawIdentifier}"`);
}

// --- New per-holder rows: event flow shares, paid amount, post issued shares,
// issued %, post FD shares, FD % --------------------------------------------

assert.ok(sheet2Xml.includes("イベント内株式移動数"), "資本政策 sheet must include per-holder event flow shares rows");
assert.ok(sheet2Xml.includes("イベント内払込・対価"), "資本政策 sheet must include per-holder paid amount rows");
assert.ok(sheet2Xml.includes("発行済比率"), "資本政策 sheet must include per-holder issued percentage rows");
assert.ok(sheet2Xml.includes("完全希薄化後株式数（累計）"), "資本政策 sheet must include per-holder post FD shares rows");
assert.ok(sheet2Xml.includes("完全希薄化後比率"), "資本政策 sheet must include per-holder FD percentage rows");

const sheet3Xml = strFromU8(files["xl/worksheets/sheet3.xml"]);
assert.ok(sheet3Xml.includes("VCキャピタル"), "投資家別 sheet must include investor rows");
assert.ok(sheet3Xml.includes("優先株式"), "投資家別 sheet must localize shareClass 'preferred' as 優先株式");
assert.ok(sheet3Xml.includes("普通株式"), "投資家別 sheet must localize shareClass 'common' as 普通株式");
assert.ok(sheet3Xml.includes("ストックオプション"), "投資家別 sheet must localize shareClass 'option' as ストックオプション");
assert.ok(sheet3Xml.includes("転換前証券"), "投資家別 sheet must localize shareClass 'convertible' as 転換前証券");
for (const rawShareClass of ["preferred", "common", "option", "convertible", "warrant"]) {
  assert.ok(!sheet3Xml.includes(rawShareClass), `投資家別 sheet must never leak the raw shareClass identifier "${rawShareClass}"`);
}

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
