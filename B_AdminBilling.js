// 管理系の初期化やAdmin操作。
/**
 * B_AdminBilling.gs
 *
 * 目的：
 * Billing周辺の管理者操作を隔離し、本体フロー（PM/クルー操作）と切り離す。
 * テスト/移行/スキーマ初期化/承認など “強い操作” をここに集約する。
 *
 * このファイルが担当するもの：
 * - admin_initBillingSchema（DBヘッダ保証の一括実行）
 * - 管理者承認系API（例：freee取引先の最終承認など）
 *
 * ルール：
 * - admin only を必須にし、ログや更新理由を残す。
 * - 既存の古いユーティリティ名（getSheet_/ensureHeader_等）に依存している場合は
 *   “互換レイヤー”としてここに閉じ込め、コアへ波及させない。
 */

// ====== Admin init: run once (or when schema changes) ======
function admin_initBillingSchema(){
  if (typeof canAccessAdminPage_ === "function" && !canAccessAdminPage_()){
    return { ok:false, message:"access denied" };
  }

  // BillingCycle
  b_ensureBillingCycleHeader_();

  // PayoutDetail
  b_ensureHeader_("DB_PayoutDetail", ["projectId","ym","memberId","plannedYen","fixedYen","updatedAt"]);

  // PayoutAgreement
  b_ensureHeader_("DB_PayoutAgreement", [
    "projectId","ym","version","memberId","token",
    "budgetYen","plannedYen","agreedAt","createdAt","updatedAt"
  ]);

  // BillingLog
  b_ensureBillingLogHeader_();

  return { ok:true, message:"schema ensured" };
}

function api_adminApproveFreeePartner(payload){
  try{
    // admin only
    if (typeof isAdmin_ === "function" && !isAdmin_()) {
      return { ok:false, message:"admin only" };
    }

    const projectId = String(payload && payload.projectId ? payload.projectId : "").trim();
    const officialName = String(payload && payload.invoicePartnerOfficialName ? payload.invoicePartnerOfficialName : "").trim();

    if (!projectId) return { ok:false, message:"projectId required" };
    if (!officialName) return { ok:false, message:"invoicePartnerOfficialName required" };

    // DB_Projects を読む（共通ヘルパがある前提：getSheet_ / ensureHeader_ / indexMapFromHeader_）
    if (typeof getSheet_ !== "function") return { ok:false, message:"getSheet_ not found" };
    if (typeof ensureHeader_ !== "function") return { ok:false, message:"ensureHeader_ not found" };
    if (typeof indexMapFromHeader_ !== "function") return { ok:false, message:"indexMapFromHeader_ not found" };

    // freee側の確定関数（既存前提）
    if (typeof b_freeeEnsurePartnerByName_ !== "function") {
      return { ok:false, message:"b_freeeEnsurePartnerByName_ not found" };
    }

    const sh = getSheet_("DB_Projects");
    const header = ensureHeader_(sh, [
      "projectId","projectName",
      // 互換用に clientName は残す（既存UIが参照しても壊れないようにする）
      "clientName",
      // 新設：PM入力候補（adminが最終編集して上書きする）
      "invoicePartnerOfficialName",
      "status","notes","createdAt","updatedAt",
      // freee確定（admin承認で入る）
      "freeePartnerId","freeePartnerName",
      // 任意だけどUX強い
      "freeePartnerStatus",
      // 既存があれば使う
      "clientLocked"
    ]);
    const idx = indexMapFromHeader_(header);

    if (idx.projectId < 0) return { ok:false, message:"DB_Projects has no projectId column" };

    const values = sh.getDataRange().getValues();

    // 対象行検索
    let row = -1;
    for (let r = 1; r < values.length; r++){
      if (String(values[r][idx.projectId] || "").trim() === projectId){
        row = r + 1; // 1-indexed
        break;
      }
    }
    if (row < 0) return { ok:false, message:"project not found: " + projectId };

    // freee確定（完全一致があれば採用、なければ作成）
    let ensured;
    try{
      ensured = b_freeeEnsurePartnerByName_(officialName);
    } catch(e){
      // freeeで落ちても、候補名の上書きとステータス error は残す（再実行しやすくする）
      const now = new Date();

      if (idx.invoicePartnerOfficialName >= 0) sh.getRange(row, idx.invoicePartnerOfficialName + 1).setValue(officialName);
      if (idx.clientName >= 0) sh.getRange(row, idx.clientName + 1).setValue(officialName);

      if (idx.freeePartnerStatus >= 0) sh.getRange(row, idx.freeePartnerStatus + 1).setValue("error");
      if (idx.updatedAt >= 0) sh.getRange(row, idx.updatedAt + 1).setValue(now);

      return { ok:false, message:"freee ensure failed: " + (e && e.message ? e.message : String(e)) };
    }

    const partnerId = String(ensured && ensured.partnerId ? ensured.partnerId : "").trim();
    const partnerName = String(ensured && ensured.partnerName ? ensured.partnerName : officialName).trim();

    if (!partnerId){
      const now = new Date();

      if (idx.invoicePartnerOfficialName >= 0) sh.getRange(row, idx.invoicePartnerOfficialName + 1).setValue(officialName);
      if (idx.clientName >= 0) sh.getRange(row, idx.clientName + 1).setValue(officialName);

      if (idx.freeePartnerStatus >= 0) sh.getRange(row, idx.freeePartnerStatus + 1).setValue("error");
      if (idx.updatedAt >= 0) sh.getRange(row, idx.updatedAt + 1).setValue(now);

      return { ok:false, message:"freee partnerId empty (ensure result invalid)" };
    }

    // DB更新（承認確定）
    const now = new Date();

    if (idx.invoicePartnerOfficialName >= 0) sh.getRange(row, idx.invoicePartnerOfficialName + 1).setValue(officialName);
    if (idx.clientName >= 0) sh.getRange(row, idx.clientName + 1).setValue(officialName); // 互換

    if (idx.freeePartnerId >= 0) sh.getRange(row, idx.freeePartnerId + 1).setValue(partnerId);
    if (idx.freeePartnerName >= 0) sh.getRange(row, idx.freeePartnerName + 1).setValue(partnerName);

    if (idx.freeePartnerStatus >= 0) sh.getRange(row, idx.freeePartnerStatus + 1).setValue("linked");
    if (idx.clientLocked >= 0) sh.getRange(row, idx.clientLocked + 1).setValue(true);

    if (idx.updatedAt >= 0) sh.getRange(row, idx.updatedAt + 1).setValue(now);

    return {
      ok:true,
      projectId: projectId,
      invoicePartnerOfficialName: officialName,
      freeePartnerId: partnerId,
      freeePartnerName: partnerName
    };

  } catch(e){
    return { ok:false, message: e && e.message ? e.message : String(e) };
  }
}