// 立替の “業務ロジック” （save/list/toggleApprove/receipt）
/**
 * ReimburseApi.gs
 *
 * 立替登録（フォーム保存 + レシートをDriveへ保存）を担当
 *
 * 使うシート:
 *  - DB_Reimbursements
 *
 * 使うDriveフォルダ:
 *  - ルート直下に "AMD_OS_Reimburse_Receipts"
 */

function reimburse_saveExpense(payload){
  payload = payload || {};

  var projectId = String(payload.projectId || "").trim();
  var date = String(payload.date || "").trim(); // yyyy-mm-dd
  var category = String(payload.category || "").trim();
  var amount = Number(payload.amount || 0);

  // ★追加
  var taxRate = Number(payload.taxRate || 0);
  if (isNaN(taxRate)) taxRate = 0;
  // UIの想定値以外は丸めて事故らないようにする（0/0.08/0.10のみ許可）
  if (!(taxRate === 0 || taxRate === 0.08 || taxRate === 0.10)) taxRate = 0.10;

  var desc = String(payload.desc || "").trim();
  var transport = payload.transport || null;
  var receipt = payload.receipt || null;

  if (!projectId) return { ok:false, message:"projectId empty" };
  if (!date) return { ok:false, message:"date empty" };
  if (!category) return { ok:false, message:"category empty" };
  if (!amount || amount <= 0) return { ok:false, message:"amount invalid" };
  if (!desc) return { ok:false, message:"desc empty" };

  if (category === "transport"){
    if (!transport) return { ok:false, message:"transport missing" };
    if (!String(transport.mode||"").trim()) return { ok:false, message:"transport.mode empty" };
    if (!String(transport.from||"").trim()) return { ok:false, message:"transport.from empty" };
    if (!String(transport.to||"").trim()) return { ok:false, message:"transport.to empty" };
  }

  // レシート保存（あれば）
  var receiptInfo = { fileId:"", fileName:"", mimeType:"" };
  if (receipt && receipt.base64){
    var saved = reimburse_saveReceiptToDrive({
      projectId: projectId,
      date: date,
      category: category,
      amount: amount,
      desc: desc,
      fileName: String(receipt.name || "").trim(),
      mimeType: String(receipt.mimeType || "").trim(),
      base64: String(receipt.base64 || "")
    });
    if (!saved.ok) return saved;
    receiptInfo = saved.receipt || receiptInfo;
  }

  // DBに保存
  var row = reimburse_appendRow({
    projectId: projectId,
    date: date,
    category: category,
    amount: amount,
    taxRate: taxRate, // ★追加
    desc: desc,
    transport: transport,
    receipt: receiptInfo
  });
  if (!row.ok) return row;

  // 通知キュー
  try{
    reimburseEnqueuePmNotify({
      reimbursementId: String(row.reimbursementId || "").trim(),
      projectId: projectId,
      date: date,
      category: category,
      amount: amount,
      desc: desc
    });
  } catch(e){}

  return { ok:true, reimbursementId: row.reimbursementId };
}

function reimburse_listMyRecentExpenses(payload){
  payload = payload || {};
  var limit = Number(payload.limit || 20);
  if (!limit || limit <= 0) limit = 20;
  if (limit > 100) limit = 100;

  var viewerEmail = (Session.getActiveUser().getEmail() || "").toLowerCase().trim();

  // ★ヘッダ保証（taxRate含む）
  var sh = reimburse_getOrCreateSheet("DB_Reimbursements", reimburse_getHeaders());
  var values = sh.getDataRange().getValues();
  if (!values || values.length < 2) return { ok:true, items:[], meta:{ viewerRole:"member" } };

  var h = values[0].map(function(x){ return String(x||"").trim(); });
  var idx = function(name){ return h.indexOf(name); };

  var iId = idx("reimbursementId");
  var iDate = idx("date");
  var iProjectId = idx("projectId");
  var iProjectName = idx("projectName");
  var iCategory = idx("category");
  var iAmount = idx("amount");
  var iTaxRate = idx("taxRate");
  var iDesc = idx("desc");
  var iStatus = idx("status");
  var iCreatedBy = idx("createdBy");

  var iPmBy = idx("pmApprovedBy");
  var iPmAt = idx("pmApprovedAt");
  var iAdminBy = idx("adminApprovedBy");
  var iAdminAt = idx("adminApprovedAt");

  function isAdminLocal(){
    // ★本体GASの isAdmin_() を直接呼ぶ（02_AccessControl.js に定義済み）
    try{ if (typeof isAdmin_ === "function") return !!isAdmin_(); } catch(e){}
    // フォールバック: canAccessAdminPage_ も同ファイルに定義済み
    try{ if (typeof canAccessAdminPage_ === "function") return !!canAccessAdminPage_(); } catch(e2){}
    return false;
  }
  var viewerIsAdmin = isAdminLocal();

  function fmtJstYmdHm(v){
    if (v === null || v === undefined || v === "") return "";
    try{
      if (Object.prototype.toString.call(v) === "[object Date]" && !isNaN(v.getTime())){
        return Utilities.formatDate(v, "Asia/Tokyo", "yyyy-MM-dd HH:mm");
      }
    } catch(e){}

    var s = String(v||"").trim();
    if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}$/.test(s)) return s.slice(0,16);
    if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}$/.test(s)) return s;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

    try{
      var d = new Date(s);
      if (!isNaN(d.getTime())){
        return Utilities.formatDate(d, "Asia/Tokyo", "yyyy-MM-dd HH:mm");
      }
    } catch(e2){}
    return s;
  }

  function normTaxRate(v){
    var r = Number(v);
    if (isNaN(r)) r = 0;
    if (!(r === 0 || r === 0.08 || r === 0.10)) r = 0.10;
    return r;
  }

  var items = [];
  var viewerIsPmSomewhere = false;

  for (var r = values.length - 1; r >= 1; r--){
    var row = values[r];

    var createdBy = (iCreatedBy >= 0) ? String(row[iCreatedBy] || "").toLowerCase().trim() : "";
    var projectId = (iProjectId >= 0) ? String(row[iProjectId] || "").trim() : "";
    var status = (iStatus >= 0) ? String(row[iStatus] || "").trim() : "";

    // ===== 表示仕様（元に戻す）=====
    // - 自分が作った立替は表示
    // - 自分がPMのPJの立替は表示（申請者に関係なく）
    // - adminは表示（運用上そうだった前提）
    var isMine = (viewerEmail && createdBy && viewerEmail === createdBy);

    var isPmForThis = false;
    try{ isPmForThis = projectId ? reimburse_isPmForProject_(projectId) : false; } catch(e){ isPmForThis = false; }
    if (isPmForThis) viewerIsPmSomewhere = true;

    if (!(isMine || isPmForThis || viewerIsAdmin)) continue;

    var category = (iCategory >= 0) ? String(row[iCategory] || "").trim() : "";

    // 承認ボタン可否（adminはPM承認も可能）
    var canPmApprove = false;
    if (projectId && (status === "submitted" || status === "pmApproved")){
      canPmApprove = isPmForThis || viewerIsAdmin;
    }
    var canAdminApprove = false;
    if (status === "pmApproved" || status === "approved"){
      canAdminApprove = viewerIsAdmin;
    }

    var pmBy = (iPmBy >= 0) ? String(row[iPmBy] || "").trim() : "";
    var pmAt = (iPmAt >= 0) ? fmtJstYmdHm(row[iPmAt]) : "";
    var adminBy = (iAdminBy >= 0) ? String(row[iAdminBy] || "").trim() : "";
    var adminAt = (iAdminAt >= 0) ? fmtJstYmdHm(row[iAdminAt]) : "";

    var pmByLabel = pmBy ? reimburse_getMemberLabelByEmail(pmBy) : "";
    var adminByLabel = adminBy ? reimburse_getMemberLabelByEmail(adminBy) : "";

    var pmApproved = (status === "pmApproved" || status === "approved" || !!pmAt || !!pmBy);
    var adminApproved = (status === "approved" || !!adminAt || !!adminBy);

    var taxRate = (iTaxRate >= 0) ? normTaxRate(row[iTaxRate]) : 0.10;

    items.push({
      reimbursementId: (iId >= 0) ? String(row[iId] || "") : "",
      date: (iDate >= 0) ? fmtJstYmdHm(row[iDate] || "") : "",
      projectId: projectId,
      projectName: (iProjectName >= 0) ? String(row[iProjectName] || "") : "",
      category: category,
      categoryLabel: reimburse_categoryLabel(category),
      amount: (iAmount >= 0) ? Number(row[iAmount] || 0) : 0,
      taxRate: taxRate,
      desc: (iDesc >= 0) ? String(row[iDesc] || "") : "",
      status: status,
      statusLabel: reimburse_statusLabel(status),

      pmApproved: pmApproved,
      pmApprovedBy: pmBy,
      pmApprovedByLabel: pmByLabel,
      pmApprovedAt: pmAt,
      canPmApprove: canPmApprove,

      adminApproved: adminApproved,
      adminApprovedBy: adminBy,
      adminApprovedByLabel: adminByLabel,
      adminApprovedAt: adminAt,
      canAdminApprove: canAdminApprove
    });

    if (items.length >= limit) break;
  }

  return {
    ok:true,
    items: items,
    meta: { viewerRole: viewerIsAdmin ? "admin" : (viewerIsPmSomewhere ? "pm" : "member") }
  };
}

 // 立替一覧の「更新トークン」を返す（超軽量）
