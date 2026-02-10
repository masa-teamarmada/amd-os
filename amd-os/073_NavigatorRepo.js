/** 073_NavigatorRepo.gs
 * Navigator のデータアクセス層（MVPはスタブ）。
 * 後で DB_* シートに繋ぐときも、Api側の関数名を固定したまま置換できるようにする。
 */

function normalizeYm(v){
  if (v === null || v === undefined) return "";

  // Date
  if (v instanceof Date){
    if (isNaN(v.getTime())) return "";
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, "0");
    return `${y}${m}`;
  }

  // number
  if (typeof v === "number"){
    // ★まず「yyyymm の数値」を優先で拾う（202601 みたいなやつ）
    // 190001〜299912 くらいを妥当レンジにしておく
    const n = Math.floor(v);
    if (n >= 190001 && n <= 299912){
      const s = String(n);
      const mm = Number(s.slice(4,6));
      if (mm >= 1 && mm <= 12) return s; // yyyymm確定
    }

    // ★それ以外は Spreadsheet の日付シリアル扱い（必要なら）
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    if (!isNaN(d.getTime())){
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      return `${y}${m}`;
    }

    return "";
  }

  const s = String(v).trim();

  // yyyymm
  let m = s.match(/^(\d{6})$/);
  if (m) return m[1];

  // yyyy-mm / yyyy/mm
  m = s.match(/^(\d{4})[-\/](\d{1,2})$/);
  if (m) return `${m[1]}${String(m[2]).padStart(2,"0")}`;

  // yyyy-mm-dd
  m = s.match(/^(\d{4})[-\/](\d{1,2})[-\/]\d{1,2}$/);
  if (m) return `${m[1]}${String(m[2]).padStart(2,"0")}`;

  return "";
}

function nav_repo_getProjectLite_(projectId){
  projectId = String(projectId || "").trim();

  const sh = getSheet_("DB_Projects");
  ensureHeader_(sh, ["projectId","projectName","clientName","status"]);

  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  const values = (lastRow >= 2 && lastCol >= 1)
    ? sh.getRange(1, 1, lastRow, lastCol).getValues()
    : [];

  if (!values.length) {
    return { projectId: projectId, projectName:"", clientName:"", status:"" };
  }

  const header = values[0].map(x => String(x||"").trim());
  const idx = (name) => header.indexOf(name);

  const iProjectId = idx("projectId");
  const iProjectName = idx("projectName");
  const iClientName = idx("clientName");
  const iStatus = idx("status");

  for (let r = 1; r < values.length; r++){
    const row = values[r];
    const pid = String(row[iProjectId] || "").trim();
    if (pid === projectId){
      return {
        projectId: pid,
        projectName: String(row[iProjectName] || "").trim(),
        clientName: String(row[iClientName] || "").trim(),
        status: String(row[iStatus] || "").trim()
      };
    }
  }

  return { projectId: projectId, projectName:"", clientName:"", status:"" };
}

function nav_repo_getMonthlyExtract_(projectId, ym){
  projectId = String(projectId || "").trim();
  const ymKey = normalizeYm(ym);

  const emptyObj = {
    status:"none",
    updatedAt:"",
    summary:"",
    decided:"",
    openQuestions:"",
    gapToPlan:"",
    risks:"",
    nextMeetingAdvice:"",
    summaryOriginal:"",
    decidedOriginal:"",
    openQuestionsOriginal:"",
    gapToPlanOriginal:"",
    risksOriginal:"",
    nextMeetingAdviceOriginal:"",
    overrideEditedAt:"",
    overrideEditedBy:"",
    items:[],
    meetings:[]
  };

  if (!projectId) return emptyObj;
  if (!ymKey) return emptyObj;

  nav_repo_initNavigatorSchema_();

  const shM = getSheet_("DB_NavigatorMonthly");
  const shI = getSheet_("DB_NavigatorMonthlyItems");

  const m = nav_repo_findMonthlyRow_(shM, projectId, ymKey);
  const items = nav_repo_listMonthlyItems_(shI, projectId, ymKey);

  function safeParse_(s){
    try{
      const t = String(s||"").trim();
      if (!t) return null;
      if (!(t.startsWith("{") && t.endsWith("}"))) return null;
      return JSON.parse(t);
    }catch(e){
      return null;
    }
  }

  function buildMeetingsFromItems_(itemsArr){
    const arr = Array.isArray(itemsArr) ? itemsArr : [];
    const out = [];
    const seen = {};

    for (let i=0; i<arr.length; i++){
      const it = arr[i] || {};
      const typ = String(it.itemType || it.type || "").trim().toLowerCase();
      if (typ !== "meeting") continue;

      const j = safeParse_(it.sourceRef);
      const title = String((j && j.title) ? j.title : (it.title || it.body || "MTG")).trim();
      const startAtJst = String((j && j.startAtJst) ? j.startAtJst : "").trim();
      const notionUrl = String((j && j.notionUrl) ? j.notionUrl : "").trim();
      const pageId = String((j && j.notionPageId) ? j.notionPageId : "").trim();
      const dateStart = String((j && j.dateStart) ? j.dateStart : "").trim();

      const key = pageId || (title + "|" + startAtJst + "|" + dateStart);
      if (seen[key]) continue;
      seen[key] = true;

      out.push({
        title: title || "MTG",
        startAtJst: startAtJst,
        notionUrl: notionUrl,
        notionPageId: pageId,
        dateStart: dateStart
      });
    }

    out.sort((a,b)=>String(a.startAtJst||a.dateStart||"").localeCompare(String(b.startAtJst||b.dateStart||"")));
    return out;
  }

  function filterMeetingsByYm_(meetingsArr, ym6){
    const arr = Array.isArray(meetingsArr) ? meetingsArr : [];
    const ymKey2 = String(ym6 || "").trim();

    function toYm6_(s){
      const v = String(s||"").trim();
      if (!v) return "";
      // "YYYY-MM-DD ..." / "YYYY-MM-DD"
      const m = v.match(/^(\d{4})-(\d{2})/);
      if (m) return String(m[1]) + String(m[2]);
      // "YYYY/MM/DD ..."
      const m2 = v.match(/^(\d{4})\/(\d{2})/);
      if (m2) return String(m2[1]) + String(m2[2]);
      // ISO
      try{
        const d = new Date(v);
        if (!isNaN(d.getTime())){
          const y = d.getFullYear();
          const mo = ("0" + (d.getMonth()+1)).slice(-2);
          return String(y) + String(mo);
        }
      }catch(e){}
      return "";
    }

    return arr.filter(x=>{
      const ds = String(x && (x.dateStart || x.startAtJst || "") || "").trim();
      const y = toYm6_(ds);
      return y && y === ymKey2;
    });
  }

  if (!m.found){
    const out0 = Object.assign({}, emptyObj);
    out0.items = items;

    let mt0 = buildMeetingsFromItems_(items);
    mt0 = filterMeetingsByYm_(mt0, ymKey);
    out0.meetings = mt0;

    return out0;
  }

  const row = m.row || {};

  function pick_(overrideKey, baseKey){
    const ov = String(row[overrideKey] !== undefined && row[overrideKey] !== null ? row[overrideKey] : "").trim();
    if (ov) return ov;
    return String(row[baseKey] !== undefined && row[baseKey] !== null ? row[baseKey] : "");
  }

  // meetingsJson（正本）
  let meetings = [];
  try{
    const mj = String(row.meetingsJson || "").trim();
    if (mj){
      const x = JSON.parse(mj);
      if (Array.isArray(x)) meetings = x;
    }
  }catch(e){
    meetings = [];
  }
  if (!meetings.length){
    meetings = buildMeetingsFromItems_(items);
  }

  // ★ここが追加：対象月だけに絞る
  meetings = filterMeetingsByYm_(meetings, ymKey);

  const out = {
    status: String(row.status || "draft"),
    updatedAt: String(row.updatedAt || ""),

    summary: pick_("overrideSummary","summary"),
    decided: pick_("overrideDecided","decided"),
    openQuestions: pick_("overrideOpenQuestions","openQuestions"),
    gapToPlan: pick_("overrideGapToPlan","gapToPlan"),
    risks: pick_("overrideRisks","risks"),
    nextMeetingAdvice: pick_("overrideNextMeetingAdvice","nextMeetingAdvice"),

    summaryOriginal: String(row.summary || ""),
    decidedOriginal: String(row.decided || ""),
    openQuestionsOriginal: String(row.openQuestions || ""),
    gapToPlanOriginal: String(row.gapToPlan || ""),
    risksOriginal: String(row.risks || ""),
    nextMeetingAdviceOriginal: String(row.nextMeetingAdvice || ""),

    overrideEditedAt: String(row.overrideEditedAt || ""),
    overrideEditedBy: String(row.overrideEditedBy || ""),

    items: items,
    meetings: meetings
  };

  return out;
}

function nav_repo_saveMonthlyOverride_(args){
  args = args || {};
  const projectId = String(args.projectId || "").trim();
  const ymKey = normalizeYm(args.ym);
  const fieldKey = String(args.fieldKey || "").trim();
  const afterText = String(args.text || "");
  const note = String(args.note || "");

  if (!projectId) return { ok:false, message:"projectId empty" };
  if (!ymKey) return { ok:false, message:"ym invalid" };
  if (!fieldKey) return { ok:false, message:"fieldKey empty" };

  const allow = {
    summary: "overrideSummary",
    gapToPlan: "overrideGapToPlan",
    decided: "overrideDecided",
    openQuestions: "overrideOpenQuestions",
    risks: "overrideRisks",
    nextMeetingAdvice: "overrideNextMeetingAdvice"
  };
  const overrideCol = allow[fieldKey];
  if (!overrideCol) return { ok:false, message:"fieldKey not allowed" };

  nav_repo_initNavigatorSchema_();

  const email = (Session.getActiveUser().getEmail() || "").trim();
  const nowIso = new Date().toISOString();

  const lock = LockService.getDocumentLock();
  lock.waitLock(20000);
  try{
    const shM = getSheet_("DB_NavigatorMonthly");

    // rowを確保（無ければ作る）
    let found = nav_repo_findMonthlyRow_(shM, projectId, ymKey);
    if (!found.found){
      const monthlyId = "MON-" + Utilities.getUuid().slice(0,8);
      nav_repo_appendRowObject_(shM, {
        monthlyId: monthlyId,
        projectId: projectId,
        ym: ymKey,
        status: "draft",

        summary: "",
        decided: "",
        openQuestions: "",
        gapToPlan: "",
        risks: "",
        nextMeetingAdvice: "",

        overrideSummary: "",
        overrideGapToPlan: "",
        overrideDecided: "",
        overrideOpenQuestions: "",
        overrideRisks: "",
        overrideNextMeetingAdvice: "",
        overrideEditedAt: "",
        overrideEditedBy: "",

        confirmedAt: "",
        confirmedBy: "",
        updatedAt: nowIso,
        updatedBy: email,
        version: 0
      });
      found = nav_repo_findMonthlyRow_(shM, projectId, ymKey);
    }

    const curRow = found.row || {};

    // before は effective 値（override優先）
    function effective_(overrideK, baseK){
      const ov = String(curRow[overrideK] !== undefined && curRow[overrideK] !== null ? curRow[overrideK] : "").trim();
      if (ov) return ov;
      return String(curRow[baseK] !== undefined && curRow[baseK] !== null ? curRow[baseK] : "");
    }

    const mapBase = {
      overrideSummary: "summary",
      overrideGapToPlan: "gapToPlan",
      overrideDecided: "decided",
      overrideOpenQuestions: "openQuestions",
      overrideRisks: "risks",
      overrideNextMeetingAdvice: "nextMeetingAdvice"
    };

    const beforeText = effective_(overrideCol, mapBase[overrideCol]);

    // ★差分ゼロなら「DB更新もログも積まない」
    if (String(beforeText || "").trim() === String(afterText || "").trim()){
      return { ok:true, skipped:true, reason:"no diff", projectId: projectId, ym: ymKey, fieldKey: fieldKey };
    }

    // monthly row 更新（overrideのみ更新、statusは維持）
    const next = Object.assign({}, curRow);
    next[overrideCol] = afterText;
    next.overrideEditedAt = nowIso;
    next.overrideEditedBy = email;
    next.updatedAt = nowIso;
    next.updatedBy = email;

    // versionは bump（監査しやすく）
    const curV = Number(next.version || 0) || 0;
    next.version = curV + 1;

    nav_repo_writeRowObjectByRowIndex_(shM, found.rowIndex, next);

    // ★edits log append（列ズレ根絶：必ず正規関数を使う）
    try{
      nav_repo_appendMonthlyEditLogForFeedback_({
        projectId: projectId,
        ym: ymKey,
        fieldKey: fieldKey,
        beforeText: beforeText,
        afterText: afterText,
        note: note
      });
    }catch(e){
      // ログは落ちても月次保存を成立させる（学習ログはオマケ）
    }

    return { ok:true, projectId: projectId, ym: ymKey, fieldKey: fieldKey };
  } finally {
    lock.releaseLock();
  }
}

