/** A094_AdminLLMExtractors.gs
 * Protocol Store（外部スプレッドシート）の DB_LLMExtractorConfig を扱う。
 *
 * 目的：
 * - navigator_extract を「なければ追加 / あれば更新」する install 関数を提供

 */

function protocolStore_openSpreadsheet_(){
  const props = PropertiesService.getScriptProperties();
  const id = String(props.getProperty("PROTOCOL_STORE_SPREADSHEET_ID") || "").trim();
  if (!id) throw new Error("PROTOCOL_STORE_SPREADSHEET_ID missing");
  return SpreadsheetApp.openById(id);
}

function protocolStore_getSheetOrCreate_(ss, sheetName){
  let sh = ss.getSheetByName(sheetName);
  if (!sh) sh = ss.insertSheet(sheetName);
  return sh;
}

function protocolStore_nowIsoJst_(){
  const now = new Date();
  return Utilities.formatDate(now, "Asia/Tokyo", "yyyy-MM-dd'T'HH:mm:ssXXX");
}

function protocolStore_getExtractorConfigSheet_(){
  const ss = protocolStore_openSpreadsheet_();
  const sh = protocolStore_getSheetOrCreate_(ss, "DB_LLMExtractorConfig");

  ensureHeader_(sh, [
    "configId",
    "name",
    "status",
    "version",
    "systemPrompt",
    "note",
    "createdAt",
    "updatedAt",
    "kind",
    "scopeType",
    "scopeKey",
    "tags",
    "priority",
    "maxChars",
    "composeGroup",
    "updatedBy"
  ]);

  return sh;
}

function navigator_extract_basePrompt_(){
  return [
    "あなたはディープテックスタートアップスタジオ（株式会社チームアルマダ）のPMO補助。",
    "入力は、あるPJの議事録「内容」プロパティのテキスト（1か月分、複数回の会議が混在）だけ。",
    "",
    "目的：",
    "月次の進捗として意味のある「事実候補」だけを抽出し、Monthly Extract の items にする。",
    "感想、雑談、抽象論、願望、将来の夢、一般論は捨てる。",
    "同じ内容の重複はまとめる。",
    "",
    "抽出対象（優先度順）：",
    "1) 決定・確定したこと（誰が何を決めた/確定した）",
    "2) 進捗として前に進んだこと（実験/開発/交渉/契約/資金調達/採用などで、状態が変わった事実）",
    "3) 直近の次アクション（担当者 or 期限 or 依存関係が読み取れるもの）",
    "4) リスク・詰まり・未解決（放置すると進捗が止まる具体）",
    "",
    "出力ルール：",
    "- 必ず JSON 配列だけを返す（前後の文章は禁止）",
    "- 各要素は { \"itemType\": \"...\", \"body\": \"...\" } のみ",
    "- itemType は次のどれか： \"decided\" | \"progress\" | \"nextAction\" | \"risk\"",
    "- body は1〜3行で、主語と具体を落とさない。曖昧な言い換え禁止。",
    "- 数は最大20件。重要なものから並べる。",
    "- 入力に根拠がない推測は禁止。書かれていないことを補わない。",
    "",
    "良い例：",
    "- 「XX社にデモ日程を提示し、2/5に実施で合意。資料ドラフトは山田が1/31までに作成」",
    "- 「PoC装置のリーク原因がOリング劣化と判明。規格変更して再試験へ」"
  ].join("\n");
}

function protocolStore_findRowByName_(sh, name){
  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2) return { found:false, rowIndex:-1 };

  const vals = sh.getRange(1, 1, lastRow, lastCol).getValues();
  const header = (vals[0] || []).map(x=>String(x||"").trim());
  const iName = header.indexOf("name");
  if (iName < 0) throw new Error("DB_LLMExtractorConfig missing col: name");

  for (let r=1; r<vals.length; r++){
    const nm = String(vals[r][iName]||"").trim();
    if (nm === name) return { found:true, rowIndex:(r+1) };
  }
  return { found:false, rowIndex:-1 };
}

function protocolStore_appendRowObject_(sh, obj){
  const lastCol = sh.getLastColumn();
  const header = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(x => String(x||"").trim());
  const row = header.map(h => (obj[h] !== undefined ? obj[h] : ""));
  sh.appendRow(row);
}

function protocolStore_writeRowObjectByRowIndex_(sh, rowIndex, obj){
  const lastCol = sh.getLastColumn();
  const header = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(x => String(x||"").trim());
  const row = header.map(h => (obj[h] !== undefined ? obj[h] : ""));
  sh.getRange(rowIndex, 1, 1, lastCol).setValues([row]);
}

