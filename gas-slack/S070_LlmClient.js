/** S070_LlmClient.gs
 * Anthropic API呼び出し。Claude専用。
 */

function llm_call_(systemPrompt, userPrompt, opts) {
  const apiKey = utils_getProp_("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY missing");

  const options = opts || {};
  const model = options.model || "claude-sonnet-4-5-20250929";
  const maxTokens = options.maxTokens || 1500;
  const temperature = options.temperature || 0.8;

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