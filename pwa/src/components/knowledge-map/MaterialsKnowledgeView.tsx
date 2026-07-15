"use client";

import { useMemo, useState, type CSSProperties } from "react";
import {
  ArrowRight,
  Atom,
  ChartNoAxesCombined,
  CircleDot,
  Clock3,
  Columns3,
  ExternalLink,
  FlaskConical,
  Gem,
  LayoutDashboard,
  Maximize2,
  Minimize2,
  Network,
  PieChart,
  Plus,
  Recycle,
  Scale,
  Search,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  TriangleAlert,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { KnowledgeMapData } from "@/lib/knowledge-map-data";
import {
  ELEMENTS,
  compareMaterialTotalScore,
  FAMILY_LABELS,
  HEAT_AXIS_LABELS,
  MATERIALS,
  MINERALS,
  POLYMERS,
  materialTotalScore,
  type ElementRecord,
  type HeatAxis,
  type HeatLevel,
  type MaterialDetail,
  type MaterialFamily,
} from "@/lib/materials-data";
import { KnowledgeMapView } from "./KnowledgeMapView";

type WorkspaceTab = "overview" | "elements" | "minerals" | "polymers" | "map" | "compare";

const TABS: Array<{ id: WorkspaceTab; label: string; icon: typeof Atom }> = [
  { id: "overview", label: "全体", icon: LayoutDashboard },
  { id: "elements", label: "元素", icon: Atom },
  { id: "minerals", label: "鉱物・鉱石", icon: Gem },
  { id: "polymers", label: "樹脂・高分子", icon: FlaskConical },
  { id: "map", label: "材料マップ", icon: Network },
  { id: "compare", label: "比較", icon: Columns3 },
];

const FAMILY_ACCENT: Record<MaterialFamily, string> = {
  element: "#245f73",
  mineral: "#a04d2a",
  polymer: "#6f5a91",
};

const HEAT_COLORS: Record<HeatAxis, Record<HeatLevel, { bg: string; border: string; text: string }>> = {
  heat: {
    1: { bg: "#fff8cc", border: "#e4d36f", text: "#514a1b" },
    2: { bg: "#ffe45e", border: "#e5bd19", text: "#503c00" },
    3: { bg: "#ffad1f", border: "#df7f00", text: "#4b2500" },
    4: { bg: "#ff5a1f", border: "#d83a0b", text: "#fffaf5" },
    5: { bg: "#e0002b", border: "#9f001f", text: "#ffffff" },
  },
  demand: {
    1: { bg: "#edf3f4", border: "#cfdee0", text: "#405b60" },
    2: { bg: "#d3e4e7", border: "#a8c8ce", text: "#244f57" },
    3: { bg: "#98c4cd", border: "#69a5b0", text: "#163f47" },
    4: { bg: "#4f93a2", border: "#327684", text: "#f7ffff" },
    5: { bg: "#245f73", border: "#184656", text: "#f7ffff" },
  },
  supplyRisk: {
    1: { bg: "#fff7d6", border: "#e7d7a0", text: "#55491f" },
    2: { bg: "#ffe08a", border: "#d9b44b", text: "#533c00" },
    3: { bg: "#ffad42", border: "#dd7920", text: "#4d2400" },
    4: { bg: "#ff621f", border: "#d63d0b", text: "#ffffff" },
    5: { bg: "#d90429", border: "#93001c", text: "#ffffff" },
  },
  amdFit: {
    1: { bg: "#edf4ef", border: "#d2e2d7", text: "#435c4c" },
    2: { bg: "#d3e5da", border: "#aacbbb", text: "#285441" },
    3: { bg: "#99c6ad", border: "#6ba486", text: "#173f2f" },
    4: { bg: "#4f9675", border: "#33775b", text: "#f5fff9" },
    5: { bg: "#26664d", border: "#174b38", text: "#f5fff9" },
  },
};

const HEAT_LEVEL_LABELS: Record<HeatAxis, Record<HeatLevel, string>> = {
  heat: { 1: "低め", 2: "観測", 3: "上昇", 4: "高い", 5: "最注目" },
  demand: { 1: "限定", 2: "安定", 3: "拡大", 4: "強い", 5: "非常に強い" },
  supplyRisk: { 1: "安定", 2: "注意", 3: "警戒", 4: "高リスク", 5: "供給危機" },
  amdFit: { 1: "限定", 2: "周辺", 3: "関連", 4: "強い", 5: "中核" },
};

function heatStyle(axis: HeatAxis, level?: HeatLevel): CSSProperties {
  if (!level) {
    return {
      color: "#71717a",
      borderColor: "#d6d3d1",
      backgroundColor: "#f5f3ef",
      backgroundImage: "repeating-linear-gradient(135deg, transparent 0 7px, rgba(120,113,108,.10) 7px 8px)",
    };
  }
  const color = HEAT_COLORS[axis][level];
  return { color: color.text, borderColor: color.border, backgroundColor: color.bg };
}

function supplyAlertBorder(level?: HeatLevel): CSSProperties {
  if (level === 5) return { borderTopColor: "#171717", borderTopWidth: 5 };
  if (level === 4) return { borderTopColor: "#ffbf00", borderTopWidth: 5 };
  return {};
}

function axisIcon(axis: HeatAxis) {
  if (axis === "demand") return TrendingUp;
  if (axis === "supplyRisk") return ShieldAlert;
  if (axis === "amdFit") return Sparkles;
  return CircleDot;
}

export function MaterialsKnowledgeView({ knowledgeData }: { knowledgeData: KnowledgeMapData }) {
  const [tab, setTab] = useState<WorkspaceTab>("overview");
  const [axis, setAxis] = useState<HeatAxis>("heat");
  const [selectedId, setSelectedId] = useState("element-li");
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [elementDialogOpen, setElementDialogOpen] = useState(false);
  const [elementDialogExpanded, setElementDialogExpanded] = useState(false);

  const selected = MATERIALS.find((item) => item.id === selectedId) ?? MATERIALS[0];
  const selectedElement = ELEMENTS.find((item) => item.detail?.id === selectedId);
  const compareItems = compareIds
    .map((id) => MATERIALS.find((item) => item.id === id))
    .filter((item): item is MaterialDetail => Boolean(item))
    .sort(compareMaterialTotalScore);

  const selectMaterial = (item: MaterialDetail, nextTab?: WorkspaceTab) => {
    setSelectedId(item.id);
    if (nextTab) setTab(nextTab);
    if (item.family === "element" && nextTab === "elements") {
      setElementDialogExpanded(false);
      setElementDialogOpen(true);
    }
  };

  const selectElement = (id: string) => {
    setSelectedId(id);
    setElementDialogExpanded(false);
    setElementDialogOpen(true);
  };

  const toggleCompare = (id: string) => {
    setCompareIds((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= 4) return current;
      return [...current, id];
    });
  };

  return (
    <main className="min-h-[calc(100vh-2.75rem)] bg-[#f3efe7] text-[#1d2425]">
      <div className="mx-auto flex w-full max-w-[1760px] flex-col gap-4 px-3 py-4 sm:px-5 lg:px-6">
        <header className="border-b border-[#cfc8bc] pb-5">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6b6f6b]">
                <span className="border border-[#aaa397] bg-[#fbf8f2] px-2.5 py-1 font-mono text-[#374244]">
                  AMD / Materials Intelligence
                </span>
                <span>初期評価 · 2026-07-15</span>
                <span className="normal-case tracking-normal">read-only / 質問機能なし</span>
              </div>
              <h1 className="text-balance text-3xl font-semibold tracking-[-0.035em] text-[#172022] sm:text-4xl">
                元素から用途まで、材料の勝ち筋を掘る。
              </h1>
              <p className="mt-3 max-w-4xl text-sm leading-7 text-[#5d625f] sm:text-[15px]">
                周期表、鉱物・鉱石、樹脂・高分子を、需要・供給不安・代替・循環性・AMDとの接点で横断する。
                色は初期の定性評価。未評価を低評価として扱わない。
              </p>
            </div>
            <div className="grid grid-cols-3 border border-[#c9c1b4] bg-[#faf7f1]">
              <HeaderMetric value="118" label="元素" />
              <HeaderMetric value={String(MINERALS.length)} label="鉱物・原料" />
              <HeaderMetric value={String(POLYMERS.length)} label="樹脂" />
            </div>
          </div>
        </header>

        <nav aria-label="材料ビュー" className="overflow-x-auto border-b border-[#cfc8bc]">
          <div className="flex min-w-max items-end gap-1">
            {TABS.map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-11 items-center gap-2 border-b-2 px-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#245f73] focus-visible:ring-offset-2",
                    active
                      ? "border-[#245f73] bg-[#fbf8f2] text-[#173f49]"
                      : "border-transparent text-[#696b66] hover:border-[#aaa397] hover:text-[#1d2425]"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                  {item.id === "compare" && compareIds.length > 0 && (
                    <span className="grid h-5 min-w-5 place-items-center bg-[#245f73] px-1 font-mono text-[10px] text-white">
                      {compareIds.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        {selected && tab !== "map" && (
          <section className="border border-[#c9c1b4] bg-[#262f31] px-3 py-3 text-[#f7f3e9] sm:px-4" aria-label="選択中の材料チェーン">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#b9c9c7]">material chain</span>
              <span className="font-mono text-xs font-semibold text-white">{selected.code}</span>
              {selected.chain.map((step, index) => (
                <span key={`${selected.id}-${step}`} className="inline-flex items-center gap-2 text-xs">
                  {index > 0 && <ArrowRight className="h-3.5 w-3.5 text-[#d0a15f]" />}
                  <span className={index === selected.chain.length - 1 ? "font-semibold text-[#f7d393]" : "text-[#dde4e1]"}>{step}</span>
                </span>
              ))}
            </div>
          </section>
        )}

        {tab === "overview" && <Overview onSelect={selectMaterial} />}
        {tab === "elements" && (
          <ElementsView
            axis={axis}
            onAxisChange={setAxis}
            selectedId={selectedId}
            onSelect={selectElement}
          />
        )}
        {tab === "minerals" && (
          <MaterialCatalogue
            title="鉱物・鉱石・原料"
            description="元素名だけでは見えない、採掘形態・副産物構造・精製工程を掘る。"
            items={MINERALS}
            selectedId={selectedId}
            onSelect={setSelectedId}
            compareIds={compareIds}
            onToggleCompare={toggleCompare}
          />
        )}
        {tab === "polymers" && (
          <MaterialCatalogue
            title="樹脂・高分子"
            description="原料、物性、用途、規制、循環性を一続きのchainとして見る。"
            items={POLYMERS}
            selectedId={selectedId}
            onSelect={setSelectedId}
            compareIds={compareIds}
            onToggleCompare={toggleCompare}
          />
        )}
        {tab === "map" && <KnowledgeMapView data={knowledgeData} embedded />}
        {tab === "compare" && <CompareView items={compareItems} onRemove={toggleCompare} />}

        {compareItems.length > 0 && tab !== "compare" && (
          <CompareTray items={compareItems} onRemove={toggleCompare} onOpen={() => setTab("compare")} />
        )}

        {selectedElement?.detail && (
          <ElementInsightDialog
            element={selectedElement}
            open={elementDialogOpen}
            expanded={elementDialogExpanded}
            onOpenChange={(open) => {
              setElementDialogOpen(open);
              if (!open) setElementDialogExpanded(false);
            }}
            onExpandedChange={setElementDialogExpanded}
            isCompared={compareIds.includes(selectedElement.detail.id)}
            compareFull={compareIds.length >= 4}
            onToggleCompare={toggleCompare}
          />
        )}
      </div>
    </main>
  );
}

function HeaderMetric({ value, label }: { value: string; label: string }) {
  return (
    <div className="min-w-[92px] border-r border-[#c9c1b4] px-3 py-3 last:border-r-0 sm:min-w-[112px]">
      <div className="font-mono text-xl font-semibold leading-none text-[#172022]">{value}</div>
      <div className="mt-1 text-[11px] font-medium text-[#6a6a64]">{label}</div>
    </div>
  );
}

function Overview({ onSelect }: { onSelect: (item: MaterialDetail, tab?: WorkspaceTab) => void }) {
  const leaders = [...MATERIALS].sort(compareMaterialTotalScore).slice(0, 8);
  const topMineral = [...MINERALS].sort(compareMaterialTotalScore)[0];
  const topPolymer = [...POLYMERS].sort(compareMaterialTotalScore)[0];
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="space-y-4">
        <section className="border border-[#c9c1b4] bg-[#fbf8f2]">
          <div className="grid gap-0 lg:grid-cols-3">
            <FamilyEntry icon={Atom} kicker="118 元素" title="元素周期表" text="4つの評価軸で全体を走査。18元素は用途・供給・埋蔵・需給まで初期評価済み。" onClick={() => onSelect(MATERIALS[0], "elements")} />
            <FamilyEntry icon={Gem} kicker={`${MINERALS.length} 原料`} title="鉱物・鉱石" text="スポジュメン、かん水、黒鉛、希土類鉱物、リン鉱石まで原料から用途まで追う。" onClick={() => onSelect(topMineral, "minerals")} />
            <FamilyEntry icon={FlaskConical} kicker={`${POLYMERS.length} 樹脂`} title="樹脂・高分子" text="汎用樹脂からPEEK・PIまで、原料・作り方・循環性を含めて比較する。" onClick={() => onSelect(topPolymer, "polymers")} />
          </div>
        </section>

        <section className="border border-[#c9c1b4] bg-[#fbf8f2]">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#d7d0c5] px-4 py-4">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#8b6b45]">4指標の合計ランキング</div>
              <h2 className="mt-1 text-xl font-semibold tracking-[-0.02em]">いま全体を見渡すなら、ここから。</h2>
            </div>
            <span className="text-xs text-[#77736c]">注目・需要・供給不安・AMD相性の合計（20点満点）</span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4">
            {leaders.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item, item.family === "element" ? "elements" : item.family === "mineral" ? "minerals" : "polymers")}
                className="min-h-[156px] border-b border-r border-[#d7d0c5] p-4 text-left transition hover:bg-[#f4eee4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#245f73]"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="font-mono text-lg font-semibold" style={{ color: FAMILY_ACCENT[item.family] }}>{item.code}</span>
                  <TotalScore item={item} compact />
                </div>
                <div className="mt-3 text-sm font-semibold text-[#20292a]">{item.name}</div>
                <p className="mt-2 line-clamp-3 text-xs leading-5 text-[#666761]">{item.summary}</p>
              </button>
            ))}
          </div>
        </section>
      </div>

      <aside className="border border-[#c9c1b4] bg-[#eee7db] p-4 sm:p-5">
        <div className="flex items-center gap-2 text-[#684421]">
          <Scale className="h-4 w-4" />
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em]">How to read</span>
        </div>
        <h2 className="mt-3 text-xl font-semibold tracking-[-0.02em]">“元素がhot”だけで判断しない。</h2>
        <div className="mt-5 space-y-5">
          <ReadRule number="01" title="commodityを分ける" text="元素、鉱物、精製品、材料grade、最終製品は別の市場。Liとbattery-grade LiOHを同じにしない。" />
          <ReadRule number="02" title="未評価を0にしない" text="斜線cellは低需要ではなく、AMD初期評価がまだない状態。周期表の空白を断定に使わない。" />
          <ReadRule number="03" title="埋蔵量よりbottleneckを見る" text="鉱石が豊富でも、分離・精製・認証・副産物構造で供給が詰まる。chain全体で比較する。" />
          <ReadRule number="04" title="一次資料へ戻る" text="精密な数量や調達判断はUSGS・IEA・EU RMIS・JOGMECの最新版で再確認する。" />
        </div>
      </aside>
    </div>
  );
}

