/**
 * R314_MonthlySlide_Gen.gs
 * 月次進捗スライドの自動生成。
 * テンプレートGoogle Slidesをコピーし、DB各所からデータを収集してプレースホルダーを置換する。
 *
 * 依存: 304_MonthlyReport_Repo, 060_RewardV2系, 055_ProjectCockpit_Api, DB_Projects, DB_BillingCycle, DB_Milestones
 */

// ★ テンプレートのGoogle SlidesファイルID（Script Propertiesから取得）
function slide_getTemplateId_() {
  return PropertiesService.getScriptProperties().getProperty("MONTHLY_REPORT_SLIDE_TEMPLATE_ID") || "";
}

/**
 * 指定PJ×ymのスライドを生成して返す
 * @param {string} projectId
 * @param {string} ym - yyyymm
 * @return {Object} { ok, slideId, slideUrl, fileName, error }
 */
function slide_generateForProject(projectId, ym) {
  var pid = String(projectId || "").trim();
  var ymStr = String(ym || "").trim();
  if (!pid || !ymStr) return { ok: false, error: "projectId/ym必須" };

  var templateId = slide_getTemplateId_();
  if (!templateId) return { ok: false, error: "MONTHLY_REPORT_SLIDE_TEMPLATE_IDが未設定" };

  try {
    // 1. データ収集
    var data = slide_collectData_(pid, ymStr);
    if (!data.ok) return { ok: false, error: "データ収集失敗: " + (data.error || "") };

    // 2. テンプレコピー
    var templateFile = DriveApp.getFileById(templateId);
    var ymLabel = ymStr.substring(0, 4) + "-" + ymStr.substring(4);
    var fileName = data.projectName + "_月次進捗_" + ymLabel;
    var copy = templateFile.makeCopy(fileName);
    var slideId = copy.getId();

    // 3. プレースホルダー置換
    var pres = SlidesApp.openById(slideId);
    slide_replaceAll_(pres, data);

    // 4. スライド2: MS進捗ダッシュボードを動的描画
    slide_drawMilestoneDashboard_(pres, data);

    pres.saveAndClose();

    // 4. PJのDriveフォルダに移動
    var slideUrl = "https://docs.google.com/presentation/d/" + slideId;
    if (data.driveFolderId) {
      try {
        var folder = DriveApp.getFolderById(data.driveFolderId);
        var file = DriveApp.getFileById(slideId);
        file.moveTo(folder);
      } catch (e) {
        Logger.log("[slide_gen] フォルダ移動失敗（スライド自体は作成済み）: " + e);
      }
    }

    // 5. DB_MonthlyReportsにslideFileIdを記録（列があれば）
    try {
      slide_repo_saveSlideId_(pid, ymStr, slideId);
    } catch (e) {
      Logger.log("[slide_gen] slideFileId保存スキップ: " + e);
    }

    Logger.log("[slide_gen] 完了: " + pid + " " + ymStr + " → " + slideId);
    return { ok: true, slideId: slideId, slideUrl: slideUrl, fileName: fileName };

  } catch (e) {
    Logger.log("[slide_gen] エラー: " + pid + " " + ymStr + " " + e);
    return { ok: false, error: String(e) };
  }
}

