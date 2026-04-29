/* Billingページ向けAPI入口だけ置く。
ここは「どんなデータを返すか」という“アプリの契約”が見える場所。*/
/**
 * B_BillingApi.gs
 *
 * 目的：
 * Billingページ（UI）から呼ばれる api_ 関数を集約し、“アプリの契約”を見える化する。
 * 中身は薄く保ち、Domain/各モジュールの関数を呼ぶだけの入り口にする。
 *
 * このファイルが担当するもの：
 * - api_getBillingPageInit / api_getBillingPageData（初期ロード）
 * - api_confirmBudget / api_saveBilling / api_setBillingTask（状態更新）
 * - api_uploadMonthlyReport（アップロード→DB反映→必要に応じてCalendar更新）
 * - lite/extras など、ロード分割用API
 *
 * ルール：
 * - DBの読み書きロジックをここに肥大化させない（Domainへ逃がす）。
 * - freee/Calendar/Gmail/Drive の実処理もここに書かない（各担当ファイルへ）。
 * - ここは“UIが何を必要としているか”が一目で分かる構造を優先する。
 */

/** ====== PUBLIC API ====== */
function api_getBillingPageInit() {
  // admin は全件、非admin は参画PJだけ
  const all = b_readTable_("DB_Projects").map(p => ({
    projectId: String(p.projectId || "").trim(),
    projectName: String(p.projectName || p.projectId || "").trim(),
  })).filter(p => p.projectId);

  if (isAdmin_()) {
    return { projects: all };
  }

  // 非admin：canAccessProject_ が true のものだけ返す
  const projects = all.filter(p => {
    try { return canAccessProject_(p.projectId); } catch(e) { return false; }
  });

  return { projects };
}
/**
 * BillingPage 初期表示データ
 * - billing: DB_BillingCycle の当月（ym=業務月）レコード
 * - payouts: アクティブ参画メンバー一覧（plannedYen 付き）
 * - summary: plannedTotal / prevFixedTotal
 * - agreement: 合意状況（最新versionの集計）
 * - history: 月別の予算&配賦履歴（UIの表用）
 * - saveLog: DB_BillingCycle 更新ログっぽい簡易一覧
 * - pmEmails: 月次会議の招待先（PM）
 */
