/** 152_NavigatorCron.gs
 * 役割：
 * - 毎日 深夜3時（JST）に、今月分のMonthly Extractを自動生成（draft更新）する
 * - ボタン実行（nav_runMonthlyExtract）も残しつつ、普段は自動更新でストレスを消す
 *
 * 注意：
 * - どのPJを対象にするかは nav_cron_listTargetProjectIds_ に寄せる
 * - “JST表示” はプロジェクトのタイムゾーン設定に依存するので、Asia/Tokyoになってる前提
 */

var NAV_MONTHLY_EXTRACT_CRON_DISABLED_20260522 = true;

// ===== 手動で一回だけ実行：トリガーを作る =====
function nav_setupMonthlyExtractCronAt3(){
  if (NAV_MONTHLY_EXTRACT_CRON_DISABLED_20260522) return nav_disableMonthlyExtractCronAt3_();
  // 既存の同名トリガーを掃除（重複事故防止）
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => {
    if (t.getHandlerFunction && t.getHandlerFunction() === "nav_cronMonthlyExtractAt3"){
      ScriptApp.deleteTrigger(t);
    }
  });

  // 毎日3時
  ScriptApp.newTrigger("nav_cronMonthlyExtractAt3")
    .timeBased()
    .atHour(3)
    .everyDays(1)
    .create();

  Logger.log("[nav_setupMonthlyExtractCronAt3] created trigger");
  return { ok:true };
}

// ===== Cron本体：毎日3時に呼ばれる =====
function nav_cronMonthlyExtractAt3(){
  if (NAV_MONTHLY_EXTRACT_CRON_DISABLED_20260522) {
    return { ok: true, disabled: true, message: "Monthly extract fallback cron disabled. Use Codex automation/review batches." };
  }
  const ym = nav_cron_getCurrentYm_();
  const pids = nav_cron_listTargetProjectIds_();

  const out = {
    ok: true,
    ym: ym,
    targetCount: pids.length,
    results: []
  };

  for (let i=0; i<pids.length; i++){
    const projectId = String(pids[i] || "").trim();
    if (!projectId) continue;

    try{
      const res = nav_repo_makeMonthlyExtractDraft_(projectId, ym);
      out.results.push({
        projectId: projectId,
        ok: !!(res && res.ok),
        message: res && res.message ? String(res.message) : ""
      });
    } catch(e){
      out.results.push({
        projectId: projectId,
        ok: false,
        message: String(e && (e.message || e.stack || e) ? (e.message || e.stack || e) : e)
      });
    }

    // ★ MTG サマリ抽出 (Phase 2 月単位 fallback、Supabase project_meeting_summaries)
    // 仕様: pwa/design/meeting_summaries.md
    // - Phase 3 (153_MeetingHourlyTrigger) の「会議終了 +60 分 trigger」が正規ルート
    // - これは「終了 +60 分が過ぎてた = 過去の会議」「trigger 抜け落ち」等の拾い漏れ救済 fallback
    // - 差分検知 (source_hash) があるので Phase 3 で抽出済の event は LLM 呼ばずスキップ
    try{
      if (typeof nav_meeting_extractForProjectYm_ === "function"){
        const mres = nav_meeting_extractForProjectYm_(projectId, ym);
        out.results.push({
          projectId: projectId,
          phase: "meeting_summary_fallback",
          ok: !!(mres && mres.ok),
          processed: (mres && mres.processed) || 0,
          skipped: (mres && mres.skipped) || 0,
          errors: (mres && mres.errors) || 0,
          message: (mres && mres.message) || ""
        });
      }
    } catch(e){
      out.results.push({
        projectId: projectId,
        phase: "meeting_summary_fallback",
        ok: false,
        message: String(e && (e.message || e.stack || e) ? (e.message || e.stack || e) : e)
      });
    }
  }

  // ★ Phase 3 polling は別 trigger (毎時 0 分の nav_meeting_pollRecentlyEndedEvents)
  // 153_MeetingHourlyTrigger.js — setup 関数 nav_meeting_setupHourlyPollTrigger_() を 1 度実行で稼働開始
  // 03:00 daily からは呼ばない (毎時独立 trigger)

  Logger.log("[nav_cronMonthlyExtractAt3]\n" + JSON.stringify(out, null, 2));
  return out;
}

function nav_disableMonthlyExtractCronAt3_(){
  const triggers = ScriptApp.getProjectTriggers();
  let removed = 0;
  triggers.forEach(t => {
    if (t.getHandlerFunction && t.getHandlerFunction() === "nav_cronMonthlyExtractAt3"){
      try { ScriptApp.deleteTrigger(t); removed++; } catch(e) {}
    }
  });
  return { ok:true, disabled:true, removed };
}

function nav_cron_getCurrentYm_(){
  const d = new Date();
  const y = d.getFullYear();
  const m = ("0" + (d.getMonth()+1)).slice(-2);
  return String(y) + String(m); // yyyymm
}

/**
 * 対象PJの決め方
 * - まずはDB_Projectsの status が active/frozen あたりを対象にするのが無難
 * - ただし、ここはまさの運用に合わせて調整しやすいように関数化してある
 */
function nav_cron_listTargetProjectIds_(){
  const sh = getSheet_("DB_Projects");
  const header = ensureHeader_(sh, ["projectId","status"]);

  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2) return [];

  const values = sh.getRange(1,1,lastRow,lastCol).getValues();
  const head = values[0].map(x=>String(x||"").trim());
  const idx = (name)=>head.indexOf(name);

  const iPid = idx("projectId");
  const iStatus = idx("status");
  if (iPid < 0) return [];

  const out = [];
  const seen = {};
  for (let r=1; r<values.length; r++){
    const row = values[r];
    const pid = String(row[iPid]||"").trim();
    if (!pid) continue;
    if (seen[pid]) continue;

    const st = (iStatus >= 0) ? String(row[iStatus]||"").trim().toLowerCase() : "";
    // 対象：active / frozen（必要なら増やす）
    if (st && st !== "active" && st !== "frozen") continue;

    seen[pid] = true;
    out.push(pid);
  }
  return out;
}