function reimburse_getMyExpensesVersion(payload){
  payload = payload || {};
  var email = (Session.getActiveUser().getEmail() || "").toLowerCase().trim();

  var sh = reimburse_getOrCreateSheet("DB_Reimbursements", reimburse_getHeaders().concat(["approvedBy","approvedAt"]));
  var values = sh.getDataRange().getValues();
  if (!values || values.length < 2) return { ok:true, version:"0", pendingCount:0 };

  var h = values[0].map(function(x){ return String(x||"").trim(); });
  var idx = function(name){ return h.indexOf(name); };

  var iCreatedBy = idx("createdBy");
  var iUpdatedAt = idx("updatedAt");
  var iStatus = idx("status");

  if (iCreatedBy < 0 || iUpdatedAt < 0 || iStatus < 0){
    return { ok:false, message:"headers missing (createdBy/updatedAt/status)" };
  }

  function toJstStr_(v){
    if (v === null || v === undefined || v === "") return "";
    try{
      if (Object.prototype.toString.call(v) === "[object Date]" && !isNaN(v.getTime())){
        return Utilities.formatDate(v, "Asia/Tokyo", "yyyy-MM-dd HH:mm:ss");
      }
    } catch(e){}
    return String(v||"").trim();
  }

  var maxUpdated = "";
  var pending = 0;

  for (var r=1; r<values.length; r++){
    var row = values[r];

    var createdBy = String(row[iCreatedBy] || "").toLowerCase().trim();
    if (email && createdBy && email !== createdBy) continue;

    var st = String(row[iStatus] || "").trim();
    if (st === "submitted") pending++;

    var u = toJstStr_(row[iUpdatedAt]);
    if (u && u > maxUpdated) maxUpdated = u; // "yyyy-MM-dd HH:mm:ss" なら文字比較でOK
  }

  return { ok:true, version: maxUpdated || "0", pendingCount: pending };
}

/* -----------------------
 * 内部ヘルパー
 * --------------------- */

function reimburse_appendRow(input){
  var now = new Date();
  var reimbursementId = Utilities.getUuid();

  var projectId = String(input.projectId||"").trim();

  // PJ名を引く（失敗しても空で進める）
  var pj = reimburse_tryGetProjectName(projectId);

  var transport = input.transport || null;
  var receipt = input.receipt || null;

  var transportMode = transport ? String(transport.mode||"") : "";
  var transportFrom = transport ? String(transport.from||"") : "";
  var transportTo = transport ? String(transport.to||"") : "";
  var transportTrip = transport ? String(transport.trip||"") : "";

  var receiptFileId = receipt ? String(receipt.fileId||"") : "";
  var receiptFileName = receipt ? String(receipt.fileName||"") : "";
  var receiptMimeType = receipt ? String(receipt.mimeType||"") : "";

  // ★追加：taxRate
  var taxRate = Number(input.taxRate || 0);
  if (isNaN(taxRate)) taxRate = 0;
  if (!(taxRate === 0 || taxRate === 0.08 || taxRate === 0.10)) taxRate = 0.10;

  var createdBy = (Session.getActiveUser().getEmail() || "").toLowerCase().trim();
  var createdAt = Utilities.formatDate(now, "Asia/Tokyo", "yyyy-MM-dd HH:mm:ss");

  // ★初期は submitted 固定
  var status = "submitted";

  var sh = reimburse_getOrCreateSheet("DB_Reimbursements", reimburse_getHeaders());
  sh.appendRow([
    reimbursementId,
    projectId,
    pj.projectName || "",
    String(input.date||""),
    String(input.category||""),
    Number(input.amount||0),

    // ★taxRate列
    taxRate,

    String(input.desc||""),
    transportMode,
    transportFrom,
    transportTo,
    transportTrip,
    receiptFileId,
    receiptFileName,
    receiptMimeType,
    status,
    createdBy,
    createdAt,
    createdAt,

    // ★pm/admin承認（初期空）
    "",
    "",
    "",
    "",

    // 請求連携（初期空）
    "",
    "",
    "",
    ""
  ]);

  return { ok:true, reimbursementId: reimbursementId };
}

function reimburse_saveReceiptToDrive(input){
  var folder = reimburse_getOrCreateReceiptFolder();
  var ext = reimburse_guessExt(input.fileName, input.mimeType);
  var safeDesc = reimburse_sanitizeForFileName(input.desc);
  if (safeDesc.length > 40) safeDesc = safeDesc.slice(0, 40);

  // ファイル名のルール：YYYYMMDD__PJID__CATEGORY__AMOUNT__DESC.ext
  var ymd = String(input.date||"").replace(/-/g,"");
  var fileName = [
    ymd || "unknownDate",
    String(input.projectId||"").trim() || "unknownPJ",
    String(input.category||"").trim() || "unknownCat",
    String(input.amount||"").trim() || "0yen",
    safeDesc || "noDesc"
  ].join("__") + ext;

  var bytes = Utilities.base64Decode(String(input.base64||""));
  var blob = Utilities.newBlob(bytes, input.mimeType || "application/octet-stream", fileName);

  var file = folder.createFile(blob);
  return {
    ok:true,
    receipt: {
      fileId: file.getId(),
      fileName: file.getName(),
      mimeType: input.mimeType || ""
    }
  };
}

// ★レシート保存先の「親」フォルダID（URLの /folders/ の後ろ）
var REIMBURSE_RECEIPT_PARENT_FOLDER_ID = "1b1AbBmJZJx_gGMzmPuMSLnOG-3-Rjy9I";

function reimburse_getOrCreateReceiptFolder(){
  var name = "AMD_OS_Reimburse_Receipts";

  // 親フォルダの直下に限定
  var parent = DriveApp.getFolderById(REIMBURSE_RECEIPT_PARENT_FOLDER_ID);

  // 既にあるかチェック（親直下だけ探す）
  var it = parent.getFoldersByName(name);
  if (it.hasNext()) return it.next();

  return parent.createFolder(name);
}

function admin_reimburseMigrateHeadersToCanonical(){
  // adminだけ実行可（02_AccessControl.js の isAdmin_() を直接使う）
  var isAdmin = false;
  try{ if (typeof isAdmin_ === "function") isAdmin = !!isAdmin_(); } catch(e){}
  if (!isAdmin){
    try{ if (typeof canAccessAdminPage_ === "function") isAdmin = !!canAccessAdminPage_(); } catch(e2){}
  }
  if (!isAdmin) return { ok:false, message:"admin only" };

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName("DB_Reimbursements");
  if (!sh) return { ok:false, message:"DB_Reimbursements not found" };

  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();
  if (lastRow < 1 || lastCol < 1) return { ok:false, message:"sheet empty" };

  // 現ヘッダ
  var curHeaders = sh.getRange(1,1,1,lastCol).getValues()[0].map(function(x){ return String(x||"").trim(); });

  // 正本ヘッダ（この順で固定）
  var canonical = reimburse_getHeaders().slice();

  // canonicalに無い謎列も一応保持したいならここで末尾に退避（今回はズレ直すのが目的なので捨てる）
  // ただし事故防止で、curHeadersにあるがcanonicalに無い列は末尾へ残す
  var extras = [];
  curHeaders.forEach(function(h){
    if (!h) return;
    if (canonical.indexOf(h) < 0) extras.push(h);
  });
  var newHeaders = canonical.concat(extras);

  // データ読み込み（全行）
  var values = sh.getDataRange().getValues(); // [ [headers], [...], ... ]
  if (!values || values.length < 2){
    // ヘッダだけ直して終わり
    sh.getRange(1,1,1,newHeaders.length).setValues([newHeaders]);
    if (newHeaders.length > lastCol){
      // 右側に伸びた分だけ空で埋める（GASが勝手に縮めないように）
      // ※ setValuesで伸びてるので不要なことが多い
    }
    return { ok:true, moved:0, message:"header fixed (no rows)" };
  }

  // 現列名→インデックス
  var curIndex = {};
  curHeaders.forEach(function(h, i){ if (h) curIndex[h] = i; });

  // 新行列を構築
  var out = [];
  out.push(newHeaders);

  for (var r=1; r<values.length; r++){
    var row = values[r];
    var newRow = new Array(newHeaders.length).fill("");

    for (var c=0; c<newHeaders.length; c++){
      var name = newHeaders[c];
      var srcIdx = (curIndex[name] !== undefined) ? curIndex[name] : -1;
      newRow[c] = (srcIdx >= 0) ? row[srcIdx] : "";
    }
    out.push(newRow);
  }

  // 一旦シートをクリアして書き戻す（列ズレを完全に消す）
  sh.clearContents();
  sh.getRange(1,1,out.length,out[0].length).setValues(out);

  return { ok:true, moved: out.length - 1, newCols: out[0].length, extras: extras };
}

