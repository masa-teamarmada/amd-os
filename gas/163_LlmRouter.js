/** 163_LlmRouter.gs
 * 用途別LLMルーター。usageKeyに応じてモデル・プロバイダを切り替える。
 *
 * 公開関数：
 *  - llm_call(usageKey, systemPrompt, userPrompt, opts)
 *  - llm_callJson(usageKey, systemPrompt, userPrompt, opts) — JSON返却を期待
 *  - llm_getConfig(usageKey)
 *  - admin_listLlmModelConfigs()
 *  - admin_upsertLlmModelConfig(payload)
 *
 * DB: DB_LlmModelConfig（本体スプシ）
 */

// ===== 公開API =====

/**
 * LLM呼び出し（テキスト返却）
 * @param {string} usageKey - 用途キー（tsukuyomi_chat, monthly_report 等）
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @param {object} opts - { maxTokens, temperature } で上書き可能
 * @return {string} LLMの返答テキスト
 */
function llm_call(usageKey, systemPrompt, userPrompt, opts) {
  opts = opts || {};
  var cfg = llm_getConfig(usageKey);
  var provider = String(cfg.provider || "anthropic").trim().toLowerCase();
  var model = String(cfg.model || "").trim();
  var maxTokens = Number(opts.maxTokens || cfg.maxTokens || 1024);
  var temperature = (opts.temperature !== undefined) ? Number(opts.temperature) : Number(cfg.temperature || 0.7);

  if (provider === "openai") {
    return llm_callOpenAi_(model, systemPrompt, userPrompt, maxTokens, temperature);
  }
  if (provider === "gemini" || provider === "google") {
    return llm_callGemini_(model, systemPrompt, userPrompt, maxTokens, temperature);
  }
  return llm_callAnthropic_(model, systemPrompt, userPrompt, maxTokens, temperature);
}

/**
 * LLM呼び出し（JSON返却を期待。パース済みオブジェクトを返す）
 */
function llm_callJson(usageKey, systemPrompt, userPrompt, opts) {
  var raw = llm_call(usageKey, systemPrompt, userPrompt, opts);
  return llm_parseJsonSafe_(raw);
}

/**
 * usageKeyに対応する設定を返す（なければdefault）
 */
function llm_getConfig(usageKey) {
  var key = String(usageKey || "default").trim();
  var all = llm_readAllConfigs_();

  for (var i = 0; i < all.length; i++) {
    if (String(all[i].usageKey || "").trim() === key) return all[i];
  }
  // fallback to default
  for (var j = 0; j < all.length; j++) {
    if (String(all[j].usageKey || "").trim() === "default") return all[j];
  }
  // ultimate fallback
  return {
    usageKey: "default",
    provider: "anthropic",
    model: "claude-sonnet-4-5-20250929",
    maxTokens: 1024,
    temperature: 0.7,
    notes: "hardcoded fallback"
  };
}

// ===== Admin API =====

function admin_listLlmModelConfigs() {
  return { ok: true, rows: llm_readAllConfigs_() };
}

function admin_upsertLlmModelConfig(payload) {
  payload = payload || {};
  var usageKey = String(payload.usageKey || "").trim();
  if (!usageKey) return { ok: false, message: "usageKey empty" };

  var provider = String(payload.provider || "anthropic").trim().toLowerCase();
  if (provider !== "openai" && provider !== "anthropic" && provider !== "gemini" && provider !== "google") {
    return { ok: false, message: "provider must be 'anthropic' | 'openai' | 'gemini'" };
  }

  var model = String(payload.model || "").trim();
  if (!model) return { ok: false, message: "model empty" };

  var sh = llm_ensureSheet_();
  var header = llm_headerMap_(sh);
  var lastRow = sh.getLastRow();
  var now = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd HH:mm:ss");

  // 既存行を探す
  var targetRow = 0;
  if (lastRow >= 2) {
    var vals = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
    for (var i = 0; i < vals.length; i++) {
      if (String(vals[i][header.usageKey - 1] || "").trim() === usageKey) {
        targetRow = i + 2;
        break;
      }
    }
  }

  var obj = {
    usageKey: usageKey,
    provider: provider,
    model: model,
    maxTokens: String(payload.maxTokens || 1024),
    temperature: String(payload.temperature !== undefined ? payload.temperature : 0.7),
    notes: String(payload.notes || "").trim(),
    updatedAt: now
  };

  if (targetRow >= 2) {
    llm_writeRow_(sh, header, targetRow, obj);
    return { ok: true, mode: "update", usageKey: usageKey };
  }

  var newRow = lastRow + 1;
  llm_writeRow_(sh, header, newRow, obj);
  return { ok: true, mode: "insert", usageKey: usageKey };
}

