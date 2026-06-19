/**
 * 175_TsukuyomiMonthlyReminder.gs
 *
 * 役割：
 * - PM向け月次リマインドは廃止済み。
 * - 残っている install/cron 関数は既存トリガー削除用の no-op。
 */

function admin_tsukuyomi_postMonthlyRoutineReminders(payload){
  return { ok:true, disabled:true, posted:0, note:"PM monthly reminders are abolished; OS does not post them." };
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

  // ===== 1観測（事実） =====
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

  // ===== 2解釈（つくよみ視点：断定しない） =====
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
        "予算が固まってるなら、次は請求書で一気に進む。",
        "ここから先は手順の消化に近い。",
        "請求が出ると、入金確認の予定が立てやすい。"
      ];
      if (status === "invoice_issued") return [
        "請求書出てるから、あとは送付するだけだよ。",
        "freeeから送付すれば次のステップに進める。",
        "送付まで通すと、あとは入金待ちだけになる。"
      ];
      if (status === "invoice_sent") return [
        "請求書は送付済み。あとは入金確認の事実待ち。",
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

  // ===== 3行動（今回やることは1個） =====
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
    `👇 コックピット\n${osUrl}`
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
      budget_confirmed: tsuPickFrom(seed, ["次は請求書。そこだけ通してほしい。", "請求まで通すと一気に軽くなる。", linkAction]),
      invoice_issued: tsuPickFrom(seed, ["freeeから送付してほしい。", "送付すれば入金待ちに移れる。", linkAction]),
      invoice_sent: tsuPickFrom(seed, ["入金確認の予定だけ握ってほしい。", "確認タイミングだけ押さえとくと安心。", linkAction]),
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
    invoice_issued: "今月の月次、請求書はもう出てるよ。",
    invoice_sent: "今月の月次、請求書は送付済みだよ。",
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
    budget_confirmed: "予算→請求",
    invoice_issued: "請求書発行→送付",
    invoice_sent: "送付→入金確認"
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
  const base = String(
    PropertiesService.getScriptProperties().getProperty("WEBAPP_BASE_URL") || ""
  ).trim();

  const q = "page=cockpit&projectId=" + encodeURIComponent(projectId)
          + "&ym=" + encodeURIComponent(String(ym));
  return base ? (base + "?" + q) : ("?" + q);
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
  const paid = tsuHasValue(c.paymentConfirmedAt);
  if (paid) return "paid_confirmed";

  const sent = tsuHasValue(c.invoiceSentAt);
  if (sent) return "invoice_sent";

  const inv = tsuHasValue(c.invoiceIssuedAt) || tsuHasValue(c.freeeInvoiceId);
  if (inv) return "invoice_issued";

  const bud = tsuHasValue(c.budgetConfirmedAt) || String(c.status || "").trim() === "budget_confirmed";
  if (bud) return "budget_confirmed";

  const st = String(c.status || "").trim();
  if (st === "draft") return "draft";

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

function test_reminder_dryRun_p20(){
  var res = admin_tsukuyomi_postMonthlyRoutineReminders({
    dryRun: true,
    projectId: "p20"
  });
  Logger.log(JSON.stringify(res, null, 2));
}

function test_reminder_post_p20(){
  var res = admin_tsukuyomi_postMonthlyRoutineReminders({
    projectId: "p20"
  });
  Logger.log(JSON.stringify(res, null, 2));
}

/**
 * 月次報告会スケジューリング専用リマインド
 * - 10日：meetingStartAtが空のPJにPM向け初回案内
 * - 15日：未入力PMにリマインド
 * - 20日：admin（まさ＋きよ）にエスカレ
 *
 * GASトリガー：毎日1回実行。日付で自動分岐。
 */
function cron_meetingScheduleReminder() {
  // 2026-05-03: つくよみのSlackルーティン通知は停止。通知はアプリ側へ移行する。
  return { ok:true, disabled:true, posted:0, note:"Tsukuyomi Slack meeting schedule reminders are disabled; app notifications are the active path." };

  var day = Number(Utilities.formatDate(new Date(), "Asia/Tokyo", "d"));
  if (day !== 10 && day !== 15 && day !== 20) return;

  var ym = tsuNowYmJst();
  var cycles = tsuReadTableNormalized("DB_BillingCycle").rows;
  var projects = tsuReadTableNormalized("DB_Projects").rows;
  var members = tsuSafeReadMembers();

  var projectById = {};
  for (var i = 0; i < projects.length; i++) {
    var pid = String(projects[i].projectId || "").trim();
    if (pid) projectById[pid] = projects[i];
  }
  var memberById = {};
  for (var i = 0; i < members.length; i++) {
    var mid = String(members[i].memberId || members[i].id || "").trim();
    if (mid) memberById[mid] = members[i];
  }

  var pending = [];
  for (var i = 0; i < cycles.length; i++) {
    var c = cycles[i];
    if (Number(c.ym || 0) !== ym) continue;
    if (String(c.meetingStartAt || "").trim()) continue;
    var pid = String(c.projectId || "").trim();
    var pj = projectById[pid];
    if (!pj) continue;
    if (String(pj.status || "").trim().toLowerCase() !== "active") continue;
    var pmMemberId = String(pj.pmMemberId || "").trim();
    var pm = pmMemberId ? (memberById[pmMemberId] || null) : null;
    var pmEmail = pm ? String(pm.email || "").trim() : "";
    pending.push({ projectId: pid, project: pj, cycle: c, pm: pm, pmEmail: pmEmail });
  }

  if (!pending.length) return;

  var now = new Date();
  var jst = new Date(now.getTime() + 9*60*60*1000);
  var y = jst.getUTCFullYear();
  var m = jst.getUTCMonth() + 1;
  var nextM = m + 1; var nextY = y;
  if (nextM > 12) { nextM = 1; nextY++; }
  var weekStart = new Date(nextY + "-" + ("0"+nextM).slice(-2) + "-01T00:00:00+09:00");
  var weekEnd   = new Date(nextY + "-" + ("0"+nextM).slice(-2) + "-08T00:00:00+09:00");

  if (day === 10 || day === 15) {
    var urgency = (day === 15) ? "⚠️ まだ調整中のPJがあるよ！今日中にお願い🌙\n" : "";

    var assignments = {};
    try {
      assignments = assignMeetingSlotsForPendingProjects_(pending, weekStart, weekEnd);
    } catch(e) {
      Logger.log("assignMeetingSlots error: " + e.message);
    }

    for (var i = 0; i < pending.length; i++) {
      var p = pending[i];
      var pj = p.project;
      var channelId = tsuGetProjectChannelId(pj);
      if (!channelId) continue;

      var mention = tsuBuildPmMention(p.pm, pj);
      var pjName = String(pj.projectName || "").trim();
      var ymLabel = String(ym).slice(0,4) + "年" + String(ym).slice(4).replace(/^0/,"") + "月";
      var candidate = assignments[p.projectId] || null;

      if (candidate) {
        var dateLabel = Utilities.formatDate(candidate.start, "Asia/Tokyo", "M月d日(EEE) HH:mm");
        var pmName = p.pm ? String(p.pm.codeName || "PM") : "PM";
        var proposeText = (mention ? mention + "\n" : "")
          + urgency
          + "📅 *" + pjName + "* " + ymLabel + "度の月次報告会\n"
          + "まさ・きよ・" + pmName + "の空き時間で候補を出したよ🌙\n\n"
          + "*" + dateLabel + "* はどう？（30分）";

        slackNotifyPostToChannelTsukuyomi_(channelId, {
          text: proposeText,
          blocks: [
            { type: "section", text: { type: "mrkdwn", text: proposeText } },
            { type: "actions", elements: [
              {
                type: "button",
                text: { type: "plain_text", text: "✅ この日時で確定する" },
                style: "primary",
                action_id: "meeting_propose_confirm",
                value: JSON.stringify({
                  projectId: p.projectId,
                  ym: String(ym),
                  startISO: candidate.start.toISOString(),
                  endISO:   candidate.end.toISOString()
                })
              },
              {
                type: "button",
                text: { type: "plain_text", text: "🔄 別の日程を選ぶ" },
                action_id: "meeting_propose_decline",
                value: JSON.stringify({ projectId: p.projectId, ym: String(ym) })
              }
            ]}
          ]
        });
      } else {
        // 候補なし → 手動選択にフォールバック
        var meetMsg = slackNotifyBuildMeetingScheduleMessage_(p.projectId, pjName, String(ym));
        if (meetMsg) {
          var blocks2 = [];
          var headerText = (mention ? mention + "\n" : "") + urgency
            + "😓 自動で候補が見つからなかった…コックピットから手動で選んでね🌙";
          blocks2.push({ type: "section", text: { type: "mrkdwn", text: headerText } });
          for (var bi = 0; bi < meetMsg.blocks.length; bi++) blocks2.push(meetMsg.blocks[bi]);
          slackNotifyPostToChannelTsukuyomi_(channelId, { text: headerText, blocks: blocks2 });
        }
      }
    }
  }

  if (day === 20) {
    var props = PropertiesService.getScriptProperties();
    var adminChannelId = String(props.getProperty("SLACK_ADMIN_CHANNEL_ID") || "").trim();
    if (!adminChannelId) return;
    var names = [];
    for (var i = 0; i < pending.length; i++) {
      names.push(String(pending[i].project.projectName || pending[i].projectId || "").trim());
    }
    slackNotifyPostToChannelTsukuyomi_(adminChannelId, {
      text: "🚨 月次報告会日程調整が未完了のPJが " + pending.length + " 件あるよ\n"
        + names.join("、") + "\n管理画面から設定してね"
    });
  }
}
function install_cron_meetingScheduleReminder() {
  var triggers = ScriptApp.getProjectTriggers();
  var removed = 0;
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "cron_meetingScheduleReminder") {
      ScriptApp.deleteTrigger(triggers[i]);
      removed++;
    }
  }
  Logger.log("cron_meetingScheduleReminder disabled; removed triggers=" + removed);
  return { ok: true, disabled: true, removed: removed };
}

