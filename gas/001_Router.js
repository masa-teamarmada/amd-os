/** 001_Router.gs
 * Webアプリのルーティング担当。
 * doGet/doPostの入口、HTMLテンプレ切替、URL生成、Nav注入など「画面の出し分け」だけを扱う。
 */
/**
 * HTML部品をテンプレ評価して返す（渡したdataをNav内で参照できる）
 * 呼び出し側は <?!= include(...) ?> を使うこと（<?= だとHTMLがエスケープされる）
 */
function include(filename, data) {
  const raw = filename;
  filename = String(filename || "").trim().replace(/\.html$/i, "");
  try {
    // ここでは評価しない。親テンプレ（Home/Charter/Billing）の evaluate 時に一緒に評価される
    return HtmlService.createHtmlOutputFromFile(filename).getContent();
  } catch (err) {
    // Bad value / not found をここで止めずに画面上に出す（デバッグ用）
    return `<!-- include failed: raw="${raw}" normalized="${filename}" err="${err}" -->`;
  }
}
function doGet(e) {
 const __BUILD__ = "20260322_2";  // デプロイごとに手動で更新する
  const mode = (e && e.parameter && e.parameter.mode) ? String(e.parameter.mode) : "";

  try{
    const pageParam = (e && e.parameter && e.parameter.page) ? String(e.parameter.page) : "";
    const pidParam = (e && e.parameter && e.parameter.projectId) ? String(e.parameter.projectId) : "";
    logAccessEvent_("doGet", {
      page: pageParam || "home",
      mode: mode || "",
      projectId: pidParam || "",
      meta: { qs: (e && e.parameter) ? e.parameter : {} }
    });
  } catch(_e){}

  // ===== mode系（既存維持） =====
  if (mode === "agree") {
    const projectId = (e.parameter.projectId || "");
    const ym = (e.parameter.ym || "");
    const version = (e.parameter.version || "");
    const memberId = (e.parameter.memberId || "");
    const token = (e.parameter.token || "");

    if (!canAccessProject_(projectId)) {
      return denyHtml_("アクセス不可", "このPJの合意リンクにアクセスする権限がないよ。PMに連絡してね。");
    }

    let ok = false;
    try {
      const res = handleAgreement_(projectId, ym, version, memberId, token);
      ok = !!(res && res.ok);
    } catch (err) {
      ok = false;
    }

    const msg = ok
      ? "合意を記録したよ。画面閉じてOK"
      : "合意の記録に失敗したよ。PMに連絡して";

    return HtmlService.createHtmlOutput(
      `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:24px;">
        <div style="font-size:18px;font-weight:900;">${msg}</div>
        <div style="margin-top:10px;color:#666;font-size:12px;">projectId=${escapeHtml_(projectId)} / ym=${escapeHtml_(ym)}</div>
      </div>`
    ).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  if (mode === "invoicepdfupload") {
    const projectId = (e.parameter.projectId || "");
    const ym = (e.parameter.ym || "");
    const freeeInvoiceId = (e.parameter.freeeInvoiceId || "");
    const token = (e.parameter.token || "");

    if (!canAccessProject_(projectId)) {
      return denyHtml_("アクセス不可", "このPJにアクセスする権限がないよ。");
    }

    const t = HtmlService.createTemplateFromFile("InvoicePdfUploadPage");
    t.projectId = String(projectId || "");
    t.ym = String(ym || "");
    t.freeeInvoiceId = String(freeeInvoiceId || "");
    t.token = String(token || "");
    t.userEmail = Session.getActiveUser().getEmail();
    t.buildVersion = __BUILD__;

    return t.evaluate()
      .setTitle("請求書PDFアップロード")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  if (mode === "invoicecancel") {
    const projectId = (e.parameter.projectId || "");
    const ym = (e.parameter.ym || "");
    const token = (e.parameter.token || "");

    if (!canAccessProject_(projectId)) {
      return denyHtml_("アクセス不可", "このPJにアクセスする権限がないよ。");
    }

    const t = HtmlService.createTemplateFromFile("InvoiceCancelConfirmPage");
    t.projectId = String(projectId || "");
    t.ym = String(ym || "");
    t.token = String(token || "");
    t.userEmail = Session.getActiveUser().getEmail();

    return t.evaluate()
      .setTitle("請求書取消（確認）")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  if (mode === "payconfirm") {
    const projectId = (e.parameter.projectId || "");
    const ym = (e.parameter.ym || "");
    const bizYm = (e.parameter.bizYm || "");
    const token = (e.parameter.token || "");

    if (!canAccessProject_(projectId)) {
      return denyHtml_("アクセス不可", "このPJの入金確認ページにアクセスする権限がないよ。");
    }

    const t = HtmlService.createTemplateFromFile("PaymentConfirmPage");
    t.projectId = String(projectId || "");
    t.ym = String(ym || "");
    t.bizYm = String(bizYm || "");
    t.token = String(token || "");
    t.userEmail = Session.getActiveUser().getEmail();

    return t.evaluate()
      .setTitle("入金確認")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  if (mode === "pwaApi") {
    return pwaApi_handle_(e);
  }

  // ===== 通常ページ =====
  const page = (e && e.parameter && e.parameter.page) ? String(e.parameter.page) : "home";
  const projectId = (e && e.parameter && e.parameter.projectId) ? String(e.parameter.projectId) : "";
  let projectName = (e && e.parameter && e.parameter.projectName) ? String(e.parameter.projectName) : "";

  // ★ここが今回の修正：projectNameが無ければDB_Projectsから補完
  projectName = routerResolveProjectName(projectId, projectName);

  // ★SPA/埋め込みモード
  // spa は明示的に spa=1 のときだけ有効（デフォは false：iframe/CSP地雷を踏まない）
  const spa = ((e && e.parameter && String(e.parameter.spa || "").trim()) === "1");
  const embed = ((e && e.parameter && String(e.parameter.embed || "").trim()) === "1");

  // ★timeline 追加（PJ配下）
  if ((page === "charter" || page === "billing" || page === "chronicle" || page === "navigator" || page === "timeline" || page === "cockpit" || page === "config") && !canAccessProject_(projectId)) {
    return denyHtml_("アクセス不可", "このPJのページにアクセスする権限がないよ。ダッシュボードから開いてね。");
  }
  if (page === "admin" && !canAccessAdminPage_()) {
    return denyHtml_("アクセス不可", "adminページにアクセスする権限がないよ。");
  }

  const baseUrl = ScriptApp.getService().getUrl();

  const HOME_FILE = "220_HomePage";
  const CHARTER_CANDIDATES = ["CharterPage", "charterpage", "charter"];

  // ★navigator 候補（番号付きにも対応）
  const NAVIGATOR_CANDIDATES = ["NavigatorPage", "navigatorpage", "navigator", "230_NavigatorPage", "230_NavigatorPage.html"];

  const BILLING_CANDIDATES = ["BillingPage", "BillingPage.html", "billingpage", "billing"];

  // ★timeline 候補（番号付きにも対応）
  const TIMELINE_CANDIDATES = ["222_TimelinePage", "222_TimelinePage.html", "TimelinePage", "timelinepage", "timeline"];

  // ★admin は 240_AdminPage を正本にする
  const ADMIN_CANDIDATES = ["240_AdminPage", "240_AdminPage.html", "AdminPage", "adminpage", "admin"];
  const REIMBURSE_CANDIDATES = ["ReimbursePage", "reimbursepage", "reimburse", "expense", "expenses"];
  const SETTINGS_CANDIDATES = ["240_SettingsPage", "SettingsPage", "settingspage", "settings"];

  let fileName = HOME_FILE;

  const SPA_SHELL_FILE = "221_PjShellPage";

  // まず通常ページ（中身ページ）を決める
  if (page === "charter") {
    fileName = (findFirstExistingHtml_(CHARTER_CANDIDATES) || "CharterPage");

  } else if (page === "navigator") {
    fileName = (findFirstExistingHtml_(NAVIGATOR_CANDIDATES) || "NavigatorPage");

  } else if (page === "billing" || page === "chronicle") {
    fileName = "227_PjChroniclePage";

  } else if (page === "timeline") {
    // ★timeline は 222 を正本
    fileName = (findFirstExistingHtml_(TIMELINE_CANDIDATES) || "222_TimelinePage");

  } else if (page === "admin") {
    fileName = findFirstExistingHtml_(ADMIN_CANDIDATES) || "240_AdminPage";

  } else if (page === "reimburse") {
    fileName = findFirstExistingHtml_(REIMBURSE_CANDIDATES) || "ReimbursePage";

  } else if (page === "settings") {
    fileName = findFirstExistingHtml_(SETTINGS_CANDIDATES) || "240_SettingsPage";
  } else if (page === "cockpit") {
    fileName = "500_CockpitPage";

  } else if (page === "config") {
    fileName = "226_ProjectConfig";

  }

  // ★PJ配下ページは、spa=1 のときだけ Shell を返す（TimelineもShellに乗せる）
  if (spa && (page === "charter" || page === "timeline" || page === "navigator")) {
    fileName = SPA_SHELL_FILE;
  }

  let t = null;
  try{
    t = HtmlService.createTemplateFromFile(fileName);
  } catch(err){
    const msg =
      "template not found\n" +
      "page=" + String(page || "") + "\n" +
      "projectId=" + String(projectId || "") + "\n" +
      "fileName=" + String(fileName || "") + "\n" +
      "spa=" + String(spa) + " embed=" + String(embed) + "\n" +
      "err=" + String(err && (err.message || err));

    return HtmlService.createHtmlOutput(
      `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:24px;">
        <div style="font-size:16px;font-weight:900;">⛔ ルーティングでテンプレが見つからない</div>
        <pre style="margin-top:12px;background:#f3f4f6;padding:12px;border-radius:12px;white-space:pre-wrap;">${escapeHtml_(msg)}</pre>
      </div>`
    ).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  // 共通値
  t.projectId = projectId;
  t.projectName = projectName;
  t.baseUrl = baseUrl;
  t.focusYm = (e && e.parameter && e.parameter.ym) ? String(e.parameter.ym).trim() : "";
  t.userEmail = Session.getActiveUser().getEmail();
  t.isAdmin = isAdmin_();
  t.canAccessAdmin = canAccessAdminPage_();
  t.currentPage = page;

  // ★SPA/埋め込みモード
  t.spa = spa;
  t.embed = embed;

  // ★重要：クエリをテンプレに注入（sandboxFrameではlocation.searchが信用できない）
  try{
    t.qsJson = JSON.stringify((e && e.parameter) ? e.parameter : {});
  } catch(_e){
    t.qsJson = "{}";
  }

  t.clientName = "";

  t.homeUrl = baseUrl + "?page=home";

  // ★URL生成（補完後projectNameを使う）
  t.charterUrl = baseUrl + "?page=charter"
    + (projectId ? "&projectId=" + encodeURIComponent(projectId) : "")
    + (projectName ? "&projectName=" + encodeURIComponent(projectName) : "");

  t.navigatorUrl = baseUrl + "?page=navigator"
    + (projectId ? "&projectId=" + encodeURIComponent(projectId) : "")
    + (projectName ? "&projectName=" + encodeURIComponent(projectName) : "");

  t.billingUrl = baseUrl + "?page=chronicle"
    + (projectId ? "&projectId=" + encodeURIComponent(projectId) : "")
    + (projectName ? "&projectName=" + encodeURIComponent(projectName) : "");

  t.chronicleUrl = t.billingUrl;

  // ★timeline URL（新規）
  t.timelineUrl = baseUrl + "?page=timeline"
    + (projectId ? "&projectId=" + encodeURIComponent(projectId) : "")
    + (projectName ? "&projectName=" + encodeURIComponent(projectName) : "");

  // ★cockpit URL
  t.cockpitUrl = baseUrl + "?page=cockpit"
    + (projectId ? "&projectId=" + encodeURIComponent(projectId) : "")
    + (projectName ? "&projectName=" + encodeURIComponent(projectName) : "");

  // ★config URL
  t.configUrl = baseUrl + "?page=config"
    + (projectId ? "&projectId=" + encodeURIComponent(projectId) : "")
    + (projectName ? "&projectName=" + encodeURIComponent(projectName) : "");

  // ★iframe用（中身だけ表示）
  // ★重要：ym / focus を iframe 側にも引き継ぐ
  function routerBuildEmbedUrl_(baseUrl, eParams){
    const p = eParams || {};
    const ym = (p.ym !== undefined && p.ym !== null) ? String(p.ym).trim() : "";
    const focus = (p.focus !== undefined && p.focus !== null) ? String(p.focus).trim() : "";

    // ★追加：直モーダル起動（Slack導線）
    const openModal = (p.openModal !== undefined && p.openModal !== null) ? String(p.openModal).trim() : "";
    const taskKey = (p.taskKey !== undefined && p.taskKey !== null) ? String(p.taskKey).trim() : "";

    const q = [];
    if (ym) q.push("ym=" + encodeURIComponent(ym));
    if (focus) q.push("focus=" + encodeURIComponent(focus));
    if (openModal) q.push("openModal=" + encodeURIComponent(openModal));
    if (taskKey) q.push("taskKey=" + encodeURIComponent(taskKey));

    const tail = q.length ? ("&" + q.join("&")) : "";
    return baseUrl + "&spa=0&embed=1" + tail;
  }

  t.charterEmbedUrl = routerBuildEmbedUrl_(t.charterUrl, (e && e.parameter) ? e.parameter : {});
  t.navigatorEmbedUrl = routerBuildEmbedUrl_(t.navigatorUrl, (e && e.parameter) ? e.parameter : {});
  t.billingEmbedUrl = routerBuildEmbedUrl_(t.billingUrl, (e && e.parameter) ? e.parameter : {});
  t.timelineEmbedUrl = routerBuildEmbedUrl_(t.timelineUrl, (e && e.parameter) ? e.parameter : {});

  // ★Shellの初期タブ
  t.initialTab = page; // charter / navigator / billing / timeline

    t.adminUrl = PropertiesService.getScriptProperties().getProperty('ADMIN_WEBAPP_URL') || baseUrl + "?page=admin";
  t.reimburseUrl = baseUrl + "?page=reimburse";
  t.settingsUrl = baseUrl + "?page=settings";

  // ===== Navをキャッシュして高速化 =====
  const userEmail = t.userEmail || "";
  const canAdmin = !!t.canAccessAdmin;

  const cache = CacheService.getUserCache();
  const navKey =
    "nav:v3:" +
    [String(page||""), String(projectId||""), String(projectName||""), String(userEmail||""), String(canAdmin)].join("|");

  let navHtml = cache.get(navKey);

  if (!navHtml) {
    const navT = HtmlService.createTemplateFromFile("Nav");
    navT.currentPage = t.currentPage;
    navT.homeUrl = t.homeUrl;
    navT.charterUrl = t.charterUrl;
    navT.navigatorUrl = t.navigatorUrl;
    navT.billingUrl = t.billingUrl;

    // ★Navへ timeline 追加（Nav側が未対応でも害なし）
    navT.timelineUrl = t.timelineUrl;
    navT.cockpitUrl = t.cockpitUrl;

    navT.adminUrl = t.adminUrl;
    navT.reimburseUrl = t.reimburseUrl;
    navT.settingsUrl = t.settingsUrl;

    navT.projectId = t.projectId;
    navT.projectName = t.projectName;
    navT.clientName = "";
    navT.userEmail = t.userEmail;
    navT.canAccessAdmin = t.canAccessAdmin;
    navT.buildVersion = __BUILD__;

    navHtml = navT.evaluate().getContent();
    cache.put(navKey, navHtml, 600);
  }

  t.navHtml = navHtml;

  return t.evaluate()
    .setTitle("AMD OS")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function findFirstExistingHtml_(names) {
  for (let i = 0; i < names.length; i++) {
    try {
      HtmlService.createTemplateFromFile(names[i]);
      return names[i];
    } catch (err) {}
  }
  return null;
}
function buildWebAppUrl(page, params) {
  const baseUrl = ScriptApp.getService().getUrl();
  const q = [];
  q.push("page=" + encodeURIComponent(page || "home"));

  const p = params || {};
  Object.keys(p).forEach(k => {
    if (p[k] === undefined || p[k] === null) return;
    const v = String(p[k]).trim();
    if (!v) return;
    q.push(encodeURIComponent(k) + "=" + encodeURIComponent(v));
  });

  return baseUrl + "?" + q.join("&");
}

function routerResolveProjectName(projectId, projectNameFromParam) {
  const pid = String(projectId || "").trim();
  const pn = String(projectNameFromParam || "").trim();
  if (!pid) return pn;
  if (pn) return pn;

  try {
    const name = routerGetProjectNameFromDbProjects(pid);
    return String(name || "").trim();
  } catch (e) {
    return "";
  }
}

function routerGetProjectNameFromDbProjects(projectId) {
  const pid = String(projectId || "").trim();
  if (!pid) return "";

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("DB_Projects");
  if (!sh) return "";

  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return "";

  const header = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(x => String(x || "").trim());
  const colProjectId = header.indexOf("projectId") + 1;
  const colProjectName = header.indexOf("projectName") + 1;
  if (colProjectId <= 0 || colProjectName <= 0) return "";

  const tf = sh.getRange(2, colProjectId, lastRow - 1, 1).createTextFinder(pid).matchEntireCell(true);
  const r = tf.findNext();
  if (!r) return "";

  const row = r.getRow();
  const name = sh.getRange(row, colProjectName).getValue();
  return String(name || "").trim();
}
