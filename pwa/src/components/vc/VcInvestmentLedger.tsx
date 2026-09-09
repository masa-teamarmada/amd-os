"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchVcInvestmentLedger } from "@/lib/vc-data";
import type {
  InvestmentDealStatus,
  InvestmentVerificationStatus,
  VcInvestmentLedgerItem,
} from "@/types/vc";

const VERIFICATION_LABEL: Record<InvestmentVerificationStatus, string> = {
  confirmed: "確認済み",
  candidate: "収集候補",
  legacy_unreviewed: "既存・要確認",
  dismissed: "除外",
};

const DEAL_LABEL: Record<InvestmentDealStatus, string> = {
  planned: "予定",
  announced: "発表済み",
  completed: "払込確認済み",
  cancelled: "取消",
  unknown: "成立状態不明",
};

const ROLE_LABEL: Record<string, string> = {
  lead: "主幹",
  co_lead: "共同主幹",
  participant: "参加",
  unknown: "役割不明",
};

const ROUND_LABEL: Record<string, string> = {
  pre_seed: "プレシード",
  seed: "シード",
  series_a: "シリーズA",
  series_b: "シリーズB",
  series_c: "シリーズC",
  series_d: "シリーズD",
  bridge: "ブリッジ",
  growth: "グロース",
  unknown: "不明",
};

function formatMoney(
  low: number | null,
  high: number | null,
  currency: string,
  disclosure: string,
  legacyAmount?: number | null,
) {
  if (disclosure === "undisclosed") return "非公開";
  if (disclosure === "not_found") return "未確認";
  if (disclosure === "legacy_unclassified") {
    return legacyAmount != null ? `${formatNumber(legacyAmount, "JPY")} ※要確認` : "未確認";
  }
  if (low == null && high == null) return "未確認";
  if (low != null && high != null && low !== high) {
    return `${formatNumber(low, currency)}〜${formatNumber(high, currency)}`;
  }
  return formatNumber(low ?? high ?? 0, currency);
}