function nav_repo_listRecentMonthlyEditsForFeedback_(projectId, limit){
  projectId = String(projectId || "").trim();
  const lim = (limit !== undefined && limit !== null) ? Number(limit||0) : 30;
  if (!projectId) return [];

  nav_repo_initNavigatorSchema_();

  const sh = getSheetOrCreate_("DB_NavigatorMonthlyEdits");
  const rows = nav_repo_readAllRows_(sh);

  const out = [];
  for (let i = rows.length - 1; i >= 0; i--){
    const r = rows[i];
    if (String(r.projectId||"").trim() !== projectId) continue;

    const fk = String(r.fieldKey||"").trim();
    const beforeText = String(r.beforeText||"");
    const afterText = String(r.afterText||"");
    if (!fk) continue;
    if (!afterText.trim()) continue;

    out.push({
      fieldKey: fk,
      beforeText: beforeText,
      afterText: afterText,
      note: String(r.note||""),
      editedAt: String(r.editedAt||"")
    });

    if (lim > 0 && out.length >= lim) break;
  }

  return out;
}

function nav_repo_appendMonthlyEditLogForFeedback_(payload){
  payload = payload || {};
  const projectId = String(payload.projectId || "").trim();
  const ym = String(payload.ym || "").trim(); // yyyymm
  const fieldKey = String(payload.fieldKey || "").trim();
  const beforeText = String(payload.beforeText || "");
  const afterText = String(payload.afterText || "");
  const note = String(payload.note || "").trim();

  if (!projectId) throw new Error("projectId empty");
  if (!/^\d{6}$/.test(ym)) throw new Error("ym invalid (yyyymm)");
  if (!fieldKey) throw new Error("fieldKey empty");
  if (!afterText.trim()) throw new Error("afterText empty");

  // ★差分ゼロはログにしない
  if (beforeText.trim() === afterText.trim()){
    return { ok:true, skipped:true, reason:"no diff" };
  }

  nav_repo_initNavigatorSchema_();

  const sh = getSheetOrCreate_("DB_NavigatorMonthlyEdits");

  // ★正本ヘッダ（順序も固定）
  ensureHeader_(sh, [
    "editId",
    "projectId",
    "ym",
    "fieldKey",
    "beforeText",
    "afterText",
    "note",
    "editedAt",     // ISO
    "editedBy",
    "editedAtJst"   // JST表示用
  ]);

  const headVals = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(x=>String(x||"").trim());
  const idx = (name)=>headVals.indexOf(name);

  const email = String(Session.getActiveUser().getEmail() || "").trim();
  const now = new Date();
  const nowIso = now.toISOString();
  const nowJst = Utilities.formatDate(now, "Asia/Tokyo", "yyyy-MM-dd HH:mm:ss");

  const editId = "ME-" + Utilities.getUuid().slice(0, 8);

  const row = new Array(headVals.length).fill("");

  function set(name, val){
    const i = idx(name);
    if (i >= 0) row[i] = val;
  }

  set("editId", editId);
  set("projectId", projectId);
  set("ym", ym);
  set("fieldKey", fieldKey);
  set("beforeText", beforeText);
  set("afterText", afterText);
  set("note", note);
  set("editedAt", nowIso);
  set("editedBy", email);
  set("editedAtJst", nowJst);

  sh.appendRow(row);
  return { ok:true, editId:editId };
}

function nav_repo_makeMonthlyExtractDraft_(projectId, ym){
  projectId = String(projectId || "").trim();
  const ymKey = normalizeYm(ym);
  if (!projectId) return { ok:false, message:"projectId empty" };
  if (!ymKey) return { ok:false, message:"ym invalid" };

  nav_repo_initNavigatorSchema_();

  const props = PropertiesService.getScriptProperties();
  const notionToken = String(props.getProperty("NOTION_TOKEN") || "").trim();
  const notionDbRaw = String(props.getProperty("NOTION_DATABASE_ID") || "").trim();

  if (!notionToken) return { ok:false, message:"NOTION_TOKEN missing" };
  if (!notionDbRaw) return { ok:false, message:"NOTION_DATABASE_ID missing" };

  const email = (Session.getActiveUser().getEmail() || "").trim();
  const nowIso = new Date().toISOString();

  // 1) Notion議事録DBから対象月ページ取得
  const pages = nav_repo_notion_queryMinutesByYmFull_(notionToken, notionDbRaw, ymKey);

  // 2) PJに属するページを抽出：minutesText + meetingItems
  const pack = nav_repo_notion_collectMinutesTextForProject_(notionToken, pages, projectId) || {};
  const minutesText = String(pack.minutesText || "").trim();
  const meetingItemsRaw = Array.isArray(pack.meetingItems) ? pack.meetingItems : [];
  const minutesLen = minutesText.length;

  // ★meetingItemsは「確定根拠あり」のみ入れる（collect側でも絞ってる想定だが保険）
  const meetingItems = meetingItemsRaw.filter(x => {
    const t = String(x && x.itemType ? x.itemType : "").trim().toLowerCase();
    const st = String(x && x.sourceType ? x.sourceType : "").trim().toLowerCase();
    return (t === "meeting" && st === "notion");
  });

  // 3) items抽出（既存維持）
  let extractedItems = [];
  if (minutesLen >= 20){
    extractedItems = nav_repo_llm_extractMonthlyItems_(minutesText, {
      projectId: projectId,
      ym: ymKey,
      groupName: "navigator_extract"
    });
  }
  if (!Array.isArray(extractedItems)) extractedItems = [];

  // ★会議ログ + 抽出items を結合（会議ログが先）
  let items = meetingItems.concat(extractedItems);

  // ★それでも空ならfallback
  if (!items.length){
    items = [{
      itemType: "note",
      body: `（LLM抽出: ${ymKey} 該当テキストなし or 抽出0件）`,
      sourceType: "manual",
      sourceRef: ""
    }];
  }

  // 4) ★今月の予定（正本） + 前月確定サマリ（あれば）
  const nextActions = nav_repo_getTextBlock_(projectId, "nextActions");
  const planText = String(nextActions && nextActions.text ? nextActions.text : "").trim();

  const prev = nav_repo_getPrevMonth_(projectId, ymKey);
  const prevConfirmedSummary = String(prev && prev.summary ? prev.summary : "").trim();

  // 4.5) ★Human Fixes（運用学習）
  let pastCorrectionsText = "";
  try{
    if (typeof nav_repo_listRecentMonthlyEditsForFeedback_ === "function" && projectId){
      const edits = nav_repo_listRecentMonthlyEditsForFeedback_(projectId, 12);
      if (edits && edits.length){
        pastCorrectionsText = edits.map((x, i)=>{
          const fk = String(x.fieldKey||"");
          const afterText = String(x.afterText||"").trim();
          const note = String(x.note||"").trim();
          const cut = afterText.length > 220 ? (afterText.slice(0,220) + "…") : afterText;
          return [
            `#${i+1} field:${fk}`,
            note ? `note:${note}` : "",
            `preferred:${cut}`
          ].filter(s=>s).join(" | ");
        }).join("\n");
      }
    }
  }catch(e){
    pastCorrectionsText = "";
  }

  // 5) ★月次サマリ生成（LLM）
  let monthlyPack = null;
  try{
    if (typeof _openai_extractNavigatorMonthlySummary_ === "function" && minutesLen >= 20){
      monthlyPack = _openai_extractNavigatorMonthlySummary_({
        minutesText: minutesText,
        planText: planText,
        prevConfirmedSummary: prevConfirmedSummary,
        pastCorrectionsText: pastCorrectionsText
      }, {
        groupName: "navigator_monthly_summary",
        projectId: projectId,
        ym: ymKey
      });
    }
  } catch(e){
    monthlyPack = null;
  }

  const summaryText = monthlyPack && monthlyPack.monthlySummary ? String(monthlyPack.monthlySummary) : "";
  const gapText = monthlyPack && monthlyPack.gapToPlan ? monthlyPack.gapToPlan.join("\n") : "";
  const decisionsText = monthlyPack && monthlyPack.nextMeetingDecisions ? monthlyPack.nextMeetingDecisions.join("\n") : "";
  const openQText = monthlyPack && monthlyPack.openQuestions ? monthlyPack.openQuestions.join("\n") : "";
  const risksText = monthlyPack && monthlyPack.risks ? monthlyPack.risks.join("\n") : "";
  const adviceText = monthlyPack && monthlyPack.nextMeetingAdvice ? monthlyPack.nextMeetingAdvice.join("\n") : "";

  // ★meetingsJson（表示の正本・高速化・0件に戻らない）
  const meetingsJson = JSON.stringify(meetingItems);

  // 6) Monthly を draft として upsert（version++）
  nav_repo_upsertMonthlyDraft_({
    projectId: projectId,
    ym: ymKey,
    patch: {
      status: "draft",
      updatedAt: nowIso,
      updatedBy: email,
      summary: summaryText,
      decided: decisionsText,
      openQuestions: openQText,
      gapToPlan: gapText,
      risks: risksText,
      nextMeetingAdvice: adviceText,

      // ★追加
      meetingsJson: meetingsJson
    },
    ensureVersionBump: true
  });

  // 7) items を置き換え保存（meetingItemsも含む）
  nav_repo_replaceMonthlyItems_({
    projectId: projectId,
    ym: ymKey,
    items: items,
    updatedAt: nowIso,
    updatedBy: email
  });

  // 8) 返却（UI互換）
  return {
    ok:true,
    ym: ymKey,
    status: "draft",
    updatedAt: nowIso,
    summary: summaryText,
    decided: decisionsText,
    openQuestions: openQText,
    gapToPlan: gapText,
    risks: risksText,
    nextMeetingAdvice: adviceText,
    items: nav_repo_listMonthlyItems_(getSheet_("DB_NavigatorMonthlyItems"), projectId, ymKey)
  };
}

