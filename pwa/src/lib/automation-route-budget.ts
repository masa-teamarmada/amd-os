import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

type Policy = {
  maxBodyBytes: number;
  dailyRequests: number;
  dailyBodyBytes: number;
};

const MIB = 1024 * 1024;
const RUN_REQUEST_LIMIT = 12;
const RUN_BODY_LIMIT = 2 * MIB;

const POLICIES: Record<string, Policy> = {
  "meeting-prep": { maxBodyBytes: 128 * 1024, dailyRequests: 96, dailyBodyBytes: 4 * MIB },
  "meeting-prep/calendar-sync": { maxBodyBytes: 256 * 1024, dailyRequests: 96, dailyBodyBytes: 8 * MIB },
  "meeting-calendar/upsert-plan": { maxBodyBytes: 256 * 1024, dailyRequests: 96, dailyBodyBytes: 8 * MIB },
  "task-calendar/register-tasks": { maxBodyBytes: 256 * 1024, dailyRequests: 96, dailyBodyBytes: 8 * MIB },
  "task-calendar/schedule-plan": { maxBodyBytes: 256 * 1024, dailyRequests: 96, dailyBodyBytes: 8 * MIB },
  "meeting-workflow/finalize": { maxBodyBytes: 128 * 1024, dailyRequests: 96, dailyBodyBytes: 4 * MIB },
  "meeting-assets/adopt-drive-folder": { maxBodyBytes: 32 * 1024, dailyRequests: 48, dailyBodyBytes: 1 * MIB },
  "project-workspace/automation-context": { maxBodyBytes: 1024, dailyRequests: 96, dailyBodyBytes: 96 * 1024 },
};

function jsonError(status: number, error: string, routeKey: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json(
    { ok: false, error, automation_route: routeKey, ...extra },
    { status, headers: { "cache-control": "no-store", "x-amd-automation-budget": error } },
  );
}

/**
 * WORKFLOW_SECRET経由の自動化だけを原子的な予算へ通す。
 * 人がログインして画面から使う経路は、既存の認可と操作感を変えない。
 * 戻り値がResponseなら呼び出し側はその場で返す。
 */
export async function enforceAutomationRouteBudget(
  request: NextRequest,
  routeKey: keyof typeof POLICIES,
): Promise<NextResponse | null> {
  const secret = process.env.WORKFLOW_SECRET || process.env.CRON_SECRET || "";
  const authorization = request.headers.get("authorization") || "";
  if (!secret || authorization !== `Bearer ${secret}`) return null;

  const policy = POLICIES[routeKey];
  const runKey = (request.headers.get("x-amd-automation-run-id") || "").trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,159}$/.test(runKey)) {
    return jsonError(400, "automation_run_id_required", routeKey, {
      required_header: "x-amd-automation-run-id",
    });
  }

  let bodyBytes = 0;
  try {
    bodyBytes = (await request.clone().arrayBuffer()).byteLength;
  } catch {
    return jsonError(400, "automation_body_unreadable", routeKey);
  }
  if (bodyBytes > policy.maxBodyBytes) {
    return jsonError(413, "automation_body_too_large", routeKey, { max_body_bytes: policy.maxBodyBytes });
  }

  const db = createAdminClient();
  const { data, error } = await db.rpc("claim_automation_route_budget", {
    p_route_key: routeKey,
    p_run_key: runKey,
    p_body_bytes: bodyBytes,
    p_daily_request_limit: policy.dailyRequests,
    p_daily_body_limit: policy.dailyBodyBytes,
    p_run_request_limit: RUN_REQUEST_LIMIT,
    p_run_body_limit: RUN_BODY_LIMIT,
  });
  if (error) return jsonError(503, "automation_budget_unavailable", routeKey);
  const claim = Array.isArray(data) ? data[0] : data;
  if (!claim?.allowed) {
    return jsonError(429, String(claim?.reason || "automation_budget_exceeded"), routeKey, {
      daily_requests: claim?.daily_requests ?? null,
      run_requests: claim?.run_requests ?? null,
    });
  }
  return null;
}