function FamilyEntry({ icon: Icon, kicker, title, text, onClick }: { icon: typeof Atom; kicker: string; title: string; text: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={`${title}を開く`} className="group min-h-[188px] cursor-pointer border-b border-r border-[#d7d0c5] p-5 text-left transition-colors hover:bg-[#f1ebe1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#245f73] active:bg-[#e9e0d3] last:border-r-0 lg:border-b-0">
      <div className="flex items-center">
        <span className="grid h-10 w-10 place-items-center border border-[#a9a297] bg-[#f3eee6] text-[#245f73]"><Icon className="h-5 w-5" /></span>
      </div>
      <div className="mt-5 font-mono text-[10px] uppercase tracking-[0.15em] text-[#89725b]">{kicker}</div>
      <h2 className="mt-1 text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-xs leading-5 text-[#666761]">{text}</p>
    </button>
  );
}

function ReadRule({ number, title, text }: { number: string; title: string; text: string }) {
  return (
    <div className="grid grid-cols-[32px_1fr] gap-3 border-t border-[#cbc1b2] pt-4 first:border-t-0 first:pt-0">
      <span className="font-mono text-xs font-semibold text-[#9b623a]">{number}</span>
      <div><h3 className="text-sm font-semibold">{title}</h3><p className="mt-1 text-xs leading-5 text-[#66635d]">{text}</p></div>
    </div>
  );
}

