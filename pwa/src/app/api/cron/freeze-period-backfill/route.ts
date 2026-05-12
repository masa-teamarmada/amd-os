/**
 * freeze-period-backfill cron
 *
 * 休止期間のある PJ (projects.freeze_from_ym + restart_expected_ym セット済) について、
 * 再開予定月の milestone_monthly_progress が登録されたら、休止期間中の monthly_reports +
 * project_meeting_summaries を Sonnet で統合して freeze_period_backfills に保存する。
 *
 * 動作:
 *   1. projects WHERE freeze_from_ym AND restart_expected_ym
 *   2. 各 PJ について、value_milestones × milestone_monthly_progress を join して
 *      「ym >= restart_expected_ym で progress_pct > 0 もしくは note IS NOT NULL の行があるか」
 *      = 再開後 MS が登録されたか確認
 *   3. yes なら freeze_from_ym 〜 (restart_expected_ym 直前) の monthly_reports +
 *      project_meeting_summaries を fetch
 *   4. それらを source_hash 化 → freeze_period_backfills の既存行と比較
 *   5. 差分あれば Sonnet で「休止期間中の進捗を再開月サマリに含める形で統合」
 *   6. upsert
 *
 * cron スケジュール: 毎日 04:30 JST 想定。Vercel cron に追加 or GAS から curl。
 *
 * 正本: pwa/scripts/migrations/044_freeze_period_backfills.sql
 */

import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import { createHash } from "node:crypto";

export const maxDuration = 300;
export const runtime = "nodejs";

interface Project {
  project_id: string;
  project_name: string;
  freeze_from_ym: string;
  restart_expected_ym: string;
}

interface MonthlyReport {
  ym: string;
  draft_content: string | null;
  final_content: string | null;
}

interface MeetingSummary {
  meeting_date: string;
  title: string | null;
  decided: string | null;
  progress: string | null;
  next_actions: string | null;
  risks: string | null;
}

function hashStr(s: string): string {
  return createHash("sha256").update(s).digest("hex").slice(0, 16);
}

// 'YYYYMM' を 1 ヶ月減算して 'YYYYMM'
function prevYm(ym: string): string {
  const y = parseInt(ym.slice(0, 4), 10);
  const m = parseInt(ym.slice(4, 6), 10);
  if (m === 1) return `${y - 1}12`;
  return `${y}${String(m - 1).padStart(2, "0")}`;
}

