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
  transactionType: string;
  roundId: string | null;
  outstandingDelta: number;
  dilutedDelta: number;
  paidInYenDelta: number;
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
  in_kind_contribution: "現物出資",
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
      transactionType: "opening_balance",
      roundId: null,
      outstandingDelta: 0,
      dilutedDelta: 0,
      paidInYenDelta: 0,
      rows,
      outstandingShares: rows.reduce((sum, row) => sum + row.outstandingShares, 0),
      dilutedShares: rows.reduce((sum, row) => sum + row.dilutedShares, 0),
      paidInYen: rows.reduce((sum, row) => sum + row.paidInYen, 0),
    }];
  }

  const balances = new Map<string, Omit<CapTableRow, "ownershipPct" | "dilutedPct">>();
  const snapshots: CapTableSnapshot[] = [];
  for (const transaction of transactions) {
    const entries = transaction.project_equity_entries || [];
    const outstandingDelta = entries.reduce((sum, entry) => sum + finiteNumber(entry.outstanding_delta), 0);
    const dilutedDelta = entries.reduce((sum, entry) => sum + finiteNumber(entry.diluted_delta), 0);
    const paidInYenDelta = entries.reduce((sum, entry) => sum + finiteNumber(entry.paid_in_yen_delta), 0);
    for (const entry of entries) {
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
      transactionType: transaction.transaction_type,
      roundId: transaction.round_id,
      outstandingDelta,
      dilutedDelta,
      paidInYenDelta,
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

/**
 * 資本履歴の起点が設立イベントかどうかを判定する pure helper。
 * legacy-current（旧 cap table の現在値のみ）や opening_balance 止まりの履歴は
 * 「設立イベントを含む正式な履歴」とは扱わないため、警告を出す。
 */
export function capTableOriginWarning(data: CompanyOverviewData, snapshots: CapTableSnapshot[]): boolean {
  if (snapshots.length === 0) return false;
  const confirmed = data.transactions
    .filter((transaction) => transaction.status === "confirmed")
    .sort((a, b) => a.effective_on.localeCompare(b.effective_on) || a.id.localeCompare(b.id));
  return confirmed[0]?.transaction_type !== "incorporation";
}

export type NextRoundInputs = {
  preMoneyYen: number;
  raiseYen: number;
  /** 追加SOプールの目標比率。0..0.5 の小数（10% なら 0.10）。 */
  targetPoolRate: number;
  includeConvertibles: boolean;
  protectHolderName?: string | null;
};

export type NextRoundScenarioRow = {
  key: string;
  holderName: string;
  holderType: string;
  beforeShares: number;
  beforePct: number;
  afterShares: number;
  afterPct: number;
  isConvertible?: boolean;
  isNewInvestor?: boolean;
  isOptionPool?: boolean;
  isProtected?: boolean;
};

export type NextRoundScenarioResult =
  | { valid: false; error: string }
  | {
      valid: true;
      error?: undefined;
      f0: number;
      existingPoolShares: number;
      additionalPoolShares: number;
      issuePriceYen: number;
      newInvestorShares: number;
      postFdShares: number;
      preMoneyYen: number;
      raiseYen: number;
      postMoneyYen: number;
      rows: NextRoundScenarioRow[];
    };

function outstandingConvertiblesFor(convertibles: ConvertibleInstrument[]) {
  return convertibles.filter(
    (instrument) => instrument.status === "outstanding" && finiteNumber(instrument.estimated_conversion_shares) > 0,
  );
}

/**
 * 次回ラウンド試算（何も保存しない pure function）。
 * option pool の積み増しは pre-money 側で負担し、目標比率 q を満たす x を解析的に求める。
 * x = max(0, (q*k*F0 - existingPool) / (1 - q*k))、k = 1 + r/p。
 * 転換前証券の未確定株数は推定しない（estimated_conversion_shares が入力済みのものだけ使う）。
 * 行は security 単位ではなく holderName 単位で合算し、転換社債が既存株主と同名なら
 * その株主の post shares にそのまま合算する（新規投資家/追加SOプールだけ別行）。
 */
export function computeNextRoundScenario(
  snapshot: CapTableSnapshot,
  convertibles: ConvertibleInstrument[],
  input: NextRoundInputs,
): NextRoundScenarioResult {
  const p = finiteNumber(input.preMoneyYen);
  const r = finiteNumber(input.raiseYen);
  const q = finiteNumber(input.targetPoolRate);
  if (p <= 0) return { valid: false, error: "pre-money は0より大きい額を入力してね" };
  if (r < 0) return { valid: false, error: "調達額は0以上で入力してね" };
  if (q < 0 || q > 0.5) return { valid: false, error: "追加SOプールの目標比率は0%〜50%で入力してね" };

  const convertibleRows = input.includeConvertibles ? outstandingConvertiblesFor(convertibles) : [];
  const convertibleShares = convertibleRows.reduce((sum, instrument) => sum + finiteNumber(instrument.estimated_conversion_shares), 0);
  const f0 = snapshot.dilutedShares + convertibleShares;
  if (f0 <= 0) return { valid: false, error: "現在の完全希薄化後株式数が0以下のため試算できないよ" };

  const existingPoolShares = snapshot.rows.reduce((sum, row) => sum + Math.max(0, row.dilutedShares - row.outstandingShares), 0);
  const k = 1 + r / p;
  const denominator = 1 - q * k;
  if (denominator <= 0) return { valid: false, error: "この pre-money / 調達額の組み合わせでは目標SOプール比率を満たせないよ" };

  const x = q === 0 ? 0 : Math.max(0, (q * k * f0 - existingPoolShares) / denominator);
  const issuePriceYen = p / (f0 + x);
  if (!Number.isFinite(issuePriceYen) || issuePriceYen <= 0) return { valid: false, error: "発行価格を計算できなかったよ" };
  const newInvestorShares = r / issuePriceYen;
  const postFdShares = f0 + x + newInvestorShares;
  const postMoneyYen = p + r;

  const holderMap = new Map<string, { holderType: string; beforeShares: number }>();
  for (const row of snapshot.rows) {
    const current = holderMap.get(row.holderName) || { holderType: row.holderType, beforeShares: 0 };
    holderMap.set(row.holderName, { holderType: row.holderType, beforeShares: current.beforeShares + row.dilutedShares });
  }

  const mergedConvertibleShares = new Map<string, number>();
  const standaloneConvertibles: Array<{ holderName: string; shares: number }> = [];
  for (const instrument of convertibleRows) {
    const shares = finiteNumber(instrument.estimated_conversion_shares);
    if (holderMap.has(instrument.holder_name)) {
      mergedConvertibleShares.set(instrument.holder_name, (mergedConvertibleShares.get(instrument.holder_name) || 0) + shares);
    } else {
      standaloneConvertibles.push({ holderName: instrument.holder_name, shares });
    }
  }

  const rows: NextRoundScenarioRow[] = [...holderMap.entries()].map(([holderName, info]) => {
    const mergedShares = mergedConvertibleShares.get(holderName) || 0;
    const afterShares = info.beforeShares + mergedShares;
    return {
      key: `holder:${holderName}`,
      holderName,
      holderType: info.holderType,
      beforeShares: info.beforeShares,
      beforePct: snapshot.dilutedShares > 0 ? (info.beforeShares / snapshot.dilutedShares) * 100 : 0,
      afterShares,
      afterPct: postFdShares > 0 ? (afterShares / postFdShares) * 100 : 0,
      isProtected: input.protectHolderName != null && holderName === input.protectHolderName,
    };
  });
  for (const instrument of standaloneConvertibles) {
    rows.push({
      key: `holder:${instrument.holderName}`,
      holderName: instrument.holderName,
      holderType: "convertible",
      beforeShares: 0,
      beforePct: 0,
      afterShares: instrument.shares,
      afterPct: postFdShares > 0 ? (instrument.shares / postFdShares) * 100 : 0,
      isConvertible: true,
    });
  }
  if (x > 0.000001) {
    rows.push({
      key: "next-round:additional-pool",
      holderName: "追加SOプール",
      holderType: "employee",
      beforeShares: 0,
      beforePct: 0,
      afterShares: x,
      afterPct: postFdShares > 0 ? (x / postFdShares) * 100 : 0,
      isOptionPool: true,
    });
  }
  rows.push({
    key: "next-round:new-investor",
    holderName: "新規投資家（次回ラウンド）",
    holderType: "vc",
    beforeShares: 0,
    beforePct: 0,
    afterShares: newInvestorShares,
    afterPct: postFdShares > 0 ? (newInvestorShares / postFdShares) * 100 : 0,
    isNewInvestor: true,
  });

  return {
    valid: true,
    f0,
    existingPoolShares,
    additionalPoolShares: x,
    issuePriceYen,
    newInvestorShares,
    postFdShares,
    preMoneyYen: p,
    raiseYen: r,
    postMoneyYen,
    rows,
  };
}

/**
 * 対象株主が目標比率を維持できる最低 pre-money を、computeNextRoundScenario と
 * 同じ関数を使った単調二分探索で求める（別の閉じた式は実装しない = 計算式のドリフト防止）。
 * 「現在の入力ですでに達成済みなら現在値を返す」ショートカットは意図的に使わない。
 */
export function minimumPreMoneyForTarget(
  snapshot: CapTableSnapshot,
  convertibles: ConvertibleInstrument[],
  input: NextRoundInputs,
  targetMinPct: number,
): { valid: boolean; preMoneyYen?: number; error?: string } {
  if (!input.protectHolderName) return { valid: false, error: "保護対象の株主を選んでね" };
  if (!(targetMinPct > 0) || targetMinPct >= 100) return { valid: false, error: "維持したい比率は0%より大きく100%未満で入力してね" };

  const protectHolderName = input.protectHolderName;
  const holderExists = snapshot.rows.some((row) => row.holderName === protectHolderName)
    || (input.includeConvertibles && outstandingConvertiblesFor(convertibles).some((instrument) => instrument.holder_name === protectHolderName));
  if (!holderExists) return { valid: false, error: "対象の株主が見つからないよ" };

  const pctAt = (preMoneyYen: number) => {
    const result = computeNextRoundScenario(snapshot, convertibles, { ...input, preMoneyYen });
    if (!result.valid) return null;
    return result.rows.find((row) => row.holderName === protectHolderName)?.afterPct ?? null;
  };

  let hi = Math.max(input.preMoneyYen, input.raiseYen || 1, 1) * 2;
  let hiPct = pctAt(hi);
  let guard = 0;
  while ((hiPct == null || hiPct < targetMinPct) && guard < 60) {
    hi *= 2;
    hiPct = pctAt(hi);
    guard += 1;
  }
  if (hiPct == null || hiPct < targetMinPct) return { valid: false, error: "この目標比率は現実的な pre-money では達成できないよ" };

  let lo = 0;
  for (let i = 0; i < 80; i += 1) {
    const mid = (lo + hi) / 2;
    const midPct = pctAt(mid);
    if (midPct != null && midPct >= targetMinPct) hi = mid;
    else lo = mid;
  }
  return { valid: true, preMoneyYen: hi };
}

/**
 * pre-money の感度分析（0.5x〜1.5x）。computeNextRoundScenario をそのまま再利用する。
 */
export function nextRoundSensitivity(
  snapshot: CapTableSnapshot,
  convertibles: ConvertibleInstrument[],
  input: NextRoundInputs,
) {
  const multipliers = [0.5, 0.75, 1.0, 1.25, 1.5];
  return multipliers.map((multiplier) => {
    const preMoneyYen = input.preMoneyYen * multiplier;
    const result = computeNextRoundScenario(snapshot, convertibles, { ...input, preMoneyYen });
    const watchedPct = result.valid && input.protectHolderName
      ? result.rows.find((row) => row.holderName === input.protectHolderName)?.afterPct ?? null
      : null;
    return { multiplier, preMoneyYen, result, watchedPct };
  });
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
