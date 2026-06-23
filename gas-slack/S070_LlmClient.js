/** S070_LlmClient.gs
 * LLM呼び出し。persona別に backend を切り替える。
 *   - tsukuyomi (default): Anthropic Claude
 *   - eimi               : Sakana Fugu (OpenAI互換、$100サブスク定額枠)
 */

function llm_call_(systemPrompt, userPrompt, opts) {
  const options = opts || {};
  const persona = String(options.persona || "").trim();

  if (persona === "eimi") {
    return llm_call_fugu_(systemPrompt, userPrompt, options);
  }
  return llm_call_claude_(systemPrompt, userPrompt, options);
}

function llm_call_claude_(systemPrompt, userPrompt, options) {
  const apiKey = utils_getProp_("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY missing");

  const model = options.model || "claude-sonnet-4-5-20250929";
  const maxTokens = options.maxTokens || 1500;
  const temperature = options.temperature == null ? 0.8 : options.temperature;

  const res = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", {
    method: "post",
    contentType: "application/json",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    payload: JSON.stringify({
      model: model,
      max_tokens: maxTokens,
      temperature: temperature,
      system: String(systemPrompt || ""),
      messages: [{ role: "user", content: String(userPrompt || "") }]
    }),
    muteHttpExceptions: true
  });

  const obj = JSON.parse(res.getContentText() || "{}");
  if (obj.error) throw new Error("Anthropic error: " + JSON.stringify(obj.error));

  const content = Array.isArray(obj.content) ? obj.content : [];
  for (let i = 0; i < content.length; i++) {
    if (content[i].type === "text" && content[i].text) {
      return String(content[i].text).trim();
    }
  }
  return "";
}

/**
 * Sakana Fugu (OpenAI互換) 呼び出し。
 * 必要な Script Properties:
 *   FUGU_API_KEY          — Sakanaコンソールで発行
 *   FUGU_BASE_URL         — 既定 https://api.sakana.ai/v1
 *   FUGU_MODEL_OVERRIDE   — 任意。'fugu' / 'fugu-ultra'
 *
 * options.usageRef に {} を渡すと、戻り時に
 *   { usage: {prompt_tokens, completion_tokens, total_tokens, ...}, model }
 * を書き込む (呼び出し側が footer 生成や log保存に使う)。
 */
function llm_call_fugu_(systemPrompt, userPrompt, options) {
  const apiKey = utils_getProp_("FUGU_API_KEY");
  if (!apiKey) throw new Error("FUGU_API_KEY missing");

  const baseUrl = (utils_getProp_("FUGU_BASE_URL") || "https://api.sakana.ai/v1").replace(/\/$/, "");
  const model = String(utils_getProp_("FUGU_MODEL_OVERRIDE") || "fugu").trim();
  const maxTokens = options.maxTokens || 1500;
  const temperature = options.temperature == null ? 0.8 : options.temperature;

  const res = UrlFetchApp.fetch(baseUrl + "/chat/completions", {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + apiKey },
    payload: JSON.stringify({
      model: model,
      max_tokens: maxTokens,
      temperature: temperature,
      messages: [
        { role: "system", content: String(systemPrompt || "") },
        { role: "user", content: String(userPrompt || "") }
      ]
    }),
    muteHttpExceptions: true
  });

  const status = res.getResponseCode();
  const text = res.getContentText() || "";
  if (status < 200 || status >= 300) {
    throw new Error("Fugu " + status + ": " + text.substring(0, 500));
  }

  let json;
  try { json = JSON.parse(text); } catch(_e) {
    throw new Error("Fugu response not JSON: " + text.substring(0, 200));
  }

  const choice = (json.choices && json.choices[0]) || {};
  const content = (choice.message && choice.message.content) || "";
  const modelUsed = String(json.model || model);
  const usage = json.usage || {};

  if (options.usageRef && typeof options.usageRef === "object") {
    options.usageRef.usage = usage;
    options.usageRef.model = modelUsed;
  }

  return String(content).trim();
}