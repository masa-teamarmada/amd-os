"use client";

/**
 * AMD Score Retrofit ページ — α 重み調整 + 全 PJ シミュレーション。
 *
 * α (弾力性) は全 PJ のスコアに同時に効くため、調整は慎重にやるべき。
 * このページは:
 *   - 左: α 7 軸の slider (現役 α が initial 値)
 *   - 右: 全 PJ × [現行 α score / 新 α score / 差分%] の表
 *   - α を動かすたび右の数値が再計算され、retrofit (= 過去 PJ で設立タイミング判定が当たるか)
 *     をリアルタイム検証できる
 *
 * 詳細ページ (/venture-map/amd-score/[projectId]) からのみリンク。タブバーに載せない理由:
 * α 編集は経営判断レベルの重要操作で、日常 UI に出すと事故が起きる (まさ判断 2026-05-09)。
 */

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  ALPHA_DEFAULT,
  AMD_SCORE_AXES,
  AXIS_COLOR,
  calculateAmdScore,
  computeK,
  sumAlpha,
  type AlphaWeights,
  type AmdScoreAxis,
} from "@/lib/amd-score";
import { saveNewAlpha, type AmdScoreInputRow } from "@/lib/amd-score-data";
import { resolveFrl } from "@/lib/amd-score-derived";
import type { VentureRow } from "@/lib/venture-map-data";
import { Tex } from "@/components/venture-map/Tex";
import { AmdScoreFormulaPanel } from "@/components/venture-map/AmdScoreFormulaPanel";

interface Props {
  ventures: VentureRow[];
  inputs: AmdScoreInputRow[];
  initialAlpha: AlphaWeights;
}

interface PjRow {
  venture: VentureRow;
  latest: AmdScoreInputRow | null;
  currentScore: number | null;
  newScore: number | null;
}

