"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  BookOpenText,
  CheckCircle2,
  HelpCircle,
  Lightbulb,
  Quote,
  Ruler,
  X,
} from "lucide-react";
import {
  THEORY_NODE_KINDS,
  THEORY_NODE_LAYERS,
  THEORY_NODE_STATUSES,
} from "@/lib/bzm-theory-graph";
import type {
  TheoryNodeKind,
  TheoryNodeLayer,
  TheoryNodeStatus,
  TheoryRelationType,
} from "@/lib/bzm-theory-graph";
import {
  BLUEPRINT,
  GRAPHITE,
  GRAPHITE_MUTED,
  KIND_COLOR,
  KIND_LABEL,
  LAYER_LABEL,
  PAPER_BG,
  PAPER_BORDER,
  RELATION_LABEL,
  STATUS_LABEL,
  VERMILION,
  callTheoryMapApi,
  parseTheoryMapEdgeDto,
  rgba,
  type TheoryMapEdge,
  type TheoryMapNode,
} from "@/lib/bzm-theory-map-ui";

export type ComposerState =
  | { type: "create"; draftId: string }
  | {
      type: "grow";
      preset: "support" | "challenge" | "question";
      draftId: string;
    }
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

const KIND_OPTIONS: { kind: TheoryNodeKind; icon: typeof Lightbulb }[] = [
  { kind: "concept", icon: Lightbulb },
  { kind: "claim", icon: Quote },
  { kind: "measure", icon: Ruler },
  { kind: "decision", icon: CheckCircle2 },
  { kind: "source", icon: BookOpenText },
  { kind: "question", icon: HelpCircle },
];

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

