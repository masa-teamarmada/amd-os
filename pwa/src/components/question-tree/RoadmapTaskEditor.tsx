"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ActionNode } from "@/lib/question-tree-types";
import type { GanttRoadmapPhase, ProjectGanttRoadmap, RoadmapWorkItem } from "@/lib/project-gantt-roadmap";
import tree from "./question-tree.module.css";
import styles from "./meeting-roadmap.module.css";

export type RoadmapTaskMutation = (method: "POST" | "PATCH", body: Record<string, unknown>) => Promise<void>;

export function RoadmapTaskEditor({ phase, roadmap, actions, phaseItems, onSave, onClose }: {
  phase: GanttRoadmapPhase;
  roadmap: ProjectGanttRoadmap;
  actions: ActionNode[];
  phaseItems: { id: string; items: RoadmapWorkItem[] }[];
  onSave: RoadmapTaskMutation;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"create" | "link">("create");
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panel = useRef<HTMLElement>(null);
  const saving = useRef(false);
  const close = useRef(onClose);
  close.current = onClose;
  const headingId = useId();
  const phaseByAction = useMemo(() => {
    const map = new Map<string, string>();
    const visit = (item: RoadmapWorkItem, phaseId: string) => {
      if (item.action) map.set(item.id, phaseId);
      item.children.forEach(child => visit(child, phaseId));
    };
    phaseItems.forEach(p => p.items.forEach(item => visit(item, p.id)));
    return map;
  }, [phaseItems]);
  const eligible = useMemo(() => {
    const byId = new Map(actions.map(a => [a.id, a]));
    return actions.filter(action => {
      const seen = new Set<string>();
      for (let node: ActionNode | undefined = action; node; node = node.parentId ? byId.get(node.parentId) : undefined) {
        if (node.isProposed || seen.has(node.id)) return false;
        seen.add(node.id);
      }
      return true;
    });
  }, [actions]);
  const visible = eligible.filter(action => !action.isProposed && action.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const selection = actions.find(action => action.id === selected);
  const currentPhase = selected ? phaseByAction.get(selected) : undefined;
  const samePhase = currentPhase === phase.id;
  const currentTitle = roadmap.phases.find(p => p.id === currentPhase)?.title;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.querySelector<HTMLInputElement>("input")?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault(); event.stopPropagation();
        if (!saving.current) close.current();
      }
      if (event.key !== "Tab") return;
      const controls = Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"]') ?? []);
      const first = controls[0], last = controls.at(-1);
      if (!first) { event.preventDefault(); panel.current?.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || !panel.current?.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !panel.current?.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keydown, true);
    return () => { document.removeEventListener("keydown", keydown, true); document.body.style.overflow = previousOverflow; previous?.focus(); };
  }, []);

  const save = async (detach = false) => {
    if (saving.current) return;
    setError(null);
    if (mode === "create" && !title.trim()) { setError("タスク名が未入力"); return; }
    if (mode === "create" && start && !end) { setError("開始日を指定する場合は終了日も必要"); return; }
    if (mode === "create" && start && end && start > end) { setError("終了日は開始日以降を指定"); return; }
    if (mode === "link" && !selection) { setError("タスクが未選択"); return; }
    saving.current = true; setBusy(true);
    try {
      await onSave(mode === "create" ? "POST" : "PATCH", mode === "create"
        ? { resource: "action", fields: {title: title.trim(), action_kind: "work", planned_start: start || null, planned_end: end || null, gantt_phase_id: phase.id} }
        : { resource: "action", id: selected, fields: {gantt_phase_id: detach ? null : phase.id} });
      onClose();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "保存できなかったため、再試行が必要"); }
    finally { saving.current = false; setBusy(false); }
  };

  return createPortal(<div className={tree.backdrop} onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section ref={panel} className={`${tree.panel} ${styles.taskEditor}`} role="dialog" aria-modal="true" aria-labelledby={headingId} tabIndex={-1}>
      <header className={tree.panelHead}>
        <div className={tree.panelTitle}><span className={styles.editorEyebrow}>タスク追加・紐づけ</span><h3 id={headingId}>{phase.title}</h3></div>
        <button type="button" className={tree.panelClose} aria-label="閉じる" disabled={busy} onClick={onClose}>×</button>
      </header>
      <div className={tree.panelBody}>
        <div className={styles.editorModes} role="group" aria-label="追加方法">
          <button type="button" className={tree.btn} aria-pressed={mode === "create"} disabled={busy} onClick={() => { setMode("create"); setError(null); }}>新しく作る</button>
          <button type="button" className={tree.btn} aria-pressed={mode === "link"} disabled={busy} onClick={() => { setMode("link"); setError(null); }}>既存から選ぶ</button>
        </div>
        <form className={`${tree.form} ${styles.editorForm}`} onSubmit={event => { event.preventDefault(); void save(); }}>
          {mode === "create" ? <>
            <label>タスク名<input value={title} onChange={e => setTitle(e.target.value)} disabled={busy} required maxLength={500} /></label>
            <div className={tree.formRow}>
              <label>開始日（任意）<input type="date" value={start} max={end || undefined} onChange={e => setStart(e.target.value)} disabled={busy} /></label>
              <label>終了日（任意）<input type="date" value={end} min={start || undefined} onChange={e => setEnd(e.target.value)} disabled={busy} /></label>
            </div>
            <p className={styles.editorHint}>日程はあとから設定できる。工程の期間は子タスクの日程から集計する。</p>
          </> : <>
            <label>タスクを検索<input type="search" value={query} onChange={e => { setQuery(e.target.value); setSelected(""); }} disabled={busy} placeholder="タスク名で検索" /></label>
            <div className={styles.taskChoices} role="group" aria-label="既存タスク">
              {visible.map(action => {
                const from = phaseByAction.get(action.id);
                const fromTitle = roadmap.phases.find(p => p.id === from)?.title;
                return <label key={action.id} className={styles.taskChoice}>
                  <input type="radio" name={headingId} value={action.id} checked={selected === action.id} onChange={() => setSelected(action.id)} disabled={busy} />
                  <span><strong>{action.title}</strong><small>{fromTitle ?? "工程未設定"}{action.children.some(c => !c.isProposed) ? " · 子タスクあり" : ""}</small></span>
                </label>;
              })}
              {!visible.length && <p className={styles.editorHint}>{query ? "一致するタスクなし" : "承認済みタスクなし"}</p>}
            </div>
            <p className={styles.editorHint}>ゴールツリー・タスクで作った承認済みのタスクから選べる。提案中のタスクは、承認後にここへ表示される。</p>
            {selection && <p className={styles.editorHint}>{samePhase ? "この工程に紐づいている。解除してもタスクとゴールツリーの関係は残る。" : currentTitle ? `「${currentTitle}」からこの工程へ移動する。` : "この工程に紐づける。"}{selection.children.some(c => !c.isProposed) ? " 子タスクも一緒に扱う（別の工程を指定済みの子を除く）。" : ""}</p>}
          </>}
          {error && <p role="alert" className={styles.editorError}>{error}</p>}
          <div className={styles.editorActions}>
            {mode === "link" && samePhase ? <button type="button" className={tree.btn} disabled={busy} onClick={() => void save(true)}>{busy ? "保存中…" : "紐づけを外す"}</button>
              : <button type="submit" className={`${tree.btn} ${styles.primaryAction}`} disabled={busy || (mode === "link" && !selected)}>{busy ? "保存中…" : mode === "create" ? "作成する" : currentPhase ? "この工程に移動" : "この工程に紐づける"}</button>}
            <button type="button" className={tree.btn} disabled={busy} onClick={onClose}>キャンセル</button>
          </div>
        </form>
      </div>
    </section>
  </div>, document.body);
}
