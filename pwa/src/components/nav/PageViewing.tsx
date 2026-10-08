"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { History, Users, X } from "lucide-react";
import { PAGE_VIEWING_REFRESH_MS, PAGE_VIEWING_EXPIRY_MS, type PageViewingInput, type PageViewingSnapshot } from "@/lib/page-viewing-core";

function selectedPage(pathname: string): PageViewingInput | null {
  const dataset = document.documentElement.dataset;
  if (/^\/(?:project\/[^/]+\/(?:cockpit|workspace)$|dd\/[^/]+)/.test(pathname) && dataset.amiePagePath !== pathname) return null;
  return { pathname, pageLabel: dataset.amiePagePath === pathname ? dataset.amiePageLabel ?? "" : "" };
}

/** Foreground-only presence; hidden tabs send an ordered leave and never poll. */
export function PageViewing() {
  const pathname = usePathname() ?? "";
  const [snapshot, setSnapshot] = useState<PageViewingSnapshot | null>(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"viewers" | "history">("viewers");
  const [error, setError] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const openRef = useRef(false);
  const identity = useRef<{ sessionId: string; revision: number } | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const refreshRef = useRef<() => void>(() => {});
  openRef.current = open;

  useEffect(() => {
    identity.current ??= { sessionId: crypto.randomUUID(), revision: 0 };
    let current: { input: PageViewingInput; visitId: string } | null = null;
    let stopped = false;
    let inFlight = false;
    let epoch = 0;
    let lastSuccess = 0;
    const foreground = () => !document.hidden;
    setSnapshot(null);
    setOpen(false);
    setError(false);
    setUnavailable(false);
    const send = (active: boolean, target: NonNullable<typeof current>, keepalive = false) => {
      const id = identity.current!;
      return fetch("/api/page-viewing", {
        method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", keepalive,
        signal: keepalive ? undefined : AbortSignal.timeout(8000),
        body: JSON.stringify({ ...target.input, visitId: target.visitId, sessionId: id.sessionId, revision: ++id.revision, active, history: active && openRef.current }),
      });
    };
    const leave = () => {
      ++epoch;
      if (current) { void send(false, current, true).catch(() => {}); current = null; }
      setSnapshot(null);
    };
    const refresh = async () => {
      if (stopped || !foreground()) return;
      const input = selectedPage(pathname);
      if (!input) return;
      if (current && JSON.stringify(current.input) !== JSON.stringify(input)) leave();
      if (!current) current = { input, visitId: crypto.randomUUID() };
      if (inFlight) return;
      inFlight = true;
      const requestEpoch = epoch;
      const target = current;
      try {
        const response = await send(true, target);
        if (stopped || !foreground() || requestEpoch !== epoch) return;
        if (response.status === 404) { setUnavailable(true); setSnapshot(null); return; }
        if (!response.ok) throw new Error("page viewing failed");
        const value = await response.json() as PageViewingSnapshot;
        if (stopped || !foreground() || requestEpoch !== epoch) return;
        lastSuccess = Date.now();
        setSnapshot(value);
        setError(false);
        setUnavailable(false);
      } catch {
        if (!stopped && requestEpoch === epoch) {
          setError(true);
          // A failed request must never leave a stale list labelled as current.
          setSnapshot(null);
        }
      } finally {
        inFlight = false;
        if (!stopped && requestEpoch !== epoch && foreground()) void refresh();
      }
    };
    refreshRef.current = () => { void refresh(); };
    const visibility = () => { if (!foreground()) leave(); else void refresh(); };
    const selection = () => { void refresh(); };
    const timer = window.setInterval(() => {
      if (Date.now() - lastSuccess > PAGE_VIEWING_EXPIRY_MS) setSnapshot(null);
      void refresh();
    }, PAGE_VIEWING_REFRESH_MS);
    void refresh();
    window.addEventListener("amie-page-selection", selection);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", leave);
    window.addEventListener("pageshow", selection);
    return () => {
      stopped = true;
      leave();
      window.clearInterval(timer);
      window.removeEventListener("amie-page-selection", selection);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", leave);
      window.removeEventListener("pageshow", selection);
    };
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    refreshRef.current();
    panel.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); } };
    const outside = (event: PointerEvent) => { if (!panel.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("keydown", close);
    document.addEventListener("pointerdown", outside);
    return () => { document.removeEventListener("keydown", close); document.removeEventListener("pointerdown", outside); };
  }, [open]);

  const count = snapshot?.viewers.length ?? 0;
  if (unavailable) return null;
  return <div className="relative ml-auto min-w-0" data-testid="page-viewing">
    <button ref={trigger} type="button" onClick={() => setOpen(v => !v)} aria-expanded={open} aria-haspopup="dialog" aria-label="閲覧中の人と閲覧履歴" className="inline-flex h-11 items-center gap-2 rounded-full px-2 text-xs text-[#374151] hover:bg-[#e8edf3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#027FDC] sm:h-9 sm:px-3">
      <span className="flex -space-x-1" aria-hidden="true">{snapshot?.viewers.slice(0, 3).map(v => <span key={v.key} title={v.self ? `${v.label}（自分）` : v.label} className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 border-[#f8fafc] text-[11px] font-semibold ${v.self ? "bg-[#dcebf7] text-[#245f84]" : "bg-[#e5e7eb] text-[#4b5563]"}`}>{Array.from(v.label)[0]}</span>)}{!count && <Users className="h-4 w-4" />}</span>
      <span>{error ? "再接続中" : snapshot ? `${count}${snapshot.truncated ? "+" : ""}人が閲覧中` : "閲覧情報"}</span>
    </button>
    {open && <div ref={panel} role="dialog" aria-label="この画面の閲覧情報" className="absolute right-0 top-full z-[70] mt-1 w-[min(360px,calc(100vw-24px))] overflow-hidden rounded-lg border border-[#d2d2d7] bg-white text-[#1d1d1f] shadow-sm">
      <div className="flex items-center gap-1 border-b border-[#e5e7eb] px-2 py-1">
        <button type="button" aria-pressed={mode === "viewers"} onClick={() => setMode("viewers")} className={`inline-flex min-h-11 items-center gap-1 rounded px-2 text-xs sm:min-h-9 ${mode === "viewers" ? "bg-[#e8edf3] font-semibold" : "text-[#6e6e73] hover:bg-[#f8fafc]"}`}><Users className="h-4 w-4" />閲覧中</button>
        <button type="button" aria-pressed={mode === "history"} onClick={() => { setMode("history"); refreshRef.current(); }} className={`inline-flex min-h-11 items-center gap-1 rounded px-2 text-xs sm:min-h-9 ${mode === "history" ? "bg-[#e8edf3] font-semibold" : "text-[#6e6e73] hover:bg-[#f8fafc]"}`}><History className="h-4 w-4" />{snapshot?.ownHistoryOnly ? "自分の閲覧履歴" : "閲覧履歴"}</button>
        <button type="button" aria-label="閉じる" onClick={() => { setOpen(false); trigger.current?.focus(); }} className="ml-auto grid h-11 w-11 place-items-center rounded hover:bg-[#e8edf3] sm:h-9 sm:w-9"><X className="h-4 w-4" /></button>
      </div>
      <p className="border-b border-[#e5e7eb] px-3 py-2 text-xs leading-5 text-[#6e6e73]">{snapshot?.title ?? "この画面"}</p>
      <div className="max-h-[min(360px,60vh)] overflow-y-auto">
        {error ? <div className="px-3 py-4 text-xs">取得できなかったよ。<button type="button" className="ml-2 min-h-11 text-[#245f84] underline" onClick={() => refreshRef.current()}>再試行</button></div> : !snapshot ? <p className="px-3 py-4 text-xs text-[#6e6e73]">読み込み中…</p> : mode === "viewers" ? <>
          {snapshot.viewers.map(v => <div key={v.key} className="flex min-h-11 items-center gap-2 border-b border-[#f0f1f3] px-3 py-2 text-sm"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#e8edf3] text-xs text-[#245f84]" aria-hidden="true">{Array.from(v.label)[0]}</span><span className="min-w-0 break-words">{v.label}{v.self && <span className="ml-1 text-xs text-[#6e6e73]">（自分）</span>}</span></div>)}
          {!count && <p className="px-3 py-4 text-xs text-[#6e6e73]">いま閲覧中の人はいないよ</p>}
        </> : snapshot.history ? <>
          <p className="px-3 py-2 text-[11px] text-[#6e6e73]">この画面を開いた履歴・新しい順に50件まで</p>
          {snapshot.history.map(v => <div key={v.id} className="flex min-h-11 items-start justify-between gap-3 border-b border-[#f0f1f3] px-3 py-2 text-xs"><span className="min-w-0 break-words">{v.label}{v.self ? "（自分）" : ""}</span><time dateTime={v.startedAt} className="shrink-0 tabular-nums text-[#6e6e73]">{new Date(v.startedAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</time></div>)}
          {!snapshot.history.length && <p className="px-3 py-4 text-xs text-[#6e6e73]">閲覧履歴はまだないよ</p>}
        </> : <p className="px-3 py-4 text-xs text-[#6e6e73]">履歴を読み込み中…</p>}
      </div>
    </div>}
  </div>;
}
