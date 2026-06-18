import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cleanYm, currentYmJst } from "@/lib/payment-groups";
import {
  generateNoticePdfBulk,
  loadTargetData,
  type GenerateNoticeResult,
} from "@/app/api/admin/payouts/route";
import {
  enforcePayoutAgreementGate,
  payoutAgreementGateErrorMessage,
  type PayoutAgreementGateSummary,
} from "@/lib/monthly-work-agreement-payout-gate";

export const runtime = "nodejs";

// payout-notice-prebuild: 毎日深夜 (vercel.json では 0 17 * * * UTC = JST 02:00) に起動し、
// 当月と翌月の支払 ym 全部について、各メンバーの支払通知書 PDF を「金額が変わったもの・まだ無いもの」
// だけ事前生成して payout_notices.pdf_url / last_generated_at に埋めておく。
//
// 朝、まさが /admin/payouts を開いた時点で「確認」「発行」ボタンが既存 PDF を即開けるようにするのが目的。
// 仕様: pwa/manual/6-5-admin-payouts-reward-notice-spec.md「先回り生成」セクション。

const DEFAULT_LOOKAHEAD_MONTHS = 1; // 当月 + 翌月

type MemberRow = {
  member_id: string;
  is_officer?: boolean | null;
  exclude_from_payout_notice?: boolean | null;
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

function targetYms(baseYm: string, lookahead: number): string[] {
  const result = [baseYm];
  for (let i = 1; i <= lookahead; i += 1) {
    result.push(addMonths(baseYm, i));
  }
  return result;
}

type YmResult = {
  ym: string;
  targetCount: number;
  generated: number;
  skipped: number;
  failed: number;
  results: GenerateNoticeResult[];
  payoutAgreementGate?: PayoutAgreementGateSummary;
};

async function prebuildForYm(ym: string, force: boolean): Promise<YmResult> {
  const db = createAdminClient();
  const data = await loadTargetData(ym);

  const excludedMemberIds = new Set(
    (data.members as MemberRow[])
      .filter((member) => member.exclude_from_payout_notice || member.is_officer)
      .map((member) => member.member_id)
  );
  const totalByMember = new Map<string, number>();
  for (const entry of data.expectedEntries) {
    if (excludedMemberIds.has(entry.member_id)) continue;
    totalByMember.set(entry.member_id, (totalByMember.get(entry.member_id) ?? 0) + entry.total_pay);
  }
  const targetMemberIds = [...totalByMember.entries()]
    .filter(([, total]) => total > 0)
    .map(([memberId]) => memberId);

  if (targetMemberIds.length === 0) {
    return { ym, targetCount: 0, generated: 0, skipped: 0, failed: 0, results: [] };
  }

  const gate = await enforcePayoutAgreementGate(db, {
    paymentYm: ym,
    targetAction: "cron_payout_notice_prebuild",
    entries: data.expectedEntries,
    members: data.members as MemberRow[],
    projects: data.projects,
  });
  const blockedMemberIds = new Set(gate.blockers.map((row) => row.memberId));
  const blockedResults: GenerateNoticeResult[] = [...blockedMemberIds].map((memberId) => ({
    memberId,
    status: "failed",
    reason: "agreement_gate",
    error: payoutAgreementGateErrorMessage({
      ...gate,
      blockers: gate.blockers.filter((row) => row.memberId === memberId),
      blockedCount: gate.blockers.filter((row) => row.memberId === memberId).length,
    }),
  }));
  const allowedMemberIds = targetMemberIds.filter((memberId) => !blockedMemberIds.has(memberId));
  const generatedResults = allowedMemberIds.length > 0
    ? await generateNoticePdfBulk(db, data, {
        memberIds: allowedMemberIds,
        previewOnly: false,
        force,
      })
    : [];
  const results = [...generatedResults, ...blockedResults].sort((a, b) => a.memberId.localeCompare(b.memberId));

  return {
    ym,
    targetCount: targetMemberIds.length,
    generated: results.filter((r) => r.status === "generated").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    failed: results.filter((r) => r.status === "failed").length,
    results,
    payoutAgreementGate: gate,
  };
}

async function runPrebuild(ymList: string[], force: boolean) {
  const ymResults: YmResult[] = [];
  for (const ym of ymList) {
    const result = await prebuildForYm(ym, force);
    ymResults.push(result);
  }
  return {
    ymList,
    totals: {
      ymCount: ymResults.length,
      targetCount: ymResults.reduce((sum, r) => sum + r.targetCount, 0),
      generated: ymResults.reduce((sum, r) => sum + r.generated, 0),
      skipped: ymResults.reduce((sum, r) => sum + r.skipped, 0),
      failed: ymResults.reduce((sum, r) => sum + r.failed, 0),
    },
    ymResults,
  };
}

function resolveYmList(req: NextRequest): string[] {
  const explicitYm = cleanYm(req.nextUrl.searchParams.get("ym"));
  if (explicitYm) return [explicitYm];
  const lookaheadParam = Number(req.nextUrl.searchParams.get("lookahead") ?? "");
  const lookahead =
    Number.isFinite(lookaheadParam) && lookaheadParam >= 0 && lookaheadParam <= 6
      ? lookaheadParam
      : DEFAULT_LOOKAHEAD_MONTHS;
  return targetYms(currentYmJst(), lookahead);
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const ymList = resolveYmList(req);
  const force = req.nextUrl.searchParams.get("force") === "1";

  try {
    const result = await runPrebuild(ymList, force);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("[payout-notice-prebuild GET]", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: { ym?: string; force?: boolean; lookahead?: number } = {};
  try {
    body = (await req.json()) as { ym?: string; force?: boolean; lookahead?: number };
  } catch {
    body = {};
  }

  const explicitYm = cleanYm(body.ym ?? null);
  const lookahead =
    typeof body.lookahead === "number" && body.lookahead >= 0 && body.lookahead <= 6
      ? body.lookahead
      : DEFAULT_LOOKAHEAD_MONTHS;
  const ymList = explicitYm ? [explicitYm] : targetYms(currentYmJst(), lookahead);
  const force = body.force === true;

  try {
    const result = await runPrebuild(ymList, force);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("[payout-notice-prebuild POST]", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
