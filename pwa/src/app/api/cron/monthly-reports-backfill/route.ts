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
  const anthropic = new Anthropic({ apiKey: anthroKey });

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
  // PJ ごとの活動期間 (start_ym 〜 end_ym) と status。これを外れた月は月次報告書を作らない。
  // billing_cycles には PJ 終了後・開始前の請求 ym が残ることがあり (請求は月報と別ライフサイクル)、
  // ガードが無いと終了済み/開始前 PJ の月次報告書を捏造してしまう (2026-06-03 まさ指摘で発覚)。
  // ただし end_ym 超過の除外は status='ended' のときだけ。active PJ は end_ym が
  // 更新されず古いまま残ることがあり (LST p07: end_ym=202507 だが active で継続中)、
  // end_ym だけで切ると継続中 PJ の実データ月報まで誤除外してしまう。
  const projRange = new Map<string, { start: string | null; end: string | null; status: string | null }>();
  for (const p of (projRows as {
    project_id: string;
    start_ym: string | null;
    end_ym: string | null;
    status: string | null;
  }[] | null) ?? []) {
    projRange.set(p.project_id, { start: p.start_ym, end: p.end_ym, status: p.status });
  }
  // 当月 (JST) の ym。これより後の未来月は backfill 対象にしない。
  // billing_cycles には請求予定として未来月が登録されており、ガードが無いと
  // まだ来ていない月の月次報告書を LLM が先回りで捏造してしまう (2026-06-02 事故)。
  const nowJst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const currentYm = `${nowJst.getUTCFullYear()}${String(nowJst.getUTCMonth() + 1).padStart(2, "0")}`;
  const inProjectRange = (bc: MissingTarget): boolean => {
    const r = projRange.get(bc.project_id);
    if (!r) return false; // projects に無い PJ は対象外
    if (r.start && bc.ym < r.start) return false; // 開始前は対象外
    // 終了後の除外は status='ended' のときだけ (active は end_ym が古いだけの可能性)
    if (r.status === "ended" && r.end && bc.ym > r.end) return false;
    return true;
  };
  const missing: MissingTarget[] = ((bcs as MissingTarget[] | null) ?? [])
    .filter((bc) => !existingSet.has(`${bc.project_id}_${bc.ym}`))
    .filter((bc) => bc.ym <= currentYm)
    .filter(inProjectRange)
    .sort((a, b) => b.ym.localeCompare(a.ym) || a.project_id.localeCompare(b.project_id))
    .slice(0, limit);

  if (missing.length === 0) {
    return NextResponse.json({ ok: true, total_missing: 0, generated: 0, results: [] });
  }

  const totalMissing =
    ((bcs as MissingTarget[] | null) ?? []).filter(
      (bc) =>
        !existingSet.has(`${bc.project_id}_${bc.ym}`) &&
        bc.ym <= currentYm &&
        inProjectRange(bc)
    ).length;

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
            maxTokens
          );
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
  maxTokens: number
): Promise<{ chars: number }> {
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

  // no-activity ガード: 5生データ集約 (source_cache) が当月 0 件なら、
  // LLM に推測で本文を書かせない。活動が無い月は「進捗なし」を明示するテンプレを置く。
  // (= raw-route-zero の月に投資家向け資料整備などのハルシネーション本文が入る事故の防止)
  // source_cache の薄さ自体は extraction の不完全さの可能性もあるため、本文は断定せず
  // 「検出されていない」と書き、sourceChecklist と no-activity フラグを証跡として残す。
  if (sourceItemCount === 0) {
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
          noActivity: true,
          note: "no-activity month — source_cache empty, skipped LLM draft (raw-route-zero guard)",
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
        noActivity: false,
      },
    },
    { onConflict: "project_id,ym" }
  );
  if (upsertErr) throw new Error(`upsert: ${upsertErr.message}`);

  return { chars: generatedText.length };
}
