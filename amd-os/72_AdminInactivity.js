/** 72_AdminInactivity.gs
 * ライセンス運用のための非アクティブ判定担当。
 * inactiveDays算出、無償化ルール適用、日次トリガー実行/作成、手動実行を扱う。
 */
/**
 * DB_Members の inactiveDays を一括更新
 * - lastSeenAt = max(googleLastSeenAt, slackLastSeenAt)
 * - 両方空なら inactiveDays は空のまま（未計測扱い）
 * - 更新した行数を返す
 */
function updateInactiveDays_(){
  const sh = getSheet_("DB_Members");
  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2) return { ok:true, updated:0, scanned:0 };

  const header = sh.getRange(1,1,1,lastCol).getValues()[0].map(x => String(x||"").trim());
  function idx_(name){ return header.indexOf(name); }

  const iEmail = idx_("email");
  const iOsLast     = idx_("osLastSeenAt");
  const iGoogleLast = idx_("googleLastSeenAt");
  const iSlackLast  = idx_("slackLastSeenAt");
  const iInactive   = idx_("inactiveDays");
  const iUpdatedAt  = idx_("updatedAt");

  // ★追加：未計測時の基準に使う
  const iGoogleAssigned = idx_("googleAssignedAt");
  const iSlackAssigned  = idx_("slackAssignedAt");

  if (iEmail < 0) throw new Error("DB_Members header missing: email");
  if (iInactive < 0) throw new Error("DB_Members header missing: inactiveDays");
  if (iUpdatedAt < 0) throw new Error("DB_Members header missing: updatedAt");

  // osLastSeenAt が無い可能性があるので保険で生やす
  if (iOsLast < 0){
    ensureHeader_(sh, ["osLastSeenAt"]);
  }

  const range = sh.getRange(2,1,lastRow-1,lastCol);
  const values = range.getValues();

  const today = new Date();
  let updated = 0;
  let scanned = 0;

  const inactiveCol = [];
  const updatedAtCol = [];

  function parse_(v){
    return _parseDateLoose_(v); // 既存関数
  }
  function max_(a,b){
    return _maxDate_(a,b); // 既存関数
  }

  for (let r=0; r<values.length; r++){
    const row = values[r];
    const email = String(row[iEmail] || "").trim();
    if (!email){
      inactiveCol.push([row[iInactive]]);
      updatedAtCol.push([row[iUpdatedAt]]);
      continue;
    }
    scanned++;

    const os = (iOsLast>=0) ? parse_(row[iOsLast]) : null;
    const g  = (iGoogleLast>=0) ? parse_(row[iGoogleLast]) : null;
    const s  = (iSlackLast>=0)  ? parse_(row[iSlackLast])  : null;

    const lastSeen = max_(max_(os, g), s);

    // ★lastSeenが空なら assignedAt を基準にする（ログインゼロ勢も拾う）
    const gAsn = (iGoogleAssigned>=0) ? parse_(row[iGoogleAssigned]) : null;
    const sAsn = (iSlackAssigned>=0)  ? parse_(row[iSlackAssigned])  : null;
    const assignedAt = max_(gAsn, sAsn);

    let base = lastSeen || assignedAt; // ←ここが本命
    let nextInactive = "";

    if (base){
      const diff = _daysBetweenLocal_(base, today);
      nextInactive = (diff >= 0) ? diff : "";
    } else {
      // assignedAtすら無いなら未計測扱い（空のまま）
      nextInactive = "";
    }

    const prevInactiveRaw = row[iInactive];
    const prevInactive = (prevInactiveRaw === "" || prevInactiveRaw === null || prevInactiveRaw === undefined)
      ? ""
      : Number(prevInactiveRaw);

    const nextInactiveComparable = (nextInactive === "") ? "" : Number(nextInactive);
    const changed = (prevInactive !== nextInactiveComparable);

    inactiveCol.push([nextInactiveComparable === "" ? "" : nextInactiveComparable]);

    if (changed){
      updated++;
      updatedAtCol.push([new Date()]);
    } else {
      updatedAtCol.push([row[iUpdatedAt]]);
    }
  }

  sh.getRange(2, iInactive+1, lastRow-1, 1).setValues(inactiveCol);
  sh.getRange(2, iUpdatedAt+1, lastRow-1, 1).setValues(updatedAtCol);

  return { ok:true, updated, scanned };
}
/**
 * Google / Slack を別々に判定して、一定日数未使用なら無償化する
 *
 * ルール（警告なし）：
 * - googleLastSeenAt が thresholdDays 日より古い（または空）→ googleState を "free" にする
 * - slackLastSeenAt  が thresholdDays 日より古い（または空）→ slackState  を "free" にする
 *
 * 仕様メモ：
 * - 送信先：まさ＆きよ（変更があった日だけまとめて通知）
 * - 復活はいつでも手動で googleState/slackState を戻せばOK（ここではやらない）
 */
