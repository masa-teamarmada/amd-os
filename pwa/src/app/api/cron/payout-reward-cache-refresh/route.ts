import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  candidateSourceYmsForPaymentYm,
  cleanYm,
  currentYmJst,
  effectivePaymentYmForCycle,
  type PaymentProjectRow,
} from "@/lib/payment-groups";
import { syncRewardSummariesForBillingCycles } from "@/lib/reward-summary";
import { requireAdmin } from "@/lib/supabase/api-auth";

export const runtime = "nodejs";

// Critical anchor: payout-reward-cache-refresh runs daily at 03:05 JST via vercel.json.
const DEFAULT_FORWARD_CACHE_LOOKAHEAD_MONTHS = 11;
const MAX_FORWARD_CACHE_LOOKAHEAD_MONTHS = 24;

type BillingCycleRow = {
  project_id: string;
  ym: string;
  status: string | null;
  budget_yen: number | null;
  invoice_ym: string | null;
  reward_summary_json: unknown;
};

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";
  return bearer === secret || req.nextUrl.searchParams.get("secret") === secret;
}

function addMonths(ym: string, delta: number): string {
  const y = Number(ym.slice(0, 4));
  const m = Number(ym.slice(4, 6));
  const date = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function normalizeLookaheadMonths(value: unknown, fallback: number): number {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = typeof value === "number" ? value : Number(String(value));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(MAX_FORWARD_CACHE_LOOKAHEAD_MONTHS, Math.floor(parsed)));
}

function targetPaymentYms(baseYm: string, lookaheadMonths: number, includePrevious: boolean): string[] {
  const yms = includePrevious ? [addMonths(baseYm, -1)] : [];
  for (let offset = 0; offset <= lookaheadMonths; offset += 1) {
    yms.push(addMonths(baseYm, offset));
  }
  return [...new Set(yms)];
}

async function refreshPayoutRewardCache(paymentYms: string[]) {
  const db = createAdminClient();
  const cycleSelect = "project_id, ym, status, budget_yen, invoice_ym, reward_summary_json";
  const sourceYms = [...new Set(paymentYms.flatMap((ym) => candidateSourceYmsForPaymentYm(ym)))];

  const [projectsRes, explicitRes, unsetRes] = await Promise.all([
    db
      .from("projects")
      .select("project_id, project_name, client_name, status, freee_partner_id, payment_due_rule, payment_due_day"),
    db.from("billing_cycles").select(cycleSelect).in("invoice_ym", paymentYms),
    db.from("billing_cycles").select(cycleSelect).in("ym", sourceYms).is("invoice_ym", null),
  ]);

  if (projectsRes.error) throw projectsRes.error;
  if (explicitRes.error) throw explicitRes.error;
  if (unsetRes.error) throw unsetRes.error;

  const projectMap = new Map<string, PaymentProjectRow>();
  for (const project of (projectsRes.data ?? []) as PaymentProjectRow[]) {
    projectMap.set(project.project_id, project);
  }

  const cycleMap = new Map<string, BillingCycleRow>();
  for (const row of (explicitRes.data ?? []) as BillingCycleRow[]) {
    const invoiceYm = cleanYm(row.invoice_ym);
    if (invoiceYm && paymentYms.includes(invoiceYm)) {
      cycleMap.set(`${row.project_id}:${row.ym}`, row);
    }
  }
  for (const row of (unsetRes.data ?? []) as BillingCycleRow[]) {
    const project = projectMap.get(row.project_id);
    const effectiveYm = effectivePaymentYmForCycle(row, project);
    if (paymentYms.includes(effectiveYm)) {
      cycleMap.set(`${row.project_id}:${row.ym}`, { ...row, invoice_ym: effectiveYm });
    }
  }

  const cycles = [...cycleMap.values()].sort((a, b) =>
    a.ym === b.ym ? a.project_id.localeCompare(b.project_id) : a.ym.localeCompare(b.ym)
  );
  const synced = await syncRewardSummariesForBillingCycles(db, cycles);
  return {
    paymentYms,
    sourceYms,
    cycleCount: cycles.length,
    refreshedCount: synced.size,
    refreshedCycles: [...synced.keys()].sort(),
  };
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const explicitYm = cleanYm(req.nextUrl.searchParams.get("ym"));
  const lookaheadMonths = normalizeLookaheadMonths(
    req.nextUrl.searchParams.get("lookahead"),
    explicitYm ? 0 : DEFAULT_FORWARD_CACHE_LOOKAHEAD_MONTHS
  );
  const baseYm = explicitYm ?? currentYmJst();
  const paymentYms = targetPaymentYms(baseYm, lookaheadMonths, !explicitYm);

  try {
    const result = await refreshPayoutRewardCache(paymentYms);
    return NextResponse.json({ ok: true, baseYm, lookaheadMonths, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  let body: { ym?: string; lookahead?: number | string | null } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const explicitYm = cleanYm(body.ym);
  const lookaheadMonths = normalizeLookaheadMonths(
    body.lookahead,
    explicitYm ? 0 : DEFAULT_FORWARD_CACHE_LOOKAHEAD_MONTHS
  );
  const baseYm = explicitYm ?? currentYmJst();
  const paymentYms = targetPaymentYms(baseYm, lookaheadMonths, !explicitYm);

  try {
    const result = await refreshPayoutRewardCache(paymentYms);
    return NextResponse.json({ ok: true, baseYm, lookaheadMonths, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
