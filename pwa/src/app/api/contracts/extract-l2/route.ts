/**
 * POST /api/contracts/extract-l2
 *
 * Claude daily L2 consolidated routine から呼ぶ契約予兆抽出の受け口。
 * 5生データ由来の source_cache と MTGサマリを読み、contract_signals へ候補化し、
 * 高確度だけ contracts の planned 枠を作る。契約書本文は保存しない。
 *
 * 認証: Authorization: Bearer ${CONTRACTS_EXTRACT_SECRET ?? CRON_SECRET}
 */
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractContractL2Data } from "@/lib/contracts-extraction";

export const runtime = "nodejs";

function boolFromUnknown(value: unknown) {
  return value === true || value === "true" || value === "1" || value === 1;
}

function numberFromUnknown(value: unknown, fallback: number) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

async function parseBody(req: NextRequest) {
  if (!req.headers.get("content-type")?.includes("application/json")) return {};
  try {
    return (await req.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function run(req: NextRequest, methodDryRun: boolean) {
  const expected = process.env.CONTRACTS_EXTRACT_SECRET || process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") || "";
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const body = req.method === "POST" ? await parseBody(req) : {};
  const days = numberFromUnknown(body.days ?? url.searchParams.get("days"), 90);
  const limit = numberFromUnknown(body.limit ?? url.searchParams.get("limit"), 240);
  const projectId = String(body.project_id ?? body.projectId ?? url.searchParams.get("project_id") ?? "").trim();
  const dryRun = methodDryRun || boolFromUnknown(body.dry_run ?? body.dryRun ?? url.searchParams.get("dry_run"));
  const force = boolFromUnknown(body.force ?? url.searchParams.get("force"));

  try {
    const admin = createAdminClient();
    const result = await extractContractL2Data(admin, {
      days,
      limit,
      projectId,
      dryRun,
      force,
      source: "claude-l2-daily-contract-extract",
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "unknown",
    }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return run(req, true);
}

export async function POST(req: NextRequest) {
  return run(req, false);
}
