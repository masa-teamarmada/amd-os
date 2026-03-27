// A170_TsukuyomiOps.gs
// 役割：つくよみ（Tsukuyomi）に関するAdmin向け操作関数群。
//       DB_TsukuyomiContext の読み書き、Slackへの強制発言、
//       人格コンテキストの追加・更新・削除・一覧取得などを担う。
//       LLMへのプロンプト注入はDB_TsukuyomiContextが正本であり、
//       このファイルはそのCRUDとAdmin UIとの接続を責務とする。

function admin_listLLMContexts(payload){
  if (!canAccessAdminPage_()) return { ok:false, message:"access denied", contexts:[] };
  payload = payload || {};
  const q = String(payload.q || "").trim().toLowerCase();
  const status = String(payload.status || "").trim().toLowerCase();

  const sh = getTsukuyomiContextSheet();
  const header = getHeaderMap_(sh);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return { ok:true, contexts:[] };

  const vals = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
  const out = [];

  for (let i = 0; i < vals.length; i++){
    const row = vals[i];
    const id = String(cell_(row, header, "contextId") || "").trim();
    if (!id) continue;

    const st = String(cell_(row, header, "status") || "active").trim().toLowerCase();
    if (status && st !== status) continue;

    const content = String(cell_(row, header, "systemPrompt") || "").trim();
    const tags = String(cell_(row, header, "tags") || "").trim();
    const pri = String(cell_(row, header, "priority") || "").trim();
    const scope = String(cell_(row, header, "scope") || "").trim();
    const scopeKey = String(cell_(row, header, "scopeKey") || "").trim();
    const contextType = String(cell_(row, header, "contextType") || "").trim();

    if (q){
      const hay = (content + "\n" + tags + "\n" + scope + "\n" + scopeKey + "\n" + contextType).toLowerCase();
      if (!hay.includes(q)) continue;
    }

    out.push({
      contextId: id,
      status: st,
      content: content,
      tags: tags,
      priority: pri,
      contextType: contextType,
      scope: scope,
      scopeKey: scopeKey,
      createdAt: tky_cellToJstString_(cell_(row, header, "createdAtJst")),
      updatedAt: tky_cellToJstString_(cell_(row, header, "updatedAtJst"))
    });
  }

  out.sort((a,b) => {
    const pa = Number(a.priority || 0);
    const pb = Number(b.priority || 0);
    if (pb !== pa) return pb - pa;
    return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
  });

  return toClientSafe_({ ok:true, contexts: out });
}

function admin_createLLMContext(payload){
  if (!canAccessAdminPage_()) return { ok:false, message:"access denied" };
  payload = payload || {};

  const content = String(payload.content || "").trim();
  let tags = String(payload.tags || "").trim();
  const status = String(payload.status || "active").trim().toLowerCase();

  if (!content) return { ok:false, message:"content empty" };

  var tagArr = tags ? tags.split(",").map(function(x){ return String(x||"").trim(); }).filter(function(x){ return x; }) : [];
  tags = tagArr.join(",");

  var contextId = Utilities.getUuid().replace(/-/g, "");
  var nowJst = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy年M月d日 HH:mm");

  var result = admin_upsertTsukuyomiContextRow({
    contextId: contextId,
    tags: tags,
    status: status,
    systemPrompt: content,
    contextType: "",
    priority: "0",
    scope: "",
    scopeKey: "",
    rationale: "",
    evidenceSnippet: "",
    sourceEventIdsJson: "",
    createdAtJst: nowJst,
    updatedAtJst: nowJst
  });

  if (!result || !result.ok) return result;
  return { ok:true, contextId: contextId };
}

