/**
 * 承認済みの立替精算を、その月の支払通知書へ合算するための取得と記録。
 *
 * 背景 (まさ依頼 2026-08-26): マニュアル 2-2 章は「承認された立替は報酬に上乗せされ、
 * 報酬+立替を合算した金額が支払通知書に載る」としていたが、GAS から PWA へ移った際に
 * 支払側の実装が落ちていて、承認済みの立替がどの支払月にも乗らないままだった。
 *
 * 立替は実費の精算なので、報酬とは扱いが違う。
 *   - 消費税を上乗せしない (申請額がそのまま支払額)
 *   - 報酬の月次支払上限 (65% cap) では削らない。原資が違うため
 *   - 一度どこかの支払通知書へ乗せたら `reimbursements.billed_ym` に支払月を書き、二度と拾わない
 */

import type { SupabaseClient } from "@supabase/supabase-js";

type SupabaseLike = SupabaseClient;

export type PayableReimbursement = {
  reimbursementId: string;
  memberId: string;
  projectId: string | null;
  projectName: string | null;
  date: string | null;
  category: string | null;
  description: string | null;
  amountYen: number;
  approvedAt: string | null;
  billedYm: string | null;
};

export type ReimbursementsByMember = Map<string, PayableReimbursement[]>;

export type ReimbursementRow = {
  reimbursement_id: string;
  project_id?: string | null;
  project_name?: string | null;
  date?: string | null;
  category?: string | null;
  description?: string | null;
  amount?: number | string | null;
  status?: string | null;
  created_by?: string | null;
  admin_approved_at?: string | null;
  billed_ym?: string | null;
};

type MemberEmailRow = {
  member_id: string;
  email?: string | null;
};

/** admin 承認済みだけが支払対象。PM承認どまり・却下・下書きは乗せない */
const PAYABLE_STATUS = "approved";

/**
 * 締切を適用しはじめる支払月。
 *
 * 締切 (前月末) を過去へ遡って当てると、すでに画面へ出ている立替が翌月送りになって
 * 金額が黙って動く。ルールの適用はこの月の支払分から始める。
 */
const CUTOFF_RULE_FROM_PAYMENT_YM = "202609";

