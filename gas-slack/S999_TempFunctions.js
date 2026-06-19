/** S999_TempFunctions.gs
 * 一時的なデバッグ・初期化用関数。
 */

/** メンバー観察抽出の全フローをシミュレート */
function debug_testMemberObservationExtract() {
  // さっきの会話を模擬
  var fakeHistory = [
    { text: "いまさ、AMDの仕事は他のメンバーにかなり任せられるようになってきててね。だからほぼ毎日AMD OSとChronicleっていう２つのGASアプリの開発に専念してるんだ。これまで開発なんて、ポスドク時代にVisual C使った程度だったのにw AIのおかげで、javaすら知らなくてもちゃんとコーディングできてるのはほんとありがたい。", user: "U04PJK178JV" },
    { text: "ポスドク時代のVisual Cから、いまやGASで2つのアプリを同時開発。すごい進化ね。", bot_id: "B123" },
    { text: "ピアノはもう35歳以降、ほぼさわれてない…いつかまた復活したいけどね。てかそもそもコレクション大好きなんよ。MMOとかでも、コレクション系コンテンツ大好きだし、小学生の頃とかはビックリマンシールとかハマってたしw", user: "U04PJK178JV" }
  ];

  // Step 1: slackId → codeName解決
  var userIds = [];
  var historyText = fakeHistory.map(function(m) {
    var isBotMsg = !!m.bot_id;
    if (!isBotMsg && m.user) userIds.push(String(m.user));
    var who = isBotMsg ? "つくよみ" : "ユーザー";
    return "[" + who + "] " + String(m.text || "").trim();
  }).join("\n");

  var memberNames = [];
  var uniqueUserIds = userIds.filter(function(v, i, a) { return a.indexOf(v) === i; });
  uniqueUserIds.forEach(function(uid) {
    var info = context_getMemberBySlackId_(uid);
    if (info.current) memberNames.push(info.current.codeName);
  });
  Logger.log("=== Step 1: memberNames=" + JSON.stringify(memberNames) + " ===");

  if (memberNames.length === 0) {
    Logger.log("STOP: memberNames空。slackId解決失敗");
    return;
  }

  // Step 2: LLM呼び出し
  var systemPrompt =
    "あなたはSlackの会話からメンバー個人に関する観察を抽出するアシスタントです。\n\n" +
    "以下を抽出してください：\n" +
    "- 性格や人柄が分かる発言・行動\n" +
    "- スキルや専門性に関する情報\n" +
    "- 趣味・興味・関心事\n" +
    "- 印象的なエピソードや出来事\n\n" +
    "以下は抽出しない：\n" +
    "- プロジェクトの事実情報\n" +
    "- つくよみ自身の返答内容\n\n" +
    "出力はJSON配列のみ。該当なければ空配列[]を返す。\n" +
    '形式: [{"codeName":"名前","category":"personality|skills|interests|episodes","observation":"内容"}]';

  var userPrompt = "参加メンバー: " + memberNames.join(", ") + "\n\n会話:\n" + historyText;
  Logger.log("=== Step 2: LLM呼び出し ===");

  var raw = llm_call_(systemPrompt, userPrompt, { maxTokens: 600, temperature: 0.2 });
  Logger.log("LLM raw: " + (raw || "(empty)"));

  if (!raw) { Logger.log("STOP: LLM応答なし"); return; }

  var entries;
  try {
    var clean = raw.replace(/```json|```/g, "").trim();
    entries = JSON.parse(clean);
  } catch(e) {
    Logger.log("STOP: JSON parse error: " + e.message);
    return;
  }

  Logger.log("=== Step 3: 抽出結果 " + entries.length + "件 ===");
  entries.forEach(function(e) {
    Logger.log(e.codeName + " [" + e.category + "] " + e.observation);
  });

  // Step 4: 実際に保存
  var ss = context_getNavSs_();
  var jstLabel = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy年M月d日");
  var tsStr = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyyMMddHHmmss");
  context_saveMemberObservations_(ss, entries, "", jstLabel, tsStr);
  Logger.log("=== Step 4: DB_MemberEntitiesに " + entries.length + "件保存完了 ===");
}

