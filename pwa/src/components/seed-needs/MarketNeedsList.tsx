"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Pencil,
  Plus,
  Search,
  X,
} from "lucide-react";
import {
  marketNeedRows,
  marketSizeFor,
  marketSizeText,
  rankMarketSizes,
  searchMarketRows,
} from "@/lib/market-needs";
import {
  CONFIDENCE_LABEL,
  EVIDENCE_LABEL,
  MARKET_SCOPE_LABEL,
  SOURCE_LABEL,
  type MarketNeed,
  type MarketSeedLink,
  type MarketSize,
  type NeedDataset,
  type NeedEvidence,
  type SeedNeedsData,
} from "@/lib/seed-needs";
import type { EditorSelection } from "./NeedEditor";
import styles from "./seed-needs.module.css";
import list from "./market-needs.module.css";

// 主役は一行の市場課題。規模と確度を独立した列に置き、青は企業/シーズ/出典への移動だけに使う。
// 紙の白、slateの本文、薄い区切り、未評価の灰、4px基準・14px本文。詳細は行を選んだ時だけ展開。
function SourceReadout({ need }: { need: NeedEvidence }) {
  return (
    <>
      {(need.sources ?? []).map((source) => (
        <article key={source.id} className={list.sourceItem}>
          <div className={list.sourceMeta}>
            {SOURCE_LABEL[source.kind]} · {source.publisher || "発行元未記入"} ·{" "}
            {source.date || "日付未記入"}
          </div>
          <strong>
            {/^https?:\/\//.test(source.url) ? (
              <a
                className={styles.textLink}
                href={source.url}
                target="_blank"
                rel="noreferrer"
              >
                {source.title}
                <ExternalLink size={12} />
              </a>
            ) : (
              source.title
            )}
          </strong>
          <p>{source.note}</p>
        </article>
      ))}
      {need.source_url && (
        <p>
          <a
            className={styles.textLink}
            href={need.source_url}
            target="_blank"
            rel="noreferrer"
          >
            以前に登録した出典 <ExternalLink size={12} />
          </a>
        </p>
      )}
      {!need.sources?.length && !need.source_url && (
        <p className={styles.muted}>出典未登録</p>
      )}
      {need.evidence_note && (
        <div className={list.legacyNote}>
          <small>
            確認メモ · {EVIDENCE_LABEL[need.evidence_status]}
            {need.observed_on ? ` · ${need.observed_on}` : ""}
          </small>
          <p>{need.evidence_note}</p>
        </div>
      )}
    </>
  );
}

