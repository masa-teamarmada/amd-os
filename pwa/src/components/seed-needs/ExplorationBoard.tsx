"use client";

import { useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  GitFork,
  Grid2X2,
  Plus,
  Search,
  X,
} from "lucide-react";
import {
  EVIDENCE_LABEL,
  RESEARCH_LABEL,
  type ExplorationSelection,
  type NeedDataset,
  type NeedResearch,
  type SeedNeedsData,
} from "@/lib/seed-needs";
import {
  buildExploration,
  emptySelection,
  matchesWords,
  nodeKey,
  researchAtPair,
  researchKeys,
  selectionField,
  traceExploration,
  type ExploreNode,
  type NodeKind,
} from "@/lib/seed-needs-exploration";
import type { EditorSelection } from "./NeedEditor";
import { ResearchComposer } from "./ResearchComposer";
import base from "./seed-needs.module.css";
import styles from "./exploration.module.css";

type Focus = { kind: NodeKind; id: string };
const LAYERS = [
  {
    kind: "market" as const,
    title: "市場のニーズ",
    hint: "誰の、どんな困りごとか",
  },
  {
    kind: "company" as const,
    title: "企業が探していること",
    hint: "事業領域・強み・方針を通して見る",
  },
  {
    kind: "seed" as const,
    title: "技術シーズ",
    hint: "応用する・組み合わせる・生み出す",
  },
];
const PAGE_SIZE = 12;