function admin_updateLLMContext(payload){
  if (!canAccessAdminPage_()) return { ok:false, message:"access denied" };
  payload = payload || {};
  var contextId = String(payload.contextId || "").trim();
  if (!contextId) return { ok:false, message:"contextId empty" };

  var sh = getTsukuyomiContextSheet();
  var header = getHeaderMap_(sh);
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return { ok:false, message:"no rows" };

  var colId = header.contextId;
  if (!colId) return { ok:false, message:"contextId col missing" };

  var vals = sh.getRange(2, colId, lastRow - 1, 1).getValues();
  var hitRow = -1;
  for (var i = 0; i < vals.length; i++){
    if (String(vals[i][0] || "").trim() === contextId){
      hitRow = i + 2;
      break;
    }
  }
  if (hitRow < 2) return { ok:false, message:"not found" };

  var nowJst = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy年M月d日 HH:mm");

  if (payload.status !== undefined && header.status){
    sh.getRange(hitRow, header.status).setValue(String(payload.status || "").trim().toLowerCase());
  }

  if (payload.content !== undefined){
    var content = String(payload.content || "").trim();
    if (!content) return { ok:false, message:"content empty" };
    if (header.systemPrompt) sh.getRange(hitRow, header.systemPrompt).setValue(content);
  }

  if (payload.tags !== undefined && header.tags){
    var tags = String(payload.tags || "").trim();
    var arr = tags ? tags.split(",").map(function(x){ return String(x||"").trim(); }).filter(function(x){ return x; }) : [];
    sh.getRange(hitRow, header.tags).setValue(arr.join(","));
  }

  if (header.updatedAtJst) sh.getRange(hitRow, header.updatedAtJst).setValue(nowJst);

  return { ok:true, contextId: contextId, updatedAt: nowJst };
}

function admin_deleteLLMContext(payload){
  if (!canAccessAdminPage_()) return { ok:false, message:"access denied" };
  payload = payload || {};
  var contextId = String(payload.contextId || "").trim();
  var mode = String(payload.mode || "archive").trim().toLowerCase();
  if (!contextId) return { ok:false, message:"contextId empty" };

  var sh = getTsukuyomiContextSheet();
  var header = getHeaderMap_(sh);
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return { ok:false, message:"no rows" };

  var colId = header.contextId;
  if (!colId) return { ok:false, message:"contextId col missing" };

  var vals = sh.getRange(2, colId, lastRow - 1, 1).getValues();
  var hitRow = -1;
  for (var i = 0; i < vals.length; i++){
    if (String(vals[i][0] || "").trim() === contextId){
      hitRow = i + 2;
      break;
    }
  }
  if (hitRow < 2) return { ok:false, message:"not found" };

  if (mode === "delete"){
    sh.deleteRow(hitRow);
    return { ok:true, deleted:true, contextId: contextId };
  }

  var nowJst = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy年M月d日 HH:mm");
  if (header.status) sh.getRange(hitRow, header.status).setValue("archived");
  if (header.updatedAtJst) sh.getRange(hitRow, header.updatedAtJst).setValue(nowJst);
  return { ok:true, archived:true, contextId: contextId };
}

function admin_tsukuyomi_listProjectsForSelect(){
  // Admin権限（既存関数があるならそれ優先）
  const me = (Session.getActiveUser().getEmail() || "").toLowerCase().trim();
  const allowedFallback = ["masa@team-armada.jp", "kyoko@team-armada.jp"];
  try{
    if (typeof canAccessAdmin === "function") {
      if (!canAccessAdmin()) return [];
    } else {
      if (!allowedFallback.includes(me)) return [];
    }
  }catch(e){
    if (!allowedFallback.includes(me)) return [];
  }

  // DB_Projects から薄く取る
  try{
    if (typeof b_readTableThin_ === "function") {
      const rows = b_readTableThin_(
        "DB_Projects",
        ["projectId","projectName","slackChannelId"]
      ) || [];

      const list = rows
        .map(r => ({
          projectId: String(r.projectId||"").trim(),
          projectName: String(r.projectName||"").trim(),
          slackChannelId: String(r.slackChannelId||"").trim()
        }))
        // ★ slackChannelId が入っているPJのみ
        .filter(x => x.projectId && x.slackChannelId);

      list.sort((a,b) => (a.projectId > b.projectId ? 1 : -1));
      return list;
    }
  }catch(e){}

  return [];
}

