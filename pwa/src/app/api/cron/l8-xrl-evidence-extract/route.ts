/**
 * L8 XRL 根拠抽出 cron — 6h ごと (L7 から +15 分)
 *
 * SKILL 正本: pwa/scheduled-tasks/amd-os-l8-xrl-evidence-extract/SKILL.md
 *
 * Phase 0: active non-ecosystem PJ (max 5) + ymList [当月, 前月]
 * Phase A: monthly_reports / meeting_summaries / project_knowledge /
 *          founding_members + 既存 evidence (重複防止) + l2_feedbacks
 * Phase B: Claude Haiku で axis × evidence_kind 根拠を JSON 抽出
 * Phase C: project_xrl_evidence に candidate INSERT + l2_notifications upsert
 *          + l2_feedbacks.applied_count++
 * Phase D: 1 行 summary 返却
 *
 * GET  /api/cron/l8-xrl-evidence-extract            — 全 PJ ループ
 * GET  /api/cron/l8-xrl-evidence-extract?project_id=p09 — 単一 PJ
 */

import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 300;
export const runtime = "nodejs";

const CREATED_BY = "claude_routine_l8";
const MAX_PJS = 5;

// ═══════════════════════════════════════════════════════════
// Phase 0 helpers
// ═══════════════════════════════════════════════════════════

/** JST で当月 / 前月の YYYYMM 文字列を返す */
function getYmList(): [string, string] {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const y = jst.getUTCFullYear();
  const m = jst.getUTCMonth() + 1;
  const cur = `${y}${String(m).padStart(2, "0")}`;
  const prevDate = new Date(Date.UTC(y, m - 2, 1)); // m-2 because getUTCMonth is 0-indexed
  const py = prevDate.getUTCFullYear();
  const pm = prevDate.getUTCMonth() + 1;
  return [cur, `${py}${String(pm).padStart(2, "0")}`];
}

/** source_hash 生成 (16 hex chars) */
function computeHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
}

// ═══════════════════════════════════════════════════════════
// Phase B: LLM system prompt
// ═══════════════════════════════════════════════════════════

const SYSTEM_PROMPT = `あなたは AMD OS の XRL 根拠 (L2 ⑧) 抽出専門家。

PJ の L2 ドキュメント群から TRL / BRL / GRL / SRL / HRL の算定根拠 (evidence) を抽出する。
スコアそのものは確定しない — 根拠だけを candidate として提出する。

## 軸と evidence_kind の対応
- trl: technical_validation / other
- brl: customer_signal / commercial_validation / other
- grl: grant_signal / governance_signal / other
- srl: stakeholder_signal / other
- hrl: founding_member / team_signal / other

## 絶対ルール
1. 根拠が明確な軸だけ出力 (5 軸すべて必須ではない)
2. summary は 200 chars 以内 (日本語 90 文字程度)
3. structured_value_json: 必要最小限 例: {"trl_level": 5, "evidence": "実証実験完了"}
4. source_refs_json: snippet 200 chars + ref_id + date + source_type のみ (全文禁止)
5. confidence: 0.0-1.0
6. past_feedbacks の指示は必ず反映する
7. HRL の founding_member: provided_founding_members の category が amd/startup/university のみ使用
   — VC / 顧客 / 行政 / partner_company は founding_member candidate に絶対含めない
8. existing_source_hashes に一致する source_hash は出力しない (重複防止)
9. スコア数値を直接確定しない

## 出力フォーマット (JSON のみ、前後の文字一切禁止)
{"evidences":[{"axis":"trl","evidence_kind":"technical_validation","summary":"...","structured_value_json":{"evidence":"..."},"source_refs_json":[{"source_type":"monthly_report","ref_id":"...","snippet":"...","date":"..."}],"confidence":0.8}]}`;

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

interface ProjectRow {
  project_id: string;
  project_name: string;
  project_category: string;
}

