/**
 * send-budget-approval-nudge
 * PMが予算申告（billing_cycles.status='reported'）した直後に呼ばれる。
 * is_admin=true の全アクティブメンバーに Slack DM で承認依頼を通知する。
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
    const { projectId, ym, pmEmail } = await req.json() as {
      projectId: string;
      ym: string;
      pmEmail: string;
    };

    if (!projectId || !ym || !pmEmail) {
      return json({ ok: false, message: "projectId / ym / pmEmail が必要" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const slackToken = Deno.env.get("SLACK_BOT_TOKEN");
    if (!slackToken) {
      return json({ ok: false, message: "SLACK_BOT_TOKEN が未設定" }, 500);
    }

    const db = createClient(supabaseUrl, serviceKey);

    // 1) PJ名を取得
    const { data: projects } = await db
      .from("projects")
      .select("project_name")
      .eq("project_id", projectId)
      .limit(1);
    const projectName = projects?.[0]?.project_name ?? projectId;

    // 2) PM の code_name を取得
    const { data: pmRows } = await db
      .from("members")
      .select("code_name")
      .eq("email", pmEmail.toLowerCase())
      .limit(1);
    const pmName = pmRows?.[0]?.code_name ?? pmEmail;

    // 3) ym整形 "202604" → "2026年4月"
    const year = ym.length === 6 ? ym.slice(0, 4) : ym;
    const month = ym.length === 6 ? String(parseInt(ym.slice(4, 6), 10)) : ym;

    // 4) admin全員（is_admin=true, status=active）の slack_id を取得
    const { data: admins, error: adminError } = await db
      .from("members")
      .select("slack_id, code_name")
      .eq("is_admin", true)
      .eq("status", "active");
    if (adminError) {
      return json({ ok: false, message: `admins取得失敗: ${adminError.message}` }, 500);
    }

    const targets = (admins ?? []).filter((a) => a.slack_id);
    if (targets.length === 0) {
      return json({ ok: true, message: "送信対象の admin がいません（slack_id未設定）" });
    }

    const messageText = [
      `💰 *${projectName}* ${year}年${month}分の予算が申告されました`,
      "",
      `申告者: *${pmName}*`,
      "",
      `AMD OS を開いて *Admin → 予算承認* から確認・承認をお願いします！`,
    ].join("\n");

    // 5) 各 admin に DM 送信
    const results: { admin: string; ok: boolean; error?: string }[] = [];
    for (const admin of targets) {
      const openRes = await fetch("https://slack.com/api/conversations.open", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${slackToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ users: admin.slack_id }),
      });
      const openData = await openRes.json();
      if (!openData.ok) {
        results.push({ admin: admin.code_name, ok: false, error: openData.error });
        continue;
      }

      const postRes = await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${slackToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          channel: openData.channel.id,
          text: messageText,
        }),
      });
      const postData = await postRes.json();
      results.push({
        admin: admin.code_name,
        ok: postData.ok,
        error: postData.ok ? undefined : postData.error,
      });
    }

    const allOk = results.every((r) => r.ok);
    return json({ ok: allOk, results });
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