function enforceFreePlanByInactivity_(opts){
  opts = opts || {};
  const thresholdDays = Number(opts.thresholdDays || 30);

  const sh = getSheet_("DB_Members");

  // 必要ヘッダを確実に用意
  ensureHeader_(sh, [
    "email",
    "memberName",
    "codeName",
    "status",
    "googleState",
    "googleLastSeenAt",
    "slackState",
    "slackLastSeenAt",
    "updatedAt"
  ]);

  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2) return { ok:true, thresholdDays, scanned:0, changed:0, googleChanged:0, slackChanged:0, items:[] };

  const header = sh.getRange(1,1,1,lastCol).getValues()[0].map(x => String(x||"").trim());
  const iEmail = header.indexOf("email");
  const iName  = header.indexOf("memberName");
  const iCode  = header.indexOf("codeName");
  const iStatus= header.indexOf("status");

  const iGState= header.indexOf("googleState");
  const iGLast = header.indexOf("googleLastSeenAt");
  const iSState= header.indexOf("slackState");
  const iSLast = header.indexOf("slackLastSeenAt");
  const iUpd   = header.indexOf("updatedAt");

  if (iEmail < 0 || iGState < 0 || iGLast < 0 || iSState < 0 || iSLast < 0 || iUpd < 0){
    return { ok:false, message:"DB_Members headers missing (enforceFreePlanByInactivity_)" };
  }

  const vals = sh.getRange(2,1,lastRow-1,lastCol).getValues();
  const today = new Date();
  const today0 = _floorLocalDate_(today);

  const ADMIN_TO = ["masa@team-armada.jp", "kyoko@team-armada.jp"];

  function s_(v){ return String(v===null || v===undefined ? "" : v).trim(); }
  function lower_(v){ return s_(v).toLowerCase(); }

  // 「いま有償っぽい？」判定をゆるくする（既存データの揺れに耐える）
  function isPaidState_(v){
    const x = lower_(v);
    if (!x) return false;
    if (["free","unpaid","none","off","0","inactive"].includes(x)) return false;
    // paid / active / on / pro / true などは有償扱いに寄せる
    return ["paid","active","on","pro","true","1","yes","y"].includes(x) || true;
  }

  function isFreeState_(v){
    const x = lower_(v);
    return (!x) ? false : (["free","unpaid","none","off","0","inactive"].includes(x));
  }

  function toDateLoose_(v){
    // 既存の _parseDateLoose_ があるのでそれを使う
    return _parseDateLoose_(v);
  }

  function daysSince_(d){
    if (!d) return null;
    return _daysBetweenLocal_(d, today0);
  }

  let scanned = 0;
  let changed = 0;
  let googleChanged = 0;
  let slackChanged = 0;

  const items = []; // 変更内容をまとめる

  for (let r=0; r<vals.length; r++){
    const row = vals[r];

    const email = lower_(row[iEmail]);
    if (!email) continue;
    scanned++;

    const status = (iStatus >= 0) ? lower_(row[iStatus]) : "";

    // statusがinactiveなら、節約目的的に「すでに止めたい」側なので free に寄せる
    // ただし、ここで強制すると混乱するなら削ってもOK。いまは保険として残す。
    const forceFreeBecauseInactive = (status === "inactive");

    const name =
      s_(iName>=0 ? row[iName] : "") ||
      s_(iCode>=0 ? row[iCode] : "") ||
      email;

    // ---- Google ----
    const gState = s_(row[iGState]);
    const gLast  = toDateLoose_(row[iGLast]);
    const gDays  = daysSince_(gLast); // nullなら未計測
    const gNeedFree =
      forceFreeBecauseInactive ||
      (gDays !== null ? (gDays >= thresholdDays) : true); // lastSeen空なら「使ってない」扱いでfreeに寄せる

    const gIsFree = isFreeState_(gState);
    const gShouldChange = (!gIsFree && gNeedFree);

    // ---- Slack ----
    const sState = s_(row[iSState]);
    const sLast  = toDateLoose_(row[iSLast]);
    const sDays  = daysSince_(sLast);
    const sNeedFree =
      forceFreeBecauseInactive ||
      (sDays !== null ? (sDays >= thresholdDays) : true);

    const sIsFree = isFreeState_(sState);
    const sShouldChange = (!sIsFree && sNeedFree);

    if (!gShouldChange && !sShouldChange) continue;

    const rowNo = r + 2;

    const patch = { email, name, google:false, slack:false, googleDays:gDays, slackDays:sDays };

    if (gShouldChange){
      sh.getRange(rowNo, iGState+1).setValue("free");
      googleChanged++;
      changed++;
      patch.google = true;
    }

    if (sShouldChange){
      sh.getRange(rowNo, iSState+1).setValue("free");
      slackChanged++;
      changed++;
      patch.slack = true;
    }

    sh.getRange(rowNo, iUpd+1).setValue(new Date());

    items.push(patch);

    logAdminAction_("auto_downgrade_free_by_inactivity", email, patch);
  }

  // 変更があった日だけ、まさ＆きよにまとめて通知
  if (items.length){
    const lines = items.map(it => {
      const g = it.google ? `Google→free（${it.googleDays===null ? "last=空" : it.googleDays+"日" }）` : "";
      const s = it.slack  ? `Slack→free（${it.slackDays===null  ? "last=空" : it.slackDays+"日" }）` : "";
      const parts = [g,s].filter(x=>x).join(" / ");
      return `- ${it.name} <${it.email}> : ${parts}`;
    }).join("\n");

    const subject = `【AMD OS】未使用 ${thresholdDays}日で無償化：${items.length}件`;
    const body =
      `まさ＆きよへ

      未使用（${thresholdDays}日以上）判定で、Google/Slack を自動で無償プランに切り替えたよ。

      ${lines}

      復活はいつでもOK（googleState / slackState を手で戻すだけ）

      （このメールは自動送信）
      `;

    try{
      GmailApp.sendEmail(ADMIN_TO.join(","), subject, body);
    } catch(e){
      logAdminAction_("auto_downgrade_notify_failed", "", { err: String(e && (e.message||e.stack||e) ? (e.message||e.stack||e) : e) });
    }
  }

  return { ok:true, thresholdDays, scanned, changed, googleChanged, slackChanged, itemsCount: items.length };
}
/**
 * 日次トリガーで呼ぶ用（ログも残す）
 */
