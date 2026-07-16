"use client";

/**
 * /institutions — 研究機関 横断ヒートマップ比較 (ECR)
 * 設計正本: pwa/design/institution_readiness.md
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { fetchErsBundle, type ErsBundle } from "@/lib/ers-data";
import { computeErs, INSTITUTION_TYPE_LABEL } from "@/lib/ers";

/** ヒートマップ用 単色 (indigo) 濃淡。score 0..1、高いほど濃い。null=未評価グレー。 */
function heatCell(score: number | null): { background: string; color: string } {
  if (score == null) return { background: "#f4f4f5", color: "#a1a1aa" };
  const s = Math.max(0, Math.min(1, score));
  const L = 93 - s * 61; // 高得点ほど L が小さい (濃い)
  return {
    background: `hsl(243 58% ${L}%)`,
    color: L < 62 ? "rgba(255,255,255,0.96)" : "hsl(243 45% 30%)",
  };
}

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
          <h1 className="text-xl font-bold">研究機関 — ECR / エコシステム構築率</h1>
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

      <div className="overflow-auto rounded-lg border border-border max-h-[80vh]">
        <table className="text-xs border-collapse">
          <thead>
            <tr>
              <th className="sticky top-0 left-0 z-30 bg-muted px-3 py-2 text-left font-medium border-b border-r border-border min-w-[260px]">
                軸 / 機関
              </th>
              {results.map(({ inst }) => (
                <th
                  key={inst.institutionId}
                  className="sticky top-0 z-20 bg-muted px-3 py-2 text-center font-medium border-b border-r border-border min-w-[120px]"
                >
                  <Link href={`/institutions/${inst.institutionId}`} className="font-semibold hover:underline">
                    {inst.name}
                  </Link>
                  <span className="block mt-0.5 text-[9px] rounded border px-1 py-0.5 bg-indigo-50 text-indigo-800 border-indigo-300 w-fit mx-auto">
                    {INSTITUTION_TYPE_LABEL[inst.type] ?? inst.type}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* 総合 ECR (強調) */}
            <tr>
              <th className="sticky left-0 z-10 bg-card px-3 py-5 text-left text-base font-bold border-b-2 border-r border-border align-middle">
                総合 ECR
                <span className="block text-[10px] font-normal text-muted-foreground">エコシステム構築率</span>
              </th>
              {results.map(({ inst, result }) => {
                const c = heatCell(result.ers != null ? result.ers / 100 : null);
                return (
                  <td
                    key={inst.institutionId}
                    className="px-2 py-5 text-center font-mono text-3xl font-extrabold border-b-2 border-r border-border align-middle"
                    style={c}
                  >
                    {result.ers != null ? `${Math.round(result.ers)}%` : "—"}
                  </td>
                );
              })}
            </tr>
            {/* 各軸 */}
            {sortedAxes.map((axis) => (
              <tr key={axis.axisId} className="hover:bg-muted/10">
                <th className="sticky left-0 z-10 bg-card px-3 py-2 text-left font-normal border-b border-r border-border">
                  <span className="font-mono font-semibold text-foreground mr-1.5">{axis.axisNo}</span>
                  <span className="font-medium">{axis.name}</span>
                  {axis.correspondsXrl && (
                    <span className="ml-1 text-[10px] text-muted-foreground">（{axis.correspondsXrl}）</span>
                  )}
                </th>
                {results.map(({ inst, result }) => {
                  const a = result.axisScores.find((s) => s.axisId === axis.axisId);
                  return (
                    <td
                      key={inst.institutionId}
                      className="px-2 py-2.5 text-center font-mono text-sm border-b border-r border-border"
                      style={heatCell(a?.score ?? null)}
                      title={`${a?.score != null ? Math.round(a.score * 100) + "%" : "未評価"} (${a?.assessedCount ?? 0}/${a?.totalCount ?? 0})`}
                    >
                      {a?.score != null ? Math.round(a.score * 100) : "–"}
                    </td>
                  );
                })}
              </tr>
            ))}
            {/* 評価済 */}
            <tr>
              <th className="sticky left-0 z-10 bg-card px-3 py-2 text-left font-normal text-muted-foreground border-r border-border">
                評価済サブ軸
              </th>
              {results.map(({ inst, result }) => (
                <td key={inst.institutionId} className="px-2 py-2 text-center text-muted-foreground border-r border-border">
                  {result.assessedCriteria}/{result.totalCriteria}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
