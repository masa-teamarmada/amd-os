// 187_ReimburseAlerts.gs

function reimburseEnsureAlertLog(){
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName("DB_ReimburseAlertLog");
  if (!sh) sh = ss.insertSheet("DB_ReimburseAlertLog");

  var headers = ["alertKey","sentAtIso"];
  if (sh.getLastRow() === 0){
    sh.appendRow(headers);
  } else {
    var row1 = sh.getRange(1,1,1,Math.max(sh.getLastColumn(),1)).getValues()[0].map(function(x){ return String(x||"").trim(); });
    headers.forEach(function(h){
      if (row1.indexOf(h) < 0) sh.getRange(1, sh.getLastColumn()+1).setValue(h);
    });
  }
  return sh;
}

function reimburseHasSentAlert(alertKey){
  var key = String(alertKey||"").trim();
  if (!key) return false;

  var sh = reimburseEnsureAlertLog();
  var vals = sh.getDataRange().getValues();
  if (!vals || vals.length < 2) return false;

  var h = vals[0].map(function(x){ return String(x||"").trim(); });
  var iKey = h.indexOf("alertKey");
  if (iKey < 0) return false;

  for (var r=1; r<vals.length; r++){
    if (String(vals[r][iKey]||"").trim() === key) return true;
  }
  return false;
}

function reimburseLogAlert(alertKey){
  var key = String(alertKey||"").trim();
  if (!key) return;
  var sh = reimburseEnsureAlertLog();
  sh.appendRow([key, new Date().toISOString()]);
}

function reimbursePrevYyyymmFromTodayJst(){
  var d = new Date();
  var y = d.getFullYear();
  var m = d.getMonth()+1; // 1-12
  m = m - 1;
  if (m === 0){ m = 12; y = y - 1; }
  return String(y) + String(m).padStart(2,"0");
}

function reimburseCountPendingByProject(yyyymm){
  var target = String(yyyymm||"").trim();
  if (!/^\d{6}$/.test(target)) return {};

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName("DB_Reimbursements");
  if (!sh) return {};

  var vals = sh.getDataRange().getValues();
  if (!vals || vals.length < 2) return {};

  var h = vals[0].map(function(x){ return String(x||"").trim(); });
  var idx = function(name){ return h.indexOf(name); };

  var iProjectId = idx("projectId");
  var iDate = idx("date");
  var iStatus = idx("status");
  var iBilledYm = idx("billedYm");

  if (iProjectId < 0 || iDate < 0 || iStatus < 0) return {};

  function yyyymmFromDateValue(v){
    if (v === null || v === undefined || v === "") return "";
    try{
      if (Object.prototype.toString.call(v) === "[object Date]" && !isNaN(v.getTime())){
        return Utilities.formatDate(v, "Asia/Tokyo", "yyyyMM");
      }
    } catch(e){}
    var s = String(v||"").trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0,7).replace("-","");
    var digits = s.replace(/[^\d]/g,"");
    if (digits.length >= 6) return digits.slice(0,6);
    return "";
  }

  var map = {}; // projectId -> count
  for (var r=1; r<vals.length; r++){
    var row = vals[r];
    var pid = String(row[iProjectId]||"").trim();
    if (!pid) continue;

    // 請求済みは除外
    var billed = (iBilledYm>=0) ? String(row[iBilledYm]||"").trim() : "";
    if (billed) continue;

    var st = String(row[iStatus]||"").trim();
    if (st !== "submitted") continue;

    var ym = yyyymmFromDateValue(row[iDate]);
    if (ym !== target) continue;

    map[pid] = (map[pid] || 0) + 1;
  }
  return map;
}

function reimburseSendPmDmForProject(projectId, title, text){
  var pid = String(projectId||"").trim();
  if (!pid) return;

  var targets = reimburseGetProjectPmTargets(pid);
  if (!targets.length) return;

  // DM優先（notifyChannelがgmailでも、ここは「DM飛ばしたい」要件なのでDMをまず試す）
  targets.forEach(function(t){
    var slackId = String(t.slackId||"").trim();
    var email = String(t.email||"").toLowerCase().trim();

    if (slackId){
      try{ slack_postDm(slackId, title + "\n" + text); return; } catch(e){}
    }
    if (email){
      try{ GmailApp.sendEmail(email, "【AMD OS】" + title, text); } catch(e2){}
    }
  });
}

