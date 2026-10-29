#!/usr/bin/env node
// Compile validated M-1 outboxes for the already-authorized Supabase connector.
// This helper never connects to a database or requires/exports credentials.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  validateMonthlyReportContent,
  validateExternalMonthlyReportContent,
  stripStandaloneHorizontalRules,
} from "./ms_progress_review_tool.mjs";

const md5 = (text) => crypto.createHash("md5").update(text).digest("hex");

function checkedMonth(value, external = false) {
  const pattern = external ? /^\d{4}-(?:0[1-9]|1[0-2])$/ : /^\d{4}(?:0[1-9]|1[0-2])$/;
  if (!pattern.test(String(value))) throw new Error("Invalid report month");
  return external ? value.replace("-", "") : value;
}

function previousMonth(ym) {
  const year = Number(ym.slice(0, 4));
  const month = Number(ym.slice(4));
  return month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, "0")}`;
}

function checkJargon(body) {
  const script = path.join(import.meta.dirname, "strip_internal_jargon.py");
  const check = "import importlib.util,json,sys; s=importlib.util.spec_from_file_location('jargon',sys.argv[1]); m=importlib.util.module_from_spec(s); s.loader.exec_module(m); h,w=m.check(sys.stdin.read()); print(json.dumps({'hard':h,'soft':w}))";
  const result = JSON.parse(execFileSync("python3", ["-c", check, script], { input: body, encoding: "utf8" }));
  if (result.hard.length) throw new Error(`External report jargon check failed: ${result.hard.map((r) => r.label).join(", ")}`);
  return { status: result.soft.length ? "warning" : "clean", findings: result.soft };
}

export function prepareMonthlyReportConnectorSql(outbox) {
  const internal = outbox.monthlyReports || [];
  const external = outbox.monthlyReportsExternal || [];
  if (!Array.isArray(internal) || !Array.isArray(external) || internal.length + external.length === 0) {
    throw new Error("A nonempty monthly report outbox is required");
  }
  if (internal.length + external.length > 100) throw new Error("Split outboxes into at most 100 reports");
  const rows = [];
  const identities = new Set();
  const internalHashes = new Map();
  function identity(item, kind, ym) {
    if (!/^p\d{2,}$/.test(String(item.project_id))) throw new Error("Invalid project_id");
    if (item.force || item.strict === false) throw new Error("Connector generation never overwrites or bypasses quality checks");
    const key = `${kind}:${item.project_id}:${ym}`;
    if (identities.has(key)) throw new Error(`Duplicate report: ${key}`);
    identities.add(key);
    return { kind, project_id: item.project_id, ym };
  }
  for (const item of internal) {
    const ym = checkedMonth(item.ym);
    const base = identity(item, "internal", ym);
    const result = validateMonthlyReportContent(item.final_content);
    if (!result.ok) throw new Error(`${item.project_id}/${ym}: ${result.errors.join("; ")}`);
    if (item.draft_content != null && item.draft_content.trim() !== result.normalized) {
      throw new Error("Newly generated draft and final must contain the same validated text");
    }
    internalHashes.set(`${item.project_id}:${ym}`, md5(result.normalized));
    rows.push({ ...base, content: result.normalized, audit: item.collection_summary_json || {} });
  }
  for (const item of external) {
    const ym = checkedMonth(item.ym, true);
    const base = identity(item, "external", ym);
    const referenceYm = previousMonth(ym);
    if (item.reference_project_id !== item.project_id || item.reference_ym !== referenceYm) {
      throw new Error("External reference must identify the same project's previous month");
    }
    const reference = String(item.reference_body_md || "");
    if (!reference.trim()) throw new Error("Previous submitted report is required");
    const source = item.reference_source || "database";
    if (!["database", "submitted_drive"].includes(source)) throw new Error("Unsupported reference source");
    if (source === "submitted_drive") {
      const url = new URL(item.reference_source_url);
      if (url.protocol !== "https:" || !["drive.google.com", "docs.google.com"].includes(url.hostname)) {
        throw new Error("Submitted Drive reference requires its source URL");
      }
    }
    const body = stripStandaloneHorizontalRules(item.body_md);
    const result = validateExternalMonthlyReportContent(body, reference);
    if (!result.ok || result.formatMatch !== true) throw new Error(`${item.project_id}/${ym}: ${result.errors.join("; ")}`);
    const jargon = checkJargon(body);
    const internalHash = internalHashes.get(`${item.project_id}:${ym}`) || item.internal_content_md5;
    if (!/^[a-f0-9]{32}$/.test(String(internalHash))) throw new Error("Saved internal report content hash is required");
    rows.push({ ...base, content: body, reference_ym: referenceYm, reference_source: source,
      reference_source_url: item.reference_source_url || null, reference_md5: md5(reference),
      internal_md5: internalHash, jargon_status: jargon.status, jargon_findings: jargon.findings });
  }
  rows.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "internal" ? -1 : 1)
    || a.project_id.localeCompare(b.project_id) || a.ym.localeCompare(b.ym));
  // Data is dollar-quoted JSON. A content-derived delimiter is collision checked.
  const payload = JSON.stringify(rows);
  const hash = crypto.createHash("sha256").update(payload).digest("hex").slice(0, 16);
  const tag = `$monthly_payload_${hash}$`;
  const applyTag = `$monthly_apply_${hash}$`;
  if (payload.includes(tag) || payload.includes(applyTag)) throw new Error("Payload delimiter collision");
  const literal = `${tag}${payload}${tag}::jsonb`;
  const sql = `BEGIN;
