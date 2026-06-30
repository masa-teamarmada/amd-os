"use client";

/**
 * FundingStatsCard — ダッシュボード上部の「AMD全体 累計資金調達額 / 累計助成金額」カード。
 *
 * 営業資料でアピールする数字 (まさ依頼 2026-06-17、2026-06-30 更新)。
 * 会社ごとの全ラウンド/助成金を表示しつつ、累計には AMD 貢献として明示された金額だけを入れる。
 * 集計は /api/funding-stats。cap table の持株比率・投資家別内訳は返さない。
 */

import { type ReactNode, useEffect, useState } from "react";

type ContributionStatus = "full" | "partial" | "none" | "unreviewed";
type FundingItem = {
  id: string;
  kind: "funding" | "grant";
  projectId: string;
  companyName: string;
  projectName: string;
  label: string;
  date: string | null;
  status: string | null;
  amountYen: number;
  amdContributedYen: number;
  contributionStatus: ContributionStatus;
  contributionNote: string | null;
  eligibleForTotal: boolean;
  meta: string | null;
};
type CompanyGroup = {
  projectId: string;
  companyName: string;
  projectName: string;
  registeredYen: number;
  amdContributedYen: number;
  itemCount: number;
  contributedItemCount: number;
  items: FundingItem[];
};
type Row = { projectId: string; name: string; amountYen: number; registeredYen: number; itemCount: number; contributedItemCount: number };
type Stats = {
  funding: {
    totalRaisedYen: number;
    totalRegisteredYen: number;
    roundCount: number;
    contributedRoundCount: number;
    fundedPjCount: number;
    companyCount: number;
    breakdown: Row[];
    companies: CompanyGroup[];
  };
  grants: {
    totalSecuredYen: number;
    totalRegisteredYen: number;
    securedCount: number;
    contributedGrantCount: number;
    grantPjCount: number;
    companyCount: number;
    breakdown: Row[];
    companies: CompanyGroup[];
  };
};
type ViewMode = "summary" | "company" | "ledger";

function yenOku(n: number) {
  if (n >= 1e8) return { v: (n / 1e8).toFixed(n >= 1e9 ? 0 : 2), unit: "億円" };
  if (n >= 1e4) return { v: Math.round(n / 1e4).toLocaleString(), unit: "万円" };
  return { v: n.toLocaleString(), unit: "円" };
}
function yenShort(n: number) {
  if (n >= 1e8) return `${(n / 1e8).toFixed(2)}億`;
  if (n >= 1e4) return `${Math.round(n / 1e4).toLocaleString()}万`;
  return `${n.toLocaleString()}`;
}

export function FundingStatsCard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [mode, setMode] = useState<ViewMode>("summary");

  useEffect(() => {
    let live = true;
    fetch("/api/funding-stats")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (live && j?.ok) setStats({ funding: j.funding, grants: j.grants }); })
      .catch(() => {});
    return () => { live = false; };
  }, []);

  if (!stats) return null;
  const raised = yenOku(stats.funding.totalRaisedYen);
  const grant = yenOku(stats.grants.totalSecuredYen);

  return (
    <section className="rounded-lg border border-border bg-background">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <div className="text-[13px] font-semibold">AMD全体 累計実績</div>
        <div className="ml-auto inline-flex divide-x divide-border overflow-hidden rounded border border-border text-[10px]">
          <ModeButton active={mode === "summary"} onClick={() => setMode("summary")}>累計</ModeButton>
          <ModeButton active={mode === "company"} onClick={() => setMode("company")}>会社別</ModeButton>
          <ModeButton active={mode === "ledger"} onClick={() => setMode("ledger")}>行別</ModeButton>
        </div>
      </div>

      <div className="grid grid-cols-2 divide-x divide-border">
        <Tile
          label="AMD貢献 累計資金調達額"
          v={raised.v}
          unit={raised.unit}
          sub={`${stats.funding.contributedRoundCount} / ${stats.funding.roundCount} ラウンド`}
          muted={`登録総額 ${yenShort(stats.funding.totalRegisteredYen)}`}
          accent="text-emerald-700"
        />
        <Tile
          label="AMD貢献 累計助成金・補助金"
          v={grant.v}
          unit={grant.unit}
          sub={`${stats.grants.contributedGrantCount} / ${stats.grants.securedCount} 件`}
          muted={`登録採択額 ${yenShort(stats.grants.totalRegisteredYen)}`}
          accent="text-sky-700"
        />
      </div>

      {mode === "company" && (
        <div className="grid grid-cols-2 divide-x divide-border border-t border-border text-[11px]">
          <CompanyBreakdownList rows={stats.funding.breakdown} accent="emerald" />
          <CompanyBreakdownList rows={stats.grants.breakdown} accent="sky" />
        </div>
      )}

      {mode === "ledger" && (
        <div className="grid grid-cols-1 gap-0 border-t border-border text-[11px] lg:grid-cols-2 lg:divide-x lg:divide-border">
          <LedgerList title="資金調達ラウンド" groups={stats.funding.companies} accent="emerald" />
          <LedgerList title="助成金・補助金" groups={stats.grants.companies} accent="sky" />
        </div>
      )}

      <div className="px-3 py-1.5 text-[10px] text-muted-foreground border-t border-border">
        累計値は AMD 貢献額のみ。非貢献・未判定の行は台帳には残し、累計から外す。
      </div>
    </section>
  );
}

function ModeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`min-h-7 px-2.5 ${active ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
    >
      {children}
    </button>
  );
}

function Tile({ label, v, unit, sub, muted, accent }: { label: string; v: string; unit: string; sub: string; muted: string; accent: string }) {
  return (
    <div className="px-4 py-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-0.5 flex items-baseline gap-1">
        <span className={`text-2xl font-bold tabular-nums ${accent}`}>{v}</span>
        <span className="text-sm font-medium text-muted-foreground">{unit}</span>
      </div>
      <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
        <span>{sub}</span>
        <span>{muted}</span>
      </div>
    </div>
  );
}

function CompanyBreakdownList({ rows, accent }: { rows: Row[]; accent: "emerald" | "sky" }) {
  if (rows.length === 0) return <div className="px-4 py-2 text-[10px] text-muted-foreground">データなし</div>;
  return (
    <div className="space-y-1.5 px-4 py-2">
      {rows.map((r) => (
        <div key={r.projectId} className="min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-muted-foreground">{r.name}</span>
            <span className={`tabular-nums font-medium ${accentText(accent)}`}>{yenShort(r.amountYen)}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-sm bg-muted">
            <div
              className={`h-full rounded-sm ${accentBg(accent)}`}
              style={{ width: `${barPct(r.amountYen, r.registeredYen)}%` }}
            />
          </div>
          <div className="mt-0.5 flex justify-between gap-2 text-[10px] text-muted-foreground">
            <span>{r.contributedItemCount} / {r.itemCount} 件</span>
            <span className="tabular-nums">登録 {yenShort(r.registeredYen)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function LedgerList({ title, groups, accent }: { title: string; groups: CompanyGroup[]; accent: "emerald" | "sky" }) {
  if (groups.length === 0) return <div className="px-4 py-3 text-[10px] text-muted-foreground">データなし</div>;
  return (
    <div className="min-w-0 px-4 py-3">
      <div className="mb-2 text-[11px] font-semibold text-muted-foreground">{title}</div>
      <div className="space-y-3">
        {groups.map((group) => (
          <div key={group.projectId} className="min-w-0">
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <span className="truncate font-medium">{group.companyName}</span>
              <span className={`tabular-nums font-semibold ${accentText(accent)}`}>{yenShort(group.amdContributedYen)}</span>
            </div>
            <div className="divide-y divide-border/70 overflow-hidden rounded-md border border-border/70">
              {group.items.map((item) => (
                <FundingLedgerRow key={item.id} item={item} accent={accent} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FundingLedgerRow({ item, accent }: { item: FundingItem; accent: "emerald" | "sky" }) {
  const chip = contributionChip(item.contributionStatus, accent);
  const muted = item.contributionStatus === "none" || item.contributionStatus === "unreviewed" || !item.eligibleForTotal;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 px-2.5 py-2">
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <span className={muted ? "truncate text-muted-foreground" : "truncate font-medium"}>{item.label}</span>
          {item.meta && <span className="rounded border border-border bg-muted/30 px-1 py-0 text-[9px] text-muted-foreground">{item.meta}</span>}
          {item.status && <span className="text-[10px] text-muted-foreground">{statusLabel(item)}</span>}
        </div>
        <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
          {item.date && <span className="tabular-nums">{item.date.slice(0, 10)}</span>}
          <span className="tabular-nums">全額 {yenShort(item.amountYen)}</span>
          {!item.eligibleForTotal && <span>累計対象外</span>}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span className={`rounded border px-1.5 py-0.5 text-[10px] ${chip.cls}`}>{chip.label}</span>
        <span className={`tabular-nums font-semibold ${item.amdContributedYen > 0 ? accentText(accent) : "text-muted-foreground"}`}>
          {item.amdContributedYen > 0 ? yenShort(item.amdContributedYen) : "0"}
        </span>
      </div>
    </div>
  );
}

function contributionChip(status: ContributionStatus, accent: "emerald" | "sky") {
  if (status === "full") return { label: "AMD全額", cls: accent === "emerald" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-sky-200 bg-sky-50 text-sky-800" };
  if (status === "partial") return { label: "AMD一部", cls: accent === "emerald" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-sky-200 bg-sky-50 text-sky-800" };
  if (status === "none") return { label: "非貢献", cls: "border-slate-200 bg-slate-50 text-slate-600" };
  return { label: "未判定", cls: "border-amber-200 bg-amber-50 text-amber-800" };
}

function statusLabel(item: FundingItem) {
  if (item.kind === "grant") {
    const map: Record<string, string> = { applied: "申請中", adopted: "採択", active: "受給中", completed: "完了", rejected: "不採択", withdrawn: "取下げ" };
    return map[item.status || ""] || item.status;
  }
  const map: Record<string, string> = { planned: "計画", committed: "コミット", closed: "クローズ" };
  return map[item.status || ""] || item.status;
}

function accentText(accent: "emerald" | "sky") {
  return accent === "emerald" ? "text-emerald-700" : "text-sky-700";
}

function accentBg(accent: "emerald" | "sky") {
  return accent === "emerald" ? "bg-emerald-500" : "bg-sky-500";
}

function barPct(value: number, total: number) {
  if (total <= 0 || value <= 0) return 0;
  return Math.max(4, Math.min(100, Math.round((value / total) * 100)));
}
