"use client";

import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Banknote,
  BriefcaseBusiness,
  CalendarRange,
  ChevronRight,
  Copyright,
  FileCheck2,
  FileSignature,
  FileText,
  Link2,
  ListFilter,
  Loader2,
  Plus,
  ReceiptText,
  RefreshCw,
  Save,
  Scale,
  Search,
  Send,
  Shield,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CONTRACT_STATUSES, type ContractStatus } from "@/lib/contracts";
import {
  consolidateContractRecords,
  resolveConfidentiality,
  resolveContractPeriod,
  resolveSignatureProof,
  type ContractLedgerRow,
} from "@/lib/contracts-ledger";
import {
  boolTerm,
  termsHaveOperationalDetail,
  textTerm,
  type ContractRelationshipScope,
  type ProjectContractTerms,
  type ProjectCurrentContract,
} from "@/lib/project-contract-terms";

type Project = {
  id: string;
  project_id: string;
  project_name: string;
  status: string | null;
  slack_channel_id: string | null;
  start_ym: string | null;
  end_ym: string | null;
  contract_terms_json: ProjectContractTerms | null;
};

type ContractRow = {
  contract_id: string;
  project_id: string;
  contract_title: string;
  canonical_title: string | null;
  canonical_contract_id: string | null;
  counterparty_name: string | null;
  contract_type: string;
  status: ContractStatus;
  registry_status: "candidate" | "accepted" | "evidence_only" | "rejected";
  relationship_scope: ContractRelationshipScope;
  is_current_for_project: boolean;
  amd_entity_name: string | null;
  amd_party_role: string | null;
  party_confirmation_note: string | null;
  party_confirmed_at: string | null;
  party_confirmed_by: string | null;
  operational_terms_json: ProjectContractTerms | null;
  expected_signing_date: string | null;
  effective_date: string | null;
  expiration_date: string | null;
  renewal_notice_date: string | null;
  renewal_type: string | null;
  contract_value_yen: number | null;
  business_owner: string | null;
  ledger_notes: string | null;
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
  confidentiality_coverage: "in_contract" | "separate_nda" | "not_included" | "unknown";
  confidentiality_survival_note: string | null;
  confidentiality_note: string | null;
  projects?: { project_name?: string | null; slack_channel_id?: string | null } | null;
};

type LedgerContract = ContractLedgerRow<ContractRow>;

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
  confidence: number;
  status: string;
};

type ContractTerm = {
  term_id: string;
  contract_id: string | null;
  project_id: string;
  source_kind: string;
  source_url: string | null;
  source_title: string;
  contract_no: string | null;
  quote_no: string | null;
  contract_title: string | null;
  counterparty_name: string | null;
  period_start: string | null;
  period_end: string | null;
  amount_tax_excl: number | null;
  amount_tax_incl: number | null;
  billing_distribution: string;
  extracted_terms_json: Record<string, unknown> | null;
  confidence: number;
  review_status: string;
  status: string;
  created_at: string;
};

type ContractNudge = {
  nudge_id: string;
  contract_id: string;
  project_id: string;
  status: string;
  stale_days: number;
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
  terms?: ContractTerm[];
  nudges?: ContractNudge[];
  projects?: Project[];
  driveDestination?: { path: string; folderIdConfigured: boolean; folderIdEnv: string };
};

type SignalCandidate = {
  candidateId: string;
  projectId: string;
  sourceKind: string;
  title: string;
  snippet: string;
  confidence: number;
  reviewRequired: boolean;
};

type TermCandidate = {
  candidateId: string;
  sourceKind: string;
  sourceTitle: string;
  contractNo: string | null;
  counterpartyName: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  amountTaxExcl: number | null;
  amountTaxIncl: number | null;
  feeTypeHint: string;
  deliverablesRequired: boolean | null;
  deliverablesNote: string | null;
  expenseReimbursementAllowed: boolean | null;
  expenseReimbursementNote: string | null;
  confidence: number;
};

type SignalDryRunResponse = {
  ok?: boolean;
  error?: string;
  candidates?: SignalCandidate[];
  termCandidates?: TermCandidate[];
  candidateCounts?: { total: number; highConfidence: number; reviewRequired: number };
  termCandidateCounts?: { total: number; withAmount: number; withPeriod: number };
};

type NudgeCandidate = {
  contractId: string;
  projectId: string;
  contractTitle: string;
  staleDays: number;
  dryRunMessage: string;
  blocker: string | null;
};

type NudgeDryRunResponse = {
  ok?: boolean;
  error?: string;
  candidates?: NudgeCandidate[];
  candidateCounts?: { total: number; sendable: number; blocked: number };
};

type ContractEditState = typeof BLANK_CONTRACT_EDIT;

const STATUS_LABEL: Record<ContractStatus, string> = {
  planned: "予定枠",
  drafting: "作成中",
  under_review: "レビュー中",
  awaiting_signature: "押印待ち",
  signed: "押印済み記録",
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

const CONTRACT_TYPE_LABEL: Record<string, string> = {
  contract: "契約",
  nda: "NDA",
  outsourcing: "業務委託",
  joint_research: "共同研究",
  mou: "MOU/覚書",
  order: "発注/SOW",
  investment: "投資",
  employment: "雇用",
  mandate: "委任/顧問",
};

const CONTROL_CLASS = "h-8 w-full min-w-0 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200";

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

const BLANK_CONTRACT_EDIT = {
  canonicalTitle: "",
  counterpartyName: "",
  contractType: "contract",
  effectiveDate: "",
  expirationDate: "",
  renewalNoticeDate: "",
  renewalType: "",
  businessOwner: "",
  ledgerNotes: "",
  relationshipScope: "needs_review" as ContractRelationshipScope,
  currentForProject: false,
  amdEntityName: "株式会社チームアルマダ",
  amdPartyRole: "",
  partyConfirmationNote: "",
  contractValueYen: "",
  paymentTerms: "",
  taxTreatment: "",
  scopeSummary: "",
  deliverablesRequired: "unknown",
  deliverablesNote: "",
  acceptanceTerms: "",
  monthlyReportSubmissionRule: "",
  monthlyReportSubmissionNote: "",
  confidentialityCoverage: "unknown",
  confidentialitySurvivalNote: "",
  confidentialityNote: "",
  expenseReimbursementAllowed: "unknown",
  expenseReimbursementNote: "",
  ipOwnership: "",
  usageRights: "",
  publicityRights: "",
  subcontractingTerms: "",
  exclusivityTerms: "",
  terminationTerms: "",
  liabilityTerms: "",
  governingLawJurisdiction: "",
  specialTerms: "",
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
  if (/^\d{4}-\d{2}$/.test(value)) return value.replace("-", "/");
  return value.slice(0, 10).replaceAll("-", "/");
}

function dateForComparison(value: string | null | undefined) {
  if (!value) return null;
  const normalized = /^\d{4}-\d{2}$/.test(value) ? `${value}-28T23:59:59+09:00` : `${value.slice(0, 10)}T23:59:59+09:00`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysUntil(value: string | null | undefined) {
  const date = dateForComparison(value);
  if (!date) return null;
  return Math.ceil((date.getTime() - Date.now()) / 86_400_000);
}

function remainingLabel(value: string | null | undefined) {
  const days = daysUntil(value);
  if (days === null) return "終了日未確認";
  if (days < 0) return `${Math.abs(days)}日経過`;
  if (days === 0) return "今日まで";
  return `残り${days}日`;
}

function contractTitle(contract: Pick<ContractRow, "canonical_title" | "contract_title">) {
  return contract.canonical_title || contract.contract_title;
}

function contractTypeLabel(value: string) {
  return CONTRACT_TYPE_LABEL[value] || value || "契約";
}

function yen(value: number | string | null | undefined) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount === 0) return "-";
  return `${amount.toLocaleString("ja-JP")}円`;
}

function boolish(value: unknown): boolean | null {
  if (value === true || value === "true" || value === "あり" || value === "可" || value === "yes") return true;
  if (value === false || value === "false" || value === "なし" || value === "不可" || value === "no") return false;
  return null;
}

function termFlag(value: unknown, trueLabel: string, falseLabel: string) {
  const normalized = boolish(value);
  if (normalized === true) return trueLabel;
  if (normalized === false) return falseLabel;
  return "未確認";
}

function effectiveContractTerms(contract: LedgerContract, project?: Project) {
  const projectTerms = project?.contract_terms_json;
  const explicitContracts = Array.isArray(projectTerms?.currentContracts)
    ? projectTerms.currentContracts
    : null;
  const matchingContract = explicitContracts?.find((item) => {
    const contractId = textTerm(item.contractId);
    return Boolean(contractId && contract.related_contract_ids.includes(contractId));
  });
  const legacyTerms = contract.is_current_for_project && explicitContracts === null
    ? projectTerms || {}
    : {};
  return {
    ...legacyTerms,
    ...(matchingContract?.terms || {}),
    ...(contract.operational_terms_json || {}),
  } as ProjectContractTerms;
}

function joinedTerms(values: unknown[], fallback = "未確認") {
  const normalized = values.map(textTerm).filter((value): value is string => Boolean(value));
  return normalized.length > 0 ? normalized.join(" / ") : fallback;
}

function expenseSummary(terms: ProjectContractTerms) {
  const allowed = boolTerm(terms.expenseReimbursementAllowed);
  const note = textTerm(terms.expenseReimbursementNote);
  if (allowed === false) return { label: "申請不可", note: note || "契約条件で不可" };
  if (allowed === true) return { label: "申請可", note: note || "条件記録なし" };
  return { label: "未確認", note: note || "費用負担の確認記録なし" };
}

