"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { X } from "lucide-react";
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
  type TheoryMapEdge,
  type TheoryMapMemo,
  type TheoryMapNode,
} from "@/lib/bzm-theory-map-ui";

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isAllowed<T extends string>(
  values: readonly T[],
  value: unknown,
): value is T {
  return (
    typeof value === "string" && (values as readonly string[]).includes(value)
  );
}

function parseNodeDto(value: unknown): TheoryMapNode | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.id !== "string" ||
    typeof value.title !== "string" ||
    !isAllowed(THEORY_NODE_KINDS, value.kind) ||
    !isAllowed(THEORY_NODE_LAYERS, value.layer) ||
    !isAllowed(THEORY_NODE_STATUSES, value.status)
  )
    return null;
  return {
    id: value.id,
    title: value.title,
    kind: value.kind,
    layer: value.layer,
    status: value.status,
    summary: typeof value.summary === "string" ? value.summary : "",
    sourceRef: typeof value.sourceRef === "string" ? value.sourceRef : "",
    sourceHref: typeof value.sourceHref === "string" ? value.sourceHref : null,
    body: typeof value.body === "string" ? value.body : "",
    editable: value.editable === true,
  };
}

export function BzmTheoryComposerDialog({
  state,
  onClose,
  onNodeCreated,
  onNodeUpdated,
  onMemoCreated,
  onDraftChange,
  onError,
}: {
  state: ComposerState | null;
  onClose: () => void;
  onNodeCreated: (node: TheoryMapNode, edge: TheoryMapEdge | null) => void;
  onNodeUpdated: (node: TheoryMapNode) => void;
  onMemoCreated: (memo: TheoryMapMemo) => void;
  onDraftChange: (draftId: string, fields: DraftNodeFields) => void;
  onError: (message: string) => void;
}) {
  const titleId = useId();
  const [form, setForm] = useState<FormState>(defaultFormState());
  const [memoForm, setMemoForm] = useState<MemoFormState>(defaultMemoFormState());
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    setAdvancedOpen(state.type === "edit");
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
        panel?.querySelector<HTMLElement>("input, textarea, select, button")
      )?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [mode, open]);

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
      },
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      onError(result.error);
      return;
    }
    const node = parseNodeDto(result.payload.node);
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
    const updated = parseNodeDto(result.payload.node);
    if (!updated) {
      const message = "サーバーの応答を解釈できませんでした。";
      setError(message);
      onError(message);
      return;
    }
    onNodeUpdated(updated);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (mode === "create") void submitCreate();
    else if (state?.type === "memo") void submitMemo(state.node);
    else if (state?.type === "edit") void submitEdit(state.node);
  }

  const dialogTitle =
    mode === "create" ? "理論を書く" : mode === "memo" ? "メモを追加" : null;

  const requiredTextMissing =
    mode === "memo"
      ? !memoForm.body.trim()
      : !form.title.trim() || !form.summary.trim();

  if (!open) return null;

  return (
    <aside
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby={dialogTitle ? titleId : undefined}
      aria-label={
        !dialogTitle && state?.type === "edit"
          ? `${state.node.title} を編集`
          : undefined
      }
      data-bzm-map-panel="composer"
      data-bzm-map-overlay="composer"
      className="flex min-h-0 w-full flex-col overflow-hidden rounded-xl border shadow-xl"
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
          className="flex items-start gap-2 border-b px-3 py-2"
          style={{ borderColor: PAPER_BORDER }}
        >
          <div className="min-w-0 flex-1">
            {dialogTitle && (
              <h2
                id={titleId}
                className="text-lg font-semibold leading-tight"
                style={{ color: GRAPHITE }}
              >
                {dialogTitle}
              </h2>
            )}
            {mode === "create" && (
              <p className="mt-1 text-xs" style={{ color: BLUEPRINT }}>
                下書きノードをマップに作成済み
              </p>
            )}
            {state?.type === "memo" && (
              <p
                className="mt-1 truncate text-xs"
                style={{ color: GRAPHITE_MUTED }}
              >
                対象ノード:{" "}
                <span className="font-semibold">{state.node.title}</span>
              </p>
            )}
            {state?.type === "edit" && (
              <p
                className="truncate text-xs font-semibold"
                style={{ color: GRAPHITE_MUTED }}
              >
                {state.node.title}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-md border disabled:opacity-50"
            style={{ borderColor: PAPER_BORDER, color: GRAPHITE_MUTED }}
            aria-label="閉じる"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div
          data-bzm-composer-scroll="true"
          className="min-h-0 flex-1 overflow-y-auto px-3 py-3"
        >
          {mode === "memo" ? (
            <MemoFields form={memoForm} setForm={setMemoForm} />
          ) : (
            <NodeFields
              form={form}
              setForm={setForm}
              showKindPicker={mode === "create" || mode === "edit"}
              advancedOpen={advancedOpen}
              setAdvancedOpen={setAdvancedOpen}
              showSourceRef={form.kind === "source"}
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

        <div
          className="flex gap-2 border-t px-3 py-2 sm:justify-end"
          style={{
            borderColor: PAPER_BORDER,
            backgroundColor: "rgba(204, 194, 168, 0.16)",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="flex min-h-11 flex-1 items-center justify-center rounded-md border px-4 text-sm font-semibold disabled:opacity-50 sm:flex-none"
            style={{ borderColor: PAPER_BORDER, color: GRAPHITE_MUTED }}
          >
            キャンセル
          </button>
          <button
            type="submit"
            disabled={pending || requiredTextMissing}
            className="flex min-h-11 flex-1 items-center justify-center rounded-md px-4 text-sm font-semibold text-white disabled:opacity-50 sm:flex-none"
            style={{ backgroundColor: BLUEPRINT }}
          >
            {pending ? "保存中…" : mode === "edit" ? "更新する" : "保存する"}
          </button>
        </div>
      </form>
    </aside>
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
    <div className="flex flex-col gap-4">
      <div>
        <label
          htmlFor={memoFieldId}
          className="mb-1.5 block text-xs font-semibold"
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
          rows={6}
          placeholder="根拠・異論・反証・論点・検証結果などを書く"
          className="w-full rounded-md border px-3 py-2 text-sm outline-none"
          style={inputStyle}
        />
      </div>

      <div>
        <label
          htmlFor={roleFieldId}
          className="mb-1.5 block text-xs font-semibold"
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
          className="h-11 w-full rounded-md border px-2.5 text-sm outline-none"
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

function NodeFields({
  form,
  setForm,
  showKindPicker,
  advancedOpen,
  setAdvancedOpen,
  showSourceRef,
}: {
  form: FormState;
  setForm: (updater: (prev: FormState) => FormState) => void;
  showKindPicker: boolean;
  advancedOpen: boolean;
  setAdvancedOpen: (v: boolean) => void;
  showSourceRef: boolean;
}) {
  const titleFieldId = useId();
  const summaryFieldId = useId();

  const kindFieldId = useId();

  return (
    <div className="flex flex-col gap-4">
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
          hint="根拠をたどれるURL、DOI、書誌情報を残す"
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
  hint,
}: {
  value: string;
  onChange: (value: string) => void;
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
        出典 (URL・DOI・bzm/*.md)
      </label>
      <input
        id={fieldId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={1000}
        placeholder="https://… / DOI:… / BZM_2_0_REVISION_REQUIREMENTS.md#…"
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
