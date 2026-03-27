/** R172_TsukuyomiContextRepo
 * R172_TsukuyomiContextRepo / つくよみ人格DB（DB_TsukuyomiContext）を読む・書く運用API
 * DB_TsukuyomiContext 正本Repo
 * 役割:
 * - 本体スプシの DB_TsukuyomiContext を唯一の正本として扱う
 * - フロント（tsukuyomiタブ）向けに「有効プロンプトをまとめて返す」
 * - Admin向けに CRUD（最小）も提供
 *
 * 前提:
 * - シート: DB_TsukuyomiContext
 * - ヘッダ: tags,status,systemPrompt,contextId,contextType,priority,scope,scopeKey,rationale,evidenceSnippet,sourceEventIdsJson,createdAtJst,updatedAtJst
 */

function tsukuyomi_getActiveSystemPrompt(payload){
  payload = payload || {};
  const tag = String(payload.tag || "tsukuyomi").trim(); // 基本 tsukuyomi
  const scope = String(payload.scope || "").trim();     // 任意: global/project/user/channel
  const scopeKey = String(payload.scopeKey || "").trim();

  const rows = tsukuyomi_listContextRows({
    tag,
    status: "active",
    scope,
    scopeKey
  }).rows;

  // priority 昇順（小さいほど強い）→ createdAt 昇順
  rows.sort((a,b) => {
    const pa = (a.priority === "" || a.priority === null || a.priority === undefined) ? 999 : Number(a.priority || 0);
    const pb = (b.priority === "" || b.priority === null || b.priority === undefined) ? 999 : Number(b.priority || 0);
    if (pa !== pb) return pa - pb;
    return String(a.createdAtJst || "").localeCompare(String(b.createdAtJst || ""));
  });

  // 連結ルール: 1行ずつ区切って束ねる（LLMに渡しやすい）
  const prompt = rows
    .map(r => String(r.systemPrompt || "").trim())
    .filter(Boolean)
    .join("\n\n");

  return { ok:true, tag, count: rows.length, systemPrompt: prompt, rows };
}
function tsukuyomiGetDbSs(){
  const props = PropertiesService.getScriptProperties();
  const ssId = String(props.getProperty("TSUKUYOMI_DB_SS_ID") || "").trim();
  if (!ssId) throw new Error("missing TSUKUYOMI_DB_SS_ID");
  return SpreadsheetApp.openById(ssId);
}

function tsukuyomi_listContextRows(payload){
  payload = payload || {};
  const tag = String(payload.tag || "").trim();
  const status = String(payload.status || "").trim(); // active / archived / empty=all
  const scope = String(payload.scope || "").trim();
  const scopeKey = String(payload.scopeKey || "").trim();

  const sh = getTsukuyomiContextSheet();
  const header = getHeaderMap_(sh);

  const lastRow = sh.getLastRow();
  if (lastRow < 2) return { ok:true, rows:[] };

  const values = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
  const rows = [];

  for (let i=0; i<values.length; i++){
    const r = values[i];
    const tags = cell_(r, header, "tags");
    const st = cell_(r, header, "status");
    const systemPrompt = cell_(r, header, "systemPrompt");

    if (status && String(st || "") !== status) continue;

    if (tag) {
      const tagList = String(tags || "")
        .split(",")
        .map(s => String(s||"").trim())
        .filter(Boolean);
      if (tagList.indexOf(tag) === -1) continue;
    }

    const rowScope = cell_(r, header, "scope");
    const rowScopeKey = cell_(r, header, "scopeKey");
    if (scope && String(rowScope || "") !== scope) continue;
    if (scopeKey && String(rowScopeKey || "") !== scopeKey) continue;

    rows.push({
      rowIndex: i + 2,
      tags: String(tags || ""),
      status: String(st || ""),
      systemPrompt: String(systemPrompt || ""),

      contextId: String(cell_(r, header, "contextId") || ""),
      contextType: String(cell_(r, header, "contextType") || ""),
      priority: String(cell_(r, header, "priority") || ""),
      scope: String(rowScope || ""),
      scopeKey: String(rowScopeKey || ""),
      rationale: String(cell_(r, header, "rationale") || ""),
      evidenceSnippet: String(cell_(r, header, "evidenceSnippet") || ""),
      sourceEventIdsJson: String(cell_(r, header, "sourceEventIdsJson") || ""),

      // ★ここが今回の肝：Date型を必ず文字列化して返す
      createdAtJst: tky_cellToJstString_(cell_(r, header, "createdAtJst")),
      updatedAtJst: tky_cellToJstString_(cell_(r, header, "updatedAtJst"))
    });
  }

  return { ok:true, rows: rows };
}

