"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronUp,
  ChevronDown,
  Code2,
  Copy,
  CornerLeftUp,
  History,
  Italic,
  Loader2,
  MousePointerClick,
  Save,
  Trash2,
  Underline,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  WorkspaceDocumentEditSelection,
  WorkspaceDocumentSlideCandidate,
  WorkspaceDocumentSlideSummary,
} from "@/lib/workspace-document-edit-agent";

type Props = {
  documentId: string;
  displayName: string;
  /** 「HTMLソースで編集」。親がソース編集へ切り替える。 */
  onOpenSource: () => void;
  /** 「版履歴」。親が版履歴へ切り替える。 */
  onOpenRevisions: () => void;
  /** ヘッダーに出す戻り導線。別タブで開く編集ページでは、開いた資料室のパスが入る。 */
  backHref?: string;
  /** 閉じるボタン。渡さなければボタンごと出さない (別タブ運用ではタブを閉じれば済む)。 */
  onClose?: () => void;
  /** 保存が通ったとき。親が notice を出して一覧を読み直す。 */
  onSaved: (message: string) => void;
  /** 未保存の変更があるか。親はこれを見て、外側クリックで黙って閉じないようにする。 */
  onDirtyChange?: (dirty: boolean) => void;
};

/** 資料ごとに選んだ区切りを覚えるキー。Phase 2でモデルへ移すまでの置き場。 */
function slideSelectorStorageKey(documentId: string) {
  return `amd-deck-slide-selector:${documentId}`;
}

/**
 * HTML資料を見たまま編集する画面。
 *
 * 中身は `edit-frame` ルートが返すiframeで、そこは `allow-same-origin` を持たない
 * 不透明オリジン。だから資料のHTMLはまさのセッションにも親のDOMにも到達できない。
 * 代償として postMessage の origin が "null" になり送信元をoriginで確かめられないので、
 * 開くたびに作ったtokenをフレームへ渡し、**送受信の両方で照合する**。
 *
 * この画面はStorageの現物を直接は読まない。本文はフレームが持ち、保存のときだけ
 * シリアライズしたHTMLを受け取ってサーバへ渡す。競合検知のsha256は版履歴APIから取る
 * (本文を返さないので5MBを二重に落とさずに済む)。
 */
