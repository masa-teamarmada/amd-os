/**
 * 076_NavigatorNudgeRepo.gs
 *
 * 役割：
 * - Tsukuyomi Nudge（Slack返信由来）の進捗アイテムを蓄積する正本DB
 * - DB_NavigatorNudgeItems を作成・ヘッダ保証し、append / list を提供
 *
 * シート（本体スプシ）：
 * - DB_NavigatorNudgeItems
 *
 * カラム：
 * - itemId, projectId, ym, itemType, body, sourceType, sourceRef, createdAtJst
 */

function navNudgeRepo_ensure_(){
  const sh = getSheetOrCreate_("DB_NavigatorNudgeItems");
  ensureHeader_(sh, [
    "itemId",
    "projectId",
    "ym",
    "itemType",
    "body",
    "sourceType",
    "sourceRef",
    "createdAtJst"
  ]);
  return sh;
}

function navNudgeRepo_appendItems_(projectId, ym, items, source){
  const pid = String(projectId||"").trim();
  const y = String(ym||"").trim();
  if (!pid) throw new Error("projectId empty");
  if (!/^\d{6}$/.test(y)) throw new Error("ym invalid (yyyymm)");

  const sh = navNudgeRepo_ensure_();
  const nowJst = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd'T'HH:mm:ss");

  const arr = Array.isArray(items) ? items : [];
  const srcType = String(source && source.sourceType ? source.sourceType : "tsukuyomi").trim();
  const srcRef  = String(source && source.sourceRef ? source.sourceRef : "").trim();

  let appended = 0;

  arr.forEach(it => {
    const t = String(it && it.itemType ? it.itemType : "progress").trim() || "progress";
    const b = String(it && it.body ? it.body : "").trim();
    if (!b) return;

    sh.appendRow([
      Utilities.getUuid().replace(/-/g,""),
      pid,
      y,
      t,
      b,
      srcType,
      srcRef,
      nowJst
    ]);
    appended++;
  });

  return { ok:true, appended, createdAtJst: nowJst };
}

function navNudgeRepo_listItemsByProjectYm_(projectId, ym, limit){
  const pid = String(projectId||"").trim();
  const y = String(ym||"").trim();
  const lim = (limit !== undefined && limit !== null) ? Number(limit||0) : 200;

  if (!pid) return [];
  if (!/^\d{6}$/.test(y)) return [];

  const sh = navNudgeRepo_ensure_();
  const vals = sh.getDataRange().getValues();
  if (!vals || vals.length < 2) return [];

  const h = vals[0].map(x=>String(x||"").trim());
  const iId = h.indexOf("itemId");
  const iPid = h.indexOf("projectId");
  const iYm = h.indexOf("ym");
  const iType = h.indexOf("itemType");
  const iBody = h.indexOf("body");
  const iSrcT = h.indexOf("sourceType");
  const iSrcR = h.indexOf("sourceRef");
  const iAt = h.indexOf("createdAtJst");

  const out = [];
  for (let r=1; r<vals.length; r++){
    if (String(vals[r][iPid]||"").trim() !== pid) continue;
    if (String(vals[r][iYm]||"").trim() !== y) continue;

    out.push({
      itemId: String(vals[r][iId]||"").trim(),
      projectId: pid,
      ym: y,
      itemType: String(vals[r][iType]||"").trim() || "progress",
      body: String(vals[r][iBody]||"").trim(),
      sourceType: String(vals[r][iSrcT]||"").trim(),
      sourceRef: String(vals[r][iSrcR]||"").trim(),
      createdAtJst: String(vals[r][iAt]||"").trim()
    });

    if (lim > 0 && out.length >= lim) break;
  }

  out.sort((a,b)=> String(b.createdAtJst||"").localeCompare(String(a.createdAtJst||"")));
  return out;
}
