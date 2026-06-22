"use client";

/**
 * 月次レポート印刷ビュー (A4 縦)。
 *
 * Team ARMADA ブランド (Work Sans / Noto Sans JP / JetBrains Mono / dark accent #0a1628).
 * @page A4 / margin 14mm。 page-break で表紙→本文→MS→MTG→経営→メンバー欄を分ける。
 * 「PDFを保存」ボタンは Cmd+P を発火するだけ (= ブラウザ標準ダイアログ)。
 */

import { useMemo } from "react";

interface MsRow {
  milestoneId: string;
  title: string;
  points: number;
  tag: string;
  progressPct: number;
  note: string | null;
}
interface MeetingRow {
  meetingId: string;
  meetingDate: string;
  title: string;
  summaryShort: string;
  narrativeMd: string | null;
  decided: unknown[];
  nextActions: unknown[];
  risks: unknown[];
  notionUrl: string | null;
}
interface SignalRow {
  signalId: string;
  signalType: string;
  title: string;
  summary: string;
  impactLevel: string;
  decisionState: string;
  signalDate: string | null;
}
interface MemberRow {
  memberId: string;
  codeName: string;
  roleLabel: string | null;
  isPm: boolean;
  isPl: boolean;
}
interface PrintData {
  project: {
    projectId: string;
    projectName: string;
    clientName: string | null;
    status: string;
    startYm: string | null;
    endYm: string | null;
  };
  ym: string;
  report: {
    status: string;
    draftContent: string;
    finalContent: string;
    generatedAt: string | null;
    fixedAt: string | null;
    confirmedBy: string | null;
  } | null;
  milestones: MsRow[];
  overallPct: number;
  meetings: MeetingRow[];
  signals: SignalRow[];
  members: MemberRow[];
  monthlyNote: string;
}

function formatYm(ym: string) {
  return `${ym.slice(0, 4)}年${parseInt(ym.slice(4, 6), 10)}月`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return iso;
  }
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
    risk: "リスク", opportunity: "機会", decision: "意思決定",
    pipeline: "パイプライン", finance: "財務", policy: "ポリシー",
    market: "市場", talent: "人材", legal: "法務", other: "その他",
  };
  return map[t] || t;
}

function arrayToLines(value: unknown[]): string[] {
  return value
    .map((v) => {
      if (typeof v === "string") return v;
      if (v && typeof v === "object") {
        const obj = v as Record<string, unknown>;
        const text = (obj.text ?? obj.label ?? obj.body ?? obj.title ?? obj.content) as unknown;
        return typeof text === "string" ? text : JSON.stringify(v);
      }
      return String(v);
    })
    .filter((s) => s.trim().length > 0);
}

function MarkdownBlock({ text }: { text: string }) {
  if (!text) return null;
  const lines = text.split("\n");
  return (
    <div className="md-body">
      {lines.map((line, i) => {
        if (line.startsWith("### ")) return <h4 key={i}>{line.slice(4)}</h4>;
        if (line.startsWith("## ")) return <h3 key={i}>{line.slice(3)}</h3>;
        if (line.startsWith("# ")) return <h2 key={i}>{line.slice(2)}</h2>;
        if (line.match(/^[-*] /)) return <li key={i}>{renderInline(line.slice(2))}</li>;
        if (line.startsWith("> ")) return <blockquote key={i}>{line.slice(2)}</blockquote>;
        if (line.trim() === "") return <div key={i} style={{ height: "0.5em" }} />;
        return <p key={i}>{renderInline(line)}</p>;
      })}
    </div>
  );
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/\*\*([^*]+)\*\*/g);
  return parts.map((p, i) => (i % 2 === 1 ? <strong key={i}>{p}</strong> : p));
}

