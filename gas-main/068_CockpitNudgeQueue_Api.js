/** 068_CockpitNudgeQueue_Api.gs
 *  コックピット右カラム「つくよみナッジキュー」のAPI。
 *  複数DBを横断チェックし、PMが今見るべき情報を優先度順で返す。
 *
 *  公開関数:
 *  - cockpit_api_getNudgeQueue({ projectId })
 *
 *  依存:
 *  - B_Sheets.gs（b_readTableThin_）
 *  - B_Util.gs（b_normYm_）
 *  - DB_BillingCycle, DB_MonthlyReports, DB_Reimbursements, DB_MilestoneMonthlyProgress
 */

function cockpit_api_getNudgeQueue(payload) {
  try {
    var projectId = String((payload || {}).projectId || "").trim();
    if (!projectId) return { ok: true, items: [] };

    var now = new Date();
    var jst = new Date(now.getTime() + 9 * 3600000);
    var currentYm = String(jst.getFullYear()) + ("0" + (jst.getMonth() + 1)).slice(-2);
    var baseUrl = ScriptApp.getService().getUrl();

    var items = [];

    // ---- 1. 入金確認チェック（danger） ----
    try {
      items = items.concat(nudgeQ_checkPayment_(projectId, currentYm, baseUrl));
    } catch (e) { /* skip */ }

    // ---- 2. 請求書チェック（warn / ok） ----
    try {
      items = items.concat(nudgeQ_checkInvoice_(projectId, currentYm, baseUrl));
    } catch (e) { /* skip */ }

    // ---- 3. 月次報告書チェック（warn） ----
    try {
      items = items.concat(nudgeQ_checkReport_(projectId, currentYm));
    } catch (e) { /* skip */ }

    // ---- 4. 立替精算チェック（info） ----
    try {
      items = items.concat(nudgeQ_checkReimburse_(projectId, currentYm, baseUrl));
    } catch (e) { /* skip */ }

    // ---- 5. つくよみ推定未確認チェック（info） ----
    try {
      items = items.concat(nudgeQ_checkEstimates_(projectId, currentYm));
    } catch (e) { /* skip */ }

    // ---- 6. 先手力低下アラート（warn/danger） ----
    try {
      items = items.concat(nudgeQ_checkOriginRate_(projectId));
    } catch (e) { /* skip */ }

    // ---- 7. BillingCycle遅延タスクチェック（warn） ----
    try {
      items = items.concat(nudgeQ_checkBillingDelay_(projectId, currentYm, baseUrl));
    } catch (e) { /* skip */ }

    // ---- 8. スコープ・クリープチェック（warn） ----
    try {
      items = items.concat(nudgeQ_checkScopeCreep_(projectId, currentYm));
    } catch (e) { /* skip */ }

    return JSON.parse(JSON.stringify({ ok: true, items: items }));
  } catch (e) {
    return { ok: false, items: [], message: String(e) };
  }
}

// ===== 個別チェッカー =====

/** 入金確認：paymentDueDate超過 & paymentConfirmedAt空 */
function nudgeQ_checkPayment_(projectId, currentYm, baseUrl) {
  var items = [];
  var rows = nudgeQ_readBillingCycles_(projectId);
  var now = new Date();

  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (r.paymentConfirmedAt) continue;
    if (!r.freeeInvoiceId && !r.freeeInvoiceNumber) continue; // 請求書未発行

    var due = nudgeQ_parseDate_(r.paymentDueDate);
    if (!due) continue;

    var diffDays = Math.floor((now.getTime() - due.getTime()) / 86400000);
    if (diffDays > 0) {
      var ymLabel = nudgeQ_ymLabel_(r.ym);
      items.push({
        level: "danger",
        icon: "💰",
        text: ymLabel + "の入金確認が" + diffDays + "日超過",
        href: baseUrl + "?page=billing&projectId=" + encodeURIComponent(projectId) + "&ym=" + r.ym + "&focus=paymentCheck"
      });
    }
  }
  return items;
}

