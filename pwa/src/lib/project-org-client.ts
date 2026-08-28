/**
 * PJの《組織》セクションを読むクライアント層。
 *
 * 中身は経営チームの機能の充足・人の一覧・人と組織の観測ログで、
 * どれも日〜週の単位でしか動かない参照系。3層キャッシュを通し、
 * タブの hover で温めてから開く（規範: pwa/spec/5-10-reference-data-caching-current-spec.md）。
 */
"use client";

import type { ProjectOrgPayload } from "@/lib/project-org-model";
import {
  invalidateReferenceData,
  loadReferenceData,
  peekReferenceData,
  prefetchReferenceData,
} from "@/lib/reference-data-cache";

const KEY_PREFIX = "project-org:";
const keyOf = (projectId: string) => `${KEY_PREFIX}${projectId}`;

async function request(projectId: string): Promise<ProjectOrgPayload | null> {
  const response = await fetch(`/api/project/${encodeURIComponent(projectId)}/org`);
  if (!response.ok) return null;
  const payload = (await response.json().catch(() => null)) as ProjectOrgPayload | null;
  return payload && typeof payload === "object" && payload.ok ? payload : null;
}

export function loadProjectOrg(projectId: string, options?: { force?: boolean }) {
  return loadReferenceData(keyOf(projectId), () => request(projectId), options);
}

/** キャッシュ済みなら同期で返す。タブを開いた瞬間に描画するために使う。 */
export function peekProjectOrg(projectId: string) {
  return peekReferenceData<ProjectOrgPayload | null>(keyOf(projectId));
}

/** タブの hover から先に温めておく。 */
export function prefetchProjectOrg(projectId: string) {
  prefetchReferenceData(keyOf(projectId), () => request(projectId));
}

/** 観測を書き足したあとに呼ぶ。 */
export function invalidateProjectOrg(projectId?: string) {
  invalidateReferenceData(projectId ? keyOf(projectId) : KEY_PREFIX);
}
