import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function addMonthsYm(ym: string, offset: number): string {
  const y = Number(ym.slice(0, 4));
  const m = Number(ym.slice(4, 6));
  if (!Number.isFinite(y) || !Number.isFinite(m)) return ym;
  const zeroBased = y * 12 + (m - 1) + offset;
  const ny = Math.floor(zeroBased / 12);
  const nm = (zeroBased % 12) + 1;
  return `${ny}${String(nm).padStart(2, "0")}`;
}

function monthDiffInclusive(startYm: string, endYm: string): number {
  const sy = Number(startYm.slice(0, 4));
  const sm = Number(startYm.slice(4, 6));
  const ey = Number(endYm.slice(0, 4));
  const em = Number(endYm.slice(4, 6));
  if (![sy, sm, ey, em].every(Number.isFinite)) return 1;
  return Math.max(1, (ey * 12 + em) - (sy * 12 + sm) + 1);
}

function isYm(value: unknown): value is string {
  return typeof value === "string" && /^[0-9]{6}$/.test(value);
}

async function loadDbSchedules(projectId: string, startYm: string) {
  const empty = { startYm, endYm: "", schedules: [] as Array<{
    milestoneId: string;
    periodStartYm: string;
    targetYm: string;
    msMonths: number;
    expectedCumPct: number;
    monthlyPt: number;
  }> };
  try {
    const db = createAdminClient();
    const { data: cycles } = await db
      .from("value_plan_cycles")
      .select("plan_cycle_id,period_start_ym,period_end_ym")
      .eq("project_id", projectId)
      .eq("period_start_ym", startYm)
      .limit(1);
    const cycle = cycles?.[0];
    if (!cycle?.plan_cycle_id) return empty;

    const { data: dbMilestones } = await db
      .from("value_milestones")
      .select("milestone_id,points,period_start_ym,target_ym")
      .eq("plan_cycle_id", cycle.plan_cycle_id)
      .eq("is_active", true)
      .order("sort_order");
    const planStartYm = isYm(cycle.period_start_ym) ? cycle.period_start_ym : startYm;
    const planEndYm = isYm(cycle.period_end_ym) ? cycle.period_end_ym : "";
    const schedules = (dbMilestones || []).map((ms) => {
      const periodStartYm = isYm(ms.period_start_ym) ? ms.period_start_ym : planStartYm;
      const targetYm = isYm(ms.target_ym) ? ms.target_ym : (planEndYm || planStartYm);
      const msMonths = monthDiffInclusive(periodStartYm, targetYm);
      return {
        milestoneId: String(ms.milestone_id || ""),
        periodStartYm,
        targetYm,
        msMonths,
        expectedCumPct: 0,
        monthlyPt: msMonths > 0 ? Number(ms.points || 0) / msMonths : Number(ms.points || 0),
      };
    }).filter((m) => m.milestoneId);
    return { startYm: planStartYm, endYm: planEndYm, schedules };
  } catch (err) {
    console.warn("ms-schedule db fallback skipped:", err);
    return empty;
  }
}

function dbScheduleMap(schedules: Awaited<ReturnType<typeof loadDbSchedules>>["schedules"]) {
  const map = new Map<string, { periodStartYm?: string; targetYm?: string }>();
  for (const schedule of schedules) {
    map.set(schedule.milestoneId, {
      periodStartYm: schedule.periodStartYm,
      targetYm: schedule.targetYm,
    });
  }
  return map;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId") || "";
  const startYm = url.searchParams.get("startYm") || "";

  if (!projectId || !/^\d{6}$/.test(startYm)) {
    return NextResponse.json({ error: "projectId and startYm required" }, { status: 400 });
  }

  const dbFallback = await loadDbSchedules(projectId, startYm);

  const gasBaseUrl = process.env.NEXT_PUBLIC_GAS_WEBAPP_URL || "";
  const gasApiKey = process.env.NEXT_PUBLIC_GAS_API_KEY || "";
  if (!gasBaseUrl) {
    if (dbFallback.schedules.length > 0) {
      return NextResponse.json({ ok: true, projectId, startYm: dbFallback.startYm, endYm: dbFallback.endYm, schedules: dbFallback.schedules, source: "supabase" });
    }
    return NextResponse.json({ error: "GAS API env missing" }, { status: 500 });
  }

  const gasUrl = new URL(gasBaseUrl);
  gasUrl.searchParams.set("mode", "pwaApi");
  gasUrl.searchParams.set("key", gasApiKey);
  gasUrl.searchParams.set("action", "runFunc");
  gasUrl.searchParams.set("fn", "cockpit_api_getMonthBudgetEstimate");
  gasUrl.searchParams.set("args", JSON.stringify([{ projectId, ym: startYm }]));

  const res = await fetch(gasUrl.toString(), { cache: "no-store" });
  if (!res.ok) {
    if (dbFallback.schedules.length > 0) {
      return NextResponse.json({ ok: true, projectId, startYm: dbFallback.startYm, endYm: dbFallback.endYm, schedules: dbFallback.schedules, source: "supabase" });
    }
    return NextResponse.json({ error: `GAS API error: ${res.status}` }, { status: 502 });
  }

  const json = await res.json();
  if (!json?.ok) {
    if (dbFallback.schedules.length > 0) {
      return NextResponse.json({ ok: true, projectId, startYm: dbFallback.startYm, endYm: dbFallback.endYm, schedules: dbFallback.schedules, source: "supabase" });
    }
    return NextResponse.json({ error: json?.error || "GAS API failed" }, { status: 502 });
  }

  const result = json.data?.result || {};
  const planStartYm = String(result.startYm || startYm);
  const dbScheduleByMs = dbScheduleMap(dbFallback.schedules);
  const milestones = Array.isArray(result.milestones) ? result.milestones : [];
  const schedules = milestones.map((m: Record<string, unknown>) => {
    const milestoneId = String(m.milestoneId || "");
    const msMonths = Math.max(1, Number(m.msMonths || 1));
    const dbSchedule = dbScheduleByMs.get(milestoneId);
    const periodStartYm = dbSchedule?.periodStartYm || planStartYm;
    const targetYm = dbSchedule?.targetYm || addMonthsYm(planStartYm, msMonths - 1);
    return {
      milestoneId,
      periodStartYm,
      targetYm,
      msMonths: monthDiffInclusive(periodStartYm, targetYm),
      expectedCumPct: Math.max(0, Math.min(100, Number(m.expectedCumPct || 0))),
      monthlyPt: Number(m.pt || 0),
    };
  }).filter((m: { milestoneId: string }) => m.milestoneId);

  return NextResponse.json({
    ok: true,
    projectId,
    startYm: planStartYm,
    endYm: String(result.endYm || ""),
    schedules,
  });
}
