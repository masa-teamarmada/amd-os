/** 93_AdminContextTags.gs
 * LLM Context の tags 候補マスタを管理する担当。
 *
 * 目的
 * - DB_LLMContext の tags（カンマ区切り）を「表記ゆれしない」運用に寄せるため、
 *   候補タグを Protocol Store 側のマスタで一元管理する。
 * - UI（AdminPage.html）ではプルダウン/サジェスト用の候補ソースとして使う。
 *
 * 対象ストア（Protocol Store spreadsheet）
 * - DB_LLMContextTags: tag / status(active|archived) / note / createdAt / updatedAt
 *
 * 提供API（AdminPage.html から google.script.run で呼ぶ想定）
 * - admin_listContextTags()
 *     active の tag 一覧を返す
 * - admin_addContextTag({ tag, note? })
 *     tag を追加（既存なら active に復帰）
 * - admin_removeContextTag({ tag })
 *     tag を archived にする（論理削除）
 *
 * 前提
 * - PROTOCOL_STORE_SPREADSHEET_ID が ScriptProperties に設定済み
 * - _pc_ensureStoreSheets_() が DB_LLMContextTags を作成/ヘッダ保証できる
 */

// 93_AdminContextTags.gs
// LLM Context tags master (Protocol Store spreadsheet: DB_LLMContextTags)

function admin_listContextTags(){
  if (!canAccessAdminPage_()) return { ok:false, message:"access denied", tags:[] };

  const storeId = String(PropertiesService.getScriptProperties().getProperty("PROTOCOL_STORE_SPREADSHEET_ID") || "").trim();
  if (!storeId) return { ok:false, message:"PROTOCOL_STORE_SPREADSHEET_ID missing", tags:[] };

  _pc_ensureStoreSheets_(storeId);

  const ss = SpreadsheetApp.openById(storeId);
  const sh = ss.getSheetByName("DB_LLMContextTags");
  if (!sh) return { ok:true, tags:[] };

  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2) return { ok:true, tags:[] };

  const vals = sh.getRange(1,1,lastRow,lastCol).getValues();
  const h = vals[0].map(x=>String(x||"").trim());
  const iTag = h.indexOf("tag");
  const iSt  = h.indexOf("status");
  if (iTag < 0) return { ok:true, tags:[] };

  const out = [];
  for (let r=1; r<vals.length; r++){
    const tag = String(vals[r][iTag]||"").trim();
    if (!tag) continue;

    const st = (iSt>=0) ? String(vals[r][iSt]||"").trim().toLowerCase() : "active";
    if (st && st !== "active") continue;

    out.push(tag);
  }

  out.sort((a,b)=>a.localeCompare(b,"ja"));
  return { ok:true, tags: out };
}

function admin_addContextTag(payload){
  if (!canAccessAdminPage_()) return { ok:false, message:"access denied" };
  payload = payload || {};
  const tag = String(payload.tag || "").trim();
  const note = String(payload.note || "").trim();
  if (!tag) return { ok:false, message:"tag empty" };

  const storeId = String(PropertiesService.getScriptProperties().getProperty("PROTOCOL_STORE_SPREADSHEET_ID") || "").trim();
  if (!storeId) return { ok:false, message:"PROTOCOL_STORE_SPREADSHEET_ID missing" };

  _pc_ensureStoreSheets_(storeId);

  const ss = SpreadsheetApp.openById(storeId);
  const sh = ss.getSheetByName("DB_LLMContextTags");
  if (!sh) return { ok:false, message:"DB_LLMContextTags missing" };

  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  const vals = (lastRow>=2) ? sh.getRange(1,1,lastRow,lastCol).getValues() : [];
  const h = vals.length ? vals[0].map(x=>String(x||"").trim()) : [];
  const iTag = h.indexOf("tag");
  const iSt  = h.indexOf("status");
  const iNote= h.indexOf("note");
  const iUpd = h.indexOf("updatedAt");

  // 既存あればactiveに戻す
  if (vals.length && iTag>=0){
    for (let r=1; r<vals.length; r++){
      const cur = String(vals[r][iTag]||"").trim();
      if (cur !== tag) continue;

      const rowNo = r + 1;
      const nowIso = _nowIsoJst_();
      if (iSt>=0) sh.getRange(rowNo, iSt+1).setValue("active");
      if (iNote>=0 && note) sh.getRange(rowNo, iNote+1).setValue(note);
      if (iUpd>=0) sh.getRange(rowNo, iUpd+1).setValue(nowIso);
      return { ok:true, tag: tag, restored:true };
    }
  }

  const nowIso = _nowIsoJst_();
  sh.appendRow([tag, "active", note || "", nowIso, nowIso]);
  return { ok:true, tag: tag, created:true };
}