function api_getBillingPageData(projectId, ym) {
  const prof = b_profStart_();
  b_profMark_(prof, "start");

  projectId = String(projectId || "").trim();
  ym = b_normYm_(ym);

  if (!projectId) throw new Error("api_getBillingPageData: projectId empty");
  if (!ym) throw new Error("api_getBillingPageData: ym empty");

  b_assertProjectAccess_(projectId);
  b_profMark_(prof, "access check");

  b_profMark_(prof, "ensure headers (skipped)");

  // ===== DB_Projects を1回だけ読む（使い回し）=====
  // ★PJ別テンプレ列（無ければ作る）
  b_ensureHeader_("DB_Projects", ["invoiceBaseLinesTemplateJson","invoiceSendManual"]);

  const projectsRows = b_cachedReadProjects_();
  b_profMark_(prof, "read DB_Projects (once)");

  function getProjectRow_(pid){
    return projectsRows.find(r => String(r.projectId||"").trim() === String(pid||"").trim()) || {};
  }

  // ===== members/master (THIN) =====
  const membersRows = b_readTableThin_("DB_Members", ["memberId","codeName","email"]);
  const members = b_indexBy_(membersRows.map(r => ({
    memberId: String(r.memberId || "").trim(),
    codeName: r.codeName,
    email: r.email,
  })).filter(x => x.memberId), "memberId");
  b_profMark_(prof, "read DB_Members");

  // ===== project members (THIN) =====
  const pmRows = b_readTableThin_("DB_ProjectMembers", ["projectId","memberId","isActive","isPM","roleLabel"]);
  const pms = pmRows
    .map(r => ({
      projectId: String(r.projectId || "").trim(),
      memberId: String(r.memberId || "").trim(),
      isActive: (r.isActive !== undefined ? r.isActive : ""),
      isPM: (r.isPM !== undefined ? r.isPM : ""),
      roleLabel: String(r.roleLabel || "").trim(),
    }))
    .filter(r => r.projectId === projectId && r.memberId)
    .filter(r => b_toBool_(r.isActive, true));
  b_profMark_(prof, "read DB_ProjectMembers");

  const memberIds = pms.map(r => r.memberId);

  // ===== freee settings（Projectsから拾う：再読込しない）=====
  const pjRow = getProjectRow_(projectId);

  // ★PJ別：基本行テンプレ（JSON）
  const projectInvoiceBaseLinesTemplateJson =
    String(pjRow.invoiceBaseLinesTemplateJson || "").trim();

  const freee = {
    partnerId: String(pjRow.freeePartnerId || "").trim(),
    partnerName: String(pjRow.freeePartnerName || "").trim(),
    templateId: String(pjRow.freeeInvoiceTemplateId || "").trim(),
  };
  b_profMark_(prof, "freee settings (from cached DB_Projects)");

  // ===== current cycle（PJ範囲readベースへ）=====
  const cycle = b_getCycleOne_(projectId, ym) || {};
  b_profMark_(prof, "read DB_BillingCycle (current)");

  // ===== 立替（2重承認済み）をライブ集計：請求書発行前だけ上書き =====
  let reimbLive = { ok:false, totalYen:0, items:[] };
  try{
    reimbLive = reimburse_listApprovedForBilling({ projectId, ym }) || reimbLive;
  } catch(e){
    reimbLive = { ok:false, totalYen:0, items:[] };
  }
  const cycleInvoiceIssuedAt = String(cycle.invoiceIssuedAt || "").trim();
  const liveReimbYen = Number(reimbLive.totalYen || 0);
  const liveReimbCount = Array.isArray(reimbLive.items) ? reimbLive.items.length : 0;
  b_profMark_(prof, "reimburse live sum");

  const billing = {
    projectId,
    ym,
    projectName: String(cycle.projectName || b_getProjectName_(projectId) || projectId),

    budgetTotal: (cycle.budgetTotal !== undefined ? cycle.budgetTotal : ""),
    budgetYen: (cycle.budgetYen !== undefined ? cycle.budgetYen : ""),
    budgetConfirmedAt: String(cycle.budgetConfirmedAt || ""),
    budgetConfirmedBy: String(cycle.budgetConfirmedBy || ""),

    memberAllocationsJson: String(cycle.memberAllocationsJson || ""),
    allocationConfirmedAt: String(cycle.allocationConfirmedAt || ""),
    allocationConfirmedBy: String(cycle.allocationConfirmedBy || ""),

    monthlyReportFileId: String(cycle.monthlyReportFileId || ""),
    monthlyReportUrl: String(cycle.monthlyReportUrl || ""),

    meetingEventId: String(cycle.meetingEventId || ""),
    meetingStartAt: String(cycle.meetingStartAt || ""),
    meetingEndAt: String(cycle.meetingEndAt || ""),
    meetingHtmlLink: String(cycle.meetingHtmlLink || ""),

    fixedTotalYen: Number(cycle.fixedTotalYen || 0),

    invoiceIssuedAt: String(cycle.invoiceIssuedAt || ""),
    invoiceIssuedBy: String(cycle.invoiceIssuedBy || ""),
    invoicePdfUrl: String(cycle.invoicePdfUrl || ""),

    invoiceSentAt: String(cycle.invoiceSentAt || ""),
    invoiceSentBy: String(cycle.invoiceSentBy || ""),

    invoiceReviewedAt: String(cycle.invoiceReviewedAt || ""),
    invoiceReviewedBy: String(cycle.invoiceReviewedBy || ""),

    paymentConfirmedAt: String(cycle.paymentConfirmedAt || ""),
    paymentConfirmedBy: String(cycle.paymentConfirmedBy || ""),
    paymentNote: String(cycle.paymentNote || ""),

    freeeInvoiceId: String(cycle.freeeInvoiceId || ""),
    freeeInvoiceNumber: String(cycle.freeeInvoiceNumber || ""),
    invoicePdfFileId: String(cycle.invoicePdfFileId || ""),

    invoiceBillingDate: b_toDateInput_(cycle.invoiceBillingDate),
    invoicePaymentDate: b_toDateInput_(cycle.invoicePaymentDate),


    // ★ここが本丸：発行前は live、発行後は cycle を尊重
    invoiceReimbYen: cycleInvoiceIssuedAt ? Number(cycle.invoiceReimbYen || 0) : liveReimbYen,

    freeeInvoiceTemplateId: String(cycle.freeeInvoiceTemplateId || ""),

    invoiceCustomLinesJson: String(cycle.invoiceCustomLinesJson || ""),

    // ★重要：基本行（複数行）をFEへ返す（これが無いと毎回初期化される）
    invoiceBaseLinesJson: String(cycle.invoiceBaseLinesJson || ""),

    // ★文言
    invoiceSubject: String(cycle.invoiceSubject || ""),
    invoiceBaseLineDesc: String(cycle.invoiceBaseLineDesc || ""),
    invoiceReimbPrefix: String(cycle.invoiceReimbPrefix || ""),

    // ★備考（FEが復元に使ってる）
    invoiceRemark: String(cycle.invoiceRemark || ""),

    // ★admin override
    adminOverrideJson: String(cycle.adminOverrideJson || ""),
    adminOverrideUpdatedAt: String(cycle.adminOverrideUpdatedAt || ""),
    adminOverrideBy: String(cycle.adminOverrideBy || ""),

    freeePartnerId: String(freee.partnerId || ""),
    freeePartnerName: String(freee.partnerName || ""),
    freeeInvoiceTemplateId: String(freee.templateId || ""),

    partnerId: String(freee.partnerId || ""),
    partnerName: String(freee.partnerName || ""),
    templateId: String(freee.templateId || ""),
  };

  // ===== payout detail：projectId+ymだけ読む（既に速い）=====
  const details = b_readPayoutDetailForProjectYm_(projectId, ym);
  b_profMark_(prof, "read DB_PayoutDetail (projectId+ym fast)");

  const byMember = b_indexBy_(details, "memberId");
  const allocSnap = b_safeJsonParse_(billing.memberAllocationsJson, {});

  const payouts = memberIds.map(mid => {
    const m = members[String(mid)] || {};
    const d = byMember[String(mid)] || {};
    const planned =
      (d.plannedYen !== undefined && d.plannedYen !== "") ? Number(d.plannedYen || 0)
      : Number(allocSnap[String(mid)] || 0);

    return {
      memberId: mid,
      codeName: String(m.codeName || mid),
      plannedYen: planned,
      fixedYen: (d.fixedYen !== undefined && d.fixedYen !== "") ? Number(d.fixedYen || 0) : 0,
    };
  });
  b_profMark_(prof, "build payouts");

  const plannedTotalYen = b_sum_(payouts.map(p => Number(p.plannedYen || 0)));

  // prev fixed total
  const prevYm = b_addMonths_(ym, -1);
  const prev = b_getCycleOne_(projectId, prevYm) || {};
  const prevFixedTotalYen = Number(prev.fixedTotalYen || 0);
  b_profMark_(prof, "read DB_BillingCycle (prev)");

  // agreement status
  const agreement = b_getAgreementStatus_(projectId, ym, memberIds);
  b_profMark_(prof, "agreement status");

  const history = b_buildBudgetAndPayoutHistory_(projectId, memberIds, 6);
  b_profMark_(prof, "history (last 6)");

  const saveLog = b_buildSaveLog_(projectId, 10);
  b_profMark_(prof, "saveLog (last 10)");

  const pmEmails = pms
    .filter(r => b_toBool_(r.isPM, false) || String(r.roleLabel || "").toUpperCase().includes("PM"))
    .map(r => String(members[String(r.memberId)]?.email || ""))
    .filter(e => e);
  b_profMark_(prof, "pm emails");

  function splitEmails(s){
    return String(s||"")
      .split(/[,\n;]/)
      .map(x => x.trim())
      .filter(x => x);
  }
  const invoiceRecipients = {
    toName: String(pjRow.invoiceToName || "").trim(),
    to: splitEmails(pjRow.invoiceToEmails),
    cc: splitEmails(pjRow.invoiceCcEmails),
    bcc: splitEmails(pjRow.invoiceBccEmails),
    paymentDueRule: String(pjRow.paymentDueRule || "").trim(),

    // ★PJ固定：手動送信フラグ（Charterで設定）
    invoiceSendManual: b_toBool_(pjRow.invoiceSendManual, false),
  };
  b_profMark_(prof, "invoice recipients (from cached DB_Projects)");

  b_profMark_(prof, "end");

  return {
    ok: true,
    billing,
    payouts,
    summary: { plannedTotalYen, prevFixedTotalYen },
    agreement,
    history,
    saveLog,
    pmEmails: Array.from(new Set(pmEmails)),
    invoiceRecipients,

    // ★PJ別：基本行テンプレ（FEで初期値に使う）
    projectInvoiceBaseLinesTemplateJson,

    // ★フロントで「何件・いくら」も出せるように返す（表示改善にも効く）
    reimbApprovedCount: liveReimbCount,
    reimbApprovedTotalYen: liveReimbYen,

    partnerId: String(freee.partnerId || ""),
    partnerName: String(freee.partnerName || ""),
    templateId: String(freee.templateId || ""),

    freeeSettings: {
      partnerId: String(freee.partnerId || ""),
      partnerName: String(freee.partnerName || ""),
      templateId: String(freee.templateId || ""),
    },

    profile: prof.marks
  };
}

/**
 * 予算の「確定」ボタン専用API
 * - ここ経由でしか budgetTotal を更新しない
 * - 確定したら budgetConfirmedAt/By を入れる
 */
