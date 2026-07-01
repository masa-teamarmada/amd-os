/**
 * AMD Score L2 抽出 orchestrator (Vercel cron 用)
 *
 * 1 PJ について 6 ソース (Slack/Drive/Notion/Gmail/Calendar/WebSearch) から生データを集めて、
 * Sonnet 4.5 で AMD Score timeline (μ_A/μ_I/μ_G + 5 XRL + FRL/ALQ) を抽出し、
 * amd_score_inputs に upsert する。
 *
 * 設計詳細: pwa/design_log/2026-05_amd_score.md「過去分一括抽出 (2026-05-07 batch)」セクション
 * 一括スクリプト版: pwa/scripts/extract_amd_score_from_l2.py
 */

import { getBackgroundAnthropic } from "@/lib/anthropic-client";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchSlackContext, fetchSlackChannelHistory, type SlackHit } from "@/lib/sources/slack";
import { fetchNotionContext, type NotionHit } from "@/lib/sources/notion";
import { fetchDriveContext, type DriveHit } from "@/lib/sources/drive";
import { fetchGmailContext, type GmailHit } from "@/lib/sources/gmail";
import { fetchCalendarContext, type CalendarHit } from "@/lib/sources/calendar";
import { fetchWebSearchContext } from "@/lib/sources/web-search";

const SYSTEM_PROMPT = `あなたは AMD OS (Before Zero Theory v3.2) の AMD Score を生データから抽出する専門家。

# AMD Score 7 軸 (各 0-9)
- σ_SU は μ_A (学術), μ_I (産業), μ_G (政府) から自動算出: σ_SU = ((μ_A+1)(μ_I+1)(μ_G+1))^(1/3) - 1
- TRL: 技術成熟度 (NASA / 内閣府 SIP 9 段階互換)
- BRL: Business Readiness — 事業仮説 → 顧客IV → PoC → 有償 PoC → 本契約 → リピート → 拡大期
- GRL: Governance — 規制マップ → ヒアリング → 認可申請 → 取得 → 標準化
- SRL: Social — 受容性調査 → 社会実装試行 → メディア → ファン化 → 業界アライアンス → 政策影響
- HRL: Human Resources — 発案者単独 → コア参画 → 技術リード → 事業リード → 管理体制 → 営業組織
- FRL: Founder Readiness — CEO 候補識別 → ALQ ベース基礎 → 投資家信頼 → 業界認知 → 社会的影響力

# FRL の構成 (Walumbwa 2008 ALQ 4 次元、各 0-9)
- alq_self_awareness: 自己認識
- alq_relational_transparency: 関係透明性
- alq_balanced_processing: 均衡的処理
- alq_internalized_moral: 内在化された道徳観
- frl_notes: 自由記述

# Shallow Tech モード
自社独自技術なし、他社既存技術を IoT/SaaS 化 → trl=null, shallow_tech_mode=true

# Timeline 評価点の選び方 (4-10 個程度)
- AMD 関与開始時 / 設立日 / 主要資金調達 / PoC milestone / メディア露出ピーク / CEO 移譲 / 等

# 出力フォーマット (厳密に JSON、他の文字一切禁止)
{
  "project_id": "<同じ project_id>",
  "timeline": [
    { "evaluated_at": "YYYY-MM-DD", "mu_A": 0-9, "mu_I": 0-9, "mu_G": 0-9,
      "trl": 0-9 or null, "brl": 0-9, "grl": 0-9, "srl": 0-9, "hrl": 0-9, "frl": 0-9,
      "alq_self_awareness": 0-9 or null, "alq_relational_transparency": 0-9 or null,
      "alq_balanced_processing": 0-9 or null, "alq_internalized_moral": 0-9 or null,
      "frl_notes": "<ALQ で拾えない FRL 要素>",
      "shallow_tech_mode": false,
      "notes": "<このタイミングを選んだ理由 + 主要根拠 1-2 行>" },
    ...
  ],
  "summary": "<全体の動向 2-3 行>",
  "uncertainty": "<推定根拠が弱い箇所>"
}`;

