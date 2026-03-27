// R290_NotionProtocolSync.gs
// ======================================================================
// Notion -> ProtocolCandidates (External Spreadsheet)
// ======================================================================

function admin_setupProtocolCandidatesStore(){
  // admin only
  if (!canAccessAdminPage_()) return { ok:false, message:"access denied" };

  const props = PropertiesService.getScriptProperties();

  // 既に設定済みならそれを使う
  const existingId = String(props.getProperty("PROTOCOL_STORE_SPREADSHEET_ID") || "").trim();
  if (existingId){
    // 念のためシート構造だけ整える
    _pc_ensureStoreSheets_(existingId);
    return { ok:true, created:false, spreadsheetId: existingId };
  }

  // 新規作成
  const ss = SpreadsheetApp.create("AMD OS - Protocol Store");
  const id = ss.getId();
  props.setProperty("PROTOCOL_STORE_SPREADSHEET_ID", id);

  _pc_ensureStoreSheets_(id);

  return { ok:true, created:true, spreadsheetId: id };
}

function admin_setProtocolStoreSpreadsheetId(payload){
  // admin only
  if (!canAccessAdminPage_()) return { ok:false, message:"access denied" };
  payload = payload || {};
  const id = String(payload.spreadsheetId || "").trim();
  if (!id) return { ok:false, message:"spreadsheetId empty" };

  PropertiesService.getScriptProperties().setProperty("PROTOCOL_STORE_SPREADSHEET_ID", id);
  _pc_ensureStoreSheets_(id);

  return { ok:true, spreadsheetId: id };
}

function admin_syncNotionMinutesToProtocolCandidates(payload){
  if (!canAccessAdminPage_()) return { ok:false, message:"access denied" };

  payload = payload || {};
  const dryRun = !!payload.dryRun;
  const limit = (payload.limit !== undefined && payload.limit !== null) ? Number(payload.limit || 0) : 0;

  const props = PropertiesService.getScriptProperties();

  const notionToken = String(props.getProperty("NOTION_TOKEN") || "").trim();
  const notionDbRaw = String(props.getProperty("NOTION_DATABASE_ID") || "").trim();
  if (!notionToken) return { ok:false, message:"NOTION_TOKEN missing" };
  if (!notionDbRaw) return { ok:false, message:"NOTION_DATABASE_ID missing" };

  const storeId = String(props.getProperty("PROTOCOL_STORE_SPREADSHEET_ID") || "").trim();
  if (!storeId) return { ok:false, message:"PROTOCOL_STORE_SPREADSHEET_ID missing. run admin_setupProtocolCandidatesStore first." };
  _pc_ensureStoreSheets_(storeId);

  // last sync（props優先）
  let sinceIso = String(props.getProperty("NOTION_LAST_SYNC_ISO") || "").trim();
  if (!sinceIso){
    const state = _pc_getSyncState_(storeId);
    sinceIso = String(state.lastSyncIso || "").trim();
  }

  const dbRes = _notion_queryMinutesSinceFull_(notionToken, notionDbRaw, sinceIso);
  let pages = (dbRes && Array.isArray(dbRes.pages)) ? dbRes.pages : [];
  if (limit > 0) pages = pages.slice(0, limit);

  let maxEdited = sinceIso;
  let totalCandidates = 0;
  let pagesNoContent = 0;
  const noContentPageIds = [];

  const runId = Utilities.getUuid().replace(/-/g,"");
  const startedAt = _nowIsoJst_();

  // ★プロンプトの世代管理（監査用）
  const promptVersion = "v3_ctx1";

  for (let i=0; i<pages.length; i++){
    const p = pages[i];

    const pageId = String(p.id || "").trim();
    const lastEdited = String(p.last_edited_time || "").trim();
    if (lastEdited && (!maxEdited || lastEdited > maxEdited)) maxEdited = lastEdited;

    // ★PJ解決：Notion PJリレーション → AMD projectId
    //    フォールバック：別名表（alias rules）で強制マップ
    //    それでも無理なら unknown に寄せて「空欄ゼロ」にする
    const pjResolved = _resolveSuggestedProject_(notionToken, p, /*minutesText not yet*/ "");
    let suggestedProjectId = pjResolved.projectId;
    let suggestedProjectName = pjResolved.projectName;

    // ★本命：properties["内容"]
    let minutesText = _notion_extractPropertyText_(p, "内容");
    if (!minutesText || String(minutesText).trim().length < 10){
      try{
        minutesText = _notion_pageToPlainText_(notionToken, pageId, { maxDepth: 6, maxChars: 4000 });
      } catch(e){ minutesText = ""; }
    }
    if (!minutesText || String(minutesText).trim().length < 10){
      pagesNoContent++;
      noContentPageIds.push(pageId);
      continue;
    }

    // ★ここで別名表フォールバックを実行（minutesTextが取れたので精度UP）
    if (!suggestedProjectId || suggestedProjectId === "unknown"){
      const pjResolved2 = _resolveSuggestedProject_(notionToken, p, String(minutesText||""));
      suggestedProjectId = pjResolved2.projectId;
      suggestedProjectName = pjResolved2.projectName;
    }

    // ★EXCLUDE判定（別名表で除外ワードを引いたら、その議事録は候補生成を丸ごとスキップ）
    if (suggestedProjectId === "EXCLUDE"){
      continue;
    }

    // ★最終ガード：suggestedProjectId を絶対に空にしない
    if (!suggestedProjectId) suggestedProjectId = "unknown";
    if (!suggestedProjectName) suggestedProjectName = suggestedProjectId;

    // =========================================================
    // ★Context注入（global + projectId）
    //   ここで使ったContextは candidate行にも記録する
    // =========================================================
    const contexts = _pc_pickLLMContextFor_(storeId, suggestedProjectId, 60);
    const injectedContextIds = contexts.map(x => String(x.contextId||"").trim()).filter(x=>x);
    const injectedContextText = _pc_buildContextInjectionText_(contexts);

    // digestは「同じ注入だったか」を判定できればOKなので短めで十分
    let injectedContextDigest = "";
    try{
      const bytes = Utilities.computeDigest(
        Utilities.DigestAlgorithm.SHA_256,
        String(injectedContextText||""),
        Utilities.Charset.UTF_8
      );
      injectedContextDigest = bytes.map(b => (b + 256).toString(16).slice(-2)).join("").slice(0, 16);
    } catch(e){
      injectedContextDigest = String(injectedContextText||"").slice(0, 80);
    }

    // ★NEW: 論点タグを超軽量に推定して、addon選択に使う
    const issueTags = _pc_suggestIssueTagsFromText_(String(minutesText||""));

    // ★タグ候補はLLMで推定して返させる（後でUIで直せる前提）
    const extracted = _openai_extractProtocolCandidates_(String(minutesText), {
      pageId,
      lastEdited,
      contextText: injectedContextText,

      // ★NEW: ExtractorConfig selection
      projectId: suggestedProjectId,
      issueTags: issueTags,
      groupName: "protocol_extract"
    });

    const rows = [];
    for (let k=0; k<extracted.length; k++){
      const c = extracted[k] || {};
      const branchPoint = String(c.branch_point || "").trim();
      const criteria = String(c.condition || "").trim();
      const decision = String(c.action || "").trim();
      if (!branchPoint || !criteria) continue;

      const optionsJson = JSON.stringify([]);
      const evidenceJson = JSON.stringify(Array.isArray(c.evidence_snippets) ? c.evidence_snippets : []);
      const confidence = (c.confidence === null || c.confidence === undefined) ? "" : String(c.confidence);

      const suggestedTags = Array.isArray(c.tags)
        ? c.tags.map(x=>String(x||"").trim()).filter(x=>x).join(",")
        : "";

      const candKey = _pc_hashKey_(pageId, branchPoint, criteria);

      rows.push({
        candidateId: Utilities.getUuid().replace(/-/g,""),
        candidateKey: candKey,
        sourceType: "notion",
        sourcePageId: pageId,
        sourceLastEditedAt: lastEdited,

        suggestedProjectId: suggestedProjectId,
        suggestedProjectName: suggestedProjectName,
        suggestedTags: suggestedTags || "",

        branchPoint,
        criteria,
        optionsJson,
        decision,
        evidenceJson,
        confidence,
        status: "new",
        promotedProtocolId: "",
        runId,
        createdAt: startedAt,
        updatedAt: startedAt,

        // ★抽出時に参照したデータ（監査用）
        injectedContextIds: JSON.stringify(injectedContextIds || []),
        injectedContextDigest: String(injectedContextDigest || ""),
        promptVersion: String(promptVersion || ""),

        feedbackRating: "",
        feedbackComment: "",
        feedbackBy: "",
        feedbackAt: ""
      });
    }

    if (!dryRun){
      const appended = _pc_appendCandidatesDedupe_(storeId, rows);
      totalCandidates += appended.appended;
    } else {
      totalCandidates += rows.length;
    }
  }

  // ★テスト(limit>0)では同期点を進めない
  const shouldCommitSync = (!dryRun && limit <= 0);

  if (shouldCommitSync && maxEdited){
    props.setProperty("NOTION_LAST_SYNC_ISO", maxEdited);
    _pc_setSyncState_(storeId, { lastSyncIso: maxEdited, lastRunId: runId, updatedAt: startedAt });
  }

  return {
    ok:true,
    runId,
    sinceIso: sinceIso || "",
    pages: pages.length,
    pagesNoContent: pagesNoContent,
    noContentPageIds: noContentPageIds.slice(0, 20),
    candidates: totalCandidates,
    lastSyncIso: shouldCommitSync ? (maxEdited || sinceIso || "") : sinceIso
  };
}

function admin_promoteProtocolCandidate(payload){
  if (!canAccessAdminPage_()) return { ok:false, message:"access denied" };

  payload = payload || {};
  const candidateId = String(payload.candidateId || "").trim();
  const projectId = String(payload.projectId || "").trim(); // promote時点でPJを決める（後でUIで選ばせる）
  const tags = String(payload.tags || "").trim();
  const importance = String(payload.importance || "1").trim();

  if (!candidateId) return { ok:false, message:"candidateId empty" };
  if (!projectId) return { ok:false, message:"projectId empty" };

  const storeId = String(PropertiesService.getScriptProperties().getProperty("PROTOCOL_STORE_SPREADSHEET_ID") || "").trim();
  if (!storeId) return { ok:false, message:"PROTOCOL_STORE_SPREADSHEET_ID missing" };

  // 1) candidate row load
  const sh = b_getSheet_("DB_ProtocolCandidates");
  if (!sh) return { ok:false, message:"DB_ProtocolCandidates missing" };

  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2) return { ok:false, message:"no candidates" };

  const vals = sh.getRange(1,1,lastRow,lastCol).getValues();
  const header = vals[0].map(x=>String(x||"").trim());
  const idx = {};
  header.forEach((h,i)=>{ if(h) idx[h]=i; });
  function col_(name){
    const i = idx[name];
    if (i === undefined) throw new Error("DB_ProtocolCandidates missing col: " + name);
    return i;
  }
  const iId = col_("candidateId");
  const iStatus = col_("status");
  const iBranch = col_("branchPoint");
  const iCrit = col_("criteria");
  const iDecision = col_("actionTaken");
  const iEvidence = col_("evidenceJson");
  const iUpd = col_("updatedAt");
  const iPromoted = col_("promotedProtocolId");

  let hitRow = -1;
  let cand = null;
  for (let r=1; r<vals.length; r++){
    if (String(vals[r][iId]||"").trim() !== candidateId) continue;
    hitRow = r + 1;
    cand = {
      branchPoint: String(vals[r][iBranch]||"").trim(),
      criteria: String(vals[r][iCrit]||"").trim(),
      decision: String(vals[r][iDecision]||"").trim(),
      evidenceJson: String(vals[r][iEvidence]||"").trim()
    };
    break;
  }
  if (hitRow < 2 || !cand) return { ok:false, message:"candidate not found" };

  // 2) create protocol (existing DB_Protocols writer)
  const created = admin_createProtocolManual({
    projectId,
    decisionPoint: cand.branchPoint,
    decisionCriteria: cand.criteria,
    actionTaken: cand.decision,
    tags,
    importance,
    sourceType: "monthly_report",
    sourceRef: candidateId
  });
  if (!created || !created.ok) return { ok:false, message:"failed to create protocol", detail: created };

  // 3) mark candidate promoted
  const nowIso = _nowIsoJst_();
  sh.getRange(hitRow, iStatus+1).setValue("promoted");
  sh.getRange(hitRow, iPromoted+1).setValue(String(created.protocolId || ""));
  sh.getRange(hitRow, iUpd+1).setValue(nowIso);

  return { ok:true, protocolId: created.protocolId, candidateId };
}

