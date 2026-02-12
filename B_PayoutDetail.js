/* “速さのための特殊技”を隔離。今回の b_colToA1_ 事件の再発防止のためにも、ここは独立がいい。*/
/**
 * B_PayoutDetail.gs
 *
 * 目的：
 * DB_PayoutDetail の高速読み取り（projectId + ym）を担当する。
 * TextFinder + RangeList など “最適化のための特殊技” を隔離し、他領域への影響を最小化する。
 *
 * このファイルが担当するもの：
 * - b_readPayoutDetailForProjectYm_（projectId列で行を絞り、必要行だけ横読み）
 *
 * ルール：
 * - 速さ優先の実装はここに閉じ込める（Domain/APIに散らさない）。
 * - 依存するユーティリティ（b_colToA1_ / b_normYm_ 等）はB_Util側に置く。
 * - ここが壊れても他領域を巻き込まない設計を優先する。
 */

// ====== FAST READ: DB_PayoutDetail (projectId + ym only) ======
function b_readPayoutDetailForProjectYm_(projectId, ymKey){
  projectId = String(projectId || "").trim();
  const ym = b_normYm_(ymKey);
  if (!projectId || !ym) return [];

  const sh = b_getSheet_("DB_PayoutDetail");
  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];

  const header = sh.getRange(1,1,1,lastCol).getValues()[0].map(x => String(x||"").trim());

  function idx_(name){ return header.indexOf(name); }
  const iPid = idx_("projectId");
  const iYm  = idx_("ym");
  const iMid = idx_("memberId");
  const iPlan= idx_("plannedYen");
  const iFix = idx_("fixedYen");

  if (iPid < 0 || iYm < 0 || iMid < 0) return [];

  // projectId列だけTextFinderで行番号を絞る
  const pidCol = sh.getRange(2, iPid+1, lastRow-1, 1);
  const hits = pidCol.createTextFinder(projectId).matchEntireCell(true).findAll();
  if (!hits || !hits.length) return [];

  // ★RangeListでまとめて読む
  const a1s = hits.map(cell => `A${cell.getRow()}:${b_colToA1_(lastCol)}${cell.getRow()}`);
  const ranges = sh.getRangeList(a1s).getRanges();

  const out = [];
  ranges.forEach(rg => {
    const row = rg.getValues()[0];
    const rowYm = b_normYm_(row[iYm]);
    if (rowYm !== ym) return;

    out.push({
      projectId: String(row[iPid]||"").trim(),
      ym: rowYm,
      memberId: String(row[iMid]||"").trim(),
      plannedYen: (iPlan>=0) ? Number(row[iPlan]||0) : "",
      fixedYen: (iFix>=0) ? Number(row[iFix]||0) : "",
    });
  });

  return out;
}