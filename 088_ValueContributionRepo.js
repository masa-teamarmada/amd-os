/** 088_ValueContributionRepo.gs
 * ValueContribution（タスク→マイルストーン貢献）I/O担当。
 * DB_ValueContributions を NAVIGATOR スプレッドシートに作成・読み書きする。
 */

function vcEnsureSchema(){
  const sh = getSheetOrCreate_("DB_ValueContributions"); // DB_なので外部SSへ
  ensureHeader_(sh, [
    "contributionId",
    "uniqueKey",
    "projectId",
    "ym",
    "planCycleId",
    "version",
    "milestoneKey",
    "milestoneOrderNo",
    "milestoneTitle",
    "eventId",
    "eventDescription",
    "contribPoints",
    "confidence",
    "method",
    "rationale",
    "modelName",
    "promptVersion",
    "createdAtJst",
    "createdBy",
    "updatedAtJst",
    "updatedBy",
    "isDeleted"
  ]);
  try{ sh.setFrozenRows(1); } catch(e){}
  return sh;
}

function vcListByProjectYm(projectId, ym){
  projectId = String(projectId || "").trim();
  ym = String(ym || "").trim();
  if (!projectId || !ym) return [];

  const sh = vcEnsureSchema();
  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];

  const values = sh.getRange(1,1,lastRow,lastCol).getValues();
  const head = values[0].map(x=>String(x||"").trim());
  const idx = {};
  head.forEach((h,i)=>{ if (h && idx[h]===undefined) idx[h]=i; });

  function cell(row, key){
    const i = idx[key];
    return (i===undefined) ? "" : row[i];
  }

  const out = [];
  for (let r=1; r<values.length; r++){
    const row = values[r];
    if (String(cell(row,"isDeleted")||"").toUpperCase().trim() === "TRUE") continue;
    if (String(cell(row,"projectId")||"").trim() !== projectId) continue;
    if (String(cell(row,"ym")||"").trim() !== ym) continue;

    out.push({
      contributionId: String(cell(row,"contributionId")||"").trim(),
      uniqueKey: String(cell(row,"uniqueKey")||"").trim(),
      projectId: String(cell(row,"projectId")||"").trim(),
      ym: String(cell(row,"ym")||"").trim(),
      planCycleId: String(cell(row,"planCycleId")||"").trim(),
      version: Number(cell(row,"version")||0),
      milestoneKey: String(cell(row,"milestoneKey")||"").trim(),
      milestoneOrderNo: Number(cell(row,"milestoneOrderNo")||0),
      milestoneTitle: String(cell(row,"milestoneTitle")||"").trim(),
      eventId: String(cell(row,"eventId")||"").trim(),
      eventDescription: String(cell(row,"eventDescription")||"").trim(),
      contribPoints: Number(cell(row,"contribPoints")||0),
      confidence: Number(cell(row,"confidence")||0),
      method: String(cell(row,"method")||"").trim(),
      rationale: String(cell(row,"rationale")||"").trim(),
      modelName: String(cell(row,"modelName")||"").trim(),
      promptVersion: String(cell(row,"promptVersion")||"").trim(),
      updatedAtJst: String(cell(row,"updatedAtJst")||"").trim(),
      updatedBy: String(cell(row,"updatedBy")||"").trim(),
    });
  }
  return out;
}

function vcUpsertMany(rows){
  const sh = vcEnsureSchema();
  const email = (Session.getActiveUser().getEmail() || "").trim();
  const now = new Date();
  const nowJst = Utilities.formatDate(now, "Asia/Tokyo", "yyyy-MM-dd'T'HH:mm:ssXXX");

  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  const values = (lastRow >= 2 && lastCol >= 1)
    ? sh.getRange(1,1,lastRow,lastCol).getValues()
    : [sh.getRange(1,1,1,Math.max(lastCol,1)).getValues()[0]];

  const head = (values[0]||[]).map(x=>String(x||"").trim());
  const idx = {};
  head.forEach((h,i)=>{ if (h && idx[h]===undefined) idx[h]=i; });

  const iUnique = idx["uniqueKey"];
  if (iUnique === undefined) throw new Error("DB_ValueContributions header missing: uniqueKey");

  // 既存 uniqueKey -> rowNumber
  const rowNoByKey = {};
  for (let r=1; r<values.length; r++){
    const k = String(values[r][iUnique]||"").trim();
    if (k) rowNoByKey[k] = r+1;
  }

  const appended = [];
  const updated = [];

  function col(key){
    const i = idx[key];
    if (i === undefined) return -1;
    return i;
  }
  function setCell(arr, key, v){
    const i = col(key);
    if (i < 0) return;
    arr[i] = v;
  }

  for (const x of (Array.isArray(rows) ? rows : [])){
    const uniqueKey = String(x.uniqueKey||"").trim();
    if (!uniqueKey) continue;

    const baseRow = new Array(head.length).fill("");
    const isNew = !rowNoByKey[uniqueKey];
    const rowNo = isNew ? -1 : rowNoByKey[uniqueKey];

    // 新規は created 系も入れる
    if (isNew){
      setCell(baseRow, "contributionId", String(x.contributionId||"").trim());
      setCell(baseRow, "uniqueKey", uniqueKey);
      setCell(baseRow, "createdAtJst", nowJst);
      setCell(baseRow, "createdBy", email);
      setCell(baseRow, "isDeleted", "FALSE");
    } else {
      // 既存行を読み出して上書きベースにする
      const cur = sh.getRange(rowNo, 1, 1, head.length).getValues()[0];
      for (let i=0;i<head.length;i++) baseRow[i] = cur[i];
    }

    // 共通上書き
    setCell(baseRow, "projectId", String(x.projectId||"").trim());
    setCell(baseRow, "ym", String(x.ym||"").trim());
    setCell(baseRow, "planCycleId", String(x.planCycleId||"").trim());
    setCell(baseRow, "version", Number(x.version||0));
    setCell(baseRow, "milestoneKey", String(x.milestoneKey||"").trim());
    setCell(baseRow, "milestoneOrderNo", Number(x.milestoneOrderNo||0));
    setCell(baseRow, "milestoneTitle", String(x.milestoneTitle||"").trim());
    setCell(baseRow, "eventId", String(x.eventId||"").trim());
    setCell(baseRow, "eventDescription", String(x.eventDescription||"").trim());
    setCell(baseRow, "contribPoints", Number(x.contribPoints||0));
    setCell(baseRow, "confidence", Number(x.confidence||0));
    setCell(baseRow, "method", String(x.method||"").trim());
    setCell(baseRow, "rationale", String(x.rationale||"").trim());
    setCell(baseRow, "modelName", String(x.modelName||"").trim());
    setCell(baseRow, "promptVersion", String(x.promptVersion||"").trim());

    setCell(baseRow, "updatedAtJst", nowJst);
    setCell(baseRow, "updatedBy", email);

    if (isNew){
      appended.push(baseRow);
    } else {
      sh.getRange(rowNo, 1, 1, head.length).setValues([baseRow]);
      updated.push(uniqueKey);
    }
  }

  if (appended.length){
    sh.getRange(sh.getLastRow()+1, 1, appended.length, head.length).setValues(appended);
  }

  return { ok:true, appended: appended.length, updated: updated.length };
}
