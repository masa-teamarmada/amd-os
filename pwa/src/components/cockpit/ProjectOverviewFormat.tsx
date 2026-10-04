"use client";

/**
 * PJコックピット「PJ管理 > PJ概要」タブ。全PJ共通の標準フォーマット（spec 3-23 §9、定義は project-formats.ts・鍵付き）。
 *
 * 2026-10-04 まさ確定「1で進めて」。
 * - PJの定義（目的・相手・AMDの関わり方・AMDの報酬形態・期間と体制）… PJを作るときに決めて、めったに変えない。
 *   直せるのは管理者だけ（「定義を直す」）。目的はゴールツリーの到達点をそのまま出す。
 * - 今の状態（段階と次の節目・契約と収支・まだ決まっていないこと・最近の重要な動き）… ほかのタブのデータから出す。ここでは書かない。
 * - 事業の一言（何をする事業か）は会社の話なので、会社情報 > 会社概要「事業の概要」に置く。
 * 項目はデータの有無にかかわらず全部描く。無いところは「未登録」と、どこで書くかを出す。
 */

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "@/components/cockpit/company-overview-ui";
import { CONTRACT_TYPE_LABELS, currentContracts, type CockpitOverviewProject } from "@/components/cockpit/CockpitProjectOverview";
import { CockpitVentureMetaEditModal } from "@/components/cockpit/CockpitVentureMetaEditModal";
import type { CockpitTab } from "@/lib/cockpit-tabs";
import {
  AMD_REVENUE_KINDS,
  PROJECT_OVERVIEW_GROUPS,
  PROJECT_OVERVIEW_SECTIONS,
  type AmdRevenueKindKey,
  type ProjectOverviewSectionKey,
} from "@/lib/project-formats";
import {
  AMD_ROLE_LABELS,
  PROJECT_CATEGORY_LABELS,
  VENTURE_LANE_LABELS,
  contractStatusLabel,
  overviewNextMilestone,
  overviewOpenItems,
  overviewOrigin,
  overviewPeriod,
  overviewPurpose,
  overviewSeason,
  overviewStage,
  overviewTeam,
  revenueKindLabel,
  type ProjectOverviewResponse,
  type ProjectRevenueStream,
} from "@/lib/project-overview";
import { invalidateProjectOverview, loadProjectOverview, peekProjectOverview, saveProjectDefinition } from "@/lib/project-overview-client";
import { loadQuestionTree, peekQuestionTree } from "@/lib/question-tree-client";
import { loadSeasonBudget, peekSeasonBudget } from "@/lib/season-budget-client";
import type { QuestionTreeBundle } from "@/lib/question-tree-types";
import type { SeasonPlPayload } from "@/app/api/project/[projectId]/season-budget/route";
import { fetchVentureStatus, type ProjectVentureRow } from "@/lib/venture-status-data";

type Props = {
  project: CockpitOverviewProject;
  onSelectTab: (tab: CockpitTab) => void;
};

function localToday(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function dateLabel(value: string | null | undefined): string {
  if (!value) return "";
  return value.slice(0, 10).replaceAll("-", "/");
}

function monthLabel(value: string | null | undefined): string {
  if (!value) return "";
  const match = value.match(/^(\d{4})-?(\d{2})/);
  return match ? `${match[1]}年${Number(match[2])}月` : value;
}

function ymSlash(value: string): string {
  return /^\d{6}$/.test(value) ? `${value.slice(0, 4)}/${value.slice(4, 6)}` : value;
}

function yen(value: number): string {
  return `${Math.round(value).toLocaleString("ja-JP")}円`;
}

// ---------------------------------------------------------------------------------------------
// 表示の部品
// ---------------------------------------------------------------------------------------------

function Unregistered({ hint, action }: { hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[13px] text-[#86868b]">未登録</span>
      {hint && <span className="text-[11px] leading-4 text-[#86868b]">{hint}</span>}
      {action}
    </div>
  );
}

function SkeletonLines({ count = 2 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-1.5 py-1" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className={`h-3 animate-pulse rounded bg-[#ededf0] ${index === 0 ? "w-3/4" : "w-1/2"}`} />
      ))}
    </div>
  );
}

function ErrorLine({ text }: { text: string }) {
  return <p className="text-[12px] text-[#be123c]">{text}</p>;
}

