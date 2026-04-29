/**
 * issue-invoice
 * freee API 経由で請求書 / 見積書を発行する Edge Function。
 *
 * Required secrets: FREEE_CLIENT_ID, FREEE_CLIENT_SECRET, FREEE_COMPANY_ID, FREEE_REFRESH_TOKEN
 * Optional secrets: SLACK_BOT_TOKEN
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

// MARK: - freee token

async function getFreeeAccessToken(db: ReturnType<typeof createClient>): Promise<string> {
  const clientId = Deno.env.get("FREEE_CLIENT_ID")!;
  const clientSecret = Deno.env.get("FREEE_CLIENT_SECRET")!;
  const secretRefreshToken = Deno.env.get("FREEE_REFRESH_TOKEN")!;

  // freee_oauth_tokensテーブルに保存された最新のrefresh tokenを優先
  let refreshToken = secretRefreshToken;
  try {
    const { data } = await db
      .from("freee_oauth_tokens")
      .select("refresh_token")
      .order("updated_at", { ascending: false })
      .limit(1);
    if (data?.[0]?.refresh_token) refreshToken = data[0].refresh_token;
  } catch (_) { /* テーブルが存在しない場合はsecretを使う */ }

  const res = await fetch("https://accounts.freee.co.jp/public_api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  });
  const tokenData = await res.json();
  if (!tokenData.access_token) {
    throw new Error(`freee token取得失敗: ${JSON.stringify(tokenData)}`);
  }

  // refresh tokenが返ってきたらテーブルに保存
  if (tokenData.refresh_token && tokenData.refresh_token !== refreshToken) {
    try {
      await db.from("freee_oauth_tokens").upsert({
        service: "freee",
        refresh_token: tokenData.refresh_token,
        updated_at: new Date().toISOString(),
      });
    } catch (_) { /* 保存失敗は無視 */ }
  }

  return tokenData.access_token as string;
}

// MARK: - freee IV API helper

