/**
 * 175_TsukuyomiMonthlyReminder.gs
 *
 * 役割：
 * - 月次ルーティンのリマインド文面を生成する（毎回少し違う）
 * - PMをメンションして、PJのSlackチャンネルに投下する
 * - DB_TsukuyomiProfiles の lastRemindedAtJst を更新する
 *
 * 依存（存在すれば使う）：
 * - slackNotifyPostToChannel_（115_SlackNotify.gs）
 * - slackNotifyGetProjectChannelId_（115_SlackNotify.gs）
 * - b_readTableThin_ / b_readTable_（B_Sheets.gs）
 *
 * 方針：
 * - LLMが無い/呼べない環境でも、文面はバリエーション生成で毎回変える
 * - 「覚えてる感」は DB_TsukuyomiProfiles（avgCloseDay / lastClosedYm / stuckStatus / tone）から事実で出す
 * - うるさくしない（行動は1個）
 */

function admin_tsukuyomi_postMonthlyRoutineReminders(payload){
  payload = payload || {};
  const dryRun = !!payload.dryRun;

  const ym = payload.ym ? Number(payload.ym) : tsuNowYmJst();

  // ★デフォは「全PJ」。テストしたいときだけ payload.projectId を渡す
  const onlyProjectId = payload.projectId ? String(payload.projectId).trim() : "";

  const cycles = tsuReadTableNormalized("DB_BillingCycle").rows;
  const projects = tsuReadTableNormalized("DB_Projects").rows;
  const members = tsuSafeReadMembers();
  const profiles = tsuReadTableNormalized("DB_TsukuyomiProfiles").rows;

  const projectById = {};
  for (const p of projects){
    const pid = String(p.projectId || "").trim();
    if (pid) projectById[pid] = p;
  }

  const memberById = {};
  for (const m of members){
    const mid = String(m.memberId || m.id || "").trim();
    if (mid) memberById[mid] = m;
  }

  const profileByKey = {};
  for (const pr of profiles){
    const k = String(pr.profileKey || "").trim();
    if (k) profileByKey[k] = pr;
  }

  // 1) cycleを ym で引いて、projectIdごとに1件にまとめる
  const cycleByProjectId = {};
  for (const c of cycles){
    const cYm = Number(c.ym || 0);
    if (cYm !== ym) continue;
    const pid = String(c.projectId || "").trim();
    if (!pid) continue;

    // もし複数あっても、updatedAt が新しそうな方を優先（雑でOK）
    if (!cycleByProjectId[pid]){
      cycleByProjectId[pid] = c;
    } else {
      const a = String(cycleByProjectId[pid].updatedAt || "").trim();
      const b = String(c.updatedAt || "").trim();
      if (b && (!a || b > a)) cycleByProjectId[pid] = c;
    }
  }

  // 2) 対象PJを決める
  const targetProjectIds = [];
  if (onlyProjectId){
    targetProjectIds.push(onlyProjectId);
  } else {
    for (const p of projects){
      const pid = String(p.projectId || "").trim();
      if (pid) targetProjectIds.push(pid);
    }
  }

  const results = [];
  const nowJst = tsuToJstIso(new Date());

  for (const projectId of targetProjectIds){
    const pj = projectById[projectId];
    if (!pj){
      results.push({ ok:false, projectId, ym, message:"project not found in DB_Projects" });
      continue;
    }

    const pmMemberId = String(pj.pmMemberId || "").trim();
    const pm = pmMemberId ? (memberById[pmMemberId] || null) : null;

    const profileKey = projectId + ":" + pmMemberId;
    const prof = profileByKey[profileKey] || null;

    const slackChannelId = tsuGetProjectChannelId(pj);
    if (!slackChannelId){
      results.push({ ok:false, projectId, ym, message:"slack channel id not found" });
      continue;
    }

    // ★cycleが無いなら status=none として扱う
    const cycle = cycleByProjectId[projectId] || null;
    const derivedStatus = cycle ? tsuDeriveMonthlyStatus(cycle) : "none";
    if (derivedStatus === "closed"){
      results.push({ ok:true, skipped:true, projectId, ym, reason:"already closed" });
      continue;
    }

    const mention = tsuBuildPmMention(pm, pj);
    const osUrl = tsuBuildOsBillingUrl(projectId, ym);

    // ★ここで ctx を作って、build側が actionType を ctx に刺す
    const msgCtx = {
      projectId,
      ym,
      projectName: String(pj.projectName || "").trim(),
      derivedStatus,
      mention,
      osUrl,
      profile: prof
    };

    const text = tsukuyomi_buildMonthlyReminderMessage(msgCtx);
    const actionType = String(msgCtx.__actionType || "").trim();

    if (dryRun){
      results.push({ ok:true, dryRun:true, projectId, ym, channel: slackChannelId, derivedStatus, actionType, text });
      continue;
    }

    const postRes = tsuPostToSlackChannel(slackChannelId, text);

    if (postRes && postRes.ok){
      tsuUpsertTsukuyomiProfile({
        profileKey,
        projectId,
        pmMemberId,
        lastRemindedAtJst: nowJst,
        lastActionType: actionType,
        lastActionAtJst: nowJst
      });
    }

    results.push({ ok: !!(postRes && postRes.ok), projectId, ym, channel: slackChannelId, derivedStatus, actionType, slack: postRes || null });
  }

  return { ok:true, ym, dryRun, count: results.length, results };
}

