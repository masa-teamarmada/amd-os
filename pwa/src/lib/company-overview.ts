export type CompanyProfile = {
  id: string;
  project_id: string;
  legal_status: string;
  legal_name: string | null;
  legal_name_en: string | null;
  corporate_number: string | null;
  entity_type: string | null;
  incorporated_on: string | null;
  head_office: string | null;
  business_purpose: string | null;
  representative_name: string | null;
  capital_yen: number | null;
  authorized_shares: number | null;
  registered_issued_shares: number | null;
  board_structure: string | null;
  has_board: boolean | null;
  has_auditor: boolean | null;
  fiscal_year_end_month: number | null;
  public_notice_method: string | null;
  invoice_registration_number: string | null;
  source_ref: string | null;
  source_verified_on: string | null;
  notes: string | null;
};

export type LegacyShareholder = {
  id: string;
  holder_type: string | null;
  holder_name: string;
  share_class: string | null;
  shares: number | null;
  ownership_pct: number | null;
  invested_yen: number | null;
  as_of_ym: string | null;
  is_current: boolean | null;
};

export type EquityEntry = {
  id: string;
  holder_type: string | null;
  holder_name: string;
  security_class: string;
  outstanding_delta: number;
  diluted_delta: number;
  paid_in_yen_delta: number;
};

export type EquityTransaction = {
  id: string;
  project_id: string;
  round_id: string | null;
  effective_on: string;
  transaction_type: string;
  description: string | null;
  status: "planned" | "confirmed" | "void";
  source_ref: string | null;
  notes: string | null;
  project_equity_entries: EquityEntry[];
};

export type ConvertibleInstrument = {
  id: string;
  holder_name: string;
  instrument_type: string;
  issued_on: string | null;
  principal_yen: number | null;
  valuation_cap_yen: number | null;
  discount_rate: number | null;
  conversion_trigger: string | null;
  maturity_on: string | null;
  estimated_conversion_price: number | null;
  estimated_conversion_shares: number | null;
  status: string;
  notes: string | null;
};

export type FinancialPeriod = {
  id: string;
  fiscal_year: number;
  period_start_on: string | null;
  period_end_on: string | null;
  statement_status: string;
  revenue_yen: number | null;
  operating_income_yen: number | null;
  ordinary_income_yen: number | null;
  net_income_yen: number | null;
  total_assets_yen: number | null;
  total_liabilities_yen: number | null;
  net_assets_yen: number | null;
  cash_yen: number | null;
  debt_yen: number | null;
  filed_on: string | null;
  source_ref: string | null;
  notes: string | null;
};

export type ValuationRound = {
  id: string;
  round_name: string | null;
  round_date: string | null;
  round_ym: string | null;
  pre_money_yen: number | null;
  post_money_yen: number | null;
  raised_yen: number | null;
  price_per_share_yen: number | null;
  lead_investor: string | null;
  source_ref: string | null;
  notes: string | null;
};

export type CompanyMeeting = {
  id: string;
  meeting_type: string | null;
  meeting_date: string | null;
  meeting_ym: string | null;
  location: string | null;
  agenda_summary: string | null;
  resolutions_json: Array<{ title?: string; type?: string; result?: string }> | null;
  amd_response: string | null;
  attachments_json: Array<{ name?: string; url?: string; webViewLink?: string; web_view_link?: string }> | null;
  source_ref: string | null;
  notes: string | null;
};

export type GovernanceActionItem = {
  action_id: string;
  title: string;
  summary: string | null;
  due_at: string | null;
  status: string;
  priority: string | null;
  action_url: string | null;
};

export type CompanyOverviewData = {
  profile: CompanyProfile | null;
  shareholders: LegacyShareholder[];
  transactions: EquityTransaction[];
  convertibles: ConvertibleInstrument[];
  financialPeriods: FinancialPeriod[];
  rounds: ValuationRound[];
  meetings: CompanyMeeting[];
  actionItems: GovernanceActionItem[];
};

