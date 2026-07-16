// 標準的な「設立 → Seed → Series A/B/C → IPO」プランニングポリシーのプリセット。
// 全フィールドが編集可能な CapitalPlan/CapitalEvent の初期雛形を返すだけで、
// 生成後の編集・deriveCapitalPlan による再計算は capital-plan.ts の通常経路に委ねる。

import { editableValue, type CapitalEvent, type CapitalEventType, type Holder, type HolderKind, type ShareClass } from "./capital-plan.ts";
import {
  TRANSACTION_LABELS,
  type CompanyOverviewData,
  type EquityEntry,
  type EquityTransaction,
  type ValuationRound,
} from "./company-overview.ts";

export interface StandardIpoCapitalPlanDocument {
  holders: Holder[];
  events: CapitalEvent[];
}

const FOUNDER_SHARES = 10000;

interface RoundSpec {
  order: number;
  label: string;
  investorId: string;
  investorName: string;
  preMoneyValuation: number;
  investmentAmount: number;
  daysAfterIncorporation: number;
}

const ROUNDS: RoundSpec[] = [
  { order: 2, label: "Seed", investorId: "investor-seed", investorName: "Seed投資家", preMoneyValuation: 300_000_000, investmentAmount: 50_000_000, daysAfterIncorporation: 180 },
  { order: 3, label: "Series A", investorId: "investor-series-a", investorName: "Series A投資家", preMoneyValuation: 1_500_000_000, investmentAmount: 300_000_000, daysAfterIncorporation: 365 },
  { order: 4, label: "Series B", investorId: "investor-series-b", investorName: "Series B投資家", preMoneyValuation: 5_000_000_000, investmentAmount: 1_000_000_000, daysAfterIncorporation: 545 },
  { order: 5, label: "Series C", investorId: "investor-series-c", investorName: "Series C投資家", preMoneyValuation: 15_000_000_000, investmentAmount: 3_000_000_000, daysAfterIncorporation: 730 },
];

const IPO_DAYS_AFTER_INCORPORATION = 1095;

/** 日付のみ（タイムゾーン非依存・UTC基準）で "YYYY-MM-DD" を返す。 */
function todayDateOnly(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())).toISOString().slice(0, 10);
}

/** "YYYY-MM-DD" に日数を加算し、UTC基準で "YYYY-MM-DD" を返す（月末・年またぎも自動繰り上げ）。 */
function addDaysDateOnly(dateOnly: string, days: number): string {
  const [y, m, d] = dateOnly.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/**
 * 設立・Seed・Series A/B/C・IPO の各ラウンドを持つ、編集可能な標準プランニングポリシーを生成する。
 * すべてのイベントは status: 'planned'（未確定シナリオ）で、valuation_and_investment basis により
 * 上流の入力を変更すれば下流の株数・価格が deriveCapitalPlan で再計算される。
 * incorporationDate（"YYYY-MM-DD"）を省略した場合は生成時点の日付を起点に、各ラウンドの target date を
 * 時系列順（設立 → Seed → A → B → C → IPO）に自動採番する。テストではタイムゾーンのブレを避けるため
 * 明示的に incorporationDate を渡すこと。
 */
export function createStandardIpoCapitalPlanDocument(incorporationDate?: string): StandardIpoCapitalPlanDocument {
  const founder: Holder = { id: "founder", name: "創業者", kind: "founder" };
  const publicMarket: Holder = { id: "public-market", name: "公開市場", kind: "other" };

  const baseDate = incorporationDate ?? todayDateOnly();

  const holders: Holder[] = [founder];
  const events: CapitalEvent[] = [];

  events.push({
    id: "event-incorporation",
    type: "incorporation",
    label: "設立",
    order: 1,
    date: baseDate,
    status: "planned",
    calculationBasis: "manual",
    allocations: [
      {
        id: "alloc-incorporation-founder",
        holderId: founder.id,
        shareClass: "common",
        shares: editableValue(FOUNDER_SHARES),
      },
    ],
  });

  for (const round of ROUNDS) {
    const investor: Holder = { id: round.investorId, name: round.investorName, kind: "investor" };
    holders.push(investor);
    events.push({
      id: `event-${round.investorId}`,
      type: "equity_issue",
      label: round.label,
      order: round.order,
      date: addDaysDateOnly(baseDate, round.daysAfterIncorporation),
      status: "planned",
      calculationBasis: "valuation_and_investment",
      preMoneyValuation: editableValue(round.preMoneyValuation),
      allocations: [
        {
          id: `alloc-${round.investorId}`,
          holderId: investor.id,
          shareClass: "preferred",
          shares: editableValue(0, "calculated"),
          amount: editableValue(round.investmentAmount),
          pricePerShare: editableValue(0, "calculated"),
        },
      ],
    });
  }

  holders.push(publicMarket);
  const ipoInvestmentAmount = 5_000_000_000;
  events.push({
    id: "event-ipo",
    type: "ipo",
    label: "IPO",
    order: 6,
    date: addDaysDateOnly(baseDate, IPO_DAYS_AFTER_INCORPORATION),
    status: "planned",
    calculationBasis: "valuation_and_investment",
    preMoneyValuation: editableValue(30_000_000_000),
    allocations: [
      {
        id: "alloc-ipo-public-market",
        holderId: publicMarket.id,
        shareClass: "common",
        shares: editableValue(0, "calculated"),
        amount: editableValue(ipoInvestmentAmount),
        pricePerShare: editableValue(0, "calculated"),
      },
    ],
  });

  return { holders, events };
}

const CURRENT_SNAPSHOT_LABEL = "現在値取込（履歴未復元）";
const CURRENT_SNAPSHOT_NOTE =
  "確定済みの資本取引履歴が無いため、現時点の株主構成のみを取り込んだスナップショットです。設立時点からの正確な履歴は復元できません。";

function mapHolderKind(holderType: string | null): HolderKind {
  switch (holderType) {
    case "founder":
    case "amd":
    case "masa":
      return "founder";
    case "employee":
      return "employee";
    case "vc":
    case "angel":
    case "corporate":
      return "investor";
    default:
      return "other";
  }
}

function mapShareClass(shareClass: string | null | undefined): ShareClass {
  const s = shareClass || "";
  if (/優先|preferred/i.test(s)) return "preferred";
  if (/予約権|option|\bso\b/i.test(s)) return "option";
  if (/転換社債|cb|j-kiss|kiss|safe|convertible/i.test(s)) return "convertible";
  if (/warrant|ワラント/i.test(s)) return "warrant";
  return "common";
}

function mapTransactionEventType(transactionType: string): CapitalEventType {
  switch (transactionType) {
    case "incorporation":
      return "incorporation";
    case "transfer":
      return "secondary";
    case "stock_option_grant":
      return "option_pool";
    default:
      return "equity_issue";
  }
}

function slugify(name: string, fallbackIndex: number): string {
  const cleaned = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9぀-ヿ㐀-鿿]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || `holder-${fallbackIndex}`;
}