/**
 * 文面生成（毎回ちょい違う）
 * - LLMがなくても、seedで文言のバリエーションを作る
 * - 事実要素（前回/平均/詰まり）を差し込む
 */
function tsukuyomi_buildMonthlyReminderMessage(ctx){
  ctx = ctx || {};
  const projectId = String(ctx.projectId || "").trim();
  const ym = Number(ctx.ym || 0);
  const projectName = String(ctx.projectName || "").trim();
  const status = String(ctx.derivedStatus || "").trim();
  const mention = String(ctx.mention || "").trim();
  const osUrl = String(ctx.osUrl || "").trim();
  const prof = ctx.profile || null;

  const tone = prof ? String(prof.tone || "").trim() : "gentle";
  const avgCloseDay = prof ? String(prof.avgCloseDay || "").trim() : "";
  const closeSamples = prof ? Number(prof.closeSamples || 0) : 0;
  const stuckStatus = prof ? String(prof.stuckStatus || "").trim() : "";
  const lastClosedYm = prof ? String(prof.lastClosedYm || "").trim() : "";
  const lastClosedAtJst = prof ? String(prof.lastClosedAtJst || "").trim() : "";
  const lastActionType = prof ? String(prof.lastActionType || "").trim() : "";

  // ★同日でも複数回投下され得るので、30分スロットでゆらす（同一日の連投が同文にならない）
  const now = new Date();
  const j = new Date(now.getTime() + 9*60*60*1000);
  const slot = (j.getUTCHours() * 2) + Math.floor(j.getUTCMinutes() / 30); // 0..47

  const seed = tsuStableSeed(`${projectId}|${ym}|${status}|${tsuNowYmdJst()}|${slot}`);

  // ★挨拶はJST時間で出し分け（「〜だね」みたいな語尾は使わない）
  const hello = tsuHelloByTime(seed, tone);

  // ★おやつ時間の一言（15時台だけ）
  const flavor = tsuTimeFlavorLine(seed);

  // ===== ①観測（事実） =====
  const statusLine = tsuStatusLine(seed, status);
  const memoryLine = tsuMemoryLine(seed, { avgCloseDay, closeSamples, lastClosedYm, lastClosedAtJst, stuckStatus, status });

  // PJ名は押し付けない（最短で一言だけ）
  const pjLine = (projectName || projectId)
    ? tsuPickFrom(seed + 21, [
        `（${projectName ? projectName : projectId}）の今月分、さっと確認しよ。`,
        `今月の（${projectName ? projectName : projectId}）、月次の様子だけ見てほしい。`,
        `（${projectName ? projectName : projectId}）の今月、全体だけ一回見よ。`
      ])
    : "";

  // ===== ②解釈（つくよみ視点：断定しない） =====
  const interpretLine = tsuPickFrom(seed + 41, (() => {
    if (status === "none") return [
      "まだ始めてないだけの可能性もあるよ。",
      "今月分の入口だけ作れば、あとは流れに乗るはず。",
      "今は静かでも、裏で動いてる線は残しておく。"
    ];
    if (status === "draft") return [
      "下書きは溜まりやすい所だから、ここだけ抜けよう。",
      "全体を一回眺めるだけで、次の一手が見えやすい。",
      "詰まりそうな所だけ先に拾えば、進みが軽くなる。"
    ];
    if (status === "budget_confirmed") return [
      "予算が固まってるなら、次は配賦で一気に進む。",
      "ここから先は意思決定のスピード勝負になりがち。",
      "配賦が通ると、月次が急に締まり始める。"
    ];
    if (status === "allocation_confirmed") return [
      "配賦まで終わってるなら、請求に寄せるだけで勝ち。",
      "ここからは作業というより、手順の消化に近い。",
      "請求が出ると、入金確認の予定が立てやすい。"
    ];
    if (status === "invoice_issued") return [
      "請求が出てるなら、あとは入金確認の事実待ちになりやすい。",
      "ここは焦らず、確認タイミングだけ握ればOK。",
      "入金確認まで通ると、クローズが見える。"
    ];
    if (status === "paid_confirmed") return [
      "入金確認まで終わってるなら、最後のクローズだけ。",
      "閉じ忘れだけ拾えば、今月は終わり。",
      "最後の一押しで完了に寄せられる。"
    ];
    return ["今の状態、まず一回だけ見てほしい。", "状況確認からでOK。", "一回だけ全体を見よ。"];
  })());

  // ===== ③行動（今回やることは1個） =====
  const actionType = tsuSelectActionType(seed + 77, lastActionType);
  ctx.__actionType = actionType; // 呼び出し元に返す（DBに保存して次回避ける）

  const actionLine = tsukuyomi_buildActionLine(seed + 101, actionType, status);

  const header = mention ? `${mention}\n\n${hello}\n` : `${hello}\n`;

  const body = [
    flavor,
    pjLine,
    statusLine,
    memoryLine,
    interpretLine,
    actionLine,
    `👇 今月の月次ページ\n${osUrl}`
  ].filter(Boolean).join("\n");

  return `${header}\n${body}`;
}

