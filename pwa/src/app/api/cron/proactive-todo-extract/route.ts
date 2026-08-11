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
 *   白紙やり直し: MTG議事録の next_actions と PJ 連絡先からの
 *   Gmail 依頼を起点に、全PJ横断の 1 画面 TODO リストにする。
 *   完了UIをつけて信頼できるリストにする。
 *
 * 検知ロジック (LLM 不使用、文字列ヒューリスティック):
 *
 * 1. meeting_next_action: 過去 14 日以内の開催済みMTGの next_actions[] を sweep。
 *    各 next_action テキストから ball_owner を判定:
 *      - 「相手企業/先生/先方/相手側」っぽい主語 → counterpart (= skip)
 *      - 「AMD側/SX側/CX側/えいみ/まさ/AMDから/こちらで」っぽい主語 → amd
 *      - 「名前さん:」「名前先生:」など、AMDメンバーではない名指し担当者 → counterpart (= skip)
 *      - それ以外 → ambiguous (= AMD ボール扱い、TODO に積む)
 *    due_at は next_action 本文内の明示期限を優先。読めない場合だけ meeting_date + 7日。
 *
 * 2. next_meeting_prep: 2026-08-11 に新規生成を廃止。MTG prep は Codex の
 *    W-Prep / prep worker に一本化し、既存の open / blocked 行は dismissed へ退避する。
 *
 * 3. email_action_request: projects.report_emails から来た Gmail を sweep。
 *    「期限/ご返送/ご回答/ご都合/修正案」などの依頼文だけを拾い、
 *    本文全文・URL・パスワードは proactive_todos に保存しない。
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
import { sweepEmailActionRequests } from "@/lib/proactive/email-action-requests";
import { resolveMeetingNextActionDueAt } from "@/lib/proactive/meeting-action-due";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 120;

const LOOKBACK_DAYS = 14;
const BLOCKED_RESURFACE_DAYS = 3;

// --- ball_owner ヒューリスティック ---
//
// 設計判断: AMD ボールの判定は「明らかに相手側だけ」を弾く方針 (= ambiguous は AMD 扱い)。
// 精度より「漏れない」を優先する。誤って積まれた TODO は /proactive の 🗑関係ない で1クリック消せる。
//
// AMD メンバーは `members` を実行時 fetch して動的に AMD 主語に加える。

const PERSON_NAME_HEAD = "[ぁ-んァ-ヶー一-龥A-Za-z][ぁ-んァ-ヶー一-龥A-Za-z・ー]{0,11}";
const HONORIFIC = "(?:先生|教授|社長|代表|氏|さん|様)";
const SUBJECT_DELIMITER = "\\s*(?:[:：、,]|が|は)";

// 「相手側」と判定する主語パターン
const COUNTERPART_SUBJECT_PATTERNS = [
  // 「○○氏」「○○さん」「○○先生」「○○教授」「○○社長」「○○代表」が主語。
  // H-1 next_actions は「杉浦さん: 工場見学を行う」のような担当者prefix形式も出る。
  new RegExp(`^[\\s「『（(【\\[]*${PERSON_NAME_HEAD}${HONORIFIC}${SUBJECT_DELIMITER}`),
  // 「相手側」「先方」「○○大学側」「○○社側」「○○側」が主語
  /^[\s「『（]*(?:相手|先方|大学側|相手側|相手企業|相手チーム|教授会|事務局)/,
  // 「複数の人 氏 と 氏 が」(冒頭固定で出てくるパターン)
  new RegExp(`^[\\s「『（(【\\[]*${PERSON_NAME_HEAD}(?:氏|さん)\\s*と\\s*${PERSON_NAME_HEAD}(?:氏|さん)(?:は|が|:|：)`),
];

// 「AMD ボール」と判定する主語パターン (固定部分)
const AMD_FIXED_SUBJECT_PATTERNS = [
  /(?:AMD|amd)(?:側|から|は|が|チーム)/,
  /(?:アルマダ|チームアルマダ)(?:側|から|は|が|チーム)?/,
  // PJ コード + 側
  /(?:SX|CX|ZMP|KUTE|VSX|CLG|LST|BWE|MMO|OkuDoor|KGW|VasculaX|SolvioraX|CryoX|ZeMA|DAVP|NIMS\s?OS|SE)側/,
  // つくよみ / えいみ / まさ
  /(?:えいみ|つくよみ|まさ)(?:が|は|に)/,
  // 当方系
  /(?:こちら|当方|当社|当チーム)(?:側|から|で|が|は)/,
];

