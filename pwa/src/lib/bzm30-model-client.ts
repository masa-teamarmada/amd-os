/**
 * BZM 3.0 のモデル定義のクライアント側アクセス層。
 *
 * 式・係数・計算結果はシーズにも PJ にも依存しない参照系で、まさの承認を経た
 * relock のときしか変わらない。画面から `/api/model/bzm30` を直に fetch すると
 * モーダルを開くたびに待たされるので、画面側は必ずこのファイル経由で読む
 * （guard: scripts/check_reference_data_cache_contract.mjs）。
 */
"use client";

import {
  loadReferenceData,
  peekReferenceData,
  prefetchReferenceData,
  invalidateReferenceData,
} from "@/lib/reference-data-cache";
import type { Bzm30Formula } from "@/lib/bzm30/formulas";
import type { Bzm30GridRow, Bzm30Param, Bzm30StageDef } from "@/lib/bzm30/tier0";

export interface Bzm30Model {
  model_version: string;
  approval_ref: string;
  canon: string;
  reference_impl: string;
  note: string;
  approximations: string[];
  numeric_error: string;
  stages: Bzm30StageDef[];
  params: Bzm30Param[];
  grid: Bzm30GridRow[];
  formulas: Bzm30Formula[];
}

const KEY = "bzm30-model";
const ENDPOINT = "/api/model/bzm30";

/** 正本は日単位でも変わらない。TTL は長めに取る。 */
const TTL_MS = 30 * 60 * 1000;

async function request(): Promise<Bzm30Model> {
  const response = await fetch(ENDPOINT);
  const payload = (await response.json()) as { ok: boolean; model?: Bzm30Model };
  if (!response.ok || !payload.ok || !payload.model) throw new Error("bzm30 model failed");
  return payload.model;
}

export function loadBzm30Model(options?: { force?: boolean }) {
  return loadReferenceData(KEY, request, { ttlMs: TTL_MS, ...options });
}

/** キャッシュ済みなら同期で返す。モーダルを開いた瞬間に描画するために使う。 */
export function peekBzm30Model(): Bzm30Model | undefined {
  return peekReferenceData<Bzm30Model>(KEY, TTL_MS);
}

/** 一覧行の hover で先読みする。クリック時には手元にある状態を作る。 */
export function prefetchBzm30Model(): void {
  prefetchReferenceData(KEY, request);
}

/** relock などで正本を書き換えた直後に呼ぶ。 */
export function invalidateBzm30Model(): void {
  invalidateReferenceData(KEY);
}
