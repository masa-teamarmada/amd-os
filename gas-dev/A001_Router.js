// A001_Router.gs
// AMD-Admin GAS Webアプリのルーティング担当。
// adminページのみを提供する。

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(
    String(filename || "").trim().replace(/\.html$/i, "")
  ).getContent();
}

function doGet(e) {
  if (!canAccessAdminPage_()) {
    return HtmlService.createHtmlOutput(
      '<div style="font-family:system-ui;padding:24px;">' +
      '<div style="font-size:18px;font-weight:900;">アクセス不可</div>' +
      '<div style="margin-top:10px;color:#444;">adminページにアクセスする権限がないよ。</div>' +
      '</div>'
    ).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  var t = HtmlService.createTemplateFromFile('A240_AdminPage');
  t.userEmail = Session.getActiveUser().getEmail();
  t.isAdmin = isAdmin_();
  t.canAccessAdmin = canAccessAdminPage_();
  t.baseUrl = ScriptApp.getService().getUrl();

  return t.evaluate()
    .setTitle('AMD Admin')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}