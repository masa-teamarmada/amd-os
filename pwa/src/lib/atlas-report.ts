/**
 * Atlas レポート生成ロジック
 * Supabase から期間内のシグナルを取得し、Anthropic API で要約を生成して atlas_reports に保存する。
 */

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import type { AtlasSignal } from "./supabase-data";

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );
}

function getAnthropicClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "" });
}

// ────────────────────────────────────────────────
// JST ユーティリティ
// ────────────────────────────────────────────────

export function nowJST(): Date {
  return new Date(Date.now() + 9 * 60 * 60 * 1000);
}

/** JST での "yyyy/MM/dd" 文字列 */
export function formatDateJST(d: Date): string {
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const day = String(jst.getUTCDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}

/** JST での曜日（0=日, 5=金） */
export function dayOfWeekJST(d: Date): number {
  return new Date(d.getTime() + 9 * 60 * 60 * 1000).getUTCDay();
}

// ────────────────────────────────────────────────
// シグナル取得
// ────────────────────────────────────────────────

async function fetchSignalsInRange(
  from: Date,
  to: Date,
  status: string = "accepted"
): Promise<AtlasSignal[]> {
  const db = getServiceClient();
  const { data, error } = await db
    .from("atlas_signals")
    .select("*")
    .gte("submitted_at", from.toISOString())
    .lte("submitted_at", to.toISOString())
    .eq("status", status)
    .order("importance", { ascending: true }) // high → medium → low
    .order("submitted_at", { ascending: false });

  if (error) {
    console.error("fetchSignalsInRange:", error.message);
    return [];
  }
  return (data || []) as AtlasSignal[];
}

// ────────────────────────────────────────────────
// AI 要約生成（weekly / monthly 用）
// ────────────────────────────────────────────────

async function generateMacroSummary(
  signals: AtlasSignal[],
  reportType: "weekly" | "monthly"
): Promise<string> {
  if (signals.length === 0) return "今期間中にシグナルはありませんでした。";

  const client = getAnthropicClient();

  const signalText = signals
    .map(
      (s, i) =>
        `${i + 1}. [${s.importance.toUpperCase()}] ${s.domain || "—"} | ${s.title}\n   ${s.content}`
    )
    .join("\n\n");

  const periodLabel = reportType === "weekly" ? "今週" : "今月";

  const prompt = `あなたはマクロインテリジェンスアナリストです。
以下は${periodLabel}収集されたマクロトレンドシグナル一覧です。

${signalText}

これらを読んで、${periodLabel}の「マクロ気流」を3〜5文で簡潔にまとめてください。
ルール:
- 特定の企業名・PJ名は使わない（読者が自分で文脈を当てはめる）
- 事実とトレンドの方向性だけを書く
- 推奨アクションは書かない
- 日本語で、FT/Economist のような客観的なトーンで
- 見出しや箇条書きは不要。段落テキストのみ`;

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    messages: [{ role: "user", content: prompt }],
  });

  const block = message.content[0];
  return block.type === "text" ? block.text.trim() : "";
}

// ────────────────────────────────────────────────
// レポート保存
// ────────────────────────────────────────────────

async function saveReport(report: {
  type: "daily" | "weekly" | "monthly" | "instant";
  title: string;
  period_start: Date;
  period_end: Date;
  signals: AtlasSignal[];
  macro_summary?: string;
}): Promise<string | null> {
  const db = getServiceClient();
  const high = report.signals.filter((s) => s.importance === "high").length;
  const medium = report.signals.filter((s) => s.importance === "medium").length;
  const low = report.signals.filter((s) => s.importance === "low").length;

  const { data, error } = await db
    .from("atlas_reports")
    .insert({
      type: report.type,
      title: report.title,
      period_start: report.period_start.toISOString(),
      period_end: report.period_end.toISOString(),
      signal_count: report.signals.length,
      high_count: high,
      medium_count: medium,
      low_count: low,
      signals_json: report.signals,
      macro_summary: report.macro_summary || null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("saveReport:", error.message);
    return null;
  }
  return data?.id || null;
}

// ────────────────────────────────────────────────
// Public: デイリーレポート生成
// ────────────────────────────────────────────────

export async function generateDailyReport(): Promise<{ id: string | null; signalCount: number }> {
  const now = nowJST();
  // 昨日 JST の 0:00〜23:59
  const jstNow = new Date(now.getTime()); // already +9h
  const todayStart = new Date(
    Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth(), jstNow.getUTCDate()) -
      9 * 60 * 60 * 1000
  );
  const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayEnd = new Date(todayStart.getTime() - 1);

  // デイリーはinboxも含める（acceptedが少ない起動直後を考慮）
  const [accepted, inbox] = await Promise.all([
    fetchSignalsInRange(yesterdayStart, yesterdayEnd, "accepted"),
    fetchSignalsInRange(yesterdayStart, yesterdayEnd, "inbox"),
  ]);
  const signals = [...accepted, ...inbox];

  const dateLabel = formatDateJST(new Date(yesterdayStart.getTime() + 9 * 60 * 60 * 1000));
  const title = `AMD Atlas デイリーブリーフ ${dateLabel}`;

  const id = await saveReport({
    type: "daily",
    title,
    period_start: yesterdayStart,
    period_end: yesterdayEnd,
    signals,
  });

  return { id, signalCount: signals.length };
}