export function AmdScoreRetrofit({ ventures, inputs, initialAlpha }: Props) {
  const [alpha, setAlpha] = useState<AlphaWeights>(initialAlpha);
  const [saving, startSaving] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

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
      let currentScore: number | null = null;
      let newScore: number | null = null;
      if (latest) {
        const baseInput = {
          mu_A: latest.mu_A ?? 0,
          mu_I: latest.mu_I ?? 0,
          mu_G: latest.mu_G ?? 0,
          TRL: latest.shallow_tech_mode ? null : latest.trl ?? 0,
          BRL: latest.brl ?? 0,
          GRL: latest.grl ?? 0,
          SRL: latest.srl ?? 0,
          HRL: latest.hrl ?? 0,
          FRL: resolveFrl(latest),
        };
        currentScore = calculateAmdScore(baseInput, initialAlpha).score;
        newScore = calculateAmdScore(baseInput, alpha).score;
      }
      return { venture: v, latest, currentScore, newScore };
    });
  }, [ventures, inputs, initialAlpha, alpha]);

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => (b.newScore ?? 0) - (a.newScore ?? 0));
  }, [rows]);

  const isModified = AMD_SCORE_AXES.some((a) => alpha[a] !== initialAlpha[a]);
  const isDefault = AMD_SCORE_AXES.every((a) => alpha[a] === ALPHA_DEFAULT[a]);
  const sumActive = sumAlpha(alpha, true);
  const newK = computeK(alpha, false);

  function onSave() {
    setFeedback(null);
    startSaving(async () => {
      const saved = await saveNewAlpha(alpha, "AMD Score Retrofit ページ調整");
      setFeedback(saved ? "新 α を保存しました。次回ロードから反映されます。" : "保存失敗 — RLS/認証を確認");
    });
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6">
      <div className="flex items-baseline gap-3 mb-4 flex-wrap">
        <Link href="/venture-map/amd-score" className="text-xs text-cyan-700 hover:underline">← AMD Score 一覧</Link>
        <h1 className="text-xl font-semibold ml-2">AMD Score Retrofit</h1>
        <span className="text-xs text-muted-foreground">
          α 重み調整 + 全 PJ シミュレーション
        </span>
      </div>

      <div className="text-[10.5px] text-slate-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mb-4 leading-relaxed">
        ⚠️ <strong>α は全 PJ のスコアに同時に効く重要パラメータ</strong>。日常 UI に出さず、ここで慎重に調整する設計
        (まさ判断 2026-05-09)。下のスライダーを動かすと右の表で全 PJ の score がリアルタイム更新されるので、
        retrofit (過去 PJ の設立タイミング判定が当たるか) を見ながら選ぶ。
      </div>

      {/* モデル説明 (詳細ページと同じ FormulaPanel を再利用) */}
      <details className="mb-4">
        <summary className="text-xs text-slate-700 hover:text-slate-900 cursor-pointer select-none px-2 py-1 inline-block">
          📐 モデル構造 (M × X × F + Triple Helix 観測モデル) を表示
        </summary>
        <div className="mt-2">
          <AmdScoreFormulaPanel alpha={alpha} />
        </div>
      </details>

      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4">
        {/* 左: α 編集 */}
        <aside className="border border-[#e5e5e7] rounded-xl p-4 bg-white h-fit lg:sticky lg:top-4">
          <div className="text-[12px] font-semibold mb-1">重み α (弾力性)</div>
          <div className="text-[10px] text-muted-foreground mb-3 flex flex-wrap items-center gap-1">
            <span>各軸 0.0-2.0 (0.05 刻み)。</span>
            <Tex tex={String.raw`\Sigma \alpha`} />
            <span>が変わると</span>
            <Tex tex={String.raw`k = 100{,}000 / 10^{\Sigma \alpha}`} />
            <span>で IPO 級に再校正。</span>
          </div>

          <div className="flex flex-col gap-3 mb-3">
            {AMD_SCORE_AXES.map((axis) => {
              const v = alpha[axis];
              const def = ALPHA_DEFAULT[axis];
              const cur = initialAlpha[axis];
              const diffFromDefault = v !== def;
              const diffFromCurrent = v !== cur;
              return (
                <div key={axis}>
                  <div className="grid grid-cols-[88px_1fr_56px] gap-2 items-center">
                    <label
                      className="text-[11px] font-semibold"
                      style={{ color: AXIS_COLOR[axis] }}
                    >
                      {axis === "sigma_SU" ? "α_σ" : `α_${axis}`}
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={2}
                      step={0.05}
                      value={v}
                      onChange={(e) => setAlpha({ ...alpha, [axis]: Number(e.target.value) })}
                    />
                    <span
                      className="font-mono text-[11px] text-right"
                      style={diffFromCurrent ? { color: "#dc2626", fontWeight: 600 } : undefined}
                    >
                      {v.toFixed(2)}
                    </span>
                  </div>
                  <div className="text-[9px] text-muted-foreground ml-[88px] mt-0.5">
                    現役: <span className="font-mono">{cur.toFixed(2)}</span>
                    {diffFromDefault && (
                      <>
                        {" · "}default:{" "}
                        <span className="font-mono">{def.toFixed(2)}</span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t border-slate-200 pt-2 text-[10px] text-muted-foreground space-y-1 mb-3">
            <div>
              Σα: <span className="font-mono">{sumActive.toFixed(2)}</span>
            </div>
            <div>
              k (新): <span className="font-mono">{newK.toFixed(4)}</span>
            </div>
            <div className="text-[9px] text-muted-foreground">
              base case: FRL=1.5 / σ_SU=1.3 / HRL=1.1 / TRL=1.0 / BRL=0.6 / GRL=0.3 / SRL=0.2
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setAlpha({ ...initialAlpha })}
              disabled={!isModified}
              className="text-[11px] px-2 py-1 rounded border border-slate-300 hover:bg-slate-50 disabled:opacity-50"
            >
              現役 α に戻す
            </button>
            <button
              type="button"
              onClick={() => setAlpha({ ...ALPHA_DEFAULT })}
              disabled={isDefault}
              className="text-[11px] px-2 py-1 rounded border border-slate-300 hover:bg-slate-50 disabled:opacity-50"
            >
              base case (default) に戻す
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={saving || !isModified}
              className="text-[11px] px-3 py-1.5 rounded bg-slate-900 text-white disabled:opacity-50"
            >
              {saving ? "保存中…" : "新しい α を保存して全 PJ に適用"}
            </button>
          </div>
        </aside>

        {/* 右: 全 PJ シミュレーション */}
        <div className="border border-[#e5e5e7] rounded-xl overflow-hidden bg-white">
          <div className="px-3 py-2 border-b border-[#e5e5e7] flex items-baseline justify-between">
            <div className="text-[12px] font-semibold">全 PJ × α シミュレーション</div>
            <div className="text-[10px] text-muted-foreground">
              新 α 順、現役 α score → 新 α score、差分%
            </div>
          </div>
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">PJ</th>
                <th className="text-left px-3 py-2">Lane</th>
                <th className="text-right px-3 py-2 font-mono">現役 α score</th>
                <th className="text-right px-3 py-2 font-mono">新 α score</th>
                <th className="text-right px-3 py-2 font-mono">差分</th>
                <th className="text-left px-3 py-2">最終評価</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-center text-muted-foreground">
                    該当 PJ なし
                  </td>
                </tr>
              )}
              {sorted.map((r) => {
                const cur = r.currentScore;
                const nev = r.newScore;
                const diffPct =
                  cur != null && nev != null && cur > 0 ? ((nev - cur) / cur) * 100 : null;
                const diffColor =
                  diffPct == null
                    ? undefined
                    : Math.abs(diffPct) < 1
                      ? "#94a3b8"
                      : diffPct > 0
                        ? "#16a34a"
                        : "#dc2626";
                return (
                  <tr key={r.venture.project_id} className="border-t border-[#f1f5f9] hover:bg-slate-50">
                    <td className="px-3 py-2">
                      <Link
                        href={`/venture-map/amd-score/${r.venture.project_id}`}
                        className="hover:underline font-medium"
                      >
                        {r.venture.display_name}
                      </Link>
                    </td>
                    <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">
                      {r.venture.lane}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {cur != null
                        ? cur < 1
                          ? cur.toFixed(2)
                          : Math.round(cur).toLocaleString()
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-semibold">
                      {nev != null
                        ? nev < 1
                          ? nev.toFixed(2)
                          : Math.round(nev).toLocaleString()
                        : "—"}
                    </td>
                    <td
                      className="px-3 py-2 text-right font-mono"
                      style={diffColor ? { color: diffColor } : undefined}
                    >
                      {diffPct == null
                        ? "—"
                        : `${diffPct > 0 ? "+" : ""}${diffPct.toFixed(1)}%`}
                    </td>
                    <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">
                      {r.latest?.evaluated_at.slice(0, 10) ?? "未登録"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {feedback && (
        <div className="fixed bottom-4 right-4 bg-slate-900 text-white text-xs px-3 py-2 rounded shadow-lg z-50">
          {feedback}
        </div>
      )}
    </div>
  );
}