// Date/number/string を「JSTの文字列」に寄せる（フロントへ安全に返すため）
function tky_cellToJstString_(v){
  if (v === null || v === undefined || v === "") return "";
  // Date型
  if (Object.prototype.toString.call(v) === "[object Date]" && !isNaN(v.getTime())){
    return Utilities.formatDate(v, "Asia/Tokyo", "yyyy-MM-dd HH:mm:ss");
  }
  // 数字（シートのシリアル値が来る場合も一応）
  if (typeof v === "number"){
    // Dateっぽい数値でも、文字列にしちゃえば落ちない
    return String(v);
  }
  return String(v);
}

function admin_upsertTsukuyomiContextRow(payload){
  payload = payload || {};
  const rowIndex = payload.rowIndex ? Number(payload.rowIndex || 0) : 0;

  const tags = String(payload.tags || "").trim();
  const status = String(payload.status || "").trim();
  const systemPrompt = String(payload.systemPrompt || "").trim();

  if (!tags) return { ok:false, message:"tags required" };
  if (!status) return { ok:false, message:"status required" };
  if (!systemPrompt) return { ok:false, message:"systemPrompt required" };

  const sh = getTsukuyomiContextSheet();
  const header = getHeaderMap_(sh);

  // 書き込み対象カラム（存在するものだけ）
  const now = fmtJstNow_();
  const obj = {
    tags,
    status,
    systemPrompt,
    contextId: String(payload.contextId || "").trim() || newUuid_(),
    contextType: String(payload.contextType || "").trim(),
    priority: (payload.priority === undefined || payload.priority === null) ? "" : String(payload.priority),
    scope: String(payload.scope || "").trim(),
    scopeKey: String(payload.scopeKey || "").trim(),
    rationale: String(payload.rationale || "").trim(),
    evidenceSnippet: String(payload.evidenceSnippet || "").trim(),
    sourceEventIdsJson: String(payload.sourceEventIdsJson || "").trim(),
    createdAtJst: String(payload.createdAtJst || "").trim() || now,
    updatedAtJst: now
  };

  if (rowIndex && rowIndex >= 2) {
    writeRowByHeader_(sh, header, rowIndex, obj);
    return { ok:true, mode:"update", rowIndex, contextId: obj.contextId };
  }

  const newRowIndex = sh.getLastRow() + 1;
  writeRowByHeader_(sh, header, newRowIndex, obj);
  return { ok:true, mode:"insert", rowIndex: newRowIndex, contextId: obj.contextId };
}

function admin_setTsukuyomiContextStatus(payload){
  payload = payload || {};
  const rowIndex = Number(payload.rowIndex || 0);
  const status = String(payload.status || "").trim();
  if (!rowIndex || rowIndex < 2) return { ok:false, message:"rowIndex invalid" };
  if (!status) return { ok:false, message:"status required" };

  const sh = getTsukuyomiContextSheet();
  const header = getHeaderMap_(sh);

  const colStatus = header.status;
  if (!colStatus) return { ok:false, message:"status column not found" };

  sh.getRange(rowIndex, colStatus).setValue(status);

  const colUpdated = header.updatedAtJst;
  if (colUpdated) sh.getRange(rowIndex, colUpdated).setValue(fmtJstNow_());

  return { ok:true, rowIndex, status };
}

// ===== internal =====
function getTsukuyomiContextSheet(){
  var ssId = PropertiesService.getScriptProperties().getProperty('MAIN_SPREADSHEET_ID');
  if (!ssId) throw new Error('MAIN_SPREADSHEET_ID未設定');
  var ss = SpreadsheetApp.openById(ssId);
  var name = 'DB_TsukuyomiContext';
  var sh = ss.getSheetByName(name);
  if (!sh) throw new Error('sheet not found: ' + name);
  return sh;
}

function getHeaderMap_(sh){
  const row1 = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const map = {};
  for (let c=0; c<row1.length; c++){
    const key = String(row1[c] || "").trim();
    if (!key) continue;
    map[key] = c + 1;
  }
  return map;
}

function cell_(rowValues, headerMap, key){
  const col = headerMap[key];
  if (!col) return "";
  return rowValues[col - 1];
}

