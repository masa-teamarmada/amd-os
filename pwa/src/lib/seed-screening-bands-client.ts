/**
 * 一次選別スクリーニング帯のクライアント側アクセス層。
 *
 * 帯は評価ツール (scripts/sps_initial_assessment_tool.mjs 等) からしか書かれない参照系データ。
 * 画面から `/api/seeds/screening-bands` を直に fetch すると、モーダルを開くたびに待たされる。
 * 画面側は必ずこのファイル経由で読む (guard: scripts/check_reference_data_cache_contract.mjs)。
 *
 * サーバ側のスナップショットキャッシュは lib/seed-screening-bands.ts。
 */
"use client";

import {
  loadReferenceData,
  peekReferenceData,
  prefetchReferenceData,
  invalidateReferenceData,
} from "@/lib/reference-data-cache";
import type { SeedScreeningBandDetail, SeedScreeningBandSummary } from "@/types/seeds";

const KEY_PREFIX = "seed-screening-bands:";
const SUMMARY_KEY = `${KEY_PREFIX}summaries`;
const detailKey = (seedId: string) => `${KEY_PREFIX}detail:${seedId}`;

const ENDPOINT = "/api/seeds/screening-bands";

async function requestSummaries(): Promise<Map<string, SeedScreeningBandSummary>> {
  const response = await fetch(ENDPOINT);
  const payload = (await response.json()) as { ok: boolean; bands?: SeedScreeningBandSummary[] };
  if (!response.ok || !payload.ok || !payload.bands) throw new Error("screening band summaries failed");
  return new Map(payload.bands.map((band) => [band.seed_id, band]));
}

async function requestDetail(seedId: string): Promise<SeedScreeningBandDetail | null> {
  const response = await fetch(`${ENDPOINT}?seedId=${encodeURIComponent(seedId)}`);
  const payload = (await response.json()) as { ok: boolean; band?: SeedScreeningBandDetail | null };
  if (!response.ok || !payload.ok) throw new Error("screening band detail failed");
  return payload.band ?? null;
}

/** 一覧向け: 全シーズのサマリ帯。ページを跨いでも再取得しない。 */
export function loadSeedScreeningBandSummaries(options?: { force?: boolean }) {
  return loadReferenceData(SUMMARY_KEY, requestSummaries, options);
}

/** 詳細モーダル向け: 対象シーズの帯 (全項目)。帯が無ければ null。 */
export function loadSeedScreeningBandDetail(seedId: string, options?: { force?: boolean }) {
  return loadReferenceData(detailKey(seedId), () => requestDetail(seedId), options);
}

/** キャッシュ済みなら同期で返す。モーダルを開いた瞬間に描画するために使う。 */
export function peekSeedScreeningBandDetail(seedId: string): SeedScreeningBandDetail | null | undefined {
  return peekReferenceData<SeedScreeningBandDetail | null>(detailKey(seedId));
}

/** 一覧行の hover / フォーカスで先読みする。クリック時には手元にある状態を作る。 */
export function prefetchSeedScreeningBandDetail(seedId: string): void {
  prefetchReferenceData(detailKey(seedId), () => requestDetail(seedId));
}

/** 帯を書き換えた直後に呼ぶ (サマリ・詳細をまとめて捨てる)。 */
export function invalidateSeedScreeningBands(): void {
  invalidateReferenceData(KEY_PREFIX);
}
