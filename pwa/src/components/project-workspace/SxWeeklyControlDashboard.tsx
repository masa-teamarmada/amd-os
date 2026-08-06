"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  CalendarClock,
  Check,
  ChevronDown,
  CircleDot,
  ExternalLink,
  FileSearch,
  FlaskConical,
  GitBranch,
  Mail,
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
import { useModalContainment } from "@/components/project-workspace/useModalContainment";
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
  SxPartnerCommitment,
  SxPartnerInteraction,
  SxPartnerRole,
  SxPartnerWorkItem,
  SxTask,
  SxTimelineKind,
  SxTrackKey,
  SxValidationRun,
} from "@/lib/sx-management";
import { deriveSxUnifiedTimeline } from "@/lib/sx-executive-control-deck";
import {
  sxProjectOwnerLoads,
  sxProjectWorkUnitIsDueSoon,
  sxProjectWorkUnitIsOverdue,
  type SxProjectWorkUnit,
} from "@/lib/sx-project-owner-load";
import {
  sxGateRequirementsBySuccessor,
  sxIsBlockingMilestone,
  sxOralAgreementEvidenceReady,
  type SxGateRequirement,
} from "@/lib/sx-gate-requirements";
import { sxApplyOptimisticManagementPatch } from "@/lib/sx-management-optimistic";
import { sxIsMissingOwner } from "./sx-visual-shared";
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
import {
  SxUnifiedTimeline,
  type SxDisplayLaneKey,
} from "./SxUnifiedTimeline";
import { SxPartnerPipeline } from "./SxPartnerPipeline";
import { SxProjectOwnerWorkload } from "./SxProjectOwnerWorkload";
import styles from "./weekly-control.module.css";

