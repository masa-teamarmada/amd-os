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
    throw new Error(
      `${rel} missing critical UI anchors: ${missing.join(", ")}`,
    );
  }
}

function expectPattern(rel, patterns) {
  const text = read(rel);
  const missing = patterns.filter((pattern) => !pattern.test(text));
  if (missing.length > 0) {
    throw new Error(
      `${rel} missing critical UI patterns: ${missing.map(String).join(", ")}`,
    );
  }
}

function expectNotIncludes(rel, needles) {
  const text = read(rel);
  const present = needles.filter((needle) => text.includes(needle));
  if (present.length > 0) {
    throw new Error(
      `${rel} contains retired critical UI anchors: ${present.join(", ")}`,
    );
  }
}

function expectFileMissing(rel) {
  const target = path.join(root, rel);
  if (fs.existsSync(target)) {
    throw new Error(
      `${rel} should not exist; retired UI component was restored`,
    );
  }
}

function expectCountAtLeast(rel, needle, minimum) {
  const text = read(rel);
  const count = text.split(needle).length - 1;
  if (count < minimum) {
    throw new Error(`${rel} needs ${minimum} occurrences of ${needle}, found ${count}`);
  }
}

expectIncludes("src/app/(app)/dashboard/page.tsx", [
  "ExtractionStatusCard",
  "FreeeConnectionStatusCard",
]);

expectIncludes("src/app/(app)/project/[projectId]/weekly-control/page.tsx", [
  "SxWeeklyControlDashboard",
  "getProjectWorkspaceBundle",
  "/weekly-control",
]);

expectIncludes("src/components/project-workspace/SxWeeklyControlDashboard.tsx", [
  "週次差分・判断・介入",
  "先週 → 今週",
  "全体ガント",
  "論点・仮説リスト",
  "データ接続状況",
  "deriveSxUnifiedTimeline",
  "SxUnifiedTimeline",
  "showPins={false}",
  "抽出接続前 · 現行台帳の仮表示",
  "sxWeeklyIssueNextDueDate",
  "sxWeeklyIssueLastActivity",
  "create_hypothesis",
  "create_validation",
  "create_decision",
  "edit_decision",
  "create_action",
  "edit_action",
  "sxWeeklyIssueNextMove",
  "sxWeeklyWeekRangeLabel",
]);

expectNotIncludes("src/components/project-workspace/SxWeeklyControlDashboard.tsx", [
  "論点と仮説を、忘れられない流れに乗せる",
  "4本柱は、例外だけを見る",
  "情報を入れる前の接続口",
]);

expectIncludes("src/lib/sx-weekly-control.ts", [
  "sxWeeklyIssueStage",
  "sxWeeklyIssueNextDueDate",
  "sxWeeklyIssueLastActivity",
  "sxWeeklyIssueNeedsAttention",
  "sxWeeklyIssueNextMove",
]);

expectIncludes("src/lib/project-workspace.ts", [
  "(?:workspace|weekly-control|navigation)",
]);

expectIncludes("src/app/(app)/project/[projectId]/workspace/page.tsx", [
  "ProjectWorkspaceDashboard",
  "/workspace",
]);

expectIncludes("src/app/(app)/project/[projectId]/navigation/page.tsx", [
  "SxNavigationDashboard",
  "getProjectWorkspaceBundle",
  "buildSxNavigationViewModel",
  "hasData",
  "/navigation",
  "PJ管制ダッシュボード - AMD OS",
]);

expectIncludes("src/components/nav/AppShell.tsx", [
  "(?:workspace|weekly-control|navigation)",
]);

expectIncludes("src/components/nav/PageTitleSetter.tsx", [
  "PJ管制ダッシュボード",
]);

expectIncludes("src/app/(app)/layout.tsx", [
  "PJ管制ダッシュボード",
]);

expectIncludes("src/lib/sx-navigation-v2.ts", [
  "export function buildSxNavigationViewModel",
  "export type NavRow",
  "export type NavBar",
  "export type NavDependencyEdge",
  "export const NAV_PARTNER_STAGE_ORDER",
  "forecastSlipCount",
  "delaySegment",
  "pulledInDays",
  "critical_group",
  "pillar_group",
  "DY_PARENT_TEST_SLUG",
]);

expectIncludes("src/components/project-navigation/SxNavigationDashboard.tsx", [
  "階層WBSガント",
  "最大遅延（対計画）",
  "次に詰まる工程",
  "関係先比較レーン",
  "CRIT",
]);

expectNotIncludes("src/components/project-navigation/SxNavigationDashboard.tsx", [
  "依存航路",
  "@/lib/project-workspace",
  "@/lib/sx-management",
]);

expectIncludes("src/components/dashboard/FreeeConnectionStatusCard.tsx", [
  "freee連携",
  "/api/dashboard/freee-connection-status",
  "P/L同期",
  "口座残高同期",
  "/management-score",
]);

expectIncludes("src/app/api/dashboard/freee-connection-status/route.ts", [
  "requireAdmin",
  "createAdminClient",
  "FRESHNESS_WINDOW_MS",
  "freee:trial_pl:%",
  "freee:wallet_txns_balance:%",
]);

expectNotIncludes("src/app/api/dashboard/freee-connection-status/route.ts", [
  "refresh_token",
  "client_secret",
]);

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
  "INTERNAL_TEMPLATE",
  "SUBMISSION_TEMPLATE",
  "社内版本文",
  "startEditing",
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
  'redirect("/admin/invoices")',
]);

expectIncludes("src/components/contracts/ContractsClient.tsx", [
  "契約台帳",
  "min-w-[1760px]",
  "sticky left-0",
  "sticky left-[160px]",
  "consolidateContractRecords",
  "AMD当事者契約",
  "金額・支払",
  "業務・成果物",
  "知財・利用",
  "解除・責任",
  "PJコックピット",
  "関連記録を契約単位に整理済み",
  "上の回答には使っていない",
  "h-[min(90vh,820px)] w-[96vw]",
  "...(selected.operational_terms_json || {})",
  "sourceTitle: latestSelectedDocument?.file_name || textTerm(existingTerms.sourceTitle)",
  "sourceRef: latestSelectedDocument?.web_view_link || textTerm(existingTerms.sourceRef)",
]);

expectIncludes("src/components/cockpit/CockpitHeader.tsx", [
  "契約上の実行条件",
  "currentContracts",
  "契約期間",
  "請求・振込",
  "業務・成果物",
  "経費申請",
  "推進条件",
  "請求 ${invoiceTiming}｜振込 ${paymentTiming}",
  "terms.cockpitSummary",
]);

expectNotIncludes("src/components/cockpit/CockpitHeader.tsx", [
  'label: "知財・利用"',
  'label: "秘密保持・制限"',
  'label: "解除・責任"',
]);

expectIncludes("src/lib/contracts-ledger.ts", [
  "contractIdentityTitle",
  "consolidateContractRecords",
  "related_record_count",
  "TRAILING_ACTIVITY_PATTERNS",
  "resolveSignatureProof",
  "resolveExpenseReimbursement",
  "resolveConfidentiality",
]);

expectPattern("src/components/contracts/ContractsClient.tsx", [
  /<th[\s\S]*?>PJ<\/th>[\s\S]*?<th[\s\S]*?>契約<\/th>/,
]);

expectNotIncludes("src/components/contracts/ContractsClient.tsx", [
  "xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.42fr)]",
  "契約ファミリー",
  "groupContractLedgerRows",
]);

expectIncludes("src/app/(app)/layout.tsx", [
  "AppShell",
  "memberId={access.memberId}",
  "projectScopedPathAllowed",
  "memberHome(access)",
]);