// ================================================================
// 請求書発行ワークフロー用 日次cron
// - 1日: 立替締めリマインド
// - 3日: 未承認立替リマインド
// - 5日: 請求書プレビュー自動投稿（admin向け）
// ================================================================

function cron_invoiceWorkflowDaily(){
  // 2026-05-03: つくよみのSlackルーティン通知は停止。通知はアプリ側へ移行する。
  return { ok:true, disabled:true, posted:0, note:"Tsukuyomi Slack invoice workflow reminders are disabled; app notifications are the active path." };

  var day = Number(Utilities.formatDate(new Date(), "Asia/Tokyo", "d"));
  if (day !== 1 && day !== 3 && day !== 5) return;

  var ym = String(tsuNowYmJst());
  var projects = tsuReadTableNormalized("DB_Projects").rows;
  var activeProjects = [];
  for (var i = 0; i < projects.length; i++){
    var st = String(projects[i].status || "").trim().toLowerCase();
    if (st !== "active") continue;
    var pid = String(projects[i].projectId || "").trim();
    if (!pid) continue;
    activeProjects.push(projects[i]);
  }

  if (day === 1){
    _invoiceWf_postReimbDeadlineReminder_(activeProjects, ym);
  }
  if (day === 3){
    _invoiceWf_postReimbPendingReminder_(activeProjects, ym);
  }
  if (day === 5){
    _invoiceWf_postInvoicePreview_(activeProjects, ym);
  }
}

