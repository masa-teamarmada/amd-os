/**
 * 182_NotifyCore.gs
 * 通知の共通コア（Slack DM / Slackチャンネル / Gmail）
 *
 * 依存：
 * - 185_SlackNotify.gs（slack_postMessage / slack_postDm）
 * - DB_Members: memberId,email,slackId,notifyChannel
 * - DB_ProjectMembers: projectId,memberId,isActive,isPM,roleLabel
 * - DB_Projects: projectId,projectName,slackChannelId
 */

function notify_readMembersThin_(){
  const rows = b_readTableThin_("DB_Members", ["memberId","email","slackId","notifyChannel","codeName"]);
  return (Array.isArray(rows) ? rows : []).map(r => ({
    memberId: String(r.memberId||"").trim(),
    email: String(r.email||"").trim().toLowerCase(),
    slackId: String(r.slackId||"").trim(),
    notifyChannel: String(r.notifyChannel||"").trim().toLowerCase() || "gmail",
    codeName: String(r.codeName||"").trim()
  })).filter(x => x.memberId || x.email);
}

function notify_findMemberByEmail_(email){
  const em = String(email||"").trim().toLowerCase();
  if (!em) return null;
  const ms = notify_readMembersThin_();
  return ms.find(m => m.email === em) || null;
}

function notify_sendToEmail_(toEmail, subject, body, opt){
  opt = opt || {};
  const to = String(toEmail||"").trim();
  if (!to) throw new Error("notify_sendToEmail_: to empty");
  GmailApp.sendEmail(to, String(subject||""), String(body||""), opt);
  return { ok:true, channel:"gmail", to: to };
}

function notify_sendToSlackDmBySlackId_(slackId, text){
  const uid = String(slackId||"").trim();
  if (!uid) throw new Error("notify_sendToSlackDmBySlackId_: slackId empty");
  slack_postDm(uid, String(text||""));
  return { ok:true, channel:"slack_dm", to: uid };
}

function notify_postToProjectChannel_(projectId, text){
  const pid = String(projectId||"").trim();
  if (!pid) throw new Error("notify_postToProjectChannel_: projectId empty");

  const pjs = b_readTable_("DB_Projects");
  const row = (Array.isArray(pjs) ? pjs : []).find(p => String(p.projectId||"").trim() === pid) || {};
  const ch = String(row.slackChannelId || "").trim();
  if (!ch) return { ok:false, message:"slackChannelId empty", projectId: pid };

  slack_postMessage(ch, String(text||""));
  return { ok:true, channel:"slack_channel", channelId: ch, projectId: pid };
}

function notify_sendToAdmins_(subject, body, slackText){
  // まずは運用固定：きよ＋まさ
  const admins = ["kyoko@team-armada.jp", "masa@team-armada.jp"];

  const results = [];
  admins.forEach(em => {
    const m = notify_findMemberByEmail_(em);
    const ch = String(m?.notifyChannel || "gmail").toLowerCase();
    if (ch === "slack" && m && m.slackId){
      try{
        results.push(notify_sendToSlackDmBySlackId_(m.slackId, slackText || (subject + "\n\n" + body)));
      } catch(e){
        results.push({ ok:false, channel:"slack_dm", to: m.slackId, message:String(e && (e.message||e) ? (e.message||e) : e) });
        results.push(notify_sendToEmail_(em, subject, body, {}));
      }
    } else {
      results.push(notify_sendToEmail_(em, subject, body, {}));
    }
  });

  return { ok:true, results: results };
}

function notify_sendToProjectPms_(projectId, subject, body, slackText){
  const pid = String(projectId||"").trim();
  if (!pid) throw new Error("notify_sendToProjectPms_: projectId empty");

  // PM一覧（memberId）
  const pmRows = b_readTableThin_("DB_ProjectMembers", ["projectId","memberId","isActive","isPM","roleLabel"]);
  const pms = (Array.isArray(pmRows) ? pmRows : [])
    .map(r => ({
      projectId: String(r.projectId||"").trim(),
      memberId: String(r.memberId||"").trim(),
      isActive: (r.isActive !== undefined ? r.isActive : ""),
      isPM: (r.isPM !== undefined ? r.isPM : ""),
      roleLabel: String(r.roleLabel||"").trim()
    }))
    .filter(r => r.projectId === pid && r.memberId)
    .filter(r => b_toBool_(r.isActive, true))
    .filter(r => b_toBool_(r.isPM, false) || String(r.roleLabel||"").toUpperCase().includes("PM"));

  if (!pms.length) return { ok:false, message:"no PMs", projectId: pid };

  const members = notify_readMembersThin_();
  const byId = {};
  members.forEach(m => { if (m.memberId) byId[m.memberId] = m; });

  const results = [];
  pms.forEach(x => {
    const m = byId[x.memberId] || null;
    if (!m) return;

    if (String(m.notifyChannel||"").toLowerCase() === "slack" && m.slackId){
      try{
        results.push(notify_sendToSlackDmBySlackId_(m.slackId, slackText || (subject + "\n\n" + body)));
      } catch(e){
        results.push({ ok:false, channel:"slack_dm", to:m.slackId, message:String(e && (e.message||e) ? (e.message||e) : e) });
        if (m.email) results.push(notify_sendToEmail_(m.email, subject, body, {}));
      }
    } else {
      if (m.email) results.push(notify_sendToEmail_(m.email, subject, body, {}));
    }
  });

  return { ok:true, projectId: pid, results };
}
