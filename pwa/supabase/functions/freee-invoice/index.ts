/**
 * freee-invoice Edge Function
 *
 * freee請求書の作成・送付・取消を管理する。
 * GAS版 007_FreeeInvoiceFlow.js からの移植。
 *
 * Actions:
 *   create  — 請求書下書き作成 + PDF保存 + DB更新
 *   send    — 請求書送付（freee側で発行処理）
 *   cancel  — 請求書取消
 *   get     — 請求書詳細取得
 */

import {
  createServiceClient,
  getRequestUser,
  corsHeaders,
  jsonResponse,
  errorResponse,
} from "../_shared/supabase.ts";
import {
  requestIv,
  getCompanyId,
  calcAmountExclTax,
} from "../_shared/freee.ts";

interface InvoiceLine {
  description: string;
  quantity?: number;
  unit_price: number;
}

interface CreatePayload {
  action: "create";
  project_id: string;
  ym: string;
  issue_date: string; // YYYY-MM-DD
  due_date: string; // YYYY-MM-DD
  base_lines: InvoiceLine[];
  subject?: string;
  remark?: string;
  template_id?: string;
  extra_lines?: InvoiceLine[];
}

interface SimplePayload {
  action: "send" | "cancel" | "get";
  project_id: string;
  ym: string;
}

