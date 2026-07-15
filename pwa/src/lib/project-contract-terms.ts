export type ContractRelationshipScope = "amd_contract" | "needs_review" | "third_party" | "template";

export type ProjectCurrentContract = {
  contractId?: string | null;
  title?: string | null;
  contractType?: string | null;
  status?: string | null;
  signatureStatus?: string | null;
  counterpartyName?: string | null;
  effectiveDate?: string | null;
  expirationDate?: string | null;
  renewalType?: string | null;
  renewalNoticeDate?: string | null;
  terms?: ProjectContractTerms | null;
};

export interface ProjectContractTerms {
  currentContracts?: ProjectCurrentContract[] | null;
  currentContractId?: string | null;
  currentContractTitle?: string | null;
  currentContractType?: string | null;
  currentContractStatus?: string | null;
  signatureStatus?: string | null;
  counterpartyName?: string | null;
  monthlyFeeYen?: number | string | null;
  amountTaxExclTotal?: number | string | null;
  amountTaxInclTotal?: number | string | null;
  contractStartYm?: string | null;
  contractEndYm?: string | null;
  actualWorkStartYm?: string | null;
  billingStartYm?: string | null;
  renewalType?: string | null;
  renewalNoticeDate?: string | null;
  rewardPoolYen?: number | string | null;
  monthlyRewardCapYen?: number | string | null;
  billingDistribution?: string | null;
  paymentTerms?: string | null;
  taxTreatment?: string | null;
  scopeSummary?: string | null;
  deliverablesRequired?: boolean | string | null;
  deliverablesNote?: string | null;
  acceptanceTerms?: string | null;
  monthlyReportSubmissionRule?: string | null;
  monthlyReportSubmissionTiming?: string | null;
  monthlyReportSubmissionDeadline?: string | null;
  monthlyReportSubmissionFormat?: string | null;
  monthlyReportSubmissionRequiredItems?: string | null;
  monthlyReportSubmissionNote?: string | null;
  expenseReimbursementAllowed?: boolean | string | null;
  expenseReimbursementNote?: string | null;
  ipOwnership?: string | null;
  usageRights?: string | null;
  publicityRights?: string | null;
  confidentialitySummary?: string | null;
  confidentialitySurvival?: string | null;
  subcontractingTerms?: string | null;
  exclusivityTerms?: string | null;
  terminationTerms?: string | null;
  liabilityTerms?: string | null;
  governingLawJurisdiction?: string | null;
  specialTerms?: string | null;
  verifiedAt?: string | null;
  verifiedBy?: string | null;
  sourceTitle?: string | null;
  sourceRef?: string | null;
  notes?: string | null;
  nda?: {
    effectiveDate?: string | null;
    signatureStatus?: string | null;
    term?: string | null;
    postTerminationConfidentiality?: string | null;
    purpose?: string | null;
  } | null;
  [key: string]: unknown;
}

export const OPERATIONAL_TERM_KEYS = [
  "paymentTerms",
  "taxTreatment",
  "scopeSummary",
  "deliverablesRequired",
  "deliverablesNote",
  "acceptanceTerms",
  "monthlyReportSubmissionRule",
  "monthlyReportSubmissionTiming",
  "monthlyReportSubmissionDeadline",
  "monthlyReportSubmissionFormat",
  "monthlyReportSubmissionRequiredItems",
  "monthlyReportSubmissionNote",
  "expenseReimbursementAllowed",
  "expenseReimbursementNote",
  "ipOwnership",
  "usageRights",
  "publicityRights",
  "confidentialitySummary",
  "confidentialitySurvival",
  "subcontractingTerms",
  "exclusivityTerms",
  "terminationTerms",
  "liabilityTerms",
  "governingLawJurisdiction",
  "specialTerms",
] as const satisfies ReadonlyArray<keyof ProjectContractTerms>;

export function textTerm(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function boolTerm(value: unknown) {
  if (value === true || value === "true" || value === "あり" || value === "可" || value === "yes") return true;
  if (value === false || value === "false" || value === "なし" || value === "不可" || value === "no") return false;
  return null;
}

export function termsHaveOperationalDetail(terms: ProjectContractTerms | null | undefined) {
  if (!terms) return false;
  return OPERATIONAL_TERM_KEYS.some((key) => {
    const value = terms[key];
    return value !== null && value !== undefined && value !== "";
  });
}