function ymToDate(ym: string, day: 1 | 31): string {
  const y = ym.slice(0, 4);
  const m = ym.slice(4, 6);
  if (day === 1) return `${y}-${m}-01`;
  // 月末は適当に 31 にして DB の date filter は包含で扱う (>= start AND < nextMonth)
  return `${y}-${m}-31`;
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const anthroKey = process.env.ANTHROPIC_API_KEY;
  if (!anthroKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });
  }
  const db = createAdminClient();
  const anthropic = new Anthropic({ apiKey: anthroKey });

  // 1. 休止期間のある PJ を取得
  const { data: projsData, error: pErr } = await db
    .from("projects")
    .select("project_id, project_name, freeze_from_ym, restart_expected_ym")
    .not("freeze_from_ym", "is", null)
    .not("restart_expected_ym", "is", null);
  if (pErr) {
    return NextResponse.json({ ok: false, error: pErr.message }, { status: 500 });
  }
  const projects = (projsData ?? []) as Project[];

  const processed: { project_id: string; action: string; reason?: string }[] = [];

  for (const p of projects) {
    if (!p.freeze_from_ym || !p.restart_expected_ym) continue;
    const freezeStart = p.freeze_from_ym;
    const restartYm = p.restart_expected_ym;
    if (freezeStart >= restartYm) {
      processed.push({ project_id: p.project_id, action: "skipped", reason: "invalid range" });
      continue;
    }

    // 2. 再開後 MS が登録済か確認 (value_milestones 経由)
    //    project_id → plan_cycle (project_config 経由) は本仕様外なので
    //    milestone_monthly_progress 自体に project_id 結合する value_milestones を逆引きで
    //    確認するのは複雑。簡易判定: milestone_monthly_progress に直接 project_id 列はないが、
    //    monthly_reports の存在 (= 再開月の月次レポートが生成済) を「再開 MS 登録済」の代替 signal にする。
    const { data: restartReports } = await db
      .from("monthly_reports")
      .select("ym, status")
      .eq("project_id", p.project_id)
      .gte("ym", restartYm)
      .limit(1);
    if (!restartReports || restartReports.length === 0) {
      processed.push({ project_id: p.project_id, action: "wait_restart_signal" });
      continue;
    }

    // 3. 休止期間中の monthly_reports + meeting_summaries を取得
    const freezeEndExcl = restartYm; // 休止は restart_ym の直前まで (= ym < restartYm)
    const { data: reportsData } = await db
      .from("monthly_reports")
      .select("ym, draft_content, final_content")
      .eq("project_id", p.project_id)
      .gte("ym", freezeStart)
      .lt("ym", freezeEndExcl)
      .order("ym", { ascending: true });
    const reports = (reportsData ?? []) as MonthlyReport[];

    const startDate = ymToDate(freezeStart, 1);
    const endDate = ymToDate(prevYm(restartYm), 31);
    const { data: meetingsData } = await db
      .from("project_meeting_summaries")
      .select("meeting_date, title, decided, progress, next_actions, risks")
      .eq("project_id", p.project_id)
      .gte("meeting_date", startDate)
      .lte("meeting_date", endDate)
      .order("meeting_date", { ascending: true });
    const meetings = (meetingsData ?? []) as MeetingSummary[];

    if (reports.length === 0 && meetings.length === 0) {
      processed.push({ project_id: p.project_id, action: "skipped", reason: "no source data" });
      continue;
    }

    // 4. source_hash で差分検知
    const sourceText = [
      ...reports.map((r) => `R:${r.ym}:${(r.final_content ?? r.draft_content ?? "").slice(0, 200)}`),
      ...meetings.map((m) => `M:${m.meeting_date}:${(m.decided ?? "").slice(0, 200)}|${(m.progress ?? "").slice(0, 200)}`),
    ].join("\n");
    const sourceHash = hashStr(sourceText);

    const { data: existing } = await db
      .from("freeze_period_backfills")
      .select("source_hash")
      .eq("project_id", p.project_id)
      .eq("freeze_from_ym", freezeStart)
      .eq("restart_ym", restartYm)
      .maybeSingle();
    if (existing && (existing as { source_hash: string }).source_hash === sourceHash) {
      processed.push({ project_id: p.project_id, action: "unchanged" });
      continue;
    }

    // 5. Sonnet で統合サマリ
    const prompt = `あなたは AMD OS の経営アシスタント (つくよみ) です。
PJ「${p.project_name}」(project_id=${p.project_id}) が ${freezeStart} 〜 ${prevYm(restartYm)} の期間中に休止 (= AMD 参画を一時停止) していました。
${restartYm} から AMD 参画が再開するため、休止期間中に PJ で何が起きていたかを再開月の cockpit サマリに表示できる形でまとめてください。

# 休止期間中の monthly_reports (${reports.length} 件):
${reports.length === 0 ? "(なし)" : reports.map((r) => `## ${r.ym}\n${(r.final_content ?? r.draft_content ?? "").slice(0, 1500)}`).join("\n\n")}

# 休止期間中の MTG サマリ (${meetings.length} 件):
${meetings.length === 0 ? "(なし)" : meetings.map((m) => `## ${m.meeting_date} ${m.title ?? ""}\n- 決定: ${(m.decided ?? "").slice(0, 300)}\n- 進捗: ${(m.progress ?? "").slice(0, 300)}\n- Next: ${(m.next_actions ?? "").slice(0, 200)}\n- Risk: ${(m.risks ?? "").slice(0, 200)}`).join("\n\n")}

# 出力形式
以下を 400-700 字でまとめる:
1. 休止期間中の主要進捗 (技術 / 事業 / 資金 / 人員 など、起きた事実)
2. 休止期間中に出てきた懸念点・未解決事項
3. 再開時点 (${restartYm}) で AMD が押さえるべきポイント

タイトルや見出しは付けず、本文だけを返す。`;

    let summary = "";
    try {
      const r = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1500,
        messages: [{ role: "user", content: prompt }],
      });
      summary = r.content
        .filter((c) => c.type === "text")
        .map((c) => (c as { type: "text"; text: string }).text)
        .join("\n")
        .trim();
    } catch (e) {
      processed.push({ project_id: p.project_id, action: "llm_error", reason: String(e) });
      continue;
    }
    if (!summary) {
      processed.push({ project_id: p.project_id, action: "empty_summary" });
      continue;
    }

    // 6. upsert
    const now = new Date().toISOString();
    const { error: upErr } = await db.from("freeze_period_backfills").upsert(
      {
        project_id: p.project_id,
        freeze_from_ym: freezeStart,
        restart_ym: restartYm,
        summary,
        source_hash: sourceHash,
        source_meta: {
          reports_count: reports.length,
          meetings_count: meetings.length,
          llm_model: "claude-sonnet-4-6",
          generated_at: now,
        },
        updated_at: now,
      },
      { onConflict: "project_id,freeze_from_ym,restart_ym" }
    );
    if (upErr) {
      processed.push({ project_id: p.project_id, action: "upsert_error", reason: upErr.message });
      continue;
    }
    processed.push({ project_id: p.project_id, action: existing ? "updated" : "created" });
  }

  return NextResponse.json({
    ok: true,
    projects_total: projects.length,
    processed,
  });
}
