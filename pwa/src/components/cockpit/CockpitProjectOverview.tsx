"use client";

/**
 * PJコックピットの「PJ概要」タブ。
 *
 * 「契約上の実行条件」は 2026-08-28 まさ依頼でコックピット最上段からこのタブへ移した。
 * 毎日開く進捗管理は月次の動きへ集中させ、契約期間・請求と振込・業務と成果物・経費のように
 * 月単位では変わらない前提はここへ置いて、必要なときだけ開く。
 *
 * 契約そのものの正本は `project_contracts` (`pwa/spec/5-6-contracts-management-current-spec.md`)。
 * この画面は cockpit bundle が持つ `contractTerms` を読むだけで、編集はしない。
 */

import {
  boolTerm,
  textTerm,
  type ProjectContractTerms,
  type ProjectCurrentContract,
} from "@/lib/project-contract-terms";
import { paymentDueRuleLabel } from "@/lib/payment-rules";
import { CockpitSeasonBudget } from "./CockpitSeasonBudget";

export interface CockpitOverviewProject {
  projectId: string;
  projectName: string;
  clientName: string;
  status: string;
  projectCategory?: string;
  projectType?: string | null;
  feeType?: string | null;
  feeAmount?: number | null;
  startYm?: string | null;
  endYm?: string | null;
  paymentDueRule?: string | null;
  paymentDueDay?: number | null;
  contractTerms?: ProjectContractTerms | null;
}

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  contract: "契約",
  nda: "NDA",
  outsourcing: "業務委託",
  joint_research: "共同研究",
  mou: "MOU/覚書",
  order: "発注/SOW",
  investment: "投資",
  mandate: "委任/顧問",
};

function formatYen(value: number | string | null | undefined) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? `${Math.round(amount).toLocaleString("ja-JP")}円` : null;
}

function feeTypeLabel(value: string | null | undefined) {
  if (value === "monthly_fixed") return "月額固定";
  if (value === "variable") return "都度見積・変動";
  if (value === "milestone") return "マイルストーン";
  return null;
}

function ymLabel(value: string | null | undefined) {
  if (!value) return null;
  if (/^\d{6}$/.test(value)) return `${value.slice(0, 4)}/${value.slice(4, 6)}`;
  return value.slice(0, 10).replaceAll("-", "/");
}

function joinKnown(values: Array<string | null | undefined>, fallback = "未確認") {
  const known = values.filter((value): value is string => Boolean(value));
  return known.length > 0 ? known.join(" / ") : fallback;
}

function expenseStatus(terms: ProjectContractTerms) {
  const allowed = boolTerm(terms.expenseReimbursementAllowed);
  if (allowed === false) return "申請不可";
  if (allowed === true) return "申請可";
  return "契約書確認中";
}

function deliverablesSummary(terms: ProjectContractTerms) {
  const required = boolTerm(terms.deliverablesRequired);
  const status = required === true ? "成果物あり" : required === false ? "成果物なし" : null;
  return joinKnown([status, textTerm(terms.deliverablesNote), textTerm(terms.monthlyReportSubmissionRule), textTerm(terms.monthlyReportSubmissionTiming)]);
}

function contractGridClass(blockCount: number) {
  if (blockCount >= 5) return "xl:grid-cols-5";
  if (blockCount === 4) return "xl:grid-cols-4";
  if (blockCount === 3) return "xl:grid-cols-3";
  return "xl:grid-cols-2";
}

function legacyCurrentContract(project: CockpitOverviewProject): ProjectCurrentContract | null {
  const terms = project.contractTerms;
  if (!terms && !project.feeAmount) return null;
  const nda = terms?.nda;
  const hasContractEvidence = Boolean(terms?.currentContractId || terms?.sourceTitle || nda);
  return {
    contractId: terms?.currentContractId || null,
    title: terms?.currentContractTitle || (nda ? "秘密保持契約" : terms?.sourceTitle || "PJ設定（契約未確認）"),
    contractType: terms?.currentContractType || (nda ? "nda" : project.projectType || "contract"),
    status: terms?.currentContractStatus || (nda ? "要押印確認" : hasContractEvidence ? "状態未確認" : "契約未確認"),
    signatureStatus: terms?.signatureStatus || nda?.signatureStatus || null,
    counterpartyName: terms?.counterpartyName || project.clientName || null,
    effectiveDate: terms?.contractStartYm || nda?.effectiveDate || null,
    expirationDate: terms?.contractEndYm || null,
    renewalType: terms?.renewalType || nda?.term || null,
    renewalNoticeDate: terms?.renewalNoticeDate || null,
    terms: hasContractEvidence ? terms || {} : {},
  };
}

function currentContracts(project: CockpitOverviewProject) {
  const terms = project.contractTerms;
  if (Array.isArray(terms?.currentContracts)) return terms.currentContracts;
  const legacy = legacyCurrentContract(project);
  return legacy ? [legacy] : [];
}

function effectiveTerms(contract: ProjectCurrentContract, fallback: ProjectContractTerms | null | undefined) {
  return (contract.terms || fallback || {}) as ProjectContractTerms;
}