function api_confirmBudget(projectId, ym, budgetYen) {
  projectId = String(projectId || "").trim();
  ym = b_normYm_(ym);
  const budget = Number(budgetYen || 0);

  if (!projectId) throw new Error("api_confirmBudget: projectId empty");
  if (!ym) throw new Error("api_confirmBudget: ym empty");

  // ✅ 権限チェック（穴塞ぎ）
  b_assertProjectAccess_(projectId);

  b_ensureBillingCycleHeader_();

  const nowIso = b_nowIso_();
  const projectName = b_getProjectName_(projectId) || projectId;
  const cycleId = `${projectId}_${ym}`;

  const cur = b_getCycleOne_(projectId, ym) || {};
  const before = {
    budgetTotal: (cur.budgetTotal !== undefined && cur.budgetTotal !== "") ? Number(cur.budgetTotal || 0) : Number(cur.budgetYen || 0),
    budgetConfirmedAt: String(cur.budgetConfirmedAt || ""),
    budgetConfirmedBy: String(cur.budgetConfirmedBy || "")
  };

  const createdAt = String(cur.createdAt || "") || nowIso;

  b_upsertRow_("DB_BillingCycle", ["projectId","ym"], {
    cycleId,
    projectId,
    ym,
    projectName: String(cur.projectName || projectName),

    budgetTotal: budget,
    budgetConfirmedAt: nowIso,
    budgetConfirmedBy: Session.getActiveUser().getEmail(),

    memberAllocationsJson: (cur.memberAllocationsJson !== undefined ? String(cur.memberAllocationsJson || "") : ""),
    allocationConfirmedAt: String(cur.allocationConfirmedAt || ""),
    allocationConfirmedBy: String(cur.allocationConfirmedBy || ""),
    status: "budget_confirmed",
    note: String(cur.note || ""),

    monthlyReportFileId: String(cur.monthlyReportFileId || ""),
    monthlyReportUrl: String(cur.monthlyReportUrl || ""),

    meetingEventId: String(cur.meetingEventId || ""),
    meetingStartAt: String(cur.meetingStartAt || ""),
    meetingEndAt: String(cur.meetingEndAt || ""),
    meetingHtmlLink: String(cur.meetingHtmlLink || ""),

    fixedTotalYen: Number(cur.fixedTotalYen || 0),

    // invoice/payment は維持
    invoiceIssuedAt: String(cur.invoiceIssuedAt || ""),
    invoiceIssuedBy: String(cur.invoiceIssuedBy || ""),
    invoicePdfUrl: String(cur.invoicePdfUrl || ""),
    invoiceSentAt: String(cur.invoiceSentAt || ""),
    invoiceSentBy: String(cur.invoiceSentBy || ""),
    paymentConfirmedAt: String(cur.paymentConfirmedAt || ""),
    paymentConfirmedBy: String(cur.paymentConfirmedBy || ""),
    paymentNote: String(cur.paymentNote || ""),

    // freee連携（後で使う）
    freeeInvoiceId: String(cur.freeeInvoiceId || ""),
    freeeInvoiceNumber: String(cur.freeeInvoiceNumber || ""),
    invoicePdfFileId: String(cur.invoicePdfFileId || ""),

    createdAt,
    updatedAt: nowIso
  });

  const after = { budgetTotal: budget, budgetConfirmedAt: nowIso, budgetConfirmedBy: Session.getActiveUser().getEmail() };

  b_appendBillingLog_({
    actionType: "BUDGET_CONFIRM",
    target: "budgetTotal",
    projectId,
    ym,
    cycleId,
    beforeValue: JSON.stringify(before),
    afterValue: JSON.stringify(after),
    reason: "budget_confirm",
    operatorUserId: Session.getActiveUser().getEmail(),
    operatorName: Session.getActiveUser().getEmail(),
    createdAt: new Date()
  });

  return { ok:true, budgetYen: budget, budgetConfirmedAt: nowIso };
}
/**
 * 配賦（メンバー報酬）の確定保存
 * - ここでは budgetTotal を更新しない（予算は api_confirmBudget のみ）
 * - DB_PayoutDetail は継続利用
 * - DB_BillingCycle には memberAllocationsJson もスナップショットとして保持
 */
