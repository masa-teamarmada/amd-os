#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function expectIncludes(rel, needles) {
  const text = read(rel);
  const missing = needles.filter((needle) => !text.includes(needle));
  if (missing.length > 0) {
    throw new Error(`${rel} missing critical UI anchors: ${missing.join(", ")}`);
  }
}

function expectPattern(rel, patterns) {
  const text = read(rel);
  const missing = patterns.filter((pattern) => !pattern.test(text));
  if (missing.length > 0) {
    throw new Error(`${rel} missing critical UI patterns: ${missing.map(String).join(", ")}`);
  }
}

function expectNotIncludes(rel, needles) {
  const text = read(rel);
  const present = needles.filter((needle) => text.includes(needle));
  if (present.length > 0) {
    throw new Error(`${rel} contains retired critical UI anchors: ${present.join(", ")}`);
  }
}

function expectFileMissing(rel) {
  const target = path.join(root, rel);
  if (fs.existsSync(target)) {
    throw new Error(`${rel} should not exist; retired UI component was restored`);
  }
}

expectIncludes("spec/3-0-l2-data-list-current-spec.md", [
  "# L2データリスト",
  "M / W / D / H",
  "| ID | 何のデータか | 今の writer | 定額内 | 状態 | 次の動き |",
  "層 (tier) 軸",
  "D-12",
  "Finance Ops Evidence / freee Transaction Actuals",
  "W-1",
  "VC News / Funding Signals",
  "D-13",
  "Contract Signals",
  "Coverage Scanner",
]);

expectNotIncludes("spec/3-0-l2-data-list-current-spec.md", [
  "通常の" + "更新ルート",
  "L2 " + "\u2460",
  "L2" + "\u2460",
  "\u2460",
  "\u246f",
]);

expectIncludes("src/components/cockpit/CockpitNextPeriodSetup.tsx", [
  "MS開始",
  "MS終了",
  "periodStartYm",
  "targetYm",
]);

expectIncludes("src/components/cockpit/MilestoneGanttChart.tsx", [
  "MilestoneGanttChart",
  "monthRange",
  "periodStartYm",
  "targetYm",
  "設計額",
  "担当設計額",
  "designAmountForPoints",
  "memberDesignAmountForResponsibility",
  "extraDesignBudgetYen",
]);
expectPattern("src/components/cockpit/MilestoneGanttChart.tsx", [
  /\(budgetInfo\?\.effectivePoints \?\? ms\.points\) \* resp\.share/,
  /gridColumn/,
]);

expectIncludes("src/components/cockpit/CockpitMonthlyModal.tsx", [
  "applyRewardCapForMonth",
  "carryStock",
  "現ストック",
  "saveEventEdit",
  "進捗イベント",
  "PATCH",
  "break-words",
  "scheduleLabel",
]);

expectIncludes("src/app/api/progress/events/route.ts", [
  "export async function PATCH",
  "content_preview",
  "milestone_id",
  "initiative_origin",
]);

expectIncludes("src/app/api/progress/ms-schedule/route.ts", [
  "period_start_ym",
  "target_ym",
  "dbFallback",
]);

expectIncludes("src/components/admin/AdminPayoutsClient.tsx", [
  "報酬債務台帳",
  "未払い残",
  "stockYen",
  "ゼロ着地",
  "残あり月",
  "openMonthlyModal",
  "報酬キャッシュ再計算",
  "本契約発生",
  "別財布発生",
  "本契約cap",
  "別財布支払",
  "先12か月 キャッシュ支払",
  "先12か月 会社留保",
  "先12か月 報酬債務",
  "先12か月 cap超過チェック",
  "外部支払",
  "会社留保増",
  "FinancePurposeMatrix",
  "regularExternalPayoutYen",
  "cappedRegularExternalYen",
  "cappedRegularYen",
  "cappedExtraYen",
  "regularBasePay",
  "extraBasePay",
  "支払通知書発行",
  "PDF確認",
  "送付",
  "PayoutNoticeActions",
  "全員分PDF一括発行",
  "確認用PDF生成",
  "bulk_issue_notice_pdf",
  "bulk_preview_notice_pdf",
  "同期できない",
  "snapshotSyncBlocked",
  "fmtRelativeTime",
  "保存済みPDFとメール本文を確認中",
  "正式PDF確認済み",
  "添付PDFは保存済み正式PDFです",
]);

expectIncludes("src/app/(app)/admin/invoices/page.tsx", [
  "請求書発行",
  "AdminInvoiceIssueQueue",
  "freee 発行",
]);

expectIncludes("src/app/(app)/admin/billing/page.tsx", [
  "redirect(\"/admin/invoices\")",
]);

expectIncludes("src/components/contracts/ContractsClient.tsx", [
  "max-w-[1920px]",
  "min-w-[1320px]",
  "sticky left-0",
  "sticky left-[180px]",
]);

