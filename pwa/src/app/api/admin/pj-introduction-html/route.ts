/**
 * POST /api/admin/pj-introduction-html
 *
 * 2026-05-12 まさ要望「雛形のフォーマットそのまま、文字だけ入れ替えて」を実現する実装。
 *
 * 雛形 (pwa/AMD_allPJ_introduction.html) は JavaScript で動的構築するタイプだったので、
 * ブラウザで完全レンダリングした後の HTML 部品 (= CSS + 04 CHALLENERGY section) を
 * src/lib/exec_summary/{template.css, template_section.html} として保存し、それを
 * **テンプレ** として使う。
 *
 * 各 PJ ごとに:
 *   1. Supabase から最新データを集約 (project_ventures / project_knowledge / monthly_reports / founding_members)
 *   2. Sonnet 4.5 に「雛形 CHALLENERGY と同じフォーマットで JSON を返して」と要求
 *      system prompt = llm_prompts.exec_summary.extract (migration 055)
 *   3. JSON を雛形 section の placeholder に流し込む (= 文字置換)
 *   4. 全 PJ 分を連結 + ベース HTML で包む
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

const TEMPLATE_SECTION = readFileSync(
  join(process.cwd(), "src/lib/exec_summary/template_section.html"),
  "utf-8"
);
const TEMPLATE_CSS = readFileSync(
  join(process.cwd(), "src/lib/exec_summary/template.css"),
  "utf-8"
);

/** 雛形 section 文字列を `<section> ... </section>` の 1 つに正規化 (= 末尾 indent 落とす) */
const TEMPLATE_SECTION_TRIMMED = TEMPLATE_SECTION.trim();

function slugify(s: string): string {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24) || "pj";
}

/**
 * 雛形 section の HTML を PjData の値で文字列置換する。
 * 雛形の各 placeholder 位置を **正規表現で識別** して差し替え。
 * 構造ごと書き換えるのは 4 stages / use_cases / stage_pills / touchpoints / status_list の 5 領域。
 */