function formatNumber(value: number, currency: string) {
  if (currency === "JPY") {
    if (value >= 100_000_000) return `${trimZero(value / 100_000_000)}億円`;
    if (value >= 10_000) return `${trimZero(value / 10_000)}万円`;
    return `${Math.round(value).toLocaleString("ja-JP")}円`;
  }
  try {
    return new Intl.NumberFormat("ja-JP", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${value.toLocaleString("ja-JP")} ${currency}`;
  }
}

function trimZero(value: number) {
  return value.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

export function VcInvestmentLedger() {
  const [items, setItems] = useState<VcInvestmentLedgerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [vcFilter, setVcFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [verificationFilter, setVerificationFilter] = useState("all");
  const [amountFilter, setAmountFilter] = useState("all");

  useEffect(() => {
    fetchVcInvestmentLedger()
      .then(setItems)
      .catch((cause) => setError(cause instanceof Error ? cause.message : "投資履歴を読み込めなかった"))
      .finally(() => setLoading(false));
  }, []);

  const vcOptions = useMemo(
    () => [...new Map(items.map((item) => [item.vc.id, item.vc.name])).entries()].sort((a, b) => a[1].localeCompare(b[1], "ja")),
    [items],
  );
  const yearOptions = useMemo(
    () => [...new Set(items.map(eventDate).filter(Boolean).map((date) => date!.slice(0, 4)))].sort().reverse(),
    [items],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items
      .filter((item) => {
        const date = eventDate(item);
        const name = item.startup?.canonical_name ?? item.investment.target_company;
        if (query && !`${name} ${item.vc.name} ${item.vc.name_en ?? ""}`.toLowerCase().includes(query)) return false;
        if (vcFilter !== "all" && item.vc.id !== vcFilter) return false;
        if (yearFilter !== "all" && date?.slice(0, 4) !== yearFilter) return false;
        if (verificationFilter !== "all" && item.investment.verification_status !== verificationFilter) return false;
        if (amountFilter === "investor_known" && !hasInvestorAmount(item)) return false;
        if (amountFilter === "round_only" && (hasInvestorAmount(item) || !hasRoundAmount(item))) return false;
        if (amountFilter === "unknown" && (hasInvestorAmount(item) || hasRoundAmount(item))) return false;
        return true;
      })
      .sort((a, b) => (eventDate(b) ?? "").localeCompare(eventDate(a) ?? "") || a.vc.name.localeCompare(b.vc.name, "ja"));
  }, [amountFilter, items, search, vcFilter, verificationFilter, yearFilter]);

  const candidateCount = items.filter((item) => item.investment.verification_status === "candidate").length;
  const knownInvestorAmountCount = items.filter(hasInvestorAmount).length;

  if (loading) return <div className="py-16 text-center text-sm text-muted-foreground">投資履歴を読み込み中…</div>;
  if (error) {
    return (
      <div className="rounded-lg border border-rose-400/35 bg-rose-400/8 px-4 py-6 text-sm text-rose-100">
        投資履歴を読み込めなかった。データ構造の反映状態を確認してね。
        <div className="mt-2 text-xs text-rose-200/70">{error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border/70 bg-border/70 lg:grid-cols-4">
        <Metric label="投資参加記録" value={`${items.length}件`} />
        <Metric label="収集候補" value={`${candidateCount}件`} detail="確認前" />
        <Metric label="VC個別額あり" value={`${knownInvestorAmountCount}件`} />
        <Metric label="表示中" value={`${filtered.length}件`} detail={filtered.length === items.length ? "全件" : "絞り込み中"} />
      </section>

      <section className="rounded-lg border border-border/70 bg-background/40 p-3">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[minmax(240px,1.4fr)_minmax(180px,1fr)_120px_150px_170px]">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="SU・VC名で検索"
            className="h-9 min-w-0 rounded-md border border-border bg-black/15 px-3 text-xs outline-none placeholder:text-muted-foreground focus:border-cyan-300/60"
          />
          <select value={vcFilter} onChange={(event) => setVcFilter(event.target.value)} className="h-9 min-w-0 rounded-md border border-border bg-black/15 px-2 text-xs">
            <option value="all">すべてのVC</option>
            {vcOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
          <select value={yearFilter} onChange={(event) => setYearFilter(event.target.value)} className="h-9 rounded-md border border-border bg-black/15 px-2 text-xs">
            <option value="all">全年</option>
            {yearOptions.map((year) => <option key={year} value={year}>{year}年</option>)}
          </select>
          <select value={verificationFilter} onChange={(event) => setVerificationFilter(event.target.value)} className="h-9 rounded-md border border-border bg-black/15 px-2 text-xs">
            <option value="all">全確認状態</option>
            <option value="confirmed">確認済み</option>
            <option value="candidate">収集候補</option>
            <option value="legacy_unreviewed">既存・要確認</option>
          </select>
          <select value={amountFilter} onChange={(event) => setAmountFilter(event.target.value)} className="h-9 rounded-md border border-border bg-black/15 px-2 text-xs">
            <option value="all">金額状態すべて</option>
            <option value="investor_known">VC個別額あり</option>
            <option value="round_only">ラウンド総額のみ</option>
            <option value="unknown">金額未確認</option>
          </select>
        </div>
      </section>

      <div className="overflow-hidden rounded-lg border border-border/70">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1380px] text-xs">
            <thead className="sticky top-0 z-10 bg-muted/90 text-left text-[10px] uppercase tracking-[0.08em] text-muted-foreground backdrop-blur">
              <tr>
                <th className="w-24 px-3 py-2.5">出資・完了日</th>
                <th className="w-24 px-3 py-2.5">公表日</th>
                <th className="min-w-48 px-3 py-2.5">SU</th>
                <th className="w-28 px-3 py-2.5">ラウンド</th>
                <th className="min-w-48 px-3 py-2.5">VC / ファンド</th>
                <th className="w-32 px-3 py-2.5 text-right">VC個別出資額</th>
                <th className="w-32 px-3 py-2.5 text-right">ラウンド総額</th>
                <th className="w-24 px-3 py-2.5">役割</th>
                <th className="w-32 px-3 py-2.5">成立状態</th>
                <th className="w-32 px-3 py-2.5">確認状態</th>
                <th className="w-24 px-3 py-2.5">根拠</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => <LedgerRow key={item.investment.id} item={item} />)}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="px-4 py-16 text-center text-sm text-muted-foreground">条件に合う投資履歴はないよ。</div>
        )}
      </div>
    </div>
  );
}

function LedgerRow({ item }: { item: VcInvestmentLedgerItem }) {
  const investment = item.investment;
  const round = item.funding_round;
  const startupName = item.startup?.canonical_name ?? investment.target_company;
  const sourceUrl = round?.source_url ?? investment.source_url;
  const verification = investment.verification_status;
  const dealStatus = round?.deal_status ?? investment.deal_status;
  const amountDisclosure = investment.amount_disclosure;
  const roundDisclosure = round?.total_amount_disclosure ?? "not_found";

  return (
    <tr className="border-t border-border/45 align-top hover:bg-cyan-300/[0.035]">
      <td className="px-3 py-3 font-mono text-[11px] text-muted-foreground">{completionDate(item) ?? "未確認"}</td>
      <td className="px-3 py-3 font-mono text-[11px] text-muted-foreground">{announcementDate(item) ?? "未確認"}</td>
      <td className="px-3 py-3">
        <div className="font-medium text-foreground">{startupName}</div>
        {item.startup?.name_en && <div className="mt-0.5 text-[10px] text-muted-foreground">{item.startup.name_en}</div>}
      </td>
      <td className="px-3 py-3 text-muted-foreground">{ROUND_LABEL[round?.round_label ?? investment.round ?? "unknown"] ?? round?.round_label ?? investment.round ?? "不明"}</td>
      <td className="px-3 py-3">
        <div className="font-medium">{item.vc.name}</div>
        {item.fund && <div className="mt-0.5 text-[10px] text-muted-foreground">#{item.fund.fund_no} {item.fund.name ?? "号ファンド"}</div>}
      </td>
      <td className="px-3 py-3 text-right font-medium">
        {formatMoney(investment.investor_amount_low, investment.investor_amount_high, investment.investor_amount_currency, amountDisclosure, investment.amount_jpy)}
      </td>
      <td className="px-3 py-3 text-right text-muted-foreground">
        {formatMoney(round?.total_amount_low ?? null, round?.total_amount_high ?? null, round?.total_amount_currency ?? "JPY", roundDisclosure)}
      </td>
      <td className="px-3 py-3 text-muted-foreground">{ROLE_LABEL[investment.investor_role] ?? "役割不明"}</td>
      <td className="px-3 py-3"><PlainBadge label={DEAL_LABEL[dealStatus]} tone={dealStatus === "completed" ? "positive" : dealStatus === "planned" ? "warning" : "neutral"} /></td>
      <td className="px-3 py-3"><PlainBadge label={VERIFICATION_LABEL[verification]} tone={verification === "confirmed" ? "positive" : verification === "candidate" ? "review" : "neutral"} /></td>
      <td className="px-3 py-3">
        {sourceUrl ? (
          <a href={sourceUrl} target="_blank" rel="noreferrer" className="font-medium text-cyan-200 underline decoration-cyan-200/35 underline-offset-2 hover:text-cyan-100">開く</a>
        ) : <span className="text-muted-foreground">未登録</span>}
      </td>
    </tr>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="min-w-0 bg-background px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-lg font-semibold tabular-nums">{value}</span>
        {detail && <span className="text-[10px] text-muted-foreground">{detail}</span>}
      </div>
    </div>
  );
}

function PlainBadge({ label, tone }: { label: string; tone: "positive" | "warning" | "review" | "neutral" }) {
  const classes = {
    positive: "border-emerald-300/35 bg-emerald-300/10 text-emerald-100",
    warning: "border-amber-300/35 bg-amber-300/10 text-amber-100",
    review: "border-cyan-300/35 bg-cyan-300/10 text-cyan-100",
    neutral: "border-slate-500/45 bg-slate-700/25 text-slate-300",
  }[tone];
  return <span className={`inline-flex whitespace-nowrap rounded border px-1.5 py-0.5 text-[10px] ${classes}`}>{label}</span>;
}

function eventDate(item: VcInvestmentLedgerItem) {
  return completionDate(item) ?? announcementDate(item);
}

function completionDate(item: VcInvestmentLedgerItem) {
  return item.funding_round?.completed_on ?? (item.funding_round ? null : item.investment.invested_at);
}

function announcementDate(item: VcInvestmentLedgerItem) {
  return item.funding_round?.announced_on ?? null;
}

function hasInvestorAmount(item: VcInvestmentLedgerItem) {
  return item.investment.investor_amount_low != null || item.investment.investor_amount_high != null || item.investment.amount_jpy != null;
}

function hasRoundAmount(item: VcInvestmentLedgerItem) {
  return item.funding_round?.total_amount_low != null || item.funding_round?.total_amount_high != null;
}