function api_saveBilling(projectId, ym, payload) {
  projectId = String(projectId || "").trim();
  ym = b_normYm_(ym);
  payload = payload || {};

  if (!projectId) throw new Error("api_saveBilling: projectId empty");
  if (!ym) throw new Error("api_saveBilling: ym empty");

  // 権限チェック
  b_assertProjectAccess_(projectId);

  b_ensureBillingCycleHeader_();
  b_ensureHeader_("DB_PayoutDetail", ["projectId","ym","memberId","plannedYen","fixedYen","updatedAt"]);

  const nowIso = b_nowIso_();
  const cycleId = `${projectId}_${ym}`;

  const cur = b_getCycleOne_(projectId, ym) || {};
  const createdAt = String(cur.createdAt || "") || nowIso;
  const projectName = String(payload.projectName || "") || String(cur.projectName || "") || b_getProjectName_(projectId) || projectId;

  // 既存の月報/会議リンクは保持
  const keepMonthlyReportFileId = String(cur.monthlyReportFileId || "");
  const keepMonthlyReportUrl = String(cur.monthlyReportUrl || "");
  const keepMeetingEventId = String(cur.meetingEventId || "");
  const keepMeetingStartAt = String(cur.meetingStartAt || "");
  const keepMeetingEndAt = String(cur.meetingEndAt || "");
  const keepMeetingHtmlLink = String(cur.meetingHtmlLink || "");

  // payouts -> allocations snapshot
  const payouts = Array.isArray(payload.payouts) ? payload.payouts : [];
  const alloc = {};
  payouts.forEach(p => {
    const memberId = String(p.memberId || "").trim();
    if (!memberId) return;
    const fixed = Number(p.fixedYen || 0);
    const planned = Number(p.plannedYen || 0);
    alloc[memberId] = fixed > 0 ? fixed : planned;
  });

  const fixedTotalYen = Number(payload.fixedTotalYen || 0);
  const plannedTotalYen = b_sum_(payouts.map(p => Number(p.plannedYen || 0)));

  // allocation 確定判定：fixedTotal>0 かつ allocations に1人以上
  const isConfirm = fixedTotalYen > 0 && Object.keys(alloc).length > 0;

  const beforeAlloc = b_safeJsonParse_(cur.memberAllocationsJson, {});

  // Cycle更新（予算は触らない）
  b_upsertRow_("DB_BillingCycle", ["projectId","ym"], {
    cycleId,
    projectId,
    ym,
    projectName: projectName,

    // budget は維持
    budgetTotal: (cur.budgetTotal !== undefined ? cur.budgetTotal : ""),
    budgetConfirmedAt: String(cur.budgetConfirmedAt || ""),
    budgetConfirmedBy: String(cur.budgetConfirmedBy || ""),

    memberAllocationsJson: JSON.stringify(alloc),
    allocationConfirmedAt: isConfirm ? nowIso : String(cur.allocationConfirmedAt || ""),
    allocationConfirmedBy: isConfirm ? Session.getActiveUser().getEmail() : String(cur.allocationConfirmedBy || ""),
    status: isConfirm ? "allocation_confirmed" : String(cur.status || "draft"),
    note: String(cur.note || ""),

    monthlyReportFileId: keepMonthlyReportFileId,
    monthlyReportUrl: keepMonthlyReportUrl,
    meetingEventId: keepMeetingEventId,
    meetingStartAt: keepMeetingStartAt,
    meetingEndAt: keepMeetingEndAt,
    meetingHtmlLink: keepMeetingHtmlLink,

    fixedTotalYen: isConfirm ? fixedTotalYen : Number(cur.fixedTotalYen || 0),

    // invoice/payment は維持
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

    createdAt,
    updatedAt: nowIso,
  });

  // PayoutDetail upsert
  payouts.forEach(r => {
    b_upsertRow_("DB_PayoutDetail", ["projectId","ym","memberId"], {
      projectId,
      ym,
      memberId: String(r.memberId || "").trim(),
      plannedYen: Number(r.plannedYen || 0),
      fixedYen: Number(r.fixedYen || 0),
      updatedAt: nowIso,
    });
  });

  // Log（配賦だけ）
  b_appendBillingLog_({
    actionType: isConfirm ? "ALLOCATION_CONFIRM" : "ALLOCATION_SAVE_DRAFT",
    target: "memberAllocations",
    projectId,
    ym,
    cycleId,
    beforeValue: JSON.stringify(beforeAlloc || {}),
    afterValue: JSON.stringify(alloc),
    reason: isConfirm ? "allocation_confirm" : "allocation_draft_save",
    operatorUserId: Session.getActiveUser().getEmail(),
    operatorName: Session.getActiveUser().getEmail(),
    createdAt: new Date(),
  });

  return { ok: true, isConfirm, plannedTotalYen, fixedTotalYen };
}
function api_uploadMonthlyReport(projectId, ym, fileName, mimeType, base64) {
  projectId = String(projectId || "").trim();
  ym = b_normYm_(ym);
  fileName = String(fileName || "monthly_report").trim();
  mimeType = String(mimeType || "application/octet-stream").trim();
  base64 = String(base64 || "").trim();

  if (!projectId) throw new Error("api_uploadMonthlyReport: projectId empty");
  if (!ym) throw new Error("api_uploadMonthlyReport: ym empty");
  if (!base64) throw new Error("api_uploadMonthlyReport: base64 empty");

  b_assertProjectAccess_(projectId);
  b_ensureBillingCycleHeader_();

  const bytes = Utilities.base64Decode(base64);
  const blob = Utilities.newBlob(bytes, mimeType, fileName);
  const folder = DriveApp.getFolderById(BILLING_CFG.MONTHLY_REPORT_FOLDER_ID);
  const stampedName = `月次報告書_${projectId}_${ym}_${fileName}`;
  const saved = folder.createFile(blob).setName(stampedName);

  const nowIso = b_nowIso_();
  const projectName = b_getProjectName_(projectId) || projectId;
  const cycleId = `${projectId}_${ym}`;

  const cur = b_getCycleOne_(projectId, ym) || {};
  const createdAt = String(cur.createdAt || "") || nowIso;

  // 1) まずDBを更新（ここまでは現状踏襲）
  b_upsertRow_("DB_BillingCycle", ["projectId","ym"], {
    cycleId,
    projectId,
    ym,
    projectName: String(cur.projectName || projectName),

    budgetTotal: (cur.budgetTotal !== undefined ? cur.budgetTotal : (cur.budgetYen !== undefined ? cur.budgetYen : "")),
    budgetConfirmedAt: String(cur.budgetConfirmedAt || ""),
    budgetConfirmedBy: String(cur.budgetConfirmedBy || ""),

    memberAllocationsJson: (cur.memberAllocationsJson !== undefined ? String(cur.memberAllocationsJson || "") : ""),
    allocationConfirmedAt: String(cur.allocationConfirmedAt || ""),
    allocationConfirmedBy: String(cur.allocationConfirmedBy || ""),
    status: String(cur.status || "draft"),
    note: String(cur.note || ""),

    monthlyReportFileId: saved.getId(),
    monthlyReportUrl: saved.getUrl(),

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
    paymentConfirmedAt: String(cur.paymentConfirmedAt || ""),
    paymentConfirmedBy: String(cur.paymentConfirmedBy || ""),
    paymentNote: String(cur.paymentNote || ""),

    createdAt,
    updatedAt: nowIso
  });

  b_appendBillingLog_({
    actionType: "FILE_UPLOAD",
    target: "monthlyReport",
    projectId,
    ym,
    cycleId,
    beforeValue: JSON.stringify({ monthlyReportFileId: String(cur.monthlyReportFileId || ""), monthlyReportUrl: String(cur.monthlyReportUrl || "") }),
    afterValue: JSON.stringify({ monthlyReportFileId: saved.getId(), monthlyReportUrl: saved.getUrl(), fileName: saved.getName() }),
    reason: "monthly_report_upload",
    operatorUserId: Session.getActiveUser().getEmail(),
    operatorName: Session.getActiveUser().getEmail(),
    createdAt: new Date()
  });

  // 2) ★ここが追加：会議予定があるなら、カレンダー本文を更新してリンクを貼る
  let calUpdate = { ok:false, skipped:true, reason:"no meetingEventId" };
  try {
    const meetingEventId = String(cur.meetingEventId || "").trim();
    if (meetingEventId) {
      const block = b_buildMonthlyMeetingAmdOsBlock_(projectId, projectName, ym, saved.getUrl());
      calUpdate = b_patchCalendarEventDescription_(BILLING_CFG.HUB_CALENDAR_ID, meetingEventId, block);

      // （任意）ログも残す
      b_appendBillingLog_({
        actionType: "CALENDAR_UPDATE",
        target: "meeting_description",
        projectId,
        ym,
        cycleId,
        beforeValue: "",
        afterValue: JSON.stringify({ meetingEventId, monthlyReportUrl: saved.getUrl(), calendarResult: calUpdate }),
        reason: "attach_monthly_report_link",
        operatorUserId: Session.getActiveUser().getEmail(),
        operatorName: Session.getActiveUser().getEmail(),
        createdAt: new Date()
      });
    }
  } catch(e) {
    calUpdate = { ok:false, skipped:false, reason:String(e && (e.message || e)) };
  }

  return {
    ok:true,
    fileId: saved.getId(),
    url: saved.getUrl(),
    fileName: saved.getName(),
    calendarUpdate: calUpdate
  };
}
/**
 * BillingPage: Lite 初期データ（体感爆速用）
 * - ここでは「history/saveLog/agreement」を作らない
 */
