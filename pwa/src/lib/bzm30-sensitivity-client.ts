/**
 * BZM 3.0「入力を動かして見る」のクライアント側アクセス層。
 *
 * 曲線は `model/tools/bzm30_sensitivity.cjs` の再計算のときだけ変わる参照系。
 * 画面から `/api/seeds/bzm30-sensitivity` を直に fetch すると、案件を選び直すたびに待たされる。
 * 画面側は必ずこのファイル経由で読む（guard: scripts/check_reference_data_cache_contract.mjs）。
 */
"use client";

import {
  invalidateReferenceData,
  loadReferenceData,
  peekReferenceData,
  prefetchReferenceData,
} from "@/lib/reference-data-cache";
import type { Bzm30SensitivityDetail, Bzm30SensitivityOverview } from "@/lib/bzm30/sensitivity-types";

const KEY_PREFIX = "bzm30-sensitivity:";
const OVERVIEW_KEY = `${KEY_PREFIX}overview`;
const detailKey = (seedId: string) => `${KEY_PREFIX}detail:${seedId}`;
const ENDPOINT = "/api/seeds/bzm30-sensitivity";

async function requestOverview(): Promise<Bzm30SensitivityOverview> {
  const response = await fetch(ENDPOINT);
  const payload = (await response.json()) as { ok: boolean; overview?: Bzm30SensitivityOverview };
  if (!response.ok || !payload.ok || !payload.overview) throw new Error("bzm30 sensitivity overview failed");
  return payload.overview;
}

async function requestDetail(seedId: string): Promise<Bzm30SensitivityDetail> {
  const response = await fetch(`${ENDPOINT}?seedId=${encodeURIComponent(seedId)}`);
  const payload = (await response.json()) as { ok: boolean; detail?: Bzm30SensitivityDetail };
  if (!response.ok || !payload.ok || !payload.detail) throw new Error("bzm30 sensitivity detail failed");
  return payload.detail;
}

export function loadBzm30SensitivityOverview(options?: { force?: boolean }) {
  return loadReferenceData(OVERVIEW_KEY, requestOverview, options);
}

/** キャッシュ済みなら同期で返す。画面を開き直したときに骨組みのまま待たせないために使う。 */
export function peekBzm30SensitivityOverview(): Bzm30SensitivityOverview | undefined {
  return peekReferenceData<Bzm30SensitivityOverview>(OVERVIEW_KEY);
}

export function loadBzm30SensitivityDetail(seedId: string, options?: { force?: boolean }) {
  return loadReferenceData(detailKey(seedId), () => requestDetail(seedId), options);
}

export function peekBzm30SensitivityDetail(seedId: string): Bzm30SensitivityDetail | undefined {
  return peekReferenceData<Bzm30SensitivityDetail>(detailKey(seedId));
}

/** 一覧行の hover / フォーカスで先読みする。クリックが届くまでに取得が終わる。 */
export function prefetchBzm30SensitivityDetail(seedId: string): void {
  prefetchReferenceData(detailKey(seedId), () => requestDetail(seedId));
}

export function invalidateBzm30SensitivityClient(): void {
  invalidateReferenceData(KEY_PREFIX);
}
