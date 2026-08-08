"use client";

import type { ReactNode } from "react";
import { CircleAlert, CircleCheck, CircleDashed } from "lucide-react";
import type {
  SxManagementBundle,
  SxManagementMilestone,
  SxMilestoneStatus,
  SxTechnicalTest,
} from "@/lib/sx-management";
import {
  SxBadge,
  SX_STATUS_LABEL,
  sxFormatDate,
  sxIsMissingOwner,
  sxTechnicalTestStatusLabel,
} from "./sx-visual-shared";
import { nominalizeSxActionLabel } from "@/lib/sx-action-label";

type ThemeRow = {
  id: string;
  name: string;
  position: string;
  status: SxMilestoneStatus | SxTechnicalTest["status"];
  statusLabel: string;
  completion: string;
  evidence: string;
  uncertainty: string;
  testCondition: string;
  nextExperiment: string;
  owner: string;
  schedule: string[];
  contribution: string;
};

const STATUS_TONE: Record<string, string> = {
  passed: "border-[#6ee7b7] bg-[#ecfdf5] text-[#047857]",
  completed: "border-[#6ee7b7] bg-[#ecfdf5] text-[#047857]",
  running: "border-[#7CBCEB] bg-[#E8F3FC] text-[#027FDC]",
  on_track: "border-[#7CBCEB] bg-[#E8F3FC] text-[#027FDC]",
  planned: "border-[#d97706] bg-[#fef3c7] text-[#92400e]",
  attention: "border-[#d97706] bg-[#fef3c7] text-[#92400e]",
  at_risk: "border-[#fca5a5] bg-[#fee2e2] text-[#dc2626]",
  failed: "border-[#fca5a5] bg-[#fee2e2] text-[#dc2626]",
  blocked: "border-[#fca5a5] bg-[#fee2e2] text-[#dc2626]",
  unassessed: "border-[#3D99E3] bg-[#E8F3FC] text-[#0267B2]",
  not_started: "border-[#cbd5e1] bg-[#f5f5f7] text-[#86868b]",
};

const TEST_ORDER = ["tech-performance-test", "tech-reproducibility-test", "tech-scale-test", "tech-containment-test", "tech-recovery-test"];

function nonEmpty(value: string | null | undefined, fallback: string) {
  const normalized = value?.trim();
  return normalized ? normalized : fallback;
}

function milestoneRow(
  milestone: SxManagementMilestone | undefined,
  nextGate: SxManagementMilestone | undefined,
  management: SxManagementBundle,
  fallbackName: string,
  position: string,
  contribution: string,
): ThemeRow {
  const issue = milestone
    ? management.issues.find((item) => item.milestoneSlug === milestone.slug || item.relatedMilestoneSlugs.includes(milestone.slug))
    : undefined;
  const supportingEvidence = issue?.evidence.find((item) => item.kind === "supporting" || item.kind === "observation");
  const missingEvidence = issue?.evidence.find((item) => item.kind === "missing" || item.kind === "counter");
  const status = milestone?.status ?? "unassessed";
  return {
    id: milestone?.id ?? fallbackName,
    name: milestone ? nominalizeSxActionLabel(milestone.title) : fallbackName,
    position,
    status,
    statusLabel: milestone ? SX_STATUS_LABEL[status] : "未登録",
    completion: nonEmpty(milestone?.completionCriteria, "完了条件 未登録"),
    evidence: nonEmpty(milestone?.completionEvidence || supportingEvidence?.summary, "証拠 未登録"),
    uncertainty: nonEmpty(missingEvidence?.summary || milestone?.maxIssue, "未確定事項 未登録"),
    testCondition: "試験条件 未登録",
    nextExperiment: issue?.nextValidation?.trim()
      ? nominalizeSxActionLabel(issue.nextValidation.trim())
      : "次実験 未登録",
    owner: nonEmpty(milestone?.ownerLabel, "担当 未登録"),
    schedule: [
      milestone ? `テーマ 予定 ${sxFormatDate(milestone.plannedEnd)} / 予測 ${sxFormatDate(milestone.forecastEnd)}` : "テーマ日程 未登録",
      nextGate ? `次ゲート 予定 ${sxFormatDate(nextGate.plannedEnd)} / 予測 ${sxFormatDate(nextGate.forecastEnd)}` : "次ゲート日程 未登録",
    ],
    contribution,
  };
}

