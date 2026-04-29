/**
 * 042_ProjectConfig_Api.gs
 * PJ設定画面（Project Config）用APIエントリポイント。
 * 基本情報・メンバー・契約条件・請求書送付先の読み書きを担当。
 *
 * 依存:
 * - DB_Projects
 * - DB_ProjectMembers
 * - DB_Members
 */

// ===== READ =====

/**
 * Project Config 画面初期データを一括取得
 * @param {Object} payload { projectId: string }
 * @return {Object}
 */
function projectConfig_api_getData(payload) {
  payload = payload || {};
  var projectId = String(payload.projectId || "").trim();
  if (!projectId) return { ok: false, message: "projectId required" };

  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // --- 1) DB_Projects から PJ情報 ---
  var project = pjConf_readProject_(ss, projectId);
  if (!project) return { ok: false, message: "PJが見つからない: " + projectId };

  // PM / Closer の名前解決
  var memberMaster = pjConf_readActiveMemberMaster_(ss);
  var allMemberMap = pjConf_readAllMemberMap_(ss);
  project._pmName = allMemberMap[project.pmMemberId] || project.pmMemberId || "";
  project._closerName = allMemberMap[project.closerMemberId] || project.closerMemberId || "";

  // --- 2) DB_ProjectMembers ---
  var members = pjConf_readProjectMembers_(ss, projectId, allMemberMap);

  return {
    ok: true,
    project: project,
    members: members,
    memberMaster: memberMaster  // ドロップダウン候補（activeのみ）
  };
}

// ===== WRITE: Project 基本情報・契約・請求書送付先 =====

/**
 * DB_Projects の編集可能フィールドを保存
 * @param {Object} payload { projectId, fields: { key: value, ... } }
 * @return {Object}
 */
function projectConfig_api_saveProject(payload) {
  payload = payload || {};
  var projectId = String(payload.projectId || "").trim();
  var fields = payload.fields || {};
  if (!projectId) return { ok: false, message: "projectId required" };

  // 編集許可フィールド（ホワイトリスト）
  var EDITABLE = [
    "projectStatus",
    "reportEmails",
    "contractStartDate",
    "contractEndDate",
    "startYm",
    "endYm",
    "feeType",
    "feeAmount",
    "invoiceSendDeadlineRule",
    "paymentDueRule",
    "invoiceSendManual",
    "invoiceToEmails",
    "invoiceCcEmails",
    "invoiceBccEmails"
  ];

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName("DB_Projects");
  if (!sh) return { ok: false, message: "DB_Projects not found" };

  var header = pjConf_headerMap_(sh);
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return { ok: false, message: "no data" };

  var values = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
  var pidIdx = header.projectId;
  if (!pidIdx) return { ok: false, message: "projectId column not found" };

  var targetRow = -1;
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][pidIdx - 1] || "").trim() === projectId) {
      targetRow = i + 2; // 1-indexed + header
      break;
    }
  }
  if (targetRow === -1) return { ok: false, message: "PJ not found" };

  // ヘッダにない新カラムは ensureHeader_ で追加
  var updated = 0;
  for (var key in fields) {
    if (EDITABLE.indexOf(key) === -1) continue;

    var colIdx = header[key];
    if (!colIdx) {
      // 新カラム追加（feeType, feeAmount等）
      var lastCol = sh.getLastColumn();
      sh.getRange(1, lastCol + 1).setValue(key);
      colIdx = lastCol + 1;
      header[key] = colIdx;
    }

    var val = fields[key];
    // yyyymm バリデーション
    if ((key === "startYm" || key === "endYm") && val) {
      val = String(val).trim();
      if (!/^\d{6}$/.test(val)) continue;
      var mm = parseInt(val.substring(4, 6), 10);
      if (mm < 1 || mm > 12) continue;
    }
    sh.getRange(targetRow, colIdx).setValue(val);
    updated++;
  }

  // updatedAt
  if (header.updatedAt) {
    var now = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd'T'HH:mm:ss") + "+09:00";
    sh.getRange(targetRow, header.updatedAt).setValue(now);
  }

  return { ok: true, updated: updated };
}

// ===== WRITE: Members =====

/**
 * DB_ProjectMembers を全件差し替え保存
 * @param {Object} payload { projectId, members: [{ memberId, roleLabel, isPM, joinYm, leaveYm, isActive, ... }] }
 * @return {Object}
 */
