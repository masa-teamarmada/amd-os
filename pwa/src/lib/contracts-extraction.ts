import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildContractSignalCandidates,
  CONTRACT_SIGNAL_SOURCE_KINDS,
  type ContractSignalCandidate,
  type ContractSignalSourceKind,
  type ContractSourceEvidence,
} from "@/lib/contracts";

type ExtractionOptions = {
  days?: number;
  limit?: number;
  projectId?: string;
  dryRun?: boolean;
  force?: boolean;
  source?: string;
};

type ContractSignalRow = {
  signal_id: string;
  contract_id: string | null;
  project_id: string;
  source_kind: string;
  source_table: string;
  source_id: string;
  signal_type: string;
  review_required: boolean;
  status: string;
};

type ProjectSummary = {
  projectId: string;
  sourceHash: string;
  sourceCount: number;
  candidateCount: number;
  skippedUnchanged: boolean;
  signalsUpserted: number;
  contractsCreated: number;
  reviewRequired: number;
  highConfidence: number;
};

export type ContractL2ExtractionResult = {
  ok: true;
  dryRun: boolean;
  l2Kind: "contract_signals";
  days: number;
  limit: number;
  projectId: string | null;
  sourceCounts: {
    source_cache: number;
    project_meeting_summaries: number;
    byKind: Record<string, number>;
  };
  candidateCounts: {
    total: number;
    highConfidence: number;
    reviewRequired: number;
    byKind: Record<string, number>;
  };
  writeCounts: {
    signalsUpserted: number;
    contractsCreated: number;
    notificationsUpserted: number;
    stateUpserted: number;
    skippedUnchangedProjects: number;
  };
  projectSummaries: ProjectSummary[];
  candidates: ContractSignalCandidate[];
  safety: string;
};

