// “freee請求書を作る→PDF保存→DB反映”の業務フロー。
/**
 * B_FreeeInvoiceFlow.gs
 *
 * 目的：
 * freee請求書発行の業務フローを集約する（ドラフト保存→発行→PDF保存→DB反映→必要通知）。
 * freee Core / PDF保存 / BillingDomain を束ねる“アプリケーション層”として動く。
 *
 * このファイルが担当するもの：
 * - api_issueInvoiceFreee（発行本体）
 * - マスタ取得（partners/templates）
 * - ドラフト保存（請求日/期日/立替/自由明細）
 * - 取消フロー（トークン→完了でリセット）
 * - デバッグ用（必要最小限）
 *
 * ルール：
 * - freee通信は B_FreeeCore.gs 経由、PDF保存は B_FreeeInvoicePdf.gs 経由に統一する。
 * - DB反映は BillingDomain/Sheets の Upsert を使い、状態項目の整合性を崩さない。
 * - “再発行時はレビュー/送付をリセット”など事故防止ルールをここに固定する。
 */

function api_issueInvoiceFreee(projectId, ym, payload) {
  projectId = String(projectId || "").trim();
  ym = b_normYm_(ym);
  payload = payload || {};

  if (!projectId) throw new Error("api_issueInvoiceFreee: projectId empty");
  if (!ym) throw new Error("api_issueInvoiceFreee: ym empty");

  b_assertProjectAccess_(projectId);
  b_ensureHeader_("DB_BillingCycle", [
    "invoiceSubject",
    "invoiceBaseLineDesc",
    "invoiceBaseLinesJson",
    "invoiceReimbPrefix",
    "invoiceRemark",
    "invoiceCustomLinesJson",
  ]);

  const nowIso = b_nowIso_();
  const cur = b_getCycleOne_(projectId, ym) || {};
  const createdAt = String(cur.createdAt || "") || nowIso;

  // 日付（必須）
  const billingDate = String(payload.issueDate || "").trim(); // freee billing_date
  const paymentDate = String(payload.dueDate || "").trim();   // freee payment_date
  if (!billingDate || !paymentDate) {
    throw new Error("請求日（billing_date）と期日（payment_date）が必要");
  }

  // 来月予算（65%）＝配賦原資
  const budget65 =
    (cur.budgetTotal !== undefined && String(cur.budgetTotal).trim() !== "")
      ? Number(cur.budgetTotal || 0)
      : Number(cur.budgetYen || 0);

  if (!budget65 || budget65 <= 0) {
    throw new Error("来月予算（65%）が0。まず「予算」を確定してね");
  }

  // 請求額（税抜・立替費抜き）＝ budget/0.65
  const gross = Math.round(budget65 / 0.65);

  // 立替費（任意）: サーバ集計が唯一の正
  var reimbPack = { ok:true, items:[], totalYen:0 };
  try {
    reimbPack = reimburse_listApprovedForBilling({ projectId: projectId, ym: ym });
  } catch(e) {
    reimbPack = { ok:false, message:String(e && (e.message || e)) };
  }
  if (reimbPack && reimbPack.ok === false) {
    throw new Error("立替集計に失敗: " + String(reimbPack.message || ""));
  }

  const reimbYen = Number((reimbPack && reimbPack.totalYen) ? reimbPack.totalYen : 0);
  const reimbIds = (reimbPack && Array.isArray(reimbPack.items))
    ? reimbPack.items.map(x => String(x.reimbursementId||"").trim()).filter(x=>x)
    : [];

  const projectName = String(cur.projectName || b_getProjectName_(projectId) || projectId);

  const companyId = b_freeeCompanyId_();
  const settings = b_getFreeeProjectSettings_(projectId);

  const partnerId = String(settings.partnerId || "").trim();
  const templateId = String(payload.templateId || settings.templateId || "").trim();

  if (!partnerId) throw new Error("freeePartnerId が未設定。クライアント確定→partner確定してね");
  if (!templateId) throw new Error("templateId が空。テンプレを選んでね");

  // ============================================================
  // ★文言：UI→payload→cycle→フォールバック の順で拾う
  // ============================================================
  const invoiceSubject =
    String(payload.invoiceSubject || payload.subject || cur.invoiceSubject || "").trim();

  // ============================================================
  // ★基本行（複数行対応）：payload→cycle(json)→旧フィールド
  // ============================================================
  let baseLines = Array.isArray(payload.invoiceBaseLines) ? payload.invoiceBaseLines : [];
  baseLines = baseLines
    .map(x => ({
      description: String(x.description || "").trim(),
      quantity: Math.max(1, Number(x.quantity || 1)),
      unit_price: Math.max(0, Number(x.unit_price || 0)),
    }))
    .filter(x => x.description);

  if (!baseLines.length){
    try{
      const raw = String(cur.invoiceBaseLinesJson || "").trim();
      const arr = raw ? JSON.parse(raw) : [];
      if (Array.isArray(arr)){
        baseLines = arr
          .map(x => ({
            description: String(x.description || "").trim(),
            quantity: Math.max(1, Number(x.quantity || 1)),
            unit_price: Math.max(0, Number(x.unit_price || 0)),
          }))
          .filter(x => x.description);
      }
    }catch(e){}
  }

  const legacy =
    String(payload.invoiceBaseLineDesc || payload.description || cur.invoiceBaseLineDesc || "").trim()
    || `業務委託費（${ym}分）`;

  if (!baseLines.length){
    // ★最後の砦：最低1行は作る
    baseLines = [{ description: legacy, quantity: 1, unit_price: 0 }];
  }

  // ★0円請求書の根絶：基本行合計が0なら gross を必ず入れる
  const sumBase = baseLines.reduce((s, x) => s + (Number(x.unit_price || 0) * Number(x.quantity || 1)), 0);
  if (!sumBase || sumBase <= 0) {
    baseLines = [{
      description: String(baseLines[0].description || legacy).trim() || legacy,
      quantity: 1,
      unit_price: Math.max(0, Number(gross || 0)),
    }];
  }

  // 互換のため残す（ログ/返却用）
  const baseDesc = String(baseLines[0]?.description || "").trim() || legacy;

  const reimbPrefix =
    String(payload.invoiceReimbPrefix || cur.invoiceReimbPrefix || "").trim();

  // ★備考：UI→payload→cycle の順で拾う
  const invoiceRemark =
    String(payload.invoiceRemark || cur.invoiceRemark || "").trim();

  // freeeの件名
  const subject =
    invoiceSubject
      ? invoiceSubject
      : `${projectName} ${baseDesc}`;

  const body = {
    company_id: Number(companyId),
    template_id: Number(templateId),
    partner_id: Number(partnerId),
    partner_title: "御中",
    subject: subject,
    billing_date: billingDate,
    payment_date: paymentDate,
    tax_entry_method: "out",
    tax_fraction: "omit",
    withholding_tax_entry_method: "out",
    lines: baseLines.map(x => ({
      type: "item",
      description: String(x.description || "").trim() || "（業務委託費）",
      quantity: Number(x.quantity || 1),
      unit_price: String(Number(x.unit_price || 0)),
      tax_rate: 10,
      reduced_tax_rate: false,
      withholding: false,
    })),
    invoice_note: invoiceRemark,
  };

  // ★立替は明細行で積む
  if (reimbYen > 0 && Array.isArray(reimbPack.items) && reimbPack.items.length) {
    reimbPack.items.forEach(it => {
      const d = String(it.date || "").trim().replace(/^\d{4}-/, "").replace(/-/g, "/");
      const cat = String(it.categoryLabel || it.category || "").trim();
      const desc = String(it.desc || "").trim();

      // 交通費：構造化データから明細テキストを組み立てる
      const tFrom = String(it.transportFrom || "").trim();
      const tTo = String(it.transportTo || "").trim();
      const tMode = String(it.transportMode || "").trim();
      const tTrip = String(it.transportTrip || "").trim();

      const modeLabel = { train:"電車", bus:"バス", taxi:"タクシー", car:"自家用車" }[tMode] || tMode;
      const tripLabel = (tTrip === "round") ? "往復" : "";

      const amtIncl = Number(it.amount || 0);

      let rate = 0.10;
      if (it && it.taxRate !== undefined && it.taxRate !== null && String(it.taxRate).trim() !== "") {
        rate = Number(it.taxRate);
      } else if (it && it.tax_rate !== undefined && it.tax_rate !== null && String(it.tax_rate).trim() !== "") {
        rate = Number(it.tax_rate);
      } else if (it && it.taxPercent !== undefined && it.taxPercent !== null && String(it.taxPercent).trim() !== "") {
        rate = Number(it.taxPercent) / 100;
      }

      const amtExcl = b_calcAmountExclTax(amtIncl, rate);

      const head = reimbPrefix ? reimbPrefix : "[立替]";
      let lineDesc;
      if (cat === "交通費" && tFrom && tTo) {
        const route = `${tFrom}→${tTo}`;
        const detail = [modeLabel, tripLabel].filter(x => x).join("・");
        lineDesc = `${head} ${d} ${route}${detail ? "（" + detail + "）" : ""} ${desc}`.trim();
      } else {
        lineDesc = `${head} ${d} ${cat} ${desc}`.trim();
      }

      body.lines.push({
        type: "item",
        description: lineDesc || head,
        quantity: 1,
        unit_price: String(amtExcl),
        tax_rate: 10,
        reduced_tax_rate: false,
        withholding: false,
      });
    });
  }

  // ★任意の請求明細（値引き/調整など）
  // ルール：description が空の行は「存在しない」扱い
  const extraLines = Array.isArray(payload.lines) ? payload.lines : [];
  extraLines.forEach(x => {
    const desc = String(x.description || "").trim();
    if (!desc) return;

    const qtyRaw = Number(x.quantity || 0);
    const qty = (qtyRaw > 0) ? qtyRaw : 1;

    const unit = Number(x.unit_price || 0);

    body.lines.push({
      type: "item",
      description: desc,
      quantity: qty,
      unit_price: String(unit),
      tax_rate: 10,
      reduced_tax_rate: false,
      withholding: false,
    });
  });

  // ★最後の安全弁：合計が0なら発行を止める
  const totalBody = (body.lines || []).reduce((s, x) => s + (Number(x.unit_price || 0) * Number(x.quantity || 1)), 0);
  if (!totalBody || totalBody <= 0) {
    throw new Error("請求金額が0になってる。基本行/調整行の入力か、BillingCycleの明細保存を確認してね");
  }

  // 1) 作成
  const created = b_freeeRequestIvJson_("post", "/invoices", null, body);

  const freeeInvoiceId =
    String(created.id || created.invoice_id || (created.invoice && created.invoice.id) || "").trim();
  if (!freeeInvoiceId) throw new Error("freee invoice created but id missing: " + JSON.stringify(created));

  // 2) 明細GET（番号とURL）
  let got = {};
  let pdfUrl = "";
  let freeeInvoiceNumber = "";

  for (let i = 0; i < 6; i++) {
    try {
      got = b_freeeRequestIvJson_(
        "get",
        `/invoices/${encodeURIComponent(freeeInvoiceId)}`,
        { company_id: b_freeeCompanyId_() },
        null
      );
    } catch (e) {
      got = {};
    }

    freeeInvoiceNumber = String(got.invoice_number || got.number || "").trim();
    pdfUrl = String(
      got.invoice_file_url ||
      got.pdf_url ||
      got.file_url ||
      got.invoice_url ||
      got.invoicePdfUrl ||
      got.invoice_pdf_url ||
      ""
    ).trim();

    if (pdfUrl) break;
    Utilities.sleep(2000);
  }

  // 3) PDFをDriveに保存
  const baseName = `請求書_${projectId}_${ym}_${freeeInvoiceId}`;
  const savedPdf = b_saveInvoicePdfToDrive_(freeeInvoiceId, pdfUrl, baseName);

  const me = Session.getActiveUser().getEmail();
  const cycleId = `${projectId}_${ym}`;

  // 4) DB反映（文言も保存）
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

    invoiceIssuedAt: nowIso,
    invoiceIssuedBy: me,

    invoicePdfUrl: savedPdf.ok ? savedPdf.fileUrl : "",

    freeeInvoiceId: freeeInvoiceId,
    freeeInvoiceNumber: freeeInvoiceNumber,
    invoiceReimbYen: reimbYen,
    invoiceCustomLinesJson: JSON.stringify(Array.isArray(payload.lines) ? payload.lines : []),
    freeeInvoiceTemplateId: String(templateId || ""),

    invoicePdfFileId: savedPdf.ok ? savedPdf.fileId : String(cur.invoicePdfFileId || ""),

    // ★文言保存
    invoiceSubject: invoiceSubject,
    invoiceBaseLineDesc: baseDesc,
    invoiceBaseLinesJson: JSON.stringify(baseLines),
    invoiceReimbPrefix: reimbPrefix,

    // ★備考保存
    invoiceRemark: invoiceRemark,

    // ★再発行したらレビュー/送付は必ずリセット
    invoiceReviewedAt: "",
    invoiceReviewedBy: "",
    invoiceSentAt: "",
    invoiceSentBy: "",

    paymentConfirmedAt: String(cur.paymentConfirmedAt || ""),
    paymentConfirmedBy: String(cur.paymentConfirmedBy || ""),
    paymentNote: String(cur.paymentNote || ""),

    createdAt,
    updatedAt: nowIso
  });

  // ★立替を請求済みにマーキング（二重計上防止）
  try {
    if (reimbYen > 0 && reimbIds.length) {
      reimburse_markBilled({
        reimbursementIds: reimbIds,
        ym: ym,
        billingCycleId: cycleId
      });
    }
  } catch(e) {}

  b_appendBillingLog_({
    actionType: "FREEE_INVOICE_CREATE",
    target: "invoice",
    projectId,
    ym,
    cycleId,
    beforeValue: JSON.stringify({ freeeInvoiceId: String(cur.freeeInvoiceId || ""), invoicePdfUrl: String(cur.invoicePdfUrl || "") }),
    afterValue: JSON.stringify({ freeeInvoiceId, freeeInvoiceNumber, gross, reimbYen, pdfUrl, savedPdf, subject, baseDesc, reimbPrefix }),
    reason: "freee_invoice_create",
    operatorUserId: me,
    operatorName: me,
    createdAt: b_nowIso_()
  });

  // ★発行完了をPJチャンネルへ通知
  try{
    const baseUrl2 = String(PropertiesService.getScriptProperties().getProperty("WEBAPP_BASE_URL") || "").trim();
    if (!baseUrl2) throw new Error("WEBAPP_BASE_URL is not set");

    const ymForUi = encodeURIComponent(String(ym).slice(0,4) + "-" + String(ym).slice(4,6));
    const uploadUrl =
      `${baseUrl2}?page=billing&projectId=${encodeURIComponent(projectId)}&ym=${ymForUi}&focus=invoiceUpload`;

    slackNotifyPostInvoiceIssued({
      projectId,
      ym,
      projectName,
      freeeInvoiceNumber,
      freeeInvoiceId,
      gross,
      reimbYen,
      uploadUrl
    });
  } catch(e) {}

  // ★PDFがAPIで取れない前提：マネージャーへアップロード依頼
  try {
    b_notifyManagersToUploadInvoicePdf_(projectId, ym, {
      freeeInvoiceId,
      freeeInvoiceNumber,
      billingDate,
      paymentDate,
      projectName,
      partnerName: String(settings.partnerName || ""),
      folderId: b_freeeInvoiceFolderId_(),
      gross: gross,
      reimbYen: reimbYen,
      totalYen: gross + reimbYen,
      extraLines: Array.isArray(payload.lines) ? payload.lines : []
    });
  } catch(e) {}

  // Slackログは現状維持
  const slackPayload = {
    projectId,
    ym,
    projectName,
    freeeInvoiceNumber,
    freeeInvoiceId,
    invoicePdfUrl: (savedPdf && savedPdf.ok) ? String(savedPdf.fileUrl || "") : "",
    gross,
    reimbYen
  };

  b_appendBillingLog_({
    actionType: "SLACK_NOTIFY_INVOICE_ISSUED_START",
    target: "slack",
    projectId,
    ym,
    cycleId,
    beforeValue: "",
    afterValue: JSON.stringify(slackPayload),
    reason: "slack_notify_invoice_issued_start",
    operatorUserId: me,
    operatorName: me,
    createdAt: b_nowIso_()
  });

  let slackRes = null;
  try {
    slackRes = slackNotifyPostInvoiceIssued(slackPayload);
  } catch(e) {
    slackRes = { ok:false, message:String(e && (e.message || e)) };
  }

  b_appendBillingLog_({
    actionType: "SLACK_NOTIFY_INVOICE_ISSUED",
    target: "slack",
    projectId,
    ym,
    cycleId,
    beforeValue: "",
    afterValue: JSON.stringify(slackRes),
    reason: "slack_notify_invoice_issued",
    operatorUserId: me,
    operatorName: me,
    createdAt: b_nowIso_()
  });

  return {
    ok: true,
    freeeInvoiceId,
    freeeInvoiceNumber,
    invoicePdfUrl: savedPdf.ok ? savedPdf.fileUrl : "",
    pdfDriveFileId: savedPdf.ok ? savedPdf.fileId : "",
    pdfOriginalUrl: pdfUrl,
    pdfSaveOk: !!savedPdf.ok,
    pdfSaveMessage: String(savedPdf.message || ""),
    gross,
    reimbYen,
    billingDate,
    paymentDate,

    // ★返す（UI反映用）
    invoiceSubject,
    invoiceBaseLineDesc: baseDesc,
    invoiceReimbPrefix: reimbPrefix,
    invoiceRemark
  };
}