interface PjInfo {
  project_id: string;
  display_name: string;
  origin_org: string | null;
  origin_pi: string | null;
  founded_at: string | null;
  amd_role: string | null;
  amd_support_started_at: string | null;
  amd_support_ended_at: string | null;
  short_description: string | null;
  outcome_pattern: string;
  lane: string;
}

interface RawBundle {
  pj: PjInfo;
  existingInputs: unknown[];
  existingNarrative: string | null;
  slack: SlackHit[];
  notion: NotionHit[];
  drive: DriveHit[];
  gmail: GmailHit[];
  calendar: CalendarHit[];
  webSearchSummary: string;
}

export interface ExtractResult {
  project_id: string;
  upserted: number;
  summary: string;
  uncertainty: string;
  errors: string[];
}

async function loadPjInfo(supabase: ReturnType<typeof createAdminClient>, projectId: string): Promise<PjInfo | null> {
  const { data: v, error } = await supabase
    .from("project_ventures")
    .select("project_id, display_name, lane, origin_org, origin_pi, founded_at, amd_role, amd_support_started_at, amd_support_ended_at, short_description, outcome_pattern")
    .eq("project_id", projectId)
    .maybeSingle();
  if (error || !v) return null;
  return v as unknown as PjInfo;
}

async function loadProjectCategory(supabase: ReturnType<typeof createAdminClient>, projectId: string): Promise<string> {
  const { data } = await supabase
    .from("projects")
    .select("project_category")
    .eq("project_id", projectId)
    .maybeSingle();
  return ((data as { project_category?: string } | null)?.project_category) || "dtsu";
}

async function loadExistingInputs(supabase: ReturnType<typeof createAdminClient>, projectId: string) {
  const { data } = await supabase
    .from("amd_score_inputs")
    .select("evaluated_at, mu_a, mu_i, mu_g, trl, brl, grl, srl, hrl, frl, shallow_tech_mode, notes, evaluator")
    .eq("project_id", projectId)
    .order("evaluated_at", { ascending: true });
  return data ?? [];
}

async function loadNarrative(supabase: ReturnType<typeof createAdminClient>, projectId: string): Promise<string | null> {
  const { data } = await supabase
    .from("project_ventures")
    .select("narrative_text")
    .eq("project_id", projectId)
    .maybeSingle();
  return ((data as { narrative_text?: string } | null)?.narrative_text) ?? null;
}

function buildSearchQuery(pj: PjInfo): { full: string; keywords: string[]; slackChannelPatterns: string[] } {
  const name = pj.display_name;
  const origin = pj.origin_org ?? "";
  const keywords = [name, origin].filter(Boolean);
  return {
    full: name,
    keywords,
    slackChannelPatterns: [pj.project_id, name.toLowerCase()],
  };
}

async function gatherRaw(pj: PjInfo, supabase: ReturnType<typeof createAdminClient>): Promise<RawBundle> {
  const q = buildSearchQuery(pj);
  const [existingInputs, existingNarrative, slackHits, slackHistory, notion, drive, gmail, calendar, webSearch] =
    await Promise.all([
      loadExistingInputs(supabase, pj.project_id),
      loadNarrative(supabase, pj.project_id),
      fetchSlackContext(q.full, 20),
      fetchSlackChannelHistory(q.slackChannelPatterns, 30),
      fetchNotionContext(q.full, 8),
      fetchDriveContext(q.full, 6),
      fetchGmailContext(q.full, 12),
      fetchCalendarContext(q.full, { limit: 25 }),
      fetchWebSearchContext(pj.display_name, q.keywords),
    ]);
  // dedupe slack
  const slackMap = new Map<string, SlackHit>();
  for (const h of [...slackHits, ...slackHistory]) {
    slackMap.set(h.ts + ":" + h.channel, h);
  }
  return {
    pj,
    existingInputs,
    existingNarrative,
    slack: Array.from(slackMap.values()).slice(0, 40),
    notion,
    drive,
    gmail,
    calendar,
    webSearchSummary: webSearch,
  };
}