/**
 * 1日：立替締めリマインド
 * 全activeなPJのチャンネルに「4日までに立替計上＆承認してね」
 */
function _invoiceWf_postReimbDeadlineReminder_(projects, ym){
  var ymLabel = String(ym).slice(0,4) + "年" + String(ym).slice(4).replace(/^0/,"") + "月";

  for (var i = 0; i < projects.length; i++){
    var pj = projects[i];
    var pid = String(pj.projectId || "").trim();
    var channelId = tsuGetProjectChannelId(pj);
    if (!channelId) continue;

    var pmMention = "";
    try{
      pmMention = slackNotifyGetPmMentions_(pid);
    } catch(e){}

    var text = (pmMention ? pmMention + "\n" : "")
      + "📋 " + ymLabel + "度の立替精算、*4日*までに計上＆承認お願い🌙\n"
      + "4日時点でPM承認＋admin承認が済んだものだけ、今月の請求書に含めるよ。\n"
      + "間に合わなかった分は来月に回るから注意してね。";

    slackNotifyPostToChannelTsukuyomi_(channelId, { text: text });
  }
}

/**
 * 3日：未承認立替リマインド
 * 未承認の立替があるPJだけ通知
 */
function _invoiceWf_postReimbPendingReminder_(projects, ym){
  var reimbRows = [];
  try{
    reimbRows = b_readTable_("DB_Reimbursements") || [];
  } catch(e){ return; }

  for (var i = 0; i < projects.length; i++){
    var pj = projects[i];
    var pid = String(pj.projectId || "").trim();

    // このPJ×今月の未承認件数を数える
    var pendingPm = 0;
    var pendingAdmin = 0;
    for (var r = 0; r < reimbRows.length; r++){
      var row = reimbRows[r];
      if (String(row.projectId || "").trim() !== pid) continue;

      // 日付からymを推定（dateカラムからyyyy-mmを取ってyyyymmに変換）
      var rowDate = String(row.date || "").trim();
      var rowYm = "";
      if (rowDate.length >= 7){
        rowYm = rowDate.slice(0,4) + rowDate.slice(5,7);
      }
      // billedYmが埋まっていたらスキップ（既に請求済み）
      var billedYm = String(row.billedYm || "").trim();
      if (billedYm) continue;

      var hasPmApprove = !!(row.pmApprovedAt || row.pmApprovedBy);
      var hasAdminApprove = !!(row.adminApprovedAt || row.adminApprovedBy);

      if (!hasPmApprove) pendingPm++;
      else if (!hasAdminApprove) pendingAdmin++;
    }

    var total = pendingPm + pendingAdmin;
    if (total === 0) continue;

    var channelId = tsuGetProjectChannelId(pj);
    if (!channelId) continue;

    var pmMention = "";
    try{ pmMention = slackNotifyGetPmMentions_(pid); } catch(e){}
    var adminMention = "";
    try{ adminMention = slackNotifyGetAdminMentions_(); } catch(e){}

    var text = "⚠️ 立替精算の未承認が *" + total + "件* あるよ🌙\n";
    if (pendingPm > 0) text += (pmMention ? pmMention + " " : "") + "PM未承認: " + pendingPm + "件\n";
    if (pendingAdmin > 0) text += (adminMention ? adminMention + " " : "") + "admin未承認: " + pendingAdmin + "件\n";
    text += "*明日（4日）が締め*だから、今日中に承認お願い！";

    var baseUrl = String(PropertiesService.getScriptProperties().getProperty("WEBAPP_BASE_URL") || "").trim();
    var reimbUrl = baseUrl ? (baseUrl + "?page=reimburse") : "";

    var blocks = [
      { type:"section", text:{ type:"mrkdwn", text: text } }
    ];
    if (reimbUrl){
      blocks.push({
        type:"actions",
        elements:[{
          type:"button",
          text:{ type:"plain_text", text:"立替ページを開く" },
          url: reimbUrl,
          action_id:"reimb_open_page_reminder"
        }]
      });
    }

    slackNotifyPostToChannelTsukuyomi_(channelId, { text: text, blocks: blocks });
  }
}

