/**
 * A153_AdminBillingMatrixApi.gs
 * Admin「Billing一覧」タブ用API。
 * 全アクティブPJ × 全月のルーティンステータス取得 + セル単位ステータス更新。
 */

function admin_getBillingMatrix(){
  if (!isAdmin_()) throw new Error("admin only");
  b_ensureBillingCycleHeader_();

  // 来月までに制限
  var now = new Date();
  var jst = new Date(now.getTime() + 9*60*60*1000);
  var curY = jst.getUTCFullYear();
  var curM = jst.getUTCMonth() + 1;
  var nextM = curM + 1;
  var nextY = curY;
  if (nextM > 12){ nextM = 1; nextY++; }
  var maxYm = String(nextY) + String(nextM).padStart(2, "0");

  var projects = b_readTable_("DB_Projects")
    .filter(function(p){
      var st = String(p.status||"").toLowerCase();
      return st === "active" || st === "ended" || st === "frozen";
    })
    .map(function(p){
      return {
        projectId: String(p.projectId||"").trim(),
        projectName: String(p.projectName||"").trim(),
        status: String(p.status||"").toLowerCase(),
        startYm: b_normYm_(p.startYm) || "",
        endYm:   b_normYm_(p.endYm)   || ""
      };
    })
    .sort(function(a,b){
      var aActive = a.status === "active" ? 0 : 1;
      var bActive = b.status === "active" ? 0 : 1;
      if (aActive !== bActive) return aActive - bActive;
      return a.projectId.localeCompare(b.projectId);
    });

  // projectId → startYm/endYm のマップ
  var projRange = {};
  for (var pi=0; pi<projects.length; pi++){
    projRange[projects[pi].projectId] = {
      startYm: projects[pi].startYm,
      endYm:   projects[pi].endYm
    };
  }

  var allCycles = b_readTable_("DB_BillingCycle");
  var rows = [];

  for (var pi=0; pi<projects.length; pi++){
    var proj = projects[pi];
    var range = projRange[proj.projectId] || {};
    var cycles = allCycles
      .filter(function(c){ return String(c.projectId||"").trim() === proj.projectId; })
      .map(function(c){
        var ymVal = b_normYm_(c.ym);
        if (!ymVal || ymVal > maxYm) return null;
        // 契約期間外を除外
        if (range.startYm && ymVal < range.startYm) return null;
        if (range.endYm   && ymVal > range.endYm)   return null;
        return {
          projectId: proj.projectId,
          projectName: proj.projectName,
          projectStatus: proj.status,
          ym: ymVal,
          budget:        String(c.budgetConfirmedAt||"").trim()         ? "done" : "undone",
          nextTask:      String(c.taskConfirmedAt||"").trim()           ? "done" : "undone",
          reportFix:     String(c.monthlyReportFixedAt||"").trim()      ? "done" : "undone",
          meeting:       b_toBool_(c.meetingSkipped, false) ? "skip"
                       : String(c.meetingEventId||"").trim() ? "done" : "undone",
          invoice:       String(c.invoiceIssuedAt||"").trim()           ? "done" : "undone",
          invoiceSent:   String(c.invoiceSentAt||"").trim()             ? "done" : "undone",
          paymentNotice: String(c.payoutNoticeUploadedAt||"").trim()    ? "done" : "undone",
          payment:       String(c.paymentConfirmedAt||"").trim()        ? "done" : "undone",
          rewardPaid:    String(c.rewardPaidAt||"").trim()              ? "done" : "undone",
        };
      })
      .filter(function(c){ return c !== null; })
      .sort(function(a,b){ return b.ym.localeCompare(a.ym); });

    for (var ci=0; ci<cycles.length; ci++) rows.push(cycles[ci]);
  }

  return { ok:true, rows:rows };
}

