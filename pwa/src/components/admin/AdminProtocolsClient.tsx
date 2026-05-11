"use client";

import { useState, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Protocol {
  id: string;
  protocol_id: string;
  title: string;
  project_id?: string;
  project_name?: string;
  /** Phase 4 (gas/155 nav_protocol_extractOneForYm_) で抽出された 4 要素 markdown 本文 */
  content?: string;
  /** Phase 3 以前の手動入力用 column (現役は content だが互換) */
  branch_point?: string;
  criteria?: string;
  action_taken?: string;
  tags?: string;
  importance?: string;
  source_type?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface Props {
  protocols: Protocol[];
  projects: { id: string; name: string }[];
}

const STATUS_ORDER = ["candidate", "confirmed", "archived"];

const STATUS_BADGE: Record<string, string> = {
  candidate: "bg-blue-50 text-blue-700 border-blue-200",
  confirmed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  archived: "bg-zinc-50 text-zinc-500 border-zinc-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
};

const IMPORTANCE_LABEL: Record<string, string> = {
  "1": "★",
  "2": "★★",
  "3": "★★★",
};

const BLANK: Omit<Protocol, "id" | "created_at" | "updated_at"> = {
  protocol_id: "",
  title: "",
  project_id: "",
  project_name: "",
  branch_point: "",
  criteria: "",
  action_taken: "",
  tags: "",
  importance: "1",
  source_type: "manual",
  status: "candidate",
};

export function AdminProtocolsClient({ protocols: initial, projects }: Props) {
  const [rows, setRows] = useState<Protocol[]>(initial);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterProject, setFilterProject] = useState("");
  const [filterQ, setFilterQ] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newVals, setNewVals] = useState({ ...BLANK });
  const [saving, setSaving] = useState(false);
  const [hint, setHint] = useState("");

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filterStatus && r.status !== filterStatus) return false;
      if (filterProject && r.project_id !== filterProject) return false;
      if (filterQ) {
        const q = filterQ.toLowerCase();
        if (
          !r.title.toLowerCase().includes(q) &&
          !(r.tags || "").toLowerCase().includes(q) &&
          !(r.criteria || "").toLowerCase().includes(q) &&
          !(r.branch_point || "").toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [rows, filterStatus, filterProject, filterQ]);

  const updateStatus = async (r: Protocol, newStatus: string) => {
    const { error } = await supabase
      .from("protocols")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", r.id);
    if (!error) {
      setRows((prev) => prev.map((x) => x.id === r.id ? { ...x, status: newStatus } : x));
      setHint(`${r.title} → ${newStatus}`);
    } else {
      setHint(`更新エラー: ${error.message}`);
    }
  };

  // つくよみに「このプロトコルを直して」を依頼する。chat drawer を開いて
  // 該当 protocol の context を pending-prefill としてセット。
  const requestRevision = (r: Protocol) => {
    const msg = `次のプロトコル候補を修正して。

タイトル: ${r.title}
PJ: ${r.project_name ?? r.project_id ?? "—"}
本文:
${r.content || r.criteria || "(本文なし)"}

修正点 (まさの意図を入れて再生成して):
- ここに修正したい部分を書いて`;
    try {
      window.localStorage.setItem("tsukuyomi:pending-prefill", msg);
      window.dispatchEvent(new CustomEvent("tsukuyomi:open"));
      setHint(`${r.title} の修正依頼をつくよみに送りました`);
    } catch (e) {
      setHint(`修正依頼エラー: ${String(e)}`);
    }
  };

  const createProtocol = async () => {
    if (!newVals.title.trim()) { setHint("title は必須です"); return; }
    setSaving(true);
    const now = new Date().toISOString();
    const pid = `PROT-${Date.now()}`;
    const row = { ...newVals, protocol_id: pid, created_at: now, updated_at: now };
    const { data, error } = await supabase.from("protocols").insert(row).select().single();
    if (error) {
      setHint(`作成エラー: ${error.message}`);
    } else {
      setRows((prev) => [data as Protocol, ...prev]);
      setHint(`"${newVals.title}" を作成しました`);
      setShowNew(false);
      setNewVals({ ...BLANK });
    }
    setSaving(false);
  };

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-3 items-end">
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] text-muted-foreground">status</span>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
            className="border border-border rounded px-2 py-1 text-[12px] bg-background">
            <option value="">（全て）</option>
            {STATUS_ORDER.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] text-muted-foreground">PJ</span>
          <select value={filterProject} onChange={(e) => setFilterProject(e.target.value)}
            className="border border-border rounded px-2 py-1 text-[12px] bg-background w-36">
            <option value="">（全て）</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] text-muted-foreground">検索</span>
          <input type="text" value={filterQ} onChange={(e) => setFilterQ(e.target.value)}
            placeholder="タイトル / tags / 基準"
            className="border border-border rounded px-2 py-1 text-[12px] bg-background w-52" />
        </div>
        <button onClick={() => { setFilterStatus(""); setFilterProject(""); setFilterQ(""); }}
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
          <h3 className="text-[13px] font-medium mb-3">Protocol 追加</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="flex flex-col gap-1 col-span-2">
              <span className="text-[11px] text-muted-foreground">タイトル *</span>
              <input type="text" value={newVals.title}
                onChange={(e) => setNewVals((v) => ({ ...v, title: e.target.value }))}
                className="border border-border rounded px-2 py-1 text-[12px] bg-background" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] text-muted-foreground">PJ</span>
              <select value={newVals.project_id}
                onChange={(e) => setNewVals((v) => ({ ...v, project_id: e.target.value }))}
                className="border border-border rounded px-2 py-1 text-[12px] bg-background">
                <option value="">（なし）</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] text-muted-foreground">tags（カンマ区切り）</span>
              <input type="text" value={newVals.tags}
                onChange={(e) => setNewVals((v) => ({ ...v, tags: e.target.value }))}
                className="border border-border rounded px-2 py-1 text-[12px] bg-background"
                placeholder="採用,組織" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] text-muted-foreground">importance</span>
              <select value={newVals.importance}
                onChange={(e) => setNewVals((v) => ({ ...v, importance: e.target.value }))}
                className="border border-border rounded px-2 py-1 text-[12px] bg-background">
                <option value="1">★</option>
                <option value="2">★★</option>
                <option value="3">★★★</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] text-muted-foreground">status</span>
              <select value={newVals.status}
                onChange={(e) => setNewVals((v) => ({ ...v, status: e.target.value }))}
                className="border border-border rounded px-2 py-1 text-[12px] bg-background">
                {STATUS_ORDER.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-1 mb-3">
            <span className="text-[11px] text-muted-foreground">判断の分岐点</span>
            <textarea value={newVals.branch_point}
              onChange={(e) => setNewVals((v) => ({ ...v, branch_point: e.target.value }))}
              className="border border-border rounded px-2 py-1.5 text-[12px] bg-background resize-y" rows={2} />
          </div>
          <div className="flex flex-col gap-1 mb-3">
            <span className="text-[11px] text-muted-foreground">判断基準</span>
            <textarea value={newVals.criteria}
              onChange={(e) => setNewVals((v) => ({ ...v, criteria: e.target.value }))}
              className="border border-border rounded px-2 py-1.5 text-[12px] bg-background resize-y" rows={3} />
          </div>
          <div className="flex gap-2">
            <button onClick={createProtocol} disabled={saving}
              className="text-[12px] bg-foreground text-background px-3 py-1.5 rounded disabled:opacity-50">
              {saving ? "作成中…" : "作成"}
            </button>
            <button onClick={() => { setShowNew(false); setNewVals({ ...BLANK }); }}
              className="text-[12px] text-muted-foreground border border-border px-3 py-1.5 rounded">
              キャンセル
            </button>
          </div>
        </div>
      )}

      <div className="text-[12px] text-muted-foreground mb-1">{filtered.length} 件</div>

      {filtered.length === 0 ? (
        <div className="border border-border rounded-lg px-4 py-6 text-center text-muted-foreground text-[13px]">
          {rows.length === 0 ? "まだProtocolがありません。「＋ 追加」から登録してください。" : "該当なし"}
        </div>
      ) : (
        <div className="border border-border rounded-lg divide-y divide-border">
          {filtered.map((r) => {
            const isExpanded = expandedId === r.id;
            const tags = (r.tags || "").split(",").map((t) => t.trim()).filter(Boolean);
            return (
              <div key={r.id}>
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
                      <span className="font-medium text-[13px]">{r.title}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${STATUS_BADGE[r.status] ?? ""}`}>
                        {r.status}
                      </span>
                      {r.importance && (
                        <span className="text-[11px] text-amber-500">{IMPORTANCE_LABEL[r.importance] ?? r.importance}</span>
                      )}
                      {r.project_name && (
                        <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{r.project_name}</span>
                      )}
                      {tags.map((t) => (
                        <span key={t} className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{t}</span>
                      ))}
                    </div>
                    {/* 折りたたみ時の preview: Phase 4 は content (4 要素 markdown)、旧手動は criteria */}
                    {!isExpanded && (r.content || r.criteria) && (
                      <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 whitespace-pre-wrap">
                        {(r.content || r.criteria || "").replace(/\*\*/g, "").slice(0, 200)}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0 flex-wrap">
                    {r.status !== "confirmed" && (
                      <button onClick={() => updateStatus(r, "confirmed")}
                        className="text-[11px] bg-emerald-600 text-white px-2 py-0.5 rounded"
                        title="まさが確認 → 正式プロトコルとして昇格">
                        ✅ 確定
                      </button>
                    )}
                    {r.status === "candidate" && (
                      <button onClick={() => requestRevision(r)}
                        className="text-[11px] bg-amber-500 text-white px-2 py-0.5 rounded"
                        title="つくよみに修正を依頼する (= chat 起動)">
                        🔄 修正依頼
                      </button>
                    )}
                    {r.status === "candidate" && (
                      <button onClick={() => updateStatus(r, "rejected")}
                        className="text-[11px] bg-red-600 text-white px-2 py-0.5 rounded"
                        title="プロトコルとして不適格 → 却下 (再抽出はしない)">
                        ❌ 却下
                      </button>
                    )}
                    {r.status !== "archived" && (
                      <button onClick={() => updateStatus(r, "archived")}
                        className="text-[11px] text-muted-foreground border border-border px-2 py-0.5 rounded"
                        title="古くなった / 重要度低 → アーカイブ">
                        📥 archive
                      </button>
                    )}
                  </div>
                </div>
                {isExpanded && (
                  <div className="px-10 pb-4 pt-1 border-t border-border/50 space-y-2">
                    {/* Phase 4 (現役): content に 4 要素 markdown */}
                    {r.content && (
                      <div className="rounded-md bg-muted/30 p-3">
                        <span className="text-[11px] font-medium text-muted-foreground">プロトコル本文 (4 要素)</span>
                        <p className="text-[12px] mt-1 whitespace-pre-wrap leading-relaxed">{r.content}</p>
                      </div>
                    )}
                    {/* 旧手動 (互換) */}
                    {!r.content && r.branch_point && (
                      <div>
                        <span className="text-[11px] font-medium text-muted-foreground">分岐点</span>
                        <p className="text-[12px] mt-0.5 whitespace-pre-wrap">{r.branch_point}</p>
                      </div>
                    )}
                    {!r.content && r.criteria && (
                      <div>
                        <span className="text-[11px] font-medium text-muted-foreground">判断基準</span>
                        <p className="text-[12px] mt-0.5 whitespace-pre-wrap">{r.criteria}</p>
                      </div>
                    )}
                    {!r.content && r.action_taken && (
                      <div>
                        <span className="text-[11px] font-medium text-muted-foreground">対応内容</span>
                        <p className="text-[12px] mt-0.5 whitespace-pre-wrap">{r.action_taken}</p>
                      </div>
                    )}
                    <div className="text-[10px] text-muted-foreground">
                      ID: {r.protocol_id} / source: {r.source_type || "—"} / updated: {r.updated_at?.slice(0, 10)}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