function Meta({ children }: { children: ReactNode }) {
  return <span className="ml-1.5 text-[11px] text-[#6e6e73]">{children}</span>;
}

/** 小見出しと中身の行。スマホ幅では縦に積む。 */
function Pair({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[7.5em_minmax(0,1fr)] sm:gap-3">
      <dt className="text-[11px] leading-6 text-[#6e6e73]">{label}</dt>
      <dd className="min-w-0 break-words text-[13px] leading-6 text-[#1d1d1f]">{children}</dd>
    </div>
  );
}

function Missing({ text = "未登録" }: { text?: string }) {
  return <span className="text-[#86868b]">{text}</span>;
}

// ---------------------------------------------------------------------------------------------
// 画面
// ---------------------------------------------------------------------------------------------

export function ProjectOverviewFormat({ project, onSelectTab }: Props) {
  const projectId = project.projectId;
  const [overviewRes, setOverviewRes] = useState<ProjectOverviewResponse | null>(() => peekProjectOverview(projectId) ?? null);
  const [overviewError, setOverviewError] = useState("");
  const [tree, setTree] = useState<QuestionTreeBundle | null>(() => peekQuestionTree(projectId) ?? null);
  const [treeError, setTreeError] = useState("");
  const [season, setSeason] = useState<SeasonPlPayload | null>(() => peekSeasonBudget(projectId) ?? null);
  const [seasonError, setSeasonError] = useState("");
  const [editing, setEditing] = useState(false);
  const [metaVenture, setMetaVenture] = useState<ProjectVentureRow | null>(null);
  const [metaLoading, setMetaLoading] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    loadProjectOverview(projectId)
      .then((value) => !cancelled && setOverviewRes(value))
      .catch((cause) => !cancelled && setOverviewError(cause instanceof Error ? cause.message : "PJ概要を読み込めない"));
    loadQuestionTree(projectId)
      .then((value) => !cancelled && setTree(value))
      .catch((cause) => !cancelled && setTreeError(cause instanceof Error ? cause.message : "ゴールツリーを読み込めない"));
    loadSeasonBudget(projectId)
      .then((value) => !cancelled && setSeason(value))
      .catch((cause) => !cancelled && setSeasonError(cause instanceof Error ? cause.message : "収支を読み込めない"));
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const overview = overviewRes?.overview ?? null;
  const canEdit = Boolean(overviewRes?.viewer.canEdit);
  const today = localToday();

  const tabLink = (tab: CockpitTab, label: string) => (
    <button
      type="button"
      onClick={() => onSelectTab(tab)}
      className="min-h-[32px] self-start text-left text-[12px] font-medium text-[#0071e3] underline-offset-2 hover:underline"
    >
      {label} →
    </button>
  );

  async function openMetaEditor() {
    setMetaLoading(true);
    try {
      const bundle = await fetchVentureStatus(projectId);
      setMetaVenture(bundle.venture ?? null);
    } finally {
      setMetaLoading(false);
    }
  }

  // ---- PJの定義 ----------------------------------------------------------------------------

  const purposeBody = () => {
    if (!tree) return treeError ? <ErrorLine text={treeError} /> : <SkeletonLines />;
    const { accepted, proposed } = overviewPurpose(tree);
    if (accepted.length === 0 && proposed.length === 0) {
      return <Unregistered hint="ゴールツリーのいちばん上に到達点を書くと、ここに出る" action={tabLink("issues", "ゴールツリーを開く")} />;
    }
    return (
      <ul className="flex flex-col gap-1">
        {accepted.map((goal) => (
          <li key={goal.id} className="min-w-0 break-words">
            <span className="font-semibold">{goal.title}</span>
            <Meta>{goal.dueDate ? `期限 ${dateLabel(goal.dueDate)}` : "期限なし"}{goal.status === "answered" ? "・達成" : ""}</Meta>
          </li>
        ))}
        {proposed.map((goal) => (
          <li key={goal.id} className="min-w-0 break-words">
            <span className="mr-1.5 rounded border border-[#f5c26b] bg-[#fff7e6] px-1.5 py-0.5 text-[10px] font-semibold text-[#9a5b00]">承認待ち</span>
            <span>{goal.title}</span>
            {goal.dueDate && <Meta>期限 {dateLabel(goal.dueDate)}</Meta>}
          </li>
        ))}
      </ul>
    );
  };

  const counterpartBody = () => {
    if (!overview) return overviewError ? <ErrorLine text={overviewError} /> : <SkeletonLines count={3} />;
    const origin = overviewOrigin(overview);
    const lane = overview.venture?.lane ? VENTURE_LANE_LABELS[overview.venture.lane] ?? overview.venture.lane : null;
    return (
      <dl className="flex flex-col">
        <Pair label="契約先">{overview.identity.clientName || <Missing />}</Pair>
        <Pair label="出身">{origin.org ? `${origin.org}${origin.person ? `（${origin.person}）` : ""}` : origin.person || <Missing />}</Pair>
        <Pair label="元になる技術">{overview.seeds.length > 0 ? overview.seeds.map((seed) => seed.title).join("、") : <Missing />}</Pair>
        <Pair label="分野">{lane || <Missing />}</Pair>
      </dl>
    );
  };

  const involvementBody = () => {
    if (!overview) return overviewError ? <ErrorLine text={overviewError} /> : <SkeletonLines count={3} />;
    const category = overview.identity.projectCategory ? PROJECT_CATEGORY_LABELS[overview.identity.projectCategory] ?? overview.identity.projectCategory : null;
    const role = overview.venture?.amdRole ? AMD_ROLE_LABELS[overview.venture.amdRole] ?? overview.venture.amdRole : null;
    return (
      <dl className="flex flex-col">
        <Pair label="PJの種類">{category || <Missing />}</Pair>
        <Pair label="関わり方">{role || <Missing />}</Pair>
        <Pair label="補足">{overview.definition?.involvementNote || <Missing />}</Pair>
      </dl>
    );
  };

  const revenueBody = () => {
    if (!overview) return overviewError ? <ErrorLine text={overviewError} /> : <SkeletonLines />;
    const streams = overview.definition?.revenueStreams ?? [];
    if (streams.length === 0) {
      return <Unregistered hint="業務委託料・顧問料・成功報酬・株式など。管理者が「定義を直す」から書く" />;
    }
    return (
      <ul className="flex flex-col gap-1">
        {streams.map((stream, index) => (
          <li key={`${stream.kind}-${index}`} className="min-w-0 break-words">
            <span className="mr-2 inline-block rounded border border-[#d6d6da] bg-[#f5f5f7] px-1.5 py-0.5 text-[11px] font-semibold text-[#3c3c43]">
              {revenueKindLabel(stream.kind)}
            </span>
            {stream.note || <Missing text="（中身は未記入）" />}
          </li>
        ))}
      </ul>
    );
  };

  const teamBody = () => {
    if (!overview) return overviewError ? <ErrorLine text={overviewError} /> : <SkeletonLines count={3} />;
    const period = overviewPeriod(overview);
    const team = overviewTeam(overview.members);
    const roles = [
      team.pls.length > 0 ? `PL ${team.pls.join("、")}` : null,
      team.pms.length > 0 ? `PM ${team.pms.join("、")}` : null,
      team.closers.length > 0 ? `クローザー ${team.closers.join("、")}` : null,
    ].filter(Boolean);
    return (
      <dl className="flex flex-col">
        <Pair label="AMDが関わる期間">
          {period ? `${monthLabel(period.start)}〜${period.end ? monthLabel(period.end) : ""}` : <Missing />}
        </Pair>
        <Pair label="AMD側の担当">
          {roles.length > 0 || team.others.length > 0 ? (
            <>
              {roles.join("・")}
              {team.others.length > 0 && <span className="text-[#3c3c43]">{roles.length > 0 ? "・" : ""}メンバー {team.others.join("、")}</span>}
            </>
          ) : (
            <Missing />
          )}
        </Pair>
        <Pair label="先方の窓口">{overview.definition?.counterpartContacts || <Missing />}</Pair>
      </dl>
    );
  };

  // ---- 今の状態 ----------------------------------------------------------------------------

  const stageBody = () => {
    const stage = overview ? overviewStage(overview, today) : null;
    const milestone = tree ? overviewNextMilestone(tree, today) : null;
    return (
      <div className="flex flex-col gap-1">
        <dl className="flex flex-col">
          <Pair label="段階">{stage ? stage.outcome || <Missing /> : overviewError ? <ErrorLine text={overviewError} /> : <SkeletonLines count={1} />}</Pair>
          <Pair label="PJの状態">{stage ? stage.status || <Missing /> : <SkeletonLines count={1} />}</Pair>
          <Pair label="設立">
            {!stage ? (
              <SkeletonLines count={1} />
            ) : stage.founding.kind === "founded" ? (
              `設立済み${stage.founding.date ? `（${dateLabel(stage.founding.date)}）` : ""}`
            ) : stage.founding.kind === "planned" ? (
              `設立予定（${monthLabel(stage.founding.date)}）`
            ) : (
              <Missing />
            )}
          </Pair>
          <Pair label="次のMS">
            {!milestone ? (
              treeError ? <ErrorLine text={treeError} /> : <SkeletonLines count={1} />
            ) : milestone.next ? (
              <>
                {milestone.next.title}
                <Meta>期限 {dateLabel(milestone.next.dueDate)}</Meta>
              </>
            ) : milestone.total === 0 ? (
              <Missing text="未登録（ゴールツリーにMSが無い）" />
            ) : (
              <Missing text="今日より後の期限のMSは無い" />
            )}
            {milestone && milestone.overdue.length > 0 && (
              <span className="ml-1.5 text-[11px] font-semibold text-[#be123c]">期限切れ {milestone.overdue.length}件</span>
            )}
          </Pair>
        </dl>
        {tabLink("gantt", "ガントを開く")}
      </div>
    );
  };

  const contractBody = () => {
    const contracts = currentContracts(project);
    const seasonSummary = season ? overviewSeason(season.seasons, today.slice(0, 7).replace("-", "")) : null;
    return (
      <div className="flex flex-col gap-1">
        <dl className="flex flex-col">
          <Pair label="契約">
            {contracts.length === 0 ? (
              <Missing />
            ) : (
              <ul className="flex flex-col gap-0.5">
                {contracts.slice(0, 3).map((contract, index) => (
                  <li key={contract.contractId || `${contract.title}-${index}`} className="min-w-0 break-words">
                    {contract.title || "現行契約"}
                    <Meta>
                      {[
                        CONTRACT_TYPE_LABELS[contract.contractType || ""] || contract.contractType,
                        contract.counterpartyName,
                        contract.effectiveDate || contract.expirationDate
                          ? `${dateLabel(contract.effectiveDate) || "未確認"}〜${dateLabel(contract.expirationDate)}`
                          : null,
                        contractStatusLabel(contract.status),
                      ]
                        .filter(Boolean)
                        .join("・")}
                    </Meta>
                  </li>
                ))}
                {contracts.length > 3 && <li className="text-[11px] text-[#6e6e73]">ほか{contracts.length - 3}件</li>}
              </ul>
            )}
          </Pair>
          <Pair label="収支">
            {!season ? (
              seasonError ? <ErrorLine text={seasonError} /> : <SkeletonLines count={1} />
            ) : !seasonSummary ? (
              <Missing />
            ) : (
              <>
                {ymSlash(seasonSummary.periodStartYm)}〜{ymSlash(seasonSummary.periodEndYm)}
                <Meta>{seasonSummary.isCurrent ? "今のシーズン" : "直近のシーズン"}</Meta>
                <span className="block text-[12px] text-[#3c3c43]">
                  請求 {yen(seasonSummary.invoiceTotalYen)}・メンバー原資 {yen(seasonSummary.memberBudgetYen)} のうち消化 {Math.round(seasonSummary.consumedShare * 100)}%
                </span>
              </>
            )}
          </Pair>
        </dl>
        <div className="flex flex-wrap gap-x-4">
          {tabLink("project-contracts", "契約を開く")}
          {tabLink("project-finance", "収支を開く")}
        </div>
      </div>
    );
  };

  const openBody = () => {
    if (!tree) return treeError ? <ErrorLine text={treeError} /> : <SkeletonLines count={3} />;
    const open = overviewOpenItems(tree);
    return (
      <div className="flex flex-col gap-1">
        <dl className="flex flex-col">
          <Pair label="開いている論点">
            {open.openCount}件
            {open.overdueCount > 0 && <span className="ml-1.5 text-[11px] font-semibold text-[#be123c]">期限切れ {open.overdueCount}件</span>}
          </Pair>
          <Pair label="承認待ち">
            {open.proposalCount}件
            {open.proposalCount > 0 && <Meta>論点 {open.proposalQuestions}・TODO {open.proposalActions}</Meta>}
          </Pair>
        </dl>
        {open.top.length > 0 && (
          <ul className="mt-0.5 flex flex-col gap-0.5 border-l-2 border-[#e5e5e7] pl-2.5">
            {open.top.map((question) => (
              <li key={question.id} className="min-w-0 break-words text-[12px] leading-5 text-[#1d1d1f]">
                {question.title}
                {(question.nextDueDate || question.dueDate) && <Meta>期限 {dateLabel(question.nextDueDate || question.dueDate)}</Meta>}
              </li>
            ))}
          </ul>
        )}
        {tabLink("issues", "ゴールツリーを開く")}
      </div>
    );
  };

  const signalsBody = () => {
    if (!overview) return overviewError ? <ErrorLine text={overviewError} /> : <SkeletonLines count={3} />;
    return (
      <div className="flex flex-col gap-1">
        {overview.signals.length === 0 ? (
          <Unregistered hint="「動向・会議」で重要な動きを確かめると、ここに出る" />
        ) : (
          <ul className="flex flex-col gap-0.5">
            {overview.signals.map((signal) => (
              <li key={signal.id} className="min-w-0 break-words">
                <span className="mr-2 text-[11px] tabular-nums text-[#6e6e73]">{dateLabel(signal.date)}</span>
                {signal.title}
              </li>
            ))}
          </ul>
        )}
        {tabLink("meetings", "動向・会議を開く")}
      </div>
    );
  };

  const body: Record<ProjectOverviewSectionKey, () => ReactNode> = {
    purpose: purposeBody,
    counterpart: counterpartBody,
    involvement: involvementBody,
    revenue: revenueBody,
    team: teamBody,
    stage: stageBody,
    contract: contractBody,
    open: openBody,
    signals: signalsBody,
  };

  return (
    <div className="flex min-w-0 flex-col gap-3" data-testid="project-overview-format">
      {notice && (
        <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-800">
          {notice}
        </p>
      )}
      {PROJECT_OVERVIEW_GROUPS.map((group) => (
        <section
          key={group.key}
          data-overview-group={group.key}
          aria-label={group.label}
          className="overflow-hidden rounded-xl border border-[#e5e5e7] bg-white"
        >
          <header className="flex flex-col gap-2 border-b border-[#ededf0] px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-[14px] font-semibold text-[#1d1d1f]">{group.label}</h2>
              <p className="mt-0.5 text-[11px] leading-4 text-[#6e6e73]">
                {group.hint}
                {group.key === "definition" && overview?.definition?.updatedAt && `（最終更新 ${dateLabel(overview.definition.updatedAt)}）`}
              </p>
            </div>
            {group.key === "definition" && canEdit && (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" className="h-9" onClick={() => setEditing(true)} data-testid="project-overview-edit">
                  <Pencil />定義を直す
                </Button>
                {overview?.venture && (
                  <Button variant="outline" className="h-9" onClick={() => void openMetaEditor()} disabled={metaLoading}>
                    {metaLoading ? <Loader2 className="animate-spin" /> : <Pencil />}Venture Mapの分類を直す
                  </Button>
                )}
              </div>
            )}
          </header>
          <dl className="divide-y divide-[#f0f0f2]">
            {PROJECT_OVERVIEW_SECTIONS.filter((section) => section.group === group.key).map((section) => (
              <div
                key={section.key}
                data-overview-section={section.key}
                className="grid gap-1 px-4 py-3 sm:grid-cols-[10em_minmax(0,1fr)] sm:gap-4"
              >
                <dt className="text-[12px] font-semibold leading-6 text-[#3c3c43]">{section.label}</dt>
                <dd className="min-w-0 text-[13px] leading-6 text-[#1d1d1f]">{body[section.key]()}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}

      {editing && overview && (
        <ProjectDefinitionDialog
          initial={overview.definition}
          onClose={() => setEditing(false)}
          onSave={async (input) => {
            const saved = await saveProjectDefinition(projectId, input);
            setOverviewRes(saved);
            setEditing(false);
            setNotice("PJの定義を保存したよ");
            window.setTimeout(() => setNotice(""), 3200);
          }}
        />
      )}

      {metaVenture && (
        <CockpitVentureMetaEditModal
          venture={metaVenture}
          projectName={project.projectName}
          onClose={() => setMetaVenture(null)}
          onSaved={async () => {
            setMetaVenture(null);
            invalidateProjectOverview(projectId);
            setOverviewRes(await loadProjectOverview(projectId, { force: true }));
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// PJの定義を直す（管理者だけ）
// ---------------------------------------------------------------------------------------------

function ProjectDefinitionDialog({
  initial,
  onClose,
  onSave,
}: {
  initial: ProjectOverviewResponse["overview"]["definition"];
  onClose: () => void;
  onSave: (input: { involvementNote: string | null; revenueStreams: ProjectRevenueStream[]; counterpartContacts: string | null }) => Promise<void>;
}) {
  const [involvementNote, setInvolvementNote] = useState(initial?.involvementNote ?? "");
  const [streams, setStreams] = useState<ProjectRevenueStream[]>(initial?.revenueStreams ?? []);
  const [counterpartContacts, setCounterpartContacts] = useState(initial?.counterpartContacts ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSave({
        involvementNote: involvementNote.trim() || null,
        revenueStreams: streams.map((stream) => ({ kind: stream.kind, note: stream.note.trim() })),
        counterpartContacts: counterpartContacts.trim() || null,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存できなかったよ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:!max-w-2xl">
        <form onSubmit={(event) => void submit(event)}>
          <DialogHeader>
            <DialogTitle>PJの定義を直す</DialogTitle>
            <DialogDescription>
              PJを作るときに決める中身。金額・時期・進み具合は書かない（契約・収支・資本政策表・ゴールツリーから出る）。
            </DialogDescription>
          </DialogHeader>
          <div className="my-5 grid gap-5">
            <Field label="AMDの関わり方の補足" name="involvementNote" hint="例: NIMSの技術で、AMDが会社を創る">
              <Textarea id="involvementNote" value={involvementNote} onChange={(event) => setInvolvementNote(event.target.value)} rows={2} maxLength={600} />
            </Field>
            <fieldset className="space-y-2">
              <legend className="text-xs text-slate-700">AMDの報酬形態</legend>
              {streams.length === 0 && <p className="text-[12px] text-[#86868b]">まだ無い。「報酬形態を足す」から足す。</p>}
              {streams.map((stream, index) => (
                <div key={index} className="grid gap-2 sm:grid-cols-[11em_minmax(0,1fr)_auto]">
                  <Select
                    value={stream.kind}
                    onValueChange={(next) =>
                      setStreams((current) => current.map((item, i) => (i === index ? { ...item, kind: (next || item.kind) as AmdRevenueKindKey } : item)))
                    }
                  >
                    <SelectTrigger className="h-11 w-full bg-white" aria-label="報酬形態の種類"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {AMD_REVENUE_KINDS.map((kind) => (
                        <SelectItem key={kind.key} value={kind.key}>{kind.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={stream.note}
                    onChange={(event) => setStreams((current) => current.map((item, i) => (i === index ? { ...item, note: event.target.value } : item)))}
                    placeholder="例: NIMSからの事業化支援の業務委託"
                    aria-label="報酬形態の中身"
                    maxLength={300}
                    className="h-11"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11"
                    onClick={() => setStreams((current) => current.filter((_, i) => i !== index))}
                    aria-label="この報酬形態を消す"
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                className="h-10"
                onClick={() => setStreams((current) => [...current, { kind: "contract_fee", note: "" }])}
                disabled={streams.length >= 12}
              >
                <Plus />報酬形態を足す
              </Button>
            </fieldset>
            <Field label="先方の窓口" name="counterpartContacts" hint="誰が、どの立場で窓口か">
              <Textarea id="counterpartContacts" value={counterpartContacts} onChange={(event) => setCounterpartContacts(event.target.value)} rows={2} maxLength={600} />
            </Field>
            {error && <p role="alert" className="text-[12px] text-[#be123c]">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" className="h-11" onClick={onClose}>閉じる</Button>
            <Button type="submit" className="h-11" disabled={saving}>{saving && <Loader2 className="animate-spin" />}保存</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
