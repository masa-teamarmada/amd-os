"use client";

import { useMemo, useState } from "react";
import type { ScholarRow } from "@/app/(app)/scholar/page";

const LANES = ["gx_energy", "gx_circular", "materials", "life", "robo"] as const;
const LANE_LABEL: Record<string, string> = {
  gx_energy: "GX エネルギー",
  gx_circular: "GX サーキュラー",
  materials: "マテリアル",
  life: "ライフ",
  robo: "ロボ",
};
const LANE_COLOR: Record<string, string> = {
  gx_energy: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  gx_circular: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
  materials: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  life: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
  robo: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
};

const SOURCE_LABEL: Record<string, string> = {
  paper: "論文",
  grant: "助成",
  patent: "特許",
  award: "受賞",
};

function formatDate(d: string | null): string {
  if (!d) return "—";
  return d.slice(0, 10);
}

function formatAuthors(authors: string[] | null): string {
  if (!authors || authors.length === 0) return "—";
  if (authors.length <= 3) return authors.join(", ");
  return `${authors.slice(0, 3).join(", ")} 他 ${authors.length - 3} 名`;
}

export default function ScholarList({ rows }: { rows: ScholarRow[] }) {
  const [laneFilter, setLaneFilter] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);

  const counts = useMemo(() => {
    const byLane: Record<string, number> = {};
    for (const r of rows) {
      const lane = r.lane ?? "(unset)";
      byLane[lane] = (byLane[lane] ?? 0) + 1;
    }
    return byLane;
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (laneFilter && r.lane !== laneFilter) return false;
      if (sourceFilter && r.source_type !== sourceFilter) return false;
      return true;
    });
  }, [rows, laneFilter, sourceFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-slate-500 dark:text-slate-400">Lane:</span>
        <button
          type="button"
          onClick={() => setLaneFilter(null)}
          className={`rounded-md border px-2 py-1 transition-colors ${
            laneFilter === null
              ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
              : "border-slate-300 text-slate-600 hover:border-slate-500 dark:border-slate-700 dark:text-slate-300"
          }`}
        >
          ALL ({rows.length})
        </button>
        {LANES.map((lane) => (
          <button
            type="button"
            key={lane}
            onClick={() => setLaneFilter(lane === laneFilter ? null : lane)}
            className={`rounded-md border px-2 py-1 transition-colors ${
              laneFilter === lane
                ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                : "border-slate-300 text-slate-600 hover:border-slate-500 dark:border-slate-700 dark:text-slate-300"
            }`}
          >
            {LANE_LABEL[lane]} ({counts[lane] ?? 0})
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-slate-500 dark:text-slate-400">Source:</span>
        <button
          type="button"
          onClick={() => setSourceFilter(null)}
          className={`rounded-md border px-2 py-1 transition-colors ${
            sourceFilter === null
              ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
              : "border-slate-300 text-slate-600 hover:border-slate-500 dark:border-slate-700 dark:text-slate-300"
          }`}
        >
          ALL
        </button>
        {Object.entries(SOURCE_LABEL).map(([k, v]) => (
          <button
            type="button"
            key={k}
            onClick={() => setSourceFilter(k === sourceFilter ? null : k)}
            className={`rounded-md border px-2 py-1 transition-colors ${
              sourceFilter === k
                ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                : "border-slate-300 text-slate-600 hover:border-slate-500 dark:border-slate-700 dark:text-slate-300"
            }`}
          >
            {v}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          該当する論文・データがありません。
          {rows.length === 0 &&
            " 初回 cron 実行 (毎日 03:20 JST) を待つか、`/api/cron/scholar-ingest` を Bearer 認証で手動キックしてください。"}
        </p>
      ) : (
        <ul className="divide-y divide-slate-200 rounded-md border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
          {filtered.map((r) => (
            <li key={r.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-2 text-[10px]">
                {r.lane && (
                  <span className={`rounded px-1.5 py-0.5 font-medium ${LANE_COLOR[r.lane] ?? "bg-slate-100 text-slate-600"}`}>
                    {LANE_LABEL[r.lane] ?? r.lane}
                  </span>
                )}
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {SOURCE_LABEL[r.source_type] ?? r.source_type}
                </span>
                <span className="text-slate-500 dark:text-slate-400">{formatDate(r.published_at)}</span>
                {r.ingested_by && (
                  <span className="text-slate-400 dark:text-slate-500">via {r.ingested_by}</span>
                )}
              </div>
              <p className="mt-1.5 text-sm font-medium text-slate-900 dark:text-slate-100">
                {r.source_url ? (
                  <a
                    href={r.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:underline"
                  >
                    {r.title}
                  </a>
                ) : (
                  r.title
                )}
              </p>
              <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                {r.journal ? <span className="italic">{r.journal}</span> : null}
                {r.journal && r.authors ? <span> · </span> : null}
                {r.authors ? <span>{formatAuthors(r.authors)}</span> : null}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
