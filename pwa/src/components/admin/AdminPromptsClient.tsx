"use client";

import { useState } from "react";

export interface PromptRow {
  id: string;
  promptKey: string;
  description: string;
  body: string;
  model: string;
  maxTokens: number | null;
  isActive: boolean;
  notes: string;
  updatedBy: string;
  updatedAt: string;
}

export interface ContextRow {
  contextId: string;
  tags: string;
  priority: number | null;
  systemPrompt: string;
  updatedAt: string;
}

export function AdminPromptsClient({
  prompts: initial,
  contexts = [],
}: {
  prompts: PromptRow[];
  contexts?: ContextRow[];
}) {
  const [rows, setRows] = useState<PromptRow[]>(initial);
  const [expandedCtx, setExpandedCtx] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<PromptRow>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; isError: boolean } | null>(null);

  function startEdit(p: PromptRow) {
    setEditing(p.id);
    setDraft({ body: p.body, description: p.description, model: p.model, maxTokens: p.maxTokens, isActive: p.isActive, notes: p.notes });
  }

  async function save(p: PromptRow) {
    setSaving(p.id);
    setToast(null);
    try {
      const res = await fetch(`/api/admin/prompts/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const j = (await res.json()) as { ok: boolean; error?: string };
      if (!j.ok) {
        setToast({ msg: `保存エラー: ${j.error}`, isError: true });
      } else {
        setRows((prev) => prev.map((r) => (r.id === p.id ? { ...r, ...draft } as PromptRow : r)));
        setEditing(null);
        setToast({ msg: `${p.promptKey} を保存しました`, isError: false });
      }
    } catch (e) {
      setToast({ msg: `保存エラー: ${String(e)}`, isError: true });
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-4">
      {toast && (
        <div className={`rounded px-3 py-2 text-sm ${toast.isError ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
          {toast.msg}
        </div>
      )}
      {rows.length === 0 && (
        <div className="text-sm text-muted-foreground">llm_prompts テーブルにレコードがありません。</div>
      )}
      {rows.map((p) => {
        const isEdit = editing === p.id;
        return (
          <div key={p.id} className="border border-border rounded-lg p-3 bg-background space-y-2">
            <div className="flex items-baseline gap-2">
              <code className="text-sm font-bold">{p.promptKey}</code>
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${p.isActive ? "bg-emerald-100 text-emerald-800" : "bg-zinc-100 text-zinc-600"}`}>
                {p.isActive ? "ACTIVE" : "INACTIVE (= コード側 fallback)"}
              </span>
              <span className="text-[10px] text-muted-foreground">{p.model || "—"} · max {p.maxTokens ?? "—"}</span>
              {p.updatedAt && (
                <span className="text-[10px] text-muted-foreground ml-auto">
                  最終編集 {p.updatedAt.slice(0, 10)} {p.updatedBy && `by ${p.updatedBy}`}
                </span>
              )}
            </div>
            {p.description && <div className="text-[11px] text-muted-foreground">{p.description}</div>}
            {!isEdit ? (
              <>
                <pre className="text-[11px] bg-muted/40 p-2 rounded whitespace-pre-wrap max-h-40 overflow-y-auto font-mono">
                  {p.body || "(空。is_active=TRUE にする前に body を入れて)"}
                </pre>
                {p.notes && <div className="text-[10px] text-amber-700 italic">📝 {p.notes}</div>}
                <button
                  onClick={() => startEdit(p)}
                  className="text-xs px-2 py-1 rounded bg-foreground text-background"
                >
                  ✏️ 編集
                </button>
              </>
            ) : (
              <div className="space-y-2">
                <textarea
                  value={(draft.body as string) ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
                  rows={16}
                  className="w-full text-[11px] font-mono border border-border rounded p-2 bg-background"
                  placeholder="プロンプト本文。${userName} ${userRole} 等の placeholder を含めて OK"
                  disabled={saving === p.id}
                />
                <div className="flex gap-2 items-center text-xs">
                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={!!draft.isActive}
                      onChange={(e) => setDraft((d) => ({ ...d, isActive: e.target.checked }))}
                    />
                    <span>is_active</span>
                  </label>
                  <input
                    type="text"
                    value={(draft.model as string) ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, model: e.target.value }))}
                    placeholder="model"
                    className="border border-border rounded px-1.5 py-0.5 text-[11px] w-44 bg-background"
                  />
                  <input
                    type="number"
                    value={(draft.maxTokens as number | null) ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, maxTokens: e.target.value ? Number(e.target.value) : null }))}
                    placeholder="max_tokens"
                    className="border border-border rounded px-1.5 py-0.5 text-[11px] w-28 bg-background"
                  />
                </div>
                <textarea
                  value={(draft.notes as string) ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                  rows={2}
                  className="w-full text-[11px] border border-border rounded p-2 bg-background"
                  placeholder="運用上のメモ"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => save(p)}
                    disabled={saving === p.id}
                    className="text-xs px-3 py-1 rounded bg-foreground text-background disabled:opacity-50"
                  >
                    {saving === p.id ? "保存中…" : "💾 保存"}
                  </button>
                  <button
                    onClick={() => setEditing(null)}
                    className="text-xs px-3 py-1 rounded border border-border"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* スプシ由来 (R172_TsukuyomiContextRepo が DB_TsukuyomiContext から同期) の旧プロンプト群 */}
      {contexts.length > 0 && (
        <div className="mt-8 pt-6 border-t border-border">
          <h2 className="text-base font-semibold mb-1">
            🗂️ スプシ由来つくよみ Context <span className="text-xs text-muted-foreground">({contexts.length} 件)</span>
          </h2>
          <p className="text-xs text-muted-foreground mb-3">
            本体スプシ <code>DB_TsukuyomiContext</code> を R172_TsukuyomiContextRepo が読み込んで同期したプロンプト群。
            tags 別にグローバル / PJ 固有 system prompt を保持。<strong>正本はスプシ側</strong>のため、編集はスプシで行う。
          </p>
          <div className="space-y-2">
            {contexts.map((c) => {
              const isOpen = expandedCtx === c.contextId;
              const preview = (c.systemPrompt || "").slice(0, 140);
              return (
                <div key={c.contextId} className="border border-border rounded-lg p-3 bg-background">
                  <button
                    onClick={() => setExpandedCtx(isOpen ? null : c.contextId)}
                    className="w-full text-left"
                  >
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-[10px] font-mono text-muted-foreground">{isOpen ? "▼" : "▶"}</span>
                      <code className="text-[11px] font-bold">{c.tags || "(no tag)"}</code>
                      {c.priority !== null && (
                        <span className="text-[10px] text-muted-foreground">priority={c.priority}</span>
                      )}
                      <span className="text-[10px] text-muted-foreground ml-auto">
                        {c.updatedAt?.slice(0, 10)}
                      </span>
                    </div>
                    {!isOpen && (
                      <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 whitespace-pre-wrap">
                        {preview}
                      </p>
                    )}
                  </button>
                  {isOpen && (
                    <pre className="text-[11px] bg-muted/30 p-2 rounded mt-2 whitespace-pre-wrap max-h-80 overflow-y-auto font-mono">
                      {c.systemPrompt}
                    </pre>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