function presetFormState(
  preset: "support" | "challenge" | "question",
): FormState {
  if (preset === "question") {
    return {
      kind: "question",
      title: "",
      summary: "",
      layer: "cross-layer",
      status: "unknown",
      body: "",
      sourceRef: "",
    };
  }
  return {
    kind: "source",
    title: "",
    summary: "",
    layer: "evidence",
    status: "established",
    body: "",
    sourceRef: "",
  };
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

function presetLabel(preset: "support" | "challenge" | "question") {
  if (preset === "support") return "根拠をつなぐ";
  if (preset === "challenge") return "異論をつなぐ";
  return "論点を残す";
}

function presetRelationType(
  preset: "support" | "challenge" | "question",
): TheoryRelationType {
  if (preset === "support") return "supports";
  if (preset === "challenge") return "challenges";
  return "raises";
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
  selected,
  onClose,
  onNodeCreated,
  onNodeUpdated,
  onDraftChange,
  onError,
}: {
  state: ComposerState | null;
  selected: TheoryMapNode | null;
  onClose: () => void;
  onNodeCreated: (node: TheoryMapNode, edge: TheoryMapEdge | null) => void;
  onNodeUpdated: (node: TheoryMapNode) => void;
  onDraftChange: (draftId: string, fields: DraftNodeFields) => void;
  onError: (message: string) => void;
}) {
  const titleId = useId();
  const [form, setForm] = useState<FormState>(defaultFormState());
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
    } else if (state.type === "grow") {
      skipDraftSyncRef.current = true;
      setForm(presetFormState(state.preset));
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
    if (!state || state.type === "edit") return;
    if (skipDraftSyncRef.current) {
      skipDraftSyncRef.current = false;
      return;
    }
    onDraftChange(state.draftId, form);
  }, [form, onDraftChange, state]);

  async function submitCreateOrGrow(
    preset: "support" | "challenge" | "question" | null,
  ) {
    if (!form.title.trim() || !form.summary.trim()) {
      setError("タイトルと要約は必須です。");
      return;
    }
    setPending(true);
    setError(null);
    const relation =
      preset && selected
        ? {
            type: presetRelationType(preset),
            targetId: selected.id,
            direction: preset === "question" ? "incoming" : "outgoing",
          }
        : undefined;
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
        relation,
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
    if (mode === "create") void submitCreateOrGrow(null);
    else if (state?.type === "grow") void submitCreateOrGrow(state.preset);
    else if (state?.type === "edit") void submitEdit(state.node);
  }

  const dialogTitle =
    mode === "create"
      ? "理論を書く"
      : mode === "grow"
        ? presetLabel(
            (
              state as {
                type: "grow";
                preset: "support" | "challenge" | "question";
              }
            ).preset,
          )
        : "ノードを編集";

  const requiredTextMissing = !form.title.trim() || !form.summary.trim();

  const previewText = useMemo(() => {
    if (mode === "grow" && state?.type === "grow" && selected) {
      const newTitle = form.title.trim() || "(新しいノード)";
      const rel = RELATION_LABEL[presetRelationType(state.preset)];
      if (state.preset === "question") {
        return `${selected.title} → ${rel} → ${newTitle}`;
      }
      return `${newTitle} → ${rel} → ${selected.title}`;
    }
    return null;
  }, [mode, state, selected, form.title]);

  if (!open) return null;

  return (
    <aside
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      data-bzm-map-panel="composer"
      data-bzm-map-overlay="composer"
      className="flex max-h-full min-h-0 w-full flex-col overflow-hidden rounded-xl border shadow-xl"
      style={{
        backgroundColor: "#faf6ec",
        borderColor: PAPER_BORDER,
        color: GRAPHITE,
      }}
    >
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <div
          className="flex items-start gap-3 border-b px-4 py-4"
          style={{ borderColor: PAPER_BORDER }}
        >
          <div className="min-w-0 flex-1">
            <h2
              id={titleId}
              className="text-lg font-semibold leading-tight"
              style={{ color: GRAPHITE }}
            >
              {dialogTitle}
            </h2>
            {mode !== "edit" && (
              <p className="mt-1 text-xs" style={{ color: BLUEPRINT }}>
                下書きノードをマップに作成済み
              </p>
            )}
            {selected && mode === "grow" && (
              <p
                className="mt-1 truncate text-xs"
                style={{ color: GRAPHITE_MUTED }}
              >
                選択中: <span className="font-semibold">{selected.title}</span>
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

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <NodeFields
            form={form}
            setForm={setForm}
            showKindPicker={mode === "create" || mode === "edit"}
            advancedOpen={advancedOpen}
            setAdvancedOpen={setAdvancedOpen}
            showSourceRef={form.kind === "source"}
          />

          {previewText && (
            <div
              className="mt-4 rounded-md border px-3 py-2 text-xs leading-5"
              style={{
                borderColor: BLUEPRINT,
                backgroundColor: "rgba(41, 82, 163, 0.08)",
                color: BLUEPRINT,
              }}
            >
              <div className="mb-0.5 font-semibold">接続のプレビュー</div>
              <div className="break-words [overflow-wrap:anywhere]">
                {previewText}
              </div>
            </div>
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
          className="flex gap-2 border-t px-4 py-3 sm:justify-end sm:py-4"
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

  return (
    <div className="flex flex-col gap-4">
      {showKindPicker && (
        <div>
          <span
            className="mb-1.5 block text-xs font-semibold"
            style={{ color: GRAPHITE_MUTED }}
          >
            種別
          </span>
          <div
            className="grid grid-cols-3 gap-2"
            role="radiogroup"
            aria-label="ノードの種別"
          >
            {KIND_OPTIONS.map(({ kind, icon: Icon }) => (
              <button
                key={kind}
                type="button"
                role="radio"
                aria-checked={form.kind === kind}
                onClick={() =>
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
                  }))
                }
                className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-md border px-2 py-2 text-xs font-medium"
                style={{
                  borderColor:
                    form.kind === kind ? KIND_COLOR[kind] : PAPER_BORDER,
                  backgroundColor:
                    form.kind === kind
                      ? rgba(KIND_COLOR[kind], 0.12)
                      : PAPER_BG,
                  color: GRAPHITE,
                }}
              >
                <Icon
                  className="h-4 w-4"
                  style={{ color: KIND_COLOR[kind] }}
                  aria-hidden="true"
                />
                {KIND_LABEL[kind]}
              </button>
            ))}
          </div>
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
