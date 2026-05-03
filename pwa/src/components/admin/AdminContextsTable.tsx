"use client";

import { useState, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface ContextRow {
  id: string;
  context_id: string;
  tags: string;
  priority: number;
  system_prompt: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface Props {
  contexts: ContextRow[];
}

const BLANK_CTX: Omit<ContextRow, "id" | "created_at" | "updated_at"> = {
  context_id: "",
  tags: "",
  priority: 0,
  system_prompt: "",
  status: "active",
};

export function AdminContextsTable({ contexts: initial }: Props) {
  const [rows, setRows] = useState<ContextRow[]>(initial);
  const [filterQ, setFilterQ] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterTag, setFilterTag] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editVals, setEditVals] = useState<Partial<ContextRow>>({});
  const [saving, setSaving] = useState(false);
  const [hint, setHint] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [newVals, setNewVals] = useState({ ...BLANK_CTX });
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // 既存タグ一覧
  const allTags = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => {
      (r.tags || "").split(",").map((t) => t.trim()).filter(Boolean).forEach((t) => s.add(t));
    });
    return Array.from(s).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filterStatus && r.status !== filterStatus) return false;
      if (filterTag) {
        const tags = (r.tags || "").split(",").map((t) => t.trim());
        if (!tags.includes(filterTag)) return false;
      }
      if (filterQ) {
        const q = filterQ.toLowerCase();
        if (
          !r.context_id.toLowerCase().includes(q) &&
          !r.tags.toLowerCase().includes(q) &&
          !r.system_prompt.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [rows, filterQ, filterStatus, filterTag]);

  const startEdit = (r: ContextRow) => {
    setEditingId(r.id);
    setEditVals({
      tags: r.tags,
      priority: r.priority,
      system_prompt: r.system_prompt,
      status: r.status,
    });
  };

  const cancelEdit = () => { setEditingId(null); setEditVals({}); };

  const saveEdit = async (r: ContextRow) => {
    setSaving(true);
    const patch = {
      tags: editVals.tags as string,
      priority: Number(editVals.priority),
      system_prompt: editVals.system_prompt as string,
      status: editVals.status as string,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from("tsukuyomi_context")
      .update(patch)
      .eq("id", r.id);
    if (error) {
      setHint(`保存エラー: ${error.message}`);
    } else {
      setRows((prev) => prev.map((x) => x.id === r.id ? { ...x, ...patch } : x));
      setHint(`${r.context_id} を更新しました`);
      setEditingId(null);
    }
    setSaving(false);
  };

  const createContext = async () => {
    if (!newVals.context_id.trim() || !newVals.system_prompt.trim()) {
      setHint("context_id と system_prompt は必須です");
      return;
    }
    setSaving(true);
    const now = new Date().toISOString();
    const row = { ...newVals, priority: Number(newVals.priority), created_at: now, updated_at: now };
    const { data, error } = await supabase
      .from("tsukuyomi_context")
      .insert(row)
      .select()
      .single();
    if (error) {
      setHint(`作成エラー: ${error.message}`);
    } else {
      setRows((prev) => [data as ContextRow, ...prev]);
      setHint(`${newVals.context_id} を作成しました`);
      setShowNew(false);
      setNewVals({ ...BLANK_CTX });
    }
    setSaving(false);
  };

  const archiveContext = async (r: ContextRow) => {
    if (!confirm(`"${r.context_id}" をarchiveにしますか？`)) return;
    const { error } = await supabase
      .from("tsukuyomi_context")
      .update({ status: "archived", updated_at: new Date().toISOString() })
      .eq("id", r.id);
    if (!error) {
      setRows((prev) => prev.map((x) => x.id === r.id ? { ...x, status: "archived" } : x));
      setHint(`${r.context_id} をアーカイブしました`);
    }
  };

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-3 items-end">
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] text-muted-foreground">検索</span>
          <input type="text" value={filterQ} onChange={(e) => setFilterQ(e.target.value)}
            placeholder="ID / tags / prompt"
            className="border border-border rounded px-2 py-1 text-[12px] bg-background w-52" />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] text-muted-foreground">status</span>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
            className="border border-border rounded px-2 py-1 text-[12px] bg-background">
            <option value="">（全て）</option>
            <option value="active">active</option>
            <option value="archived">archived</option>
          </select>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] text-muted-foreground">tag</span>
          <select value={filterTag} onChange={(e) => setFilterTag(e.target.value)}
            className="border border-border rounded px-2 py-1 text-[12px] bg-background w-40">
            <option value="">（全て）</option>
            {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <button onClick={() => { setFilterQ(""); setFilterStatus(""); setFilterTag(""); }}
          className="text-[12px] text-muted-foreground hover:text-foreground border border-border rounded px-2 py-1 bg-background">
          リセット
        </button>
        <button onClick={() => setShowNew(!showNew)}
          className="text-[12px] bg-foreground text-background px-3 py-1 rounded ml-auto">
          ＋ 追加
        </button>
      </div>

      {hint && <div className="text-[12px] text-muted-foreground mb-2">{hint}</div>}

      {/* New form */}
      {showNew && (
        <div className="border border-border rounded-lg p-4 mb-4 bg-muted/20">
          <h3 className="text-[13px] font-medium mb-3">LLM Context 追加</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="flex flex-col gap-1">
              <span className="text-[11px] text-muted-foreground">context_id *</span>
              <input type="text" value={newVals.context_id}
                onChange={(e) => setNewVals((v) => ({ ...v, context_id: e.target.value }))}
                className="border border-border rounded px-2 py-1 text-[12px] bg-background"
                placeholder="mr_judge_001" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] text-muted-foreground">tags（カンマ区切り）</span>
              <input type="text" value={newVals.tags}
                onChange={(e) => setNewVals((v) => ({ ...v, tags: e.target.value }))}
                className="border border-border rounded px-2 py-1 text-[12px] bg-background"
                placeholder="monthlyreport,rewardscoring" list="ctxTagsDl" />
              <datalist id="ctxTagsDl">
                {allTags.map((t) => <option key={t} value={t} />)}
              </datalist>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] text-muted-foreground">priority</span>
              <input type="number" value={newVals.priority}
                onChange={(e) => setNewVals((v) => ({ ...v, priority: Number(e.target.value) }))}
                className="border border-border rounded px-2 py-1 text-[12px] bg-background w-24" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] text-muted-foreground">status</span>
              <select value={newVals.status}
                onChange={(e) => setNewVals((v) => ({ ...v, status: e.target.value }))}
                className="border border-border rounded px-2 py-1 text-[12px] bg-background">
                <option value="active">active</option>
                <option value="archived">archived</option>
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-1 mb-3">
            <span className="text-[11px] text-muted-foreground">system_prompt *</span>
            <textarea value={newVals.system_prompt}
              onChange={(e) => setNewVals((v) => ({ ...v, system_prompt: e.target.value }))}
              className="border border-border rounded px-2 py-1.5 text-[12px] bg-background resize-y"
              rows={6} placeholder="あなたはXXXを担当するエージェント…" />
          </div>
          <div className="flex gap-2">
            <button onClick={createContext} disabled={saving}
              className="text-[12px] bg-foreground text-background px-3 py-1.5 rounded disabled:opacity-50">
              {saving ? "作成中…" : "作成"}
            </button>
            <button onClick={() => { setShowNew(false); setNewVals({ ...BLANK_CTX }); }}
              className="text-[12px] text-muted-foreground border border-border px-3 py-1.5 rounded">
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="text-[12px] text-muted-foreground mb-1">{filtered.length} 件</div>
      <div className="border border-border rounded-lg divide-y divide-border">
        {filtered.map((r) => {
          const isEditing = editingId === r.id;
          const isExpanded = expandedId === r.id;
          const tags = (r.tags || "").split(",").map((t) => t.trim()).filter(Boolean);
          return (
            <div key={r.id} className={`${isEditing ? "bg-blue-50/30" : ""}`}>
              {/* Row header */}
              <div className="flex items-start gap-3 px-4 py-3">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : r.id)}
                  className="text-[10px] text-muted-foreground shrink-0 mt-0.5 transition-transform"
                  style={{ transform: isExpanded ? "rotate(90deg)" : "none" }}
                >
                  ▶
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-medium text-[13px]">{r.context_id}</span>
                    {tags.map((t) => (
                      <span key={t} className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{t}</span>
                    ))}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${r.status === "active" ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-zinc-500 bg-zinc-50 border-zinc-200"}`}>
                      {r.status}
                    </span>
                    <span className="text-[10px] text-muted-foreground">p={r.priority}</span>
                  </div>
                  {!isEditing && !isExpanded && (
                    <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 whitespace-pre-wrap">
                      {r.system_prompt}
                    </p>
                  )}
                </div>

                <div className="flex gap-1 shrink-0">
                  {isEditing ? (
                    <>
                      <button onClick={() => saveEdit(r)} disabled={saving}
                        className="text-[11px] bg-foreground text-background px-2 py-0.5 rounded disabled:opacity-50">
                        {saving ? "…" : "保存"}
                      </button>
                      <button onClick={cancelEdit}
                        className="text-[11px] text-muted-foreground border border-border px-2 py-0.5 rounded">
                        取消
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => startEdit(r)}
                        className="text-[11px] text-muted-foreground hover:text-foreground border border-border px-2 py-0.5 rounded">
                        編集
                      </button>
                      {r.status === "active" && (
                        <button onClick={() => archiveContext(r)}
                          className="text-[11px] text-muted-foreground hover:text-foreground border border-border px-2 py-0.5 rounded">
                          archive
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Expanded / Edit area */}
              {(isExpanded || isEditing) && (
                <div className="px-4 pb-4 pt-1 border-t border-border/50">
                  {isEditing ? (
                    <div className="flex flex-col gap-3">
                      <div className="grid grid-cols-3 gap-3">
                        <div className="flex flex-col gap-1">
                          <span className="text-[11px] text-muted-foreground">tags</span>
                          <input type="text" value={editVals.tags as string}
                            onChange={(e) => setEditVals((v) => ({ ...v, tags: e.target.value }))}
                            className="border border-border rounded px-2 py-1 text-[12px] bg-background" list="ctxTagsDlEdit" />
                          <datalist id="ctxTagsDlEdit">
                            {allTags.map((t) => <option key={t} value={t} />)}
                          </datalist>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-[11px] text-muted-foreground">priority</span>
                          <input type="number" value={editVals.priority as number}
                            onChange={(e) => setEditVals((v) => ({ ...v, priority: Number(e.target.value) }))}
                            className="border border-border rounded px-2 py-1 text-[12px] bg-background w-24" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-[11px] text-muted-foreground">status</span>
                          <select value={editVals.status as string}
                            onChange={(e) => setEditVals((v) => ({ ...v, status: e.target.value }))}
                            className="border border-border rounded px-2 py-1 text-[12px] bg-background">
                            <option value="active">active</option>
                            <option value="archived">archived</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[11px] text-muted-foreground">system_prompt</span>
                        <textarea value={editVals.system_prompt as string}
                          onChange={(e) => setEditVals((v) => ({ ...v, system_prompt: e.target.value }))}
                          className="border border-border rounded px-2 py-1.5 text-[12px] bg-background resize-y"
                          rows={8} />
                      </div>
                    </div>
                  ) : (
                    <pre className="text-[12px] text-foreground whitespace-pre-wrap font-sans leading-relaxed">
                      {r.system_prompt}
                    </pre>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="px-4 py-6 text-center text-muted-foreground text-[13px]">
            該当なし
          </div>
        )}
      </div>
    </div>
  );
}
