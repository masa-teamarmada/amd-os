/**
 * PJ別 利益構造ダッシュボードのクライアント側アクセス層。
 *
 * 読むのは、月次締め処理でしか動かない billing_cycles の年次集計。
 * 画面から直に fetch すると年切替のたびに待たされるので、参照系キャッシュを通す
 * (guard: scripts/check_reference_data_cache_contract.mjs)。
 *
 * 正本: pwa/spec/5-14-project-profitability-current-spec.md
 */
"use client";

import {
  invalidateReferenceData,
  loadReferenceData,
  peekReferenceData,
  prefetchReferenceData,
} from "@/lib/reference-data-cache";
import type { ProjectProfitabilityRow } from "@/lib/project-profitability";

export type ProjectProfitabilityPayload = {
  ok: true;
  year: number;
  rows: ProjectProfitabilityRow[];
};

const KEY_PREFIX = "project-profitability:";
const keyOf = (year: number) => `${KEY_PREFIX}${year}`;

async function request(year: number): Promise<ProjectProfitabilityPayload> {
  const response = await fetch(`/api/admin/project-profitability?year=${encodeURIComponent(String(year))}`);
  const payload = (await response.json().catch(() => null)) as
    | ProjectProfitabilityPayload
    | { ok: false; error?: string }
    | null;
  if (!response.ok || !payload || payload.ok !== true) {
    throw new Error(payload && "error" in payload && payload.error ? payload.error : "PJ別利益構造の取得に失敗");
  }
  return payload;
}

export function loadProjectProfitability(year: number, options?: { force?: boolean }) {
  return loadReferenceData(keyOf(year), () => request(year), options);
}

/** キャッシュ済みなら同期で返す。年タブを開いた瞬間に描画するために使う。 */
export function peekProjectProfitability(year: number) {
  return peekReferenceData<ProjectProfitabilityPayload>(keyOf(year));
}

/** 年切替タブの hover 等から先に温めておく。 */
export function prefetchProjectProfitability(year: number) {
  prefetchReferenceData(keyOf(year), () => request(year));
}

/** 月次締め処理・報酬再計算の直後に呼ぶ。 */
export function invalidateProjectProfitability() {
  invalidateReferenceData(KEY_PREFIX);
}
