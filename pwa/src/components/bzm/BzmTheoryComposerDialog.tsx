"use client";

import { useEffect, useId, useMemo, useState, type FormEvent } from "react";
import { BookOpenText, CheckCircle2, HelpCircle, Lightbulb, Quote, Ruler, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  THEORY_NODE_KINDS,
  THEORY_NODE_LAYERS,
  THEORY_NODE_STATUSES,
  THEORY_RELATION_TYPES,
} from "@/lib/bzm-theory-graph";
import type { TheoryNodeKind, TheoryNodeLayer, TheoryNodeStatus, TheoryRelationType } from "@/lib/bzm-theory-graph";
import {
  BLUEPRINT,
  GRAPHITE,
  GRAPHITE_MUTED,
  KIND_LABEL,
  LAYER_LABEL,
  PAPER_BG,
  PAPER_BORDER,
  RELATION_LABEL,
  STATUS_LABEL,
  VERMILION,
  callTheoryMapApi,
  type TheoryMapEdge,
  type TheoryMapNode,
} from "@/lib/bzm-theory-map-ui";

export type ComposerState =
  | { type: "create" }
  | { type: "grow"; preset: "support" | "challenge" | "question" }
  | { type: "connect" }
  | { type: "edit"; node: TheoryMapNode };

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

function presetFormState(preset: "support" | "challenge" | "question"): FormState {
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

function presetRelationType(preset: "support" | "challenge" | "question"): TheoryRelationType {
  if (preset === "support") return "supports";
  if (preset === "challenge") return "challenges";
  return "raises";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isAllowed<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (values as readonly string[]).includes(value);
}

function parseNodeDto(value: unknown): TheoryMapNode | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.id !== "string" ||
    typeof value.title !== "string" ||
    !isAllowed(THEORY_NODE_KINDS, value.kind) ||
    !isAllowed(THEORY_NODE_LAYERS, value.layer) ||
    !isAllowed(THEORY_NODE_STATUSES, value.status)
  ) return null;
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

function parseEdgeDto(value: unknown): TheoryMapEdge | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.from !== "string" ||
    typeof value.to !== "string" ||
    !isAllowed(THEORY_RELATION_TYPES, value.type)
  ) return null;
  return {
    from: value.from,
    to: value.to,
    type: value.type,
    id: typeof value.id === "string" ? value.id : null,
    note: typeof value.note === "string" ? value.note : null,
    editable: value.editable === true,
  };
}

