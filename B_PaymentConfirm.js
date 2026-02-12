//入金確認（末日トリガー、リンク、トークン、完了処理）。
/**
 * B_PaymentConfirm.gs
 *
 * 目的：
 * 入金確認フローを集約する（末日通知→トークン→リンク完了→DB反映→必要に応じて通知）。
 * 「リンクからのみ完了できる」設計で、事実確認の監査性と操作ミス耐性を高める。
 *
 * このファイルが担当するもの：
 * - DB_PaymentConfirmTokens の管理（発行/再利用/使用済み記録）
 * - cron_sendPaymentCheckToKyokoDaily_（末日だけ送る定期処理）
 * - api_confirmPaymentByToken（リンク完了処理）
 * - 手動送信・トリガーセットアップ・デバッグ用関数
 *
 * ルール：
 * - 完了条件は token 一致＋未使用 を必須にする。
 * - 権限（操作ユーザー/参画PJ）のチェックを必ず行う。
 * - “入金月(ym)” と “業務月(bizYm)” を混同しない（必ず明示して保存する）。
 */

// =====================================================
// Payment confirm (kyoko only)
// =====================================================
const PAYMENT_CONFIRM = {
  KYOKO_EMAIL: "kyoko@team-armada.jp",
};
function b_isLastDayOfMonth_(d){
  const x = new Date(d);
  const last = new Date(x.getFullYear(), x.getMonth()+1, 0).getDate();
  return x.getDate() === last;
}
function b_fmtYmJa_(ym){
  const [y,m] = String(ym).split("-").map(Number);
  return `${y}年${m}月`;
}
function b_ensurePaymentTokenHeader_(){
  const ss = b_ss_();
  const name = "DB_PaymentConfirmTokens";
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);

  const headers = [
    "projectId","ym","bizYm","token",
    "sentAt","usedAt","usedBy","note"
  ];

  // 既存ヘッダを確認して足りない分を追加
  const lastCol = Math.max(sh.getLastColumn(), 1);
  const row1 = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h||"").trim());

  if (row1.every(h => !h)) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    return;
  }

  const missing = headers.filter(h => row1.indexOf(h) < 0);
  if (missing.length) {
    sh.getRange(1, row1.length + 1, 1, missing.length).setValues([missing]);
  }
}
function b_getOrCreatePaymentToken_(projectId, ym, bizYm){
  b_ensurePaymentTokenHeader_();
  const sh = b_getSheet_("DB_PaymentConfirmTokens");
  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  const vals = (lastRow >= 1 && lastCol >= 1) ? sh.getRange(1,1,lastRow,lastCol).getValues() : [[]];
  if (!vals || vals.length < 1) return Utilities.getUuid().replace(/-/g,"");

  const h = vals[0].map(x => String(x||"").trim());
  const iPid = h.indexOf("projectId");
  const iYm  = h.indexOf("ym");
  const iBiz = h.indexOf("bizYm");
  const iToken = h.indexOf("token");
  const iUsedAt = h.indexOf("usedAt");

  // 既存の未使用トークンがあれば再利用
  for (let r=1; r<vals.length; r++){
    if (String(vals[r][iPid]||"").trim() === projectId && b_normYm_(vals[r][iYm]) === ym) {
      const token = String(vals[r][iToken]||"").trim();
      const usedAt = String(vals[r][iUsedAt]||"").trim();
      if (token && !usedAt) return token;
    }
  }

  const token = Utilities.getUuid().replace(/-/g,"");
  const nowIso = b_nowIso_();
  b_upsertRow_("DB_PaymentConfirmTokens", ["projectId","ym"], {
    projectId,
    ym,
    bizYm,
    token,
    sentAt: nowIso,
    usedAt: "",
    usedBy: "",
    note: "",
  });
  return token;
}
/**
 * 毎日9時に回す（末日だけ送る）
 * - 入金月（ym） = 今月
 * - 業務月（bizYm） = 前月
 * - フィルタ：DB_BillingCycle で「当月(=入金月)かつ invoiceSentAt が入ってるPJのみ」
 */