expectPattern("src/components/contracts/ContractsClient.tsx", [
  /<th[\s\S]*?>\s*PJ\s*<\/th>[\s\S]*?<th[\s\S]*?>\s*契約名\s*<\/th>/,
]);

expectIncludes("src/components/admin/AdminSidebar.tsx", [
  "請求書発行",
  "/admin/invoices",
]);

expectIncludes("src/components/admin/AdminInvoiceIssueQueue.tsx", [
  "AdminInvoiceIssueDialog",
  "未完了",
  "open",
  "effectiveInvoiceYm",
  "発行前チェック",
  "設定不足を解消",
  "freee取引先を選択",
  "FreeePartnerPicker",
  "発行待ち",
  "要確認",
  "設定不足",
  "過去滞留",
  "請求書発行",
  "請求書を発行",
  "発行条件",
]);

expectIncludes("src/components/admin/FreeePartnerPicker.tsx", [
  "freee取引先を検索",
  "api/admin/freee-partners",
  "選択中",
]);

expectIncludes("src/app/api/admin/freee-partners/route.ts", [
  "requireAdmin",
  "freeeApi",
  "/api/1/partners",
]);

expectIncludes("src/components/admin/AdminInvoiceIssueDialog.tsx", [
  "issue-invoice",
  "callEdgeFunctionPOST",
  "invoice_base_lines_json",
  "freeePartnerId",
  "sanitizeInvoiceSubject",
  "recipientName",
  "基本明細行",
  "立替精算",
  "調整行",
  "備考",
  "発行を取り消す",
  "請求書を発行",
]);

expectIncludes("src/components/nav/GlobalNav.tsx", [
  "/poc",
  "Handshake",
  "PoC",
  "/business-cards",
  "ContactRound",
  "名刺",
  "アクティブPJ",
  "board-nav-flyout",
  "createPortal",
  "fetchActiveProjectsForNav",
]);

expectNotIncludes("src/components/nav/GlobalNav.tsx", [
  "日本文化",
  "/admin/japanese-culture-map",
  "/japanese-culture-map",
]);

expectIncludes("src/components/admin/AdminSidebar.tsx", [
  "日本文化",
  "/admin/japanese-culture-map",
]);

expectIncludes("src/components/business-cards/BusinessCardsClient.tsx", [
  "スマホで名刺を撮る",
  'capture="environment"',
  "projectIds",
  "確認してPJ knowledgeへ登録",
  "会った人を撮って、確かめて、PJの関係資産へ",
]);

expectIncludes("src/app/api/business-cards/route.ts", [
  "requireAuth",
  "business_cards",
  "business-cards",
  "extractBusinessCard",
  'status: "needs_review"',
  'status: "ocr_failed"',
]);

expectIncludes("src/app/api/business-cards/[cardId]/route.ts", [
  "requireAuth",
  "syncBusinessCardKnowledge",
  "projectIds",
  'status: "confirmed"',
]);

expectIncludes("src/app/api/business-cards/[cardId]/image/route.ts", [
  "requireAuth",
  "business_cards",
  "admin.storage",
  'Cache-Control',
]);

expectIncludes("src/lib/business-card-server.ts", [
  "business_card_project_links",
  "project_knowledge",
  'source: "business_card"',
  'category: "people"',
  "連絡先は名刺管理で確認できる",
]);

expectIncludes("scripts/migrations/172_business_cards.sql", [
  "CREATE TABLE IF NOT EXISTS public.business_cards",
  "CREATE TABLE IF NOT EXISTS public.business_card_project_links",
  "business_card.ocr",
  "public = false",
]);

expectIncludes("../ios/AMDOS/Features/Home/MainTabView.swift", [
  "BusinessCardsView()",
  'Label("PJ進捗"',
  'Label("名刺"',
  'Label("設定"',
]);

expectNotIncludes("../ios/AMDOS/Features/Home/MainTabView.swift", [
  'Label("月次ルーティン"',
]);

expectIncludes("../ios/AMDOS/Features/BusinessCards/BusinessCardsView.swift", [
  "/native/business-cards",
  "hudWebAuthCookies",
  "WKWebView",
  "BusinessCardsWebContainer",
]);

expectIncludes("src/app/(app)/poc/page.tsx", [
  "PoC案件化",
  "シーズを追加",
  "PoC先を追加",
  "PoC先候補リスト",
  "案件化キュー",
  "案件化",
  "案件候補",
  "PoC先リスト",
]);

expectIncludes("src/lib/poc-data.ts", [
  "poc_companies",
  "poc_matches",
  "POC_MATCH_STATUS_ORDER",
]);

expectIncludes("src/lib/reward-summary.ts", [
  "server_v5_planned_share_cap_carry_no_final_topup",
  "regularUnusedCapCarryOutYen",
  "extraUnusedCapCarryOutYen",
  "effectiveRegularCapBudgetYen",
]);