// ---------------- Store helpers (external spreadsheet) ----------------
/**
 * PJ解決（空欄ゼロ）
 * 優先順位：
 * 1) NotionのPJリレーション（propName="PJ"）先ページタイトル → DB_Projects照合
 * 2) 別名表（alias rules）で minutesText / title をスキャンしてマップ
 * 3) それでも無理なら unknown
 *
 * return:
 *  { projectId, projectName }
 *  ※ projectId === "EXCLUDE" の場合は候補生成をスキップすること
 */
function _resolveSuggestedProject_(notionToken, pageObj, minutesText){
  const fallbackUnknown = { projectId: "unknown", projectName: "unknown" };

  const pageTitle = _notion_guessPageTitle_(pageObj);

  // 0) タイトルからPJコードを抜く（最優先フォールバック）
  // 例: "【ZeMA】..." -> "ZeMA"
  //     "[JC] ..."   -> "JC"
  function pickCodeFromTitle_(t){
    const s = String(t||"").trim();
    if (!s) return "";
    let m = s.match(/^【([^】]+)】/);
    if (m && m[1]) return String(m[1]).trim();
    m = s.match(/^\[([^\]]+)\]/);
    if (m && m[1]) return String(m[1]).trim();
    return "";
  }

  const titleCode = pickCodeFromTitle_(pageTitle);
  if (titleCode){
    const pid0 = _resolveAmdProjectIdByProjectNameOrCode_(titleCode);
    if (pid0){
      return { projectId: pid0, projectName: titleCode };
    }
  }

  // 1) NotionのPJ relation（キーは "PJ" 固定。空なら素通り）
  const relIds = _notion_extractRelationIds_(pageObj, "PJ");
  if (relIds && relIds.length){
    const relName = _notion_resolvePageTitleCached_(notionToken, relIds[0]); // 先頭だけ
    const suggestedProjectName = String(relName || "").trim();
    if (suggestedProjectName){
      const pid = _resolveAmdProjectIdByProjectNameOrCode_(suggestedProjectName);
      if (pid){
        return { projectId: pid, projectName: suggestedProjectName };
      }
    }
  }

  // 2) alias rules（title + minutesText）
  const hay = (String(pageTitle||"") + "\n" + String(minutesText||"")).toLowerCase();
  const hit = _matchProjectAliasRule_(hay);
  if (hit){
    if (hit.pjCode === "EXCLUDE"){
      return { projectId: "EXCLUDE", projectName: "EXCLUDE" };
    }
    const pid2 = _resolveAmdProjectIdByProjectNameOrCode_(hit.pjCode);
    if (pid2){
      return { projectId: pid2, projectName: hit.pjCode };
    }
    return { projectId: "unknown", projectName: hit.pjCode };
  }

  return fallbackUnknown;
}

/** Notionのpage objectからtitleっぽいものを推定（安全に） */
function _notion_guessPageTitle_(pageObj){
  try{
    const props = (pageObj && pageObj.properties) ? pageObj.properties : null;
    if (!props) return "";
    for (const k in props){
      const p = props[k];
      if (p && p.type === "title"){
        const arr = Array.isArray(p.title) ? p.title : [];
        return arr.map(x => x && x.plain_text ? x.plain_text : "").join("").trim();
      }
    }
    return "";
  } catch(e){
    return "";
  }
}

/**
 * 別名表（alias rules）を探して読み込む
 * シート名を固定しないで、ヘッダ行に alias/pjCode/priority/matchType があるシートを自動検出する
 */
function _loadProjectAliasRules_(){
  const ss = b_ss_();
  const sheets = ss.getSheets();

  let aliasSheet = null;
  let header = null;
  for (let i=0; i<sheets.length; i++){
    const sh = sheets[i];
    const lastCol = sh.getLastColumn();
    if (lastCol < 4) continue;
    const h = sh.getRange(1,1,1,lastCol).getValues()[0].map(x=>String(x||"").trim());
    const has = (name)=> h.indexOf(name) >= 0;

    // ★この4列が揃ってたら「別名表」とみなす
    if (has("alias") && has("pjCode") && has("priority") && has("matchType")){
      aliasSheet = sh;
      header = h;
      break;
    }
  }

  if (!aliasSheet) return [];

  const idx = {};
  header.forEach((h,i)=>{ if(h) idx[h]=i; });
  const lastRow = aliasSheet.getLastRow();
  if (lastRow < 2) return [];

  const vals = aliasSheet.getRange(2,1,lastRow-1,header.length).getValues();
  const rules = [];

  function s_(v){ return String(v===null||v===undefined?"":v).trim(); }
  function n_(v){ const x = Number(v); return isFinite(x) ? x : 0; }

  for (let r=0; r<vals.length; r++){
    const row = vals[r];
    const alias = s_(row[idx["alias"]]);
    const pjCode = s_(row[idx["pjCode"]]);
    if (!alias || !pjCode) continue;

    rules.push({
      alias: alias,
      aliasLower: alias.toLowerCase(),
      pjCode: pjCode,
      priority: n_(row[idx["priority"]]),
      matchType: s_(row[idx["matchType"]] || "contains").toLowerCase(),
      note: s_(idx["note"] !== undefined ? row[idx["note"]] : "")
    });
  }

  // priority desc（強い順）
  rules.sort((a,b)=> (b.priority||0) - (a.priority||0));
  return rules;
}

/** alias rules でPJを当てる（最初にヒットした最優先ルール） */
function _matchProjectAliasRule_(hayLower){
  const cache = CacheService.getScriptCache();
  const key = "aliasRules:v1";
  let rules = null;

  try{
    const cached = cache.get(key);
    if (cached){
      rules = JSON.parse(cached);
    }
  } catch(e){}

  if (!rules){
    rules = _loadProjectAliasRules_();
    try{ cache.put(key, JSON.stringify(rules), 10*60); } catch(e){} // 10分
  }

  const text = String(hayLower||"").toLowerCase();
  if (!text) return null;

  for (let i=0; i<rules.length; i++){
    const r = rules[i];
    if (!r || !r.aliasLower) continue;

    if (r.matchType === "equals"){
      if (text === r.aliasLower) return r;
    } else {
      // contains default
      if (text.includes(r.aliasLower)) return r;
    }
  }
  return null;
}

/**
 * DB_Projects から projectId を引く
 * - projectName一致（大小無視）
 * - さらに projectCode/pjCode 列があればそこも見る
 */
function _resolveAmdProjectIdByProjectNameOrCode_(nameOrCode){
  const raw = String(nameOrCode||"").trim();
  if (!raw) return "";

  // ★正規化：絵文字/記号/空白/装飾を落として比較キーを作る
  function norm_(s){
    let x = String(s||"").trim();

    // variation selector
    x = x.replace(/[\uFE0E\uFE0F]/g, "");

    // 絵文字（だいたいの範囲を一括除去）
    x = x.replace(/[\u{1F000}-\u{1FAFF}]/gu, "");
    x = x.replace(/[\u{2600}-\u{27BF}]/gu, "");

    // 装飾記号を落とす（Notionの「・」「【】」系、括弧、スラッシュ等）
    x = x.replace(/[【】\[\]\(\)（）<>＜＞]/g, " ");
    x = x.replace(/[\/\\\|]/g, " ");

    // PJ: みたいなのが付いてたら落とす
    x = x.replace(/^PJ[:：]\s*/i, "");

    // 空白全部消す
    x = x.replace(/\s+/g, "");

    return x.toLowerCase();
  }

  const key = norm_(raw);
  if (!key) return "";

  try{
    const sh = b_ss_().getSheetByName("DB_Projects");
    if (!sh) return "";

    const vals = sh.getDataRange().getValues();
    if (!vals || vals.length < 2) return "";

    const h = vals[0].map(x=>String(x||"").trim());
    const iPid = h.indexOf("projectId");
    const iPn  = h.indexOf("projectName");

    // code列候補を広めに拾う（既存互換）
    const iCode = (h.indexOf("projectCode")>=0) ? h.indexOf("projectCode")
               : (h.indexOf("pjCode")>=0) ? h.indexOf("pjCode")
               : -1;

    if (iPid < 0) return "";

    // ★1) projectId 直指定に対応（p01 みたいなのが来てもOK）
    for (let r=1; r<vals.length; r++){
      const pid = String(vals[r][iPid]||"").trim();
      if (pid && norm_(pid) === key) return pid;
    }

    // ★2) code 完全一致
    if (iCode >= 0){
      for (let r=1; r<vals.length; r++){
        const c = String(vals[r][iCode]||"").trim();
        if (c && norm_(c) === key) return String(vals[r][iPid]||"").trim();
      }
    }

    // ★3) name 完全一致（正規化比較）
    if (iPn >= 0){
      for (let r=1; r<vals.length; r++){
        const pn = String(vals[r][iPn]||"").trim();
        if (pn && norm_(pn) === key) return String(vals[r][iPid]||"").trim();
      }
    }

    // ★4) name 部分一致（正規化比較、保険）
    if (iPn >= 0){
      for (let r=1; r<vals.length; r++){
        const pn = String(vals[r][iPn]||"").trim();
        const pnk = norm_(pn);
        if (pnk && (pnk.includes(key) || key.includes(pnk))){
          return String(vals[r][iPid]||"").trim();
        }
      }
    }

    return "";
  } catch(e){
    return "";
  }
}

function _pc_ensureStoreSheets_(spreadsheetId){
  const ss = SpreadsheetApp.openById(spreadsheetId);

  // Candidates
  let sh = ss.getSheetByName("DB_ProtocolCandidates");
  if (!sh) sh = ss.insertSheet("DB_ProtocolCandidates");
  ensureHeader_(sh, [
    "candidateId",
    "candidateKey",
    "sourceType",
    "sourcePageId",
    "sourceLastEditedAt",

    "suggestedProjectId",
    "suggestedProjectName",
    "suggestedTags",

    "branchPoint",
    "criteria",
    "optionsJson",
    "decision",
    "evidenceJson",
    "confidence",
    "status",
    "promotedProtocolId",
    "runId",
    "createdAt",
    "updatedAt",

    // ★却下フィードバック
    "rejectedReason",
    "rejectedBy",
    "rejectedAt",

    // ★抽出時に参照したデータ（監査用）
    "injectedContextIds",     // JSON string: ["ctxId1","ctxId2",...]
    "injectedContextDigest",  // short text (first 200 chars etc)
    "promptVersion",

    // ★抽出品質フィードバック（正しかった？）
    "feedbackRating",         // "good" / "bad"
    "feedbackComment",
    "feedbackBy",
    "feedbackAt"
  ]);

  // Sync state
  let st = ss.getSheetByName("DB_NotionSyncState");
  if (!st) st = ss.insertSheet("DB_NotionSyncState");
  ensureHeader_(st, ["key","value","updatedAt"]);

  // Reject feedback log
  let fb = ss.getSheetByName("DB_ProtocolRejectFeedback");
  if (!fb) fb = ss.insertSheet("DB_ProtocolRejectFeedback");
  ensureHeader_(fb, [
    "feedbackId",
    "candidateId",
    "sourceType",
    "sourcePageId",
    "branchPoint",
    "criteria",
    "decision",
    "reason",
    "rejectedBy",
    "rejectedAt"
  ]);

  // ★LLM Context（背景知識）
  let cx = ss.getSheetByName("DB_LLMContext");
  if (!cx) cx = ss.insertSheet("DB_LLMContext");
  ensureHeader_(cx, [
    "contextId",
    "status",          // active / archived

    // ※互換維持のため列は残す（UIからは消す想定）
    "scopeType",       // global / projectId / projectCode（deprecated）
    "scopeKey",        // "" or p21 or "CX" etc（deprecated）

    "title",
    "content",
    "tags",            // comma: scope:global, scope:projectId:p21, ...
    "priority",        // number (desc)
    "createdAt",
    "updatedAt"
  ]);

  // ★NEW: LLM Context Tags master（プルダウン候補の正本）
  let cxt = ss.getSheetByName("DB_LLMContextTags");
  if (!cxt) cxt = ss.insertSheet("DB_LLMContextTags");
  ensureHeader_(cxt, [
    "tag",
    "status",      // active / archived
    "note",
    "createdAt",
    "updatedAt"
  ]);

  // ★Extractor Prompt Config（抽出ルール）
  let ex = ss.getSheetByName("DB_LLMExtractorConfig");
  if (!ex) ex = ss.insertSheet("DB_LLMExtractorConfig");
  ensureHeader_(ex, [
    "configId",
    "name",            // e.g. "protocol_extract"
    "status",          // active / archived
    "version",         // e.g. "v3_ctx1"
    "systemPrompt",    // long text
    "note",            // optional human note
    "createdAt",
    "updatedAt",

    // ★追加（タグ合成用）
    "kind",            // base / addon / reference
    "scopeType",       // global / projectId / projectCode / genre
    "scopeKey",        // "" / p21 / LST / CX / 採用 など
    "tags",            // comma (CEO,採用,...)
    "priority",        // number (desc)
    "maxChars",        // number (e.g. 800)
    "composeGroup",    // optional group key (default uses name)
    "updatedBy"        // editor email
  ]);

  // number format: keep ISO/text as text
  try{
    sh.getRange(2, 1, Math.max(sh.getLastRow()-1,1), sh.getLastColumn()).setNumberFormat("@");
    st.getRange(2, 1, Math.max(st.getLastRow()-1,1), st.getLastColumn()).setNumberFormat("@");
    fb.getRange(2, 1, Math.max(fb.getLastRow()-1,1), fb.getLastColumn()).setNumberFormat("@");
    cx.getRange(2, 1, Math.max(cx.getLastRow()-1,1), cx.getLastColumn()).setNumberFormat("@");
    cxt.getRange(2, 1, Math.max(cxt.getLastRow()-1,1), cxt.getLastColumn()).setNumberFormat("@");
    ex.getRange(2, 1, Math.max(ex.getLastRow()-1,1), ex.getLastColumn()).setNumberFormat("@");
  } catch(e){}
}

