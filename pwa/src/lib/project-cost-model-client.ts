/**
 * コスト試算のクライアント側アクセス層。
 *
 * コスト試算は参照系。前提と明細は admin がMTG前後にまとめて直すだけで、
 * 閲覧側 (SXメンバー) には読み取り専用。タブを開くたびに fetch を張り直すと
 * 「開くたびに待たされる」になるので、画面から直に fetch せず必ずここを通す
 * (guard: scripts/check_reference_data_cache_contract.mjs)。
 *
 * 前提を書き換えた直後は invalidateProjectCostModel() を呼び、次の読み取りで最新へ戻す。
 */
"use client";

import {
  loadReferenceData,
  peekReferenceData,
  prefetchReferenceData,
  invalidateReferenceData,
} from "@/lib/reference-data-cache";
import type { CostModelBundle } from "@/lib/project-cost-model";

const KEY_PREFIX = "project-cost-model:";
const key = (projectId: string) => `${KEY_PREFIX}${projectId}`;

export interface CostModelResponse {
  canEdit: boolean;
  bundle: CostModelBundle | null;
}

async function request(projectId: string): Promise<CostModelResponse> {
  const res = await fetch(`/api/project-cost-model?projectId=${encodeURIComponent(projectId)}`);
  const payload = (await res.json()) as { ok: boolean; canEdit?: boolean; bundle?: CostModelBundle | null; error?: string };
  if (!res.ok || !payload.ok) throw new Error(payload.error || "コスト試算の読み込みに失敗");
  return { canEdit: !!payload.canEdit, bundle: payload.bundle ?? null };
}

/** タブ本体から呼ぶ。同時に来た呼び出しは1本へ束ねられる。 */
export function loadProjectCostModel(projectId: string, options?: { force?: boolean }) {
  return loadReferenceData(key(projectId), () => request(projectId), options);
}

/** キャッシュ済みなら同期で返す。タブを開いた瞬間に描画するために使う。 */
export function peekProjectCostModel(projectId: string): CostModelResponse | undefined {
  return peekReferenceData<CostModelResponse>(key(projectId));
}

/** タブ見出しの hover で先読みする。クリック時には手元にある状態を作る。 */
export function prefetchProjectCostModel(projectId: string): void {
  prefetchReferenceData(key(projectId), () => request(projectId));
}

/** 前提・明細を書き換えた直後に呼ぶ。 */
export function invalidateProjectCostModel(projectId?: string): void {
  invalidateReferenceData(projectId ? key(projectId) : KEY_PREFIX);
}

/**
 * 前提の値を1つ書き換える。書き込みもここへ寄せて、画面から素の fetch を消す。
 * 成功したらキャッシュを捨て、次の読み取りで最新へ戻す。
 */
export async function saveCostAssumptionValue(
  projectId: string,
  costAssumptionId: string,
  value: number,
): Promise<void> {
  const res = await fetch("/api/project-cost-model", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entity: "assumption", id: costAssumptionId, patch: { value } }),
  });
  const payload = (await res.json()) as { ok: boolean; error?: string };
  if (!res.ok || !payload.ok) throw new Error(payload.error || "前提の保存に失敗");
  invalidateProjectCostModel(projectId);
}
