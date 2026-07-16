"use client";

import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import {
  fetchSeedDetail,
  insertSeed,
  updateSeed,
  deleteSeed,
  insertSeedFunding,
  updateSeedFunding,
  deleteSeedFunding,
  insertSeedNews,
  deleteSeedNews,
  insertSeedContactLog,
  deleteSeedContactLog,
  formatJpy,
  SEED_STATUS_LABEL,
  SEED_STATUS_ORDER,
  SEED_STATUS_COLOR,
  SEED_ORG_TYPE_LABEL,
  SEED_DOMAIN_LANE_LABEL,
  SEED_SOURCE_LABEL,
  SEED_FUNDING_STATUS_LABEL,
  SEED_NEWS_KIND_LABEL,
  SEED_CONTACT_METHOD_LABEL,
} from "@/lib/seeds-data";
import type {
  Seed,
  SeedDetail,
  SeedFunding,
  SeedFundingStatus,
  SeedNews,
  SeedNewsKind,
  SeedContactLog,
  SeedContactMethod,
} from "@/types/seeds";
import { createClient } from "@/lib/supabase/client";
import { SeedMarkdownPreviewModal } from "@/components/seeds/SeedMarkdownPreviewModal";

interface MemberLite {
  member_id: string;
  code_name: string;
}
interface ProjectLite {
  project_id: string;
  project_name: string;
  short_label: string | null;
}

interface RawProjectLite {
  project_id: string;
  short_label: string | null;
  projects: { project_name: string | null } | { project_name: string | null }[] | null;
}

