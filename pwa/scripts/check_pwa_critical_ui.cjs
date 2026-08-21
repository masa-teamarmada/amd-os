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

function expectSegmentNotIncludes(rel, start, end, needles) {
  const text = read(rel);
  const startIndex = text.indexOf(start);
  const endIndex =
    startIndex < 0 ? -1 : text.indexOf(end, startIndex + start.length);
  if (startIndex < 0 || endIndex < 0) {
    throw new Error(`${rel} missing segment anchors: ${start} -> ${end}`);
  }
  const segment = text.slice(startIndex, endIndex);
  const present = needles.filter((needle) => segment.includes(needle));
  if (present.length > 0) {
    throw new Error(
      `${rel} segment contains retired critical UI anchors: ${present.join(", ")}`,
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
    throw new Error(
      `${rel} needs ${minimum} occurrences of ${needle}, found ${count}`,
    );
  }
}

expectIncludes("src/app/(app)/dashboard/page.tsx", [
  "ExtractionStatusCard",
  "FreeeConnectionStatusCard",
  'project.projectId !== "p00"',
  "projectLoadFailed",
  "PJ台帳を読み込めなかった",
]);
expectNotIncludes("src/app/(app)/dashboard/page.tsx", [
  "InstitutionReadinessList",
  "fetchErsBundle",
  "institutionProjectIds",
]);

expectIncludes("src/app/(app)/project/[projectId]/weekly-control/page.tsx", [
  "redirect",
  "/workspace",
]);

expectIncludes(
  "src/components/project-workspace/SxWeeklyControlDashboard.tsx",
  [
    "週次差分・判断・介入",
    "先週 → 今週",
    "全体ガント",
    "論点・仮説リスト",
    "データ接続状況",
    "deriveSxUnifiedTimeline",
    "SxUnifiedTimeline",
    "showPins={false}",
      "sxWeeklyIssueNextDueDate",
    "create_hypothesis",
    "create_validation",
    "create_decision",
    "edit_decision",
    "create_action",
    "edit_action",
    "sxWeeklyIssueNextMove",
      // Round 32 (2026-08-02): 冒頭をPJ全体の管制入口へ再構成。工程・タスク・論点・仮説・検証・
    // 判断・action・関係先保有事項を同じ未完了作業単位（sxProjectOwnerLoadsの共通母集団）にした
    // 6バケット（停止/期限超過/7日以内/担当不明/期限なし/判断待ち）。クリックで元項目一覧へ絞り込み、
    // 項目クリックで必ず元の編集文脈（ガント該当行・詳細／論点カード・詳細／関係先該当行）へ移動する。
    "WORKLOAD_BUCKETS",
    "workloadBuckets",
    "workloadFilter",
    "navigateToWorkUnit",
    "styles.workloadBand",
    "styles.workloadDrawer",
      "sxProjectWorkUnitIsOverdue",
    "sxProjectWorkUnitIsDueSoon",
    // 2026-08 provenance audit: 関係先由来の共通母集団クリックはスクロールせず、provenance
    // （originResource）別に単一の編集モーダルを直接開く。work itemはedit_partner_work_item、
    // commitmentは専用edit_commitment（resource=commitment）、構造化保有が無いpartner_fallback
    // は関係先編集の全項目ではなく次にやること・当方担当・期限・期限精度・保有側・現在の担当
    // だけのtargeted editor（fieldKeys）を開く。開く前にplan/detail editorを閉じ、モーダルは
    // 常に1つだけにする。
    "SolvioraX PJワークスペース",
    "PARTNER_NEXT_ACTION_FIELD_KEYS",
    "edit_commitment",
    'resource: "commitment"',
    "editorFieldKeys",
    "unit.originResource",
    "unit.recordId",
    'unit.originResource === "partner_work_item"',
    'unit.originResource === "commitment"',
    'unit.originResource === "partner_next_action"',
    // 監査追補 (2026-08-02、最終モーダル監査): partner/record/originを先に検証し、有効な
    // 移動先が確定したときだけ既存のdrawer/plan/editorを閉じる。無効な場合は他UIへ触れず
    // notifyWorkUnitNotFound()（noticeのみ）で終える。
    "function notifyWorkUnitNotFound() {",
    "元の項目を見つけられなかったよ",
    "let nextEditor: EditorState | null = null;",
    "if (unit.recordId !== partner.id) {",
    "setEditorFieldKeys(nextFieldKeys);\n      setEditor(nextEditor);",
    // 同名項目でも対象を確認できるよう、edit_partner_work_item/edit_commitmentのroot editor
    // モーダルへmanagement.partnersから解決した対象関係先名を静的表示する。
    '{"workItem" in editor && (',
    '{"commitment" in editor && (',
    "partner.id === editor.workItem.partnerId",
    "partner.id === editor.partnerId",
    // root editorモーダル（embedded/inlineFieldでない）だけ、PlanInspectorと同じ流儀で
    // useModalContainmentを適用する（focus封じ込め・背面inert化・Tabトラップ・dirty確認込み
    // のEscape close）。embedded/inlineFieldは二重containmentしない。
    "const closeButtonRef = useRef<HTMLButtonElement>(null);",
    "active: !embedded && !inlineField,",
    // 監査追補 (2026-08-02、再監査): useModalContainmentはdialog.parentElementをdocument.body
    // 直下のportal layerと仮定する。root editorをinlineのdivのまま描くとdashboard内mainが
    // dialog.parentElementになり、bodyの直接の子(AppShellのルート)がまるごとinert化されて
    // モーダル自身も操作不能になるため、PlanInspectorと同じ二層構造でdocument.body直下へ
    // createPortalする（外層role="presentation"のlayer、内層role="dialog"のsection）。
    "dialogRef: editorPanelRef,",
    'role="presentation"',
    'data-modal-layer="sx-issue-editor"',
    "return createPortal(",
    // Round 34 (2026-08-02): validation work unitがedit_validationを持たず親issue編集へ
    // 黙ってフォールバックしていた穴を塞ぐ。SxValidationRunを直接resource=validationで
    // PATCHするedit_validation editorを追加し、押した検証レコードそのものを開く。
    "edit_validation",
    'resource: "validation"',
    "const validation = issue.validationRuns.find(",
    "issue.hypotheses.find((item) => item.id === validation.hypothesisId)",
    'nextEditor = { kind: "edit_validation", issue, hypothesis, validation };',
    // 論点系（hypothesis/validation/decision/action）のID不一致は、partnerのprovenance監査
    // と同じくnotifyWorkUnitNotFound()のnoticeで終え、親issue編集へ黙ってフォールバック
    // しない。issue自体が見つからない場合も同様にnoticeで終える。
    "if (!issue) {\n        notifyWorkUnitNotFound();\n        return;\n      }",
    'if (!validation || !hypothesis) {\n          notifyWorkUnitNotFound();\n          return;\n        }',
    'if (!decision) {\n          notifyWorkUnitNotFound();\n          return;\n        }',
    'if (!decision || !action) {\n          notifyWorkUnitNotFound();\n          return;\n        }',
    // 論点系root editorはページ全体を覆うbackdropモーダルであり、背景スクロールは不要かつ
    // 担当負荷から開いたときにscrollYが動くバグの原因だった。#issue-hypothesisへの
    // scrollIntoViewを廃止した。
    "let nextEditor: EditorState;",
    // 監査追補 (2026-08-02、状態保全監査): 工程/タスク/論点系は対象レコードのID/存在を
    // すべて検証しnextEditor/対象IDを組み立ててからだけ、既存のworkloadFilter/detailEditor/
    // planFieldEditor/editorFieldKeys/selectedMilestoneId/selectedTaskIdを一括解除する
    // （partner分岐と同じ「解決してから閉じる」パターン）。無効IDのクリックはnotifyだけで
    // 既存UIを閉じない。
    "const task = management.tasks.find((item) => item.id === unit.navTaskId);",
    "const milestone = management.milestones.find(\n        (item) => item.id === unit.navMilestoneId,\n      );",
    // issue kindもnavIssueId一致だけで別issueへ取り違えないよう、unit.id===issue.idを必須にする。
    // 有効な子レコードを確認した後は単体editorではなく、親論点のworkbenchへ着地する。
    '} else if (unit.kind === "issue") {\n        if (unit.id !== issue.id) {',
    "void nextEditor;\n      setEditor(null);\n      setSelectedIssueId(issue.id);\n      selectView(\"issues\");",
    // root editorモーダルへ、開いているeditorのkind/resource/record-idを静的に出し、実
    // ブラウザ監査で「押した項目」と「開いたeditor」の対象一致を検査できるようにする。
    "data-editor-kind={editor.kind}",
    "data-editor-resource={definition.resource}",
    'data-editor-record-id={definition.id || ""}',
  ],
);
expectNotIncludes(
  "src/components/project-workspace/SxWeeklyControlDashboard.tsx",
  [
    "styles.statusBand",
    "今週入力",
    "週次管制 <span>",
    'data-sx-anchor="sx-partner-${unit.navPartnerId}"',
    // Round 34 (2026-08-02): 論点系root editorはモーダルであり、背景ページをスクロールする
    // 理由がない。担当負荷から開いたときにscrollYが動くバグの原因だったscrollIntoViewを
    // 再導入しない。
    '.getElementById("issue-hypothesis")',
    // 論点系のID不一致を親issue編集へ黙ってフォールバックする旧実装（partnerと違う扱い）を
    // 再導入しない。
    "hypothesis\n              ? { kind: \"edit_hypothesis\", issue, hypothesis }\n              : { kind: \"edit_issue\", issue },",
    // 監査追補 (2026-08-02、状態保全監査): 無効IDのクリックで既存のworkload/detail/plan
    // editorを巻き添えで閉じていた旧実装（対象を検証する前にoverlay stateを一括clearしていた）
    // を再導入しない。clearは必ずnextEditor/対象IDの確定後だけに限定する。
    "setWorkloadFilter(null);\n    setDetailEditor(null);\n    setPlanFieldEditor(null);\n    setEditorFieldKeys(null);\n    if (unit.navTaskId) {",
    "setSelectedMilestoneId(null);\n      setSelectedTaskId(null);\n      if (unit.kind === \"hypothesis\") {",
  ],
);
expectIncludes("src/lib/sx-project-owner-load.ts", [
  "navMilestoneId",
  "navTaskId",
  "navIssueId",
  "navPartnerId",
  "sxProjectWorkUnitIsOverdue",
  "sxProjectWorkUnitIsDueSoon",
  // 2026-08 provenance audit: every partner-kind unit carries its own originResource/recordId/
  // partnerId triad — never inferred by trying id lookups across partner.workItems and
  // partner.commitments in sequence.
  "originResource",
  "recordId",
  '"partner_work_item"',
  '"commitment"',
  '"partner_next_action"',
  // 監査追補 (2026-08-02、再監査): desktop 2カラムの左右分割(偶数index=左、奇数index=右の
  // row-major)は前半/後半split(splitAt)の代わりにここへ切り出し、node --experimental-strip-types
  // でunit test可能にする(.tsxコンポーネント側はJSXを含みnode単体では実行できないため)。
  "export function partitionOwnerLoadColumns(loads: SxProjectOwnerLoad[]) {",
  "(index % 2 === 0 ? left : right).push(load);",
]);
expectIncludes("src/lib/sx-partner-holdings.ts", ["originResource"]);
expectIncludes("src/components/project-workspace/SxProjectOwnerWorkload.tsx", [
  "onSelectItem",
  "disabled={!onSelectItem}",
  "onClick={() => onSelectItem?.(item)}",
  "lg:grid-cols-2",
  // 監査追補 (2026-08-02): 外側lg:grid-cols-2と組み合わさるlg/xl未満の幅では、展開行の固定4列
  // (合計554px)が1カードに収まらず横あふれする。xl未満は2行1列、xl以上だけ元の4列1行へ戻す。
  "xl:grid-cols-[110px_minmax(160px,1fr)_120px_minmax(140px,0.8fr)]",
  "xl:contents",
  // Round 34 (2026-08-02): 外側lg:grid-cols-2だけでは、暗黙行で左右のdetailsがペアリングされ
  // (item0=row1col1, item1=row1col2, ...)、片側の展開でその共有行が伸び、反対列の後続カード
  // までY座標が動いていた(items-startは行の共有そのものを解消しない)。左右をOwnerLoadColumn
  // という完全に独立したflex-col要素へ分離し、各列が自列の高さだけで自己完結するようにする。
  "function OwnerLoadColumn({",
  // 監査追補 (2026-08-02、再監査): 前半/後半split(splitAt)は従来のCSS grid(暗黙行ペアリング=
  // item0/item1が同じ行の左右)が作っていた見た目のペア順を崩すため廃止。偶数index=左列、
  // 奇数index=右列のrow-major分割へ修正し、専用partitionOwnerLoadColumns()helperへ切り出した。
  // mobileはこの分割結果を連結せず、常に元loadsを単独DOMで描画する(連結だと[0,2,4,1,3,5]に
  // なってしまう)。desktop用グリッドは`hidden lg:grid`、mobile用単列は`lg:hidden`で常に片方
  // だけをa11y treeへ出し、重複ノードを作らない。
  'import { partitionOwnerLoadColumns } from "@/lib/sx-project-owner-load";',
  "const { left: leftLoads, right: rightLoads } =\n    partitionOwnerLoadColumns(loads);",
  // Round 39 (2026-08-02): 外側gridの`gap-px bg-[#d9cfde]`(align-items:stretchで各列を伸ばし、
  // 伸びた分がOwnerLoadColumnの紫背景として実ブラウザで巨大な空白に見えていた)を廃止。
  // `lg:items-start`で列を内容高さに止め、大面積背景は生成り(#fffdf7)へ、左右境界の1px線は
  // 独立したabsolute dividerへ切り出す。
  '<div className="relative hidden lg:grid lg:grid-cols-2 lg:items-start">',
  '<div\n          aria-hidden="true"\n          className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-[#d9cfde]"\n        />',
  "<OwnerLoadColumn loads={leftLoads} onSelectItem={onSelectItem} />",
  "<OwnerLoadColumn loads={rightLoads} onSelectItem={onSelectItem} />",
  '<div className="lg:hidden">\n        <OwnerLoadColumn loads={loads} onSelectItem={onSelectItem} />',
  'className="flex flex-col gap-px bg-[#d9cfde]"',
  'className="border border-[#9d8daa] bg-[#fffdf7]"',
  // 実動作は元の編集文脈を開くことなので、aria-labelは「移動」ではなく「編集」で実態を表す。
  "aria-label={`${item.title}を編集`}",
  // 実ブラウザ監査でクリック対象と後続の編集モーダル対象の一致を検査できるようにする。
  "data-work-unit-kind={item.kind}",
  "data-work-unit-id={item.id}",
]);
expectNotIncludes(
  "src/components/project-workspace/SxProjectOwnerWorkload.tsx",
  [
    // 旧・展開行のグリッドはxl条件なしで常時4列を強制しており、lg 2カラムと組み合わせると
    // 1024px前後で横あふれしていた。
    "grid-cols-[110px_minmax(160px,1fr)_120px_minmax(140px,0.8fr)] items-start",
    // 旧文言。実動作(編集モーダルを開く)と不一致だった。
    "の元項目へ移動",
    // Round 39 (2026-08-02): 旧・外側gridの大面積紫背景(gap-px+bg-[#d9cfde]によるalign-items:
    // stretch下の紫空白バグ)を禁止。境界線はabsolute dividerへ切り出し、大面積背景は生成りへ。
    '"hidden gap-px bg-[#d9cfde] lg:grid lg:grid-cols-2"',
    'bg-[#f7f3f7]',
  ],
);

expectNotIncludes(
  "src/components/project-workspace/SxWeeklyControlDashboard.tsx",
  [
    "論点と仮説を、忘れられない流れに乗せる",
    "4本柱は、例外だけを見る",
    "情報を入れる前の接続口",
  ],
);
expectSegmentNotIncludes(
  "src/components/project-workspace/SxWeeklyControlDashboard.tsx",
  "if (embedded) {\n    return (",
  "\n  return createPortal(\n    <div\n      className={styles.editorBackdrop}",
  [
    "styles.editorPanel",
    "styles.editorHeader",
    "styles.editorContext",
    "<header",
    "<h2",
    'role="dialog"',
    "createPortal",
  ],
);

expectIncludes("src/lib/sx-weekly-control.ts", [
  "sxWeeklyIssueStage",
  "sxWeeklyIssueNextDueDate",
  "sxWeeklyIssueLastActivity",
  "sxWeeklyIssueNeedsAttention",
  "sxWeeklyIssueNextMove",
]);

expectIncludes("src/lib/project-workspace.ts", [
  "(?:workspace(?:\\/files)?|weekly-control|navigation)",
]);

expectIncludes(
  "src/app/(shared-workspace)/project/[projectId]/workspace/page.tsx",
  [
    "resolveSharedWorkspaceAccess",
    "SxWeeklyControlDashboard",
    "getProjectWorkspaceBundle",
    'access.principal === "workspace_account"',
    "notFound()",
    "SharedWorkspaceScopeRibbon",
    "externalWorkspaceRoleCapabilityLabel",
    "/workspace/files",
  ],
);

expectIncludes("src/app/(app)/project/[projectId]/weekly-control/page.tsx", [
  "redirect",
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

expectIncludes("src/components/nav/PageTitleSetter.tsx", ["surfaceTitleForPath"]);

expectIncludes("src/app/(app)/layout.tsx", ["surfaceTitleForPath"]);

expectIncludes("src/lib/surface-catalog.ts", [
  "PJ管制ダッシュボード",
  'patterns: [/^\\/project\\/[^/]+\\/navigation\\/?$/]',
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

expectNotIncludes(
  "src/components/project-navigation/SxNavigationDashboard.tsx",
  ["依存航路", "@/lib/project-workspace", "@/lib/sx-management"],
);

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
  "社内版を確認・編集",
  "提出版を確認・編集",
]);

expectIncludes(
  "src/app/(app)/project/[projectId]/report/[ym]/print/print-client.tsx",
  [
    "InlineMarkdownReview",
    "report-editable-block",
    "社内版の確定版に反映した",
    "PDFとして保存",
  ],
);

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
  "memberHome(memberAccess)",
  "resolveWorkspaceAccess",
  "getPublicInstitutionWorkspaces",
  "ARMADA OSへ入る",
  "利用中のワークスペースへ",
]);
expectNotIncludes("src/app/page.tsx", [
  'from "next/navigation"',
  'redirect(memberHome(memberAccess))',
  'redirect("/workspaces")',
]);
expectIncludes("src/lib/supabase-data.ts", [
  'typeof window === "undefined"',
  ": createBrowserSupabase();",
  "fetchProjectsFromSupabase(readClient",
]);
expectIncludes("src/app/api/hud/dashboard/route.ts", [
  "fetchProjectsFromSupabase(admin)",
  "fetchBillingStatusFromSupabase(ym, admin)",
  '.from("members")',
  '.eq("email", email)',
  "Boolean(member)",
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
  "amd_os_project_session",
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
  "${hrefPrefix}/${project.projectId}/cockpit",
]);
expectNotIncludes("src/components/dashboard/DashboardGrid.tsx", [
  'project.projectId === "p21"',
  "isSharedWorkspace",
  "共有ダッシュボード",
]);
expectFileMissing(
  "src/components/project-workspace/ProjectWorkspaceDashboard.tsx",
);
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
expectNotIncludes(
  "src/components/project-workspace/SxDevelopmentThemeBoard.tsx",
  [
    "name: milestone?.title ?? fallbackName",
    "position: parent ? `${parent.title}の成立条件`",
    "successors.map((item) => item.title)",
    'nextExperiment: nonEmpty(issue?.nextValidation, "次実験 未登録")',
  ],
);
expectIncludes("src/components/project-workspace/SxPartnerPipeline.tsx", [
  // 2026-08-07: 「詰まり・PJ影響」列をまさ指示で削除。列が消えたことで slug 引きの
  // milestoneTitleBySlug も不要になったため、両方のアンカーをここから外した。
  "milestoneTitleById = new Map(",
  "milestone.id,\n      nominalizeSxActionLabel(milestone.title)",
  "次にやること",
  "現在地の根拠",
]);
expectNotIncludes("src/components/project-workspace/SxPartnerPipeline.tsx", [
  "[milestone.slug, milestone.title]",
  "[milestone.id, milestone.title]",
]);
expectIncludes(
  "src/app/api/project-workspace/[projectId]/management/route.ts",
  [
    "export async function POST",
    "manual_create",
    "追加行は非表示化したよ",
    "commitment_kind",
    "assertParentsInProject",
    'const optionalDate = (key: string) => raw[key] == null || raw[key] === "" ? null',
    'if (resource === "issue")',
    'if (resource === "hypothesis")',
    'if (resource === "decision")',
    'if (resource === "action")',
    "includeDeleted",
    "listDeletedRecords",
    "decision_text",
    "sx_owner",
    "rollbackPatch",
  ],
);
expectIncludes(
  "src/app/api/project-workspace/[projectId]/management/route.ts",
  [
    "function safeDeletePatch(memberId: string) {",
    "return { deleted_at: new Date().toISOString(), deleted_by: memberId };",
    "Soft-delete and restore are visibility toggles, not edits",
    "if (meta.hasSourceRef && !deleting && !restoring) {",
    'patch.source_kind = "manual";',
    'patch.source_ref = "PWA共有管理画面";',
  ],
);
expectNotIncludes(
  "src/app/api/project-workspace/[projectId]/management/route.ts",
  [
    "safeDeletePatch(context.access.memberId, meta)",
    "source_kind/source_ref are provenance, not editable state",
  ],
);
expectIncludes("scripts/migrations/185_sx_management_semantic_guards.sql", [
  "project_management_decisions_decided_requirements_185",
  "project_management_partner_commitments_sx_followup_requirements",
  "decision_state <> 'decided'",
  "commitment_kind <> 'sx_followup'",
]);
expectIncludes("scripts/audit_sx_management_visible_terms.mjs", [
  "SCRIPT",
  "rawPattern",
  "scrollWidth",
  "SX_VISIBLE_AUDIT_COOKIE_VALUE",
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
  "buildPartnerProgressSteps",
  "sx-partner-stage-rail-",
  "sx-partner-progress-",
  // 2026-08-08 まさ指示: 多色ピルの節railは廃止し、営業段階ベースの%プログレスバーへ。
  "data-progress-bar",
  "data-progress-pct",
  "sxIsPocPartner",
  // 2026-08-08 まさ指示: タブ「表示」を「分類」に改名し、分類5種 (PoC候補先/技術協力先/
  // 試料提供元/試料提供ルート/VC) を classifications (複数可) で絞る。担当・区分・段階・
  // 管制の各絞り込み帯と説明文は削除した。
  "sx-partner-filter-${classification}",
  "SX_PARTNER_CLASSIFICATION_ORDER",
  "partnerHasClassification",
  "PoC候補先",
  "sxIsVcPartner",
  'heading="分類"',
  'heading="役割"',
  "filterablePartners",
  "sxGroupPartnersByPrimaryClassification(filterablePartners)",
  "comparisonPartners",
  "sxNormalizePublicName",
  "deferredLowPriority",
  "保留・低優先（重要経路外・",
  "当方保有",
  "先方保有",
  "関係先の絞り込み",
  "共同",
  "行為主体未確認",
  "sxFormatDueDateWithPrecision",
  "sxSortInteractionsByRecency",
  "sxHoldingsForPartner",
  "sxComputeControlBandCounts",
  "sxPrimaryRoleKindCounts",
  "sxGroupPartnersByPrimaryClassification",
  "sxIsHoldingOverdue",
  "sxIsHoldingMonthPrecision",
  "やり取り履歴（全",
  "工程未接続",
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
  // Round 32: one-row comparison keeps the dynamic progress rail/flow and intervention columns.
  "sxPartnerPrimaryIntervention",
  "進行状況",
  "詰まり・PJ影響",
  "次にやること",
  "担当・期限",
  "現在地の根拠",
  "履歴・保有",
  'heading="緊急"',
  'heading="ボール"',
  'heading="母数"',
  "SCROLL_HINT_CLASS",
  "ALWAYS_SCROLL_HINT_CLASS",
  // v3.66.0: AMD標準カラートーン刷新でborder-[#c5bba5]→#d2d2d7, border-l-[#38745d]→#059669 に置換
  "border-l-4 border-[#d2d2d7] border-l-[#059669]",
  // spec P0-10: 登録率(対応中N先中)。
  "登録率",
  "停止",
  "空レーンあり",
  "deferredPartners.length === 0 &&\n              endedPartners.length === 0",
  "sourceEvidence",
  "一次根拠",
  "出典",
  "最終確認",
  "確度",
  "ScrollHintArrow",
  "目標状態",
]);
expectNotIncludes("src/components/project-workspace/SxPartnerPipeline.tsx", [
  "text-[9px]",
  "opacity-80",
  "text-[#5f5a4d]",
  "組成率",
  "未整理（当方側の確認未実施）",
  "未整理（先方側の確認未実施）",
  'pt-3" open>',
  "inline-flex h-6 w-6 items-center justify-center rounded-md border border-[#a69b84] text-[#514e47] hover:bg-[#f2eee0]",
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
expectIncludes(
  "src/app/api/project-workspace/[projectId]/management/route.ts",
  [
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
  ],
);
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
  'knowledgeType === "decision_needed"',
]);
expectNotIncludes(
  "src/components/project-workspace/SxExecutiveControlDeck.tsx",
  [
    "相手先要フォロー",
    "直近アクション",
    "sx-four-pillar-signal-strip",
    "sx-critical-path-rail",
  ],
);
// 2026-08-13 新設: ガントのレーン折り畳みの正本。柱はPJごとにDB (project_management_tracks)
// で定義するが、p21だけは従来の3レーン折り畳みを1文字も変えずに再現しなければならない。
expectIncludes("src/lib/sx-display-lanes.ts", [
  "buildSxLaneFold",
  "business_development",
  "technology_development",
  "organizational_building",
  "funding",
  "事業開発",
  "技術開発",
  "組織開発",
]);

expectIncludes("src/components/project-workspace/SxUnifiedTimeline.tsx", [
  "sx-unified-timeline",
  "今日",
  "設立 {sxFormatDate(timeline.objectiveDate)}",
  "MSとタスクの縦一覧",
  "RowBar",
  // 2026-08-07: 時間軸の縮尺スライダー導入で固定幅クラスをやめ、基準幅×倍率の
  // インライン minWidth になった。潰れ防止の下限そのものは GANTT_BASE_WIDTH_PX が担う。
  "GANTT_BASE_WIDTH_PX = 1080",
  "minWidth: GANTT_BASE_WIDTH_PX * timeScale",
  // 行クリックは詳細、値クリックは直接編集。ブロッキングMSは有償PoC口頭合意と
  // 出資口頭合意の2件だけに限定する。
  "onCreateMilestone",
  "onCreateTask",
  "selectedTaskId",
  "expandedTasks",
  "すべて展開",
  "canManage",
  "sxIsBlockingMilestone",
  "sxGateRequirementState",
  "マイルストーン",
  "前提",
  // 2026-08-13: 柱(track)をPJ属性へ一般化した (migration 273)。レーン折り畳みの
  // 定数・関数はこのファイルから src/lib/sx-display-lanes.ts へ移し、そちらを唯一の正本にした。
  // p21の契約 (事業開発／技術開発／組織開発の3レーン、資金調達は組織開発へ統合、
  // 設立条件2MSの強制配置) は sx-display-lanes.ts 側のアンカーで担保する。
  "buildSxLaneFold",
  "laneFold",
  "milestoneAnchorRow",
  "data-gantt-lane-milestone-spine={milestone.id}",
  "title: milestone.title,",
  "row.achievement",
  "GATE_STATE_TEXT",
  "!timeline.valid &&",
  // undated milestone-marker rows (both the 2 NewCo blocking gates AND generic timeline_kind=
  // milestone rows) still get a diamond marker — placed next to the existing 日程未設定 text (a
  // non-temporal label position), never a fabricated date/X position (filled purple for the
  // NewCo gates, hollow for generic MS — 2026-08 再監査是正). Same rule applies to the mobile
  // card list: the diamond renders before the title so an undated milestone marker row is still
  // recognizable as a milestone (監査追補 2026-08-02).
  "isMilestoneMarker && (",
  "日程未設定・{ROW_STATE_TEXT[row.state]}",
  // desktop expand/collapse toggle must be a full 44px hit target, not a 32px (w-8) one
  // (監査追補 2026-08-02).
  // v3.66.0: AMD標準カラートーン刷新でtext-[#5a574c]→#3c3c43 に置換
  "flex w-11 shrink-0 items-center justify-center text-[#3c3c43]",
  "const TASK_BAR_HEIGHT_PX = 10;",
  "const TASK_BAR_TOP_PX = (ROW_H - TASK_BAR_HEIGHT_PX) / 2;",
  "top: TASK_BAR_TOP_PX,",
  // Round 24/29: 計画の薄いバーと登録済み実績の濃い塗りを分け、未登録は0%と表示しない。
  "row.progressRegistered && row.progressPct > 0",
  "最上位タスクに戻す",
  "日程未登録",
  "aria-pressed",
  "focus-visible:outline",
  // ピンはクリックで飛ばさずhover/focusで中身を出す。
  "onMouseEnter",
  // Round 35: dependency editing is an explicit mode and the month/task header remains visible
  // while the dense gantt scrolls vertically or horizontally inside its own frame.
  "scheduleDependencies?: SxScheduleDependency[];",
  'resource: "schedule_dependency"',
  "data-gantt-schedule-dependency-lines",
  "data-gantt-sticky-header",
  "日程未登録のMS",
  'className="sticky top-0 z-50 grid',
  'className="sticky left-0 z-[51]',
  "max-h-[min(72vh,720px)] overflow-auto overscroll-contain",
  'aria-label="ガントチャート。上下左右にスクロールできる"',
]);
expectNotIncludes("src/components/project-workspace/SxUnifiedTimeline.tsx", [
  "criticalPolyline",
  "strokeDasharray",
  "top-[19px] h-[18px] w-[2px] bg-[#514e47]",
  "予定→見込みの差",
  "完了見込み日",
  "次へ進むための必須ゲート",
  "必須条件",
  // Round 32: ガント外のカード帯・独立sectionは廃止済み。通常レーンと同じ左右2列へ統合する。
  "BLOCKING MILESTONES",
  "milestoneAgenda",
  "foundingPrerequisiteLane",
  "sx-founding-prereq-title",
  // Round 33: 設立前提の2件は4本目の合成レーンを持たない。事業開発／技術開発／組織開発の
  // 3レーンだけを描く（資金調達は独立レーンを持たず組織開発へ統合）。
  "FOUNDING_LANE_META",
  "FOUNDING_LANE_KEY",
  "founding-prerequisites",
  "requiredTaskSummary",
  "sxMilestoneRequiredTaskSummary",
  "必須タスク",
  "h-2 w-2 shrink-0 rotate-45",
]);
expectIncludes("src/lib/sx-executive-control-deck.ts", [
  // Provisional dates / missing dates must never resolve to a false-green current/future state.
  'dateCertainty === "provisional"',
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
  "実際の遅れなし",
  "仮置きの見込みは予定より最大",
  '"未確認", known: false',
]);
expectIncludes("src/components/project-workspace/SxPartnerPipeline.tsx", [
  "data-sx-anchor={`sx-partner-${partner.id}`}",
]);
expectIncludes("src/app/globals.css", [
  "@media (prefers-reduced-motion: reduce)",
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

// つくよみ外部リサーチの日常運用は、ローカルの実行SKILLではなくAMD OSマニュアルを
// 人向け正本にする。検索窓・対象・重複・採否・保存先・異常時の入口を同じ章から消さない。
expectIncludes("manual/3-3-notifications-and-tsukuyomi.md", [
  "この節が、つくよみ外部リサーチの日常運用の正本",
  "平日09:00 JST",
  "過去72時間",
  "過去24時間",
  "BWEは終了PJ",
  "過去の未判断・採用・見送り・保管済みの全履歴",
  "経営ハイライト → 採用リサーチ",
  "いつもと違うとき",
]);
expectIncludes("src/app/(app)/manual/manual-chapters.ts", [
  "通知・つくよみ外部リサーチ・正本反映ゲート",
  "重複防止、採用・見送り",
  '"/project/{projectId}/cockpit"',
  '"project_strategy_signals"',
]);

expectIncludes("src/components/admin/AdminSidebar.tsx", [
  "ADMIN_SURFACE_GROUPS",
  "getSurfaceById",
  "BUILD_VERSION",
  'href="/dashboard"',
  "Adminメニューを開く",
  "md:sticky",
]);
expectIncludes("src/lib/surface-catalog.ts", [
  "請求書発行",
  "/admin/invoices",
  "裏wiki",
  "/admin/private-wiki",
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
  "board-nav-project-submenu",
  "board-nav-project-cockpit",
  "board-nav-project-workspace",
  "/project/${encodeURIComponent(activeProject.projectId)}/cockpit",
  "/project/${encodeURIComponent(activeProject.projectId)}/workspace",
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

expectIncludes("src/lib/surface-catalog.ts", [
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
  "Bzm22ProvisionalObservatory",
  "CurrentSpsAssessmentCard",
  "/sps-current",
  "現行SPSを読み込み中",
  "BZM 2.2 暫定パイロット（SPSとは別モデル）",
  "J / P / Q / S はSPSへ合算せず",
  'data-density="compact-score-page"',
]);
expectPattern("src/components/cockpit/CockpitAmdScoreDetailTab.tsx", [
  /<CurrentSpsAssessmentCard\b[^>]*assessment=\{state\.assessment\}[\s\S]*?<Bzm22ProvisionalObservatory/,
  /fetch\(`\/api\/project\/\$\{encodeURIComponent\(projectId\)\}\/sps-current`/,
  // 判断根拠 (q帯・q要因11項目・P^ind帯・総合判断) をこの画面から読めること。
  // 根拠はseed_screening_bandsの詳細行にしか無いので、seedId指定の追加取得が導線そのもの。
  /\/api\/seeds\/screening-bands\?seedId=\$\{encodeURIComponent\(assessment\.seed_id\)\}/,
  /<CurrentSpsAssessmentCard\b[^>]*band=\{band\}/,
]);
expectIncludes("src/components/sps/CurrentSpsAssessmentCard.tsx", [
  'data-testid="current-sps-assessment"',
  "現行SPS｜産業創出価値",
  "最新版未評価",
  "assessment.assessment_id",
  "assessment.model.measureVersion",
  // 判断根拠の展開 (compact表示では出さない)
  "SpsBandRationale",
  "showRationale",
  "q帯",
  "P^ind帯",
  "投資判断・対外表示には使わない",
]);
// 判断根拠の共通UI。シーズ詳細モーダルとPJコックピットのスコア詳細から同じ根拠を読む。
// mdだけに根拠を置かないための導線なので、どちらかの画面から消さない。
expectIncludes("src/components/sps/SpsBandRationale.tsx", [
  'data-testid="sps-band-rationale"',
  "総合判断",
  "q帯の根拠",
  "qEvidence",
]);
expectIncludes("src/components/seeds/KuteSeedDetailModal.tsx", [
  "SpsBandRationale",
  "screeningBand.notes",
  "screeningBand.q_evidence",
]);
// /seeds が開く本命の詳細モーダル (internal面)。まさが帯・総合判断を読む唯一の画面。
// public面 (KuteSeedDetailModal) は detailSurface="public" の呼び出し元がリポジトリに無く、
// 現在どこからも表示されない。帯の導線をこちらから消すと OS 画面から根拠が読めなくなる。
expectIncludes("src/components/seeds/SeedDetailModal.tsx", [
  "一次選別スクリーニング帯",
  "SpsFormulaPanel",
  "SpsBandRationale",
  "band.notes",
  "band.q_evidence",
  "/api/seeds/screening-bands?seedId=",
  "投資判断・対外表示には使わない",
]);
// シーズ詳細モーダルの帯は、PJコックピットの「スコア詳細」タブと同じ情報量にする (まさ確定 2026-08-20)。
// 数式は LaTeX (Tex/KaTeX) で書き、式の各パラメータの実値をこのシーズの値で併記する。
// 数式は現行 SPS = 産業創出価値版 (sps-ind-v1) のみ。旧9軸 Cobb-Douglas と旧 sps-eq-v0 は退役済みなので持ち込まない。
expectIncludes("src/components/sps/SpsFormulaPanel.tsx", [
  'testId="sps-formula-panel"',
  "@/components/formula/FormulaPanelKit",
  "@/components/venture-map/Tex",
  "Q_FACTORS",
  "STAGE_STEPS",
  "SEED_EVIDENCE_LEVEL_DESCRIPTION",
  "係数を発明しない",
  "閉じた式が存在しない",
]);
// 数式パネルの見た目は共通キットに一本化する (まさ指摘 2026-08-21「なんでここだけデザインコード変えたの?」)。
// 画面ごとに padding / font-size / 装飾を刻み直すとデザインが分岐し、まさが本番画面で即座に気づく差になる。
// HUD の SVG コーナーフレームは CSS で代替しない (design/cyber_hud_design_code.md の Graphic fidelity rule)。
// 正本: pwa/design/cyber_hud_design_code.md「Shared panel kits」
expectIncludes("src/components/formula/FormulaPanelKit.tsx", [
  "export function FormulaPanelShell",
  "data-testid={testId}",
  'viewBox="0 0 1000 720"',
  "M2 12H954L998 64V708H42L2 664Z",
  ".formula-hud-panel .katex",
  "export function FormulaBlock",
  "export function MeaningChip",
  "export function FormulaLine",
  "export function ParamRow",
  "export function Citation",
]);
// AmdScoreFormulaPanel は 2026-08-21 時点で route から到達不能 (import 元の AmdScoreView /
// AmdScoreRetrofit がどこからも import されておらず、/venture-map/amd-score/retrofit と
// /hud/venture-map/amd-score/retrofit は redirect のみ)。復活時にデザインが再分岐しないようキットに載せたまま固定する。
// 生きている PJコックピット「スコア詳細」タブは CockpitAmdScoreDetailTab → CurrentSpsAssessmentCard /
// Bzm22ProvisionalObservatory で、台帳向けの密度重視レイアウト。HUD 数式パネルキットの適用対象ではない。
expectIncludes("src/components/venture-map/AmdScoreFormulaPanel.tsx", [
  "@/components/formula/FormulaPanelKit",
  "FormulaPanelShell",
  "SPS シーズ有望度 (M·P·R·S) PRIMARY FORMULA",
]);
// PJ化の有無でシーズ詳細モーダルの中身を変えない (まさ確定 2026-08-20)。
// 簡易コックピット (判断レール / 判断・推進・記録タブ) をモーダルへ戻さない。
// 事業化検討開始とPJ化で本物のコックピットが生成されるため、モーダル側の再実装は重複になる。
expectNotIncludes("src/components/seeds/SeedDetailModal.tsx", [
  "CommercializationWorkbench",
]);
expectIncludes("src/components/cockpit/Bzm22ProvisionalObservatory.tsx", [
  'data-testid="bzm22-provisional-primary"',
  ">BZM 2.2<",
  "103項目の監査台帳",
  "評価日固定の方針比較",
  "元の前提に戻す",
  "この項目を表す記号",
  "計算を再現・監査するための管理情報",
  "慎重な仮定",
  "参照先はOS未接続",
  'symbol="J"',
  'symbol="P"',
  'symbol="Q"',
  'symbol="S"',
  "<Tex tex={formula}",
  "103項目",
  "ParameterDesktopTable",
  "ParameterMobileCards",
  "式と入力のつながり",
  "各項の直下に、このPJで代入した数値を表示",
  'data-testid="bzm22-formula-substitution-board"',
  "AnnotatedFormula",
  "FormulaTerm",
  'data-testid="bzm22-formula-term"',
  "w-max min-w-[152px] max-w-[720px] shrink-0 self-start",
  "flex w-max items-start",
  "全パラメータ",
  'data-testid="bzm22-formula-parameter-table"',
  "text-left font-medium leading-4 tabular-nums",
  "条件ごとの実数を開く",
  "逆風ごとの補正値を開く",
  "60か月すべての CFₜ・dₜ・Wₜ を開く",
  "実行可能性と経営判断",
  "条件判定月シミュレーション",
  "時期だけを変更・保存なし",
  "Bzm22TimeLedger",
  "formatBzm22RegisteredValue",
  'data-testid="bzm22-registered-value"',
]);
expectNotIncludes("src/components/cockpit/Bzm22ProvisionalObservatory.tsx", [
  "BZM 2.2 暫定主表示",
  "未検証・低精度",
  "影の比較のみ",
  "L / B / H",
  "L/B/H 全値",
  ">現在値<",
  "{pilot.modelVersion}",
  "精度低下:",
  'label="gate積 proxy"',
  'label="stress最小 gate積 proxy"',
  "校正済み到達確率ではない",
  "理論上のq_robでも信頼区間でもない",
  "式に出てくる全記号",
  "Q × P はJではない",
  "items-stretch",
  "min-w-[168px] flex-1",
  "登録値あり（日本語表示未接続）",
  "期間・件の登録データ",
  "項目の登録データ",
  "前提監査未通過",
  "資源配分・PJ横比較には使用不可",
  "SXの設立前DDは現計算ゲートへ未接続",
  "事業価値と、条件を通り切る強さを式から確認する",
  "最下部の監査用。開いて確認",
  "ブラウザ内シミュレーター。この画面内の変更は保存されない",
  "計算式を構成する26項目。選択中ケースの値を一つの表で確認する",
]);
expectIncludes("src/components/cockpit/Bzm22TimeLedger.tsx", [
  "設立前PJ支出 / NewCo P/L",
  "SX_PREINCORPORATION_SPEND_ROW",
  'data-accounting-scope={notApplicableBeforeIncorporation ? "not-applicable-before-incorporation" : undefined}',
  "CXはNewCo単体の試算表。設立前のAMD/NIMS PJ費用を会社のP/Lへ持ち込まない。",
  "CX NewCoは${CX_INCORPORATION_YM}設立。設立前のPJ費用はこの試算表へ入力しない。",
  "draftBeforeIncorporation",
  'draftBeforeIncorporation ? "設立前PJ支出" : "月次試算"',
]);
expectIncludes("scripts/backfill_sx_phase_monthly_pl.mts", [
  "設立前PJ支出でありNewCoのP/L・営業損失ではない",
  "設立前PJ支出の会計主体注記が欠けている",
]);
expectIncludes("src/components/cockpit/Bzm22CockpitSummary.tsx", [
  'data-testid="cockpit-bzm22-primary"',
  'data-testid="cockpit-bzm22-value-rail"',
  'data-layout={embedded ? "value-rail" : "standalone"}',
  "BZM22_TOP_METRICS",
  "?view=summary",
  "103パラメータと計算",
]);
expectIncludes("src/components/cockpit/CockpitVentureStatus.tsx", [
  "Bzm22CockpitSummary",
  "CurrentSpsAssessmentCard",
  "/sps-current",
  'data-testid="cockpit-bzm22-xrl-overview"',
  'data-testid="cockpit-xrl-panel"',
  'data-testid="cockpit-xrl-plot"',
  "xl:grid-cols-[minmax(340px,24vw)_minmax(0,1fr)]",
  "ResizeObserver",
  "xrlPlotWidth",
  "xrlPlotHeight",
]);
expectNotIncludes("src/components/cockpit/CockpitVentureStatus.tsx", [
  "XRLの自動判定は停止中。既存値・手動提案はドットから確認できる",
]);
expectNotIncludes("src/components/cockpit/CockpitAmdScoreDetailTab.tsx", [
  "OS運用レジストリの版",
  "過去理論のモデル観測台帳",
  "履歴・根拠確認のため凍結保持",
]);
expectNotIncludes("src/components/cockpit/CockpitVentureStatus.tsx", [
  "CockpitPlMonthlyModal",
  "📊 試算表",
  "setPlOpen",
]);
expectNotIncludes("src/components/hud/HudCockpitVentureStatus.tsx", [
  "CockpitPlMonthlyModal",
  "📊 試算表",
  "setPlOpen",
]);
expectIncludes("src/components/cockpit/Bzm22TimeLedger.tsx", [
  'data-testid="bzm22-time-ledger"',
  'data-testid="bzm22-shared-month-scroll"',
  "イベントと月次試算",
  "事業価値の時間軸",
  "月次試算表",
  "BZM経済CF",
  'data-testid="bzm22-monthly-edit-dialog"',
  'data-testid="sx-first-funding-target"',
  "const MONTH_WIDTH = 76",
  "const TIMELINE_HEIGHT = 101",
  "buildBzm22SharedMonthAxis",
  "fetchPlMonthly",
  "upsertPlMonthly",
  "CockpitPlHearingModal",
]);
expectIncludes("src/lib/bzm-2-2-pilot-ui.server.ts", [
  "PILOT_LOADERS",
  "schemaVersion",
  "projectId !== projectId",
  "parameters.length, 0) !== 103",
]);
expectIncludes("src/app/api/project/[projectId]/bzm-2-2-pilot/route.ts", [
  "requireMember",
  "fetchBzm22PilotProject",
  '"Cache-Control": "private, no-store, max-age=0"',
  "BZM 2.2 暫定試算の対象PJではありません",
]);
expectIncludes("src/components/cockpit/Bzm21DynamicPolicyObservatory.tsx", [
  "SPS 2.1 動的方針評価",
  "方針条件付き将来正味PJ価値",
  "推定率（数値入力）",
  "感度で行動反転",
  "全パラメータ入力台帳",
  "単一キャッシュフロー台帳",
  "前向き検証",
  'revision ? `${revision.forwardValidationCount}件` : "未登録"',
  "投資配分の自動推薦には使わない",
  '"archive"',
  "現行運用・比較用",
]);
expectIncludes("src/components/cockpit/Bzm2ModelObservatory.tsx", [
  "BZM 2.0 / MODEL OBSERVATORY",
  "全経路価値と到達診断の現在値",
  "Z_policy",
  "前向き検証",
  "SPS}_{\\mathrm{all},\\tau}(H_{\\mathrm{econ}})",
  "q_{\\mathrm{plan},\\tau}(H_v)",
  "AI模擬監査 / 予測用途不通過",
  "全経路のモデル価値",
  "全パラメータの抽出規則",
  "パラメータ台帳",
  "現行運用SPSとは別の検証中モデル",
]);
expectNotIncludes("src/components/cockpit/Bzm2ModelObservatory.tsx", [
  "条件付き理論時価総額",
  "期待時価総額",
]);
expectIncludes("src/app/api/project/[projectId]/amd-score-detail/route.ts", [
  "fetchCurrentSpsProjectAssessments",
  '"Cache-Control": "private, no-store, max-age=0"',
  '"Deprecation": "true"',
  '"Sunset":',
  "rel=successor-version",
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
  "重要な動き",
  "採用リサーチ",
  "industry_market",
  "grant",
  "partner",
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
  "external research candidate not found for notification hash",
]);

expectIncludes("src/components/notifications/NotificationsClient.tsx", [
  'yesLabel: "採用"',
  'noLabel: "見送り"',
  'origin_kind) === "external_research"',
]);

expectIncludes("scripts/ms_progress_review_tool.mjs", [
  "strategySignals",
  "upsertStrategySignals",
  "project_strategy_signals",
  "external-research-check",
  "writtenExternalKeys",
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
  "status: 410",
  "retired",
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

expectIncludes("src/lib/surface-catalog.ts", [
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

expectIncludes("src/lib/surface-catalog.ts", [
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
  "CockpitKuteSeeds",
  'scope="all"',
]);
expectIncludes("src/components/cockpit/CockpitKuteSeeds.tsx", [
  "deep_dive_material_url",
  "FileText",
]);
expectIncludes("src/components/seeds/KuteSeedDetailModal.tsx", [
  "深掘り資料を見る",
  "deep_dive_material_url",
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
  'key: "company", label: "会社概要"',
  'aria-label="会社概要"',
]);
// 資料室タブ (2026-08-21 まさ確定): コックピットの独立タブ。進捗管理タブ側の launcher は廃止。
expectIncludes("src/components/cockpit/CockpitView.tsx", [
  'key: "documents", label: "資料室"',
  'aria-label="資料室"',
  "WorkspaceDocumentRoom",
]);
expectNotIncludes("src/components/cockpit/CockpitView.tsx", [
  "WorkspaceDocumentLauncher",
]);
expectIncludes("src/app/(app)/project/[projectId]/cockpit/page.tsx", [
  '"documents"',
]);

expectFileMissing("src/components/cockpit/CockpitGovernance.tsx");
expectNotIncludes("src/components/cockpit/CockpitView.tsx", [
  "CockpitGovernance",
]);

expectIncludes("src/components/cockpit/CockpitCompanyOverview.tsx", [
  'data-testid="company-overview-tab"',
  "CockpitKillerFactorCatalog",
  "buildCapTableSnapshots",
  "capTableTieOut",
  "convertibleScenario",
  "登記株式数と一致",
  "登記との差",
  "現在の持株比率には入れず",
  "downloadCompanyOverviewXlsx",
  "exportPdf",
]);

// キラー要素カタログ (2026-08-10 まさ確定): 二群同時表示 + 方式別4段階 + PJ全体判定。
expectIncludes("src/components/cockpit/CockpitKillerFactorCatalog.tsx", [
  'data-testid="killer-factor-catalog"',
  'data-testid="killer-factor-risk-overview"',
  'data-testid="killer-factor-density-table"',
  'data-testid="killer-factor-density-row"',
  "このPJの全体判定",
  "予防統制",
  "常時監視",
  'data-testid={`killer-factor-group-${mode}`}',
  "未整備 → 整備中 → 実装済 → 運用確認済",
  "兆候なし → 要観察 → 明確な悪化 → 重大事象",
  "統制の成熟度",
  "兆候の悪化度",
  "未確認は安全扱いしない",
  "要素を追加",
  "状態を保存",
  "根拠メモ",
  "CEO本人の自己申告だけでは平常・兆候・発生を確定しない",
]);
expectNotIncludes("src/components/cockpit/CockpitKillerFactorCatalog.tsx", [
  "発生を記録",
  "未発生",
  'role="tablist"',
  'lg:grid-cols-[9rem_minmax(16rem,1.15fr)_minmax(18rem,1.35fr)_15rem]',
]);
expectIncludes("src/app/api/governance/killer-factors/route.ts", [
  "requireMember",
  'body.action === "create_factor"',
  'body.action === "update_state"',
  'body.action === "mark_occurred"',
  'from("killer_factor_catalog")',
  'from("project_killer_factor_states")',
  "summarizeKillerFactorRisk",
]);
expectIncludes("src/lib/killer-factor-risk.ts", [
  '"critical" | "attention" | "watch" | "unknown" | "stable"',
  'item.status === "watch" || item.status === "implemented"',
  "criticalCount > 0",
  "actionCount > 0",
  "unknownCount > 0 || items.length === 0",
  "watchCount > 0",
]);
expectIncludes("scripts/migrations/250_killer_factor_graduated_assessment.sql", [
  "'watch'",
  "'implemented'",
  "project_killer_factor_state_guard",
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
  'xSplit="1" ySplit="2"',
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
  'saved_count: kind === "coverage_gap" ? 0 : 1',
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
  'review_status: isContractAction && !contractMeta ? "needs_source" : "candidate"',
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

// Round 23 (2026-07-30): 関係先リストは1面に統合。メール専用の別リストは廃止し、
// 直近接点は各社のmain grid内のcolumnに一本化。生の本文・アドレス・URLはDOMに出さない。
// 2026-08-08 まさ指示 #11: 週次管制ナビを<a href="#...">から<button role="tab">へ置き換え、
// 週次差分/ガント/関係先/論点・仮説の4タブ化(「データ接続」タブは廃止し週次差分タブへ内包)。
// 旧アンカーhref="#partner-ledger"の直リンク文字列アサーションは、他画面からの
// /weekly-control#partner-ledger 深リンク互換をSX_WEEKLY_VIEW_HASHのマッピングで
// 引き継いでいるためこの2つに置き換える。
expectIncludes(
  "src/components/project-workspace/SxWeeklyControlDashboard.tsx",
  [
    // 2026-08-08: 「hydration停止」の正体は検証側の背面タブ (rAF停止で
    // streaming revealが保留されるだけ) と判明。タブ化を再適用しアサーションも復元。
    "partners: \"partner-ledger\"",
    "role=\"tablist\"",
    "onManagementChange={setManagement}",
    'kind: "create_partner"',
    'kind: "create_partner_work_item"',
    // 2026-08-08 まさ指示: 見出し下の説明文は削除。分類の複数選択はモーダルへ。
    "分類（複数選択可）",
  ],
);
expectNotIncludes(
  "src/components/project-workspace/SxWeeklyControlDashboard.tsx",
  [
    "SxPartnerEmailLedger",
    "SxPocCandidateList",
    "management-poc",
    "PoC候補先リスト",
    "PoC候補を含む全関係先",
  ],
);
expectIncludes("src/components/project-workspace/SxPartnerPipeline.tsx", [
  "sxLatestInteraction",
  "現在地の根拠",
  "やり取り履歴（全",
  "sxNormalizePublicName",
]);
expectNotIncludes("src/components/project-workspace/SxPartnerPipeline.tsx", [
  "dangerouslySetInnerHTML",
  "SxLatestContactStrip",
  "PartnerJourneyFlow",
  "sx-partner-journey",
  "関係の流れ（これまで → 現在地 → ゴール）",
  "<span>関係先</span><span>当方の保有事項</span><span>先方の保有事項</span><span>次の一手</span><span>目標状態</span>",
  "deriveSxPocList",
  "sxPocStageLabel",
  "sx-partner-poc-group-",
  "sx-partner-poc-expand",
  "PoC候補・",
  "setPocOnly(false);\n          setActiveRoleKind(kind);",
  "setActiveRoleKind(null);\n          setPocOnly((current) => !current);",
]);
expectIncludes("scripts/migrations/201_sx_poc_email_interactions.sql", [
  "interaction_kind",
  "'email'",
  "gmail-thread:",
  "結果と次の約束は未確認",
  "email_count < 11",
]);
expectIncludes("src/lib/sx-partner-holdings.ts", [
  "Gmail確認（本文・宛先は非保存）",
  "/^gmail-(?:thread|message):/i",
]);

// Round 25 (2026-07-30): PoC候補先を独立一覧から関係先台帳へ統合する。
expectFileMissing("src/components/project-workspace/SxPocCandidateList.tsx");
expectIncludes("src/lib/sx-poc-candidates.ts", [
  "sxIsPocPartner",
  "sxIsUncontactedPocPartner",
  "SX_POC_ROLE_PREFIX",
  "roleLabel.startsWith",
]);
expectNotIncludes("src/lib/sx-poc-candidates.ts", [
  "deriveSxPocList",
  "sxPocStageOf",
  "sxPocStageLabel",
  "SX_POC_STAGE_ORDER",
]);
// Round 28/32 (2026-08-01): PoC候補先とVCは同じ台帳の表示タブ。
// 関係先の進行表示は固定段階でなく、保存済み接点・現在地・未完了作業・次の一手・ゴールから可変生成する。
expectIncludes("src/lib/sx-partner-progress.ts", [
  "SX_PARTNER_STAGE_ORDER",
  '"candidate"',
  '"executing"',
  "export type SxPocComparisonSort =\n  | \"progress\"\n  | \"attention\"\n  | \"confidence\"\n  | \"priority\";",
  // 見込み判断はconfidence(情報の確からしさ)へ相乗りさせず独立2軸で持つ (2026-08-06 まさ指摘)。
  "sxPocPriorityTier",
  "sxPocLikelihoodLabel",
  "sxCustomerValueLabel",
  "sxPartnerStageIndex",
  "sxPartnerAttention",
  "sxPartnerHasContactRecord",
  "sxPartnerIsOnHold",
  "sxPartnerNeedsRefresh",
  "sxComparePartnersForPoc",
  "sxCompactPartnerRowText",
  'partner: "先方"',
]);
expectIncludes("src/components/project-workspace/SxPartnerPipeline.tsx", [
  // 2026-08-08 まさ指示: 管制帯 (PartnerComparisonControls) と要対応クイックフィルタは
  // 削除。タブは分類 (classifications 複数可) ベースで、既定はPoC候補先・並びは優先度順固定。
  "PartnerInlineRow",
  "PartnerProgressHistoryModal",
  "primaryInterventionTarget",
  "PartnerInlinePatch",
  "data-inline-edit-trigger",
  "data-inline-editor",
  "sx-partner-comparison-row-",
  "sx-partner-stage-rail-",
  "sx-partner-progress-",
  "interaction-${latestInteraction.id}",
  "work-${item.id}",
  'aria-modal="true"',
  'useState<SxPartnerClassification | null>("poc_candidate")',
  "showRoleFilter={!comparisonOnly}",
  "comparisonPartners.map",
  "sxIsVcPartner",
  "sxCompactPartnerRowText",
  "現在の状況",
  "ゴール",
  "createPortal",
  "useModalContainment",
  "aria-controls={`sx-partner-history-${partnerId}`}",
  "進捗と履歴を開く",
  "sticky top-0",
]);
expectNotIncludes("src/components/project-workspace/SxPartnerPipeline.tsx", [
  "PartnerComparisonRow",
  "PocComparisonDetailModal",
  "sx-partner-inline-editor",
  "detailEditor ?",
  "aria-label={`${display.name}の詳細を開く`}",
  "PartnerProgressScale",
  "PARTNER_STAGE_SHORT_LABELS",
  "sx-partner-stage-reference",
  "data-stage-index",
  "SX_PARTNER_STAGE_ORDER.map",
  "全社共通の7段階で、現在地・停滞・次の行動を比較",
]);
expectIncludes(
  "src/components/project-workspace/SxWeeklyControlDashboard.tsx",
  [
    "sx-plan-inspector-overlay",
    'aria-modal="true"',
    "planInspectorLayer",
    "ガント上に詳細が開く",
    "createPortal",
    "useModalContainment",
    'data-testid="sx-inline-editor"',
    'data-inline-editor-form="true"',
    'data-testid="sx-plan-inline-field-editor"',
    'data-inline-field-editor="true"',
    "data-plan-inline-slot",
    '"inline-edit"',
    "PlanFieldEditorState",
    "planFieldEditor.fieldKeys",
    "fieldsToSubmit",
    "fieldKeySet.has(key)",
    "inlineField && !dirty",
    '["planned_start", "planned_end"]',
    "data-detail-body",
    "className={styles.editorEmbedded}",
    "embedded = false",
    "detailEditor={",
    "onDirtyChange={setDetailEditorDirty}",
    "requestDetailClose",
    "requestAnimationFrame",
  ],
);
expectNotIncludes(
  "src/components/project-workspace/SxWeeklyControlDashboard.tsx",
  [
    "data-inspector=",
    'aria-modal="false"',
    "横に詳細が開く",
    "styles.editorInline",
    'data-testid={embedded ? "sx-inline-editor" : undefined}',
    'setDetailEditor({ kind: "edit_task"',
    'setDetailEditor({ kind: "edit_milestone"',
    'setDetailEditor({ kind: "edit_dependency"',
  ],
);
expectIncludes("src/components/project-workspace/weekly-control.module.css", [
  ".planInspectorLayer",
  "place-items: center",
  "backdrop-filter: blur(4px)",
  "width: min(820px, calc(100vw - 48px))",
  ".editorEmbedded",
  ".planInspectorInlineEditor",
  ".inlineFieldEditor",
  ".inlineFieldForm",
  ".inlineFieldActions",
]);
// Round 34 (2026-08-02): root IssueEditorはcreatePortalでdocument.body直下へ描画され、.page
// が定義するCSS変数の継承チェーンから外れる。.editorEmbedded/.inlineFieldEditorは既に
// ローカルにトークンを再定義していたが、実際にportalされる.editorBackdropだけそれを欠いて
// おり、透明な生成りsheet・崩れたink/border/focusの原因だった。PlanInspectorLayerと同じ
// トークン一式をここで再定義し、44pxヒットターゲットとfocus-visibleの可視outlineも揃える。
expectPattern("src/components/project-workspace/weekly-control.module.css", [
  // v3.66.0: AMD標準カラートーン刷新で.editorBackdropの--sheet: #fffdf7→#ffffff,
  // --ink: #24231f→#1d1d1f, --green: #235f4b→#047857 に置換
  /\.editorBackdrop\s*\{[^}]*--sheet:\s*#ffffff;/,
  /\.editorBackdrop\s*\{[^}]*--ink:\s*#1d1d1f;/,
  /\.editorBackdrop\s*\{[^}]*--green:\s*#047857;/,
  // 監査追補 (2026-08-02、色再監査): CSS変数の再定義だけでは、.editorPanel配下のh2/strong/
  // label/本文がcolorを明示していない限りbody側のdark themeを継承してしまい、不透明な生成り
  // #fffdf7背景の上で文字が薄く読めなくなる。.editorPanel自体にcolor: var(--ink)を明示する。
  /\.editorPanel\s*\{[^}]*color:\s*var\(--ink\);/,
]);
expectIncludes("src/components/project-workspace/weekly-control.module.css", [
  ".iconButton { width: 44px; height: 44px; border-radius: 8px; }",
  // v3.66.0: AMD標準カラートーン刷新でhover背景 #e8f2eb→#ecfdf5 に置換
  ".iconButton:hover, .iconButton:focus-visible { border-color: var(--green); background: #ecfdf5; color: var(--green); outline: 2px solid var(--green); outline-offset: 2px; }",
  ".primaryButton, .secondaryButton { min-height: 44px;",
  ".primaryButton:focus-visible, .secondaryButton:focus-visible { outline: 2px solid var(--green); outline-offset: 2px; }",
  // v3.66.0: AMD標準カラートーン刷新でborder #c9c0b2→#d2d2d7, background #fffefa→#ffffff に置換
  "min-height: 36px; border: 1px solid #d2d2d7; border-radius: 5px; background: #ffffff; padding: 6px 8px; color: var(--ink); font-size: 12px;",
  ".field input:focus-visible, .field select:focus-visible, .field textarea:focus-visible, .fieldSpan input:focus-visible, .fieldSpan select:focus-visible, .fieldSpan textarea:focus-visible { outline: 2px solid var(--green); outline-offset: 1px; }",
  ".checkboxRow { min-height: 36px;",
  ".checkboxRow input:focus-visible { outline: 2px solid var(--green); outline-offset: 2px; }",
]);
expectPattern("src/components/project-workspace/weekly-control.module.css", [
  // Compact desktop controls re-inflate to safe touch targets and 16px text on narrow screens.
  /@media \(max-width: 640px\)[\s\S]*\.field input,[\s\S]*\.fieldSpan textarea \{ min-height: 44px; \}/,
  /@media \(max-width: 640px\)[\s\S]*\.field input,[\s\S]*\.inlineFieldForm \.fieldSpan textarea \{ font-size: 16px; \}/,
]);
expectIncludes("src/components/project-workspace/useModalContainment.ts", [
  "FOCUSABLE_SELECTOR",
  'event.key !== "Tab"',
  'event.key === "Escape"',
  'document.body.style.overflow = "hidden"',
  'document.documentElement.style.overflow = "hidden"',
  "element.inert = true",
  "previousFocus.focus()",
]);
expectNotIncludes(
  "src/components/project-workspace/weekly-control.module.css",
  [
    ".ganttWorkspace[data-inspector]",
    ".editorPanel.editorInline",
    ".editorInline .editorHeader",
    ".editorInline .editorFooter",
  ],
);
expectSegmentNotIncludes(
  "src/components/project-workspace/weekly-control.module.css",
  ".editorEmbedded {",
  "}",
  ["border:", "box-shadow:", "background: white", "background: #"],
);
expectIncludes("scripts/migrations/211_sx_vc_partner_ledger.sql", [
  "ダイキアクシスベンチャーパートナーズ（DAVP）",
  "Beyond Next Ventures（BNV）",
  "いよぎんキャピタル",
  "'partners-fund'",
  "'shareholder_investor'",
  "'unconfirmed'",
  "user:2026-08-01#vc-list",
  "partner_count <> 4",
  "vc_role_count <> 4",
  "partner.deleted_at IS NULL",
  "role.deleted_at IS NULL",
]);
// 土壌×シーズタブ: ECRと現行SPSだけを分離表示し、旧版fallbackと合成単一スコア化を禁止。
expectIncludes("src/app/(app)/institutions/[institutionId]/cockpit/page.tsx", [
  "CockpitSoilSeeds",
  '"soil-seeds"',
  "土壌×シーズ",
  "ersAssessmentHistory",
  "ersAxes",
  "ersCriteria",
]);
expectIncludes("src/components/cockpit/CockpitSoilSeeds.tsx", [
  "fetchSeedsForInstitution",
  "/api/seeds/screening-bands",
  "seedScreeningBandMedianYen",
  "土壌 × シーズ — ECRと現行SPS",
  "現行SPS｜産業創出価値",
  "最新版未評価",
  "sps-ind-v1 / q-eval-v2 / rubric-v1.1 / p-ind-v1",
  "ECRとSPSは合成しない",
]);
expectNotIncludes("src/components/cockpit/CockpitSoilSeeds.tsx", [
  "recharts",
  "RadarChart",
  "ScatterChart",
]);

// BZM 2.0 理論マップ (2026-08-02): 即時下書き (Canvas単一描画)・即時接続とマップ内編集で
// 育てる論証台帳。ノード=理論要素・エッジ=関係・メモ=選択ノード内側の記録という概念分離
// (直前の「1メモ=1ノード+1エッジ」誤仕様は撤回)。成長操作は「メモを追加」1本化 (draft node
// を作らず bzm_theory_node_memos だけへ書く)。同日の右台帳撤去で、常設の選択ノード読取り
// ウィンドウ (summary/source/body プレビュー、カバレッジ警告、メモ一覧、接続ノード一覧、行内
// 削除ボタン) は廃止し、マップを右の予約列なしに全幅化した。ノード詳細の読み書きは既存の
// マップ内編集オーバーレイに一本化し、選択ノードの操作帯 (編集・メモを追加・Cmd/Ctrl接続) だけ残す。
expectIncludes("src/components/bzm/BzmSideNav.tsx", [
  "/bzm/map",
  "理論マップ (論証台帳)",
]);
expectIncludes("src/components/bzm/BzmTheoryMapView.tsx", [
  'id="bzm-map-search"',
  'aria-label="マップ表示に切り替え"',
  'aria-label="一覧表示に切り替え"',
  "onBackgroundClick",
  "onNodeDragEnd",
  "onLinkClick",
  "event.metaKey || event.ctrlKey",
  "⌘＋次のノードで即接続",
  'data-bzm-map-workspace="true"',
  "KIND_COLOR",
  "createDirectEdge",
  "parseTheoryMapEdgeDto",
  "openDraftComposer",
  "openMemoComposer",
  "screen2GraphCoords",
  "setPendingEdge(optimisticEdge)",
  "clippedLinkPoints",
  "linkCanvasObject={drawClippedLink}",
  'data-bzm-map-overlay-host="composer"',
  "メモを追加",
  "ここから、まさの理論マップが始まる",
]);
expectNotIncludes("src/components/bzm/BzmTheoryMapView.tsx", [
  "nearestDistance",
  "fillText(KIND_",
  "drawStatusRing",
  "色 = ステータス",
  "data-bzm-draft-node",
  "draftVisual",
  "関連メモ",
  "openGrowComposer",
  "relationRoleDefaults",
  "MemoList",
  "ConnectedNodesList",
  "data-bzm-edge-row-delete",
  "<BzmMarkdown",
  "_380px]",
  "カバレッジの欠落",
]);
expectIncludes("src/components/bzm/BzmTheoryComposerDialog.tsx", [
  'data-bzm-map-panel="composer"',
  'data-bzm-map-overlay="composer"',
  'aria-modal="false"',
  "下書きノードをマップに作成済み",
  "onDraftChange(state.draftId, form)",
  "MEMO_TYPE_OPTIONS",
  '"create_memo"',
  "parseTheoryMapMemoDto",
]);
expectNotIncludes("src/components/bzm/BzmTheoryComposerDialog.tsx", [
  'type: "connect"',
  'mode === "connect"',
  "既存ノードとつなぐ",
  '"support" | "challenge" | "question"',
  "RELATION_ROLE_OPTIONS",
  "relationRoleDefaults",
  "relationDirection",
  "deriveNoteTitle",
  "接続のプレビュー",
]);
expectIncludes("package.json", ["test:bzm-theory-graph"]);

// SX関係先・論点の低摩擦入力 (2026-08-09): 排液調達は明示boolを行内PATCH、
// 論点は種類/期限を一覧で見せ、議論の進捗は上書きせず追記履歴として保存する。
// 長文は省略せず、背景/仮説・議論・判断/次の一手を3ペインのworkbenchへ集約する。
expectIncludes("src/components/project-workspace/SxPartnerPipeline.tsx", [
  "partner.effluentProcured ?? receivedSamples > 0",
  "effluent_procured: event.target.checked",
  "PJにとっての優先度",
]);
expectNotIncludes("src/components/project-workspace/SxPartnerPipeline.tsx", [
  'className="pointer-events-none h-4 w-4 accent-[#047857]"',
  "顧客としての見込み。ペインの高さと単価の高い重金属の有無で付ける",
]);
expectIncludes("src/components/project-workspace/SxWeeklyControlDashboard.tsx", [
  "論点・仮説を追加",
  '<th scope="col">種類</th>',
  '<th scope="col">期限</th>',
  "議論の進捗",
  "IssueWorkbench",
  "今回の議論",
  "この議論から生まれた仮説",
  "次の一手",
  "解決済みにして下へ移動",
  'fieldKeys={activeEditor.kind === "edit_issue" ? ["title", "background", "knowledge_type", "status", "due_date"] : undefined}',
  'resource: "issue_discussion"',
  "onAddDiscussion={addIssueDiscussion}",
]);
expectIncludes("src/components/project-workspace/weekly-control.module.css", [
  ".issueWorkbenchGrid",
  "grid-template-columns: minmax(280px, .82fr) minmax(360px, 1.18fr) minmax(300px, .92fr)",
  ".issueRowTruncate { margin: 3px 0 0; line-height: 1.5; white-space: normal; overflow-wrap: anywhere; }",
]);
expectNotIncludes("src/components/project-workspace/weekly-control.module.css", [
  ".issueRowTitleButton { display: block; width: 100%; margin-top: 4px; border: 0; border-bottom: 1px dashed transparent; background: transparent; color: var(--ink); font-size: 12px; line-height: 1.4; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }",
  ".issueRowTruncate { margin: 3px 0 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }",
]);
expectIncludes("src/app/api/project-workspace/[projectId]/management/route.ts", [
  'body.resource === "issue_discussion"',
  'from("project_management_issue_discussions")',
  'takeOptionalText("background", "background", 4000)',
  'takeBoolean("effluent_procured")',
]);
expectIncludes("src/lib/sx-management.ts", [
  'plain("project_management_issue_discussions"',
  "effluentProcured: boolean | null",
  "discussions: SxIssueDiscussion[]",
  "background: string | null",
]);
expectIncludes("scripts/migrations/247_sx_partner_effluent_procured.sql", [
  "effluent_procured boolean",
  "project_management_partners.poc_grade",
]);
expectIncludes("scripts/migrations/248_project_management_issue_discussions.sql", [
  "CREATE TABLE IF NOT EXISTS public.project_management_issue_discussions",
  "project_management_issue_discussions_manager_insert",
]);
expectIncludes("scripts/migrations/250_project_management_issue_background.sql", [
  "ADD COLUMN IF NOT EXISTS background text",
]);