function admin_updateBillingMatrixCell(payload){
  if (!isAdmin_()) throw new Error("admin only");
  payload = payload || {};

  var projectId = String(payload.projectId||"").trim();
  var ym        = b_normYm_(payload.ym);
  var taskKey   = String(payload.taskKey||"").trim();
  var newStatus = String(payload.newStatus||"").trim();

  if (!projectId || !ym || !taskKey || !newStatus) throw new Error("missing params");

  var validTasks = { budget:1, nextTask:1, reportFix:1, meeting:1, invoice:1, invoiceSent:1, paymentNotice:1, payment:1, rewardPaid:1 };
  if (!validTasks[taskKey]) throw new Error("invalid taskKey: " + taskKey);

  b_ensureBillingCycleHeader_();
  _bm_ensureNewColumns_();

  var operatorEmail = "";
  try{ operatorEmail = String(Session.getActiveUser().getEmail()||""); } catch(_e){}
  var nowJst = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy年M月d日 HH:mm");

  // --- 該当行を探す ---
  var sh = b_getSheet_("DB_BillingCycle");
  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();
  if (lastRow < 2) throw new Error("no data");

  var header = sh.getRange(1,1,1,lastCol).getValues()[0].map(function(x){ return String(x||"").trim(); });
  var iPid = header.indexOf("projectId");
  var iYm  = header.indexOf("ym");
  if (iPid < 0 || iYm < 0) throw new Error("header missing");

  var data = sh.getRange(2,1,lastRow-1,lastCol).getValues();
  var targetRow = -1;
  for (var i=0; i<data.length; i++){
    if (String(data[i][iPid]||"").trim() === projectId && b_normYm_(data[i][iYm]) === ym){
      targetRow = i + 2;
      break;
    }
  }
  if (targetRow < 0) throw new Error("cycle not found: " + projectId + "_" + ym);

  // --- 更新内容を決定 ---
  var updates = {};

  var TASK_COL_MAP = {
    budget:        { at: "budgetConfirmedAt",        by: "budgetConfirmedBy" },
    nextTask:      { at: "taskConfirmedAt",           by: "taskConfirmedBy" },
    reportFix:     { at: "monthlyReportFixedAt",      by: "monthlyReportFixedBy" },
    invoice:       { at: "invoiceIssuedAt",          by: "invoiceIssuedBy" },
    invoiceSent:   { at: "invoiceSentAt",            by: "invoiceSentBy" },
    paymentNotice: { at: "payoutNoticeUploadedAt",    by: "payoutNoticeUploadedBy" },
    payment:       { at: "paymentConfirmedAt",       by: "paymentConfirmedBy" },
    rewardPaid:    { at: "rewardPaidAt",             by: "rewardPaidBy" }
  };

  if (taskKey === "meeting"){
    if (newStatus === "skip"){
      updates.meetingSkipped    = "TRUE";
      updates.meetingSkipReason = "admin_matrix";
      updates.meetingEventId    = "";
    } else if (newStatus === "done"){
      updates.meetingSkipped    = "";
      updates.meetingSkipReason = "";
      updates.meetingEventId    = "admin_done_" + nowJst;
    } else {
      updates.meetingSkipped    = "";
      updates.meetingSkipReason = "";
      updates.meetingEventId    = "";
    }
  } else if (TASK_COL_MAP[taskKey]){
    var mapping = TASK_COL_MAP[taskKey];
    updates[mapping.at] = newStatus === "done" ? nowJst : "";
    updates[mapping.by] = newStatus === "done" ? operatorEmail : "";

    // invoiceをundoneに戻すときは発行関連フィールドを全クリア
    if (taskKey === "invoice" && newStatus === "undone"){
      updates.freeeInvoiceId        = "";
      updates.freeeInvoiceNumber    = "";
      updates.invoicePdfFileId      = "";
      updates.invoicePdfUrl         = "";
      updates.invoiceReviewedAt     = "";
      updates.invoiceReviewedBy     = "";
      updates.invoiceSentAt         = "";
      updates.invoiceSentBy         = "";
    }
  }

  updates.updatedAt = nowJst;

  // --- 書き込み ---
  var keys = Object.keys(updates);
  for (var k=0; k<keys.length; k++){
    var col = keys[k];
    var idx = header.indexOf(col);
    if (idx >= 0) sh.getRange(targetRow, idx+1).setValue(updates[col]);
  }

  // --- ログ ---
  try{
    b_appendBillingLog_({
      actionType: "MATRIX_UPDATE",
      target: taskKey,
      projectId: projectId,
      ym: ym,
      cycleId: projectId + "_" + ym,
      afterValue: JSON.stringify({ taskKey:taskKey, newStatus:newStatus }),
      reason: "admin_billing_matrix",
      operatorUserId: operatorEmail,
      operatorName: operatorEmail,
    });
  } catch(_e){}

  return { ok:true, projectId:projectId, ym:ym, taskKey:taskKey, newStatus:newStatus };
}

// ================================================================
// PDF一括アップロード用API
// ================================================================