function _pc_getSyncState_(spreadsheetId){
  const ss = SpreadsheetApp.openById(spreadsheetId);
  const sh = ss.getSheetByName("DB_NotionSyncState");
  if (!sh) return { lastSyncIso:"" };

  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2) return { lastSyncIso:"" };

  const vals = sh.getRange(1,1,lastRow,lastCol).getValues();
  const h = vals[0].map(x=>String(x||"").trim());
  const iKey = h.indexOf("key");
  const iVal = h.indexOf("value");
  if (iKey < 0 || iVal < 0) return { lastSyncIso:"" };

  const out = {};
  for (let r=1; r<vals.length; r++){
    const k = String(vals[r][iKey]||"").trim();
    if (!k) continue;
    out[k] = String(vals[r][iVal]||"").trim();
  }
  return {
    lastSyncIso: out.lastSyncIso || "",
    lastRunId: out.lastRunId || "",
    updatedAt: out.updatedAt || ""
  };
}

function _pc_setSyncState_(spreadsheetId, state){
  const ss = SpreadsheetApp.openById(spreadsheetId);
  const sh = ss.getSheetByName("DB_NotionSyncState");
  if (!sh) return;

  ensureHeader_(sh, ["key","value","updatedAt"]);

  const nowIso = String(state.updatedAt || _nowIsoJst_());
  const pairs = [
    ["lastSyncIso", String(state.lastSyncIso || "")],
    ["lastRunId", String(state.lastRunId || "")],
    ["updatedAt", nowIso]
  ];

  // upsert by key
  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  const vals = (lastRow >= 2) ? sh.getRange(1,1,lastRow,lastCol).getValues() : [sh.getRange(1,1,1,lastCol).getValues()[0]];
  const header = vals[0].map(x=>String(x||"").trim());
  const iKey = header.indexOf("key");
  const iVal = header.indexOf("value");
  const iUpd = header.indexOf("updatedAt");

  const rowByKey = {};
  for (let r=1; r<vals.length; r++){
    const k = String(vals[r][iKey]||"").trim();
    if (k) rowByKey[k] = r + 1;
  }

  pairs.forEach(([k,v])=>{
    const rowNo = rowByKey[k];
    if (rowNo){
      sh.getRange(rowNo, iVal+1).setValue(v);
      sh.getRange(rowNo, iUpd+1).setValue(nowIso);
    } else {
      sh.appendRow([k, v, nowIso]);
    }
  });
}

function _pc_hashKey_(pageId, branchPoint, criteria){
  const raw = String(pageId||"") + "\n" + String(branchPoint||"") + "\n" + String(criteria||"");
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw, Utilities.Charset.UTF_8);
  return bytes.map(b => (b + 256).toString(16).slice(-2)).join("");
}

function _pc_appendCandidatesDedupe_(spreadsheetId, rows){
  const sh = b_getSheet_("DB_ProtocolCandidates");
  if (!sh) throw new Error("DB_ProtocolCandidates missing");

  if (!rows || !rows.length) return { appended:0, skipped:0, updated:0 };

  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  const header = sh.getRange(1,1,1,lastCol).getValues()[0].map(x=>String(x||"").trim());

  const idx = {};
  header.forEach((h,i)=>{ if(h) idx[h]=i; });

  const iKey = idx["candidateKey"];
  if (iKey === undefined) throw new Error("candidateKey col missing");

  const iSugPid = idx["suggestedProjectId"];
  const iSugPnm = idx["suggestedProjectName"];
  const iSugTags = idx["suggestedTags"];
  const iUpd = idx["updatedAt"];

  // 既存key→行番号（末尾2000行だけ）
  const existingRowByKey = Object.create(null);
  const tail = Math.min(Math.max(lastRow-1,0), 2000);
  if (tail > 0){
    const start = (lastRow - tail + 1);
    const keyVals = sh.getRange(start, iKey+1, tail, 1).getValues();
    for (let i=0; i<keyVals.length; i++){
      const k = String(keyVals[i][0]||"").trim();
      if (k) existingRowByKey[k] = start + i; // 実シート行番号
    }
  }

  function buildRowByHeader_(rec){
    const row = new Array(header.length).fill("");

    function put_(name, val){
      const i = idx[name];
      if (i === undefined) return;
      row[i] = (val === undefined || val === null) ? "" : val;
    }

    put_("candidateId", rec.candidateId);
    put_("candidateKey", rec.candidateKey);
    put_("sourceType", rec.sourceType);
    put_("sourcePageId", rec.sourcePageId);
    put_("sourceLastEditedAt", rec.sourceLastEditedAt);

    put_("suggestedProjectId", rec.suggestedProjectId || "");
    put_("suggestedProjectName", rec.suggestedProjectName || "");
    put_("suggestedTags", rec.suggestedTags || "");

    put_("branchPoint", rec.branchPoint);
    put_("criteria", rec.criteria);
    put_("optionsJson", rec.optionsJson);
    put_("actionTaken", rec.actionTaken);
    put_("evidenceJson", rec.evidenceJson);
    put_("confidence", rec.confidence);

    put_("status", rec.status);
    put_("promotedProtocolId", rec.promotedProtocolId);
    put_("runId", rec.runId);
    put_("createdAt", rec.createdAt);
    put_("updatedAt", rec.updatedAt);

    put_("rejectedReason", rec.rejectedReason || "");
    put_("rejectedBy", rec.rejectedBy || "");
    put_("rejectedAt", rec.rejectedAt || "");

    // ★注入記録
    put_("injectedContextIds", rec.injectedContextIds || "");
    put_("injectedContextDigest", rec.injectedContextDigest || "");
    put_("promptVersion", rec.promptVersion || "");

    // ★抽出フィードバック
    put_("feedbackRating", rec.feedbackRating || "");
    put_("feedbackComment", rec.feedbackComment || "");
    put_("feedbackBy", rec.feedbackBy || "");
    put_("feedbackAt", rec.feedbackAt || "");

    return row;
  }


  let appended = 0;
  let skipped = 0;
  let updated = 0;

  rows.forEach(rec=>{
    const k = String(rec.candidateKey||"").trim();
    if (!k) return;

    // 空の候補は入れない
    const bp = String(rec.branchPoint||"").trim();
    const cr = String(rec.criteria||"").trim();
    if (!bp || !cr) return;

    const existingRow = existingRowByKey[k];

    // 既存があるなら「PJが空/unknownのときだけ更新」
    if (existingRow){
      if (iSugPid !== undefined){
        const curPid = String(sh.getRange(existingRow, iSugPid+1).getValue() || "").trim();
        const curEmpty = (!curPid || curPid.toLowerCase() === "unknown");

        const nextPid = String(rec.suggestedProjectId||"").trim();
        const nextName = String(rec.suggestedProjectName||"").trim();
        const nextTags = String(rec.suggestedTags||"").trim();

        if (curEmpty && nextPid && nextPid.toLowerCase() !== "unknown"){
          if (iSugPid !== undefined) sh.getRange(existingRow, iSugPid+1).setValue(nextPid);
          if (iSugPnm !== undefined) sh.getRange(existingRow, iSugPnm+1).setValue(nextName || nextPid);
          if (iSugTags !== undefined && nextTags) sh.getRange(existingRow, iSugTags+1).setValue(nextTags);
          if (iUpd !== undefined) sh.getRange(existingRow, iUpd+1).setValue(_nowIsoJst_());
          updated++;
        }
      }
      skipped++;
      return;
    }

    // 新規
    sh.appendRow(buildRowByHeader_(rec));
    appended++;
    existingRowByKey[k] = sh.getLastRow();
  });

  return { appended, skipped, updated };
}

// ---------------- Notion client ----------------
function _notion_fetch_(token, url, method, bodyObj){
  const opt = {
    method: (method||"get").toLowerCase(),
    muteHttpExceptions: true,
    headers: {
      "Authorization": "Bearer " + token,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json"
    }
  };
  if (bodyObj !== undefined && bodyObj !== null){
    opt.payload = JSON.stringify(bodyObj);
  }
  const resp = UrlFetchApp.fetch(url, opt);
  const code = resp.getResponseCode();
  const text = resp.getContentText();
  if (code < 200 || code >= 300){
    throw new Error("Notion API failed: " + code + " " + text);
  }
  return text ? JSON.parse(text) : {};
}

function _notion_normId_(v){
  const s = String(v || "").trim();

  // 32桁hex（ハイフン無し）を優先で拾う
  const m1 = s.match(/[0-9a-f]{32}/i);
  if (m1) return m1[0];

  // 36桁（ハイフンあり）を拾ってハイフン除去
  const m2 = s.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  if (m2) return m2[0].replace(/-/g, "");

  return "";
}

function _notion_queryMinutesSince_(token, databaseId, sinceIso){
  const dbId = _notion_normId_(databaseId);
  if (!dbId) {
    throw new Error("NOTION_DATABASE_ID invalid (expected database id or notion url): " + String(databaseId || ""));
  }

  // ★ここ、encodeURIComponentいらない（32桁hexだけに正規化したので）
  const url = "https://api.notion.com/v1/databases/" + dbId + "/query";

  const base = {
    sorts: [{ timestamp:"last_edited_time", direction:"descending" }]
  };


  if (sinceIso){
    base.filter = {
      timestamp: "last_edited_time",
      last_edited_time: { on_or_after: sinceIso }
    };
  }

  const out = [];
  let cursor = null;

  while (true){
    const payload = Object.assign({}, base);
    if (cursor) payload.start_cursor = cursor;

    const res = _notion_fetch_(token, url, "post", payload);
    const results = res.results || [];
    for (let i=0; i<results.length; i++){
      const r = results[i];
      out.push({ id: r.id, last_edited_time: r.last_edited_time });
    }
    cursor = res.next_cursor;
    if (!cursor) break;
  }

  return out;
}
function _notion_pageToPlainText_(token, pageId, opts){
  opts = opts || {};
  const maxDepth = (opts.maxDepth !== undefined) ? Number(opts.maxDepth||0) : 6;
  const maxChars = (opts.maxChars !== undefined) ? Number(opts.maxChars||0) : 120000;

  const lines = [];
  let chars = 0;

  function push_(s){
    if (!s) return;
    if (chars >= maxChars) return;
    const t = String(s);
    const left = maxChars - chars;
    const cut = (t.length > left) ? t.slice(0,left) : t;
    lines.push(cut);
    chars += cut.length + 1;
  }

  // ★ここが追加：children取得の安全版（transcriptionはAPI非対応なので握りつぶす）
  function fetchChildrenSafe_(blockId, cursor){
    const url = "https://api.notion.com/v1/blocks/" + encodeURIComponent(blockId) + "/children"
      + (cursor ? ("?start_cursor="+encodeURIComponent(cursor)) : "");

    try{
      return _notion_fetch_(token, url, "get", null);
    } catch(e){
      const msg = String(e && (e.message || e.stack || e) ? (e.message || e.stack || e) : e);

      // Notionが明示的に「transcriptionはAPI非対応」と言ってくるケースをスキップ
      if (msg.includes("Block type transcription is not supported")){
        return { results: [], next_cursor: null };
      }

      // 他のエラーは落として気づけるようにそのまま投げる
      throw e;
    }
  }

  function walk_(blockId, depth){
    if (chars >= maxChars) return;

    let cursor = null;
    while (true){
      const res = fetchChildrenSafe_(blockId, cursor);
      const blocks = res.results || [];

      for (let i=0; i<blocks.length; i++){
        const b = blocks[i];

        if (b.type === "transcription"){
          // API非対応のため完全スキップ（要約は通常ブロックで取得済み）
        } else {
          const text = _notion_blockToText_(b);
          if (text) push_(text);
        }

        // has_childrenでも、transcriptionは辿れないのでスキップ
        if (b.has_children && b.type !== "transcription" && depth < maxDepth){
          walk_(b.id, depth + 1);
        }

        if (chars >= maxChars) break;
      }

      cursor = res.next_cursor;
      if (!cursor || chars >= maxChars) break;
    }
  }

  walk_(pageId, 0);

  return lines.join("\n").trim();
}

