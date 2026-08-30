/**
 * PJ別 利益構造ダッシュボードのクライアント側アクセス層。
 *
 * 読むのは、月次締めでしか動かない billing_cycles / value_plan_cycles のシーズン集計。
 * 画面から直に fetch すると開くたびに待たされるので、参照系キャッシュを通す
 * (guard: scripts/check_reference_data_cache_contract.mjs)。
 *
 * 正本: pwa/spec/5-14-project-profitability-current-spec.md
 */
"use client";

import {
  invalidateReferenceData,
  loadReferenceData,
  peekReferenceData,
  prefetchReferenceData,
} from "@/lib/reference-data-cache";
import type { ProjectProfitabilityRow } from "@/lib/project-profitability";

export type ProjectProfitabilityPayload = {
  ok: true;
  rows: ProjectProfitabilityRow[];
};

const KEY = "project-profitability";

async function request(): Promise<ProjectProfitabilityPayload> {
  const response = await fetch("/api/admin/project-profitability");
  const payload = (await response.json().catch(() => null)) as
    | ProjectProfitabilityPayload
    | { ok: false; error?: string }
    | null;
  if (!response.ok || !payload || payload.ok !== true) {
    throw new Error(payload && "error" in payload && payload.error ? payload.error : "PJ別利益構造の取得に失敗");
  }
  return payload;
}

export function loadProjectProfitability(options?: { force?: boolean }) {
  return loadReferenceData(KEY, request, options);
}

/** キャッシュ済みなら同期で返す。画面を開いた瞬間に描画するために使う。 */
export function peekProjectProfitability() {
  return peekReferenceData<ProjectProfitabilityPayload>(KEY);
}

/** 一覧へ入る導線の hover から先に温めておく。 */
export function prefetchProjectProfitability() {
  prefetchReferenceData(KEY, request);
}

/** 月次締め・報酬再計算の直後に呼ぶ。 */
export function invalidateProjectProfitability() {
  invalidateReferenceData(KEY);
}
