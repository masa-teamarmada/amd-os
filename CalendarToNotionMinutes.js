// CalendarToNotionMinutes.gs
// ============================================================
// Google Calendar -> Notion 議事録DB 自動生成
// - eventId で重複排除（推定なし）
// - PJ は calendarColorId / eventColorId -> pjCode -> Notion PJ relation
//
// 前提（Notion議事録DB）プロパティ名：
// - 名前 (title) : "名前"
// - 日付 (date)  : "日付"
// - PJ (relation): "PJ"
// - eventId (text/rich_text): "eventId"
//
// Script Properties 前提：
// - NOTION_TOKEN
// - NOTION_DATABASE_ID           (議事録DB)
// - NOTION_PJ_DATABASE_ID        (PJ DB)
// ============================================================

/**
 * Admin: CalendarからNotion議事録を生成する
 * - dryRun=true ならNotionに書かない（previewのみ）
 * - days=N なら「今日00:00」からN日前までを対象（例:1=昨日分）
 *
 * payload:
 *  { dryRun:boolean, days:number }
 */
/**
 * Admin: CalendarからNotion議事録を生成する
 *
 * payload:
 *  {
 *    dryRun:boolean,
 *    days:number,        // 互換用：過去days日（従来挙動）
 *    window:string       // "tomorrow" | "yesterday" | "past"
 *  }
 */
