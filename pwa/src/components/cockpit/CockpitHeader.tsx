"use client";

import { paymentDueRuleLabel } from "@/lib/payment-rules";
import {
  boolTerm,
  textTerm,
  type ProjectContractTerms,
  type ProjectCurrentContract,
} from "@/lib/project-contract-terms";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-700",
  sales: "bg-blue-500/10 text-blue-700",
  draft: "bg-violet-500/10 text-violet-700",
  ended: "bg-zinc-200 text-zinc-500",
  frozen: "bg-amber-500/10 text-amber-700",
};

interface Props {
  project: {
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
  };
  members: string[];
}

const CATEGORY_LABELS: Record<string, string> = {
  dtsu: "DTSU",
  new_business: "新規事業創出",
  ecosystem: "研究機関エコシステム",
  advisor: "社外役員/顧問",
};

const CATEGORY_COLORS: Record<string, string> = {
  dtsu: "bg-cyan-500/10 text-cyan-700",
  new_business: "bg-emerald-500/10 text-emerald-700",
  ecosystem: "bg-violet-500/10 text-violet-700",
  advisor: "bg-amber-500/10 text-amber-700",
};

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

function expenseLabel(terms: ProjectContractTerms) {
  const allowed = boolTerm(terms.expenseReimbursementAllowed);
  const note = textTerm(terms.expenseReimbursementNote);
  if (allowed === false) return joinKnown(["申請不可", note]);
  if (allowed === true) return joinKnown(["申請可", note]);
  return note || "未確認";
}

function deliverablesLabel(terms: ProjectContractTerms) {
  const required = boolTerm(terms.deliverablesRequired);
  const status = required === true ? "成果物あり" : required === false ? "成果物なし" : null;
  return joinKnown([status, textTerm(terms.deliverablesNote), textTerm(terms.acceptanceTerms)]);
}

function reportLabel(terms: ProjectContractTerms) {
  return joinKnown([
    textTerm(terms.monthlyReportSubmissionRule),
    textTerm(terms.monthlyReportSubmissionTiming),
    textTerm(terms.monthlyReportSubmissionDeadline),
    textTerm(terms.monthlyReportSubmissionNote),
  ]);
}

