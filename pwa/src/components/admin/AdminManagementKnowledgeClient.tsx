"use client";

import { useMemo, useState } from "react";
import {
  Archive,
  BookOpen,
  Check,
  Edit3,
  FileText,
  Layers3,
  Plus,
  Search,
  X,
} from "lucide-react";

export interface ManagementKnowledgeEntry {
  id: string;
  projectId: string | null;
  title: string;
  category: string;
  routeType: string | null;
  maturity: string;
  tags: string[];
  summary: string;
  bodyMd: string;
  reusableWhen: string | null;
  nextCheck: string | null;
  sourceKind: string;
  sourceRef: string | null;
  sourceExcerpt: string | null;
  confidence: number;
  status: string;
  metadataJson: Record<string, unknown>;
  createdBy: string | null;
  updatedBy: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ManagementKnowledgeProject {
  projectId: string;
  projectName: string;
  status: string | null;
}

interface Props {
  initialEntries: ManagementKnowledgeEntry[];
  projects: ManagementKnowledgeProject[];
  initialError: string | null;
}

type FormState = {
  id?: string;
  projectId: string;
  title: string;
  category: string;
  routeType: string;
  maturity: string;
  tagsText: string;
  summary: string;
  bodyMd: string;
  reusableWhen: string;
  nextCheck: string;
  sourceKind: string;
  sourceRef: string;
  sourceExcerpt: string;
  confidence: number;
  status: string;
};

const CATEGORY_OPTIONS: Array<[string, string]> = [
  ["commercialization_route", "事業化ルート"],
  ["coalition_design", "組成 / 座組"],
  ["pricing", "価格 / 対価"],
  ["sales", "営業 / 顧客"],
  ["finance", "財務 / 資金"],
  ["governance", "ガバナンス"],
  ["organization", "組織 / 人"],
  ["fundraising", "資本政策"],
  ["legal", "法務論点"],
  ["operations", "運用"],
  ["other", "その他"],
];

const MATURITY_OPTIONS: Array<[string, string]> = [
  ["raw_note", "raw_note"],
  ["hypothesis", "hypothesis"],
  ["field_tested", "field_tested"],
  ["playbook", "playbook"],
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
  ["file", "File"],
  ["other", "その他"],
];

const STATUS_OPTIONS: Array<[string, string]> = [
  ["active", "active"],
  ["needs_review", "needs_review"],
  ["archived", "archived"],
];

const categoryLabel = new Map(CATEGORY_OPTIONS);
const sourceLabel = new Map(SOURCE_KIND_OPTIONS);

const BLANK_FORM: FormState = {
  projectId: "",
  title: "",
  category: "commercialization_route",
  routeType: "",
  maturity: "hypothesis",
  tagsText: "",
  summary: "",
  bodyMd: "",
  reusableWhen: "",
  nextCheck: "",
  sourceKind: "manual",
  sourceRef: "",
  sourceExcerpt: "",
  confidence: 0.5,
  status: "active",
};

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
  return Array.from(new Set(text.split(",").map((tag) => tag.trim()).filter(Boolean))).slice(0, 32);
}

function formFromEntry(entry: ManagementKnowledgeEntry): FormState {
  return {
    id: entry.id,
    projectId: entry.projectId ?? "",
    title: entry.title,
    category: entry.category,
    routeType: entry.routeType ?? "",
    maturity: entry.maturity,
    tagsText: entry.tags.join(", "),
    summary: entry.summary,
    bodyMd: entry.bodyMd,
    reusableWhen: entry.reusableWhen ?? "",
    nextCheck: entry.nextCheck ?? "",
    sourceKind: entry.sourceKind,
    sourceRef: entry.sourceRef ?? "",
    sourceExcerpt: entry.sourceExcerpt ?? "",
    confidence: entry.confidence,
    status: entry.status,
  };
}