function admin_createMinutesFromCalendar(payload){
  if (typeof canAccessAdminPage_ === "function" && !canAccessAdminPage_()) {
    return { ok:false, message:"access denied" };
  }

  payload = payload || {};
  const dryRun = !!payload.dryRun;

  // window: 明日分を作りたいなら "tomorrow"
  const windowMode = String(payload.window || "past").trim().toLowerCase();

  // 互換用（従来は days=1 で「昨日分」）
  const days = (payload.days !== undefined && payload.days !== null) ? Number(payload.days || 0) : 1;

  const props = PropertiesService.getScriptProperties();
  const notionToken = String(props.getProperty("NOTION_TOKEN") || "").trim();
  const minutesDbId = String(props.getProperty("NOTION_DATABASE_ID") || "").trim();
  const pjDbId = String(props.getProperty("NOTION_PJ_DATABASE_ID") || "").trim();

  if (!notionToken) return { ok:false, message:"NOTION_TOKEN missing" };
  if (!minutesDbId) return { ok:false, message:"NOTION_DATABASE_ID missing" };
  if (!pjDbId) return { ok:false, message:"NOTION_PJ_DATABASE_ID missing" };

  // ===== Calendar config =====
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const cfg = (typeof readKeyValueConfig_ === "function") ? readKeyValueConfig_(ss, "CFG_CalendarImport") : {};
  const calendarId = String(cfg.calendarId || Session.getActiveUser().getEmail()).trim();

  if (typeof readColorPJHistory_ !== "function") {
    return { ok:false, message:"readColorPJHistory_ not found" };
  }
  if (typeof pickPJByColorHistory_ !== "function") {
    return { ok:false, message:"pickPJByColorHistory_ not found" };
  }
  if (typeof listEventsByApi_ !== "function") {
    return { ok:false, message:"listEventsByApi_ not found" };
  }

  // ===== 色履歴 =====
  const colorHistory = readColorPJHistory_(ss);

  // ===== alias =====
  const pjAliases = _loadPJAliasesForMinutes_();

  // ===== Notion PJ辞書 & 既存eventId =====
  const pjMap = _notion_buildPjCodeToPageIdMap_(notionToken, pjDbId);
  const existingEventIds = _notion_loadExistingEventIds_(notionToken, minutesDbId);

  // ===== window =====
  const tz = "Asia/Tokyo";

  // 今日 00:00（JST基準）
  const todayStart = new Date();
  todayStart.setHours(0,0,0,0);

  let start = null;
  let endExclusive = null;

  // ★追加：range指定があれば最優先（例：150日前〜50日前）
  const range = payload.range || null;
  if (range && range.startOffsetDaysAgo !== undefined && range.endOffsetDaysAgo !== undefined){
    const a = Number(range.startOffsetDaysAgo);
    const b = Number(range.endOffsetDaysAgo);

    if (!isFinite(a) || !isFinite(b) || a <= b){
      return { ok:false, message:"range invalid. require startOffsetDaysAgo > endOffsetDaysAgo" };
    }

    // [today-a 00:00, today-b 00:00)
    start = new Date(todayStart);
    start.setDate(start.getDate() - Math.floor(a));

    endExclusive = new Date(todayStart);
    endExclusive.setDate(endExclusive.getDate() - Math.floor(b));

  } else if (windowMode === "tomorrow"){
    // 明日 00:00 〜 明後日 00:00
    start = new Date(todayStart);
    start.setDate(start.getDate() + 1);

    endExclusive = new Date(start);
    endExclusive.setDate(endExclusive.getDate() + 1);

  } else if (windowMode === "yesterday"){
    // 昨日 00:00 〜 今日 00:00
    endExclusive = new Date(todayStart);
    start = new Date(todayStart);
    start.setDate(start.getDate() - 1);

  } else {
    // 互換：過去days日（従来挙動）
    endExclusive = new Date(todayStart);
    start = new Date(todayStart);
    start.setDate(start.getDate() - Math.max(0, days));
  }


  const events = listEventsByApi_(calendarId, start, endExclusive);

  const calendarDefaultColorId = (typeof getCalendarDefaultColorId_ === "function")
    ? String(getCalendarDefaultColorId_(calendarId) || "").trim()
    : "";

// ===== exclude / override by alias =====
function resolveByAlias_(ev){
  const title = String(ev.summary || "").trim();
  const desc  = String(ev.description || "").trim();
  const loc   = String(ev.location || "").trim();
  const text  = (title + "\n" + desc + "\n" + loc);

  // 先頭が + / ＋ は最優先で除外（alias判定より強い）
  if (title.startsWith("+") || title.startsWith("＋")){
    return { action:"exclude", reason:"+prefix" };
  }

  // EXCLUDEが当たったら即スキップ / PJ上書き
  const hit = _matchAlias_(text, pjAliases);
  if (hit && String(hit.pjCode||"").trim().toUpperCase() === "EXCLUDE"){
    return { action:"exclude", reason: "alias:" + hit.alias };
  }

  // pjCodeの上書き（必要なら使う：色が無い/信用しない場合）
  if (hit && String(hit.pjCode||"").trim()){
    return { action:"pj", pjCode: String(hit.pjCode||"").trim(), reason: "alias:" + hit.alias };
  }

  return { action:"none" };
}

  let scanned = 0;
  let skipped = 0;
  let toCreate = 0;
  let created = 0;

  const preview = [];

  for (const ev of events){
    scanned++;

    const eventId = String(ev.id || "").trim();
    if (!eventId) continue;

    // ★既存判定（Mapに変更）
    const existed = existingEventIds && existingEventIds[eventId] ? existingEventIds[eventId] : null;

    const title = String(ev.summary || "").trim();
    if (!title) continue;

    const startObj = ev.start || {};
    const isAllDay = !!(startObj.date && !startObj.dateTime);
    if (isAllDay){
      skipped++;
      continue;
    }

    const startStr = startObj.dateTime || startObj.date;
    if (!startStr) continue;
    const startAt = new Date(startStr);
    if (isNaN(startAt.getTime())) continue;

    const aliasRes = resolveByAlias_(ev);
    if (aliasRes.action === "exclude"){
      skipped++;
      continue;
    }

    const colorId = String(ev.colorId || calendarDefaultColorId || "").trim();
    let pjCode = pickPJByColorHistory_(colorId, startAt, colorHistory) || "";

    if (!pjCode && aliasRes.action === "pj"){
      pjCode = aliasRes.pjCode;
    }
    if (!pjCode) pjCode = "AMD";

    const pjPageId = pjMap[pjCode] || "";

    const endObj = ev.end || {};
    const endStr = endObj.dateTime || endObj.date || "";
    const endAt = endStr ? new Date(endStr) : null;

    const rec = {
      eventId,
      title,
      dateIso: startAt.toISOString(),
      endIso: (endAt && !isNaN(endAt.getTime())) ? endAt.toISOString() : "",
      colorId: colorId || "",
      pjCode,
      pjPageId,
      note: aliasRes.reason || "",

      location: String(ev.location || "").trim(),
      description: String(ev.description || "").trim(),
      hangoutLink: String(ev.hangoutLink || "").trim(),
      htmlLink: String(ev.htmlLink || "").trim()
    };

    preview.push(rec);

    // ★既存ページがある場合：PJが空なら埋める（ここが本丸）
    if (existed){
      if (!dryRun){
        try{
          const needPj = Number(existed.pjRelCount || 0) <= 0;
          if (needPj && pjPageId){
            _notion_setMinutesPjRelation_(notionToken, existed.pageId, pjPageId);
          }
        }catch(e){}
      }
      // 既存は作らない（重複防止は維持）
      continue;
    }

    // ★新規作成
    toCreate++;
    if (!dryRun){
      const res = _notion_createMinutesPage_(notionToken, minutesDbId, rec);
      if (res && res.ok) created++;
    }
  }

  return {
    ok:true,
    dryRun,
    windowMode,
    calendarId,
    window: {
      start: Utilities.formatDate(start, tz, "yyyy-MM-dd HH:mm"),
      endExclusive: Utilities.formatDate(endExclusive, tz, "yyyy-MM-dd HH:mm")
    },
    scannedEvents: scanned,
    skippedEvents: skipped,
    toCreate,
    created,
    preview: preview.slice(0, 30)
  };
}