function tsuSelectActionType(seed, lastActionType){
  const types = ["peek", "yesno", "oneword"]; // 3種に固定
  const last = String(lastActionType || "").trim();

  // 前回と同じを避けたい
  const pool = last ? types.filter(t => t !== last) : types;
  const pick = pool[(seed % pool.length + pool.length) % pool.length];
  return pick;
}

function tsukuyomi_buildActionLine(seed, actionType, status){
  const linkAction = "OS開いて、今月分だけ一回見てほしい。";

  if (actionType === "peek"){
    const map = {
      none: "まずは今月分を立ち上げて、全体を一回見よ。",
      draft: tsuPickFrom(seed, ["下書きの全体を一回眺めてほしい。", "詰まりそうな所だけ先に拾お。", linkAction]),
      budget_confirmed: tsuPickFrom(seed, ["次は配賦。そこだけ通してほしい。", "配賦まで通すと一気に軽くなる。", linkAction]),
      allocation_confirmed: tsuPickFrom(seed, ["次は請求。手順だけ進めてほしい。", "請求に寄せるだけで勝ち。", linkAction]),
      invoice_issued: tsuPickFrom(seed, ["入金確認の予定だけ握ってほしい。", "確認タイミングだけ押さえとくと安心。", linkAction]),
      paid_confirmed: tsuPickFrom(seed, ["最後にクローズして終わらせよ。", "閉じ忘れだけ拾って完了にしよ。", linkAction])
    };
    return map[status] || linkAction;
  }

  if (actionType === "yesno"){
    const q = tsuPickFrom(seed + 3, [
      "今月の月次、今日中に進める余裕ある？（Yes/NoでOK）",
      "今月分、今夜のうちに一回だけ見れる？（Yes/NoでOK）",
      "今月の月次、いったん着手できそう？（Yes/NoでOK）"
    ]);
    return q;
  }

  // oneword
  return tsuPickFrom(seed + 9, [
    "今月の進み具合、ひとことだけ投げて（スレッドでOK）",
    "今月の状態、ひとことだけ教えて（スレッドでOK）",
    "今月どう？ ひとことだけ（スレッドでOK）"
  ]);
}

