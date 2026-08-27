/**
 * きよあどみ — 支払通知書ビューワー / 承認 API
 *
 * ============================================================
 * 【原則】このアプリは金額を計算しない。
 * ============================================================
 * 表示する数字はすべて AMD OS 本体が確定させて Supabase に保存した値を
 * そのまま読む。計算・PDF生成・支払データの確定はすべて本体の責務:
 *
 *   報酬の計算結果  → billing_cycles.reward_summary_json
 *                     本体 日次 /api/cron/payout-reward-cache-refresh（JST 03:05）
 *   支払明細の確定  → monthly_reward_payout
 *                     本体 /admin/payouts の保存操作
 *   通知書と金額    → payout_notices
 *                     本体 日次 /api/cron/payout-notice-prebuild（JST 02:00）
 *
 * ここが持つのは2つだけ:
 *   GET   ?ym=YYYYMM            確定済みの支払通知書を読む（ビューワー）
 *   PATCH action=update_notice  送付済みにする / 取り消す（承認）
 *
 * ⚠️ 計算・PDF生成・金額の上書きをここに足さないこと。
 *    本体と結果がズレると、画面は壊れないまま金額だけ静かに間違う。
 *    2026-08-27 以前はここに独自計算があり、本体と5か所ズレていた:
 *      1. 報酬計算式が本体の1/4の抜粋版（確定分の保護・相殺・上限繰越が無い）
 *      2. 予算超過時に独自に比例圧縮して全員を減額していた
 *      3. 金額を手動上書きしたメンバーを通知書から落としていた
 *      4. 支払ルール「請求書受領後60日」を知らず対象月がズレていた
 *      5. 立替精算（別原資）の存在を知らなかった
 *    さらに再計算結果を reward_summary_json に上書きし、本体の表示まで汚していた。
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/api-auth";
import { cleanYm } from "@/lib/ym";

export const runtime = "nodejs";

/** payout_notices の1行。すべて本体が書いた値。 */
type NoticeRow = {
  member_id: string;
  ym: string;
  sent_at: string | null;
  notice_no: string | null;
  pdf_url: string | null;
  total_yen: number | string | null;
  reimbursement_yen: number | string | null;
  last_generated_at: string | null;
};

type MemberRow = {
  member_id: string;
  code_name: string | null;
  member_name: string | null;
  email: string | null;
};

function yenValue(value: unknown): number {
  const n = typeof value === "string" ? Number(value) : typeof value === "number" ? value : 0;
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function textValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * 支払月 ym の通知書を読む。
 * payout_notices は支払月をキーに持つので、対象月の解決も本体任せでよい。
 */
async function loadNotices(ym: string) {
  const db = createAdminClient();

  const [noticesRes, membersRes] = await Promise.all([
    db
      .from("payout_notices")
      .select("member_id, ym, sent_at, notice_no, pdf_url, total_yen, reimbursement_yen, last_generated_at")
      .eq("ym", ym),
    db.from("members").select("member_id, code_name, member_name, email"),
  ]);

  if (noticesRes.error) throw noticesRes.error;
  if (membersRes.error) throw membersRes.error;

  const memberById = new Map<string, MemberRow>();
  for (const member of (membersRes.data ?? []) as MemberRow[]) {
    memberById.set(member.member_id, member);
  }

  const rows = ((noticesRes.data ?? []) as NoticeRow[]).map((notice) => {
    const member = memberById.get(notice.member_id);
    // 報酬と立替は別原資。合算せずに保存されているので、表示用にここで足すだけ。
    const rewardYen = yenValue(notice.total_yen);
    const reimbursementYen = yenValue(notice.reimbursement_yen);
    return {
      memberId: notice.member_id,
      memberName:
        textValue(member?.member_name) || textValue(member?.code_name) || notice.member_id,
      codeName: textValue(member?.code_name) || null,
      email: textValue(member?.email) || null,
      rewardYen,
      reimbursementYen,
      payableYen: rewardYen + reimbursementYen,
      noticeNo: textValue(notice.notice_no) || null,
      pdfUrl: textValue(notice.pdf_url) || null,
      sentAt: notice.sent_at ?? null,
      lastGeneratedAt: notice.last_generated_at ?? null,
    };
  });

  rows.sort((a, b) => b.payableYen - a.payableYen || a.memberName.localeCompare(b.memberName, "ja"));

  return {
    ym,
    rows,
    summary: {
      memberCount: rows.length,
      sentCount: rows.filter((row) => row.sentAt).length,
      pdfMissingCount: rows.filter((row) => !row.pdfUrl).length,
      totalPayableYen: rows.reduce((sum, row) => sum + row.payableYen, 0),
    },
  };
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const ym = cleanYm(req.nextUrl.searchParams.get("ym"));
  if (!ym) {
    return NextResponse.json({ ok: false, error: "valid ym is required" }, { status: 400 });
  }

  try {
    return NextResponse.json({ ok: true, ...(await loadNotices(ym)) });
  } catch (err) {
    console.error("[kiyo payouts GET]", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * 承認操作。送付済みフラグ（sent_at）だけを書き換える。
 *
 * ⚠️ ここで total_yen / pdf_url / notice_no を書かないこと。
 *    本体が確定させた値なので、上書きすると金額とPDFが食い違う。
 *    行が無い場合も作らない（通知書を作るのは本体の日次処理）。
 */
export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  if (body.action !== "update_notice") {
    return NextResponse.json(
      { ok: false, error: `unsupported action: ${textValue(body.action)}` },
      { status: 400 }
    );
  }

  const ym = cleanYm(typeof body.ym === "string" ? body.ym : null);
  const memberId = textValue(body.memberId);
  if (!ym || !memberId) {
    return NextResponse.json({ ok: false, error: "ym and memberId are required" }, { status: 400 });
  }
  if (typeof body.sent !== "boolean") {
    return NextResponse.json({ ok: false, error: "sent (boolean) is required" }, { status: 400 });
  }

  try {
    const db = createAdminClient();
    const { data: updated, error } = await db
      .from("payout_notices")
      .update({ sent_at: body.sent ? new Date().toISOString() : null })
      .eq("member_id", memberId)
      .eq("ym", ym)
      .select("member_id")
      .maybeSingle();
    if (error) throw error;

    if (!updated) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "この支払月にこのメンバーの通知書がまだ無い。通知書は AMD OS 本体が作るので、本体側の発行を待つこと。",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      updatedNoticeMemberId: memberId,
      ...(await loadNotices(ym)),
    });
  } catch (err) {
    console.error("[kiyo payouts PATCH update_notice]", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
