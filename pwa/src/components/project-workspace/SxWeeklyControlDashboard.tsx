"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronRight,
  CircleDot,
  ExternalLink,
  FileSearch,
  FlaskConical,
  GitBranch,
  Mail,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Target,
  X,
} from "lucide-react";
import type {
  CurrentMemberAccess,
  ProjectWorkspaceBundle,
} from "@/lib/project-workspace";
import type {
  SxConfidence,
  SxActionItem,
  SxActorSide,
  SxDependency,
  SxDecisionRecord,
  SxHypothesis,
  SxManagementBundle,
  SxManagementIssue,
  SxManagementMilestone,
  SxManagementPartner,
  SxPartnerInteraction,
  SxPartnerRole,
  SxPartnerWorkItem,
  SxTask,
  SxTrackKey,
} from "@/lib/sx-management";
import { deriveSxUnifiedTimeline } from "@/lib/sx-executive-control-deck";
import { sxProjectOwnerLoads } from "@/lib/sx-project-owner-load";
import {
  sxGateRequirementsBySuccessor,
  sxOralAgreementEvidenceReady,
  type SxGateRequirement,
} from "@/lib/sx-gate-requirements";
import {
  sxWeeklyIssueAttentionScore,
  sxWeeklyIssueIsOverdue,
  sxWeeklyIssueIsStale,
  sxWeeklyIssueLastActivity,
  sxWeeklyIssueNeedsAttention,
  sxWeeklyIssueNextDueDate,
  sxWeeklyIssueNextMove,
  sxWeeklyIssueStage,
  sxWeeklyValueMissing,
  sxWeeklyWeekRangeLabel,
  type SxWeeklyIssueStage,
} from "@/lib/sx-weekly-control";
import { SxUnifiedTimeline } from "./SxUnifiedTimeline";
import { SxPartnerPipeline } from "./SxPartnerPipeline";
import { SxProjectOwnerWorkload } from "./SxProjectOwnerWorkload";
import styles from "./weekly-control.module.css";

type StageKey = SxWeeklyIssueStage;
type ViewFilter = "all" | "attention" | "stale" | "overdue";
type EditorState =
  | { kind: "create_issue" }
  | { kind: "create_hypothesis_any" }
  | { kind: "edit_issue"; issue: SxManagementIssue }
  | { kind: "create_hypothesis"; issue: SxManagementIssue }
  | {
      kind: "edit_hypothesis";
      issue: SxManagementIssue;
      hypothesis: SxHypothesis;
    }
  | {
      kind: "create_evidence";
      issue: SxManagementIssue;
      hypothesis?: SxHypothesis;
    }
  | {
      kind: "create_validation";
      issue: SxManagementIssue;
      hypothesis: SxHypothesis;
    }
  | {
      kind: "create_decision";
      issue: SxManagementIssue;
      hypothesis?: SxHypothesis;
    }
  | {
      kind: "edit_decision";
      issue: SxManagementIssue;
      decision: SxDecisionRecord;
    }
  | {
      kind: "create_action";
      issue: SxManagementIssue;
      decision: SxDecisionRecord;
    }
  | {
      kind: "edit_action";
      issue: SxManagementIssue;
      decision: SxDecisionRecord;
      action: SxActionItem;
    }
  | { kind: "create_milestone"; track: SxTrackKey | null }
  | { kind: "edit_milestone"; milestone: SxManagementMilestone }
  | {
      kind: "create_task";
      milestone: SxManagementMilestone;
      parentTask: SxTask | null;
    }
  | { kind: "edit_task"; task: SxTask }
  | { kind: "create_dependency"; successor: SxManagementMilestone }
  | { kind: "edit_dependency"; dependency: SxDependency }
  | { kind: "create_partner" }
  | { kind: "edit_partner"; partner: SxManagementPartner }
  | { kind: "create_interaction"; partnerId: string }
  | { kind: "edit_interaction"; interaction: SxPartnerInteraction }
  | { kind: "create_partner_work_item"; partnerId: string; side: SxActorSide }
  | { kind: "edit_partner_work_item"; workItem: SxPartnerWorkItem }
  | { kind: "create_partner_role"; partnerId: string }
  | { kind: "edit_partner_role"; role: SxPartnerRole };

type FormField = {
  key: string;
  label: string;
  type?: "text" | "textarea" | "date" | "number" | "select" | "checkbox";
  required?: boolean;
  span?: boolean;
  options?: Array<{ value: string; label: string }>;
  help?: string;
};

const TRACKS: Array<{
  key: SxTrackKey;
  label: string;
  short: string;
  accent: string;
}> = [
  {
    key: "business_development",
    label: "事業開発",
    short: "事業",
    accent: "#315f7d",
  },
  {
    key: "technology_development",
    label: "技術開発",
    short: "技術",
    accent: "#38745d",
  },
  { key: "funding", label: "資金調達", short: "資金", accent: "#b56d20" },
  {
    key: "organizational_building",
    label: "体制構築",
    short: "体制",
    accent: "#76637b",
  },
];

const STAGES: Array<{ key: StageKey; index: string; label: string }> = [
  { key: "intake", index: "01", label: "要整理" },
  { key: "validating", index: "02", label: "検証中" },
  { key: "decision", index: "03", label: "判断待ち" },
  { key: "resolved", index: "04", label: "決定・棄却" },
];

const CONFIDENCE_OPTIONS = [
  { value: "unknown", label: "未確認" },
  { value: "low", label: "低" },
  { value: "medium", label: "中" },
  { value: "high", label: "高" },
];

const DATE_PRECISION_OPTIONS = [
  { value: "unknown", label: "未確認" },
  { value: "month", label: "月まで" },
  { value: "day", label: "日まで" },
];
const BALL_SIDE_OPTIONS = [
  { value: "sx", label: "当方" },
  { value: "partner", label: "先方" },
  { value: "shared", label: "双方" },
  { value: "none", label: "該当なし" },
  { value: "unknown", label: "未確認" },
];
const ACTOR_SIDE_OPTIONS = BALL_SIDE_OPTIONS.filter(
  (item) => item.value !== "none",
);
const PARTNER_STAGE_OPTIONS = [
  { value: "candidate", label: "候補" },
  { value: "information_exchange", label: "情報交換" },
  { value: "condition_alignment", label: "条件整理" },
  { value: "meeting_coordination", label: "面談調整" },
  { value: "validation_preparation", label: "検証準備" },
  { value: "agreement_confirmation", label: "合意確認" },
  { value: "executing", label: "実行中" },
  { value: "on_hold", label: "保留" },
];
const ROLE_KIND_OPTIONS = [
  { value: "joint_development", label: "共同開発" },
  { value: "contract_manufacturing", label: "製造委託" },
  { value: "customer", label: "顧客" },
  { value: "shareholder_investor", label: "株主・投資" },
  { value: "government", label: "自治体" },
  { value: "media", label: "メディア" },
  { value: "financial_institution", label: "金融機関" },
  { value: "university_research", label: "大学・研究機関" },
  { value: "support_organization", label: "支援機関" },
  { value: "other", label: "その他" },
  { value: "unclassified", label: "未分類" },
];