expectIncludes("src/app/api/admin/ms-overview/[planCycleId]/route.ts", [
  "seasonEndShortageYen",
  "メンバー支払義務がPJ予算を",
  "PJ予算がクライアント支払からバッファを引いた原資上限を",
  "シーズン終了月に未払残が",
  "contractBackedClientAmount",
  "buildExtraRevenueByYm",
  "parseSeasonBufferTotal",
  "milestone_change_events",
  "persistMilestoneChangeEvent",
]);

expectIncludes("src/components/admin/AdminMsOverviewClient.tsx", [
  "クライアント支払",
  "バッファ",
  "原資上限",
  "PJ予算",
  "メンバー支払",
  "会社留保",
  "期末未払",
  "不足額",
  "MS編集停止中",
]);

expectNotIncludes("src/components/admin/AdminPayoutsClient.tsx", [
  "送信時に再生成",
  "作成日は送信日",
]);

expectIncludes("src/components/admin/AdminMembersTable.tsx", [
  "/api/admin/members",
  "contractor_name",
  "member_address",
  "invoice_registration_number",
  "契約者名",
  "住所",
  "インボイス登録番号",
  "defaultContractorName",
]);

expectNotIncludes("src/components/admin/AdminMembersTable.tsx", [
  'from("members").update',
  "from('members').update",
  "createBrowserAuthClient",
]);

expectIncludes("src/app/api/admin/members/route.ts", [
  "requireAdmin",
  "createAdminClient",
  "PATCHABLE_FIELDS",
  "member_address",
  "invoice_registration_number",
  "normalizeInvoiceRegistrationNumber",
  "select(\"*\")",
  "member not found or not updated",
]);

expectIncludes("src/app/api/admin/payouts/route.ts", [
  "refreshRewards",
  "gateOnly",
  "includeAgreementGate",
  "issue_notice_pdf",
  "preview_notice_pdf",
  "regular_base_pay",
  "extra_base_pay",
  "payoutEntryDbPayload",
  "payoutCreatePwaNoticePdf",
  "update_notice",
  "payout_notices",
  "notice_no",
  "pdf_url",
  "sent_at",
  "bulk_issue_notice_pdf",
  "bulk_preview_notice_pdf",
  "generateNoticePdfForMember",
  "generateNoticePdfBulk",
  "shouldRegenerateNotice",
  "savePayoutDataSnapshot",
  "clearStalePayoutNoticePdfs",
  "last_generated_at",
  "member_profile_changed",
  "noticeSourceProfileIsStale",
  "contractor_name",
  "payeeAddress",
  "invoiceRegistrationNumber",
  "normalizeInvoiceRegistrationNumber",
  "bankInfo",
  "preview_notice_email",
  "send_notice_email",
  "composePayoutNoticeMailBody",
  "ご確認期間が短くなっており恐縮",
  "15:00まで",
  "pdfPreparedBeforeSend",
  "最新 DB 正本",
  "金額差分が無くても",
]);

expectNotIncludes("src/app/api/admin/payouts/route.ts", [
  "pdfWillRegenerateOnSend",
  "17:00まで",
  "regenerated.lastGeneratedAt",
]);

expectIncludes("src/app/(app)/admin/payouts/page.tsx", [
  "loadTargetData",
  "includeAgreementGate: false",
  "initialData",
]);

expectIncludes("src/components/admin/AdminPayoutsClient.tsx", [
  "initialData",
  "skipInitialFetchRef",
  "payoutDataHint",
  "gateOnly",
]);

expectIncludes("src/app/api/cron/payout-notice-prebuild/route.ts", [
  "payout-notice-prebuild",
  "savePayoutDataSnapshot",
  "generateNoticePdfBulk",
  "loadTargetData",
  "CRON_SECRET",
]);

expectIncludes("../gas/064_PayoutFreeeNotice.js", [
  "2026-04 改善版フォーマット",
  "PAYOUT_LOGO_FILE_ID",
  "PAYOUT_LOGOTYPE_FILE_ID",
  "payoutGetPayoutLogotypeBlob_",
  "insertImage",
  "taxBreakdownFromTaxExcludedYen",
  "const tax = Math.round(net * 0.1);",
  "/admin/payouts の支払額は税抜",
  "お支払金額",
  "摘要",
  "数量",
  "単価",
  "小計（税抜）",
  "消費税（10%）",
  "合計（税込）",
  "支払予定日",
  "支払方法",
  "payoutCompanyInvoiceRegistrationNumber_",
  "T7021001064067",
  "登録番号",
  "備考",
]);

expectNotIncludes("../gas/064_PayoutFreeeNotice.js", [
  '.setValue("振込先")',
  "適格請求書発行事業者登録番号",
]);

expectNotIncludes("../gas/064_PayoutFreeeNotice.js", [
  'setValue("team ARMADA")',
  "brandCell",
  "支払通知書番号",
]);

expectIncludes("src/app/api/cron/payout-reward-cache-refresh/route.ts", [
  "payout-reward-cache-refresh",
  "syncRewardSummariesForBillingCycles",
  "DEFAULT_FORWARD_CACHE_LOOKAHEAD_MONTHS",
  "lookahead",
  "cycleYms",
  "targetPaymentYms",
  "03:05",
]);

