/**
 * POST /api/admin/pj-introduction-html
 *
 * 2026-05-12 まさ要望「雛形のフォーマットそのまま、文字だけ入れ替えて」第 3 ラウンド。
 *
 * 旧旧 (#1): 自前 HTML 書いた → ぐちゃぐちゃ
 * 旧   (#2): 雛形 section を readFileSync + 正規表現置換 → `*?` が </div> を超えてマッチして
 *            余分な </div> が出る構造破壊
 * 新   (#3): 正規表現を完全に廃止。雛形 04 CHALLENERGY section の構造を **template literal で
 *            一字一句コピー**し、変数部分だけ ${} で置換。これで「文字だけ入れ替え」が
 *            正しく実現される。
 *
 * 雛形ベースのコピー元: src/lib/exec_summary/template_section.html (= 04 CHALLENERGY)
 * 雛形に変更があったらこのファイルの renderSection() を同期する。
 *
 * Body: { project_ids: string[] }
 * Response: text/html (= ダウンロード用)
 */

import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createAdminClient } from "@/lib/supabase/admin";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 300;

interface PostBody {
  project_ids?: string[];
}

interface VentureRow {
  project_id: string;
  display_name: string | null;
  lane: string | null;
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

interface FounderRow {
  project_id: string;
  person_name: string;
  affiliation: string | null;
  role: string | null;
  role_label_jp: string | null;
  category: string;
}

interface MonthlyReportRow {
  project_id: string;
  ym: string;
  final_content: string | null;
  draft_content: string | null;
}

/** LLM が返す PJ 1 件の JSON 型 (= 雛形 CHALLENERGY フォーマット) */
interface PjData {
  chip: string;
  rail_sub: string;
  company_name_html: string;
  tagline_html: string;
  summary_html: string;
  category: string;
  stages: Array<{
    kind: string;
    kind_jp: string;
    title: string;
    list: string[];
    is_product?: boolean;
  }>;
  use_cases: Array<{ label: string; strong?: boolean }>;
  stage_pills: Array<{ label: string; state: "done" | "now" | "todo" }>;
  touchpoints: Array<{ html: string }>;
  status_list: Array<{ k: string; v_html: string }>;
}

const TEMPLATE_CSS = readFileSync(
  join(process.cwd(), "src/lib/exec_summary/template.css"),
  "utf-8"
);

function esc(s: string | null | undefined): string {
  if (!s) return "";
  return String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
function escAttr(s: string | null | undefined): string {
  return esc(s).replaceAll('"', "&quot;");
}

function slugify(s: string): string {
  return (
    String(s)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 24) || "pj"
  );
}

/**
 * 雛形 04 CHALLENERGY section の構造を **一字一句コピーした template literal** で
 * PJ ごとの値だけ ${} 置換で埋める。
 *
 * 旧実装の正規表現置換は `*?` で余分な </div> までマッチして構造破壊する事故が
 * 出たので廃止。雛形ファイル src/lib/exec_summary/template_section.html を変更
 * したら、ここの literal も同期する。
 */
function renderSection(idx: number, total: number, pj: PjData, projectId: string, origin: string): string {
  const seq = String(idx).padStart(2, "0");
  const totalStr = String(total).padStart(2, "0");
  const slug = slugify(pj.chip);
  // 2026-05-12 まさ指摘「ロゴ + ロゴタイプが出てない」:
  // 旧は `/AMD_logo_mark.png` 相対 URL、ダウンロード HTML を file:// で開くと 404。
  // 本番の絶対 URL にして、どこで開いても CDN から fetch できるようにする。
  const logoMark = `${origin}/AMD_logo_mark.png`;
  const logoType = `${origin}/AMD_logotype.png`;

  const stagesHtml = (pj.stages || [])
    .slice(0, 4)
    .map((s, i) => {
      const num = String(i + 1).padStart(2, "0");
      const isProduct = !!s.is_product || s.kind === "PRODUCT";
      const showArrow = i < 3;
      const listItems = (s.list || [])
        .slice(0, 6)
        .map((li) => `<li>${li}</li>`)
        .join("\n            ");
      return `<div class="stage${isProduct ? " is-product" : ""}">
        <div class="stage-head"><div class="stage-num">${num}</div><div class="stage-kind">${esc(s.kind)}<b>${esc(s.kind_jp)}</b></div></div>
        <div class="stage-body">
          <div class="stage-title">${esc(s.title)}</div>
          <ul class="stage-list">
            ${listItems}
          </ul>
        </div>${showArrow ? '\n        <svg class="stage-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M13 6l6 6-6 6"></path></svg>' : ""}
      </div>`;
    })
    .join("\n      ");

  const useCasesHtml = (pj.use_cases || [])
    .slice(0, 10)
    .map((u) => `<span class="tag${u.strong ? " is-strong" : ""}">${esc(u.label)}</span>`)
    .join("\n          ");

  const pillsHtml = (pj.stage_pills || [])
    .slice(0, 5)
    .map((p) => {
      const cls = p.state === "now" ? "sp is-now" : p.state === "done" ? "sp is-done" : "sp";
      const tick = p.state === "now" ? '<div class="now-tick">現在地</div>' : "";
      return `<div class="${cls}">${tick}<div class="sp-label">${esc(p.label)}</div></div>`;
    })
    .join("\n            ");

  const tpsHtml = (pj.touchpoints || [])
    .slice(0, 5)
    .map((t, i) => {
      const num = String(i + 1).padStart(2, "0");
      return `<div class="tp"><div class="tp-num">→ ${num}</div><div>${t.html}</div></div>`;
    })
    .join("\n          ");

  const statusRowsHtml = (pj.status_list || [])
    .slice(0, 6)
    .map((s) => `<div class="status-row"><div class="k">${esc(s.k)}</div><div class="v">${s.v_html}</div></div>`)
    .join("\n          ");

  // ★ 雛形 src/lib/exec_summary/template_section.html (= CHALLENERGY) と
  //   class 名・属性順・改行・インデント を一字一句揃えてある。雛形を変更したら同期。
  return `<section class="page page--${slug}" data-screen-label="${seq} ${escAttr(pj.chip)}" data-pj-id="${escAttr(projectId)}">
    <header class="hdr">
      <div class="armada-mark">
        <img class="armada-logo-img" src="${logoMark}" alt="Team ARMADA">
        <img class="armada-typo-img" src="${logoType}" alt="team ARMADA">
      </div>
      <div class="hdr-mid">DeepTech Portfolio  /  <b>Team ARMADA が経営・創出に関わる${total}社</b></div>
      <div class="page-tag">
        <span class="num">${seq}</span><span class="of">/ ${totalStr}</span>
        <span class="cat">${esc(pj.category)}</span>
      </div>
    </header>

    <div class="hero">
      <div class="hero-left">
        <div class="company-rail">
          <span class="chip">${esc(pj.chip)}</span>
          <span>${esc(pj.rail_sub)}</span>
        </div>
        <div class="company-name">${pj.company_name_html}</div>
        <div class="tagline">${pj.tagline_html}</div>
      </div>
      <div class="hero-right">
        <div class="label">30-SEC OVERVIEW</div>
        <div class="summary">
          ${pj.summary_html}
        </div>
      </div>
    </div>

    <div class="diagram">
      ${stagesHtml}
    </div>

    <div class="footer">
      <div class="fcol">
        <h3><span>USE CASES</span><span class="jp">想定用途</span></h3>
        <div class="tag-cloud">
          ${useCasesHtml}
        </div>
        <div class="stage-pill-wrap">
          <div style="font-family:'JetBrains Mono',monospace;font-size:7pt;letter-spacing:.22em;color:var(--ink-3);text-transform:uppercase;margin-top:2mm;">DEVELOPMENT STAGE</div>
          <div class="stage-pill-row" style="margin-top:2.5mm;">
            ${pillsHtml}
          </div>
        </div>
      </div>

      <div class="fcol">
        <h3><span>TOUCHPOINTS</span><span class="jp">協力候補企業との接点</span></h3>
        <div class="touchpoints">
          ${tpsHtml}
        </div>
      </div>

      <div class="fcol">
        <h3><span>STATUS</span><span class="jp">現在地 / 会社情報</span></h3>
        <div class="status-list">
          ${statusRowsHtml}
        </div>
      </div>
    </div>

    <div class="page-edge">TEAM <b>ARMADA</b> &nbsp;/&nbsp; DEEPTECH PORTFOLIO &nbsp;/&nbsp; ${seq} ${esc(pj.chip)}</div>
  </section>`;
}

/** Sonnet 4.5 で 1 PJ ぶんの PjData JSON を取得 */
async function extractPjDataWithLlm(
  proj: ProjectRow,
  venture: VentureRow | null,
  basicFacts: KnowledgeRow[],
  founders: FounderRow[],
  latestReport: MonthlyReportRow | null,
  systemPrompt: string,
  client: Anthropic
): Promise<PjData | null> {
  const factsText = basicFacts.map((f) => `${f.entity_name}: ${f.fact_text}`).join("\n");
  const foundersText = founders
    .slice(0, 10)
    .map((f) => `${f.person_name} (${f.role_label_jp || f.role || f.category})${f.affiliation ? ` / ${f.affiliation}` : ""}`)
    .join("\n");
  const reportText = latestReport
    ? (latestReport.final_content || latestReport.draft_content || "").slice(0, 4000)
    : "";

  const userPrompt = `
# PJ 情報
project_id: ${proj.project_id}
project_name: ${proj.project_name}
status: ${proj.status}
client_name: ${proj.client_name || "—"}

# venture (project_ventures)
display_name: ${venture?.display_name || ""}
lane: ${venture?.lane || ""}
founded_at: ${venture?.founded_at || ""}
outcome_pattern: ${venture?.outcome_pattern || ""}
origin_org: ${venture?.origin_org || ""}
origin_pi: ${venture?.origin_pi || ""}
amd_support_started_at: ${venture?.amd_support_started_at || ""}
short_description: ${venture?.short_description || ""}
long_description: ${venture?.long_description || ""}
narrative_text: ${venture?.narrative_text || ""}

# basic_facts (project_knowledge category=basic_fact)
${factsText || "(none)"}

# founding_members (project_founding_members)
${foundersText || "(none)"}

# latest monthly_report (最大 4000 文字)
${reportText || "(none)"}

# 出力
雛形 CHALLENERGY と同じフォーマットの JSON (システムプロンプトの schema 通り) を 1 つ返す。
JSON 以外は禁止。`;

  try {
    const res = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 2400,
      temperature: 0.3,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });
    const text = (res.content || [])
      .map((c) => (c.type === "text" && "text" in c ? (c as { text: string }).text : ""))
      .join("");
    const clean = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
    return JSON.parse(clean) as PjData;
  } catch (e) {
    console.error("[exec_summary] LLM error for", proj.project_id, e);
    return null;
  }
}