/**
 * 請求書発行の「依頼」（PM→admin）
 * - freee発行はしない
 * - DB_BillingCycle に依頼情報を保存する
 * - admin（きよ/まさ）へ通知する（notifyChannel=slackならDM）
 *
 * payload: { note?: string }
 */
function api_requestInvoiceIssue(projectId, ym, payload){
  projectId = String(projectId || "").trim();
  ym = b_normYm_(ym);
  payload = payload || {};

  if (!projectId) throw new Error("api_requestInvoiceIssue: projectId empty");
  if (!ym) throw new Error("api_requestInvoiceIssue: ym empty");

  b_assertProjectAccess_(projectId);
  b_ensureBillingCycleHeader_();

  // 追加列（無ければ追加）
  b_ensureHeader_("DB_BillingCycle", [
    "invoiceBillingDate",
    "invoicePaymentDate",
    "invoiceReimbYen",
    "freeeInvoiceTemplateId",
    "invoiceCustomLinesJson",

    // ★追加：文言
    "invoiceSubject",
    "invoiceBaseLineDesc",
    "invoiceBaseLinesJson",
    "invoiceReimbPrefix",

    // ★追加：備考（内訳など）
    "invoiceRemark"
  ]);

  const nowIso = b_nowIso_();
  const me = (Session.getActiveUser().getEmail() || "").trim().toLowerCase();
  const cur = b_getCycleOne_(projectId, ym) || {};
  const createdAt = String(cur.createdAt || "") || nowIso;
  const cycleId = `${projectId}_${ym}`;
  const projectName = String(cur.projectName || b_getProjectName_(projectId) || projectId);

  const note = String(payload.note || "").trim();

    // ★PJ別テンプレを更新（毎月同じ書き方なら、ここが最短）
  try{
    if (typeof normalizedBaseLines !== "undefined" && Array.isArray(normalizedBaseLines) && normalizedBaseLines.length){
      // DB_Projects は projectId がキー
      b_upsertRow_("DB_Projects", ["projectId"], {
        projectId: projectId,
        invoiceBaseLinesTemplateJson: JSON.stringify(normalizedBaseLines),
        updatedAt: nowIso
      });
    }
  } catch(e) {}

  // 依頼情報だけ更新（他は壊さない）
  b_upsertRow_("DB_BillingCycle", ["projectId","ym"], {
    ...cur,
    cycleId,
    projectId,
    ym,
    projectName,
    invoiceIssueRequestedAt: nowIso,
    invoiceIssueRequestedBy: me,
    invoiceIssueRequestNote: note,
    createdAt,
    updatedAt: nowIso
  });

  // ★PJチャンネルへ投稿（adminメンション + アップロード導線）
  const baseUrl = ScriptApp.getService().getUrl();
  const ymForUi = encodeURIComponent(String(ym).slice(0,4) + "-" + String(ym).slice(4,6));
  const uploadUrl =
    `${baseUrl}?page=billing&projectId=${encodeURIComponent(projectId)}&ym=${ymForUi}&focus=invoiceUpload`;

  // 金額・送付先を出せるなら出す（ドラフト保存済みの値を拾う）
  let clientName = "";
  try {
    const settings = b_getFreeeProjectSettings_(projectId);
    clientName = String(settings && (settings.partnerName || settings.clientName) || "").trim();
  } catch(e) {}

  let amountText = "";
  try{
    const budget65 =
      (cur.budgetTotal !== undefined && String(cur.budgetTotal).trim() !== "")
        ? Number(cur.budgetTotal || 0)
        : Number(cur.budgetYen || 0);
    if (budget65 > 0){
      const gross = Math.round(budget65 / 0.65);
      amountText = `${gross}円（税抜・立替除く）`;
    }
  }catch(e){}

  // Slackへ（チャンネル投稿）
  try{
    slackNotifyPostInvoiceIssueRequested({
      projectId,
      ym,
      projectName,
      requestedByEmail: me,
      note,
      uploadUrl,
      clientName,
      amountText
    });
  } catch(e) {
    // 依頼自体はDBに入ってるので、Slack失敗で落とさない
  }

  return { ok:true, requestedAt: nowIso };
}