function api_getBillingPageDataLite(projectId, ym) {
  const prof = b_profStart_();
  b_profMark_(prof, "start");

  projectId = String(projectId || "").trim();
  ym = b_normYm_(ym);

  if (!projectId) throw new Error("api_getBillingPageDataLite: projectId empty");
  if (!ym) throw new Error("api_getBillingPageDataLite: ym empty");

  b_assertProjectAccess_(projectId);
  b_profMark_(prof, "access check");

  // Projects（キャッシュ）
  const projectsRows = b_cachedReadProjects_();
  b_profMark_(prof, "read DB_Projects (once)");

  const pjRow = projectsRows.find(r => String(r.projectId||"").trim() === projectId) || {};

  // PJ別：基本行テンプレ（JSON）
  const projectInvoiceBaseLinesTemplateJson =
    String(pjRow.invoiceBaseLinesTemplateJson || "").trim();

  // Members thin
  const membersRows = b_readTableThin_("DB_Members", ["memberId","codeName","email"]);
  const members = b_indexBy_(membersRows.map(r => ({
    memberId: String(r.memberId || "").trim(),
    codeName: r.codeName,
    email: r.email,
  })).filter(x => x.memberId), "memberId");
  b_profMark_(prof, "read DB_Members");

  // ProjectMembers thin
  const pmRows = b_readTableThin_("DB_ProjectMembers", ["projectId","memberId","isActive","isPM","roleLabel"]);
  const pms = pmRows
    .map(r => ({
      projectId: String(r.projectId || "").trim(),
      memberId: String(r.memberId || "").trim(),
      isActive: (r.isActive !== undefined ? r.isActive : ""),
      isPM: (r.isPM !== undefined ? r.isPM : ""),
      roleLabel: String(r.roleLabel || "").trim(),
    }))
    .filter(r => r.projectId === projectId && r.memberId)
    .filter(r => b_toBool_(r.isActive, true));
  b_profMark_(prof, "read DB_ProjectMembers");

  const memberIds = pms.map(r => r.memberId);

  // freee settings（Projectsから拾う）
  const freee = {
    partnerId: String(pjRow.freeePartnerId || "").trim(),
    partnerName: String(pjRow.freeePartnerName || "").trim(),
    templateId: String(pjRow.freeeInvoiceTemplateId || "").trim(),
  };
  b_profMark_(prof, "freee settings (from cached DB_Projects)");

  // current cycle
  const cycle = b_getCycleOne_(projectId, ym) || {};
  b_profMark_(prof, "read DB_BillingCycle (current)");

  // 立替ライブ集計（発行前だけ上書き）
  let reimbLive = { ok:false, totalYen:0, items:[] };
  try{
    reimbLive = reimburse_listApprovedForBilling({ projectId, ym }) || reimbLive;
  } catch(e){
    reimbLive = { ok:false, totalYen:0, items:[] };
  }
  const cycleInvoiceIssuedAt = String(cycle.invoiceIssuedAt || "").trim();
  const liveReimbYen = Number(reimbLive.totalYen || 0);
  const liveReimbCount = Array.isArray(reimbLive.items) ? reimbLive.items.length : 0;
  b_profMark_(prof, "reimburse live sum");

  // prev cycle
  const prevYm = b_addMonths_(ym, -1);
  const prev = b_getCycleOne_(projectId, prevYm) || {};
  b_profMark_(prof, "read DB_BillingCycle (prev)");

  const billing = {
    projectId,
    ym,
    projectName: String(cycle.projectName || b_getProjectName_(projectId) || projectId),

    budgetTotal: (cycle.budgetTotal !== undefined ? cycle.budgetTotal : ""),
    budgetYen: (cycle.budgetYen !== undefined ? cycle.budgetYen : ""),
    budgetConfirmedAt: String(cycle.budgetConfirmedAt || ""),
    budgetConfirmedBy: String(cycle.budgetConfirmedBy || ""),

    memberAllocationsJson: String(cycle.memberAllocationsJson || ""),
    allocationConfirmedAt: String(cycle.allocationConfirmedAt || ""),
    allocationConfirmedBy: String(cycle.allocationConfirmedBy || ""),

    monthlyReportFileId: String(cycle.monthlyReportFileId || ""),
    monthlyReportUrl: String(cycle.monthlyReportUrl || ""),

    meetingEventId: String(cycle.meetingEventId || ""),
    meetingStartAt: String(cycle.meetingStartAt || ""),
    meetingEndAt: String(cycle.meetingEndAt || ""),
    meetingHtmlLink: String(cycle.meetingHtmlLink || ""),

    fixedTotalYen: Number(cycle.fixedTotalYen || 0),

    invoiceIssuedAt: String(cycle.invoiceIssuedAt || ""),
    invoiceIssuedBy: String(cycle.invoiceIssuedBy || ""),
    invoicePdfUrl: String(cycle.invoicePdfUrl || ""),

    invoiceSentAt: String(cycle.invoiceSentAt || ""),
    invoiceSentBy: String(cycle.invoiceSentBy || ""),

    invoiceReviewedAt: String(cycle.invoiceReviewedAt || ""),
    invoiceReviewedBy: String(cycle.invoiceReviewedBy || ""),

    paymentConfirmedAt: String(cycle.paymentConfirmedAt || ""),
    paymentConfirmedBy: String(cycle.paymentConfirmedBy || ""),
    paymentNote: String(cycle.paymentNote || ""),

    freeeInvoiceId: String(cycle.freeeInvoiceId || ""),
    freeeInvoiceNumber: String(cycle.freeeInvoiceNumber || ""),
    invoicePdfFileId: String(cycle.invoicePdfFileId || ""),

    // ★ここは一旦そのまま（下で強制補完する）
    invoiceBillingDate: cycle.invoiceBillingDate,
    invoicePaymentDate: cycle.invoicePaymentDate,

    invoiceReimbYen: cycleInvoiceIssuedAt ? Number(cycle.invoiceReimbYen || 0) : liveReimbYen,

    freeeInvoiceTemplateId: String(cycle.freeeInvoiceTemplateId || ""),
    invoiceCustomLinesJson: String(cycle.invoiceCustomLinesJson || ""),
    invoiceBaseLinesJson: String(cycle.invoiceBaseLinesJson || ""),

    invoiceSubject: String(cycle.invoiceSubject || ""),
    invoiceBaseLineDesc: String(cycle.invoiceBaseLineDesc || ""),
    invoiceReimbPrefix: String(cycle.invoiceReimbPrefix || ""),

    invoiceRemark: String(cycle.invoiceRemark || ""),

    adminOverrideJson: String(cycle.adminOverrideJson || ""),
    adminOverrideUpdatedAt: String(cycle.adminOverrideUpdatedAt || ""),
    adminOverrideBy: String(cycle.adminOverrideBy || ""),

    freeePartnerId: String(freee.partnerId || ""),
    freeePartnerName: String(freee.partnerName || ""),
    freeeInvoiceTemplateId: String(freee.templateId || ""),

    partnerId: String(freee.partnerId || ""),
    partnerName: String(freee.partnerName || ""),
    templateId: String(freee.templateId || ""),
  };

  // ★最重要：date input 用に必ず yyyy-MM-dd へ正規化して返す
  function toDateInput_(v){
    if (v === null || v === undefined) return "";
    const s = String(v).trim();
    if (!s) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0,10);
    try{
      const d = new Date(s);
      if (!isNaN(d.getTime())) return Utilities.formatDate(d, "Asia/Tokyo", "yyyy-MM-dd");
    }catch(e){}
    return "";
  }
  billing.invoiceBillingDate = toDateInput_(billing.invoiceBillingDate);
  billing.invoicePaymentDate = toDateInput_(billing.invoicePaymentDate);

  // payout detail（fast）
  const details = b_readPayoutDetailForProjectYm_(projectId, ym);
  b_profMark_(prof, "read DB_PayoutDetail (projectId+ym fast)");

  const byMember = b_indexBy_(details, "memberId");
  const allocSnap = b_safeJsonParse_(billing.memberAllocationsJson, {});

  const payouts = memberIds.map(mid => {
    const m = members[String(mid)] || {};
    const d = byMember[String(mid)] || {};
    const planned =
      (d.plannedYen !== undefined && d.plannedYen !== "") ? Number(d.plannedYen || 0)
      : Number(allocSnap[String(mid)] || 0);

    return {
      memberId: mid,
      codeName: String(m.codeName || mid),
      plannedYen: planned,
      fixedYen: (d.fixedYen !== undefined && d.fixedYen !== "") ? Number(d.fixedYen || 0) : 0,
    };
  });
  b_profMark_(prof, "build payouts");

  const plannedTotalYen = b_sum_(payouts.map(p => Number(p.plannedYen || 0)));
  const prevFixedTotalYen = Number(prev.fixedTotalYen || 0);

  const pmEmails = pms
    .filter(r => b_toBool_(r.isPM, false) || String(r.roleLabel || "").toUpperCase().includes("PM"))
    .map(r => String(members[String(r.memberId)]?.email || ""))
    .filter(e => e);

  function splitEmails(s){
    return String(s||"")
      .split(/[,\n;]/)
      .map(x => x.trim())
      .filter(x => x);
  }
  const invoiceRecipients = {
    toName: String(pjRow.invoiceToName || "").trim(),
    to: splitEmails(pjRow.invoiceToEmails),
    cc: splitEmails(pjRow.invoiceCcEmails),
    bcc: splitEmails(pjRow.invoiceBccEmails),
    paymentDueRule: String(pjRow.paymentDueRule || "").trim(),
    invoiceSendManual: b_toBool_(pjRow.invoiceSendManual, false),
  };
  b_profMark_(prof, "end");

  return {
    ok: true,
    billing,
    payouts,
    summary: { plannedTotalYen, prevFixedTotalYen },
    pmEmails: Array.from(new Set(pmEmails)),
    invoiceRecipients,
    projectInvoiceBaseLinesTemplateJson,
    reimbApprovedCount: liveReimbCount,
    reimbApprovedTotalYen: liveReimbYen,
    freeeSettings: {
      partnerId: String(freee.partnerId || ""),
      partnerName: String(freee.partnerName || ""),
      templateId: String(freee.templateId || ""),
    },
    profile: prof.marks,
  };
}

