"use client";

import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileClock,
  FileSignature,
  FileText,
  FolderLock,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CONTRACT_STATUSES, type ContractStatus } from "@/lib/contracts";

type Project = {
  project_id: string;
  project_name: string;
  status: string | null;
  slack_channel_id: string | null;
};

type ContractRow = {
  contract_id: string;
  project_id: string;
  contract_title: string;
  counterparty_name: string | null;
  contract_type: string;
  status: ContractStatus;
  expected_signing_date: string | null;
  planned_at: string;
  last_activity_at: string | null;
  signed_at: string | null;
  nudge_after_days: number;
  signal_confidence: number | null;
  review_required: boolean;
  review_status: string;
  source_summary: string | null;
  drive_folder_id: string | null;
  signed_document_id: string | null;
  projects?: { project_name?: string | null; slack_channel_id?: string | null } | null;
};

type ContractDocument = {
  document_id: string;
  contract_id: string;
  project_id: string;
  document_kind: "draft" | "revision" | "redline" | "signed" | "other";
  version_label: string;
  drive_file_id: string;
  drive_folder_id: string | null;
  web_view_link: string;
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
  received_at: string;
  is_latest: boolean;
};

type ContractSignal = {
  signal_id: string;
  contract_id: string | null;
  project_id: string;
  source_kind: string;
  source_table: string;
  source_id: string;
  source_url: string | null;
  title: string;
  snippet: string;
  detected_terms: string[];
  signal_type: string;
  confidence: number;
  review_required: boolean;
  status: string;
  detected_at: string;
};

type ContractNudge = {
  nudge_id: string;
  contract_id: string;
  project_id: string;
  status: string;
  stale_days: number;
  slack_channel_id: string | null;
  dry_run_message: string;
  candidate_at: string;
};

type ContractsResponse = {
  ok?: boolean;
  setupRequired?: boolean;
  error?: string;
  contracts?: ContractRow[];
  documents?: ContractDocument[];
  signals?: ContractSignal[];
  nudges?: ContractNudge[];
  projects?: Project[];
  driveDestination?: { path: string; folderIdConfigured: boolean; folderIdEnv: string };
};

type SignalCandidate = {
  candidateId: string;
  projectId: string;
  sourceKind: string;
  sourceTable: string;
  sourceId: string;
  sourceUrl: string | null;
  title: string;
  snippet: string;
  detectedTerms: string[];
  signalType: string;
  confidence: number;
  reviewRequired: boolean;
  proposedAction: string;
  reason: string;
  itemDate: string | null;
};

type SignalDryRunResponse = {
  ok?: boolean;
  error?: string;
  candidates?: SignalCandidate[];
  candidateCounts?: { total: number; highConfidence: number; reviewRequired: number; byKind: Record<string, number> };
  sourceCounts?: { byKind: Record<string, number>; source_cache: number; project_meeting_summaries: number };
};

type NudgeCandidate = {
  contractId: string;
  projectId: string;
  projectName: string;
  contractTitle: string;
  counterpartyName: string;
  status: string;
  staleDays: number;
  thresholdDays: number;
  slackChannelId: string | null;
  dryRunMessage: string;
  blocker: string | null;
};

type NudgeDryRunResponse = {
  ok?: boolean;
  error?: string;
  candidates?: NudgeCandidate[];
  candidateCounts?: { total: number; sendable: number; blocked: number };
};

const STATUS_LABEL: Record<ContractStatus, string> = {
  planned: "予定枠",
  drafting: "作成中",
  under_review: "レビュー中",
  awaiting_signature: "押印待ち",
  signed: "押印済み",
  stalled: "停滞",
  cancelled: "中止",
};

const STATUS_TONE: Record<ContractStatus, string> = {
  planned: "border-slate-200 bg-slate-50 text-slate-700",
  drafting: "border-sky-200 bg-sky-50 text-sky-700",
  under_review: "border-amber-200 bg-amber-50 text-amber-800",
  awaiting_signature: "border-orange-200 bg-orange-50 text-orange-800",
  signed: "border-emerald-200 bg-emerald-50 text-emerald-800",
  stalled: "border-rose-200 bg-rose-50 text-rose-800",
  cancelled: "border-zinc-200 bg-zinc-50 text-zinc-600",
};

