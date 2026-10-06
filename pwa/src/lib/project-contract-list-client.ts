"use client";
import type { ProjectContractEvidenceData, ProjectContractHistoryCursor, ProjectContractListData } from "./project-contract-list";
import { loadReferenceData, invalidateReferenceData } from "@/lib/reference-data-cache";
const keyFor = (projectId: string) => `contract-list:${projectId}`;
export function loadProjectContracts(projectId: string) {
  return loadReferenceData(keyFor(projectId), async (): Promise<ProjectContractListData> => {
    const response = await fetch(`/api/project/${encodeURIComponent(projectId)}/contract-list`);
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error("契約リストを取得できません。");
    return payload;
  }, { ttlMs: 30_000 });
}
export async function setContractDdVisibility(projectId: string, contractId: string, ddVisible: boolean): Promise<ProjectContractListData> {
  const response = await fetch(`/api/project/${encodeURIComponent(projectId)}/contract-list`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contractId, ddVisible }),
  });
  const payload = await response.json();
  if (!response.ok || !payload.ok) throw new Error("DDの表示設定を保存できません。");
  invalidateReferenceData(keyFor(projectId));
  return payload;
}

export function loadProjectContractEvidence(projectId: string, contractId: string, cursor?: ProjectContractHistoryCursor) {
  const search = new URLSearchParams({ contractId });
  if (cursor) { search.set("before", cursor.occurredAt); search.set("beforeId", cursor.id); }
  return loadReferenceData(`${keyFor(projectId)}:evidence:${search}`, async (): Promise<ProjectContractEvidenceData> => {
    const response = await fetch(`/api/project/${encodeURIComponent(projectId)}/contract-list?${search}`);
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error("契約の文書・経緯を取得できません。");
    return payload;
  }, { ttlMs: 30_000 });
}
