#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Converts L2 health-check output into a durable local action ledger.
 *
 * This script does not fix L2 data, touch schedulers, write to Supabase, or send
 * Slack/Notion/Drive messages. Its only write is the local ledger artifact.
 */
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_INPUT = path.join(ROOT, "tmp", "l2-health-latest.json");
const DEFAULT_LEDGER = path.join(ROOT, "tmp", "l2-health-action-ledger.json");

const ARGS = parseArgs(process.argv.slice(2));

main();

function main() {
  if (ARGS.help) return printHelp();
  const now = ARGS.now ? new Date(ARGS.now) : new Date();
  assertValidDate(now, "--now");

  const inputPath = ARGS.input || DEFAULT_INPUT;
  const ledgerPath = ARGS.ledger || DEFAULT_LEDGER;
  const health = readJson(inputPath, "health input");
  const previous = fs.existsSync(ledgerPath) ? readJson(ledgerPath, "existing ledger") : null;
  const rows = Array.isArray(health.rows) ? health.rows : [];
  if (rows.length === 0) throw new Error("health input does not contain rows[]");

  const activeRows = rows.filter((row) => row.health === "red" || row.health === "yellow");
  const previousIncidents = Array.isArray(previous?.incidents) ? previous.incidents : [];
  const previousByKey = new Map(previousIncidents.map((incident) => [incident.dedupeKey, incident]));
  const activeKeys = new Set();
  const incidents = [];
  const changeLog = [];

  for (const row of activeRows.sort(compareRows)) {
    const incident = buildIncident(row, now, previousByKey.get(dedupeKey(row)));
    activeKeys.add(incident.dedupeKey);
    incidents.push(incident);
    if (!previousByKey.has(incident.dedupeKey)) changeLog.push({ type: "new", dedupeKey: incident.dedupeKey, l2Id: incident.l2Id });
    else if (previousByKey.get(incident.dedupeKey)?.status === "resolved") changeLog.push({ type: "reopened", dedupeKey: incident.dedupeKey, l2Id: incident.l2Id });
    else changeLog.push({ type: "deduped", dedupeKey: incident.dedupeKey, l2Id: incident.l2Id });
  }

  for (const previousIncident of previousIncidents) {
    if (activeKeys.has(previousIncident.dedupeKey)) continue;
    const currentRow = rows.find((row) => row.id === previousIncident.l2Id);
    if (currentRow?.health !== "green") {
      incidents.push({
        ...previousIncident,
        status: previousIncident.status || "open",
        notSeenInLatestRun: !currentRow,
        lastSeenAt: previousIncident.lastSeenAt || previousIncident.firstSeenAt,
      });
      continue;
    }
    const resolved = {
      ...previousIncident,
      status: "resolved",
      actionRequired: false,
      ackRequired: false,
      resolvedAt: previousIncident.resolvedAt || now.toISOString(),
      lastGreenAt: now.toISOString(),
      closeReason: "latest health row is green",
      latestHealth: "green",
      lastSeenAt: now.toISOString(),
      occurrences: Number(previousIncident.occurrences || 1),
    };
    incidents.push(resolved);
    changeLog.push({ type: "resolved", dedupeKey: previousIncident.dedupeKey, l2Id: previousIncident.l2Id });
  }

  const ledger = {
    version: 1,
    generatedAt: now.toISOString(),
    input: {
      path: inputPath,
      generatedAt: health.generatedAt || null,
      mode: health.mode || null,
      summary: health.summary || null,
      supabase: health.source?.supabase ?? null,
      supabaseError: health.source?.supabaseError || null,
    },
    summary: summarizeIncidents(incidents, changeLog),
    incidents: incidents.sort(compareIncidents),
    currentOpenWorkerPrompts: incidents
      .filter((incident) => incident.status !== "resolved")
      .sort(compareIncidents)
      .map((incident) => ({
        l2Id: incident.l2Id,
        l2Name: incident.name,
        l2Subject: incident.l2Subject,
        mappingStatus: incident.mappingStatus,
        severity: incident.severity,
        owner: incident.owner,
        deadline: incident.deadline,
        workerPromptSeed: incident.workerPromptSeed,
      })),
    schedulerChangeBundle: {
      requiredForThisScript: false,
      note: "This action ledger is local-file only. Creating/updating recurring automation still requires a separate scheduler change bundle.",
    },
  };

  if (!ARGS.dryRun) {
    fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
    fs.writeFileSync(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`);
  }

  if (ARGS.json) {
    console.log(JSON.stringify(ledger, null, 2));
  } else {
    console.log(formatReport(ledger, ledgerPath, ARGS.dryRun));
  }
}

function buildIncident(row, now, previous) {
  const key = dedupeKey(row);
  const severity = row.health === "red" ? "red" : "yellow";
  const previousWasResolved = previous?.status === "resolved";
  const firstSeenAt = previous && !previousWasResolved ? previous.firstSeenAt : now.toISOString();
  const occurrences = previous && !previousWasResolved ? Number(previous.occurrences || 1) + 1 : 1;
  const deadline = previous && !previousWasResolved && previous.deadline ? previous.deadline : deadlineFor(row, now);
  const failureMode = row.failureMode || "unknown";
  const owner = ownerFor(row, failureMode);
  const recommendedNextStep = recommendedNextStepFor(row, failureMode);

  return {
    dedupeKey: key,
    status: previousWasResolved ? "reopened" : "open",
    actionRequired: true,
    ackRequired: severity === "red" || ["outbox_failed", "outbox_stale_pending", "review_required"].includes(failureMode),
    l2Id: row.id,
    name: row.name,
    l2Subject: l2Subject(row),
    mappingStatus: mappingStatus(row),
    severity,
    latestHealth: row.health,
    priority: row.priority || (severity === "red" ? "P0" : "P1"),
    owner,
    deadline,
    failureMode,
    missingReason: row.missingReason || "missing reason was not provided by health output",
    recommendedNextStep,
    workerPromptSeed: workerPromptSeed(row, owner, recommendedNextStep),
    closeCondition: closeConditionFor(row, failureMode),
    firstSeenAt,
    lastSeenAt: now.toISOString(),
    occurrences,
    lastOutputSuccess: row.lastOutputSuccess || null,
    lastReportEvidence: row.lastReportEvidence || null,
    lastAnyEvidence: row.lastAnyEvidence || null,
    runnerHealth: row.runnerHealth || null,
    outputHealth: row.outputHealth || null,
    runnerIds: row.runnerIds || [],
    runnerStatuses: row.runnerStatuses || [],
    nextWorkerCandidate: row.nextWorkerCandidate || null,
    destination: row.destination || null,
    sourceHealth: {
      generatedAt: row.generatedAt || null,
      successEvidence: row.successEvidence || null,
      dbEvidence: row.dbEvidence || null,
      fileEvidence: row.fileEvidence || null,
      reportEvidence: row.reportEvidence || null,
      reviewRequiredCount: row.reviewRequiredCount || 0,
    },
    resolvedAt: null,
    lastGreenAt: null,
  };
}

function dedupeKey(row) {
  const id = clean(row.id || "unknown");
  const mode = clean(row.failureMode || "unknown");
  const destination = clean(row.destination || row.name || "unknown");
  return `${id}:${mode}:${destination}`;
}

function ownerFor(row, failureMode) {
  if (row.owner && row.owner !== "D routine recovery worker") return row.owner;
  const label = l2Subject(row);
  if (failureMode === "unable_to_verify_output") return `${label} output evidence verification worker`;
  if (failureMode === "review_required") return `${label} review drain worker`;
  if (failureMode === "outbox_failed" || failureMode === "outbox_stale_pending") return `${label} outbox drain worker`;
  if (failureMode.includes("scheduler") || failureMode === "runner_not_recent") return `${label} scheduler evidence owner`;
  return `${label} extraction recovery worker`;
}

function recommendedNextStepFor(row, failureMode) {
  if (failureMode === "unable_to_verify_output") {
    return "Canonical env or live DB/applied artifactでread-only再確認し、green証跡が無ければ復旧workerへ切る。";
  }
  if (failureMode === "review_required") {
    return "未読review_requiredを種類別に棚卸しし、採否/owner/次アクションを付ける。自動既読化は禁止。";
  }
  if (failureMode === "outbox_failed") {
    return "failed outboxをread-onlyで原因分類し、再投入可能/要手動修正/破棄禁止を分ける。";
  }
  if (failureMode === "outbox_stale_pending") {
    return "stale pending outboxをapplier監視対象・schema error・duplicate riskに分け、safe drain案を作る。";
  }
  if (failureMode === "report_only_no_fresh_output") {
    return "report/no-data artifactだけで止まっている理由を確認し、DB/applied出力または明示no-data closeへ進める。";
  }
  if (failureMode === "stale_last_success") {
    return "該当L2のwriter SKILLを読み、最後の成功以降のrun/outbox/DB反映を追って復旧worker化する。";
  }
  if (failureMode === "no_success_evidence") {
    return "成功証跡が無い原因をrunner未実行・出力0・write失敗・schema mismatchに分ける。";
  }
  if (failureMode.includes("scheduler") || failureMode === "runner_not_recent") {
    return "scheduler変更はこのhelperでは実行せず、必要な対象・影響・rollbackをscheduler change bundleとして別タスクへ渡す。";
  }
  return "該当L2のwriter/current specを読み、red/yellowをgreenへ戻す最小復旧workerを切る。";
}

function closeConditionFor(row, failureMode) {
  const label = l2Subject(row);
  if (failureMode === "unable_to_verify_output") {
    return "canonical env/live DB/applied artifactで直近OS出力または明示no-data artifactを確認し、次回healthでgreen/yellow根拠付きに落ちること。";
  }
  if (failureMode === "review_required") {
    return "review_requiredにowner/action/statusが付き、未読放置ではなく採否または明示保留に移ること。";
  }
  if (failureMode === "outbox_failed" || failureMode === "outbox_stale_pending") {
    return "failed/stale outboxが再投入済み・要手動修正・破棄禁止保留のどれかに分類され、次回healthで同じfailureがdedupe継続しないこと。";
  }
  return `次回healthで${label}の行がgreenになり、lastOutputSuccessまたはlastReportEvidenceがfreshになること。`;
}

function workerPromptSeed(row, owner, nextStep) {
  const label = l2Subject(row);
  return [
    `タイトル: ${label} のL2 health ${row.health}復旧`,
    "",
    "AMD OS司令塔からのvisible worker依頼。quiet mode。",
    `対象: ${label}`,
    `health row id: ${row.id || "unknown"} (${row.name || "unknown"})`,
    `failureMode: ${row.failureMode || "unknown"}`,
    `missingReason: ${row.missingReason || "unknown"}`,
    `owner: ${owner}`,
    `destination: ${row.destination || "unknown"}`,
    `next action: ${nextStep}`,
    "",
    "禁止: hidden subagent、DB/Slack/Notion/Drive/schedulerの無断write、DELETE/TRUNCATE/DROP、PWA直接deploy。",
    "完了条件: 原因分類、修復または安全な復旧bundle、health再チェック、close条件の証跡を残す。",
  ].join("\n");
}

function deadlineFor(row, now) {
  const hours = row.health === "red" ? 24 : 72;
  return new Date(now.getTime() + hours * 3600000).toISOString();
}

function l2Subject(row) {
  const id = row.id || "unknown";
  const name = row.name || "mapping_pending";
  if (name === "mapping_pending") return `${id} mapping_pending`;
  return `${id} ${name}`;
}

function mappingStatus(row) {
  return row.id && row.name ? "health_output_subject" : "mapping_pending";
}

function summarizeIncidents(incidents, changeLog) {
  const open = incidents.filter((incident) => incident.status !== "resolved");
  return {
    total: incidents.length,
    open: open.length,
    resolved: incidents.length - open.length,
    redOpen: open.filter((incident) => incident.severity === "red").length,
    yellowOpen: open.filter((incident) => incident.severity === "yellow").length,
    ackRequired: open.filter((incident) => incident.ackRequired).length,
    new: changeLog.filter((item) => item.type === "new").length,
    reopened: changeLog.filter((item) => item.type === "reopened").length,
    deduped: changeLog.filter((item) => item.type === "deduped").length,
    resolvedThisRun: changeLog.filter((item) => item.type === "resolved").length,
  };
}

function formatReport(ledger, ledgerPath, dryRun) {
  const lines = [];
  lines.push("# L2 health action ledger");
  lines.push("");
  lines.push(`- ledger: ${dryRun ? "(dry-run) " : ""}${ledgerPath}`);
  lines.push(`- input: ${ledger.input.path}`);
  lines.push(`- open: red=${ledger.summary.redOpen} / yellow=${ledger.summary.yellowOpen} / ackRequired=${ledger.summary.ackRequired}`);
  lines.push(`- changes: new=${ledger.summary.new} / deduped=${ledger.summary.deduped} / reopened=${ledger.summary.reopened} / resolved=${ledger.summary.resolvedThisRun}`);
  lines.push("");
  for (const incident of ledger.incidents.filter((item) => item.status !== "resolved")) {
    lines.push(`## ${incident.l2Subject}`);
    lines.push(`- health row: ${incident.l2Id} ${incident.name}`);
    lines.push(`- mappingStatus: ${incident.mappingStatus}`);
    lines.push(`- severity: ${incident.severity}`);
    lines.push(`- status: ${incident.status}`);
  lines.push(`- owner: ${incident.owner}`);
  lines.push(`- deadline: ${incident.deadline}`);
  lines.push(`- failureMode: ${incident.failureMode}`);
  lines.push(`- next: ${incident.recommendedNextStep}`);
  lines.push("");
  }
  return lines.join("\n");
}

function compareRows(a, b) {
  const severity = { red: 0, yellow: 1, green: 2 };
  const priority = { P0: 0, P1: 1, P2: 2 };
  return (severity[a.health] - severity[b.health]) || (priority[a.priority] - priority[b.priority]) || String(a.id).localeCompare(String(b.id));
}

function compareIncidents(a, b) {
  const status = { open: 0, reopened: 0, resolved: 2 };
  const severity = { red: 0, yellow: 1 };
  return (status[a.status] - status[b.status]) || (severity[a.severity] - severity[b.severity]) || String(a.l2Id).localeCompare(String(b.l2Id));
}

function readJson(file, label) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(`Could not read ${label} at ${file}: ${error.message}`);
  }
}

function clean(value) {
  return String(value).trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
}

function assertValidDate(date, label) {
  if (!Number.isFinite(date.getTime())) throw new Error(`${label} is not a valid date`);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--input") out.input = argv[++i];
    else if (arg === "--ledger") out.ledger = argv[++i];
    else if (arg === "--now") out.now = argv[++i];
    else if (arg === "--json") out.json = true;
    else if (arg === "--dry-run") out.dryRun = true;
    else if (arg === "--help" || arg === "-h") out.help = true;
  }
  return out;
}

function printHelp() {
  console.log(`Usage:
  node scripts/l2_health_action_loop.cjs --input tmp/l2-health-latest.json
  node scripts/l2_health_action_loop.cjs --input tmp/l2-health-latest.json --json

Writes a local incident/action ledger to tmp/l2-health-action-ledger.json by
default. It dedupes repeated red/yellow rows and marks incidents resolved only
when the latest health row for that L2 is green.`);
}