// ────────────────────────────────────────────────
// Public: 週次レポート生成
// ────────────────────────────────────────────────

export async function generateWeeklyReport(): Promise<{ id: string | null; signalCount: number }> {
  const now = nowJST();
  const jstNow = new Date(now.getTime());
  // 今週月曜〜今日（金曜17:00配信なので月〜金を対象）
  const todayStartUTC = new Date(
    Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth(), jstNow.getUTCDate()) -
      9 * 60 * 60 * 1000
  );
  const dow = jstNow.getUTCDay(); // 0=Sun, 5=Fri
  const daysFromMon = dow === 0 ? 6 : dow - 1;
  const weekStart = new Date(todayStartUTC.getTime() - daysFromMon * 24 * 60 * 60 * 1000);
  const weekEnd = new Date(todayStartUTC.getTime() + 24 * 60 * 60 * 1000 - 1);

  const [accepted, inbox] = await Promise.all([
    fetchSignalsInRange(weekStart, weekEnd, "accepted"),
    fetchSignalsInRange(weekStart, weekEnd, "inbox"),
  ]);
  const signals = [...accepted, ...inbox];

  const macro_summary = await generateMacroSummary(signals, "weekly");

  const startLabel = formatDateJST(new Date(weekStart.getTime() + 9 * 60 * 60 * 1000));
  const endLabel = formatDateJST(new Date(weekEnd.getTime() + 9 * 60 * 60 * 1000));
  const title = `AMD Atlas 週次レポート ${startLabel}〜${endLabel}`;

  const id = await saveReport({
    type: "weekly",
    title,
    period_start: weekStart,
    period_end: weekEnd,
    signals,
    macro_summary,
  });

  return { id, signalCount: signals.length };
}

// ────────────────────────────────────────────────
// Public: 月次レポート生成
// ────────────────────────────────────────────────

export async function generateMonthlyReport(): Promise<{ id: string | null; signalCount: number }> {
  const now = nowJST();
  const jstNow = new Date(now.getTime());
  // 先月
  const year = jstNow.getUTCMonth() === 0 ? jstNow.getUTCFullYear() - 1 : jstNow.getUTCFullYear();
  const month = jstNow.getUTCMonth() === 0 ? 11 : jstNow.getUTCMonth() - 1;
  const monthStart = new Date(Date.UTC(year, month, 1) - 9 * 60 * 60 * 1000);
  const monthEnd = new Date(Date.UTC(year, month + 1, 1) - 9 * 60 * 60 * 1000 - 1);

  const [accepted, inbox] = await Promise.all([
    fetchSignalsInRange(monthStart, monthEnd, "accepted"),
    fetchSignalsInRange(monthStart, monthEnd, "inbox"),
  ]);
  const signals = [...accepted, ...inbox];

  const macro_summary = await generateMacroSummary(signals, "monthly");

  const monthLabel = `${year}年${month + 1}月`;
  const title = `AMD Atlas 月次レポート ${monthLabel}`;

  const id = await saveReport({
    type: "monthly",
    title,
    period_start: monthStart,
    period_end: monthEnd,
    signals,
    macro_summary,
  });

  return { id, signalCount: signals.length };
}
