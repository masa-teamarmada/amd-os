"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  fetchWorkDeskBundle,
  updateWorkCase,
  updateWorkCaseDeadlineStatus,
  insertWorkCaseDeadline,
  type WorkDeskBundle,
  type WorkspaceWorkCase,
  type WorkspaceWorkCaseDeadline,
  type WorkDeskDataStatus,
  type WorkDeskDeadlineStatus,
  type WorkDeskDeadlinePrecision,
  type WorkCaseEditableFields,
  type NewWorkCaseDeadline,
} from "@/lib/workspace-work-desk-data";

type LoadingState = "loading" | "ready" | "empty" | "error";

const SOURCE_NOTE =
  "初期データ: 石原_業務一覧_研究開発OS用_1.xlsx（2026-06末版スナップショット）。現況確認前の情報を含む";

const DATA_STATUS_LABEL: Record<WorkDeskDataStatus, string> = {
  unconfirmed: "未確認",
  confirmed: "確認済み",
  stale: "要再確認",
};

const DATA_STATUS_CLASS: Record<WorkDeskDataStatus, string> = {
  unconfirmed: "bg-amber-50 text-amber-800 border-amber-300",
  confirmed: "bg-emerald-50 text-emerald-800 border-emerald-300",
  stale: "bg-slate-100 text-slate-600 border-slate-300",
};

const WAVE_LABEL: Record<number, string> = {
  1: "第1波・締切駆動",
  2: "第2波・定常",
  3: "第3波・UA室横断",
};

const WAVE_CLASS: Record<number, string> = {
  1: "bg-sky-50 text-sky-800 border-sky-300",
  2: "bg-slate-100 text-slate-600 border-slate-300",
  3: "bg-violet-50 text-violet-800 border-violet-300",
};

const DEADLINE_STATUS_LABEL: Record<WorkDeskDeadlineStatus, string> = {
  unconfirmed: "未確認",
  upcoming: "予定",
  done: "完了",
  passed: "期日経過",
  cancelled: "取消",
};

const DEADLINE_STATUS_OPTIONS: WorkDeskDeadlineStatus[] = [
  "unconfirmed",
  "upcoming",
  "done",
  "passed",
  "cancelled",
];

const DUE_PRECISION_OPTIONS: Array<{ value: WorkDeskDeadlinePrecision; label: string }> = [
  { value: "day", label: "日まで確定" },
  { value: "month", label: "月のみ確定" },
  { value: "vague", label: "未確認" },
];

