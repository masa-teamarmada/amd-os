/**
 * 「AMDがこのPJへ行ってきたこと」のクライアント側アクセス層。
 *
 * この欄が読むのは、抽出が日〜週単位で追記する読み取り専用の履歴 (member_activities /
 * project_meeting_summaries)。画面から直に fetch するとタブを開くたびに待たされるので、
 * 参照系キャッシュを通す (guard: scripts/check_reference_data_cache_contract.mjs)。
 *
 * 正本: pwa/spec/4-7-amd-contributions-current-spec.md
 *      pwa/spec/5-10-reference-data-caching-current-spec.md
 */
"use client";

import type { AmdContributionsPayload } from "@/lib/amd-contributions";
import {
  invalidateReferenceData,
  loadReferenceData,
  peekReferenceData,
  prefetchReferenceData,
} from "@/lib/reference-data-cache";

const KEY_PREFIX = "amd-contributions:";
const keyOf = (projectId: string) => `${KEY_PREFIX}${projectId}`;

async function request(projectId: string): Promise<AmdContributionsPayload> {
  const response = await fetch(`/api/project/${encodeURIComponent(projectId)}/amd-contributions`);
  const payload = (await response.json().catch(() => null)) as
    | AmdContributionsPayload
    | { error?: string }
    | null;
  if (!response.ok || !payload || !("items" in payload)) {
    throw new Error(
      payload && "error" in payload && payload.error ? payload.error : "AMDの活動記録の取得に失敗",
    );
  }
  return payload;
}

export function loadAmdContributions(projectId: string, options?: { force?: boolean }) {
  return loadReferenceData(keyOf(projectId), () => request(projectId), options);
}

/** キャッシュ済みなら同期で返す。タブを開いた瞬間に描画するために使う。 */
export function peekAmdContributions(projectId: string) {
  return peekReferenceData<AmdContributionsPayload>(keyOf(projectId));
}

/** PJ行の hover 等から先に温めておく。 */
export function prefetchAmdContributions(projectId: string) {
  prefetchReferenceData(keyOf(projectId), () => request(projectId));
}

/** 抽出が新しい活動を書いたあとに呼ぶ。 */
export function invalidateAmdContributions() {
  invalidateReferenceData(KEY_PREFIX);
}
