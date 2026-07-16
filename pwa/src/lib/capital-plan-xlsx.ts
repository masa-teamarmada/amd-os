// Frozen VC capital-plan Excel exporter.
// Input must be an already-frozen plan version (status "frozen", no blocking
// validation errors); this module never re-derives or re-validates a plan.

import { strToU8, zipSync } from "fflate";
import {
  type CalculationBasis,
  type CapitalEvent,
  type CapitalPlan,
  type EventAllocation,
  type Holder,
  type ShareClass,
  type ValidationIssue,
  type SourceOverrideEntry,
  collectSourceOverrides,
  hasBlockingErrors,
  recalculateCapTable,
  resolvedValue,
  type RoundSnapshot,
} from "./capital-plan.ts";

export interface FrozenCapitalPlanVersion {
  plan: CapitalPlan;
  plan_name: string;
  project_name?: string;
  version: number;
  source_revision: string;
  published_at: string;
  published_by: string;
  document_json: string;
  status: "frozen";
  validation: ValidationIssue[];
}

type CellValue = string | number | null | undefined;
type Cell = { value: CellValue; style?: number };
type Sheet = { name: string; rows: Cell[][]; widths: number[]; freezeRow?: number; freezeCol?: number; autoFilter?: string };

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

const EVENT_TYPE_LABELS: Record<CapitalEvent["type"], string> = {
  incorporation: "設立",
  equity_issue: "増資",
  option_pool: "オプションプール",
  convertible_issue: "転換前証券発行",
  convertible_conversion: "転換",
  secondary: "セカンダリ譲渡",
  share_split: "株式分割",
  ipo: "IPO",
};

const SOURCE_LABELS: Record<string, string> = {
  input: "入力",
  calculated: "計算",
  imported: "取込",
  confirmed: "確定",
  override: "上書き",
};

const EVENT_STATUS_LABELS: Record<string, string> = {
  confirmed: "確定",
  planned: "計画",
};

const CALCULATION_BASIS_LABELS: Record<CalculationBasis, string> = {
  valuation_and_investment: "評価額＋投資額",
  price_and_shares: "単価＋株数",
  ownership_target: "目標比率",
  manual: "手動",
};

const HOLDER_KIND_LABELS: Record<Holder["kind"], string> = {
  founder: "創業者",
  employee: "従業員",
  investor: "投資家",
  esop_pool: "ESOPプール",
  advisor: "アドバイザー",
  other: "その他",
};

const SHARE_CLASS_LABELS: Record<ShareClass, string> = {
  common: "普通株式",
  preferred: "優先株式",
  option: "ストックオプション",
  convertible: "転換前証券",
  warrant: "ワラント",
};

/** Blank rows reserved above the event-label header row so the native chart never overlays data (Excel rows 2-18, 1-indexed). */
const CHART_RESERVED_ROWS = 17;
/** Blank buffer row between the reserved chart rows and the event-label header row (Excel row 19). */
const CHART_SPACER_ROWS = 1;
/** 0-indexed xdr row where the chart drawing's top edge sits (Excel row 2). */
const CHART_ANCHOR_FROM_ROW = 1;
/** 0-indexed xdr row where the chart drawing's bottom edge sits (boundary before Excel row 19; chart spans Excel rows 2-18). */
const CHART_ANCHOR_TO_ROW = CHART_ANCHOR_FROM_ROW + CHART_RESERVED_ROWS;
/** Extra columns of margin added past the last event column when sizing the chart's right edge (room for the legend). */
const CHART_RIGHT_COL_MARGIN = 3;
/**
 * EMU per pixel at the 96 DPI Excel/OOXML drawings assume (914400 EMU/inch ÷ 96 px/inch).
 * xdr:colOff values are always expressed in EMU, so pixel measurements taken from a rendered
 * artifact must be converted through this constant before being written to the drawing XML.
 */
const EMU_PER_PIXEL = 9525;
/**
 * Rendered-artifact correction. Reviewer evidence from an actual Excel/LibreOffice render of
 * 資本政策.png (6 events) showed the native chart's bar centers sitting ~51px to the right of
 * the B:lastEventColumn header cells they are meant to plot above, even though the category
 * (event) spacing exactly matched the event-column width — i.e. the whole plot area was offset,
 * not the spacing. Shifting the entire two-cell anchor (both edges, same width) left by this
 * many pixels re-centers the bars over their event columns without touching category spacing.
 */
const CHART_HORIZONTAL_SHIFT_PX = 51;
/** Column A width in pixels (width 34 ≈ 272px). */
const COLUMN_A_WIDTH_PX = 272;
/** Default column width in pixels, used by the chart's right-margin columns. */
const DEFAULT_COLUMN_WIDTH_PX = 67;
/**
 * The anchor's left edge no longer starts at column B (col 1, offset 0). Column A is wide enough
 * that the leftward shift still lands inside it: col 0 (column A) at offset column-A width minus
 * the shift.
 */