type StageKey = SxWeeklyIssueStage;
type ViewFilter = "all" | "attention" | "stale" | "overdue";
type WorkloadBucketKey =
  | "blocked"
  | "overdue"
  | "due_soon"
  | "owner_unknown"
  | "due_unset"
  | "decision";
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
      kind: "edit_validation";
      issue: SxManagementIssue;
      hypothesis: SxHypothesis;
      validation: SxValidationRun;
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
  | {
      kind: "create_milestone";
      track: SxTrackKey | null;
      laneKey?: SxDisplayLaneKey | null;
      /** Set by "MSを置く"/"MSを追加" — the created row is a point-MS (single "予定日"
       * field saved into both planned_start/planned_end). */
      timelineKind?: SxTimelineKind;
      plannedDate?: string | null;
      outcomeId?: string | null;
    }
  | { kind: "edit_milestone"; milestone: SxManagementMilestone }
  | {
      kind: "create_task";
      laneKey: SxDisplayLaneKey;
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
  | { kind: "edit_partner_role"; role: SxPartnerRole }
  | {
      kind: "edit_commitment";
      partnerId: string;
      commitment: SxPartnerCommitment;
    };

/** partner_next_action provenance opens edit_partner but must never expose the full 関係先編集
 * form — only the fields that fallback (sxPartnerPrimaryIntervention の partner_fallback 分岐)
 * actually reads: 次にやること・当方担当・期限・期限精度・保有側・現在の担当。 */
const PARTNER_NEXT_ACTION_FIELD_KEYS = [
  "next_commitment",
  "owner_label",
  "due_date",
  "due_date_precision",
  "current_ball_side",
  "current_ball_owner",
] as const;

type PlanFieldEditorState = {
  slot: string;
  editor: Extract<
    EditorState,
    { kind: "edit_milestone" | "edit_task" | "edit_dependency" }
  >;
  fieldKeys: string[];
  /** What record this edit applies to (usually the open item's title, but a prerequisite/
   * dependency row names its own milestone/gate instead). It is used by the direct-edit
   * control's accessible label. */
  targetLabel: string;
  /** Which field/value is being edited (担当, 状態, 予定日, 完了条件, ...). */
  fieldLabel: string;
};

type FormField = {
  key: string;
  label: string;
  /** `owner` = 既存の担当から選ぶプルダウン + 「新しい担当を追加」で自由入力へ切り替え。
   *  `lanes` = ガントの3グループの複数選択。値はレーンキーのカンマ連結で持つ。 */
  type?:
    | "text"
    | "textarea"
    | "date"
    | "number"
    | "select"
    | "checkbox"
    | "owner"
    | "lanes";
  required?: boolean;
  span?: boolean;
  options?: Array<{ value: string; label: string }>;
  help?: string;
};

/** 担当プルダウンで「新しい担当を追加」を選んだことを表す番兵値。担当名として保存されることはない。 */
const OWNER_NEW_ENTRY = "__new_owner__";

/** 担当プルダウンの候補。管制データに実在する担当名だけを集め、「担当未確認」等の欠測表現は外す。
 * メンバー台帳ではなく実データから作るので、社外の人・チーム名もそのまま候補に載る。 */
function collectOwnerCandidates(
  management: SxManagementBundle,
  currentValue: string,
  selfName?: string,
) {
  const seen = new Set<string>();
  const push = (value: string | null | undefined) => {
    const label = (value || "").trim();
    if (!label || sxIsMissingOwner(label)) return;
    seen.add(label);
  };
  management.milestones.forEach((row) => push(row.ownerLabel));
  management.tasks.forEach((row) => push(row.ownerLabel));
  management.outcomes.forEach((row) => push(row.ownerLabel));
  management.issues.forEach((row) => push(row.ownerLabel));
  management.hypotheses.forEach((row) => push(row.ownerLabel));
  management.validationRuns.forEach((row) => push(row.ownerLabel));
  management.decisions.forEach((row) => push(row.ownerLabel));
  management.actions.forEach((row) => push(row.ownerLabel));
  management.partnerWorkItems.forEach((row) => push(row.ownerLabel));
  management.technicalTests.forEach((row) => push(row.ownerLabel));
  management.organizationRoles.forEach((row) => push(row.ownerLabel));
  push(selfName);
  const list = [...seen].sort((a, b) => a.localeCompare(b, "ja"));
  const current = currentValue.trim();
  // 既存値が候補から漏れていても選択状態を失わない（欠測表現・過去の自由入力もここで拾う）。
  if (current && !list.includes(current)) list.unshift(current);
  return list;
}

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

const WORKLOAD_BUCKETS: Array<{
  key: WorkloadBucketKey;
  label: string;
  hint: string;
}> = [
  { key: "decision", label: "判断待ち", hint: "今週決めること" },
  { key: "blocked", label: "停止", hint: "MS・タスク・保有事項" },
  { key: "overdue", label: "期限超過", hint: "未完了のみ" },
  { key: "due_soon", label: "7日以内", hint: "今週〜来週が期限" },
  { key: "owner_unknown", label: "担当不明", hint: "担当未確認" },
  { key: "due_unset", label: "期限なし", hint: "期限が未設定" },
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

/** The management model keeps funding and organization as distinct source tracks, but the
 * weekly-control Gantt has exactly three user-facing lanes. Anything that creates or describes a
 * Gantt row must speak this three-lane language; exposing the raw four-track taxonomy in the MS
 * form makes it look as though a forbidden fourth lane will be created. */
function ganttLaneLabelForTrack(track: SxTrackKey) {
  if (track === "business_development") return "事業開発";
  if (track === "technology_development") return "技術開発";
  return "組織開発";
}

/** ガントの3グループ。MS作成フォームの複数選択と、レーン→保存用トラックの変換に使う。 */
const GANTT_LANE_CHOICES: Array<{ key: SxDisplayLaneKey; label: string }> = [
  { key: "business_development", label: "事業開発" },
  { key: "technology_development", label: "技術開発" },
  { key: "organization", label: "組織開発" },
];

function laneMatchesTrack(laneKey: SxDisplayLaneKey, track: SxTrackKey) {
  if (laneKey === "organization")
    return track === "funding" || track === "organizational_building";
  return track === laneKey;
}

/** MSはDB上いまも成果(outcome)にぶら下がる。人が選ぶのは表示グループだけなので、選んだ先頭
 * グループから保存用の親成果を自動で決める。 */
function milestoneOutcomeForLane(
  management: SxManagementBundle,
  laneKey: SxDisplayLaneKey,
) {
  return (
    management.outcomes.find((outcome) =>
      laneMatchesTrack(laneKey, outcome.track),
    ) || null
  );
}

/** カンマ連結で持っているレーン選択を、正規の順序（事業→技術→組織）の配列へ戻す。 */
function parseLaneKeys(value: string | undefined): SxDisplayLaneKey[] {
  const chosen = new Set((value || "").split(",").filter(Boolean));
  return GANTT_LANE_CHOICES.filter((lane) => chosen.has(lane.key)).map(
    (lane) => lane.key,
  );
}

function ganttLaneKeyForMilestone(
  milestone: SxManagementMilestone,
): SxDisplayLaneKey {
  if (milestone.slug === "business-paid-poc-oral-agreement")
    return "business_development";
  if (milestone.slug === "funding-investment-oral-agreement")
    return "organization";
  if (milestone.track === "business_development")
    return "business_development";
  if (milestone.track === "technology_development")
    return "technology_development";
  return "organization";
}

/** A task retains a hidden legacy milestone FK only for database compatibility. The control
 * board never exposes that container: a new task uses the first active backing container in its
 * visible lane automatically. */
function taskBackingMilestone(
  management: SxManagementBundle,
  laneKey: SxDisplayLaneKey,
) {
  const candidates = management.milestones.filter(
    (milestone) =>
      ganttLaneKeyForMilestone(milestone) === laneKey &&
      milestone.status !== "completed" &&
      milestone.timelineKind === "phase",
  );
  return candidates.sort((left, right) => left.title.localeCompare(right.title))[0] || null;
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
  if (["closed", "decided", "validated", "completed"].includes(status))
    return styles.toneResolved;
  if (["validating", "running"].includes(status)) return styles.toneValidating;
  if (["blocked"].includes(status)) return styles.toneDanger;
  // "rejected"(棄却) is a closed-but-not-a-success outcome — it must not read the same as
  // decided/validated/completed (toneResolved implies the positive resolutions), so it shares
  // the same muted tone as on_hold instead (2026-08 再監査是正).
  if (["on_hold", "rejected"].includes(status)) return styles.toneMuted;
  return styles.toneOpen;
}

function fieldValue(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return value == null ? "" : String(value);
}

/** A generic point-MS (timelineKind='milestone', not one of the 2 NewCo founding-prerequisite
 * gates) is a single day, not a range — every editing surface (root editor, PlanInspector's fixed
 * facts cell, mobile, keyboard) shows one "予定日" field for it instead of 計画開始/計画完了, and
 * saves that single value into both planned_start/planned_end. The 2 NewCo gates keep the normal
 * 2-field 計画期間, matching the DB point-MS CHECK exception. */
function isGenericPointMilestone(milestone: SxManagementMilestone): boolean {
  return milestone.timelineKind === "milestone" && !sxIsBlockingMilestone(milestone);
}

function editorInitialValues(
  editor: EditorState,
  access: CurrentMemberAccess,
  management: SxManagementBundle,
): Record<string, string> {
  const asOf = management.asOf;
  if (editor.kind === "create_milestone") {
    // A new MS is always a point. The legacy phase creation branch intentionally has no UI
    // path: people place task and MS records only.
    return {
      display_lane_keys: editor.laneKey || "",
      title: "",
      planned_date: editor.plannedDate || "",
      completion_criteria: "",
    };
  }
  if (editor.kind === "edit_milestone")
    return {
      title: editor.milestone.title,
      gate: editor.milestone.gate,
      status: editor.milestone.manualStatus,
      ...(isGenericPointMilestone(editor.milestone)
        ? { planned_date: editor.milestone.plannedStart || "" }
        : {
            planned_start: editor.milestone.plannedStart || "",
            planned_end: editor.milestone.plannedEnd || "",
          }),
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
  if (editor.kind === "create_task") {
    const selected = taskBackingMilestone(management, editor.laneKey);
    return {
      milestone_id: selected?.id || "",
      parent_task_id: "",
      track: selected?.track || "",
      title: "",
      description: "",
      status: "unassessed",
      planned_start: selected?.plannedStart || asOf,
      planned_end: selected?.plannedEnd || "",
      progress_pct: "0",
      date_certainty: "provisional",
      owner_label: selected?.ownerLabel || access.displayName,
      goal: "",
      next_deliverable: "",
      blocker: "",
      completion_criteria: "",
      confidence: "unknown",
    };
  }
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
      goal: editor.task.goal || "",
      next_deliverable: editor.task.nextDeliverable || "",
      blocker: editor.task.blocker || "",
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
  if (editor.kind === "edit_commitment")
    return {
      title: editor.commitment.title,
      commitment_text: editor.commitment.commitmentText,
      commitment_kind: editor.commitment.commitmentKind,
      status: editor.commitment.status,
      promised_on: editor.commitment.promisedOn || "",
      due_date: editor.commitment.dueDate || "",
      completed_on: editor.commitment.completedOn || "",
      owner_label: editor.commitment.ownerLabel,
      counterparty_owner: editor.commitment.counterpartyOwner || "",
      sx_owner: editor.commitment.sxOwner || "",
      evidence: editor.commitment.evidence || "",
      next_review_on: editor.commitment.nextReviewOn || "",
      confidence: editor.commitment.confidence,
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
  if (editor.kind === "edit_validation")
    return {
      validation_kind: editor.validation.validationKind,
      planned_on: editor.validation.plannedOn || "",
      due_date: editor.validation.dueDate || "",
      status: editor.validation.status,
      owner_label: editor.validation.ownerLabel,
      method: editor.validation.method,
      confidence: editor.validation.confidence,
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
      { value: "not_started", label: "未着手" },
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
  if (editor.kind === "create_milestone") {
    return {
      title: "MSを追加",
      eyebrow: "MS",
      resource: "milestone",
      method: "POST",
      fields: [
        {
          key: "display_lane_keys",
          label: "配置するグループ",
          type: "lanes",
          required: true,
          span: true,
          help: "このMSをゲートとして出すグループ。複数のグループにまたがるMSは、またがる分だけ選んでね。",
        },
        {
          key: "title",
          label: "MS名",
          type: "textarea",
          required: true,
          span: true,
        },
        {
          key: "planned_date",
          label: "予定日",
          type: "date" as const,
          required: true,
        },
        {
          key: "completion_criteria",
          label: "完了条件（任意）",
          type: "textarea" as const,
          span: true,
          help: "何を確認できたらこのMSを達成とするか。まだ決められなければ空欄で追加できるよ。",
        },
      ],
    };
  }
  if (editor.kind === "edit_milestone") {
    const isGenericMs = isGenericPointMilestone(editor.milestone);
    return {
      title: "MSを編集",
      eyebrow: "MS",
      resource: "milestone",
      method: "PATCH",
      id: editor.milestone.id,
      fields: [
        {
          key: "title",
          label: "MS名",
          type: "textarea",
          required: true,
          span: true,
        },
        { key: "gate", label: "到達点", required: true },
        planStatus,
        { key: "owner_label", label: "担当", required: true },
        ...(isGenericMs
          ? [{ key: "planned_date", label: "予定日", type: "date" as const }]
          : [
              { key: "planned_start", label: "計画開始", type: "date" as const },
              { key: "planned_end", label: "計画完了", type: "date" as const },
            ]),
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
  }
  if (editor.kind === "create_task" || editor.kind === "edit_task")
    return {
      title:
        editor.kind === "create_task"
          ? `${editor.laneKey === "business_development" ? "事業開発" : editor.laneKey === "technology_development" ? "技術開発" : "組織開発"}にタスクを追加`
          : "タスクを編集",
      eyebrow: "タスク",
      resource: "task",
      method: editor.kind === "create_task" ? "POST" : "PATCH",
      id: editor.kind === "edit_task" ? editor.task.id : undefined,
      fields: [
        ...planFields,
        { key: "description", label: "作業内容", type: "textarea", span: true },
        { key: "goal", label: "ゴール", type: "textarea", span: true },
        { key: "next_deliverable", label: "次の成果物", type: "textarea", span: true },
        { key: "blocker", label: "詰まり", type: "textarea", span: true },
        { key: "actual_end", label: "実績完了", type: "date" },
      ],
    };
  if (editor.kind === "create_dependency" || editor.kind === "edit_dependency")
    return {
      title:
        editor.kind === "create_dependency"
          ? "必須条件を追加"
          : "必須条件を編集",
      eyebrow: "設立前提",
      resource: "dependency",
      method: editor.kind === "create_dependency" ? "POST" : "PATCH",
      id: editor.kind === "edit_dependency" ? editor.dependency.id : undefined,
      fields: [
        ...(editor.kind === "create_dependency"
          ? [
              {
                key: "predecessor_milestone_id",
                label: "先へ進む前に満たすMS",
                type: "select" as const,
                required: true,
                span: true,
                options: [
                  { value: "", label: "MSを選んでね" },
                  ...management.milestones
                    .filter(
                      (milestone) =>
                        milestone.timelineKind === "milestone" &&
                        milestone.id !== editor.successor.id,
                    )
                    .map((milestone) => ({
                      value: milestone.id,
                      label: `${trackMeta(milestone.track).short}｜${milestone.title}`,
                    })),
                ],
              },
              {
                key: "successor_milestone_id",
                label: "このMS",
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
            { value: "finish_to_start", label: "先行MSの完了後に進む" },
          ],
          help: "設立前提は「口頭合意の確認＋証跡」を充足条件にするよ。",
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
          label: "影響するMS",
          type: "select",
          span: true,
          options: [
            { value: "", label: "未接続" },
            ...management.milestones
              .filter((milestone) => milestone.timelineKind === "milestone")
              .map((milestone) => ({
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
  if (editor.kind === "edit_commitment")
    return {
      title: "約束・次アクションを編集",
      eyebrow: "約束・次アクション",
      resource: "commitment",
      method: "PATCH",
      id: editor.commitment.id,
      fields: [
        {
          key: "commitment_kind",
          label: "種別",
          type: "select",
          required: true,
          options: [
            { value: "counterparty_promise", label: "相手の約束" },
            { value: "sx_followup", label: "SX側の次アクション" },
          ],
        },
        {
          key: "title",
          label: "タイトル",
          required: true,
        },
        {
          key: "commitment_text",
          label: "内容",
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
            { value: "open", label: "未着手" },
            { value: "in_progress", label: "進行中" },
            { value: "completed", label: "完了" },
            { value: "blocked", label: "停止" },
            { value: "cancelled", label: "取消" },
          ],
        },
        { key: "owner_label", label: "担当", required: true },
        {
          key: "counterparty_owner",
          label: "相手担当",
          help: "相手の約束には相手担当・約束日・一次根拠が必要だよ。",
        },
        { key: "sx_owner", label: "SX担当" },
        { key: "promised_on", label: "約束日", type: "date" },
        { key: "due_date", label: "期限", type: "date" },
        { key: "next_review_on", label: "次回確認", type: "date" },
        { key: "completed_on", label: "完了日", type: "date" },
        {
          key: "evidence",
          label: "一次根拠",
          type: "textarea",
          span: true,
        },
        confidence,
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
          label: "関連MS",
          type: "select",
          options: [
            { value: "", label: "未接続" },
            ...management.milestones
              .filter((milestone) => milestone.timelineKind === "milestone")
              .map((milestone) => ({
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
  if (editor.kind === "edit_validation")
    return {
      title: "検証を編集",
      eyebrow: "検証",
      resource: "validation",
      method: "PATCH",
      id: editor.validation.id,
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

// task/milestone editors carry more fields (plan period, progress, criticality, required-task
// context) than the generic issue/hypothesis/decision/partner forms, so the record-sheet dialog
// runs wider for them (~920px vs ~760px for everything else) — see .editorPanel[data-editor-width]
// in weekly-control.module.css.
const WIDE_EDITOR_KINDS = new Set<EditorState["kind"]>([
  "create_milestone",
  "edit_milestone",
  "create_task",
  "edit_task",
]);

const PRIMARY_FIELD_KEYS = new Set([
  "title",
  "statement",
  "name",
  "commitment_text",
]);

const FIELD_GROUP_BASIC_KEYS = new Set([
  "track",
  "outcome_id",
  "milestone_id",
  "parent_task_id",
  "related_milestone_id",
  "predecessor_milestone_id",
  "successor_milestone_id",
  "issue_id",
  "hypothesis_id",
  "primary_track",
  "item_kind",
  "side",
  "interaction_kind",
  "commitment_kind",
  "dependency_type",
  "evidence_kind",
  "knowledge_type",
  "role_kind",
]);

const FIELD_GROUP_STATUS_KEYS = new Set([
  "status",
  "confidence",
  "criticality",
  "agreement_state",
  "relationship_stage",
  "current_ball_side",
  "ball_side_after",
  "actor_side",
  "is_primary",
  "is_this_week",
  "sort_order",
  "required",
  "owner_label",
  "current_ball_owner",
  "ball_owner_after",
  "actor_label",
  "counterparty_owner",
  "sx_owner",
  "accepted_by",
]);

type FieldGroupKey = "basic" | "date" | "status" | "content";

const FIELD_GROUP_LABEL: Record<FieldGroupKey, string> = {
  basic: "分類・接続先",
  date: "日程・進捗",
  status: "状態・担当",
  content: "内容",
};

const FIELD_GROUP_ORDER: FieldGroupKey[] = ["basic", "content", "status", "date"];

function classifyField(field: FormField): FieldGroupKey {
  if (
    field.type === "date" ||
    field.key === "date_certainty" ||
    field.key === "due_date_precision" ||
    field.key === "occurred_on_precision" ||
    field.key === "progress_pct"
  )
    return "date";
  if (FIELD_GROUP_BASIC_KEYS.has(field.key)) return "basic";
  if (FIELD_GROUP_STATUS_KEYS.has(field.key)) return "status";
  return "content";
}

/** Groups a flat field list into semantic sections (分類・接続先 / 日程・進捗 / 状態・担当 /
 * 内容) instead of one undifferentiated grid — a form field belongs to exactly one section by
 * key/type, so this never needs per-editor-kind maintenance as fields are added. */
function groupFormFields(
  fields: FormField[],
): Array<{ key: FieldGroupKey; label: string; fields: FormField[] }> {
  const buckets = new Map<FieldGroupKey, FormField[]>();
  for (const field of fields) {
    const kind = classifyField(field);
    buckets.set(kind, [...(buckets.get(kind) || []), field]);
  }
  return FIELD_GROUP_ORDER.filter((kind) => buckets.has(kind)).map((kind) => ({
    key: kind,
    label: FIELD_GROUP_LABEL[kind],
    fields: buckets.get(kind) as FormField[],
  }));
}

function IssueEditor({
  editor,
  management,
  access,
  projectId,
  onClose,
  onSaved,
  onReconciled,
  onSyncFailed,
  onDirtyChange,
  embedded = false,
  inlineField = false,
  fieldKeys,
  requestCloseRef,
  onKeepEditing,
  ariaDescribedBy,
}: {
  editor: EditorState;
  management: SxManagementBundle;
  access: CurrentMemberAccess;
  projectId: string;
  onClose: () => void;
  onSaved: (bundle: SxManagementBundle, message: string) => void;
  /** Replaces the temporary local projection after the background write settles. */
  onReconciled?: (bundle: SxManagementBundle) => void;
  /** A save was locally accepted but did not reach the DB; never silently keep it on screen. */
  onSyncFailed?: (message: string) => void;
  onDirtyChange?: (dirty: boolean) => void;
  embedded?: boolean;
  inlineField?: boolean;
  fieldKeys?: readonly string[];
  /** Explicit contract for a parent that needs to trigger this editor's own dirty-close
   * confirmation flow from outside (e.g. PlanInspector's "close detail" button) without a
   * DOM query/click hack. Only one child editor is ever mounted under a given ref at a time
   * (embedded detailEditor and inlineField editor are mutually exclusive), so it always reflects
   * whichever one is currently active; unmounting clears it back to null. */
  requestCloseRef?: React.MutableRefObject<(() => void) | null>;
  /** Clears a parent-owned pending intent when the user chooses to keep editing. */
  onKeepEditing?: () => void;
  ariaDescribedBy?: string;
}) {
  const initialValues = useRef(
    editorInitialValues(editor, access, management),
  );
  const [values, setValues] = useState<Record<string, string>>(
    () => initialValues.current,
  );
  const definition = editorDefinition(editor, management);
  // 候補は開いた時点の担当で固定する。入力途中の文字列で作り直すと候補が揺れる。
  const ownerCandidates = useMemo(
    () =>
      collectOwnerCandidates(
        management,
        initialValues.current.owner_label || "",
        access.displayName,
      ),
    [management, access.displayName],
  );
  const fieldsForCurrentSelection = definition.fields.map((field) => {
    if (field.key !== "owner_label" || field.options) return field;
    return {
      ...field,
      type: "owner" as const,
      options: [
        { value: "", label: "担当を選ぶ" },
        ...ownerCandidates.map((name) => ({ value: name, label: name })),
        { value: OWNER_NEW_ENTRY, label: "＋ 新しい担当を追加" },
      ],
    };
  });
  const fieldKeySet = fieldKeys ? new Set(fieldKeys) : null;
  const activeFields = fieldKeySet
    ? fieldsForCurrentSelection.filter((field) => fieldKeySet.has(field.key))
    : fieldsForCurrentSelection;
  const hasVisibleField = (key: string) =>
    activeFields.some((field) => field.key === key);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  /** 担当欄のうち、いま自由入力モードにしているフィールド。入力中の文字が既存候補と一致した
   * 瞬間に入力欄が消えないよう、値ではなくモードそのものを保持する。 */
  const [manualOwnerKeys, setManualOwnerKeys] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );
  const editorPanelRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const discardBackButtonRef = useRef<HTMLButtonElement>(null);
  const lastFocusedFieldNameRef = useRef<string | null>(null);
  const dirty =
    JSON.stringify(values) !== JSON.stringify(initialValues.current);

  useEffect(() => {
    onDirtyChange?.(dirty);
    return () => onDirtyChange?.(false);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    if (!dirty) setConfirmingDiscard(false);
  }, [dirty]);

  function focusFirstEditableField() {
    const frame = window.requestAnimationFrame(() => {
      editorPanelRef.current
        ?.querySelector<HTMLElement>(
          "textarea:not([disabled]), input:not([disabled]):not([type='hidden']), select:not([disabled])",
        )
        ?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }

  function focusLastEditableField() {
    const frame = window.requestAnimationFrame(() => {
      const fieldName = lastFocusedFieldNameRef.current;
      const lastField = fieldName
        ? editorPanelRef.current?.querySelector<HTMLElement>(`[name="${fieldName}"]:not([disabled])`)
        : null;
      if (lastField) {
        lastField.focus();
        return;
      }
      editorPanelRef.current
        ?.querySelector<HTMLElement>(
          "textarea:not([disabled]), input:not([disabled]):not([type='hidden']), select:not([disabled])",
        )
        ?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }

  function rememberFocusedField(event: React.FocusEvent<HTMLElement>) {
    const target = event.target;
    if (
      (target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement) &&
      target.name
    ) {
      lastFocusedFieldNameRef.current = target.name;
    }
  }

  // Focus + scroll the "戻る" button into view the moment the discard confirmation appears —
  // it's a role=status/aria-live region, not a modal alertdialog, so nothing forces attention to
  // it automatically.
  useEffect(() => {
    if (!confirmingDiscard) return;
    const frame = window.requestAnimationFrame(() => {
      discardBackButtonRef.current?.focus();
      discardBackButtonRef.current?.scrollIntoView({ block: "nearest" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [confirmingDiscard]);

  // Pressing 戻る (decline the discard, keep editing) must send focus back to the field the user
  // was editing, not leave it stranded on the 戻る button that just disappeared. Only fires on the
  // true->false transition (not on initial mount, which the effect below already owns).
  const wasConfirmingDiscardRef = useRef(false);
  useEffect(() => {
    if (wasConfirmingDiscardRef.current && !confirmingDiscard) {
      focusLastEditableField();
    }
    wasConfirmingDiscardRef.current = confirmingDiscard;
  }, [confirmingDiscard]);

  // Initial focus goes to the first editable field, not the close button — matches the record-
  // sheet modal contract (embedded/inlineField already focused the first field; the root dialog
  // now does too, instead of parking focus on close).
  useEffect(() => {
    return focusFirstEditableField();
  }, [embedded, inlineField]);

  function focusField(key: string) {
    window.requestAnimationFrame(() => {
      editorPanelRef.current
        ?.querySelector<HTMLElement>(`[name="${key}"]`)
        ?.focus();
    });
  }

  function requestClose() {
    if (!dirty) {
      onClose();
      return;
    }
    setConfirmingDiscard(true);
  }

  // Publish the latest requestClose to the parent-owned ref from an effect (never during render —
  // mutating a ref passed in from outside as a render-time side effect races against React's own
  // commit/cleanup ordering when one editor instance is being swapped for another). Runs after
  // every render so the ref always holds the closure matching the current `dirty`/`values`. The
  // cleanup only clears the ref if it still points at THIS instance's own requestClose — if a
  // newer editor already re-registered itself before this one's cleanup runs, that registration
  // must survive untouched.
  useEffect(() => {
    if (!requestCloseRef) return;
    requestCloseRef.current = requestClose;
    return () => {
      if (requestCloseRef.current === requestClose) requestCloseRef.current = null;
    };
  });

  // ルート編集モーダル（embedded/inlineFieldでない = 全画面backdropのdialog）だけ、
  // PlanInspectorと同じ流儀でfocus封じ込め・背面inert化・Tabトラップ・dirty確認込みの
  // Escape closeを適用する。embedded/inlineFieldは既存のPlanInspector側containmentの
  // 内側に描画されるため、ここで二重にcontainmentしない。
  // useModalContainmentはdialog.parentElementをdocument.bodyの直接の子（portal layer）と
  // 仮定してそれ以外のbody直下要素をinert化するため、dialogRef（=editorPanelRef、root時は
  // dialog roleを持つsection）はcreatePortalでdocument.body直下へ描画したlayer divの直接の
  // 子でなければならない（inlineのdivのままだとdashboard内mainがinert化対象になり、AppShell
  // 祖先ごとinertになってモーダル自身も操作不能になる、2026-08 監査追補）。
  // initialFocusRefはeditorPanelRef自身（tabIndex=-1で常にfocus可能）にし、上のrAF effectが
  // 実フィールドへ確実に移すまでの中立な着地点にする（閉じるボタンへ先に飛ばさない）。
  useModalContainment({
    dialogRef: editorPanelRef,
    initialFocusRef: editorPanelRef,
    onClose: requestClose,
    active: !embedded && !inlineField,
  });

  async function save() {
    setError(null);
    const missingRequired = activeFields.find(
      (field) => field.required && !fieldValue(values, field.key).trim(),
    );
    if (missingRequired) {
      setError(`${missingRequired.label}を入力してね`);
      focusField(missingRequired.key);
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
      focusField("decision_text");
      return;
    }
    if (
      (editor.kind === "create_action" || editor.kind === "edit_action") &&
      values.status === "completed" &&
      (!values.completion_note?.trim() || !values.completed_at)
    ) {
      setError("完了にするには、完了メモと完了日を入れてね");
      focusField("completion_note");
      return;
    }
    if (
      editor.kind === "edit_milestone" &&
      values.status === "completed" &&
      (!fieldKeySet ||
        ["status", "actual_end", "completion_evidence"].some((key) =>
          fieldKeySet.has(key),
        ))
    ) {
      if (!values.actual_end || !values.completion_evidence?.trim()) {
        setError("完了にするには、実績完了日と完了証跡を入れてね");
        focusField("actual_end");
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
        focusField("completion_evidence");
        return;
      }
    }
    // MSが立つ場所は人にとっては「グループ」。DBの親成果はそこから逆算する。
    const selectedMilestoneLanes =
      editor.kind === "create_milestone"
        ? parseLaneKeys(values.display_lane_keys)
        : [];
    const selectedMilestoneOutcome =
      editor.kind === "create_milestone" && selectedMilestoneLanes.length
        ? milestoneOutcomeForLane(management, selectedMilestoneLanes[0])
        : null;
    if (editor.kind === "create_milestone" && !selectedMilestoneLanes.length) {
      setError("配置するグループを選んでね");
      focusField("display_lane_keys:business_development");
      return;
    }
    if (editor.kind === "create_milestone" && !selectedMilestoneOutcome) {
      setError("このグループにMSを置くための基準情報がまだないよ");
      return;
    }
    const selectedTaskMilestone =
      editor.kind === "create_task"
        ? taskBackingMilestone(management, editor.laneKey)
        : null;
    if (editor.kind === "create_task" && !selectedTaskMilestone) {
      setError("このレーンにタスクを置くための基準情報がまだないよ");
      return;
    }
    if (editor.kind === "create_task" && values.parent_task_id) {
      const selectedParentTask = management.tasks.find(
        (task) => task.id === values.parent_task_id,
      );
      if (
        !selectedParentTask ||
        selectedParentTask.milestoneId !== selectedTaskMilestone?.id
      ) {
        setError("親タスクは同じタスク群から選んでね");
        focusField("parent_task_id");
        return;
      }
    }
    setSaving(true);
    const isPatch = definition.method === "PATCH";
    const fieldsToSubmit = fieldKeySet
      ? Object.entries(values).filter(([key]) => fieldKeySet.has(key))
      : Object.entries(values);
    const fields: Record<string, unknown> = Object.fromEntries(
      fieldsToSubmit.map(([key, value]) => {
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
            "planned_date",
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
    if (editor.kind === "create_task") {
      // The visible lane is not a persistence parent. Derive the authoritative raw track from
      // its internal backing record so the three visible lanes remain stable.
      fields.track = selectedTaskMilestone?.track || "";
      fields.milestone_id = selectedTaskMilestone?.id || "";
    }
    if (editor.kind === "create_milestone") {
      fields.objective_id = management.objective?.id || "";
      // 人が選ぶのは表示グループ。1件のMSが複数グループにゲートとして現れる。
      fields.display_lane_keys = selectedMilestoneLanes;
      fields.outcome_id = selectedMilestoneOutcome?.id || "";
      // The selected outcome is the authoritative parent. Deriving the exact DB track from it
      // keeps the form's visible taxonomy at the approved three Gantt lanes while satisfying the
      // DB invariant milestone.track === outcome.track (funding and organizational_building both
      // render in the single 組織開発 lane).
      fields.track = selectedMilestoneOutcome?.track || "";
      fields.timeline_kind = "milestone";
      fields.slug = `ms-${Date.now().toString(36)}`;
      // MSは単一の予定日。フォームでは1項目だけ見せ、保存時にplanned_start/
      // planned_endの両方へ同じ値を書く。
      const plannedDate = (fields.planned_date as string | null) ?? null;
      delete fields.planned_date;
      fields.planned_start = plannedDate;
      fields.planned_end = plannedDate;
    }
    if (editor.kind === "edit_milestone" && "planned_date" in fields) {
      // 既存の一般MSを編集するときも同じ不変条件: 予定日1項目をplanned_start/planned_endの
      // 両方へ書く（`fieldKeys=["planned_date"]`のPlanInspectorインライン編集を含む）。
      const plannedDate = (fields.planned_date as string | null) ?? null;
      delete fields.planned_date;
      fields.planned_start = plannedDate;
      fields.planned_end = plannedDate;
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
    // MS/タスクの計画日程は本番データで、ガントの直接編集(ドラッグ)と同じ楽観的並行制御を
    // 使う。読み込んだ時点のversionを一緒に送り、他の変更と競合していたら409で検知する
    // （最後に保存した側が黙って上書きしない）。
    const expectedVersion =
      isPatch && editor.kind === "edit_milestone"
        ? editor.milestone.version
        : isPatch && editor.kind === "edit_task"
          ? editor.task.version
          : undefined;
    const requestBody = isPatch
      ? {
          resource: definition.resource,
          id: definition.id,
          patch: fields,
          ...(expectedVersion != null
            ? { expected_version: expectedVersion }
            : {}),
        }
      : { resource: definition.resource, fields };

    // Existing records commit to the screen first. A PM should be able to continue straight
    // away; the server's full-bundle rebuild is deliberately no longer on the modal's critical
    // path. A failed background write always reconciles from the DB and is called out explicitly.
    if (isPatch && definition.id) {
      const optimistic = sxApplyOptimisticManagementPatch(
        management,
        definition.resource,
        definition.id,
        fields,
      );
      onSaved(optimistic, `${definition.title}を保存したよ。DBへ同期中`);
      void (async () => {
        try {
          const response = await fetch(
            `/api/project-workspace/${encodeURIComponent(projectId)}/management`,
            {
              method: definition.method,
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(requestBody),
            },
          );
          const body = await response.json().catch(() => ({}));
          if (response.status === 409)
            throw new Error("他の人がこの内容を先に更新したよ");
          if (!response.ok)
            throw new Error(
              typeof body.error === "string" ? body.error : "保存できなかったよ",
            );
          // The optimistic projection already contains the exact submitted fields. Do not
          // replace it with this response: another cell may have been saved while this request
          // was in flight, and an older full bundle must never erase that newer visible edit.
        } catch (caught) {
          const message =
            caught instanceof Error ? caught.message : "保存できなかったよ";
          try {
            const latest = await fetch(
              `/api/project-workspace/${encodeURIComponent(projectId)}/management`,
              { headers: { "Cache-Control": "no-store" } },
            );
            const latestBody = await latest.json().catch(() => null);
            if (latest.ok && latestBody) {
              onReconciled?.(latestBody as SxManagementBundle);
              onSyncFailed?.(`${message}。最新の内容に戻したよ`);
              return;
            }
          } catch {
            // The notification below makes the unresolved state explicit.
          }
          onSyncFailed?.(`${message}。同期状況を確認できないから、画面を再読み込みしてね`);
        }
      })();
      return;
    }
    try {
      const response = await fetch(
        `/api/project-workspace/${encodeURIComponent(projectId)}/management`,
        {
          method: definition.method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        },
      );
      const body = await response.json().catch(() => ({}));
      if (response.status === 409) {
        const latest = await fetch(
          `/api/project-workspace/${encodeURIComponent(projectId)}/management`,
          { headers: { "Cache-Control": "no-store" } },
        );
        const latestBody = await latest.json().catch(() => null);
        if (latest.ok && latestBody) {
          onSaved(
            latestBody as SxManagementBundle,
            "他の人がこの内容を先に更新したよ。最新の内容に更新したから、もう一度確認してね",
          );
          return;
        }
        throw new Error(
          "他の人がこの内容を先に更新したよ。画面を再読み込みしてね",
        );
      }
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

  function renderField(field: FormField, forceSpan = false) {
    return (
      <label
        key={field.key}
        className={field.span || forceSpan ? styles.fieldSpan : styles.field}
      >
        <span>
          {field.label}
          {field.required && <b>必須</b>}
        </span>
        {field.type === "textarea" ? (
          <textarea
            name={field.key}
            rows={field.key === "completion_evidence" ? 3 : 2}
            required={field.required}
            value={fieldValue(values, field.key)}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                [field.key]: event.target.value,
              }))
            }
          />
        ) : field.type === "owner" ? (
          manualOwnerKeys.has(field.key) ? (
            <span className={styles.ownerManualRow}>
              <input
                name={field.key}
                type="text"
                autoFocus
                placeholder="担当の名前を入力"
                required={field.required}
                value={fieldValue(values, field.key)}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    [field.key]: event.target.value,
                  }))
                }
              />
              <button
                type="button"
                onClick={() => {
                  setManualOwnerKeys((current) => {
                    const next = new Set(current);
                    next.delete(field.key);
                    return next;
                  });
                  // 一覧へ戻したら、自由入力を始める前の担当へ復帰させる。空のまま残すと
                  // 「変更していないのに未保存」の状態が居座り、破棄確認から抜けられなくなる。
                  const restored = initialValues.current[field.key] || "";
                  setValues((current) => ({
                    ...current,
                    [field.key]: field.options?.some(
                      (option) => option.value === restored,
                    )
                      ? restored
                      : "",
                  }));
                }}
              >
                一覧から選ぶ
              </button>
            </span>
          ) : (
            <select
              name={field.key}
              required={field.required}
              value={fieldValue(values, field.key)}
              onChange={(event) => {
                const nextValue = event.target.value;
                if (nextValue === OWNER_NEW_ENTRY) {
                  setManualOwnerKeys((current) =>
                    new Set(current).add(field.key),
                  );
                  setValues((current) => ({ ...current, [field.key]: "" }));
                  return;
                }
                setValues((current) => ({ ...current, [field.key]: nextValue }));
              }}
            >
              {field.options?.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          )
        ) : field.type === "select" ? (
          <select
            name={field.key}
            required={field.required}
            value={fieldValue(values, field.key)}
            onChange={(event) => {
              const nextValue = event.target.value;
              setValues((current) => ({
                ...current,
                [field.key]: nextValue,
                ...(editor.kind === "create_task" &&
                field.key === "milestone_id" &&
                current.milestone_id !== nextValue
                  ? { parent_task_id: "" }
                  : {}),
              }));
            }}
          >
            {field.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : field.type === "lanes" ? (
          <span className={styles.laneChoiceRow}>
            {GANTT_LANE_CHOICES.map((lane) => {
              const chosen = parseLaneKeys(values[field.key]);
              return (
                <label key={lane.key}>
                  <input
                    type="checkbox"
                    name={`${field.key}:${lane.key}`}
                    checked={chosen.includes(lane.key)}
                    onChange={(event) => {
                      const next = new Set(chosen);
                      if (event.target.checked) next.add(lane.key);
                      else next.delete(lane.key);
                      setValues((current) => ({
                        ...current,
                        [field.key]: GANTT_LANE_CHOICES.filter((item) =>
                          next.has(item.key),
                        )
                          .map((item) => item.key)
                          .join(","),
                      }));
                    }}
                  />
                  <span>{lane.label}</span>
                </label>
              );
            })}
          </span>
        ) : field.type === "checkbox" ? (
          <span className={styles.checkboxRow}>
            <input
              name={field.key}
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
            name={field.key}
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
    );
  }

  // 一つのタイトル/名称フィールドは、ヘッダー・対象コンテキスト・入力欄のどれか1箇所だけに置く
  // （同じ値を重複表示しない）。ルート/embeddedフォームでは本文最上段に単独で大きく置き、
  // 残りは意味別グループへ分ける。inlineFieldは1〜数項目の直接編集スロットのためグルーピング
  // しない（1項目をグループ見出し付きで囲む方が読みにくい）。
  const primaryField = !inlineField
    ? activeFields.find((field) => PRIMARY_FIELD_KEYS.has(field.key))
    : undefined;
  const remainingFields = primaryField
    ? activeFields.filter((field) => field !== primaryField)
    : activeFields;
  const fieldGroups = inlineField ? null : groupFormFields(remainingFields);

  const fieldsBlock = (
    <>
      {primaryField && (
        <div className={styles.formGrid}>{renderField(primaryField, true)}</div>
      )}
      {fieldGroups ? (
        <div className={styles.formGrid}>
          {fieldGroups.map((group) => (
            <div key={group.key} className={styles.fieldGroup}>
              <p className={styles.fieldGroupLabel}>{group.label}</p>
              <div className={styles.formGrid}>
                {group.fields.map((field) => renderField(field))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={inlineField ? styles.inlineFieldForm : styles.formGrid}>
          {remainingFields.map((field) => renderField(field))}
        </div>
      )}
      {error && (
        <p className={styles.formError} role="alert">
          {error}
        </p>
      )}
    </>
  );

  const footerBlock = (
    <footer
      className={
        inlineField ? styles.inlineFieldActions : styles.editorFooter
      }
    >
      {confirmingDiscard ? (
        // role=status/aria-live(not alertdialog — this is not a nested modal, just this footer's
        // content changing in place) announces the confirmation; the effect above moves focus to
        // 戻る and scrolls it into view since nothing here forces attention automatically.
        <div className={styles.discardConfirm} role="status" aria-live="assertive">
          <span>変更を破棄する？</span>
          <div className={styles.discardConfirmActions}>
            <button
              ref={discardBackButtonRef}
              type="button"
              className={styles.secondaryButton}
              onClick={() => {
                onKeepEditing?.();
                setConfirmingDiscard(false);
              }}
            >
              戻る
            </button>
            <button
              type="button"
              className={styles.dangerButton}
              onClick={() => {
                setConfirmingDiscard(false);
                onClose();
              }}
            >
              破棄
            </button>
          </div>
        </div>
      ) : (
        <>
          {dirty && <span className={styles.unsavedIndicator}>未保存</span>}
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
            disabled={saving || (inlineField && !dirty)}
            onClick={save}
          >
            {saving ? (
              <RefreshCw className={styles.spin} aria-hidden="true" />
            ) : (
              <Check aria-hidden="true" />
            )}
            保存
          </button>
        </>
      )}
    </footer>
  );

  if (inlineField) {
    return (
      <section
        ref={editorPanelRef}
        className={styles.inlineFieldEditor}
        data-testid="sx-plan-inline-field-editor"
        data-inline-field-editor="true"
        data-inline-field-keys={fieldKeys?.join(",")}
        aria-label={definition.title}
        aria-describedby={ariaDescribedBy}
        onFocusCapture={rememberFocusedField}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          event.preventDefault();
          event.stopPropagation();
          requestClose();
        }}
      >
        {fieldsBlock}
        {footerBlock}
      </section>
    );
  }

  if (embedded) {
    return (
      <section
        ref={editorPanelRef}
        className={styles.editorEmbedded}
        data-testid="sx-inline-editor"
        data-inline-editor-form="true"
        aria-label={definition.title}
        aria-describedby={ariaDescribedBy}
        onFocusCapture={rememberFocusedField}
      >
        <div className={styles.editorEmbeddedBody}>{fieldsBlock}</div>
        {footerBlock}
      </section>
    );
  }

  if (typeof document === "undefined") return null;

  // PlanInspectorと同じ二層構造でdocument.body直下へportalする。外層(presentation role)が
  // useModalContainmentの「dialog.parentElement = body直下のportal layer」という前提を満たす
  // 唯一の要素になり、内層(dialog role, ref=editorPanelRef)がフォーカス封じ込め対象になる。
  // inlineのdivのまま(portalしない)だと、dialog.parentElementがdashboard内のmainになり、
  // bodyの直接の子(AppShellのルート)がまるごとinert化されてモーダル自身も操作不能になる
  // （2026-08 監査追補）。
  return createPortal(
    <div
      className={styles.editorBackdrop}
      role="presentation"
      data-testid="sx-issue-editor-overlay"
      data-modal-layer="sx-issue-editor"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <section
        ref={editorPanelRef}
        tabIndex={-1}
        className={styles.editorPanel}
        data-editor-width={WIDE_EDITOR_KINDS.has(editor.kind) ? "wide" : undefined}
        role="dialog"
        onFocusCapture={rememberFocusedField}
        aria-modal="true"
        aria-label={definition.title}
        aria-describedby={ariaDescribedBy}
        data-editor-kind={editor.kind}
        data-editor-resource={definition.resource}
        data-editor-record-id={definition.id || ""}
      >
        <header className={styles.editorHeader}>
          <div className={styles.editorHeaderMeta}>
            <p className={styles.eyebrow}>{definition.eyebrow}</p>
            <h2>{definition.title}</h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className={styles.iconButton}
            onClick={requestClose}
            aria-label="閉じる"
          >
            <X aria-hidden="true" />
          </button>
        </header>
        <div className={styles.editorBody}>
          <div className={styles.editorContext}>
            {/* 対象の見出し行は、その値を表す本文fieldが実際にこのフォームへ見えている
                ときだけ出さない（editor.kindではなくactiveFieldsで判定 — 例えば
                edit_partnerはこの画面では常にfieldKeys制限つきで開き、"name" fieldを
                一度も表示しないため、editor.kind判定だけだと関係先名がどこにも出なく
                なる）。h2のtitle・本文のtitle fieldと同じ値を三重に出さないため
                （2026-08 モーダル統一監査）。 */}
            {"issue" in editor && !hasVisibleField("title") && (
              <>
                <span>対象論点</span>
                <strong>{editor.issue.title}</strong>
              </>
            )}
            {"hypothesis" in editor && !hasVisibleField("statement") && (
              <>
                <span>対象仮説</span>
                <strong>{editor.hypothesis?.statement}</strong>
              </>
            )}
            {"validation" in editor && !hasVisibleField("method") && (
              <>
                <span>対象検証</span>
                <strong>
                  {editor.validation.method ||
                    editor.validation.validationKind}
                </strong>
              </>
            )}
            {"decision" in editor && !hasVisibleField("title") && (
              <>
                <span>対象判断</span>
                <strong>{editor.decision.title}</strong>
              </>
            )}
            {"milestone" in editor && !hasVisibleField("title") && (
              <>
                <span>対象MS</span>
                <strong>{editor.milestone.title}</strong>
              </>
            )}
            {"successor" in editor && (
              <>
                <span>先へ進むMS</span>
                <strong>{editor.successor.title}</strong>
              </>
            )}
            {"task" in editor && !hasVisibleField("title") && (
              <>
                <span>対象タスク</span>
                <strong>{editor.task.title}</strong>
              </>
            )}
            {"partner" in editor && !hasVisibleField("name") && (
              <>
                <span>対象関係先</span>
                <strong>{editor.partner.name}</strong>
              </>
            )}
            {/* 保有事項/約束はタイトルだけでは同名項目と区別できないため、対象関係先名を
                静的表示する（2026-08 監査追補）。management.partnersから解決した現在値であって、
                保有事項/約束レコード自体には関係先名を持たせない。 */}
            {"workItem" in editor && (
              <>
                <span>対象関係先</span>
                <strong>
                  {management.partners.find(
                    (partner) => partner.id === editor.workItem.partnerId,
                  )?.name || "不明"}
                </strong>
              </>
            )}
            {"commitment" in editor && (
              <>
                <span>対象関係先</span>
                <strong>
                  {management.partners.find(
                    (partner) => partner.id === editor.partnerId,
                  )?.name || "不明"}
                </strong>
              </>
            )}
            {editor.kind === "create_task" && (
              <>
                <span>追加するレーン</span>
                <strong>
                  {editor.laneKey === "business_development"
                    ? "事業開発"
                    : editor.laneKey === "technology_development"
                      ? "技術開発"
                      : "組織開発"}
                </strong>
              </>
            )}
          </div>
          {fieldsBlock}
        </div>
        {footerBlock}
      </section>
    </div>,
    document.body,
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
              onClick={() => onEdit({ kind: "create_hypothesis", issue })}
            >
              <Plus aria-hidden="true" />
              仮説を追加
            </button>
          </div>
        )}
      </div>
      <p className={styles.issueType}>{issueKindLabel(issue.knowledgeType)}</p>
      <h3>
        {canManage ? (
          <button
            type="button"
            className="w-full border-b border-dashed border-[#857b69] text-left hover:border-[#38745d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38745d]"
            onClick={() => onEdit({ kind: "edit_issue", issue })}
            aria-label={`${issue.title}を直接修正`}
          >
            {issue.title}
          </button>
        ) : (
          issue.title
        )}
      </h3>
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
                  <button
                    type="button"
                    disabled={!canManage}
                    onClick={() =>
                      onEdit({ kind: "edit_hypothesis", issue, hypothesis })
                    }
                    className="min-w-0 flex-1 text-left disabled:cursor-default focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38745d]"
                    aria-label={`${hypothesis.statement}を直接修正`}
                  >
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
                  </button>
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
                    {canManage && decision.status === "decided" && (
                      <span className={styles.inlineActions}>
                        <button
                          type="button"
                          onClick={() =>
                            onEdit({ kind: "create_action", issue, decision })
                          }
                        >
                          次の行動
                        </button>
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={!canManage}
                    onClick={() =>
                      onEdit({ kind: "edit_decision", issue, decision })
                    }
                    className="block w-full border-b border-dashed border-[#857b69] text-left disabled:cursor-default focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38745d]"
                    aria-label={`${decision.title}を直接修正`}
                  >
                    <b>{decision.title}</b>
                    {decision.decisionText && (
                      <small>{decision.decisionText}</small>
                    )}
                  </button>
                </div>
              ))}
              {issue.actionItems.map((action) => {
                const decision = issue.decisions.find(
                  (candidate) => candidate.id === action.decisionId,
                );
                return (
                  <div className={styles.actionLine} key={action.id}>
                    <ArrowRight aria-hidden="true" />
                    <button
                      type="button"
                      disabled={!canManage || !decision}
                      onClick={() =>
                        decision &&
                        onEdit({
                          kind: "edit_action",
                          issue,
                          decision,
                          action,
                        })
                      }
                      className="min-w-0 flex-1 border-b border-dashed border-[#857b69] text-left disabled:cursor-default focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38745d]"
                      aria-label={`${action.title}を直接修正`}
                    >
                      <b>{action.title}</b>
                      <small>
                        {action.status === "completed"
                          ? "完了"
                          : action.ownerLabel || "担当未設定"}{" "}
                        · {formatDate(action.dueDate)} · 次回{" "}
                        {formatDate(action.nextReviewOn)}
                      </small>
                    </button>
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
  taskParentTitle,
  requirements,
  canManage,
  detailEditor,
  inlineEditorSlot,
  inlineEditor,
  deleteBlockedReason,
  deleting,
  onClose,
  onDeleteTask,
  onEditField,
}: {
  milestone: SxManagementMilestone | null;
  task: SxTask | null;
  taskParentTitle: string | null;
  requirements: SxGateRequirement[];
  canManage: boolean;
  detailEditor?: ReactNode;
  inlineEditorSlot?: string | null;
  inlineEditor?: ReactNode;
  deleteBlockedReason?: string | null;
  deleting?: boolean;
  onClose: () => void;
  onDeleteTask?: () => void;
  onEditField: (
    slot: string,
    editor: PlanFieldEditorState["editor"],
    fieldKeys: string[],
    targetLabel: string,
    fieldLabel: string,
  ) => void;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  // 削除は取り消しづらいので同じトレイ内で2段階に踏ませる。別モーダルは開かない。
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const item = task || milestone;
  const isTask = Boolean(task);
  const plannedStart = item?.plannedStart ?? null;
  const plannedEnd = item?.plannedEnd ?? null;
  // 未着手も進捗を登録した状態ではない。0% を実績として見せない。
  const currentStatus = isTask ? task?.status : milestone?.manualStatus;
  const progressRegistered =
    currentStatus !== "unassessed" && currentStatus !== "not_started";
  const description = task?.description || milestone?.gate || "未設定";
  const goal = task?.goal || milestone?.gate || "未設定";
  const blocker = task?.blocker || milestone?.maxIssue || "未設定";
  const nextDeliverable = task?.nextDeliverable || milestone?.nextDeliverable || "未設定";
  const criteria =
    task?.completionCriteria || milestone?.completionCriteria || "未設定";
  const metRequirements = requirements.filter(
    (requirement) => requirement.state === "met",
  ).length;
  const showRequirements = !isTask && requirements.length > 0;
  // Generic point-MS (not one of the 2 NewCo gates) edits as a single 予定日, not a 2-field range.
  const isGenericMs = !isTask && Boolean(milestone) && isGenericPointMilestone(milestone!);
  // Neutral landing spot (dialog itself, already tabIndex=-1) — the effect below moves focus to
  // the first editable value when the viewer can edit, instead of parking it on the close button.
  useModalContainment({
    dialogRef,
    initialFocusRef: dialogRef,
    onClose,
    active: Boolean(item),
  });

  useEffect(() => {
    if (!item || !canManage) return;
    const frame = window.requestAnimationFrame(() => {
      dialogRef.current
        ?.querySelector<HTMLElement>(`.${styles.inspectorEditable}`)
        ?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [item, canManage]);

  const itemId = item?.id ?? null;
  useEffect(() => {
    setConfirmingDelete(false);
  }, [itemId]);

  if (!item) return null;

  const itemEditor: PlanFieldEditorState["editor"] = task
    ? { kind: "edit_task", task }
    : { kind: "edit_milestone", milestone: milestone! };
  // One field can be edited at a time, in the exact position that was clicked. The detail dialog
  // remains the only dialog; there is no lower "edit tray" that visually reads as a second
  // modal or loses the connection to the original value.
  const editableValue = (
    slot: string,
    label: string,
    value: ReactNode,
    editor: PlanFieldEditorState["editor"],
    fieldKeys: string[],
    // Defaults to the open item's own title — only the prerequisite/dependency rows (a
    // different record than the item itself) pass an explicit override.
    targetLabel: string = item!.title,
  ) =>
    inlineEditorSlot === slot && inlineEditor ? (
      <span className={styles.inspectorInlineSlot} data-plan-inline-slot={slot}>
        {inlineEditor}
      </span>
    ) : canManage ? (
      <button
        type="button"
        className={styles.inspectorEditable}
        data-editing={inlineEditorSlot === slot || undefined}
        data-plan-edit-slot={slot}
        onClick={() => onEditField(slot, editor, fieldKeys, targetLabel, label)}
        aria-label={`${targetLabel}の${label}を直接修正`}
      >
        {value}
      </button>
    ) : (
      value
    );
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className={styles.planInspectorLayer}
      role="presentation"
      data-testid="sx-plan-inspector-overlay"
      data-modal-layer="sx-plan-detail"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside
        ref={dialogRef}
        tabIndex={-1}
        className={styles.planInspector}
        role="dialog"
        aria-modal="true"
        aria-label={`${item.title}の詳細`}
        data-detail-mode={
          detailEditor ? "create" : inlineEditorSlot ? "inline-edit" : "view"
        }
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <p>
              {isTask ? "タスク詳細" : "MS詳細"}
            </p>
            {detailEditor ? (
              <h3>{item.title}</h3>
            ) : inlineEditorSlot === "item-title" && inlineEditor ? (
              <div className={styles.inspectorTitleEditor} data-plan-inline-slot="item-title">
                {inlineEditor}
              </div>
            ) : (
              <h3>
                {editableValue("item-title", "名称", item.title, itemEditor, [
                  "title",
                ])}
              </h3>
            )}
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className={styles.planInspectorClose}
            onClick={onClose}
            aria-label="詳細を閉じる"
          >
            <X aria-hidden="true" />
          </button>
        </header>
        {/* 項目名はheader、表示レーンはbreadcrumbで分担する。hidden compatibility
            containerの名称は出さず、状態もfactsで一度だけ示す。 */}
        {!detailEditor && (
          <div className={styles.inspectorBreadcrumb}>
            <span>
              {task
                ? ganttLaneLabelForTrack(
                    task.track || milestone?.track || "organizational_building",
                  )
                : milestone
                  ? ganttLaneLabelForTrack(milestone.track)
                  : "タスク"}
            </span>
          </div>
        )}
        {detailEditor ? (
          <div className={styles.planInspectorInlineEditor} data-detail-body>
            {detailEditor}
          </div>
        ) : (
          <div className={styles.planInspectorBody} data-detail-body>
            <dl className={styles.inspectorFacts}>
              <div>
                <dt>担当</dt>
                <dd>
                  {editableValue(
                    "item-owner",
                    "担当",
                    item.ownerLabel || "担当未設定",
                    itemEditor,
                    ["owner_label"],
                  )}
                </dd>
              </div>
              <div>
                <dt>状態</dt>
                <dd>
                  {editableValue(
                    "item-status",
                    "状態",
                    isTask
                      ? ROW_PLAN_STATUS[task!.status]
                      : ROW_PLAN_STATUS[milestone!.manualStatus],
                    itemEditor,
                    ["status"],
                  )}
                </dd>
              </div>
              <div>
                <dt>{isGenericMs ? "予定日" : "計画"}</dt>
                <dd>
                  {isGenericMs
                    ? editableValue(
                        "item-period",
                        "予定日",
                        formatDate(plannedStart),
                        itemEditor,
                        ["planned_date"],
                      )
                    : editableValue(
                        "item-period",
                        "計画期間",
                        <>
                          {formatDate(plannedStart)} → {formatDate(plannedEnd)}
                        </>,
                        itemEditor,
                        ["planned_start", "planned_end"],
                      )}
                </dd>
              </div>
              <div>
                <dt>進捗</dt>
                <dd data-missing={!progressRegistered || undefined}>
                  {editableValue(
                    "item-progress",
                    "進捗",
                    progressRegistered ? `${item.progressPct}%` : "未登録",
                    itemEditor,
                    ["progress_pct"],
                  )}
                </dd>
              </div>
              <div>
                <dt>実績完了</dt>
                <dd>
                  {editableValue(
                    "item-actual-end",
                    "実績完了",
                    formatDate(item.actualEnd),
                    itemEditor,
                    ["actual_end"],
                  )}
                </dd>
              </div>
              {showRequirements && (
                <div>
                  <dt>設立前提</dt>
                  <dd>
                    {requirements.length > 0
                      ? `${metRequirements}/${requirements.length}件を充足`
                      : "未登録"}
                  </dd>
                </div>
              )}
            </dl>
            <div className={styles.inspectorContentGrid}>
              {isTask && (
                <section className={styles.inspectorSection}>
                  <span>タスク階層</span>
                  <div className={styles.inspectorSectionValue}>
                    <p>
                      {taskParentTitle
                        ? `「${taskParentTitle}」の子タスク`
                        : "最上位タスク"}
                    </p>
                    {canManage && (
                      <small>
                        ガント左のグリップを、親にしたいタスクへドラッグ
                      </small>
                    )}
                  </div>
                </section>
              )}
              <section className={styles.inspectorSection}>
                <span>{isTask ? "内容" : "到達点"}</span>
                <div className={styles.inspectorSectionValue}>
                  {editableValue(
                    "item-description",
                    isTask ? "内容" : "到達点",
                    description,
                    itemEditor,
                    [isTask ? "description" : "gate"],
                  )}
                </div>
              </section>
              <section className={styles.inspectorSection}>
                <span>{isTask ? "ゴール" : "次の成果物"}</span>
                <div className={styles.inspectorSectionValue}>
                  {editableValue(
                    "item-goal-or-next",
                    isTask ? "ゴール" : "次の成果物",
                    isTask ? goal : nextDeliverable,
                    itemEditor,
                    [isTask ? "goal" : "next_deliverable"],
                  )}
                </div>
              </section>
              <section className={styles.inspectorSection}>
                <span>詰まり</span>
                <div className={styles.inspectorSectionValue}>
                  {editableValue(
                    "item-blocker",
                    "詰まり",
                    blocker,
                    itemEditor,
                    [isTask ? "blocker" : "max_issue"],
                  )}
                </div>
              </section>
              {isTask && (
                <section className={styles.inspectorSection}>
                  <span>次の成果物</span>
                  <div className={styles.inspectorSectionValue}>
                    {editableValue(
                      "item-next-deliverable",
                      "次の成果物",
                      nextDeliverable,
                      itemEditor,
                      ["next_deliverable"],
                    )}
                  </div>
                </section>
              )}
              <section
                className={`${styles.inspectorSection} ${styles.inspectorWideSection}`}
              >
                <span>完了条件</span>
                <div className={styles.inspectorSectionValue}>
                  {editableValue(
                    "item-completion-criteria",
                    "完了条件",
                    criteria,
                    itemEditor,
                    ["completion_criteria"],
                  )}
                </div>
              </section>

              {!isTask && (
                <section
                  className={`${styles.inspectorSection} ${styles.inspectorWideSection}`}
                >
                  <span>完了証跡</span>
                  <div className={styles.inspectorSectionValue}>
                    {editableValue(
                      "item-completion-evidence",
                      "完了証跡",
                      milestone!.completionEvidence || "未登録",
                      itemEditor,
                      ["completion_evidence"],
                    )}
                  </div>
                </section>
              )}

              {showRequirements && (
                <section
                  className={`${styles.inspectorSection} ${styles.inspectorRequirements}`}
                >
                  <div className={styles.inspectorSectionHeading}>
                    <span>NewCo設立前にクリアする条件</span>
                    <strong>
                      {metRequirements}/{requirements.length}件
                    </strong>
                  </div>
                  <ul className="mt-2 divide-y divide-[#e4ddd0] border-y border-[#c5bba5]">
                    {requirements.map((requirement) => (
                      <li
                        key={requirement.dependency.id}
                        className="flex items-start gap-2 py-2 text-[11px]"
                      >
                        <span
                          className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center border ${requirement.state === "met" ? "border-[#74a690] bg-[#dcecdf] text-[#205f49]" : requirement.state === "unconfirmed" ? "border-[#bd9a52] bg-[#f7e8c8] text-[#765022]" : "border-[#ada18a] bg-white text-[#5a574c]"}`}
                        >
                          {requirement.state === "met" ? (
                            <Check className="h-3 w-3" aria-hidden="true" />
                          ) : (
                            "!"
                          )}
                        </span>
                        <div className={styles.requirementContent}>
                          <div className={styles.requirementTitle}>
                            {editableValue(
                              `requirement-${requirement.milestone.id}-gate`,
                              "前提の到達点",
                              requirement.milestone.gate ||
                                requirement.milestone.title,
                              {
                                kind: "edit_milestone",
                                milestone: requirement.milestone,
                              },
                              ["gate"],
                              requirement.milestone.title,
                            )}
                          </div>
                          <div className={styles.requirementFields}>
                            <div>
                              <span>状態</span>
                              {editableValue(
                                `requirement-${requirement.milestone.id}-status`,
                                "前提の状態",
                                ROW_PLAN_STATUS[
                                  requirement.milestone.manualStatus
                                ],
                                {
                                  kind: "edit_milestone",
                                  milestone: requirement.milestone,
                                },
                                ["status"],
                                requirement.milestone.title,
                              )}
                            </div>
                            <div>
                              <span>担当</span>
                              {editableValue(
                                `requirement-${requirement.milestone.id}-owner`,
                                "前提の担当",
                                requirement.milestone.ownerLabel ||
                                  "担当未確認",
                                {
                                  kind: "edit_milestone",
                                  milestone: requirement.milestone,
                                },
                                ["owner_label"],
                                requirement.milestone.title,
                              )}
                            </div>
                            <div>
                              <span>期限</span>
                              {editableValue(
                                `requirement-${requirement.milestone.id}-end`,
                                "前提の期限",
                                formatDate(requirement.milestone.plannedEnd),
                                {
                                  kind: "edit_milestone",
                                  milestone: requirement.milestone,
                                },
                                ["planned_end"],
                                requirement.milestone.title,
                              )}
                            </div>
                            <div>
                              <span>実績</span>
                              {editableValue(
                                `requirement-${requirement.milestone.id}-actual`,
                                "前提の実績完了",
                                formatDate(requirement.milestone.actualEnd),
                                {
                                  kind: "edit_milestone",
                                  milestone: requirement.milestone,
                                },
                                ["actual_end"],
                                requirement.milestone.title,
                              )}
                            </div>
                            <div>
                              <span>証跡</span>
                              {editableValue(
                                `requirement-${requirement.milestone.id}-evidence`,
                                "前提の完了証跡",
                                requirement.milestone.completionEvidence
                                  ? "登録済み"
                                  : "未登録",
                                {
                                  kind: "edit_milestone",
                                  milestone: requirement.milestone,
                                },
                                ["completion_evidence"],
                                requirement.milestone.title,
                              )}
                            </div>
                          </div>
                        </div>
                        <div className={styles.requirementDependency}>
                          <div>
                            <span>必須性</span>
                            {editableValue(
                              `dependency-${requirement.dependency.id}-required`,
                              "必須性",
                              requirement.dependency.required ? "必須" : "任意",
                              {
                                kind: "edit_dependency",
                                dependency: requirement.dependency,
                              },
                              ["required"],
                              requirement.milestone.title,
                            )}
                          </div>
                          <div>
                            <span>待ち</span>
                            {editableValue(
                              `dependency-${requirement.dependency.id}-lag`,
                              "待ち日数",
                              requirement.dependency.lagDays > 0
                                ? `${requirement.dependency.lagDays}日`
                                : "なし",
                              {
                                kind: "edit_dependency",
                                dependency: requirement.dependency,
                              },
                              ["lag_days"],
                              requirement.milestone.title,
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {isTask && canManage && onDeleteTask && (
                <div className={styles.inspectorDangerRow}>
                  {deleteBlockedReason ? (
                    <span data-tone="quiet">{deleteBlockedReason}</span>
                  ) : confirmingDelete ? (
                    <>
                      <span>削除すると、このタスクはガントと一覧から消えます。</span>
                      <button
                        type="button"
                        data-tone="confirm"
                        disabled={deleting}
                        onClick={onDeleteTask}
                      >
                        {deleting ? "削除中…" : "削除する"}
                      </button>
                      <button
                        type="button"
                        data-tone="quiet"
                        disabled={deleting}
                        onClick={() => setConfirmingDelete(false)}
                      >
                        やめる
                      </button>
                    </>
                  ) : (
                    <button type="button" onClick={() => setConfirmingDelete(true)}>
                      このタスクを削除
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </aside>
    </div>,
    document.body,
  );
}

const ROW_PLAN_STATUS: Record<SxManagementMilestone["manualStatus"], string> = {
  not_started: "未着手",
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
  // Only meaningful alongside editor.kind === "edit_partner" — restricts the generic 関係先編集
  // form down to the partner_next_action provenance's own fields (PARTNER_NEXT_ACTION_FIELD_KEYS).
  // null means "show every field" (the normal full-editor open path).
  const [editorFieldKeys, setEditorFieldKeys] = useState<
    readonly string[] | null
  >(null);
  const [detailEditor, setDetailEditor] = useState<EditorState | null>(null);
  const [planFieldEditor, setPlanFieldEditor] =
    useState<PlanFieldEditorState | null>(null);
  const [detailEditorDirty, setDetailEditorDirty] = useState(false);
  // Explicit contract from whichever IssueEditor is currently mounted inside PlanInspector
  // (detailEditor or the inline field editor — mutually exclusive) back to this parent, so
  // requestDetailClose can trigger that editor's own dirty-close confirmation directly instead
  // of a DOM query/click hack.
  const planEditorRequestCloseRef = useRef<(() => void) | null>(null);
  // An external action attempted while the shared tray is dirty. The existing tray changes its
  // own footer to the inline discard confirmation; after discard, this intent continues exactly
  // once (close detail / open another cell / add child). A normal tray Cancel never populates it.
  const pendingPlanIntentRef = useRef<(() => void) | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimerRef = useRef<number | null>(null);
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string | null>(
    null,
  );
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [workloadFilter, setWorkloadFilter] =
    useState<WorkloadBucketKey | null>(null);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);

  function showNotice(message: string) {
    setNotice(message);
    if (noticeTimerRef.current != null)
      window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => {
      setNotice(null);
      noticeTimerRef.current = null;
    }, 3500);
  }

  useEffect(
    () => () => {
      if (noticeTimerRef.current != null)
        window.clearTimeout(noticeTimerRef.current);
    },
    [],
  );

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
  // MS・タスク・論点・仮説・検証・判断・action・関係先保有事項を同じ未完了作業単位にした共通母集団。
  // PJ全体担当負荷（担当者別グループ）が既に同じ正規化をしているので、フラット化して使い回す。
  const allWorkUnits = useMemo(
    () => projectOwnerLoads.flatMap((load) => load.items),
    [projectOwnerLoads],
  );
  const workloadBuckets = useMemo(() => {
    const asOf = management.asOf;
    return {
      blocked: allWorkUnits.filter((item) => item.blocked),
      overdue: allWorkUnits.filter((item) =>
        sxProjectWorkUnitIsOverdue(item, asOf),
      ),
      due_soon: allWorkUnits.filter((item) =>
        sxProjectWorkUnitIsDueSoon(item, asOf),
      ),
      owner_unknown: allWorkUnits.filter(
        (item) => item.ownerLabel === "担当未確認",
      ),
      due_unset: allWorkUnits.filter(
        (item) => item.dueDate == null || item.dueDatePrecision === "unknown",
      ),
      decision: allWorkUnits.filter((item) => item.kind === "decision"),
    } satisfies Record<WorkloadBucketKey, SxProjectWorkUnit[]>;
  }, [allWorkUnits, management.asOf]);
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
  }, [
    management.dependencies,
    management.milestones,
    selectedPlanMilestone,
  ]);

  function handleSaved(next: SxManagementBundle, message: string) {
    setManagement(next);
    setEditor(null);
    setEditorFieldKeys(null);
    showNotice(message);
  }

  function handleDetailSaved(next: SxManagementBundle, message: string) {
    pendingPlanIntentRef.current = null;
    setManagement(next);
    setDetailEditorDirty(false);
    setDetailEditor(null);
    setPlanFieldEditor(null);
    showNotice(message);
  }

  // 保存/キャンセル/破棄完了のいずれでインライン編集trayが閉じても、次にfocusを失わない
  // 最寄りの固定要素（そのfieldを開いた元のcell、またはタスク追加ボタン）へ戻す
  // （2026-08 再監査是正: 閉じた後にfocusがdocument.bodyへ落ちない）。
  function focusPlanEditSlotAfterClose(slot: string) {
    window.requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>(`[data-plan-edit-slot="${slot}"]`)
        ?.focus();
    });
  }

  function focusSelectedPlanRowAfterClose() {
    window.requestAnimationFrame(() => {
      const key = selectedTaskId
        ? `task:${selectedTaskId}`
        : selectedMilestoneId
          ? `milestone:${selectedMilestoneId}`
          : null;
      if (key)
        document
          .querySelector<HTMLElement>(`[data-plan-row="${key}"] button`)
          ?.focus();
    });
  }

  function requestPlanIntent(intent: () => void) {
    if (detailEditorDirty) {
      // 破棄確認はwindow.confirmや第二のdialogを開かず、既に画面内に見えているinline/embedded
      // editorの「キャンセル」を押したのと同じ扱いにする — そのeditor自身のfooterが
      // 「変更を破棄する？ / 戻る / 破棄」へその場で差し替わる（IssueEditor.requestClose）。
      // DOM query/clickではなく、そのeditor自身がplanEditorRequestCloseRefへ登録した
      // requestCloseを直接呼ぶ（2026-08 監査追補: 明示的なref契約に置き換え）。
      pendingPlanIntentRef.current = intent;
      planEditorRequestCloseRef.current?.();
      return;
    }
    pendingPlanIntentRef.current = null;
    setDetailEditorDirty(false);
    setDetailEditor(null);
    setPlanFieldEditor(null);
    intent();
  }

  function finishPlanEditorClose(fallbackFocus: () => void) {
    const pendingIntent = pendingPlanIntentRef.current;
    pendingPlanIntentRef.current = null;
    setDetailEditorDirty(false);
    setDetailEditor(null);
    setPlanFieldEditor(null);
    if (pendingIntent) pendingIntent();
    else fallbackFocus();
  }

  // タスク削除はAPI側のsoft delete（deleted_at）を使う。楽観更新はせず、成功したbundleで置き換えて
  // 依存線や子タスクの見え方をサーバ側の判断に揃える。
  async function deleteTask(taskId: string) {
    setDeletingTaskId(taskId);
    try {
      const response = await fetch(
        `/api/project-workspace/${encodeURIComponent(bundle.project.projectId)}/management`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resource: "task", id: taskId, delete: true }),
        },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          typeof body.error === "string" ? body.error : "削除できなかったよ",
        );
      if (body.bundle) setManagement(body.bundle as SxManagementBundle);
      setSelectedTaskId(null);
      showNotice("タスクを削除したよ");
    } catch (caught) {
      showNotice(caught instanceof Error ? caught.message : "削除できなかったよ");
    } finally {
      setDeletingTaskId(null);
    }
  }

  function notifyWorkUnitNotFound() {
    setNotice("元の項目を見つけられなかったよ");
    window.setTimeout(() => setNotice(null), 3500);
  }

  // 共通母集団の1件から、必ず元の編集文脈へ移動する。MS/タスクはガント該当位置・詳細、
  // 論点系（論点・仮説・検証・判断・action）は該当カード/詳細、関係先はprovenance別の編集
  // モーダルを直接開く（スクロールしない）。開く前に他のplan/detail editorを閉じ、モーダルは
  // 常に1つだけにする。
  function navigateToWorkUnit(unit: SxProjectWorkUnit) {
    if (unit.kind === "partner") {
      // partner/record/originを先に検証し、有効な移動先が確定したときだけ既存のdrawer/plan/
      // editorを閉じる（2026-08 監査追補）。partner不在・work item/commitment不在・未知
      // origin・partner_next_actionのrecordId不一致は、他UIへ一切触れずnoticeだけ出す。
      const partner = unit.partnerId
        ? management.partners.find((item) => item.id === unit.partnerId)
        : undefined;
      if (!partner) {
        notifyWorkUnitNotFound();
        return;
      }
      let nextEditor: EditorState | null = null;
      let nextFieldKeys: readonly string[] | null = null;
      if (unit.originResource === "partner_work_item") {
        const workItem = partner.workItems.find(
          (item) => item.id === unit.recordId,
        );
        if (!workItem) {
          notifyWorkUnitNotFound();
          return;
        }
        nextEditor = { kind: "edit_partner_work_item", workItem };
      } else if (unit.originResource === "commitment") {
        const commitment = partner.commitments.find(
          (item) => item.id === unit.recordId,
        );
        if (!commitment) {
          notifyWorkUnitNotFound();
          return;
        }
        nextEditor = {
          kind: "edit_commitment",
          partnerId: partner.id,
          commitment,
        };
      } else if (unit.originResource === "partner_next_action") {
        if (unit.recordId !== partner.id) {
          notifyWorkUnitNotFound();
          return;
        }
        nextEditor = { kind: "edit_partner", partner };
        nextFieldKeys = PARTNER_NEXT_ACTION_FIELD_KEYS;
      } else {
        // provenance不一致・未確認originResourceは他のresourceへfall throughしない。
        notifyWorkUnitNotFound();
        return;
      }
      // ここまで来たら移動先は確定済み。関係先の編集モーダルはガント選択と独立しているが、
      // 選択が残ったままだとPlanInspectorとrootのeditorモーダルが同時に開く二重dialogになる
      // ため、開く前に必ずガント側の選択も含めて他UIを一括で解除する。
      setWorkloadFilter(null);
      setDetailEditor(null);
      setPlanFieldEditor(null);
      setSelectedMilestoneId(null);
      setSelectedTaskId(null);
      setEditorFieldKeys(nextFieldKeys);
      setEditor(nextEditor);
      return;
    }
    // MS/タスク/論点系のいずれも、対象レコードのID/存在をすべて検証し切ってからだけ
    // workloadFilter/detailEditor/planFieldEditor/editorFieldKeys/selectedMilestoneId/
    // selectedTaskIdの既存overlay stateを一括で解除する（partner分岐と同じ「解決してから
    // 閉じる」パターン）。無効IDのクリックでnotifyWorkUnitNotFound()だけを出すつもりが、
    // 既に開いていた詳細/editorを巻き添えで閉じてしまう事故を防ぐ（2026-08 監査追補）。
    if (unit.navTaskId) {
      const task = management.tasks.find((item) => item.id === unit.navTaskId);
      if (!task) {
        notifyWorkUnitNotFound();
        return;
      }
      setWorkloadFilter(null);
      setDetailEditor(null);
      setPlanFieldEditor(null);
      setEditorFieldKeys(null);
      setSelectedMilestoneId(null);
      setSelectedTaskId(task.id);
      document
        .getElementById("project-gantt")
        ?.scrollIntoView({ block: "start", behavior: "smooth" });
      return;
    }
    if (unit.navMilestoneId) {
      const milestone = management.milestones.find(
        (item) => item.id === unit.navMilestoneId,
      );
      if (!milestone) {
        notifyWorkUnitNotFound();
        return;
      }
      setWorkloadFilter(null);
      setDetailEditor(null);
      setPlanFieldEditor(null);
      setEditorFieldKeys(null);
      setSelectedTaskId(null);
      setSelectedMilestoneId(milestone.id);
      document
        .getElementById("project-gantt")
        ?.scrollIntoView({ block: "start", behavior: "smooth" });
      return;
    }
    if (unit.navIssueId) {
      // 論点系（論点・仮説・検証・判断・action）はroot editorモーダルという1段上の重畳面を
      // 開くだけで、背景のページ自体は動かさない。以前はここで#issue-hypothesisへ
      // scrollIntoViewしていたが、モーダルが全画面backdropで覆う以上スクロールする理由が
      // なく、担当負荷から開いたときだけ画面が意図せず流れるバグになっていた（2026-08
      // 監査追補）。IDが一致する子レコードを見つけられない場合は、他kindのprovenance監査と
      // 同じくnoticeだけを出し、親論点編集へ黙ってフォールバックしない（要求と異なる編集
      // 画面を誤って開かない）。kind==="issue"自体もunit.id===issue.idを必須にし、
      // navIssueId一致だけで別issueへ取り違えない。
      const issue = management.issues.find(
        (item) => item.id === unit.navIssueId,
      );
      if (!issue) {
        notifyWorkUnitNotFound();
        return;
      }
      let nextEditor: EditorState;
      if (unit.kind === "hypothesis") {
        const hypothesis = issue.hypotheses.find(
          (item) => item.id === unit.id,
        );
        if (!hypothesis) {
          notifyWorkUnitNotFound();
          return;
        }
        nextEditor = { kind: "edit_hypothesis", issue, hypothesis };
      } else if (unit.kind === "validation") {
        const validation = issue.validationRuns.find(
          (item) => item.id === unit.id,
        );
        const hypothesis = validation
          ? issue.hypotheses.find((item) => item.id === validation.hypothesisId)
          : undefined;
        if (!validation || !hypothesis) {
          notifyWorkUnitNotFound();
          return;
        }
        nextEditor = { kind: "edit_validation", issue, hypothesis, validation };
      } else if (unit.kind === "decision") {
        const decision = issue.decisions.find((item) => item.id === unit.id);
        if (!decision) {
          notifyWorkUnitNotFound();
          return;
        }
        nextEditor = { kind: "edit_decision", issue, decision };
      } else if (unit.kind === "action") {
        const decision = issue.decisions.find((item) =>
          item.actionItems.some((action) => action.id === unit.id),
        );
        const action = decision?.actionItems.find(
          (item) => item.id === unit.id,
        );
        if (!decision || !action) {
          notifyWorkUnitNotFound();
          return;
        }
        nextEditor = { kind: "edit_action", issue, decision, action };
      } else if (unit.kind === "issue") {
        if (unit.id !== issue.id) {
          notifyWorkUnitNotFound();
          return;
        }
        nextEditor = { kind: "edit_issue", issue };
      } else {
        notifyWorkUnitNotFound();
        return;
      }
      setWorkloadFilter(null);
      setDetailEditor(null);
      setPlanFieldEditor(null);
      setEditorFieldKeys(null);
      setSelectedMilestoneId(null);
      setSelectedTaskId(null);
      setEditor(nextEditor);
      return;
    }
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
              <h1>SolvioraX PJワークスペース</h1>
            </div>
            <div className={styles.readinessStamp}>
              <span>画面</span>
              <strong>運用準備中</strong>
              <small>情報抽出は次の作業</small>
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

        <section
          className={styles.workloadBand}
          aria-label="PJ全体の管制状態（MS・タスク・論点・仮説・検証・判断・action・関係先保有事項の共通母集団）"
        >
          {WORKLOAD_BUCKETS.map((bucket) => {
            const items = workloadBuckets[bucket.key];
            const active = workloadFilter === bucket.key;
            return (
              <button
                type="button"
                key={bucket.key}
                data-alert={items.length > 0 || undefined}
                data-active={active || undefined}
                aria-pressed={active}
                onClick={() =>
                  setWorkloadFilter((current) =>
                    current === bucket.key ? null : bucket.key,
                  )
                }
              >
                <span>{bucket.label}</span>
                <strong>{items.length}</strong>
                <small>{bucket.hint}</small>
              </button>
            );
          })}
        </section>
        {workloadFilter && (
          <section
            className={styles.workloadDrawer}
            aria-label={`${WORKLOAD_BUCKETS.find((bucket) => bucket.key === workloadFilter)?.label}の一覧`}
          >
            <header>
              <h3>
                {
                  WORKLOAD_BUCKETS.find(
                    (bucket) => bucket.key === workloadFilter,
                  )?.label
                }{" "}
                {workloadBuckets[workloadFilter].length}件
              </h3>
              <button type="button" onClick={() => setWorkloadFilter(null)}>
                閉じる
              </button>
            </header>
            {workloadBuckets[workloadFilter].length === 0 ? (
              <p className={styles.workloadEmpty}>該当する項目はないよ</p>
            ) : (
              <ul className={styles.workloadList}>
                {workloadBuckets[workloadFilter].map((item) => (
                  <li key={`${item.kind}:${item.id}`}>
                    <button
                      type="button"
                      onClick={() => navigateToWorkUnit(item)}
                      aria-label={`${item.title}の元項目へ移動`}
                    >
                      <span>{item.kindLabel}</span>
                      <b>{item.title}</b>
                      <span>{item.ownerLabel}</span>
                      <span>
                        {item.dueDate ? formatDate(item.dueDate) : "期限未設定"}
                      </span>
                      <span>
                        {item.impactedGates.length > 0
                          ? `影響：${item.impactedGates.join(" / ")}`
                          : "影響MS 未接続"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <SxProjectOwnerWorkload
          loads={projectOwnerLoads}
          onSelectItem={navigateToWorkUnit}
        />

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
                タスクは階層を開閉できる。バー・MS・名称を押すとガント上に詳細が開く
              </p>
            </div>
            <p>基準日 {formatDate(management.asOf)}</p>
          </div>
          <div className={styles.ganttWorkspace}>
            <div className={styles.ganttFrame}>
              <SxUnifiedTimeline
                timeline={timeline}
                asOf={management.asOf}
                projectId={bundle.project.projectId}
                milestones={management.milestones}
                dependencies={management.dependencies}
                scheduleDependencies={management.scheduleDependencies}
                tasks={management.tasks}
                outcomes={management.outcomes}
                objectiveId={management.objective?.id ?? null}
                onManagementChange={(next, message) => {
                  setManagement(next);
                  setNotice(message);
                  window.setTimeout(() => setNotice(null), 3500);
                }}
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
                onCreateMilestone={(prefill) =>
                  setEditor({
                    kind: "create_milestone",
                    track: prefill.track,
                    laneKey: prefill.laneKey ?? null,
                    timelineKind: prefill.timelineKind,
                    plannedDate: prefill.plannedDate ?? null,
                    outcomeId: prefill.outcomeId ?? null,
                  })
                }
                onCreateTask={(laneKey) =>
                  setEditor({ kind: "create_task", laneKey })
                }
                showPins={false}
              />
            </div>
            <PlanInspector
              milestone={selectedPlanMilestone}
              task={selectedTask}
              taskParentTitle={
                selectedTask?.parentTaskId
                  ? management.tasks.find(
                      (candidate) => candidate.id === selectedTask.parentTaskId,
                    )?.title || null
                  : null
              }
              requirements={selectedRequirements}
              canManage={management.canManage}
              detailEditor={
                detailEditor && selectedPlanMilestone ? (
                  <IssueEditor
                    key={`${detailEditor.kind}-${"milestone" in detailEditor ? detailEditor.milestone.id : ""}-${"task" in detailEditor ? detailEditor.task.id : ""}-${"laneKey" in detailEditor ? detailEditor.laneKey : ""}`}
                    editor={detailEditor}
                    management={management}
                    access={access}
                    projectId={bundle.project.projectId}
                    embedded
                    requestCloseRef={planEditorRequestCloseRef}
                    onKeepEditing={() => { pendingPlanIntentRef.current = null; }}
                    onDirtyChange={setDetailEditorDirty}
                    onClose={() => {
                      finishPlanEditorClose(focusSelectedPlanRowAfterClose);
                    }}
                    onSaved={(next, message) => {
                      handleDetailSaved(next, message);
                      focusSelectedPlanRowAfterClose();
                    }}
                    onReconciled={setManagement}
                    onSyncFailed={showNotice}
                  />
                ) : null
              }
              inlineEditorSlot={planFieldEditor?.slot}
              inlineEditor={
                planFieldEditor ? (
                  <IssueEditor
                    key={`${planFieldEditor.slot}-${planFieldEditor.editor.kind}-${planFieldEditor.fieldKeys.join("-")}`}
                    editor={planFieldEditor.editor}
                    management={management}
                    access={access}
                    projectId={bundle.project.projectId}
                    inlineField
                    fieldKeys={planFieldEditor.fieldKeys}
                    requestCloseRef={planEditorRequestCloseRef}
                    onKeepEditing={() => { pendingPlanIntentRef.current = null; }}
                    onDirtyChange={setDetailEditorDirty}
                    onClose={() => {
                      finishPlanEditorClose(() => focusPlanEditSlotAfterClose(planFieldEditor.slot));
                    }}
                    onSaved={(next, message) => {
                      focusPlanEditSlotAfterClose(planFieldEditor.slot);
                      handleDetailSaved(next, message);
                    }}
                    onReconciled={setManagement}
                    onSyncFailed={showNotice}
                  />
                ) : null
              }
              deleteBlockedReason={
                selectedTask &&
                management.tasks.some(
                  (candidate) => candidate.parentTaskId === selectedTask.id,
                )
                  ? "子タスクがあるから削除できないよ。先に子タスクを移すか削除してね"
                  : null
              }
              deleting={
                Boolean(selectedTask) && deletingTaskId === selectedTask!.id
              }
              onDeleteTask={
                selectedTask
                  ? () => {
                      const taskId = selectedTask.id;
                      requestPlanIntent(() => {
                        void deleteTask(taskId);
                      });
                    }
                  : undefined
              }
              onClose={() => {
                requestPlanIntent(() => {
                  setSelectedMilestoneId(null);
                  setSelectedTaskId(null);
                });
              }}
              onEditField={(slot, nextEditor, fieldKeys, targetLabel, fieldLabel) => {
                requestPlanIntent(() => {
                  // detailEditor/planFieldEditorは常に排他 — 片方を開く前にもう片方を確実に閉じる
                  // （どちらも同じplanEditorRequestCloseRefを1つだけ登録する前提を保つ）。
                  setDetailEditor(null);
                  setPlanFieldEditor({
                    slot,
                    editor: nextEditor,
                    fieldKeys,
                    targetLabel,
                    fieldLabel,
                  });
                });
              }}
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
              projectId={bundle.project.projectId}
              onManagementChange={setManagement}
              onSyncNotice={showNotice}
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
          key={`${editor.kind}-${"issue" in editor ? editor.issue.id : "new"}-${"hypothesis" in editor ? editor.hypothesis?.id || "" : ""}-${"decision" in editor ? editor.decision.id : ""}-${"action" in editor ? editor.action.id : ""}-${"milestone" in editor ? editor.milestone.id : ""}-${"task" in editor ? editor.task.id : ""}-${"laneKey" in editor ? editor.laneKey : ""}-${"workItem" in editor ? editor.workItem.id : ""}-${"commitment" in editor ? editor.commitment.id : ""}-${"partner" in editor ? editor.partner.id : ""}-${editorFieldKeys?.join(",") || ""}`}
          editor={editor}
          management={management}
          access={access}
          projectId={bundle.project.projectId}
          onClose={() => {
            setEditor(null);
            setEditorFieldKeys(null);
          }}
          onSaved={handleSaved}
          onReconciled={setManagement}
          onSyncFailed={showNotice}
          fieldKeys={editorFieldKeys ?? undefined}
        />
      )}
    </main>
  );
}
