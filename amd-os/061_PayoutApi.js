/**
 * 061_PayoutApi.gs
 * 役割：
 * Admin「Payouts」タブ向けのAPI入口。
 * - admin_getPayoutTable：対象ym(yyyymm)の支払テーブルを返す（まずはダミー返却でUI接続を確認）
 *
 * 方針：
 * - ここは“入口”に徹して、DBや計算ロジックは 062_PayoutRepo / 063_PayoutDomain に寄せる
 * - 返却は UI がそのまま描画できる形に統一する
 */

// ---- tiny utils ----
function payout_nowJstIso(){
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

function payoutAssertAdmin(){
  // 既存のAdmin権限関数があればそれを使う
  try{
    if (typeof canAccessAdmin === "function"){
      if (!canAccessAdmin()) throw new Error("access denied");
      return;
    }
  } catch(e){
    throw e;
  }

  // フォールバック（最低限）：許可メールだけ通す
  const me = String(Session.getActiveUser().getEmail() || "").toLowerCase().trim();
  const allowedFallback = ["masa@team-armada.jp", "kyoko@team-armada.jp"];
  if (!allowedFallback.includes(me)){
    throw new Error("access denied");
  }
}

function payoutNormYm(v){
  const ym = String(v || "").trim();
  if (!/^\d{6}$/.test(ym)) throw new Error("ym invalid (yyyymm)");
  return ym;
}

// ---- public API ----

/**
 * Admin Payouts：対象ymのテーブル情報を返す
 * payload: { ym: "202602" }
 *
 * 返却形：
 * {
 *   ok: true,
 *   ym: "202602",
 *   rows: [
 *     {
 *       memberId, codeName, email,
 *       bankText,
 *       payouts: [{ projectId, projectName, yen, routineStatus, cashInStatus }],
 *       totalYen,
 *       notice: { status, freeeId, freeeNo, pdfUrl, issuedAtJst, sentAtJst },
 *       canIssueNotice, canSendNotice, canMarkPaid,
 *       blockReasons: [ ... ],
 *       paid: { isPaid, checkedAtJst, checkedBy }
 *     }
 *   ],
 *   meta: { generatedAtJst, note }
 * }
 */
function admin_getPayoutTable(payload){
  try{
    payoutAssertAdmin();

    payload = payload || {};
    const ym = payoutNormYm(payload.ym);

    // ★ Domain に全委譲
    const rows = payoutBuildRows(ym); // 063_PayoutDomain.gs

    return {
      ok: true,
      ym: ym,
      rows: rows,
      meta: {
        generatedAtJst: payoutNowJstIso(),
        note: "domain connected"
      }
    };

  } catch(e){
    return {
      ok: false,
      message: e && e.message ? e.message : String(e),
      ym: (payload && payload.ym) ? String(payload.ym) : ""
    };
  }
}

/**
 * 061_PayoutApi.gs
 * 役割：
 * - Admin UI からのPayout操作API
 * - 権限チェック、入力チェック、Domain呼び出しのみ
 */

function admin_issuePayoutNotice(payload){
  payload = payload || {};
  const memberId = String(payload.memberId||"").trim();
  const ym = String(payload.ym||"").trim();
  if (!memberId || !ym) return { ok:false, message:"param missing" };

  payoutAssertAdmin();

  try{
    const created = payoutIssueNotice(ym, memberId); // 063（Domain）
    return {
      ok:true,
      freeeNoticeId: String(created.freeeNoticeId || ""),
      freeeNoticeNo: String(created.freeeNoticeNo || ""),
      pdfUrl: String(created.pdfUrl || ""),
      issuedAtJst: String(created.issuedAtJst || "")
    };
  } catch(e){
    return { ok:false, message:String(e && e.message ? e.message : e) };
  }
}

