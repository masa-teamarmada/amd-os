/**
 * `/admin/cash`「現金と融資」のクライアント側アクセス層。
 *
 * 口座の入出金も借入もきよが日〜週単位で手で更新する参照系。画面から `/api/admin/cash` を
 * 直に fetch すると、タブを切り替えるたびに待たされる。画面は必ずこのファイル経由で読む
 * (guard: scripts/check_reference_data_cache_contract.mjs)。
 *
 * サーバ側のスナップショットキャッシュは lib/finance/cash-and-loans.ts。
 */
"use client";

import {
  invalidateReferenceData,
  loadReferenceData,
  peekReferenceData,
  prefetchReferenceData,
} from "@/lib/reference-data-cache";
import type { CashAndLoansResult } from "@/lib/finance/cash-and-loans-types";

const KEY = "admin-cash:all";
const ENDPOINT = "/api/admin/cash";

async function request(force?: boolean): Promise<CashAndLoansResult> {
  const response = await fetch(force ? `${ENDPOINT}?fresh=1` : ENDPOINT);
  const payload = (await response.json()) as { ok: boolean; data?: CashAndLoansResult; error?: string };
  if (!response.ok || !payload.ok || !payload.data) {
    throw new Error(payload.error ?? "現金と融資の読み込みに失敗した");
  }
  return payload.data;
}

export function loadCashAndLoans(options?: { force?: boolean }) {
  return loadReferenceData(KEY, () => request(options?.force), options);
}

/** キャッシュ済みなら同期で返す。タブを開き直したときに骨組みから描き直さないため。 */
export function peekCashAndLoans(): CashAndLoansResult | undefined {
  return peekReferenceData<CashAndLoansResult>(KEY);
}

/** サイドバーの hover などから先読みする。 */
export function prefetchCashAndLoans(): void {
  prefetchReferenceData(KEY, () => request());
}

/** 明細や借入を書き換えた直後に呼ぶ。 */
export function invalidateCashAndLoans(): void {
  invalidateReferenceData(KEY);
}