function notifyAdminsByPreference_(subject, body, slackText){
  // ★Slack一本化：通知手段の選択は廃止。Gmailは一切使わない。
  const admins = ["kyoko@team-armada.jp", "masa@team-armada.jp"];

  // DB_Members から slackId を引く
  const rows = b_readTableThin_("DB_Members", ["email","slackId"]);
  const map = {};
  (Array.isArray(rows) ? rows : []).forEach(r => {
    const em = String(r.email||"").toLowerCase().trim();
    if (!em) return;
    map[em] = { slackId: String(r.slackId||"").trim() };
  });

  const text = String(slackText || "").trim() || (String(subject||"") + "\n\n" + String(body||""));

  // admin全員にDM（slackIdが無いadminがいたら即エラーにして設定漏れを露呈させる）
  const missing = [];
  admins.forEach(em => {
    const m = map[String(em).toLowerCase().trim()] || { slackId:"" };
    if (!m.slackId) missing.push(em);
  });

  if (missing.length){
    throw new Error("notifyAdminsByPreference_: slackId missing for admin(s): " + missing.join(", "));
  }

  admins.forEach(em => {
    const m = map[String(em).toLowerCase().trim()];
    slack_postDm(m.slackId, text);
  });
}

/****************************************************
 * Public APIs for BillingPage
 ****************************************************/

