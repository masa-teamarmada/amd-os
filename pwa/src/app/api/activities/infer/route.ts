/**
 * POST /api/activities/infer
 * マイページの「今すぐ推論」ボタン用。
 * 認証不要（DEV_MODE）。サーバーサイドで推論ロジックを直接実行。
 * body: { projectId?: string }  省略時は全アクティブPJ
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      "placeholder"
  );
}

function currentYmJST(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return `${jst.getUTCFullYear()}${String(jst.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function inferForProject(
  projectId: string,
  ym: string,
  supabase: ReturnType<typeof getServiceClient>,
  anthropic: Anthropic
): Promise<{ ok: boolean; saved: number; message?: string }> {
  // 月次レポート取得
  const { data: reports } = await supabase
    .from("monthly_reports")
    .select("final_content, draft_content")
    .eq("project_id", projectId)
    .eq("ym", ym)
    .limit(1);

  const report = reports?.[0];
  const reportContent = report?.final_content || report?.draft_content || "";
  if (!reportContent) return { ok: true, saved: 0, message: "no report" };

  // アクティブPlanCycle取得
  const { data: planCycles } = await supabase
    .from("value_plan_cycles")
    .select("plan_cycle_id")
    .eq("project_id", projectId)
    .lte("period_start_ym", ym)
    .gte("period_end_ym", ym)
    .limit(1);

  const planCycleId = planCycles?.[0]?.plan_cycle_id;
  if (!planCycleId) return { ok: true, saved: 0, message: "no plan cycle" };

  // MS + 責任者取得
  const { data: milestones } = await supabase
    .from("value_milestones")
    .select("milestone_id, title")
    .eq("plan_cycle_id", planCycleId)
    .eq("is_active", true);

  if (!milestones?.length) return { ok: true, saved: 0, message: "no milestones" };

  const msIds = milestones.map((m: { milestone_id: string }) => m.milestone_id);
  const { data: responsibilities } = await supabase
    .from("milestone_responsibility")
    .select("milestone_id, member_id, role, task_description")
    .in("milestone_id", msIds);

  if (!responsibilities?.length) return { ok: true, saved: 0, message: "no responsibilities" };

  // memberIdー>codeNameマップ
  const memberIds = [...new Set(responsibilities.map((r: { member_id: string }) => r.member_id))];
  const { data: members } = await supabase
    .from("members")
    .select("member_id, code_name")
    .in("member_id", memberIds);

  const codeNames: Record<string, string> = {};
  (members || []).forEach((m: { member_id: string; code_name: string }) => {
    codeNames[m.member_id] = m.code_name || m.member_id;
  });

  const msMap: Record<string, string> = {};
  milestones.forEach((m: { milestone_id: string; title: string }) => { msMap[m.milestone_id] = m.title; });

  const matrix = responsibilities
    .map((r: { milestone_id: string; member_id: string; role: string; task_description: string | null }) =>
      `- ${codeNames[r.member_id] || r.member_id}: [${msMap[r.milestone_id] || r.milestone_id}] 役割=${r.role}${r.task_description ? ` 業務=${r.task_description}` : ""}`
    )
    .join("\n");

  // LLM推論
  const prompt = `月次レポートと責任者マトリクスから、各メンバーの今月の活動を推論してください。

## 責任者マトリクス
${matrix}

## 月次レポート（${ym.slice(0,4)}年${ym.slice(4)}月）
${reportContent.substring(0, 3000)}

JSON形式のみで回答（他のテキスト不要）:
{"activities":[{"memberId":"メンバーID","milestoneId":"MS-ID or null","title":"20字以内","contentPreview":"50-100字の活動説明"}]}`;

  let activities: Array<{ memberId: string; milestoneId: string | null; title: string; contentPreview: string }> = [];
  try {
    const res = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });
    const text = res.content[0].type === "text" ? res.content[0].text : "";
    const match = text.match(/\{[\s\S]*\}/);
    if (match) activities = (JSON.parse(match[0]).activities || []).filter((a: { memberId: string }) => a.memberId);
  } catch (e) {
    return { ok: false, saved: 0, message: `LLM error: ${e}` };
  }

  if (!activities.length) return { ok: true, saved: 0, message: "no activities inferred" };

  // 既存inferred削除→再挿入
  await supabase.from("member_activities").delete()
    .eq("project_id", projectId).eq("ym", ym).eq("source", "inferred");

  const rows = activities.map((a, i) => ({
    member_id: a.memberId,
    project_id: projectId,
    ym,
    source: "inferred",
    source_item_id: `inferred-${ym}-${i}`,
    milestone_id: a.milestoneId || null,
    title: a.title,
    content_preview: a.contentPreview,
  }));

  const { error } = await supabase.from("member_activities").insert(rows);
  if (error) return { ok: false, saved: 0, message: error.message };

  return { ok: true, saved: rows.length };
}

export async function POST(req: NextRequest) {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const ym = currentYmJST();
  const supabase = getServiceClient();
  const anthropic = new Anthropic({ apiKey: anthropicKey });

  let projectIds: string[] = [];

  if (body.projectId) {
    projectIds = [body.projectId];
  } else {
    const { data: projects } = await supabase
      .from("projects").select("project_id").eq("status", "active");
    projectIds = (projects ?? []).map((p: { project_id: string }) => p.project_id);
  }

  if (!projectIds.length) {
    return NextResponse.json({ ok: true, ym, ran: 0, message: "no active projects" });
  }

  const results = [];
  for (const projectId of projectIds) {
    try {
      const r = await inferForProject(projectId, ym, supabase, anthropic);
      results.push({ projectId, ...r });
    } catch (e) {
      results.push({ projectId, ok: false, saved: 0, message: String(e) });
    }
  }

  return NextResponse.json({
    ok: true,
    ym,
    ran: results.length,
    succeeded: results.filter((r) => r.ok).length,
    results,
  });
}
