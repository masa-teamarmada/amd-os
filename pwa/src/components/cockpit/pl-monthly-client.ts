/**
 * 月次試算表 (`project_pl_monthly`) のクライアント層。
 *
 * 月次試算表は参照系 (読み取り専用・更新頻度は月単位) なので、画面から直接 supabase を
 * 叩かずにこのモジュールのキャッシュを通す。同じPJの表を複数箇所に置いても取得は1回。
 * 書き込み導線を足すときは `invalidatePlMonthlyCache` を保存直後に呼ぶ。
 */

import { invalidateReferenceData, loadReferenceData, peekReferenceData } from "@/lib/reference-data-cache";
import { fetchPlMonthly, type ProjectPlMonthly } from "@/lib/venture-status-data";

const KEY_PREFIX = "cockpit/pl-monthly/";

const cacheKey = (projectId: string) => `${KEY_PREFIX}${projectId}`;

/** キャッシュ済みなら同期で返す (初回描画を待たせないため)。 */
export function getCachedPlMonthly(projectId: string): ProjectPlMonthly[] | undefined {
  return peekReferenceData<ProjectPlMonthly[]>(cacheKey(projectId));
}

/** キャッシュがあればそれを、無ければ1回だけ取得する。 */
export function loadPlMonthly(projectId: string): Promise<ProjectPlMonthly[]> {
  return loadReferenceData(cacheKey(projectId), () => fetchPlMonthly(projectId));
}

/** 保存・削除の直後に呼ぶ。projectId 省略時は全PJ分を捨てる。 */
export function invalidatePlMonthlyCache(projectId?: string): void {
  invalidateReferenceData(projectId ? cacheKey(projectId) : KEY_PREFIX);
}