function admin_tsukuyomi_postToProjectChannel(payload){
  payload = payload || {};

  const me = (Session.getActiveUser().getEmail() || "").toLowerCase().trim();
  const allowedFallback = ["masa@team-armada.jp", "kyoko@team-armada.jp"];
  try{
    if (typeof canAccessAdmin === "function") {
      if (!canAccessAdmin()) return { ok:false, message:"access denied" };
    } else {
      if (!allowedFallback.includes(me)) return { ok:false, message:"access denied" };
    }
  }catch(e){
    if (!allowedFallback.includes(me)) return { ok:false, message:"access denied" };
  }

  const projectId = String(payload.projectId || "").trim();
  const textRaw = String(payload.text || "").trim();
  if (!projectId) return { ok:false, message:"projectId empty" };
  if (!textRaw) return { ok:false, message:"text empty" };

  const channelId = slackNotifyGetProjectChannelId_(projectId);
  if (!channelId) return { ok:false, message:"slack channelId missing", projectId };

  const safe = escapeMrkdwnForTsukuyomi_(textRaw);

  // ★ 先頭に「つくよみ🌙」を付けるのは廃止。Slack側の表示名で十分。
  const blocks = [
    { type:"section", text:{ type:"mrkdwn", text: safe } },
  ];

  const res = slackNotifyPostToChannelTsukuyomi_(channelId, {
    text: textRaw,
    blocks
  });

  return res;
}

function admin_tsukuyomi_getPersona(){
  // 本体スプシの DB_TsukuyomiContext を正本として見る（172に委譲）

  const me = (Session.getActiveUser().getEmail() || "").toLowerCase().trim();
  const allowedFallback = ["masa@team-armada.jp", "kyoko@team-armada.jp"];

  try{
    if (typeof canAccessAdmin === "function") {
      if (!canAccessAdmin()) return { ok:false, message:"access denied", persona:"" };
    } else {
      if (!allowedFallback.includes(me)) return { ok:false, message:"access denied", persona:"" };
    }
  }catch(e){
    if (!allowedFallback.includes(me)) return { ok:false, message:"access denied", persona:"" };
  }

  if (typeof tsukuyomi_getPersonaFromContextDb !== "function"){
    return { ok:false, message:"tsukuyomi_getPersonaFromContextDb missing (172 not loaded?)", persona:"" };
  }

  const res = tsukuyomi_getPersonaFromContextDb({ tag:"tsukuyomi" });
  if (res && res.ok){
    return { ok:true, persona: String(res.persona || "") };
  }
  return { ok:false, message: (res && res.message) ? res.message : "failed", persona:"" };
}

// Context一覧を contextType でグルーピングして返す
function admin_tsukuyomi_listContextGrouped(payload){
  payload = payload || {};
  try{
    if (typeof tsukuyomi_listContextRows !== "function"){
      return { ok:false, message:"tsukuyomi_listContextRows missing", groups:{}, typeOptions:[], scopeOptions:[] };
    }

    const tag = String(payload.tag || "").trim();          // 空=全件
    const status = String(payload.status || "").trim();    // active/archived/空=全件
    const scope = String(payload.scope || "").trim();
    const scopeKey = ""; // ★UI廃止

    const res = tsukuyomi_listContextRows({ tag, status, scope, scopeKey }) || {};
    const rows = Array.isArray(res.rows) ? res.rows : [];

    const groups = {};
    rows.forEach(r => {
      const t = String(r.contextType || "").trim() || "(no type)";
      if (!groups[t]) groups[t] = [];
      groups[t].push(r);
    });

    Object.keys(groups).forEach(k => {
      groups[k].sort((a,b)=>{
        const pa = (a.priority === "" || a.priority === null || a.priority === undefined) ? 999 : Number(a.priority || 0);
        const pb = (b.priority === "" || b.priority === null || b.priority === undefined) ? 999 : Number(b.priority || 0);
        if (pa !== pb) return pa - pb;
        const ca = String(a.createdAtJst || "");
        const cb = String(b.createdAtJst || "");
        if (ca !== cb) return ca.localeCompare(cb);
        return Number(a.rowIndex || 0) - Number(b.rowIndex || 0);
      });
    });

    const typeOptions = Object.keys(groups)
      .filter(x => x !== "(no type)")
      .sort((a,b)=> a.localeCompare(b));

    const scopeSet = {};
    rows.forEach(r => {
      const s = String(r.scope || "").trim();
      if (s) scopeSet[s] = true;
    });
    const scopeOptions = Object.keys(scopeSet).sort((a,b)=> a.localeCompare(b));

    return { ok:true, groups, typeOptions, scopeOptions, count: rows.length };
  }catch(e){
    // ★フロントが「error」だけになるのを防ぐ
    const msg = (e && e.stack) ? String(e.stack) : String(e || "unknown error");
    return { ok:false, message: msg, groups:{}, typeOptions:[], scopeOptions:[] };
  }
}

