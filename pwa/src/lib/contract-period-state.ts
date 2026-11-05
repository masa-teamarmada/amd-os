export type ContractPeriodState = "in_effect" | "ended" | "not_started" | "renewal_review" | "period_unknown" | "not_signed" | "no_contract" | "unavailable";

export type ContractPeriodSource = {
  status?: unknown;
  effective_date?: unknown;
  expiration_date?: unknown;
  renewal_type?: unknown;
  contract_type?: unknown;
  relationship_scope?: unknown;
  registry_status?: unknown;
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const OPERATIONAL_CONTRACT_TYPES = new Set(["contract", "outsourcing", "order", "mandate", "joint_research", "mou"]);

export function isOperationalContractType(value: unknown): boolean {
  return OPERATIONAL_CONTRACT_TYPES.has(String(value ?? ""));
}

function date(value: unknown): string | null {
  return typeof value === "string" && DATE.test(value) ? value : null;
}

function automaticRenewal(value: unknown): boolean {
  const rule = String(value ?? "").trim();
  if (/自動更新.{0,20}(なし|ない)/.test(rule)) return false;
  return /自動更新|更新拒絶通知がなければ.*更新|終了意思表示がなければ.*更新/.test(rule);
}

export function contractPeriodState(contract: ContractPeriodSource, today: string): ContractPeriodState {
  if (contract.status !== "signed") return "not_signed";
  const start = date(contract.effective_date);
  const end = date(contract.expiration_date);
  if (!start || !end || start > end || !date(today)) return "period_unknown";
  if (today < start) return "not_started";
  if (today <= end) return "in_effect";
  return automaticRenewal(contract.renewal_type) ? "renewal_review" : "ended";
}

// PJの伴走状態とは独立した、AMD当事者の業務契約の履行期間。
// NDAや投資契約だけで業務契約を「有効」と表示しない。
export function projectContractPeriodState(contracts: ContractPeriodSource[], today: string): ContractPeriodState {
  const relevant = contracts.filter((contract) =>
    contract.relationship_scope === "amd_contract"
    && contract.registry_status === "accepted"
    && isOperationalContractType(contract.contract_type),
  );
  if (!relevant.length) return "no_contract";
  const signed = relevant.filter((contract) => contract.status === "signed");
  if (!signed.length) return "not_signed";
  const states = signed.map((contract) => contractPeriodState(contract, today));
  for (const state of ["in_effect", "renewal_review", "not_started", "period_unknown", "ended"] as const) {
    if (states.includes(state)) return state;
  }
  return "period_unknown";
}

export const CONTRACT_PERIOD_LABEL: Record<ContractPeriodState, string> = {
  in_effect: "契約期間内",
  ended: "契約終了",
  not_started: "開始前",
  renewal_review: "更新要確認",
  period_unknown: "期間未確認",
  not_signed: "未締結",
  no_contract: "業務契約なし",
  unavailable: "確認不可",
};
