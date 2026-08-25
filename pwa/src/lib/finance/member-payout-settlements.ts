/**
 * AMD からメンバーへの業務委託費の **実支払** を freee の出金から自動で取り込み、
 * 支払通知書 (`payout_notices`) と突き合わせる。
 *
 * 背景 (まさ指摘 2026-08-26): 支払済みかどうかを OS が人に聞く状態は設計の誤り。
 * これまで OS が持っていたのは「支払通知書を送った」(`payout_notices.sent_at`) と、
 * 手で押す「報酬支払済み」印 (`billing_cycles.reward_paid_at`) だけで、実際の振込は
 * どこにも入っていなかった。クライアントからの入金は `/api/cron/freee-payment-sync` が
 * すでに freee から自動で取り込んでいるので、出金側にも同じ経路を用意する。
 *
 * 誰宛の支払かを決める手がかりは3つ。上から順に強い。
 *   1. `partner_name`  freee の取引に付いた取引先名 (漢字)。旧字体を吸収して氏名・屋号と照合する
 *   2. `transfer_alias` 口座明細の振込名義 (カタカナ)。過去に確定した振込から学習済みのもの
 *   3. `notice_amount` 支払通知書の税込額と1円単位で一致する振込。ここで確定したら、
 *                      その振込名義を 2 のエイリアスとして学習し、次からは金額が違っても拾える
 *
 * ここは検知と台帳化だけを行う。報酬計算 (`reward-summary.ts`) の未払い残や、報酬債務の控除
 * (`reward_member_liability_offsets`) を自動で書き換えることはしない (AGENTS: 検知・台帳化と
 * 実書き込みを分ける)。
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { freeeApi } from "@/lib/freee-client";
import {
  buildSettlements,
  mergeOutflows,
  type FreeeExpenseDeal,
  type FreeeWalletTxn,
  type SettlementMemberRow,
  type SettlementNoticeRow,
  type SettlementRow,
  type TransferAliasRow,
} from "@/lib/finance/member-payout-matching";

export * from "@/lib/finance/member-payout-matching";

type SupabaseLike = SupabaseClient;

async function fetchAll<T>(path: string, key: string, params: Record<string, string>): Promise<T[]> {
  const rows: T[] = [];
  const limit = 100;
  for (let offset = 0; offset < 3000; offset += limit) {
    const search = new URLSearchParams({ ...params, limit: String(limit), offset: String(offset) });
    const data = (await freeeApi("GET", `${path}?${search.toString()}`)) as Record<string, unknown>;
    const page = (data[key] as T[]) ?? [];
    rows.push(...page);
    if (page.length < limit) break;
  }
  return rows;
}

export async function fetchExpenseDeals(startDate: string, endDate: string): Promise<FreeeExpenseDeal[]> {
  return fetchAll<FreeeExpenseDeal>("/api/1/deals", "deals", {
    type: "expense",
    start_issue_date: startDate,
    end_issue_date: endDate,
  });
}

export async function fetchExpenseWalletTxns(startDate: string, endDate: string): Promise<FreeeWalletTxn[]> {
  return fetchAll<FreeeWalletTxn>("/api/1/wallet_txns", "wallet_txns", {
    entry_side: "expense",
    start_date: startDate,
    end_date: endDate,
  });
}

export async function fetchPartnerNames(): Promise<Map<string, string>> {
  const partners = await fetchAll<{ id?: number | string; name?: string | null; long_name?: string | null }>(
    "/api/1/partners",
    "partners",
    {}
  );
  const map = new Map<string, string>();
  for (const partner of partners) {
    if (partner.id == null) continue;
    map.set(String(partner.id), String(partner.name || partner.long_name || ""));
  }
  return map;
}

export async function loadSettlementInputs(db: SupabaseLike): Promise<{
  members: SettlementMemberRow[];
  notices: SettlementNoticeRow[];
  aliases: TransferAliasRow[];
}> {
  const [membersRes, noticesRes, aliasesRes] = await Promise.all([
    db.from("members").select("member_id, code_name, member_name, contractor_name"),
    db.from("payout_notices").select("member_id, ym, notice_no, total_yen, sent_at, paid_on"),
    db.from("member_bank_transfer_aliases").select("alias, member_id"),
  ]);
  if (membersRes.error) throw membersRes.error;
  if (noticesRes.error) throw noticesRes.error;
  if (aliasesRes.error) throw aliasesRes.error;
  return {
    members: (membersRes.data ?? []) as SettlementMemberRow[],
    notices: (noticesRes.data ?? []) as SettlementNoticeRow[],
    aliases: (aliasesRes.data ?? []) as TransferAliasRow[],
  };
}

export async function persistSettlements(
  db: SupabaseLike,
  settlements: SettlementRow[],
  learnedAliases: Array<{ alias: string; memberId: string; rawText: string; learnedFrom: string }>
): Promise<{ upserted: number; aliasesLearned: number; noticesMarkedPaid: number }> {
  if (learnedAliases.length > 0) {
    const { error } = await db.from("member_bank_transfer_aliases").upsert(
      learnedAliases.map((alias) => ({
        alias: alias.alias,
        member_id: alias.memberId,
        raw_text: alias.rawText,
        learned_from: alias.learnedFrom,
      })),
      { onConflict: "alias" }
    );
    if (error) throw error;
  }

  if (settlements.length > 0) {
    const { error } = await db.from("member_payout_settlements").upsert(
      settlements.map((row) => ({
        source: row.source,
        source_id: row.sourceId,
        paid_on: row.paidOn,
        amount_yen: row.amountYen,
        member_id: row.memberId,
        member_match_method: row.memberMatchMethod,
        member_match_reason: row.memberMatchReason,
        partner_name: row.partnerName,
        description: row.description,
        transfer_name: row.transferName,
        notice_ym: row.noticeYm,
        notice_no: row.noticeNo,
        notice_total_yen: row.noticeTotalYen,
        amount_match: row.amountMatch,
        confidence: row.confidence,
        synced_at: new Date().toISOString(),
      })),
      { onConflict: "source,source_id" }
    );
    if (error) throw error;
  }

  // 支払通知書へ「実際にいつ・いくら振り込んだか」を書き戻すのは、金額まで一致した振込だけ。
  let noticesMarkedPaid = 0;
  for (const row of settlements) {
    if (row.confidence !== "high" || !row.memberId || !row.noticeYm) continue;
    const { error } = await db
      .from("payout_notices")
      .update({ paid_on: row.paidOn, paid_amount_yen: row.amountYen })
      .eq("member_id", row.memberId)
      .eq("ym", row.noticeYm);
    if (error) throw error;
    noticesMarkedPaid++;
  }

  return { upserted: settlements.length, aliasesLearned: learnedAliases.length, noticesMarkedPaid };
}

export async function syncMemberPayoutSettlements(
  db: SupabaseLike,
  options: { startDate: string; endDate: string; dryRun?: boolean }
): Promise<{
  window: { start: string; end: string };
  dealCount: number;
  walletTxnCount: number;
  outflowCount: number;
  settlements: SettlementRow[];
  learnedAliases: Array<{ alias: string; memberId: string; rawText: string; learnedFrom: string }>;
  persisted: { upserted: number; aliasesLearned: number; noticesMarkedPaid: number } | null;
}> {
  const [deals, walletTxns, partnerNames, inputs] = await Promise.all([
    fetchExpenseDeals(options.startDate, options.endDate),
    fetchExpenseWalletTxns(options.startDate, options.endDate),
    fetchPartnerNames(),
    loadSettlementInputs(db),
  ]);

  const outflows = mergeOutflows({ deals, walletTxns, partnerNames });
  const { settlements, learnedAliases } = buildSettlements({
    outflows,
    members: inputs.members,
    notices: inputs.notices,
    aliases: inputs.aliases,
  });

  const persisted = options.dryRun ? null : await persistSettlements(db, settlements, learnedAliases);

  return {
    window: { start: options.startDate, end: options.endDate },
    dealCount: deals.length,
    walletTxnCount: walletTxns.length,
    outflowCount: outflows.length,
    settlements,
    learnedAliases,
    persisted,
  };
}
