"use client";

/**
 * AMD Score 一覧 — 全 SU PJ の最新評価点を score 降順で並べる。
 *
 * 仕様: pwa/design_log/2026-05_amd_score.md
 *   - 並べ替え: score 降順 (default) / phase 別 / lane 別
 *   - 行クリック → PJ cockpit のスコア詳細タブ
 *   - α 重みは下に独立カードで現役のみ表示 (編集は個別 PJ ビューで)
 */

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AMD_SCORE_AXES,
  type AlphaWeights,
} from "@/lib/amd-score";
import type { AmdScoreInputRow } from "@/lib/amd-score-data";
import { buildPrimaryScoreSnapshot } from "@/lib/amd-score-derived";
import { amdScoreDetailHref } from "@/lib/amd-score-routes";
import type { VentureRow } from "@/lib/venture-map-data";
import { LaneBadges } from "@/components/lanes/LaneBadges";

interface PjRow {
  venture: VentureRow;
  latest: AmdScoreInputRow | null;
  primary: ReturnType<typeof buildPrimaryScoreSnapshot> | null;
}

interface Props {
  ventures: VentureRow[];
  inputs: AmdScoreInputRow[];
  alpha: AlphaWeights;
}

// フェーズフィルタは検証データ蓄積後に復活検討のため非表示 (2026-05-09)。

export function AmdScoreList({ ventures, inputs, alpha }: Props) {
  const [sortBy, setSortBy] = useState<"score_desc" | "score_asc" | "name">("score_desc");

  const rows: PjRow[] = useMemo(() => {
    const byPj = new Map<string, AmdScoreInputRow[]>();
    for (const r of inputs) {
      const list = byPj.get(r.project_id) ?? [];
      list.push(r);
      byPj.set(r.project_id, list);
    }
    return ventures.map((v) => {
      const list = byPj.get(v.project_id) ?? [];
      const latest = list[list.length - 1] ?? null;
      const primary = latest ? buildPrimaryScoreSnapshot(latest, alpha) : null;
      return { venture: v, latest, primary };
    });
  }, [ventures, inputs, alpha]);

  const filtered = useMemo(() => {
    const list = [...rows];
    if (sortBy === "score_desc") {
      list.sort((a, b) => scoreSortValue(b) - scoreSortValue(a));
    } else if (sortBy === "score_asc") {
      list.sort((a, b) => scoreSortValue(a) - scoreSortValue(b));
    } else {
      list.sort((a, b) => a.venture.display_name.localeCompare(b.venture.display_name));
    }
    return list;
  }, [rows, sortBy]);

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6">
      <div className="flex items-baseline justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">SPS Primary / Legacy AMD</h1>
          <p className="text-xs text-muted-foreground mt-1">
            主表示は `P × R × S`。M × X × F / 7軸 AMD Score は比較用として残し、P/R_net 未入力は明示的に review 待ちで止める。
          </p>
        </div>
        <Link href="/venture-map" className="text-xs text-cyan-600 hover:underline">← Venture Map</Link>
      </div>

      <AlphaCard alpha={alpha} />

      <div className="flex items-center gap-3 my-3 text-xs">
        <label className="text-muted-foreground">並び:</label>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="border border-slate-300 rounded px-2 py-1"
        >
          <option value="score_desc">Score 降順</option>
          <option value="score_asc">Score 昇順</option>
          <option value="name">PJ 名</option>
        </select>
        <span className="ml-auto text-[10px] text-muted-foreground">{filtered.length} / {rows.length} 件</span>
      </div>

      <div className="border border-[#e5e5e7] rounded-xl overflow-hidden bg-white">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2">PJ</th>
              <th className="text-left px-3 py-2">Lane</th>
              <th className="text-right px-3 py-2 font-mono">SPS primary</th>
              <th className="text-left px-3 py-2">状態</th>
              <th className="text-right px-3 py-2 font-mono">Legacy AMD</th>
              <th className="text-left px-3 py-2">最終評価</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-muted-foreground">
                  該当 PJ なし
                </td>
              </tr>
            )}
            {filtered.map((r) => (
              <tr key={r.venture.project_id} className="border-t border-[#f1f5f9] hover:bg-slate-50">
                <td className="px-3 py-2">
                  <Link
                    href={amdScoreDetailHref(r.venture.project_id)}
                    className="hover:underline font-medium"
                  >
                    {r.venture.display_name}
                  </Link>
                </td>
                <td className="px-3 py-2"><LaneBadges lanes={r.venture.lanes} fallback={r.venture.lane} /></td>
                <td className="px-3 py-2 text-right font-mono font-semibold">
                  {r.primary?.prs.status === "ready" && r.primary.prs.score != null
                    ? r.primary.prs.score < 1
                      ? r.primary.prs.score.toFixed(2)
                      : Math.round(r.primary.prs.score).toLocaleString()
                    : "—"}
                </td>
                <td className="px-3 py-2 text-[10px]">
                  {r.primary?.prs.status === "ready" ? (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">ready</span>
                  ) : r.primary?.prs.status === "missing" ? (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-700">
                      {r.primary.prs.missingAxes.join(" / ")} 入力待ち
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-2 text-right font-mono text-[11px] text-slate-500">
                  {r.primary
                    ? r.primary.legacy.score < 1
                      ? r.primary.legacy.score.toFixed(2)
                      : Math.round(r.primary.legacy.score).toLocaleString()
                    : "—"}
                </td>
                <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">
                  {r.latest?.evaluated_at.slice(0, 10) ?? "未登録"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 text-[10px] text-muted-foreground">
        各 PJ をクリックして SPS primary の P/R_net を確認・入力。α 重みと M/X/F は legacy AMD comparison として個別ビューに残す。
      </div>
    </div>
  );
}

function AlphaCard({ alpha }: { alpha: AlphaWeights }) {
  return (
    <div className="border border-[#e5e5e7] rounded-xl p-3 bg-white">
      <div className="text-[10px] text-muted-foreground mb-1">Legacy AMD α (比較用)</div>
      <div className="flex flex-wrap gap-3 text-[11px]">
        {AMD_SCORE_AXES.map((axis) => (
          <div key={axis} className="flex items-baseline gap-1">
            <span className="text-muted-foreground">{axis === "sigma_SU" ? "σ_SU" : axis}</span>
            <span className="font-mono font-semibold">{alpha[axis].toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function scoreSortValue(row: PjRow) {
  if (row.primary?.prs.status === "ready" && row.primary.prs.score != null) {
    return 1_000_000 + row.primary.prs.score;
  }
  return row.primary?.legacy.score ?? -1;
}