/** メンバー観察抽出のデバッグ：slackId解決を確認 */
function debug_checkMemberResolution() {
  // まさのslackIdを手動で指定してテスト
  var members = context_readSheet_("DB_Members");
  Logger.log("=== DB_Members slackId一覧 ===");
  members.forEach(function(m) {
    var cn = String(m.codeName || "").trim();
    var sid = String(m.slackId || m.slackUserId || "").trim();
    var status = String(m.status || "").trim();
    if (cn) Logger.log(cn + " | slackId=" + (sid || "(未登録)") + " | status=" + status);
  });
}

/** memory_extractプロンプトの中身を確認 */
function debug_dumpMemoryExtractPrompt() {
  var rows = context_readSheet_("DB_TsukuyomiContext");
  var found = rows.filter(function(r) {
    var tags = r.tags ? r.tags.split(",").map(function(s){ return s.trim(); }) : [];
    return tags.indexOf("memory_extract") >= 0 && r.status === "active";
  });
  Logger.log("memory_extract プロンプト: " + found.length + "件");
  found.forEach(function(r) {
    Logger.log("--- contextId=" + r.contextId + " ---");
    Logger.log(r.systemPrompt);
    Logger.log("");
  });
}

/** トリガーの状態を確認し、溜まってたら掃除する */
function debug_checkAndCleanTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  Logger.log("=== 現在のトリガー: " + triggers.length + "件 ===");
  var asyncCount = 0;
  triggers.forEach(function(t) {
    var handler = t.getHandlerFunction();
    Logger.log("- " + handler + " (type=" + t.getEventType() + ")");
    if (handler === "router_processEventAsync") asyncCount++;
  });
  Logger.log("router_processEventAsync トリガー: " + asyncCount + "件");

  // 溜まってたら掃除
  if (asyncCount > 0) {
    triggers.forEach(function(t) {
      if (t.getHandlerFunction() === "router_processEventAsync") {
        ScriptApp.deleteTrigger(t);
      }
    });
    Logger.log("→ " + asyncCount + "件削除しました");
  }

  // キャッシュの状態も確認
  var pendingKey = PropertiesService.getScriptProperties().getProperty("SLACK_PENDING_EVT_KEY");
  Logger.log("SLACK_PENDING_EVT_KEY: " + (pendingKey || "(空)"));
  if (pendingKey) {
    var cached = CacheService.getScriptCache().get(pendingKey);
    Logger.log("cached payload: " + (cached || "(expired/なし)"));
  }
}

function debug_getBotInfo() {
  const token = utils_getProp_("SLACK_TSUKUYOMI_BOT_TOKEN") || utils_getProp_("SLACK_BOT_TOKEN");
  if (!token) {
    Logger.log("ERROR: トークンが見つからない");
    return;
  }

  const res = UrlFetchApp.fetch("https://slack.com/api/auth.test", {
    method: "post",
    headers: { Authorization: "Bearer " + token },
    muteHttpExceptions: true
  });

  const obj = JSON.parse(res.getContentText());
  Logger.log("=== Bot Info ===");
  Logger.log("ok: " + obj.ok);
  Logger.log("bot_id: " + obj.bot_id);
  Logger.log("user_id: " + obj.user_id);
  Logger.log("team: " + obj.team);
  Logger.log("user: " + obj.user);
  Logger.log("================");
}

function debug_authorizeSpreadsheet() {
  const id = utils_getProp_("MAIN_SPREADSHEET_ID");
  Logger.log("MAIN_SPREADSHEET_ID: " + id);
  const ss = SpreadsheetApp.openById(id);
  Logger.log("ss title: " + ss.getName());
  Logger.log("認証OK");
}

/**
 * DB_Projectsの全PJチャンネルにつくよみBotをjoinさせる。
 * GASエディタから手動実行。結果はLoggerに出力。
 */