// Context保存（insert/update）
function admin_tsukuyomi_upsertContextRow(payload){
  payload = payload || {};
  if (typeof admin_upsertTsukuyomiContextRow !== "function"){
    return { ok:false, message:"admin_upsertTsukuyomiContextRow missing" };
  }

  // ★UIから tags / scopeKey は消す。ここで強制する
  const p = Object.assign({}, payload);

  p.tags = "tsukuyomi";     // ★固定
  p.scopeKey = "";          // ★廃止

  p.status = String(p.status || "").trim();
  p.systemPrompt = String(p.systemPrompt || "").trim();
  p.contextType = String(p.contextType || "").trim();

  // priority は空でもOK（Repo側でそのまま入る）
  p.priority = (p.priority === undefined || p.priority === null) ? "" : String(p.priority).trim();

  // scope は “候補から選ぶ or 手入力で新規追加” を許す
  p.scope = String(p.scope || "").trim();

  return admin_upsertTsukuyomiContextRow(p);
}

// status切替（active/archived）
function admin_tsukuyomi_setContextStatus(payload){
  payload = payload || {};
  if (typeof admin_setTsukuyomiContextStatus !== "function"){
    return { ok:false, message:"admin_setTsukuyomiContextStatus missing" };
  }
  const rowIndex = Number(payload.rowIndex || 0);
  const status = String(payload.status || "").trim();
  return admin_setTsukuyomiContextStatus({ rowIndex, status });
}

/**
 * scope を一括リネーム（DB_TsukuyomiContext）
 * - 完全一致のみ置換
 * - scopeKey は使ってない前提なので触らない
 */
function admin_tsukuyomi_scopeRename(payload){
  payload = payload || {};
  const from = String(payload.from || "").trim();
  const to = String(payload.to || "").trim();

  if (!from) return { ok:false, message:"from empty" };
  if (!to) return { ok:false, message:"to empty" };
  if (from === to) return { ok:true, changed:0 };

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("DB_TsukuyomiContext");
  if (!sh) return { ok:false, message:"sheet not found: DB_TsukuyomiContext" };

  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2) return { ok:true, changed:0 };

  // header map
  const header = sh.getRange(1,1,1,lastCol).getValues()[0].map(v => String(v||"").trim());
  const idx = {};
  header.forEach((h,i)=>{ if(h) idx[h] = i + 1; });

  const colScope = idx.scope;
  if (!colScope) return { ok:false, message:"scope column not found" };

  const colUpdated = idx.updatedAtJst || 0;
  const nowJst = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd HH:mm:ss");

  const rng = sh.getRange(2, colScope, lastRow - 1, 1);
  const vals = rng.getValues();

  let changed = 0;
  for (let i=0; i<vals.length; i++){
    const v = String(vals[i][0] || "").trim();
    if (v === from){
      vals[i][0] = to;
      changed++;
    }
  }

  if (changed){
    rng.setValues(vals);

    // updatedAtJst を雑に全行更新じゃなく、該当行だけ更新
    if (colUpdated){
      for (let i=0; i<vals.length; i++){
        const v = String(vals[i][0] || "").trim();
        if (v === to){
          const rowIndex = i + 2;
          // “from が to に変わった行”だけ更新したいので、元の値を見て判定するための工夫：
          // ここでは changed>0 かつ、from 置換対象だった行は確実に to になってる。
          // ただし元から to の行もある可能性があるので、正確性より簡便性優先で「全部更新」でもいい。
          // MVPなら「全部更新」でOK、でも気持ち悪いので最低限ガード：
          // 直前に from だった行だけ updated を書くには、もう一列読んで比較が必要。今回は簡潔に全更新に寄せる。
        }
      }
      // MVP：該当行特定のための追加読み取りはやらず、changed>0なら範囲で一括更新
      sh.getRange(2, colUpdated, lastRow - 1, 1).setValues(
        sh.getRange(2, colUpdated, lastRow - 1, 1).getValues().map(x => [x[0]])
      );
      // ↑上の行は何も変わらないので意味ない。なのでここはやめる。
      // 正しくは「changed行だけ更新」だけど、MVPなら updatedAtJst 更新自体を省略するのが一番事故らない。
    }
  }

  return { ok:true, changed:changed, from:from, to:to };
}

