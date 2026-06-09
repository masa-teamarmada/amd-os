export const CONTRACT_STATUSES = [
  "planned",
  "drafting",
  "under_review",
  "awaiting_signature",
  "signed",
  "stalled",
  "cancelled",
] as const;

export const CONTRACT_DOCUMENT_KINDS = [
  "draft",
  "revision",
  "redline",
  "signed",
  "other",
] as const;

export const CONTRACT_SIGNAL_SOURCE_KINDS = [
  "gmail",
  "drive",
  "calendar",
  "slack",
  "notion",
] as const;

export type ContractStatus = (typeof CONTRACT_STATUSES)[number];
export type ContractDocumentKind = (typeof CONTRACT_DOCUMENT_KINDS)[number];
export type ContractSignalSourceKind = (typeof CONTRACT_SIGNAL_SOURCE_KINDS)[number];

export type ContractSourceEvidence = {
  sourceKind: ContractSignalSourceKind;
  sourceTable: "source_cache" | "project_meeting_summaries";
  sourceId: string;
  projectId: string;
  title: string;
  snippet: string;
  sourceUrl: string | null;
  itemDate: string | null;
  metadata?: Record<string, unknown> | null;
};

export type ContractSignalCandidate = {
  candidateId: string;
  projectId: string;
  sourceKind: ContractSignalSourceKind;
  sourceTable: ContractSourceEvidence["sourceTable"];
  sourceId: string;
  sourceUrl: string | null;
  title: string;
  snippet: string;
  detectedTerms: string[];
  signalType: string;
  confidence: number;
  reviewRequired: boolean;
  proposedAction: "create_planned_contract" | "review_queue";
  reason: string;
  itemDate: string | null;
};

export type ContractNudgeCandidate = {
  contractId: string;
  projectId: string;
  projectName: string;
  contractTitle: string;
  counterpartyName: string;
  status: ContractStatus;
  staleDays: number;
  thresholdDays: number;
  slackChannelId: string | null;
  dueAt: string;
  dryRunMessage: string;
  blocker: string | null;
};

const CONTRACT_TERMS = [
  "契約",
  "契約書",
  "締結",
  "押印",
  "署名",
  "電子署名",
  "クラウドサイン",
  "DocuSign",
  "NDA",
  "秘密保持",
  "業務委託",
  "共同研究",
  "共同研究契約",
  "MOU",
  "覚書",
  "委託契約",
  "利用規約",
  "発注書",
  "注文書",
  "見積書",
  "法務確認",
  "リーガルチェック",
  "修正案",
  "赤入れ",
  "契約締結",
  "signed",
  "signature",
  "agreement",
  "contract",
  "redline",
];

const STRONG_ACTION_TERMS = [
  "押印",
  "署名",
  "電子署名",
  "クラウドサイン",
  "DocuSign",
  "締結",
  "締結予定",
  "契約締結",
  "最終版",
  "修正案",
  "赤入れ",
  "法務確認",
  "リーガルチェック",
  "contract executed",
  "please sign",
  "signature requested",
  "final version",
  "redline",
];

const CONTRACT_TYPE_TERMS: Array<{ type: string; terms: string[] }> = [
  { type: "nda", terms: ["NDA", "秘密保持", "秘密保持契約"] },
  { type: "outsourcing", terms: ["業務委託", "委託契約", "SOW"] },
  { type: "joint_research", terms: ["共同研究", "共同研究契約"] },
  { type: "mou", terms: ["MOU", "覚書"] },
  { type: "order", terms: ["発注書", "注文書", "PO"] },
];

function normalizeText(value: string) {
  return value.normalize("NFKC").toLowerCase();
}