expectIncludes("src/lib/reward-summary.ts", [
  "server_v5_planned_share_cap_carry_no_final_topup",
  "plannedShare",
  "shareSource",
  "CAP_EXTRA_MILESTONE_TAGS",
  "emptyRewardSummaryForCycle",
  "regularBasePay",
  "extraBasePay",
  "resolveContributionShares",
]);

expectIncludes("vercel.json", [
  "/api/cron/payout-reward-cache-refresh",
  "5 18 * * *",
  "/api/cron/payout-notice-prebuild",
  "0 17 * * *",
]);

expectIncludes("design/FEATURE_REGISTRY.md", [
  "/admin/payouts",
  "支払通知書発行",
  "報酬キャッシュ",
  "members.contractor_name",
  "members.member_address",
  "members.invoice_registration_number",
  "予定担当比率のみ",
  "本契約発生",
  "別財布発生",
  "本契約cap",
  "別財布支払",
  "先12か月 キャッシュ支払",
  "先12か月 会社留保",
  "先12か月 報酬債務",
  "先12か月 cap超過チェック",
  "会社留保を支出扱いしない",
  "monthly_reward_payout.total_pay",
  "縦型PJ収支表",
  "保存済み正式PDFが最新DBと一致",
]);

expectIncludes("src/app/(app)/management-score/page.tsx", [
  "PJ別 先12か月 キャッシュ支払",
  "PJ別 先12か月 会社留保",
  "PJ別 先12か月 報酬債務",
  "PJ別 先12か月 cap超過チェック",
  "会社留保は支出に入れない",
  "FinancePurposeTable",
  "regularExternalPayoutYen",
  "cappedRegularExternalYen",
  "cappedRegularYen",
  "cappedExtraYen",
]);

expectIncludes("src/components/admin/AdminProjectsTable.tsx", [
  "project_category",
  "PROJECT_CATEGORY_OPTIONS",
  "ecosystem は AMD Score 対象外",
]);

expectIncludes("src/components/cockpit/CockpitView.tsx", [
  "showAmdScore",
  "ecosystem",
  "CockpitStrategySignals",
  "strategySignals",
  "CockpitSeasonFinance",
  "seasonFinance",
  "CockpitMsChangeHistory",
  "msChangeHistory",
  // 案C レイアウト (2026-05-23 まさ確定) — 旧 max-w-[1060px] 2カラムには戻さない
  "max-w-[1600px]",
  "lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_300px]",
  "lg:sticky lg:top-12",
  "renderMsSetupBanner",
]);

expectIncludes("src/lib/supabase-data.ts", [
  "milestone_change_events",
  "msChangeHistory",
  "MilestoneChangeHistory",
]);

expectFileMissing("src/components/cockpit/CockpitNudge.tsx");
expectNotIncludes("src/components/cockpit/CockpitView.tsx", [
  "CockpitNudge",
  "つくよみメモ",
]);
expectNotIncludes("src/app/(app)/project/[projectId]/cockpit/page.tsx", [
  "nudges={cockpit.nudges",
]);
expectNotIncludes("src/app/(app)/institutions/[institutionId]/cockpit/page.tsx", [
  "nudges={cockpit.nudges",
]);
expectNotIncludes("src/components/dashboard/CyberHudWallDashboard.tsx", [
  "nudges={cockpit.nudges",
]);

expectIncludes("src/components/cockpit/CockpitSeasonFinance.tsx", [
  "今シーズン収支",
  "クライアント支払",
  "バッファ",
  "PJ予算",
  "メンバー支払",
  "期末未払",
  "未払残",
  "収支",
  "ゼロ着地",
  "不足",
  "シーズン収支が閉じていない",
]);

expectIncludes("src/components/cockpit/CockpitMsChangeHistory.tsx", [
  "MS変更履歴",
  "changedMilestoneCount",
  "positiveOffsetYen",
  "negativeOffsetYen",
  "MilestoneResponsibilityChange",
  "aria-expanded",
]);

expectNotIncludes("src/components/cockpit/CockpitSeasonFinance.tsx", [
  "会社留保",
]);

expectNotIncludes("src/components/cockpit/CockpitView.tsx", [
  "max-w-[1060px]",
  "max-w-[720px] min-w-0 flex flex-col gap-3",
]);

expectIncludes("src/components/cockpit/CockpitVentureStatus.tsx", [
  "xl:flex-row",
  "Chart 1 + Chart 2",
]);

// p00 (= AMD 会社全体) は Management Score Hero に切り替わる
expectIncludes("src/components/cockpit/CockpitView.tsx", [
  "CockpitManagementScoreHero",
  "project.projectId === \"p00\"",
]);
expectIncludes("src/components/cockpit/CockpitManagementScoreHero.tsx", [
  "amd_management_score_snapshots",
  "initiative_score",
  "finance_score",
  "retention_score",
  "pipeline_score",
  "direction_score",
]);