function renderSection(idx: number, total: number, pj: PjData, projectId: string): string {
  let html = TEMPLATE_SECTION_TRIMMED;
  const seq = String(idx).padStart(2, "0");
  const totalStr = String(total).padStart(2, "0");
  const slug = slugify(pj.chip);

  // ===== <section class="page page--challenergy" data-screen-label="04 Challenergy"> =====
  html = html.replace(
    /^<section class="page page--challenergy" data-screen-label="04 Challenergy">/,
    `<section class="page page--${slug}" data-screen-label="${seq} ${escAttr(pj.chip)}" data-pj-id="${escAttr(projectId)}">`
  );

  // ===== hdr-mid (= "DeepTech Portfolio  /  <b>Team ARMADA が経営・創出に関わる4社</b>") =====
  // 「4社」を total に書き換え (= 6 PJ なら "6社")
  html = html.replace(
    /<div class="hdr-mid">DeepTech Portfolio  \/  <b>Team ARMADA が経営・創出に関わる4社<\/b><\/div>/,
    `<div class="hdr-mid">DeepTech Portfolio  /  <b>Team ARMADA が経営・創出に関わる${total}社</b></div>`
  );

  // ===== page-tag (= num / of / cat) =====
  html = html.replace(
    /<span class="num">04<\/span><span class="of">\/ 04<\/span>\s*<span class="cat">Wind · Resilience<\/span>/,
    `<span class="num">${seq}</span><span class="of">/ ${totalStr}</span>\n        <span class="cat">${esc(pj.category)}</span>`
  );

  // ===== hero: chip + rail_sub + company_name + tagline =====
  html = html.replace(
    /<span class="chip">CHALLENERGY<\/span>\s*<span>2014年設立 \/ 垂直軸型風力発電<\/span>/,
    `<span class="chip">${esc(pj.chip)}</span>\n          <span>${esc(pj.rail_sub)}</span>`
  );
  html = html.replace(
    /<div class="company-name">Challen<span class="accent">e<\/span>rgy<\/div>/,
    `<div class="company-name">${pj.company_name_html}</div>`
  );
  html = html.replace(
    /<div class="tagline">台風や強風でも発電できる、<mark>自治体・離島・公共施設<\/mark>向けの小型風力発電機（販売中）。<\/div>/,
    `<div class="tagline">${pj.tagline_html}</div>`
  );

  // ===== summary =====
  html = html.replace(
    /<div class="summary">\s*一般的なプロペラ風車が苦手な<b>台風 \/ 強風 \/ 乱流環境<\/b>でも発電できる、独自の<b>垂直軸型小型風力発電機<\/b>。すでに「Type D」を販売中で、定格100W \/ 最大250W、<b>耐風速40m\/s<\/b>。自治体の<b>防災電源<\/b>、離島・公共施設の脱炭素、<b>企業版ふるさと納税<\/b>との組み合わせなど、即・地域に提案可能な唯一の販売プロダクト。\s*<\/div>/,
    `<div class="summary">\n          ${pj.summary_html}\n        </div>`
  );

  // ===== 4 stages =====
  const stagesHtml = pj.stages
    .slice(0, 4)
    .map((s, i) => {
      const num = String(i + 1).padStart(2, "0");
      const isProduct = s.is_product || s.kind === "PRODUCT";
      const showArrow = i < 3;
      const listItems = s.list.slice(0, 6).map((li) => `<li>${li}</li>`).join("\n            ");
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
  html = html.replace(
    /<div class="diagram">[\s\S]*?<\/div>\s*\n\s*<div class="footer">/,
    `<div class="diagram">\n      ${stagesHtml}\n    </div>\n\n    <div class="footer">`
  );

  // ===== use_cases (= tag-cloud) =====
  const useCasesHtml = pj.use_cases
    .slice(0, 10)
    .map((u) => `<span class="tag${u.strong ? " is-strong" : ""}">${esc(u.label)}</span>`)
    .join("\n          ");
  html = html.replace(
    /<div class="tag-cloud">[\s\S]*?<\/div>/,
    `<div class="tag-cloud">\n          ${useCasesHtml}\n        </div>`
  );

  // ===== stage_pills =====
  const pillsHtml = pj.stage_pills
    .slice(0, 5)
    .map((p) => {
      const cls = p.state === "now" ? "sp is-now" : p.state === "done" ? "sp is-done" : "sp";
      const tick = p.state === "now" ? '<div class="now-tick">現在地</div>' : "";
      return `<div class="${cls}">${tick}<div class="sp-label">${esc(p.label)}</div></div>`;
    })
    .join("\n            ");
  html = html.replace(
    /<div class="stage-pill-row" style="margin-top:2\.5mm;">[\s\S]*?<\/div>\s*\n\s*<\/div>\s*\n\s*<\/div>/,
    `<div class="stage-pill-row" style="margin-top:2.5mm;">\n            ${pillsHtml}\n          </div>\n        </div>\n      </div>`
  );

  // ===== touchpoints =====
  const tpHtml = pj.touchpoints
    .slice(0, 5)
    .map((t, i) => {
      const num = String(i + 1).padStart(2, "0");
      return `<div class="tp"><div class="tp-num">→ ${num}</div><div>${t.html}</div></div>`;
    })
    .join("\n          ");
  html = html.replace(
    /<div class="touchpoints">[\s\S]*?<\/div>\s*\n\s*<\/div>/,
    `<div class="touchpoints">\n          ${tpHtml}\n        </div>\n      </div>`
  );

  // ===== status_list =====
  const statusHtml = pj.status_list
    .slice(0, 6)
    .map((s) => `<div class="status-row"><div class="k">${esc(s.k)}</div><div class="v">${s.v_html}</div></div>`)
    .join("\n          ");
  html = html.replace(
    /<div class="status-list">[\s\S]*?<\/div>\s*\n\s*<\/div>\s*\n\s*<\/div>\s*\n\s*<div class="page-edge">/,
    `<div class="status-list">\n          ${statusHtml}\n        </div>\n      </div>\n    </div>\n\n    <div class="page-edge">`
  );

  // ===== page-edge =====
  html = html.replace(
    /<div class="page-edge">TEAM <b>ARMADA<\/b> &nbsp;\/&nbsp; DEEPTECH PORTFOLIO &nbsp;\/&nbsp; 04 CHALLENERGY<\/div>/,
    `<div class="page-edge">TEAM <b>ARMADA</b> &nbsp;/&nbsp; DEEPTECH PORTFOLIO &nbsp;/&nbsp; ${seq} ${esc(pj.chip)}</div>`
  );

  return html;
}

function esc(s: string | null | undefined): string {
  if (!s) return "";
  return String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
function escAttr(s: string | null | undefined): string {
  return esc(s).replaceAll('"', "&quot;");
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

  const pages = dataByIdx
    .map((d, i) => renderSection(i + 1, total, d, ordered[i].project_id))
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