function writeRowByHeader_(sh, headerMap, rowIndex, obj){
  // 既存行を読み、存在するカラムだけ上書き
  const lastCol = sh.getLastColumn();
  const cur = sh.getRange(rowIndex, 1, 1, lastCol).getValues()[0];

  Object.keys(obj).forEach(k => {
    const col = headerMap[k];
    if (!col) return;
    cur[col - 1] = obj[k];
  });

  sh.getRange(rowIndex, 1, 1, lastCol).setValues([cur]);
}

function fmtJstNow_(){
  // 既存のJST整形関数があるなら置き換えたい
  return Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd HH:mm:ss");
}

function newUuid_(){
  return Utilities.getUuid();
}

/**
 * tsukuyomi_getPersonaFromContextDb
 *
 * DB_TsukuyomiContext（本体スプシ）から、status=active & tagsにtsukuyomi含む行を集めて persona 文字列を返す
 * priority 昇順（小さいほど強い）→ createdAtJst 昇順
 *
 * 追加返却：
 * - rowNumber / contextId / name / updatedAtJst（最優先行の情報）
 * - personaHead（persona先頭80文字）
 */
function tsukuyomi_getPersonaFromContextDb(payload){
  payload = payload || {};
  const tag = String(payload.tag || "tsukuyomi").trim().toLowerCase();

  const sh = b_ss_().getSheetByName("DB_TsukuyomiContext");
  if (!sh) return { ok:false, message:"DB_TsukuyomiContext missing", persona:"", rowNumber:"", contextId:"", name:"", updatedAtJst:"", personaHead:"" };

  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2) return { ok:true, persona:"", rowNumber:"", contextId:"", name:"", updatedAtJst:"", personaHead:"" };

  const vals = sh.getRange(1,1,lastRow,lastCol).getValues();
  const header = vals[0].map(v => String(v||"").trim());
  const idx = {};
  header.forEach((h,i)=>{ if(h) idx[h]=i; });

  // 必須3列（古い3列だけのときも動くようにする）
  const iTags = (idx.tags !== undefined) ? idx.tags : -1;
  const iStatus = (idx.status !== undefined) ? idx.status : -1;
  const iPrompt = (idx.systemPrompt !== undefined) ? idx.systemPrompt : -1;

  if (iTags === -1 || iStatus === -1 || iPrompt === -1){
    return { ok:false, message:"DB_TsukuyomiContext missing required cols(tags/status/systemPrompt)", persona:"", rowNumber:"", contextId:"", name:"", updatedAtJst:"", personaHead:"" };
  }

  const iPriority = (idx.priority !== undefined) ? idx.priority : -1;
  const iCreated = (idx.createdAtJst !== undefined) ? idx.createdAtJst : -1;

  // 追加で拾える列
  const iUpdated = (idx.updatedAtJst !== undefined) ? idx.updatedAtJst : -1;
  const iName = (idx.name !== undefined) ? idx.name : -1;
  const iContextId = (idx.contextId !== undefined) ? idx.contextId : -1;

  const rows = [];
  for (let r=1; r<vals.length; r++){
    const row = vals[r];

    const st = String(row[iStatus] || "").trim().toLowerCase();
    if (st !== "active") continue;

    const tagsVal = row[iTags];
    if (!tsukuyomi_hasTag(tagsVal, tag)) continue;

    const prompt = String(row[iPrompt] || "").trim();
    if (!prompt) continue;

    const pr = (iPriority === -1) ? 999 : Number(String(row[iPriority]||"").trim() || 999);
    const created = (iCreated === -1) ? "" : String(row[iCreated] || "").trim();

    const updated = (iUpdated === -1) ? "" : String(row[iUpdated] || "").trim();
    const name = (iName === -1) ? "" : String(row[iName] || "").trim();
    const contextId = (iContextId === -1) ? "" : String(row[iContextId] || "").trim();

    // rowNumber はスプレッドシートの実行行番号（1-based）
    rows.push({
      prompt,
      priority: pr,
      createdAtJst: created,
      updatedAtJst: updated,
      name,
      contextId,
      rowNumber: r + 1
    });
  }

  rows.sort((a,b)=>{
    if (a.priority !== b.priority) return a.priority - b.priority;
    return String(a.createdAtJst||"").localeCompare(String(b.createdAtJst||""));
  });

  const persona = rows.map(x => x.prompt).join("\n\n---\n\n");
  const personaHead = persona ? persona.replace(/\s+/g, " ").slice(0, 80) : "";

  // 最優先行（先頭）だけメタ情報として返す
  const top = rows.length ? rows[0] : null;

  return {
    ok:true,
    persona: persona,
    personaHead: personaHead,
    rowNumber: top ? top.rowNumber : "",
    contextId: top ? top.contextId : "",
    name: top ? top.name : "",
    updatedAtJst: top ? top.updatedAtJst : ""
  };
}

