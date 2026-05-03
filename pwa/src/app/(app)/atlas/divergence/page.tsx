"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  fetchAtlasDivergences,
  type AtlasDivergenceWithTheme,
} from "@/lib/supabase-data";
import { domainColor, domainKey, domainLabel } from "@/lib/atlas-domains";
import { cn } from "@/lib/utils";

type ViewMode = "cards" | "scatter" | "heatmap";
type SortKey = "global" | "japan" | "divergence";
type HeatmapAxis = "global" | "japan" | "divergence";

const VIEW_LABEL: Record<ViewMode, string> = {
  cards: "🃏 カード",
  scatter: "📍 散布図",
  heatmap: "🔥 ヒートマップ",
};

const SORT_LABEL: Record<SortKey, string> = {
  global: "世界の動き順",
  japan: "日本の動き順",
  divergence: "ギャップ順",
};

const HEATMAP_AXIS_LABEL: Record<HeatmapAxis, string> = {
  global: "🌍 世界活発度",
  japan: "🗾 日本活発度",
  divergence: "⚡ ギャップ",
};

export default function AtlasDivergencePage() {
  const [divergences, setDivergences] = useState<AtlasDivergenceWithTheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>("cards");
  const [selectedThemeId, setSelectedThemeId] = useState<string | null>(null);
  const [domainFilter, setDomainFilter] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("global");
  const [heatmapAxis, setHeatmapAxis] = useState<HeatmapAxis>("global");

  useEffect(() => {
    fetchAtlasDivergences().then((d) => {
      setDivergences(d);
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    const base = !domainFilter
      ? divergences
      : divergences.filter(
          (d) => domainKey(d.theme.primary_domain) === domainFilter
        );
    const sorted = [...base];
    sorted.sort((a, b) => {
      const av =
        sortKey === "global"
          ? a.global_intensity
          : sortKey === "japan"
            ? a.japan_intensity
            : a.divergence_score;
      const bv =
        sortKey === "global"
          ? b.global_intensity
          : sortKey === "japan"
            ? b.japan_intensity
            : b.divergence_score;
      return bv - av;
    });
    return sorted;
  }, [divergences, domainFilter, sortKey]);

  const domainCounts = useMemo(() => {
    const m = new Map<string, number>();
    divergences.forEach((d) => {
      const k = domainKey(d.theme.primary_domain);
      if (k) m.set(k, (m.get(k) || 0) + 1);
    });
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [divergences]);

  const selected = selectedThemeId
    ? filtered.find((d) => d.theme_id === selectedThemeId) || null
    : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-2.75rem)]">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-2.75rem)] flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center gap-3 flex-wrap shrink-0">
        <Link
          href="/atlas"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Atlas
        </Link>
        <div>
          <h1 className="text-sm font-bold leading-tight">マクロトレンドマップ</h1>
          <p className="text-[10px] text-muted-foreground/70 leading-tight">
            世界の動き × 日本の動き × ギャップ
          </p>
        </div>
        <span className="text-[10px] text-muted-foreground">
          {filtered.length} themes
          {divergences.length > 0 && (
            <>
              {" · "}最終生成:{" "}
              {new Date(divergences[0].generated_at).toLocaleString("ja-JP", {
                month: "numeric",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </>
          )}
        </span>

        {/* Sort (only for cards) */}
        {view === "cards" && (
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground">並び順:</span>
            {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
              <button
                key={k}
                onClick={() => setSortKey(k)}
                className={cn(
                  "text-[11px] px-2 py-0.5 rounded-md transition-colors",
                  sortKey === k
                    ? "bg-foreground/10 text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {SORT_LABEL[k]}
              </button>
            ))}
          </div>
        )}

        {/* Heatmap axis (only for heatmap) */}
        {view === "heatmap" && (
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground">色軸:</span>
            {(Object.keys(HEATMAP_AXIS_LABEL) as HeatmapAxis[]).map((k) => (
              <button
                key={k}
                onClick={() => setHeatmapAxis(k)}
                className={cn(
                  "text-[11px] px-2 py-0.5 rounded-md transition-colors",
                  heatmapAxis === k
                    ? "bg-foreground/10 text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {HEATMAP_AXIS_LABEL[k]}
              </button>
            ))}
          </div>
        )}

        {/* View toggle */}
        <div className="ml-auto flex items-center gap-1">
          {(Object.keys(VIEW_LABEL) as ViewMode[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "text-xs px-2.5 py-1 rounded-md font-medium transition-colors",
                view === v
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              {VIEW_LABEL[v]}
            </button>
          ))}
        </div>
      </div>

      {/* Domain filter */}
      {domainCounts.length > 0 && (
        <div className="px-4 py-2 border-b border-border flex items-center gap-1.5 flex-wrap shrink-0">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            分野
          </span>
          {domainCounts.map(([k, c]) => (
            <button
              key={k}
              onClick={() => setDomainFilter(domainFilter === k ? null : k)}
              className={cn(
                "text-xs font-medium px-2 py-0.5 rounded-full transition-all",
                domainFilter === k
                  ? "ring-2 ring-offset-1 ring-offset-background"
                  : "opacity-70 hover:opacity-100"
              )}
              style={{ background: domainColor(k), color: "white" }}
            >
              {domainLabel(k)} <span className="text-[10px] opacity-80">{c}</span>
            </button>
          ))}
          {domainFilter && (
            <button
              onClick={() => setDomainFilter(null)}
              className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground hover:bg-accent"
            >
              ✕ 解除
            </button>
          )}
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-hidden relative">
        {view === "cards" && (
          <CardsView
            data={filtered}
            onSelect={(id) => setSelectedThemeId(id)}
            selectedId={selectedThemeId}
          />
        )}
        {view === "scatter" && (
          <ScatterView
            data={filtered}
            onSelect={(id) => setSelectedThemeId(id)}
            selectedId={selectedThemeId}
          />
        )}
        {view === "heatmap" && (
          <HeatmapView
            data={filtered}
            onSelect={(id) => setSelectedThemeId(id)}
            selectedId={selectedThemeId}
            axis={heatmapAxis}
          />
        )}

        {selected && (
          <DetailPanel
            d={selected}
            onClose={() => setSelectedThemeId(null)}
          />
        )}
      </div>
    </div>
  );
}

// ============================================================
// Cards view
// ============================================================
function CardsView({
  data,
  onSelect,
  selectedId,
}: {
  data: AtlasDivergenceWithTheme[];
  onSelect: (id: string) => void;
  selectedId: string | null;
}) {
  return (
    <div className="overflow-y-auto h-full p-4 space-y-2">
      {data.length === 0 ? (
        <div className="text-center py-16 text-sm text-muted-foreground">
          該当するテーマがない
        </div>
      ) : (
        data.map((d) => (
          <DivergenceCard
            key={d.id}
            d={d}
            onClick={() => onSelect(d.theme_id)}
            highlighted={selectedId === d.theme_id}
          />
        ))
      )}
    </div>
  );
}

function DivergenceCard({
  d,
  onClick,
  highlighted,
}: {
  d: AtlasDivergenceWithTheme;
  onClick: () => void;
  highlighted: boolean;
}) {
  const dKey = domainKey(d.theme.primary_domain);
  const dColor = dKey ? domainColor(dKey) : "#94a3b8";
  const globalPct = Math.round(d.global_intensity * 100);
  const japanPct = Math.round(d.japan_intensity * 100);
  const gapPct = Math.round(d.divergence_score * 100);

  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-xl border p-4 cursor-pointer hover:bg-accent/30 transition-colors",
        highlighted ? "border-primary ring-1 ring-primary/40" : "border-border bg-card"
      )}
    >
      {/* Header: theme name + domain + intensity badges */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            {dKey && (
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white"
                style={{ background: dColor }}
              >
                {domainLabel(dKey)}
              </span>
            )}
          </div>
          <h3 className="text-base font-bold leading-snug">{d.theme.name}</h3>
        </div>

        {/* Intensity numbers (right) */}
        <div className="shrink-0 flex flex-col items-end gap-0.5 text-[10px]">
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">🌍</span>
            <span className="font-mono font-bold w-7 text-right" style={{ color: "#3b82f6" }}>
              {globalPct}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">🗾</span>
            <span className="font-mono font-bold w-7 text-right" style={{ color: "#ef4444" }}>
              {japanPct}
            </span>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground/70">
            <span>⚡</span>
            <span className="font-mono w-7 text-right">{gapPct}</span>
          </div>
        </div>
      </div>

      {/* Two-column world/japan summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-2">
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
              🌍 世界の動き
            </span>
            <span className="text-[10px] text-muted-foreground/60">
              {d.global_signal_count} signals
            </span>
          </div>
          {d.global_summary ? (
            <p className="text-xs leading-relaxed text-foreground/85 line-clamp-5">
              {d.global_summary}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground/50 italic">該当シグナル少</p>
          )}
        </div>
        <div className="space-y-1 md:border-l md:border-border md:pl-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300">
              🗾 日本の動き
            </span>
            <span className="text-[10px] text-muted-foreground/60">
              {d.japan_signal_count} signals
            </span>
          </div>
          {d.japan_summary ? (
            <p className="text-xs leading-relaxed text-foreground/85 line-clamp-5">
              {d.japan_summary}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground/50 italic">該当シグナル少</p>
          )}
        </div>
      </div>

      {/* Gap message as footer */}
      {d.divergence_message && (
        <div className="pt-2 border-t border-border/50 flex items-start gap-1.5">
          <span className="text-[10px] text-amber-700 dark:text-amber-400 mt-0.5">⚡</span>
          <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
            {d.divergence_message}
          </p>
        </div>
      )}
    </div>
  );
}

function IntensityBar({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-muted-foreground w-10 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="text-[10px] text-muted-foreground/70 w-8 text-right shrink-0">
        {pct}
      </span>
    </div>
  );
}

// ============================================================
// Scatter view (g3): x=global_intensity, y=japan_intensity
// 対角線 y=x が「同期」、外れたら乖離
// ============================================================
function ScatterView({
  data,
  onSelect,
  selectedId,
}: {
  data: AtlasDivergenceWithTheme[];
  onSelect: (id: string) => void;
  selectedId: string | null;
}) {
  const SIZE = 600;
  const PADDING = 50;
  const inner = SIZE - PADDING * 2;

  const scaleX = (v: number) => PADDING + v * inner;
  const scaleY = (v: number) => SIZE - PADDING - v * inner; // y軸は上が大きい

  return (
    <div className="overflow-auto h-full p-4">
      <div className="max-w-3xl mx-auto">
        <p className="text-xs text-muted-foreground mb-2 text-center">
          x軸 = 世界の動きの活発度 / y軸 = 日本の動きの活発度。右上ほどホットなマクロトレンド、対角線から外れるほどギャップが大きい。
        </p>
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="w-full h-auto bg-card rounded-xl border border-border"
        >
          {/* 背景グリッド */}
          {[0, 0.25, 0.5, 0.75, 1].map((v) => (
            <g key={v}>
              <line
                x1={scaleX(v)}
                y1={PADDING}
                x2={scaleX(v)}
                y2={SIZE - PADDING}
                stroke="rgba(120,120,120,0.12)"
                strokeDasharray="2 4"
              />
              <line
                x1={PADDING}
                y1={scaleY(v)}
                x2={SIZE - PADDING}
                y2={scaleY(v)}
                stroke="rgba(120,120,120,0.12)"
                strokeDasharray="2 4"
              />
            </g>
          ))}

          {/* 対角線 (同期ライン) */}
          <line
            x1={scaleX(0)}
            y1={scaleY(0)}
            x2={scaleX(1)}
            y2={scaleY(1)}
            stroke="rgba(120,120,120,0.3)"
            strokeDasharray="6 4"
          />

          {/* 軸ラベル */}
          <text
            x={SIZE / 2}
            y={SIZE - 10}
            textAnchor="middle"
            className="fill-muted-foreground"
            style={{ fontSize: 11 }}
          >
            世界の動きの活発度 →
          </text>
          <text
            x={15}
            y={SIZE / 2}
            textAnchor="middle"
            transform={`rotate(-90 15 ${SIZE / 2})`}
            className="fill-muted-foreground"
            style={{ fontSize: 11 }}
          >
            日本の動きの活発度 →
          </text>
          <text
            x={SIZE - PADDING - 4}
            y={scaleY(1) + 14}
            textAnchor="end"
            className="fill-muted-foreground/60"
            style={{ fontSize: 9 }}
          >
            ← 同期ライン (y=x)
          </text>

          {/* 各テーマの点 */}
          {data.map((d) => {
            const dKey = domainKey(d.theme.primary_domain);
            const color = dKey ? domainColor(dKey) : "#94a3b8";
            const cx = scaleX(d.global_intensity);
            const cy = scaleY(d.japan_intensity);
            const r = 5 + d.divergence_score * 6;
            const isSel = selectedId === d.theme_id;
            return (
              <g
                key={d.id}
                onClick={() => onSelect(d.theme_id)}
                style={{ cursor: "pointer" }}
              >
                <circle
                  cx={cx}
                  cy={cy}
                  r={r + (isSel ? 4 : 0)}
                  fill={color}
                  fillOpacity={0.65}
                  stroke={isSel ? "#000" : "white"}
                  strokeWidth={isSel ? 2 : 1}
                />
                <title>
                  {d.theme.name} · 世界 {Math.round(d.global_intensity * 100)} · 日本{" "}
                  {Math.round(d.japan_intensity * 100)} · ギャップ{" "}
                  {Math.round(d.divergence_score * 100)}
                </title>
                {/* ホットなテーマ or ギャップ大きいテーマにラベル */}
                {(d.divergence_score >= 0.5 || d.global_intensity >= 0.65) && (
                  <text
                    x={cx + r + 3}
                    y={cy + 4}
                    className="fill-foreground/80"
                    style={{ fontSize: 10, fontWeight: 600 }}
                  >
                    {d.theme.name.length > 12
                      ? d.theme.name.slice(0, 12) + "…"
                      : d.theme.name}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-1.5 text-[10px]">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-foreground/60 inline-block" />
            <span className="text-muted-foreground">点の大きさ = 乖離度</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0 border-t-2 border-dashed border-foreground/40" />
            <span className="text-muted-foreground">対角線 = 完全同期</span>
          </div>
          <div className="text-muted-foreground/70">点クリックで詳細</div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Heatmap view (g1): 縦=ドメイン × 横=テーマ
// ============================================================
function HeatmapView({
  data,
  onSelect,
  selectedId,
  axis,
}: {
  data: AtlasDivergenceWithTheme[];
  onSelect: (id: string) => void;
  selectedId: string | null;
  axis: HeatmapAxis;
}) {
  const valueOf = (d: AtlasDivergenceWithTheme): number =>
    axis === "global"
      ? d.global_intensity
      : axis === "japan"
        ? d.japan_intensity
        : d.divergence_score;

  // 分野ごとにグループ化（テーマは選択中の軸の値で降順）
  const grouped = useMemo(() => {
    const m = new Map<string, AtlasDivergenceWithTheme[]>();
    data.forEach((d) => {
      const k = domainKey(d.theme.primary_domain) || "?";
      const arr = m.get(k) || [];
      arr.push(d);
      m.set(k, arr);
    });
    m.forEach((arr) => arr.sort((a, b) => valueOf(b) - valueOf(a)));
    return Array.from(m.entries()).sort((a, b) => {
      const av = Math.max(...a[1].map(valueOf));
      const bv = Math.max(...b[1].map(valueOf));
      return bv - av;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, axis]);

  // 色軸別グラデーション
  // global: 薄青→濃青、japan: 薄赤→濃赤、divergence: 緑→黄→赤
  const cellColor = (v: number, ax: HeatmapAxis) => {
    if (ax === "global") {
      // #dbeafe(薄) → #1d4ed8(濃)
      const t = Math.max(0, Math.min(1, v));
      const r = Math.round(219 + (29 - 219) * t);
      const g = Math.round(234 + (78 - 234) * t);
      const b = Math.round(254 + (216 - 254) * t);
      return `rgb(${r},${g},${b})`;
    }
    if (ax === "japan") {
      // #fee2e2(薄) → #b91c1c(濃)
      const t = Math.max(0, Math.min(1, v));
      const r = Math.round(254 + (185 - 254) * t);
      const g = Math.round(226 + (28 - 226) * t);
      const b = Math.round(226 + (28 - 226) * t);
      return `rgb(${r},${g},${b})`;
    }
    // divergence: 緑→黄→赤
    if (v < 0.5) {
      const t = v / 0.5;
      const r = Math.round(16 + (251 - 16) * t);
      const g = Math.round(185 + (191 - 185) * t);
      const b = Math.round(129 + (36 - 129) * t);
      return `rgb(${r},${g},${b})`;
    }
    const t = (v - 0.5) / 0.5;
    const r = Math.round(251 + (244 - 251) * t);
    const g = Math.round(191 + (63 - 191) * t);
    const b = Math.round(36 + (94 - 36) * t);
    return `rgb(${r},${g},${b})`;
  };

  const axisLabel: Record<HeatmapAxis, string> = {
    global: "色が濃い = 世界の動きが活発",
    japan: "色が濃い = 日本の動きが活発",
    divergence: "色が濃い = 世界と日本のギャップが大きい（緑→黄→赤）",
  };

  return (
    <div className="overflow-y-auto h-full p-4">
      <p className="text-xs text-muted-foreground mb-3">
        分野 × テーマのグリッド。{axisLabel[axis]}。
      </p>
      <div className="space-y-3">
        {grouped.map(([dk, themes]) => (
          <div key={dk} className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded text-white"
                style={{ background: domainColor(dk) }}
              >
                {domainLabel(dk)}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {themes.length} themes
              </span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-1.5">
              {themes.map((d) => {
                const isSel = selectedId === d.theme_id;
                const v = valueOf(d);
                const isLight = v < 0.4;
                return (
                  <button
                    key={d.id}
                    onClick={() => onSelect(d.theme_id)}
                    className={cn(
                      "text-left rounded-md p-2 transition-all",
                      isSel ? "ring-2 ring-foreground/40 ring-offset-1" : "",
                      "hover:scale-105"
                    )}
                    style={{ background: cellColor(v, axis) }}
                    title={`${d.theme.name} · ${HEATMAP_AXIS_LABEL[axis]} ${Math.round(v * 100)}`}
                  >
                    <div
                      className={cn(
                        "text-[10px] font-bold leading-tight line-clamp-2",
                        isLight ? "text-foreground" : "text-white"
                      )}
                    >
                      {d.theme.name}
                    </div>
                    <div
                      className={cn(
                        "text-[9px] mt-0.5",
                        isLight ? "text-foreground/70" : "text-white/85"
                      )}
                    >
                      {Math.round(v * 100)}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Detail panel (右からスライドイン)
// ============================================================
function DetailPanel({
  d,
  onClose,
}: {
  d: AtlasDivergenceWithTheme;
  onClose: () => void;
}) {
  const dKey = domainKey(d.theme.primary_domain);
  const dColor = dKey ? domainColor(dKey) : "#94a3b8";
  return (
    <div className="absolute top-3 right-3 bottom-3 w-[420px] max-w-[calc(100%-1.5rem)] bg-background rounded-lg border border-border shadow-xl flex flex-col z-10">
      <div className="p-3 border-b border-border flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {dKey && (
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white"
              style={{ background: dColor }}
            >
              {domainLabel(dKey)}
            </span>
          )}
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">
            ズレ {Math.round(d.divergence_score * 100)}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground -mt-1 -mr-1"
          aria-label="閉じる"
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <div>
          <h3 className="text-base font-bold leading-snug">{d.theme.name}</h3>
          {d.theme.description && (
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              {d.theme.description}
            </p>
          )}
        </div>

        {/* 差分メッセージ */}
        {d.divergence_message && (
          <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-900/15 dark:border-amber-900/40">
            <p className="text-[10px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider mb-1">
              ⚡ ズレの本質
            </p>
            <p className="text-sm leading-relaxed text-amber-900 dark:text-amber-100">
              {d.divergence_message}
            </p>
          </div>
        )}

        {/* 世界 */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
              🌍 世界の動き ({d.global_signal_count})
            </p>
            <span className="text-[10px] text-muted-foreground">
              活発度 {Math.round(d.global_intensity * 100)}
            </span>
          </div>
          {d.global_summary && (
            <p className="text-xs leading-relaxed text-foreground/85 select-text">
              {d.global_summary}
            </p>
          )}
          {d.signal_breakdown?.global && d.signal_breakdown.global.length > 0 && (
            <ul className="text-[11px] space-y-0.5 pl-3">
              {d.signal_breakdown.global.slice(0, 5).map((s, i) => (
                <li key={i} className="text-muted-foreground leading-snug">
                  <span className="font-mono text-[10px] text-muted-foreground/60">
                    {s.date}
                  </span>{" "}
                  {s.url ? (
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-foreground"
                    >
                      {s.title}
                    </a>
                  ) : (
                    s.title
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 日本 */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300">
              🗾 日本の動き ({d.japan_signal_count})
            </p>
            <span className="text-[10px] text-muted-foreground">
              活発度 {Math.round(d.japan_intensity * 100)}
            </span>
          </div>
          {d.japan_summary && (
            <p className="text-xs leading-relaxed text-foreground/85 select-text">
              {d.japan_summary}
            </p>
          )}
          {d.signal_breakdown?.japan && d.signal_breakdown.japan.length > 0 && (
            <ul className="text-[11px] space-y-0.5 pl-3">
              {d.signal_breakdown.japan.slice(0, 5).map((s, i) => (
                <li key={i} className="text-muted-foreground leading-snug">
                  <span className="font-mono text-[10px] text-muted-foreground/60">
                    {s.date}
                  </span>{" "}
                  {s.ministry && (
                    <span className="text-[10px] px-1 rounded bg-muted">
                      {s.ministry}
                    </span>
                  )}{" "}
                  {s.url ? (
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-foreground"
                    >
                      {s.title}
                    </a>
                  ) : (
                    s.title
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* タグキーワード */}
        {d.theme.tag_keywords.length > 0 && (
          <div className="pt-2 border-t border-border/50">
            <div className="flex flex-wrap gap-1">
              {d.theme.tag_keywords.map((k) => (
                <span
                  key={k}
                  className="text-[10px] px-1.5 py-0 rounded bg-muted text-muted-foreground"
                >
                  {k}
                </span>
              ))}
            </div>
          </div>
        )}

        <p className="text-[9px] text-muted-foreground/50 pt-1 border-t border-border/30">
          生成日時: {new Date(d.generated_at).toLocaleString("ja-JP")}
        </p>
      </div>
    </div>
  );
}
