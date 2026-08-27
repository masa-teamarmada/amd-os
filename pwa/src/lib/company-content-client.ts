/**
 * ホーム下段「会社の記録」のクライアント側アクセス層。
 *
 * 名簿・沿革・メディア掲載・写真台帳は参照系 (日〜週単位でしか変わらない)。
 * 画面から `/api/dashboard/company-content` を直に fetch すると、ホームを開くたびに
 * 待たされる。画面側は必ずこのファイル経由で読む
 * (guard: scripts/check_reference_data_cache_contract.mjs)。
 *
 * サーバ側のスナップショットキャッシュは lib/company-content.ts。
 */
"use client";

import {
  invalidateReferenceData,
  loadReferenceData,
  peekReferenceData,
} from "@/lib/reference-data-cache";
import type { CompanyContentPreview } from "@/types/company-content";

const KEY = "company-content:preview";
const ENDPOINT = "/api/dashboard/company-content";

async function requestCompanyContent(force?: boolean): Promise<CompanyContentPreview> {
  const response = await fetch(force ? `${ENDPOINT}?fresh=1` : ENDPOINT);
  const payload = (await response.json()) as { ok: boolean; content?: CompanyContentPreview };
  if (!response.ok || !payload.ok || !payload.content) throw new Error("company content failed");
  return payload.content;
}

/** ホームの「会社の記録」節が使う。ページを跨いでも再取得しない。 */
export function loadCompanyContent(options?: { force?: boolean }) {
  return loadReferenceData(KEY, () => requestCompanyContent(options?.force), options);
}

/** キャッシュ済みなら同期で返す。節を空から生やさず、最初の描画で中身を出すために使う。 */
export function peekCompanyContent(): CompanyContentPreview | undefined {
  return peekReferenceData<CompanyContentPreview>(KEY);
}

/** 写真の表紙変更・メンバー写真の差し替え直後に呼ぶ。 */
export function invalidateCompanyContent(): void {
  invalidateReferenceData(KEY);
}
