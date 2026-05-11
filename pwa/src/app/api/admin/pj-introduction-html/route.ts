/**
 * POST /api/admin/pj-introduction-html
 *
 * 2026-05-12 まさ要望: ダッシュボード「全PJ紹介資料作成」ボタンから呼ばれる。
 * 雛形 pwa/AMD_allPJ_introduction.html のフォーマット (= `.page` クラス構造 = A4 横、
 * grid-template-rows: 11mm 51mm 58mm 1fr) に **忠実に従って** 1 PJ = 1 ページの HTML を生成する。
 *
 * 雛形構造 (= polish-styles から逆解析):
 *   .page (= A4 横 297×210mm)
 *     .hdr      (11mm)  …armada-mark (logo + typo) + hdr-mid + page-tag
 *     .heading  (51mm)  …company-name (30pt) + tagline (16.4pt) + summary (9.3pt)
 *     .diagram  (58mm)  …4 stages (stage-num / stage-kind / stage-title / stage-list)
 *     .footer   (1fr)   …4 fcol (FUNDING / TEAM / TRACTION / NOW) + 各 fcol h3 (en+jp) + tag / tp / status-row
 *     .page-edge        …TEAM ARMADA / DEEPTECH PORTFOLIO / 0X COMPANY
 *
 * ロゴ画像: public/AMD_logo_mark.png + AMD_logotype.png (= 元 /Users/masa/projects/AMD/logo_only3.png 等)。
 *
 * Phase 1 (本実装): Supabase の既存データ (project_ventures.long_description / narrative_text、
 *                   project_knowledge basic_fact、project_founding_members) から埋める。
 *                   stages / status_rows は LLM (Sonnet) で 1 PJ ごとに簡易抽出 (省略可能)。
 *
 * Body: { project_ids: string[] }
 * Response: Content-Type=text/html; charset=utf-8
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 120;

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

function esc(s: string | null | undefined): string {
  if (!s) return "";
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Lane の英語表示ラベル */
const LANE_EN: Record<string, string> = {
  energy: "ENERGY",
  energy_environment: "ENERGY & ENVIRONMENT",
  semiconductor: "SEMICONDUCTOR",
  materials: "MATERIALS",
  bio: "BIOTECH",
  bio_health: "BIO & HEALTH",
  ai: "AI / SOFTWARE",
  quantum: "QUANTUM",
  space: "SPACE",
  mobility: "MOBILITY",
  manufacturing: "MANUFACTURING",
  agritech: "AGRI & FOOD",
  robotics: "ROBOTICS",
};

