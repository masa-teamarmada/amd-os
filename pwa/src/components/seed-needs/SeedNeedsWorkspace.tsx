"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Plus,
  RefreshCw,
  Search,
  Pencil,
} from "lucide-react";
import { fetchSeedNeeds, saveNeedResearch } from "@/lib/seed-needs-data";
import {
  joinSeedNeeds,
  filterNeedRows,
  EVIDENCE_LABEL,
  MATCH_LABEL,
  type NeedDataset,
  type NeedKind,
  type SeedNeedsData,
  type MarketNeed,
  type CompanyNeed,
  type SeedNeedMatch,
  type NeedRow,
} from "@/lib/seed-needs";
import { NeedEditor, type EditorSelection } from "./NeedEditor";
import styles from "./seed-needs.module.css";
import { ExplorationBoard } from "./ExplorationBoard";
import { MarketNeedsList } from "./MarketNeedsList";
import { MarketSeedEditor } from "./MarketSeedEditor";
import type { MarketSeedLink } from "@/lib/seed-needs";

type View = "exploration" | "connections" | "markets" | "companies";
const VIEW_LABEL: Record<View, string> = {
  markets: "市場ニーズ",
  companies: "企業ニーズ",
  connections: "接続の記録",
  exploration: "関係図・研究構想",
};
const empty = "未整理";
function Fact({ label, text }: { label: string; text?: string | null }) {
  return (
    <div className={styles.fact}>
      <dt>{label}</dt>
      <dd>{text || empty}</dd>
    </div>
  );
}
function Evidence({ record }: { record: MarketNeed | CompanyNeed }) {
  return (
    <>
      <p>
        <span className={styles.badge}>
          {EVIDENCE_LABEL[record.evidence_status]}
        </span>{" "}
        {record.observed_on && (
          <span className={styles.muted}>{record.observed_on}</span>
        )}
      </p>
      <p>{record.evidence_note || "根拠未記入"}</p>
      {/^https?:\/\//.test(record.source_url) && (
        <a
          className={styles.textLink}
          href={record.source_url}
          target="_blank"
          rel="noreferrer"
        >
          出典を開く <ExternalLink size={12} />
        </a>
      )}
    </>
  );
}