// --- 文字化け (ASCII '?' 置換) guard ---
//
// 過去事故 (2026-06-27): Codex L6 meeting-flow の macbook_fallback / 手動 curl 経路で
// 生成された一部 project_meeting_summaries が、shell 環境の encoding 不一致で
// 日本語が全て ASCII '?' に置換された状態で保存された (p10 SE / p19 ZeMA など)。
// 化けた summary を素材に proactive_todos を作ると、title/detail が ??? だらけの
// 「何のことか分からない通知」がまさに届く事故になる。
//
// extract 側で「化けた」と判定したら skip して、化けた summary が修復されるまで
// 通知に出さない。判定: 連続 3 個以上の '?' を含む、または ASCII '?' が全体の
// 30% 超を占める (= 日本語が全部 '?' に置換された状態の signature)。
function isGarbledText(s: string): boolean {
  if (!s) return false;
  if (/\?{3,}/.test(s)) return true;
  const qCount = (s.match(/\?/g) ?? []).length;
  return qCount > 0 && qCount / s.length > 0.3;
}

function detectBallOwner(text: string, amdMemberNames: Set<string>): "amd" | "counterpart" | "ambiguous" {
  const t = text.trim().slice(0, 200);

  // AMD メンバー実名が冒頭近くに主語/担当者prefixとして来てたら amd。
  // 例: 「山地さん: ...」「まさ: ...」は、下の honorific counterpart 判定より先に拾う。
  for (const name of amdMemberNames) {
    if (!name || name.length < 2) continue;
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const head = t.slice(0, 40);
    if (new RegExp(`${escapedName}(?:${HONORIFIC})?(?:\\s*(?:[:：、,]|が|は|と|に|を|から|の|で)|\\s+)`).test(head)) {
      return "amd";
    }
  }

  for (const re of COUNTERPART_SUBJECT_PATTERNS) {
    if (re.test(t)) return "counterpart";
  }
  for (const re of AMD_FIXED_SUBJECT_PATTERNS) {
    if (re.test(t)) return "amd";
  }
  return "ambiguous";
}

// --- 日付ヘルパ ---

function isPastIso(iso: string): boolean {
  return new Date(iso).getTime() < Date.now();
}