export function MarketNeedsList({
  data,
  dataset,
  onEdit,
  onLink,
}: {
  data: SeedNeedsData;
  dataset: NeedDataset;
  onEdit: (selection: EditorSelection) => void;
  onLink: (market: MarketNeed, original?: MarketSeedLink) => void;
}) {
  const rows = useMemo(() => marketNeedRows(data, dataset), [data, dataset]);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<MarketSize["scope"]>("japan");
  const years = useMemo(
    () =>
      [
        ...new Set(
          rows.flatMap((r) => (r.market.market_sizes ?? []).map((s) => s.year)),
        ),
      ].sort((a, b) => b - a),
    [rows],
  );
  const [chosenYear, setChosenYear] = useState<number | null>(null);
  const year = chosenYear ?? years[0] ?? new Date().getFullYear();
  const [sort, setSort] = useState("size");
  const [confidence, setConfidence] = useState("");
  const [withoutSource, setWithoutSource] = useState(false);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const details = useRef<HTMLElement>(null);
  const ranks = useMemo(
    () => rankMarketSizes(rows, scope, year),
    [rows, scope, year],
  );
  const filtered = useMemo(
    () =>
      searchMarketRows(rows, query)
        .filter(
          (r) =>
            (!confidence ||
              (r.market.confidence_rank ?? "unassessed") === confidence) &&
            (!withoutSource ||
              (!r.market.sources?.length && !r.market.source_url)),
        )
        .sort((a, b) => {
          if (sort === "size") {
            const av = marketSizeFor(a.market, scope, year)?.min_oku;
            const bv = marketSizeFor(b.market, scope, year)?.min_oku;
            if (av === undefined && bv !== undefined) return 1;
            if (av !== undefined && bv === undefined) return -1;
            if (av !== undefined && bv !== undefined && av !== bv)
              return bv - av;
          }
          if (sort === "confidence") {
            const weights = { a: 3, b: 2, c: 1, unassessed: 0 };
            const diff =
              weights[b.market.confidence_rank ?? "unassessed"] -
              weights[a.market.confidence_rank ?? "unassessed"];
            if (diff) return diff;
          }
          if (sort === "updated") {
            const diff = b.market.updated_at.localeCompare(a.market.updated_at);
            if (diff) return diff;
          }
          return a.market.title.localeCompare(b.market.title, "ja");
        }),
    [rows, query, confidence, withoutSource, sort, scope, year],
  );
  const pageSize = 25;
  const lastPage = Math.max(0, Math.ceil(filtered.length / pageSize) - 1);
  const currentPage = Math.min(page, lastPage);
  const visible = filtered.slice(
    currentPage * pageSize,
    (currentPage + 1) * pageSize,
  );
  const selectedRow = rows.find((r) => r.market.id === selected);
  function show(id: string) {
    setSelected(id);
    requestAnimationFrame(() => {
      details.current?.focus({ preventScroll: true });
      details.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  }
  function reset() {
    setQuery("");
    setConfidence("");
    setWithoutSource(false);
    setPage(0);
  }
  return (
    <>
      <div className={styles.toolbar}>
        <label className={styles.search}>
          <Search size={16} />
          <input
            aria-label="市場ニーズ・企業・シーズ・出典を検索"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            placeholder="ニーズ・企業・シーズ・出典を検索"
          />
        </label>
        <label className={list.filter}>
          <span>比較地域</span>
          <select
            aria-label="市場規模の比較地域"
            value={scope}
            onChange={(e) => {
              setScope(e.target.value as MarketSize["scope"]);
              setPage(0);
            }}
          >
            {Object.entries(MARKET_SCOPE_LABEL).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className={list.filter}>
          <span>対象年</span>
          <select
            aria-label="市場規模の対象年"
            value={year}
            onChange={(e) => {
              setChosenYear(Number(e.target.value));
              setPage(0);
            }}
          >
            {[...new Set([...years, year])]
              .sort((a, b) => b - a)
              .map((y) => (
                <option key={y} value={y}>
                  {y}年
                </option>
              ))}
          </select>
        </label>
        <label className={list.filter}>
          <span>並べ替え</span>
          <select
            aria-label="市場ニーズの並べ替え"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(0);
            }}
          >
            <option value="size">市場規模が大きい順</option>
            <option value="confidence">情報の確度が高い順</option>
            <option value="updated">更新が新しい順</option>
            <option value="title">ニーズ名順</option>
          </select>
        </label>
        <button
          className={`${styles.primaryButton} ${list.addNeed}`}
          onClick={() => onEdit({ kind: "market" })}
        >
          <Plus size={16} />
          市場ニーズを追加
        </button>
      </div>
      <div className={list.filterRow}>
        <label className={list.filter}>
          <span>情報の確度</span>
          <select
            aria-label="情報の確度で絞り込み"
            value={confidence}
            onChange={(e) => {
              setConfidence(e.target.value);
              setPage(0);
            }}
          >
            <option value="">すべて</option>
            {Object.entries(CONFIDENCE_LABEL).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={withoutSource}
            onChange={(e) => {
              setWithoutSource(e.target.checked);
              setPage(0);
            }}
          />
          出典未登録
        </label>
        <span className={styles.muted}>
          {filtered.length}件 / 全{rows.length}市場ニーズ
        </span>
        <span className={styles.muted}>
          順位は{MARKET_SCOPE_LABEL[scope]}・{year}
          年の推計下限で比較。同額は同順位。
        </span>
      </div>
      <div
        className={styles.tableScroll}
        tabIndex={0}
        aria-label="市場ニーズ一覧。狭い画面では表内を横にスクロール"
      >
        <table className={list.marketTable}>
          <colgroup>
            <col style={{ width: "26%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "17%" }} />
            <col style={{ width: "19%" }} />
            <col style={{ width: "12%" }} />
          </colgroup>
          <thead>
            <tr>
              <th>市場ニーズ / 誰の困りごとか</th>
              <th>
                市場規模{" "}
                <small>
                  {MARKET_SCOPE_LABEL[scope]}・{year}年
                </small>
              </th>
              <th>情報の確度</th>
              <th>関連する企業ニーズ</th>
              <th>関連するシーズ</th>
              <th>出典</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => {
              const m = row.market;
              const size = marketSizeFor(m, scope, year);
              const source = m.sources?.[0];
              return (
                <tr
                  key={m.id}
                  className={selected === m.id ? styles.selectedRow : ""}
                >
                  <td>
                    <button
                      className={list.needTitle}
                      aria-expanded={selected === m.id}
                      aria-controls="market-need-detail"
                      onClick={() => show(m.id)}
                    >
                      <strong className={styles.twoLines} title={m.title}>
                        {m.title}
                      </strong>
                      <ChevronDown size={14} />
                    </button>
                    <div className={list.needMeta}>
                      <span className={styles.oneLine} title={m.target_user}>
                        {m.target_user || "対象者未整理"}
                      </span>
                      <button
                        className={styles.editButton}
                        onClick={() => onEdit({ kind: "market", record: m })}
                        aria-label={`${m.title}を編集`}
                        title="編集"
                      >
                        <Pencil size={14} />
                      </button>
                    </div>
                  </td>
                  <td>
                    {size ? (
                      <button
                        className={list.sizeButton}
                        onClick={() => show(m.id)}
                        aria-label={`${m.title}の市場規模の根拠`}
                      >
                        <span className={list.rank}>
                          {ranks.get(m.id)}位 · 推計
                        </span>
                        <strong className={list.amount}>
                          {marketSizeText(size)}
                        </strong>
                      </button>
                    ) : (
                      <span className={styles.muted}>未評価</span>
                    )}
                  </td>
                  <td>
                    <span
                      className={list.confidence}
                      data-rank={m.confidence_rank ?? "unassessed"}
                    >
                      {CONFIDENCE_LABEL[m.confidence_rank ?? "unassessed"]}
                    </span>
                    {m.confidence_note && (
                      <span
                        className={styles.twoLines}
                        title={m.confidence_note}
                      >
                        {m.confidence_note}
                      </span>
                    )}
                  </td>
                  <td>
                    <div className={list.linkStack}>
                      {row.companies.slice(0, 2).map((c) => (
                        <button
                          key={c.id}
                          className={list.inlineLink}
                          onClick={() => onEdit({ kind: "company", record: c })}
                          title={`${c.company_name}｜${c.title}`}
                        >
                          {c.title}
                        </button>
                      ))}
                    </div>
                    {row.companies.length > 2 && (
                      <button
                        className={styles.textButton}
                        onClick={() => show(m.id)}
                      >
                        ほか{row.companies.length - 2}件
                      </button>
                    )}
                    {!row.companies.length && (
                      <span className={styles.muted}>未接続</span>
                    )}
                  </td>
                  <td>
                    <div className={list.linkStack}>
                      {row.seeds.slice(0, 2).map((c) => (
                        <Link
                          className={list.inlineLink}
                          key={c.seed.id}
                          href={`/seeds/${c.seed.id}`}
                          title={`${c.seed.title}｜${c.seed.org_name}・${c.seed.researcher_name}`}
                        >
                          {c.seed.title}
                        </Link>
                      ))}
                    </div>
                    {row.seeds.length > 2 && (
                      <button
                        className={styles.textButton}
                        onClick={() => show(m.id)}
                      >
                        ほか{row.seeds.length - 2}件
                      </button>
                    )}
                    {!row.seeds.length && (
                      <span className={styles.muted}>候補なし</span>
                    )}
                  </td>
                  <td>
                    {source ? (
                      <>
                        {source.url ? (
                          <a
                            className={list.inlineLink}
                            href={source.url}
                            target="_blank"
                            rel="noreferrer"
                            title={source.title}
                          >
                            {source.title}
                          </a>
                        ) : (
                          <button
                            className={list.inlineLink}
                            onClick={() => show(m.id)}
                            title={source.title}
                          >
                            {source.title}
                          </button>
                        )}
                        <button
                          className={styles.textButton}
                          onClick={() => show(m.id)}
                        >
                          {m.sources!.length}件の根拠
                        </button>
                      </>
                    ) : m.source_url ? (
                      <a
                        href={m.source_url}
                        className={styles.textLink}
                        target="_blank"
                        rel="noreferrer"
                      >
                        出典を開く
                        <ExternalLink size={12} />
                      </a>
                    ) : (
                      <button
                        className={styles.textButton}
                        onClick={() => onEdit({ kind: "market", record: m })}
                      >
                        未登録・追加
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!filtered.length && (
        <div className={styles.empty}>
          <strong>
            {rows.length
              ? "条件に一致する市場ニーズなし"
              : "市場ニーズは未登録"}
          </strong>
          <p>市場の課題から登録して、企業ニーズやシーズは後から接続可能。</p>
          {rows.length > 0 && (
            <button className={styles.button} onClick={reset}>
              絞り込みを解除
            </button>
          )}
        </div>
      )}
      <div className={list.pagination}>
        <span>
          {filtered.length
            ? `${currentPage * pageSize + 1}〜${Math.min((currentPage + 1) * pageSize, filtered.length)}件`
            : "0件"}{" "}
          · 1ページ25件
        </span>
        <button
          className={styles.iconButton}
          aria-label="市場ニーズの前のページ"
          disabled={currentPage === 0}
          onClick={() => setPage(currentPage - 1)}
        >
          <ChevronLeft size={16} />
        </button>
        <span>
          {currentPage + 1} / {lastPage + 1}
        </span>
        <button
          className={styles.iconButton}
          aria-label="市場ニーズの次のページ"
          disabled={currentPage === lastPage}
          onClick={() => setPage(currentPage + 1)}
        >
          <ChevronRight size={16} />
        </button>
      </div>
      {selectedRow && (
        <section
          ref={details}
          tabIndex={-1}
          id="market-need-detail"
          className={list.detail}
          aria-label={`${selectedRow.market.title}の詳細`}
        >
          <div className={list.sectionHeading}>
            <div>
              <small>市場ニーズの詳細</small>
              <h2>{selectedRow.market.title}</h2>
            </div>
            <button
              className={styles.iconButton}
              aria-label="市場ニーズの詳細を閉じる"
              onClick={() => setSelected(null)}
            >
              <X size={18} />
            </button>
          </div>
          <div className={list.detailColumns}>
            <section>
              <h3>課題と評価</h3>
              <dl>
                <div className={styles.fact}>
                  <dt>誰の困りごとか</dt>
                  <dd>{selectedRow.market.target_user || "未整理"}</dd>
                </div>
                <div className={styles.fact}>
                  <dt>課題</dt>
                  <dd>{selectedRow.market.problem || "未整理"}</dd>
                </div>
                <div className={styles.fact}>
                  <dt>現在の解決方法</dt>
                  <dd>{selectedRow.market.current_solution || "未整理"}</dd>
                </div>
                <div className={styles.fact}>
                  <dt>実現したい変化</dt>
                  <dd>{selectedRow.market.desired_outcome || "未整理"}</dd>
                </div>
              </dl>
              <p>
                <strong>
                  {
                    CONFIDENCE_LABEL[
                      selectedRow.market.confidence_rank ?? "unassessed"
                    ]
                  }
                </strong>{" "}
                ·{" "}
                {selectedRow.market.confidence_note || "確度の評価理由は未記入"}
              </p>
              {(selectedRow.market.market_sizes ?? []).map((size) => (
                <div
                  key={`${size.scope}:${size.year}`}
                  className={list.estimate}
                >
                  <strong>
                    {MARKET_SCOPE_LABEL[size.scope]}・{size.year}年 ·{" "}
                    {marketSizeText(size)}
                  </strong>
                  <p>対象：{size.definition}</p>
                  <p>{size.basis}</p>
                  <small>
                    出典：
                    {selectedRow.market.sources?.find(
                      (s) => s.id === size.source_id,
                    )?.title || "参照を確認"}
                  </small>
                </div>
              ))}
              {!selectedRow.market.market_sizes?.length && (
                <p className={styles.muted}>国内・世界とも市場規模は未評価。</p>
              )}
              <button
                className={styles.textButton}
                onClick={() =>
                  onEdit({ kind: "market", record: selectedRow.market })
                }
              >
                市場ニーズ・出典・評価を編集
              </button>
            </section>
            <section>
              <h3>出典と確認できた範囲</h3>
              <SourceReadout need={selectedRow.market} />
            </section>
          </div>
          <section>
            <div className={list.sectionHeading}>
              <h3>
                関連する企業ニーズ <span>{selectedRow.companies.length}件</span>
              </h3>
              <button
                className={styles.textButton}
                onClick={() =>
                  onEdit({ kind: "company", marketId: selectedRow.market.id })
                }
              >
                <Plus size={14} />
                企業ニーズを追加
              </button>
            </div>
            {selectedRow.companies.map((c) => (
              <article key={c.id} className={list.relatedRow}>
                <div>
                  <button
                    className={styles.textButton}
                    onClick={() => onEdit({ kind: "company", record: c })}
                  >
                    {c.title}
                  </button>
                  <small>{c.company_name || "企業未特定"}</small>
                </div>
                <p>{c.strengths || "強み未整理"}</p>
                <p>{c.constraints || "採用条件未整理"}</p>
                <button
                  className={styles.textButton}
                  onClick={() => onEdit({ kind: "company", record: c })}
                >
                  条件・出典を確認
                </button>
              </article>
            ))}
            {!selectedRow.companies.length && (
              <p className={styles.muted}>
                企業ニーズは未接続。市場から先に調査可能。
              </p>
            )}
          </section>
          <section>
            <div className={list.sectionHeading}>
              <h3>
                関連するシーズ <span>{selectedRow.seeds.length}件</span>
              </h3>
              <button
                className={styles.textButton}
                onClick={() => onLink(selectedRow.market)}
              >
                <Plus size={14} />
                シーズをリンク
              </button>
            </div>
            {selectedRow.seeds.map((candidate) => (
              <article className={list.seedDetail} key={candidate.seed.id}>
                <div>
                  <Link
                    className={styles.seedLink}
                    href={`/seeds/${candidate.seed.id}`}
                  >
                    {candidate.seed.title}
                  </Link>
                  <small>
                    {candidate.seed.org_name} · {candidate.seed.researcher_name}
                  </small>
                </div>
                {candidate.direct && (
                  <div>
                    <small>市場ニーズに直接関連づけ</small>
                    <p>{candidate.direct.rationale}</p>
                    <p>{candidate.direct.gap || "追加検証は未整理"}</p>
                    <button
                      className={styles.textButton}
                      onClick={() =>
                        onLink(selectedRow.market, candidate.direct)
                      }
                    >
                      リンクの理由を編集
                    </button>
                  </div>
                )}
                {candidate.matches.map((match) => (
                  <div key={match.id}>
                    <small>
                      企業ニーズ経由：
                      {
                        selectedRow.companies.find(
                          (c) => c.id === match.company_need_id,
                        )?.title
                      }
                    </small>
                    <p>{match.rationale || "関連の理由は未記入"}</p>
                    <button
                      className={styles.textButton}
                      onClick={() => onEdit({ kind: "match", record: match })}
                    >
                      関連の理由・検証事項
                    </button>
                  </div>
                ))}
                {!!candidate.research.length && (
                  <p className={styles.muted}>
                    研究構想内の候補：
                    {candidate.research.map((r) => r.title).join("、")}
                    。個別適合は未確認。
                  </p>
                )}
              </article>
            ))}
            {!selectedRow.seeds.length && (
              <p className={styles.muted}>
                候補シーズなし。必要な機能から今後の研究を検討。
              </p>
            )}
          </section>
        </section>
      )}
      <p className={styles.footnote}>
        一行は一つの市場ニーズ。関連シーズは候補であり適合確認済みを意味しない。市場規模の推計とニーズ情報の確度は独立して比較。
      </p>
    </>
  );
}
