/**
 * 063_PayoutDomain.gs
 * 役割：
 * - 支払（Payout）のドメインロジック
 * - メンバーごとの支払内訳・状態・操作可否を組み立てる
 *
 * 注意：
 * - DBアクセスは 062_PayoutRepo に寄せる
 * - freee / mail は直接触らない（064/065に委譲）
 */

/**
 * 対象月のPayout行を組み立てる
 * @param {string} ym yyyymm
 * @returns {Array} rows (Admin UI 用)
 */
function payoutIssueNotice(ym, memberId){
  ym = String(ym||"").trim();
  memberId = String(memberId||"").trim();
  if (!/^\d{6}$/.test(ym)) throw new Error("ym invalid（yyyymm）");
  if (!memberId) throw new Error("memberId empty");

  // Domainから“正本の支払額”を取る（UIからtotalYenを受け取らない）
  const rows = payoutBuildRows(ym);
  const row = (Array.isArray(rows) ? rows : []).find(r => String(r.memberId||"").trim() === memberId);
  if (!row) throw new Error("row not found（refreshして）");

  const totalYen = Number(row.totalYen || 0);
  if (!isFinite(totalYen) || totalYen <= 0) throw new Error("totalYen is 0（支払対象なし）");

  // 内訳テキスト
  const lines = (Array.isArray(row.payouts) ? row.payouts : []).map(p=>{
    const pn = String(p.projectName || p.projectId || "").trim();
    const yen = Number(p.yen || 0);
    return `${pn}\t${Math.round(yen).toLocaleString("ja-JP")}円`;
  });
  const breakdownText = lines.join("\n");

  // 064（Integration）に委譲：PDF生成→Drive保存
  const created = payoutCreateFreeeNotice({
    memberId,
    ym,
    totalYen,
    breakdownText
  });

  // DBへ永続化（発行済み）
  payoutUpsertNotice({
    ym, memberId,
    freeeNoticeId: String(created.freeeNoticeId || ""),
    freeeNoticeNo: String(created.freeeNoticeNo || ""),
    pdfUrl: String(created.pdfUrl || ""),
    status: "issued",
    issuedAtJst: String(created.issuedAtJst || payoutNowJstIso())
  });

  return created;
}

function payoutBuildRows(ym){
  const members = payoutGetMembersBasic(); // 062

  const allocs = payoutFetchPlannedAllocations(ym);
  const routineMap = payoutFetchMonthlyRoutineStatus(ym);
  const cashInMap  = payoutFetchCashInStatus(ym);

  // ★通知書ログ（永続化）を反映
  const noticeMap = payoutGetNoticesByYm(ym); // 062

  // ★振込完了（永続化）を反映
  const paidMap = (typeof payoutGetPaidMapByYm === "function")
    ? payoutGetPaidMapByYm(ym)   // 066
    : {};

  // memberId で束ねる
  const byMember = {};
  allocs.forEach(a=>{
    if (!byMember[a.memberId]) byMember[a.memberId] = [];
    byMember[a.memberId].push({
      projectId: a.projectId,
      projectName: a.projectName,
      yen: Number(a.yen||0),
      routineStatus: routineMap[a.projectId] || "pending",
      cashInStatus:  cashInMap[a.projectId]  || "pending"
    });
  });

  return members.map(m=>{
    const payouts = byMember[m.memberId] || [];
    const totalYen = payouts.reduce((s,p)=> s + Number(p.yen||0), 0);

    const allRoutineDone = payouts.length ? payouts.every(p=>p.routineStatus==="done") : false;
    const allCashInDone  = payouts.length ? payouts.every(p=>p.cashInStatus==="done")  : false;

    // ★通知書の復元
    const savedNotice = noticeMap[m.memberId] || {};
    const notice = {
      status: String(savedNotice.status || "none").trim() || "none",
      freeeId: String(savedNotice.freeeNoticeId || "").trim(),
      freeeNo: String(savedNotice.freeeNoticeNo || "").trim(),
      pdfUrl: String(savedNotice.pdfUrl || "").trim(),
      issuedAtJst: String(savedNotice.issuedAtJst || "").trim(),
      sentAtJst: String(savedNotice.sentAtJst || "").trim()
    };

    // 配賦が空でも、将来の確認・編集のため行は出す
    const canIssueNotice = totalYen > 0;

    // ★「issued」になったら送付可（永続状態に従う）
    const canSendNotice  = (notice.status === "issued");

    // ★暫定ゲート（このまま）
    const canMarkPaid    = allRoutineDone && allCashInDone;

    const blockReasons = [];
    if (!totalYen) blockReasons.push("支払額が0円");
    if (payouts.length && !allRoutineDone) blockReasons.push("未完了の月次ルーティンあり");
    if (payouts.length && !allCashInDone)  blockReasons.push("未着金のPJあり");

    // ★paid 復元（永続化の正本）
    const savedPaid = paidMap[m.memberId] || {};
    const paid = {
      isPaid: !!savedPaid.isPaid,
      checkedAtJst: String(savedPaid.checkedAtJst || "").trim(),
      checkedBy: String(savedPaid.checkedBy || "").trim(),
      note: String(savedPaid.note || "").trim()
    };

    return {
      memberId: m.memberId,
      codeName: m.codeName,
      email: m.email,
      bankText: m.bankInfo || "",

      payouts, totalYen,

      notice: {
        status: notice.status,
        freeeId: notice.freeeId,
        freeeNo: notice.freeeNo,
        pdfUrl: notice.pdfUrl,
        issuedAtJst: notice.issuedAtJst,
        sentAtJst: notice.sentAtJst
      },

      canIssueNotice, canSendNotice, canMarkPaid, blockReasons,

      paid: paid
    };
  });
}


