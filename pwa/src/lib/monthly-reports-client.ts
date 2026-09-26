"use client";
import { loadReferenceData, peekReferenceData, invalidateReferenceData } from "@/lib/reference-data-cache";
export type ReportMonth = { ym: string; internalStatus: string | null; hasSubmission: boolean; updatedAt: string | null };
const key = (projectId: string) => `monthly-reports:${projectId}:`;
const ttlMs = 30_000;
async function requestReports(projectId: string): Promise<ReportMonth[]> {
  const response = await fetch(`/api/project/monthly-reports?projectId=${encodeURIComponent(projectId)}`);
  const payload = await response.json();
  if (!response.ok || !Array.isArray(payload.reports)) throw new Error(payload.error || "月次報告書を読み込めませんでした。");
  return payload.reports;
}
export function loadMonthlyReports(projectId: string) { return loadReferenceData(key(projectId), () => requestReports(projectId), { ttlMs }); }
export function peekMonthlyReports(projectId: string) { return peekReferenceData<ReportMonth[]>(key(projectId), ttlMs); }
export function invalidateMonthlyReports(projectId: string) { invalidateReferenceData(key(projectId)); }
export function prefetchMonthlyReports(projectId: string) { void loadMonthlyReports(projectId).catch(() => {}); }
