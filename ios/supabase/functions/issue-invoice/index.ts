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
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
};

type AuthOk = {
  ok: true;
  userId: string;
  email: string;
};

type AuthFailure = {
  ok: false;
  response: Response;
};

async function requireAdmin(req: Request, supabaseUrl: string, serviceKey: string): Promise<AuthOk | AuthFailure> {
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!anonKey) {
    return { ok: false, response: json({ ok: false, message: "SUPABASE_ANON_KEY missing" }, 500) };
  }

  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return { ok: false, response: json({ ok: false, message: "Unauthorized" }, 401) };
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await authClient.auth.getUser();
  const user = userData?.user;
  const email = user?.email?.toLowerCase() ?? "";
  if (userError || !user || !email) {
    return { ok: false, response: json({ ok: false, message: "Unauthorized" }, 401) };
  }

  const db = createClient(supabaseUrl, serviceKey);
  const { data: member, error: memberError } = await db
    .from("members")
    .select("is_admin")
    .eq("email", email)
    .maybeSingle();

  if (memberError || !member?.is_admin) {
    return { ok: false, response: json({ ok: false, message: "Forbidden" }, 403) };
  }

  return { ok: true, userId: user.id, email };
}

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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const companyId = Deno.env.get("FREEE_COMPANY_ID")!;
    if (!companyId) return json({ ok: false, message: "FREEE_COMPANY_ID が未設定" }, 500);

    const auth = await requireAdmin(req, supabaseUrl, serviceKey);
    if (!auth.ok) return auth.response;

    const { projectId, ym, issueDate, dueDate, allLinesJson, invoiceSubject, invoiceRemark, documentType } =
      await req.json() as {
        projectId: string;
        ym: string;
        issueDate: string;
        dueDate: string;
        allLinesJson: string;
        invoiceSubject?: string;
        invoiceRemark?: string;
        documentType?: "invoice" | "quotation";
      };

    if (!projectId || !ym || !issueDate || !dueDate || !allLinesJson) {
      return json({ ok: false, message: "必須パラメータが不足しています" }, 400);
    }

    const kind = documentType === "quotation" ? "quotation" : "invoice";
    const db = createClient(supabaseUrl, serviceKey);

    // 1) プロジェクト情報取得
    const { data: projects } = await db
      .from("projects")
      .select("client_name, freee_partner_id, monthly_report_required")
      .eq("project_id", projectId)
      .limit(1);
    const project = projects?.[0];
    const partnerId = project?.freee_partner_id;
    if (!partnerId) {
      return json({ ok: false, message: "freeePartnerId が未設定" }, 400);
    }
    const templateId: string | null = null; // freee_invoice_template_id は未移行のため省略
    const clientName = project?.client_name ?? "";

    const { data: cycle, error: cycleError } = await db
      .from("billing_cycles")
      .select("report_fixed_at, invoice_issued_at")
      .eq("project_id", projectId)
      .eq("ym", ym)
      .maybeSingle();
    if (cycleError) return json({ ok: false, message: cycleError.message }, 500);
    if (kind === "invoice" && !cycle) {
      return json({ ok: false, message: "請求対象月のbilling cycleがない。再読み込みしてね" }, 409);
    }
    if (kind === "invoice" && cycle?.invoice_issued_at) {
      return json({ ok: false, message: "この月はすでに発行済み。再読み込みしてね" }, 409);
    }

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

    // 3) 発行条件と立替集合をサーバー正本で再検査する。
    // billed_ym があれば優先し、なければ発生日の月へ帰属する。画面・preview・実発行で同じ条件を使う。
    let reimbursementSnapshot = await loadInvoiceReimbursements(db, projectId, ym);
    if (kind === "invoice") {
      const blocked = invoiceBlockerMessage(project, cycle, reimbursementSnapshot.pendingCount);
      if (blocked) return json({ ok: false, message: blocked }, 409);
    }

    // 4) freee アクセストークン取得
    const accessToken = await getFreeeAccessToken(db);

    // freee送信直前にも再読込する。画面表示後やtoken取得中に入った未承認を見逃さない。
    reimbursementSnapshot = await loadInvoiceReimbursements(db, projectId, ym);
    if (kind === "invoice") {
      const blocked = invoiceBlockerMessage(project, cycle, reimbursementSnapshot.pendingCount);
      if (blocked) return json({ ok: false, message: blocked }, 409);
    }
    const reimbItems = reimbursementSnapshot.billable;
    const reimbYen = reimbItems.reduce((s, r) => s + (r.amount ?? 0), 0);

    // 5) freee 帳票リクエストボディ構築
    const subject = invoiceSubject?.trim() || (clientName ? `${clientName} 業務委託費` : "業務委託費");

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
    const remark = invoiceRemark?.trim();
    if (remark) documentBody.invoice_note = remark;
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
    const callerEmail = auth.email;

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

type InvoiceReimbursement = {
  description: string | null;
  amount: number | null;
  date: string | null;
  category: string | null;
  transport_mode: string | null;
  transport_from: string | null;
  transport_to: string | null;
  transport_trip: string | null;
  tax_rate: number | null;
  status: string;
  billed_ym: string | null;
};

function belongsToInvoiceYm(row: Pick<InvoiceReimbursement, "billed_ym" | "date">, ym: string) {
  if (row.billed_ym && /^\d{6}$/.test(row.billed_ym)) return row.billed_ym === ym;
  return Boolean(row.date && row.date >= `${ym.slice(0, 4)}-${ym.slice(4, 6)}-01` && row.date < getNextMonthStart(ym));
}

async function loadInvoiceReimbursements(
  db: ReturnType<typeof createClient>,
  projectId: string,
  ym: string,
) {
  const { data, error } = await db
    .from("reimbursements")
    .select("description, amount, date, category, transport_mode, transport_from, transport_to, transport_trip, tax_rate, status, billed_ym")
    .eq("project_id", projectId);
  if (error) throw error;
  const monthRows = ((data ?? []) as InvoiceReimbursement[]).filter((row) => belongsToInvoiceYm(row, ym));
  return {
    pendingCount: monthRows.filter((row) => row.status === "submitted" || row.status === "pmApproved" || row.status === "pmapproved").length,
    billable: monthRows.filter((row) => row.status === "approved" || row.status === "paid"),
  };
}

function invoiceBlockerMessage(
  project: { monthly_report_required?: boolean | null } | null | undefined,
  cycle: { report_fixed_at?: string | null } | null,
  pendingCount: number,
) {
  if (pendingCount > 0) return `未承認の立替が${pendingCount}件あるため発行できない`;
  if (project?.monthly_report_required && !cycle?.report_fixed_at) return "契約上必要な月報が未確定のため発行できない";
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
