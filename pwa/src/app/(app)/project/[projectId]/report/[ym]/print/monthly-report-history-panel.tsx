"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  diffMonthlyReportLines,
  monthlyReportHistoryActionLabel,
  type MonthlyReportHistoryListItem,
  type MonthlyReportKind,
} from "@/lib/monthly-report-history";

type HistoryDetail = { id: string; before: string; after: string; detailAvailable: boolean };

function formatHistoryTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function actorKindLabel(kind: MonthlyReportHistoryListItem["actorKind"]): string {
  if (kind === "member") return "人による編集";
  if (kind === "automation") return "自動処理";
  if (kind === "legacy") return "移行履歴";
  return "システム処理";
}

export function MonthlyReportHistoryPanel({
  projectId,
  ym,
  currentKind,
  refreshToken,
}: {
  projectId: string;
  ym: string;
  currentKind: MonthlyReportKind;
  refreshToken: number;
}) {
  const [history, setHistory] = useState<MonthlyReportHistoryListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<MonthlyReportKind>(currentKind);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<HistoryDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const detailRequestRef = useRef(0);

  const loadHistory = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/monthly-report/history?projectId=${encodeURIComponent(projectId)}&ym=${encodeURIComponent(ym)}`,
        { cache: "no-store", signal },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "編集履歴を取得できませんでした");
      setHistory(Array.isArray(result.history) ? result.history : []);
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setError(caught instanceof Error ? caught.message : "編集履歴を取得できませんでした");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [projectId, ym]);

  useEffect(() => {
    const controller = new AbortController();
    void loadHistory(controller.signal);
    return () => controller.abort();
  }, [loadHistory, refreshToken]);

  useEffect(() => setTab(currentKind), [currentKind]);

  const closePanel = useCallback(() => {
    detailRequestRef.current += 1;
    setOpen(false);
    setSelectedId(null);
    setDetail(null);
    setDetailLoading(false);
    setDetailError("");
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closePanel();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = [...panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      )];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [closePanel, open]);

  const visibleHistory = useMemo(
    () => history.filter((item) => item.reportKind === tab),
    [history, tab],
  );
  const latest = useMemo(
    () => history.find((item) => item.reportKind === currentKind) ?? null,
    [currentKind, history],
  );

  const openDetail = useCallback(async (item: MonthlyReportHistoryListItem) => {
    const requestId = ++detailRequestRef.current;
    if (selectedId === item.id) {
      setSelectedId(null);
      setDetail(null);
      setDetailLoading(false);
      setDetailError("");
      return;
    }
    setSelectedId(item.id);
    setDetail(null);
    setDetailLoading(false);
    setDetailError("");
    if (!item.detailAvailable) return;
    setDetailLoading(true);
    try {
      const response = await fetch(
        `/api/monthly-report/history?projectId=${encodeURIComponent(projectId)}&ym=${encodeURIComponent(ym)}&id=${encodeURIComponent(item.id)}`,
        { cache: "no-store" },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "差分を取得できませんでした");
      if (detailRequestRef.current === requestId) setDetail(result.detail as HistoryDetail);
    } catch (caught) {
      if (detailRequestRef.current === requestId) {
        setDetailError(caught instanceof Error ? caught.message : "差分を取得できませんでした");
      }
    } finally {
      if (detailRequestRef.current === requestId) setDetailLoading(false);
    }
  }, [projectId, selectedId, ym]);

  const diffRows = useMemo(
    () => detail ? diffMonthlyReportLines(detail.before, detail.after) : [],
    [detail],
  );

  return (
    <>
      <div className="history-strip no-print" aria-live="polite">
        <div className="history-strip-copy">
          <span className="history-strip-label">最終更新</span>
          {loading ? (
            <span>履歴を確認中…</span>
          ) : error ? (
            <span className="history-strip-error">履歴を取得できませんでした</span>
          ) : latest ? (
            <span>
              <strong>{latest.actorName}</strong>
              <span className="history-strip-dot">·</span>
              {formatHistoryTime(latest.createdAt)}
              <span className="history-strip-dot">·</span>
              {monthlyReportHistoryActionLabel(latest.action)}
            </span>
          ) : (
            <span>記録はまだありません</span>
          )}
        </div>
        <button
          ref={triggerRef}
          type="button"
          className="history-open"
          onClick={() => {
            setTab(currentKind);
            setOpen(true);
          }}
          aria-haspopup="dialog"
          aria-controls="monthly-report-history-dialog"
        >
          編集履歴を見る
        </button>
      </div>

      {open && (
        <div className="history-backdrop no-print" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closePanel();
        }}>
          <aside id="monthly-report-history-dialog" ref={panelRef} className="history-panel" role="dialog" aria-modal="true" aria-labelledby="history-title">
            <header className="history-panel-header">
              <div>
                <span className="history-kicker">校正台帳</span>
                <h2 id="history-title">月次報告書の編集履歴</h2>
              </div>
              <button ref={closeRef} type="button" className="history-close" onClick={closePanel} aria-label="編集履歴を閉じる">×</button>
            </header>

            <div className="history-tabs" role="tablist" aria-label="報告書の種類">
              {(["internal", "external"] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  role="tab"
                  aria-selected={tab === kind}
                  className={tab === kind ? "is-active" : undefined}
                  onClick={() => {
                    detailRequestRef.current += 1;
                    setTab(kind);
                    setSelectedId(null);
                    setDetail(null);
                    setDetailLoading(false);
                    setDetailError("");
                  }}
                >
                  {kind === "internal" ? "社内版" : "提出版"}
                </button>
              ))}
            </div>

            <div className="history-panel-body">
              {loading && <div className="history-state" role="status">編集履歴を読み込んでる…</div>}
              {!loading && error && (
                <div className="history-state history-state-error" role="alert">
                  <p>{error}</p>
                  <button type="button" onClick={() => void loadHistory()}>再読み込み</button>
                </div>
              )}
              {!loading && !error && visibleHistory.length === 0 && (
                <div className="history-state">{tab === "internal" ? "社内版" : "提出版"}の履歴はまだありません。</div>
              )}
              {!loading && !error && visibleHistory.map((item) => {
                const expanded = selectedId === item.id;
                return (
                  <article className="history-event" key={item.id}>
                    <button
                      type="button"
                      className="history-event-summary"
                      onClick={() => void openDetail(item)}
                      aria-expanded={expanded}
                    >
                      <span className="history-timeline-mark" aria-hidden="true" />
                      <span className="history-event-main">
                        <span className="history-event-topline">
                          <strong>{monthlyReportHistoryActionLabel(item.action)}</strong>
                          <time dateTime={item.createdAt}>{formatHistoryTime(item.createdAt)}</time>
                        </span>
                        <span className="history-actor">{item.actorName}<span>{actorKindLabel(item.actorKind)}</span></span>
                        {item.changedSections.length > 0 && (
                          <span className="history-sections">
                            {item.changedSections.map((section) => <span key={section}>{section}</span>)}
                          </span>
                        )}
                      </span>
                      <span className="history-chevron" aria-hidden="true">{expanded ? "−" : "+"}</span>
                    </button>

                    {expanded && (
                      <div className="history-detail">
                        {!item.detailAvailable && <p className="history-legacy">過去分のため、正確な変更前後は残っていません。</p>}
                        {detailLoading && <p className="history-detail-state" role="status">差分を読み込んでる…</p>}
                        {detailError && <p className="history-detail-state history-strip-error" role="alert">{detailError}</p>}
                        {detail && (
                          <div className="history-diff" aria-label="変更前後の行差分">
                            <div className="history-diff-legend"><span className="removed">− 変更前</span><span className="added">＋ 変更後</span></div>
                            <pre>
                              {diffRows.map((row, index) => (
                                <span className={`diff-row ${row.kind}`} key={`${index}-${row.kind}`}>
                                  <span className="diff-sign">{row.kind === "removed" ? "−" : row.kind === "added" ? "+" : " "}</span>
                                  <span className="diff-line">{row.beforeLine ?? ""}</span>
                                  <span className="diff-line">{row.afterLine ?? ""}</span>
                                  <span className="diff-text">{row.text || " "}</span>
                                </span>
                              ))}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </aside>
        </div>
      )}

      <style jsx>{`
        .history-strip { position: sticky; top: 56px; z-index: 9; display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 44px; padding: 6px 16px; border-bottom: 1px solid #cbd5e1; background: #fffdf7; color: #475569; box-sizing: border-box; font-size: 12px; box-shadow: 0 1px 4px rgba(15,23,42,.06); }
        .history-strip-copy { display: flex; align-items: center; gap: 8px; min-width: 0; }
        .history-strip-label { flex: 0 0 auto; color: #0f172a; font-weight: 700; }
        .history-strip-dot { margin: 0 6px; color: #94a3b8; }
        .history-strip-error { color: #b91c1c; }
        .history-open { flex: 0 0 auto; min-height: 32px; padding: 5px 10px; border: 1px solid #94a3b8; border-radius: 4px; background: white; color: #0f172a; font-weight: 700; cursor: pointer; }
        .history-open:hover, .history-open:focus-visible { border-color: #0369a1; color: #0369a1; }
        .history-backdrop { position: fixed; inset: 0; z-index: 100; background: rgba(15,23,42,.32); backdrop-filter: blur(2px); }
        .history-panel { position: absolute; inset: 0 0 0 auto; display: flex; flex-direction: column; width: min(440px, 100vw); border-left: 1px solid #94a3b8; background: #fffdf7; color: #0f172a; box-shadow: -12px 0 40px rgba(15,23,42,.18); }
        .history-panel-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 20px 20px 14px; border-top: 3px solid #0a1628; border-bottom: 1px solid #cbd5e1; }
        .history-kicker { display: block; margin-bottom: 3px; color: #0369a1; font-size: 10px; font-weight: 800; letter-spacing: .16em; }
        h2 { margin: 0; font-size: 18px; }
        .history-close { width: 36px; height: 36px; border: 1px solid #cbd5e1; border-radius: 4px; background: white; color: #334155; font-size: 23px; line-height: 1; cursor: pointer; }
        .history-close:hover, .history-close:focus-visible { border-color: #0369a1; color: #0369a1; }
        .history-tabs { display: grid; grid-template-columns: 1fr 1fr; padding: 10px 20px 0; border-bottom: 1px solid #cbd5e1; }
        .history-tabs button { min-height: 42px; border: 0; border-bottom: 2px solid transparent; background: transparent; color: #64748b; font-weight: 700; cursor: pointer; }
        .history-tabs button.is-active { border-bottom-color: #0369a1; color: #0f172a; }
        .history-panel-body { flex: 1; min-height: 0; overflow-y: auto; padding: 8px 20px 32px; }
        .history-state { margin-top: 16px; padding: 20px; border: 1px dashed #cbd5e1; background: white; color: #64748b; text-align: center; }
        .history-state p { margin: 0 0 12px; }
        .history-state button { min-height: 36px; border: 1px solid #94a3b8; background: white; cursor: pointer; }
        .history-state-error { color: #b91c1c; }
        .history-event { position: relative; border-bottom: 1px solid #e2e8f0; }
        .history-event-summary { position: relative; display: grid; grid-template-columns: 14px minmax(0,1fr) 24px; gap: 9px; width: 100%; padding: 16px 0; border: 0; background: transparent; color: inherit; text-align: left; cursor: pointer; }
        .history-event-summary:hover .history-event-main strong, .history-event-summary:focus-visible .history-event-main strong { color: #0369a1; }
        .history-timeline-mark { width: 8px; height: 8px; margin-top: 5px; border: 2px solid #0369a1; border-radius: 50%; background: #fffdf7; box-sizing: border-box; }
        .history-event::before { content: ""; position: absolute; top: 26px; bottom: -9px; left: 3px; width: 1px; background: #cbd5e1; }
        .history-event:last-child::before { display: none; }
        .history-event-main { min-width: 0; }
        .history-event-topline { display: flex; justify-content: space-between; gap: 10px; }
        .history-event-topline strong { font-size: 13px; }
        .history-event-topline time { flex: 0 0 auto; color: #64748b; font-family: 'JetBrains Mono', monospace; font-size: 10px; }
        .history-actor { display: flex; align-items: center; gap: 8px; margin-top: 5px; color: #334155; font-size: 12px; }
        .history-actor > span { padding: 2px 5px; border: 1px solid #cbd5e1; background: white; color: #64748b; font-size: 9px; }
        .history-sections { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 7px; }
        .history-sections > span { padding: 2px 6px; border-left: 2px solid #38bdf8; background: #f0f9ff; color: #0c4a6e; font-size: 10px; }
        .history-chevron { color: #64748b; font-size: 18px; text-align: center; }
        .history-detail { margin: -4px 0 14px 23px; border: 1px solid #cbd5e1; background: white; }
        .history-legacy, .history-detail-state { margin: 0; padding: 14px; color: #64748b; font-size: 12px; }
        .history-diff { overflow: hidden; }
        .history-diff-legend { display: flex; gap: 14px; padding: 8px 10px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; font-size: 10px; }
        .history-diff-legend .removed { color: #991b1b; }
        .history-diff-legend .added { color: #166534; }
        pre { max-height: 420px; margin: 0; overflow: auto; padding: 8px 0; font: 10px/1.55 'JetBrains Mono', ui-monospace, monospace; }
        .diff-row { display: grid; grid-template-columns: 18px 34px 34px minmax(max-content,1fr); min-width: max-content; padding-right: 10px; white-space: pre; }
        .diff-row.removed { background: #fef2f2; color: #7f1d1d; }
        .diff-row.added { background: #f0fdf4; color: #14532d; }
        .diff-sign, .diff-line { color: #94a3b8; text-align: right; user-select: none; }
        .diff-sign { padding-right: 5px; }
        .diff-line { padding-right: 7px; }
        .diff-text { padding-left: 7px; border-left: 1px solid #e2e8f0; }
        button:focus-visible { outline: 2px solid #0369a1; outline-offset: 2px; }
        @media screen and (max-width: 760px) {
          .history-strip { position: relative; top: auto; align-items: flex-start; padding: 8px 10px; }
          .history-strip-copy { display: block; line-height: 1.55; }
          .history-strip-label { display: block; }
          .history-open { min-height: 44px; }
          .history-panel { inset: auto 0 0; width: 100%; max-height: 84dvh; border: 1px solid #94a3b8; border-bottom: 0; border-radius: 8px 8px 0 0; }
          .history-panel-header { padding: 14px 14px 10px; }
          .history-close { width: 44px; height: 44px; }
          .history-tabs { padding: 6px 14px 0; }
          .history-tabs button { min-height: 44px; }
          .history-panel-body { padding: 6px 14px 24px; }
          .history-event-summary { min-height: 72px; }
          .history-event-topline { display: block; }
          .history-event-topline time { display: block; margin-top: 3px; }
          .history-detail { margin-left: 0; }
        }
      `}</style>
    </>
  );
}