export type CapTableRow = {
  key: string;
  holderType: string;
  holderName: string;
  securityClass: string;
  outstandingShares: number;
  dilutedShares: number;
  paidInYen: number;
  ownershipPct: number;
  dilutedPct: number;
};

export type CapTableSnapshot = {
  id: string;
  label: string;
  effectiveOn: string;
  rows: CapTableRow[];
  outstandingShares: number;
  dilutedShares: number;
  paidInYen: number;
};

export const HOLDER_LABELS: Record<string, string> = {
  founder: "創業者",
  amd: "AMD",
  masa: "まさ",
  employee: "役職員・SO",
  vc: "VC",
  angel: "エンジェル",
  corporate: "事業会社",
  other: "その他",
};

export const HOLDER_COLORS: Record<string, string> = {
  founder: "#1d4ed8",
  amd: "#0f766e",
  masa: "#0d9488",
  employee: "#7c3aed",
  vc: "#0284c7",
  angel: "#d97706",
  corporate: "#475569",
  other: "#94a3b8",
};

export const TRANSACTION_LABELS: Record<string, string> = {
  opening_balance: "開始残高",
  incorporation: "設立",
  new_issue: "新株発行",
  transfer: "株式譲渡",
  stock_option_grant: "SO付与",
  stock_option_exercise: "SO行使",
  split: "株式分割",
  consolidation: "株式併合",
  cancellation: "消却・失効",
  correction: "訂正",
};

