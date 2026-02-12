/** 072_TsukuyomiContextInit.gs
 * DB_TsukuyomiContext（本体スプシ）のヘッダを自動整備する
 *
 * 役割:
 * - 既存ヘッダ tags/status/systemPrompt を維持
 * - 足りない列だけ右に追加（手打ち事故防止）
 *
 * 使い方:
 * - admin_initTsukuyomiContextSchema() を1回実行
 * - 2回目以降も安全（不足分のみ補完）
 */

function admin_initTsukuyomiContextSchema(){
  const ss = SpreadsheetApp.getActiveSpreadsheet(); // 本体スプシにバインド前提
  const sheetName = "DB_TsukuyomiContext";
  const sh = ss.getSheetByName(sheetName);
  if (!sh) return { ok:false, message:`sheet not found: ${sheetName}` };

  const desired = getHeaderTsukuyomiContext();
  const result = ensureHeader(sh, desired);

  // 体裁
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, sh.getLastColumn()).setFontWeight("bold");
  sh.autoResizeColumns(1, Math.min(sh.getLastColumn(), 30));

  return { ok:true, message:"schema ensured", result };
}

function getHeaderTsukuyomiContext(){
  // 既存3列は絶対先頭固定（互換性維持）
  return [
    "tags",          // 例: "tsukuyomi,style" / "global,constraint"
    "status",        // active / archived
    "systemPrompt",  // ルール本文（1行ルール or 短文パラグラフ）

    // ↓ここから拡張（人格育成用：後から検索・検証できる形）
    "contextId",         // uuid
    "contextType",       // style / principle / constraint / tactic
    "priority",          // 1-5
    "scope",             // global / project / user / channel
    "scopeKey",          // projectId 等
    "rationale",         // なぜこのルールか
    "evidenceSnippet",   // 根拠の短い抜粋
    "sourceEventIdsJson",// 将来Events作る時の紐付け用（配列JSON）
    "createdAtJst",
    "updatedAtJst"
  ];
}

function ensureHeader(sh, desired){
  desired = desired || [];
  if (desired.length === 0) throw new Error("desired header empty");

  const lastCol = Math.max(1, sh.getLastColumn(), desired.length);
  const row1 = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  const exist = row1.map(v => String(v||"").trim()).filter((v, i, arr) => !(i === arr.length-1 && v === "")); // 末尾空は気にしない

  // 先頭3列の互換チェック（壊れてたら止める）
  const must = ["tags","status","systemPrompt"];
  for (let i=0; i<must.length; i++){
    const a = String(exist[i] || "").trim();
    if (a && a !== must[i]) {
      return { mode:"abort", message:`header mismatch at col${i+1}: expected=${must[i]} actual=${a}` };
    }
  }

  // 既存が空っぽなら全部セット
  const isAllEmpty = row1.every(v => String(v||"").trim() === "");
  if (isAllEmpty) {
    sh.getRange(1, 1, 1, desired.length).setValues([desired]);
    return { mode:"set", added: desired };
  }

  // 不足分だけ追加（順序は desired を正にする）
  const existSet = {};
  exist.forEach(h => { if (h) existSet[h]=true; });
  const toAdd = desired.filter(h => !existSet[h]);

  if (toAdd.length > 0) {
    const startCol = exist.length + 1;
    sh.getRange(1, startCol, 1, toAdd.length).setValues([toAdd]);
    return { mode:"append", added: toAdd };
  }

  return { mode:"noop", added: [] };
}

function payoutTestSlidesAuth(){
  const p = SlidesApp.create("auth_test_slides");
  const f = DriveApp.getFileById(p.getId());
  try{ f.setTrashed(true); } catch(e){}
  return { ok:true };
}

function debug_monthly_items_console(){
  const res = nav_debugMonthlyItems({
    projectId: "p31",   // 見たいPJ
    ym: "202602"        // 見たい月
  });

  Logger.log(JSON.stringify(res, null, 2));
  return res;
}

