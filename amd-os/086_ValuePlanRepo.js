/**
 * 086_ValuePlanRepo.gs
 * DBシートの正本アクセス（ヘッダ自動生成をここでやる）
 *
 * 使うシート:
 *  - DB_ValuePlanDraft
 *  - DB_LLMChatLog
 *  - DB_ValuePlanCycles
 *  - DB_ValueMilestones
 *  - DB_ValuePlanRevisionLog
 */

// ===== ValuePlan: Spreadsheet routing =====
// ScriptProperties の NAVIGATOR_SPREADSHEET_ID が入ってたらそっちを正本にする。
// 空なら本体スプシ（後方互換）
function valuePlan_getDbSpreadsheet(){
  const props = PropertiesService.getScriptProperties();
  const ssId = String(props.getProperty("NAVIGATOR_SPREADSHEET_ID") || "").trim();
  if (!ssId) return SpreadsheetApp.getActiveSpreadsheet();
  return SpreadsheetApp.openById(ssId);
}

// name のシートを取得（無ければエラー）
function valuePlan_getSheetByName(name){
  const ss = valuePlan_getDbSpreadsheet();
  const sh = ss.getSheetByName(String(name || "").trim());
  if (!sh) throw new Error(`Sheet not found: ${name}`);
  return sh;
}

function valuePlan_repo_getDraftSheet(){
  const sh = valuePlan_getSheetByName("DB_ValuePlanDraft");
  ensureHeader_(sh, [
    "sessionId","projectId","status",
    "periodStartYm","periodEndYm","budgetYen",
    "createdBy","createdAt","updatedAt"
  ]);
  return sh;
}

function valuePlan_repo_getChatSheet(){
  const sh = valuePlan_getSheetByName("DB_LLMChatLog");
  ensureHeader_(sh, [
    "sessionId","role","content","createdAt"
  ]);
  return sh;
}

function valuePlan_repo_getCycleSheet(){
  const sh = valuePlan_getSheetByName("DB_ValuePlanCycles");
  ensureHeader_(sh, [
    "planCycleId","projectId","periodStartYm","periodEndYm",
    "budgetYen","totalPoints",
    "status","fixedVersion","fixedAt","fixedBy",
    "updatedAt"
  ]);
  return sh;
}

function valuePlan_repo_getMilestoneSheet(){
  const sh = valuePlan_getSheetByName("DB_ValueMilestones");
  ensureHeader_(sh, [
    "planCycleId","version","milestoneId",
    "orderNo","title","points","tag",
    "successCriteria","rationale",
    "isActive","updatedAt"
  ]);
  return sh;
}

function valuePlan_repo_getRevisionSheet(){
  const sh = valuePlan_getSheetByName("DB_ValuePlanRevisionLog");
  ensureHeader_(sh, [
    "planCycleId","fromVersion","toVersion","reason","changedBy","changedAt"
  ]);
  return sh;
}

function valuePlan_repo_upsertDraft(draft){
  const sh = valuePlan_repo_getDraftSheet();
  const sessionId = String(draft.sessionId || "").trim();
  if (!sessionId) return;

  const values = sh.getDataRange().getValues();
  const header = values[0] || [];
  const idx = header.indexOf("sessionId");
  let row = -1;
  for (let r=1; r<values.length; r++){
    if (String(values[r][idx]||"").trim() === sessionId){ row = r+1; break; }
  }

  const rec = [
    sessionId,
    String(draft.projectId||""),
    String(draft.status||"draft"),
    String(draft.periodStartYm||""),
    String(draft.periodEndYm||""),
    Number(draft.budgetYen||0),
    String(draft.createdBy||""),
    String(draft.createdAt||""),
    String(draft.updatedAt||"")
  ];

  if (row === -1){
    sh.appendRow(rec);
  } else {
    sh.getRange(row, 1, 1, rec.length).setValues([rec]);
  }
}

function valuePlan_repo_getDraft(sessionId){
  const sh = valuePlan_repo_getDraftSheet();
  const values = sh.getDataRange().getValues();
  const header = values[0] || [];
  const iSession = header.indexOf("sessionId");
  if (iSession < 0) return null;

  for (let r=1; r<values.length; r++){
    if (String(values[r][iSession]||"").trim() === String(sessionId||"").trim()){
      return valuePlan_repo_rowToObj(header, values[r]);
    }
  }
  return null;
}