function admin_listExtractorConfigs(payload){
  if (!canAccessAdminPage_()) return { ok:false, message:"access denied", configs:[] };
  payload = payload || {};
  const name = String(payload.name || "protocol_extract").trim();
  const status = String(payload.status || "").trim().toLowerCase();
  const kind = String(payload.kind || "").trim().toLowerCase();

  const storeId = String(PropertiesService.getScriptProperties().getProperty("PROTOCOL_STORE_SPREADSHEET_ID") || "").trim();
  if (!storeId) return { ok:false, message:"PROTOCOL_STORE_SPREADSHEET_ID missing", configs:[] };

  const ss = SpreadsheetApp.openById(storeId);
  const sh = ss.getSheetByName("DB_LLMExtractorConfig");
  if (!sh) return { ok:true, configs:[] };

  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2) return { ok:true, configs:[] };

  const vals = sh.getRange(1,1,lastRow,lastCol).getValues();
  const h = vals[0].map(x=>String(x||"").trim());
  const idx = {};
  h.forEach((x,i)=>{ if(x) idx[x]=i; });

  function g_(row, key){ const i = idx[key]; return (i===undefined) ? "" : row[i]; }
  function s_(v){ return String(v===null||v===undefined?"":v).trim(); }
  function sl_(v){ return s_(v).toLowerCase(); }

  const out = [];
  for (let r=1; r<vals.length; r++){
    const row = vals[r];
    const id = s_(g_(row,"configId"));
    if (!id) continue;
    const nm = s_(g_(row,"name")) || "protocol_extract";
    if (name && nm !== name) continue;
    const st = sl_(g_(row,"status")) || "archived";
    if (status && st !== status) continue;
    const kd = sl_(g_(row,"kind")) || "base";
    if (kind && kd !== kind) continue;
    out.push({
      configId: id,
      name: nm,
      status: st,
      version: s_(g_(row,"version")),
      systemPrompt: s_(g_(row,"systemPrompt")),
      note: s_(g_(row,"note")),
      createdAt: s_(g_(row,"createdAt")),
      updatedAt: s_(g_(row,"updatedAt")),
      kind: kd,
      scopeType: sl_(g_(row,"scopeType")) || "global",
      scopeKey: s_(g_(row,"scopeKey")),
      tags: s_(g_(row,"tags")),
      priority: s_(g_(row,"priority")),
      maxChars: s_(g_(row,"maxChars")),
      composeGroup: s_(g_(row,"composeGroup")),
      updatedBy: s_(g_(row,"updatedBy"))
    });
  }

  function kindRank_(k){
    const x = String(k||"").toLowerCase();
    if (x === "base") return 3;
    if (x === "addon") return 2;
    if (x === "reference") return 1;
    return 0;
  }
  out.sort((a,b)=>{
    const aa = (a.status==="active") ? 1 : 0;
    const bb = (b.status==="active") ? 1 : 0;
    if (bb !== aa) return bb - aa;
    const ka = kindRank_(a.kind);
    const kb = kindRank_(b.kind);
    if (kb !== ka) return kb - ka;
    const pa = Number(a.priority||0);
    const pb = Number(b.priority||0);
    if (pb !== pa) return pb - pa;
    return String(b.updatedAt||"").localeCompare(String(a.updatedAt||""));
  });
  return { ok:true, configs: out };
}

function admin_getActiveExtractorConfig(payload){
  if (!canAccessAdminPage_()) return { ok:false, message:"access denied", config:null };
  payload = payload || {};
  const name = String(payload.name || "protocol_extract").trim();
  const res = admin_listExtractorConfigs({ name: name, status: "active" });
  if (!res.ok) return res;
  const hit = (res.configs && res.configs.length) ? res.configs[0] : null;
  return { ok:true, config: hit };
}