/** LLM が空 / 失敗時のフォールバックデータ (= Supabase 既存だけで埋める、雛形 fmt を守る) */
function fallbackPjData(proj: ProjectRow, venture: VentureRow | null, basicFacts: KnowledgeRow[]): PjData {
  const chip = (venture?.display_name || proj.project_name).toUpperCase();
  const factMap = new Map<string, string>();
  for (const f of basicFacts) if (f.entity_name && f.fact_text) factMap.set(f.entity_name, f.fact_text);
  return {
    chip,
    rail_sub: `${venture?.founded_at?.slice(0, 4) || "?"}年設立 / ${venture?.lane || "deep tech"}`,
    company_name_html: esc(venture?.display_name || proj.project_name),
    tagline_html: esc(venture?.short_description || "tagline 未設定"),
    summary_html: esc(venture?.long_description || venture?.narrative_text || "summary 未集約 (LLM フォールバック)"),
    category: (venture?.lane || "Deep Tech").replace(/_/g, " "),
    stages: [
      { kind: "INPUT", kind_jp: "課題 / 入力", title: "—", list: ["LLM 集約未完了 / fallback"] },
      { kind: "PRODUCT", kind_jp: "製品 / 技術", title: "—", list: ["—"], is_product: true },
      { kind: "CUSTOMER", kind_jp: "導入先", title: "—", list: ["—"] },
      { kind: "VALUE", kind_jp: "得られる価値", title: "—", list: ["—"] },
    ],
    use_cases: [],
    stage_pills: [
      { label: "Research", state: "done" },
      { label: "PoC", state: "todo" },
      { label: "Pilot", state: "todo" },
      { label: "Sales", state: "todo" },
    ],
    touchpoints: [],
    status_list: [
      { k: "Company", v_html: `<b>${esc(venture?.display_name || proj.project_name)}</b>` },
      { k: "Status", v_html: esc(proj.status) },
      { k: "Now", v_html: esc(factMap.get("Now") || factMap.get("直近") || "—") },
    ],
  };
}

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

  // System prompt を DB から取得 (= AGENTS ルール、migration 055 で seed)
  const { data: promptRows } = await db
    .from("llm_prompts")
    .select("body")
    .eq("prompt_key", "exec_summary.extract")
    .eq("is_active", true)
    .limit(1);
  const systemPrompt = (promptRows && promptRows[0] && promptRows[0].body) || "";
  if (!systemPrompt) {
    return NextResponse.json({ error: "llm_prompts.exec_summary.extract (is_active=TRUE) が空" }, { status: 500 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });
  const llm = new Anthropic({ apiKey });

  const [projRes, ventRes, knowRes, fndRes, repRes] = await Promise.all([
    db.from("projects").select("project_id,project_name,client_name,status").in("project_id", ids),
    db
      .from("project_ventures")
      .select(
        "project_id,display_name,lane,founded_at,outcome_pattern,origin_org,origin_pi,short_description,long_description,narrative_text,amd_support_started_at,amd_support_ended_at"
      )
      .in("project_id", ids),
    db
      .from("project_knowledge")
      .select("project_id,category,entity_name,fact_text")
      .eq("category", "basic_fact")
      .eq("status", "active")
      .in("project_id", ids),
    db
      .from("project_founding_members")
      .select("project_id,person_name,affiliation,role,role_label_jp,category")
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
  const fndMap = new Map<string, FounderRow[]>();
  for (const f of (fndRes.data || []) as FounderRow[]) {
    if (!fndMap.has(f.project_id)) fndMap.set(f.project_id, []);
    fndMap.get(f.project_id)!.push(f);
  }
  const latestReportMap = new Map<string, MonthlyReportRow>();
  for (const r of (repRes.data || []) as MonthlyReportRow[]) {
    if (!latestReportMap.has(r.project_id)) latestReportMap.set(r.project_id, r);
  }

  const ordered = ids
    .map((id) => projects.find((p) => p.project_id === id))
    .filter((p): p is ProjectRow => Boolean(p));

  // 各 PJ ごとに LLM 集約 (= 並列、ただし concurrent limit を 3 に絞って rate limit 回避)
  const total = ordered.length;
  const concurrency = 3;
  const dataByIdx: PjData[] = new Array(total);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (true) {
        const i = cursor++;
        if (i >= total) return;
        const proj = ordered[i];
        const venture = ventureMap.get(proj.project_id) || null;
        const facts = knowMap.get(proj.project_id) || [];
        const founders = fndMap.get(proj.project_id) || [];
        const report = latestReportMap.get(proj.project_id) || null;
        const data = await extractPjDataWithLlm(proj, venture, facts, founders, report, systemPrompt, llm);
        dataByIdx[i] = data || fallbackPjData(proj, venture, facts);
      }
    })
  );

  // 絶対 URL の origin を req から取り出す (= ダウンロード HTML を file:// で開いても画像が読める)
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (req.headers.get("x-forwarded-proto") && req.headers.get("x-forwarded-host")
      ? `${req.headers.get("x-forwarded-proto")}://${req.headers.get("x-forwarded-host")}`
      : "https://amd-os-pwa.vercel.app");

  const pages = dataByIdx
    .map((d, i) => renderSection(i + 1, total, d, ordered[i].project_id, origin))
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <title>Team ARMADA — DeepTech ${total}社 紹介資料</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Work+Sans:ital,wght@0,100..900;1,100..900&family=Noto+Sans+JP:wght@300;400;500;600;700;900&family=JetBrains+Mono:ital,wght@0,400;0,500;0,700;1,400&display=swap">
  <style>${TEMPLATE_CSS}</style>
</head>
<body>
  <div class="screen-shell">
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
