#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

function readEnv(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) return env;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#") || !line.includes("=")) continue;
    const [key, ...rest] = line.split("=");
    env[key.trim()] = rest.join("=").trim().replace(/^['"]|['"]$/g, "");
  }
  return env;
}

const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const m = arg.match(/^--([^=]+)=(.*)$/);
  return m ? [m[1], m[2]] : [arg.replace(/^--/, ""), "1"];
}));

const env = {
  ...readEnv(path.join(process.cwd(), ".env.local")),
  ...readEnv(path.join(process.cwd(), "pwa/.env.local")),
  ...process.env,
};

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set");
  process.exit(1);
}

function currentYmJst() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return `${jst.getUTCFullYear()}${String(jst.getUTCMonth() + 1).padStart(2, "0")}`;
}

function sha256(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function num(value, fallback = null) {
  if (value === null || value === undefined || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function includesAny(text, words) {
  const value = String(text || "").toLowerCase();
  return words.some((word) => value.includes(String(word).toLowerCase()));
}

async function restGet(table, query) {
  const url = `${supabaseUrl}/rest/v1/${table}?${query}`;
  const res = await fetch(url, {
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
      accept: "application/json",
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${table}: ${res.status} ${text}`);
  return text ? JSON.parse(text) : [];
}

async function fetchPaged(table, query, pageSize = 1000) {
  const out = [];
  for (let offset = 0; ; offset += pageSize) {
    const rows = await restGet(table, `${query}&limit=${pageSize}&offset=${offset}`);
    out.push(...rows);
    if (rows.length < pageSize) return out;
  }
}

const COMPANY_TERMS = [
  "amd", "team armada", "チームアルマダ", "会社", "全社", "経営", "売上", "入金", "請求", "契約",
  "商談", "提案", "営業", "パイプライン", "pipeline", "資金", "資金繰り", "runway", "固定費",
  "報酬", "人員", "稼働", "リソース", "外注", "採用", "導入", "pilot", "PoC",
];
const PIPELINE_TERMS = ["契約", "商談", "提案", "営業", "pipeline", "パイプライン", "導入", "PoC", "pilot", "請求", "見積", "高確度", "予算", "受託", "承認", "ミッション", "売上", "来年度"];
const PROJECT_ONLY_TERMS = ["技術", "実験", "TRL", "特許", "論文", "装置", "研究論点", "設立", "顧客仮説", "LST", "p07"];
const HIGH_CONFIDENCE_NAMES = ["香川", "kagawa", "KUTE", "SX", "NIMS", "CX"];

function inferCompanyScoreAxis(row, text) {
  if (String(row.signal_type) === "funding" || includesAny(text, ["資金調達", "ファンド"])) return "funding";
  if (includesAny(text, ["資金繰り", "runway", "固定費", "報酬", "入金", "請求"])) return "finance";
  if (includesAny(text, ["人員", "稼働", "外注", "採用", "リソース"])) return "capacity";
  if (String(row.signal_type) === "commercial_progress" || includesAny(text, PIPELINE_TERMS)) return "pipeline";
  if (String(row.signal_type) === "management_decision" || includesAny(text, ["優先", "撤退", "保留", "注力", "資源配分"])) return "decision";
  return null;
}

function classifySignal(row) {
  const text = `${row.project_id || ""} ${row.signal_type || ""} ${row.title || ""} ${row.summary || ""} ${row.score_impact_summary || ""}`;
  const axis = inferCompanyScoreAxis(row, text);
  const companyish = String(row.project_id) === "p00" || includesAny(text, COMPANY_TERMS);
  const highConfidenceNamedPipeline = includesAny(text, HIGH_CONFIDENCE_NAMES) && includesAny(text, PIPELINE_TERMS);
  const projectOnly = includesAny(text, PROJECT_ONLY_TERMS) && !highConfidenceNamedPipeline && axis !== "finance";
  const probability = Math.max(
    num(row.pipeline_probability, 0) ?? 0,
    num(row.confidence, 0) ?? 0,
    highConfidenceNamedPipeline ? 0.82 : 0,
  );

  if ((companyish || highConfidenceNamedPipeline) && axis && !projectOnly) {
    const companyScoreAxis = highConfidenceNamedPipeline && ["funding", "revenue"].includes(axis) ? "pipeline" : axis;
    const pipeline = companyScoreAxis === "pipeline";
    return {
      signal_id: row.signal_id,
      project_id: row.project_id,
      ym: row.ym,
      title: row.title,
      signal_scope: String(row.project_id) === "p00" ? "company" : "cross_project",
      applies_to_company_score: true,
      pipeline_status: pipeline ? (probability >= 0.75 ? "high_confidence" : "prospect") : null,
      pipeline_probability: pipeline ? Number(probability.toFixed(2)) : null,
      expected_amount_yen: row.expected_amount_yen ?? null,
      expected_contract_ym: row.expected_contract_ym || row.ym || null,
      company_score_axis: companyScoreAxis,
      scope_reason: highConfidenceNamedPipeline
        ? "契約前でもAMD会社全体の営業・契約pipelineに効く高確度案件"
        : "AMD会社全体の経営バイタルへ直接効くsignal",
      confidence: row.confidence,
      status: row.status,
      signal_type: row.signal_type,
      source_hash: sha256({ signal_id: row.signal_id, mode: "company-vital-scope-dry-run-v1" }).slice(0, 16),
    };
  }

  return {
    signal_id: row.signal_id,
    project_id: row.project_id,
    ym: row.ym,
    title: row.title,
    signal_scope: "project",
    applies_to_company_score: false,
    pipeline_status: null,
    pipeline_probability: null,
    expected_amount_yen: null,
    expected_contract_ym: null,
    company_score_axis: null,
    scope_reason: projectOnly
      ? "個別PJの技術・実験・設立・顧客論点であり、AMD会社バイタルではない"
      : "会社全体の売上・契約・資金・稼働への直接影響を確認できない",
    confidence: row.confidence,
    status: row.status,
    signal_type: row.signal_type,
    source_hash: sha256({ signal_id: row.signal_id, mode: "company-vital-scope-dry-run-v1" }).slice(0, 16),
  };
}

async function backfillDryRun() {
  const fromYm = args["from-ym"] || "202501";
  const toYm = args["to-ym"] || currentYmJst();
  const select = [
    "signal_id", "project_id", "ym", "signal_date", "signal_type", "status", "decision_state",
    "title", "summary", "impact_level", "confidence", "created_at", "confirmed_at",
    "polarity", "score_impact_summary", "signal_scope", "applies_to_company_score",
    "pipeline_status", "pipeline_probability", "expected_amount_yen", "expected_contract_ym",
    "company_score_axis", "scope_reason",
  ].join(",");
  const rows = await fetchPaged(
    "project_strategy_signals",
    `select=${select}&or=(ym.gte.${fromYm},ym.is.null)&ym=lte.${toYm}&status=in.(candidate,confirmed)&order=created_at.desc`
  ).catch(async () => fetchPaged(
    "project_strategy_signals",
    `select=${select}&status=in.(candidate,confirmed)&order=created_at.desc`
  ));
  const filtered = rows.filter((row) => !row.ym || (String(row.ym) >= fromYm && String(row.ym) <= toYm));
  const patches = filtered.map(classifySignal);
  const companyPatches = patches.filter((row) => row.applies_to_company_score);
  const projectPatches = patches.filter((row) => !row.applies_to_company_score);
  const named = patches.filter((row) => includesAny(`${row.title} ${row.project_id}`, HIGH_CONFIDENCE_NAMES));
  const suspiciousDropped = projectPatches.filter((row) => includesAny(row.title, [...HIGH_CONFIDENCE_NAMES, ...PIPELINE_TERMS]));
  return {
    ok: true,
    mode: "backfill-dry-run",
    fromYm,
    toYm,
    total: patches.length,
    counts: {
      company: companyPatches.filter((row) => row.signal_scope === "company").length,
      cross_project: companyPatches.filter((row) => row.signal_scope === "cross_project").length,
      project: projectPatches.length,
      company_pipeline: companyPatches.filter((row) => row.company_score_axis === "pipeline").length,
    },
    namedPipelineReview: named,
    suspiciousDropped,
    patches,
  };
}

async function diagnoseScore() {
  const ym = args.ym || currentYmJst();
  const snapshotRows = await restGet(
    "amd_management_score_snapshots",
    `select=*&ym=eq.${ym}&limit=1`
  );
  const snapshot = snapshotRows[0] || null;
  const rawRows = await fetchPaged(
    "amd_management_score_raw_signals",
    `select=ym,axis,source_kind,source_table,source_id,signal_key,signal_value_numeric,signal_value_text,project_id,observed_at,confidence,weight_hint,payload&ym=eq.${ym}&order=axis.asc`
  );
  const evidence = snapshot
    ? await restGet(
      "amd_management_score_evidence",
      `select=axis,evidence_kind,summary,source_type,source_ref,impact,confidence,payload&snapshot_id=eq.${snapshot.id}&order=axis.asc,impact.desc`
    )
    : [];
  const byAxis = {};
  for (const axis of ["retention", "pipeline", "direction"]) {
    const axisRows = rawRows.filter((row) => row.axis === axis);
    byAxis[axis] = {
      score: snapshot?.[`${axis}_score`] ?? null,
      rawCount: axisRows.length,
      bySourceKind: axisRows.reduce((acc, row) => {
        acc[row.source_kind] = (acc[row.source_kind] || 0) + 1;
        return acc;
      }, {}),
      inputs: snapshot?.inputs_json?.axisInputs?.[axis] ?? null,
      evidence: evidence.filter((row) => row.axis === axis),
      samples: axisRows.slice(0, 25),
    };
  }
  const commercialRaw = rawRows.filter((row) => row.source_kind === "commercial_progress");
  const p00FallbackOnly = commercialRaw.filter((row) => row.project_id === "p00");
  return {
    ok: true,
    mode: "diagnose-score",
    ym,
    snapshot: snapshot
      ? {
        id: snapshot.id,
        total_score: snapshot.total_score,
        retention_score: snapshot.retention_score,
        pipeline_score: snapshot.pipeline_score,
        direction_score: snapshot.direction_score,
        created_at: snapshot.created_at,
        updated_at: snapshot.updated_at,
        summary: snapshot.summary,
      }
      : null,
    axes: byAxis,
    guardCheck: {
      commercialRawCount: commercialRaw.length,
      p00CommercialCount: p00FallbackOnly.length,
      nonP00CommercialCount: commercialRaw.length - p00FallbackOnly.length,
      note: "migration 118 backfill前は applies_to_company_score が無いため p00 fallback だけに寄り、非p00の会社level pipelineが落ちる可能性が高い",
    },
  };
}

async function main() {
  const mode = args.mode || "backfill-dry-run";
  const result = mode === "diagnose-score" ? await diagnoseScore() : await backfillDryRun();
  if (args.out) {
    fs.mkdirSync(path.dirname(args.out), { recursive: true });
    fs.writeFileSync(args.out, `${JSON.stringify(result, null, 2)}\n`);
  }
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
