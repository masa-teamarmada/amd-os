import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMember } from "@/lib/supabase/api-auth";

export const runtime = "nodejs";

// 会社概要は、まさ確定仕様によりログイン済み AMD メンバー全員が全 PJ を閲覧・編集できる。
// service role はサーバーでの一括取得にのみ使い、API 冒頭の requireMember を必須にする。

const ENTITY_CONFIG: Record<string, { table: string; fields: string[]; audited?: boolean }> = {
  shareholder: {
    table: "project_shareholders",
    fields: ["project_id", "holder_type", "holder_name", "holder_member_id", "share_class", "shares", "ownership_pct", "invested_yen", "as_of_ym", "is_current", "source_ref", "notes"],
  },
  round: {
    table: "project_valuation_rounds",
    fields: ["project_id", "round_name", "round_date", "round_ym", "pre_money_yen", "post_money_yen", "raised_yen", "price_per_share_yen", "lead_investor", "source_ref", "notes"],
  },
  meeting: {
    table: "project_shareholder_meetings",
    fields: ["project_id", "meeting_type", "meeting_date", "meeting_ym", "location", "agenda_summary", "resolutions_json", "amd_response", "amd_response_at", "related_action_id", "attachments_json", "source_ref", "notes"],
  },
  convertible: {
    table: "project_convertible_instruments",
    fields: ["project_id", "round_id", "holder_name", "instrument_type", "issued_on", "principal_yen", "valuation_cap_yen", "discount_rate", "conversion_trigger", "maturity_on", "estimated_conversion_price", "estimated_conversion_shares", "status", "source_ref", "notes"],
    audited: true,
  },
  financial_period: {
    table: "project_financial_periods",
    fields: ["project_id", "fiscal_year", "period_start_on", "period_end_on", "statement_status", "revenue_yen", "operating_income_yen", "ordinary_income_yen", "net_income_yen", "total_assets_yen", "total_liabilities_yen", "net_assets_yen", "cash_yen", "debt_yen", "filed_on", "source_ref", "notes"],
    audited: true,
  },
};

const PROFILE_FIELDS = [
  "project_id", "legal_status", "legal_name", "legal_name_en", "corporate_number", "entity_type",
  "incorporated_on", "head_office", "business_purpose", "representative_name", "capital_yen",
  "authorized_shares", "registered_issued_shares", "board_structure", "has_board", "has_auditor",
  "fiscal_year_end_month", "public_notice_method", "invoice_registration_number", "source_ref",
  "source_verified_on", "notes",
];
const TRANSACTION_FIELDS = ["project_id", "round_id", "effective_on", "transaction_type", "description", "status", "source_ref", "notes"];
const ENTRY_FIELDS = ["holder_type", "holder_name", "security_class", "outstanding_delta", "diluted_delta", "paid_in_yen_delta"];
const OPEN_ACTION_STATUSES = ["open", "in_progress"];

function pickFields(row: Record<string, unknown>, fields: string[]) {
  return Object.fromEntries(fields.filter((field) => Object.hasOwn(row, field)).map((field) => [field, row[field]]));
}

function badRequest(error: string) {
  return NextResponse.json({ ok: false, error }, { status: 400 });
}

function emailOf(auth: { user: { email: string } }) {
  return auth.user.email.toLowerCase();
}

/** GET /api/governance?projectId=p09 → 会社概要タブの全データ */
export async function GET(req: NextRequest) {
  const auth = await requireMember();
  if (!auth.ok) return auth.errorResponse;

  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) return badRequest("projectId required");

  const db = createAdminClient();
  const [profileRes, shareholdersRes, transactionsRes, convertiblesRes, financialsRes, roundsRes, meetingsRes, actionsRes] = await Promise.all([
    db.from("project_company_profiles").select("*").eq("project_id", projectId).maybeSingle(),
    db.from("project_shareholders").select("*").eq("project_id", projectId).order("holder_type", { ascending: true }),
    db.from("project_equity_transactions").select("*, project_equity_entries(*)").eq("project_id", projectId).order("effective_on", { ascending: true }).order("created_at", { ascending: true }),
    db.from("project_convertible_instruments").select("*").eq("project_id", projectId).order("issued_on", { ascending: false, nullsFirst: false }),
    db.from("project_financial_periods").select("*").eq("project_id", projectId).order("fiscal_year", { ascending: false }),
    db.from("project_valuation_rounds").select("*").eq("project_id", projectId).order("round_date", { ascending: false, nullsFirst: false }),
    db.from("project_shareholder_meetings").select("*").eq("project_id", projectId).order("meeting_date", { ascending: false, nullsFirst: false }),
    db.from("action_items").select("*").eq("project_id", projectId).eq("review_status", "confirmed").in("status", OPEN_ACTION_STATUSES).neq("source", "meeting_summary").order("due_at", { ascending: true, nullsFirst: false }),
  ]);

  const error = [profileRes, shareholdersRes, transactionsRes, convertiblesRes, financialsRes, roundsRes, meetingsRes, actionsRes]
    .map((result) => result.error)
    .find(Boolean);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    profile: profileRes.data ?? null,
    shareholders: shareholdersRes.data ?? [],
    transactions: transactionsRes.data ?? [],
    convertibles: convertiblesRes.data ?? [],
    financialPeriods: financialsRes.data ?? [],
    rounds: roundsRes.data ?? [],
    meetings: meetingsRes.data ?? [],
    actionItems: actionsRes.data ?? [],
  });
}

