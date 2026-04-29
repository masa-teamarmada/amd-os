/**
 * 170_TsukuyomiOps.gs
 *
 * 役割：
 * - Admin「つくよみ」タブから、PJ Slackチャンネルに手動投稿する
 * - つくよみタブ用にPJ一覧を返す
 *
 * 依存：
 * - 115_SlackNotify.gs の slackNotifyPostToChannel_ / slackNotifyGetProjectChannelId_
 * - b_readTableThin_ があればそれを優先（DB_Projects）
 */


function tsukuyomi_buildSystemPromptBase(payload){
  // systemPrompt合成の正本は172（DB_TsukuyomiContext）に寄せる
  payload = payload || {};
  const projectId = String(payload.projectId || "").trim();

  if (typeof tsukuyomi_buildSystemPromptBaseFromContextDb !== "function"){
    // ★フォールバックでも性格・分量・構成（次の一手等）を縛らない
    return (
      "あなたはSlack上で動くアシスタント「つくよみ」。\n" +
      "投稿時はチャンネルに1投稿する。\n" +
      "機密情報（トークン/署名/環境変数/内部ID等）は推測して書かない。憶測で断言しない。\n" +
      "煽り・人格否定・命令口調はしない。@channel/@here は使わない。"
    );
  }

  return tsukuyomi_buildSystemPromptBaseFromContextDb({ projectId, intent:"post" });
}

function tsukuyomi_appendSlackEventLog_(eventType, user, eventTs, note, rawLen){
  const sheetName = "DB_SlackEventLog";
  const sh = SpreadsheetApp.getActive().getSheetByName(sheetName);
  if (!sh) throw new Error("sheet not found: " + sheetName);

  // schema想定: atJst,type,eventType,user,eventTs,note,rawLen
  const atJst = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd'T'HH:mm:ssXXX");
  const row = [
    atJst,
    "internal",
    String(eventType || ""),
    String(user || ""),
    String(eventTs || ""),
    String(note || ""),
    String(rawLen || 0),
  ];
  sh.appendRow(row);
}

function escapeMrkdwnForTsukuyomi_(s){
  s = String(s || "");
  // @here/@channel 暴発防止（つくよみは煽らない月の人）
  s = s.replaceAll("@channel", "@\u200bchannel").replaceAll("@here", "@\u200bhere");
  return s;
}

// ★ 既存のLLM呼び出し関数に寄せる（このプロジェクト内の実体に合わせて勝つ）
function tsukuyomi_callLlmText(systemPrompt, userPrompt){
  const props = PropertiesService.getScriptProperties();
  const apiKey = String(props.getProperty("OPENAI_API_KEY") || "").trim();
  const model  = String(props.getProperty("OPENAI_MODEL") || "gpt-4o-mini").trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY missing");

  const input = [
    { role: "system", content: String(systemPrompt || "") },
    { role: "user", content: String(userPrompt || "") }
  ];

  const payload = {
    model,
    input,
    // text.format を指定しない＝普通に文章で返させる
    store: false
  };

  const resp = UrlFetchApp.fetch("https://api.openai.com/v1/responses", {
    method: "post",
    muteHttpExceptions: true,
    headers: {
      "Authorization": "Bearer " + apiKey,
      "Content-Type": "application/json"
    },
    payload: JSON.stringify(payload)
  });

  const code = resp.getResponseCode();
  const text = resp.getContentText();
  if (code < 200 || code >= 300){
    throw new Error("OpenAI API failed: " + code + " " + text);
  }

  const json = JSON.parse(text);

  // 既存のヘルパーがあるならそれを使う（NotionProtocolSync.gs にあるやつ）
  if (typeof _openai_extractOutputText_ === "function"){
    const outText = _openai_extractOutputText_(json);
    return String(outText || "").trim();
  }

  // フォールバック（念のため）
  const out = json.output || [];
  for (let i=0; i<out.length; i++){
    const o = out[i];
    const content = o.content || [];
    for (let k=0; k<content.length; k++){
      const c = content[k];
      if (c.type === "output_text" && c.text) return String(c.text).trim();
      if (c.text) return String(c.text).trim();
    }
  }
  if (json.output_text) return String(json.output_text).trim();

  throw new Error("No output text in Responses response");
}