function technicalTestRow(test: SxTechnicalTest, parent: SxManagementMilestone | undefined, contribution: string): ThemeRow {
  const missing = [
    !test.target && "合格値",
    test.actual == null && "実測",
    test.repetition == null && "反復数",
    !test.sample && "試料",
  ].filter(Boolean) as string[];
  const completion = test.target
    ? `${test.target}${test.unit && test.unit !== "未設定" ? ` ${test.unit}` : ""} / ${test.trlCriterion}`
    : nonEmpty(test.trlCriterion, "完了条件 未登録");
  const measured = test.actual == null
    ? null
    : `実測 ${test.actual}${test.unit && test.unit !== "未設定" ? ` ${test.unit}` : ""}${test.measuredOn ? `（${sxFormatDate(test.measuredOn)}）` : ""}`;
  return {
    id: test.id,
    name: test.testName,
    position: parent ? `${nominalizeSxActionLabel(parent.title)}の成立条件` : "親ゲート 未接続",
    status: test.status,
    statusLabel: sxTechnicalTestStatusLabel(test.status),
    completion,
    evidence: nonEmpty([test.evidence, measured].filter(Boolean).join(" / "), "証拠 未登録"),
    uncertainty: missing.length > 0 ? `${missing.join("・")} 未登録` : "重大な未確定なし",
    testCondition: nonEmpty(test.testCondition, "試験条件 未登録"),
    nextExperiment: "次実験 未登録",
    owner: nonEmpty(test.ownerLabel, "担当 未登録"),
    schedule: [
      "テーマ期限 未登録",
      parent ? `親ゲート 予定 ${sxFormatDate(parent.plannedEnd)} / 予測 ${sxFormatDate(parent.forecastEnd)}` : "親ゲート日程 未登録",
    ],
    contribution,
  };
}

function StatusMark({ status }: { status: string }) {
  if (status === "passed" || status === "completed") return <CircleCheck className="h-3.5 w-3.5" aria-hidden="true" />;
  if (status === "blocked" || status === "failed" || status === "at_risk") return <CircleAlert className="h-3.5 w-3.5" aria-hidden="true" />;
  return <CircleDashed className="h-3.5 w-3.5" aria-hidden="true" />;
}

function DesktopCell({ label, children, warning = false }: { label: string; children: ReactNode; warning?: boolean }) {
  const text = typeof children === "string" ? children : "";
  const isPlaceholder = text.includes("未登録");
  const tone = isPlaceholder ? "text-[#86868b]" : warning ? "font-medium text-[#92400e]" : "text-[#3c3c43]";
  return (
    <div className="min-w-0 px-2 py-2" data-column={label}>
      <p className={`line-clamp-2 text-[11px] leading-[15px] ${tone}`}>{children}</p>
    </div>
  );
}