/** 請求書：発行済み未送付 or 送付完了 */
function nudgeQ_checkInvoice_(projectId, currentYm, baseUrl) {
  var items = [];
  var rows = nudgeQ_readBillingCycles_(projectId);

  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (String(r.ym) !== String(currentYm)) continue;

    var hasInvoice = !!(r.freeeInvoiceId || r.freeeInvoiceNumber);
    var hasSent = !!r.invoiceSentAt;

    if (hasInvoice && !hasSent) {
      items.push({
        level: "warn",
        icon: "📨",
        text: "請求書は発行済みだけど未送付",
        href: baseUrl + "?page=billing&projectId=" + encodeURIComponent(projectId) + "&ym=" + currentYm
      });
    } else if (hasInvoice && hasSent) {
      items.push({
        level: "ok",
        icon: "✅",
        text: "請求書の送付完了してるよ"
      });
    }
  }
  return items;
}

/** 月次報告書：25日以降のみdraft警告。月末最終3日はlevel上げ */
function nudgeQ_checkReport_(projectId, currentYm) {
  var items = [];
  var now = new Date();
  var jst = new Date(now.getTime() + 9 * 3600000);
  var dayOfMonth = jst.getDate();

  // 25日より前は何も出さない（自動更新中なので）
  if (dayOfMonth < 25) return items;

  try {
    var table = b_readTableThin_("DB_MonthlyReports", ["projectId", "ym", "status", "draftContent", "finalContent"]);
    for (var i = 0; i < table.length; i++) {
      var r = table[i];
      if (String(r.projectId).trim() !== projectId) continue;
      if (String(r.ym).trim() !== String(currentYm)) continue;

      var hasDraft = !!(r.draftContent || "").trim();
      var hasFinal = !!(r.finalContent || "").trim();

      if (hasDraft && !hasFinal) {
        var isUrgent = dayOfMonth >= 28;
        items.push({
          level: isUrgent ? "danger" : "warn",
          icon: "📝",
          text: isUrgent
            ? "月次報告書、月末までにFIXしよう！"
            : "月次報告書がdraftのまま。今月中にFIXしてね",
          action: "cpOpenModal('" + currentYm + "')"
        });
      } else if (!hasDraft && !hasFinal && dayOfMonth >= 28) {
        items.push({
          level: "warn",
          icon: "📝",
          text: "月次報告書がまだ生成されてない",
          action: "cpOpenModal('" + currentYm + "')"
        });
      }
      break;
    }
  } catch (e) { /* skip */ }
  return items;
}

/** 立替精算：当月の未承認件数 */
function nudgeQ_checkReimburse_(projectId, currentYm, baseUrl) {
  var items = [];
  try {
    var table = b_readTableThin_("DB_Reimbursements", [
      "projectId", "status", "pmApprovedAt", "adminApprovedAt", "billedYm", "date"
    ]);

    var ymPrefix = String(currentYm).substring(0, 4) + "-" + String(currentYm).substring(4);
    var total = 0;
    var pmPending = 0;
    var adminPending = 0;

    for (var i = 0; i < table.length; i++) {
      var r = table[i];
      if (String(r.projectId).trim() !== projectId) continue;

      var d = nudgeQ_toYmd_(r.date);
      if (!d.startsWith(ymPrefix)) continue;

      var status = String(r.status || "").trim().toLowerCase();
      if (status === "rejected" || status === "cancelled") continue;

      total++;
      if (!r.pmApprovedAt) pmPending++;
      else if (!r.adminApprovedAt) adminPending++;
    }

    if (total > 0 && (pmPending > 0 || adminPending > 0)) {
      var parts = [];
      if (pmPending > 0) parts.push("PM未承認" + pmPending + "件");
      if (adminPending > 0) parts.push("admin未承認" + adminPending + "件");
      items.push({
        level: "info",
        icon: "🧾",
        text: "立替" + total + "件（" + parts.join("・") + "）",
        href: baseUrl + "?page=reimburse"
      });
    }
  } catch (e) { /* skip */ }
  return items;
}

/** つくよみ推定：未確認の進捗推定 */
function nudgeQ_checkEstimates_(projectId, currentYm) {
  var items = [];
  try {
    var table = b_readTableThin_("DB_MilestoneMonthlyProgress", [
      "projectId", "ym", "source", "confirmedAt"
    ], "NAVIGATOR_SPREADSHEET_ID");

    var count = 0;
    for (var i = 0; i < table.length; i++) {
      var r = table[i];
      if (String(r.projectId).trim() !== projectId) continue;
      if (String(r.ym).trim() !== String(currentYm)) continue;
      if (String(r.source || "").trim() !== "tsukuyomi_estimate") continue;
      if (r.confirmedAt) continue;
      count++;
    }

    if (count > 0) {
      items.push({
        level: "info",
        icon: "🤖",
        text: "つくよみ推定" + count + "件、未確認だよ",
        action: "cpOpenModal('" + currentYm + "')"
      });
    }
  } catch (e) { /* skip - DB未作成の場合もある */ }
  return items;
}