function reimburse_getHeaders(){
  return [
    "reimbursementId",
    "projectId",
    "projectName",
    "date",
    "category",
    "amount",

    // ★追加：税率（0 / 0.08 / 0.10）
    "taxRate",

    "desc",
    "transportMode",
    "transportFrom",
    "transportTo",
    "transportTrip",
    "receiptFileId",
    "receiptFileName",
    "receiptMimeType",

    // 状態
    "status",

    // 申請
    "createdBy",
    "createdAt",
    "updatedAt",

    // ★承認（段階別）
    "pmApprovedBy",
    "pmApprovedAt",
    "adminApprovedBy",
    "adminApprovedAt",

    // ★請求連携
    "billedYm",         // 例: 202601
    "billedAt",         // JST文字列
    "billedBy",         // email
    "billingCycleId"    // 例: p31_2026-01（あれば）
  ];
}

function reimburse_getOrCreateSheet(sheetName, headers){
  sheetName = String(sheetName || "").trim();
  headers = Array.isArray(headers) ? headers : [];

  if (!sheetName) throw new Error("reimburse_getOrCreateSheet: sheetName empty");

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(sheetName);
  if (!sh) sh = ss.insertSheet(sheetName);

  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();

  // 初回：ヘッダ作成
  if (lastRow === 0){
    if (headers.length) sh.appendRow(headers);
    return sh;
  }

  // ヘッダ保証（不足があれば末尾に追加）
  if (headers.length){
    if (lastCol < 1) {
      sh.getRange(1,1).setValue(headers[0] || "");
      lastCol = sh.getLastColumn();
    }

    var cur = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0]
      .map(function(x){ return String(x||"").trim(); });

    headers.forEach(function(h){
      h = String(h||"").trim();
      if (!h) return;
      if (cur.indexOf(h) < 0){
        sh.getRange(1, sh.getLastColumn()+1).setValue(h);
        cur.push(h);
      }
    });
  }

  return sh;
}

function reimburse_tryGetProjectName(projectId){
  try{
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName("DB_Projects");
    if (!sh) return { projectName:"" };

    var values = sh.getDataRange().getValues();
    if (!values || values.length < 2) return { projectName:"" };

    var h = values[0].map(function(x){ return String(x||"").trim(); });
    var iProjectId = h.indexOf("projectId");
    var iProjectName = h.indexOf("projectName");

    if (iProjectId < 0) return { projectName:"" };

    for (var r=1; r<values.length; r++){
      var pid = String(values[r][iProjectId] || "").trim();
      if (pid === projectId){
        var pn = (iProjectName >= 0) ? String(values[r][iProjectName] || "").trim() : "";
        return { projectName: pn };
      }
    }
  } catch(e){
  }
  return { projectName:"" };
}

function reimburse_categoryLabel(cat){
  cat = String(cat||"");
  var map = {
    transport: "交通費",
    lodging: "宿泊",
    supplies: "消耗品",
    meal: "会議費",
    other: "その他"
  };
  return map[cat] || cat;
}

function reimburse_statusLabel(st){
  st = String(st||"");
  var map = {
    submitted: "申請",
    pmApproved: "PM承認済（admin待ち）",
    approved: "admin承認済",
    rejected: "却下",
    paid: "支払済"
  };
  return map[st] || st;
}

function reimburseNotifyPmOnSubmitted(info){
  info = info || {};
  var projectId = String(info.projectId || "").trim();
  if (!projectId) return;

  var reimbursementId = String(info.reimbursementId || "").trim();
  var date = String(info.date || "").trim();
  var category = String(info.category || "").trim();
  var amount = Number(info.amount || 0);
  var desc = String(info.desc || "").trim();

  var me = (Session.getActiveUser().getEmail() || "").toLowerCase().trim();

  var pj = reimburse_tryGetProjectName(projectId);
  var pjName = String((pj && pj.projectName) ? pj.projectName : "").trim() || projectId;

  var pmTargets = reimburseGetProjectPmTargets(projectId);
  if (!pmTargets.length) return;

  var baseUrl = ScriptApp.getService().getUrl();
  var linkReimburse = baseUrl + "?page=reimburse&projectId=" + encodeURIComponent(projectId);
  var linkBilling = baseUrl + "?page=billing&projectId=" + encodeURIComponent(projectId);

  // Slack表示用（Block Kit）
  var title = "【立替 承認依頼】";
  var lines =
    "PJ: " + pjName + "（" + projectId + "）\n" +
    "申請者: " + me + "\n" +
    "日付: " + date + "\n" +
    "カテゴリ: " + reimburse_categoryLabel(category) + "\n" +
    "金額: " + amount + "円\n" +
    "内容: " + (desc || "-") + "\n" +
    "ID: " + (reimbursementId || "-");

  var blocks = [
    {
      type: "section",
      text: { type: "mrkdwn", text: "*" + title + "*\n" + lines }
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "承認する ✅" },
          style: "primary",
          action_id: "reimb_approve",
          value: JSON.stringify({ reimbursementId: reimbursementId })
        },
        {
          type: "button",
          text: { type: "plain_text", text: "却下 ❌" },
          style: "danger",
          action_id: "reimb_reject",
          value: JSON.stringify({ reimbursementId: reimbursementId })
        }
      ]
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "▼承認（Reimburse）\n" + linkReimburse + "\n" +
          "▼参照（Billing）\n" + linkBilling
      }
    }
  ];

  // メールfallback用
  var subject = "【AMD OS】立替 承認依頼：" + pjName + " / " + amount + "円";
  var body =
  "PMへ\n\n" +
  "立替の承認依頼が来たよ。\n\n" +
  "【PJ】" + pjName + "（" + projectId + "）\n" +
  "【申請者】" + me + "\n" +
  "【日付】" + date + "\n" +
  "【カテゴリ】" + reimburse_categoryLabel(category) + "\n" +
  "【金額】" + amount + "円\n" +
  "【内容】" + (desc || "-") + "\n" +
  "【ID】" + (reimbursementId || "-") + "\n\n" +
  "▼承認（Reimburse）\n" + linkReimburse + "\n" +
  "▼参照（Billing）\n" + linkBilling + "\n";

  pmTargets.forEach(function(t){
    var notify = String(t.notifyChannel || "gmail").toLowerCase().trim();
    var slackId = String(t.slackId || "").trim();
    var email = String(t.email || "").toLowerCase().trim();

    if (notify === "slack" && slackId){
      try{
        // ★Block Kitで送る
        slack_postDmBlocks(slackId, title, blocks);
        return;
      } catch(e){
        // fallthrough
      }
    }

    if (email){
      try{ GmailApp.sendEmail(email, subject, body); } catch(e2){}
    }
  });
}

function reimburseGetProjectPmTargets(projectId){
  projectId = String(projectId||"").trim();
  if (!projectId) return [];

  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // DB_ProjectMembers
  var shPM = ss.getSheetByName("DB_ProjectMembers");
  if (!shPM) return [];
  var pmVals = shPM.getDataRange().getValues();
  if (!pmVals || pmVals.length < 2) return [];

  var ph = pmVals[0].map(function(x){ return String(x||"").trim(); });
  var iProjectId = ph.indexOf("projectId");
  var iMemberId  = ph.indexOf("memberId");
  var iIsPM      = ph.indexOf("isPM");
  var iIsActive  = ph.indexOf("isActive");
  var iRoleLabel = ph.indexOf("roleLabel");
  if (iProjectId < 0 || iMemberId < 0) return [];

  // PM memberIds
  var pmMemberIds = [];
  for (var r=1; r<pmVals.length; r++){
    var row = pmVals[r];
    if (String(row[iProjectId]||"").trim() !== projectId) continue;

    var isActive = (iIsActive >= 0) ? String(row[iIsActive]||"").toLowerCase().trim() : "true";
    var activeOk = (isActive === "" || isActive === "true" || isActive === "1" || isActive === "yes");
    if (!activeOk) continue;

    var isPm = (iIsPM >= 0) ? String(row[iIsPM]||"").toLowerCase().trim() : "";
    var role = (iRoleLabel >= 0) ? String(row[iRoleLabel]||"").toUpperCase().trim() : "";
    var pmOk = (isPm === "true" || isPm === "1" || isPm === "yes" || role.indexOf("PM") >= 0);
    if (!pmOk) continue;

    var mid = String(row[iMemberId]||"").trim();
    if (mid) pmMemberIds.push(mid);
  }

  if (!pmMemberIds.length) return [];

  // DB_Members
  var shM = ss.getSheetByName("DB_Members");
  if (!shM) return [];
  var mVals = shM.getDataRange().getValues();
  if (!mVals || mVals.length < 2) return [];

  var mh = mVals[0].map(function(x){ return String(x||"").trim(); });
  var miMemberId = mh.indexOf("memberId");
  var miEmail = mh.indexOf("email");
  var miSlackId = mh.indexOf("slackId");
  var miNotify = mh.indexOf("notifyChannel");
  if (miMemberId < 0) return [];

  var set = {};
  pmMemberIds.forEach(function(mid){ set[mid] = true; });

  var out = [];
  for (var i=1; i<mVals.length; i++){
    var row2 = mVals[i];
    var mid2 = String(row2[miMemberId]||"").trim();
    if (!set[mid2]) continue;

    out.push({
      memberId: mid2,
      email: (miEmail>=0) ? String(row2[miEmail]||"").toLowerCase().trim() : "",
      slackId: (miSlackId>=0) ? String(row2[miSlackId]||"").trim() : "",
      notifyChannel: (miNotify>=0) ? String(row2[miNotify]||"").toLowerCase().trim() : "gmail"
    });
  }

  return out;
}

