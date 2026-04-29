/**
 * cancel-invoice
 * 請求書 / 見積書の発行を取り消す Edge Function。
 * freee上のキャンセルは行わず、billing_cycles の発行情報をリセットする。
 * （実際のfreeeキャンセルはfreeeダッシュボードで手動対応）
 *
 * Optional secrets: SLACK_BOT_TOKEN
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
    const { projectId, ym, documentType } = await req.json() as {
      projectId: string;
      ym: string;
      documentType?: "invoice" | "quotation";
    };

    if (!projectId || !ym) {
      return json({ ok: false, message: "projectId / ym が必要" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(supabaseUrl, serviceKey);

    const kind = documentType === "quotation" ? "quotation" : "invoice";

    // 1) billing_cycles の発行フィールドをリセット（明細は保持）
    let updateBody = kind === "quotation"
      ? {}
      : {
        invoice_issued_at: null,
        invoice_issued_by: null,
        freee_invoice_number: null,
        invoice_pdf_url: null,
        invoice_sent_at: null,
        invoice_sent_by: null,
      };

    if (kind === "quotation") {
      const { data: cycles } = await db.from("billing_cycles")
        .select("invoice_base_lines_json")
        .eq("project_id", projectId)
        .eq("ym", ym)
        .limit(1);
      const strippedLines = stripEstimateMarker(String(cycles?.[0]?.invoice_base_lines_json ?? ""));
      updateBody = {
        invoice_base_lines_json: strippedLines,
      };
    }

    let error = null;
    if (Object.keys(updateBody).length > 0) {
      const result = await db.from("billing_cycles").update(updateBody)
        .eq("project_id", projectId)
        .eq("ym", ym);
      error = result.error;
    }

    if (error) {
      return json({ ok: false, message: `DB更新失敗: ${error.message}` }, 500);
    }

    // 2) Slack通知（SLACK_BOT_TOKEN がある場合のみ）
    const slackToken = Deno.env.get("SLACK_BOT_TOKEN");
    if (slackToken) {
      try {
        const { data: projects } = await db
          .from("projects")
          .select("project_name, slack_channel_id")
          .eq("project_id", projectId)
          .limit(1);
        const pj = projects?.[0];
        const pjName = pj?.project_name ?? projectId;
        const channelId = pj?.slack_channel_id;
        const year = ym.slice(0, 4);
        const month = String(parseInt(ym.slice(4, 6)));

        if (channelId) {
          const documentLabel = kind === "quotation" ? "見積書" : "請求書";
          await fetch("https://slack.com/api/chat.postMessage", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${slackToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              channel: channelId,
              text: `🔔 *${pjName}*（${year}年${month}月分）の${documentLabel}発行が取り消されたよ！`,
            }),
          });
        }
      } catch (_) { /* Slack通知失敗はエラーにしない */ }
    }

    return json({ ok: true, message: kind === "quotation" ? "見積書発行を取り消したよ" : "請求書発行を取り消したよ" });
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

function stripEstimateMarker(rawJson: string): string | null {
  const marker = "[[CTB_ESTIMATE_SENT]]";
  if (!rawJson) return null;
  try {
    const parsed = JSON.parse(rawJson) as Array<Record<string, unknown>>;
    const filtered = parsed.filter((row) => row?.description !== marker);
    return filtered.length > 0 ? JSON.stringify(filtered) : null;
  } catch {
    return rawJson;
  }
}
