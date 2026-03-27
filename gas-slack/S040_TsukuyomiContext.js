/** S040_TsukuyomiContext.gs
 * つくよみのsystemPrompt構築。
 * DB_TsukuyomiContextのtags=tsukuyomiをpriority降順で結合。
 * DB_TsukuyomiMemoryのAMD分は常時注入、PJ固有分はprojectId指定時のみ注入。
 * プロンプトの中身はすべてDBで管理する。
 */

function context_getMainSs_() {
  const id = utils_getProp_("MAIN_SPREADSHEET_ID");
  if (!id) throw new Error("MAIN_SPREADSHEET_ID missing");
  return SpreadsheetApp.openById(id);
}

function context_getNavSs_() {
  const id = utils_getProp_("NAVIGATOR_SPREADSHEET_ID");
  if (!id) throw new Error("NAVIGATOR_SPREADSHEET_ID missing");
  return SpreadsheetApp.openById(id);
}

function context_readSheet_(sheetName) {
  const ss = context_getMainSs_();
  const sh = ss.getSheetByName(sheetName);
  if (!sh) return [];
  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2) return [];
  const header = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(v => String(v || "").trim());
  const rows = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();
  return rows.map(r => {
    const obj = {};
    header.forEach((h, i) => { if (h) obj[h] = String(r[i] || "").trim(); });
    return obj;
  });
}

function context_readNavSheet_(sheetName) {
  const ss = context_getNavSs_();
  const sh = ss.getSheetByName(sheetName);
  if (!sh) return [];
  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2) return [];
  const header = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(v => String(v || "").trim());
  const rows = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();
  return rows.map(r => {
    const obj = {};
    header.forEach((h, i) => { if (h) obj[h] = String(r[i] || "").trim(); });
    return obj;
  });
}

function context_buildMemoryBlock_(projectId) {
  const rows = context_readNavSheet_("DB_TsukuyomiMemory");
  const active = rows.filter(r => r.status === "active" && r.content);

  const amdRows = active.filter(r => r.projectId === "AMD");
  const pjRows = projectId ? active.filter(r => r.projectId === projectId) : [];

  const lines = [];
  if (amdRows.length > 0) {
    lines.push("【AMDナレッジ】");
    amdRows.forEach(r => lines.push("- " + r.content));
  }
  if (pjRows.length > 0) {
    lines.push("【" + projectId + " ナレッジ】");
    pjRows.forEach(r => lines.push("- " + r.content));
  }

  return lines.join("\n").trim();
}

function context_getProjectIdByChannelId_(channelId) {
  channelId = String(channelId || "").trim();
  if (!channelId) return null;
  const ss = context_getMainSs_();
  const sh = ss.getSheetByName("DB_Projects");
  if (!sh) return null;
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return null;
  const lastCol = sh.getLastColumn();
  const header = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(v => String(v || "").trim());
  const rows = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();
  const iCh = header.indexOf("slackChannelId");
  const iPj = header.indexOf("projectId");
  if (iCh < 0 || iPj < 0) return null;
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][iCh] || "").trim() === channelId) {
      return String(rows[i][iPj] || "").trim() || null;
    }
  }
  return null;
}

function context_extractAndSaveMemory_(threadHistory, channelId) {
  const rows = context_readSheet_("DB_TsukuyomiContext");
  const promptRow = rows.find(r => {
    const tags = r.tags ? r.tags.split(",").map(s => s.trim()) : [];
    return tags.includes("memory_extract") && r.status === "active" && r.systemPrompt;
  });
  if (!promptRow) return;

  const projectId = context_getProjectIdByChannelId_(channelId) || "AMD";

  const historyText = (Array.isArray(threadHistory) ? threadHistory : [])
    .map(m => {
      const who = m.bot_id ? "つくよみ" : "ユーザー";
      return "[" + who + "] " + String(m.text || "").replace(/\s+/g, " ").trim();
    })
    .filter(l => l.length > 10)
    .join("\n");

  if (!historyText) return;

  const userPrompt = "以下のSlack会話から記憶を抽出してください。\n\nPJ文脈: " + projectId + "\n\n会話:\n" + historyText;

  const raw = llm_call_(promptRow.systemPrompt, userPrompt, { maxTokens: 800, temperature: 0.2 });
  if (!raw) return;

  let entries;
  try {
    const clean = raw.replace(/```json|```/g, "").trim();
    entries = JSON.parse(clean);
  } catch(e) {
    return;
  }

  if (!Array.isArray(entries) || entries.length === 0) return;

  const ss = context_getNavSs_();
  const sh = ss.getSheetByName("DB_TsukuyomiMemory");
  if (!sh) return;

  const now = utils_jstNow_();
  const jstLabel = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy年M月d日");

  entries.forEach((e, idx) => {
    const pjId = String(e.projectId || projectId).trim();
    const content = String(e.content || "").trim();
    if (!content) return;
    const memId = "mem_" + pjId + "_sl_" + Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyyMMddHHmmss") + "_" + idx;
    sh.appendRow([memId, pjId, content, "slack_conversation", "active", jstLabel, jstLabel]);
  });
}

function context_buildSystemPrompt_(projectId) {
  const rows = context_readSheet_("DB_TsukuyomiContext");

  const tsukuRows = rows
    .filter(r => {
      const tags = r.tags ? r.tags.split(",").map(s => s.trim()) : [];
      return tags.includes("tsukuyomi") && r.status === "active" && r.systemPrompt;
    })
    .sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0));

  const parts = tsukuRows.map(r => r.systemPrompt);

  const kb = rows.find(r => r.contextId === "tsukuyomi_knowledge_base" && r.status === "active");
  if (kb && kb.systemPrompt) {
    parts.push("【背景知識】\n" + kb.systemPrompt);
  }

  const memBlock = context_buildMemoryBlock_(projectId || null);
  if (memBlock) {
    parts.push("【記憶・ナレッジ】\n" + memBlock);
  }

  return parts.join("\n\n").trim();
}