export function ExplorationBoard({
  data,
  dataset,
  onEdit,
  onResearchSaved,
  saveResearch,
  onEditingChange,
}: {
  data: SeedNeedsData;
  dataset: NeedDataset;
  onEdit: (selection: EditorSelection) => void;
  onResearchSaved: (r: NeedResearch) => void;
  onEditingChange?: (editing: boolean) => void;
  saveResearch: (
    record: Omit<NeedResearch, "created_at" | "updated_at">,
    original?: NeedResearch,
  ) => Promise<NeedResearch>;
}) {
  const visual = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"map" | "matrix">("map");
  const [query, setQuery] = useState("");
  const [focus, setFocus] = useState<Focus | null>(null);
  const [activeResearch, setActiveResearch] = useState<string | null>(null);
  const [extraSeedIds, setExtraSeedIds] = useState<string[]>([]);
  const [selection, setSelection] =
    useState<ExplorationSelection>(emptySelection);
  const [editing, setEditing] = useState<{ record?: NeedResearch } | null>(
    null,
  );
  const [poolOpen, setPoolOpen] = useState(false);
  const [poolQuery, setPoolQuery] = useState("");
  const [institution, setInstitution] = useState("");
  const [poolPage, setPoolPage] = useState(0);
  const [pages, setPages] = useState({ market: 0, company: 0, seed: 0 });
  const [onlyGaps, setOnlyGaps] = useState(false);
  const graph = useMemo(
    () => buildExploration(data, dataset, extraSeedIds),
    [data, dataset, extraSeedIds],
  );
  const selectedResearch = graph.research.find((r) => r.id === activeResearch);
  const highlighted = selectedResearch
    ? researchKeys(selectedResearch)
    : focus
      ? traceExploration(data, dataset, focus.kind, focus.id)
      : null;
  const selectedKeys = researchKeys(selection);
  const searchKeys = new Set<string>();
  if (query.trim())
    for (const node of graph.nodes) {
      const record =
        node.kind === "market"
          ? graph.markets.find((x) => x.id === node.id)
          : node.kind === "company"
            ? graph.companies.find((x) => x.id === node.id)
            : graph.seeds.find((x) => x.id === node.id);
      if (matchesWords(Object.values(record ?? {}).join(" "), query))
        for (const key of traceExploration(data, dataset, node.kind, node.id))
          searchKeys.add(key);
    }
  const gapKeys = new Set<string>();
  if (onlyGaps)
    for (const node of graph.nodes.filter(
      (n) => n.unlinked && n.kind !== "seed",
    ))
      for (const key of traceExploration(data, dataset, node.kind, node.id))
        gapKeys.add(key);
  const filteredNodes = graph.nodes.filter(
    (n) =>
      (!query.trim() || searchKeys.has(nodeKey(n.kind, n.id))) &&
      (!onlyGaps || n.kind === "seed" || gapKeys.has(nodeKey(n.kind, n.id))),
  );
  const orderedMarkets = [...graph.markets].sort((a, b) =>
    a.title.localeCompare(b.title, "ja"),
  );
  const marketOrder = new Map(orderedMarkets.map((m, i) => [m.id, i]));
  const orderedCompanies = [...graph.companies].sort(
    (a, b) =>
      (marketOrder.get(a.market_need_id ?? "") ?? 9999) -
        (marketOrder.get(b.market_need_id ?? "") ?? 9999) ||
      a.title.localeCompare(b.title, "ja"),
  );
  const companyOrder = new Map(orderedCompanies.map((c, i) => [c.id, i]));
  const seedOrder = (id: string) => {
    const indices = graph.matches
      .filter((m) => m.seed_id === id)
      .map((m) => companyOrder.get(m.company_need_id) ?? 9999);
    return indices.length
      ? indices.reduce((a, b) => a + b, 0) / indices.length
      : 9999;
  };
  const columns = LAYERS.map((layer) => {
    const all = filteredNodes
      .filter((n) => n.kind === layer.kind)
      .sort((a, b) => {
        const order =
          layer.kind === "market"
            ? (marketOrder.get(a.id) ?? 0) - (marketOrder.get(b.id) ?? 0)
            : layer.kind === "company"
              ? (companyOrder.get(a.id) ?? 0) - (companyOrder.get(b.id) ?? 0)
              : seedOrder(a.id) - seedOrder(b.id);
        const members = selectedResearch
          ? researchKeys(selectedResearch)
          : null;
        const membershipOrder = members
          ? Number(members.has(nodeKey(b.kind, b.id))) -
            Number(members.has(nodeKey(a.kind, a.id)))
          : 0;
        return membershipOrder || order || a.title.localeCompare(b.title, "ja");
      });
    const page = Math.min(
      pages[layer.kind],
      Math.max(0, Math.ceil(all.length / PAGE_SIZE) - 1),
    );
    return {
      ...layer,
      all,
      page,
      nodes: all.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    };
  });
  const visibleGaps = columns[1].nodes.filter((n) => n.unlinked);
  const rowCount = Math.max(
    3,
    ...columns.map(
      (c) => c.nodes.length + (c.kind === "seed" && visibleGaps.length ? 1 : 0),
    ),
  );
  const height = rowCount * 72 + 8;
  const gapY = 4 + (rowCount - 1) * 72;
  const positions = new Map<string, { x: number; y: number }>();
  columns.forEach((c, col) =>
    c.nodes.forEach((n, index) =>
      positions.set(nodeKey(n.kind, n.id), {
        x: col * 36,
        y:
          4 +
          (rowCount -
            c.nodes.length -
            (c.kind === "seed" && visibleGaps.length ? 1 : 0)) *
            36 +
          index * 72,
      }),
    ),
  );
  function createFromGaps() {
    setSelection({
      market_ids: [
        ...new Set(
          graph.companies
            .filter((c) => visibleGaps.some((n) => n.id === c.id))
            .flatMap((c) => (c.market_need_id ? [c.market_need_id] : [])),
        ),
      ],
      company_ids: visibleGaps.map((n) => n.id),
      seed_ids: [],
    });
    setEditing({});
    onEditingChange?.(true);
  }
  const visibleEdges = graph.edges.filter(
    (e) => positions.has(e.from) && positions.has(e.to),
  );
  const pool = data.seeds.filter(
    (s) =>
      (!institution || s.institution_id === institution) &&
      matchesWords(`${s.title} ${s.org_name} ${s.researcher_name}`, poolQuery),
  );
  const institutions = [
    ...new Map(
      data.seeds
        .filter((s) => s.institution_id)
        .map((s) => [s.institution_id!, s.org_name || s.institution_id!]),
    ).entries(),
  ].sort((a, b) => a[1].localeCompare(b[1], "ja"));
  const totalSelected = selectedKeys.size;
  function toggle(kind: NodeKind, id: string) {
    const key = selectionField[kind];
    setSelection((previous) => ({
      ...previous,
      [key]: previous[key].includes(id)
        ? previous[key].filter((x) => x !== id)
        : [...previous[key], id],
    }));
  }
  function chooseFocus(n: Focus) {
    setFocus((old) => (old?.id === n.id && old.kind === n.kind ? null : n));
    setActiveResearch(null);
  }
  function addSelection(n: Focus) {
    setSelection((old) => ({
      ...old,
      [selectionField[n.kind]]: [
        ...new Set([...old[selectionField[n.kind]], n.id]),
      ],
    }));
  }
  function startResearch(r?: NeedResearch) {
    if (
      editing &&
      !window.confirm("別の構想へ切り替える？ 入力中の未保存の文章は失われる。")
    )
      return;
    if (r) {
      setSelection({
        market_ids: [...r.market_ids],
        company_ids: [...r.company_ids],
        seed_ids: [...r.seed_ids],
      });
      setExtraSeedIds((old) => [...new Set([...old, ...r.seed_ids])]);
    }
    setEditing({ record: r });
    onEditingChange?.(true);
  }
  function focusResearch(r: NeedResearch) {
    setMode("map");
    visual.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    setActiveResearch(r.id);
    setFocus(null);
    setQuery("");
    setOnlyGaps(false);
    setPages({ market: 0, company: 0, seed: 0 });
  }
  const focusNode =
    focus &&
    graph.nodes.find((n) => n.id === focus.id && n.kind === focus.kind);
  const focusMarket =
    focus?.kind === "market"
      ? graph.markets.find((m) => m.id === focus.id)
      : undefined;
  const focusCompany =
    focus?.kind === "company"
      ? graph.companies.find((c) => c.id === focus.id)
      : undefined;
  const focusSeed =
    focus?.kind === "seed"
      ? graph.seeds.find((s) => s.id === focus.id)
      : undefined;
  const relatedMatches = graph.matches.filter(
    (m) =>
      focus &&
      (focus.kind === "company"
        ? m.company_need_id === focus.id
        : focus.kind === "seed"
          ? m.seed_id === focus.id
          : graph.companies.some(
              (c) =>
                c.id === m.company_need_id && c.market_need_id === focus.id,
            )),
  );
  function nodeView(n: ExploreNode) {
    const key = nodeKey(n.kind, n.id);
    const pos = positions.get(key)!;
    return (
      <div
        key={key}
        data-explore-node={key}
        className={`${styles.node} ${selectedKeys.has(key) ? styles.checkedNode : ""} ${highlighted?.has(key) ? styles.litNode : ""} ${highlighted && !highlighted.has(key) ? styles.dimNode : ""}`}
        style={{ left: `${pos.x}%`, top: pos.y, width: "28%" }}
      >
        <label className={styles.nodeCheck} title="研究構想に加える">
          <input
            aria-label={`${n.title}を研究構想に選択`}
            type="checkbox"
            checked={selectedKeys.has(key)}
            onChange={() => toggle(n.kind, n.id)}
          />
        </label>
        <button
          className={styles.nodeBody}
          aria-pressed={focus?.kind === n.kind && focus.id === n.id}
          onClick={() => chooseFocus(n)}
          title={`${n.title}\n${n.subtitle}`}
        >
          <strong>{n.title}</strong>
          <span>
            {n.unlinked && n.kind !== "seed" && (
              <b className={styles.gapDot} aria-label="未接続">
                ○
              </b>
            )}
            {n.subtitle ||
              (n.kind === "market" ? "対象者を整理" : "詳細を確認")}
          </span>
        </button>
      </div>
    );
  }
  return (
    <div className={styles.exploration}>
      <div className={styles.controls}>
        <div className={base.segment} aria-label="探索の表示">
          <button aria-pressed={mode === "map"} onClick={() => setMode("map")}>
            <GitFork size={15} />
            関係図
          </button>
          <button
            aria-pressed={mode === "matrix"}
            onClick={() => setMode("matrix")}
          >
            <Grid2X2 size={15} />
            交点で比較
          </button>
        </div>
        <label className={base.search}>
          <Search size={15} />
          <input
            aria-label="関係図を検索"
            placeholder="課題・企業・技術から辿る"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPages({ market: 0, company: 0, seed: 0 });
            }}
          />
        </label>
        <label className={base.checkbox}>
          <input
            type="checkbox"
            checked={onlyGaps}
            onChange={(e) => {
              setOnlyGaps(e.target.checked);
              setPages({ market: 0, company: 0, seed: 0 });
            }}
          />
          未接続のニーズ
        </label>
        <button
          className={base.button}
          aria-expanded={poolOpen}
          onClick={() => setPoolOpen(!poolOpen)}
        >
          <Plus size={16} />
          台帳からシーズを追加
        </button>
      </div>
      {poolOpen && (
        <section className={styles.pool} aria-label="比較するシーズを探す">
          <div className={styles.poolTop}>
            <strong>
              比較するシーズを探す{" "}
              <span>
                {pool.length} / {data.seeds.length}件
              </span>
            </strong>
            <button
              className={base.iconButton}
              aria-label="シーズの検索を閉じる"
              onClick={() => setPoolOpen(false)}
            >
              <X size={16} />
            </button>
          </div>
          <div className={styles.controls}>
            <label className={base.search}>
              <Search size={15} />
              <input
                aria-label="シーズ台帳から検索"
                value={poolQuery}
                onChange={(e) => {
                  setPoolQuery(e.target.value);
                  setPoolPage(0);
                }}
                placeholder="技術名・大学・研究者"
              />
            </label>
            <select
              aria-label="候補シーズの研究機関"
              value={institution}
              onChange={(e) => {
                setInstitution(e.target.value);
                setPoolPage(0);
              }}
            >
              <option value="">全研究機関</option>
              {institutions.map(([id, name]) => (
                <option value={id} key={id}>
                  {name}
                </option>
              ))}
            </select>
            <span className={styles.hint}>
              追加は比較のため。技術的な適合は未評価。
            </span>
          </div>
          <div className={styles.poolList}>
            {pool.slice(poolPage * 12, (poolPage + 1) * 12).map((s) => (
              <label key={s.id}>
                <input
                  type="checkbox"
                  checked={graph.seeds.some((x) => x.id === s.id)}
                  disabled={
                    graph.matches.some((x) => x.seed_id === s.id) ||
                    graph.directLinks.some((x) => x.seed_id === s.id) ||
                    graph.research.some((r) => r.seed_ids.includes(s.id))
                  }
                  onChange={(e) => {
                    setExtraSeedIds((old) =>
                      e.target.checked
                        ? [...old, s.id]
                        : old.filter((id) => id !== s.id),
                    );
                    setPages((old) => ({ ...old, seed: 0 }));
                  }}
                />
                <span>
                  <strong>{s.title}</strong>
                  <small>
                    {s.org_name}・{s.researcher_name}
                  </small>
                </span>
              </label>
            ))}
          </div>
          {!pool.length && <p>該当なし。検索語を変更して確認。</p>}
          <div className={styles.pager}>
            <button
              disabled={!poolPage}
              onClick={() => setPoolPage((p) => p - 1)}
              className={base.iconButton}
              aria-label="候補シーズの前のページ"
            >
              <ChevronLeft size={16} />
            </button>
            <span>
              {pool.length ? poolPage * 12 + 1 : 0}–
              {Math.min(pool.length, (poolPage + 1) * 12)} / {pool.length}
            </span>
            <button
              disabled={(poolPage + 1) * 12 >= pool.length}
              onClick={() => setPoolPage((p) => p + 1)}
              className={base.iconButton}
              aria-label="候補シーズの次のページ"
            >
              <ChevronRight size={16} />
            </button>
            <button className={base.button} onClick={() => setPoolOpen(false)}>
              関係図へ戻る
            </button>
          </div>
        </section>
      )}
      <div
        className={`${styles.workArea} ${editing ? styles.withComposer : ""}`}
      >
        <div ref={visual} className={styles.visualArea}>
          {focusCompany && (
            <div className={styles.focusCaption}>
              <strong>
                {focusCompany.company_name.replace("仮の企業像｜", "")} の視点
              </strong>
              <span>
                {focusCompany.business_area} ／ 強み：
                {focusCompany.strengths || "未整理"}
              </span>
            </div>
          )}
          <div className={styles.legend}>
            <span>
              <i /> 市場の解釈・記録した組み合わせ
            </span>
            <span>○ シーズ未接続 → 点線から新しい研究へ</span>
            <span>□ チェックで複数選択 → 研究仮説</span>
            {highlighted && (
              <button
                onClick={() => {
                  setFocus(null);
                  setActiveResearch(null);
                }}
                className={base.textButton}
              >
                強調を解除
              </button>
            )}
          </div>
          {mode === "map" ? (
            <div
              className={styles.mapScroll}
              tabIndex={0}
              aria-label="市場・企業・シーズの関係図。横と縦にスクロール可能"
            >
              <div className={styles.map}>
                <div className={styles.columnHeaders}>
                  {columns.map((c) => (
                    <div key={c.kind}>
                      <h2>
                        {c.title} <span>{c.all.length}</span>
                      </h2>
                      <p>{c.hint}</p>
                      <div className={styles.columnActions}>
                        {c.kind === "seed" ? (
                          <button onClick={() => setPoolOpen(true)}>
                            台帳 {data.seeds.length}件から探す
                          </button>
                        ) : (
                          <button onClick={() => onEdit({ kind: c.kind })}>
                            ＋ 追加
                          </button>
                        )}
                        {c.all.length > PAGE_SIZE && (
                          <>
                            <button
                              disabled={!c.page}
                              onClick={() =>
                                setPages((p) => ({
                                  ...p,
                                  [c.kind]: c.page - 1,
                                }))
                              }
                              aria-label={`${c.title}の前のページ`}
                            >
                              <ChevronLeft size={14} />
                            </button>
                            <small>
                              {c.page + 1}/{Math.ceil(c.all.length / PAGE_SIZE)}
                            </small>
                            <button
                              disabled={
                                (c.page + 1) * PAGE_SIZE >= c.all.length
                              }
                              onClick={() =>
                                setPages((p) => ({
                                  ...p,
                                  [c.kind]: c.page + 1,
                                }))
                              }
                              aria-label={`${c.title}の次のページ`}
                            >
                              <ChevronRight size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className={styles.canvas} style={{ height }}>
                  <svg
                    viewBox={`0 0 1000 ${height}`}
                    preserveAspectRatio="none"
                    aria-hidden="true"
                    className={styles.edges}
                  >
                    {visibleEdges.map((e) => {
                      const a = positions.get(e.from)!;
                      const b = positions.get(e.to)!;
                      const x1 = (a.x + 28) * 10,
                        x2 = b.x * 10,
                        y1 = a.y + 32,
                        y2 = b.y + 32;
                      const active =
                        highlighted?.has(e.from) && highlighted.has(e.to);
                      return (
                        <path
                          key={e.id}
                          data-match-edge={e.matchId ?? ""}
                          d={`M ${x1} ${y1} C ${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}`}
                          className={`${styles.edge} ${active ? styles.activeEdge : ""} ${highlighted && !active ? styles.dimEdge : ""}`}
                        />
                      );
                    })}
                    {visibleGaps.map((n) => {
                      const p = positions.get(nodeKey("company", n.id))!;
                      return (
                        <path
                          key={`gap-${n.id}`}
                          d={`M 640 ${p.y + 32} C 680 ${p.y + 32}, 680 ${gapY + 32}, 720 ${gapY + 32}`}
                          className={styles.gapEdge}
                        />
                      );
                    })}
                  </svg>
                  {columns.flatMap((c) => c.nodes.map(nodeView))}
                  {visibleGaps.length > 0 && (
                    <button
                      disabled={!!editing}
                      className={styles.gapNode}
                      style={{ top: gapY }}
                      onClick={createFromGaps}
                    >
                      <span>未接続の {visibleGaps.length} ニーズから</span>
                      <strong>
                        必要な技術を、これから生み出す <ArrowRight size={14} />
                      </strong>
                    </button>
                  )}
                  {columns.map(
                    (c, i) =>
                      !c.nodes.length &&
                      !(c.kind === "seed" && visibleGaps.length) && (
                        <div
                          key={c.kind}
                          className={styles.emptyColumn}
                          style={{ left: `${i * 36}%`, width: "28%" }}
                        >
                          <strong>
                            {c.kind === "seed"
                              ? "比較するシーズを選ぶ"
                              : "ニーズを蓄積する"}
                          </strong>
                          <p>
                            {c.kind === "seed"
                              ? "台帳から候補を加える。まだなければ、新しい研究を構想。"
                              : "課題や探索テーマを登録すると関係を辿れる。"}
                          </p>
                        </div>
                      ),
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div
              className={styles.matrixScroll}
              tabIndex={0}
              aria-label="企業ニーズとシーズの交点。横にスクロール可能"
            >
              <table className={styles.matrix}>
                <caption>
                  ● 記録した組み合わせ　◇ 同じ研究構想に含む　＋
                  未検討（押すと組み合わせを記録）
                </caption>
                <thead>
                  <tr>
                    <th>市場 → 企業の探索テーマ</th>
                    {columns[2].nodes.map((n) => (
                      <th key={n.id}>
                        <label>
                          <input
                            type="checkbox"
                            aria-label={`${n.title}を研究構想に選択`}
                            checked={selection.seed_ids.includes(n.id)}
                            onChange={() => toggle("seed", n.id)}
                          />
                          <button
                            onClick={() => chooseFocus(n)}
                            title={n.title}
                          >
                            {n.title}
                          </button>
                        </label>
                      </th>
                    ))}
                    <th>新しいシーズを生む</th>
                  </tr>
                </thead>
                <tbody>
                  {columns[1].nodes.map((n) => {
                    const c = graph.companies.find((x) => x.id === n.id)!;
                    const market = graph.markets.find(
                      (m) => m.id === c.market_need_id,
                    );
                    return (
                      <tr key={c.id}>
                        <th>
                          <label>
                            <input
                              type="checkbox"
                              aria-label={`${c.title}を研究構想に選択`}
                              checked={selection.company_ids.includes(c.id)}
                              onChange={() => toggle("company", c.id)}
                            />
                            <button onClick={() => chooseFocus(n)}>
                              <small>
                                {market?.title || "市場との関係を整理"} →{" "}
                                {c.company_name.replace("仮の企業像｜", "")}
                              </small>
                              <strong>{c.title}</strong>
                              <span>{c.strengths}</span>
                            </button>
                          </label>
                        </th>
                        {columns[2].nodes.map((s) => {
                          const match = graph.matches.find(
                            (m) =>
                              m.company_need_id === c.id && m.seed_id === s.id,
                          );
                          const shared = researchAtPair(
                            graph.research,
                            c.id,
                            s.id,
                          );
                          return (
                            <td key={s.id}>
                              <button
                                className={`${styles.cell} ${match ? styles.matchedCell : ""} ${shared.length ? styles.researchCell : ""}`}
                                aria-label={`${c.title} × ${s.title}：${match ? "組み合わせを編集" : shared.length ? "同じ研究構想・個別適合は未評価" : "未検討・組み合わせを追加"}`}
                                title={
                                  match
                                    ? match.research_question ||
                                      "組み合わせの仮説"
                                    : shared.length
                                      ? shared.map((r) => r.title).join("\n")
                                      : "未検討。技術的に合わないという意味ではない"
                                }
                                onClick={() =>
                                  onEdit({
                                    kind: "match",
                                    companyId: c.id,
                                    seedId: s.id,
                                    record: match,
                                  })
                                }
                              >
                                {match ? "●" : shared.length ? "◇" : "+"}
                              </button>
                            </td>
                          );
                        })}
                        <td>
                          <button
                            className={styles.newSeedCell}
                            disabled={!!editing}
                            onClick={() => {
                              setSelection({
                                market_ids: c.market_need_id
                                  ? [c.market_need_id]
                                  : [],
                                company_ids: [c.id],
                                seed_ids: [],
                              });
                              startResearch();
                            }}
                          >
                            必要な技術から
                            <br />
                            構想する <ArrowRight size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className={styles.matrixPages}>
                {[columns[1], columns[2]].map((c) => (
                  <div key={c.kind} className={styles.pager}>
                    <span>
                      {c.title} {c.page * PAGE_SIZE + (c.all.length ? 1 : 0)}–
                      {Math.min((c.page + 1) * PAGE_SIZE, c.all.length)} /{" "}
                      {c.all.length}
                    </span>
                    <button
                      className={base.iconButton}
                      aria-label={`${c.title}の前のページ`}
                      disabled={!c.page}
                      onClick={() =>
                        setPages((p) => ({ ...p, [c.kind]: c.page - 1 }))
                      }
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      className={base.iconButton}
                      aria-label={`${c.title}の次のページ`}
                      disabled={(c.page + 1) * PAGE_SIZE >= c.all.length}
                      onClick={() =>
                        setPages((p) => ({ ...p, [c.kind]: c.page + 1 }))
                      }
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className={styles.selectionBar}>
            <div>
              <strong>
                {totalSelected
                  ? `${selection.market_ids.length} 市場 × ${selection.company_ids.length} 企業ニーズ × ${selection.seed_ids.length} シーズ`
                  : "組み合わせを考える"}
              </strong>
              <span>
                {totalSelected
                  ? "選んだ要素をひとつの研究構想へ"
                  : "チェックで複数選択。シーズがなくても構想できる。"}
              </span>
            </div>
            {totalSelected > 0 && !editing && (
              <button
                className={base.textButton}
                onClick={() => setSelection(emptySelection())}
              >
                選択解除
              </button>
            )}
            <button
              className={base.primaryButton}
              disabled={
                !!editing ||
                (!selection.market_ids.length && !selection.company_ids.length)
              }
              onClick={() => startResearch()}
            >
              <Plus size={15} />
              研究仮説にする
            </button>
          </div>
          {focusNode && (
            <section className={styles.inspector} aria-label="選んだ要素の詳細">
              <header>
                <h3>{focusNode.title}</h3>
                <button
                  className={base.iconButton}
                  aria-label="要素の詳細を閉じる"
                  onClick={() => setFocus(null)}
                >
                  <X size={16} />
                </button>
              </header>
              {focusMarket && (
                <>
                  <div className={styles.facts}>
                    <div>
                      <small>市場の課題</small>
                      <p>{focusMarket.problem || "未整理"}</p>
                    </div>
                    <div>
                      <small>現在の解決方法 → 望まれる変化</small>
                      <p>
                        {focusMarket.current_solution || "未整理"} →{" "}
                        {focusMarket.desired_outcome || "未整理"}
                      </p>
                    </div>
                    <div>
                      <small>
                        {EVIDENCE_LABEL[focusMarket.evidence_status]}・根拠
                      </small>
                      <p>{focusMarket.evidence_note || "未記入"}</p>
                    </div>
                  </div>
                  <button
                    className={base.textButton}
                    onClick={() =>
                      onEdit({ kind: "market", record: focusMarket })
                    }
                  >
                    根拠・詳細を編集
                  </button>
                  <button
                    className={base.textButton}
                    onClick={() =>
                      onEdit({ kind: "company", marketId: focusMarket.id })
                    }
                  >
                    この市場から企業ニーズを追加
                  </button>
                </>
              )}
              {focusCompany && (
                <>
                  <div className={styles.facts}>
                    <div>
                      <small>事業領域・活かせる強み</small>
                      <p>{focusCompany.business_area || "未整理"}</p>
                      <p>{focusCompany.strengths || "未整理"}</p>
                    </div>
                    <div>
                      <small>事業の方針 → 足りない技術</small>
                      <p>
                        {focusCompany.strategic_intent || "未整理"} →{" "}
                        {focusCompany.missing_capability || "未整理"}
                      </p>
                    </div>
                    <div>
                      <small>
                        採用条件・根拠（
                        {EVIDENCE_LABEL[focusCompany.evidence_status]}）
                      </small>
                      <p>{focusCompany.constraints || "未整理"}</p>
                      <p>{focusCompany.evidence_note || "未記入"}</p>
                    </div>
                  </div>
                  <button
                    className={base.textButton}
                    onClick={() =>
                      onEdit({ kind: "company", record: focusCompany })
                    }
                  >
                    企業のフィルターを編集
                  </button>
                  <button
                    className={base.textButton}
                    onClick={() =>
                      onEdit({ kind: "match", companyId: focusCompany.id })
                    }
                  >
                    シーズとつなぐ
                  </button>
                </>
              )}
              {focusSeed && (
                <>
                  <p>
                    {focusSeed.org_name}・{focusSeed.researcher_name} ／
                    このシーズに接続した企業ニーズ {relatedMatches.length}件
                  </p>
                  <a
                    href={`/seeds/${focusSeed.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className={base.textLink}
                  >
                    シーズの本文・根拠を開く <ArrowRight size={14} />
                  </a>
                </>
              )}
              {relatedMatches.length > 0 && (
                <div className={styles.matchNotes}>
                  {relatedMatches.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => onEdit({ kind: "match", record: m })}
                    >
                      <span>
                        {
                          graph.companies.find(
                            (c) => c.id === m.company_need_id,
                          )?.title
                        }{" "}
                        × {graph.seeds.find((s) => s.id === m.seed_id)?.title}
                      </span>
                      <strong>
                        {m.research_question || "検証の問いを記入"}
                      </strong>
                    </button>
                  ))}
                </div>
              )}
              <button
                className={base.button}
                onClick={() => {
                  if (focus) addSelection(focus);
                }}
              >
                研究構想に加える
              </button>
              {focusNode.unlinked && focusNode.kind !== "seed" && (
                <button
                  className={base.textButton}
                  disabled={!!editing}
                  onClick={() => {
                    if (focus) {
                      setSelection({
                        ...emptySelection(),
                        [selectionField[focus.kind]]: [focus.id],
                      });
                      startResearch();
                    }
                  }}
                >
                  足りない技術から新しいシーズを構想 <ArrowRight size={14} />
                </button>
              )}
            </section>
          )}
          <section
            className={styles.researchSection}
            aria-label="生まれた研究仮説"
          >
            <header>
              <div>
                <h2>
                  ここから生まれる研究仮説 <span>{graph.research.length}</span>
                </h2>
                <p>ニーズと技術の間にある「足りないもの」を、次の研究へ。</p>
              </div>
              <span className={styles.hint}>すべて未検証の構想</span>
            </header>
            {!graph.research.length ? (
              <p className={styles.researchEmpty}>
                ニーズとシーズを選ぶと、応用・組み合わせ・新しい技術の構想を残せる。
              </p>
            ) : (
              graph.research.map((r) => (
                <div
                  key={r.id}
                  className={`${styles.researchRow} ${activeResearch === r.id ? styles.activeResearch : ""}`}
                >
                  <button
                    className={styles.researchTitle}
                    onClick={() => focusResearch(r)}
                  >
                    <span>{RESEARCH_LABEL[r.kind]}</span>
                    <strong>{r.title}</strong>
                    <small>
                      {r.market_ids.length} 市場 / {r.company_ids.length}{" "}
                      企業ニーズ /{" "}
                      {r.seed_ids.length
                        ? `${r.seed_ids.length} シーズ`
                        : "必要な技術から創出"}
                    </small>
                  </button>
                  <p>{r.gap || "何が足りないかを検討"}</p>
                  <button
                    className={base.textButton}
                    disabled={!!editing}
                    onClick={() => {
                      focusResearch(r);
                      startResearch(r);
                    }}
                  >
                    構想を開く <ChevronRight size={15} />
                  </button>
                </div>
              ))
            )}
            {selectedResearch && !editing && (
              <div className={styles.researchDetail}>
                <strong>生み出したいシーズ・仮説</strong>
                <p>{selectedResearch.hypothesis || "未整理"}</p>
                <div className={styles.facts}>
                  <div>
                    <small>最初に試すこと</small>
                    <p>{selectedResearch.experiment || "未整理"}</p>
                  </div>
                  <div>
                    <small>判定基準</small>
                    <p>{selectedResearch.success_criteria || "未整理"}</p>
                  </div>
                  <div>
                    <small>次の確認</small>
                    <p>{selectedResearch.next_action || "未整理"}</p>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
        {editing && (
          <ResearchComposer
            key={editing.record?.id ?? "new"}
            data={data}
            dataset={dataset}
            selection={selection}
            original={editing.record}
            onRemove={(field, id) =>
              setSelection((s) => ({
                ...s,
                [field]: s[field].filter((x) => x !== id),
              }))
            }
            onClose={() => {
              setEditing(null);
              onEditingChange?.(false);
            }}
            save={saveResearch}
            onSaved={(r) => {
              onResearchSaved(r);
              setEditing(null);
              onEditingChange?.(false);
              setSelection(emptySelection());
              setActiveResearch(r.id);
              setFocus(null);
            }}
          />
        )}
      </div>
      <p className={styles.hint}>
        線は登録した関係を表し、適合や実現性の確定ではない。研究構想に含む複数技術も、個々の組み合わせの検証はこれから。
      </p>
    </div>
  );
}
