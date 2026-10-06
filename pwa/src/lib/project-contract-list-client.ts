"use client";
import type { ProjectContractListData } from "./project-contract-list";
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
