import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getBackgroundAnthropic, BackgroundAnthropicDisabledError } from "@/lib/anthropic-client";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 300;

interface ThemeRow {
  id: string;
  name: string;
  description: string | null;
  primary_domain: string | null;
  tag_keywords: string[];
}

interface SignalRow {
  id: string;
  title: string;
  content: string;
  source_type: string | null;
  source_url: string | null;
  submitted_at: string;
  importance: string;
  metadata: Record<string, unknown> | null;
}

interface DivergenceResult {
  global_summary: string;
  japan_summary: string;
  divergence_message: string;
  divergence_score: number;
  global_intensity: number;
  japan_intensity: number;
}

const COMMON_HEADERS = {
  "Content-Type": "application/json",
};

/**
 * 週1 cron: 世界×日本ズレマップを全テーマ再生成。
 *
 * 各テーマについて:
 *   - 紐付くストーリー → 配下のシグナルを集める
 *   - source_type で分割: policy = 日本、それ以外 = 世界視点（マクロニュース等）
 *   - LLM (Sonnet 4.6) に世界視点/日本視点/差分メッセージ/乖離度を出させる
 *   - atlas_divergences に upsert
 *
 * Bearer ${CRON_SECRET} 認証 + 手動キック ?force=1 対応。
 * クエリ ?theme_id=xxx で1テーマだけ更新するモードもあり（テスト用）。
 */
