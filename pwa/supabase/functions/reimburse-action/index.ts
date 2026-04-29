/**
 * reimburse-action Edge Function
 *
 * 立替精算の CRUD + 承認フロー
 * GAS版 082_Reimburse.js からの移植
 *
 * Actions:
 *   create          — 立替申請作成
 *   update          — 立替申請編集（submitted のみ）
 *   delete          — 立替申請削除（submitted のみ）
 *   pm_approve      — PM承認トグル（submitted ↔ pm_approved）
 *   admin_approve   — Admin承認トグル（pm_approved ↔ approved）
 *   list            — PJ別立替一覧
 *   list_for_billing — 請求書組込用（approved + 未請求）
 */

import {
  createServiceClient,
  getRequestUser,
  corsHeaders,
  jsonResponse,
  errorResponse,
} from "../_shared/supabase.ts";

const CATEGORIES = ["transport", "lodging", "supplies", "meal", "other"] as const;
const CATEGORY_LABELS: Record<string, string> = {
  transport: "交通費",
  lodging: "宿泊",
  supplies: "消耗品",
  meal: "会議費",
  other: "その他",
};

const VALID_TAX_RATES = [0, 0.08, 0.10];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const user = await getRequestUser(req);
    if (!user) return errorResponse("Unauthorized", 401);

    const payload = await req.json();
    const { action } = payload;
    const db = createServiceClient();

    // ─── LIST: PJ別立替一覧 ───
    if (action === "list") {
      const { project_id, status_filter } = payload;
      if (!project_id) return errorResponse("project_id required");

      let query = db
        .from("reimbursements")
        .select("*, members!created_by(code_name)")
        .eq("project_id", project_id)
        .order("date", { ascending: false });

      if (status_filter) {
        query = query.eq("status", status_filter);
      }

      const { data, error } = await query;
      if (error) return errorResponse(error.message, 500);

      return jsonResponse({ ok: true, items: data ?? [] });
    }

    // ─── LIST_FOR_BILLING: 請求書組込用 ───
    if (action === "list_for_billing") {
      const { project_id, ym } = payload;
      if (!project_id || !ym) return errorResponse("project_id and ym required");

      // ym からその月の範囲を算出
      const [y, m] = ym.split("-").map(Number);
      const startDate = `${y}-${String(m).padStart(2, "0")}-01`;
      const endDate = new Date(y, m, 0).toISOString().slice(0, 10); // 月末

      const { data, error } = await db
        .from("reimbursements")
        .select("*")
        .eq("project_id", project_id)
        .eq("status", "approved")
        .is("billed_ym", null)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date");

      if (error) return errorResponse(error.message, 500);

      const items = (data ?? []).map((r) => ({
        ...r,
        category_label: CATEGORY_LABELS[r.category] || r.category,
      }));

      const totalYen = items.reduce((s, r) => s + (r.amount || 0), 0);

      return jsonResponse({ ok: true, items, total_yen: totalYen });
    }

    // ─── CREATE: 立替申請作成 ───
    if (action === "create") {
      const { project_id, date, category, amount, tax_rate, description,
        transport_mode, transport_from, transport_to, transport_trip } = payload;

      if (!project_id || !date || !category || !amount || !description) {
        return errorResponse("project_id, date, category, amount, description required");
      }

      if (!CATEGORIES.includes(category)) {
        return errorResponse(`Invalid category: ${category}`);
      }

      if (category === "transport" && (!transport_mode || !transport_from || !transport_to)) {
        return errorResponse("交通費には mode/from/to が必要");
      }

      const rate = VALID_TAX_RATES.includes(Number(tax_rate)) ? Number(tax_rate) : 0.10;

      const { data, error } = await db
        .from("reimbursements")
        .insert({
          project_id,
          date,
          category,
          amount: Number(amount),
          tax_rate: rate,
          description,
          transport_mode: category === "transport" ? transport_mode : null,
          transport_from: category === "transport" ? transport_from : null,
          transport_to: category === "transport" ? transport_to : null,
          transport_trip: category === "transport" ? (transport_trip || "one_way") : null,
          created_by: user.id,
          status: "submitted",
        })
        .select()
        .single();

      if (error) return errorResponse(error.message, 500);
      return jsonResponse({ ok: true, reimbursement: data });
    }

    // ─── UPDATE: 立替申請編集 ───
    if (action === "update") {
      const { id, ...fields } = payload;
      if (!id) return errorResponse("id required");

      const { data: existing } = await db
        .from("reimbursements")
        .select("status, created_by")
        .eq("id", id)
        .single();

      if (!existing) return errorResponse("Not found", 404);
      if (existing.status !== "submitted") {
        return errorResponse("承認済みの立替は編集できません");
      }
      if (existing.created_by !== user.id) {
        return errorResponse("自分が作成した立替のみ編集可能", 403);
      }

      const updateData: Record<string, unknown> = {};
      for (const key of ["date", "category", "amount", "tax_rate", "description",
        "transport_mode", "transport_from", "transport_to", "transport_trip"]) {
        if (fields[key] !== undefined) updateData[key] = fields[key];
      }

      const { data, error } = await db
        .from("reimbursements")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) return errorResponse(error.message, 500);
      return jsonResponse({ ok: true, reimbursement: data });
    }

    // ─── DELETE: 立替申請削除 ───
    if (action === "delete") {
      const { id } = payload;
      if (!id) return errorResponse("id required");

      const { data: existing } = await db
        .from("reimbursements")
        .select("status, created_by")
        .eq("id", id)
        .single();

      if (!existing) return errorResponse("Not found", 404);
      if (existing.status !== "submitted") {
        return errorResponse("承認済みの立替は削除できません");
      }

      const { error } = await db.from("reimbursements").delete().eq("id", id);
      if (error) return errorResponse(error.message, 500);
      return jsonResponse({ ok: true });
    }

    // ─── PM_APPROVE: PM承認トグル ───
    if (action === "pm_approve") {
      const { id } = payload;
      if (!id) return errorResponse("id required");

      const { data: r } = await db
        .from("reimbursements")
        .select("*")
        .eq("id", id)
        .single();

      if (!r) return errorResponse("Not found", 404);

      const now = new Date().toISOString();

      if (r.status === "submitted") {
        // 承認
        await db
          .from("reimbursements")
          .update({
            status: "pm_approved",
            pm_approved_by: user.id,
            pm_approved_at: now,
          })
          .eq("id", id);
        return jsonResponse({ ok: true, new_status: "pm_approved" });
      } else if (r.status === "pm_approved") {
        // 取消
        await db
          .from("reimbursements")
          .update({
            status: "submitted",
            pm_approved_by: null,
            pm_approved_at: null,
          })
          .eq("id", id);
        return jsonResponse({ ok: true, new_status: "submitted" });
      }

      return errorResponse(`PM承認は submitted/pm_approved のみ可能（現在: ${r.status}）`);
    }

    // ─── ADMIN_APPROVE: Admin承認トグル ───
    if (action === "admin_approve") {
      const { id } = payload;
      if (!id) return errorResponse("id required");

      const { data: r } = await db
        .from("reimbursements")
        .select("*")
        .eq("id", id)
        .single();

      if (!r) return errorResponse("Not found", 404);

      const now = new Date().toISOString();

      if (r.status === "pm_approved") {
        await db
          .from("reimbursements")
          .update({
            status: "approved",
            admin_approved_by: user.id,
            admin_approved_at: now,
          })
          .eq("id", id);
        return jsonResponse({ ok: true, new_status: "approved" });
      } else if (r.status === "approved") {
        await db
          .from("reimbursements")
          .update({
            status: "pm_approved",
            admin_approved_by: null,
            admin_approved_at: null,
          })
          .eq("id", id);
        return jsonResponse({ ok: true, new_status: "pm_approved" });
      }

      return errorResponse(`Admin承認は pm_approved/approved のみ可能（現在: ${r.status}）`);
    }

    // ─── MARK_BILLED: 請求書組込マーク ───
    if (action === "mark_billed") {
      const { ids, ym, billing_cycle_id } = payload;
      if (!ids?.length || !ym) return errorResponse("ids and ym required");

      const now = new Date().toISOString();

      const { error } = await db
        .from("reimbursements")
        .update({
          billed_ym: ym,
          billed_at: now,
          billed_by: user.id,
          billing_cycle_id: billing_cycle_id || null,
        })
        .in("id", ids)
        .eq("status", "approved")
        .is("billed_ym", null);

      if (error) return errorResponse(error.message, 500);
      return jsonResponse({ ok: true, count: ids.length });
    }

    return errorResponse(`Unknown action: ${action}`);
  } catch (e) {
    return errorResponse(String(e instanceof Error ? e.message : e), 500);
  }
});