// MTGサマリ UI: フレーム廃止 + dialogue ラベル + source link
expectIncludes("src/components/cockpit/CockpitMeetingDetailModal.tsx", [
  "isDialogueMeeting",
  "チームへの提案案",
  "DialogueMeetingBody",
  "MeetingAssetsPanel",
  "MeetingSummaryInlineEditor",
  "MeetingPrepInlineEditor",
  "表示内容を編集",
  "PDF保存",
  "議事録コピー",
  "準備メモコピー",
  "共有URLコピー",
  "meeting-share-export-root",
  "buildMeetingEmailBody",
  "buildMeetingShareBundle",
  "saveSharePartAsPdf",
  "loadPrintableMeetingAssets",
  "PRINTABLE_MEETING_ASSET_TYPES",
  "copyPages",
  "pdf-lib",
  "/api/meeting-summary/manual-update",
  "narrativeMd",
  "TopicList",
  "NarrativeSection",
  "必ず確認すること",
]);
expectIncludes("src/components/cockpit/MeetingAssetsPanel.tsx", [
  "添付資料",
  "navigator.clipboard.read",
  "getDisplayMedia",
  "/api/meeting-assets",
  "/api/meeting-assets/insert-markdown",
  "assetKind",
  "screen_capture",
]);
expectIncludes("src/app/api/meeting-assets/route.ts", [
  "requireAdmin",
  "meeting_assets",
  "meeting-assets",
  "asset_kind",
  "screen_capture",
  "createSignedUrl",
]);
expectIncludes("src/app/api/meeting-assets/insert-markdown/route.ts", [
  "meeting-assets:start",
  "narrative_md",
  "/api/meeting-assets/file/",
  "manual-asset-insert",
]);
expectIncludes("src/app/api/meeting-assets/file/[assetId]/route.ts", [
  "requireAdmin",
  "createSignedUrl",
  "NextResponse.redirect",
]);
expectIncludes("src/app/api/meeting-summary/manual-update/route.ts", [
  "requireAdmin",
  "source_hash",
  "generated_by_model",
  "manual-edit",
]);
expectIncludes("scheduled-tasks/amd-os-l6-meeting-extract/SKILL.md", [
  "セクション別の表現を固定する",
  "その MTG に参加していなかったメンバー",
  "v8_hybrid_section_lists",
  "## 🎯背景",
  "## 📊経緯",
  "## ✅決まったこと",
  "## ▶️次の一手",
  "## ⚠️残課題",
  "weekly recurring",
]);
expectIncludes("src/app/api/dialogue-meeting/narrate/route.ts", [
  "セクション別の表現を固定する",
  "その MTG に参加していなかった",
  "## 🎯背景",
  "## 📊経緯",
  "## ✅決まったこと",
  "## ▶️次の一手",
  "## ⚠️残課題",
]);
expectIncludes("src/app/api/meeting-summary/narrate/route.ts", [
  "セクション別の表現を固定する",
  "## 🎯背景",
  "## 📊経緯",
  "## ✅決まったこと",
  "## ▶️次の一手",
  "## ⚠️残課題",
]);
expectIncludes("design/meeting_summaries.md", [
  "## 🎯背景",
  "## 📊経緯",
  "## ✅決まったこと",
  "## ▶️次の一手",
  "## ⚠️残課題",
  "投影資料を先",
  "PDF / PNG / JPEG",
]);
expectIncludes("manual/2-3-pj-cockpit.md", [
  "## 🎯背景",
  "## 📊経緯",
  "## ✅決まったこと",
  "## ▶️次の一手",
  "## ⚠️残課題",
]);
expectIncludes("src/app/api/meeting-prep/calendar-sync/route.ts", [
  "calendar-future-sync",
  "recurring_series_future_occurrence",
  "upcoming:",
  "source_kinds",
  "preserve_manual_body",
  "PROJECT_MATCH_ALIASES_BY_ID",
  "ZeMA",
  "SolvioraX",
]);
expectIncludes("src/components/cockpit/CockpitMeetingSummary.tsx", [
  "params.set(\"meeting\", meetingId)",
  "params.delete(\"ym\")",
  "router.replace(meetingUrl(meeting.meetingId), { scroll: false })",
  "groupUpcomingMeetingsBySeries",
]);
expectNotIncludes("src/components/cockpit/CockpitMeetingSummary.tsx", [
  "max-h-[480px]",
  "overflow-y-auto",
]);
// dialogue narrative の本文ラベルは半角SPなし「2人」で書く (#2-2nd まさ 2026-05-24)
expectNotIncludes("src/components/cockpit/CockpitMeetingDetailModal.tsx", [
  "2 人で出した",
]);
expectNotIncludes("src/app/api/dialogue-meeting/narrate/route.ts", [
  "2 人で出した提案 (チームへの相談)",
]);
expectNotIncludes("src/components/cockpit/CockpitMeetingDetailModal.tsx", [
  // 旧フレーム枠の anchor (border-l + bg-white の rounded-lg 個別ボックス) は廃止
  "border-l-[3px] border-emerald-400/70",
]);
expectIncludes("src/components/cockpit/CockpitMeetingSummary.tsx", [
  "isDialogue",
  "sourceUrl",
  "提案整理",
  // モーダル close 時に URL から ?meeting= を消す (#10 まさ 2026-05-24)
  "closeSelectedMeeting",
  "autoOpenedRef",
]);

