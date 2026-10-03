/**
 * DDパッケージのタブを出すか（見る人がAMDの管理者か）と、PJのDDパッケージの有無のクライアント側アクセス層。
 *
 * DDパッケージのタブは、AMDの管理者には全PJで出す（パッケージが無いPJは空の状態を出す）。
 * PJごとのパッケージの有無ではタブを出し分けない（2026-10-03 まさ「全部統一してないとだめ」、spec 3-23）。
 * 有無は参照系（作るのは年に数回）なので、タブ列を描くたびに問い合わせないよう、
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

/** canManage = 見る人がAMDの管理者で、DDパッケージを管理できる。package = このPJのパッケージ（無ければ null）。 */
export type DdAccessSummary = { canManage: boolean; package: DdPackageSummary };

async function request(projectId: string): Promise<DdAccessSummary> {
  const res = await fetch(`/api/dd/summary?projectId=${encodeURIComponent(projectId)}`);
  // AMD admin 以外（403）や未ログイン（401）は「管理できない（タブを出さない）」として扱う。
  if (res.status === 401 || res.status === 403) return { canManage: false, package: null };
  const payload = (await res.json().catch(() => null)) as { ok?: boolean; package?: DdPackageSummary } | null;
  if (!res.ok || !payload?.ok) throw new Error("DDパッケージの有無を読み込めない");
  return { canManage: true, package: payload.package ?? null };
}

/** タブ列から呼ぶ。同時に来た呼び出しは1本へ束ねられる。 */
export function loadProjectDdSummary(projectId: string): Promise<DdAccessSummary> {
  return loadReferenceData(key(projectId), () => request(projectId));
}

/** キャッシュ済みなら同期で返す（タブ列を待たずに描くため）。 */
export function peekProjectDdSummary(projectId: string): DdAccessSummary | undefined {
  return peekReferenceData<DdAccessSummary>(key(projectId));
}

/** タブ見出しの hover で先読みする。 */
export function prefetchProjectDdSummary(projectId: string): void {
  prefetchReferenceData(key(projectId), () => request(projectId));
}

/** パッケージの表題・状態を変えた直後に呼ぶ。 */
export function invalidateProjectDdSummary(projectId?: string): void {
  invalidateReferenceData(projectId ? key(projectId) : KEY_PREFIX);
}
