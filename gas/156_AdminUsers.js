/** 156_AdminUsers.gs
 * Admin（ユーザー管理）担当。
 * DB_Membersの一覧取得、role/status更新、通知ステージ更新、ダウングレード通知メール送信を扱う。
 */
function listAdminUsers(){
  // adminページ閲覧可の2人だけ
  if (!canAccessAdminPage_()) return { ok:false, message:"access denied", users:[] };

  const sh = getSheet_("DB_Members");

  // ★joinYm/leaveYm も含めてヘッダ保証（手書き禁止ルール）
  ensureHeader_(sh, ["joinYm","leaveYm","isAdmin","notifyChannel","roleTag","status","updatedAt"]);

  const vals = sh.getDataRange().getValues();
  if (!vals || vals.length < 2) return { ok:true, users:[], meta:{ generatedAtJst:"", membersUpdatedAtMax:"" } };

  const h = vals[0].map(x => String(x||"").trim());

  function idx_(name){ return h.indexOf(name); }
  function get_(row, i){ return (i>=0 && row && row.length>i) ? row[i] : ""; }
  function s_(v){ return String(v===null || v===undefined ? "" : v).trim(); }
  function lower_(v){ return s_(v).toLowerCase(); }

  const iMemberId = idx_("memberId");
  const iName     = idx_("memberName");
  const iCode     = idx_("codeName");
  const iStatus   = idx_("status");
  const iRole     = idx_("roleTag");
  const iEmail    = idx_("email");
  const iUpdated  = idx_("updatedAt");

  const iNotifyChannel = idx_("notifyChannel");
  const iSlackId       = idx_("slackId");

  const iIsAdmin       = idx_("isAdmin");

  // ★追加：join/leave
  const iJoinYm        = idx_("joinYm");
  const iLeaveYm       = idx_("leaveYm");

  const iOsLast       = idx_("osLastSeenAt");

  const iGoogleState  = idx_("googleState");
  const iGoogleLast   = idx_("googleLastSeenAt");
  const iGoogleAsn    = idx_("googleAssignedAt");

  const iSlackState   = idx_("slackState");
  const iSlackLast    = idx_("slackLastSeenAt");
  const iSlackAsn     = idx_("slackAssignedAt");

  const iLastNotified = idx_("licenseLastNotifiedAt");
  const iStage        = idx_("licenseNoticeStage");

  const BASELINE = new Date(2026, 0, 14, 0, 0, 0, 0);

  function toDateLoose_(v){
    return _parseDateLoose_(v);
  }

  function daysSince_(baseDate, today){
    if (!baseDate) return "";
    const diff = _daysBetweenLocal_(baseDate, today);
    return (diff >= 0) ? diff : "";
  }

  function toYmd_(v){
    if (!v) return "";
    if (v instanceof Date && !isNaN(v.getTime())) {
      const y = v.getFullYear();
      const m = String(v.getMonth()+1).padStart(2,"0");
      const d = String(v.getDate()).padStart(2,"0");
      return `${y}-${m}-${d}`;
    }
    const s = String(v).trim();
    if (!s) return "";
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth()+1).padStart(2,"0");
      const dd = String(d.getDate()).padStart(2,"0");
      return `${y}-${m}-${dd}`;
    }
    return s;
  }

  const today = new Date();

  let maxUpd = "";
  try{
    if (iUpdated >= 0){
      for (let r=1; r<vals.length; r++){
        const s = toYmd_(vals[r][iUpdated]);
        if (s && s > maxUpd) maxUpd = s;
      }
    }
  } catch(e){}

  const out = [];
  for (let r=1; r<vals.length; r++){
    const row = vals[r];

    const email = lower_(get_(row, iEmail));
    if (!email) continue;

    const memberId = s_(get_(row, iMemberId));
    const codeName = s_(get_(row, iCode));
    const memberName = s_(get_(row, iName));
    const displayName = memberName || codeName || email;

    const role = s_(get_(row, iRole));
    const status = s_(get_(row, iStatus));

    const notifyChannel = lower_(get_(row, iNotifyChannel)) || "gmail";
    const slackId = s_(get_(row, iSlackId));

    const isAdminRaw = lower_(get_(row, iIsAdmin));
    const isAdmin = (isAdminRaw === "true" || isAdminRaw === "1" || isAdminRaw === "yes") ? "true" : "false";

    // ★追加：join/leave（空OK、文字列のまま）
    const joinYm = s_(get_(row, iJoinYm));
    const leaveYm = s_(get_(row, iLeaveYm));

    const osLast = toDateLoose_(get_(row, iOsLast));

    const gLast = toDateLoose_(get_(row, iGoogleLast));
    const gAsn  = toDateLoose_(get_(row, iGoogleAsn));

    const sLast = toDateLoose_(get_(row, iSlackLast));
    const sAsn  = toDateLoose_(get_(row, iSlackAsn));

    const osBase = osLast || BASELINE;
    const gBase  = gLast || gAsn || BASELINE;
    const slBase = sLast || sAsn || BASELINE;

    const osInactiveDays = daysSince_(osBase, today);
    const googleInactiveDays = daysSince_(gBase, today);
    const slackInactiveDays = daysSince_(slBase, today);

    out.push({
      memberId,
      codeName,
      email,
      displayName,

      role,
      status,

      // ★追加
      joinYm,
      leaveYm,

      notifyChannel,
      slackId,

      isAdmin,

      osInactiveDays,
      googleInactiveDays,
      slackInactiveDays,

      osLastSeenAt: toYmd_(get_(row, iOsLast)) || "",
      googleState: s_(get_(row, iGoogleState)),
      googleLastSeenAt: toYmd_(get_(row, iGoogleLast)) || "",
      slackState: s_(get_(row, iSlackState)),
      slackLastSeenAt: toYmd_(get_(row, iSlackLast)) || "",

      licenseLastNotifiedAt: (iLastNotified>=0) ? toYmd_(get_(row, iLastNotified)) : "",
      licenseNoticeStage: (iStage>=0) ? s_(get_(row, iStage)) : "",
    });
  }

  out.sort((a,b)=> String(a.memberId||"").localeCompare(String(b.memberId||""), "ja"));

  const nowJst = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd'T'HH:mm:ssXXX");

  return {
    ok:true,
    users: out,
    meta: {
      generatedAtJst: nowJst,
      membersUpdatedAtMax: maxUpd || ""
    }
  };
}