/**
 * PDF未アップロードのPJ一覧を前月比較データ付きで返す
 */
/**
 * 請求書発行済みで、PDFアップロードまたは送付が未完了のPJ一覧を返す
 */
function admin_getPendingPdfUploads(){
  if (!isAdmin_()) throw new Error("admin only");

  var allCycles = b_readTable_("DB_BillingCycle");
  var projects = b_readTable_("DB_Projects")
    .filter(function(p){
      var st = String(p.status||"").toLowerCase();
      return st === "active" || st === "ended" || st === "frozen";
    });

  var projMap = {};
  for (var i = 0; i < projects.length; i++){
    var pid = String(projects[i].projectId || "").trim();
    if (pid) projMap[pid] = projects[i];
  }

  var pending = [];
  for (var i = 0; i < allCycles.length; i++){
    var c = allCycles[i];
    var hasInvoice = String(c.freeeInvoiceId || "").trim();
    if (!hasInvoice) continue;

    var hasPdf = String(c.invoicePdfFileId || "").trim();
    var hasSent = String(c.invoiceSentAt || "").trim();

    // PDFもアップ済み＆送付済みならスキップ
    if (hasPdf && hasSent) continue;

    var pid = String(c.projectId || "").trim();
    var ym = b_normYm_(c.ym);
    if (!pid || !ym) continue;

    var pj = projMap[pid];
    if (!pj) continue;

    // 立替集計
    var reimbTotal = 0;
    var reimbCount = 0;
    try{
      var pack = reimburse_listApprovedForBilling({ projectId: pid, ym: ym });
      if (pack && pack.ok){
        reimbTotal = Number(pack.totalYen || 0);
        reimbCount = Array.isArray(pack.items) ? pack.items.length : 0;
      }
    } catch(e){}

    // 基本行
    var baseLines = [];
    var baseLinesTotal = 0;
    try{
      var blRaw = String(c.invoiceBaseLinesJson || "").trim();
      if (blRaw){
        var parsed = JSON.parse(blRaw);
        if (Array.isArray(parsed)){
          baseLines = parsed;
          for (var bl = 0; bl < parsed.length; bl++){
            var qty = Number(parsed[bl].quantity || parsed[bl].qty || 1);
            var unit = Number(parsed[bl].unitPrice || parsed[bl].unit_price || parsed[bl].amount || 0);
            baseLinesTotal += qty * unit;
          }
        }
      }
    } catch(e){}

    var grandTotal = baseLinesTotal + reimbTotal;

    // 前月データ
    var prevYm = _pendingPdf_prevYm_(ym);
    var prev = _pendingPdf_findCycle_(allCycles, pid, prevYm);
    var prevBaseLinesTotal = 0;
    var prevReimbTotal = 0;
    var prevGrandTotal = 0;
    var prevInvoiceNumber = "";

    if (prev){
      prevInvoiceNumber = String(prev.freeeInvoiceNumber || "").trim();
      try{
        var pblRaw = String(prev.invoiceBaseLinesJson || "").trim();
        if (pblRaw){
          var pp = JSON.parse(pblRaw);
          if (Array.isArray(pp)){
            for (var pbl = 0; pbl < pp.length; pbl++){
              var pq = Number(pp[pbl].quantity || pp[pbl].qty || 1);
              var pu = Number(pp[pbl].unitPrice || pp[pbl].unit_price || pp[pbl].amount || 0);
              prevBaseLinesTotal += pq * pu;
            }
          }
        }
      } catch(e){}
      prevReimbTotal = Number(prev.invoiceReimbYen || 0);
      prevGrandTotal = prevBaseLinesTotal + prevReimbTotal;
    }

    var amountDelta = grandTotal - prevGrandTotal;
    var amountDeltaPct = prevGrandTotal > 0 ? Math.round((amountDelta / prevGrandTotal) * 100) : 0;

    pending.push({
      projectId: pid,
      projectName: String(pj.projectName || "").trim(),
      ym: ym,
      baseLinesTotal: baseLinesTotal,
      baseLines: baseLines.map(function(ln){
        return {
          description: String(ln.description || ln.desc || ln.name || "").trim(),
          quantity: Number(ln.quantity || ln.qty || 1),
          unitPrice: Number(ln.unitPrice || ln.unit_price || ln.amount || 0)
        };
      }),
      reimbTotal: reimbTotal,
      reimbCount: reimbCount,
      grandTotal: grandTotal,
      freeeInvoiceNumber: String(c.freeeInvoiceNumber || "").trim(),
      invoiceBillingDate: _pendingPdf_formatDate_(c.invoiceBillingDate),
      invoicePaymentDate: _pendingPdf_formatDate_(c.invoicePaymentDate),
      invoiceSubject: String(c.invoiceSubject || "").trim(),
      // 状態
      pdfUploaded: !!hasPdf,
      invoiceSentAt: hasSent || "",
      // 前月
      prev: {
        baseLinesTotal: prevBaseLinesTotal,
        reimbTotal: prevReimbTotal,
        grandTotal: prevGrandTotal,
        freeeInvoiceNumber: prevInvoiceNumber
      },
      diff: {
        amountDelta: amountDelta,
        amountDeltaPct: amountDeltaPct
      }
    });
  }

  pending.sort(function(a,b){
    if (a.ym !== b.ym) return b.ym.localeCompare(a.ym);
    return a.projectId.localeCompare(b.projectId);
  });

  return { ok:true, rows: pending };
}