/**
 * tsukuyomi_buildSystemPromptBaseFromContextDb
 *
 * つくよみ人格（DB_TsukuyomiContext）を最優先で合成し、
 * コード側では人格・文体・分量・行数などを一切固定しない。
 * ここで入れるのは「事故防止の運用ガード」だけ。
 *
 * payload: { projectId, intent } intent= "post" | "thread"
 */
function tsukuyomi_buildSystemPromptBaseFromContextDb(payload){
  payload = payload || {};
  const intent = String(payload.intent || "post").trim().toLowerCase(); // "post" | "thread"
  const scope = String(payload.scope || "").trim();                    // 任意: global/project/user/channel
  const scopeKey = String(payload.scopeKey || "").trim();

  // ===== 1) DBから「つくよみ」用の有効行を取る =====
  // tagsに tsukuyomi を含む active 行だけ。
  const baseRows = tsukuyomi_listContextRows({
    tag: "tsukuyomi",
    status: "active",
    scope,
    scopeKey
  }).rows || [];

  // ===== 2) intentタグ(post/thread)の扱い =====
  // - 行が post/thread を明示してる場合：intent一致の行だけ採用
  // - 明示してない行：常に採用（全intent共通）
  const rows = baseRows.filter(r => {
    const tags = tsukuyomi_parseTags(r.tags).map(x => String(x||"").toLowerCase());
    const hasPost = tags.includes("post");
    const hasThread = tags.includes("thread");
    if (!hasPost && !hasThread) return true;
    return tags.includes(intent);
  });

  // ===== 3) 4層の固定合成順（ここが肝） =====
  // contextType を「層」に割り当てる。未知/空は personaTone 扱いに倒す（互換性）
  function layerOf(ct){
    const s = String(ct || "").trim().toLowerCase();
    if (s === "role") return "role";
    if (s === "rules" || s === "judge" || s === "judgeprotocol" || s === "judgement" || s === "judgment") return "rules";
    if (s === "format") return "format";
    if (s === "tone" || s === "personatone" || s === "persona") return "tone";
    if (s === "memory" || s === "memorypolicy") return "rules";
    if (s === "safety" || s === "guard" || s === "safetyguard") return "rules";
    if (s === "rolescope") return "role";
    return "tone";
  }

  const layerOrder = { role: 10, rules: 20, format: 30, tone: 40 };

    // ソート：層順 → priority昇順（小さいほど強い）→ createdAt昇順
    rows.sort((a,b) => {
      const la = layerOrder[layerOf(a.contextType)] || 99;
      const lb = layerOrder[layerOf(b.contextType)] || 99;
      if (la !== lb) return la - lb;

      const pa = (a.priority === "" || a.priority === null || a.priority === undefined) ? 999 : Number(a.priority || 0);
      const pb = (b.priority === "" || b.priority === null || b.priority === undefined) ? 999 : Number(b.priority || 0);
      if (pa !== pb) return pa - pb;

      return String(a.createdAtJst || "").localeCompare(String(b.createdAtJst || ""));
    });

    // ===== 4) 合成（層のまとまりごとに区切る） =====
    const parts = [];

    function pushLayer(title, layerKey){
      const chunk = rows
        .filter(r => layerOf(r.contextType) === layerKey)
        .map(r => String(r.systemPrompt || "").trim())
        .filter(Boolean)
        .join("\n\n");
      if (!chunk) return;
      parts.push(`【${title}】\n${chunk}`);
    }

    pushLayer("ROLE｜役割", "role");
    pushLayer("RULES｜判断基準", "rules");
    pushLayer("FORMAT｜出力形式", "format");
    pushLayer("TONE｜口調", "tone");

  // ===== 5) 観測ブロック（事実）を注入（既存を維持） =====
  try{
    const obs = tsukuyomiBuildObservationBlock(payload);
    if (obs) parts.push(obs);
  }catch(e){}

  // ===== 6) 直近の会話メモ（既存を維持） =====
  try{
    if (typeof tsukuyomiMemoryBuildPromptAddon === "function"){
      const mem = tsukuyomiMemoryBuildPromptAddon();
      if (mem) parts.push(mem);
    }
  }catch(e){}

  // ===== 7) intent別の“最小”ガード（ここは固定で入れる） =====
  if (intent === "post"){
    parts.push("【OUTPUT_CONSTRAINT】今回の投稿は、行動は1個に絞る。質問は1文まで。");
  } else {
    parts.push("【OUTPUT_CONSTRAINT】スレッド返信は、相手の文脈を先に反映してから返す。結論だけ押し付けない。");
  }

  return parts.join("\n\n");
}