function api_freeeListPartners() {
  const companyId = String(PropertiesService.getScriptProperties().getProperty("FREEE_COMPANY_ID") || "").trim();
  if (!companyId) throw new Error("FREEE_COMPANY_ID is not set");

  // 取引先一覧：GET /api/1/partners :contentReference[oaicite:3]{index=3}
  const json = b_freeeRequestAccounting_("get", "/partners", { company_id: companyId });

  const partners = (json.partners || []).map(p => ({
    id: p.id,
    name: p.name || p.display_name || p.contact_name || "",
    shortcut1: p.shortcut1 || "",
    shortcut2: p.shortcut2 || "",
  })).filter(p => p.id);

  return { ok: true, partners };
}
function api_freeeListInvoiceTemplates() {
  // 請求書テンプレ一覧：GET /invoices/templates :contentReference[oaicite:4]{index=4}
  // company_id が必要な仕様なら query に足す。不要なら無視されるか、問題なく動くことが多い
  const companyId = String(PropertiesService.getScriptProperties().getProperty("FREEE_COMPANY_ID") || "").trim();

  const json = b_freeeRequestIv_("get", "/invoices/templates", companyId ? { company_id: companyId } : null);

  // 返却フィールド名は環境で微妙に違うことがあるから、ここは幅持たせる
  const list = (json.templates || json.invoice_templates || json.data || []).map(t => ({
    id: t.id,
    name: t.name || t.title || t.display_name || "",
  })).filter(x => x.id);

  return { ok: true, templates: list };
}
function api_freeeLoadMasters() {
  const companyId = String(PropertiesService.getScriptProperties().getProperty("FREEE_COMPANY_ID") || "").trim();
  if (!companyId) throw new Error("FREEE_COMPANY_ID is not set");

  // 1回の実行でまとめて取る（refresh競合を避ける）
  const partnersJson = b_freeeRequestAccounting_("get", "/partners", { company_id: companyId });
  const partners = (partnersJson.partners || []).map(p => ({
    id: p.id,
    name: p.name || p.display_name || p.contact_name || "",
  })).filter(p => p.id);

  const templatesJson = b_freeeRequestIv_("get", "/invoices/templates", companyId ? { company_id: companyId } : null);
  const templates = (templatesJson.templates || templatesJson.invoice_templates || templatesJson.data || []).map(t => ({
    id: t.id,
    name: t.name || t.title || t.display_name || "",
  })).filter(t => t.id);

  return { ok: true, partners, templates };
}
function api_freeeCreateInvoiceIssued(projectId, ym, payload) {
  // ★互換ラッパー：古いフロントが呼んでも動くように、api_issueInvoiceFreee に転送する
  projectId = String(projectId || "").trim();
  ym = b_normYm_(ym);
  payload = payload || {};

  // 権限チェックは api_issueInvoiceFreee 側でもやるけど、ここでも揃える
  if (!projectId) throw new Error("api_freeeCreateInvoiceIssued: projectId empty");
  if (!ym) throw new Error("api_freeeCreateInvoiceIssued: ym empty");

  // api_issueInvoiceFreee に渡したい形へ寄せる
  // - issueDate/dueDate/templateId/description はそのまま引き継ぐ
  const forwardPayload = {
    issueDate: String(payload.issueDate || payload.billingDate || "").trim(),
    dueDate: String(payload.dueDate || payload.paymentDate || "").trim(),
    templateId: String(payload.templateId || "").trim(),
    description: String(payload.description || "").trim(),
  };

  // ここで “発行API一本化” の本体へ
  return api_issueInvoiceFreee(projectId, ym, forwardPayload);
}
function api_saveInvoiceDraftInputs(projectId, ym, payload){
  projectId = String(projectId || "").trim();
  ym = b_normYm_(ym);
  payload = payload || {};

  if (!projectId) throw new Error("api_saveInvoiceDraftInputs: projectId empty");
  if (!ym) throw new Error("api_saveInvoiceDraftInputs: ym empty");

  b_assertProjectAccess_(projectId);
  b_ensureBillingCycleHeader_();

  // ★追加列
  b_ensureHeader_("DB_BillingCycle", [
    "invoiceBillingDate","invoicePaymentDate","invoiceReimbYen","freeeInvoiceTemplateId",
    "invoiceCustomLinesJson"
  ]);

  const nowIso = b_nowIso_();
  const cur = b_getCycleOne_(projectId, ym) || {};
  const createdAt = String(cur.createdAt || "") || nowIso;
  const cycleId = `${projectId}_${ym}`;
  const projectName = String(cur.projectName || b_getProjectName_(projectId) || projectId);

  const invoiceBillingDate = String(payload.issueDate || "").trim();
  const invoicePaymentDate = String(payload.dueDate || "").trim();
  const invoiceReimbYen = Number(payload.reimbYen || 0);
  const freeeInvoiceTemplateId = String(payload.templateId || "").trim();

  const lines = Array.isArray(payload.lines) ? payload.lines : [];
  const normalizedLines = lines.map(x => ({
    description: String(x.description || "").trim(),
    quantity: Number(x.quantity || 0),
    unit_price: Number(x.unit_price || 0),
  })).filter(x => x.description || x.quantity || x.unit_price);

  b_upsertRow_("DB_BillingCycle", ["projectId","ym"], {
    cycleId, projectId, ym, projectName,

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

    // ★追加保存項目
    invoiceBillingDate,
    invoicePaymentDate,
    invoiceReimbYen,
    freeeInvoiceTemplateId,
    invoiceCustomLinesJson: JSON.stringify(normalizedLines),

    createdAt,
    updatedAt: nowIso,
  });

  return { ok:true, invoiceBillingDate, invoicePaymentDate, invoiceReimbYen, freeeInvoiceTemplateId, invoiceCustomLinesJson: JSON.stringify(normalizedLines), updatedAt: nowIso };
}

function api_saveInvoiceDraftInputsV2(projectId, ym, payload){
  projectId = String(projectId || "").trim();
  ym = b_normYm_(ym);
  payload = payload || {};

  if (!projectId) throw new Error("api_saveInvoiceDraftInputsV2: projectId empty");
  if (!ym) throw new Error("api_saveInvoiceDraftInputsV2: ym empty");

  b_assertProjectAccess_(projectId);

  // BillingCycle
  b_ensureBillingCycleHeader_();

  // PJ別テンプレ（DB_Projects）
  // ※ここは1ヶ所だけでOK。7ヶ所全部置換しない
  b_ensureHeader_("DB_Projects", ["invoiceBaseLinesTemplateJson"]);

  // BillingCycle追加列
  b_ensureHeader_("DB_BillingCycle", [
    "invoiceBillingDate",
    "invoicePaymentDate",
    "invoiceReimbYen",
    "freeeInvoiceTemplateId",
    "invoiceCustomLinesJson",

    // ★文言
    "invoiceSubject",
    "invoiceBaseLineDesc",
    "invoiceBaseLinesJson",
    "invoiceReimbPrefix",

    // ★備考
    "invoiceRemark"
  ]);

  const nowIso = b_nowIso_();
  const cur = b_getCycleOne_(projectId, ym) || {};
  const createdAt = String(cur.createdAt || "") || nowIso;
  const cycleId = `${projectId}_${ym}`;
  const projectName = String(cur.projectName || b_getProjectName_(projectId) || projectId);

  const invoiceBillingDate = String(payload.issueDate || "").trim();
  const invoicePaymentDate = String(payload.dueDate || "").trim();
  const freeeInvoiceTemplateId = String(payload.templateId || "").trim();

  // ★文言
  const invoiceSubject = String(payload.invoiceSubject || payload.subject || "").trim();
  const invoiceReimbPrefix = String(payload.invoiceReimbPrefix || "").trim();

  // ★備考
  const invoiceRemark = String(payload.invoiceRemark || "").trim();

  // ============================================================
  // ★基本行（PJごとの型を覚える）: invoiceBaseLines
  // - 今後 quantity/unit_price をFEが投げても保存できるようにする
  // - 互換で旧 invoiceBaseLineDesc も救済
  // ============================================================
  const invoiceBaseLines = Array.isArray(payload.invoiceBaseLines) ? payload.invoiceBaseLines : [];
  const normalizedBaseLines = invoiceBaseLines
    .map(x => ({
      description: String(x.description || "").trim(),
      quantity: Math.max(1, Number(x.quantity || 1)),
      unit_price: Math.max(0, Number(x.unit_price || 0)),
    }))
    .filter(x => x.description);

  // 互換：旧フィールドが来たら1行として取り込む（amountは0のまま）
  const invoiceBaseLineDesc = String(payload.invoiceBaseLineDesc || payload.description || "").trim();
  if (!normalizedBaseLines.length && invoiceBaseLineDesc){
    normalizedBaseLines.push({ description: invoiceBaseLineDesc, quantity: 1, unit_price: 0 });
  }

  // ============================================================
  // ★立替（サーバ集計が唯一の正）
  // ============================================================
  let invoiceReimbYen = 0;
  try {
    const pack = reimburse_listApprovedForBilling({ projectId, ym });
    invoiceReimbYen = Number(pack && pack.totalYen ? pack.totalYen : 0);
  } catch(e) {
    invoiceReimbYen = 0;
  }

  // ============================================================
  // ★調整行（値引き/追加作業など）
  // ============================================================
  const lines = Array.isArray(payload.lines) ? payload.lines : [];
  const normalizedLines = lines
    .map(x => ({
      description: String(x.description || "").trim(),
      quantity: Number(x.quantity || 0),
      unit_price: Number(x.unit_price || 0),
    }))
    // ルール：description が空なら捨てる（数量1のデフォルト行でゴミが残るのを防ぐ）
    .filter(x => x.description);

  // ============================================================
  // ★BillingCycleへ保存（今月の正本）
  // ============================================================
  b_upsertRow_("DB_BillingCycle", ["projectId","ym"], {
    cycleId, projectId, ym, projectName,

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

    invoiceBillingDate,
    invoicePaymentDate,
    invoiceReimbYen,
    freeeInvoiceTemplateId,
    invoiceCustomLinesJson: JSON.stringify(normalizedLines),

    // ★文言
    invoiceSubject,
    invoiceBaseLineDesc,
    invoiceBaseLinesJson: JSON.stringify(normalizedBaseLines),
    invoiceReimbPrefix,

    // ★備考
    invoiceRemark,

    createdAt,
    updatedAt: nowIso,
  });

  return {
    ok:true,
    invoiceBillingDate,
    invoicePaymentDate,
    invoiceReimbYen,
    freeeInvoiceTemplateId,
    invoiceCustomLinesJson: JSON.stringify(normalizedLines),

    // ★返す（FEが即表示できる）
    invoiceSubject,
    invoiceBaseLineDesc,
    invoiceBaseLinesJson: JSON.stringify(normalizedBaseLines),
    invoiceReimbPrefix,

    // ★備考
    invoiceRemark,

    updatedAt: nowIso
  };
}

