"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  fetchSeedList,
  fetchSeedInboxCount,
  formatJpy,
  SEED_STATUS_LABEL,
  SEED_STATUS_COLOR,
  SEED_ORG_TYPE_LABEL,
  SEED_DOMAIN_LANE_LABEL,
} from "@/lib/seeds-data";
import type { SeedListItem } from "@/types/seeds";
import { SeedDetailModal } from "@/components/seeds/SeedDetailModal";

type SortKey =
  | "title"
  | "org_name"
  | "researcher_name"
  | "domain_lane"
  | "status"
  | "amd_rating"
  | "trl"
  | "amd_owner"
  | "last_contacted_on"
  | "funding_total_jpy"
  | "updated_at";

interface Column {
  id: string;
  sortKey: SortKey;
  label: string;
  align?: "left" | "right" | "center";
  width?: string;
}

const COLUMNS: Column[] = [
  { id: "title", sortKey: "title", label: "シーズ", align: "left" },
  { id: "org_name", sortKey: "org_name", label: "機関", align: "left", width: "w-32" },
  { id: "researcher_name", sortKey: "researcher_name", label: "PI", align: "left", width: "w-28" },
  { id: "domain_lane", sortKey: "domain_lane", label: "領域", align: "left", width: "w-32" },
  { id: "trl", sortKey: "trl", label: "成熟度", align: "center", width: "w-24" },
  { id: "status", sortKey: "status", label: "状態", align: "center", width: "w-20" },
  { id: "amd_rating", sortKey: "amd_rating", label: "★", align: "center", width: "w-24" },
  { id: "amd_owner", sortKey: "amd_owner", label: "担当", align: "left", width: "w-20" },
  { id: "funding", sortKey: "funding_total_jpy", label: "資金獲得実績", align: "left" },
  { id: "next_action", sortKey: "updated_at", label: "次の一手", align: "left" },
  { id: "last_contacted_on", sortKey: "last_contacted_on", label: "最終接触", align: "left", width: "w-24" },
];

