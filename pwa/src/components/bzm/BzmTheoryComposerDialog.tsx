"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { GripVertical, Trash2 } from "lucide-react";
import {
  THEORY_NODE_KINDS,
  THEORY_NODE_LAYERS,
  THEORY_NODE_STATUSES,
} from "@/lib/bzm-theory-graph";
import type {
  TheoryMemoType,
  TheoryNodeKind,
  TheoryNodeLayer,
  TheoryNodeStatus,
} from "@/lib/bzm-theory-graph";
import {
  BLUEPRINT,
  GRAPHITE,
  GRAPHITE_MUTED,
  KIND_LABEL,
  LAYER_LABEL,
  MEMO_TYPE_LABEL,
  MEMO_TYPE_OPTIONS,
  PAPER_BG,
  PAPER_BORDER,
  STATUS_LABEL,
  VERMILION,
  callTheoryMapApi,
  parseTheoryMapEdgeDto,
  parseTheoryMapMemoDto,
  parseTheoryMapNodeDto,
  type TheoryMapEdge,
  type TheoryMapMemo,
  type TheoryMapNode,
} from "@/lib/bzm-theory-map-ui";
import { BzmMarkdown, BzmMathText } from "@/components/bzm/BzmMarkdown";

// メモ (state.type === "memo") はノード内へ積む記録であり、選択ノードと
// エッジを共有しない。draft node もノードもエッジも作らず、既存ノードへの
// POST /api/bzm/theory-map { action: "create_memo" } だけを呼ぶ。
export type ComposerState =
  | { type: "create"; draftId: string }
  | { type: "memo"; node: TheoryMapNode }
  | { type: "edit"; node: TheoryMapNode };

export interface DraftNodeFields {
  kind: TheoryNodeKind;
  title: string;
  summary: string;
  layer: TheoryNodeLayer;
  status: TheoryNodeStatus;
  body: string;
  sourceRef: string;
}

const inputStyle = {
  borderColor: PAPER_BORDER,
  backgroundColor: PAPER_BG,
  color: GRAPHITE,
};

interface FormState {
  kind: TheoryNodeKind;
  title: string;
  summary: string;
  layer: TheoryNodeLayer;
  status: TheoryNodeStatus;
  body: string;
  sourceRef: string;
}

interface MemoFormState {
  memoType: TheoryMemoType;
  body: string;
}

function defaultFormState(): FormState {
  return {
    kind: "concept",
    title: "",
    summary: "",
    layer: "cross-layer",
    status: "hypothesis",
    body: "",
    sourceRef: "",
  };
}

function defaultMemoFormState(): MemoFormState {
  return { memoType: "supports", body: "" };
}

function nodeToFormState(node: TheoryMapNode): FormState {
  return {
    kind: node.kind,
    title: node.title,
    summary: node.summary,
    layer: node.layer,
    status: node.status,
    body: node.body,
    sourceRef: node.sourceRef,
  };
}

function sourceReferenceLabel(sourceRef: string) {
  if (!sourceRef) return "";
  try {
    const url = new URL(sourceRef);
    return `外部リンク: ${url.hostname}`;
  } catch {
    return sourceRef;
  }
}