function admin_removeContextTag(payload){
  if (!canAccessAdminPage_()) return { ok:false, message:"access denied" };
  payload = payload || {};
  const tag = String(payload.tag || "").trim();
  if (!tag) return { ok:false, message:"tag empty" };

  const storeId = String(PropertiesService.getScriptProperties().getProperty("PROTOCOL_STORE_SPREADSHEET_ID") || "").trim();
  if (!storeId) return { ok:false, message:"PROTOCOL_STORE_SPREADSHEET_ID missing" };

  _pc_ensureStoreSheets_(storeId);

  const ss = SpreadsheetApp.openById(storeId);
  const sh = ss.getSheetByName("DB_LLMContextTags");
  if (!sh) return { ok:false, message:"DB_LLMContextTags missing" };

  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2) return { ok:false, message:"no rows" };

  const vals = sh.getRange(1,1,lastRow,lastCol).getValues();
  const h = vals[0].map(x=>String(x||"").trim());
  const iTag = h.indexOf("tag");
  const iSt  = h.indexOf("status");
  const iUpd = h.indexOf("updatedAt");
  if (iTag < 0 || iSt < 0) return { ok:false, message:"cols missing" };

  for (let r=1; r<vals.length; r++){
    const cur = String(vals[r][iTag]||"").trim();
    if (cur !== tag) continue;

    const rowNo = r + 1;
    sh.getRange(rowNo, iSt+1).setValue("archived");
    if (iUpd>=0) sh.getRange(rowNo, iUpd+1).setValue(_nowIsoJst_());
    return { ok:true, tag: tag, archived:true };
  }

  return { ok:false, message:"tag not found" };
}

function admin_renameContextTag(payload){
  if (!canAccessAdminPage_()) return { ok:false, message:"access denied" };
  payload = payload || {};

  const fromTag = String(payload.fromTag || "").trim();
  const toTag   = String(payload.toTag || "").trim();
  const note    = String(payload.note || "").trim();

  if (!fromTag) return { ok:false, message:"fromTag empty" };
  if (!toTag) return { ok:false, message:"toTag empty" };
  if (fromTag === toTag) return { ok:false, message:"same tag" };

  const storeId = String(PropertiesService.getScriptProperties().getProperty("PROTOCOL_STORE_SPREADSHEET_ID") || "").trim();
  if (!storeId) return { ok:false, message:"PROTOCOL_STORE_SPREADSHEET_ID missing" };

  _pc_ensureStoreSheets_(storeId);

  const ss = SpreadsheetApp.openById(storeId);
  const sh = ss.getSheetByName("DB_LLMContextTags");
  if (!sh) return { ok:false, message:"DB_LLMContextTags missing" };

  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2) return { ok:false, message:"no rows" };

  const vals = sh.getRange(1,1,lastRow,lastCol).getValues();
  const h = vals[0].map(x=>String(x||"").trim());
  const iTag = h.indexOf("tag");
  const iSt  = h.indexOf("status");
  const iNote= h.indexOf("note");
  const iUpd = h.indexOf("updatedAt");
  if (iTag < 0) return { ok:false, message:"cols missing: tag" };
  if (iSt < 0) return { ok:false, message:"cols missing: status" };

  // 既に toTag が存在する場合は事故るので拒否（表記ゆれを潰すならここは厳格でOK）
  for (let r=1; r<vals.length; r++){
    const cur = String(vals[r][iTag]||"").trim();
    if (cur === toTag){
      const st = String(vals[r][iSt]||"").trim().toLowerCase();
      return { ok:false, message:`toTag already exists (${st})` };
    }
  }

  // fromTag を探して tag 値を書き換える
  for (let r=1; r<vals.length; r++){
    const cur = String(vals[r][iTag]||"").trim();
    if (cur !== fromTag) continue;

    const rowNo = r + 1;
    const nowIso = _nowIsoJst_();

    sh.getRange(rowNo, iTag+1).setValue(toTag);
    sh.getRange(rowNo, iSt+1).setValue("active");
    if (iNote>=0 && note) sh.getRange(rowNo, iNote+1).setValue(note);
    if (iUpd>=0) sh.getRange(rowNo, iUpd+1).setValue(nowIso);

    return { ok:true, fromTag, toTag, renamed:true };
  }

  return { ok:false, message:"fromTag not found" };
}