/**
 * 送付完了を記録するAPI
 */
function admin_markInvoiceSent(payload){
  if (!isAdmin_()) throw new Error("admin only");
  payload = payload || {};

  var projectId = String(payload.projectId || "").trim();
  var ym = b_normYm_(payload.ym);
  if (!projectId || !ym) throw new Error("projectId/ym required");

  var sh = b_getSheet_("DB_BillingCycle");
  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();
  if (lastRow < 2) throw new Error("no data");

  var header = sh.getRange(1,1,1,lastCol).getValues()[0].map(function(x){ return String(x||"").trim(); });
  var iPid = header.indexOf("projectId");
  var iYm = header.indexOf("ym");
  var iSentAt = header.indexOf("invoiceSentAt");
  var iSentBy = header.indexOf("invoiceSentBy");
  var iUpd = header.indexOf("updatedAt");

  if (iPid < 0 || iYm < 0 || iSentAt < 0) throw new Error("header missing");

  var vals = sh.getRange(2,1,lastRow-1,lastCol).getValues();
  var targetRow = -1;
  for (var i = 0; i < vals.length; i++){
    if (String(vals[i][iPid]||"").trim() === projectId && b_normYm_(vals[i][iYm]) === ym){
      targetRow = i + 2;
    }
  }
  if (targetRow < 0) throw new Error("cycle not found: " + projectId + "_" + ym);

  var existing = String(vals[targetRow-2][iSentAt] || "").trim();
  if (existing) return { ok:true, alreadySent:true, sentAt: existing };

  var tz = Session.getScriptTimeZone() || "Asia/Tokyo";
  var nowJst = Utilities.formatDate(new Date(), tz, "yyyy年M月d日 HH:mm");

  var operatorEmail = "";
  try{ operatorEmail = String(Session.getActiveUser().getEmail() || ""); } catch(e){}

  sh.getRange(targetRow, iSentAt + 1).setValue("'" + nowJst);
  if (iSentBy >= 0) sh.getRange(targetRow, iSentBy + 1).setValue(operatorEmail);
  if (iUpd >= 0) sh.getRange(targetRow, iUpd + 1).setValue("'" + nowJst);

  try{
    b_appendBillingLog_({
      actionType: "INVOICE_SENT_MANUAL",
      target: "invoice",
      projectId: projectId,
      ym: ym,
      afterValue: JSON.stringify({ sentAt: nowJst, sentBy: operatorEmail }),
      reason: "admin_billing_matrix_send",
      operatorUserId: operatorEmail,
      operatorName: operatorEmail
    });
  } catch(e){}

  // Slack通知（ボタンなし、情報のみ）
  try{
    var channelId = slackNotifyGetProjectChannelId_(projectId);
    if (channelId){
      var projectName = String(payload.projectName || "").trim() || projectId;
      var ymLabel = String(ym).slice(0,4) + "年" + String(ym).slice(4).replace(/^0/,"") + "月";
      var txt = "✅ *" + projectName + "* " + ymLabel + "度の請求書を送付したよ🌙\nあとは入金確認を待つだけ";
      slackNotifyPostToChannelTsukuyomi_(channelId, { text: txt });
    }
  } catch(e){}

  return { ok:true, projectId: projectId, ym: ym, sentAt: nowJst };
}