function valuePlan_repo_appendChat(sessionId, role, content){
  const sh = valuePlan_repo_getChatSheet();
  sh.appendRow([
    String(sessionId||""),
    String(role||""),
    String(content||""),
    valuePlan_nowJstIso()
  ]);
}
function valuePlan_nowJstIso(){
  // 例: 2026-01-28T09:12:59.630+09:00
  const s = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd'T'HH:mm:ss.SSS");
  return s + "+09:00";
}


function valuePlan_repo_getChatTail(sessionId, limit){
  const sh = valuePlan_repo_getChatSheet();
  const values = sh.getDataRange().getValues();
  const header = values[0] || [];
  const iSession = header.indexOf("sessionId");
  const iRole = header.indexOf("role");
  const iContent = header.indexOf("content");
  const iAt = header.indexOf("createdAt");

  const sid = String(sessionId||"").trim();
  const rows = [];
  for (let r=1; r<values.length; r++){
    if (String(values[r][iSession]||"").trim() !== sid) continue;
    rows.push({
      role: String(values[r][iRole]||""),
      content: String(values[r][iContent]||""),
      createdAt: String(values[r][iAt]||"")
    });
  }
  return rows.slice(Math.max(0, rows.length - Number(limit||0)));
}

function valuePlan_repo_upsertPlanCycle(cycle){
  const sh = valuePlan_repo_getCycleSheet();
  const planCycleId = String(cycle.planCycleId || "").trim();
  if (!planCycleId) return;

  const values = sh.getDataRange().getValues();
  const header = values[0] || [];
  const iId = header.indexOf("planCycleId");

  let row = -1;
  for (let r=1; r<values.length; r++){
    if (String(values[r][iId]||"").trim() === planCycleId){ row = r+1; break; }
  }

  const rec = [
    planCycleId,
    String(cycle.projectId||""),
    String(cycle.periodStartYm||""),
    String(cycle.periodEndYm||""),
    Number(cycle.budgetYen||0),
    Number(cycle.totalPoints||100),
    String(cycle.status||"draft"),
    Number(cycle.fixedVersion||0),
    String(cycle.fixedAt||""),
    String(cycle.fixedBy||""),
    String(cycle.updatedAt||"")
  ];

  if (row === -1) sh.appendRow(rec);
  else sh.getRange(row, 1, 1, rec.length).setValues([rec]);
}

function valuePlan_repo_getPlanCycle(planCycleId){
  const sh = valuePlan_repo_getCycleSheet();
  const values = sh.getDataRange().getValues();
  const header = values[0] || [];
  const iId = header.indexOf("planCycleId");
  if (iId < 0) return null;

  const pid = String(planCycleId||"").trim();
  for (let r=1; r<values.length; r++){
    if (String(values[r][iId]||"").trim() === pid){
      return valuePlan_repo_rowToObj(header, values[r]);
    }
  }
  return null;
}

function valuePlan_repo_writeMilestonesForVersion(planCycleId, version, ms){
  const sh = valuePlan_repo_getMilestoneSheet();
  const now = valuePlan_nowJstIso()

  // 既存同versionを無効化（isActive=false）
  const values = sh.getDataRange().getValues();
  const header = values[0] || [];
  const iCycle = header.indexOf("planCycleId");
  const iVer = header.indexOf("version");
  const iActive = header.indexOf("isActive");

  for (let r=1; r<values.length; r++){
    if (String(values[r][iCycle]||"").trim() !== String(planCycleId)) continue;
    if (Number(values[r][iVer]||0) !== Number(version)) continue;
    // isActive=false
    sh.getRange(r+1, iActive+1).setValue(false);
  }

  // 追加（orderNoで並べる）
  (ms || []).forEach((m, idx) => {
    const milestoneId = "MS-" + String(Date.now()) + "-" + Math.random().toString(36).slice(2,7);
    sh.appendRow([
      String(planCycleId),
      Number(version),
      milestoneId,
      Number(idx+1),
      String(m.title||""),
      Number(m.points||0),
      (String(m.tag||"") === "buffer") ? "buffer" : "normal",
      String(m.successCriteria||""),
      String(m.rationale||""),
      true,
      now
    ]);
  });
}

function valuePlan_repo_appendRevisionLog(log){
  const sh = valuePlan_repo_getRevisionSheet();
  sh.appendRow([
    String(log.planCycleId||""),
    Number(log.fromVersion||0),
    Number(log.toVersion||0),
    String(log.reason||""),
    String(log.changedBy||""),
    String(log.changedAt||"")
  ]);
}

function valuePlan_repo_rowToObj(header, row){
  const o = {};
  for (let i=0; i<header.length; i++){
    o[String(header[i]||"")] = row[i];
  }
  return o;
}