function todayJstStr(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function formatDueDate(dueDate: string | null, precision: WorkDeskDeadlinePrecision): string {
  if (precision === "vague" || !dueDate) return "期日未確認";
  if (precision === "month") {
    const [year, month] = dueDate.split("-");
    if (!year || !month) return "期日未確認";
    return `${year}年${Number(month)}月（月のみ確定）`;
  }
  return dueDate;
}

/**
 * 期日経過・未解決判定。
 * due_precision='month' は月初日(1日)がDBの技術的な代表値であり、
 * 実際の期日は月内のどこかにある (migration 271の規約)。
 * 「当月中はまだ期日経過と断定しない」ため、month精度は年月単位で比較する
 * (確定日に丸めない規律を判定ロジックにも適用する)。
 */
function isOverdueUnresolved(deadline: WorkspaceWorkCaseDeadline, today: string): boolean {
  if (!deadline.dueDate) return false;
  if (deadline.status !== "unconfirmed" && deadline.status !== "upcoming") return false;
  if (deadline.duePrecision === "month") {
    return deadline.dueDate.slice(0, 7) < today.slice(0, 7);
  }
  if (deadline.duePrecision === "vague") return false;
  return deadline.dueDate < today;
}

function deadlineBadge(deadline: WorkspaceWorkCaseDeadline, today: string): { label: string; className: string } {
  if (isOverdueUnresolved(deadline, today)) {
    return { label: "期日経過・状況未確認", className: "bg-amber-50 text-amber-800 border-amber-300" };
  }
  if (deadline.status === "done") return { label: "完了", className: "bg-emerald-50 text-emerald-800 border-emerald-300" };
  if (deadline.status === "cancelled") return { label: "取消", className: "bg-slate-100 text-slate-500 border-slate-300" };
  if (deadline.status === "passed") return { label: "期日経過", className: "bg-amber-50 text-amber-800 border-amber-300" };
  if (deadline.status === "upcoming") return { label: "予定", className: "bg-sky-50 text-sky-800 border-sky-300" };
  return { label: "未確認", className: "bg-slate-100 text-slate-600 border-slate-300" };
}

export default function InstitutionWorkDeskPage() {
  const params = useParams<{ institutionId: string }>();
  const institutionId = params.institutionId;

  const [state, setState] = useState<LoadingState>("loading");
  const [bundle, setBundle] = useState<WorkDeskBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedCaseId, setExpandedCaseId] = useState<string | null>(null);
  const today = useMemo(() => todayJstStr(), []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState("loading");
      setError(null);
      try {
        const next = await fetchWorkDeskBundle(institutionId);
        if (cancelled) return;
        if (!next) {
          setBundle(null);
          setState("empty");
          return;
        }
        setBundle(next);
        setState("ready");
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "データ取得に失敗しました。");
        setState("error");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [institutionId]);

  async function handleDeadlineStatusChange(deadlineId: string, status: WorkDeskDeadlineStatus) {
    setBundle((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        deadlines: prev.deadlines.map((d) => (d.id === deadlineId ? { ...d, status } : d)),
      };
    });
    try {
      await updateWorkCaseDeadlineStatus(deadlineId, status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "締切状態の更新に失敗しました。");
    }
  }

  async function handleSaveCase(caseId: string, patch: Partial<WorkCaseEditableFields>) {
    await updateWorkCase(caseId, patch);
    setBundle((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        cases: prev.cases.map((c) => {
          if (c.id !== caseId) return c;
          const merged: WorkspaceWorkCase = { ...c, ...patch };
          if (
            patch.dataStatus === "confirmed" &&
            !patch.lastConfirmedAt &&
            !c.lastConfirmedAt
          ) {
            merged.lastConfirmedAt = today;
          }
          return merged;
        }),
      };
    });
  }

  async function handleAddDeadline(caseId: string, input: NewWorkCaseDeadline) {
    const created = await insertWorkCaseDeadline(caseId, input);
    setBundle((prev) => {
      if (!prev) return prev;
      const nextDeadlines = [...prev.deadlines, created].sort((a, b) => {
        if (a.dueDate === b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      });
      return { ...prev, deadlines: nextDeadlines };
    });
  }

  if (state === "loading") {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="space-y-2 text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">業務デスクを読み込み中...</p>
        </div>
      </div>
    );
  }

  if (state === "empty") {
    return (
      <div className="p-6 space-y-3">
        <p className="text-sm text-muted-foreground">この機関にはワークスペースがありません。</p>
        <Link href={`/institutions/${institutionId}`} className="text-sm text-primary hover:underline">
          機関詳細へ戻る
        </Link>
      </div>
    );
  }

  if (state === "error" || !bundle) {
    return (
      <div className="p-6 space-y-3">
        <p className="text-sm text-destructive">{error || "業務デスクの読み込みに失敗しました。"}</p>
        <Link href={`/institutions/${institutionId}`} className="text-sm text-primary hover:underline">
          機関詳細へ戻る
        </Link>
      </div>
    );
  }

  const activeCases = bundle.cases.filter((c) => !c.archivedAt);
  const activeCaseIds = new Set(activeCases.map((c) => c.id));
  const radarDeadlines = bundle.deadlines.filter((d) => activeCaseIds.has(d.caseId));
  const caseById = new Map(activeCases.map((c) => [c.id, c]));

  const unconfirmedCount = activeCases.filter((c) => c.dataStatus === "unconfirmed").length;
  const overdueCount = radarDeadlines.filter((d) => isOverdueUnresolved(d, today)).length;
  const waitingCases = activeCases.filter((c) => c.waitingOn && c.waitingOn.trim() !== "");

  const domainGroups: Array<[string, WorkspaceWorkCase[]]> = [];
  for (const c of activeCases) {
    const group = domainGroups.find(([domain]) => domain === c.domain);
    if (group) group[1].push(c);
    else domainGroups.push([c.domain, [c]]);
  }

  return (
    <div className="p-4 max-w-[1400px] mx-auto space-y-4">
      <header className="rounded-xl border border-border bg-white px-4 py-4 space-y-1">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">業務デスク</h1>
            <p className="text-sm text-foreground mt-1">{bundle.workspace.name}</p>
          </div>
          <div className="flex gap-2 shrink-0 flex-wrap justify-end">
            <Link
              href={`/institutions/${institutionId}/cockpit`}
              className="text-xs rounded-md border border-border bg-white px-3 py-1.5 hover:bg-muted/40"
            >
              研究機関コックピット
            </Link>
            <Link
              href={`/institutions/${institutionId}`}
              className="text-xs rounded-md border border-border bg-white px-3 py-1.5 hover:bg-muted/40"
            >
              ECR詳細
            </Link>
          </div>
        </div>
      </header>

      <WorkDeskSummary
        totalCases={activeCases.length}
        unconfirmedCount={unconfirmedCount}
        overdueCount={overdueCount}
        waitingCount={waitingCases.length}
      />

      <DeadlineRadar deadlines={radarDeadlines} caseById={caseById} today={today} onStatusChange={handleDeadlineStatusChange} />

      <StuckCasesSection cases={waitingCases} />

      <PortfolioSection
        domainGroups={domainGroups}
        deadlinesByCaseId={groupDeadlinesByCase(radarDeadlines)}
        expandedCaseId={expandedCaseId}
        onToggle={(caseId) => setExpandedCaseId((prev) => (prev === caseId ? null : caseId))}
        onSaveCase={handleSaveCase}
        onDeadlineStatusChange={handleDeadlineStatusChange}
        onAddDeadline={handleAddDeadline}
        today={today}
      />
    </div>
  );
}