/**
 * PDFアップロード → Drive保存 → DB更新
 * @param {Object} payload { projectId, ym, fileName, base64Data }
 */
function admin_uploadInvoicePdf(payload){
  if (!isAdmin_()) throw new Error("admin only");
  payload = payload || {};

  var projectId = String(payload.projectId || "").trim();
  var ym = b_normYm_(payload.ym);
  var fileName = String(payload.fileName || "").trim();
  var base64Data = String(payload.base64Data || "").trim();

  if (!projectId || !ym) throw new Error("projectId/ym required");
  if (!base64Data) throw new Error("base64Data required");
  if (!fileName) fileName = "invoice_" + projectId + "_" + ym + ".pdf";

  // Drive保存先フォルダ
  var folderId = "";
  try{
    var pjRows = b_readTable_("DB_Projects");
    for (var i = 0; i < pjRows.length; i++){
      if (String(pjRows[i].projectId || "").trim() === projectId){
        folderId = String(pjRows[i].driveFolderId || "").trim();
        break;
      }
    }
  } catch(e){}

  var blob = Utilities.newBlob(Utilities.base64Decode(base64Data), "application/pdf", fileName);
  var file;
  if (folderId){
    try{
      var folder = DriveApp.getFolderById(folderId);
      file = folder.createFile(blob);
    } catch(e){
      file = DriveApp.createFile(blob);
    }
  } else {
    file = DriveApp.createFile(blob);
  }

  var fileId = file.getId();

  // DB_BillingCycle更新
  var sh = b_getSheet_("DB_BillingCycle");
  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();
  if (lastRow < 2) throw new Error("no data");

  var header = sh.getRange(1,1,1,lastCol).getValues()[0].map(function(x){ return String(x||"").trim(); });
  var iPid = header.indexOf("projectId");
  var iYm = header.indexOf("ym");
  var iPdfId = header.indexOf("invoicePdfFileId");
  var iPdfUrl = header.indexOf("invoicePdfUrl");
  var iUpd = header.indexOf("updatedAt");

  if (iPid < 0 || iYm < 0) throw new Error("header missing");

  var data = sh.getRange(2,1,lastRow-1,lastCol).getValues();
  var targetRow = -1;
  for (var i = 0; i < data.length; i++){
    if (String(data[i][iPid]||"").trim() === projectId && b_normYm_(data[i][iYm]) === ym){
      targetRow = i + 2;
    }
  }
  if (targetRow < 0) throw new Error("cycle not found: " + projectId + "_" + ym);

  if (iPdfId >= 0) sh.getRange(targetRow, iPdfId + 1).setValue(fileId);
  if (iPdfUrl >= 0) sh.getRange(targetRow, iPdfUrl + 1).setValue("https://drive.google.com/file/d/" + fileId);

  var nowJst = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd HH:mm:ss");
  if (iUpd >= 0) sh.getRange(targetRow, iUpd + 1).setValue("'" + nowJst);

  // BillingLog
  var operatorEmail = "";
  try{ operatorEmail = String(Session.getActiveUser().getEmail() || ""); } catch(e){}
  try{
    b_appendBillingLog_({
      actionType: "PDF_UPLOADED",
      target: "invoicePdf",
      projectId: projectId,
      ym: ym,
      cycleId: projectId + "_" + ym,
      afterValue: JSON.stringify({ fileId: fileId, fileName: fileName }),
      reason: "admin_pdf_upload",
      operatorUserId: operatorEmail,
      operatorName: operatorEmail
    });
  } catch(e){}

  // Phase 5 トリガー（送付フロー）
  try{
    if (typeof slackNotifyTriggerInvoiceSendPhase_ === "function"){
      slackNotifyTriggerInvoiceSendPhase_(projectId, ym);
    }
  } catch(e){}

  return { ok:true, projectId: projectId, ym: ym, fileId: fileId, fileName: fileName };
}

/**
 * 請求書番号でPJ×ymを自動マッチング
 * @param {string} invoiceNumber freeeの請求書番号
 * @return {Object|null} { projectId, ym } or null
 */