function mapApiEntry(entry: Record<string, unknown>): ManagementKnowledgeEntry {
  return {
    id: String(entry.id),
    projectId: typeof entry.project_id === "string" ? entry.project_id : null,
    title: String(entry.title ?? ""),
    category: String(entry.category ?? "other"),
    routeType: typeof entry.route_type === "string" ? entry.route_type : null,
    maturity: String(entry.maturity ?? "hypothesis"),
    tags: Array.isArray(entry.tags) ? entry.tags.map(String) : [],
    summary: String(entry.summary ?? ""),
    bodyMd: String(entry.body_md ?? ""),
    reusableWhen: typeof entry.reusable_when === "string" ? entry.reusable_when : null,
    nextCheck: typeof entry.next_check === "string" ? entry.next_check : null,
    sourceKind: String(entry.source_kind ?? "manual"),
    sourceRef: typeof entry.source_ref === "string" ? entry.source_ref : null,
    sourceExcerpt: typeof entry.source_excerpt === "string" ? entry.source_excerpt : null,
    confidence: Number(entry.confidence ?? 0.5),
    status: String(entry.status ?? "active"),
    metadataJson: typeof entry.metadata_json === "object" && entry.metadata_json !== null
      ? entry.metadata_json as Record<string, unknown>
      : {},
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
  projects: ManagementKnowledgeProject[];
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

function KnowledgeBody({ text }: { text: string }) {
  if (!text.trim()) return null;
  return (
    <div className="mt-3 space-y-2 border-t border-border pt-3 text-xs leading-5 text-foreground">
      {text.split(/\n{2,}/).map((block, index) => {
        const trimmed = block.trim();
        if (!trimmed) return null;
        if (trimmed.startsWith("## ")) {
          return <h4 key={index} className="text-xs font-semibold">{trimmed.replace(/^##\s+/, "")}</h4>;
        }
        if (trimmed.startsWith("- ")) {
          return (
            <ul key={index} className="list-disc space-y-1 pl-4 text-muted-foreground">
              {trimmed.split("\n").map((line) => line.replace(/^-\s+/, "").trim()).filter(Boolean).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          );
        }
        return <p key={index} className="whitespace-pre-wrap break-words text-muted-foreground">{trimmed}</p>;
      })}
    </div>
  );
}

export function AdminManagementKnowledgeClient({ initialEntries, projects, initialError }: Props) {
  const [entries, setEntries] = useState(initialEntries);
  const [query, setQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [maturityFilter, setMaturityFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
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
      if (categoryFilter && entry.category !== categoryFilter) return false;
      if (maturityFilter && entry.maturity !== maturityFilter) return false;
      if (statusFilter && entry.status !== statusFilter) return false;
      if (tagFilter && !entry.tags.includes(tagFilter)) return false;
      if (!needle) return true;
      const haystack = [
        entry.title,
        entry.summary,
        entry.bodyMd,
        entry.reusableWhen,
        entry.nextCheck,
        entry.routeType,
        entry.sourceRef,
        entry.sourceExcerpt,
        entry.tags.join(" "),
        projectById.get(entry.projectId ?? "")?.projectName,
      ].join(" ").toLowerCase();
      return haystack.includes(needle);
    });
  }, [categoryFilter, entries, maturityFilter, projectById, projectFilter, query, statusFilter, tagFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, ManagementKnowledgeEntry[]>();
    filteredEntries.forEach((entry) => {
      const key = entry.category || "other";
      map.set(key, [...(map.get(key) ?? []), entry]);
    });
    const order = new Map(CATEGORY_OPTIONS.map(([value], index) => [value, index]));
    return Array.from(map.entries()).sort(([a], [b]) => (order.get(a) ?? 99) - (order.get(b) ?? 99));
  }, [filteredEntries]);

  const openCreate = () => {
    setEditing({ ...BLANK_FORM, projectId: projectFilter, category: categoryFilter || BLANK_FORM.category });
    setIsCreating(true);
    setHint("");
  };

  const closeForm = () => {
    setEditing(null);
    setIsCreating(false);
  };

  const saveForm = async () => {
    if (!editing) return;
    if (!editing.title.trim() || !editing.summary.trim()) {
      setHint("タイトルと要約は必須だよ");
      return;
    }
    setSaving(true);
    const payload = {
      id: editing.id,
      projectId: editing.projectId || null,
      title: editing.title,
      category: editing.category,
      routeType: editing.routeType || null,
      maturity: editing.maturity,
      tags: normalizeTags(editing.tagsText),
      summary: editing.summary,
      bodyMd: editing.bodyMd,
      reusableWhen: editing.reusableWhen || null,
      nextCheck: editing.nextCheck || null,
      sourceKind: editing.sourceKind,
      sourceRef: editing.sourceRef || null,
      sourceExcerpt: editing.sourceExcerpt || null,
      confidence: editing.confidence,
      status: editing.status,
    };
    const res = await fetch("/api/admin/management-knowledge", {
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
    setEntries((prev) => isCreating ? [next, ...prev] : prev.map((entry) => entry.id === next.id ? next : entry));
    setHint(`${next.title} を保存したよ`);
    setSaving(false);
    closeForm();
  };

  const archiveEntry = async (entry: ManagementKnowledgeEntry) => {
    if (!confirm(`${entry.title} をarchiveにする？`)) return;
    setSaving(true);
    const res = await fetch("/api/admin/management-knowledge", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: entry.id,
        projectId: entry.projectId,
        title: entry.title,
        category: entry.category,
        routeType: entry.routeType,
        maturity: entry.maturity,
        tags: entry.tags,
        summary: entry.summary,
        bodyMd: entry.bodyMd,
        reusableWhen: entry.reusableWhen,
        nextCheck: entry.nextCheck,
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
    setHint(`${entry.title} をarchiveにしたよ`);
    setSaving(false);
  };

  const stats = useMemo(() => ({
    total: entries.length,
    active: entries.filter((entry) => entry.status === "active").length,
    hypotheses: entries.filter((entry) => entry.maturity === "hypothesis").length,
    playbook: entries.filter((entry) => entry.maturity === "playbook").length,
  }), [entries]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold">経営ノウハウ</h1>
            <span className="inline-flex items-center gap-1 rounded-md border border-sky-200 bg-sky-50 px-2 py-1 text-xs font-medium text-sky-800">
              <BookOpen className="h-3.5 w-3.5" />
              admin-only
            </span>
          </div>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">
            事業化ルート、座組、価格、資金、法務論点など、PJをまたいで再利用する判断カード。
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
          <div className="text-[11px] text-muted-foreground">hypothesis</div>
          <div className="text-lg font-semibold text-sky-700">{stats.hypotheses}</div>
        </div>
        <div className="rounded-md border border-border px-3 py-2">
          <div className="text-[11px] text-muted-foreground">playbook</div>
          <div className="text-lg font-semibold text-zinc-700">{stats.playbook}</div>
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
              placeholder="型 / 条件 / source / tag"
              className="h-8 w-full rounded-md border border-border bg-background pl-7 pr-2 text-xs text-foreground"
            />
          </span>
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
          PJ
          <ProjectSelect value={projectFilter} projects={projects} onChange={setProjectFilter} />
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
          分類
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="h-8 rounded-md border border-border bg-background px-2 text-xs">
            <option value="">全て</option>
            {CATEGORY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
          maturity
          <select value={maturityFilter} onChange={(event) => setMaturityFilter(event.target.value)} className="h-8 rounded-md border border-border bg-background px-2 text-xs">
            <option value="">全て</option>
            {MATURITY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
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
          onClick={() => {
            setQuery("");
            setProjectFilter("");
            setCategoryFilter("");
            setMaturityFilter("");
            setTagFilter("");
            setStatusFilter("active");
          }}
          className="h-8 rounded-md border border-border px-3 text-xs text-muted-foreground hover:text-foreground"
        >
          リセット
        </button>
      </div>

      {hint && <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">{hint}</div>}

      {editing && (
        <div className="rounded-md border border-border bg-background p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">{isCreating ? "経営ノウハウ 追加" : "経営ノウハウ 編集"}</h2>
            <button onClick={closeForm} className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="close form">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid gap-3 lg:grid-cols-4">
            <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
              PJ
              <ProjectSelect value={editing.projectId} projects={projects} onChange={(value) => setEditing((form) => form && { ...form, projectId: value })} />
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-muted-foreground lg:col-span-2">
              タイトル *
              <input value={editing.title} onChange={(event) => setEditing((form) => form && { ...form, title: event.target.value })} className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground" />
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
              分類
              <select value={editing.category} onChange={(event) => setEditing((form) => form && { ...form, category: event.target.value })} className="h-8 rounded-md border border-border bg-background px-2 text-xs">
                {CATEGORY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
              route_type
              <input value={editing.routeType} onChange={(event) => setEditing((form) => form && { ...form, routeType: event.target.value })} placeholder="Proto-RT / JカーブSU" className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground" />
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
              maturity
              <select value={editing.maturity} onChange={(event) => setEditing((form) => form && { ...form, maturity: event.target.value })} className="h-8 rounded-md border border-border bg-background px-2 text-xs">
                {MATURITY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
              status
              <select value={editing.status} onChange={(event) => setEditing((form) => form && { ...form, status: event.target.value })} className="h-8 rounded-md border border-border bg-background px-2 text-xs">
                {STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
              tags
              <input value={editing.tagsText} onChange={(event) => setEditing((form) => form && { ...form, tagsText: event.target.value })} placeholder="RT, 事業化, 座組" className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground" />
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-muted-foreground lg:col-span-4">
              要約 *
              <textarea value={editing.summary} onChange={(event) => setEditing((form) => form && { ...form, summary: event.target.value })} rows={3} className="rounded-md border border-border bg-background px-2 py-2 text-xs leading-5 text-foreground" />
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-muted-foreground lg:col-span-4">
              本文
              <textarea value={editing.bodyMd} onChange={(event) => setEditing((form) => form && { ...form, bodyMd: event.target.value })} rows={8} className="min-h-40 rounded-md border border-border bg-background px-2 py-2 text-xs leading-5 text-foreground" />
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-muted-foreground lg:col-span-2">
              再利用条件
              <textarea value={editing.reusableWhen} onChange={(event) => setEditing((form) => form && { ...form, reusableWhen: event.target.value })} rows={3} className="rounded-md border border-border bg-background px-2 py-2 text-xs leading-5 text-foreground" />
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-muted-foreground lg:col-span-2">
              次に確認する論点
              <textarea value={editing.nextCheck} onChange={(event) => setEditing((form) => form && { ...form, nextCheck: event.target.value })} rows={3} className="rounded-md border border-border bg-background px-2 py-2 text-xs leading-5 text-foreground" />
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
            条件に合うカードはまだ無いよ。
          </div>
        )}
        {grouped.map(([category, groupEntries]) => (
          <section key={category} className="rounded-md border border-border">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
              <div className="flex items-center gap-2">
                <Layers3 className="h-4 w-4 text-muted-foreground" />
                <div>
                  <h2 className="text-sm font-semibold">{categoryLabel.get(category) ?? category}</h2>
                  <div className="text-[11px] text-muted-foreground">{groupEntries.length} cards</div>
                </div>
              </div>
            </div>
            <div className="divide-y divide-border">
              {groupEntries.map((entry) => {
                const project = entry.projectId ? projectById.get(entry.projectId) : null;
                return (
                  <article key={entry.id} className="grid gap-3 px-3 py-3 xl:grid-cols-[minmax(0,1fr)_260px_96px]">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="min-w-0 text-sm font-semibold">{entry.title}</h3>
                        <span className="rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground">{entry.maturity}</span>
                        {entry.routeType && <span className="rounded-md bg-sky-50 px-1.5 py-0.5 text-[11px] font-medium text-sky-800">{entry.routeType}</span>}
                      </div>
                      <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-5 text-foreground">{entry.summary}</p>
                      <div className="mt-2 grid gap-2 lg:grid-cols-2">
                        {entry.reusableWhen && (
                          <div className="rounded-md bg-muted/30 p-2">
                            <div className="text-[11px] font-medium text-muted-foreground">再利用条件</div>
                            <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-foreground">{entry.reusableWhen}</p>
                          </div>
                        )}
                        {entry.nextCheck && (
                          <div className="rounded-md bg-muted/30 p-2">
                            <div className="text-[11px] font-medium text-muted-foreground">次に確認</div>
                            <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-foreground">{entry.nextCheck}</p>
                          </div>
                        )}
                      </div>
                      <KnowledgeBody text={entry.bodyMd} />
                      {entry.tags.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1">
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
                      <div className="truncate text-[11px] text-muted-foreground">
                        {project ? `${project.projectId} ${project.projectName}` : "AMD全体"}
                      </div>
                      {entry.sourceRef && <div className="mt-1 truncate text-[11px] text-muted-foreground">{entry.sourceRef}</div>}
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
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
