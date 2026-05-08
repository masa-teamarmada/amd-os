"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  fetchVcList,
  formatJpy,
  formatJpyRange,
  VC_TYPE_LABEL,
  FUND_STATUS_LABEL,
} from "@/lib/vc-data";
import type { VcListItem } from "@/types/vc";
import { VcDetailModal } from "@/components/vc/VcDetailModal";

type SortKey =
  | "name"
  | "type"
  | "amd_rating"
  | "stage"
  | "ticket"
  | "active_fund_status"
  | "active_fund_size"
  | "active_fund_vintage"
  | "dry_powder"
  | "fund_count"
  | "amd_pj_total"
  | "pj_relation_count"
  | "last_touch_at"
  | "unverified_news";

interface Column {
  id: string;            // unique identifier (React key)
  sortKey: SortKey;      // sort by which key (multiple columns can share)
  label: string;
  align?: "left" | "right" | "center";
  width?: string;
}

const COLUMNS: Column[] = [
  { id: "name", sortKey: "name", label: "VC", align: "left" },
  { id: "type", sortKey: "type", label: "type", align: "left", width: "w-20" },
  { id: "amd_rating", sortKey: "amd_rating", label: "★", align: "center", width: "w-24" },
  { id: "stage", sortKey: "stage", label: "stage", align: "left", width: "w-32" },
  { id: "ticket", sortKey: "ticket", label: "ticket", align: "right", width: "w-24" },
  { id: "active_fund_status", sortKey: "active_fund_status", label: "active fund", align: "left", width: "w-28" },
  { id: "active_fund_size", sortKey: "active_fund_size", label: "size", align: "right", width: "w-20" },
  { id: "active_fund_vintage", sortKey: "active_fund_vintage", label: "vintage", align: "right", width: "w-16" },
  { id: "dry_powder", sortKey: "dry_powder", label: "DPE残", align: "right", width: "w-24" },
  { id: "fund_count", sortKey: "fund_count", label: "fund#", align: "right", width: "w-12" },
  { id: "amd_pj_tabs", sortKey: "amd_pj_total", label: "AMD PJ 出資", align: "left" },
  { id: "amd_pj_total", sortKey: "amd_pj_total", label: "AMD PJ 計", align: "right", width: "w-24" },
  { id: "pj_relation_count", sortKey: "pj_relation_count", label: "接点", align: "right", width: "w-12" },
  { id: "last_touch_at", sortKey: "last_touch_at", label: "最終接触", align: "left", width: "w-24" },
  { id: "unverified_news", sortKey: "unverified_news", label: "未確認", align: "right", width: "w-12" },
];