function finiteNumber(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function roundShare(value: number) {
  return Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;
}

function rowsFromBalances(
  balances: Map<string, Omit<CapTableRow, "ownershipPct" | "dilutedPct">>,
): CapTableRow[] {
  const visible = [...balances.values()].filter(
    (row) => Math.abs(row.outstandingShares) > 0.000001 || Math.abs(row.dilutedShares) > 0.000001,
  );
  const outstandingTotal = visible.reduce((sum, row) => sum + row.outstandingShares, 0);
  const dilutedTotal = visible.reduce((sum, row) => sum + row.dilutedShares, 0);
  return visible
    .map((row) => ({
      ...row,
      outstandingShares: roundShare(row.outstandingShares),
      dilutedShares: roundShare(row.dilutedShares),
      ownershipPct: outstandingTotal > 0 ? (row.outstandingShares / outstandingTotal) * 100 : 0,
      dilutedPct: dilutedTotal > 0 ? (row.dilutedShares / dilutedTotal) * 100 : 0,
    }))
    .sort((a, b) => b.dilutedShares - a.dilutedShares || a.holderName.localeCompare(b.holderName, "ja"));
}

function transactionLabel(transaction: EquityTransaction) {
  return transaction.description?.trim()
    || TRANSACTION_LABELS[transaction.transaction_type]
    || transaction.transaction_type;
}

/**
 * confirmed の株式イベントだけを時系列で積み上げ、各時点の cap table を再計算する。
 * planned は入力済みでも法的現在値には反映しない。転換前証券も別シナリオで扱う。
 */
export function buildCapTableSnapshots(data: CompanyOverviewData): CapTableSnapshot[] {
  const transactions = data.transactions
    .filter((transaction) => transaction.status === "confirmed")
    .sort((a, b) => a.effective_on.localeCompare(b.effective_on) || a.id.localeCompare(b.id));

  if (transactions.length === 0) {
    const current = data.shareholders.filter((row) => row.is_current !== false);
    const balances = new Map<string, Omit<CapTableRow, "ownershipPct" | "dilutedPct">>();
    for (const row of current) {
      const securityClass = row.share_class || "普通株式";
      const key = `${row.holder_name}\u0000${securityClass}`;
      const shares = finiteNumber(row.shares);
      balances.set(key, {
        key,
        holderType: row.holder_type || "other",
        holderName: row.holder_name,
        securityClass,
        outstandingShares: shares,
        dilutedShares: shares,
        paidInYen: finiteNumber(row.invested_yen),
      });
    }
    const rows = rowsFromBalances(balances);
    if (rows.length === 0) return [];
    return [{
      id: "legacy-current",
      label: "現在",
      effectiveOn: current.map((row) => row.as_of_ym || "").sort().at(-1) || "",
      rows,
      outstandingShares: rows.reduce((sum, row) => sum + row.outstandingShares, 0),
      dilutedShares: rows.reduce((sum, row) => sum + row.dilutedShares, 0),
      paidInYen: rows.reduce((sum, row) => sum + row.paidInYen, 0),
    }];
  }

  const balances = new Map<string, Omit<CapTableRow, "ownershipPct" | "dilutedPct">>();
  const snapshots: CapTableSnapshot[] = [];
  for (const transaction of transactions) {
    for (const entry of transaction.project_equity_entries || []) {
      const securityClass = entry.security_class || "普通株式";
      const key = `${entry.holder_name}\u0000${securityClass}`;
      const current = balances.get(key) || {
        key,
        holderType: entry.holder_type || "other",
        holderName: entry.holder_name,
        securityClass,
        outstandingShares: 0,
        dilutedShares: 0,
        paidInYen: 0,
      };
      balances.set(key, {
        ...current,
        holderType: entry.holder_type || current.holderType,
        outstandingShares: current.outstandingShares + finiteNumber(entry.outstanding_delta),
        dilutedShares: current.dilutedShares + finiteNumber(entry.diluted_delta),
        paidInYen: current.paidInYen + finiteNumber(entry.paid_in_yen_delta),
      });
    }
    const rows = rowsFromBalances(balances);
    snapshots.push({
      id: transaction.id,
      label: transactionLabel(transaction),
      effectiveOn: transaction.effective_on,
      rows,
      outstandingShares: rows.reduce((sum, row) => sum + row.outstandingShares, 0),
      dilutedShares: rows.reduce((sum, row) => sum + row.dilutedShares, 0),
      paidInYen: rows.reduce((sum, row) => sum + row.paidInYen, 0),
    });
  }
  return snapshots;
}

export function latestCapTable(data: CompanyOverviewData) {
  return buildCapTableSnapshots(data).at(-1) || null;
}

export function groupSnapshotByHolderType(snapshot: CapTableSnapshot, diluted = false) {
  const total = diluted ? snapshot.dilutedShares : snapshot.outstandingShares;
  const groups = new Map<string, number>();
  for (const row of snapshot.rows) {
    const value = diluted ? row.dilutedShares : row.outstandingShares;
    groups.set(row.holderType, (groups.get(row.holderType) || 0) + value);
  }
  return [...groups.entries()]
    .map(([holderType, shares]) => ({
      holderType,
      label: HOLDER_LABELS[holderType] || holderType,
      shares,
      pct: total > 0 ? (shares / total) * 100 : 0,
      color: HOLDER_COLORS[holderType] || HOLDER_COLORS.other,
    }))
    .filter((group) => group.shares > 0)
    .sort((a, b) => b.shares - a.shares);
}

export function convertibleScenario(data: CompanyOverviewData) {
  const current = latestCapTable(data);
  const instruments = data.convertibles.filter(
    (instrument) => instrument.status === "outstanding" && finiteNumber(instrument.estimated_conversion_shares) > 0,
  );
  const estimatedShares = instruments.reduce(
    (sum, instrument) => sum + finiteNumber(instrument.estimated_conversion_shares),
    0,
  );
  return {
    instruments,
    estimatedShares,
    proFormaDilutedShares: (current?.dilutedShares || 0) + estimatedShares,
  };
}

export function capTableTieOut(data: CompanyOverviewData) {
  const ledgerShares = latestCapTable(data)?.outstandingShares || 0;
  const registeredShares = finiteNumber(data.profile?.registered_issued_shares);
  if (!registeredShares) return { state: "unknown" as const, ledgerShares, registeredShares, difference: 0 };
  const difference = roundShare(ledgerShares - registeredShares);
  return {
    state: Math.abs(difference) < 0.000001 ? "matched" as const : "mismatch" as const,
    ledgerShares,
    registeredShares,
    difference,
  };
}