type Payload = CreatePayload | SimplePayload;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const user = await getRequestUser(req);
    if (!user) return errorResponse("Unauthorized", 401);

    const payload: Payload = await req.json();
    const { action, project_id, ym } = payload;

    if (!action || !project_id || !ym) {
      return errorResponse("action, project_id, ym are required");
    }

    const db = createServiceClient();
    const companyId = getCompanyId();

    // billing_cycle + project 取得
    const { data: cycle } = await db
      .from("billing_cycles")
      .select("*, projects!inner(project_code, name, client_name, freee_partner_id, freee_invoice_template_id)")
      .eq("project_id", project_id)
      .eq("ym", ym)
      .single();

    if (!cycle) return errorResponse(`Billing cycle not found: ${project_id} ${ym}`, 404);

    const project = (cycle as Record<string, unknown>).projects as Record<string, string>;
    const now = new Date().toISOString();

    // ─── GET: 請求書情報取得 ───
    if (action === "get") {
      const { data: invoice } = await db
        .from("invoices")
        .select("*")
        .eq("billing_cycle_id", cycle.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      return jsonResponse({ ok: true, invoice: invoice || null });
    }

    // ─── CREATE: 請求書下書き作成 ───
    if (action === "create") {
      const p = payload as CreatePayload;

      if (!p.issue_date || !p.due_date) {
        return errorResponse("issue_date and due_date are required");
      }

      const baseLines = (p.base_lines || []).filter((l) => l.description);
      if (!baseLines.length) {
        return errorResponse("At least one base_line is required");
      }

      const gross = baseLines.reduce(
        (s, l) => s + (l.unit_price || 0) * (l.quantity || 1),
        0
      );
      if (gross <= 0) {
        return errorResponse("合計金額が0円。明細の単価を確認してね");
      }

      const partnerId = project.freee_partner_id;
      const templateId = p.template_id || project.freee_invoice_template_id;

      if (!partnerId) {
        return errorResponse("freee_partner_id が未設定。PJ設定を確認してね");
      }
      if (!templateId) {
        return errorResponse("freee_invoice_template_id が未設定");
      }

      const subject =
        p.subject || `${project.client_name || project.name} 業務委託費`;

      // freee API body
      // deno-lint-ignore no-explicit-any
      const freeeBody: Record<string, any> = {
        company_id: Number(companyId),
        template_id: Number(templateId),
        partner_id: Number(partnerId),
        partner_title: "御中",
        subject,
        billing_date: p.issue_date,
        payment_date: p.due_date,
        tax_entry_method: "out",
        tax_fraction: "omit",
        withholding_tax_entry_method: "out",
        lines: baseLines.map((l) => ({
          type: "item",
          description: l.description,
          quantity: l.quantity || 1,
          unit_price: String(l.unit_price),
          tax_rate: 10,
          reduced_tax_rate: false,
          withholding: false,
        })),
        invoice_note: p.remark || "",
      };

      // 追加行（値引き・調整等）
      if (p.extra_lines?.length) {
        for (const l of p.extra_lines) {
          if (!l.description) continue;
          freeeBody.lines.push({
            type: "item",
            description: l.description,
            quantity: l.quantity || 1,
            unit_price: String(l.unit_price),
            tax_rate: 10,
            reduced_tax_rate: false,
            withholding: false,
          });
        }
      }

      // 1) freee 請求書作成
      // deno-lint-ignore no-explicit-any
      const created = (await requestIv("POST", "/invoices", undefined, freeeBody)) as any;

      const freeeInvoiceId = String(
        created.id || created.invoice_id || created.invoice?.id || ""
      );
      if (!freeeInvoiceId) {
        return errorResponse("freee invoice created but id missing");
      }

      // 2) 番号とPDF URL取得（リトライ）
      let freeeInvoiceNo = "";
      let pdfUrl = "";
      for (let i = 0; i < 3; i++) {
        try {
          // deno-lint-ignore no-explicit-any
          const detail = (await requestIv(
            "GET",
            `/invoices/${freeeInvoiceId}`,
            { company_id: companyId }
          )) as any;
          freeeInvoiceNo = detail.invoice_number || detail.number || "";
          pdfUrl =
            detail.invoice_file_url ||
            detail.pdf_url ||
            detail.file_url ||
            "";
          if (freeeInvoiceNo) break;
        } catch {
          await new Promise((r) => setTimeout(r, 1000));
        }
      }

      // 3) invoices テーブルに保存
      const { data: invoice } = await db
        .from("invoices")
        .upsert(
          {
            billing_cycle_id: cycle.id,
            invoice_ym: ym,
            freee_invoice_id: freeeInvoiceId,
            freee_invoice_no: freeeInvoiceNo,
            pdf_url: pdfUrl,
            issued_at: now,
            issued_by: user.id,
            status: "issued",
          },
          { onConflict: "billing_cycle_id" }
        )
        .select()
        .single();

      // 4) billing_cycles ステータス更新
      await db
        .from("billing_cycles")
        .update({ status: "invoiced" })
        .eq("id", cycle.id);

      // 5) audit log
      await db.from("billing_logs").insert({
        project_id,
        ym,
        action_type: "invoice_created",
        target: "invoices",
        after_val: {
          freee_invoice_id: freeeInvoiceId,
          freee_invoice_no: freeeInvoiceNo,
          gross,
        },
        operator_id: user.id,
      });

      return jsonResponse({
        ok: true,
        action: "create",
        invoice,
        freee_invoice_id: freeeInvoiceId,
        freee_invoice_no: freeeInvoiceNo,
        pdf_url: pdfUrl,
      });
    }

    // ─── SEND: 請求書送付 ───
    if (action === "send") {
      const { data: invoice } = await db
        .from("invoices")
        .select("*")
        .eq("billing_cycle_id", cycle.id)
        .single();

      if (!invoice?.freee_invoice_id) {
        return errorResponse("請求書が未作成。先に create してね");
      }

      // freee 側で発行（ステータス変更）
      // Note: freee IV APIの発行エンドポイントを呼ぶ
      try {
        await requestIv(
          "PUT",
          `/invoices/${invoice.freee_invoice_id}/publish`,
          undefined,
          { company_id: Number(companyId) }
        );
      } catch (e) {
        // 既に発行済みの場合はスキップ
        const msg = e instanceof Error ? e.message : String(e);
        if (!msg.includes("already")) {
          return errorResponse(`freee publish failed: ${msg}`, 500);
        }
      }

      // DB更新
      await db
        .from("invoices")
        .update({ sent_at: now, sent_by: user.id, status: "sent" })
        .eq("id", invoice.id);

      await db.from("billing_logs").insert({
        project_id,
        ym,
        action_type: "invoice_sent",
        target: "invoices",
        after_val: { sent_at: now },
        operator_id: user.id,
      });

      return jsonResponse({ ok: true, action: "send", sent_at: now });
    }

    // ─── CANCEL: 請求書取消 ───
    if (action === "cancel") {
      const { data: invoice } = await db
        .from("invoices")
        .select("*")
        .eq("billing_cycle_id", cycle.id)
        .single();

      if (!invoice) return errorResponse("請求書が見つからない", 404);

      // freee 側でキャンセル
      if (invoice.freee_invoice_id) {
        try {
          await requestIv(
            "DELETE",
            `/invoices/${invoice.freee_invoice_id}`,
            { company_id: companyId }
          );
        } catch {
          // 既に削除済みの場合はスキップ
        }
      }

      // DB更新
      await db
        .from("invoices")
        .update({ status: "cancelled" })
        .eq("id", invoice.id);

      await db
        .from("billing_cycles")
        .update({ status: "budgeted" })
        .eq("id", cycle.id);

      await db.from("billing_logs").insert({
        project_id,
        ym,
        action_type: "invoice_cancelled",
        target: "invoices",
        before_val: { status: invoice.status },
        after_val: { status: "cancelled" },
        operator_id: user.id,
      });

      return jsonResponse({ ok: true, action: "cancel" });
    }

    return errorResponse(`Unknown action: ${action}`);
  } catch (e) {
    return errorResponse(String(e instanceof Error ? e.message : e), 500);
  }
});
