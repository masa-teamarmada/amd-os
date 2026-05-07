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

type SortKey =
  | "pj_relation_count"
  | "last_touch_at"
  | "dry_powder"
  | "amd_rating"
  | "vintage_year"
  | "name";

const SORT_LABEL: Record<SortKey, string> = {
  pj_relation_count: "接点数",
  last_touch_at: "最終接触",
  dry_powder: "DPE残",
  amd_rating: "★相性",
  vintage_year: "Fund vintage",
  name: "名前",
};

export default function VcListPage() {
  const [items, setItems] = useState<VcListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("pj_relation_count");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchVcList()
      .then((rows) => setItems(rows))
      .finally(() => setLoading(false));
  }, []);

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
      switch (sortKey) {
        case "pj_relation_count":
          return (b.pj_relation_count ?? 0) - (a.pj_relation_count ?? 0);
        case "last_touch_at":
          return (b.last_touch_at ?? "").localeCompare(a.last_touch_at ?? "");
        case "dry_powder": {
          const av = a.total_dry_powder_high ?? a.total_dry_powder_low ?? -1;
          const bv = b.total_dry_powder_high ?? b.total_dry_powder_low ?? -1;
          return bv - av;
        }
        case "amd_rating":
          return (b.amd_rating ?? -1) - (a.amd_rating ?? -1);
        case "vintage_year":
          return (b.active_fund?.vintage_year ?? -1) - (a.active_fund?.vintage_year ?? -1);
        case "name":
          return a.name.localeCompare(b.name);
      }
    });
    return list;
  }, [items, sortKey, filterType, filterStatus, search]);

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6">
      <div className="mb-4 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">VC List</h1>
          <p className="text-xs text-muted-foreground mt-1">
            国内ディープテック VC の特性・ファンド状況・自社 PJ 接点・出資先・直近ニュースを統合。
            自動収集 (毎朝 09:00 JST) + つくよみ + 手入力。
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/vcs/inbox"
            className="text-xs px-3 py-1.5 rounded border border-emerald-500/40 text-emerald-700 hover:bg-emerald-500/10 transition-colors font-mono"
          >
            ニュース受信箱 →
          </Link>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
        <input
          type="text"
          placeholder="名前 / テーゼ で検索"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-1.5 rounded border border-border bg-background text-xs w-56"
        />
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="px-2 py-1.5 rounded border border-border bg-background"
        >
          {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
            <option key={k} value={k}>
              並び: {SORT_LABEL[k]}
            </option>
          ))}
        </select>
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
        <div className="text-center text-muted-foreground py-10 text-sm">
          該当する VC がありません。<br />
          <Link href="/vcs/new" className="underline text-primary">手動で追加</Link>
          {" / "}
          <span className="text-xs">あるいは admin から `/api/admin/seed-vcs` を実行</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((v) => (
            <VcCard key={v.id} v={v} />
          ))}
        </div>
      )}
    </div>
  );
}

function VcCard({ v }: { v: VcListItem }) {
  const stars = v.amd_rating ? "★".repeat(v.amd_rating) + "☆".repeat(5 - v.amd_rating) : "☆☆☆☆☆";
  return (
    <Link
      href={`/vcs/${v.id}`}
      className="block border border-border rounded-lg p-3 hover:border-primary/60 hover:bg-accent/30 transition-colors"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <div className="font-medium text-sm truncate">{v.name}</div>
          {v.name_en && <div className="text-[10px] text-muted-foreground truncate">{v.name_en}</div>}
        </div>
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${
            v.amd_rating ? "text-amber-500" : "text-muted-foreground"
          }`}
          title={v.amd_rating_note ?? "未評価"}
        >
          {stars}
        </span>
      </div>

      <div className="flex flex-wrap gap-1 mb-2">
        {v.type && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
            {VC_TYPE_LABEL[v.type] ?? v.type}
          </span>
        )}
        {(v.stage_focus ?? []).slice(0, 3).map((s) => (
          <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
            {s}
          </span>
        ))}
      </div>

      {v.thesis && (
        <p className="text-[11px] text-muted-foreground line-clamp-2 mb-2">{v.thesis}</p>
      )}

      <div className="border-t border-border/50 pt-2 mt-2 space-y-1 text-[11px]">
        {v.active_fund ? (
          <div>
            <span className="text-muted-foreground">現 active fund:</span>{" "}
            <span className="font-medium">
              #{v.active_fund.fund_no}{" "}
              {v.active_fund.size_jpy
                ? formatJpy(v.active_fund.size_jpy)
                : formatJpyRange(v.active_fund.size_jpy_low, v.active_fund.size_jpy_high)}
            </span>{" "}
            <span className="text-muted-foreground">
              ({FUND_STATUS_LABEL[v.active_fund.status] ?? v.active_fund.status}
              {v.active_fund.vintage_year ? ` / ${v.active_fund.vintage_year}` : ""})
            </span>
          </div>
        ) : (
          <div className="text-muted-foreground">active fund 情報なし</div>
        )}
        {(v.total_dry_powder_low != null || v.total_dry_powder_high != null) && (
          <div>
            <span className="text-muted-foreground">DPE残:</span>{" "}
            <span className="font-medium">
              {formatJpyRange(v.total_dry_powder_low, v.total_dry_powder_high)}
            </span>
          </div>
        )}
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-muted-foreground">
          <span>接点 {v.pj_relation_count}</span>
          <span>fund {v.fund_count}</span>
          {v.last_touch_at && <span>最終 {v.last_touch_at}</span>}
          {v.unverified_news_count > 0 && (
            <span className="text-emerald-600 dark:text-emerald-400">●未確認 {v.unverified_news_count}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