// tags解析（JSON配列 / カンマ / 改行 を吸収）
function tsukuyomi_parseTags(tagsValue){
  const raw = String(tagsValue || "").trim();
  if (!raw) return [];

  if (raw.startsWith("[") && raw.endsWith("]")){
    try{
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr.map(x => String(x||"").trim()).filter(Boolean);
    }catch(e){}
  }

  return raw
    .replaceAll("，", ",")
    .replaceAll("\n", ",")
    .split(",")
    .map(x => String(x||"").trim())
    .filter(Boolean);
}

function tsukuyomi_hasTag(tagsValue, tagLower){
  const t = String(tagLower || "").trim().toLowerCase();
  if (!t) return false;
  const arr = tsukuyomi_parseTags(tagsValue).map(x => String(x||"").toLowerCase());
  return arr.includes(t);
}

function tsukuyomiBuildObservationBlock(payload){
  payload = payload || {};
  const projectId = String(payload.projectId || "").trim();
  const ym = payload.ym ? Number(payload.ym) : 0;

  // projectId無いなら観測できないのでスキップ
  if (!projectId) return "";

  // 1) profile（呼び出し元が持ってればそれを使う）
  let prof = payload.profile || null;
  if (!prof){
    prof = tsukuyomiGetProfileRow(projectId, String(payload.pmMemberId || "").trim());
  }

  // 2) status（呼び出し元が持ってればそれを使う）
  let derivedStatus = String(payload.derivedStatus || "").trim();
  if (!derivedStatus && ym){
    const cycle = tsukuyomiGetBillingCycleRow(projectId, ym);
    derivedStatus = cycle ? tsukuyomiDeriveMonthlyStatusForObs(cycle) : "none";
  }
  if (!derivedStatus) derivedStatus = "unknown";

  const statusJa = (function(st){
    const m = {
      none: "今月の月次がまだ未着手っぽい",
      draft: "下書きで止まり気味",
      budget_confirmed: "予算までは確定",
      allocation_confirmed: "配賦までは完了",
      invoice_issued: "請求は出てる",
      paid_confirmed: "入金確認まで済み",
      closed: "クローズ済み",
      unknown: "状態は未確認"
    };
    return m[st] || "状態は未確認";
  })(derivedStatus);

  const lines = [];
  lines.push("【観測（事実）】");
  lines.push(`対象: projectId=${projectId}` + (ym ? ` / ym=${ym}` : ""));
  lines.push(`月次の見え方: ${statusJa}`);

  // profile由来（あれば）
  if (prof){
    const avgCloseDay = String(prof.avgCloseDay || "").trim();
    const closeSamples = Number(prof.closeSamples || 0);
    const stuckStatus = String(prof.stuckStatus || "").trim();
    const lastClosedYm = String(prof.lastClosedYm || "").trim();
    const lastClosedAtJst = String(prof.lastClosedAtJst || "").trim();
    const lastRemindedAtJst = String(prof.lastRemindedAtJst || "").trim();
    const lastActionType = String(prof.lastActionType || "").trim();

    if (lastClosedYm || lastClosedAtJst){
      const day = lastClosedAtJst ? tsukuyomiExtractDayFromIso(lastClosedAtJst) : "";
      const dayPart = day ? `（${day}日あたり）` : "";
      lines.push(`前回クローズ: ${lastClosedYm}${dayPart}`.trim());
    }

    if (avgCloseDay && closeSamples >= 3){
      lines.push(`クローズ傾向: 平均${avgCloseDay}日あたり（samples=${closeSamples}）`);
    }

    if (stuckStatus){
      const label = tsukuyomiStatusLabel(stuckStatus);
      if (label) lines.push(`詰まりやすい所: ${label}`);
    }

    if (lastActionType){
      lines.push(`前回の声かけタイプ: ${lastActionType}`);
    }
    if (lastRemindedAtJst){
      lines.push(`前回声かけ: ${lastRemindedAtJst}`);
    }
  }

  lines.push("【制約】この観測を本文にそのまま貼らない。内部コード（status=...等）は本文に出さない。行動は1個、質問は1文。");
  return lines.join("\n");
}

