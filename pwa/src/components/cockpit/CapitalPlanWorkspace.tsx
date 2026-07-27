"use client";

// 資本政策の編集ワークスペース。編集内容はそのまま保存済みプランとして扱われ、
// deriveCapitalPlan があらゆる編集の直後に必ず全体へ再適用する唯一の計算経路となる。
// プランはそのまま次の編集の起点であり、freeze だけが「確定版」を切り出す操作。

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type CapitalEvent,
  type CapitalEventType,
  type CapitalPlan,
  type CalculationBasis,
  type EditableValue,
  type EventAllocation,
  type Holder,
  type HolderKind,
  type ShareClass,
  type ValidationIssue,
  type CapitalEventStatus,
  checkPublishEligibility,
  editableValue,
  overrideValue,
  recalculateCapTable,
  resolvedValue,
  safeDeriveCapitalPlan,
} from "@/lib/capital-plan";
import { createCapitalPlanXlsx, type FrozenCapitalPlanVersion } from "@/lib/capital-plan-xlsx";
import {
  createCapitalPlanDocumentFromCompanyOverview,
  createStandardIpoCapitalPlanDocument,
} from "@/lib/capital-plan-presets";
import type { CompanyOverviewData } from "@/lib/company-overview";
import { CapitalPlanMatrix } from "./CapitalPlanMatrix";

// ---------------------------------------------------------------------------
// Types mirroring the API rows
// ---------------------------------------------------------------------------

interface PlanRow {
  id: string;
  project_id: string;
  name: string;
  status: "active" | "archived";
  revision: number;
  document_json: { holders?: Holder[]; events?: CapitalEvent[] };
  created_by_email: string;
  updated_by_email: string;
  created_at: string;
  updated_at: string;
  latest_frozen_version?: number | null;
}

interface VersionRow {
  id: string;
  plan_id: string;
  project_id: string;
  version: number;
  document_json: { holders?: Holder[]; events?: CapitalEvent[] };
  source_revision: number;
  validation_summary: { blockingIssues?: ValidationIssue[]; warnings?: ValidationIssue[] };
  published_by_email: string;
  published_at: string;
}

interface CapitalPlanWorkspaceProps {
  projectId: string;
  projectName: string;
  companyOverviewData?: CompanyOverviewData;
}

const EVENT_TYPE_LABEL: Record<CapitalEventType, string> = {
  incorporation: "設立",
  equity_issue: "増資",
  option_pool: "オプションプール",
  convertible_issue: "転換前証券発行",
  convertible_conversion: "転換",
  secondary: "セカンダリ譲渡",
  share_split: "株式分割",
  ipo: "IPO",
};

const CALCULATION_BASIS_LABEL: Record<CalculationBasis, string> = {
  valuation_and_investment: "評価額×投資額",
  price_and_shares: "単価×株数",
  ownership_target: "目標保有比率",
  manual: "手動（自動計算なし）",
};

const HOLDER_KIND_LABEL: Record<HolderKind, string> = {
  founder: "創業者",
  employee: "従業員",
  investor: "投資家",
  esop_pool: "ESOPプール",
  advisor: "アドバイザー",
  other: "その他",
};

const EVENT_STATUS_LABEL: Record<CapitalEventStatus, string> = {
  confirmed: "確定履歴",
  planned: "将来計画",
};

function eventStatusOf(event: CapitalEvent): CapitalEventStatus {
  return event.status ?? "confirmed";
}

const SHARE_CLASS_LABEL: Record<ShareClass, string> = {
  common: "普通株",
  preferred: "優先株",
  option: "新株予約権",
  convertible: "転換社債等",
  warrant: "ワラント",
};

const DIRECT_EDIT_SUPPORTED_EVENT_TYPES: CapitalEventType[] = [
  "incorporation",
  "equity_issue",
  "option_pool",
  "convertible_conversion",
  "ipo",
];

const DIRECT_EDIT_UNSUPPORTED_MESSAGE =
  "このイベント種別（セカンダリ譲渡・株式分割・転換前証券発行）は、イベント後FD構成の直接編集に対応していません。株数・持分の変化は個別の割当編集で調整してください。";

const FINANCING_EVENT_TYPES: CapitalEventType[] = ["equity_issue", "convertible_conversion", "ipo"];

