"use client";

/**
 * /institutions — 研究機関 横断ヒートマップ比較 (ERS)
 * 設計正本: pwa/design/institution_readiness.md
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { fetchErsBundle, type ErsBundle } from "@/lib/ers-data";
import { computeErs, ersScoreColor, INSTITUTION_TYPE_LABEL } from "@/lib/ers";

export default function InstitutionsPage() {
  const [bundle, setBundle] = useState<ErsBundle | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchErsBundle()
      .then((b) => setBundle(b))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const sortedAxes = useMemo(
    () => (bundle ? [...bundle.axes].sort((a, b) => a.sortOrder - b.sortOrder) : []),
    [bundle],
  );
  const results = useMemo(
    () =>
      bundle
        ? bundle.institutions.map((inst) => ({
            inst,
            result: computeErs(bundle.axes, bundle.criteria, bundle.assessmentsByInstitution[inst.institutionId] ?? []),
          }))
        : [],
    [bundle],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!bundle || bundle.institutions.length === 0) {
    return <div className="p-6 text-sm text-muted-foreground">登録された研究機関がありません。</div>;
  }

  return (
    <div className="p-4 max-w-[1400px] mx-auto space-y-4">
      <header className="space-y-1">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-xl font-bold">研究機関 — ERS / エコシステム整備度</h1>
          <Link
            href="/institutions/assess"
            className="shrink-0 text-xs rounded-md border border-primary/40 bg-primary/5 text-primary px-3 py-1.5 font-medium hover:bg-primary/10"
          >
            📝 評価を入力 / 編集
          </Link>
        </div>
        <p className="text-xs text-muted-foreground">
          各機関が「ベンチャーを生み育てる装置」としてどれだけ整備されているかを 8 軸 × サブ軸 (Lv1–5) の充足率で表す。
          <span className="font-medium text-foreground">AMD Score（個体レイヤー）とは別ロジック</span>の苗床レイヤー指標。各セルは軸スコア（0–100%）。
        </p>
      </header>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-muted/40">
              <th className="text-left px-3 py-2 font-medium sticky left-0 bg-muted/40">機関</th>
              <th className="px-2 py-2 font-medium">ERS</th>
              {sortedAxes.map((a) => (
                <th key={a.axisId} className="px-2 py-2 font-mono font-medium" title={`${a.axisNo}. ${a.name}`}>
                  {a.axisNo}
                </th>
              ))}
              <th className="px-2 py-2 font-medium">評価済</th>
            </tr>
          </thead>
          <tbody>
            {results.map(({ inst, result }) => (
              <tr key={inst.institutionId} className="border-t border-border hover:bg-muted/20">
                <td className="px-3 py-2 sticky left-0 bg-card">
                  <Link href={`/institutions/${inst.institutionId}`} className="font-semibold text-foreground hover:underline">
                    {inst.name}
                  </Link>
                  <span className="ml-1.5 text-[9px] rounded border px-1 py-0.5 bg-indigo-50 text-indigo-800 border-indigo-300">
                    {INSTITUTION_TYPE_LABEL[inst.type] ?? inst.type}
                  </span>
                </td>
                <td className="px-2 py-2 text-center font-bold">
                  {result.ers != null ? `${Math.round(result.ers)}%` : "—"}
                </td>
                {result.axisScores.map((a) => (
                  <td
                    key={a.axisId}
                    className="px-2 py-2 text-center font-mono text-white/90"
                    style={{ background: ersScoreColor(a.score) }}
                    title={`${a.axisNo}. ${a.name}: ${a.score != null ? Math.round(a.score * 100) + "%" : "未評価"} (${a.assessedCount}/${a.totalCount})`}
                  >
                    {a.score != null ? Math.round(a.score * 100) : "–"}
                  </td>
                ))}
                <td className="px-2 py-2 text-center text-muted-foreground">
                  {result.assessedCriteria}/{result.totalCriteria}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-[10px] text-muted-foreground leading-relaxed">
        <span className="font-medium">軸凡例: </span>
        {sortedAxes.map((a) => (
          <span key={a.axisId} className="mr-3 inline-block">
            <span className="font-mono font-semibold">{a.axisNo}</span> {a.name}
            {a.correspondsXrl && <span className="opacity-60">（{a.correspondsXrl}）</span>}
          </span>
        ))}
      </div>
    </div>
  );
}
