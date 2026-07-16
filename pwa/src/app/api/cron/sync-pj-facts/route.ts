/**
 * sync-pj-facts cron
 *
 * project_ventures の構造化フィールド (founded_at / outcome_pattern / amd_support_*)
 * を project_knowledge に「基本事実」として同期する。
 *
 * 経緯 (まさ指摘 2026-05-11):
 *   つくよみが「p03 は 2022-03-01 に事業を終了」「p21 の設立日は 2027-04」のような
 *   「事実情報」を会話で発言するのに、project_knowledge 側にこれらが入ってない =
 *   ナレッジが分散しユーザーが PJ ナレッジを見ても基本情報が分からない、不整合。
 *
 * 修正:
 *   project_ventures の 基本フィールドを毎回同期 → project_knowledge に
 *   category='basic_fact' で保存 → /admin/contexts や cockpit から見える。
 *
 * cron: daily 04:00 JST 想定。手動キックでも安全 (= 冪等)。
 */

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

const OUTCOME_LABEL: Record<string, string> = {
  active: "現行 PJ (活動中)",
  burnout: "解散 (バーンアウト)",
  ue_fail: "解散 (UE 不成立)",
  smb: "中小企業転換 (継続中、SU exit せず)",
  exit_ipo: "IPO Exit",
  exit_ma: "M&A Exit",
  planning: "計画段階 (法人設立前)",
  paused: "一時休止",
};

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const db = createAdminClient();

  const { data: ventures, error: vErr } = await db
    .from("project_ventures")
    .select("project_id, founded_at, outcome_pattern, amd_support_started_at, amd_support_ended_at, origin_org, origin_pi, lane, projects(project_name)");
  if (vErr) return NextResponse.json({ ok: false, error: vErr.message }, { status: 500 });

  type V = {
    project_id: string;
    projects: { project_name: string | null } | { project_name: string | null }[] | null;
    founded_at: string | null;
    outcome_pattern: string | null;
    amd_support_started_at: string | null;
    amd_support_ended_at: string | null;
    origin_org: string | null;
    origin_pi: string | null;
    lane: string | null;
  };
  const list = (ventures ?? []) as V[];
  let totalSynced = 0;

  for (const v of list) {
    const project = Array.isArray(v.projects) ? v.projects[0] : v.projects;
    // 既存の自動同期 row を削除 (= 毎回上書き)
    await db
      .from("project_knowledge")
      .delete()
      .eq("project_id", v.project_id)
      .eq("source", "pj_basic_facts_sync");

    const rows: Array<Record<string, unknown>> = [];
    const push = (entity: string, fact: string | null) => {
      if (!fact) return;
      rows.push({
        project_id: v.project_id,
        category: "basic_fact",
        entity_name: entity,
        fact_text: fact,
        confidence: "high",
        source: "pj_basic_facts_sync",
        status: "active",
      });
    };
    push("PJ名", project?.project_name?.trim() || v.project_id);
    push("起源組織", v.origin_org);
    push("PI / 研究者", v.origin_pi);
    push("レーン", v.lane);
    push("法人設立日", v.founded_at);
    push("AMD 参画開始日", v.amd_support_started_at);
    push("AMD 参画終了日", v.amd_support_ended_at);
    if (v.outcome_pattern) {
      push(
        "事業継続パターン (outcome_pattern)",
        `${v.outcome_pattern} (${OUTCOME_LABEL[v.outcome_pattern] ?? "未定義"})`
      );
    }
    if (rows.length > 0) {
      const { error } = await db.from("project_knowledge").insert(rows);
      if (!error) totalSynced += rows.length;
    }
  }

  return NextResponse.json({
    ok: true,
    projects: list.length,
    synced_rows: totalSynced,
  });
}