function nav_repo_listIssues_(projectId){
  projectId = String(projectId || "").trim();
  if (!projectId) return [];

  nav_repo_initNavigatorSchema_();

  const sh = getSheet_("DB_NavigatorIssues");
  const rows = nav_repo_readAllRows_(sh);
  const out = [];

  for (let i = 0; i < rows.length; i++){
    const r = rows[i];
    if (String(r.projectId || "").trim() !== projectId) continue;
    if (String(r.isDeleted || "").trim() === "true") continue;

    let links = [];
    try{
      links = JSON.parse(String(r.relatedLinksJson || "[]") || "[]");
      if (!Array.isArray(links)) links = [];
    } catch(e){ links = []; }

    out.push({
      issueId: String(r.issueId || "").trim(),
      title: String(r.title || "").trim(),
      detail: String(r.detail || ""),
      status: String(r.status || "open").trim(),
      owner: String(r.owner || "").trim(),
      dueYm: String(r.dueYm || "").trim(),
      relatedLinks: links,
      createdYm: String(r.createdYm || "").trim(),
      lastTouchedYm: String(r.lastTouchedYm || "").trim(),
      sourceMonthlyItemId: String(r.sourceMonthlyItemId || "").trim(),
      updatedAt: String(r.updatedAt || "").trim()
    });
  }

  out.sort((a,b) => (b.updatedAt||"").localeCompare(a.updatedAt||""));
  return out;
}

function nav_repo_listHistoryBlocks_(projectId){
  projectId = String(projectId || "").trim();
  if (!projectId) return [];

  nav_repo_initNavigatorSchema_();

  const sh = getSheet_("DB_NavigatorHistory");
  const rows = nav_repo_readAllRows_(sh);
  const out = [];

  for (let i = 0; i < rows.length; i++){
    const r = rows[i];
    if (String(r.projectId || "").trim() !== projectId) continue;

    out.push({
      blockId: String(r.historyId || "").trim(),
      ym: String(r.occurredYm || "").trim(),
      summary: String(r.summary || "").trim(),
      updatedAt: String(r.createdAt || "").trim(),
      hasDetail: !!String(r.detailStub || r.detailSourceType || r.detailSourceRef || "").trim(),
      type: String(r.historyType || "").trim()
    });
  }

  out.sort((a,b) => (b.ym||"").localeCompare(a.ym||"") || (b.updatedAt||"").localeCompare(a.updatedAt||""));
  return out;
}

function nav_repo_getHistoryDetail_(projectId, blockId){
  projectId = String(projectId || "").trim();
  blockId = String(blockId || "").trim();
  if (!projectId) return { detail:"", links:[] };
  if (!blockId) return { detail:"", links:[] };

  nav_repo_initNavigatorSchema_();

  const sh = getSheet_("DB_NavigatorHistory");
  const rows = nav_repo_readAllRows_(sh);

  for (let i = 0; i < rows.length; i++){
    const r = rows[i];
    if (String(r.projectId||"").trim() !== projectId) continue;
    if (String(r.historyId||"").trim() !== blockId) continue;

    // MVP: detailStubだけ返す（将来 detailSourceType/ref で実体取得）
    const detail = String(r.detailStub || "");
    return { detail: detail, links: [] };
  }

  return { detail:"", links:[] };
}

function nav_repo_getPrevMonth_(projectId, ym){
  projectId = String(projectId || "").trim();
  const ymKey = normalizeYm(ym);
  if (!projectId || !ymKey) return { ym:"", summary:"" };

  nav_repo_initNavigatorSchema_();

  const sh = getSheet_("DB_NavigatorMonthly");
  const rows = nav_repo_readAllRows_(sh);

  let bestYm = "";
  for (let i = 0; i < rows.length; i++){
    const r = rows[i];
    if (String(r.projectId||"").trim() !== projectId) continue;
    if (String(r.status||"").trim() !== "confirmed") continue;

    const rYm = normalizeYm(r.ym);
    if (!rYm) continue;
    if (rYm >= ymKey) continue;
    if (!bestYm || rYm > bestYm) bestYm = rYm;
  }

  if (!bestYm) return { ym:"", summary:"" };

  const prev = nav_repo_findMonthlyRow_(sh, projectId, bestYm);
  return {
    ym: bestYm,
    summary: prev.found ? String(prev.row.summary || "") : ""
  };
}

function nav_repo_getTextBlock_(projectId, blockKey){
  projectId = String(projectId || "").trim();
  blockKey = String(blockKey || "").trim();
  if (!projectId || !blockKey) return { text:"" };

  nav_repo_initNavigatorSchema_();

  const sh = getSheet_("DB_NavigatorTextBlocks");
  const rows = nav_repo_readAllRows_(sh);

  for (let i = 0; i < rows.length; i++){
    const r = rows[i];
    if (String(r.projectId||"").trim() !== projectId) continue;
    if (String(r.blockKey||"").trim() !== blockKey) continue;
    return { text: String(r.text || "") };
  }
  return { text:"" };
}

function nav_repo_initNavigatorSchema_(){
  // Navigator系DBのヘッダを揃える（なければ作る）
  // ★Navigatorは別スプシへ逃がすので、シートは必ず create 可能にしておく

  const shMonthly = getSheetOrCreate_("DB_NavigatorMonthly");
  ensureHeader_(shMonthly, [
    "monthlyId","projectId","ym","status",
    "summary","decided","openQuestions","gapToPlan","risks","nextMeetingAdvice",
    "meetingsJson",
    "overrideSummary","overrideGapToPlan","overrideDecided","overrideOpenQuestions","overrideRisks","overrideNextMeetingAdvice",
    "overrideEditedAt","overrideEditedBy",
    "confirmedAt","confirmedBy",
    "updatedAt","updatedBy","version"
  ]);

  const shItems = getSheetOrCreate_("DB_NavigatorMonthlyItems");
  ensureHeader_(shItems, [
    "itemId","projectId","ym",
    "itemType","body",
    "sourceType","sourceRef",
    "createdAt","createdBy","updatedAt","updatedBy",
    "isDeleted"
  ]);

  const shIssues = getSheetOrCreate_("DB_NavigatorIssues");
  ensureHeader_(shIssues, [
    "issueId","projectId",
    "title","detail",
    "status",
    "owner","dueYm","relatedLinksJson",
    "createdYm","lastTouchedYm",
    "createdAt","createdBy","updatedAt","updatedBy",
    "closedAt","closedBy",
    "sourceMonthlyItemId",
    "isDeleted"
  ]);

  const shHist = getSheetOrCreate_("DB_NavigatorHistory");
  ensureHeader_(shHist, [
    "historyId","projectId","occurredYm",
    "historyType",
    "summary","detailStub",
    "detailSourceType","detailSourceRef",
    "createdAt","createdBy"
  ]);

  const shText = getSheetOrCreate_("DB_NavigatorTextBlocks");
  ensureHeader_(shText, [
    "blockId","projectId","blockKey","text","updatedAt","updatedBy"
  ]);

  const shEd = getSheetOrCreate_("DB_NavigatorMonthlyEdits");
  ensureHeader_(shEd, [
    "editId",
    "projectId",
    "ym",
    "fieldKey",
    "beforeText",
    "afterText",
    "note",
    "editedAt",     // ISO
    "editedBy",
    "editedAtJst"   // JST表示用
  ]);

  // ★TODO（bucketYmは使わない。必要なら dueDate/createdAt から派生させる）
  const shTodos = getSheetOrCreate_("DB_NavigatorMonthlyTodos");
  ensureHeader_(shTodos, [
    "todoId",
    "projectId",
    "body",
    "owner",
    "dueDate",    // yyyy-mm-dd（文字列で保持）
    "isDone",
    "sortNo",
    "isProposed",
    "createdAt","createdBy",
    "updatedAt","updatedBy",
    "isDeleted"
  ]);

  return { ok:true };
}

function nav_repo_upsertMonthlyDraft_(args){
  args = args || {};
  const projectId = String(args.projectId || "").trim();
  const ymKey = normalizeYm(args.ym);
  const patch = args.patch || {};
  const ensureVersionBump = !!args.ensureVersionBump;

  if (!projectId) return { ok:false, message:"projectId empty" };
  if (!ymKey) return { ok:false, message:"ym invalid" };

  nav_repo_initNavigatorSchema_();

  const lock = LockService.getDocumentLock();
  lock.waitLock(20000);
  try {
    const sh = getSheet_("DB_NavigatorMonthly");
    const found = nav_repo_findMonthlyRow_(sh, projectId, ymKey);

    const nowIso = String(patch.updatedAt || new Date().toISOString());
    const by = String(patch.updatedBy || (Session.getActiveUser().getEmail()||""));

    if (!found.found){
      const monthlyId = "MON-" + Utilities.getUuid().slice(0,8);
      const row = {
        monthlyId: monthlyId,
        projectId: projectId,
        ym: ymKey,
        status: String(patch.status || "draft"),
        summary: String(patch.summary || ""),
        decided: String(patch.decided || ""),
        openQuestions: String(patch.openQuestions || ""),
        gapToPlan: String(patch.gapToPlan || ""),
        risks: String(patch.risks || ""),
        nextMeetingAdvice: String(patch.nextMeetingAdvice || ""),
        confirmedAt: "",
        confirmedBy: "",
        updatedAt: nowIso,
        updatedBy: by,
        version: ensureVersionBump ? 1 : 0
      };
      nav_repo_appendRowObject_(sh, row);
      return { ok:true, monthlyId:monthlyId };
    }

    const curV = Number(found.row.version || 0) || 0;
    const nextV = ensureVersionBump ? (curV + 1) : curV;

    const next = Object.assign({}, found.row, {
      status: (patch.status !== undefined) ? String(patch.status||"") : found.row.status,
      summary: (patch.summary !== undefined) ? String(patch.summary||"") : found.row.summary,
      decided: (patch.decided !== undefined) ? String(patch.decided||"") : found.row.decided,
      openQuestions: (patch.openQuestions !== undefined) ? String(patch.openQuestions||"") : found.row.openQuestions,
      gapToPlan: (patch.gapToPlan !== undefined) ? String(patch.gapToPlan||"") : (found.row.gapToPlan||""),
      risks: (patch.risks !== undefined) ? String(patch.risks||"") : (found.row.risks||""),
      nextMeetingAdvice: (patch.nextMeetingAdvice !== undefined) ? String(patch.nextMeetingAdvice||"") : (found.row.nextMeetingAdvice||""),
      updatedAt: nowIso,
      updatedBy: by,
      version: nextV
    });

    nav_repo_writeRowObjectByRowIndex_(sh, found.rowIndex, next);
    return { ok:true, monthlyId:String(next.monthlyId||"") };
  } finally {
    lock.releaseLock();
  }
}