/* =======================
 *  文言パーツ
 * ======================= */

function tsuStatusLine(seed, status){
  const map = {
    none: "今月の月次、まだ開始されてないっぽいよ。",
    draft: "今月の月次、下書きのまま止まってるよ。",
    budget_confirmed: "今月の月次、予算までは確定してるよ。",
    allocation_confirmed: "今月の月次、配賦までは完了してるよ。",
    invoice_issued: "今月の月次、請求書はもう出てるよ。",
    paid_confirmed: "今月の月次、入金確認までできてるよ。",
    closed: "今月の月次、クローズ済みっぽいよ。"
  };
  return map[status] || "今月の月次、状態を一回見よっか。";
}

function tsuMemoryLine(seed, x){
  const avgCloseDay = String(x.avgCloseDay || "").trim();
  const lastClosedYm = String(x.lastClosedYm || "").trim();
  const lastClosedAtJst = String(x.lastClosedAtJst || "").trim();
  const stuckStatus = String(x.stuckStatus || "").trim();
  const status = String(x.status || "").trim();

  // ★追加：サンプル数（DBに入ってれば使う。無ければ 0 扱い）
  const closeSamples = Number(x.closeSamples || 0);

  const parts = [];

  // 前回クローズ（これが一番 “嘘になりにくい”）
  if (lastClosedYm && lastClosedAtJst){
    const day = tsuExtractDayFromJstIso(lastClosedAtJst);
    if (day){
      parts.push(tsuPickFrom(seed, [
        `前回（${tsuFormatYm(Number(lastClosedYm))}）は${day}日くらいに閉じれてたよ。`,
        `前月（${tsuFormatYm(Number(lastClosedYm))}）は${day}日あたりでクローズしてたよ。`,
        `前回は${day}日ぐらいで閉じてた記録あるよ。`
      ]));
    }
  }

  // 平均クローズ日（★サンプル3以上のときだけ言う）
  if (avgCloseDay && closeSamples >= 3){
    parts.push(tsuPickFrom(seed + 7, [
      `だいたい${avgCloseDay}日くらいに閉じがちっぽい。`,
      `いつも${avgCloseDay}日前後で閉じてる傾向あるよ。`,
      `平均的には${avgCloseDay}日あたりで終わらせてる感じ。`
    ]));
  }

  // 詰まりポイント
  if (stuckStatus){
    const label = tsuStatusLabel(stuckStatus);
    if (label){
      const suffix = (stuckStatus === status)
        ? tsuPickFrom(seed + 13, ["ここ、長引きやすい所かも。", "ここ、止まりがちなとこっぽい。", "ここ、詰まりポイントになりやすいよね。"])
        : tsuPickFrom(seed + 13, ["次あたりで詰まりやすい所かも。", "この先で止まりがちな所、ここ。", "このPJの詰まりポイント、ここが多い。"]);

      parts.push(`このPJ、${label}が${suffix}`);
    }
  }

  if (!parts.length) return "";

  // うるさくしない（最大2文）
  return parts.slice(0, 2).join(" ");
}

