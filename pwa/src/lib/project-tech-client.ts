/**
 * 技術台帳のクライアント側アクセス層。
 *
 * 技術タブは参照系。成立条件・解説・星取り表は admin がまとめて直すだけで、
 * 閲覧側には読み取り専用。タブを開くたびに fetch を張り直すと「開くたびに待たされる」に
 * なるので、画面から直に fetch せず必ずここを通す
 * (guard: scripts/check_reference_data_cache_contract.mjs)。
 *
 * 書き換えた直後は invalidateProjectTech() を呼び、次の読み取りで最新へ戻す。
 */
"use client";

import {
  loadReferenceData,
  peekReferenceData,
  prefetchReferenceData,
  invalidateReferenceData,
} from "@/lib/reference-data-cache";
import type { TechEntry, TechKnowledgeFragment, TechTopic } from "@/lib/project-tech";

const KEY_PREFIX = "project-tech:";
const key = (projectId: string) => `${KEY_PREFIX}${projectId}`;

export interface ProjectTechResponse {
  canEdit: boolean;
  topics: TechTopic[];
  entries: TechEntry[];
  fragments: TechKnowledgeFragment[];
}

async function request(projectId: string): Promise<ProjectTechResponse> {
  const res = await fetch(`/api/project-tech?projectId=${encodeURIComponent(projectId)}`);
  const payload = (await res.json()) as {
    ok: boolean;
    canEdit?: boolean;
    topics?: TechTopic[];
    entries?: TechEntry[];
    fragments?: TechKnowledgeFragment[];
    error?: string;
  };
  if (!res.ok || !payload.ok) throw new Error(payload.error || "技術台帳の読み込みに失敗");
  return {
    canEdit: !!payload.canEdit,
    topics: payload.topics ?? [],
    entries: payload.entries ?? [],
    fragments: payload.fragments ?? [],
  };
}

/** タブ本体から呼ぶ。同時に来た呼び出しは1本へ束ねられる。 */
export function loadProjectTech(projectId: string, options?: { force?: boolean }) {
  return loadReferenceData(key(projectId), () => request(projectId), options);
}

/** キャッシュ済みなら同期で返す。タブを開いた瞬間に描画するために使う。 */
export function peekProjectTech(projectId: string): ProjectTechResponse | undefined {
  return peekReferenceData<ProjectTechResponse>(key(projectId));
}

/** タブ見出しの hover で先読みする。クリック時には手元にある状態を作る。 */
export function prefetchProjectTech(projectId: string): void {
  prefetchReferenceData(key(projectId), () => request(projectId));
}

/** トピックや行を書き換えた直後に呼ぶ。 */
export function invalidateProjectTech(projectId?: string): void {
  invalidateReferenceData(projectId ? key(projectId) : KEY_PREFIX);
}

type Entity = "topic" | "entry";

/** 追加。書き込みもここへ寄せて、画面から素の fetch を消す。 */
export async function createTechRow(
  projectId: string,
  entity: Entity,
  row: Record<string, unknown>
): Promise<void> {
  const res = await fetch("/api/project-tech", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entity, row: { ...row, project_id: projectId } }),
  });
  const payload = (await res.json()) as { ok: boolean; error?: string };
  if (!res.ok || !payload.ok) throw new Error(payload.error || "追加に失敗");
  invalidateProjectTech(projectId);
}

/** 更新。 */
export async function updateTechRow(
  projectId: string,
  entity: Entity,
  id: string,
  patch: Record<string, unknown>
): Promise<void> {
  const res = await fetch("/api/project-tech", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entity, id, patch }),
  });
  const payload = (await res.json()) as { ok: boolean; error?: string };
  if (!res.ok || !payload.ok) throw new Error(payload.error || "保存に失敗");
  invalidateProjectTech(projectId);
}

/** 削除。トピックを消すと中身の行も一緒に消える。 */
export async function deleteTechRow(projectId: string, entity: Entity, id: string): Promise<void> {
  const res = await fetch(
    `/api/project-tech?entity=${encodeURIComponent(entity)}&id=${encodeURIComponent(id)}`,
    { method: "DELETE" }
  );
  const payload = (await res.json()) as { ok: boolean; error?: string };
  if (!res.ok || !payload.ok) throw new Error(payload.error || "削除に失敗");
  invalidateProjectTech(projectId);
}
