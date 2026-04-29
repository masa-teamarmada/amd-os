/** 082_Reimburse.gs
 * 立替（Reimburse）ページ用のサーバ側API。
 * - 進行中PJ一覧を返す（プルダウン候補）
 */
function reimburse_listActiveProjects(payload){
  payload = payload || {};

  // ★立替のPJ候補は「進行中（active）」で固定
  const statusFilter = ["active"];

  const sh = getSheet_("DB_Projects");

  ensureHeader_(sh, [
    "projectId","projectName","clientName","status","updatedAt"
  ]);

  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  const values = (lastRow >= 1 && lastCol >= 1)
    ? sh.getRange(1, 1, lastRow, lastCol).getValues()
    : [[]];

  if (!values || values.length < 2) return { ok:true, items:[] };

  const headers = values[0].map(x=>String(x||"").trim());
  function idx_(name){ return headers.indexOf(name); }

  const iPid = idx_("projectId");
  const iPn  = idx_("projectName");
  const iCn  = idx_("clientName");
  const iSt  = idx_("status");
  const iUpd = idx_("updatedAt");

  if (iPid < 0) return { ok:false, message:"DB_Projects missing projectId", items:[] };

  // ★立替では draft を sales 扱いにしない（混ざる原因なので）
  function normStatus_(s){
    const v = String(s||"").trim().toLowerCase();
    return v; // 空欄は空欄のまま（＝statusFilterに入らない）
  }

  function toEpochMs_(v){
    if (!v) return 0;
    if (v instanceof Date && !isNaN(v.getTime())) return v.getTime();
    const d = new Date(String(v||""));
    return isNaN(d.getTime()) ? 0 : d.getTime();
  }

  const items = [];
  for (let r=1; r<values.length; r++){
    const row = values[r];

    const projectId = String(row[iPid]||"").trim();
    if (!projectId) continue;

    const projectName = (iPn>=0) ? String(row[iPn]||"").trim() : projectId;
    if (!projectName || projectName === "-") continue;

    const st = (iSt>=0) ? normStatus_(row[iSt]) : "";
    if (!statusFilter.includes(st)) continue;

    const clientName = (iCn>=0) ? String(row[iCn]||"").trim() : "";
    const updatedAtMs = (iUpd>=0) ? toEpochMs_(row[iUpd]) : 0;

    items.push({
      projectId,
      projectName,
      clientName,   // UIでは表示しないが将来用に返すのはOK
      status: st,
      updatedAt: updatedAtMs
    });
  }

  // 最近更新が上
  items.sort((a,b)=> (b.updatedAt||0) - (a.updatedAt||0));

  return { ok:true, items: items };
}

// ReimbursePage.html 側の呼び出し名に合わせたラッパー
function reimburse_listMyActiveProjectsForReimburse(payload){
  return reimburse_listActiveProjects(payload);
}

