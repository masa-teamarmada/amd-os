"use client";

/**
 * AMD Score 一覧 — 全 SU PJ の最新評価点を score 降順で並べる。
 *
 * 仕様: pwa/design_log/2026-05_amd_score.md
 *   - 並べ替え: score 降順 (default) / phase 別 / lane 別
 *   - 行クリック → /venture-map/amd-score/[projectId]
 *   - α 重みは下に独立カードで現役のみ表示 (編集は個別 PJ ビューで)
 */

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AMD_SCORE_AXES,
  AXIS_LABEL_JP,
  calculateAmdScore,
  type AlphaWeights,
} from "@/lib/amd-score";
// PHASE_COLOR / PHASE_LABEL_JP / AmdScorePhase は使用しない (検証データ蓄積後に復活検討、2026-05-09)
import type { AmdScoreInputRow } from "@/lib/amd-score-data";
import type { VentureRow } from "@/lib/venture-map-data";

interface PjRow {
  venture: VentureRow;
  latest: AmdScoreInputRow | null;
  result: ReturnType<typeof calculateAmdScore> | null;
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
      const result = latest
        ? calculateAmdScore(
            {
              mu_A: latest.mu_A ?? 0,
              mu_I: latest.mu_I ?? 0,
              mu_G: latest.mu_G ?? 0,
              TRL: latest.shallow_tech_mode ? null : latest.trl ?? 0,
              BRL: latest.brl ?? 0,
              GRL: latest.grl ?? 0,
              SRL: latest.srl ?? 0,
              HRL: latest.hrl ?? 0,
              FRL: latest.frl ?? 0,
            },
            alpha
          )
        : null;
      return { venture: v, latest, result };
    });
  }, [ventures, inputs, alpha]);

  const filtered = useMemo(() => {
    const list = [...rows];
    if (sortBy === "score_desc") {
      list.sort((a, b) => (b.result?.score ?? 0) - (a.result?.score ?? 0));
    } else if (sortBy === "score_asc") {
      list.sort((a, b) => (a.result?.score ?? 0) - (b.result?.score ?? 0));
    } else {
      list.sort((a, b) => a.venture.display_name.localeCompare(b.venture.display_name));
    }
    return list;
  }, [rows, sortBy]);

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6">
      <div className="flex items-baseline justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">AMD Score</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Before Zero Theory v3.2 — 7 軸 Cobb-Douglas 統合指標。Σα = 6.0 で全軸 9 が IPO 級 100,000。
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
              <th className="text-right px-3 py-2 font-mono">Score</th>
              <th className="text-left px-3 py-2">律速軸</th>
              <th className="text-left px-3 py-2">最終評価</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-muted-foreground">
                  該当 PJ なし
                </td>
              </tr>
            )}
            {filtered.map((r) => (
              <tr key={r.venture.project_id} className="border-t border-[#f1f5f9] hover:bg-slate-50">
                <td className="px-3 py-2">
                  <Link
                    href={`/venture-map/amd-score/${r.venture.project_id}`}
                    className="hover:underline font-medium"
                  >
                    {r.venture.display_name}
                  </Link>
                </td>
                <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">{r.venture.lane}</td>
                <td className="px-3 py-2 text-right font-mono font-semibold">
                  {r.result
                    ? r.result.score < 1
                      ? r.result.score.toFixed(2)
                      : Math.round(r.result.score).toLocaleString()
                    : "—"}
                </td>
                <td className="px-3 py-2 text-[10px]">
                  {r.result ? AXIS_LABEL_JP[r.result.bottleneck] : "—"}
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
        各 PJ をクリックして 7 軸を編集。α 重みも個別ビューで調整可。
      </div>
    </div>
  );
}

function AlphaCard({ alpha }: { alpha: AlphaWeights }) {
  return (
    <div className="border border-[#e5e5e7] rounded-xl p-3 bg-white">
      <div className="text-[10px] text-muted-foreground mb-1">現役 α (弾力性)</div>
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