// 経営事業シグナルの 4 分類 (#14 まさ 2026-05-24) + つくよみ修正依頼 (#11)
// 旧 3 分類 (外部環境/経営判断/事業進捗) は廃止 → 新 4 分類 (経営全般/事業開発/技術開発/外部環境)
// #14-4th (2026-05-24): 外部環境 (= ip_regulatory / risk) も cockpit カードに表示する
//   (= 当初「Atlas へ誘導、cockpit には出さない」設計で SX 重金属 ↔ 中国レアアース等が
//    消えた事故対応)。Atlas リンクは header の「Atlas で全マクロ ↗」に残す。
expectIncludes("src/components/cockpit/CockpitStrategySignals.tsx", [
  "CATEGORY_OF_TYPE",
  "経営全般",
  "事業開発",
  "技術開発",
  "外部環境",
  "Atlas で全マクロ",
  "つくよみに修正依頼",
  "/api/notifications/feedback",
  "project_strategy_signal",
]);

// 議事録モーダルの修正導線は手動編集に一本化する。
expectIncludes("src/components/cockpit/CockpitMeetingDetailModal.tsx", [
  "MeetingSummaryInlineEditor",
  "/api/meeting-summary/manual-update",
  "表示内容を編集",
]);
expectNotIncludes("src/components/cockpit/CockpitMeetingDetailModal.tsx", [
  "MeetingFeedbackBlock",
  "つくよみに修正依頼",
]);
// 「経営会議」表記は使わない (= かる/ちこ が疎外感を持つので「まさえいMTG」に統一、#7-3rd 2026-05-24)
expectNotIncludes("src/components/cockpit/CockpitMeetingDetailModal.tsx", [
  "まさ × えいみ 経営会議",
  "まさ × えいみ経営会議",
]);
expectIncludes("src/components/cockpit/CockpitMeetingDetailModal.tsx", [
  "提案前の論点整理セッション",
]);
expectIncludes("src/app/api/dialogue-meeting/narrate/route.ts", [
  "提案前の論点整理セッション",
  "U+2715 MULTIPLICATION X",
  "事業戦略上そろそろ方針を決めておきたい",
]);
expectIncludes("src/app/api/dialogue-meeting/route.ts", [
  "提案前の論点整理セッション",
]);

// dialogue narrative API
expectIncludes("src/app/api/dialogue-meeting/narrate/route.ts", [
  "narrative_md",
  "project_meeting_summaries",
  "claude-sonnet-4-6",
  "提案として固まったこと",
]);

expectIncludes("src/components/cockpit/CockpitStrategySignals.tsx", [
  "経営ハイライト",
  "sourceRefs",
]);

expectIncludes("src/lib/supabase-data.ts", [
  "project_strategy_signals",
  "strategySignals",
  "ProjectStrategySignal",
]);

expectIncludes("src/app/api/notifications/feedback/route.ts", [
  "project_strategy_signal",
  "project_strategy_signals",
  "updateStrategySignalCandidates",
]);

expectIncludes("scripts/ms_progress_review_tool.mjs", [
  "strategySignals",
  "upsertStrategySignals",
  "project_strategy_signals",
]);

expectIncludes("design/FEATURE_REGISTRY.md", [
  "/project/[projectId]/cockpit",
  "経営ハイライト",
  "project_strategy_signals",
  "CockpitSeasonFinance",
  "今シーズン収支",
  "クライアント支払",
  "期末未払",
  "収支",
]);
expectNotIncludes("design/FEATURE_REGISTRY.md", [
  "TODO/nudge",
  "ステータス・nudge",
]);

expectIncludes("src/lib/amd-score-l2-extract.ts", [
  "loadProjectCategory",
  "skipped: ecosystem project",
]);

expectIncludes("src/components/notifications/NotificationsClient.tsx", [
  "rawDataGapEvidenceRows",
  "metadata_json",
  "truncateOneLine",
]);

expectIncludes("src/app/(app)/mypage/page.tsx", [
  "WeeklyActivitiesCard",
  "今週やったこと",
  "weeklyActivities",
]);

expectIncludes("src/app/api/cron/member-weekly-activities/route.ts", [
  "member_weekly",
  "activityWindowBoundsJST",
  "windowKey",
  "windowEnd",
  "fetchGmailEvidence",
  "fetchCalendarEvidence",
  "resolveReadableMemberCalendars",
  "targetMembers",
  "calendarSourceMembers",
  "pendingCalendarLogin",
  "requiresCalendarLogin",
  "excludedEmails.has(email)",
]);

