/**
 * PJコックピットのシーズン予算・消化状況のクライアント側アクセス層。
 *
 * 読むのは、日次の報酬キャッシュ更新でしか動かないシーズン単位の集計。
 * 画面から直に fetch するとタブを開くたびに数秒待たされるので、参照系キャッシュを通す
 * (guard: scripts/check_reference_data_cache_contract.mjs)。
 *
 * 正本: pwa/design/season_budget_actual.md / pwa/spec/5-10-reference-data-caching-current-spec.md
 */
"use client";

import type { SeasonPlPayload } from "@/app/api/project/[projectId]/season-budget/route";
import {
  invalidateReferenceData,
  loadReferenceData,
  peekReferenceData,
  prefetchReferenceData,
} from "@/lib/reference-data-cache";

const KEY_PREFIX = "season-budget:";
const keyOf = (projectId: string) => `${KEY_PREFIX}${projectId}`;

async function request(projectId: string): Promise<SeasonPlPayload> {
  const response = await fetch(`/api/project/${encodeURIComponent(projectId)}/season-budget`);
  const payload = (await response.json().catch(() => null)) as SeasonPlPayload | { error?: string } | null;
  if (!response.ok || !payload || !("seasons" in payload)) {
    throw new Error(
      payload && "error" in payload && payload.error ? payload.error : "シーズン予算の取得に失敗",
    );
  }
  return payload;
}

export function loadSeasonBudget(projectId: string, options?: { force?: boolean }) {
  return loadReferenceData(keyOf(projectId), () => request(projectId), options);
}

/** キャッシュ済みなら同期で返す。タブを開いた瞬間に描画するために使う。 */
export function peekSeasonBudget(projectId: string) {
  return peekReferenceData<SeasonPlPayload>(keyOf(projectId));
}

/** PJ行の hover 等から先に温めておく。 */
export function prefetchSeasonBudget(projectId: string) {
  prefetchReferenceData(keyOf(projectId), () => request(projectId));
}

/** 支払・入金確認のあとに呼ぶ。 */
export function invalidateSeasonBudget() {
  invalidateReferenceData(KEY_PREFIX);
}