/** 1 PJ あたりのページ HTML を雛形の class 体系で組む */
function renderPjPage(
  idx: number,
  total: number,
  proj: ProjectRow,
  venture: VentureRow | null,
  basicFacts: KnowledgeRow[],
  founders: FounderRow[],
  _latestReport: MonthlyReportRow | null
): string {
  const seq = String(idx).padStart(2, "0");
  const company = esc(venture?.display_name || proj.project_name).toUpperCase();
  const companyMixed = esc(venture?.display_name || proj.project_name);
  const lane = (venture?.lane || "").toLowerCase();
  const laneEn = LANE_EN[lane] || lane.toUpperCase() || "DEEP TECH";
  const tagline = esc(venture?.short_description || "");
  const summary = esc(
    venture?.long_description || venture?.narrative_text || ""
  );

  // basic_fact から拾える項目
  const factMap = new Map<string, string>();
  for (const f of basicFacts) {
    if (f.entity_name && f.fact_text) factMap.set(f.entity_name, f.fact_text);
  }

  // 4 stages (= 雛形では事業フェーズの 4 段階)
  // PJ の段階は仮で TECH / PoC / PRODUCT / SCALE。outcome_pattern や founded_at で「現在地」をマーキング
  const stages = [
    { num: "01", kind: "技術検証", kindEn: "TECH SEED", title: esc(venture?.origin_org || "起源組織"), list: ["大学・研究機関由来の独自技術"] },
    { num: "02", kind: "事業仮説", kindEn: "PoC / PROTOTYPE", title: "市場検証・PoC", list: ["顧客課題仮説の検証", "プロトタイプ開発"] },
    { num: "03", kind: "事業化", kindEn: "PRODUCT", title: "製品化・初期売上", list: ["プロダクト商用化", "初期受注獲得"] },
    { num: "04", kind: "拡大", kindEn: "SCALE", title: "拡大・量産", list: ["量産体制", "海外展開"] },
  ];

  // outcome_pattern と founded_at から現在 stage 推定 (= ピル位置)
  const currentStageIdx = (() => {
    if (!venture?.founded_at) return 0;
    const outcome = venture.outcome_pattern || "active";
    if (outcome === "planning") return 0;
    if (outcome === "burnout" || outcome === "ue_fail") return 1;
    if (outcome === "smb") return 2;
    if (outcome === "exit_ipo" || outcome === "exit_ma") return 3;
    // active: 設立後の経過年数で進捗推定
    const founded = new Date(venture.founded_at).getTime();
    const years = (Date.now() - founded) / (365.25 * 86400 * 1000);
    if (years < 1) return 1;
    if (years < 3) return 2;
    return 3;
  })();

  const stagesHtml = stages
    .map((s, i) => {
      const isNow = i === currentStageIdx;
      return `
        <div class="stage${isNow ? " stage-now" : ""}">
          <div class="stage-head">
            <span class="stage-num">${s.num}</span>
            <span class="stage-kind">${esc(s.kindEn)}<br/><b>${esc(s.kind)}</b></span>
          </div>
          <div class="stage-body">
            <div class="stage-title">${s.title}</div>
            <ul class="stage-list">
              ${s.list.map((li) => `<li>${esc(li)}</li>`).join("")}
            </ul>
          </div>
        </div>
      `;
    })
    .join("");

  // pill row (= 現在地マーカー)
  const pillsHtml = stages
    .map((s, i) => {
      const isNow = i === currentStageIdx;
      return `<div class="sp${isNow ? " sp-now" : ""}">${isNow ? '<span class="now-tick">NOW</span>' : ""}<span class="sp-label">${esc(s.kind)}</span></div>`;
    })
    .join("");

  // founders → TEAM fcol
  const founderRows = founders.slice(0, 5).map((f) => {
    const name = esc(f.person_name);
    const aff = esc(f.affiliation || "");
    const role = esc(f.role_label_jp || f.role || "");
    return `<div class="status-row"><div class="k">${role}</div><div class="v"><b>${name}</b>${aff ? ` / ${aff}` : ""}</div></div>`;
  }).join("");

  // FUNDING fcol (= founded_at + basic_fact「資金調達」キー)
  const fundingTag = esc(
    factMap.get("資金調達") ||
      factMap.get("Funding") ||
      (venture?.founded_at ? `設立 ${venture.founded_at.slice(0, 7)}` : "ステージ未公開")
  );

  // TRACTION fcol
  const traction = esc(
    factMap.get("実績") || factMap.get("Traction") || "実績データは集約待ち"
  );

  // NOW fcol (= 直近の動き)
  const nowFact = esc(
    factMap.get("Now") ||
      factMap.get("直近") ||
      factMap.get("進行中") ||
      (venture?.outcome_pattern === "active" ? "事業推進中" : esc(venture?.outcome_pattern || "—"))
  );

  return `
<section class="page" data-pj="${esc(proj.project_id)}">
  <header class="hdr">
    <div class="armada-mark">
      <img class="armada-logo-img" src="/AMD_logo_mark.png" alt="Team ARMADA"/>
      <img class="armada-typo-img" src="/AMD_logotype.png" alt="team ARMADA"/>
    </div>
    <div class="hdr-mid">
      DEEPTECH PORTFOLIO / ${seq} of ${String(total).padStart(2, "0")}<br/>
      <span class="hdr-mid-sub">Team ARMADA Operating System — Generated ${new Date().toISOString().slice(0, 10)}</span>
    </div>
    <div class="page-tag">
      <span class="page-tag-en">${esc(laneEn)}</span>
      <span class="page-tag-jp">${esc(proj.status).toUpperCase()}</span>
    </div>
  </header>

  <div class="heading">
    <h2 class="company-name">${company}</h2>
    <div class="tagline">${tagline || "<em style=\"color:#888;font-style:italic\">tagline (short_description) を /admin/projects で設定してください</em>"}</div>
    <p class="summary">${summary ? summary.replaceAll("\n", "<br/>") : "long_description / narrative_text 未設定。/admin/projects または PJ コックピットで入力すると、ここに自動反映されます。"}</p>
  </div>

  <div class="diagram">
    ${stagesHtml}
  </div>

  <div class="footer">
    <div class="fcol">
      <h3><span class="en">FUNDING</span><span class="jp">資金 / フェーズ</span></h3>
      <div class="tag">${fundingTag}</div>
      <div class="tp">
        <span class="tp-num">FOUNDED</span> <b>${esc(venture?.founded_at?.slice(0, 7) || "—")}</b>
      </div>
      <div class="tp">
        <span class="tp-num">AMD SUPPORT</span>
        <b>${esc(venture?.amd_support_started_at?.slice(0, 7) || "—")} 〜 ${esc(venture?.amd_support_ended_at?.slice(0, 7) || "現在")}</b>
      </div>
    </div>

    <div class="fcol">
      <h3><span class="en">TEAM</span><span class="jp">創業メンバー</span></h3>
      <div class="status-list">
        ${founderRows || '<div class="status-row"><div class="k">—</div><div class="v">創業メンバー未抽出 (cron/founding-members-extract 待ち)</div></div>'}
      </div>
    </div>

    <div class="fcol">
      <h3><span class="en">TRACTION</span><span class="jp">トラクション</span></h3>
      <div class="tag">${traction}</div>
    </div>

    <div class="fcol">
      <h3><span class="en">NOW</span><span class="jp">直近の動き</span></h3>
      <div class="status-list">
        <div class="status-row"><div class="k">Status</div><div class="v"><b>${esc(proj.status).toUpperCase()}</b></div></div>
        <div class="status-row"><div class="k">Now</div><div class="v">${nowFact}</div></div>
        <div class="status-row"><div class="k">PI</div><div class="v">${esc(venture?.origin_pi || "—")}</div></div>
      </div>
    </div>
  </div>

  <div class="page-edge">TEAM <b>ARMADA</b> &nbsp;/&nbsp; DEEPTECH PORTFOLIO &nbsp;/&nbsp; ${seq} ${company}</div>
</section>
`;
}

