import { NextRequest, NextResponse } from "next/server";
import { Buffer } from "node:buffer";
import { createCapitalPlanXlsx, type FrozenCapitalPlanVersion } from "@/lib/capital-plan-xlsx";
import { type CapitalEvent, type CapitalPlan, type Holder, type ValidationIssue } from "@/lib/capital-plan";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMember } from "@/lib/supabase/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

type CapitalPlanRow = {
  id: string;
  project_id: string;
  name: string;
};

type CapitalPlanVersionRow = {
  plan_id: string;
  project_id: string;
  version: number;
  document_json: unknown;
  source_revision: number;
  validation_summary: unknown;
  published_by_email: string | null;
  published_at: string | null;
};

type CompanyProfileRow = {
  legal_name: string | null;
};

type ProjectRow = {
  project_name: string | null;
};

function noStoreJson(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function firstNonEmptyText(...values: Array<string | null | undefined>) {
  return values.find((value): value is string => typeof value === "string" && value.trim().length > 0)?.trim();
}

function isPositiveInteger(value: string | null): value is string {
  if (!value || !/^\d+$/.test(value)) return false;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0;
}

/**
 * GET /api/governance/capital-plans/export?planId=<uuid>&version=<positive integer>
 *
 * 凍結済み版だけを既存のExcel生成器へ渡す。working plan のdocument_jsonを読み込んだり、
 * 再導出・freezeを行ったりしないため、ネイティブクライアントからもPWAと同じ確定版を取得できる。
 */
export async function GET(req: NextRequest) {
  const auth = await requireMember();
  if (!auth.ok) {
    auth.errorResponse.headers.set("Cache-Control", "no-store");
    return auth.errorResponse;
  }

  const planId = req.nextUrl.searchParams.get("planId")?.trim();
  const versionParam = req.nextUrl.searchParams.get("version");
  if (!planId) return noStoreJson({ ok: false, error: "planId required" }, 400);
  if (!isPositiveInteger(versionParam)) {
    return noStoreJson({ ok: false, error: "version must be a positive integer" }, 400);
  }
  const version = Number(versionParam);

  const db = createAdminClient();
  const [planRes, frozenRes] = await Promise.all([
    db.from("project_capital_plans").select("id,project_id,name").eq("id", planId).maybeSingle(),
    db
      .from("project_capital_plan_versions")
      .select("plan_id,project_id,version,document_json,source_revision,validation_summary,published_by_email,published_at")
      .eq("plan_id", planId)
      .eq("version", version)
      .maybeSingle(),
  ]);

  if (planRes.error) return noStoreJson({ ok: false, error: planRes.error.message }, 500);
  if (frozenRes.error) return noStoreJson({ ok: false, error: frozenRes.error.message }, 500);

  const planRow = planRes.data as CapitalPlanRow | null;
  const frozenRow = frozenRes.data as CapitalPlanVersionRow | null;
  if (!planRow || !frozenRow) {
    return noStoreJson({ ok: false, error: "frozen capital plan version not found" }, 404);
  }

  const [profileRes, projectRes] = await Promise.all([
    db.from("project_company_profiles").select("legal_name").eq("project_id", planRow.project_id).maybeSingle(),
    db.from("projects").select("project_name").eq("project_id", planRow.project_id).maybeSingle(),
  ]);
  if (profileRes.error) return noStoreJson({ ok: false, error: profileRes.error.message }, 500);
  if (projectRes.error) return noStoreJson({ ok: false, error: projectRes.error.message }, 500);

  // PWA clientと同じく、凍結行のdocument_jsonからだけholders/eventsを取り出す。
  const frozenDocument = isPlainObject(frozenRow.document_json) ? frozenRow.document_json : {};
  const holders = Array.isArray(frozenDocument.holders) ? (frozenDocument.holders as Holder[]) : [];
  const events = Array.isArray(frozenDocument.events) ? (frozenDocument.events as CapitalEvent[]) : [];
  const validationSummary = isPlainObject(frozenRow.validation_summary) ? frozenRow.validation_summary : {};
  const validation: ValidationIssue[] = [
    ...(Array.isArray(validationSummary.blockingIssues) ? (validationSummary.blockingIssues as ValidationIssue[]) : []),
    ...(Array.isArray(validationSummary.warnings) ? (validationSummary.warnings as ValidationIssue[]) : []),
  ];
  const frozenPlan: CapitalPlan = {
    id: frozenRow.plan_id,
    name: planRow.name,
    holders,
    events,
  };
  const profile = profileRes.data as CompanyProfileRow | null;
  const project = projectRes.data as ProjectRow | null;
  const frozen: FrozenCapitalPlanVersion = {
    plan: frozenPlan,
    plan_name: planRow.name,
    project_name: firstNonEmptyText(profile?.legal_name, project?.project_name, planRow.name),
    version: frozenRow.version,
    source_revision: String(frozenRow.source_revision),
    published_at: frozenRow.published_at ?? "",
    published_by: frozenRow.published_by_email ?? "",
    document_json: JSON.stringify(frozenRow.document_json),
    status: "frozen",
    validation,
  };

  try {
    const bytes = createCapitalPlanXlsx(frozen);
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": XLSX_CONTENT_TYPE,
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="capital-plan-v${frozen.version}.xlsx"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Excel出力に失敗しました";
    return noStoreJson({ ok: false, error: message }, 400);
  }
}