// =============================================
// データ収集
// =============================================
function slide_collectData_(projectId, ym) {
  var result = {
    ok: false,
    projectId: projectId,
    ym: ym,
    // Cover
    projectName: "",
    clientName: "",
    periodDisplay: "",
    reportDate: "",
    // Summary
    stage: "-",
    completion: "-",
    status: "-",
    monthlySummary: "",
    // Milestones (最大4行)
    milestones: [],
    scoreEarned: "0",
    scoreTotal: "0",
    scoreComment: "",
    expectedProgressPct: 0,
    risksIssues: "",
    // Billing
    billingAmount: "-",
    billingCumulative: "-",
    billingStatus: "-",
    billingPeriodRange: "-",
    budgetConfirmed: "-",
    invoiceSent: "-",
    paymentConfirmed: "-",
    billItems: [],
    // Actions (最大5行)
    actions: [],
    originAmd: 0,
    originCo: 0,
    originClient: 0,
    // Drive
    driveFolderId: ""
  };

  // --- PJ基本情報 ---
  try {
    var projects = b_cachedReadProjects_();
    var pj = null;
    for (var i = 0; i < projects.length; i++) {
      if (String(projects[i].projectId || "").trim() === projectId) { pj = projects[i]; break; }
    }
    if (pj) {
      result.projectName = String(pj.projectName || projectId);
      result.clientName = String(pj.clientName || "");
      result.status = String(pj.status || "-");
      result.driveFolderId = String(pj.driveFolderId || "");
    } else {
      result.projectName = projectId;
    }
  } catch (e) {
    Logger.log("[slide_collect] PJ情報取得失敗: " + e);
    result.projectName = projectId;
  }

  // Cover
  result.periodDisplay = ym.substring(0, 4) + "年" + ym.substring(4) + "月";
  var now = new Date();
  var jstOffset = 9 * 60 * 60 * 1000;
  var jst = new Date(now.getTime() + jstOffset);
  result.reportDate = jst.getFullYear() + "-"
    + String(jst.getMonth() + 1).padStart(2, "0") + "-"
    + String(jst.getDate()).padStart(2, "0");

  // --- 月次報告書（スライド用サマリー優先、なければエグサマから抽出） ---
  try {
    var report = mr_repo_getByProjectYm_(projectId, ym);
    if (report) {
      var content = String(report.finalContent || report.draftContent || "");
      // まずスライド用サマリーセクションを探す
      var slideSummary = slide_extractSlideSummary_(content);
      if (slideSummary) {
        result.monthlySummary = slideSummary;
      } else {
        // フォールバック: エグゼクティブサマリーから
        result.monthlySummary = slide_extractExecSummary_(content, 300);
      }
    }
  } catch (e) {
    Logger.log("[slide_collect] 月次報告書取得失敗: " + e);
  }

  // --- マイルストーン ---
  try {
    var msData = slide_getMilestoneData_(projectId, ym);
    if (msData) {
      result.milestones = msData.milestones || [];
      result.scoreEarned = String(msData.scoreEarned || "0");
      result.scoreTotal = String(msData.scoreTotal || "0");
      result.scoreComment = String(msData.scoreComment || "");
      result.completion = String(msData.progressPct || "0") + "%";
      result.expectedProgressPct = Number(msData.expectedProgressPct || 0);
    }
  } catch (e) {
    Logger.log("[slide_collect] MS取得失敗: " + e);
  }

  // --- BillingCycle ---
  try {
    var cycle = b_getCycleOne_(projectId, ym);
    if (cycle) {
      var fmtYen = function(v) {
        if (!v && v !== 0) return "-";
        return "¥" + String(Number(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      };
      result.billingAmount = fmtYen(cycle.budgetTotal || cycle.budgetYen);
      result.budgetConfirmed = cycle.budgetConfirmedAt ? "✅" : "未";
      result.invoiceSent = cycle.invoiceSentAt ? "✅" : "未";
      result.paymentConfirmed = cycle.paymentConfirmedAt ? "✅" : "未";

      // ステータス文字列
      if (cycle.paymentConfirmedAt) result.billingStatus = "入金確認済";
      else if (cycle.invoiceSentAt) result.billingStatus = "請求書送付済";
      else if (cycle.budgetConfirmedAt) result.billingStatus = "予算確定済";
      else result.billingStatus = "未着手";

      // 期間
      var ymY = ym.substring(0, 4);
      var ymM = ym.substring(4);
      result.billingPeriodRange = ymY + "年" + ymM + "月";
    }

    // 累計請求額（全BillingCycle合算）
    try {
      var allCycles = b_readBillingCycleForProject_(projectId);
      if (allCycles && allCycles.length) {
        var cumulative = 0;
        for (var c = 0; c < allCycles.length; c++) {
          var cy = allCycles[c];
          var cyAmt = Number(cy.budgetTotal || cy.budgetYen || 0);
          if (String(cy.ym || "") <= ym && cyAmt > 0) {
            cumulative += cyAmt;
          }
        }
        result.billingCumulative = cumulative > 0
          ? ("¥" + String(cumulative).replace(/\B(?=(\d{3})+(?!\d))/g, ","))
          : "-";
      }
    } catch (e2) {
      Logger.log("[slide_collect] 累計算出スキップ: " + e2);
    }

    // 明細（freee連携があれば取れるが、今はBillingCycleから1行だけ）
    if (cycle && (cycle.budgetTotal || cycle.budgetYen)) {
      result.billItems = [{
        item: result.projectName + " 業務委託費",
        qty: "1",
        unit: result.billingAmount,
        amount: result.billingAmount
      }];
    }
  } catch (e) {
    Logger.log("[slide_collect] Billing取得失敗: " + e);
  }

  // --- 報酬イベント（Origin集計 + アクション抽出） ---
  try {
    var evData = slide_getEventData_(projectId, ym);
    if (evData) {
      result.actions = evData.actions || [];
      result.originAmd = evData.originAmd || 0;
      result.originCo = evData.originCo || 0;
      result.originClient = evData.originClient || 0;
      result.risksIssues = evData.risksIssues || "";
    }
  } catch (e) {
    Logger.log("[slide_collect] イベント取得失敗: " + e);
  }

  result.ok = true;
  return result;
}

// =============================================
// マイルストーンデータ取得
// =============================================
function slide_getMilestoneData_(projectId, ym) {
  // cockpit_api_getRewardDashboard の内部データを直接取る
  try {
    var dashRes = cockpit_api_getRewardDashboard({ projectId: projectId, ym: ym });
    if (!dashRes || !dashRes.ok) return null;

    var plan = dashRes.plan || {};
    var msList = dashRes.milestones || [];
    var summary = dashRes.monthSummary || {};

    var milestones = [];
    for (var i = 0; i < Math.min(msList.length, 4); i++) {
      var m = msList[i];
      milestones.push({
        name: String(m.title || ""),
        who: "-",  // TODO: responsibilityから取得
        deadline: String(m.targetYm || "-"),
        pt: String(m.maxPt || 0),
        progress: String(m.pctUsed || 0) + "%",
        status: Number(m.pctUsed || 0) >= 100 ? "✅完了"
              : Number(m.pctUsed || 0) > 0 ? "🔄進行中"
              : "⬜未着手"
      });
    }

    // 期待進捗率を自前計算：targetYm <= 当月のMSの配点合計 / 全体配点合計
    var totalPoints = Number(plan.totalPoints) || 0;
    var expectedPt = 0;
    var now = new Date();
    var currentYm = String(now.getFullYear()) + String(now.getMonth() + 1).padStart(2, "0");
    for (var ei = 0; ei < msList.length; ei++) {
      var tym = String(msList[ei].targetYm || "").trim();
      if (tym && tym <= currentYm) {
        expectedPt += Number(msList[ei].maxPt || 0);
      }
    }
    var expectedPctCalc = totalPoints > 0 ? Math.round(expectedPt / totalPoints * 1000) / 10 : 0;

    return {
      milestones: milestones,
      scoreEarned: String(summary.cumulativeConsumedPt || 0),
      scoreTotal: String(plan.totalPoints || 0),
      scoreComment: "",
      progressPct: String(summary.progressPct || 0),
      expectedProgressPct: expectedPctCalc
    };
  } catch (e) {
    Logger.log("[slide_getMsData] " + e);
    return null;
  }
}

// =============================================
// イベントデータ取得（Origin + アクション）
// =============================================
function slide_getEventData_(projectId, ym) {
  try {
    var ss = b_ss_();
    var sh = ss.getSheetByName("DB_ProgressEvents");
    if (!sh || sh.getLastRow() < 2) return null;

    var header = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function(x) { return String(x || "").trim(); });
    var colPid = header.indexOf("projectId");
    var colYm = header.indexOf("ym");
    var colTitle = header.indexOf("eventTitle");
    var colDesc = header.indexOf("eventDescription");
    var colOrigin = header.indexOf("initiativeOrigin");
    var colStatus = header.indexOf("status");
    if (colPid < 0 || colYm < 0) return null;

    var data = sh.getRange(2, 1, sh.getLastRow() - 1, header.length).getValues();
    var originAmd = 0, originCo = 0, originClient = 0;
    var actions = [];

    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      if (String(row[colPid] || "").trim() !== projectId) continue;
      if (String(row[colYm] || "").trim() !== ym) continue;
      if (colStatus >= 0 && String(row[colStatus] || "").trim() === "rejected") continue;

      var origin = colOrigin >= 0 ? String(row[colOrigin] || "unknown").trim() : "unknown";
      if (origin === "amd_proposed") originAmd++;
      else if (origin === "co_decided") originCo++;
      else if (origin === "client_requested") originClient++;

      if (actions.length < 5) {
        actions.push({
          title: colTitle >= 0 ? String(row[colTitle] || "") : "",
          desc: colDesc >= 0 ? String(row[colDesc] || "").substring(0, 80) : "",
          origin: origin === "amd_proposed" ? "AMD提案"
                : origin === "co_decided" ? "協議"
                : origin === "client_requested" ? "依頼"
                : "不明",
          who: "-"
        });
      }
    }

    return {
      actions: actions,
      originAmd: originAmd,
      originCo: originCo,
      originClient: originClient,
      risksIssues: ""
    };
  } catch (e) {
    Logger.log("[slide_getEventData] " + e);
    return null;
  }
}

