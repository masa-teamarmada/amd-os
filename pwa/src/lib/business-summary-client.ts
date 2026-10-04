/**
 * 会社情報 > 会社概要「事業の概要」（事業の一言と詳しい説明）のクライアント側アクセス層。
 *
 * 事業の概要はPJを作るときに書いて、めったに変えない参照系なので、参照系キャッシュを通して読む
 * (guard: scripts/check_reference_data_cache_contract.mjs、正本: pwa/spec/5-10-reference-data-caching-current-spec.md)。
 * 保存（管理者だけ）は API が最新の値を返すので、その値でキャッシュを置き換える。
 */
"use client";

import type { BusinessSummaryResponse } from "@/lib/project-overview";
import {
  invalidateReferenceData,
  loadReferenceData,
  peekReferenceData,
  prefetchReferenceData,
  primeReferenceData,
} from "@/lib/reference-data-cache";

const KEY_PREFIX = "business-summary:";
const keyOf = (projectId: string) => `${KEY_PREFIX}${projectId}`;

async function request(projectId: string): Promise<BusinessSummaryResponse> {
  const response = await fetch(`/api/project/${encodeURIComponent(projectId)}/business-summary`);
  const payload = (await response.json().catch(() => null)) as BusinessSummaryResponse | { ok?: false; error?: string } | null;
  if (!response.ok || !payload || !payload.ok) {
    throw new Error((payload && "error" in payload && payload.error) || "事業の概要を読み込めない");
  }
  return payload;
}

export function loadBusinessSummary(projectId: string, options?: { force?: boolean }) {
  return loadReferenceData(keyOf(projectId), () => request(projectId), options);
}

/** キャッシュ済みなら同期で返す。タブを開いた瞬間に描画するために使う。 */
export function peekBusinessSummary(projectId: string) {
  return peekReferenceData<BusinessSummaryResponse>(keyOf(projectId));
}

/** 会社情報タブの上にカーソルが乗ったときに先読みする。 */
export function prefetchBusinessSummary(projectId: string) {
  prefetchReferenceData(keyOf(projectId), () => request(projectId));
}

export function invalidateBusinessSummary(projectId?: string) {
  invalidateReferenceData(projectId ? keyOf(projectId) : KEY_PREFIX);
}

/** 事業の概要を保存する（管理者だけ）。戻り値の最新の値でキャッシュを置き換える。 */
export async function saveBusinessSummary(
  projectId: string,
  input: { summary: string | null; detail: string | null },
): Promise<BusinessSummaryResponse> {
  const response = await fetch(`/api/project/${encodeURIComponent(projectId)}/business-summary`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = (await response.json().catch(() => null)) as BusinessSummaryResponse | { ok?: false; error?: string } | null;
  if (!response.ok || !payload || !payload.ok) {
    throw new Error((payload && "error" in payload && payload.error) || "事業の概要を保存できなかった");
  }
  primeReferenceData(keyOf(projectId), payload);
  return payload;
}
