/* Billing.gs */
function api_setBillingTask(projectId, ym, taskKey, payload) {
  projectId = String(projectId || "").trim();
  ym = b_normYm_(ym);
  taskKey = String(taskKey || "").trim();
  payload = payload || {};

  if (!projectId) throw new Error("api_setBillingTask: projectId empty");
  if (!ym) throw new Error("api_setBillingTask: ym empty");
  if (!taskKey) throw new Error("api_setBillingTask: taskKey empty");

  b_assertProjectAccess_(projectId);
  b_ensureBillingCycleHeader_();

  // ★レビュー用の列も追加（無ければ作る）
  b_ensureHeader_("DB_BillingCycle", ["invoiceReviewedAt","invoiceReviewedBy"]);

  const nowIso = b_nowIso_();
  const cur = b_getCycleOne_(projectId, ym) || {};
  const createdAt = String(cur.createdAt || "") || nowIso;
  const cycleId = `${projectId}_${ym}`;
  const projectName = String(cur.projectName || b_getProjectName_(projectId) || projectId);

  const base = {
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
    freeeInvoiceId: String(cur.freeeInvoiceId || ""),
    freeeInvoiceNumber: String(cur.freeeInvoiceNumber || ""),
    invoicePdfFileId: String(cur.invoicePdfFileId || ""),

    invoiceSentAt: String(cur.invoiceSentAt || ""),
    invoiceSentBy: String(cur.invoiceSentBy || ""),
    paymentConfirmedAt: String(cur.paymentConfirmedAt || ""),
    paymentConfirmedBy: String(cur.paymentConfirmedBy || ""),
    paymentNote: String(cur.paymentNote || ""),

    // ★レビュー
    invoiceReviewedAt: String(cur.invoiceReviewedAt || ""),
    invoiceReviewedBy: String(cur.invoiceReviewedBy || ""),

    createdAt,
    updatedAt: nowIso
  };

  const me = Session.getActiveUser().getEmail();

  if (taskKey === "invoice_issue") {
    const done = b_toBool_(payload.done, false);
    base.invoiceIssuedAt = done ? nowIso : "";
    base.invoiceIssuedBy = done ? me : "";
    base.invoicePdfUrl = done ? String(payload.invoicePdfUrl || base.invoicePdfUrl || "") : "";
  }

  if (taskKey === "invoice_review") {
    const done = b_toBool_(payload.done, false);
    base.invoiceReviewedAt = done ? nowIso : "";
    base.invoiceReviewedBy = done ? me : "";
  }

  if (taskKey === "invoice_send") {
    const done = b_toBool_(payload.done, false);
    base.invoiceSentAt = done ? nowIso : "";
    base.invoiceSentBy = done ? me : "";
  }

  if (taskKey === "payment_confirm") {
    const done = b_toBool_(payload.done, false);
    base.paymentConfirmedAt = done ? nowIso : "";
    base.paymentConfirmedBy = done ? me : "";
    base.paymentNote = done ? String(payload.paymentNote || base.paymentNote || "") : "";
  }

  b_upsertRow_("DB_BillingCycle", ["projectId","ym"], base);

  b_appendBillingLog_({
    actionType: "TASK_UPDATE",
    target: taskKey,
    projectId,
    ym,
    cycleId,
    beforeValue: "",
    afterValue: JSON.stringify({ taskKey, payload }),
    reason: "task_update",
    operatorUserId: me,
    operatorName: me,
    createdAt: new Date()
  });

  return { ok:true, taskKey, updatedAt: nowIso };
}



//freee token debug用
function debug_freeeTokenCheck(){
  const t = b_freeeGetAccessToken_();
  return { ok: !!t, tokenHead: String(t).slice(0,6) };
}

function api_debugListFunctions() {
  // 本番ではポップアップ原因になるので、静かに成功だけ返す
  return { ok: true };
}