function groupDeadlinesByCase(deadlines: WorkspaceWorkCaseDeadline[]): Map<string, WorkspaceWorkCaseDeadline[]> {
  const map = new Map<string, WorkspaceWorkCaseDeadline[]>();
  for (const d of deadlines) {
    map.set(d.caseId, [...(map.get(d.caseId) ?? []), d]);
  }
  return map;
}

function WorkDeskSummary({
  totalCases,
  unconfirmedCount,
  overdueCount,
  waitingCount,
}: {
  totalCases: number;
  unconfirmedCount: number;
  overdueCount: number;
  waitingCount: number;
}) {
  const metrics = [
    { label: "総ケース数", value: `${totalCases}件` },
    { label: "未確認", value: `${unconfirmedCount}件` },
    { label: "期日経過候補", value: `${overdueCount}件` },
    { label: "止まりもの", value: `${waitingCount}件` },
  ];
  return (
    <section className="rounded-xl border border-border bg-white px-4 py-3 space-y-2">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-lg border border-border bg-muted/20 px-3 py-2 min-w-0">
            <div className="text-[10px] font-mono uppercase text-muted-foreground">{m.label}</div>
            <div className="text-lg font-bold truncate">{m.value}</div>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground">{SOURCE_NOTE}</p>
    </section>
  );
}

