/**
 * knowledge-session-slack
 * action=draft: ナレッジ会アナウンス文の草案を作成
 * action=post:  指定チャンネルに投稿し、knowledge_sessions に投稿情報を保存
 *
 * Required secrets:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - SLACK_BOT_TOKEN (post時)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

type DraftBody = {
  action: "draft";
  baseYm: string;
  eventDate?: string;
  venueName?: string;
  venueAddress?: string;
  venueLink?: string;
  participantNames?: string[];
  messageToPm?: string;
  revisionPrompt?: string;
  previousDraft?: string;
};

type PostBody = {
  action: "post";
  baseYm: string;
  channelId: string;
  text: string;
  postedByEmail?: string;
  isTest?: boolean;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json() as DraftBody | PostBody;

    if (!body?.action) {
      return json({ ok: false, message: "action が必要です" }, 400);
    }

    if (body.action === "draft") {
      let draft = "";
      const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
      if (anthropicKey) {
        try {
          draft = await buildDraftWithLLM(body, anthropicKey);
        } catch {
          draft = buildDraft(body);
        }
      } else {
        draft = buildDraft(body);
      }
      return json({ ok: true, draft, message: "草案を生成しました" });
    }

    const payload = body as PostBody;
    if (!payload.channelId || !payload.text || !payload.baseYm) {
      return json({ ok: false, message: "channelId / text / baseYm が必要です" }, 400);
    }

    const slackToken = Deno.env.get("SLACK_BOT_TOKEN");
    if (!slackToken) {
      return json({ ok: false, message: "SLACK_BOT_TOKEN が未設定です" }, 500);
    }

    const postRes = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${slackToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channel: payload.channelId,
        text: payload.text,
      }),
    });
    const postData = await postRes.json();
    if (!postData.ok) {
      return json({ ok: false, message: `Slack投稿エラー: ${postData.error ?? "unknown"}` }, 500);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(supabaseUrl, serviceRole);
    await db
      .from("knowledge_sessions")
      .upsert({
        base_ym: payload.baseYm,
        announcement_draft: payload.text,
        announcement_channel_id: payload.channelId,
        announcement_posted_at: new Date().toISOString(),
        announcement_posted_by: payload.postedByEmail ?? "",
        updated_at: new Date().toISOString(),
      }, { onConflict: "base_ym" });

    return json({
      ok: true,
      message: payload.isTest ? "テスト投稿しました" : "all-pm に投稿しました",
      channel: payload.channelId,
      ts: postData.ts ?? "",
    });
  } catch (e) {
    return json({ ok: false, message: String((e as Error).message ?? e) }, 500);
  }
});

function buildDraft(input: DraftBody): string {
  const ym = input.baseYm?.length === 6
    ? `${input.baseYm.slice(0, 4)}年${Number(input.baseYm.slice(4, 6))}月稼働分`
    : input.baseYm;
  const eventDate = input.eventDate || "（日程未設定）";
  const venue = input.venueName || "（場所未設定）";
  const venueAddress = input.venueAddress?.trim() ? `\n住所: ${input.venueAddress}` : "";
  const venueLink = input.venueLink?.trim() ? `\nリンク: ${input.venueLink}` : "";
  const members = (input.participantNames ?? []).length > 0
    ? (input.participantNames ?? []).join("、")
    : "PM各位";
  const memo = input.messageToPm?.trim()
    ? `\n\n補足（adminより）\n${input.messageToPm.trim()}`
    : "";

  if (input.revisionPrompt?.trim()) {
    return `${input.previousDraft ?? ""}\n\n---\n修正意図:\n${input.revisionPrompt.trim()}\n\n（上記意図を反映して文面を調整してください）`;
  }

  return [
    "【ナレッジ会開催のご案内】",
    "",
    `${ym} の報告会はオフライン開催（ナレッジ会）で実施します。`,
    `開催日: ${eventDate}`,
    `開催場所: ${venue}${venueAddress}${venueLink}`,
    "",
    `参加者: ${members}`,
    memo,
    "",
    "当日は各PJの学びや工夫を持ち寄って、相互にシェアしていきましょう。",
  ].join("\n");
}

async function buildDraftWithLLM(input: DraftBody, apiKey: string): Promise<string> {
  const ym = input.baseYm?.length === 6
    ? `${input.baseYm.slice(0, 4)}年${Number(input.baseYm.slice(4, 6))}月稼働分`
    : input.baseYm;
  const eventDate = input.eventDate || "未設定";
  const venueName = input.venueName || "未設定";
  const venueAddress = input.venueAddress || "";
  const venueLink = input.venueLink || "";
  const members = (input.participantNames ?? []).join("、");
  const messageToPm = input.messageToPm || "";
  const revisionPrompt = input.revisionPrompt || "";
  const previousDraft = input.previousDraft || "";

  const system = "あなたはAMD OSの月次運用アシスタント「つくよみ」です。Slack告知文を、親しみやすく簡潔に日本語で作成してください。";
  const user = [
    `対象: ${ym}`,
    `開催日: ${eventDate}`,
    `開催場所: ${venueName}`,
    `住所: ${venueAddress}`,
    `リンク: ${venueLink}`,
    `参加者: ${members || "PM各位"}`,
    `adminメモ: ${messageToPm || "なし"}`,
    revisionPrompt ? `修正指示: ${revisionPrompt}` : "",
    previousDraft ? `前回草案:\n${previousDraft}` : "",
    "出力はSlack投稿本文のみ。過度に長くせず、最後に一言ポジティブな締めを入れる。"
  ].filter(Boolean).join("\n");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 700,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}`);
  const data = await res.json() as {
    content?: { type: string; text?: string }[];
  };
  const text = data.content?.find((x) => x.type === "text")?.text?.trim();
  if (!text) throw new Error("Anthropic empty response");
  return text;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