function _notion_blockToText_(block){
  const t = block.type;
  const obj = block[t];
  if (!obj) return "";

  const rich = obj.rich_text || obj.title || [];
  const txt = (rich || []).map(rt => rt.plain_text || "").join("").trim();
  if (!txt) return "";

  if (t === "heading_1") return "# " + txt;
  if (t === "heading_2") return "## " + txt;
  if (t === "heading_3") return "### " + txt;
  if (t === "bulleted_list_item") return "- " + txt;
  if (t === "numbered_list_item") return "1. " + txt;
  if (t === "to_do") return "- [ ] " + txt;

  return txt;
}

// ---------------- OpenAI client (Responses + Structured Outputs) ----------------
function _openai_extractProtocolCandidates_(minutesText, meta){
  meta = meta || {};

  const storeId = String(PropertiesService.getScriptProperties().getProperty("PROTOCOL_STORE_SPREADSHEET_ID") || "").trim();

  let rejectHints = [];
  if (storeId){
    try{
      _pc_ensureStoreSheets_(storeId);
      rejectHints = _pc_listRecentRejectFeedback_(storeId, 30);
    } catch(e){ rejectHints = []; }
  }

  const rejectText = (rejectHints && rejectHints.length)
    ? rejectHints.map((x, i) => {
        const bp = String(x.branchPoint||"").trim();
        const rs = String(x.reason||"").trim();
        const cr = String(x.criteria||"").trim();
        const ac = String(x.decision||"").trim();
        return [`#${i+1}`, bp?`bp:${bp}`:"", cr?`cond:${cr}`:"", ac?`act:${ac}`:"", rs?`reason:${rs}`:""].filter(s=>s).join(" | ");
      }).join("\n")
    : "";

  const ctxText = String(meta.contextText || "").trim();

  const selector = {
    groupName: String(meta.groupName || "protocol_extract").trim(),
    projectId: String(meta.projectId || "").trim(),
    projectCode: String(meta.projectCode || "").trim(),
    genre: String(meta.genre || "").trim(),
    issueTags: Array.isArray(meta.issueTags) ? meta.issueTags : []
  };

  let picked = { base:null, addons:[], pickedMeta:{ selector:selector } };
  if (storeId){
    try{ picked = _pc_pickActiveExtractorPrompts_(storeId, selector, { groupName: selector.groupName, maxAddons: 3 }); }
    catch(e){}
  }

  const fallbackBase = [
    "あなたはAMD OS用に議事録から『プロトコル候補』を抽出する。",
    "プロトコル候補 = 分岐点（branch_point） + 判断条件（condition） + 推奨アクション（action）。",
    "1議事録から0〜複数件抽出してよい。",
    "condition は観測できる事実や状況を短めに書く（1〜3文）。",
    "action はAMDが取るべき行動を具体に書く（1〜2文）。",
    "evidence_snippets は根拠となる原文断片を短く複数返す。",
    "曖昧なら confidence を下げる。盛らない。",
    "tags は自由に提案してよい。日本語の短い名詞を1〜5個。"
  ].join("\n");

  const baseText = (picked && picked.base && picked.base.systemPrompt)
    ? String(picked.base.systemPrompt || "").trim()
    : fallbackBase;

  const addonTexts = (picked && picked.addons && picked.addons.length)
    ? picked.addons.map(x => String(x.systemPrompt||"").trim()).filter(x=>x)
    : [];

  const composedRules = [
    "=== Extractor Rules (BASE) ===",
    baseText,
    "=== end ==="
  ].concat(
    addonTexts.length
      ? ["", "=== Extractor Rules (ADDONS) ==="]
          .concat(addonTexts.map((t,i)=>[`[addon#${i+1}]`, t].join("\n")))
          .concat(["=== end ==="])
      : []
  ).join("\n");

  const systemPrompt = [
    composedRules,
    "",
    "=== 注入コンテキスト（参考情報） ===",
    ctxText ? ctxText : "(no context)",
    "=== end ===",
    "",
    "=== 過去に却下された例（同じミスを避ける） ===",
    rejectText ? rejectText : "(no feedback yet)",
    "=== end ===",
    "",
    "出力は必ず以下のJSONのみ（説明文禁止）:",
    '{"protocols":[{"branch_point":"...","condition":"...","action":"...","evidence_snippets":["..."],"confidence":0.8,"tags":["..."]}]}'
  ].join("\n");

  const userPrompt = [
    "source_page_id: " + String(meta.pageId||""),
    "last_edited_time: " + String(meta.lastEdited||""),
    "",
    "=== minutes ===",
    String(minutesText||"")
  ].join("\n");

  const raw = llm_callJson("protocol_extract", systemPrompt, userPrompt, { maxTokens: 2000 });
  if (!raw || !Array.isArray(raw.protocols)) return [];
  return raw.protocols;
}

function _openai_extractOutputText_(res){
  // response.output[].content[].text を探す
  const out = res.output || [];
  for (let i=0; i<out.length; i++){
    const o = out[i];
    const content = o.content || [];
    for (let k=0; k<content.length; k++){
      const c = content[k];
      if (c.type === "output_text" && c.text) return c.text;
      if (c.text) return c.text;
    }
  }
  // fallback
  if (res.output_text) return res.output_text;
  throw new Error("No output text in Responses response");
}
function _pc_pickLLMContextFor_(storeId, suggestedProjectId, limit){
  const lim = (limit !== undefined && limit !== null) ? Number(limit||0) : 50;
  const out = [];

  try{
    const ss = SpreadsheetApp.openById(storeId);
    const sh = ss.getSheetByName("DB_LLMContext");
    if (!sh) return out;

    const lastRow = sh.getLastRow();
    const lastCol = sh.getLastColumn();
    if (lastRow < 2) return out;

    const vals = sh.getRange(1,1,lastRow,lastCol).getValues();
    const h = vals[0].map(x=>String(x||"").trim());
    const idx = {};
    h.forEach((x,i)=>{ if(x) idx[x]=i; });

    function g_(row, name){
      const i = idx[name];
      if (i === undefined) return "";
      return row[i];
    }
    function s_(v){ return String(v===null||v===undefined?"":v).trim(); }
    function sl_(v){ return s_(v).toLowerCase(); }
    function n_(v){ const x = Number(v); return isFinite(x) ? x : 0; }

    function parseTags_(csv){
      return String(csv||"")
        .split(",")
        .map(x=>String(x||"").trim())
        .filter(x=>x);
    }

    // ★予約語スコープ（tagsに吸収する）
    // scope:global
    // scope:projectId:p21
    // scope:projectCode:CX
    function tagsHasScopeGlobal_(tags){
      return tags.some(t => t.toLowerCase() === "scope:global");
    }
    function tagsHasScopeProjectId_(tags, pid){
      if (!pid) return false;
      const key = ("scope:projectid:" + String(pid)).toLowerCase();
      return tags.some(t => String(t||"").toLowerCase() === key);
    }
    function tagsHasAnyScope_(tags){
      return tags.some(t => String(t||"").toLowerCase().startsWith("scope:"));
    }

    const pid = String(suggestedProjectId||"").trim();

    for (let r=1; r<vals.length; r++){
      const row = vals[r];
      const status = sl_(g_(row,"status"));
      if (status && status !== "active") continue;

      const tags = parseTags_(s_(g_(row,"tags")));

      // ===== 互換：従来の scopeType/scopeKey が入ってる行も生かす =====
      const scT = sl_(g_(row,"scopeType"));
      const scK = s_(g_(row,"scopeKey"));

      let inScope = false;

      // 1) まず tags の予約語で判定（新運用）
      const hasScope = tagsHasAnyScope_(tags);
      if (hasScope){
        if (tagsHasScopeGlobal_(tags)) inScope = true;
        if (!inScope && tagsHasScopeProjectId_(tags, pid)) inScope = true;
      } else {
        // 2) tagsにscope予約語が無いなら「従来互換」か「暗黙global」
        const okGlobal = (scT === "global");
        const okPid = (pid && scT === "projectid" && scK === pid);

        if (okGlobal || okPid) inScope = true;

        // 3) scopeTypeも空なら暗黙global扱い（既存が雑でも落ちない）
        if (!inScope && !scT && !scK) inScope = true;
      }

      if (!inScope) continue;

      out.push({
        contextId: s_(g_(row,"contextId")),
        title: s_(g_(row,"title")),
        content: s_(g_(row,"content")),
        tags: s_(g_(row,"tags")),
        priority: n_(g_(row,"priority"))
      });
    }

    out.sort((a,b)=> (b.priority||0) - (a.priority||0));
    return (lim > 0) ? out.slice(0, lim) : out;
  } catch(e){
    return out;
  }
}

function _pc_buildContextInjectionText_(contexts){
  const arr = Array.isArray(contexts) ? contexts : [];
  if (!arr.length) return "(no context)";

  // 長すぎると逆効果なので、1件あたり短く整形
  return arr.map(c=>{
    const t = String(c.title||"").trim();
    const body = String(c.content||"").trim();
    const cut = body.length > 260 ? (body.slice(0,260) + "…") : body;
    return `- ${t}\n  ${cut}`;
  }).join("\n");
}

// 実行用：Notion同期（本番）
function run_syncNotionMinutes_prod(){
  return admin_syncNotionMinutesToProtocolCandidates({
    dryRun: false
  });
}

// 実行用：Notion同期（dryRun）
function run_syncNotionMinutes_dry(){
  return admin_syncNotionMinutesToProtocolCandidates({
    dryRun: true
  });
}

function run_showProtocolStoreInfo(){
  const props = PropertiesService.getScriptProperties();
  const id = String(props.getProperty("PROTOCOL_STORE_SPREADSHEET_ID") || "").trim();
  const out = {
    ok: !!id,
    spreadsheetId: id,
    note: id ? "このIDのスプレッドシートがProtocol Store" : "まだ未作成"
  };
  Logger.log(JSON.stringify(out, null, 2));
  return out;
}

// ======================================================================
// Debug runners
// ======================================================================

function run_prod_and_log(){
  const res = admin_syncNotionMinutesToProtocolCandidates({ dryRun:false });
  Logger.log("[prod result]\n" + JSON.stringify(res, null, 2));
  return res;
}

function run_dry_and_log(){
  const res = admin_syncNotionMinutesToProtocolCandidates({ dryRun:true });
  Logger.log("[dry result]\n" + JSON.stringify(res, null, 2));
  return res;
}

// Notionからページが取れてるかだけを見る（LLMなし）
function run_debug_notion_pages(){
  const props = PropertiesService.getScriptProperties();
  const token = String(props.getProperty("NOTION_TOKEN") || "").trim();
  const dbId  = String(props.getProperty("NOTION_DATABASE_ID") || "").trim();
  const sinceIso = String(props.getProperty("NOTION_LAST_SYNC_ISO") || "").trim();

  const pages = _notion_queryMinutesSince_(token, dbId, sinceIso);
  const out = {
    ok:true,
    sinceIso: sinceIso || "",
    pages: pages.length,
    first: pages[0] || null
  };
  Logger.log("[notion pages]\n" + JSON.stringify(out, null, 2));
  return out;
}