const CHART_ANCHOR_FROM_COL = 0;
const CHART_ANCHOR_FROM_COL_OFFSET_PX = COLUMN_A_WIDTH_PX - CHART_HORIZONTAL_SHIFT_PX;
/**
 * The anchor's right edge moves one column left, from rightCol (offset 0) to rightCol-1. Margin
 * columns default to ~67px, so the same shift lands at offset default-column-width minus the
 * shift into that prior column — independent of rightCol/event count, since the shift is a
 * constant fraction of one column's width regardless of how many columns precede it.
 */
const CHART_ANCHOR_TO_COL_OFFSET_PX = DEFAULT_COLUMN_WIDTH_PX - CHART_HORIZONTAL_SHIFT_PX;
/** 0-indexed row of the event-label header row (title row + reserved chart rows + spacer row). */
const POLICY_HEADER_ROW_INDEX = 1 + CHART_RESERVED_ROWS + CHART_SPACER_ROWS;
/** Number of fixed metric rows (date..holder-section header) that follow the event-label header row before per-holder rows begin. */
const POLICY_METRIC_ROWS_AFTER_HEADER = 17;
/** 0-indexed row where the first per-holder row begins in 資本政策. */
const POLICY_FIXED_ROWS = POLICY_HEADER_ROW_INDEX + 1 + POLICY_METRIC_ROWS_AFTER_HEADER;
/** Number of rows emitted per holder in 資本政策 (flow shares, paid amount, post issued, issued%, post FD, FD%). */
const POLICY_ROWS_PER_HOLDER = 6;

// ---------------------------------------------------------------------------
// XML / injection safety helpers
// ---------------------------------------------------------------------------

function xml(value: CellValue) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

/** Neutralizes leading =, +, -, @, tab, CR — formula/DDE injection triggers in spreadsheet apps. */
function neutralizeFormulaTrigger(text: string): string {
  if (/^[=+\-@\t\r]/.test(text)) return `'${text}`;
  return text;
}

