"use client";

import type { Bzm22PilotApiPayload, Bzm22PilotProject } from "@/lib/bzm-2-2-pilot-ui";

/**
 * BZM 2.2 pilot payload のブラウザ内キャッシュ。
 * スコア詳細タブ (`Bzm22ProvisionalObservatory`) と事業計画タブ (`Bzm22TimeLedgerSection`) が
 * 同じ PJ を続けて開いたときに、同じ payload を二重に取りに行かないため共有する。
 */
const PILOT_CACHE = new Map<string, Bzm22PilotProject>();

export function getCachedBzm22Pilot(projectId: string): Bzm22PilotProject | undefined {
  return PILOT_CACHE.get(projectId);
}

/** BZM 2.2 暫定試算の対象外PJ (API が 404 を返す)。呼び出し側は「異常」ではなく「非表示」として扱う。 */
export class Bzm22PilotNotFoundError extends Error {}

export async function loadBzm22Pilot(projectId: string): Promise<Bzm22PilotProject> {
  const cached = PILOT_CACHE.get(projectId);
  if (cached) return cached;
  const response = await fetch(`/api/project/${encodeURIComponent(projectId)}/bzm-2-2-pilot`, { cache: "no-store" });
  const json = await response.json().catch(() => null) as Bzm22PilotApiPayload | { error?: string } | null;
  const message = json && "error" in json && json.error ? json.error : "BZM 2.2の取得に失敗";
  if (response.status === 404) throw new Bzm22PilotNotFoundError(message);
  if (!response.ok || !json || !("pilot" in json)) throw new Error(message);
  PILOT_CACHE.set(projectId, json.pilot);
  return json.pilot;
}
