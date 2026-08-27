import { NextRequest, NextResponse } from "next/server";
import { WebClient } from "@slack/web-api";
import { createAdminClient } from "@/lib/supabase/admin";
import { confirmPaymentGroup } from "@/lib/payment-confirmation";
import { cleanYm, currentYmJst, loadPaymentConfirmationGroups } from "@/lib/payment-groups";
import { freeeApi } from "@/lib/freee-client";

export const runtime = "nodejs";

type FreeePayment = {
  date?: string | null;
  amount?: number | string | null;
  from_walletable_type?: string | null;
  from_walletable_id?: number | string | null;
};

type FreeeDeal = {
  id?: number | string;
  type?: string | null;
  partner_id?: number | string | null;
  ref_number?: string | null;
  issue_date?: string | null;
  due_date?: string | null;
  amount?: number | string | null;
  due_amount?: number | string | null;
  payments?: FreeePayment[];
};

type FreeeWalletTxn = {
  id?: number | string;
  date?: string | null;
  entry_side?: string | null;
  amount?: number | string | null;
  due_amount?: number | string | null;
  description?: string | null;
  walletable_type?: string | null;
  walletable_id?: number | string | null;
};

/**
 * すでに入金確認へ使った freee の口座明細 / 取引の id を集める。
 * 同じ振込を別の請求月へ二度当てないための土台。
 */
async function loadUsedFreeeReferences(
  db: ReturnType<typeof createAdminClient>
): Promise<{ walletTxnIds: string[]; dealIds: string[] }> {
  const { data, error } = await db
    .from("billing_log")
    .select("detail")
    .eq("action", "payment_confirmed")
    .order("created_at", { ascending: false })
    .limit(2000);
  if (error) throw error;

  const walletTxnIds: string[] = [];
  const dealIds: string[] = [];
  for (const row of (data ?? []) as Array<{ detail?: unknown }>) {
    const detail = row.detail as { freee?: { wallet_txn_id?: unknown; deal_id?: unknown } } | null;
    const freee = detail?.freee;
    if (!freee) continue;
    if (freee.wallet_txn_id != null) walletTxnIds.push(String(freee.wallet_txn_id));
    if (freee.deal_id != null) dealIds.push(String(freee.deal_id));
  }
  return { walletTxnIds, dealIds };
}

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";
  return bearer === secret || req.nextUrl.searchParams.get("secret") === secret;
}

function addMonthsYm(ym: string, delta: number): string {
  const year = Number(ym.slice(0, 4));
  const month = Number(ym.slice(4, 6));
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function ymStart(ym: string): string {
  return `${ym.slice(0, 4)}-${ym.slice(4, 6)}-01`;
}

function ymEnd(ym: string): string {
  const year = Number(ym.slice(0, 4));
  const month = Number(ym.slice(4, 6));
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${ym.slice(0, 4)}-${ym.slice(4, 6)}-${String(lastDay).padStart(2, "0")}`;
}

function yen(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function paymentTotal(deal: FreeeDeal): number {
  return (deal.payments ?? []).reduce((sum, payment) => sum + yen(payment.amount), 0);
}

function isPaidDeal(deal: FreeeDeal): boolean {
  const hasDueAmount = deal.due_amount !== null && deal.due_amount !== undefined && String(deal.due_amount).trim() !== "";
  if (hasDueAmount && yen(deal.due_amount) <= 0 && yen(deal.amount) > 0) return true;
  return paymentTotal(deal) > 0;
}

function amountMatches(deal: FreeeDeal, expectedGross: number, expectedNet: number): boolean {
  const amount = yen(deal.amount);
  const paid = paymentTotal(deal);
  const candidates = [amount, paid].filter((value) => value > 0);
  return candidates.some((value) => Math.abs(value - expectedGross) <= 3 || Math.abs(value - expectedNet) <= 3);
}

function amountValueMatches(amount: unknown, expectedGross: number, expectedNet: number): boolean {
  const value = yen(amount);
  if (value <= 0) return false;
  return Math.abs(value - expectedGross) <= 3 || Math.abs(value - expectedNet) <= 3;
}

function normalizeMatchText(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[ 　\t\r\n・,，.．、。()（）［］\[\]「」『』"']/g, "")
    .replace(/株式会社|合同会社|国立大学法人|学校法人|大学法人|有限会社/g, "")
    .replace(/[ｰー－-]/g, "")
    .trim();
}

function paymentYmDateWindow(paymentYm: string) {
  return { start: ymStart(paymentYm), end: ymEnd(paymentYm) };
}

async function loadPaymentMatchKeywords(
  db: ReturnType<typeof createAdminClient>
): Promise<Map<string, string[]>> {
  const { data, error } = await db
    .from("project_knowledge")
    .select("project_id, entity_name, fact_text")
    .eq("category", "payment_alias")
    .eq("status", "active");
  if (error) throw error;

  const map = new Map<string, string[]>();
  for (const row of data ?? []) {
    const projectId = String(row.project_id || "");
    const values = [row.entity_name, row.fact_text]
      .map(normalizeMatchText)
      .filter((value) => value.length >= 4);
    if (!projectId || values.length === 0) continue;
    map.set(projectId, [...(map.get(projectId) || []), ...values]);
  }
  return map;
}

function walletTxnMatches(
  txn: FreeeWalletTxn,
  group: { projectName: string; clientName: string | null; expectedGrossAmountYen: number; expectedNetAmountYen: number },
  extraKeywords: string[]
): boolean {
  if ((txn.entry_side || "").toLowerCase() !== "income") return false;
  const amount = yen(txn.amount);
  if (amount <= 0) return false;
  if (amountValueMatches(amount, group.expectedGrossAmountYen, group.expectedNetAmountYen)) return true;

  const desc = normalizeMatchText(txn.description);
  if (!desc) return false;
  const baseKeywords = [group.projectName, group.clientName]
    .map(normalizeMatchText)
    .filter((value) => value.length >= 4);
  const keywords = [...new Set([...baseKeywords, ...extraKeywords])];
  return keywords.some((keyword) => desc.includes(keyword));
}

async function notifyFreeeSyncFailure(db: ReturnType<typeof createAdminClient>, paymentYm: string, message: string) {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return { sent: 0, skipped: "no SLACK_BOT_TOKEN" };
  const { data: admins, error } = await db
    .from("members")
    .select("member_id, code_name, slack_id")
    .eq("is_admin", true)
    .eq("status", "active")
    .not("slack_id", "is", null);
  if (error) throw error;

  const client = new WebClient(token);
  let sent = 0;
  for (const admin of admins ?? []) {
    if (!admin.slack_id) continue;
    const text = `freee入金同期が失敗: ${paymentYm}`;
    const blocks = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: [
            `*freee入金同期が失敗してる*`,
            `入金月: *${paymentYm}*`,
            `原因: \`${message.slice(0, 180)}\``,
            "freee側で自動確認できないので、この後の入金確認nudgeで手動確認して。",
          ].join("\n"),
        },
      },
    ];
    const open = await client.conversations.open({ users: admin.slack_id });
    await client.chat.postMessage({ channel: open.channel?.id || admin.slack_id, text, blocks });
    sent++;
  }
  return { sent };
}