// PJ共有ダッシュボード (2026-07-18): PJ限定ユーザーへ通常の
// Supabase authenticated sessionを残さず、参加PJだけを表示する。
expectIncludes("src/app/page.tsx", [
  "getCurrentMemberAccess",
  "memberHome(access)",
]);
expectIncludes("src/app/auth/callback/route.ts", [
  'member.os_access_scope === "project"',
  'await supabase.auth.signOut({ scope: "local" })',
  "PROJECT_WORKSPACE_SESSION_COOKIE",
  "createProjectWorkspaceSessionValue",
  "project_members",
]);
// signOut の scope 明示 (2026-07-27): GoTrueClient.signOut() の既定 scope は "global" で、
// 省略すると失敗経路を1回踏むだけで当人の全デバイスのセッションが失効する。callback の
// signOut はどれも「このブラウザのセッションだけ捨てる」意図なので、引数なし呼び出しを禁じる。
expectNotIncludes("src/app/auth/callback/route.ts", [
  "supabase.auth.signOut()",
]);
expectCountAtLeast(
  "src/app/auth/callback/route.ts",
  'supabase.auth.signOut({ scope: "local" })',
  7,
);
expectIncludes("src/lib/project-workspace-session.ts", [
  'amd_os_project_session',
  "createHmac",
  "timingSafeEqual",
  "expiresAt",
]);
expectIncludes("src/lib/project-workspace.ts", [
  "getProjectWorkspaceSession",
  'member.os_access_scope !== "project"',
  "projectScopedPathAllowed",
  "getProjectWorkspaceBundle",
  "project_weekly_effort_entries",
  "member_activities",
]);
expectIncludes("src/components/dashboard/DashboardGrid.tsx", [
  'project.projectId === "p21"',
  "/workspace",
  "共有ダッシュボード",
]);
expectIncludes("src/components/project-workspace/ProjectWorkspaceDashboard.tsx", [
  "研究からSUまでの時間配分",
  "経営判定",
  "次の経営介入",
  "今週決めること",
  "週次エフォートを確定",
  "活動データの鮮度",
  "研究側メンバー未確認",
  "経営台帳への接続",
  "confidenceLabel",
  "hypothesisStatusLabel",
  "auditEntityLabel",
  "lg:hidden",
  "hidden overflow-x-auto lg:block",
  "運用準備 未完了",
  "effectiveJudgment",
  "selected-management-context",
  "aria-pressed",
  "aria-controls=\"selected-management-context\"",
  "buildMilestoneLabelMap",
  "nominalizeSxActionLabel(displayManagementText(milestone.title))",
  "milestoneLabels",
  "milestoneOptions = management.milestones.map((item) => ({ value: item.id, label: `${nominalizeSxActionLabel(item.title)}",
  "決定済み\" : decision.status === \"deferred\" ? \"保留\" : \"意思決定待ち\"} / {nominalizeSxActionLabel(decision.title)}",
  "次アクション: {nominalizeSxActionLabel(action.title)}",
  "{nominalizeSxActionLabel(displayManagementText(outcome.title))}",
  "資金残存月数",
  "名称未確認",
  "overflow-x-clip",
  "sourceLabel",
  "SX側の次アクション",
  "非表示にする",
  "DeletedManagementSection",
  "非表示の情報を確認",
  "復元",
  "CategoryBand",
  "decisionOptions = management.decisions.map((item) => ({ value: item.id, label: nominalizeSxActionLabel(item.title)",
  "outcomeOptions = management.outcomes.map((item) => ({ value: item.id, label: `${nominalizeSxActionLabel(item.title)}",
  "decisionDisplayTitle = nominalizeSxActionLabel(decision.title)",
  "<h3 className=\"mt-3 text-sm font-semibold leading-5 text-[#24231f]\">{decisionDisplayTitle}</h3>",
  "aria-label={`${decisionDisplayTitle}を編集`}",
]);
// spec (2026-07-25 統合タイムライン化): workspace内部の左レール(desktop 152px / mobile・tablet横帯)は
// GlobalNavサイドバーとは別物。経営サマリー節=deck(判定バー+統合タイムライン+意思決定・介入)、
// 計画詳細節=全マイルストーン詳細表+選択文脈、技術証明節=三証明+7テーマ表。旧・事業化ロードマップ
// (SxNineMonthTimeline)は統合タイムラインへ吸収して廃止。
expectIncludes("src/components/project-workspace/ProjectWorkspaceDashboard.tsx", [
  "lg:grid-cols-[152px_minmax(0,1fr)]",
  "aria-label=\"経営診断ナビ\"",
  '["management-proof", "技術証明"]',
  '["management-plan", "計画詳細"]',
  "全マイルストーン詳細表を表示",
  "sx-effort-entry-details",
  // Round 20: ゲート詳細はモーダル（下方向スクロールをやめる）。図と詳細表から手動で追加・編集。
  "sx-milestone-detail-modal",
  "MilestoneDetailModal",
  "openMilestoneDetail",
  "sx-plan-manual-edit",
  "マイルストーンを追加",
  "依存関係を追加",
  "予測日の根拠:",
  "kicker=\"論点・仮説台帳\"",
  "data-testid=\"sx-issue-ledger-table\"",
  "kicker=\"関係先管理\"",
  "title=\"関係先リスト\"",
]);
expectNotIncludes("src/components/project-workspace/ProjectWorkspaceDashboard.tsx", [
  "9か月の全体時間軸",
  "協力機関の進捗",
  "次の受け渡し",
  "受け渡し先",
  "milestoneOptions = management.milestones.map((item) => ({ value: item.id, label: `${item.title}",
  "決定済み\" : decision.status === \"deferred\" ? \"保留\" : \"意思決定待ち\"} / {decision.title}",
  "次アクション: {action.title}",
  "decisionOptions = management.decisions.map((item) => ({ value: item.id, label: item.title }))",
  "outcomeOptions = management.outcomes.map((item) => ({ value: item.id, label: `${item.title}（",
  "<h3 className=\"mt-3 text-sm font-semibold leading-5 text-[#24231f]\">{decision.title}</h3>",
  "aria-label={`${decision.title}を編集`}",
  "SxNineMonthTimeline",
]);
expectIncludes("src/lib/sx-action-label.ts", [
  "nominalizeSxActionLabel",
  '["を締結する", "締結"]',
  "SENTENCE_PUNCTUATION",
]);
expectIncludes("src/components/project-workspace/SxDevelopmentThemeBoard.tsx", [
  "nominalizeSxActionLabel",
  "name: milestone ? nominalizeSxActionLabel(milestone.title) : fallbackName",
  "position: parent ? `${nominalizeSxActionLabel(parent.title)}の成立条件`",
  "successors.map((item) => nominalizeSxActionLabel(item.title))",
  '{assessed === 0 ? "全7テーマ 未評価 ・ " : `評価済 ${assessed}/7 ・ `}',
  "nextExperiment: issue?.nextValidation?.trim()",
  "? nominalizeSxActionLabel(issue.nextValidation.trim())",
]);
expectNotIncludes("src/components/project-workspace/SxDevelopmentThemeBoard.tsx", [
  "name: milestone?.title ?? fallbackName",
  "position: parent ? `${parent.title}の成立条件`",
  "successors.map((item) => item.title)",
  "nextExperiment: nonEmpty(issue?.nextValidation, \"次実験 未登録\")",
]);
expectIncludes("src/components/project-workspace/SxPartnerPipeline.tsx", [
  "milestoneTitleBySlug = new Map(management.milestones.map((milestone) => [milestone.slug, nominalizeSxActionLabel(milestone.title)]))",
  "milestoneTitleById = new Map(management.milestones.map((milestone) => [milestone.id, nominalizeSxActionLabel(milestone.title)]))",
]);
expectNotIncludes("src/components/project-workspace/SxPartnerPipeline.tsx", [
  "[milestone.slug, milestone.title]",
  "[milestone.id, milestone.title]",
]);
{
  const dashboard = read("src/components/project-workspace/ProjectWorkspaceDashboard.tsx");
  const summaryIndex = dashboard.indexOf('id="management-summary"');
  const readinessIndex = dashboard.indexOf('aria-labelledby="readiness-heading"');
  if (summaryIndex < 0 || readinessIndex < 0 || readinessIndex < summaryIndex) {
    throw new Error("経営判定が運用準備チェックより前に配置されていないよ");
  }
  if (dashboard.includes("overflow-x-hidden")) {
    throw new Error("workspaceのoverflow-x-hiddenがstickyナビを分断する可能性があるよ");
  }
}
expectIncludes("src/app/api/project-workspace/[projectId]/management/route.ts", [
  "export async function POST",
  "manual_create",
  "追加行は非表示化したよ",
  "commitment_kind",
  "assertParentsInProject",
  "const optionalDate = (key: string) => raw[key] == null || raw[key] === \"\" ? null",
  'if (resource === "issue")',
  'if (resource === "hypothesis")',
  'if (resource === "decision")',
  'if (resource === "action")',
  "includeDeleted",
  "listDeletedRecords",
  "decision_text",
  "sx_owner",
  "rollbackPatch",
]);
expectIncludes("src/app/api/project-workspace/[projectId]/management/route.ts", [
  "function safeDeletePatch(memberId: string) {",
  "return { deleted_at: new Date().toISOString(), deleted_by: memberId };",
  "Soft-delete and restore are visibility toggles, not edits",
  "if (meta.hasSourceRef && !deleting && !restoring) {",
  "patch.source_kind = \"manual\";",
  "patch.source_ref = \"PWA共有管理画面\";",
]);
expectNotIncludes("src/app/api/project-workspace/[projectId]/management/route.ts", [
  "safeDeletePatch(context.access.memberId, meta)",
  "source_kind/source_ref are provenance, not editable state",
]);
expectIncludes("scripts/migrations/185_sx_management_semantic_guards.sql", [
  "project_management_decisions_decided_requirements_185",
  "project_management_partner_commitments_sx_followup_requirements",
  "decision_state <> 'decided'",
  "commitment_kind <> 'sx_followup'",
]);
expectIncludes("src/components/project-workspace/ProjectWorkspaceDashboard.tsx", [
  "const CREATE_RESOURCES",
  "const defaults: Record<string, string>",
  'field.options?.[0]?.value || ""',
  "effectiveJudgment",
  "managementNavItems",
]);
expectIncludes("scripts/audit_sx_management_visible_terms.mjs", [
  "SCRIPT",
  "rawPattern",
  "scrollWidth",
  "SX_VISIBLE_AUDIT_COOKIE_VALUE",
]);
expectCountAtLeast("src/components/project-workspace/ProjectWorkspaceDashboard.tsx", "<ObjectiveKpiSection", 1);
expectCountAtLeast("src/components/project-workspace/ProjectWorkspaceDashboard.tsx", "<MeasurementSection", 1);
expectCountAtLeast("src/components/project-workspace/ProjectWorkspaceDashboard.tsx", "<DecisionLoopSection", 1);
expectIncludes("src/components/project-workspace/ProjectWorkspaceDashboard.tsx", [
  "<SxProofOutcomes",
  "<SxPartnerPipeline",
  "sx-management-ledger",
  "管理台帳・編集",
  // 2026-07-24: DecisionLoopSection「関係先との約束」/ SelectedMilestoneContext「関係先・約束」
  // は SxPartnerPipeline とは別の、関係先データの2つ目の公開ビュー。この import が落ちると
  // 片方のビューだけ内部コードネーム(まさ/かる/ちこ)が再露出する。
  "sxNormalizePublicName",
]);
expectIncludes("src/lib/sx-proof-mapping.ts", [
  "SX_PROOF_THEME_SLUGS",
  "SX_THEME_PROOF_MAP",
  "computeSxProofOutcomes",
  "sxProofThemeMatrix",
  "PoC用リアクター仕様確定",
  "確定仕様での動作確認",
  "ユニットエコノミクス証明",
  "すべてのテーマが未評価",
]);
expectIncludes("src/components/project-workspace/SxProofOutcomes.tsx", [
  "sx-proof-outcomes",
  "sx-proof-theme-matrix",
  // 2026-07-25 ストリップ化: 1証明=1行（期限/評価N/M/状態分布/充足%/固有の不足）。3枚同文の不足は
  // sharedMissingバナー1行へ、7×3マトリクスは既定閉のdetails付録へ。未評価を0%として描かない。
  "sx-proof-card-",
  "sx-proof-shared-missing",
  "sx-proof-positioning",
  "位置づけ: 論点・仮説台帳",
  "sharedMissing",
  '"未評価" : `${outcome.evidenceCoveragePct}%`',
  "接続マトリクス（7×3）を表示",
]);
expectIncludes("src/components/project-workspace/SxPartnerPipeline.tsx", [
  "sx-partner-pipeline",
  "sxPartnerDisplay",
  // 2026-07-25 関係の流れ + 当方ボール強調: これまで→現在地→ゴールの一本線（sx-partner-journey）と、
  // 当方（SX）ボール行の行頭バッジ・赤左罫・並び順tier(blocked>sxボール>他)。
  "PartnerJourneyFlow",
  "sx-partner-journey",
  "関係の流れ（これまで → 現在地 → ゴール）",
  "当方ボール",
  // Round 22: 未接触のPoC候補先(数十社)は台帳へ流し込まず、専用ボードで数として見る。
  // この除外が外れると、ボールと約束を5秒で読む台帳の役割が壊れる。
  "sxIsUntouchedPocCandidate",
  "ledgerPartners",
  "sx-partner-poc-pointer",
  // Round 23: 履歴の省略表示は流れが担うので7列目から外す。未完了の保有事項は流れの「これから」へ。
  "関連ゲート・証明",
  "pendingSteps",
  'border-l-[#b5533f]',
  // 2026-07-24: 外部PJメンバーにも見えるSX関係先台帳で内部コードネーム(まさ/かる/ちこ)を
  // そのまま出さないための表示専用正規化。この import が落ちると本文/担当/ボール等に
  // コードネームが再露出する (production DOM audit で検出済み)。
  "sxNormalizePublicName",
  "deferredLowPriority",
  "保留・低優先（重要経路外・",
  "当方保有",
  "先方保有",
  "分類別件数ナビ",
  "分類は虹色にしない",
  "共同",
  "行為主体未確認",
  "sxFormatDueDateWithPrecision",
  "sxSortInteractionsByRecency",
  "sxHoldingsForPartner",
  "sxComputeControlBandCounts",
  "sxPrimaryRoleKindCounts",
  "sxRoleDisplayLabel",
  "sxGroupPartnersByPrimaryClassification",
  "sxIsHoldingOverdue",
  "sxIsHoldingMonthPrecision",
  "やり取り履歴",
  "履歴を追加",
  "保有事項を追加",
  "分類を追加",
  "台帳の詳細・編集",
  "ゲート未接続",
  "全関係先",
  "対応中",
  "双方保有先",
  "月精度期限",
  "endedPartners",
  "blockedHoldings",
  "unorganizedPartners",
  "organizedCoveragePct",
  "sxAllHoldingsForPartnerAudit",
  "sxIsPartnerEnded",
  "sxSortHoldingsByPriority",
  "sxPartnerHasBlockedHolding",
  "未整理",
  "終了（対応中から除外",
  "aria-labelledby={nameHeadingId}",
  "aria-pressed",
  // spec (2026-07-24 二車線化): 関係先リストの desktop 列は 関係先/当方の保有事項/先方の保有事項/
  // 次の一手/目標状態/現在ボール・期限/やり取り履歴 の7列固定。tablet/mobile は当方/先方の二車線。
  "grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:grid-cols-[1fr_1fr] xl:grid-cols-[128px_minmax(130px,1fr)_minmax(130px,1fr)_120px_120px_108px_124px]",
  "関係先",
  "当方の保有事項",
  "先方の保有事項",
  "次の一手",
  "目標状態",
  "現在ボール・期限",
  // spec P0-1/2 (2026-07-24, 4th audit round): InteractionRow mobile grid + timeline header grid.
  "grid-cols-[56px_minmax(0,1fr)_64px_44px]",
  "md:grid-cols-[56px_68px_minmax(130px,1fr)_64px_44px]",
  "grid-cols-[minmax(0,1fr)_44px]",
  // spec P0-4: ControlBand順は緊急→ボール→母数、横scroll手掛かり(fade)、分類h4の左罫線。
  'heading="緊急"',
  'heading="ボール"',
  'heading="母数"',
  "SCROLL_HINT_CLASS",
  "ALWAYS_SCROLL_HINT_CLASS",
  "border-l-4 border-[#e4ddd0] border-l-[#38745d]",
  // spec P0-10: 未整理/確認済みが未区別なことを隠さない台帳0件表現、登録率(対応中N先中)。
  "台帳0件（未整理/確認済み0件は未区別）",
  "登録率",
  // spec P1-8: blocked partner最優先の可視化。
  "停止",
  // spec P1 (2026-07-24 4th audit): control labelはOR条件（当方/先方いずれか一方でも0件）なので
  // 「台帳0件先」ではなく「空レーンあり」。
  "空レーンあり",
  // spec P1: role filter中は active groups + deferred + ended を合算してから空判定する。
  "deferredPartners.length === 0 && endedPartners.length === 0",
  // spec P1: InteractionRow read-onlyでは空の編集44px列を確保しない、管理者だけ末尾44px。
  "gridColsClass",
  "grid-cols-[56px_minmax(0,1fr)_64px] md:grid-cols-[56px_68px_minmax(130px,1fr)_64px]",
  // spec P1: 保有事項追加のhit targetは44px（視覚は初期行密度を壊さないcompactのまま、before:inset[-10px]で拡張）。
  "before:absolute before:inset-[-10px] before:content-['']",
  // spec P1: 一次根拠(sourceEvidence)と完了の証拠(completionEvidence)を混同しない。
  "sourceEvidence",
  "一次根拠",
  // spec (2026-07-24 最終監査残件): 保有事項の全件監査表示に出典/最終確認/確度を追加。
  "出典",
  "最終確認",
  "確度",
  // spec (2026-07-24 RD最終差し戻し): 約束・次アクション全件カードにもHoldingRowと同じ出典行を追加。
  "sxSourceKindLabel(commitment.sourceKind)",
  "sxSourceRefDisplayLabel(commitment.sourceRef)",
  // spec: mask-imageのcontent-fadeを撤去し、非フェードのScrollHintArrowへ置換。
  "ScrollHintArrow",
  // spec: mobile touchでInteractionRowのtruncate全文へ到達できる全文全件セクション。
  "やり取り履歴（全文・全件）",
  // spec P0-2 (2026-07-24 COO差し戻し3点是正): 表側previewは件数に関係なく必ずslice(0,3)、3件超は短い注記。
  "preview = sorted.slice(0, 3)",
  "preview.map((interaction)",
  "表示3 / 全",
  // spec P1 (同上、差し戻し2点目): header add-buttonの有無でgrid自体を切り替える（read-onlyは空44px/gapなし）。
  "canAddInteraction",
  "grid-cols-1",
  // spec P1 (同上、差し戻し3点目): 台帳詳細summaryは権限別文言。
  '{canManage ? "台帳の詳細・編集" : "台帳の詳細"}',
  // spec P1 (2026-07-24 追加是正): InteractionTimeline previewの3件超注記も権限別文言（summaryと同じ実在ラベルに一致）。
  '全文は「{canManage ? "台帳の詳細・編集"',
  ': "台帳の詳細"}」へ',
]);
expectNotIncludes("src/components/project-workspace/SxPartnerPipeline.tsx", [
  "text-[9px]",
  "opacity-80",
  "text-[#777166]",
  "組成率",
  "未整理（当方側の確認未実施）",
  "未整理（先方側の確認未実施）",
  'pt-3" open>',
  "inline-flex h-6 w-6 items-center justify-center rounded-md border border-[#cfc7b9] text-[#514e47] hover:bg-[#f8f5ec]",
  // spec (2026-07-24): mask-imageのcontent-fadeは末尾指標そのものを薄くするため撤去済み。
  "mask-image",
  // spec (2026-07-24 COO差し戻し4点目): ScrollHintArrowの薄い#a49d8cは#69665dへ統一済み、復活させない。
  "text-[#a49d8c]",
  // spec (2026-07-24 二車線化): 中央受け渡し欄・協力機関の進捗名称は撤去済み
  // (handoff_to/next_ball_ownerはDB互換フィールドとして内部にのみ残す。コード内コメントでの
  // 言及まで禁止すると誤検知するため、ユーザー向けUI文言が明確な箇所だけを対象にする)。
  "中央受け渡し",
  "協力機関の進捗",
]);
expectIncludes("src/lib/sx-management.ts", [
  "SxPartnerInteraction",
  "SxPartnerRole",
  "SxPartnerWorkItem",
  "SxActorSide",
  "actorSide",
  "actorLabel",
  "current_ball_side",
  "current_ball_owner",
  "next_ball_owner",
  "target_state",
  "due_date_precision",
  "project_management_partner_interactions",
  "project_management_partner_roles",
  "project_management_partner_work_items",
  "deferredLowPriority",
]);
expectIncludes("src/lib/sx-management.ts", [
  // spec (2026-07-24 RD最終差し戻し): mapCommitment()がcommitment.source_refをSxPartnerCommitmentへ
  // 転写する（従来ここだけsourceKind止まりでsourceRefが欠落していた）。
  'ownerLabel: stringValue(row, "owner_label", "担当未確認"), counterpartyOwner: nullableString(row, "counterparty_owner"), sxOwner: nullableString(row, "sx_owner"), evidence: nullableString(row, "evidence"), nextReviewOn: nullableString(row, "next_review_on"),\n    lastVerifiedAt: stringValue(row, "last_verified_at"), confidence: asConfidence(row.confidence), sourceKind: asSourceKind(row.source_kind), sourceRef: nullableString(row, "source_ref"),',
]);
expectIncludes("src/lib/sx-partner-holdings.ts", [
  // 2026-07-25: 並び順tier blocked(0) > 当方ボール(1) > その他(2)。当方ボールを期限順より前へ。
  'currentBallSide === "sx" ? "1" : "2"',
  "sxHoldingsForPartner",
  "sxComputeControlBandCounts",
  "sxPrimaryRoleKindCounts",
  "sxRoleDisplayLabel",
  "sxGroupPartnersByPrimaryClassification",
  "sxPartnerDisplaySortKey",
  "sxPartnerHasBlockedHolding",
  "sxPartnerPrioritySortKey",
  "sxIsHoldingOverdue",
  "sxIsHoldingDueSoon",
  "sxIsHoldingMonthPrecision",
  "sxIsHoldingDueUnset",
  "totalPartners",
  "deferredPartners",
  "activePartners",
  "unclassifiedPartners",
  "bothSidesHeldPartners",
  "counterparty_promise",
  "sx_followup",
  // spec P1 (2026-07-24 4th audit): group sortはblockedを最優先にし、unclassified lastより前に判定。
  "sxGroupHasBlockedPartner",
  "sourceEvidence",
  // spec (2026-07-24 最終監査残件): 出典/最終確認/確度のprovenance正規化 + raw source_refを漏らさない表示ラベル整形。
  "sxSourceKindLabel",
  "sxSourceRefDisplayLabel",
]);
expectIncludes("src/components/project-workspace/sx-visual-shared.tsx", [
  "sxFormatDueDateWithPrecision",
  "sxFormatEventDateWithPrecision",
  "期限未設定",
  "日付未確認",
  "sxLatestInteraction",
  "sxSortInteractionsByRecency",
  "sxBallSideLabel",
  "sxInteractionKindLabel",
  "sxPartnerHasBlockedHolding",
  "sxPartnerPrioritySortKey",
  "@/lib/sx-partner-holdings",
]);
expectIncludes("src/app/api/project-workspace/[projectId]/management/route.ts", [
  '"interaction"',
  '"partner_role"',
  '"partner_work_item"',
  "project_management_partner_interactions",
  "project_management_partner_roles",
  "project_management_partner_work_items",
  "interaction_kind",
  "ball_side_after",
  "actor_side",
  "role_kind",
  "relationship_state",
  "item_kind",
  "handoff_to",
  "assertDatePrecisionConsistency",
  "assertWorkItemCompletionRequirements",
  "completed_on",
  "completion_evidence",
  "accepted_by",
  "accepted_on",
]);
expectIncludes("scripts/migrations/191_sx_partner_ledger_upgrade.sql", [
  "project_management_partner_interactions",
  "current_ball_side",
  "due_date_precision",
  "project_management_partners_ball_side_check_191",
  "project_management_partners_due_precision_check_191",
  "project_management_partners_due_date_consistency_191",
  "project_management_partner_interactions_date_consistency_191",
  "project_management_parent_project_guard",
  "daiki-axis",
  "smbc",
  "user:2026-07-23#partner-progress",
  "ON CONFLICT (project_id, slug) DO UPDATE SET",
]);
expectIncludes("scripts/migrations/192_sx_partner_role_and_work_items.sql", [
  "project_management_partner_roles",
  "project_management_partner_work_items",
  "project_management_partner_roles_one_primary_192",
  "project_management_partner_work_items_due_date_consistency_192",
  "project_management_partner_interactions_actor_side_check_192",
  "project_management_partner_roles_source_kind_check_192",
  "pm_partner_work_items_completion_check_192",
  "pm_partner_work_items_acceptance_check_192",
  "completed_on",
  "completion_evidence",
  "accepted_by",
  "accepted_on",
  "actor_side",
  "actor_label",
  "role_kind",
  "relationship_state",
  "unclassified",
  "shareholder_investor",
  "university_research",
  "financial_institution",
  "ehime-university",
  "partners-fund",
  "fc-hokuriku",
  "user:2026-07-24#partner-role-normalization",
  "user:2026-07-24#partner-work-items",
]);
expectNotIncludes("scripts/migrations/192_sx_partner_role_and_work_items.sql", [
  "summary IN ('試作リアクターの製作が完了した', '2026年8月の納品予定を確認した')",
  "行為主体backfill履歴が4件揃っていません",
]);
expectIncludes("scripts/migrations/192_sx_partner_role_and_work_items.sql", [
  "still_unknown_actor_count",
  "i.actor_side = 'unknown'",
]);
// 2026-07-24 P0: the original 65/64-byte constraint names silently truncate past Postgres's 63-byte
// NAMEDATALEN limit, so the migration must declare short (<63 byte) names directly and rename any
// already-truncated legacy constraint onto them idempotently, rather than re-adding a duplicate.
expectIncludes("scripts/migrations/192_sx_partner_role_and_work_items.sql", [
  "pm_partner_work_items_completion_check_192",
  "pm_partner_work_items_acceptance_check_192",
  "project_management_partner_work_items_completion_requirements_1",
  "project_management_partner_work_items_deliverable_acceptance_19",
  "RENAME CONSTRAINT",
]);
expectNotIncludes("scripts/migrations/192_sx_partner_role_and_work_items.sql", [
  "ADD CONSTRAINT project_management_partner_work_items_completion_requirements_192",
  "ADD CONSTRAINT project_management_partner_work_items_deliverable_acceptance_192",
]);
expectIncludes("scripts/test_project_management_rls.mjs", [
  "pm_partner_work_items_completion_check_192",
  "pm_partner_work_items_acceptance_check_192",
]);
expectNotIncludes("scripts/test_project_management_rls.mjs", [
  "project_management_partner_work_items_completion_requirements_192",
  "project_management_partner_work_items_deliverable_acceptance_192",
]);
expectIncludes("src/components/project-workspace/ProjectWorkspaceDashboard.tsx", [
  "onEditPartner",
  "onAddInteraction",
  "onEditInteraction",
  "onAddWorkItem",
  "onEditWorkItem",
  "onAddRole",
  "onEditRole",
  'interaction: [',
  'partner_role: [',
  'partner_work_item: [',
]);
expectIncludes("src/components/project-workspace/SxExecutiveControlDeck.tsx", [
  "sx-executive-control-deck",
  "sx-intervention-queue",
  "sx-intervention-queue-mobile",
  "focusAnchorRow",
  "sx-anchor-highlight",
  "data-sx-anchor",
  "prefers-reduced-motion",
  "callsOnSelectMilestone",
  "sxEcdFormatDueDate",
  "InterventionRowDesktop",
  "InterventionRowMobile",
  "RankBadge",
  "ballDisplay",
  "ボール / 担当",
  // Round 19 (2026-07-25 統合タイムライン): deckは 判定バー（業務/運用/STEP2消化/設立判断までの
  // 4値分離） → 統合タイムライン → 今週の意思決定 + 次の経営介入（top5、最大遅延柱のクォータ、
  // ①〜⑤はタイムラインのピンと同番号）の3帯。旧・4本柱信号帯 / 経路レール / 直近アクション帯は
  // 統合タイムラインへ吸収して廃止。
  "sx-verdict-bar",
  "sx-state-map",
  "sx-decision-queue",
  "sx-quota-note",
  "SxUnifiedTimeline",
  "deriveSxUnifiedTimeline",
  "deriveSxVerdictSummary",
  "deriveSxInterventionQueue",
  "applySxInterventionPillarQuota",
  "意思決定待ち（期限順）",
  "次の経営介入",
  "業務判定（重要経路）",
  "運用判定（データ充足）",
  "STEP2消化",
  "設立まで",
  "pillarGates",
  "knowledgeType === \"decision_needed\"",
]);
expectNotIncludes("src/components/project-workspace/SxExecutiveControlDeck.tsx", [
  "相手先要フォロー",
  "直近アクション",
  "sx-four-pillar-signal-strip",
  "sx-critical-path-rail",
]);
expectIncludes("src/components/project-workspace/SxUnifiedTimeline.tsx", [
  "sx-unified-timeline",
  "今日",
  "現在地",
  "設立 {sxFormatDate(timeline.objectiveDate)}",
  "柱 / マイルストーン",
  "RowBar",
  "rowCenterY",
  "criticalPolyline",
  "min-w-[880px]",
  "data-sx-pin",
  // Round 20: 行クリックはモーダル、管理者は図から直接 追加/編集できる。
  "sxFormatSlip",
  "onEditMilestone",
  "onCreateMilestone",
  "canManage",
  "灰バー=仮置きの日程での遅れ（根拠未確認）",
  "前提のつながり",
  // Round 23: 計画バーは枠だけで描き、塗りは登録済み進捗からのみ。塗りつぶすと「今日線より右まで終わっている」と誤読される。
  "row.progressPct > 0",
  "濃い塗り=完了した範囲",
  "担当未確認",
  "日程未登録",
  "aria-pressed",
  "focus-visible:outline",
  // Round 22: ピンはクリックで飛ばさずhoverで中身を出す。遅れ語は「遅れ/前倒し」の二択。
  "sx-pin-hovercard",
  "onMouseEnter",
  "止まるゲート:",
]);
expectIncludes("src/lib/sx-executive-control-deck.ts", [
  // Provisional dates / missing dates must never resolve to a false-green current/future state.
  "dateCertainty === \"provisional\"",
  "!milestone.plannedEnd && !milestone.forecastEnd",
  // Partner work-item interventions must be filtered to active statuses only.
  "ACTIVE_PARTNER_WORK_STATUSES",
  // Partner fallback must only be suppressed by ballSide === 'none', and must include sx-side ball.
  'if (partner.currentBallSide === "none") continue;',
  "sxEcdFormatDueDate",
  // Overdue checks must go through the precision-aware helper, not raw string comparison.
  "sxEcdIsDueDateOverdue",
  // 経営状況図: flags attach only via the row's own milestoneId; unresolvable rows go to
  // `unattached` and are never guessed onto a node. Owner/stale/unassessed gaps are state marks
  // on the node, never third-party flags.
  "deriveSxStateMap",
  "FLAG_KINDS",
  "unattached",
  // 統合タイムライン: 全マイルストーンを柱レーンへ日数比例で置き、日付の無い行は描かず件数で
  // 明示する。判定バーは業務（重要経路の停止・期限超過・遅延見込み）と運用（充足）を分離し、
  // STEP2消化は金額データが無い限り「未確認」。クォータは行を発明せず、無ければ注記を返す。
  "deriveSxUnifiedTimeline",
  "deriveSxVerdictSummary",
  "applySxInterventionPillarQuota",
  "pillarGates",
  "undatedCount",
  // Round 20 (2026-07-25): 仮置き予測差を「遅延」と呼ばない3状態分類。初期Seed等の定型理由は
  // 根拠なし扱いにし、実測の期限超過とは別トーンで描く。
  "sxEcdClassifySlip",
  "isPlaceholderForecastReason",
  '"provisional_slip"',
  '実際の遅れなし',
  '仮置きの見込みは予定より最大',
  '"未確認", known: false',
]);
expectIncludes("src/components/project-workspace/ProjectWorkspaceDashboard.tsx", [
  "SxExecutiveControlDeck",
  'data-sx-anchor={`sx-issue-${issue.id}`}',
]);
expectIncludes("src/components/project-workspace/SxPartnerPipeline.tsx", [
  'data-sx-anchor={`sx-partner-${partner.id}`}',
]);
expectIncludes("src/app/globals.css", [
  "@media (prefers-reduced-motion: reduce)",
]);
expectNotIncludes("src/components/project-workspace/ProjectWorkspaceDashboard.tsx", [
  "SxReactorPanel",
  "SxDecisionRunway",
]);
expectIncludes("src/app/api/project-workspace/[projectId]/effort/route.ts", [
  "canAccessWorkspaceProject",
  'access.scope === "project" && memberId !== access.memberId',
  "project_weekly_effort_entries",
  "management_milestone_id",
]);
expectIncludes("src/components/admin/ProjectMemberAccountForm.tsx", [
  "PJ限定アカウントを追加",
  "email",
  "memberName",
]);
expectIncludes("scripts/migrations/182_project_scoped_workspace.sql", [
  "os_access_scope",
  "amd_os_is_member",
  "project_weekly_effort_entries",
  "amd_os_can_access_project",
  "amd_os_can_manage_project_effort",
]);