SET LOCAL standard_conforming_strings = on;
SELECT set_config('app.mrh_actor_kind', 'automation', true);
SELECT set_config('app.mrh_actor_label', 'AMD OS 月次報告書生成', true);
SELECT set_config('app.mrh_source', 'helper:monthly-report-connector', true);
DO ${applyTag}
DECLARE r jsonb; scope text; current_status text;
BEGIN
  FOR r IN SELECT value FROM jsonb_array_elements(${literal}) LOOP
    SELECT monthly_report_scope, status INTO scope, current_status
      FROM public.projects WHERE project_id = r->>'project_id' FOR SHARE;
    IF NOT FOUND OR current_status NOT IN ('active', 'sales') OR scope IS NULL
       OR scope NOT IN ('internal_only', 'internal_and_external')
       OR (r->>'kind' = 'external' AND scope <> 'internal_and_external') THEN
      RAISE EXCEPTION 'Report scope changed for %', r->>'project_id';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('monthly_report_internal:' || (r->>'project_id') || ':' || (r->>'ym'), 0));
    IF r->>'kind'='external' THEN
      PERFORM pg_advisory_xact_lock(hashtextextended('monthly_report_external:' || (r->>'project_id') || ':' || (r->>'ym'), 0));
    END IF;
    IF r->>'kind' = 'internal' THEN
      INSERT INTO public.monthly_reports
        (report_id, project_id, ym, draft_content, final_content, status, generated_at, last_cron_at, collection_summary_json)
      VALUES ((r->>'project_id') || '_' || (r->>'ym'), r->>'project_id', r->>'ym', r->>'content', r->>'content', 'final', now(), now(), r->'audit')
      ON CONFLICT (project_id, ym) DO NOTHING;
    ELSE
      IF EXISTS (SELECT 1 FROM public.monthly_reports_external WHERE project_id=r->>'project_id' AND ym=left(r->>'ym',4)||'-'||right(r->>'ym',2)) THEN
        CONTINUE;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM public.monthly_reports WHERE project_id=r->>'project_id' AND ym=r->>'ym' AND md5(final_content)=r->>'internal_md5') THEN
        RAISE EXCEPTION 'Saved internal report does not match for %', r->>'project_id';
      END IF;
      IF r->>'reference_source' = 'database' THEN
        PERFORM 1 FROM public.monthly_reports_external
          WHERE project_id=r->>'project_id' AND ym=r->>'reference_ym' AND md5(body_md)=r->>'reference_md5' FOR SHARE;
        IF NOT FOUND THEN RAISE EXCEPTION 'Previous submitted report changed for %', r->>'project_id'; END IF;
      END IF;
      INSERT INTO public.monthly_reports_external
        (project_id, ym, body_md, generated_at, generated_by_model, jargon_check_status, jargon_check_findings)
      VALUES (r->>'project_id', left(r->>'ym',4)||'-'||right(r->>'ym',2), r->>'content', now(), 'claude-fable-5', r->>'jargon_status', r->'jargon_findings')
      ON CONFLICT (project_id, ym) DO NOTHING;
    END IF;
  END LOOP;
END ${applyTag};
COMMIT;
WITH targets AS (SELECT value AS r FROM jsonb_array_elements(${literal}))
SELECT r->>'kind' AS kind, r->>'project_id' AS project_id, r->>'ym' AS ym,
  CASE WHEN r->>'kind'='internal' THEN i.status ELSE 'external' END AS status,
  length(CASE WHEN r->>'kind'='internal' THEN i.final_content ELSE e.body_md END) AS content_length,
  md5(CASE WHEN r->>'kind'='internal' THEN i.final_content ELSE e.body_md END) AS content_md5,
  md5(CASE WHEN r->>'kind'='internal' THEN i.final_content ELSE e.body_md END)=md5(r->>'content') AS content_matches,
  CASE WHEN r->>'kind'='internal' THEN i.generated_at ELSE e.generated_at END AS generated_at
FROM targets
LEFT JOIN public.monthly_reports i ON i.project_id=r->>'project_id' AND i.ym=r->>'ym'
LEFT JOIN public.monthly_reports_external e ON e.project_id=r->>'project_id' AND e.ym=left(r->>'ym',4)||'-'||right(r->>'ym',2);
`;
  return { sql, reports: rows.map((r) => ({ kind: r.kind, project_id: r.project_id, ym: r.ym, content_length: r.content.length, content_md5: md5(r.content) })) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  try {
    const args = process.argv.slice(2);
    const file = args[args.indexOf("--file") + 1];
    const out = args[args.indexOf("--out") + 1];
    if (!args.includes("--file") || !args.includes("--out") || !file || !out) throw new Error("Use --file outbox.json --out validated.sql");
    if (path.resolve(file) === path.resolve(out)) throw new Error("Output must differ from the input outbox");
    const result = prepareMonthlyReportConnectorSql(JSON.parse(fs.readFileSync(file, "utf8")));
    fs.writeFileSync(out, result.sql, { mode: 0o600 });
    console.log(JSON.stringify({ ok: true, sql_file: out, reports: result.reports }, null, 2));
  } catch (error) {
    console.error(JSON.stringify({ ok: false, error: error.message }));
    process.exitCode = 1;
  }
}
