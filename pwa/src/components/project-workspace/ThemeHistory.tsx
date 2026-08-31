"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { parseThemeHistory, type ThemeHistoryRow, type ThemeHistorySource } from "@/lib/project-theme-history";
import styles from "./theme-history.module.css";

export type HistorySourceOption = ThemeHistorySource & { label: string; onOpen: () => void };
const COLUMNS = [
  ["initial", "当初の狙い"], ["developments", "動き・結果"],
  ["current", "現在地"], ["next", "次の確認"],
] as const;

export function ThemeHistory({ rows, canManage, sources, onSave, onRefresh }: {
  rows: ThemeHistoryRow[];
  canManage: boolean;
  sources: HistorySourceOption[];
  onSave: (rows: ThemeHistoryRow[]) => Promise<void>;
  onRefresh: () => Promise<void>;
}) {
  const [editing, setEditing] = useState<ThemeHistoryRow | null>(null);
  const [original, setOriginal] = useState<ThemeHistoryRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceSearch, setSourceSearch] = useState("");
  function edit(row?: ThemeHistoryRow) {
    const value = row ?? { id: crypto.randomUUID(), topic: "", initial: "", developments: "", current: "", next: "", asOf: null, sourceNote: "", sources: [] };
    setEditing(value); setOriginal(value); setError(null); setSourceSearch(""); setSaved(false);
  }
  function close() {
    if (saving) return;
    if (JSON.stringify(editing) !== JSON.stringify(original) && !window.confirm("保存していない変更を破棄して閉じる？")) return;
    setEditing(null);
  }
  async function save() {
    if (!editing || saving) return;
    setError(null);
    try {
      const next = parseThemeHistory(rows.some(row => row.id === editing.id)
        ? rows.map(row => row.id === editing.id ? editing : row) : [...rows, editing]);
      setSaving(true);
      if (!saved) {
        await onSave(next);
        setSaved(true);
        setOriginal(editing);
      }
      await onRefresh();
      setEditing(null);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "保存できなかったよ"); }
    finally { setSaving(false); }
  }
  const sourceMap = new Map(sources.map(source => [`${source.kind}:${source.id}`, source]));
  const visibleSources = sources.filter(source => source.label.toLowerCase().includes(sourceSearch.toLowerCase()));

  return <section className={styles.section} aria-label="これまでの流れ">
    <div className={styles.header}>
      <h4>これまでの流れ</h4>
      {canManage && <Button size="sm" variant="outline" disabled={rows.length >= 40} onClick={() => edit()}>経緯を追加</Button>}
    </div>
    {!rows.length ? <p className={styles.empty}>経緯はまだ整理されていないよ。連携先・応募・計画変更など、追いたい対象ごとにまとめてね。</p> :
      <table className={styles.table}>
        <thead><tr><th scope="col">対象・記録時点</th>{COLUMNS.map(([key, label]) => <th key={key} scope="col">{label}</th>)}</tr></thead>
        <tbody>{rows.map(row => <tr key={row.id}>
          <th scope="row">
            <strong>{row.topic}</strong>
            <div className={styles.sources}>
              <details><summary>記録 {row.asOf ? row.asOf.replaceAll("-", "/") : "時点未確認"}・出典{row.sources.length}</summary>
              {row.sourceNote && <span className={styles.meta}>{row.sourceNote}</span>}
              {row.sources.map(source => {
                const option = sourceMap.get(`${source.kind}:${source.id}`);
                return option ? <button key={`${source.kind}:${source.id}`} type="button" title={option.label} onClick={option.onOpen}>{option.label}</button>
                  : <span key={`${source.kind}:${source.id}`} className={styles.meta}>元記録は未接続・閲覧不可</span>;
              })}
              </details>
              {canManage && <button type="button" onClick={() => edit(row)} aria-label={`${row.topic}の経緯を編集`}>編集</button>}
            </div>
          </th>
          {COLUMNS.map(([key, label]) => <td key={key} data-label={label}><span className={row[key] ? undefined : styles.empty}>{row[key] || "未確認"}</span></td>)}
        </tr>)}</tbody>
      </table>}
    {canManage && editing && <Dialog open onOpenChange={open => !open && close()}>
      <DialogContent className={styles.dialog}>
        <DialogHeader><DialogTitle>経緯を編集</DialogTitle><DialogDescription>当初から今までの変化をまとめる。未確認の結果は未確認のまま残してね。</DialogDescription></DialogHeader>
        <form id="theme-history-form" className={styles.form} onSubmit={event => { event.preventDefault(); void save(); }}>
          <label className={styles.topic}>対象<Input autoFocus required maxLength={100} value={editing.topic} disabled={saving || saved} onChange={event => setEditing({ ...editing, topic: event.target.value })} /></label>
          <label>記録時点<Input type="date" value={editing.asOf ?? ""} disabled={saving || saved} onChange={event => setEditing({ ...editing, asOf: event.target.value || null })} /></label>
          {COLUMNS.map(([key, label]) => <label key={key} className={key === "developments" ? styles.developments : undefined}>{label}
            <Textarea rows={key === "developments" ? 4 : 2} maxLength={key === "developments" ? 1600 : 500} value={editing[key]} disabled={saving || saved} onChange={event => setEditing({ ...editing, [key]: event.target.value })} />
          </label>)}
          <label className={styles.wide}>確認範囲・未確認事項<Input maxLength={500} value={editing.sourceNote} disabled={saving || saved} onChange={event => setEditing({ ...editing, sourceNote: event.target.value })} /></label>
          <fieldset className={styles.sourcePicker} disabled={saving || saved}>
            <legend>元のMTG・資料</legend>
            <Input aria-label="元記録を検索" placeholder="このテーマのMTG・資料を検索" value={sourceSearch} onChange={event => setSourceSearch(event.target.value)} />
            <div className={styles.sourceList}>
              {visibleSources.map(source => {
                const selected = editing.sources.some(s => s.kind === source.kind && s.id === source.id);
                return <label key={`${source.kind}:${source.id}`}><input type="checkbox" checked={selected} disabled={!selected && editing.sources.length >= 12} onChange={() => setEditing({ ...editing, sources: selected ? editing.sources.filter(s => s.kind !== source.kind || s.id !== source.id) : [...editing.sources, { kind: source.kind, id: source.id }] })} />{source.label}</label>;
              })}
              {!visibleSources.length && <p className={styles.empty}>対象なし。元記録は先にこのテーマへひもづけてね。</p>}
              {editing.sources.filter(source => !sourceMap.has(`${source.kind}:${source.id}`)).map(source => <label key={`${source.kind}:${source.id}`}><input type="checkbox" checked onChange={() => setEditing({ ...editing, sources: editing.sources.filter(s => s.kind !== source.kind || s.id !== source.id) })} />未接続・閲覧不可の元記録（外すにはチェック解除）</label>)}
            </div>
          </fieldset>
          {error && <p className={styles.error} role="alert">{error}</p>}
        </form>
        <DialogFooter><Button variant="outline" onClick={close} disabled={saving}>{saved ? "閉じる" : "キャンセル"}</Button><Button type="submit" form="theme-history-form" disabled={saving}>{saving ? (saved ? "読込中…" : "保存中…") : saved ? "最新を読み込む" : "保存"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>}
  </section>;
}
