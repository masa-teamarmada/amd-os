/** 054_RewardScoring_EventExtract.gs
 * LLMによる月次報告書からの進捗イベント抽出＋3ファクター推定
 * 月次報告書(DB_MonthlyReports)を入力に、DB_ProgressEvents + DB_EventResponsibility へdraft書き込み
 */

function reward_extractEvents(payload) {
  payload = payload || {};
  var projectId = String(payload.projectId || "").trim();
  var ym = String(payload.ym || "").trim();
  if (!projectId) return { ok: false, message: "projectId required" };
  if (!ym) return { ok: false, message: "ym required" };

  // 1) 月次報告書を取得
  var report = reward_extract_getReport_(projectId, ym);
  if (!report) return { ok: false, message: "月次報告書が見つからない（projectId=" + projectId + ", ym=" + ym + "）" };

  var content = String(report.finalContent || "").trim() || String(report.draftContent || "").trim();
  if (!content) return { ok: false, message: "報告書の本文が空" };

  // 2) PJメンバー一覧を取得
  var members = reward_extract_getMembers_(projectId);

  // 3) PJ名を取得
  var projectName = reward_extract_getProjectName_(projectId);

  // 4) system promptをDB_TsukuyomiContextから取得
  var ctx = tsukuyomi_getActiveSystemPrompt({ tag: "rewardscoring" });
  var systemPrompt = (ctx && ctx.systemPrompt) ? ctx.systemPrompt : "";
  if (!systemPrompt) return { ok: false, message: "rewardscoring用のcontextが未設定" };

  // 5) user prompt組み立て
  var memberLines = members.map(function(m) {
    return "- memberId: " + m.memberId + " / 名前: " + m.name + " / 役割: " + m.roleLabel;
  }).join("\n");

  var userPrompt = "## PJ情報\n"
    + "- projectId: " + projectId + "\n"
    + "- PJ名: " + projectName + "\n"
    + "- 対象月: " + ym + "\n\n"
    + "## メンバー一覧\n"
    + (memberLines || "（メンバー情報なし）") + "\n\n"
    + "## 月次報告書\n"
    + content + "\n\n"
    + "上記の月次報告書から進捗イベントを抽出し、JSON形式で返してください。";

  // 6) LLM呼び出し
  var llmResult = reward_extract_callLlm_(systemPrompt, userPrompt);
  if (!llmResult.ok) return { ok: false, message: "LLM呼び出し失敗: " + (llmResult.message || "") };

  // 7) JSONパース
  var parsed = reward_extract_parseResponse_(llmResult.text);
  if (!parsed.ok) return { ok: false, message: "LLM応答のパース失敗: " + (parsed.message || "") };

  var events = parsed.events;
  if (!events.length) return { ok: true, message: "進捗イベントが抽出されなかった", eventCount: 0 };

  // 8) DB書き込み（draft）
  var eventRows = events.map(function(e) {
    return {
      projectId: projectId,
      ym: ym,
      eventTitle: e.eventTitle,
      eventDescription: e.eventDescription,
      impact: e.impact,
      depth: e.depth,
      status: "draft",
      sourceType: "monthlyReport"
    };
  });

  var eventIds = reward_repo_appendEvents_(eventRows);

  // responsibility書き込み
  var respRows = [];
  events.forEach(function(e, idx) {
    var eventId = eventIds[idx];
    if (!Array.isArray(e.responsibilities)) return;
    e.responsibilities.forEach(function(r) {
      respRows.push({
        eventId: eventId,
        memberId: r.memberId,
        responsibility: r.responsibility,
        reason: r.reason || ""
      });
    });
  });

  if (respRows.length) reward_repo_appendResponsibilities_(respRows);

  return {
    ok: true,
    eventCount: events.length,
    responsibilityCount: respRows.length,
    eventIds: eventIds
  };
}

// ===== 内部関数 =====

function reward_extract_getReport_(projectId, ym) {
  try {
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("DB_MonthlyReports");
    if (!sh) return null;
    var lastRow = sh.getLastRow();
    if (lastRow < 2) return null;

    var header = reward_repo_headerMap_(sh);
    var values = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();

    for (var i = 0; i < values.length; i++) {
      var pid = String(values[i][header.projectId - 1] || "").trim();
      var rym = String(values[i][header.ym - 1] || "").trim();
      if (pid === projectId && rym === ym) {
        return reward_repo_rowToObj_(values[i], header);
      }
    }
  } catch (e) {}
  return null;
}

