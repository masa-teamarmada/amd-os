/* eslint-disable @typescript-eslint/no-explicit-any -- this reader must tolerate a database before migration 178 is applied. */
import { isIsoDate, todayJst, ymInRange } from "@/lib/admin-schedule/date";
import { computedScheduleStatus } from "@/lib/admin-schedule/predicates";
import type {
  OperatingFact,
  ScheduleAction,
  ScheduleMember,
  ScheduleOccurrence,
  ScheduleProject,
  ScheduleRuleCheck,
  ScheduleViewData,
  ScheduleViewOccurrence,
  GenerationState,
} from "@/lib/admin-schedule/types";

export type ScheduleReadDb = {
  from: (table: string) => any;
};

type RawRow = Record<string, any>;

function dateOnly(value: unknown): string | null {
  const match = String(value ?? "").match(/^(\d{4}-\d{2}-\d{2})/);
  return match && isIsoDate(match[1]) ? match[1] : null;
}

function memberLabel(member: RawRow | undefined): string | null {
  if (!member) return null;
  return String(member.member_name ?? member.code_name ?? member.email ?? member.member_id ?? "");
}

function projectLabel(project: RawRow | undefined): string | null {
  if (!project) return null;
  return String(project.project_name ?? project.name ?? project.client_name ?? project.project_id ?? "");
}

function inView(row: RawRow, from: string, to: string): boolean {
  const dueOn = dateOnly(row.due_on);
  if (dueOn) return dueOn >= from && dueOn <= to;
  if (row.due_ym) return ymInRange(String(row.due_ym), from, to);
  return true;
}

function statusFor(row: ScheduleOccurrence, latestAction: ScheduleAction | null, today: string): ScheduleViewOccurrence["computed_status"] {
  return computedScheduleStatus(row as unknown as Record<string, unknown>, latestAction?.action ?? null, today);
}

function freshnessFor(row: ScheduleOccurrence, today: string): GenerationState {
  if (row.lifecycle_status === "needs_source" || row.generation_state === "needs_source") return "needs_source";
  if (row.source_observed_at && row.generated_at && row.source_observed_at > row.generated_at) return "generation_stale";
  if (row.rule_review_after && row.rule_review_after < today) return "rule_stale";
  if (row.source_observed_at) {
    const observed = Date.parse(row.source_observed_at);
    const cutoff = Date.parse(`${today}T00:00:00Z`) - 180 * 86400000;
    if (Number.isFinite(observed) && observed < cutoff && !row.source_kind.startsWith("official_rule")) return "source_stale";
  }
  return row.generation_state ?? "generated";
}

function normalizeOccurrence(row: RawRow): ScheduleOccurrence {
  return {
    ...row,
    source_refs_json: Array.isArray(row.source_refs_json) ? row.source_refs_json : [],
    official_refs_json: Array.isArray(row.official_refs_json) ? row.official_refs_json : [],
    metadata_json: row.metadata_json && typeof row.metadata_json === "object" ? row.metadata_json : {},
    date_precision: row.date_precision ?? "unknown",
    amount_status: row.amount_status ?? "unknown",
    amount_role: row.amount_role ?? "informational",
    lifecycle_status: row.lifecycle_status ?? "open",
    generation_state: row.generation_state ?? (row.lifecycle_status === "needs_source" ? "needs_source" : "generated"),
    notification_owner: row.notification_owner ?? "none",
  } as ScheduleOccurrence;
}