function admin_updateMemberRoleStatus(payload){
  // ★adminページ閲覧可の2人だけ（まさ/きよ）
  if (!canAccessAdminPage_()) return { ok:false, message:"access denied" };

  payload = payload || {};
  const memberId = String(payload.memberId || "").trim();
  if (!memberId) return { ok:false, message:"memberId empty" };

  const nextRoleTag = String(payload.role || "").trim();
  const nextStatus  = String(payload.status || "").trim();
  const nextNotify  = String(payload.notifyChannel || "").trim().toLowerCase();

  const nextIsAdminRaw = String(payload.isAdmin || "").trim().toLowerCase();
  const nextIsAdmin = (nextIsAdminRaw === "true" || nextIsAdminRaw === "1" || nextIsAdminRaw === "yes") ? "true" : "false";

  // ★追加：join/leave
  const nextJoinYm = String(payload.joinYm || "").trim();
  const nextLeaveYm = String(payload.leaveYm || "").trim();

  function isValidYm(s){
    const v = String(s || "").trim();
    if (!v) return true;              // 空OK
    if (!/^\d{6}$/.test(v)) return false;
    const mm = Number(v.slice(4,6));
    return (mm >= 1 && mm <= 12);
  }

  if (!isValidYm(nextJoinYm)) return { ok:false, message:"invalid joinYm (yyyymm or empty): " + nextJoinYm };
  if (!isValidYm(nextLeaveYm)) return { ok:false, message:"invalid leaveYm (yyyymm or empty): " + nextLeaveYm };

  const allowStatus = new Set(["", "active", "inactive", "paused"]);
  if (!allowStatus.has(nextStatus.toLowerCase())) {
    return { ok:false, message:"invalid status: " + nextStatus };
  }

  if (/[<>"']/.test(nextRoleTag)) {
    return { ok:false, message:"invalid roleTag (contains forbidden chars)" };
  }

  const allowNotify = new Set(["", "gmail", "slack"]);
  if (!allowNotify.has(nextNotify)) {
    return { ok:false, message:"invalid notifyChannel: " + nextNotify };
  }
  const fixedNotify = nextNotify || "gmail";

  const sh = getSheet_("DB_Members");
  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2) return { ok:false, message:"no members" };

  // ★必要列を保証（join/leave 追加）
  const header = ensureHeader_(sh, ["memberId","status","roleTag","notifyChannel","isAdmin","joinYm","leaveYm","updatedAt"]);
  const h = header.map(x => String(x||"").trim());

  const iMemberId = h.indexOf("memberId");
  const iStatus   = h.indexOf("status");
  const iRoleTag  = h.indexOf("roleTag");
  const iNotify   = h.indexOf("notifyChannel");
  const iIsAdmin  = h.indexOf("isAdmin");
  const iJoinYm   = h.indexOf("joinYm");
  const iLeaveYm  = h.indexOf("leaveYm");
  const iUpdated  = h.indexOf("updatedAt");

  if (iMemberId < 0) return { ok:false, message:"DB_Members missing memberId" };
  if (iStatus < 0)   return { ok:false, message:"DB_Members missing status" };
  if (iRoleTag < 0)  return { ok:false, message:"DB_Members missing roleTag" };
  if (iNotify < 0)   return { ok:false, message:"DB_Members missing notifyChannel" };
  if (iIsAdmin < 0)  return { ok:false, message:"DB_Members missing isAdmin" };
  if (iJoinYm < 0)   return { ok:false, message:"DB_Members missing joinYm" };
  if (iLeaveYm < 0)  return { ok:false, message:"DB_Members missing leaveYm" };
  if (iUpdated < 0)  return { ok:false, message:"DB_Members missing updatedAt" };

  const vals = sh.getRange(2,1,lastRow-1,lastCol).getValues();
  let hitRow = -1;

  let prevStatus = "";
  let prevRoleTag = "";
  let prevNotify = "";
  let prevIsAdmin = "false";
  let prevJoinYm = "";
  let prevLeaveYm = "";

  for (let r=0; r<vals.length; r++){
    const mid = String(vals[r][iMemberId] || "").trim();
    if (mid !== memberId) continue;

    hitRow = r + 2;

    prevStatus  = String(vals[r][iStatus] || "").trim();
    prevRoleTag = String(vals[r][iRoleTag] || "").trim();
    prevNotify  = String(vals[r][iNotify] || "").trim().toLowerCase() || "gmail";

    const pia = String(vals[r][iIsAdmin] || "").trim().toLowerCase();
    prevIsAdmin = (pia === "true" || pia === "1" || pia === "yes") ? "true" : "false";

    prevJoinYm = String(vals[r][iJoinYm] || "").trim();
    prevLeaveYm = String(vals[r][iLeaveYm] || "").trim();
    break;
  }
  if (hitRow < 0) return { ok:false, message:"member not found: " + memberId };

  const changed =
    (prevStatus !== nextStatus) ||
    (prevRoleTag !== nextRoleTag) ||
    (prevNotify !== fixedNotify) ||
    (prevIsAdmin !== nextIsAdmin) ||
    (prevJoinYm !== nextJoinYm) ||
    (prevLeaveYm !== nextLeaveYm);

  if (!changed) {
    return {
      ok:true,
      changed:false,
      memberId,
      status:prevStatus,
      roleTag:prevRoleTag,
      notifyChannel: prevNotify,
      isAdmin: prevIsAdmin,
      joinYm: prevJoinYm,
      leaveYm: prevLeaveYm
    };
  }

  sh.getRange(hitRow, iStatus+1).setValue(nextStatus);
  sh.getRange(hitRow, iRoleTag+1).setValue(nextRoleTag);
  sh.getRange(hitRow, iNotify+1).setValue(fixedNotify);
  sh.getRange(hitRow, iIsAdmin+1).setValue(nextIsAdmin);

  // ★追加
  sh.getRange(hitRow, iJoinYm+1).setValue(nextJoinYm);
  sh.getRange(hitRow, iLeaveYm+1).setValue(nextLeaveYm);

  sh.getRange(hitRow, iUpdated+1).setValue(new Date());

  logAdminAction_("admin_update_member_role_status", "", {
    memberId,
    prev: { status: prevStatus, roleTag: prevRoleTag, notifyChannel: prevNotify, isAdmin: prevIsAdmin, joinYm: prevJoinYm, leaveYm: prevLeaveYm },
    next: { status: nextStatus, roleTag: nextRoleTag, notifyChannel: fixedNotify, isAdmin: nextIsAdmin, joinYm: nextJoinYm, leaveYm: nextLeaveYm }
  });

  return {
    ok:true,
    changed:true,
    memberId,
    status:nextStatus,
    roleTag:nextRoleTag,
    notifyChannel: fixedNotify,
    isAdmin: nextIsAdmin,
    joinYm: nextJoinYm,
    leaveYm: nextLeaveYm
  };
}

