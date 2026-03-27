/**
 * A167_DevDocsExport.gs
 * 設計ログ＋ファイル台帳をGoogle Docsに自動エクスポート。
 * claudeがgoogle_drive_fetchで直接読めるようにする。
 *
 * 方針：
 * - 1つのGoogle Docに「設計ログ」と「ファイル台帳」を両方書く
 * - 毎日3時のcron（165から呼ばれる）で全件上書き
 * - DocのIDはScriptPropertiesに自動保存（初回だけ自動作成）
 *
 * 依存：
 * - 166_DesignLogRepo.gs（designLog_getAll）
 * - 165_CodeRegistryOps.gs（admin_getCodeRegistry）
 * - DEV_SHEET_ID（ScriptProperties）— Docsの保存先フォルダ特定用
 */

var DEV_EXPORT_DOC_KEY_ = "DEV_EXPORT_DOC_ID";

/* ============================================
 * 公開：エクスポート実行（cron or 手動）
 * ファイル: 167_DevDocsExport.gs
 * ============================================ */
function devExport_syncToDoc() {
  var doc = devExport_getOrCreateDoc_();
  var body = doc.getBody();
  body.clear();

  var now = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy年M月d日 HH:mm");

  body.appendParagraph("AMD OS 開発コンテキスト")
      .setHeading(DocumentApp.ParagraphHeading.HEADING1);
  body.appendParagraph("最終更新: " + now);
  body.appendParagraph("");

  body.appendParagraph("設計ログ（Design Log）")
      .setHeading(DocumentApp.ParagraphHeading.HEADING2);

  var logResult = designLog_getAll();
  var logs = (logResult && logResult.logs) ? logResult.logs : [];

  if (!logs.length) {
    body.appendParagraph("（ログなし）");
  } else {
    for (var i = logs.length - 1; i >= 0; i--) {
      var l = logs[i];
      var line = (l.datetime || "?") + " [" + (l.category || "?") + "] "
        + (l.targetFiles || "")
        + "\n何をしたか: " + (l.summary || "")
        + (l.reason ? "\nなぜ: " + l.reason : "")
        + (l.sessionNote ? "\n備考: " + l.sessionNote : "");
      body.appendParagraph(line).setHeading(DocumentApp.ParagraphHeading.NORMAL);
      body.appendHorizontalRule();
    }
  }

  body.appendParagraph("");

  body.appendParagraph("ファイル台帳（Code Registry）")
      .setHeading(DocumentApp.ParagraphHeading.HEADING2);

  var regResult = admin_getCodeRegistry();
  var rows = (regResult && regResult.rows) ? regResult.rows : [];

  if (!rows.length) {
    body.appendParagraph("（台帳なし。admin_rebuildCodeRegistry() を実行して）");
  } else {
    for (var j = 0; j < rows.length; j++) {
      var r = rows[j];
      var rLine = (r.fileNumber || "???") + " " + (r.fileName || "")
        + " (" + (r.fileType || "") + ", " + (r.lineCount || 0) + "行)"
        + "\n役割: " + (r.headerComment || "（なし）").substring(0, 300)
        + "\n公開関数: " + (r.publicFunctions || "（なし）");
      body.appendParagraph(rLine).setHeading(DocumentApp.ParagraphHeading.NORMAL);
      body.appendHorizontalRule();
    }
  }

  body.appendParagraph("");
  body.appendParagraph("--- exported by 167_DevDocsExport.gs ---");

  doc.saveAndClose();
  Logger.log("[DevExport] synced to Doc: " + doc.getId() + " (" + logs.length + " logs, " + rows.length + " files)");
  return { ok: true, docId: doc.getId(), logCount: logs.length, fileCount: rows.length };
}

// 設計ログ1件だけDocに追記（designLog_appendから呼ぶ軽量版）
function devExport_appendLogEntry(logObj) {
  try {
    var doc = devExport_getOrCreateDoc_();
    var body = doc.getBody();

    // 「設計ログ」見出しの直後に挿入するため末尾追記で代用
    var line = (logObj.datetime || "?") + " [" + (logObj.category || "?") + "] "
      + (logObj.targetFiles || "")
      + "\n何をしたか: " + (logObj.summary || "")
      + (logObj.reason ? "\nなぜ: " + logObj.reason : "")
      + (logObj.sessionNote ? "\n備考: " + logObj.sessionNote : "");

    // 末尾の「--- exported ---」行の直前に挿入
    var numChildren = body.getNumChildren();
    var insertIndex = numChildren - 1;
    body.insertParagraph(insertIndex, line);
    body.insertHorizontalRule(insertIndex + 1);

    doc.saveAndClose();
  } catch(e) {
    Logger.log("[devExport_appendLogEntry] failed: " + e);
  }
}

/* ---- 内部：Doc取得 or 初回作成 ---- */
function devExport_getOrCreateDoc_() {
  var props = PropertiesService.getScriptProperties();
  var docId = props.getProperty(DEV_EXPORT_DOC_KEY_);

  // 既存Docがあるか試す
  if (docId) {
    try {
      return DocumentApp.openById(docId);
    } catch(e) {
      Logger.log("[DevExport] 既存Doc開けず、再作成: " + e);
    }
  }

  // 新規作成（DEVスプシと同じフォルダに置く）
  var doc = DocumentApp.create("AMD_OS_開発コンテキスト");
  var newId = doc.getId();

  // DEVスプシのフォルダに移動
  try {
    var devSsId = props.getProperty("DEV_SHEET_ID");
    if (devSsId) {
      var ssFile = DriveApp.getFileById(devSsId);
      var folders = ssFile.getParents();
      if (folders.hasNext()) {
        var folder = folders.next();
        folder.addFile(DriveApp.getFileById(newId));
        DriveApp.getRootFolder().removeFile(DriveApp.getFileById(newId));
      }
    }
  } catch(e) {
    Logger.log("[DevExport] フォルダ移動スキップ: " + e);
  }

  props.setProperty(DEV_EXPORT_DOC_KEY_, newId);
  Logger.log("[DevExport] 新規Doc作成: " + newId);
  return doc;
}