function nav_repo_replaceMonthlyItems_(args){
  args = args || {};
  const projectId = String(args.projectId || "").trim();
  const ymKey = normalizeYm(args.ym);
  const items = Array.isArray(args.items) ? args.items : [];
  const updatedAt = String(args.updatedAt || new Date().toISOString());
  const updatedBy = String(args.updatedBy || (Session.getActiveUser().getEmail()||""));

  if (!projectId) return { ok:false, message:"projectId empty" };
  if (!ymKey) return { ok:false, message:"ym invalid (expected yyyymm or yyyy-mm)" };

  nav_repo_initNavigatorSchema_();

  const lock = LockService.getDocumentLock();
  lock.waitLock(20000);
  try {
    const sh = getSheet_("DB_NavigatorMonthlyItems");

    // 既存を isDeleted=true にして論理削除
    nav_repo_softDeleteMonthlyItems_(sh, projectId, ymKey, updatedAt, updatedBy);

    for (let i = 0; i < items.length; i++){
      const it = items[i] || {};
      const itemId = "MI-" + Utilities.getUuid().slice(0,8);

      nav_repo_appendRowObject_(sh, {
        itemId: itemId,
        projectId: projectId,
        ym: ymKey, // ★ここがポイント
        itemType: String(it.itemType || it.type || "").trim(),
        body: String(it.body || it.summary || it.title || ""),
        sourceType: String(it.sourceType || "manual"),
        sourceRef: String(it.sourceRef || ""),
        createdAt: updatedAt,
        createdBy: updatedBy,
        updatedAt: updatedAt,
        updatedBy: updatedBy,
        isDeleted: "false"
      });
    }
    return { ok:true };
  } finally {
    lock.releaseLock();
  }
}

function nav_repo_confirmMonthly_(projectId, ym){
  projectId = String(projectId || "").trim();
  const ymKey = normalizeYm(ym);
  if (!projectId) return { ok:false, message:"projectId empty" };
  if (!ymKey) return { ok:false, message:"ym invalid" };

  nav_repo_initNavigatorSchema_();

  const email = (Session.getActiveUser().getEmail() || "").trim();
  const nowIso = new Date().toISOString();

  const lock = LockService.getDocumentLock();
  lock.waitLock(20000);
  try {
    const shM = getSheet_("DB_NavigatorMonthly");
    const found = nav_repo_findMonthlyRow_(shM, projectId, ymKey);
    if (!found.found){
      return { ok:false, message:"monthly not found (run/save draft first)" };
    }

    const next = Object.assign({}, found.row, {
      status: "confirmed",
      confirmedAt: nowIso,
      confirmedBy: email,
      updatedAt: nowIso,
      updatedBy: email
    });
    nav_repo_writeRowObjectByRowIndex_(shM, found.rowIndex, next);

    const shH = getSheet_("DB_NavigatorHistory");
    const histRows = nav_repo_readAllRows_(shH);

    let already = false;
    for (let i = 0; i < histRows.length; i++){
      const r = histRows[i];
      if (String(r.projectId||"").trim() !== projectId) continue;
      if (normalizeYm(r.occurredYm) !== ymKey) continue;
      if (String(r.historyType||"").trim() !== "monthlyConfirmed") continue;
      already = true;
      break;
    }

    if (!already){
      const summary = String(next.summary || "").trim();
      const decided = String(next.decided || "").trim();
      const openQ = String(next.openQuestions || "").trim();

      const histSummaryParts = [];
      if (summary) histSummaryParts.push("要約: " + summary);
      if (decided) histSummaryParts.push("確定: " + decided);
      if (openQ) histSummaryParts.push("未解決: " + openQ);

      nav_repo_appendRowObject_(shH, {
        historyId: "HIS-" + Utilities.getUuid().slice(0,8),
        projectId: projectId,
        occurredYm: ymKey,
        historyType: "monthlyConfirmed",
        summary: histSummaryParts.join("\n"),
        detailStub: "",
        detailSourceType: "",
        detailSourceRef: "",
        createdAt: nowIso,
        createdBy: email
      });
    }

    return { ok:true, projectId:projectId, ym:ymKey };
  } finally {
    lock.releaseLock();
  }
}

function nav_repo_upsertIssue_(projectId, issue){
  projectId = String(projectId || "").trim();
  issue = issue || {};
  if (!projectId) return { ok:false, message:"projectId empty" };

  nav_repo_initNavigatorSchema_();

  const title = String(issue.title || "").trim();
  if (!title) return { ok:false, message:"title empty" };

  const email = (Session.getActiveUser().getEmail() || "").trim();
  const nowIso = new Date().toISOString();

  // linksは配列で持つ（UI互換）
  const linksArr = Array.isArray(issue.relatedLinks)
    ? issue.relatedLinks.map(x=>String(x||"").trim()).filter(x=>x)
    : (String(issue.relatedLinks||"").split(",").map(x=>x.trim()).filter(x=>x));

  const lock = LockService.getDocumentLock();
  lock.waitLock(20000);
  try {
    const sh = getSheet_("DB_NavigatorIssues");
    const rows = nav_repo_readAllRowsWithIndex_(sh);
    const issueId = String(issue.issueId || "").trim() || ("ISS-" + Utilities.getUuid().slice(0,8));

    for (let i = 0; i < rows.length; i++){
      const r = rows[i].rowObj;
      if (String(r.projectId||"").trim() !== projectId) continue;
      if (String(r.issueId||"").trim() !== issueId) continue;

      const next = Object.assign({}, r, {
        title: title,
        detail: (issue.detail !== undefined) ? String(issue.detail || "") : String(r.detail || ""),
        status: String(issue.status || r.status || "open"),
        owner: (issue.owner !== undefined) ? String(issue.owner || "") : String(r.owner || ""),
        dueYm: (issue.dueYm !== undefined) ? String(issue.dueYm || "") : String(r.dueYm || ""),
        relatedLinksJson: JSON.stringify(linksArr),

        lastTouchedYm: String(issue.lastTouchedYm || r.lastTouchedYm || issue.createdYm || ""),
        sourceMonthlyItemId: String(issue.sourceMonthlyItemId || r.sourceMonthlyItemId || ""),
        updatedAt: nowIso,
        updatedBy: email,
        isDeleted: "false"
      });

      if (next.status === "closed" || next.status === "decided"){
        if (!String(next.closedAt||"").trim()) next.closedAt = nowIso;
        if (!String(next.closedBy||"").trim()) next.closedBy = email;
      }

      nav_repo_writeRowObjectByRowIndex_(sh, rows[i].rowIndex, next);
      return { ok:true, issue: nav_repo_pickIssuePublic_(next) };
    }

    const createdYm = String(issue.createdYm || issue.lastTouchedYm || "").trim();
    const row = {
      issueId: issueId,
      projectId: projectId,
      title: title,
      detail: String(issue.detail || ""),
      status: String(issue.status || "open"),
      owner: String(issue.owner || ""),
      dueYm: String(issue.dueYm || ""),
      relatedLinksJson: JSON.stringify(linksArr),

      createdYm: createdYm,
      lastTouchedYm: String(issue.lastTouchedYm || createdYm),
      sourceMonthlyItemId: String(issue.sourceMonthlyItemId || ""),
      createdAt: nowIso,
      createdBy: email,
      updatedAt: nowIso,
      updatedBy: email,
      closedAt: "",
      closedBy: "",
      isDeleted: "false"
    };
    nav_repo_appendRowObject_(sh, row);
    return { ok:true, issue: nav_repo_pickIssuePublic_(row) };
  } finally {
    lock.releaseLock();
  }
}

function nav_repo_updateIssueStatus_(projectId, issueId, status){
  projectId = String(projectId || "").trim();
  issueId = String(issueId || "").trim();
  status = String(status || "").trim().toLowerCase();
  if (!projectId) return { ok:false, message:"projectId empty" };
  if (!issueId) return { ok:false, message:"issueId empty" };
  if (!status) return { ok:false, message:"status empty" };

  nav_repo_initNavigatorSchema_();

  const email = (Session.getActiveUser().getEmail() || "").trim();
  const nowIso = new Date().toISOString();

  const lock = LockService.getDocumentLock();
  lock.waitLock(20000);
  try {
    const sh = getSheet_("DB_NavigatorIssues");
    const rows = nav_repo_readAllRowsWithIndex_(sh);

    for (let i = 0; i < rows.length; i++){
      const r = rows[i].rowObj;
      if (String(r.projectId||"").trim() !== projectId) continue;
      if (String(r.issueId||"").trim() !== issueId) continue;
      if (String(r.isDeleted||"").trim() === "true") continue;

      const next = Object.assign({}, r, {
        status: status,
        updatedAt: nowIso,
        updatedBy: email
      });

      if (status === "closed" || status === "decided"){
        next.closedAt = nowIso;
        next.closedBy = email;
      }

      nav_repo_writeRowObjectByRowIndex_(sh, rows[i].rowIndex, next);
      return { ok:true, issueId:issueId, status:status };
    }

    return { ok:false, message:"issue not found" };
  } finally {
    lock.releaseLock();
  }
}

function nav_repo_saveTextBlock_(projectId, blockKey, text){
  projectId = String(projectId || "").trim();
  blockKey = String(blockKey || "").trim();
  text = String(text || "");

  if (!projectId) return { ok:false, message:"projectId empty" };
  if (!blockKey) return { ok:false, message:"blockKey empty" };

  nav_repo_initNavigatorSchema_();

  const email = (Session.getActiveUser().getEmail() || "").trim();
  const nowIso = new Date().toISOString();

  const lock = LockService.getDocumentLock();
  lock.waitLock(20000);
  try {
    const sh = getSheet_("DB_NavigatorTextBlocks");
    const rows = nav_repo_readAllRowsWithIndex_(sh);

    for (let i = 0; i < rows.length; i++){
      const r = rows[i].rowObj;
      if (String(r.projectId||"").trim() !== projectId) continue;
      if (String(r.blockKey||"").trim() !== blockKey) continue;

      const next = Object.assign({}, r, {
        text: text,
        updatedAt: nowIso,
        updatedBy: email
      });
      nav_repo_writeRowObjectByRowIndex_(sh, rows[i].rowIndex, next);
      return { ok:true };
    }

    nav_repo_appendRowObject_(sh, {
      blockId: "TB-" + Utilities.getUuid().slice(0,8),
      projectId: projectId,
      blockKey: blockKey,
      text: text,
      updatedAt: nowIso,
      updatedBy: email
    });
    return { ok:true };
  } finally {
    lock.releaseLock();
  }
}