function tsukuyomiGetProfileRow(projectId, pmMemberId){
  const pid = String(projectId || "").trim();
  const pm = String(pmMemberId || "").trim();
  if (!pid) return null;

  const key = pm ? `${pid}:${pm}` : "";

  try{
    // 本体スプシのDBを読む前提
    const t = (typeof b_readTableThin_ === "function")
      ? b_readTableThin_("DB_TsukuyomiProfiles")
      : (typeof b_readTable_ === "function")
        ? b_readTable_("DB_TsukuyomiProfiles")
        : null;

    const rows = (t && Array.isArray(t.rows)) ? t.rows : (Array.isArray(t) ? t : []);
    if (!rows || !rows.length) return null;

    if (key){
      for (const r of rows){
        if (String(r.profileKey || "").trim() === key) return r;
      }
    }

    // pmMemberId無いケースは projectId一致の先頭を返す（雑でOK、嘘は作らない）
    for (const r of rows){
      if (String(r.projectId || "").trim() === pid) return r;
    }
  }catch(e){}

  return null;
}

function tsukuyomiGetBillingCycleRow(projectId, ym){
  const pid = String(projectId || "").trim();
  const y = Number(ym || 0);
  if (!pid || !y) return null;

  try{
    const t = (typeof b_readTableThin_ === "function")
      ? b_readTableThin_("DB_BillingCycle")
      : (typeof b_readTable_ === "function")
        ? b_readTable_("DB_BillingCycle")
        : null;

    const rows = (t && Array.isArray(t.rows)) ? t.rows : (Array.isArray(t) ? t : []);
    if (!rows || !rows.length) return null;

    let best = null;
    for (const r of rows){
      if (String(r.projectId || "").trim() !== pid) continue;
      if (Number(r.ym || 0) !== y) continue;

      if (!best){
        best = r;
      } else {
        const a = String(best.updatedAt || best.updatedAtJst || "").trim();
        const b = String(r.updatedAt || r.updatedAtJst || "").trim();
        if (b && (!a || b > a)) best = r;
      }
    }
    return best;
  }catch(e){}

  return null;
}

function tsukuyomiDeriveMonthlyStatusForObs(c){
  const paid = tsukuyomiHasValue(c.paymentConfirmedAt);
  if (paid) return "paid_confirmed";

  const inv = tsukuyomiHasValue(c.invoiceIssuedAt) || tsukuyomiHasValue(c.freeeInvoiceId);
  if (inv) return "invoice_issued";

  const alloc = tsukuyomiHasValue(c.allocationConfirmedAt) || String(c.status || "").trim() === "allocation_confirmed";
  if (alloc) return "allocation_confirmed";

  const bud = tsukuyomiHasValue(c.budgetConfirmedAt) || String(c.status || "").trim() === "budget_confirmed";
  if (bud) return "budget_confirmed";

  const st = String(c.status || "").trim();
  if (st === "draft") return "draft";

  return "draft";
}

function tsukuyomiHasValue(v){
  if (v === null || v === undefined) return false;
  const s = String(v).trim();
  return !!s;
}

function tsukuyomiStatusLabel(st){
  const map = {
    draft: "下書き",
    budget_confirmed: "予算→配賦",
    allocation_confirmed: "配賦→請求",
    invoice_issued: "請求→入金確認"
  };
  return map[st] || "";
}

function tsukuyomiExtractDayFromIso(s){
  const m = String(s || "").match(/^\d{4}-\d{2}-(\d{2})[T ]/);
  if (!m) return "";
  return String(Number(m[1]));
}

/**
 * contextIdで既存行を検索してupsert
 * @param {Object} payload - admin_upsertTsukuyomiContextRowと同じ形式。contextId必須
 * @return {Object}
 */
function tsukuyomi_upsertByContextId_(payload) {
  payload = payload || {};
  var contextId = String(payload.contextId || '').trim();
  if (!contextId) return { ok: false, message: 'contextId required' };
  
  var sh = getTsukuyomiContextSheet();
  var header = getHeaderMap_(sh);
  var lastRow = sh.getLastRow();
  
  // contextIdで既存行を検索
  if (lastRow >= 2) {
    var colContextId = header.contextId;
    if (colContextId) {
      var values = sh.getRange(2, colContextId, lastRow - 1, 1).getValues();
      for (var i = 0; i < values.length; i++) {
        if (String(values[i][0] || '').trim() === contextId) {
          payload.rowIndex = i + 2;
          break;
        }
      }
    }
  }
  
  return admin_upsertTsukuyomiContextRow(payload);
}