function admin_updateNoticeStage(payload){
  if (!canAccessAdminPage_()) return { ok:false, message:"access denied" };

  payload = payload || {};
  const targetEmail = String(payload.email || "").toLowerCase().trim();
  const nextStage = String(payload.stage || "").trim(); // none / warned / final / done
  const memo = String(payload.memo || "").trim();

  if (!targetEmail) return { ok:false, message:"email empty" };
  if (!nextStage) return { ok:false, message:"stage empty" };

  const allow = new Set(["none","warned","final","done"]);
  if (!allow.has(nextStage)) return { ok:false, message:"invalid stage: " + nextStage };

  const sh = getSheet_("DB_Members");
  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2) return { ok:false, message:"no members" };

  const header = sh.getRange(1,1,1,lastCol).getValues()[0].map(x => String(x||"").trim());
  const iEmail = header.indexOf("email");
  const iStage = header.indexOf("licenseNoticeStage");
  const iLastNotified = header.indexOf("licenseLastNotifiedAt");
  const iMemo = header.indexOf("licenseActionMemo");
  const iUpdatedAt = header.indexOf("updatedAt");

  if (iEmail < 0) return { ok:false, message:"DB_Members missing email" };
  if (iStage < 0) return { ok:false, message:"DB_Members missing licenseNoticeStage" };
  if (iLastNotified < 0) return { ok:false, message:"DB_Members missing licenseLastNotifiedAt" };
  if (iUpdatedAt < 0) return { ok:false, message:"DB_Members missing updatedAt" };

  // 該当行を探す
  const values = sh.getRange(2,1,lastRow-1,lastCol).getValues();
  let hitRow = -1;
  for (let r=0; r<values.length; r++){
    const em = String(values[r][iEmail] || "").toLowerCase().trim();
    if (em === targetEmail){ hitRow = r + 2; break; }
  }
  if (hitRow < 0) return { ok:false, message:"member not found: " + targetEmail };

  const now = new Date();
  const nowJst = Utilities.formatDate(now, "Asia/Tokyo", "yyyy-MM-dd");

  // 更新
  sh.getRange(hitRow, iStage+1).setValue(nextStage);
  sh.getRange(hitRow, iLastNotified+1).setValue(nowJst);
  if (iMemo >= 0 && memo) sh.getRange(hitRow, iMemo+1).setValue(memo);
  sh.getRange(hitRow, iUpdatedAt+1).setValue(now);

  // ログ
  logAdminAction_("updateNoticeStage", targetEmail, {
    stage: nextStage,
    memo: memo || "",
    atJst: nowJst
  });

  return { ok:true, email: targetEmail, stage: nextStage, at: nowJst };
}
function admin_sendGoogleDowngradeNotice(memberEmail){
  const email = String(memberEmail || "").trim().toLowerCase();
  if (!email) return { ok:false, message:"memberEmail empty" };

  // adminページ閲覧可の2人だけ
  if (!canAccessAdminPage_()) return { ok:false, message:"access denied" };

  const INFO = "info@team-armada.jp";

  const subject = "【AMD】Google無償プランへの切替予定のお知らせ";
  const body =
    `Google inactive days>30となったため無償プランに切り替えます。
    有償プランに戻す必要が生じたらマネージャーに言ってね！`;

  try{
    GmailApp.sendEmail(email, subject, body, {
      name: "チームアルマダ",
      replyTo: INFO,
      from: INFO
    });
    return { ok:true, from:INFO, to:email };
  } catch (e1){
    try{
      GmailApp.sendEmail(email, subject, body, {
        name: "チームアルマダ",
        replyTo: INFO
      });
      return { ok:true, from:"(execution user)", to:email, note:"fallback without from" };
    } catch (e2){
      return { ok:false, message: `mail send failed: ${e2 && e2.message ? e2.message : String(e2)}` };
    }
  }
}
function admin_sendSlackDowngradeNotice(memberEmail){
  const email = String(memberEmail || "").trim().toLowerCase();
  if (!email) return { ok:false, message:"memberEmail empty" };

  // ★権限ガード（既存の実装に合わせて必要なら差し替え）
  // canAccessAdmin の判定関数が既にある前提で使う
  if (typeof canAccessAdmin_ === "function" && !canAccessAdmin_()){
    return { ok:false, message:"forbidden" };
  }

  const INFO = "info@team-armada.jp";

  const subject = "【AMD】Slack無償プランへの切替予定のお知らせ";
  const body =
    `Slack inactive days>30となったため無償プランに切り替えます。
    有償プランに戻す必要が生じたらマネージャーに言ってね！
    引き続き#a1-allは見れるしDMも送れるから安心してねー。`;

  // from=info を狙う（環境によっては弾かれるのでフォールバック）
  try{
    GmailApp.sendEmail(email, subject, body, {
      name: "チームアルマダ",
      replyTo: INFO,
      from: INFO
    });
    return { ok:true, from:INFO, to:email };
  } catch (e1){
    try{
      // フォールバック：from指定なし（実行者から送られる）
      GmailApp.sendEmail(email, subject, body, {
        name: "チームアルマダ",
        replyTo: INFO
      });
      return { ok:true, from:"(execution user)", to:email, note:"fallback without from" };
    } catch (e2){
      return { ok:false, message: `mail send failed: ${e2 && e2.message ? e2.message : String(e2)}` };
    }
  }
}