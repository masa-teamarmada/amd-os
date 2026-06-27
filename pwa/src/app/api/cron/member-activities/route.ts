/**
 * GET /api/cron/member-activities
 *
 * 全アクティブPJの「進捗イベント」推論を実行し member_activities (source='inferred') に書き込む。
 *
 * 2026-05-12 全面改修 (= 旧 GAS gas/054_RewardScoring_EventExtract.js の精度を復元):
 *   - LLM Haiku → Sonnet 4.6 に格上げ
 *   - system prompt を llm_prompts.member_activities.extract から fetch (= AGENTS 絶対ルール遵守)
 *   - 入力ソース拡張: monthly_reports + project_meeting_summaries + source_cache refs (= 5 生データ集約) を渡す
 *   - 出力スキーマに initiative_origin / impact / depth / responsibilities を追加
 *   - plan_cycle 必須を緩和 (= MS 期未設定の PJ でも events を抽出する)
 *
 * Vercel Cron: 毎日 04:00 JST (19:00 UTC) — vercel.json schedule "0 19 * * *"
 * 認証: Authorization: Bearer CRON_SECRET
 * 手動再抽出: ?ym=YYYYMM&projectId=p21 で対象を絞れる
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
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

const VALID_ORIGINS = new Set([
  "amd_proposed",
  "co_decided",
  "partner_proposed",
  "external",
  "unknown",
]);

interface InferredActivity {
  memberId: string | null;
  milestoneId: string | null;
  title: string;
  contentPreview: string;
  initiativeOrigin: string;
  impact: number | null;
  depth: number | null;
  responsibilities: Array<{ memberId: string; responsibility: number }>;
}

interface PromptRow {
  body: string;
  model: string | null;
  max_tokens: number | null;
  is_active: boolean;
}

interface AliasProfile {
  projectId: string;
  aliases: string[];
}

function normalizeAlias(value: unknown) {
  return String(value || "")
    .replace(/[（）()[\]【】「」『』"'`]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function addAlias(set: Set<string>, value: unknown) {
  const normalized = normalizeAlias(value);
  if (!normalized) return;
  if (/^[a-z0-9_-]{1,3}$/i.test(normalized)) return;
  if (normalized.length < 3 && !/[ぁ-んァ-ヶ一-龠]/.test(normalized)) return;
  set.add(normalized);
}

async function loadAliasProfiles(supabase: SupabaseClient): Promise<AliasProfile[]> {
  const [{ data: projects }, { data: ventures }] = await Promise.all([
    supabase.from("projects").select("project_id, project_name, client_name"),
    supabase.from("project_ventures").select("project_id, origin_org, origin_pi"),
  ]);
  const { data: knowledgeAliases } = await supabase
    .from("project_knowledge")
    .select("project_id, entity_name, fact_text")
    .eq("category", "alias")
    .eq("status", "active");
  const ventureByProject = new Map<string, Array<Record<string, unknown>>>();
  for (const venture of (ventures ?? []) as Array<Record<string, unknown>>) {
    const projectId = String(venture.project_id || "");
    const list = ventureByProject.get(projectId) || [];
    list.push(venture);
    ventureByProject.set(projectId, list);
  }
  return ((projects ?? []) as Array<Record<string, unknown>>).map((project) => {
    const projectId = String(project.project_id || "");
    const aliases = new Set<string>();
    addAlias(aliases, project.project_name);
    addAlias(aliases, project.client_name);
    for (const venture of ventureByProject.get(projectId) || []) {
      addAlias(aliases, venture.origin_org);
      addAlias(aliases, venture.origin_pi);
    }
    for (const alias of (knowledgeAliases ?? []) as Array<Record<string, unknown>>) {
      if (String(alias.project_id || "") !== projectId) continue;
      addAlias(aliases, alias.entity_name);
      addAlias(aliases, alias.fact_text);
    }
    return { projectId, aliases: [...aliases] };
  });
}

function textFitsProject(text: string, projectId: string, profiles: AliasProfile[]) {
  const normalized = normalizeAlias(text);
  if (!normalized) return true;
  const current = profiles.find((profile) => profile.projectId === projectId);
  const currentHits = (current?.aliases || []).filter((alias) => normalized.includes(alias));
  const otherHits = profiles
    .filter((profile) => profile.projectId !== projectId)
    .flatMap((profile) => profile.aliases
      .filter((alias) => normalized.includes(alias))
      .map((alias) => ({ projectId: profile.projectId, alias })));
  if (otherHits.length > 0 && currentHits.length === 0) return false;
  if (otherHits.length >= 2 && otherHits.length > currentHits.length) return false;
  return true;
}

async function loadExtractPrompt(supabase: SupabaseClient): Promise<PromptRow | null> {
  const { data } = await supabase
    .from("llm_prompts")
    .select("body, model, max_tokens, is_active")
    .eq("prompt_key", "member_activities.extract")
    .limit(1)
    .single();
  if (!data) return null;
  if (!data.is_active || !data.body || !String(data.body).trim()) return null;
  return data as PromptRow;
}

/** 1 PJ × ym の events 抽出 */
async function inferActivities(
  projectId: string,
  ym: string,
  supabase: SupabaseClient,
  anthropic: Anthropic,
  systemPrompt: PromptRow,
  aliasProfiles: AliasProfile[]
): Promise<{ ok: boolean; saved: number; message?: string }> {
  // 1) monthly_report 本文 (final or draft)
  const { data: reports } = await supabase
    .from("monthly_reports")
    .select("final_content, draft_content, status")
    .eq("project_id", projectId)
    .eq("ym", ym)
    .neq("status", "invalid")
    .limit(1);
  const report = reports?.[0];
  const rawReportContent = (report?.final_content || report?.draft_content || "").trim();
  const reportContent = textFitsProject(rawReportContent, projectId, aliasProfiles) ? rawReportContent : "";

  // 2) 当月 MTG サマリ集 (= 5 生データ集約結果。events 件数の主供給源)
  const { data: meetings } = await supabase
    .from("project_meeting_summaries")
    .select("meeting_date, title, summary_short, decided, progress, next_actions, risks")
    .eq("project_id", projectId)
    .eq("ym", ym)
    .order("meeting_date", { ascending: true })
    .limit(60);

  // 3) PJ name
  const { data: projectRow } = await supabase
    .from("projects")
    .select("project_name")
    .eq("project_id", projectId)
    .limit(1)
    .single();
  const projectName = projectRow?.project_name || projectId;

  // 4) PJ メンバー一覧 (= project_members、active のみ)
  const { data: pjMembers } = await supabase
    .from("project_members")
    .select("member_id, role")
    .eq("project_id", projectId);
  const memberIdSet = new Set((pjMembers ?? []).map((m: { member_id: string }) => m.member_id));

  let memberLines = "（メンバー情報なし）";
  const memberCodeNames: Record<string, string> = {};
  const codeNameToMemberId: Record<string, string> = {};
  if (memberIdSet.size > 0) {
    const { data: members } = await supabase
      .from("members")
      .select("member_id, code_name, role")
      .in("member_id", Array.from(memberIdSet));
    (members ?? []).forEach((m: { member_id: string; code_name: string | null; role: string | null }) => {
      memberCodeNames[m.member_id] = m.code_name || m.member_id;
      if (m.code_name) codeNameToMemberId[m.code_name] = m.member_id;
    });
    const pjRoleByMid: Record<string, string> = {};
    (pjMembers ?? []).forEach((m: { member_id: string; role: string | null }) => {
      if (m.role) pjRoleByMid[m.member_id] = m.role;
    });
    memberLines = (members ?? [])
      .map((m: { member_id: string; code_name: string | null; role: string | null }) =>
        `- memberId=${m.member_id} / 名前=${m.code_name || m.member_id} / 役割=${pjRoleByMid[m.member_id] || m.role || "member"}`
      )
      .join("\n");
  }

  // 5) MS 一覧 (= plan_cycle が無くても OK、空なら memberId 主体で抽出)
  const { data: planCycles } = await supabase
    .from("value_plan_cycles")
    .select("plan_cycle_id")
    .eq("project_id", projectId)
    .lte("period_start_ym", ym)
    .gte("period_end_ym", ym)
    .limit(1);
  const planCycleId = planCycles?.[0]?.plan_cycle_id ?? null;

  let milestoneLines = "（MS 期未設定 / 該当 MS なし。milestoneId は null で OK）";
  if (planCycleId) {
    const { data: milestones } = await supabase
      .from("value_milestones")
      .select("milestone_id, title")
      .eq("plan_cycle_id", planCycleId)
      .eq("is_active", true);
    if (milestones && milestones.length > 0) {
      milestoneLines = milestones
        .map((m: { milestone_id: string; title: string }) => `- ${m.milestone_id}: ${m.title}`)
        .join("\n");
    }
  }

  // 6) MTG サマリをテキスト化
  const safeMeetings = (meetings ?? []).filter((mt: {
    title: string;
    summary_short: string;
    decided: unknown;
    progress: unknown;
    next_actions: unknown;
    risks: unknown;
  }) => textFitsProject(JSON.stringify(mt), projectId, aliasProfiles));
  const meetingBlock = safeMeetings
    .map((mt: {
      meeting_date: string;
      title: string;
      summary_short: string;
      decided: unknown;
      progress: unknown;
      next_actions: unknown;
      risks: unknown;
    }) => {
      const dec = Array.isArray(mt.decided) ? (mt.decided as string[]).filter(Boolean) : [];
      const prg = Array.isArray(mt.progress) ? (mt.progress as string[]).filter(Boolean) : [];
      const nxt = Array.isArray(mt.next_actions) ? (mt.next_actions as string[]).filter(Boolean) : [];
      const rsk = Array.isArray(mt.risks) ? (mt.risks as string[]).filter(Boolean) : [];
      const parts = [
        `### ${mt.meeting_date} ${mt.title}`,
        mt.summary_short ? `要約: ${mt.summary_short}` : "",
        dec.length ? `決定: ${dec.join(" / ")}` : "",
        prg.length ? `進捗: ${prg.join(" / ")}` : "",
        nxt.length ? `次アクション: ${nxt.join(" / ")}` : "",
        rsk.length ? `リスク: ${rsk.join(" / ")}` : "",
      ].filter(Boolean);
      return parts.join("\n");
    })
    .join("\n\n")
    .slice(0, 8000); // Sonnet input 抑制 (= 月 60 件 meeting でも安全)

  // 7) source_cache refs (= Gmail/Slack/Drive等の短い根拠キャッシュ)
  const { data: sourceRefs } = await supabase
    .from("source_cache")
    .select("source, title, item_date, content_text, metadata_json")
    .eq("project_id", projectId)
    .eq("ym", ym)
    .order("item_date", { ascending: true })
    .limit(80);

  const safeSourceRefs = (sourceRefs ?? []).filter((src: {
    source: string;
    title: string | null;
    item_date: string | null;
    content_text: string | null;
    metadata_json: { source_url?: string; permalink?: string } | null;
  }) => textFitsProject(`${src.title || ""}\n${src.content_text || ""}\n${JSON.stringify(src.metadata_json || {})}`, projectId, aliasProfiles));

  const sourceRefBlock = safeSourceRefs
    .map((src: {
      source: string;
      title: string | null;
      item_date: string | null;
      content_text: string | null;
      metadata_json: { source_url?: string; permalink?: string } | null;
    }) => {
      const sourceUrl = src.metadata_json?.source_url || src.metadata_json?.permalink || "";
      return [
        `### ${src.source || "source"} ${src.item_date || ""} ${src.title || ""}`.trim(),
        sourceUrl ? `source_url: ${sourceUrl}` : "",
        String(src.content_text || "").replace(/\s+/g, " ").trim().slice(0, 700),
      ].filter(Boolean).join("\n");
    })
    .join("\n\n")
    .slice(0, 8000);

  // 抽出ソースが全部空ならスキップ
  if (!reportContent && (!meetings || meetings.length === 0) && !sourceRefBlock) {
    return { ok: true, saved: 0, message: "no source content (no report / no meetings / no source refs)" };
  }

  const userPrompt =
    `## PJ 情報\n` +
    `- projectId: ${projectId}\n` +
    `- PJ 名: ${projectName}\n` +
    `- 対象月: ${ym}\n\n` +
    `## メンバー一覧\n${memberLines}\n\n` +
    `## 設定済み MS (plan_cycle が今月をカバーしているもの)\n${milestoneLines}\n\n` +
    `## 月次レポート (${ym.slice(0, 4)}年${ym.slice(4)}月)\n${reportContent ? reportContent.slice(0, 4000) : "（月次レポート未生成）"}\n\n` +
    `## 当月の MTG サマリ集 (= 5 生データから抽出済の議事録)\n${meetingBlock || "（当月 MTG サマリなし）"}\n\n` +
    `## 当月の source refs (= Gmail/Slack/Drive等の短い根拠キャッシュ)\n${sourceRefBlock || "（当月 source refs なし）"}\n\n` +
    `上記の月次レポート + MTG サマリ + source refs から「今月起きた進捗イベント」を抽出してください。\n` +
    `system prompt の抽出ルール (initiative_origin 必須付与、判断不能は unknown、推測禁止) に従ってください。`;

  // 8) Sonnet 呼び出し
  let inferred: InferredActivity[] = [];
  try {
    const response = await anthropic.messages.create({
      model: systemPrompt.model || "claude-sonnet-4-6",
      max_tokens: systemPrompt.max_tokens || 4096,
      system: systemPrompt.body,
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const cleaned = text
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const raw = Array.isArray(parsed.activities) ? parsed.activities : [];

      type RawAct = {
        memberId?: string | null;
        milestoneId?: string | null;
        title?: string;
        contentPreview?: string;
        initiativeOrigin?: string;
        impact?: number;
        depth?: number;
        responsibilities?: Array<{ memberId?: string; responsibility?: number }>;
      };

      inferred = raw
        .map((a: RawAct): InferredActivity | null => {
          if (!a || !a.title) return null;

          const normalizeMid = (raw: string | null | undefined): string | null => {
            if (!raw) return null;
            const s = String(raw).trim();
            if (!s || s.toLowerCase() === "null") return null;
            if (codeNameToMemberId[s]) return codeNameToMemberId[s];
            if (memberIdSet.has(s)) return s;
            return null;
          };

          const memberId = normalizeMid(a.memberId);
          let milestoneId: string | null = null;
          if (a.milestoneId && String(a.milestoneId).trim() && String(a.milestoneId).toLowerCase() !== "null") {
            milestoneId = String(a.milestoneId).trim();
          }

          let origin = String(a.initiativeOrigin || "unknown").trim();
          if (origin === "client_requested") origin = "partner_proposed";
          if (!VALID_ORIGINS.has(origin)) origin = "unknown";

          const impact = typeof a.impact === "number" && a.impact >= 1 && a.impact <= 5 ? Math.round(a.impact) : null;
          const depth = typeof a.depth === "number" && (a.depth === 0 || a.depth === 1) ? a.depth : null;

          const resp = Array.isArray(a.responsibilities)
            ? a.responsibilities
                .map((r) => ({
                  memberId: normalizeMid(r.memberId),
                  responsibility: typeof r.responsibility === "number" ? r.responsibility : 0,
                }))
                .filter((r): r is { memberId: string; responsibility: number } =>
                  !!r.memberId && r.responsibility > 0
                )
            : [];

          return {
            memberId,
            milestoneId,
            title: String(a.title).slice(0, 120),
            contentPreview: String(a.contentPreview || "").slice(0, 400),
            initiativeOrigin: origin,
            impact,
            depth,
            responsibilities: resp,
          };
        })
        .filter((a: InferredActivity | null): a is InferredActivity => !!a);
    }
  } catch (err) {
    console.error(`[member-activities] LLM error projectId=${projectId} ym=${ym}:`, err);
    return { ok: false, saved: 0, message: `LLM error: ${err instanceof Error ? err.message : String(err)}` };
  }

  if (inferred.length === 0) {
    return { ok: true, saved: 0, message: "no activities inferred" };
  }

  // 8) 既存の inferred を delete → 再 insert (= 冪等)
  await supabase
    .from("member_activities")
    .delete()
    .eq("project_id", projectId)
    .eq("ym", ym)
    .eq("source", "inferred");

  const rows = inferred.map((a, i) => ({
    member_id: a.memberId,
    project_id: projectId,
    ym,
    source: "inferred",
    source_item_id: `inferred-${ym}-${i}`,
    milestone_id: a.milestoneId,
    title: a.title,
    content_preview: a.contentPreview,
    initiative_origin: a.initiativeOrigin,
    impact: a.impact,
    depth: a.depth,
    raw_metadata: a.responsibilities.length > 0 ? { responsibilities: a.responsibilities } : null,
  }));

  const { error: insertError } = await supabase.from("member_activities").insert(rows);
  if (insertError) {
    console.error(`[member-activities] insert error projectId=${projectId} ym=${ym}:`, insertError);
    return { ok: false, saved: 0, message: insertError.message };
  }

  return { ok: true, saved: rows.length };
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });
  }

  const supabase = getServiceClient();
  const anthropic = new Anthropic({ apiKey: anthropicKey });

  const systemPrompt = await loadExtractPrompt(supabase);
  if (!systemPrompt) {
    return NextResponse.json(
      {
        error: "llm_prompts.member_activities.extract が is_active=false / body 空。/admin/prompts で本文を入力してください",
      },
      { status: 500 }
    );
  }

  const ymParam = req.nextUrl.searchParams.get("ym");
  const ym = ymParam && /^\d{6}$/.test(ymParam) ? ymParam : currentYmJST();
  const projectIdParam = req.nextUrl.searchParams.get("projectId");

  let projectIds: string[] = [];
  if (projectIdParam) {
    projectIds = [projectIdParam];
  } else {
	    const { data: projects, error } = await supabase
	      .from("projects")
	      .select("project_id")
	      .or("status.eq.active,project_category.eq.advisor");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    projectIds = (projects ?? []).map((p: { project_id: string }) => p.project_id);
  }

  if (projectIds.length === 0) {
    return NextResponse.json({ ok: true, ym, ran: 0, message: "no target projects" });
  }

  const aliasProfiles = await loadAliasProfiles(supabase);
  const results: Array<{ projectId: string; ok: boolean; saved: number; message?: string }> = [];
  for (const projectId of projectIds) {
    try {
      const r = await inferActivities(projectId, ym, supabase, anthropic, systemPrompt, aliasProfiles);
      results.push({ projectId, ok: r.ok, saved: r.saved, message: r.message });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[cron/member-activities] projectId=${projectId} fatal:`, msg);
      results.push({ projectId, ok: false, saved: 0, message: msg });
    }
  }

  return NextResponse.json({
    ok: true,
    ym,
    ran: results.length,
    succeeded: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    totalSaved: results.reduce((sum, r) => sum + (r.saved || 0), 0),
    results,
  });
}