export function BzmTheoryComposerDialog({
  state,
  onClose,
  onNodeCreated,
  onNodeUpdated,
  onNodeDeleted,
  onMemoCreated,
  onDraftChange,
  onError,
  getConnectionCount,
  getMemoCount,
  memos,
  draftPosition,
  onDragDelta,
}: {
  state: ComposerState | null;
  onClose: () => void;
  onNodeCreated: (node: TheoryMapNode, edge: TheoryMapEdge | null) => void;
  onNodeUpdated: (node: TheoryMapNode) => void;
  onNodeDeleted: (nodeId: string) => void;
  onMemoCreated: (memo: TheoryMapMemo) => void;
  onDraftChange: (draftId: string, fields: DraftNodeFields) => void;
  onError: (message: string) => void;
  getConnectionCount: (nodeId: string) => number;
  getMemoCount: (nodeId: string) => number;
  memos: TheoryMapMemo[];
  draftPosition?: { x: number; y: number } | null;
  onDragDelta?: (delta: { x: number; y: number }) => void;
}) {
  const titleId = useId();
  const [form, setForm] = useState<FormState>(defaultFormState());
  const [memoForm, setMemoForm] = useState<MemoFormState>(defaultMemoFormState());
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const skipDraftSyncRef = useRef(false);

  const open = state !== null;
  const mode = state?.type ?? "create";

  useEffect(() => {
    if (!state) return;
    // Resets all form/UI state when the dialog is (re)opened for a new state,
    // mirroring the codebase's established reset-on-prop-change pattern.
    /* eslint-disable react-hooks/set-state-in-effect */
    setError(null);
    setPending(false);
    setDeleteConfirmOpen(false);
    setAdvancedOpen(state.type === "edit");
    setEditing(state.type !== "edit");
    if (state.type === "create") {
      skipDraftSyncRef.current = true;
      setForm(defaultFormState());
    } else if (state.type === "memo") {
      setMemoForm(defaultMemoFormState());
    } else if (state.type === "edit") setForm(nodeToFormState(state.node));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [state]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      const panel = panelRef.current;
      const preferred = panel?.querySelector<HTMLElement>(
        "[data-bzm-autofocus='true']",
      );
      (
        preferred ??
        (editing
          ? panel?.querySelector<HTMLElement>("input, textarea, select")
          : null)
      )?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [mode, open, editing]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, pending]);

  useEffect(() => {
    if (!state || state.type !== "create") return;
    if (skipDraftSyncRef.current) {
      skipDraftSyncRef.current = false;
      return;
    }
    onDraftChange(state.draftId, form);
  }, [form, onDraftChange, state]);

  async function submitCreate() {
    if (!form.title.trim() || !form.summary.trim()) {
      setError("タイトルと要約は必須です。");
      return;
    }
    setPending(true);
    setError(null);
    const result = await callTheoryMapApi({
      method: "POST",
      body: {
        action: "create_node",
        title: form.title,
        kind: form.kind,
        layer: form.layer,
        status: form.status,
        summary: form.summary,
        bodyMd: form.body,
        sourceRef: form.sourceRef,
        positionX: draftPosition?.x,
        positionY: draftPosition?.y,
      },
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      onError(result.error);
      return;
    }
    const node = parseTheoryMapNodeDto(result.payload.node);
    if (!node) {
      const message = "サーバーの応答を解釈できませんでした。";
      setError(message);
      onError(message);
      return;
    }
    const edge = parseTheoryMapEdgeDto(result.payload.edge);
    onNodeCreated(node, edge);
  }

  async function submitMemo(node: TheoryMapNode) {
    if (!memoForm.body.trim()) {
      setError("メモの本文は必須です。");
      return;
    }
    setPending(true);
    setError(null);
    const result = await callTheoryMapApi({
      method: "POST",
      body: {
        action: "create_memo",
        nodeId: node.id,
        memoType: memoForm.memoType,
        body: memoForm.body,
      },
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      onError(result.error);
      return;
    }
    const memo = parseTheoryMapMemoDto(result.payload.memo);
    if (!memo) {
      const message = "サーバーの応答を解釈できませんでした。";
      setError(message);
      onError(message);
      return;
    }
    onMemoCreated(memo);
  }

  async function submitEdit(node: TheoryMapNode) {
    if (!form.title.trim() || !form.summary.trim()) {
      setError("タイトルと要約は必須です。");
      return;
    }
    setPending(true);
    setError(null);
    const result = await callTheoryMapApi({
      method: "PATCH",
      body: {
        nodeId: node.id,
        title: form.title,
        kind: form.kind,
        layer: form.layer,
        status: form.status,
        summary: form.summary,
        bodyMd: form.body,
        sourceRef: form.sourceRef,
      },
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      onError(result.error);
      return;
    }
    const updated = parseTheoryMapNodeDto(result.payload.node);
    if (!updated) {
      const message = "サーバーの応答を解釈できませんでした。";
      setError(message);
      onError(message);
      return;
    }
    onNodeUpdated(updated);
  }

  /** DELETE ?nodeId=。物理削除ではなく archived_at を立てる recoverable soft-delete。 */
  async function submitDelete(node: TheoryMapNode) {
    setPending(true);
    setError(null);
    const result = await callTheoryMapApi({
      method: "DELETE",
      query: `?nodeId=${encodeURIComponent(node.id)}`,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      onError(result.error);
      return;
    }
    onNodeDeleted(node.id);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (mode === "create") void submitCreate();
    else if (state?.type === "memo") void submitMemo(state.node);
    else if (state?.type === "edit" && !deleteConfirmOpen) void submitEdit(state.node);
  }

  const dialogTitle =
    mode === "create" ? "理論を書く" : mode === "memo" ? "メモを追加" : null;

  const requiredTextMissing =
    mode === "memo"
      ? !memoForm.body.trim()
      : !form.title.trim() || !form.summary.trim();

  function startHeaderDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (!onDragDelta || event.button !== 0) return;
    const target = event.currentTarget;
    const pointerId = event.pointerId;
    let previous = { x: event.clientX, y: event.clientY };
    target.setPointerCapture(pointerId);
    const move = (moveEvent: PointerEvent) => {
      onDragDelta({
        x: moveEvent.clientX - previous.x,
        y: moveEvent.clientY - previous.y,
      });
      previous = { x: moveEvent.clientX, y: moveEvent.clientY };
    };
    const end = () => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", end);
      target.removeEventListener("pointercancel", end);
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", end, { once: true });
    target.addEventListener("pointercancel", end, { once: true });
  }

  if (!open) return null;

  return (
    <aside
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby={dialogTitle ? titleId : undefined}
      aria-label={
        !dialogTitle && state?.type === "edit"
          ? deleteConfirmOpen
            ? `${state.node.title} を削除`
            : `${state.node.title} を編集`
          : undefined
      }
      data-bzm-map-panel="composer"
      data-bzm-map-overlay="composer"
      className="flex min-h-0 w-full flex-col overflow-hidden rounded-lg border shadow-xl"
      style={{
        // 親 host (data-bzm-map-overlay-host) は px の maxHeight を inline
        // style で持つ。子を100%指定のクラスで抑えようとしても、パーセント
        // maxHeight は definite height を持つ祖先に対してしか効かず (親の
        // maxHeight 自体は height ではないため)、本文が長い時に panel 全体が
        // host の外へ overflow していた。maxHeight: "inherit" で親の実際の
        // px 値をそのまま継承する。
        maxHeight: "inherit",
        backgroundColor: "#faf6ec",
        borderColor: PAPER_BORDER,
        color: GRAPHITE,
      }}
    >
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <div
          className="flex cursor-grab items-center gap-1.5 border-b px-2.5 py-1.5 active:cursor-grabbing"
          style={{ borderColor: PAPER_BORDER }}
          data-bzm-composer-drag-handle="true"
          onPointerDown={startHeaderDrag}
        >
          <GripVertical className="h-3.5 w-3.5 shrink-0" style={{ color: GRAPHITE_MUTED }} aria-hidden="true" />
          <div className="min-w-0 flex-1">
            {dialogTitle && (
              <h2
                id={titleId}
                className="text-sm font-semibold leading-tight"
                style={{ color: GRAPHITE }}
              >
                {dialogTitle}
              </h2>
            )}
            {mode === "create" && (
              <p className="mt-0.5 text-[11px]" style={{ color: BLUEPRINT }}>
                下書きノードをマップに作成済み
              </p>
            )}
            {state?.type === "memo" && (
              <p
                className="mt-0.5 truncate text-[11px]"
                style={{ color: GRAPHITE_MUTED }}
              >
                対象ノード:{" "}
                <span className="font-semibold">{state.node.title}</span>
              </p>
            )}
            {state?.type === "edit" && (
              <p
                className="truncate text-[11px] font-semibold"
                style={{ color: GRAPHITE_MUTED }}
              >
                {state.node.title}
              </p>
            )}
          </div>
        </div>

        <div
          data-bzm-composer-scroll="true"
          className="min-h-0 flex-1 overflow-y-auto px-2.5 py-2"
        >
          {mode === "memo" ? (
            <MemoFields form={memoForm} setForm={setMemoForm} />
          ) : mode === "edit" && deleteConfirmOpen && state?.type === "edit" ? (
            <DeleteConfirmFields
              node={state.node}
              connectionCount={getConnectionCount(state.node.id)}
              memoCount={getMemoCount(state.node.id)}
            />
          ) : mode === "edit" && state?.type === "edit" && !editing ? (
            <NodeReadMode
              node={state.node}
              memos={memos.filter((memo) => memo.nodeId === state.node.id)}
              onEdit={() => setEditing(true)}
            />
          ) : (
            <NodeFields
              form={form}
              setForm={setForm}
              showKindPicker={mode === "create" || mode === "edit"}
              advancedOpen={advancedOpen}
              setAdvancedOpen={setAdvancedOpen}
              showSourceRef={mode === "create" || form.kind === "source"}
              sourceRefLabel={
                mode === "create" ? "参考リンク（任意）" : undefined
              }
              sourceRefHint={
                mode === "create"
                  ? "URL・DOI・書誌情報・OS内参照を残せる"
                  : "根拠をたどれるURL、DOI、書誌情報を残す"
              }
            />
          )}

          {error && (
            <div
              className="mt-4 rounded-md border px-3 py-2 text-xs"
              style={{
                borderColor: VERMILION,
                backgroundColor: "rgba(180, 64, 42, 0.08)",
                color: VERMILION,
              }}
              role="alert"
            >
              {error}
            </div>
          )}
        </div>

        {(mode !== "edit" || editing || deleteConfirmOpen) && (
        <div
          className="flex items-center gap-1.5 border-t px-2.5 py-1.5"
          style={{
            borderColor: PAPER_BORDER,
            backgroundColor: "rgba(204, 194, 168, 0.16)",
          }}
        >
          {mode === "edit" && deleteConfirmOpen && state?.type === "edit" ? (
            <div className="flex flex-1 gap-2 sm:justify-end">
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(false)}
                disabled={pending}
                className="flex min-h-9 flex-1 items-center justify-center rounded-md border px-3 text-xs font-semibold disabled:opacity-50 sm:flex-none"
                style={{ borderColor: PAPER_BORDER, color: GRAPHITE_MUTED }}
              >
                編集へ戻る
              </button>
              <button
                type="button"
                data-bzm-node-delete-confirm="true"
                onClick={() => void submitDelete(state.node)}
                disabled={pending}
                className="flex min-h-9 flex-1 items-center justify-center rounded-md px-3 text-xs font-semibold text-white disabled:opacity-50 sm:flex-none"
                style={{ backgroundColor: VERMILION }}
              >
                {pending ? "削除中…" : "ノードを削除する"}
              </button>
            </div>
          ) : (
            <>
              {mode === "edit" && (
                <button
                  type="button"
                  data-bzm-node-delete-trigger="true"
                  onClick={() => setDeleteConfirmOpen(true)}
                  disabled={pending}
                  aria-label="ノードを削除"
                  className="flex h-9 w-9 shrink-0 items-center justify-center gap-1.5 rounded-md border text-xs font-semibold disabled:opacity-50 sm:w-auto sm:px-3"
                  style={{ borderColor: VERMILION, color: VERMILION }}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden sm:inline">削除</span>
                </button>
              )}
              <div className="flex flex-1 gap-2 sm:justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={pending}
                  className="flex min-h-9 flex-1 items-center justify-center rounded-md border px-3 text-xs font-semibold disabled:opacity-50 sm:flex-none"
                  style={{ borderColor: PAPER_BORDER, color: GRAPHITE_MUTED }}
                >
                  破棄
                </button>
                <button
                  type="submit"
                  disabled={pending || requiredTextMissing}
                  className="flex min-h-9 flex-1 items-center justify-center rounded-md px-3 text-xs font-semibold text-white disabled:opacity-50 sm:flex-none"
                  style={{ backgroundColor: BLUEPRINT }}
                >
                  {pending ? "保存中…" : mode === "edit" ? "更新する" : "保存する"}
                </button>
              </div>
            </>
          )}
        </div>
        )}
      </form>
    </aside>
  );
}

function NodeReadMode({
  node,
  memos,
  onEdit,
}: {
  node: TheoryMapNode;
  memos: TheoryMapMemo[];
  onEdit: () => void;
}) {
  const sourceLabel = sourceReferenceLabel(node.sourceRef);
  return (
    <div className="space-y-2 text-[12px] leading-[1.55]">
      <div className="flex flex-wrap gap-1 text-[10px] font-semibold" style={{ color: GRAPHITE_MUTED }}>
        <span className="rounded-full border px-1.5 py-0.5" style={{ borderColor: PAPER_BORDER, color: BLUEPRINT }}>{KIND_LABEL[node.kind]}</span>
        <span className="rounded-full border px-1.5 py-0.5" style={{ borderColor: PAPER_BORDER }}>{LAYER_LABEL[node.layer]}</span>
        <span className="rounded-full border px-1.5 py-0.5" style={{ borderColor: PAPER_BORDER }}>{STATUS_LABEL[node.status]}</span>
      </div>
      <h2 className="break-words text-base font-semibold leading-snug" style={{ color: GRAPHITE }}>
        <BzmMathText source={node.title} />
      </h2>
      <p className="whitespace-pre-wrap break-words" style={{ color: GRAPHITE_MUTED }}>
        <BzmMathText source={node.summary} />
      </p>
      {node.body && (
        <div className="border-t pt-2" style={{ borderColor: PAPER_BORDER }}>
          <BzmMarkdown source={node.body} compact />
        </div>
      )}
      {sourceLabel && (
        <div className="truncate rounded border px-2 py-1 text-[11px]" style={{ borderColor: PAPER_BORDER, color: BLUEPRINT }} title={sourceLabel}>
          出典: {sourceLabel}
        </div>
      )}
      <div className="flex items-center justify-between border-t pt-2" style={{ borderColor: PAPER_BORDER }}>
        <span className="text-[11px] font-semibold">メモ {memos.length}件</span>
        {node.editable && (
          <button type="button" onClick={onEdit} className="rounded border px-2 py-1 text-[11px] font-semibold" style={{ borderColor: PAPER_BORDER, color: BLUEPRINT }}>
            編集する
          </button>
        )}
      </div>
      {memos.length === 0 ? (
        <p className="text-[11px]" style={{ color: GRAPHITE_MUTED }}>メモはまだない</p>
      ) : (
        <div className="space-y-1.5">
          {memos.map((memo) => (
            <article key={memo.id} className="rounded border px-2 py-1.5" style={{ borderColor: PAPER_BORDER }}>
              <div className="mb-0.5 text-[10px] font-semibold" style={{ color: GRAPHITE_MUTED }}>{MEMO_TYPE_LABEL[memo.memoType]}</div>
              <div className="whitespace-pre-wrap break-words text-[12px] leading-[1.5]"><BzmMathText source={memo.body} /></div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function MemoFields({
  form,
  setForm,
}: {
  form: MemoFormState;
  setForm: (updater: (prev: MemoFormState) => MemoFormState) => void;
}) {
  const memoFieldId = useId();
  const roleFieldId = useId();

  return (
    <div className="flex flex-col gap-2.5">
      <div>
        <label
          htmlFor={memoFieldId}
          className="mb-1 block text-[11px] font-semibold"
          style={{ color: GRAPHITE_MUTED }}
        >
          メモ <span style={{ color: VERMILION }}>必須</span>
        </label>
        <textarea
          id={memoFieldId}
          data-bzm-autofocus="true"
          value={form.body}
          onChange={(e) => {
            const body = e.target.value;
            setForm((prev) => ({ ...prev, body }));
          }}
          required
          maxLength={2000}
          rows={5}
          placeholder="根拠・異論・反証・論点・検証結果などを書く"
          className="w-full rounded-md border px-2 py-1.5 text-xs outline-none"
          style={inputStyle}
        />
      </div>

      <div>
        <label
          htmlFor={roleFieldId}
          className="mb-1 block text-[11px] font-semibold"
          style={{ color: GRAPHITE_MUTED }}
        >
          このメモの役割
        </label>
        <select
          id={roleFieldId}
          value={form.memoType}
          onChange={(e) => {
            const memoType = e.target.value as TheoryMemoType;
            setForm((prev) => ({ ...prev, memoType }));
          }}
          className="h-9 w-full rounded-md border px-2 text-xs outline-none"
          style={inputStyle}
        >
          {MEMO_TYPE_OPTIONS.map((memoType) => (
            <option key={memoType} value={memoType}>
              {MEMO_TYPE_LABEL[memoType]}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function DeleteConfirmFields({
  node,
  connectionCount,
  memoCount,
}: {
  node: TheoryMapNode;
  connectionCount: number;
  memoCount: number;
}) {
  return (
    <div className="flex flex-col gap-3 text-sm" style={{ color: GRAPHITE }}>
      <p>
        「<span className="font-semibold">{node.title}</span>」を削除する？
      </p>
      <ul
        className="flex flex-col gap-1 rounded-md border px-3 py-2 text-xs"
        style={{ borderColor: PAPER_BORDER, color: GRAPHITE_MUTED }}
      >
        <li>接続しているノード: {connectionCount} 件</li>
        <li>メモ: {memoCount} 件</li>
      </ul>
      <p className="text-xs" style={{ color: VERMILION }}>
        削除すると、このノードと上記の接続・メモがマップと台帳から見えなくなる。この操作は取り消せない。
      </p>
    </div>
  );
}

function NodeFields({
  form,
  setForm,
  showKindPicker,
  advancedOpen,
  setAdvancedOpen,
  showSourceRef,
  sourceRefLabel,
  sourceRefHint,
}: {
  form: FormState;
  setForm: (updater: (prev: FormState) => FormState) => void;
  showKindPicker: boolean;
  advancedOpen: boolean;
  setAdvancedOpen: (v: boolean) => void;
  showSourceRef: boolean;
  sourceRefLabel?: string;
  sourceRefHint?: string;
}) {
  const titleFieldId = useId();
  const summaryFieldId = useId();

  const kindFieldId = useId();

  return (
    <div className="flex flex-col gap-2.5">
      {showKindPicker && (
        <div>
          <label
            htmlFor={kindFieldId}
            className="mb-1.5 block text-xs font-semibold"
            style={{ color: GRAPHITE_MUTED }}
          >
            種別
          </label>
          <select
            id={kindFieldId}
            data-bzm-kind-select="true"
            value={form.kind}
            onChange={(e) => {
              const kind = e.target.value as TheoryNodeKind;
              setForm((prev) => ({
                ...prev,
                kind,
                layer:
                  kind === "source"
                    ? "evidence"
                    : kind === "question"
                      ? "cross-layer"
                      : prev.layer,
                status:
                  kind === "source"
                    ? "established"
                    : kind === "question"
                      ? "unknown"
                      : prev.status,
              }));
            }}
            className="h-11 w-full rounded-md border px-2.5 text-sm outline-none"
            style={inputStyle}
          >
            {THEORY_NODE_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {KIND_LABEL[kind]}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label
          htmlFor={titleFieldId}
          className="mb-1.5 block text-xs font-semibold"
          style={{ color: GRAPHITE_MUTED }}
        >
          タイトル <span style={{ color: VERMILION }}>必須</span>
        </label>
        <input
          id={titleFieldId}
          data-bzm-autofocus="true"
          value={form.title}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, title: e.target.value }))
          }
          required
          maxLength={220}
          className="h-11 w-full rounded-md border px-3 text-sm outline-none"
          style={inputStyle}
        />
      </div>

      {showSourceRef && (
        <SourceRefField
          value={form.sourceRef}
          onChange={(sourceRef) => setForm((prev) => ({ ...prev, sourceRef }))}
          label={sourceRefLabel}
          hint={sourceRefHint}
        />
      )}

      <div>
        <label
          htmlFor={summaryFieldId}
          className="mb-1.5 block text-xs font-semibold"
          style={{ color: GRAPHITE_MUTED }}
        >
          要約 <span style={{ color: VERMILION }}>必須</span>
        </label>
        <textarea
          id={summaryFieldId}
          value={form.summary}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, summary: e.target.value }))
          }
          required
          maxLength={2000}
          rows={3}
          className="w-full rounded-md border px-3 py-2 text-sm outline-none"
          style={inputStyle}
        />
      </div>

      <button
        type="button"
        onClick={() => setAdvancedOpen(!advancedOpen)}
        aria-expanded={advancedOpen}
        className="flex min-h-11 items-center gap-1.5 self-start text-xs font-semibold"
        style={{ color: BLUEPRINT }}
      >
        {advancedOpen ? "詳細を隠す" : "詳細設定 (層・状態・本文・出典)"}
      </button>

      {advancedOpen && (
        <div
          className="flex flex-col gap-4 rounded-md border px-3 py-3"
          style={{ borderColor: PAPER_BORDER }}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <LabeledSelect
              label="層"
              value={form.layer}
              onChange={(v) =>
                setForm((prev) => ({ ...prev, layer: v as TheoryNodeLayer }))
              }
              options={THEORY_NODE_LAYERS.map((l) => ({
                value: l,
                label: LAYER_LABEL[l],
              }))}
            />
            <LabeledSelect
              label="状態"
              value={form.status}
              onChange={(v) =>
                setForm((prev) => ({ ...prev, status: v as TheoryNodeStatus }))
              }
              options={THEORY_NODE_STATUSES.map((s) => ({
                value: s,
                label: STATUS_LABEL[s],
              }))}
            />
          </div>
          {!showSourceRef && (
            <SourceRefField
              value={form.sourceRef}
              onChange={(sourceRef) =>
                setForm((prev) => ({ ...prev, sourceRef }))
              }
            />
          )}
          <div>
            <label
              className="mb-1.5 block text-xs font-semibold"
              style={{ color: GRAPHITE_MUTED }}
            >
              本文 (Markdown)
            </label>
            <textarea
              value={form.body}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, body: e.target.value }))
              }
              maxLength={30000}
              rows={6}
              className="w-full rounded-md border px-3 py-2 text-sm outline-none"
              style={inputStyle}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function SourceRefField({
  value,
  onChange,
  label = "出典 (URL・DOI・bzm/*.md)",
  hint,
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  hint?: string;
}) {
  const fieldId = useId();
  return (
    <div>
      <label
        htmlFor={fieldId}
        className="mb-1.5 block text-xs font-semibold"
        style={{ color: GRAPHITE_MUTED }}
      >
        {label}
      </label>
      <input
        id={fieldId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={1000}
        placeholder="URL・DOI・書誌情報"
        className="h-11 w-full rounded-md border px-3 text-sm outline-none"
        style={inputStyle}
      />
      {hint && (
        <p className="mt-1 text-[11px]" style={{ color: GRAPHITE_MUTED }}>
          {hint}
        </p>
      )}
    </div>
  );
}

function LabeledSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  const fieldId = useId();
  return (
    <div>
      <label
        htmlFor={fieldId}
        className="mb-1.5 block text-xs font-semibold"
        style={{ color: GRAPHITE_MUTED }}
      >
        {label}
      </label>
      <select
        id={fieldId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-md border px-2.5 text-sm outline-none"
        style={inputStyle}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
