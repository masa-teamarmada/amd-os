/** R094_ProjectKnowledge_Repo.gs
 * PJナレッジベースのデータアクセス層（Repo）
 *
 * 対象シート（Navigatorスプシ）:
 *  - DB_ProjectEntities    … エンティティ単位の事実DB（正本）
 *  - DB_ProjectKnowledge   … カテゴリ別要約テキスト（注入用キャッシュ）
 */

// ===== スプシアクセス =====

function pk_getNavSpreadsheet_() {
  var props = PropertiesService.getScriptProperties();
  var ssId = String(props.getProperty("NAVIGATOR_SPREADSHEET_ID") || "").trim();
  if (!ssId) throw new Error('NAVIGATOR_SPREADSHEET_ID 未設定');
  return SpreadsheetApp.openById(ssId);
}

function pk_getSheet_(name) {
  var ss = pk_getNavSpreadsheet_();
  var sh = ss.getSheetByName(String(name || "").trim());
  if (!sh) {
    sh = ss.insertSheet(String(name).trim());
  }
  return sh;
}

// ===== ヘッダ定義 =====

var PK_ENTITY_HEADERS = [
  "entityId",
  "projectId",
  "category",
  "entityName",
  "factText",
  "source",
  "sourceItemId",
  "confidence",
  "status",
  "createdAtJst",
  "updatedAtJst"
];

var PK_KNOWLEDGE_HEADERS = [
  "projectId",
  "category",
  "summaryText",
  "entityCount",
  "lastUpdatedAtJst"
];

// ===== ヘッダ保証 =====

function pk_ensureEntitiesHeader() {
  var sh = pk_getSheet_("DB_ProjectEntities");
  ensureHeader_(sh, PK_ENTITY_HEADERS);
  return sh;
}

function pk_ensureKnowledgeHeader() {
  var sh = pk_getSheet_("DB_ProjectKnowledge");
  ensureHeader_(sh, PK_KNOWLEDGE_HEADERS);
  return sh;
}

function admin_ensureProjectKnowledgeSchema() {
  pk_ensureEntitiesHeader();
  pk_ensureKnowledgeHeader();
  Logger.log("ProjectKnowledge schema ensured.");
}

// ===== DB_ProjectEntities 操作 =====

/** 処理済みsourceItemIdのSetを返す（PJ横断） */
function pk_getDoneSourceItemIds_() {
  var set = new Set();
  try {
    var sh = pk_getSheet_("DB_ProjectEntities");
    if (!sh || sh.getLastRow() < 2) return set;
    var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    var col = -1;
    for (var i = 0; i < headers.length; i++) {
      if (String(headers[i]).trim() === "sourceItemId") { col = i; break; }
    }
    if (col < 0) return set;
    var vals = sh.getRange(2, col + 1, sh.getLastRow() - 1, 1).getValues();
    for (var j = 0; j < vals.length; j++) {
      var v = String(vals[j][0] || "").trim();
      if (v) set.add(v);
    }
  } catch(e) {}
  return set;
}

/** エンティティ行を一括append */
function pk_appendEntities_(entities) {
  if (!entities || !entities.length) return;
  var sh = pk_ensureEntitiesHeader();
  var rows = [];
  for (var i = 0; i < entities.length; i++) {
    var e = entities[i];
    rows.push([
      String(e.entityId || ""),
      String(e.projectId || ""),
      String(e.category || ""),
      String(e.entityName || ""),
      String(e.factText || ""),
      String(e.source || ""),
      String(e.sourceItemId || ""),
      String(e.confidence || ""),
      String(e.status || "active"),
      String(e.createdAtJst || ""),
      String(e.updatedAtJst || "")
    ]);
  }
  if (rows.length) {
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  }
}

/** 指定PJ×categoryのactiveエンティティを全件返す */
function pk_listEntities_(projectId, category) {
  var sh = pk_getSheet_("DB_ProjectEntities");
  if (!sh || sh.getLastRow() < 2) return [];
  var data = sh.getDataRange().getValues();
  var headers = data[0];
  var idx = {};
  for (var i = 0; i < headers.length; i++) {
    var h = String(headers[i] || "").trim();
    if (h) idx[h] = i;
  }

  var result = [];
  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    if (String(row[idx["projectId"]] || "").trim() !== String(projectId)) continue;
    if (category && String(row[idx["category"]] || "").trim() !== String(category)) continue;
    if (String(row[idx["status"]] || "").trim() !== "active") continue;
    var obj = {};
    for (var key in idx) {
      obj[key] = String(row[idx[key]] === null || row[idx[key]] === undefined ? "" : row[idx[key]]).trim();
    }
    result.push(obj);
  }
  return result;
}

