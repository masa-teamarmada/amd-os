"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AmieEffluentLedger } from "@/components/cockpit/AmieEffluentLedger";
import { loadProjectPocList, peekProjectPocList } from "@/lib/project-poc-list-client";
import type { ProjectPocListData } from "@/lib/project-poc-list";
import { pocEditableEntries } from "@/lib/project-poc-editing";

/** DDの表示範囲を保ち、内部の編集者は同じセルから社内正本を更新する。 */
export function ProjectPocList({ projectId, initialData, sharedView = false, enableEditing = false }: {
  projectId: string;
  initialData?: ProjectPocListData;
  sharedView?: boolean;
  enableEditing?: boolean;
}) {
  const router = useRouter();
  const [loaded, setLoaded] = useState<{ projectId: string; data: ProjectPocListData } | null>(null);
  const [error, setError] = useState<{ projectId: string; message: string } | null>(null);
  const load = useCallback(async (force = false) => {
    if (initialData && !enableEditing) return;
    try {
      setError(null);
      const data = await loadProjectPocList(projectId, initialData ? false : sharedView, force);
      setLoaded({ projectId, data });
      if (force && initialData) router.refresh();
    } catch (e) {
      setError({ projectId, message: e instanceof Error ? e.message : "読込エラー" });
    }
  }, [projectId, initialData, sharedView, enableEditing, router]);
  useEffect(() => {
    if (initialData && !enableEditing) return;
    let cancelled = false;
    loadProjectPocList(projectId, initialData ? false : sharedView)
      .then(data => { if (!cancelled) setLoaded({ projectId, data }); })
      .catch(e => { if (!cancelled) setError({ projectId, message: e instanceof Error ? e.message : "読込エラー" }); });
    return () => { cancelled = true; };
  }, [projectId, sharedView, initialData, enableEditing]);

  const data = initialData ?? (loaded?.projectId === projectId ? loaded.data : peekProjectPocList(projectId, sharedView) ?? null);
  const editor = loaded?.projectId === projectId ? loaded.data : null;
  const editableEntries = initialData ? pocEditableEntries(projectId, initialData, enableEditing ? editor : null) : undefined;
  const canEdit = initialData ? Object.keys(editableEntries ?? {}).length > 0 : data?.canEdit === true;
  const message = error?.projectId === projectId ? error.message : "";
  return <section className="min-w-0 space-y-3" data-testid="project-poc-list">
    <header className="border-b border-border pb-3">
      <h2 className="text-base font-semibold">PoCリスト</h2>
      <p className="mt-1 text-xs text-muted-foreground">入手元・成分・処理前後の変化・実験結果と状態を比較する。</p>
      {canEdit && <p className="mt-1 text-xs text-sky-700">セルをクリックして編集・保存</p>}
    </header>
    {message ? <p role="alert" className="text-sm text-rose-700">{message}<button className="ml-3 min-h-11 text-sky-700 underline" onClick={() => void load(true)}>再読込</button></p>
      : !data ? <div role="status" className="space-y-2 py-3 text-sm text-muted-foreground"><p>PoCリストを読み込み中…</p>{[0,1,2].map(i=><div key={i} aria-hidden="true" className="h-16 animate-pulse rounded bg-muted" />)}</div>
      : !data.topics.length ? <p className="py-6 text-sm text-muted-foreground">PoCの記録は未登録。</p>
      : data.topics.map(topic => <AmieEffluentLedger
        key={topic.tech_topic_id}
        projectId={projectId}
        topic={topic}
        entries={data.entries.filter(e => e.tech_topic_id === topic.tech_topic_id)}
        canEdit={canEdit}
        editableEntries={editableEntries}
        onChanged={() => void load(true)}
        sharedView={data.audience !== "internal"}
      />)}
  </section>;
}