// =============================================
// プレースホルダー置換
// =============================================
function slide_replaceAll_(pres, data) {
  // Cover
  pres.replaceAllText("{{project_name}}", data.projectName || "-");
  pres.replaceAllText("{{period_display}}", data.periodDisplay || "-");
  pres.replaceAllText("{{report_date}}", data.reportDate || "-");

  // Summary
  pres.replaceAllText("{{stage}}", data.stage || "-");
  pres.replaceAllText("{{completion}}", data.completion || "-");
  pres.replaceAllText("{{status}}", data.status || "-");
  pres.replaceAllText("{{monthly_summary}}", data.monthlySummary || "（データなし）");

  // Milestones (MS1～MS4)
  for (var i = 0; i < 4; i++) {
    var n = i + 1;
    var m = data.milestones[i] || {};
    pres.replaceAllText("{{ms" + n + "_name}}", m.name || "-");
    pres.replaceAllText("{{ms" + n + "_who}}", m.who || "-");
    pres.replaceAllText("{{ms" + n + "_dl}}", m.deadline || "-");
    pres.replaceAllText("{{ms" + n + "_pt}}", m.pt || "-");
    pres.replaceAllText("{{ms" + n + "_pg}}", m.progress || "-");
    pres.replaceAllText("{{ms" + n + "_st}}", m.status || "-");
  }

  // Score
  pres.replaceAllText("{{score_earned}}", data.scoreEarned || "0");
  pres.replaceAllText("{{score_total}}", data.scoreTotal || "0");
  pres.replaceAllText("{{score_comment}}", data.scoreComment || "");

  // Risks（テンプレ側は risks_notes）
  pres.replaceAllText("{{risks_notes}}", data.risksIssues || "特になし");
  pres.replaceAllText("{{risks_issues}}", data.risksIssues || "特になし");

  // Billing カード
  pres.replaceAllText("{{billing_amount}}", data.billingAmount || "-");
  pres.replaceAllText("{{billing_cumulative}}", data.billingCumulative || "-");
  pres.replaceAllText("{{billing_status}}", data.billingStatus || "-");
  pres.replaceAllText("{{billing_period_range}}", data.billingPeriodRange || "-");
  pres.replaceAllText("{{budget_confirmed}}", data.budgetConfirmed || "-");
  pres.replaceAllText("{{invoice_sent}}", data.invoiceSent || "-");
  pres.replaceAllText("{{payment_confirmed}}", data.paymentConfirmed || "-");

  // Billing 明細 (1～4)
  for (var i = 0; i < 4; i++) {
    var n = i + 1;
    var b = data.billItems[i] || {};
    pres.replaceAllText("{{bill" + n + "_item}}", b.item || "-");
    pres.replaceAllText("{{bill" + n + "_qty}}", b.qty || "-");
    pres.replaceAllText("{{bill" + n + "_unit}}", b.unit || "-");
    pres.replaceAllText("{{bill" + n + "_amount}}", b.amount || "-");
  }

  // Origin（テンプレ側は init_xxx）
  pres.replaceAllText("{{init_amd}}", String(data.originAmd || 0));
  pres.replaceAllText("{{init_joint}}", String(data.originCo || 0));
  pres.replaceAllText("{{init_client}}", String(data.originClient || 0));
  pres.replaceAllText("{{origin_amd}}", String(data.originAmd || 0));
  pres.replaceAllText("{{origin_co}}", String(data.originCo || 0));
  pres.replaceAllText("{{origin_client}}", String(data.originClient || 0));
  var total = data.originAmd + data.originCo + data.originClient;
  pres.replaceAllText("{{origin_pct}}", total > 0 ? (Math.round((data.originAmd + data.originCo) / total * 100) + "%") : "-");

  // Actions (1～5)
  for (var i = 0; i < 5; i++) {
    var n = i + 1;
    var a = data.actions[i] || {};
    pres.replaceAllText("{{act" + n + "_title}}", a.title || "-");
    pres.replaceAllText("{{act" + n + "_desc}}", a.desc || "-");
    pres.replaceAllText("{{act" + n + "_origin}}", a.origin || "-");
    pres.replaceAllText("{{act" + n + "_who}}", a.who || "-");
    pres.replaceAllText("{{act" + n + "_dl}}", a.deadline || "-");
  }

  // Action summary text (fallback)
  pres.replaceAllText("{{action_details}}", slide_formatActionDetails_(data.actions));
}