function api_confirmClientGross(projectId, ym, clientGrossYen) {
  projectId = String(projectId || "").trim();
  ym = b_normYm_(ym);
  const gross = Number(clientGrossYen || 0);

  if (!projectId) throw new Error("api_confirmClientGross: projectId empty");
  if (!ym) throw new Error("api_confirmClientGross: ym empty");

  b_assertProjectAccess_(projectId);
  b_ensureBillingCycleHeader_();

  // 追加列（無ければ追加）
  b_ensureHeader_("DB_BillingCycle", ["clientGrossYen"]);

  const nowIso = b_nowIso_();
  const cur = b_getCycleOne_(projectId, ym) || {};
  const createdAt = String(cur.createdAt || "") || nowIso;

  const budget = Math.round(gross * 0.65);
  const cycleId = `${projectId}_${ym}`;
  const projectName = String(cur.projectName || b_getProjectName_(projectId) || projectId);
  const me = Session.getActiveUser().getEmail();

  b_upsertRow_("DB_BillingCycle", ["projectId","ym"], {
    cycleId,
    projectId,
    ym,
    projectName,

    clientGrossYen: gross,

    budgetTotal: budget,
    budgetConfirmedAt: nowIso,
    budgetConfirmedBy: me,

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

    createdAt,
    updatedAt: nowIso
  });

  b_appendBillingLog_({
    actionType: "BUDGET_CONFIRM_FROM_GROSS",
    target: "clientGrossYen",
    projectId,
    ym,
    cycleId,
    beforeValue: "",
    afterValue: JSON.stringify({ clientGrossYen: gross, budgetYen: budget }),
    reason: "budget_confirm_from_gross",
    operatorUserId: me,
    operatorName: me,
    createdAt: b_nowIso_()
  });

  return { ok:true, clientGrossYen: gross, budgetYen: budget, budgetConfirmedAt: nowIso };
}
function debug_saveInvoicePdfById(freeeInvoiceId){
  freeeInvoiceId = String(freeeInvoiceId || "").trim();
  if (!freeeInvoiceId) throw new Error("freeeInvoiceId required");

  const res = b_saveInvoicePdfToDrive_(freeeInvoiceId, "", `debug_invoice_${freeeInvoiceId}`);
  return res;
}
function admin_uploadInvoicePdfFromBilling(projectId, ym, fileName, mimeType, base64){
  projectId = String(projectId || "").trim();
  ym = b_normYm_(ym);
  fileName = String(fileName || "").trim();
  mimeType = String(mimeType || "application/pdf").trim();
  base64 = String(base64 || "").trim();

  if (!projectId) throw new Error("admin_uploadInvoicePdfFromBilling: projectId empty");
  if (!ym) throw new Error("admin_uploadInvoicePdfFromBilling: ym empty");
  if (!base64) throw new Error("admin_uploadInvoicePdfFromBilling: base64 empty");

  // admin限定（このプロジェクトの既存流儀に合わせて “確実に止める”）
  const me = (Session.getActiveUser().getEmail() || "").toLowerCase().trim();
  const allowed = ["masa@team-armada.jp", "kyoko@team-armada.jp"];
  if (!allowed.includes(me)) throw new Error("admin only");

  b_ensureBillingCycleHeader_();

  const cur = b_getCycleOne_(projectId, ym) || {};
  const freeeInvoiceId = String(cur.freeeInvoiceId || "").trim();
  if (!freeeInvoiceId) throw new Error("freeeInvoiceId empty（まだ発行してない？）");

  // 保存先は billing側で定義済みのフォルダへ
  const folderId = String(b_freeeInvoiceFolderId_() || "").trim();
  if (!folderId) throw new Error("invoice folderId missing（b_freeeInvoiceFolderId_）");

  const folder = DriveApp.getFolderById(folderId);

  // ファイル名は統一（人間のアップロード名は信用しない）
  const safeName = `請求書_${projectId}_${ym}_${freeeInvoiceId}.pdf`;

  const bytes = Utilities.base64Decode(base64);
  const blob = Utilities.newBlob(bytes, "application/pdf", safeName);

  // 既存の同名があれば“差し替え”運用にする（増殖事故を防ぐ）
  let file = null;
  const it = folder.getFilesByName(safeName);
  if (it.hasNext()){
    const old = it.next();
    try { old.setTrashed(true); } catch(e){}
  }
  file = folder.createFile(blob);

  const nowIso = b_nowIso_();
  const cycleId = `${projectId}_${ym}`;

  // DB反映（他の値は壊さない：curをベースに上書き）
  b_upsertRow_("DB_BillingCycle", ["projectId","ym"], {
    ...cur,
    cycleId,
    projectId,
    ym,
    invoicePdfUrl: file.getUrl(),
    invoicePdfFileId: file.getId(),
    updatedAt: nowIso
  });

  // ログ（任意：既存のログ流儀に合わせる）
  try{
    b_appendBillingLog_({
      actionType: "INVOICE_PDF_UPLOAD_ADMIN",
      target: "invoicePdf",
      projectId,
      ym,
      cycleId,
      beforeValue: JSON.stringify({ invoicePdfUrl: String(cur.invoicePdfUrl || ""), invoicePdfFileId: String(cur.invoicePdfFileId || "") }),
      afterValue: JSON.stringify({ invoicePdfUrl: file.getUrl(), invoicePdfFileId: file.getId() }),
      reason: "admin_upload_invoice_pdf",
      operatorUserId: me,
      operatorName: me,
      createdAt: b_nowIso_()
    });
  } catch(e){}

  // ============================================================
  // ★追加：PMへSlack通知（DM）
  // - 通知失敗してもアップロードは成功扱い（運用を止めない）
  // ============================================================
  try{
    // PM抽出：DB_ProjectMembers（isPM=true or roleLabelにPM）
    const pmRows = b_readTableThin_("DB_ProjectMembers", ["projectId","memberId","isActive","isPM","roleLabel"]);
    const pmMemberIds = (Array.isArray(pmRows) ? pmRows : [])
      .map(r => ({
        projectId: String(r.projectId || "").trim(),
        memberId: String(r.memberId || "").trim(),
        isActive: r.isActive,
        isPM: r.isPM,
        roleLabel: String(r.roleLabel || "").trim(),
      }))
      .filter(r => r.projectId === projectId && r.memberId)
      .filter(r => b_toBool_(r.isActive, true))
      .filter(r => b_toBool_(r.isPM, false) || String(r.roleLabel || "").toUpperCase().includes("PM"))
      .map(r => r.memberId);

    // memberId -> slackId
    const memRows = b_readTableThin_("DB_Members", ["memberId","slackId","codeName","email"]);
    const memMap = {};
    (Array.isArray(memRows) ? memRows : []).forEach(r => {
      const mid = String(r.memberId || "").trim();
      if (!mid) return;
      memMap[mid] = {
        slackId: String(r.slackId || "").trim(),
        codeName: String(r.codeName || "").trim(),
        email: String(r.email || "").trim(),
      };
    });

    const pmSlackIds = pmMemberIds
      .map(mid => (memMap[mid] && memMap[mid].slackId) ? String(memMap[mid].slackId).trim() : "")
      .filter(x => x);

    if (typeof slack_postDm !== "function") {
      // DM関数が無い環境なら静かに諦める（アップロードは成功）
      throw new Error("slack_postDm not found");
    }

    // Billingページへの導線
    const baseUrl =
      String(PropertiesService.getScriptProperties().getProperty("WEBAPP_BASE_URL") || "").trim()
      || String(ScriptApp.getService().getUrl() || "").trim();

    const ymForUi = encodeURIComponent(String(ym).slice(0,4) + "-" + String(ym).slice(4,6));
    const billingUrl =
      `${baseUrl}?page=billing&projectId=${encodeURIComponent(projectId)}&ym=${ymForUi}&focus=invoiceSend`;

    const projectName =
      String(cur.projectName || (typeof b_getProjectName_ === "function" ? b_getProjectName_(projectId) : "") || projectId).trim();

    const text =
      `【請求書PDFアップロード完了】\n` +
      `PJ: ${projectName}（${projectId}）\n` +
      `対象月: ${String(ym).slice(0,4)}-${String(ym).slice(4,6)}\n` +
      `PDF: ${file.getUrl()}\n` +
      `OS: ${billingUrl}\n` +
      `\n次：請求書の送付を進めてね`;

    // PM全員へDM
    pmSlackIds.forEach(sid => {
      try { slack_postDm(sid, text); } catch(e2){}
    });
  } catch(e) {
    // 通知失敗してもアップロード自体は成功なので握りつぶす（ログだけ残す）
    try{
      b_appendBillingLog_({
        actionType: "SLACK_NOTIFY_INVOICE_PDF_UPLOADED_FAIL",
        target: "slack",
        projectId,
        ym,
        cycleId,
        beforeValue: "",
        afterValue: JSON.stringify({ message: String(e && (e.message || e)) }),
        reason: "slack_notify_invoice_pdf_uploaded_fail",
        operatorUserId: me,
        operatorName: me,
        createdAt: b_nowIso_()
      });
    } catch(e2){}
  }

  return {
    ok: true,
    invoicePdfUrl: file.getUrl(),
    invoicePdfFileId: file.getId(),
    fileName: safeName,
    updatedAt: nowIso
  };
}

