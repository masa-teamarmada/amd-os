/**
 * meeting-slots
 * Google Calendar の空き枠一覧を返す Edge Function。
 * Google Calendar API v3 (OAuth2) 直接呼び出し実装。
 *
 * Required secrets:
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

const TZ_OFFSET_MS = 9 * 60 * 60 * 1000; // +09:00
const FIXED_EMAILS = ["masa@team-armada.jp", "kyoko@team-armada.jp"];
const JAPAN_HOLIDAY_CAL = "ja.japanese#holiday@group.v.calendar.google.com";

// ─── Google OAuth2 ───────────────────────────────────────────

async function getGoogleAccessToken(): Promise<string> {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  const refreshToken = Deno.env.get("GOOGLE_REFRESH_TOKEN");

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN が未設定"
    );
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  });

  const data = await res.json();
  if (!data.access_token) {
    throw new Error(`Google アクセストークン取得失敗: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

// ─── 日付ユーティリティ（JST固定） ───────────────────────────

/** Date → "YYYY-MM-DD" in JST */
function toJstDateStr(d: Date): string {
  const jst = new Date(d.getTime() + TZ_OFFSET_MS);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(jst.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/** Date → JST時刻の時（整数） */
function toJstHour(d: Date): number {
  return new Date(d.getTime() + TZ_OFFSET_MS).getUTCHours();
}

/** Date → JST曜日（0=日, 1=月, ..., 6=土） */
function toJstDow(d: Date): number {
  return new Date(d.getTime() + TZ_OFFSET_MS).getUTCDay();
}

/** "YYYY-MM-DD" + hour → UTC Date（JST hour:00:00 → UTC） */
function jstToDate(dateStr: string, hour: number): Date {
  return new Date(
    `${dateStr}T${String(hour).padStart(2, "0")}:00:00+09:00`
  );
}

/** Date → "M/d(曜) HH:mm" 形式のラベル */
function jstLabel(d: Date): string {
  const jst = new Date(d.getTime() + TZ_OFFSET_MS);
  const m = jst.getUTCMonth() + 1;
  const dd = jst.getUTCDate();
  const dow = ["日", "月", "火", "水", "木", "金", "土"][jst.getUTCDay()];
  const h = String(jst.getUTCHours()).padStart(2, "0");
  const min = String(jst.getUTCMinutes()).padStart(2, "0");
  return `${m}/${dd}(${dow}) ${h}:${min}`;
}

// ─── メイン ──────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const projectId = url.searchParams.get("projectId") ?? "";
    const ym = url.searchParams.get("ym") ?? "";

    if (!projectId || !ym) {
      return json({ ok: false, message: "projectId / ym が必要" }, 400);
    }

    // Supabase クライアント
    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // PMメール取得（失敗しても続行）
    const emails = [...FIXED_EMAILS];
    try {
      const { data: pms } = await db
        .from("project_members")
        .select("member_id")
        .eq("project_id", projectId)
        .eq("is_pm", true)
        .eq("is_active", true);

      if (pms && pms.length > 0) {
        const memberIds = (pms as { member_id: string }[]).map(
          (r) => r.member_id
        );
        const { data: members } = await db
          .from("members")
          .select("email")
          .in("member_id", memberIds);

        for (const m of (members as { email: string }[] | null) ?? []) {
          if (m.email && !emails.includes(m.email)) {
            emails.push(m.email);
          }
        }
      }
    } catch (e) {
      console.error("PM email取得失敗（続行）:", e);
    }

    // 翌月第1週の期間（JST）
    const y = Number(ym.slice(0, 4));
    const mo = Number(ym.slice(4, 6));
    let nextM = mo + 1;
    let nextY = y;
    if (nextM > 12) {
      nextM = 1;
      nextY++;
    }
    const mPad = String(nextM).padStart(2, "0");
    const weekStartStr = `${nextY}-${mPad}-01`;
    const weekStart = new Date(`${weekStartStr}T00:00:00+09:00`);
    const weekEnd = new Date(`${nextY}-${mPad}-08T00:00:00+09:00`);

    // Google アクセストークン取得
    const accessToken = await getGoogleAccessToken();
    const authHeader = `Bearer ${accessToken}`;

    // 日本の祝日取得
    const holidayDates = new Set<string>();
    try {
      const hRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
          JAPAN_HOLIDAY_CAL
        )}/events?` +
          new URLSearchParams({
            timeMin: weekStart.toISOString(),
            timeMax: weekEnd.toISOString(),
            singleEvents: "true",
            maxResults: "20",
          }),
        { headers: { Authorization: authHeader } }
      );
      const hData = await hRes.json();
      for (const ev of (hData.items ?? []) as { start?: { date?: string } }[]) {
        if (ev.start?.date) {
          holidayDates.add(ev.start.date); // "YYYY-MM-DD"
        }
      }
    } catch (e) {
      console.error("祝日取得失敗（続行）:", e);
    }

    // FreeBusy クエリ
    const fbRes = await fetch(
      "https://www.googleapis.com/calendar/v3/freeBusy",
      {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          timeMin: weekStart.toISOString(),
          timeMax: weekEnd.toISOString(),
          timeZone: "Asia/Tokyo",
          items: emails.map((e) => ({ id: e })),
        }),
      }
    );
    const fbData = await fbRes.json();

    // 全員分のbusy blocks を合算
    const busyBlocks: Array<{ start: Date; end: Date }> = [];
    for (const email of emails) {
      const cal = (fbData.calendars ?? {})[email];
      if (cal?.busy) {
        for (const b of cal.busy as { start: string; end: string }[]) {
          busyBlocks.push({ start: new Date(b.start), end: new Date(b.end) });
        }
      }
    }

    function isBusy(s: Date, e: Date): boolean {
      return busyBlocks.some((b) => b.start < e && b.end > s);
    }

    // 30分スロット探索
    function findSlots(
      startHour: number,
      endHour: number
    ): Array<{ startISO: string; endISO: string; label: string }> {
      const results = [];
      let cursor = jstToDate(weekStartStr, startHour);

      while (cursor < weekEnd) {
        const hour = toJstHour(cursor);
        const dateStr = toJstDateStr(cursor);
        const dow = toJstDow(cursor);

        // 終業時間を超えたら翌日のstartHourへ
        if (hour >= endHour) {
          cursor = jstToDate(
            toJstDateStr(new Date(cursor.getTime() + 24 * 60 * 60 * 1000)),
            startHour
          );
          continue;
        }

        // 週末・祝日スキップ
        if (dow === 0 || dow === 6 || holidayDates.has(dateStr)) {
          cursor = jstToDate(
            toJstDateStr(new Date(cursor.getTime() + 24 * 60 * 60 * 1000)),
            startHour
          );
          continue;
        }

        const slotEnd = new Date(cursor.getTime() + 30 * 60 * 1000);
        if (!isBusy(cursor, slotEnd)) {
          results.push({
            startISO: cursor.toISOString(),
            endISO: slotEnd.toISOString(),
            label: jstLabel(cursor),
          });
        }

        cursor = new Date(cursor.getTime() + 30 * 60 * 1000);
      }

      return results;
    }

    // 13-18優先、なければ9-20
    let slots = findSlots(13, 18);
    if (slots.length === 0) {
      slots = findSlots(9, 20);
    }

    return json({ ok: true, slots });
  } catch (e) {
    console.error(e);
    return json(
      { ok: false, message: String((e as Error).message ?? e) },
      500
    );
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
