/**
 * POST /api/institutions/policies
 *
 * Institution policy matrix (/institutions/assess) の 1 セルを upsert する。
 * 認証: admin (members.is_admin=true)。
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { InstitutionPolicySourceType, InstitutionPolicyStatus } from "@/lib/institution-policy";
import { invalidateInstitutionSupportProgramsCache } from "@/lib/institution-support-programs";

const VALID_STATUSES = new Set<InstitutionPolicyStatus>([
  "unknown",
  "not_started",
  "drafting",
  "established",
]);
const VALID_SOURCE_TYPES = new Set<InstitutionPolicySourceType>([
  "unknown",
  "official",
  "internal_doc",
  "hearing",
  "db",
  "inferred",
]);

async function authorize(): Promise<
  { ok: true; evaluator: string } | { ok: false; res: NextResponse }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return { ok: false, res: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }
  const { data: member } = await supabase
    .from("members")
    .select("code_name, is_admin")
    .eq("email", user.email.toLowerCase())
    .maybeSingle();
  if (!member?.is_admin) {
    return { ok: false, res: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  return { ok: true, evaluator: member.code_name || user.email };
}

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  return v ? v.slice(0, max) : null;
}

function cleanDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

export async function POST(req: NextRequest) {
  const authz = await authorize();
  if (!authz.ok) return authz.res;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const institutionId = cleanText(body.institution_id, 100);
  const policyItemId = cleanText(body.policy_item_id, 100);
  if (!institutionId || !policyItemId) {
    return NextResponse.json(
      { error: "institution_id and policy_item_id are required" },
      { status: 400 },
    );
  }

  const status = String(body.status ?? "unknown") as InstitutionPolicyStatus;
  if (!VALID_STATUSES.has(status)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }
  const sourceType = String(body.source_type ?? "unknown") as InstitutionPolicySourceType;
  if (!VALID_SOURCE_TYPES.has(sourceType)) {
    return NextResponse.json({ error: "invalid source_type" }, { status: 400 });
  }

  const row = {
    institution_id: institutionId,
    policy_item_id: policyItemId,
    status,
    attribute_value: cleanText(body.attribute_value, 4000),
    evidence_note: cleanText(body.evidence_note, 4000),
    source_type: sourceType,
    source_url: cleanText(body.source_url, 2000),
    source_path: cleanText(body.source_path, 2000),
    confirmed_at: cleanDate(body.confirmed_at),
    evaluator: authz.evaluator,
    updated_at: new Date().toISOString(),
  };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("institution_policy_assessments")
    .upsert(row, { onConflict: "institution_id,policy_item_id" })
    .select(
      "institution_id,policy_item_id,status,attribute_value,evidence_note,source_type,source_url,source_path,confirmed_at,evaluator",
    )
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // /institutions「支援プログラム比較」のサーバ側スナップショットを捨てる (参照系の書き込み経路の約束)
  invalidateInstitutionSupportProgramsCache();
  return NextResponse.json({ ok: true, assessment: data });
}