/**
 * 振込完了にしてよいか？
 * @param row
 */
function payoutCanMarkPaid(row){
  // 将来：
  // - payouts が1件以上
  // - 全PJで routineStatus === done
  // - 全PJで cashInStatus === done
  return false;
}

/**
 * JST現在時刻（ISO文字列）
 * 全Payout系の正本
 */
function payoutNowJstIso(){
  const d = new Date();
  const j = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const yyyy = j.getUTCFullYear();
  const mm = String(j.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(j.getUTCDate()).padStart(2, "0");
  const hh = String(j.getUTCHours()).padStart(2, "0");
  const mi = String(j.getUTCMinutes()).padStart(2, "0");
  const ss = String(j.getUTCSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}+09:00`;
}

// 支払予定（member×project）
// 正本：DB_BillingCycle.memberAllocationsJson（allocation_confirmed前提）
function payoutFetchPlannedAllocations(ym){
  try{
    const sh = payoutGetSheetByName("DB_BillingCycle"); // 062にある helper を流用
    const header = payoutGetHeaderMap(sh);

    if (!header.projectId || !header.projectName || !header.ym || !header.memberAllocationsJson || !header.status){
      throw new Error("DB_BillingCycle missing required columns");
    }

    const lastRow = sh.getLastRow();
    if (lastRow < 2) return [];

    const lastCol = sh.getLastColumn();
    const values = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();

    const out = [];
    for (let i = 0; i < values.length; i++){
      const row = values[i];

      const rowYm = String(row[header.ym - 1] || "").trim();
      if (rowYm !== ym) continue;

      const status = String(row[header.status - 1] || "").trim().toLowerCase();
      // allocation_confirmed のときだけ正本として採用
      if (status !== "allocation_confirmed") continue;

      const projectId = String(row[header.projectId - 1] || "").trim();
      if (!projectId) continue;

      const projectName = String(row[header.projectName - 1] || "").trim() || projectId;

      const jsonStr = String(row[header.memberAllocationsJson - 1] || "").trim();
      if (!jsonStr) continue;

      let obj = null;
      try{
        obj = JSON.parse(jsonStr);
      } catch(e){
        console.warn("[Payout] memberAllocationsJson parse failed projectId=", projectId, "ym=", ym);
        continue;
      }
      if (!obj || typeof obj !== "object") continue;

      // obj: {"ID001":1234,"ID002":2345}
      Object.keys(obj).forEach(memberId => {
        const mid = String(memberId || "").trim();
        if (!mid) return;

        const yen = Number(obj[memberId] || 0);
        if (!isFinite(yen) || yen <= 0) return; // 0以下は支払対象にしない

        out.push({
          memberId: mid,
          projectId: projectId,
          projectName: projectName,
          yen: Math.round(yen)
        });
      });
    }

    return out;

  } catch(e){
    console.warn("[Payout] payoutFetchPlannedAllocations:", e.message, "ym=", ym);
    return [];
  }
}

// 月次ルーティン完了（projectId -> done/pending）
// 仮ルール：monthlyReportFileId or monthlyReportUrl があれば done
function payoutFetchMonthlyRoutineStatus(ym){
  try{
    const sh = payoutGetSheetByName("DB_BillingCycle");
    const header = payoutGetHeaderMap(sh);

    if (!header.projectId || !header.ym){
      throw new Error("DB_BillingCycle missing required columns");
    }

    const hasFileId = !!header.monthlyReportFileId;
    const hasUrl = !!header.monthlyReportUrl;

    const lastRow = sh.getLastRow();
    if (lastRow < 2) return {};

    const lastCol = sh.getLastColumn();
    const values = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();

    const map = {};
    for (let i = 0; i < values.length; i++){
      const row = values[i];
      const rowYm = String(row[header.ym - 1] || "").trim();
      if (rowYm !== ym) continue;

      const projectId = String(row[header.projectId - 1] || "").trim();
      if (!projectId) continue;

      const fileId = hasFileId ? String(row[header.monthlyReportFileId - 1] || "").trim() : "";
      const url = hasUrl ? String(row[header.monthlyReportUrl - 1] || "").trim() : "";

      map[projectId] = (fileId || url) ? "done" : "pending";
    }
    return map;

  } catch(e){
    console.warn("[Payout] payoutFetchMonthlyRoutineStatus:", e.message, "ym=", ym);
    return {};
  }
}

// 着金（projectId -> done/pending）
// 仮ルール：paymentConfirmedAt があれば done
function payoutFetchCashInStatus(ym){
  try{
    const sh = payoutGetSheetByName("DB_BillingCycle");
    const header = payoutGetHeaderMap(sh);

    if (!header.projectId || !header.ym || !header.paymentConfirmedAt){
      throw new Error("DB_BillingCycle missing required columns");
    }

    const lastRow = sh.getLastRow();
    if (lastRow < 2) return {};

    const lastCol = sh.getLastColumn();
    const values = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();

    const map = {};
    for (let i = 0; i < values.length; i++){
      const row = values[i];
      const rowYm = String(row[header.ym - 1] || "").trim();
      if (rowYm !== ym) continue;

      const projectId = String(row[header.projectId - 1] || "").trim();
      if (!projectId) continue;

      const paidAt = String(row[header.paymentConfirmedAt - 1] || "").trim();
      map[projectId] = paidAt ? "done" : "pending";
    }
    return map;

  } catch(e){
    console.warn("[Payout] payoutFetchCashInStatus:", e.message, "ym=", ym);
    return {};
  }
}

