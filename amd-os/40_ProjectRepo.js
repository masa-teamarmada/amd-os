/** 40_ProjectRepo.gs
 * DB_Projects（PJマスタ）周りのRepo担当。
 * clientName/ステータス/請求送付先/請求ルールなど、PJマスタ情報の読み書きをまとめる。
 */
function getClientNameByProjectId_(projectId){
  projectId = String(projectId || "").trim();
  if (!projectId) return "";

  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("DB_Projects");
  if (!sh) return "";

  const values = sh.getDataRange().getValues();
  if (!values || values.length < 2) return "";

  const headers = values[0].map(h => String(h || "").trim());
  const idxId = headers.indexOf("projectId");
  const idxClient = headers.indexOf("clientName");
  if (idxId < 0 || idxClient < 0) return "";

  for (let r = 1; r < values.length; r++) {
    if (String(values[r][idxId] || "").trim() === projectId) {
      return String(values[r][idxClient] || "").trim();
    }
  }
  return "";
}
function updateProjectClient(payload) {
  payload = payload || {};
  const projectId = String(payload.projectId || "").trim();
  const clientName = String(payload.clientName || "").trim();
  const createFreeeIfMissing = (payload.createFreeeIfMissing === undefined) ? true : !!payload.createFreeeIfMissing;

  if (!projectId) return { ok:false, message:"projectId empty" };
  if (!isAdmin_()) return { ok:false, message:"admin only" };

  const sh = getSheet_("DB_Projects");
  const header = ensureHeader_(sh, [
    "projectId","projectName","clientName","status","notes","createdAt","updatedAt",
    "freeePartnerId","freeePartnerName","clientLocked"
  ]);

  const idxProjectId = header.indexOf("projectId");
  const idxClientName = header.indexOf("clientName");
  const idxUpdatedAt = header.indexOf("updatedAt");
  const idxFreeePartnerId = header.indexOf("freeePartnerId");
  const idxFreeePartnerName = header.indexOf("freeePartnerName");
  const idxClientLocked = header.indexOf("clientLocked");

  if (idxProjectId < 0 || idxClientName < 0) return { ok:false, message:"header missing" };

  const lastRow = sh.getLastRow();
  if (lastRow < 2) return { ok:false, message:"no projects" };

  const values = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();

  let hitRow = -1;
  for (let i=0; i<values.length; i++){
    const pid = String(values[i][idxProjectId] || "").trim();
    if (pid === projectId) { hitRow = i + 2; break; }
  }
  if (hitRow < 0) return { ok:false, message:"project not found" };

  // 既存freee紐づけ（維持が基本）
  let partnerId = (idxFreeePartnerId >= 0) ? String(sh.getRange(hitRow, idxFreeePartnerId+1).getValue() || "").trim() : "";
  let partnerName = (idxFreeePartnerName >= 0) ? String(sh.getRange(hitRow, idxFreeePartnerName+1).getValue() || "").trim() : "";

  // ★ここが変更点：
  // createFreeeIfMissing=true のときだけ、自動でfreee紐づけを更新する
  if (clientName && createFreeeIfMissing) {
    const ensured = b_freeeEnsurePartnerByName_(clientName);
    partnerId = String(ensured.partnerId || "").trim();
    partnerName = String(ensured.partnerName || clientName).trim();
  }

  sh.getRange(hitRow, idxClientName + 1).setValue(clientName);

  const now = new Date();
  if (idxUpdatedAt >= 0) sh.getRange(hitRow, idxUpdatedAt + 1).setValue(now);

  if (idxFreeePartnerId >= 0) sh.getRange(hitRow, idxFreeePartnerId + 1).setValue(partnerId);
  if (idxFreeePartnerName >= 0) sh.getRange(hitRow, idxFreeePartnerName + 1).setValue(partnerName);

  // clientLocked の意味は現状「clientName入ってるならtrue」なので維持（既存挙動を壊さない）
  if (idxClientLocked >= 0) sh.getRange(hitRow, idxClientLocked + 1).setValue(clientName ? true : false);

  return {
    ok:true,
    projectId,
    clientName,
    freeePartnerId: partnerId,
    freeePartnerName: partnerName,
    updatedAt: now.toISOString()
  };
}