export async function loadScheduleView(
  db: ScheduleReadDb,
  options: { from: string; to: string; now?: Date },
): Promise<ScheduleViewData> {
  const errors: string[] = [];
  const [occurrencesResult, membersResult, projectsResult, ruleChecksResult, factsResult] = await Promise.all([
    db.from("company_schedule_occurrences").select("*").eq("current_version", true).limit(20000),
    db.from("members").select("member_id,code_name,member_name,slack_id,status").eq("status", "active").limit(1000),
    db.from("projects").select("project_id,project_name,client_name,status").limit(5000),
    db.from("company_schedule_rule_checks").select("*").order("checked_at", { ascending: false }).limit(1000),
    db.from("company_operating_facts").select("*").is("superseded_at", null).limit(1000),
  ]);
  const results = [
    ["company_schedule_occurrences", occurrencesResult],
    ["members", membersResult],
    ["projects", projectsResult],
    ["company_schedule_rule_checks", ruleChecksResult],
    ["company_operating_facts", factsResult],
  ] as const;
  for (const [table, result] of results) if (result.error) errors.push(`${table}: ${result.error.message}`);

  const rawOccurrences = (occurrencesResult.data ?? []) as RawRow[];
  const occurrenceIds = rawOccurrences.map((row) => String(row.occurrence_id)).filter(Boolean);
  let actions: RawRow[] = [];
  if (occurrenceIds.length) {
    const actionsResult = await db.from("company_schedule_actions")
      .select("*")
      .in("occurrence_id", occurrenceIds)
      .order("acted_at", { ascending: false })
      .limit(50000);
    if (actionsResult.error) errors.push(`company_schedule_actions: ${actionsResult.error.message}`);
    else actions = (actionsResult.data ?? []) as RawRow[];
  }
  const latestActionByOccurrence = new Map<string, ScheduleAction>();
  for (const action of actions) {
    const occurrenceId = String(action.occurrence_id);
    if (!latestActionByOccurrence.has(occurrenceId)) latestActionByOccurrence.set(occurrenceId, action as ScheduleAction);
  }
  const members = (membersResult.data ?? []) as RawRow[];
  const projects = (projectsResult.data ?? []) as RawRow[];
  const membersById = new Map(members.map((member) => [String(member.member_id), member]));
  const projectsById = new Map(projects.map((project) => [String(project.project_id), project]));
  const today = todayJst(options.now);
  const occurrences: ScheduleViewOccurrence[] = rawOccurrences
    .filter((row) => inView(row, options.from, options.to))
    .map((row) => {
      const occurrence = normalizeOccurrence(row);
      const latestAction = latestActionByOccurrence.get(String(occurrence.occurrence_id)) ?? null;
      return {
        ...occurrence,
        owner_label: memberLabel(membersById.get(String(occurrence.owner_member_id))) || occurrence.owner_member_id,
        project_label: projectLabel(projectsById.get(String(occurrence.project_id))) || occurrence.project_id,
        latest_action: latestAction,
        freshness_state: freshnessFor(occurrence, today),
        computed_status: statusFor(occurrence, latestAction, today),
      };
    })
    .sort((left, right) => {
      const leftDate = left.due_on ?? `${left.due_ym ?? "999999"}99`;
      const rightDate = right.due_on ?? `${right.due_ym ?? "999999"}99`;
      return leftDate.localeCompare(rightDate) || left.title.localeCompare(right.title);
    });
  const ruleChecks = (ruleChecksResult.data ?? []) as ScheduleRuleCheck[];
  const facts = (factsResult.data ?? []) as OperatingFact[];
  const generated = rawOccurrences.filter((row) => (row.generation_state ?? "generated") === "generated");
  const staleOccurrenceCount = occurrences.filter((row) => row.freshness_state !== "generated" && row.freshness_state !== "needs_source").length;
  const staleRuleCount = ruleChecks.filter((row) => row.status === "changed" || row.status === "error" || (row.review_after && row.review_after < today)).length;
  const generatedTimes = rawOccurrences.map((row) => String(row.generated_at ?? "")).filter(Boolean).sort();
  return {
    from: options.from,
    to: options.to,
    occurrences,
    members: members as ScheduleMember[],
    projects: projects as ScheduleProject[],
    ruleChecks,
    facts,
    meta: {
      generatedCount: generated.length,
      needsSourceCount: rawOccurrences.filter((row) => row.lifecycle_status === "needs_source" || row.missing_reason).length,
      staleRuleCount,
      staleOccurrenceCount,
      lastGeneratedAt: generatedTimes.at(-1) ?? null,
      schemaReady: !occurrencesResult.error,
      errors,
    },
  };
}
