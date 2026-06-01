"use client";

import { useState, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface ProtocolExample {
  protocol_id: string;
  project_id: string;
  occurred_on: string | null;
  summary: string;
  branch_point: string | null;
  criteria: string | null;
  action_taken: string | null;
  result: string | null;
  source_meeting_id: string | null;
}

interface ProtocolResultObservation {
  id: string;
  protocol_id: string;
  protocol_example_id: string | null;
  project_id: string | null;
  observed_on: string;
  horizon: string;
  valence: string;
  confidence: string;
  summary: string;
  evidence_source_type: string | null;
  evidence_source_id: string | null;
  created_at: string;
}

interface Protocol {
  id: string;
  protocol_id: string;
  title: string;
  project_id?: string;
  project_name?: string;
  /** Phase 4 (gas/155 nav_protocol_extractOneForYm_) で抽出された protocol markdown 本文 */
  content?: string;
  /** Phase 3 以前の手動入力用 column (現役は content だが互換) */
  branch_point?: string;
  criteria?: string;
  action_taken?: string;
  tags?: string;
  importance?: string;
  source?: string;
  source_type?: string;
  status: string;
  kind?: string;
  is_universal?: boolean;
  examples?: ProtocolExample[];
  observations?: ProtocolResultObservation[];
  created_at: string;
  updated_at: string;
}

/** markdown content から ① 分岐点 / ② 判断材料 / ③ アクション / ④ 結果 を分解 */
function parseFourElements(content: string): { branch: string; criteria: string; action: string; result: string } {
  if (!content) return { branch: "", criteria: "", action: "", result: "" };
  const blocks: { branch: string; criteria: string; action: string; result: string } = { branch: "", criteria: "", action: "", result: "" };
  // 「**① 分岐点**:」「## 判断材料」「## 結果」などを区切りに使う。旧「結果・学習」も読み取りだけは互換対応。
  const re = /(?:^|\n)\s*(?:#{1,6}\s*)?(?:\*\*)?[①②③④①-④12345]?\.?\s*(分岐点|判断材料|アクション|結果[・·]?学習|学習[・·]?結果|結果)(?:\*\*)?[:：]?\s*/g;
  const tokens: { matchStart: number; bodyStart: number; label: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) tokens.push({ matchStart: m.index, bodyStart: m.index + m[0].length, label: m[1] });
  if (tokens.length === 0) return blocks;
  for (let i = 0; i < tokens.length; i++) {
    const start = tokens[i].bodyStart;
    const end = i + 1 < tokens.length ? tokens[i + 1].matchStart : content.length;
    const body = content.slice(start, end > start ? end : content.length).trim().replace(/^[:：\s]+/, "");
    const label = tokens[i].label;
    if (label === "分岐点") blocks.branch = body;
    else if (label === "判断材料") blocks.criteria = body;
    else if (label === "アクション") blocks.action = body;
    else if (label.includes("結果") || label.includes("学習")) blocks.result = body;
  }
  return blocks;
}

const CORE_STEP_META = [
  { key: "branch" as const,   label: "① 分岐点",      icon: "🔀", color: "bg-blue-50 border-blue-200 text-blue-900" },
  { key: "criteria" as const, label: "② 判断材料",    icon: "📊", color: "bg-amber-50 border-amber-200 text-amber-900" },
  { key: "action" as const,   label: "③ アクション",  icon: "🎯", color: "bg-emerald-50 border-emerald-200 text-emerald-900" },
];
const RESULT_STEP_META = { key: "result" as const, label: "④ 結果", icon: "💡", color: "bg-violet-50 border-violet-200 text-violet-900" };

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

const VALENCE_BADGE: Record<string, string> = {
  positive: "bg-emerald-50 text-emerald-700 border-emerald-200",
  negative: "bg-red-50 text-red-700 border-red-200",
  mixed: "bg-amber-50 text-amber-700 border-amber-200",
  neutral: "bg-slate-50 text-slate-600 border-slate-200",
  unknown: "bg-zinc-50 text-zinc-500 border-zinc-200",
};

const CONFIDENCE_BADGE: Record<string, string> = {
  high: "bg-indigo-50 text-indigo-700 border-indigo-200",
  medium: "bg-sky-50 text-sky-700 border-sky-200",
  low: "bg-zinc-50 text-zinc-500 border-zinc-200",
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
  source: "manual",
  status: "candidate",
  kind: "pattern",
  is_universal: true,
};

function hasConflictingObservations(observations: ProtocolResultObservation[]): boolean {
  const valencesByHorizon = new Map<string, Set<string>>();
  for (const observation of observations) {
    const normalized = observation.valence || "unknown";
    const set = valencesByHorizon.get(observation.horizon) ?? new Set<string>();
    set.add(normalized);
    valencesByHorizon.set(observation.horizon, set);
  }
  return Array.from(valencesByHorizon.values()).some((set) => set.size > 1);
}

function shortReferenceId(referenceId: string | null): string {
  if (!referenceId) return "";
  return referenceId.length > 18 ? `${referenceId.slice(0, 18)}...` : referenceId;
}

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
  // 旧形式 (kind='legacy_specific') は初期 collapsed。新形式 (pattern + null) が候補欄に立つ。
  const [legacyOpen, setLegacyOpen] = useState(false);
  const [legacyBusy, setLegacyBusy] = useState(false);

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

  // kind='legacy_specific' は旧手動入力。新しい Phase 4 抽出は kind='pattern' (普遍プロトコル)。
  const legacyRows = useMemo(
    () => filtered.filter((r) => r.kind === "legacy_specific" && r.status !== "archived"),
    [filtered]
  );
  const mainRows = useMemo(
    () => filtered.filter((r) => r.kind !== "legacy_specific" || r.status === "archived"),
    [filtered]
  );

  const archiveAllLegacy = async () => {
    if (legacyRows.length === 0) return;
    if (!window.confirm(`旧形式 ${legacyRows.length} 件を一括で status='archived' にします。よろしいですか?`)) return;
    setLegacyBusy(true);
    const ids = legacyRows.map((r) => r.id);
    const { error } = await supabase
      .from("protocols")
      .update({ status: "archived", updated_at: new Date().toISOString() })
      .in("id", ids);
    if (error) {
      setHint(`一括 archive エラー: ${error.message}`);
    } else {
      setRows((prev) => prev.map((x) => ids.includes(x.id) ? { ...x, status: "archived" } : x));
      setHint(`旧形式 ${ids.length} 件を archive しました`);
    }
    setLegacyBusy(false);
  };

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
    const content = [
      `## ① 分岐点\n${newVals.branch_point || ""}`,
      `## ② 判断材料\n${newVals.criteria || ""}`,
      `## ③ アクション\n${newVals.action_taken || ""}`,
      "## ④ 結果\n",
    ].join("\n\n");
    const row = {
      protocol_id: pid,
      title: newVals.title.trim(),
      project_id: newVals.project_id || null,
      content,
      tags: newVals.tags || null,
      importance: Number(newVals.importance) || 1,
      source: "manual",
      status: newVals.status || "candidate",
      kind: "pattern",
      is_universal: true,
      created_at: now,
      updated_at: now,
    };
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

      <div className="text-[12px] text-muted-foreground mb-1">
        新形式 (pattern) {mainRows.length} 件
        {legacyRows.length > 0 && (
          <span className="ml-3 text-amber-700">／ 旧形式 (legacy_specific, 要 archive) {legacyRows.length} 件</span>
        )}
      </div>

      {mainRows.length === 0 && legacyRows.length === 0 ? (
        <div className="border border-border rounded-lg px-4 py-6 text-center text-muted-foreground text-[13px]">
          {rows.length === 0 ? "まだProtocolがありません。「＋ 追加」から登録してください。" : "該当なし"}
        </div>
      ) : mainRows.length === 0 ? (
        <div className="border border-border rounded-lg px-4 py-6 text-center text-muted-foreground text-[13px]">
          新形式 (pattern) の候補なし。下の「旧形式」を再抽出する or 新規スレッド議事録を蓄えてください。
        </div>
      ) : (
        <div className="border border-border rounded-lg divide-y divide-border">
          {mainRows.map((r) => {
            const isExpanded = expandedId === r.id;
            const tags = (r.tags || "").split(",").map((t) => t.trim()).filter(Boolean);
            const observations = r.observations ?? [];
            const hasConflict = hasConflictingObservations(observations);
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
                      {hasConflict && (
                        <span className="text-[10px] bg-red-50 text-red-700 border border-red-200 px-1.5 py-0.5 rounded">
                          矛盾観測
                        </span>
                      )}
                    </div>
                    {/* 折りたたみ時の preview: Phase 4 は content、旧手動は criteria */}
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
                  <div className="px-10 pb-4 pt-2 border-t border-border/50 space-y-3">
                    {/* ステップカード (普遍パターン部分) */}
                    {r.content && (() => {
                      const parsed = parseFourElements(r.content);
                      const anyParsed = parsed.branch || parsed.criteria || parsed.action || parsed.result;
                      if (!anyParsed) {
                        return (
                          <div className="rounded-md bg-muted/30 p-3">
                            <p className="text-[12px] whitespace-pre-wrap leading-relaxed">{r.content}</p>
                          </div>
                        );
                      }
                      const steps = parsed.result ? [...CORE_STEP_META, RESULT_STEP_META] : CORE_STEP_META;
                      return (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {steps.map((step) => {
                            const body = parsed[step.key];
                            return (
                              <div key={step.key} className={`rounded-md border p-2.5 ${step.color}`}>
                                <div className="flex items-center gap-1.5 text-[11px] font-semibold mb-1">
                                  <span className="text-base leading-none">{step.icon}</span>
                                  <span>{step.label}</span>
                                </div>
                                <p className="text-[11.5px] leading-relaxed whitespace-pre-wrap">
                                  {body || <span className="text-muted-foreground italic">(未記載)</span>}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                    {/* 旧手動 (互換) */}
                    {!r.content && (r.branch_point || r.criteria || r.action_taken) && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {r.branch_point && (
                          <div className="rounded-md border bg-blue-50 border-blue-200 p-2.5">
                            <div className="text-[11px] font-semibold text-blue-900 mb-1">🔀 ① 分岐点</div>
                            <p className="text-[11.5px] whitespace-pre-wrap">{r.branch_point}</p>
                          </div>
                        )}
                        {r.criteria && (
                          <div className="rounded-md border bg-amber-50 border-amber-200 p-2.5">
                            <div className="text-[11px] font-semibold text-amber-900 mb-1">📊 ② 判断材料</div>
                            <p className="text-[11.5px] whitespace-pre-wrap">{r.criteria}</p>
                          </div>
                        )}
                        {r.action_taken && (
                          <div className="rounded-md border bg-emerald-50 border-emerald-200 p-2.5">
                            <div className="text-[11px] font-semibold text-emerald-900 mb-1">🎯 ③ アクション</div>
                            <p className="text-[11.5px] whitespace-pre-wrap">{r.action_taken}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 関連事例リスト (1 プロトコル : N 事例) */}
                    {r.examples && r.examples.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-border/50">
                        <div className="text-[11px] font-semibold text-muted-foreground mb-1.5">
                          📂 関連事例 ({r.examples.length})
                        </div>
                        <ol className="space-y-1.5">
                          {r.examples.map((ex, ei) => (
                            <li key={`${ex.project_id}-${ex.occurred_on}-${ei}`}
                                className="text-[11px] rounded border border-border/60 bg-background p-2">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span className="font-mono font-bold text-[10px] text-muted-foreground">
                                  {ex.occurred_on ? ex.occurred_on : "日付不明"}
                                </span>
                                <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{ex.project_id}</span>
                                {ex.source_meeting_id && (
                                  <span className="text-[9px] text-muted-foreground font-mono truncate">
                                    src: {ex.source_meeting_id.slice(0, 12)}
                                  </span>
                                )}
                              </div>
                              <p className="leading-relaxed">{ex.summary}</p>
                              {(ex.branch_point || ex.criteria || ex.action_taken || ex.result) && (
                                <details className="mt-1">
                                  <summary className="text-[10px] text-muted-foreground cursor-pointer">
                                    {ex.result ? "事例の 4 要素" : "事例の 3 要素"}
                                  </summary>
                                  <div className="mt-1 pl-2 border-l-2 border-border space-y-0.5 text-[10.5px]">
                                    {ex.branch_point && <div>🔀 <strong>分岐点:</strong> {ex.branch_point}</div>}
                                    {ex.criteria && <div>📊 <strong>判断材料:</strong> {ex.criteria}</div>}
                                    {ex.action_taken && <div>🎯 <strong>アクション:</strong> {ex.action_taken}</div>}
                                    {ex.result && <div>💡 <strong>結果:</strong> {ex.result}</div>}
                                  </div>
                                </details>
                              )}
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}

                    <div className="mt-2 pt-2 border-t border-border/50">
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="text-[11px] font-semibold text-muted-foreground">
                          結果観測 ledger ({observations.length})
                        </div>
                        {hasConflict && (
                          <span className="text-[10px] bg-red-50 text-red-700 border border-red-200 px-1.5 py-0.5 rounded">
                            同一horizonで矛盾観測あり
                          </span>
                        )}
                      </div>
                      {observations.length === 0 ? (
                        <div className="rounded border border-dashed border-border/70 bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
                          outcome ledger はまだ空です。P0 は read-only 表示のみで、既存観測の上書きや追加はしません。
                        </div>
                      ) : (
                        <ol className="space-y-1.5">
                          {observations.map((observation) => (
                            <li key={observation.id} className="rounded border border-border/60 bg-background p-2 text-[11px]">
                              <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                                <span className="font-mono font-bold text-[10px] text-muted-foreground">
                                  {observation.observed_on}
                                </span>
                                <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded">
                                  {observation.horizon}
                                </span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${VALENCE_BADGE[observation.valence] ?? VALENCE_BADGE.unknown}`}>
                                  {observation.valence}
                                </span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${CONFIDENCE_BADGE[observation.confidence] ?? CONFIDENCE_BADGE.medium}`}>
                                  {observation.confidence}
                                </span>
                                {observation.project_id && (
                                  <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded">
                                    {observation.project_id}
                                  </span>
                                )}
                                {(observation.evidence_source_type || observation.evidence_source_id) && (
                                  <span className="text-[9px] text-muted-foreground font-mono truncate">
                                    ref: {[observation.evidence_source_type, shortReferenceId(observation.evidence_source_id)].filter(Boolean).join(" / ")}
                                  </span>
                                )}
                              </div>
                              <p className="leading-relaxed whitespace-pre-wrap">{observation.summary}</p>
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>

                    <div className="text-[10px] text-muted-foreground">
                      ID: {r.protocol_id} / source: {r.source || r.source_type || "—"} / kind: {r.kind || "—"} / updated: {r.updated_at?.slice(0, 10)}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 旧形式セクション (= kind='legacy_specific' でまだ archived 化されてないもの)。
          まさルール: legacy_specific は再抽出 or アーカイブ対象。新形式の候補欄に混ぜない */}
      {legacyRows.length > 0 && (
        <div className="mt-6 border border-amber-300 rounded-lg bg-amber-50/40">
          <button
            type="button"
            onClick={() => setLegacyOpen((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-left"
          >
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-amber-700 font-semibold">
                ⚠️ 旧形式 ({legacyRows.length} 件、要 再抽出 or archive)
              </span>
              <span className="text-[10px] text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">
                kind=legacy_specific
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span
                onClick={(e) => { e.stopPropagation(); if (!legacyBusy) archiveAllLegacy(); }}
                className={`text-[11px] px-2 py-0.5 rounded border ${
                  legacyBusy
                    ? "text-muted-foreground border-border bg-muted/40 cursor-not-allowed"
                    : "text-amber-800 border-amber-400 bg-amber-100 hover:bg-amber-200 cursor-pointer"
                }`}
                role="button"
              >
                {legacyBusy ? "実行中…" : "📥 全部 archive"}
              </span>
              <span className="text-[11px] text-amber-700">{legacyOpen ? "▼" : "▶"}</span>
            </div>
          </button>

          {legacyOpen && (
            <div className="border-t border-amber-200 divide-y divide-amber-200">
              {legacyRows.map((r) => (
                <div key={r.id} className="px-4 py-2.5 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-[12.5px]">{r.title}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${STATUS_BADGE[r.status] ?? ""}`}>
                        {r.status}
                      </span>
                      {r.project_name && (
                        <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          {r.project_name}
                        </span>
                      )}
                    </div>
                    {(r.criteria || r.branch_point) && (
                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 whitespace-pre-wrap">
                        {(r.criteria || r.branch_point || "").slice(0, 200)}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => updateStatus(r, "archived")}
                      className="text-[11px] text-muted-foreground border border-border px-2 py-0.5 rounded"
                      title="この 1 件だけ archive"
                    >
                      📥 archive
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
