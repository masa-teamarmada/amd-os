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
 * cockpit のスコア詳細タブからのみリンク。タブバーに載せない理由:
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
} from "@/lib/amd-score";
import { saveNewAlpha, type AmdScoreInputRow } from "@/lib/amd-score-data";
import { derivePrsComponents, resolveFrl } from "@/lib/amd-score-derived";
import { amdScoreDetailHref } from "@/lib/amd-score-routes";
import type { VentureRow } from "@/lib/venture-map-data";
import { Tex } from "@/components/venture-map/Tex";
import { AmdScoreFormulaPanel } from "@/components/venture-map/AmdScoreFormulaPanel";
import type { PrsScoreResult } from "@/lib/amd-score";

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
  prs: PrsScoreResult | null;
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
      let prs: PrsScoreResult | null = null;
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
        prs = derivePrsComponents(latest);
      }
      return { venture: v, latest, currentScore, newScore, prs };
    });
  }, [ventures, inputs, initialAlpha, alpha]);

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => prsRowSortValue(b) - prsRowSortValue(a));
  }, [rows]);

  const isModified = AMD_SCORE_AXES.some((a) => alpha[a] !== initialAlpha[a]);
  const isDefault = AMD_SCORE_AXES.every((a) => alpha[a] === ALPHA_DEFAULT[a]);
  const sumActive = sumAlpha(alpha, true);
  const newK = computeK(alpha, false);
  const prsReadyCount = rows.filter((row) => row.prs?.status === "ready").length;
  const prsMissingCount = rows.filter((row) => row.latest && row.prs?.status === "missing").length;

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
        <h1 className="text-xl font-semibold ml-2">PRS Review / Legacy Alpha</h1>
        <span className="text-xs text-muted-foreground">
          PRS primary review queue + legacy AMD alpha simulation
        </span>
      </div>

      <div className="text-[10.5px] text-slate-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mb-4 leading-relaxed">
        ⚠️ <strong>α は legacy AMD comparison にだけ効く重要パラメータ</strong>。日常 UI に出さず、ここで慎重に調整する設計
        (まさ判断 2026-05-09)。下のスライダーを動かすと右の表で全 PJ の score がリアルタイム更新されるので、
        retrofit (過去 PJ の設立タイミング判定が当たるか) を見ながら legacy 側の重みを比較できる。
      </div>

      <div className="mb-4 border border-sky-200 bg-sky-50 px-3 py-3 text-[11px] leading-relaxed text-slate-800">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[12px] font-semibold text-slate-950">PRS primary review queue</div>
            <div className="mt-1 max-w-3xl">
              主表示は{" "}
              <span className="font-mono">score = k × P × R × S</span>{" "}
              に切り替えた。P/R_net は最新 `amd_score_inputs` 行に保存し、未入力の PJ は score を出さず review queue として残す。
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr]">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-slate-600">
            <span>ready {prsReadyCount}</span>
            <span>missing {prsMissingCount}</span>
            <span>入力は各 PJ detail で保存</span>
          </div>
          <div className="text-[10px] text-slate-600">
            missing の PJ は detail で P / R_net を保存すると queue から外れる。legacy AMD は下段で comparison としてだけ見る。
          </div>
        </div>
      </div>

      {/* モデル説明 (cockpit スコア詳細と同じ FormulaPanel を再利用) */}
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
          <div className="text-[12px] font-semibold mb-1">Legacy AMD α (比較用)</div>
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
            <div className="text-[12px] font-semibold">PRS primary queue / legacy alpha simulation</div>
            <div className="text-[10px] text-muted-foreground">
              ready は PRS 優先。legacy AMD は comparison only。
            </div>
          </div>
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">PJ</th>
                <th className="text-left px-3 py-2">Lane</th>
                <th className="text-right px-3 py-2 font-mono">PRS primary</th>
                <th className="text-left px-3 py-2">M/P/R/S</th>
                <th className="text-left px-3 py-2">入力状態</th>
                <th className="text-right px-3 py-2 font-mono">現役 α score</th>
                <th className="text-right px-3 py-2 font-mono">新 α score</th>
                <th className="text-right px-3 py-2 font-mono">差分</th>
                <th className="text-left px-3 py-2">最終評価</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-4 text-center text-muted-foreground">
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
                        href={amdScoreDetailHref(r.venture.project_id)}
                        className="hover:underline font-medium"
                      >
                        {r.venture.display_name}
                      </Link>
                    </td>
                    <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">
                      {r.venture.lane}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {r.prs?.status === "ready" && r.prs.score != null
                        ? r.prs.score < 1
                          ? r.prs.score.toFixed(2)
                          : Math.round(r.prs.score).toLocaleString()
                        : r.latest
                          ? "review pending"
                          : "—"}
                    </td>
                    <td className="px-3 py-2 text-[10px] text-muted-foreground">
                      {r.prs?.status === "ready" && r.prs.components ? (
                        <span className="font-mono">
                          {fmtPrsComponent(r.prs.components.macro)} / {fmtPrsComponent(r.prs.components.potential)} /{" "}
                          {fmtPrsComponent(r.prs.components.reach)} / {fmtPrsComponent(r.prs.components.survival)}
                        </span>
                      ) : r.prs?.status === "missing" ? (
                        <span>missing: {r.prs.missingAxes.join(", ")}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2 text-[10px] text-muted-foreground">
                      {r.prs?.status === "ready" ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">ready</span>
                      ) : r.prs?.status === "missing" ? (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-700">
                          {r.prs.missingAxes.join(" / ")} 待ち
                        </span>
                      ) : (
                        "—"
                      )}
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

function fmtPrsComponent(value: number) {
  if (!Number.isFinite(value)) return "-";
  if (value < 10) return value.toFixed(1);
  if (value < 1000) return value.toFixed(0);
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function prsRowSortValue(row: PjRow) {
  if (row.prs?.status === "ready" && row.prs.score != null) return 1_000_000 + row.prs.score;
  return row.newScore ?? -1;
}
