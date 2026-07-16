export type ScheduleScope = "company" | "project";
export type ScheduleCategory = "tax" | "labor" | "contract" | "report" | "invoice" | "receipt" | "payment" | "governance";
export type DatePrecision = "day" | "month" | "period" | "unknown";
export type AmountStatus = "exact" | "estimated" | "unknown" | "not_applicable";
export type AmountRole = "outgoing" | "incoming" | "contract_reference" | "informational";
export type LifecycleStatus = "open" | "completed" | "cancelled" | "needs_source" | "superseded";
export type GenerationState = "generated" | "needs_source" | "source_stale" | "generation_stale" | "rule_stale" | "superseded";
export type NotificationOwner = "payment_obligation" | "company_schedule" | "none";

export type JsonRecord = Record<string, unknown>;

export type OperatingFact = {
  fact_id: string;
  fact_key: string;
  value_json: JsonRecord;
  source_kind: string;
  source_ref: string | null;
  source_hash: string;
  confidence: number;
  valid_from: string | null;
  valid_to: string | null;
  observed_at: string;
  verified_at: string | null;
  superseded_at: string | null;
  updated_at: string;
};

export type ScheduleRuleCheck = {
  rule_check_id: string;
  rule_key: string;
  rule_version: string;
  official_url: string;
  checked_at: string;
  content_hash: string;
  previous_hash: string | null;
  status: "clean" | "changed" | "error" | "reviewed";
  review_after: string | null;
  note: string | null;
};

export type ScheduleOccurrence = {
  occurrence_id: string;
  occurrence_key: string;
  source_hash: string;
  current_version: boolean;
  scope: ScheduleScope;
  category: ScheduleCategory;
  event_kind: string;
  title: string;
  period_key: string | null;
  due_on: string | null;
  due_ym: string | null;
  date_precision: DatePrecision;
  date_kind: string;
  amount_yen: number | null;
  amount_status: AmountStatus;
  amount_role: AmountRole;
  project_id: string | null;
  owner_member_id: string | null;
  source_kind: string;
  source_id: string | null;
  source_refs_json: unknown[];
  rule_key: string | null;
  rule_version: string | null;
  official_refs_json: unknown[];
  resolution_href: string | null;
  missing_reason: string | null;
  source_observed_at: string | null;
  rule_review_after: string | null;
  lifecycle_status: LifecycleStatus;
  generation_state: GenerationState;
  notification_owner: NotificationOwner;
  metadata_json: JsonRecord;
  generated_at: string;
  last_seen_at: string;
  superseded_at: string | null;
  updated_at: string;
};

export type ScheduleAction = {
  action_id: string;
  occurrence_id: string;
  action: "completed" | "not_applicable" | "reopened";
  acted_at: string;
  acted_by_member_id: string;
  evidence_ref: string | null;
  reason: string | null;
};

export type ScheduleMember = {
  member_id: string;
  code_name: string;
  member_name?: string | null;
  slack_id?: string | null;
};

export type ScheduleProject = {
  project_id: string;
  project_name: string;
  client_name?: string | null;
  status?: string | null;
};

export type ScheduleViewOccurrence = ScheduleOccurrence & {
  owner_label: string | null;
  project_label: string | null;
  latest_action: ScheduleAction | null;
  freshness_state: GenerationState;
  computed_status: "overdue" | "due_today" | "due_soon" | "open" | "completed" | "cancelled" | "needs_source";
};

export type ScheduleViewData = {
  from: string;
  to: string;
  occurrences: ScheduleViewOccurrence[];
  members: ScheduleMember[];
  projects: ScheduleProject[];
  ruleChecks: ScheduleRuleCheck[];
  facts: OperatingFact[];
  meta: {
    generatedCount: number;
    needsSourceCount: number;
    staleRuleCount: number;
    staleOccurrenceCount: number;
    lastGeneratedAt: string | null;
    schemaReady: boolean;
    errors: string[];
  };
};

export type GeneratedOccurrence = Omit<ScheduleOccurrence, "occurrence_id" | "generated_at" | "last_seen_at" | "updated_at" | "superseded_at" | "current_version"> & {
  generated_at?: string;
  last_seen_at?: string;
  updated_at?: string;
};

export type RuleDefinition = {
  ruleKey: string;
  ruleVersion: string;
  category: ScheduleCategory;
  officialRefs: Array<{ label: string; url: string; asOf: string }>;
  reviewAfter: string;
};
