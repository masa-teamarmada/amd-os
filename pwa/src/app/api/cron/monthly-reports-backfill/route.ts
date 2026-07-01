/**
 * Missing monthly_reports を順次生成する backfill cron。
 *
 * 2026-05-13 新設: 前セッションで AMD-Report GAS access 全壊により aggressive backfill
 * (22:50 開始) が 00:57 で停止、残 104 件を PWA 側で完遂するために用意。
 *
 * - 1 回の実行で最大 limit 件 (デフォルト 6) 生成、Vercel maxDuration 300s 制約内で抜ける
 * - prompt は llm_prompts.monthly_report.r313_extract から fetch (AGENTS 絶対ルール遵守)
 * - billing_cycles LEFT JOIN monthly_reports IS NULL で missing を ym 降順で取得
 * - 1 件 1 件は /api/report/generate と同じ flow (source_cache + milestone + Sonnet)
 *
 * 認証: Authorization: Bearer CRON_SECRET
 * Query: ?limit=6 (1 run あたりの最大件数、1〜15)
 *
 * 完走後は手動 curl で繰り返しキック、もしくは Vercel cron schedule に常駐させて
 * 新月分の自動補完にも転用する。
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { getBackgroundAnthropic, BackgroundAnthropicDisabledError } from "@/lib/anthropic-client";

export const runtime = "nodejs";
export const maxDuration = 300;

const DEFAULT_LIMIT = 6;
const DEFAULT_CONCURRENCY = 5;
const SOFT_TIMEOUT_MS = 260 * 1000;

interface MissingTarget {
  project_id: string;
  ym: string;
}

interface GenStat {
  project_id: string;
  ym: string;
  ok: boolean;
  reason?: string;
  chars?: number;
  ms?: number;
}

export async function GET(req: NextRequest) {
  const startedAt = Date.now();
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anthroKey = process.env.ANTHROPIC_API_KEY;
  if (!url || !key || !anthroKey) {
    return NextResponse.json({ error: "env missing" }, { status: 500 });
  }
  const db = createClient(url, key);
  let anthropic: Anthropic;
  try {
    anthropic = getBackgroundAnthropic("cron/monthly-reports-backfill");
  } catch (e) {
    if (e instanceof BackgroundAnthropicDisabledError) {
      return NextResponse.json({ ok: true, disabled: true, reason: "background anthropic disabled" });
    }
    throw e;
  }

  const limitRaw = parseInt(req.nextUrl.searchParams.get("limit") || "", 10);
  const limit = Math.max(1, Math.min(40, Number.isFinite(limitRaw) ? limitRaw : DEFAULT_LIMIT));
  const concRaw = parseInt(req.nextUrl.searchParams.get("concurrency") || "", 10);
  const concurrency = Math.max(
    1,
    Math.min(10, Number.isFinite(concRaw) ? concRaw : DEFAULT_CONCURRENCY)
  );

  // 1. prompt fetch (AGENTS 絶対ルール: hardcoded fallback を持たない)
  // is_active は無視する。AMD-Report GAS 側の R303 が hardcoded fallback で動いている事情で
  // 現状 is_active=false のまま保管されているが、PWA cron 側は本テキストを正本として使う。
  const { data: promptRow, error: promptErr } = await db
    .from("llm_prompts")
    .select("body, model, max_tokens")
    .eq("prompt_key", "monthly_report.r313_extract")
    .single();
  if (promptErr || !promptRow || !promptRow.body) {
    return NextResponse.json(
      { error: "prompt fetch failed", detail: promptErr?.message },
      { status: 500 }
    );
  }
  const systemPrompt = promptRow.body as string;
  const model = (promptRow.model as string) || "claude-sonnet-4-6";
  const maxTokens = (promptRow.max_tokens as number) || 8192;

  // 2. missing 取得 (= billing_cycles - monthly_reports)
  const [{ data: bcs }, { data: existingMrs }, { data: projRows }] = await Promise.all([
    db.from("billing_cycles").select("project_id, ym"),
    db.from("monthly_reports").select("project_id, ym"),
    db.from("projects").select("project_id, start_ym, end_ym, status"),
  ]);
  const existingSet = new Set(
    ((existingMrs as { project_id: string; ym: string }[] | null) ?? []).map(
      (r) => `${r.project_id}_${r.ym}`
    )
  );
  // PJ ごとの meta (start_ym / status / freeze_from_ym)。生成可否の判定に使う。
  // 月次サマリ生成の正本原則 (2026-06-03 まさ確定):
  //   - 当月に実進捗があれば、状態 (active/ended/frozen) を問わず生成する
  //     (終了後の清算・株主総会など、ended でも実進捗が出るケースがあるため)
  //   - 当月に実進捗が無く active なら「進捗なし」テンプレを置く
  //   - 当月に実進捗が無く ended / frozen なら生成しない (捏造の温床なので)
  // → 「期間 (end_ym) で機械的に切る」旧ガードは廃止。進捗の有無で切る。
  const projMeta = new Map<
    string,
    { start: string | null; status: string | null; freezeFrom: string | null }
  >();
  for (const p of (projRows as {
    project_id: string;
    start_ym: string | null;
    status: string | null;
    freeze_from_ym: string | null;
  }[] | null) ?? []) {
    projMeta.set(p.project_id, {
      start: p.start_ym,
      status: p.status,
      freezeFrom: p.freeze_from_ym,
    });
  }
  // 当月 (JST) の ym。これより後の未来月は backfill 対象にしない。
  // billing_cycles には請求予定として未来月が登録されており、ガードが無いと
  // まだ来ていない月の月次報告書を LLM が先回りで捏造してしまう (2026-06-02 事故)。
  const nowJst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const currentYm = `${nowJst.getUTCFullYear()}${String(nowJst.getUTCMonth() + 1).padStart(2, "0")}`;
  const missing: MissingTarget[] = ((bcs as MissingTarget[] | null) ?? [])
    .filter((bc) => !existingSet.has(`${bc.project_id}_${bc.ym}`))
    .filter((bc) => bc.ym <= currentYm) // 未来月は作らない
    .filter((bc) => {
      const m = projMeta.get(bc.project_id);
      if (!m) return false; // projects に無い PJ は対象外
      if (m.start && bc.ym < m.start) return false; // 開始前は自動 backfill しない (意味ある開始前は手動)
      return true;
    })
    .sort((a, b) => b.ym.localeCompare(a.ym) || a.project_id.localeCompare(b.project_id))
    .slice(0, limit);

  if (missing.length === 0) {
    return NextResponse.json({ ok: true, total_missing: 0, generated: 0, results: [] });
  }

  const totalMissing =
    ((bcs as MissingTarget[] | null) ?? []).filter((bc) => {
      if (existingSet.has(`${bc.project_id}_${bc.ym}`)) return false;
      if (bc.ym > currentYm) return false;
      const m = projMeta.get(bc.project_id);
      if (!m) return false;
      if (m.start && bc.ym < m.start) return false;
      return true;
    }).length;

  const stats: GenStat[] = [];

  // concurrency 件ずつ並列処理 (= 単一 Vercel call 内で wall-clock を圧縮)
  for (let i = 0; i < missing.length; i += concurrency) {
    if (Date.now() - startedAt > SOFT_TIMEOUT_MS) {
      for (const t of missing.slice(i)) stats.push({ ...t, ok: false, reason: "soft_timeout" });
      break;
    }
    const batch = missing.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(
      batch.map(async (target) => {
        const t0 = Date.now();
        try {
          const result = await generateOne(
            db,
            anthropic,
            target,
            systemPrompt,
            model,
            maxTokens,
            projMeta.get(target.project_id) ?? null
          );
          if (result.skipped) {
            return { ...target, ok: false, reason: result.skipReason, ms: Date.now() - t0 } as GenStat;
          }
          return { ...target, ok: true, chars: result.chars, ms: Date.now() - t0 } as GenStat;
        } catch (e) {
          return {
            ...target,
            ok: false,
            reason: (e as Error).message,
            ms: Date.now() - t0,
          } as GenStat;
        }
      })
    );
    for (const r of batchResults) {
      if (r.status === "fulfilled") stats.push(r.value);
      else stats.push({ project_id: "?", ym: "?", ok: false, reason: String(r.reason) });
    }
  }

  return NextResponse.json({
    ok: true,
    total_missing: totalMissing,
    attempted: missing.length,
    generated: stats.filter((s) => s.ok).length,
    failed: stats.filter((s) => !s.ok).length,
    elapsed_ms: Date.now() - startedAt,
    results: stats,
  });
}

async function generateOne(
  db: SupabaseClient,
  anthropic: Anthropic,
  target: MissingTarget,
  systemPrompt: string,
  model: string,
  maxTokens: number,
  meta: { start: string | null; status: string | null; freezeFrom: string | null } | null
): Promise<{ chars: number; skipped?: boolean; skipReason?: string }> {
  const { project_id: projectId, ym } = target;

  // project
  const { data: project } = await db
    .from("projects")
    .select("project_id, project_name, client_name")
    .eq("project_id", projectId)
    .single();
  if (!project) throw new Error("project not found");

  // members
  const { data: pmRows } = await db
    .from("project_members")
    .select("member_id")
    .eq("project_id", projectId)
    .eq("is_active", true);
  const memberIds = ((pmRows as { member_id: string }[] | null) ?? []).map((r) => r.member_id);
  const { data: memberRows } = await db
    .from("members")
    .select("member_id, code_name")
    .in("member_id", memberIds.length > 0 ? memberIds : ["__none__"]);
  const members = ((memberRows as { code_name: string | null }[] | null) ?? [])
    .map((m) => m.code_name || "PM")
    .filter(Boolean);

  // source_cache (= 5 生データ集約済)
  const { data: sourceItems } = await db
    .from("source_cache")
    .select("source, title, item_date, content_text")
    .eq("project_id", projectId)
    .eq("ym", ym)
    .order("item_date", { ascending: false })
    .limit(60);
  const bySource: Record<string, { title: string; content: string; date: string }[]> = {};
  const sourceChecklist: Record<string, number> = {
    gmail: 0,
    drive: 0,
    calendar: 0,
    slack: 0,
    notion: 0,
  };
  let sourceItemCount = 0;
  for (const item of (sourceItems as {
    source: string | null;
    title: string | null;
    item_date: string | null;
    content_text: string | null;
  }[] | null) ?? []) {
    const src = item.source || "other";
    if (!bySource[src]) bySource[src] = [];
    bySource[src].push({
      title: item.title || "",
      content: (item.content_text || "").slice(0, 2000),
      date: item.item_date || "",
    });
    if (src in sourceChecklist) sourceChecklist[src] += 1;
    sourceItemCount += 1;
  }

  // 当月の実進捗を 5生データ集約 (source_cache) だけでなく、MTGサマリ (H-1) と
  // メンバー活動 (member_activities) も含めて判定する。source_cache が薄くても
  // 会議・活動の痕跡があれば「進捗あり」とみなす (no-data 誤判定の防止)。
  const [{ count: mtgCount }, { count: actCount }] = await Promise.all([
    db
      .from("project_meeting_summaries")
      .select("meeting_id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .eq("ym", ym),
    db
      .from("member_activities")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .eq("ym", ym),
  ]);
  const hasActivity = sourceItemCount > 0 || (mtgCount ?? 0) > 0 || (actCount ?? 0) > 0;

  // milestones
  const { data: pcRows } = await db
    .from("value_plan_cycles")
    .select("plan_cycle_id, total_points, period_start_ym, period_end_ym")
    .eq("project_id", projectId)
    .in("status", ["active", "confirmed", "fixed"])
    .limit(1);
  let milestonesText = "";
  if (pcRows && pcRows.length > 0) {
    const pc = pcRows[0] as { plan_cycle_id: string };
    const { data: msRows } = await db
      .from("value_milestones")
      .select("title, points, tag")
      .eq("plan_cycle_id", pc.plan_cycle_id)
      .eq("is_active", true)
      .order("sort_order");
    if (msRows && msRows.length > 0) {
      milestonesText =
        "## 当期マイルストーン\n" +
        (msRows as { title: string; points: number; tag: string }[])
          .map((ms) => `- ${ms.title}（${ms.points}pt, ${ms.tag}）`)
          .join("\n");
    }
  }

  const ymFormatted = `${ym.slice(0, 4)}年${parseInt(ym.slice(4), 10)}月`;

  // 進捗ゼロ月の扱い (2026-06-03 まさ確定の正本原則):
  //   - 進捗あり → 状態を問わず通常生成 (ended/frozen でも清算・株主総会等の実進捗は書く)
  //   - 進捗なし & frozen/ended → 生成しない (捏造の温床)
  //   - 進捗なし & active → 「進捗なし」テンプレを置く
  if (!hasActivity) {
    const isFrozen =
      meta?.status === "frozen" || (!!meta?.freezeFrom && ym >= meta.freezeFrom);
    const isEnded = meta?.status === "ended";
    if (isFrozen || isEnded) {
      // 進捗ゼロの終了/凍結 PJ は月次サマリを作らない
      return {
        chars: 0,
        skipped: true,
        skipReason: `skip:no-activity-${isEnded ? "ended" : "frozen"}`,
      };
    }
    // active かつ進捗ゼロ → 「進捗なし」テンプレ。
    // source の薄さは extraction 不完全の可能性もあるため本文は断定しない。
    const noActivityBody =
      `# ${project.project_name}（${project.client_name || ""}）${ymFormatted}度 月次報告書\n\n` +
      `**対象期間:** ${ymFormatted}\n` +
      `**作成:** AMD OS 月次報告書生成（つくよみ）\n\n` +
      `---\n\n` +
      `## 概要\n\n` +
      `${ymFormatted}は、${project.project_name}プロジェクトにおける活動が検出されませんでした。**進捗はありません。**\n\n` +
      `5生データ（Gmail / Drive / Calendar / Slack / Notion）のいずれからも当月の活動・会議・成果物は検出されていません。マイルストーン進捗、メンバー活動ともに記録なしです。\n\n` +
      `活動が発生した時点で月次報告を再開します。\n`;
    const reportId = `${projectId}_${ym}`;
    const now = new Date().toISOString();
    const { error: upsertErr } = await db.from("monthly_reports").upsert(
      {
        report_id: reportId,
        project_id: projectId,
        ym,
        draft_content: noActivityBody,
        status: "draft",
        generated_at: now,
        collection_summary_json: {
          sourceChecklist,
          sourceItemCount: 0,
          mtgCount: mtgCount ?? 0,
          memberActivityCount: actCount ?? 0,
          noActivity: true,
          note: "no-activity month (active) — skipped LLM draft, placed no-progress template",
        },
      },
      { onConflict: "project_id,ym" }
    );
    if (upsertErr) throw new Error(`upsert(no-activity): ${upsertErr.message}`);
    return { chars: noActivityBody.length };
  }

  // prompt 組み立て
  let userPrompt = `# ${project.project_name}（${project.client_name || ""}）${ymFormatted}度 月次報告書\n\n`;
  userPrompt += `メンバー: ${members.join(", ")}\n\n`;
  if (milestonesText) userPrompt += milestonesText + "\n\n";

  const sourceLabels: Record<string, string> = {
    notion: "Notion",
    slack: "Slack",
    gmail: "Gmail",
    drive: "Drive",
    calendar: "カレンダー/MTG",
  };
  let charBudget = 12000;
  for (const [src, items] of Object.entries(bySource)) {
    if (charBudget <= 0) break;
    const label = sourceLabels[src] || src;
    let section = `## ${label}の活動\n`;
    for (const item of items.slice(0, 15)) {
      const entry = `- ${item.title}: ${item.content.slice(0, 500)}\n`;
      if (section.length + entry.length > charBudget) break;
      section += entry;
    }
    userPrompt += section + "\n";
    charBudget -= section.length;
  }

  userPrompt += `\n以下の構成で報告書を生成してください：
1. 概要（3-5行）
2. 進捗状況（マイルストーン別）
3. 課題と対応
4. 来月の計画
5. メンバー活動
6. スライド要約（1-2行×6枚分）`;

  // LLM 呼び出し
  const response = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });
  const generatedText = response.content
    .filter((c) => c.type === "text")
    .map((c) => ("text" in c ? c.text : ""))
    .join("");

  if (!generatedText.trim()) throw new Error("empty LLM output");

  // 文字化け検出 (= ? 比率 > 50%、R313 BUGS 対応)
  const totalChars = generatedText.length;
  const questionMarks = (generatedText.match(/\?/g) || []).length;
  if (totalChars > 100 && questionMarks / totalChars > 0.5) {
    throw new Error(`mojibake detected (?: ${questionMarks}/${totalChars})`);
  }

  // upsert
  const reportId = `${projectId}_${ym}`;
  const now = new Date().toISOString();
  const { error: upsertErr } = await db.from("monthly_reports").upsert(
    {
      report_id: reportId,
      project_id: projectId,
      ym,
      draft_content: generatedText,
      status: "draft",
      generated_at: now,
      collection_summary_json: {
        sourceChecklist,
        sourceItemCount,
        mtgCount: mtgCount ?? 0,
        memberActivityCount: actCount ?? 0,
        noActivity: false,
      },
    },
    { onConflict: "project_id,ym" }
  );
  if (upsertErr) throw new Error(`upsert: ${upsertErr.message}`);

  return { chars: generatedText.length };
}