function numberValue(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function ymEndIso(ym: string): string {
  const year = Number(ym.slice(0, 4));
  const month = Number(ym.slice(4, 6));
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${ym.slice(0, 4)}-${ym.slice(4, 6)}-${String(lastDay).padStart(2, "0")}T23:59:59.999Z`;
}

function prevYm(ym: string): string {
  const year = Number(ym.slice(0, 4));
  const month = Number(ym.slice(4, 6));
  const date = new Date(Date.UTC(year, month - 2, 1));
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * その支払月に間に合う承認の締切。
 *
 * 支払は毎月7日。7日に振り込むには、その前に金額を確定して振込データを作る必要があるので、
 * **支払月の前月末までに admin 承認が済んだ立替**をその回に乗せる。締切を過ぎた分は次の回。
 * (まさ指摘 2026-08-29「6日の深夜に月初合意送られても振込する方は大変」)
 */
export function reimbursementApprovalCutoffIso(paymentYm: string): string {
  if (paymentYm < CUTOFF_RULE_FROM_PAYMENT_YM) return ymEndIso(paymentYm);
  return ymEndIso(prevYm(paymentYm));
}

export function reimbursementLabel(row: PayableReimbursement): string {
  const date = row.date ? `${row.date.slice(5, 7)}/${row.date.slice(8, 10)}` : "";
  const project = row.projectName || row.projectId || "";
  const detail = (row.description || row.category || "立替精算").replace(/\s+/g, " ").slice(0, 40);
  return [`立替精算`, project, date, detail].filter(Boolean).join(" ");
}

/**
 * 取得済みの行から、その支払月に載せる立替を選ぶ純粋関数。
 *
 * 対象は「admin 承認済み」かつ「まだどの支払月にも乗っていない (`billed_ym` が空)」もので、
 * 承認がその支払月の月末までに済んでいるもの。すでにこの支払月へ乗せたものは、
 * 再発行しても同じ内容になるよう対象に含める。
 * 取り違えると二重払い・払い漏れに直結するので、規則はここに閉じて検査できるようにする
 * (`scripts/check_payout_reimbursements.mts`)。
 */
export function selectPayableReimbursements(
  rows: ReimbursementRow[],
  memberByEmail: Map<string, string>,
  paymentYm: string
): ReimbursementsByMember {
  const cutoff = reimbursementApprovalCutoffIso(paymentYm);
  const byMember: ReimbursementsByMember = new Map();

  for (const row of rows) {
    if (String(row.status ?? "") !== PAYABLE_STATUS) continue;

    const billedYm = String(row.billed_ym ?? "").trim();
    // 別の支払月へ載せ済みのものは二度と拾わない。同じ支払月のものは再発行で同じ内容にするため残す
    if (billedYm && billedYm !== paymentYm) continue;

    const approvedAt = String(row.admin_approved_at ?? "").trim();
    if (!approvedAt) continue;
    if (!billedYm && approvedAt > cutoff) continue;

    const email = String(row.created_by ?? "").trim().toLowerCase();
    const memberId = memberByEmail.get(email);
    if (!memberId) continue;

    const amountYen = numberValue(row.amount);
    if (amountYen <= 0) continue;

    const entry: PayableReimbursement = {
      reimbursementId: row.reimbursement_id,
      memberId,
      projectId: row.project_id ?? null,
      projectName: row.project_name ?? null,
      date: row.date ?? null,
      category: row.category ?? null,
      description: row.description ?? null,
      amountYen,
      approvedAt: approvedAt || null,
      billedYm: billedYm || null,
    };
    byMember.set(memberId, [...(byMember.get(memberId) ?? []), entry]);
  }

  for (const [memberId, list] of byMember.entries()) {
    byMember.set(
      memberId,
      list.sort((a, b) => String(a.date ?? "").localeCompare(String(b.date ?? "")))
    );
  }
  return byMember;
}

/** 指定した支払月の通知書に載せるべき立替を、メンバーごとに返す */
export async function loadPayableReimbursements(
  db: SupabaseLike,
  paymentYm: string
): Promise<ReimbursementsByMember> {
  const [membersRes, reimbursementsRes] = await Promise.all([
    db.from("members").select("member_id, email"),
    db
      .from("reimbursements")
      .select(
        "reimbursement_id, project_id, project_name, date, category, description, amount, status, created_by, admin_approved_at, billed_ym"
      )
      .eq("status", PAYABLE_STATUS),
  ]);
  if (membersRes.error) throw membersRes.error;
  if (reimbursementsRes.error) throw reimbursementsRes.error;

  const memberByEmail = new Map<string, string>();
  for (const member of (membersRes.data ?? []) as MemberEmailRow[]) {
    const email = String(member.email ?? "").trim().toLowerCase();
    if (email) memberByEmail.set(email, member.member_id);
  }

  return selectPayableReimbursements(
    (reimbursementsRes.data ?? []) as ReimbursementRow[],
    memberByEmail,
    paymentYm
  );
}

export function reimbursementTotalYen(rows: PayableReimbursement[] | undefined): number {
  return (rows ?? []).reduce((sum, row) => sum + row.amountYen, 0);
}

/** 支払通知書へ乗せた立替に支払月を刻む。ここが二重払いの防波堤 */
export async function markReimbursementsBilled(
  db: SupabaseLike,
  reimbursementIds: string[],
  paymentYm: string
): Promise<{ marked: number }> {
  if (reimbursementIds.length === 0) return { marked: 0 };
  const { data, error } = await db
    .from("reimbursements")
    .update({ billed_ym: paymentYm })
    .in("reimbursement_id", reimbursementIds)
    .is("billed_ym", null)
    .select("reimbursement_id");
  if (error) throw error;
  return { marked: data?.length ?? 0 };
}
