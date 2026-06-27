/**
 * proactive-todo-extract cron — 先手 TODO の自動抽出 (daily 09:15 JST)
 *
 * 仕様正本: pwa/spec/2-4-proactive-todo-current-spec.md
 *
 * 経緯 (2026-06-27 まさ × えいみ白紙やり直し):
 *   旧 proactive_outbox / 5段ループ盤面 (/loop) を廃止。理由:
 *   - 司令塔セッションが運用上消滅し、heartbeat の受け側が無くなった
 *   - 完了UIが無く、超過 666h の seed が残骸として叫び続けた
 *   - 「DB candidate のテーブルダンプ」になっており先手力維持と無関係だった
 *
 *   白紙やり直し: MTG (議事録 next_actions + 次回MTG予定) を起点に絞り、
 *   全PJ横断の 1 画面 TODO リストにする。完了UIをつけて信頼できるリストにする。
 *
 * 検知ロジック (LLM 不使用、文字列ヒューリスティック):
 *
 * 1. meeting_next_action: 過去 14 日以内の開催済みMTGの next_actions[] を sweep。
 *    各 next_action テキストから ball_owner を判定:
 *      - 「相手企業/先生/先方/相手側」っぽい主語 → counterpart (= skip)
 *      - 「AMD側/SX側/CX側/えいみ/まさ/AMDから/こちらで」っぽい主語 → amd
 *      - それ以外 → ambiguous (= AMD ボール扱い、TODO に積む)
 *    due_at は meeting_date + 7日。
 *
 * 2. next_meeting_prep: source_kinds='upcoming' な未来MTGで、開催 3 営業日前以内のものは
 *    agenda 準備TODOを積む。due_at は MTG 開始 - 1日。
 *
 * 共通:
 *   - UNIQUE 制約で重複 upsert は冪等 (project_id, trigger_kind, meeting_id/event_id, title)
 *   - status='done' / 'dismissed' は触らない (人間判断を上書きしない)
 *   - due_at が過ぎたら priority='red' に昇格
 *   - blocked で 3日経過したら open に自動復帰
 *
 * 課金LLM cron 禁止ルール (pwa/scheduled-tasks/amd-os-l6-meeting-extract/SKILL.md):
 *   PWA / GAS / Vercel から Anthropic・Gemini・OpenAI の従量課金 API は呼ばない。
 *   本 cron は deterministic な文字列マッチングのみで判定する。
 */

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

const LOOKBACK_DAYS = 14;
const NEXT_MEETING_PREP_WINDOW_DAYS = 3;
const BLOCKED_RESURFACE_DAYS = 3;

// --- ball_owner ヒューリスティック ---

// 「相手側」と判定する主語パターン (これらが先頭近くに来るなら counterpart 扱い → skip)
const COUNTERPART_SUBJECT_PATTERNS = [
  /^[\s「『（]*(?:相手|先方|先生(?:が|は|に)|教授|社長|代表|大学側|相手側|相手企業|相手チーム)/,
  /(?:先生|社長|代表|教授)が[^。]{0,40}(?:確認|準備|提示|連絡|送付|手配|調整|提出|検討|判断|決定)/,
  /^[\s「『（]*[ぁ-んァ-ヶー一-龥A-Za-z]{1,12}(?:先生|社長|代表|教授|さん)が/,
];

// 「AMD ボール」と判定する主語パターン
const AMD_SUBJECT_PATTERNS = [
  /(?:AMD|amd)(?:側|から|は|が|チーム)/,
  /(?:SX|CX|ZMP|KUTE|VSX|CLG|LST|BWE|MMO|ZMP|OkuDoor)側/,
  /(?:えいみ|つくよみ|まさ)(?:が|は|に)/,
  /(?:こちら|当方|当社|当チーム)(?:側|から|で|が|は)/,
  /AMD\s?(?:から|側で|チーム)/,
];

function detectBallOwner(text: string): "amd" | "counterpart" | "ambiguous" {
  const t = text.trim().slice(0, 160);
  for (const re of COUNTERPART_SUBJECT_PATTERNS) {
    if (re.test(t)) return "counterpart";
  }
  for (const re of AMD_SUBJECT_PATTERNS) {
    if (re.test(t)) return "amd";
  }
  return "ambiguous";
}

// --- 日付ヘルパ ---

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