export default function VcListPage() {
  const [items, setItems] = useState<VcListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("amd_pj_total");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedVcId, setSelectedVcId] = useState<string | null>(null);

  useEffect(() => {
    fetchVcList()
      .then((rows) => setItems(rows))
      .finally(() => setLoading(false));
  }, []);

  const onSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      // 数値・日付系はデフォルト降順、文字列系は昇順
      const stringCols: SortKey[] = ["name", "type", "stage", "active_fund_status"];
      setSortDir(stringCols.includes(key) ? "asc" : "desc");
    }
  };

  const filtered = useMemo(() => {
    let list = [...items];
    if (filterType !== "all") list = list.filter((v) => v.type === filterType);
    if (filterStatus === "raising") {
      list = list.filter((v) => v.active_fund?.status === "raising");
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (v) =>
          v.name.toLowerCase().includes(q) ||
          (v.name_en ?? "").toLowerCase().includes(q) ||
          (v.thesis ?? "").toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      const cmp = compareBy(sortKey, a, b);
      return cmp * dir;
    });
    return list;
  }, [items, sortKey, sortDir, filterType, filterStatus, search]);

  return (
    <div className="mx-auto w-full max-w-[1800px] px-4 py-6">
      <div className="mb-4 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">VC List</h1>
          <p className="text-xs text-muted-foreground mt-1">
            国内ディープテック VC の特性 / ファンド / 自社 PJ 接点 / 出資先 / ニュースを統合。
            自動収集 (毎朝 09:00 JST) + つくよみ + 手入力。行クリックで詳細。
          </p>
        </div>
        <Link
          href="/vcs/inbox"
          className="text-xs px-3 py-1.5 rounded border border-emerald-500/40 text-emerald-700 hover:bg-emerald-500/10 transition-colors font-mono"
        >
          ニュース受信箱 →
        </Link>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        <input
          type="text"
          placeholder="名前 / テーゼ で検索"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-1.5 rounded border border-border bg-background text-xs w-56"
        />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-2 py-1.5 rounded border border-border bg-background"
        >
          <option value="all">全 type</option>
          {Object.entries(VC_TYPE_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-2 py-1.5 rounded border border-border bg-background"
        >
          <option value="all">全 status</option>
          <option value="raising">募集中のみ</option>
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
                    <span className="flex items-center gap-1 inline-flex">
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
              {filtered.map((v) => (
                <Row key={v.id} v={v} onSelect={() => setSelectedVcId(v.id)} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <VcDetailModal vcId={selectedVcId} onClose={() => setSelectedVcId(null)} />
    </div>
  );
}

function Row({ v, onSelect }: { v: VcListItem; onSelect: () => void }) {
  const r = v.amd_rating ?? 0;
  const af = v.active_fund;
  return (
    <tr
      onClick={onSelect}
      className="border-t border-border/40 hover:bg-accent/40 cursor-pointer"
    >
      <td className="px-2 py-2">
        <div className="font-medium">{v.name}</div>
        {v.name_en && <div className="text-[10px] text-muted-foreground">{v.name_en}</div>}
      </td>
      <td className="px-2 py-2 text-muted-foreground">
        {v.type ? VC_TYPE_LABEL[v.type] ?? v.type : "—"}
      </td>
      <td className="px-2 py-2 text-center" title={v.amd_rating_note ?? (v.amd_rating ? "" : "未評価")}>
        <span className="whitespace-nowrap">
          <span className="text-amber-500">{"★".repeat(r)}</span>
          <span className="text-muted-foreground/40">{"☆".repeat(5 - r)}</span>
        </span>
      </td>
      <td className="px-2 py-2 text-muted-foreground">
        {(v.stage_focus ?? []).slice(0, 3).join(" / ") || "—"}
      </td>
      <td className="px-2 py-2 text-right text-muted-foreground">
        {formatJpyRange(v.ticket_min_jpy, v.ticket_max_jpy)}
      </td>
      <td className="px-2 py-2">
        {af ? (
          <span className="inline-flex items-center gap-1">
            <span className="font-medium">#{af.fund_no}</span>
            <span
              className={`text-[9px] px-1 py-0.5 rounded ${
                af.status === "raising"
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                  : af.status === "investing" || af.status === "first_closed" || af.status === "final_closed"
                  ? "bg-blue-500/15 text-blue-700 dark:text-blue-300"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {FUND_STATUS_LABEL[af.status] ?? af.status}
            </span>
          </span>
        ) : (
          <span className="text-muted-foreground/40">—</span>
        )}
      </td>
      <td className="px-2 py-2 text-right">
        {af
          ? af.size_jpy
            ? formatJpy(af.size_jpy)
            : formatJpyRange(af.size_jpy_low, af.size_jpy_high)
          : <span className="text-muted-foreground/40">—</span>}
      </td>
      <td className="px-2 py-2 text-right text-muted-foreground">
        {af?.vintage_year ?? "—"}
      </td>
      <td className="px-2 py-2 text-right">
        {v.total_dry_powder_low != null || v.total_dry_powder_high != null ? (
          <span className="font-medium">
            {formatJpyRange(v.total_dry_powder_low, v.total_dry_powder_high)}
          </span>
        ) : (
          <span className="text-muted-foreground/40">—</span>
        )}
      </td>
      <td className="px-2 py-2 text-right text-muted-foreground">{v.fund_count}</td>
      <td className="px-2 py-2">
        {v.amd_pj_investments.length === 0 ? (
          <span className="text-muted-foreground/40">—</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {v.amd_pj_investments.map((p) => (
              <span
                key={p.project_id}
                className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/30"
              >
                <span className="font-medium">{p.project_name}</span>
                {p.amount_jpy != null && (
                  <span className="text-primary/70">{formatJpy(p.amount_jpy)}</span>
                )}
              </span>
            ))}
          </div>
        )}
      </td>
      <td className="px-2 py-2 text-right">
        {v.amd_pj_total_amount_jpy > 0 ? (
          <span className="font-medium">{formatJpy(v.amd_pj_total_amount_jpy)}</span>
        ) : (
          <span className="text-muted-foreground/40">—</span>
        )}
      </td>
      <td className="px-2 py-2 text-right">
        {v.pj_relation_count > 0 ? (
          <span className="font-medium">{v.pj_relation_count}</span>
        ) : (
          <span className="text-muted-foreground/40">0</span>
        )}
      </td>
      <td className="px-2 py-2 text-muted-foreground">{v.last_touch_at ?? "—"}</td>
      <td className="px-2 py-2 text-right">
        {v.unverified_news_count > 0 ? (
          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
            ●{v.unverified_news_count}
          </span>
        ) : (
          <span className="text-muted-foreground/40">—</span>
        )}
      </td>
    </tr>
  );
}

function compareBy(key: SortKey, a: VcListItem, b: VcListItem): number {
  switch (key) {
    case "name":
      return a.name.localeCompare(b.name);
    case "type":
      return (a.type ?? "").localeCompare(b.type ?? "");
    case "amd_rating":
      return (a.amd_rating ?? -1) - (b.amd_rating ?? -1);
    case "stage": {
      const av = (a.stage_focus ?? []).join(" / ");
      const bv = (b.stage_focus ?? []).join(" / ");
      return av.localeCompare(bv);
    }
    case "ticket":
      return (a.ticket_max_jpy ?? a.ticket_min_jpy ?? -1) - (b.ticket_max_jpy ?? b.ticket_min_jpy ?? -1);
    case "active_fund_status":
      return (a.active_fund?.status ?? "").localeCompare(b.active_fund?.status ?? "");
    case "active_fund_size":
      return (a.active_fund?.size_jpy ?? a.active_fund?.size_jpy_high ?? -1) -
        (b.active_fund?.size_jpy ?? b.active_fund?.size_jpy_high ?? -1);
    case "active_fund_vintage":
      return (a.active_fund?.vintage_year ?? -1) - (b.active_fund?.vintage_year ?? -1);
    case "dry_powder":
      return (a.total_dry_powder_high ?? a.total_dry_powder_low ?? -1) -
        (b.total_dry_powder_high ?? b.total_dry_powder_low ?? -1);
    case "fund_count":
      return a.fund_count - b.fund_count;
    case "amd_pj_total":
      return a.amd_pj_total_amount_jpy - b.amd_pj_total_amount_jpy;
    case "pj_relation_count":
      return a.pj_relation_count - b.pj_relation_count;
    case "last_touch_at":
      return (a.last_touch_at ?? "").localeCompare(b.last_touch_at ?? "");
    case "unverified_news":
      return a.unverified_news_count - b.unverified_news_count;
  }
}