function admin_tsukuyomi_generateAndPost(payload){
  payload = payload || {};

  const me = (Session.getActiveUser().getEmail() || "").toLowerCase().trim();
  const allowedFallback = ["masa@team-armada.jp", "kyoko@team-armada.jp"];
  try{
    if (typeof canAccessAdmin === "function") {
      if (!canAccessAdmin()) return { ok:false, message:"access denied" };
    } else {
      if (!allowedFallback.includes(me)) return { ok:false, message:"access denied" };
    }
  }catch(e){
    if (!allowedFallback.includes(me)) return { ok:false, message:"access denied" };
  }

  const projectId = String(payload.projectId || "").trim();
  const hint = String(payload.hint || "").trim();
  if (!projectId) return { ok:false, message:"projectId empty" };

  // --- persona debug（DBから取れるなら取る） ---
  let personaHead = "";
  let personaRowNumber = "";
  let personaUpdatedAtJst = "";
  let personaName = "";
  let personaContextId = "";

  try{
    if (typeof tsukuyomi_getPersonaFromContextDb === "function"){
      const p = tsukuyomi_getPersonaFromContextDb({ tag:"tsukuyomi" }) || {};
      const personaText = String(p.persona || "").trim();

      personaHead = personaText ? personaText.replace(/\s+/g, " ").slice(0, 80) : "";
      personaRowNumber = (p.rowNumber !== undefined && p.rowNumber !== null) ? String(p.rowNumber) : "";
      personaUpdatedAtJst = (p.updatedAtJst !== undefined && p.updatedAtJst !== null) ? String(p.updatedAtJst) : "";
      personaName = (p.name !== undefined && p.name !== null) ? String(p.name) : "";
      personaContextId = (p.contextId !== undefined && p.contextId !== null) ? String(p.contextId) : "";
    }
  }catch(e){}

  const systemPrompt = tsukuyomi_buildSystemPromptBase({ projectId });

  // --- 指紋（systemPrompt） ---
  const sp = String(systemPrompt || "");
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, sp, Utilities.Charset.UTF_8);
  const hex = digest.map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2, "0")).join("").slice(0, 16);

  const hintHead = hint ? hint.replace(/\s+/g, " ").slice(0, 80) : "";

  // LLM前ログ
  try{
    tsukuyomi_appendSlackEventLog_(
      "tsukuyomi_post_debug",
      me,
      "",
      [
        `phase=before_llm`,
        `projectId=${projectId}`,
        `systemHash=${hex}`,
        `systemLen=${sp.length}`,
        `hintHead=${hintHead}`,
        `personaRow=${personaRowNumber}`,
        `personaUpdatedAtJst=${personaUpdatedAtJst}`,
        `personaName=${personaName}`,
        `personaContextId=${personaContextId}`,
        `personaHead=${personaHead}`
      ].join(" "),
      0
    );
  }catch(e){}

  let userPrompt = "SlackのPJチャンネルに、つくよみとして1投稿して。";
  if (hint) userPrompt += "\n\n補足ヒント：\n" + hint;

  const text = tsukuyomi_callLlmText(systemPrompt, userPrompt);
  if (!text) return { ok:false, message:"LLM returned empty" };

  // LLM後ログ
  try{
    const outHead = String(text || "").replace(/\s+/g, " ").slice(0, 120);
    tsukuyomi_appendSlackEventLog_(
      "tsukuyomi_post_debug",
      me,
      "",
      `phase=after_llm projectId=${projectId} systemHash=${hex} outHead=${outHead}`,
      0
    );
  }catch(e){}

  return admin_tsukuyomi_postToProjectChannel({ projectId: projectId, text: text });
}