function nav_repo_createIssueFromMonthlyItem_(projectId, ym, itemId){
  projectId = String(projectId || "").trim();
  itemId = String(itemId || "").trim();

  // ★ymは yyyymm 正本
  const ymKey = normalizeYm(ym);

  if (!projectId) return { ok:false, message:"projectId empty" };
  if (!ymKey) return { ok:false, message:"ym invalid" };
  if (!itemId) return { ok:false, message:"itemId empty" };

  nav_repo_initNavigatorSchema_();

  const sh = getSheet_("DB_NavigatorMonthlyItems");
  const rows = nav_repo_readAllRows_(sh);
  let src = null;

  for (let i = 0; i < rows.length; i++){
    const r = rows[i];

    if (String(r.projectId||"").trim() !== projectId) continue;

    // ★比較も normalizeYm で統一
    const rowYm = normalizeYm(r.ym);
    if (rowYm !== ymKey) continue;

    if (String(r.itemId||"").trim() !== itemId) continue;

    const del = String(
      (r.isDeleted === true) ? "true" : (r.isDeleted === false ? "false" : (r.isDeleted||""))
    ).trim().toLowerCase();
    if (del === "true") continue;

    src = r;
    break;
  }
  if (!src) return { ok:false, message:"monthly item not found" };

  // 新ヘッダ：body を正本にする（旧データも一応吸う）
  const body = String(src.body !== undefined ? src.body : (src.summary !== undefined ? src.summary : "")) || "";
  const first = body ? body.split("\n")[0].trim() : "";
  const title = first ? first.slice(0, 60) : ("Issue from " + ymKey);
  const detail = body;

  return nav_repo_upsertIssue_(projectId, {
    title: title,
    detail: detail,
    status: "open",

    // ★Issue側も yyyymm に統一（dueYm 等と合わせる）
    createdYm: ymKey,
    lastTouchedYm: ymKey,

    sourceMonthlyItemId: itemId
  });
}

/** ---- helpers: Navigator Repo internal ---- */
function nav_repo_findMonthlyRow_(shMonthly, projectId, ym){
  const pid = String(projectId||"").trim();
  const ymKey = normalizeYm(ym);

  const rows = nav_repo_readAllRows_(shMonthly);
  for (let i = 0; i < rows.length; i++){
    const r = rows[i];
    if (String(r.projectId||"").trim() !== pid) continue;

    const rowYm = normalizeYm(r.ym);
    if (!ymKey || rowYm !== ymKey) continue;

    return { found:true, row:Object.assign({}, r), rowIndex:(i + 2) };
  }
  return { found:false, row:null, rowIndex:-1 };
}

function nav_repo_listMonthlyItems_(shItems, projectId, ym){
  const rows = nav_repo_readAllRows_(shItems);
  const out = [];

  const pid = String(projectId||"").trim();
  const ymKey = normalizeYm(ym); // ★yyyymm
  if (!pid || !ymKey) return out;

  for (let i = 0; i < rows.length; i++){
    const r = rows[i];

    if (String(r.projectId||"").trim() !== pid) continue;

    // ★Date/2026-01/202601 を全部 yyyymm にして比較
    const rowYm = normalizeYm(r.ym);
    if (rowYm !== ymKey) continue;

    const del = String(
      (r.isDeleted === true) ? "true" : (r.isDeleted === false ? "false" : (r.isDeleted||""))
    ).trim().toLowerCase();
    if (del === "true") continue;

    const itemType = String(r.itemType || r.type || "").trim();
    const body = String(
      (r.body !== undefined && r.body !== null) ? r.body
      : ((r.summary !== undefined && r.summary !== null) ? r.summary : "")
    );

    out.push({
      itemId: String(r.itemId||"").trim(),
      itemType: itemType,
      body: body,
      sourceType: String(r.sourceType||"").trim(),
      sourceRef: String(r.sourceRef||"").trim(),

      // UI互換
      type: itemType,
      title: body ? String(body).split("\n")[0].slice(0, 60) : "",
      summary: body,
      evidence: []
    });
  }

  return out;
}

function nav_repo_softDeleteMonthlyItems_(shItems, projectId, ym, updatedAt, updatedBy){
  const pid = String(projectId||"").trim();
  const ymKey = normalizeYm(ym);

  const rowsWithIndex = nav_repo_readAllRowsWithIndex_(shItems);
  for (let i = 0; i < rowsWithIndex.length; i++){
    const r = rowsWithIndex[i].rowObj;

    if (String(r.projectId||"").trim() !== pid) continue;

    const rowYm = normalizeYm(r.ym);
    if (!ymKey || rowYm !== ymKey) continue;

    const del = String(
      (r.isDeleted === true) ? "true" : (r.isDeleted === false ? "false" : (r.isDeleted||""))
    ).trim().toLowerCase();
    if (del === "true") continue;

    const next = Object.assign({}, r, {
      isDeleted: "true",
      updatedAt: updatedAt,
      updatedBy: updatedBy
    });
    nav_repo_writeRowObjectByRowIndex_(shItems, rowsWithIndex[i].rowIndex, next);
  }
}

function nav_repo_pickIssuePublic_(row){
  let links = [];
  try{
    links = JSON.parse(String(row.relatedLinksJson || "[]") || "[]");
    if (!Array.isArray(links)) links = [];
  } catch(e){ links = []; }

  return {
    issueId: String(row.issueId||"").trim(),
    title: String(row.title||"").trim(),
    detail: String(row.detail||""),
    status: String(row.status||"open").trim(),
    owner: String(row.owner||"").trim(),
    dueYm: String(row.dueYm||"").trim(),
    relatedLinks: links,
    createdYm: String(row.createdYm||"").trim(),
    lastTouchedYm: String(row.lastTouchedYm||"").trim(),
    sourceMonthlyItemId: String(row.sourceMonthlyItemId||"").trim(),
    updatedAt: String(row.updatedAt||"").trim()
  };
}

function nav_repo_readAllRows_(sh){
  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];

  const values = sh.getRange(1, 1, lastRow, lastCol).getValues();
  const header = values[0].map(x => String(x||"").trim());

  const out = [];
  for (let r = 1; r < values.length; r++){
    const row = values[r];
    if (row.join("").trim() === "") continue;

    const obj = {};
    for (let c = 0; c < header.length; c++){
      obj[header[c]] = row[c];
    }
    out.push(obj);
  }
  return out;
}

function nav_repo_readAllRowsWithIndex_(sh){
  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];

  const values = sh.getRange(1, 1, lastRow, lastCol).getValues();
  const header = values[0].map(x => String(x||"").trim());

  const out = [];
  for (let r = 1; r < values.length; r++){
    const row = values[r];
    if (row.join("").trim() === "") continue;

    const obj = {};
    for (let c = 0; c < header.length; c++){
      obj[header[c]] = row[c];
    }
    out.push({ rowIndex:(r+1), rowObj:obj });
  }
  return out;
}

function nav_repo_appendRowObject_(sh, obj){
  const lastCol = sh.getLastColumn();
  const header = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(x => String(x||"").trim());
  const row = header.map(h => (obj[h] !== undefined ? obj[h] : ""));
  sh.appendRow(row);
}

function nav_repo_writeRowObjectByRowIndex_(sh, rowIndex, obj){
  const lastCol = sh.getLastColumn();
  const header = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(x => String(x||"").trim());
  const row = header.map(h => (obj[h] !== undefined ? obj[h] : ""));
  sh.getRange(rowIndex, 1, 1, lastCol).setValues([row]);
}

function nav_repo_appendMonthlyItem_(args){
  args = args || {};
  const projectId = String(args.projectId || "").trim();

  // ★ymは yyyymm 正本
  const ymKey = normalizeYm(args.ym);

  const itemType = String(args.itemType || "").trim();
  const body = String(args.body || "");
  const sourceType = String(args.sourceType || "manual");
  const sourceRef = String(args.sourceRef || "");
  const createdAt = String(args.createdAt || new Date().toISOString());
  const createdBy = String(args.createdBy || (Session.getActiveUser().getEmail()||""));

  if (!projectId) return { ok:false, message:"projectId empty" };
  if (!ymKey) return { ok:false, message:"ym invalid" };
  if (!itemType) return { ok:false, message:"itemType empty" };

  nav_repo_initNavigatorSchema_();

  const lock = LockService.getDocumentLock();
  lock.waitLock(20000);
  try{
    const sh = getSheet_("DB_NavigatorMonthlyItems");
    nav_repo_appendRowObject_(sh, {
      itemId: "MI-" + Utilities.getUuid().slice(0,8),
      projectId: projectId,
      ym: ymKey, // ★yyyymmで固定
      itemType: itemType,
      body: body,
      sourceType: sourceType,
      sourceRef: sourceRef,
      createdAt: createdAt,
      createdBy: createdBy,
      updatedAt: createdAt,
      updatedBy: createdBy,
      isDeleted: "false"
    });
    return { ok:true };
  } finally {
    lock.releaseLock();
  }
}

function nav_repo_notion_queryMinutesByYmFull_(token, databaseId, ym, opts){
  const dbId = _notion_normId_(databaseId);
  if (!dbId) throw new Error("NOTION_DATABASE_ID invalid: " + String(databaseId||""));

  const ymKey = normalizeYm(ym);
  if (!ymKey) throw new Error("ym invalid: " + String(ym||""));

  const options = opts || {};
  const sinceHours = Number(options.sinceHours || 0);

  const y = Number(ymKey.slice(0,4));
  const mo = Number(ymKey.slice(4,6));
  if (!(mo >= 1 && mo <= 12)) throw new Error("ym invalid month: " + ymKey);

  function toDateStr_(d){
    const yy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth()+1).padStart(2,"0");
    const dd = String(d.getUTCDate()).padStart(2,"0");
    return `${yy}-${mm}-${dd}`;
  }

  const props = PropertiesService.getScriptProperties();
  const dateProp = String(props.getProperty("NOTION_MINUTES_DATE_PROP") || "日付").trim();
  if (!dateProp) throw new Error("NOTION_MINUTES_DATE_PROP empty");

  const url = "https://api.notion.com/v1/databases/" + dbId + "/query";

  // ===== フィルタ組み立て =====
  let filter = null;

  if (sinceHours > 0){
    const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000);
    filter = {
      timestamp: "last_edited_time",
      last_edited_time: {
        on_or_after: since.toISOString()
      }
    };
  } else {
    const start = new Date(Date.UTC(y, mo-1, 1, 0, 0, 0));
    const end   = new Date(Date.UTC(y, mo,   1, 0, 0, 0));
    filter = {
      property: dateProp,
      date: {
        on_or_after: toDateStr_(start),
        before: toDateStr_(end)
      }
    };
  }

  const base = {
    sorts: [{ timestamp:"last_edited_time", direction:"descending" }],
    filter: filter
  };

  const pages = [];
  let cursor = null;

  while (true){
    const payload = Object.assign({}, base);
    if (cursor) payload.start_cursor = cursor;

    const res = _notion_fetch_(token, url, "post", payload);
    const results = res.results || [];
    for (let i=0; i<results.length; i++){
      pages.push(results[i]);
    }

    cursor = res.next_cursor;
    if (!cursor) break;
  }

  return pages;
}