// Notion本文（blocks）が取れてるかを見る（LLMなし）
function run_debug_first_minutes_text(){
  const props = PropertiesService.getScriptProperties();
  const token = String(props.getProperty("NOTION_TOKEN") || "").trim();
  const dbId  = String(props.getProperty("NOTION_DATABASE_ID") || "").trim();
  const sinceIso = String(props.getProperty("NOTION_LAST_SYNC_ISO") || "").trim();

  const pages = _notion_queryMinutesSince_(token, dbId, sinceIso);
  if (!pages.length){
    const out0 = { ok:false, message:"pages=0 (notion query returned nothing)", sinceIso };
    Logger.log("[minutesText]\n" + JSON.stringify(out0, null, 2));
    return out0;
  }

  const pageId = pages[0].id;
  const text = _notion_pageToPlainText_(token, pageId, { maxDepth: 6, maxChars: 20000 });

  const out = {
    ok:true,
    pageId,
    textLen: (text || "").length,
    head: (text || "").slice(0, 800)
  };
  Logger.log("[minutesText]\n" + JSON.stringify(out, null, 2));
  return out;
}

function run_showNotionConfig(){
  const props = PropertiesService.getScriptProperties();
  const raw = String(props.getProperty("NOTION_DATABASE_ID") || "");
  const norm = _notion_normId_(raw);
  const token = String(props.getProperty("NOTION_TOKEN") || "");
  const out = {
    rawDatabaseId: raw,
    normalizedDatabaseId: norm,
    tokenLooksSet: token ? (token.slice(0,4) + "..." + token.slice(-4)) : ""
  };
  Logger.log(JSON.stringify(out, null, 2));
  return out;
}

function _notion_queryMinutesSinceFull_(token, databaseId, sinceIso){
  const dbId = _notion_normId_(databaseId);
  if (!dbId) throw new Error("NOTION_DATABASE_ID invalid: " + String(databaseId||""));

  const url = "https://api.notion.com/v1/databases/" + dbId + "/query";

  const base = {
    sorts: [{ timestamp:"last_edited_time", direction:"descending" }]
  };

  if (sinceIso){
    base.filter = {
      timestamp: "last_edited_time",
      last_edited_time: { on_or_after: sinceIso }
    };
  }

  const pages = [];
  let cursor = null;

  while (true){
    const payload = Object.assign({}, base);
    if (cursor) payload.start_cursor = cursor;

    const res = _notion_fetch_(token, url, "post", payload);
    const results = res.results || [];
    for (let i=0; i<results.length; i++){
      pages.push(results[i]); // ★full page object
    }

    cursor = res.next_cursor;
    if (!cursor) break;
  }

  return { pages };
}

// Notionのページオブジェクトから、指定プロパティ名のテキストを抽出する
function _notion_extractPropertyText_(pageObj, propName){
  try{
    const props = (pageObj && pageObj.properties) ? pageObj.properties : null;
    if (!props) return "";

    const p = props[propName];
    if (!p || !p.type) return "";

    // Notion DBの「内容」は多くの場合 rich_text か title（実体は同じく配列）
    if (p.type === "rich_text"){
      const arr = p.rich_text || [];
      return arr.map(x => x && x.plain_text ? x.plain_text : "").join("");
    }
    if (p.type === "title"){
      const arr = p.title || [];
      return arr.map(x => x && x.plain_text ? x.plain_text : "").join("");
    }

    // 念のため：他の型にも軽く対応
    if (p.type === "text"){
      const arr = p.text || [];
      return arr.map(x => x && x.plain_text ? x.plain_text : "").join("");
    }

    // 未対応型は空（事故らせない）
    return "";
  } catch(e){
    return "";
  }
}

function run_showOpenAiConfig(){
  const props = PropertiesService.getScriptProperties();
  const key = String(props.getProperty("OPENAI_API_KEY") || "").trim();
  const model = String(props.getProperty("OPENAI_MODEL") || "").trim();

  const out = {
    apiKeyLooksSet: key ? (key.slice(0,4) + "..." + key.slice(-4)) : "",
    model: model || "(not set)"
  };

  Logger.log(JSON.stringify(out, null, 2));
  return out;
}

//debug
// 実行UI用：最新5件だけで dry（ログに結果を出す）
function run_syncNotionMinutes_dry_5(){
  const res = admin_syncNotionMinutesToProtocolCandidates({ dryRun:true, limit: 5 });
  Logger.log("[dry_5]\n" + JSON.stringify(res, null, 2));
  return res;
}

// 実行UI用：最新5件だけで prod（書き込み、ログに結果を出す）
function run_syncNotionMinutes_prod_5(){
  const res = admin_syncNotionMinutesToProtocolCandidates({ dryRun:false, limit: 20 });
  Logger.log("[prod_5]\n" + JSON.stringify(res, null, 2));
  return res;
}

// Notion議事録DBから「内容」プロパティが入ってるページを探す（最初のK件を走査）
function run_debug_find_minutes_with_content(){
  const props = PropertiesService.getScriptProperties();
  const notionToken = String(props.getProperty("NOTION_TOKEN") || "").trim();
  const notionDbRaw = String(props.getProperty("NOTION_DATABASE_ID") || "").trim();

  const scan = 50; // まず50件だけ
  const dbRes = _notion_queryMinutesSinceFull_(notionToken, notionDbRaw, ""); // 全件対象
  const pages = (dbRes && Array.isArray(dbRes.pages)) ? dbRes.pages : [];

  let hit = null;

  for (let i=0; i<Math.min(scan, pages.length); i++){
    const p = pages[i];
    const pageId = String(p.id || "").trim();
    const text = _notion_extractPropertyText_(p, "内容");
    const len = String(text || "").trim().length;

    if (len >= 50){
      hit = {
        index: i,
        pageId,
        lastEdited: String(p.last_edited_time || ""),
        contentLen: len,
        head: String(text || "").slice(0, 400)
      };
      break;
    }
  }

  const out = hit ? { ok:true, found: hit } : { ok:false, message:`No page with 内容 in first ${Math.min(scan, pages.length)} pages` };
  Logger.log("[find_with_content]\n" + JSON.stringify(out, null, 2));
  return out;
}
// デバッグ：最新の「内容あり」1件だけでLLM抽出して、結果だけログに出す（DBには書かない）
function run_debug_extract_one_candidate_dry(){
  const props = PropertiesService.getScriptProperties();
  const notionToken = String(props.getProperty("NOTION_TOKEN") || "").trim();
  const notionDbRaw = String(props.getProperty("NOTION_DATABASE_ID") || "").trim();

  const dbRes = _notion_queryMinutesSinceFull_(notionToken, notionDbRaw, "");
  const pages = (dbRes && Array.isArray(dbRes.pages)) ? dbRes.pages : [];
  if (!pages.length) return { ok:false, message:"no pages" };

  // 最新順になってる前提（descendingにしたので）
  const p = pages[0];
  const pageId = String(p.id || "").trim();
  const lastEdited = String(p.last_edited_time || "").trim();
  const minutesText = _notion_extractPropertyText_(p, "内容");

  const out = {
    ok:true,
    pageId,
    lastEdited,
    contentLen: String(minutesText || "").length
  };

  // LLM抽出（dry: DB書き込みなし）
  // ★Context注入（global + projectId）
  // ここで使ったContextは candidate行にも記録する
  const contexts = _pc_pickLLMContextFor_(storeId, suggestedProjectId, 60);
  const injectedContextIds = contexts.map(x => String(x.contextId||"").trim()).filter(x=>x);
  const injectedContextText = _pc_buildContextInjectionText_(contexts);

  // ★metaに “contextText” を渡す（system側で使う）
  const extracted = _openai_extractProtocolCandidates_(String(minutesText), {
    pageId,
    lastEdited,
    contextText: injectedContextText
  });

  const promptVersion = "v3_ctx1"; // 運用で増やす


  const preview = (extracted || []).slice(0, 5); // 先頭5件だけ表示
  Logger.log("[extract_one]\n" + JSON.stringify({
    meta: out,
    count: (extracted || []).length,
    preview: preview
  }, null, 2));

  return { ok:true, count: (extracted || []).length };
}

function _notion_extractRelationIds_(pageObj, propName){
  try{
    const props = (pageObj && pageObj.properties) ? pageObj.properties : null;
    if (!props) return [];

    // 1) まず指定名で直引き（従来互換）
    if (propName){
      const p0 = props[propName];
      if (p0 && p0.type === "relation"){
        const rel0 = Array.isArray(p0.relation) ? p0.relation : [];
        return rel0.map(x => String(x && x.id ? x.id : "").trim()).filter(x=>x);
      }
    }

    // 2) フォールバック：名前に「PJ」を含む relation プロパティを探す
    //    例: "🍭 PJ", "PJ", "PJ（案件）" などを救う
    const keys = Object.keys(props);
    for (let i=0; i<keys.length; i++){
      const key = keys[i];
      if (key.indexOf("PJ") < 0) continue;

      const p = props[key];
      if (!p || p.type !== "relation") continue;

      const rel = Array.isArray(p.relation) ? p.relation : [];
      const ids = rel.map(x => String(x && x.id ? x.id : "").trim()).filter(x=>x);
      if (ids.length) return ids;
    }

    return [];
  } catch(e){
    return [];
  }
}

// relation先ページのタイトルを解決（簡易キャッシュ）
function _notion_resolvePageTitleCached_(token, pageId){
  const raw = String(pageId||"").trim();
  if (!raw) return "";

  // ★Notion id 正規化（ハイフン有/無どっちでもOKに）
  const idNorm = _notion_normId_(raw) || raw.replace(/-/g,"");
  if (!idNorm) return "";

  const cache = CacheService.getScriptCache();
  const key = "notion:title:" + idNorm;
  try{
    const cached = cache.get(key);
    if (cached !== null && cached !== undefined) return cached;
  } catch(e){}

  const url = "https://api.notion.com/v1/pages/" + idNorm; // encode不要（hexだけ）
  const res = _notion_fetch_(token, url, "get", null);

  let title = "";
  try{
    const props = res && res.properties ? res.properties : {};
    for (const k in props){
      const p = props[k];
      if (p && p.type === "title"){
        const arr = Array.isArray(p.title) ? p.title : [];
        title = arr.map(x => x && x.plain_text ? x.plain_text : "").join("").trim();
        if (title) break;
      }
    }
  } catch(e){
    title = "";
  }

  try{ cache.put(key, title || "", 6*60*60); } catch(e){}
  return title || "";
}

// AMDのDB_Projects(projectName)から projectId を引く（ローカル実装）
function _resolveAmdProjectIdByProjectName_(projectName){
  const name = String(projectName||"").trim();
  if (!name) return "";

  try{
    const sh = b_ss_().getSheetByName("DB_Projects");
    if (!sh) return "";

    const vals = sh.getDataRange().getValues();
    if (!vals || vals.length < 2) return "";

    const h = vals[0].map(x=>String(x||"").trim());
    const iPid = h.indexOf("projectId");
    const iPn  = h.indexOf("projectName");
    if (iPid < 0 || iPn < 0) return "";

    const low = name.toLowerCase();

    // 完全一致（大小無視）
    for (let r=1; r<vals.length; r++){
      const pn = String(vals[r][iPn]||"").trim();
      if (pn && pn.toLowerCase() === low){
        return String(vals[r][iPid]||"").trim();
      }
    }
    // 部分一致（保険）
    for (let r=1; r<vals.length; r++){
      const pn = String(vals[r][iPn]||"").trim();
      if (pn && pn.toLowerCase().includes(low)){
        return String(vals[r][iPid]||"").trim();
      }
    }

    return "";
  } catch(e){
    return "";
  }
}

// Notionのpage objectからtitleっぽいものを推定（安全に）
function _notion_guessPageTitle_(pageObj){
  try{
    const props = (pageObj && pageObj.properties) ? pageObj.properties : null;
    if (!props) return "";
    for (const k in props){
      const p = props[k];
      if (p && p.type === "title"){
        const arr = Array.isArray(p.title) ? p.title : [];
        return arr.map(x => x && x.plain_text ? x.plain_text : "").join("").trim();
      }
    }
    return "";
  } catch(e){
    return "";
  }
}

/**
 * alias表（まさが貼ったやつ）からPJを推定する
 * - header: alias / pjCode / priority / matchType / note
 * - pjCode が EXCLUDE のときは EXCLUDE を返す
 */
function _inferProjectIdFromAlias_(titleText, minutesText){
  const rules = _loadAliasRulesOnce_();
  if (!rules.length) return null;

  const hay = (String(titleText||"") + "\n" + String(minutesText||"")).toLowerCase();

  for (let i=0; i<rules.length; i++){
    const r = rules[i];
    if (!r.aliasLower) continue;

    let hit = false;
    if (r.matchType === "equals") hit = (hay.trim() === r.aliasLower);
    else hit = hay.includes(r.aliasLower); // contains default

    if (!hit) continue;

    if (r.pjCode === "EXCLUDE"){
      return { projectId:"EXCLUDE", projectName:"EXCLUDE" };
    }

    const pid = _resolveAmdProjectIdByProjectNameOrCode_(r.pjCode);
    if (pid){
      return { projectId: pid, projectName: r.pjCode };
    }
    // pjCodeはあるのにDB_Projectsが見つからない場合でも、空欄回避
    return { projectId:"unknown", projectName:r.pjCode };
  }

  return null;
}

