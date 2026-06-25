"use client";

type RoadmapState = "done" | "active" | "upcoming";

type RoadmapItem = {
  id: string;
  lane: "regulation" | "seed";
  period: string;
  startYm: string;
  endYm: string;
  title: string;
  purpose: string;
  outputs: string[];
};

const KUTE_ROADMAP: RoadmapItem[] = [
  {
    id: "regulation-202606",
    lane: "regulation",
    period: "2026-06",
    startYm: "202606",
    endYm: "202606",
    title: "認定規程の着地",
    purpose: "6/22教授総会で通せる状態にする",
    outputs: ["認定規程修正案", "委員会規程", "支援細則", "想定問答"],
  },
  {
    id: "regulation-202607",
    lane: "regulation",
    period: "2026-07",
    startYm: "202607",
    endYm: "202607",
    title: "7規程の全体設計",
    purpose: "認定制度と残り6規程の接続を整理する",
    outputs: ["規程マップ", "既存規程突合表", "他大学比較", "優先順位"],
  },
  {
    id: "regulation-202608",
    lane: "regulation",
    period: "2026-08",
    startYm: "202608",
    endYm: "202608",
    title: "残り6規程の素案化",
    purpose: "既存改訂・新規作成の条文たたきを作る",
    outputs: ["兼業", "新株予約権", "共有機器", "知財", "共同研究", "利益相反"],
  },
  {
    id: "regulation-202609-202611",
    lane: "regulation",
    period: "2026-09〜11",
    startYm: "202609",
    endYm: "202611",
    title: "学内議論・修正",
    purpose: "教授総会・関係部署・法務論点を反映する",
    outputs: ["修正版", "論点管理表", "学内説明資料", "施行準備メモ"],
  },
  {
    id: "regulation-202612-202701",
    lane: "regulation",
    period: "2026-12〜2027-01",
    startYm: "202612",
    endYm: "202701",
    title: "規程整備完了",
    purpose: "条文だけでなく、運用に必要な付属物まで揃える",
    outputs: ["施行版", "様式", "運用フロー", "FAQ"],
  },
  {
    id: "seed-202606-202703",
    lane: "seed",
    period: "2026-06〜2027-03",
    startYm: "202606",
    endYm: "202703",
    title: "シーズ発掘・after GTIE",
    purpose: "規程整備と並行して支援実務の型を作る",
    outputs: ["桑折先生パイロット", "ヒアリング設計", "連携先マップ", "資金循環モデル"],
  },
];

const STATUS_TEXT: Record<RoadmapState, string> = {
  done: "完了",
  active: "進行中",
  upcoming: "次",
};

const STATUS_CLASSES: Record<RoadmapState, string> = {
  done: "border-emerald-300 bg-emerald-50 text-emerald-800",
  active: "border-sky-300 bg-sky-50 text-sky-800",
  upcoming: "border-slate-200 bg-slate-50 text-slate-600",
};

const STATUS_DOT_CLASSES: Record<RoadmapState, string> = {
  done: "bg-emerald-500",
  active: "bg-sky-500",
  upcoming: "bg-slate-300",
};

function ymToIndex(ym: string) {
  if (!/^\d{6}$/.test(ym)) return ymToIndex("202606");
  const year = Number(ym.slice(0, 4));
  const month = Number(ym.slice(4, 6));
  return year * 12 + month;
}

function normalizeYm(ym: string | null | undefined) {
  return /^\d{6}$/.test(ym || "") ? String(ym) : "202606";
}

function stateFor(item: RoadmapItem, currentYm: string): RoadmapState {
  if (currentYm > item.endYm) return "done";
  if (currentYm < item.startYm) return "upcoming";
  return "active";
}

