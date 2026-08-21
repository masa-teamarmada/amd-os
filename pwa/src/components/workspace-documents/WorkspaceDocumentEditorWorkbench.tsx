"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { History, Loader2, MousePointerClick, RotateCcw, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  WORKSPACE_DOCUMENT_HTML_EDITOR_MAX_BYTES,
  workspaceDocumentHtmlSourceByteLength,
} from "@/lib/workspace-documents-core";

import { WorkspaceDocumentDeckEditor } from "./WorkspaceDocumentDeckEditor";
import { formatBytes, formatDateTime } from "./workspace-document-format";
import { broadcastWorkspaceDocumentUpdated } from "./workspace-document-sync";

/** 上書き前に退避した過去版。bucket/pathはサーバ側に留め、ここへは来ない。 */
type DocumentRevision = {
  revisionId: string;
  revisionNo: number;
  kind: "deck_model" | "html_source";
  contentSha256: string;
  byteSize: number;
  note: string | null;
  pinned: boolean;
  createdAt: string;
};

type OverlayKind = "source" | "revisions" | null;

type Props = {
  documentId: string;
  displayName: string;
  /** 開いた資料室へ戻る相対パス。サーバ側で相対パスだと検証済みのものだけが来る。 */
  backHref?: string;
};

/**
 * HTML資料の編集タブ。
 *
 * 資料室 (WorkspaceDocumentRoom) の「編集」から別タブで開く。編集に関わる3つ
 * (見たまま編集 / HTMLソース編集 / 版履歴) をここへ集め、資料室側は「見る・入れる・整理する」
 * だけを持つ。編集をモーダルへ押し込むと、3ペインの見たまま編集がビューポート幅で潰れる
 * (2026-08-21 まさ「モーダルちっさ」)。
 *
 * 見たまま編集は常に下敷きとして生かしたまま、ソース編集と版履歴をその上へ重ねる。
 * ただし本文が入れ替わる操作 (ソース保存 / 版の復元) のあとは、見たまま編集のフレームを
 * 作り直す。作り直さないと、古いDOMを次の保存でそのまま書き戻してしまう。
 */