export async function GET(req: NextRequest) {
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
    anthropic = getBackgroundAnthropic("cron/atlas-divergence");
  } catch (e) {
    if (e instanceof BackgroundAnthropicDisabledError) {
      return NextResponse.json({ ok: true, disabled: true, reason: "background anthropic disabled" });
    }
    throw e;
  }

  const themeIdFilter = req.nextUrl.searchParams.get("theme_id");
  const limit = parseInt(
    req.nextUrl.searchParams.get("limit") || "100",
    10
  );

  // テーマ取得
  let q = db
    .from("atlas_themes")
    .select("id, name, description, primary_domain, tag_keywords")
    .eq("status", "active")
    .order("name");
  if (themeIdFilter) q = q.eq("id", themeIdFilter);
  const { data: themesRaw, error: tErr } = await q;
  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 });
  const themes = ((themesRaw as ThemeRow[]) || []).slice(0, limit);
  if (themes.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, note: "no themes" });
  }

  // すべての atlas_story_themes を1回で取って、テーマごとに振り分け
  const { data: linksRaw, error: lErr } = await db
    .from("atlas_story_themes")
    .select("theme_id, story_id");
  if (lErr) return NextResponse.json({ error: lErr.message }, { status: 500 });
  const storyByTheme = new Map<string, string[]>();
  for (const r of linksRaw || []) {
    const tid = r.theme_id as string;
    const sid = r.story_id as string;
    const arr = storyByTheme.get(tid) || [];
    arr.push(sid);
    storyByTheme.set(tid, arr);
  }

  // 全シグナルを accepted 状態 + story_id 持ちで一括取得（テーマ内集約のため）
  const allStoryIds = Array.from(new Set(Array.from(storyByTheme.values()).flat()));
  if (allStoryIds.length === 0) {
    return NextResponse.json({
      ok: true,
      processed: 0,
      note: "no stories linked to themes",
    });
  }
  const { data: signalsRaw, error: sErr } = await db
    .from("atlas_signals")
    .select("id, title, content, source_type, source_url, submitted_at, importance, metadata, story_id")
    .in("story_id", allStoryIds)
    .in("status", ["accepted", "inbox"])  // policy は inbox のままが多いので両方含める
    .order("submitted_at", { ascending: false });
  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });

  const signalsByStory = new Map<string, SignalRow[]>();
  for (const s of (signalsRaw || []) as Array<SignalRow & { story_id: string }>) {
    const sid = s.story_id;
    const arr = signalsByStory.get(sid) || [];
    arr.push(s);
    signalsByStory.set(sid, arr);
  }

  // 1テーマぶんを処理する関数
  const processTheme = async (theme: ThemeRow): Promise<{ ok: boolean; error?: string }> => {
    const storyIds = storyByTheme.get(theme.id) || [];
    const signals: SignalRow[] = [];
    for (const sid of storyIds) {
      const arr = signalsByStory.get(sid) || [];
      signals.push(...arr);
    }

    if (signals.length === 0) {
      // 紐付けはあるがシグナル無し。divergence は作らずスキップ
      return { ok: true };
    }

    // 日本/世界に分割
    const japanSignals = signals.filter((s) => s.source_type === "policy");
    const globalSignals = signals.filter((s) => s.source_type !== "policy");

    // LLM入力用に圧縮（直近30件まで、1件タイトル+content先頭120字）
    const formatSig = (s: SignalRow) => {
      const date = s.submitted_at?.slice(0, 10) || "";
      const ministry =
        (s.metadata as Record<string, string> | null)?.ministry || "";
      const ministryTag = ministry ? ` [${ministry}]` : "";
      return `- (${date})${ministryTag} ${s.title}\n  ${(s.content || "").slice(0, 200)}`;
    };

    const japanList = japanSignals.slice(0, 30).map(formatSig).join("\n");
    const globalList = globalSignals.slice(0, 30).map(formatSig).join("\n");

    const prompt = `あなたは AMD（armada — 新規事業開発・伴走支援）のマクロアナリスト。
テーマ「${theme.name}」について、世界の動きと日本の動きを比較して「ズレ」を抽出する。

== テーマ ==
名前: ${theme.name}
説明: ${theme.description || "—"}
分野: ${theme.primary_domain || "—"}

== 世界視点のシグナル (${globalSignals.length} 件、最新${Math.min(globalSignals.length, 30)}件抜粋) ==
${globalList || "(該当シグナルなし)"}

== 日本視点のシグナル (${japanSignals.length} 件、政府方針中心) ==
${japanList || "(該当シグナルなし)"}

次の観点で要約してください:

1. **global_summary** (200-400字): 世界全体でいま何が起きてるか。トレンドの方向性、主要プレイヤー、規模感。
2. **japan_summary** (200-400字): 日本（政府方針 + 産業界）はどう動いているか。世界と比べてどう振る舞ってるか。
3. **divergence_message** (60-150字): 「世界は X、日本は Y」の差分を一言で。ズレが小さい場合も「同期している」と書く。
4. **divergence_score** (0.0-1.0): 世界と日本の動きがどれだけズレているか。
   - 0.0: 完全同期 / 0.5: 部分的にズレ / 1.0: 真逆の動き
5. **global_intensity** (0.0-1.0): 世界の動きの活発度。シグナル数だけでなく内容のインパクト・新規性で判断。
6. **japan_intensity** (0.0-1.0): 日本の動きの活発度。同上。

JSON のみで返答（前置き不要、\`\`\`json で囲む）。文字列内に生の改行・タブを入れない（JSON 仕様に従う）:
\`\`\`json
{
  "global_summary": "...",
  "japan_summary": "...",
  "divergence_message": "...",
  "divergence_score": 0.4,
  "global_intensity": 0.7,
  "japan_intensity": 0.5
}
\`\`\``;

    let parsed: DivergenceResult;
    try {
      const r = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 2048,
        messages: [{ role: "user", content: prompt }],
      });
      const block = r.content[0];
      const text = block?.type === "text" ? block.text : "";
      const m = text.match(/```json\s*([\s\S]*?)```/) || text.match(/\{[\s\S]*\}/);
      if (!m) return { ok: false, error: "no JSON" };
      // 文字列内の制御文字を sanitize
      const cleaned = sanitizeJsonControlChars(m[1] || m[0]);
      parsed = JSON.parse(cleaned) as DivergenceResult;
    } catch (e) {
      return { ok: false, error: String(e) };
    }

    const clamp01 = (n: number) => Math.max(0, Math.min(1, Number(n) || 0));

    const sigBreakdown = {
      global: globalSignals.slice(0, 8).map((s) => ({
        title: s.title,
        url: s.source_url,
        date: s.submitted_at?.slice(0, 10),
      })),
      japan: japanSignals.slice(0, 8).map((s) => ({
        title: s.title,
        url: s.source_url,
        date: s.submitted_at?.slice(0, 10),
        ministry:
          (s.metadata as Record<string, string> | null)?.ministry || null,
      })),
    };

    const { error: upErr } = await db.from("atlas_divergences").upsert(
      {
        theme_id: theme.id,
        global_summary: parsed.global_summary || "",
        japan_summary: parsed.japan_summary || "",
        divergence_message: parsed.divergence_message || "",
        divergence_score: clamp01(parsed.divergence_score),
        global_intensity: clamp01(parsed.global_intensity),
        japan_intensity: clamp01(parsed.japan_intensity),
        global_signal_count: globalSignals.length,
        japan_signal_count: japanSignals.length,
        signal_breakdown: sigBreakdown,
        generated_at: new Date().toISOString(),
      },
      { onConflict: "theme_id" }
    );
    if (upErr) return { ok: false, error: upErr.message };
    return { ok: true };
  };

  // 並列度 4 で処理
  const PARALLEL = 4;
  let processed = 0;
  let failed = 0;
  const errors: string[] = [];
  for (let i = 0; i < themes.length; i += PARALLEL) {
    const batch = themes.slice(i, i + PARALLEL);
    const results = await Promise.all(batch.map((t) => processTheme(t)));
    for (let j = 0; j < results.length; j++) {
      if (results[j].ok) processed++;
      else {
        failed++;
        errors.push(`${batch[j].name}: ${results[j].error}`);
      }
    }
  }

  return NextResponse.json({
    ok: true,
    total_themes: themes.length,
    processed,
    failed,
    errors: errors.slice(0, 10),
  });
}

function sanitizeJsonControlChars(raw: string): string {
  let inString = false;
  let escaped = false;
  let out = "";
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    const code = raw.charCodeAt(i);
    if (escaped) {
      out += ch;
      escaped = false;
      continue;
    }
    if (ch === "\\" && inString) {
      out += ch;
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      out += ch;
      continue;
    }
    if (inString && code < 0x20) {
      if (ch === "\n" || ch === "\r" || ch === "\t") out += " ";
      continue;
    }
    out += ch;
  }
  return out;
}