function formatYm(ym: string) {
  if (!/^\d{6}$/.test(ym)) return ym;
  return `${ym.slice(0, 4)}.${ym.slice(4, 6)}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function fiscalProgressPct(currentYm: string) {
  const start = ymToIndex("202606");
  const end = ymToIndex("202703");
  const current = ymToIndex(currentYm);
  return clamp(((current - start + 1) / (end - start + 1)) * 100, 0, 100);
}

function RoadmapRow({ item, currentYm }: { item: RoadmapItem; currentYm: string }) {
  const state = stateFor(item, currentYm);
  return (
    <article className={`rounded-lg border px-3 py-3 ${STATUS_CLASSES[state]}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT_CLASSES[state]}`} />
            <span className="text-[11px] font-mono">{item.period}</span>
          </div>
          <h3 className="mt-1 text-sm font-semibold text-slate-950">{item.title}</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-700">{item.purpose}</p>
        </div>
        <span className="shrink-0 rounded-md border border-current/20 bg-white/70 px-2 py-0.5 text-[10px] font-semibold">
          {STATUS_TEXT[state]}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {item.outputs.map((output) => (
          <span key={output} className="rounded-md bg-white/70 px-2 py-1 text-[11px] text-slate-700 ring-1 ring-black/5">
            {output}
          </span>
        ))}
      </div>
    </article>
  );
}

export function CockpitKuteAnnualRoadmap({ currentYm }: { currentYm: string }) {
  const normalizedYm = normalizeYm(currentYm);
  const regulationItems = KUTE_ROADMAP.filter((item) => item.lane === "regulation");
  const seedItem = KUTE_ROADMAP.find((item) => item.lane === "seed");
  const activeItems = KUTE_ROADMAP.filter((item) => stateFor(item, normalizedYm) === "active");

  return (
    <section className="rounded-xl border border-[#d6d6da] bg-white px-4 py-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="text-[10px] font-mono uppercase tracking-[0.08em] text-slate-500">KUTE annual roadmap</div>
          <h2 className="mt-1 text-lg font-bold text-slate-950">年度内ロードマップ</h2>
          <p className="mt-1 max-w-4xl text-sm leading-relaxed text-slate-600">
            2027年3月までに、規程整備、桑折先生パイロット、外部連携、資金循環モデルまでを同じ横軸で追う。
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-stretch">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <div className="text-[10px] font-mono uppercase text-slate-500">現在地</div>
            <div className="text-base font-bold text-slate-950">{formatYm(normalizedYm)}</div>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
            <div className="text-[10px] font-mono uppercase text-emerald-700">年度末の着地</div>
            <div className="text-sm font-semibold text-emerald-950">2027.03 型化</div>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-sky-500" style={{ width: `${fiscalProgressPct(normalizedYm)}%` }} />
        </div>
        <div className="mt-1 flex justify-between text-[10px] font-mono text-slate-500">
          <span>2026.06</span>
          <span>2027.03</span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.8fr)]">
        <div className="min-w-0">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold text-slate-900">制度整備レーン</h3>
            <span className="text-[11px] text-slate-500">2027年1月目途で完了</span>
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-5">
            {regulationItems.map((item) => (
              <RoadmapRow key={item.id} item={item} currentYm={normalizedYm} />
            ))}
          </div>
        </div>

        <div className="min-w-0">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold text-slate-900">シーズ発掘 / after GTIE レーン</h3>
            <span className="text-[11px] text-slate-500">年度末まで継続</span>
          </div>
          {seedItem && <RoadmapRow item={seedItem} currentYm={normalizedYm} />}
          <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
            after GTIEの具体論点は先に固定しすぎず、規程整備とシーズ発掘の進捗を見て具体化する。
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-500">
        <span>根拠: 6/11キックオフ資料</span>
        <span>合意業務: 規程策定 / シーズ掘り起こし / 自治体等とのファンド形成</span>
        {activeItems.length > 0 && <span>現在進行中: {activeItems.map((item) => item.title).join(" / ")}</span>}
      </div>
    </section>
  );
}