function slide_formatActionDetails_(actions) {
  if (!actions || actions.length === 0) return "（アクションなし）";
  var lines = [];
  for (var i = 0; i < actions.length; i++) {
    var a = actions[i];
    lines.push((i + 1) + ". [" + (a.origin || "?") + "] " + (a.title || "-"));
  }
  return lines.join("\n");
}

// =============================================
// ユーティリティ
// =============================================

/**
 * Markdownをプレーンテキストに簡易変換（スライド用）
 */
function slide_mdToPlain_(md, maxLen) {
  if (!md) return "";
  var text = String(md)
    .replace(/^#{1,6}\s*/gm, "")          // 見出し記号除去
    .replace(/\*\*(.+?)\*\*/g, "$1")       // bold除去
    .replace(/\*(.+?)\*/g, "$1")           // italic除去
    .replace(/`(.+?)`/g, "$1")             // inline code除去
    .replace(/^[-*+]\s+/gm, "・")          // 箇条書きを「・」に
    .replace(/^\d+\.\s+/gm, "")            // 番号リスト除去
    .replace(/\n{3,}/g, "\n\n")            // 過剰改行を圧縮
    .trim();

  if (maxLen && text.length > maxLen) {
    text = text.substring(0, maxLen) + "...";
  }
  return text;
}

/**
 * DB_MonthlyReportsにslideFileIdを保存
 */
function slide_repo_saveSlideId_(projectId, ym, slideId) {
  var ss = b_ss_();
  var sh = ss.getSheetByName("DB_MonthlyReports");
  if (!sh) return;

  var header = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function(x) { return String(x || "").trim(); });
  var colPid = header.indexOf("projectId");
  var colYm = header.indexOf("ym");
  var colSlide = header.indexOf("slideFileId");

  // slideFileId列がなければ作成
  if (colSlide < 0) {
    colSlide = header.length;
    sh.getRange(1, colSlide + 1).setValue("slideFileId");
  }

  // 該当行を探す
  var data = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][colPid] || "").trim() === projectId &&
        String(data[i][colYm] || "").trim() === ym) {
      sh.getRange(i + 2, colSlide + 1).setValue(slideId);
      return;
    }
  }
}

