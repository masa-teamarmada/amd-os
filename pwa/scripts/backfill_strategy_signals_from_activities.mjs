#!/usr/bin/env node
/**
 * Backfill L2 ⑨ project_strategy_signals from existing OS activity rows.
 *
 * This is intentionally deterministic and conservative: it does not call an LLM
 * or raw external systems. It promotes already-extracted member_activities into
 * reviewable candidate strategy signals with source refs.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
loadEnv(path.join(ROOT, ".env.local"));
loadEnv(path.join(ROOT, ".env.production.local"));

const SUPABASE_URL = env("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_KEY = env("SUPABASE_SERVICE_ROLE_KEY");

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const idx = trimmed.indexOf("=");
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function env(key) {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is required`);
  return value.trim();
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      out._.push(arg);
      continue;
    }
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      out[key] = true;
    } else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

async function get(table, query) {
  const url = `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/${table}?${query}`;
  const res = await fetch(url, {
    headers: {
      apikey: SERVICE_KEY,
      authorization: `Bearer ${SERVICE_KEY}`,
      accept: "application/json",
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${table} ${res.status}: ${text}`);
  return text ? JSON.parse(text) : [];
}

function enc(value) {
  return encodeURIComponent(String(value));
}

function stableHash(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function number(value, fallback = 0) {
  const n = typeof value === "number" ? value : Number(value ?? fallback);
  return Number.isFinite(n) ? n : fallback;
}

function asObject(value) {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      return asObject(JSON.parse(value));
    } catch {
      return {};
    }
  }
  return typeof value === "object" && !Array.isArray(value) ? value : {};
}

const INCLUDE_RE = /(合意|決定|確定|方針|戦略|転換|断念|出願|特許|知財|NDA|締結|契約|DD|投資|VC|資本政策|CEO|PoC|サンプル|候補|候補地|入札|開札|受注|有償|売上|提携|連携|URA|大学|法人会員|加入|交渉|提供|開始|完了|試運転|公開|リスク|損失|遅延|失注|補助金|申請)/;
const EXCLUDE_RE = /(予定から検出|^予定:|報酬配分|支払|AMD-OS|PJコックピット|経営(?:会議)の定期開催|事務手続き|月次試算表)/;

function signalTypeFor(row) {
  const source = `${row.title || ""}\n${row.content_preview || ""}`;
  if (/(投資|VC|JAFCO|ファンド|資本政策|DD|デューデリ)/i.test(source)) return "funding";
  if (/(特許|知財|NDA|秘匿|非公開|規制|認証|許認可)/.test(source)) return "ip_regulatory";
  if (/(リスク|損失|遅延|失注|不透明|締め切りが不明|避ける)/.test(source)) return "risk";
  if (/(PoC|サンプル|商談|受注|契約|入札|開札|有償|売上|顧客)/i.test(source)) return "commercial_progress";
  if (/(提携|連携|URA|大学|岩谷|ダイキアクシス|ファインケム|CBRE|JAFCO|三菱総研|プラチナ構想)/.test(source)) return "partnership";
  if (/(方針|決定|合意|確定|断念|CEO|登記事項|株式|スコープ)/.test(source)) return "management_decision";
  if (/(変更|転換|ピボット|見直し)/.test(source)) return "strategic_pivot";
  if (/(次|予定|目標|設定|準備)/.test(source)) return "next_move";
  return "business_progress";
}

function decisionStateFor(row) {
  const source = `${row.initiative_origin || ""}\n${row.title || ""}\n${row.content_preview || ""}`;
  if (/(変更|修正|断念|避ける|見直し)/.test(source)) return "revised";
  if (/(co_decided|決定|合意|確定|締結|出願完了|完了)/.test(source)) return "decided";
  if (/(開始|推進|進行|対応中|準備中|試運転|実施中)/.test(source)) return "executing";
  if (/(partner_proposed|amd_proposed|提案|候補|見込み|予定|目標)/.test(source)) return "proposed";
  return "observed";
}

function impactLevelFor(row) {
  const impact = number(row.impact, 0);
  if (impact >= 5) return "critical";
  if (impact >= 4) return "high";
  if (impact >= 3) return "medium";
  return "low";
}

function signalDateFor(row) {
  const itemDate = text(row.item_date);
  if (/^\d{4}-\d{2}-\d{2}/.test(itemDate)) return itemDate.slice(0, 10);
  const ym = text(row.ym);
  return /^\d{6}$/.test(ym) ? `${ym.slice(0, 4)}-${ym.slice(4, 6)}-15` : null;
}

function evidenceRefsFor(row, sourceHash) {
  const meta = asObject(row.raw_metadata);
  const refs = Array.isArray(meta.evidence_refs) ? meta.evidence_refs : [];
  const base = {
    source: row.source || "member_activities",
    source_item_id: row.source_item_id || row.id || "",
    title: row.title || "",
    snippet: row.content_preview || "",
    item_date: row.item_date || null,
    member_id: row.member_id || null,
    milestone_id: row.milestone_id || null,
    source_url: meta.source_url || null,
    hash: sourceHash,
    source_hash: sourceHash,
  };
  return [base, ...refs.slice(0, 3)];
}

function rowScore(row) {
  const src = `${row.title || ""}\n${row.content_preview || ""}`;
  let score = number(row.impact, 0) * 10 + number(row.depth, 0) * 2;
  if (INCLUDE_RE.test(src)) score += 10;
  if (/(決定|合意|出願|締結|JAFCO|特許|PoC|CEO|契約|入札|リスク)/.test(src)) score += 8;
  if (row.source === "member_weekly") score += 3;
  return score;
}

function shouldUse(row) {
  const title = text(row.title);
  const summary = text(row.content_preview);
  if (!title || !summary) return false;
  const source = `${title}\n${summary}`;
  if (EXCLUDE_RE.test(source)) return false;
  return number(row.impact, 0) >= 3 || INCLUDE_RE.test(source);
}

function buildSignal(row, projectName, extractionRunId) {
  const sourceHash = stableHash({
    project_id: row.project_id,
    ym: row.ym,
    source: row.source,
    source_item_id: row.source_item_id || row.id,
    title: row.title,
    summary: row.content_preview,
  });
  const refs = evidenceRefsFor(row, sourceHash);
  const signalType = signalTypeFor(row);
  return {
    signal: {
      project_id: row.project_id,
      ym: row.ym,
      signal_date: signalDateFor(row),
      signal_type: signalType,
      title: text(row.title).slice(0, 180),
      summary: text(row.content_preview).slice(0, 900),
      impact_level: impactLevelFor(row),
      decision_state: decisionStateFor(row),
      status: "candidate",
      source_refs_json: refs,
      source_hash: sourceHash,
      confidence: Math.min(0.92, 0.58 + number(row.impact, 2) * 0.06 + number(row.depth, 0) * 0.03),
      extraction_run_id: extractionRunId,
      created_by: "strategy_signal_backfill",
    },
    notification: {
      l2_kind: "project_strategy_signal",
      target_id: row.project_id,
      scope_key: `${row.ym}:strategy:${sourceHash.slice(0, 12)}`,
      title: `🧭 ${projectName}: ${text(row.title).slice(0, 42)} を経営ハイライトにする？`,
      summary: text(row.content_preview).slice(0, 450),
      saved_count: 1,
      total_count: 1,
      importance: number(row.impact, 0) >= 4 ? 2 : 1,
      metadata_json: {
        signal_type: signalType,
        signal_source_hash: sourceHash,
        evidence_refs: refs,
      },
    },
    score: rowScore(row),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const fromYm = text(args["from-ym"]) || "202601";
  const toYm = text(args["to-ym"]) || new Date().toISOString().slice(0, 7).replace("-", "");
  const maxPerProject = Number(args["max-per-project"] || 10);
  const maxPerProjectMonth = Number(args["max-per-project-month"] || 4);
  const maxTotal = Number(args["max-total"] || 80);
  const out = text(args.out) || path.join(process.cwd(), `strategy-signals-backfill-${Date.now()}.json`);
  const extractionRunId = `strategy-backfill-${new Date().toISOString()}`;

  const projects = await get(
    "projects",
    "select=project_id,project_name,status,project_category&status=eq.active&order=project_id.asc"
  );
  const projectMap = new Map(projects.map((p) => [p.project_id, p]));
  const projectIds = projects.map((p) => p.project_id);

  const rows = await get(
    "member_activities",
    [
      "select=id,member_id,project_id,ym,source,source_item_id,title,content_preview,item_date,raw_metadata,milestone_id,initiative_origin,impact,depth",
      `ym=gte.${enc(fromYm)}`,
      `ym=lte.${enc(toYm)}`,
      "order=ym.desc,item_date.desc",
      "limit=5000",
    ].join("&")
  );

  const byProjectMonth = new Map();
  for (const row of rows) {
    if (!projectMap.has(row.project_id) || !projectIds.includes(row.project_id)) continue;
    if (!shouldUse(row)) continue;
    const project = projectMap.get(row.project_id);
    const built = buildSignal(row, project?.project_name || row.project_id, extractionRunId);
    const key = `${row.project_id}:${row.ym}`;
    if (!byProjectMonth.has(key)) byProjectMonth.set(key, []);
    byProjectMonth.get(key).push(built);
  }

  const byProject = new Map();
  for (const [key, items] of byProjectMonth) {
    const [projectId] = key.split(":");
    const selected = items.sort((a, b) => b.score - a.score).slice(0, maxPerProjectMonth);
    if (!byProject.has(projectId)) byProject.set(projectId, []);
    byProject.get(projectId).push(...selected);
  }

  const chosen = [];
  for (const items of byProject.values()) {
    chosen.push(...items.sort((a, b) => b.score - a.score).slice(0, maxPerProject));
  }
  const finalItems = chosen.sort((a, b) => b.score - a.score).slice(0, maxTotal);

  const payload = {
    generatedAt: new Date().toISOString(),
    ym: `${fromYm}-${toYm}`,
    source: "strategy-signal-backfill-from-member-activities",
    strategySignals: finalItems.map((item) => item.signal),
    notifications: finalItems.map((item) => item.notification),
    notes: [
      `Backfilled from member_activities ${fromYm}-${toYm}.`,
      `Deterministic filter: impact>=3 or strategy keywords, excluding routine/admin rows.`,
    ],
  };

  fs.writeFileSync(out, `${JSON.stringify(payload, null, 2)}\n`);
  process.stdout.write(JSON.stringify({
    ok: true,
    out,
    fromYm,
    toYm,
    projectCount: projects.length,
    sourceRows: rows.length,
    signalCount: payload.strategySignals.length,
    notificationCount: payload.notifications.length,
    byProject: payload.strategySignals.reduce((acc, row) => {
      acc[row.project_id] = (acc[row.project_id] || 0) + 1;
      return acc;
    }, {}),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