function DeadlineRadar({
  deadlines,
  caseById,
  today,
  onStatusChange,
}: {
  deadlines: WorkspaceWorkCaseDeadline[];
  caseById: Map<string, WorkspaceWorkCase>;
  today: string;
  onStatusChange: (deadlineId: string, status: WorkDeskDeadlineStatus) => Promise<void>;
}) {
  return (
    <section className="rounded-xl border border-border bg-white px-4 py-3 space-y-1">
      <div>
        <h2 className="text-sm font-semibold">期限レーダー</h2>
        <p className="text-xs text-muted-foreground mt-0.5">全業務の締切を期日順に並べる。「遅延」は断定せず、未確認は「期日経過・状況未確認」と表示する。</p>
      </div>
      {deadlines.length === 0 ? (
        <div className="mt-2 rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
          登録された締切はありません。
        </div>
      ) : (
        <div className="mt-2 divide-y divide-border/60">
          {deadlines.map((deadline) => {
            const work = caseById.get(deadline.caseId);
            const badge = deadlineBadge(deadline, today);
            return (
              <div key={deadline.id} className="grid grid-cols-1 sm:grid-cols-[130px_minmax(0,1fr)_140px_170px] gap-x-3 gap-y-1 items-center py-2 text-xs">
                <div className="font-mono text-muted-foreground">{formatDueDate(deadline.dueDate, deadline.duePrecision)}</div>
                <div className="min-w-0">
                  <span className="font-medium">{work ? `${work.caseCode} ${work.title}` : "(ケース不明)"}</span>
                  <span className="text-muted-foreground ml-1">/ {deadline.label}</span>
                </div>
                <span className={`justify-self-start rounded border px-1.5 py-0.5 text-[10px] ${badge.className}`}>{badge.label}</span>
                <select
                  value={deadline.status}
                  onChange={(e) => onStatusChange(deadline.id, e.target.value as WorkDeskDeadlineStatus)}
                  className="h-7 rounded border border-border bg-white px-1.5 text-[11px]"
                >
                  {DEADLINE_STATUS_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {DEADLINE_STATUS_LABEL[opt]}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function StuckCasesSection({ cases }: { cases: WorkspaceWorkCase[] }) {
  return (
    <section className="rounded-xl border border-border bg-white px-4 py-3 space-y-1">
      <h2 className="text-sm font-semibold">止まりもの（待ち先）</h2>
      {cases.length === 0 ? (
        <div className="mt-2 rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
          登録された止まりものはありません。現況確認で待ち先が判明したらケース編集から登録します。
        </div>
      ) : (
        <div className="mt-2 divide-y divide-border/60">
          {cases.map((c) => (
            <div key={c.id} className="py-2 text-xs">
              <div className="font-medium">
                {c.caseCode} {c.title}
              </div>
              <div className="text-muted-foreground mt-0.5">
                待ち先: {c.waitingOn}
                {c.waitingSince ? `（${c.waitingSince}〜）` : ""}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function PortfolioSection({
  domainGroups,
  deadlinesByCaseId,
  expandedCaseId,
  onToggle,
  onSaveCase,
  onDeadlineStatusChange,
  onAddDeadline,
  today,
}: {
  domainGroups: Array<[string, WorkspaceWorkCase[]]>;
  deadlinesByCaseId: Map<string, WorkspaceWorkCaseDeadline[]>;
  expandedCaseId: string | null;
  onToggle: (caseId: string) => void;
  onSaveCase: (caseId: string, patch: Partial<WorkCaseEditableFields>) => Promise<void>;
  onDeadlineStatusChange: (deadlineId: string, status: WorkDeskDeadlineStatus) => Promise<void>;
  onAddDeadline: (caseId: string, input: NewWorkCaseDeadline) => Promise<void>;
  today: string;
}) {
  return (
    <section className="rounded-xl border border-border bg-white px-4 py-3 space-y-4">
      <div>
        <h2 className="text-sm font-semibold">領域別ポートフォリオ</h2>
        <p className="text-xs text-muted-foreground mt-0.5">行をクリックすると次アクション・待ち先・データ状態を編集できる。</p>
      </div>

      {domainGroups.map(([domain, cases]) => (
        <div key={domain} className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground">{domain}</h3>

          {/* desktop table */}
          <div className="hidden md:block overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-left">
                <tr>
                  <th className="px-2 py-2 font-medium">code</th>
                  <th className="px-2 py-2 font-medium">業務名</th>
                  <th className="px-2 py-2 font-medium">種別</th>
                  <th className="px-2 py-2 font-medium">状態</th>
                  <th className="px-2 py-2 font-medium">頻度・締切</th>
                  <th className="px-2 py-2 font-medium">関係者</th>
                  <th className="px-2 py-2 font-medium">次アクション</th>
                  <th className="px-2 py-2 font-medium">波</th>
                  <th className="px-2 py-2 font-medium">データ状態</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((c) => (
                  <PortfolioRow
                    key={c.id}
                    work={c}
                    deadlines={deadlinesByCaseId.get(c.id) ?? []}
                    expanded={expandedCaseId === c.id}
                    onToggle={() => onToggle(c.id)}
                    onSaveCase={onSaveCase}
                    onDeadlineStatusChange={onDeadlineStatusChange}
                    onAddDeadline={onAddDeadline}
                    today={today}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* mobile cards */}
          <div className="md:hidden space-y-2">
            {cases.map((c) => (
              <PortfolioCard
                key={c.id}
                work={c}
                deadlines={deadlinesByCaseId.get(c.id) ?? []}
                expanded={expandedCaseId === c.id}
                onToggle={() => onToggle(c.id)}
                onSaveCase={onSaveCase}
                onDeadlineStatusChange={onDeadlineStatusChange}
                onAddDeadline={onAddDeadline}
                today={today}
              />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

type PortfolioRowProps = {
  work: WorkspaceWorkCase;
  deadlines: WorkspaceWorkCaseDeadline[];
  expanded: boolean;
  onToggle: () => void;
  onSaveCase: (caseId: string, patch: Partial<WorkCaseEditableFields>) => Promise<void>;
  onDeadlineStatusChange: (deadlineId: string, status: WorkDeskDeadlineStatus) => Promise<void>;
  onAddDeadline: (caseId: string, input: NewWorkCaseDeadline) => Promise<void>;
  today: string;
};

function WaveChip({ wave }: { wave: number | null }) {
  if (wave == null || !WAVE_LABEL[wave]) {
    return <span className="rounded border px-1.5 py-0.5 text-[10px] bg-slate-50 text-slate-500 border-slate-300">波未設定</span>;
  }
  return <span className={`rounded border px-1.5 py-0.5 text-[10px] ${WAVE_CLASS[wave]}`}>{WAVE_LABEL[wave]}</span>;
}

function DataStatusChip({ status }: { status: WorkDeskDataStatus }) {
  return <span className={`rounded border px-1.5 py-0.5 text-[10px] ${DATA_STATUS_CLASS[status]}`}>{DATA_STATUS_LABEL[status]}</span>;
}

function PortfolioRow({ work, deadlines, expanded, onToggle, onSaveCase, onDeadlineStatusChange, onAddDeadline, today }: PortfolioRowProps) {
  return (
    <>
      <tr className="border-t border-border cursor-pointer hover:bg-muted/20" onClick={onToggle}>
        <td className="px-2 py-2 whitespace-nowrap font-mono">{work.caseCode}</td>
        <td className="px-2 py-2 max-w-[220px]">
          <div className="font-medium truncate">{work.title}</div>
        </td>
        <td className="px-2 py-2 whitespace-nowrap text-muted-foreground">{work.caseKind ?? "—"}</td>
        <td className="px-2 py-2 whitespace-nowrap text-muted-foreground">{work.statusLabel ?? "—"}</td>
        <td className="px-2 py-2 max-w-[200px]">
          <div className="text-muted-foreground truncate">{work.frequencyDeadlineNote ?? "—"}</div>
        </td>
        <td className="px-2 py-2 max-w-[160px]">
          <div className="text-muted-foreground truncate">{work.stakeholders ?? "—"}</div>
        </td>
        <td className="px-2 py-2 max-w-[200px]">
          <div className="text-muted-foreground truncate">{work.nextAction ?? "未設定"}</div>
        </td>
        <td className="px-2 py-2 whitespace-nowrap">
          <WaveChip wave={work.priorityWave} />
        </td>
        <td className="px-2 py-2 whitespace-nowrap">
          <DataStatusChip status={work.dataStatus} />
        </td>
      </tr>
      {expanded && (
        <tr className="border-t border-border bg-muted/10">
          <td colSpan={9} className="px-3 py-3">
            <CaseEditForm
              key={work.id}
              work={work}
              deadlines={deadlines}
              onSaveCase={onSaveCase}
              onDeadlineStatusChange={onDeadlineStatusChange}
              onAddDeadline={onAddDeadline}
              today={today}
            />
          </td>
        </tr>
      )}
    </>
  );
}

function PortfolioCard({ work, deadlines, expanded, onToggle, onSaveCase, onDeadlineStatusChange, onAddDeadline, today }: PortfolioRowProps) {
  return (
    <div className="rounded-lg border border-border bg-white">
      <button type="button" onClick={onToggle} className="w-full text-left px-3 py-2 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[10px] font-mono text-muted-foreground">{work.caseCode}</div>
            <div className="text-sm font-medium truncate">{work.title}</div>
          </div>
          <DataStatusChip status={work.dataStatus} />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <WaveChip wave={work.priorityWave} />
          {work.statusLabel && <span className="text-[10px] text-muted-foreground">{work.statusLabel}</span>}
        </div>
        <div className="text-xs text-muted-foreground">次アクション: {work.nextAction ?? "未設定"}</div>
      </button>
      {expanded && (
        <div className="border-t border-border px-3 py-3">
          <CaseEditForm
            key={work.id}
            work={work}
            deadlines={deadlines}
            onSaveCase={onSaveCase}
            onDeadlineStatusChange={onDeadlineStatusChange}
            onAddDeadline={onAddDeadline}
            today={today}
          />
        </div>
      )}
    </div>
  );
}

function CaseEditForm({
  work,
  deadlines,
  onSaveCase,
  onDeadlineStatusChange,
  onAddDeadline,
  today,
}: {
  work: WorkspaceWorkCase;
  deadlines: WorkspaceWorkCaseDeadline[];
  onSaveCase: (caseId: string, patch: Partial<WorkCaseEditableFields>) => Promise<void>;
  onDeadlineStatusChange: (deadlineId: string, status: WorkDeskDeadlineStatus) => Promise<void>;
  onAddDeadline: (caseId: string, input: NewWorkCaseDeadline) => Promise<void>;
  today: string;
}) {
  const [nextAction, setNextAction] = useState(work.nextAction ?? "");
  const [waitingOn, setWaitingOn] = useState(work.waitingOn ?? "");
  const [waitingSince, setWaitingSince] = useState(work.waitingSince ?? "");
  const [notes, setNotes] = useState(work.notes ?? "");
  const [dataStatus, setDataStatus] = useState<WorkDeskDataStatus>(work.dataStatus);
  const [lastConfirmedAt, setLastConfirmedAt] = useState(work.lastConfirmedAt ?? "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [newLabel, setNewLabel] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newPrecision, setNewPrecision] = useState<WorkDeskDeadlinePrecision>("day");
  const [addingDeadline, setAddingDeadline] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      await onSaveCase(work.id, {
        nextAction,
        waitingOn,
        waitingSince: waitingSince || null,
        notes,
        dataStatus,
        lastConfirmedAt: lastConfirmedAt || null,
      });
      if (dataStatus === "confirmed" && !lastConfirmedAt) {
        setLastConfirmedAt(today);
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "保存に失敗しました。");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddDeadline() {
    if (!newLabel.trim()) {
      setAddError("締切名を入力してください。");
      return;
    }
    setAddingDeadline(true);
    setAddError(null);
    try {
      await onAddDeadline(work.id, {
        label: newLabel.trim(),
        dueDate: newPrecision === "vague" ? null : newDueDate || null,
        duePrecision: newPrecision,
      });
      setNewLabel("");
      setNewDueDate("");
      setNewPrecision("day");
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "締切の追加に失敗しました。");
    } finally {
      setAddingDeadline(false);
    }
  }

  return (
    <div className="space-y-4">
      {work.sourceNote && <p className="text-[10px] text-muted-foreground">出典: {work.sourceNote}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block space-y-1">
          <span className="text-[10px] font-semibold text-muted-foreground">次アクション</span>
          <input className="i" value={nextAction} onChange={(e) => setNextAction(e.target.value)} />
        </label>
        <label className="block space-y-1">
          <span className="text-[10px] font-semibold text-muted-foreground">待ち先（waiting_on）</span>
          <input className="i" value={waitingOn} onChange={(e) => setWaitingOn(e.target.value)} />
        </label>
        <label className="block space-y-1">
          <span className="text-[10px] font-semibold text-muted-foreground">待ち開始日</span>
          <input type="date" className="i" value={waitingSince} onChange={(e) => setWaitingSince(e.target.value)} />
        </label>
        <label className="block space-y-1">
          <span className="text-[10px] font-semibold text-muted-foreground">データ状態</span>
          <select className="i" value={dataStatus} onChange={(e) => setDataStatus(e.target.value as WorkDeskDataStatus)}>
            {(Object.keys(DATA_STATUS_LABEL) as WorkDeskDataStatus[]).map((s) => (
              <option key={s} value={s}>
                {DATA_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-[10px] font-semibold text-muted-foreground">最終確認日</span>
          <input type="date" className="i" value={lastConfirmedAt} onChange={(e) => setLastConfirmedAt(e.target.value)} />
        </label>
        <label className="block space-y-1 sm:col-span-2">
          <span className="text-[10px] font-semibold text-muted-foreground">メモ</span>
          <textarea className="i min-h-[60px]" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="text-xs rounded-md border border-primary/40 bg-primary/5 px-3 py-1.5 text-primary hover:bg-primary/10 disabled:opacity-50"
        >
          {saving ? "保存中..." : "保存"}
        </button>
        {saveError && <span className="text-xs text-destructive">{saveError}</span>}
      </div>

      <div className="border-t border-border pt-3 space-y-2">
        <div className="text-[10px] font-semibold text-muted-foreground">この業務の締切</div>
        {deadlines.length === 0 ? (
          <p className="text-xs text-muted-foreground">登録された締切はありません。</p>
        ) : (
          <div className="divide-y divide-border/60">
            {deadlines.map((d) => {
              const badge = deadlineBadge(d, today);
              return (
                <div key={d.id} className="grid grid-cols-1 sm:grid-cols-[110px_minmax(0,1fr)_140px_120px] gap-x-3 gap-y-1 items-center py-1.5 text-xs">
                  <div className="font-mono text-muted-foreground">{formatDueDate(d.dueDate, d.duePrecision)}</div>
                  <div className="min-w-0 truncate">{d.label}</div>
                  <span className={`justify-self-start rounded border px-1.5 py-0.5 text-[10px] ${badge.className}`}>{badge.label}</span>
                  <select
                    value={d.status}
                    onChange={(e) => onDeadlineStatusChange(d.id, e.target.value as WorkDeskDeadlineStatus)}
                    className="h-7 rounded border border-border bg-white px-1.5 text-[11px]"
                  >
                    {DEADLINE_STATUS_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {DEADLINE_STATUS_LABEL[opt]}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_140px_140px_auto] gap-2 items-end pt-2">
          <label className="block space-y-1">
            <span className="text-[10px] font-semibold text-muted-foreground">締切名</span>
            <input className="i" placeholder="例: 募集締切" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
          </label>
          <label className="block space-y-1">
            <span className="text-[10px] font-semibold text-muted-foreground">期日</span>
            <input
              type="date"
              className="i"
              value={newDueDate}
              onChange={(e) => setNewDueDate(e.target.value)}
              disabled={newPrecision === "vague"}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[10px] font-semibold text-muted-foreground">精度</span>
            <select className="i" value={newPrecision} onChange={(e) => setNewPrecision(e.target.value as WorkDeskDeadlinePrecision)}>
              {DUE_PRECISION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={handleAddDeadline}
            disabled={addingDeadline}
            className="text-xs rounded-md border border-border bg-white px-3 py-1.5 hover:bg-muted/40 disabled:opacity-50 h-[30px]"
          >
            {addingDeadline ? "追加中..." : "締切を追加"}
          </button>
        </div>
        {addError && <p className="text-xs text-destructive">{addError}</p>}
      </div>
    </div>
  );
}