function api_saveInvoiceDraftTimeline(payload){
  payload = payload || {};

  const projectId = String(payload.projectId || "").trim();
  const ym = b_normYm_(payload.ym);

  if (!projectId) throw new Error("api_saveInvoiceDraftTimeline: projectId empty");
  if (!ym) throw new Error("api_saveInvoiceDraftTimeline: ym empty");

  b_assertProjectAccess_(projectId);
  b_ensureBillingCycleHeader_();

  const nowIso = b_nowIso_();
  const me = Session.getActiveUser().getEmail();

  const cur = b_getCycleOne_(projectId, ym) || {};
  const cycleId = `${projectId}_${ym}`;
  const createdAt = String(cur.createdAt || "") || nowIso;
  const projectName = String(cur.projectName || b_getProjectName_(projectId) || projectId);

  // 受け取るもの（文字列として保存）
  const invoiceBaseLinesJson = String(payload.invoiceBaseLinesJson || "").trim();
  const invoiceCustomLinesJson = String(payload.invoiceCustomLinesJson || "").trim();
  const invoiceReimbPrefix = String(payload.invoiceReimbPrefix || "").trim();
  const invoiceSubject = String(payload.invoiceSubject || "").trim();
  const invoiceRemark = String(payload.invoiceRemark || "").trim();
  const invoiceBillingDate = String(payload.invoiceBillingDate || "").trim();
  const invoicePaymentDate = String(payload.invoicePaymentDate || "").trim();

  // ★他の列を壊さない：既存を全部引き継いで upsert
  b_upsertRow_("DB_BillingCycle", ["projectId","ym"], {
    ...cur,
    cycleId,
    projectId,
    ym,
    projectName,

    invoiceBaseLinesJson: invoiceBaseLinesJson,
    invoiceCustomLinesJson: invoiceCustomLinesJson,
    invoiceReimbPrefix: invoiceReimbPrefix,
    invoiceSubject: invoiceSubject,
    invoiceRemark: invoiceRemark,
    invoiceBillingDate: invoiceBillingDate,
    invoicePaymentDate: invoicePaymentDate,

    updatedAt: nowIso,
    createdAt: createdAt,
  });

  // ログ（任意）
  try{
    b_appendBillingLog_({
      actionType: "INVOICE_DRAFT_SAVE",
      target: "invoiceDraft",
      projectId,
      ym,
      cycleId,
      beforeValue: JSON.stringify({
        invoiceBaseLinesJson: String(cur.invoiceBaseLinesJson || ""),
        invoiceCustomLinesJson: String(cur.invoiceCustomLinesJson || ""),
        invoiceReimbPrefix: String(cur.invoiceReimbPrefix || ""),
        invoiceSubject: String(cur.invoiceSubject || ""),
        invoiceRemark: String(cur.invoiceRemark || ""),
        invoiceBillingDate: String(cur.invoiceBillingDate || ""),
        invoicePaymentDate: String(cur.invoicePaymentDate || "")
      }),
      afterValue: JSON.stringify({
        invoiceBaseLinesJson,
        invoiceCustomLinesJson,
        invoiceReimbPrefix,
        invoiceSubject,
        invoiceRemark,
        invoiceBillingDate,
        invoicePaymentDate
      }),
      reason: "timeline_invoice_draft_save",
      operatorUserId: me,
      operatorName: me,
      createdAt: new Date(),
    });
  }catch(e){}

  return { ok:true, updatedAt: nowIso };
}

function b_toDateInput_(v){
  const s = String(v ?? "").trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0,10);

  try{
    const d = new Date(s);
    if (!isNaN(d.getTime())){
      return Utilities.formatDate(d, "Asia/Tokyo", "yyyy-MM-dd");
    }
  }catch(e){}
  return "";
}

/**
 * BillingPage: Extras（重い部分は後から）
 */
