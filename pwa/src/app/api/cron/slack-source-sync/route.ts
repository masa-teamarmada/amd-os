/**
 * GET /api/cron/slack-source-sync
 *
 * daily。`project_slack_sources` に取り込み対象を持つ全PJについて、
 * 当月分のSlack会話を `source_cache(source='slack')` へ upsert する。
 *
 * daily にしている理由は、PJコックピットが古い会話を出さないため。
 * SolvioraX のようなフリープランのワークスペースは90日で履歴が消えるので、
 * 取り込みを止めるとあとから拾い直せない。
 *
 * 月初は前月分も締め直す (月末の投稿がスレッド返信で伸びるため)。
 * LLM は呼ばない。
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  collectProjectSlackSources,
  listSlackSourceProjects,
  type SlackProjectCollectResult,
} from "@/lib/sources/slack-project-collect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const REVISIT_PREVIOUS_MONTH_UNTIL_DAY = 5;

function checkCronAuth(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;
  // Vercel Cron からの呼び出し
  return !!req.headers.get("x-vercel-cron");
}

function jstParts(now = new Date()) {
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return {
    year: jst.getUTCFullYear(),
    month: jst.getUTCMonth() + 1,
    day: jst.getUTCDate(),
  };
}

function ymOf(year: number, month: number) {
  return `${year}${String(month).padStart(2, "0")}`;
}

function targetYms(param: string): string[] {
  if (/^\d{6}$/.test(param)) return [param];
  const { year, month, day } = jstParts();
  const current = ymOf(year, month);
  if (day > REVISIT_PREVIOUS_MONTH_UNTIL_DAY) return [current];
  const prevYear = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;
  return [ymOf(prevYear, prevMonth), current];
}

export async function GET(req: NextRequest) {
  try {
    if (!checkCronAuth(req)) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const yms = targetYms(req.nextUrl.searchParams.get("ym")?.trim() || "");
    const save = req.nextUrl.searchParams.get("save") !== "0";
    const maxMessages = Math.min(500, Math.max(1, Number(req.nextUrl.searchParams.get("maxMessages") || 200)));
    const onlyProjectId = req.nextUrl.searchParams.get("projectId")?.trim() || "";

    const supabase = createAdminClient();
    const projectIds = onlyProjectId ? [onlyProjectId] : await listSlackSourceProjects(supabase);
    if (!projectIds.length) {
      return NextResponse.json({ ok: true, yms, projects: [], note: "no project has slack sources" });
    }

    const { data: projectRows, error: projectError } = await supabase
      .from("projects")
      .select("project_id, project_name, slack_channel_id")
      .in("project_id", projectIds);
    if (projectError) return NextResponse.json({ ok: false, error: projectError.message }, { status: 500 });
    const byId = new Map((projectRows || []).map((row) => [String(row.project_id), row]));

    const results: Array<{
      projectId: string;
      ym: string;
      savedCount: number;
      messageCount: number;
      problems: string[];
    }> = [];
    let savedTotal = 0;
    const problemProjects = new Set<string>();

    for (const projectId of projectIds) {
      const project = byId.get(projectId);
      if (!project) continue;
      for (const ym of yms) {
        let result: SlackProjectCollectResult;
        try {
          result = await collectProjectSlackSources(supabase, {
            projectId,
            projectName: project.project_name,
            fallbackChannelId: project.slack_channel_id,
            ym,
            save,
            maxMessages,
            includeBots: false,
          });
        } catch (projectFailure) {
          const message = projectFailure instanceof Error ? projectFailure.message : String(projectFailure);
          problemProjects.add(projectId);
          results.push({ projectId, ym, savedCount: 0, messageCount: 0, problems: [message] });
          continue;
        }
        const problems = [
          ...result.channels
            .filter((channel) => channel.skipped || channel.error)
            .map((channel) => `${channel.channelName || channel.channelId}: ${channel.error || channel.skipped}`),
          ...(result.saveError ? [`save: ${result.saveError}`] : []),
        ];
        if (problems.length) problemProjects.add(projectId);
        savedTotal += result.savedCount;
        results.push({
          projectId,
          ym,
          savedCount: result.savedCount,
          messageCount: result.messageCount,
          problems,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      yms,
      projectCount: projectIds.length,
      savedTotal,
      problemProjects: Array.from(problemProjects),
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[cron/slack-source-sync]", message, error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