export function WorkspaceDocumentEditorWorkbench({ documentId, displayName, backHref }: Props) {
  const [overlay, setOverlay] = useState<OverlayKind>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // 見たまま編集のフレームを作り直すためのキー。
  const [deckSessionKey, setDeckSessionKey] = useState(0);
  const [deckDirty, setDeckDirty] = useState(false);

  /** ソース編集を開いたときの本文。見たまま編集へ戻る前に、未保存かどうかを見るために控える。 */
  const loadedHtmlSourceRef = useRef("");
  const [draftHtmlSource, setDraftHtmlSource] = useState("");
  const [htmlSourceLoading, setHtmlSourceLoading] = useState(false);
  // 編集を開いた時点の現物sha256。保存時にこれを送り、別セッションの変更を黙って踏まない。
  const [htmlSourceSha256, setHtmlSourceSha256] = useState<string | null>(null);
  // 409で返ってきた現物のsha256。ここに値がある間は競合バーを出す。
  const [htmlConflictSha256, setHtmlConflictSha256] = useState<string | null>(null);

  const [revisionsReturnTo, setRevisionsReturnTo] = useState<OverlayKind>(null);
  const [revisions, setRevisions] = useState<DocumentRevision[]>([]);
  const [revisionsLoading, setRevisionsLoading] = useState(false);
  const [revisionsCurrentSha256, setRevisionsCurrentSha256] = useState<string | null>(null);
  const [revisionPreviewNo, setRevisionPreviewNo] = useState<number | null>(null);
  const [revisionPreviewSource, setRevisionPreviewSource] = useState("");
  const [revisionPreviewLoading, setRevisionPreviewLoading] = useState(false);

  const draftHtmlByteLength = workspaceDocumentHtmlSourceByteLength(draftHtmlSource);

  /** 別タブなので、未保存のままタブを閉じられたら取り返せない。ブラウザ標準の確認を出す。 */
  useEffect(() => {
    if (!deckDirty) return;
    function warn(event: BeforeUnloadEvent) {
      event.preventDefault();
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [deckDirty]);

  /** 本文が入れ替わったあとの後始末。フレームを作り直し、元タブの一覧へも知らせる。 */
  const afterContentReplaced = useCallback(
    (message: string) => {
      setDeckDirty(false);
      setDeckSessionKey((value) => value + 1);
      setNotice(message);
      broadcastWorkspaceDocumentUpdated(documentId);
    },
    [documentId],
  );

  /**
   * 現物のHTMLとそのsha256を取り直す。編集を開くときと、競合したあとの読み直しで共有する。
   * shaを一緒に持ち帰るのは、保存時に「読んだ時点の内容」を主張して競合を検知するため。
   */
  async function loadHtmlSource() {
    setHtmlSourceLoading(true);
    try {
      const response = await fetch(
        `/api/workspace-documents/${encodeURIComponent(documentId)}/source`,
        { cache: "no-store" },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        source?: string;
        sha256?: string;
        error?: string;
      };
      if (!response.ok || !payload.ok || typeof payload.source !== "string") {
        throw new Error(payload.error || "HTML資料を読み込めなかったよ。");
      }
      setDraftHtmlSource(payload.source);
      loadedHtmlSourceRef.current = payload.source;
      setHtmlSourceSha256(typeof payload.sha256 === "string" ? payload.sha256 : null);
      setHtmlConflictSha256(null);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "HTML資料を読み込めなかったよ。");
      return false;
    } finally {
      setHtmlSourceLoading(false);
    }
  }

  /**
   * 見たまま編集から離れる前の確認。Base UI の Dialog には外側クリック閉じを止める prop が
   * 無いので、未保存があるときは自前で確認する。
   */
  function confirmLeaveDeck() {
    if (!deckDirty) return true;
    const ok = window.confirm("見たまま編集に、保存していない変更があるよ。ここを離れると失われるけどいい？");
    if (ok) setDeckDirty(false);
    return ok;
  }

  async function openHtmlEditor() {
    if (busy) return;
    if (!confirmLeaveDeck()) return;
    setDraftHtmlSource("");
    loadedHtmlSourceRef.current = "";
    setHtmlSourceSha256(null);
    setHtmlConflictSha256(null);
    setOverlay("source");
    setError(null);
    setNotice(null);
    const loaded = await loadHtmlSource();
    if (!loaded) setOverlay(null);
  }

  /** 競合バーの「最新を読み込み直す」。編集中の下書きは捨てて現物へ揃える。 */
  async function reloadHtmlSource() {
    if (overlay !== "source") return;
    setError(null);
    await loadHtmlSource();
  }

  /** ソース編集を閉じる。未保存の下書きを黙って捨てない。 */
  function closeHtmlEditor() {
    if (
      draftHtmlSource !== loadedHtmlSourceRef.current &&
      !window.confirm("HTMLソースに、保存していない変更があるよ。閉じると失われるけどいい？")
    ) {
      return;
    }
    setError(null);
    setOverlay(null);
  }

  /**
   * 保存は必ず「開いた時点のsha256」を添えて送る。現物が変わっていたら409で止まり、
   * 下書きは捨てずに競合バーへ切り替える。上書きを選べるのは、上書きされる側が
   * サーバ側で版履歴へ退避されてから差し替わる = あとから戻せるから。
   */
  async function saveHtmlSource(event: FormEvent) {
    event.preventDefault();
    await submitHtmlSource(htmlSourceSha256);
  }

  async function submitHtmlSource(expectedSha256: string | null) {
    if (overlay !== "source") return;
    if (!expectedSha256) {
      setError("編集前の内容を確認できていないよ。いったん閉じて開き直してね。");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/workspace-documents/${encodeURIComponent(documentId)}/source`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source: draftHtmlSource, expectedSha256 }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        unchanged?: boolean;
        sha256?: string;
        revisionNo?: number | null;
        conflict?: boolean;
        currentSha256?: string;
        error?: string;
      };
      if (response.status === 409 && payload.conflict) {
        setHtmlConflictSha256(
          typeof payload.currentSha256 === "string" ? payload.currentSha256 : null,
        );
        throw new Error(payload.error || "別のセッションがこの資料を更新しているよ。");
      }
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "HTML資料を保存できなかったよ。");
      }
      if (typeof payload.sha256 === "string") setHtmlSourceSha256(payload.sha256);
      setHtmlConflictSha256(null);
      loadedHtmlSourceRef.current = draftHtmlSource;
      setOverlay(null);
      afterContentReplaced(
        payload.unchanged
          ? "内容が変わっていないから、そのままにしたよ。"
          : payload.revisionNo
            ? `保存したよ。上書き前の内容は版履歴 v${payload.revisionNo} に残したよ。`
            : "保存したよ。",
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "HTML資料を保存できなかったよ。");
    } finally {
      setBusy(false);
    }
  }

  /**
   * 版履歴の「編集に戻る」。ソース編集から来たならソース編集へ、
   * 見たまま編集から来たなら下敷きのフレームへ戻す (フレームは作り直さない = 何も変えていないため)。
   */
  function returnFromRevisions() {
    setError(null);
    setOverlay(revisionsReturnTo === "source" ? "source" : null);
  }

  async function openHtmlRevisions(from: OverlayKind) {
    if (from !== "source" && !confirmLeaveDeck()) return;
    setRevisionsReturnTo(from);
    setOverlay("revisions");
    setError(null);
    setNotice(null);
    setRevisions([]);
    setRevisionsCurrentSha256(null);
    setRevisionPreviewNo(null);
    setRevisionPreviewSource("");
    setRevisionsLoading(true);
    try {
      const response = await fetch(
        `/api/workspace-documents/${encodeURIComponent(documentId)}/revisions`,
        { cache: "no-store" },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        currentSha256?: string;
        revisions?: DocumentRevision[];
        error?: string;
      };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "版履歴を読み込めなかったよ。");
      }
      setRevisions(Array.isArray(payload.revisions) ? payload.revisions : []);
      setRevisionsCurrentSha256(
        typeof payload.currentSha256 === "string" ? payload.currentSha256 : null,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "版履歴を読み込めなかったよ。");
    } finally {
      setRevisionsLoading(false);
    }
  }

  async function previewRevision(revisionNo: number) {
    if (revisionPreviewNo === revisionNo) {
      setRevisionPreviewNo(null);
      setRevisionPreviewSource("");
      return;
    }
    setRevisionPreviewNo(revisionNo);
    setRevisionPreviewSource("");
    setRevisionPreviewLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/workspace-documents/${encodeURIComponent(documentId)}/revisions/${revisionNo}`,
        { cache: "no-store" },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        source?: string;
        error?: string;
      };
      if (!response.ok || !payload.ok || typeof payload.source !== "string") {
        throw new Error(payload.error || "この版を読み込めなかったよ。");
      }
      setRevisionPreviewSource(payload.source);
    } catch (cause) {
      setRevisionPreviewNo(null);
      setError(cause instanceof Error ? cause.message : "この版を読み込めなかったよ。");
    } finally {
      setRevisionPreviewLoading(false);
    }
  }

  /**
   * 復元は「その版を新しい保存としてやり直す」だけ。いまの内容は復元の直前に版へ退避されるので、
   * 戻しすぎても取り返せる。楽観ロックには一覧が返した現物shaを使う。
   */
  async function restoreRevision(revisionNo: number) {
    if (!revisionsCurrentSha256) {
      setError("いまの内容を確認できていないよ。版履歴を開き直してね。");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/workspace-documents/${encodeURIComponent(documentId)}/revisions/${revisionNo}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ expectedSha256: revisionsCurrentSha256 }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        unchanged?: boolean;
        revisionNo?: number | null;
        conflict?: boolean;
        currentSha256?: string;
        error?: string;
      };
      if (response.status === 409 && payload.conflict) {
        setRevisionsCurrentSha256(
          typeof payload.currentSha256 === "string" ? payload.currentSha256 : null,
        );
        throw new Error(
          payload.error || "別のセッションがこの資料を更新しているよ。もう一度試してね。",
        );
      }
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "この版に戻せなかったよ。");
      }
      setOverlay(null);
      afterContentReplaced(
        payload.unchanged
          ? `v${revisionNo} はいまの内容と同じだったよ。`
          : payload.revisionNo
            ? `v${revisionNo} の内容に戻したよ。戻す前の内容は版履歴 v${payload.revisionNo} に残したよ。`
            : `v${revisionNo} の内容に戻したよ。`,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "この版に戻せなかったよ。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-white text-slate-950">
      {notice && (
        <div
          role="status"
          className="flex shrink-0 items-start gap-3 border-b border-emerald-200 bg-emerald-50 px-4 py-2 text-xs leading-5 text-emerald-900 sm:px-5"
        >
          <p className="min-w-0 flex-1">{notice}</p>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-emerald-800 hover:bg-emerald-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700"
            aria-label="お知らせを閉じる"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}

      <WorkspaceDocumentDeckEditor
        key={`${documentId}:${deckSessionKey}`}
        documentId={documentId}
        displayName={displayName}
        backHref={backHref}
        onDirtyChange={setDeckDirty}
        onOpenSource={() => void openHtmlEditor()}
        onOpenRevisions={() => void openHtmlRevisions(null)}
        onSaved={(message) => {
          setDeckDirty(false);
          setNotice(message);
          broadcastWorkspaceDocumentUpdated(documentId);
        }}
      />

      <Dialog
        open={overlay === "source"}
        onOpenChange={(open) => {
          if (open) return;
          closeHtmlEditor();
        }}
      >
        <DialogContent className="flex max-h-[calc(100dvh-32px)] w-[calc(100vw-32px)] max-w-4xl flex-col overflow-hidden bg-white p-0 text-slate-950">
          <form className="flex min-h-0 flex-1 flex-col" onSubmit={(event) => void saveHtmlSource(event)}>
            <DialogHeader className="shrink-0 border-b-4 border-[#0066cc] bg-[#081b2b] px-5 py-4 text-white">
              <DialogTitle className="text-base text-white sm:text-lg">HTMLを編集</DialogTitle>
              <DialogDescription className="mt-1 text-xs leading-5 text-cyan-100">
                {displayName}。ここはHTMLソースだけを編集する欄で、入力中のコードは実行しないよ。
              </DialogDescription>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              {error && (
                <div
                  role="alert"
                  className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-800"
                >
                  {error}
                </div>
              )}
              {htmlConflictSha256 && (
                <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-3 text-xs leading-5 text-amber-900">
                  <p className="font-semibold">別のセッションがこの資料を更新したよ。</p>
                  <p className="mt-1">
                    書いた内容は消してないよ。読み込み直すと下書きは現物の内容に入れ替わる。このまま上書きしても、
                    上書きされる側は版履歴へ残るからあとで戻せるよ。
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 border-amber-400 bg-white px-3 text-xs text-amber-900 hover:bg-amber-100"
                      disabled={busy || htmlSourceLoading}
                      onClick={() => void reloadHtmlSource()}
                    >
                      最新を読み込み直す
                    </Button>
                    <Button
                      type="button"
                      className="h-9 bg-amber-600 px-3 text-xs hover:bg-amber-700"
                      disabled={busy || htmlSourceLoading}
                      onClick={() => void submitHtmlSource(htmlConflictSha256)}
                    >
                      {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
                      このまま上書き保存
                    </Button>
                  </div>
                </div>
              )}
              {htmlSourceLoading ? (
                <div className="flex min-h-56 items-center justify-center gap-2 text-sm text-slate-500">
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                  HTMLソースを読み込み中
                </div>
              ) : (
                <label className="block text-xs font-semibold text-slate-700">
                  HTMLソース
                  <Textarea
                    value={draftHtmlSource}
                    onChange={(event) => setDraftHtmlSource(event.target.value)}
                    className="mt-2 min-h-[min(52dvh,520px)] resize-y rounded-md border-slate-300 bg-white font-mono text-xs leading-5 text-slate-950 focus-visible:border-blue-700 focus-visible:ring-blue-700/20"
                    spellCheck={false}
                    autoFocus
                    aria-describedby="workspace-document-html-editor-note"
                  />
                </label>
              )}
              <p id="workspace-document-html-editor-note" className="mt-3 text-xs leading-5 text-slate-500">
                {formatBytes(draftHtmlByteLength)} / {formatBytes(WORKSPACE_DOCUMENT_HTML_EDITOR_MAX_BYTES)}。保存すると、見たまま編集の表示も読み込み直すよ。
              </p>
            </div>
            <DialogFooter className="shrink-0 border-t border-slate-200 px-4 py-3 sm:px-5">
              <Button
                type="button"
                variant="outline"
                className="h-11 sm:mr-auto"
                disabled={busy || htmlSourceLoading}
                onClick={closeHtmlEditor}
              >
                <MousePointerClick className="h-4 w-4" aria-hidden />
                見たまま編集へ戻る
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11"
                disabled={busy || htmlSourceLoading}
                onClick={() => void openHtmlRevisions("source")}
              >
                <History className="h-4 w-4" aria-hidden />
                版履歴
              </Button>
              <Button
                type="submit"
                className="h-11 bg-[#0066cc] hover:bg-[#004f9e]"
                disabled={
                  busy ||
                  htmlSourceLoading ||
                  !draftHtmlSource.trim() ||
                  draftHtmlByteLength > WORKSPACE_DOCUMENT_HTML_EDITOR_MAX_BYTES
                }
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                HTMLを保存
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={overlay === "revisions"} onOpenChange={(open) => !open && returnFromRevisions()}>
        <DialogContent className="flex max-h-[calc(100dvh-32px)] w-[calc(100vw-32px)] max-w-3xl flex-col overflow-hidden bg-white p-0 text-slate-950">
          <DialogHeader className="shrink-0 border-b-4 border-[#0066cc] bg-[#081b2b] px-5 py-4 text-white">
            <DialogTitle className="text-base text-white sm:text-lg">版履歴</DialogTitle>
            <DialogDescription className="mt-1 text-xs leading-5 text-cyan-100">
              {displayName}。保存のたびに、上書きされる前の内容をここへ積んでいるよ。戻す操作も新しい保存として積まれるから、戻しすぎても取り返せる。
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
            {error && (
              <div
                role="alert"
                className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-800"
              >
                {error}
              </div>
            )}
            {revisionsLoading ? (
              <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                版履歴を読み込み中
              </div>
            ) : revisions.length === 0 ? (
              <p className="py-10 text-center text-sm leading-6 text-slate-500">
                まだ版が無いよ。次にこの資料を保存したときから、上書き前の内容がここへ残るよ。
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {revisions.map((revision) => (
                  <li key={revision.revisionId} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="text-sm font-semibold text-slate-900">v{revision.revisionNo}</span>
                      <span className="text-xs text-slate-600">{formatDateTime(revision.createdAt)}</span>
                      <span className="text-xs text-slate-500">{formatBytes(revision.byteSize)}</span>
                      {revision.pinned && (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-800">
                          常に保持
                        </span>
                      )}
                    </div>
                    {revision.note && (
                      <p className="mt-1 text-xs leading-5 text-slate-600">{revision.note}</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 px-3 text-xs"
                        disabled={revisionPreviewLoading}
                        onClick={() => void previewRevision(revision.revisionNo)}
                      >
                        {revisionPreviewNo === revision.revisionNo ? "中身を閉じる" : "中身を見る"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 px-3 text-xs"
                        disabled={busy || !revisionsCurrentSha256}
                        onClick={() => void restoreRevision(revision.revisionNo)}
                      >
                        <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                        この版に戻す
                      </Button>
                    </div>
                    {revisionPreviewNo === revision.revisionNo &&
                      (revisionPreviewLoading ? (
                        <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                          本文を読み込み中
                        </div>
                      ) : (
                        <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-slate-950 p-3 font-mono text-[11px] leading-5 text-slate-100">
                          {revisionPreviewSource}
                        </pre>
                      ))}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <DialogFooter className="shrink-0 border-t border-slate-200 px-4 py-3 sm:px-5">
            <Button type="button" variant="outline" className="h-11" onClick={returnFromRevisions}>
              {revisionsReturnTo === "source" ? "HTML編集に戻る" : "見たまま編集に戻る"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
