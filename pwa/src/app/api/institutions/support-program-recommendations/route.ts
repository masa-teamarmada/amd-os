/**
 * POST /api/institutions/support-program-recommendations
 *
 * /institutions「支援プログラム比較」下段の「AMDが規程類へ盛り込むべき論点と推奨」を1件ずつ upsert する。
 * 認証: admin。保存後に参照系スナップショット (lib/institution-support-programs.ts) を捨てる。
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/api-auth";
import { invalidateInstitutionSupportProgramsCache } from "@/lib/institution-support-programs";
import type { RecommendationStance } from "@/types/institution-support-programs";

export const runtime = "nodejs";

const STANCES = new Set<RecommendationStance>(["recommend", "conditional", "not_recommend", "open"]);
const textValue = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "入力形式が不正です" }, { status: 400 });

  const topic = textValue(body.topic, 300);
  const recommendation = textValue(body.recommendation, 1000);
  const stance = textValue(body.stance, 30) as RecommendationStance;
  if (!topic || !recommendation || !STANCES.has(stance)) {
    return NextResponse.json(
      { error: "論点・推奨・スタンスを確認してね" },
      { status: 400 },
    );
  }
  const policyItemId = textValue(body.policyItemId, 100) || null;
  const recommendationId = textValue(body.recommendationId, 150) || `rec_${crypto.randomUUID()}`;
  const sortOrder = Number.isFinite(Number(body.sortOrder)) ? Math.trunc(Number(body.sortOrder)) : 100;

  const admin = createAdminClient();
  if (policyItemId) {
    const { data: item } = await admin
      .from("institution_policy_items")
      .select("policy_item_id")
      .eq("policy_item_id", policyItemId)
      .maybeSingle();
    if (!item) return NextResponse.json({ error: "紐づける比較項目が見つからない" }, { status: 400 });
  }

  const { error } = await admin.from("institution_policy_recommendations").upsert(
    {
      recommendation_id: recommendationId,
      policy_item_id: policyItemId,
      topic,
      stance,
      recommendation,
      conditions: textValue(body.conditions, 4000) || null,
      rationale: textValue(body.rationale, 4000) || null,
      evidence_note: textValue(body.evidenceNote, 4000) || null,
      stat_note: textValue(body.statNote, 1000) || null,
      sort_order: sortOrder,
      is_active: body.isActive !== false,
      updated_by: auth.user.email,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "recommendation_id" },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  invalidateInstitutionSupportProgramsCache();
  return NextResponse.json({ ok: true, recommendationId });
}