function genId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 6)}`;
}

function emptyPlan(id: string, name: string): CapitalPlan {
  return { id, name, holders: [], events: [] };
}

function fmtYen(n: number | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

function fmtShares(n: number | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  return Math.round(n).toLocaleString("ja-JP");
}

function TableNumberInput({
  ev,
  onChange,
  step,
  ariaLabel,
}: {
  ev: EditableValue | undefined;
  onChange: (next: EditableValue | undefined) => void;
  step?: number;
  ariaLabel: string;
}) {
  const value = ev ? ev.value : "";
  const isOverride = ev?.source === "override";
  return (
    <input
      type="number"
      inputMode="decimal"
      step={step ?? "any"}
      value={value}
      aria-label={ariaLabel}
      title={
        isOverride && ev?.calculatedValue != null
          ? `上書き（計算値 ${Math.round(ev.calculatedValue).toLocaleString("ja-JP")}）`
          : undefined
      }
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === "") {
          onChange(undefined);
          return;
        }
        const num = Number(raw);
        if (!Number.isFinite(num)) return;
        if (ev && ev.source === "override") {
          onChange({ ...ev, value: num });
        } else if (ev && (ev.source === "calculated" || ev.source === "imported" || ev.source === "confirmed")) {
          onChange(overrideValue(ev.value, num));
        } else {
          onChange(editableValue(num, ev?.source ?? "input"));
        }
      }}
      className={`min-h-[44px] w-full min-w-0 rounded-md border px-2 py-2 text-sm tabular-nums focus:outline-none ${
        isOverride ? "border-amber-300 bg-amber-50 focus:border-amber-500" : "border-zinc-300 focus:border-zinc-500"
      }`}
    />
  );
}

// Scales an EditableValue's value/calculatedValue by `factor`, preserving source/note.
// Used to bridge stored ratios (0.2) to the percentage units (20) shown in TableNumberInput.
function scaleEditableValue(ev: EditableValue | undefined, factor: number): EditableValue | undefined {
  if (!ev) return undefined;
  return {
    ...ev,
    value: ev.value * factor,
    calculatedValue: ev.calculatedValue != null ? ev.calculatedValue * factor : ev.calculatedValue,
  };
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function CapitalPlanWorkspace({ projectId, projectName, companyOverviewData }: CapitalPlanWorkspaceProps) {
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [revision, setRevision] = useState<number>(1);
  const [plan, setPlan] = useState<CapitalPlan>(() => emptyPlan("", "新規プラン"));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "conflict" | "error">("idle");
  const [conflictServerPlan, setConflictServerPlan] = useState<PlanRow | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [deriveError, setDeriveError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [directEditError, setDirectEditError] = useState<string | null>(null);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSavePlanIdRef = useRef<string | null>(null);
  const latestPlanRef = useRef(plan);
  const latestRevisionRef = useRef(revision);
  const selectedPlanIdRef = useRef(selectedPlanId);
  const dirtyRef = useRef(dirty);
  // Monotonic edit counter for the currently selected plan. Bumped synchronously (before any
  // setState) on every updatePlan() call so that concurrent/rapid edits (e.g. two onBlur handlers
  // firing back to back) can never be mistaken for the same unit of work by the save loop below.
  const editGenerationRef = useRef(0);
  // The highest generation that persist() has confirmed durable on the server for the current
  // plan. dirty only clears once savedGenerationRef.current === editGenerationRef.current.
  const savedGenerationRef = useRef(0);
  const persistInFlightRef = useRef<{
    planId: string;
    promise: Promise<{ success: boolean; revision?: number }>;
  } | null>(null);
  latestPlanRef.current = plan;
  latestRevisionRef.current = revision;
  selectedPlanIdRef.current = selectedPlanId;
  dirtyRef.current = dirty;

  const loadPlans = useCallback(
    async (preferPlanId?: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/governance/capital-plans?projectId=${encodeURIComponent(projectId)}`);
        const json = await res.json();
        if (!json.ok) throw new Error(json.error ?? "読み込みに失敗しました");
        const nextPlans: PlanRow[] = json.plans ?? [];
        setPlans(nextPlans);
        setVersions(json.versions ?? []);
        const activePlans = nextPlans.filter((p) => p.status === "active");
        const target =
          nextPlans.find((p) => p.id === preferPlanId) ?? activePlans[0] ?? nextPlans[0] ?? null;
        if (target) {
          selectPlan(target);
        } else {
          setSelectedPlanId(null);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "読み込みに失敗しました");
      } finally {
        setLoading(false);
      }
    },
    [projectId],
  );

  function selectPlan(row: PlanRow) {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    pendingSavePlanIdRef.current = null;
    // Refs must reflect the new plan synchronously (React state updates below are async/batched) so that
    // any in-flight persist for the previous plan that resolves before the next render sees the new
    // selectedPlanIdRef and correctly treats itself as stale (see persist()'s isCurrent guard).
    selectedPlanIdRef.current = row.id;
    setSelectedPlanId(row.id);
    latestRevisionRef.current = row.revision;
    setRevision(row.revision);
    const holders = Array.isArray(row.document_json?.holders) ? row.document_json.holders : [];
    const events = Array.isArray(row.document_json?.events) ? row.document_json.events : [];
    const { plan: nextPlan, error: derErr } = safeDeriveCapitalPlan({ id: row.id, name: row.name, holders, events });
    latestPlanRef.current = nextPlan;
    setPlan(nextPlan);
    setDeriveError(derErr ?? null);
    setSelectedEventId(nextPlan.events.length > 0 ? [...nextPlan.events].sort((a, b) => a.order - b.order)[0].id : null);
    setSaveState("idle");
    setConflictServerPlan(null);
    // Reset the generation counters synchronously alongside the ref/state resets above so that
    // any save loop still running for the previous plan cannot mistake its bookkeeping for the
    // freshly-selected plan's.
    editGenerationRef.current = 0;
    savedGenerationRef.current = 0;
    dirtyRef.current = false;
    setDirty(false);
  }

  useEffect(() => {
    void loadPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const selectedPlanRow = plans.find((p) => p.id === selectedPlanId) ?? null;
  const planVersions = versions
    .filter((v) => v.plan_id === selectedPlanId)
    .sort((a, b) => b.version - a.version);

  const sortedEvents = useMemo(() => [...plan.events].sort((a, b) => a.order - b.order), [plan.events]);
  const snapshots = useMemo(() => recalculateCapTable(plan), [plan]);
  const eligibility = useMemo(() => checkPublishEligibility(plan), [plan]);
  const issues = useMemo(
    () => [...eligibility.blockingIssues, ...eligibility.warnings],
    [eligibility],
  );
  const errorCount = eligibility.blockingIssues.length;
  const warningCount = eligibility.warnings.length;
  const selectedEvent = sortedEvents.find((e) => e.id === selectedEventId) ?? null;

  const holderName = useMemo(() => new Map(plan.holders.map((h) => [h.id, h.name] as const)), [plan.holders]);

  // ---- persistence -----------------------------------------------------

  // Persists one snapshot (captured by the caller) at one generation. `generation` is the
  // editGenerationRef value that was current when this snapshot was taken; dirty only clears if,
  // by the time this call resolves, no newer edit has bumped editGenerationRef past it.
  const persist = useCallback(
    async (
      nextPlan: CapitalPlan,
      expectedRevision: number,
      targetPlanId: string,
      generation: number,
    ): Promise<{ success: boolean; revision?: number }> => {
      // A persist can outlive the plan selection it was started for (user switched plans while this
      // request was in flight). A stale response may still update the plans list row (server truth),
      // but must never touch saveState/revision/dirty/error/conflict for whatever plan is current now.
      const isCurrent = () => targetPlanId === selectedPlanIdRef.current;
      if (isCurrent()) setSaveState("saving");
      try {
        const res = await fetch("/api/governance/capital-plans", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "save",
            planId: targetPlanId,
            expectedRevision,
            document_json: { holders: nextPlan.holders, events: nextPlan.events },
          }),
        });
        const json = await res.json();
        if (res.status === 409) {
          if (isCurrent()) {
            setSaveState("conflict");
            setConflictServerPlan(json.plan ?? null);
          }
          if (json.plan) setPlans((prev) => prev.map((p) => (p.id === json.plan.id ? json.plan : p)));
          return { success: false };
        }
        if (!json.ok) throw new Error(json.error ?? "保存に失敗しました");
        if (isCurrent()) {
          setRevision(json.plan.revision);
          latestRevisionRef.current = json.plan.revision;
          savedGenerationRef.current = generation;
          // Only clear dirty/mark "saved" if nothing newer than this snapshot has been edited in
          // the meantime; otherwise a newer edit is pending and the caller (runPersist) must chain
          // another save for it — never report this plan as fully saved while that gap exists.
          if (savedGenerationRef.current === editGenerationRef.current) {
            dirtyRef.current = false;
            setDirty(false);
            setSaveState("saved");
          }
        }
        setPlans((prev) => prev.map((p) => (p.id === json.plan.id ? json.plan : p)));
        return { success: true, revision: json.plan.revision };
      } catch (e) {
        if (isCurrent()) {
          setError(e instanceof Error ? e.message : "保存に失敗しました");
          setSaveState("error");
        }
        return { success: false };
      }
    },
    [],
  );

  // Serialized save runner: at most one PATCH in flight per plan. If a call for `targetPlanId` is
  // already in flight, join it rather than firing a duplicate request — but never treat that
  // in-flight promise as if it covers edits made after it started. Once it resolves, if the plan is
  // still current and still dirty (i.e. a newer generation exists), automatically chain another
  // save with a freshly captured snapshot/generation/revision. This is the only place that reads
  // latestPlanRef/latestRevisionRef/editGenerationRef to build a save request.
  const runPersist = useCallback(
    (targetPlanId: string): Promise<{ success: boolean; revision?: number }> => {
      const existing = persistInFlightRef.current;
      if (existing && existing.planId === targetPlanId) return existing.promise;

      const generation = editGenerationRef.current;
      const snapshotPlan = latestPlanRef.current;
      const expectedRevision = latestRevisionRef.current;

      const entry: { planId: string; promise: Promise<{ success: boolean; revision?: number }> } = {
        planId: targetPlanId,
        // placeholder; assigned synchronously below before any caller can observe `entry`
        promise: Promise.resolve({ success: false }),
      };
      entry.promise = (async () => {
        const result = await persist(snapshotPlan, expectedRevision, targetPlanId, generation);
        if (persistInFlightRef.current === entry) {
          persistInFlightRef.current = null;
        }
        if (result.success && targetPlanId === selectedPlanIdRef.current && dirtyRef.current) {
          return runPersist(targetPlanId);
        }
        return result;
      })();

      persistInFlightRef.current = entry;
      return entry.promise;
    },
    [persist],
  );

  const scheduleSave = useCallback(
    (planId: string) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      pendingSavePlanIdRef.current = planId;
      saveTimer.current = setTimeout(() => {
        const savePlanId = pendingSavePlanIdRef.current;
        saveTimer.current = null;
        if (!savePlanId || savePlanId !== selectedPlanIdRef.current) return;
        void runPersist(savePlanId);
      }, 800);
    },
    [runPersist],
  );

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  // Cancels the pending debounce, then loops on runPersist until the current plan's generation is
  // actually confirmed saved (dirtyRef.current becomes false) or a save fails/conflicts. runPersist
  // itself chains through newer generations once it's already running, but this loop also covers
  // the case where a fresh edit lands between two flushPendingSave iterations. Callers that switch
  // away from the current plan (selector switch, create, duplicate, rename, archive/restore,
  // restore version, freeze) must await this and stop on `false`.
  const flushPendingSave = useCallback(async (): Promise<boolean> => {
    const planId = selectedPlanIdRef.current;
    if (!planId) return true;

    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    pendingSavePlanIdRef.current = null;

    while (
      selectedPlanIdRef.current === planId &&
      (dirtyRef.current || persistInFlightRef.current?.planId === planId)
    ) {
      const result = await runPersist(planId);
      if (!result.success) return false;
    }
    return true;
  }, [runPersist]);

  function updatePlan(updater: (draft: CapitalPlan) => CapitalPlan) {
    const planId = selectedPlanIdRef.current;
    if (!planId) return;
    // Always compute from latestPlanRef.current (not React state) and assign the result back to
    // it synchronously, before any setState/scheduling. Two rapid edits (e.g. two onBlur handlers
    // firing in the same tick) must each see the other's result — reading from `plan` state here
    // would let the second updater start from a stale draft and silently drop the first edit.
    const updated = updater(latestPlanRef.current);
    const { plan: derived, error: derErr } = safeDeriveCapitalPlan(updated);
    latestPlanRef.current = derived;
    dirtyRef.current = true;
    editGenerationRef.current += 1;
    setDeriveError(derErr ?? null);
    setDirty(true);
    setPlan(derived);
    scheduleSave(planId);
  }

  // ---- plan-level actions -----------------------------------------------

  async function createPlan(
    name: string,
    document_json: { holders: Holder[]; events: CapitalEvent[] },
    busyKey: string,
  ) {
    const flushed = await flushPendingSave();
    if (!flushed) return;
    setBusyAction(busyKey);
    try {
      const res = await fetch("/api/governance/capital-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", projectId, name, document_json }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "作成に失敗しました");
      await loadPlans(json.plan.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "作成に失敗しました");
    } finally {
      setBusyAction(null);
    }
  }

  function createStandardIpoPlan() {
    const doc = createStandardIpoCapitalPlanDocument();
    void createPlan("IPOまでの標準プラン", doc, "create_standard");
  }

  function createPlanFromConfirmedHistory() {
    const doc = companyOverviewData
      ? createCapitalPlanDocumentFromCompanyOverview(companyOverviewData)
      : createStandardIpoCapitalPlanDocument();
    void createPlan("確定履歴から作成したプラン", doc, "create_from_overview");
  }

  function createEmptyPlan() {
    void createPlan("新規資本政策プラン", { holders: [], events: [] }, "create_blank");
  }

  async function duplicatePlan() {
    if (!selectedPlanId) return;
    const flushed = await flushPendingSave();
    if (!flushed) return;
    setBusyAction("duplicate");
    try {
      const res = await fetch("/api/governance/capital-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "duplicate", sourcePlanId: selectedPlanId }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "複製に失敗しました");
      await loadPlans(json.plan.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "複製に失敗しました");
    } finally {
      setBusyAction(null);
    }
  }

  async function submitRename() {
    if (!selectedPlanId || !nameDraft.trim()) {
      setRenaming(false);
      return;
    }
    const flushed = await flushPendingSave();
    if (!flushed) {
      setRenaming(false);
      return;
    }
    setBusyAction("rename");
    try {
      const res = await fetch("/api/governance/capital-plans", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "rename",
          planId: selectedPlanId,
          expectedRevision: latestRevisionRef.current,
          name: nameDraft.trim(),
        }),
      });
      const json = await res.json();
      if (res.status === 409) {
        setSaveState("conflict");
        setConflictServerPlan(json.plan ?? null);
        return;
      }
      if (!json.ok) throw new Error(json.error ?? "名称変更に失敗しました");
      setRevision(json.plan.revision);
      setPlans((prev) => prev.map((p) => (p.id === json.plan.id ? json.plan : p)));
      setPlan((prev) => ({ ...prev, name: json.plan.name }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "名称変更に失敗しました");
    } finally {
      setBusyAction(null);
      setRenaming(false);
    }
  }

  async function archiveOrRestore(targetStatus: "archived" | "active") {
    if (!selectedPlanId) return;
    const flushed = await flushPendingSave();
    if (!flushed) return;
    setBusyAction(targetStatus);
    try {
      const res = await fetch("/api/governance/capital-plans", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: targetStatus === "archived" ? "archive" : "restore",
          planId: selectedPlanId,
          expectedRevision: latestRevisionRef.current,
        }),
      });
      const json = await res.json();
      if (res.status === 409) {
        setSaveState("conflict");
        setConflictServerPlan(json.plan ?? null);
        return;
      }
      if (!json.ok) throw new Error(json.error ?? "更新に失敗しました");
      await loadPlans(selectedPlanId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "更新に失敗しました");
    } finally {
      setBusyAction(null);
    }
  }

  async function freezePlan() {
    if (!selectedPlanId || !eligibility.eligible || deriveError) return;
    const flushed = await flushPendingSave();
    if (!flushed) return;
    setBusyAction("freeze");
    try {
      const effectiveRevision = latestRevisionRef.current;
      const res = await fetch("/api/governance/capital-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "freeze", planId: selectedPlanId, expectedRevision: effectiveRevision }),
      });
      const json = await res.json();
      if (res.status === 409) {
        setSaveState("conflict");
        setConflictServerPlan(json.plan ?? null);
        return;
      }
      if (!json.ok) throw new Error(json.error ?? "確定に失敗しました");
      await loadPlans(selectedPlanId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "確定に失敗しました");
    } finally {
      setBusyAction(null);
    }
  }

  async function restoreVersion(version: number) {
    if (!selectedPlanId) return;
    const flushed = await flushPendingSave();
    if (!flushed) return;
    setBusyAction(`restore_version_${version}`);
    try {
      const res = await fetch("/api/governance/capital-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "restore_version",
          planId: selectedPlanId,
          version,
          expectedRevision: latestRevisionRef.current,
        }),
      });
      const json = await res.json();
      if (res.status === 409) {
        setSaveState("conflict");
        setConflictServerPlan(json.plan ?? null);
        return;
      }
      if (!json.ok) throw new Error(json.error ?? "復元に失敗しました");
      await loadPlans(selectedPlanId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "復元に失敗しました");
    } finally {
      setBusyAction(null);
    }
  }

  function acceptServerAndDiscardLocal() {
    if (!conflictServerPlan) return;
    selectPlan(conflictServerPlan as PlanRow);
    setPlans((prev) => prev.map((p) => (p.id === conflictServerPlan.id ? (conflictServerPlan as PlanRow) : p)));
  }

  function forceSaveOverServer() {
    if (!conflictServerPlan || !selectedPlanId) return;
    const serverRevision = (conflictServerPlan as PlanRow).revision;
    latestRevisionRef.current = serverRevision;
    setRevision(serverRevision);
    setConflictServerPlan(null);
    setSaveState("idle");
    // Route through the same serialized runPersist() mechanism as every other save: bump the
    // generation and mark dirty so runPersist captures latestPlanRef.current (never a possibly
    // stale `plan` closure value) against the server's revision, and joins/chains correctly with
    // any save that might already be in flight for this plan.
    editGenerationRef.current += 1;
    dirtyRef.current = true;
    setDirty(true);
    void runPersist(selectedPlanId);
  }

  async function exportFrozenVersion(version: VersionRow) {
    setBusyAction(`export_${version.version}`);
    try {
      const holders = Array.isArray(version.document_json?.holders) ? version.document_json.holders : [];
      const events = Array.isArray(version.document_json?.events) ? version.document_json.events : [];
      const frozenPlan: CapitalPlan = { id: version.plan_id, name: selectedPlanRow?.name ?? plan.name, holders, events };
      const validation: ValidationIssue[] = [
        ...(version.validation_summary?.blockingIssues ?? []),
        ...(version.validation_summary?.warnings ?? []),
      ];
      const frozen: FrozenCapitalPlanVersion = {
        plan: frozenPlan,
        plan_name: selectedPlanRow?.name ?? plan.name,
        project_name: projectName,
        version: version.version,
        source_revision: String(version.source_revision),
        published_at: version.published_at,
        published_by: version.published_by_email,
        document_json: JSON.stringify(version.document_json),
        status: "frozen",
        validation,
      };
      const bytes = createCapitalPlanXlsx(frozen);
      const blob = new Blob([new Uint8Array(bytes)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(selectedPlanRow?.name ?? plan.name).replace(/[\\/:*?"<>|]/g, "_")}_v${version.version}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "出力に失敗しました");
    } finally {
      setBusyAction(null);
    }
  }

  // ---- event / holder / allocation mutations ----------------------------

  function addHolder(name?: string) {
    const id = genId("holder");
    const trimmed = name?.trim();
    updatePlan((draft) => ({
      ...draft,
      holders: [...draft.holders, { id, name: trimmed || "新規株主", kind: "other" }],
    }));
  }

  function updateHolder(holderId: string, patch: Partial<Holder>) {
    updatePlan((draft) => ({
      ...draft,
      holders: draft.holders.map((h) => (h.id === holderId ? { ...h, ...patch } : h)),
    }));
  }

  function removeHolder(holderId: string) {
    const name = holderName.get(holderId) ?? "この株主";
    if (!window.confirm(`${name}を削除すると、全イベントのこの株主への割当も削除されます。よろしいですか？`)) return;
    updatePlan((draft) => ({
      ...draft,
      holders: draft.holders.filter((h) => h.id !== holderId),
      events: draft.events.map((e) => ({
        ...e,
        allocations: e.allocations.filter((a) => a.holderId !== holderId),
      })),
    }));
  }

  function addEvent() {
    const id = genId("event");
    const nextOrder = plan.events.length > 0 ? Math.max(...plan.events.map((e) => e.order)) + 1 : 0;
    const newEvent: CapitalEvent = {
      id,
      type: "equity_issue",
      label: "新規イベント",
      order: nextOrder,
      status: "planned",
      allocations: [],
    };
    updatePlan((draft) => ({ ...draft, events: [...draft.events, newEvent] }));
    setSelectedEventId(id);
  }

  function updateEvent(eventId: string, patch: Partial<CapitalEvent>) {
    if (Object.prototype.hasOwnProperty.call(patch, "calculationBasis")) {
      changeCalculationBasis(eventId, patch.calculationBasis ?? "manual");
      return;
    }

    const event = plan.events.find((e) => e.id === eventId);
    if (
      event &&
      Object.prototype.hasOwnProperty.call(patch, "pricePerShare") &&
      patch.pricePerShare !== undefined &&
      (event.calculationBasis === "valuation_and_investment" || event.calculationBasis === "ownership_target")
    ) {
      switchToPriceAndSharesOnPriceEdit(eventId, patch.pricePerShare);
      return;
    }

    if (
      event &&
      Object.prototype.hasOwnProperty.call(patch, "preMoneyValuation") &&
      patch.preMoneyValuation !== undefined &&
      event.calculationBasis === "price_and_shares"
    ) {
      switchToValuationAndInvestmentOnPreMoneyEdit(eventId, patch.preMoneyValuation);
      return;
    }

    if (
      event &&
      Object.prototype.hasOwnProperty.call(patch, "type") &&
      patch.type === "convertible_conversion" &&
      event.type !== "convertible_conversion"
    ) {
      switchToConvertibleConversionType(eventId, patch);
      return;
    }

    updatePlan((draft) => ({
      ...draft,
      events: draft.events.map((e) => (e.id === eventId ? { ...e, ...patch } : e)),
    }));
  }

  /**
   * イベント種類をconvertible_conversion（コンバーティブル転換）へ変更する際は、
   * calculationBasisを強制的にmanualへ正規化する（コンバーティブル転換は
   * deriveEvent側でmanual以外を許容しない）。切替前の方式がどうであれ、
   * changeCalculationBasisの"manual"分岐と同じ役割配置で全フィールドの
   * source を張り替える。convertible_conversionから他の種類へ変更する場合は
   * この関数を通らず、calculationBasis: manualはそのまま残す（強制的に
   * 元へ戻さない）。
   */
  function switchToConvertibleConversionType(eventId: string, patch: Partial<CapitalEvent>) {
    updatePlan((draft) => ({
      ...draft,
      events: draft.events.map((e) => {
        if (e.id !== eventId) return e;
        return {
          ...e,
          ...patch,
          calculationBasis: "manual",
          preMoneyValuation: toInputResolved(e.preMoneyValuation),
          pricePerShare: toInputResolved(e.pricePerShare),
          postMoneyValuation: toCalculated(e.postMoneyValuation),
          primaryRaise: toCalculated(e.primaryRaise),
          newShares: toCalculated(e.newShares),
          allocations: e.allocations.map((a) => ({
            ...a,
            shares: toInputResolved(a.shares) ?? a.shares,
            amount: toInputResolved(a.amount),
            pricePerShare: toInputResolved(a.pricePerShare),
          })),
        };
      }),
    }));
  }

  /**
   * 評価額×投資額／目標比率方式のイベントで event.pricePerShare へ直接の編集・上書きが
   * 入った場合、単価が入力された時点でそれは「単価×株数」方式への切替意図とみなし、
   * 単価×株数方式へ自動的に切り替える。ユーザーが入力した単価をそのまま入力値として
   * 採用し（切替前のフィールド値は使わない）、割当株数は入力へ、割当金額とイベント
   * 集計値は計算値へ、割当ごとの単価はクリアして事後計算のイベント単価を唯一の
   * driver にする（changeCalculationBasisのprice_and_shares分岐と同じ役割配置）。
   */
  function switchToPriceAndSharesOnPriceEdit(eventId: string, nextPricePerShare: EditableValue | undefined) {
    updatePlan((draft) => ({
      ...draft,
      events: draft.events.map((e) => {
        if (e.id !== eventId) return e;
        return {
          ...e,
          calculationBasis: "price_and_shares",
          pricePerShare: editableValue(resolvedValue(nextPricePerShare), "input"),
          preMoneyValuation: toCalculated(e.preMoneyValuation),
          postMoneyValuation: toCalculated(e.postMoneyValuation),
          primaryRaise: toCalculated(e.primaryRaise),
          newShares: toCalculated(e.newShares),
          allocations: e.allocations.map((a) => ({
            ...a,
            shares: toInputResolved(a.shares) ?? a.shares,
            amount: toCalculated(a.amount),
            pricePerShare: undefined,
          })),
        };
      }),
    }));
  }

  /**
   * 単価×株数方式のイベントで event.preMoneyValuation へ直接の編集・上書きが入った
   * 場合、プレマネー評価額が入力された時点でそれは「評価額×投資額」方式への切替
   * 意図とみなし、評価額×投資額方式へ自動的に切り替える。ユーザーが入力した
   * プレマネー評価額をそのまま入力値として採用し、割当金額は入力へ、割当株数・
   * 割当単価・イベント集計値は計算値へ（changeCalculationBasisのvaluation_and_investment
   * 分岐と同じ役割配置）。
   */
  function switchToValuationAndInvestmentOnPreMoneyEdit(eventId: string, nextPreMoneyValuation: EditableValue | undefined) {
    updatePlan((draft) => ({
      ...draft,
      events: draft.events.map((e) => {
        if (e.id !== eventId) return e;
        return {
          ...e,
          calculationBasis: "valuation_and_investment",
          preMoneyValuation: editableValue(resolvedValue(nextPreMoneyValuation), "input"),
          pricePerShare: toCalculated(e.pricePerShare),
          postMoneyValuation: toCalculated(e.postMoneyValuation),
          primaryRaise: toCalculated(e.primaryRaise),
          newShares: toCalculated(e.newShares),
          allocations: e.allocations.map((a) => ({
            ...a,
            amount: toInputResolved(a.amount),
            shares: toCalculatedShares(a.shares),
            pricePerShare: toCalculated(a.pricePerShare),
          })),
        };
      }),
    }));
  }

  /**
   * イベントの算定方式（calculationBasis）を切り替える。方式間の直接切替を許可し、
   * 切替先の方式で driver となるフィールドは resolvedValue を引き継いで source を
   * input に張り替え、output となるフィールドは resolvedValue を引き継いで source を
   * calculated に張り替える（役割が変わった時点で古い override はもはや意味を
   * 持たないため、stale な override はここで意図的に消去する）。これにより
   * 切替直後（次の編集を待たずに）deriveCapitalPlan が新しい役割で即座に
   * 再計算できる。
   */
  function changeCalculationBasis(eventId: string, basis: CalculationBasis) {
    const event = plan.events.find((e) => e.id === eventId);
    if (!event) return;
    setDirectEditError(null);

    updatePlan((draft) => ({
      ...draft,
      events: draft.events.map((e) => {
        if (e.id !== eventId) return e;
        if (basis === "manual") {
          return {
            ...e,
            calculationBasis: basis,
            preMoneyValuation: toInputResolved(e.preMoneyValuation),
            pricePerShare: toInputResolved(e.pricePerShare),
            postMoneyValuation: toCalculated(e.postMoneyValuation),
            primaryRaise: toCalculated(e.primaryRaise),
            newShares: toCalculated(e.newShares),
            allocations: e.allocations.map((a) => ({
              ...a,
              shares: toInputResolved(a.shares) ?? a.shares,
              amount: toInputResolved(a.amount),
              pricePerShare: toInputResolved(a.pricePerShare),
            })),
          };
        }
        if (basis === "valuation_and_investment") {
          // driver: preMoneyValuation + allocation amount. output: allocation shares/price,
          // event price/post/raise/newShares.
          return {
            ...e,
            calculationBasis: basis,
            preMoneyValuation: toInputResolved(e.preMoneyValuation),
            pricePerShare: toCalculated(e.pricePerShare),
            postMoneyValuation: toCalculated(e.postMoneyValuation),
            primaryRaise: toCalculated(e.primaryRaise),
            newShares: toCalculated(e.newShares),
            allocations: e.allocations.map((a) => ({
              ...a,
              amount: toInputResolved(a.amount),
              shares: toCalculatedShares(a.shares),
              pricePerShare: toCalculated(a.pricePerShare),
            })),
          };
        }
        if (basis === "price_and_shares") {
          // driver: event pricePerShare + allocation shares. output: allocation amount
          // (pricePerShare is cleared on every allocation so the event price alone drives
          // all allocations), event pre/post/raise/newShares.
          return {
            ...e,
            calculationBasis: basis,
            pricePerShare: toInputResolved(e.pricePerShare),
            preMoneyValuation: toCalculated(e.preMoneyValuation),
            postMoneyValuation: toCalculated(e.postMoneyValuation),
            primaryRaise: toCalculated(e.primaryRaise),
            newShares: toCalculated(e.newShares),
            allocations: e.allocations.map((a) => ({
              ...a,
              shares: toInputResolved(a.shares) ?? a.shares,
              amount: toCalculated(a.amount),
              pricePerShare: undefined,
            })),
          };
        }
        // ownership_target: driver = preMoneyValuation + existing targetOwnershipPercentage.
        // output: allocation shares/amount/price, event price/post/raise/newShares.
        return {
          ...e,
          calculationBasis: basis,
          preMoneyValuation: toInputResolved(e.preMoneyValuation),
          pricePerShare: toCalculated(e.pricePerShare),
          postMoneyValuation: toCalculated(e.postMoneyValuation),
          primaryRaise: toCalculated(e.primaryRaise),
          newShares: toCalculated(e.newShares),
          allocations: e.allocations.map((a) => ({
            ...a,
            targetOwnershipPercentage: toInputResolved(a.targetOwnershipPercentage),
            shares: toCalculatedShares(a.shares),
            amount: toCalculated(a.amount),
            pricePerShare: toCalculated(a.pricePerShare),
          })),
        };
      }),
    }));
  }

  function removeEvent(eventId: string) {
    if (!window.confirm("このイベントを削除します。よろしいですか？")) return;
    updatePlan((draft) => ({ ...draft, events: draft.events.filter((e) => e.id !== eventId) }));
    setSelectedEventId((cur) => (cur === eventId ? null : cur));
  }

  /**
   * 新規割当の初期role配置は、追加先イベントのcalculationBasisに合わせる（matrixの
   * セル編集が新規allocationを作る際のrole配置と揃える）。評価額×投資額では金額が
   * driverなので株数を入力値0にはしない（計算値0で始め、金額入力後の derive で
   * 実株数に置き換わる）。単価×株数では株数がdriverなので株数を入力値0で始め、
   * 金額は計算値に、割当ごとの単価はイベント単価が唯一のdriverになるよう未設定の
   * ままにする。目標比率では株数・金額・単価はすべて計算値、目標比率だけを入力値
   * として持たせる（deriveCapitalPlanのownership_target分岐が確定させる）。
   */
  function addAllocation(eventId: string) {
    const firstHolder = plan.holders[0];
    const event = plan.events.find((e) => e.id === eventId);
    const shareClass = defaultShareClassForNewAllocation(event?.type ?? "equity_issue");
    const basis = event?.calculationBasis;
    let alloc: EventAllocation;
    if (basis === "valuation_and_investment") {
      alloc = {
        id: genId("alloc"),
        holderId: firstHolder?.id ?? "",
        shareClass,
        shares: editableValue(0, "calculated"),
        amount: editableValue(0, "input"),
      };
    } else if (basis === "price_and_shares") {
      alloc = {
        id: genId("alloc"),
        holderId: firstHolder?.id ?? "",
        shareClass,
        shares: editableValue(0, "input"),
        amount: editableValue(0, "calculated"),
      };
    } else if (basis === "ownership_target") {
      alloc = {
        id: genId("alloc"),
        holderId: firstHolder?.id ?? "",
        shareClass,
        shares: editableValue(0, "calculated"),
        amount: editableValue(0, "calculated"),
        pricePerShare: editableValue(0, "calculated"),
        targetOwnershipPercentage: editableValue(0, "input"),
      };
    } else {
      alloc = {
        id: genId("alloc"),
        holderId: firstHolder?.id ?? "",
        shareClass,
        shares: editableValue(0, "input"),
      };
    }
    updatePlan((draft) => ({
      ...draft,
      events: draft.events.map((e) => (e.id === eventId ? { ...e, allocations: [...e.allocations, alloc] } : e)),
    }));
  }

  function updateAllocation(eventId: string, allocId: string, patch: Partial<EventAllocation>) {
    updatePlan((draft) => ({
      ...draft,
      events: draft.events.map((e) =>
        e.id === eventId
          ? { ...e, allocations: e.allocations.map((a) => (a.id === allocId ? { ...a, ...patch } : a)) }
          : e,
      ),
    }));
  }

  function removeAllocation(eventId: string, allocId: string) {
    if (!window.confirm("この割当を削除します。よろしいですか？")) return;
    updatePlan((draft) => ({
      ...draft,
      events: draft.events.map((e) =>
        e.id === eventId ? { ...e, allocations: e.allocations.filter((a) => a.id !== allocId) } : e,
      ),
    }));
  }

  const DEFAULT_SHARE_CLASS_BY_EVENT_TYPE: Partial<Record<CapitalEventType, ShareClass>> = {
    equity_issue: "preferred",
    ipo: "common",
    convertible_issue: "convertible",
    option_pool: "option",
    convertible_conversion: "preferred",
    secondary: "common",
    incorporation: "common",
  };

  function defaultShareClassForNewAllocation(eventType: CapitalEventType): ShareClass {
    return DEFAULT_SHARE_CLASS_BY_EVENT_TYPE[eventType] ?? "common";
  }

  function overriddenSharesValue(current: EditableValue | undefined, nextValue: number): EditableValue {
    if (current && current.source === "override") return { ...current, value: nextValue };
    if (current && (current.source === "calculated" || current.source === "imported" || current.source === "confirmed")) {
      return overrideValue(current.value, nextValue);
    }
    return editableValue(nextValue, current?.source ?? "input");
  }

  /** Forces a field to source 'calculated' (unless already an override) so the next
   * deriveCapitalPlan pass materializes it — see materializeField in capital-plan.ts,
   * which only overwrites 'calculated'/undefined fields. */
  function toCalculatedUnlessOverride(current: EditableValue | undefined): EditableValue | undefined {
    if (current && current.source === "override") return current;
    if (!current) return undefined;
    return editableValue(current.value, "calculated");
  }

  function toCalculatedSharesUnlessOverride(current: EditableValue | undefined): EditableValue {
    if (current && current.source === "override") return current;
    return editableValue(current ? current.value : 0, "calculated");
  }

  /**
   * calculationBasis の切替専用ヘルパー。切替により役割（driver / output）が
   * 変わるフィールドについては、override であっても古い上書きをそのまま持ち越さない
   * （役割が変わった時点でその override はもはや意味を持たないため）。常に現在の
   * resolvedValue（override されていればその上書き値、そうでなければ計算値/入力値）
   * を引き継ぎつつ、source だけを新しい役割に合わせて張り替える。
   */
  function toInputResolved(current: EditableValue | undefined): EditableValue | undefined {
    if (current == null) return undefined;
    return editableValue(resolvedValue(current), "input");
  }

  function toCalculated(current: EditableValue | undefined): EditableValue | undefined {
    if (current == null) return undefined;
    return editableValue(resolvedValue(current), "calculated");
  }

  function toCalculatedShares(current: EditableValue | undefined): EditableValue {
    return editableValue(current ? resolvedValue(current) : 0, "calculated");
  }

  function allowsNegativeShares(event: CapitalEvent, holderId: string): boolean {
    if (event.type === "secondary") return true;
    if (event.type !== "convertible_conversion") return false;
    return event.allocations.some((a) => a.holderId === holderId && a.shareClass === "convertible");
  }

  /**
   * 選択中イベントの直前スナップショット基準で、当該株主のイベント後FD株数を targetShares に
   * 合わせるよう、このイベントの当該holder allocation.shares を delta で反映する。
   * delta が負（前ラウンドより減少）の場合は保存せずエラーを表示する（減少は secondary で表現する）。
   */
  function editHolderPostEventShares(eventId: string, holderId: string, targetShares: number) {
    const event = plan.events.find((e) => e.id === eventId);
    if (!event) return;
    const idx = sortedEvents.findIndex((e) => e.id === eventId);
    const priorSnapshot = idx > 0 ? snapshots.find((s) => s.eventId === sortedEvents[idx - 1].id) : undefined;
    const priorHolderFd = priorSnapshot?.holders.find((h) => h.holderId === holderId)?.fullyDilutedShares ?? 0;
    const target = Math.round(targetShares);
    const delta = target - priorHolderFd;

    if (delta < 0) {
      const name = holderName.get(holderId) ?? holderId;
      setDirectEditError(
        `${name}のイベント後FD株数（${fmtShares(target)}）が直前ラウンドの値（${fmtShares(priorHolderFd)}）を下回っています。減少はsecondaryイベントで表現してください。`,
      );
      return;
    }

    // 同一holderに複数allocationがある場合、先頭allocationを「targetから他allocation分を差し引いた値」に
    // 合わせることで合計がtargetに一致するようにする（他allocationのshareClass/provenanceはそのまま）。
    const holderAllocIndices = event.allocations
      .map((a, i) => (a.holderId === holderId ? i : -1))
      .filter((i) => i >= 0);
    const otherSameHolderTotal = holderAllocIndices
      .slice(1)
      .reduce((sum, i) => sum + resolvedValue(event.allocations[i].shares), 0);
    const firstAllocDelta = delta - otherSameHolderTotal;

    if (firstAllocDelta < 0) {
      const name = holderName.get(holderId) ?? holderId;
      setDirectEditError(
        `${name}の他の割当合計（${fmtShares(otherSameHolderTotal)}）が目標株数（${fmtShares(target)}）を超えています。他の割当を先に調整してください。`,
      );
      return;
    }
    setDirectEditError(null);

    updatePlan((draft) => ({
      ...draft,
      events: draft.events.map((e) => {
        if (e.id !== eventId) return e;
        const existingIdx = e.allocations.findIndex((a) => a.holderId === holderId);
        if (existingIdx >= 0) {
          const alloc = e.allocations[existingIdx];
          const nextAllocations = [...e.allocations];
          nextAllocations[existingIdx] = { ...alloc, shares: overriddenSharesValue(alloc.shares, firstAllocDelta) };
          return { ...e, allocations: nextAllocations };
        }
        const newAlloc: EventAllocation = {
          id: genId("alloc"),
          holderId,
          shareClass: defaultShareClassForNewAllocation(e.type),
          shares: editableValue(delta, "input"),
        };
        return { ...e, allocations: [...e.allocations, newAlloc] };
      }),
    }));
  }

  /**
   * イベント後FD比率 p (0-1) を入力として受け取る。
   * 資金調達系イベント（equity_issue / convertible_conversion / ipo）では、算定方式を
   * ownership_target に切り替え、当該holder allocationのtargetOwnershipPercentageに
   * 入力値をそのまま設定する。shares/amount/pricePerShareは calculated ソースへ戻し、
   * deriveCapitalPlan 側の連立解（複数holderのtargetを同時に満たす）に委ねる。
   * それ以外のイベントでは、他holder合計FD株数 (otherTotal、当該holderを除く) を基準に
   * targetShares = round(p*otherTotal/(1-p)) を算出し、editHolderPostEventShares の
   * delta 反映ロジックへ委譲する。
   */
  function editHolderPostEventRatio(eventId: string, holderId: string, ratio: number) {
    if (!(ratio >= 0) || ratio >= 1) {
      setDirectEditError("FD比率は0以上1未満で入力してください。");
      return;
    }
    const event = plan.events.find((e) => e.id === eventId);
    if (!event) return;

    if (FINANCING_EVENT_TYPES.includes(event.type)) {
      setDirectEditError(null);
      const targetEv = editableValue(ratio, "input");
      updatePlan((draft) => ({
        ...draft,
        events: draft.events.map((e) => {
          if (e.id !== eventId) return e;
          const existingIdx = e.allocations.findIndex((a) => a.holderId === holderId);
          if (existingIdx >= 0) {
            const alloc = e.allocations[existingIdx];
            const nextAllocations = [...e.allocations];
            nextAllocations[existingIdx] = {
              ...alloc,
              targetOwnershipPercentage: targetEv,
              shares: editableValue(resolvedValue(alloc.shares), "calculated"),
              amount: undefined,
              pricePerShare: undefined,
            };
            return { ...e, calculationBasis: "ownership_target", allocations: nextAllocations };
          }
          const newAlloc: EventAllocation = {
            id: genId("alloc"),
            holderId,
            shareClass: defaultShareClassForNewAllocation(e.type),
            shares: editableValue(0, "calculated"),
            targetOwnershipPercentage: targetEv,
          };
          return { ...e, calculationBasis: "ownership_target", allocations: [...e.allocations, newAlloc] };
        }),
      }));
      return;
    }

    const currentSnapshot = snapshots.find((s) => s.eventId === eventId);
    const otherTotal =
      currentSnapshot?.holders.reduce((sum, h) => (h.holderId === holderId ? sum : sum + h.fullyDilutedShares), 0) ?? 0;
    const targetShares = Math.round((ratio * otherTotal) / (1 - ratio));
    editHolderPostEventShares(eventId, holderId, targetShares);
  }

  /**
   * イベント内の当該holderの金額合計を targetAmount に合わせる。同一holderに複数allocationが
   * ある場合は先頭allocationを「targetから他allocation分を差し引いた値」に合わせる（editHolderPostEventShares
   * と同じ集約ルール）。マイナスは保存せずエラー表示する。allocationが無ければ新規作成する。
   */
  function editHolderEventAmount(eventId: string, holderId: string, targetAmount: number) {
    const event = plan.events.find((e) => e.id === eventId);
    if (!event) return;
    const name = holderName.get(holderId) ?? holderId;
    if (targetAmount < 0) {
      setDirectEditError(`${name}の金額はマイナスにできません。`);
      return;
    }
    const holderAllocIndices = event.allocations
      .map((a, i) => (a.holderId === holderId ? i : -1))
      .filter((i) => i >= 0);
    const otherSameHolderTotal = holderAllocIndices
      .slice(1)
      .reduce((sum, i) => sum + (event.allocations[i].amount ? resolvedValue(event.allocations[i].amount) : 0), 0);
    const firstAllocAmount = targetAmount - otherSameHolderTotal;

    if (firstAllocAmount < 0) {
      setDirectEditError(
        `${name}の他の割当合計金額（${fmtYen(otherSameHolderTotal)}）が目標金額（${fmtYen(targetAmount)}）を超えています。他の割当を先に調整してください。`,
      );
      return;
    }
    setDirectEditError(null);

    updatePlan((draft) => ({
      ...draft,
      events: draft.events.map((e) => {
        if (e.id !== eventId) return e;
        const isValuationBasis = e.calculationBasis === "valuation_and_investment";
        const existingIdx = e.allocations.findIndex((a) => a.holderId === holderId);
        if (existingIdx >= 0) {
          const alloc = e.allocations[existingIdx];
          const nextAllocations = [...e.allocations];
          nextAllocations[existingIdx] = {
            ...alloc,
            amount: overriddenSharesValue(alloc.amount, firstAllocAmount),
            ...(isValuationBasis
              ? {
                  shares: toCalculatedSharesUnlessOverride(alloc.shares),
                  pricePerShare: toCalculatedUnlessOverride(alloc.pricePerShare),
                }
              : {}),
          };
          return { ...e, allocations: nextAllocations };
        }
        const newAlloc: EventAllocation = {
          id: genId("alloc"),
          holderId,
          shareClass: defaultShareClassForNewAllocation(e.type),
          shares: isValuationBasis ? editableValue(0, "calculated") : editableValue(0, "input"),
          amount: editableValue(firstAllocAmount, "input"),
        };
        return { ...e, allocations: [...e.allocations, newAlloc] };
      }),
    }));
  }

  /**
   * イベント内の当該holderの株数合計を targetShares に合わせる。集約ルールは
   * editHolderPostEventShares / editHolderEventAmount と同一。
   */
  function editHolderEventShares(eventId: string, holderId: string, targetShares: number) {
    const event = plan.events.find((e) => e.id === eventId);
    if (!event) return;
    const target = Math.round(targetShares);
    const name = holderName.get(holderId) ?? holderId;
    const allowNegative = allowsNegativeShares(event, holderId);
    if (target < 0 && !allowNegative) {
      setDirectEditError(
        `${name}の株数はマイナスにできません。譲渡（セカンダリ）イベントの譲渡人、またはコンバーティブル転換イベントでの転換社債等（shareClass: convertible）の消込以外ではマイナスの株数は認められません。`,
      );
      return;
    }
    const holderAllocIndices = event.allocations
      .map((a, i) => (a.holderId === holderId ? i : -1))
      .filter((i) => i >= 0);
    const otherSameHolderTotal = holderAllocIndices
      .slice(1)
      .reduce((sum, i) => sum + resolvedValue(event.allocations[i].shares), 0);
    const firstAllocShares = target - otherSameHolderTotal;

    if (firstAllocShares < 0 && !allowNegative) {
      setDirectEditError(
        `${name}の他の割当合計株数（${fmtShares(otherSameHolderTotal)}）が目標株数（${fmtShares(target)}）を超えています。他の割当を先に調整してください。`,
      );
      return;
    }
    setDirectEditError(null);

    updatePlan((draft) => ({
      ...draft,
      events: draft.events.map((e) => {
        if (e.id !== eventId) return e;
        const existingIdx = e.allocations.findIndex((a) => a.holderId === holderId);
        if (existingIdx >= 0) {
          const alloc = e.allocations[existingIdx];
          const nextAllocations = [...e.allocations];
          nextAllocations[existingIdx] = { ...alloc, shares: overriddenSharesValue(alloc.shares, firstAllocShares) };
          return { ...e, allocations: nextAllocations };
        }
        const newAlloc: EventAllocation = {
          id: genId("alloc"),
          holderId,
          shareClass: defaultShareClassForNewAllocation(e.type),
          shares: editableValue(firstAllocShares, "input"),
        };
        return { ...e, allocations: [...e.allocations, newAlloc] };
      }),
    }));
  }

  /**
   * editHolderPostEventRatio で設定した targetOwnershipPercentage を取り消す。
   * 対象allocationからtargetOwnershipPercentageを取り除いた上で、shares/amount/pricePerShareが
   * いずれも calculated ソースか未設定で、かつ note も無い（＝自動生成されたallocationのまま
   * 何も手を加えられていない）場合は、そのallocation自体を削除する。それ以外（他の値が
   * authored されている場合）はallocationを残し、他のフィールドはそのまま保持する。
   */
  function clearHolderPostEventRatio(eventId: string, holderId: string) {
    setDirectEditError(null);
    updatePlan((draft) => ({
      ...draft,
      events: draft.events.map((e) => {
        if (e.id !== eventId) return e;
        const nextAllocations: EventAllocation[] = [];
        for (const a of e.allocations) {
          if (a.holderId !== holderId || a.targetOwnershipPercentage == null) {
            nextAllocations.push(a);
            continue;
          }
          const { targetOwnershipPercentage: _drop, ...rest } = a;
          void _drop;
          const isCalculatedOrUnset = (v: EditableValue | undefined) => v == null || v.source === "calculated";
          const isAutoGenerated =
            isCalculatedOrUnset(rest.shares) &&
            isCalculatedOrUnset(rest.amount) &&
            isCalculatedOrUnset(rest.pricePerShare) &&
            !rest.note;
          if (isAutoGenerated) continue;
          nextAllocations.push(rest);
        }
        return { ...e, allocations: nextAllocations };
      }),
    }));
  }

  function selectEventFromIssue(eventId?: string) {
    if (!eventId) return;
    setSelectedEventId(eventId);
  }

  function selectPrevEvent() {
    const idx = sortedEvents.findIndex((e) => e.id === selectedEventId);
    if (idx > 0) setSelectedEventId(sortedEvents[idx - 1].id);
  }
  function selectNextEvent() {
    const idx = sortedEvents.findIndex((e) => e.id === selectedEventId);
    if (idx >= 0 && idx < sortedEvents.length - 1) setSelectedEventId(sortedEvents[idx + 1].id);
  }

  // ---- render -------------------------------------------------------------

  if (loading) {
    return <div className="p-4 text-sm text-zinc-500">資本政策プランを読み込み中…</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
          <button className="ml-3 min-h-[44px] rounded px-2 underline" onClick={() => setError(null)}>
            閉じる
          </button>
        </div>
      )}

      {/* Plan selector / controls */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200 bg-white p-3">
        <label className="flex min-h-[44px] w-full min-w-0 items-center gap-2 text-sm sm:w-auto">
          <span className="shrink-0 text-zinc-500">プラン</span>
          <select
            className="min-h-[44px] min-w-0 flex-1 rounded-md border border-zinc-300 px-2 py-1 text-sm sm:flex-none"
            value={selectedPlanId ?? ""}
            onChange={async (e) => {
              const row = plans.find((p) => p.id === e.target.value);
              if (!row) return;
              const flushed = await flushPendingSave();
              if (!flushed) return;
              selectPlan(row);
            }}
          >
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.status === "archived" ? "（アーカイブ）" : ""}
              </option>
            ))}
          </select>
        </label>

        {renaming ? (
          <input
            autoFocus
            className="min-h-[44px] rounded-md border border-zinc-300 px-2 py-1 text-sm"
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={() => void submitRename()}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submitRename();
              if (e.key === "Escape") setRenaming(false);
            }}
          />
        ) : (
          <button
            className="min-h-[44px] rounded-md border border-zinc-300 px-3 text-sm hover:bg-zinc-50"
            onClick={() => {
              setNameDraft(selectedPlanRow?.name ?? plan.name);
              setRenaming(true);
            }}
            disabled={!selectedPlanId}
          >
            名称変更
          </button>
        )}

        <button
          className="min-h-[44px] rounded-md border border-zinc-300 bg-zinc-900 px-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-40"
          onClick={createStandardIpoPlan}
          disabled={busyAction === "create_standard"}
        >
          + IPOまでの標準プラン
        </button>
        <button
          className="min-h-[44px] rounded-md border border-zinc-300 px-3 text-sm hover:bg-zinc-50 disabled:opacity-40"
          onClick={createPlanFromConfirmedHistory}
          disabled={busyAction === "create_from_overview"}
        >
          + 確定履歴から作成
        </button>
        <button
          className="min-h-[44px] rounded-md border border-zinc-300 px-3 text-sm hover:bg-zinc-50 disabled:opacity-40"
          onClick={createEmptyPlan}
          disabled={busyAction === "create_blank"}
        >
          + 空のプラン
        </button>
        <button
          className="min-h-[44px] rounded-md border border-zinc-300 px-3 text-sm hover:bg-zinc-50 disabled:opacity-40"
          onClick={duplicatePlan}
          disabled={!selectedPlanId || busyAction === "duplicate"}
        >
          複製
        </button>
        {selectedPlanRow?.status === "active" ? (
          <button
            className="min-h-[44px] rounded-md border border-zinc-300 px-3 text-sm hover:bg-zinc-50 disabled:opacity-40"
            onClick={() => archiveOrRestore("archived")}
            disabled={busyAction === "archived"}
          >
            アーカイブ
          </button>
        ) : (
          selectedPlanRow && (
            <button
              className="min-h-[44px] rounded-md border border-zinc-300 px-3 text-sm hover:bg-zinc-50 disabled:opacity-40"
              onClick={() => archiveOrRestore("active")}
              disabled={busyAction === "active"}
            >
              復元
            </button>
          )
        )}

        <button
          className="min-h-[44px] rounded-md border border-emerald-600 bg-emerald-600 px-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:border-zinc-300 disabled:bg-zinc-200 disabled:text-zinc-400"
          onClick={freezePlan}
          disabled={
            !eligibility.eligible ||
            !!deriveError ||
            dirty ||
            saveState === "conflict" ||
            saveState === "saving" ||
            saveState === "error" ||
            !!busyAction
          }
          title={
            deriveError
              ? "自動算出エラーが残っているため確定できません"
              : dirty || saveState === "saving"
                ? "保存が完了するまで確定できません"
                : eligibility.eligible
                  ? "この版をエラーなしで提出版として確定"
                  : "エラーが残っているため確定できません"
          }
        >
          提出版を確定
        </button>

        <span className="ml-auto text-xs text-zinc-400" aria-live="polite">
          {saveState === "saving" && "保存中…"}
          {saveState === "saved" && "保存済み"}
          {saveState === "error" && "保存エラー"}
          {saveState === "idle" && ""}
        </span>
      </div>

      {saveState === "conflict" && conflictServerPlan && (
        <div className="rounded-md border border-amber-400 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="mb-2 font-semibold">競合が発生しました。別の場所で同じプランが更新されています。</p>
          <p className="mb-2 text-xs">
            サーバー側 revision: {conflictServerPlan.revision}（更新者: {conflictServerPlan.updated_by_email}）
          </p>
          <div className="flex gap-2">
            <button
              className="min-h-[44px] rounded-md border border-amber-500 px-3 text-sm hover:bg-amber-100"
              onClick={acceptServerAndDiscardLocal}
            >
              サーバー側を採用（自分の変更は破棄）
            </button>
            <button
              className="min-h-[44px] rounded-md border border-amber-500 bg-amber-500 px-3 text-sm text-white hover:bg-amber-600"
              onClick={forceSaveOverServer}
            >
              自分の変更で上書き保存
            </button>
          </div>
        </div>
      )}

      <p className="text-xs text-zinc-500">
        保存された資本政策表を社内承認とVC提出に使用します。
      </p>

      {selectedPlanId && !eligibility.eligible && eligibility.blockingIssues.length > 0 && (
        <div role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {eligibility.blockingIssues[0].message}
          {eligibility.blockingIssues.length > 1 && (
            <span className="ml-2 text-xs text-red-600">（他 {eligibility.blockingIssues.length - 1} 件）</span>
          )}
        </div>
      )}

      {!selectedPlanId ? (
        <div className="rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">
          {projectName} にはまだ資本政策プランがありません。「+ IPOまでの標準プラン」「+ 確定履歴から作成」「+ 空のプラン」のいずれかから作成してください。
        </div>
      ) : (
        <>
          {deriveError && (
            <div role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
              {deriveError}
            </div>
          )}

          {/* Validation summary */}
          {issues.length > 0 && (
            <details className="rounded-lg border border-zinc-200 bg-white p-3">
              <summary className="cursor-pointer text-xs font-semibold text-zinc-500">
                検証結果（エラー {errorCount}件 / 警告 {warningCount}件）
              </summary>
              <div className="mt-2 flex flex-col gap-1">
                {issues.map((issue, idx) => (
                  <button
                    key={`${issue.code}_${idx}`}
                    onClick={() => selectEventFromIssue(issue.eventId)}
                    className={`min-h-[44px] rounded-md border px-3 py-2 text-left text-xs ${
                      issue.severity === "error"
                        ? "border-red-300 bg-red-50 text-red-800 hover:bg-red-100"
                        : "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
                    }`}
                  >
                    <span className="mr-2 font-semibold">{issue.severity === "error" ? "エラー" : "警告"}</span>
                    {issue.message}
                  </button>
                ))}
              </div>
            </details>
          )}

          {directEditError && (
            <div role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
              {directEditError}
            </div>
          )}

          <p className="text-xs text-zinc-500" role="note">
            プレマネー/投資額/単価などの入力に応じて算定方式が自動切替され、下流ラウンドも再計算される。
          </p>

          {/* Capital plan matrix (holder x event grid, editable) */}
          <CapitalPlanMatrix
            plan={plan}
            events={sortedEvents}
            snapshots={snapshots}
            selectedEventId={selectedEventId}
            onSelectEvent={setSelectedEventId}
            onUpdateEvent={updateEvent}
            onEditHolderAmount={editHolderEventAmount}
            onEditHolderEventShares={editHolderEventShares}
            onEditHolderPostRatio={editHolderPostEventRatio}
            onClearHolderPostRatio={clearHolderPostEventRatio}
            onChangeCalculationBasis={changeCalculationBasis}
            onAddHolder={addHolder}
            onAddEvent={addEvent}
          />

          {/* Selected event editor */}
          <details className="rounded-lg border border-zinc-200 bg-white p-3">
            <summary className="cursor-pointer text-sm font-semibold text-zinc-700">株主・イベント詳細設定</summary>
            <div className="mt-3">
              <EventEditor
                event={selectedEvent}
                holders={plan.holders}
                onUpdateEvent={updateEvent}
                onRemoveEvent={removeEvent}
                onAddAllocation={addAllocation}
                onUpdateAllocation={updateAllocation}
                onRemoveAllocation={removeAllocation}
                onAddEvent={addEvent}
                onAddHolder={addHolder}
                onUpdateHolder={updateHolder}
                onRemoveHolder={removeHolder}
                onPrev={selectPrevEvent}
                onNext={selectNextEvent}
                hasPrev={sortedEvents.findIndex((e) => e.id === selectedEventId) > 0}
                hasNext={
                  sortedEvents.findIndex((e) => e.id === selectedEventId) >= 0 &&
                  sortedEvents.findIndex((e) => e.id === selectedEventId) < sortedEvents.length - 1
                }
              />
            </div>
          </details>

          {/* Frozen versions */}
          <div className="rounded-lg border border-zinc-200 bg-white p-3">
            <p className="mb-2 text-xs font-semibold text-zinc-500">提出版履歴</p>
            {planVersions.length === 0 ? (
              <p className="text-xs text-zinc-400">まだ確定された提出版はありません。</p>
            ) : (
              <div className="flex flex-col gap-2">
                {planVersions.map((v) => (
                  <div
                    key={v.id}
                    className="flex flex-wrap items-center gap-2 rounded-md border border-zinc-200 px-3 py-2 text-xs"
                  >
                    <span className="font-semibold">v{v.version}</span>
                    <span className="text-zinc-500">
                      {new Date(v.published_at).toLocaleString("ja-JP")} / {v.published_by_email}
                    </span>
                    <button
                      className="ml-auto min-h-[44px] rounded-md border border-zinc-300 px-3 hover:bg-zinc-50 disabled:opacity-40"
                      onClick={() => exportFrozenVersion(v)}
                      disabled={busyAction === `export_${v.version}`}
                    >
                      VC提出用Excel
                    </button>
                    <button
                      className="min-h-[44px] rounded-md border border-zinc-300 px-3 hover:bg-zinc-50 disabled:opacity-40"
                      onClick={() => restoreVersion(v.version)}
                      disabled={busyAction === `restore_version_${v.version}`}
                    >
                      この版を復元
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Event editor
// ---------------------------------------------------------------------------

function EventEditor({
  event,
  holders,
  onUpdateEvent,
  onRemoveEvent,
  onAddAllocation,
  onUpdateAllocation,
  onRemoveAllocation,
  onAddEvent,
  onAddHolder,
  onUpdateHolder,
  onRemoveHolder,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: {
  event: CapitalEvent | null;
  holders: Holder[];
  onUpdateEvent: (eventId: string, patch: Partial<CapitalEvent>) => void;
  onRemoveEvent: (eventId: string) => void;
  onAddAllocation: (eventId: string) => void;
  onUpdateAllocation: (eventId: string, allocId: string, patch: Partial<EventAllocation>) => void;
  onRemoveAllocation: (eventId: string, allocId: string) => void;
  onAddEvent: () => void;
  onAddHolder: () => void;
  onUpdateHolder: (holderId: string, patch: Partial<Holder>) => void;
  onRemoveHolder: (holderId: string) => void;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3">
      <div className="mb-3 flex items-center justify-between gap-2 md:hidden">
        <button
          className="min-h-[44px] min-w-[44px] rounded-md border border-zinc-300 px-3 disabled:opacity-30"
          onClick={onPrev}
          disabled={!hasPrev}
          aria-label="前のイベント"
        >
          ◀
        </button>
        <span className="text-sm font-semibold">{event ? event.label : "イベント未選択"}</span>
        <button
          className="min-h-[44px] min-w-[44px] rounded-md border border-zinc-300 px-3 disabled:opacity-30"
          onClick={onNext}
          disabled={!hasNext}
          aria-label="次のイベント"
        >
          ▶
        </button>
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="hidden text-sm font-semibold text-zinc-700 md:block">イベント編集</p>
        <div className="flex flex-wrap gap-2">
          <button className="min-h-[44px] rounded-md border border-zinc-300 px-3 text-xs hover:bg-zinc-50" onClick={onAddEvent}>
            + イベント追加
          </button>
          <button className="min-h-[44px] rounded-md border border-zinc-300 px-3 text-xs hover:bg-zinc-50" onClick={onAddHolder}>
            + 株主追加
          </button>
          {event && (
            <button
              className="min-h-[44px] rounded-md border border-red-300 px-3 text-xs text-red-700 hover:bg-red-50"
              onClick={() => onRemoveEvent(event.id)}
            >
              このイベントを削除
            </button>
          )}
        </div>
      </div>

      {!event ? (
        <p className="text-sm text-zinc-400">下の表またはグラフからイベントを選択してください。</p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <label className="col-span-2 flex flex-col gap-1">
              <span className="text-xs font-medium text-zinc-500">イベント名</span>
              <input
                className="min-h-[44px] rounded-md border border-zinc-300 px-2 py-2 text-sm"
                value={event.label}
                onChange={(e) => onUpdateEvent(event.id, { label: e.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-zinc-500">日付</span>
              <input
                type="date"
                className="min-h-[44px] rounded-md border border-zinc-300 px-2 py-2 text-sm"
                value={event.date ?? ""}
                onChange={(e) => onUpdateEvent(event.id, { date: e.target.value || undefined })}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-zinc-500">順序</span>
              <input
                type="number"
                className="min-h-[44px] rounded-md border border-zinc-300 px-2 py-2 text-sm"
                value={event.order}
                onChange={(e) => onUpdateEvent(event.id, { order: Number(e.target.value) })}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-zinc-500">種類</span>
              <select
                className="min-h-[44px] rounded-md border border-zinc-300 px-2 py-2 text-sm"
                value={event.type}
                onChange={(e) => onUpdateEvent(event.id, { type: e.target.value as CapitalEventType })}
              >
                {(Object.keys(EVENT_TYPE_LABEL) as CapitalEventType[]).map((t) => (
                  <option key={t} value={t}>
                    {EVENT_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-zinc-500">ステータス</span>
              <select
                className="min-h-[44px] rounded-md border border-zinc-300 px-2 py-2 text-sm"
                value={eventStatusOf(event)}
                aria-label="イベントステータス（確定履歴／将来計画）"
                onChange={(e) => onUpdateEvent(event.id, { status: e.target.value as CapitalEventStatus })}
              >
                {(Object.keys(EVENT_STATUS_LABEL) as CapitalEventStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {EVENT_STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-zinc-500">計算基準</span>
              {event.type === "convertible_conversion" ? (
                <span
                  className="flex min-h-[44px] items-center rounded-md border border-zinc-200 bg-zinc-50 px-2 py-2 text-sm text-zinc-500"
                  title="コンバーティブル転換イベントは常に手動（自動計算なし）です"
                >
                  {CALCULATION_BASIS_LABEL.manual}
                </span>
              ) : (
                <select
                  className="min-h-[44px] rounded-md border border-zinc-300 px-2 py-2 text-sm"
                  value={event.calculationBasis ?? "manual"}
                  onChange={(e) => onUpdateEvent(event.id, { calculationBasis: e.target.value as CalculationBasis })}
                >
                  {(Object.keys(CALCULATION_BASIS_LABEL) as CalculationBasis[]).map((b) => (
                    <option key={b} value={b}>
                      {CALCULATION_BASIS_LABEL[b]}
                    </option>
                  ))}
                </select>
              )}
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-500">備考</span>
            <textarea
              className="min-h-[44px] rounded-md border border-zinc-300 px-2 py-2 text-sm"
              rows={2}
              value={event.note ?? ""}
              onChange={(e) => onUpdateEvent(event.id, { note: e.target.value || undefined })}
            />
          </label>

          {/* Holders registry (compact, applies globally) */}
          <div>
            <p className="mb-2 text-xs font-semibold text-zinc-500">株主一覧（全イベント共通）</p>
            <div className="flex flex-col gap-2">
              {holders.length === 0 && <p className="text-xs text-zinc-400">株主が登録されていません。</p>}
              {holders.map((h) => (
                <div key={h.id} className="flex flex-wrap items-center gap-2">
                  <input
                    className="min-h-[44px] min-w-[8rem] flex-1 rounded-md border border-zinc-300 px-2 py-2 text-sm"
                    value={h.name}
                    aria-label={`株主名 ${h.name}`}
                    onChange={(e) => onUpdateHolder(h.id, { name: e.target.value })}
                  />
                  <select
                    className="min-h-[44px] rounded-md border border-zinc-300 px-2 py-2 text-sm"
                    value={h.kind}
                    aria-label={`株主種別 ${h.name}`}
                    onChange={(e) => onUpdateHolder(h.id, { kind: e.target.value as HolderKind })}
                  >
                    {(Object.keys(HOLDER_KIND_LABEL) as HolderKind[]).map((k) => (
                      <option key={k} value={k}>
                        {HOLDER_KIND_LABEL[k]}
                      </option>
                    ))}
                  </select>
                  <button
                    className="min-h-[44px] min-w-[44px] rounded-md border border-red-300 px-2 text-xs text-red-700 hover:bg-red-50"
                    onClick={() => onRemoveHolder(h.id)}
                    aria-label={`${h.name}を削除`}
                  >
                    削除
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Allocations for this event */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold text-zinc-500">このイベントの割当</p>
              <button
                className="min-h-[44px] rounded-md border border-zinc-300 px-3 text-xs hover:bg-zinc-50"
                onClick={() => onAddAllocation(event.id)}
                disabled={holders.length === 0}
              >
                + 割当追加
              </button>
            </div>
            {event.allocations.length === 0 ? (
              <p className="text-xs text-zinc-400">割当がありません。</p>
            ) : (
              <div className="overflow-x-auto">
                <div className="flex flex-col gap-1" style={{ minWidth: 820 }}>
                  <div className="grid grid-cols-[10rem_7rem_7rem_7rem_7rem_7rem_3rem] gap-2 px-1 text-xs font-medium text-zinc-400">
                    <span>株主</span>
                    <span>種別</span>
                    <span>株数</span>
                    <span>金額</span>
                    <span>1株価格</span>
                    <span>目標比率（%）</span>
                    <span />
                  </div>
                  {event.allocations.map((alloc) => (
                    <div
                      key={alloc.id}
                      className="grid grid-cols-[10rem_7rem_7rem_7rem_7rem_7rem_3rem] items-center gap-2 px-1 py-0.5"
                    >
                      <select
                        className="min-h-[44px] w-full min-w-0 rounded-md border border-zinc-300 px-2 py-2 text-sm"
                        value={alloc.holderId}
                        aria-label={`割当先株主 ${event.label} ${holders.find((h) => h.id === alloc.holderId)?.name ?? alloc.holderId}`}
                        onChange={(e) => onUpdateAllocation(event.id, alloc.id, { holderId: e.target.value })}
                      >
                        {holders.map((h) => (
                          <option key={h.id} value={h.id}>
                            {h.name}
                          </option>
                        ))}
                      </select>
                      <select
                        className="min-h-[44px] w-full min-w-0 rounded-md border border-zinc-300 px-2 py-2 text-sm"
                        value={alloc.shareClass}
                        aria-label={`割当種別 ${event.label} ${holders.find((h) => h.id === alloc.holderId)?.name ?? alloc.holderId}`}
                        onChange={(e) => onUpdateAllocation(event.id, alloc.id, { shareClass: e.target.value as ShareClass })}
                      >
                        {(Object.keys(SHARE_CLASS_LABEL) as ShareClass[]).map((sc) => (
                          <option key={sc} value={sc}>
                            {SHARE_CLASS_LABEL[sc]}
                          </option>
                        ))}
                      </select>
                      <TableNumberInput
                        ev={alloc.shares}
                        onChange={(v) => onUpdateAllocation(event.id, alloc.id, { shares: v ?? editableValue(0, "input") })}
                        ariaLabel={`株数 ${event.label} ${holders.find((h) => h.id === alloc.holderId)?.name ?? alloc.holderId}`}
                      />
                      <TableNumberInput
                        ev={alloc.amount}
                        onChange={(v) => onUpdateAllocation(event.id, alloc.id, { amount: v })}
                        ariaLabel={`金額 ${event.label} ${holders.find((h) => h.id === alloc.holderId)?.name ?? alloc.holderId}`}
                      />
                      {!event.calculationBasis || event.calculationBasis === "manual" ? (
                        <TableNumberInput
                          ev={alloc.pricePerShare}
                          onChange={(v) => onUpdateAllocation(event.id, alloc.id, { pricePerShare: v })}
                          ariaLabel={`1株価格 ${event.label} ${holders.find((h) => h.id === alloc.holderId)?.name ?? alloc.holderId}`}
                        />
                      ) : (
                        <TableNumberInput
                          ev={event.pricePerShare}
                          onChange={(v) => onUpdateEvent(event.id, { pricePerShare: v })}
                          ariaLabel={`1株価格（イベント単価） ${event.label} ${holders.find((h) => h.id === alloc.holderId)?.name ?? alloc.holderId}。単価を入力すると計算基準が単価×株数方式に自動切替され、株数を維持したまま金額が再計算されます。`}
                        />
                      )}
                      <TableNumberInput
                        ev={scaleEditableValue(alloc.targetOwnershipPercentage, 100)}
                        onChange={(v) => onUpdateAllocation(event.id, alloc.id, { targetOwnershipPercentage: scaleEditableValue(v, 1 / 100) })}
                        step={0.01}
                        ariaLabel={`目標比率（%） ${event.label} ${holders.find((h) => h.id === alloc.holderId)?.name ?? alloc.holderId}`}
                      />
                      <button
                        className="min-h-[44px] min-w-[44px] rounded-md border border-red-300 px-2 text-xs text-red-700 hover:bg-red-50"
                        onClick={() => onRemoveAllocation(event.id, alloc.id)}
                        aria-label="この割当を削除"
                      >
                        削除
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
