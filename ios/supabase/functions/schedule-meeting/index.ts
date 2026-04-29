/**
 * schedule-meeting
 * Google Calendar に月次報告会を登録・更新する Edge Function。
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

const HUB_CALENDAR_ID = "info@team-armada.jp";
const FIXED_ATTENDEES = ["masa@team-armada.jp", "kyoko@team-armada.jp"];
const TZ = "Asia/Tokyo";
const CAL_API = "https://www.googleapis.com/calendar/v3";

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

// ─── ym整形 ──────────────────────────────────────────────────

/** "202604" → "202604" （6桁正規化） */
function normYm(ym: string): string {
  const s = String(ym).replace(/[^0-9]/g, "");
  if (s.length === 6) return s;
  if (s.length === 4) return s + "01"; // ありえないが念のため
  return s;
}

// ─── メイン ──────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const projectId = url.searchParams.get("projectId") ?? "";
    const ym = normYm(url.searchParams.get("ym") ?? "");
    const startISO = url.searchParams.get("startISO") ?? "";
    const endISO = url.searchParams.get("endISO") ?? "";

    if (!projectId || !ym || !startISO || !endISO) {
      return json(
        { ok: false, message: "projectId / ym / startISO / endISO が必要" },
        400
      );
    }

    const start = new Date(startISO);
    const end = new Date(endISO);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return json({ ok: false, message: "startISO / endISO が不正" }, 400);
    }

    // Supabase クライアント
    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // プロジェクト名取得
    let projectName = projectId;
    try {
      const { data: pj } = await db
        .from("projects")
        .select("project_name")
        .eq("project_id", projectId)
        .limit(1);
      if (pj?.[0]?.project_name) projectName = pj[0].project_name;
    } catch (e) {
      console.error("project_name取得失敗（続行）:", e);
    }

    // 出席者（PM含む）
    const attendeeEmails = [...FIXED_ATTENDEES];
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
          if (m.email && !attendeeEmails.includes(m.email)) {
            attendeeEmails.push(m.email);
          }
        }
      }
    } catch (e) {
      console.error("PM email取得失敗（続行）:", e);
    }

    // 既存イベントID確認（billing_cycles）
    let existingEventId = "";
    try {
      const { data: cycle } = await db
        .from("billing_cycles")
        .select("meeting_event_id")
        .eq("project_id", projectId)
        .eq("ym", ym)
        .limit(1);

      const rawId = cycle?.[0]?.meeting_event_id ?? "";
      // "skipped" / "admin_done" などのダミー値は無視
      if (rawId && /^[a-z0-9_\-]{5,}$/i.test(rawId)) {
        existingEventId = rawId;
      }
    } catch (e) {
      console.error("billing_cycles取得失敗（続行）:", e);
    }

    // Google アクセストークン取得
    const accessToken = await getGoogleAccessToken();
    const authHeader = `Bearer ${accessToken}`;

    const summary = `月次報告会：${projectName}`;
    const attendees = attendeeEmails.map((email) => ({ email }));
    const ymDisp = `${ym.slice(0, 4)}年${String(parseInt(ym.slice(4, 6)))}月`;
    const description = [
      `[AMD OS] ${projectName} ${ymDisp} 月次報告会`,
      "",
      "このイベントは AMD OS iOS アプリから自動作成・更新されました。",
    ].join("\n");

    let eventId: string;
    let htmlLink: string;
    let meetStartAt: string;

    if (existingEventId) {
      // 既存イベントを patch 更新（人間メモを壊さない）
      let currentDesc = "";
      try {
        const getRes = await fetch(
          `${CAL_API}/calendars/${encodeURIComponent(HUB_CALENDAR_ID)}/events/${existingEventId}`,
          { headers: { Authorization: authHeader } }
        );
        const ev = await getRes.json();
        currentDesc = ev.description ?? "";
        htmlLink = ev.htmlLink ?? "";
      } catch (e) {
        console.error("既存イベント取得失敗（続行）:", e);
        currentDesc = "";
        htmlLink = "";
      }

      // AMD OS ブロックを差し替え（人間メモは保持）
      const amdBlock = `[AMD OS]\n${description}`;
      const humanMemo = currentDesc
        .replace(/\[AMD OS\][\s\S]*?(\n\n|$)/, "")
        .trim();
      const finalDesc = [amdBlock, humanMemo].filter(Boolean).join("\n\n");

      const patchRes = await fetch(
        `${CAL_API}/calendars/${encodeURIComponent(HUB_CALENDAR_ID)}/events/${existingEventId}?sendUpdates=all`,
        {
          method: "PATCH",
          headers: {
            Authorization: authHeader,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            summary,
            description: finalDesc,
            start: { dateTime: start.toISOString(), timeZone: TZ },
            end: { dateTime: end.toISOString(), timeZone: TZ },
            attendees,
          }),
        }
      );
      const patched = await patchRes.json();
      if (patched.error) {
        throw new Error(
          `Calendar.Events.patch エラー: ${JSON.stringify(patched.error)}`
        );
      }

      eventId = patched.id ?? existingEventId;
      htmlLink = patched.htmlLink ?? htmlLink ?? "";
      meetStartAt =
        patched.start?.dateTime ?? start.toISOString();
    } else {
      // 新規イベント作成（Google Meet付き）
      const createRes = await fetch(
        `${CAL_API}/calendars/${encodeURIComponent(HUB_CALENDAR_ID)}/events?conferenceDataVersion=1&sendUpdates=all`,
        {
          method: "POST",
          headers: {
            Authorization: authHeader,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            summary,
            description,
            start: { dateTime: start.toISOString(), timeZone: TZ },
            end: { dateTime: end.toISOString(), timeZone: TZ },
            attendees,
            conferenceData: {
              createRequest: {
                requestId: crypto.randomUUID(),
                conferenceSolutionKey: { type: "hangoutsMeet" },
              },
            },
          }),
        }
      );
      const created = await createRes.json();
      if (created.error) {
        throw new Error(
          `Calendar.Events.insert エラー: ${JSON.stringify(created.error)}`
        );
      }

      eventId = created.id;
      htmlLink = created.htmlLink ?? "";
      meetStartAt = created.start?.dateTime ?? start.toISOString();
    }

    // billing_cycles を Supabase で更新
    await db.from("billing_cycles").upsert(
      {
        project_id: projectId,
        ym,
        meeting_event_id: eventId,
        meeting_start_at: meetStartAt,
        meeting_html_link: htmlLink,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "project_id,ym" }
    );

    return json({
      ok: true,
      eventId,
      htmlLink,
      meetingStartAt: meetStartAt,
      message: existingEventId ? "予定を更新したよ" : "予定を登録したよ",
    });
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