function invoiceNumberMatches(deal: FreeeDeal, invoiceNumbers: string[]): boolean {
  const ref = String(deal.ref_number || "");
  if (!ref || invoiceNumbers.length === 0) return false;
  return invoiceNumbers.some((num) => num && ref.includes(num));
}

async function fetchIncomeDeals(paymentYm: string): Promise<FreeeDeal[]> {
  const deals: FreeeDeal[] = [];
  const limit = 100;
  for (let offset = 0; offset < 1000; offset += limit) {
    const params = new URLSearchParams({
      type: "income",
      start_due_date: ymStart(paymentYm),
      end_due_date: ymEnd(paymentYm),
      limit: String(limit),
      offset: String(offset),
    });
    const data = (await freeeApi("GET", `/api/1/deals?${params.toString()}`)) as { deals?: FreeeDeal[] };
    const page = data.deals ?? [];
    deals.push(...page);
    if (page.length < limit) break;
  }
  return deals;
}

async function fetchIncomeWalletTxns(paymentYm: string): Promise<FreeeWalletTxn[]> {
  const txns: FreeeWalletTxn[] = [];
  const limit = 100;
  const { start, end } = paymentYmDateWindow(paymentYm);
  for (let offset = 0; offset < 1000; offset += limit) {
    const params = new URLSearchParams({
      entry_side: "income",
      start_date: start,
      end_date: end,
      limit: String(limit),
      offset: String(offset),
    });
    const data = (await freeeApi("GET", `/api/1/wallet_txns?${params.toString()}`)) as { wallet_txns?: FreeeWalletTxn[] };
    const page = data.wallet_txns ?? [];
    txns.push(...page);
    if (page.length < limit) break;
  }
  return txns;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const paymentYm = cleanYm(req.nextUrl.searchParams.get("ym")) || currentYmJst();
  const dryRun = req.nextUrl.searchParams.get("dryRun") === "1";
  const includeConfirmed = dryRun && req.nextUrl.searchParams.get("includeConfirmed") === "1";
  const db = createAdminClient();

  try {
    // 入金は推定した支払月より早く着くことがある (請求書を実際に送った日が台帳に無いと、
    // 支払月の推定は保守的に後ろへずれる)。当月の入金明細で、先2か月ぶんの請求も照合する。
    const groupYms = [paymentYm, addMonthsYm(paymentYm, 1), addMonthsYm(paymentYm, 2)];
    const [groupSets, deals, walletTxns, paymentKeywords, alreadyUsed] = await Promise.all([
      Promise.all(groupYms.map((ym) => loadPaymentConfirmationGroups(db, ym, { includeConfirmed }))),
      fetchIncomeDeals(paymentYm),
      fetchIncomeWalletTxns(paymentYm),
      loadPaymentMatchKeywords(db),
      loadUsedFreeeReferences(db),
    ]);

    const groupByKey = new Map<string, (typeof groupSets)[number][number]>();
    for (const set of groupSets) {
      for (const group of set) {
        if (!groupByKey.has(group.key)) groupByKey.set(group.key, group);
      }
    }
    const groups = [...groupByKey.values()];

    // 同じ入金を二度使わない。1件の振込を複数の請求月へ当ててしまうと、
    // 実際には1か月ぶんしか入っていないのに複数月が入金済みになる (2026-08-26 に実際に起きた)。
    const usedWalletTxnIdsAcrossRuns = new Set(alreadyUsed.walletTxnIds);
    const usedDealIdsAcrossRuns = new Set(alreadyUsed.dealIds);

    const results: Array<{
      projectId: string;
      invoiceYm: string;
      matched: boolean;
      confirmed?: boolean;
      dealId?: string;
      walletTxnId?: string;
      amountYen?: number;
      source?: "deal" | "wallet_txn";
      reason?: string;
    }> = [];
    const usedWalletTxnIds = new Set<string>(usedWalletTxnIdsAcrossRuns);

    for (const group of groups) {
      if (!group.freeePartnerId) {
        results.push({ projectId: group.projectId, invoiceYm: group.invoiceYm, matched: false, reason: "freee_partner_id missing" });
        continue;
      }
      const partnerDeals = deals.filter(
        (deal) =>
          String(deal.partner_id ?? "") === String(group.freeePartnerId) &&
          !usedDealIdsAcrossRuns.has(String(deal.id ?? ""))
      );
      const match = partnerDeals.find(
        (deal) =>
          isPaidDeal(deal) &&
          (invoiceNumberMatches(deal, group.freeeInvoiceNumbers) ||
            amountMatches(deal, group.expectedGrossAmountYen, group.expectedNetAmountYen))
      );
      const walletMatch = walletTxns.find((txn) => {
        const id = txn.id != null ? String(txn.id) : "";
        if (id && usedWalletTxnIds.has(id)) return false;
        return walletTxnMatches(txn, group, paymentKeywords.get(group.projectId) || []);
      });
      if (!match && !walletMatch) {
        results.push({ projectId: group.projectId, invoiceYm: group.invoiceYm, matched: false, reason: "no paid matching deal/wallet txn" });
        continue;
      }

      const amountYen = match ? (paymentTotal(match) || yen(match.amount)) : yen(walletMatch?.amount);
      if (walletMatch?.id != null) usedWalletTxnIds.add(String(walletMatch.id));
      if (match?.id != null) usedDealIdsAcrossRuns.add(String(match.id));
      if (!dryRun) {
        await confirmPaymentGroup(db, {
          projectId: group.projectId,
          invoiceYm: group.invoiceYm,
          sourceYms: group.sourceYms,
          expectedAmountYen: group.expectedGrossAmountYen,
          expectedNetAmountYen: group.expectedNetAmountYen,
          exp: Date.now() + 60_000,
        }, {
          amountYen,
          receivedOn:
            (match ? (match.payments ?? []).map((payment) => payment.date).filter(Boolean)[0] : null) ||
            walletMatch?.date ||
            null,
          source: match ? "freee_deal" : "freee_wallet_txn",
          actor: "freee:auto",
          note: match ? "freee paid income deal matched" : "freee income wallet transaction matched",
          freeePayload: {
            deal_id: match?.id ?? null,
            wallet_txn_id: walletMatch?.id ?? null,
            ref_number: match?.ref_number ?? null,
            issue_date: match?.issue_date ?? null,
            due_date: match?.due_date ?? null,
            txn_date: walletMatch?.date ?? null,
            description: walletMatch?.description ?? null,
            amount: match ? yen(match.amount) : yen(walletMatch?.amount),
            due_amount: match ? yen(match.due_amount) : yen(walletMatch?.due_amount),
            payments: match?.payments ?? [],
          },
        });
      }

      results.push({
        projectId: group.projectId,
        invoiceYm: group.invoiceYm,
        matched: true,
        confirmed: !dryRun,
        source: match ? "deal" : "wallet_txn",
        dealId: match?.id != null ? String(match.id) : undefined,
        walletTxnId: walletMatch?.id != null ? String(walletMatch.id) : undefined,
        amountYen,
      });
    }

    return NextResponse.json({
      ok: true,
      ym: paymentYm,
      dryRun,
      includeConfirmed,
      groupCount: groups.length,
      dealCount: deals.length,
      walletTxnCount: walletTxns.length,
      confirmed: results.filter((result) => result.confirmed).length,
      results,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    let alert: unknown = dryRun ? { skipped: "dryRun" } : null;
    if (!dryRun) {
      try {
        alert = await notifyFreeeSyncFailure(db, paymentYm, message);
      } catch (alertError) {
        alert = { ok: false, error: alertError instanceof Error ? alertError.message : String(alertError) };
      }
    }
    return NextResponse.json({ ok: false, error: message, alert }, { status: 500 });
  }
}
