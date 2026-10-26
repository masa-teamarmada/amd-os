"use client";

/**
 * PatentMap — 知財タブの「特許マップ」(まさ依頼 2026-08-21)。
 *
 * project_ip_assets だけを入力に、3 つの見方を切り替える:
 *   1. 権利範囲マップ  技術区分 (X) × 権利範囲の広さ claim_breadth 1-5 (Y)
 *   2. 時系列マップ    出願年 (X) × 技術区分 (Y)
 *   3. 出願人マトリクス 出願人 (行) × 技術区分 (列) の件数ヒートマップ
 * 色 = 立場 (own/university/joint/blocking/watch)、大きさ = importance。
 * 点をクリックすると親の詳細モーダルが開く。
 */

import { useMemo, useState } from "react";
import { RELATION_META, RELATION_ORDER, type IpAsset, type IpRelation } from "@/lib/project-ip";

type MapView = "breadth" | "timeline" | "applicant";

const VIEW_LABEL: Record<MapView, string> = {
  breadth: "権利範囲マップ",
  timeline: "時系列マップ",
  applicant: "出願人マトリクス",
};

const UNCLASSIFIED = "未分類";

function domainOf(a: IpAsset) {
  return a.tech_domain?.trim() || UNCLASSIFIED;
}
function applicantOf(a: IpAsset) {
  return a.applicants?.[0]?.trim() || "出願人不明";
}
function yearOf(a: IpAsset) {
  const d = a.application_date || a.publication_date;
  return d ? Number(d.slice(0, 4)) : null;
}

/** カテゴリ軸のラベルを 8 文字で折る (SVG は自動折返ししないため)。 */
function clip(s: string, n = 10) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