export function WorkspaceDocumentDeckEditor({
  documentId,
  displayName,
  onOpenSource,
  onOpenRevisions,
  backHref,
  onClose,
  onSaved,
  onDirtyChange,
}: Props) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const onDirtyChangeRef = useRef(onDirtyChange);
  onDirtyChangeRef.current = onDirtyChange;
  // 保存中のserialize要求。フレームの返事とrequestIdで突き合わせる。
  const pendingSerializeRef = useRef<{
    requestId: string;
    resolve: (html: string) => void;
    reject: (cause: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);

  // 開くたびに1回だけ発行する。フレームのURLにも載るので、hex32だけで作る。
  const [token] = useState(() =>
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().replace(/-/g, "")
      : Array.from({ length: 32 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join(""),
  );
  // 読み込み直しはフレームを作り直す。同じsrcのreloadだと編集済みDOMが残ることがある。
  const [frameKey, setFrameKey] = useState(0);

  const [ready, setReady] = useState(false);
  const [candidates, setCandidates] = useState<WorkspaceDocumentSlideCandidate[]>([]);
  const [slideSelector, setSlideSelector] = useState("");
  const [slides, setSlides] = useState<WorkspaceDocumentSlideSummary[]>([]);
  const [selection, setSelection] = useState<WorkspaceDocumentEditSelection | null>(null);
  const [dirty, setDirty] = useState(false);

  const [sha256, setSha256] = useState<string | null>(null);
  const [shaLoading, setShaLoading] = useState(true);
  // 409で返ってきたときだけ立てる。デッキ側では強制上書きを出さない (下の保存の注記)。
  const [conflict, setConflict] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const frameSrc = useMemo(
    () =>
      `/api/workspace-documents/${encodeURIComponent(documentId)}/edit-frame?token=${encodeURIComponent(token)}`,
    [documentId, token],
  );

  const postToFrame = useCallback(
    (payload: Record<string, unknown>) => {
      const target = frameRef.current?.contentWindow;
      if (!target) return;
      // フレームは不透明オリジンなので targetOrigin を絞れない。守りはtokenの照合だけ。
      target.postMessage({ ...payload, amd: token }, "*");
    },
    [token],
  );

  /** 現物のsha256を取り直す。本文は返らないので、これだけなら軽い。 */
  const loadSha256 = useCallback(async () => {
    setShaLoading(true);
    try {
      const response = await fetch(
        `/api/workspace-documents/${encodeURIComponent(documentId)}/revisions`,
      );
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        currentSha256?: string;
        error?: string;
      };
      if (!response.ok || !payload.ok || typeof payload.currentSha256 !== "string") {
        throw new Error(payload.error || "資料の状態を確認できなかったよ。");
      }
      setSha256(payload.currentSha256);
    } catch (cause) {
      setSha256(null);
      setError(cause instanceof Error ? cause.message : "資料の状態を確認できなかったよ。");
    } finally {
      setShaLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    void loadSha256();
  }, [loadSha256]);

  // 未保存の有無を親へ伝える。親はこれを見て、外側クリックで黙って閉じないようにする。
  useEffect(() => {
    onDirtyChangeRef.current?.(dirty);
  }, [dirty]);

  // 閉じたあとに dirty が残ると、次に開いたとき確認ダイアログが誤発火する。
  useEffect(() => {
    return () => onDirtyChangeRef.current?.(false);
  }, []);

  // フレームからの受信。origin では守れないので、送信元windowとtokenの二重で照合する。
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.source !== frameRef.current?.contentWindow) return;
      const data = event.data as Record<string, unknown> | null;
      if (!data || typeof data !== "object" || data.amd !== token) return;

      if (data.type === "ready") {
        setReady(true);
        const list = Array.isArray(data.candidates)
          ? (data.candidates as WorkspaceDocumentSlideCandidate[])
          : [];
        setCandidates(list);
        // 前回この資料で選んだ区切りが今もあるなら、聞き直さずそのまま使う。
        const remembered =
          typeof window === "undefined"
            ? null
            : window.localStorage.getItem(slideSelectorStorageKey(documentId));
        const usable = remembered && list.some((item) => item.selector === remembered)
          ? remembered
          : list.length === 1
            ? list[0].selector
            : "";
        if (usable) {
          setSlideSelector(usable);
          postToFrame({ type: "setSlideSelector", selector: usable });
        }
        return;
      }
      if (data.type === "slides") {
        setSlides(Array.isArray(data.slides) ? (data.slides as WorkspaceDocumentSlideSummary[]) : []);
        return;
      }
      if (data.type === "selection") {
        setSelection((data.selection as WorkspaceDocumentEditSelection | null) ?? null);
        return;
      }
      if (data.type === "dirty") {
        setDirty(true);
        return;
      }
      if (data.type === "serialized") {
        const pending = pendingSerializeRef.current;
        if (!pending || pending.requestId !== data.requestId) return;
        clearTimeout(pending.timer);
        pendingSerializeRef.current = null;
        pending.resolve(typeof data.html === "string" ? data.html : "");
      }
    }

    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      const pending = pendingSerializeRef.current;
      if (pending) {
        clearTimeout(pending.timer);
        pendingSerializeRef.current = null;
        pending.reject(new Error("編集画面を閉じたよ。"));
      }
    };
  }, [documentId, postToFrame, token]);

  function chooseSlideSelector(selector: string) {
    setSlideSelector(selector);
    if (typeof window !== "undefined") {
      const key = slideSelectorStorageKey(documentId);
      if (selector) window.localStorage.setItem(key, selector);
      else window.localStorage.removeItem(key);
    }
    postToFrame({ type: "setSlideSelector", selector });
  }

  /** 競合したときの唯一の出口。編集内容は捨てて現物へ揃える。 */
  function reloadFrame() {
    setReady(false);
    setDirty(false);
    setConflict(false);
    setSelection(null);
    setSlides([]);
    setCandidates([]);
    setError(null);
    setFrameKey((value) => value + 1);
    void loadSha256();
  }

  function requestSerialize() {
    return new Promise<string>((resolve, reject) => {
      const requestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const timer = setTimeout(() => {
        pendingSerializeRef.current = null;
        reject(new Error("編集内容を取り出せなかったよ。開き直してね。"));
      }, 15000);
      pendingSerializeRef.current = { requestId, resolve, reject, timer };
      postToFrame({ type: "serialize", requestId });
    });
  }

  /**
   * 保存。
   *
   * デッキ側には「このまま上書き保存」を置かない。保存本文はサーバが**現物のscript**を
   * 戻して組み直すので、別セッションがscriptを足したり消したりしていると、戻す位置が
   * ずれて資料が黙って壊れる。壊れたことが保存後のHTMLを見ても分からないので、
   * 競合したら読み込み直す一択にする。ソース編集側の強制上書きは従来どおり残す。
   */
  async function save() {
    if (saving || shaLoading) return;
    if (!sha256) {
      setError("編集前の版を確認できていないよ。読み込み直してね。");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const html = await requestSerialize();
      if (!html.trim()) throw new Error("編集内容が空だよ。保存はしなかったよ。");
      const response = await fetch(
        `/api/workspace-documents/${encodeURIComponent(documentId)}/source`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source: html, expectedSha256: sha256, mode: "deck" }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        unchanged?: boolean;
        sha256?: string;
        revisionNo?: number | null;
        conflict?: boolean;
        error?: string;
      };
      if (response.status === 409 && payload.conflict) {
        setConflict(true);
        throw new Error(payload.error || "別のセッションがこの資料を更新しているよ。");
      }
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "資料を保存できなかったよ。");
      }
      if (typeof payload.sha256 === "string") setSha256(payload.sha256);
      setConflict(false);
      setDirty(false);
      onSaved(
        payload.unchanged
          ? "内容が変わっていないから、そのままにしたよ。"
          : payload.revisionNo
            ? `保存したよ。上書き前の内容は版履歴 v${payload.revisionNo} に残したよ。`
            : "保存したよ。",
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "資料を保存できなかったよ。");
    } finally {
      setSaving(false);
    }
  }

  const formatDisabled = !selection || saving;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="shrink-0 border-b-4 border-[#0066cc] bg-[#081b2b] px-5 py-3 text-white">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h1 className="text-base font-semibold text-white sm:text-lg">見たまま編集</h1>
          {backHref && (
            <a
              href={backHref}
              className="text-xs font-semibold text-cyan-200 underline-offset-2 hover:underline"
            >
              資料室へ戻る
            </a>
          )}
        </div>
        <p className="mt-1 text-xs leading-5 text-cyan-100">
          {displayName}。1回クリックで要素を選び、ダブルクリックで文字を直せるよ。資料のスクリプトは動かしていないから、
          アニメーションや自動ページ送りは編集中だけ止まって見えるよ。
        </p>
      </header>

      {(error || conflict) && (
        <div className="shrink-0 border-b border-slate-200 px-4 py-3 sm:px-5">
          {error && (
            <div
              role="alert"
              className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-800"
            >
              {error}
            </div>
          )}
          {conflict && (
            <div className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-3 text-xs leading-5 text-amber-900">
              <p className="font-semibold">別のセッションがこの資料を更新したよ。</p>
              <p className="mt-1">
                見たまま編集では、上書き保存を選べないようにしてるよ。保存する本文は現物のスクリプトを戻して組み立てるから、
                別のセッションがそこを変えていると、戻す位置がずれて資料が黙って壊れるの。読み込み直してからやり直してね。
              </p>
              <Button
                type="button"
                variant="outline"
                className="mt-2 h-9 border-amber-400 bg-white px-3 text-xs text-amber-900 hover:bg-amber-100"
                disabled={saving}
                onClick={reloadFrame}
              >
                最新を読み込み直す
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] lg:grid-cols-[224px_minmax(0,1fr)_264px]">
        {/* 左 — スライド一覧。区切りが決まっていなければ、まず区切りを選んでもらう。 */}
        <aside className="hidden min-h-0 flex-col overflow-y-auto border-r border-slate-200 bg-slate-50 p-3 lg:flex">
          {!slideSelector ? (
            <div className="text-xs leading-5 text-slate-600">
              <p className="font-semibold text-slate-800">スライドの区切りはどれ？</p>
              <p className="mt-1">
                資料ごとに作りが違うから、勝手に決めないよ。いちばん枚数が合っているものを選んでね。
              </p>
              {candidates.length === 0 ? (
                <p className="mt-3 text-slate-500">
                  {ready
                    ? "繰り返しの区切りが見つからなかったよ。1枚ものとして編集できるよ。"
                    : "読み込み中…"}
                </p>
              ) : (
                <ul className="mt-3 flex flex-col gap-2">
                  {candidates.map((candidate) => (
                    <li key={candidate.selector}>
                      <button
                        type="button"
                        onClick={() => chooseSlideSelector(candidate.selector)}
                        className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-left hover:border-blue-500 hover:bg-blue-50"
                      >
                        <span className="block font-mono text-[11px] text-slate-700">
                          {candidate.selector}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-slate-500">
                          {candidate.count}枚
                          {candidate.sameParent ? "" : "・並びがばらけている"}
                        </span>
                        {candidate.labels.length > 0 && (
                          <span className="mt-1 block truncate text-[11px] text-slate-500">
                            {candidate.labels.filter(Boolean).join(" / ")}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <>
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-xs font-semibold text-slate-800">スライド {slides.length}枚</span>
                <button
                  type="button"
                  onClick={() => chooseSlideSelector("")}
                  className="text-[11px] text-blue-700 underline underline-offset-2"
                >
                  区切りを選び直す
                </button>
              </div>
              <ul className="flex flex-col gap-2">
                {slides.map((slide) => (
                  <li
                    key={slide.index}
                    className={cn(
                      "rounded-md border bg-white p-2",
                      selection?.slideIndex === slide.index
                        ? "border-blue-500 ring-1 ring-blue-200"
                        : "border-slate-200",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => postToFrame({ type: "focusSlide", index: slide.index })}
                      className="block w-full text-left"
                    >
                      <span className="text-[11px] font-semibold text-slate-500">
                        {slide.index + 1}
                      </span>
                      <span className="mt-0.5 block line-clamp-2 text-[11px] leading-4 text-slate-800">
                        {slide.label}
                      </span>
                    </button>
                    <div className="mt-1.5 flex gap-1">
                      <button
                        type="button"
                        title="上へ"
                        aria-label={`${slide.index + 1}枚目を上へ`}
                        disabled={slide.index === 0 || saving}
                        onClick={() =>
                          postToFrame({ type: "slideAction", action: "up", index: slide.index })
                        }
                        className="flex h-7 w-7 items-center justify-center rounded border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                      >
                        <ChevronUp className="h-3.5 w-3.5" aria-hidden />
                      </button>
                      <button
                        type="button"
                        title="下へ"
                        aria-label={`${slide.index + 1}枚目を下へ`}
                        disabled={slide.index === slides.length - 1 || saving}
                        onClick={() =>
                          postToFrame({ type: "slideAction", action: "down", index: slide.index })
                        }
                        className="flex h-7 w-7 items-center justify-center rounded border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                      >
                        <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                      </button>
                      <button
                        type="button"
                        title="複製"
                        aria-label={`${slide.index + 1}枚目を複製`}
                        disabled={saving}
                        onClick={() =>
                          postToFrame({ type: "slideAction", action: "duplicate", index: slide.index })
                        }
                        className="flex h-7 w-7 items-center justify-center rounded border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                      >
                        <Copy className="h-3.5 w-3.5" aria-hidden />
                      </button>
                      <button
                        type="button"
                        title="削除"
                        aria-label={`${slide.index + 1}枚目を削除`}
                        disabled={slides.length <= 1 || saving}
                        onClick={() =>
                          postToFrame({ type: "slideAction", action: "delete", index: slide.index })
                        }
                        className="flex h-7 w-7 items-center justify-center rounded border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-40"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </aside>

        {/* 中 — 資料そのもの。 */}
        <div className="relative min-h-0 bg-slate-200">
          {!ready && (
            <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-slate-100 text-sm text-slate-600">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              資料を読み込み中
            </div>
          )}
          <iframe
            key={frameKey}
            ref={frameRef}
            src={frameSrc}
            title={`${displayName}の編集`}
            sandbox="allow-scripts"
            className="h-full w-full border-0 bg-white"
          />
        </div>

        {/* 右 — 書式。選んでいる要素にだけ効く。 */}
        <aside className="hidden min-h-0 flex-col gap-3 overflow-y-auto border-l border-slate-200 bg-white p-3 lg:flex">
          {!selection ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center text-xs leading-5 text-slate-500">
              <MousePointerClick className="h-6 w-6 text-slate-400" aria-hidden />
              資料の中を1回クリックすると、そこの書式をここで変えられるよ。
            </div>
          ) : (
            <>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
                <p className="font-mono text-[11px] text-slate-600">&lt;{selection.tag}&gt;</p>
                <p className="mt-1 line-clamp-3 text-[11px] leading-4 text-slate-700">
                  {selection.text || "(文字なし)"}
                </p>
                <div className="mt-2 flex gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 px-2 text-[11px]"
                    disabled={!selection.hasParent || saving}
                    onClick={() => postToFrame({ type: "selectParent" })}
                  >
                    <CornerLeftUp className="h-3.5 w-3.5" aria-hidden />
                    外側を選ぶ
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 px-2 text-[11px]"
                    disabled={saving}
                    onClick={() => postToFrame({ type: "clearSelection" })}
                  >
                    選択を外す
                  </Button>
                </div>
              </div>

              <div>
                <p className="text-[11px] font-semibold text-slate-700">文字</p>
                <div className="mt-1.5 flex gap-1">
                  {(
                    [
                      { command: "bold", icon: Bold, on: selection.bold, label: "太字" },
                      { command: "italic", icon: Italic, on: selection.italic, label: "斜体" },
                      { command: "underline", icon: Underline, on: selection.underline, label: "下線" },
                    ] as const
                  ).map(({ command, icon: Icon, on, label }) => (
                    <button
                      key={command}
                      type="button"
                      title={label}
                      aria-label={label}
                      aria-pressed={on}
                      disabled={formatDisabled}
                      onClick={() => postToFrame({ type: "command", command, value: "" })}
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded border disabled:opacity-40",
                        on
                          ? "border-blue-600 bg-blue-50 text-blue-800"
                          : "border-slate-300 text-slate-700 hover:bg-slate-100",
                      )}
                    >
                      <Icon className="h-4 w-4" aria-hidden />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[11px] font-semibold text-slate-700">寄せ</p>
                <div className="mt-1.5 flex gap-1">
                  {(
                    [
                      { value: "left", icon: AlignLeft, label: "左寄せ" },
                      { value: "center", icon: AlignCenter, label: "中央" },
                      { value: "right", icon: AlignRight, label: "右寄せ" },
                    ] as const
                  ).map(({ value, icon: Icon, label }) => (
                    <button
                      key={value}
                      type="button"
                      title={label}
                      aria-label={label}
                      aria-pressed={selection.align === value}
                      disabled={formatDisabled}
                      onClick={() => postToFrame({ type: "command", command: "align", value })}
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded border disabled:opacity-40",
                        selection.align === value
                          ? "border-blue-600 bg-blue-50 text-blue-800"
                          : "border-slate-300 text-slate-700 hover:bg-slate-100",
                      )}
                    >
                      <Icon className="h-4 w-4" aria-hidden />
                    </button>
                  ))}
                </div>
              </div>

              <label className="block text-[11px] font-semibold text-slate-700">
                大きさ {selection.fontSize}px
                <input
                  type="range"
                  min={8}
                  max={96}
                  step={1}
                  value={selection.fontSize}
                  disabled={formatDisabled}
                  onChange={(event) =>
                    postToFrame({ type: "command", command: "fontSize", value: event.target.value })
                  }
                  className="mt-1.5 w-full accent-[#0066cc]"
                />
              </label>

              <label className="block text-[11px] font-semibold text-slate-700">
                色
                <input
                  type="color"
                  value={selection.color}
                  disabled={formatDisabled}
                  onChange={(event) =>
                    postToFrame({ type: "command", command: "color", value: event.target.value })
                  }
                  className="mt-1.5 h-9 w-full cursor-pointer rounded border border-slate-300 bg-white p-1"
                />
              </label>
            </>
          )}
        </aside>
      </div>

      <footer className="flex shrink-0 flex-col-reverse flex-wrap gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:justify-end sm:px-5">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-11"
            disabled={saving}
            onClick={onOpenSource}
          >
            <Code2 className="h-4 w-4" aria-hidden />
            HTMLソースで編集
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11"
            disabled={saving}
            onClick={onOpenRevisions}
          >
            <History className="h-4 w-4" aria-hidden />
            版履歴
          </Button>
          <span className="text-xs text-slate-500">
            {saving
              ? "保存中"
              : dirty
                ? "未保存の変更があるよ"
                : shaLoading
                  ? "状態を確認中"
                  : "変更なし"}
          </span>
        </div>
        {onClose && (
          <Button type="button" variant="outline" className="h-11" disabled={saving} onClick={onClose}>
            閉じる
          </Button>
        )}
        <Button
          type="button"
          className="h-11 bg-[#0066cc] hover:bg-[#004f9e]"
          disabled={saving || shaLoading || !ready || !dirty || conflict}
          onClick={() => void save()}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Save className="h-4 w-4" aria-hidden />
          )}
          保存
        </Button>
      </footer>
    </div>
  );
}