/**
 * 5日：請求書プレビュー自動投稿
 * admin向けチャンネルに、全PJの請求書プレビューをまとめて投稿
 */
function _invoiceWf_postInvoicePreview_(projects, ym){
  // PJごとのチャンネルに個別投稿（115のBillingRoutineMessageを使う）
  for (var i = 0; i < projects.length; i++){
    var pj = projects[i];
    var pid = String(pj.projectId || "").trim();
    var channelId = tsuGetProjectChannelId(pj);
    if (!channelId) continue;

    // BillingCycleが存在するか確認
    var cycle = null;
    try{ cycle = b_getCycleOne_(pid, ym); } catch(e){}
    if (!cycle) continue;

    // 既に請求書発行済みならスキップ
    if (cycle.freeeInvoiceId) continue;

    // 予算が確定していないPJもスキップ（予算未確定メッセージは175のルーティンリマインドで出る）
    if (!cycle.budgetConfirmedAt) continue;

    var adminMention = "";
    try{ adminMention = slackNotifyGetAdminMentions_(); } catch(e){}

    // 115のBlocks組み立てを使う
    var routineMsg = null;
    try{
      routineMsg = slackNotifyBuildBillingRoutineMessage_(pid, ym);
    } catch(e){}

    if (!routineMsg) continue;

    // adminメンション＋ヘッダーを追加
    var headerText = (adminMention ? adminMention + "\n" : "")
      + "📄 *9日までに請求書を発行してね*🌙";

    var blocks = [
      { type:"section", text:{ type:"mrkdwn", text: headerText } },
      { type:"divider" }
    ];
    if (Array.isArray(routineMsg.blocks)){
      for (var bi = 0; bi < routineMsg.blocks.length; bi++){
        blocks.push(routineMsg.blocks[bi]);
      }
    }

    slackNotifyPostToChannelTsukuyomi_(channelId, {
      text: headerText + "\n" + (routineMsg.text || ""),
      blocks: blocks
    });
  }
}