/** 123_NotionMinutesAudit.gs
 * 役割：
 * - Notion議事録DBを全件スキャンし、「本文から抽出できる/できない」の原因を可視化する
 * - “内容プロパティ”の有無と、blocks本文（page children）の抽出量・block種別・has_children有無などを一覧化してスプシに出す
 *
 * 使い方：
 * - run: nav_auditNotionMinutesAllToSheet({ limitPages: 500, maxBodyChars: 12000 })
 * - 出力先：DB_NotionMinutesAudit（無ければ自動生成）
 */

function nav_auditNotionMinutesAllToSheet(payload){
  payload = payload || {};
  const limitPages = (payload.limitPages !== undefined && payload.limitPages !== null) ? Number(payload.limitPages||0) : 400;
  const maxBodyChars = (payload.maxBodyChars !== undefined && payload.maxBodyChars !== null) ? Number(payload.maxBodyChars||0) : 12000;

  const props = PropertiesService.getScriptProperties();
  const notionToken = String(props.getProperty("NOTION_TOKEN") || "").trim();
  const notionDbRaw = String(props.getProperty("NOTION_DATABASE_ID") || "").trim();
  const dateProp = String(props.getProperty("NOTION_MINUTES_DATE_PROP") || "日付").trim() || "日付";

  if (!notionToken) return { ok:false, message:"NOTION_TOKEN missing" };
  if (!notionDbRaw) return { ok:false, message:"NOTION_DATABASE_ID missing" };

  const dbId = (typeof _notion_normId_ === "function") ? _notion_normId_(notionDbRaw) : String(notionDbRaw||"").trim();
  if (!dbId) return { ok:false, message:"NOTION_DATABASE_ID invalid" };

  const sh = getSheetOrCreate_("DB_NotionMinutesAudit");
  ensureHeader_(sh, [
    "pageId",
    "title",
    "url",
    "dateStart",
    "lastEditedTime",
    "pjRelCount",
    "pjRelId0",
    "pjRelTitle0",
    "amdProjectIdByRelTitle",
    "eventId",
    "contentPropLen",
    "bodyTextLen",
    "extractedTextHead",
    "blockTypesJson",
    "hasChildrenCount",
    "unsupportedTypesJson",
    "note"
  ]);

  // 既存行が大量だと邪魔なので、まずクリア（ヘッダは残す）
  const lastRow = sh.getLastRow();
  if (lastRow >= 2){
    sh.getRange(2,1,lastRow-1, sh.getLastColumn()).clearContent();
  }

  const url = "https://api.notion.com/v1/databases/" + dbId + "/query";

  // DB全件を last_edited_time desc で回す（フィルタ無し）
  const base = {
    sorts: [{ timestamp:"last_edited_time", direction:"descending" }],
    page_size: 100
  };

  const outRows = [];
  let cursor = null;
  let fetched = 0;

  while (true){
    const req = Object.assign({}, base);
    if (cursor) req.start_cursor = cursor;

    const res = _notion_fetch_(notionToken, url, "post", req);
    const results = Array.isArray(res && res.results) ? res.results : [];

    for (let i=0; i<results.length; i++){
      const p = results[i] || {};
      const pageId = String(p.id || "").trim();
      if (!pageId) continue;

      fetched++;
      if (limitPages > 0 && fetched > limitPages) break;

      const title = nav_audit_extractTitle_(p);
      const pageUrl = String(p.url || "").trim();
      const lastEdited = String(p.last_edited_time || "").trim();

      const dateStart = nav_audit_extractDateStart_(p, dateProp);

      const relIds = (typeof _notion_extractRelationIds_ === "function")
        ? (_notion_extractRelationIds_(p, "PJ") || [])
        : [];
      const relId0 = relIds.length ? String(relIds[0]) : "";
      let relTitle0 = "";
      let amdPidByRelTitle = "";

      try{
        if (relId0 && typeof _notion_resolvePageTitleCached_ === "function"){
          relTitle0 = String(_notion_resolvePageTitleCached_(notionToken, relId0) || "").trim();
        }
        if (relTitle0 && typeof _resolveAmdProjectIdByProjectNameOrCode_ === "function"){
          amdPidByRelTitle = String(_resolveAmdProjectIdByProjectNameOrCode_(relTitle0) || "").trim();
        }
      }catch(e){
        // noop
      }

      const eventId = nav_audit_extractPropText_(p, "eventId");
      const contentProp = nav_audit_extractPropText_(p, "内容");
      const contentPropLen = String(contentProp || "").trim().length;

      // blocks本文の統計（“取れない”原因の切り分けの本丸）
      const stats = nav_audit_fetchBodyStats_(notionToken, pageId, { maxChars: maxBodyChars });

      const bodyText = String(stats.text || "").trim();
      const bodyTextLen = bodyText.length;
      const head = bodyText ? bodyText.slice(0, 220) : "";

      const blockTypesJson = JSON.stringify(stats.typeCounts || {});
      const hasChildrenCount = Number(stats.hasChildrenCount || 0);
      const unsupportedTypesJson = JSON.stringify(stats.unsupportedTypes || {});

      let note = "";
      // よくあるパターンを一言メモ
      if (!contentPropLen && !bodyTextLen) note = "text empty (content+body)";
      else if (!contentPropLen && bodyTextLen) note = "body-only (good: no manual copy)";
      else if (contentPropLen && !bodyTextLen) note = "content-only (body no text)";
      else note = "both";

      // “AIノートっぽいのに取れない”の典型：has_children多い / unsupportedが多い
      if (!bodyTextLen && hasChildrenCount > 0) note += " / has_children";
      if (!bodyTextLen && unsupportedTypesJson !== "{}") note += " / unsupported_types";

      outRows.push([
        pageId,
        title,
        pageUrl,
        dateStart,
        lastEdited,
        relIds.length,
        relId0,
        relTitle0,
        amdPidByRelTitle,
        eventId,
        contentPropLen,
        bodyTextLen,
        head,
        blockTypesJson,
        hasChildrenCount,
        unsupportedTypesJson,
        note
      ]);

      // まとめて書く（速度）
      if (outRows.length >= 30){
        sh.getRange(sh.getLastRow()+1, 1, outRows.length, outRows[0].length).setValues(outRows);
        outRows.length = 0;
      }
    }

    if (limitPages > 0 && fetched >= limitPages) break;

    cursor = String(res && res.next_cursor ? res.next_cursor : "").trim();
    if (!cursor) break;
  }

  if (outRows.length){
    sh.getRange(sh.getLastRow()+1, 1, outRows.length, outRows[0].length).setValues(outRows);
  }

  return { ok:true, sheetName:"DB_NotionMinutesAudit", scanned: fetched };
}

