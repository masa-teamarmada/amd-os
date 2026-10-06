"use client";
import { loadReferenceData } from "@/lib/reference-data-cache";
import { parseDevelopmentIssues } from "./project-development-issues";
export function loadProjectDevelopmentIssuesClient(projectId: string) {
  return loadReferenceData("development-issues:" + projectId, async () => {
    const response = await fetch("/api/project-development-issues?projectId=" + encodeURIComponent(projectId));
    const body = await response.json();
    if (!response.ok || !body.ok) throw new Error("開発課題を読み込めなかった");
    return parseDevelopmentIssues(body.issues);
  }, { ttlMs: 30_000 });
}