export function PatentMap({
  assets,
  onSelect,
  assessmentDisplay = "recorded",
  importanceDisplay = "uniform",
  print = false,
}: {
  assets: IpAsset[];
  onSelect: (asset: IpAsset) => void;
  assessmentDisplay?: "recorded" | "explicit";
  importanceDisplay?: "uniform" | "assessed";
  print?: boolean;
}) {
  const [view, setView] = useState<MapView>("breadth");
  const [hidden, setHidden] = useState<IpRelation[]>([]);
  const [hover, setHover] = useState<IpAsset | null>(null);

  const shown = useMemo(
    () => assets.filter((a) => !hidden.includes(a.relation)),
    [assets, hidden],
  );

  const domains = useMemo(() => {
    const set = new Set(shown.map(domainOf));
    return Array.from(set).sort((a, b) => (a === UNCLASSIFIED ? 1 : b === UNCLASSIFIED ? -1 : a.localeCompare(b, "ja")));
  }, [shown]);

  if (assets.length === 0) return null;

  const explicitAssessment = assessmentDisplay === "explicit";
  const assessedCount = assets.filter(a => a.claim_breadth != null).length;
  const importanceAssessed = importanceDisplay === "assessed";
  const assessmentNote = `色 = 立場。権利範囲 ${assessedCount}/${assets.length}件を評価。${importanceAssessed?"点の大きさ = SOLとの関係に基づく重要度（1〜5）。":"点の大きさは統一（重要度未評価）。"}`;
  if (print) return <section className="ddr-ip-common-print" data-testid="cockpit-ip-patent-map"><h2>🗺️ 特許マップ</h2><div className="ddr-ip-common-print-legend">{RELATION_ORDER.filter(r=>assets.some(a=>a.relation===r)).map(r=><span key={r}><i style={{color:RELATION_META[r].hex}}>●</i> {RELATION_META[r].short}</span>)}</div>{(Object.keys(VIEW_LABEL) as MapView[]).map(v=><section className="ddr-ip-print-view" data-map-view={v} key={v}><h3>{VIEW_LABEL[v]}</h3>{v==="applicant"?<ApplicantMatrix assets={assets} domains={domains} onSelect={onSelect} explicitAssessment={explicitAssessment} print/>:<Scatter view={v} assets={assets} domains={domains} onSelect={onSelect} onHover={()=>{}} hover={null} explicitAssessment={explicitAssessment} importanceAssessed={importanceAssessed} print/>}</section>)}<p>{explicitAssessment?assessmentNote:"色 = 立場、大きさ = 重要度 (1-5)。"}</p></section>;

  const toggleRelation = (r: IpRelation) =>
    setHidden((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));

  return (
    <section className="rounded-lg border border-border bg-background" data-testid="cockpit-ip-patent-map">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <h2 className="text-[13px] font-semibold">🗺️ 特許マップ</h2>
        <div className="flex flex-wrap gap-1">
          {(Object.keys(VIEW_LABEL) as MapView[]).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={explicitAssessment ? view === v : undefined}
              onClick={() => setView(v)}
              className={`rounded border px-2 py-0.5 text-[10px] ${
                view === v ? "border-foreground bg-foreground text-background" : "border-border bg-background text-muted-foreground hover:bg-muted"
              }`}
            >{VIEW_LABEL[v]}</button>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap gap-1">
          {RELATION_ORDER.map((r) => {
            const off = hidden.includes(r);
            return (
              <button
                key={r}
                type="button"
                aria-pressed={explicitAssessment ? !off : undefined}
                onClick={() => toggleRelation(r)}
                title={off ? "表示する" : "非表示にする"}
                className={`flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] ${off ? "border-border bg-background text-muted-foreground/50" : "border-border bg-background text-foreground"}`}
              >
                <span className="inline-block size-2 rounded-full" style={{ background: off ? "#cbd5e1" : RELATION_META[r].hex }} />
                {RELATION_META[r].short}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-3 py-3">
        {shown.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">表示する立場がすべて非表示になっている。</p>
        ) : view === "applicant" ? (
          <ApplicantMatrix assets={shown} domains={domains} onSelect={onSelect} explicitAssessment={explicitAssessment} />
        ) : (
          <Scatter view={view} assets={shown} domains={domains} onSelect={onSelect} onHover={setHover} hover={hover} explicitAssessment={explicitAssessment} importanceAssessed={importanceAssessed} />
        )}
        <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
          {explicitAssessment ? assessmentNote : "色 = 立場、大きさ = 重要度 (1-5)。"}
          {!explicitAssessment && view === "breadth" && " 上に行くほど権利範囲が広い = 回避が難しい。右上に赤 (障害特許) がある技術区分は before zero の要注意ゾーン。"}
          {view === "timeline" && (explicitAssessment ? " 横軸は出願年。大学と他者の出願時期を技術区分別に比較する。" : " 横軸は出願年。大学の基本特許より後ろに自社出願が並んでいるかを見る。")}
          {view === "applicant" && (explicitAssessment ? " 技術区分別の掲載出願・代表公報数。共同出願人も個別に計上。セルから先頭の1件を開く。" : " 誰がどの技術区分を押さえているかの件数マトリクス。セルをクリックすると先頭の1件を開く。")}
        </p>
      </div>
    </section>
  );
}

function Scatter({
  view, assets, domains, onSelect, onHover, hover, explicitAssessment = false, importanceAssessed = false, print = false,
}: {
  view: "breadth" | "timeline";
  assets: IpAsset[];
  domains: string[];
  onSelect: (a: IpAsset) => void;
  onHover: (a: IpAsset | null) => void;
  hover: IpAsset | null;
  importanceAssessed?: boolean;
  explicitAssessment?: boolean;
  print?: boolean;
}) {
  const W = explicitAssessment ? Math.max(560, 96 + domains.length * (print ? 72 : 112)) : 560;
  const padL = 84;
  const padR = 12;
  const padT = 10;
  const padB = 30;

  const years = assets.map(yearOf).filter((y): y is number => y != null);
  const minYear = years.length ? Math.min(...years) : new Date().getFullYear() - 5;
  const maxYear = years.length ? Math.max(...years) : new Date().getFullYear();
  const yearSpan = Math.max(1, maxYear - minYear);

  // breadth: X=技術区分(カテゴリ) / Y=claim_breadth 1-5
  // timeline: X=出願年(数値)   / Y=技術区分(カテゴリ)
  const hasUnassessed = explicitAssessment && assets.some(a=>a.claim_breadth == null);
  const yCats = view === "breadth" ? [...[5, 4, 3, 2, 1].map(String), ...(hasUnassessed?["未評価"]:[])] : domains;
  const xCats = view === "breadth" ? domains : null;
  const rowH = view === "breadth" ? 26 : 22;
  const H = padT + padB + Math.max(1, yCats.length) * rowH;

  const plotW = W - padL - padR;
  const xOf = (a: IpAsset, idxInCell: number) => {
    if (xCats) {
      const i = Math.max(0, xCats.indexOf(domainOf(a)));
      const band = plotW / xCats.length;
      return padL + band * (i + 0.5) + ((idxInCell % 5) - 2) * 5;
    }
    const y = yearOf(a);
    if (y == null) return padL + 10;
    return padL + ((y - minYear) / yearSpan) * (plotW - 20) + 10 + ((idxInCell % 5) - 2) * 4;
  };
  const yOf = (a: IpAsset, idxInCell: number) => {
    if (view === "breadth") {
      if (explicitAssessment && a.claim_breadth == null) return padT + rowH * (yCats.length - 0.5);
      const b = a.claim_breadth ?? 3;
      const i = [5, 4, 3, 2, 1].indexOf(b);
      return padT + rowH * ((i < 0 ? 2 : i) + 0.5) + (Math.floor(idxInCell / 5) % 3 - 1) * 5;
    }
    const i = Math.max(0, domains.indexOf(domainOf(a)));
    return padT + rowH * (i + 0.5) + (Math.floor(idxInCell / 5) % 3 - 1) * 4;
  };

  const cellKey = (a: IpAsset) => view === "breadth" ? `${domainOf(a)}|${explicitAssessment && a.claim_breadth == null ? "?" : a.claim_breadth ?? 3}` : `${yearOf(a) ?? "?"}|${domainOf(a)}`;
  const totals = new Map<string, number>();
  if (explicitAssessment) assets.forEach(a=>totals.set(cellKey(a),(totals.get(cellKey(a))??0)+1));
  // 同じセルに落ちる点を数えてジッタさせる
  const cellCount = new Map<string, number>();
  const placed = assets.map((a) => {
    const key = cellKey(a);
    const idx = cellCount.get(key) ?? 0;
    cellCount.set(key, idx + 1);
    const centered = (idx - ((totals.get(key)??1)-1)/2)*13;
    const cx = explicitAssessment ? xOf(a, 2) + centered : xOf(a, idx);
    return { a, cx, cy: yOf(a, explicitAssessment ? 2 : idx) };
  });

  const xTicks = xCats
    ? xCats.map((c, i) => ({ label: clip(c, 8), x: padL + (plotW / xCats.length) * (i + 0.5) }))
    : Array.from({ length: Math.min(yearSpan + 1, 12) }, (_, i) => {
        const step = yearSpan / Math.max(1, Math.min(yearSpan, 11));
        const y = Math.round(minYear + step * i);
        return { label: String(y), x: padL + ((y - minYear) / yearSpan) * (plotW - 20) + 10 };
      });

  return (
    <div className="relative overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        className="h-auto max-w-full"
        role={explicitAssessment && !print ? "group" : "img"}
        aria-label="特許マップ"
      >
        {yCats.map((c, i) => (
          <g key={`row-${c}`}>
            <line x1={padL} x2={W - padR} y1={padT + rowH * (i + 1)} y2={padT + rowH * (i + 1)} stroke="currentColor" className="text-border" strokeWidth={1} />
            <text x={padL - 6} y={padT + rowH * (i + 0.5) + 3} textAnchor="end" className="fill-muted-foreground" fontSize={9}>
              {view === "breadth" ? c === "未評価" ? c : `${c} ${["", "極狭", "狭い", "中", "広い", "極広"][Number(c)]}` : clip(c, 12)}
            </text>
          </g>
        ))}
        <line x1={padL} x2={W - padR} y1={padT} y2={padT} stroke="currentColor" className="text-border" />
        <line x1={padL} x2={padL} y1={padT} y2={padT + rowH * yCats.length} stroke="currentColor" className="text-border" />
        {xTicks.map((t) => (
          <text key={`x-${t.label}-${t.x}`} x={t.x} y={padT + rowH * yCats.length + 13} textAnchor="middle" className="fill-muted-foreground" fontSize={9}>{t.label}</text>
        ))}
        <text x={padL} y={H - 6} className="fill-muted-foreground" fontSize={9}>
          {view === "breadth" ? "X: 技術区分 / Y: 権利範囲の広さ" : "X: 出願年 / Y: 技術区分"}
        </text>

        {placed.map(({ a, cx, cy }) => (
          <circle
            key={a.ip_asset_id}
            cx={cx}
            cy={cy}
            r={explicitAssessment ? importanceAssessed ? 3+(a.importance??3)*0.6 : 5.2 : 2.5 + (a.importance ?? 3) * 0.9}
            fill={RELATION_META[a.relation].hex}
            fillOpacity={hover && hover.ip_asset_id !== a.ip_asset_id ? 0.25 : 0.72}
            stroke={RELATION_META[a.relation].hex}
            strokeWidth={1}
            className="cursor-pointer"
            onMouseEnter={() => onHover(a)}
            onMouseLeave={() => onHover(null)}
            onClick={print ? undefined : () => onSelect(a)}
            role={explicitAssessment && !print ? "button" : undefined}
            tabIndex={explicitAssessment && !print ? 0 : undefined}
            aria-label={explicitAssessment && !print ? `特許の詳細：${a.title}` : undefined}
            onFocus={explicitAssessment && !print ? () => onHover(a) : undefined}
            onBlur={explicitAssessment && !print ? () => onHover(null) : undefined}
            onKeyDown={explicitAssessment && !print ? event => {if(event.key === "Enter" || event.key === " "){event.preventDefault();onSelect(a);}} : undefined}
          >
            <title>{`${a.title} / ${RELATION_META[a.relation].label}${a.applicants?.[0] ? ` / ${a.applicants[0]}` : ""}`}</title>
          </circle>
        ))}
      </svg>
      {hover && (
        <div className="pointer-events-none absolute left-2 top-2 max-w-[300px] rounded border border-border bg-background/95 px-2 py-1 text-[10px] shadow">
          <span className={`mr-1 rounded border px-1 py-0 ${RELATION_META[hover.relation].cls}`}>{RELATION_META[hover.relation].short}</span>
          <span className="font-medium">{hover.title}</span>
          {hover.applicants?.[0] && <span className="text-muted-foreground"> / {hover.applicants[0]}</span>}
        </div>
      )}
    </div>
  );
}

function ApplicantMatrix({
  assets, domains, onSelect, explicitAssessment = false, print = false,
}: {
  assets: IpAsset[];
  domains: string[];
  onSelect: (a: IpAsset) => void;
  explicitAssessment?: boolean;
  print?: boolean;
}) {
  const applicants = Array.from(new Set(explicitAssessment ? assets.flatMap(a=>a.applicants?.length?a.applicants:["出願人不明"]) : assets.map(applicantOf))).sort((a, b) => a.localeCompare(b, "ja"));
  const cell = (ap: string, dm: string) => assets.filter((a) => (explicitAssessment ? a.applicants?.length ? a.applicants.includes(ap) : ap === "出願人不明" : applicantOf(a) === ap) && domainOf(a) === dm);
  const max = Math.max(1, ...applicants.flatMap((ap) => domains.map((dm) => cell(ap, dm).length)));

  return (
    <div className="overflow-x-auto">
      <table data-amie-list="records" className="w-auto border-collapse text-[10px]">
        <thead>
          <tr>
            <th className="border border-border bg-muted/30 px-1.5 py-0.5 text-left font-medium">出願人 \ 技術区分</th>
            {domains.map((d) => (
              <th key={d} className="border border-border bg-muted/30 px-1.5 py-0.5 font-medium">{clip(d, 8)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {applicants.map((ap) => (
            <tr key={ap}>
              <th className="border border-border bg-muted/10 px-1.5 py-0.5 text-left font-medium">{clip(ap, 14)}</th>
              {domains.map((d) => {
                const list = cell(ap, d);
                const hex = list.length ? RELATION_META[list[0].relation].hex : null;
                return (
                  <td
                    key={d}
                    className={`border border-border px-1.5 py-0.5 text-center tabular-nums ${list.length ? "cursor-pointer" : "text-muted-foreground/40"}`}
                    style={hex ? { background: `${hex}${Math.round(24 + (list.length / max) * 96).toString(16).padStart(2, "0")}` } : undefined}
                    onClick={print ? undefined : () => list.length && onSelect(list[0])}
                    role={explicitAssessment && !print && list.length ? "button" : undefined}
                    tabIndex={explicitAssessment && !print && list.length ? 0 : undefined}
                    aria-label={explicitAssessment && !print && list.length ? `${ap}・${d}：${list.length}件` : undefined}
                    onKeyDown={explicitAssessment && !print && list.length ? event => {if(event.key === "Enter" || event.key === " "){event.preventDefault();onSelect(list[0]);}} : undefined}
                    title={list.map((a) => a.title).join(" / ")}
                  >{list.length || "・"}</td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
