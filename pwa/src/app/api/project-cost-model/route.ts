import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth, requireAdmin } from "@/lib/supabase/api-auth";
import { hasSharedWorkspaceProjectReadAccess } from "@/lib/shared-workspace-project-read-access";
import type { CostModelBundle } from "@/lib/project-cost-model";

export const runtime = "nodejs";

// PJコックピット / PJワークスペース「コスト試算」タブの API。
// read = ログイン済みAMDメンバー、または当該PJの共有ワークスペースメンバー。write = admin。
// migration: scripts/migrations/320_project_cost_model.sql / 392 (株・用途の列と二段階計算) / 394 (作業リスト) / 396 (オフサイトの範囲と輸送の回数) / 398 (作業を誰がやるか)
// 計算そのものは src/lib/project-cost-model.ts (純関数)。ここは入出力だけ。

const NUM = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);
const NUM_OR_NULL = (v: unknown): number | null => (v === null || v === undefined ? null : NUM(v));

/* eslint-disable @typescript-eslint/no-explicit-any */
export function mapBundle(model: any, assumptions: any[], items: any[], questions: any[], notes: any[] = [], tasks: any[] = []): CostModelBundle {
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
      strain: a.strain ?? null,
      application: a.application ?? null,
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
      strain: i.strain ?? null,
      application: i.application ?? null,
      bearer: i.bearer === "customer" || i.bearer === "site" || i.bearer === "reactor" ? i.bearer : "sx",
    })),
    tasks: (tasks || []).map((t) => ({
      costTaskId: t.cost_task_id,
      scenario: t.scenario,
      groupLabel: t.group_label ?? null,
      label: t.label,
      hoursPerOccurrence: NUM_OR_NULL(t.hours_per_occurrence),
      countDriver: t.count_driver,
      countPerYear: NUM_OR_NULL(t.count_per_year),
      expensePerOccurrence: NUM(t.expense_per_occurrence),
      performer: t.performer === "customer" || t.performer === "site" || t.performer === "reactor" ? t.performer : "sx",
      confidence: t.confidence ?? null,
      sourceKind: t.source_kind ?? null,
      owner: t.owner ?? null,
      note: t.note ?? null,
      visibility: t.visibility,
      sortOrder: t.sort_order ?? 0,
      strain: t.strain ?? null,
      application: t.application ?? null,
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

/**
 * どの試算を読むか。default = コスト試算タブ (排水処理など。case_kind が biodiesel 以外)、
 * fuel = 事業計画グループのコスト試算（燃料）タブ (case_kind = biodiesel。migration 411)。
 * 同じPJに両方が active で並ぶので、既定で燃料の試算を読まないようにする。
 */
export type CostModelKind = "default" | "fuel";

/** service_role で1PJ分のコスト試算を読む。server component からも使う。 */
export async function loadCostModelBundle(projectId: string, kind: CostModelKind = "default"): Promise<CostModelBundle | null> {
  const db = createAdminClient();
  const base = db
    .from("project_cost_models")
    .select("*")
    .eq("project_id", projectId)
    .eq("status", "active");
  const { data: model } = await (kind === "fuel" ? base.eq("case_kind", "biodiesel") : base.neq("case_kind", "biodiesel"))
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!model) return null;

  const [a, i, q, n, t] = await Promise.all([
    db.from("project_cost_assumptions").select("*").eq("cost_model_id", model.cost_model_id).order("sort_order"),
    db.from("project_cost_items").select("*").eq("cost_model_id", model.cost_model_id).order("sort_order"),
    db.from("project_cost_questions").select("*").eq("cost_model_id", model.cost_model_id).order("sort_order"),
    db.from("project_cost_notes").select("*").eq("cost_model_id", model.cost_model_id).order("sort_order"),
    db.from("project_cost_tasks").select("*").eq("cost_model_id", model.cost_model_id).order("sort_order"),
  ]);
  return mapBundle(model, a.data || [], i.data || [], q.data || [], n.data || [], t.data || []);
}

/** GET /api/project-cost-model?projectId=p21 */
export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ ok: false, error: "projectId required" }, { status: 400 });

  const auth = await requireAuth();
  const sharedWorkspaceRead = !auth.ok && await hasSharedWorkspaceProjectReadAccess(projectId);
  if (!auth.ok && !sharedWorkspaceRead) return auth.errorResponse;

  const member = auth.ok
    ? await auth.supabase
      .from("members")
      .select("is_admin")
      .eq("email", auth.user.email.toLowerCase())
      .maybeSingle()
    : { data: null };

  // 参照系。前提と明細はMTG前後にadminがまとめて直すだけなので、短時間の再利用を許す。
  // 書き込み側は project-cost-model-client 側でキャッシュを捨て、保存直後の読み直しだけ ?fresh=1 で HTTP キャッシュを通さない (spec 5-10)。
  const fresh = req.nextUrl.searchParams.get("fresh") === "1";
  const headers = { "Cache-Control": fresh ? "no-store" : "private, max-age=60, stale-while-revalidate=300" };

  // ?kind=fuel はコスト試算（燃料）タブ。無ければコスト試算（廃液）タブの試算。
  const kind: CostModelKind = req.nextUrl.searchParams.get("kind") === "fuel" ? "fuel" : "default";
  const bundle = await loadCostModelBundle(projectId, kind);
  if (!bundle) {
    return NextResponse.json({ ok: true, canEdit: !!member.data?.is_admin, bundle: null }, { headers });
  }

  return NextResponse.json({ ok: true, canEdit: !!member.data?.is_admin, bundle }, { headers });
}