function CurrentContractTerms({ contract, project }: { contract: ProjectCurrentContract; project: CockpitOverviewProject }) {
  const terms = effectiveTerms(contract, project.contractTerms);
  const periodStart = ymLabel(contract.effectiveDate || terms.contractStartYm);
  const periodEnd = ymLabel(contract.expirationDate || terms.contractEndYm);
  const contractAmount = formatYen(terms.amountTaxExclTotal);
  const contractMonthlyFee = formatYen(terms.monthlyFeeYen);
  const projectMonthlyFee = formatYen(project.feeAmount);
  const payment = paymentDueRuleLabel(project.paymentDueRule, project.paymentDueDay);
  const summary = terms.cockpitSummary || {};
  const isNda = contract.contractType === "nda";
  const amount = contractAmount
    ? `税抜総額 ${contractAmount}`
    : contractMonthlyFee
      ? `${feeTypeLabel(project.feeType) || "月額"} ${contractMonthlyFee}`
      : projectMonthlyFee
        ? `${feeTypeLabel(project.feeType) || "PJ設定"} ${projectMonthlyFee}`
        : "金額未確認";
  const invoiceTiming = textTerm(summary.invoiceTiming)
    || (terms.billingStartYm ? `請求開始 ${ymLabel(terms.billingStartYm)}` : "請求時期未確認");
  const paymentTiming = textTerm(summary.paymentTiming)
    || payment
    || "振込時期未確認";
  const periodBlock = {
    label: "契約期間",
    value: periodStart || periodEnd ? `${periodStart || "未確認"} - ${periodEnd || "未確認"}` : "未確認",
    note: joinKnown([textTerm(contract.renewalType || terms.renewalType), contract.renewalNoticeDate ? `更新通知 ${ymLabel(contract.renewalNoticeDate)}` : null], "更新条件未確認"),
  };
  const blocks = isNda ? [
    periodBlock,
    {
      label: "利用目的",
      value: textTerm(summary.scope) || textTerm(terms.nda?.purpose) || textTerm(terms.scopeSummary) || "目的未確認",
      note: textTerm(summary.deliverables) || "目的外利用は契約詳細で確認",
    },
    {
      label: "運用条件",
      value: textTerm(summary.execution) || textTerm(terms.subcontractingTerms) || "共有・担当追加の条件未確認",
      note: textTerm(terms.confidentialitySurvival) || textTerm(terms.nda?.postTerminationConfidentiality) || "存続期間未確認",
    },
  ] : [
    periodBlock,
    {
      label: "請求・振込",
      value: amount,
      note: `請求 ${invoiceTiming}｜振込 ${paymentTiming}`,
    },
    {
      label: "業務・成果物",
      value: textTerm(summary.scope) || textTerm(terms.scopeSummary) || "業務範囲未確認",
      note: textTerm(summary.deliverables) || deliverablesSummary(terms),
    },
    {
      label: "経費申請",
      value: expenseStatus(terms),
      note: textTerm(summary.expense) || textTerm(terms.expenseReimbursementNote) || "旅費・外注・立替条件を確認中",
    },
    ...(textTerm(summary.execution) || textTerm(terms.specialTerms) || textTerm(terms.notes) ? [{
      label: "推進条件",
      value: textTerm(summary.execution) || textTerm(terms.specialTerms) || textTerm(terms.notes) || "",
      note: "現地対応・貸与物・事前承認など",
    }] : []),
  ];

  return (
    <article className="border-t border-[#e5e5ea] first:border-t-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5">
        <h3 className="min-w-0 text-sm font-semibold text-[#1d1d1f]">{contract.title || "現行契約"}</h3>
        <span className="text-[11px] text-[#6e6e73]">{CONTRACT_TYPE_LABELS[contract.contractType || ""] || contract.contractType || "契約"}</span>
        <span className="text-[11px] text-[#6e6e73]">{contract.counterpartyName || "相手先未確認"}</span>
        <span className="text-[11px] font-medium text-[#1d1d1f]">{joinKnown([textTerm(contract.status), textTerm(contract.signatureStatus)], "状態未確認")}</span>
      </div>
      <dl className={`grid border-t border-[#ededf0] bg-[#fafafa] md:grid-cols-2 ${contractGridClass(blocks.length)}`}>
        {blocks.map((block) => (
          <div key={block.label} className="min-w-0 border-b border-r border-[#ededf0] px-3 py-3 md:even:border-r-0 xl:border-b-0 xl:border-r xl:last:border-r-0">
            <dt className="text-[10px] font-medium text-[#86868b]">{block.label}</dt>
            <dd className="mt-1 line-clamp-2 break-words text-[13px] font-semibold leading-5 text-[#1d1d1f]" title={block.value}>{block.value}</dd>
            <dd className="mt-1 line-clamp-2 text-[11px] leading-4 text-[#6e6e73]" title={block.note}>{block.note}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

export function CockpitProjectOverview({ project }: { project: CockpitOverviewProject }) {
  const contracts = currentContracts(project);
  const projectId = project.projectId;
  return (
    <div className="min-w-0 space-y-3">
      {projectId && <CockpitSeasonBudget projectId={projectId} />}
      <section className="overflow-hidden rounded-md border border-[#d6d6da] bg-white shadow-sm" aria-label="契約上の実行条件">
        <div className="flex items-center justify-between gap-3 border-b border-[#e5e5ea] px-3 py-2">
          <div className="min-w-0">
            <h2 className="text-[12px] font-semibold text-[#1d1d1f]">契約上の実行条件</h2>
            <p className="text-[10px] text-[#86868b]">契約期間・請求と振込・業務と成果物・経費申請。数字と条件は締結済み契約の読み取りで、ここでは編集しない。</p>
          </div>
          <span className="shrink-0 text-[10px] text-[#86868b]">{contracts.length}件</span>
        </div>
        {contracts.length > 0
          ? contracts.map((contract, index) => <CurrentContractTerms key={contract.contractId || `${contract.title}-${index}`} contract={contract} project={project} />)
          : <div className="px-3 py-4 text-sm text-[#6e6e73]">現行契約は未登録</div>}
      </section>
    </div>
  );
}
