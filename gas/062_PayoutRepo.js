/**
 * 062_PayoutRepo.gs
 * 役割：
 * - Payout周りのデータI/O（特にDB_Membersの振込先情報を正本化）
 * - DB_Members に bankInfo 列が無ければ自動で追加する（手書き禁止対策）
 *
 * 仕様：
 * - DB_Members のヘッダ行（1行目）を読み、必要列が無ければ末尾に追加
 * - bankInfo は複数行テキスト（コピペ用）として扱う
 */

function payoutGetMembersBasic(){
  const sh = payoutGetSheetByName("DB_Members");
  const header = payoutGetHeaderMap(sh);

  // 必須列
  const required = ["memberId", "codeName", "email"];
  required.forEach(k => {
    if (!header[k]) throw new Error(`DB_Members missing column: ${k}`);
  });

  // bankInfo は無ければ追加（手書き禁止対策）
  payoutEnsureMembersSchema();

  const header2 = payoutGetHeaderMap(sh);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return [];

  const lastCol = sh.getLastColumn();
  const values = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();

  const out = [];
  for (let i = 0; i < values.length; i++){
    const row = values[i];
    const memberId = String(row[header2.memberId - 1] || "").trim();
    if (!memberId) continue;

    out.push({
      memberId: memberId,
      codeName: String(row[header2.codeName - 1] || "").trim(),
      email: String(row[header2.email - 1] || "").trim(),
      memberName: header2.memberName ? String(row[header2.memberName - 1] || "").trim() : "",
      memberAddress: header2.memberAddress ? String(row[header2.memberAddress - 1] || "").trim() : "",
      bankInfo: header2.bankInfo ? String(row[header2.bankInfo - 1] || "").trim() : ""
    });
  }
  return out;
}

function payoutUpdateMemberBankInfo(payload){
  payload = payload || {};
  const memberId = String(payload.memberId || "").trim();
  const bankInfo = String(payload.bankInfo || "").trim();

  if (!memberId) throw new Error("memberId empty");

  const sh = payoutGetSheetByName("DB_Members");
  payoutEnsureMembersSchema();
  const header = payoutGetHeaderMap(sh);

  const lastRow = sh.getLastRow();
  if (lastRow < 2) throw new Error("DB_Members has no rows");

  const memberIdCol = header.memberId;
  const bankInfoCol = header.bankInfo;

  // memberId列から該当行を探す（直列検索：メンバー数少ない前提ならこれで十分）
  const ids = sh.getRange(2, memberIdCol, lastRow - 1, 1).getValues().map(r => String(r[0] || "").trim());
  let hitRow = -1;
  for (let i = 0; i < ids.length; i++){
    if (ids[i] === memberId){
      hitRow = i + 2; // 実シート行
      break;
    }
  }
  if (hitRow < 0) throw new Error(`memberId not found: ${memberId}`);

  sh.getRange(hitRow, bankInfoCol).setValue(bankInfo);

  return {
    ok: true,
    memberId: memberId,
    updatedAtJst: payoutNowJstIso()
  };
}

/**
 * DB_Members に bankInfo 列が無ければ追加する
 */
function payoutEnsureMembersSchema(){
  const sh = payoutGetSheetByName("DB_Members");
  const header = payoutGetHeaderMap(sh);

  // bankInfo（なければ追加）
  if (!header.bankInfo){
    const lastCol = sh.getLastColumn();
    sh.getRange(1, lastCol + 1).setValue("bankInfo");
  }

  // ★fullName は作らない。memberName を正本として使う（既存スキーマ尊重）
  return { ok: true };
}

// ---- helpers ----

function payoutGetSheetByName(name){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(name);
  if (!sh) throw new Error(`sheet not found: ${name}`);
  return sh;
}

function payoutGetHeaderMap(sh){
  const lastCol = sh.getLastColumn();
  if (lastCol < 1) throw new Error("sheet has no columns");

  const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0]
    .map(v => String(v || "").trim());

  const map = {};
  for (let i = 0; i < headers.length; i++){
    const h = headers[i];
    if (!h) continue;
    if (!map[h]) map[h] = i + 1; // 1-based col index
  }
  return map;
}

/**
 * DB_PayoutNotices のスキーマを保証（無ければ作る）
 */
function payoutEnsureNoticesSchema(){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName("DB_PayoutNotices");
  if (!sh){
    sh = ss.insertSheet("DB_PayoutNotices");
    sh.getRange(1,1,1,9).setValues([[
      "ym","memberId","freeeNoticeId","freeeNoticeNo","pdfUrl",
      "status","issuedAtJst","sentAtJst","updatedAtJst"
    ]]);
    return { ok:true, created:true };
  }
  return { ok:true, created:false };
}

/**
 * 発行/送付のUpsert
 */
function payoutUpsertNotice(row){
  payoutEnsureNoticesSchema();
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("DB_PayoutNotices");
  const header = payoutGetHeaderMap(sh);

  const ym = String(row.ym||"").trim();
  const memberId = String(row.memberId||"").trim();
  if (!ym || !memberId) throw new Error("ym/memberId empty");

  const lastRow = sh.getLastRow();
  const rows = lastRow>=2 ? sh.getRange(2,1,lastRow-1,sh.getLastColumn()).getValues() : [];
  let hit = -1;
  for (let i=0;i<rows.length;i++){
    if (String(rows[i][header.ym-1])===ym && String(rows[i][header.memberId-1])===memberId){
      hit = i+2; break;
    }
  }

  const now = payoutNowJstIso();
  const values = [];
  values[header.ym-1] = ym;
  values[header.memberId-1] = memberId;
  values[header.freeeNoticeId-1] = String(row.freeeNoticeId||"");
  values[header.freeeNoticeNo-1] = String(row.freeeNoticeNo||"");
  values[header.pdfUrl-1] = String(row.pdfUrl||"");
  values[header.status-1] = String(row.status||"");
  values[header.issuedAtJst-1] = String(row.issuedAtJst||"");
  values[header.sentAtJst-1] = String(row.sentAtJst||"");
  values[header.updatedAtJst-1] = now;

  if (hit>0){
    sh.getRange(hit,1,1,sh.getLastColumn()).setValues([values]);
  } else {
    sh.appendRow(values);
  }
  return { ok:true };
}

/**
 * ym の通知状態を取得
 */
function payoutGetNoticesByYm(ym){
  payoutEnsureNoticesSchema();
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("DB_PayoutNotices");
  const header = payoutGetHeaderMap(sh);
  const out = {};
  const lastRow = sh.getLastRow();
  if (lastRow<2) return out;

  const rows = sh.getRange(2,1,lastRow-1,sh.getLastColumn()).getValues();
  rows.forEach(r=>{
    if (String(r[header.ym-1])!==ym) return;
    const mid = String(r[header.memberId-1]||"");
    if (!mid) return;
    out[mid] = {
      freeeNoticeId: String(r[header.freeeNoticeId-1]||""),
      freeeNoticeNo: String(r[header.freeeNoticeNo-1]||""),
      pdfUrl: String(r[header.pdfUrl-1]||""),
      status: String(r[header.status-1]||""),
      issuedAtJst: String(r[header.issuedAtJst-1]||""),
      sentAtJst: String(r[header.sentAtJst-1]||"")
    };
  });
  return out;
}
