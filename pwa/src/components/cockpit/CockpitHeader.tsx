"use client";

import { paymentDueRuleLabel } from "@/lib/payment-rules";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-700",
  sales: "bg-blue-500/10 text-blue-700",
  draft: "bg-violet-500/10 text-violet-700",
  ended: "bg-zinc-200 text-zinc-500",
  frozen: "bg-amber-500/10 text-amber-700",
};

type ProjectContractTerms = {
  monthlyFeeYen?: number | string | null;
  contractStartYm?: string | null;
  contractEndYm?: string | null;
  actualWorkStartYm?: string | null;
  billingStartYm?: string | null;
  rewardPoolYen?: number | string | null;
  monthlyRewardCapYen?: number | string | null;
  deliverablesRequired?: boolean | string | null;
  deliverablesNote?: string | null;
  monthlyReportSubmissionRule?: string | null;
  monthlyReportSubmissionNote?: string | null;
  expenseReimbursementAllowed?: boolean | string | null;
  expenseReimbursementNote?: string | null;
  sourceTitle?: string | null;
  sourceRef?: string | null;
  notes?: string | null;
};

interface Props {
  project: {
    projectId: string;
    projectName: string;
    clientName: string;
    status: string;
    projectCategory?: string;
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

function formatYen(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  return amount > 0 && Number.isFinite(amount) ? `${Math.round(amount).toLocaleString("ja-JP")}円` : "未設定";
}

function feeTypeLabel(value: string | null | undefined) {
  if (value === "monthly_fixed") return "固定";
  if (value === "variable") return "変動";
  if (value === "milestone") return "MS";
  return "未設定";
}

function ymLabel(value: string | null | undefined) {
  if (!value) return "";
  if (/^\d{6}$/.test(value)) return `${value.slice(0, 4)}/${value.slice(4, 6)}`;
  return value;
}

function flagValue(value: unknown) {
  if (value === true || value === "true" || value === "あり" || value === "可" || value === "yes") return true;
  if (value === false || value === "false" || value === "なし" || value === "不可" || value === "no") return false;
  return null;
}

function flagLabel(value: unknown, trueLabel: string, falseLabel: string) {
  const normalized = flagValue(value);
  if (normalized === true) return trueLabel;
  if (normalized === false) return falseLabel;
  return "不明";
}

function buildContractCondition(project: Props["project"]) {
  const terms = project.contractTerms;
  const start = terms?.contractStartYm || project.startYm || "";
  const end = terms?.contractEndYm || project.endYm || "";
  const period = start || end ? `${ymLabel(start) || "未設定"} - ${ymLabel(end) || "未設定"}` : "期間未設定";
  const details = [
    terms?.actualWorkStartYm ? `実働 ${ymLabel(terms.actualWorkStartYm)}` : null,
    terms?.billingStartYm ? `請求 ${ymLabel(terms.billingStartYm)}` : null,
    terms?.monthlyRewardCapYen ? `cap ${formatYen(terms.monthlyRewardCapYen)}` : null,
  ].filter(Boolean);
  return details.length > 0 ? `${period} / ${details.join(" / ")}` : period;
}

function buildFee(project: Props["project"]) {
  const contractFee = Number(project.contractTerms?.monthlyFeeYen ?? 0);
  const amount = project.feeAmount ?? (contractFee > 0 ? contractFee : null);
  return `${feeTypeLabel(project.feeType)} / ${formatYen(amount)}`;
}

export function CockpitHeader({ project, members }: Props) {
  const terms = project.contractTerms ?? null;
  const memberLabel = members.length > 0 ? members.join(" / ") : "未設定";
  const summaryItems = [
    { label: "PJメンバー", value: memberLabel },
    { label: "契約条件", value: buildContractCondition(project), note: terms?.sourceTitle || null },
    { label: "業務委託料", value: buildFee(project) },
    { label: "支払い条件", value: paymentDueRuleLabel(project.paymentDueRule, project.paymentDueDay) },
    {
      label: "提出物",
      value: flagLabel(terms?.deliverablesRequired, "あり", "なし"),
      note: terms?.deliverablesNote || null,
    },
    {
      label: "月次報告",
      value: terms?.monthlyReportSubmissionRule || "不明",
      note: terms?.monthlyReportSubmissionNote || null,
    },
    {
      label: "立替精算",
      value: flagLabel(terms?.expenseReimbursementAllowed, "可", "不可"),
      note: terms?.expenseReimbursementNote || null,
    },
  ];

  return (
    <header className="space-y-2 py-1">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-bold">{project.projectName}</h1>
        {project.clientName && (
          <span className="text-[13px] text-[#86868b]">{project.clientName}</span>
        )}
        <span className={`text-[11px] px-2 py-0.5 rounded-full ${STATUS_COLORS[project.status] ?? "bg-muted text-muted-foreground"}`}>
          {project.status === "active" ? "Active" : project.status}
        </span>
        <span className={`text-[11px] px-2 py-0.5 rounded-full ${CATEGORY_COLORS[project.projectCategory || "dtsu"] ?? CATEGORY_COLORS.dtsu}`}>
          {CATEGORY_LABELS[project.projectCategory || "dtsu"] ?? "DTSU"}
        </span>
      </div>

      <dl className="grid gap-1.5 rounded-md border border-[#d6d6da] bg-white px-3 py-2 text-[11px] shadow-sm sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-7">
        {summaryItems.map((item) => (
          <div key={item.label} className="min-w-0 border-b border-[#e5e5ea] pb-1.5 last:border-b-0 sm:border-b-0 sm:border-r sm:pr-2 sm:last:border-r-0">
            <dt className="text-[10px] font-medium text-[#86868b]">{item.label}</dt>
            <dd className="mt-0.5 min-h-5 truncate font-semibold text-[#1d1d1f]" title={item.value}>
              {item.value}
            </dd>
            {item.note && (
              <dd className="mt-0.5 truncate text-[10px] text-[#86868b]" title={item.note}>
                {item.note}
              </dd>
            )}
          </div>
        ))}
      </dl>
    </header>
  );
}