// ===== helpers =====

function nav_audit_extractTitle_(p){
  try{
    const props = (p && p.properties) ? p.properties : {};
    const keys = Object.keys(props || {});
    for (let i=0; i<keys.length; i++){
      const k = keys[i];
      const prop = props[k];
      if (prop && prop.type === "title" && Array.isArray(prop.title)){
        const t = prop.title.map(x=>String(x && x.plain_text ? x.plain_text : "")).join("").trim();
        if (t) return t;
      }
    }
  }catch(e){}
  return "";
}

function nav_audit_extractDateStart_(p, dateProp){
  const name = String(dateProp || "日付").trim() || "日付";
  try{
    const pp = (p && p.properties) ? p.properties : {};
    const pr = pp && pp[name] ? pp[name] : null;
    if (pr && pr.type === "date" && pr.date && pr.date.start){
      return String(pr.date.start || "").trim();
    }
  }catch(e){}
  return "";
}

function nav_audit_extractPropText_(p, propName){
  try{
    if (typeof _notion_extractPropertyText_ === "function"){
      return String(_notion_extractPropertyText_(p, propName) || "");
    }
  }catch(e){}
  return "";
}

/**
 * blocks本文をスキャンして
 * - text（plain_text結合）
 * - typeCounts（どのblockが多いか）
 * - unsupportedTypes（未対応typeのカウント）
 * - hasChildrenCount（入れ子の匂い）
 * を返す
 */