function api_requestInvoiceCancel(projectId, ym){
  projectId = String(projectId || "").trim();
  ym = b_normYm_(ym);
  if (!projectId) throw new Error("projectId empty");
  if (!ym) throw new Error("ym empty");

  b_assertProjectAccess_(projectId);
  b_ensureBillingCycleHeader_();

  const me = (Session.getActiveUser().getEmail() || "").trim().toLowerCase();
  const cur = b_getCycleOne_(projectId, ym) || {};
  const freeeInvoiceId = String(cur.freeeInvoiceId || "").trim();
  const freeeInvoiceNumber = String(cur.freeeInvoiceNumber || "").trim();
  const projectName = String(cur.projectName || b_getProjectName_(projectId) || projectId);
  const cycleId = `${projectId}_${ym}`;

  // ★まず「呼ばれた事実」を必ずログに残す
  b_appendBillingLog_({
    actionType: "INVOICE_CANCEL_REQUEST_START",
    target: "invoice",
    projectId,
    ym,
    cycleId,
    beforeValue: "",
    afterValue: JSON.stringify({ projectName, freeeInvoiceId, freeeInvoiceNumber }),
    reason: "invoice_cancel_request_start",
    operatorUserId: me,
    operatorName: me,
    createdAt: b_nowIso_()
  });

  if (!freeeInvoiceId) throw new Error("freeeInvoiceId empty（まだ発行してない？）");

  // token sheet
  const sh = b_ss_().getSheetByName("DB_InvoiceCancelTokens") || b_ss_().insertSheet("DB_InvoiceCancelTokens");
  const headers = ["projectId","ym","token","freeeInvoiceId","freeeInvoiceNumber","sentAt","usedAt","usedBy"];
  const row1 = sh.getRange(1,1,1,Math.max(sh.getLastColumn(),1)).getValues()[0].map(x=>String(x||"").trim());
  if (row1.every(x=>!x)) sh.getRange(1,1,1,headers.length).setValues([headers]);
  else {
    const miss = headers.filter(h => row1.indexOf(h) < 0);
    if (miss.length) sh.getRange(1, row1.length+1, 1, miss.length).setValues([miss]);
  }

  const token = Utilities.getUuid().replace(/-/g,"");
  const nowIso = b_nowIso_();
  sh.appendRow([projectId, ym, token, freeeInvoiceId, freeeInvoiceNumber, nowIso, "", ""]);

  const baseUrl = ScriptApp.getService().getUrl();
  const cancelUrl =
    `${baseUrl}?mode=invoicecancel` +
    `&projectId=${encodeURIComponent(projectId)}` +
    `&ym=${encodeURIComponent(ym)}` +
    `&token=${encodeURIComponent(token)}`;

  // ★PJチャンネルへ投稿（現状踏襲）
  let slackRes = null;
  try{
    slackRes = slackNotifyPostInvoiceCancelRequested({
      projectId,
      ym,
      projectName,
      requestedByEmail: me,
      freeeInvoiceNumber,
      freeeInvoiceId,
      cancelUrl
    });
  } catch(e) {
    slackRes = { ok:false, message:String(e && (e.message || e)) };
  }

  // ============================================================
  // ★ここが本丸：Slack DMを必ず飛ばす（操作者 + admin）
  // ============================================================
  if (typeof slack_postDm !== "function"){
    throw new Error("slack_postDm not found（DM送信関数が見つからない）");
  }

  // email -> slackId を DB_Members から引く
  const members = b_readTableThin_("DB_Members", ["email","slackId"]);
  const emailToSlackId = {};
  (Array.isArray(members) ? members : []).forEach(r => {
    const em = String(r.email || "").toLowerCase().trim();
    if (!em) return;
    emailToSlackId[em] = String(r.slackId || "").trim();
  });

  const mySlackId = String(emailToSlackId[me] || "").trim();
  if (!mySlackId){
    throw new Error("DB_Members に自分の slackId が入ってない: " + me);
  }

  const admins = ["kyoko@team-armada.jp", "masa@team-armada.jp"];
  const missingAdmins = admins.filter(em => !String(emailToSlackId[String(em).toLowerCase().trim()] || "").trim());
  if (missingAdmins.length){
    throw new Error("DB_Members に admin の slackId が入ってない: " + missingAdmins.join(", "));
  }

  const ymUi = String(ym).slice(0,4) + "-" + String(ym).slice(4,6);
  const dmText =
    `【請求書取消】リンク作ったよ\n` +
    `PJ: ${projectName}（${projectId}）\n` +
    `ym: ${ymUi}\n` +
    `請求書: ${freeeInvoiceNumber || "（番号未取得）"} / ${freeeInvoiceId}\n\n` +
    `▼取消URL（きよ/まさだけ実行可）\n${cancelUrl}`;

  // DM to requester（PM本人）
  const dmResults = { requester:null, admins:[] };
  dmResults.requester = slack_postDm(mySlackId, dmText);

  // DM to admins（きよ/まさ）
  admins.forEach(em => {
    const sid = String(emailToSlackId[String(em).toLowerCase().trim()] || "").trim();
    const res = slack_postDm(sid, dmText);
    dmResults.admins.push({ email: em, slackId: sid, res: res });
  });

  // ★結果ログ（DM結果も残す：原因追跡を秒速化）
  b_appendBillingLog_({
    actionType: "INVOICE_CANCEL_REQUEST",
    target: "invoice",
    projectId,
    ym,
    cycleId,
    beforeValue: "",
    afterValue: JSON.stringify({ token, cancelUrl, slackRes }),
    reason: "invoice_cancel_request",
    operatorUserId: me,
    operatorName: me,
    createdAt: b_nowIso_()
  });

  b_appendBillingLog_({
    actionType: "SLACK_DM_INVOICE_CANCEL_REQUEST",
    target: "slack_dm",
    projectId,
    ym,
    cycleId,
    beforeValue: "",
    afterValue: JSON.stringify({ toRequester: me, dmResults: dmResults }),
    reason: "slack_dm_invoice_cancel_request",
    operatorUserId: me,
    operatorName: me,
    createdAt: b_nowIso_()
  });

  return { ok:true, token, cancelUrl };
}

function api_confirmInvoiceCancelByToken(payload){
  payload = payload || {};
  const projectId = String(payload.projectId||"").trim();
  const ym = b_normYm_(payload.ym);
  const token = String(payload.token||"").trim();
  if (!projectId) throw new Error("projectId empty");
  if (!ym) throw new Error("ym empty");
  if (!token) throw new Error("token empty");

  // kyoko or masa only
  const me = (Session.getActiveUser().getEmail()||"").toLowerCase().trim();
  const allowed = ["kyoko@team-armada.jp", "masa@team-armada.jp"];
  if (!allowed.includes(me)) return { ok:false, message:"きよ・まさ以外は操作できない" };

  // token check
  const sh = b_ss_().getSheetByName("DB_InvoiceCancelTokens");
  if (!sh) return { ok:false, message:"DB_InvoiceCancelTokens not found" };

  const vals = sh.getDataRange().getValues();
  const h = vals[0].map(x=>String(x||"").trim());
  const iPid = h.indexOf("projectId");
  const iYm = h.indexOf("ym");
  const iTok = h.indexOf("token");
  const iUsedAt = h.indexOf("usedAt");
  const iUsedBy = h.indexOf("usedBy");

  let hitRow = -1;
  for (let r=1; r<vals.length; r++){
    if (String(vals[r][iPid]||"").trim() === projectId &&
        b_normYm_(vals[r][iYm]) === ym &&
        String(vals[r][iTok]||"").trim() === token) {
      hitRow = r+1; break;
    }
  }
  if (hitRow < 0) return { ok:false, message:"token not found" };

  const used = (iUsedAt>=0) ? String(sh.getRange(hitRow,iUsedAt+1).getValue()||"").trim() : "";
  if (used) return { ok:false, message:"already used" };

  // reset billing cycle fields
  b_ensureBillingCycleHeader_();
  b_ensureHeader_("DB_BillingCycle", ["invoiceCustomLinesJson"]); // 念のため

  const cur = b_getCycleOne_(projectId, ym) || {};
  const nowIso = b_nowIso_();

  b_upsertRow_("DB_BillingCycle", ["projectId","ym"], {
    ...cur,
    projectId,
    ym,
    cycleId: `${projectId}_${ym}`,

    // ★発行周りを戻す（ドラフトは残す）
    invoiceIssuedAt: "",
    invoiceIssuedBy: "",
    invoicePdfUrl: "",
    invoicePdfFileId: "",
    freeeInvoiceId: "",
    freeeInvoiceNumber: "",

    invoiceReviewedAt: "",
    invoiceReviewedBy: "",
    invoiceSentAt: "",
    invoiceSentBy: "",

    updatedAt: nowIso,
  });

  // mark token used
  if (iUsedAt>=0) sh.getRange(hitRow,iUsedAt+1).setValue(nowIso);
  if (iUsedBy>=0) sh.getRange(hitRow,iUsedBy+1).setValue(me);

  return { ok:true };
}