// 1実行中だけキャッシュ（毎ページ読まない）
let __ALIAS_RULES__ = null;

function _loadAliasRulesOnce_(){
  if (__ALIAS_RULES__) return __ALIAS_RULES__;

  const ss = b_ss_();
  const sheets = ss.getSheets();

  let sh = null;
  let header = null;

  for (let i=0; i<sheets.length; i++){
    const t = sheets[i];
    const lastCol = t.getLastColumn();
    if (lastCol < 4) continue;

    const h = t.getRange(1,1,1,lastCol).getValues()[0].map(x=>String(x||"").trim());
    if (h.indexOf("alias")>=0 && h.indexOf("pjCode")>=0 && h.indexOf("priority")>=0 && h.indexOf("matchType")>=0){
      sh = t;
      header = h;
      break;
    }
  }

  if (!sh){ __ALIAS_RULES__ = []; return __ALIAS_RULES__; }

  const idx = {};
  header.forEach((x,i)=>{ if(x) idx[x]=i; });

  const lastRow = sh.getLastRow();
  if (lastRow < 2){ __ALIAS_RULES__ = []; return __ALIAS_RULES__; }

  const vals = sh.getRange(2,1,lastRow-1,header.length).getValues();

  function s_(v){ return String(v===null||v===undefined?"":v).trim(); }
  function n_(v){ const x=Number(v); return isFinite(x)?x:0; }

  const rules = vals.map(row=>{
    const alias = s_(row[idx["alias"]]);
    const pjCode = s_(row[idx["pjCode"]]);
    if (!alias || !pjCode) return null;
    return {
      alias: alias,
      aliasLower: alias.toLowerCase(),
      pjCode: pjCode,
      priority: n_(row[idx["priority"]]),
      matchType: s_(row[idx["matchType"]]||"contains").toLowerCase()
    };
  }).filter(x=>x);

  // priority desc
  rules.sort((a,b)=>(b.priority||0)-(a.priority||0));

  __ALIAS_RULES__ = rules;
  return __ALIAS_RULES__;
}

// DB_Projects(projectName)から projectId を引く（拡張：projectCode/pjCode列も見る）
function _resolveAmdProjectIdByProjectNameOrCode_(nameOrCode){
  const key = String(nameOrCode||"").trim();
  if (!key) return "";

  try{
    const sh = b_ss_().getSheetByName("DB_Projects");
    if (!sh) return "";

    const vals = sh.getDataRange().getValues();
    if (!vals || vals.length < 2) return "";

    const h = vals[0].map(x=>String(x||"").trim());
    const iPid = h.indexOf("projectId");
    const iPn  = h.indexOf("projectName");
    const iCode = (h.indexOf("projectCode")>=0) ? h.indexOf("projectCode")
               : (h.indexOf("pjCode")>=0) ? h.indexOf("pjCode")
               : -1;

    if (iPid < 0) return "";

    const low = key.toLowerCase();

    // code完全一致
    if (iCode >= 0){
      for (let r=1; r<vals.length; r++){
        const c = String(vals[r][iCode]||"").trim();
        if (c && c.toLowerCase() === low) return String(vals[r][iPid]||"").trim();
      }
    }

    // name完全一致
    if (iPn >= 0){
      for (let r=1; r<vals.length; r++){
        const pn = String(vals[r][iPn]||"").trim();
        if (pn && pn.toLowerCase() === low) return String(vals[r][iPid]||"").trim();
      }
    }

    // name部分一致（保険）
    if (iPn >= 0){
      for (let r=1; r<vals.length; r++){
        const pn = String(vals[r][iPn]||"").trim();
        if (pn && pn.toLowerCase().includes(low)) return String(vals[r][iPid]||"").trim();
      }
    }

    return "";
  } catch(e){
    return "";
  }
}

function debug_runNotionSyncOnce(){
  const res = admin_syncNotionMinutesToProtocolCandidates({ dryRun:false, limit: 5 });
  console.log(JSON.stringify(res, null, 2));
  return res;
}

function debug_pjResolveTrace(){
  const props = PropertiesService.getScriptProperties();
  const notionToken = String(props.getProperty("NOTION_TOKEN") || "").trim();
  const notionDbRaw = String(props.getProperty("NOTION_DATABASE_ID") || "").trim();

  const dbRes = _notion_queryMinutesSinceFull_(notionToken, notionDbRaw, "");
  const pages = (dbRes && Array.isArray(dbRes.pages)) ? dbRes.pages : [];
  if (!pages.length) return { ok:false, message:"no pages" };

  // ★PJ relation が「入ってる」ページを最大50件スキャンして探す
  let p = null;
  let found = null;

  for (let i=0; i<Math.min(50, pages.length); i++){
    const cand = pages[i];
    const propsObj = (cand && cand.properties) ? cand.properties : null;
    if (!propsObj) continue;

    const keys = Object.keys(propsObj);

    // "PJ" を含む relation プロパティで、relation配列が非空のやつを探す
    for (let k=0; k<keys.length; k++){
      const key = keys[k];
      if (key.indexOf("PJ") < 0) continue;

      const pr = propsObj[key];
      if (!pr || pr.type !== "relation") continue;

      const rel = Array.isArray(pr.relation) ? pr.relation : [];
      const ids = rel.map(x => String(x && x.id ? x.id : "").trim()).filter(x=>x);

      if (ids.length){
        p = cand;
        found = { propKey: key, relIds: ids };
        break;
      }
    }
    if (p) break;
  }

  // 見つからない場合は「プロパティ一覧」だけ吐く（なぜ見つからないか確定できる）
  if (!p){
    const sample = pages[0];
    const propsObj = sample && sample.properties ? sample.properties : {};
    const keys = Object.keys(propsObj);
    const summary = keys.map(k => ({ key:k, type: propsObj[k] ? propsObj[k].type : null }));
    console.log(JSON.stringify({
      ok:false,
      message:"No page with non-empty PJ relation found in first 50 pages",
      samplePageId: String(sample && sample.id || ""),
      propKeys: summary
    }, null, 2));
    return { ok:false, message:"no non-empty PJ relation found" };
  }

  const pageId = String(p.id||"");
  const pageTitle = _notion_guessPageTitle_(p);

  const minutesText = _notion_extractPropertyText_(p, "内容");
  const minutesLen = String(minutesText||"").length;

  const relTitle = (found.relIds && found.relIds[0])
    ? _notion_resolvePageTitleCached_(notionToken, found.relIds[0])
    : "";

  const inferred = _resolveSuggestedProject_(notionToken, p, String(minutesText||""));

  // ★プロパティ一覧（キーと型）も出す："🍭 PJ" を本当に持ってるか確定できる
  const propsObj = p && p.properties ? p.properties : {};
  const keys = Object.keys(propsObj);
  const propSummary = keys.map(k => ({ key:k, type: propsObj[k] ? propsObj[k].type : null }));

  console.log(JSON.stringify({
    pageId,
    pageTitle,
    minutesLen,
    pjPropPickedKey: found.propKey,
    pjRelIds: found.relIds,
    relTitle,
    inferred,
    propKeys: propSummary
  }, null, 2));

  return { ok:true, pageId: pageId, pjKey: found.propKey };
}

function debug_fetchPageAndShowPj(){
  const props = PropertiesService.getScriptProperties();
  const notionToken = String(props.getProperty("NOTION_TOKEN") || "").trim();
  const notionDbRaw = String(props.getProperty("NOTION_DATABASE_ID") || "").trim();

  const dbRes = _notion_queryMinutesSinceFull_(notionToken, notionDbRaw, "");
  const pages = (dbRes && Array.isArray(dbRes.pages)) ? dbRes.pages : [];
  if (!pages.length) return { ok:false, message:"no pages" };

  const p0 = pages[0];
  const pageId = String(p0.id||"").trim();

  // ★query結果のPJ
  const pjInQuery = (p0.properties && p0.properties["PJ"]) ? p0.properties["PJ"] : null;

  // ★ページ詳細をGETしてPJを見る
  const url = "https://api.notion.com/v1/pages/" + encodeURIComponent(pageId);
  const full = _notion_fetch_(notionToken, url, "get", null);
  const pjInGet = (full.properties && full.properties["PJ"]) ? full.properties["PJ"] : null;

  console.log(JSON.stringify({
    pageId,
    title: _notion_guessPageTitle_(p0),
    pj_in_query: pjInQuery,
    pj_in_get: pjInGet
  }, null, 2));

  return { ok:true, pageId };
}

function _pc_listRecentRejectFeedback_(spreadsheetId, limit){
  const out = [];
  const lim = (limit !== undefined && limit !== null) ? Number(limit||0) : 30;

  try{
    const ss = SpreadsheetApp.openById(spreadsheetId);
    const sh = ss.getSheetByName("DB_ProtocolRejectFeedback");
    if (!sh) return out;

    const lastRow = sh.getLastRow();
    const lastCol = sh.getLastColumn();
    if (lastRow < 2) return out;

    const vals = sh.getRange(1,1,lastRow,lastCol).getValues();
    const h = vals[0].map(x=>String(x||"").trim());
    const idx = {};
    h.forEach((x,i)=>{ if(x) idx[x]=i; });

    function get_(row, name){
      const i = idx[name];
      if (i === undefined) return "";
      return row[i];
    }
    function s_(v){ return String(v===null||v===undefined?"":v).trim(); }

    // 末尾から新しい順に拾う（appendRow想定）
    for (let r=vals.length-1; r>=1; r--){
      const row = vals[r];
      const reason = s_(get_(row,"reason"));
      if (!reason) continue;

      out.push({
        rejectedAt: s_(get_(row,"rejectedAt")),
        branchPoint: s_(get_(row,"branchPoint")),
        criteria: s_(get_(row,"criteria")),
        decision: s_(get_(row,"decision")),
        reason: reason
      });

      if (lim > 0 && out.length >= lim) break;
    }

    return out;
  } catch(e){
    return out;
  }
}

function _pc_suggestIssueTagsFromText_(minutesText){
  const t = String(minutesText||"").toLowerCase();
  const tags = [];

  function add_(tag){ if (tags.indexOf(tag) < 0) tags.push(tag); }

  // 超軽量ヒューリスティック（あとで増やせる）
  if (t.includes("ceo") || t.includes("代表") || t.includes("社長") || t.includes("経営者")) add_("CEO");
  if (t.includes("採用") || t.includes("採る") || t.includes("人材") || t.includes("リクル")) add_("採用");
  if (t.includes("資本政策") || t.includes("cap table") || t.includes("希薄") || t.includes("株主") || t.includes("持分")) add_("資本政策");
  if (t.includes("資金調達") || t.includes("vc") || t.includes("投資") || t.includes("ラウンド") || t.includes("term")) add_("資金調達");
  if (t.includes("共同研究") || t.includes("委託研究") || t.includes("契約") || t.includes("n da") || t.includes("nda") || t.includes("ライセンス")) add_("契約");
  if (t.includes("poc") || t.includes("実証") || t.includes("試験") || t.includes("プロトタイプ")) add_("PoC");

  return tags;
}