function colName(index: number) {
  let n = index + 1;
  let result = "";
  while (n > 0) {
    const remainder = (n - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

function c(value: CellValue, style?: number): Cell {
  return { value, style };
}

function cellXml(cell: Cell, rowIndex: number, columnIndex: number) {
  const ref = `${colName(columnIndex)}${rowIndex + 1}`;
  const style = cell.style == null ? "" : ` s="${cell.style}"`;
  if (cell.value == null || cell.value === "") return `<c r="${ref}"${style}/>`;
  if (typeof cell.value === "number" && Number.isFinite(cell.value)) {
    return `<c r="${ref}"${style}><v>${cell.value}</v></c>`;
  }
  const safe = neutralizeFormulaTrigger(String(cell.value));
  return `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${xml(safe)}</t></is></c>`;
}

function sheetXml(sheet: Sheet, drawingRelId?: string) {
  const maxColumns = Math.max(1, ...sheet.rows.map((row) => row.length));
  const maxRows = Math.max(1, sheet.rows.length);
  const cols = sheet.widths
    .map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`)
    .join("");
  const rows = sheet.rows
    .map((row, rowIndex) => {
      const height = rowIndex === 0 ? ' ht="24" customHeight="1"' : "";
      return `<row r="${rowIndex + 1}"${height}>${row.map((cell, colIndex) => cellXml(cell, rowIndex, colIndex)).join("")}</row>`;
    })
    .join("");

  let pane = '<sheetViews><sheetView workbookViewId="0"/></sheetViews>';
  if (sheet.freezeRow && sheet.freezeCol) {
    pane = `<sheetViews><sheetView workbookViewId="0"><pane xSplit="${sheet.freezeCol}" ySplit="${sheet.freezeRow}" topLeftCell="${colName(sheet.freezeCol)}${sheet.freezeRow + 1}" activePane="bottomRight" state="frozen"/></sheetView></sheetViews>`;
  } else if (sheet.freezeRow) {
    pane = `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${sheet.freezeRow}" topLeftCell="A${sheet.freezeRow + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`;
  } else if (sheet.freezeCol) {
    pane = `<sheetViews><sheetView workbookViewId="0"><pane xSplit="${sheet.freezeCol}" topLeftCell="${colName(sheet.freezeCol)}1" activePane="topRight" state="frozen"/></sheetView></sheetViews>`;
  }

  const autoFilter = sheet.autoFilter ? `<autoFilter ref="${sheet.autoFilter}"/>` : "";
  const drawing = drawingRelId ? `<drawing r:id="${drawingRelId}"/>` : "";
  const rNs = drawingRelId ? ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"' : "";
  return `${XML_HEADER}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"${rNs}><dimension ref="A1:${colName(maxColumns - 1)}${maxRows}"/>${pane}<sheetFormatPr defaultRowHeight="18"/><cols>${cols}</cols><sheetData>${rows}</sheetData>${autoFilter}<pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/>${drawing}</worksheet>`;
}

function titleRow(title: string, columns: number) {
  return [c(title, 1), ...Array.from({ length: Math.max(0, columns - 1) }, () => c("", 1))];
}

// ---------------------------------------------------------------------------
// Legend helpers
// ---------------------------------------------------------------------------

function sourceStyle(source: string | undefined): number {
  switch (source) {
    case "input":
      return 9;
    case "confirmed":
      return 10;
    case "calculated":
      return 11;
    case "override":
      return 12;
    default:
      return 0;
  }
}

// ---------------------------------------------------------------------------
// Sheet 1: 提出情報
// ---------------------------------------------------------------------------

function submissionInfoSheet(version: FrozenCapitalPlanVersion): Sheet {
  const errorCount = version.validation.filter((v) => v.severity === "error").length;
  const warningCount = version.validation.filter((v) => v.severity === "warning").length;
  const companyName = version.project_name ?? version.plan_name;
  const rows: Cell[][] = [
    titleRow(`${companyName}｜資本政策 提出情報`, 3),
    [c("項目", 2), c("内容", 2), c("注記", 2)],
    [c("会社名"), c(companyName)],
    [c("プラン名"), c(version.plan_name)],
    [c("プランID"), c(version.plan.id)],
    [c("凍結バージョン"), c(version.version, 3)],
    [c("ソースリビジョン"), c(version.source_revision)],
    [c("公開日時"), c(version.published_at)],
    [c("公開者"), c(version.published_by)],
    [c("ステータス"), c(version.status === "frozen" ? "凍結済み" : version.status)],
    [c("検証エラー件数"), c(errorCount, 3), c(errorCount > 0 ? "要確認" : "問題なし")],
    [c("検証警告件数"), c(warningCount, 3)],
    [c("", 2), ...Array.from({ length: 1 }, () => c("", 2))],
    [c("入力・確定・計算・上書き 凡例", 1), c("", 1), c("", 1)],
    [c("直接入力"), c("ユーザーが直接入力した値"), c("", 9)],
    [c("確定値"), c("確定済みとして扱う値"), c("", 10)],
    [c("自動計算"), c("エンジンが自動算出した値"), c("", 11)],
    [c("手動上書き"), c("自動算出値を手動で上書きした値（元の計算値を併記）"), c("", 12)],
    [c("", 2)],
    [
      c("丸め方針"),
      c(
        "株式数は整数のみを扱う。目標比率・単価から逆算する割当は最も近い整数に丸めて確定し、丸め前の生値はこの出力に保持・表示されない。整数でない割当は「fractional_shares」等の検証エラーとして扱われる。",
      ),
    ],
    [c("金額単位"), c("円")],
    [c("比率表示"), c("完全希薄化後ベースのパーセント表示")],
  ];
  return { name: "提出情報", rows, widths: [26, 46, 30], freezeRow: 2 };
}

// ---------------------------------------------------------------------------
// Sheet 2: 資本政策（イベントを列に、指標を行に）
// ---------------------------------------------------------------------------

function isDilutiveClass(shareClass: string): boolean {
  return shareClass === "option" || shareClass === "convertible" || shareClass === "warrant";
}

function conversionTermsText(event: CapitalEvent): string | null {
  if (event.type !== "convertible_issue" && event.type !== "convertible_conversion") return null;
  const parts: string[] = [];
  if (event.conversionCap) parts.push(`上限評価額: ${resolvedValue(event.conversionCap).toLocaleString("ja-JP")}円`);
  if (event.conversionDiscount) parts.push(`割引率: ${(resolvedValue(event.conversionDiscount) * 100).toFixed(2)}%`);
  return parts.length > 0 ? parts.join(" / ") : "（条件未設定）";
}

/**
 * Falls back to summing positive allocations when an event's newShares field
 * is absent, for event types where "new" shares are well-defined (incorporation,
 * option pool creation, convertible issuance). secondary and share_split move
 * or scale existing shares rather than issuing new ones, so they always report
 * zero/blank regardless of any positive allocation shares.
 */
function newFdSharesFallback(event: CapitalEvent): number | null {
  if (event.type === "secondary" || event.type === "share_split") return null;
  if (event.newShares) return resolvedValue(event.newShares);
  if (event.type === "incorporation" || event.type === "option_pool" || event.type === "convertible_issue") {
    return event.allocations
      .filter((a) => resolvedValue(a.shares) > 0)
      .reduce((sum, a) => sum + resolvedValue(a.shares), 0);
  }
  return null;
}

function capitalPolicySheet(plan: CapitalPlan, snapshots: RoundSnapshot[], holders: Holder[], companyName: string) {
  const events = [...plan.events].sort((a, b) => a.order - b.order);
  const snapshotByEvent = new Map(snapshots.map((s) => [s.eventId, s] as const));
  const holderName = new Map(holders.map((h) => [h.id, h.name] as const));

  const headerRow: Cell[] = [c("項目", 2), ...events.map((e) => c(e.label, 2))];
  const dateRow: Cell[] = [c("効力日"), ...events.map((e) => c(e.date ?? null))];
  const typeRow: Cell[] = [c("種類"), ...events.map((e) => c(EVENT_TYPE_LABELS[e.type] ?? e.type))];
  const eventStatusRow: Cell[] = [
    c("ステータス"),
    ...events.map((e) => c(EVENT_STATUS_LABELS[e.status ?? "confirmed"] ?? e.status ?? "確定")),
  ];
  const basisRow: Cell[] = [
    c("算出方法"),
    ...events.map((e) => c(CALCULATION_BASIS_LABELS[e.calculationBasis ?? "manual"] ?? e.calculationBasis ?? "手動")),
  ];
  const preRow: Cell[] = [c("プレマネー評価額（円）"), ...events.map((e) => c(e.preMoneyValuation ? resolvedValue(e.preMoneyValuation) : null, 4))];
  const postRow: Cell[] = [c("ポストマネー評価額（円）"), ...events.map((e) => c(e.postMoneyValuation ? resolvedValue(e.postMoneyValuation) : null, 4))];
  const priceRow: Cell[] = [c("1株価格（円）"), ...events.map((e) => c(e.pricePerShare ? resolvedValue(e.pricePerShare) : null, 4))];
  const raiseRow: Cell[] = [c("調達額（円）"), ...events.map((e) => c(e.primaryRaise ? resolvedValue(e.primaryRaise) : null, 4))];

  let cumulativeRaise = 0;
  const cumulativeRaiseRow: Cell[] = [c("累計調達額（円）")];
  for (const e of events) {
    cumulativeRaise += e.primaryRaise ? resolvedValue(e.primaryRaise) : 0;
    cumulativeRaiseRow.push(c(cumulativeRaise, 4));
  }

  const newIssuedSharesRow: Cell[] = [
    c("新規発行株式数（発行済分）"),
    ...events.map((e) =>
      c(
        e.type === "secondary"
          ? 0
          : e.allocations
              .filter((a) => !isDilutiveClass(a.shareClass) && resolvedValue(a.shares) > 0)
              .reduce((sum, a) => sum + resolvedValue(a.shares), 0),
        3,
      ),
    ),
  ];
  const newFdSharesRow: Cell[] = [
    c("新規発行株式数（完全希薄化後分）"),
    ...events.map((e) => c(newFdSharesFallback(e), 3)),
  ];
  const issuedRow: Cell[] = [
    c("発行済株式数（累計）"),
    ...events.map((e) => c(snapshotByEvent.get(e.id)?.totalIssuedShares ?? null, 3)),
  ];
  const fdRow: Cell[] = [
    c("完全希薄化後株式数（累計）"),
    ...events.map((e) => c(snapshotByEvent.get(e.id)?.totalFullyDilutedShares ?? null, 3)),
  ];
  const optionPoolRow: Cell[] = [
    c("オプションプールサイズ（株式数）"),
    ...events.map((e) => c(e.type === "option_pool" && e.poolSize ? resolvedValue(e.poolSize) : null, 3)),
  ];
  const splitRow: Cell[] = [
    c("株式分割比率"),
    ...events.map((e) => c(e.type === "share_split" && e.splitRatio ? resolvedValue(e.splitRatio) : null, 6)),
  ];
  const conversionTermsRow: Cell[] = [c("転換条件（上限評価額／割引率）"), ...events.map((e) => c(conversionTermsText(e)))];

  const holderIds: string[] = [];
  const seen = new Set<string>();
  for (const snap of snapshots) {
    for (const h of snap.holders) {
      if (!seen.has(h.holderId)) {
        seen.add(h.holderId);
        holderIds.push(h.holderId);
      }
    }
  }

  const holderSectionRow: Cell[] = [
    c("株主別 イベント内移動・累計発行済/完全希薄化後", 2),
    ...events.map(() => c("", 2)),
  ];
  const holderRows: Cell[][] = [];
  for (const holderId of holderIds) {
    const name = holderName.get(holderId) ?? holderId;
    const flowSharesRow: Cell[] = [c(`${name}｜イベント内株式移動数`)];
    const paidAmountRow: Cell[] = [c(`${name}｜イベント内払込・対価（円）`)];
    const postIssuedRow: Cell[] = [c(`${name}｜発行済株式数（累計）`)];
    const issuedPctRow: Cell[] = [c(`${name}｜発行済比率`)];
    const postFdRow: Cell[] = [c(`${name}｜完全希薄化後株式数（累計）`)];
    const fdPctRow: Cell[] = [c(`${name}｜完全希薄化後比率`)];

    for (const event of events) {
      const holderAllocs = event.allocations.filter((a) => a.holderId === holderId);
      const flowShares = holderAllocs.reduce((sum, a) => sum + resolvedValue(a.shares), 0);
      const paidAmount = holderAllocs.reduce((sum, a) => sum + (a.amount ? resolvedValue(a.amount) : 0), 0);
      flowSharesRow.push(c(holderAllocs.length > 0 ? flowShares : null, 3));
      paidAmountRow.push(c(holderAllocs.some((a) => a.amount) ? paidAmount : null, 4));

      const snap = snapshotByEvent.get(event.id);
      const standing = snap?.holders.find((h) => h.holderId === holderId);
      postIssuedRow.push(c(standing ? standing.issuedShares : null, 3));
      issuedPctRow.push(c(standing ? standing.issuedPercentage : null, 5));
      postFdRow.push(c(standing ? standing.fullyDilutedShares : null, 3));
      fdPctRow.push(c(standing ? standing.fullyDilutedPercentage : null, 5));
    }
    holderRows.push(flowSharesRow, paidAmountRow, postIssuedRow, issuedPctRow, postFdRow, fdPctRow);
  }

  const columns = events.length + 1;
  const reservedChartRows: Cell[][] = Array.from({ length: CHART_RESERVED_ROWS }, () =>
    Array.from({ length: columns }, () => c("")),
  );
  const spacerRows: Cell[][] = Array.from({ length: CHART_SPACER_ROWS }, () =>
    Array.from({ length: columns }, () => c("")),
  );

  const rows: Cell[][] = [
    titleRow(`${companyName}｜資本政策（イベント別サマリー）`, columns),
    ...reservedChartRows,
    ...spacerRows,
    headerRow,
    dateRow,
    typeRow,
    eventStatusRow,
    basisRow,
    preRow,
    postRow,
    priceRow,
    raiseRow,
    cumulativeRaiseRow,
    newIssuedSharesRow,
    newFdSharesRow,
    issuedRow,
    fdRow,
    optionPoolRow,
    splitRow,
    conversionTermsRow,
    holderSectionRow,
    ...holderRows,
  ];

  const sheet: Sheet = {
    name: "資本政策",
    rows,
    widths: [34, ...events.map(() => 16)],
    freezeRow: POLICY_HEADER_ROW_INDEX + 1,
    freezeCol: 1,
  };

  return { sheet, events, holderIds, holderName, snapshotByEvent, headerRowIndex: POLICY_HEADER_ROW_INDEX };
}

// ---------------------------------------------------------------------------
// Sheet 3: 投資家別
// ---------------------------------------------------------------------------

function allocationFlowType(event: CapitalEvent, alloc: EventAllocation): string {
  const shares = resolvedValue(alloc.shares);
  if (event.type === "secondary") {
    return shares < 0 ? "譲渡人（売り手）" : "譲受人（買い手）";
  }
  return shares < 0 ? "減少" : "新規発行";
}

function investorSheet(plan: CapitalPlan, holders: Holder[]): Sheet {
  const holderMap = new Map(holders.map((h) => [h.id, h] as const));
  const events = [...plan.events].sort((a, b) => a.order - b.order);
  const rows: Cell[][] = [
    titleRow("投資家別 割当明細", 11),
    [
      c("イベント", 2),
      c("ステータス", 2),
      c("株主", 2),
      c("区分", 2),
      c("移動区分", 2),
      c("証券種別", 2),
      c("投資額・対価（円）", 2),
      c("株式数", 2),
      c("1株価格（円）", 2),
      c("目標完全希薄化後比率", 2),
      c("ソース", 2),
    ],
  ];
  for (const event of events) {
    for (const alloc of event.allocations) {
      const holder = holderMap.get(alloc.holderId);
      rows.push([
        c(event.label),
        c(EVENT_STATUS_LABELS[event.status ?? "confirmed"] ?? event.status ?? "確定"),
        c(holder?.name ?? alloc.holderId),
        c(holder ? HOLDER_KIND_LABELS[holder.kind] ?? holder.kind : ""),
        c(allocationFlowType(event, alloc)),
        c(SHARE_CLASS_LABELS[alloc.shareClass] ?? alloc.shareClass),
        c(alloc.amount ? resolvedValue(alloc.amount) : null, 4),
        c(resolvedValue(alloc.shares), 3),
        c(alloc.pricePerShare ? resolvedValue(alloc.pricePerShare) : null, 4),
        c(alloc.targetOwnershipPercentage ? resolvedValue(alloc.targetOwnershipPercentage) : null, 5),
        c(SOURCE_LABELS[alloc.shares.source] ?? alloc.shares.source, sourceStyle(alloc.shares.source)),
      ]);
    }
  }
  return {
    name: "投資家別",
    rows,
    widths: [22, 12, 22, 12, 18, 14, 20, 16, 16, 18, 12],
    freezeRow: 2,
    autoFilter: `A2:K${Math.max(2, rows.length)}`,
  };
}

// ---------------------------------------------------------------------------
// Sheet 4: 潜在株式・譲渡
// ---------------------------------------------------------------------------

function potentialDilutionSheet(plan: CapitalPlan, holders: Holder[]): Sheet {
  const holderName = new Map(holders.map((h) => [h.id, h.name] as const));
  const events = [...plan.events]
    .sort((a, b) => a.order - b.order)
    .filter((e) =>
      e.type === "option_pool" ||
      e.type === "convertible_issue" ||
      e.type === "convertible_conversion" ||
      e.type === "secondary" ||
      e.type === "share_split",
    );
  const rows: Cell[][] = [
    titleRow("潜在株式・譲渡（オプションプール／転換前証券／転換／セカンダリ／分割）", 7),
    [c("イベント", 2), c("種類", 2), c("プールサイズ / 分割比率", 2), c("転換価格キャップ（円）", 2), c("転換ディスカウント", 2), c("株主・割当", 2), c("備考", 2)],
  ];
  for (const event of events) {
    const allocSummary = event.allocations
      .map((a) => `${holderName.get(a.holderId) ?? a.holderId}: ${resolvedValue(a.shares)}株`)
      .join(" / ");
    rows.push([
      c(event.label),
      c(EVENT_TYPE_LABELS[event.type] ?? event.type),
      c(
        event.type === "option_pool"
          ? event.poolSize
            ? resolvedValue(event.poolSize)
            : null
          : event.type === "share_split"
            ? event.splitRatio
              ? resolvedValue(event.splitRatio)
              : null
            : null,
        3,
      ),
      c(event.conversionCap ? resolvedValue(event.conversionCap) : null, 4),
      c(event.conversionDiscount ? resolvedValue(event.conversionDiscount) : null, 5),
      c(allocSummary),
      c(event.note ?? ""),
    ]);
  }
  return { name: "潜在株式・譲渡", rows, widths: [22, 18, 20, 20, 16, 46, 30], freezeRow: 2, autoFilter: `A2:G${Math.max(2, rows.length)}` };
}

// ---------------------------------------------------------------------------
// Sheet 5: 検算
// ---------------------------------------------------------------------------

function verificationSheet(plan: CapitalPlan, version: FrozenCapitalPlanVersion, snapshots: RoundSnapshot[]): Sheet {
  const overrides: SourceOverrideEntry[] = collectSourceOverrides(plan);
  const rows: Cell[][] = [
    titleRow("検算", 8),
    [c("検証チェック", 1), ...Array.from({ length: 7 }, () => c("", 1))],
    [c("重大度", 2), c("コード", 2), c("メッセージ", 2), c("イベントID", 2), c("株主ID", 2), c("", 2), c("", 2), c("", 2)],
  ];
  for (const issue of version.validation) {
    rows.push([
      c(issue.severity === "error" ? "エラー" : "警告"),
      c(issue.code),
      c(issue.message),
      c(issue.eventId ?? ""),
      c(issue.holderId ?? ""),
    ]);
  }
  if (version.validation.length === 0) {
    rows.push([c("検証済み。指摘事項なし。")]);
  }

  rows.push([c("手動上書き一覧", 1), ...Array.from({ length: 7 }, () => c("", 1))]);
  rows.push([c("イベント", 2), c("イベント名", 2), c("割当ID", 2), c("株主ID", 2), c("フィールド", 2), c("上書き値", 2), c("計算値", 2), c("備考", 2)]);
  for (const entry of overrides) {
    rows.push([
      c(entry.eventId),
      c(entry.eventLabel),
      c(entry.allocationId ?? ""),
      c(entry.holderId ?? ""),
      c(entry.field),
      c(entry.value, 3),
      c(entry.calculatedValue ?? null, 3),
      c(entry.note ?? ""),
    ]);
  }
  if (overrides.length === 0) {
    rows.push([c("上書きされた値はありません。")]);
  }

  rows.push([c("イベント別 合計検算", 1), ...Array.from({ length: 7 }, () => c("", 1))]);
  rows.push([c("イベント", 2), c("発行済合計", 2), c("完全希薄化後合計", 2), c("発行済比率合計", 2), c("完全希薄化後比率合計", 2), c("", 2), c("", 2), c("", 2)]);
  for (const snap of snapshots) {
    const issuedPctSum = snap.holders.reduce((sum, h) => sum + h.issuedPercentage, 0);
    const dilutedPctSum = snap.holders.reduce((sum, h) => sum + h.fullyDilutedPercentage, 0);
    rows.push([
      c(snap.eventLabel),
      c(snap.totalIssuedShares, 3),
      c(snap.totalFullyDilutedShares, 3),
      c(issuedPctSum, 5),
      c(dilutedPctSum, 5),
    ]);
  }

  return { name: "検算", rows, widths: [22, 24, 40, 20, 16, 14, 14, 30], freezeRow: 3 };
}

// ---------------------------------------------------------------------------
// Chart: native 100%-stacked vertical column chart, events on X axis,
// one series per holder, fed by fully diluted percentages.
// ---------------------------------------------------------------------------

function buildChartXml(
  sheetName: string,
  events: CapitalEvent[],
  holderIds: string[],
  holderRowIndex: Map<string, number>,
  headerRowIndex: number,
  holderName: Map<string, string>,
) {
  const numEvents = events.length;
  const headerRowNum = headerRowIndex + 1;
  const catRef = `'${sheetName}'!$B$${headerRowNum}:$${colName(numEvents)}$${headerRowNum}`;
  const series = holderIds
    .map((holderId, index) => {
      const rowIndex = holderRowIndex.get(holderId);
      if (rowIndex == null) return "";
      const rowNum = rowIndex + 1;
      const valRef = `'${sheetName}'!$B$${rowNum}:$${colName(numEvents)}$${rowNum}`;
      const name = holderName.get(holderId) ?? holderId;
      return `<c:ser><c:idx val="${index}"/><c:order val="${index}"/><c:tx><c:v>${xml(name)}</c:v></c:tx><c:cat><c:strRef><c:f>${xml(catRef)}</c:f></c:strRef></c:cat><c:val><c:numRef><c:f>${xml(valRef)}</c:f></c:numRef></c:val></c:ser>`;
    })
    .join("");

  return `${XML_HEADER}<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><c:chart><c:title><c:tx><c:rich><a:bodyPr/><a:p><a:r><a:t>資本構成推移（株主別 完全希薄化後比率）</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title><c:autoTitleDeleted val="0"/><c:plotArea><c:layout/><c:barChart><c:barDir val="col"/><c:grouping val="percentStacked"/><c:varyColors val="0"/>${series}<c:overlap val="100"/><c:axId val="111111111"/><c:axId val="222222222"/></c:barChart><c:catAx><c:axId val="111111111"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/><c:crossAx val="222222222"/></c:catAx><c:valAx><c:axId val="222222222"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="l"/><c:numFmt formatCode="0%" sourceLinked="0"/><c:crossAx val="111111111"/></c:valAx></c:plotArea><c:legend><c:legendPos val="r"/></c:legend><c:plotVisOnly val="1"/></c:chart></c:chartSpace>`;
}

function buildDrawingXml(numEvents: number) {
  const rightCol = numEvents + 1 + CHART_RIGHT_COL_MARGIN;
  const toCol = rightCol - 1;
  const fromColOffEmu = CHART_ANCHOR_FROM_COL_OFFSET_PX * EMU_PER_PIXEL;
  const toColOffEmu = CHART_ANCHOR_TO_COL_OFFSET_PX * EMU_PER_PIXEL;
  return `${XML_HEADER}<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><xdr:twoCellAnchor><xdr:from><xdr:col>${CHART_ANCHOR_FROM_COL}</xdr:col><xdr:colOff>${fromColOffEmu}</xdr:colOff><xdr:row>${CHART_ANCHOR_FROM_ROW}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>${toCol}</xdr:col><xdr:colOff>${toColOffEmu}</xdr:colOff><xdr:row>${CHART_ANCHOR_TO_ROW}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="2" name="資本構成推移グラフ"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId1"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor></xdr:wsDr>`;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

function stylesXml() {
  return `${XML_HEADER}<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0\&quot;円\&quot;;[Red]-#,##0\&quot;円\&quot;"/><numFmt numFmtId="165" formatCode="0.00%"/></numFmts><fonts count="3"><font><sz val="10"/><name val="Yu Gothic"/><family val="2"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="14"/><name val="Yu Gothic"/></font><font><b/><color rgb="FF0F172A"/><sz val="10"/><name val="Yu Gothic"/></font></fonts><fills count="8"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0F172A"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE2E8F0"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFDCFCE7"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFDBEAFE"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFEF9C3"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFEE2E2"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFCBD5E1"/></left><right style="thin"><color rgb="FFCBD5E1"/></right><top style="thin"><color rgb="FFCBD5E1"/></top><bottom style="thin"><color rgb="FFCBD5E1"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="13"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="3" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/><xf numFmtId="3" fontId="2" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/><xf numFmtId="165" fontId="2" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/><xf numFmtId="164" fontId="2" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/><xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyFill="1" applyBorder="1"/><xf numFmtId="0" fontId="0" fillId="5" borderId="1" xfId="0" applyFill="1" applyBorder="1"/><xf numFmtId="0" fontId="0" fillId="6" borderId="1" xfId="0" applyFill="1" applyBorder="1"/><xf numFmtId="0" fontId="0" fillId="7" borderId="1" xfId="0" applyFill="1" applyBorder="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function createCapitalPlanXlsx(version: FrozenCapitalPlanVersion): Uint8Array {
  if (!version || version.status !== "frozen") {
    throw new Error("資本政策のExcel出力には凍結済みバージョンが必要です。");
  }
  if (version.version == null || !Number.isFinite(version.version)) {
    throw new Error("凍結バージョン番号（version）が不正です。");
  }
  if (!version.source_revision) {
    throw new Error("ソースリビジョン（source_revision）が必要です。");
  }
  if (!version.published_at || !version.published_by) {
    throw new Error("公開日時（published_at）・公開者（published_by）が必要です。");
  }
  if (!version.document_json) {
    throw new Error("凍結ドキュメント本体（document_json）が必要です。");
  }
  if (!version.plan || !version.plan.id) {
    throw new Error("プラン（plan）が必要です。");
  }
  if (hasBlockingErrors(version.validation)) {
    throw new Error("検証エラーが残っているプランはExcel出力できません（先に解消してください）。");
  }

  const plan = version.plan;
  const snapshots = recalculateCapTable(plan);
  const companyName = version.project_name ?? version.plan_name;
  const { sheet: policySheet, events, holderIds, holderName, headerRowIndex } = capitalPolicySheet(
    plan,
    snapshots,
    plan.holders,
    companyName,
  );

  // Holder rows start right after the fixed metric rows + section header row
  // (see capitalPolicySheet layout: POLICY_FIXED_ROWS rows, 0-indexed, before holders begin).
  // Each holder occupies POLICY_ROWS_PER_HOLDER rows: flow shares, paid amount,
  // post issued shares, issued%, post FD shares, FD% (in that order).
  const fdRowIndex = new Map<string, number>();
  {
    let rowCursor = POLICY_FIXED_ROWS;
    for (const holderId of holderIds) {
      fdRowIndex.set(holderId, rowCursor + POLICY_ROWS_PER_HOLDER - 1); // FD% row is the last of the 6
      rowCursor += POLICY_ROWS_PER_HOLDER;
    }
  }

  const sheets: Sheet[] = [
    submissionInfoSheet(version),
    policySheet,
    investorSheet(plan, plan.holders),
    potentialDilutionSheet(plan, plan.holders),
    verificationSheet(plan, version, snapshots),
  ];

  const now = new Date().toISOString();
  const workbookSheets = sheets.map((sheet, index) => `<sheet name="${xml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("");
  const workbookRels = sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("");
  const contentSheets = sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("");

  const chartXml = buildChartXml(policySheet.name, events, holderIds, fdRowIndex, headerRowIndex, holderName);
  const drawingXml = buildDrawingXml(events.length);
  const policySheetIndex = 1; // 0-based index of 資本政策 sheet within `sheets`
  const policySheetFileIndex = policySheetIndex + 1; // 1-based file suffix

  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(
      `${XML_HEADER}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/><Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/><Override PartName="/xl/charts/chart1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>${contentSheets}</Types>`,
    ),
    "_rels/.rels": strToU8(
      `${XML_HEADER}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`,
    ),
    "docProps/core.xml": strToU8(
      `${XML_HEADER}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xml(version.plan_name)} 資本政策 v${version.version}</dc:title><dc:creator>AMD OS</dc:creator><dc:subject>${xml(version.source_revision)}</dc:subject><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`,
    ),
    "docProps/app.xml": strToU8(
      `${XML_HEADER}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>AMD OS</Application><AppVersion>capital-plan-v${version.version}</AppVersion></Properties>`,
    ),
    "xl/workbook.xml": strToU8(
      `${XML_HEADER}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>${workbookSheets}</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`,
    ),
    "xl/_rels/workbook.xml.rels": strToU8(
      `${XML_HEADER}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${workbookRels}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    ),
    "xl/styles.xml": strToU8(stylesXml()),
    "xl/drawings/drawing1.xml": strToU8(drawingXml),
    "xl/drawings/_rels/drawing1.xml.rels": strToU8(
      `${XML_HEADER}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart1.xml"/></Relationships>`,
    ),
    "xl/charts/chart1.xml": strToU8(chartXml),
  };

  sheets.forEach((sheet, index) => {
    const isPolicySheet = index === policySheetIndex;
    files[`xl/worksheets/sheet${index + 1}.xml`] = strToU8(sheetXml(sheet, isPolicySheet ? "rId1000" : undefined));
    if (isPolicySheet) {
      files[`xl/worksheets/_rels/sheet${policySheetFileIndex}.xml.rels`] = strToU8(
        `${XML_HEADER}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1000" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>`,
      );
    }
  });

  return zipSync(files, { level: 6 });
}