function projectConfig_api_saveMembers(payload) {
  payload = payload || {};
  var projectId = String(payload.projectId || "").trim();
  var inputMembers = payload.members || [];
  if (!projectId) return { ok: false, message: "projectId required" };

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName("DB_ProjectMembers");
  if (!sh) return { ok: false, message: "DB_ProjectMembers not found" };

  var allData = sh.getDataRange().getValues();
  var headers = allData[0];
  var idx = {};
  for (var c = 0; c < headers.length; c++) {
    var h = String(headers[c] || "").trim();
    if (h) idx[h] = c;
  }

  if (idx.projectId === undefined || idx.memberId === undefined) {
    return { ok: false, message: "projectId/memberId column not found" };
  }

  var now = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd'T'HH:mm:ss") + "+09:00";

  // メンバー名マスタ（projectName, memberName, codeName自動解決用）
  var memberMap = pjConf_readAllMemberMap_(ss);
  var memberFullMap = pjConf_readAllMemberFullMap_(ss);

  // PJ名
  var pjName = "";
  var pjSh = ss.getSheetByName("DB_Projects");
  if (pjSh) {
    var pjHeader = pjConf_headerMap_(pjSh);
    var pjData = pjSh.getRange(2, 1, pjSh.getLastRow() - 1, pjSh.getLastColumn()).getValues();
    for (var i = 0; i < pjData.length; i++) {
      if (String(pjData[i][(pjHeader.projectId || 1) - 1] || "").trim() === projectId) {
        pjName = String(pjData[i][(pjHeader.projectName || 1) - 1] || "").trim();
        break;
      }
    }
  }

  // 既存の該当PJ行番号を収集（削除用）
  var existingRowNums = []; // 0-indexed in allData
  for (var r = 1; r < allData.length; r++) {
    if (String(allData[r][idx.projectId] || "").trim() === projectId) {
      existingRowNums.push(r + 1); // 1-indexed sheet row
    }
  }

  // 既存行を逆順で削除
  existingRowNums.sort(function(a, b) { return b - a; });
  for (var d = 0; d < existingRowNums.length; d++) {
    sh.deleteRow(existingRowNums[d]);
  }

  // 新規行を追加
  var saved = 0;
  for (var i = 0; i < inputMembers.length; i++) {
    var m = inputMembers[i];
    var memberId = String(m.memberId || "").trim();
    if (!memberId) continue;

    var fullInfo = memberFullMap[memberId] || {};

    var newRow = [];
    for (var c = 0; c < headers.length; c++) {
      var col = String(headers[c] || "").trim();
      switch (col) {
        case "projectId":     newRow.push(projectId); break;
        case "projectName":   newRow.push(pjName); break;
        case "memberId":      newRow.push(memberId); break;
        case "memberName":    newRow.push(fullInfo.memberName || memberId); break;
        case "codeName":      newRow.push(fullInfo.codeName || ""); break;
        case "isActive":      newRow.push(m.isActive !== false && m.isActive !== "FALSE" ? "TRUE" : "FALSE"); break;
        case "joinYm":        newRow.push(String(m.joinYm || "").trim()); break;
        case "leaveYm":       newRow.push(String(m.leaveYm || "").trim()); break;
        case "payoutEligible": newRow.push(m.payoutEligible || "TRUE"); break;
        case "defaultPayoutYen": newRow.push(m.defaultPayoutYen || ""); break;
        case "displayOrder":  newRow.push(i + 1); break;
        case "roleLabel":     newRow.push(String(m.roleLabel || "").trim()); break;
        case "notes":         newRow.push(String(m.notes || "").trim()); break;
        case "createdAt":     newRow.push(now); break;
        case "updatedAt":     newRow.push(now); break;
        case "isCloser":      newRow.push(m.isCloser === true || m.isCloser === "TRUE" ? "TRUE" : "FALSE"); break;
        case "isPM":          newRow.push(m.isPM === true || m.isPM === "TRUE" ? "TRUE" : "FALSE"); break;
        default:              newRow.push(""); break;
      }
    }
    sh.appendRow(newRow);
    saved++;
  }

  return { ok: true, saved: saved };
}

// ===== 内部関数 =====

function pjConf_readProject_(ss, projectId) {
  var sh = ss.getSheetByName("DB_Projects");
  if (!sh) return null;
  var header = pjConf_headerMap_(sh);
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return null;
  var values = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
  var pidIdx = header.projectId;
  if (!pidIdx) return null;

  for (var i = 0; i < values.length; i++) {
    if (String(values[i][pidIdx - 1] || "").trim() === projectId) {
      var obj = {};
      Object.keys(header).forEach(function(k) {
        var raw = values[i][header[k] - 1];
        // Date → JST文字列、null/undefined → ""
        if (raw instanceof Date) {
          raw = Utilities.formatDate(raw, "Asia/Tokyo", "yyyy-MM-dd'T'HH:mm:ss");
        } else if (raw === null || raw === undefined) {
          raw = "";
        }
        obj[k] = raw;
      });
      return obj;
    }
  }
  return null;
}