function getProjectInvoiceRecipients_(projectId){
  projectId = String(projectId || "").trim();
  if (!projectId) {
    return {
      invoiceToName:"", invoiceToEmails:"", invoiceCcEmails:"", invoiceBccEmails:"",
      invoiceSendDeadlineRule:"", paymentDueRule:""
    };
  }

  const sh = getSheet_("DB_Projects");
  const header = ensureHeader_(sh, [
    "projectId","projectName","clientName","status","notes","createdAt","updatedAt",
    "freeePartnerId","freeePartnerName","clientLocked",
    "invoiceToName","invoiceToEmails","invoiceCcEmails","invoiceBccEmails",
    // ★ここが抜けてた
    "invoiceSendDeadlineRule","paymentDueRule"
  ]);

  const values = sh.getDataRange().getValues();
  if (!values || values.length < 2) {
    return {
      invoiceToName:"", invoiceToEmails:"", invoiceCcEmails:"", invoiceBccEmails:"",
      invoiceSendDeadlineRule:"", paymentDueRule:""
    };
  }

  const h = values[0].map(x => String(x||"").trim());
  const iPid = h.indexOf("projectId");
  const iToName = h.indexOf("invoiceToName");
  const iTo = h.indexOf("invoiceToEmails");
  const iCc = h.indexOf("invoiceCcEmails");
  const iBcc = h.indexOf("invoiceBccEmails");

  // ★追加：運用ルール2項目
  const iSendDeadline = h.indexOf("invoiceSendDeadlineRule");
  const iPayDue = h.indexOf("paymentDueRule");

  for (let r=1; r<values.length; r++){
    if (String(values[r][iPid]||"").trim() !== projectId) continue;

    return {
      invoiceToName: (iToName>=0) ? String(values[r][iToName]||"") : "",
      invoiceToEmails: (iTo>=0) ? String(values[r][iTo]||"") : "",
      invoiceCcEmails: (iCc>=0) ? String(values[r][iCc]||"") : "",
      invoiceBccEmails: (iBcc>=0) ? String(values[r][iBcc]||"") : "",

      // ★ここが本命
      invoiceSendDeadlineRule: (iSendDeadline>=0) ? String(values[r][iSendDeadline]||"") : "",
      paymentDueRule: (iPayDue>=0) ? String(values[r][iPayDue]||"") : ""
    };
  }

  return {
    invoiceToName:"", invoiceToEmails:"", invoiceCcEmails:"", invoiceBccEmails:"",
    invoiceSendDeadlineRule:"", paymentDueRule:""
  };
}
function getProjectStatusByProjectId_(projectId){
  projectId = String(projectId || "").trim();
  if (!projectId) return "draft";

  const sh = getSheet_("DB_Projects");
  const header = ensureHeader_(sh, [
    "projectId","projectName","clientName","status","notes","createdAt","updatedAt"
  ]);

  const vals = sh.getDataRange().getValues();
  if (!vals || vals.length < 2) return "draft";

  const h = vals[0].map(x => String(x||"").trim());
  const iPid = h.indexOf("projectId");
  const iStatus = h.indexOf("status");
  if (iPid < 0 || iStatus < 0) return "draft";

  for (let r=1; r<vals.length; r++){
    if (String(vals[r][iPid]||"").trim() !== projectId) continue;
    const s = String(vals[r][iStatus]||"").trim();
    return s || "draft";
  }
  return "draft";
}
function updateProjectStatusByProjectId_(projectId, nextStatus){
  projectId = String(projectId || "").trim();
  nextStatus = String(nextStatus || "").trim().toLowerCase();
  if (!projectId) return { ok:false, message:"projectId empty" };
  if (!nextStatus) return { ok:false, message:"status empty" };

  // ★許可する値だけ（事故防止）
  const allow = new Set(["active","sales","ended","frozen","lost","draft"]);
  if (!allow.has(nextStatus)) return { ok:false, message:"invalid status: " + nextStatus };

  const sh = getSheet_("DB_Projects");
  const header = ensureHeader_(sh, [
    "projectId","projectName","clientName","status","notes","createdAt","updatedAt"
  ]);

  const h = header.map(x => String(x||"").trim());
  const iPid = h.indexOf("projectId");
  const iStatus = h.indexOf("status");
  const iUpdatedAt = h.indexOf("updatedAt");
  if (iPid < 0 || iStatus < 0) return { ok:false, message:"header missing" };

  const lastRow = sh.getLastRow();
  if (lastRow < 2) return { ok:false, message:"no projects" };

  const rows = sh.getRange(2,1,lastRow-1,sh.getLastColumn()).getValues();
  let hitRow = -1;
  for (let i=0; i<rows.length; i++){
    if (String(rows[i][iPid]||"").trim() === projectId){ hitRow = i+2; break; }
  }
  if (hitRow < 0) return { ok:false, message:"project not found" };

  sh.getRange(hitRow, iStatus+1).setValue(nextStatus);
  if (iUpdatedAt >= 0) sh.getRange(hitRow, iUpdatedAt+1).setValue(new Date());

  return { ok:true, projectId, status: nextStatus };
}
function updateProjectInvoiceRecipients_(payload){
  payload = payload || {};
  const projectId = String(payload.projectId || "").trim();
  if (!projectId) return { ok:false, message:"projectId empty" };
  if (!isAdmin_()) return { ok:false, message:"admin only" };

  const sh = getSheet_("DB_Projects");

  // ★DB_Projects に列を確実に生やす（無ければ末尾追加）
  const header = ensureHeader_(sh, [
    "projectId","projectName","clientName","status","notes","createdAt","updatedAt",
    "freeePartnerId","freeePartnerName","clientLocked",
    "invoiceToName","invoiceToEmails","invoiceCcEmails","invoiceBccEmails",
    // ★追加2列
    "invoiceSendDeadlineRule","paymentDueRule"
  ]);

  const h = header.map(x => String(x||"").trim());
  const iPid = h.indexOf("projectId");
  const iUpdatedAt = h.indexOf("updatedAt");

  const iToName = h.indexOf("invoiceToName");
  const iTo = h.indexOf("invoiceToEmails");
  const iCc = h.indexOf("invoiceCcEmails");
  const iBcc = h.indexOf("invoiceBccEmails");

  // ★追加：運用ルール2項目
  const iSendDeadline = h.indexOf("invoiceSendDeadlineRule");
  const iPayDue = h.indexOf("paymentDueRule");

  const lastRow = sh.getLastRow();
  if (lastRow < 2) return { ok:false, message:"no projects" };

  const values = sh.getRange(2,1,lastRow-1,sh.getLastColumn()).getValues();
  let hitRow = -1;
  for (let i=0; i<values.length; i++){
    if (String(values[i][iPid]||"").trim() === projectId) { hitRow = i+2; break; }
  }
  if (hitRow < 0) return { ok:false, message:"project not found" };

  // ===== 既存：送付先 =====
  if (iToName >= 0) sh.getRange(hitRow, iToName+1).setValue(String(payload.invoiceToName || ""));
  if (iTo >= 0) sh.getRange(hitRow, iTo+1).setValue(String(payload.invoiceToEmails || ""));
  if (iCc >= 0) sh.getRange(hitRow, iCc+1).setValue(String(payload.invoiceCcEmails || ""));
  if (iBcc >= 0) sh.getRange(hitRow, iBcc+1).setValue(String(payload.invoiceBccEmails || ""));

  // ===== 追加：運用ルール =====
  if (iSendDeadline >= 0) sh.getRange(hitRow, iSendDeadline+1).setValue(String(payload.invoiceSendDeadlineRule || ""));
  if (iPayDue >= 0) sh.getRange(hitRow, iPayDue+1).setValue(String(payload.paymentDueRule || ""));

  if (iUpdatedAt >= 0) sh.getRange(hitRow, iUpdatedAt+1).setValue(new Date());

  return { ok:true };
}