function admin_joinAllProjectChannels() {
  var ss = SpreadsheetApp.openById(utils_getProp_("MAIN_SPREADSHEET_ID"));
  var sh = ss.getSheetByName("DB_Projects");
  if (!sh || sh.getLastRow() < 2) { Logger.log("DB_Projects not found or empty"); return; }

  var data = sh.getDataRange().getValues();
  var headers = data[0];
  var iCh = -1, iPj = -1, iSt = -1;
  for (var c = 0; c < headers.length; c++) {
    var h = String(headers[c] || "").trim();
    if (h === "slackChannelId") iCh = c;
    if (h === "projectId") iPj = c;
    if (h === "status") iSt = c;
  }
  if (iCh < 0 || iPj < 0) { Logger.log("slackChannelId or projectId column not found"); return; }

  var joined = 0, skipped = 0, failed = 0;
  for (var r = 1; r < data.length; r++) {
    var chId = String(data[r][iCh] || "").trim();
    var pjId = String(data[r][iPj] || "").trim();
    var status = iSt >= 0 ? String(data[r][iSt] || "").trim() : "";

    if (!chId) { skipped++; continue; }
    if (status && status !== "active") { skipped++; continue; }

    var res = slack_callApi_("conversations.join", { channel: chId });
    if (res && res.ok) {
      Logger.log("OK: " + pjId + " → " + chId);
      joined++;
    } else {
      var err = res ? (res.error || "unknown") : "no response";
      Logger.log("FAIL: " + pjId + " → " + chId + " (" + err + ")");
      failed++;
    }
    Utilities.sleep(500); // rate limit対策
  }

  Logger.log("=== 完了: joined=" + joined + " skipped=" + skipped + " failed=" + failed + " ===");
}

/**
 * PJナレッジ注入の診断。GASエディタから手動実行。
 * 全PJのchannelId→projectId解決状況とDB_ProjectKnowledge有無を一覧表示。
 */
function debug_diagnoseProjectKnowledge() {
  // 1) DB_Projects一覧
  var ss = SpreadsheetApp.openById(utils_getProp_("MAIN_SPREADSHEET_ID"));
  var sh = ss.getSheetByName("DB_Projects");
  if (!sh || sh.getLastRow() < 2) { Logger.log("DB_Projects not found"); return; }
  var data = sh.getDataRange().getValues();
  var headers = data[0];
  var idx = {};
  for (var c = 0; c < headers.length; c++) idx[String(headers[c]).trim()] = c;

  Logger.log("=== DB_Projects チャンネル登録状況 ===");
  for (var r = 1; r < data.length; r++) {
    var pjId = String(data[r][idx["projectId"]] || "").trim();
    var chId = String(data[r][idx["slackChannelId"]] || "").trim();
    var status = idx["status"] >= 0 ? String(data[r][idx["status"]] || "").trim() : "";
    Logger.log(pjId + " | ch=" + (chId || "(未登録)") + " | status=" + status);
  }

  // 2) DB_ProjectKnowledge一覧
  var navSs = SpreadsheetApp.openById(utils_getProp_("NAVIGATOR_SPREADSHEET_ID"));
  var pkSh = navSs.getSheetByName("DB_ProjectKnowledge");
  if (!pkSh || pkSh.getLastRow() < 2) {
    Logger.log("\n=== DB_ProjectKnowledge: シートなし or データなし ===");
    return;
  }
  var pkData = pkSh.getDataRange().getValues();
  var pkHeaders = pkData[0];
  var pkIdx = {};
  for (var c2 = 0; c2 < pkHeaders.length; c2++) pkIdx[String(pkHeaders[c2]).trim()] = c2;

  var byPj = {};
  for (var r2 = 1; r2 < pkData.length; r2++) {
    var pid = String(pkData[r2][pkIdx["projectId"]] || "").trim();
    var cat = String(pkData[r2][pkIdx["category"]] || "").trim();
    var txt = String(pkData[r2][pkIdx["summaryText"]] || "").trim();
    if (!byPj[pid]) byPj[pid] = [];
    byPj[pid].push(cat + "(" + txt.length + "文字)");
  }

  Logger.log("\n=== DB_ProjectKnowledge 蓄積状況 ===");
  var pjIds = Object.keys(byPj).sort();
  for (var i = 0; i < pjIds.length; i++) {
    Logger.log(pjIds[i] + ": " + byPj[pjIds[i]].join(", "));
  }

  // 3) 未蓄積PJを検出
  Logger.log("\n=== ナレッジ未蓄積PJ ===");
  for (var r3 = 1; r3 < data.length; r3++) {
    var pj = String(data[r3][idx["projectId"]] || "").trim();
    var st = idx["status"] >= 0 ? String(data[r3][idx["status"]] || "").trim() : "";
    if (st === "active" && !byPj[pj]) {
      Logger.log(pj + " ← DB_ProjectKnowledgeにデータなし");
    }
  }
}