function rawToPrompt(b: RawBundle): string {
  const sec = (title: string, body: string) => `\n\n## ${title}\n${body}`;
  let s = `# project_id\n${b.pj.project_id}\n\n# 基本情報\n${JSON.stringify(b.pj, null, 2)}`;

  if (b.existingNarrative) s += sec("既存沿革 (project_ventures.narrative_text)", b.existingNarrative.slice(0, 3000));

  if (b.existingInputs.length > 0) {
    s += sec(
      `既存 amd_score_inputs (${b.existingInputs.length} 件)`,
      JSON.stringify(b.existingInputs, null, 2)
    );
  }

  if (b.notion.length > 0) {
    s += sec(
      `Notion (${b.notion.length} ページ)`,
      b.notion
        .map((p) => `### ${p.title} (${p.last_edited?.slice(0, 10) ?? "?"})\n${p.text}`)
        .join("\n\n")
    );
  }

  if (b.slack.length > 0) {
    s += sec(
      `Slack (${b.slack.length} メッセージ)`,
      b.slack
        .map((h) => `[#${h.channel} @${new Date(parseInt(h.ts) * 1000).toISOString().slice(0, 10)}] ${h.text.slice(0, 300)}`)
        .join("\n")
    );
  }

  if (b.drive.length > 0) {
    s += sec(
      `Drive (${b.drive.length} ファイル)`,
      b.drive
        .map((f) => `### ${f.name} (${f.mimeType}, ${f.modifiedTime?.slice(0, 10) ?? "?"})\n${f.text.slice(0, 1500)}`)
        .join("\n\n")
    );
  }

  if (b.gmail.length > 0) {
    s += sec(
      `Gmail (${b.gmail.length} メール)`,
      b.gmail
        .map((m) => `### ${m.subject ?? "(件名なし)"} - ${m.from ?? ""} - ${m.date ?? ""}\n${m.body.slice(0, 800)}`)
        .join("\n\n")
    );
  }

  if (b.calendar.length > 0) {
    s += sec(
      `Calendar (${b.calendar.length} イベント)`,
      b.calendar
        .map((e) => `${e.start?.slice(0, 10) ?? "?"}: ${e.summary} (${e.attendees.length}名) ${e.location ?? ""}`)
        .join("\n")
    );
  }

  if (b.webSearchSummary) s += sec("WebSearch 結果 (Anthropic web_search)", b.webSearchSummary);

  s += `\n\n上記 ${b.pj.project_id} (${b.pj.display_name}) について、AMD Score timeline を JSON で出してください。`;
  return s;
}

interface ExtractedTimelineRow {
  evaluated_at: string;
  mu_A?: number; mu_I?: number; mu_G?: number;
  trl?: number | null; brl?: number; grl?: number; srl?: number; hrl?: number; frl?: number;
  alq_self_awareness?: number | null;
  alq_relational_transparency?: number | null;
  alq_balanced_processing?: number | null;
  alq_internalized_moral?: number | null;
  frl_notes?: string;
  shallow_tech_mode?: boolean;
  notes?: string;
}

interface ExtractedJson {
  project_id?: string;
  timeline?: ExtractedTimelineRow[];
  summary?: string;
  uncertainty?: string;
}

function parseLlmJson(text: string): ExtractedJson | null {
  // ```json ... ``` ブロック取り出し
  const fenced = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  const target = fenced ? fenced[1] : text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  try {
    return JSON.parse(target);
  } catch (e) {
    console.error("[l2-extract] JSON parse failed:", e);
    return null;
  }
}

async function callSonnet(prompt: string): Promise<ExtractedJson | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("[l2-extract] ANTHROPIC_API_KEY not set");
    return null;
  }
  const anthropic = getBackgroundAnthropic("lib/amd-score-l2-extract");
  const r = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
  });
  const text = r.content
    .filter((c) => c.type === "text")
    .map((c) => (c as { type: "text"; text: string }).text)
    .join("\n");
  return parseLlmJson(text);
}