function ymdToIsoDayEnd(ymd: string): string {
  // JST 18:00 を期限の目安 (= 1営業日の終わり目安) として UTC へ
  return new Date(`${ymd}T18:00:00+09:00`).toISOString();
}

function ymdAddBusinessDays(ymd: string, days: number): string {
  // 簡易: 土日除外で N営業日後の前日 18:00 JST を返す
  const d = new Date(`${ymd}T00:00:00+09:00`);
  let added = 0;
  let cursor = d;
  while (added < days) {
    cursor = new Date(cursor.getTime() + 86400_000);
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) added++;
  }
  cursor.setUTCHours(9, 0, 0, 0); // JST 18:00 = UTC 09:00
  return cursor.toISOString();
}

function isPastIso(iso: string): boolean {
  return new Date(iso).getTime() < Date.now();
}

// --- next_action テキストから 1 行 title を作る ---

function titleFromNextAction(raw: string, projectId: string, meetingTitle: string): string {
  // 全角句点・改行で 1 行目を取り、長すぎる場合は切る
  const firstSentence = raw.split(/[。\n]/).filter((s) => s.trim().length > 0)[0] ?? raw;
  const trimmed = firstSentence.trim();
  // PJ + MTG タイトル prefix を頭に付けて、リスト上で識別しやすくする
  const mtg = meetingTitle.length > 18 ? `${meetingTitle.slice(0, 18)}…` : meetingTitle;
  return `${projectId} ${mtg}: ${trimmed.slice(0, 80)}`;
}

