"use client";

/**
 * /institutions/[institutionId] — 研究機関 ECR 詳細
 * 設計正本: pwa/design/institution_readiness.md
 *
 * 8 軸レーダー + 軸ごとのサブ軸 (Lv1-5 rubric) 充足状況 + ノート。
 * AMD Score (個体レイヤー) とは別ロジックの苗床レイヤー指標。
 */
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { fetchErsBundle, type ErsBundle } from "@/lib/ers-data";
import { selectPrimaryInstitutionProject } from "@/lib/institution-projects";
import {
  computeErs,
  ersScoreColor,
  normalizeLevel,
  INSTITUTION_TYPE_LABEL,
  type ErsAssessment,
} from "@/lib/ers";

const LEVEL_LABEL: Record<number, string> = { 1: "Lv1", 2: "Lv2", 3: "Lv3", 4: "Lv4", 5: "Lv5" };

export default function InstitutionDetailPage() {
  const params = useParams<{ institutionId: string }>();
  const institutionId = params.institutionId;
  const [bundle, setBundle] = useState<ErsBundle | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchErsBundle()
      .then((b) => setBundle(b))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const inst = useMemo(
    () => bundle?.institutions.find((i) => i.institutionId === institutionId) ?? null,
    [bundle, institutionId],
  );

  const assessments = useMemo<ErsAssessment[]>(
    () => (bundle ? bundle.assessmentsByInstitution[institutionId] ?? [] : []),
    [bundle, institutionId],
  );

  const assessByCriterion = useMemo(() => {
    const m = new Map<string, ErsAssessment>();
    for (const a of assessments) m.set(a.criterionId, a);
    return m;
  }, [assessments]);

  const result = useMemo(
    () => (bundle && inst ? computeErs(bundle.axes, bundle.criteria, assessments) : null),
    [bundle, inst, assessments],
  );

  const sortedAxes = useMemo(
    () => (bundle ? [...bundle.axes].sort((a, b) => a.sortOrder - b.sortOrder) : []),
    [bundle],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!bundle || !inst || !result) {
    return (
      <div className="p-6 space-y-3">
        <p className="text-sm text-muted-foreground">機関が見つかりませんでした。</p>
        <Link href="/institutions" className="text-sm text-primary hover:underline">← 研究機関一覧へ</Link>
      </div>
    );
  }

  const meta = [inst.region, inst.description].filter(Boolean).join(" · ");
  const projectLink = selectPrimaryInstitutionProject(bundle.institutionProjectsByInstitution[institutionId]);

  return (
    <div className="p-4 max-w-[1100px] mx-auto space-y-6">
      {/* === ヘッダ === */}
      <header className="space-y-2">
        <Link href="/institutions" className="text-xs text-muted-foreground hover:text-foreground hover:underline">
          ← 研究機関一覧・比較
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold">{inst.name}</h1>
              <span className="text-[10px] rounded border px-1.5 py-0.5 bg-indigo-50 text-indigo-800 border-indigo-300">
                {INSTITUTION_TYPE_LABEL[inst.type] ?? inst.type}
              </span>
            </div>
            {meta && <p className="text-xs text-muted-foreground mt-1">{meta}</p>}
          </div>
          <div className="text-right shrink-0">
            <div className="text-[10px] text-muted-foreground font-mono uppercase">ECR 充足率</div>
            <div className="text-3xl font-bold leading-none">
              {result.ers != null ? `${Math.round(result.ers)}%` : "—"}
            </div>
            <div className="text-[10px] text-muted-foreground mt-1">
              評価済 {result.assessedCriteria}/{result.totalCriteria} サブ軸
            </div>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed border-l-2 border-indigo-300 pl-2">
          苗床レイヤー指標。機関が「ベンチャーを生み育てる装置」としてどれだけ整備されているかを 8 軸 × サブ軸 (Lv1–5) の充足率で表す。
          <span className="font-medium text-foreground">AMD Score（個体レイヤー）とは別ロジック</span>で、σ_SU 経由でのみ概念連動する。
        </p>
      </header>

      {/* === レーダー + 軸サマリ === */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center rounded-lg border border-border p-4">
        <ErsRadar
          axes={result.axisScores.map((a) => ({ axisNo: a.axisNo, name: a.name, score: a.score }))}
        />
        <div className="space-y-1.5">
          {result.axisScores.map((a) => (
            <div key={a.axisId} className="flex items-center gap-2 text-xs">
              <span
                className="w-6 h-6 rounded flex items-center justify-center font-mono text-white/90 shrink-0"
                style={{ background: ersScoreColor(a.score) }}
              >
                {a.axisNo}
              </span>
              <span className="flex-1 min-w-0 truncate">{a.name}</span>
              <span className="font-mono tabular-nums text-muted-foreground">
                {a.score != null ? `${Math.round(a.score * 100)}%` : "未評価"}
              </span>
              <span className="text-[10px] text-muted-foreground/70 w-10 text-right">
                {a.assessedCount}/{a.totalCount}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* === 軸ごとのサブ軸 rubric === */}
      <div className="space-y-5">
        {sortedAxes.map((axis) => {
          const axisResult = result.axisScores.find((a) => a.axisId === axis.axisId);
          const crits = bundle.criteria
            .filter((c) => c.axisId === axis.axisId)
            .sort((a, b) => a.sortOrder - b.sortOrder);
          return (
            <section key={axis.axisId} className="rounded-lg border border-border overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 bg-muted/40 border-b border-border">
                <span
                  className="w-6 h-6 rounded flex items-center justify-center font-mono text-white/90 text-xs shrink-0"
                  style={{ background: ersScoreColor(axisResult?.score ?? null) }}
                >
                  {axis.axisNo}
                </span>
                <h2 className="text-sm font-semibold flex-1 min-w-0">
                  {axis.name}
                  {axis.correspondsXrl && (
                    <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">（{axis.correspondsXrl}）</span>
                  )}
                </h2>
                <span className="text-xs font-mono text-muted-foreground">
                  {axisResult?.score != null ? `${Math.round(axisResult.score * 100)}%` : "未評価"}
                </span>
              </div>
              <div className="divide-y divide-border/60">
                {crits.map((c) => {
                  const a = assessByCriterion.get(c.criterionId);
                  const isNa = Boolean(a?.na);
                  const level = a?.level ?? null;
                  const rubricForLevel = level != null ? c.rubric[String(level)] : null;
                  return (
                    <div key={c.criterionId} className="px-3 py-2.5">
                      <div className="flex items-start gap-2">
                        <span className="text-[10px] font-mono text-muted-foreground mt-0.5 w-8 shrink-0">{c.code}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-medium">{c.name}</span>
                            <LevelBadge level={level} na={isNa} />
                          </div>
                          {rubricForLevel && (
                            <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{rubricForLevel}</p>
                          )}
                          {level == null && !isNa && (
                            <p className="text-[10px] text-muted-foreground/60 mt-1 leading-relaxed">
                              基準 Lv1: {c.rubric["1"] ?? "—"} ／ Lv5: {c.rubric["5"] ?? "—"}
                            </p>
                          )}
                          {a?.note && (
                            <p className="text-[11px] text-foreground/80 mt-1 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                              📝 {a.note}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {/* === この機関を対象にする AMD PJ === */}
      <section className="rounded-lg border border-dashed border-border p-4 text-center">
        <h2 className="text-sm font-semibold text-muted-foreground">この研究機関を対象にする AMD PJ</h2>
        {projectLink ? (
          <div className="mt-2 flex items-center justify-center gap-2 flex-wrap">
            <Link
              href={`/institutions/${institutionId}/cockpit`}
              className="text-xs rounded-md border border-primary/40 bg-primary/5 text-primary px-3 py-1.5 font-medium hover:bg-primary/10"
            >
              {projectLink.cockpitTitle}
            </Link>
            <Link
              href={`/project/${projectLink.projectId}/cockpit`}
              className="text-xs rounded-md border border-border bg-white px-3 py-1.5 hover:bg-muted/40"
            >
              {projectLink.projectLabel}
            </Link>
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground/70 mt-1">
            AMDとの契約PJはまだない。研究機関カタログとECRは、契約の有無に関係なく蓄積する。
          </p>
        )}
      </section>
    </div>
  );
}

function LevelBadge({ level, na }: { level: number | null; na: boolean }) {
  if (na) {
    return <span className="text-[9px] rounded px-1.5 py-0.5 bg-zinc-100 text-zinc-500 border border-zinc-300">N/A</span>;
  }
  if (level == null) {
    return <span className="text-[9px] rounded px-1.5 py-0.5 bg-zinc-100 text-zinc-400 border border-zinc-200">未評価</span>;
  }
  const score = normalizeLevel(level);
  return (
    <span
      className="text-[9px] rounded px-1.5 py-0.5 text-white/95 font-mono"
      style={{ background: ersScoreColor(score) }}
    >
      {LEVEL_LABEL[level] ?? `Lv${level}`}
    </span>
  );
}

/** 8 軸 ECR レーダーチャート (SVG)。score は 0..1 / null。 */
function ErsRadar({ axes }: { axes: { axisNo: number; name: string; score: number | null }[] }) {
  const size = 280;
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - 38;
  const n = axes.length || 1;

  const angleFor = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const pointAt = (i: number, r: number) => {
    const ang = angleFor(i);
    return [cx + r * Math.cos(ang), cy + r * Math.sin(ang)] as const;
  };

  const rings = [0.25, 0.5, 0.75, 1];
  const polygon = axes
    .map((a, i) => {
      const r = R * (a.score ?? 0);
      const [x, y] = pointAt(i, r);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[300px] mx-auto" role="img" aria-label="ECR 8軸レーダー">
      {/* グリッド ring */}
      {rings.map((ring) => (
        <polygon
          key={ring}
          points={axes.map((_, i) => pointAt(i, R * ring).map((v) => v.toFixed(1)).join(",")).join(" ")}
          fill="none"
          stroke="currentColor"
          className="text-border"
          strokeWidth={0.5}
        />
      ))}
      {/* 軸線 */}
      {axes.map((_, i) => {
        const [x, y] = pointAt(i, R);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="currentColor" className="text-border" strokeWidth={0.5} />;
      })}
      {/* データポリゴン */}
      <polygon points={polygon} fill="rgb(99 102 241 / 0.25)" stroke="rgb(99 102 241)" strokeWidth={1.5} />
      {/* 頂点ドット */}
      {axes.map((a, i) => {
        const [x, y] = pointAt(i, R * (a.score ?? 0));
        return <circle key={i} cx={x} cy={y} r={2.5} fill={ersScoreColor(a.score)} />;
      })}
      {/* 軸番号ラベル */}
      {axes.map((a, i) => {
        const [x, y] = pointAt(i, R + 16);
        return (
          <text
            key={i}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-muted-foreground font-mono"
            fontSize={11}
          >
            {a.axisNo}
          </text>
        );
      })}
    </svg>
  );
}