function contractTermsCoverage(terms: ProjectContractTerms) {
  const groups = [
    Boolean(textTerm(terms.paymentTerms) || terms.monthlyFeeYen || terms.amountTaxExclTotal),
    Boolean(textTerm(terms.scopeSummary) || textTerm(terms.deliverablesNote) || textTerm(terms.acceptanceTerms)),
    boolTerm(terms.expenseReimbursementAllowed) !== null || Boolean(textTerm(terms.expenseReimbursementNote)),
    Boolean(textTerm(terms.ipOwnership) || textTerm(terms.usageRights)),
    Boolean(textTerm(terms.confidentialitySummary)),
    Boolean(textTerm(terms.terminationTerms) || textTerm(terms.liabilityTerms)),
  ];
  return groups.filter(Boolean).length;
}

function paymentSummary(contract: LedgerContract, terms: ProjectContractTerms) {
  const primary = contract.contract_value_yen
    ? `契約額 ${yen(contract.contract_value_yen)}`
    : terms.amountTaxExclTotal
      ? `税抜総額 ${yen(terms.amountTaxExclTotal)}`
      : terms.monthlyFeeYen
        ? `月額 ${yen(terms.monthlyFeeYen)}`
        : "金額未確認";
  return {
    primary,
    secondary: joinedTerms([
      (contract.contract_value_yen || terms.amountTaxExclTotal) && terms.monthlyFeeYen
        ? `月額 ${yen(terms.monthlyFeeYen)}`
        : null,
      terms.paymentTerms,
      terms.taxTreatment,
    ]),
  };
}