function api_saveInvoiceDraftPartial(projectId, ym, payload){
  projectId = String(projectId || "").trim();
  ym = b_normYm_(ym);
  payload = payload || {};

  if (!projectId) throw new Error("api_saveInvoiceDraftPartial: projectId empty");
  if (!ym) throw new Error("api_saveInvoiceDraftPartial: ym empty");

  b_assertProjectAccess_(projectId);

  b_ensureBillingCycleHeader_();
  b_ensureHeader_("DB_BillingCycle", [
    "invoiceBillingDate","invoicePaymentDate","invoiceReimbYen","freeeInvoiceTemplateId",
    "invoiceCustomLinesJson",
    "invoiceSubject","invoiceBaseLinesJson","invoiceReimbPrefix","invoiceRemark"
  ]);

  const nowIso = b_nowIso_();
  const cur = b_getCycleOne_(projectId, ym) || {};
  const createdAt = String(cur.createdAt || "") || nowIso;
  const cycleId = `${projectId}_${ym}`;
  const projectName = String(cur.projectName || b_getProjectName_(projectId) || projectId);

  // 空でも保存OK（途中保存なので）
  const invoiceBillingDate = String(payload.issueDate || cur.invoiceBillingDate || "").trim();
  const invoicePaymentDate = String(payload.dueDate   || cur.invoicePaymentDate || "").trim();
  const freeeInvoiceTemplateId = String(payload.templateId || cur.freeeInvoiceTemplateId || "").trim();

  const invoiceSubject = String(payload.invoiceSubject || cur.invoiceSubject || "").trim();
  const invoiceReimbPrefix = String(payload.invoiceReimbPrefix || cur.invoiceReimbPrefix || "").trim();
  const invoiceRemark = String(payload.invoiceRemark || cur.invoiceRemark || "").trim();

  const baseLinesRaw = Array.isArray(payload.invoiceBaseLines) ? payload.invoiceBaseLines : [];
  const baseLines = baseLinesRaw
    .map(x => ({
      description: String(x.description || "").trim(),
      quantity: Math.max(1, Number(x.quantity || 1)),
      unit_price: Math.max(0, Number(x.unit_price || 0)),
    }))
    .filter(x => x.description);

  const linesRaw = Array.isArray(payload.lines) ? payload.lines : [];
  const lines = linesRaw
    .map(x => ({
      description: String(x.description || "").trim(),
      quantity: Number(x.quantity || 0),
      unit_price: Number(x.unit_price || 0),
    }))
    // ルール：description が空なら捨てる（“空の調整行”を保存しない）
    .filter(x => x.description);

  b_upsertRow_("DB_BillingCycle", ["projectId","ym"], {
    ...cur,
    cycleId,
    projectId,
    ym,
    projectName,

    invoiceBillingDate,
    invoicePaymentDate,
    freeeInvoiceTemplateId,

    invoiceSubject,
    invoiceBaseLinesJson: JSON.stringify(baseLines),
    invoiceReimbPrefix,
    invoiceRemark,

    invoiceCustomLinesJson: JSON.stringify(lines),

    createdAt,
    updatedAt: nowIso,
  });

  return { ok:true, updatedAt: nowIso };
}

function api_admin_requestInvoiceRollback(projectId, ym, payload){
  payload = payload || {};
  projectId = String(projectId || "").trim();
  ym = b_normYm_(ym);

  if (!isAdmin_()) return { ok:false, message:"admin only" };
  if (!projectId) throw new Error("api_admin_requestInvoiceRollback: projectId empty");
  if (!ym) throw new Error("api_admin_requestInvoiceRollback: ym empty");

  b_assertProjectAccess_(projectId);
  b_ensureBillingCycleHeader_();

  // 追加列（差し戻しの監査情報）
  b_ensureHeader_("DB_BillingCycle", [
    "invoiceRollbackAt",
    "invoiceRollbackBy",
    "invoiceRollbackComment",
    "invoiceRollbackSnapshotJson"
  ]);

  const nowIso = b_nowIso_();
  const me = (Session.getActiveUser().getEmail() || "").trim().toLowerCase();

  const cur = b_getCycleOne_(projectId, ym) || {};
  const cycleId = `${projectId}_${ym}`;
  const createdAt = String(cur.createdAt || "") || nowIso;
  const projectName = String(cur.projectName || (typeof b_getProjectName_==="function" ? b_getProjectName_(projectId) : "") || projectId).trim();

  const comment = String(payload.comment || "").trim();
  if (!comment) return { ok:false, message:"comment required" };

  // 修正前スナップショット（通知に載せる）
  const snap = {
    invoiceIssuedAt: String(cur.invoiceIssuedAt || ""),
    freeeInvoiceId: String(cur.freeeInvoiceId || ""),
    freeeInvoiceNumber: String(cur.freeeInvoiceNumber || ""),
    invoicePdfUrl: String(cur.invoicePdfUrl || ""),
    invoicePdfFileId: String(cur.invoicePdfFileId || ""),
    invoiceSentAt: String(cur.invoiceSentAt || ""),
    invoiceSentBy: String(cur.invoiceSentBy || "")
  };

  // 「未アップロード状態に戻す」＝OS上のPDF参照を消す（Driveの実ファイルは触らない）
  b_upsertRow_("DB_BillingCycle", ["projectId","ym"], {
    ...cur,
    cycleId,
    projectId,
    ym,
    projectName,

    // ★PDFを未アップロード扱いに戻す（Driveファイルは残す）
    invoicePdfUrl: "",
    invoicePdfFileId: "",

    // ★送付・レビューを戻す（再作業の邪魔をしない）
    invoiceReviewedAt: "",
    invoiceReviewedBy: "",
    invoiceSentAt: "",
    invoiceSentBy: "",

    // 差し戻し情報
    invoiceRollbackAt: nowIso,
    invoiceRollbackBy: me,
    invoiceRollbackComment: comment,
    invoiceRollbackSnapshotJson: JSON.stringify(snap),

    createdAt,
    updatedAt: nowIso
  });

  // ログ
  try{
    b_appendBillingLog_({
      actionType: "INVOICE_ROLLBACK",
      target: "invoice",
      projectId,
      ym,
      cycleId,
      beforeValue: JSON.stringify(snap),
      afterValue: JSON.stringify({ invoicePdfUrl:"", invoicePdfFileId:"", invoiceSentAt:"", invoiceReviewedAt:"", comment }),
      reason: "admin_rollback",
      operatorUserId: me,
      operatorName: me,
      createdAt: b_nowIso_()
    });
  } catch(e){}

  // PMへSlack DM（既存の抽出ロジックを流用）
  try{
    if (typeof slack_postDm !== "function") throw new Error("slack_postDm not found");

    const pmRows = b_readTableThin_("DB_ProjectMembers", ["projectId","memberId","isActive","isPM","roleLabel"]);
    const pmMemberIds = (Array.isArray(pmRows) ? pmRows : [])
      .map(r => ({
        projectId: String(r.projectId || "").trim(),
        memberId: String(r.memberId || "").trim(),
        isActive: r.isActive,
        isPM: r.isPM,
        roleLabel: String(r.roleLabel || "").trim(),
      }))
      .filter(r => r.projectId === projectId && r.memberId)
      .filter(r => b_toBool_(r.isActive, true))
      .filter(r => b_toBool_(r.isPM, false) || String(r.roleLabel || "").toUpperCase().includes("PM"))
      .map(r => r.memberId);

    const memRows = b_readTableThin_("DB_Members", ["memberId","slackId"]);
    const memMap = {};
    (Array.isArray(memRows) ? memRows : []).forEach(r => {
      const mid = String(r.memberId || "").trim();
      if (!mid) return;
      memMap[mid] = String(r.slackId || "").trim();
    });

    const pmSlackIds = pmMemberIds.map(mid => memMap[mid] || "").filter(x => x);

    // Timelineリンク（Billingは廃止前提）
    const baseUrl =
      String(PropertiesService.getScriptProperties().getProperty("WEBAPP_BASE_URL") || "").trim()
      || String(ScriptApp.getService().getUrl() || "").trim();

    const ymForUi = encodeURIComponent(String(ym).slice(0,4) + "-" + String(ym).slice(4,6));
    const timelineUrl =
      `${baseUrl}?page=timeline&projectId=${encodeURIComponent(projectId)}&ym=${ymForUi}`;

    const ymLabel = String(ym).slice(4,6).replace(/^0/,"") + "月稼働分";

    const text =
      `【請求書 差し戻し】\n` +
      `PJ: ${projectName}（${projectId}） / ${ymLabel}\n` +
      `理由: ${comment}\n\n` +
      `修正前PDF: ${snap.invoicePdfUrl || "（未保存）"}\n` +
      `freee: ${snap.freeeInvoiceNumber || "-"} / ${snap.freeeInvoiceId || "-"}\n\n` +
      `▼Timelineで修正\n${timelineUrl}`;

    pmSlackIds.forEach(sid => { try{ slack_postDm(sid, text); }catch(e2){} });
  } catch(e) {
    try{
      b_appendBillingLog_({
        actionType: "SLACK_DM_INVOICE_ROLLBACK_FAIL",
        target: "slack_dm",
        projectId,
        ym,
        cycleId,
        beforeValue: "",
        afterValue: JSON.stringify({ message: String(e && (e.message || e)) }),
        reason: "slack_dm_invoice_rollback_fail",
        operatorUserId: me,
        operatorName: me,
        createdAt: b_nowIso_()
      });
    } catch(e2){}
  }

  return { ok:true, updatedAt: nowIso };
}