function tsuActionLine(seed, status){
  const linkAction = "OS開いて、今月分だけ一回見てほしい。";
  const map = {
    none: "まずは今月分を立ち上げて、全体を一回見よ。",
    draft: tsuPickFrom(seed, ["内容だいたい揃ってきてるから、全体を一回見てほしい。", "一回通しで見て、詰まりそうな所だけ先に潰そ。", linkAction]),
    budget_confirmed: tsuPickFrom(seed, ["次は配賦だね。そこ決めると一気に進む。", "配賦まで通すと楽になるよ。", linkAction]),
    allocation_confirmed: tsuPickFrom(seed, ["次は請求書まわり。ここ通すと月次が締まり始める。", "請求ステップに進めると一気に片付く。", linkAction]),
    invoice_issued: tsuPickFrom(seed, ["あとは入金確認ができたらクローズに近いよ。", "入金確認の予定だけ押さえとくと安心。", linkAction]),
    paid_confirmed: tsuPickFrom(seed, ["最後にクローズして終わらせよ。", "閉じ忘れだけ拾って終わりにしよ。", linkAction])
  };
  return map[status] || linkAction;
}

function tsuStatusLabel(st){
  const map = {
    draft: "下書き",
    budget_confirmed: "予算→配賦",
    allocation_confirmed: "配賦→請求",
    invoice_issued: "請求→入金確認"
  };
  return map[st] || "";
}

/* =======================
 *  Slack / DB / 時刻
 * ======================= */