function reward_extract_getMembers_(projectId) {
  try {
    var shPm = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("DB_ProjectMembers");
    var shM = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("DB_Members");
    if (!shPm || !shM) return [];

    var hPm = reward_repo_headerMap_(shPm);
    var hM = reward_repo_headerMap_(shM);

    // メンバーマスタを辞書化
    var memberMap = {};
    var lastRowM = shM.getLastRow();
    if (lastRowM >= 2) {
      var valsM = shM.getRange(2, 1, lastRowM - 1, shM.getLastColumn()).getValues();
      valsM.forEach(function(r) {
        var mid = String(r[hM.memberId - 1] || "").trim();
        if (mid) {
          memberMap[mid] = {
            name: String(r[hM.name - 1] || r[hM.displayName - 1] || "").trim(),
            email: String(r[(hM.email || hM.googleId) - 1] || "").trim()
          };
        }
      });
    }

    // PJメンバーをフィルタ
    var lastRowPm = shPm.getLastRow();
    if (lastRowPm < 2) return [];
    var valsPm = shPm.getRange(2, 1, lastRowPm - 1, shPm.getLastColumn()).getValues();

    var results = [];
    valsPm.forEach(function(r) {
      var pid = String(r[hPm.projectId - 1] || "").trim();
      if (pid !== projectId) return;
      var isActive = String(r[hPm.isActive - 1] || "").trim().toLowerCase();
      if (isActive === "false" || isActive === "0") return;

      var mid = String(r[hPm.memberId - 1] || "").trim();
      var m = memberMap[mid] || {};
      results.push({
        memberId: mid,
        name: m.name || mid,
        roleLabel: String(r[hPm.roleLabel - 1] || "").trim() || "member"
      });
    });

    return results;
  } catch (e) {
    return [];
  }
}

function reward_extract_getProjectName_(projectId) {
  try {
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("DB_Projects");
    if (!sh) return projectId;
    var header = reward_repo_headerMap_(sh);
    var lastRow = sh.getLastRow();
    if (lastRow < 2) return projectId;

    var values = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
    for (var i = 0; i < values.length; i++) {
      if (String(values[i][header.projectId - 1] || "").trim() === projectId) {
        return String(values[i][header.projectName - 1] || "").trim() || projectId;
      }
    }
  } catch (e) {}
  return projectId;
}

function reward_extract_callLlm_(systemPrompt, userPrompt) {
  try {
    var apiKey = PropertiesService.getScriptProperties().getProperty("ANTHROPIC_API_KEY");
    if (!apiKey) return { ok: false, message: "ANTHROPIC_API_KEY未設定" };

    var body = {
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        { role: "user", content: userPrompt }
      ]
    };

    var options = {
      method: "post",
      contentType: "application/json",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      payload: JSON.stringify(body),
      muteHttpExceptions: true
    };

    var res = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", options);
    var code = res.getResponseCode();
    if (code !== 200) return { ok: false, message: "API " + code + ": " + res.getContentText().slice(0, 300) };

    var json = JSON.parse(res.getContentText());
    var text = "";
    if (Array.isArray(json.content)) {
      json.content.forEach(function(block) {
        if (block.type === "text") text += block.text;
      });
    }

    return { ok: true, text: text };
  } catch (e) {
    return { ok: false, message: String(e) };
  }
}

function reward_extract_parseResponse_(text) {
  try {
    // コードブロック除去
    var cleaned = String(text || "").trim()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    var parsed = JSON.parse(cleaned);
    var events = Array.isArray(parsed.events) ? parsed.events : [];

    // バリデーション
    events = events.filter(function(e) {
      return e.eventTitle && (e.impact >= 1 && e.impact <= 5) && (e.depth >= 0 && e.depth <= 1);
    });

    return { ok: true, events: events };
  } catch (e) {
    return { ok: false, message: "JSON parse error: " + String(e), events: [] };
  }
}