/**
 * 月次報告書からエグゼクティブサマリー部分だけ抽出（スライド2用）
 * 「エグゼクティブサマリー」「サマリー」「概要」セクションを探す。
 * 見つからなければ先頭300文字を使う。
 */
function slide_extractExecSummary_(md, maxLen) {
  maxLen = maxLen || 180;
  if (!md) return "（データなし）";
  var text = String(md);

  // --- 以降をセクション分割で探す
  var patterns = [
    /(?:^|\n)#{1,3}\s*(?:エグゼクティブ)?サマリー[^\n]*\n([\s\S]*?)(?=\n#{1,3}\s|\n---|\$)/i,
    /(?:^|\n)#{1,3}\s*概要[^\n]*\n([\s\S]*?)(?=\n#{1,3}\s|\n---|\$)/i,
    /(?:^|\n)---\s*\n([\s\S]*?)(?=\n#{1,3}\s|\n---|\$)/,
  ];

  for (var i = 0; i < patterns.length; i++) {
    var match = text.match(patterns[i]);
    if (match && match[1] && match[1].trim().length > 20) {
      return slide_mdToPlain_(match[1].trim(), maxLen);
    }
  }

  // セクションが見つからなければ先頭300文字
  return slide_mdToPlain_(text, maxLen);
}

// =============================================
// 以下を 314_MonthlySlide_Gen.gs の末尾に追加
// =============================================

/**
 * スライド2（マイルストーン進捗）を動的に描画する
 * テンプレ側はヘッダ/フッタのみの白紙スライド前提
 *
 * @param {SlidesApp.Presentation} pres
 * @param {Object} data - slide_collectData_ の戻り値
 */
function slide_drawMilestoneDashboard_(pres, data) {
  var slides = pres.getSlides();
  if (slides.length < 2) return;
  var s = slides[1];

  var PT = 72;

  var COL = {
    blue:      "#2E86DE",
    green:     "#27AE60",
    red:       "#E74C3C",
    gray:      "#E0E0E0",
    grayDark:  "#5D6D7E",
    darkText:  "#2C3E50",
    cardBg:    "#F4F7FA",
  };

  var LEFT = 0.5 * PT;
  var CONTENT_W = 9.0 * PT;
  var RIGHT_EDGE = LEFT + CONTENT_W;

  // ============ 上部エリア ============
  var TOP_Y = 0.85 * PT;

  // --- 右側: 2カード（進捗率 / 期待進捗率） ---
  var CARD_W = 2.8 * PT;
  var CARD_H = 0.85 * PT;
  var CARD_GAP = 0.12 * PT;
  var CARD_X = RIGHT_EDGE - CARD_W;

  var msList = data.milestones || [];
  var msCount = Math.min(msList.length, 18);

  var totalPt = Number(data.scoreTotal) || 0;
  var earnedPt = Number(data.scoreEarned) || 0;
  var progressPct = totalPt > 0 ? Math.round(earnedPt / totalPt * 1000) / 10 : 0;
  var expectedPct = Number(data.expectedProgressPct) || 0;

  var cards = [
    { label: "進捗率",     value: progressPct + "%", sub: earnedPt + " / " + totalPt + " pt", color: COL.green },
    { label: "期待進捗率", value: expectedPct > 0 ? (expectedPct + "%") : "-", sub: "", color: COL.grayDark },
  ];

  for (var ci = 0; ci < cards.length; ci++) {
    var cy = TOP_Y + ci * (CARD_H + CARD_GAP);
    var c = cards[ci];

    var cardShape = s.insertShape(SlidesApp.ShapeType.RECTANGLE, CARD_X, cy, CARD_W, CARD_H);
    cardShape.getFill().setSolidFill(COL.cardBg);
    cardShape.getBorder().setTransparent();

    var accent = s.insertShape(SlidesApp.ShapeType.RECTANGLE, CARD_X, cy, 0.05 * PT, CARD_H);
    accent.getFill().setSolidFill(c.color);
    accent.getBorder().setTransparent();

    var labelBox = s.insertTextBox(c.label, CARD_X + 0.18 * PT, cy + 0.06 * PT, CARD_W - 0.3 * PT, 0.2 * PT);
    slide_setTextStyle_(labelBox, 9, COL.grayDark, false);

    var valBox = s.insertTextBox(c.value, CARD_X + 0.18 * PT, cy + 0.26 * PT, CARD_W - 0.3 * PT, 0.35 * PT);
    slide_setTextStyle_(valBox, 22, c.color, true);

    if (c.sub) {
      var subBox = s.insertTextBox(c.sub, CARD_X + 0.18 * PT, cy + 0.6 * PT, CARD_W - 0.3 * PT, 0.2 * PT);
      slide_setTextStyle_(subBox, 8, COL.grayDark, false);
    }
  }

  // --- 左側: サマリーテキスト ---
  var SUMMARY_W = CARD_X - LEFT - 0.2 * PT;
  var SUMMARY_H = CARD_H * 2 + CARD_GAP;

  if (data.monthlySummary) {
    var summaryBox = s.insertTextBox(data.monthlySummary, LEFT, TOP_Y, SUMMARY_W, SUMMARY_H);
    slide_setTextStyle_(summaryBox, 10, COL.darkText, false);
    var paragraphs = summaryBox.getText().getParagraphs();
    for (var pi = 0; pi < paragraphs.length; pi++) {
      paragraphs[pi].getRange().getParagraphStyle().setLineSpacing(150);
    }
  }

  // ============ 下部エリア: MS 2カラム ============
  var MS_TOP = 3.1 * PT; // 固定：カード+サマリーの下
  var FOOTER_Y = 6.6 * PT;

  // 区切り線
  var divider = s.insertShape(SlidesApp.ShapeType.RECTANGLE, LEFT, MS_TOP - 0.08 * PT, CONTENT_W, 0.01 * PT);
  divider.getFill().setSolidFill(COL.gray);
  divider.getBorder().setTransparent();

  // ヘッダ
  var msHdrBox = s.insertTextBox("マイルストーン進捗", LEFT, MS_TOP, 2 * PT, 0.22 * PT);
  slide_setTextStyle_(msHdrBox, 9, COL.blue, true);

  var MS_LIST_Y = MS_TOP + 0.28 * PT;
  var COL_W = (CONTENT_W - 0.3 * PT) / 2; // 2カラムの幅
  var ROW_H = 0.34 * PT;
  var BAR_OFFSET = 2.2 * PT; // 名前の幅
  var BAR_W = COL_W - BAR_OFFSET - 0.6 * PT;
  var BAR_H = 0.12 * PT;

  for (var i = 0; i < msCount; i++) {
    var m = msList[i];
    var colIdx = i < Math.ceil(msCount / 2) ? 0 : 1;
    var rowIdx = colIdx === 0 ? i : i - Math.ceil(msCount / 2);

    var colX = LEFT + colIdx * (COL_W + 0.3 * PT);
    var rowY = MS_LIST_Y + rowIdx * ROW_H;

    // はみ出しチェック
    if (rowY + ROW_H > FOOTER_Y) break;

    var pctVal = Number(String(m.progress || "0").replace("%", "")) || 0;
    var maxPt = Number(m.pt) || 0;
    var usedPt = maxPt > 0 ? Math.round(pctVal / 100 * maxPt * 100) / 100 : 0;
    var isComplete = pctVal >= 100;

    // MS番号 + 名前（コンパクト）
    var nameText = (i + 1) + ". " + (m.name || "-");
    if (nameText.length > 18) nameText = nameText.substring(0, 17) + "…";
    var nameBox = s.insertTextBox(nameText, colX, rowY, BAR_OFFSET - 0.05 * PT, ROW_H);
    slide_setTextStyle_(nameBox, 8, COL.darkText, false);
    nameBox.setContentAlignment(SlidesApp.ContentAlignment.MIDDLE);

    // 背景バー
    var barX = colX + BAR_OFFSET;
    var barY = rowY + (ROW_H - BAR_H) / 2;
    var bgBar = s.insertShape(SlidesApp.ShapeType.RECTANGLE, barX, barY, BAR_W, BAR_H);
    bgBar.getFill().setSolidFill(COL.gray);
    bgBar.getBorder().setTransparent();

    // 進捗バー
    var fillW = Math.max(BAR_W * Math.min(pctVal, 100) / 100, 0.01 * PT);
    var fillBar = s.insertShape(SlidesApp.ShapeType.RECTANGLE, barX, barY, fillW, BAR_H);
    fillBar.getFill().setSolidFill(isComplete ? COL.red : COL.green);
    fillBar.getBorder().setTransparent();

    // % 表示
    var pctBox = s.insertTextBox(pctVal + "%", barX + BAR_W + 0.05 * PT, rowY, 0.5 * PT, ROW_H);
    slide_setTextStyle_(pctBox, 8, isComplete ? COL.red : COL.blue, true);
    pctBox.setContentAlignment(SlidesApp.ContentAlignment.MIDDLE);
  }
}

/**
 * テキストボックスのスタイルを一括設定するヘルパー
 */
function slide_setTextStyle_(textBox, fontSize, color, bold) {
  var style = textBox.getText().getTextStyle();
  style.setFontSize(fontSize);
  style.setForegroundColor(color);
  style.setFontFamily("Noto Sans JP");
  if (bold) style.setBold(true);
}

/**
 * 月次報告書から「## スライド用サマリー」セクションを抽出
 * @param {string} md
 * @return {string|null} 見つからなければnull
 */
function slide_extractSlideSummary_(md) {
  if (!md) return null;
  var match = String(md).match(/#{1,3}\s*スライド用サマリー[^\n]*\n([\s\S]*?)(?=\n#{1,3}\s|$)/i);
  if (match && match[1] && match[1].trim().length > 10) {
    return slide_mdToPlain_(match[1].trim(), 300);
  }
  return null;
}