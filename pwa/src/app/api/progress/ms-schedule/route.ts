import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function addMonthsYm(ym: string, offset: number): string {
  const y = Number(ym.slice(0, 4));
  const m = Number(ym.slice(4, 6));
  if (!Number.isFinite(y) || !Number.isFinite(m)) return ym;
  const zeroBased = y * 12 + (m - 1) + offset;
  const ny = Math.floor(zeroBased / 12);
  const nm = (zeroBased % 12) + 1;
  return `${ny}${String(nm).padStart(2, "0")}`;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId") || "";
  const startYm = url.searchParams.get("startYm") || "";

  if (!projectId || !/^\d{6}$/.test(startYm)) {
    return NextResponse.json({ error: "projectId and startYm required" }, { status: 400 });
  }

  const gasBaseUrl = process.env.NEXT_PUBLIC_GAS_WEBAPP_URL || "";
  const gasApiKey = process.env.NEXT_PUBLIC_GAS_API_KEY || "";
  if (!gasBaseUrl) {
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
    return NextResponse.json({ error: `GAS API error: ${res.status}` }, { status: 502 });
  }

  const json = await res.json();
  if (!json?.ok) {
    return NextResponse.json({ error: json?.error || "GAS API failed" }, { status: 502 });
  }

  const result = json.data?.result || {};
  const planStartYm = String(result.startYm || startYm);
  const milestones = Array.isArray(result.milestones) ? result.milestones : [];
  const schedules = milestones.map((m: Record<string, unknown>) => {
    const msMonths = Math.max(1, Number(m.msMonths || 1));
    return {
      milestoneId: String(m.milestoneId || ""),
      periodStartYm: planStartYm,
      targetYm: addMonthsYm(planStartYm, msMonths - 1),
      msMonths,
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
