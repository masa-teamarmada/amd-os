import type { ProjectPocListData } from "./project-poc-list";
import type { TechEntry } from "./project-tech";

/** 開示用の省略済みデータを書き戻さず、既存の編集権限で取得した完全な行を使う。 */
export function pocEditableEntries(projectId: string, display: ProjectPocListData, editor?: ProjectPocListData | null): Record<string, TechEntry> {
  if (!editor?.canEdit || editor.audience !== "internal") return {};
  const sources = new Map(editor.entries.map(entry => [entry.tech_entry_id, entry]));
  return Object.fromEntries(display.entries.flatMap(entry => {
    const id = editor.editEntryIds?.[entry.tech_entry_id];
    const source = id ? sources.get(id) : undefined;
    return source && entry.project_id === projectId && source.project_id === projectId && source.tech_topic_id === entry.tech_topic_id
      ? [[entry.tech_entry_id, source]] : [];
  }));
}
