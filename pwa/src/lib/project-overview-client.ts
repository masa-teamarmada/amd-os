/**
 * PJ概要タブ（PJ管理）のクライアント側アクセス層。
 *
 * PJの定義はPJを作るときに決めて、めったに変わらない参照系なので、参照系キャッシュを通して読む
 * (guard: scripts/check_reference_data_cache_contract.mjs、正本: pwa/spec/5-10-reference-data-caching-current-spec.md)。
 * 重要な動きも一緒に返すので、TTLは参照系の既定より短い60秒にする。
 * 保存（管理者だけ）は API が最新の束を返すので、その値でキャッシュを置き換える。
 */
"use client";

import type { ProjectDefinitionInput, ProjectOverviewResponse } from "@/lib/project-overview";
import {
  invalidateReferenceData,
  loadReferenceData,
  peekReferenceData,
  prefetchReferenceData,
  primeReferenceData,
} from "@/lib/reference-data-cache";

const KEY_PREFIX = "project-overview:";
const TTL_MS = 60_000;
const keyOf = (projectId: string) => `${KEY_PREFIX}${projectId}`;

async function request(projectId: string): Promise<ProjectOverviewResponse> {
  const response = await fetch(`/api/project/${encodeURIComponent(projectId)}/overview`);
  const payload = (await response.json().catch(() => null)) as ProjectOverviewResponse | { ok?: false; error?: string } | null;
  if (!response.ok || !payload || !payload.ok) {
    throw new Error((payload && "error" in payload && payload.error) || "PJ概要を読み込めない");
  }
  return payload;
}

export function loadProjectOverview(projectId: string, options?: { force?: boolean }) {
  return loadReferenceData(keyOf(projectId), () => request(projectId), { ttlMs: TTL_MS, force: options?.force });
}

/** キャッシュ済みなら同期で返す。タブを開いた瞬間に描画するために使う。 */
export function peekProjectOverview(projectId: string) {
  return peekReferenceData<ProjectOverviewResponse>(keyOf(projectId), TTL_MS);
}

/** タブの上にカーソルが乗ったときに先読みする。 */
export function prefetchProjectOverview(projectId: string) {
  prefetchReferenceData(keyOf(projectId), () => request(projectId), { ttlMs: TTL_MS });
}

/** Venture Map の分類を直したあとなど、ほかの書き込みの後に捨てる。 */
export function invalidateProjectOverview(projectId?: string) {
  invalidateReferenceData(projectId ? keyOf(projectId) : KEY_PREFIX);
}

/** PJの定義を保存する（管理者だけ）。戻り値の最新の束でキャッシュを置き換える。 */
export async function saveProjectDefinition(projectId: string, definition: ProjectDefinitionInput): Promise<ProjectOverviewResponse> {
  const response = await fetch(`/api/project/${encodeURIComponent(projectId)}/overview`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ definition }),
  });
  const payload = (await response.json().catch(() => null)) as ProjectOverviewResponse | { ok?: false; error?: string } | null;
  if (!response.ok || !payload || !payload.ok) {
    throw new Error((payload && "error" in payload && payload.error) || "PJの定義を保存できなかった");
  }
  primeReferenceData(keyOf(projectId), payload);
  return payload;
}
