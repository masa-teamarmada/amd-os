import type { Holder, CapitalEvent, ValidationIssue } from "./capital-plan";
export interface CapitalPlanRow {
  id: string;
  project_id: string;
  name: string;
  status: "active" | "archived";
  revision: number;
  document_json: { holders?: Holder[]; events?: CapitalEvent[] };
  created_by_email?: string;
  updated_by_email?: string;
  created_at: string;
  updated_at: string;
  latest_frozen_version?: number | null;
}

export interface CapitalPlanVersionRow {
  id: string;
  plan_id: string;
  project_id: string;
  version: number;
  document_json: { holders?: Holder[]; events?: CapitalEvent[] };
  source_revision: number;
  validation_summary: { blockingIssues?: ValidationIssue[]; warnings?: ValidationIssue[] };
  published_by_email?: string;
  published_at: string;
}

export type CapitalPlanPageData = { plans: CapitalPlanRow[]; versions: CapitalPlanVersionRow[] };