export function MonthlyReportPrintClient({ data }: { data: PrintData }) {
  const { project, ym, report, milestones, overallPct, meetings, signals, members, monthlyNote } = data;
  const reportBody = report?.finalContent || report?.draftContent || "";
  const isFinal = (report?.status === "fixed" || report?.status === "final") && !!report?.fixedAt;

  const ranked = useMemo(
    () => [...milestones].sort((a, b) => b.points - a.points),
    [milestones]
  );
  const totalPt = ranked.reduce((s, m) => s + m.points, 0);

  return (
    <>
      <style jsx global>{`
        @page { size: A4 portrait; margin: 14mm 14mm 18mm 14mm; }
        @media print {
          .no-print { display: none !important; }
          .print-root { background: white !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        .print-root {
          font-family: 'Noto Sans JP', system-ui, -apple-system, sans-serif;
          color: #0f172a;
          background: #f1f5f9;
          min-height: 100vh;
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
          .sheet { margin: 0; box-shadow: none; padding: 0; width: auto; min-height: auto; }
        }
        .cover {
          display: flex; flex-direction: column; height: calc(297mm - 32mm);
        }
        .cover-head {
          border-bottom: 2px solid #0a1628; padding-bottom: 10mm;
        }
        .brand-mark {
          font-family: 'Work Sans', sans-serif; letter-spacing: 0.22em;
          font-size: 9pt; color: #64748b; text-transform: uppercase;
        }
        .brand-mark b { color: #0a1628; font-weight: 700; }
        .cover-title-block { margin-top: 26mm; }
        .cover-eyebrow {
          font-family: 'JetBrains Mono', monospace; font-size: 9pt;
          letter-spacing: 0.18em; color: #475569; text-transform: uppercase;
        }
        .cover-ym {
          font-family: 'Work Sans', sans-serif; font-weight: 300;
          font-size: 64pt; line-height: 1; margin: 6mm 0 4mm; color: #0a1628;
          letter-spacing: -0.02em;
        }
        .cover-project {
          font-size: 26pt; font-weight: 700; color: #0a1628;
          margin-top: 4mm; letter-spacing: -0.01em;
        }
        .cover-client {
          font-size: 12pt; color: #475569; margin-top: 3mm;
        }
        .cover-foot {
          margin-top: auto; display: flex; justify-content: space-between;
          align-items: flex-end; border-top: 1px solid #cbd5e1; padding-top: 6mm;
          font-size: 9pt; color: #64748b;
        }
        .cover-foot .meta { font-family: 'JetBrains Mono', monospace; }
        .status-pill {
          display: inline-block; padding: 2px 10px; border-radius: 999px;
          font-family: 'Work Sans', sans-serif; font-size: 8pt;
          letter-spacing: 0.08em; text-transform: uppercase;
        }
        .status-pill.final { background: #dcfce7; color: #166534; }
        .status-pill.draft { background: #fef3c7; color: #92400e; }
        .section { page-break-before: always; padding-top: 0; }
        .section-head {
          display: flex; align-items: baseline; gap: 12px;
          border-bottom: 1.5px solid #0a1628; padding-bottom: 4mm;
          margin-bottom: 6mm;
        }
        .section-head .num {
          font-family: 'JetBrains Mono', monospace; font-size: 10pt;
          color: #64748b; letter-spacing: 0.1em;
        }
        .section-head h2 {
          margin: 0; font-size: 18pt; font-weight: 700; color: #0a1628;
        }
        .section-head .en {
          font-family: 'Work Sans', sans-serif; font-size: 10pt;
          color: #94a3b8; letter-spacing: 0.18em; text-transform: uppercase;
          margin-left: auto;
        }
        .md-body h2 { font-size: 14pt; margin: 4mm 0 2mm; color: #0a1628; }
        .md-body h3 { font-size: 12pt; margin: 3mm 0 1.5mm; color: #1e293b; }
        .md-body h4 { font-size: 11pt; margin: 2.5mm 0 1mm; color: #334155; }
        .md-body p { margin: 0 0 2mm; }
        .md-body li {
          margin: 0 0 0.6mm 6mm; position: relative; list-style: none;
        }
        .md-body li::before {
          content: '·'; position: absolute; left: -3mm; color: #0a1628; font-weight: 700;
        }
        .md-body blockquote {
          border-left: 2px solid #94a3b8; padding-left: 4mm;
          margin: 2mm 0; color: #475569; font-style: italic;
        }
        .ms-grid {
          display: grid; grid-template-columns: 1fr; gap: 3mm;
        }
        .ms-card {
          border: 1px solid #e2e8f0; border-left: 3px solid #0a1628;
          padding: 3mm 4mm; page-break-inside: avoid;
        }
        .ms-card-head {
          display: flex; align-items: center; gap: 8px; margin-bottom: 2mm;
        }
        .ms-card-title { font-weight: 700; font-size: 11pt; flex: 1; }
        .ms-card-pct {
          font-family: 'Work Sans', sans-serif; font-weight: 600;
          font-size: 14pt; color: #0a1628; min-width: 14mm; text-align: right;
        }
        .ms-card-pts {
          font-family: 'JetBrains Mono', monospace; font-size: 8pt;
          color: #64748b; letter-spacing: 0.04em;
        }
        .ms-bar {
          height: 4px; background: #e2e8f0; border-radius: 2px; overflow: hidden;
        }
        .ms-bar > div { height: 100%; background: #0a1628; }
        .ms-note { font-size: 9.5pt; color: #475569; margin-top: 2mm; }
        .meeting {
          border-top: 1px solid #e2e8f0; padding: 4mm 0;
          page-break-inside: avoid;
        }
        .meeting:first-child { border-top: 0; padding-top: 0; }
        .meeting-head {
          display: flex; gap: 8px; align-items: baseline; margin-bottom: 2mm;
        }
        .meeting-date {
          font-family: 'JetBrains Mono', monospace; font-size: 9pt;
          color: #64748b; min-width: 22mm;
        }
        .meeting-title { font-weight: 700; font-size: 11pt; }
        .meeting-block { margin-top: 2mm; }
        .meeting-block-label {
          font-family: 'Work Sans', sans-serif; font-size: 8.5pt;
          color: #64748b; letter-spacing: 0.12em; text-transform: uppercase;
          margin-bottom: 1mm;
        }
        .signal {
          border: 1px solid #e2e8f0; padding: 3mm 4mm; margin-bottom: 3mm;
          page-break-inside: avoid;
        }
        .signal-head { display: flex; gap: 8px; align-items: center; margin-bottom: 1.5mm; }
        .signal-type {
          font-family: 'Work Sans', sans-serif; font-size: 8.5pt;
          letter-spacing: 0.1em; text-transform: uppercase; color: #475569;
        }
        .signal-impact {
          font-family: 'Work Sans', sans-serif; font-size: 8pt;
          font-weight: 700; padding: 1px 8px; border-radius: 3px;
          color: white;
        }
        .signal-title { font-weight: 700; font-size: 11pt; margin-bottom: 1.5mm; }
        .signal-summary { font-size: 10pt; color: #334155; }
        .member-grid {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 3mm;
        }
        .member-card {
          border: 1px solid #e2e8f0; padding: 3mm; text-align: center;
        }
        .member-name { font-weight: 700; font-size: 11pt; color: #0a1628; }
        .member-role {
          font-family: 'Work Sans', sans-serif; font-size: 8pt;
          color: #64748b; letter-spacing: 0.08em; text-transform: uppercase;
          margin-top: 1mm;
        }
        .member-tag {
          display: inline-block; margin-top: 1.5mm; padding: 1px 6px;
          background: #0a1628; color: white; font-size: 8pt;
          font-family: 'Work Sans', sans-serif; letter-spacing: 0.06em;
        }
        .empty {
          padding: 6mm; text-align: center; color: #94a3b8;
          font-size: 10pt; border: 1px dashed #cbd5e1;
        }
        .page-footer {
          position: running(footer);
        }
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

        {/* ─── 表紙 ───────────────────────────────────────── */}
        <div className="sheet">
          <div className="cover">
            <div className="cover-head">
              <div className="brand-mark">
                TEAM <b>ARMADA</b> &nbsp;/&nbsp; MONTHLY REPORT
              </div>
            </div>
            <div className="cover-title-block">
              <div className="cover-eyebrow">REPORTING PERIOD</div>
              <div className="cover-ym">{formatYm(ym)}</div>
              <div className="cover-project">{project.projectName}</div>
              {project.clientName && (
                <div className="cover-client">For: {project.clientName}</div>
              )}
              {report && (
                <div style={{ marginTop: "6mm" }}>
                  <span className={`status-pill ${isFinal ? "final" : "draft"}`}>
                    {isFinal ? "Confirmed" : "Draft"}
                  </span>
                </div>
              )}
            </div>
            <div className="cover-foot">
              <div>
                <div style={{ fontWeight: 600, color: "#0a1628" }}>Team ARMADA Inc.</div>
                <div>masa@team-armada.jp</div>
              </div>
              <div className="meta">
                {isFinal && report?.fixedAt
                  ? `FIXED: ${formatDate(report.fixedAt)}`
                  : report?.generatedAt
                    ? `GENERATED: ${formatDate(report.generatedAt)}`
                    : ""}
              </div>
            </div>
          </div>
        </div>

        {/* ─── §1 当月サマリ + レポート本文 ───────────────── */}
        <div className="sheet">
          <div className="section">
            <div className="section-head">
              <span className="num">§01</span>
              <h2>当月サマリ</h2>
              <span className="en">EXECUTIVE SUMMARY</span>
            </div>

            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
              gap: "4mm", marginBottom: "6mm",
            }}>
              <Stat label="進捗達成率" value={`${overallPct}%`} />
              <Stat label="主要MS件数" value={`${milestones.length}`} />
              <Stat label="MTG件数" value={`${meetings.length}`} />
            </div>

            {reportBody ? (
              <MarkdownBlock text={reportBody} />
            ) : monthlyNote ? (
              <MarkdownBlock text={monthlyNote} />
            ) : (
              <div className="empty">月次報告書はまだ生成されていません。</div>
            )}
          </div>
        </div>

        {/* ─── §2 MS進捗 ────────────────────────────────── */}
        {milestones.length > 0 && (
          <div className="sheet">
            <div className="section">
              <div className="section-head">
                <span className="num">§02</span>
                <h2>マイルストーン進捗</h2>
                <span className="en">MILESTONE PROGRESS</span>
              </div>
              <div className="ms-grid">
                {ranked.map((m) => (
                  <div className="ms-card" key={m.milestoneId}>
                    <div className="ms-card-head">
                      <div className="ms-card-title">{m.title}</div>
                      <div className="ms-card-pts">{m.points} pt</div>
                      <div className="ms-card-pct">{m.progressPct}%</div>
                    </div>
                    <div className="ms-bar">
                      <div style={{ width: `${Math.min(100, m.progressPct)}%` }} />
                    </div>
                    {m.note && <div className="ms-note">{m.note}</div>}
                  </div>
                ))}
              </div>
              {totalPt > 0 && (
                <div style={{
                  marginTop: "5mm", fontSize: "9pt", color: "#64748b",
                  fontFamily: "JetBrains Mono, monospace", textAlign: "right",
                }}>
                  TOTAL: {totalPt} pt
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── §3 MTGサマリ ─────────────────────────────── */}
        {meetings.length > 0 && (
          <div className="sheet">
            <div className="section">
              <div className="section-head">
                <span className="num">§03</span>
                <h2>当月の主要MTG</h2>
                <span className="en">MEETINGS</span>
              </div>
              {meetings.map((mtg) => {
                const decided = arrayToLines(mtg.decided);
                const nextActions = arrayToLines(mtg.nextActions);
                const risks = arrayToLines(mtg.risks);
                return (
                  <div className="meeting" key={mtg.meetingId}>
                    <div className="meeting-head">
                      <span className="meeting-date">{mtg.meetingDate}</span>
                      <span className="meeting-title">{mtg.title}</span>
                    </div>
                    {mtg.narrativeMd ? (
                      <MarkdownBlock text={mtg.narrativeMd} />
                    ) : mtg.summaryShort ? (
                      <p style={{ margin: "1mm 0", fontSize: "10pt" }}>{mtg.summaryShort}</p>
                    ) : null}
                    {decided.length > 0 && (
                      <div className="meeting-block">
                        <div className="meeting-block-label">Decided</div>
                        {decided.map((d, i) => <li key={i} style={{ listStyle: "none", marginLeft: "4mm" }}>· {d}</li>)}
                      </div>
                    )}
                    {nextActions.length > 0 && (
                      <div className="meeting-block">
                        <div className="meeting-block-label">Next Actions</div>
                        {nextActions.map((d, i) => <li key={i} style={{ listStyle: "none", marginLeft: "4mm" }}>· {d}</li>)}
                      </div>
                    )}
                    {risks.length > 0 && (
                      <div className="meeting-block">
                        <div className="meeting-block-label">Risks</div>
                        {risks.map((d, i) => <li key={i} style={{ listStyle: "none", marginLeft: "4mm" }}>· {d}</li>)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── §4 経営シグナル ──────────────────────────── */}
        {signals.length > 0 && (
          <div className="sheet">
            <div className="section">
              <div className="section-head">
                <span className="num">§04</span>
                <h2>経営シグナル</h2>
                <span className="en">STRATEGIC SIGNALS</span>
              </div>
              {signals.map((s) => {
                const badge = impactBadge(s.impactLevel);
                return (
                  <div className="signal" key={s.signalId}>
                    <div className="signal-head">
                      <span className="signal-type">{signalTypeLabel(s.signalType)}</span>
                      <span className="signal-impact" style={{ background: badge.tone }}>{badge.label}</span>
                      {s.signalDate && (
                        <span style={{
                          fontFamily: "JetBrains Mono, monospace",
                          fontSize: "8.5pt", color: "#64748b", marginLeft: "auto",
                        }}>
                          {s.signalDate}
                        </span>
                      )}
                    </div>
                    <div className="signal-title">{s.title}</div>
                    <div className="signal-summary">{s.summary}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── §5 担当メンバー ──────────────────────────── */}
        {members.length > 0 && (
          <div className="sheet">
            <div className="section">
              <div className="section-head">
                <span className="num">§05</span>
                <h2>担当メンバー</h2>
                <span className="en">PROJECT TEAM</span>
              </div>
              <div className="member-grid">
                {members.map((m) => (
                  <div className="member-card" key={m.memberId}>
                    <div className="member-name">{m.codeName}</div>
                    {m.roleLabel && <div className="member-role">{m.roleLabel}</div>}
                    <div>
                      {m.isPm && <span className="member-tag" style={{ marginRight: 4 }}>PM</span>}
                      {m.isPl && <span className="member-tag">PL</span>}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{
                marginTop: "12mm", paddingTop: "4mm",
                borderTop: "1px solid #cbd5e1", fontSize: "9pt",
                color: "#64748b", textAlign: "center",
                fontFamily: "JetBrains Mono, monospace",
              }}>
                — END OF REPORT —
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      border: "1px solid #e2e8f0", padding: "3mm 4mm",
      borderLeft: "3px solid #0a1628",
    }}>
      <div style={{
        fontFamily: "Work Sans, sans-serif", fontSize: "8.5pt",
        color: "#64748b", letterSpacing: "0.1em", textTransform: "uppercase",
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: "Work Sans, sans-serif", fontWeight: 700,
        fontSize: "20pt", color: "#0a1628", marginTop: "1mm", lineHeight: 1,
      }}>
        {value}
      </div>
    </div>
  );
}