/**
 * 毎朝9時：未承認があればPMへDM（前月分）
 */
function cronReimbursePendingReminderDaily(){
  var yyyymm = reimbursePrevYyyymmFromTodayJst();
  var map = reimburseCountPendingByProject(yyyymm);

  var baseUrl = ScriptApp.getService().getUrl();
  var any = false;

  Object.keys(map).forEach(function(pid){
    var cnt = Number(map[pid]||0);
    if (!cnt) return;
    any = true;

    var pj = reimburse_tryGetProjectName(pid);
    var pjName = String((pj && pj.projectName) ? pj.projectName : "").trim() || pid;

    var link = baseUrl + "?page=reimburse&projectId=" + encodeURIComponent(pid);

    var title = "【立替 承認リマインド】";
    var text =
      "PJ: " + pjName + "（" + pid + "）\n" +
      "対象月: " + yyyymm + "\n" +
      "未承認: " + cnt + "件\n\n" +
      "▼承認（Reimburse）\n" + link;

    reimburseSendPmDmForProject(pid, title, text);
  });

  return { ok:true, yyyymm: yyyymm, projects: Object.keys(map).length, any: any };
}

/**
 * 毎月4日 正午：締切アラート（前月分）
 * - 同日多重送信を防ぐ（alertKeyで抑止）
 */
function cronReimburseApprovalDeadlineNoon(){
  var now = new Date();
  var day = now.getDate();
  if (day !== 4) return { ok:true, skipped:true, reason:"not 4th" };

  var yyyymm = reimbursePrevYyyymmFromTodayJst();
  var map = reimburseCountPendingByProject(yyyymm);

  var baseUrl = ScriptApp.getService().getUrl();

  var sent = 0;
  Object.keys(map).forEach(function(pid){
    var cnt = Number(map[pid]||0);
    if (!cnt) return;

    var alertKey = "reimb_deadline_noon:" + pid + ":" + yyyymm;
    if (reimburseHasSentAlert(alertKey)) return;

    var pj = reimburse_tryGetProjectName(pid);
    var pjName = String((pj && pj.projectName) ? pj.projectName : "").trim() || pid;

    var link = baseUrl + "?page=reimburse&projectId=" + encodeURIComponent(pid);

    var title = "【今日やらないとやばい】立替 承認締切";
    var text =
      "PJ: " + pjName + "（" + pid + "）\n" +
      "対象月: " + yyyymm + "\n" +
      "未承認: " + cnt + "件\n\n" +
      "今日中（4日）に承認しないと、請求に乗らず/翌月請求にズレる可能性あるよ。\n\n" +
      "▼承認（Reimburse）\n" + link;

    reimburseSendPmDmForProject(pid, title, text);
    reimburseLogAlert(alertKey);
    sent++;
  });

  return { ok:true, yyyymm: yyyymm, sent: sent };
}

/**
 * トリガー作成（既存があれば作り直す）
 */
function setupReimburseReminderTriggers(){
  var triggers = ScriptApp.getProjectTriggers();

  var handlers = [
    "cronReimbursePendingReminderDaily",
    "cronReimburseApprovalDeadlineNoon"
  ];

  var removed = 0;
  triggers.forEach(function(t){
    try{
      var fn = t.getHandlerFunction();
      if (handlers.indexOf(fn) >= 0){
        ScriptApp.deleteTrigger(t);
        removed++;
      }
    } catch(e){}
  });

  // 毎朝9時
  ScriptApp.newTrigger("cronReimbursePendingReminderDaily")
    .timeBased()
    .everyDays(1)
    .atHour(9)
    .create();

  // 毎日12時（4日だけ発火する）
  ScriptApp.newTrigger("cronReimburseApprovalDeadlineNoon")
    .timeBased()
    .everyDays(1)
    .atHour(12)
    .create();

  return { ok:true, removed: removed };
}