expectIncludes("src/app/api/cron/member-activities/route.ts", [
  "loadAliasProfiles",
  "textFitsProject",
  "project_category.eq.advisor",
  "neq(\"status\", \"invalid\")",
]);

expectIncludes("src/app/auth/login/page.tsx", [
  "calendar.readonly",
  "gmail.readonly",
  "prompt: \"consent\"",
]);

expectIncludes("src/app/auth/callback/route.ts", [
  "verifyCalendarAccess",
  "google_calendar_status",
  "last_login_at",
  "member_google_oauth_tokens",
]);

expectIncludes("src/components/admin/AdminMembersTable.tsx", [
  "CalendarBadge",
  "requiresCalendarAccess",
  "google_calendar_status",
  "last_login_at",
  "最終ログイン",
  "Google Calendar access is required at login",
]);

expectIncludes("src/app/api/cron/venture-xrl-refresh/route.ts", [
  "project_category",
  "ecosystem project",
  "skippedEcosystem",
]);

expectIncludes("src/app/api/cron/founding-members-extract/route.ts", [
  "project_category",
  "skipped: ecosystem project",
  "skipped_ecosystem",
  "HRL_EXCLUDED_CATEGORIES",
  "HRL_EXCLUDED_ROLES",
  "classifyMember",
  "該当SU 社員",
  "迷ったら **除外**",
]);

expectIncludes("src/app/api/cron/frl-grit-resilience-extract/route.ts", [
  "project_category",
  "ecosystem",
]);

expectIncludes("scripts/ms_progress_review_tool.mjs", [
  "SCORE_L2_NOTIFICATION_KINDS",
  "isEcosystemProject",
  "skippedEcosystem",
]);

expectIncludes("src/app/api/notifications/feedback/route.ts", [
  "filterProjectReportEmails",
  "only internal/member emails found",
  "founding_members",
  "activated member_knowledge",
  "activated project_knowledge",
  "confirmed protocols",
  "activated founding_members",
]);

expectIncludes("../gas/155_L2KnowledgeExtractor.js", [
  "status: \"candidate\"",
  "承認されるまで正本反映しない",
]);

// /admin/season-pl — シーズン予実表 (Season Budget vs Actual)
expectIncludes("src/lib/season-pl.ts", [
  "export function computeSeasonPl",
  "buffer_breakdown_json",
  "ptFullyAssigned",
  "unassignedPt",
  "unownedMilestones",
  "budgetMatchesMonthlyCaps",
  "officerStockConverges",
  "ptUnitConsistent",
  "memberBudgetYen",
  "amdMarginYen",
  // 未割当pt は total_points − Σ(MS points) で見る (earnedPt < total_points へ戻さない)
  "msPointsSum",
]);

expectIncludes("src/app/api/admin/season-pl/route.ts", [
  "computeSeasonPl",
  "value_plan_cycles",
  "buffer_breakdown_json",
  "planCycleId",
  "mode: \"list\"",
  "mode: \"detail\"",
]);

expectIncludes("src/components/admin/AdminSeasonPlClient.tsx", [
  "/api/admin/season-pl",
  "閉じ検算",
  "未割当pt",
  "原資=Σ月cap",
  "役員stock収束",
  "メンバー原資",
  "AMD マージン",
  "mypage?memberId=",
]);

expectIncludes("src/app/(app)/admin/season-pl/page.tsx", [
  "シーズン予実表",
  "AdminSeasonPlClient",
]);

expectIncludes("src/components/admin/AdminSidebar.tsx", [
  "シーズン予実",
  "/admin/season-pl",
]);

expectIncludes("design/FEATURE_REGISTRY.md", [
  "/admin/season-pl",
  "computeSeasonPl",
  "buffer_breakdown_json",
  "役員stock収束",
]);

// /admin/ms-overview — 全PJ MS設計 一望 (Milestone Overview)
expectIncludes("src/app/api/admin/ms-overview/route.ts", [
  "value_plan_cycles",
  "milestone_responsibility",
  "regularPointBasisForCycle",
  "memberPointTotals",
  "planCycles",
  "project_freeze_periods",
  "deriveHealthState",
  "healthState",
  "regularDesignUnitYen",
  "extraDesignUnitYen",
  "designAmountYen",
]);
expectIncludes("src/app/api/admin/ms-overview/[planCycleId]/route.ts", [
  "POST",
  "PUT",
  "buildRewardRevisionImpact",
  "buildRewardRevisionBudgetImpact",
  "rewardPreview",
  "memberImpacts",
  "budgetImpact",
  "reward_member_liability_offsets",
  "milestone_change_events",
  "change_items_json",
  "保存不可",
]);
expectNotIncludes("src/app/api/admin/ms-overview/route.ts", [
  "computeSeasonPl",
  "ptValueYen",
  "memberYearTotals",
  "regularPtUnitYen",
  "extraPtUnitYen",
  "extraPoolBudgetYen",
]);