function cron_sendPaymentCheckToKyokoDaily_(){
  // 廃止：入金確認の通知はSlackに統一済み。
  // 末日トリガーで回り続けるとGmail権限不足で落ちるので、明示的に止める。
  throw new Error(
    "cron_sendPaymentCheckToKyokoDaily_ is deprecated. " +
    "入金確認通知はSlack運用に移行済み。トリガー設定（setupPaymentConfirmTrigger）も削除して。"
  );
}

/**
 * トリガー作成（最初の1回だけ手で実行）
 */


/**
 * きよがリンクから完了するAPI（PaymentConfirmPage.html から呼ばれる）
 * - kyoko以外は拒否
 * - token一致必須
 * - DB_BillingCycle の paymentConfirmedAt/by/note を更新
 */
function api_confirmPaymentByToken(payload){
  payload = payload || {};
  const token = String(payload.token || "").trim();
  const projectId = String(payload.projectId || "").trim();
  const ym = b_normYm_(payload.ym);        // 入金月
  const bizYm = b_normYm_(payload.bizYm);  // 業務月
  const note = String(payload.note || "");

  const me = String(Session.getActiveUser().getEmail() || "").trim().toLowerCase();
  if (me !== PAYMENT_CONFIRM.KYOKO_EMAIL) {
    return { ok:false, message:"きよ以外は操作できない" };
  }

  // ★参画PJ以外は拒否（きよでも）
  try { b_assertProjectAccess_(projectId); } catch(e) { return { ok:false, message:"access denied" }; }

  if (!token || !projectId || !ym) {
    return { ok:false, message:"パラメータ不足" };
  }

  // token 検証（未使用のみOK）
  b_ensurePaymentTokenHeader_();
  const sh = b_getSheet_("DB_PaymentConfirmTokens");
  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  const vals = (lastRow >= 1 && lastCol >= 1) ? sh.getRange(1,1,lastRow,lastCol).getValues() : [[]];
  if (!vals || vals.length < 2) return { ok:false, message:"token table empty" };

  const h = vals[0].map(x => String(x||"").trim());
  const iPid = h.indexOf("projectId");
  const iYm  = h.indexOf("ym");
  const iBiz = h.indexOf("bizYm");
  const iToken = h.indexOf("token");
  const iSentAt = h.indexOf("sentAt");
  const iUsedAt = h.indexOf("usedAt");
  const iUsedBy = h.indexOf("usedBy");
  const iNote = h.indexOf("note");

  let hitRow = -1;
  let curToken = "";
  let usedAt = "";

  for (let r=1; r<vals.length; r++){
    if (String(vals[r][iPid]||"").trim() === projectId && b_normYm_(vals[r][iYm]) === ym) {
      hitRow = r+1;
      curToken = String(vals[r][iToken]||"").trim();
      usedAt = String(vals[r][iUsedAt]||"").trim();
      break;
    }
  }
  if (hitRow < 0) return { ok:false, message:"token record not found" };
  if (curToken !== token) return { ok:false, message:"token mismatch" };
  if (usedAt) return { ok:false, message:"もう完了済み" };

  // BillingCycle 更新（既存を保持しつつ payment だけ確定）
  b_ensureBillingCycleHeader_();
  const nowIso = b_nowIso_();
  const cur = b_getCycleOne_(projectId, ym) || {};
  const createdAt = String(cur.createdAt || "") || nowIso;
  const cycleId = `${projectId}_${ym}`;
  const projectName = String(cur.projectName || b_getProjectName_(projectId) || projectId);

  b_upsertRow_("DB_BillingCycle", ["projectId","ym"], {
    cycleId,
    projectId,
    ym,
    projectName,

    budgetTotal: (cur.budgetTotal !== undefined ? cur.budgetTotal : (cur.budgetYen !== undefined ? cur.budgetYen : "")),
    budgetConfirmedAt: String(cur.budgetConfirmedAt || ""),
    budgetConfirmedBy: String(cur.budgetConfirmedBy || ""),

    memberAllocationsJson: (cur.memberAllocationsJson !== undefined ? String(cur.memberAllocationsJson || "") : ""),
    allocationConfirmedAt: String(cur.allocationConfirmedAt || ""),
    allocationConfirmedBy: String(cur.allocationConfirmedBy || ""),
    status: String(cur.status || "draft"),
    note: String(cur.note || ""),

    monthlyReportFileId: String(cur.monthlyReportFileId || ""),
    monthlyReportUrl: String(cur.monthlyReportUrl || ""),
    meetingEventId: String(cur.meetingEventId || ""),
    meetingStartAt: String(cur.meetingStartAt || ""),
    meetingEndAt: String(cur.meetingEndAt || ""),
    meetingHtmlLink: String(cur.meetingHtmlLink || ""),
    fixedTotalYen: Number(cur.fixedTotalYen || 0),

    invoiceIssuedAt: String(cur.invoiceIssuedAt || ""),
    invoiceIssuedBy: String(cur.invoiceIssuedBy || ""),
    invoicePdfUrl: String(cur.invoicePdfUrl || ""),
    invoiceSentAt: String(cur.invoiceSentAt || ""),
    invoiceSentBy: String(cur.invoiceSentBy || ""),

    paymentConfirmedAt: nowIso,
    paymentConfirmedBy: me,
    paymentNote: note,

    createdAt,
    updatedAt: nowIso
  });

  // token table に used を記録
  if (iUsedAt >= 0) sh.getRange(hitRow, iUsedAt+1).setValue(nowIso);
  if (iUsedBy >= 0) sh.getRange(hitRow, iUsedBy+1).setValue(me);
  if (iNote >= 0) sh.getRange(hitRow, iNote+1).setValue(note);
  if (iBiz >= 0) sh.getRange(hitRow, iBiz+1).setValue(bizYm);
  if (iSentAt >= 0 && !String(sh.getRange(hitRow, iSentAt+1).getValue()||"").trim()) {
    sh.getRange(hitRow, iSentAt+1).setValue(nowIso);
  }

  b_appendBillingLog_({
    actionType: "PAYMENT_CONFIRM_BY_KYOKO",
    target: "payment",
    projectId,
    ym,
    cycleId,
    beforeValue: "",
    afterValue: JSON.stringify({ bizYm, paymentConfirmedAt: nowIso, paymentNote: note }),
    reason: "payconfirm_link",
    operatorUserId: me,
    operatorName: me,
    createdAt: new Date()
  });

}
// UIの実行候補に出すためのラッパー（末尾_なし）
function setupPaymentConfirmTrigger() {
  const handler = "cron_sendPaymentCheckToKyokoDaily_";

  const triggers = ScriptApp.getProjectTriggers();
  const exists = triggers.some(t => t.getHandlerFunction() === handler);

  if (exists) {
    return { ok:true, message:"already exists" };
  }

  ScriptApp.newTrigger(handler)
    .timeBased()
    .everyDays(1)
    .atHour(9)
    .create();

  return { ok:true, message:"created daily trigger at 9:00" };
}

function debug_sendPaymentCheckNow() {
  throw new Error(
    "debug_sendPaymentCheckNow is deprecated. " +
    "入金確認通知はSlack運用に移行済み。"
  );
}

function debug_sendPaymentCheckNow_force() {
  throw new Error(
    "debug_sendPaymentCheckNow_force is deprecated. " +
    "入金確認通知はSlack運用に移行済み。"
  );
}

function api_requestPaymentConfirmNow(payload){
  // 廃止：手動の入金確認依頼通知はSlackに統一済み。
  // ここが呼ばれているならUI/導線の移行漏れ。
  payload = payload || {};
  const projectId = String(payload.projectId || "").trim();
  const bizYm = b_normYm_(payload.bizYmKey || "");

  throw new Error(
    "api_requestPaymentConfirmNow is deprecated. " +
    "入金確認依頼はSlack運用に移行済み。UI/導線からこのAPI呼び出しを削除して。 " +
    `projectId=${projectId} bizYm=${bizYm}`
  );
}