function _pc_pickActiveExtractorPrompts_(storeId, selector, opt){
  opt = opt || {};
  const groupName = String(opt.groupName || (selector && selector.groupName) || "protocol_extract").trim();
  const maxAddons = (opt.maxAddons !== undefined && opt.maxAddons !== null) ? Number(opt.maxAddons||0) : 3;

  const out = {
    base: null,
    addons: [],
    pickedMeta: {
      groupName,
      selector: selector || {},
      maxAddons
    }
  };

  try{
    const ss = SpreadsheetApp.openById(storeId);
    const sh = ss.getSheetByName("DB_LLMExtractorConfig");
    if (!sh) return out;

    const lastRow = sh.getLastRow();
    const lastCol = sh.getLastColumn();
    if (lastRow < 2) return out;

    const vals = sh.getRange(1,1,lastRow,lastCol).getValues();
    const h = vals[0].map(x=>String(x||"").trim());
    const idx = {};
    h.forEach((x,i)=>{ if(x) idx[x]=i; });

    function g_(row, key){ const i = idx[key]; return (i===undefined) ? "" : row[i]; }
    function s_(v){ return String(v===null||v===undefined?"":v).trim(); }
    function sl_(v){ return s_(v).toLowerCase(); }
    function n_(v){ const x = Number(v); return isFinite(x) ? x : 0; }

    const selProjectId = String(selector && selector.projectId || "").trim();
    const selProjectCode = String(selector && selector.projectCode || "").trim();
    const selGenre = String(selector && selector.genre || "").trim();
    const selTags = Array.isArray(selector && selector.issueTags) ? selector.issueTags.map(x=>String(x||"").trim()).filter(x=>x) : [];

    function parseTags_(csv){
      return String(csv||"").split(",").map(x=>String(x||"").trim()).filter(x=>x);
    }
    function hasIntersection_(a, b){
      if (!a || !a.length || !b || !b.length) return false;
      const set = Object.create(null);
      a.forEach(x=>{ set[String(x||"")] = 1; });
      for (let i=0; i<b.length; i++){
        if (set[String(b[i]||"")]) return true;
      }
      return false;
    }

    function groupMatches_(row){
      const nm = s_(g_(row,"name")) || "protocol_extract";
      const cg = s_(g_(row,"composeGroup"));
      const group = cg || nm;
      return group === groupName;
    }

    function scopeMatches_(row){
      const scT = sl_(g_(row,"scopeType")) || "global";
      const scK = s_(g_(row,"scopeKey"));

      if (scT === "global") return true;
      if (scT === "projectid") return !!selProjectId && scK === selProjectId;
      if (scT === "projectcode") return !!selProjectCode && scK === selProjectCode;
      if (scT === "genre") return !!selGenre && scK === selGenre;
      return false;
    }

    function normalizeKind_(k){
      const x = sl_(k);
      if (x === "base" || x === "addon" || x === "reference") return x;
      return "base";
    }

    const rows = [];
    for (let r=1; r<vals.length; r++){
      const row = vals[r];
      const id = s_(g_(row,"configId"));
      if (!id) continue;

      if (!groupMatches_(row)) continue;

      const st = sl_(g_(row,"status"));
      if (st && st !== "active") continue;

      if (!scopeMatches_(row)) continue;

      const kind = normalizeKind_(g_(row,"kind"));
      const pri = n_(g_(row,"priority"));
      const maxChars = n_(g_(row,"maxChars"));
      const version = s_(g_(row,"version"));
      const sys = s_(g_(row,"systemPrompt"));
      const tagCsv = s_(g_(row,"tags"));
      const tagList = parseTags_(tagCsv);

      rows.push({
        configId: id,
        name: s_(g_(row,"name")) || "protocol_extract",
        composeGroup: s_(g_(row,"composeGroup")),
        status: st || "active",
        kind,
        scopeType: sl_(g_(row,"scopeType")) || "global",
        scopeKey: s_(g_(row,"scopeKey")),
        tags: tagList,
        priority: pri,
        maxChars,
        version,
        systemPrompt: sys,
        note: s_(g_(row,"note")),
        createdAt: s_(g_(row,"createdAt")),
        updatedAt: s_(g_(row,"updatedAt"))
      });
    }

    // base: 1つ
    const baseCandidates = rows.filter(x=>x.kind === "base");
    baseCandidates.sort((a,b)=>{
      if ((b.priority||0) !== (a.priority||0)) return (b.priority||0) - (a.priority||0);

      // ちょいだけ特異性優先：projectId > projectCode > genre > global
      function spec_(x){
        const t = String(x.scopeType||"");
        if (t === "projectid") return 4;
        if (t === "projectcode") return 3;
        if (t === "genre") return 2;
        return 1;
      }
      return spec_(b) - spec_(a);
    });

    if (baseCandidates.length){
      const b0 = baseCandidates[0];
      let txt = String(b0.systemPrompt||"");
      if (b0.maxChars > 0 && txt.length > b0.maxChars) txt = txt.slice(0, b0.maxChars);
      out.base = Object.assign({}, b0, { systemPrompt: txt });
    }

    // addon: 最大N
    const addonCandidates = rows.filter(x=>x.kind === "addon");

    // tags付きaddonは、selTagsが空なら原則スキップ（暴発防止）
    const addonsFiltered = addonCandidates.filter(x=>{
      if (!x.tags || !x.tags.length) return true;
      if (!selTags || !selTags.length) return false;
      return hasIntersection_(x.tags, selTags);
    });

    addonsFiltered.sort((a,b)=>{
      if ((b.priority||0) !== (a.priority||0)) return (b.priority||0) - (a.priority||0);
      return String(b.updatedAt||"").localeCompare(String(a.updatedAt||""));
    });

    const take = (maxAddons > 0) ? addonsFiltered.slice(0, maxAddons) : addonsFiltered;
    out.addons = take.map(x=>{
      let txt = String(x.systemPrompt||"");
      if (x.maxChars > 0 && txt.length > x.maxChars) txt = txt.slice(0, x.maxChars);
      return Object.assign({}, x, { systemPrompt: txt });
    });

    return out;
  } catch(e){
    return out;
  }
}

function run_showNotionMinutesDateProp(){
  const props = PropertiesService.getScriptProperties();
  const dateProp = String(props.getProperty("NOTION_MINUTES_DATE_PROP") || "日付").trim();
  const out = { ok:true, NOTION_MINUTES_DATE_PROP: dateProp };
  Logger.log(JSON.stringify(out, null, 2));
  return out;
}

function run_setupProtocolExtractLlmConfigs(){
  var configs = [
    {
      usageKey: "protocol_extract",
      provider: "anthropic",
      model: "claude-opus-4-5-20251101",
      maxTokens: 2000,
      temperature: 0.3,
      notes: "Notionプロトコル候補抽出"
    },
    {
      usageKey: "navigator_extract",
      provider: "anthropic",
      model: "claude-opus-4-5-20251101",
      maxTokens: 2000,
      temperature: 0.3,
      notes: "Navigator月次アイテム抽出"
    },
    {
      usageKey: "navigator_monthly_summary",
      provider: "anthropic",
      model: "claude-opus-4-5-20251101",
      maxTokens: 2000,
      temperature: 0.3,
      notes: "Navigator月次サマリ生成"
    }
  ];
  var results = configs.map(function(c){ return admin_upsertLlmModelConfig(c); });
  Logger.log(JSON.stringify(results, null, 2));
  return results;
}