function cron_updateInactiveDaysDaily(){
  const osRes = updateOsLastSeenFromAccessLog_();
  const inRes = updateInactiveDays_();
  const res = { osLastSeen: osRes, inactiveDays: inRes };

  logAdminAction_("cron_updateInactiveDaysDaily", "", res);
  return { ok:true, ...res };
}
/**
 * 1日1回のトリガーを作る（既存があれば増やさない）
 */
function setupDailyInactiveDaysTrigger(){
  if (!canAccessAdminPage_()) return { ok:false, message:"access denied" };

  const fn = "cron_updateInactiveDaysDaily";
  const triggers = ScriptApp.getProjectTriggers() || [];

  const exists = triggers.some(t => {
    try { return t.getHandlerFunction && t.getHandlerFunction() === fn; }
    catch(e){ return false; }
  });

  if (exists){
    return { ok:true, created:false, message:"already exists" };
  }

  // 毎日 AM 6:00〜7:00 のどこかで実行（Google側が適当に割り当て）
  ScriptApp.newTrigger(fn)
    .timeBased()
    .everyDays(1)
    .atHour(6)
    .create();

  logAdminAction_("setupDailyInactiveDaysTrigger", "", { created:true, handler: fn });

  return { ok:true, created:true, message:"created" };
}
/**
 * 手動で今すぐ更新したい時用（adminページから叩ける）
 */
function admin_runInactiveDaysNow(){
  if (!canAccessAdminPage_()) return { ok:false, message:"access denied" };

  const osRes = updateOsLastSeenFromAccessLog_();
  const inRes = updateInactiveDays_();
  const res = { osLastSeen: osRes, inactiveDays: inRes };

  logAdminAction_("admin_runInactiveDaysNow", "", res);
  return { ok:true, ...res };
}
/**
 * inactiveDays に基づく自動通知
 * ルール：
 * - inactiveDays >= 21：本人に警告メール（1回だけ）
 * - inactiveDays >= 28：まさ&きよに通知メール（1回だけ）
 * - 以後は手動で「有償→無償」を切り替える（この処理では切替しない）
 *
 * 既存列を利用：
 * - licenseNoticeStage: none / warned / final / done
 * - licenseLastNotifiedAt: 本人通知の最終日
 *
 * ★追加列（無ければ自動で生やす）
 * - licenseFinalNotifiedAt: 管理者通知の最終日
 *
 * 例外：
 * - licenseExemptReason が入ってる人は通知しない（免除扱い）
 * - status === "inactive" の人は stage を done に寄せて通知しない
 */
function notifyInactiveUsersByRule_(){
  // 廃止：警告メール運用をやめたため
  return { ok:true, skipped:true };
}