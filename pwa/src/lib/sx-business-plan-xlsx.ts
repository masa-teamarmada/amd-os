import { strToU8, zipSync } from "fflate";
import {
  SX_BUSINESS_PLAN_PHASES,
  type SxBusinessPlanLane,
  type SxBusinessPlanPhase,
  type SxXrlTarget,
} from "./sx-business-plan.ts";

type CellValue = string | number | null | undefined;
type Cell = { value: CellValue; style?: number };
type Sheet = { name: string; rows: Cell[][]; widths: number[]; rowHeights?: Record<number, number> };

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

const LANE_LABELS: Record<SxBusinessPlanLane, string> = {
  business: "事業開発",
  technology: "技術開発",
  organization: "組織開発",
  funding: "資金調達",
};

const LANE_ORDER: SxBusinessPlanLane[] = ["business", "technology", "organization", "funding"];

function xml(value: CellValue) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

/** Excel formula/DDE injection must never be created from plan text. */
function neutralizeFormulaTrigger(text: string) {
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
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
  if (typeof cell.value === "number" && Number.isFinite(cell.value)) return `<c r="${ref}"${style}><v>${cell.value}</v></c>`;
  return `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${xml(neutralizeFormulaTrigger(String(cell.value)))}</t></is></c>`;
}

function sheetXml(sheet: Sheet) {
  const maxColumns = Math.max(1, ...sheet.rows.map((row) => row.length));
  const maxRows = Math.max(1, sheet.rows.length);
  const cols = sheet.widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join("");
  const rows = sheet.rows.map((row, rowIndex) => {
    const height = sheet.rowHeights?.[rowIndex + 1];
    const customHeight = height ? ` ht="${height}" customHeight="1"` : "";
    return `<row r="${rowIndex + 1}"${customHeight}>${row.map((cell, colIndex) => cellXml(cell, rowIndex, colIndex)).join("")}</row>`;
  }).join("");
  return `${XML_HEADER}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${colName(maxColumns - 1)}${maxRows}"/><sheetViews><sheetView workbookViewId="0"><pane xSplit="1" ySplit="2" topLeftCell="B3" activePane="bottomRight" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="18"/><cols>${cols}</cols><sheetData>${rows}</sheetData><pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>`;
}

function xrlText(target: SxXrlTarget, keys: Array<keyof SxXrlTarget> = ["trl", "brl", "grl", "srl", "hrl"]) {
  return keys.map((key) => `${key.toUpperCase()} ${target[key]}`).join(" / ");
}

function laneCell(phase: SxBusinessPlanPhase, laneKey: SxBusinessPlanLane) {
  const lane = phase.lanes[laneKey];
  return [
    `費用：${lane.costYen.toLocaleString("ja-JP")}円`,
    "活動：",
    ...lane.activities.map((activity) => `・${activity}`),
    `出口条件：${lane.exitGate}`,
    `到達XRL：${xrlText(phase.targetXrl, lane.xrlKeys)}`,
  ].join("\n");
}

function phaseMatrixSheet(phases: readonly SxBusinessPlanPhase[]): Sheet {
  const phaseColumns = phases.map((phase) => c(phase.label, 2));
  const rows: Cell[][] = [
    [c("フェーズマトリクス", 1), ...phases.map(() => c("", 1))],
    [c("開発レーン", 2), ...phaseColumns],
    [c("期間", 3), ...phases.map((phase) => c(phase.period, 4))],
    [c("フェーズ予算（円）", 3), ...phases.map((phase) => c(phase.budgetYen, 5))],
    [c("調達ラウンド", 3), ...phases.map((phase) => c(phase.openingRound, 4))],
    [c("資金源", 3), ...phases.map((phase) => c(phase.fundingSource, 4))],
    [c("到達XRL", 3), ...phases.map((phase) => c(xrlText(phase.targetXrl), 4))],
    [c("固定費バーン上限（月額・円）", 3), ...phases.map((phase) => c(phase.maxFixedBurnMonthlyYen, 5))],
    ...LANE_ORDER.map((laneKey) => [c(LANE_LABELS[laneKey], 6), ...phases.map((phase) => c(laneCell(phase, laneKey), 7))]),
  ];
  return {
    name: "フェーズマトリクス",
    rows,
    widths: [28, ...phases.map(() => 52)],
    rowHeights: {
      1: 26,
      ...Object.fromEntries(LANE_ORDER.map((_, index) => [9 + index, 150])),
    },
  };
}

function stylesXml() {
  return `${XML_HEADER}<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="#\,##0\&quot;円\&quot;;[Red]-#\,##0\&quot;円\&quot;"/></numFmts><fonts count="3"><font><sz val="10"/><name val="Yu Gothic"/><family val="2"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="14"/><name val="Yu Gothic"/></font><font><b/><color rgb="FF0F172A"/><sz val="10"/><name val="Yu Gothic"/></font></fonts><fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0F172A"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE2E8F0"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEEF2FF"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFCBD5E1"/></left><right style="thin"><color rgb="FFCBD5E1"/></right><top style="thin"><color rgb="FFCBD5E1"/></top><bottom style="thin"><color rgb="FFCBD5E1"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="8"><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment vertical="top"/></xf><xf numFmtId="0" fontId="2" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
}

export function createSxBusinessPlanPhaseMatrixXlsx(phases: readonly SxBusinessPlanPhase[] = SX_BUSINESS_PLAN_PHASES) {
  const sheet = phaseMatrixSheet(phases);
  const now = new Date().toISOString();
  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(`${XML_HEADER}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`),
    "_rels/.rels": strToU8(`${XML_HEADER}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`),
    "docProps/core.xml": strToU8(`${XML_HEADER}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>フェーズマトリクス</dc:title><dc:creator>AMD OS</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`),
    "docProps/app.xml": strToU8(`${XML_HEADER}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>AMD OS</Application><AppVersion>3.51</AppVersion></Properties>`),
    "xl/workbook.xml": strToU8(`${XML_HEADER}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets><sheet name="フェーズマトリクス" sheetId="1" r:id="rId1"/></sheets></workbook>`),
    "xl/_rels/workbook.xml.rels": strToU8(`${XML_HEADER}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
    "xl/styles.xml": strToU8(stylesXml()),
    "xl/worksheets/sheet1.xml": strToU8(sheetXml(sheet)),
  };
  return zipSync(files, { level: 6 });
}

export function downloadSxBusinessPlanPhaseMatrixXlsx(projectName: string) {
  const bytes = createSxBusinessPlanPhaseMatrixXlsx();
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${projectName.replace(/[\\/:*?"<>|]/g, "_")}_フェーズマトリクス.xlsx`;
  anchor.click();
  URL.revokeObjectURL(url);
}