function run_debug_notion_minutes_by_ym(){
  const props = PropertiesService.getScriptProperties();
  const token = String(props.getProperty("NOTION_TOKEN") || "").trim();
  const dbId  = String(props.getProperty("NOTION_DATABASE_ID") || "").trim();
  const dateProp = String(props.getProperty("NOTION_MINUTES_DATE_PROP") || "日付").trim();

  if (!token) return { ok:false, message:"NOTION_TOKEN missing" };
  if (!dbId) return { ok:false, message:"NOTION_DATABASE_ID missing" };

  // テストしやすいように「今月」
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const ym = `${y}-${m}`;

  // Repo側で作ったロジックと同等にym→月初/月末を作る
  function toDateStr_(dt){
    const yy = dt.getUTCFullYear();
    const mm = String(dt.getUTCMonth()+1).padStart(2,"0");
    const dd = String(dt.getUTCDate()).padStart(2,"0");
    return `${yy}-${mm}-${dd}`;
  }
  const start = new Date(Date.UTC(y, Number(m)-1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(y, Number(m), 1, 0, 0, 0));
  const startStr = toDateStr_(start);
  const endStr = toDateStr_(end);

  const norm = _notion_normId_(dbId);
  const url = "https://api.notion.com/v1/databases/" + norm + "/query";

  const payload = {
    sorts: [{ timestamp:"last_edited_time", direction:"descending" }],
    filter: {
      property: dateProp,
      date: { on_or_after: startStr, before: endStr }
    }
  };

  let res;
  try{
    res = _notion_fetch_(token, url, "post", payload);
  } catch(e){
    const msg = String(e && (e.message || e) ? (e.message || e) : e);
    const outErr = { ok:false, ym, dateProp, startStr, endStr, error: msg };
    Logger.log(JSON.stringify(outErr, null, 2));
    return outErr;
  }

  const results = res.results || [];
  const head = results.slice(0, 5).map(p => ({
    pageId: String(p.id||""),
    title: _notion_guessPageTitle_(p),
    lastEdited: String(p.last_edited_time||""),
    datePropType: p.properties && p.properties[dateProp] ? p.properties[dateProp].type : "(missing)",
    dateValue: p.properties && p.properties[dateProp] && p.properties[dateProp].date ? p.properties[dateProp].date : null,
    eventId: p.properties && p.properties["eventId"] ? p.properties["eventId"] : null
  }));

  const out = { ok:true, ym, dateProp, startStr, endStr, count: results.length, head };
  Logger.log(JSON.stringify(out, null, 2));
  return out;
}

// ---------------- OpenAI client (Navigator Monthly Extract) ----------------
function _openai_extractNavigatorMonthlyItems_(minutesText, meta){
  meta = meta || {};
  const storeId = String(PropertiesService.getScriptProperties().getProperty("PROTOCOL_STORE_SPREADSHEET_ID") || "").trim();
  if (!storeId) throw new Error("PROTOCOL_STORE_SPREADSHEET_ID missing");
  _pc_ensureStoreSheets_(storeId);

  const groupName = String(meta.groupName || "navigator_extract").trim();
  const projectId = String(meta.projectId || "").trim();
  const ym = String(meta.ym || "").trim();

  let injectedContextText = "";
  try{
    const contexts = _pc_pickLLMContextFor_(storeId, projectId, 40);
    injectedContextText = _pc_buildContextInjectionText_(contexts);
  } catch(e){ injectedContextText = ""; }

  let issueTags = [];
  try{ issueTags = _pc_suggestIssueTagsFromText_(String(minutesText||"")); } catch(e){}

  const selector = {
    groupName: groupName,
    projectId: projectId,
    projectCode: "",
    genre: "",
    issueTags: Array.isArray(issueTags) ? issueTags : []
  };

  let picked = { base:null, addons:[] };
  try{ picked = _pc_pickActiveExtractorPrompts_(storeId, selector, { groupName: groupName, maxAddons: 3 }); }
  catch(e){}

  const fallbackBase = [
    "あなたはAMD OSのNavigator Monthly Extract抽出器。",
    "入力は、あるPJの議事録テキスト（1か月分）。",
    "月次の進捗として意味のある「事実候補」だけを抽出して items にする。",
    "各要素は { itemType: decided|progress|nextAction|risk, body: ... }。",
    "最大20件。重要順。推測で埋めない。"
  ].join("\n");

  const baseText = (picked && picked.base && picked.base.systemPrompt)
    ? String(picked.base.systemPrompt || "").trim()
    : fallbackBase;

  const addonTexts = (picked && picked.addons && picked.addons.length)
    ? picked.addons.map(x => String(x.systemPrompt||"").trim()).filter(x=>x)
    : [];

  const composedRules = [
    "=== Extractor Rules (BASE) ===",
    baseText,
    "=== end ==="
  ].concat(
    addonTexts.length
      ? ["", "=== Extractor Rules (ADDONS) ==="]
          .concat(addonTexts.map((t,i)=>[`[addon#${i+1}]`, t].join("\n")))
          .concat(["=== end ==="])
      : []
  ).join("\n");

  const systemPrompt = [
    composedRules,
    "",
    "=== 注入コンテキスト（参考情報） ===",
    injectedContextText ? injectedContextText : "(no context)",
    "=== end ===",
    "",
    '出力は必ず以下のJSONのみ（説明文禁止）: {"items":[{"itemType":"decided","body":"..."}]}'
  ].join("\n");

  const userPrompt = [
    "extractor: navigator_monthly_items",
    "projectId: " + projectId,
    "ym: " + ym,
    "issueTags: " + (issueTags.length ? issueTags.join(",") : ""),
    "",
    "=== minutes ===",
    String(minutesText || "")
  ].join("\n");

  const raw = llm_callJson("navigator_extract", systemPrompt, userPrompt, { maxTokens: 2000 });
  const rawItems = (raw && Array.isArray(raw.items)) ? raw.items : [];
  const allow = new Set(["decided","progress","nextAction","risk"]);

  const cleaned = [];
  for (let i=0; i<rawItems.length; i++){
    const it = rawItems[i] || {};
    let t = String(it.itemType || "").trim();
    let b = String(it.body || "").trim();
    if (!b) continue;
    if (!allow.has(t)){
      const low = t.toLowerCase();
      t = allow.has(low) ? low : "progress";
    }
    cleaned.push({ itemType: t, body: b, sourceType: "notion", sourceRef: "" });
    if (cleaned.length >= 20) break;
  }
  return cleaned;
}

// ---------------- OpenAI client (Navigator Monthly Summary) ----------------
function _openai_extractNavigatorMonthlySummary_(inputObj, meta){
  meta = meta || {};
  inputObj = inputObj || {};

  const minutesText = String(inputObj.minutesText || "");
  const planText = String(inputObj.planText || "");
  const prevConfirmedSummary = String(inputObj.prevConfirmedSummary || "");

  const storeId = String(PropertiesService.getScriptProperties().getProperty("PROTOCOL_STORE_SPREADSHEET_ID") || "").trim();
  if (!storeId) throw new Error("PROTOCOL_STORE_SPREADSHEET_ID missing");
  _pc_ensureStoreSheets_(storeId);

  const groupName = String(meta.groupName || "navigator_monthly_summary").trim();
  const projectId = String(meta.projectId || "").trim();
  const ym = String(meta.ym || "").trim();

  let injectedContextText = "";
  try{
    const contexts = _pc_pickLLMContextFor_(storeId, projectId, 40);
    injectedContextText = _pc_buildContextInjectionText_(contexts);
  } catch(e){ injectedContextText = ""; }

  let humanFixText = "";
  try{
    if (typeof nav_repo_listRecentMonthlyEditsForFeedback_ === "function" && projectId){
      const edits = nav_repo_listRecentMonthlyEditsForFeedback_(projectId, 12);
      if (edits && edits.length){
        humanFixText = edits.map((x,i)=>{
          const fk = String(x.fieldKey||"");
          const afterText = String(x.afterText||"").trim();
          const note = String(x.note||"").trim();
          const cut = afterText.length > 220 ? (afterText.slice(0,220)+"…") : afterText;
          return [`#${i+1} field:${fk}`, note?`note:${note}`:"", `preferred:${cut}`].filter(s=>s).join(" | ");
        }).join("\n");
      }
    }
  } catch(e){ humanFixText = ""; }

  let issueTags = [];
  try{ issueTags = _pc_suggestIssueTagsFromText_(String(minutesText||"")); } catch(e){}

  const selector = {
    groupName: groupName,
    projectId: projectId,
    projectCode: "",
    genre: "",
    issueTags: Array.isArray(issueTags) ? issueTags : []
  };

  let picked = { base:null, addons:[] };
  try{ picked = _pc_pickActiveExtractorPrompts_(storeId, selector, { groupName: groupName, maxAddons: 3 }); }
  catch(e){}

  const fallbackBase = [
    "あなたはAMD OSのNavigator『月次サマリ』生成器。",
    "入力は、(1)議事録本文 (2)今月の予定 (3)前月確定サマリ（あれば）。",
    "monthlySummary は200〜400字。誇張しない。",
    "gapToPlan は今月の予定との差分。nextMeetingDecisions は次回定例で決めるべき論点。",
    "openQuestions は詰まり/未解決。risks はリスク。nextMeetingAdvice は次回これ決めないと詰む助言。",
    "過去に人間が修正したポイント（Human Fixes）を優先して同じミスを避ける。"
  ].join("\n");

  const baseText = (picked && picked.base && picked.base.systemPrompt)
    ? String(picked.base.systemPrompt || "").trim()
    : fallbackBase;

  const addonTexts = (picked && picked.addons && picked.addons.length)
    ? picked.addons.map(x => String(x.systemPrompt||"").trim()).filter(x=>x)
    : [];

  const composedRules = [
    "=== Extractor Rules (BASE) ===",
    baseText,
    "=== end ==="
  ].concat(
    addonTexts.length
      ? ["", "=== Extractor Rules (ADDONS) ==="]
          .concat(addonTexts.map((t,i)=>[`[addon#${i+1}]`, t].join("\n")))
          .concat(["=== end ==="])
      : []
  ).join("\n");

  const systemPrompt = [
    composedRules,
    "",
    "=== 注入コンテキスト（参考情報） ===",
    injectedContextText ? injectedContextText : "(no context)",
    "=== end ===",
    "",
    "=== Human Fixes（過去に人間が修正した好み/注意点） ===",
    humanFixText ? humanFixText : "(none)",
    "=== end ===",
    "",
    '出力は必ず以下のJSONのみ（説明文禁止）:',
    '{"monthlySummary":"...","gapToPlan":["..."],"nextMeetingDecisions":["..."],"openQuestions":["..."],"risks":["..."],"nextMeetingAdvice":["..."]}'
  ].join("\n");

  const userPrompt = [
    "extractor: navigator_monthly_summary",
    "projectId: " + projectId,
    "ym: " + ym,
    "",
    "=== 今月の予定（正本） ===",
    planText || "(empty)",
    "",
    "=== 前月確定サマリ（あれば） ===",
    prevConfirmedSummary || "(none)",
    "",
    "=== 議事録（内容プロパティ連結） ===",
    minutesText || "(empty)"
  ].join("\n");

  const raw = llm_callJson("navigator_monthly_summary", systemPrompt, userPrompt, { maxTokens: 2000 });

  function arr_(v){ const a = Array.isArray(v)?v:[]; return a.map(x=>String(x||"").trim()).filter(x=>x); }

  return {
    monthlySummary: String((raw && raw.monthlySummary) || "").trim(),
    gapToPlan: arr_(raw && raw.gapToPlan),
    nextMeetingDecisions: arr_(raw && raw.nextMeetingDecisions),
    openQuestions: arr_(raw && raw.openQuestions),
    risks: arr_(raw && raw.risks),
    nextMeetingAdvice: arr_(raw && raw.nextMeetingAdvice)
  };
}

function run_debugNavigatorExtractOne(){
  const props = PropertiesService.getScriptProperties();
  const notionToken = String(props.getProperty("NOTION_TOKEN") || "").trim();
  const notionDbRaw = String(props.getProperty("NOTION_DATABASE_ID") || "").trim();

  if (!notionToken) return { ok:false, message:"NOTION_TOKEN missing" };
  if (!notionDbRaw) return { ok:false, message:"NOTION_DATABASE_ID missing" };

  const dbRes = _notion_queryMinutesSinceFull_(notionToken, notionDbRaw, "");
  const pages = (dbRes && Array.isArray(dbRes.pages)) ? dbRes.pages : [];
  if (!pages.length) return { ok:false, message:"no pages" };

  const p = pages[0];
  const minutesText = _notion_extractPropertyText_(p, "内容");
  const txt = String(minutesText||"").trim();
  if (txt.length < 20) return { ok:false, message:"minutesText too short" };

  // projectIdはテストなのでunknownでもOK（scope:global baseなら動く）
  const items = _openai_extractNavigatorMonthlyItems_(txt, {
    groupName: "navigator_extract",
    projectId: "unknown",
    ym: "000000"
  });

  const out = {
    ok:true,
    count: Array.isArray(items) ? items.length : -1,
    head: Array.isArray(items) ? items.slice(0, 5) : items
  };
  Logger.log(JSON.stringify(out, null, 2));
  return out;
}

// ===== Notion Minutes: find by eventId =====
// 議事録DB（NOTION_DATABASE_ID）から eventId が一致するページを1件返す
// return: { ok, pageId, url, title, lastEdited, props, contentTextHead }
function notion_getMinutesByEventId(payload){
  payload = payload || {};
  const eventId = String(payload.eventId || "").trim();
  if (!eventId) return { ok:false, message:"eventId empty" };

  const props = PropertiesService.getScriptProperties();
  const token = String(props.getProperty("NOTION_TOKEN") || "").trim();
  const dbRaw = String(props.getProperty("NOTION_DATABASE_ID") || "").trim(); // 議事録DB（正本）
  if (!token) return { ok:false, message:"NOTION_TOKEN missing" };
  if (!dbRaw) return { ok:false, message:"NOTION_DATABASE_ID missing" };

  // eventId プロパティ名は「eventId」で固定（まさのDB）
  const eventProp = "eventId";

  const dbId = _notion_normId_(dbRaw);
  if (!dbId) return { ok:false, message:"NOTION_DATABASE_ID invalid" };

  const url = "https://api.notion.com/v1/databases/" + dbId + "/query";

  // eventId は Notion側で text/rich_text になってる想定
  // どっちでも引っかかるように rich_text equals を使う
  const q = {
    page_size: 5,
    sorts: [{ timestamp:"last_edited_time", direction:"descending" }],
    filter: {
      property: eventProp,
      rich_text: { equals: eventId }
    }
  };

  let res = null;
  try{
    res = _notion_fetch_(token, url, "post", q);
  } catch(e){
    return { ok:false, message:"Notion query failed: " + String(e && (e.message || e) ? (e.message || e) : e) };
  }

  const pages = (res && Array.isArray(res.results)) ? res.results : [];
  if (!pages.length){
    return { ok:false, message:"minutes not found by eventId", eventId:eventId };
  }

  const p = pages[0];
  const pageId = String(p.id || "").trim();
  const lastEdited = String(p.last_edited_time || "").trim();
  const title = _notion_guessPageTitle_(p);

  // NotionのURL（idから組める）
  const clean = pageId ? String(pageId).replace(/-/g,"") : "";
  const pageUrl = clean ? ("https://www.notion.so/" + clean) : "";

  // いまは重すぎないよう先頭だけ（必要なら後で全文）
  let head = "";
  try{
    // pageの本文（blocks）は取れる範囲だけ
    head = _notion_pageToPlainText_(token, pageId, { maxDepth: 4, maxChars: 4000 }) || "";
    head = String(head).trim();
  } catch(e){
    head = "";
  }

  return {
    ok:true,
    eventId: eventId,
    pageId: pageId,
    url: pageUrl,
    title: title,
    lastEdited: lastEdited,
    contentTextHead: head
  };
}

function run_backfill_all_minutes() {
  const START_MS = Date.now();
  const TIMEOUT_MS = 5.5 * 60 * 1000; // 5分30秒で打ち切り

  const props = PropertiesService.getScriptProperties();
  const token = String(props.getProperty("NOTION_TOKEN") || "").trim();
  const dbId  = String(props.getProperty("NOTION_DATABASE_ID") || "").trim();

  // 処理済みpageIdをセットとして取得
  const done = _backfill_getDonePageIds_();

  // 全件取得（sinceIso=""で制限なし）
  const dbRes = _notion_queryMinutesSinceFull_(token, dbId, "");
  const pages = (dbRes && Array.isArray(dbRes.pages)) ? dbRes.pages : [];

  const result = { total: pages.length, skipped: 0, processed: 0, candidates: 0, timedOut: false, errors: [] };

  for (let i = 0; i < pages.length; i++) {
    if (Date.now() - START_MS > TIMEOUT_MS) {
      result.timedOut = true;
      break;
    }

    const p = pages[i];
    const pageId = String(p.id || "").replace(/-/g, "");
    const pageIdDash = String(p.id || "").trim();

    if (done.has(pageId) || done.has(pageIdDash)) {
      result.skipped++;
      continue;
    }

    try {
      // フォールバック込みでテキスト取得
      let text = _notion_extractPropertyText_(p, "内容");
      if (!text || String(text).trim().length < 10) {
        text = _notion_pageToPlainText_(token, pageIdDash, { maxDepth: 6, maxChars: 4000 });
      }
      if (!text || String(text).trim().length < 10) {
        result.skipped++;
        continue;
      }

      const extracted = _openai_extractProtocolCandidates_(text, [], "");
      const candidates = Array.isArray(extracted) ? extracted : [];
      const sinceIso = String((p.last_edited_time || p.created_time || "")).trim();

      _pc_saveCandidates_(candidates, pageIdDash, sinceIso, p);
      result.processed++;
      result.candidates += candidates.length;

    } catch(e) {
      result.errors.push({ pageId: pageIdDash, error: String(e.message || e) });
    }

    Utilities.sleep(500); // 帯域対策
  }

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function _backfill_getDonePageIds_() {
  const set = new Set();
  try {
    const storeId = PropertiesService.getScriptProperties().getProperty("PROTOCOL_STORE_SPREADSHEET_ID");
    if (!storeId) return set;
    const ss = SpreadsheetApp.openById(storeId);
    const sh = ss.getSheetByName("DB_ProtocolCandidates");
    if (!sh || sh.getLastRow() < 2) return set;
    const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    const col = headers.indexOf("sourcePageId");
    if (col < 0) return set;
    const vals = sh.getRange(2, col + 1, sh.getLastRow() - 1, 1).getValues();
    vals.forEach(function(r){ if (r[0]) set.add(String(r[0]).replace(/-/g,"")); });
  } catch(e) {}
  return set;
}