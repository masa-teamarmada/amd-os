import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/api-auth";
import {
  buildContractSignalCandidates,
  CONTRACT_SIGNAL_SOURCE_KINDS,
  type ContractSignalSourceKind,
  type ContractSourceEvidence,
} from "@/lib/contracts";

export const runtime = "nodejs";

function truncate(value: unknown, maxLength: number) {
  const text = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function sourceKindFromSourceCache(source: string): ContractSignalSourceKind | null {
  const normalized = source.toLowerCase();
  if (normalized.startsWith("gmail")) return "gmail";
  if (normalized.startsWith("slack")) return "slack";
  if (normalized.startsWith("drive")) return "drive";
  if (normalized.startsWith("notion")) return "notion";
  if (normalized.startsWith("calendar")) return "calendar";
  return null;
}

function sourceKindFromMeeting(row: { source_kinds?: string | null; notion_url?: string | null; source_url?: string | null; narrative_md?: string | null }) {
  const sourceKinds = String(row.source_kinds || "").toLowerCase();
  const haystack = `${sourceKinds}\n${row.notion_url || ""}\n${row.source_url || ""}\n${row.narrative_md || ""}`.toLowerCase();
  if (haystack.includes("drive")) return "drive";
  if (haystack.includes("notion")) return "notion";
  return "calendar";
}

function countBySource(candidates: Array<{ sourceKind: string }>) {
  return Object.fromEntries(
    CONTRACT_SIGNAL_SOURCE_KINDS.map((kind) => [kind, candidates.filter((candidate) => candidate.sourceKind === kind).length]),
  );
}

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const url = new URL(req.url);
  const days = Math.max(1, Math.min(365, Number(url.searchParams.get("days") || 90) || 90));
  const limit = Math.max(10, Math.min(500, Number(url.searchParams.get("limit") || 160) || 160));
  const projectId = url.searchParams.get("project_id")?.trim() || "";
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const admin = createAdminClient();

  try {
    let sourceCacheQuery = admin
      .from("source_cache")
      .select("cache_id,project_id,source,item_id,title,item_date,content_text,metadata_json")
      .gte("collected_at", since)
      .order("collected_at", { ascending: false })
      .limit(limit);
    if (projectId) sourceCacheQuery = sourceCacheQuery.eq("project_id", projectId);

    let meetingsQuery = admin
      .from("project_meeting_summaries")
      .select("meeting_id,project_id,meeting_date,meeting_start_at,title,summary_short,narrative_md,decided,next_actions,risks,source_kinds,source_url,notion_url")
      .gte("meeting_date", since.slice(0, 10))
      .order("meeting_date", { ascending: false })
      .limit(limit);
    if (projectId) meetingsQuery = meetingsQuery.eq("project_id", projectId);

    const [sourceCacheRes, meetingsRes] = await Promise.all([sourceCacheQuery, meetingsQuery]);
    if (sourceCacheRes.error) throw sourceCacheRes.error;
    if (meetingsRes.error) throw meetingsRes.error;

    const sourceCacheEvidence = (sourceCacheRes.data ?? [])
      .map((row): ContractSourceEvidence | null => {
        const sourceKind = sourceKindFromSourceCache(String(row.source || ""));
        if (!sourceKind) return null;
        const metadata = (row.metadata_json ?? {}) as Record<string, unknown>;
        return {
          sourceKind,
          sourceTable: "source_cache" as const,
          sourceId: String(row.cache_id || row.item_id || ""),
          projectId: String(row.project_id || ""),
          title: truncate(row.title || row.item_id, 180),
          snippet: truncate(row.content_text, 700),
          sourceUrl: typeof metadata.url === "string"
            ? metadata.url
            : typeof metadata.webViewLink === "string"
              ? metadata.webViewLink
              : null,
          itemDate: typeof row.item_date === "string" ? row.item_date : null,
          metadata,
        };
      })
      .filter((item): item is ContractSourceEvidence => item !== null && Boolean(item.projectId && item.sourceId));

    const meetingEvidence: ContractSourceEvidence[] = (meetingsRes.data ?? []).map((row) => {
      const decided = Array.isArray(row.decided) ? row.decided.join(" / ") : "";
      const nextActions = Array.isArray(row.next_actions) ? row.next_actions.join(" / ") : "";
      const risks = Array.isArray(row.risks) ? row.risks.join(" / ") : "";
      return {
        sourceKind: sourceKindFromMeeting(row),
        sourceTable: "project_meeting_summaries",
        sourceId: String(row.meeting_id),
        projectId: String(row.project_id),
        title: truncate(row.title, 180),
        snippet: truncate([row.summary_short, decided, nextActions, risks, row.narrative_md].filter(Boolean).join(" / "), 700),
        sourceUrl: row.notion_url || row.source_url || null,
        itemDate: row.meeting_start_at || row.meeting_date || null,
        metadata: { source_kinds: row.source_kinds },
      };
    });

    const sources = [...sourceCacheEvidence, ...meetingEvidence];
    const candidates = buildContractSignalCandidates(sources).slice(0, limit);

    return NextResponse.json({
      ok: true,
      dryRun: true,
      projectId: projectId || null,
      days,
      sourceCounts: {
        source_cache: sourceCacheEvidence.length,
        project_meeting_summaries: meetingEvidence.length,
        byKind: countBySource(sources),
      },
      candidateCounts: {
        total: candidates.length,
        highConfidence: candidates.filter((candidate) => !candidate.reviewRequired).length,
        reviewRequired: candidates.filter((candidate) => candidate.reviewRequired).length,
        byKind: countBySource(candidates),
      },
      candidates,
      safety: "dry-run only: no contracts, signals, Drive files, or Slack messages were created",
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "unknown",
    }, { status: 500 });
  }
}
