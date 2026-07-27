"use client";

/**
 * 月次レポート印刷ビュー (A4 縦、クライアント提出版 AMD 標準フォーマット、v0.34.0)。
 *
 * 章立て (まさ 2026-06-22 でクライアント提出物としてスリム化):
 *   §01 表紙 (契約情報 / 入札情報 / AMD 契約番号。見積書番号は削除)
 *   §02 Exec Summary (Schedule/Risk の 2 軸 RAG、KPI、XRL 5軸現在値)
 *        — COST 軸 / XRL 前月比は削除
 *   §02 当月の進捗・成果 (本文 / MS進捗表 / 主要成果 / Decided / 採択・メディア)
 *        — 旧§03 当月の成果は §02 へ統合、サブブロックは A-E の色付きバッジで強調
 *   §02b マイルストーン Gantt
 *   §03 実施体制 (担当メンバーのみ。関連キーパーソンは削除)
 *   §04 次月計画 (重点アクション / 主要MTG予定)
 *   §05 添付資料 (PJ資料 / 契約書 / 改訂履歴。5生データ証跡は削除)
 *
 * クライアントから見えない AMD OS 内部固有名 (つくよみ/月次進捗モーダル/MTGページ/
 * 経営シグナル/コックピット/nudge等) は stripInternalJargon で印刷時にも除去する。
 *
 * Team ARMADA ブランド (Work Sans / Noto Sans JP / JetBrains Mono / dark #0a1628)。
 * @page A4 / margin 14mm。 共通ヘッダ・フッタ・改訂履歴。
 * PDF 化はブラウザの Cmd+P → 「PDFとして保存」。
 */

import { useMemo } from "react";

// ─── 型定義 ───────────────────────────────────────────────────────────────
interface MsRow {
  milestoneId: string; title: string; points: number; tag: string;
  periodStartYm: string | null; targetYm: string | null;
  successCriteria: string | null;
  progressPct: number; prevProgressPct: number; deltaPct: number;
  note: string | null; source: string | null;
}
interface ResponsibilityRow {
  milestoneId: string; memberId: string; codeName: string;
  role: string | null; share: number; taskDescription: string | null;
}
interface MeetingRow {
  meetingId: string; meetingDate: string; title: string;
  summaryShort: string; narrativeMd: string | null;
  decided: unknown[]; nextActions: unknown[]; risks: unknown[];
  notionUrl: string | null; sourceKinds: string | null;
}
interface SignalRow {
  signalId: string; signalType: string; title: string; summary: string;
  impactLevel: string; decisionState: string; signalDate: string | null;
  polarity: string | null; scoreImpactSummary: string | null;
}
interface MemberRow {
  memberId: string; codeName: string; role: string | null; roleLabel: string | null;
  isPm: boolean; isPl: boolean; isCloser: boolean;
  joinYm: string | null; leaveYm: string | null;
}
interface FoundingRow {
  personName: string; affiliation: string | null;
  role: string | null; roleLabelJp: string | null; category: string;
}
interface GrantRow {
  id: string; grantName: string; agency: string | null; grantType: string | null;
  amountYen: number; disbursedYen: number;
  periodStartYm: string | null; periodEndYm: string | null;
  adoptedDate: string | null; status: string | null;
}
interface MediaRow {
  id: string; occurredOn: string; title: string;
  mediaName: string; kind: string; sourceUrl: string | null;
}
interface XrlRow {
  id: string; observedAt: string;
  trl: number | null; brl: number | null; grl: number | null; srl: number | null; hrl: number | null;
  bottleneck: string | null; milestoneLabel: string | null; sourceNote: string | null;
}
interface ActionRow {
  actionId: string; scope: string; category: string | null;
  title: string; assignee: string | null;
  dueAt: string | null; status: string; priority: string | null;
}
interface ReimburseRow {
  reimbursementId: string; date: string; category: string;
  amount: number; taxRate: number; description: string | null;
  member: string | null; status: string;
}
interface AssetRow {
  meetingId?: string; documentId?: string; id?: string;
  fileName?: string; webViewLink: string | null;
  mimeType?: string; uploadedAt?: string; createdAt?: string;
  receivedAt?: string; documentKind?: string;
}
interface ContractInfo {
  contractId: string | null; title: string | null;
  counterparty: string | null; contractType: string | null;
  contractNo: string | null; quoteNo: string | null;
  bidNo: string | null; amdContractNo: string | null;
  periodStart: string | null; periodEnd: string | null;
  contractValueYen: number | null;
}
type Rag = "green" | "amber" | "red" | "n/a";

interface PrintData {
  generatedAt: string;
  project: {
    projectId: string; projectName: string;
    clientName: string | null; status: string;
    startYm: string | null; endYm: string | null;
    feeType: string | null; feeAmount: number | null;
  };
  ym: string; nextYm: string;
  template: string;
  isSubmission: boolean;
  submissionBody: string | null;
  submissionGeneratedAt: string | null;
  usingSubmissionFallback: boolean;
  report: {
    status: string; draftContent: string; finalContent: string;
    generatedAt: string | null; fixedAt: string | null;
    confirmedBy: string | null;
    plReviewRequestedAt: string | null; plReviewRequestedBy: string | null;
  } | null;
  monthlyNote: string;
  contract: ContractInfo;
  milestones: MsRow[];
  responsibilities: ResponsibilityRow[];
  overallPct: number;
  expectedPct: number | null;
  rag: { schedule: Rag; cost: Rag; risk: Rag };
  planCycle: {
    planCycleId: string; status: string;
    periodStartYm: string; periodEndYm: string;
    totalPoints: number; budgetYen: number;
  } | null;
  meetings: MeetingRow[];
  upcomingMeetings: Array<{ meetingId: string; meetingDate: string; title: string; summaryShort: string }>;
  signals: SignalRow[];
  achievementSignals: SignalRow[];
  riskSignals: SignalRow[];
  pivotSignals: SignalRow[];
  grants: GrantRow[];
  media: MediaRow[];
  xrlLog: XrlRow[];
  currentXrl: XrlRow | null;
  previousXrl: XrlRow | null;
  members: MemberRow[];
  founding: FoundingRow[];
  actionItems: ActionRow[];
  nextMonthActions: ActionRow[];
  reimbursements: ReimburseRow[];
  reimburseTotal: number;
  billing: {
    status: string; budgetYen: number; budgetReportedAmount: number;
    extraRevenueJson: unknown; extraBudgetYen: number | null;
    invoiceSentAt: string | null; paymentConfirmedAt: string | null;
  } | null;
  attachments: {
    meetingAssets: AssetRow[];
    projectDocs: AssetRow[];
    contractDocs: AssetRow[];
  };
  sourceCheck: Record<string, unknown> | null;
}

