/**
 * POST /api/institutions/assess
 *
 * ECR マトリクス編集UI (/institutions/assess) から 1 セル分の評価を upsert する。
 * institution_assessments は unique(institution_id, criterion_id, evaluated_at)。
 * 当日分 (evaluated_at = today JST) を onConflict で上書きするため、同日中の編集は
 * 1 レコードに集約され、過去日の評価は履歴として残る (fetchErsBundle は最新1件を採用)。
 *
 * 認証: admin (members.is_admin=true)。
 *
 * Body: {
 *   institution_id: string,
 *   criterion_id: string,
 *   level: number | null,   // 1..5 / null=未評価
 *   na?: boolean,           // true なら該当しない (level は null 扱い・軸平均から除外)
 *   note?: string | null,   // 評価根拠
 * }
 * Returns: { ok: true, assessment } | { error }
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function todayJst(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

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

export async function POST(req: NextRequest) {
  const authz = await authorize();
  if (!authz.ok) return authz.res;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const institutionId = String(body.institution_id ?? "").trim();
  const criterionId = String(body.criterion_id ?? "").trim();
  if (!institutionId || !criterionId) {
    return NextResponse.json(
      { error: "institution_id and criterion_id are required" },
      { status: 400 },
    );
  }

  const na = Boolean(body.na);
  let level: number | null = null;
  if (!na && body.level != null) {
    const n = Number(body.level);
    if (!Number.isInteger(n) || n < 1 || n > 5) {
      return NextResponse.json({ error: "level must be an integer 1..5 or null" }, { status: 400 });
    }
    level = n;
  }
  const note =
    typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 2000) : null;

  const row = {
    institution_id: institutionId,
    criterion_id: criterionId,
    level,
    na,
    note,
    evaluated_at: todayJst(),
    evaluator: authz.evaluator,
    updated_at: new Date().toISOString(),
  };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("institution_assessments")
    .upsert(row, { onConflict: "institution_id,criterion_id,evaluated_at" })
    .select("institution_id,criterion_id,level,na,note,evaluated_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, assessment: data });
}