function nav_audit_fetchBodyStats_(token, pageId, opts){
  const o = opts || {};
  const maxChars = (o.maxChars !== undefined && o.maxChars !== null) ? Number(o.maxChars||0) : 12000;

  const pid = String(pageId || "").trim();
  if (!pid) return { text:"", typeCounts:{}, unsupportedTypes:{}, hasChildrenCount:0 };

  const blockId = (typeof _notion_normId_ === "function") ? _notion_normId_(pid) : pid;
  if (!blockId) return { text:"", typeCounts:{}, unsupportedTypes:{}, hasChildrenCount:0 };

  const base = "https://api.notion.com/v1/blocks/" + blockId + "/children?page_size=100";

  const lines = [];
  let total = 0;

  const typeCounts = {};
  const unsupportedTypes = {};
  let hasChildrenCount = 0;

  function bump(map, k){
    map[k] = (map[k] || 0) + 1;
  }
  function pushLine(s){
    const t = String(s || "").trim();
    if (!t) return;
    lines.push(t);
    total += t.length + 1;
  }

  let cursor = null;
  while (true){
    let url = base;
    if (cursor) url += "&start_cursor=" + encodeURIComponent(cursor);

    const res = _notion_fetch_(token, url, "get", null);
    const results = Array.isArray(res && res.results) ? res.results : [];

    for (let i=0; i<results.length; i++){
      const b = results[i] || {};
      const type = String(b.type || "").trim() || "unknown";
      bump(typeCounts, type);

      if (b.has_children) hasChildrenCount++;

      // 対応してるtype（テキスト取り）
      const rt =
        (type === "paragraph" && b.paragraph && b.paragraph.rich_text) ? b.paragraph.rich_text :
        (type === "heading_1" && b.heading_1 && b.heading_1.rich_text) ? b.heading_1.rich_text :
        (type === "heading_2" && b.heading_2 && b.heading_2.rich_text) ? b.heading_2.rich_text :
        (type === "heading_3" && b.heading_3 && b.heading_3.rich_text) ? b.heading_3.rich_text :
        (type === "bulleted_list_item" && b.bulleted_list_item && b.bulleted_list_item.rich_text) ? b.bulleted_list_item.rich_text :
        (type === "numbered_list_item" && b.numbered_list_item && b.numbered_list_item.rich_text) ? b.numbered_list_item.rich_text :
        (type === "to_do" && b.to_do && b.to_do.rich_text) ? b.to_do.rich_text :
        (type === "toggle" && b.toggle && b.toggle.rich_text) ? b.toggle.rich_text :
        (type === "quote" && b.quote && b.quote.rich_text) ? b.quote.rich_text :
        (type === "callout" && b.callout && b.callout.rich_text) ? b.callout.rich_text :
        (type === "code" && b.code && b.code.rich_text) ? b.code.rich_text :
        null;

      if (Array.isArray(rt) && rt.length){
        const text = rt.map(x=>String(x && x.plain_text ? x.plain_text : "")).join("").trim();
        if (text) pushLine(text);
      } else {
        // 非対応type（ここが「取れない」の原因候補）
        if (!["unsupported","unknown"].includes(type)){
          if (!rt) bump(unsupportedTypes, type);
        }
      }

      if (maxChars > 0 && total >= maxChars) break;
    }

    if (maxChars > 0 && total >= maxChars) break;

    cursor = String(res && res.next_cursor ? res.next_cursor : "").trim();
    if (!cursor) break;
  }

  return {
    text: lines.join("\n").trim(),
    typeCounts: typeCounts,
    unsupportedTypes: unsupportedTypes,
    hasChildrenCount: hasChildrenCount
  };
}

