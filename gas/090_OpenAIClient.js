/** 090_OpenAIClient.gs
 * OpenAI Responses API client
 */

function openaiGetApiKey(){
  const key = String(PropertiesService.getScriptProperties().getProperty("OPENAI_API_KEY") || "").trim();
  if (!key) throw new Error("OPENAI_API_KEY not set");
  return key;
}

function openaiGetModelName(){
  const m = String(PropertiesService.getScriptProperties().getProperty("OPENAI_MODEL") || "").trim();
  if (!m) throw new Error("OPENAI_MODEL not set");
  return m;
}

function openaiResponsesJsonSchema(promptText, jsonSchemaObj){
  const apiKey = openaiGetApiKey();
  const model = openaiGetModelName();

  const url = "https://api.openai.com/v1/responses";

  const body = {
    model: model,
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: String(promptText || "") }
        ]
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "value_contributions",
        schema: jsonSchemaObj,
        strict: true
      }
    }
  };

  const res = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(body),
    muteHttpExceptions: true,
    headers: {
      "Authorization": "Bearer " + apiKey
    }
  });

  const code = res.getResponseCode();
  const raw = res.getContentText() || "";
  if (code < 200 || code >= 300){
    throw new Error("OpenAI API error: " + code + " " + raw.slice(0, 500));
  }

  const obj = JSON.parse(raw);

  // Responses API は output の中に text が入ることが多い
  // いろんな形に耐えるように抽出
  let text = "";
  try{
    const out = Array.isArray(obj.output) ? obj.output : [];
    for (const item of out){
      const content = Array.isArray(item.content) ? item.content : [];
      for (const c of content){
        if (c && (c.type === "output_text" || c.type === "text") && c.text){
          text += String(c.text);
        }
      }
    }
  } catch(e){}

  if (!text) {
    // fallback
    if (obj && obj.output_text) text = String(obj.output_text);
  }

  if (!text) throw new Error("OpenAI response text empty");

  return JSON.parse(text);
}

// ---------------- OpenAI client (Navigator Monthly Field Fix) ----------------
function _openai_fixNavigatorMonthlyFieldByFeedback_(inputObj){
  inputObj = inputObj || {};

  const projectId = String(inputObj.projectId || "").trim();
  const ym = String(inputObj.ym || "").trim();
  const fieldKey = String(inputObj.fieldKey || "").trim();
  const currentText = String(inputObj.currentText || "");
  const feedback = String(inputObj.feedback || "");
  const itemsText = String(inputObj.itemsText || "");
  const pastCorrectionsText = String(inputObj.pastCorrectionsText || "");

  if (!projectId) throw new Error("projectId empty");
  if (!/^\d{6}$/.test(ym)) throw new Error("ym invalid (yyyymm)");
  if (!fieldKey) throw new Error("fieldKey empty");
  if (!feedback.trim()) throw new Error("feedback empty");

  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      text: { type: "string" },
      reason: { type: "string" }
    },
    required: ["text","reason"]
  };

  const prompt = [
    "あなたはAMD OSのNavigator『月次サマリ』の編集者。",
    "人間から「ここが間違ってる/こう直したい」というフィードバックが来た。",
    "根拠ログ（items）に反しないように、対象フィールドだけを修正する。",
    "",
    "ルール：",
    "- 出力はJSONのみ（text, reason）。",
    "- textは“このフィールドの完成文”だけ返す。余計な説明を混ぜない。",
    "- 誇張禁止。事実が不明なら『未検証/要確認』に倒す。",
    "- フィードバックを最優先。ただし根拠ログと矛盾する断言は禁止。",
    "",
    "固有名詞ルール（重要）：",
    "- 人名/社名/組織名などの固有名詞は、原文から“勝手に削除しない”。",
    "- 固有名詞を削除・追加・置換する場合は、reasonに必ず明記する。",
    "- フィードバックが『特定の名前が違和感』の場合、その名前を削除するだけでなく、他の固有名詞（例：別の名前）を勝手に消して整形しない。",
    "",
    "書き換え方針：",
    "- 『名前が違和感』のような指摘は、まず匿名化（例：『協力者』）や役割表現（例：『関係者』）への置換で解決する。",
    "- ただし、原文に複数名いるなら、複数名の構造は維持する（削除しない）。",
    "",
    `projectId: ${projectId}`,
    `ym: ${ym}`,
    `fieldKey: ${fieldKey}`,
    "",
    "=== 過去のHuman Fixes（好み/注意点） ===",
    pastCorrectionsText ? pastCorrectionsText : "(none)",
    "",
    "=== 現在の文章（このフィールド） ===",
    currentText || "(empty)",
    "",
    "=== 人間のフィードバック（誤り指摘/修正指示） ===",
    feedback,
    "",
    "=== 根拠ログ（items 抜粋） ===",
    itemsText || "(none)"
  ].join("\n");

  const obj = openaiResponsesJsonSchema(prompt, schema);

  const text = String(obj && obj.text ? obj.text : "").trim();
  const reason = String(obj && obj.reason ? obj.reason : "").trim();

  if (!text) throw new Error("LLM fix returned empty text");

  return { text:text, reason:reason };
}