function reimburse_notifyPmOnSubmitted_(info){
  info = info || {};
  var projectId = String(info.projectId || "").trim();
  if (!projectId) return;

  var reimbursementId = String(info.reimbursementId || "").trim();
  var date = String(info.date || "").trim();
  var category = String(info.category || "").trim();
  var amount = Number(info.amount || 0);
  var desc = String(info.desc || "").trim();

  var me = (Session.getActiveUser().getEmail() || "").toLowerCase().trim();

  // PJ名
  var pj = reimburse_tryGetProjectName(projectId);
  var pjName = String((pj && pj.projectName) ? pj.projectName : "").trim() || projectId;

  // PMメール一覧（DB_ProjectMembers + DB_Members）
  var pmEmails = reimburse_getProjectPmEmails_(projectId);
  if (!pmEmails.length) return;

  // Billingリンク（暫定：ReimburseページURLが固まったら差し替え）
  var baseUrl = ScriptApp.getService().getUrl();
  var link = baseUrl + "?page=billing&projectId=" + encodeURIComponent(projectId);

  var subject = "【AMD OS】立替 承認依頼：" + pjName + " / " + amount + "円";

  var body =
    "PMへ\n\n" +
    "立替の承認依頼が来たよ。\n\n" +
    "【PJ】" + pjName + "（" + projectId + "）\n" +
    "【申請者】" + me + "\n" +
    "【日付】" + date + "\n" +
    "【カテゴリ】" + reimburse_categoryLabel(category) + "\n" +
    "【金額】" + amount + "円\n" +
    "【内容】" + (desc || "-") + "\n" +
    "【ID】" + (reimbursementId || "-") + "\n\n" +
    "▼AMD OS\n" + link + "\n";

      var slackText =
    "【立替 承認依頼】\n" +
    "PJ: " + pjName + "（" + projectId + "）\n" +
    "申請者: " + me + "\n" +
    "日付: " + date + "\n" +
    "カテゴリ: " + reimburse_categoryLabel(category) + "\n" +
    "金額: " + amount + "円\n" +
    "内容: " + (desc || "-") + "\n" +
    "ID: " + (reimbursementId || "-") + "\n\n" +
    link;

  // PMごとに notifyChannel を見て送る
  reimburse_sendToPmsByPreference_(pmEmails, subject, body, slackText);
}

function reimburse_getProjectPmEmails_(projectId){
  projectId = String(projectId||"").trim();
  if (!projectId) return [];

  // ProjectMembers
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var shPM = ss.getSheetByName("DB_ProjectMembers");
  if (!shPM) return [];

  var pmVals = shPM.getDataRange().getValues();
  if (!pmVals || pmVals.length < 2) return [];

  var ph = pmVals[0].map(function(x){ return String(x||"").trim(); });
  var iProjectId = ph.indexOf("projectId");
  var iMemberId  = ph.indexOf("memberId");
  var iIsPM      = ph.indexOf("isPM");
  var iIsActive  = ph.indexOf("isActive");
  var iRoleLabel = ph.indexOf("roleLabel");

  if (iProjectId < 0 || iMemberId < 0) return [];

  // Members
  var shM = ss.getSheetByName("DB_Members");
  if (!shM) return [];

  var mVals = shM.getDataRange().getValues();
  if (!mVals || mVals.length < 2) return [];

  var mh = mVals[0].map(function(x){ return String(x||"").trim(); });
  var miMemberId = mh.indexOf("memberId");
  var miEmail    = mh.indexOf("email");
  if (miMemberId < 0 || miEmail < 0) return [];

  var emailByMemberId = {};
  for (var i=1; i<mVals.length; i++){
    var mid = String(mVals[i][miMemberId]||"").trim();
    var em = String(mVals[i][miEmail]||"").toLowerCase().trim();
    if (mid && em) emailByMemberId[mid] = em;
  }

  var out = [];
  for (var r=1; r<pmVals.length; r++){
    var row = pmVals[r];
    if (String(row[iProjectId]||"").trim() !== projectId) continue;

    var isActive = (iIsActive >= 0) ? String(row[iIsActive]||"").toLowerCase().trim() : "true";
    var activeOk = (isActive === "" || isActive === "true" || isActive === "1" || isActive === "yes");
    if (!activeOk) continue;

    var isPm = (iIsPM >= 0) ? String(row[iIsPM]||"").toLowerCase().trim() : "";
    var role = (iRoleLabel >= 0) ? String(row[iRoleLabel]||"").toUpperCase().trim() : "";
    var pmOk = (isPm === "true" || isPm === "1" || isPm === "yes" || role.indexOf("PM") >= 0);
    if (!pmOk) continue;

    var memberId = String(row[iMemberId]||"").trim();
    var em2 = emailByMemberId[memberId] || "";
    if (em2) out.push(em2);
  }

  // uniq
  var seen = {};
  var uniq = [];
  out.forEach(function(e){
    if (!seen[e]) { seen[e] = true; uniq.push(e); }
  });
  return uniq;
}

function reimburse_sendToPmsByPreference_(pmEmails, subject, body, slackText){
  var emails = Array.isArray(pmEmails) ? pmEmails : [];
  if (!emails.length) return;

  // DB_Members から notifyChannel / slackId を引く
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName("DB_Members");
  if (!sh){
    // fallback: 全員メール
    GmailApp.sendEmail(emails.join(","), subject, body);
    return;
  }

  var vals = sh.getDataRange().getValues();
  if (!vals || vals.length < 2){
    GmailApp.sendEmail(emails.join(","), subject, body);
    return;
  }

  var h = vals[0].map(function(x){ return String(x||"").trim(); });
  var iEmail = h.indexOf("email");
  var iNotify = h.indexOf("notifyChannel");
  var iSlackId = h.indexOf("slackId");
  if (iEmail < 0){
    GmailApp.sendEmail(emails.join(","), subject, body);
    return;
  }

  var rowByEmail = {};
  for (var r=1; r<vals.length; r++){
    var em = String(vals[r][iEmail]||"").toLowerCase().trim();
    if (!em) continue;
    rowByEmail[em] = vals[r];
  }

  emails.forEach(function(em){
    var row = rowByEmail[String(em||"").toLowerCase().trim()] || null;
    var notify = row && iNotify>=0 ? String(row[iNotify]||"").toLowerCase().trim() : "gmail";
    var slackId = row && iSlackId>=0 ? String(row[iSlackId]||"").trim() : "";

    if (notify === "slack" && slackId){
      try{
        slack_postDm(slackId, slackText || (subject + "\n\n" + body));
        return;
      } catch(e){
        // fallthrough to email
      }
    }
    GmailApp.sendEmail(em, subject, body);
  });
}

