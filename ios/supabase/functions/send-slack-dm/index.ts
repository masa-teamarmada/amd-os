/**
 * send-slack-dm
 * Slack DM を送る Edge Function。
 * iOS の「PCで編集する」ボタン（requestReportEdit）が呼び出す。
 *
 * Required secret: SLACK_BOT_TOKEN
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projectId, ym, email } = await req.json() as {
      projectId: string;
      ym: string;
      email: string;
    };

    if (!projectId || !ym || !email) {
      return json({ ok: false, message: "projectId / ym / email が必要" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const slackToken = Deno.env.get("SLACK_BOT_TOKEN");
    if (!slackToken) {
      return json({ ok: false, message: "SLACK_BOT_TOKEN が未設定" }, 500);
    }

    const db = createClient(supabaseUrl, serviceKey);

    // 1) email → slack_id
    const { data: members } = await db
      .from("members")
      .select("slack_id, code_name")
      .eq("email", email.toLowerCase())
      .limit(1);

    const slackId = members?.[0]?.slack_id;
    if (!slackId) {
      return json({ ok: false, message: `Slack IDが見つかりません（email=${email}）` }, 404);
    }

    // 2) project_name
    const { data: projects } = await db
      .from("projects")
      .select("project_name")
      .eq("project_id", projectId)
      .limit(1);

    const projectName = projects?.[0]?.project_name ?? projectId;

    // 3) ym整形 "202604" → "2026年4月"
    const year = ym.length === 6 ? ym.slice(0, 4) + "年" : "";
    const month = ym.length === 6 ? String(parseInt(ym.slice(4, 6))) + "月" : ym;

    // 4) コックピットURL
    const gasExecUrl =
      "https://script.google.com/macros/s/AKfycbx4IgBEjrP8Ov-e5PhGi_3Z5-WOoEKCyNV-7S6s4iksto0qwD3c_fKiwJ-l4xn0zgir/exec";
    const cockpitUrl = `${gasExecUrl}?page=cockpit&projectId=${encodeURIComponent(projectId)}`;

    // 5) DM チャンネル開く
    const openRes = await fetch("https://slack.com/api/conversations.open", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${slackToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ users: slackId }),
    });
    const openData = await openRes.json();
    if (!openData.ok) {
      return json({ ok: false, message: `Slack conversations.open エラー: ${openData.error}` }, 500);
    }
    const channelId = openData.channel.id;

    // 6) メッセージ送信
    const text = [
      `📝 *${projectName}* ${year}${month}の月次レポート編集依頼`,
      "",
      `コックピットを開いて「${month}」タブ → 「レポート」タブから内容を編集しちゃってー。`,
      `\n<${cockpitUrl}|コックピットを開く>`,
    ].join("\n");

    const postRes = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${slackToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ channel: channelId, text }),
    });
    const postData = await postRes.json();
    if (!postData.ok) {
      return json({ ok: false, message: `Slack chat.postMessage エラー: ${postData.error}` }, 500);
    }

    return json({ ok: true, message: "Slackに送ったよ！" });
  } catch (e) {
    return json({ ok: false, message: String((e as Error).message ?? e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
