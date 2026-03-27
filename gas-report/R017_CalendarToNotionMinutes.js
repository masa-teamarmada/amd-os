// R017_CalendarToNotionMinutes.gs
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
  const ss = b_ss_();
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

  // ===== Notion PJ辞書 & 既存ページインデックス =====
  const pjMap = _notion_buildPjCodeToPageIdMap_(notionToken, pjDbId);
  const existingPages = _notion_loadExistingPages_(notionToken, minutesDbId);
  const existingEventIds = existingPages.byEventId;
  const existingByTitleDate = existingPages.byTitleDate;

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
  let merged = 0;  // AIミーティングノート由来ページとマージした数

  const preview = [];

  for (const ev of events){
    scanned++;

    const eventId = String(ev.id || "").trim();
    if (!eventId) continue;

    // ★既存判定（eventIdで一致するページ）
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

    // ★既存ページがある場合：PJが空なら埋める
    if (existed){
      if (!dryRun){
        try{
          const needPj = Number(existed.pjRelCount || 0) <= 0;
          if (needPj && pjPageId){
            _notion_setMinutesPjRelation_(notionToken, existed.pageId, pjPageId);
          }
        }catch(e){}
      }
      continue;
    }

    // ★タイトル+日付でeventId未設定のページを探す（日時サフィックス除去して比較）
    const dateKey = startAt.toISOString().substring(0, 10);  // YYYY-MM-DD
    const titleDateKey = _normMinutesTitle_(title) + "\t" + dateKey;
    const candidates = existingByTitleDate[titleDateKey] || [];

    // eventIdを持たないページ（= AIミーティングノート由来）を探す
    const aiPage = _findAiMeetingNotePage_(candidates);

    if (aiPage){
      // カレンダーページを新規作成し、AIミーティングノートの中身をコピーする
      if (!dryRun){
        try{
          // カレンダーページを作成（eventId + PJ付き）
          var createRes = _notion_createMinutesPage_(notionToken, minutesDbId, rec);
          if (createRes && createRes.ok && createRes.pageId){
            // AI版の中身をカレンダー版にコピー＆AI版をアーカイブ
            _notion_mergeAiIntoCalPage_(notionToken, createRes.pageId, aiPage.pageId);
            merged++;
            Logger.log("  [merge] '" + title + "' cal=" + createRes.pageId + " ← ai=" + aiPage.pageId);
          } else {
            Logger.log("  [merge] ページ作成失敗: " + title);
          }
        }catch(e){
          Logger.log("  [merge error] '" + title + "': " + e);
        }
      } else {
        merged++;
      }
      rec.note = (rec.note ? rec.note + ", " : "") + "merged:aiMeetingNote";
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
    merged,
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
/**
 * 議事録DB全ページを走査して2つのインデックスを返す
 * @returns {{ byEventId: Object, byTitleDate: Object }}
 *   byEventId:   eventId -> { pageId, pjRelCount }
 *   byTitleDate: "title\tYYYY-MM-DD" -> [{ pageId, pjRelCount, hasEventId, hasContent }]
 */
function _notion_loadExistingPages_(token, minutesDbId){
  const dbId = _notion_normId_(minutesDbId);
  if (!dbId) throw new Error("NOTION_DATABASE_ID invalid");

  const url = "https://api.notion.com/v1/databases/" + dbId + "/query";

  const byEventId = Object.create(null);
  const byTitleDate = Object.create(null);
  let cursor = null;

  while(true){
    const payload = { page_size: 100 };
    if (cursor) payload.start_cursor = cursor;

    const res = _notion_fetch_(token, url, "post", payload);
    const results = res.results || [];

    for (const p of results){
      const pageId = String(p && p.id ? p.id : "").trim();
      if (!pageId) continue;

      // --- eventId ---
      let eventIdVal = "";
      const evProp = p && p.properties ? p.properties["eventId"] : null;
      if (evProp && evProp.type){
        if (evProp.type === "rich_text"){
          const arr = Array.isArray(evProp.rich_text) ? evProp.rich_text : [];
          eventIdVal = arr.map(function(x){ return x && x.plain_text ? x.plain_text : ""; }).join("").trim();
        } else if (evProp.type === "title"){
          const arr = Array.isArray(evProp.title) ? evProp.title : [];
          eventIdVal = arr.map(function(x){ return x && x.plain_text ? x.plain_text : ""; }).join("").trim();
        } else if (evProp.type === "number"){
          eventIdVal = String(evProp.number || "").trim();
        } else {
          try{ eventIdVal = String(evProp[evProp.type] || "").trim(); } catch(e){}
        }
      }

      // --- PJ relation count ---
      var pjRelCount = 0;
      try{
        var pjProp = p && p.properties ? p.properties["PJ"] : null;
        if (pjProp && pjProp.type === "relation" && Array.isArray(pjProp.relation)){
          pjRelCount = pjProp.relation.length;
        }
      }catch(e){ pjRelCount = 0; }

      // --- タイトル ---
      var titleVal = "";
      try{
        var nameProp = p && p.properties ? p.properties["名前"] : null;
        if (nameProp && nameProp.type === "title" && Array.isArray(nameProp.title)){
          titleVal = nameProp.title.map(function(x){ return x && x.plain_text ? x.plain_text : ""; }).join("").trim();
        }
      }catch(e){}

      // --- 日付（YYYY-MM-DD部分のみ） ---
      var dateVal = "";
      try{
        var dateProp = p && p.properties ? p.properties["日付"] : null;
        if (dateProp && dateProp.type === "date" && dateProp.date && dateProp.date.start){
          dateVal = String(dateProp.date.start).substring(0, 10);
        }
      }catch(e){}

      // --- ページにコンテンツがあるか（AIミーティングノート由来の判定用） ---
      // Notion APIのquery結果にはchildren countは含まれないので、
      // eventIdが空 = AIミーティングノート由来と推定
      var hasContent = !eventIdVal;

      var entry = { pageId: pageId, pjRelCount: pjRelCount, hasEventId: !!eventIdVal, hasContent: hasContent };

      // byEventId インデックス
      if (eventIdVal){
        byEventId[eventIdVal] = entry;
      }

      // byTitleDate インデックス（タイトルと日付がある全ページ）
      // GASが付与した日時サフィックス（@... ）を除去して正規化
      if (titleVal && dateVal){
        var normTitle = _normMinutesTitle_(titleVal);
        var key = normTitle + "\t" + dateVal;
        if (!byTitleDate[key]) byTitleDate[key] = [];
        byTitleDate[key].push(entry);
      }
    }

    cursor = res.next_cursor;
    if (!cursor) break;
  }

  return { byEventId: byEventId, byTitleDate: byTitleDate };
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

  const payload = {
    parent: { database_id: dbId },
    properties: {
      "名前": { title: [{ text: { content: title } }] },
      "日付": { date: { start: dateIso } },
      "eventId": { rich_text: [{ text: { content: eventId } }] }
    }
  };

  const pjPageId = String(rec.pjPageId || "").trim();
  if (pjPageId){
    payload.properties["PJ"] = { relation: [{ id: pjPageId }] };
  }

  var res = _notion_fetch_(token, "https://api.notion.com/v1/pages", "post", payload);
  var pageId = (res && res.id) ? String(res.id) : "";
  return { ok: true, pageId: pageId };
}

/**
 * candidates（同タイトル+同日付のページ群）からAIミーティングノート由来のページを探す
 * 条件: eventIdを持たない（= GAS作成でない）ページ
 */
function _findAiMeetingNotePage_(candidates){
  if (!candidates || !candidates.length) return null;
  for (var i = 0; i < candidates.length; i++){
    if (!candidates[i].hasEventId) return candidates[i];
  }
  return null;
}

/**
 * タイトル正規化: GASが付与した日時サフィックス（@曜日 HH:MM (JST) 等）を除去
 * 例: "SX)int-納品物相談 @火曜日 18:00 (JST)" → "SX)int-納品物相談"
 *     "CX定例MTG" → "CX定例MTG"（変化なし）
 */
function _normMinutesTitle_(title){
  var t = String(title || "").trim();
  // " @" 以降を除去（GASが日時情報として付与するパターン）
  var atIdx = t.indexOf(" @");
  if (atIdx > 0) t = t.substring(0, atIdx).trim();
  // mention-date記法（Notionのdate mention）も除去
  t = t.replace(/\*\*<mention-date[^>]*\/>\*\*/g, "").trim();
  return t;
}

/**
 * AIミーティングノート由来ページの中身を、カレンダー作成ページにコピーし、AI版をアーカイブする。
 *
 * 1. AI版の「内容」プロパティ → カレンダー版に書き込み
 * 2. AI版のブロック（本文）→ カレンダー版にコピー
 * 3. カレンダー版に sourceAiPageId を記録
 * 4. AI版をアーカイブ（ゴミ箱）
 *
 * @param {string} token - Notion API token
 * @param {string} calPageId - カレンダー作成ページID（コピー先）
 * @param {string} aiPageId  - AIミーティングノート版ページID（コピー元）
 */
function _notion_mergeAiIntoCalPage_(token, calPageId, aiPageId){
  var calId = String(calPageId || "").trim();
  var aiId = String(aiPageId || "").trim();
  if (!calId || !aiId) throw new Error("calPageId or aiPageId missing");

  // --- 1. AI版の「内容」プロパティをカレンダー版にコピー ---
  try {
    var aiUrl = "https://api.notion.com/v1/pages/" + encodeURIComponent(aiId);
    var aiPage = _notion_fetch_(token, aiUrl, "get");
    var contentVal = "";
    if (aiPage && aiPage.properties && aiPage.properties["内容"]){
      var cp = aiPage.properties["内容"];
      if (cp.type === "rich_text" && Array.isArray(cp.rich_text)){
        contentVal = cp.rich_text.map(function(x){ return x.plain_text || ""; }).join("");
      }
    }
    if (contentVal){
      var calUrl = "https://api.notion.com/v1/pages/" + encodeURIComponent(calId);
      // rich_text は2000文字制限があるので分割
      var chunks = _splitText2000_(contentVal);
      var rtArr = chunks.map(function(c){ return { text: { content: c } }; });
      _notion_fetch_(token, calUrl, "patch", {
        properties: { "内容": { rich_text: rtArr } }
      });
    }
  } catch(e) {
    Logger.log("  [merge] 内容プロパティコピー失敗: " + e);
  }

  // --- 2. AI版のブロック（本文）をカレンダー版にコピー ---
  try {
    var blocks = _notion_readAllBlocks_(token, aiId);
    if (blocks.length > 0){
      _notion_appendBlocks_(token, calId, blocks);
    }
  } catch(e) {
    Logger.log("  [merge] ブロックコピー失敗（内容プロパティはコピー済み）: " + e);
  }

  // --- 3. sourceAiPageId を記録 ---
  try {
    var calUrl2 = "https://api.notion.com/v1/pages/" + encodeURIComponent(calId);
    _notion_fetch_(token, calUrl2, "patch", {
      properties: { "sourceAiPageId": { rich_text: [{ text: { content: aiId } }] } }
    });
  } catch(e) {
    Logger.log("  [merge] sourceAiPageId記録失敗: " + e);
  }

  // --- 4. AI版をアーカイブ ---
  try {
    var archiveUrl = "https://api.notion.com/v1/pages/" + encodeURIComponent(aiId);
    _notion_fetch_(token, archiveUrl, "patch", { archived: true });
  } catch(e) {
    Logger.log("  [merge] AI版アーカイブ失敗: " + e);
  }

  return { ok: true, calPageId: calId, aiPageId: aiId };
}

/** 2000文字ずつ分割（Notion rich_text制限対応） */
function _splitText2000_(text){
  var out = [];
  var s = String(text || "");
  while (s.length > 0){
    out.push(s.substring(0, 2000));
    s = s.substring(2000);
  }
  return out.length > 0 ? out : [""];
}

/** ページの全ブロック（children）を再帰的に読み取り */
function _notion_readAllBlocks_(token, pageId){
  var url = "https://api.notion.com/v1/blocks/" + encodeURIComponent(pageId) + "/children";
  var allBlocks = [];
  var cursor = null;
  while (true){
    var params = "?page_size=100";
    if (cursor) params += "&start_cursor=" + encodeURIComponent(cursor);
    var res = _notion_fetch_(token, url + params, "get");
    var results = res.results || [];
    for (var i = 0; i < results.length; i++){
      allBlocks.push(results[i]);
    }
    cursor = res.next_cursor;
    if (!cursor) break;
  }
  return allBlocks;
}

/**
 * ブロックをコピー先ページに追加（再帰的な子ブロックは非対応、1階層のみ）
 * Notion APIの制限: ブロックのidは除去して新規追加する
 */
function _notion_appendBlocks_(token, targetPageId, blocks){
  var url = "https://api.notion.com/v1/blocks/" + encodeURIComponent(targetPageId) + "/children";
  // コピー可能なブロックタイプのみフィルタ
  var copyable = [];
  for (var i = 0; i < blocks.length; i++){
    var b = blocks[i];
    if (!b || !b.type) continue;
    var copy = {};
    copy.type = b.type;
    copy.object = "block";
    // ブロックタイプごとのデータをコピー（idは除外）
    if (b[b.type]){
      copy[b.type] = JSON.parse(JSON.stringify(b[b.type]));
      // 子ブロック参照は除去（has_childrenはcopy元の情報なので）
      delete copy[b.type].children;
    }
    copyable.push(copy);
  }
  if (copyable.length === 0) return;
  // Notion APIは1回100ブロックまで
  for (var j = 0; j < copyable.length; j += 100){
    var chunk = copyable.slice(j, j + 100);
    _notion_fetch_(token, url, "patch", { children: chunk });
  }
}

/**
 * 既存の議事録ページのPJ relationを後から更新したい場合用
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

  const targetSs = cfgId ? SpreadsheetApp.openById(cfgId) : b_ss_();
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
  const s = String(text||"").toLowerCase();
  if (!s) return null;

  for (let i=0; i<(aliases||[]).length; i++){
    const a = aliases[i];
    if (!a || !a.alias) continue;

    if (a.matchType === "regex"){
      if (a.re && a.re.test(String(text||""))) return a;
    } else {
      if (s.includes(String(a.alias||"").toLowerCase())) return a;
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