// --- メイン ---

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);
  const lookbackFrom = new Date(Date.now() - LOOKBACK_DAYS * 86400_000).toISOString().slice(0, 10);

  // ============================================
  // Stage 1: 過去 LOOKBACK_DAYS 以内の開催済みMTGから next_action を抽出
  // ============================================
  const { data: pastMeetings, error: pastErr } = await db
    .from("project_meeting_summaries")
    .select("meeting_id, project_id, meeting_date, title, next_actions, source_kinds")
    .lt("meeting_date", today)
    .gte("meeting_date", lookbackFrom)
    .not("source_kinds", "is", null)
    .neq("source_kinds", "upcoming")
    .neq("source_kinds", "none");
  if (pastErr) {
    return NextResponse.json({ ok: false, stage: "past_meetings", error: pastErr.message }, { status: 500 });
  }

  let nextActionInserted = 0;
  let nextActionSkippedCounterpart = 0;
  let nextActionSkippedTemplate = 0;

  for (const m of pastMeetings ?? []) {
    const meetingId = String(m.meeting_id);
    const projectId = String(m.project_id);
    const meetingDate = String(m.meeting_date);
    const meetingTitle = String(m.title ?? "");
    const actions = Array.isArray(m.next_actions) ? (m.next_actions as unknown[]) : [];

    for (const action of actions) {
      const text = String(action ?? "").trim();
      if (!text) continue;

      // テンプレ next_action (= upcoming だったMTGが開催済みに転じる前に残ってる) は skip
      if (/関連資料.{0,20}前回までの論点.{0,20}当日確認/.test(text)) {
        nextActionSkippedTemplate++;
        continue;
      }

      const ballOwner = detectBallOwner(text);
      if (ballOwner === "counterpart") {
        nextActionSkippedCounterpart++;
        continue;
      }

      const title = titleFromNextAction(text, projectId, meetingTitle);
      const dueAt = addDays(meetingDate, 7);

      // status='done'/'dismissed' は触らない、既存 open/blocked は新しいテキストで更新
      const { error: upsertErr } = await db.from("proactive_todos").upsert(
        {
          project_id: projectId,
          trigger_kind: "meeting_next_action",
          source_meeting_id: meetingId,
          source_event_id: null,
          title,
          detail: text,
          ball_owner: ballOwner,
          due_at: dueAt,
          priority: isPastIso(dueAt) ? "red" : "normal",
        },
        { onConflict: "project_id,trigger_kind,source_meeting_id,source_event_id,title", ignoreDuplicates: false },
      );
      if (!upsertErr) nextActionInserted++;
    }
  }

  // ============================================
  // Stage 2: 次回MTG (source_kinds='upcoming') が NEXT_MEETING_PREP_WINDOW_DAYS 営業日以内
  // ============================================
  const prepHorizon = addDays(today + "T00:00:00Z", 14).slice(0, 10);

  const { data: upcomingMeetings, error: upErr } = await db
    .from("project_meeting_summaries")
    .select("meeting_id, project_id, meeting_date, meeting_start_at, title, source_kinds")
    .gte("meeting_date", today)
    .lte("meeting_date", prepHorizon)
    .eq("source_kinds", "upcoming");
  if (upErr) {
    return NextResponse.json({ ok: false, stage: "upcoming_meetings", error: upErr.message }, { status: 500 });
  }

  let prepInserted = 0;
  let prepSkippedFar = 0;

  for (const m of upcomingMeetings ?? []) {
    const projectId = String(m.project_id);
    const meetingDate = String(m.meeting_date);
    const meetingTitle = String(m.title ?? "");
    const meetingId = String(m.meeting_id);

    // 3 営業日後より先の MTG は skip (3 営業日切ったら積む)
    const threeBizDaysFromNow = ymdAddBusinessDays(today, NEXT_MEETING_PREP_WINDOW_DAYS);
    const meetingStart = m.meeting_start_at ? String(m.meeting_start_at) : ymdToIsoDayEnd(meetingDate);
    if (new Date(meetingStart).getTime() > new Date(threeBizDaysFromNow).getTime()) {
      prepSkippedFar++;
      continue;
    }

    const title = `${projectId} ${meetingTitle.length > 24 ? meetingTitle.slice(0, 24) + "…" : meetingTitle}: agenda / 進行案を先に提示する`;
    const detail = `${meetingDate} 開催予定。AMD から agenda / 進行案 / 論点表を先に出して、相手側が議論をリードする状態を避ける。`;
    // 期限 = MTG 開始の 1 日前 (準備 buffer)
    const dueAt = new Date(new Date(meetingStart).getTime() - 86400_000).toISOString();

    const { error: upsertErr } = await db.from("proactive_todos").upsert(
      {
        project_id: projectId,
        trigger_kind: "next_meeting_prep",
        source_meeting_id: null,
        source_event_id: meetingId,
        title,
        detail,
        ball_owner: "amd",
        due_at: dueAt,
        priority: isPastIso(dueAt) ? "red" : "normal",
      },
      { onConflict: "project_id,trigger_kind,source_meeting_id,source_event_id,title", ignoreDuplicates: false },
    );
    if (!upsertErr) prepInserted++;
  }

  // ============================================
  // Stage 3: 期限超過 open todo を red に昇格
  // ============================================
  const { data: openOverdue } = await db
    .from("proactive_todos")
    .select("id")
    .eq("status", "open")
    .eq("priority", "normal")
    .lt("due_at", new Date().toISOString());
  let escalated = 0;
  for (const r of openOverdue ?? []) {
    const { error } = await db
      .from("proactive_todos")
      .update({ priority: "red" })
      .eq("id", r.id);
    if (!error) escalated++;
  }

  // ============================================
  // Stage 4: blocked で BLOCKED_RESURFACE_DAYS 日経過したら open に復帰
  // ============================================
  const resurfaceThreshold = new Date(Date.now() - BLOCKED_RESURFACE_DAYS * 86400_000).toISOString();
  const { data: blockedToResurface } = await db
    .from("proactive_todos")
    .select("id, due_at")
    .eq("status", "blocked")
    .lt("updated_at", resurfaceThreshold);
  let resurfaced = 0;
  for (const r of blockedToResurface ?? []) {
    const overdue = isPastIso(String(r.due_at));
    const { error } = await db
      .from("proactive_todos")
      .update({ status: "open", priority: overdue ? "red" : "normal" })
      .eq("id", r.id);
    if (!error) resurfaced++;
  }

  return NextResponse.json({
    ok: true,
    scanned: {
      past_meetings: pastMeetings?.length ?? 0,
      upcoming_meetings: upcomingMeetings?.length ?? 0,
    },
    upserted: {
      meeting_next_action: nextActionInserted,
      next_meeting_prep: prepInserted,
    },
    skipped: {
      next_action_counterpart: nextActionSkippedCounterpart,
      next_action_template: nextActionSkippedTemplate,
      prep_far_future: prepSkippedFar,
    },
    escalated_to_red: escalated,
    resurfaced_from_blocked: resurfaced,
  });
}