/** ====== Slack ボタン用パイプライン（Phase 2） ====== */

/**
 * Slackボタン「請求書を発行する」から呼ばれるワンショットパイプライン。
 * billingDate=今日、paymentDate=paymentDueRuleから自動計算 で api_issueInvoiceFreee に委譲する。
 *
 * @param {string} projectId
 * @param {string} ym YYYYMM
 * @return {Object} api_issueInvoiceFreee の返り値（{ ok, freeeInvoiceId, freeeInvoiceNumber, ... }）
 */
function b_freeeInvoicePipeline_(projectId, ym) {
  projectId = String(projectId || "").trim();
  ym = b_normYm_(ym);
  if (!projectId) throw new Error("b_freeeInvoicePipeline_: projectId empty");
  if (!ym) throw new Error("b_freeeInvoicePipeline_: ym empty");

  // 請求日 = 今日（JST）
  const today = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd");

  // 支払期日 = paymentDueRule から計算
  const recipients = b_getInvoiceRecipients_(projectId);
  const rule = String(recipients.paymentDueRule || "").trim();
  const paymentDate = b_calcPaymentDate_(today, rule);

  // ドラフトに保存済みのテンプレ / 文言があれば拾う
  const cur = b_getCycleOne_(projectId, ym) || {};
  const templateId = String(cur.freeeInvoiceTemplateId || "").trim();

  const payload = {
    issueDate: today,
    dueDate: paymentDate,
    templateId: templateId,
    invoiceSubject: String(cur.invoiceSubject || "").trim(),
    invoiceBaseLineDesc: String(cur.invoiceBaseLineDesc || "").trim(),
    invoiceReimbPrefix: String(cur.invoiceReimbPrefix || "").trim(),
    invoiceRemark: String(cur.invoiceRemark || "").trim(),
  };

  // 基本行JSON が保存済みなら復元
  try {
    const raw = String(cur.invoiceBaseLinesJson || "").trim();
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length) payload.invoiceBaseLines = arr;
    }
  } catch (_e) {}

  // 調整行JSON が保存済みなら復元
  try {
    const raw = String(cur.invoiceCustomLinesJson || "").trim();
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length) payload.lines = arr;
    }
  } catch (_e) {}

  return api_issueInvoiceFreee(projectId, ym, payload);
}

/**
 * paymentDueRule + issueDate(yyyy-MM-dd) から支払期日を算出する。
 * ルール未設定やパース不能時は翌月末にフォールバック。
 */
function b_calcPaymentDate_(issueDate, rule) {
  const d = new Date(issueDate + "T00:00:00+09:00");
  const y = d.getFullYear();
  const m = d.getMonth() + 1; // 1-12

  if (rule === "issue_month_25") {
    return b_fmtDate_(y, m, 25);
  }
  if (rule === "issue_month_eom") {
    return b_fmtDateEom_(y, m);
  }
  if (rule === "next_month_25") {
    const n = b_addMonthRaw_(y, m, 1);
    return b_fmtDate_(n.y, n.m, 25);
  }
  if (rule === "next_month_eom") {
    const n = b_addMonthRaw_(y, m, 1);
    return b_fmtDateEom_(n.y, n.m);
  }

  // EOM系フォールバック（183のルールと互換）
  const mEom = String(rule).match(/^EOM(?:\+(\d+))?$/i);
  if (mEom) {
    const add = Number(mEom[1] || 0);
    const n = b_addMonthRaw_(y, m, add);
    return b_fmtDateEom_(n.y, n.m);
  }

  // Dxx系
  const mDx = String(rule).match(/^D(\d{1,2})(?:\+(\d+))?$/i);
  if (mDx) {
    const day = Number(mDx[1]);
    const add = Number(mDx[2] || 0);
    const n = b_addMonthRaw_(y, m, add);
    return b_fmtDate_(n.y, n.m, day);
  }

  // デフォルト: 翌月末
  const nx = b_addMonthRaw_(y, m, 1);
  return b_fmtDateEom_(nx.y, nx.m);
}

function b_addMonthRaw_(y, m, delta) {
  const d = new Date(y, m - 1 + delta, 1);
  return { y: d.getFullYear(), m: d.getMonth() + 1 };
}
function b_fmtDateEom_(y, m) {
  const last = new Date(y, m, 0).getDate();
  return b_fmtDate_(y, m, last);
}
function b_fmtDate_(y, m, day) {
  const eom = new Date(y, m, 0).getDate();
  const dd = Math.min(Math.max(1, day), eom);
  return `${y}-${String(m).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

/**
 * Slackボタン「取消する」から呼ばれる請求書取消。
 * admin限定。BillingCycleの発行情報をリセットする（freee側の削除はしない）。
 *
 * @param {string} projectId
 * @param {string} ym YYYYMM
 * @param {string} freeeInvoiceId
 * @return {Object} { ok: true }
 */
function b_freeeCancelInvoice_(projectId, ym, freeeInvoiceId) {
  projectId = String(projectId || "").trim();
  ym = b_normYm_(ym);
  freeeInvoiceId = String(freeeInvoiceId || "").trim();

  if (!projectId) throw new Error("b_freeeCancelInvoice_: projectId empty");
  if (!ym) throw new Error("b_freeeCancelInvoice_: ym empty");

  // admin only
  if (!isAdmin_()) throw new Error("b_freeeCancelInvoice_: admin only");

  b_ensureBillingCycleHeader_();

  const nowIso = b_nowIso_();
  const me = (Session.getActiveUser().getEmail() || "").trim().toLowerCase();
  const cur = b_getCycleOne_(projectId, ym) || {};
  const cycleId = `${projectId}_${ym}`;

  // 発行周りをリセット（ドラフト情報は残す）
  b_upsertRow_("DB_BillingCycle", ["projectId", "ym"], {
    ...cur,
    cycleId,
    projectId,
    ym,

    invoiceIssuedAt: "",
    invoiceIssuedBy: "",
    invoicePdfUrl: "",
    invoicePdfFileId: "",
    freeeInvoiceId: "",
    freeeInvoiceNumber: "",

    invoiceReviewedAt: "",
    invoiceReviewedBy: "",
    invoiceSentAt: "",
    invoiceSentBy: "",

    updatedAt: nowIso,
  });

  // ログ
  b_appendBillingLog_({
    actionType: "INVOICE_CANCEL_SLACK",
    target: "invoice",
    projectId,
    ym,
    cycleId,
    beforeValue: JSON.stringify({
      freeeInvoiceId: String(cur.freeeInvoiceId || ""),
      freeeInvoiceNumber: String(cur.freeeInvoiceNumber || ""),
      invoicePdfUrl: String(cur.invoicePdfUrl || ""),
    }),
    afterValue: JSON.stringify({ cancelledFreeeInvoiceId: freeeInvoiceId }),
    reason: "slack_cancel_invoice",
    operatorUserId: me,
    operatorName: me,
    createdAt: nowIso,
  });

  return { ok: true };
}