function tsuPostToSlackChannel(channelId, text){
  // つくよみとして喋らせるため、TSUKUYOMI側トークンで chat.postMessage を叩く
  const token = tsuGetTsukuyomiBotToken();
  if (!token) return { ok:false, message:"tsukuyomi bot token not found" };

  try{
    const payload = {
      channel: channelId,
      text: text,

      // 可能なら表示も寄せる（Slack側設定で無視される場合もある）
      username: "つくよみ",
      icon_emoji: ":crescent_moon:"
    };

    const res = UrlFetchApp.fetch("https://slack.com/api/chat.postMessage", {
      method: "post",
      contentType: "application/json; charset=utf-8",
      headers: { Authorization: "Bearer " + token },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    const json = JSON.parse(res.getContentText() || "{}");
    return json;
  }catch(e){
    return { ok:false, message:String(e && e.message ? e.message : e) };
  }
}

function tsuGetTsukuyomiBotToken(){
  // まさの環境で確認済みのキーを正とする
  const props = PropertiesService.getScriptProperties();

  const v = String(props.getProperty("SLACK_TSUKUYOMI_BOT_TOKEN") || "").trim();
  if (v) return v;

  // 念のため将来互換（今は使われてないが、落とさない）
  const fallback = String(props.getProperty("TSUKUYOMI_SLACK_BOT_TOKEN") || "").trim();
  if (fallback) return fallback;

  return "";
}

function tsuGetProjectChannelId(projectRow){
  const direct = String(projectRow.slackChannelId || "").trim();
  if (direct) return direct;

  if (typeof slackNotifyGetProjectChannelId_ === "function"){
    try{
      const pid = String(projectRow.projectId || "").trim();
      const r = slackNotifyGetProjectChannelId_(pid);
      return String(r || "").trim();
    }catch(e){}
  }
  return "";
}

function tsuBuildPmMention(pmRow, projectRow){
  // PM固定、Slack user id が取れれば <@Uxxxx> を使う
  // 取れない場合は、名前 or email を出しておく（@メンションは諦める）
  const slackId =
    pmRow ? String(pmRow.slackId || pmRow.slackUserId || pmRow.slackUser || "").trim() : "";

  if (slackId) return `<@${slackId}>`;

  const email = pmRow ? String(pmRow.email || pmRow.memberEmail || "").trim() : "";
  const name = pmRow ? String(pmRow.name || pmRow.memberName || "").trim() : "";

  // ここは「PM」固定が条件なので、最低限それっぽく呼ぶ
  if (name) return `${name}`;
  if (email) return `${email}`;
  return "PM";
}

function tsuBuildOsBillingUrl(projectId, ym){
  const base = (typeof ScriptApp !== "undefined" && ScriptApp.getService)
    ? String(ScriptApp.getService().getUrl() || "").trim()
    : "";

  const safeBase = base || ""; // 空でも返す（Slack側で気づける）
  const q = `page=billing&projectId=${encodeURIComponent(projectId)}&ym=${encodeURIComponent(String(ym))}`;
  return safeBase ? `${safeBase}?${q}` : `?${q}`;
}

function tsuUpsertTsukuyomiProfile(partial){
  partial = partial || {};
  const key = String(partial.profileKey || "").trim();
  if (!key) return;

  const sheetName = "DB_TsukuyomiProfiles";
  const table = tsuReadTableNormalized(sheetName);
  const headers = table.headers;
  const rows = table.rows;

  const keyCol = "profileKey";
  const keyIdx = headers.indexOf(keyCol);
  if (keyIdx < 0) return;

  const colIdx = {};
  for (let i=0;i<headers.length;i++) colIdx[headers[i]] = i;

  let rowIndex = -1;
  for (let i=0;i<rows.length;i++){
    const r = rows[i];
    if (String(r.profileKey || "").trim() === key){
      rowIndex = i;
      break;
    }
  }

  const nowJst = tsuToJstIso(new Date());
  const obj = Object.assign({}, partial);
  if (!obj.updatedAtJst) obj.updatedAtJst = nowJst;
  if (!obj.status) obj.status = "active";

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(sheetName);
  if (!sh) return;

  if (rowIndex >= 0){
    // 既存更新
    const rowNum = rowIndex + 2; // header=1
    const current = sh.getRange(rowNum, 1, 1, headers.length).getValues()[0];

    for (const k2 of Object.keys(obj)){
      if (colIdx[k2] === undefined) continue;
      current[colIdx[k2]] = obj[k2];
    }
    sh.getRange(rowNum, 1, 1, headers.length).setValues([current]);
  } else {
    // 新規追加
    const newRow = new Array(headers.length).fill("");
    for (const k2 of Object.keys(obj)){
      if (colIdx[k2] === undefined) continue;
      newRow[colIdx[k2]] = obj[k2];
    }
    if (!newRow[colIdx.createdAtJst]) newRow[colIdx.createdAtJst] = nowJst;
    if (!newRow[colIdx.updatedAtJst]) newRow[colIdx.updatedAtJst] = nowJst;

    sh.getRange(sh.getLastRow()+1, 1, 1, headers.length).setValues([newRow]);
  }
}

/* =======================
 *  DB 読み系（返り値ゆれ吸収）
 * ======================= */

function tsuReadTableNormalized(sheetName){
  // b_readTableThin_ / b_readTable_ の返り値ゆれを吸収して {headers, rows} にする
  try{
    if (typeof b_readTableThin_ === "function"){
      const r = b_readTableThin_(sheetName);
      return tsuNormalizeReadResult(sheetName, r);
    }
  }catch(e){}

  try{
    if (typeof b_readTable_ === "function"){
      const r = b_readTable_(sheetName);
      return tsuNormalizeReadResult(sheetName, r);
    }
  }catch(e){}

  return tsuNormalizeReadResult(sheetName, null);
}

function tsuNormalizeReadResult(sheetName, r){
  if (r && Array.isArray(r.rows)){
    return { headers: Array.isArray(r.headers) ? r.headers : [], rows: r.rows };
  }
  if (Array.isArray(r)){
    return { headers: [], rows: r };
  }
  if (r && Array.isArray(r.data)){
    return { headers: Array.isArray(r.headers) ? r.headers : [], rows: r.data };
  }

  // fallback：直読み
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(sheetName);
  if (!sh) return { headers:[], rows:[] };
  const values = sh.getDataRange().getValues();
  if (!values.length) return { headers:[], rows:[] };

  const headers = values[0].map(x => String(x || "").trim());
  const rows = [];
  for (let i=1;i<values.length;i++){
    const obj = {};
    for (let j=0;j<headers.length;j++){
      obj[headers[j]] = values[i][j];
    }
    rows.push(obj);
  }
  return { headers, rows };
}

function tsuSafeReadMembers(){
  // DB_Members を読む。無ければ空
  const t = tsuReadTableNormalized("DB_Members");
  if (t && Array.isArray(t.rows) && t.rows.length) return t.rows;

  // DB_ProjectMembers とかに分散してる可能性はあるけど、ここでは増やさない
  return [];
}

/* =======================
 *  月次ステータス推定
 * ======================= */

function tsuDeriveMonthlyStatus(c){
  // 可能なら status 列も見るけど、時刻列優先で推定する
  const paid = tsuHasValue(c.paymentConfirmedAt);
  if (paid) return "paid_confirmed";

  const inv = tsuHasValue(c.invoiceIssuedAt) || tsuHasValue(c.freeeInvoiceId);
  if (inv) return "invoice_issued";

  const alloc = tsuHasValue(c.allocationConfirmedAt) || String(c.status || "").trim() === "allocation_confirmed";
  if (alloc) return "allocation_confirmed";

  const bud = tsuHasValue(c.budgetConfirmedAt) || String(c.status || "").trim() === "budget_confirmed";
  if (bud) return "budget_confirmed";

  const st = String(c.status || "").trim();
  if (st === "draft") return "draft";

  // cycle行がある時点で none ではなく draft 扱いに寄せる
  return "draft";
}

function tsuHasValue(v){
  if (v === null || v === undefined) return false;
  const s = String(v).trim();
  return !!s;
}

/* =======================
 *  Seed / pick / 時刻
 * ======================= */

function tsuStableSeed(s){
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, s);
  let x = 0;
  for (let i=0;i<bytes.length;i++){
    x = (x * 31 + (bytes[i] & 0xff)) >>> 0;
  }
  return x;
}

function tsuPick(seed, tone, gentleArr, shortArr, processArr){
  const arr =
    tone === "short" ? shortArr :
    tone === "process" ? processArr :
    gentleArr;

  const idx = (seed % arr.length + arr.length) % arr.length;
  return arr[idx];
}

function tsuPickFrom(seed, arr){
  const idx = (seed % arr.length + arr.length) % arr.length;
  return arr[idx];
}

function tsuNowYmJst(){
  const d = new Date();
  const j = new Date(d.getTime() + 9*60*60*1000);
  const y = j.getUTCFullYear();
  const m = j.getUTCMonth() + 1;
  return y*100 + m;
}

function tsuNowYmdJst(){
  const d = new Date();
  const j = new Date(d.getTime() + 9*60*60*1000);
  const y = j.getUTCFullYear();
  const m = String(j.getUTCMonth()+1).padStart(2,"0");
  const day = String(j.getUTCDate()).padStart(2,"0");
  return `${y}${m}${day}`;
}

function tsuToJstIso(d){
  if (!d) return "";
  const t = (d instanceof Date) ? d.getTime() : (new Date(d)).getTime();
  if (!t || isNaN(t)) return "";
  const jst = new Date(t + 9*60*60*1000);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth()+1).padStart(2,"0");
  const day = String(jst.getUTCDate()).padStart(2,"0");
  const hh = String(jst.getUTCHours()).padStart(2,"0");
  const mm = String(jst.getUTCMinutes()).padStart(2,"0");
  const ss = String(jst.getUTCSeconds()).padStart(2,"0");
  return `${y}-${m}-${day}T${hh}:${mm}:${ss}+09:00`;
}