/** 指定PJの全カテゴリを返す（重複なし） */
function pk_listCategories_(projectId) {
  var entities = pk_listEntities_(projectId);
  var set = {};
  for (var i = 0; i < entities.length; i++) {
    var cat = String(entities[i].category || "").trim();
    if (cat) set[cat] = true;
  }
  return Object.keys(set);
}

// ===== DB_ProjectKnowledge 操作 =====

/** projectId × category で upsert */
function pk_upsertKnowledge_(projectId, category, summaryText, entityCount) {
  var sh = pk_ensureKnowledgeHeader();
  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();

  var now = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy年M月d日 HH:mm");

  if (lastRow >= 2) {
    var data = sh.getRange(1, 1, lastRow, lastCol).getValues();
    var headers = data[0];
    var iPid = -1, iCat = -1, iSum = -1, iCnt = -1, iUpd = -1;
    for (var c = 0; c < headers.length; c++) {
      var h = String(headers[c] || "").trim();
      if (h === "projectId") iPid = c;
      if (h === "category") iCat = c;
      if (h === "summaryText") iSum = c;
      if (h === "entityCount") iCnt = c;
      if (h === "lastUpdatedAtJst") iUpd = c;
    }

    for (var r = 1; r < data.length; r++) {
      if (String(data[r][iPid] || "").trim() === String(projectId) &&
          String(data[r][iCat] || "").trim() === String(category)) {
        var rowNum = r + 1;
        if (iSum >= 0) sh.getRange(rowNum, iSum + 1).setValue(summaryText);
        if (iCnt >= 0) sh.getRange(rowNum, iCnt + 1).setValue(entityCount);
        if (iUpd >= 0) sh.getRange(rowNum, iUpd + 1).setValue(now);
        return { mode: "update" };
      }
    }
  }

  // 新規
  sh.appendRow([
    String(projectId),
    String(category),
    String(summaryText),
    String(entityCount || 0),
    now
  ]);
  return { mode: "insert" };
}

/** 指定PJの全カテゴリ要約を返す */
function pk_getKnowledge_(projectId) {
  var sh = pk_getSheet_("DB_ProjectKnowledge");
  if (!sh || sh.getLastRow() < 2) return {};
  var data = sh.getDataRange().getValues();
  var headers = data[0];
  var idx = {};
  for (var i = 0; i < headers.length; i++) {
    var h = String(headers[i] || "").trim();
    if (h) idx[h] = i;
  }

  var result = {};
  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    if (String(row[idx["projectId"]] || "").trim() !== String(projectId)) continue;
    var cat = String(row[idx["category"]] || "").trim();
    if (!cat) continue;
    result[cat] = {
      summaryText: String(row[idx["summaryText"]] || "").trim(),
      entityCount: Number(row[idx["entityCount"]] || 0),
      lastUpdatedAtJst: String(row[idx["lastUpdatedAtJst"]] || "").trim()
    };
  }
  return result;
}

/** 指定PJの要約を「LLM注入用テキスト」として返す */
function pk_buildContextText_(projectId) {
  var knowledge = pk_getKnowledge_(projectId);
  var cats = Object.keys(knowledge).sort();
  if (!cats.length) return "";

  var categoryLabels = {
    people: "人物",
    tech: "技術",
    ip: "知財",
    org: "組織",
    funding: "資金",
    market: "市場",
    competitor: "競合",
    strategy: "戦略",
    term: "用語"
  };

  var lines = [];
  for (var i = 0; i < cats.length; i++) {
    var cat = cats[i];
    var label = categoryLabels[cat] || cat;
    var text = knowledge[cat].summaryText;
    if (text) {
      lines.push("【" + label + "】" + text);
    }
  }
  return lines.join("\n");
}

/** msRev_buildUserPrompt_から呼ばれるラッパー */
function pk_getKnowledgeText_(projectId) {
  return pk_buildContextText_(projectId);
}