export default function SeedsListPage() {
  const [items, setItems] = useState<SeedListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey>("updated_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [filterStatus, setFilterStatus] = useState<string>("active");
  const [filterDomain, setFilterDomain] = useState<string>("all");
  const [filterOwner, setFilterOwner] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedSeedId, setSelectedSeedId] = useState<string | null>(null);
  const [createMode, setCreateMode] = useState(false);
  const [inboxCount, setInboxCount] = useState(0);

  useEffect(() => {
    setLoading(true);
    fetchSeedList()
      .then((rows) => setItems(rows))
      .finally(() => setLoading(false));
    fetchSeedInboxCount().then(setInboxCount);
  }, [reloadKey]);

  const onSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      const stringCols: SortKey[] = ["title", "org_name", "researcher_name", "domain_lane", "status", "amd_owner"];
      setSortDir(stringCols.includes(key) ? "asc" : "desc");
    }
  };

  const owners = useMemo(() => {
    const set = new Map<string, string>();
    for (const s of items) {
      if (s.amd_owner_member_id && s.amd_owner_code_name) {
        set.set(s.amd_owner_member_id, s.amd_owner_code_name);
      }
    }
    return Array.from(set.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [items]);

  const filtered = useMemo(() => {
    let list = [...items];
    if (filterStatus === "active") {
      list = list.filter((s) => s.status !== "spun_off" && s.status !== "declined");
    } else if (filterStatus !== "all") {
      list = list.filter((s) => s.status === filterStatus);
    }
    if (filterDomain !== "all") {
      list = list.filter((s) => s.domain_lane === filterDomain);
    }
    if (filterOwner !== "all") {
      list = list.filter((s) => s.amd_owner_member_id === filterOwner);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          (s.summary ?? "").toLowerCase().includes(q) ||
          s.org_name.toLowerCase().includes(q) ||
          (s.researcher_name ?? "").toLowerCase().includes(q) ||
          (s.lab_name ?? "").toLowerCase().includes(q) ||
          (s.keywords ?? []).some((k) => k.toLowerCase().includes(q))
      );
    }
    list.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      const cmp = compareBy(sortKey, a, b);
      return cmp * dir;
    });
    return list;
  }, [items, sortKey, sortDir, filterStatus, filterDomain, filterOwner, search]);

  const triggerReload = () => setReloadKey((k) => k + 1);

  return (
    <div className="mx-auto w-full max-w-[1800px] px-4 py-6">
      <div className="mb-4 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">Seeds</h1>
          <p className="text-xs text-muted-foreground mt-1">
            研究シーズリスト (大学・国研・高専のシーズ × AMD 視点の事業化適性)。
            ここから協議が始まり一部が PJ になる。状態: 候補 → 調査中 → 接触済 → 協議中 → PJ化 / 見送り。
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link
            href="/seeds/inbox"
            className="relative text-xs px-3 py-1.5 rounded border border-sky-500/40 text-sky-700 hover:bg-sky-500/10 transition-colors font-mono"
          >
            受信箱 →
            {inboxCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-4 px-0.5 bg-sky-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
                {inboxCount > 99 ? "99+" : inboxCount}
              </span>
            )}
          </Link>
          <button
            onClick={() => setCreateMode(true)}
            className="text-xs px-3 py-1.5 rounded border border-emerald-500/40 text-emerald-700 hover:bg-emerald-500/10 transition-colors font-mono"
          >
            + 新規シーズ
          </button>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        <input
          type="text"
          placeholder="シーズ / 機関 / PI / キーワードで検索"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-1.5 rounded border border-border bg-background text-xs w-72"
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-2 py-1.5 rounded border border-border bg-background"
        >
          <option value="active">アクティブ (PJ化/見送り を除外)</option>
          <option value="all">全 status</option>
          {Object.entries(SEED_STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select
          value={filterDomain}
          onChange={(e) => setFilterDomain(e.target.value)}
          className="px-2 py-1.5 rounded border border-border bg-background"
        >
          <option value="all">全 領域</option>
          {Object.entries(SEED_DOMAIN_LANE_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select
          value={filterOwner}
          onChange={(e) => setFilterOwner(e.target.value)}
          className="px-2 py-1.5 rounded border border-border bg-background"
        >
          <option value="all">全 担当</option>
          {owners.map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>
        <span className="text-muted-foreground ml-auto">{filtered.length} / {items.length}</span>
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-10 text-sm">読み込み中…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-muted-foreground py-10 text-sm">該当なし</div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground sticky top-0">
              <tr>
                {COLUMNS.map((c) => (
                  <th
                    key={c.id}
                    onClick={() => onSort(c.sortKey)}
                    className={`px-2 py-2 cursor-pointer select-none hover:bg-muted/60 ${
                      c.width ?? ""
                    } ${c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left"} ${
                      sortKey === c.sortKey ? "text-foreground" : ""
                    }`}
                  >
                    <span className="inline-flex items-center gap-1">
                      {c.align === "right" && sortKey === c.sortKey && (
                        <span className="text-[9px]">{sortDir === "desc" ? "▼" : "▲"}</span>
                      )}
                      <span>{c.label}</span>
                      {c.align !== "right" && sortKey === c.sortKey && (
                        <span className="text-[9px]">{sortDir === "desc" ? "▼" : "▲"}</span>
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <Row key={s.id} s={s} onSelect={() => setSelectedSeedId(s.id)} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(selectedSeedId || createMode) && (
        <SeedDetailModal
          seedId={selectedSeedId}
          createMode={createMode}
          onClose={() => {
            setSelectedSeedId(null);
            setCreateMode(false);
          }}
          onSaved={() => {
            triggerReload();
          }}
        />
      )}
    </div>
  );
}

function Row({ s, onSelect }: { s: SeedListItem; onSelect: () => void }) {
  const r = s.amd_rating ?? 0;
  return (
    <tr
      onClick={onSelect}
      className="border-t border-border/40 hover:bg-accent/40 cursor-pointer"
    >
      <td className="px-2 py-2">
        <div className="font-medium flex items-center gap-1.5">
          {s.discovery_status === "discovered" && (
            <span className="text-[9px] px-1 py-0.5 rounded bg-sky-500/15 text-sky-700 dark:text-sky-300 shrink-0" title="cron が新規発見、未確認">🆕</span>
          )}
          <span>{s.title}</span>
        </div>
        {s.summary && (
          <div className="text-[10px] text-muted-foreground line-clamp-1">{s.summary}</div>
        )}
      </td>
      <td className="px-2 py-2">
        <div>{s.org_name}</div>
        {s.org_type && (
          <div className="text-[10px] text-muted-foreground">{SEED_ORG_TYPE_LABEL[s.org_type] ?? s.org_type}</div>
        )}
      </td>
      <td className="px-2 py-2">
        {s.researcher_name ? (
          <>
            <div>{s.researcher_name}</div>
            {(s.lab_name || s.researcher_title) && (
              <div className="text-[10px] text-muted-foreground line-clamp-1">
                {s.lab_name ?? ""}{s.lab_name && s.researcher_title ? " / " : ""}{s.researcher_title ?? ""}
              </div>
            )}
          </>
        ) : (
          <span className="text-muted-foreground/40">—</span>
        )}
      </td>
      <td className="px-2 py-2 text-muted-foreground">
        {s.domain_lane ? SEED_DOMAIN_LANE_LABEL[s.domain_lane] ?? s.domain_lane : "—"}
      </td>
      <td className="px-2 py-2 text-center text-muted-foreground font-mono text-[10px]">
        {[s.trl, s.brl, s.hrl].some((v) => v != null) ? (
          <span title="TRL / BRL / HRL">
            {s.trl ?? "·"}/{s.brl ?? "·"}/{s.hrl ?? "·"}
          </span>
        ) : (
          <span className="text-muted-foreground/40">—</span>
        )}
      </td>
      <td className="px-2 py-2 text-center">
        <span className={`text-[10px] px-1.5 py-0.5 rounded ${SEED_STATUS_COLOR[s.status] ?? ""}`}>
          {SEED_STATUS_LABEL[s.status] ?? s.status}
        </span>
        {s.spun_off_project_name && (
          <div className="text-[9px] text-violet-600 dark:text-violet-300 mt-0.5">
            → {s.spun_off_project_name}
          </div>
        )}
      </td>
      <td className="px-2 py-2 text-center" title={s.amd_rating_note ?? (s.amd_rating ? "" : "未評価")}>
        <span className="whitespace-nowrap">
          <span className="text-amber-500">{"★".repeat(r)}</span>
          <span className="text-muted-foreground/40">{"☆".repeat(5 - r)}</span>
        </span>
      </td>
      <td className="px-2 py-2 text-muted-foreground">
        {s.amd_owner_code_name ?? <span className="text-muted-foreground/40">—</span>}
      </td>
      <td className="px-2 py-2">
        <FundingChips programs={s.funding_programs} totalJpy={s.funding_total_jpy} />
      </td>
      <td className="px-2 py-2 text-muted-foreground">
        {s.next_action ? (
          <span className="line-clamp-1">{s.next_action}</span>
        ) : (
          <span className="text-muted-foreground/40">—</span>
        )}
      </td>
      <td className="px-2 py-2 text-muted-foreground">
        {s.last_contacted_on ?? <span className="text-muted-foreground/40">—</span>}
      </td>
    </tr>
  );
}

// プログラム種別ごとの色分け (採択元の系統で識別)
function fundingChipColor(program: string): string {
  if (program.startsWith("JST D-Global")) return "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30";
  if (program.includes("GAP")) return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";
  if (program.startsWith("NEP")) return "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30";
  if (program.startsWith("AMED")) return "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30";
  if (program.startsWith("NEDO")) return "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30";
  if (program.startsWith("SBIR")) return "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30";
  if (program.startsWith("SIP")) return "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-500/30";
  if (program.includes("科研費")) return "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30";
  if (program.includes("先導研究")) return "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-500/30";
  return "bg-muted text-muted-foreground border-border";
}

function FundingChips({ programs, totalJpy }: { programs: { program: string; year: number | null }[]; totalJpy: number }) {
  if (!programs || programs.length === 0) {
    return totalJpy > 0 ? (
      <span className="text-muted-foreground text-[10px]">{formatJpy(totalJpy)}</span>
    ) : (
      <span className="text-muted-foreground/40 text-[10px]">—</span>
    );
  }
  const visible = programs.slice(0, 3);
  const more = programs.length - visible.length;
  const yearSuffix = (y: number | null) => (y == null ? "" : ` '${String(y).slice(-2)}`);
  return (
    <div className="flex flex-wrap items-center gap-0.5">
      {visible.map((p) => (
        <span
          key={p.program + (p.year ?? "")}
          className={`text-[9px] px-1 py-0.5 rounded border whitespace-nowrap ${fundingChipColor(p.program)}`}
          title={`${p.program}${p.year ? ` (令和${p.year - 2018}/${p.year}年度)` : ""}`}
        >
          {p.program}
          {p.year != null && <span className="ml-0.5 opacity-70 font-mono">{yearSuffix(p.year)}</span>}
        </span>
      ))}
      {more > 0 && (
        <span
          className="text-[9px] text-muted-foreground"
          title={programs.slice(3).map((x) => `${x.program}${yearSuffix(x.year)}`).join(", ")}
        >
          +{more}
        </span>
      )}
      {totalJpy > 0 && (
        <span className="text-[10px] text-muted-foreground ml-0.5 font-medium">
          {formatJpy(totalJpy)}
        </span>
      )}
    </div>
  );
}

function compareBy(key: SortKey, a: SeedListItem, b: SeedListItem): number {
  switch (key) {
    case "title":
      return a.title.localeCompare(b.title);
    case "org_name":
      return a.org_name.localeCompare(b.org_name);
    case "researcher_name":
      return (a.researcher_name ?? "").localeCompare(b.researcher_name ?? "");
    case "domain_lane":
      return (a.domain_lane ?? "").localeCompare(b.domain_lane ?? "");
    case "status": {
      const order = ["candidate", "investigating", "contacted", "discussing", "spun_off", "declined"];
      return order.indexOf(a.status) - order.indexOf(b.status);
    }
    case "amd_rating":
      return (a.amd_rating ?? -1) - (b.amd_rating ?? -1);
    case "trl":
      return (a.trl ?? -1) - (b.trl ?? -1);
    case "amd_owner":
      return (a.amd_owner_code_name ?? "").localeCompare(b.amd_owner_code_name ?? "");
    case "last_contacted_on":
      return (a.last_contacted_on ?? "").localeCompare(b.last_contacted_on ?? "");
    case "funding_total_jpy":
      return a.funding_total_jpy - b.funding_total_jpy;
    case "updated_at":
      return a.updated_at.localeCompare(b.updated_at);
  }
}