function nav_debugNotionPageProps_30197749(){
  // ★このpageIdは、まさが貼ってくれた p09(JC) 2026-02-05 のやつ
  const pageId = "30197749-c608-80f2-8b12-d513f66db029";

  const props = PropertiesService.getScriptProperties();
  const token = String(props.getProperty("NOTION_TOKEN") || "").trim();
  if (!token) throw new Error("NOTION_TOKEN missing");

  const pid = (typeof _notion_normId_ === "function") ? _notion_normId_(pageId) : pageId;
  const url = "https://api.notion.com/v1/pages/" + pid;

  const p = _notion_fetch_(token, url, "get", null);
  const ps = (p && p.properties) ? p.properties : {};

  // PJプロパティの“型”と生データを出す（ここが本丸）
  const pj = ps["PJ"];
  const pjType = pj ? String(pj.type || "") : "(missing)";
  const pjRaw = pj ? pj : null;

  // eventId と 内容 も同時に確認
  const ev = ps["eventId"];
  const evType = ev ? String(ev.type || "") : "(missing)";

  const cont = ps["内容"];
  const contType = cont ? String(cont.type || "") : "(missing)";

  // properties一覧（名前・型・軽い要約）
  const out = [];
  Object.keys(ps).forEach(k=>{
    const v = ps[k] || {};
    const type = String(v.type || "").trim();
    let summary = "";
    try{
      if (type === "relation"){
        summary = "relation(" + (Array.isArray(v.relation) ? v.relation.length : 0) + ")";
      } else if (type === "rollup"){
        summary = "rollup";
      } else if (type === "formula"){
        summary = "formula";
      } else if (type === "date"){
        summary = v.date && v.date.start ? String(v.date.start) : "";
      } else if (type === "rich_text"){
        const a = Array.isArray(v.rich_text) ? v.rich_text : [];
        summary = a.slice(0,1).map(x=>String(x.plain_text||"")).join("");
      } else if (type === "title"){
        const a = Array.isArray(v.title) ? v.title : [];
        summary = a.slice(0,1).map(x=>String(x.plain_text||"")).join("");
      } else if (type === "select"){
        summary = v.select && v.select.name ? String(v.select.name) : "";
      } else if (type === "multi_select"){
        const a = Array.isArray(v.multi_select) ? v.multi_select : [];
        summary = a.slice(0,3).map(x=>String(x.name||"")).join(", ");
      } else if (type === "checkbox"){
        summary = String(!!v.checkbox);
      }
    }catch(e){ summary = ""; }

    out.push({ name:k, type:type, summary:summary });
  });
  out.sort((a,b)=>String(a.name).localeCompare(String(b.name)));

  const result = {
    ok: true,
    pageId: String(p.id || ""),
    url: String(p.url || ""),
    pjType: pjType,
    eventIdType: evType,
    contentType: contType,
    properties: out,
    pjRaw: pjRaw
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function nav_debugListSheets(){
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const sheets = ss.getSheets().map(sh => ({
    name: sh.getName(),
    sheetId: sh.getSheetId(),
    lastRow: sh.getLastRow(),
    lastCol: sh.getLastColumn()
  })).sort((a,b)=> String(a.name).localeCompare(String(b.name)));

  const out = {
    ok: true,
    spreadsheetId: ss.getId(),
    spreadsheetName: ss.getName(),
    sheets: sheets,
    ranAtIso: new Date().toISOString()
  };

  // ★痕跡を必ず残す（新/旧どっちのログビューでも見えるように両方）
  try{ Logger.log("[nav_debugListSheets] " + JSON.stringify(out)); }catch(e){}
  try{ console.log("[nav_debugListSheets]", out); }catch(e){}

  return out;
}

function nav_debugSearchEditsAppend(){
  // Apps Script APIを使わず、既存の "projects.content" が無い環境でも動くように
  // 今は「このファイル内」しか探せないので、まずは手がかり作り用。
  // 本命は 160_CodeSearch の横断検索だけど、ここは最初の足場。

  const hits = [];

  // ここは手動で：この関数を貼り付けたファイル（073）のソースだけ検索する。
  // GASは自分のソース文字列を直接取れないので、いったん諦め。
  // → 代わりに「二重書き込みを起こし得る関数名」を返すだけにする。
  // まさの環境に 160_CodeSearch があるなら、そっちで横断検索が最短。

  return {
    ok: true,
    message:
      "二重書き込みの犯人は、DB_NavigatorMonthlyEdits への appendRow を直接やってる古い関数。160_CodeSearch で `DB_NavigatorMonthlyEdits` と `appendRow` を横断検索してヒット箇所を教えて。",
    keywords: [
      'DB_NavigatorMonthlyEdits',
      'getSheet_("DB_NavigatorMonthlyEdits")',
      'getSheetOrCreate_("DB_NavigatorMonthlyEdits")',
      'appendRow(',
      'MonthlyEdits'
    ]
  };
}

function admin_generateDbSheetList(){
  const spreadsheetIds = [
    "1v_xW_itzi4QSH-kXNoL_nOw7wLR_4oaqezG7JxvDtkE",
    "1BQVu7piMxO7yB0-0mwSMxqDo2qC2LIBZzIjCd5tspZ8",
    "1s3HfM2-tB3Bdthpa1FoaX2uK-MG5BziJz4Yx3ut3ExQ"
  ];

  const includeHidden = true; // hiddenシートも収集する
  const outSheetName = "DB_SheetList";

  const out = getSheetOrCreate(outSheetName);
  ensureHeader(out, [
    "capturedAtJst",
    "sourceSpreadsheetId",
    "sourceSpreadsheetName",
    "sourceSpreadsheetUrl",
    "sheetIndex",
    "sheetId",
    "sheetName",
    "isHidden",
    "maxRows",
    "maxCols",
    "lastRow",
    "lastCol",
    "notes"
  ]);

  const capturedAtJst = formatJst(new Date());

  // いったん中身は全消し（ヘッダは残す）
  clearBody(out);

  const rows = [];
  for (let i = 0; i < spreadsheetIds.length; i++){
    const sid = String(spreadsheetIds[i] || "").trim();
    if (!sid) continue;

    try{
      const ss = SpreadsheetApp.openById(sid);
      const ssName = ss.getName();
      const ssUrl = ss.getUrl();

      const sheets = ss.getSheets();
      for (let j = 0; j < sheets.length; j++){
        const sh = sheets[j];
        const isHidden = sh.isSheetHidden();
        if (!includeHidden && isHidden) continue;

        rows.push([
          capturedAtJst,
          sid,
          ssName,
          ssUrl,
          j, // sheetIndex
          sh.getSheetId(),
          sh.getName(),
          isHidden ? "TRUE" : "FALSE",
          sh.getMaxRows(),
          sh.getMaxColumns(),
          sh.getLastRow(),
          sh.getLastColumn(),
          ""
        ]);
      }
    } catch (err){
      rows.push([
        capturedAtJst,
        sid,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "openById failed: " + (err && err.message ? err.message : String(err))
      ]);
    }
  }

  if (rows.length > 0){
    out.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  }

  // 見やすさ：フィルタ＆固定
  try{
    out.setFrozenRows(1);
    const rng = out.getRange(1, 1, Math.max(1, out.getLastRow()), out.getLastColumn());
    if (!out.getFilter()) rng.createFilter();
  } catch (e){
    // ここで落ちるのは本質じゃないので握りつぶす
  }

  return { ok:true, sheet: outSheetName, count: rows.length, capturedAtJst: capturedAtJst };
}

// =====================
// 内部ユーティリティ（末尾アンダースコア無し）
// =====================

function getSheetOrCreate(name){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  return sh;
}

function ensureHeader(sheet, headers){
  const lastCol = Math.max(sheet.getLastColumn(), headers.length);
  const current = (lastCol > 0)
    ? sheet.getRange(1, 1, 1, lastCol).getValues()[0]
    : [];

  const norm = (v) => String(v || "").trim();
  let same = true;
  for (let i = 0; i < headers.length; i++){
    if (norm(current[i]) !== norm(headers[i])) { same = false; break; }
  }

  if (!same){
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    // 既に一致してても、足りない列があれば埋める
    if (sheet.getLastColumn() < headers.length){
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
  }
}

function clearBody(sheet){
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return;
  sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
}

function formatJst(d){
  return Utilities.formatDate(d, "Asia/Tokyo", "yyyy/MM/dd HH:mm:ss");
}

function testCollector_v2() {
  var result = mr_collectAllActivities_('p21', '202601');
  Logger.log(JSON.stringify(result.summary, null, 2));
}

/** テスト用ラッパー（手動実行ボタンから叩く） */
function TEST_reward_extractEvents() {
  // ★ここを実在のPJID・ymに書き換えてから実行
  var result = reward_extractEvents({
    projectId: "p21",
    ym: "202601"
  });
  Logger.log(JSON.stringify(result, null, 2));
}