/** BillingCycle遅延：今月のタスクで期限超過 */
function nudgeQ_checkBillingDelay_(projectId, currentYm, baseUrl) {
  var items = [];
  var rows = nudgeQ_readBillingCycles_(projectId);
  var now = new Date();
  var dayOfMonth = now.getDate();

  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (String(r.ym) !== String(currentYm)) continue;

    // 予算未確定（10日過ぎ）
    if (!r.budgetTotal && !r.budgetYen && dayOfMonth > 10) {
      items.push({
        level: "warn",
        icon: "💴",
        text: "今月の予算がまだ確定してない",
        href: baseUrl + "?page=billing&projectId=" + encodeURIComponent(projectId) + "&ym=" + currentYm
      });
    }

    // 請求書未発行（15日過ぎ）
    if (!r.freeeInvoiceId && !r.freeeInvoiceNumber && dayOfMonth > 15) {
      if (r.budgetTotal || r.budgetYen) {
        items.push({
          level: "warn",
          icon: "📄",
          text: "予算確定済みだけど請求書が未発行",
          action: "cpOpenInvoiceModal('" + currentYm + "')"
        });
      }
    }

    break;
  }
  return items;
}

// ===== ヘルパー =====

/** BillingCycleのキャッシュ付き読み込み */
var nudgeQ_billingCache_ = {};
function nudgeQ_readBillingCycles_(projectId) {
  if (nudgeQ_billingCache_[projectId]) return nudgeQ_billingCache_[projectId];
  var all = b_readTableThin_("DB_BillingCycle", [
    "projectId", "ym", "budgetTotal", "budgetYen",
    "freeeInvoiceId", "freeeInvoiceNumber",
    "invoiceSentAt", "paymentConfirmedAt", "paymentDueDate"
  ]);
  var filtered = [];
  for (var i = 0; i < all.length; i++) {
    if (String(all[i].projectId).trim() === projectId) filtered.push(all[i]);
  }
  nudgeQ_billingCache_[projectId] = filtered;
  return filtered;
}

function nudgeQ_parseDate_(v) {
  if (!v) return null;
  if (v instanceof Date && !isNaN(v.getTime())) return v;
  var d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d;
}

function nudgeQ_ymLabel_(ym) {
  var s = String(ym || "");
  if (s.length !== 6) return s;
  return s.substring(0, 4) + "/" + s.substring(4);
}

/** 先手力（Initiative Origin率）低下アラート */
function nudgeQ_checkOriginRate_(projectId) {
  var items = [];
  try {
    var table = b_readTableThin_("DB_ProgressEvents", [
      "projectId", "status", "initiativeOrigin"
    ]);

    var total = 0, amd = 0, co = 0, external = 0;
    for (var i = 0; i < table.length; i++) {
      var r = table[i];
      if (String(r.projectId).trim() !== projectId) continue;
      if (String(r.status || "").trim() === "rejected") continue;
      total++;
      var orig = String(r.initiativeOrigin || "").trim();
      if (orig === "amd_proposed") amd++;
      else if (orig === "co_decided") co++;
      else if (orig === "external") external++;
    }

    var judgeable = total - external;
    if (judgeable < 5) return items;

    var pct = Math.round((amd + co) / judgeable * 100);

    if (pct < 70) {
      items.push({
        level: "danger",
        icon: "⚫",
        text: "先手力 " + pct + "%（末期）。AMD起点の動きを増やそう",
        action: "cpOpenOriginModal()"
      });
    } else if (pct < 80) {
      items.push({
        level: "danger",
        icon: "🔴",
        text: "先手力 " + pct + "%（契約終了リスク）。依頼対応に追われてない？",
        action: "cpOpenOriginModal()"
      });
    } else if (pct < 90) {
      items.push({
        level: "warn",
        icon: "🟡",
        text: "先手力 " + pct + "%（危険水域）。AMD提案を意識しよう",
        action: "cpOpenOriginModal()"
      });
    }
  } catch (e) { /* skip */ }
  return items;
}

