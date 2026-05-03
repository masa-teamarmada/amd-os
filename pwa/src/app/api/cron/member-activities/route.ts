/**
 * GET /api/cron/member-activities
 * Vercel Cron: 毎日 04:00 JST (19:00 UTC) に全アクティブPJの活動推論を実行。
 * monthly_reports + milestone_responsibility を元にClaude Haikuで推論し
 * member_activities(source='inferred')に書き込む。
 *
 * vercel.json schedule: "0 19 * * *"
 * 認証: Authorization: Bearer CRON_SECRET
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

interface InferredActivity {
  memberId: string;
  milestoneId: string | null;
  title: string;
  contentPreview: string;
}

/** 1PJの活動をLLMで推論してmember_activitiesに保存 */
async function inferActivities(
  projectId: string,
  ym: string,
  supabase: ReturnType<typeof getServiceClient>,
  anthropic: Anthropic
): Promise<{ ok: boolean; saved: number; message?: string }> {
  // 1. monthly_report 取得（final or draft）
  const { data: reports } = await supabase
    .from("monthly_reports")
    .select("final_content, draft_content")
    .eq("project_id", projectId)
    .eq("ym", ym)
    .limit(1);

  const report = reports?.[0];
  const reportContent = report?.final_content || report?.draft_content || "";
  if (!reportContent) {
    return { ok: true, saved: 0, message: "no report content" };
  }

  // 2. アクティブなMS + 責任者マトリクス取得
  const { data: planCycles } = await supabase
    .from("value_plan_cycles")
    .select("plan_cycle_id")
    .eq("project_id", projectId)
    .lte("period_start_ym", ym)
    .gte("period_end_ym", ym)
    .limit(1);

  const planCycleId = planCycles?.[0]?.plan_cycle_id;
  if (!planCycleId) return { ok: true, saved: 0, message: "no active plan cycle" };

  const { data: milestones } = await supabase
    .from("value_milestones")
    .select("milestone_id, title")
    .eq("plan_cycle_id", planCycleId)
    .eq("is_active", true);

  if (!milestones || milestones.length === 0) {
    return { ok: true, saved: 0, message: "no milestones" };
  }

  const msIds = milestones.map((m: { milestone_id: string }) => m.milestone_id);
  const { data: responsibilities } = await supabase
    .from("milestone_responsibility")
    .select("milestone_id, member_id, role, task_description")
    .in("milestone_id", msIds);

  if (!responsibilities || responsibilities.length === 0) {
    return { ok: true, saved: 0, message: "no responsibilities" };
  }

  // member_id → codeName マップ
  const memberIds = [...new Set(responsibilities.map((r: { member_id: string }) => r.member_id))];
  const { data: members } = await supabase
    .from("members")
    .select("member_id, code_name")
    .in("member_id", memberIds);

  const memberCodeNames: Record<string, string> = {};
  (members || []).forEach((m: { member_id: string; code_name: string }) => {
    memberCodeNames[m.member_id] = m.code_name || m.member_id;
  });

  // 責任者マトリクスのテキスト化
  const msMap: Record<string, string> = {};
  milestones.forEach((m: { milestone_id: string; title: string }) => { msMap[m.milestone_id] = m.title; });

  const responsibilityText = responsibilities
    .map((r: { milestone_id: string; member_id: string; role: string; task_description: string | null }) =>
      `- ${memberCodeNames[r.member_id] || r.member_id}: [${msMap[r.milestone_id] || r.milestone_id}] 役割=${r.role}${r.task_description ? ` 業務=${r.task_description}` : ""}`
    )
    .join("\n");

  // 3. Claude Haiku で推論
  const prompt = `以下の月次レポートと責任者マトリクスを参照して、各メンバーが今月何をしたかを推論してください。

## 責任者マトリクス（メンバー × MS × 役割）
${responsibilityText}

## 月次レポート（${ym.slice(0,4)}年${ym.slice(4)}月）
${reportContent.substring(0, 3000)}

## 出力フォーマット（JSON）
下記のJSON形式のみで回答してください。他のテキストは不要です。
{
  "activities": [
    {
      "memberId": "メンバーID（責任者マトリクスのmemberId）",
      "milestoneId": "該当するmilestone_id（不明な場合はnull）",
      "title": "短いアクティビティタイトル（20字以内）",
      "contentPreview": "レポート内容に基づく具体的な活動説明（50-100字）"
    }
  ]
}`;

  let inferredActivities: InferredActivity[] = [];
  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      inferredActivities = (parsed.activities || []).filter(
        (a: InferredActivity) => a.memberId && a.title
      );
    }
  } catch (err) {
    console.error("[member-activities] LLM error:", err);
    return { ok: false, saved: 0, message: `LLM error: ${err}` };
  }

  if (inferredActivities.length === 0) {
    return { ok: true, saved: 0, message: "no activities inferred" };
  }

  // 4. member_activities に書き込む（既存の inferred レコードを削除して再挿入）
  await supabase
    .from("member_activities")
    .delete()
    .eq("project_id", projectId)
    .eq("ym", ym)
    .eq("source", "inferred");

  const rows = inferredActivities.map((a, i) => ({
    member_id: a.memberId,
    project_id: projectId,
    ym,
    source: "inferred",
    source_item_id: `inferred-${ym}-${i}`,
    milestone_id: a.milestoneId || null,
    title: a.title,
    content_preview: a.contentPreview,
  }));

  const { error: insertError } = await supabase.from("member_activities").insert(rows);
  if (insertError) {
    console.error("[member-activities] insert error:", insertError);
    return { ok: false, saved: 0, message: insertError.message };
  }

  return { ok: true, saved: rows.length };
}

export async function GET(req: NextRequest) {
  // 認証
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });
  }

  const ym = currentYmJST();
  const supabase = getServiceClient();
  const anthropic = new Anthropic({ apiKey: anthropicKey });

  // アクティブPJ一覧
  const { data: projects, error } = await supabase
    .from("projects")
    .select("project_id")
    .eq("status", "active");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const projectIds = (projects ?? []).map((p: { project_id: string }) => p.project_id);
  if (projectIds.length === 0) {
    return NextResponse.json({ ok: true, ym, ran: 0, message: "no active projects" });
  }

  const results: Array<{ projectId: string; ok: boolean; saved: number; message?: string }> = [];
  for (const projectId of projectIds) {
    try {
      const result = await inferActivities(projectId, ym, supabase, anthropic);
      results.push({ projectId, ok: result.ok, saved: result.saved, message: result.message });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown error";
      console.error(`[cron/member-activities] projectId=${projectId} error:`, msg);
      results.push({ projectId, ok: false, saved: 0, message: msg });
    }
  }

  return NextResponse.json({
    ok: true,
    ym,
    ran: results.length,
    succeeded: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  });
}
