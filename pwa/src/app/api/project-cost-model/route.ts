import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth, requireAdmin } from "@/lib/supabase/api-auth";
import type { CostModelBundle } from "@/lib/project-cost-model";

export const runtime = "nodejs";

// PJコックピット / PJワークスペース「コスト試算」タブの API。
// read = ログイン済みメンバー、write = admin。
// migration: scripts/migrations/320_project_cost_model.sql
// 計算そのものは src/lib/project-cost-model.ts (純関数)。ここは入出力だけ。

const NUM = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);

/* eslint-disable @typescript-eslint/no-explicit-any */
export function mapBundle(model: any, assumptions: any[], items: any[], questions: any[], notes: any[] = []): CostModelBundle {
  return {
    model: {
      costModelId: model.cost_model_id,
      projectId: model.project_id,
      title: model.title,
      caseKind: model.case_kind,
      caseLabel: model.case_label,
      versionLabel: model.version_label ?? null,
      status: model.status,
      sourceUrl: model.source_url ?? null,
      sourceNote: model.source_note ?? null,
      summaryMd: model.summary_md ?? null,
      systemScopeMd: model.system_scope_md ?? null,
      targetTotalCostPerUnit:
        model.target_total_cost_per_m3 === null || model.target_total_cost_per_m3 === undefined
          ? null
          : NUM(model.target_total_cost_per_m3),
      targetMarginRate:
        model.target_margin_rate === null || model.target_margin_rate === undefined
          ? null
          : NUM(model.target_margin_rate),
      targetNote: model.target_note ?? null,
      unitBasisLabel: model.unit_basis_label || "m³",
      visibility: model.visibility,
      updatedAt: model.updated_at ?? null,
    },
    assumptions: (assumptions || []).map((a) => ({
      costAssumptionId: a.cost_assumption_id,
      groupLabel: a.group_label,
      label: a.label,
      value: a.value === null || a.value === undefined ? null : NUM(a.value),
      valueText: a.value_text ?? null,
      unit: a.unit ?? null,
      confidence: a.confidence ?? null,
      sourceKind: a.source_kind ?? null,
      owner: a.owner ?? null,
      isKey: !!a.is_key,
      roleKey: a.role_key ?? null,
      note: a.note ?? null,
      visibility: a.visibility,
      sortOrder: a.sort_order ?? 0,
    })),
    items: (items || []).map((i) => ({
      costItemId: i.cost_item_id,
      scenario: i.scenario,
      costType: i.cost_type,
      groupLabel: i.group_label ?? null,
      midLabel: i.mid_label ?? null,
      leafLabel: i.leaf_label ?? null,
      basis: i.basis,
      quantity: NUM(i.quantity),
      quantityUnit: i.quantity_unit ?? null,
      unitPrice: NUM(i.unit_price),
      unitPriceUnit: i.unit_price_unit ?? null,
      priceRule: i.price_rule ?? null,
      annualFactor: NUM(i.annual_factor),
      usefulLifeYears: i.useful_life_years === null || i.useful_life_years === undefined ? null : NUM(i.useful_life_years),
      isBreakdown: !!i.is_breakdown,
      confidence: i.confidence ?? null,
      sourceKind: i.source_kind ?? null,
      owner: i.owner ?? null,
      note: i.note ?? null,
      visibility: i.visibility,
      sortOrder: i.sort_order ?? 0,
    })),
    questions: (questions || []).map((q) => ({
      costQuestionId: q.cost_question_id,
      addressee: q.addressee,
      question: q.question,
      whyItMatters: q.why_it_matters ?? null,
      impactLow: q.impact_low === null || q.impact_low === undefined ? null : NUM(q.impact_low),
      impactHigh: q.impact_high === null || q.impact_high === undefined ? null : NUM(q.impact_high),
      status: q.status,
      answer: q.answer ?? null,
      answeredOn: q.answered_on ?? null,
      linkedAssumptionId: q.linked_assumption_id ?? null,
      visibility: q.visibility,
      sortOrder: q.sort_order ?? 0,
    })),
    notes: (notes || []).map((n) => ({
      costNoteId: n.cost_note_id,
      section: n.section,
      title: n.title,
      bodyMd: n.body_md ?? null,
      sourceUrl: n.source_url ?? null,
      sourceLabel: n.source_label ?? null,
      visibility: n.visibility,
      sortOrder: n.sort_order ?? 0,
    })),
  };
}