/**
 * 指定チャンネルIDでsystemPrompt構築をシミュレート。
 * SEチャンネルで実行: debug_simulatePromptBuild("C07EZK9BP6E")
 */
function debug_simulatePromptBuild(channelId) {
  channelId = channelId || "C07EZK9BP6E"; // デフォルトSE

  Logger.log("=== Step 1: channelId → projectId ===");
  var projectId = context_getProjectIdByChannelId_(channelId);
  Logger.log("channelId=" + channelId + " → projectId=" + (projectId || "(null)"));

  if (!projectId) {
    Logger.log("STOP: projectId解決できず。DB_ProjectsのslackChannelIdを確認して");
    return;
  }

  Logger.log("\n=== Step 2: ProjectKnowledge注入テスト ===");
  var pkBlock = context_buildProjectKnowledgeBlock_(projectId);
  Logger.log("pkBlock length=" + pkBlock.length + "文字");
  if (pkBlock) {
    Logger.log("pkBlock先頭200文字:\n" + pkBlock.substring(0, 200));
  } else {
    Logger.log("pkBlock: (空)");
  }

  Logger.log("\n=== Step 3: Memory注入テスト ===");
  var memBlock = context_buildMemoryBlock_(projectId);
  Logger.log("memBlock length=" + memBlock.length + "文字");

  Logger.log("\n=== Step 4: 完成systemPrompt ===");
  var full = context_buildSystemPrompt_(projectId);
  Logger.log("systemPrompt total length=" + full.length + "文字");
  // PJナレッジが含まれてるか確認
  var hasPk = full.indexOf(projectId + " プロジェクト知識") >= 0;
  Logger.log("PJナレッジ含まれてる？ → " + (hasPk ? "YES" : "NO"));
}

/**
 * DB_MemberKnowledgeシートをNavigatorスプシに作成し、初期データを投入。
 * GASエディタから1回だけ手動実行。
 */
function admin_setupMemberKnowledge() {
  var ss = SpreadsheetApp.openById(utils_getProp_("NAVIGATOR_SPREADSHEET_ID"));
  var sheetName = "DB_MemberKnowledge";
  var sh = ss.getSheetByName(sheetName);
  if (!sh) {
    sh = ss.insertSheet(sheetName);
  }

  // ヘッダ保証
  var headers = ["codeName", "category", "summaryText", "entityCount", "lastUpdatedAtJst"];
  var existing = sh.getLastColumn() > 0 ? sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0] : [];
  if (String(existing[0] || "").trim() !== "codeName") {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  // 既存データがあればスキップ
  if (sh.getLastRow() >= 2) {
    Logger.log("DB_MemberKnowledge already has data (" + (sh.getLastRow() - 1) + " rows). Skipping seed.");
    return;
  }

  var now = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy年M月d日 HH:mm");

  // 初期データ（まさの情報をえいみのメモリから転記）
  var seedData = [
    ["まさ", "skills", "事業戦略・組織構築が専門。Ph.D.持ち。CFO/AMDとして複数DTSUの経営を同時並行で支援。技術と経営の橋渡しが得意。", "1", now],
    ["まさ", "personality", "論理的だが人情味がある。「少しずつ埋めていく」系のUI/ゲーミング要素が好き。MMORPGが好き。甘いものが好き。", "1", now],
    ["まさ", "interests", "スキー（3歳〜35歳まで）、ピアノ（毎日練習してた時期あり）、道路が好き、地図が好き。車はオープンカー派（ロードスター→Z4→Z4と3台連続コンバーチブル）。", "1", now],
    ["まさ", "communication_style", "率直で、核心を突く質問をする。技術的な内容もビジネス的な内容も両方話せる。メンバーの成長を気にかけるタイプ。", "1", now],
    ["まさ", "episodes", "英語がなかなか話せるようにならないのが悩み。論文執筆・メディア掲載・受賞歴あり。", "1", now],
  ];

  sh.getRange(2, 1, seedData.length, seedData[0].length).setValues(seedData);
  Logger.log("DB_MemberKnowledge created with " + seedData.length + " seed rows for まさ.");
}

