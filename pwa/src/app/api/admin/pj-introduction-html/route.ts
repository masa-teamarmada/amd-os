/**
 * POST /api/admin/pj-introduction-html
 *
 * 2026-05-12 まさ要望: ダッシュボード「全PJ紹介資料作成」ボタンから呼ばれる。
 * 選択された複数 PJ のエグゼクティブサマリーを 1 つの HTML として出力する。
 *
 * 雛形: pwa/AMD_allPJ_introduction.html (4 PJ デザインのスナップショット、488 行)。
 *       本 route は雛形デザインを参考に **PJ 数可変** で動的に組み立てる。
 *
 * フェーズ:
 *   Phase 1 (本実装): Supabase の project_ventures / project_knowledge / monthly_reports から
 *                     最新情報を集約 → 自前 HTML テンプレで 1 PJ = 1 ページ。LLM 集約は次段。
 *   Phase 2 (TODO): Sonnet 4.5 で「会社紹介資料に載せるエグゼクティブサマリー」を LLM 集約
 *                   (key_points / tech / market / team_size 等)
 *
 * Body: { project_ids: string[] }
 * Response: Content-Type=text/html; charset=utf-8
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

interface PostBody {
  project_ids?: string[];
}

interface VentureRow {
  project_id: string;
  display_name: string | null;
  lane: string | null;
  lanes: unknown;
  founded_at: string | null;
  outcome_pattern: string | null;
  origin_org: string | null;
  origin_pi: string | null;
  short_description: string | null;
  long_description: string | null;
  narrative_text: string | null;
  amd_support_started_at: string | null;
  amd_support_ended_at: string | null;
}

interface ProjectRow {
  project_id: string;
  project_name: string;
  client_name: string | null;
  status: string;
}

interface KnowledgeRow {
  project_id: string;
  category: string | null;
  entity_name: string | null;
  fact_text: string | null;
}

interface MonthlyReportRow {
  project_id: string;
  ym: string;
  final_content: string | null;
  draft_content: string | null;
}

function esc(s: string | null | undefined): string {
  if (!s) return "";
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderPjPage(
  idx: number,
  total: number,
  proj: ProjectRow,
  venture: VentureRow | null,
  basicFacts: KnowledgeRow[],
  latestReport: MonthlyReportRow | null
): string {
  const name = esc(venture?.display_name || proj.project_name);
  const tagline = esc(venture?.short_description || "");
  const summary = esc(
    venture?.long_description ||
      venture?.narrative_text ||
      (latestReport ? (latestReport.final_content || latestReport.draft_content || "").slice(0, 600) : "") ||
      "本 PJ の詳細サマリーは未生成 (次段で Sonnet 集約予定)"
  );
  const lane = esc(venture?.lane || "—");
  const founded = esc(venture?.founded_at || "—");
  const origin = esc(venture?.origin_org || "—");
  const pi = esc(venture?.origin_pi || "—");
  const amdSpan = (() => {
    if (!venture?.amd_support_started_at) return "—";
    const s = venture.amd_support_started_at.slice(0, 7);
    const e = venture.amd_support_ended_at ? venture.amd_support_ended_at.slice(0, 7) : "現在";
    return `${s} 〜 ${e}`;
  })();

  const facts = basicFacts
    .map((f) => `<li><span class="fact-key">${esc(f.entity_name)}</span> <span class="fact-val">${esc(f.fact_text)}</span></li>`)
    .join("");

  return `
<section class="pj-page">
  <header class="pj-head">
    <div class="pj-mark">
      <svg viewBox="0 0 32 36" class="hex"><polygon points="16,1 30,9.5 30,26.5 16,35 2,26.5 2,9.5" fill="none" stroke="#0ea5e9" stroke-width="1.6"/></svg>
      <svg viewBox="0 0 32 36" class="hex hex-fill"><polygon points="16,1 30,9.5 30,26.5 16,35 2,26.5 2,9.5" fill="#0ea5e9"/></svg>
    </div>
    <div class="pj-id-block">
      <div class="pj-id">${esc(proj.project_id).toUpperCase()} · ${esc(proj.status).toUpperCase()}</div>
      <h2 class="pj-name">${name}</h2>
      <div class="pj-tagline">${tagline}</div>
    </div>
    <div class="pj-page-tag">PJ ${idx} / ${total}</div>
  </header>

  <div class="pj-grid">
    <div class="pj-summary">
      <h3 class="pj-h3">Executive Summary</h3>
      <p class="pj-summary-body">${summary.replaceAll("\n", "<br/>")}</p>
    </div>

    <aside class="pj-meta">
      <h3 class="pj-h3">Key Facts</h3>
      <ul class="pj-meta-list">
        <li><span class="fact-key">Lane</span> <span class="fact-val">${lane}</span></li>
        <li><span class="fact-key">設立</span> <span class="fact-val">${founded}</span></li>
        <li><span class="fact-key">起源組織</span> <span class="fact-val">${origin}</span></li>
        <li><span class="fact-key">PI</span> <span class="fact-val">${pi}</span></li>
        <li><span class="fact-key">AMD 支援</span> <span class="fact-val">${amdSpan}</span></li>
        ${facts}
      </ul>
    </aside>
  </div>

  <footer class="pj-foot">
    <span class="pj-foot-mark">Team ARMADA · Deep Tech Portfolio</span>
    <span class="pj-foot-meta">Generated ${new Date().toISOString().slice(0, 10)}</span>
  </footer>
</section>
`;
}

const PAGE_CSS = `
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { background: #0c0e10; color: #e2e8f0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
.deck { max-width: 1180px; margin: 0 auto; padding: 32px 24px; display: flex; flex-direction: column; gap: 18px; }
.deck-hdr { display: flex; align-items: baseline; gap: 12px; padding-bottom: 18px; border-bottom: 1px solid rgba(14,165,233,0.35); }
.deck-hdr h1 { font-size: 22px; letter-spacing: 0.06em; color: #67e8f9; font-weight: 700; }
.deck-hdr .deck-sub { font-size: 12px; color: #94a3b8; letter-spacing: 0.04em; }
.deck-hdr .deck-meta { margin-left: auto; font-size: 11px; color: #64748b; font-family: ui-monospace, monospace; }

.pj-page {
  background: #ffffff;
  color: #0f172a;
  border-radius: 14px;
  padding: 28px 32px;
  box-shadow: 0 10px 40px -10px rgba(6,182,212,0.18);
  position: relative;
  overflow: hidden;
}
.pj-page::before {
  content: "";
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 90% 0%, rgba(6,182,212,0.07), transparent 50%);
  pointer-events: none;
}

.pj-head { display: flex; align-items: flex-start; gap: 18px; margin-bottom: 18px; position: relative; }
.pj-mark { display: flex; gap: 6px; position: relative; padding-top: 2px; }
.pj-mark .hex { width: 30px; height: 32px; }
.pj-mark .hex-fill { opacity: 0.6; }
.pj-id-block { flex: 1; min-width: 0; }
.pj-id { font-family: ui-monospace, monospace; font-size: 10.5px; letter-spacing: 0.16em; color: #0ea5e9; text-transform: uppercase; margin-bottom: 4px; }
.pj-name { font-size: 26px; font-weight: 700; letter-spacing: -0.01em; color: #0f172a; line-height: 1.1; }
.pj-tagline { font-size: 13px; color: #475569; margin-top: 6px; line-height: 1.45; }
.pj-page-tag { font-family: ui-monospace, monospace; font-size: 10px; letter-spacing: 0.1em; color: #94a3b8; align-self: flex-start; padding-top: 6px; }

.pj-grid { display: grid; grid-template-columns: 1fr 280px; gap: 24px; margin-top: 16px; align-items: start; }
.pj-h3 { font-size: 10.5px; font-family: ui-monospace, monospace; letter-spacing: 0.18em; text-transform: uppercase; color: #0e7490; margin-bottom: 10px; }
.pj-summary-body { font-size: 12.5px; line-height: 1.7; color: #1e293b; white-space: normal; }
.pj-meta { padding: 14px 16px; border: 1px solid #e0f2fe; border-radius: 8px; background: #f8fbff; }
.pj-meta-list { list-style: none; display: flex; flex-direction: column; gap: 6px; }
.pj-meta-list li { display: flex; justify-content: space-between; gap: 8px; font-size: 11px; padding-bottom: 5px; border-bottom: 1px dashed #cbd5e1; }
.pj-meta-list li:last-child { border-bottom: none; }
.fact-key { color: #64748b; font-family: ui-monospace, monospace; font-size: 10px; letter-spacing: 0.05em; }
.fact-val { color: #0f172a; font-weight: 500; text-align: right; }

.pj-foot { display: flex; justify-content: space-between; margin-top: 22px; padding-top: 12px; border-top: 1px dashed #cbd5e1; font-family: ui-monospace, monospace; font-size: 9.5px; color: #94a3b8; letter-spacing: 0.08em; }

@media print {
  html, body { background: white; }
  .deck { padding: 0; }
  .deck-hdr { display: none; }
  .pj-page { box-shadow: none; border: 1px solid #e2e8f0; page-break-after: always; }
}
`;

export async function POST(req: NextRequest) {
  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const ids = Array.isArray(body.project_ids) ? body.project_ids.filter(Boolean) : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "project_ids required" }, { status: 400 });
  }

  const db = createAdminClient();

  // 並列 fetch
  const [projRes, ventRes, knowRes, repRes] = await Promise.all([
    db.from("projects").select("project_id,project_name,client_name,status").in("project_id", ids),
    db
      .from("project_ventures")
      .select(
        "project_id,display_name,lane,lanes,founded_at,outcome_pattern,origin_org,origin_pi,short_description,long_description,narrative_text,amd_support_started_at,amd_support_ended_at"
      )
      .in("project_id", ids),
    db
      .from("project_knowledge")
      .select("project_id,category,entity_name,fact_text")
      .eq("category", "basic_fact")
      .eq("status", "active")
      .in("project_id", ids),
    db
      .from("monthly_reports")
      .select("project_id,ym,final_content,draft_content")
      .in("project_id", ids)
      .order("ym", { ascending: false }),
  ]);

  if (projRes.error) return NextResponse.json({ error: `projects: ${projRes.error.message}` }, { status: 500 });

  const projects = (projRes.data || []) as ProjectRow[];
  const ventureMap = new Map<string, VentureRow>();
  for (const v of (ventRes.data || []) as VentureRow[]) ventureMap.set(v.project_id, v);
  const knowMap = new Map<string, KnowledgeRow[]>();
  for (const k of (knowRes.data || []) as KnowledgeRow[]) {
    if (!knowMap.has(k.project_id)) knowMap.set(k.project_id, []);
    knowMap.get(k.project_id)!.push(k);
  }
  const latestReportMap = new Map<string, MonthlyReportRow>();
  for (const r of (repRes.data || []) as MonthlyReportRow[]) {
    if (!latestReportMap.has(r.project_id)) latestReportMap.set(r.project_id, r);
  }

  // ids の指定順を尊重しつつ、Supabase に存在する PJ のみ
  const ordered = ids
    .map((id) => projects.find((p) => p.project_id === id))
    .filter((p): p is ProjectRow => Boolean(p));

  const pages = ordered
    .map((proj, i) =>
      renderPjPage(
        i + 1,
        ordered.length,
        proj,
        ventureMap.get(proj.project_id) || null,
        knowMap.get(proj.project_id) || [],
        latestReportMap.get(proj.project_id) || null
      )
    )
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <title>Team ARMADA — DeepTech Portfolio (${ordered.length} PJ)</title>
  <style>${PAGE_CSS}</style>
</head>
<body>
  <div class="deck">
    <header class="deck-hdr">
      <h1>TEAM ARMADA</h1>
      <span class="deck-sub">DEEPTECH PORTFOLIO / ${ordered.length} COMPANIES</span>
      <span class="deck-meta">${new Date().toISOString().slice(0, 10)} · AMD-OS generated</span>
    </header>
    ${pages}
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