function legacyCurrentContract(project: Props["project"]): ProjectCurrentContract | null {
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

function currentContracts(project: Props["project"]) {
  const terms = project.contractTerms;
  if (Array.isArray(terms?.currentContracts)) return terms.currentContracts;
  const legacy = legacyCurrentContract(project);
  return legacy ? [legacy] : [];
}

function effectiveTerms(contract: ProjectCurrentContract, fallback: ProjectContractTerms | null | undefined) {
  return (contract.terms || fallback || {}) as ProjectContractTerms;
}

function CurrentContractTerms({ contract, project }: { contract: ProjectCurrentContract; project: Props["project"] }) {
  const terms = effectiveTerms(contract, project.contractTerms);
  const periodStart = ymLabel(contract.effectiveDate || terms.contractStartYm);
  const periodEnd = ymLabel(contract.expirationDate || terms.contractEndYm);
  const contractAmount = formatYen(terms.amountTaxExclTotal);
  const contractMonthlyFee = formatYen(terms.monthlyFeeYen);
  const projectMonthlyFee = formatYen(project.feeAmount);
  const payment = paymentDueRuleLabel(project.paymentDueRule, project.paymentDueDay);
  const confidentiality = textTerm(terms.confidentialitySummary)
    || textTerm(terms.nda?.purpose)
    || "未確認";
  const confidentialitySurvival = textTerm(terms.confidentialitySurvival)
    || textTerm(terms.nda?.postTerminationConfidentiality);
  const blocks = [
    {
      label: "期間・更新",
      value: periodStart || periodEnd ? `${periodStart || "未確認"} - ${periodEnd || "未確認"}` : "未確認",
      note: joinKnown([textTerm(contract.renewalType || terms.renewalType), contract.renewalNoticeDate ? `通知 ${ymLabel(contract.renewalNoticeDate)}` : null], "更新条件未確認"),
    },
    {
      label: "金額・支払",
      value: contractAmount ? `税抜総額 ${contractAmount}` : contractMonthlyFee ? `${feeTypeLabel(project.feeType) || "月額"} ${contractMonthlyFee}` : projectMonthlyFee ? `PJ設定 ${feeTypeLabel(project.feeType) || "月額"} ${projectMonthlyFee}` : "金額未確認",
      note: contractAmount || contractMonthlyFee
        ? joinKnown([textTerm(terms.paymentTerms), payment, textTerm(terms.taxTreatment)])
        : joinKnown(["契約金額は未確認", payment ? `PJ設定: ${payment}` : null]),
    },
    {
      label: "業務・成果物",
      value: textTerm(terms.scopeSummary) || textTerm(terms.nda?.purpose) || "業務範囲未確認",
      note: joinKnown([deliverablesLabel(terms), reportLabel(terms)]),
    },
    {
      label: "費用負担",
      value: expenseLabel(terms),
      note: "立替、旅費、外注等",
    },
    {
      label: "知財・利用",
      value: joinKnown([textTerm(terms.ipOwnership), textTerm(terms.usageRights)]),
      note: textTerm(terms.publicityRights) || "名称・実績公開 未確認",
    },
    {
      label: "秘密保持・制限",
      value: confidentiality,
      note: joinKnown([confidentialitySurvival, textTerm(terms.subcontractingTerms), textTerm(terms.exclusivityTerms)]),
    },
    {
      label: "解除・責任",
      value: joinKnown([textTerm(terms.terminationTerms), textTerm(terms.liabilityTerms)]),
      note: textTerm(terms.governingLawJurisdiction) || "準拠法・管轄 未確認",
    },
    {
      label: "特記事項",
      value: textTerm(terms.specialTerms) || textTerm(terms.notes) || "なし",
      note: textTerm(terms.sourceTitle) ? `根拠: ${terms.sourceTitle}` : "根拠未登録",
    },
  ];

  return (
    <article className="border-t border-[#e5e5ea] first:border-t-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5">
        <h2 className="min-w-0 text-sm font-semibold text-[#1d1d1f]">{contract.title || "現行契約"}</h2>
        <span className="text-[11px] text-[#6e6e73]">{CONTRACT_TYPE_LABELS[contract.contractType || ""] || contract.contractType || "契約"}</span>
        <span className="text-[11px] text-[#6e6e73]">{contract.counterpartyName || "相手先未確認"}</span>
        <span className="text-[11px] font-medium text-[#1d1d1f]">{joinKnown([textTerm(contract.status), textTerm(contract.signatureStatus)], "状態未確認")}</span>
      </div>
      <dl className="grid border-t border-[#ededf0] bg-[#fafafa] sm:grid-cols-2 lg:grid-cols-4">
        {blocks.map((block) => (
          <div key={block.label} className="min-w-0 border-b border-r border-[#ededf0] px-3 py-2.5 lg:[&:nth-last-child(-n+4)]:border-b-0">
            <dt className="text-[10px] font-medium text-[#86868b]">{block.label}</dt>
            <dd className="mt-1 break-words text-[12px] font-semibold leading-5 text-[#1d1d1f]">{block.value}</dd>
            <dd className="mt-0.5 line-clamp-2 text-[10px] leading-4 text-[#6e6e73]" title={block.note}>{block.note}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

export function CockpitHeader({ project, members }: Props) {
  const contracts = currentContracts(project);
  const category = project.projectCategory || "dtsu";
  return (
    <header className="space-y-2 py-1">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-bold">{project.projectName}</h1>
        {project.clientName && <span className="text-[13px] text-[#86868b]">{project.clientName}</span>}
        <span className={`rounded-full px-2 py-0.5 text-[11px] ${STATUS_COLORS[project.status] ?? "bg-muted text-muted-foreground"}`}>{project.status === "active" ? "Active" : project.status}</span>
        <span className={`rounded-full px-2 py-0.5 text-[11px] ${CATEGORY_COLORS[category] ?? CATEGORY_COLORS.dtsu}`}>{CATEGORY_LABELS[category] ?? "DTSU"}</span>
        <span className="text-[11px] text-[#6e6e73]">PJメンバー {members.length > 0 ? members.join(" / ") : "未設定"}</span>
      </div>

      <section className="overflow-hidden rounded-md border border-[#d6d6da] bg-white shadow-sm" aria-label="現行・進行中の契約条件">
        <div className="flex items-center justify-between gap-3 border-b border-[#e5e5ea] px-3 py-2">
          <h2 className="text-[11px] font-semibold text-[#1d1d1f]">現行・進行中の契約条件</h2>
          <span className="text-[10px] text-[#86868b]">{contracts.length}件</span>
        </div>
        {contracts.length > 0
          ? contracts.map((contract, index) => <CurrentContractTerms key={contract.contractId || `${contract.title}-${index}`} contract={contract} project={project} />)
          : <div className="px-3 py-4 text-sm text-[#6e6e73]">現行契約は未登録</div>}
      </section>
    </header>
  );
}