function ElementsView({ axis, onAxisChange, selectedId, onSelect }: { axis: HeatAxis; onAxisChange: (axis: HeatAxis) => void; selectedId: string; onSelect: (id: string) => void }) {
  const crisisElements = ELEMENTS.filter((item) => item.detail?.scores.supplyRisk === 5);
  const warningElements = ELEMENTS.filter((item) => item.detail?.scores.supplyRisk === 4);
  return (
    <div className="space-y-4">
      <section className="min-w-0 border border-[#c9c1b4] bg-[#fbf8f2]">
        <div className="border-b border-[#d7d0c5] p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">元素周期表</h2>
              <p className="mt-1 text-xs text-[#6c6d68]">色で勢い、セル内で主用途、上端の警報で供給危機を見る。押すと根拠まで掘れる。</p>
            </div>
            <div className="flex flex-wrap gap-1" aria-label="ヒートマップ評価軸">
              {(Object.keys(HEAT_AXIS_LABELS) as HeatAxis[]).map((item) => {
                const Icon = axisIcon(item);
                return (
                  <button key={item} type="button" onClick={() => onAxisChange(item)} aria-pressed={axis === item} className={cn("flex h-10 items-center gap-1.5 border px-3 text-xs font-semibold transition", axis === item ? "border-[#245f73] bg-[#245f73] text-white" : "border-[#c9c1b4] bg-white text-[#5c625f] hover:border-[#7d827d]") }>
                    <Icon className="h-3.5 w-3.5" />{HEAT_AXIS_LABELS[item]}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[10px] text-[#676963]">
            <span className="font-semibold">{HEAT_AXIS_LABELS[axis]}</span>
            {([1,2,3,4,5] as HeatLevel[]).map((level) => (
              <span key={level} className="inline-flex items-center gap-1.5">
                <i className="h-3.5 w-6 border" style={heatStyle(axis, level)} />
                {HEAT_LEVEL_LABELS[axis][level]}
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5"><i className="h-3.5 w-6 border" style={heatStyle(axis)} />未評価</span>
          </div>
        </div>
        <div className="grid border-b border-[#93001c] bg-[#fff4f2] lg:grid-cols-[190px_minmax(0,1fr)]">
          <div className="flex items-center gap-2 bg-[#d90429] px-4 py-3 text-white">
            <TriangleAlert className="h-4 w-4" />
            <span className="text-sm font-bold">供給警報</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-xs">
            <span className="font-bold text-[#a30020]">供給危機 {crisisElements.length}元素</span>
            <span className="text-[#6d3038]">{crisisElements.map((item) => item.name).join("・")}</span>
            <span className="border-l border-[#d6a8a9] pl-4 font-semibold text-[#9a5a00]">要警戒 {warningElements.length}元素</span>
          </div>
        </div>
        <div className="overflow-x-auto p-3 sm:p-4" tabIndex={0} aria-label="周期表 横スクロール領域">
          <div className="grid min-w-[1080px] grid-cols-[repeat(18,minmax(56px,1fr))] grid-rows-[repeat(9,86px)] gap-1">
            {ELEMENTS.map((element) => {
              const level = element.detail?.scores[axis];
              const supplyRisk = element.detail?.scores.supplyRisk;
              const isSelected = element.detail?.id === selectedId;
              const evaluationLabel = level ? HEAT_LEVEL_LABELS[axis][level] : "未評価";
              const alertLabel = supplyRisk === 5 ? "危機" : supplyRisk === 4 ? "警戒" : undefined;
              const accessibleSummary = [
                `${element.atomicNumber} ${element.name}`,
                `${HEAT_AXIS_LABELS[axis]} ${evaluationLabel}`,
                element.glanceUse ? `主用途 ${element.glanceUse}` : undefined,
                alertLabel && element.supplyAlert ? `供給${alertLabel} ${element.supplyAlert}` : undefined,
              ].filter(Boolean).join("、");
              return (
                <button
                  key={element.symbol}
                  type="button"
                  onClick={() => element.detail && onSelect(element.detail.id)}
                  disabled={!element.detail}
                  aria-label={accessibleSummary}
                  title={accessibleSummary}
                  className={cn("relative min-h-[82px] min-w-[56px] overflow-hidden border p-1 text-left transition focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#172022]", element.detail ? "cursor-pointer hover:-translate-y-0.5" : "cursor-not-allowed", isSelected && "z-10 ring-2 ring-[#172022] ring-offset-1")}
                  style={{ ...heatStyle(axis, level), ...supplyAlertBorder(supplyRisk), gridColumn: element.displayColumn, gridRow: element.displayRow }}
                >
                  <span className="block font-mono text-[8px] font-semibold opacity-75">{element.atomicNumber}</span>
                  {alertLabel && (
                    <span className={cn("absolute right-0 top-0 inline-flex h-4 items-center gap-0.5 px-1 text-[8px] font-bold", supplyRisk === 5 ? "bg-[#171717] text-[#ffe45e]" : "bg-[#ffbf00] text-[#4b2600]") }>
                      <ShieldAlert className="h-2.5 w-2.5" />{alertLabel}
                    </span>
                  )}
                  <span className="mt-0.5 block font-mono text-lg font-bold leading-none">{element.symbol}</span>
                  <span className="mt-1 block truncate text-[9px] font-semibold">{element.name}</span>
                  {element.glanceUse ? (
                    <span className="mt-1 block border-t border-current/25 pt-1 text-[8px] font-bold leading-[1.2]">{element.glanceUse}</span>
                  ) : (
                    <span className="mt-1 block text-[8px] font-medium opacity-65">未評価</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

function ElementInsightDialog({
  element,
  open,
  expanded,
  onOpenChange,
  onExpandedChange,
  isCompared,
  compareFull,
  onToggleCompare,
}: {
  element: ElementRecord;
  open: boolean;
  expanded: boolean;
  onOpenChange: (open: boolean) => void;
  onExpandedChange: (expanded: boolean) => void;
  isCompared: boolean;
  compareFull: boolean;
  onToggleCompare: (id: string) => void;
}) {
  const item = element.detail;
  if (!item) return null;
  const alertLabel = item.scores.supplyRisk === 5 ? "供給危機" : item.scores.supplyRisk === 4 ? "要警戒" : "供給監視";
  const market = item.market;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "!grid !max-h-[calc(100vh-1rem)] !w-[calc(100vw-1rem)] !max-w-[760px] !gap-0 !overflow-y-auto !rounded-none !bg-[#fbf8f2] !p-0 !text-[#1d2425] shadow-[0_24px_80px_rgba(24,28,29,.28)] transition-[max-width] duration-200",
          expanded && "!max-w-[1180px]"
        )}
      >
        <header className="sticky top-0 z-10 border-b border-[#c9c1b4] bg-[#fbf8f2]/95 px-4 py-4 backdrop-blur sm:px-6">
          <div className="flex items-start gap-4">
            <div className="grid h-16 w-16 shrink-0 place-items-center border border-[#245f73] bg-[#245f73] text-white">
              <span className="font-mono text-3xl font-bold leading-none">{element.symbol}</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#766f65]">元素 {element.atomicNumber}</span>
                <span className={cn("px-2 py-1 text-[10px] font-bold", item.scores.supplyRisk === 5 ? "bg-[#171717] text-[#ffe45e]" : item.scores.supplyRisk === 4 ? "bg-[#ffbf00] text-[#4b2600]" : "bg-[#e5e1d8] text-[#555852]")}>{alertLabel}</span>
                <TotalScore item={item} compact />
              </div>
              <DialogTitle className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[#172022]">{item.name}</DialogTitle>
              <DialogDescription className="mt-1 text-xs text-[#6b6d67]">{item.category} · {element.glanceUse}</DialogDescription>
            </div>
            <DialogClose render={<button type="button" className="grid h-11 w-11 shrink-0 place-items-center border border-[#bdb5a8] bg-white text-[#535956] transition hover:border-[#172022] hover:text-[#172022] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#245f73]" aria-label="閉じる" />}>
              <X className="h-4 w-4" />
            </DialogClose>
          </div>
        </header>

        <div className="p-4 sm:p-6">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1.25fr)_minmax(260px,.75fr)]">
            <section className="order-1 border border-[#cfc7ba] bg-white p-4 sm:p-5">
              <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8b6b45]">何に使う元素か</div>
              <p className="mt-3 text-sm leading-6 text-[#4f5552]">{item.summary}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {item.uses.slice(0, 4).map((use) => <span key={use} className="border border-[#c9c1b4] bg-[#f2ede5] px-2.5 py-1.5 text-xs font-medium text-[#464d4a]">{use}</span>)}
              </div>
              <div className={cn("mt-5 border-l-4 px-3 py-3 text-xs leading-5", item.scores.supplyRisk === 5 ? "border-[#d90429] bg-[#fff0ef] text-[#6f202a]" : "border-[#e0a100] bg-[#fff8df] text-[#6d5217]") }>
                <span className="font-bold">{alertLabel}</span>
                <span className="ml-2">{element.supplyAlert}。{item.balance}</span>
              </div>
            </section>

            <section className="order-3 border border-[#cfc7ba] bg-[#efe8dc] p-4 sm:order-3 sm:p-5 md:order-2">
              <div className="flex items-center gap-2 text-[#704f2d]"><PieChart className="h-4 w-4" /><h3 className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em]">産出国構成</h3></div>
              {market ? <SupplyPie market={market} /> : <p className="mt-4 text-xs text-[#686b66]">構成比を確認できる公表データを整備中。</p>}
            </section>
            {market && <MarketTape market={market} className="order-2 md:col-span-2 md:order-3" />}
          </div>

          {expanded && (
            <div className="mt-4 border border-[#c9c1b4] bg-white">
              <div className="grid grid-cols-4 border-b border-[#d7d0c5]"><MiniScore label="注目" value={item.scores.heat} reason={item.scoreReasons.heat} /><MiniScore label="需要" value={item.scores.demand} reason={item.scoreReasons.demand} /><MiniScore label="供給" value={item.scores.supplyRisk} reason={item.scoreReasons.supplyRisk} /><MiniScore label="AMD" value={item.scores.amdFit} reason={item.scoreReasons.amdFit} /></div>
              <div className="grid divide-y divide-[#ddd6cb] lg:grid-cols-2 lg:divide-x lg:divide-y-0">
                <div className="divide-y divide-[#ddd6cb]">
                  <DetailSection title="特徴"><TagList items={item.properties} /></DetailSection>
                  <DetailSection title="埋蔵・供給の見方"><p className="text-xs leading-5 text-[#5d625f]">{item.reserves}</p></DetailSection>
                  <DetailSection title="需給バランス"><p className="text-xs leading-5 text-[#5d625f]">{item.balance}</p></DetailSection>
                </div>
                <div className="divide-y divide-[#ddd6cb]">
                  <DetailSection title="循環・代替"><div className="flex gap-2"><Recycle className="mt-0.5 h-4 w-4 shrink-0 text-[#397559]" /><p className="text-xs leading-5 text-[#5d625f]">{item.circularity}</p></div></DetailSection>
                  <DetailSection title="AMDとの接点"><p className="text-xs font-medium leading-5 text-[#314f4a]">{item.amdFitNote}</p></DetailSection>
                  <DetailSection title="出典"><div className="space-y-2">{[...(market ? [market.source] : []), ...item.sources].filter((source, index, sources) => sources.findIndex((candidate) => candidate.href === source.href) === index).map((source) => <a key={source.href} href={source.href} target="_blank" rel="noreferrer" className="flex min-h-11 items-center justify-between gap-3 border border-[#d0c8bb] bg-[#faf8f3] px-3 py-2 text-xs font-semibold text-[#315b63] transition hover:border-[#245f73]"><span className="min-w-0">{source.label}<small className="mt-0.5 block font-normal text-[#7a7871]">{source.asOf}</small></span><ExternalLink className="h-3.5 w-3.5 shrink-0" /></a>)}</div></DetailSection>
                </div>
              </div>
            </div>
          )}
        </div>

        <footer className="sticky bottom-0 z-10 flex flex-col gap-2 border-t border-[#c9c1b4] bg-[#f3eee6]/95 p-3 backdrop-blur sm:flex-row sm:items-center sm:justify-end sm:px-6">
          <button type="button" onClick={() => onToggleCompare(item.id)} aria-pressed={isCompared} disabled={!isCompared && compareFull} className={cn("inline-flex h-11 items-center justify-center gap-2 border px-4 text-sm font-semibold transition", isCompared ? "border-[#245f73] bg-white text-[#245f73]" : "border-[#9f988c] bg-white text-[#293233] hover:border-[#245f73]", !isCompared && compareFull && "cursor-not-allowed opacity-45") }>
            {isCompared ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{isCompared ? "比較から外す" : compareFull ? "比較は4件まで" : "比較に追加"}
          </button>
          <button type="button" onClick={() => onExpandedChange(!expanded)} className="inline-flex h-11 items-center justify-center gap-2 bg-[#245f73] px-5 text-sm font-bold text-white transition hover:bg-[#194d5d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#245f73] focus-visible:ring-offset-2">
            {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}{expanded ? "要点だけに戻す" : "詳細を開く"}
          </button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}

const PIE_COLORS = ["#245f73", "#b76538", "#d9a64f", "#587e72", "#8b6b45", "#b9b1a5"];

function SupplyPie({ market }: { market: NonNullable<MaterialDetail["market"]> }) {
  const stops = market.supplyShares.map((slice, index, shares) => {
    const start = shares.slice(0, index).reduce((total, item) => total + item.share, 0);
    const end = start + slice.share;
    return `${PIE_COLORS[index % PIE_COLORS.length]} ${start}% ${end}%`;
  }).join(", ");
  return (
    <div className="mt-4 grid grid-cols-[104px_minmax(0,1fr)] items-center gap-4">
      <div role="img" aria-label={`${market.supplyBasis}: ${market.supplyShares.map((slice) => `${slice.country} ${slice.share}%`).join("、")}`} className="aspect-square w-[104px] rounded-full border-4 border-white shadow-sm" style={{ backgroundImage: `conic-gradient(${stops})` }} />
      <div className="min-w-0 space-y-1.5">
        {market.supplyShares.map((slice, index) => (
          <div key={slice.country} className="grid grid-cols-[10px_minmax(0,1fr)_auto] items-center gap-2 text-[11px]">
            <i className="h-2.5 w-2.5" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
            <span className="truncate text-[#555a56]">{slice.country}</span>
            <span className="font-mono font-semibold tabular-nums text-[#303837]">{slice.share}%</span>
          </div>
        ))}
      </div>
      <p className="col-span-2 text-[10px] leading-4 text-[#79756d]">{market.supplyBasis}</p>
    </div>
  );
}

function MarketTape({ market, className }: { market: NonNullable<MaterialDetail["market"]>; className?: string }) {
  const latest = market.series.at(-1)!;
  const previous = market.series.at(-2)!;
  const change = ((latest.value - previous.value) / previous.value) * 100;
  return (
    <section className={cn("border border-[#172022] bg-[#172022] text-white", className)}>
      <div className="grid gap-0 lg:grid-cols-[250px_minmax(0,1fr)]">
        <div className="border-b border-[#4b5657] p-4 lg:border-b-0 lg:border-r sm:p-5">
          <div className="flex items-center gap-2 text-[#b9c9c7]"><ChartNoAxesCombined className="h-4 w-4" /><span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em]">直近公表相場</span></div>
          <div className="mt-4 font-mono text-3xl font-semibold tabular-nums text-white">{formatMarketValue(latest.value)}</div>
          <div className="mt-1 text-xs text-[#cbd5d2]">{market.unit}</div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className={cn("px-2 py-1 font-mono text-xs font-bold", change > 0 ? "bg-[#ffdfd9] text-[#9f1e1e]" : change < 0 ? "bg-[#d8eee5] text-[#185b43]" : "bg-[#e8e5df] text-[#4e5350]")}>{change > 0 ? "+" : ""}{change.toFixed(1)}%</span>
            <span className="text-[11px] text-[#b7c2bf]">前年比</span>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-[10px] text-[#9eaeaa]"><Clock3 className="h-3.5 w-3.5" />{market.source.asOf}</div>
        </div>
        <div className="min-w-0 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div><h3 className="text-sm font-semibold">{market.benchmark}</h3><p className="mt-1 text-[10px] text-[#9eaeaa]">5年推移</p></div>
            <a href={market.source.href} target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center gap-1.5 border border-[#5b6869] px-2.5 text-[10px] font-semibold text-[#d6dfdc] transition hover:border-[#d7a45f] hover:text-white">出典を見る<ExternalLink className="h-3 w-3" /></a>
          </div>
          <MarketTrendChart market={market} />
          <p className="mt-2 text-[10px] leading-4 text-[#aebbb8]">{market.note} ライブ配信値ではない。</p>
        </div>
      </div>
    </section>
  );
}

function MarketTrendChart({ market }: { market: NonNullable<MaterialDetail["market"]> }) {
  const width = 480;
  const height = 120;
  const left = 12;
  const right = 12;
  const top = 12;
  const bottom = 24;
  const values = market.series.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);
  const points = market.series.map((point, index) => {
    const x = left + (index / Math.max(market.series.length - 1, 1)) * (width - left - right);
    const y = top + ((max - point.value) / range) * (height - top - bottom);
    return { ...point, x, y };
  });
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="mt-3 h-[120px] w-full" role="img" aria-label={`${market.benchmark}の5年推移: ${market.series.map((point) => `${point.period}年 ${formatMarketValue(point.value)}`).join("、")}`}>
      {[0, 0.5, 1].map((ratio) => <line key={ratio} x1={left} x2={width - right} y1={top + ratio * (height - top - bottom)} y2={top + ratio * (height - top - bottom)} stroke="#465254" strokeWidth="1" />)}
      <polyline points={points.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke="#f0bb69" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((point, index) => <g key={point.period}><circle cx={point.x} cy={point.y} r={index === points.length - 1 ? 5 : 3} fill={index === points.length - 1 ? "#e0002b" : "#f0bb69"} stroke="#172022" strokeWidth="2"><title>{point.period}年 {formatMarketValue(point.value)} {market.unit}</title></circle><text x={point.x} y={height - 5} textAnchor="middle" fill="#aebbb8" fontSize="10" fontFamily="monospace">{point.period}</text></g>)}
    </svg>
  );
}

function formatMarketValue(value: number) {
  return new Intl.NumberFormat("ja-JP", { maximumFractionDigits: value < 10 ? 2 : value < 1000 ? 1 : 0 }).format(value);
}

function MaterialCatalogue({ title, description, items, selectedId, onSelect, compareIds, onToggleCompare }: { title: string; description: string; items: MaterialDetail[]; selectedId: string; onSelect: (id: string) => void; compareIds: string[]; onToggleCompare: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const ranked = useMemo(() => [...items].sort(compareMaterialTotalScore), [items]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return ranked;
    return ranked.filter((item) => [item.name,item.code,item.category,item.summary,...item.uses,...item.chain,item.manufacturing?.feedstock,item.manufacturing?.process].filter(Boolean).join(" ").toLowerCase().includes(needle));
  }, [query, ranked]);
  const selected = ranked.find((item) => item.id === selectedId) ?? filtered[0] ?? ranked[0];
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
      <section className="min-w-0 border border-[#c9c1b4] bg-[#fbf8f2]">
        <div className="grid gap-3 border-b border-[#d7d0c5] p-4 lg:grid-cols-[1fr_320px] lg:items-end">
          <div><h2 className="text-xl font-semibold">{title}</h2><p className="mt-1 text-xs leading-5 text-[#6b6c67]">{description}</p></div>
          <label className="relative block"><span className="sr-only">材料を検索</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#77766f]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="名前・用途・chainで検索" className="h-11 w-full border border-[#bdb5a8] bg-white pl-10 pr-3 text-sm outline-none focus:border-[#245f73] focus:ring-1 focus:ring-[#245f73]" /></label>
        </div>
        <div className="divide-y divide-[#d7d0c5]">
          {filtered.map((item) => (
            <button key={item.id} type="button" onClick={() => onSelect(item.id)} className={cn("grid w-full gap-3 px-4 py-4 text-left transition hover:bg-[#f4eee4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#245f73] md:grid-cols-[150px_minmax(0,1fr)_280px] md:items-center", selected?.id === item.id && "bg-[#eee7db]") }>
              <div className="min-w-0"><div className="font-mono text-sm font-semibold" style={{ color: FAMILY_ACCENT[item.family] }}>{item.code}</div><div className="mt-1 truncate text-sm font-semibold">{item.name}</div><div className="mt-1 text-[10px] text-[#797871]">{item.category}</div></div>
              <p className="line-clamp-2 text-xs leading-5 text-[#646660]">{item.summary}</p>
              <div className="grid grid-cols-[58px_minmax(0,1fr)] gap-2"><TotalScore item={item} compact /><div className="grid grid-cols-4 gap-1"><MiniScore label="注目" value={item.scores.heat} /><MiniScore label="需要" value={item.scores.demand} /><MiniScore label="供給" value={item.scores.supplyRisk} /><MiniScore label="AMD" value={item.scores.amdFit} /></div></div>
            </button>
          ))}
          {filtered.length === 0 && <div className="p-8 text-center text-sm text-[#73746f]">該当する材料がない。</div>}
        </div>
      </section>
      {selected && <MaterialDetailPanel item={selected} isCompared={compareIds.includes(selected.id)} compareFull={compareIds.length >= 4} onToggleCompare={onToggleCompare} />}
    </div>
  );
}

function MaterialDetailPanel({ item, isCompared, compareFull, onToggleCompare, wide = false }: { item: MaterialDetail; isCompared: boolean; compareFull: boolean; onToggleCompare: (id: string) => void; wide?: boolean }) {
  return (
    <aside className={cn("min-w-0 border border-[#c9c1b4] bg-[#fbf8f2]", !wide && "xl:sticky xl:top-4 xl:max-h-[calc(100vh-5rem)] xl:overflow-y-auto")}>
      <div className="border-b border-[#d7d0c5] p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4"><div><div className="font-mono text-2xl font-semibold" style={{ color: FAMILY_ACCENT[item.family] }}>{item.code}</div><div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7b776f]">{FAMILY_LABELS[item.family]} / {item.category}</div></div><TotalScore item={item} /></div>
        <h2 className="mt-4 text-xl font-semibold tracking-[-0.02em]">{item.name}</h2>
        <p className="mt-3 text-sm leading-6 text-[#5f625e]">{item.summary}</p>
        <button type="button" onClick={() => onToggleCompare(item.id)} aria-pressed={isCompared} disabled={!isCompared && compareFull} className={cn("mt-4 inline-flex h-11 w-full items-center justify-center gap-2 border text-sm font-semibold transition", isCompared ? "border-[#245f73] bg-[#245f73] text-white" : "border-[#9f988c] bg-white text-[#293233] hover:border-[#245f73]", !isCompared && compareFull && "cursor-not-allowed opacity-45") }>
          {isCompared ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{isCompared ? "比較から外す" : compareFull ? "比較は4件まで" : "比較に追加"}
        </button>
      </div>
      <div className="grid grid-cols-4 border-b border-[#d7d0c5]"><MiniScore label="注目" value={item.scores.heat} reason={item.scoreReasons.heat} /><MiniScore label="需要" value={item.scores.demand} reason={item.scoreReasons.demand} /><MiniScore label="供給" value={item.scores.supplyRisk} reason={item.scoreReasons.supplyRisk} /><MiniScore label="AMD" value={item.scores.amdFit} reason={item.scoreReasons.amdFit} /></div>
      <div className="divide-y divide-[#ddd6cb]">
        <DetailSection title="特徴"><TagList items={item.properties} /></DetailSection>
        <DetailSection title="主用途"><TagList items={item.uses} /></DetailSection>
        {item.manufacturing && <DetailSection title="原料と製造プロセス"><ManufacturingSummary manufacturing={item.manufacturing} /></DetailSection>}
        <DetailSection title="主要供給国（概ね上位順）"><ol className="space-y-1 text-xs leading-5 text-[#5d625f]">{item.supplyCountries.map((country) => <li key={country}>{country}</li>)}</ol></DetailSection>
        <DetailSection title="埋蔵・供給の見方"><p className="text-xs leading-5 text-[#5d625f]">{item.reserves}</p></DetailSection>
        <DetailSection title="需給balance"><p className="text-xs leading-5 text-[#5d625f]">{item.balance}</p></DetailSection>
        <DetailSection title="循環・代替"><div className="flex gap-2"><Recycle className="mt-0.5 h-4 w-4 shrink-0 text-[#397559]" /><p className="text-xs leading-5 text-[#5d625f]">{item.circularity}</p></div></DetailSection>
        <DetailSection title="AMDとの接点"><p className="text-xs font-medium leading-5 text-[#314f4a]">{item.amdFitNote}</p></DetailSection>
        <DetailSection title="source"><div className="space-y-2">{item.sources.map((source) => <a key={source.href} href={source.href} target="_blank" rel="noreferrer" className="flex min-h-11 items-center justify-between gap-3 border border-[#d0c8bb] bg-white px-3 py-2 text-xs font-semibold text-[#315b63] transition hover:border-[#245f73]"><span className="min-w-0">{source.label}<small className="mt-0.5 block font-normal text-[#7a7871]">{source.asOf}</small></span><ExternalLink className="h-3.5 w-3.5 shrink-0" /></a>)}</div></DetailSection>
      </div>
    </aside>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="p-4 sm:px-5"><h3 className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.13em] text-[#82796d]">{title}</h3>{children}</section>;
}

function TagList({ items }: { items: string[] }) {
  return <div className="flex flex-wrap gap-1.5">{items.map((item) => <span key={item} className="border border-[#cfc7ba] bg-[#f2ede5] px-2 py-1 text-[11px] text-[#555b58]">{item}</span>)}</div>;
}

function ManufacturingSummary({ manufacturing }: { manufacturing: NonNullable<MaterialDetail["manufacturing"]> }) {
  return <dl className="space-y-2 text-xs leading-5"><div className="grid grid-cols-[52px_minmax(0,1fr)] gap-2"><dt className="font-semibold text-[#7d6348]">原料</dt><dd className="text-[#555c59]">{manufacturing.feedstock}</dd></div><div className="grid grid-cols-[52px_minmax(0,1fr)] gap-2"><dt className="font-semibold text-[#7d6348]">作り方</dt><dd className="text-[#555c59]">{manufacturing.process}</dd></div></dl>;
}

function TotalScore({ item, compact = false }: { item: Pick<MaterialDetail, "scores">; compact?: boolean }) {
  const total = materialTotalScore(item);
  return <div aria-label={`4指標合計 ${total}点`} className={cn("shrink-0 border border-[#245f73] bg-[#e7efed] text-right", compact ? "px-2 py-1" : "px-3 py-2")}><div className={cn("font-mono font-semibold leading-none text-[#194f5e]", compact ? "text-sm" : "text-xl")}>{total}<span className="text-[10px] text-[#71817d]">/20</span></div><div className="mt-1 text-[9px] font-semibold text-[#5e6d69]">4指標合計</div></div>;
}

function MiniScore({ label, value, reason }: { label: string; value: HeatLevel; reason?: string }) {
  return <div className="min-w-0 border-r border-[#d7d0c5] p-2 text-center last:border-r-0" title={reason}><div className="font-mono text-sm font-semibold text-[#293a3c]">{value}</div><div className="mt-0.5 truncate text-[9px] text-[#77756e]">{label}</div></div>;
}

function CompareTray({ items, onRemove, onOpen }: { items: MaterialDetail[]; onRemove: (id: string) => void; onOpen: () => void }) {
  return (
    <div className="sticky bottom-3 z-30 ml-auto flex w-full max-w-3xl flex-wrap items-center gap-2 border border-[#172022] bg-[#172022] p-2 text-white shadow-[0_10px_30px_rgba(20,27,28,.25)]">
      <span className="px-2 font-mono text-[10px] uppercase tracking-[0.13em] text-[#b9c6c3]">比較 {items.length}/4</span>
      {items.map((item) => <button key={item.id} type="button" onClick={() => onRemove(item.id)} className="flex h-9 items-center gap-2 border border-[#526062] px-2 text-xs hover:border-[#d5b27c]"><span className="font-mono text-[#f0c987]">{item.code}</span><span className="max-w-[110px] truncate">{item.name}</span><X className="h-3 w-3" /></button>)}
      <button type="button" onClick={onOpen} className="ml-auto inline-flex h-10 items-center gap-2 bg-[#d7a45f] px-4 text-sm font-semibold text-[#1d2425]"><Columns3 className="h-4 w-4" />比較を開く</button>
    </div>
  );
}

function CompareView({ items, onRemove }: { items: MaterialDetail[]; onRemove: (id: string) => void }) {
  if (items.length < 2) {
    return <section className="border border-dashed border-[#a9a195] bg-[#fbf8f2] px-5 py-16 text-center"><Scale className="mx-auto h-8 w-8 text-[#9a7048]" /><h2 className="mt-4 text-xl font-semibold">2件以上を比較に追加してね。</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#686b66]">元素、鉱物、樹脂を跨いで最大4件。各detailの「比較に追加」から選べる。</p></section>;
  }
  const rankedItems = [...items].sort(compareMaterialTotalScore);
  const rows: Array<{ label: string; render: (item: MaterialDetail) => React.ReactNode }> = [
    { label:"4指標合計", render:(item)=><TotalScore item={item} compact /> },
    { label:"4指標の内訳", render:(item)=><div className="grid grid-cols-4 border border-[#d0c8bb]"><MiniScore label="注目" value={item.scores.heat} /><MiniScore label="需要" value={item.scores.demand} /><MiniScore label="供給" value={item.scores.supplyRisk} /><MiniScore label="AMD" value={item.scores.amdFit} /></div> },
    { label:"主用途", render:(item)=><TagList items={item.uses} /> },
    { label:"原料と製造", render:(item)=>item.manufacturing ? <ManufacturingSummary manufacturing={item.manufacturing} /> : <span className="text-xs text-[#8a8881]">—</span> },
    { label:"主要供給国", render:(item)=><p className="text-xs leading-5 text-[#5e625e]">{item.supplyCountries.join(" / ")}</p> },
    { label:"埋蔵・供給", render:(item)=><p className="text-xs leading-5 text-[#5e625e]">{item.reserves}</p> },
    { label:"需給balance", render:(item)=><p className="text-xs leading-5 text-[#5e625e]">{item.balance}</p> },
    { label:"循環・代替", render:(item)=><p className="text-xs leading-5 text-[#5e625e]">{item.circularity}</p> },
    { label:"AMDとの接点", render:(item)=><p className="text-xs font-medium leading-5 text-[#315b52]">{item.amdFitNote}</p> },
  ];
  return (
    <section className="border border-[#c9c1b4] bg-[#fbf8f2]">
      <div className="border-b border-[#d7d0c5] p-4"><h2 className="text-xl font-semibold">材料比較</h2><p className="mt-1 text-xs text-[#6c6d68]">異なるfamilyでも、同じ判断軸に揃えて見る。</p></div>
      <div className="overflow-x-auto">
        <div className="min-w-[900px]" style={{ display:"grid", gridTemplateColumns:`160px repeat(${rankedItems.length}, minmax(220px, 1fr))` }}>
          <div className="border-b border-r border-[#d7d0c5] bg-[#eee7db] p-3 font-mono text-[10px] uppercase tracking-[0.13em] text-[#766f65]">material</div>
          {rankedItems.map((item) => <div key={item.id} className="border-b border-r border-[#d7d0c5] p-4 last:border-r-0"><div className="flex items-start justify-between gap-3"><div><div className="font-mono text-lg font-semibold" style={{ color:FAMILY_ACCENT[item.family] }}>{item.code}</div><div className="mt-1 text-sm font-semibold">{item.name}</div><div className="mt-1 text-[10px] text-[#77756f]">{FAMILY_LABELS[item.family]}</div></div><button type="button" onClick={() => onRemove(item.id)} className="grid h-10 w-10 place-items-center border border-[#c9c1b4] text-[#686963] hover:border-[#7d2f1b] hover:text-[#7d2f1b]" aria-label={`${item.name}を比較から外す`}><X className="h-4 w-4" /></button></div></div>)}
          {rows.map((row) => <div key={row.label} className="contents"><div className="border-b border-r border-[#d7d0c5] bg-[#eee7db] p-3 text-xs font-semibold text-[#5f5d57]">{row.label}</div>{rankedItems.map((item) => <div key={`${row.label}-${item.id}`} className="border-b border-r border-[#d7d0c5] p-3 last:border-r-0">{row.render(item)}</div>)}</div>)}
        </div>
      </div>
    </section>
  );
}