function reimburse_sanitizeForFileName(s){
  s = String(s||"").trim();
  s = s.replace(/[\\\/:\*\?"<>\|]/g, "_");
  s = s.replace(/\s+/g, " ");
  return s;
}

function reimburse_guessExt(fileName, mimeType){
  fileName = String(fileName||"").trim();
  mimeType = String(mimeType||"").trim().toLowerCase();

  if (fileName && fileName.lastIndexOf(".") >= 0){
    var ext = fileName.slice(fileName.lastIndexOf("."));
    if (ext && ext.length <= 10) return ext;
  }

  if (mimeType === "application/pdf") return ".pdf";
  if (mimeType === "image/png") return ".png";
  if (mimeType === "image/jpeg") return ".jpg";
  if (mimeType === "image/webp") return ".webp";

  return ".bin";
}

function reimburse_isPmForProject_(projectId){
  projectId = String(projectId||"").trim();
  if (!projectId) return false;

  var email = (Session.getActiveUser().getEmail() || "").toLowerCase().trim();
  if (!email) return false;

  // memberId を email から引く
  var memberId = reimburse_findMemberIdByEmail_(email);
  if (!memberId) return false;

  // DB_ProjectMembers で isPM & isActive を確認
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName("DB_ProjectMembers");
  if (!sh) return false;

  var vals = sh.getDataRange().getValues();
  if (!vals || vals.length < 2) return false;

  var h = vals[0].map(function(x){ return String(x||"").trim(); });
  var iProjectId = h.indexOf("projectId");
  var iMemberId = h.indexOf("memberId");
  var iIsPM = h.indexOf("isPM");
  var iIsActive = h.indexOf("isActive");

  if (iProjectId < 0 || iMemberId < 0 || iIsPM < 0) return false;

  for (var r=1; r<vals.length; r++){
    var row = vals[r];
    if (String(row[iProjectId]||"").trim() !== projectId) continue;
    if (String(row[iMemberId]||"").trim() !== memberId) continue;

    var isPM = String(row[iIsPM]||"").toLowerCase().trim();
    var isActive = (iIsActive >= 0) ? String(row[iIsActive]||"").toLowerCase().trim() : "true";

    var pmOk = (isPM === "true" || isPM === "1" || isPM === "yes");
    var activeOk = (isActive === "" || isActive === "true" || isActive === "1" || isActive === "yes");

    return pmOk && activeOk;
  }

  return false;
}

function reimburse_findMemberIdByEmail_(email){
  email = String(email||"").toLowerCase().trim();
  if (!email) return "";

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName("DB_Members");
  if (!sh) return "";

  var vals = sh.getDataRange().getValues();
  if (!vals || vals.length < 2) return "";

  var h = vals[0].map(function(x){ return String(x||"").trim(); });
  var iMemberId = h.indexOf("memberId");
  var iEmail = h.indexOf("email");
  if (iMemberId < 0 || iEmail < 0) return "";

  for (var r=1; r<vals.length; r++){
    var row = vals[r];
    var em = String(row[iEmail]||"").toLowerCase().trim();
    if (em === email) return String(row[iMemberId]||"").trim();
  }
  return "";
}

function reimburse_approveExpense(payload){
  // 互換用：昔の「承認」APIを呼ばれても動くようにする
  payload = payload || {};
  var reimbursementId = String(payload.reimbursementId || "").trim();
  if (!reimbursementId) return { ok:false, message:"reimbursementId empty" };

  // submitted のときだけ approve したい、という旧仕様に寄せるため
  // toggleを呼んで、approved になったらok、canceledになったら戻す（＝承認に失敗扱い）
  var res = reimburse_togglePmApprove({ reimbursementId: reimbursementId });
  if (!res || !res.ok) return res;

  if (res.action === "approved") return { ok:true };
  // もし approved だったのを押しちゃって取消になった場合は、旧APIとしてはNGにする
  return { ok:false, message:"already approved" };
}

function reimburse_listMyActiveProjectsForReimburse(payload){
  payload = payload || {};

  var email = (Session.getActiveUser().getEmail() || "").toLowerCase().trim();
  if (!email) return { ok:true, items:[] };

  var memberId = reimburse_findMemberIdByEmail_(email);
  if (!memberId) return { ok:true, items:[] };

  // 1) DB_ProjectMembers から「自分が参加中のPJ」を抽出
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var shPM = ss.getSheetByName("DB_ProjectMembers");
  if (!shPM) return { ok:true, items:[] };

  var pmVals = shPM.getDataRange().getValues();
  if (!pmVals || pmVals.length < 2) return { ok:true, items:[] };

  var ph = pmVals[0].map(function(x){ return String(x||"").trim(); });
  var piProjectId = ph.indexOf("projectId");
  var piMemberId  = ph.indexOf("memberId");
  var piIsActive  = ph.indexOf("isActive");

  if (piProjectId < 0 || piMemberId < 0) return { ok:false, message:"DB_ProjectMembers headers missing" };

  var myProjectIds = {};
  for (var r=1; r<pmVals.length; r++){
    var row = pmVals[r];
    if (String(row[piMemberId]||"").trim() !== memberId) continue;

    var isActive = (piIsActive >= 0) ? String(row[piIsActive]||"").toLowerCase().trim() : "true";
    var activeOk = (isActive === "" || isActive === "true" || isActive === "1" || isActive === "yes");
    if (!activeOk) continue;

    var pid = String(row[piProjectId]||"").trim();
    if (pid) myProjectIds[pid] = true;
  }

  // 参加PJゼロなら空
  var keys = Object.keys(myProjectIds);
  if (keys.length === 0) return { ok:true, items:[] };

  // 2) DB_Projects から「進行中PJ」だけに絞って返す
  var shP = ss.getSheetByName("DB_Projects");
  if (!shP) return { ok:true, items:[] };

  var pVals = shP.getDataRange().getValues();
  if (!pVals || pVals.length < 2) return { ok:true, items:[] };

  var hh = pVals[0].map(function(x){ return String(x||"").trim(); });
  var hiProjectId = hh.indexOf("projectId");
  var hiProjectName = hh.indexOf("projectName");
  var hiStatus = hh.indexOf("status");

  if (hiProjectId < 0) return { ok:false, message:"DB_Projects headers missing" };

  // 進行中判定（AMD OS内の運用に合わせて調整してOK）
  var allow = { active:true, sales:true }; // ←必要なら "draft" も true にする

  var items = [];
  for (var i=1; i<pVals.length; i++){
    var prow = pVals[i];
    var pid2 = String(prow[hiProjectId]||"").trim();
    if (!pid2 || !myProjectIds[pid2]) continue;

    var st = (hiStatus >= 0) ? String(prow[hiStatus]||"").toLowerCase().trim() : "";
    if (st && !allow[st]) continue;

    items.push({
      projectId: pid2,
      projectName: (hiProjectName >= 0) ? String(prow[hiProjectName]||"").trim() : pid2
    });
  }

  // 表示順：projectName昇順
  items.sort(function(a,b){
    return String(a.projectName||"").localeCompare(String(b.projectName||""), "ja");
  });

  return { ok:true, items: items };
}

function reimburse_togglePmApprove(payload){
  payload = payload || {};
  var reimbursementId = String(payload.reimbursementId || "").trim();
  if (!reimbursementId) return { ok:false, message:"reimbursementId empty" };

  // シート & ヘッダ保証（pm/admin承認列込み）
  var sh = reimburse_getOrCreateSheet("DB_Reimbursements", reimburse_getHeaders());
  var vals = sh.getDataRange().getValues();
  if (!vals || vals.length < 2) return { ok:false, message:"no data" };

  var h = vals[0].map(function(x){ return String(x||"").trim(); });
  var idx = function(name){ return h.indexOf(name); };

  var iId = idx("reimbursementId");
  var iProjectId = idx("projectId");
  var iStatus = idx("status");
  var iUpdatedAt = idx("updatedAt");

  var iPmBy = idx("pmApprovedBy");
  var iPmAt = idx("pmApprovedAt");
  var iAdminBy = idx("adminApprovedBy");
  var iAdminAt = idx("adminApprovedAt");

  if (iId < 0 || iProjectId < 0 || iStatus < 0) return { ok:false, message:"headers missing" };

  var targetRow = -1;
  var projectId = "";
  var status = "";

  for (var r=1; r<vals.length; r++){
    if (String(vals[r][iId]||"").trim() === reimbursementId){
      targetRow = r + 1; // 1-indexed
      projectId = String(vals[r][iProjectId]||"").trim();
      status = String(vals[r][iStatus]||"").trim();
      break;
    }
  }
  if (targetRow < 0) return { ok:false, message:"not found" };

  // ★PMまたはadminが操作可
  var isAdminForToggle = false;
  try{ if (typeof isAdmin_ === "function") isAdminForToggle = !!isAdmin_(); } catch(_e){}
  if (!reimburse_isPmForProject_(projectId) && !isAdminForToggle){
    return { ok:false, message:"PM or admin only" };
  }

  // ★PMが触るのは submitted / pmApproved のみ（admin承認済みはPMで戻さない）
  if (!(status === "submitted" || status === "pmApproved")){
    return { ok:false, message:"invalid status for PM: " + status };
  }

  var now = new Date();
  var email = (Session.getActiveUser().getEmail() || "").toLowerCase().trim();
  var ts = Utilities.formatDate(now, "Asia/Tokyo", "yyyy-MM-dd HH:mm:ss");

  if (status === "submitted"){
    // submitted → pmApproved（PM承認）
    sh.getRange(targetRow, iStatus+1).setValue("pmApproved");
    if (iPmBy >= 0) sh.getRange(targetRow, iPmBy+1).setValue(email);
    if (iPmAt >= 0) sh.getRange(targetRow, iPmAt+1).setValue(ts);
    if (iUpdatedAt >= 0) sh.getRange(targetRow, iUpdatedAt+1).setValue(ts);

    // ★admin承認列は空のまま（念のため掃除）
    if (iAdminBy >= 0) sh.getRange(targetRow, iAdminBy+1).setValue("");
    if (iAdminAt >= 0) sh.getRange(targetRow, iAdminAt+1).setValue("");

    // ★PM承認後にadminへ承認依頼（失敗を握りつぶさない）
    try{
      var notifyRes = reimburseNotifyAdminOnPmApproved({ reimbursementId: reimbursementId, projectId: projectId }) || {};
      if (!notifyRes.ok || Number(notifyRes.sentCount || 0) <= 0){
        reimburse_appendNotifyLog({
          kind: "admin",
          reimbursementId: reimbursementId,
          projectId: projectId,
          message: "admin notify not sent",
          detail: JSON.stringify(notifyRes || {})
        });
      }
    } catch(e){
      reimburse_appendNotifyLog({
        kind: "admin",
        reimbursementId: reimbursementId,
        projectId: projectId,
        message: "admin notify threw error",
        detail: String(e && (e.message || e))
      });
    }

    return { ok:true, action:"pmApproved", pmApprovedBy:email, pmApprovedAt:ts };
  }

  // pmApproved → submitted（PM承認の取消）
  sh.getRange(targetRow, iStatus+1).setValue("submitted");
  if (iPmBy >= 0) sh.getRange(targetRow, iPmBy+1).setValue("");
  if (iPmAt >= 0) sh.getRange(targetRow, iPmAt+1).setValue("");
  if (iUpdatedAt >= 0) sh.getRange(targetRow, iUpdatedAt+1).setValue(ts);

  // admin列も空へ
  if (iAdminBy >= 0) sh.getRange(targetRow, iAdminBy+1).setValue("");
  if (iAdminAt >= 0) sh.getRange(targetRow, iAdminAt+1).setValue("");

  return { ok:true, action:"pmCanceled" };
}

function reimburse_listApprovedForBilling(payload){
  payload = payload || {};
  var projectId = String(payload.projectId || "").trim();
  var ym = String(payload.ym || "").trim(); // "2026-01" or "202601"
  if (!projectId) return { ok:false, message:"projectId empty" };
  if (!ym) return { ok:false, message:"ym empty" };

  var yyyymm = ym.replace(/[^0-9]/g,"");
  if (!/^\d{6}$/.test(yyyymm)) return { ok:false, message:"ym invalid: " + ym };

  function yyyymmFromDateCell_(v){
    if (v === null || v === undefined || v === "") return "";
    try{
      if (Object.prototype.toString.call(v) === "[object Date]" && !isNaN(v.getTime())){
        return Utilities.formatDate(v, "Asia/Tokyo", "yyyyMM");
      }
    } catch(e){}
    var s = String(v || "").trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0,7).replace("-","");
    var digits = s.replace(/[^\d]/g,"");
    if (digits.length >= 6) return digits.slice(0,6);
    return "";
  }

  function normTaxRate_(v){
    var r = Number(v);
    if (isNaN(r)) r = 0;
    if (!(r === 0 || r === 0.08 || r === 0.10)) r = 0.10;
    return r;
  }

  var sh = reimburse_getOrCreateSheet("DB_Reimbursements", reimburse_getHeaders());
  var vals = sh.getDataRange().getValues();
  if (!vals || vals.length < 2){
    return { ok:true, yyyymm:yyyymm, items:[], totalYen:0 };
  }

  var h = vals[0].map(function(x){ return String(x||"").trim(); });
  var idx = function(name){ return h.indexOf(name); };

  var iId = idx("reimbursementId");
  var iProjectId = idx("projectId");
  var iDate = idx("date");
  var iCategory = idx("category");
  var iAmount = idx("amount");
  var iDesc = idx("desc");
  var iStatus = idx("status");
  var iBilledYm = idx("billedYm");

  // ★追加：taxRate
  var iTaxRate = idx("taxRate");

  var items = [];
  var total = 0;

  for (var r=1; r<vals.length; r++){
    var row = vals[r];

    if (String(row[iProjectId]||"").trim() !== projectId) continue;

    // admin承認済みだけ
    var st = String(row[iStatus]||"").trim();
    if (st !== "approved") continue;

    // 請求済みは除外
    var billedYm = (iBilledYm >= 0) ? String(row[iBilledYm]||"").trim() : "";
    if (billedYm) continue;

    // 対象月は発生日(date)で判定
    var rowYm = yyyymmFromDateCell_(row[iDate]);
    if (rowYm !== yyyymm) continue;

    var amt = Number(row[iAmount]||0);
    total += amt;

    var dateStr = "";
    try{
      if (Object.prototype.toString.call(row[iDate]) === "[object Date]" && !isNaN(row[iDate].getTime())){
        dateStr = Utilities.formatDate(row[iDate], "Asia/Tokyo", "yyyy-MM-dd");
      } else {
        dateStr = String(row[iDate]||"").trim();
      }
    } catch(e){
      dateStr = String(row[iDate]||"").trim();
    }

    var taxRate = (iTaxRate >= 0) ? normTaxRate_(row[iTaxRate]) : 0.10;

    items.push({
      reimbursementId: String(row[iId]||"").trim(),
      date: dateStr,
      category: String(row[iCategory]||"").trim(),
      categoryLabel: reimburse_categoryLabel(String(row[iCategory]||"").trim()),
      amount: amt,
      // ★追加：Billing側が税抜計算で使う
      taxRate: taxRate,
      desc: String(row[iDesc]||"")
    });
  }

  return { ok:true, yyyymm:yyyymm, items:items, totalYen:total };
}

function reimburse_markBilled(payload){
  payload = payload || {};
  var reimbursementIds = payload.reimbursementIds || [];
  var ym = String(payload.ym || "").trim();
  var billingCycleId = String(payload.billingCycleId || "").trim();

  var yyyymm = ym.replace(/[^0-9]/g,"");
  if (!/^\d{6}$/.test(yyyymm)) return { ok:false, message:"ym invalid: " + ym };
  if (!Array.isArray(reimbursementIds) || reimbursementIds.length === 0) return { ok:true, updated:0 };

  var sh = reimburse_getOrCreateSheet("DB_Reimbursements", reimburse_getHeaders().concat(["approvedBy","approvedAt"]));
  var vals = sh.getDataRange().getValues();
  if (!vals || vals.length < 2) return { ok:true, updated:0 };

  var h = vals[0].map(function(x){ return String(x||"").trim(); });
  var idx = function(name){ return h.indexOf(name); };

  var iId = idx("reimbursementId");
  var iBilledYm = idx("billedYm");
  var iBilledAt = idx("billedAt");
  var iBilledBy = idx("billedBy");
  var iBillingCycleId = idx("billingCycleId");
  var iUpdatedAt = idx("updatedAt");

  var set = {};
  reimbursementIds.forEach(function(id){ set[String(id||"").trim()] = true; });

  var email = (Session.getActiveUser().getEmail() || "").toLowerCase().trim();
  var ts = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd HH:mm:ss");

  var updated = 0;
  for (var r=1; r<vals.length; r++){
    var rid = String(vals[r][iId]||"").trim();
    if (!set[rid]) continue;

    var rowNo = r + 1;
    if (iBilledYm >= 0) sh.getRange(rowNo, iBilledYm+1).setValue(yyyymm);
    if (iBilledAt >= 0) sh.getRange(rowNo, iBilledAt+1).setValue(ts);
    if (iBilledBy >= 0) sh.getRange(rowNo, iBilledBy+1).setValue(email);
    if (iBillingCycleId >= 0) sh.getRange(rowNo, iBillingCycleId+1).setValue(billingCycleId);
    if (iUpdatedAt >= 0) sh.getRange(rowNo, iUpdatedAt+1).setValue(ts);
    updated++;
  }

  return { ok:true, updated:updated };
}

function reimburse_toggleAdminApprove(payload){
  payload = payload || {};
  var reimbursementId = String(payload.reimbursementId || "").trim();
  if (!reimbursementId) return { ok:false, message:"reimbursementId empty" };

  var sh = reimburse_getOrCreateSheet("DB_Reimbursements", reimburse_getHeaders());
  var vals = sh.getDataRange().getValues();
  if (!vals || vals.length < 2) return { ok:false, message:"no data" };

  var h = vals[0].map(function(x){ return String(x||"").trim(); });
  var idx = function(name){ return h.indexOf(name); };

  var iId = idx("reimbursementId");
  var iStatus = idx("status");
  var iUpdatedAt = idx("updatedAt");
  var iAdminBy = idx("adminApprovedBy");
  var iAdminAt = idx("adminApprovedAt");

  if (iId < 0 || iStatus < 0) return { ok:false, message:"headers missing" };

  // ★admin判定（02_AccessControl.js の isAdmin_() を直接使う）
  var isAdmin = false;
  try{ if (typeof isAdmin_ === "function") isAdmin = !!isAdmin_(); } catch(_e){}
  if (!isAdmin){
    try{ if (typeof canAccessAdminPage_ === "function") isAdmin = !!canAccessAdminPage_(); } catch(_e2){}
  }
  if (!isAdmin){
    return { ok:false, message:"admin only" };
  }

  var targetRow = -1;
  var status = "";

  for (var r=1; r<vals.length; r++){
    if (String(vals[r][iId]||"").trim() === reimbursementId){
      targetRow = r + 1;
      status = String(vals[r][iStatus]||"").trim();
      break;
    }
  }
  if (targetRow < 0) return { ok:false, message:"not found" };

  // adminが触れるのは pmApproved / approved のみ
  if (!(status === "pmApproved" || status === "approved")){
    return { ok:false, message:"invalid status for admin: " + status };
  }

  var now = new Date();
  var email = (Session.getActiveUser().getEmail() || "").toLowerCase().trim();
  var ts = Utilities.formatDate(now, "Asia/Tokyo", "yyyy-MM-dd HH:mm:ss");

  if (status === "pmApproved"){
    // pmApproved → approved（admin承認）
    sh.getRange(targetRow, iStatus+1).setValue("approved");
    if (iAdminBy >= 0) sh.getRange(targetRow, iAdminBy+1).setValue(email);
    if (iAdminAt >= 0) sh.getRange(targetRow, iAdminAt+1).setValue(ts);
    if (iUpdatedAt >= 0) sh.getRange(targetRow, iUpdatedAt+1).setValue(ts);
    return { ok:true, action:"adminApproved", adminApprovedBy:email, adminApprovedAt:ts };
  }

  // approved → pmApproved（admin承認の取消）
  sh.getRange(targetRow, iStatus+1).setValue("pmApproved");
  if (iAdminBy >= 0) sh.getRange(targetRow, iAdminBy+1).setValue("");
  if (iAdminAt >= 0) sh.getRange(targetRow, iAdminAt+1).setValue("");
  if (iUpdatedAt >= 0) sh.getRange(targetRow, iUpdatedAt+1).setValue(ts);
  return { ok:true, action:"adminCanceled" };
}

function reimburse_countPendingForBillingGuard(payload){
  payload = payload || {};
  var projectId = String(payload.projectId || "").trim();
  var ym = String(payload.ym || "").trim();
  if (!projectId) return { ok:false, message:"projectId empty" };
  if (!ym) return { ok:false, message:"ym empty" };

  var yyyymm = ym.replace(/[^0-9]/g,"");
  if (!/^\d{6}$/.test(yyyymm)) return { ok:false, message:"ym invalid: " + ym };

  var sh = reimburse_getOrCreateSheet("DB_Reimbursements", reimburse_getHeaders());
  var vals = sh.getDataRange().getValues();
  if (!vals || vals.length < 2){
    return { ok:true, pendingCount:0, meta:{} };
  }

  var h = vals[0].map(function(x){ return String(x||"").trim(); });
  var idx = function(name){ return h.indexOf(name); };

  var iProjectId = idx("projectId");
  var iDate = idx("date");
  var iStatus = idx("status");
  var iBilledYm = idx("billedYm");

  var pending = 0;

  for (var r=1; r<vals.length; r++){
    var row = vals[r];

    if (String(row[iProjectId]||"").trim() !== projectId) continue;

    var billedYm = (iBilledYm >= 0) ? String(row[iBilledYm]||"").trim() : "";
    if (billedYm) continue;

    var rowYm = reimburseYyyymmFromDateValue(row[iDate]);
    if (rowYm !== yyyymm) continue;

    var st = String(row[iStatus]||"").trim();

    // ★最小ルール：approved以外は全部pending扱い（submitted/pmApproved/rejected等）
    if (st !== "approved"){
      pending++;
    }
  }

  return { ok:true, pendingCount: pending, meta:{} };
}

function reimburseYyyymmFromDateValue(v){
  if (v === null || v === undefined || v === "") return "";

  // Date型なら確実にJST基準でyyyyMM
  try {
    if (Object.prototype.toString.call(v) === "[object Date]" && !isNaN(v.getTime())) {
      return Utilities.formatDate(v, "Asia/Tokyo", "yyyyMM");
    }
  } catch(e){}

  // 文字列として処理
  var s = String(v || "").trim();

  // "2026-01-22" 形式
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0,7).replace("-","");

  // "Thu Jan 22 2026 17:00:00 GMT+0900 ..." 形式 → DateにしてyyyyMM
  try {
    var d = new Date(s);
    if (!isNaN(d.getTime())) {
      return Utilities.formatDate(d, "Asia/Tokyo", "yyyyMM");
    }
  } catch(e){}

  // 最後の手段：数字だけ抜いて先頭6桁
  var digits = s.replace(/[^\d]/g,"");
  if (digits.length >= 6) return digits.slice(0,6);

  return "";
}

