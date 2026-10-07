"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { type ProperNounEntry, type ProperNounResponse } from "@/lib/project-proper-nouns";

type EditableRow = { id: string; canonical: string; aliases: string; kind: ProperNounEntry["kind"] };
const control = "min-h-11 w-full min-w-0 rounded-lg border border-[#d2d2d7] bg-white px-3 py-2 text-sm font-normal text-[#1d1d1f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007aff] disabled:bg-[#f5f5f7] disabled:text-[#6e6e73]";
const secondary = "min-h-11 rounded-lg border border-[#d2d2d7] px-3 py-2 text-sm font-medium hover:bg-[#f5f5f7] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007aff] disabled:opacity-50";

export function CockpitProperNouns({ projectId, readOnly = false }: { projectId: string; readOnly?: boolean }) {
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [invalidTarget, setInvalidTarget] = useState<{ row: number; field: string } | null>(null);
  const [focusTarget, setFocusTarget] = useState<{ row: number; field: string } | null>(null);
  const nextId = useRef(0);
  const rowRefs = useRef<Array<HTMLDivElement | null>>([]);
  const url = `/api/project/${encodeURIComponent(projectId)}/proper-nouns`;

  function applyResponse(data: ProperNounResponse) {
    setRows(data.dictionary.entries.map(entry => ({ ...entry, id: `proper-noun-${nextId.current++}`, aliases: entry.aliases.join("\n") })));
    setUpdatedAt(data.dictionary.updatedAt);
    setCanEdit(data.canEdit && !readOnly);
    setLoaded(true);
  }
  async function reload(signal?: AbortSignal) {
    setLoading(true); setError(""); setInvalidTarget(null); setSaved(false); setLoaded(false);
    try {
      const response = await fetch(url, { cache: "no-store", signal });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "固有名詞を読み込めません。");
      if (!signal?.aborted) applyResponse(data);
    } catch (reason) {
      if (!signal?.aborted) setError(reason instanceof Error ? reason.message : "固有名詞を読み込めません。");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }
  useEffect(() => {
    const controller = new AbortController();
    void reload(controller.signal);
    return () => controller.abort();
    // PJが変わると再マウントする。編集中の入力を再読込みで上書きしない。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  useEffect(() => {
    if (saving || !focusTarget) return;
    const row = rowRefs.current[focusTarget.row];
    row?.scrollIntoView({ block: "nearest" });
    row?.querySelector<HTMLElement>(`[data-field="${focusTarget.field}"]`)?.focus();
    setFocusTarget(null);
  }, [saving, focusTarget]);

  function change(id: string, patch: Partial<EditableRow>) {
    setRows(current => current.map(row => row.id === id ? { ...row, ...patch } : row));
    setSaved(false); setError(""); setInvalidTarget(null);
  }
  async function save() {
    setSaving(true); setError(""); setInvalidTarget(null); setSaved(false);
    try {
      const entries = rows.map(row => ({ canonical: row.canonical, kind: row.kind, aliases: row.aliases.split(/\r?\n/).map(alias => alias.trim()).filter(Boolean) }));
      const response = await fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entries, expectedUpdatedAt: updatedAt }) });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        if (typeof data.row === "number") {
          const field = ["canonical", "aliases", "kind"].includes(data.field) ? data.field : "canonical";
          setFocusTarget({ row: data.row, field });
          setInvalidTarget({ row: data.row, field });
        }
        throw new Error(data.error || "固有名詞を保存できません。");
      }
      applyResponse(data);
      setSaved(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "固有名詞を保存できません。");
    } finally { setSaving(false); }
  }
  const editable = canEdit && loaded && !loading;
  return <section className="rounded-xl border border-[#e5e5e7] bg-white p-4 sm:p-6">
    <header className="mb-4"><h2 className="text-lg font-semibold text-[#1d1d1f]">固有名詞</h2><p className="mt-1 text-sm text-[#6e6e73]">議事録に使う正しい表記と、読み違い・旧表記を登録する。</p></header>
    <div className="space-y-4">
      <p className="text-sm leading-6 text-[#6e6e73]">このプロジェクトの議事録に適用される。旧表記は1行に1つ入力してください。過去の議事録は保存だけでは変更されない。</p>
      {error && !invalidTarget && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"><p>{error}</p><button type="button" disabled={saving || loading} onClick={() => void reload()} className={secondary}>再読み込み</button></div>}
      {loading ? <p role="status" className="text-sm text-[#6e6e73]">読み込み中…</p> : loaded && <>
        <div className="divide-y divide-[#e5e5e7]">
          {rows.map((row, index) => <div key={row.id} ref={node => { rowRefs.current[index] = node; }} className="grid items-start gap-3 py-4 sm:grid-cols-[7rem_1fr_1.25fr_44px]" data-proper-noun-row>
            <label className="min-w-0 space-y-1 text-xs font-medium text-[#6e6e73]">種類<select data-field="kind" aria-invalid={invalidTarget?.row === index && invalidTarget.field === "kind"} value={row.kind} disabled={!editable || saving} onChange={event => change(row.id, { kind: event.target.value as ProperNounEntry["kind"] })} className={control}><option value="person">人物</option><option value="organization">企業・組織</option><option value="other">その他</option></select></label>
            <label className="min-w-0 space-y-1 text-xs font-medium text-[#6e6e73]">正しい表記<input data-field="canonical" aria-invalid={invalidTarget?.row === index && invalidTarget.field === "canonical"} value={row.canonical} maxLength={120} disabled={!editable || saving} onChange={event => change(row.id, { canonical: event.target.value })} className={control} aria-label={`${index + 1}行目の正しい表記`} /></label>
            <label className="min-w-0 space-y-1 text-xs font-medium text-[#6e6e73]">読み違い・旧表記<textarea data-field="aliases" aria-invalid={invalidTarget?.row === index && invalidTarget.field === "aliases"} value={row.aliases} rows={Math.min(4, Math.max(2, row.aliases.split("\n").length))} disabled={!editable || saving} onChange={event => change(row.id, { aliases: event.target.value })} className={`${control} resize-y`} aria-label={`${index + 1}行目の読み違い・旧表記`} /></label>
            {editable && <button type="button" disabled={saving} aria-label={`${row.canonical || `${index + 1}行目`}を削除`} onClick={() => { setRows(current => current.filter(item => item.id !== row.id)); setSaved(false); setError(""); setInvalidTarget(null); }} className="grid h-11 w-11 place-items-center rounded-lg border border-[#d2d2d7] text-[#6e6e73] hover:bg-red-50 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007aff] sm:mt-5"><Trash2 className="h-4 w-4" aria-hidden="true" /></button>}
            {invalidTarget?.row === index && error && <p role="alert" className="text-sm text-red-800 sm:col-span-4">{error}</p>}
          </div>)}
        </div>
        {!rows.length && <p className="py-4 text-sm text-[#6e6e73]">固有名詞は未登録です。</p>}
        {editable && <button type="button" disabled={saving || rows.length >= 200} className={`${secondary} inline-flex items-center gap-2`} onClick={() => { setRows(current => [...current, { id: `proper-noun-${nextId.current++}`, canonical: "", aliases: "", kind: "other" }]); setSaved(false); }}><Plus className="h-4 w-4" aria-hidden="true" />固有名詞を追加</button>}
      </>}
    </div>
    <footer className="mt-6 border-t border-[#e5e5e7] pt-4"><div className="flex flex-wrap items-center justify-between gap-3">
      <div aria-live="polite" className="text-sm text-[#6e6e73]">{saving ? "保存中…" : saved ? "保存しました。次回の議事録生成から使用されます。" : loaded && !canEdit ? "閲覧のみ" : "変更したら保存してください。"}</div>
      {editable && <button type="button" disabled={saving} onClick={save} className="min-h-11 rounded-lg bg-[#0066cc] px-5 py-2 text-sm font-medium text-white hover:bg-[#0055aa] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007aff] disabled:opacity-50">{saving ? "保存中…" : "保存"}</button>}
    </div></footer>
  </section>;
}