// ===== Anthropic =====

function llm_callAnthropic_(model, systemPrompt, userPrompt, maxTokens, temperature) {
  var props = PropertiesService.getScriptProperties();
  var apiKey = String(props.getProperty("ANTHROPIC_API_KEY") || "").trim();
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY missing");
  if (!model) model = "claude-sonnet-4-5-20250929";

  var payload = {
    model: model,
    max_tokens: maxTokens || 1024,
    temperature: (temperature !== undefined && temperature !== null) ? temperature : 0.7,
    system: String(systemPrompt || "").trim(),
    messages: [
      { role: "user", content: String(userPrompt || "").trim() }
    ]
  };

  var resp = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", {
    method: "post",
    contentType: "application/json",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  var code = resp.getResponseCode();
  var text = resp.getContentText();
  if (code < 200 || code >= 300) {
    throw new Error("Anthropic API " + code + ": " + text.slice(0, 300));
  }

  var data = JSON.parse(text);
  if (data.error) throw new Error("Anthropic: " + (data.error.message || JSON.stringify(data.error)));

  var content = Array.isArray(data.content) ? data.content : [];
  for (var i = 0; i < content.length; i++) {
    if (content[i].type === "text" && content[i].text) {
      return String(content[i].text).trim();
    }
  }
  return "";
}

// ===== OpenAI =====