// ============================================================
// Notion helpers (for Minutes creation)
// ============================================================

/**
 * Notion議事録DB内の eventId を収集
 * - eventId は rich_text を想定（textでも大体同じ扱い）
 * - 件数が多いと重いので、必要なら後で「最近のみ」や「キャッシュ」にする
 */
function _notion_loadExistingEventIds_(token, minutesDbId){
  const dbId = _notion_normId_(minutesDbId);
  if (!dbId) throw new Error("NOTION_DATABASE_ID invalid");

  const url = "https://api.notion.com/v1/databases/" + dbId + "/query";

  // eventId -> { pageId, pjRelCount }
  const map = Object.create(null);
  let cursor = null;

  while(true){
    const payload = { page_size: 100 };
    if (cursor) payload.start_cursor = cursor;

    const res = _notion_fetch_(token, url, "post", payload);
    const results = res.results || [];

    for (const p of results){
      const pageId = String(p && p.id ? p.id : "").trim();
      if (!pageId) continue;

      // eventId
      const prop = p && p.properties ? p.properties["eventId"] : null;
      if (!prop || !prop.type) continue;

      let v = "";
      if (prop.type === "rich_text"){
        const arr = Array.isArray(prop.rich_text) ? prop.rich_text : [];
        v = arr.map(x => x && x.plain_text ? x.plain_text : "").join("").trim();
      } else if (prop.type === "title"){
        const arr = Array.isArray(prop.title) ? prop.title : [];
        v = arr.map(x => x && x.plain_text ? x.plain_text : "").join("").trim();
      } else if (prop.type === "number"){
        v = String(prop.number || "").trim();
      } else {
        try{ v = String(prop[prop.type] || "").trim(); } catch(e){}
      }
      if (!v) continue;

      // PJ relation count（空なら0）
      let pjRelCount = 0;
      try{
        const pjProp = p && p.properties ? p.properties["PJ"] : null;
        if (pjProp && pjProp.type === "relation" && Array.isArray(pjProp.relation)){
          pjRelCount = pjProp.relation.length;
        }
      }catch(e){ pjRelCount = 0; }

      map[v] = { pageId: pageId, pjRelCount: pjRelCount };
    }

    cursor = res.next_cursor;
    if (!cursor) break;
  }

  return map;
}

/**
 * PJ DB を走査して pjCode(title) -> pageId の辞書を作る（キャッシュ付き）
 */