async function upsertTimeline(
  supabase: ReturnType<typeof createAdminClient>,
  projectId: string,
  timeline: ExtractedTimelineRow[]
): Promise<number> {
  let n = 0;
  for (const r of timeline) {
    const evaluated = r.evaluated_at;
    if (!evaluated) continue;
    const payload: Record<string, unknown> = {
      project_id: projectId,
      evaluated_at: evaluated + (evaluated.length === 10 ? "T00:00:00Z" : ""),
      mu_a: r.mu_A ?? null,
      mu_i: r.mu_I ?? null,
      mu_g: r.mu_G ?? null,
      trl: r.trl ?? null,
      brl: r.brl ?? null,
      grl: r.grl ?? null,
      srl: r.srl ?? null,
      hrl: r.hrl ?? null,
      frl: r.frl ?? null,
      alq_self_awareness: r.alq_self_awareness ?? null,
      alq_relational_transparency: r.alq_relational_transparency ?? null,
      alq_balanced_processing: r.alq_balanced_processing ?? null,
      alq_internalized_moral: r.alq_internalized_moral ?? null,
      frl_notes: r.frl_notes ?? null,
      shallow_tech_mode: !!r.shallow_tech_mode,
      evaluator: "cron_l2_extract",
      notes: r.notes ?? null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("amd_score_inputs").upsert(payload, { onConflict: "project_id,evaluated_at" });
    if (error) {
      console.error(`[l2-extract:${projectId}] upsert ${evaluated} failed:`, error);
      continue;
    }
    n += 1;
  }
  return n;
}

export async function extractAmdScoreForPj(projectId: string): Promise<ExtractResult> {
  const supabase = createAdminClient();
  const errors: string[] = [];

  const category = await loadProjectCategory(supabase, projectId);
  if (category === "ecosystem") {
    return { project_id: projectId, upserted: 0, summary: "skipped: ecosystem project", uncertainty: "", errors: [] };
  }

  const pj = await loadPjInfo(supabase, projectId);
  if (!pj) {
    return { project_id: projectId, upserted: 0, summary: "", uncertainty: "", errors: ["PJ not found in project_ventures"] };
  }

  let bundle: RawBundle;
  try {
    bundle = await gatherRaw(pj, supabase);
  } catch (e) {
    errors.push(`gatherRaw failed: ${String(e)}`);
    return { project_id: projectId, upserted: 0, summary: "", uncertainty: "", errors };
  }

  const prompt = rawToPrompt(bundle);

  let parsed: ExtractedJson | null;
  try {
    parsed = await callSonnet(prompt);
  } catch (e) {
    errors.push(`Sonnet call failed: ${String(e)}`);
    return { project_id: projectId, upserted: 0, summary: "", uncertainty: "", errors };
  }
  if (!parsed || !parsed.timeline) {
    errors.push("Sonnet returned no parseable timeline");
    return { project_id: projectId, upserted: 0, summary: "", uncertainty: "", errors };
  }

  const upserted = await upsertTimeline(supabase, projectId, parsed.timeline);
  return {
    project_id: projectId,
    upserted,
    summary: parsed.summary ?? "",
    uncertainty: parsed.uncertainty ?? "",
    errors,
  };
}

/** 全 SU 系 PJ について順次抽出 (Vercel Hobby 300s 上限に注意) */
export async function extractAmdScoreForAllPjs(): Promise<ExtractResult[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("project_ventures")
    .select("project_id")
    .order("project_id", { ascending: true });
  if (error || !data) {
    console.error("[l2-extract] failed to list PJs:", error);
    return [];
  }
  const projectIds = (data as Array<{ project_id: string }>).map((row) => row.project_id);
  const { data: projectRows } = projectIds.length
    ? await supabase.from("projects").select("project_id, project_category").in("project_id", projectIds)
    : { data: [] };
  const categoryByProject = new Map(
    ((projectRows ?? []) as Array<{ project_id: string; project_category: string | null }>).map((row) => [
      row.project_id,
      row.project_category || "dtsu",
    ])
  );
  const results: ExtractResult[] = [];
  for (const row of data) {
    const r = row as { project_id: string };
    if (categoryByProject.get(r.project_id) === "ecosystem") {
      results.push({ project_id: r.project_id, upserted: 0, summary: "skipped: ecosystem project", uncertainty: "", errors: [] });
      continue;
    }
    try {
      const res = await extractAmdScoreForPj(r.project_id);
      results.push(res);
    } catch (e) {
      results.push({ project_id: r.project_id, upserted: 0, summary: "", uncertainty: "", errors: [String(e)] });
    }
  }
  return results;
}