/** service_role で1PJ分のコスト試算を読む。server component からも使う。 */
export async function loadCostModelBundle(projectId: string): Promise<CostModelBundle | null> {
  const db = createAdminClient();
  const { data: model } = await db
    .from("project_cost_models")
    .select("*")
    .eq("project_id", projectId)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!model) return null;

  const [a, i, q, n] = await Promise.all([
    db.from("project_cost_assumptions").select("*").eq("cost_model_id", model.cost_model_id).order("sort_order"),
    db.from("project_cost_items").select("*").eq("cost_model_id", model.cost_model_id).order("sort_order"),
    db.from("project_cost_questions").select("*").eq("cost_model_id", model.cost_model_id).order("sort_order"),
    db.from("project_cost_notes").select("*").eq("cost_model_id", model.cost_model_id).order("sort_order"),
  ]);
  return mapBundle(model, a.data || [], i.data || [], q.data || [], n.data || []);
}

/** GET /api/project-cost-model?projectId=p21 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.errorResponse;

  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ ok: false, error: "projectId required" }, { status: 400 });

  const { data: member } = await auth.supabase
    .from("members")
    .select("is_admin")
    .eq("email", auth.user.email.toLowerCase())
    .maybeSingle();

  // 参照系。前提と明細はMTG前後にadminがまとめて直すだけなので、短時間の再利用を許す。
  // 書き込み側は project-cost-model-client 側でキャッシュを捨てる。
  const headers = { "Cache-Control": "private, max-age=60, stale-while-revalidate=300" };

  const bundle = await loadCostModelBundle(projectId);
  if (!bundle) {
    return NextResponse.json({ ok: true, canEdit: !!member?.is_admin, bundle: null }, { headers });
  }

  return NextResponse.json({ ok: true, canEdit: !!member?.is_admin, bundle }, { headers });
}

const ASSUMPTION_FIELDS = new Set(["value", "value_text", "confidence", "source_kind", "owner", "note", "is_key", "visibility"]);
const QUESTION_FIELDS = new Set(["status", "answer", "answered_on", "visibility", "impact_low", "impact_high"]);
const NOTE_FIELDS = new Set(["title", "body_md", "source_url", "source_label", "visibility", "sort_order"]);
const ITEM_FIELDS = new Set(["unit_price", "quantity", "useful_life_years", "confidence", "source_kind", "owner", "note", "visibility"]);

/**
 * PATCH /api/project-cost-model
 * body: { entity: "assumption"|"item"|"question", id, patch: {...} }
 * 前提を1つ動かすとタブ側の4シナリオが再計算される。計算結果は保存しない (常に導出)。
 */
export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ ok: false, error: "invalid body" }, { status: 400 });

  const { entity, id, patch } = body as { entity?: string; id?: string; patch?: Record<string, unknown> };
  if (!id || !patch || typeof patch !== "object") {
    return NextResponse.json({ ok: false, error: "id and patch required" }, { status: 400 });
  }

  const table =
    entity === "assumption" ? "project_cost_assumptions"
    : entity === "item" ? "project_cost_items"
    : entity === "question" ? "project_cost_questions"
    : entity === "note" ? "project_cost_notes"
    : null;
  const pk =
    entity === "assumption" ? "cost_assumption_id"
    : entity === "item" ? "cost_item_id"
    : entity === "question" ? "cost_question_id"
    : entity === "note" ? "cost_note_id"
    : null;
  const allowed =
    entity === "assumption" ? ASSUMPTION_FIELDS
    : entity === "item" ? ITEM_FIELDS
    : entity === "question" ? QUESTION_FIELDS
    : entity === "note" ? NOTE_FIELDS
    : null;
  if (!table || !pk || !allowed) return NextResponse.json({ ok: false, error: "unknown entity" }, { status: 400 });

  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (allowed.has(k)) clean[k] = v === "" ? null : v;
  }
  if (Object.keys(clean).length === 0) {
    return NextResponse.json({ ok: false, error: "no writable field" }, { status: 400 });
  }
  clean.updated_at = new Date().toISOString();

  const db = createAdminClient();
  const { error } = await db.from(table).update(clean).eq(pk, id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