function api_getBillingPageExtras(projectId, ym) {
  const prof = b_profStart_();
  b_profMark_(prof, "start");

  projectId = String(projectId || "").trim();
  ym = b_normYm_(ym);

  if (!projectId) throw new Error("api_getBillingPageExtras: projectId empty");
  if (!ym) throw new Error("api_getBillingPageExtras: ym empty");

  b_assertProjectAccess_(projectId);
  b_profMark_(prof, "access check");

  // memberIds を作る（agreement/historyに必要）
  const pmRows = b_readTableThin_("DB_ProjectMembers", ["projectId","memberId","isActive"]);
  const memberIds = pmRows
    .map(r => ({
      projectId: String(r.projectId || "").trim(),
      memberId: String(r.memberId || "").trim(),
      isActive: (r.isActive !== undefined ? r.isActive : ""),
    }))
    .filter(r => r.projectId === projectId && r.memberId)
    .filter(r => b_toBool_(r.isActive, true))
    .map(r => r.memberId);

  b_profMark_(prof, "read DB_ProjectMembers (thin) for extras");

  const agreement = b_getAgreementStatus_(projectId, ym, memberIds);
  b_profMark_(prof, "agreement status");

  const history = b_buildBudgetAndPayoutHistory_(projectId, memberIds, 6);
  b_profMark_(prof, "history (last 6)");

  const saveLog = b_buildSaveLog_(projectId, 10);
  b_profMark_(prof, "saveLog (last 10)");

  b_profMark_(prof, "end");

  return {
    ok: true,
    agreement,
    history,
    saveLog,
    profile: prof.marks,
  };
}

function api_getReimburseBillingGuard(projectId, ym){
  projectId = String(projectId || "").trim();
  ym = b_normYm_(ym);
  if (!projectId) throw new Error("api_getReimburseBillingGuard: projectId empty");
  if (!ym) throw new Error("api_getReimburseBillingGuard: ym empty");

  b_assertProjectAccess_(projectId);

  const pack = reimburse_listApprovedForBilling({ projectId, ym }) || { items:[], totalYen:0 };
  const items = (pack && Array.isArray(pack.items)) ? pack.items : [];
  const totalIncl = Number(pack && pack.totalYen ? pack.totalYen : 0);
  const count = items.length;

  // ★依存なしで税抜計算（freee: tax_fraction:"omit" と揃えて切り捨て）
  function calcExcl_(amountIncl, rate){
    const amt = Number(amountIncl || 0);
    const r = Number(rate || 0);
    if (!amt) return 0;
    if (!r || r <= 0) return amt;
    return Math.floor(amt / (1 + r));
  }
  function pickRate_(it){
    // 無ければ 10%
    if (it && it.taxRate !== undefined && it.taxRate !== null && String(it.taxRate).trim() !== "") return Number(it.taxRate);
    if (it && it.tax_rate !== undefined && it.tax_rate !== null && String(it.tax_rate).trim() !== "") return Number(it.tax_rate);
    if (it && it.taxPercent !== undefined && it.taxPercent !== null && String(it.taxPercent).trim() !== "") return Number(it.taxPercent) / 100;
    return 0.10;
  }

  let totalExcl = 0;
  items.forEach(it => {
    const amtIncl = Number(it && it.amount ? it.amount : 0);
    totalExcl += calcExcl_(amtIncl, pickRate_(it));
  });

  return {
    ok:true,
    reimbApprovedCount: count,

    // 互換：これまで通り（税込）も返す
    reimbApprovedTotalYen: totalIncl,

    // ★Billing側で税抜表示するための値
    reimbApprovedTotalYenExclTax: totalExcl,
    reimbApprovedTotalYenInclTax: totalIncl
  };
}

function api_getReimburseApprovedItemsForInvoice(projectId, ym){
  projectId = String(projectId || "").trim();
  ym = b_normYm_(ym);
  if (!projectId) throw new Error("api_getReimburseApprovedItemsForInvoice: projectId empty");
  if (!ym) throw new Error("api_getReimburseApprovedItemsForInvoice: ym empty");

  b_assertProjectAccess_(projectId);

  const pack = reimburse_listApprovedForBilling({ projectId, ym }) || { items:[], totalYen:0 };
  const rawItems = (pack && Array.isArray(pack.items)) ? pack.items : [];
  const totalIncl = Number(pack && pack.totalYen ? pack.totalYen : 0);

  function calcExcl_(amountIncl, rate){
    const amt = Number(amountIncl || 0);
    const r = Number(rate || 0);
    if (!amt) return 0;
    if (!r || r <= 0) return amt;
    return Math.floor(amt / (1 + r));
  }
  function pickRate_(it){
    if (it && it.taxRate !== undefined && it.taxRate !== null && String(it.taxRate).trim() !== "") return Number(it.taxRate);
    if (it && it.tax_rate !== undefined && it.tax_rate !== null && String(it.tax_rate).trim() !== "") return Number(it.tax_rate);
    if (it && it.taxPercent !== undefined && it.taxPercent !== null && String(it.taxPercent).trim() !== "") return Number(it.taxPercent) / 100;
    return 0.10;
  }

  const items = rawItems.map(it => {
    const amtIncl = Number(it && it.amount ? it.amount : 0);
    const rate = pickRate_(it);
    const amtExcl = calcExcl_(amtIncl, rate);

    return {
      ...it,
      amountInclTax: amtIncl,
      amountExclTax: amtExcl,
      taxRateUsed: rate
    };
  });

  const totalExcl = items.reduce((s, it) => s + Number(it.amountExclTax || 0), 0);

  return {
    ok:true,
    items,

    // 互換：従来のまま（税込）
    totalYen: totalIncl,

    totalYenInclTax: totalIncl,
    totalYenExclTax: totalExcl
  };
}

function api_admin_setRoutineOverride(payload){
  payload = payload || {};

  if (!isAdmin_()) {
    return { ok:false, message:"admin only" };
  }

  const projectId = String(payload.projectId || "").trim();
  const ym = b_normYm_(payload.ym);
  const taskKey = String(payload.taskKey || "").trim();
  const done = !!payload.done;

  if (!projectId) return { ok:false, message:"projectId empty" };
  if (!ym) return { ok:false, message:"ym empty" };
  if (!taskKey) return { ok:false, message:"taskKey empty" };

  // adminでもPJの存在チェックは通す（変なIDで汚さない）
  b_assertProjectAccess_(projectId);

  b_ensureBillingCycleHeader_();

  const nowIso = b_nowIso_();
  const cycleId = `${projectId}_${ym}`;

  const cur = b_getCycleOne_(projectId, ym) || {};
  const projectName = String(cur.projectName || b_getProjectName_(projectId) || projectId);
  const createdAt = String(cur.createdAt || "") || nowIso;

  const beforeJson = String(cur.adminOverrideJson || "").trim();
  let ov = {};
  try{ ov = beforeJson ? JSON.parse(beforeJson) : {}; }catch(e){ ov = {}; }
  if (!ov || typeof ov !== "object") ov = {};

  ov[taskKey] = done;

  const afterJson = JSON.stringify(ov);

  // ★他の列を壊さないため、既存値を全部引き継いで upsert
  b_upsertRow_("DB_BillingCycle", ["projectId","ym"], {
    cycleId,
    projectId,
    ym,
    projectName,

    budgetTotal: (cur.budgetTotal !== undefined ? cur.budgetTotal : ""),
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

    paymentConfirmedAt: String(cur.paymentConfirmedAt || ""),
    paymentConfirmedBy: String(cur.paymentConfirmedBy || ""),
    paymentNote: String(cur.paymentNote || ""),

    freeeInvoiceId: String(cur.freeeInvoiceId || ""),
    freeeInvoiceNumber: String(cur.freeeInvoiceNumber || ""),
    invoicePdfFileId: String(cur.invoicePdfFileId || ""),

    // ★override
    adminOverrideJson: afterJson,
    adminOverrideUpdatedAt: nowIso,
    adminOverrideBy: Session.getActiveUser().getEmail(),

    createdAt,
    updatedAt: nowIso,
  });

  b_appendBillingLog_({
    actionType: "ADMIN_OVERRIDE",
    target: "adminOverrideJson",
    projectId,
    ym,
    cycleId,
    beforeValue: beforeJson,
    afterValue: afterJson,
    reason: `toggle:${taskKey}`,
    operatorUserId: Session.getActiveUser().getEmail(),
    operatorName: Session.getActiveUser().getEmail(),
    createdAt: new Date()
  });

  return { ok:true, projectId, ym, taskKey, done, adminOverrideJson: afterJson, updatedAt: nowIso };
}