function nav_repo_notion_buildMonthlyItemsFromMinutes_(notionToken, pages, targetProjectId, ym){
  const out = [];
  const pid = String(targetProjectId||"").trim();
  const arr = Array.isArray(pages) ? pages : [];

  const MAX_LINES_PER_PAGE = 80;
  const MAX_ITEMS_TOTAL = 240;

  function pushItem_(itemType, body, pageId, blockRef){
    if (out.length >= MAX_ITEMS_TOTAL) return;
    const b = String(body||"").trim();
    if (!b) return;

    out.push({
      itemType: String(itemType || "note"),
      body: b,
      sourceType: "notion",
      // URLじゃなくキーでOK。将来ここから詳細取得する
      sourceRef: blockRef
        ? ("notion:page:" + String(pageId||"").trim() + "#"+ String(blockRef||"").trim())
        : ("notion:page:" + String(pageId||"").trim())
    });
  }

  function classifyLine_(line){
    const s = String(line||"").trim();
    if (!s) return null;

    const low = s.toLowerCase();
    if (low.includes("未解決") || low.includes("open question") || s.endsWith("?") || s.endsWith("？")) return "openQuestion";
    if (low.includes("決定") || low.includes("確定") || low.startsWith("決:") || low.startsWith("確:")) return "decided";
    if (low.startsWith("- [ ]")) return "openQuestion";
    return "note";
  }

  // ===== PJ relation -> AMD projectId への解決（A案の本命）=====
  // NotionのPJ relationは「PJ DB のページ」を指している想定。
  // そのページタイトル（例：SX, PS2など）を AMDのDB_Projects へマップする。
  function resolveProjectIdFromPjRelation_(pageObj){
    // 1) relation ids を取る（prop名は "PJ" 固定）
    const relIds = (typeof _notion_extractRelationIds_ === "function")
      ? _notion_extractRelationIds_(pageObj, "PJ")
      : [];

    if (!relIds || !relIds.length) return "";

    // 2) relation先ページのタイトル（pjCode想定）を解決
    const pjName = (typeof _notion_resolvePageTitleCached_ === "function")
      ? String(_notion_resolvePageTitleCached_(notionToken, relIds[0]) || "").trim()
      : "";

    if (!pjName) return "";

    // 3) AMD側 projectId に変換（DB_Projectsの projectCode/pjCode/projectName に当てる）
    const amdPid = (typeof _resolveAmdProjectIdByProjectNameOrCode_ === "function")
      ? String(_resolveAmdProjectIdByProjectNameOrCode_(pjName) || "").trim()
      : "";

    return amdPid;
  }

  for (let i=0; i<arr.length; i++){
    const p = arr[i];
    const pageId = String(p && p.id ? p.id : "").trim();
    if (!pageId) continue;

    // 1) 本文（内容プロパティ）を取得
    const minutesText = (typeof _notion_extractPropertyText_ === "function")
      ? _notion_extractPropertyText_(p, "内容")
      : "";
    if (!minutesText || String(minutesText).trim().length < 10) continue;

    // 2) PJスコープ判定（A案：PJ relation最優先）
    let resolvedPid = resolveProjectIdFromPjRelation_(p);

    // 3) フォールバック（保険）：PJ relationが空なら従来ロジックで推定
    if (!resolvedPid && typeof _resolveSuggestedProject_ === "function"){
      const pjResolved = _resolveSuggestedProject_(notionToken, p, String(minutesText||""));
      resolvedPid = String(pjResolved && pjResolved.projectId ? pjResolved.projectId : "").trim();
      if (resolvedPid === "EXCLUDE") continue;
      if (resolvedPid === "unknown") resolvedPid = "";
    }

    // 4) target projectId と一致するものだけ採用
    if (!resolvedPid || resolvedPid !== pid) continue;

    // 5) 行分割してitems化
    const linesRaw = String(minutesText||"")
      .split(/\r?\n/)
      .map(x=>String(x||"").trim())
      .filter(x=>x);

    const lines = linesRaw.slice(0, MAX_LINES_PER_PAGE);
    for (let k=0; k<lines.length; k++){
      const ln = lines[k];
      if (ln.length < 3) continue;

      const it = classifyLine_(ln);
      if (!it) continue;

      pushItem_(it, ln, pageId, "");
      if (out.length >= MAX_ITEMS_TOTAL) break;
    }

    if (out.length >= MAX_ITEMS_TOTAL) break;
  }

  if (!out.length){
    out.push({
      itemType: "note",
      body: `（Notion取り込み: ${ym} の該当議事録が見つからなかった / PJ relation から projectId へ解決できてない可能性）`,
      sourceType: "manual",
      sourceRef: ""
    });
  }

  return out;
}

function nav_repo_debugMonthlyItems_(projectId, ym){
  projectId = String(projectId || "").trim();

  const ymKey = normalizeYm(ym);

  nav_repo_initNavigatorSchema_();

  const sh = getSheet_("DB_NavigatorMonthlyItems");
  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();

  if (lastRow < 2 || lastCol < 1){
    return { sheetName:"DB_NavigatorMonthlyItems", lastRow, lastCol, message:"sheet empty" };
  }

  const values = sh.getRange(1, 1, lastRow, lastCol).getValues();
  const header = values[0].map(x => String(x||"").trim());

  const idx = {};
  header.forEach((h,i)=>{ if(h) idx[h]=i; });

  function g_(row, name){
    const i = idx[name];
    return (i === undefined) ? "" : row[i];
  }
  function s_(v){ return String(v===null || v===undefined ? "" : v); }
  function sl_(v){ return s_(v).trim().toLowerCase(); }

  let matched = 0;
  let alive = 0;
  const sample = [];

  for (let r=1; r<values.length; r++){
    const row = values[r];

    const pid = s_(g_(row,"projectId")).trim();
    const rowYm = normalizeYm(g_(row,"ym"));

    if (pid !== projectId) continue;
    if (!ymKey || rowYm !== ymKey) continue;
    matched++;

    const del = sl_(g_(row,"isDeleted"));
    if (del === "true") continue;
    alive++;

    if (sample.length < 5){
      sample.push({
        itemId: s_(g_(row,"itemId")).trim(),
        ymRaw: s_(g_(row,"ym")),
        ymNorm: rowYm,
        itemType: s_(g_(row,"itemType")).trim(),
        bodyHead: s_(g_(row,"body")).slice(0, 60),
        isDeleted: s_(g_(row,"isDeleted"))
      });
    }
  }

  let itemsReturned = [];
  try{
    itemsReturned = nav_repo_listMonthlyItems_(sh, projectId, ymKey) || [];
  } catch(e){
    itemsReturned = [{ __error: String(e && (e.message||e) ? (e.message||e) : e) }];
  }

  return {
    sheetName: "DB_NavigatorMonthlyItems",
    lastRow, lastCol,
    ymInput: String(ym||""),
    ymKey: ymKey,
    headerHasItemType: (idx["itemType"] !== undefined),
    headerHasBody: (idx["body"] !== undefined),
    matchedRows: matched,
    aliveRows: alive,
    sampleRows: sample,
    itemsReturnedCount: Array.isArray(itemsReturned) ? itemsReturned.length : -1,
    itemsReturnedHead: Array.isArray(itemsReturned) ? itemsReturned.slice(0, 3) : itemsReturned
  };
}

function run_debugNavigatorMonthlyItems(){
  // ここだけ手で変える（最小）
  const projectId = "p21";
  const ym = "2026-01";

  // 072側APIを経由しなくてもOK。Repo直で見る
  const dbg = nav_repo_debugMonthlyItems_(projectId, ym);

  Logger.log("[Navigator MonthlyItems debug]\n" + JSON.stringify(dbg, null, 2));
  return dbg;
}

function run_debugNavigatorMonthlyItemsDistribution(){
  nav_repo_initNavigatorSchema_();

  const sh = getSheet_("DB_NavigatorMonthlyItems");
  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();

  if (lastRow < 2 || lastCol < 1){
    const out0 = { ok:false, message:"DB_NavigatorMonthlyItems empty", lastRow, lastCol };
    Logger.log(JSON.stringify(out0, null, 2));
    return out0;
  }

  const values = sh.getRange(1, 1, lastRow, lastCol).getValues();
  const header = values[0].map(x=>String(x||"").trim());

  const idx = {};
  header.forEach((h,i)=>{ if(h) idx[h]=i; });

  function get_(row, name){
    const i = idx[name];
    return (i === undefined) ? "" : row[i];
  }
  function s_(v){ return String(v===null||v===undefined ? "" : v).trim(); }

  // 末尾のN行だけ見る（全943行なら全部でもいいけど安全に）
  const N = 1200;
  const startR = Math.max(1, values.length - N);

  const counts = {}; // key = `${projectId}|${ymKey}`
  const projCounts = {};
  const ymCounts = {};

  let alive = 0;
  let deleted = 0;

  const samples = [];

  for (let r = startR; r < values.length; r++){
    const row = values[r];

    const pid = s_(get_(row, "projectId"));
    const ymRaw = get_(row, "ym");
    const ymKey = normalizeYm(ymRaw);

    const del = s_(get_(row, "isDeleted")).toLowerCase();
    const isDel = (del === "true");

    if (isDel) deleted++;
    else alive++;

    const k = `${pid}|${ymKey || "(ym?)"}`;
    counts[k] = (counts[k] || 0) + 1;

    projCounts[pid || "(pid?)"] = (projCounts[pid || "(pid?)"] || 0) + 1;
    ymCounts[ymKey || "(ym?)"] = (ymCounts[ymKey || "(ym?)"] || 0) + 1;

    if (samples.length < 8 && !isDel){
      samples.push({
        rowNo: r+1,
        projectId: pid,
        ymRaw: String(ymRaw),
        ymKey: ymKey,
        itemType: s_(get_(row, "itemType")),
        bodyHead: s_(get_(row, "body")).slice(0, 40),
        isDeleted: s_(get_(row, "isDeleted"))
      });
    }
  }

  // 上位表示（多い順に並べる）
  function top_(obj, limit){
    const arr = Object.keys(obj).map(k=>({ k, n: obj[k] }));
    arr.sort((a,b)=>b.n-a.n);
    return arr.slice(0, limit);
  }

  const out = {
    ok:true,
    sheetName: "DB_NavigatorMonthlyItems",
    lastRow,
    lastCol,
    header,
    scannedRows: values.length - startR,
    aliveRows: alive,
    deletedRows: deleted,
    topProjects: top_(projCounts, 10),
    topYmKeys: top_(ymCounts, 12),
    topPairs: top_(counts, 15),
    sampleAliveRows: samples
  };

  Logger.log("[NavigatorMonthlyItemsDistribution]\n" + JSON.stringify(out, null, 2));
  return out;
}