/** DB_TsukuyomiContextのtsukuyomiタグ付きプロンプトをダンプ */
function debug_dumpTsukuyomiBasePrompts() {
  var rows = context_readSheet_("DB_TsukuyomiContext");
  var tsukuRows = rows.filter(function(r) {
    var tags = r.tags ? r.tags.split(",").map(function(s){ return s.trim(); }) : [];
    return tags.indexOf("tsukuyomi") >= 0 && r.status === "active" && r.systemPrompt;
  });
  tsukuRows.sort(function(a, b) { return Number(b.priority || 0) - Number(a.priority || 0); });

  Logger.log("=== DB_TsukuyomiContext tsukuyomiタグ: " + tsukuRows.length + "件 ===");
  tsukuRows.forEach(function(r) {
    Logger.log("--- contextId=" + (r.contextId || "(なし)") + " priority=" + r.priority + " type=" + r.contextType + " ---");
    Logger.log(r.systemPrompt.substring(0, 500));
    Logger.log("...(全" + r.systemPrompt.length + "文字)");
    Logger.log("");
  });
}

/** p10のProjectKnowledge全文をダンプ */
function debug_dumpP10Knowledge() {
  var rows = context_readNavSheet_("DB_ProjectKnowledge");
  rows.forEach(function(r) {
    if (r.projectId === "p10") {
      Logger.log("=== " + r.category + " ===");
      Logger.log(r.summaryText);
      Logger.log("");
    }
  });
}

function debug_testMemoryExtract() {
  const fakeHistory = [
    { text: "JCは研究開発より優先すべき経営課題がある。こやさんと話し合いの場を設ける予定。", user: "U123" },
    { text: "JCの状況、確かに記憶しました。", bot_id: "B123" }
  ];
  const fakeChannelId = "";

  const rows = context_readSheet_("DB_TsukuyomiContext");
  const promptRow = rows.find(r => {
    const tags = r.tags ? r.tags.split(",").map(s => s.trim()) : [];
    return tags.includes("memory_extract") && r.status === "active" && r.systemPrompt;
  });
  Logger.log("promptRow found: " + !!promptRow);
  if (!promptRow) { Logger.log("memory_extractプロンプトが見つからない"); return; }

  const historyText = fakeHistory
    .map(m => "[" + (m.bot_id ? "つくよみ" : "ユーザー") + "] " + String(m.text || "").trim())
    .join("\n");
  Logger.log("historyText: " + historyText);

  const userPrompt = "以下のSlack会話から記憶を抽出してください。\n\nPJ文脈: AMD\n\n会話:\n" + historyText;

  const raw = llm_call_(promptRow.systemPrompt, userPrompt, { maxTokens: 800, temperature: 0.2 });
  Logger.log("LLM raw: " + raw);

  if (!raw) { Logger.log("LLM応答なし"); return; }

  const clean = raw.replace(/```json|```/g, "").trim();
  Logger.log("clean: " + clean);

  let entries;
  try {
    entries = JSON.parse(clean);
  } catch(e) {
    Logger.log("JSON parse error: " + e.message);
    return;
  }
  Logger.log("entries: " + JSON.stringify(entries));
  const ss = context_getNavSs_();
  Logger.log("NavSs name: " + ss.getName());
  const sh = ss.getSheetByName("DB_TsukuyomiMemory");
  Logger.log("sheet found: " + !!sh);
  if (!sh) { Logger.log("DB_TsukuyomiMemoryシートが見つからない"); return; }

  const jstLabel = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy年M月d日");
  const memId = "mem_test_" + Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyyMMddHHmmss");
  sh.appendRow([memId, "AMD", "テスト書き込み", "slack_conversation", "active", jstLabel, jstLabel]);
  Logger.log("書き込み完了");
}