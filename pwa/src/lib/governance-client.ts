/**
 * 会社概要・資本政策のクライアント側アクセス層。
 *
 * 登記、株式イベント、ラウンド、転換前証券、総会、年度決算はどれも参照系。
 * 増資や総会があったときにまとめて直すだけで、日々書き換わるものではない。
 * タブを開くたびに fetch を張り直すと「開くたびに待たされる」になるので、
 * 画面から直に fetch せず必ずここを通す
 * (guard: scripts/check_reference_data_cache_contract.mjs)。
 *
 * 書き込みもここへ寄せ、保存に成功したらキャッシュを捨てて次の読み取りで最新へ戻す。
 * 会社概要タブと資本政策表タブは同じ鍵を共有するので、片方で保存したものが
 * もう片方を開いたときにもそのまま反映される。
 */
"use client";

import {
  invalidateReferenceData,
  loadReferenceData,
  peekReferenceData,
  prefetchReferenceData,
} from "@/lib/reference-data-cache";
import type { CompanyOverviewData } from "@/lib/company-overview";

const KEY_PREFIX = "governance:";
const key = (projectId: string) => `${KEY_PREFIX}${projectId}`;

async function request(projectId: string): Promise<CompanyOverviewData> {
  const response = await fetch(`/api/governance?projectId=${encodeURIComponent(projectId)}`);
  const payload = await response.json();
  if (!response.ok || !payload.ok) throw new Error(payload.error || "会社情報の読み込みに失敗");
  return payload as CompanyOverviewData;
}

/** タブ本体から呼ぶ。同時に来た呼び出しは1本へ束ねられる。 */
export function loadGovernance(projectId: string, options?: { force?: boolean }) {
  return loadReferenceData(key(projectId), () => request(projectId), options);
}

/** キャッシュ済みなら同期で返す。タブを開いた瞬間に描画するために使う。 */
export function peekGovernance(projectId: string): CompanyOverviewData | undefined {
  return peekReferenceData<CompanyOverviewData>(key(projectId));
}

/** タブ見出しの hover で先読みする。クリック時には手元にある状態を作る。 */
export function prefetchGovernance(projectId: string): void {
  prefetchReferenceData(key(projectId), () => request(projectId));
}

/** 保存した直後に呼ぶ。 */
export function invalidateGovernance(projectId?: string): void {
  invalidateReferenceData(projectId ? key(projectId) : KEY_PREFIX);
}

/**
 * 会社基本情報 / 株式イベント / ラウンド / 転換前証券 / 総会 / 年度決算を1件保存する。
 * 成功したらキャッシュを捨て、次の読み取りで最新へ戻す。
 */
export async function saveGovernanceEntity(
  projectId: string,
  entity: string,
  row: Record<string, unknown>,
): Promise<void> {
  const response = await fetch("/api/governance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entity, row }),
  });
  const payload = await response.json();
  if (!response.ok || !payload.ok) throw new Error(payload.error || "保存できなかったよ");
  invalidateGovernance(projectId);
}