function nav_repo_notion_collectMinutesTextForProject_(notionToken, pages, targetProjectId){
  const pid = String(targetProjectId||"").trim();
  const arr = Array.isArray(pages) ? pages : [];

  const chunks = [];
  const meetingItems = [];

  function resolveProjectIdFromPjRelation_(pageObj){
    const relIds = (typeof _notion_extractRelationIds_ === "function")
      ? _notion_extractRelationIds_(pageObj, "PJ")
      : [];
    if (!relIds || !relIds.length) return "";

    const pjName = (typeof _notion_resolvePageTitleCached_ === "function")
      ? String(_notion_resolvePageTitleCached_(notionToken, relIds[0]) || "").trim()
      : "";
    if (!pjName) return "";

    const amdPid = (typeof _resolveAmdProjectIdByProjectNameOrCode_ === "function")
      ? String(_resolveAmdProjectIdByProjectNameOrCode_(pjName) || "").trim()
      : "";
    return amdPid;
  }

  function extractTitleFromPage_(p){
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

  function extractDateStartFromPage_(p){
    let dateProp = "日付";
    try{
      const props = PropertiesService.getScriptProperties();
      dateProp = String(props.getProperty("NOTION_MINUTES_DATE_PROP") || "日付").trim() || "日付";
    }catch(e){}

    try{
      const pp = (p && p.properties) ? p.properties : {};
      const pr = pp && pp[dateProp] ? pp[dateProp] : null;
      if (pr && pr.type === "date" && pr.date && pr.date.start){
        return String(pr.date.start || "").trim();
      }
    }catch(e){}
    return "";
  }

  function pushMeetingItem_(p){
    const pageId = String(p && p.id ? p.id : "").trim();
    if (!pageId) return;

    const title = extractTitleFromPage_(p) || "MTG";
    const dateStart = extractDateStartFromPage_(p);
    const notionUrl = String(p && p.url ? p.url : "").trim();

    const sourceRef = JSON.stringify({
      notionPageId: pageId,
      notionUrl: notionUrl,
      title: title,
      dateStart: dateStart,
      startAtJst: dateStart ? (dateStart + " 00:00") : ""
    });

    meetingItems.push({
      itemType: "meeting",
      body: (dateStart ? (dateStart + " ") : "") + title,
      sourceType: "notion",
      sourceRef: sourceRef
    });
  }

  const seenMeeting = {};
  const seenTextPage = {};

  for (let i=0; i<arr.length; i++){
    const p = arr[i];
    const pageId = String(p && p.id ? p.id : "").trim();
    if (!pageId) continue;

    // タイトル（PJ推定の補助に使う：suggestedより堅い）
    const title = extractTitleFromPage_(p);

    // PJ判定：まず relation
    let resolvedPid = resolveProjectIdFromPjRelation_(p);
    const resolvedByRelation = !!resolvedPid;

    // relationで取れないとき、タイトルから確定（JOYCLE等）
    if (!resolvedPid && title && typeof _resolveAmdProjectIdByProjectNameOrCode_ === "function"){
      resolvedPid = String(_resolveAmdProjectIdByProjectNameOrCode_(title) || "").trim();
    }
    const resolvedByTitle = (!resolvedByRelation && !!resolvedPid);

    // まず「内容」プロパティ
    const minutesText = (typeof _notion_extractPropertyText_ === "function")
      ? _notion_extractPropertyText_(p, "内容")
      : "";
    const txtProp = String(minutesText||"").trim();

    // relation/titleで確定できないときだけ suggested（本文があるときだけ）
    if (!resolvedPid && txtProp.length >= 10 && typeof _resolveSuggestedProject_ === "function"){
      const pjResolved = _resolveSuggestedProject_(notionToken, p, txtProp);
      resolvedPid = String(pjResolved && pjResolved.projectId ? pjResolved.projectId : "").trim();
      if (resolvedPid === "EXCLUDE") continue;
      if (resolvedPid === "unknown") resolvedPid = "";
    }

    if (!resolvedPid || resolvedPid !== pid) continue;

    // ★会議ログ：suggested由来は混ざるので採用しない。relation or title確定のみ。
    if (!seenMeeting[pageId]){
      if (resolvedByRelation || resolvedByTitle){
        seenMeeting[pageId] = true;
        pushMeetingItem_(p);
      }
    }

    // ★材料テキスト：内容が薄いなら blocks 本文で補完（既存）
    let txt = txtProp;
    if (txt.length < 10){
      try{
        if (typeof nav_repo_notion_fetchPageBodyText === "function"){
          const body = nav_repo_notion_fetchPageBodyText(notionToken, pageId, { maxChars: 12000 });
          const t2 = String(body || "").trim();
          if (t2.length >= 10) txt = t2;
        }
      }catch(e){}
    }

    if (txt.length >= 10 && !seenTextPage[pageId]){
      seenTextPage[pageId] = true;
      chunks.push(txt);
    }
  }

  return {
    minutesText: chunks.join("\n\n---\n\n").trim(),
    meetingItems: meetingItems
  };
}

/**
 * Navigator Monthly Extract用：LLM抽出
 * - Protocol Storeの DB_LLMExtractorConfig を使って prompt を合成する実装を流用する
 * - groupName は "navigator_extract" を渡す
 */
function nav_repo_llm_extractMonthlyItems_(minutesText, meta){
  meta = meta || {};
  const groupName = String(meta.groupName || "navigator_extract").trim() || "navigator_extract";

  // 既存のOpenAI抽出関数（NotionProtocolSync.gs）をそのまま使う
  // groupNameだけ差し替えて使う想定
  if (typeof _openai_extractNavigatorMonthlyItems_ === "function"){
    return _openai_extractNavigatorMonthlyItems_(String(minutesText||""), {
      groupName: groupName,
      projectId: String(meta.projectId||"").trim(),
      ym: String(meta.ym||"").trim()
    });
  }

  // まだ実装されてない場合は明示的に落とす（サイレント失敗しない）
  throw new Error("_openai_extractNavigatorMonthlyItems_ missing (implement in NotionProtocolSync.gs)");
}

function nav_repo_normalizeDateStr_(v){
  if (v === null || v === undefined) return "";
  if (v instanceof Date){
    if (isNaN(v.getTime())) return "";
    const y = v.getFullYear();
    const m = String(v.getMonth()+1).padStart(2,"0");
    const d = String(v.getDate()).padStart(2,"0");
    return `${y}-${m}-${d}`;
  }
  const s = String(v).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return s;
}

function nav_repo_listTodosByProject_(projectId){
  projectId = String(projectId || "").trim();
  if (!projectId) return [];

  nav_repo_initNavigatorSchema_();

  const sh = getSheet_("DB_NavigatorMonthlyTodos");
  const rows = nav_repo_readAllRows_(sh);

  function normDate_(v){
    if (v === null || v === undefined) return "";
    if (v instanceof Date){
      if (isNaN(v.getTime())) return "";
      const y = v.getFullYear();
      const m = String(v.getMonth()+1).padStart(2,"0");
      const d = String(v.getDate()).padStart(2,"0");
      return `${y}-${m}-${d}`;
    }
    const s = String(v).trim();
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    return s;
  }

  const out = [];
  for (let i=0; i<rows.length; i++){
    const r = rows[i];
    if (String(r.projectId||"").trim() !== projectId) continue;

    const del = String(
      (r.isDeleted === true) ? "true" : (r.isDeleted === false ? "false" : (r.isDeleted||""))
    ).trim().toLowerCase();
    if (del === "true") continue;

    out.push({
      todoId: String(r.todoId||"").trim(),
      projectId: String(r.projectId||"").trim(),
      body: String(r.body||""),
      owner: String(r.owner||""),
      dueDate: normDate_(r.dueDate),
      isDone: String(r.isDone||"").trim().toLowerCase() === "true",
      sortNo: Number(r.sortNo||0) || 0,
      isProposed: String(r.isProposed||"").trim().toLowerCase() === "true",
      createdAt: String(r.createdAt||""),
      createdBy: String(r.createdBy||""),
      updatedAt: String(r.updatedAt||""),
      updatedBy: String(r.updatedBy||"")
    });
  }

  // 期限→sortNo→作成順
  out.sort((a,b)=>{
    const ad = a.dueDate || "9999-12-31";
    const bd = b.dueDate || "9999-12-31";
    const c1 = ad.localeCompare(bd);
    if (c1 !== 0) return c1;
    const c2 = (a.sortNo||0) - (b.sortNo||0);
    if (c2 !== 0) return c2;
    return String(a.createdAt||"").localeCompare(String(b.createdAt||""));
  });

  return out;
}

function nav_repo_upsertTodo_(todo){
  todo = todo || {};
  const projectId = String(todo.projectId||"").trim();
  const todoId = String(todo.todoId||"").trim();
  const body = String(todo.body||"");
  const owner = String(todo.owner||"");

  function normDate_(v){
    if (v === null || v === undefined) return "";
    if (v instanceof Date){
      if (isNaN(v.getTime())) return "";
      const y = v.getFullYear();
      const m = String(v.getMonth()+1).padStart(2,"0");
      const d = String(v.getDate()).padStart(2,"0");
      return `${y}-${m}-${d}`;
    }
    const s = String(v).trim();
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    return s;
  }

  let dueDate = normDate_(todo.dueDate);
  const isDone = !!todo.isDone;
  const sortNo = (todo.sortNo !== undefined && todo.sortNo !== null) ? Number(todo.sortNo||0) : 0;
  const isProposed = !!todo.isProposed;

  if (!projectId) return { ok:false, message:"projectId empty" };
  if (!String(body||"").trim()) return { ok:false, message:"body empty" };

  nav_repo_initNavigatorSchema_();

  const email = (Session.getActiveUser().getEmail() || "").trim();
  const nowIso = new Date().toISOString();

  const lock = LockService.getDocumentLock();
  lock.waitLock(20000);
  try{
    const sh = getSheet_("DB_NavigatorMonthlyTodos");
    const rows = nav_repo_readAllRowsWithIndex_(sh);

    const id = todoId || ("TD-" + Utilities.getUuid().slice(0,8));

    for (let i=0; i<rows.length; i++){
      const r = rows[i].rowObj;
      if (String(r.projectId||"").trim() !== projectId) continue;
      if (String(r.todoId||"").trim() !== id) continue;

      const next = Object.assign({}, r, {
        body: body,
        owner: owner,
        dueDate: dueDate,
        isDone: isDone ? "true" : "false",
        sortNo: String(sortNo),
        isProposed: isProposed ? "true" : "false",
        updatedAt: nowIso,
        updatedBy: email,
        isDeleted: "false"
      });
      nav_repo_writeRowObjectByRowIndex_(sh, rows[i].rowIndex, next);
      return { ok:true, todoId:id };
    }

    nav_repo_appendRowObject_(sh, {
      todoId: id,
      projectId: projectId,
      body: body,
      owner: owner,
      dueDate: dueDate,
      isDone: isDone ? "true" : "false",
      sortNo: String(sortNo),
      isProposed: isProposed ? "true" : "false",
      createdAt: nowIso,
      createdBy: email,
      updatedAt: nowIso,
      updatedBy: email,
      isDeleted: "false"
    });

    return { ok:true, todoId:id };
  } finally {
    lock.releaseLock();
  }
}

function nav_repo_patchTodo_(projectId, todoId, patch){
  projectId = String(projectId||"").trim();
  todoId = String(todoId||"").trim();
  patch = patch || {};

  if (!projectId) return { ok:false, message:"projectId empty" };
  if (!todoId) return { ok:false, message:"todoId empty" };

  nav_repo_initNavigatorSchema_();

  const email = (Session.getActiveUser().getEmail() || "").trim();
  const nowIso = new Date().toISOString();

  const lock = LockService.getDocumentLock();
  lock.waitLock(20000);
  try{
    const sh = getSheet_("DB_NavigatorMonthlyTodos");
    const rows = nav_repo_readAllRowsWithIndex_(sh);

    for (let i=0; i<rows.length; i++){
      const r = rows[i].rowObj;
      if (String(r.projectId||"").trim() !== projectId) continue;
      if (String(r.todoId||"").trim() !== todoId) continue;

      const next = Object.assign({}, r);

      if (patch.bucketYm !== undefined) next.bucketYm = normalizeYm(patch.bucketYm) || next.bucketYm;
      if (patch.body !== undefined) next.body = String(patch.body||"");
      if (patch.owner !== undefined) next.owner = String(patch.owner||"");
      if (patch.dueDate !== undefined) next.dueDate = String(patch.dueDate||"").trim() || next.dueDate;

      if (patch.isDone !== undefined) next.isDone = patch.isDone ? "true" : "false";
      if (patch.sortNo !== undefined) next.sortNo = String(Number(patch.sortNo||0));
      if (patch.isProposed !== undefined) next.isProposed = patch.isProposed ? "true" : "false";

      next.updatedAt = nowIso;
      next.updatedBy = email;

      nav_repo_writeRowObjectByRowIndex_(sh, rows[i].rowIndex, next);
      return { ok:true, todoId:todoId };
    }

    return { ok:false, message:"todo not found" };
  } finally {
    lock.releaseLock();
  }
}

function nav_repo_deleteTodo_(projectId, todoId){
  projectId = String(projectId||"").trim();
  todoId = String(todoId||"").trim();

  if (!projectId) return { ok:false, message:"projectId empty" };
  if (!todoId) return { ok:false, message:"todoId empty" };

  nav_repo_initNavigatorSchema_();

  const email = (Session.getActiveUser().getEmail() || "").trim();
  const nowIso = new Date().toISOString();

  const lock = LockService.getDocumentLock();
  lock.waitLock(20000);
  try{
    const sh = getSheet_("DB_NavigatorMonthlyTodos");
    const rows = nav_repo_readAllRowsWithIndex_(sh);

    for (let i=0; i<rows.length; i++){
      const r = rows[i].rowObj;
      if (String(r.projectId||"").trim() !== projectId) continue;
      if (String(r.todoId||"").trim() !== todoId) continue;

      const next = Object.assign({}, r, {
        isDeleted: "true",
        updatedAt: nowIso,
        updatedBy: email
      });
      nav_repo_writeRowObjectByRowIndex_(sh, rows[i].rowIndex, next);
      return { ok:true };
    }

    return { ok:false, message:"todo not found" };
  } finally {
    lock.releaseLock();
  }
}

function _nav_repo_monthEndDateStr_(yyyymm){
  const s = String(yyyymm||"").trim();
  if (!/^\d{6}$/.test(s)) return "";
  const y = Number(s.slice(0,4));
  const m = Number(s.slice(4,6)); // 1-12
  const d = new Date(y, m, 0); // 次月0日 = 当月末日
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${y}-${mm}-${dd}`; // dueDateは yyyy-mm-dd だけ許容（ここは例外として残す）
}

function admin_repairNavigatorMonthlyEditsSheet(){
  const sh = getSheetOrCreate_("DB_NavigatorMonthlyEdits");
  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2) return { ok:true, fixed:0 };

  const values = sh.getRange(1, 1, lastRow, lastCol).getValues();
  const head = values[0].map(x=>String(x||"").trim());

  const iEditId = head.indexOf("editId");
  const iProjectId = head.indexOf("projectId");

  if (iEditId < 0 || iProjectId < 0){
    throw new Error("DB_NavigatorMonthlyEdits header missing: editId/projectId");
  }

  let fixed = 0;

  for (let r = 1; r < values.length; r++){
    const row = values[r];

    const editId = String(row[iEditId]||"").trim();
    const projectId = String(row[iProjectId]||"").trim();

    // 典型的ズレ：editIdが空で、projectId列に pxx が入ってる（本当は1列左にずれてる）
    // ただし今回のケースは「先頭列が pxx」なので、より強く判定する
    const firstCell = String(row[0]||"").trim();

    const looksShifted = (!editId) && /^p\d+$/i.test(firstCell);
    if (!looksShifted) continue;

    // 右に1つずらす（末尾は捨てる）
    for (let c = lastCol - 1; c >= 1; c--){
      row[c] = row[c-1];
    }

    // editId を生成
    row[0] = "ME-" + Utilities.getUuid().slice(0, 8);

    values[r] = row;
    fixed++;
  }

  if (fixed > 0){
    sh.getRange(1, 1, lastRow, lastCol).setValues(values);
  }

  return { ok:true, fixed:fixed };
}


/**
 * admin_ensureNavigatorStoreSchema
 * 役割：
 * - Navigator正本スプレッドシート（別スプシ）にDBシートを作成し、ヘッダを保証する
 *
 * 重要：
 * - 月次正本 DB_NavigatorMonthly は「新スキーマ」で作る
 * - ymは yyyymm を正とする（yyyy-mmが来ても normalizeYm で吸う）
 * - 手動実行できる関数名（末尾_なし）
 */
function admin_ensureNavigatorSchema(){
  // admin check（既存があれば使う）
  try{
    if (typeof canAccessAdmin_ === "function" && !canAccessAdmin_()){
      throw new Error("access denied");
    }
  }catch(e){
    // 開発中は通す
  }

  const props = PropertiesService.getScriptProperties();

  // ★正：NAVIGATOR_SPREADSHEET_ID
  let storeId = String(props.getProperty("NAVIGATOR_SPREADSHEET_ID") || "").trim();

  // ★旧キーがあれば自動移行して救う
  if (!storeId){
    const old = String(props.getProperty("NAVIGATOR_STORE_SPREADSHEET_ID") || "").trim();
    if (old){
      storeId = old;
      props.setProperty("NAVIGATOR_SPREADSHEET_ID", storeId);
      props.deleteProperty("NAVIGATOR_STORE_SPREADSHEET_ID");
    }
  }

  if (!storeId) throw new Error("NAVIGATOR_SPREADSHEET_ID missing. set it in ScriptProperties first.");

  const ss = SpreadsheetApp.openById(storeId);

  function getOrCreateSheet_(name){
    const n = String(name||"").trim();
    if (!n) throw new Error("sheet name empty");
    let sh = ss.getSheetByName(n);
    if (!sh) sh = ss.insertSheet(n);
    return sh;
  }

  function ensure_(name, headers){
    const sh = getOrCreateSheet_(name);
    ensureHeader_(sh, headers);
    return sh;
  }

  // ===== Navigator Monthly（新スキーマ：正本）=====
  ensure_("DB_NavigatorMonthly", [
    "monthlyId",
    "projectId",
    "ym",                 // yyyymm
    "status",             // none/draft/confirmed
    "version",            // int
    "updatedAt",          // ISO（保存用）
    "updatedBy",
    "confirmedAt",
    "confirmedBy",

    "summary",
    "decided",
    "openQuestions",
    "gapToPlan",
    "risks",
    "nextMeetingAdvice",

    "meetingsJson",

    "overrideSummary",
    "overrideDecided",
    "overrideOpenQuestions",
    "overrideGapToPlan",
    "overrideRisks",
    "overrideNextMeetingAdvice",
    "overrideEditedAt",    // ISO
    "overrideEditedBy"
  ]);

  ensure_("DB_NavigatorMonthlyItems", [
    "itemId",
    "projectId",
    "ym",                 // yyyymm
    "itemType",
    "body",
    "sourceType",
    "sourceRef",
    "createdAt",
    "createdBy",
    "updatedAt",
    "updatedBy",
    "isDeleted"
  ]);

  ensure_("DB_NavigatorMonthlyEdits", [
    "editId",
    "projectId",
    "ym",                 // yyyymm
    "fieldKey",
    "beforeText",
    "afterText",
    "note",
    "editedAt",           // ISO
    "editedBy",
    "editedAtJst"         // JST表示用
  ]);

  ensure_("DB_NavigatorIssues", [
    "issueId",
    "projectId",
    "title",
    "detail",
    "status",
    "owner",
    "dueYm",
    "relatedLinksJson",
    "createdYm",
    "lastTouchedYm",
    "createdAt",
    "createdBy",
    "updatedAt",
    "updatedBy",
    "closedAt",
    "closedBy",
    "sourceMonthlyItemId",
    "isDeleted"
  ]);

  ensure_("DB_NavigatorHistory", [
    "historyId",
    "projectId",
    "occurredYm",
    "historyType",
    "summary",
    "detailStub",
    "detailSourceType",
    "detailSourceRef",
    "createdAt",
    "createdBy"
  ]);

  ensure_("DB_NavigatorTextBlocks", [
    "blockId",
    "projectId",
    "blockKey",
    "text",
    "updatedAt",
    "updatedBy"
  ]);

  ensure_("DB_NavigatorMonthlyTodos", [
    "todoId",
    "projectId",
    "body",
    "owner",
    "dueDate",            // yyyy-mm-dd
    "isDone",
    "sortNo",
    "isProposed",
    "createdAt",
    "createdBy",
    "updatedAt",
    "updatedBy",
    "isDeleted"
  ]);

  ensure_("DB_NavigatorObserveLog", [
    "projectId",
    "ym",                 // yyyymm
    "rev",
    "eventType",
    "changedFields",
    "itemsCount",
    "issuesOpenCount",
    "meaningDiff",
    "snapshotJson",
    "createdAtIso",
    "createdAtJst",
    "createdBy"
  ]);

  const out = {
    ok:true,
    spreadsheetId: ss.getId(),
    spreadsheetName: ss.getName(),
    ensuredSheets: ss.getSheets().map(s=>s.getName()).filter(n=>String(n||"").startsWith("DB_Navigator"))
  };

  try{ Logger.log("[admin_ensureNavigatorSchema] " + JSON.stringify(out)); }catch(e){}
  try{ console.log("[admin_ensureNavigatorSchema]", out); }catch(e){}

  return out;
}