export function BzmTheoryComposerDialog({
  state,
  selected,
  nodes,
  onClose,
  onNodeCreated,
  onEdgeCreated,
  onNodeUpdated,
  onError,
}: {
  state: ComposerState | null;
  selected: TheoryMapNode | null;
  nodes: TheoryMapNode[];
  onClose: () => void;
  onNodeCreated: (node: TheoryMapNode, edge: TheoryMapEdge | null) => void;
  onEdgeCreated: (edge: TheoryMapEdge) => void;
  onNodeUpdated: (node: TheoryMapNode) => void;
  onError: (message: string) => void;
}) {
  const titleId = useId();
  const [form, setForm] = useState<FormState>(defaultFormState());
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [targetId, setTargetId] = useState<string | null>(null);
  const [relationType, setRelationType] = useState<TheoryRelationType>("supports");
  const [direction, setDirection] = useState<"outgoing" | "incoming">("outgoing");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = state !== null;
  const mode = state?.type ?? "create";

  useEffect(() => {
    if (!state) return;
    // Resets all form/UI state when the dialog is (re)opened for a new state,
    // mirroring the codebase's established reset-on-prop-change pattern.
    /* eslint-disable react-hooks/set-state-in-effect */
    setError(null);
    setPending(false);
    setSearch("");
    setNote("");
    setTargetId(null);
    setDirection(state.type === "grow" && state.preset === "question" ? "incoming" : "outgoing");
    setRelationType(state.type === "grow" ? presetRelationType(state.preset) : "supports");
    setAdvancedOpen(state.type === "edit");
    if (state.type === "create") setForm(defaultFormState());
    else if (state.type === "grow") setForm(presetFormState(state.preset));
    else if (state.type === "edit") setForm(nodeToFormState(state.node));
    else setForm(defaultFormState());
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [state]);

  const searchResults = useMemo(() => {
    if (mode !== "connect" || !selected) return [];
    const q = search.trim().toLowerCase();
    return nodes
      .filter((n) => n.id !== selected.id)
      .filter((n) => !q || `${n.id} ${n.title} ${n.summary}`.toLowerCase().includes(q))
      .slice(0, 30);
  }, [mode, nodes, search, selected]);

  const target = targetId ? (nodes.find((n) => n.id === targetId) ?? null) : null;

  function handleOpenChange(next: boolean) {
    if (!next && !pending) onClose();
  }

  async function submitCreateOrGrow(preset: "support" | "challenge" | "question" | null) {
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
    const edge = parseEdgeDto(result.payload.edge);
    onNodeCreated(node, edge);
  }

  async function submitConnect() {
    if (!selected || !target) {
      setError("接続先のノードを選んでください。");
      return;
    }
    setPending(true);
    setError(null);
    const from = direction === "outgoing" ? selected.id : target.id;
    const to = direction === "outgoing" ? target.id : selected.id;
    const result = await callTheoryMapApi({
      method: "POST",
      body: { action: "create_edge", from, to, type: relationType, note: note || undefined },
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      onError(result.error);
      return;
    }
    const edge = parseEdgeDto(result.payload.edge);
    if (!edge) {
      const message = "サーバーの応答を解釈できませんでした。";
      setError(message);
      onError(message);
      return;
    }
    onEdgeCreated(edge);
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
    else if (mode === "connect") void submitConnect();
    else if (state?.type === "edit") void submitEdit(state.node);
  }

  const dialogTitle =
    mode === "create"
      ? "理論を書く"
      : mode === "grow"
        ? presetLabel((state as { type: "grow"; preset: "support" | "challenge" | "question" }).preset)
        : mode === "connect"
          ? "既存ノードとつなぐ"
          : "ノードを編集";

  const requiredTextMissing = mode !== "connect" && (!form.title.trim() || !form.summary.trim());

  const previewText = useMemo(() => {
    if (mode === "grow" && state?.type === "grow" && selected) {
      const newTitle = form.title.trim() || "(新しいノード)";
      const rel = RELATION_LABEL[presetRelationType(state.preset)];
      if (state.preset === "question") {
        return `${selected.title} → ${rel} → ${newTitle}`;
      }
      return `${newTitle} → ${rel} → ${selected.title}`;
    }
    if (mode === "connect" && selected) {
      const other = target?.title ?? "(接続先未選択)";
      const rel = RELATION_LABEL[relationType];
      return direction === "outgoing" ? `${selected.title} → ${rel} → ${other}` : `${other} → ${rel} → ${selected.title}`;
    }
    return null;
  }, [mode, state, selected, form.title, relationType, direction, target]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        aria-labelledby={titleId}
        showCloseButton={false}
        className="inset-x-0 bottom-0 top-auto left-0 right-0 max-h-[92vh] w-full max-w-full translate-x-0 translate-y-0 overflow-y-auto rounded-t-2xl rounded-b-none p-0 sm:top-1/2 sm:left-1/2 sm:right-auto sm:bottom-auto sm:max-h-[85vh] sm:w-full sm:max-w-2xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl"
        style={{ backgroundColor: "#faf6ec", borderColor: PAPER_BORDER, color: GRAPHITE }}
      >
        <form onSubmit={handleSubmit} className="flex max-h-[92vh] flex-col sm:max-h-[85vh]">
          <DialogHeader className="border-b px-4 py-4" style={{ borderColor: PAPER_BORDER }}>
            <DialogTitle id={titleId} style={{ color: GRAPHITE }}>
              {dialogTitle}
            </DialogTitle>
            {selected && (mode === "grow" || mode === "connect") && (
              <DialogDescription style={{ color: GRAPHITE_MUTED }}>
                選択中のノード: <span className="font-semibold">{selected.title}</span>
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {mode === "connect" ? (
              <ConnectFields
                search={search}
                setSearch={setSearch}
                searchResults={searchResults}
                targetId={targetId}
                setTargetId={setTargetId}
                relationType={relationType}
                setRelationType={setRelationType}
                direction={direction}
                setDirection={setDirection}
                note={note}
                setNote={setNote}
              />
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

            {previewText && (
              <div
                className="mt-4 rounded-md border px-3 py-2 text-xs leading-5"
                style={{ borderColor: BLUEPRINT, backgroundColor: "rgba(41, 82, 163, 0.08)", color: BLUEPRINT }}
              >
                <div className="mb-0.5 font-semibold">接続のプレビュー</div>
                <div className="break-words [overflow-wrap:anywhere]">{previewText}</div>
              </div>
            )}

            {error && (
              <div
                className="mt-4 rounded-md border px-3 py-2 text-xs"
                style={{ borderColor: VERMILION, backgroundColor: "rgba(180, 64, 42, 0.08)", color: VERMILION }}
                role="alert"
              >
                {error}
              </div>
            )}
          </div>

          <div
            className="flex flex-col-reverse gap-2 border-t px-4 py-4 sm:flex-row sm:justify-end"
            style={{ borderColor: PAPER_BORDER, backgroundColor: "rgba(204, 194, 168, 0.16)" }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="flex min-h-11 items-center justify-center rounded-md border px-4 text-sm font-semibold disabled:opacity-50"
              style={{ borderColor: PAPER_BORDER, color: GRAPHITE_MUTED }}
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={pending || requiredTextMissing || (mode === "connect" && !target)}
              className="flex min-h-11 items-center justify-center rounded-md px-4 text-sm font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: BLUEPRINT }}
            >
              {pending ? "送信中…" : mode === "edit" ? "更新する" : mode === "connect" ? "接続する" : "作成する"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
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
          <span className="mb-1.5 block text-xs font-semibold" style={{ color: GRAPHITE_MUTED }}>
            種別
          </span>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="ノードの種別">
            {KIND_OPTIONS.map(({ kind, icon: Icon }) => (
              <button
                key={kind}
                type="button"
                role="radio"
                aria-checked={form.kind === kind}
                onClick={() => setForm((prev) => ({
                  ...prev,
                  kind,
                  layer: kind === "source" ? "evidence" : kind === "question" ? "cross-layer" : prev.layer,
                  status: kind === "source" ? "established" : kind === "question" ? "unknown" : prev.status,
                }))}
                className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-md border px-2 py-2 text-xs font-medium"
                style={{
                  borderColor: form.kind === kind ? BLUEPRINT : PAPER_BORDER,
                  backgroundColor: form.kind === kind ? "rgba(41, 82, 163, 0.1)" : PAPER_BG,
                  color: form.kind === kind ? BLUEPRINT : GRAPHITE,
                }}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {KIND_LABEL[kind]}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <label htmlFor={titleFieldId} className="mb-1.5 block text-xs font-semibold" style={{ color: GRAPHITE_MUTED }}>
          タイトル <span style={{ color: VERMILION }}>必須</span>
        </label>
        <input
          id={titleFieldId}
          value={form.title}
          onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
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
        <label htmlFor={summaryFieldId} className="mb-1.5 block text-xs font-semibold" style={{ color: GRAPHITE_MUTED }}>
          要約 <span style={{ color: VERMILION }}>必須</span>
        </label>
        <textarea
          id={summaryFieldId}
          value={form.summary}
          onChange={(e) => setForm((prev) => ({ ...prev, summary: e.target.value }))}
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
        <div className="flex flex-col gap-4 rounded-md border px-3 py-3" style={{ borderColor: PAPER_BORDER }}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <LabeledSelect
              label="層"
              value={form.layer}
              onChange={(v) => setForm((prev) => ({ ...prev, layer: v as TheoryNodeLayer }))}
              options={THEORY_NODE_LAYERS.map((l) => ({ value: l, label: LAYER_LABEL[l] }))}
            />
            <LabeledSelect
              label="状態"
              value={form.status}
              onChange={(v) => setForm((prev) => ({ ...prev, status: v as TheoryNodeStatus }))}
              options={THEORY_NODE_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
            />
          </div>
          {!showSourceRef && (
            <SourceRefField
              value={form.sourceRef}
              onChange={(sourceRef) => setForm((prev) => ({ ...prev, sourceRef }))}
            />
          )}
          <div>
            <label className="mb-1.5 block text-xs font-semibold" style={{ color: GRAPHITE_MUTED }}>
              本文 (Markdown)
            </label>
            <textarea
              value={form.body}
              onChange={(e) => setForm((prev) => ({ ...prev, body: e.target.value }))}
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
      <label htmlFor={fieldId} className="mb-1.5 block text-xs font-semibold" style={{ color: GRAPHITE_MUTED }}>
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
      {hint && <p className="mt-1 text-[11px]" style={{ color: GRAPHITE_MUTED }}>{hint}</p>}
    </div>
  );
}

function ConnectFields({
  search,
  setSearch,
  searchResults,
  targetId,
  setTargetId,
  relationType,
  setRelationType,
  direction,
  setDirection,
  note,
  setNote,
}: {
  search: string;
  setSearch: (v: string) => void;
  searchResults: TheoryMapNode[];
  targetId: string | null;
  setTargetId: (id: string) => void;
  relationType: TheoryRelationType;
  setRelationType: (t: TheoryRelationType) => void;
  direction: "outgoing" | "incoming";
  setDirection: (d: "outgoing" | "incoming") => void;
  note: string;
  setNote: (v: string) => void;
}) {
  const searchFieldId = useId();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label htmlFor={searchFieldId} className="mb-1.5 block text-xs font-semibold" style={{ color: GRAPHITE_MUTED }}>
          接続先ノードを検索
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: GRAPHITE_MUTED }} />
          <input
            id={searchFieldId}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="id / タイトル / 要約で検索"
            className="h-11 w-full rounded-md border pl-9 pr-3 text-sm outline-none"
            style={inputStyle}
          />
        </div>
        <ul
          className="mt-2 max-h-48 divide-y overflow-y-auto rounded-md border"
          style={{ borderColor: PAPER_BORDER }}
          role="listbox"
          aria-label="接続先の候補"
        >
          {searchResults.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                role="option"
                aria-selected={targetId === n.id}
                onClick={() => setTargetId(n.id)}
                className="flex min-h-11 w-full flex-col justify-center gap-0.5 px-3 py-2 text-left text-xs"
                style={{
                  backgroundColor: targetId === n.id ? "rgba(41, 82, 163, 0.1)" : "transparent",
                  color: GRAPHITE,
                }}
              >
                <span className="font-semibold">{n.title}</span>
                <span style={{ color: GRAPHITE_MUTED }}>
                  {KIND_LABEL[n.kind]} ・ {LAYER_LABEL[n.layer]}
                </span>
              </button>
            </li>
          ))}
          {searchResults.length === 0 && (
            <li className="px-3 py-2 text-xs" style={{ color: GRAPHITE_MUTED }}>
              一致するノードがない。
            </li>
          )}
        </ul>
      </div>

      <LabeledSelect
        label="関係の種類"
        value={relationType}
        onChange={(v) => setRelationType(v as TheoryRelationType)}
        options={THEORY_RELATION_TYPES.map((t) => ({ value: t, label: RELATION_LABEL[t] }))}
      />

      <div>
        <span className="mb-1.5 block text-xs font-semibold" style={{ color: GRAPHITE_MUTED }}>
          向き
        </span>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="関係の向き">
          <button
            type="button"
            role="radio"
            aria-checked={direction === "outgoing"}
            onClick={() => setDirection("outgoing")}
            className="flex min-h-11 items-center justify-center rounded-md border px-2 text-xs font-medium"
            style={{
              borderColor: direction === "outgoing" ? BLUEPRINT : PAPER_BORDER,
              backgroundColor: direction === "outgoing" ? "rgba(41, 82, 163, 0.1)" : PAPER_BG,
              color: direction === "outgoing" ? BLUEPRINT : GRAPHITE,
            }}
          >
            選択中 → 接続先
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={direction === "incoming"}
            onClick={() => setDirection("incoming")}
            className="flex min-h-11 items-center justify-center rounded-md border px-2 text-xs font-medium"
            style={{
              borderColor: direction === "incoming" ? BLUEPRINT : PAPER_BORDER,
              backgroundColor: direction === "incoming" ? "rgba(41, 82, 163, 0.1)" : PAPER_BG,
              color: direction === "incoming" ? BLUEPRINT : GRAPHITE,
            }}
          >
            接続先 → 選択中
          </button>
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold" style={{ color: GRAPHITE_MUTED }}>
          ノート (任意)
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={2000}
          rows={2}
          className="w-full rounded-md border px-3 py-2 text-sm outline-none"
          style={inputStyle}
        />
      </div>
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
      <label htmlFor={fieldId} className="mb-1.5 block text-xs font-semibold" style={{ color: GRAPHITE_MUTED }}>
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