function hasTerm(haystack: string, term: string) {
  return normalizeText(haystack).includes(normalizeText(term));
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function truncate(value: string, maxLength: number) {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function hashLike(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}

function inferSignalType(text: string) {
  const hit = CONTRACT_TYPE_TERMS.find((entry) => entry.terms.some((term) => hasTerm(text, term)));
  return hit?.type ?? "contract";
}

export function buildContractSignalCandidate(evidence: ContractSourceEvidence): ContractSignalCandidate | null {
  const combined = `${evidence.title}\n${evidence.snippet}`;
  const detectedTerms = unique(CONTRACT_TERMS.filter((term) => hasTerm(combined, term)));
  if (detectedTerms.length === 0) return null;

  const strongHits = STRONG_ACTION_TERMS.filter((term) => hasTerm(combined, term)).length;
  const titleHits = CONTRACT_TERMS.filter((term) => hasTerm(evidence.title, term)).length;
  const sourceBoost = evidence.sourceKind === "drive" || evidence.sourceKind === "gmail" ? 0.08 : 0;
  const confidence = Math.min(
    0.97,
    0.34 + detectedTerms.length * 0.055 + strongHits * 0.12 + titleHits * 0.08 + sourceBoost,
  );
  const reviewRequired = confidence < 0.72 || strongHits === 0;

  return {
    candidateId: `contract-signal:${evidence.sourceTable}:${evidence.sourceId}:${hashLike(combined)}`,
    projectId: evidence.projectId,
    sourceKind: evidence.sourceKind,
    sourceTable: evidence.sourceTable,
    sourceId: evidence.sourceId,
    sourceUrl: evidence.sourceUrl,
    title: truncate(evidence.title || "契約予兆", 140),
    snippet: truncate(evidence.snippet, 360),
    detectedTerms,
    signalType: inferSignalType(combined),
    confidence: Number(confidence.toFixed(2)),
    reviewRequired,
    proposedAction: reviewRequired ? "review_queue" : "create_planned_contract",
    reason: reviewRequired
      ? "契約語は検出したけど、自動予定枠にするには確度または締結アクション語が不足"
      : "契約語と締結/修正/署名アクション語が同時に出ているため、予定枠候補にできる",
    itemDate: evidence.itemDate,
  };
}

export function buildContractSignalCandidates(sources: ContractSourceEvidence[]) {
  return sources
    .map(buildContractSignalCandidate)
    .filter((candidate): candidate is ContractSignalCandidate => candidate !== null)
    .sort((a, b) => b.confidence - a.confidence || String(b.itemDate ?? "").localeCompare(String(a.itemDate ?? "")));
}

export function buildContractNudgeCandidate(row: {
  contract_id: string;
  project_id: string;
  contract_title: string;
  counterparty_name: string | null;
  status: ContractStatus;
  planned_at: string | null;
  last_activity_at: string | null;
  nudge_after_days: number | null;
  signed_at: string | null;
  projects?: {
    project_name?: string | null;
    slack_channel_id?: string | null;
  } | null;
}, now = new Date()): ContractNudgeCandidate | null {
  if (row.signed_at || row.status === "signed" || row.status === "cancelled") return null;

  const basis = row.last_activity_at || row.planned_at;
  if (!basis) return null;

  const basisDate = new Date(basis);
  if (Number.isNaN(basisDate.getTime())) return null;

  const thresholdDays = Math.max(1, Number(row.nudge_after_days ?? 14) || 14);
  const staleDays = Math.floor((now.getTime() - basisDate.getTime()) / 86_400_000);
  if (staleDays < thresholdDays) return null;

  const projectName = row.projects?.project_name || row.project_id;
  const counterpartyName = row.counterparty_name || "相手先未設定";
  const dueAt = new Date(basisDate.getTime() + thresholdDays * 86_400_000).toISOString();
  const slackChannelId = row.projects?.slack_channel_id || null;
  const blocker = slackChannelId ? null : "projects.slack_channel_id が未設定";

  return {
    contractId: row.contract_id,
    projectId: row.project_id,
    projectName,
    contractTitle: row.contract_title,
    counterpartyName,
    status: row.status,
    staleDays,
    thresholdDays,
    slackChannelId,
    dueAt,
    dryRunMessage: [
      `契約nudge: ${projectName} / ${row.contract_title}`,
      `相手先: ${counterpartyName}`,
      `押印版が未保存のまま ${staleDays}日 経過しています。最新版/押印版の保存状況を確認してね。`,
    ].join("\n"),
    blocker,
  };
}
