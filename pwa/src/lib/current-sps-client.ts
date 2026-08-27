/**
 * 「現行SPS｜産業創出価値」の凍結評価を読むクライアント層。
 *
 * 読むのは確定済みの凍結評価 (再評価は candidate → review → publish を通るので、
 * 日〜週単位でしか動かない)。参照系なので3層キャッシュを通し、コックピットの
 * スコア詳細タブと上部ステータスが同じ1回の読み取りを共有する。
 *
 * 正本: pwa/spec/5-10-reference-data-caching-current-spec.md
 *      pwa/src/lib/current-sps-model.ts (どの版を「現行」と呼ぶかの定義)
 */
"use client";

import type { CurrentSpsProjectAssessment } from "@/lib/current-sps-model";
import {
  invalidateReferenceData,
  loadReferenceData,
  peekReferenceData,
  prefetchReferenceData,
} from "@/lib/reference-data-cache";

const KEY_PREFIX = "current-sps:";
const keyOf = (projectId: string) => `${KEY_PREFIX}${projectId}`;

/** シーズ未接続のPJでは本文が空で返る。その場合は「評価なし」として null を返す。 */
async function request(projectId: string): Promise<CurrentSpsProjectAssessment | null> {
  const response = await fetch(`/api/project/${encodeURIComponent(projectId)}/sps-current`);
  if (!response.ok) return null;
  const payload = (await response.json().catch(() => null)) as CurrentSpsProjectAssessment | null;
  return payload && typeof payload === "object" && "status" in payload ? payload : null;
}

export function loadCurrentSpsAssessment(projectId: string, options?: { force?: boolean }) {
  return loadReferenceData(keyOf(projectId), () => request(projectId), options);
}

/** キャッシュ済みなら同期で返す。タブを開いた瞬間に描画するために使う。 */
export function peekCurrentSpsAssessment(projectId: string) {
  return peekReferenceData<CurrentSpsProjectAssessment | null>(keyOf(projectId));
}

/** PJ行の hover などから先に温めておく。 */
export function prefetchCurrentSpsAssessment(projectId: string) {
  prefetchReferenceData(keyOf(projectId), () => request(projectId));
}

/** 再評価を publish したあとに呼ぶ。 */
export function invalidateCurrentSpsAssessments() {
  invalidateReferenceData(KEY_PREFIX);
}