/** トリガー設置（1回だけ手動実行） */
function install_cron_invoiceWorkflowDaily() {
  var triggers = ScriptApp.getProjectTriggers();
  var removed = 0;
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "cron_invoiceWorkflowDaily") {
      ScriptApp.deleteTrigger(triggers[i]);
      removed++;
    }
  }
  Logger.log("cron_invoiceWorkflowDaily disabled; removed triggers=" + removed);
  return { ok: true, disabled: true, removed: removed };
}

// ================================================================
// 月次報告書FIX催促 日次cron
// - 毎月1日 9:00 JST：先月分レポートが未FIXのPJにSlack催促
// - 毎月3日 9:00 JST：まだ未FIXならフォローアップ
// ================================================================
function cron_reportFixReminder(){
  // 2026-05-03: つくよみのSlackルーティン通知は停止。通知はアプリ側へ移行する。
  return { ok:true, disabled:true, posted:0, note:"Tsukuyomi Slack report fix reminders are disabled; app notifications are the active path." };

  var day = Number(Utilities.formatDate(new Date(), "Asia/Tokyo", "d"));
  if (day !== 1 && day !== 3) return;

  // 先月のymを算出
  var now = new Date();
  var jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  var y = jst.getUTCFullYear();
  var m = jst.getUTCMonth() + 1;
  var prevM = m - 1;
  var prevY = y;
  if (prevM < 1) { prevM = 12; prevY--; }
  var prevYm = String(prevY) + String(prevM).padStart(2, "0");

  var projects = tsuReadTableNormalized("DB_Projects").rows;
  var members = tsuSafeReadMembers();
  var memberById = {};
  for (var i = 0; i < members.length; i++){
    var mid = String(members[i].memberId || members[i].id || "").trim();
    if (mid) memberById[mid] = members[i];
  }

  // DB_BillingCycleから先月分を一括取得（正本はBillingCycle）
  var cycleTable = tsuReadTableNormalized("DB_BillingCycle");
  var fixedByPj = {};
  for (var i = 0; i < cycleTable.rows.length; i++){
    var c = cycleTable.rows[i];
    var cYm = String(c.ym || "").trim();
    if (cYm !== prevYm) continue;
    var pid = String(c.projectId || "").trim();
    if (!pid) continue;
    fixedByPj[pid] = String(c.monthlyReportFixedAt || "").trim();
  }

  for (var i = 0; i < projects.length; i++){
    var pj = projects[i];
    var pid = String(pj.projectId || "").trim();
    var st = String(pj.status || "").trim().toLowerCase();
    if (st !== "active" || !pid) continue;

    // FIX済みならスキップ
    if (fixedByPj[pid]) continue;

    var channelId = tsuGetProjectChannelId(pj);
    if (!channelId) continue;

    var pmMemberId = String(pj.pmMemberId || "").trim();
    var pm = pmMemberId ? (memberById[pmMemberId] || null) : null;
    var mention = tsuBuildPmMention(pm, pj);
    var osUrl = tsuBuildOsBillingUrl(pid, prevYm);

    var ymLabel = String(prevYm).slice(0, 4) + "年" + String(Number(prevYm.slice(4))) + "月";
    var text = "";

    if (day === 1){
      text = (mention ? mention + "\n\n" : "")
        + "📋 " + ymLabel + "の月次報告書、確定（FIX）お願い🌙\n"
        + "内容を確認して、問題なければコックピットで「確定」ボタンを押してね。\n"
        + "修正したい場合は修正指示も出せるよ。\n"
        + "締切は*3日*だよ。\n\n"
        + "👇 コックピット\n" + osUrl;
    } else {
      text = (mention ? mention + "\n\n" : "")
        + "⚠️ " + ymLabel + "の月次報告書、まだ未確定だよ🌙\n"
        + "*今日が締切*！早めにFIXお願い！\n\n"
        + "👇 コックピット\n" + osUrl;
    }

    slackNotifyPostToChannelTsukuyomi_(channelId, { text: text });
  }
}

/** トリガー設置（1回だけ手動実行） */
function install_cron_reportFixReminder() {
  var triggers = ScriptApp.getProjectTriggers();
  var removed = 0;
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "cron_reportFixReminder") {
      ScriptApp.deleteTrigger(triggers[i]);
      removed++;
    }
  }
  Logger.log("cron_reportFixReminder disabled; removed triggers=" + removed);
  return { ok: true, disabled: true, removed: removed };
}