/** activeなメンバーマスタ（ドロップダウン用）: [{ memberId, memberName, codeName }] */
function pjConf_readActiveMemberMaster_(ss) {
  var sh = ss.getSheetByName("DB_Members");
  if (!sh) return [];
  var data = sh.getDataRange().getValues();
  if (data.length < 2) return [];
  var headers = data[0];
  var midIdx = headers.indexOf("memberId");
  var mnIdx = headers.indexOf("memberName");
  var cnIdx = headers.indexOf("codeName");
  var actIdx = headers.indexOf("isActive");
  if (midIdx === -1) return [];

  var result = [];
  for (var i = 1; i < data.length; i++) {
    var isActive = actIdx !== -1 ? data[i][actIdx] : true;
    if (isActive === false || isActive === "FALSE" || isActive === "false") continue;
    var mid = String(data[i][midIdx] || "").trim();
    if (!mid) continue;
    result.push({
      memberId: mid,
      memberName: mnIdx !== -1 ? String(data[i][mnIdx] || "") : mid,
      codeName: cnIdx !== -1 ? String(data[i][cnIdx] || "") : ""
    });
  }
  return result;
}

/** 全メンバー memberId → memberName マップ */
function pjConf_readAllMemberMap_(ss) {
  var sh = ss.getSheetByName("DB_Members");
  if (!sh) return {};
  var data = sh.getDataRange().getValues();
  if (data.length < 2) return {};
  var headers = data[0];
  var midIdx = headers.indexOf("memberId");
  var mnIdx = headers.indexOf("memberName");
  if (midIdx === -1) return {};

  var map = {};
  for (var i = 1; i < data.length; i++) {
    var mid = String(data[i][midIdx] || "").trim();
    if (mid) map[mid] = mnIdx !== -1 ? String(data[i][mnIdx] || "") : mid;
  }
  return map;
}

/** 全メンバー memberId → { memberName, codeName } マップ */
function pjConf_readAllMemberFullMap_(ss) {
  var sh = ss.getSheetByName("DB_Members");
  if (!sh) return {};
  var data = sh.getDataRange().getValues();
  if (data.length < 2) return {};
  var headers = data[0];
  var midIdx = headers.indexOf("memberId");
  var mnIdx = headers.indexOf("memberName");
  var cnIdx = headers.indexOf("codeName");
  if (midIdx === -1) return {};

  var map = {};
  for (var i = 1; i < data.length; i++) {
    var mid = String(data[i][midIdx] || "").trim();
    if (!mid) continue;
    map[mid] = {
      memberName: mnIdx !== -1 ? String(data[i][mnIdx] || "") : mid,
      codeName: cnIdx !== -1 ? String(data[i][cnIdx] || "") : ""
    };
  }
  return map;
}

/** DB_ProjectMembers から該当PJのメンバー一覧 */
function pjConf_readProjectMembers_(ss, projectId, memberNameMap) {
  var sh = ss.getSheetByName("DB_ProjectMembers");
  if (!sh) return [];
  var data = sh.getDataRange().getValues();
  if (data.length < 2) return [];
  var headers = data[0];

  var idx = {};
  for (var c = 0; c < headers.length; c++) {
    var h = String(headers[c] || "").trim();
    if (h) idx[h] = c;
  }
  if (idx.projectId === undefined) return [];

  var result = [];
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idx.projectId] || "").trim() !== projectId) continue;

    var memberId = String(data[i][idx.memberId] || "").trim();
    result.push({
      memberId: memberId,
      memberName: memberNameMap[memberId] || memberId,
      roleLabel: idx.roleLabel !== undefined ? String(data[i][idx.roleLabel] || "") : "",
      isPM: idx.isPM !== undefined ? (data[i][idx.isPM] === true || data[i][idx.isPM] === "TRUE") : false,
      isCloser: idx.isCloser !== undefined ? (data[i][idx.isCloser] === true || data[i][idx.isCloser] === "TRUE") : false,
      joinYm: idx.joinYm !== undefined ? String(data[i][idx.joinYm] || "") : "",
      leaveYm: idx.leaveYm !== undefined ? String(data[i][idx.leaveYm] || "") : "",
      isActive: idx.isActive !== undefined ? (data[i][idx.isActive] !== false && data[i][idx.isActive] !== "FALSE") : true,
      payoutEligible: idx.payoutEligible !== undefined ? String(data[i][idx.payoutEligible] || "") : "",
      defaultPayoutYen: idx.defaultPayoutYen !== undefined ? data[i][idx.defaultPayoutYen] : "",
      displayOrder: idx.displayOrder !== undefined ? Number(data[i][idx.displayOrder] || 0) : 0,
      notes: idx.notes !== undefined ? String(data[i][idx.notes] || "") : ""
    });
  }

  result.sort(function(a, b) { return a.displayOrder - b.displayOrder; });
  return result;
}