expectIncludes("src/components/nav/AppShell.tsx", [
  "usePathname",
  'const isAdminRoute = pathname.startsWith("/admin")',
  "<AdminSidebar />",
  "<GlobalNav",
]);

expectPattern("src/components/nav/AppShell.tsx", [
  /isAdminRoute \? \([\s\S]*?<AdminSidebar \/>[\s\S]*?\) : \([\s\S]*?<GlobalNav/,
]);

expectNotIncludes("src/app/(app)/admin/layout.tsx", [
  "AdminSidebar",
  "flex h-screen",
]);

expectIncludes("src/components/admin/AdminSidebar.tsx", [
  "請求書発行",
  "/admin/invoices",
  "裏wiki",
  "/admin/private-wiki",
  "BUILD_VERSION",
  'href="/dashboard"',
  "Adminメニューを開く",
  "md:sticky",
]);

expectIncludes("src/components/admin/AdminPrivateWikiClient.tsx", [
  "AdminPrivateWikiClient",
  "birthdayLabel",
  "originLabel",
  "residenceLabel",
  "contactContext",
  "familyNote",
  "tabooNote",
  "誕生日",
  "出身地",
  "居住地",
  "接点",
  "家族",
  "タブー",
  "admin-only",
  "通常cockpit、公開ページ、研究機関workspaceには出さない",
]);

expectNotIncludes("src/components/admin/AdminPrivateWikiClient.tsx", [
  "tagsText",
  "tagFilter",
  "normalizeTags",
]);

expectIncludes("src/app/api/admin/private-wiki/route.ts", [
  "requireAdmin",
  "createAdminClient",
  "birthdayLabel",
  "originLabel",
  "residenceLabel",
  "contactContext",
  "familyNote",
  "tabooNote",
  "birthday_label",
  "origin_label",
  "residence_label",
  "contact_context",
  "family_note",
  "taboo_note",
  'visibility: "admin_private"',
]);

expectNotIncludes("src/app/api/admin/private-wiki/route.ts", [
  'req.nextUrl.searchParams.get("tag")',
  'contains("tags"',
]);

expectIncludes(
  "scripts/migrations/173_private_wiki_person_context_fields.sql",
  [
    "birthday_label",
    "origin_label",
    "residence_label",
    "contact_context",
    "family_note",
    "taboo_note",
  ],
);

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
  "Materials",
  "/knowledge-map",
]);