function truncate(value: unknown, maxLength: number) {
  const text = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}...` : text;
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

function sourceKindFromMeeting(row: {
  source_kinds?: string | null;
  notion_url?: string | null;
  source_url?: string | null;
  narrative_md?: string | null;
}) {
  const sourceKinds = String(row.source_kinds || "").toLowerCase();
  const haystack = `${sourceKinds}\n${row.notion_url || ""}\n${row.source_url || ""}\n${row.narrative_md || ""}`.toLowerCase();
  if (haystack.includes("drive")) return "drive";
  if (haystack.includes("notion")) return "notion";
  return "calendar";
}

function countBySource(items: Array<{ sourceKind: string }>) {
  return Object.fromEntries(
    CONTRACT_SIGNAL_SOURCE_KINDS.map((kind) => [kind, items.filter((item) => item.sourceKind === kind).length]),
  );
}

function stableHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function groupByProject<T extends { projectId: string }>(items: T[]) {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const current = map.get(item.projectId) ?? [];
    current.push(item);
    map.set(item.projectId, current);
  }
  return map;
}

function sourceRef(candidate: ContractSignalCandidate) {
  return {
    source_kind: candidate.sourceKind,
    source_table: candidate.sourceTable,
    source_id: candidate.sourceId,
    source_url: candidate.sourceUrl,
    title: candidate.title,
    item_date: candidate.itemDate,
    detected_terms: candidate.detectedTerms,
    snippet: candidate.snippet,
  };
}

function contractTitle(candidate: ContractSignalCandidate) {
  const typeLabel: Record<string, string> = {
    nda: "NDA",
    outsourcing: "業務委託契約",
    joint_research: "共同研究契約",
    mou: "MOU/覚書",
    order: "発注/注文",
    contract: "契約",
  };
  return truncate(`${typeLabel[candidate.signalType] ?? "契約"}: ${candidate.title}`, 180) || "契約予定枠";
}

export async function collectContractSignalSources(
  db: SupabaseClient,
  options: Pick<ExtractionOptions, "days" | "limit" | "projectId"> = {},
) {
  const days = Math.max(1, Math.min(365, Number(options.days ?? 90) || 90));
  const limit = Math.max(10, Math.min(1000, Number(options.limit ?? 240) || 240));
  const projectId = options.projectId?.trim() || "";
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  let sourceCacheQuery = db
    .from("source_cache")
    .select("cache_id,project_id,source,item_id,title,item_date,content_text,metadata_json,collected_at")
    .gte("collected_at", since)
    .order("collected_at", { ascending: false })
    .limit(limit);
  if (projectId) sourceCacheQuery = sourceCacheQuery.eq("project_id", projectId);

  let meetingsQuery = db
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
        sourceTable: "source_cache",
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

  return {
    days,
    limit,
    projectId: projectId || null,
    sourceCacheEvidence,
    meetingEvidence,
    sources,
    candidates,
  };
}

export async function extractContractL2Data(
  db: SupabaseClient,
  options: ExtractionOptions = {},
): Promise<ContractL2ExtractionResult> {
  const dryRun = Boolean(options.dryRun);
  const force = Boolean(options.force);
  const source = options.source || "claude-l2-daily-contract-extract";
  const collected = await collectContractSignalSources(db, options);
  const candidatesByProject = groupByProject(collected.candidates);
  const sourcesByProject = groupByProject(collected.sources);
  const projectSummaries: ProjectSummary[] = [];
  let signalsUpserted = 0;
  let contractsCreated = 0;
  let notificationsUpserted = 0;
  let stateUpserted = 0;
  let skippedUnchangedProjects = 0;

  const projectIds = Array.from(new Set([...sourcesByProject.keys(), ...candidatesByProject.keys()])).sort();
  for (const projectId of projectIds) {
    const projectSources = sourcesByProject.get(projectId) ?? [];
    const projectCandidates = candidatesByProject.get(projectId) ?? [];
    const sourceHash = stableHash({
      projectId,
      candidates: projectCandidates.map((candidate) => ({
        candidateId: candidate.candidateId,
        confidence: candidate.confidence,
        terms: candidate.detectedTerms,
      })),
      sources: projectSources.map((item) => ({
        table: item.sourceTable,
        id: item.sourceId,
        date: item.itemDate,
      })),
    });

    let skippedUnchanged = false;
    if (!dryRun && !force) {
      const { data: stateRow, error: stateError } = await db
        .from("l2_extract_state")
        .select("source_hash")
        .eq("l2_kind", "contract_signals")
        .eq("target_id", projectId)
        .eq("scope_key", "daily")
        .maybeSingle();
      if (stateError) throw stateError;
      skippedUnchanged = stateRow?.source_hash === sourceHash;
    }

    if (skippedUnchanged) {
      skippedUnchangedProjects += 1;
      projectSummaries.push({
        projectId,
        sourceHash,
        sourceCount: projectSources.length,
        candidateCount: projectCandidates.length,
        skippedUnchanged: true,
        signalsUpserted: 0,
        contractsCreated: 0,
        reviewRequired: projectCandidates.filter((candidate) => candidate.reviewRequired).length,
        highConfidence: projectCandidates.filter((candidate) => !candidate.reviewRequired).length,
      });
      const { error: touchStateError } = await db
        .from("l2_extract_state")
        .upsert({
          l2_kind: "contract_signals",
          target_id: projectId,
          scope_key: "daily",
          source_hash: sourceHash,
          saved_count: 0,
          total_count: projectCandidates.length,
          llm_model: "rules:contract_signal_terms_v1",
          message: "skipped_unchanged",
          last_processed_at: new Date().toISOString(),
        }, { onConflict: "l2_kind,target_id,scope_key" });
      if (touchStateError) throw touchStateError;
      stateUpserted += 1;
      continue;
    }

    let projectSignalsUpserted = 0;
    let projectContractsCreated = 0;
    if (!dryRun && projectCandidates.length > 0) {
      const signalPayloads = projectCandidates.map((candidate) => ({
        project_id: candidate.projectId,
        source_kind: candidate.sourceKind,
        source_table: candidate.sourceTable,
        source_id: candidate.sourceId,
        source_url: candidate.sourceUrl,
        title: candidate.title,
        snippet: candidate.snippet,
        detected_terms: candidate.detectedTerms,
        signal_type: candidate.signalType,
        confidence: candidate.confidence,
        review_required: candidate.reviewRequired,
        status: candidate.reviewRequired ? "candidate" : "accepted",
        metadata_json: {
          candidate_id: candidate.candidateId,
          proposed_action: candidate.proposedAction,
          reason: candidate.reason,
          item_date: candidate.itemDate,
          source,
        },
      }));
      const { data: signalRows, error: signalError } = await db
        .from("contract_signals")
        .upsert(signalPayloads, { onConflict: "source_kind,source_table,source_id,signal_type" })
        .select("signal_id,contract_id,project_id,source_kind,source_table,source_id,signal_type,review_required,status");
      if (signalError) throw signalError;
      const rows = (signalRows ?? []) as ContractSignalRow[];
      projectSignalsUpserted = rows.length;
      signalsUpserted += rows.length;

      const relinkedRows = rows.filter((row) => row.contract_id && row.status !== "linked");
      if (relinkedRows.length > 0) {
        const { error: relinkError } = await db
          .from("contract_signals")
          .update({ status: "linked" })
          .in("signal_id", relinkedRows.map((row) => row.signal_id));
        if (relinkError) throw relinkError;
      }

      const rowsByKey = new Map(rows.map((row) => [
        `${row.source_kind}:${row.source_table}:${row.source_id}:${row.signal_type}`,
        row,
      ]));
      for (const candidate of projectCandidates.filter((item) => !item.reviewRequired)) {
        const row = rowsByKey.get(`${candidate.sourceKind}:${candidate.sourceTable}:${candidate.sourceId}:${candidate.signalType}`);
        if (!row || row.contract_id) continue;
        const activityAt = candidate.itemDate && !Number.isNaN(new Date(candidate.itemDate).getTime())
          ? new Date(candidate.itemDate).toISOString()
          : new Date().toISOString();
        const { data: contract, error: contractError } = await db
          .from("contracts")
          .insert({
            project_id: candidate.projectId,
            contract_title: contractTitle(candidate),
            counterparty_name: null,
            contract_type: candidate.signalType,
            status: "planned",
            detected_at: activityAt,
            planned_at: activityAt,
            last_activity_at: activityAt,
            signal_confidence: candidate.confidence,
            review_required: false,
            review_status: "not_needed",
            source_summary: candidate.reason,
            source_refs_json: [sourceRef(candidate)],
            created_by: source,
            updated_by: source,
          })
          .select("contract_id")
          .single();
        if (contractError) throw contractError;
        const { error: linkError } = await db
          .from("contract_signals")
          .update({ contract_id: contract.contract_id, status: "linked" })
          .eq("signal_id", row.signal_id);
        if (linkError) throw linkError;
        projectContractsCreated += 1;
        contractsCreated += 1;
      }
    }

    if (!dryRun) {
      const reviewRequired = projectCandidates.filter((candidate) => candidate.reviewRequired).length;
      const highConfidence = projectCandidates.filter((candidate) => !candidate.reviewRequired).length;
      const { error: stateError } = await db
        .from("l2_extract_state")
        .upsert({
          l2_kind: "contract_signals",
          target_id: projectId,
          scope_key: "daily",
          source_hash: sourceHash,
          saved_count: projectSignalsUpserted + projectContractsCreated,
          total_count: projectCandidates.length,
          llm_model: "rules:contract_signal_terms_v1",
          message: `signals=${projectSignalsUpserted}, contracts=${projectContractsCreated}, review_required=${reviewRequired}`,
          last_processed_at: new Date().toISOString(),
        }, { onConflict: "l2_kind,target_id,scope_key" });
      if (stateError) throw stateError;
      stateUpserted += 1;

      if (projectCandidates.length > 0) {
        const { error: notificationError } = await db
          .from("l2_notifications")
          .upsert({
            l2_kind: "contract_signals",
            target_id: projectId,
            scope_key: "daily",
            title: `契約予兆 ${projectCandidates.length}件`,
            summary: `高確度 ${highConfidence}件 / review必要 ${reviewRequired}件。契約管理で確認。`,
            saved_count: projectSignalsUpserted + projectContractsCreated,
            total_count: projectCandidates.length,
            importance: highConfidence > 0 ? 2 : 1,
            metadata_json: {
              route: "/admin/contracts",
              high_confidence: highConfidence,
              review_required: reviewRequired,
              candidates: projectCandidates.slice(0, 10).map((candidate) => ({
                candidate_id: candidate.candidateId,
                title: candidate.title,
                source_kind: candidate.sourceKind,
                confidence: candidate.confidence,
                proposed_action: candidate.proposedAction,
              })),
            },
          }, { onConflict: "l2_kind,target_id,scope_key" });
        if (notificationError) throw notificationError;
        notificationsUpserted += 1;
      }
    }

    projectSummaries.push({
      projectId,
      sourceHash,
      sourceCount: projectSources.length,
      candidateCount: projectCandidates.length,
      skippedUnchanged: false,
      signalsUpserted: projectSignalsUpserted,
      contractsCreated: projectContractsCreated,
      reviewRequired: projectCandidates.filter((candidate) => candidate.reviewRequired).length,
      highConfidence: projectCandidates.filter((candidate) => !candidate.reviewRequired).length,
    });
  }

  return {
    ok: true,
    dryRun,
    l2Kind: "contract_signals",
    days: collected.days,
    limit: collected.limit,
    projectId: collected.projectId,
    sourceCounts: {
      source_cache: collected.sourceCacheEvidence.length,
      project_meeting_summaries: collected.meetingEvidence.length,
      byKind: countBySource(collected.sources),
    },
    candidateCounts: {
      total: collected.candidates.length,
      highConfidence: collected.candidates.filter((candidate) => !candidate.reviewRequired).length,
      reviewRequired: collected.candidates.filter((candidate) => candidate.reviewRequired).length,
      byKind: countBySource(collected.candidates),
    },
    writeCounts: {
      signalsUpserted,
      contractsCreated,
      notificationsUpserted,
      stateUpserted,
      skippedUnchangedProjects,
    },
    projectSummaries,
    candidates: dryRun ? collected.candidates : collected.candidates.slice(0, 80),
    safety: dryRun
      ? "dry-run only: no contracts, signals, Drive files, or Slack messages were created"
      : "wrote metadata only: contract files stay in Drive, raw source bodies are not stored, Slack messages were not sent",
  };
}