export function SeedNeedsWorkspace() {
  const [data, setData] = useState<SeedNeedsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dataset, setDataset] = useState<NeedDataset>("example");
  const [view, setView] = useState<View>("markets");
  const [query, setQuery] = useState("");
  const [unlinked, setUnlinked] = useState(false);
  const [institution, setInstitution] = useState("");
  const [composing, setComposing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [marketLink, setMarketLink] = useState<{
    market: MarketNeed;
    original?: MarketSeedLink;
  } | null>(null);
  const [selection, setSelection] = useState<EditorSelection | null>(null);
  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError("");
    try {
      setData(await fetchSeedNeeds(force));
    } catch (e) {
      setError(e instanceof Error ? e.message : "読み込みに失敗");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const rows = useMemo(
    () => (data ? joinSeedNeeds(data, dataset) : []),
    [data, dataset],
  );
  const filtered = useMemo(
    () => filterNeedRows(rows, query, unlinked, institution),
    [rows, query, unlinked, institution],
  );
  const companies = (data?.companies ?? []).filter(
    (x) =>
      x.dataset === dataset &&
      `${x.title} ${x.company_name} ${x.business_area} ${x.strengths} ${x.missing_capability}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const institutions = useMemo(
    () =>
      [
        ...new Map(
          (data?.seeds ?? [])
            .filter((x) => x.institution_id)
            .map((x) => [x.institution_id!, x.org_name || x.institution_id!]),
        ).entries(),
      ].sort((a, b) => a[1].localeCompare(b[1], "ja")),
    [data],
  );
  function openEditor(
    kind: NeedKind,
    record?: MarketNeed | CompanyNeed | SeedNeedMatch,
  ) {
    setSelection({ kind, record });
    setNotice("");
  }
  function saved(
    kind: NeedKind,
    record: MarketNeed | CompanyNeed | SeedNeedMatch,
  ) {
    setData((previous) => {
      if (!previous) return previous;
      const key =
        kind === "market"
          ? "markets"
          : kind === "company"
            ? "companies"
            : "matches";
      const items = previous[key] as (
        MarketNeed | CompanyNeed | SeedNeedMatch
      )[];
      return {
        ...previous,
        [key]: items.some((x) => x.id === record.id)
          ? items.map((x) => (x.id === record.id ? record : x))
          : [...items, record],
      };
    });
    setSelection(null);
    setNotice("保存済み");
  }
  function details(row: NeedRow) {
    return (
      <div className={styles.detailGrid}>
        <section>
          <h3>市場の課題と根拠</h3>
          {row.market ? (
            <>
              <dl>
                <Fact label="困りごと" text={row.market.problem} />
                <Fact label="対象者" text={row.market.target_user} />
                <Fact
                  label="現在の解決方法"
                  text={row.market.current_solution}
                />
                <Fact
                  label="実現したい変化"
                  text={row.market.desired_outcome}
                />
              </dl>
              <Evidence record={row.market} />
              <button
                className={styles.textButton}
                onClick={() => openEditor("market", row.market)}
              >
                市場ニーズを編集
              </button>
            </>
          ) : (
            <p>市場との関係は未整理</p>
          )}
        </section>
        <section>
          <h3>企業の採用条件と根拠</h3>
          {row.company ? (
            <>
              <dl>
                <Fact label="事業領域" text={row.company.business_area} />
                <Fact label="強み" text={row.company.strengths} />
                <Fact label="方針" text={row.company.strategic_intent} />
                <Fact
                  label="不足する技術・検証"
                  text={row.company.missing_capability}
                />
                <Fact label="採用条件・制約" text={row.company.constraints} />
              </dl>
              <Evidence record={row.company} />
              <button
                className={styles.textButton}
                onClick={() => openEditor("company", row.company)}
              >
                企業ニーズを編集
              </button>
            </>
          ) : (
            <button
              className={styles.textButton}
              onClick={() =>
                setSelection({ kind: "company", marketId: row.market?.id })
              }
            >
              企業ニーズを追加
            </button>
          )}
        </section>
        <section>
          <h3>
            追加研究・PoCの進め方{" "}
            {row.match && (
              <span className={styles.badge}>
                {MATCH_LABEL[row.match.status]}
              </span>
            )}
          </h3>
          {row.match ? (
            <>
              <dl>
                <Fact
                  label="接続シーズ"
                  text={
                    row.seed
                      ? `${row.seed.title}｜${row.seed.org_name}・${row.seed.researcher_name}`
                      : "シーズ参照を確認"
                  }
                />
                <Fact label="検証の問い" text={row.match.research_question} />
                <Fact label="結ぶ理由" text={row.match.rationale} />
                <Fact label="実験案" text={row.match.experiment} />
                <Fact label="判定基準" text={row.match.success_criteria} />
                <Fact label="予算・実施条件" text={row.match.funding_note} />
                <Fact label="次に確認すること" text={row.match.next_action} />
                <Fact
                  label="次の担当・期限"
                  text={[
                    row.match.owner_name || "担当未定",
                    row.match.due_on || "期限未定",
                  ].join(" / ")}
                />
              </dl>
              <button
                className={styles.textButton}
                onClick={() => openEditor("match", row.match)}
              >
                組み合わせを編集
              </button>
            </>
          ) : (
            <>
              <p>候補シーズを探索する段階</p>
              {row.company && (
                <button
                  className={styles.textButton}
                  onClick={() =>
                    setSelection({ kind: "match", companyId: row.company?.id })
                  }
                >
                  シーズを接続
                </button>
              )}
            </>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className={styles.workspace}>
      <header className={styles.header}>
        <div>
          <h1>市場ニーズ</h1>
          <p>市場の課題を起点に、企業ニーズ・シーズ・根拠をつなぐ。</p>
        </div>
        <div className={styles.headerActions}>
          <Link href="/seeds" className={styles.textLink}>
            既存シーズ台帳 <ArrowRight size={16} />
          </Link>
          <button
            className={styles.iconButton}
            aria-label="探索データを更新"
            disabled={loading || composing}
            onClick={() => void load(true)}
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </header>
      <div className={styles.datasetBar}>
        <div className={styles.segment} aria-label="データの区分">
          {(["working", "example"] as const).map((value) => (
            <button
              key={value}
              disabled={composing}
              aria-pressed={dataset === value}
              onClick={() => {
                setDataset(value);
                setExpanded(null);
                setNotice("");
              }}
            >
              {value === "working" ? "実際の蓄積" : "議論用の記入例"}
              <span>
                {data
                  ? data.markets.filter((m) => m.dataset === value).length
                  : "—"}
              </span>
            </button>
          ))}
        </div>
        <p>
          {dataset === "example"
            ? "実在するシーズに、仮の企業像・未確認のニーズを接続。会議中に編集できる原案。"
            : "調査・ヒアリングで得たニーズを、根拠と確認状況を付けて蓄積。"}
        </p>
      </div>
      <div className={styles.tabs} role="tablist" aria-label="一覧の種類">
        {(Object.keys(VIEW_LABEL) as View[]).map((value) => (
          <button
            key={value}
            disabled={composing}
            role="tab"
            id={`tab-${value}`}
            aria-controls="needs-panel"
            aria-selected={view === value}
            onClick={() => {
              setView(value);
              setQuery("");
              setExpanded(null);
            }}
          >
            {VIEW_LABEL[value]}
          </button>
        ))}
      </div>
      {view !== "exploration" && view !== "markets" && (
        <div className={styles.toolbar}>
          <label className={styles.search}>
            <Search size={16} />
            <input
              aria-label="ニーズ・企業・シーズを検索"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ニーズ・企業・技術・研究者を検索"
            />
          </label>
          {view === "connections" && (
            <>
              <select
                aria-label="シーズの研究機関"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
              >
                <option value="">全研究機関</option>
                {institutions.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={unlinked}
                  onChange={(e) => setUnlinked(e.target.checked)}
                />
                未接続のみ
              </label>
            </>
          )}
          <button
            className={styles.iconButton}
            aria-label="一覧を更新"
            title="一覧を更新"
            onClick={() => {
              setNotice("");
              void load(true);
            }}
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? styles.spin : ""} />
          </button>
          <button
            className={styles.primaryButton}
            disabled={!data || loading}
            onClick={() =>
              openEditor(view === "connections" ? "match" : "company")
            }
          >
            <Plus size={16} />
            {view === "connections" ? "組み合わせ" : "企業ニーズ"}を追加
          </button>
        </div>
      )}
      {error && (
        <div role="alert" className={styles.error}>
          {error}{" "}
          <button className={styles.textButton} onClick={() => void load(true)}>
            再読み込み
          </button>
        </div>
      )}
      {notice && (
        <p role="status" className={styles.notice}>
          {notice}
        </p>
      )}
      <div
        id="needs-panel"
        role="tabpanel"
        aria-labelledby={`tab-${view}`}
        aria-busy={loading}
      >
        {view === "markets" && data && (
          <MarketNeedsList
            key={dataset}
            data={data}
            dataset={dataset}
            onEdit={setSelection}
            onLink={(market, original) => setMarketLink({ market, original })}
          />
        )}
        {view === "exploration" && data && !loading && (
          <ExplorationBoard
            key={dataset}
            data={data}
            dataset={dataset}
            onEdit={setSelection}
            onEditingChange={setComposing}
            saveResearch={saveNeedResearch}
            onResearchSaved={(record) => {
              setData((old) =>
                old
                  ? {
                      ...old,
                      research: [
                        ...(old.research ?? []).filter(
                          (r) => r.id !== record.id,
                        ),
                        record,
                      ],
                    }
                  : old,
              );
              setNotice("研究仮説を保存済み");
            }}
          />
        )}
        {!data && loading ? (
          <div className={styles.skeleton} role="status">
            市場ニーズ・企業ニーズ・既存シーズを読み込み中…
            <div />
            <div />
            <div />
          </div>
        ) : (
          data &&
          view !== "exploration" &&
          view !== "markets" && (
            <>
              <div className={styles.countLine}>
                <span>
                  {view === "connections"
                    ? `${filtered.length}行 / ${rows.length}行`
                    : `${companies.length}件`}
                </span>
                <span>
                  {dataset === "example"
                    ? "記入例のニーズはすべて仮説"
                    : "仮説と確認済みを区別して記録"}
                </span>
                <span>
                  {view === "connections"
                    ? "行を開くと根拠・実験案・予算条件"
                    : "鉛筆から全文・根拠を確認して編集"}
                </span>
              </div>
              <div
                className={styles.tableScroll}
                tabIndex={0}
                aria-label="ニーズ一覧。狭い画面では横にスクロール"
              >
                {view === "connections" && (
                  <table className={styles.connections}>
                    <colgroup>
                      <col style={{ width: "16%" }} />
                      <col style={{ width: "17%" }} />
                      <col style={{ width: "17%" }} />
                      <col style={{ width: "19%" }} />
                      <col style={{ width: "17%" }} />
                      <col style={{ width: "14%" }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>市場ニーズ</th>
                        <th>企業のフィルター</th>
                        <th>企業としてのニーズ</th>
                        <th>接続するシーズ</th>
                        <th>追加研究・PoCの問い</th>
                        <th>次に確認すること</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((row) => (
                        <Fragment key={row.key}>
                          <tr
                            className={
                              expanded === row.key ? styles.selectedRow : ""
                            }
                          >
                            <td>
                              <button
                                className={styles.rowToggle}
                                onClick={() =>
                                  setExpanded(
                                    expanded === row.key ? null : row.key,
                                  )
                                }
                                aria-expanded={expanded === row.key}
                                aria-controls={`detail-${row.key}`}
                                title={row.market?.title}
                              >
                                {expanded === row.key ? (
                                  <ChevronDown size={16} />
                                ) : (
                                  <ChevronRight size={16} />
                                )}
                                <strong className={styles.twoLines}>
                                  {row.market?.title || "市場ニーズ未接続"}
                                </strong>
                              </button>
                            </td>
                            <td>
                              <strong
                                className={styles.oneLine}
                                title={row.company?.company_name}
                              >
                                {row.company?.company_name.replace(
                                  "仮の企業像｜",
                                  "",
                                ) || "企業像未整理"}
                              </strong>
                              <span
                                className={styles.oneLine}
                                title={`領域: ${row.company?.business_area} / 強み: ${row.company?.strengths}`}
                              >
                                {row.company?.strengths ||
                                  "事業領域・強みを検討"}
                              </span>
                            </td>
                            <td>
                              <strong
                                className={styles.twoLines}
                                title={row.company?.title}
                              >
                                {row.company?.title || "企業ニーズ未接続"}
                              </strong>
                              {dataset === "working" && row.company && (
                                <span className={styles.badge}>
                                  {EVIDENCE_LABEL[row.company.evidence_status]}
                                </span>
                              )}
                            </td>
                            <td>
                              {row.seed ? (
                                <Link
                                  href={`/seeds/${row.seed.id}`}
                                  className={`${styles.seedLink} ${styles.twoLines}`}
                                  title={`${row.seed.title}｜${row.seed.org_name}・${row.seed.researcher_name}`}
                                >
                                  {row.seed.title}
                                </Link>
                              ) : (
                                <span className={styles.unlinked}>
                                  シーズ未接続
                                </span>
                              )}
                            </td>
                            <td>
                              <span
                                className={styles.twoLines}
                                title={row.match?.research_question}
                              >
                                {row.match?.research_question ||
                                  "企業ニーズを具体化して設定"}
                              </span>
                            </td>
                            <td>
                              <div className={styles.actionCell}>
                                <span
                                  className={styles.twoLines}
                                  title={
                                    row.match?.next_action ||
                                    row.company?.constraints
                                  }
                                >
                                  {row.match?.next_action ||
                                    row.company?.constraints ||
                                    "企業像・事業領域を検討"}
                                </span>
                                <button
                                  className={styles.editButton}
                                  aria-label={`${row.company?.title || row.market?.title}の${row.match ? "組み合わせを編集" : row.company ? "シーズを接続" : "企業ニーズを追加"}`}
                                  onClick={() =>
                                    row.match
                                      ? openEditor("match", row.match)
                                      : row.company
                                        ? setSelection({
                                            kind: "match",
                                            companyId: row.company.id,
                                          })
                                        : setSelection({
                                            kind: "company",
                                            marketId: row.market?.id,
                                          })
                                  }
                                >
                                  {row.match ? (
                                    <Pencil size={14} />
                                  ) : (
                                    <Plus size={14} />
                                  )}
                                </button>
                              </div>
                            </td>
                          </tr>
                          {expanded === row.key && (
                            <tr id={`detail-${row.key}`}>
                              <td colSpan={6} className={styles.expandedCell}>
                                {details(row)}
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                )}
                {view === "companies" && (
                  <table className={styles.catalog}>
                    <thead>
                      <tr>
                        <th>企業 / 事業領域</th>
                        <th>得意技術・活用できる資産</th>
                        <th>企業としてのニーズ</th>
                        <th>元の市場 / 確認状況</th>
                        <th>接続 / 操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {companies.map((c) => (
                        <tr key={c.id}>
                          <td>
                            <strong
                              className={styles.oneLine}
                              title={c.company_name}
                            >
                              {c.company_name.replace("仮の企業像｜", "") ||
                                "企業未特定"}
                            </strong>
                            <span
                              className={styles.oneLine}
                              title={c.business_area}
                            >
                              {c.business_area || empty}
                            </span>
                          </td>
                          <td>
                            <span
                              className={styles.twoLines}
                              title={c.strengths}
                            >
                              {c.strengths || empty}
                            </span>
                          </td>
                          <td>
                            <strong className={styles.twoLines} title={c.title}>
                              {c.title}
                            </strong>
                          </td>
                          <td>
                            <span
                              className={styles.oneLine}
                              title={
                                data.markets.find(
                                  (m) => m.id === c.market_need_id,
                                )?.title
                              }
                            >
                              {data.markets.find(
                                (m) => m.id === c.market_need_id,
                              )?.title || "市場ニーズ未接続"}
                            </span>
                            <span className={styles.badge}>
                              {EVIDENCE_LABEL[c.evidence_status]}
                            </span>
                          </td>
                          <td>
                            <div className={styles.catalogActions}>
                              <span>
                                {
                                  data.matches.filter(
                                    (m) => m.company_need_id === c.id,
                                  ).length
                                }{" "}
                                シーズ
                              </span>
                              <button
                                className={styles.editButton}
                                title="全文を確認・編集"
                                aria-label={`${c.title}の企業ニーズを編集`}
                                onClick={() => openEditor("company", c)}
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                className={styles.editButton}
                                title="シーズを接続"
                                aria-label={`${c.title}にシーズを接続`}
                                onClick={() =>
                                  setSelection({
                                    kind: "match",
                                    companyId: c.id,
                                  })
                                }
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              {(view === "connections"
                ? !filtered.length
                : !companies.length) && (
                <div className={styles.empty}>
                  <strong>
                    {query || unlinked || institution
                      ? "条件に一致する項目なし"
                      : "登録なし"}
                  </strong>
                  <p>
                    {query || unlinked || institution
                      ? "検索語や絞り込み条件を変更して確認。"
                      : "「市場ニーズ」または「企業ニーズ」から追加。シーズとの接続は後からでも可能。"}
                  </p>
                  {(query || unlinked || institution) && (
                    <button
                      className={styles.button}
                      onClick={() => {
                        setQuery("");
                        setUnlinked(false);
                        setInstitution("");
                      }}
                    >
                      絞り込みを解除
                    </button>
                  )}
                </div>
              )}
            </>
          )
        )}
      </div>
      {view === "connections" && (
        <p className={styles.footnote}>
          1行は企業ニーズとシーズの組み合わせ。同じ市場・シーズを複数行で参照。市場や企業から先に登録し、研究候補を後から接続できる。
        </p>
      )}
      {marketLink && data && (
        <MarketSeedEditor
          market={marketLink.market}
          original={marketLink.original}
          seeds={data.seeds}
          onClose={() => setMarketLink(null)}
          onSaved={(record) => {
            setData((old) =>
              old
                ? {
                    ...old,
                    marketSeedLinks: [
                      ...(old.marketSeedLinks ?? []).filter(
                        (link) => link.id !== record.id,
                      ),
                      record,
                    ],
                  }
                : old,
            );
            setMarketLink(null);
            setNotice("シーズのリンクを保存済み");
          }}
        />
      )}
      {selection && data && (
        <NeedEditor
          selection={selection}
          dataset={dataset}
          data={data}
          onClose={() => setSelection(null)}
          onSaved={saved}
        />
      )}
    </div>
  );
}