function reimburse_getMemberLabelByEmail(email){
  email = String(email||"").toLowerCase().trim();
  if (!email) return "";

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName("DB_Members");
  if (!sh) return "";

  var vals = sh.getDataRange().getValues();
  if (!vals || vals.length < 2) return "";

  var h = vals[0].map(function(x){ return String(x||"").trim(); });

  var iEmail = h.indexOf("email");
  var iCode  = h.indexOf("codeName");

  if (iEmail < 0 || iCode < 0) return "";

  for (var r=1; r<vals.length; r++){
    var em = String(vals[r][iEmail]||"").toLowerCase().trim();
    if (em !== email) continue;

    var code = String(vals[r][iCode]||"").trim();
    return code || "";
  }

  return "";
}

function reimburseEnqueuePmNotify(job){
  job = job || {};
  var reimbursementId = String(job.reimbursementId || "").trim();
  var projectId = String(job.projectId || "").trim();
  if (!reimbursementId || !projectId) return;

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;

  try{
    var props = PropertiesService.getScriptProperties();
    var key = "REIMBURSE_NOTIFY_QUEUE_JSON";

    var arr = [];
    try{
      var cur = props.getProperty(key);
      arr = cur ? JSON.parse(cur) : [];
    } catch(e){
      arr = [];
    }

    arr.push({
      atJst: Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd'T'HH:mm:ssXXX"),
      reimbursementId: reimbursementId,
      projectId: projectId,
      date: String(job.date || "").trim(),
      category: String(job.category || "").trim(),
      amount: Number(job.amount || 0),
      desc: String(job.desc || "").trim(),
      retry: Number(job.retry || 0)
    });

    if (arr.length > 50) arr = arr.slice(arr.length - 50);
    props.setProperty(key, JSON.stringify(arr));

    // ★常設トリガー保険（存在しなければ作る）
    try{ reimburseEnsureNotifyTrigger(); } catch(_e){}

  } finally {
    try{ lock.releaseLock(); } catch(_e){}
  }

  // ★ここはLock外でOK：即時実行は「できたらラッキー」枠
  try{ reimburseNotifyPmWorker(); } catch(_e){}
}

