"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  fetchSeedInbox,
  verifySeed,
  dismissSeed,
  formatJpy,
  SEED_DOMAIN_LANE_LABEL,
  SEED_ORG_TYPE_LABEL,
} from "@/lib/seeds-data";
import type { SeedInboxItem } from "@/lib/seeds-data";

export default function SeedsInboxPage() {
  const pathname = usePathname();
  const seedsBase = pathname.startsWith("/hud/") ? "/hud/seeds" : "/seeds";
  const [items, setItems] = useState<SeedInboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "gx_circular" | "gx_energy" | "life" | "materials" | "robo">("all");

  const reload = async () => {
    setLoading(true);
    const list = await fetchSeedInbox();
    setItems(list);
    setLoading(false);
  };

  useEffect(() => {
    reload();
  }, []);

  const filtered = items.filter((s) => filter === "all" || s.domain_lane === filter);

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6">
      <div className="mb-4 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">Seeds 受信箱</h1>
          <p className="text-xs text-muted-foreground mt-1">
            自動収集 (毎週 月曜 09:00 JST cron) で発見した新規シーズ候補。
            Verify=シーズマスタに採用 / Dismiss=ノイズ扱いで非表示。
            cron は GAPファンド (各PF) / NEP / AMED / D-Global / CREST / 創発 等の
            直近採択を web_search で拾ってくる。
          </p>
        </div>
        <Link href={seedsBase} className="text-xs px-3 py-1.5 rounded border border-border hover:bg-accent">
          ← Seeds リスト
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        {(["all", "gx_circular", "gx_energy", "life", "materials", "robo"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`px-3 py-1.5 rounded border ${
              filter === k
                ? "bg-accent text-accent-foreground border-primary/50"
                : "border-border hover:bg-accent"
            }`}
          >
            {k === "all" ? "全領域" : SEED_DOMAIN_LANE_LABEL[k] ?? k}
            <span className="ml-1 text-muted-foreground">
              {k === "all" ? items.length : items.filter((s) => s.domain_lane === k).length}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-10 text-sm">読み込み中…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-muted-foreground py-10 text-sm">
          未確認シーズなし。次の cron は 月曜 09:00 JST。
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((s) => (
            <SeedRow key={s.id} item={s} onChange={reload} />
          ))}
        </ul>
      )}
    </div>
  );
}

function SeedRow({ item, onChange }: { item: SeedInboxItem; onChange: () => void }) {
  const [busy, setBusy] = useState(false);

  const verify = async () => {
    setBusy(true);
    const res = await verifySeed(item.id);
    setBusy(false);
    if (!res.ok) alert(res.error);
    else onChange();
  };

  const dismiss = async () => {
    setBusy(true);
    const res = await dismissSeed(item.id);
    setBusy(false);
    if (!res.ok) alert(res.error);
    else onChange();
  };

  const yearSuffix = (y: number | null) => (y == null ? "" : ` '${String(y).slice(-2)}`);

  return (
    <li className="border border-border rounded-lg p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[11px] mb-1">
            <span className="px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-700 dark:text-sky-300">🆕 新規発見</span>
            {item.domain_lane && (
              <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                {SEED_DOMAIN_LANE_LABEL[item.domain_lane] ?? item.domain_lane}
              </span>
            )}
            <span className="text-muted-foreground text-[10px]">
              {item.source === "web_search" ? "🤖 cron" : "✋ 手動"}
            </span>
            <span className="text-muted-foreground text-[10px]">
              {item.created_at?.slice(0, 10)}
            </span>
          </div>
          <Link href={`/seeds/${item.id}`} className="font-medium text-sm hover:text-primary hover:underline">
            {item.title}
          </Link>
          <div className="text-xs text-muted-foreground mt-0.5">
            {item.org_name}
            {item.org_type && ` (${SEED_ORG_TYPE_LABEL[item.org_type] ?? item.org_type})`}
            {item.researcher_name && ` / ${item.researcher_name}`}
            {item.researcher_title && ` ${item.researcher_title}`}
            {item.lab_name && ` / ${item.lab_name}`}
          </div>
          {item.summary && (
            <p className="text-xs text-muted-foreground mt-1.5 whitespace-pre-wrap">{item.summary}</p>
          )}
          {item.funding_programs.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {item.funding_programs.map((p) => (
                <span
                  key={p.program + (p.year ?? "")}
                  className="text-[10px] px-1.5 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                >
                  {p.program}
                  {p.year != null && <span className="ml-0.5 opacity-70 font-mono">{yearSuffix(p.year)}</span>}
                </span>
              ))}
            </div>
          )}
          {item.source_detail && (
            <p className="text-[10px] text-muted-foreground mt-1.5">出典: {item.source_detail}</p>
          )}
          {item.amd_rating != null && (
            <div className="mt-1 text-[11px]">
              <span className="text-amber-500">{"★".repeat(item.amd_rating)}</span>
              <span className="text-muted-foreground/40">{"☆".repeat(5 - item.amd_rating)}</span>
              {item.amd_rating_note && <span className="ml-2 text-muted-foreground">{item.amd_rating_note}</span>}
            </div>
          )}
          {item.next_action && (
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1">→ {item.next_action}</div>
          )}
        </div>
        <div className="flex flex-col gap-1.5 shrink-0">
          <button
            onClick={verify}
            disabled={busy}
            className="text-xs px-3 py-1 rounded border border-primary/40 text-primary hover:bg-primary/10 disabled:opacity-50 whitespace-nowrap"
          >
            ✓ Verify
          </button>
          <button
            onClick={dismiss}
            disabled={busy}
            className="text-xs px-3 py-1 rounded border border-border text-muted-foreground hover:bg-muted disabled:opacity-50 whitespace-nowrap"
          >
            ✕ Dismiss
          </button>
        </div>
      </div>
    </li>
  );
}

void formatJpy; // currently unused but kept for parity with vc inbox
