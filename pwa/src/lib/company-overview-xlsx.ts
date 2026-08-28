import { strToU8, zipSync } from "fflate";
import {
  HOLDER_LABELS,
  TRANSACTION_LABELS,
  buildCapTableSnapshots,
  buildCapitalPolicyTable,
  convertibleScenario,
  latestCapTable,
  type CapitalPolicyCell,
  type CompanyOverviewData,
} from "./company-overview.ts";

type CellValue = string | number | null | undefined;
type Cell = { value: CellValue; style?: number };
type Sheet = { name: string; rows: Cell[][]; widths: number[]; freezeRow?: number; autoFilter?: string };

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

function xml(value: CellValue) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
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

function cellXml(cell: Cell, rowIndex: number, columnIndex: number) {
  const ref = `${colName(columnIndex)}${rowIndex + 1}`;
  const style = cell.style == null ? "" : ` s="${cell.style}"`;
  if (cell.value == null || cell.value === "") return `<c r="${ref}"${style}/>`;
  if (typeof cell.value === "number" && Number.isFinite(cell.value)) {
    return `<c r="${ref}"${style}><v>${cell.value}</v></c>`;
  }
  return `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${xml(cell.value)}</t></is></c>`;
}

function sheetXml(sheet: Sheet) {
  const maxColumns = Math.max(1, ...sheet.rows.map((row) => row.length));
  const maxRows = Math.max(1, sheet.rows.length);
  const cols = sheet.widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join("");
  const rows = sheet.rows.map((row, rowIndex) => {
    const height = rowIndex === 0 ? ' ht="24" customHeight="1"' : "";
    return `<row r="${rowIndex + 1}"${height}>${row.map((cell, colIndex) => cellXml(cell, rowIndex, colIndex)).join("")}</row>`;
  }).join("");
  const pane = sheet.freezeRow
    ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${sheet.freezeRow}" topLeftCell="A${sheet.freezeRow + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
    : '<sheetViews><sheetView workbookViewId="0"/></sheetViews>';
  const autoFilter = sheet.autoFilter ? `<autoFilter ref="${sheet.autoFilter}"/>` : "";
  return `${XML_HEADER}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${colName(maxColumns - 1)}${maxRows}"/>${pane}<sheetFormatPr defaultRowHeight="18"/><cols>${cols}</cols><sheetData>${rows}</sheetData>${autoFilter}<pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>`;
}

function c(value: CellValue, style?: number): Cell {
  return { value, style };
}

function titleRow(title: string, columns: number) {
  return [c(title, 1), ...Array.from({ length: Math.max(0, columns - 1) }, () => c("", 1))];
}

function overviewSheet(projectName: string, data: CompanyOverviewData): Sheet {
  const profile = data.profile;
  const latest = latestCapTable(data);
  const tieOut = profile?.registered_issued_shares
    ? (latest?.outstandingShares || 0) - Number(profile.registered_issued_shares)
    : null;
  const rows: Cell[][] = [
    titleRow(`${projectName}｜会社概要`, 3),
    [c("項目", 2), c("内容", 2), c("確認元・注記", 2)],
    [c("法人状態"), c(profile?.legal_status === "incorporated" ? "設立済み" : "設立前")],
    [c("商号"), c(profile?.legal_name)],
    [c("英文商号"), c(profile?.legal_name_en)],
    [c("法人番号"), c(profile?.corporate_number)],
    [c("法人形態"), c(profile?.entity_type)],
    [c("設立日"), c(profile?.incorporated_on)],
    [c("本店所在地"), c(profile?.head_office)],
    [c("事業内容・目的"), c(profile?.business_purpose)],
    [c("代表者"), c(profile?.representative_name)],
    [c("資本金"), c(profile?.capital_yen, 4)],
    [c("発行可能株式総数"), c(profile?.authorized_shares, 3)],
    [c("登記上の発行済株式数"), c(profile?.registered_issued_shares, 3)],
    [c("台帳上の発行済株式数"), c(latest?.outstandingShares, 3)],
    [c("登記との差"), c(tieOut, 3), c(tieOut == null ? "登記株式数未入力" : Math.abs(tieOut) < 0.000001 ? "一致" : "要確認")],
    [c("機関設計"), c(profile?.board_structure)],
    [c("取締役会"), c(profile?.has_board == null ? null : profile.has_board ? "設置" : "非設置")],
    [c("監査役"), c(profile?.has_auditor == null ? null : profile.has_auditor ? "設置" : "非設置")],
    [c("決算月"), c(profile?.fiscal_year_end_month ? `${profile.fiscal_year_end_month}月` : null)],
    [c("公告方法"), c(profile?.public_notice_method)],
    [c("適格請求書発行事業者番号"), c(profile?.invoice_registration_number)],
    [c("確認日"), c(profile?.source_verified_on), c(profile?.source_ref)],
    [c("メモ"), c(profile?.notes)],
  ];
  return { name: "会社概要", rows, widths: [26, 48, 42], freezeRow: 2 };
}

function capTableSheet(projectName: string, data: CompanyOverviewData): Sheet {
  const latest = latestCapTable(data);
  const rows: Cell[][] = [
    titleRow(`${projectName}｜現在の cap table`, 8),
    [c("株主区分", 2), c("株主名", 2), c("証券種別", 2), c("発行済株式", 2), c("持株比率", 2), c("完全希薄化後株式", 2), c("完全希薄化後比率", 2), c("払込累計", 2)],
  ];
  for (const row of latest?.rows || []) {
    rows.push([
      c(HOLDER_LABELS[row.holderType] || row.holderType), c(row.holderName), c(row.securityClass),
      c(row.outstandingShares, 3), c(row.ownershipPct / 100, 5), c(row.dilutedShares, 3), c(row.dilutedPct / 100, 5), c(row.paidInYen, 4),
    ]);
  }
  if (latest) rows.push([c("合計", 2), c("", 2), c("", 2), c(latest.outstandingShares, 6), c(1, 7), c(latest.dilutedShares, 6), c(1, 7), c(latest.paidInYen, 8)]);
  return { name: "現在cap table", rows, widths: [17, 28, 20, 17, 14, 21, 19, 18], freezeRow: 2, autoFilter: `A2:H${Math.max(2, rows.length - 1)}` };
}

function transactionSheet(projectName: string, data: CompanyOverviewData): Sheet {
  const rows: Cell[][] = [
    titleRow(`${projectName}｜株式イベント台帳`, 11),
    [c("効力日", 2), c("状態", 2), c("イベント", 2), c("説明", 2), c("株主区分", 2), c("株主名", 2), c("証券種別", 2), c("発行済増減", 2), c("希薄化後増減", 2), c("払込増減", 2), c("確認元・メモ", 2)],
  ];
  for (const transaction of data.transactions) {
    const entries = transaction.project_equity_entries || [];
    for (const [index, entry] of entries.entries()) {
      rows.push([
        c(index === 0 ? transaction.effective_on : ""),
        c(index === 0 ? transaction.status : ""),
        c(index === 0 ? (TRANSACTION_LABELS[transaction.transaction_type] || transaction.transaction_type) : ""),
        c(index === 0 ? transaction.description : ""),
        c(HOLDER_LABELS[entry.holder_type || "other"] || entry.holder_type), c(entry.holder_name), c(entry.security_class),
        c(Number(entry.outstanding_delta), 3), c(Number(entry.diluted_delta), 3), c(Number(entry.paid_in_yen_delta), 4),
        c(index === 0 ? [transaction.source_ref, transaction.notes].filter(Boolean).join(" / ") : ""),
      ]);
    }
  }
  return { name: "株式イベント", rows, widths: [13, 11, 17, 26, 16, 24, 18, 16, 17, 17, 38], freezeRow: 2, autoFilter: `A2:K${Math.max(2, rows.length)}` };
}

function timelineSheet(projectName: string, data: CompanyOverviewData): Sheet {
  const snapshots = buildCapTableSnapshots(data);
  const holderNames: string[] = [];
  const seenHolderNames = new Set<string>();
  for (const snapshot of snapshots) {
    for (const row of snapshot.rows) {
      if (!seenHolderNames.has(row.holderName)) {
        seenHolderNames.add(row.holderName);
        holderNames.push(row.holderName);
      }
    }
  }
  const rows: Cell[][] = [
    titleRow(`${projectName}｜資本構成推移（グラフ元データ・株主別）`, 4 + holderNames.length),
    [c("効力日", 2), c("イベント", 2), c("発行済株式", 2), c("完全希薄化後株式", 2), ...holderNames.map((name) => c(`${name} 比率`, 2))],
  ];
  for (const snapshot of snapshots) {
    const byHolder = new Map<string, number>();
    for (const row of snapshot.rows) byHolder.set(row.holderName, (byHolder.get(row.holderName) || 0) + row.outstandingShares);
    rows.push([
      c(snapshot.effectiveOn), c(snapshot.label), c(snapshot.outstandingShares, 3), c(snapshot.dilutedShares, 3),
      ...holderNames.map((name) => c(snapshot.outstandingShares ? (byHolder.get(name) || 0) / snapshot.outstandingShares : 0, 5)),
    ]);
  }
  return { name: "資本構成推移", rows, widths: [13, 28, 17, 21, ...holderNames.map(() => 18)], freezeRow: 2, autoFilter: `A2:${colName(3 + holderNames.length)}${Math.max(2, rows.length)}` };
}

/**
 * 正式な資本政策表（横持ち）。画面の `CapitalPolicyTable` と同じ項目構成で、
 * ラウンドを列（1ラウンド = 7項目）、株主を行に並べる。
 * まさが実務で使っている cap table 雛形と読み方をそろえるためのシート。
 */
function capitalPolicySheet(projectName: string, data: CompanyOverviewData): Sheet {
  const table = buildCapitalPolicyTable(data);
  const metrics: { key: keyof CapitalPolicyCell; label: string; style: number }[] = [
    { key: "newShares", label: "新規割当分", style: 3 },
    { key: "shares", label: "発行済株数", style: 3 },
    { key: "paidInYen", label: "払込金額", style: 4 },
    { key: "ownershipPct", label: "顕在株比率", style: 5 },
    { key: "newOptions", label: "新規発行SO", style: 3 },
    { key: "options", label: "発行済SO", style: 3 },
    { key: "dilutedPct", label: "潜在込比率", style: 5 },
  ];
  const span = metrics.length;
  const width = 1 + table.columns.length * span;

  const cellFor = (cell: CapitalPolicyCell | undefined, metric: (typeof metrics)[number], headerStyle = false) => {
    if (!cell || !cell.present) return c("－");
    const raw = Number(cell[metric.key] ?? 0);
    const value = metric.style === 5 ? raw / 100 : raw;
    if (!headerStyle) return c(value, metric.style);
    return c(value, metric.style === 5 ? 7 : metric.style === 4 ? 8 : 6);
  };
  const groupRow = (label: string, values: (column: (typeof table.columns)[number]) => CellValue, style: number): Cell[] => [
    c(label),
    ...table.columns.flatMap((column) => [c(values(column), style), ...Array.from({ length: span - 1 }, () => c(""))]),
  ];

  const rows: Cell[][] = [
    titleRow(`${projectName}｜資本政策表`, width),
    [c("ラウンド", 2), ...table.columns.flatMap((column) => [c(column.roundLabel, 2), ...Array.from({ length: span - 1 }, () => c("", 2))])],
    [c("効力日 / 証券種別", 2), ...table.columns.flatMap((column) => [
      c([column.effectiveOn, column.shareClasses.join("・")].filter(Boolean).join(" / "), 2),
      ...Array.from({ length: span - 1 }, () => c("", 2)),
    ])],
    [c("株主", 2), ...table.columns.flatMap(() => metrics.map((metric) => c(metric.label, 2)))],
  ];

  for (const group of table.groups) {
    rows.push([c(group.label, 2), ...table.columns.flatMap(() => metrics.map(() => c("", 2)))]);
    for (const holderName of group.holderNames) {
      rows.push([
        c(holderName),
        ...table.columns.flatMap((column) => metrics.map((metric) => cellFor(column.cells[holderName], metric))),
      ]);
    }
    rows.push([
      c(`${group.label} 小計`, 2),
      ...table.columns.flatMap((column, columnIndex) => metrics.map((metric) => cellFor(group.subtotals[columnIndex], metric, true))),
    ]);
  }

  rows.push([
    c("合計", 2),
    ...table.columns.flatMap((column) => metrics.map((metric) => cellFor(column.total, metric, true))),
  ]);
  rows.push(groupRow("発行価額", (column) => column.pricePerShareYen, 4));
  rows.push(groupRow("調達金額", (column) => column.raisedYen, 4));
  rows.push(groupRow("累計調達金額", (column) => column.cumulativeRaisedYen, 4));
  rows.push(groupRow("プレ時価総額（顕在）", (column) => column.preMoneyYen, 4));
  rows.push(groupRow("ポスト時価総額（顕在）", (column) => column.postMoneyYen, 4));
  rows.push(groupRow("ポスト時価総額（潜在込）", (column) => column.postMoneyDilutedYen, 4));

  return {
    name: "資本政策表",
    rows,
    widths: [30, ...table.columns.flatMap(() => metrics.map(() => 15))],
    freezeRow: 4,
  };
}

function financingSheet(projectName: string, data: CompanyOverviewData): Sheet {
  const scenario = convertibleScenario(data);
  const rows: Cell[][] = [
    titleRow(`${projectName}｜調達ラウンド・転換前証券`, 9),
    [c("区分", 2), c("日付", 2), c("名称・保有者", 2), c("証券", 2), c("調達・元本", 2), c("pre / cap", 2), c("post", 2), c("単価・割引", 2), c("転換見込株式・注記", 2)],
  ];
  for (const round of data.rounds) {
    rows.push([c("ラウンド"), c(round.round_date || round.round_ym), c(round.round_name), c("株式"), c(round.raised_yen, 4), c(round.pre_money_yen, 4), c(round.post_money_yen, 4), c(round.price_per_share_yen, 4), c([round.lead_investor, round.notes].filter(Boolean).join(" / "))]);
  }
  for (const instrument of data.convertibles) {
    rows.push([
      c("転換前証券"), c(instrument.issued_on), c(instrument.holder_name), c(instrument.instrument_type), c(instrument.principal_yen, 4), c(instrument.valuation_cap_yen, 4), c(null),
      c(instrument.discount_rate == null ? instrument.estimated_conversion_price : instrument.discount_rate, instrument.discount_rate == null ? 4 : 5),
      c(`${instrument.estimated_conversion_shares?.toLocaleString() || "未算定"}株 / ${instrument.status}${instrument.notes ? ` / ${instrument.notes}` : ""}`),
    ]);
  }
  rows.push([c("参考", 2), c("", 2), c("転換見込合計", 2), c("", 2), c("", 2), c("", 2), c("", 2), c("", 2), c(scenario.estimatedShares, 6)]);
  return { name: "調達・潜在株式", rows, widths: [16, 13, 25, 18, 18, 18, 18, 18, 42], freezeRow: 2, autoFilter: `A2:I${Math.max(2, rows.length - 1)}` };
}

function financialSheet(projectName: string, data: CompanyOverviewData): Sheet {
  const rows: Cell[][] = [
    titleRow(`${projectName}｜年度決算`, 13),
    [c("年度", 2), c("期間", 2), c("状態", 2), c("売上高", 2), c("営業利益", 2), c("経常利益", 2), c("当期純利益", 2), c("総資産", 2), c("負債", 2), c("純資産", 2), c("現預金", 2), c("有利子負債", 2), c("申告日・確認元", 2)],
  ];
  for (const period of data.financialPeriods) {
    rows.push([
      c(period.fiscal_year, 3), c([period.period_start_on, period.period_end_on].filter(Boolean).join("〜")), c(period.statement_status),
      c(period.revenue_yen, 4), c(period.operating_income_yen, 4), c(period.ordinary_income_yen, 4), c(period.net_income_yen, 4),
      c(period.total_assets_yen, 4), c(period.total_liabilities_yen, 4), c(period.net_assets_yen, 4), c(period.cash_yen, 4), c(period.debt_yen, 4),
      c([period.filed_on, period.source_ref, period.notes].filter(Boolean).join(" / ")),
    ]);
  }
  return { name: "年度決算", rows, widths: [10, 24, 13, ...Array.from({ length: 9 }, () => 17), 38], freezeRow: 2, autoFilter: `A2:M${Math.max(2, rows.length)}` };
}

function stylesXml() {
  return `${XML_HEADER}<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0\&quot;円\&quot;;[Red]-#,##0\&quot;円\&quot;"/><numFmt numFmtId="165" formatCode="0.00%"/></numFmts><fonts count="3"><font><sz val="10"/><name val="Yu Gothic"/><family val="2"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="14"/><name val="Yu Gothic"/></font><font><b/><color rgb="FF0F172A"/><sz val="10"/><name val="Yu Gothic"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0F172A"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE2E8F0"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFCBD5E1"/></left><right style="thin"><color rgb="FFCBD5E1"/></right><top style="thin"><color rgb="FFCBD5E1"/></top><bottom style="thin"><color rgb="FFCBD5E1"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="9"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="3" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/><xf numFmtId="3" fontId="2" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/><xf numFmtId="165" fontId="2" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/><xf numFmtId="164" fontId="2" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
}

export function createCompanyOverviewXlsx(projectName: string, data: CompanyOverviewData) {
  const sheets = [
    overviewSheet(projectName, data),
    capTableSheet(projectName, data),
    transactionSheet(projectName, data),
    timelineSheet(projectName, data),
    capitalPolicySheet(projectName, data),
    financingSheet(projectName, data),
    financialSheet(projectName, data),
  ];
  const now = new Date().toISOString();
  const workbookSheets = sheets.map((sheet, index) => `<sheet name="${xml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("");
  const workbookRels = sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("");
  const contentSheets = sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("");
  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(`${XML_HEADER}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>${contentSheets}</Types>`),
    "_rels/.rels": strToU8(`${XML_HEADER}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`),
    "docProps/core.xml": strToU8(`${XML_HEADER}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xml(projectName)} 会社概要</dc:title><dc:creator>AMD OS</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`),
    "docProps/app.xml": strToU8(`${XML_HEADER}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>AMD OS</Application><AppVersion>3.43</AppVersion></Properties>`),
    "xl/workbook.xml": strToU8(`${XML_HEADER}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>${workbookSheets}</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`),
    "xl/_rels/workbook.xml.rels": strToU8(`${XML_HEADER}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${workbookRels}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
    "xl/styles.xml": strToU8(stylesXml()),
  };
  sheets.forEach((sheet, index) => { files[`xl/worksheets/sheet${index + 1}.xml`] = strToU8(sheetXml(sheet)); });
  return zipSync(files, { level: 6 });
}

export function downloadCompanyOverviewXlsx(projectName: string, data: CompanyOverviewData) {
  const bytes = createCompanyOverviewXlsx(projectName, data);
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${projectName.replace(/[\\/:*?"<>|]/g, "_")}_会社概要_cap-table.xlsx`;
  anchor.click();
  URL.revokeObjectURL(url);
}