function reimburseEnsureNotifyTrigger(){
  var fn = "reimburseNotifyPmWorker";
  var triggers = ScriptApp.getProjectTriggers();

  for (var i=0; i<triggers.length; i++){
    var t = triggers[i];
    if (t.getHandlerFunction && t.getHandlerFunction() === fn){
      return;
    }
  }

  // ★確実性優先：常設で1分ごと
  ScriptApp.newTrigger(fn).timeBased().everyMinutes(1).create();
}

function admin_reimburseEnsureNotifyTrigger(){
  reimburseEnsureNotifyTrigger();
  return { ok:true, message:"ensure trigger done" };
}

function admin_reimburseListNotifyTriggers(){
  const fn = "reimburseNotifyPmWorker";
  const triggers = ScriptApp.getProjectTriggers();
  const out = [];

  for (let i=0; i<triggers.length; i++){
    const t = triggers[i];
    out.push({
      handler: t.getHandlerFunction ? t.getHandlerFunction() : "",
      type: String(t.getEventType ? t.getEventType() : ""),
      source: String(t.getTriggerSource ? t.getTriggerSource() : "")
    });
  }

  return { ok:true, count: out.length, triggers: out, hasWorker: out.some(x => x.handler === fn) };
}

function reimburseNotifyPmWorker(){
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;

  var props = PropertiesService.getScriptProperties();
  var key = "REIMBURSE_NOTIFY_QUEUE_JSON";

  try{
    var start = Date.now();
    var maxMs = 20000; // 20秒以内で切り上げ
    var maxJobs = 10;  // 1回で最大10件

    for (var n=0; n<maxJobs; n++){
      if (Date.now() - start > maxMs) break;

      var arr = [];
      try{
        var cur = props.getProperty(key);
        arr = cur ? JSON.parse(cur) : [];
      } catch(e){
        arr = [];
      }

      if (!arr.length) break;

      var job = arr.shift();
      props.setProperty(key, JSON.stringify(arr));

      // 送信（失敗したらキュー末尾に戻してリトライ）
      try{
        reimburseNotifyPmOnSubmitted({
          reimbursementId: String(job.reimbursementId || "").trim(),
          projectId: String(job.projectId || "").trim(),
          date: String(job.date || "").trim(),
          category: String(job.category || "").trim(),
          amount: Number(job.amount || 0),
          desc: String(job.desc || "").trim()
        });
      } catch(err){
        // リトライ回数制限（無限ループ防止）
        var retry = Number(job.retry || 0) + 1;
        if (retry <= 5){
          job.retry = retry;

          // 末尾に戻す
          try{
            var arr2 = [];
            var cur2 = props.getProperty(key);
            arr2 = cur2 ? JSON.parse(cur2) : [];
            arr2.push(job);
            if (arr2.length > 50) arr2 = arr2.slice(arr2.length - 50);
            props.setProperty(key, JSON.stringify(arr2));
          } catch(_e){}
        }
        // 失敗しても次へ（他のジョブは流す）
      }
    }

  } finally {
    try{ lock.releaseLock(); } catch(_e){}
  }
}

