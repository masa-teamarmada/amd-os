/**
 * 事業計画タブ（フェーズマトリクス）のクライアント側アクセス層。
 *
 * フェーズの計画は資金計画の改定のときにしか変わらない参照系なので、参照系キャッシュを通して1回だけ読む
 * (guard: scripts/check_reference_data_cache_contract.mjs、正本: pwa/spec/5-10-reference-data-caching-current-spec.md)。
 */
"use client";

import type { ProjectBusinessPlan } from "@/lib/project-business-plan";
import {
  invalidateReferenceData,
  loadReferenceData,
  peekReferenceData,
  prefetchReferenceData,
} from "@/lib/reference-data-cache";

const KEY_PREFIX = "project-business-plan:";
const keyOf = (projectId: string) => `${KEY_PREFIX}${projectId}`;

async function request(projectId: string): Promise<ProjectBusinessPlan | null> {
  const response = await fetch(`/api/project-business-plan?projectId=${encodeURIComponent(projectId)}`);
  const payload = (await response.json().catch(() => null)) as { ok?: boolean; plan?: ProjectBusinessPlan | null; error?: string } | null;
  if (!response.ok || !payload?.ok) throw new Error(payload?.error || "事業計画を読み込めない");
  return payload.plan ?? null;
}

export function loadProjectBusinessPlan(projectId: string, options?: { force?: boolean }) {
  return loadReferenceData(keyOf(projectId), () => request(projectId), options);
}

/** キャッシュ済みなら同期で返す。タブを開いた瞬間に描画するために使う。 */
export function peekProjectBusinessPlan(projectId: string) {
  return peekReferenceData<ProjectBusinessPlan | null>(keyOf(projectId));
}

/** タブの上にカーソルが乗ったときに先読みする。 */
export function prefetchProjectBusinessPlan(projectId: string) {
  prefetchReferenceData(keyOf(projectId), () => request(projectId));
}

/** 書き込みの後に捨てる。 */
export function invalidateProjectBusinessPlan(projectId?: string) {
  invalidateReferenceData(projectId ? keyOf(projectId) : KEY_PREFIX);
}