interface EvidenceItem {
  axis: string;
  evidence_kind: string;
  summary: string;
  structured_value_json: Record<string, unknown>;
  source_refs_json: Array<Record<string, string>>;
  confidence: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

// ═══════════════════════════════════════════════════════════
// Phase A + B + C-1 + C-3: 1 PJ × 1 ym
// ═══════════════════════════════════════════════════════════

async function processProjectYm(
  db: DB,
  anthropic: Anthropic,
  project: ProjectRow,
  ym: string
): Promise<{
  saved: number;
  skipped: number;
  axes: Record<string, number>;
  error?: string;
}> {
  const { project_id, project_name } = project;

  // ── A-1: 既存 L2 収集 ──────────────────────────────────

  const [reportsRes, meetingsRes, knowledgeRes, membersRes] = await Promise.all([
    // monthly_reports (当月 / 前月)
    db
      .from("monthly_reports")
      .select("report_id, ym, final_content, draft_content")
      .eq("project_id", project_id)
      .eq("ym", ym)
      .neq("status", "invalid")
      .limit(3),

    // project_meeting_summaries (当月 ym のみ、source_kinds が null 以外)
    db
      .from("project_meeting_summaries")
      .select(
        "meeting_id, meeting_date, title, summary_short, decided, progress, next_actions, risks"
      )
      .eq("project_id", project_id)
      .eq("ym", ym)
      .not("source_kinds", "is", null)
      .order("meeting_date", { ascending: false })
      .limit(30),

    // project_knowledge (active 全件、updated_at 降順)
    db
      .from("project_knowledge")
      .select("id, category, entity_name, fact_text, updated_at")
      .eq("project_id", project_id)
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(50),

    // project_founding_members (HRL 根拠候補: amd/startup/university のみ)
    db
      .from("project_founding_members")
      .select("id, person_name, category, role_label_jp, affiliation, contribution")
      .eq("project_id", project_id)
      .eq("status", "active")
      .in("category", ["amd", "startup", "university"]),
  ]);

  // ── A-3: 既存 evidence (重複防止) ──────────────────────

  const { data: existingEv } = await db
    .from("project_xrl_evidence")
    .select("source_hash")
    .eq("project_id", project_id)
    .eq("ym", ym)
    .limit(100);

  const existingHashes = new Set<string>(
    (existingEv ?? []).map((e: { source_hash: string }) => e.source_hash)
  );

  // ── A-4: l2_feedbacks (xrl_evidence / 当 PJ) ──────────

  const { data: feedbackRows } = await db
    .from("l2_feedbacks")
    .select("feedback_id, feedback_text, applied_count")
    .eq("l2_kind", "xrl_evidence")
    .eq("target_id", project_id)
    .eq("status", "active");

  const feedbacks: Array<{
    feedback_id: string;
    feedback_text: string;
    applied_count: number;
  }> = feedbackRows ?? [];

  // ── build docs block ─────────────────────────────────────

  const docParts: string[] = [];

  for (const r of (reportsRes.data ?? []) as {
    report_id: string;
    ym: string;
    final_content: string | null;
    draft_content: string | null;
  }[]) {
    const text = r.final_content ?? r.draft_content;
    if (text) {
      docParts.push(
        `--- 月次レポート ym=${r.ym} id=${r.report_id} ---\n${text.slice(0, 5000)}`
      );
    }
  }

  for (const m of (meetingsRes.data ?? []) as {
    meeting_id: string;
    meeting_date: string;
    title: string;
    summary_short: string;
    decided: unknown;
    progress: unknown;
    next_actions: unknown;
    risks: unknown;
  }[]) {
    const text = [
      `# MTG: ${m.title} (${m.meeting_date})`,
      m.summary_short ? `要約: ${m.summary_short}` : null,
      `決定: ${JSON.stringify(m.decided)}`,
      `進捗: ${JSON.stringify(m.progress)}`,
      `次アクション: ${JSON.stringify(m.next_actions)}`,
      `リスク: ${JSON.stringify(m.risks)}`,
    ]
      .filter(Boolean)
      .join("\n");
    docParts.push(`--- MTGサマリ id=${m.meeting_id} (${m.meeting_date}) ---\n${text}`);
  }

  for (const k of (knowledgeRes.data ?? []) as {
    id: string;
    category: string;
    entity_name: string;
    fact_text: string | null;
  }[]) {
    if (k.fact_text) {
      docParts.push(
        `--- PJナレッジ id=${k.id} [${k.category}] ${k.entity_name} ---\n${k.fact_text.slice(0, 1000)}`
      );
    }
  }

  const membersBlock = (membersRes.data ?? [])
    .map(
      (m: {
        person_name: string;
        category: string;
        role_label_jp: string | null;
        affiliation: string | null;
        contribution: string | null;
      }) =>
        `- ${m.person_name} (category=${m.category}, role=${m.role_label_jp ?? "?"}, ` +
        `affiliation=${m.affiliation ?? "?"})${m.contribution ? `: ${m.contribution}` : ""}`
    )
    .join("\n");

  if (docParts.length === 0 && !membersBlock) {
    return { saved: 0, skipped: 0, axes: {}, error: "no source data" };
  }

  const feedbackBlock =
    feedbacks.length > 0
      ? `\n## 過去フィードバック (必ず反映)\n${feedbacks.map((f) => `- ${f.feedback_text}`).join("\n")}`
      : "";

  const hashBlock =
    existingHashes.size > 0
      ? `\n## existing_source_hashes (重複禁止): [${Array.from(existingHashes).join(",")}]`
      : "";

  const userPrompt = `PJ: ${project_name} (project_id=${project_id}, ym=${ym})

## 関連メンバー (HRL 根拠候補, category=amd/startup/university のみ)
${membersBlock || "(なし)"}
${feedbackBlock}
${hashBlock}

## L2 ドキュメント
${docParts.slice(0, 20).join("\n\n").slice(0, 40000)}`;

  // ── Phase B: LLM 抽出 ────────────────────────────────────

  let extracted: EvidenceItem[] = [];
  try {
    const resp = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });
    const rawText = resp.content[0].type === "text" ? resp.content[0].text : "";
    const match = rawText.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]) as { evidences?: EvidenceItem[] };
      extracted = Array.isArray(parsed.evidences) ? parsed.evidences : [];
    }
  } catch (e) {
    return { saved: 0, skipped: 0, axes: {}, error: `LLM error: ${String(e)}` };
  }

  // ── Phase C-1: project_xrl_evidence INSERT ───────────────

  const VALID_AXES = new Set(["trl", "brl", "grl", "srl", "hrl"]);
  let saved = 0;
  let skipped = 0;
  const axes: Record<string, number> = {};

  for (const ev of extracted) {
    if (!VALID_AXES.has(ev.axis)) continue;

    const source_hash = computeHash({
      sv: ev.structured_value_json,
      sr: ev.source_refs_json,
    });

    if (existingHashes.has(source_hash)) {
      skipped++;
      continue;
    }

    const { error: insertErr } = await db.from("project_xrl_evidence").insert({
      project_id,
      ym,
      scope_key: ym,
      axis: ev.axis,
      evidence_kind: ev.evidence_kind ?? "other",
      summary: (ev.summary ?? "").slice(0, 200),
      structured_value_json: ev.structured_value_json ?? {},
      source_refs_json: ev.source_refs_json ?? [],
      source_hash,
      confidence: Math.max(0, Math.min(1, Number(ev.confidence) || 0.5)),
      status: "candidate",
      created_by: CREATED_BY,
    });

    if (!insertErr) {
      saved++;
      existingHashes.add(source_hash);
      axes[ev.axis] = (axes[ev.axis] ?? 0) + 1;
    }
  }

  // ── Phase C-3: l2_feedbacks applied_count++ ─────────────

  for (const fb of feedbacks) {
    await db
      .from("l2_feedbacks")
      .update({
        applied_count: fb.applied_count + 1,
        last_applied_at: new Date().toISOString(),
      })
      .eq("feedback_id", fb.feedback_id);
  }

  return { saved, skipped, axes };
}

