// 期限アラート（RoutineAlertLog、毎日チェック、トリガー）。
/**
 * 016_RoutineAlerts.gs
 *
 * 目的：
 * 月次ルーティンの期限アラートを集約する。
 * DB_BillingCycle の状態から “次にやるべき未完タスク” を決め、期限接近/超過でPMへ通知する。
 *
 * このファイルが担当するもの：
 * - DB_RoutineAlertLog（送信済み管理）
 * - cron_checkRoutineAlertsDaily_（日次チェック）
 * - setupRoutineAlertTrigger（トリガー作成）
 *
 * ルール：
 * - 同一PJ・同一ym・同一レベル・同一タスクの重複送信を禁止（ログで抑止）。
 * - 通知はPM宛、まさ/きよは常にcc（運用ルールを固定）。
 * - タスク順序・期限ルールはこのファイル内に集約し、他所へ散らさない。
 */

function b_ensureRoutineAlertLog_(){
  const sh = b_ss_().getSheetByName("DB_RoutineAlertLog") || b_ss_().insertSheet("DB_RoutineAlertLog");
  const headers = ["projectId","ym","level","taskKey","sentAt"];
  const lastCol = Math.max(sh.getLastColumn(), 1);
  const row1 = sh.getRange(1,1,1,lastCol).getValues()[0].map(x=>String(x||"").trim());
  if (row1.every(h=>!h)) {
    sh.getRange(1,1,1,headers.length).setValues([headers]);
  } else {
    const missing = headers.filter(h => row1.indexOf(h) < 0);
    if (missing.length) sh.getRange(1, row1.length+1, 1, missing.length).setValues([missing]);
  }
  return sh;
}
function b_hasSentRoutineAlert_(projectId, ym, level, taskKey){
  const sh = b_ensureRoutineAlertLog_();
  const vals = sh.getDataRange().getValues();
  if (vals.length < 2) return false;
  const h = vals[0].map(x=>String(x||"").trim());
  const iPid = h.indexOf("projectId");
  const iYm  = h.indexOf("ym");
  const iLv  = h.indexOf("level");
  const iTk  = h.indexOf("taskKey");

  for (let r=1; r<vals.length; r++){
    if (String(vals[r][iPid]||"").trim() === projectId &&
        String(vals[r][iYm]||"").trim() === ym &&
        String(vals[r][iLv]||"").trim() === level &&
        String(vals[r][iTk]||"").trim() === taskKey) {
      return true;
    }
  }
  return false;
}
function b_logRoutineAlert_(projectId, ym, level, taskKey){
  const sh = b_ensureRoutineAlertLog_();
  sh.appendRow([projectId, ym, level, taskKey, new Date().toISOString()]);
}
function cron_checkRoutineAlertsDaily_(){
  // まさ・きよは常にcc
  const CC_ALWAYS = ["masa@team-armada.jp", "kyoko@team-armada.jp"];

  const bizYm = b_normYm_(new Date());     // 当月（業務月）YYYYMM
  const payYm = b_addMonths_(bizYm, 1);    // 翌月（請求/入金）YYYYMM

  const due = {
    schedule:    new Date(Number(bizYm.slice(0,4)), Number(bizYm.slice(4,6))-1, 10),
    nextBudget:  new Date(Number(bizYm.slice(0,4)), Number(bizYm.slice(4,6))-1, 15),
    allocation:  new Date(Number(bizYm.slice(0,4)), Number(bizYm.slice(4,6))-1, 15),
    report:      new Date(Number(bizYm.slice(0,4)), Number(bizYm.slice(4,6))-1, 20),
    invoiceSend: new Date(Number(payYm.slice(0,4)), Number(payYm.slice(4,6))-1, 9),
    paymentCheck:new Date(Number(payYm.slice(0,4)), Number(payYm.slice(4,6)), 0), // 翌月末
  };

  const LABEL = {
    schedule:"月次報告会 スケジューリング",
    report:"月次報告書 アップロード",
    nextBudget:"翌月予算の確定",
    allocation:"翌月配賦額の確定",
    invoiceSend:"請求書 送付",
    paymentCheck:"入金/振込 確認"
  };

  // billing cycle から当月行を読む（bizYm）
  b_ensureBillingCycleHeader_();
  const cycles = b_readTable_("DB_BillingCycle")
    .map(r => ({ ...r, ym: b_normYm_(r.ym) }))
    .filter(r => String(r.ym||"") === String(bizYm));

  // PJ→Slack晒し先（DB_Projects.slackChannelId）を1回だけ読む
  const pjRows = b_readTable_("DB_Projects");
  const pjSlackMap = {};
  pjRows.forEach(p => {
    const pid = String(p.projectId || "").trim();
    if (!pid) return;
    pjSlackMap[pid] = String(p.slackChannelId || "").trim();
  });

  // PJごとに “次にやる未完” を決める
  const order = ["schedule","nextBudget","allocation","report","invoiceSend","paymentCheck"];

  function doneByKey_(c){
    return {
      schedule: !!String(c.meetingEventId||"").trim(),
      report: !!String(c.monthlyReportUrl||"").trim(),
      nextBudget: !!String(c.budgetConfirmedAt||"").trim(),
      allocation: !!String(c.allocationConfirmedAt||"").trim(),
      invoiceSend: !!String(c.invoiceSentAt||"").trim(),
      paymentCheck: !!String(c.paymentConfirmedAt||"").trim(),
    };
  }

  function daysDiff_(a,b){
    const ms = 24*60*60*1000;
    const aa = new Date(a.getFullYear(),a.getMonth(),a.getDate()).getTime();
    const bb = new Date(b.getFullYear(),b.getMonth(),b.getDate()).getTime();
    return Math.floor((bb-aa)/ms);
  }

  function toYmdJst_(d){
    return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日`;
  }

  // ★Slack投稿：既存関数があれば使う／無ければ何もしない
  function tryPostSlack_(channelId, text){
    const ch = String(channelId || "").trim();
    if (!ch) return false;

    try{
      // 候補1: slack_postMessage(channelId, text)
      if (typeof slack_postMessage === "function"){
        slack_postMessage(ch, text);
        return true;
      }
    } catch(e){}

    try{
      // 候補2: slack_postMessageToChannel(channelId, text)
      if (typeof slack_postMessageToChannel === "function"){
        slack_postMessageToChannel(ch, text);
        return true;
      }
    } catch(e){}

    return false;
  }

  const today = new Date();
  const hour = today.getHours(); // JST（プロジェクトTZがAsia/Tokyo前提）
  let sentWarn = 0;
  let sentBad = 0;
  let sentCritical = 0;

  cycles.forEach(c => {
    const projectId = String(c.projectId||"").trim();
    if (!projectId) return;

    const done = doneByKey_(c);

    // ★「支払いできない」系は、paymentCheck締切日に当日12時で判定したいので
    // 次タスクが何であれ、paymentCheckが未完かを別途見る（晒し判定）
    const ddPay = due.paymentCheck;
    const diffPay = daysDiff_(today, ddPay);

    const pjName = String(c.projectName || projectId);
    const baseUrl = ScriptApp.getService().getUrl();

    const link = `${baseUrl}?page=billing&projectId=${encodeURIComponent(projectId)}&ym=${encodeURIComponent(String(bizYm).slice(0,4)+"-"+String(bizYm).slice(4,6))}&focus=${encodeURIComponent("paymentCheck")}`;

    // ====== ★CRITICAL（晒し上げ）：締切日当日の正午（12時台）だけ ======
    // 条件：paymentCheck未完 + 締切日当日 + 12時台
    if (!done.paymentCheck && diffPay === 0 && hour === 12){
      const taskKey = "paymentCheck_noon";
      const level = "critical";

      // 送信済みならスキップ
      if (!b_hasSentRoutineAlert_(projectId, bizYm, level, taskKey)){
        // 未完3点（採用文例）
        const missing = [];
        if (!done.invoiceSend) missing.push("①請求書送付");
        if (!done.paymentCheck) missing.push("②入金/振込 確認");
        if (!done.allocation) missing.push("③配賦額の確定/支払承認");
        const missText = missing.length ? missing.join(" ") : "（未完タスク判定はあるのにmissingが空。ここは要確認）";

        const msg =
          `【アラート】あと12時間で今月の支払い確定が間に合わない可能性ある…！\n` +
          `PJ: ${pjName}（${projectId}）\n` +
          `いま未完了：${missText}\n` +
          `今日18:00までに「どれが詰まってるか」だけ共有して〜！\n\n` +
          `▼Billing（該当箇所へ）\n${link}`;

        const slackCh = String(pjSlackMap[projectId] || "").trim();

        // Slack晒し（無ければPMへメール）
        const posted = tryPostSlack_(slackCh, msg);

        if (!posted){
          // フォールバック：PMにメール（晒し先未設定のPJもあるため）
          const pmEmails = b_getProjectPmEmails_(projectId);
          if (pmEmails.length){
            const subject = `【AMD OS】アラート（あと12時間） ${pjName} / 入金確認`;
            GmailApp.sendEmail(pmEmails.join(","), subject, msg, { cc: CC_ALWAYS.join(",") });
          }
        }

        b_logRoutineAlert_(projectId, bizYm, level, taskKey);
        sentCritical++;
      }

      // critical 送った日は、同PJについて warn/bad を重ねない（ノイズ回避）
      return;
    }

    // ====== 通常 warn/bad（既存ロジック） ======
    const nextKey = order.find(k => !done[k]) || "";
    if (!nextKey) return;

    const dd = due[nextKey];
    const diff = daysDiff_(today, dd);

    let level = ""; // warn / bad
    if (diff < 0) level = "bad";
    else if (diff <= 3) level = "warn";
    else return; // まだ余裕

    // 送信済みならスキップ
    if (b_hasSentRoutineAlert_(projectId, bizYm, level, nextKey)) return;

    const pmEmails = b_getProjectPmEmails_(projectId);
    if (!pmEmails.length) return;

    const focusMap = {
      schedule:"schedule",
      nextBudget:"nextBudget",
      allocation:"allocation",
      report:"report",
      invoiceSend:"invoiceSend",
      paymentCheck:"paymentCheck",
    };
    const link2 = `${baseUrl}?page=billing&projectId=${encodeURIComponent(projectId)}&ym=${encodeURIComponent(String(bizYm).slice(0,4)+"-"+String(bizYm).slice(4,6))}&focus=${encodeURIComponent(focusMap[nextKey]||"monthly")}`;

    const dueText = toYmdJst_(dd);
    const subjHead = (level==="bad") ? "【AMD OS】期限超過（赤）" : "【AMD OS】期限接近（黄）";
    const subject = `${subjHead} ${pjName} / ${LABEL[nextKey]} / 期限:${dueText}`;

    let body =
      `PMへ

        ${pjName}（${projectId}）の月次ルーティンで、次のタスクが${level==="bad" ? "期限超過" : "期限接近"}になってる。

        【タスク】${LABEL[nextKey]}
        【期限】${dueText}

        ▼Billing（該当箇所へ）
        ${link2}
        `;

    if (level === "bad") {
      body += `

      ⚠️ 警告：このままだと「翌月末のPJメンバーへの振込」が実行できない可能性がある。
      最優先で潰して。`;
    }

    GmailApp.sendEmail(pmEmails.join(","), subject, body, { cc: CC_ALWAYS.join(",") });

    b_logRoutineAlert_(projectId, bizYm, level, nextKey);
    if (level==="bad") sentBad++; else sentWarn++;
  });

  return { ok:true, bizYm, payYm, sentWarn, sentBad, sentCritical, cycleCount: cycles.length };
}

function setupRoutineAlertTrigger(){
  const handler = "cron_checkRoutineAlertsDaily_";
  const triggers = ScriptApp.getProjectTriggers();

  // 既存を消す（9時の残骸を確実に除去）
  let removed = 0;
  triggers.forEach(t => {
    try{
      if (t.getHandlerFunction && t.getHandlerFunction() === handler){
        ScriptApp.deleteTrigger(t);
        removed++;
      }
    } catch(e){}
  });

  ScriptApp.newTrigger(handler)
    .timeBased()
    .everyDays(1)
    .atHour(12)
    .create();

  return { ok:true, message:"created daily trigger at 12:00", removed };
}