function admin_saveExtractorConfig(payload){
  if (!canAccessAdminPage_()) return { ok:false, message:"access denied" };
  payload = payload || {};

  const storeId = String(PropertiesService.getScriptProperties().getProperty("PROTOCOL_STORE_SPREADSHEET_ID") || "").trim();
  if (!storeId) return { ok:false, message:"PROTOCOL_STORE_SPREADSHEET_ID missing" };

  const name = String(payload.name || "protocol_extract").trim();
  const version = String(payload.version || "").trim();
  const systemPrompt = String(payload.systemPrompt || "").trim();
  const note = String(payload.note || "").trim();
  const kind = String(payload.kind || "base").trim().toLowerCase();
  const scopeType = String(payload.scopeType || "global").trim().toLowerCase();
  const scopeKey = String(payload.scopeKey || "").trim();
  const tags = String(payload.tags || "").trim();
  const priority = String(payload.priority || "0").trim();
  const maxChars = String(payload.maxChars || "").trim();
  const composeGroup = String(payload.composeGroup || "").trim();
  const updatedBy = String(Session.getActiveUser().getEmail() || "").trim().toLowerCase();

  if (!systemPrompt) return { ok:false, message:"systemPrompt empty" };

  const ss = SpreadsheetApp.openById(storeId);
  const sh = ss.getSheetByName("DB_LLMExtractorConfig");
  if (!sh) return { ok:false, message:"DB_LLMExtractorConfig missing" };

  const nowIso = protocolStore_nowIsoJst_();
  const configId = String(payload.configId || "").trim();

  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  const vals = (lastRow >= 1) ? sh.getRange(1,1,lastRow,lastCol).getValues() : [];
  const h = (vals && vals.length) ? vals[0].map(x=>String(x||"").trim()) : [];
  const idx = {};
  h.forEach((x,i)=>{ if(x) idx[x]=i; });

  function i_(k){ return idx[k]; }
  function setIf_(rowNo, key, val){
    const i = i_(key);
    if (i === undefined) return;
    sh.getRange(rowNo, i+1).setValue(val);
  }

  if (configId && lastRow >= 2){
    const iId = i_("configId");
    if (iId !== undefined){
      let hitRow = -1;
      for (let r=1; r<vals.length; r++){
        if (String(vals[r][iId]||"").trim() === configId){ hitRow = r + 1; break; }
      }
      if (hitRow >= 2){
        setIf_(hitRow, "name", name);
        setIf_(hitRow, "version", version);
        setIf_(hitRow, "systemPrompt", systemPrompt);
        setIf_(hitRow, "note", note);
        setIf_(hitRow, "kind", kind);
        setIf_(hitRow, "scopeType", scopeType);
        setIf_(hitRow, "scopeKey", scopeKey);
        setIf_(hitRow, "tags", tags);
        setIf_(hitRow, "priority", priority);
        setIf_(hitRow, "maxChars", maxChars);
        setIf_(hitRow, "composeGroup", composeGroup);
        setIf_(hitRow, "updatedBy", updatedBy);
        setIf_(hitRow, "updatedAt", nowIso);
        return { ok:true, configId: configId, updated:true };
      }
    }
  }

  const newId = Utilities.getUuid().replace(/-/g,"");
  sh.appendRow([
    newId, name, String(payload.status || "archived").trim().toLowerCase(),
    version, systemPrompt, note, nowIso, nowIso,
    kind, scopeType, scopeKey, tags, priority, maxChars, composeGroup, updatedBy
  ]);
  return { ok:true, configId: newId, created:true };
}

function admin_activateExtractorConfig(payload){
  if (!canAccessAdminPage_()) return { ok:false, message:"access denied" };
  payload = payload || {};
  const configId = String(payload.configId || "").trim();
  if (!configId) return { ok:false, message:"configId empty" };

  const storeId = String(PropertiesService.getScriptProperties().getProperty("PROTOCOL_STORE_SPREADSHEET_ID") || "").trim();
  if (!storeId) return { ok:false, message:"PROTOCOL_STORE_SPREADSHEET_ID missing" };

  const ss = SpreadsheetApp.openById(storeId);
  const sh = ss.getSheetByName("DB_LLMExtractorConfig");
  if (!sh) return { ok:false, message:"DB_LLMExtractorConfig missing" };

  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2) return { ok:false, message:"no rows" };

  const vals = sh.getRange(1,1,lastRow,lastCol).getValues();
  const h = vals[0].map(x=>String(x||"").trim());
  const idx = {};
  h.forEach((x,i)=>{ if(x) idx[x]=i; });

  const iId = idx["configId"], iName = idx["name"], iStatus = idx["status"];
  const iKind = idx["kind"], iUpd = idx["updatedAt"];
  if (iId===undefined || iStatus===undefined) return { ok:false, message:"cols missing" };

  let hitRow = -1, name = "", kind = "base";
  for (let r=1; r<vals.length; r++){
    if (String(vals[r][iId]||"").trim() === configId){
      hitRow = r + 1;
      name = (iName!==undefined) ? String(vals[r][iName]||"").trim() : "";
      kind = (iKind!==undefined) ? String(vals[r][iKind]||"base").trim().toLowerCase() : "base";
      break;
    }
  }
  if (hitRow < 2) return { ok:false, message:"not found" };

  const nowIso = protocolStore_nowIsoJst_();
  const targetName = name || "protocol_extract";

  if (kind === "base" && iName !== undefined && iKind !== undefined){
    for (let r=1; r<vals.length; r++){
      const nm = String(vals[r][iName]||"").trim() || "protocol_extract";
      const st = String(vals[r][iStatus]||"").trim().toLowerCase();
      const kd = String(vals[r][iKind]||"base").trim().toLowerCase();
      if (nm !== targetName || kd !== "base" || st !== "active") continue;
      sh.getRange(r+1, iStatus+1).setValue("archived");
      if (iUpd !== undefined) sh.getRange(r+1, iUpd+1).setValue(nowIso);
    }
  }

  sh.getRange(hitRow, iStatus+1).setValue("active");
  if (iUpd !== undefined) sh.getRange(hitRow, iUpd+1).setValue(nowIso);
  return { ok:true, configId: configId, activated:true };
}