// ═══════════════════════════════════════════════════════════
// Main handler
// ═══════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const db = createAdminClient();
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const ymList = getYmList();
  const singlePjId = new URL(req.url).searchParams.get("project_id");

  // ── Phase 0: active non-ecosystem PJ ─────────────────────

  let query = db
    .from("projects")
    .select("project_id, project_name, project_category")
    .eq("status", "active")
    .neq("project_category", "ecosystem");

  if (singlePjId) {
    query = query.eq("project_id", singlePjId);
  } else {
    query = query.limit(MAX_PJS);
  }

  const { data: projects, error: pjErr } = await query;
  if (pjErr || !projects) {
    return NextResponse.json(
      { error: "failed to fetch projects", detail: String(pjErr) },
      { status: 500 }
    );
  }

  let totalSaved = 0;
  const totalAxes: Record<string, number> = {};
  const results: unknown[] = [];

  for (const pj of projects as ProjectRow[]) {
    for (const ym of ymList) {
      const r = await processProjectYm(db, anthropic, pj, ym);
      results.push({ project_id: pj.project_id, ym, ...r });
      totalSaved += r.saved;
      for (const [axis, cnt] of Object.entries(r.axes)) {
        totalAxes[axis] = (totalAxes[axis] ?? 0) + cnt;
      }

      // ── Phase C-2: l2_notifications upsert ─────────────

      if (r.saved > 0) {
        const topAxes = Object.entries(r.axes)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([a, c]) => `${a.toUpperCase()}=${c}`)
          .join(" / ");

        await db.from("l2_notifications").upsert(
          {
            l2_kind: "xrl_evidence",
            target_id: pj.project_id,
            scope_key: ym,
            title: `🧪 ${pj.project_name} (${ym}) XRL 根拠候補 (${r.saved}件)`,
            summary: topAxes,
            saved_count: r.saved,
            total_count: r.saved + r.skipped,
            importance: 2,
            notified_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "l2_kind,target_id,scope_key" }
        );
      }
    }
  }

  // ── Phase D: 1 行 summary ─────────────────────────────────

  const jstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const hhmm = `${String(jstNow.getUTCHours()).padStart(2, "0")}:${String(
    jstNow.getUTCMinutes()
  ).padStart(2, "0")}`;
  const axesSummary = ["trl", "brl", "grl", "srl", "hrl"]
    .map((a) => `${a.toUpperCase()}=${totalAxes[a] ?? 0}`)
    .join(", ");
  const summary = `🧪 XRL 根拠 routine ${hhmm} 完了: ${
    (projects as ProjectRow[]).length
  } PJ チェック、${totalSaved} evidences (${axesSummary})`;

  return NextResponse.json({ ok: true, summary, ymList, results });
}
