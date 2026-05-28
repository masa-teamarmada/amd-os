"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  fetchVcInbox,
  verifyVcNews,
  dismissVcNews,
  upsertVcFund,
  VC_NEWS_KIND_LABEL,
} from "@/lib/vc-data";
import type { VcNews, VcFund } from "@/types/vc";

type InboxItem = VcNews & { vc_name: string };

export default function VcInboxPage() {
  const pathname = usePathname();
  const vcsBase = pathname.startsWith("/hud/") ? "/hud/vcs" : "/vcs";
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "fundraise" | "fund_close" | "investment">("all");

  const reload = async () => {
    setLoading(true);
    const list = await fetchVcInbox();
    setItems(list);
    setLoading(false);
  };

  useEffect(() => {
    reload();
  }, []);

  const filtered = items.filter((n) => filter === "all" || n.kind === filter);

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6">
      <div className="mb-4 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">VC ニュース受信箱</h1>
          <p className="text-xs text-muted-foreground mt-1">
            自動収集 route・つくよみ会話・手動入力で蓄積された未確認ニュース。現在、自動 schedule は停止中。
            Verify=採用 / Dismiss=ノイズ扱いで消す。fundraise/fund_close は
            VC のファンド情報に 1 クリックで反映できる。
          </p>
        </div>
        <Link href={vcsBase} className="text-xs px-3 py-1.5 rounded border border-border hover:bg-accent">
          ← VC リスト
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        {(["all", "fundraise", "fund_close", "investment"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`px-3 py-1.5 rounded border ${
              filter === k
                ? "bg-accent text-accent-foreground border-primary/50"
                : "border-border hover:bg-accent"
            }`}
          >
            {k === "all" ? "全" : VC_NEWS_KIND_LABEL[k]}
            <span className="ml-1 text-muted-foreground">
              {k === "all" ? items.length : items.filter((n) => n.kind === k).length}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-10 text-sm">読み込み中…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-muted-foreground py-10 text-sm">
          未確認ニュースなし。自動 schedule は停止中。
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((n) => (
            <NewsRow key={n.id} item={n} onChange={reload} />
          ))}
        </ul>
      )}
    </div>
  );
}

function NewsRow({ item, onChange }: { item: InboxItem; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const patch = item.suggested_fund_patch as
    | { fund_no?: number; status?: string; size_jpy?: number; size_jpy_low?: number; size_jpy_high?: number; target_close_at?: string; final_close_at?: string; first_close_at?: string; vintage_year?: number; source_url?: string }
    | null;

  const verify = async () => {
    setBusy(true);
    const res = await verifyVcNews(item.id);
    setBusy(false);
    if (!res.ok) alert(res.error);
    else onChange();
  };

  const dismiss = async () => {
    setBusy(true);
    const res = await dismissVcNews(item.id);
    setBusy(false);
    if (!res.ok) alert(res.error);
    else onChange();
  };

  const applyFundPatch = async () => {
    if (!patch || typeof patch.fund_no !== "number") return;
    setBusy(true);
    const res = await upsertVcFund({
      vc_id: item.vc_id,
      fund_no: patch.fund_no,
      status: (patch.status as VcFund["status"]) ?? "unknown",
      size_jpy: patch.size_jpy ?? null,
      size_jpy_low: patch.size_jpy_low ?? null,
      size_jpy_high: patch.size_jpy_high ?? null,
      target_close_at: patch.target_close_at ?? null,
      final_close_at: patch.final_close_at ?? null,
      first_close_at: patch.first_close_at ?? null,
      vintage_year: patch.vintage_year ?? null,
      source_url: patch.source_url ?? item.source_url ?? null,
    });
    if (res.ok) {
      // 反映できたら同時に verify する
      await verifyVcNews(item.id);
    }
    setBusy(false);
    if (!res.ok) alert(res.error);
    else onChange();
  };

  return (
    <li className="border border-border rounded-lg p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[11px] mb-1">
            <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              {VC_NEWS_KIND_LABEL[item.kind] ?? item.kind}
            </span>
            <Link href={`/vcs/${item.vc_id}`} className="text-primary hover:underline font-medium">
              {item.vc_name}
            </Link>
            {item.occurred_on && <span className="text-muted-foreground">{item.occurred_on}</span>}
            <span className="text-muted-foreground text-[10px]">
              {item.ingested_by === "discover_cron" || item.ingested_by === "web_search_cron"
                ? "🤖 cron"
                : item.ingested_by === "tsukuyomi"
                ? "🌙 つくよみ"
                : "✋ 手動"}
            </span>
          </div>
          <div className="font-medium text-sm">{item.title}</div>
          {item.body && (
            <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{item.body}</p>
          )}
          {item.source_url && (
            <a
              href={item.source_url}
              target="_blank"
              rel="noreferrer"
              className="block mt-1 text-[10px] underline text-muted-foreground truncate hover:text-primary"
            >
              {item.source_url}
            </a>
          )}
          {patch && typeof patch.fund_no === "number" && (
            <div className="mt-2 p-2 rounded bg-emerald-500/10 border border-emerald-500/30 text-[11px]">
              <div className="font-medium text-emerald-700 dark:text-emerald-300 mb-1">
                提案: #{patch.fund_no} ファンドを更新
              </div>
              <div className="text-muted-foreground space-y-0.5">
                {patch.status && <div>status → <span className="font-mono">{patch.status}</span></div>}
                {patch.size_jpy && <div>size → {patch.size_jpy.toLocaleString()} 円</div>}
                {(patch.size_jpy_low || patch.size_jpy_high) && (
                  <div>size レンジ → {patch.size_jpy_low?.toLocaleString() ?? "?"}〜{patch.size_jpy_high?.toLocaleString() ?? "?"} 円</div>
                )}
                {patch.target_close_at && <div>target close → {patch.target_close_at}</div>}
                {patch.final_close_at && <div>final close → {patch.final_close_at}</div>}
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1.5 shrink-0">
          {patch && typeof patch.fund_no === "number" && (
            <button
              onClick={applyFundPatch}
              disabled={busy}
              className="text-xs px-3 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 whitespace-nowrap"
            >
              ファンド反映
            </button>
          )}
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