/** 雛形 polish-styles の主要 selector を取り込んだベース CSS */
const PAGE_CSS = `
:root {
  --polish-paper-shadow: 0 18px 56px rgba(0, 0, 0, .28);
}
* { margin: 0; padding: 0; box-sizing: border-box; }
html { -webkit-font-smoothing: antialiased; text-rendering: geometricPrecision; }
body {
  background: #0c0e10;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Hiragino Sans", "Yu Gothic", "Noto Sans JP", sans-serif;
  color: #0f172a;
  overflow-x: hidden;
  padding: 24px 0;
}
.deck { display: flex; flex-direction: column; align-items: center; gap: 22px; width: 100%; }

.page {
  position: relative;
  width: 297mm;
  height: 210mm;
  background: #ffffff;
  display: grid;
  grid-template-rows: 11mm 51mm 58mm 1fr;
  gap: 3mm;
  padding: 11mm 13mm 8mm 13mm;
  overflow: hidden;
  box-shadow: var(--polish-paper-shadow);
  color: #0f172a;
}

/* ===== HDR (11mm) ===== */
.hdr {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  min-height: 16mm;
  gap: 5mm;
  border-bottom: 0.25mm solid #d4d4d8;
  padding-bottom: 2mm;
}
.armada-mark { display: flex; align-items: center; gap: 2.6mm; min-width: 48mm; height: 10mm; }
.armada-logo-img { display: block; width: 8.8mm; height: 8.8mm; object-fit: contain; flex: 0 0 auto; }
.armada-typo-img { display: block; width: 34mm; height: auto; object-fit: contain; flex: 0 0 auto; }
.hdr-mid {
  font-size: 7.8pt; line-height: 1.35; letter-spacing: .02em;
  color: #475569; font-family: ui-monospace, "SF Mono", Menlo, monospace;
}
.hdr-mid-sub { color: #94a3b8; font-size: 6.6pt; }
.page-tag {
  min-width: 30mm; text-align: right;
  display: flex; flex-direction: column; gap: 1mm;
}
.page-tag-en {
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 8.4pt; letter-spacing: .18em; color: #0e7490; font-weight: 700;
}
.page-tag-jp {
  font-size: 6.6pt; letter-spacing: .14em; color: #64748b;
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
}

/* ===== HEADING (51mm) ===== */
.heading { display: flex; flex-direction: column; justify-content: center; gap: 4mm; }
.company-name {
  font-size: 30pt; line-height: 1; letter-spacing: -.01em;
  overflow-wrap: anywhere; color: #0f172a; font-weight: 800;
}
.tagline {
  font-size: 16.4pt; line-height: 1.25; letter-spacing: 0;
  overflow-wrap: normal; word-break: keep-all; color: #1e3a8a; font-weight: 500;
}
.summary {
  font-size: 9.3pt; line-height: 1.58; color: #1e293b;
  max-width: 240mm;
}

/* ===== DIAGRAM (58mm) ===== */
.diagram {
  position: relative;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 3mm; align-items: stretch;
}
.diagram::before {
  content: "";
  position: absolute;
  left: 0; right: 0;
  top: 12.4mm;
  height: 0.4mm;
  background: linear-gradient(to right, #cbd5e1, #cbd5e1);
  pointer-events: none;
  z-index: 0;
}
.stage {
  position: relative; z-index: 1;
  display: flex; flex-direction: column;
  min-height: 0;
  border-left: 0.4mm solid #cbd5e1;
  padding-left: 3mm;
}
.stage.stage-now { border-left-color: #0ea5e9; }
.stage-head {
  display: flex; height: 12.4mm; margin-bottom: 1.4mm;
  align-items: flex-start; gap: 1.8mm;
}
.stage-num {
  font-size: 19pt; line-height: .95; font-weight: 800;
  color: #94a3b8; font-family: ui-monospace, "SF Mono", Menlo, monospace;
}
.stage.stage-now .stage-num { color: #0ea5e9; }
.stage-kind {
  padding-top: 1.1mm; font-size: 6.4pt; line-height: 1.08;
  letter-spacing: .18em; color: #64748b; text-transform: uppercase;
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
}
.stage-kind b {
  display: block; font-size: 7pt; line-height: 1.16; margin-top: 1.1mm;
  letter-spacing: .06em; color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, sans-serif;
}
.stage-body { padding-top: 3.2mm; padding-bottom: 3.8mm; }
.stage-title {
  font-size: 9.8pt; line-height: 1.24; font-weight: 600;
  margin-bottom: 1.5mm; color: #0f172a;
}
.stage-list {
  list-style: disc;
  padding-left: 4mm;
  display: flex; flex-direction: column; gap: 0.8mm;
}
.stage-list li {
  font-size: 7.4pt; line-height: 1.35; color: #475569;
}

/* ===== Stage pill row (現在地マーカー) ===== */
.stage-pill-row {
  position: absolute; left: 0; right: 0; bottom: 0;
  display: grid; grid-template-columns: repeat(4, 1fr);
  gap: 1.5mm; margin-top: 6.2mm; padding: 0;
}
.sp { position: relative; height: 3mm; background: #e2e8f0; border-radius: 1.5mm; display: flex; align-items: center; justify-content: center; }
.sp.sp-now { background: #0ea5e9; }
.sp-label { font-size: 6.6pt; color: #64748b; }
.sp.sp-now .sp-label { color: white; font-weight: 600; }
.now-tick { position: absolute; bottom: calc(100% + 1.1mm); left: 50%; transform: translateX(-50%); font-size: 6.3pt; color: #0ea5e9; font-weight: 700; white-space: nowrap; }
.now-tick::after {
  content: "";
  display: block; margin: .25mm auto 0;
  width: 0; height: 0;
  border-left: .85mm solid transparent;
  border-right: .85mm solid transparent;
  border-top: .85mm solid #0ea5e9;
}

/* ===== FOOTER (1fr) ===== */
.footer {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 3.5mm; align-items: stretch;
  padding-top: 3mm;
  border-top: 0.25mm solid #d4d4d8;
}
.fcol { min-width: 0; display: flex; flex-direction: column; gap: 2mm; }
.fcol h3 {
  display: flex; align-items: baseline; gap: 2mm;
  line-height: 1.25; margin-bottom: 1mm;
  font-weight: 700;
}
.fcol h3 .en {
  font-size: 8.4pt; letter-spacing: .18em; color: #0e7490;
  font-family: ui-monospace, "SF Mono", Menlo, monospace; text-transform: uppercase;
}
.fcol h3 .jp { font-size: 8.4pt; letter-spacing: 0; color: #475569; }
.tag {
  font-size: 7.6pt; line-height: 1.22; padding: 1.6mm 2.3mm;
  background: #f1f5f9; border-radius: 1mm; color: #0f172a;
  align-self: flex-start;
}
.tp { display: flex; gap: 2.2mm; padding-block: 1.65mm; align-items: baseline; font-size: 7.8pt; }
.tp b { font-size: 7.8pt; font-weight: 700; color: #0f172a; }
.tp-num { font-size: 6.7pt; line-height: 1.2; white-space: nowrap; color: #64748b; letter-spacing: .12em; font-family: ui-monospace, monospace; }
.status-list { display: flex; flex-direction: column; gap: 1.3mm; }
.status-row {
  display: grid; grid-template-columns: 18mm 1fr; gap: 2mm;
  font-size: 7.8pt; line-height: 1.38;
}
.status-row .k { font-size: 6.7pt; line-height: 1.2; white-space: nowrap; color: #64748b; letter-spacing: .12em; font-family: ui-monospace, monospace; }
.status-row .v { font-size: 7.8pt; color: #0f172a; }
.status-row .v b { font-weight: 700; }

/* ===== Page edge (= フッタテキスト) ===== */
.page-edge {
  position: absolute;
  bottom: 4mm;
  left: 50%;
  transform: translateX(-50%);
  font-size: 6.3pt;
  letter-spacing: .12em;
  color: #94a3b8;
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  white-space: nowrap;
}
.page-edge b { color: #475569; }

/* ===== 印刷時 ===== */
@media print {
  body { background: #fff !important; padding: 0 !important; }
  .deck { gap: 0; }
  .page {
    width: 297mm !important;
    height: 210mm !important;
    margin: 0 !important;
    box-shadow: none !important;
    break-after: page !important;
    page-break-after: always !important;
  }
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

  const pages = ordered
    .map((proj, i) =>
      renderPjPage(
        i + 1,
        ordered.length,
        proj,
        ventureMap.get(proj.project_id) || null,
        knowMap.get(proj.project_id) || [],
        fndMap.get(proj.project_id) || [],
        latestReportMap.get(proj.project_id) || null
      )
    )
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <title>Team ARMADA — DeepTech ${ordered.length}社 紹介資料</title>
  <style>${PAGE_CSS}</style>
</head>
<body>
  <div class="deck portfolio">
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
