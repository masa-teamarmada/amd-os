/**
 * /institutions「支援プログラム比較」のクライアント側アクセス層。
 *
 * 比較表の列とセルは参照系 (日〜週単位でしか変わらない)。画面から
 * `/api/institutions/support-programs` を直に fetch するとタブを開くたびに待たされるので、
 * 画面側は必ずこのファイル経由で読む (guard: scripts/check_reference_data_cache_contract.mjs)。
 * サーバ側のスナップショットキャッシュは lib/institution-support-programs.ts。
 */
"use client";

import {
  invalidateReferenceData,
  loadReferenceData,
  peekReferenceData,
  prefetchReferenceData,
} from "@/lib/reference-data-cache";
import type {
  InstitutionPolicySourceType,
  InstitutionPolicyStatus,
} from "@/lib/institution-policy";
import type {
  RecommendationStance,
  SupportProgramBundle,
} from "@/types/institution-support-programs";

const KEY = "institutions:support-programs";
const ENDPOINT = "/api/institutions/support-programs";

async function requestSupportPrograms(force?: boolean): Promise<SupportProgramBundle> {
  const response = await fetch(force ? `${ENDPOINT}?fresh=1` : ENDPOINT);
  const payload = (await response.json()) as
    | ({ ok: true } & SupportProgramBundle)
    | { ok: false; error?: string };
  if (!response.ok || !payload.ok) {
    throw new Error(
      (payload as { error?: string }).error || "支援プログラム比較を読み込めなかった",
    );
  }
  return {
    columns: payload.columns,
    cells: payload.cells,
    recommendations: payload.recommendations ?? [],
    generatedAt: payload.generatedAt,
    canEdit: payload.canEdit,
  };
}

/** 比較表タブが使う。タブを行き来しても再取得しない。 */
export function loadInstitutionSupportPrograms(options?: { force?: boolean }) {
  return loadReferenceData(KEY, () => requestSupportPrograms(options?.force), options);
}

/** キャッシュ済みなら同期で返す。タブを開いた最初の描画で中身を出すために使う。 */
export function peekInstitutionSupportPrograms(): SupportProgramBundle | undefined {
  return peekReferenceData<SupportProgramBundle>(KEY);
}

/** タブボタンの hover / focus で温める。 */
export function prefetchInstitutionSupportPrograms(): void {
  prefetchReferenceData(KEY, () => requestSupportPrograms());
}

export function invalidateInstitutionSupportPrograms(): void {
  invalidateReferenceData(KEY);
}

/**
 * 1セルの保存 (admin)。既存の制度比較 API (`/api/institutions/policies`) へ書き、
 * 保存後にクライアントキャッシュを捨てる。サーバ側のスナップショットは route 側が捨てる。
 */
export async function saveInstitutionSupportProgramCell(input: {
  institutionId: string;
  policyItemId: string;
  status: InstitutionPolicyStatus;
  value: string | null;
  note: string | null;
  sourceUrl: string | null;
  sourceType: InstitutionPolicySourceType;
  confirmedAt: string | null;
}): Promise<void> {
  const response = await fetch("/api/institutions/policies", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      institution_id: input.institutionId,
      policy_item_id: input.policyItemId,
      status: input.status,
      attribute_value: input.value,
      evidence_note: input.note,
      source_type: input.sourceType,
      source_url: input.sourceUrl,
      confirmed_at: input.confirmedAt,
    }),
  });
  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new Error(payload.error || "保存できなかった");
  invalidateInstitutionSupportPrograms();
}

/**
 * 推奨 (論点) の保存・無効化 (admin)。保存後にクライアントキャッシュを捨てる。
 * recommendationId を省くと新規作成。isActive=false で表から外す (行は残す)。
 */
export async function saveInstitutionSupportProgramRecommendation(input: {
  recommendationId?: string | null;
  policyItemId: string | null;
  topic: string;
  stance: RecommendationStance;
  recommendation: string;
  conditions: string | null;
  rationale: string | null;
  evidenceNote: string | null;
  statNote: string | null;
  sortOrder: number;
  isActive: boolean;
}): Promise<string> {
  const response = await fetch("/api/institutions/support-program-recommendations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recommendationId: input.recommendationId ?? null,
      policyItemId: input.policyItemId,
      topic: input.topic,
      stance: input.stance,
      recommendation: input.recommendation,
      conditions: input.conditions,
      rationale: input.rationale,
      evidenceNote: input.evidenceNote,
      statNote: input.statNote,
      sortOrder: input.sortOrder,
      isActive: input.isActive,
    }),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    recommendationId?: string;
  };
  if (!response.ok || !payload.recommendationId) {
    throw new Error(payload.error || "推奨を保存できなかった");
  }
  invalidateInstitutionSupportPrograms();
  return payload.recommendationId;
}