function pjConf_headerMap_(sh) {
  var row1 = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var map = {};
  for (var c = 0; c < row1.length; c++) {
    var key = String(row1[c] || "").trim();
    if (key) map[key] = c + 1;
  }
  return map;
}

// ===== Deductions API =====

/**
 * 指定PJの控除枠一覧を取得
 * @param {Object} payload { projectId }
 * @return {Object} { ok, deductions: [...] }
 */
function projectConfig_api_getDeductions(payload) {
  var pid = String((payload || {}).projectId || "").trim();
  if (!pid) return { ok: false, message: "projectId required" };
  var all = pjDed_readAllForProject_(pid);
  // メンバーコードネーム解決
  var ss = SpreadsheetApp.getActiveSpreadsheet() || b_ss_();
  var codeNameMap = {};
  var fullMap = pjConf_readAllMemberFullMap_(ss);
  var fkeys = Object.keys(fullMap);
  for (var f = 0; f < fkeys.length; f++) {
    codeNameMap[fkeys[f]] = fullMap[fkeys[f]].codeName || fullMap[fkeys[f]].memberName || fkeys[f];
  }
  for (var i = 0; i < all.length; i++) {
    all[i]._targetMemberName = codeNameMap[all[i].targetMemberId] || all[i].targetMemberId || "";
  }

  // planCycle情報（ptUnit正確計算用）
  var planInfo = { totalPt: 0, periodStartYm: "", periodEndYm: "" };
  try {
    var cycleSheet = valuePlan_repo_getCycleSheet();
    var cycleAll = cycleSheet.getDataRange().getValues();
    var cycleHeader = cycleAll[0] || [];
    for (var r = 1; r < cycleAll.length; r++) {
      var row = {};
      for (var c = 0; c < cycleHeader.length; c++) {
        row[String(cycleHeader[c])] = cycleAll[r][c];
      }
      if (String(row.projectId || "").trim() === pid && String(row.status || "") === "fixed") {
        planInfo.totalPt = Number(row.totalPoints || 0);
        planInfo.periodStartYm = String(row.periodStartYm || "").trim();
        planInfo.periodEndYm = String(row.periodEndYm || "").trim();
        break;
      }
    }
  } catch (e) {
    // planCycle未作成でもフォールバック
  }

  return JSON.parse(JSON.stringify({ ok: true, deductions: all, planInfo: planInfo }));
}

/**
 * 控除枠を追加
 * @param {Object} payload { projectId, type, label, mode, ratePercent, fixedAmount, targetMemberId, durationMonths, startYm, note }
 * @return {Object}
 */
function projectConfig_api_addDeduction(payload) {
  payload = payload || {};
  var pid = String(payload.projectId || "").trim();
  if (!pid) return { ok: false, message: "projectId required" };
  if (!payload.mode) return { ok: false, message: "mode required (rate/fixed)" };
  if (!payload.startYm) return { ok: false, message: "startYm required" };
  if (payload.mode === "rate" && !payload.ratePercent) return { ok: false, message: "ratePercent required for rate mode" };
  if (payload.mode === "fixed" && !payload.fixedAmount) return { ok: false, message: "fixedAmount required for fixed mode" };
  return pjDed_insert_(payload);
}

/**
 * 控除枠をexpired/cancelledにする
 * @param {Object} payload { deductionId, endYm? }
 */
function projectConfig_api_expireDeduction(payload) {
  payload = payload || {};
  var did = String(payload.deductionId || "").trim();
  if (!did) return { ok: false, message: "deductionId required" };
  var fields = { status: "expired" };
  if (payload.endYm) fields.endYm = String(payload.endYm).trim();
  return pjDed_update_(did, fields);
}

/**
 * rate型控除の変更（旧行expired + 新行追加で履歴保持）
 * @param {Object} payload { oldDeductionId, projectId, type, label, mode:"rate", ratePercent, startYm, note }
 */
function projectConfig_api_replaceRateDeduction(payload) {
  payload = payload || {};
  if (!payload.oldDeductionId) return { ok: false, message: "oldDeductionId required" };
  if (!payload.startYm) return { ok: false, message: "startYm required" };
  return pjDed_replaceRate_(payload.oldDeductionId, payload);
}

/**
 * 控除枠を削除（cancelled）
 * @param {Object} payload { deductionId }
 */
function projectConfig_api_cancelDeduction(payload) {
  payload = payload || {};
  var did = String(payload.deductionId || "").trim();
  if (!did) return { ok: false, message: "deductionId required" };
  return pjDed_update_(did, { status: "cancelled" });
}