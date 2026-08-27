// freeeの収入取引を取引先別に集計して company_actual_monthly へ入れる。
// きよ「お金の流れ」の「どこから入ってきたか」を、OSの請求台帳(手入力で進める前提)ではなく
// freee会計の実データで出すために使う。
//
// category='revenue_partner' を使い、試算表由来の category='revenue' とは分けて保存する
// (同じ売上を二度足さないため)。
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { freeeApi } from "@/lib/freee-client";

export const runtime = "nodejs";
export const maxDuration = 300;

type DealDetail = { account_item_id?: number | string; amount?: number | string; vat?: number | string };
type Deal = {
  id?: number | string;
  type?: string | null;
  partner_id?: number | string | null;
  issue_date?: string | null;
  amount?: number | string | null;
  details?: DealDetail[];
};
type Partner = { id?: number | string; name?: string | null };

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";
  return bearer === secret || req.nextUrl.searchParams.get("secret") === secret;
}

function ymStart(ym: string): string {
  return `${ym.slice(0, 4)}-${ym.slice(4, 6)}-01`;
}
function ymEnd(ym: string): string {
  const lastDay = new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(4, 6)), 0)).getUTCDate();
  return `${ym.slice(0, 4)}-${ym.slice(4, 6)}-${String(lastDay).padStart(2, "0")}`;
}
function yen(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

/** 売上として数える勘定科目。営業外(受取利息・雑収入)は「どこから」に混ぜない。 */
const SALES_ACCOUNT_NAMES = new Set(["売上高"]);

async function fetchAccountItemNames(): Promise<Map<string, string>> {
  const data = (await freeeApi("GET", "/api/1/account_items")) as { account_items?: Array<{ id?: number | string; name?: string | null }> };
  const map = new Map<string, string>();
  for (const item of data.account_items ?? []) {
    if (item?.id != null) map.set(String(item.id), String(item.name ?? ""));
  }
  return map;
}

async function fetchPartnerNames(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const limit = 100;
  for (let offset = 0; offset < 2000; offset += limit) {
    const data = (await freeeApi("GET", `/api/1/partners?limit=${limit}&offset=${offset}`)) as { partners?: Partner[] };
    const page = data.partners ?? [];
    for (const partner of page) {
      if (partner?.id != null) map.set(String(partner.id), String(partner.name ?? ""));
    }
    if (page.length < limit) break;
  }
  return map;
}

async function fetchIncomeDeals(ym: string): Promise<Deal[]> {
  const deals: Deal[] = [];
  const limit = 100;
  for (let offset = 0; offset < 2000; offset += limit) {
    const params = new URLSearchParams({
      type: "income",
      start_issue_date: ymStart(ym),
      end_issue_date: ymEnd(ym),
      limit: String(limit),
      offset: String(offset),
    });
    const data = (await freeeApi("GET", `/api/1/deals?${params.toString()}&accruals=with`)) as { deals?: Deal[] };
    const page = data.deals ?? [];
    deals.push(...page);
    if (page.length < limit) break;
  }
  return deals;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const ymParam = req.nextUrl.searchParams.get("ym") || "";
  if (!/^\d{6}$/.test(ymParam)) return NextResponse.json({ ok: false, error: "ym=YYYYMM is required" }, { status: 400 });
  const dryRun = req.nextUrl.searchParams.get("dryRun") === "1";

  try {
    const [accountItems, partners, deals] = await Promise.all([
      fetchAccountItemNames(),
      fetchPartnerNames(),
      fetchIncomeDeals(ymParam),
    ]);

    // 取引先ごとに売上高(税抜)を合算する。取引先が未設定の取引は「取引先未設定」へまとめる。
    const byPartner = new Map<string, { partnerId: string | null; name: string; amountYen: number; dealCount: number }>();
    let skippedDeals = 0;
    for (const deal of deals) {
      const salesAmount = (deal.details ?? []).reduce((sum, detail) => {
        const accountName = accountItems.get(String(detail.account_item_id ?? "")) ?? "";
        if (!SALES_ACCOUNT_NAMES.has(accountName)) return sum;
        // freeeの内税取引では detail.amount が税込。vat を引いて税抜へ揃える。
        return sum + (yen(detail.amount) - yen(detail.vat));
      }, 0);
      if (salesAmount <= 0) {
        skippedDeals += 1;
        continue;
      }
      const partnerId = deal.partner_id != null ? String(deal.partner_id) : null;
      const name = (partnerId ? partners.get(partnerId) : "") || "取引先未設定";
      const key = partnerId ?? "__none__";
      const current = byPartner.get(key) ?? { partnerId, name, amountYen: 0, dealCount: 0 };
      current.amountYen += salesAmount;
      current.dealCount += 1;
      byPartner.set(key, current);
    }

    const rows = [...byPartner.values()]
      .filter((row) => row.amountYen > 0)
      .sort((a, b) => b.amountYen - a.amountYen)
      .map((row) => ({
        ym: ymParam,
        scope: "company" as const,
        project_id: null,
        category: "revenue_partner",
        account_name: row.name,
        actual_amount_yen: row.amountYen,
        freee_account_item_id: null,
        freee_partner_id: row.partnerId,
        source_ref: `freee:deals_revenue_partner:${ymParam}`,
        raw_hash: `${ymParam}:${row.partnerId ?? "none"}:${row.amountYen}`,
        payload: { dealCount: row.dealCount, source: "freee.deals(type=income)" },
      }));

    if (!dryRun) {
      const db = createAdminClient();
      const { error: deleteError } = await db
        .from("company_actual_monthly")
        .delete()
        .eq("ym", ymParam)
        .eq("category", "revenue_partner");
      if (deleteError) throw new Error(`delete revenue_partner: ${deleteError.message}`);
      if (rows.length > 0) {
        const { error: insertError } = await db.from("company_actual_monthly").insert(rows);
        if (insertError) throw new Error(`insert revenue_partner: ${insertError.message}`);
      }
    }

    return NextResponse.json({
      ok: true,
      ym: ymParam,
      dryRun,
      dealCount: deals.length,
      skippedDeals,
      rowCount: rows.length,
      rows: rows.map((row) => ({ name: row.account_name, amountYen: row.actual_amount_yen })),
    });
  } catch (cause) {
    console.error("[freee-revenue-by-partner]", cause);
    return NextResponse.json({ ok: false, error: cause instanceof Error ? cause.message : "failed" }, { status: 500 });
  }
}