async function freeeIvPost(path: string, body: unknown, accessToken: string) {
  const companyId = Deno.env.get("FREEE_COMPANY_ID")!;
  const res = await fetch(`https://api.freee.co.jp/iv/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "FREEE-COMPANY-ID": companyId,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`freee ${path} エラー (${res.status}): ${JSON.stringify(data)}`);
  }
  return data;
}

// MARK: - Main

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projectId, ym, issueDate, dueDate, allLinesJson, invoiceSubject, documentType } =
      await req.json() as {
        projectId: string;
        ym: string;
        issueDate: string;
        dueDate: string;
        allLinesJson: string;
        invoiceSubject?: string;
        documentType?: "invoice" | "quotation";
      };

    if (!projectId || !ym || !issueDate || !dueDate || !allLinesJson) {
      return json({ ok: false, message: "必須パラメータが不足しています" }, 400);
    }

    const kind = documentType === "quotation" ? "quotation" : "invoice";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const companyId = Deno.env.get("FREEE_COMPANY_ID")!;
    if (!companyId) return json({ ok: false, message: "FREEE_COMPANY_ID が未設定" }, 500);

    const db = createClient(supabaseUrl, serviceKey);

    // 1) プロジェクト情報取得
    const { data: projects } = await db
      .from("projects")
      .select("project_name, client_name, freee_partner_id")
      .eq("project_id", projectId)
      .limit(1);
    const project = projects?.[0];
    const partnerId = project?.freee_partner_id;
    if (!partnerId) {
      return json({ ok: false, message: `freeePartnerId が未設定（projectId=${projectId}）` }, 400);
    }
    const templateId: string | null = null; // freee_invoice_template_id は未移行のため省略
    const projectName = project?.project_name ?? projectId;
    const clientName = project?.client_name ?? "";

    // 2) allLines をパース
    let allLines: Array<{ type?: string; description: string; quantity?: number; unit_price?: number }>;
    try {
      allLines = JSON.parse(allLinesJson);
    } catch {
      return json({ ok: false, message: "allLinesJson のパース失敗" }, 400);
    }

    // item行のみで gross 計算
    const gross = allLines
      .filter((x) => (x.type ?? "item") === "item")
      .reduce((s, x) => s + (x.unit_price ?? 0) * (x.quantity ?? 1), 0);
    if (gross <= 0) {
      return json({ ok: false, message: "基本行の合計が0円。明細の単価を入力してね" }, 400);
    }

    // 3) 承認済み立替取得
    const { data: reimbs } = await db
      .from("reimbursements")
      .select("description, amount, date, category, transport_mode, transport_from, transport_to, transport_trip, tax_rate")
      .eq("project_id", projectId)
      .eq("status", "approved")
      .gte("date", `${ym.slice(0, 4)}-${ym.slice(4, 6)}-01`)
      .lt("date", getNextMonthStart(ym));

    const reimbItems = reimbs ?? [];
    const reimbYen = reimbItems.reduce((s, r) => s + (r.amount ?? 0), 0);

    // 4) freee アクセストークン取得
    const accessToken = await getFreeeAccessToken(db);

    // 5) freee 帳票リクエストボディ構築
    const subject = invoiceSubject?.trim() || `${clientName || projectName} 業務委託費`;

    const lines: unknown[] = allLines.map((x) => {
      if ((x.type ?? "item") === "text") {
        return { type: "text", description: x.description };
      }
      return {
        type: "item",
        description: x.description?.trim() || "業務委託費",
        quantity: x.quantity ?? 1,
        unit_price: String(x.unit_price ?? 0),
        tax_rate: 10,
        reduced_tax_rate: false,
        withholding: false,
      };
    });

    // 立替を明細行に追加
    for (const r of reimbItems) {
      const dateStr = (r.date ?? "").replace(/^\d{4}-/, "").replace(/-/g, "/");
      const desc = `【立替】${r.category ?? ""} ${r.description ?? ""}`.trim();
      lines.push({
        type: "item",
        description: desc,
        quantity: 1,
        unit_price: String(r.amount ?? 0),
        tax_rate: Math.round((r.tax_rate ?? 0.1) * 100) === 8 ? 8 : 10,
        reduced_tax_rate: false,
        withholding: false,
      });
    }

    const documentBody: Record<string, unknown> = {
      company_id: Number(companyId),
      partner_id: Number(partnerId),
      partner_title: "御中",
      subject,
      billing_date: issueDate,
      payment_date: dueDate,
      tax_entry_method: "out",
      tax_fraction: "omit",
      withholding_tax_entry_method: "out",
      lines,
    };
    if (templateId) documentBody.template_id = Number(templateId);

    // 6) freee 帳票発行
    const path = kind === "quotation" ? "quotations" : "invoices";
    const documentData = await freeeIvPost(path, documentBody, accessToken);
    const freeeDocument = kind === "quotation" ? documentData.quotation : documentData.invoice;
    const freeeDocumentId = String(freeeDocument?.id ?? "");
    const freeeDocumentNumber = kind === "quotation"
      ? String(freeeDocument?.quotation_number ?? "")
      : String(freeeDocument?.invoice_number ?? "");

    // 7) billing_cycles 更新
    const now = new Date().toISOString();
    const authHeader = req.headers.get("authorization") ?? "";
    const callerEmail = extractEmailFromJWT(authHeader) ?? "system";

    const normalizedLinesJson = kind === "quotation"
      ? ensureEstimateMarker(allLinesJson)
      : allLinesJson;

    const updateBody = kind === "quotation"
      ? {
        invoice_subject: subject,
        invoice_base_lines_json: normalizedLinesJson,
      }
      : {
        invoice_issued_at: now,
        invoice_issued_by: callerEmail,
        freee_invoice_number: freeeDocumentNumber,
        invoice_subject: subject,
        invoice_base_lines_json: normalizedLinesJson,
      };

    await db.from("billing_cycles").update(updateBody)
      .eq("project_id", projectId)
      .eq("ym", ym);

    return json({
      ok: true,
      freeeInvoiceId: freeeDocumentId,
      freeeInvoiceNumber: freeeDocumentNumber,
      gross: gross + reimbYen,
      reimbYen,
      message: freeeDocumentNumber
        ? `発行完了！（${freeeDocumentNumber}）`
        : kind === "quotation" ? "見積書を発行したよ！" : "請求書を発行したよ！",
    });
  } catch (e) {
    return json({ ok: false, message: String((e as Error).message ?? e) }, 500);
  }
});

// MARK: - Helpers

function getNextMonthStart(ym: string): string {
  const y = parseInt(ym.slice(0, 4));
  const m = parseInt(ym.slice(4, 6));
  const next = m >= 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  return `${next}-01`;
}

function extractEmailFromJWT(_authHeader: string): string | null {
  // JWTデコードは省略（service_role keyで呼ばれるためemailは不明）
  return null;
}

function ensureEstimateMarker(rawJson: string): string {
  const marker = "[[CTB_ESTIMATE_SENT]]";
  try {
    const parsed = JSON.parse(rawJson) as Array<Record<string, unknown>>;
    const filtered = parsed.filter((row) => row?.description !== marker);
    filtered.push({ type: "text", description: marker });
    return JSON.stringify(filtered);
  } catch {
    return rawJson;
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