/** スコープ・クリープ検知：MSに紐づかないタスク or サブMSの新規追加 */
function nudgeQ_checkScopeCreep_(projectId, currentYm) {
  var items = [];

  // ① MSに紐づかないタスク（milestoneId空・pending除く）
  try {
    var tasks = tasks_listByProject(projectId).filter(function(t) {
      return t.status !== 'pending'
        && t.status !== 'deleted'
        && !t.milestoneId;
    });
    if (tasks.length > 0) {
      items.push({
        level: 'warn',
        icon: '⚠️',
        text: 'どのMSにも紐づかないタスクが' + tasks.length + '件ある。スコープ交渉を検討しよう',
        action: "cpLoadKanban()"
      });
    }
  } catch (e) { /* skip */ }

  // ② サブMSが当月新規追加された
  try {
    var planCycle = valuePlan_repo_getPlanCycle(projectId);
    if (planCycle && planCycle.planCycleId) {
      var msSheet  = valuePlan_repo_getMilestoneSheet();
      var data     = msSheet.getDataRange().getValues();
      var headers  = data[0];
      var ymIdx    = headers.indexOf('createdAt');
      var cycleIdx = headers.indexOf('planCycleId');
      var newSubMs = 0;
      var ymPrefix = String(currentYm).slice(0, 4) + '-' + String(currentYm).slice(4);
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][cycleIdx]) !== planCycle.planCycleId) continue;
        var created = data[i][ymIdx];
        if (!created) continue;
        var createdStr = created instanceof Date
          ? Utilities.formatDate(created, 'Asia/Tokyo', 'yyyy-MM')
          : String(created).slice(0, 7);
        if (createdStr === ymPrefix) newSubMs++;
      }
      if (newSubMs > 0) {
        items.push({
          level: 'warn',
          icon: '📐',
          text: '今月サブMSが' + newSubMs + '件追加された。スコープ拡大の可能性あり',
          action: "cpLoadGoals()"
        });
      }
    }
  } catch (e) { /* skip */ }

  return items;
}

/** コックピットモーダル用：PJ×月の立替一覧を返す */
function cockpit_api_getReimburseForMonth(payload) {
  try {
    var projectId = String((payload || {}).projectId || "").trim();
    var ym = String((payload || {}).ym || "").trim();
    if (!projectId || !ym) return { ok: true, items: [] };

    var ymPrefix = ym.substring(0, 4) + "-" + ym.substring(4);

    var table = b_readTableThin_("DB_Reimbursements", [
      "reimbursementId", "projectId", "date", "category", "amount", "taxRate",
      "desc", "transportMode", "transportFrom", "transportTo", "transportTrip",
      "status", "pmApprovedAt", "adminApprovedAt", "billedYm",
      "createdBy"
    ]);

    var categoryLabels = {
      "transport": "交通費",
      "accommodation": "宿泊",
      "supplies": "消耗品",
      "communication": "通信費",
      "meeting": "会議費",
      "other": "その他"
    };

    var items = [];
    for (var i = 0; i < table.length; i++) {
      var r = table[i];
      if (String(r.projectId).trim() !== projectId) continue;

      var d = nudgeQ_toYmd_(r.date);
      if (!d.startsWith(ymPrefix)) continue;

      var st = String(r.status || "").trim().toLowerCase();
      if (st === "cancelled") continue;

      items.push({
        date: d,
        category: r.category,
        categoryLabel: categoryLabels[String(r.category || "").trim()] || r.category || "",
        amount: Number(r.amount || 0),
        desc: r.desc || "",
        transportMode: r.transportMode || "",
        transportFrom: r.transportFrom || "",
        transportTo: r.transportTo || "",
        transportTrip: r.transportTrip || "",
        pmApprovedAt: r.pmApprovedAt || "",
        adminApprovedAt: r.adminApprovedAt || "",
        billedYm: r.billedYm || "",
        createdBy: r.createdBy || ""
      });
    }

    items.sort(function(a, b) {
      return String(a.date || "").localeCompare(String(b.date || ""));
    });

    return JSON.parse(JSON.stringify({ ok: true, items: items }));
  } catch (e) {
    return { ok: false, items: [], message: String(e) };
  }
}

/** Date型でも文字列でも yyyy-mm-dd に正規化 */
function nudgeQ_toYmd_(v) {
  if (!v) return "";
  if (v instanceof Date && !isNaN(v.getTime())) {
    var y = v.getFullYear();
    var m = ("0" + (v.getMonth() + 1)).slice(-2);
    var d = ("0" + v.getDate()).slice(-2);
    return y + "-" + m + "-" + d;
  }
  return String(v).trim();
}