function transactionEventLabel(transaction: EquityTransaction, round: ValuationRound | undefined): string {
  if (round?.round_name && round.round_name.trim()) return round.round_name.trim();
  if (transaction.description && transaction.description.trim()) return transaction.description.trim();
  return TRANSACTION_LABELS[transaction.transaction_type] || transaction.transaction_type;
}

function entrySharesValue(entry: EquityEntry, shareClass: ShareClass): number {
  return shareClass === "option" || shareClass === "convertible" || shareClass === "warrant"
    ? Number(entry.diluted_delta ?? 0)
    : Number(entry.outstanding_delta ?? 0);
}

/**
 * 会社概要（法人プロフィール・株主・資本取引・ラウンド）を、編集可能な CapitalPlan の
 * ドキュメント（holders/events）へ変換する。data は一切変更しない（深い読み取りのみ）。
 */
export function createCapitalPlanDocumentFromCompanyOverview(
  data: CompanyOverviewData,
): StandardIpoCapitalPlanDocument {
  const holders: Holder[] = [];
  const holderIdByName = new Map<string, string>();
  let holderIndex = 0;

  function ensureHolderWithKind(name: string, kind: HolderKind): Holder {
    const existingId = holderIdByName.get(name);
    if (existingId) {
      const existing = holders.find((h) => h.id === existingId);
      if (existing) return existing;
    }
    holderIndex += 1;
    let id = slugify(name, holderIndex);
    while (holders.some((h) => h.id === id)) {
      id = `${id}-${holderIndex}`;
    }
    const holder: Holder = { id, name, kind };
    holders.push(holder);
    holderIdByName.set(name, id);
    return holder;
  }

  function ensureHolder(name: string, holderType: string | null): Holder {
    return ensureHolderWithKind(name, mapHolderKind(holderType));
  }

  const events: CapitalEvent[] = [];
  const confirmedTransactions = data.transactions
    .filter((transaction) => transaction.status === "confirmed")
    .sort((a, b) => a.effective_on.localeCompare(b.effective_on) || a.id.localeCompare(b.id));

  let order = 0;
  const usedLabelsLowercase = new Set<string>();
  let lastHistoryDate: string | undefined;

  if (confirmedTransactions.length > 0) {
    for (const transaction of confirmedTransactions) {
      order += 1;
      const round = transaction.round_id
        ? data.rounds.find((r) => r.id === transaction.round_id)
        : undefined;
      const entries = transaction.project_equity_entries || [];

      const allocations = entries.map((entry, i) => {
        const shareClass = mapShareClass(entry.security_class);
        const holder = ensureHolder(entry.holder_name, entry.holder_type);
        const shares = entrySharesValue(entry, shareClass);
        const amount = Number(entry.paid_in_yen_delta ?? 0);
        return {
          id: `${transaction.id}-alloc-${i}`,
          holderId: holder.id,
          shareClass,
          shares: editableValue(shares, "imported"),
          ...(amount !== 0 ? { amount: editableValue(amount, "imported") } : {}),
        };
      });

      const totalShares = entries.reduce((sum, entry) => sum + Number(entry.outstanding_delta ?? 0), 0);
      const totalAmount = entries.reduce((sum, entry) => sum + Number(entry.paid_in_yen_delta ?? 0), 0);

      const label = transactionEventLabel(transaction, round);
      usedLabelsLowercase.add(label.trim().toLowerCase());

      const noteParts = [
        transaction.notes?.trim(),
        transaction.source_ref ? `出典: ${transaction.source_ref}` : undefined,
      ].filter((part): part is string => Boolean(part));

      const event: CapitalEvent = {
        id: transaction.id,
        type: mapTransactionEventType(transaction.transaction_type),
        label,
        order,
        date: transaction.effective_on,
        status: "confirmed",
        calculationBasis: "manual",
        newShares: editableValue(totalShares, "confirmed"),
        primaryRaise: editableValue(totalAmount, "confirmed"),
        allocations,
        ...(noteParts.length > 0 ? { note: noteParts.join(" / ") } : {}),
      };

      if (round?.pre_money_yen != null) {
        event.preMoneyValuation = editableValue(round.pre_money_yen, "confirmed");
      }
      if (round?.post_money_yen != null) {
        event.postMoneyValuation = editableValue(round.post_money_yen, "confirmed");
      }
      if (round?.raised_yen != null) {
        event.primaryRaise = editableValue(round.raised_yen, "confirmed");
      }
      if (round?.price_per_share_yen != null) {
        event.pricePerShare = editableValue(round.price_per_share_yen, "confirmed");
      }

      events.push(event);
    }
    lastHistoryDate = confirmedTransactions[confirmedTransactions.length - 1].effective_on;
  } else {
    order += 1;
    const currentShareholders = data.shareholders.filter((row) => row.is_current !== false);
    const allocations = currentShareholders.map((row, i) => {
      const shareClass = mapShareClass(row.share_class);
      const holder = ensureHolder(row.holder_name, row.holder_type);
      const shares = Number(row.shares ?? 0);
      const amount = Number(row.invested_yen ?? 0);
      return {
        id: `current-shareholder-alloc-${i}`,
        holderId: holder.id,
        shareClass,
        shares: editableValue(shares, "imported"),
        ...(amount !== 0 ? { amount: editableValue(amount, "imported") } : {}),
      };
    });
    const totalShares = currentShareholders.reduce((sum, row) => sum + Number(row.shares ?? 0), 0);
    const totalAmount = currentShareholders.reduce((sum, row) => sum + Number(row.invested_yen ?? 0), 0);

    usedLabelsLowercase.add(CURRENT_SNAPSHOT_LABEL.trim().toLowerCase());

    const maxAsOfYm = currentShareholders.reduce<string | undefined>(
      (max, row) => (row.as_of_ym && (!max || row.as_of_ym > max) ? row.as_of_ym : max),
      undefined,
    );
    const snapshotDate = maxAsOfYm ? `${maxAsOfYm}-01` : todayDateOnly();
    lastHistoryDate = snapshotDate;

    events.push({
      id: "current-snapshot-incorporation",
      type: "incorporation",
      label: CURRENT_SNAPSHOT_LABEL,
      order,
      date: snapshotDate,
      status: "confirmed",
      calculationBasis: "manual",
      newShares: editableValue(totalShares, "confirmed"),
      primaryRaise: editableValue(totalAmount, "confirmed"),
      allocations,
      note: CURRENT_SNAPSHOT_NOTE,
    });
  }

  const standard = createStandardIpoCapitalPlanDocument(
    lastHistoryDate ? addDaysDateOnly(lastHistoryDate, 1) : undefined,
  );
  const standardHolderById = new Map(standard.holders.map((h) => [h.id, h]));
  let appendOrder = order;

  for (const standardEvent of standard.events) {
    if (standardEvent.label === "設立") continue; // 設立イベントは確定履歴/現在値取込側にしか存在しない
    if (usedLabelsLowercase.has(standardEvent.label.trim().toLowerCase())) continue;

    appendOrder += 1;
    const remappedAllocations = standardEvent.allocations.map((alloc) => {
      const standardHolder = standardHolderById.get(alloc.holderId);
      const holder = standardHolder ? ensureHolderWithKind(standardHolder.name, standardHolder.kind) : undefined;
      return {
        ...alloc,
        holderId: holder ? holder.id : alloc.holderId,
      };
    });

    events.push({
      ...standardEvent,
      order: appendOrder,
      allocations: remappedAllocations,
    });
  }

  return { holders, events };
}