const BLANK_CONTRACT = {
  projectId: "",
  title: "",
  counterparty: "",
  contractType: "contract",
  expectedSigningDate: "",
  nudgeAfterDays: "14",
};

const BLANK_DOCUMENT = {
  webViewLink: "",
  driveFileId: "",
  fileName: "",
  versionLabel: "",
  documentKind: "revision",
};

function compactDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function dateOnly(value: string | null | undefined) {
  if (!value) return "-";
  return value.slice(0, 10);
}

function projectLabel(project: Project | undefined, fallback: string) {
  if (!project) return fallback;
  return `${project.project_id} ${project.project_name}`;
}

function statusBadge(status: ContractStatus) {
  return (
    <span className={`inline-flex h-6 items-center rounded-md border px-2 text-xs font-medium ${STATUS_TONE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function ContractsClient() {
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [documents, setDocuments] = useState<ContractDocument[]>([]);
  const [signals, setSignals] = useState<ContractSignal[]>([]);
  const [nudges, setNudges] = useState<ContractNudge[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [driveDestination, setDriveDestination] = useState<ContractsResponse["driveDestination"] | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("open");
  const [projectFilter, setProjectFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [setupRequired, setSetupRequired] = useState(false);
  const [newContract, setNewContract] = useState(BLANK_CONTRACT);
  const [newDocument, setNewDocument] = useState(BLANK_DOCUMENT);
  const [signalDryRun, setSignalDryRun] = useState<SignalDryRunResponse | null>(null);
  const [nudgeDryRun, setNudgeDryRun] = useState<NudgeDryRunResponse | null>(null);
  const [runningSignals, setRunningSignals] = useState(false);
  const [runningNudges, setRunningNudges] = useState(false);

  const projectById = useMemo(() => new Map(projects.map((project) => [project.project_id, project])), [projects]);
  const selected = useMemo(
    () => contracts.find((contract) => contract.contract_id === selectedId) || contracts[0] || null,
    [contracts, selectedId],
  );

  const docsByContract = useMemo(() => {
    const map = new Map<string, ContractDocument[]>();
    documents.forEach((doc) => {
      const list = map.get(doc.contract_id) || [];
      list.push(doc);
      map.set(doc.contract_id, list);
    });
    map.forEach((list) => list.sort((a, b) => String(b.received_at).localeCompare(String(a.received_at))));
    return map;
  }, [documents]);

  const signalsByProject = useMemo(() => {
    const map = new Map<string, ContractSignal[]>();
    signals.forEach((signal) => {
      const list = map.get(signal.project_id) || [];
      list.push(signal);
      map.set(signal.project_id, list);
    });
    return map;
  }, [signals]);

  const nudgesByContract = useMemo(() => {
    const map = new Map<string, ContractNudge[]>();
    nudges.forEach((nudge) => {
      const list = map.get(nudge.contract_id) || [];
      list.push(nudge);
      map.set(nudge.contract_id, list);
    });
    map.forEach((list) => list.sort((a, b) => String(b.candidate_at).localeCompare(String(a.candidate_at))));
    return map;
  }, [nudges]);

  const filteredContracts = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return contracts.filter((contract) => {
      if (projectFilter && contract.project_id !== projectFilter) return false;
      if (statusFilter === "open" && ["signed", "cancelled"].includes(contract.status)) return false;
      if (statusFilter !== "open" && statusFilter !== "all" && contract.status !== statusFilter) return false;
      if (!needle) return true;
      const haystack = [
        contract.contract_title,
        contract.counterparty_name,
        contract.contract_type,
        projectById.get(contract.project_id)?.project_name,
        contract.project_id,
      ].join(" ").toLowerCase();
      return haystack.includes(needle);
    });
  }, [contracts, projectById, projectFilter, query, statusFilter]);

  const metrics = useMemo(() => {
    const open = contracts.filter((contract) => !["signed", "cancelled"].includes(contract.status)).length;
    const awaiting = contracts.filter((contract) => contract.status === "awaiting_signature").length;
    const signed = contracts.filter((contract) => contract.status === "signed").length;
    const missingSigned = contracts.filter((contract) => !contract.signed_at && contract.status !== "cancelled").length;
    return { open, awaiting, signed, missingSigned };
  }, [contracts]);

  async function loadContracts() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/contracts", { cache: "no-store" });
      const json = (await res.json().catch(() => ({}))) as ContractsResponse;
      if (!res.ok || !json.ok) {
        setSetupRequired(Boolean(json.setupRequired));
        setError(json.error || `HTTP ${res.status}`);
        return;
      }
      setSetupRequired(false);
      setContracts(json.contracts || []);
      setDocuments(json.documents || []);
      setSignals(json.signals || []);
      setNudges(json.nudges || []);
      setProjects(json.projects || []);
      setDriveDestination(json.driveDestination || null);
      setSelectedId((current) => current || json.contracts?.[0]?.contract_id || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "fetch error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadContracts();
  }, []);

  async function createContract(event: FormEvent) {
    event.preventDefault();
    if (!newContract.projectId || !newContract.title || saving) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: newContract.projectId,
          contract_title: newContract.title,
          counterparty_name: newContract.counterparty,
          contract_type: newContract.contractType,
          expected_signing_date: newContract.expectedSigningDate || null,
          nudge_after_days: Number(newContract.nudgeAfterDays) || 14,
          review_required: true,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; contract?: ContractRow };
      if (!res.ok || !json.ok) {
        setError(json.error || `HTTP ${res.status}`);
        return;
      }
      setNewContract(BLANK_CONTRACT);
      await loadContracts();
      if (json.contract?.contract_id) setSelectedId(json.contract.contract_id);
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(contractId: string, status: ContractStatus) {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/contracts/${encodeURIComponent(contractId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error || `HTTP ${res.status}`);
        return;
      }
      await loadContracts();
      setSelectedId(contractId);
    } finally {
      setSaving(false);
    }
  }

  async function addDocument(event: FormEvent) {
    event.preventDefault();
    if (!selected || !newDocument.webViewLink || saving) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/contracts/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contract_id: selected.contract_id,
          web_view_link: newDocument.webViewLink,
          drive_file_id: newDocument.driveFileId,
          file_name: newDocument.fileName,
          version_label: newDocument.versionLabel,
          document_kind: newDocument.documentKind,
          is_latest: true,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error || `HTTP ${res.status}`);
        return;
      }
      setNewDocument(BLANK_DOCUMENT);
      await loadContracts();
      setSelectedId(selected.contract_id);
    } finally {
      setSaving(false);
    }
  }

  async function runSignalDryRun() {
    setRunningSignals(true);
    setError("");
    try {
      const params = projectFilter ? `?project_id=${encodeURIComponent(projectFilter)}` : "";
      const res = await fetch(`/api/contracts/signal-dry-run${params}`, { cache: "no-store" });
      const json = (await res.json().catch(() => ({}))) as SignalDryRunResponse;
      setSignalDryRun(json);
      if (!res.ok || !json.ok) setError(json.error || `HTTP ${res.status}`);
    } finally {
      setRunningSignals(false);
    }
  }

  async function runNudgeDryRun() {
    setRunningNudges(true);
    setError("");
    try {
      const params = projectFilter ? `?project_id=${encodeURIComponent(projectFilter)}` : "";
      const res = await fetch(`/api/contracts/nudges/dry-run${params}`, { cache: "no-store" });
      const json = (await res.json().catch(() => ({}))) as NudgeDryRunResponse;
      setNudgeDryRun(json);
      if (!res.ok || !json.ok) setError(json.error || `HTTP ${res.status}`);
    } finally {
      setRunningNudges(false);
    }
  }

  const selectedDocuments = selected ? docsByContract.get(selected.contract_id) || [] : [];
  const selectedSignals = selected ? signalsByProject.get(selected.project_id) || [] : [];
  const selectedNudges = selected ? nudgesByContract.get(selected.contract_id) || [] : [];
  const selectedProject = selected ? projectById.get(selected.project_id) : undefined;
  const signedDoc = selectedDocuments.find((doc) => doc.document_kind === "signed");

  return (
    <main className="min-h-[calc(100vh-44px)] bg-slate-50">
      <div className="mx-auto max-w-[1600px] space-y-4 p-4">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <p className="text-[11px] font-semibold uppercase text-slate-500">Backoffice</p>
            <h1 className="text-2xl font-semibold tracking-normal text-slate-950">契約</h1>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800">
              <ShieldCheck className="h-3 w-3" />
              admin only
            </Badge>
            <Button type="button" variant="outline" size="sm" onClick={loadContracts} disabled={loading}>
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              更新
            </Button>
          </div>
        </header>

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p>{error}</p>
              {setupRequired && <p className="mt-1 text-xs">migration `133_contracts_management.sql` の適用後に表示されるよ。</p>}
            </div>
          </div>
        )}

        <section className="grid gap-3 md:grid-cols-4">
          <Metric icon={<FileClock className="h-4 w-4" />} label="open" value={metrics.open} />
          <Metric icon={<Clock3 className="h-4 w-4" />} label="awaiting signature" value={metrics.awaiting} />
          <Metric icon={<CheckCircle2 className="h-4 w-4" />} label="signed" value={metrics.signed} />
          <Metric icon={<AlertTriangle className="h-4 w-4" />} label="missing signed PDF" value={metrics.missingSigned} />
        </section>

        <section className="grid gap-3 lg:grid-cols-[minmax(320px,0.85fr)_minmax(0,1.15fr)]">
          <div className="space-y-3">
            <div className="rounded-md border border-slate-200 bg-white p-3">
              <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_160px_160px]">
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-2 top-2 h-4 w-4 text-slate-400" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    className="h-8 w-full rounded-md border border-slate-200 bg-white pl-8 pr-2 text-sm outline-none focus:border-slate-400"
                    placeholder="相手先 / 契約名 / PJ"
                  />
                </label>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="h-8 rounded-md border border-slate-200 bg-white px-2 text-sm"
                >
                  <option value="open">open</option>
                  <option value="all">all</option>
                  {CONTRACT_STATUSES.map((status) => (
                    <option key={status} value={status}>{STATUS_LABEL[status]}</option>
                  ))}
                </select>
                <select
                  value={projectFilter}
                  onChange={(event) => setProjectFilter(event.target.value)}
                  className="h-8 rounded-md border border-slate-200 bg-white px-2 text-sm"
                >
                  <option value="">全PJ</option>
                  {projects.map((project) => (
                    <option key={project.project_id} value={project.project_id}>
                      {project.project_id} {project.project_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <form onSubmit={createContract} className="rounded-md border border-slate-200 bg-white p-3">
              <div className="mb-3 flex items-center gap-2">
                <Plus className="h-4 w-4 text-slate-500" />
                <h2 className="text-sm font-semibold text-slate-950">予定枠を追加</h2>
              </div>
              <div className="grid gap-2">
                <select
                  value={newContract.projectId}
                  onChange={(event) => setNewContract((current) => ({ ...current, projectId: event.target.value }))}
                  className="h-8 rounded-md border border-slate-200 bg-white px-2 text-sm"
                  required
                >
                  <option value="">PJを選択</option>
                  {projects.map((project) => (
                    <option key={project.project_id} value={project.project_id}>
                      {project.project_id} {project.project_name}
                    </option>
                  ))}
                </select>
                <input
                  value={newContract.title}
                  onChange={(event) => setNewContract((current) => ({ ...current, title: event.target.value }))}
                  className="h-8 rounded-md border border-slate-200 px-2 text-sm"
                  placeholder="契約名"
                  required
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    value={newContract.counterparty}
                    onChange={(event) => setNewContract((current) => ({ ...current, counterparty: event.target.value }))}
                    className="h-8 rounded-md border border-slate-200 px-2 text-sm"
                    placeholder="相手先"
                  />
                  <select
                    value={newContract.contractType}
                    onChange={(event) => setNewContract((current) => ({ ...current, contractType: event.target.value }))}
                    className="h-8 rounded-md border border-slate-200 bg-white px-2 text-sm"
                  >
                    <option value="contract">契約</option>
                    <option value="nda">NDA</option>
                    <option value="outsourcing">業務委託</option>
                    <option value="joint_research">共同研究</option>
                    <option value="mou">MOU</option>
                  </select>
                </div>
                <div className="grid gap-2 sm:grid-cols-[1fr_120px]">
                  <input
                    type="date"
                    value={newContract.expectedSigningDate}
                    onChange={(event) => setNewContract((current) => ({ ...current, expectedSigningDate: event.target.value }))}
                    className="h-8 rounded-md border border-slate-200 px-2 text-sm"
                  />
                  <input
                    type="number"
                    min="1"
                    max="120"
                    value={newContract.nudgeAfterDays}
                    onChange={(event) => setNewContract((current) => ({ ...current, nudgeAfterDays: event.target.value }))}
                    className="h-8 rounded-md border border-slate-200 px-2 text-sm"
                    aria-label="nudge days"
                  />
                </div>
                <Button type="submit" size="sm" disabled={saving || !newContract.projectId || !newContract.title}>
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  追加
                </Button>
              </div>
            </form>

            <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
              <div className="border-b border-slate-200 px-3 py-2 text-xs font-medium text-slate-500">
                {filteredContracts.length} contracts
              </div>
              <div className="max-h-[620px] overflow-y-auto">
                {filteredContracts.map((contract) => {
                  const project = projectById.get(contract.project_id);
                  const rowDocs = docsByContract.get(contract.contract_id) || [];
                  const active = selected?.contract_id === contract.contract_id;
                  return (
                    <button
                      key={contract.contract_id}
                      type="button"
                      onClick={() => setSelectedId(contract.contract_id)}
                      className={`block w-full border-b border-slate-100 px-3 py-3 text-left transition-colors hover:bg-slate-50 ${active ? "bg-slate-100" : "bg-white"}`}
                    >
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-950">{contract.contract_title}</p>
                          <p className="mt-0.5 truncate text-xs text-slate-500">
                            {projectLabel(project, contract.project_id)} / {contract.counterparty_name || "相手先未設定"}
                          </p>
                        </div>
                        {statusBadge(contract.status)}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                        <span>{rowDocs.length} docs</span>
                        <span>last {compactDate(contract.last_activity_at)}</span>
                        {!contract.signed_at && <span className="text-amber-700">signed missing</span>}
                      </div>
                    </button>
                  );
                })}
                {filteredContracts.length === 0 && (
                  <div className="px-3 py-10 text-center text-sm text-slate-500">契約予定枠なし</div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <section className="rounded-md border border-slate-200 bg-white p-4">
              {selected ? (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        {statusBadge(selected.status)}
                        {selected.review_required && <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">review</Badge>}
                        {signedDoc && <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800">signed stored</Badge>}
                      </div>
                      <h2 className="truncate text-xl font-semibold text-slate-950">{selected.contract_title}</h2>
                      <p className="mt-1 text-sm text-slate-500">
                        {projectLabel(selectedProject, selected.project_id)} / {selected.counterparty_name || "相手先未設定"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {CONTRACT_STATUSES.map((status) => (
                        <Button
                          key={status}
                          type="button"
                          variant={selected.status === status ? "default" : "outline"}
                          size="xs"
                          onClick={() => updateStatus(selected.contract_id, status)}
                          disabled={saving}
                        >
                          {STATUS_LABEL[status]}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-4">
                    <Fact label="expected" value={dateOnly(selected.expected_signing_date)} />
                    <Fact label="planned" value={compactDate(selected.planned_at)} />
                    <Fact label="signed" value={compactDate(selected.signed_at)} />
                    <Fact label="nudge days" value={`${selected.nudge_after_days}日`} />
                    <Fact label="pj signals" value={`${selectedSignals.length}件`} />
                    <Fact label="nudge history" value={`${selectedNudges.length}件`} />
                  </div>

                  <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <FolderLock className="h-4 w-4 text-slate-500" />
                      Drive
                    </div>
                    <p className="mt-1 text-xs text-slate-600">
                      {driveDestination?.path || "共有ドライブ/ARMADA/a3_backoffice/契約"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      folder id: {selected.drive_folder_id || (driveDestination?.folderIdConfigured ? "contract folder pending" : `${driveDestination?.folderIdEnv || "CONTRACTS_DRIVE_FOLDER_ID"} 未設定`)}
                    </p>
                    {selectedNudges.length > 0 && (
                      <div className="mt-3 divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
                        {selectedNudges.slice(0, 3).map((nudge) => (
                          <div key={nudge.nudge_id} className="flex items-center justify-between gap-3 px-2 py-2 text-xs">
                            <span className="truncate text-slate-600">{nudge.status}</span>
                            <span className="shrink-0 text-amber-700">{nudge.stale_days}日 / {compactDate(nudge.candidate_at)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="py-16 text-center text-sm text-slate-500">契約を選択してね</div>
              )}
            </section>

            {selected && (
              <section className="grid gap-3 xl:grid-cols-[1fr_360px]">
                <div className="rounded-md border border-slate-200 bg-white">
                  <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2">
                    <FileText className="h-4 w-4 text-slate-500" />
                    <h3 className="text-sm font-semibold">Version history</h3>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {selectedDocuments.map((doc) => (
                      <div key={doc.document_id} className="flex items-center gap-3 px-3 py-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-slate-50">
                          {doc.document_kind === "signed" ? <FileSignature className="h-4 w-4 text-emerald-600" /> : <FileText className="h-4 w-4 text-slate-500" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <a href={doc.web_view_link} target="_blank" rel="noreferrer" className="truncate text-sm font-medium text-slate-950 hover:underline">
                            {doc.file_name}
                          </a>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {doc.version_label} / {doc.document_kind} / {compactDate(doc.received_at)}
                          </p>
                        </div>
                        {doc.is_latest && <Badge variant="outline">latest</Badge>}
                      </div>
                    ))}
                    {selectedDocuments.length === 0 && (
                      <div className="px-3 py-10 text-center text-sm text-slate-500">version document なし</div>
                    )}
                  </div>
                </div>

                <form onSubmit={addDocument} className="rounded-md border border-slate-200 bg-white p-3">
                  <div className="mb-3 flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-slate-500" />
                    <h3 className="text-sm font-semibold">Drive版を登録</h3>
                  </div>
                  <div className="grid gap-2">
                    <select
                      value={newDocument.documentKind}
                      onChange={(event) => setNewDocument((current) => ({ ...current, documentKind: event.target.value }))}
                      className="h-8 rounded-md border border-slate-200 bg-white px-2 text-sm"
                    >
                      <option value="draft">draft</option>
                      <option value="revision">revision</option>
                      <option value="redline">redline</option>
                      <option value="signed">signed</option>
                      <option value="other">other</option>
                    </select>
                    <input
                      value={newDocument.webViewLink}
                      onChange={(event) => setNewDocument((current) => ({ ...current, webViewLink: event.target.value }))}
                      className="h-8 rounded-md border border-slate-200 px-2 text-sm"
                      placeholder="Drive link"
                      required
                    />
                    <input
                      value={newDocument.driveFileId}
                      onChange={(event) => setNewDocument((current) => ({ ...current, driveFileId: event.target.value }))}
                      className="h-8 rounded-md border border-slate-200 px-2 text-sm"
                      placeholder="Drive file id (linkから推定可)"
                    />
                    <div className="grid gap-2 sm:grid-cols-2">
                      <input
                        value={newDocument.fileName}
                        onChange={(event) => setNewDocument((current) => ({ ...current, fileName: event.target.value }))}
                        className="h-8 rounded-md border border-slate-200 px-2 text-sm"
                        placeholder="file name"
                      />
                      <input
                        value={newDocument.versionLabel}
                        onChange={(event) => setNewDocument((current) => ({ ...current, versionLabel: event.target.value }))}
                        className="h-8 rounded-md border border-slate-200 px-2 text-sm"
                        placeholder="v1 / signed"
                      />
                    </div>
                    <Button type="submit" size="sm" disabled={saving || !newDocument.webViewLink}>
                      {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                      登録
                    </Button>
                  </div>
                </form>
              </section>
            )}

            <section className="grid gap-3 xl:grid-cols-2">
              <DryRunPanel
                icon={<Sparkles className="h-4 w-4 text-sky-600" />}
                title="予兆検知 dry-run"
                actionLabel="候補生成"
                loading={runningSignals}
                onAction={runSignalDryRun}
              >
                {signalDryRun?.candidateCounts && (
                  <p className="text-xs text-slate-500">
                    {signalDryRun.candidateCounts.total} candidates / high {signalDryRun.candidateCounts.highConfidence} / review {signalDryRun.candidateCounts.reviewRequired}
                  </p>
                )}
                <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">
                  {(signalDryRun?.candidates || []).slice(0, 12).map((candidate) => (
                    <div key={candidate.candidateId} className="rounded-md border border-slate-200 bg-slate-50 p-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{candidate.sourceKind}</Badge>
                        <span className="text-xs font-medium text-slate-700">{Math.round(candidate.confidence * 100)}%</span>
                        {candidate.reviewRequired && <span className="text-xs text-amber-700">review</span>}
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm font-medium text-slate-950">{candidate.title}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-slate-500">{candidate.snippet}</p>
                    </div>
                  ))}
                </div>
              </DryRunPanel>

              <DryRunPanel
                icon={<Send className="h-4 w-4 text-amber-600" />}
                title="nudge dry-run"
                actionLabel="候補確認"
                loading={runningNudges}
                onAction={runNudgeDryRun}
              >
                {nudgeDryRun?.candidateCounts && (
                  <p className="text-xs text-slate-500">
                    {nudgeDryRun.candidateCounts.total} candidates / sendable {nudgeDryRun.candidateCounts.sendable} / blocked {nudgeDryRun.candidateCounts.blocked}
                  </p>
                )}
                <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">
                  {(nudgeDryRun?.candidates || []).map((candidate) => (
                    <div key={candidate.contractId} className="rounded-md border border-slate-200 bg-slate-50 p-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{candidate.projectId}</Badge>
                        <span className="text-xs font-medium text-amber-700">{candidate.staleDays}日</span>
                        {candidate.blocker && <span className="text-xs text-rose-700">{candidate.blocker}</span>}
                      </div>
                      <p className="mt-1 text-sm font-medium text-slate-950">{candidate.contractTitle}</p>
                      <p className="mt-1 whitespace-pre-wrap text-xs text-slate-500">{candidate.dryRunMessage}</p>
                    </div>
                  ))}
                </div>
              </DryRunPanel>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3">
      <div className="flex items-center gap-2 text-xs font-medium uppercase text-slate-500">
        {icon}
        {label}
      </div>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
      <p className="text-[11px] font-medium uppercase text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function DryRunPanel({
  icon,
  title,
  actionLabel,
  loading,
  onAction,
  children,
}: {
  icon: ReactNode;
  title: string;
  actionLabel: string;
  loading: boolean;
  onAction: () => void;
  children: ReactNode;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="min-w-0 flex-1 text-sm font-semibold text-slate-950">{title}</h3>
        <Button type="button" variant="outline" size="sm" onClick={onAction} disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          {actionLabel}
        </Button>
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}
