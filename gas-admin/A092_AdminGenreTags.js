/** A092_AdminGenreTags.gs
 * Admin（ジャンルタグ管理）担当。
 * DB_GenreTagsの一覧/追加/無効化を提供し、UIのタグ候補ソースを管理する。
 */
// ======================================================================
// Admin: Genre Tags Master (DB_GenreTags)
// ======================================================================
function _getGenreTagsSheet_(){
  const sh = getSheetOrCreate_("DB_GenreTags");
  ensureHeader_(sh, ["tag","isActive","updatedAt"]);
  return sh;
}
function admin_listGenreTags(){
  if (!canAccessAdminPage_()) return { ok:false, message:"access denied", tags:[] };

  const sh = _getGenreTagsSheet_();
  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2) return { ok:true, tags:[] };

  const vals = sh.getRange(1,1,lastRow,lastCol).getValues();
  const h = vals[0].map(x=>String(x||"").trim());
  const iTag = h.indexOf("tag");
  const iActive = h.indexOf("isActive");

  const out = [];
  for (let r=1; r<vals.length; r++){
    const t = String(vals[r][iTag]||"").trim();
    if (!t) continue;
    const active = (iActive>=0) ? toBool_(vals[r][iActive]) : true;
    if (!active) continue;
    out.push(t);
  }

  // 表示順は昇順
  out.sort((a,b)=>String(a).localeCompare(String(b),"ja"));
  return { ok:true, tags: out };
}
function admin_addGenreTag(payload){
  if (!canAccessAdminPage_()) return { ok:false, message:"access denied" };

  payload = payload || {};
  const tag = String(payload.tag || "").trim();
  if (!tag) return { ok:false, message:"tag empty" };

  const sh = _getGenreTagsSheet_();
  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  const now = new Date();

  // 既存があれば isActive=true に戻す
  if (lastRow >= 2){
    const vals = sh.getRange(1,1,lastRow,lastCol).getValues();
    const h = vals[0].map(x=>String(x||"").trim());
    const iTag = h.indexOf("tag");
    const iActive = h.indexOf("isActive");
    const iUpdated = h.indexOf("updatedAt");

    for (let r=1; r<vals.length; r++){
      if (String(vals[r][iTag]||"").trim() !== tag) continue;

      if (iActive>=0) sh.getRange(r+1, iActive+1).setValue(true);
      if (iUpdated>=0) sh.getRange(r+1, iUpdated+1).setValue(now);
      return { ok:true, revived:true, tag };
    }
  }

  sh.appendRow([tag, true, now]);
  return { ok:true, created:true, tag };
}
function admin_removeGenreTag(payload){
  if (!canAccessAdminPage_()) return { ok:false, message:"access denied" };

  payload = payload || {};
  const tag = String(payload.tag || "").trim();
  if (!tag) return { ok:false, message:"tag empty" };

  const sh = _getGenreTagsSheet_();
  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2) return { ok:false, message:"no tags" };

  const vals = sh.getRange(1,1,lastRow,lastCol).getValues();
  const h = vals[0].map(x=>String(x||"").trim());
  const iTag = h.indexOf("tag");
  const iActive = h.indexOf("isActive");
  const iUpdated = h.indexOf("updatedAt");
  if (iTag < 0) return { ok:false, message:"DB_GenreTags missing tag" };
  if (iActive < 0) return { ok:false, message:"DB_GenreTags missing isActive" };

  for (let r=1; r<vals.length; r++){
    if (String(vals[r][iTag]||"").trim() !== tag) continue;

    sh.getRange(r+1, iActive+1).setValue(false);
    if (iUpdated>=0) sh.getRange(r+1, iUpdated+1).setValue(new Date());
    return { ok:true, removed:true, tag };
  }

  return { ok:false, message:"tag not found" };
}