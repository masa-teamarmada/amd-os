"use client";
import { loadReferenceData, peekReferenceData } from "@/lib/reference-data-cache";
import { parseProjectOrganizationChart, type ProjectOrganizationChartData } from "./project-organization-chart";
const ttlMs = 30_000;
const keyFor = (projectId: string) => "organization-chart:" + projectId;
export function peekProjectOrganizationChart(projectId: string) {
  return peekReferenceData<ProjectOrganizationChartData | null>(keyFor(projectId), ttlMs);
}
export function loadProjectOrganizationChartClient(projectId: string) {
  return loadReferenceData(keyFor(projectId), async () => {
    const response = await fetch("/api/project-organization-chart?projectId=" + encodeURIComponent(projectId));
    const body = await response.json();
    if (!response.ok || !body.ok) throw new Error(body.error || "組織図を読み込めなかった");
    return parseProjectOrganizationChart(body.chart);
  }, { ttlMs });
}