expectIncludes("src/components/admin/AdminMsOverviewClient.tsx", [
  "/api/admin/ms-overview",
  "全MS",
  "メンバー別 pt配分",
  "設計額",
  "担当設計額",
  "fmtDesignYen",
  "cap_extra",
  "編集モード",
  "MS追加",
  "担当share",
  "担当pt",
  "全MS pt配分スライダー",
  "pt配分スライダー",
  "残り割り振り可能pt",
  "保存先 DB",
  "保存前支払検算",
  "保存不可",
  "MS編集停止中",
  "memberImpacts",
  "budgetImpact",
  "PJ予算残",
  "支払済み固定",
  "実績未照合",
  "これから支払予定",
  "会社留保",
  "期末未払",
  "DB値に戻す",
  "保存して DB へ反映",
  "recomputeMsOverview",
  "HealthChip",
  "groupHealthRank",
]);
expectNotIncludes("src/components/admin/AdminMsOverviewClient.tsx", [
  "fmtYen",
  "pt価値",
  "MS金額",
  "MS内金額",
  "メンバー別 年計",
]);

expectIncludes("src/app/(app)/admin/ms-overview/page.tsx", [
  "MS一覧",
  "AdminMsOverviewClient",
]);

expectIncludes("src/components/admin/AdminSidebar.tsx", [
  "MS一覧",
  "/admin/ms-overview",
]);

expectIncludes("src/components/monthly-agreement/MonthlyAgreementExperience.tsx", [
  "合意前に必ず確認すること",
  "担当内容",
  "予定額合計",
  "PJごとの予定額",
  "この月の支払いには進めません",
  "修正要望",
  "参考情報",
  "PJごとの支払い状況",
  "monthly-agreement-payment-details",
  "担当内容の詳細",
  "予定額の根拠",
  "支払い予定・未払残",
  "今シーズンのMS",
  "予定額は、ここに出ているMSのpt",
  "今月のpt",
  "支払い済み",
  "これから支払う予定",
  "PayoutSourceBadge",
  "支払い済み",
  "確認中",
  "保存済み",
  "過去の保存額",
  "税込",
]);
expectNotIncludes("src/components/monthly-agreement/MonthlyAgreementExperience.tsx", [
  "合意から支払いまでの流れ",
  "あとで支払い画面で別に決めます",
  "この画面でMSを見る",
  "今月の点数",
  "MSの点数",
  "直してほしいこと",
  "到達目標",
]);
expectPattern("src/components/monthly-agreement/MonthlyAgreementExperience.tsx", [
  /onClick=\{handleAgree\}[\s\S]{0,1800}修正要望/,
]);
expectIncludes("src/components/monthly-agreement/MonthlyAgreementGateOverlay.tsx", [
  "onBackdropClick",
  "event.target !== event.currentTarget",
  "closedGateKey",
  "bundle.currentHash",
  "router.refresh()",
]);
expectIncludes("src/app/(app)/layout.tsx", [
  "key={`${pathname}:${agreementGateBundle.ym}:${agreementGateBundle.currentHash}`}",
  "MonthlyAgreementGateOverlay",
]);
expectIncludes("src/lib/monthly-work-agreement.ts", [
  "monthly_reward_payout",
  "payoutSnapshotForCycle",
  "amountSource",
  "paidActualYen",
  "unverifiedPaidYen",
  "totalPayTaxIncludedYen",
  "futurePayoutYen",
]);
expectIncludes("spec/3-14-monthly-work-agreement-current-spec.md", [
  "monthly_reward_payout",
  "amountSource",
  "支払済み実績",
  "実績未照合",
  "これから支払予定",
]);

expectIncludes("design/FEATURE_REGISTRY.md", [
  "/admin/ms-overview",
  "支払額に見える円換算",
  "設計額",
  "memberPointTotals",
  "budgetImpact",
]);

expectIncludes("src/app/(app)/seeds/page.tsx", [
  "深掘り資料",
  "deep_dive_material_url",
  "ExternalLink",
]);
expectIncludes("src/components/seeds/SeedDetailModal.tsx", [
  "深掘り資料リンク",
  "deep_dive_material_url",
  "深掘り資料を開く",
]);
expectIncludes("src/components/seeds/SeedMarkdownPreviewModal.tsx", [
  "SeedMarkdownPreviewModal",
  "MarkdownView",
  "Driveで開く",
  "showCloseButton={false}",
]);
expectIncludes("src/app/api/seeds/[seedId]/deep-dive/route.ts", [
  "requireAuth",
  "getGoogleAuthAsync",
  "deep_dive_material_url",
  "MAX_MARKDOWN_PREVIEW_BYTES",
]);
expectIncludes("manual/5-1-research-assets-vc-seeds-scholar-spec.md", [
  "deep_dive_material_url",
]);

require("./check_payout_notice_pdf_golden.cjs");

console.log("critical PWA UI anchors ok");