function statusBadge(status: ContractStatus) {
  return (
    <span className={`inline-flex h-6 items-center rounded-md border px-2 text-xs font-medium ${STATUS_TONE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

function documentKindLabel(kind: ContractDocument["document_kind"]) {
  return {
    draft: "ドラフト",
    revision: "修正版",
    redline: "赤入れ",
    signed: "押印版",
    other: "その他",
  }[kind];
}

function documentFormat(doc: ContractDocument) {
  const extension = doc.file_name.split(".").at(-1)?.toUpperCase();
  if (extension && extension.length <= 8) return extension;
  if (doc.mime_type.includes("pdf")) return "PDF";
  if (doc.mime_type.includes("word")) return "WORD";
  return "FILE";
}

function rowDocuments(contract: LedgerContract, docsByContract: Map<string, ContractDocument[]>) {
  return contract.related_contract_ids.flatMap((contractId) => docsByContract.get(contractId) || []);
}

function contractNeedsAttention(contract: LedgerContract, project: Project | undefined, documents: ContractDocument[]) {
  const period = resolveContractPeriod(contract, project);
  const terms = effectiveContractTerms(contract, project);
  const confidentiality = resolveConfidentiality(contract);
  const signature = resolveSignatureProof(contract, documents);
  return !contract.counterparty_name
    || !period.end
    || !termsHaveOperationalDetail(terms)
    || confidentiality.state === "unknown"
    || signature.state === "needs_proof";
}

export function ContractsClient() {
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [documents, setDocuments] = useState<ContractDocument[]>([]);
  const [signals, setSignals] = useState<ContractSignal[]>([]);
  const [terms, setTerms] = useState<ContractTerm[]>([]);
  const [nudges, setNudges] = useState<ContractNudge[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [driveDestination, setDriveDestination] = useState<ContractsResponse["driveDestination"] | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ledger");
  const [projectFilter, setProjectFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [setupRequired, setSetupRequired] = useState(false);
  const [newContract, setNewContract] = useState(BLANK_CONTRACT);
  const [newDocument, setNewDocument] = useState(BLANK_DOCUMENT);
  const [contractEdit, setContractEdit] = useState<ContractEditState>(BLANK_CONTRACT_EDIT);
  const [signalDryRun, setSignalDryRun] = useState<SignalDryRunResponse | null>(null);
  const [nudgeDryRun, setNudgeDryRun] = useState<NudgeDryRunResponse | null>(null);
  const [runningSignals, setRunningSignals] = useState(false);
  const [runningNudges, setRunningNudges] = useState(false);

  const projectById = useMemo(() => new Map(projects.map((project) => [project.project_id, project])), [projects]);

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
    signals.forEach((signal) => map.set(signal.project_id, [...(map.get(signal.project_id) || []), signal]));
    return map;
  }, [signals]);

  const termsByProject = useMemo(() => {
    const map = new Map<string, ContractTerm[]>();
    terms.forEach((term) => map.set(term.project_id, [...(map.get(term.project_id) || []), term]));
    map.forEach((list) => list.sort((a, b) => b.confidence - a.confidence || String(b.created_at).localeCompare(String(a.created_at))));
    return map;
  }, [terms]);

  const nudgesByContract = useMemo(() => {
    const map = new Map<string, ContractNudge[]>();
    nudges.forEach((nudge) => map.set(nudge.contract_id, [...(map.get(nudge.contract_id) || []), nudge]));
    return map;
  }, [nudges]);

  const ledgerContracts = useMemo(() => consolidateContractRecords(contracts), [contracts]);

  const filteredContracts = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return ledgerContracts.filter((contract) => {
      const registryStatus = contract.registry_status || "candidate";
      const relationshipScope = contract.relationship_scope || "needs_review";
      const project = projectById.get(contract.project_id);
      const rowDocs = rowDocuments(contract, docsByContract);
      const isScopeReview = statusFilter === "scope_review";
      const isExcludedReview = statusFilter === "excluded";
      if (isScopeReview && relationshipScope !== "needs_review") return false;
      if (isExcludedReview && !["third_party", "template"].includes(relationshipScope)) return false;
      if (!isScopeReview && !isExcludedReview && relationshipScope !== "amd_contract") return false;
      if (statusFilter === "ledger" && (["evidence_only", "rejected"].includes(registryStatus) || contract.status === "cancelled")) return false;
      if (projectFilter && contract.project_id !== projectFilter) return false;
      if (statusFilter === "current") {
        if (!contract.is_current_for_project || ["evidence_only", "rejected"].includes(registryStatus) || contract.status === "cancelled") return false;
      } else if (statusFilter === "needs_metadata") {
        const period = resolveContractPeriod(contract, project);
        if (["evidence_only", "rejected"].includes(registryStatus) || contract.status === "cancelled") return false;
        const effectiveTerms = effectiveContractTerms(contract, project);
        if (contract.counterparty_name && period.start && period.end && contractTermsCoverage(effectiveTerms) >= 4) return false;
      } else if (statusFilter === "needs_attention") {
        if (["evidence_only", "rejected"].includes(registryStatus) || contract.status === "cancelled") return false;
        if (!contractNeedsAttention(contract, project, rowDocs)) return false;
      } else if (statusFilter === "expiring") {
        const period = resolveContractPeriod(contract, project);
        const relevant = [daysUntil(period.end), daysUntil(contract.renewal_notice_date)]
          .some((days) => days !== null && days <= 90);
        if (["evidence_only", "rejected"].includes(registryStatus) || contract.status === "cancelled" || !relevant) return false;
      } else if (!["ledger", "all", "scope_review", "excluded"].includes(statusFilter) && contract.status !== statusFilter) {
        return false;
      }
      if (!needle) return true;
      return [
        contractTitle(contract),
        contract.counterparty_name,
        contract.contract_type,
        contract.business_owner,
        contract.confidentiality_note,
        contract.amd_entity_name,
        JSON.stringify(contract.operational_terms_json || {}),
        project?.project_name,
        project?.project_id,
        project?.contract_terms_json?.expenseReimbursementNote,
        ...contract.related_titles,
        ...rowDocs.map((doc) => doc.file_name),
      ].join(" ").toLowerCase().includes(needle);
    });
  }, [docsByContract, ledgerContracts, projectById, projectFilter, query, statusFilter]);

  const metrics = useMemo(() => {
    const ledger = ledgerContracts.filter((contract) => contract.relationship_scope === "amd_contract" && !["evidence_only", "rejected"].includes(contract.registry_status) && contract.status !== "cancelled");
    const entries = ledger.map((contract) => ({
      contract,
      project: projectById.get(contract.project_id),
      documents: rowDocuments(contract, docsByContract),
    }));
    return {
      ledger: ledger.length,
      current: ledger.filter((contract) => contract.is_current_for_project).length,
      attention: entries.filter(({ contract, project, documents: rowDocs }) => contractNeedsAttention(contract, project, rowDocs)).length,
      expiryUnknown: entries.filter(({ contract, project }) => !resolveContractPeriod(contract, project).end).length,
      termsIncomplete: entries.filter(({ contract, project }) => contractTermsCoverage(effectiveContractTerms(contract, project)) < 4).length,
      scopeReview: ledgerContracts.filter((contract) => contract.relationship_scope === "needs_review").length,
    };
  }, [docsByContract, ledgerContracts, projectById]);

  const selected = useMemo(
    () => ledgerContracts.find((contract) => contract.contract_id === selectedId) || null,
    [ledgerContracts, selectedId],
  );
  const selectedProject = selected ? projectById.get(selected.project_id) : undefined;
  const selectedContractIds = selected?.related_contract_ids || [];
  const selectedDocuments = selected
    ? rowDocuments(selected, docsByContract).sort((a, b) => String(b.received_at).localeCompare(String(a.received_at)))
    : [];
  const selectedSignals = selected
    ? (signalsByProject.get(selected.project_id) || []).filter((signal) => signal.contract_id && selectedContractIds.includes(signal.contract_id))
    : [];
  const selectedTerms = selected
    ? (termsByProject.get(selected.project_id) || []).filter((term) => term.contract_id && selectedContractIds.includes(term.contract_id)).slice(0, 8)
    : [];
  const unlinkedProjectTerms = selected
    ? (termsByProject.get(selected.project_id) || []).filter((term) => !term.contract_id).slice(0, 5)
    : [];
  const selectedNudges = selected
    ? selectedContractIds.flatMap((contractId) => nudgesByContract.get(contractId) || []).sort((a, b) => String(b.candidate_at).localeCompare(String(a.candidate_at)))
    : [];

  useEffect(() => {
    if (!selected) {
      setContractEdit(BLANK_CONTRACT_EDIT);
      return;
    }
    const terms = effectiveContractTerms(selected, projectById.get(selected.project_id));
    const selectedExpense = expenseSummary(terms);
    setContractEdit({
      canonicalTitle: contractTitle(selected),
      counterpartyName: selected.counterparty_name || "",
      contractType: selected.contract_type || "contract",
      effectiveDate: selected.effective_date || "",
      expirationDate: selected.expiration_date || "",
      renewalNoticeDate: selected.renewal_notice_date || "",
      renewalType: selected.renewal_type || "",
      businessOwner: selected.business_owner || "",
      ledgerNotes: selected.ledger_notes || "",
      relationshipScope: selected.relationship_scope || "needs_review",
      currentForProject: Boolean(selected.is_current_for_project),
      amdEntityName: selected.amd_entity_name || "株式会社チームアルマダ",
      amdPartyRole: selected.amd_party_role || "",
      partyConfirmationNote: selected.party_confirmation_note || "",
      contractValueYen: selected.contract_value_yen ? String(selected.contract_value_yen) : "",
      paymentTerms: textTerm(terms.paymentTerms) || "",
      taxTreatment: textTerm(terms.taxTreatment) || "",
      scopeSummary: textTerm(terms.scopeSummary) || "",
      deliverablesRequired: boolTerm(terms.deliverablesRequired) === true ? "required" : boolTerm(terms.deliverablesRequired) === false ? "not_required" : "unknown",
      deliverablesNote: textTerm(terms.deliverablesNote) || "",
      acceptanceTerms: textTerm(terms.acceptanceTerms) || "",
      monthlyReportSubmissionRule: textTerm(terms.monthlyReportSubmissionRule) || "",
      monthlyReportSubmissionNote: textTerm(terms.monthlyReportSubmissionNote) || "",
      confidentialityCoverage: selected.confidentiality_coverage || "unknown",
      confidentialitySurvivalNote: selected.confidentiality_survival_note || "",
      confidentialityNote: selected.confidentiality_note || textTerm(terms.confidentialitySummary) || "",
      expenseReimbursementAllowed: boolTerm(terms.expenseReimbursementAllowed) === true ? "allowed" : boolTerm(terms.expenseReimbursementAllowed) === false ? "not_allowed" : "unknown",
      expenseReimbursementNote: textTerm(terms.expenseReimbursementNote) || selectedExpense.note || "",
      ipOwnership: textTerm(terms.ipOwnership) || "",
      usageRights: textTerm(terms.usageRights) || "",
      publicityRights: textTerm(terms.publicityRights) || "",
      subcontractingTerms: textTerm(terms.subcontractingTerms) || "",
      exclusivityTerms: textTerm(terms.exclusivityTerms) || "",
      terminationTerms: textTerm(terms.terminationTerms) || "",
      liabilityTerms: textTerm(terms.liabilityTerms) || "",
      governingLawJurisdiction: textTerm(terms.governingLawJurisdiction) || "",
      specialTerms: textTerm(terms.specialTerms) || "",
    });
  }, [projectById, selected]);

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
      setTerms(json.terms || []);
      setNudges(json.nudges || []);
      setProjects(json.projects || []);
      setDriveDestination(json.driveDestination || null);
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
      setCreateOpen(false);
      if (json.contract?.contract_id) setSelectedId(json.contract.contract_id);
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(contractId: string, status: ContractStatus) {
    if ((status === "signed" || status === "cancelled") && !window.confirm(`状態を「${STATUS_LABEL[status]}」へ変更する？`)) return;
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

  async function saveContractInfo(event: FormEvent) {
    event.preventDefault();
    if (!selected || saving) return;
    setSaving(true);
    setError("");
    try {
      const currentForProject = contractEdit.relationshipScope === "amd_contract" && contractEdit.currentForProject;
      const operationalTerms: ProjectContractTerms = {
        paymentTerms: textTerm(contractEdit.paymentTerms),
        taxTreatment: textTerm(contractEdit.taxTreatment),
        scopeSummary: textTerm(contractEdit.scopeSummary),
        deliverablesRequired: contractEdit.deliverablesRequired === "required"
          ? true
          : contractEdit.deliverablesRequired === "not_required"
            ? false
            : null,
        deliverablesNote: textTerm(contractEdit.deliverablesNote),
        acceptanceTerms: textTerm(contractEdit.acceptanceTerms),
        monthlyReportSubmissionRule: textTerm(contractEdit.monthlyReportSubmissionRule),
        monthlyReportSubmissionNote: textTerm(contractEdit.monthlyReportSubmissionNote),
        expenseReimbursementAllowed: contractEdit.expenseReimbursementAllowed === "allowed"
          ? true
          : contractEdit.expenseReimbursementAllowed === "not_allowed"
            ? false
            : null,
        expenseReimbursementNote: textTerm(contractEdit.expenseReimbursementNote),
        ipOwnership: textTerm(contractEdit.ipOwnership),
        usageRights: textTerm(contractEdit.usageRights),
        publicityRights: textTerm(contractEdit.publicityRights),
        confidentialitySummary: textTerm(contractEdit.confidentialityNote),
        confidentialitySurvival: textTerm(contractEdit.confidentialitySurvivalNote),
        subcontractingTerms: textTerm(contractEdit.subcontractingTerms),
        exclusivityTerms: textTerm(contractEdit.exclusivityTerms),
        terminationTerms: textTerm(contractEdit.terminationTerms),
        liabilityTerms: textTerm(contractEdit.liabilityTerms),
        governingLawJurisdiction: textTerm(contractEdit.governingLawJurisdiction),
        specialTerms: textTerm(contractEdit.specialTerms),
      };
      const linkRes = await fetch("/api/contracts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contract_ids: selected.related_contract_ids,
          canonical_contract_id: selected.contract_id,
        }),
      });
      const linkJson = (await linkRes.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!linkRes.ok || !linkJson.ok) {
        setError(linkJson.error || `HTTP ${linkRes.status}`);
        return;
      }
      const contractRes = await fetch(`/api/contracts/${encodeURIComponent(selected.contract_id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canonical_contract_id: selected.contract_id,
          canonical_title: contractEdit.canonicalTitle,
          counterparty_name: contractEdit.counterpartyName,
          contract_type: contractEdit.contractType,
          effective_date: contractEdit.effectiveDate || null,
          expiration_date: contractEdit.expirationDate || null,
          renewal_notice_date: contractEdit.renewalNoticeDate || null,
          renewal_type: contractEdit.renewalType || null,
          business_owner: contractEdit.businessOwner || null,
          ledger_notes: contractEdit.ledgerNotes || null,
          relationship_scope: contractEdit.relationshipScope,
          is_current_for_project: currentForProject,
          amd_entity_name: contractEdit.amdEntityName,
          amd_party_role: contractEdit.amdPartyRole || null,
          party_confirmation_note: contractEdit.partyConfirmationNote || null,
          contract_value_yen: contractEdit.contractValueYen || null,
          operational_terms_json: operationalTerms,
          confidentiality_coverage: contractEdit.confidentialityCoverage,
          confidentiality_survival_note: contractEdit.confidentialitySurvivalNote || null,
          confidentiality_note: contractEdit.confidentialityNote || null,
        }),
      });
      const contractJson = (await contractRes.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!contractRes.ok || !contractJson.ok) {
        setError(contractJson.error || `HTTP ${contractRes.status}`);
        return;
      }
      if (selectedProject?.id) {
        const baseTerms = selectedProject.contract_terms_json || {};
        const existingCurrentContracts = Array.isArray(baseTerms.currentContracts)
          ? baseTerms.currentContracts
          : [];
        const withoutSelected = existingCurrentContracts.filter((item) => item.contractId !== selected.contract_id);
        const currentContract: ProjectCurrentContract = {
          contractId: selected.contract_id,
          title: contractEdit.canonicalTitle,
          contractType: contractEdit.contractType,
          status: selected.status,
          signatureStatus: selected.status === "signed" ? "押印済み記録" : STATUS_LABEL[selected.status],
          counterpartyName: contractEdit.counterpartyName,
          effectiveDate: contractEdit.effectiveDate || null,
          expirationDate: contractEdit.expirationDate || null,
          renewalType: contractEdit.renewalType || null,
          renewalNoticeDate: contractEdit.renewalNoticeDate || null,
          terms: {
            ...operationalTerms,
            amountTaxExclTotal: contractEdit.contractValueYen || null,
          },
        };
        const currentContracts = currentForProject
          ? [...withoutSelected, currentContract]
          : withoutSelected;
        const mirroredTerms: ProjectContractTerms = currentForProject
          ? {
              ...baseTerms,
              currentContracts,
              currentContractId: selected.contract_id,
              currentContractTitle: contractEdit.canonicalTitle,
              currentContractType: contractEdit.contractType,
              currentContractStatus: selected.status,
              signatureStatus: currentContract.signatureStatus,
              counterpartyName: contractEdit.counterpartyName || baseTerms.counterpartyName || null,
              contractStartYm: contractEdit.effectiveDate ? contractEdit.effectiveDate.slice(0, 7).replace("-", "") : baseTerms.contractStartYm,
              contractEndYm: contractEdit.expirationDate ? contractEdit.expirationDate.slice(0, 7).replace("-", "") : baseTerms.contractEndYm,
              renewalType: contractEdit.renewalType || null,
              renewalNoticeDate: contractEdit.renewalNoticeDate || null,
              sourceTitle: contractEdit.canonicalTitle || baseTerms.sourceTitle || null,
              sourceRef: `contracts:${selected.contract_id}`,
            }
          : {
              ...baseTerms,
              currentContracts,
              currentContractId: baseTerms.currentContractId === selected.contract_id ? null : baseTerms.currentContractId,
            };
        const projectRes = await fetch(`/api/admin/projects/${encodeURIComponent(selectedProject.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectsPatch: {
              contract_terms_json: mirroredTerms,
            },
          }),
        });
        const projectJson = (await projectRes.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (!projectRes.ok || !projectJson.ok) {
          setError(projectJson.error || `HTTP ${projectRes.status}`);
          return;
        }
      }
      await loadContracts();
      setSelectedId(selected.contract_id);
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

  return (
    <main className="min-h-[calc(100vh-44px)] bg-slate-50">
      <div className="w-full space-y-4 p-3 sm:p-4">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <p className="text-[11px] font-semibold text-slate-500">管理 / 契約</p>
            <h1 className="text-2xl font-semibold tracking-normal text-slate-950">契約台帳</h1>
          </div>
          <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800">
            <ShieldCheck className="h-3 w-3" /> 管理者限定
          </Badge>
        </header>

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p>{error}</p>
              {setupRequired && <p className="mt-1 text-xs">契約管理用のデータ準備が必要</p>}
            </div>
          </div>
        )}

        <section className="grid grid-cols-2 overflow-hidden rounded-md border border-slate-200 bg-white sm:grid-cols-3 xl:grid-cols-6" aria-label="契約台帳の要対応状況">
          <SummaryButton label="AMD当事者契約" value={metrics.ledger} active={statusFilter === "ledger"} onClick={() => setStatusFilter("ledger")} />
          <SummaryButton label="PJ現行契約" value={metrics.current} active={statusFilter === "current"} onClick={() => setStatusFilter("current")} />
          <SummaryButton label="要対応" value={metrics.attention} tone="danger" active={statusFilter === "needs_attention"} onClick={() => setStatusFilter("needs_attention")} />
          <SummaryButton label="期限未確認" value={metrics.expiryUnknown} tone="warning" active={statusFilter === "needs_metadata"} onClick={() => setStatusFilter("needs_metadata")} />
          <SummaryButton label="条件不足" value={metrics.termsIncomplete} tone="warning" active={statusFilter === "needs_metadata"} onClick={() => setStatusFilter("needs_metadata")} />
          <SummaryButton label="当事者判定待ち" value={metrics.scopeReview} tone="warning" active={statusFilter === "scope_review"} onClick={() => setStatusFilter("scope_review")} />
        </section>

        <section className="overflow-hidden rounded-md border border-slate-200 bg-white" aria-label="契約一覧">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-3">
            <label className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="契約を検索"
                className="h-8 w-full rounded-md border border-slate-200 bg-slate-50 pl-8 pr-2 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
                placeholder="PJ、相手先、契約名、文書名で検索"
              />
            </label>
            <label className="relative">
              <ListFilter className="pointer-events-none absolute left-2 top-2 h-4 w-4 text-slate-400" />
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="契約の表示条件" className="h-8 w-[180px] rounded-md border border-slate-200 bg-white pl-8 pr-2 text-sm">
                <option value="ledger">AMD当事者契約</option>
                <option value="current">PJ現行契約</option>
                <option value="needs_attention">要対応</option>
                <option value="expiring">期限90日以内</option>
                <option value="needs_metadata">契約条件不足</option>
                <option value="scope_review">当事者判定待ち</option>
                <option value="excluded">第三者間・雛形</option>
                <option value="all">AMD契約の全記録</option>
                {CONTRACT_STATUSES.map((status) => <option key={status} value={status}>{STATUS_LABEL[status]}</option>)}
              </select>
            </label>
            <select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)} aria-label="PJで絞り込む" className="h-8 w-[170px] rounded-md border border-slate-200 bg-white px-2 text-sm">
              <option value="">全PJ</option>
              {projects.map((project) => <option key={project.project_id} value={project.project_id}>{project.project_id} {project.project_name}</option>)}
            </select>
            <Button type="button" variant="outline" size="sm" onClick={loadContracts} disabled={loading} title="最新情報へ更新">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span className="hidden sm:inline">更新</span>
            </Button>
            <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> 契約を追加
            </Button>
          </div>

          <div className="border-b border-slate-200 px-3 py-2 text-xs text-slate-500">
            {filteredContracts.length}件の契約
            {filteredContracts.reduce((sum, contract) => sum + contract.related_record_count, 0) !== filteredContracts.length && (
              <span className="ml-2">関連記録を契約単位に整理済み</span>
            )}
          </div>

          <div className="divide-y divide-slate-100 xl:hidden">
            {filteredContracts.map((contract) => (
              <MobileContractRow
                key={contract.contract_id}
                contract={contract}
                project={projectById.get(contract.project_id)}
                documents={rowDocuments(contract, docsByContract)}
                onOpen={() => setSelectedId(contract.contract_id)}
              />
            ))}
          </div>

          <div className="hidden max-h-[calc(100vh-270px)] overflow-auto overscroll-x-contain xl:block">
            <table className="w-full min-w-[1760px] table-fixed border-collapse text-left text-xs">
              <colgroup>
                <col className="w-[160px]" />
                <col className="w-[340px]" />
                <col className="w-[250px]" />
                <col className="w-[230px]" />
                <col className="w-[270px]" />
                <col className="w-[230px]" />
                <col className="w-[280px]" />
              </colgroup>
              <thead className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50 text-[11px] text-slate-500">
                <tr>
                  <th className="sticky left-0 z-30 border-r border-slate-200 bg-slate-50 px-3 py-2 font-semibold">PJ</th>
                  <th className="sticky left-[160px] z-30 border-r border-slate-200 bg-slate-50 px-3 py-2 font-semibold shadow-[5px_0_8px_-7px_rgba(15,23,42,0.35)]">契約</th>
                  <th className="px-3 py-2 font-semibold">状態・期間</th>
                  <th className="px-3 py-2 font-semibold">金額・支払</th>
                  <th className="px-3 py-2 font-semibold">業務・成果物</th>
                  <th className="px-3 py-2 font-semibold">費用・報告</th>
                  <th className="px-3 py-2 font-semibold">権利・制限・リスク</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredContracts.map((contract) => (
                  <DesktopContractRow
                    key={contract.contract_id}
                    contract={contract}
                    project={projectById.get(contract.project_id)}
                    documents={rowDocuments(contract, docsByContract)}
                    onOpen={() => setSelectedId(contract.contract_id)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {filteredContracts.length === 0 && <div className="px-3 py-12 text-center text-sm text-slate-500">該当する契約なし</div>}
        </section>

        <details className="rounded-md border border-slate-200 bg-white">
          <summary className="cursor-pointer list-none px-3 py-2 text-sm font-semibold text-slate-700">検知・通知候補の運用ツール</summary>
          <div className="grid gap-3 border-t border-slate-200 p-3 xl:grid-cols-2">
            <DryRunPanel icon={<Sparkles className="h-4 w-4 text-sky-600" />} title="契約予兆・条件候補" actionLabel="候補を確認" loading={runningSignals} onAction={runSignalDryRun}>
              {signalDryRun?.candidateCounts && <p className="text-xs text-slate-500">予兆 {signalDryRun.candidateCounts.total}件 / 要確認 {signalDryRun.candidateCounts.reviewRequired}件</p>}
              {signalDryRun?.termCandidateCounts && <p className="mt-1 text-xs text-slate-500">条件 {signalDryRun.termCandidateCounts.total}件 / 金額あり {signalDryRun.termCandidateCounts.withAmount}件</p>}
              <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
                {(signalDryRun?.termCandidates || []).slice(0, 8).map((candidate) => (
                  <div key={candidate.candidateId} className="rounded-md border border-amber-200 bg-amber-50 p-2">
                    <div className="flex items-center gap-2 text-xs text-slate-600"><Badge variant="outline" className="bg-white">条件候補</Badge>{candidate.sourceKind} / {Math.round(candidate.confidence * 100)}%</div>
                    <p className="mt-1 line-clamp-2 text-sm font-medium text-slate-950">{candidate.sourceTitle}</p>
                    <p className="mt-1 text-xs text-slate-600">{candidate.contractNo || "契約No未検出"} / {dateOnly(candidate.periodStart)} - {dateOnly(candidate.periodEnd)} / {yen(candidate.amountTaxExcl)}</p>
                  </div>
                ))}
                {(signalDryRun?.candidates || []).slice(0, 8).map((candidate) => (
                  <div key={candidate.candidateId} className="rounded-md border border-slate-200 bg-slate-50 p-2">
                    <p className="line-clamp-2 text-sm font-medium text-slate-950">{candidate.title}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-500">{candidate.snippet}</p>
                  </div>
                ))}
              </div>
            </DryRunPanel>
            <DryRunPanel icon={<Send className="h-4 w-4 text-amber-600" />} title="押印版未保存の通知候補" actionLabel="候補を確認" loading={runningNudges} onAction={runNudgeDryRun}>
              {nudgeDryRun?.candidateCounts && <p className="text-xs text-slate-500">候補 {nudgeDryRun.candidateCounts.total}件 / 通知可能 {nudgeDryRun.candidateCounts.sendable}件 / 保留 {nudgeDryRun.candidateCounts.blocked}件</p>}
              <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
                {(nudgeDryRun?.candidates || []).map((candidate) => (
                  <div key={candidate.contractId} className="rounded-md border border-slate-200 bg-slate-50 p-2">
                    <div className="flex gap-2 text-xs"><Badge variant="outline">{candidate.projectId}</Badge><span className="text-amber-700">{candidate.staleDays}日</span>{candidate.blocker && <span className="text-rose-700">{candidate.blocker}</span>}</div>
                    <p className="mt-1 text-sm font-medium text-slate-950">{candidate.contractTitle}</p>
                  </div>
                ))}
              </div>
            </DryRunPanel>
          </div>
        </details>
      </div>

      <CreateContractDialog open={createOpen} onOpenChange={setCreateOpen} projects={projects} value={newContract} onChange={setNewContract} onSubmit={createContract} saving={saving} />

      <ContractDetailDialog
        contract={selected}
        project={selectedProject}
        documents={selectedDocuments}
        signals={selectedSignals}
        linkedTerms={selectedTerms}
        unlinkedTerms={unlinkedProjectTerms}
        nudges={selectedNudges}
        driveDestination={driveDestination}
        edit={contractEdit}
        setEdit={setContractEdit}
        newDocument={newDocument}
        setNewDocument={setNewDocument}
        saving={saving}
        onOpenChange={(open) => { if (!open) setSelectedId(""); }}
        onStatusChange={(status) => selected && void updateStatus(selected.contract_id, status)}
        onSave={saveContractInfo}
        onAddDocument={addDocument}
      />
    </main>
  );
}

function SummaryButton({ label, value, tone = "default", active = false, onClick }: { label: string; value: number; tone?: "default" | "warning" | "danger"; active?: boolean; onClick?: () => void }) {
  const content = (
    <>
      <span className="text-[11px] font-medium text-slate-500">{label}</span>
      <span className={`text-xl font-semibold ${tone === "danger" ? "text-rose-700" : tone === "warning" ? "text-amber-700" : "text-slate-950"}`}>{value}</span>
    </>
  );
  const className = `flex min-h-16 flex-col justify-center border-r border-b border-slate-100 px-3 text-left transition ${active ? "bg-slate-100" : "bg-white"}`;
  return onClick ? <button type="button" onClick={onClick} className={`${className} hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-400`}>{content}</button> : <div className={className}>{content}</div>;
}

function DesktopContractRow({ contract, project, documents, onOpen }: { contract: LedgerContract; project?: Project; documents: ContractDocument[]; onOpen: () => void }) {
  const period = resolveContractPeriod(contract, project);
  const terms = effectiveContractTerms(contract, project);
  const expense = expenseSummary(terms);
  const signature = resolveSignatureProof(contract, documents);
  const confidentiality = resolveConfidentiality(contract);
  const latest = documents.find((doc) => doc.is_latest) || documents[0];
  const needsAttention = contractNeedsAttention(contract, project, documents);
  const expirationDays = daysUntil(period.end);
  const payment = paymentSummary(contract, terms);
  const deliverables = boolTerm(terms.deliverablesRequired);
  const missingGroups = Math.max(0, 6 - contractTermsCoverage(terms));
  return (
    <tr className="group bg-white hover:bg-slate-50">
      <td className="sticky left-0 z-10 border-r border-slate-100 bg-white px-3 py-2.5 align-top group-hover:bg-slate-50">
        <p className="truncate font-semibold text-slate-950">{project?.project_name || "PJ未設定"}</p>
        <p className="mt-0.5 text-[11px] text-slate-500">{contract.project_id}</p>
      </td>
      <td className="sticky left-[160px] z-10 border-r border-slate-100 bg-white px-3 py-2.5 align-top shadow-[5px_0_8px_-7px_rgba(15,23,42,0.35)] group-hover:bg-slate-50">
        <button type="button" onClick={onOpen} className="flex w-full items-start gap-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-slate-400">
          <span className="min-w-0 flex-1">
            <span className="line-clamp-2 font-semibold text-slate-950">{contractTitle(contract)}</span>
            <span className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-slate-500">
              {contractTypeLabel(contract.contract_type)}
              {contract.is_current_for_project && <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-800">PJ現行</Badge>}
              {contract.registry_status === "candidate" && <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">要確認</Badge>}
              {needsAttention && <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-700">要対応</Badge>}
            </span>
            <span className="mt-1 block truncate text-[11px] text-slate-500">{contract.amd_entity_name || "株式会社チームアルマダ"} × {contract.counterparty_name || "相手先未設定"}</span>
          </span>
          <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
        </button>
      </td>
      <td className="px-3 py-2.5 align-top">
        <div className="flex flex-wrap items-center gap-1.5">{statusBadge(contract.status)}<span className={`font-medium ${signature.state === "complete" ? "text-emerald-700" : signature.state === "needs_proof" ? "text-rose-700" : "text-amber-700"}`}>{signature.label}</span></div>
        <p className="mt-1 font-medium text-slate-800">{period.start || period.end ? `${dateOnly(period.start)} - ${dateOnly(period.end)}` : "期間未確認"}</p>
        <p className={`mt-0.5 text-[11px] ${expirationDays !== null && expirationDays <= 90 ? "font-medium text-amber-700" : "text-slate-500"}`}>{period.end ? remainingLabel(period.end) : "終了日未登録"}</p>
        {!period.end && period.referenceEnd && <p className="mt-0.5 text-[11px] text-slate-500">PJ条件 {dateOnly(period.referenceEnd)}（参考）</p>}
        <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-500">{latest ? `${latest.version_label || documentKindLabel(latest.document_kind)} / ${documentFormat(latest)}` : textTerm(terms.sourceTitle) ? "条件根拠登録済み" : "文書未登録"}</p>
      </td>
      <td className="px-3 py-2.5 align-top"><CellText primary={payment.primary} secondary={payment.secondary} /></td>
      <td className="px-3 py-2.5 align-top"><CellText primary={textTerm(terms.scopeSummary) || "業務範囲未確認"} secondary={deliverables === true ? `成果物あり${terms.deliverablesNote ? `: ${terms.deliverablesNote}` : ""}` : deliverables === false ? "成果物なし" : textTerm(terms.deliverablesNote) || "成果物未確認"} tertiary={textTerm(terms.acceptanceTerms)} /></td>
      <td className="px-3 py-2.5 align-top"><CellText primary={joinedTerms([expense.label, expense.note])} secondary={joinedTerms([terms.monthlyReportSubmissionRule, terms.monthlyReportSubmissionTiming, terms.monthlyReportSubmissionNote], "報告条件未確認")} tone={expense.label === "未確認" ? "warning" : expense.label === "申請不可" ? "danger" : "good"} /></td>
      <td className="px-3 py-2.5 align-top"><CellText primary={joinedTerms([terms.ipOwnership, terms.usageRights, terms.confidentialitySummary || confidentiality.label])} secondary={joinedTerms([terms.subcontractingTerms, terms.exclusivityTerms, terms.terminationTerms, terms.liabilityTerms])} tertiary={missingGroups > 0 ? `未確認カテゴリ ${missingGroups}件` : textTerm(terms.governingLawJurisdiction) || "主要条件確認済み"} tone={missingGroups > 0 ? "warning" : "good"} /></td>
    </tr>
  );
}

function MobileContractRow({ contract, project, documents, onOpen }: { contract: LedgerContract; project?: Project; documents: ContractDocument[]; onOpen: () => void }) {
  const period = resolveContractPeriod(contract, project);
  const terms = effectiveContractTerms(contract, project);
  const expense = expenseSummary(terms);
  const signature = resolveSignatureProof(contract, documents);
  const confidentiality = resolveConfidentiality(contract);
  const payment = paymentSummary(contract, terms);
  return (
    <button type="button" onClick={onOpen} className="block w-full p-3 text-left outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-400">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-slate-500">{contract.project_id} {project?.project_name || "PJ未設定"}</p>
          <p className="mt-1 line-clamp-2 text-sm font-semibold text-slate-950">{contractTitle(contract)}</p>
          <p className="mt-1 truncate text-xs text-slate-500">{contract.counterparty_name || "相手先未設定"}</p>
          <div className="mt-2 flex flex-wrap gap-1">{statusBadge(contract.status)}<Badge variant="outline">{contractTypeLabel(contract.contract_type)}</Badge>{contract.is_current_for_project && <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-800">PJ現行</Badge>}</div>
        </div>
        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-400" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
        <MiniAnswer label="期限" value={period.end ? `${dateOnly(period.end)}・${remainingLabel(period.end)}` : "未確認"} />
        <MiniAnswer label="状態・押印" value={`${STATUS_LABEL[contract.status]} / ${signature.label}`} />
        <MiniAnswer label="金額・支払" value={joinedTerms([payment.primary, payment.secondary])} />
        <MiniAnswer label="業務・成果物" value={joinedTerms([terms.scopeSummary, terms.deliverablesNote])} />
        <MiniAnswer label="費用負担" value={joinedTerms([expense.label, expense.note])} />
        <MiniAnswer label="知財・秘密保持" value={joinedTerms([terms.ipOwnership, terms.confidentialitySummary || confidentiality.label])} />
      </div>
    </button>
  );
}

function CellText({ primary, secondary, tertiary, tone = "default" }: { primary: string; secondary?: string | null; tertiary?: string | null; tone?: "default" | "good" | "warning" | "danger" }) {
  const primaryClass = tone === "good" ? "text-emerald-700" : tone === "warning" ? "text-amber-700" : tone === "danger" ? "text-rose-700" : "text-slate-900";
  return <div className="min-w-0"><p className={`line-clamp-2 font-medium leading-4 ${primaryClass}`}>{primary}</p>{secondary && <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-500">{secondary}</p>}{tertiary && <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-slate-400">{tertiary}</p>}</div>;
}

function MiniAnswer({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><p className="text-[10px] font-medium text-slate-400">{label}</p><p className="mt-0.5 truncate font-medium text-slate-700">{value}</p></div>;
}

function CreateContractDialog({ open, onOpenChange, projects, value, onChange, onSubmit, saving }: { open: boolean; onOpenChange: (open: boolean) => void; projects: Project[]; value: typeof BLANK_CONTRACT; onChange: (value: typeof BLANK_CONTRACT) => void; onSubmit: (event: FormEvent) => void; saving: boolean }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[92vw] !max-w-[680px] p-0">
        <DialogHeader className="border-b border-slate-200 p-4 pr-14">
          <DialogTitle className="text-lg">契約を追加</DialogTitle>
          <DialogDescription>契約の正本行を作成し、版・押印証跡はあとから文書として追加する。</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-3 p-4 sm:grid-cols-2">
          <Field label="PJ" className="sm:col-span-2">
            <select value={value.projectId} onChange={(event) => onChange({ ...value, projectId: event.target.value })} className={CONTROL_CLASS} required><option value="">PJを選択</option>{projects.map((project) => <option key={project.project_id} value={project.project_id}>{project.project_id} {project.project_name}</option>)}</select>
          </Field>
          <Field label="契約名" className="sm:col-span-2"><input value={value.title} onChange={(event) => onChange({ ...value, title: event.target.value })} className={CONTROL_CLASS} required /></Field>
          <Field label="相手先"><input value={value.counterparty} onChange={(event) => onChange({ ...value, counterparty: event.target.value })} className={CONTROL_CLASS} /></Field>
          <Field label="種別"><select value={value.contractType} onChange={(event) => onChange({ ...value, contractType: event.target.value })} className={CONTROL_CLASS}>{Object.entries(CONTRACT_TYPE_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
          <Field label="押印予定日"><input type="date" value={value.expectedSigningDate} onChange={(event) => onChange({ ...value, expectedSigningDate: event.target.value })} className={CONTROL_CLASS} /></Field>
          <Field label="停滞確認までの日数"><input type="number" min="1" max="120" value={value.nudgeAfterDays} onChange={(event) => onChange({ ...value, nudgeAfterDays: event.target.value })} className={CONTROL_CLASS} /></Field>
          <div className="flex justify-end gap-2 border-t border-slate-200 pt-3 sm:col-span-2"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>閉じる</Button><Button type="submit" disabled={saving || !value.projectId || !value.title}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}追加</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ContractDetailDialog({ contract, project, documents, signals, linkedTerms, unlinkedTerms, nudges, driveDestination, edit, setEdit, newDocument, setNewDocument, saving, onOpenChange, onStatusChange, onSave, onAddDocument }: {
  contract: LedgerContract | null;
  project?: Project;
  documents: ContractDocument[];
  signals: ContractSignal[];
  linkedTerms: ContractTerm[];
  unlinkedTerms: ContractTerm[];
  nudges: ContractNudge[];
  driveDestination: ContractsResponse["driveDestination"] | null;
  edit: ContractEditState;
  setEdit: (value: ContractEditState) => void;
  newDocument: typeof BLANK_DOCUMENT;
  setNewDocument: (value: typeof BLANK_DOCUMENT) => void;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange: (status: ContractStatus) => void;
  onSave: (event: FormEvent) => void;
  onAddDocument: (event: FormEvent) => void;
}) {
  if (!contract) return null;
  const period = resolveContractPeriod(contract, project);
  const terms = effectiveContractTerms(contract, project);
  const expense = expenseSummary(terms);
  const signature = resolveSignatureProof(contract, documents);
  const confidentiality = resolveConfidentiality(contract);
  const latest = documents.find((doc) => doc.is_latest) || documents[0];
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="grid h-[min(90vh,820px)] w-[96vw] !max-w-[1500px] grid-rows-[auto_1fr] gap-0 overflow-hidden rounded-lg border border-slate-300 !bg-white p-0 shadow-2xl">
        <DialogHeader className="border-b border-slate-200 px-4 py-3 pr-14 sm:px-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{contract.project_id} {project?.project_name || "PJ未設定"}</Badge>
                <Badge variant="outline">{contractTypeLabel(contract.contract_type)}</Badge>
                {signature.state === "needs_proof" && <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-700"><AlertCircle className="h-3 w-3" />押印証跡を確認</Badge>}
              </div>
              <DialogTitle className="mt-2 line-clamp-2 text-xl font-semibold leading-tight text-slate-950 sm:text-2xl">{contractTitle(contract)}</DialogTitle>
              <DialogDescription className="mt-1">{contract.counterparty_name || "相手先未設定"} / 最新記録 {compactDate(contract.latest_record_at)}</DialogDescription>
            </div>
            <label className="shrink-0 text-xs font-medium text-slate-500">
              現在状態
              <select value={contract.status} onChange={(event) => onStatusChange(event.target.value as ContractStatus)} disabled={saving} className="mt-1 block h-8 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-900">
                {CONTRACT_STATUSES.map((status) => <option key={status} value={status}>{STATUS_LABEL[status]}</option>)}
              </select>
            </label>
          </div>
        </DialogHeader>

        <Tabs defaultValue="answers" className="min-h-0 gap-0">
          <TabsList variant="line" className="w-full shrink-0 justify-start overflow-x-auto border-b border-slate-200 px-4 py-2 sm:px-5">
            <TabsTrigger value="answers" className="flex-none px-3">実務条件</TabsTrigger>
            <TabsTrigger value="documents" className="flex-none px-3">文書と版 <span className="text-xs text-slate-400">{documents.length}</span></TabsTrigger>
            <TabsTrigger value="records" className="flex-none px-3">関連記録 <span className="text-xs text-slate-400">{contract.related_record_count}</span></TabsTrigger>
          </TabsList>

          <TabsContent value="answers" className="min-h-0 overflow-y-auto p-4 sm:p-5">
            <div className="grid gap-x-5 gap-y-3 border-y border-slate-200 bg-slate-50 px-3 py-3 text-sm md:grid-cols-3">
              <FactRow label="契約当事者" value={`${contract.amd_entity_name || "株式会社チームアルマダ"} × ${contract.counterparty_name || "相手先未設定"}`} note={joinedTerms([contract.amd_party_role, contract.party_confirmation_note], "当事者確認の根拠未登録")} />
              <FactRow label="現在状態・押印" value={`${STATUS_LABEL[contract.status]} / ${signature.label}`} note={signature.note} />
              <FactRow label="PJコックピット" value={contract.is_current_for_project ? "現行契約として表示" : "現行契約に未指定"} note={contract.relationship_scope === "amd_contract" ? "AMD当事者契約" : "主台帳の対象外"} />
            </div>

            <div className="mt-5 grid gap-x-6 gap-y-5 md:grid-cols-2 xl:grid-cols-3">
              <TermsGroup icon={<CalendarRange />} title="期間・更新" rows={[
                ["契約期間", `${dateOnly(period.start)} - ${dateOnly(period.end)}`],
                ["更新", joinedTerms([contract.renewal_type, contract.renewal_notice_date ? `通知 ${dateOnly(contract.renewal_notice_date)}` : null])],
              ]} />
              <TermsGroup icon={<Banknote />} title="金額・支払" rows={[
                ["契約金額", contract.contract_value_yen ? yen(contract.contract_value_yen) : terms.amountTaxExclTotal ? `税抜 ${yen(terms.amountTaxExclTotal)}` : terms.monthlyFeeYen ? `月額 ${yen(terms.monthlyFeeYen)}` : "未確認"],
                ["支払条件", joinedTerms([terms.paymentTerms, terms.taxTreatment])],
              ]} />
              <TermsGroup icon={<BriefcaseBusiness />} title="業務・成果物" rows={[
                ["業務範囲", textTerm(terms.scopeSummary) || "未確認"],
                ["成果物", joinedTerms([termFlag(terms.deliverablesRequired, "あり", "なし"), terms.deliverablesNote])],
                ["検収", textTerm(terms.acceptanceTerms) || "未確認"],
                ["報告", joinedTerms([terms.monthlyReportSubmissionRule, terms.monthlyReportSubmissionNote])],
              ]} />
              <TermsGroup icon={<ReceiptText />} title="費用負担" rows={[
                ["立替・実費", expense.label],
                ["条件", expense.note],
              ]} />
              <TermsGroup icon={<Copyright />} title="知財・利用" rows={[
                ["知財帰属", textTerm(terms.ipOwnership) || "未確認"],
                ["利用権", textTerm(terms.usageRights) || "未確認"],
                ["名称・実績公開", textTerm(terms.publicityRights) || "未確認"],
              ]} />
              <TermsGroup icon={<Shield />} title="秘密保持・制限" rows={[
                ["秘密保持", textTerm(terms.confidentialitySummary) || confidentiality.label],
                ["存続", contract.confidentiality_survival_note || textTerm(terms.confidentialitySurvival) || "未確認"],
                ["再委託", textTerm(terms.subcontractingTerms) || "未確認"],
                ["独占・競業", textTerm(terms.exclusivityTerms) || "未確認"],
              ]} />
              <TermsGroup icon={<Scale />} title="解除・責任" rows={[
                ["解除", textTerm(terms.terminationTerms) || "未確認"],
                ["損害賠償・責任上限", textTerm(terms.liabilityTerms) || "未確認"],
                ["準拠法・管轄", textTerm(terms.governingLawJurisdiction) || "未確認"],
              ]} />
              <TermsGroup icon={<FileCheck2 />} title="文書・根拠" rows={[
                ["最新版", latest ? `${latest.version_label || documentKindLabel(latest.document_kind)} / ${documentFormat(latest)}` : "未登録"],
                ["業務責任者", contract.business_owner || "未設定"],
                ["条件確認", terms.verifiedAt ? `${compactDate(terms.verifiedAt)} / ${terms.verifiedBy || "確認者未記録"}` : "未確認"],
                ["特記事項", textTerm(terms.specialTerms) || contract.ledger_notes || "なし"],
              ]} />
            </div>

            <details className="mt-6 rounded-md border border-slate-200 bg-slate-50">
                <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-slate-800">契約条件を編集</summary>
                <form onSubmit={onSave} className="grid gap-3 border-t border-slate-200 bg-white p-4 md:grid-cols-2 xl:grid-cols-3">
                  <Field label="契約名" className="sm:col-span-2"><input value={edit.canonicalTitle} onChange={(event) => setEdit({ ...edit, canonicalTitle: event.target.value })} className={CONTROL_CLASS} /></Field>
                  <Field label="相手先"><input value={edit.counterpartyName} onChange={(event) => setEdit({ ...edit, counterpartyName: event.target.value })} className={CONTROL_CLASS} /></Field>
                  <Field label="種別"><select value={edit.contractType} onChange={(event) => setEdit({ ...edit, contractType: event.target.value })} className={CONTROL_CLASS}>{Object.entries(CONTRACT_TYPE_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
                  <Field label="台帳区分"><select value={edit.relationshipScope} onChange={(event) => { const relationshipScope = event.target.value as ContractRelationshipScope; setEdit({ ...edit, relationshipScope, currentForProject: relationshipScope === "amd_contract" && edit.currentForProject }); }} className={CONTROL_CLASS}><option value="amd_contract">AMD当事者契約</option><option value="needs_review">当事者判定待ち</option><option value="third_party">第三者間契約</option><option value="template">雛形</option></select></Field>
                  <Field label="AMD側当事者"><input value={edit.amdEntityName} onChange={(event) => setEdit({ ...edit, amdEntityName: event.target.value })} className={CONTROL_CLASS} /></Field>
                  <Field label="AMDの契約上の立場"><input value={edit.amdPartyRole} onChange={(event) => setEdit({ ...edit, amdPartyRole: event.target.value })} className={CONTROL_CLASS} placeholder="受託者 / 委託者 / 開示当事者" /></Field>
                  <Field label="当事者確認の根拠"><input value={edit.partyConfirmationNote} onChange={(event) => setEdit({ ...edit, partyConfirmationNote: event.target.value })} className={CONTROL_CLASS} placeholder="契約当事者欄、押印版など" /></Field>
                  <Field label="PJコックピット"><select value={edit.currentForProject ? "current" : "not_current"} onChange={(event) => setEdit({ ...edit, currentForProject: event.target.value === "current" })} disabled={edit.relationshipScope !== "amd_contract"} className={`${CONTROL_CLASS} disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400`}><option value="not_current">現行契約にしない</option><option value="current">現行契約として表示</option></select></Field>
                  <Field label="発効日"><input type="date" value={edit.effectiveDate} onChange={(event) => setEdit({ ...edit, effectiveDate: event.target.value })} className={CONTROL_CLASS} /></Field>
                  <Field label="終了日"><input type="date" value={edit.expirationDate} onChange={(event) => setEdit({ ...edit, expirationDate: event.target.value })} className={CONTROL_CLASS} /></Field>
                  <Field label="更新通知期限"><input type="date" value={edit.renewalNoticeDate} onChange={(event) => setEdit({ ...edit, renewalNoticeDate: event.target.value })} className={CONTROL_CLASS} /></Field>
                  <Field label="更新方法"><input value={edit.renewalType} onChange={(event) => setEdit({ ...edit, renewalType: event.target.value })} className={CONTROL_CLASS} placeholder="自動更新 / 都度更新" /></Field>
                  <Field label="契約金額（円）"><input inputMode="numeric" value={edit.contractValueYen} onChange={(event) => setEdit({ ...edit, contractValueYen: event.target.value })} className={CONTROL_CLASS} /></Field>
                  <Field label="支払条件"><input value={edit.paymentTerms} onChange={(event) => setEdit({ ...edit, paymentTerms: event.target.value })} className={CONTROL_CLASS} placeholder="締日、請求、支払期限" /></Field>
                  <Field label="税・源泉"><input value={edit.taxTreatment} onChange={(event) => setEdit({ ...edit, taxTreatment: event.target.value })} className={CONTROL_CLASS} /></Field>
                  <Field label="業務範囲" className="md:col-span-2"><textarea value={edit.scopeSummary} onChange={(event) => setEdit({ ...edit, scopeSummary: event.target.value })} className={`${CONTROL_CLASS} h-20 py-2`} /></Field>
                  <Field label="成果物"><select value={edit.deliverablesRequired} onChange={(event) => setEdit({ ...edit, deliverablesRequired: event.target.value })} className={CONTROL_CLASS}><option value="unknown">未確認</option><option value="required">あり</option><option value="not_required">なし</option></select></Field>
                  <Field label="成果物の条件"><input value={edit.deliverablesNote} onChange={(event) => setEdit({ ...edit, deliverablesNote: event.target.value })} className={CONTROL_CLASS} /></Field>
                  <Field label="検収条件"><input value={edit.acceptanceTerms} onChange={(event) => setEdit({ ...edit, acceptanceTerms: event.target.value })} className={CONTROL_CLASS} /></Field>
                  <Field label="報告義務"><input value={edit.monthlyReportSubmissionRule} onChange={(event) => setEdit({ ...edit, monthlyReportSubmissionRule: event.target.value })} className={CONTROL_CLASS} /></Field>
                  <Field label="報告条件"><input value={edit.monthlyReportSubmissionNote} onChange={(event) => setEdit({ ...edit, monthlyReportSubmissionNote: event.target.value })} className={CONTROL_CLASS} /></Field>
                  <Field label="立替・実費"><select value={edit.expenseReimbursementAllowed} onChange={(event) => setEdit({ ...edit, expenseReimbursementAllowed: event.target.value })} className={CONTROL_CLASS}><option value="unknown">未確認</option><option value="allowed">申請可</option><option value="not_allowed">申請不可</option></select></Field>
                  <Field label="費用負担の条件"><input value={edit.expenseReimbursementNote} onChange={(event) => setEdit({ ...edit, expenseReimbursementNote: event.target.value })} className={CONTROL_CLASS} placeholder="事前承認、上限、旅費など" /></Field>
                  <Field label="知財帰属"><input value={edit.ipOwnership} onChange={(event) => setEdit({ ...edit, ipOwnership: event.target.value })} className={CONTROL_CLASS} /></Field>
                  <Field label="利用権"><input value={edit.usageRights} onChange={(event) => setEdit({ ...edit, usageRights: event.target.value })} className={CONTROL_CLASS} /></Field>
                  <Field label="名称・実績公開"><input value={edit.publicityRights} onChange={(event) => setEdit({ ...edit, publicityRights: event.target.value })} className={CONTROL_CLASS} /></Field>
                  <Field label="秘密保持"><select value={edit.confidentialityCoverage} onChange={(event) => setEdit({ ...edit, confidentialityCoverage: event.target.value })} className={CONTROL_CLASS}><option value="unknown">未確認</option><option value="in_contract">契約本文に含む</option><option value="separate_nda">別NDAで保護</option><option value="not_included">含まない</option></select></Field>
                  <Field label="秘密保持の存続期間"><input value={edit.confidentialitySurvivalNote} onChange={(event) => setEdit({ ...edit, confidentialitySurvivalNote: event.target.value })} className={CONTROL_CLASS} placeholder="終了後3年 / 無期限など" /></Field>
                  <Field label="秘密保持の条件"><input value={edit.confidentialityNote} onChange={(event) => setEdit({ ...edit, confidentialityNote: event.target.value })} className={CONTROL_CLASS} placeholder="対象、例外、別NDAなど" /></Field>
                  <Field label="再委託"><input value={edit.subcontractingTerms} onChange={(event) => setEdit({ ...edit, subcontractingTerms: event.target.value })} className={CONTROL_CLASS} /></Field>
                  <Field label="独占・競業"><input value={edit.exclusivityTerms} onChange={(event) => setEdit({ ...edit, exclusivityTerms: event.target.value })} className={CONTROL_CLASS} /></Field>
                  <Field label="解除条件"><input value={edit.terminationTerms} onChange={(event) => setEdit({ ...edit, terminationTerms: event.target.value })} className={CONTROL_CLASS} /></Field>
                  <Field label="損害賠償・責任上限"><input value={edit.liabilityTerms} onChange={(event) => setEdit({ ...edit, liabilityTerms: event.target.value })} className={CONTROL_CLASS} /></Field>
                  <Field label="準拠法・管轄"><input value={edit.governingLawJurisdiction} onChange={(event) => setEdit({ ...edit, governingLawJurisdiction: event.target.value })} className={CONTROL_CLASS} /></Field>
                  <Field label="特記事項"><input value={edit.specialTerms} onChange={(event) => setEdit({ ...edit, specialTerms: event.target.value })} className={CONTROL_CLASS} /></Field>
                  <Field label="業務責任者"><input value={edit.businessOwner} onChange={(event) => setEdit({ ...edit, businessOwner: event.target.value })} className={CONTROL_CLASS} /></Field>
                  <Field label="管理メモ"><input value={edit.ledgerNotes} onChange={(event) => setEdit({ ...edit, ledgerNotes: event.target.value })} className={CONTROL_CLASS} /></Field>
                  <div className="flex justify-end md:col-span-2 xl:col-span-3"><Button type="submit" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}保存</Button></div>
                </form>
              </details>
          </TabsContent>

          <TabsContent value="documents" className="min-h-0 overflow-y-auto p-4 sm:p-5">
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
              <section>
                <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold text-slate-950">版履歴</h3><span className="text-xs text-slate-500">押印版、修正版、形式違いを同じ契約内で管理</span></div>
                <div className="mt-2 divide-y divide-slate-100 border-y border-slate-200">
                  {documents.map((doc) => (
                    <div key={doc.document_id} className="flex items-center gap-3 py-3">
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border ${doc.document_kind === "signed" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500"}`}>{doc.document_kind === "signed" ? <FileSignature className="h-4 w-4" /> : <FileText className="h-4 w-4" />}</span>
                      <div className="min-w-0 flex-1"><a href={doc.web_view_link} target="_blank" rel="noreferrer" className="block truncate text-sm font-medium text-slate-950 hover:underline">{doc.file_name}</a><p className="mt-0.5 text-xs text-slate-500">{doc.version_label} / {documentKindLabel(doc.document_kind)} / {documentFormat(doc)} / {compactDate(doc.received_at)}</p></div>
                      <div className="flex shrink-0 gap-1">{doc.is_latest && <Badge variant="outline">最新版</Badge>}{doc.document_kind === "signed" && <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">押印証跡</Badge>}</div>
                    </div>
                  ))}
                  {documents.length === 0 && <div className="py-12 text-center text-sm text-slate-500">文書未登録</div>}
                </div>
              </section>

              <form onSubmit={onAddDocument} className="h-fit rounded-md border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2"><Link2 className="h-4 w-4 text-slate-500" /><h3 className="text-sm font-semibold text-slate-950">Drive文書を追加</h3></div>
                <p className="mt-1 text-xs text-slate-500">{driveDestination?.path || "共有ドライブ/ARMADA/a3_backoffice/契約"}</p>
                <div className="mt-3 grid gap-3">
                  <Field label="文書の種類"><select value={newDocument.documentKind} onChange={(event) => setNewDocument({ ...newDocument, documentKind: event.target.value })} className={CONTROL_CLASS}><option value="draft">ドラフト</option><option value="revision">修正版</option><option value="redline">赤入れ</option><option value="signed">押印版</option><option value="other">その他</option></select></Field>
                  <Field label="Driveリンク"><input value={newDocument.webViewLink} onChange={(event) => setNewDocument({ ...newDocument, webViewLink: event.target.value })} className={CONTROL_CLASS} required /></Field>
                  <Field label="ファイル名"><input value={newDocument.fileName} onChange={(event) => setNewDocument({ ...newDocument, fileName: event.target.value })} className={CONTROL_CLASS} /></Field>
                  <Field label="版"><input value={newDocument.versionLabel} onChange={(event) => setNewDocument({ ...newDocument, versionLabel: event.target.value })} className={CONTROL_CLASS} placeholder="v2 / 最終版" /></Field>
                  <Field label="Drive file ID"><input value={newDocument.driveFileId} onChange={(event) => setNewDocument({ ...newDocument, driveFileId: event.target.value })} className={CONTROL_CLASS} placeholder="リンクから推定可" /></Field>
                  <Button type="submit" disabled={saving || !newDocument.webViewLink}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}登録</Button>
                </div>
              </form>
            </div>
          </TabsContent>

          <TabsContent value="records" className="min-h-0 overflow-y-auto p-4 sm:p-5">
            <div className="grid gap-5 xl:grid-cols-2">
              <section>
                <h3 className="text-sm font-semibold text-slate-950">この契約に紐づく記録</h3>
                <p className="mt-1 text-xs text-slate-500">旧取込行や送付・修正記録は契約を増やさず、ここで証跡として残す。</p>
                <div className="mt-2 divide-y divide-slate-100 border-y border-slate-200">
                  {contract.related_titles.map((title, index) => <div key={`${title}-${index}`} className="flex items-center justify-between gap-3 py-2.5 text-sm"><span className="min-w-0 truncate text-slate-700">{title}</span><Badge variant="outline">{contract.related_statuses[index] ? STATUS_LABEL[contract.related_statuses[index]] : "記録"}</Badge></div>)}
                </div>
                {signals.length > 0 && <div className="mt-5"><h4 className="text-xs font-semibold text-slate-500">紐づく予兆</h4><div className="mt-2 space-y-2">{signals.map((signal) => <div key={signal.signal_id} className="rounded-md border border-slate-200 p-3"><p className="text-sm font-medium text-slate-900">{signal.title}</p><p className="mt-1 line-clamp-2 text-xs text-slate-500">{signal.snippet}</p></div>)}</div></div>}
              </section>
              <section>
                <h3 className="text-sm font-semibold text-slate-950">契約条件の根拠</h3>
                <div className="mt-2 space-y-2">
                  {linkedTerms.map((term) => <TermEvidence key={term.term_id} term={term} />)}
                  {linkedTerms.length === 0 && <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">この契約に確定紐付けされた条件候補なし</div>}
                </div>
                {unlinkedTerms.length > 0 && <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3"><div className="flex items-center gap-2 text-sm font-semibold text-amber-950"><AlertTriangle className="h-4 w-4" />PJ内の未紐付け候補</div><p className="mt-1 text-xs text-amber-800">別契約の条件かもしれないため、上の回答には使っていない。</p><div className="mt-2 space-y-2">{unlinkedTerms.map((term) => <TermEvidence key={term.term_id} term={term} compact />)}</div></div>}
                {nudges.length > 0 && <div className="mt-5"><h4 className="text-xs font-semibold text-slate-500">通知候補履歴</h4><div className="mt-2 divide-y divide-slate-100 border-y border-slate-200">{nudges.map((nudge) => <div key={nudge.nudge_id} className="flex justify-between gap-3 py-2 text-xs"><span>{nudge.status}</span><span className="text-amber-700">{nudge.stale_days}日 / {compactDate(nudge.candidate_at)}</span></div>)}</div></div>}
              </section>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function FactRow({ label, value, note }: { label: string; value: string; note?: string | null }) {
  return <div className="border-b border-slate-100 py-3 sm:px-3 sm:odd:border-r"><dt className="text-[11px] font-medium text-slate-500">{label}</dt><dd className="mt-1 break-words font-medium text-slate-900">{value}</dd>{note && <dd className="mt-1 text-xs text-slate-500">{note}</dd>}</div>;
}

function TermsGroup({ icon, title, rows }: { icon: ReactNode; title: string; rows: Array<[string, string | null | undefined]> }) {
  return (
    <section className="min-w-0 border-t border-slate-200 pt-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-950"><span className="text-slate-500 [&_svg]:h-4 [&_svg]:w-4">{icon}</span>{title}</h3>
      <dl className="mt-2 space-y-2">
        {rows.map(([label, value]) => (
          <div key={label} className="grid min-w-0 grid-cols-[88px_minmax(0,1fr)] gap-2 text-xs leading-5">
            <dt className="text-slate-500">{label}</dt>
            <dd className="min-w-0 break-words font-medium text-slate-800">{value || "未確認"}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Field({ label, className = "", children }: { label: string; className?: string; children: ReactNode }) {
  return <label className={`block min-w-0 text-xs font-medium text-slate-600 ${className}`}><span className="mb-1 block">{label}</span>{children}</label>;
}

function TermEvidence({ term, compact = false }: { term: ContractTerm; compact?: boolean }) {
  return <div className={`rounded-md border ${compact ? "border-amber-200 bg-white p-2" : "border-slate-200 bg-white p-3"}`}><div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{term.status}</Badge><span className="text-xs text-slate-500">{Math.round(term.confidence * 100)}% / {term.source_kind}</span></div><p className="mt-1 line-clamp-2 text-sm font-medium text-slate-900">{term.contract_title || term.source_title}</p>{!compact && <p className="mt-2 text-xs text-slate-500">契約No {term.contract_no || term.quote_no || "-"} / 期間 {dateOnly(term.period_start)} - {dateOnly(term.period_end)} / 税抜 {yen(term.amount_tax_excl)}</p>}</div>;
}

function DryRunPanel({ icon, title, actionLabel, loading, onAction, children }: { icon: ReactNode; title: string; actionLabel: string; loading: boolean; onAction: () => void; children: ReactNode }) {
  return <div className="rounded-md border border-slate-200 bg-white p-3"><div className="flex items-center gap-2">{icon}<h3 className="min-w-0 flex-1 text-sm font-semibold text-slate-950">{title}</h3><Button type="button" variant="outline" size="sm" onClick={onAction} disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}{actionLabel}</Button></div><div className="mt-3">{children}</div></div>;
}