// ─── ユーティリティ ────────────────────────────────────────────────────
function formatYm(ym: string) {
  return `${ym.slice(0, 4)}年${parseInt(ym.slice(4, 6), 10)}月`;
}
function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" });
  } catch { return iso; }
}
function formatYen(n: number | null | undefined): string {
  if (!n || !Number.isFinite(n)) return "—";
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}
function ymToDate(ym: string | null): Date | null {
  if (!ym || ym.length < 6) return null;
  const y = parseInt(ym.slice(0, 4), 10);
  const m = parseInt(ym.slice(4, 6), 10);
  return new Date(y, m - 1, 1);
}
function impactBadge(level: string): { label: string; tone: string } {
  switch (level) {
    case "critical": return { label: "Critical", tone: "#b91c1c" };
    case "high": return { label: "High", tone: "#c2410c" };
    case "medium": return { label: "Medium", tone: "#a16207" };
    default: return { label: "Low", tone: "#475569" };
  }
}
function signalTypeLabel(t: string): string {
  const map: Record<string, string> = {
    risk: "リスク", opportunity: "機会", management_decision: "経営判断",
    strategic_pivot: "戦略転換", funding: "資金調達", next_move: "次の一手",
    business_progress: "事業進捗", commercial_progress: "商業進捗",
    partnership: "パートナーシップ", tech_progress: "技術進捗",
    ip_regulatory: "IP・規制", pipeline: "パイプライン",
    finance: "財務", policy: "ポリシー", market: "市場",
    talent: "人材", legal: "法務", other: "その他",
  };
  return map[t] || t;
}
function ragLabel(r: Rag): { label: string; color: string; bg: string } {
  if (r === "green") return { label: "GREEN", color: "#166534", bg: "#dcfce7" };
  if (r === "amber") return { label: "AMBER", color: "#92400e", bg: "#fef3c7" };
  if (r === "red") return { label: "RED", color: "#991b1b", bg: "#fee2e2" };
  return { label: "N/A", color: "#475569", bg: "#f1f5f9" };
}
function arrayToLines(value: unknown[]): string[] {
  return value.map((v) => {
    if (typeof v === "string") return v;
    if (v && typeof v === "object") {
      const obj = v as Record<string, unknown>;
      const text = (obj.text ?? obj.label ?? obj.body ?? obj.title ?? obj.content) as unknown;
      return typeof text === "string" ? text : JSON.stringify(v);
    }
    return String(v);
  }).filter((s) => s.trim().length > 0);
}

function splitMarkdownTableRow(line: string): string[] {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
}

