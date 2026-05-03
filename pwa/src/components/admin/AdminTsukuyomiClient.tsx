"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

interface Project {
  id: string;
  name: string;
  slackChannelId: string | null;
}

interface Context {
  contextId: string;
  tags: string;
}

interface TsukuyomiLearning {
  id: string;
  scope: string;
  scopeKey: string | null;
  content: string;
  source: string | null;
  sourceRef: string | null;
  status: string;
  createdAt: string | null;
  createdBy: string | null;
  removedAt: string | null;
  removedBy: string | null;
  removedReason: string | null;
}

interface Props {
  projects: Project[];
  contexts: Context[];
  learnings: TsukuyomiLearning[];
}

const LAYER_ORDER = ["judge", "role", "memory", "tone", "safety"] as const;
const LAYER_LABEL: Record<string, string> = {
  judge: "🧠 判断",
  role: "🎭 役割",
  memory: "🧷 記憶",
  tone: "🌙 口調",
  safety: "🧯 安全",
};

function formatDateTime(iso: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("ja-JP", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function AdminTsukuyomiClient({ projects, contexts, learnings }: Props) {
  const [selectedProjectId, setSelectedProjectId] = useState(projects[0]?.id ?? "");
  const [mode, setMode] = useState<"ai" | "manual">("ai");
  const [hint, setHint] = useState("");
  const [manualText, setManualText] = useState("");
  const [status, setStatus] = useState("");
  const [learningStatusFilter, setLearningStatusFilter] = useState("active");
  const [learningScopeFilter, setLearningScopeFilter] = useState("");

  // Context editor state
  const [ctxRows, setCtxRows] = useState<any[]>([]);
  const [ctxLoading, setCtxLoading] = useState(false);
  const [ctxStatusFilter, setCtxStatusFilter] = useState("active");
  const [ctxTagFilter, setCtxTagFilter] = useState("");
  const [ctxHint, setCtxHint] = useState("");
  const [editingCtx, setEditingCtx] = useState<any | null>(null);
  const [showAddCtx, setShowAddCtx] = useState(false);
  const [newCtx, setNewCtx] = useState({
    system_prompt: "",
    context_type: "tone",
    priority: 10,
    tags: "tsukuyomi",
    status: "active",
  });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const loadContexts = async () => {
    setCtxLoading(true);
    let query = supabase.from("tsukuyomi_context").select("*").order("priority", { ascending: false });
    if (ctxStatusFilter) query = query.eq("status", ctxStatusFilter);
    if (ctxTagFilter.trim()) query = query.ilike("tags", `%${ctxTagFilter.trim()}%`);
    const { data, error } = await query;
    if (error) {
      setCtxHint(`ロード失敗: ${error.message}`);
    } else {
      setCtxRows(data ?? []);
      setCtxHint(`${(data ?? []).length} 件`);
    }
    setCtxLoading(false);
  };

  const sendAI = async () => {
    if (!selectedProjectId) { setStatus("PJを選んで〜"); return; }
    setStatus("生成して送信中…");
    try {
      const res = await fetch("/api/tsukuyomi/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: selectedProjectId, hint, mode: "ai" }),
      });
      const json = await res.json();
      setStatus(json.ok ? `送った ts=${json.ts ?? ""}` : `失敗: ${json.message ?? "error"}`);
    } catch (e: any) {
      setStatus(`失敗: ${e.message}`);
    }
  };

  const sendManual = async () => {
    if (!selectedProjectId) { setStatus("PJを選んで〜"); return; }
    if (!manualText.trim()) { setStatus("本文が空っぽ"); return; }
    setStatus("送信中…");
    try {
      const res = await fetch("/api/tsukuyomi/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: selectedProjectId, text: manualText, mode: "manual" }),
      });
      const json = await res.json();
      setStatus(json.ok ? `送った ts=${json.ts ?? ""}` : `失敗: ${json.message ?? "error"}`);
    } catch (e: any) {
      setStatus(`失敗: ${e.message}`);
    }
  };

  const saveCtxRow = async (row: any) => {
    const now = new Date().toISOString();
    const { context_id, ...rest } = row;
    if (!context_id) {
      // new
      const { data, error } = await supabase
        .from("tsukuyomi_context")
        .insert({ ...rest, created_at: now, updated_at: now })
        .select()
        .single();
      if (error) { setCtxHint(`保存失敗: ${error.message}`); }
      else { setCtxHint("保存できた"); setShowAddCtx(false); setCtxRows((prev) => [data, ...prev]); }
    } else {
      const { error } = await supabase
        .from("tsukuyomi_context")
        .update({ ...rest, updated_at: now })
        .eq("context_id", context_id);
      if (error) { setCtxHint(`保存失敗: ${error.message}`); }
      else {
        setCtxHint("保存できた");
        setCtxRows((prev) => prev.map((x) => x.context_id === context_id ? { ...x, ...rest } : x));
        setEditingCtx(null);
      }
    }
  };

  const toggleCtxStatus = async (row: any, newStatus: string) => {
    const { error } = await supabase
      .from("tsukuyomi_context")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("context_id", row.context_id);
    if (!error) {
      setCtxRows((prev) => prev.map((x) => x.context_id === row.context_id ? { ...x, status: newStatus } : x));
    }
  };

  // Group contexts by layer
  const layerGroups: Record<string, any[]> = { judge: [], role: [], memory: [], tone: [], safety: [] };
  ctxRows.forEach((r) => {
    const ct = String(r.context_type || "tone").toLowerCase();
    const key = LAYER_ORDER.includes(ct as any) ? ct : "tone";
    layerGroups[key].push(r);
  });
  const filteredLearnings = learnings.filter((learning) => {
    if (learningStatusFilter && learning.status !== learningStatusFilter) return false;
    if (learningScopeFilter.trim()) {
      const haystack = `${learning.scope} ${learning.scopeKey ?? ""} ${learning.source ?? ""} ${learning.content}`.toLowerCase();
      if (!haystack.includes(learningScopeFilter.trim().toLowerCase())) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* ===== Force Post Zone ===== */}
      <div className="border border-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-[13px] font-semibold">PJチャンネルへ強制発言</div>
            <div className="text-[11px] text-muted-foreground">AIで生成するか、手書きで投げるか選べる</div>
          </div>
          <span className="text-[12px] text-muted-foreground">{status}</span>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-[11px] text-muted-foreground block mb-0.5">PJ</label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full border border-border rounded px-2 py-1.5 text-[12px] bg-background"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id}｜{p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground block mb-0.5">モード</label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as "ai" | "manual")}
              className="w-full border border-border rounded px-2 py-1.5 text-[12px] bg-background"
            >
              <option value="ai">AI生成</option>
              <option value="manual">手書き</option>
            </select>
          </div>
        </div>

        {mode === "ai" && (
          <div>
            <label className="text-[11px] text-muted-foreground block mb-0.5">ヒント（任意）</label>
            <textarea
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              rows={3}
              placeholder="例）月次報告会の日程が未確定っぽい / 請求書の確認止まってそう など"
              className="w-full border border-border rounded px-2 py-1.5 text-[12px] bg-background resize-y"
            />
            <button
              onClick={sendAI}
              className="mt-2 text-[12px] bg-foreground text-background px-4 py-1.5 rounded"
            >
              AIで生成して投稿
            </button>
          </div>
        )}

        {mode === "manual" && (
          <div>
            <label className="text-[11px] text-muted-foreground block mb-0.5">手書き本文</label>
            <textarea
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              rows={4}
              placeholder="ここにそのまま投稿したい文章を書いてね（@here/@channelは自動で暴発防止される）"
              className="w-full border border-border rounded px-2 py-1.5 text-[12px] bg-background resize-y"
            />
            <button
              onClick={sendManual}
              className="mt-2 text-[12px] bg-foreground text-background px-4 py-1.5 rounded"
            >
              手書きで投稿
            </button>
          </div>
        )}

        <p className="text-[11px] text-muted-foreground mt-2">
          ・投稿先は「PJのSlackチャンネル」<br />
          ・人格は下の 人格DB の tags=tsukuyomi の active 行が使われる
        </p>
      </div>

      {/* ===== Learning DB ===== */}
      <div className="border border-border rounded-lg p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <div className="text-[13px] font-semibold">つくよみ学習状況</div>
            <div className="text-[11px] text-muted-foreground">修正依頼や確定内容から蓄積された学習メモ</div>
          </div>
          <div className="text-[12px] text-muted-foreground">{filteredLearnings.length} / {learnings.length} 件</div>
        </div>

        <div className="flex gap-3 mb-3 flex-wrap">
          <div>
            <label className="text-[11px] text-muted-foreground block mb-0.5">status</label>
            <select
              value={learningStatusFilter}
              onChange={(e) => setLearningStatusFilter(e.target.value)}
              className="border border-border rounded px-2 py-1 text-[12px] bg-background"
            >
              <option value="">all</option>
              <option value="active">active</option>
              <option value="removed">removed</option>
            </select>
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground block mb-0.5">検索</label>
            <input
              type="text"
              value={learningScopeFilter}
              onChange={(e) => setLearningScopeFilter(e.target.value)}
              placeholder="scope / PJ / source / 内容"
              className="border border-border rounded px-2 py-1 text-[12px] bg-background w-56"
            />
          </div>
        </div>

        {filteredLearnings.length === 0 ? (
          <div className="text-[12px] text-muted-foreground">学習メモはまだないよ。</div>
        ) : (
          <div className="divide-y divide-border border border-border rounded-lg overflow-hidden">
            {filteredLearnings.slice(0, 30).map((learning) => (
              <div key={learning.id} className="px-3 py-2.5 bg-white">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                    learning.status === "active"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-zinc-50 text-zinc-500 border-zinc-200"
                  }`}>
                    {learning.status}
                  </span>
                  <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{learning.scope}</span>
                  {learning.scopeKey && <span className="text-[10px] text-muted-foreground">{learning.scopeKey}</span>}
                  {learning.source && <span className="text-[10px] text-indigo-700">{learning.source}</span>}
                  <span className="text-[10px] text-muted-foreground ml-auto">{formatDateTime(learning.createdAt)}</span>
                </div>
                <p className="text-[12px] text-slate-700 leading-snug whitespace-pre-wrap">{learning.content}</p>
                <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                  {learning.createdBy && <span>by {learning.createdBy}</span>}
                  {learning.sourceRef && <span>ref {learning.sourceRef.slice(0, 8)}</span>}
                  {learning.removedReason && <span>removed: {learning.removedReason}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ===== Context DB ===== */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="text-[13px] font-semibold">人格DB編集</div>
          <div className="flex gap-2">
            <button
              onClick={loadContexts}
              disabled={ctxLoading}
              className="text-[12px] border border-border px-3 py-1 rounded bg-background hover:bg-muted/40 disabled:opacity-50"
            >
              {ctxLoading ? "ロード中…" : "一覧ロード"}
            </button>
            <button
              onClick={() => setShowAddCtx(true)}
              className="text-[12px] bg-foreground text-background px-3 py-1 rounded"
            >
              ＋ 新規
            </button>
          </div>
        </div>

        <div className="flex gap-3 mb-3 flex-wrap">
          <div>
            <label className="text-[11px] text-muted-foreground block mb-0.5">status</label>
            <select
              value={ctxStatusFilter}
              onChange={(e) => setCtxStatusFilter(e.target.value)}
              className="border border-border rounded px-2 py-1 text-[12px] bg-background"
            >
              <option value="">all</option>
              <option value="active">active</option>
              <option value="archived">archived</option>
            </select>
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground block mb-0.5">tagフィルタ</label>
            <input
              type="text"
              value={ctxTagFilter}
              onChange={(e) => setCtxTagFilter(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadContexts()}
              placeholder="例）tsukuyomi"
              className="border border-border rounded px-2 py-1 text-[12px] bg-background w-40"
            />
          </div>
          {ctxHint && <div className="text-[12px] text-muted-foreground self-end">{ctxHint}</div>}
        </div>

        {/* Add new context form */}
        {showAddCtx && (
          <div className="border border-border rounded-lg p-4 mb-4 bg-muted/20">
            <h4 className="text-[12px] font-medium mb-2">新規Context</h4>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div>
                <label className="text-[11px] text-muted-foreground block mb-0.5">contextType</label>
                <select
                  value={newCtx.context_type}
                  onChange={(e) => setNewCtx((v) => ({ ...v, context_type: e.target.value }))}
                  className="w-full border border-border rounded px-2 py-1 text-[12px] bg-background"
                >
                  {LAYER_ORDER.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground block mb-0.5">priority</label>
                <input
                  type="number"
                  value={newCtx.priority}
                  onChange={(e) => setNewCtx((v) => ({ ...v, priority: Number(e.target.value) }))}
                  className="w-full border border-border rounded px-2 py-1 text-[12px] bg-background"
                />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground block mb-0.5">tags</label>
                <input
                  type="text"
                  value={newCtx.tags}
                  onChange={(e) => setNewCtx((v) => ({ ...v, tags: e.target.value }))}
                  className="w-full border border-border rounded px-2 py-1 text-[12px] bg-background"
                />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground block mb-0.5">status</label>
                <select
                  value={newCtx.status}
                  onChange={(e) => setNewCtx((v) => ({ ...v, status: e.target.value }))}
                  className="w-full border border-border rounded px-2 py-1 text-[12px] bg-background"
                >
                  <option value="active">active</option>
                  <option value="archived">archived</option>
                </select>
              </div>
            </div>
            <div className="mb-2">
              <label className="text-[11px] text-muted-foreground block mb-0.5">systemPrompt</label>
              <textarea
                value={newCtx.system_prompt}
                onChange={(e) => setNewCtx((v) => ({ ...v, system_prompt: e.target.value }))}
                rows={5}
                className="w-full border border-border rounded px-2 py-1.5 text-[12px] bg-background font-mono resize-y"
                placeholder="ここに人格や運用ルールを書いてね"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => saveCtxRow(newCtx)}
                className="text-[12px] bg-foreground text-background px-3 py-1.5 rounded"
              >
                作成
              </button>
              <button
                onClick={() => setShowAddCtx(false)}
                className="text-[12px] text-muted-foreground border border-border px-3 py-1.5 rounded"
              >
                キャンセル
              </button>
            </div>
          </div>
        )}

        {ctxRows.length === 0 && !ctxLoading && (
          <div className="text-[12px] text-muted-foreground">
            「一覧ロード」を押すとContextが表示されます。
          </div>
        )}

        {ctxRows.length > 0 && (
          <div className="space-y-3">
            {LAYER_ORDER.map((lk) => {
              const rowsL = layerGroups[lk] ?? [];
              return (
                <details key={lk} open className="border border-border rounded-lg overflow-hidden">
                  <summary className="flex items-center justify-between px-4 py-2.5 bg-muted/20 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-medium">{LAYER_LABEL[lk]} ({rowsL.length})</span>
                    </div>
                    <button
                      onClick={(e) => { e.preventDefault(); setShowAddCtx(true); setNewCtx((v) => ({ ...v, context_type: lk })); }}
                      className="text-[11px] border border-border px-2 py-0.5 rounded bg-background hover:bg-muted/40"
                    >
                      ＋追加
                    </button>
                  </summary>
                  {rowsL.length === 0 ? (
                    <div className="px-4 py-3 text-[12px] text-muted-foreground">ここは空。＋追加で1行足す</div>
                  ) : (
                    <div className="divide-y divide-border">
                      {rowsL.map((r) => {
                        const isEditing = editingCtx?.context_id === r.context_id;
                        return (
                          <div key={r.context_id} className="px-4 py-3">
                            {isEditing ? (
                              <div className="space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="text-[11px] text-muted-foreground block mb-0.5">contextType</label>
                                    <select
                                      value={editingCtx.context_type}
                                      onChange={(e) => setEditingCtx((v: any) => ({ ...v, context_type: e.target.value }))}
                                      className="w-full border border-border rounded px-2 py-1 text-[12px] bg-background"
                                    >
                                      {LAYER_ORDER.map((l) => <option key={l} value={l}>{l}</option>)}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="text-[11px] text-muted-foreground block mb-0.5">priority</label>
                                    <input
                                      type="number"
                                      value={editingCtx.priority ?? ""}
                                      onChange={(e) => setEditingCtx((v: any) => ({ ...v, priority: Number(e.target.value) }))}
                                      className="w-full border border-border rounded px-2 py-1 text-[12px] bg-background"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[11px] text-muted-foreground block mb-0.5">tags</label>
                                    <input
                                      type="text"
                                      value={editingCtx.tags ?? ""}
                                      onChange={(e) => setEditingCtx((v: any) => ({ ...v, tags: e.target.value }))}
                                      className="w-full border border-border rounded px-2 py-1 text-[12px] bg-background"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[11px] text-muted-foreground block mb-0.5">status</label>
                                    <select
                                      value={editingCtx.status}
                                      onChange={(e) => setEditingCtx((v: any) => ({ ...v, status: e.target.value }))}
                                      className="w-full border border-border rounded px-2 py-1 text-[12px] bg-background"
                                    >
                                      <option value="active">active</option>
                                      <option value="archived">archived</option>
                                    </select>
                                  </div>
                                </div>
                                <div>
                                  <label className="text-[11px] text-muted-foreground block mb-0.5">systemPrompt</label>
                                  <textarea
                                    value={editingCtx.system_prompt ?? ""}
                                    onChange={(e) => setEditingCtx((v: any) => ({ ...v, system_prompt: e.target.value }))}
                                    rows={6}
                                    className="w-full border border-border rounded px-2 py-1.5 text-[12px] bg-background font-mono resize-y"
                                  />
                                </div>
                                <div className="flex gap-2">
                                  <button onClick={() => saveCtxRow(editingCtx)} className="text-[11px] bg-foreground text-background px-3 py-1 rounded">保存</button>
                                  <button onClick={() => setEditingCtx(null)} className="text-[11px] border border-border px-3 py-1 rounded">キャンセル</button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex gap-3 items-start">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap mb-1">
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${r.status === "active" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-zinc-50 text-zinc-500 border-zinc-200"}`}>
                                      {r.status}
                                    </span>
                                    {r.priority != null && (
                                      <span className="text-[10px] text-muted-foreground">p={r.priority}</span>
                                    )}
                                    {r.tags && (
                                      <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{r.tags}</span>
                                    )}
                                    <span className="text-[10px] text-muted-foreground">{r.context_id}</span>
                                  </div>
                                  <p className="text-[11px] text-muted-foreground line-clamp-2 font-mono">{r.system_prompt}</p>
                                </div>
                                <div className="flex gap-1 shrink-0">
                                  <button onClick={() => setEditingCtx({ ...r })} className="text-[11px] border border-border px-2 py-0.5 rounded">編集</button>
                                  <button
                                    onClick={() => toggleCtxStatus(r, r.status === "active" ? "archived" : "active")}
                                    className="text-[11px] text-muted-foreground border border-border px-2 py-0.5 rounded"
                                  >
                                    {r.status === "active" ? "archive" : "active"}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </details>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