function admin_archiveExtractorConfig(payload){
  if (!canAccessAdminPage_()) return { ok:false, message:"access denied" };
  payload = payload || {};
  const configId = String(payload.configId || "").trim();
  if (!configId) return { ok:false, message:"configId empty" };

  const storeId = String(PropertiesService.getScriptProperties().getProperty("PROTOCOL_STORE_SPREADSHEET_ID") || "").trim();
  if (!storeId) return { ok:false, message:"PROTOCOL_STORE_SPREADSHEET_ID missing" };

  const ss = SpreadsheetApp.openById(storeId);
  const sh = ss.getSheetByName("DB_LLMExtractorConfig");
  if (!sh) return { ok:false, message:"DB_LLMExtractorConfig missing" };

  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2) return { ok:false, message:"no rows" };

  const vals = sh.getRange(1,1,lastRow,lastCol).getValues();
  const h = vals[0].map(x=>String(x||"").trim());
  const idx = {};
  h.forEach((x,i)=>{ if(x) idx[x]=i; });

  const iId = idx["configId"], iStatus = idx["status"], iUpd = idx["updatedAt"];
  if (iId===undefined || iStatus===undefined) return { ok:false, message:"cols missing" };

  let hitRow = -1;
  for (let r=1; r<vals.length; r++){
    if (String(vals[r][iId]||"").trim() === configId){ hitRow = r + 1; break; }
  }
  if (hitRow < 2) return { ok:false, message:"not found" };

  sh.getRange(hitRow, iStatus+1).setValue("archived");
  if (iUpd !== undefined) sh.getRange(hitRow, iUpd+1).setValue(protocolStore_nowIsoJst_());
  return { ok:true, configId: configId, archived:true };
}

function run_installNavigatorExtractorConfig(){
  const sh = protocolStore_getExtractorConfigSheet_();

  const name = "navigator_extract";
  const composeGroup = "navigator_extract";

  const nowIso = protocolStore_nowIsoJst_();
  const actor = (Session.getActiveUser().getEmail() || "").toLowerCase().trim();

  const desired = {
    name: name,
    status: "active",
    version: "260125_01",
    systemPrompt: navigator_extract_basePrompt_(),
    note: "navigator monthly extract base",
    kind: "base",
    scopeType: "global",
    scopeKey: "",
    tags: "",
    priority: "0",
    maxChars: "16000",
    composeGroup: composeGroup,
    updatedAt: nowIso,
    updatedBy: actor
  };

  const hit = protocolStore_findRowByName_(sh, name);

  if (!hit.found){
    const row = Object.assign({}, desired, {
      configId: Utilities.getUuid().replace(/-/g,""),
      createdAt: nowIso
    });
    protocolStore_appendRowObject_(sh, row);
    return { ok:true, action:"inserted", name:name, composeGroup:composeGroup, updatedAt: nowIso };
  }

  // 既存行は configId / createdAt を残して更新
  const lastCol = sh.getLastColumn();
  const header = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(x => String(x||"").trim());
  const vals = sh.getRange(hit.rowIndex, 1, 1, lastCol).getValues()[0];

  function idx_(col){ return header.indexOf(col); }
  function get_(col){
    const i = idx_(col);
    return (i < 0) ? "" : vals[i];
  }

  const next = {
    configId: String(get_("configId") || "").trim() || Utilities.getUuid().replace(/-/g,""),
    createdAt: String(get_("createdAt") || "").trim() || nowIso
  };
  Object.keys(desired).forEach(k => { next[k] = desired[k]; });

  protocolStore_writeRowObjectByRowIndex_(sh, hit.rowIndex, next);
  return { ok:true, action:"updated", name:name, composeGroup:composeGroup, updatedAt: nowIso };
}