function _notion_buildPjCodeToPageIdMap_(token, pjDatabaseId){
  const dbId = _notion_normId_(pjDatabaseId);
  if (!dbId) throw new Error("NOTION_PJ_DATABASE_ID invalid");

  const cache = CacheService.getScriptCache();
  const cacheKey = "pjMap:v1:" + dbId;

  try{
    const cached = cache.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch(e){}

  const url = "https://api.notion.com/v1/databases/" + dbId + "/query";
  const map = Object.create(null);

  let cursor = null;
  while(true){
    const payload = { page_size: 100 };
    if (cursor) payload.start_cursor = cursor;

    const res = _notion_fetch_(token, url, "post", payload);
    const results = res.results || [];

    for (const pg of results){
      const id = String(pg && pg.id ? pg.id : "").trim();
      if (!id) continue;

      const title = _notion_guessPageTitle_(pg);
      const code = String(title || "").trim();
      if (!code) continue;

      map[code] = id;
    }

    cursor = res.next_cursor;
    if (!cursor) break;
  }

  try{ cache.put(cacheKey, JSON.stringify(map), 6*60*60); } catch(e){}
  return map;
}

/**
 * Notion議事録ページを新規作成（eventIdで重複排除は呼び元で済ませる）
 */
function _notion_createMinutesPage_(token, minutesDbId, rec){
  const dbId = _notion_normId_(minutesDbId);
  if (!dbId) throw new Error("NOTION_DATABASE_ID invalid");

  const title = String(rec.title || "").trim();
  const dateIso = String(rec.dateIso || "").trim();
  const eventId = String(rec.eventId || "").trim();

  if (!title) return { ok:false, message:"title empty" };
  if (!dateIso) return { ok:false, message:"dateIso empty" };
  if (!eventId) return { ok:false, message:"eventId empty" };

  const location = String(rec.location || "").trim();
  const description = String(rec.description || "").trim();
  const hangoutLink = String(rec.hangoutLink || "").trim();

  const children = [];

  // 1 paragraph の content は 2000 文字制限があるので分割して積む
  function pushTextAsParagraphs(text){
    const s = String(text || "");
    if (!s) return;
    const MAX = 1900; // 安全側（装飾や改行で微妙にズレても死なないように）
    for (let i=0; i<s.length; i+=MAX){
      const chunk = s.slice(i, i+MAX);
      children.push({
        object: "block",
        type: "paragraph",
        paragraph: { rich_text: [{ type: "text", text: { content: chunk } }] }
      });
    }
  }

  // ★検証：/meet を“そのまま”先頭に置く
  // ★MeetはAPIで“コマンド実行”できないので、枠だけ作る（人が /meet を打つ）
  children.push({
    object:"block",
    type:"heading_2",
    heading_2:{ rich_text:[{type:"text", text:{content:"Meet（ここで /meet を打つ）"}}] }
  });
  children.push({
    object:"block",
    type:"paragraph",
    paragraph:{ rich_text:[] } // 空行
  });

  // Meet URL（あれば表示しておく）
  if (hangoutLink){
    children.push({
      object: "block",
      type: "paragraph",
      paragraph: { rich_text: [{ type: "text", text: { content: "Meet URL: " + hangoutLink } }] }
    });
  }


  // Meet URL
  if (hangoutLink){
    children.push({
      object: "block",
      type: "paragraph",
      paragraph: { rich_text: [{ type: "text", text: { content: hangoutLink } }] }
    });
  }

  // 場所
  if (location){
    children.push({
      object: "block",
      type: "paragraph",
      paragraph: { rich_text: [{ type: "text", text: { content: "場所: " + location } }] }
    });
  }

  // 説明（長文は分割）
  if (description){
    pushTextAsParagraphs("説明:\n" + description);
  }

  // 見出しテンプレ
  children.push({
    object:"block",
    type:"heading_2",
    heading_2:{ rich_text:[{type:"text", text:{content:"背景"}}] }
  });
  children.push({
    object:"block",
    type:"paragraph",
    paragraph:{ rich_text:[{type:"text", text:{content:"（Slack回答をここに集約）"}}] }
  });

  children.push({
    object:"block",
    type:"heading_2",
    heading_2:{ rich_text:[{type:"text", text:{content:"本日の着地点"}}] }
  });
  children.push({
    object:"block",
    type:"paragraph",
    paragraph:{ rich_text:[{type:"text", text:{content:"（Slack回答をここに集約）"}}] }
  });

  children.push({
    object:"block",
    type:"heading_2",
    heading_2:{ rich_text:[{type:"text", text:{content:"メモ"}}] }
  });
  children.push({ object:"block", type:"paragraph", paragraph:{ rich_text:[] } });

  const payload = {
    parent: { database_id: dbId },
    properties: {
      "名前": { title: [{ text: { content: title } }] },
      "日付": { date: { start: dateIso } },
      "eventId": { rich_text: [{ text: { content: eventId } }] }
    },
    children: children
  };

  const pjPageId = String(rec.pjPageId || "").trim();
  if (pjPageId){
    payload.properties["PJ"] = { relation: [{ id: pjPageId }] };
  }

  _notion_fetch_(token, "https://api.notion.com/v1/pages", "post", payload);
  return { ok:true };
}

/**
 * 既存の議事録ページのPJ relationを後から更新したい場合用（将来利用）
 */
function _notion_setMinutesPjRelation_(token, minutesPageId, pjPageId){
  const pid = String(minutesPageId||"").trim();
  const pjId = String(pjPageId||"").trim();
  if (!pid || !pjId) throw new Error("pageId missing");

  const url = "https://api.notion.com/v1/pages/" + encodeURIComponent(pid);
  const payload = {
    properties: {
      "PJ": { relation: [{ id: pjId }] }
    }
  };
  _notion_fetch_(token, url, "patch", payload);
  return { ok:true };
}

// ============================================================
// Runners (function picker)
// ============================================================

function run_createMinutes_dry(){
  const res = admin_createMinutesFromCalendar({ dryRun:true, days:1 });
  Logger.log("[run_createMinutes_dry]\n" + JSON.stringify(res, null, 2));
  return res;
}

function run_createMinutes_apply(){
  // 毎日トリガーで「明日分」を作る
  const res = admin_createMinutesFromCalendar({ dryRun:false, window:"tomorrow" });
  Logger.log("[run_createMinutes_apply]\n" + JSON.stringify(res, null, 2));
  return res;
}

// 任意：直近3日分をdryで確認
function run_createMinutes_dry_3days(){
  const res = admin_createMinutesFromCalendar({ dryRun:true, days:3 });
  Logger.log("[run_createMinutes_dry_3days]\n" + JSON.stringify(res, null, 2));
  return res;
}

/**
 * 工数管理スプシ（外部）にある CFG_PJAlias を読み込む
 * - ScriptProperties: COLOR_PJ_CONFIG_SPREADSHEET_ID を参照
 * - 無ければ ActiveSpreadsheet から読む（保険）
 */
function _loadPJAliasesForMinutes_(){
  const props = PropertiesService.getScriptProperties();
  const cfgId = String(props.getProperty("COLOR_PJ_CONFIG_SPREADSHEET_ID") || "").trim();

  const targetSs = cfgId ? SpreadsheetApp.openById(cfgId) : SpreadsheetApp.getActiveSpreadsheet();
  const sh = targetSs.getSheetByName("CFG_PJAlias");
  if (!sh) return [];

  const values = sh.getDataRange().getValues();
  if (!values || values.length < 2) return [];

  const header = (values[0] || []).map(h=>String(h||"").trim());
  const iAlias = header.indexOf("alias");
  const iPJ = header.indexOf("pjCode");
  const iPri = header.indexOf("priority");
  const iType = header.indexOf("matchType");
  if (iAlias < 0 || iPJ < 0) return [];

  const list = [];
  for (let r=1; r<values.length; r++){
    const row = values[r];
    const alias = String(row[iAlias]||"").trim();
    const pjCode = String(row[iPJ]||"").trim();
    if (!alias || !pjCode) continue;

    const pri = (iPri >= 0) ? Number(row[iPri]||0) : 0;
    const matchType = (iType >= 0 ? String(row[iType]||"").trim().toLowerCase() : "contains") || "contains";

    const item = { alias, pjCode, priority: (isFinite(pri)?pri:0), matchType };
    if (matchType === "regex"){
      try{ item.re = new RegExp(alias, "i"); } catch(e){ item.re = null; }
    }
    list.push(item);
  }

  // priority desc, then alias length desc
  list.sort((a,b)=>{
    const p = (b.priority||0) - (a.priority||0);
    if (p !== 0) return p;
    return (String(b.alias||"").length) - (String(a.alias||"").length);
  });

  return list;
}

/**
 * aliasルールで最優先の1件を返す
 */
function _matchAlias_(text, aliases){
  const s = String(text||"");
  if (!s) return null;

  for (let i=0; i<(aliases||[]).length; i++){
    const a = aliases[i];
    if (!a || !a.alias) continue;

    if (a.matchType === "regex"){
      if (a.re && a.re.test(s)) return a;
    } else {
      // contains default
      if (s.includes(a.alias)) return a;
    }
  }
  return null;
}

/**
 * Minutes自動生成の時間トリガーをインストール
 * - JSTで毎日指定時刻に run_createMinutes_apply を実行
 */
function admin_installMinutesDailyTrigger(payload){
  payload = payload || {};
  const hour = (payload.hour !== undefined && payload.hour !== null) ? Number(payload.hour) : 3; // JST 3:00 default

  // 既存の同種トリガーを消して二重起動を防ぐ
  admin_removeMinutesDailyTrigger();

  ScriptApp.newTrigger("run_createMinutes_apply")
    .timeBased()
    .everyDays(1)
    .atHour(Math.max(0, Math.min(23, hour)))
    .create();

  return { ok:true, message:"installed", hour:hour, timezone:Session.getScriptTimeZone() };
}

/**
 * Minutes自動生成の時間トリガーを削除
 */
function admin_removeMinutesDailyTrigger(){
  const triggers = ScriptApp.getProjectTriggers();
  let removed = 0;
  for (const t of triggers){
    if (t.getHandlerFunction && t.getHandlerFunction() === "run_createMinutes_apply"){
      ScriptApp.deleteTrigger(t);
      removed++;
    }
  }
  return { ok:true, removed:removed };
}

/**
 * 現在のトリガー一覧を確認（デバッグ用）
 */
function admin_listProjectTriggers(){
  const triggers = ScriptApp.getProjectTriggers();
  const list = triggers.map(t => ({
    handler: t.getHandlerFunction ? t.getHandlerFunction() : "",
    source: String(t.getTriggerSource ? t.getTriggerSource() : ""),
    eventType: String(t.getEventType ? t.getEventType() : "")
  }));
  return { ok:true, timezone:Session.getScriptTimeZone(), count:list.length, triggers:list };
}

/**
 * トリガー専用：Calendar→Notion議事録生成（adminチェックを通さない入口）
 */
function cron_createMinutesFromCalendar(){
  // ★毎日03:00：明日分の議事録枠を作る（AIミーティングノートは使わない）
  const res = admin_createMinutesFromCalendar({ dryRun:false, window:"tomorrow" });
  Logger.log("[cron_createMinutesFromCalendar]\n" + JSON.stringify(res, null, 2));
  return res;
}

/**
 * 手動実行用：Minutesの毎日トリガーをJST 3:00で作る
 */
function run_installMinutesDailyTrigger_3am(){
  return admin_installMinutesDailyTrigger({ hour: 3 });
}

/**
 * 手動実行用：Minutesの毎日トリガーをJST 6:00で作る（例）
 */
function run_installMinutesDailyTrigger_6am(){
  return admin_installMinutesDailyTrigger({ hour: 6 });
}

/**
 * 手動実行用：Minutesの毎日トリガーを削除
 */
function run_removeMinutesDailyTrigger(){
  return admin_removeMinutesDailyTrigger();
}

/**
 * 手動実行用：トリガー一覧を確認
 */
function run_listProjectTriggers(){
  return admin_listProjectTriggers();
}

function run_createMinutes_apply_range(){
  const res = admin_createMinutesFromCalendar({
    dryRun:false,
    range: { startOffsetDaysAgo: 50, endOffsetDaysAgo: 1 } // ←ここだけ毎回書き換える
  });
  Logger.log("[run_createMinutes_apply_range]\n" + JSON.stringify(res, null, 2));
  return res;
}