function formatDate(value: string | null | undefined) {
  if (!value) return "未設定";
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${Number(match[2])}/${Number(match[3])}` : value;
}

function trackMeta(track: SxTrackKey) {
  return TRACKS.find((item) => item.key === track) || TRACKS[0];
}

function issueStatusLabel(status: SxManagementIssue["status"]) {
  return (
    (
      {
        open: "未解決",
        validating: "検証中",
        decided: "判断済み",
        closed: "完了",
        on_hold: "保留",
      } as const
    )[status] || status
  );
}

function hypothesisStatusLabel(status: SxHypothesis["status"]) {
  return (
    (
      {
        open: "未着手",
        validating: "検証中",
        validated: "検証済み",
        rejected: "棄却",
        decided: "判断済み",
        on_hold: "保留",
      } as const
    )[status] || status
  );
}

function confidenceLabel(confidence: SxConfidence) {
  return ({ high: "高", medium: "中", low: "低", unknown: "未確認" } as const)[
    confidence
  ];
}

function issueKindLabel(kind: SxManagementIssue["knowledgeType"]) {
  return (
    (
      {
        fact: "事実",
        hypothesis: "仮説",
        decision_needed: "判断要",
        decision: "旧分類",
      } as const
    )[kind] || kind
  );
}

function statusTone(status: string) {
  if (
    ["closed", "decided", "validated", "rejected", "completed"].includes(status)
  )
    return styles.toneResolved;
  if (["validating", "running"].includes(status)) return styles.toneValidating;
  if (["blocked"].includes(status)) return styles.toneDanger;
  if (["on_hold"].includes(status)) return styles.toneMuted;
  return styles.toneOpen;
}

function fieldValue(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return value == null ? "" : String(value);
}

function editorInitialValues(
  editor: EditorState,
  access: CurrentMemberAccess,
  asOf: string,
): Record<string, string> {
  if (editor.kind === "create_milestone")
    return {
      track: editor.track || "business_development",
      outcome_id: "",
      title: "",
      gate: "",
      planned_start: asOf,
      planned_end: "",
      date_certainty: "provisional",
      owner_label: access.displayName,
      next_deliverable: "",
      max_issue: "未確認",
      completion_criteria: "",
      criticality: "high",
      confidence: "unknown",
    };
  if (editor.kind === "edit_milestone")
    return {
      title: editor.milestone.title,
      gate: editor.milestone.gate,
      status: editor.milestone.manualStatus,
      planned_start: editor.milestone.plannedStart || "",
      planned_end: editor.milestone.plannedEnd || "",
      actual_end: editor.milestone.actualEnd || "",
      progress_pct: String(editor.milestone.progressPct),
      date_certainty: editor.milestone.dateCertainty,
      owner_label: editor.milestone.ownerLabel,
      next_deliverable: editor.milestone.nextDeliverable,
      max_issue: editor.milestone.maxIssue,
      completion_criteria: editor.milestone.completionCriteria,
      completion_evidence: editor.milestone.completionEvidence || "",
      criticality: editor.milestone.criticality,
      confidence: editor.milestone.confidence,
    };
  if (editor.kind === "create_task")
    return {
      milestone_id: editor.milestone.id,
      parent_task_id: editor.parentTask?.id || "",
      track: editor.milestone.track,
      title: "",
      description: "",
      status: "unassessed",
      planned_start:
        editor.parentTask?.plannedStart ||
        editor.milestone.plannedStart ||
        asOf,
      planned_end:
        editor.parentTask?.plannedEnd || editor.milestone.plannedEnd || "",
      progress_pct: "0",
      date_certainty: "provisional",
      owner_label:
        editor.parentTask?.ownerLabel ||
        editor.milestone.ownerLabel ||
        access.displayName,
      completion_criteria: "",
      confidence: "unknown",
    };
  if (editor.kind === "edit_task")
    return {
      milestone_id: editor.task.milestoneId,
      parent_task_id: editor.task.parentTaskId || "",
      track: editor.task.track || "",
      title: editor.task.title,
      description: editor.task.description || "",
      status: editor.task.status,
      planned_start: editor.task.plannedStart || "",
      planned_end: editor.task.plannedEnd || "",
      actual_end: editor.task.actualEnd || "",
      progress_pct: String(editor.task.progressPct),
      date_certainty: editor.task.dateCertainty,
      owner_label: editor.task.ownerLabel,
      completion_criteria: editor.task.completionCriteria || "",
      confidence: editor.task.confidence,
    };
  if (editor.kind === "create_dependency")
    return {
      predecessor_milestone_id: "",
      successor_milestone_id: editor.successor.id,
      dependency_type: "finish_to_start",
      required: "true",
      lag_days: "0",
      note: "",
    };
  if (editor.kind === "edit_dependency")
    return {
      dependency_type: editor.dependency.dependencyType,
      required: editor.dependency.required ? "true" : "false",
      lag_days: String(editor.dependency.lagDays),
      note: editor.dependency.note || "",
    };
  if (editor.kind === "create_partner")
    return {
      name: "",
      role_label: "",
      primary_track: "business_development",
      relationship_stage: "candidate",
      agreement_state: "unagreed",
      agreed_scope: "未確認",
      unagreed_scope: "未確認",
      last_contact_date: "",
      next_commitment: "未確認",
      due_date: "",
      due_date_precision: "unknown",
      owner_label: access.displayName,
      current_ball_side: "unknown",
      current_ball_owner: "",
      target_state: "",
      confidence: "unknown",
    };
  if (editor.kind === "edit_partner")
    return {
      name: editor.partner.name,
      role_label: editor.partner.roleLabel,
      primary_track: editor.partner.track,
      relationship_stage: editor.partner.relationshipStage,
      agreement_state: editor.partner.agreementState,
      agreed_scope: editor.partner.agreedScope,
      unagreed_scope: editor.partner.unagreedScope,
      last_contact_date: editor.partner.lastContactDate || "",
      next_commitment: editor.partner.nextCommitment,
      due_date: editor.partner.dueDate || "",
      due_date_precision: editor.partner.dueDatePrecision,
      owner_label: editor.partner.ownerLabel,
      current_ball_side: editor.partner.currentBallSide,
      current_ball_owner: editor.partner.currentBallOwner || "",
      target_state: editor.partner.targetState || "",
      confidence: editor.partner.confidence,
    };
  if (editor.kind === "create_interaction")
    return {
      partner_id: editor.partnerId,
      interaction_kind: "email",
      occurred_on: asOf,
      occurred_on_precision: "day",
      summary: "",
      outcome_summary: "",
      ball_side_after: "unknown",
      ball_owner_after: "",
      actor_side: "unknown",
      actor_label: "",
      confidence: "unknown",
    };
  if (editor.kind === "edit_interaction")
    return {
      interaction_kind: editor.interaction.interactionKind,
      occurred_on: editor.interaction.occurredOn || "",
      occurred_on_precision: editor.interaction.occurredOnPrecision,
      summary: editor.interaction.summary,
      outcome_summary: editor.interaction.outcomeSummary || "",
      ball_side_after: editor.interaction.ballSideAfter,
      ball_owner_after: editor.interaction.ballOwnerAfter || "",
      actor_side: editor.interaction.actorSide,
      actor_label: editor.interaction.actorLabel || "",
      confidence: editor.interaction.confidence,
    };
  if (editor.kind === "create_partner_work_item")
    return {
      partner_id: editor.partnerId,
      side: editor.side,
      item_kind: "task",
      title: "",
      detail: "",
      owner_label: editor.side === "sx" ? access.displayName : "",
      status: "open",
      due_date: "",
      due_date_precision: "unknown",
      completion_criteria: "",
      completed_on: "",
      completion_evidence: "",
      accepted_by: "",
      accepted_on: "",
      related_milestone_id: "",
      confidence: "unknown",
      sort_order: "0",
    };
  if (editor.kind === "edit_partner_work_item")
    return {
      side: editor.workItem.side,
      item_kind: editor.workItem.itemKind,
      title: editor.workItem.title,
      detail: editor.workItem.detail || "",
      owner_label: editor.workItem.ownerLabel || "",
      status: editor.workItem.status,
      due_date: editor.workItem.dueDate || "",
      due_date_precision: editor.workItem.dueDatePrecision,
      completion_criteria: editor.workItem.completionCriteria || "",
      completed_on: editor.workItem.completedOn || "",
      completion_evidence: editor.workItem.completionEvidence || "",
      accepted_by: editor.workItem.acceptedBy || "",
      accepted_on: editor.workItem.acceptedOn || "",
      related_milestone_id: editor.workItem.relatedMilestoneId || "",
      confidence: editor.workItem.confidence,
      sort_order: String(editor.workItem.sortOrder),
    };
  if (editor.kind === "create_partner_role")
    return {
      partner_id: editor.partnerId,
      role_kind: "unclassified",
      relationship_state: "unconfirmed",
      role_label: "",
      is_primary: "false",
      sort_order: "0",
    };
  if (editor.kind === "edit_partner_role")
    return {
      role_kind: editor.role.roleKind,
      relationship_state: editor.role.relationshipState,
      role_label: editor.role.roleLabel || "",
      is_primary: editor.role.isPrimary ? "true" : "false",
      sort_order: String(editor.role.sortOrder),
    };
  if (editor.kind === "create_issue")
    return {
      track: "business_development",
      milestone_id: "",
      title: "",
      knowledge_type: "fact",
      status: "open",
      owner_label: access.displayName,
      due_date: "",
      confidence: "unknown",
    };
  if (editor.kind === "create_hypothesis_any")
    return {
      issue_id: "",
      statement: "",
      status: "open",
      owner_label: access.displayName,
      due_date: "",
      confidence: "unknown",
    };
  if (editor.kind === "edit_issue")
    return {
      title: editor.issue.title,
      knowledge_type:
        editor.issue.knowledgeType === "decision"
          ? "decision_needed"
          : editor.issue.knowledgeType,
      status:
        editor.issue.status === "decided" ? "closed" : editor.issue.status,
      owner_label: editor.issue.ownerLabel,
      due_date: editor.issue.dueDate || "",
      confidence: editor.issue.confidence,
    };
  if (editor.kind === "create_hypothesis")
    return {
      statement: "",
      status: "open",
      owner_label: sxWeeklyValueMissing(editor.issue.ownerLabel)
        ? access.displayName
        : editor.issue.ownerLabel,
      due_date: editor.issue.dueDate || "",
      confidence: "unknown",
    };
  if (editor.kind === "edit_hypothesis")
    return {
      statement: editor.hypothesis.statement,
      status: editor.hypothesis.status,
      owner_label: editor.hypothesis.ownerLabel,
      due_date: editor.hypothesis.dueDate || "",
      confidence: editor.hypothesis.confidence,
    };
  if (editor.kind === "create_evidence")
    return {
      hypothesis_id: editor.hypothesis?.id || "",
      evidence_kind: "observation",
      summary: "",
      observed_on: asOf,
      source_label: "週次管制画面",
      confidence: "unknown",
    };
  if (editor.kind === "create_validation")
    return {
      validation_kind: "",
      planned_on: asOf,
      due_date: editor.hypothesis.dueDate || "",
      status: "planned",
      owner_label: sxWeeklyValueMissing(editor.hypothesis.ownerLabel)
        ? access.displayName
        : editor.hypothesis.ownerLabel,
      method: "",
      confidence: "unknown",
    };
  if (editor.kind === "edit_decision")
    return {
      title: editor.decision.title,
      context: editor.decision.context,
      rationale: editor.decision.rationale,
      status: editor.decision.status,
      decision_text: editor.decision.decisionText || "",
      decided_by: editor.decision.decidedBy || "",
      decided_on: editor.decision.decidedOn || "",
      owner_label: editor.decision.ownerLabel,
      due_date: editor.decision.dueDate || "",
      is_this_week: editor.decision.isThisWeek ? "true" : "false",
      confidence: editor.decision.confidence,
    };
  if (editor.kind === "create_action")
    return {
      title: "",
      owner_label: sxWeeklyValueMissing(editor.decision.ownerLabel)
        ? access.displayName
        : editor.decision.ownerLabel,
      due_date: editor.decision.dueDate || "",
      completion_criteria: "",
      next_review_on: "",
      status: "open",
      completion_note: "",
      completed_at: "",
    };
  if (editor.kind === "edit_action")
    return {
      title: editor.action.title,
      owner_label: editor.action.ownerLabel,
      due_date: editor.action.dueDate || "",
      completion_criteria: editor.action.completionCriteria,
      next_review_on: editor.action.nextReviewOn || "",
      status: editor.action.status,
      completion_note: editor.action.completionNote || "",
      completed_at: editor.action.completedAt || "",
    };
  return {
    title: "",
    context: editor.issue.title,
    rationale: "",
    status: "open",
    owner_label: sxWeeklyValueMissing(editor.issue.ownerLabel)
      ? access.displayName
      : editor.issue.ownerLabel,
    due_date: editor.issue.dueDate || "",
    is_this_week: "true",
    confidence: "unknown",
  };
}

function editorDefinition(
  editor: EditorState,
  management: SxManagementBundle,
): {
  title: string;
  eyebrow: string;
  resource: string;
  method: "POST" | "PATCH";
  id?: string;
  fields: FormField[];
} {
  const confidence: FormField = {
    key: "confidence",
    label: "確度",
    type: "select",
    options: CONFIDENCE_OPTIONS,
  };
  const planStatus: FormField = {
    key: "status",
    label: "状態",
    type: "select",
    required: true,
    options: [
      { value: "unassessed", label: "進捗未登録" },
      { value: "on_track", label: "進行中" },
      { value: "attention", label: "要確認" },
      { value: "at_risk", label: "遅れ懸念" },
      { value: "blocked", label: "停止" },
      { value: "completed", label: "完了" },
    ],
  };
  const planFields: FormField[] = [
    {
      key: "title",
      label: "タスク名",
      type: "textarea",
      required: true,
      span: true,
    },
    planStatus,
    { key: "owner_label", label: "担当", required: true },
    { key: "planned_start", label: "計画開始", type: "date" },
    { key: "planned_end", label: "計画完了", type: "date" },
    {
      key: "progress_pct",
      label: "進捗率（%）",
      type: "number",
      required: true,
    },
    {
      key: "date_certainty",
      label: "日程の確度",
      type: "select",
      required: true,
      options: [
        { value: "provisional", label: "仮" },
        { value: "confirmed", label: "確定" },
      ],
    },
    {
      key: "completion_criteria",
      label: "完了条件",
      type: "textarea",
      span: true,
    },
    confidence,
  ];
  if (editor.kind === "create_milestone")
    return {
      title: "工程を追加",
      eyebrow: "工程",
      resource: "milestone",
      method: "POST",
      fields: [
        {
          key: "track",
          label: "柱",
          type: "select",
          required: true,
          options: TRACKS.map((track) => ({
            value: track.key,
            label: track.label,
          })),
        },
        {
          key: "outcome_id",
          label: "接続する成果",
          type: "select",
          required: true,
          options: [
            { value: "", label: "選択してね" },
            ...management.outcomes.map((outcome) => ({
              value: outcome.id,
              label: `${trackMeta(outcome.track).short}｜${outcome.title}`,
            })),
          ],
        },
        {
          key: "title",
          label: "工程名",
          type: "textarea",
          required: true,
          span: true,
        },
        { key: "gate", label: "成果ゲート", required: true },
        { key: "owner_label", label: "担当", required: true },
        { key: "planned_start", label: "計画開始", type: "date" },
        { key: "planned_end", label: "計画完了", type: "date" },
        {
          key: "date_certainty",
          label: "日程の確度",
          type: "select",
          required: true,
          options: [
            { value: "provisional", label: "仮" },
            { value: "confirmed", label: "確定" },
          ],
        },
        {
          key: "next_deliverable",
          label: "次の成果物",
          type: "textarea",
          required: true,
          span: true,
        },
        {
          key: "completion_criteria",
          label: "完了条件",
          type: "textarea",
          required: true,
          span: true,
        },
        {
          key: "criticality",
          label: "重要度",
          type: "select",
          required: true,
          options: [
            { value: "critical", label: "最重要" },
            { value: "high", label: "高" },
            { value: "medium", label: "中" },
            { value: "low", label: "低" },
          ],
        },
        confidence,
      ],
    };
  if (editor.kind === "edit_milestone")
    return {
      title: "工程を編集",
      eyebrow: "工程",
      resource: "milestone",
      method: "PATCH",
      id: editor.milestone.id,
      fields: [
        {
          key: "title",
          label: "工程名",
          type: "textarea",
          required: true,
          span: true,
        },
        { key: "gate", label: "成果ゲート", required: true },
        planStatus,
        { key: "owner_label", label: "担当", required: true },
        { key: "planned_start", label: "計画開始", type: "date" },
        { key: "planned_end", label: "計画完了", type: "date" },
        { key: "actual_end", label: "実績完了", type: "date" },
        {
          key: "progress_pct",
          label: "進捗率（%）",
          type: "number",
          required: true,
        },
        {
          key: "date_certainty",
          label: "日程の確度",
          type: "select",
          required: true,
          options: [
            { value: "provisional", label: "仮" },
            { value: "confirmed", label: "確定" },
          ],
        },
        {
          key: "next_deliverable",
          label: "次の成果物",
          type: "textarea",
          span: true,
        },
        {
          key: "max_issue",
          label: "最大の詰まり",
          type: "textarea",
          span: true,
        },
        {
          key: "completion_criteria",
          label: "完了条件",
          type: "textarea",
          span: true,
        },
        {
          key: "completion_evidence",
          label: "完了証跡",
          type: "textarea",
          span: true,
          help: [
            "business-paid-poc-oral-agreement",
            "funding-investment-oral-agreement",
          ].includes(editor.milestone.slug)
            ? "完了にするには、先方（または投資家）・合意内容・確認日・根拠を1行ずつ記録してね。例：先方：○○社"
            : "完了にする場合は、第三者が確認できる根拠を記録してね。",
        },
        {
          key: "criticality",
          label: "重要度",
          type: "select",
          required: true,
          options: [
            { value: "critical", label: "最重要" },
            { value: "high", label: "高" },
            { value: "medium", label: "中" },
            { value: "low", label: "低" },
          ],
        },
        confidence,
      ],
    };
  if (editor.kind === "create_task" || editor.kind === "edit_task")
    return {
      title:
        editor.kind === "create_task"
          ? editor.parentTask
            ? "子タスクを追加"
            : "タスクを追加"
          : "タスクを編集",
      eyebrow:
        editor.kind === "create_task" && editor.parentTask
          ? "子タスク"
          : "タスク",
      resource: "task",
      method: editor.kind === "create_task" ? "POST" : "PATCH",
      id: editor.kind === "edit_task" ? editor.task.id : undefined,
      fields: [
        ...(editor.kind === "edit_task"
          ? [
              {
                key: "parent_task_id",
                label: "親タスク",
                type: "select" as const,
                options: [
                  { value: "", label: "工程の直下" },
                  ...management.tasks
                    .filter(
                      (task) =>
                        task.milestoneId === editor.task.milestoneId &&
                        task.id !== editor.task.id,
                    )
                    .map((task) => ({ value: task.id, label: task.title })),
                ],
              },
            ]
          : []),
        ...planFields,
        { key: "description", label: "作業内容", type: "textarea", span: true },
        { key: "actual_end", label: "実績完了", type: "date" },
      ],
    };
  if (editor.kind === "create_dependency" || editor.kind === "edit_dependency")
    return {
      title:
        editor.kind === "create_dependency"
          ? "必須条件を追加"
          : "必須条件を編集",
      eyebrow: "進行ゲート",
      resource: "dependency",
      method: editor.kind === "create_dependency" ? "POST" : "PATCH",
      id: editor.kind === "edit_dependency" ? editor.dependency.id : undefined,
      fields: [
        ...(editor.kind === "create_dependency"
          ? [
              {
                key: "predecessor_milestone_id",
                label: "先へ進む前に満たす工程",
                type: "select" as const,
                required: true,
                span: true,
                options: [
                  { value: "", label: "工程を選んでね" },
                  ...management.milestones
                    .filter((milestone) => milestone.id !== editor.successor.id)
                    .map((milestone) => ({
                      value: milestone.id,
                      label: `${trackMeta(milestone.track).short}｜${milestone.gate || milestone.title}`,
                    })),
                ],
              },
              {
                key: "successor_milestone_id",
                label: "この工程",
                type: "select" as const,
                required: true,
                span: true,
                options: [
                  { value: editor.successor.id, label: editor.successor.title },
                ],
              },
            ]
          : []),
        {
          key: "dependency_type",
          label: "接続条件",
          type: "select",
          required: true,
          options: [
            { value: "finish_to_start", label: "前工程の完了後に進む" },
          ],
          help: "週次管制の必須ゲートは「前工程の完了＋証跡」を充足条件にするよ。",
        },
        {
          key: "required",
          label: "必須性",
          type: "select",
          required: true,
          options: [
            { value: "true", label: "必須" },
            { value: "false", label: "任意" },
          ],
        },
        { key: "lag_days", label: "待ち日数", type: "number", required: true },
        { key: "note", label: "条件の説明", type: "textarea", span: true },
      ],
    };
  if (editor.kind === "create_partner" || editor.kind === "edit_partner")
    return {
      title: editor.kind === "create_partner" ? "関係先を追加" : "関係先を編集",
      eyebrow: "関係先",
      resource: "partner",
      method: editor.kind === "create_partner" ? "POST" : "PATCH",
      id: editor.kind === "edit_partner" ? editor.partner.id : undefined,
      fields: [
        { key: "name", label: "関係先名", required: true },
        { key: "role_label", label: "役割", required: true },
        {
          key: "primary_track",
          label: "主な柱",
          type: "select",
          required: true,
          options: TRACKS.map((track) => ({
            value: track.key,
            label: track.label,
          })),
        },
        {
          key: "relationship_stage",
          label: "関係段階",
          type: "select",
          required: true,
          options: PARTNER_STAGE_OPTIONS,
        },
        {
          key: "agreement_state",
          label: "合意状態",
          type: "select",
          required: true,
          options: [
            { value: "agreed", label: "合意済み" },
            { value: "partial", label: "一部合意" },
            { value: "unagreed", label: "未合意" },
          ],
        },
        { key: "owner_label", label: "当方担当", required: true },
        {
          key: "agreed_scope",
          label: "合意済みの範囲",
          type: "textarea",
          required: true,
          span: true,
        },
        {
          key: "unagreed_scope",
          label: "未合意の範囲",
          type: "textarea",
          required: true,
          span: true,
        },
        {
          key: "next_commitment",
          label: "次にやること",
          type: "textarea",
          required: true,
          span: true,
        },
        {
          key: "current_ball_side",
          label: "現在の保有側",
          type: "select",
          required: true,
          options: BALL_SIDE_OPTIONS,
        },
        { key: "current_ball_owner", label: "現在の担当" },
        { key: "due_date", label: "期限", type: "date" },
        {
          key: "due_date_precision",
          label: "期限の精度",
          type: "select",
          required: true,
          options: DATE_PRECISION_OPTIONS,
        },
        { key: "last_contact_date", label: "直近接点", type: "date" },
        {
          key: "target_state",
          label: "目標状態",
          type: "textarea",
          span: true,
        },
        confidence,
      ],
    };
  if (
    editor.kind === "create_interaction" ||
    editor.kind === "edit_interaction"
  )
    return {
      title:
        editor.kind === "create_interaction"
          ? "やり取り履歴を追加"
          : "やり取り履歴を編集",
      eyebrow: "関係先の履歴",
      resource: "interaction",
      method: editor.kind === "create_interaction" ? "POST" : "PATCH",
      id:
        editor.kind === "edit_interaction" ? editor.interaction.id : undefined,
      fields: [
        {
          key: "interaction_kind",
          label: "接点種別",
          type: "select",
          required: true,
          options: [
            { value: "meeting", label: "面談" },
            { value: "email", label: "メール" },
            { value: "agreement", label: "合意" },
            { value: "deliverable", label: "成果物" },
            { value: "handoff", label: "引継ぎ" },
            { value: "status_update", label: "状況更新" },
            { value: "note", label: "メモ" },
          ],
        },
        { key: "occurred_on", label: "発生日", type: "date" },
        {
          key: "occurred_on_precision",
          label: "発生日の精度",
          type: "select",
          required: true,
          options: DATE_PRECISION_OPTIONS,
        },
        {
          key: "summary",
          label: "内容",
          type: "textarea",
          required: true,
          span: true,
        },
        {
          key: "outcome_summary",
          label: "結果・要点",
          type: "textarea",
          span: true,
        },
        {
          key: "actor_side",
          label: "行為主体",
          type: "select",
          required: true,
          options: ACTOR_SIDE_OPTIONS,
        },
        { key: "actor_label", label: "行為主体名" },
        {
          key: "ball_side_after",
          label: "接点後の保有側",
          type: "select",
          required: true,
          options: BALL_SIDE_OPTIONS,
        },
        { key: "ball_owner_after", label: "接点後の担当" },
        confidence,
      ],
    };
  if (
    editor.kind === "create_partner_work_item" ||
    editor.kind === "edit_partner_work_item"
  )
    return {
      title:
        editor.kind === "create_partner_work_item"
          ? "保有事項を追加"
          : "保有事項を編集",
      eyebrow: "誰が何を抱えているか",
      resource: "partner_work_item",
      method: editor.kind === "create_partner_work_item" ? "POST" : "PATCH",
      id:
        editor.kind === "edit_partner_work_item"
          ? editor.workItem.id
          : undefined,
      fields: [
        {
          key: "side",
          label: "保有側",
          type: "select",
          required: true,
          options: ACTOR_SIDE_OPTIONS,
        },
        {
          key: "item_kind",
          label: "種別",
          type: "select",
          required: true,
          options: [
            { value: "task", label: "タスク" },
            { value: "question", label: "質問" },
            { value: "deliverable", label: "成果物" },
            { value: "decision", label: "意思決定" },
            { value: "approval", label: "承認" },
            { value: "response", label: "回答" },
          ],
        },
        {
          key: "status",
          label: "状態",
          type: "select",
          required: true,
          options: [
            { value: "open", label: "未着手" },
            { value: "in_progress", label: "進行中" },
            { value: "waiting", label: "待ち" },
            { value: "blocked", label: "停止" },
            { value: "on_hold", label: "保留" },
            { value: "completed", label: "完了" },
            { value: "cancelled", label: "取消" },
          ],
        },
        {
          key: "title",
          label: "具体的にやること",
          type: "textarea",
          required: true,
          span: true,
        },
        { key: "detail", label: "詳細", type: "textarea", span: true },
        { key: "owner_label", label: "担当" },
        { key: "due_date", label: "期限", type: "date" },
        {
          key: "due_date_precision",
          label: "期限の精度",
          type: "select",
          required: true,
          options: DATE_PRECISION_OPTIONS,
        },
        {
          key: "related_milestone_id",
          label: "止める先のゲート",
          type: "select",
          span: true,
          options: [
            { value: "", label: "未接続" },
            ...management.milestones.map((milestone) => ({
              value: milestone.id,
              label: `${trackMeta(milestone.track).short}｜${milestone.title}`,
            })),
          ],
        },
        {
          key: "completion_criteria",
          label: "完了条件",
          type: "textarea",
          span: true,
        },
        { key: "completed_on", label: "完了日", type: "date" },
        {
          key: "completion_evidence",
          label: "完了証跡",
          type: "textarea",
          span: true,
        },
        { key: "accepted_by", label: "受入担当" },
        { key: "accepted_on", label: "受入日", type: "date" },
        confidence,
      ],
    };
  if (
    editor.kind === "create_partner_role" ||
    editor.kind === "edit_partner_role"
  )
    return {
      title:
        editor.kind === "create_partner_role"
          ? "関係先の分類を追加"
          : "関係先の分類を編集",
      eyebrow: "関係先の分類",
      resource: "partner_role",
      method: editor.kind === "create_partner_role" ? "POST" : "PATCH",
      id: editor.kind === "edit_partner_role" ? editor.role.id : undefined,
      fields: [
        {
          key: "role_kind",
          label: "分類",
          type: "select",
          required: true,
          options: ROLE_KIND_OPTIONS,
        },
        {
          key: "relationship_state",
          label: "関係状態",
          type: "select",
          required: true,
          options: [
            { value: "candidate", label: "候補" },
            { value: "in_progress", label: "進行中" },
            { value: "established", label: "成立" },
            { value: "on_hold", label: "保留" },
            { value: "ended", label: "終了" },
            { value: "unconfirmed", label: "未確認" },
          ],
        },
        { key: "role_label", label: "補足ラベル" },
        {
          key: "is_primary",
          label: "主分類",
          type: "select",
          required: true,
          options: [
            { value: "true", label: "主分類" },
            { value: "false", label: "副分類" },
          ],
        },
        { key: "sort_order", label: "表示順", type: "number", required: true },
      ],
    };
  if (editor.kind === "create_hypothesis_any")
    return {
      title: "仮説を追加",
      eyebrow: "仮説",
      resource: "hypothesis",
      method: "POST",
      fields: [
        {
          key: "issue_id",
          label: "対象論点",
          type: "select",
          required: true,
          span: true,
          options: [
            { value: "", label: "論点を選んでね" },
            ...management.issues
              .filter((issue) => issue.status !== "closed")
              .map((issue) => ({
                value: issue.id,
                label: `${trackMeta(issue.track).short}｜${issue.title}`,
              })),
          ],
        },
        {
          key: "statement",
          label: "仮説",
          type: "textarea",
          required: true,
          span: true,
          help: "反証できる形で書く",
        },
        {
          key: "status",
          label: "状態",
          type: "select",
          required: true,
          options: [
            { value: "open", label: "未着手" },
            { value: "validating", label: "検証中" },
            { value: "on_hold", label: "保留" },
          ],
        },
        { key: "owner_label", label: "担当", required: true },
        { key: "due_date", label: "期限", type: "date" },
        confidence,
      ],
    };
  if (editor.kind === "create_issue")
    return {
      title: "論点を追加",
      eyebrow: "論点",
      resource: "issue",
      method: "POST",
      fields: [
        {
          key: "track",
          label: "柱",
          type: "select",
          required: true,
          options: TRACKS.map((track) => ({
            value: track.key,
            label: track.label,
          })),
        },
        {
          key: "milestone_id",
          label: "関連ゲート",
          type: "select",
          options: [
            { value: "", label: "未接続" },
            ...management.milestones.map((milestone) => ({
              value: milestone.id,
              label: `${trackMeta(milestone.track).short}｜${milestone.title}`,
            })),
          ],
        },
        {
          key: "title",
          label: "論点",
          type: "textarea",
          required: true,
          span: true,
          help: "何が分からず、何を決められないのかを一文で",
        },
        {
          key: "knowledge_type",
          label: "分類",
          type: "select",
          required: true,
          options: [
            { value: "fact", label: "事実確認" },
            { value: "hypothesis", label: "仮説" },
            { value: "decision_needed", label: "意思決定待ち" },
          ],
        },
        {
          key: "status",
          label: "状態",
          type: "select",
          required: true,
          options: [
            { value: "open", label: "未解決" },
            { value: "validating", label: "検証中" },
            { value: "on_hold", label: "保留" },
            { value: "closed", label: "完了" },
          ],
        },
        { key: "owner_label", label: "担当", required: true },
        { key: "due_date", label: "期限", type: "date" },
        confidence,
      ],
    };
  if (editor.kind === "edit_issue")
    return {
      title: "論点を編集",
      eyebrow: "論点",
      resource: "issue",
      method: "PATCH",
      id: editor.issue.id,
      fields: [
        {
          key: "title",
          label: "論点",
          type: "textarea",
          required: true,
          span: true,
        },
        {
          key: "knowledge_type",
          label: "分類",
          type: "select",
          required: true,
          options: [
            { value: "fact", label: "事実確認" },
            { value: "hypothesis", label: "仮説" },
            { value: "decision_needed", label: "意思決定待ち" },
          ],
        },
        {
          key: "status",
          label: "状態",
          type: "select",
          required: true,
          options: [
            { value: "open", label: "未解決" },
            { value: "validating", label: "検証中" },
            { value: "on_hold", label: "保留" },
            { value: "closed", label: "完了" },
          ],
        },
        { key: "owner_label", label: "担当", required: true },
        { key: "due_date", label: "期限", type: "date" },
        confidence,
      ],
    };
  if (editor.kind === "create_hypothesis" || editor.kind === "edit_hypothesis")
    return {
      title: editor.kind === "create_hypothesis" ? "仮説を追加" : "仮説を編集",
      eyebrow: "仮説",
      resource: "hypothesis",
      method: editor.kind === "create_hypothesis" ? "POST" : "PATCH",
      id: editor.kind === "edit_hypothesis" ? editor.hypothesis.id : undefined,
      fields: [
        {
          key: "statement",
          label: "仮説",
          type: "textarea",
          required: true,
          span: true,
          help: "反証できる形で書く",
        },
        {
          key: "status",
          label: "状態",
          type: "select",
          required: true,
          options: [
            { value: "open", label: "未着手" },
            { value: "validating", label: "検証中" },
            { value: "validated", label: "検証済み" },
            { value: "rejected", label: "棄却" },
            { value: "decided", label: "判断済み" },
            { value: "on_hold", label: "保留" },
          ],
        },
        { key: "owner_label", label: "担当", required: true },
        { key: "due_date", label: "期限", type: "date" },
        confidence,
      ],
    };
  if (editor.kind === "create_evidence")
    return {
      title: "根拠・反証を追加",
      eyebrow: "根拠・反証",
      resource: "evidence",
      method: "POST",
      fields: [
        {
          key: "hypothesis_id",
          label: "関連仮説",
          type: "select",
          options: [
            { value: "", label: "論点全体" },
            ...editor.issue.hypotheses.map((hypothesis) => ({
              value: hypothesis.id,
              label: hypothesis.statement,
            })),
          ],
        },
        {
          key: "evidence_kind",
          label: "種類",
          type: "select",
          required: true,
          options: [
            { value: "supporting", label: "支持" },
            { value: "counter", label: "反証" },
            { value: "missing", label: "不足" },
            { value: "observation", label: "観測" },
          ],
        },
        {
          key: "summary",
          label: "確認できたこと",
          type: "textarea",
          required: true,
          span: true,
        },
        { key: "observed_on", label: "確認日", type: "date" },
        { key: "source_label", label: "確認元", required: true },
        confidence,
      ],
    };
  if (editor.kind === "create_validation")
    return {
      title: "次の検証を設定",
      eyebrow: "検証",
      resource: "validation",
      method: "POST",
      fields: [
        {
          key: "validation_kind",
          label: "検証の種類",
          required: true,
          help: "例: 顧客ヒアリング、再現試験",
        },
        {
          key: "status",
          label: "状態",
          type: "select",
          required: true,
          options: [
            { value: "planned", label: "計画" },
            { value: "running", label: "実施中" },
            { value: "completed", label: "完了" },
            { value: "blocked", label: "停止" },
            { value: "cancelled", label: "取消" },
          ],
        },
        { key: "planned_on", label: "予定日", type: "date" },
        { key: "due_date", label: "期限", type: "date" },
        { key: "owner_label", label: "担当", required: true },
        confidence,
        {
          key: "method",
          label: "方法・合格条件",
          type: "textarea",
          required: true,
          span: true,
        },
      ],
    };
  if (editor.kind === "edit_decision")
    return {
      title: "判断を編集",
      eyebrow: "判断",
      resource: "decision",
      method: "PATCH",
      id: editor.decision.id,
      fields: [
        {
          key: "title",
          label: "決めること",
          type: "textarea",
          required: true,
          span: true,
        },
        {
          key: "context",
          label: "背景",
          type: "textarea",
          required: true,
          span: true,
        },
        {
          key: "rationale",
          label: "判断基準",
          type: "textarea",
          required: true,
          span: true,
        },
        {
          key: "status",
          label: "状態",
          type: "select",
          required: true,
          options: [
            { value: "open", label: "判断待ち" },
            { value: "decided", label: "決定済み" },
            { value: "deferred", label: "保留" },
          ],
        },
        {
          key: "decision_text",
          label: "決定内容",
          type: "textarea",
          span: true,
          help: "決定済みにする場合は必須",
        },
        {
          key: "decided_by",
          label: "決定者",
          help: "決定済みにする場合は必須",
        },
        {
          key: "decided_on",
          label: "決定日",
          type: "date",
          help: "決定済みにする場合は必須",
        },
        { key: "owner_label", label: "判断を取りに行く担当", required: true },
        { key: "due_date", label: "期限", type: "date" },
        { key: "is_this_week", label: "今週決める", type: "checkbox" },
        confidence,
      ],
    };
  if (editor.kind === "create_action" || editor.kind === "edit_action")
    return {
      title:
        editor.kind === "create_action"
          ? "決定後の行動を追加"
          : "決定後の行動を編集",
      eyebrow: "決定後の行動",
      resource: "action",
      method: editor.kind === "create_action" ? "POST" : "PATCH",
      id: editor.kind === "edit_action" ? editor.action.id : undefined,
      fields: [
        {
          key: "title",
          label: "次の行動",
          type: "textarea",
          required: true,
          span: true,
        },
        { key: "owner_label", label: "担当", required: true },
        { key: "due_date", label: "期限", type: "date" },
        {
          key: "completion_criteria",
          label: "完了条件",
          type: "textarea",
          required: true,
          span: true,
        },
        { key: "next_review_on", label: "次回確認日", type: "date" },
        {
          key: "status",
          label: "状態",
          type: "select",
          required: true,
          options: [
            { value: "open", label: "未着手" },
            { value: "in_progress", label: "実行中" },
            { value: "blocked", label: "停止" },
            { value: "completed", label: "完了" },
          ],
        },
        {
          key: "completion_note",
          label: "完了メモ",
          type: "textarea",
          span: true,
          help: "完了にする場合は必須",
        },
        {
          key: "completed_at",
          label: "完了日",
          type: "date",
          help: "完了にする場合は必須",
        },
      ],
    };
  return {
    title: "判断を追加",
    eyebrow: "判断",
    resource: "decision",
    method: "POST",
    fields: [
      {
        key: "title",
        label: "決めること",
        type: "textarea",
        required: true,
        span: true,
      },
      {
        key: "context",
        label: "背景",
        type: "textarea",
        required: true,
        span: true,
      },
      {
        key: "rationale",
        label: "判断基準",
        type: "textarea",
        required: true,
        span: true,
      },
      { key: "owner_label", label: "判断を取りに行く担当", required: true },
      { key: "due_date", label: "期限", type: "date" },
      { key: "is_this_week", label: "今週決める", type: "checkbox" },
      confidence,
    ],
  };
}

function IssueEditor({
  editor,
  management,
  access,
  projectId,
  onClose,
  onSaved,
}: {
  editor: EditorState;
  management: SxManagementBundle;
  access: CurrentMemberAccess;
  projectId: string;
  onClose: () => void;
  onSaved: (bundle: SxManagementBundle, message: string) => void;
}) {
  const definition = editorDefinition(editor, management);
  const initialValues = useRef(
    editorInitialValues(editor, access, management.asOf),
  );
  const [values, setValues] = useState<Record<string, string>>(
    () => initialValues.current,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function requestClose() {
    const dirty =
      JSON.stringify(values) !== JSON.stringify(initialValues.current);
    if (!dirty || window.confirm("入力中の変更を破棄する？")) onClose();
  }

  async function save() {
    setError(null);
    const missingRequired = definition.fields.find(
      (field) => field.required && !fieldValue(values, field.key).trim(),
    );
    if (missingRequired) {
      setError(`${missingRequired.label}を入力してね`);
      return;
    }
    if (
      editor.kind === "edit_decision" &&
      values.status === "decided" &&
      (!values.decision_text?.trim() ||
        !values.decided_by?.trim() ||
        !values.decided_on)
    ) {
      setError("決定済みにするには、決定内容・決定者・決定日を入れてね");
      return;
    }
    if (
      (editor.kind === "create_action" || editor.kind === "edit_action") &&
      values.status === "completed" &&
      (!values.completion_note?.trim() || !values.completed_at)
    ) {
      setError("完了にするには、完了メモと完了日を入れてね");
      return;
    }
    if (editor.kind === "edit_milestone" && values.status === "completed") {
      if (!values.actual_end || !values.completion_evidence?.trim()) {
        setError("完了にするには、実績完了日と完了証跡を入れてね");
        return;
      }
      if (
        !sxOralAgreementEvidenceReady(
          editor.milestone.slug,
          values.completion_evidence,
        )
      ) {
        setError(
          "口頭合意の確認には、先方（または投資家）・合意内容・確認日・根拠を「項目：内容」で1行ずつ入れてね",
        );
        return;
      }
    }
    setSaving(true);
    const isPatch = definition.method === "PATCH";
    const fields: Record<string, unknown> = Object.fromEntries(
      Object.entries(values).map(([key, value]) => {
        if (
          [
            "due_date",
            "planned_on",
            "observed_on",
            "decided_on",
            "next_review_on",
            "completed_at",
            "planned_start",
            "planned_end",
            "actual_end",
            "last_contact_date",
            "occurred_on",
            "completed_on",
            "accepted_on",
          ].includes(key)
        )
          return [key, value || null];
        if (["is_this_week", "required", "is_primary"].includes(key))
          return [key, value === "true"];
        return [key, value];
      }),
    );
    if (
      (editor.kind === "create_task" || editor.kind === "edit_task") &&
      !String(fields.track || "").trim()
    ) {
      delete fields.track;
    }
    if (editor.kind === "create_milestone") {
      fields.objective_id = management.objective?.id || "";
      fields.slug = `weekly-ms-${Date.now().toString(36)}`;
    }
    if (editor.kind === "create_partner")
      fields.slug = `weekly-partner-${Date.now().toString(36)}`;
    if (editor.kind === "create_issue")
      fields.slug = `weekly-${Date.now().toString(36)}`;
    if (editor.kind === "create_hypothesis") fields.issue_id = editor.issue.id;
    if (editor.kind === "create_evidence") fields.issue_id = editor.issue.id;
    if (editor.kind === "create_validation")
      fields.hypothesis_id = editor.hypothesis.id;
    if (editor.kind === "create_decision") {
      fields.issue_id = editor.issue.id;
      if (editor.hypothesis) fields.hypothesis_id = editor.hypothesis.id;
      fields.status = "open";
    }
    if (editor.kind === "create_action")
      fields.decision_id = editor.decision.id;
    try {
      const response = await fetch(
        `/api/project-workspace/${encodeURIComponent(projectId)}/management`,
        {
          method: definition.method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            isPatch
              ? {
                  resource: definition.resource,
                  id: definition.id,
                  patch: fields,
                }
              : { resource: definition.resource, fields },
          ),
        },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          typeof body.error === "string" ? body.error : "保存できなかったよ",
        );
      onSaved(
        body.bundle as SxManagementBundle,
        `${definition.title}を保存したよ`,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "保存できなかったよ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className={styles.editorBackdrop}
      role="dialog"
      aria-modal="true"
      aria-label={definition.title}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <section className={styles.editorPanel}>
        <header className={styles.editorHeader}>
          <div>
            <p className={styles.eyebrow}>{definition.eyebrow}</p>
            <h2>{definition.title}</h2>
          </div>
          <button
            type="button"
            className={styles.iconButton}
            onClick={requestClose}
            aria-label="閉じる"
          >
            <X aria-hidden="true" />
          </button>
        </header>
        <div className={styles.editorContext}>
          {"issue" in editor && (
            <>
              <span>対象論点</span>
              <strong>{editor.issue.title}</strong>
            </>
          )}
          {"hypothesis" in editor && (
            <>
              <span>対象仮説</span>
              <strong>{editor.hypothesis?.statement}</strong>
            </>
          )}
          {"decision" in editor && (
            <>
              <span>対象判断</span>
              <strong>{editor.decision.title}</strong>
            </>
          )}
          {"milestone" in editor && (
            <>
              <span>対象工程</span>
              <strong>{editor.milestone.title}</strong>
            </>
          )}
          {"successor" in editor && (
            <>
              <span>先へ進む工程</span>
              <strong>{editor.successor.title}</strong>
            </>
          )}
          {"task" in editor && (
            <>
              <span>対象タスク</span>
              <strong>{editor.task.title}</strong>
            </>
          )}
          {"partner" in editor && (
            <>
              <span>対象関係先</span>
              <strong>{editor.partner.name}</strong>
            </>
          )}
          {"parentTask" in editor && (
            <>
              <span>追加先</span>
              <strong>
                {editor.parentTask?.title || editor.milestone.title}
              </strong>
            </>
          )}
        </div>
        <div className={styles.formGrid}>
          {definition.fields.map((field) => (
            <label
              key={field.key}
              className={field.span ? styles.fieldSpan : styles.field}
            >
              <span>
                {field.label}
                {field.required && <b>必須</b>}
              </span>
              {field.type === "textarea" ? (
                <textarea
                  rows={field.key === "title" ? 2 : 4}
                  required={field.required}
                  value={fieldValue(values, field.key)}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      [field.key]: event.target.value,
                    }))
                  }
                />
              ) : field.type === "select" ? (
                <select
                  required={field.required}
                  value={fieldValue(values, field.key)}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      [field.key]: event.target.value,
                    }))
                  }
                >
                  {field.options?.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : field.type === "checkbox" ? (
                <span className={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={values[field.key] === "true"}
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        [field.key]: event.target.checked ? "true" : "false",
                      }))
                    }
                  />
                  今回の週次会議で扱う
                </span>
              ) : (
                <input
                  type={field.type || "text"}
                  required={field.required}
                  value={fieldValue(values, field.key)}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      [field.key]: event.target.value,
                    }))
                  }
                />
              )}
              {field.help && <small>{field.help}</small>}
            </label>
          ))}
        </div>
        {error && (
          <p className={styles.formError} role="alert">
            {error}
          </p>
        )}
        <footer className={styles.editorFooter}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={requestClose}
          >
            キャンセル
          </button>
          <button
            type="button"
            className={styles.primaryButton}
            disabled={saving}
            onClick={save}
          >
            {saving ? (
              <RefreshCw className={styles.spin} aria-hidden="true" />
            ) : (
              <Check aria-hidden="true" />
            )}
            保存
          </button>
        </footer>
      </section>
    </div>
  );
}

function IssueCard({
  issue,
  asOf,
  canManage,
  onEdit,
}: {
  issue: SxManagementIssue;
  asOf: string;
  canManage: boolean;
  onEdit: (editor: EditorState) => void;
}) {
  const track = trackMeta(issue.track);
  const stale = sxWeeklyIssueIsStale(issue, asOf);
  const overdue = sxWeeklyIssueIsOverdue(issue, asOf);
  const attention = sxWeeklyIssueNeedsAttention(issue, asOf);
  const nextMove = sxWeeklyIssueNextMove(issue, asOf);
  const nextDueDate = sxWeeklyIssueNextDueDate(issue);
  const lastActivity = sxWeeklyIssueLastActivity(issue);
  return (
    <article
      className={styles.issueCard}
      data-attention={attention || undefined}
    >
      <div className={styles.cardAccent} style={{ background: track.accent }} />
      <div className={styles.issueCardHead}>
        <div className={styles.badgeRow}>
          <span
            className={styles.trackBadge}
            style={{ color: track.accent, borderColor: `${track.accent}55` }}
          >
            {track.short}
          </span>
          <span className={`${styles.statusBadge} ${statusTone(issue.status)}`}>
            {issueStatusLabel(issue.status)}
          </span>
          {stale && (
            <span className={`${styles.statusBadge} ${styles.toneDanger}`}>
              更新切れ
            </span>
          )}
          {overdue && (
            <span className={`${styles.statusBadge} ${styles.toneDanger}`}>
              期限超過
            </span>
          )}
        </div>
        {canManage && (
          <div className={styles.issueHeadActions}>
            <button
              type="button"
              onClick={() => onEdit({ kind: "edit_issue", issue })}
            >
              <Pencil aria-hidden="true" />
              論点を編集
            </button>
            <button
              type="button"
              onClick={() => onEdit({ kind: "create_hypothesis", issue })}
            >
              <Plus aria-hidden="true" />
              仮説を追加
            </button>
          </div>
        )}
      </div>
      <p className={styles.issueType}>{issueKindLabel(issue.knowledgeType)}</p>
      <h3>{issue.title}</h3>
      <dl className={styles.cardMeta}>
        <div>
          <dt>担当</dt>
          <dd
            data-missing={sxWeeklyValueMissing(issue.ownerLabel) || undefined}
          >
            {sxWeeklyValueMissing(issue.ownerLabel)
              ? "未設定"
              : issue.ownerLabel}
          </dd>
        </div>
        <div>
          <dt>次の期限</dt>
          <dd data-missing={!nextDueDate || undefined}>
            {formatDate(nextDueDate)}
          </dd>
        </div>
        <div>
          <dt>最終更新</dt>
          <dd data-missing={stale || undefined}>{formatDate(lastActivity)}</dd>
        </div>
      </dl>
      <div className={styles.nextMove}>
        <span>次の動き</span>
        <strong>
          {nextMove?.label ||
            (issue.hypotheses.length === 0
              ? "検証可能な仮説を置く"
              : "次の検証を設定")}
        </strong>
      </div>
      <details className={styles.issueDetails}>
        <summary>
          <span>仮説 {issue.hypotheses.length}</span>
          <span>根拠 {issue.evidence.length}</span>
          <span>検証 {issue.validationRuns.length}</span>
          <span>
            行動{" "}
            {
              issue.actionItems.filter(
                (action) => action.status !== "completed",
              ).length
            }
          </span>
          <ChevronDown aria-hidden="true" />
        </summary>
        <div className={styles.detailBody}>
          <section>
            <div className={styles.detailTitle}>
              <h4>仮説</h4>
              {canManage && (
                <button
                  type="button"
                  onClick={() => onEdit({ kind: "create_hypothesis", issue })}
                >
                  <Plus aria-hidden="true" />
                  追加
                </button>
              )}
            </div>
            {issue.hypotheses.length === 0 ? (
              <p className={styles.emptyLine}>まだ仮説がない</p>
            ) : (
              issue.hypotheses.map((hypothesis) => (
                <div className={styles.hypothesisRow} key={hypothesis.id}>
                  <div>
                    <span
                      className={`${styles.statusBadge} ${statusTone(hypothesis.status)}`}
                    >
                      {hypothesisStatusLabel(hypothesis.status)}
                    </span>
                    <p>{hypothesis.statement}</p>
                    <small>
                      {hypothesis.ownerLabel || "担当未設定"} ·{" "}
                      {formatDate(hypothesis.dueDate)} · 確度{" "}
                      {confidenceLabel(hypothesis.confidence)}
                    </small>
                  </div>
                  {canManage && (
                    <div className={styles.rowActions}>
                      <button
                        type="button"
                        onClick={() =>
                          onEdit({
                            kind: "create_validation",
                            issue,
                            hypothesis,
                          })
                        }
                      >
                        検証
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onEdit({ kind: "edit_hypothesis", issue, hypothesis })
                        }
                      >
                        編集
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </section>
          <section>
            <div className={styles.detailTitle}>
              <h4>判断材料</h4>
              {canManage && (
                <button
                  type="button"
                  onClick={() => onEdit({ kind: "create_evidence", issue })}
                >
                  <Plus aria-hidden="true" />
                  追加
                </button>
              )}
            </div>
            {issue.evidence.length === 0 ? (
              <p className={styles.emptyLine}>根拠・反証が未登録</p>
            ) : (
              issue.evidence.map((evidence) => (
                <p className={styles.evidenceLine} key={evidence.id}>
                  <b>
                    {
                      (
                        {
                          supporting: "支持",
                          counter: "反証",
                          missing: "不足",
                          observation: "観測",
                        } as const
                      )[evidence.kind]
                    }
                  </b>
                  {evidence.summary}
                </p>
              ))
            )}
          </section>
          {(issue.decisions.length > 0 || issue.actionItems.length > 0) && (
            <section>
              <div className={styles.detailTitle}>
                <h4>判断・決定後の行動</h4>
              </div>
              {issue.decisions.map((decision) => (
                <div className={styles.decisionLine} key={decision.id}>
                  <div className={styles.decisionHead}>
                    <span
                      className={`${styles.statusBadge} ${statusTone(decision.status)}`}
                    >
                      {decision.status === "decided"
                        ? "決定済み"
                        : decision.status === "deferred"
                          ? "保留"
                          : "判断待ち"}
                    </span>
                    {canManage && (
                      <span className={styles.inlineActions}>
                        <button
                          type="button"
                          onClick={() =>
                            onEdit({ kind: "edit_decision", issue, decision })
                          }
                        >
                          編集
                        </button>
                        {decision.status === "decided" && (
                          <button
                            type="button"
                            onClick={() =>
                              onEdit({ kind: "create_action", issue, decision })
                            }
                          >
                            次の行動
                          </button>
                        )}
                      </span>
                    )}
                  </div>
                  <b>{decision.title}</b>
                  {decision.decisionText && (
                    <small>{decision.decisionText}</small>
                  )}
                </div>
              ))}
              {issue.actionItems.map((action) => {
                const decision = issue.decisions.find(
                  (candidate) => candidate.id === action.decisionId,
                );
                return (
                  <div className={styles.actionLine} key={action.id}>
                    <ArrowRight aria-hidden="true" />
                    <span>
                      <b>{action.title}</b>
                      <small>
                        {action.status === "completed"
                          ? "完了"
                          : action.ownerLabel || "担当未設定"}{" "}
                        · {formatDate(action.dueDate)} · 次回{" "}
                        {formatDate(action.nextReviewOn)}
                      </small>
                    </span>
                    {canManage && decision && (
                      <button
                        type="button"
                        onClick={() =>
                          onEdit({
                            kind: "edit_action",
                            issue,
                            decision,
                            action,
                          })
                        }
                      >
                        編集
                      </button>
                    )}
                  </div>
                );
              })}
            </section>
          )}
          {canManage && (
            <div className={styles.detailActions}>
              <button
                type="button"
                onClick={() => onEdit({ kind: "create_decision", issue })}
              >
                <Target aria-hidden="true" />
                判断を会議へ載せる
              </button>
            </div>
          )}
        </div>
      </details>
    </article>
  );
}

function PlanInspector({
  milestone,
  task,
  requirements,
  canManage,
  onClose,
  onEdit,
  onAddChild,
  onAddRequirement,
  onEditRequirementMilestone,
  onEditRequirement,
}: {
  milestone: SxManagementMilestone | null;
  task: SxTask | null;
  requirements: SxGateRequirement[];
  canManage: boolean;
  onClose: () => void;
  onEdit: () => void;
  onAddChild: () => void;
  onAddRequirement: () => void;
  onEditRequirementMilestone: (milestone: SxManagementMilestone) => void;
  onEditRequirement: (dependency: SxDependency) => void;
}) {
  const item = task || milestone;
  if (!item) return null;
  const isTask = Boolean(task);
  const plannedStart = item.plannedStart;
  const plannedEnd = item.plannedEnd;
  const progressRegistered = isTask
    ? task?.status !== "unassessed"
    : milestone?.manualStatus !== "unassessed";
  const description = task?.description || milestone?.gate || "未設定";
  const blocker = milestone?.maxIssue || task?.description || "未設定";
  const criteria =
    task?.completionCriteria || milestone?.completionCriteria || "未設定";
  const metRequirements = requirements.filter(
    (requirement) => requirement.state === "met",
  ).length;
  return (
    <aside
      className={styles.planInspector}
      role="dialog"
      aria-modal="false"
      aria-label={`${item.title}の詳細`}
    >
      <header>
        <div>
          <p>{isTask ? "タスク詳細" : "工程詳細"}</p>
          <h3>{item.title}</h3>
        </div>
        <button type="button" onClick={onClose} aria-label="詳細を閉じる">
          <X aria-hidden="true" />
        </button>
      </header>
      <div className={styles.inspectorBreadcrumb}>
        {milestone && task ? (
          <>
            <span>{trackMeta(milestone.track).label}</span>
            <ChevronRight aria-hidden="true" />
            <span>{milestone.title}</span>
            <ChevronRight aria-hidden="true" />
            <strong>{task.title}</strong>
          </>
        ) : (
          <>
            <span>{milestone ? trackMeta(milestone.track).label : "工程"}</span>
            <ChevronRight aria-hidden="true" />
            <strong>{item.title}</strong>
          </>
        )}
      </div>
      <dl className={styles.inspectorFacts}>
        <div>
          <dt>担当</dt>
          <dd>{item.ownerLabel || "担当未設定"}</dd>
        </div>
        <div>
          <dt>状態</dt>
          <dd>
            {isTask
              ? ROW_PLAN_STATUS[task!.status]
              : ROW_PLAN_STATUS[milestone!.manualStatus]}
          </dd>
        </div>
        <div>
          <dt>計画</dt>
          <dd>
            {formatDate(plannedStart)} → {formatDate(plannedEnd)}
          </dd>
        </div>
        <div>
          <dt>進捗</dt>
          <dd data-missing={!progressRegistered || undefined}>
            {progressRegistered ? `${item.progressPct}%` : "未登録"}
          </dd>
        </div>
        <div>
          <dt>実績完了</dt>
          <dd>{formatDate(item.actualEnd)}</dd>
        </div>
        {!isTask && (
          <div>
            <dt>必須条件</dt>
            <dd>
              {requirements.length > 0
                ? `${metRequirements}/${requirements.length}件を充足`
                : "未登録"}
            </dd>
          </div>
        )}
      </dl>
      {!isTask && (
        <section>
          <span>先へ進むための必須条件</span>
          {requirements.length > 0 ? (
            <ul className="mt-2 divide-y divide-[#e4ddd0] border-y border-[#e4ddd0]">
              {requirements.map((requirement) => (
                <li
                  key={requirement.dependency.id}
                  className="flex items-start gap-2 py-2 text-[11px]"
                >
                  <span
                    className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center border ${requirement.state === "met" ? "border-[#9fc6b4] bg-[#e8f2eb] text-[#205f49]" : requirement.state === "unconfirmed" ? "border-[#e3c994] bg-[#fbf1dc] text-[#765022]" : "border-[#d6cebf] bg-white text-[#69665d]"}`}
                  >
                    {requirement.state === "met" ? (
                      <Check className="h-3 w-3" aria-hidden="true" />
                    ) : (
                      "!"
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <b className="block text-[#24231f]">
                      {requirement.milestone.gate ||
                        requirement.milestone.title}
                    </b>
                    <small className="mt-0.5 block text-[#69665d]">
                      {requirement.state === "met"
                        ? "証跡あり・確認済み"
                        : requirement.state === "unconfirmed"
                          ? requirement.milestone.manualStatus === "completed"
                            ? "完了申告・証跡未確認"
                            : "達成事実 未確認"
                          : "未達"}{" "}
                      ・ {requirement.milestone.ownerLabel || "担当未確認"} ・{" "}
                      {formatDate(requirement.milestone.plannedEnd)}
                    </small>
                  </span>
                  {canManage && (
                    <span className="flex shrink-0 flex-col gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          onEditRequirementMilestone(requirement.milestone)
                        }
                        className="min-h-11 px-2 text-[10px] font-semibold text-[#315f7d] underline"
                      >
                        状態・担当・証跡
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onEditRequirement(requirement.dependency)
                        }
                        className="min-h-11 px-2 text-[10px] font-semibold text-[#5f4a66] underline"
                      >
                        接続条件
                      </button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p>必須条件はまだ登録されていない</p>
          )}
          {canManage && (
            <button
              type="button"
              onClick={onAddRequirement}
              className="mt-2 inline-flex min-h-11 items-center gap-1 border border-[#c9bfd0] px-3 text-[10px] font-semibold text-[#5f4a66]"
            >
              <Plus className="h-3 w-3" aria-hidden="true" />
              必須条件を追加
            </button>
          )}
        </section>
      )}
      <section>
        <span>内容 / ゲート</span>
        <p>{description}</p>
      </section>
      <section>
        <span>詰まり</span>
        <p>{blocker}</p>
      </section>
      <section>
        <span>完了条件</span>
        <p>{criteria}</p>
      </section>
      {canManage && (
        <footer>
          <button type="button" onClick={onEdit}>
            編集
          </button>
          <button type="button" onClick={onAddChild}>
            <Plus aria-hidden="true" />
            {isTask ? "子タスクを追加" : "タスクを追加"}
          </button>
        </footer>
      )}
    </aside>
  );
}

