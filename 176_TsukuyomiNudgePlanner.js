/**
 * 176_TsukuyomiNudgePlanner.gs
 *
 * 役割：
 * - tsukuyomi が「今日はどのPJに介入するか」を決める
 * - 実際の投稿はしない（Queueに積むだけ）
 *
 * 前提：
 * - DB_Projects.tsukuyomiNudgeEnabled === TRUE のPJのみ対象
 * - 停滞判定は雑でOK（LLMは後段）
 * - JST基準
 */

function tsukuyomi_planDailyNudges(){
  const now = new Date();
  const nowJst = Utilities.formatDate(now, "Asia/Tokyo", "yyyy-MM-dd'T'HH:mm:ss");
  const hour = Number(Utilities.formatDate(now, "Asia/Tokyo", "H"));

  const ym = Utilities.formatDate(now, "Asia/Tokyo", "yyyyMM");

  const pjSheet = getSheet_("DB_Projects");
  ensureHeader_(pjSheet, [
    "projectId",
    "projectName",
    "slackChannelId",
    "tsukuyomiNudgeEnabled"
  ]);

  const rows = pjSheet.getDataRange().getValues();
  if (rows.length < 2) return { ok:true, planned:0 };

  const h = rows[0].map(x => String(x||"").trim());
  const idx = {};
  h.forEach((k,i)=>{ if(k) idx[k]=i; });

  const targets = [];
  for (let r=1; r<rows.length; r++){
    const enabled = String(rows[r][idx.tsukuyomiNudgeEnabled]||"").trim().toLowerCase() === "true";
    if (!enabled) continue;

    const projectId = String(rows[r][idx.projectId]||"").trim();
    if (!projectId) continue;

    targets.push({
      projectId,
      projectName: String(rows[r][idx.projectName]||"").trim(),
      slackChannelId: String(rows[r][idx.slackChannelId]||"").trim()
    });
  }

  if (!targets.length){
    return { ok:true, planned:0, note:"no enabled projects" };
  }

  // Queue sheet
  const qSheet = getSheetOrCreate_("DB_TsukuyomiNudgeQueue");
  ensureHeader_(qSheet, [
    "nudgeId",
    "projectId",
    "projectName",
    "slackChannelId",
    "ym",
    "plannedAtJst",
    "plannedHourBucket",
    "needMention",
    "mentionMemberIdsJson",
    "status",          // planned | ready | posted | skipped | merged
    "reason",
    "postedTs",
    "createdAtJst",
    "updatedAtJst"
  ]);

  let planned = 0;

  targets.forEach(pj => {
    if (_tsukuyomi_hasTodayPlan_(qSheet, pj.projectId)) return;

    const hourBucket = _tsukuyomi_pickHourBucket_(hour);

    qSheet.appendRow([
      Utilities.getUuid().replace(/-/g,""),
      pj.projectId,
      pj.projectName,
      pj.slackChannelId,
      ym,
      nowJst,
      hourBucket,
      "false",          // needMention（後段で判断）
      "[]",             // mentionMemberIdsJson
      "planned",
      "auto-planned",
      "",               // postedTs
      nowJst,
      nowJst
    ]);

    planned++;
  });

  return { ok:true, planned };
}

// ===== helpers =====

// 今日はもう計画済みか？
function _tsukuyomi_hasTodayPlan_(sheet, projectId){
  const today = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd");
  const rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return false;

  const h = rows[0].map(x=>String(x||"").trim());
  const iPid = h.indexOf("projectId");
  const iAt  = h.indexOf("plannedAtJst");
  const iSt  = h.indexOf("status");

  if (iPid<0 || iAt<0 || iSt<0) return false;

  for (let r=1; r<rows.length; r++){
    if (String(rows[r][iPid]||"") !== projectId) continue;

    const at = String(rows[r][iAt]||"");
    const st = String(rows[r][iSt]||"");
    if (!at.startsWith(today)) continue;

    if (st === "planned" || st === "posted"){
      return true;
    }
  }
  return false;
}

// 投稿時間を散らす（10-18時）
function _tsukuyomi_pickHourBucket_(nowHour){
  const start = 10;
  const end   = 18;
  const span = end - start + 1;
  return start + Math.floor(Math.random() * span);
}