function isMarkdownTableSeparator(line: string): boolean {
  const cells = splitMarkdownTableRow(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function MarkdownBlock({ text }: { text: string }) {
  if (!text) return null;
  const sanitized = stripInternalJargon(text);
  const lines = sanitized.split("\n");
  const blocks: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const nextLine = lines[i + 1] || "";

    if (line.includes("|") && isMarkdownTableSeparator(nextLine)) {
      const headers = splitMarkdownTableRow(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i]) && !isMarkdownTableSeparator(lines[i])) {
        rows.push(splitMarkdownTableRow(lines[i]));
        i += 1;
      }
      i -= 1;
      blocks.push(
        <div className="md-table-wrap" key={`table-${i}`}>
          <table className="md-table">
            <thead>
              <tr>{headers.map((header, cellIndex) => <th key={cellIndex}>{renderInline(header)}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {headers.map((_, cellIndex) => <td key={cellIndex}>{renderInline(row[cellIndex] || "")}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    if (line.startsWith("#### ")) blocks.push(<h4 key={i}>{line.slice(5)}</h4>);
    else if (line.startsWith("### ")) blocks.push(<h3 key={i}>{line.slice(4)}</h3>);
    else if (line.startsWith("## ")) blocks.push(<h2 key={i}>{line.slice(3)}</h2>);
    else if (line.startsWith("# ")) blocks.push(<h2 key={i}>{line.slice(2)}</h2>);
    else if (line.match(/^[-*] /)) blocks.push(<li key={i}>{renderInline(line.slice(2))}</li>);
    else if (line.startsWith("> ")) blocks.push(<blockquote key={i}>{line.slice(2)}</blockquote>);
    else if (line.trim() === "") blocks.push(<div key={i} style={{ height: "0.5em" }} />);
    else blocks.push(<p key={i}>{renderInline(line)}</p>);
  }

  return (
    <div className="md-body">
      {blocks}
    </div>
  );
}
function renderInline(text: string): React.ReactNode {
  const parts = text.split(/\*\*([^*]+)\*\*/g);
  return parts.map((p, i) => (i % 2 === 1 ? <strong key={i}>{p}</strong> : p));
}

// ─── 業務遂行レポート見出し文の自動生成 ─────────────────────────────────
function leadParagraph(data: PrintData): string {
  const { project, contract, ym } = data;
  const client = project.clientName || project.projectName;
  const subj = contract.title ? `「${contract.title}」` : `本業務 (${project.projectName})`;
  const periodPart = contract.periodStart && contract.periodEnd
    ? ` (履行期間: ${contract.periodStart} 〜 ${contract.periodEnd})`
    : "";
  return `本書は、${client}と株式会社チームアルマダの間で締結された ${subj}${periodPart} に基づき、${formatYm(ym)} 稼働分の業務遂行状況を報告するものである。`;
}

// XRL 5 軸メタ (和名と帯カラー)
function xrlAxisMeta(k: "trl" | "brl" | "grl" | "srl" | "hrl"): { label: string; color: string } {
  const map: Record<typeof k, { label: string; color: string }> = {
    trl: { label: "技術成熟度", color: "#0ea5e9" },
    brl: { label: "事業成熟度", color: "#7c3aed" },
    grl: { label: "ガバナンス", color: "#0d9488" },
    srl: { label: "社会受容", color: "#ea580c" },
    hrl: { label: "人材成熟度", color: "#db2777" },
  };
  return map[k];
}

// ─── 各章コンポーネント ───────────────────────────────────────────────
function CoverPage({ data }: { data: PrintData }) {
  const { project, contract, ym, report } = data;
  const isFinal = (report?.status === "fixed" || report?.status === "final") && !!report?.fixedAt;

  // 契約識別ライン (契約番号 / 入札番号 のうち入ってるものを並べる。見積書番号は対外報告には不要)
  const idItems: Array<{ label: string; value: string }> = [];
  if (contract.amdContractNo) idItems.push({ label: "AMD契約番号", value: contract.amdContractNo });
  if (contract.contractNo) idItems.push({ label: "契約番号", value: contract.contractNo });
  if (contract.bidNo) idItems.push({ label: "入札番号", value: contract.bidNo });

  return (
    <div className="sheet cover-sheet">
      <div className="cover">
        <div className="cover-head">
          <div className="brand-mark">TEAM <b>ARMADA</b> &nbsp;/&nbsp; MONTHLY REPORT</div>
          <div className="confid-band">取扱注意 / 関係者外秘</div>
        </div>

        <div className="cover-title-block">
          <div className="cover-eyebrow">REPORTING PERIOD</div>
          <div className="cover-ym">{formatYm(ym)}</div>
          <div className="cover-project">{contract.title || project.projectName}</div>
          <div className="cover-client">提出先: {project.clientName || "—"}</div>
        </div>

        {idItems.length > 0 && (
          <div className="contract-ids">
            {idItems.map((it, i) => (
              <div key={i} className="contract-id">
                <span className="lbl">{it.label}</span>
                <span className="val">{it.value}</span>
              </div>
            ))}
          </div>
        )}

        <div className="cover-foot">
          <div>
            <div className="brand-line">株式会社チームアルマダ Team ARMADA Inc.</div>
            <div className="brand-sub">提出元 / Document Owner: masa@team-armada.jp</div>
            {isFinal && (
              <div className="status-line">
                <span className="status-pill final">確定済 / Confirmed</span>
                {report?.fixedAt && <span className="status-meta"> 確定日: {formatDate(report.fixedAt)}</span>}
                {report?.confirmedBy && <span className="status-meta"> / 確定者: {report.confirmedBy}</span>}
              </div>
            )}
            {!isFinal && report?.generatedAt && (
              <div className="status-line">
                <span className="status-pill draft">ドラフト / Draft</span>
                <span className="status-meta"> 生成日: {formatDate(report.generatedAt)}</span>
              </div>
            )}
          </div>
          <div className="cover-meta">
            <div>提出日: {formatDate(data.generatedAt)}</div>
            <div className="cover-pjcode">{project.projectId.toUpperCase()}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionHead({ num, title, en }: { num: string; title: string; en: string }) {
  return (
    <div className="section-head">
      <span className="num">§{num}</span>
      <h2>{title}</h2>
      <span className="en">{en}</span>
    </div>
  );
}

function ExecSummary({ data }: { data: PrintData }) {
  const { overallPct, expectedPct, rag, milestones, meetings, currentXrl, previousXrl } = data;
  const lead = leadParagraph(data);
  const highlights = (() => {
    const lines: string[] = [];
    if (data.achievementSignals.length > 0) lines.push(`主要成果: ${data.achievementSignals[0].title}`);
    if (data.report?.finalContent || data.report?.draftContent) {
      const body = data.report.finalContent || data.report.draftContent;
      const firstPara = body.split(/\n\n/)[0].replace(/^#+\s*/, "");
      if (firstPara && firstPara.length < 200) lines.push(firstPara);
    }
    if (data.riskSignals.length > 0) lines.push(`要注意: ${data.riskSignals[0].title}`);
    return lines.slice(0, 3);
  })();
  const scheduleR = ragLabel(rag.schedule);
  const riskR = ragLabel(rag.risk);

  return (
    <div className="sheet">
      <div className="section">
        <SectionHead num="01" title="エグゼクティブサマリ" en="EXECUTIVE SUMMARY" />

        <p className="lead">{lead}</p>

        {highlights.length > 0 && (
          <div className="highlights">
            <div className="block-label">今月のハイライト</div>
            <ol className="hl-list">
              {highlights.map((h, i) => <li key={i}>{h}</li>)}
            </ol>
          </div>
        )}

        <div className="rag-grid rag-grid-2">
          <div className="rag-card" style={{ background: scheduleR.bg, color: scheduleR.color }}>
            <div className="rag-axis">SCHEDULE</div>
            <div className="rag-label">{scheduleR.label}</div>
            <div className="rag-meta">{overallPct}% (期待 {expectedPct ?? "—"}%)</div>
          </div>
          <div className="rag-card" style={{ background: riskR.bg, color: riskR.color }}>
            <div className="rag-axis">RISK</div>
            <div className="rag-label">{riskR.label}</div>
            <div className="rag-meta">高リスク {data.riskSignals.length} 件</div>
          </div>
        </div>

        <div className="kpi-grid">
          <Stat label="主要MS件数" value={`${milestones.length}`} />
          <Stat label="当月MTG件数" value={`${meetings.length}`} />
          <Stat label="当月成果シグナル" value={`${data.achievementSignals.length}`} />
        </div>

        {currentXrl && (
          <div className="xrl-summary">
            <div className="block-label">XRL 成熟度 (現在値)</div>
            <div className="xrl-grid">
              {(["trl", "brl", "grl", "srl", "hrl"] as const).map((k) => {
                const cur = (currentXrl as XrlRow | null)?.[k] ?? null;
                const meta = xrlAxisMeta(k);
                return (
                  <div key={k} className="xrl-card" style={{ borderTopColor: meta.color }}>
                    <div className="xrl-axis" style={{ color: meta.color }}>{k.toUpperCase()}</div>
                    <div className="xrl-axis-jp">{meta.label}</div>
                    <div className="xrl-value">{cur ?? "—"}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * MS リストから当月のレポートに載せるべきものだけを残す:
 * - 同一 milestoneId の重複は最初の 1 件のみ
 * - **同一タイトル (正規化後) の重複も dedup** = 別シーズンの同名 MS が並ばないように。
 *   period_start_ym が新しい (= 直近シーズン) を優先、同 period なら progress 高い方
 * - tag が "buffer" は除外 (= 内部調整枠)
 * - 完了済 (>= 100%) かつ動きなし (delta = 0) かつ target_ym が当月より前のものは除外
 */
function selectActiveMilestonesForReport(milestones: MsRow[], ym: string): MsRow[] {
  const normalizeTitle = (t: string) => t.replace(/[\s　]+/g, "").toLowerCase();
  const byId = new Set<string>();
  // pass 1: buffer / 古い完了済を除外し milestoneId dedup
  const stage1: MsRow[] = [];
  for (const m of milestones) {
    if (byId.has(m.milestoneId)) continue;
    byId.add(m.milestoneId);
    if ((m.tag || "").toLowerCase() === "buffer") continue;
    if (m.progressPct >= 100 && m.deltaPct === 0) {
      if (!m.targetYm || m.targetYm < ym) continue;
    }
    stage1.push(m);
  }
  // pass 2: タイトル正規化で dedup。直近シーズン (= period_start_ym 大) を優先、
  // 同点なら progress 高い方、それも同点なら points 大きい方
  const byTitle = new Map<string, MsRow>();
  for (const m of stage1) {
    const key = normalizeTitle(m.title);
    const prev = byTitle.get(key);
    if (!prev) { byTitle.set(key, m); continue; }
    const winsByPeriod = (m.periodStartYm || "") > (prev.periodStartYm || "");
    const samePeriod = (m.periodStartYm || "") === (prev.periodStartYm || "");
    const winsByProgress = samePeriod && m.progressPct > prev.progressPct;
    const winsByPoints = samePeriod && m.progressPct === prev.progressPct && m.points > prev.points;
    if (winsByPeriod || winsByProgress || winsByPoints) byTitle.set(key, m);
  }
  return Array.from(byTitle.values());
}

/**
 * クライアント提出物に出してはいけない AMD OS 内部固有名を中立表現へ置換 or 削除する。
 * - 「つくよみ」「月次進捗モーダル」「MTGページ」「経営シグナル」「nudge」「コックピット」等は
 *   OS 内部 UI / cron の呼称で、クライアントには存在しない
 * - 出典括弧書きは丸ごと削除、本文内の単独単語は中立表現に置換
 */
function stripInternalJargon(text: string): string {
  if (!text) return text;
  let out = text;
  // 1. 出典括弧書きの除去
  const sourceCitationPatterns = [
    /[（(](?:出典|根拠|引用|参照|source|ref)[:：][^）)]*?(?:つくよみ|月次進捗|MTGページ|MTG ページ|経営シグナル|nudge|コックピット|tsukuyomi|FRL)[^）)]*?[)）]/gi,
    /[（(](?:つくよみ|月次進捗モーダル|MTGページ|MTG ページ|経営シグナル|nudge|コックピット|tsukuyomi)[^）)]*?[)）]/gi,
  ];
  for (const re of sourceCitationPatterns) out = out.replace(re, "");
  // 2. 単独単語の中立表現置換
  const wordReplacements: Array<[RegExp, string]> = [
    [/つくよみレポート/g, "本報告"],
    [/つくよみ/g, "AMD"],
    [/月次進捗モーダル/g, "本月次レポート"],
    [/月次進捗の[モ]ーダル/g, "本月次レポート"],
    [/MTGページ/g, "会議記録"],
    [/MTG ページ/g, "会議記録"],
    [/経営シグナル/g, "事業上の動き"],
    [/H-1\s*next action/gi, "翌月の重点アクション"],
    [/コックピット画面/g, "管理画面"],
    [/コックピット/g, "管理画面"],
    [/nudge/gi, "リマインド"],
    [/eLAD/gi, "e-Rad"],
  ];
  for (const [re, repl] of wordReplacements) out = out.replace(re, repl);
  // 3. 連続空白・改行を整える
  out = out.replace(/[  ]+、/g, "、").replace(/[  ]+。/g, "。").replace(/\n{3,}/g, "\n\n");
  return out;
}

/**
 * 提出版 (internal 以外の template) — 章立て構造を持たず、body_md を単一の
 * 連続した文書として流し込む。ページ区切りを明示的に挿入しない (自然改頁のみ)。
 */
function SubmissionView({ data }: { data: PrintData }) {
  const { project, ym, submissionBody } = data;
  const printableBody = submissionBody?.replace(/^#\s+月次業務報告書\s*\n+/u, "") || null;
  return (
    <div className="sheet submission-sheet">
      <div className="submission-head">
        <div className="submission-title">月次業務報告書</div>
        <div className="submission-meta">
          {project.clientName || project.projectName} 御中 ／ {formatYm(ym)}
        </div>
      </div>
      {printableBody ? (
        <MarkdownBlock text={printableBody} />
      ) : (
        <div className="empty">提出用の報告書本文は未生成です。</div>
      )}
    </div>
  );
}

function ProgressSection({ data }: { data: PrintData }) {
  const { milestones, report, monthlyNote, achievementSignals, grants, media, meetings, ym } = data;
  const reportBody = report?.finalContent || report?.draftContent || monthlyNote || "";
  const activeMs = selectActiveMilestonesForReport(milestones, ym).sort((a, b) => b.points - a.points);

  // 会議由来の Decided (旧§03 から統合)
  const meetingDecisions: Array<{ src: string; date: string; text: string }> = [];
  for (const mtg of meetings) {
    for (const d of arrayToLines(mtg.decided)) {
      meetingDecisions.push({ src: mtg.title, date: mtg.meetingDate, text: stripInternalJargon(d) });
    }
  }
  // 当月採択された公募
  const currentYmGrants = grants.filter((g) => g.adoptedDate &&
    g.adoptedDate.slice(0, 7) === `${ym.slice(0, 4)}-${ym.slice(4, 6)}`);

  return (
    <div className="sheet">
      <div className="section">
        <SectionHead num="02" title="当月の進捗・成果" en="PROGRESS &amp; ACHIEVEMENTS" />

        {/* Block A: 業務遂行レポート本文 */}
        <div className="sub-head sub-head-progress">
          <span className="sub-num">A</span>
          <span className="sub-title">業務遂行レポート</span>
        </div>
        {reportBody ? (
          <div className="report-body">
            <MarkdownBlock text={reportBody} />
          </div>
        ) : (
          <div className="empty">月次報告書本文は未生成です。</div>
        )}

        {/* Block B: マイルストーン進捗 表 */}
        {activeMs.length > 0 && (
          <>
            <div className="sub-head sub-head-progress" style={{ marginTop: "7mm" }}>
              <span className="sub-num">B</span>
              <span className="sub-title">マイルストーン進捗 (計画 vs 実績)</span>
            </div>
            <table className="ms-table">
              <thead>
                <tr>
                  <th>マイルストーン</th>
                  <th>pt</th>
                  <th>期間</th>
                  <th>前月</th>
                  <th>当月</th>
                  <th>Δ</th>
                </tr>
              </thead>
              <tbody>
                {activeMs.map((m) => (
                  <tr key={m.milestoneId}>
                    <td>
                      <div className="ms-title">{m.title}</div>
                      {m.note && <div className="ms-note-cell">{stripInternalJargon(m.note)}</div>}
                    </td>
                    <td className="num-cell">{m.points}</td>
                    <td className="period-cell">
                      {m.periodStartYm && m.targetYm
                        ? `${m.periodStartYm.slice(0, 4)}.${m.periodStartYm.slice(4)} – ${m.targetYm.slice(0, 4)}.${m.targetYm.slice(4)}`
                        : "—"}
                    </td>
                    <td className="num-cell">{m.prevProgressPct}%</td>
                    <td className="num-cell" style={{ fontWeight: 700 }}>{m.progressPct}%</td>
                    <td className={`num-cell ${m.deltaPct > 0 ? "delta-up" : m.deltaPct < 0 ? "delta-dn" : ""}`}>
                      {m.deltaPct > 0 ? `+${m.deltaPct}` : m.deltaPct}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* Block C: 主要成果・進展 (旧§03) */}
        {achievementSignals.length > 0 && (
          <>
            <div className="sub-head sub-head-achieve" style={{ marginTop: "7mm" }}>
              <span className="sub-num">C</span>
              <span className="sub-title">主要成果・進展</span>
            </div>
            <div className="ach-block">
              {achievementSignals.map((s) => {
                const badge = impactBadge(s.impactLevel);
                return (
                  <div className="ach-card" key={s.signalId}>
                    <div className="ach-head">
                      <span className="polarity">{s.polarity}</span>
                      <span className="ach-type">{signalTypeLabel(s.signalType)}</span>
                      <span className="ach-impact" style={{ background: badge.tone }}>{badge.label}</span>
                      {s.signalDate && <span className="ach-date">{s.signalDate}</span>}
                    </div>
                    <div className="ach-title">{stripInternalJargon(s.title)}</div>
                    <div className="ach-summary">{stripInternalJargon(s.summary)}</div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Block D: 議論・打合せで固まった事項 */}
        {meetingDecisions.length > 0 && (
          <>
            <div className="sub-head sub-head-achieve" style={{ marginTop: "7mm" }}>
              <span className="sub-num">D</span>
              <span className="sub-title">議論・打合せで固まった事項</span>
            </div>
            <ul className="decision-list">
              {meetingDecisions.slice(0, 20).map((d, i) => (
                <li key={i}>
                  <span className="decision-text">{d.text}</span>
                  <span className="decision-src">({d.date} {d.src})</span>
                </li>
              ))}
            </ul>
          </>
        )}

        {/* Block E: 公募採択 / メディア掲載 */}
        {(currentYmGrants.length > 0 || media.length > 0) && (
          <>
            <div className="sub-head sub-head-achieve" style={{ marginTop: "7mm" }}>
              <span className="sub-num">E</span>
              <span className="sub-title">対外発信・採択</span>
            </div>
            {currentYmGrants.length > 0 && (
              <>
                <div className="mini-label">公募採択・補助金</div>
                <table className="grant-table">
                  <thead><tr><th>採択日</th><th>事業名</th><th>機関</th></tr></thead>
                  <tbody>
                    {currentYmGrants.map((g) => (
                      <tr key={g.id}>
                        <td>{g.adoptedDate}</td>
                        <td>{g.grantName}</td>
                        <td>{g.agency || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
            {media.length > 0 && (
              <>
                <div className="mini-label" style={{ marginTop: "4mm" }}>メディア掲載・対外発信</div>
                <ul className="media-list">
                  {media.map((m) => (
                    <li key={m.id}>
                      <span className="media-date">{m.occurredOn}</span>
                      <span className="media-name">{m.mediaName}</span>
                      <span className="media-title">{m.title}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function GanttSection({ data }: { data: PrintData }) {
  const { milestones, planCycle, ym } = data;
  if (!planCycle) return null;

  const planStart = ymToDate(planCycle.periodStartYm);
  const planEnd = ymToDate(planCycle.periodEndYm);
  const currentYm = ymToDate(ym);
  if (!planStart || !planEnd || !currentYm) return null;
  // 月数を 1-indexed で計算 (start ym 含む)
  const totalMonths = (planEnd.getFullYear() - planStart.getFullYear()) * 12 + (planEnd.getMonth() - planStart.getMonth()) + 1;
  if (totalMonths <= 0) return null;
  const currMonthIdx = (currentYm.getFullYear() - planStart.getFullYear()) * 12 + (currentYm.getMonth() - planStart.getMonth()) + 1;

  const width = 800;
  const leftLabel = 220;
  const rightPad = 16;
  const rowH = 18;
  const headH = 32;
  // §02 表と同じ dedup (milestoneId + タイトル正規化) を Gantt にも適用
  const deduped = selectActiveMilestonesForReport(milestones, ym);
  const sortedMs = deduped.sort((a, b) => {
    const ay = a.periodStartYm || "999999";
    const by = b.periodStartYm || "999999";
    return ay.localeCompare(by);
  });
  if (sortedMs.length === 0) return null;
  const chartW = width - leftLabel - rightPad;
  const colW = chartW / totalMonths;
  const height = headH + sortedMs.length * rowH + 16;

  // 月ラベル (隔月)
  const monthLabels: Array<{ x: number; label: string }> = [];
  for (let i = 0; i < totalMonths; i += 1) {
    const d = new Date(planStart.getFullYear(), planStart.getMonth() + i, 1);
    if (i % 2 === 0) {
      monthLabels.push({
        x: leftLabel + i * colW + colW / 2,
        label: `${String(d.getFullYear()).slice(2)}.${String(d.getMonth() + 1).padStart(2, "0")}`,
      });
    }
  }

  return (
    <div className="sheet">
      <div className="section">
        <SectionHead num="02b" title="マイルストーン Gantt" en="MILESTONE TIMELINE" />
        <div className="block-label" style={{ marginBottom: "3mm" }}>
          計画期間 {planCycle.periodStartYm.slice(0, 4)}.{planCycle.periodStartYm.slice(4)} – {planCycle.periodEndYm.slice(0, 4)}.{planCycle.periodEndYm.slice(4)} / 当月 = {ym.slice(0, 4)}.{ym.slice(4)}
        </div>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto" }}>
          {/* 背景縦線 (月の罫線) */}
          {Array.from({ length: totalMonths + 1 }).map((_, i) => (
            <line key={i} x1={leftLabel + i * colW} y1={headH} x2={leftLabel + i * colW} y2={height - 8}
              stroke="#e2e8f0" strokeWidth={i % 6 === 0 ? 0.8 : 0.4} />
          ))}
          {/* 月ラベル */}
          {monthLabels.map((l, i) => (
            <text key={i} x={l.x} y={headH - 12} fontSize="7" fill="#64748b"
              textAnchor="middle" fontFamily="JetBrains Mono, monospace">
              {l.label}
            </text>
          ))}
          {/* 現在月マーカー (赤縦線) */}
          {currMonthIdx > 0 && currMonthIdx <= totalMonths && (
            <line x1={leftLabel + currMonthIdx * colW - colW / 2} y1={headH - 4} x2={leftLabel + currMonthIdx * colW - colW / 2} y2={height - 8}
              stroke="#dc2626" strokeWidth={1.2} strokeDasharray="3 2" />
          )}

          {/* MS bars */}
          {sortedMs.map((m, i) => {
            const y = headH + i * rowH;
            const startD = ymToDate(m.periodStartYm);
            const endD = ymToDate(m.targetYm);
            if (!startD || !endD) {
              return (
                <g key={m.milestoneId}>
                  <text x={4} y={y + rowH / 2 + 3} fontSize="8" fill="#0f172a">{trimText(m.title, 30)}</text>
                  <text x={leftLabel + 4} y={y + rowH / 2 + 3} fontSize="7" fill="#94a3b8" fontStyle="italic">期間未設定</text>
                </g>
              );
            }
            const sIdx = (startD.getFullYear() - planStart.getFullYear()) * 12 + (startD.getMonth() - planStart.getMonth());
            const eIdx = (endD.getFullYear() - planStart.getFullYear()) * 12 + (endD.getMonth() - planStart.getMonth()) + 1;
            const barX = leftLabel + Math.max(0, sIdx) * colW;
            const barEnd = leftLabel + Math.min(totalMonths, eIdx) * colW;
            const barW = Math.max(2, barEnd - barX);
            const fillW = barW * (m.progressPct / 100);
            return (
              <g key={m.milestoneId}>
                <text x={4} y={y + rowH / 2 + 3} fontSize="8" fill="#0f172a">{trimText(m.title, 30)}</text>
                <rect x={barX} y={y + 3} width={barW} height={rowH - 6}
                  fill="#e2e8f0" stroke="#94a3b8" strokeWidth="0.6" />
                <rect x={barX} y={y + 3} width={fillW} height={rowH - 6}
                  fill="#0a1628" />
                <text x={barEnd + 4} y={y + rowH / 2 + 3} fontSize="7"
                  fill="#475569" fontFamily="JetBrains Mono, monospace">
                  {m.progressPct}%
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function trimText(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

// v0.34.0: AchievementsSection (旧§03) は ProgressSection (§02) に統合し削除 (まさ 2026-06-22)。

function TeamSection({ data }: { data: PrintData }) {
  const { members, responsibilities, milestones } = data;
  if (members.length === 0) return null;

  const msTitleMap = new Map(milestones.map((m) => [m.milestoneId, m.title]));
  // メンバーごとに責任 MS をまとめる。share=0 (= 関与なし) の MS は除外
  const respByMember = new Map<string, Array<{ msTitle: string; share: number; role: string | null; taskDescription: string | null }>>();
  for (const r of responsibilities) {
    if (!(r.share > 0)) continue;
    const title = msTitleMap.get(r.milestoneId);
    if (!title) continue;
    const list = respByMember.get(r.memberId) || [];
    list.push({ msTitle: title, share: r.share, role: r.role, taskDescription: r.taskDescription });
    respByMember.set(r.memberId, list);
  }
  // share 大きい順にソートして見やすく
  for (const list of respByMember.values()) list.sort((a, b) => b.share - a.share);

  return (
    <div className="sheet">
      <div className="section">
        <SectionHead num="03" title="実施体制" en="PROJECT TEAM" />

        {members.length > 0 && (
          <>
            <div className="block-label">担当メンバー</div>
            <table className="team-table">
              <thead><tr><th>氏名</th><th>役割</th><th>主な担当MS / 業務内容</th></tr></thead>
              <tbody>
                {members.map((m) => {
                  const resp = respByMember.get(m.memberId) || [];
                  return (
                    <tr key={m.memberId}>
                      <td>
                        <div className="team-name">{m.codeName}</div>
                        <div className="team-tags">
                          {m.isPm && <span className="team-tag">PM</span>}
                          {m.isPl && <span className="team-tag">PL</span>}
                        </div>
                      </td>
                      <td>{m.roleLabel || m.role || "—"}</td>
                      <td>
                        {resp.length > 0 ? (
                          <ul className="resp-list">
                            {resp.slice(0, 4).map((r, i) => (
                              <li key={i}>
                                <span className="resp-ms">{r.msTitle}</span>
                                {r.share > 0 && <span className="resp-share"> ({Math.round(r.share * 100)}%)</span>}
                                {r.taskDescription && <div className="resp-task">{r.taskDescription}</div>}
                              </li>
                            ))}
                          </ul>
                        ) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}

      </div>
    </div>
  );
}

// v0.33.0: 財務サマリは削除 (まさ 2026-06-22)。
// v0.34.0: 課題・リスク (§05) は削除 (まさ 2026-06-22)。クライアント提出物にリスク台帳は不要。

function NextMonthSection({ data }: { data: PrintData }) {
  const { nextMonthActions, upcomingMeetings, nextYm } = data;
  if (nextMonthActions.length === 0 && upcomingMeetings.length === 0) return null;
  return (
    <div className="sheet">
      <div className="section">
        <SectionHead num="04" title="次月計画" en="NEXT MONTH PLAN" />
        <div className="block-label">{formatYm(nextYm)} の重点アクション</div>
        {nextMonthActions.length > 0 ? (
          <table className="action-table">
            <thead><tr><th>期日</th><th>内容</th><th>担当</th><th>優先度</th></tr></thead>
            <tbody>
              {nextMonthActions.map((a) => (
                <tr key={a.actionId}>
                  <td className="num-cell">{a.dueAt ? a.dueAt.slice(0, 10) : "—"}</td>
                  <td>{a.title}</td>
                  <td>{a.assignee || "—"}</td>
                  <td className="num-cell">{a.priority || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="empty-small">期日付きの予定アクションは登録されていません。</p>}

        {upcomingMeetings.length > 0 && (
          <>
            <div className="block-label" style={{ marginTop: "5mm" }}>{formatYm(nextYm)} の主要会議予定</div>
            <ul className="upcoming-list">
              {upcomingMeetings.map((m) => (
                <li key={m.meetingId}>
                  <span className="upcoming-date">{m.meetingDate}</span>
                  <span className="upcoming-title">{m.title}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

function AppendixSection({ data }: { data: PrintData }) {
  const { attachments } = data;
  // v0.33.0: 会議資料 (meetingAssets) は添付から外す (まさ 2026-06-22)。
  // v0.34.0: 5生データ ソース証跡 (sourceCheck) は削除 (まさ 2026-06-22)。クライアント提出物に OS 内部参照は不要。
  const hasAny = attachments.projectDocs.length > 0 || attachments.contractDocs.length > 0;
  if (!hasAny) return null;
  return (
    <div className="sheet">
      <div className="section">
        <SectionHead num="05" title="添付資料・参照" en="APPENDIX" />

        {attachments.projectDocs.length > 0 && (
          <>
            <div className="block-label" style={{ marginTop: "4mm" }}>当月PJ資料</div>
            <ul className="attach-list">
              {attachments.projectDocs.slice(0, 20).map((a, i) => (
                <li key={i}>
                  {a.webViewLink ? <a href={a.webViewLink}>{a.fileName}</a> : a.fileName}
                </li>
              ))}
            </ul>
          </>
        )}

        {attachments.contractDocs.length > 0 && (
          <>
            <div className="block-label" style={{ marginTop: "4mm" }}>契約書</div>
            <ul className="attach-list">
              {attachments.contractDocs.slice(0, 10).map((a, i) => (
                <li key={i}>
                  {a.webViewLink ? <a href={a.webViewLink}>{a.fileName}</a> : a.fileName}
                  {a.documentKind && <span className="attach-kind"> ({a.documentKind})</span>}
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="rev-history">
          <div className="block-label" style={{ marginTop: "5mm" }}>改訂履歴</div>
          <table className="rev-table">
            <thead><tr><th>版</th><th>日付</th><th>変更者</th><th>状態</th></tr></thead>
            <tbody>
              {data.report?.generatedAt && (
                <tr>
                  <td>初版</td>
                  <td>{formatDate(data.report.generatedAt)}</td>
                  <td>AMD OS (自動生成)</td>
                  <td>Draft</td>
                </tr>
              )}
              {data.report?.fixedAt && (
                <tr>
                  <td>確定</td>
                  <td>{formatDate(data.report.fixedAt)}</td>
                  <td>{data.report.confirmedBy || "—"}</td>
                  <td>Final</td>
                </tr>
              )}
              <tr>
                <td>本書発行</td>
                <td>{formatDate(data.generatedAt)}</td>
                <td>株式会社チームアルマダ</td>
                <td>Issued</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="end-mark">— END OF REPORT —</div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="kpi-stat">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
    </div>
  );
}

// ─── メインビュー ──────────────────────────────────────────────────────
export function MonthlyReportPrintClient({ data }: { data: PrintData }) {
  const headerLabel = useMemo(() => {
    const client = data.project.clientName || "—";
    return `${client} / 月次報告 ${formatYm(data.ym)}`;
  }, [data]);

  return (
    <>
      <style jsx global>{`
        @page {
          size: A4 portrait; margin: 14mm 14mm 18mm 14mm;
          @top-left { content: "${headerLabel}"; font-family: 'Noto Sans JP', sans-serif; font-size: 8pt; color: #475569; }
          @top-right { content: "取扱注意 / Confidential"; font-family: 'Work Sans', sans-serif; font-size: 8pt; color: #b91c1c; letter-spacing: 0.1em; }
          @bottom-left { content: "© 2026 Team ARMADA Inc."; font-family: 'Work Sans', sans-serif; font-size: 8pt; color: #64748b; }
          @bottom-center { content: counter(page) " / " counter(pages); font-family: 'JetBrains Mono', monospace; font-size: 8pt; color: #64748b; }
        }
        @media print {
          .no-print { display: none !important; }
          .print-root { background: white !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        .print-root {
          font-family: 'Noto Sans JP', system-ui, sans-serif;
          color: #0f172a; background: #f1f5f9; min-height: 100vh;
        }
        .toolbar {
          position: sticky; top: 0; z-index: 10;
          background: #0a1628; color: #f1f5f9;
          padding: 10px 16px; display: flex; gap: 12px; align-items: center;
          font-size: 13px; box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        }
        .toolbar button {
          background: #f1f5f9; color: #0a1628; padding: 6px 14px;
          border-radius: 4px; border: 0; font-weight: 600; cursor: pointer;
          font-family: 'Work Sans', sans-serif; letter-spacing: 0.04em;
        }
        .toolbar .hint { color: #94a3b8; }
        .sheet {
          width: 210mm; min-height: 297mm; margin: 16px auto;
          padding: 18mm 16mm 22mm 16mm; background: white;
          box-shadow: 0 4px 24px rgba(0,0,0,0.08);
          box-sizing: border-box;
          font-size: 10.5pt; line-height: 1.7;
        }
        @media print {
          .sheet { margin: 0; box-shadow: none; padding: 0; width: auto; min-height: auto; page-break-after: always; }
          .sheet:last-child { page-break-after: auto; }
        }
        /* ===== 表紙 ===== */
        .cover-sheet { padding: 18mm; }
        .cover { display: flex; flex-direction: column; height: calc(297mm - 36mm); }
        .cover-head {
          display: flex; justify-content: space-between; align-items: center;
          border-bottom: 2px solid #0a1628; padding-bottom: 10mm;
        }
        .brand-mark { font-family: 'Work Sans', sans-serif; letter-spacing: 0.22em; font-size: 9pt; color: #64748b; text-transform: uppercase; }
        .brand-mark b { color: #0a1628; font-weight: 700; }
        .confid-band {
          background: #b91c1c; color: white; padding: 3px 12px;
          font-family: 'Work Sans', sans-serif; font-size: 8pt;
          letter-spacing: 0.16em; text-transform: uppercase;
        }
        .cover-title-block { margin-top: 22mm; }
        .cover-eyebrow { font-family: 'JetBrains Mono', monospace; font-size: 9pt; letter-spacing: 0.18em; color: #475569; text-transform: uppercase; }
        .cover-ym { font-family: 'Work Sans', sans-serif; font-weight: 300; font-size: 64pt; line-height: 1; margin: 6mm 0 4mm; color: #0a1628; letter-spacing: -0.02em; }
        .cover-project { font-size: 22pt; font-weight: 700; color: #0a1628; margin-top: 4mm; letter-spacing: -0.01em; line-height: 1.3; }
        .cover-client { font-size: 13pt; color: #475569; margin-top: 4mm; }
        .contract-ids {
          margin-top: 14mm; display: flex; flex-wrap: wrap; gap: 4mm;
          padding: 6mm 8mm; border: 1px solid #cbd5e1; background: #f8fafc;
        }
        .contract-id { display: flex; flex-direction: column; min-width: 32mm; }
        .contract-id .lbl { font-family: 'Work Sans', sans-serif; font-size: 8pt; color: #64748b; letter-spacing: 0.1em; text-transform: uppercase; }
        .contract-id .val { font-family: 'JetBrains Mono', monospace; font-size: 11pt; color: #0a1628; font-weight: 600; margin-top: 1mm; }
        .cover-foot { margin-top: auto; display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px solid #cbd5e1; padding-top: 6mm; }
        .brand-line { font-weight: 700; color: #0a1628; font-size: 12pt; }
        .brand-sub { font-size: 9pt; color: #64748b; margin-top: 1mm; }
        .status-line { margin-top: 4mm; }
        .status-pill { display: inline-block; padding: 2px 10px; border-radius: 999px; font-family: 'Work Sans', sans-serif; font-size: 8pt; letter-spacing: 0.1em; text-transform: uppercase; }
        .status-pill.final { background: #dcfce7; color: #166534; }
        .status-pill.draft { background: #fef3c7; color: #92400e; }
        .status-meta { font-size: 9pt; color: #64748b; }
        .cover-meta { text-align: right; font-family: 'JetBrains Mono', monospace; font-size: 9pt; color: #64748b; }
        .cover-pjcode { font-size: 16pt; color: #0a1628; font-weight: 700; margin-top: 2mm; }

        /* ===== 各章共通 ===== */
        .section-head {
          display: flex; align-items: baseline; gap: 12px;
          border-bottom: 1.5px solid #0a1628; padding-bottom: 4mm; margin-bottom: 6mm;
        }
        .section-head .num { font-family: 'JetBrains Mono', monospace; font-size: 10pt; color: #64748b; letter-spacing: 0.1em; }
        .section-head h2 { margin: 0; font-size: 18pt; font-weight: 700; color: #0a1628; }
        .section-head .en { font-family: 'Work Sans', sans-serif; font-size: 10pt; color: #94a3b8; letter-spacing: 0.18em; text-transform: uppercase; margin-left: auto; }
        .block-label { font-family: 'Work Sans', sans-serif; font-size: 9pt; color: #475569; letter-spacing: 0.12em; text-transform: uppercase; margin: 0 0 2mm; font-weight: 600; }
        /* サブ見出し: A/B/C/... ブロック単位の強調 (色 + 太字 + 番号バッジ) */
        .sub-head {
          display: flex; align-items: center; gap: 8px;
          margin: 0 0 3mm 0; padding: 1.5mm 3mm;
          border-left: 4px solid #0a1628; background: linear-gradient(90deg, #f8fafc 0%, #ffffff 80%);
        }
        .sub-head .sub-num {
          display: inline-flex; align-items: center; justify-content: center;
          width: 7mm; height: 7mm; border-radius: 50%;
          background: #0a1628; color: white;
          font-family: 'Work Sans', sans-serif; font-weight: 700; font-size: 11pt;
        }
        .sub-head .sub-title {
          font-family: 'Noto Sans JP', sans-serif; font-weight: 700; font-size: 13pt; color: #0a1628;
          letter-spacing: 0.02em;
        }
        /* 用途別カラー (Progress: 紺 / Achievements: 緑) */
        .sub-head-progress { border-left-color: #1e40af; }
        .sub-head-progress .sub-num { background: #1e40af; }
        .sub-head-achieve { border-left-color: #059669; }
        .sub-head-achieve .sub-num { background: #059669; }
        .sub-head-achieve .sub-title { color: #064e3b; }
        .mini-label { font-family: 'Work Sans', sans-serif; font-weight: 700; font-size: 9.5pt; color: #475569; margin: 3mm 0 1.5mm; letter-spacing: 0.04em; }

        /* Markdown */
        .md-body h2 {
          font-size: 13.5pt; font-weight: 700; margin: 6mm 0 3mm; padding: 2mm 4mm;
          color: #f8fafc; background: #0a1628; letter-spacing: 0.02em;
          break-inside: avoid; page-break-inside: avoid;
          -webkit-print-color-adjust: exact; print-color-adjust: exact;
        }
        .md-body h2:first-child { margin-top: 0; }
        .md-body h3 {
          font-size: 12pt; font-weight: 700; margin: 5mm 0 2mm; padding-bottom: 1mm;
          color: #0a1628; border-bottom: 2px solid #0a1628;
          break-inside: avoid; page-break-inside: avoid;
        }
        .md-body h4 {
          font-size: 10.5pt; font-weight: 700; margin: 3.5mm 0 1.5mm; padding-left: 2.5mm;
          color: #334155; border-left: 3px solid #94a3b8;
          break-inside: avoid; page-break-inside: avoid;
        }
        .md-body p { margin: 0 0 2mm; }
        .md-body li { margin: 0 0 0.6mm 6mm; position: relative; list-style: none; }
        .md-body li::before { content: '·'; position: absolute; left: -3mm; color: #0a1628; font-weight: 700; }
        .md-body blockquote { border-left: 2px solid #94a3b8; padding-left: 4mm; margin: 2mm 0; color: #475569; font-style: italic; }
        .md-table-wrap { margin: 3mm 0 5mm; overflow: hidden; }
        .md-table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 9pt; line-height: 1.55; }
        .md-table th, .md-table td { border: 1px solid #cbd5e1; padding: 2mm 2.5mm; vertical-align: top; overflow-wrap: anywhere; }
        .md-table th { background: #e2e8f0; color: #0a1628; font-weight: 700; text-align: left; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .md-table tr { break-inside: avoid; page-break-inside: avoid; }
        .md-table th:first-child, .md-table td:first-child { width: 12%; white-space: nowrap; }
        .report-body { background: #f8fafc; padding: 4mm 5mm; border-left: 3px solid #0a1628; }

        /* 提出版 (単一連続文書、明示的な改頁 CSS は入れない) */
        .submission-sheet { line-height: 1.9; }
        .submission-head { margin-bottom: 8mm; border-bottom: 1px solid #cbd5e1; padding-bottom: 4mm; }
        .submission-title { font-size: 16pt; font-weight: 700; color: #0a1628; }
        .submission-meta { font-size: 10.5pt; color: #475569; margin-top: 2mm; }

        /* Exec Summary */
        .lead { background: #f1f5f9; border-left: 3px solid #0a1628; padding: 3mm 5mm; margin-bottom: 5mm; font-size: 10.5pt; line-height: 1.8; }
        .highlights { margin-bottom: 5mm; }
        .hl-list { margin: 0 0 0 4mm; padding: 0; }
        .hl-list li { margin: 0 0 1mm; }
        .rag-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3mm; margin-bottom: 5mm; }
        .rag-grid-2 { grid-template-columns: repeat(2, 1fr); }
        .rag-card { border: 1px solid #e2e8f0; padding: 4mm; text-align: center; }
        .rag-axis { font-family: 'Work Sans', sans-serif; font-size: 9pt; letter-spacing: 0.16em; opacity: 0.7; }
        .rag-label { font-family: 'Work Sans', sans-serif; font-size: 18pt; font-weight: 700; margin: 1mm 0; letter-spacing: 0.04em; }
        .rag-meta { font-size: 9pt; opacity: 0.75; }
        .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3mm; margin-bottom: 5mm; }
        .kpi-stat { border: 1px solid #e2e8f0; border-left: 3px solid #0a1628; padding: 3mm 4mm; }
        .kpi-label { font-family: 'Work Sans', sans-serif; font-size: 8.5pt; color: #64748b; letter-spacing: 0.1em; text-transform: uppercase; }
        .kpi-value { font-family: 'Work Sans', sans-serif; font-weight: 700; font-size: 20pt; color: #0a1628; margin-top: 1mm; line-height: 1; }
        .xrl-summary { margin-top: 5mm; }
        .xrl-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 2mm; }
        .xrl-card {
          background: white; border: 1px solid #e2e8f0; border-top-width: 3px;
          padding: 3mm 2mm; text-align: center;
        }
        .xrl-axis { font-family: 'Work Sans', sans-serif; font-weight: 700; font-size: 10pt; letter-spacing: 0.1em; }
        .xrl-axis-jp { font-size: 8.5pt; color: #64748b; margin: 0.5mm 0 1.5mm; }
        .xrl-value { font-family: 'Work Sans', sans-serif; font-weight: 300; font-size: 22pt; line-height: 1; color: #0a1628; }
        .delta-up { color: #166534; font-weight: 700; }
        .delta-dn { color: #b91c1c; font-weight: 700; }

        /* MS table */
        .ms-table { width: 100%; border-collapse: collapse; font-size: 9.5pt; margin-top: 2mm; }
        .ms-table th, .ms-table td { border: 1px solid #e2e8f0; padding: 2mm 3mm; vertical-align: top; }
        .ms-table th { background: #f1f5f9; color: #475569; font-family: 'Work Sans', sans-serif; font-size: 8.5pt; letter-spacing: 0.06em; text-align: left; }
        .ms-title { font-weight: 700; }
        .ms-note-cell { font-size: 8.5pt; color: #475569; margin-top: 1mm; }
        .num-cell { text-align: right; font-family: 'JetBrains Mono', monospace; }
        .period-cell { font-family: 'JetBrains Mono', monospace; font-size: 8.5pt; }

        /* Achievements */
        .ach-block { margin-bottom: 5mm; }
        .ach-card { border: 1px solid #e2e8f0; padding: 3mm 4mm; margin-bottom: 2mm; page-break-inside: avoid; }
        .ach-head { display: flex; gap: 6px; align-items: center; margin-bottom: 1.5mm; }
        .polarity { font-size: 12pt; }
        .ach-type { font-family: 'Work Sans', sans-serif; font-size: 8.5pt; letter-spacing: 0.1em; text-transform: uppercase; color: #475569; }
        .ach-impact { color: white; font-family: 'Work Sans', sans-serif; font-size: 8pt; font-weight: 700; padding: 1px 6px; border-radius: 3px; }
        .ach-date { font-family: 'JetBrains Mono', monospace; font-size: 8.5pt; color: #64748b; margin-left: auto; }
        .ach-title { font-weight: 700; font-size: 11pt; margin-bottom: 1mm; }
        .ach-summary { font-size: 10pt; color: #334155; }
        .ach-score { font-size: 9pt; color: #166534; margin-top: 1.5mm; font-family: 'JetBrains Mono', monospace; }

        .grant-table, .reimburse-table, .finance-table, .action-table, .risk-table, .team-table {
          width: 100%; border-collapse: collapse; font-size: 10pt; margin-top: 2mm;
        }
        .grant-table th, .grant-table td,
        .reimburse-table th, .reimburse-table td,
        .finance-table th, .finance-table td,
        .action-table th, .action-table td,
        .risk-table th, .risk-table td,
        .team-table th, .team-table td {
          border: 1px solid #e2e8f0; padding: 2mm 3mm; vertical-align: top;
        }
        .grant-table th, .reimburse-table th, .finance-table th, .action-table th, .risk-table th, .team-table th {
          background: #f1f5f9; color: #475569; font-family: 'Work Sans', sans-serif;
          font-size: 8.5pt; letter-spacing: 0.06em; text-align: left;
        }
        .decision-list { margin: 0; padding: 0; list-style: none; }
        .decision-list li { padding: 1.5mm 0 1.5mm 6mm; position: relative; border-top: 1px dashed #e2e8f0; }
        .decision-list li:first-child { border-top: 0; }
        .decision-list li::before { content: '✓'; position: absolute; left: 0; color: #166534; font-weight: 700; }
        .decision-text { color: #0f172a; }
        .decision-src { color: #64748b; font-size: 9pt; margin-left: 4mm; font-family: 'JetBrains Mono', monospace; }
        .media-list { margin: 0; padding: 0; list-style: none; }
        .media-list li { padding: 1.5mm 0; border-top: 1px dashed #e2e8f0; display: flex; gap: 4mm; align-items: baseline; }
        .media-list li:first-child { border-top: 0; }
        .media-date { font-family: 'JetBrains Mono', monospace; font-size: 9pt; color: #64748b; min-width: 22mm; }
        .media-name { font-weight: 600; min-width: 30mm; }
        .media-title { color: #334155; }

        /* Meetings */
        .meeting { border-top: 1px solid #e2e8f0; padding: 4mm 0; page-break-inside: avoid; }
        .meeting:first-child { border-top: 0; padding-top: 0; }
        .meeting-head { display: flex; gap: 8px; align-items: baseline; margin-bottom: 2mm; }
        .meeting-date { font-family: 'JetBrains Mono', monospace; font-size: 9pt; color: #64748b; min-width: 22mm; }
        .meeting-title { font-weight: 700; font-size: 11pt; }
        .meeting-summary { margin: 1mm 0; font-size: 10pt; }
        .meeting-block { margin-top: 2mm; }
        .meeting-block-label { font-family: 'Work Sans', sans-serif; font-size: 8.5pt; color: #64748b; letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 1mm; }
        .meeting-block ul { margin: 0; padding: 0; list-style: none; }
        .meeting-block ul li { padding-left: 4mm; position: relative; margin: 0.4mm 0; }
        .meeting-block ul li::before { content: '·'; position: absolute; left: 1mm; color: #0a1628; font-weight: 700; }

        /* Team */
        .team-name { font-weight: 700; color: #0a1628; }
        .team-tags { margin-top: 1mm; }
        .team-tag { display: inline-block; background: #0a1628; color: white; padding: 0 6px; font-size: 8pt; font-family: 'Work Sans', sans-serif; letter-spacing: 0.06em; margin-right: 2px; }
        .resp-list { margin: 0; padding: 0; list-style: none; font-size: 9.5pt; }
        .resp-list li { margin-bottom: 1mm; }
        .resp-ms { font-weight: 600; }
        .resp-share { font-family: 'JetBrains Mono', monospace; font-size: 8.5pt; color: #475569; }
        .resp-task { font-size: 8.5pt; color: #64748b; margin-top: 0.5mm; }
        .founding-list { margin: 0; padding: 0; list-style: none; }
        .founding-list li { padding: 1mm 0; border-top: 1px dashed #e2e8f0; display: flex; gap: 4mm; align-items: baseline; }
        .founding-list li:first-child { border-top: 0; }
        .found-name { font-weight: 700; min-width: 25mm; }
        .found-role { font-size: 9pt; color: #475569; min-width: 24mm; }
        .found-aff { font-size: 9pt; color: #64748b; }

        /* Risks */
        .risk-block { margin-bottom: 4mm; }
        .risk-impact { font-family: 'Work Sans', sans-serif; font-size: 8pt; font-weight: 700; padding: 1px 6px; border-radius: 3px; }
        .risk-title { font-weight: 700; font-size: 10.5pt; }
        .risk-summary { font-size: 10pt; color: #334155; margin-top: 0.5mm; }
        .risk-src { font-size: 9pt; color: #64748b; font-family: 'JetBrains Mono', monospace; }

        /* Empty */
        .empty { padding: 6mm; text-align: center; color: #94a3b8; font-size: 10pt; border: 1px dashed #cbd5e1; }
        .empty-small { padding: 2mm; color: #94a3b8; font-size: 9.5pt; }

        /* Next Month */
        .upcoming-list { margin: 0; padding: 0; list-style: none; }
        .upcoming-list li { padding: 1mm 0; border-top: 1px dashed #e2e8f0; display: flex; gap: 4mm; align-items: baseline; }
        .upcoming-list li:first-child { border-top: 0; }
        .upcoming-date { font-family: 'JetBrains Mono', monospace; font-size: 9pt; color: #64748b; min-width: 22mm; }
        .upcoming-title { font-weight: 600; }

        /* Appendix */
        .attach-list { margin: 0; padding: 0 0 0 5mm; }
        .attach-list li { font-size: 10pt; margin: 0.5mm 0; }
        .attach-list a { color: #0a1628; text-decoration: underline; }
        .attach-kind { font-size: 8.5pt; color: #64748b; }
        .source-pre { background: #f8fafc; border: 1px solid #e2e8f0; padding: 3mm; font-size: 8pt; font-family: 'JetBrains Mono', monospace; overflow: hidden; max-height: 60mm; }
        .rev-table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
        .rev-table th, .rev-table td { border: 1px solid #e2e8f0; padding: 2mm 3mm; }
        .rev-table th { background: #f1f5f9; color: #475569; font-family: 'Work Sans', sans-serif; font-size: 8.5pt; letter-spacing: 0.06em; text-align: left; }
        .end-mark { margin-top: 12mm; padding-top: 4mm; border-top: 1px solid #cbd5e1; font-size: 9pt; color: #64748b; text-align: center; font-family: 'JetBrains Mono', monospace; }
      `}</style>

      <div className="print-root">
        <div className="toolbar no-print">
          <span style={{ fontWeight: 700, letterSpacing: "0.12em", fontFamily: "Work Sans, sans-serif" }}>
            MONTHLY REPORT — PRINT VIEW
          </span>
          <span className="hint">Cmd+P → 「PDFとして保存」 / 余白なし・背景画像オン推奨</span>
          <button onClick={() => window.print()} style={{ marginLeft: "auto" }}>
            印刷 / PDF保存
          </button>
        </div>

        {data.isSubmission ? (
          <SubmissionView data={data} />
        ) : (
          <>
            <CoverPage data={data} />
            <ExecSummary data={data} />
            <ProgressSection data={data} />
            <GanttSection data={data} />
            <TeamSection data={data} />
            <NextMonthSection data={data} />
            <AppendixSection data={data} />
          </>
        )}
      </div>
    </>
  );
}