export function SeedDetailModal({
  seedId,
  createMode,
  onClose,
  onSaved,
}: {
  seedId: string | null;
  createMode: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [data, setData] = useState<SeedDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [editMode, setEditMode] = useState(createMode);
  const [draft, setDraft] = useState<Partial<Seed>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [members, setMembers] = useState<MemberLite[]>([]);
  const [projects, setProjects] = useState<ProjectLite[]>([]);
  const [deepDiveOpen, setDeepDiveOpen] = useState(false);

  // メンバー + PJ 一覧を読む (lookup 用)
  useEffect(() => {
    const sb = createClient();
    Promise.all([
      sb.from("members").select("member_id, code_name").order("code_name"),
      sb.from("project_ventures").select("project_id, short_label, projects(project_name)"),
    ]).then(([m, p]) => {
      setMembers((m.data ?? []) as MemberLite[]);
      const rawProjects = (p.data ?? []) as unknown as RawProjectLite[];
      const projectList = rawProjects
        .map((row) => {
          const project = Array.isArray(row.projects) ? row.projects[0] : row.projects;
          return {
            project_id: row.project_id,
            project_name: project?.project_name?.trim() || row.project_id,
            short_label: row.short_label,
          };
        })
        .sort((a, b) => a.project_name.localeCompare(b.project_name));
      setProjects(projectList);
    });
  }, []);

  // 詳細データ読み込み
  useEffect(() => {
    if (createMode) {
      setData(null);
      setDraft({ status: "candidate", is_public: false });
      setEditMode(true);
      setNotFound(false);
      return;
    }
    if (!seedId) {
      setData(null);
      setNotFound(false);
      return;
    }
    setLoading(true);
    setNotFound(false);
    fetchSeedDetail(seedId)
      .then((d) => {
        if (!d) {
          setNotFound(true);
        } else {
          setData(d);
          setDraft(d.seed);
        }
      })
      .finally(() => setLoading(false));
  }, [seedId, createMode]);

  // ESC で閉じる
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // 背景スクロールロック
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const reload = async () => {
    if (!data?.seed.id && !seedId) return;
    const id = data?.seed.id ?? seedId!;
    const fresh = await fetchSeedDetail(id);
    if (fresh) {
      setData(fresh);
      setDraft(fresh.seed);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      if (createMode || !data) {
        if (!draft.title || !draft.org_name) {
          setError("シーズ名と機関名は必須");
          return;
        }
        const res = await insertSeed({
          title: draft.title,
          org_name: draft.org_name,
          ...draft,
        });
        if (!res.ok) {
          setError(res.error ?? "保存失敗");
          return;
        }
        onSaved();
        onClose();
      } else {
        const res = await updateSeed(data.seed.id, draft);
        if (!res.ok) {
          setError(res.error ?? "保存失敗");
          return;
        }
        await reload();
        setEditMode(false);
        onSaved();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!data) return;
    if (!confirm(`シーズ「${data.seed.title}」を削除します。よろしいですか?`)) return;
    setSaving(true);
    setError(null);
    try {
      const res = await deleteSeed(data.seed.id);
      if (!res.ok) {
        setError(res.error ?? "削除失敗");
        return;
      }
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-background border border-border rounded-lg shadow-xl max-w-[1200px] w-full my-4 p-5 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="閉じる"
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground text-sm w-7 h-7 rounded hover:bg-accent flex items-center justify-center"
        >
          ✕
        </button>

        {loading && <div className="py-10 text-center text-sm text-muted-foreground">読み込み中…</div>}
        {notFound && <div className="py-10 text-center text-sm">シーズが見つかりません</div>}

        {(createMode || data) && (
          <div className="space-y-5">
            {/* ヘッダー */}
            <div className="border-b border-border pb-3">
              {editMode ? (
                <input
                  className="text-lg font-semibold w-full bg-transparent border-b border-border focus:outline-none focus:border-primary py-1"
                  placeholder="シーズ名 (例: シアノバクテリア排水処理)"
                  value={draft.title ?? ""}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                />
              ) : (
                <h2 className="text-lg font-semibold">{data?.seed.title}</h2>
              )}
              <div className="flex items-center gap-2 mt-1.5 text-xs">
                {data && !editMode && (
                  <>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${SEED_STATUS_COLOR[data.seed.status] ?? ""}`}>
                      {SEED_STATUS_LABEL[data.seed.status] ?? data.seed.status}
                    </span>
                    {data.seed.spun_off_project_id && (
                      <span className="text-[10px] text-violet-600 dark:text-violet-300">
                        → {data.spun_off_project_name ?? data.seed.spun_off_project_id}
                      </span>
                    )}
                    <RatingDots r={data.seed.amd_rating} />
                    {data.amd_owner_code_name && (
                      <span className="text-muted-foreground">担当: {data.amd_owner_code_name}</span>
                    )}
                  </>
                )}
                <div className="ml-auto flex gap-2">
                  {!editMode && data && (
                    <>
                      <button
                        onClick={() => setEditMode(true)}
                        className="text-[11px] px-2 py-1 rounded border border-border hover:bg-accent"
                      >
                        編集
                      </button>
                      <button
                        onClick={handleDelete}
                        className="text-[11px] px-2 py-1 rounded border border-red-500/40 text-red-600 hover:bg-red-500/10"
                      >
                        削除
                      </button>
                    </>
                  )}
                  {editMode && (
                    <>
                      <button
                        disabled={saving}
                        onClick={handleSave}
                        className="text-[11px] px-3 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                      >
                        {saving ? "保存中…" : "保存"}
                      </button>
                      <button
                        onClick={() => {
                          if (createMode) {
                            onClose();
                          } else if (data) {
                            setDraft(data.seed);
                            setEditMode(false);
                            setError(null);
                          }
                        }}
                        className="text-[11px] px-2 py-1 rounded border border-border hover:bg-accent"
                      >
                        {createMode ? "閉じる" : "キャンセル"}
                      </button>
                    </>
                  )}
                </div>
              </div>
              {error && (
                <div className="mt-2 text-[11px] text-red-600 bg-red-500/10 px-2 py-1 rounded">{error}</div>
              )}
            </div>

            {/* 本文 */}
            {editMode ? (
              <SeedEditForm draft={draft} setDraft={setDraft} members={members} projects={projects} />
            ) : (
              data && <SeedReadView data={data} onOpenDeepDive={() => setDeepDiveOpen(true)} />
            )}

            {/* サブセクション (作成モードでは未生成のため非表示) */}
            {!createMode && data && (
              <>
                <SeedFundingSection seed={data.seed} funding={data.funding} onChanged={reload} />
                <SeedContactLogSection
                  seed={data.seed}
                  contactLog={data.contact_log}
                  members={members}
                  onChanged={reload}
                />
                <SeedNewsSection seed={data.seed} news={data.news} onChanged={reload} />
              </>
            )}
          </div>
        )}
      </div>

      {deepDiveOpen && data?.seed.deep_dive_material_url && (
        <SeedMarkdownPreviewModal
          open={deepDiveOpen}
          seedId={data.seed.id}
          seedTitle={data.seed.title}
          driveUrl={data.seed.deep_dive_material_url}
          onClose={() => setDeepDiveOpen(false)}
        />
      )}
    </div>
  );
}

function RatingDots({ r }: { r: number | null }) {
  const v = r ?? 0;
  return (
    <span className="whitespace-nowrap text-xs">
      <span className="text-amber-500">{"★".repeat(v)}</span>
      <span className="text-muted-foreground/40">{"☆".repeat(5 - v)}</span>
    </span>
  );
}

// =====================================================================
// 詳細表示 (read-only)
// =====================================================================

function SeedReadView({
  data,
  onOpenDeepDive,
}: {
  data: SeedDetail;
  onOpenDeepDive: () => void;
}) {
  const s = data.seed;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
      <Section title="シーズ概要">
        <KV label="概要">{s.summary || "—"}</KV>
        <KV label="領域">{s.domain_lane ? SEED_DOMAIN_LANE_LABEL[s.domain_lane] ?? s.domain_lane : "—"}</KV>
        <KV label="成熟度 (TRL/BRL/HRL)">
          <span className="font-mono">
            {s.trl ?? "·"} / {s.brl ?? "·"} / {s.hrl ?? "·"}
          </span>
        </KV>
        <KV label="応用先">{s.industry_target?.length ? s.industry_target.join(", ") : "—"}</KV>
        <KV label="キーワード">
          {s.keywords?.length ? (
            <span className="flex flex-wrap gap-1">
              {s.keywords.map((k) => (
                <span key={k} className="px-1.5 py-0.5 bg-muted rounded text-[10px]">{k}</span>
              ))}
            </span>
          ) : "—"}
        </KV>
      </Section>

      <Section title="機関 / 研究者">
        <KV label="機関">
          {s.org_url ? (
            <a className="underline hover:text-primary" href={s.org_url} target="_blank" rel="noreferrer">{s.org_name}</a>
          ) : s.org_name}
          {s.org_type ? ` (${SEED_ORG_TYPE_LABEL[s.org_type] ?? s.org_type})` : ""}
        </KV>
        <KV label="地域">{s.org_region || "—"}</KV>
        <KV label="PI">{s.researcher_name || "—"}{s.researcher_title ? ` (${s.researcher_title})` : ""}</KV>
        <KV label="研究室">{s.lab_name || "—"}</KV>
        <KV label="researcher URL">
          {s.researcher_url ? (
            <a className="underline hover:text-primary break-all" href={s.researcher_url} target="_blank" rel="noreferrer">{s.researcher_url}</a>
          ) : "—"}
        </KV>
      </Section>

      <Section title="AMD 評価">
        <KV label="ステータス">
          <span className={`px-1.5 py-0.5 rounded text-[10px] ${SEED_STATUS_COLOR[s.status] ?? ""}`}>
            {SEED_STATUS_LABEL[s.status] ?? s.status}
          </span>
        </KV>
        <KV label="★ 評価">
          <RatingDots r={s.amd_rating} />
          {s.amd_rating_note && <span className="text-muted-foreground ml-2">{s.amd_rating_note}</span>}
        </KV>
        <KV label="担当">{data.amd_owner_code_name || "—"}</KV>
        <KV label="次の一手">{s.next_action || "—"}</KV>
        <KV label="社内メモ"><span className="whitespace-pre-wrap">{s.internal_notes || "—"}</span></KV>
      </Section>

      <Section title="関連 / ソース">
        <KV label="PJ化 (spun off)">
          {s.spun_off_project_id ? (data.spun_off_project_name ?? s.spun_off_project_id) : "—"}
        </KV>
        <KV label="発見経路">
          {s.source ? SEED_SOURCE_LABEL[s.source] ?? s.source : "—"}
          {s.source_detail ? ` / ${s.source_detail}` : ""}
        </KV>
        <KV label="公開可">{s.is_public ? "Yes" : "No"}</KV>
        {s.public_summary && <KV label="公開要約">{s.public_summary}</KV>}
        <KV label="深掘り資料">
          {s.deep_dive_material_url ? (
            <button
              type="button"
              className="inline-flex items-center gap-1 underline hover:text-primary"
              onClick={(e) => {
                e.stopPropagation();
                onOpenDeepDive();
              }}
            >
              深掘り資料を開く
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          ) : "—"}
        </KV>
        <KV label="登録日">{s.created_at?.slice(0, 10)}</KV>
        <KV label="更新日">{s.updated_at?.slice(0, 10)}</KV>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-border rounded p-3">
      <h3 className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2 font-medium">{title}</h3>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function KV({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2 items-baseline">
      <span className="text-muted-foreground w-28 shrink-0 text-[10px]">{label}</span>
      <span className="flex-1 break-words">{children}</span>
    </div>
  );
}

// =====================================================================
// 編集 form
// =====================================================================

function SeedEditForm({
  draft,
  setDraft,
  members,
  projects,
}: {
  draft: Partial<Seed>;
  setDraft: (d: Partial<Seed>) => void;
  members: MemberLite[];
  projects: ProjectLite[];
}) {
  const update = <K extends keyof Seed>(k: K, v: Seed[K] | null | undefined) => {
    setDraft({ ...draft, [k]: v as Seed[K] });
  };
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
      {/* シーズ概要 */}
      <div className="space-y-2">
        <h3 className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">シーズ概要</h3>
        <Field label="概要">
          <textarea
            className="w-full px-2 py-1.5 rounded border border-border bg-background text-xs"
            rows={3}
            value={draft.summary ?? ""}
            onChange={(e) => update("summary", e.target.value || null)}
          />
        </Field>
        <Field label="領域">
          <select
            className="w-full px-2 py-1.5 rounded border border-border bg-background text-xs"
            value={draft.domain_lane ?? ""}
            onChange={(e) => update("domain_lane", (e.target.value || null) as Seed["domain_lane"])}
          >
            <option value="">—</option>
            {Object.entries(SEED_DOMAIN_LANE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-3 gap-2">
          <Field label="TRL"><NumInput value={draft.trl} onChange={(v) => update("trl", v)} /></Field>
          <Field label="BRL"><NumInput value={draft.brl} onChange={(v) => update("brl", v)} /></Field>
          <Field label="HRL"><NumInput value={draft.hrl} onChange={(v) => update("hrl", v)} /></Field>
        </div>
        <Field label="応用先 (カンマ区切り)">
          <input
            className="w-full px-2 py-1.5 rounded border border-border bg-background text-xs"
            value={(draft.industry_target ?? []).join(", ")}
            onChange={(e) => update("industry_target", strToArr(e.target.value))}
          />
        </Field>
        <Field label="キーワード (カンマ区切り)">
          <input
            className="w-full px-2 py-1.5 rounded border border-border bg-background text-xs"
            value={(draft.keywords ?? []).join(", ")}
            onChange={(e) => update("keywords", strToArr(e.target.value))}
          />
        </Field>
      </div>

      {/* 機関・PI */}
      <div className="space-y-2">
        <h3 className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">機関 / 研究者</h3>
        <Field label="機関名 *">
          <input
            className="w-full px-2 py-1.5 rounded border border-border bg-background text-xs"
            value={draft.org_name ?? ""}
            onChange={(e) => update("org_name", e.target.value)}
            placeholder="例: 愛媛大学"
          />
        </Field>
        <Field label="機関種別">
          <select
            className="w-full px-2 py-1.5 rounded border border-border bg-background text-xs"
            value={draft.org_type ?? ""}
            onChange={(e) => update("org_type", (e.target.value || null) as Seed["org_type"])}
          >
            <option value="">—</option>
            {Object.entries(SEED_ORG_TYPE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </Field>
        <Field label="地域">
          <input
            className="w-full px-2 py-1.5 rounded border border-border bg-background text-xs"
            value={draft.org_region ?? ""}
            onChange={(e) => update("org_region", e.target.value || null)}
            placeholder="例: 愛媛県松山市"
          />
        </Field>
        <Field label="機関URL">
          <input
            className="w-full px-2 py-1.5 rounded border border-border bg-background text-xs"
            value={draft.org_url ?? ""}
            onChange={(e) => update("org_url", e.target.value || null)}
          />
        </Field>
        <Field label="PI 氏名">
          <input
            className="w-full px-2 py-1.5 rounded border border-border bg-background text-xs"
            value={draft.researcher_name ?? ""}
            onChange={(e) => update("researcher_name", e.target.value || null)}
          />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="役職">
            <input
              className="w-full px-2 py-1.5 rounded border border-border bg-background text-xs"
              value={draft.researcher_title ?? ""}
              onChange={(e) => update("researcher_title", e.target.value || null)}
              placeholder="教授"
            />
          </Field>
          <Field label="研究室">
            <input
              className="w-full px-2 py-1.5 rounded border border-border bg-background text-xs"
              value={draft.lab_name ?? ""}
              onChange={(e) => update("lab_name", e.target.value || null)}
            />
          </Field>
        </div>
        <Field label="researcher URL (researchmap など)">
          <input
            className="w-full px-2 py-1.5 rounded border border-border bg-background text-xs"
            value={draft.researcher_url ?? ""}
            onChange={(e) => update("researcher_url", e.target.value || null)}
          />
        </Field>
      </div>

      {/* AMD 評価 */}
      <div className="space-y-2">
        <h3 className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">AMD 評価</h3>
        <Field label="ステータス">
          <select
            className="w-full px-2 py-1.5 rounded border border-border bg-background text-xs"
            value={draft.status ?? "candidate"}
            onChange={(e) => update("status", e.target.value as Seed["status"])}
          >
            {SEED_STATUS_ORDER.map((k) => (
              <option key={k} value={k}>{SEED_STATUS_LABEL[k]}</option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="★ 評価 (1-5)">
            <select
              className="w-full px-2 py-1.5 rounded border border-border bg-background text-xs"
              value={draft.amd_rating ?? ""}
              onChange={(e) => update("amd_rating", e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">—</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>{"★".repeat(n)}</option>
              ))}
            </select>
          </Field>
          <Field label="担当">
            <select
              className="w-full px-2 py-1.5 rounded border border-border bg-background text-xs"
              value={draft.amd_owner_member_id ?? ""}
              onChange={(e) => update("amd_owner_member_id", e.target.value || null)}
            >
              <option value="">—</option>
              {members.map((m) => (
                <option key={m.member_id} value={m.member_id}>{m.code_name}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="評価コメント">
          <input
            className="w-full px-2 py-1.5 rounded border border-border bg-background text-xs"
            value={draft.amd_rating_note ?? ""}
            onChange={(e) => update("amd_rating_note", e.target.value || null)}
          />
        </Field>
        <Field label="次の一手">
          <input
            className="w-full px-2 py-1.5 rounded border border-border bg-background text-xs"
            value={draft.next_action ?? ""}
            onChange={(e) => update("next_action", e.target.value || null)}
          />
        </Field>
        <Field label="社内メモ (非公開)">
          <textarea
            className="w-full px-2 py-1.5 rounded border border-border bg-background text-xs"
            rows={3}
            value={draft.internal_notes ?? ""}
            onChange={(e) => update("internal_notes", e.target.value || null)}
          />
        </Field>
      </div>

      {/* 関連 / ソース */}
      <div className="space-y-2">
        <h3 className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">関連 / ソース</h3>
        <Field label="PJ化 (spun off)">
          <select
            className="w-full px-2 py-1.5 rounded border border-border bg-background text-xs"
            value={draft.spun_off_project_id ?? ""}
            onChange={(e) => update("spun_off_project_id", e.target.value || null)}
          >
            <option value="">—</option>
            {projects.map((p) => (
              <option key={p.project_id} value={p.project_id}>
                {p.short_label ?? p.project_name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="発見経路">
          <select
            className="w-full px-2 py-1.5 rounded border border-border bg-background text-xs"
            value={draft.source ?? ""}
            onChange={(e) => update("source", (e.target.value || null) as Seed["source"])}
          >
            <option value="">—</option>
            {Object.entries(SEED_SOURCE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </Field>
        <Field label="経路詳細">
          <input
            className="w-full px-2 py-1.5 rounded border border-border bg-background text-xs"
            value={draft.source_detail ?? ""}
            onChange={(e) => update("source_detail", e.target.value || null)}
            placeholder="例: 田中先生からの紹介"
          />
        </Field>
        <Field label="深掘り資料リンク">
          <input
            className="w-full px-2 py-1.5 rounded border border-border bg-background text-xs"
            value={draft.deep_dive_material_url ?? ""}
            onChange={(e) => update("deep_dive_material_url", e.target.value || null)}
            placeholder="共有ドライブ上の資料リンク"
          />
        </Field>
        <Field label="公開可">
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={!!draft.is_public}
              onChange={(e) => update("is_public", e.target.checked)}
            />
            URA / EIR に開放可 (Phase 2 で使用)
          </label>
        </Field>
        <Field label="公開要約">
          <textarea
            className="w-full px-2 py-1.5 rounded border border-border bg-background text-xs"
            rows={2}
            value={draft.public_summary ?? ""}
            onChange={(e) => update("public_summary", e.target.value || null)}
          />
        </Field>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] text-muted-foreground block mb-0.5">{label}</label>
      {children}
    </div>
  );
}

function NumInput({ value, onChange }: { value: number | null | undefined; onChange: (v: number | null) => void }) {
  return (
    <input
      type="number"
      className="w-full px-2 py-1.5 rounded border border-border bg-background text-xs"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
      min={0}
      max={9}
    />
  );
}

function strToArr(s: string): string[] | null {
  const arr = s.split(",").map((x) => x.trim()).filter(Boolean);
  return arr.length > 0 ? arr : null;
}

// =====================================================================
// 補助金セクション
// =====================================================================

function SeedFundingSection({
  seed,
  funding,
  onChanged,
}: {
  seed: Seed;
  funding: SeedFunding[];
  onChanged: () => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState<Partial<SeedFunding>>({});
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!draft.program) return;
    setBusy(true);
    await insertSeedFunding({
      seed_id: seed.id,
      program: draft.program,
      program_short: draft.program_short ?? null,
      amount_jpy: draft.amount_jpy ?? null,
      fiscal_year: draft.fiscal_year ?? null,
      status: draft.status ?? null,
      source_url: draft.source_url ?? null,
      notes: draft.notes ?? null,
    });
    setBusy(false);
    setDraft({});
    setShowAdd(false);
    onChanged();
  };

  const remove = async (id: string) => {
    if (!confirm("削除しますか?")) return;
    await deleteSeedFunding(id);
    onChanged();
  };

  return (
    <div className="border border-border rounded p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">補助金履歴 ({funding.length})</h3>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="text-[10px] px-2 py-0.5 rounded border border-border hover:bg-accent"
        >
          {showAdd ? "閉じる" : "+ 追加"}
        </button>
      </div>

      {showAdd && (
        <div className="mb-3 p-2 bg-muted/30 rounded space-y-1.5 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <input
              className="px-2 py-1 rounded border border-border bg-background text-xs"
              placeholder="プログラム名 (例: NEDO 課題解決型)"
              value={draft.program ?? ""}
              onChange={(e) => setDraft({ ...draft, program: e.target.value })}
            />
            <input
              className="px-2 py-1 rounded border border-border bg-background text-xs"
              placeholder="略号 (NEDO / AMED / JST GAP)"
              value={draft.program_short ?? ""}
              onChange={(e) => setDraft({ ...draft, program_short: e.target.value })}
            />
            <input
              type="number"
              className="px-2 py-1 rounded border border-border bg-background text-xs"
              placeholder="金額 (円)"
              value={draft.amount_jpy ?? ""}
              onChange={(e) => setDraft({ ...draft, amount_jpy: e.target.value ? Number(e.target.value) : null })}
            />
            <input
              type="number"
              className="px-2 py-1 rounded border border-border bg-background text-xs"
              placeholder="採択年度"
              value={draft.fiscal_year ?? ""}
              onChange={(e) => setDraft({ ...draft, fiscal_year: e.target.value ? Number(e.target.value) : null })}
            />
            <select
              className="px-2 py-1 rounded border border-border bg-background text-xs"
              value={draft.status ?? ""}
              onChange={(e) => setDraft({ ...draft, status: (e.target.value || null) as SeedFundingStatus | null })}
            >
              <option value="">— 状態 —</option>
              {Object.entries(SEED_FUNDING_STATUS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <input
              className="px-2 py-1 rounded border border-border bg-background text-xs"
              placeholder="URL"
              value={draft.source_url ?? ""}
              onChange={(e) => setDraft({ ...draft, source_url: e.target.value })}
            />
          </div>
          <input
            className="w-full px-2 py-1 rounded border border-border bg-background text-xs"
            placeholder="メモ"
            value={draft.notes ?? ""}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
          />
          <button
            onClick={submit}
            disabled={busy}
            className="text-[11px] px-3 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {busy ? "追加中…" : "追加"}
          </button>
        </div>
      )}

      {funding.length === 0 ? (
        <div className="text-[11px] text-muted-foreground py-2">なし</div>
      ) : (
        <table className="w-full text-xs">
          <thead className="text-[10px] uppercase text-muted-foreground">
            <tr>
              <th className="px-1 py-1 text-left">プログラム</th>
              <th className="px-1 py-1 text-left w-16">年度</th>
              <th className="px-1 py-1 text-right w-20">金額</th>
              <th className="px-1 py-1 text-left w-16">状態</th>
              <th className="px-1 py-1 text-left">メモ</th>
              <th className="px-1 py-1 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {funding.map((f) => (
              <tr key={f.id} className="border-t border-border/40">
                <td className="px-1 py-1">
                  {f.program_short && (
                    <span className="text-[10px] text-muted-foreground mr-1">{f.program_short}</span>
                  )}
                  {f.source_url ? (
                    <a className="underline hover:text-primary" href={f.source_url} target="_blank" rel="noreferrer">{f.program}</a>
                  ) : f.program}
                </td>
                <td className="px-1 py-1 text-muted-foreground">{f.fiscal_year ?? "—"}</td>
                <td className="px-1 py-1 text-right">{f.amount_jpy ? formatJpy(f.amount_jpy) : "—"}</td>
                <td className="px-1 py-1 text-muted-foreground text-[10px]">{f.status ? SEED_FUNDING_STATUS_LABEL[f.status] ?? f.status : "—"}</td>
                <td className="px-1 py-1 text-muted-foreground text-[10px]">{f.notes ?? "—"}</td>
                <td className="px-1 py-1 text-right">
                  <button
                    onClick={() => remove(f.id)}
                    className="text-red-500 hover:text-red-700 text-[10px]"
                  >✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// =====================================================================
// 接触履歴セクション
// =====================================================================

function SeedContactLogSection({
  seed,
  contactLog,
  members,
  onChanged,
}: {
  seed: Seed;
  contactLog: (SeedContactLog & { amd_member_code_name?: string | null })[];
  members: MemberLite[];
  onChanged: () => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [draft, setDraft] = useState<Partial<SeedContactLog>>({ contacted_on: today });
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!draft.note || !draft.contacted_on) return;
    setBusy(true);
    await insertSeedContactLog({
      seed_id: seed.id,
      contacted_on: draft.contacted_on,
      method: draft.method ?? null,
      amd_member_id: draft.amd_member_id ?? null,
      note: draft.note,
      next_action: draft.next_action ?? null,
    });
    setBusy(false);
    setDraft({ contacted_on: today });
    setShowAdd(false);
    onChanged();
  };

  const remove = async (id: string) => {
    if (!confirm("削除しますか?")) return;
    await deleteSeedContactLog(id);
    onChanged();
  };

  return (
    <div className="border border-border rounded p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">接触履歴 ({contactLog.length})</h3>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="text-[10px] px-2 py-0.5 rounded border border-border hover:bg-accent"
        >
          {showAdd ? "閉じる" : "+ 追加"}
        </button>
      </div>

      {showAdd && (
        <div className="mb-3 p-2 bg-muted/30 rounded space-y-1.5 text-xs">
          <div className="grid grid-cols-3 gap-2">
            <input
              type="date"
              className="px-2 py-1 rounded border border-border bg-background text-xs"
              value={draft.contacted_on ?? today}
              onChange={(e) => setDraft({ ...draft, contacted_on: e.target.value })}
            />
            <select
              className="px-2 py-1 rounded border border-border bg-background text-xs"
              value={draft.method ?? ""}
              onChange={(e) => setDraft({ ...draft, method: (e.target.value || null) as SeedContactMethod | null })}
            >
              <option value="">— 方法 —</option>
              {Object.entries(SEED_CONTACT_METHOD_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <select
              className="px-2 py-1 rounded border border-border bg-background text-xs"
              value={draft.amd_member_id ?? ""}
              onChange={(e) => setDraft({ ...draft, amd_member_id: e.target.value || null })}
            >
              <option value="">— 担当 —</option>
              {members.map((m) => (
                <option key={m.member_id} value={m.member_id}>{m.code_name}</option>
              ))}
            </select>
          </div>
          <textarea
            className="w-full px-2 py-1 rounded border border-border bg-background text-xs"
            rows={2}
            placeholder="内容"
            value={draft.note ?? ""}
            onChange={(e) => setDraft({ ...draft, note: e.target.value })}
          />
          <input
            className="w-full px-2 py-1 rounded border border-border bg-background text-xs"
            placeholder="次の一手 (optional)"
            value={draft.next_action ?? ""}
            onChange={(e) => setDraft({ ...draft, next_action: e.target.value })}
          />
          <button
            onClick={submit}
            disabled={busy}
            className="text-[11px] px-3 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {busy ? "追加中…" : "追加"}
          </button>
        </div>
      )}

      {contactLog.length === 0 ? (
        <div className="text-[11px] text-muted-foreground py-2">なし</div>
      ) : (
        <ul className="space-y-2 text-xs">
          {contactLog.map((c) => (
            <li key={c.id} className="border-l-2 border-emerald-500/40 pl-2 relative">
              <button
                onClick={() => remove(c.id)}
                className="absolute right-0 top-0 text-red-500 hover:text-red-700 text-[10px]"
              >✕</button>
              <div className="text-[10px] text-muted-foreground">
                {c.contacted_on}
                {c.method && ` / ${SEED_CONTACT_METHOD_LABEL[c.method] ?? c.method}`}
                {c.amd_member_code_name && ` / ${c.amd_member_code_name}`}
              </div>
              <div className="whitespace-pre-wrap">{c.note}</div>
              {c.next_action && (
                <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">→ {c.next_action}</div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// =====================================================================
// ニュースセクション
// =====================================================================

function SeedNewsSection({
  seed,
  news,
  onChanged,
}: {
  seed: Seed;
  news: SeedNews[];
  onChanged: () => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState<Partial<SeedNews>>({ kind: "publication" });
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!draft.title || !draft.kind) return;
    setBusy(true);
    await insertSeedNews({
      seed_id: seed.id,
      kind: draft.kind,
      title: draft.title,
      body: draft.body ?? null,
      occurred_on: draft.occurred_on ?? null,
      source_url: draft.source_url ?? null,
      ingested_by: "manual",
      verified: true,
      dismissed: false,
    });
    setBusy(false);
    setDraft({ kind: "publication" });
    setShowAdd(false);
    onChanged();
  };

  const remove = async (id: string) => {
    if (!confirm("削除しますか?")) return;
    await deleteSeedNews(id);
    onChanged();
  };

  return (
    <div className="border border-border rounded p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">ニュース・論文・プレス ({news.length})</h3>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="text-[10px] px-2 py-0.5 rounded border border-border hover:bg-accent"
        >
          {showAdd ? "閉じる" : "+ 追加"}
        </button>
      </div>

      {showAdd && (
        <div className="mb-3 p-2 bg-muted/30 rounded space-y-1.5 text-xs">
          <div className="grid grid-cols-3 gap-2">
            <select
              className="px-2 py-1 rounded border border-border bg-background text-xs"
              value={draft.kind ?? "publication"}
              onChange={(e) => setDraft({ ...draft, kind: e.target.value as SeedNewsKind })}
            >
              {Object.entries(SEED_NEWS_KIND_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <input
              type="date"
              className="px-2 py-1 rounded border border-border bg-background text-xs"
              value={draft.occurred_on ?? ""}
              onChange={(e) => setDraft({ ...draft, occurred_on: e.target.value || null })}
            />
            <input
              className="px-2 py-1 rounded border border-border bg-background text-xs"
              placeholder="URL"
              value={draft.source_url ?? ""}
              onChange={(e) => setDraft({ ...draft, source_url: e.target.value })}
            />
          </div>
          <input
            className="w-full px-2 py-1 rounded border border-border bg-background text-xs"
            placeholder="タイトル"
            value={draft.title ?? ""}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />
          <textarea
            className="w-full px-2 py-1 rounded border border-border bg-background text-xs"
            rows={2}
            placeholder="要約 / 本文 (任意)"
            value={draft.body ?? ""}
            onChange={(e) => setDraft({ ...draft, body: e.target.value })}
          />
          <button
            onClick={submit}
            disabled={busy}
            className="text-[11px] px-3 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {busy ? "追加中…" : "追加"}
          </button>
        </div>
      )}

      {news.length === 0 ? (
        <div className="text-[11px] text-muted-foreground py-2">なし</div>
      ) : (
        <ul className="space-y-1.5 text-xs">
          {news.map((n) => (
            <li key={n.id} className="flex items-start gap-2 group">
              <span className="text-[9px] px-1 py-0.5 rounded bg-muted text-muted-foreground shrink-0 mt-0.5">
                {SEED_NEWS_KIND_LABEL[n.kind] ?? n.kind}
              </span>
              <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">
                {n.occurred_on ?? "—"}
              </span>
              <span className="flex-1 break-words">
                {n.source_url ? (
                  <a className="underline hover:text-primary" href={n.source_url} target="_blank" rel="noreferrer">{n.title}</a>
                ) : n.title}
                {n.body && <div className="text-[10px] text-muted-foreground mt-0.5">{n.body}</div>}
              </span>
              <button
                onClick={() => remove(n.id)}
                className="text-red-500 hover:text-red-700 text-[10px] opacity-0 group-hover:opacity-100"
              >✕</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