function llm_callOpenAi_(model, systemPrompt, userPrompt, maxTokens, temperature) {
  var props = PropertiesService.getScriptProperties();
  var apiKey = String(props.getProperty("OPENAI_API_KEY") || "").trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY missing");
  if (!model) model = "gpt-4o-mini";

  // OpenAI Responses API
  var payload = {
    model: model,
    input: [
      { role: "system", content: String(systemPrompt || "").trim() },
      { role: "user", content: String(userPrompt || "").trim() }
    ],
    max_output_tokens: maxTokens || 1024,
    temperature: (temperature !== undefined && temperature !== null) ? temperature : 0.7
  };

  var resp = UrlFetchApp.fetch("https://api.openai.com/v1/responses", {
    method: "post",
    contentType: "application/json",
    headers: { "Authorization": "Bearer " + apiKey },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  var code = resp.getResponseCode();
  var text = resp.getContentText();
  if (code < 200 || code >= 300) {
    throw new Error("OpenAI API " + code + ": " + text.slice(0, 300));
  }

  var data = JSON.parse(text);
  if (data.error) throw new Error("OpenAI: " + JSON.stringify(data.error));

  // output_text（新API）
  if (data.output_text) return String(data.output_text).trim();

  // fallback: output[].content[].text
  try {
    var output = Array.isArray(data.output) ? data.output : [];
    for (var i = 0; i < output.length; i++) {
      var content = Array.isArray(output[i].content) ? output[i].content : [];
      for (var j = 0; j < content.length; j++) {
        if (content[j].type === "output_text" && content[j].text) {
          return String(content[j].text).trim();
        }
      }
    }
  } catch (_e) {}

  return "";
}

// ===== Gemini =====

function llm_callGemini_(model, systemPrompt, userPrompt, maxTokens, temperature) {
  var props = PropertiesService.getScriptProperties();
  var apiKey = String(props.getProperty("GEMINI_API_KEY") || "").trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY missing");
  if (!model) model = "gemini-2.5-flash";

  // v1beta generateContent。systemInstruction を別フィールドで渡す。
  var endpoint = "https://generativelanguage.googleapis.com/v1beta/models/" +
                 encodeURIComponent(model) + ":generateContent?key=" + encodeURIComponent(apiKey);

  var payload = {
    contents: [
      { role: "user", parts: [{ text: String(userPrompt || "").trim() }] }
    ],
    generationConfig: {
      maxOutputTokens: Number(maxTokens || 1024),
      temperature: (temperature !== undefined && temperature !== null) ? Number(temperature) : 0.7
    }
  };
  var sys = String(systemPrompt || "").trim();
  if (sys) {
    payload.systemInstruction = { role: "system", parts: [{ text: sys }] };
  }

  var resp = UrlFetchApp.fetch(endpoint, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  var code = resp.getResponseCode();
  var text = resp.getContentText();
  if (code < 200 || code >= 300) {
    throw new Error("Gemini API " + code + ": " + text.slice(0, 500));
  }

  var data = JSON.parse(text);
  if (data.error) throw new Error("Gemini: " + (data.error.message || JSON.stringify(data.error)));

  var candidates = Array.isArray(data.candidates) ? data.candidates : [];
  for (var i = 0; i < candidates.length; i++) {
    var parts = candidates[i].content && Array.isArray(candidates[i].content.parts) ? candidates[i].content.parts : [];
    for (var j = 0; j < parts.length; j++) {
      if (parts[j].text) return String(parts[j].text).trim();
    }
  }
  return "";
}

// ===== DB I/O =====

var LLM_CONFIG_HEADERS_ = [
  "usageKey", "provider", "model", "maxTokens", "temperature", "notes", "updatedAt"
];

function llm_ensureSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName("DB_LlmModelConfig");
  if (!sh) {
    sh = ss.insertSheet("DB_LlmModelConfig");
    sh.getRange(1, 1, 1, LLM_CONFIG_HEADERS_.length).setValues([LLM_CONFIG_HEADERS_]);
  } else {
    var cur = sh.getRange(1, 1, 1, sh.getLastColumn() || 1).getValues()[0].map(function(v) { return String(v || "").trim(); });
    var missing = [];
    for (var i = 0; i < LLM_CONFIG_HEADERS_.length; i++) {
      if (cur.indexOf(LLM_CONFIG_HEADERS_[i]) === -1) missing.push(LLM_CONFIG_HEADERS_[i]);
    }
    if (missing.length) {
      var col = (sh.getLastColumn() || 0) + 1;
      for (var j = 0; j < missing.length; j++) {
        sh.getRange(1, col + j).setValue(missing[j]);
      }
    }
  }
  return sh;
}

function llm_headerMap_(sh) {
  var row = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var map = {};
  for (var i = 0; i < row.length; i++) {
    var k = String(row[i] || "").trim();
    if (k) map[k] = i + 1;
  }
  return map;
}

function llm_readAllConfigs_() {
  var sh;
  try { sh = llm_ensureSheet_(); } catch (_e) { return []; }
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return [];
  var header = llm_headerMap_(sh);
  var vals = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
  var out = [];
  for (var i = 0; i < vals.length; i++) {
    var r = vals[i];
    var uk = String(r[(header.usageKey || 1) - 1] || "").trim();
    if (!uk) continue;
    out.push({
      usageKey: uk,
      provider: String(r[(header.provider || 2) - 1] || "").trim(),
      model: String(r[(header.model || 3) - 1] || "").trim(),
      maxTokens: Number(r[(header.maxTokens || 4) - 1] || 1024),
      temperature: Number(r[(header.temperature || 5) - 1] || 0.7),
      notes: String(r[(header.notes || 6) - 1] || "").trim(),
      updatedAt: String(r[(header.updatedAt || 7) - 1] || "").trim()
    });
  }
  return out;
}

function llm_writeRow_(sh, header, rowIndex, obj) {
  var lastCol = sh.getLastColumn();
  var cur;
  try {
    cur = sh.getRange(rowIndex, 1, 1, lastCol).getValues()[0];
  } catch (_e) {
    cur = new Array(lastCol).fill("");
  }
  Object.keys(obj).forEach(function(k) {
    var col = header[k];
    if (col) cur[col - 1] = obj[k];
  });
  sh.getRange(rowIndex, 1, 1, lastCol).setValues([cur]);
}

function llm_parseJsonSafe_(raw) {
  var s = String(raw || "").trim();
  if (!s) return null;
  s = s.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  try { return JSON.parse(s); } catch (_e) { return null; }
}