function api_admin_listFreeeInvoiceTemplates(payload){
  payload = payload || {};
  if (!isAdmin_()) return { ok:false, message:"admin only", templates:[] };

  const projectId = String(payload.projectId || "").trim();
  if (!projectId) return { ok:false, message:"projectId empty", templates:[] };

  // 既存のfreee連携の中で「テンプレ一覧」を返す関数をここに刺す
  // 期待フォーマット：[{id:"1733733", name:"請求書PayPay"}, ...]
  // ★ここだけ、既存関数名に合わせて差し替えて
  const templates = (function(){
    if (typeof freee_listInvoiceTemplatesForSelect === "function"){
      return freee_listInvoiceTemplatesForSelect();
    }
    return [];
  })();

  return { ok:true, templates: Array.isArray(templates) ? templates : [] };
}

function api_admin_setProjectFreeeInvoiceTemplateId(payload){
  payload = payload || {};
  if (!isAdmin_()) return { ok:false, message:"admin only" };

  const projectId = String(payload.projectId || "").trim();
  const templateId = String(payload.templateId || "").trim();
  if (!projectId) return { ok:false, message:"projectId empty" };
  if (!templateId) return { ok:false, message:"templateId empty" };

  // DB_Projects の列を保証
  b_ensureHeader_("DB_Projects", ["freeeInvoiceTemplateId"]);

  // projectId で upsert
  b_upsertRow_("DB_Projects", ["projectId"], {
    projectId,
    freeeInvoiceTemplateId: templateId,
    updatedAt: b_nowIso_(),
  });

  return { ok:true, projectId, templateId };
}

function api_getReimburseBillingPack(projectId, ym){
  projectId = String(projectId || "").trim();
  ym = b_normYm_(ym);
  if (!projectId) throw new Error("api_getReimburseBillingPack: projectId empty");
  if (!ym) throw new Error("api_getReimburseBillingPack: ym empty");

  b_assertProjectAccess_(projectId);

  // 1) 承認済み（2重承認）一覧
  const pack = reimburse_listApprovedForBilling({ projectId, ym }) || { items:[], totalYen:0 };
  const rawItems = (pack && Array.isArray(pack.items)) ? pack.items : [];
  const totalIncl = Number(pack && pack.totalYen ? pack.totalYen : 0);

  // 2) 承認待ち数（0件でもOK）
  let pendingCount = 0;
  try{
    const p = reimburse_countPendingForBillingGuard({ projectId, ym });
    if (p && p.ok) pendingCount = Number(p.pendingCount || 0);
  }catch(e){
    pendingCount = 0;
  }

  // 3) 税抜計算（freee: tax_fraction omit と揃えて切り捨て）
  function calcExcl(amountIncl, rate){
    const amt = Number(amountIncl || 0);
    const r = Number(rate || 0);
    if (!amt) return 0;
    if (!r || r <= 0) return amt;
    return Math.floor(amt / (1 + r));
  }
  function pickRate(it){
    if (it && it.taxRate !== undefined && it.taxRate !== null && String(it.taxRate).trim() !== "") return Number(it.taxRate);
    if (it && it.tax_rate !== undefined && it.tax_rate !== null && String(it.tax_rate).trim() !== "") return Number(it.tax_rate);
    if (it && it.taxPercent !== undefined && it.taxPercent !== null && String(it.taxPercent).trim() !== "") return Number(it.taxPercent) / 100;
    return 0.10;
  }

  const items = rawItems.map(it => {
    const amtIncl = Number(it && it.amount ? it.amount : 0);
    const rate = pickRate(it);
    const amtExcl = calcExcl(amtIncl, rate);
    return {
      ...it,
      amountInclTax: amtIncl,
      amountExclTax: amtExcl,
      taxRateUsed: rate
    };
  });

  const totalExcl = items.reduce((s, it) => s + Number(it.amountExclTax || 0), 0);

  return {
    ok:true,
    pendingCount,
    approvedCount: items.length,
    totalYenInclTax: totalIncl,
    totalYenExclTax: totalExcl,
    items
  };
}

function api_markInvoiceSentManual(projectId, ym){
  projectId = String(projectId || "").trim();
  ym = b_normYm_(ym);

  if (!projectId) throw new Error("api_markInvoiceSentManual: projectId empty");
  if (!ym) throw new Error("api_markInvoiceSentManual: ym empty");

  b_assertProjectAccess_(projectId);
  b_ensureBillingCycleHeader_();

  const nowIso = b_nowIso_();
  const me = Session.getActiveUser().getEmail();

  const cur = b_getCycleOne_(projectId, ym) || {};
  const createdAt = String(cur.createdAt || "") || nowIso;
  const cycleId = `${projectId}_${ym}`;
  const projectName = String(cur.projectName || b_getProjectName_(projectId) || projectId);

  // 送付済みなら二重に書かない（安全）
  if (String(cur.invoiceSentAt || "").trim()){
    return { ok:true, already:true, invoiceSentAt: String(cur.invoiceSentAt || "") };
  }

  b_upsertRow_("DB_BillingCycle", ["projectId","ym"], {
    ...cur,
    cycleId,
    projectId,
    ym,
    projectName,

    invoiceSentAt: nowIso,
    invoiceSentBy: me,

    createdAt,
    updatedAt: nowIso
  });

  // ログ（任意：あるなら）
  try{
    b_appendBillingLog_({
      actionType: "INVOICE_SENT_MANUAL",
      target: "invoiceSentAt",
      projectId,
      ym,
      cycleId,
      beforeValue: JSON.stringify({ invoiceSentAt: String(cur.invoiceSentAt || ""), invoiceSentBy: String(cur.invoiceSentBy || "") }),
      afterValue: JSON.stringify({ invoiceSentAt: nowIso, invoiceSentBy: me }),
      reason: "manual_invoice_send_mark",
      operatorUserId: me,
      operatorName: me,
      createdAt: new Date(),
    });
  } catch(e){}

  return { ok:true, invoiceSentAt: nowIso };
}
