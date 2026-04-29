/**
 * billing-action Edge Function
 *
 * Billing状態遷移を管理する。全操作はここを経由してaudit logを残す。
 *
 * Actions:
 *   confirm_budget   — 予算確定 (open → budgeted)
 *   confirm_payment  — 入金確認 (invoiced → paid) ※kyoko限定
 *   close_cycle      — クローズ (paid → closed)
 *   report_budget    — 予算報告額セット
 */

import {
  createServiceClient,
  getRequestUser,
  corsHeaders,
  jsonResponse,
  errorResponse,
} from "../_shared/supabase.ts";

interface ActionPayload {
  action: string;
  project_id: string;
  ym: string;
  note?: string;
  budget_reported_amount?: number;
}

const VALID_TRANSITIONS: Record<string, { from: string[]; to: string }> = {
  confirm_budget: { from: ["open"], to: "budgeted" },
  confirm_payment: { from: ["invoiced"], to: "paid" },
  close_cycle: { from: ["paid"], to: "closed" },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const user = await getRequestUser(req);
    if (!user) return errorResponse("Unauthorized", 401);

    const payload: ActionPayload = await req.json();
    const { action, project_id, ym } = payload;

    if (!action || !project_id || !ym) {
      return errorResponse("action, project_id, ym are required");
    }

    const db = createServiceClient();

    // billing_cycle 取得
    const { data: cycle, error: cycleErr } = await db
      .from("billing_cycles")
      .select("*")
      .eq("project_id", project_id)
      .eq("ym", ym)
      .single();

    if (cycleErr || !cycle) {
      return errorResponse(`Billing cycle not found: ${project_id} ${ym}`, 404);
    }

    const now = new Date().toISOString();

    // ─── report_budget（ステータス遷移なし）───
    if (action === "report_budget") {
      const amount = Number(payload.budget_reported_amount ?? 0);
      await db
        .from("billing_cycles")
        .update({
          budget_reported_amount: amount,
          budget_reported_at: now,
          budget_reported_by: user.id,
        })
        .eq("id", cycle.id);

      await appendLog(db, {
        project_id,
        ym,
        action_type: "report_budget",
        target: "billing_cycles",
        before_val: { budget_reported_amount: cycle.budget_reported_amount },
        after_val: { budget_reported_amount: amount },
        operator_id: user.id,
      });

      return jsonResponse({ ok: true, action: "report_budget" });
    }

    // ─── ステータス遷移 ───
    const transition = VALID_TRANSITIONS[action];
    if (!transition) {
      return errorResponse(`Unknown action: ${action}`);
    }

    if (!transition.from.includes(cycle.status)) {
      return errorResponse(
        `Cannot ${action}: current status is '${cycle.status}', expected one of [${transition.from.join(", ")}]`
      );
    }

    // confirm_payment は kyoko 限定
    if (action === "confirm_payment") {
      if (user.email !== "kyoko@team-armada.jp") {
        return errorResponse("入金確認は kyoko@team-armada.jp のみ実行可能", 403);
      }

      // payment_confirmations に記録
      await db.from("payment_confirmations").upsert({
        billing_cycle_id: cycle.id,
        confirmed_at: now,
        confirmed_by: user.id,
        note: payload.note || null,
      });
    }

    // ステータス更新
    const updateData: Record<string, unknown> = { status: transition.to };

    if (action === "confirm_budget") {
      updateData.budget_confirmed_at = now;
      updateData.budget_confirmed_by = user.id;
    }

    await db.from("billing_cycles").update(updateData).eq("id", cycle.id);

    // Audit log
    await appendLog(db, {
      project_id,
      ym,
      action_type: action,
      target: "billing_cycles",
      before_val: { status: cycle.status },
      after_val: { status: transition.to },
      reason: payload.note || null,
      operator_id: user.id,
    });

    return jsonResponse({ ok: true, action, new_status: transition.to });
  } catch (e) {
    return errorResponse(String(e instanceof Error ? e.message : e), 500);
  }
});

// deno-lint-ignore no-explicit-any
async function appendLog(db: any, log: Record<string, unknown>) {
  await db.from("billing_logs").insert({
    ...log,
    created_at: new Date().toISOString(),
  });
}