expectIncludes("src/app/(app)/knowledge-map/page.tsx", [
  "MaterialsKnowledgeView",
  "fetchKnowledgeMapData",
  "AMD Materials",
]);

expectIncludes("src/components/knowledge-map/MaterialsKnowledgeView.tsx", [
  "AMD / 世界の材料データベース",
  "需給の崩れランキング",
  "供給過剰側",
  "価格乱高下",
  "評価時点・確からしさ",
  "4指標の合計ランキング",
  "4指標合計",
  "原料と作り方",
  "compareMaterialTotalScore",
  "供給不安",
  "供給警報",
  "供給危機",
  "ElementInsightDialog",
  "MaterialInsightDialog",
  "直近公表相場",
  "MarketTrendChart",
  "SupplyPie",
  "詳細を開く",
  "HEAT_LEVEL_LABELS",
  "glanceUse",
  "未評価",
  "鉱物・鉱石",
  "樹脂・高分子",
  "比較に追加",
  "KnowledgeMapView data={knowledgeData} embedded",
]);

expectIncludes("src/lib/materials-data.ts", [
  "export const ELEMENTS",
  "export const MINERALS",
  "export const POLYMERS",
  "米国地質調査所（USGS）鉱物資源概要 2026",
  "国際エネルギー機関（IEA）重要鉱物の世界見通し 2025",
  "elementGlance",
  "export const ELEMENT_MARKETS",
  "電池級炭酸リチウム",
  "2025年 世界鉱山生産",
  "電力を高効率に変換する窒化ガリウム半導体",
  "通信・レーダー用の高周波半導体",
  "polymerManufacturing",
  "materialTotalScore",
  "金属ケイ素と塩化メチルを反応させて中間原料を作る",
  "その輪を開きながら長くつないでポリ乳酸にする",
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
  "Cache-Control",
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
  'Label("今日"',
  'Label("PJ"',
  'Label("通知"',
  'Label("登録"',
  'Label("設定"',
  "NotificationInboxView()",
  "RegistrationHubView(path:",
  "BusinessCardsView()",
]);

