/** A155_AdminMembers.gs
 * Admin用：メンバーDBのヘッダ保証・adminフラグ運用など
 * - DB_Members に isAdmin 列を自動追加
 * - 既存運用を壊さずに段階的に導入するための基盤
 */

function admin_ensureMembersAdminColumn(){
  // admin権限チェック（環境差吸収）
  var isAdmin = false;
  try{
    if (typeof canAccessAdmin === "function") isAdmin = !!canAccessAdmin();
  } catch(_e){}
  if (!isAdmin){
    try{
      if (typeof canAccessAdminForCodeSearch === "function") isAdmin = !!canAccessAdminForCodeSearch();
    } catch(_e2){}
  }
  if (!isAdmin){
    return { ok:false, message:"admin only" };
  }

  var sh = getSheetOrCreate_("DB_Members");

  // 既存ヘッダに追加（無ければ末尾に追加）
  // ensureHeader_ は既にプロジェクトにある前提（他でも使ってる）
  ensureHeader_(sh, ["isAdmin"]);

  // 追加した列が空の行にだけ "false" を埋める（運用がラク）
  // ただし既に値がある行は上書きしない
  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();
  if (lastRow < 2) return { ok:true, message:"DB_Members empty but header ensured" };

  var header = sh.getRange(1,1,1,lastCol).getValues()[0].map(function(x){ return String(x||"").trim(); });
  var iIsAdmin = header.indexOf("isAdmin");
  if (iIsAdmin < 0) return { ok:false, message:"failed to ensure isAdmin header" };

  var vals = sh.getRange(2,1,lastRow-1,lastCol).getValues();
  var changed = 0;

  for (var r=0; r<vals.length; r++){
    var v = String(vals[r][iIsAdmin] || "").trim().toLowerCase();
    if (v === ""){
      sh.getRange(r+2, iIsAdmin+1).setValue("false");
      changed++;
    }
  }

  return { ok:true, message:"isAdmin ensured", filledFalse: changed };
}
