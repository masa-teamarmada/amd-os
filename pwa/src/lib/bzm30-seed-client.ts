/**
 * シーズごとの BZM 3.0 の入力とスコアのクライアント側アクセス層。
 *
 * 書き込みは調査と算出バッチ（model/tools/bzm30_score_seeds.cjs）からしか起きない参照系。
 * 画面から `/api/seeds/bzm30` を直に fetch すると、モーダルを開くたびに待たされる。
 * 画面側は必ずこのファイル経由で読む（guard: scripts/check_reference_data_cache_contract.mjs）。
 */
"use client";

import {
  loadReferenceData,
  peekReferenceData,
  prefetchReferenceData,
  invalidateReferenceData,
} from "@/lib/reference-data-cache";
import type { SeedBzm30Dto } from "@/lib/bzm30/seed-score";

const KEY_PREFIX = "seed-bzm30:";
const key = (seedId: string) => `${KEY_PREFIX}${seedId}`;
const ENDPOINT = "/api/seeds/bzm30";

async function request(seedId: string): Promise<SeedBzm30Dto> {
  const response = await fetch(`${ENDPOINT}?seedId=${encodeURIComponent(seedId)}`);
  const payload = (await response.json()) as { ok: boolean; bzm30?: SeedBzm30Dto };
  if (!response.ok || !payload.ok || !payload.bzm30) throw new Error("seed bzm30 failed");
  return payload.bzm30;
}

export function loadSeedBzm30(seedId: string, options?: { force?: boolean }) {
  return loadReferenceData(key(seedId), () => request(seedId), options);
}

/** キャッシュ済みなら同期で返す。モーダルを開いた瞬間に描画するために使う。 */
export function peekSeedBzm30(seedId: string): SeedBzm30Dto | undefined {
  return peekReferenceData<SeedBzm30Dto>(key(seedId));
}

/** 一覧行の hover で先読みする。 */
export function prefetchSeedBzm30(seedId: string): void {
  prefetchReferenceData(key(seedId), () => request(seedId));
}

export function invalidateSeedBzm30Client(): void {
  invalidateReferenceData(KEY_PREFIX);
}
