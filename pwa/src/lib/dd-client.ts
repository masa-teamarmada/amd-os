/**
 * DDパッケージの有無（コックピットとワークスペースの「DDパッケージ」タブを出すか）のクライアント側アクセス層。
 *
 * PJにDDパッケージがあるかどうかは参照系（作るのは年に数回）。タブ列を描くたびに問い合わせないよう、
 * 画面から直に fetch せず必ずここを通す（guard: scripts/check_reference_data_cache_contract.mjs、spec 5-10）。
 * 管理画面の中身（掲載項目・公開の切り替え・閲覧権限）は可変系なので、DdProjectTab が毎回読み直す。
 */
"use client";

import {
  invalidateReferenceData,
  loadReferenceData,
  peekReferenceData,
  prefetchReferenceData,
} from "@/lib/reference-data-cache";

const KEY_PREFIX = "dd-package-summary:";
const key = (projectId: string) => `${KEY_PREFIX}${projectId}`;

export type DdPackageSummary = { slug: string; title: string; status: "draft" | "open" | "closed" } | null;

async function request(projectId: string): Promise<DdPackageSummary> {
  const res = await fetch(`/api/dd/summary?projectId=${encodeURIComponent(projectId)}`);
  // AMD admin 以外（403）や未ログイン（401）は「タブを出さない」として扱う。
  if (res.status === 401 || res.status === 403) return null;
  const payload = (await res.json().catch(() => null)) as { ok?: boolean; package?: DdPackageSummary } | null;
  if (!res.ok || !payload?.ok) throw new Error("DDパッケージの有無を読み込めない");
  return payload.package ?? null;
}

/** タブ列から呼ぶ。同時に来た呼び出しは1本へ束ねられる。 */
export function loadProjectDdSummary(projectId: string): Promise<DdPackageSummary> {
  return loadReferenceData(key(projectId), () => request(projectId));
}

/** キャッシュ済みなら同期で返す（タブ列を待たずに描くため）。 */
export function peekProjectDdSummary(projectId: string): DdPackageSummary | undefined {
  return peekReferenceData<DdPackageSummary>(key(projectId));
}

/** タブ見出しの hover で先読みする。 */
export function prefetchProjectDdSummary(projectId: string): void {
  prefetchReferenceData(key(projectId), () => request(projectId));
}

/** パッケージの表題・状態を変えた直後に呼ぶ。 */
export function invalidateProjectDdSummary(projectId?: string): void {
  invalidateReferenceData(projectId ? key(projectId) : KEY_PREFIX);
}
