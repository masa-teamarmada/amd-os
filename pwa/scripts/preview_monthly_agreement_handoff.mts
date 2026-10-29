#!/usr/bin/env node
/** Read-only preview of the messages the monthly agreement flow would send. No queue/write/send. */
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";
import { dispatchAgreementHandoffs, prepareAgreementHandoff, queueAgreementHandoff, type AgreementHandoffTarget } from "../src/lib/monthly-agreement-handoff-server.ts";

const require = createRequire(import.meta.url);
const nextEnv = require("@next/env") as { loadEnvConfig: (path: string) => void };
nextEnv.loadEnvConfig(process.cwd());
const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === "--send") continue;
  args.set(process.argv[i], process.argv[++i]);
}
const ym = args.get("--ym") || "";
const memberId = args.get("--member") || "";
const kind = args.get("--kind") as AgreementHandoffTarget["kind"] | undefined;
const projectId = args.get("--project");
const requestId = args.get("--request");
const send = process.argv.includes("--send");
if (!/^\d{6}$/.test(ym) || !/^ID\d+$/.test(memberId) || !kind || !["revision_requested", "reagreement_requested", "agreement_completed"].includes(kind)) {
  console.error("usage: --ym YYYYMM --member IDxxx --kind revision_requested|reagreement_requested|agreement_completed [--project pxx] [--request uuid] [--send]");
  process.exit(2);
}
if (send && (process.env.AMD_OS_MONTHLY_AGREEMENT_NOTIFY_APPROVED !== "1" || kind !== "reagreement_requested" || !projectId)) {
  throw new Error("Sending requires explicit operator approval, a single project, and a re-agreement target");
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Supabase environment is missing");
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const target: AgreementHandoffTarget = { ym, memberId, kind,
  ...(projectId ? { projectIds: [projectId] } : {}), ...(requestId ? { requestIds: [requestId] } : {}) };
const jobs = await prepareAgreementHandoff(db, target);
console.log(JSON.stringify({ readOnly: true, ym, memberId, kind, count: jobs.length,
  notices: jobs.map(j => ({ recipientMemberId: j.recipientMemberId, projectId: j.projectId, text: j.text })) }, null, 2));
if (send) {
  if (jobs.length !== 1 || jobs[0].recipientMemberId !== memberId) throw new Error("Expected exactly one current member notification");
  const queued = await queueAgreementHandoff(db, target, true);
  if (queued.state !== "queued") throw new Error(`Queue did not complete: ${queued.errorCode || queued.state}`);
  const outcomes = await dispatchAgreementHandoffs(db, true, queued.jobs.map(j => j.id));
  const { data: delivery, error: statusError } = await db.from("billing_log").select("detail").eq("id", jobs[0].id).maybeSingle();
  if (statusError) throw new Error("Delivery status read failed");
  console.log(JSON.stringify({ dispatchRequested: true, currentDeliveryState: delivery?.detail?.state || "unknown", outcomes }, null, 2));
}