function ThemeDetails({ row }: { row: ThemeRow }) {
  const fields = [
    ["完了条件", row.completion],
    ["証拠", row.evidence],
    ["未確定事項", row.uncertainty],
    ["試験条件", row.testCondition],
    ["次実験", row.nextExperiment],
    ["担当", row.owner],
    ["日程", row.schedule.join(" / ")],
    ["寄与先ゲート", row.contribution],
  ];
  return (
    <dl className="grid gap-x-4 gap-y-2 border-t border-[#cbd5e1] bg-[#f5f5f7] px-3 py-3 sm:grid-cols-2 lg:grid-cols-4">
      {fields.map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-[10px] font-semibold text-[#3c3c43]">{label}</dt><dd className={`mt-0.5 whitespace-normal text-[11px] leading-4 ${String(value).includes("未登録") || String(value).includes("未確認") ? "text-[#86868b]" : "text-[#1d1d1f]"}`}>{value}</dd></div>)}
    </dl>
  );
}

export function SxDevelopmentThemeBoard({ management }: { management: SxManagementBundle }) {
  const reactor = management.milestones.find((item) => item.slug === "tech-reactor-recheck");
  const poc = management.milestones.find((item) => item.slug === "tech-poc-gate");
  const requiredSuccessors = (milestone: SxManagementMilestone | undefined) => milestone
    ? management.dependencies
      .filter((dependency) => dependency.required && dependency.predecessorMilestoneId === milestone.id)
      .map((dependency) => management.milestones.find((candidate) => candidate.id === dependency.successorMilestoneId))
      .filter((candidate): candidate is SxManagementMilestone => Boolean(candidate))
    : [];
  const contributionFrom = (milestone: SxManagementMilestone | undefined) => {
    if (!milestone) return "未接続";
    const successors = requiredSuccessors(milestone);
    return successors.length > 0 ? successors.map((item) => nominalizeSxActionLabel(item.title)).join(" / ") : "未接続";
  };
  const reactorContribution = reactor
    ? `${nominalizeSxActionLabel(reactor.title)} → ${contributionFrom(reactor)}`
    : "未接続";
  const technicalTests = management.technicalTests
    .filter((test) => Boolean(reactor) && test.milestoneId === reactor?.id)
    .sort((left, right) => {
    const leftIndex = TEST_ORDER.indexOf(left.testSlug);
    const rightIndex = TEST_ORDER.indexOf(right.testSlug);
    return (leftIndex < 0 ? TEST_ORDER.length : leftIndex) - (rightIndex < 0 ? TEST_ORDER.length : rightIndex);
  });
  const rows: ThemeRow[] = [
    milestoneRow(reactor, requiredSuccessors(reactor)[0], management, "反応器構成", "技術テーマの統合点", contributionFrom(reactor)),
    ...technicalTests.slice(0, 5).map((test) => technicalTestRow(test, reactor, reactorContribution)),
    milestoneRow(poc, requiredSuccessors(poc)[0], management, "オンサイトPoC実施判定", "技術開発の出口ゲート", contributionFrom(poc)),
  ];

  while (rows.length < 7) {
    const index = rows.length;
    rows.splice(Math.max(1, rows.length - 1), 0, {
      id: `missing-theme-${index}`,
      name: `開発テーマ ${index}`,
      position: "反応器成立条件",
      status: "unassessed",
      statusLabel: "未登録",
      completion: "完了条件 未登録",
      evidence: "証拠 未登録",
      uncertainty: "評価項目 未登録",
      testCondition: "試験条件 未登録",
      nextExperiment: "次実験 未登録",
      owner: "担当 未登録",
      schedule: ["テーマ期限 未登録", reactor ? `親ゲート 予定 ${sxFormatDate(reactor.plannedEnd)} / 予測 ${sxFormatDate(reactor.forecastEnd)}` : "親ゲート日程 未登録"],
      contribution: "未接続",
    });
  }

  const assessed = rows.filter((row) => row.status !== "unassessed").length;
  const missingEvidence = rows.filter((row) => row.evidence.includes("未登録")).length;
  const missingOwner = rows.filter((row) => sxIsMissingOwner(row.owner) || row.owner.includes("未登録")).length;

  return (
    <section className="overflow-hidden border-y border-[#cbd5e1] bg-[#ffffff]" aria-labelledby="development-theme-heading" data-testid="sx-development-theme-board">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1 border-b border-[#cbd5e1] px-3 py-2 sm:px-4">
        <div className="min-w-0">
          <p className="text-[9px] font-semibold tracking-[0.15em] text-[#059669]">開発テーマ管制 / 全体ゲートへの寄与</p>
          <h2 id="development-theme-heading" className="mt-0.5 text-sm font-semibold text-[#1d1d1f]">7テーマの成立条件・証拠・次実験</h2>
        </div>
        <p className="text-[10px] text-[#3c3c43]">{assessed === 0 ? "全7テーマ 未評価 ・ " : `評価済 ${assessed}/7 ・ `}証拠未登録 {missingEvidence} ・ 担当未確認 {missingOwner}</p>
      </div>


      <div className="hidden xl:block">
        <div className="grid grid-cols-[minmax(130px,1.15fr)_72px_minmax(128px,1.2fr)_minmax(118px,1.1fr)_minmax(112px,1.05fr)_minmax(118px,1.1fr)_minmax(128px,1.15fr)_minmax(112px,1fr)] border-b border-[#cbd5e1] bg-[#f5f5f7] text-[9px] font-semibold text-[#3c3c43]">
          {['テーマ / 位置づけ', '状態', '完了条件', '証拠', '未確定事項', '試験条件 / 次実験', '担当 / 日程', '寄与先ゲート'].map((label) => <div key={label} className="px-2 py-1.5">{label}</div>)}
        </div>
        {rows.slice(0, 7).map((row, index) => (
          <details key={row.id} className={`group border-b border-[#e2e8f0] [&>summary::-webkit-details-marker]:hidden ${index === 0 || index === 6 ? "bg-[#f5f5f7]" : "bg-white"}`}>
            <summary className="grid min-h-[62px] max-h-[76px] cursor-pointer list-none overflow-hidden grid-cols-[minmax(130px,1.15fr)_72px_minmax(128px,1.2fr)_minmax(118px,1.1fr)_minmax(112px,1.05fr)_minmax(118px,1.1fr)_minmax(128px,1.15fr)_minmax(112px,1fr)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#059669]">
              <div className="min-w-0 border-l-[3px] border-[#059669] px-2 py-2">
                <p className="line-clamp-2 text-xs font-semibold leading-[15px] text-[#1d1d1f]">{row.name}</p>
                <p className="mt-0.5 truncate text-[10px] text-[#3c3c43]">{row.position} ・ 全文を表示</p>
              </div>
              <div className="px-1 py-2">
                <SxBadge tone={STATUS_TONE[row.status] || STATUS_TONE.unassessed}><span className="flex items-center gap-1"><StatusMark status={row.status} />{row.statusLabel}</span></SxBadge>
              </div>
              <DesktopCell label="完了条件">{row.completion}</DesktopCell>
              <DesktopCell label="証拠" warning={row.evidence.includes("未登録")}>{row.evidence}</DesktopCell>
              <DesktopCell label="未確定事項" warning={!row.uncertainty.includes("なし")}>{row.uncertainty}</DesktopCell>
              <div className="min-w-0 px-2 py-2 text-[10px] leading-[14px]" data-column="試験条件 / 次実験"><p className="truncate text-[#3c3c43]">条件: {row.testCondition}</p><p className={`line-clamp-2 ${row.nextExperiment.includes("未登録") ? "text-[#86868b]" : "text-[#3c3c43]"}`}>次: {row.nextExperiment}</p></div>
              <div className="min-w-0 px-2 py-1.5 text-[10px] leading-[13px] text-[#3c3c43]" data-column="担当 / 日程"><p className="truncate">{row.owner}</p>{row.schedule.map((line) => <p key={line} className="truncate">{line}</p>)}</div>
              <DesktopCell label="寄与先ゲート" warning={row.contribution === "未接続"}>{row.contribution}</DesktopCell>
            </summary>
            <ThemeDetails row={row} />
          </details>
        ))}
      </div>

      <div className="hidden md:block xl:hidden">
        <div className="grid grid-cols-[150px_70px_minmax(0,1fr)_190px] border-b border-[#cbd5e1] bg-[#f5f5f7] text-[9px] font-semibold text-[#3c3c43]">
          <div className="px-2 py-1.5">テーマ / 位置づけ</div><div className="px-1 py-1.5">状態</div><div className="px-2 py-1.5">完了条件 / 証拠 / 次実験</div><div className="px-2 py-1.5">担当・期限 / 寄与先</div>
        </div>
        {rows.slice(0, 7).map((row, index) => (
          <details key={row.id} className={`group border-b border-[#e2e8f0] [&>summary::-webkit-details-marker]:hidden ${index === 0 || index === 6 ? "bg-[#f5f5f7]" : "bg-white"}`}>
            <summary className="grid min-h-[62px] max-h-[74px] cursor-pointer list-none grid-cols-[150px_70px_minmax(0,1fr)_190px] overflow-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#059669]">
              <div className="min-w-0 border-l-[3px] border-[#059669] px-2 py-2"><p className="line-clamp-2 text-[11px] font-semibold leading-[14px] text-[#1d1d1f]">{row.name}</p><p className="truncate text-[10px] text-[#3c3c43]">{row.position} ・ 全文</p></div>
              <div className="px-1 py-2"><SxBadge tone={STATUS_TONE[row.status] || STATUS_TONE.unassessed}><span className="flex items-center gap-1"><StatusMark status={row.status} />{row.statusLabel}</span></SxBadge></div>
              <div className="min-w-0 px-2 py-2 text-[10px] leading-[13px]"><p className="truncate text-[#3c3c43]">完了: {row.completion}</p><p className="truncate text-[#3c3c43]">証拠: {row.evidence} / 未確定: {row.uncertainty}</p><p className={`truncate ${row.nextExperiment.includes("未登録") ? "text-[#86868b]" : "text-[#3c3c43]"}`}>次実験: {row.nextExperiment}</p></div>
              <div className="min-w-0 px-2 py-1.5 text-[10px] leading-[13px]"><p className="truncate text-[#3c3c43]">{row.owner}</p>{row.schedule.slice(0, 2).map((line) => <p key={line} className="truncate text-[#3c3c43]">{line}</p>)}<p className={`truncate font-semibold ${row.contribution === "未接続" ? "text-[#86868b]" : "text-[#027FDC]"}`}>→ {row.contribution}</p></div>
            </summary>
            <ThemeDetails row={row} />
          </details>
        ))}
      </div>

      <div className="divide-y divide-[#e2e8f0] md:hidden">
        {rows.slice(0, 7).map((row, index) => (
          <details key={row.id} className={`group [&>summary::-webkit-details-marker]:hidden ${index === 0 || index === 6 ? "bg-[#f5f5f7]" : "bg-white"}`}>
            <summary className="h-[106px] cursor-pointer list-none overflow-hidden px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#059669] sm:px-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0"><h3 className="truncate text-xs font-semibold text-[#1d1d1f]">{row.name}</h3><p className="truncate text-[10px] text-[#3c3c43]">{row.position} → {row.contribution} ・ タップで全文</p></div>
                <SxBadge tone={STATUS_TONE[row.status] || STATUS_TONE.unassessed}><span className="flex items-center gap-1"><StatusMark status={row.status} />{row.statusLabel}</span></SxBadge>
              </div>
              <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] leading-[12px]">
                <div className="min-w-0"><dt className="font-semibold text-[#3c3c43]">完了条件</dt><dd className="line-clamp-2 text-[#3c3c43]">{row.completion}</dd></div>
                <div className="min-w-0"><dt className="font-semibold text-[#3c3c43]">証拠 / 未確定</dt><dd className="line-clamp-2 text-[#3c3c43]">{row.evidence} / {row.uncertainty}</dd></div>
                <div className="min-w-0"><dt className="font-semibold text-[#3c3c43]">試験条件 / 次実験</dt><dd className={`line-clamp-2 ${row.nextExperiment.includes("未登録") ? "text-[#86868b]" : "text-[#3c3c43]"}`}>{row.testCondition} / {row.nextExperiment}</dd></div>
                <div className="min-w-0"><dt className="font-semibold text-[#3c3c43]">担当 / 日程</dt><dd className="line-clamp-2 text-[#3c3c43]">{row.owner} / {row.schedule.join(" / ")}</dd></div>
              </dl>
            </summary>
            <ThemeDetails row={row} />
          </details>
        ))}
      </div>
    </section>
  );
}
