/**
 * R315_MonthlySlide_Cron.gs
 * 月次進捗スライドの日次自動生成トリガー。
 * 毎日4:00 AMに実行。313の月次報告書生成（3:00/3:30）の後に走る想定。
 *
 * 依存: 314_MonthlySlide_Gen.gs, DB_Projects, DB_MonthlyReports, DB_BillingCycle
 */

/**
 * トリガー登録（手動実行）
 * 既存トリガーを削除してから4:00 AMを登録
 */
function setup_slideGenCronAt4() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "run_slideGenCron") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger("run_slideGenCron")
    .timeBased()
    .atHour(4)
    .everyDays(1)
    .create();
  Logger.log("[setup_slideGenCronAt4] trigger created at 4:00 AM");
  return { ok: true };
}

/**
 * トリガーから呼ばれるエントリーポイント
 */
function run_slideGenCron() {
  return cron_generateMonthlySlides_();
}

/**
 * 全アクティブPJの当月スライドを生成（未生成 or 更新あり のみ）
 */
function cron_generateMonthlySlides_() {
  var start = Date.now();
  var LIMIT_MS = 5 * 60 * 1000;  // 5分ガード

  var now = new Date();
  var currentYm = String(now.getFullYear()) + String(now.getMonth() + 1).padStart(2, "0");
  var todayCutoff = new Date(now.getTime() - 20 * 60 * 60 * 1000).toISOString();

  // テンプレID未設定なら即終了
  if (!slide_getTemplateId_()) {
    Logger.log("[slideCron] MONTHLY_REPORT_SLIDE_TEMPLATE_IDが未設定。スキップ。");
    return { ok: false, error: "MONTHLY_REPORT_SLIDE_TEMPLATE_ID未設定" };
  }

  var results = [];

  try {
    var projects = b_cachedReadProjects_();
  } catch (e) {
    return { ok: false, error: "PJ一覧取得失敗: " + e };
  }

  for (var i = 0; i < projects.length; i++) {
    if (Date.now() - start > LIMIT_MS) {
      results.push({ status: "timeout", remaining: projects.length - i });
      break;
    }

    var pj = projects[i];
    var pid = String(pj.projectId || "").trim();
    if (!pid) continue;

    // activeでないPJはスキップ
    if (String(pj.status || "").toLowerCase() !== "active") continue;

    // startYm/endYmチェック
    var startYm = String(pj.startYm || "").trim();
    var endYm = String(pj.endYm || "").trim();
    if (startYm && startYm > currentYm) continue;
    if (endYm && endYm < currentYm) continue;

    // BillingCycleに当月行があるか
    try {
      var cycle = b_getCycleOne_(pid, currentYm);
      if (!cycle) {
        results.push({ projectId: pid, ym: currentYm, status: "no_cycle" });
        continue;
      }
    } catch (e) {
      results.push({ projectId: pid, ym: currentYm, status: "cycle_error", error: String(e) });
      continue;
    }

    // DB_MonthlyReportsに当月の報告書があるか
    try {
      var report = mr_repo_getByProjectYm_(pid, currentYm);
      if (!report || !report.draftContent) {
        results.push({ projectId: pid, ym: currentYm, status: "no_report" });
        continue;
      }
    } catch (e) {
      results.push({ projectId: pid, ym: currentYm, status: "report_error", error: String(e) });
      continue;
    }

    // 既存スライドの更新日チェック（今日すでに作成済みならスキップ）
    try {
      var existingSlideId = String(report.slideFileId || "").trim();
      if (existingSlideId) {
        var slideFile = DriveApp.getFileById(existingSlideId);
        var lastUpdated = slideFile.getLastUpdated();
        if (lastUpdated && lastUpdated.toISOString() > todayCutoff) {
          results.push({ projectId: pid, ym: currentYm, status: "already_updated_today" });
          continue;
        }
        // 既存スライドがある場合は削除して再生成（上書き相当）
        try { DriveApp.getFileById(existingSlideId).setTrashed(true); } catch (e) {}
      }
    } catch (e) {
      // slideFileIdが無効（削除済み等）→ 新規生成に進む
    }

    // スライド生成
    try {
      var genRes = slide_generateForProject(pid, currentYm);
      results.push({
        projectId: pid,
        ym: currentYm,
        status: (genRes && genRes.ok) ? "generated" : "gen_failed",
        slideId: (genRes && genRes.slideId) || "",
        error: (genRes && !genRes.ok) ? String(genRes.error || "") : ""
      });
    } catch (e) {
      results.push({ projectId: pid, ym: currentYm, status: "gen_error", error: String(e) });
    }
  }

  Logger.log("[slideCron] 完了: " + JSON.stringify(results));
  return { ok: true, currentYm: currentYm, results: results };
}

/**
 * テスト用: 特定PJ×ymのスライドを手動生成
 */
function test_slideGen() {
  var res = slide_generateForProject("p21", "202601");
  Logger.log(JSON.stringify(res));
}