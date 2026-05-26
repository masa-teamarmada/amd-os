#!/usr/bin/env node
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
]);
expectPattern("src/components/cockpit/MilestoneGanttChart.tsx", [
  /ms\.points \* resp\.share/,
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
  "現ストック",
  "stockYen",
  "openMonthlyModal",
  "報酬キャッシュ再計算",
  "支払通知書発行",
  "PDF確認",
  "送付",
  "PayoutNoticeActions",
]);

expectIncludes("src/app/api/admin/payouts/route.ts", [
  "refreshRewards",
  "issue_notice_pdf",
  "preview_notice_pdf",
  "payoutCreatePwaNoticePdf",
  "update_notice",
  "payout_notices",
  "notice_no",
  "pdf_url",
  "sent_at",
]);

expectIncludes("../gas/064_PayoutFreeeNotice.js", [
  "2026-04 改善版フォーマット",
  "PAYOUT_LOGO_FILE_ID",
  "PAYOUT_LOGOTYPE_FILE_ID",
  "payoutGetPayoutLogotypeBlob_",
  "insertImage",
  "お支払金額",
  "摘要",
  "数量",
  "単価",
  "小計（税抜）",
  "消費税（10%）",
  "合計（税込）",
  "支払予定日",
  "支払方法",
  "振込先",
  "備考",
]);

expectNotIncludes("../gas/064_PayoutFreeeNotice.js", [
  'setValue("team ARMADA")',
  "brandCell",
  "支払通知書番号",
]);

expectIncludes("src/app/api/cron/payout-reward-cache-refresh/route.ts", [
  "payout-reward-cache-refresh",
  "syncRewardSummariesForBillingCycles",
  "targetPaymentYms",
  "03:05",
]);

expectIncludes("vercel.json", [
  "/api/cron/payout-reward-cache-refresh",
  "5 18 * * *",
]);

expectIncludes("design/FEATURE_REGISTRY.md", [
  "/admin/payouts",
  "支払通知書発行",
  "報酬キャッシュ",
  "縦型PJ収支表",
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
  // 案C レイアウト (2026-05-23 まさ確定) — 旧 max-w-[1060px] 2カラムには戻さない
  "max-w-[1600px]",
  "lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_300px]",
  "lg:sticky lg:top-12",
  "renderMsSetupBanner",
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
  "isUpcomingMeeting",
  "提案前の論点整理セッション",
  "チームへの提案案",
  "予定MTG",
  "初見ブリーフ",
  "UpcomingProseSection",
  "会議後に残したい状態",
  "1段落1ブロック",
  "blockTextToArray",
  "MeetingPrepEditor",
  "/api/meeting-prep",
  "DialogueMeetingBody",
  "narrativeMd",
  "TopicList",
  "NarrativeSection",
]);
// dialogue narrative は「2人で出した」ではなく、チームへの提案案として書く。
expectNotIncludes("src/components/cockpit/CockpitMeetingDetailModal.tsx", [
  "2 人で出した",
  "2人で出した",
]);
expectNotIncludes("src/app/api/dialogue-meeting/narrate/route.ts", [
  "2 人で出した" + "提案 (チームへの相談)",
  "2人で出した" + "提案",
]);
expectNotIncludes("src/components/cockpit/CockpitMeetingDetailModal.tsx", [
  // 旧フレーム枠の anchor (border-l + bg-white の rounded-lg 個別ボックス) は廃止
  "border-l-[3px] border-emerald-400/70",
  "1行1項目",
]);
expectIncludes("src/components/cockpit/CockpitMeetingSummary.tsx", [
  "isDialogue",
  "isUpcomingMeeting",
  "予定MTG / 準備中",
  "sourceUrl",
  "提案整理",
  // モーダル close 時に URL から ?meeting= を消す (#10 まさ 2026-05-24)
  "closeSelectedMeeting",
  "autoOpenedRef",
]);
expectIncludes("src/app/api/meeting-prep/route.ts", [
  "source_kinds: \"upcoming\"",
  "project_meeting_summaries",
  "upcoming:",
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

// 議事録モーダルにもつくよみ修正依頼ボタン (#11)
expectIncludes("src/components/cockpit/CockpitMeetingDetailModal.tsx", [
  "MeetingFeedbackBlock",
  "meeting_summary",
  "/api/notifications/feedback",
]);
const forbiddenDialogueLabels = [
  "まさ" + " × " + "えいみ " + "経営" + "会議",
  "まさ" + " × " + "えいみ" + "経営" + "会議",
  "まさ" + "えいMTG",
];
expectNotIncludes("src/components/cockpit/CockpitMeetingDetailModal.tsx", forbiddenDialogueLabels);
expectIncludes("src/app/api/dialogue-meeting/narrate/route.ts", [
  "提案前の論点整理セッション",
  "特定個人だけで確定したように読める言い方は避ける",
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
  "チームへの提案案",
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
  "rewardAmountHidden",
  "NO_COMPENSATION_SECONDED_MEMBER_IDS",
  "ID006",
  "REWARD_AMOUNT_PLACEHOLDER",
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

expectIncludes("src/app/(app)/manual/ManualMapClient.tsx", [
  "ManualGlobalToc",
  "カテゴリメニュー",
  "aria-expanded",
  "tabular-nums",
  "groups={visibleSections}",
  "showDirectory && (",
  "manual-chapter-",
  "scrollIntoView",
]);
expectNotIncludes("src/app/(app)/manual/ManualMapClient.tsx", [
  "{selected.label} の章",
  "表示中の章は下に続く。",
]);

expectIncludes("src/app/(app)/manual/[slug]/page.tsx", [
  "getManualBookChapters",
  "normalizeManualMarkdownSource",
  "showDirectory={false}",
]);

expectIncludes("src/components/cockpit/MarkdownView.tsx", [
  "takeHeadingId",
  "scroll-mt-24",
  "buildHeadingIdQueues",
]);

expectIncludes("src/lib/markdown-headings.ts", [
  "extractMarkdownHeadings",
  "markdownHeadingId",
  "cleanMarkdownHeadingTitle",
]);

require("./check_payout_notice_pdf_golden.cjs");

console.log("critical PWA UI anchors ok");