function tsuExtractDayFromJstIso(s){
  const m = String(s || "").match(/^\d{4}-\d{2}-(\d{2})T/);
  if (!m) return "";
  return String(Number(m[1]));
}

function tsuFormatYm(ym){
  const n = Number(ym || 0);
  if (!n) return "";
  const y = Math.floor(n / 100);
  const m = String(n % 100).padStart(2,"0");
  return `${y}-${m}`;
}

function admin_tsukuyomi_postMonthlyRoutineRemindersDryRun(){
  const res = admin_tsukuyomi_postMonthlyRoutineReminders({ dryRun: true });
  Logger.log("[TsukuyomiReminder][dryRun] " + JSON.stringify(res));
  return res;
}

function admin_tsukuyomi_postMonthlyRoutineRemindersNow(){
  const res = admin_tsukuyomi_postMonthlyRoutineReminders({});
  Logger.log("[TsukuyomiReminder][now] " + JSON.stringify(res));
  return res;
}

function tsuHourJst(){
  const d = new Date();
  const j = new Date(d.getTime() + 9*60*60*1000);
  return j.getUTCHours(); // 0-23
}

function tsuHelloByTime(seed, tone){
  const h = tsuHourJst();

  // 朝〜昼〜夕〜夜で分ける（JST）
  const morning = (h >= 5 && h <= 10);
  const noon = (h >= 11 && h <= 16);
  const evening = (h >= 17 && h <= 20);
  const late = (h >= 21 || h <= 4);

  // ★「〜だね」「〜だよね」みたいな語尾は避ける
  const gentleMorning = ["おはよ🌙", "おは〜🌙", "朝っぽい🌙", "おはよ、まだ眠い🌙", "目が開くまでゆっくり🌙"];
  const gentleNoon = ["こんにちは🌙", "こんちわ🌙", "おつかれさま🌙", "日中モード🌙", "いまのうちに片付けよ🌙"];
  const gentleEvening = ["こんばんは🌙", "夜モード🌙", "おつかれ〜🌙", "ゆるっといこ🌙", "夕方〜夜の境目🌙"];
  const gentleLate = ["夜更け🌙", "深夜モード🌙", "ねむ…🌙", "静かな時間🌙", "眠気と戦ってる🌙"];

  const shortMorning = ["朝の要点だけ🌙", "朝イチ共有🌙", "短くいく🌙", "要点だけ投げる🌙"];
  const shortNoon = ["要点だけ🌙", "さくっと共有🌙", "短くいく🌙", "すぐ終わらせよ🌙"];
  const shortEvening = ["夜の要点だけ🌙", "さくっと締めよ🌙", "結論だけ🌙", "短く投げる🌙"];
  const shortLate = ["深夜の要点🌙", "寝る前に一言🌙", "短くいく🌙", "静かに要点🌙"];

  const processMorning = ["朝のうちに整理🌙", "朝イチで流れ確認🌙", "今日の進め方まとめる🌙", "朝の整頓タイム🌙"];
  const processNoon = ["状況まとめる🌙", "流れで見ると今ここ🌙", "次に詰まりそうな所も拾う🌙", "手順に落として進めよ🌙"];
  const processEvening = ["夜のうちに整理🌙", "今日の終わりに一回確認🌙", "流れを整える🌙", "夜にまとめて片付ける🌙"];
  const processLate = ["深夜に静かに整理🌙", "夜更けに確認だけ🌙", "寝る前に整える🌙", "眠いけど整える🌙"];

  const pick = (arr) => arr[(seed % arr.length + arr.length) % arr.length];

  if (tone === "short"){
    if (morning) return pick(shortMorning);
    if (noon) return pick(shortNoon);
    if (evening) return pick(shortEvening);
    return pick(shortLate);
  }

  if (tone === "process"){
    if (morning) return pick(processMorning);
    if (noon) return pick(processNoon);
    if (evening) return pick(processEvening);
    return pick(processLate);
  }

  // gentle default
  if (morning) return pick(gentleMorning);
  if (noon) return pick(gentleNoon);
  if (evening) return pick(gentleEvening);
  return pick(gentleLate);
}

function tsuTimeFlavorLine(seed){
  const h = tsuHourJst();

  // 15時台：おやつ
  if (h === 15){
    const arr = [
      "そろそろあんみつ食べたい…🍡",
      "おやつの時間、甘いのほしい…🍡",
      "15時、あんみつ欲が高まる…🍡",
      "糖分補給したい…あんみつ…🍡"
    ];
    return arr[(seed % arr.length + arr.length) % arr.length];
  }

  return "";
}