function admin_reimburseRunNotifyWorkerOnce(){
  // 手動デバッグ用：1件だけ流す
  reimburseNotifyPmWorker();
  return { ok:true, message:"worker executed once" };
}

function admin_reimbursePeekNotifyQueue(){
  const props = PropertiesService.getScriptProperties();
  const key = "REIMBURSE_NOTIFY_QUEUE_JSON";

  let arr = [];
  try{
    const cur = props.getProperty(key);
    arr = cur ? JSON.parse(cur) : [];
  } catch(e){
    arr = [];
  }

  return {
    ok:true,
    key:key,
    length: arr.length,
    head: arr.length ? arr[0] : null,
    tail: arr.length ? arr[arr.length-1] : null
  };
}

function reimburseNotifyAdminOnPmApproved(info){
  info = info || {};
  var reimbursementId = String(info.reimbursementId || "").trim();
  var projectId = String(info.projectId || "").trim();
  if (!reimbursementId || !projectId) {
    return { ok:false, sentCount:0, reason:"missing id" };
  }

  // DBから該当行を引いて内容を作る（最低限）
  var sh = reimburse_getOrCreateSheet("DB_Reimbursements", reimburse_getHeaders());
  var vals = sh.getDataRange().getValues();
  if (!vals || vals.length < 2) {
    return { ok:false, sentCount:0, reason:"no data" };
  }

  var h = vals[0].map(function(x){ return String(x||"").trim(); });
  var idx = function(name){ return h.indexOf(name); };

  var iId = idx("reimbursementId");
  var iDate = idx("date");
  var iCategory = idx("category");
  var iAmount = idx("amount");
  var iDesc = idx("desc");
  var iPmBy = idx("pmApprovedBy");
  var iPmAt = idx("pmApprovedAt");

  var row = null;
  for (var r=1; r<vals.length; r++){
    if (String(vals[r][iId]||"").trim() === reimbursementId){
      row = vals[r];
      break;
    }
  }
  if (!row){
    return { ok:false, sentCount:0, reason:"row not found" };
  }

  var date = (iDate>=0) ? String(row[iDate]||"").trim() : "";
  var category = (iCategory>=0) ? String(row[iCategory]||"").trim() : "";
  var amount = (iAmount>=0) ? Number(row[iAmount]||0) : 0;
  var desc = (iDesc>=0) ? String(row[iDesc]||"").trim() : "";
  var pmBy = (iPmBy>=0) ? String(row[iPmBy]||"").trim() : "";
  var pmAt = (iPmAt>=0) ? String(row[iPmAt]||"").trim() : "";

  var pj = reimburse_tryGetProjectName(projectId);
  var pjName = String((pj && pj.projectName) ? pj.projectName : "").trim() || projectId;

  // admin宛先
  var admins = reimburseGetAdminTargets_();
  if (!admins || admins.length === 0){
    return { ok:true, sentCount:0, reason:"no admin targets" };
  }

  var baseUrl = ScriptApp.getService().getUrl();
  var linkReimburse = baseUrl + "?page=reimburse&projectId=" + encodeURIComponent(projectId);
  var linkBilling = baseUrl + "?page=billing&projectId=" + encodeURIComponent(projectId);

  var title = "【立替 admin承認依頼】";
  var lines =
    "PJ: " + pjName + "（" + projectId + "）\n" +
    "PM承認: " + (pmBy || "-") + (pmAt ? " / " + pmAt : "") + "\n" +
    "日付: " + date + "\n" +
    "カテゴリ: " + reimburse_categoryLabel(category) + "\n" +
    "金額: " + amount + "円\n" +
    "内容: " + (desc || "-") + "\n" +
    "ID: " + reimbursementId;

  var blocks = [
    { type: "section", text: { type: "mrkdwn", text: "*" + title + "*\n" + lines } },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "承認する ✅" },
          style: "primary",
          action_id: "reimb_admin_approve",
          value: JSON.stringify({ reimbursementId: reimbursementId })
        },
        {
          type: "button",
          text: { type: "plain_text", text: "却下 ❌" },
          style: "danger",
          action_id: "reimb_admin_reject",
          value: JSON.stringify({ reimbursementId: reimbursementId })
        }
      ]
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "▼確認（Reimburse）\n" + linkReimburse + "\n" +
          "▼参照（Billing）\n" + linkBilling
      }
    }
  ];

  var subject = "【AMD OS】立替 admin承認依頼：" + pjName + " / " + amount + "円";
  var body =
    "adminへ\n\n" +
    "PM承認済みの立替について、admin承認をお願い〜\n\n" +
    "【PJ】" + pjName + "（" + projectId + "）\n" +
    "【PM承認】" + (pmBy || "-") + (pmAt ? " / " + pmAt : "") + "\n" +
    "【日付】" + date + "\n" +
    "【カテゴリ】" + reimburse_categoryLabel(category) + "\n" +
    "【金額】" + amount + "円\n" +
    "【内容】" + (desc || "-") + "\n" +
    "【ID】" + reimbursementId + "\n\n" +
    "▼確認（Reimburse）\n" + linkReimburse + "\n" +
    "▼参照（Billing）\n" + linkBilling + "\n";

  var sentCount = 0;

  admins.forEach(function(t){
    var notify = String(t.notifyChannel || "gmail").toLowerCase().trim();
    var slackId = String(t.slackId || "").trim();
    var email = String(t.email || "").toLowerCase().trim();

    if (notify === "slack" && slackId){
      try{
        slack_postDmBlocks(slackId, title, blocks);
        sentCount++;
        return;
      } catch(e){
        // fallthrough
      }
    }

    if (email){
      try{
        GmailApp.sendEmail(email, subject, body);
        sentCount++;
      } catch(e2){}
    }
  });

  return { ok:true, sentCount: sentCount };
}

function reimburseGetAdminTargets_(){
  var props = PropertiesService.getScriptProperties();
  var direct = String(props.getProperty("REIMBURSE_ADMIN_APPROVERS") || "").trim();

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName("DB_Members");
  if (!sh) return [];

  var vals = sh.getDataRange().getValues();
  if (!vals || vals.length < 2) return [];

  var h = vals[0].map(function(x){ return String(x||"").trim(); });
  var iEmail = h.indexOf("email");
  var iSlackId = h.indexOf("slackId");
  var iNotify = h.indexOf("notifyChannel");
  var iIsAdmin = h.indexOf("isAdmin");

  var want = {};

  // ScriptProperties優先（メールで指定）
  if (direct){
    direct.split(",").forEach(function(x){
      var em = String(x||"").toLowerCase().trim();
      if (em) want[em] = true;
    });
  }

  // isAdmin列があるなら拾う（directが空でも動く）
  for (var r=1; r<vals.length; r++){
    var em2 = (iEmail>=0) ? String(vals[r][iEmail]||"").toLowerCase().trim() : "";
    if (!em2) continue;

    var adminOk = false;
    if (iIsAdmin >= 0){
      var v = String(vals[r][iIsAdmin]||"").toLowerCase().trim();
      adminOk = (v === "true" || v === "1" || v === "yes");
    }

    if (direct){
      if (want[em2]) {
        // keep
      } else {
        continue;
      }
    } else {
      if (!adminOk) continue;
    }

    want[em2] = true;
  }

  var out = [];
  for (var r2=1; r2<vals.length; r2++){
    var em3 = (iEmail>=0) ? String(vals[r2][iEmail]||"").toLowerCase().trim() : "";
    if (!em3 || !want[em3]) continue;

    out.push({
      email: em3,
      slackId: (iSlackId>=0) ? String(vals[r2][iSlackId]||"").trim() : "",
      notifyChannel: (iNotify>=0) ? String(vals[r2][iNotify]||"").toLowerCase().trim() : "gmail"
    });
  }

  return out;
}

function reimburse_appendNotifyLog(payload){
  payload = payload || {};
  var sh = reimburse_getOrCreateSheet("DB_ReimburseNotifyLog", [
    "atJst","kind","reimbursementId","projectId","message","detail"
  ]);

  var atJst = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd HH:mm:ss");
  sh.appendRow([
    atJst,
    String(payload.kind || ""),
    String(payload.reimbursementId || ""),
    String(payload.projectId || ""),
    String(payload.message || ""),
    String(payload.detail || "")
  ]);
}
