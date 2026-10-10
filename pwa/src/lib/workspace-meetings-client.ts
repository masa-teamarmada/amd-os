"use client";

import type { ProjectMeetingSummary, ProjectStrategySignal } from "./supabase-data";
import { loadReferenceData } from "@/lib/reference-data-cache";

type WorkspaceMeetingsPayload = {
  ok: true;
  meetings: ProjectMeetingSummary[];
  signals: ProjectStrategySignal[];
};

/** 閲覧専用の会議・動向。共有本文の更新があるため30秒に限り共用し、更新ボタンでは再取得する。 */
export function loadWorkspaceMeetings(projectId: string, options?: { sinceDate?: string; force?: boolean }) {
  const since = options?.sinceDate;
  const key = `workspace-meetings:disclosure-v2:${projectId}:${since ?? "all"}`;
  return loadReferenceData(key, async (): Promise<WorkspaceMeetingsPayload> => {
    const params = new URLSearchParams();
    if (since) params.set("since", since);
    const response = await fetch(`/api/project/${encodeURIComponent(projectId)}/workspace-meetings?${params}`);
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error("動向・会議を読み込めない");
    return payload;
  }, { ttlMs: 30_000, force: options?.force });
}