function todayJstIsoDate(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
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
  const nowIso = new Date().toISOString();
  const today = todayJstIsoDate();
  const lookbackFrom = new Date(Date.now() - LOOKBACK_DAYS * 86400_000).toISOString().slice(0, 10);

  // AMD メンバー実名 (本名 + コードネーム) を fetch して ball_owner 判定に使う
  const { data: memberRows } = await db
    .from("members")
    .select("member_name, code_name")
    .eq("status", "active");
  const amdMemberNames = new Set<string>();
  for (const m of memberRows ?? []) {
    // 本名: 「山地 正洋」を「山地正洋」「山地」「正洋」に分解。フルネームと姓だけを入れる。
    const full = String(m.member_name ?? "").replace(/\s+/g, "");
    const lastName = String(m.member_name ?? "").trim().split(/\s+/)[0] ?? "";
    if (full) amdMemberNames.add(full);
    if (lastName && lastName.length >= 2) amdMemberNames.add(lastName);
    if (m.code_name) amdMemberNames.add(String(m.code_name));
  }

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
  let nextActionSkippedGarbled = 0;

  for (const m of pastMeetings ?? []) {
    const meetingId = String(m.meeting_id);
    const projectId = String(m.project_id);
    const meetingDate = String(m.meeting_date);
    const meetingTitle = String(m.title ?? "");
    const actions = Array.isArray(m.next_actions) ? (m.next_actions as unknown[]) : [];

    // 化けた MTG (= title / next_actions が ASCII '?' 化されている) は、修復されるまで通知に出さない
    const meetingTitleGarbled = isGarbledText(meetingTitle);

    for (const action of actions) {
      const text = String(action ?? "").trim();
      if (!text) continue;

      // テンプレ next_action (= upcoming だったMTGが開催済みに転じる前に残ってる) は skip
      if (/関連資料.{0,20}前回までの論点.{0,20}当日確認/.test(text)) {
        nextActionSkippedTemplate++;
        continue;
      }

      // 文字化け guard: MTG title または next_action 本文が ??? だらけなら skip
      if (meetingTitleGarbled || isGarbledText(text)) {
        nextActionSkippedGarbled++;
        continue;
      }

      const ballOwner = detectBallOwner(text, amdMemberNames);
      if (ballOwner === "counterpart") {
        nextActionSkippedCounterpart++;
        continue;
      }

      const title = titleFromNextAction(text, projectId, meetingTitle);
      const dueResolution = resolveMeetingNextActionDueAt(text, meetingDate);
      const dueAt = dueResolution.dueAt;

      // status='done'/'dismissed' は触らない、既存 open/blocked は新しいテキストで更新
      const { error: upsertErr } = await db.from("proactive_todos").upsert(
        {
          project_id: projectId,
          trigger_kind: "meeting_next_action",
          source_meeting_id: meetingId,
          source_event_id: "",
          title,
          detail: text,
          ball_owner: ballOwner,
          due_at: dueAt,
          due_basis: dueResolution.source === "fallback_meeting_date_plus_days" ? "synthetic" : "explicit",
          priority: dueResolution.source !== "fallback_meeting_date_plus_days" && isPastIso(dueAt) ? "red" : "normal",
        },
        { onConflict: "project_id,trigger_kind,source_meeting_id,source_event_id,title", ignoreDuplicates: false },
      );
      if (upsertErr) {
        console.error("[proactive-todo] upsert error (meeting_next_action):", upsertErr.message, projectId, meetingId);
      } else {
        nextActionInserted++;
      }
    }
  }

  // ============================================
  // Stage 2: 旧 next_meeting_prep を退役
  // MTG prep は Codex W-Prep / prep worker に一本化したため、新規生成は行わない。
  // 既存の未対応行は削除せず dismissed に退避し、履歴を保持する。
  // ============================================
  const { data: retiredPrepTodos, error: retirePrepErr } = await db
    .from("proactive_todos")
    .update({
      status: "dismissed",
      resolved_at: nowIso,
      resolved_by: "system",
      resolved_note: "MTG prepをCodexへ一本化したため自動退役",
    })
    .eq("trigger_kind", "next_meeting_prep")
    .in("status", ["open", "blocked"])
    .select("id");
  if (retirePrepErr) {
    return NextResponse.json(
      { ok: false, stage: "retire_next_meeting_prep", error: retirePrepErr.message },
      { status: 500 },
    );
  }
  const retiredPrepCount = retiredPrepTodos?.length ?? 0;

  // ============================================
  // Stage 3: Gmail から PJ メール依頼を抽出
  // ============================================
  const emailSweep = await sweepEmailActionRequests(db);

  // ============================================
  // Stage 4: 期限超過 open todo を red に昇格
  // ============================================
  const { data: openOverdue } = await db
    .from("proactive_todos")
    .select("id")
    .eq("status", "open")
    .eq("priority", "normal")
    .eq("due_basis", "explicit")
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
  // Stage 5: blocked で BLOCKED_RESURFACE_DAYS 日経過したら open に復帰
  // ============================================
  const resurfaceThreshold = new Date(Date.now() - BLOCKED_RESURFACE_DAYS * 86400_000).toISOString();
  const { data: blockedToResurface } = await db
    .from("proactive_todos")
    .select("id, due_at, due_basis")
    .eq("status", "blocked")
    .lt("updated_at", resurfaceThreshold);
  let resurfaced = 0;
  for (const r of blockedToResurface ?? []) {
    const overdue = r.due_basis === "explicit" && isPastIso(String(r.due_at));
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
      email_projects: emailSweep.scanned_projects,
      gmail_threads: emailSweep.gmail_threads,
    },
    upserted: {
      meeting_next_action: nextActionInserted,
      next_meeting_prep: 0,
      email_action_request: emailSweep.upserted,
    },
    retired: {
      next_meeting_prep: retiredPrepCount,
    },
    skipped: {
      next_action_counterpart: nextActionSkippedCounterpart,
      next_action_template: nextActionSkippedTemplate,
      next_action_garbled: nextActionSkippedGarbled,
      email_no_auth: emailSweep.skipped_no_auth,
      email_no_report_emails: emailSweep.skipped_no_report_emails,
      email_internal_sender: emailSweep.skipped_internal_sender,
      email_attachment_notice: emailSweep.skipped_attachment_notice,
      email_no_action: emailSweep.skipped_no_action,
      email_no_due: emailSweep.skipped_no_due,
    },
    email_enabled: emailSweep.enabled,
    email_errors: emailSweep.errors.slice(0, 10),
    escalated_to_red: escalated,
    resurfaced_from_blocked: resurfaced,
  });
}