function admin_matchInvoiceNumber(invoiceNumber){
  if (!isAdmin_()) throw new Error("admin only");
  invoiceNumber = String(invoiceNumber || "").trim();
  if (!invoiceNumber) return null;

  var allCycles = b_readTable_("DB_BillingCycle");
  for (var i = 0; i < allCycles.length; i++){
    var c = allCycles[i];
    var num = String(c.freeeInvoiceNumber || "").trim();
    if (!num) continue;
    if (num === invoiceNumber || num.indexOf(invoiceNumber) >= 0 || invoiceNumber.indexOf(num) >= 0){
      var hasPdf = String(c.invoicePdfFileId || "").trim();
      if (hasPdf) continue; // 既にアップロード済みはスキップ
      return {
        projectId: String(c.projectId || "").trim(),
        ym: b_normYm_(c.ym),
        freeeInvoiceNumber: num,
        projectName: String(c.projectName || "").trim()
      };
    }
  }
  return null;
}

// ---- 内部 ----

function _pendingPdf_prevYm_(ym){
  var y = parseInt(String(ym).slice(0,4), 10);
  var m = parseInt(String(ym).slice(4,6), 10);
  m--;
  if (m < 1){ m = 12; y--; }
  return String(y) + String(m).padStart(2, "0");
}

function _pendingPdf_formatDate_(val){
  if (!val) return "—";
  // Date型の場合
  if (val instanceof Date){
    var jst = new Date(val.getTime());
    var y = jst.getFullYear();
    var m = jst.getMonth() + 1;
    var d = jst.getDate();
    return y + "年" + m + "月" + d + "日";
  }
  // 文字列 yyyy-mm-dd の場合
  var s = String(val).trim();
  var match = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match){
    return Number(match[1]) + "年" + Number(match[2]) + "月" + Number(match[3]) + "日";
  }
  return s || "—";
}

function _pendingPdf_findCycle_(cycles, pid, ym){
  for (var i = 0; i < cycles.length; i++){
    if (String(cycles[i].projectId || "").trim() === pid && b_normYm_(cycles[i].ym) === ym){
      return cycles[i];
    }
  }
  return null;
}

/**
 * 9タスク用の新カラムをDB_BillingCycleに保証する
 */
function _bm_ensureNewColumns_(){
  b_ensureHeader_("DB_BillingCycle", [
    "invoiceSentBy",
    "rewardPaidAt","rewardPaidBy"
  ]);
}

// ================================================================
// 請求額承認待ちリスト（billing_budget）
// ================================================================

function admin_getBudgetPendingList() {
  if (!isAdmin_()) return { ok: false, message: "admin only" };
  try {
    var rows = b_readTable_("DB_BillingCycle");
    var list = rows.filter(function(r) {
      return String(r.status || "").trim() === "reported";
    }).map(function(r) {
      return {
        projectId:            String(r.projectId || "").trim(),
        projectName:          String(r.projectName || "").trim(),
        ym:                   b_normYm_(r.ym),
        budgetReportedAmount: Number(r.budgetReportedAmount || 0),
        budgetReportedAt:     String(r.budgetReportedAt || ""),
        budgetReportedBy:     String(r.budgetReportedBy || "").trim()
      };
    }).filter(function(r) { return !!r.ym; });
    return JSON.parse(JSON.stringify({ ok: true, list: list }));
  } catch(e) { return { ok: false, message: e.message }; }
}

function admin_approveBudget(payload) {
  if (!isAdmin_()) return { ok: false, message: "admin only" };
  var projectId = String(payload.projectId || "").trim();
  var ym        = b_normYm_(payload.ym);
  if (!projectId || !ym) return { ok: false, message: "projectId / ym が不正" };
  try {
    var rows = b_readTable_("DB_BillingCycle");
    var row = null;
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i].projectId || "").trim() === projectId && b_normYm_(rows[i].ym) === ym) {
        row = rows[i]; break;
      }
    }
    if (!row) return { ok: false, message: "レコードが見つからない" };
    var reported = Number(row.budgetReportedAmount || 0);
    if (reported <= 0) return { ok: false, message: "申告額が0。再申告を依頼してください" };
    var budget65 = Math.round(reported * 0.65);
    var now = fmtJstNow_();
    var operator = Session.getActiveUser().getEmail();
    b_upsertRow_("DB_BillingCycle", ["projectId", "ym"], {
      projectId:          projectId,
      ym:                 ym,
      budgetTotal:        budget65,
      budgetConfirmedAt:  now,
      budgetConfirmedBy:  operator,
      status:             "budget_confirmed",
      updatedAt:          now
    });
    return { ok: true, message: "承認しました" };
  } catch(e) { return { ok: false, message: e.message }; }
}