expectNotIncludes("../ios/AMDOS/Features/Home/MainTabView.swift", [
  'Label("月次ルーティン"',
  'Label("PJ進捗"',
  'Label("名刺"',
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
  "buildExtraRevenueCashByYm",
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
  "対象外配賦",
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
  'select("*")',
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
  "legacy_reward_payout_amount_override_events",
  "applyLegacyPayoutAmountOverridesToCycles",
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
  "事前合意額：通常",
  "payoutAmountOverride",
  "fmtFlowYen(entry.payoutAmountOverride.amountYen)",
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
  "effectiveMemberPayoutYmForCycle",
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
  "CockpitAmdScoreDetailTab",
  "onOpenScoreDetail",
  "score-detail",
]);

expectIncludes("src/components/cockpit/CockpitAmdScoreDetailTab.tsx", [
  "AmdScoreView",
  "embedded",
]);
expectIncludes("src/components/venture-map/AmdScoreView.tsx", [
  "XrlChecklistPanel",
]);
expectPattern("src/components/venture-map/AmdScoreView.tsx", [
  /if \(embedded && primarySnapshot[\s\S]*?<XrlChecklistPanel[\s\S]*?if \(!result/,
  /<FrlAlqPanel[\s\S]*?compact[\s\S]*?<XrlChecklistPanel/,
]);
expectIncludes("src/lib/amd-score-routes.ts", [
  "amdScoreDetailHref",
  "?tab=score-detail",
  '"p99"',
]);
expectIncludes("src/app/(app)/venture-map/amd-score/[projectId]/page.tsx", [
  "redirect(amdScoreDetailHref(projectId))",
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
expectNotIncludes(
  "src/app/(app)/institutions/[institutionId]/cockpit/page.tsx",
  ["nudges={cockpit.nudges"],
);
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
  "overflow-x-auto",
  "min-w-[600px] xl:min-w-0",
]);
expectIncludes("src/components/venture-map/AmdScoreView.tsx", [
  '<div className="min-w-0 text-slate-900">',
  '<section className="min-w-0 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">',
  '<div className="min-w-0 flex flex-col gap-3">',
  'className="min-w-0 border p-4 shadow-',
  '<div className="overflow-x-auto">',
]);

// p00 (= AMD 会社全体) は Management Score Hero に切り替わる
expectIncludes("src/components/cockpit/CockpitView.tsx", [
  "CockpitManagementScoreHero",
  'project.projectId === "p00"',
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
  'params.set("meeting", meetingId)',
  'params.delete("ym")',
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
  'neq("status", "invalid")',
]);

expectIncludes("src/app/auth/login/page.tsx", [
  "calendar.readonly",
  "gmail.readonly",
  'prompt: "consent"',
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
  'status: "candidate"',
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
  'mode: "list"',
  'mode: "detail"',
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
  "対象外配賦",
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

expectIncludes(
  "src/components/monthly-agreement/MonthlyAgreementExperience.tsx",
  [
    "未合意",
    "条件更新あり",
    "対象外",
    "担当内容と予定額の確認・合意がまだ完了していません。",
    "前回合意後に合意内容が更新されたので最新内容を再確認",
    "この内容で合意済み",
    "この月は対象外",
    "合意状態：",
    "確認して合意する内容",
    "担当する仕事",
    "その対価としての予定額",
    "予定額合計",
    "上の「担当する仕事」と「その対価としての予定額」を確認したうえで合意してください。未合意または条件更新ありの場合は、合意が完了するまでこの月の支払いには進めません。",
    "確認して合意",
    "修正要望",
    "内容が違う場合は修正要望",
    "参考情報",
    "PJごとの支払い状況",
    "monthly-agreement-status",
    "monthly-agreement-change-summary",
    "monthly-agreement-change-count",
    "monthly-agreement-change-reason",
    "monthly-agreement-missing-change-reason",
    "予定額を変更した理由",
    "変更理由を確認中",
    "今回の変更点",
    "monthly-agreement-required-checks",
    "monthly-agreement-scope-section",
    "monthly-agreement-reward-section",
    "monthly-agreement-section-number-01",
    "monthly-agreement-section-number-02",
    "monthly-agreement-check-scope",
    "monthly-agreement-check-reward",
    "monthly-agreement-agree-button",
    "monthly-agreement-revision-button",
    "monthly-agreement-revision-panel",
    "monthly-agreement-payment-details",
    "monthly-agreement-reward-basis-details",
    "max-w-[960px]",
    "[&_button]:text-[12px]",
    "h-12 w-full",
    "予定額の根拠",
    "今シーズンのMS",
    "予定額は、ここに出ているMSのpt",
    "今月のpt",
    "支払い済み",
    "これから支払う予定",
    "PayoutSourceBadge",
    "確認中",
    "保存済み",
    "過去の保存額",
    "税込",
  ],
);
expectNotIncludes(
  "src/components/monthly-agreement/MonthlyAgreementExperience.tsx",
  [
    "合意から支払いまでの流れ",
    "あとで支払い画面で別に決めます",
    "この画面でMSを見る",
    "今月の点数",
    "MSの点数",
    "直してほしいこと",
    "到達目標",
    "未確認",
    "確認不要",
    "下の必須2点",
    "合意前に必ず確認すること",
    "確認して合意する2点",
    "1. PJごとの担当内容",
  ],
);
expectPattern(
  "src/components/monthly-agreement/MonthlyAgreementExperience.tsx",
  [
    /onClick=\{handleAgree\}[\s\S]{0,3500}内容が違う場合は修正要望/,
    /data-testid="monthly-agreement-status"[\s\S]{0,2000}<RequiredChecksSection[\s\S]{0,2000}data-testid="monthly-agreement-agree-button"[\s\S]{0,9000}参考情報/,
    /data-testid="monthly-agreement-status"[\s\S]{0,1500}<ChangeSummarySection[\s\S]{0,1500}<RequiredChecksSection/,
    /data-testid="monthly-agreement-required-checks"[\s\S]{0,2000}data-testid="monthly-agreement-scope-section"[\s\S]{0,3000}data-testid="monthly-agreement-reward-section"/,
  ],
);
expectIncludes(
  "src/components/monthly-agreement/MonthlyAgreementExperience.tsx",
  [
    "text-[14px]",
    "text-[18px]",
    "sm:text-[20px]",
    "text-[16px]",
    "text-[26px]",
    "sm:text-[28px]",
    "grid-cols-[minmax(0,1fr)_auto]",
  ],
);
expectIncludes(
  "src/components/monthly-agreement/MonthlyAgreementGateOverlay.tsx",
  [
    "onBackdropClick",
    "event.target !== event.currentTarget",
    "closedGateKey",
    "bundle.currentHash",
    "router.refresh()",
  ],
);
expectIncludes("src/components/nav/AppShell.tsx", [
  "agreementGateBundle",
  "MonthlyAgreementGateOverlay",
]);
expectIncludes(
  "src/components/monthly-agreement/MonthlyAgreementGateOverlay.tsx",
  ["const gateKey = `${pathname}:${bundle.ym}:${bundle.currentHash}`"],
);
expectIncludes("src/app/(app)/admin/monthly-work-agreements/page.tsx", [
  "対象月",
  "admin-monthly-agreement-ym-select",
  "<select",
  "202001",
  "monthly-agreement-migration-note",
  "月初合意の導入前・移行月",
  "admin-monthly-agreement-change-reason",
  "メンバーに伝える変更理由",
  "/api/admin/monthly-work-agreements/amount-change-reasons",
]);
expectIncludes("src/lib/monthly-work-agreement.ts", [
  "monthly_reward_payout",
  "payoutSnapshotForCycle",
  "amountSource",
  "paidActualYen",
  "unverifiedPaidYen",
  "totalPayTaxIncludedYen",
  "futurePayoutYen",
  "amountChangeReasonRequiredProjectIds",
  "missingAmountChangeReasonProjectIds",
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

// 会社概要タブ (2026-07-16 まさ確定): 全PJ常設・全AMDメンバー閲覧編集。旧 CockpitGovernance を統合廃止。
expectIncludes("src/components/cockpit/CockpitView.tsx", [
  "CockpitCompanyOverview",
  '"company" as const, label: "会社概要"',
  'aria-label="会社概要"',
]);
expectFileMissing("src/components/cockpit/CockpitGovernance.tsx");
expectNotIncludes("src/components/cockpit/CockpitView.tsx", [
  "CockpitGovernance",
]);

expectIncludes("src/components/cockpit/CockpitCompanyOverview.tsx", [
  'data-testid="company-overview-tab"',
  "buildCapTableSnapshots",
  "capTableTieOut",
  "convertibleScenario",
  "登記株式数と一致",
  "登記との差",
  "現在の持株比率には入れず",
  "downloadCompanyOverviewXlsx",
  "exportPdf",
]);

expectIncludes("src/lib/company-overview.ts", [
  "export function buildCapTableSnapshots",
  "export function capTableTieOut",
  "export function convertibleScenario",
]);
expectIncludes("src/lib/company-overview-xlsx.ts", [
  "downloadCompanyOverviewXlsx",
]);

expectIncludes("src/app/api/governance/route.ts", [
  "requireMember",
  "company_profile",
  "equity_transaction",
  "convertible",
  "financial_period",
]);
expectNotIncludes("src/app/api/governance/route.ts", ["requireAdmin"]);
expectIncludes("src/lib/supabase/api-auth.ts", [
  "export async function requireMember",
]);

expectIncludes(
  "scripts/migrations/174_project_company_overview_and_equity_ledger.sql",
  [
    "project_company_profiles",
    "project_equity_transactions",
    "project_equity_entries",
    "project_convertible_instruments",
    "project_financial_periods",
    "amd_os_is_member",
  ],
);

// 390px本番実測 (2026-07-16): Section headerがtitleをflex-1で潰し、
// 「資金調達・潜在株式」の2ボタンが同一行を奪ってtitleが1文字縦積みになった不具合の再発防止。
expectIncludes("src/components/cockpit/CockpitCompanyOverview.tsx", [
  'data-section-header="mobile-stack-sm-row"',
  "flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:flex-wrap sm:items-start sm:px-5",
  "flex w-full flex-wrap gap-2 sm:w-auto sm:shrink-0",
]);

// 保存型複数ラウンド資本政策 (2026-07-17): 旧cap-table-history-matrix / next-round-simulator /
// CapitalPolicyWorkspace (CockpitCompanyOverview.tsx埋め込み) は CapitalPlanWorkspace/CapitalPlanMatrix
// への移行済み。CockpitCompanyOverview.tsxからの結線と、旧UIが復活しないことを保証する。
expectIncludes("src/components/cockpit/CockpitCompanyOverview.tsx", [
  'import CapitalPlanWorkspace from "@/components/cockpit/CapitalPlanWorkspace";',
  "<CapitalPlanWorkspace",
]);
expectNotIncludes("src/components/cockpit/CockpitCompanyOverview.tsx", [
  'data-testid="cap-table-history-matrix"',
  'data-testid="next-round-simulator"',
  "function CapitalPolicyWorkspace(",
  "function CapTableHistoryMatrix(",
  "function NextRoundSimulator(",
  "function CapitalDonut",
  "cap table｜${selectedSnapshot",
  "守りたい株主",
]);

// CapitalPlanMatrix (2026-07-17): sticky matrix / 縦棒(構成比グラフ) / FD行 / モバイル44pxタップ領域を保護する。
expectIncludes("src/components/cockpit/CapitalPlanMatrix.tsx", [
  'data-testid="capital-plan-matrix"',
  "flex-col-reverse",
  "sticky left-0",
  "sticky top-0",
  "FD比率（完全希薄化後）",
  "完全希薄化後株式数合計",
  "min-h-[44px] md:min-h-[36px]",
  "expandedHolderIds",
  "aria-expanded={expanded}",
  "全株主を展開",
  "overflow-x-auto",
]);
expectNotIncludes("src/components/cockpit/CapitalPlanMatrix.tsx", [
  "max-h-[70vh]",
  "overflow-auto",
]);

// SX事業計画（2026-07-28）: SIP準拠GRL、百万円PL、助成金の会計/資金繰り分離と、初期閉じの手動シナリオを保護する。
expectIncludes("src/components/cockpit/CockpitBusinessPlan.tsx", [
  "GRL：SIP準拠のガバナンス成熟度（1〜8）",
  "内閣府SIPの定義",
  "単位：百万円",
  "役員報酬",
  "売上原価",
  "助成金収入（特別利益）",
  "圧縮損（特別損失）",
  "助成金入金（資金繰り）",
  'data-testid="sx-annual-parameters"',
  "前提パラメータ",
  "役員の旅費／人",
  "社員の消耗品費／人",
  "自社工場の段階投資",
  "IPOの時期と調達額",
  "初期値に戻す",
  "downloadSxBusinessPlanPhaseMatrixXlsx",
  "Excel出力",
  'data-testid="sx-phase-matrix-xlsx-export"',
]);
expectIncludes("src/lib/sx-business-plan-xlsx.ts", [
  "createSxBusinessPlanPhaseMatrixXlsx",
  "downloadSxBusinessPlanPhaseMatrixXlsx",
  "xSplit=\"1\" ySplit=\"2\"",
  "neutralizeFormulaTrigger",
  "フェーズマトリクス",
]);
expectNotIncludes("src/components/cockpit/CockpitBusinessPlan.tsx", [
  'data-testid="sx-annual-parameters" open',
  "事業計画｜ラウンド間で何を証明するか",
  "SX phase map",
  "培養は自社ノウハウ・自社工場、製品は包装して顧客拠点へ輸送する前提。",
  "暫定原案",
  "annual model",
  "フェーズ予算と売上仮説を年度へ置き直した暫定PL・投資・資金調達。",
  "Seed 1.5億円はSeries Aを2028年10月までに実行する前提。",
  "この画面だけの試算",
  "ownership & funding",
  "上段の100%棒グラフで希薄化推移",
  "初期持分：CEO 75% / 杉浦先生 20% / まさ・AMD 5%",
  "SX_BUSINESS_PLAN_ASSUMPTIONS",
  "SX_BUSINESS_PLAN_UPDATED_ON",
  "development lane",
  ">budget<",
]);

// CapitalPlanWorkspace (2026-07-17): VC提出用の凍結(freeze)エクスポート導線とモバイル44pxを保護する。
expectIncludes("src/components/cockpit/CapitalPlanWorkspace.tsx", [
  "checkPublishEligibility",
  "保存された資本政策表を社内承認とVC提出に使用します。",
  "VC提出用Excel",
  'action: "freeze"',
  "createCapitalPlanXlsx",
  "min-h-[44px]",
]);

expectIncludes("src/lib/capital-plan-xlsx.ts", [
  "export function createCapitalPlanXlsx(version: FrozenCapitalPlanVersion): Uint8Array {",
  'version.status !== "frozen"',
]);

// 資本政策API (2026-07-17): /api/governance/capital-plans は requireMember で保護される。
expectIncludes("src/app/api/governance/capital-plans/route.ts", [
  'import { requireMember } from "@/lib/supabase/api-auth";',
  "await requireMember()",
  "project_capital_plans",
  "project_capital_plan_versions",
]);

// migration 175: LST (p07) の創業〜QST in-kind まで正史を復元 (source: xlsx:LST_captable_250415.xlsx)。
expectIncludes("scripts/migrations/175_lst_cap_table_history.sql", [
  "xlsx:LST_captable_250415.xlsx#incorporation-202307",
  "xlsx:LST_captable_250415.xlsx#seed-202312",
  "xlsx:LST_captable_250415.xlsx#qst-202503",
  "星野毅",
  "in_kind_contribution",
]);

// `/bzm/public/**` は通常の会員BZMとは別の公開原稿。middlewareと(app) shellの
// どちらかだけを外すと再びログイン画面に戻るため、二つの境界を同時に保護する。
expectIncludes("src/lib/supabase/middleware.ts", [
  "const isPublicBzmManuscript",
  "!isPublicBzmManuscript",
]);
expectIncludes("src/app/(app)/layout.tsx", [
  'pathname === "/bzm/public"',
  "return <>{children}</>;",
]);

// 通知 action contract (2026-07-24): 開催履歴候補は、採用前には正本を増やさず、
// 追加先・追加内容・外部操作を伴わない結果を明示してから同一feedback APIで反映する。
expectIncludes("src/app/api/governance/extract/route.ts", [
  "開催履歴を追加する？",
  "action_contract",
  "会社概要 → 総会・取締役会",
  "saved_count: kind === \"coverage_gap\" ? 0 : 1",
]);
expectIncludes("src/app/api/notifications/feedback/route.ts", [
  "routeGovernanceMeetingCoverageGap",
  "project_shareholder_meetings",
  "sanitizeGovernanceAttachments",
  "会社概要の総会・取締役会に開催履歴を1件追加した",
]);
expectIncludes("src/components/notifications/NotificationsClient.tsx", [
  "採用すると追加される内容",
  "追加・更新する情報",
  "この開催履歴を追加する",
  "isSuppressedGovernanceCandidate",
  "契約台帳に更新する内容",
  "契約を特定できないため、契約台帳は更新しない",
  "isSuppressedContractAction",
]);
expectIncludes("src/app/api/action-items/extract/route.ts", [
  "notification_suppressed_reason",
  "missing_contract_identity",
  "review_status: isContractAction && !contractMeta ? \"needs_source\" : \"candidate\"",
]);
expectIncludes("src/app/api/governance/extract/route.ts", [
  "gateGovernanceHistoryCandidate",
  "findCanonicalId(db, row)",
]);
expectIncludes("src/app/api/cron/governance-email-sweep/route.ts", [
  "gateGovernanceHistoryCandidate",
  "governanceCandidateSkipLabel",
]);
expectIncludes("src/lib/governance-candidate-gate.ts", [
  "workflow notification is not meeting evidence",
  "held-meeting evidence missing",
]);
expectIncludes("../ios/AMDOS/Features/Settings/SettingsView.swift", [
  "追加先",
  "追加・更新する情報",
]);
expectIncludes("../ios/AMDOS/Core/Services/SupabaseService.swift", [
  "submitNotificationResponseThroughPwa",
  "https://amd-os-pwa.vercel.app/api/notifications/feedback",
  "この開催履歴を追加する",
  "isSuppressedGovernanceCandidate",
  "契約を特定できないため、契約台帳は更新しない",
  "isSuppressedContractAction",
]);

console.log("critical PWA UI anchors ok");

// Round 22 (2026-07-27): PoC候補先ボード。関係先台帳とは役割が違うので別面で持つ。
expectIncludes("src/components/project-workspace/SxPocCandidateBoard.tsx", [
  "sx-poc-board",
  "deriveSxPocBoard",
  "排液 調達済",
  "未接触の候補",
  "母集団の総数と必要社数は台帳未登録",
]);
expectIncludes("src/lib/sx-poc-candidates.ts", [
  "sxIsPocCandidate",
  "sxIsUntouchedPocCandidate",
  "deriveSxPocBoard",
  "SX_POC_ROLE_PREFIX",
  "roleLabel.startsWith",
]);
expectIncludes("src/components/project-workspace/ProjectWorkspaceDashboard.tsx", [
  "management-poc",
  "PoC候補先リスト",
  "SxPocCandidateBoard",
]);