const ASSUMPTION_FIELDS = new Set(["value", "value_text", "confidence", "source_kind", "owner", "note", "is_key", "visibility"]);
const QUESTION_FIELDS = new Set(["status", "answer", "answered_on", "visibility", "impact_low", "impact_high"]);
const NOTE_FIELDS = new Set(["title", "body_md", "source_url", "source_label", "visibility", "sort_order"]);
const ITEM_FIELDS = new Set(["unit_price", "quantity", "useful_life_years", "bearer", "confidence", "source_kind", "owner", "note", "visibility"]);
const TASK_FIELDS = new Set([
  // 作業単価は前提の共通の作業単価 (labor_rate) だけ。作業ごとの hourly_rate は書かせない (まさ 2026-09-14)。
  "hours_per_occurrence", "count_driver", "count_per_year", "expense_per_occurrence", "performer",
  "confidence", "source_kind", "owner", "note", "visibility",
]);
const MODEL_FIELDS = new Set(["target_total_cost_per_m3", "target_margin_rate"]);

/** 数字の列。画面の試算で書き換えた値を保存するので、数字でない値や負の値は DB へ流さない。 */
const NUMERIC_FIELDS = new Set([
  "value", "impact_low", "impact_high", "sort_order", "unit_price", "quantity", "useful_life_years",
  "hours_per_occurrence", "count_per_year", "expense_per_occurrence", "target_total_cost_per_m3", "target_margin_rate",
]);
/** 空欄 (null) に戻せる数字の列。 */
const NULLABLE_NUMERIC_FIELDS = new Set([
  "value", "impact_low", "impact_high", "useful_life_years", "hours_per_occurrence", "count_per_year",
  "target_total_cost_per_m3", "target_margin_rate",
]);
// plant_line は燃料の試算の「燃料化設備の系列ごと」(migration 411)。
const TASK_DRIVERS = new Set(["fixed", "batch", "visit", "module_swap", "membrane_swap", "truck_trip", "production_line", "plant_line"]);
const TASK_PERFORMERS = new Set(["sx", "customer", "site", "reactor"]);
/** 明細の「誰が持つか」。値は作業の「誰がやるか」と同じ3つ。 */
const ITEM_BEARERS = new Set(["sx", "customer", "site", "reactor"]);

/**
 * PATCH /api/project-cost-model
 * body: { entity: "assumption"|"item"|"task"|"model"|"question"|"note", id, patch: {...} }
 * 画面の試算は保存しない。admin が「この値を保存」を押したときだけ、ここで正本へ書く。計算結果は保存しない (常に導出)。
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
    : entity === "task" ? "project_cost_tasks"
    : entity === "model" ? "project_cost_models"
    : entity === "question" ? "project_cost_questions"
    : entity === "note" ? "project_cost_notes"
    : null;
  const pk =
    entity === "assumption" ? "cost_assumption_id"
    : entity === "item" ? "cost_item_id"
    : entity === "task" ? "cost_task_id"
    : entity === "model" ? "cost_model_id"
    : entity === "question" ? "cost_question_id"
    : entity === "note" ? "cost_note_id"
    : null;
  const allowed =
    entity === "assumption" ? ASSUMPTION_FIELDS
    : entity === "item" ? ITEM_FIELDS
    : entity === "task" ? TASK_FIELDS
    : entity === "model" ? MODEL_FIELDS
    : entity === "question" ? QUESTION_FIELDS
    : entity === "note" ? NOTE_FIELDS
    : null;
  if (!table || !pk || !allowed) return NextResponse.json({ ok: false, error: "unknown entity" }, { status: 400 });

  const clean: Record<string, unknown> = {};
  for (const [k, raw] of Object.entries(patch)) {
    if (!allowed.has(k)) continue;
    const v = raw === "" ? null : raw;
    if (NUMERIC_FIELDS.has(k)) {
      if (v === null) {
        if (!NULLABLE_NUMERIC_FIELDS.has(k)) return NextResponse.json({ ok: false, error: `${k} は空欄にできない` }, { status: 400 });
      } else if (typeof v !== "number" || !Number.isFinite(v) || (k !== "value" && v < 0)) {
        return NextResponse.json({ ok: false, error: `${k} は0以上の数字で入れる` }, { status: 400 });
      }
    }
    if (k === "count_driver" && !TASK_DRIVERS.has(String(v))) {
      return NextResponse.json({ ok: false, error: "count_driver が不正" }, { status: 400 });
    }
    if (k === "performer" && !TASK_PERFORMERS.has(String(v))) {
      return NextResponse.json({ ok: false, error: "performer が不正" }, { status: 400 });
    }
    if (k === "bearer" && !ITEM_BEARERS.has(String(v))) {
      return NextResponse.json({ ok: false, error: "bearer が不正" }, { status: 400 });
    }
    clean[k] = v;
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