/** POST /api/governance body: { entity, row } → 全メンバー共通の新規作成 */
export async function POST(req: NextRequest) {
  const auth = await requireMember();
  if (!auth.ok) return auth.errorResponse;
  const body = await req.json().catch(() => null) as { entity?: string; row?: Record<string, unknown> } | null;
  if (!body?.entity || !body.row?.project_id) return badRequest("entity / row.project_id required");

  const db = createAdminClient();
  const email = emailOf(auth);

  if (body.entity === "company_profile") {
    const row = { ...pickFields(body.row, PROFILE_FIELDS), created_by_email: email, updated_by_email: email, updated_at: new Date().toISOString() };
    const { data, error } = await db.from("project_company_profiles").upsert(row, { onConflict: "project_id" }).select().single();
    if (error) return badRequest(error.message);
    return NextResponse.json({ ok: true, row: data });
  }

  if (body.entity === "equity_transaction") {
    const entries = Array.isArray(body.row.entries) ? body.row.entries as Record<string, unknown>[] : [];
    if (!body.row.effective_on || !body.row.transaction_type || entries.length === 0) {
      return badRequest("effective_on / transaction_type / entries required");
    }
    if (entries.some((entry) => !String(entry.holder_name || "").trim())) return badRequest("entry.holder_name required");

    const txRow = { ...pickFields(body.row, TRANSACTION_FIELDS), created_by_email: email, updated_by_email: email };
    const { data: transaction, error: transactionError } = await db.from("project_equity_transactions").insert(txRow).select().single();
    if (transactionError || !transaction) return badRequest(transactionError?.message || "transaction insert failed");

    const entryRows = entries.map((entry) => ({
      ...pickFields(entry, ENTRY_FIELDS),
      transaction_id: transaction.id,
      project_id: body.row!.project_id,
    }));
    const { error: entriesError } = await db.from("project_equity_entries").insert(entryRows);
    if (entriesError) {
      await db.from("project_equity_transactions").delete().eq("id", transaction.id);
      return badRequest(entriesError.message);
    }
    const { data, error } = await db.from("project_equity_transactions").select("*, project_equity_entries(*)").eq("id", transaction.id).single();
    if (error) return badRequest(error.message);
    return NextResponse.json({ ok: true, row: data });
  }

  const config = ENTITY_CONFIG[body.entity];
  if (!config) return badRequest("unknown entity");
  const row = {
    ...pickFields(body.row, config.fields),
    ...(config.audited ? { created_by_email: email, updated_by_email: email } : {}),
  };
  const query = db.from(config.table);
  const result = body.entity === "financial_period"
    ? await query.upsert(row, { onConflict: "project_id,fiscal_year" }).select().single()
    : await query.insert(row).select().single();
  if (result.error) return badRequest(result.error.message);
  return NextResponse.json({ ok: true, row: result.data });
}

/** PATCH /api/governance body: { entity, id, patch } */
export async function PATCH(req: NextRequest) {
  const auth = await requireMember();
  if (!auth.ok) return auth.errorResponse;
  const body = await req.json().catch(() => null) as { entity?: string; id?: string; patch?: Record<string, unknown> } | null;
  if (!body?.entity || !body.id || !body.patch) return badRequest("entity / id / patch required");

  const config = ENTITY_CONFIG[body.entity];
  if (!config) return badRequest("unknown entity");
  const patch = {
    ...pickFields(body.patch, config.fields),
    updated_at: new Date().toISOString(),
    ...(config.audited ? { updated_by_email: emailOf(auth) } : {}),
  };
  const db = createAdminClient();
  const { data, error } = await db.from(config.table).update(patch).eq("id", body.id).select().single();
  if (error) return badRequest(error.message);
  return NextResponse.json({ ok: true, row: data });
}

/** DELETE /api/governance?entity=equity_transaction&id=... */
export async function DELETE(req: NextRequest) {
  const auth = await requireMember();
  if (!auth.ok) return auth.errorResponse;

  const entity = req.nextUrl.searchParams.get("entity") || "";
  const id = req.nextUrl.searchParams.get("id");
  const table = entity === "equity_transaction" ? "project_equity_transactions" : ENTITY_CONFIG[entity]?.table;
  if (!table || !id) return badRequest("entity / id required");

  const db = createAdminClient();
  const { error } = await db.from(table).delete().eq("id", id);
  if (error) return badRequest(error.message);
  return NextResponse.json({ ok: true });
}
