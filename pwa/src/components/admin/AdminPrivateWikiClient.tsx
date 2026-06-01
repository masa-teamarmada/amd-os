"use client";

import { useMemo, useState } from "react";
import {
  Archive,
  Check,
  Edit3,
  FileText,
  Plus,
  Search,
  ShieldAlert,
  X,
} from "lucide-react";

export interface PrivateWikiEntry {
  id: string;
  projectId: string | null;
  personName: string;
  personKind: string;
  affiliation: string | null;
  relationshipContext: string | null;
  tags: string[];
  memoBody: string;
  sourceKind: string;
  sourceRef: string | null;
  sourceExcerpt: string | null;
  confidence: number;
  visibility: string;
  status: string;
  createdBy: string | null;
  updatedBy: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PrivateWikiProject {
  projectId: string;
  projectName: string;
  status: string | null;
}

interface Props {
  initialEntries: PrivateWikiEntry[];
  projects: PrivateWikiProject[];
  initialError: string | null;
}

type FormState = {
  id?: string;
  projectId: string;
  personName: string;
  personKind: string;
  affiliation: string;
  relationshipContext: string;
  tagsText: string;
  memoBody: string;
  sourceKind: string;
  sourceRef: string;
  sourceExcerpt: string;
  confidence: number;
  status: string;
};

const PERSON_KIND_OPTIONS: Array<[string, string]> = [
  ["amd_member", "AMDメンバー"],
  ["client", "クライアント"],
  ["partner", "取引先"],
  ["vendor", "ベンダー"],
  ["investor", "投資家"],
  ["researcher", "研究者"],
  ["external_collaborator", "外部協力者"],
  ["other", "その他"],
];

const SOURCE_KIND_OPTIONS: Array<[string, string]> = [
  ["manual", "手入力"],
  ["codex", "Codex"],
  ["slack", "Slack"],
  ["gmail", "Gmail"],
  ["notion", "Notion"],
  ["drive", "Drive"],
  ["calendar", "Calendar"],
  ["meeting", "MTG"],
  ["other", "その他"],
];

const STATUS_OPTIONS: Array<[string, string]> = [
  ["active", "active"],
  ["needs_review", "needs_review"],
  ["archived", "archived"],
];

const BLANK_FORM: FormState = {
  projectId: "",
  personName: "",
  personKind: "external_collaborator",
  affiliation: "",
  relationshipContext: "",
  tagsText: "",
  memoBody: "",
  sourceKind: "manual",
  sourceRef: "",
  sourceExcerpt: "",
  confidence: 0.5,
  status: "active",
};

const kindLabel = new Map(PERSON_KIND_OPTIONS);
const sourceLabel = new Map(SOURCE_KIND_OPTIONS);

function compactDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeTags(text: string) {
  return Array.from(new Set(text.split(",").map((tag) => tag.trim()).filter(Boolean))).slice(0, 24);
}

function formFromEntry(entry: PrivateWikiEntry): FormState {
  return {
    id: entry.id,
    projectId: entry.projectId ?? "",
    personName: entry.personName,
    personKind: entry.personKind,
    affiliation: entry.affiliation ?? "",
    relationshipContext: entry.relationshipContext ?? "",
    tagsText: entry.tags.join(", "),
    memoBody: entry.memoBody,
    sourceKind: entry.sourceKind,
    sourceRef: entry.sourceRef ?? "",
    sourceExcerpt: entry.sourceExcerpt ?? "",
    confidence: entry.confidence,
    status: entry.status,
  };
}

function mapApiEntry(entry: Record<string, unknown>): PrivateWikiEntry {
  return {
    id: String(entry.id),
    projectId: typeof entry.project_id === "string" ? entry.project_id : null,
    personName: String(entry.person_name ?? ""),
    personKind: String(entry.person_kind ?? "external_collaborator"),
    affiliation: typeof entry.affiliation === "string" ? entry.affiliation : null,
    relationshipContext: typeof entry.relationship_context === "string" ? entry.relationship_context : null,
    tags: Array.isArray(entry.tags) ? entry.tags.map(String) : [],
    memoBody: String(entry.memo_body ?? ""),
    sourceKind: String(entry.source_kind ?? "manual"),
    sourceRef: typeof entry.source_ref === "string" ? entry.source_ref : null,
    sourceExcerpt: typeof entry.source_excerpt === "string" ? entry.source_excerpt : null,
    confidence: Number(entry.confidence ?? 0.5),
    visibility: String(entry.visibility ?? "admin_private"),
    status: String(entry.status ?? "active"),
    createdBy: typeof entry.created_by === "string" ? entry.created_by : null,
    updatedBy: typeof entry.updated_by === "string" ? entry.updated_by : null,
    archivedAt: typeof entry.archived_at === "string" ? entry.archived_at : null,
    createdAt: String(entry.created_at ?? ""),
    updatedAt: String(entry.updated_at ?? ""),
  };
}

function ProjectSelect({
  value,
  projects,
  onChange,
}: {
  value: string;
  projects: PrivateWikiProject[];
  onChange: (value: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-8 rounded-md border border-border bg-background px-2 text-xs"
    >
      <option value="">AMD全体 / 未紐付け</option>
      {projects.map((project) => (
        <option key={project.projectId} value={project.projectId}>
          {project.projectId} {project.projectName}
        </option>
      ))}
    </select>
  );
}

export function AdminPrivateWikiClient({ initialEntries, projects, initialError }: Props) {
  const [entries, setEntries] = useState(initialEntries);
  const [query, setQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [kindFilter, setKindFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [editing, setEditing] = useState<FormState | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hint, setHint] = useState(initialError ? `読み込みエラー: ${initialError}` : "");

  const projectById = useMemo(() => new Map(projects.map((project) => [project.projectId, project])), [projects]);
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    entries.forEach((entry) => entry.tags.forEach((tag) => tags.add(tag)));
    return Array.from(tags).sort((a, b) => a.localeCompare(b, "ja"));
  }, [entries]);

  const filteredEntries = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return entries.filter((entry) => {
      if (projectFilter && entry.projectId !== projectFilter) return false;
      if (kindFilter && entry.personKind !== kindFilter) return false;
      if (statusFilter && entry.status !== statusFilter) return false;
      if (tagFilter && !entry.tags.includes(tagFilter)) return false;
      if (!needle) return true;
      const haystack = [
        entry.personName,
        entry.affiliation,
        entry.relationshipContext,
        entry.memoBody,
        entry.sourceRef,
        entry.sourceExcerpt,
        entry.tags.join(" "),
        projectById.get(entry.projectId ?? "")?.projectName,
      ].join(" ").toLowerCase();
      return haystack.includes(needle);
    });
  }, [entries, kindFilter, projectById, projectFilter, query, statusFilter, tagFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, PrivateWikiEntry[]>();
    filteredEntries.forEach((entry) => {
      const key = entry.projectId || "__global__";
      map.set(key, [...(map.get(key) ?? []), entry]);
    });
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === "__global__") return -1;
      if (b === "__global__") return 1;
      return a.localeCompare(b);
    });
  }, [filteredEntries]);

  const openCreate = () => {
    setEditing({ ...BLANK_FORM, projectId: projectFilter });
    setIsCreating(true);
    setHint("");
  };

  const closeForm = () => {
    setEditing(null);
    setIsCreating(false);
  };

  const saveForm = async () => {
    if (!editing) return;
    if (!editing.personName.trim() || !editing.memoBody.trim()) {
      setHint("人物名と本文メモは必須だよ");
      return;
    }
    setSaving(true);
    const payload = {
      id: editing.id,
      projectId: editing.projectId || null,
      personName: editing.personName,
      personKind: editing.personKind,
      affiliation: editing.affiliation || null,
      relationshipContext: editing.relationshipContext || null,
      tags: normalizeTags(editing.tagsText),
      memoBody: editing.memoBody,
      sourceKind: editing.sourceKind,
      sourceRef: editing.sourceRef || null,
      sourceExcerpt: editing.sourceExcerpt || null,
      confidence: editing.confidence,
      status: editing.status,
    };
    const res = await fetch("/api/admin/private-wiki", {
      method: isCreating ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json() as { ok: boolean; entry?: Record<string, unknown>; error?: string };
    if (!res.ok || !json.ok || !json.entry) {
      setHint(`保存エラー: ${json.error ?? res.statusText}`);
      setSaving(false);
      return;
    }
    const next = mapApiEntry(json.entry);
    setEntries((prev) => isCreating
      ? [next, ...prev]
      : prev.map((entry) => entry.id === next.id ? next : entry));
    setHint(`${next.personName} を保存したよ`);
    setSaving(false);
    closeForm();
  };

  const archiveEntry = async (entry: PrivateWikiEntry) => {
    if (!confirm(`${entry.personName} をarchiveにする？`)) return;
    setSaving(true);
    const res = await fetch("/api/admin/private-wiki", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: entry.id,
        projectId: entry.projectId,
        personName: entry.personName,
        personKind: entry.personKind,
        affiliation: entry.affiliation,
        relationshipContext: entry.relationshipContext,
        tags: entry.tags,
        memoBody: entry.memoBody,
        sourceKind: entry.sourceKind,
        sourceRef: entry.sourceRef,
        sourceExcerpt: entry.sourceExcerpt,
        confidence: entry.confidence,
        status: "archived",
      }),
    });
    const json = await res.json() as { ok: boolean; entry?: Record<string, unknown>; error?: string };
    if (!res.ok || !json.ok || !json.entry) {
      setHint(`archiveエラー: ${json.error ?? res.statusText}`);
      setSaving(false);
      return;
    }
    const next = mapApiEntry(json.entry);
    setEntries((prev) => prev.map((item) => item.id === next.id ? next : item));
    setHint(`${entry.personName} をarchiveにしたよ`);
    setSaving(false);
  };

  const stats = useMemo(() => ({
    total: entries.length,
    active: entries.filter((entry) => entry.status === "active").length,
    review: entries.filter((entry) => entry.status === "needs_review").length,
    archived: entries.filter((entry) => entry.status === "archived").length,
  }), [entries]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold">裏wiki</h1>
            <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800">
              <ShieldAlert className="h-3.5 w-3.5" />
              admin-only
            </span>
          </div>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">
            PJ別に、人物の趣味・プライベート・関係性メモを保存する内部台帳。通常cockpit、公開ページ、研究機関workspaceには出さない。
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-foreground px-3 text-xs font-medium text-background"
        >
          <Plus className="h-3.5 w-3.5" />
          追加
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-4">
        <div className="rounded-md border border-border px-3 py-2">
          <div className="text-[11px] text-muted-foreground">total</div>
          <div className="text-lg font-semibold">{stats.total}</div>
        </div>
        <div className="rounded-md border border-border px-3 py-2">
          <div className="text-[11px] text-muted-foreground">active</div>
          <div className="text-lg font-semibold text-emerald-700">{stats.active}</div>
        </div>
        <div className="rounded-md border border-border px-3 py-2">
          <div className="text-[11px] text-muted-foreground">needs_review</div>
          <div className="text-lg font-semibold text-amber-700">{stats.review}</div>
        </div>
        <div className="rounded-md border border-border px-3 py-2">
          <div className="text-[11px] text-muted-foreground">archived</div>
          <div className="text-lg font-semibold text-zinc-500">{stats.archived}</div>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-md border border-border p-3">
        <label className="flex min-w-56 flex-1 flex-col gap-1 text-[11px] text-muted-foreground">
          検索
          <span className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="人物 / 所属 / メモ / source"
              className="h-8 w-full rounded-md border border-border bg-background pl-7 pr-2 text-xs text-foreground"
            />
          </span>
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
          PJ
          <ProjectSelect value={projectFilter} projects={projects} onChange={setProjectFilter} />
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
          人物種別
          <select value={kindFilter} onChange={(event) => setKindFilter(event.target.value)} className="h-8 rounded-md border border-border bg-background px-2 text-xs">
            <option value="">全て</option>
            {PERSON_KIND_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
          tag
          <select value={tagFilter} onChange={(event) => setTagFilter(event.target.value)} className="h-8 rounded-md border border-border bg-background px-2 text-xs">
            <option value="">全て</option>
            {allTags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
          status
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-8 rounded-md border border-border bg-background px-2 text-xs">
            <option value="">全て</option>
            {STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <button
          onClick={() => { setQuery(""); setProjectFilter(""); setKindFilter(""); setTagFilter(""); setStatusFilter("active"); }}
          className="h-8 rounded-md border border-border px-3 text-xs text-muted-foreground hover:text-foreground"
        >
          リセット
        </button>
      </div>

      {hint && <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">{hint}</div>}

      {editing && (
        <div className="rounded-md border border-border bg-background p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">{isCreating ? "裏wiki entry 追加" : "裏wiki entry 編集"}</h2>
            <button onClick={closeForm} className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="close form">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid gap-3 lg:grid-cols-4">
            <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
              PJ
              <ProjectSelect value={editing.projectId} projects={projects} onChange={(value) => setEditing((form) => form && { ...form, projectId: value })} />
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
              人物名 *
              <input value={editing.personName} onChange={(event) => setEditing((form) => form && { ...form, personName: event.target.value })} className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground" />
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
              人物種別
              <select value={editing.personKind} onChange={(event) => setEditing((form) => form && { ...form, personKind: event.target.value })} className="h-8 rounded-md border border-border bg-background px-2 text-xs">
                {PERSON_KIND_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
              所属
              <input value={editing.affiliation} onChange={(event) => setEditing((form) => form && { ...form, affiliation: event.target.value })} className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground" />
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-muted-foreground lg:col-span-2">
              関係先 / 関係性
              <input value={editing.relationshipContext} onChange={(event) => setEditing((form) => form && { ...form, relationshipContext: event.target.value })} className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground" />
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
              tags
              <input value={editing.tagsText} onChange={(event) => setEditing((form) => form && { ...form, tagsText: event.target.value })} placeholder="趣味, 関心, 接点" className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground" />
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
              status
              <select value={editing.status} onChange={(event) => setEditing((form) => form && { ...form, status: event.target.value })} className="h-8 rounded-md border border-border bg-background px-2 text-xs">
                {STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-muted-foreground lg:col-span-4">
              本文メモ *
              <textarea value={editing.memoBody} onChange={(event) => setEditing((form) => form && { ...form, memoBody: event.target.value })} rows={5} className="min-h-28 rounded-md border border-border bg-background px-2 py-2 text-xs leading-5 text-foreground" />
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
              source
              <select value={editing.sourceKind} onChange={(event) => setEditing((form) => form && { ...form, sourceKind: event.target.value })} className="h-8 rounded-md border border-border bg-background px-2 text-xs">
                {SOURCE_KIND_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
              confidence
              <input type="number" min={0} max={1} step={0.05} value={editing.confidence} onChange={(event) => setEditing((form) => form && { ...form, confidence: Number(event.target.value) })} className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground" />
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-muted-foreground lg:col-span-2">
              source_ref
              <input value={editing.sourceRef} onChange={(event) => setEditing((form) => form && { ...form, sourceRef: event.target.value })} placeholder="URL / message id / file path" className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground" />
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-muted-foreground lg:col-span-4">
              source_excerpt
              <textarea value={editing.sourceExcerpt} onChange={(event) => setEditing((form) => form && { ...form, sourceExcerpt: event.target.value })} rows={2} className="rounded-md border border-border bg-background px-2 py-2 text-xs leading-5 text-foreground" />
            </label>
          </div>
          <div className="mt-3 flex items-center justify-end gap-2">
            <button onClick={closeForm} className="inline-flex h-8 items-center gap-1 rounded-md border border-border px-3 text-xs text-muted-foreground">
              <X className="h-3.5 w-3.5" />
              キャンセル
            </button>
            <button onClick={saveForm} disabled={saving} className="inline-flex h-8 items-center gap-1 rounded-md bg-foreground px-3 text-xs font-medium text-background disabled:opacity-50">
              <Check className="h-3.5 w-3.5" />
              {saving ? "保存中" : "保存"}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="text-xs text-muted-foreground">{filteredEntries.length} 件表示</div>
        {grouped.length === 0 && (
          <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            条件に合うentryはまだ無いよ。
          </div>
        )}
        {grouped.map(([projectKey, groupEntries]) => {
          const project = projectKey === "__global__" ? null : projectById.get(projectKey);
          return (
            <section key={projectKey} className="rounded-md border border-border">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
                <div>
                  <h2 className="text-sm font-semibold">
                    {project ? `${project.projectId} ${project.projectName}` : "AMD全体 / 未紐付け"}
                  </h2>
                  <div className="text-[11px] text-muted-foreground">{groupEntries.length} entries</div>
                </div>
              </div>
              <div className="divide-y divide-border">
                {groupEntries.map((entry) => (
                  <article key={entry.id} className="grid gap-3 px-3 py-3 xl:grid-cols-[220px_minmax(0,1fr)_260px_96px]">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{entry.personName}</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <span className="rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground">{kindLabel.get(entry.personKind) ?? entry.personKind}</span>
                        <span className="rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground">{entry.status}</span>
                      </div>
                      {entry.affiliation && <div className="mt-1 truncate text-xs text-muted-foreground">{entry.affiliation}</div>}
                      {entry.relationshipContext && <div className="mt-1 text-xs leading-5 text-muted-foreground">{entry.relationshipContext}</div>}
                    </div>
                    <div className="min-w-0">
                      <p className="whitespace-pre-wrap break-words text-xs leading-5 text-foreground">{entry.memoBody}</p>
                      {entry.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {entry.tags.map((tag) => (
                            <button key={tag} onClick={() => setTagFilter(tag)} className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground">
                              #{tag}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 rounded-md bg-muted/30 p-2">
                      <div className="mb-1 flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                        <FileText className="h-3.5 w-3.5" />
                        {sourceLabel.get(entry.sourceKind) ?? entry.sourceKind}
                        <span className="ml-auto">conf {Math.round(entry.confidence * 100)}%</span>
                      </div>
                      {entry.sourceRef && <div className="truncate text-[11px] text-muted-foreground">{entry.sourceRef}</div>}
                      {entry.sourceExcerpt && <p className="mt-1 line-clamp-3 break-words text-[11px] leading-4 text-muted-foreground">{entry.sourceExcerpt}</p>}
                      <div className="mt-2 text-[11px] text-muted-foreground">更新 {compactDate(entry.updatedAt)}</div>
                      {entry.updatedBy && <div className="truncate text-[11px] text-muted-foreground">{entry.updatedBy}</div>}
                    </div>
                    <div className="flex items-start gap-1 xl:justify-end">
                      <button onClick={() => { setEditing(formFromEntry(entry)); setIsCreating(false); }} className="rounded-md border border-border p-1.5 text-muted-foreground hover:text-foreground" aria-label="edit entry">
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      {entry.status !== "archived" && (
                        <button onClick={() => archiveEntry(entry)} disabled={saving} className="rounded-md border border-border p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-50" aria-label="archive entry">
                          <Archive className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
