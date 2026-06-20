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
  fullText?: string | null;
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

export type ContractTermCandidate = {
  candidateId: string;
  sourceTermHash: string;
  projectId: string;
  sourceKind: ContractSignalSourceKind;
  sourceTable: ContractSourceEvidence["sourceTable"];
  sourceId: string;
  sourceUrl: string | null;
  sourceTitle: string;
  contractNo: string | null;
  quoteNo: string | null;
  contractTitle: string | null;
  counterpartyName: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  periodStartYm: string | null;
  periodEndYm: string | null;
  amountTaxExcl: number | null;
  taxAmount: number | null;
  amountTaxIncl: number | null;
  currency: "JPY";
  feeTypeHint: "monthly_fixed" | "contract_total" | "milestone" | "variable" | "unknown";
  billingDistribution: "review_required" | "monthly_average" | "schedule_based" | "manual";
  billingDistributionJson: Record<string, unknown>;
  confidence: number;
  reviewRequired: boolean;
  reviewStatus: "pending";
  status: "candidate";
  extractedTerms: Record<string, unknown>;
  sourceRefs: Array<Record<string, unknown>>;
  reason: string;
  itemDate: string | null;
};

const CONTRACT_TERMS = [
  "契約",
  "契約書",
  "契約更新",
  "契約延長",
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

const EXPLICIT_CONTRACT_TERMS = [
  "契約書",
  "契約更新",
  "契約延長",
  "NDA",
  "秘密保持",
  "秘密保持契約",
  "業務委託",
  "委託契約",
  "共同研究契約",
  "MOU",
  "覚書",
  "発注書",
  "注文書",
  "SOW",
  "DocuSign",
  "クラウドサイン",
  "電子署名",
  "リーガルチェック",
  "法務確認",
  "修正案",
  "赤入れ",
  "redline",
  "please sign",
  "signature requested",
  "final version",
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
  "契約更新",
  "契約延長",
  "送付",
  "受領",
  "確認依頼",
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

const GENERIC_MEETING_TITLE_TERMS = [
  "mtg",
  "meeting",
  "定例",
  "キックオフ",
  "取締役会",
  "会議",
  "打合せ",
  "面談",
  "壁打ち",
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

function isGenericMeetingTitle(title: string) {
  return GENERIC_MEETING_TITLE_TERMS.some((term) => hasTerm(title, term));
}

function isAdministrativeContractAttachment(title: string) {
  return [
    "雇用契約書",
    "雇用契約",
    "補助金変更届",
    "銀行明細",
  ].some((term) => hasTerm(title, term));
}

function parseYenNumber(value: string | null | undefined) {
  if (!value) return null;
  const normalized = value.normalize("NFKC").replace(/[¥￥円,\s]/g, "");
  const match = normalized.match(/[0-9]+/);
  if (!match) return null;
  const amount = Number(match[0]);
  return Number.isFinite(amount) && amount >= 1000 ? amount : null;
}

function findYenAfterLabels(text: string, labels: string[]) {
  const cleaned = text.normalize("NFKC").replace(/[*_`]/g, "");
  for (const label of labels) {
    const re = new RegExp(`${label}\\s*(?:\\([^)]*\\))?\\s*[:：]?\\s*[¥￥]?\\s*([0-9][0-9,]*)\\s*円?`, "i");
    const match = cleaned.match(re);
    const amount = parseYenNumber(match?.[1]);
    if (amount !== null) return amount;
  }
  return null;
}

function parseJapaneseDate(value: string | null | undefined) {
  if (!value) return null;
  const normalized = value.normalize("NFKC");
  const japanese = normalized.match(/(20\d{2})年\s*(\d{1,2})月\s*(\d{1,2})日/);
  if (japanese) {
    const year = japanese[1];
    const month = japanese[2].padStart(2, "0");
    const day = japanese[3].padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  const compact = normalized.match(/\b(20\d{2})(\d{2})(\d{2})\b/);
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`;
  const dashed = normalized.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (dashed) return `${dashed[1]}-${dashed[2].padStart(2, "0")}-${dashed[3].padStart(2, "0")}`;
  return null;
}

function dateToYm(value: string | null) {
  return value ? value.slice(0, 7).replace("-", "") : null;
}

function monthRange(start: string | null, end: string | null) {
  if (!start || !end) return [];
  const startDate = new Date(`${start.slice(0, 7)}-01T00:00:00Z`);
  const endDate = new Date(`${end.slice(0, 7)}-01T00:00:00Z`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate > endDate) return [];
  const months: string[] = [];
  const cursor = new Date(startDate);
  while (cursor <= endDate && months.length < 60) {
    months.push(`${cursor.getUTCFullYear()}${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return months;
}

function findLabeledText(text: string, labels: string[], maxLength = 180) {
  for (const label of labels) {
    const re = new RegExp(`${label}\\s*[:：]\\s*([^\\n|]{2,${maxLength}})`, "i");
    const match = text.match(re);
    if (match?.[1]) return truncate(match[1], maxLength);
  }
  return null;
}

function extractPeriod(text: string) {
  const normalized = text.normalize("NFKC");
  const periodMatch = normalized.match(/(?:履行期間|契約期間|期間|業務期間)[^\n0-9]{0,30}((?:20\d{2}年\s*\d{1,2}月\s*\d{1,2}日)|(?:20\d{6})|(?:20\d{2}[-/]\d{1,2}[-/]\d{1,2}))[^\n0-9]{0,18}((?:20\d{2}年\s*\d{1,2}月\s*\d{1,2}日)|(?:20\d{6})|(?:20\d{2}[-/]\d{1,2}[-/]\d{1,2}))/);
  if (periodMatch) {
    return {
      start: parseJapaneseDate(periodMatch[1]),
      end: parseJapaneseDate(periodMatch[2]),
    };
  }
  const compactTitle = normalized.match(/期間(20\d{6})[_-](20\d{6})/);
  if (compactTitle) {
    return {
      start: parseJapaneseDate(compactTitle[1]),
      end: parseJapaneseDate(compactTitle[2]),
    };
  }
  return { start: null, end: null };
}

function inferCounterparty(text: string) {
  if (/NIMS|物質・材料研究機構/.test(text)) return "国立研究開発法人物質・材料研究機構（NIMS）";
  return findLabeledText(text, ["発注者", "発行元", "委託者", "甲", "相手先"], 120);
}

function buildBillingDistributionJson(params: {
  amountTaxExcl: number | null;
  amountTaxIncl: number | null;
  periodStart: string | null;
  periodEnd: string | null;
  feeTypeHint: ContractTermCandidate["feeTypeHint"];
  itemDate: string | null;
  targetYm?: string | null;
  scheduleDistribution?: Record<string, unknown> | null;
}) {
  if (params.scheduleDistribution) return params.scheduleDistribution;
  const months = monthRange(params.periodStart, params.periodEnd);
  if (params.feeTypeHint === "monthly_fixed") {
    return {
      basis: "monthly_fixed_candidate",
      ym: params.targetYm ?? dateToYm(params.itemDate),
      monthly_amount_tax_excl: params.amountTaxExcl,
      monthly_reward_cap_yen: params.amountTaxExcl === null ? null : Math.round(params.amountTaxExcl * 0.65),
    };
  }
  if (months.length === 0 || params.amountTaxExcl === null) {
    return { basis: "review_required", reason: "契約金額または契約期間が不足しているため月次配分は未確定" };
  }
  const monthlyAverage = Math.round(params.amountTaxExcl / months.length);
  return {
    basis: "monthly_average_review_required",
    months,
    amount_tax_excl_total: params.amountTaxExcl,
    amount_tax_incl_total: params.amountTaxIncl,
    monthly_average_tax_excl: monthlyAverage,
    monthly_reward_cap_yen: Math.round(monthlyAverage * 0.65),
    total_reward_cap_yen: Math.round(params.amountTaxExcl * 0.65),
  };
}

function extractTargetYm(text: string) {
  return text.normalize("NFKC").match(/対象月\s*[:：]?\s*(20\d{4})/)?.[1] ?? null;
}

function extractScheduleDistribution(text: string, periodStart: string | null, periodEnd: string | null) {
  const months = monthRange(periodStart, periodEnd);
  if (months.length !== 4) return null;
  const principalRate = parseYenNumber(text.match(/プリンシパル[^\n|]*\|[^\n]*?¥\s*([0-9,]+)/)?.[1]);
  const associateRate = parseYenNumber(text.match(/アソシエイト[^\n|]*\|[^\n]*?¥\s*([0-9,]+)/)?.[1]);
  const principalHours = text.match(/プリンシパル\s*\|\s*(\d+(?:\.\d+)?)\s*\|\s*(\d+(?:\.\d+)?)\s*\|\s*(\d+(?:\.\d+)?)\s*\|\s*(\d+(?:\.\d+)?)/);
  const associateHours = text.match(/アソシエイト\s*\|\s*(\d+(?:\.\d+)?)\s*\|\s*(\d+(?:\.\d+)?)\s*\|\s*(\d+(?:\.\d+)?)\s*\|\s*(\d+(?:\.\d+)?)/);
  if (principalRate === null || associateRate === null || !principalHours || !associateHours) return null;

  const monthly = months.map((ym, index) => {
    const principal = Number(principalHours[index + 1]);
    const associate = Number(associateHours[index + 1]);
    const amountTaxExcl = Math.round(principal * principalRate + associate * associateRate);
    return {
      ym,
      principal_hours: principal,
      associate_hours: associate,
      amount_tax_excl: amountTaxExcl,
      reward_cap_yen: Math.round(amountTaxExcl * 0.65),
    };
  });

  return {
    basis: "schedule_based_review_required",
    months,
    principal_rate_yen: principalRate,
    associate_rate_yen: associateRate,
    monthly,
    amount_tax_excl_total: monthly.reduce((sum, row) => sum + row.amount_tax_excl, 0),
    total_reward_cap_yen: monthly.reduce((sum, row) => sum + row.reward_cap_yen, 0),
  };
}

function extractAmounts(text: string) {
  const monthlyFee = findYenAfterLabels(text, ["業務委託費\\(税抜\\)", "月額\\(税抜\\)", "月額", "fee_amount"]);
  const subtotal = findYenAfterLabels(text, ["小計", "税抜金額", "税抜", "税別", "明細合計"]);
  const tax = findYenAfterLabels(text, ["消費税", "税額"]);
  const total = findYenAfterLabels(text, ["合計", "税込金額", "税込", "契約金額", "見積金額", "発注金額"]);
  const amountTaxExcl = subtotal ?? monthlyFee ?? (total !== null && tax !== null ? total - tax : null);
  const amountTaxIncl = total ?? (amountTaxExcl !== null && tax !== null ? amountTaxExcl + tax : null);
  return {
    amountTaxExcl,
    taxAmount: tax,
    amountTaxIncl,
    monthlyFee,
  };
}

export function buildContractSignalCandidate(evidence: ContractSourceEvidence): ContractSignalCandidate | null {
  const combined = `${evidence.title}\n${evidence.snippet}`;
  const detectedTerms = unique(CONTRACT_TERMS.filter((term) => hasTerm(combined, term)));
  const explicitHits = EXPLICIT_CONTRACT_TERMS.filter((term) => hasTerm(combined, term)).length;
  const titleExplicitHits = EXPLICIT_CONTRACT_TERMS.filter((term) => hasTerm(evidence.title, term)).length;
  const genericMeetingTitle = evidence.sourceTable === "project_meeting_summaries" && isGenericMeetingTitle(evidence.title);
  if (detectedTerms.length === 0 || explicitHits === 0) return null;
  if (evidence.sourceTable === "project_meeting_summaries" && titleExplicitHits === 0) return null;

  const strongHits = STRONG_ACTION_TERMS.filter((term) => hasTerm(combined, term)).length;
  const titleHits = CONTRACT_TERMS.filter((term) => hasTerm(evidence.title, term)).length;
  const sourceCacheDocument = evidence.sourceTable === "source_cache" && ["gmail", "drive"].includes(evidence.sourceKind);
  const meetingTitleCanCreate = evidence.sourceTable === "project_meeting_summaries"
    && titleExplicitHits > 0
    && !genericMeetingTitle;
  const administrativeAttachment = isAdministrativeContractAttachment(evidence.title);
  const sourceBoost = evidence.sourceKind === "drive" || evidence.sourceKind === "gmail" ? 0.08 : 0;
  const confidence = Math.min(
    0.97,
    0.28 + detectedTerms.length * 0.035 + explicitHits * 0.055 + strongHits * 0.1 + titleHits * 0.06 + sourceBoost,
  );
  const explicitDocumentTitleCanCreate = titleExplicitHits > 0
    && confidence >= 0.5
    && !genericMeetingTitle
    && !administrativeAttachment;
  const sourceCacheDocumentCanCreate = sourceCacheDocument
    && titleExplicitHits > 0
    && confidence >= 0.55
    && !administrativeAttachment;
  const canCreatePlannedContract = (
    confidence >= 0.82
      && strongHits > 0
      && (meetingTitleCanCreate || sourceCacheDocument)
      && !(genericMeetingTitle && titleExplicitHits === 0)
  ) || sourceCacheDocumentCanCreate || explicitDocumentTitleCanCreate;
  const reviewRequired = !canCreatePlannedContract;

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
      ? "具体的な契約語は検出したが、MTG文脈またはsource種別上、自動予定枠にせずreview queueに止める"
      : "契約文書/契約種別と署名・押印・更新などのアクションが明示されているため、予定枠候補にできる",
    itemDate: evidence.itemDate,
  };
}

export function buildContractTermCandidate(evidence: ContractSourceEvidence): ContractTermCandidate | null {
  const combined = `${evidence.title}\n${evidence.fullText || evidence.snippet}`;
  const contractNo = combined.match(/\bW20\d{8,}\b/)?.[0] ?? null;
  const quoteNo = combined.match(/\bQ-\d{8,}\b/)?.[0] ?? null;
  const { start: periodStart, end: periodEnd } = extractPeriod(combined);
  const amounts = extractAmounts(combined);
  const contractTitle = findLabeledText(combined, ["調達件名", "契約件名", "件名"], 180);
  const counterpartyName = inferCounterparty(combined);
  const hasPrimaryTerm = Boolean(
    contractNo
      || quoteNo
      || periodStart
      || periodEnd
      || amounts.amountTaxExcl !== null
      || amounts.amountTaxIncl !== null,
  );
  if (!hasPrimaryTerm) return null;

  const feeTypeHint: ContractTermCandidate["feeTypeHint"] = amounts.monthlyFee !== null
    ? "monthly_fixed"
    : amounts.amountTaxExcl !== null || amounts.amountTaxIncl !== null
      ? "contract_total"
      : "unknown";
  if (feeTypeHint === "contract_total" && !contractNo && !quoteNo && !periodStart && !periodEnd) return null;
  const scheduleDistribution = extractScheduleDistribution(combined, periodStart, periodEnd);
  const targetYm = extractTargetYm(combined);
  const billingDistributionJson = buildBillingDistributionJson({
    amountTaxExcl: amounts.amountTaxExcl,
    amountTaxIncl: amounts.amountTaxIncl,
    periodStart,
    periodEnd,
    feeTypeHint,
    itemDate: evidence.itemDate,
    targetYm,
    scheduleDistribution,
  });
  const score = Math.min(
    0.96,
    0.34
      + (contractNo ? 0.15 : 0)
      + (quoteNo ? 0.05 : 0)
      + (periodStart && periodEnd ? 0.18 : 0)
      + (amounts.amountTaxExcl !== null || amounts.amountTaxIncl !== null ? 0.22 : 0)
      + (counterpartyName ? 0.09 : 0)
      + (contractTitle ? 0.06 : 0)
      + (evidence.sourceKind === "drive" ? 0.05 : 0),
  );
  const extractedTerms = {
    contract_no: contractNo,
    quote_no: quoteNo,
    contract_title: contractTitle,
    counterparty_name: counterpartyName,
    period_start: periodStart,
    period_end: periodEnd,
    amount_tax_excl: amounts.amountTaxExcl,
    tax_amount: amounts.taxAmount,
    amount_tax_incl: amounts.amountTaxIncl,
    fee_type_hint: feeTypeHint,
    target_ym: targetYm,
  };
  const sourceTermHash = hashLike(JSON.stringify(extractedTerms));

  return {
    candidateId: `contract-term:${evidence.sourceTable}:${evidence.sourceId}:${sourceTermHash}`,
    sourceTermHash,
    projectId: evidence.projectId,
    sourceKind: evidence.sourceKind,
    sourceTable: evidence.sourceTable,
    sourceId: evidence.sourceId,
    sourceUrl: evidence.sourceUrl,
    sourceTitle: truncate(evidence.title || "契約条件候補", 180),
    contractNo,
    quoteNo,
    contractTitle,
    counterpartyName,
    periodStart,
    periodEnd,
    periodStartYm: dateToYm(periodStart),
    periodEndYm: dateToYm(periodEnd),
    amountTaxExcl: amounts.amountTaxExcl,
    taxAmount: amounts.taxAmount,
    amountTaxIncl: amounts.amountTaxIncl,
    currency: "JPY",
    feeTypeHint,
    billingDistribution: scheduleDistribution ? "schedule_based" : "review_required",
    billingDistributionJson,
    confidence: Number(score.toFixed(2)),
    reviewRequired: true,
    reviewStatus: "pending",
    status: "candidate",
    extractedTerms,
    sourceRefs: [{
      source_kind: evidence.sourceKind,
      source_table: evidence.sourceTable,
      source_id: evidence.sourceId,
      source_url: evidence.sourceUrl,
      title: truncate(evidence.title, 180),
      item_date: evidence.itemDate,
    }],
    reason: "契約条件候補を抽出した。金額・期間は請求/報酬へ自動反映せず、accept/apply前に人間レビューが必要",
    itemDate: evidence.itemDate,
  };
}

export function buildContractSignalCandidates(sources: ContractSourceEvidence[]) {
  return sources
    .map(buildContractSignalCandidate)
    .filter((candidate): candidate is ContractSignalCandidate => candidate !== null)
    .sort((a, b) => b.confidence - a.confidence || String(b.itemDate ?? "").localeCompare(String(a.itemDate ?? "")));
}

export function buildContractTermCandidates(sources: ContractSourceEvidence[]) {
  const seen = new Set<string>();
  return sources
    .map(buildContractTermCandidate)
    .filter((candidate): candidate is ContractTermCandidate => candidate !== null)
    .filter((candidate) => {
      const key = `${candidate.sourceKind}:${candidate.sourceTable}:${candidate.sourceId}:${candidate.sourceTermHash}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
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