const ROW_PLAN_STATUS: Record<SxManagementMilestone["manualStatus"], string> = {
  unassessed: "進捗未登録",
  on_track: "進行中",
  attention: "要確認",
  at_risk: "遅れ懸念",
  blocked: "停止",
  completed: "完了",
};

export function SxWeeklyControlDashboard({
  bundle,
  access,
}: {
  bundle: ProjectWorkspaceBundle;
  access: CurrentMemberAccess;
}) {
  const [management, setManagement] = useState(bundle.sxManagement);
  const [trackFilter, setTrackFilter] = useState<SxTrackKey | "all">("all");
  const [viewFilter, setViewFilter] = useState<ViewFilter>("all");
  const [query, setQuery] = useState("");
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string | null>(
    null,
  );
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const allIssues = useMemo(
    () =>
      [...management.issues].sort(
        (left, right) =>
          sxWeeklyIssueAttentionScore(right, management.asOf) -
            sxWeeklyIssueAttentionScore(left, management.asOf) ||
          (sxWeeklyIssueNextDueDate(left) || "9999").localeCompare(
            sxWeeklyIssueNextDueDate(right) || "9999",
          ),
      ),
    [management],
  );
  const counts = useMemo(
    () => ({
      attention: allIssues.filter((issue) =>
        sxWeeklyIssueNeedsAttention(issue, management.asOf),
      ).length,
      stale: allIssues.filter(
        (issue) =>
          sxWeeklyIssueIsStale(issue, management.asOf) &&
          sxWeeklyIssueStage(issue) !== "resolved",
      ).length,
      overdue: allIssues.filter((issue) =>
        sxWeeklyIssueIsOverdue(issue, management.asOf),
      ).length,
      decisions: management.decisions.filter(
        (decision) => decision.status === "open",
      ).length,
    }),
    [allIssues, management],
  );
  const visibleIssues = useMemo(
    () =>
      allIssues.filter((issue) => {
        if (trackFilter !== "all" && issue.track !== trackFilter) return false;
        if (
          viewFilter === "attention" &&
          !sxWeeklyIssueNeedsAttention(issue, management.asOf)
        )
          return false;
        if (
          viewFilter === "stale" &&
          !sxWeeklyIssueIsStale(issue, management.asOf)
        )
          return false;
        if (
          viewFilter === "overdue" &&
          !sxWeeklyIssueIsOverdue(issue, management.asOf)
        )
          return false;
        const normalized = query.trim().toLowerCase();
        if (!normalized) return true;
        return `${issue.title} ${issue.ownerLabel} ${issue.hypotheses.map((hypothesis) => hypothesis.statement).join(" ")}`
          .toLowerCase()
          .includes(normalized);
      }),
    [allIssues, management.asOf, query, trackFilter, viewFilter],
  );
  const stageGroups = useMemo(
    () =>
      Object.fromEntries(
        STAGES.map((stage) => [
          stage.key,
          visibleIssues.filter(
            (issue) => sxWeeklyIssueStage(issue) === stage.key,
          ),
        ]),
      ) as Record<StageKey, SxManagementIssue[]>,
    [visibleIssues],
  );
  const pendingDecisions = management.decisions
    .filter((decision) => decision.status === "open")
    .sort(
      (left, right) =>
        Number(right.isThisWeek) - Number(left.isThisWeek) ||
        (left.dueDate || "9999").localeCompare(right.dueDate || "9999"),
    )
    .slice(0, 3);
  const interventions = allIssues
    .filter((issue) => sxWeeklyIssueNeedsAttention(issue, management.asOf))
    .slice(0, 3);
  const enteredMembers = bundle.members.filter(
    (member) => member.plannedHours > 0 || member.actualHours > 0,
  ).length;
  const timeline = useMemo(
    () =>
      deriveSxUnifiedTimeline({
        today: management.asOf,
        milestones: management.milestones,
        criticalPathSlugs: management.judgment.criticalPathSlugs,
        dagValid: management.judgment.dagValid,
        tracks: management.tracks.map((track) => ({
          key: track.key,
          label: track.label,
          shortLabel: track.shortLabel,
          accent: track.accent,
          deltaDays: track.deltaDays,
          dateCertainty: track.dateCertainty,
          maxIssue: track.maxIssue,
        })),
        objectiveTargetDate: management.objective?.targetDate ?? null,
        interventionRows: [],
        pinCount: 0,
        dateMode: "planned_only",
      }),
    [management],
  );
  const projectOwnerLoads = useMemo(
    () => sxProjectOwnerLoads(management),
    [management],
  );
  const selectedMilestone =
    management.milestones.find(
      (milestone) => milestone.id === selectedMilestoneId,
    ) ?? null;
  const selectedTask =
    management.tasks.find((task) => task.id === selectedTaskId) ?? null;
  const selectedTaskMilestone = selectedTask
    ? (management.milestones.find(
        (milestone) => milestone.id === selectedTask.milestoneId,
      ) ?? null)
    : null;
  const selectedPlanMilestone = selectedMilestone || selectedTaskMilestone;
  const selectedRequirements = useMemo<SxGateRequirement[]>(() => {
    if (!selectedPlanMilestone) return [];
    return (
      sxGateRequirementsBySuccessor(
        management.milestones,
        management.dependencies,
      ).get(selectedPlanMilestone.id) || []
    );
  }, [management.dependencies, management.milestones, selectedPlanMilestone]);

  function handleSaved(next: SxManagementBundle, message: string) {
    setManagement(next);
    setEditor(null);
    setNotice(message);
    window.setTimeout(() => setNotice(null), 3500);
  }

  return (
    <main className={`${styles.page} sx-management-workspace`}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div className={styles.headerTop}>
            <div className={styles.badgeRow}>
              <span className={styles.productBadge}>
                <ShieldCheck aria-hidden="true" />
                SX / 週次管制
              </span>
              <span className={styles.previewBadge}>
                手動編集を正本にする · 抽出は差分候補
              </span>
              <span className={styles.scopeBadge}>
                {access.scope === "project" ? "参加PJ限定" : "AMD管理ビュー"}
              </span>
            </div>
            <div className={styles.headerActions}>
              <Link
                href={`/project/${encodeURIComponent(bundle.project.projectId)}/workspace`}
              >
                <ExternalLink aria-hidden="true" />
                既存ワークスペース
              </Link>
            </div>
          </div>
          <div className={styles.titleRow}>
            <div>
              <p className={styles.eyebrow}>
                {sxWeeklyWeekRangeLabel(bundle.currentWeekStart)} / WEEKLY
                CONTROL
              </p>
              <h1>
                週次管制 <span>/ {bundle.project.projectName}</span>
              </h1>
            </div>
            <div className={styles.readinessStamp}>
              <span>画面</span>
              <strong>運用準備中</strong>
              <small>情報抽出は次工程</small>
            </div>
          </div>
          <nav className={styles.sectionNav} aria-label="週次管制ナビ">
            <a href="#weekly-change">週次差分</a>
            <a href="#project-gantt">ガント</a>
            <a href="#partner-ledger">関係先</a>
            <a href="#issue-hypothesis">論点・仮説</a>
            <a href="#input-readiness">データ接続</a>
          </nav>
        </header>

        <section className={styles.statusBand} aria-label="週次の注意状況">
          <div>
            <span>判断待ち</span>
            <strong>{counts.decisions}</strong>
            <small>現行台帳</small>
          </div>
          <div data-alert={counts.attention > 0 || undefined}>
            <span>要フォロー</span>
            <strong>{counts.attention}</strong>
            <small>担当・期限・検証を確認</small>
          </div>
          <div data-alert={counts.stale > 0 || undefined}>
            <span>更新切れ</span>
            <strong>{counts.stale}</strong>
            <small>7日以上未確認</small>
          </div>
          <div data-alert={counts.overdue > 0 || undefined}>
            <span>期限超過</span>
            <strong>{counts.overdue}</strong>
            <small>未完了のみ</small>
          </div>
          <div>
            <span>今週入力</span>
            <strong>
              {enteredMembers}
              <em>/{bundle.members.length}</em>
            </strong>
            <small>現行工数台帳</small>
          </div>
        </section>

        <SxProjectOwnerWorkload loads={projectOwnerLoads} />

        <section id="weekly-change" className={styles.section}>
          <div className={styles.sectionHeading}>
            <div>
              <h2>週次差分・判断・介入</h2>
            </div>
          </div>
          <div className={styles.flowRail}>
            <article className={styles.flowStep}>
              <div className={styles.flowNumber}>01</div>
              <div className={styles.flowIcon}>
                <GitBranch aria-hidden="true" />
              </div>
              <p className={styles.flowKicker}>先週 → 今週</p>
              <h3>先週からの差分</h3>
              <ul className={styles.placeholderList}>
                <li>
                  <span>完了した成果</span>
                  <b>抽出接続待ち</b>
                </li>
                <li>
                  <span>予定日の変更</span>
                  <b>抽出接続待ち</b>
                </li>
                <li>
                  <span>新しい詰まり</span>
                  <b>抽出接続待ち</b>
                </li>
              </ul>
            </article>
            <article className={styles.flowStep}>
              <div className={styles.flowNumber}>02</div>
              <div className={styles.flowIcon}>
                <Target aria-hidden="true" />
              </div>
              <p className={styles.flowKicker}>今回の会議</p>
              <h3>今週の判断</h3>
              <div className={styles.flowItems}>
                {pendingDecisions.length > 0 ? (
                  pendingDecisions.map((decision) => (
                    <div key={decision.id}>
                      <span>{trackMeta(decision.track).short}</span>
                      <p>{decision.title}</p>
                      <small>
                        {decision.ownerLabel || "担当未設定"} ·{" "}
                        {formatDate(decision.dueDate)}
                      </small>
                    </div>
                  ))
                ) : (
                  <p className={styles.emptyState}>判断対象の抽出待ち</p>
                )}
              </div>
            </article>
            <article className={styles.flowStep}>
              <div className={styles.flowNumber}>03</div>
              <div className={styles.flowIcon}>
                <ArrowRight aria-hidden="true" />
              </div>
              <p className={styles.flowKicker}>決定 → 介入</p>
              <h3>決定後の介入</h3>
              <div className={styles.flowItems}>
                {interventions.length > 0 ? (
                  interventions.map((issue) => (
                    <div key={issue.id}>
                      <span>
                        {sxWeeklyIssueIsOverdue(issue, management.asOf)
                          ? "期限超過"
                          : sxWeeklyIssueIsStale(issue, management.asOf)
                            ? "更新切れ"
                            : "要整理"}
                      </span>
                      <p>{issue.title}</p>
                      <small>
                        {sxWeeklyValueMissing(issue.ownerLabel)
                          ? "担当を置く"
                          : issue.ownerLabel}{" "}
                        ·{" "}
                        {sxWeeklyIssueNextDueDate(issue)
                          ? formatDate(sxWeeklyIssueNextDueDate(issue))
                          : "期限を置く"}
                      </small>
                    </div>
                  ))
                ) : (
                  <p className={styles.emptyState}>介入候補の抽出待ち</p>
                )}
              </div>
            </article>
          </div>
        </section>

        <section id="project-gantt" className={styles.section}>
          <div className={styles.sectionHeading}>
            <div>
              <h2>全体ガント</h2>
              <p>
                工程を開くと細かいタスクを表示。バーか名称を押すと横に詳細が開く
              </p>
            </div>
            <p>基準日 {formatDate(management.asOf)}</p>
          </div>
          <div
            className={styles.ganttWorkspace}
            data-inspector={
              Boolean(selectedMilestone || selectedTask) || undefined
            }
          >
            <div className={styles.ganttFrame}>
              <SxUnifiedTimeline
                timeline={timeline}
                asOf={management.asOf}
                milestones={management.milestones}
                dependencies={management.dependencies}
                tasks={management.tasks}
                selectedMilestoneId={selectedMilestoneId}
                selectedTaskId={selectedTaskId}
                onSelectMilestone={(id) => {
                  setSelectedMilestoneId(id);
                  if (id) setSelectedTaskId(null);
                }}
                onSelectTask={(id) => {
                  setSelectedTaskId(id);
                  if (id) setSelectedMilestoneId(null);
                }}
                canManage={management.canManage}
                onEditMilestone={(id) => {
                  const milestone = management.milestones.find(
                    (item) => item.id === id,
                  );
                  if (milestone)
                    setEditor({ kind: "edit_milestone", milestone });
                }}
                onCreateMilestone={(track) =>
                  setEditor({
                    kind: "create_milestone",
                    track: track as SxTrackKey | null,
                  })
                }
                onEditTask={(id) => {
                  const task = management.tasks.find((item) => item.id === id);
                  if (task) setEditor({ kind: "edit_task", task });
                }}
                onCreateTask={(milestoneId, parentTaskId) => {
                  const milestone = management.milestones.find(
                    (item) => item.id === milestoneId,
                  );
                  const parentTask = parentTaskId
                    ? management.tasks.find(
                        (item) => item.id === parentTaskId,
                      ) || null
                    : null;
                  if (milestone)
                    setEditor({ kind: "create_task", milestone, parentTask });
                }}
                showPins={false}
              />
            </div>
            <PlanInspector
              milestone={selectedPlanMilestone}
              task={selectedTask}
              requirements={selectedRequirements}
              canManage={management.canManage}
              onClose={() => {
                setSelectedMilestoneId(null);
                setSelectedTaskId(null);
              }}
              onEdit={() => {
                if (selectedTask)
                  setEditor({ kind: "edit_task", task: selectedTask });
                else if (selectedMilestone)
                  setEditor({
                    kind: "edit_milestone",
                    milestone: selectedMilestone,
                  });
              }}
              onAddChild={() => {
                const milestone = selectedMilestone || selectedTaskMilestone;
                if (milestone)
                  setEditor({
                    kind: "create_task",
                    milestone,
                    parentTask: selectedTask,
                  });
              }}
              onAddRequirement={() => {
                if (selectedPlanMilestone)
                  setEditor({
                    kind: "create_dependency",
                    successor: selectedPlanMilestone,
                  });
              }}
              onEditRequirementMilestone={(milestone) =>
                setEditor({ kind: "edit_milestone", milestone })
              }
              onEditRequirement={(dependency) =>
                setEditor({ kind: "edit_dependency", dependency })
              }
            />
          </div>
        </section>

        <section id="partner-ledger" className={styles.section}>
          <div className={styles.sectionHeading}>
            <div>
              <h2>関係先リスト</h2>
              <p>
                PoC先を含む全関係先の進行、最新接点、現在のボールを一つの一覧で確認
              </p>
            </div>
            {management.canManage && (
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => setEditor({ kind: "create_partner" })}
              >
                <Plus aria-hidden="true" />
                関係先を追加
              </button>
            )}
          </div>
          <div className="space-y-4">
            <SxPartnerPipeline
              management={management}
              onEditPartner={(partnerId) => {
                const partner = management.partners.find(
                  (item) => item.id === partnerId,
                );
                if (partner) setEditor({ kind: "edit_partner", partner });
              }}
              onAddInteraction={(partnerId) =>
                setEditor({ kind: "create_interaction", partnerId })
              }
              onEditInteraction={(interactionId) => {
                const interaction = management.partnerInteractions.find(
                  (item) => item.id === interactionId,
                );
                if (interaction)
                  setEditor({ kind: "edit_interaction", interaction });
              }}
              onAddWorkItem={(partnerId, side) =>
                setEditor({ kind: "create_partner_work_item", partnerId, side })
              }
              onEditWorkItem={(workItemId) => {
                const workItem = management.partnerWorkItems.find(
                  (item) => item.id === workItemId,
                );
                if (workItem)
                  setEditor({ kind: "edit_partner_work_item", workItem });
              }}
              onAddRole={(partnerId) =>
                setEditor({ kind: "create_partner_role", partnerId })
              }
              onEditRole={(roleId) => {
                const role = management.partnerRoles.find(
                  (item) => item.id === roleId,
                );
                if (role) setEditor({ kind: "edit_partner_role", role });
              }}
            />
          </div>
        </section>

        <section id="issue-hypothesis" className={styles.section}>
          <div className={styles.issueHeading}>
            <div>
              <h2>論点・仮説リスト</h2>
            </div>
            {management.canManage && (
              <div className={styles.issueCreateActions}>
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={() => setEditor({ kind: "create_issue" })}
                >
                  <Plus aria-hidden="true" />
                  論点を追加
                </button>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => setEditor({ kind: "create_hypothesis_any" })}
                >
                  <Plus aria-hidden="true" />
                  仮説を追加
                </button>
              </div>
            )}
          </div>
          <div className={styles.controls}>
            <div className={styles.searchBox}>
              <Search aria-hidden="true" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="論点・仮説・担当で検索"
                aria-label="論点・仮説を検索"
              />
            </div>
            <div className={styles.filterGroup} aria-label="状態フィルター">
              {(
                [
                  ["all", `すべて ${allIssues.length}`],
                  ["attention", `要フォロー ${counts.attention}`],
                  ["stale", `更新切れ ${counts.stale}`],
                  ["overdue", `期限超過 ${counts.overdue}`],
                ] as Array<[ViewFilter, string]>
              ).map(([key, label]) => (
                <button
                  type="button"
                  key={key}
                  data-active={viewFilter === key || undefined}
                  onClick={() => setViewFilter(key)}
                >
                  {label}
                </button>
              ))}
            </div>
            <select
              className={styles.trackSelect}
              value={trackFilter}
              onChange={(event) =>
                setTrackFilter(event.target.value as SxTrackKey | "all")
              }
              aria-label="柱で絞り込み"
            >
              <option value="all">4本柱すべて</option>
              {TRACKS.map((track) => (
                <option key={track.key} value={track.key}>
                  {track.label}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.issueBoard}>
            {STAGES.map((stage) => (
              <section className={styles.stageColumn} key={stage.key}>
                <header>
                  <span>{stage.index}</span>
                  <div>
                    <h3>{stage.label}</h3>
                  </div>
                  <strong>{stageGroups[stage.key].length}</strong>
                </header>
                <div className={styles.stageCards}>
                  {stageGroups[stage.key].map((issue) => (
                    <IssueCard
                      key={issue.id}
                      issue={issue}
                      asOf={management.asOf}
                      canManage={management.canManage}
                      onEdit={setEditor}
                    />
                  ))}
                  {stageGroups[stage.key].length === 0 && (
                    <div className={styles.columnEmpty}>
                      <CircleDot aria-hidden="true" />
                      <p>
                        {query || viewFilter !== "all" || trackFilter !== "all"
                          ? "条件に合う論点なし"
                          : "この段階の論点なし"}
                      </p>
                    </div>
                  )}
                </div>
              </section>
            ))}
          </div>
        </section>

        <section id="input-readiness" className={styles.inputSection}>
          <div>
            <h2>データ接続状況</h2>
          </div>
          <div className={styles.inputCards}>
            <article>
              <FileSearch aria-hidden="true" />
              <div>
                <span>週次差分</span>
                <strong>接続待ち</strong>
                <small>完了・予定日変更・新しい詰まり</small>
              </div>
            </article>
            <article>
              <FlaskConical aria-hidden="true" />
              <div>
                <span>論点・仮説</span>
                <strong>{management.issues.length}件</strong>
                <small>現行管理台帳から仮表示</small>
              </div>
            </article>
            <article>
              <CalendarClock aria-hidden="true" />
              <div>
                <span>人員配分</span>
                <strong>{bundle.effort.actualHours.toFixed(1)}h</strong>
                <small>
                  入力 {enteredMembers}/{bundle.members.length}名 · 現行工数台帳
                </small>
              </div>
            </article>
            <article>
              <Mail aria-hidden="true" />
              <div>
                <span>メール接点</span>
                <strong>
                  {
                    management.partnerInteractions.filter(
                      (item) => item.interactionKind === "email",
                    ).length
                  }
                  件
                </strong>
                <small>本文・アドレスは非保存</small>
              </div>
            </article>
          </div>
        </section>
        <footer className={styles.pageFooter}>
          <span>
            基準日 {formatDate(management.asOf)} · 表示値は現行台帳の仮表示
          </span>
          <Link
            href={`/project/${encodeURIComponent(bundle.project.projectId)}/workspace#management-plan`}
          >
            計画詳細を既存画面で開く
            <ArrowRight aria-hidden="true" />
          </Link>
        </footer>
      </div>
      {notice && (
        <div className={styles.toast} role="status">
          <Check aria-hidden="true" />
          {notice}
        </div>
      )}
      {editor && (
        <IssueEditor
          key={`${editor.kind}-${"issue" in editor ? editor.issue.id : "new"}-${"hypothesis" in editor ? editor.hypothesis?.id || "" : ""}-${"decision" in editor ? editor.decision.id : ""}-${"action" in editor ? editor.action.id : ""}-${"milestone" in editor ? editor.milestone.id : ""}-${"task" in editor ? editor.task.id : ""}`}
          editor={editor}
          management={management}
          access={access}
          projectId={bundle.project.projectId}
          onClose={() => setEditor(null)}
          onSaved={handleSaved}
        />
      )}
    </main>
  );
}
