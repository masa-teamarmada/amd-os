import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/api-auth";
import {
  loadReconciliationOverview,
  runWeeklyReconciliation,
  executeOfficerCompensationReconcile,
} from "@/lib/finance/freee-reconciliation-client";
import { fetchWalletTxns, fetchFreeeAccountItems } from "@/lib/finance/freee-cash-balances";
import { loadOfficerReserve } from "@/lib/finance/officer-compensation";
import { currentYmJst } from "@/lib/payment-groups";
import { detectOfficerCompensationFindings } from "@/lib/finance/freee-reconciliation-engine";

export const runtime = "nodejs";
export const maxDuration = 300;

const OFFICER_ACCOUNT_ITEM_PATTERN = /役員報酬/;
const REVIEW_DECISIONS = new Set(["approved", "rejected"]);

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;
  const db = createAdminClient();
  try {
    const overview = await loadReconciliationOverview(db);
    return NextResponse.json({ ok: true, overview });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;
  const db = createAdminClient();

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON body" }, { status: 400 });
  }

  const action = String(body.action ?? "");

  if (action === "run") {
    const dryRun = body.dryRun !== false; // 明示的に false を渡した場合のみ実runにする。既定はdry-run。
    try {
      const result = await runWeeklyReconciliation(db, { triggeredBy: "admin_manual", dryRun });
      return NextResponse.json(result, { status: result.ok ? 200 : 500 });
    } catch (error) {
      return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }
  }

  if (action === "review") {
    const findingId = String(body.findingId ?? "");
    const decision = String(body.decision ?? "");
    if (!findingId || !REVIEW_DECISIONS.has(decision)) {
      return NextResponse.json({ ok: false, error: "findingId and decision(approved|rejected) are required" }, { status: 400 });
    }
    const { data: finding, error: findingError } = await db
      .from("freee_reconciliation_findings")
      .select("*")
      .eq("id", findingId)
      .single();
    if (findingError || !finding) {
      return NextResponse.json({ ok: false, error: findingError?.message ?? "finding not found" }, { status: 404 });
    }

    let writeResult: { attempted: boolean; ok: boolean; error: string | null } = { attempted: false, ok: true, error: null };

    if (
      decision === "approved" &&
      finding.finding_type === "officer_compensation_unreconciled" &&
      finding.eligible_for_auto_apply &&
      finding.match_confidence === "exact"
    ) {
      if (body.confirmWrite !== true) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "この承認は freee への即時書き込み（対象明細のaccount_item_idを役員報酬へ分類）を伴います。confirmWrite:true を明示して再送してください。",
            requiresConfirmation: true,
          },
          { status: 409 }
        );
      }
      // サーバー側再検証: 承認時点のfreee状態で改めて完全一致するか確認してから書く。
      writeResult.attempted = true;
      try {
        const [officerReserve, accountItems, walletTxns] = await Promise.all([
          loadOfficerReserve(db, currentYmJst()),
          fetchFreeeAccountItems(),
          fetchWalletTxns(
            new Date(Date.now() - 60 * 86_400_000).toISOString().slice(0, 10),
            new Date().toISOString().slice(0, 10)
          ),
        ]);
        const officer = officerReserve.entries.find((e) => e.memberId === finding.member_id);
        if (!officer) {
          writeResult = { attempted: true, ok: false, error: "再検証失敗: 承認時点でこの役員報酬の期待額が見つからない（既に消込済み、または対象外になった可能性）" };
        } else {
          const walletTxnsForAudit = walletTxns
            .filter((t) => t.date && t.walletable_type && t.walletable_id != null && t.amount != null)
            .map((t) => ({
              id: t.id ?? "",
              date: String(t.date),
              walletableType: String(t.walletable_type),
              walletableId: t.walletable_id as string | number,
              walletableName: null,
              amountYen: Math.round(Number(t.amount ?? 0)),
              direction:
                String(t.entry_side ?? "").toLowerCase() === "income"
                  ? ("income" as const)
                  : String(t.entry_side ?? "").toLowerCase() === "expense"
                    ? ("expense" as const)
                    : null,
              dealId: t.deal_id ?? null,
              transferId: t.transfer_id ?? null,
              description: t.description ?? null,
            }));
          const refreshed = detectOfficerCompensationFindings([officer], walletTxnsForAudit).find((f) => f.findingKey === finding.finding_key);
          if (!refreshed || refreshed.matchConfidence !== "exact" || !refreshed.eligibleForAutoApply || !refreshed.freeeEntityId) {
            writeResult = { attempted: true, ok: false, error: "再検証失敗: 承認時点の再取得で完全一致条件を満たさなくなった（分割/手数料混在/複数候補化などの可能性）" };
          } else {
            const officerAccountItemId = [...accountItems.entries()].find(([, name]) => OFFICER_ACCOUNT_ITEM_PATTERN.test(name))?.[0];
            if (!officerAccountItemId) {
              writeResult = { attempted: true, ok: false, error: "役員報酬account_itemがfreee側に見つからない" };
            } else {
              const result = await executeOfficerCompensationReconcile(refreshed.freeeEntityId, officerAccountItemId);
              writeResult = { attempted: true, ok: result.ok, error: result.error };
              await db.from("freee_reconciliation_actions").insert({
                finding_id: findingId,
                run_id: finding.run_id,
                action_type: "officer_compensation_reconcile",
                idempotency_key: `${finding.finding_key}:officer_compensation_reconcile:manual:${auth.user.email}:${Date.now()}`,
                mode: "executed",
                freee_write_status: result.ok ? "succeeded" : "failed",
                freee_wallet_txn_id: refreshed.freeeEntityId,
                freee_account_item_id: officerAccountItemId,
                before_state_json: result.before ?? {},
                after_state_json: result.after ?? null,
                error_message: result.error,
                executed_by: auth.user.email,
                executed_at: new Date().toISOString(),
              });
            }
          }
        }
      } catch (error) {
        writeResult = { attempted: true, ok: false, error: error instanceof Error ? error.message : String(error) };
      }
    }

    const { data: updated, error: updateError } = await db
      .from("freee_reconciliation_findings")
      .update({
        review_status: decision,
        reviewed_by: auth.user.email,
        reviewed_at: new Date().toISOString(),
        review_note: [
          typeof body.note === "string" ? body.note : null,
          writeResult.attempted ? (writeResult.ok ? "freee書込み成功" : `freee書込み失敗: ${writeResult.error}`) : null,
        ]
          .filter(Boolean)
          .join(" / ") || null,
      })
      .eq("id", findingId)
      .select("*")
      .single();
    if (updateError) return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });

    return NextResponse.json({ ok: true, finding: updated, write: writeResult });
  }

  return NextResponse.json({ ok: false, error: "unknown action" }, { status: 400 });
}
