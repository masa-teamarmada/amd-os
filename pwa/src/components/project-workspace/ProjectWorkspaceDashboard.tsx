"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, CalendarClock, CheckCircle2, Database, Pencil, ShieldCheck, UsersRound } from "lucide-react";
import type { ProjectWorkspaceBundle } from "@/lib/project-workspace";
import type { SharedWorkspaceAccess } from "@/lib/project-shared-workspace-access";
import type {
  SxManagementBundle,
  SxObjective,
  SxOutcome,
  SxManagementDecision,
  SxManagementIssue,
  SxHypothesis,
  SxEvidence,
  SxValidationRun,
  SxManagementMilestone,
  SxManagementPartner,
  SxActionItem,
  SxFundingSnapshot,
  SxKpi,
  SxOrganizationRole,
  SxRaci,
  SxCapacity,
  SxPartnerCommitment,
  SxPartnerInteraction,
  SxPartnerRole,
  SxPartnerWorkItem,
  SxTechnicalTest,
  SxDependency,
  SxTrackKey,
} from "@/lib/sx-management";
import { EFFORT_CATEGORIES, type EffortCategory } from "@/lib/project-workspace-types";
import { EffortEntryForm } from "./EffortEntryForm";
import { SxExecutiveControlDeck } from "./SxExecutiveControlDeck";
import { SxDevelopmentThemeBoard } from "./SxDevelopmentThemeBoard";
import { SxProofOutcomes } from "./SxProofOutcomes";
import { SxPartnerPipeline } from "./SxPartnerPipeline";
import { sxPartnerDisplay, sxPartnerName } from "./sx-visual-shared";
import { nominalizeSxActionLabel } from "@/lib/sx-action-label";
import { sxNormalizePublicName } from "@/lib/sx-name-normalize";

type ManagementResource = "objective" | "outcome" | "milestone" | "issue" | "hypothesis" | "evidence" | "validation" | "partner" | "decision" | "action" | "commitment" | "interaction" | "partner_role" | "partner_work_item" | "dependency" | "kpi" | "technical_test" | "funding_snapshot" | "organization_role" | "raci" | "capacity";

const CATEGORY_STYLE: Record<EffortCategory, { background: string; color: string }> = {
  basic: { background: "#315f7d", color: "#ffffff" },
  applied: { background: "#5f879e", color: "#ffffff" },
  development: { background: "#38745d", color: "#ffffff" },
  su: { background: "#bf7b2c", color: "#ffffff" },
  coordination: { background: "#76637b", color: "#ffffff" },
};

const SOURCE_LABELS: Record<string, string> = {
  member_weekly: "週次抽出",
  gmail: "メール",
  calendar: "カレンダー",
  gmeet: "Meet",
  slack: "Slack",
  notion: "Notion",
  meeting_summary: "会議記録",
  drive: "Drive",
  inferred: "既存情報から推定",
  manual: "手入力",
  current_truth: "現在の基準情報",
  imported: "取り込み情報",
  system: "システム確認",
  "PWA共有管理画面": "共有画面から更新",
};

const TRACK_LABELS: Record<SxTrackKey, string> = {
  business_development: "事業開発",
  technology_development: "技術開発",
  funding: "資金調達",
  organizational_building: "体制構築",
};

const PARTNER_STAGE_LABELS: Record<string, string> = {
  candidate: "候補",
  information_exchange: "情報交換",
  condition_alignment: "条件整理",
  meeting_coordination: "面談調整",
  validation_preparation: "検証準備",
  agreement_confirmation: "合意確認",
  executing: "実行中",
  on_hold: "保留",
};

const BALL_SIDE_LABELS: Record<string, string> = { sx: "SX側", partner: "相手側", shared: "双方", none: "該当なし", unknown: "未確認" };
const ACTOR_SIDE_LABELS: Record<string, string> = { sx: "当方（SX）", partner: "先方", shared: "双方", unknown: "未確認" };
const DATE_PRECISION_LABELS: Record<string, string> = { day: "日単位", month: "月単位（日付未確認）", unknown: "未確認" };
const INTERACTION_KIND_LABELS: Record<string, string> = { meeting: "面談", email: "メール", agreement: "合意", deliverable: "成果物", handoff: "引き継ぎ", status_update: "状況更新", note: "メモ" };
const ROLE_KIND_LABELS: Record<string, string> = { joint_development: "共同開発", contract_manufacturing: "製造委託", customer: "顧客", shareholder_investor: "株主・投資", government: "自治体", media: "メディア", financial_institution: "金融機関", university_research: "大学・研究機関", support_organization: "支援機関", other: "その他", unclassified: "未分類" };
const RELATIONSHIP_STATE_LABELS: Record<string, string> = { candidate: "候補", in_progress: "進行中", established: "成立", on_hold: "保留", ended: "終了", unconfirmed: "未確認" };
const WORK_ITEM_KIND_LABELS: Record<string, string> = { task: "タスク", question: "質問", deliverable: "成果物", decision: "意思決定", approval: "承認", response: "回答" };
const WORK_ITEM_STATUS_LABELS: Record<string, string> = { open: "未着手", in_progress: "進行中", waiting: "待ち", blocked: "停止", on_hold: "保留", completed: "完了", cancelled: "取消" };

const ISSUE_KIND_LABELS: Record<string, string> = {
  fact: "事実",
  hypothesis: "仮説",
  decision_needed: "意思決定待ち",
  decision: "旧分類",
};

const STATUS_TONE: Record<string, string> = {
  on_track: "border-[#9fc6b4] bg-[#e8f2eb] text-[#205f49]",
  attention: "border-[#e3c994] bg-[#fbf1dc] text-[#765022]",
  at_risk: "border-[#e3c994] bg-[#fbf1dc] text-[#765022]",
  blocked: "border-[#e4a39b] bg-[#f9e4e1] text-[#8c3329]",
  completed: "border-[#b7c8d2] bg-[#eef3f5] text-[#315f7d]",
  unassessed: "border-[#b8b5c8] bg-[#eeedf4] text-[#55506d]",
  not_started: "border-[#d6cebf] bg-[#f8f5ec] text-[#69665d]",
};

const RESOURCE_LABELS: Record<ManagementResource, string> = {
  objective: "経営目的",
  outcome: "柱の成果目標",
  milestone: "マイルストーン",
  issue: "論点・仮説",
  hypothesis: "仮説",
  evidence: "根拠・反証",
  validation: "検証",
  partner: "関係先",
  decision: "今週決めること",
  kpi: "KPI・先行指標",
  action: "アクション",
  commitment: "関係先の約束",
  interaction: "やり取り履歴",
  partner_role: "関係先の分類",
  partner_work_item: "保有事項",
  dependency: "依存関係",
  technical_test: "技術試験",
  funding_snapshot: "資金スナップショット",
  organization_role: "必須役割",
  raci: "RACI責任",
  capacity: "人員容量",
};

const EDIT_FIELDS: Record<ManagementResource, Array<{
  key: string;
  label: string;
  type?: "text" | "date" | "number" | "textarea" | "select";
  min?: number;
  max?: number;
  step?: number;
  options?: Array<{ value: string; label: string }>;
}>> = {
  objective: [
    { key: "title", label: "経営目的", type: "text" }, { key: "definition_of_done", label: "完了条件", type: "textarea" }, { key: "target_date", label: "設立目標日", type: "date" }, { key: "date_certainty", label: "日付の確度", type: "select", options: [{ value: "provisional", label: "仮置き" }, { value: "confirmed", label: "確定" }] }, { key: "status", label: "状態", type: "select", options: [{ value: "unassessed", label: "未評価" }, { value: "active", label: "進行中" }, { value: "completed", label: "完了" }, { value: "on_hold", label: "保留" }] }, { key: "confidence", label: "確度", type: "select", options: [{ value: "high", label: "高" }, { value: "medium", label: "中" }, { value: "low", label: "低" }, { value: "unknown", label: "未確認" }] },
  ],
  outcome: [
    { key: "title", label: "成果目標", type: "text" }, { key: "definition_of_done", label: "完了条件", type: "textarea" }, { key: "owner_label", label: "担当", type: "text" }, { key: "status", label: "状態", type: "select", options: [{ value: "unassessed", label: "未評価" }, { value: "active", label: "進行中" }, { value: "completed", label: "完了" }, { value: "on_hold", label: "保留" }] }, { key: "confidence", label: "確度", type: "select", options: [{ value: "high", label: "高" }, { value: "medium", label: "中" }, { value: "low", label: "低" }, { value: "unknown", label: "未確認" }] },
  ],
  milestone: [
    { key: "status", label: "状態", type: "select", options: [
      { value: "not_started", label: "未着手" }, { value: "unassessed", label: "未評価" }, { value: "on_track", label: "順調" }, { value: "attention", label: "注意" },
      { value: "at_risk", label: "遅れ懸念" }, { value: "blocked", label: "停止" }, { value: "completed", label: "完了" },
    ] },
    { key: "planned_end", label: "予定日", type: "date" },
    { key: "forecast_end", label: "予測日", type: "date" },
    { key: "date_certainty", label: "日付の確度", type: "select", options: [{ value: "provisional", label: "仮置き" }, { value: "confirmed", label: "確定" }] },
    { key: "progress_pct", label: "進捗", type: "number", min: 0, max: 100, step: 1 },
    { key: "owner_label", label: "担当", type: "text" },
    { key: "next_deliverable", label: "次の成果", type: "textarea" },
    { key: "max_issue", label: "最大論点", type: "textarea" },
    { key: "completion_criteria", label: "完了条件", type: "textarea" },
    { key: "completion_evidence", label: "完了証跡", type: "textarea" },
    { key: "criticality", label: "重要度", type: "select", options: [{ value: "critical", label: "最重要" }, { value: "high", label: "高" }, { value: "medium", label: "中" }, { value: "low", label: "低" }] },
    { key: "forecast_change_reason", label: "予測変更理由", type: "textarea" },
    { key: "confidence", label: "確度", type: "select", options: [{ value: "high", label: "高" }, { value: "medium", label: "中" }, { value: "low", label: "低" }, { value: "unknown", label: "未確認" }] },
  ],
  issue: [
    { key: "title", label: "論点", type: "text" },
    { key: "knowledge_type", label: "分類", type: "select", options: [{ value: "fact", label: "事実" }, { value: "hypothesis", label: "仮説" }, { value: "decision_needed", label: "意思決定待ち" }] },
    { key: "status", label: "状態", type: "select", options: [{ value: "open", label: "未着手" }, { value: "validating", label: "検証中" }, { value: "closed", label: "完了" }, { value: "on_hold", label: "保留" }] },
    { key: "owner_label", label: "担当", type: "text" },
    { key: "due_date", label: "期限", type: "date" },
    { key: "confidence", label: "確度", type: "select", options: [{ value: "high", label: "高" }, { value: "medium", label: "中" }, { value: "low", label: "低" }, { value: "unknown", label: "未確認" }] },
  ],
  hypothesis: [
    { key: "statement", label: "仮説", type: "textarea" }, { key: "status", label: "状態", type: "select", options: [{ value: "open", label: "未着手" }, { value: "validating", label: "検証中" }, { value: "validated", label: "検証済み" }, { value: "rejected", label: "反証" }, { value: "decided", label: "判断済み" }, { value: "on_hold", label: "保留" }] }, { key: "owner_label", label: "担当", type: "text" }, { key: "due_date", label: "期限", type: "date" }, { key: "confidence", label: "確度", type: "select", options: [{ value: "high", label: "高" }, { value: "medium", label: "中" }, { value: "low", label: "低" }, { value: "unknown", label: "未確認" }] },
  ],
  evidence: [
    { key: "evidence_kind", label: "根拠の種類", type: "select", options: [{ value: "supporting", label: "支持" }, { value: "counter", label: "反証" }, { value: "missing", label: "不足" }, { value: "observation", label: "観測" }] }, { key: "summary", label: "要約", type: "textarea" }, { key: "observed_on", label: "確認日", type: "date" }, { key: "source_label", label: "確認元", type: "text" }, { key: "confidence", label: "確度", type: "select", options: [{ value: "high", label: "高" }, { value: "medium", label: "中" }, { value: "low", label: "低" }, { value: "unknown", label: "未確認" }] },
  ],
  validation: [
    { key: "validation_kind", label: "検証の種類", type: "text" }, { key: "planned_on", label: "予定日", type: "date" }, { key: "due_date", label: "期限", type: "date" }, { key: "completed_on", label: "完了日", type: "date" }, { key: "status", label: "状態", type: "select", options: [{ value: "planned", label: "計画" }, { value: "running", label: "実施中" }, { value: "completed", label: "完了" }, { value: "blocked", label: "停止" }, { value: "cancelled", label: "取消" }] }, { key: "owner_label", label: "担当", type: "text" }, { key: "method", label: "方法", type: "textarea" }, { key: "result_summary", label: "結果", type: "textarea" }, { key: "confidence", label: "確度", type: "select", options: [{ value: "high", label: "高" }, { value: "medium", label: "中" }, { value: "low", label: "低" }, { value: "unknown", label: "未確認" }] },
  ],
  partner: [
    { key: "name", label: "機関名", type: "text" },
    { key: "role_label", label: "役割", type: "text" },
    { key: "relationship_stage", label: "進捗段階", type: "select", options: Object.entries(PARTNER_STAGE_LABELS).map(([value, label]) => ({ value, label })) },
    { key: "agreement_state", label: "合意状態", type: "select", options: [{ value: "agreed", label: "合意済み" }, { value: "partial", label: "一部合意" }, { value: "unagreed", label: "未合意" }] },
    { key: "agreed_scope", label: "合意済みの範囲", type: "textarea" },
    { key: "unagreed_scope", label: "未合意の範囲", type: "textarea" },
    { key: "last_contact_date", label: "最終接点", type: "date" },
    { key: "next_commitment", label: "SX側の次アクション", type: "textarea" },
    { key: "due_date", label: "期限", type: "date" },
    { key: "due_date_precision", label: "期限の確度", type: "select", options: Object.entries(DATE_PRECISION_LABELS).map(([value, label]) => ({ value, label })) },
    { key: "owner_label", label: "担当", type: "text" },
    { key: "current_ball_side", label: "現在ボール（側）", type: "select", options: Object.entries(BALL_SIDE_LABELS).map(([value, label]) => ({ value, label })) },
    { key: "current_ball_owner", label: "現在ボール（担当）", type: "text" },
    { key: "target_state", label: "目標状態", type: "textarea" },
    { key: "confidence", label: "確度", type: "select", options: [{ value: "high", label: "高" }, { value: "medium", label: "中" }, { value: "low", label: "低" }, { value: "unknown", label: "未確認" }] },
  ],
  interaction: [
    { key: "interaction_kind", label: "種別", type: "select", options: Object.entries(INTERACTION_KIND_LABELS).map(([value, label]) => ({ value, label })) },
    { key: "occurred_on", label: "発生日", type: "date" },
    { key: "occurred_on_precision", label: "発生日の確度", type: "select", options: Object.entries(DATE_PRECISION_LABELS).map(([value, label]) => ({ value, label })) },
    { key: "summary", label: "内容", type: "textarea" },
    { key: "outcome_summary", label: "結果・要点", type: "textarea" },
    { key: "ball_side_after", label: "以後のボール（側）", type: "select", options: Object.entries(BALL_SIDE_LABELS).map(([value, label]) => ({ value, label })) },
    { key: "ball_owner_after", label: "以後のボール（担当）", type: "text" },
    { key: "actor_side", label: "行為主体（側）", type: "select", options: Object.entries(ACTOR_SIDE_LABELS).map(([value, label]) => ({ value, label })) },
    { key: "actor_label", label: "行為主体（実名）", type: "text" },
    { key: "confidence", label: "確度", type: "select", options: [{ value: "high", label: "高" }, { value: "medium", label: "中" }, { value: "low", label: "低" }, { value: "unknown", label: "未確認" }] },
  ],
  partner_role: [
    { key: "role_kind", label: "分類", type: "select", options: Object.entries(ROLE_KIND_LABELS).map(([value, label]) => ({ value, label })) },
    { key: "relationship_state", label: "関係状態", type: "select", options: Object.entries(RELATIONSHIP_STATE_LABELS).map(([value, label]) => ({ value, label })) },
    { key: "role_label", label: "補足ラベル（任意）", type: "text" },
    { key: "is_primary", label: "主分類", type: "select", options: [{ value: "true", label: "主分類" }, { value: "false", label: "副分類" }] },
    { key: "sort_order", label: "表示順", type: "number", min: 0, step: 1 },
  ],
  partner_work_item: [
    { key: "side", label: "保有側", type: "select", options: Object.entries(ACTOR_SIDE_LABELS).map(([value, label]) => ({ value, label })) },
    { key: "item_kind", label: "種別", type: "select", options: Object.entries(WORK_ITEM_KIND_LABELS).map(([value, label]) => ({ value, label })) },
    { key: "title", label: "タイトル", type: "text" },
    { key: "detail", label: "詳細（任意）", type: "textarea" },
    { key: "owner_label", label: "担当（任意）", type: "text" },
    { key: "status", label: "状態", type: "select", options: Object.entries(WORK_ITEM_STATUS_LABELS).map(([value, label]) => ({ value, label })) },
    { key: "due_date", label: "期限", type: "date" },
    { key: "due_date_precision", label: "期限の確度", type: "select", options: Object.entries(DATE_PRECISION_LABELS).map(([value, label]) => ({ value, label })) },
    { key: "completion_criteria", label: "完了条件（完了にする前提として必須）", type: "textarea" },
    { key: "completed_on", label: "完了日（完了にする前提として必須）", type: "date" },
    { key: "completion_evidence", label: "完了証跡（完了にする前提として必須）", type: "textarea" },
    { key: "accepted_by", label: "受入担当（成果物の完了に必須）", type: "text" },
    { key: "accepted_on", label: "受入日（成果物の完了に必須）", type: "date" },
    { key: "confidence", label: "確度", type: "select", options: [{ value: "high", label: "高" }, { value: "medium", label: "中" }, { value: "low", label: "低" }, { value: "unknown", label: "未確認" }] },
  ],
  decision: [
    { key: "title", label: "決めること", type: "text" },
    { key: "context", label: "背景", type: "textarea" },
    { key: "rationale", label: "決定理由", type: "textarea" },
    { key: "due_date", label: "期限", type: "date" },
    { key: "owner_label", label: "担当", type: "text" },
    { key: "status", label: "状態", type: "select", options: [{ value: "open", label: "未決" }, { value: "decided", label: "決定済み" }, { value: "deferred", label: "保留" }] },
    { key: "decision_text", label: "決定内容", type: "textarea" },
    { key: "decided_by", label: "決定者", type: "text" },
    { key: "decided_on", label: "決定日", type: "date" },
    { key: "confidence", label: "確度", type: "select", options: [{ value: "high", label: "高" }, { value: "medium", label: "中" }, { value: "low", label: "低" }, { value: "unknown", label: "未確認" }] },
  ],
  kpi: [
    { key: "title", label: "指標", type: "text" }, { key: "metric_kind", label: "指標種別", type: "text" }, { key: "baseline", label: "基準値", type: "number", step: 0.01 }, { key: "target", label: "目標", type: "number", step: 0.01 }, { key: "actual", label: "実績", type: "number", step: 0.01 }, { key: "unit", label: "単位", type: "text" }, { key: "threshold", label: "閾値", type: "number", step: 0.01 }, { key: "threshold_rule", label: "閾値ルール", type: "select", options: [{ value: "gte", label: "以上" }, { value: "lte", label: "以下" }, { value: "between", label: "範囲内" }] }, { key: "threshold_upper", label: "上限(範囲内)", type: "number", step: 0.01 }, { key: "measurement_date", label: "測定日", type: "date" }, { key: "frequency", label: "頻度", type: "text" }, { key: "source_label", label: "根拠", type: "text" }, { key: "confidence", label: "確度", type: "select", options: [{ value: "high", label: "高" }, { value: "medium", label: "中" }, { value: "low", label: "低" }, { value: "unknown", label: "未確認" }] },
  ],
  action: [
    { key: "title", label: "アクション", type: "text" }, { key: "owner_label", label: "担当", type: "text" }, { key: "due_date", label: "期限", type: "date" }, { key: "completion_criteria", label: "完了条件", type: "textarea" }, { key: "next_review_on", label: "次回確認", type: "date" }, { key: "status", label: "状態", type: "select", options: [{ value: "open", label: "未着手" }, { value: "in_progress", label: "進行中" }, { value: "completed", label: "完了" }, { value: "blocked", label: "停止" }] }, { key: "completion_note", label: "完了証跡", type: "textarea" }, { key: "completed_at", label: "完了日", type: "date" },
  ],
  commitment: [
    { key: "title", label: "約束", type: "text" }, { key: "commitment_text", label: "約束内容", type: "textarea" }, { key: "commitment_kind", label: "約束の種類", type: "select", options: [{ value: "counterparty_promise", label: "相手の約束" }, { value: "sx_followup", label: "SX側の次アクション" }] }, { key: "status", label: "状態", type: "select", options: [{ value: "open", label: "未着手" }, { value: "in_progress", label: "進行中" }, { value: "completed", label: "完了" }, { value: "blocked", label: "停止" }, { value: "cancelled", label: "取消" }] }, { key: "promised_on", label: "約束日", type: "date" }, { key: "due_date", label: "期限", type: "date" }, { key: "counterparty_owner", label: "相手担当", type: "text" }, { key: "sx_owner", label: "SX担当", type: "text" }, { key: "evidence", label: "一次根拠", type: "textarea" }, { key: "next_review_on", label: "次回確認", type: "date" },
  ],
  dependency: [
    { key: "dependency_type", label: "依存の種類", type: "select", options: [{ value: "finish_to_start", label: "前工程完了後" }, { value: "start_to_start", label: "同時開始" }, { value: "finish_to_finish", label: "同時完了" }] }, { key: "required", label: "必須", type: "select", options: [{ value: "true", label: "必須" }, { value: "false", label: "任意" }] }, { key: "lag_days", label: "待ち日数", type: "number", min: 0, step: 1 }, { key: "note", label: "説明", type: "textarea" },
  ],
  technical_test: [
    { key: "test_condition", label: "試験条件", type: "textarea" }, { key: "target", label: "目標", type: "text" }, { key: "actual", label: "実績", type: "text" }, { key: "unit", label: "単位", type: "text" }, { key: "repetition", label: "反復回数", type: "number", min: 0, step: 1 }, { key: "sample", label: "サンプル", type: "text" }, { key: "trl_criterion", label: "TRL基準", type: "textarea" }, { key: "evidence", label: "証跡", type: "textarea" }, { key: "status", label: "状態", type: "select", options: [{ value: "unassessed", label: "未評価" }, { value: "planned", label: "計画" }, { value: "running", label: "実施中" }, { value: "passed", label: "合格" }, { value: "failed", label: "不合格" }, { value: "blocked", label: "停止" }] }, { key: "measured_on", label: "測定日", type: "date" }, { key: "owner_label", label: "担当", type: "text" },
  ],
  funding_snapshot: [
    { key: "required_amount", label: "必要額", type: "number", min: 0, step: 1 }, { key: "secured_amount", label: "確保額", type: "number", min: 0, step: 1 }, { key: "unconfirmed_amount", label: "未確認額", type: "number", min: 0, step: 1 }, { key: "use_summary", label: "用途", type: "textarea" }, { key: "burn_per_month", label: "月次消費", type: "number", min: 0, step: 1 }, { key: "runway_months", label: "資金残存月数", type: "number", min: 0, step: 0.1 }, { key: "probability", label: "確度(0-1)", type: "number", min: 0, max: 1, step: 0.01 }, { key: "cash_condition", label: "着金条件", type: "textarea" }, { key: "source_label", label: "根拠", type: "text" },
  ],
  organization_role: [
    { key: "candidate", label: "候補", type: "text" }, { key: "commitment", label: "参画状態", type: "text" }, { key: "authority", label: "権限", type: "textarea" }, { key: "vacancy", label: "空席", type: "select", options: [{ value: "true", label: "空席" }, { value: "false", label: "充足" }] }, { key: "join_condition", label: "参画条件", type: "textarea" }, { key: "due_date", label: "期限", type: "date" }, { key: "status", label: "状態", type: "select", options: [{ value: "unassessed", label: "未評価" }, { value: "candidate", label: "候補" }, { value: "committed", label: "参画確認" }, { value: "filled", label: "充足" }, { value: "on_hold", label: "保留" }] }, { key: "owner_label", label: "担当", type: "text" },
  ],
  raci: [
    { key: "stakeholder_label", label: "関係者", type: "text" }, { key: "responsibility_role", label: "責任", type: "select", options: [{ value: "R", label: "R 実行責任" }, { value: "A", label: "A 最終責任" }, { value: "C", label: "C 協議" }, { value: "I", label: "I 共有" }] }, { key: "owner_label", label: "担当者", type: "text" }, { key: "confirmed", label: "確認済み", type: "select", options: [{ value: "true", label: "確認済み" }, { value: "false", label: "未確認" }] }, { key: "confidence", label: "確度", type: "select", options: [{ value: "high", label: "高" }, { value: "medium", label: "中" }, { value: "low", label: "低" }, { value: "unknown", label: "未確認" }] },
  ],
  capacity: [
    { key: "role_label", label: "役割", type: "text" }, { key: "required_people", label: "必要人数", type: "number", min: 0, step: 1 }, { key: "confirmed_people", label: "確認人数", type: "number", min: 0, step: 1 }, { key: "available_hours_week", label: "利用可能時間/週", type: "number", min: 0, step: 0.5 }, { key: "planned_hours_week", label: "計画時間/週", type: "number", min: 0, step: 0.5 }, { key: "measurement_date", label: "測定日", type: "date" }, { key: "source_label", label: "根拠", type: "text" }, { key: "confidence", label: "確度", type: "select", options: [{ value: "high", label: "高" }, { value: "medium", label: "中" }, { value: "low", label: "低" }, { value: "unknown", label: "未確認" }] },
  ],
};

type CreateField = {
  key: string;
  label: string;
  type?: "text" | "date" | "number" | "textarea" | "select";
  min?: number;
  max?: number;
  step?: number;
  options?: Array<{ value: string; label: string }>;
};

const TRACK_OPTIONS = Object.entries(TRACK_LABELS).map(([value, label]) => ({ value, label }));
const CONFIDENCE_OPTIONS = [{ value: "unknown", label: "未確認" }, { value: "high", label: "高" }, { value: "medium", label: "中" }, { value: "low", label: "低" }];
const DATE_CERTAINTY_OPTIONS = [{ value: "provisional", label: "仮置き" }, { value: "confirmed", label: "確定" }];

function createFieldsFor(resource: ManagementResource, management: SxManagementBundle): CreateField[] {
  const milestoneOptions = management.milestones.map((item) => ({ value: item.id, label: `${nominalizeSxActionLabel(item.title)}（${TRACK_LABELS[item.track]}）` }));
  const issueOptions = management.issues.map((item) => ({ value: item.id, label: item.title }));
  const hypothesisOptions = management.hypotheses.map((item) => ({ value: item.id, label: item.statement.slice(0, 70) }));
  const decisionOptions = management.decisions.map((item) => ({ value: item.id, label: nominalizeSxActionLabel(item.title) }));
  const partnerOptions = management.partners.map((item) => ({ value: item.id, label: sxPartnerName(item) }));
  const outcomeOptions = management.outcomes.map((item) => ({ value: item.id, label: `${nominalizeSxActionLabel(item.title)}（${TRACK_LABELS[item.track]}）` }));
  const objectiveOptions = management.objective ? [{ value: management.objective.id, label: management.objective.title }] : [];
  if (resource === "issue") return [
    { key: "slug", label: "識別名", type: "text" }, { key: "title", label: "論点", type: "text" }, { key: "track", label: "柱", type: "select", options: TRACK_OPTIONS }, { key: "knowledge_type", label: "分類", type: "select", options: [{ value: "fact", label: "事実" }, { value: "hypothesis", label: "仮説" }, { value: "decision_needed", label: "意思決定待ち" }] }, { key: "status", label: "状態", type: "select", options: [{ value: "open", label: "未着手" }, { value: "validating", label: "検証中" }, { value: "on_hold", label: "保留" }] }, { key: "milestone_id", label: "関連ゲート", type: "select", options: [{ value: "", label: "未接続" }, ...milestoneOptions] }, { key: "outcome_id", label: "関連成果目標", type: "select", options: [{ value: "", label: "未接続" }, ...outcomeOptions] }, { key: "owner_label", label: "担当（実名未確認ならその旨）", type: "text" }, { key: "due_date", label: "期限", type: "date" }, { key: "confidence", label: "確度", type: "select", options: CONFIDENCE_OPTIONS },
  ];
  if (resource === "hypothesis") return [
    { key: "issue_id", label: "親論点", type: "select", options: issueOptions }, { key: "statement", label: "仮説", type: "textarea" }, { key: "owner_label", label: "担当", type: "text" }, { key: "due_date", label: "期限", type: "date" }, { key: "confidence", label: "確度", type: "select", options: CONFIDENCE_OPTIONS },
  ];
  if (resource === "evidence") return [
    { key: "issue_id", label: "親論点", type: "select", options: issueOptions }, { key: "hypothesis_id", label: "関連仮説（任意）", type: "select", options: [{ value: "", label: "未接続" }, ...hypothesisOptions] }, { key: "evidence_kind", label: "根拠の種類", type: "select", options: [{ value: "supporting", label: "支持" }, { value: "counter", label: "反証" }, { value: "missing", label: "不足" }, { value: "observation", label: "観測" }] }, { key: "summary", label: "要約", type: "textarea" }, { key: "observed_on", label: "確認日", type: "date" }, { key: "source_label", label: "確認元", type: "text" }, { key: "confidence", label: "確度", type: "select", options: CONFIDENCE_OPTIONS },
  ];
  if (resource === "validation") return [
    { key: "hypothesis_id", label: "親仮説", type: "select", options: hypothesisOptions }, { key: "validation_kind", label: "検証の種類", type: "text" }, { key: "planned_on", label: "予定日", type: "date" }, { key: "due_date", label: "期限", type: "date" }, { key: "owner_label", label: "担当", type: "text" }, { key: "method", label: "方法", type: "textarea" }, { key: "confidence", label: "確度", type: "select", options: CONFIDENCE_OPTIONS },
  ];
  if (resource === "decision") return [
    { key: "issue_id", label: "親論点（任意）", type: "select", options: [{ value: "", label: "未接続" }, ...issueOptions] }, { key: "hypothesis_id", label: "親仮説（任意）", type: "select", options: [{ value: "", label: "未接続" }, ...hypothesisOptions] }, { key: "title", label: "決めること", type: "text" }, { key: "context", label: "背景", type: "textarea" }, { key: "rationale", label: "判断理由", type: "textarea" }, { key: "status", label: "状態", type: "select", options: [{ value: "open", label: "意思決定待ち" }, { value: "deferred", label: "保留" }, { value: "decided", label: "決定済み" }] }, { key: "decision_text", label: "決定内容", type: "textarea" }, { key: "decided_by", label: "決定者", type: "text" }, { key: "decided_on", label: "決定日", type: "date" }, { key: "owner_label", label: "担当", type: "text" }, { key: "due_date", label: "期限", type: "date" }, { key: "is_this_week", label: "今週決める", type: "select", options: [{ value: "true", label: "今週" }, { value: "false", label: "今週ではない" }] }, { key: "confidence", label: "確度", type: "select", options: CONFIDENCE_OPTIONS },
  ];
  if (resource === "action") return [
    { key: "decision_id", label: "親の意思決定", type: "select", options: decisionOptions }, { key: "title", label: "アクション", type: "text" }, { key: "owner_label", label: "担当", type: "text" }, { key: "due_date", label: "期限", type: "date" }, { key: "completion_criteria", label: "完了条件", type: "textarea" }, { key: "next_review_on", label: "次回確認", type: "date" },
  ];
  if (resource === "partner") return [
    { key: "slug", label: "識別名", type: "text" }, { key: "name", label: "機関名", type: "text" }, { key: "role_label", label: "役割", type: "text" }, { key: "primary_track", label: "主な柱", type: "select", options: TRACK_OPTIONS }, { key: "relationship_stage", label: "進捗段階", type: "select", options: Object.entries(PARTNER_STAGE_LABELS).map(([value, label]) => ({ value, label })) }, { key: "agreement_state", label: "合意状態", type: "select", options: [{ value: "unagreed", label: "未合意" }, { value: "partial", label: "一部合意" }, { value: "agreed", label: "合意済み" }] }, { key: "agreed_scope", label: "合意済みの範囲", type: "textarea" }, { key: "unagreed_scope", label: "未合意の範囲", type: "textarea" }, { key: "next_commitment", label: "SX側の次アクション", type: "textarea" }, { key: "due_date", label: "期限", type: "date" }, { key: "due_date_precision", label: "期限の確度", type: "select", options: Object.entries(DATE_PRECISION_LABELS).map(([value, label]) => ({ value, label })) }, { key: "owner_label", label: "担当", type: "text" }, { key: "current_ball_side", label: "現在ボール（側）", type: "select", options: Object.entries(BALL_SIDE_LABELS).map(([value, label]) => ({ value, label })) }, { key: "current_ball_owner", label: "現在ボール（担当）", type: "text" }, { key: "target_state", label: "目標状態", type: "textarea" }, { key: "confidence", label: "確度", type: "select", options: CONFIDENCE_OPTIONS },
  ];
  if (resource === "interaction") return [
    { key: "partner_id", label: "関係先", type: "select", options: partnerOptions }, { key: "interaction_kind", label: "種別", type: "select", options: Object.entries(INTERACTION_KIND_LABELS).map(([value, label]) => ({ value, label })) }, { key: "occurred_on", label: "発生日", type: "date" }, { key: "occurred_on_precision", label: "発生日の確度", type: "select", options: Object.entries(DATE_PRECISION_LABELS).map(([value, label]) => ({ value, label })) }, { key: "summary", label: "内容", type: "textarea" }, { key: "outcome_summary", label: "結果・要点", type: "textarea" }, { key: "ball_side_after", label: "以後のボール（側）", type: "select", options: Object.entries(BALL_SIDE_LABELS).map(([value, label]) => ({ value, label })) }, { key: "ball_owner_after", label: "以後のボール（担当）", type: "text" }, { key: "actor_side", label: "行為主体（側）", type: "select", options: Object.entries(ACTOR_SIDE_LABELS).map(([value, label]) => ({ value, label })) }, { key: "actor_label", label: "行為主体（実名）", type: "text" }, { key: "confidence", label: "確度", type: "select", options: CONFIDENCE_OPTIONS },
  ];
  if (resource === "partner_role") return [
    { key: "partner_id", label: "関係先", type: "select", options: partnerOptions },
    { key: "role_kind", label: "分類", type: "select", options: Object.entries(ROLE_KIND_LABELS).map(([value, label]) => ({ value, label })) },
    { key: "relationship_state", label: "関係状態", type: "select", options: Object.entries(RELATIONSHIP_STATE_LABELS).map(([value, label]) => ({ value, label })) },
    { key: "role_label", label: "補足ラベル（任意）", type: "text" },
    { key: "is_primary", label: "主分類", type: "select", options: [{ value: "false", label: "副分類" }, { value: "true", label: "主分類" }] },
  ];
  if (resource === "partner_work_item") return [
    { key: "partner_id", label: "関係先", type: "select", options: partnerOptions },
    { key: "side", label: "保有側", type: "select", options: Object.entries(ACTOR_SIDE_LABELS).map(([value, label]) => ({ value, label })) },
    { key: "item_kind", label: "種別", type: "select", options: Object.entries(WORK_ITEM_KIND_LABELS).map(([value, label]) => ({ value, label })) },
    { key: "title", label: "タイトル", type: "text" },
    { key: "detail", label: "詳細（任意）", type: "textarea" },
    { key: "owner_label", label: "担当（任意）", type: "text" },
    { key: "status", label: "状態", type: "select", options: Object.entries(WORK_ITEM_STATUS_LABELS).map(([value, label]) => ({ value, label })) },
    { key: "due_date", label: "期限", type: "date" },
    { key: "due_date_precision", label: "期限の確度", type: "select", options: Object.entries(DATE_PRECISION_LABELS).map(([value, label]) => ({ value, label })) },
    { key: "completion_criteria", label: "完了条件（任意、確認できないなら空欄のまま。完了にする前提として必須）", type: "textarea" },
    { key: "completed_on", label: "完了日（完了にする前提として必須）", type: "date" },
    { key: "completion_evidence", label: "完了証跡（完了にする前提として必須、確認できないなら空欄のまま）", type: "textarea" },
    { key: "accepted_by", label: "受入担当（成果物の完了に必須）", type: "text" },
    { key: "accepted_on", label: "受入日（成果物の完了に必須）", type: "date" },
    { key: "related_milestone_id", label: "関連ゲート（任意）", type: "select", options: [{ value: "", label: "未接続" }, ...milestoneOptions] },
    { key: "confidence", label: "確度", type: "select", options: CONFIDENCE_OPTIONS },
  ];
  if (resource === "commitment") return [
    { key: "partner_id", label: "関係先", type: "select", options: partnerOptions }, { key: "title", label: "約束", type: "text" }, { key: "commitment_text", label: "約束内容", type: "textarea" }, { key: "commitment_kind", label: "約束の種類", type: "select", options: [{ value: "sx_followup", label: "SX側の次アクション" }, { value: "counterparty_promise", label: "相手の約束" }] }, { key: "status", label: "状態", type: "select", options: [{ value: "open", label: "未着手" }, { value: "in_progress", label: "進行中" }, { value: "completed", label: "完了" }, { value: "blocked", label: "停止" }] }, { key: "promised_on", label: "約束日", type: "date" }, { key: "due_date", label: "期限", type: "date" }, { key: "counterparty_owner", label: "相手担当（相手の約束のみ）", type: "text" }, { key: "sx_owner", label: "SX担当", type: "text" }, { key: "evidence", label: "一次根拠（相手の約束のみ）", type: "textarea" }, { key: "next_review_on", label: "次回確認", type: "date" }, { key: "confidence", label: "確度", type: "select", options: CONFIDENCE_OPTIONS },
  ];
  if (resource === "milestone") return [
    { key: "objective_id", label: "経営目的", type: "select", options: objectiveOptions }, { key: "outcome_id", label: "成果目標", type: "select", options: outcomeOptions }, { key: "slug", label: "識別名", type: "text" }, { key: "track", label: "柱", type: "select", options: TRACK_OPTIONS }, { key: "title", label: "マイルストーン", type: "text" }, { key: "gate", label: "現在ゲート", type: "text" }, { key: "planned_start", label: "予定開始", type: "date" }, { key: "planned_end", label: "予定終了", type: "date" }, { key: "forecast_end", label: "予測終了", type: "date" }, { key: "date_certainty", label: "日付の確度", type: "select", options: DATE_CERTAINTY_OPTIONS }, { key: "owner_label", label: "担当", type: "text" }, { key: "next_deliverable", label: "次の成果", type: "textarea" }, { key: "max_issue", label: "最大論点", type: "textarea" }, { key: "completion_criteria", label: "完了条件", type: "textarea" }, { key: "criticality", label: "重要度", type: "select", options: [{ value: "critical", label: "最重要" }, { value: "high", label: "高" }, { value: "medium", label: "中" }, { value: "low", label: "低" }] }, { key: "confidence", label: "確度", type: "select", options: CONFIDENCE_OPTIONS },
  ];
  if (resource === "dependency") return [
    { key: "predecessor_milestone_id", label: "前提ゲート", type: "select", options: milestoneOptions }, { key: "successor_milestone_id", label: "後続ゲート", type: "select", options: milestoneOptions }, { key: "dependency_type", label: "依存の種類", type: "select", options: [{ value: "finish_to_start", label: "前工程完了後" }, { value: "start_to_start", label: "同時開始" }, { value: "finish_to_finish", label: "同時完了" }] }, { key: "required", label: "必須性", type: "select", options: [{ value: "true", label: "必須" }, { value: "false", label: "任意" }] }, { key: "lag_days", label: "待ち日数", type: "number", min: 0, step: 1 }, { key: "note", label: "説明", type: "textarea" },
  ];
  return [];
}

function hours(value: number) {
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0$/, "");
}

function displayActor(value: string, memberNames: ReadonlyMap<string, string>) {
  const label = memberNames.get(value);
  if (label) return label;
  if (/^ID\d+$/i.test(value) || /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value)) return "担当者名未確認";
  return value || "担当者名未確認";
}

function formatDate(value: string | null | undefined, fallback = "未設定") {
  if (!value) return fallback;
  const [year, month, day] = value.slice(0, 10).split("-");
  if (!year || !month || !day) return fallback;
  return `${year}/${Number(month)}/${Number(day)}`;
}

function displayManagementText(value: string | null | undefined) {
  return value?.replace(/\brunway\b/gi, "資金残存月数") || "";
}

function formatDeltaLabel(deltaDays: number | null, dateCertainty: "confirmed" | "provisional" | null) {
  if (deltaDays == null) return "未算定";
  if (dateCertainty === "provisional") {
    if (deltaDays === 0) return "予測差 0日";
    return `予測差 ${deltaDays > 0 ? "+" : "-"}${Math.abs(deltaDays)}日`;
  }
  if (deltaDays === 0) return "予定通り";
  return deltaDays > 0 ? `${deltaDays}日遅延` : `${Math.abs(deltaDays)}日短縮`;
}

function buildMilestoneLabelMap(milestones: SxManagementMilestone[]) {
  const labels = new Map<string, string>();
  milestones.forEach((milestone) => {
    const title = nominalizeSxActionLabel(displayManagementText(milestone.title)).trim() || "名称未確認";
    if (milestone.id) labels.set(milestone.id, title);
    if (milestone.slug) labels.set(milestone.slug, title);
  });
  return labels;
}

function milestoneLabels(values: string[], labels: ReadonlyMap<string, string>) {
  return values.map((value) => labels.get(value) || "名称未確認");
}

function confidenceLabel(value: string | null | undefined) {
  return ({ high: "高", medium: "中", low: "低", unknown: "未確認" } as Record<string, string>)[value || "unknown"] || "未確認";
}

function technicalStatusLabel(value: string) {
  return ({ unassessed: "未評価", planned: "計画", running: "実施中", passed: "合格", failed: "不合格", blocked: "停止" } as Record<string, string>)[value] || "未確認";
}

function roleStatusLabel(value: string) {
  return ({ unassessed: "未評価", candidate: "候補", committed: "参画確認", filled: "充足", on_hold: "保留" } as Record<string, string>)[value] || "未確認";
}

function auditEntityLabel(value: string) {
  return ({ project_management_objectives: "経営目的", project_management_outcomes: "成果目標", project_management_milestones: "マイルストーン", project_management_kpis: "KPI", project_management_issues: "論点", project_management_hypotheses: "仮説", project_management_evidence: "根拠", project_management_validation_runs: "検証", project_management_decisions: "意思決定", project_management_action_items: "アクション", project_management_partners: "関係先", project_management_partner_commitments: "関係先の約束", project_management_partner_interactions: "関係先の履歴", project_management_partner_roles: "関係先の分類", project_management_partner_work_items: "保有事項", project_management_technical_tests: "技術試験", project_management_funding_snapshots: "資金", project_management_organization_roles: "必須役割", project_management_raci: "RACI", project_management_capacity: "人員容量", project_management_milestone_dependencies: "ゲート間の依存" } as Record<string, string>)[value] || "管理情報";
}

function auditFieldLabel(value: string) {
  return ({ actual: "実績", target: "目標", baseline: "基準値", threshold: "閾値", threshold_rule: "閾値ルール", threshold_upper: "上限閾値", status: "状態", decision_state: "意思決定状態", owner_label: "担当", confidence: "確度", next_review_on: "次回確認", completion_evidence: "完了証跡", deleted_at: "非表示日時", source_ref: "確認元の説明", source_kind: "確認元の種類", last_verified_at: "最終確認日", updated_by: "更新者", current_truth: "現在の基準情報", commitment_kind: "約束の種類", promised_on: "約束日", next_commitment: "SX側の次アクション", knowledge_type: "情報の分類", deleted_by: "非表示にした担当", current_ball_side: "現在ボール（側）", current_ball_owner: "現在ボール（担当）", next_ball_owner: "旧項目", target_state: "目標状態", due_date_precision: "期限の確度", interaction_kind: "履歴の種別", occurred_on: "発生日", occurred_on_precision: "発生日の確度", outcome_summary: "結果・要点", ball_side_after: "以後のボール（側）", ball_owner_after: "以後のボール（担当）", actor_side: "行為主体（側）", actor_label: "行為主体（実名）", role_kind: "分類", relationship_state: "関係状態", role_label: "補足ラベル", is_primary: "主分類", sort_order: "表示順", side: "保有側", item_kind: "種別", detail: "詳細", handoff_to: "旧項目", related_milestone_id: "関連ゲート", completion_criteria: "完了条件", completed_on: "完了日", accepted_by: "受入担当", accepted_on: "受入日" } as Record<string, string>)[value] || "項目未確認";
}

function sourceLabel(value: string | null | undefined) {
  return SOURCE_LABELS[value || ""] || "確認元未確認";
}

function formatMonth(value: string | null | undefined) {
  if (!value) return "—";
  const parts = value.replace("/", "-").split("-");
  return parts.length >= 2 ? `${parts[0]}年${Number(parts[1])}月` : value;
}

function horizonPeriodLabel(months: string[]) {
  if (!months.length) return "";
  const start = formatMonth(months[0]);
  const end = formatMonth(months[months.length - 1]);
  return start === end ? start : `${start}–${end}`;
}

function formatActivityDate(value: string | null) {
  if (!value) return "未取得";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未取得";
  return new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", timeZone: "Asia/Tokyo" }).format(date);
}

function compactYm(ym: string | null) {
  if (!ym || ym.length !== 6) return "—";
  return `${Number(ym.slice(4, 6))}月`;
}

function statusLabel(status: string) {
  return ({ not_started: "未着手", unassessed: "未評価", on_track: "順調", attention: "注意", at_risk: "遅れ懸念", blocked: "停止", completed: "完了", open: "未着手", validating: "検証中", decided: "判断済み", closed: "完了", on_hold: "保留", in_progress: "進行中", planned: "計画", running: "実施中", cancelled: "取消" } as Record<string, string>)[status] || "未確認";
}

function hypothesisStatusLabel(status: string) {
  return ({ open: "未着手", validating: "検証中", validated: "検証済み", rejected: "反証", decided: "判断済み", on_hold: "保留" } as Record<string, string>)[status] || "未確認";
}

function Badge({ children, tone = "border-[#d6cebf] bg-[#f8f5ec] text-[#69665d]" }: { children: React.ReactNode; tone?: string }) {
  return <span className={`inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-semibold leading-none ${tone}`}>{children}</span>;
}

function SectionHeader({ kicker, title, description, action, headingId }: { kicker: string; title: string; description?: string; action?: React.ReactNode; headingId?: string }) {
  return (
    <div className="mb-5 flex flex-col gap-3 border-b border-[#e4ddd0] pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-[10px] font-semibold tracking-[0.16em] text-[#38745d]">{kicker}</p>
        <h2 id={headingId} className="mt-1 text-lg font-semibold tracking-tight text-[#24231f]">{title}</h2>
        {description && <p className="mt-1.5 max-w-3xl text-xs leading-5 text-[#777166]">{description}</p>}
      </div>
      {action}
    </div>
  );
}

function CategoryBand({ categories, muted = false }: { categories: Record<EffortCategory, number>; muted?: boolean }) {
  const total = EFFORT_CATEGORIES.reduce((sum, item) => sum + categories[item.key], 0);
  return (
    <div className="flex w-full min-w-0 overflow-hidden rounded-lg border border-black/10 " aria-label="研究からSUまでの時間配分">
      {EFFORT_CATEGORIES.map((item) => {
        const value = categories[item.key];
        const width = total > 0 ? Math.max(9, (value / total) * 100) : 20;
        return (
          <div key={item.key} className="flex min-h-14 flex-col justify-center border-r border-white/25 px-3 last:border-r-0" style={{ flexBasis: `${width}%`, background: muted ? `${CATEGORY_STYLE[item.key].background}26` : CATEGORY_STYLE[item.key].background, color: muted ? "#5f5b52" : CATEGORY_STYLE[item.key].color }}>
            <span className="whitespace-nowrap text-[10px] font-semibold tracking-wide">{item.shortLabel}</span>
            <span className="mt-0.5 text-sm font-semibold">{total > 0 ? `${hours(value)}h` : "—"}</span>
          </div>
        );
      })}
    </div>
  );
}

type EditRecord = SxObjective | SxOutcome | SxManagementMilestone | SxManagementIssue | SxHypothesis | SxEvidence | SxValidationRun | SxManagementPartner | SxManagementDecision | SxKpi | SxActionItem | SxPartnerCommitment | SxPartnerInteraction | SxPartnerRole | SxPartnerWorkItem | SxDependency | SxTechnicalTest | SxFundingSnapshot | SxOrganizationRole | SxRaci | SxCapacity;

function recordFor(bundle: SxManagementBundle, resource: ManagementResource, id: string): EditRecord | undefined {
  const rows: Array<{ id: string }> = resource === "objective" ? (bundle.objective ? [bundle.objective] : [])
    : resource === "outcome" ? bundle.outcomes
      : resource === "milestone" ? bundle.milestones
      : resource === "issue" ? bundle.issues
      : resource === "hypothesis" ? bundle.hypotheses
        : resource === "evidence" ? bundle.evidence
          : resource === "validation" ? bundle.validationRuns
      : resource === "partner" ? bundle.partners
        : resource === "decision" ? bundle.decisions
          : resource === "kpi" ? bundle.kpis
            : resource === "action" ? bundle.actions
              : resource === "commitment" ? bundle.partnerCommitments
                : resource === "interaction" ? bundle.partnerInteractions
                : resource === "partner_role" ? bundle.partnerRoles
                  : resource === "partner_work_item" ? bundle.partnerWorkItems
                : resource === "technical_test" ? bundle.technicalTests
                  : resource === "funding_snapshot" ? bundle.fundingSnapshots
                    : resource === "organization_role" ? bundle.organizationRoles
                      : resource === "raci" ? bundle.raci
                        : resource === "dependency" ? bundle.dependencies
                          : bundle.capacity;
  return rows.find((row) => row.id === id) as EditRecord | undefined;
}

const EDIT_VALUE_KEYS: Record<string, string> = {
  target_date: "targetDate", definition_of_done: "definitionOfDone", planned_start: "plannedStart", planned_end: "plannedEnd", forecast_end: "forecastEnd", actual_end: "actualEnd", date_certainty: "dateCertainty", owner_label: "ownerLabel", next_deliverable: "nextDeliverable", max_issue: "maxIssue", completion_criteria: "completionCriteria", completion_evidence: "completionEvidence", forecast_change_reason: "forecastChangeReason", last_contact_date: "lastContactDate", relationship_stage: "relationshipStage", agreement_state: "agreementState", agreed_scope: "agreedScope", unagreed_scope: "unagreedScope", next_commitment: "nextCommitment", due_date: "dueDate", promised_on: "promisedOn", decision_text: "decisionText", decided_by: "decidedBy", decided_on: "decidedOn", metric_kind: "metricKind", measurement_date: "measurementDate", source_label: "sourceLabel", threshold_rule: "thresholdRule", threshold_upper: "thresholdUpper", next_review_on: "nextReviewOn", completion_note: "completionNote", completed_at: "completedAt", commitment_text: "commitmentText", commitment_kind: "commitmentKind", counterparty_owner: "counterpartyOwner", sx_owner: "sxOwner", test_condition: "testCondition", trl_criterion: "trlCriterion", measured_on: "measuredOn", required_amount: "requiredAmount", secured_amount: "securedAmount", unconfirmed_amount: "unconfirmedAmount", use_summary: "useSummary", burn_per_month: "burnPerMonth", runway_months: "runwayMonths", cash_condition: "cashCondition", role_name: "roleName", join_condition: "joinCondition", role_slug: "roleSlug", responsibility_role: "responsibilityRole", stakeholder_label: "stakeholderLabel", required_people: "requiredPeople", confirmed_people: "confirmedPeople", available_hours_week: "availableHoursWeek", planned_hours_week: "plannedHoursWeek", statement: "statement", evidence_kind: "kind", summary: "summary", observed_on: "observedOn", validation_kind: "validationKind", planned_on: "plannedOn", completed_on: "completedOn", result_summary: "resultSummary", dependency_type: "dependencyType", required: "required", lag_days: "lagDays", note: "note",
  current_ball_side: "currentBallSide", current_ball_owner: "currentBallOwner", next_ball_owner: "nextBallOwner", target_state: "targetState", due_date_precision: "dueDatePrecision",
  interaction_kind: "interactionKind", occurred_on: "occurredOn", occurred_on_precision: "occurredOnPrecision", outcome_summary: "outcomeSummary", ball_side_after: "ballSideAfter", ball_owner_after: "ballOwnerAfter",
  actor_side: "actorSide", actor_label: "actorLabel", role_kind: "roleKind", relationship_state: "relationshipState", role_label: "roleLabel", is_primary: "isPrimary", sort_order: "sortOrder",
  item_kind: "itemKind", handoff_to: "handoffTo", related_milestone_id: "relatedMilestoneId",
  accepted_by: "acceptedBy", accepted_on: "acceptedOn",
};

function initialEditValues(resource: ManagementResource, record: EditRecord) {
  const source = record as unknown as Record<string, unknown>;
  return Object.fromEntries(EDIT_FIELDS[resource].map((field) => {
    const sourceKey = EDIT_VALUE_KEYS[field.key] || field.key;
    return [field.key, source[sourceKey] == null ? "" : String(source[sourceKey])];
  })) as Record<string, string>;
}

function EditPanel({
  resource,
  record,
  projectId,
  onClose,
  onSaved,
  onConflict,
}: {
  resource: ManagementResource;
  record: EditRecord;
  projectId: string;
  onClose: () => void;
  onSaved: (bundle: SxManagementBundle) => void;
  onConflict: (bundle: SxManagementBundle) => void;
}) {
  const [values, setValues] = useState(() => initialEditValues(resource, record));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fields = EDIT_FIELDS[resource];
  async function save() {
    setSaving(true);
    setError(null);
    const patch = Object.fromEntries(Object.entries(values).map(([key, value]) => {
      if (["due_date", "last_contact_date", "planned_start", "planned_end", "forecast_end", "actual_end", "measurement_date", "decided_on", "next_review_on", "completed_at", "promised_on", "completed_on", "accepted_on", "measured_on", "observed_on", "planned_on", "occurred_on"].includes(key)) return [key, value || null];
      if (["progress_pct", "baseline", "target", "actual", "threshold", "threshold_upper", "repetition", "required_amount", "secured_amount", "unconfirmed_amount", "burn_per_month", "runway_months", "probability", "required_people", "confirmed_people", "available_hours_week", "planned_hours_week", "sort_order"].includes(key)) return [key, value === "" ? null : Number(value)];
      if (["vacancy", "confirmed", "required", "is_primary"].includes(key)) return [key, value === "true"];
      if (["decision_text", "completion_evidence", "forecast_change_reason", "completion_note", "counterparty_owner", "sx_owner", "evidence", "candidate", "commitment", "outcome_summary", "ball_owner_after", "current_ball_owner", "next_ball_owner", "target_state", "actor_label", "role_label", "detail", "handoff_to", "accepted_by"].includes(key)) return [key, value || null];
      return [key, value];
    }));
    try {
      // milestone (the only resource this dashboard PATCHes that carries `version`) requires
      // expected_version for optimistic concurrency — same contract as the gantt drag and the
      // weekly-control IssueEditor.
      const expectedVersion = resource === "milestone" ? (record as SxManagementMilestone).version : undefined;
      const response = await fetch(`/api/project-workspace/${encodeURIComponent(projectId)}/management`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resource, id: record.id, patch, ...(expectedVersion != null ? { expected_version: expectedVersion } : {}) }),
      });
      const body = await response.json().catch(() => ({}));
      if (response.status === 409) {
        const latest = await fetch(`/api/project-workspace/${encodeURIComponent(projectId)}/management`, {
          headers: { "Cache-Control": "no-store" },
        });
        const latestBody = await latest.json().catch(() => null);
        if (!latest.ok || !latestBody) throw new Error("他の人が先に更新したよ。最新内容を取得できなかったから、画面を再読み込みしてね");
        onConflict(latestBody as SxManagementBundle);
        return;
      }
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "保存できなかったよ");
      onSaved(body.bundle as SxManagementBundle);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "保存できなかったよ");
    } finally {
      setSaving(false);
    }
  }
  async function hideRecord() {
    if (!window.confirm(`${RESOURCE_LABELS[resource]}を非表示にする？履歴を残して、あとで復元できるよ。`)) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/project-workspace/${encodeURIComponent(projectId)}/management`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resource, id: record.id, delete: true }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "非表示にできなかったよ");
      onSaved(body.bundle as SxManagementBundle);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "非表示にできなかったよ");
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-[#24231f]/35 p-0 sm:place-items-center sm:p-5" role="dialog" aria-modal="true" aria-label="共有情報を編集">
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-[#d6cebf] bg-[#fffdf7] p-5 shadow-[0_24px_80px_rgba(61,56,44,0.22)] sm:max-w-2xl sm:rounded-2xl sm:p-7">
        <div className="flex items-start justify-between gap-4 border-b border-[#e4ddd0] pb-4">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.16em] text-[#38745d]">共有情報の更新</p>
            <h2 className="mt-1 text-lg font-semibold text-[#24231f]">{RESOURCE_LABELS[resource]}</h2>
            <p className="mt-1 text-xs text-[#777166]">保存すると最終確認日と「手入力」の根拠を更新するよ。</p>
          </div>
          <button type="button" onClick={onClose} className="min-h-11 rounded-md border border-[#d6cebf] px-3 py-2 text-xs font-semibold text-[#69665d] hover:bg-[#f8f5ec]">閉じる</button>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {fields.map((field) => (
            <label key={field.key} className={field.type === "textarea" ? "sm:col-span-2" : ""}>
              <span className="mb-1.5 block text-[11px] font-semibold text-[#514e47]">{field.label}</span>
              {field.type === "textarea" ? (
                <textarea value={values[field.key] || ""} onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))} rows={3} className="w-full resize-y rounded-lg border border-[#cfc7b9] bg-white px-3 py-2 text-sm leading-5 text-[#24231f] outline-none focus:border-[#38745d] focus:ring-2 focus:ring-[#38745d]/15" />
              ) : field.type === "select" ? (
                <select value={values[field.key] || ""} onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))} className="h-11 w-full rounded-lg border border-[#cfc7b9] bg-white px-3 text-sm text-[#24231f] outline-none focus:border-[#38745d] focus:ring-2 focus:ring-[#38745d]/15">
                  {field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              ) : (
                <input type={field.type || "text"} min={field.min} max={field.max} step={field.step} value={values[field.key] || ""} onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))} className="h-11 w-full rounded-lg border border-[#cfc7b9] bg-white px-3 text-sm text-[#24231f] outline-none focus:border-[#38745d] focus:ring-2 focus:ring-[#38745d]/15" />
              )}
            </label>
          ))}
        </div>
        {error && <p className="mt-4 rounded-lg border border-[#e4a39b] bg-[#f9e4e1] px-3 py-2 text-xs leading-5 text-[#8c3329]" role="alert">{error}</p>}
        <div className="mt-6 flex justify-end gap-2 border-t border-[#e4ddd0] pt-4">
          <button type="button" onClick={hideRecord} disabled={saving} className="min-h-11 rounded-lg border border-[#e4a39b] px-4 py-2.5 text-sm font-semibold text-[#8c3329] hover:bg-[#f9e4e1] disabled:cursor-wait disabled:opacity-60">非表示にする</button>
          <button type="button" onClick={onClose} className="min-h-11 rounded-lg border border-[#cfc7b9] px-4 py-2.5 text-sm font-semibold text-[#69665d] hover:bg-[#f8f5ec]">キャンセル</button>
          <button type="button" onClick={save} disabled={saving} className="min-h-11 rounded-lg bg-[#205f49] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60">{saving ? "保存中…" : "更新を保存"}</button>
        </div>
      </div>
    </div>
  );
}

const CREATE_RESOURCES: ManagementResource[] = ["issue", "hypothesis", "evidence", "validation", "decision", "action", "partner", "commitment", "interaction", "partner_role", "partner_work_item", "milestone", "dependency"];
const FORM_DATE_KEYS = ["due_date", "last_contact_date", "planned_start", "planned_end", "forecast_end", "actual_end", "measurement_date", "decided_on", "next_review_on", "completed_at", "promised_on", "completed_on", "accepted_on", "measured_on", "observed_on", "planned_on", "occurred_on", "snapshot_date"];
const FORM_NUMBER_KEYS = ["progress_pct", "baseline", "target", "actual", "threshold", "threshold_upper", "repetition", "required_amount", "secured_amount", "unconfirmed_amount", "burn_per_month", "runway_months", "probability", "required_people", "confirmed_people", "available_hours_week", "planned_hours_week", "lag_days", "sort_order"];
const FORM_BOOLEAN_KEYS = ["vacancy", "confirmed", "required", "is_this_week", "is_primary"];
const FORM_NULLABLE_TEXT_KEYS = ["decision_text", "completion_evidence", "forecast_change_reason", "completion_note", "counterparty_owner", "sx_owner", "evidence", "candidate", "commitment", "outcome_summary", "ball_owner_after", "current_ball_owner", "next_ball_owner", "target_state", "result_summary", "note", "actor_label", "role_label", "detail", "handoff_to", "completion_criteria", "related_milestone_id", "accepted_by"];

function serializeFormValues(values: Record<string, string>) {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => {
    if (FORM_DATE_KEYS.includes(key)) return [key, value || null];
    if (FORM_NUMBER_KEYS.includes(key)) return [key, value === "" ? null : Number(value)];
    if (FORM_BOOLEAN_KEYS.includes(key)) return [key, value === "true"];
    if (FORM_NULLABLE_TEXT_KEYS.includes(key)) return [key, value || null];
    return [key, value];
  }));
}

function AddPanel({ projectId, management, resource, initialValues, onClose, onSaved }: {
  projectId: string;
  management: SxManagementBundle;
  resource: ManagementResource;
  initialValues?: Record<string, string>;
  onClose: () => void;
  onSaved: (bundle: SxManagementBundle) => void;
}) {
  const fields = createFieldsFor(resource, management);
  const [values, setValues] = useState<Record<string, string>>(() => {
    const defaults: Record<string, string> = {
      confidence: "unknown",
      status: resource === "decision" || resource === "commitment" ? "open" : "",
      commitment_kind: "sx_followup",
      required: "true",
      is_this_week: "false",
      current_ball_side: "unknown",
      due_date_precision: "unknown",
      occurred_on_precision: "unknown",
      ball_side_after: "unknown",
      actor_side: "unknown",
      side: "unknown",
      is_primary: "false",
    };
    for (const field of fields) {
      if (defaults[field.key]) continue;
      defaults[field.key] = field.type === "select" ? field.options?.[0]?.value || "" : "";
    }
    return { ...defaults, ...initialValues };
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/project-workspace/${encodeURIComponent(projectId)}/management`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resource, fields: serializeFormValues(values) }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "追加できなかったよ");
      onSaved(body.bundle as SxManagementBundle);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "追加できなかったよ");
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-[#24231f]/35 p-0 sm:place-items-center sm:p-5" role="dialog" aria-modal="true" aria-label={`${RESOURCE_LABELS[resource]}を新規追加`}>
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-[#d6cebf] bg-[#fffdf7] p-5 shadow-[0_24px_80px_rgba(61,56,44,0.22)] sm:max-w-3xl sm:rounded-2xl sm:p-7">
        <div className="flex items-start justify-between gap-4 border-b border-[#e4ddd0] pb-4">
          <div><p className="text-[10px] font-semibold tracking-[0.16em] text-[#38745d]">共有情報の新規追加</p><h2 className="mt-1 text-lg font-semibold text-[#24231f]">{RESOURCE_LABELS[resource]}</h2><p className="mt-1 text-xs leading-5 text-[#777166]">親となる論点・仮説・判断・ゲートを選んで、経営航路の台帳へ接続するよ。実名や測定値が未確認なら、そのまま未確認で保存してね。</p></div>
          <button type="button" onClick={onClose} className="min-h-11 shrink-0 rounded-md border border-[#d6cebf] px-3 py-2 text-xs font-semibold text-[#69665d] hover:bg-[#f8f5ec]">閉じる</button>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {fields.map((field) => (
            <label key={field.key} className={field.type === "textarea" ? "sm:col-span-2" : ""}>
              <span className="mb-1.5 block text-[11px] font-semibold text-[#514e47]">{field.label}</span>
              {field.type === "textarea" ? <textarea value={values[field.key] || ""} onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))} rows={3} className="w-full resize-y rounded-lg border border-[#cfc7b9] bg-white px-3 py-2 text-sm leading-5 text-[#24231f] outline-none focus:border-[#38745d] focus:ring-2 focus:ring-[#38745d]/15" /> : field.type === "select" ? <select value={values[field.key] || ""} onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))} className="h-11 w-full rounded-lg border border-[#cfc7b9] bg-white px-3 text-sm text-[#24231f] outline-none focus:border-[#38745d] focus:ring-2 focus:ring-[#38745d]/15">{field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : <input type={field.type || "text"} min={field.min} max={field.max} step={field.step} value={values[field.key] || ""} onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))} className="h-11 w-full rounded-lg border border-[#cfc7b9] bg-white px-3 text-sm text-[#24231f] outline-none focus:border-[#38745d] focus:ring-2 focus:ring-[#38745d]/15" />}
            </label>
          ))}
        </div>
        {resource === "commitment" && <p className="mt-4 rounded-lg border border-[#e3c994] bg-[#fbf1dc] px-3 py-2 text-xs leading-5 text-[#765022]">「相手の約束」は相手担当・約束日・一次根拠が揃ったものだけ登録できるよ。揃わない場合は「SX側の次アクション」にしてね。</p>}
        {error && <p className="mt-4 rounded-lg border border-[#e4a39b] bg-[#f9e4e1] px-3 py-2 text-xs leading-5 text-[#8c3329]" role="alert">{error}</p>}
        <div className="mt-6 flex justify-end gap-2 border-t border-[#e4ddd0] pt-4"><button type="button" onClick={onClose} className="min-h-11 rounded-lg border border-[#cfc7b9] px-4 py-2.5 text-sm font-semibold text-[#69665d] hover:bg-[#f8f5ec]">キャンセル</button><button type="button" onClick={save} disabled={saving} className="min-h-11 rounded-lg bg-[#205f49] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60">{saving ? "保存中…" : "追加して接続"}</button></div>
      </div>
    </div>
  );
}

type DeletedManagementRecord = {
  resource: ManagementResource;
  id: string;
  label: string;
  deletedAt: string | null;
};

function DeletedManagementSection({ projectId, onRestored }: { projectId: string; onRestored: (bundle: SxManagementBundle) => void }) {
  const [open, setOpen] = useState(false);
  const [records, setRecords] = useState<DeletedManagementRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function loadDeleted() {
    setOpen(true);
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/project-workspace/${encodeURIComponent(projectId)}/management?include_deleted=true`, { cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "非表示情報を確認できなかったよ");
      setRecords(Array.isArray(body.deletedRecords) ? body.deletedRecords : []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "非表示情報を確認できなかったよ");
    } finally {
      setLoading(false);
    }
  }
  async function restore(record: DeletedManagementRecord) {
    if (!window.confirm(`${RESOURCE_LABELS[record.resource]}「${record.label}」を復元する？`)) return;
    setRestoringId(record.id);
    setError(null);
    try {
      const response = await fetch(`/api/project-workspace/${encodeURIComponent(projectId)}/management`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resource: record.resource, id: record.id, restore: true }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "復元できなかったよ");
      onRestored(body.bundle as SxManagementBundle);
      setRecords((current) => current.filter((item) => item.id !== record.id || item.resource !== record.resource));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "復元できなかったよ");
    } finally {
      setRestoringId(null);
    }
  }
  return (
    <section className="rounded-xl border border-[#d6cebf] bg-[#fffdf7]/95 p-5 sm:p-6" aria-labelledby="deleted-management-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-[10px] font-semibold tracking-[0.16em] text-[#38745d]">管理台帳の履歴</p><h2 id="deleted-management-heading" className="mt-1 text-lg font-semibold text-[#24231f]">非表示にした共有情報</h2><p className="mt-1 text-xs leading-5 text-[#777166]">削除ではなく履歴を残して非表示にした情報を、PJ境界内で確認・復元するよ。</p></div>
        <button type="button" onClick={loadDeleted} className="min-h-11 rounded-lg border border-[#cfc7b9] px-4 py-2.5 text-xs font-semibold text-[#514e47] hover:bg-[#f8f5ec] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38745d]">{open ? "再読み込み" : "非表示の情報を確認"}</button>
      </div>
      {open && <div className="mt-4 border-t border-[#e4ddd0] pt-4" aria-live="polite">
        {loading && <p className="rounded-lg border border-dashed border-[#d6cebf] p-4 text-xs text-[#777166]">非表示情報を読み込み中…</p>}
        {error && <p className="rounded-lg border border-[#e4a39b] bg-[#f9e4e1] p-4 text-xs text-[#8c3329]" role="alert">{error}</p>}
        {!loading && !error && records.length === 0 && <p className="rounded-lg border border-dashed border-[#d6cebf] p-4 text-xs text-[#777166]">復元できる非表示情報はないよ。</p>}
        {!loading && records.length > 0 && <div className="space-y-2">{records.map((record) => <div key={`${record.resource}-${record.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#e4ddd0] bg-[#f8f5ec] p-3"><div><p className="text-xs font-semibold text-[#24231f]">{RESOURCE_LABELS[record.resource]} / {record.label}</p><p className="mt-1 text-[11px] text-[#777166]">非表示日時 {formatDate(record.deletedAt)}</p></div><button type="button" onClick={() => restore(record)} disabled={restoringId === record.id} className="min-h-11 rounded-md border border-[#38745d] px-3 py-2 text-[11px] font-semibold text-[#205f49] hover:bg-[#e8f2eb] disabled:cursor-wait disabled:opacity-60">{restoringId === record.id ? "復元中…" : "復元"}</button></div>)}</div>}
      </div>}
    </section>
  );
}

function Timeline({ management, selectedMilestoneId, onSelect }: { management: SxManagementBundle; selectedMilestoneId: string | null; onSelect: (milestoneId: string | null) => void }) {
  const months = management.horizonMonths;
  const sorted = [...management.milestones].sort((a, b) => a.track.localeCompare(b.track) || (a.plannedStart || "").localeCompare(b.plannedStart || ""));
  const spanFor = (milestone: SxManagementMilestone) => {
    const start = Math.max(0, months.findIndex((month) => month === (milestone.plannedStart || "").slice(0, 7)));
    const end = Math.max(start, months.findIndex((month) => month === (milestone.forecastEnd || milestone.plannedEnd || "").slice(0, 7)));
    return { start, span: Math.min(months.length - start, Math.max(1, end - start + 1)) };
  };
  return (
    <>
      <div className="hidden overflow-x-auto pb-2 lg:block">
        <div className="min-w-[1040px]">
          <div className="grid grid-cols-[220px_repeat(9,minmax(76px,1fr))] border-b border-[#d6cebf] bg-[#f8f5ec] text-[10px] font-semibold text-[#777166]">
            <div className="px-3 py-2">成果・ゲート</div>
            {months.map((month) => <div key={month} className="border-l border-[#e4ddd0] px-2 py-2 text-center">{formatMonth(month)}</div>)}
          </div>
          {sorted.map((milestone) => {
            const range = spanFor(milestone);
            const isSelected = selectedMilestoneId === milestone.id;
            return (
              <div key={milestone.id} className={`grid grid-cols-[220px_repeat(9,minmax(76px,1fr))] border-b border-[#eee9df] ${isSelected ? "bg-[#f5f2ea]" : ""}`}>
                <button type="button" aria-pressed={isSelected} aria-controls="selected-management-context" onClick={() => onSelect(isSelected ? null : milestone.id)} className="min-h-16 min-w-0 border-l-4 px-3 py-3 text-left hover:bg-[#f8f5ec] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#38745d]" style={{ borderLeftColor: management.tracks.find((track) => track.key === milestone.track)?.accent || "#315f7d" }}>
                  <span className="block truncate text-[10px] font-semibold text-[#777166]">{TRACK_LABELS[milestone.track]}</span>
                  <span className="mt-1 block text-xs font-semibold leading-4 text-[#24231f]">{nominalizeSxActionLabel(displayManagementText(milestone.title))}</span>
                </button>
                <div className="relative col-span-9 grid grid-cols-9 items-center">
                  {months.map((month) => <div key={month} className="h-full min-h-16 border-l border-[#eee9df]" />)}
                  <div className={`absolute top-1/2 h-7 -translate-y-1/2 rounded-md border px-2 text-[10px] font-semibold leading-6 shadow-[0_2px_8px_rgba(61,56,44,0.06)] ${STATUS_TONE[milestone.status] || STATUS_TONE.unassessed} ${milestone.dateCertainty === "provisional" ? "border-dashed" : ""}`} style={{ left: `${(range.start / months.length) * 100}%`, width: `${(range.span / months.length) * 100}%`, minWidth: "74px" }} title={`${nominalizeSxActionLabel(displayManagementText(milestone.title))} / ${formatDate(milestone.forecastEnd || milestone.plannedEnd)}`}>
                    <span className="block truncate">{milestone.status === "unassessed" ? "進捗未評価" : `${milestone.progressPct}%`} · {milestone.dateCertainty === "provisional" ? "仮置き" : "確定"}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="space-y-2 lg:hidden">
        {[...sorted].sort((a, b) => (a.forecastEnd || a.plannedEnd || "9999").localeCompare(b.forecastEnd || b.plannedEnd || "9999")).map((milestone) => (
          <button type="button" key={milestone.id} aria-pressed={selectedMilestoneId === milestone.id} aria-controls="selected-management-context" onClick={() => onSelect(selectedMilestoneId === milestone.id ? null : milestone.id)} className={`min-h-20 w-full rounded-lg border p-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#38745d] ${selectedMilestoneId === milestone.id ? "border-[#38745d] bg-[#f1f6f2]" : "border-[#d6cebf] bg-[#fffdf7]"}`}>
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-[10px] font-semibold text-[#777166]">{TRACK_LABELS[milestone.track]}</p><p className="mt-1 text-sm font-semibold leading-5 text-[#24231f]">{nominalizeSxActionLabel(displayManagementText(milestone.title))}</p></div>
              <Badge tone={STATUS_TONE[milestone.status] || STATUS_TONE.unassessed}>{statusLabel(milestone.status)}</Badge>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[#69665d]"><span>期限 {formatDate(milestone.forecastEnd || milestone.plannedEnd)}</span><span>{milestone.dateCertainty === "provisional" ? "仮置き" : "確定"}</span><span>{milestone.status === "unassessed" ? "進捗未評価" : `進捗 ${milestone.progressPct}%`}</span></div>
            <p className="mt-2 text-xs leading-5 text-[#777166]">次の成果: {nominalizeSxActionLabel(displayManagementText(milestone.nextDeliverable))}</p>
          </button>
        ))}
      </div>
    </>
  );
}

function EditAction({ canManage, label = "編集", onClick }: { canManage: boolean; label?: string; onClick: () => void }) {
  if (!canManage) return null;
  return <button type="button" onClick={onClick} className="inline-flex min-h-11 items-center gap-1 rounded-md border border-[#cfc7b9] px-3 py-2 text-[11px] font-semibold text-[#514e47] hover:bg-[#f8f5ec] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38745d]"><Pencil className="h-3.5 w-3.5" aria-hidden="true" />{label}</button>;
}

function ObjectiveKpiSection({ management, onEdit }: { management: SxManagementBundle; onEdit: (resource: ManagementResource, id: string) => void }) {
  return (
    <section className="rounded-xl border border-[#d6cebf] bg-[#fffdf7]/95 p-5 sm:p-6" aria-labelledby="objective-kpi-heading">
      <SectionHeader kicker="目的・成果・測定" title="目的から成果・測定値まで" description="経営目的 → 4本柱の成果 → KPI/先行指標 → マイルストーンを関連付け。未測定は空欄のまま見せ、状態の手入力で埋めないよ。" />
      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.5fr]">
          <div className="rounded-lg border border-[#c9bfd0] bg-[#f1edf3] p-4">
          <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-semibold tracking-[0.14em] text-[#5f4a66]">経営目的</p><h3 id="objective-kpi-heading" className="mt-1 text-base font-semibold text-[#24231f]">{management.objective?.title || "目的未登録"}</h3></div>{management.objective && <EditAction canManage={management.canManage} onClick={() => onEdit("objective", management.objective!.id)} />}</div>
          <p className="mt-3 text-xs leading-5 text-[#514e47]">{displayManagementText(management.objective?.definitionOfDone) || "目的の完了条件が未登録"}</p>
          <p className="mt-3 text-[11px] text-[#69665d]">設立目標 {formatDate(management.objective?.targetDate)} / {management.objective?.dateCertainty === "provisional" ? "仮置き" : "確定"} / 確度 {confidenceLabel(management.objective?.confidence)}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {management.outcomes.map((outcome) => {
            const outcomeKpis = management.kpis.filter((kpi) => kpi.outcomeId === outcome.id);
            return <div key={outcome.id} className="rounded-lg border border-[#e4ddd0] bg-[#f8f5ec] p-4"><div className="flex items-start justify-between gap-2"><div><p className="text-[10px] font-semibold text-[#38745d]">{TRACK_LABELS[outcome.track]}</p><h3 className="mt-1 text-sm font-semibold text-[#24231f]">{nominalizeSxActionLabel(displayManagementText(outcome.title))}</h3></div><div className="flex items-center gap-2"><Badge tone={outcome.confidence === "unknown" ? STATUS_TONE.unassessed : "border-[#d6cebf] bg-[#fffdf7] text-[#69665d]"}>確度 {confidenceLabel(outcome.confidence)}</Badge><EditAction canManage={management.canManage} onClick={() => onEdit("outcome", outcome.id)} /></div></div><p className="mt-2 text-[11px] leading-5 text-[#69665d]">{displayManagementText(outcome.definitionOfDone)}</p><p className="mt-2 text-[10px] text-[#8c3329]">KPI {outcomeKpis.length}件 / 担当 {outcome.ownerLabel}</p></div>;
          })}
        </div>
      </div>
      <div className="mt-5 hidden overflow-x-auto lg:block"><table className="w-full min-w-[1080px] border-collapse text-xs"><thead><tr className="border-y border-[#d6cebf] bg-[#f8f5ec] text-left text-[10px] font-semibold text-[#777166]"><th className="px-3 py-2.5">柱 / 指標</th><th className="px-3 py-2.5">基準値</th><th className="px-3 py-2.5">目標</th><th className="px-3 py-2.5">実績</th><th className="px-3 py-2.5">閾値ルール</th><th className="px-3 py-2.5">測定日 / 頻度</th><th className="px-3 py-2.5">根拠 / 確度</th><th className="px-3 py-2.5">操作</th></tr></thead><tbody>{management.kpis.map((kpi) => <tr key={kpi.id} className="border-b border-[#e4ddd0]"><td className="px-3 py-3"><span className="font-semibold text-[#24231f]">{TRACK_LABELS[kpi.track]}</span><span className="mt-1 block text-[11px]">{displayManagementText(kpi.title)}</span></td><td className="px-3 py-3">{kpi.baseline ?? "未測定"}</td><td className="px-3 py-3">{kpi.target ?? "未設定"}</td><td className="px-3 py-3 font-semibold">{kpi.actual ?? "未測定"}</td><td className="px-3 py-3">{kpi.thresholdRule === "lte" ? "≤" : kpi.thresholdRule === "between" ? "範囲" : "≥"} {kpi.threshold ?? "未設定"}{kpi.thresholdRule === "between" ? ` — ${kpi.thresholdUpper ?? "未設定"}` : ""} / {kpi.unit}</td><td className="px-3 py-3">{formatDate(kpi.measurementDate)} / {kpi.frequency}</td><td className="px-3 py-3">{displayManagementText(kpi.sourceLabel)} / {confidenceLabel(kpi.confidence)}</td><td className="px-3 py-3"><EditAction canManage={management.canManage} onClick={() => onEdit("kpi", kpi.id)} /></td></tr>)}</tbody></table></div>
      <div className="mt-5 space-y-3 lg:hidden">{management.kpis.map((kpi) => <article key={kpi.id} className="rounded-lg border border-[#e4ddd0] bg-[#f8f5ec] p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-semibold text-[#38745d]">{TRACK_LABELS[kpi.track]}</p><h3 className="mt-1 text-sm font-semibold">{displayManagementText(kpi.title)}</h3></div><EditAction canManage={management.canManage} onClick={() => onEdit("kpi", kpi.id)} /></div><dl className="mt-3 grid grid-cols-2 gap-2 text-[11px]"><div><dt className="text-[#777166]">目標</dt><dd className="font-semibold">{kpi.target ?? "未設定"}</dd></div><div><dt className="text-[#777166]">実績</dt><dd className="font-semibold">{kpi.actual ?? "未測定"}</dd></div><div><dt className="text-[#777166]">閾値</dt><dd>{kpi.thresholdRule === "lte" ? "以下" : kpi.thresholdRule === "between" ? "範囲内" : "以上"} {kpi.threshold ?? "未設定"}{kpi.thresholdRule === "between" ? ` — ${kpi.thresholdUpper ?? "未設定"}` : ""} {kpi.unit}</dd></div><div><dt className="text-[#777166]">測定日</dt><dd>{formatDate(kpi.measurementDate)}</dd></div></dl><p className="mt-3 text-[11px] text-[#69665d]">根拠 {displayManagementText(kpi.sourceLabel)} / 確度 {confidenceLabel(kpi.confidence)}</p></article>)}</div>
    </section>
  );
}

function MeasurementSection({ management, memberNames, onEdit }: { management: SxManagementBundle; memberNames: ReadonlyMap<string, string>; onEdit: (resource: ManagementResource, id: string) => void }) {
  return (
    <section className="rounded-xl border border-[#d6cebf] bg-[#fffdf7]/95 p-5 sm:p-6" aria-labelledby="measurement-heading">
      <SectionHeader kicker="測定・責任・約束" title="測定・資金・体制・約束の現在値" description="技術試験、資金スナップショット、必須役割、RACI、関係先の約束履歴を同じPJ台帳から確認するよ。" />
      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <div><h3 id="measurement-heading" className="text-sm font-semibold text-[#24231f]">技術試験</h3><div className="mt-3 hidden overflow-x-auto lg:block"><table className="w-full min-w-[900px] border-collapse text-xs"><thead><tr className="border-y border-[#d6cebf] bg-[#f8f5ec] text-left text-[10px] font-semibold text-[#777166]"><th className="px-3 py-2.5">試験</th><th className="px-3 py-2.5">条件</th><th className="px-3 py-2.5">目標 / 実績</th><th className="px-3 py-2.5">反復 / TRL</th><th className="px-3 py-2.5">状態 / 確認</th><th className="px-3 py-2.5">操作</th></tr></thead><tbody>{management.technicalTests.map((test) => <tr key={test.id} className="border-b border-[#e4ddd0]"><td className="px-3 py-3 font-semibold">{test.testName}</td><td className="px-3 py-3">{test.testCondition}</td><td className="px-3 py-3">{test.target ?? "未設定"} / {test.actual ?? "未測定"} {test.unit}</td><td className="px-3 py-3">{test.repetition ?? "未設定"}回 / {test.trlCriterion}</td><td className="px-3 py-3">{technicalStatusLabel(test.status)} / {formatDate(test.measuredOn)}</td><td className="px-3 py-3"><EditAction canManage={management.canManage} onClick={() => onEdit("technical_test", test.id)} /></td></tr>)}</tbody></table></div><div className="mt-3 space-y-3 lg:hidden">{management.technicalTests.map((test) => <article key={test.id} className="rounded-lg border border-[#e4ddd0] bg-[#f8f5ec] p-4"><div className="flex items-start justify-between gap-3"><div><h4 className="text-sm font-semibold">{test.testName}</h4><p className="mt-1 text-[11px] text-[#69665d]">{test.testCondition}</p></div><EditAction canManage={management.canManage} onClick={() => onEdit("technical_test", test.id)} /></div><p className="mt-3 text-xs">目標 {test.target ?? "未設定"} / 実績 {test.actual ?? "未測定"} {test.unit}</p><p className="mt-1 text-[11px] text-[#777166]">TRL {test.trlCriterion} / 状態 {technicalStatusLabel(test.status)} / {formatDate(test.measuredOn)} / 確度 {confidenceLabel(test.confidence)}</p></article>)}</div></div>
        <div className="space-y-5"><div><h3 className="text-sm font-semibold text-[#24231f]">資金スナップショット</h3>{management.fundingSnapshots.map((snapshot) => <article key={snapshot.id} className="mt-3 rounded-lg border border-[#e3c994] bg-[#fbf1dc] p-4"><div className="flex items-start justify-between gap-3"><p className="text-xs font-semibold text-[#765022]">{formatDate(snapshot.snapshotDate)} / 必要額・確保額・未確認額</p><EditAction canManage={management.canManage} onClick={() => onEdit("funding_snapshot", snapshot.id)} /></div><p className="mt-2 text-sm text-[#765022]">{snapshot.requiredAmount ?? "未確認"} / {snapshot.securedAmount ?? "未確認"} / {snapshot.unconfirmedAmount ?? "未確認"}</p><p className="mt-2 text-[11px] leading-5 text-[#765022]">{displayManagementText(snapshot.cashCondition)}</p><p className="mt-1 text-[10px] text-[#8b6e38]">資金残存月数 {snapshot.runwayMonths ?? "未確認"} / 確度 {confidenceLabel(snapshot.confidence)}</p></article>)}</div><div><h3 className="text-sm font-semibold text-[#24231f]">必須役割</h3><div className="mt-3 grid gap-3 sm:grid-cols-2">{management.organizationRoles.map((role) => <article key={role.id} className="rounded-lg border border-[#c9bfd0] bg-[#f1edf3] p-3"><div className="flex items-start justify-between gap-2"><p className="text-xs font-semibold text-[#5f4a66]">{role.roleName}</p><EditAction canManage={management.canManage} onClick={() => onEdit("organization_role", role.id)} /></div><p className="mt-2 text-[11px] text-[#5f4a66]">{role.candidate || "候補未確認"} / {roleStatusLabel(role.status)} / {role.vacancy ? "空席" : "充足"}</p><p className="mt-1 text-[10px] text-[#76637b]">期限 {formatDate(role.dueDate)} / 権限 {role.authority} / 確度 {confidenceLabel(role.confidence)}</p></article>)}</div></div></div>
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2"><div><h3 className="text-sm font-semibold text-[#24231f]">RACI / 人員容量</h3><div className="mt-3 space-y-2">{management.raci.map((item) => <div key={item.id} className="rounded-lg border border-[#c9bfd0] bg-[#f1edf3] p-3 text-xs"><div className="flex items-start justify-between gap-2"><span className="font-semibold text-[#5f4a66]">{item.responsibilityRole} / {item.stakeholderLabel}</span><EditAction canManage={management.canManage} onClick={() => onEdit("raci", item.id)} /></div><p className="mt-1 text-[#5f4a66]">担当 {item.ownerLabel} / {item.confirmed ? "確認済み" : "未確認"} / 確度 {confidenceLabel(item.confidence)}</p></div>)}{management.raci.length === 0 && <p className="rounded-lg border border-dashed border-[#d6cebf] p-4 text-xs text-[#777166]">RACIはまだ登録されてないよ。</p>}{management.capacity.map((capacity) => <div key={capacity.id} className="rounded-lg border border-[#e4ddd0] bg-[#f8f5ec] p-3 text-xs"><div className="flex items-start justify-between gap-2"><span className="font-semibold">{TRACK_LABELS[capacity.track]} / {capacity.roleLabel}</span><EditAction canManage={management.canManage} onClick={() => onEdit("capacity", capacity.id)} /></div><p className="mt-1 text-[#69665d]">必要 {capacity.requiredPeople}人 / 確認 {capacity.confirmedPeople}人 / 週 {capacity.plannedHoursWeek ?? "未確認"}h / {formatDate(capacity.measurementDate)}</p></div>)}</div></div><div><h3 className="text-sm font-semibold text-[#24231f]">更新監査</h3><div className="mt-3 space-y-2">{management.fieldAudit.slice(0, 6).map((audit) => <div key={audit.id} className="rounded-lg border border-[#e4ddd0] p-3 text-[11px]"><p className="font-semibold text-[#24231f]">{auditEntityLabel(audit.entityType)} / {auditFieldLabel(audit.fieldName)}</p><p className="mt-1 text-[#69665d]">{sourceLabel(audit.source)} / {displayActor(audit.verifiedBy, memberNames)} / 次回 {formatDate(audit.nextReviewOn)}</p></div>)}{management.fieldAudit.length === 0 && <p className="rounded-lg border border-dashed border-[#d6cebf] p-4 text-xs text-[#777166]">更新監査はまだないよ。</p>}</div></div></div>
    </section>
  );
}

function DecisionLoopSection({ management, memberNames, onEdit }: { management: SxManagementBundle; memberNames: ReadonlyMap<string, string>; onEdit: (resource: ManagementResource, id: string) => void }) {
  const actionStatus: Record<string, string> = { open: "未着手", in_progress: "進行中", completed: "完了", blocked: "停止" };
  const commitmentStatus: Record<string, string> = { open: "未着手", in_progress: "進行中", completed: "完了", blocked: "停止", cancelled: "取消" };
  return (
    <section className="rounded-xl border border-[#d6cebf] bg-[#fffdf7]/95 p-5 sm:p-6" aria-labelledby="decision-loop-heading">
      <SectionHeader kicker="判断→実行→確認" title="会議後更新から次週確認まで" description="決定理由・決定者・決定日を残し、アクションと関係先の約束を担当・期限・完了条件・次回確認まで閉じるよ。" />
      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <h3 id="decision-loop-heading" className="text-sm font-semibold text-[#24231f]">決定後アクション</h3>
          <div className="mt-3 space-y-3">
            {management.actions.map((action) => <article key={action.id} className="rounded-lg border border-[#e4ddd0] bg-[#f8f5ec] p-4"><div className="flex items-start justify-between gap-3"><div><Badge tone={action.status === "blocked" ? STATUS_TONE.blocked : action.status === "completed" ? STATUS_TONE.completed : STATUS_TONE.attention}>{actionStatus[action.status]}</Badge><h4 className="mt-2 text-sm font-semibold text-[#24231f]">{nominalizeSxActionLabel(sxNormalizePublicName(action.title))}</h4></div><EditAction canManage={management.canManage} onClick={() => onEdit("action", action.id)} /></div><dl className="mt-3 grid grid-cols-2 gap-2 text-[11px] leading-5"><div><dt className="text-[#777166]">担当</dt><dd className={action.ownerLabel.includes("未確認") ? "font-semibold text-[#8c3329]" : "text-[#514e47]"}>{sxNormalizePublicName(action.ownerLabel)}</dd></div><div><dt className="text-[#777166]">期限</dt><dd>{formatDate(action.dueDate)}</dd></div><div><dt className="text-[#777166]">次回確認</dt><dd>{formatDate(action.nextReviewOn)}</dd></div><div><dt className="text-[#777166]">完了日</dt><dd>{formatDate(action.completedAt)}</dd></div></dl><p className="mt-3 border-t border-[#e4ddd0] pt-2 text-[11px] leading-5 text-[#69665d]">完了条件: {action.completionCriteria ? sxNormalizePublicName(action.completionCriteria) : "未登録"}</p>{action.completionNote && <p className="mt-1 text-[11px] leading-5 text-[#205f49]">完了証跡: {sxNormalizePublicName(action.completionNote)}</p>}</article>)}
            {management.actions.length === 0 && <p className="rounded-lg border border-dashed border-[#d6cebf] p-4 text-xs text-[#777166]">決定後アクションはまだ登録されてないよ。</p>}
          </div>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-[#24231f]">関係先との約束</h3>
          {([["counterparty_promise", "相手の約束"], ["sx_followup", "SX側の次アクション"]] as Array<["counterparty_promise" | "sx_followup", string]>).map(([kind, heading]) => {
            const commitments = management.partnerCommitments.filter((commitment) => commitment.commitmentKind === kind);
            return <div key={kind} className="mt-3"><div className="flex items-center justify-between gap-2"><h4 className="text-xs font-semibold text-[#24231f]">{heading}</h4>{management.canManage && commitments[0] && <EditAction canManage={management.canManage} onClick={() => onEdit("commitment", commitments[0].id)} />}</div><div className="mt-2 space-y-3">{commitments.map((commitment) => { const partner = management.partners.find((item) => item.id === commitment.partnerId); return <article key={commitment.id} className="rounded-lg border border-[#e4ddd0] bg-[#f8f5ec] p-4"><div className="flex items-start justify-between gap-3"><div><Badge tone={commitment.status === "blocked" ? STATUS_TONE.blocked : commitment.status === "completed" ? STATUS_TONE.completed : STATUS_TONE.attention}>{commitmentStatus[commitment.status]}</Badge><h4 className="mt-2 text-sm font-semibold text-[#24231f]">{nominalizeSxActionLabel(sxNormalizePublicName(commitment.title))}</h4><p className="mt-1 text-[11px] text-[#777166]">{partner?.name || "機関未確認"}</p></div><EditAction canManage={management.canManage} onClick={() => onEdit("commitment", commitment.id)} /></div><dl className="mt-3 grid grid-cols-2 gap-2 text-[11px] leading-5">{kind === "counterparty_promise" && <div><dt className="text-[#777166]">相手担当</dt><dd>{commitment.counterpartyOwner ? sxNormalizePublicName(commitment.counterpartyOwner) : "未確認"}</dd></div>}<div><dt className="text-[#777166]">{kind === "counterparty_promise" ? "約束日" : "SX担当"}</dt><dd>{kind === "counterparty_promise" ? formatDate(commitment.promisedOn) : (commitment.sxOwner ? sxNormalizePublicName(commitment.sxOwner) : "未確認")}</dd></div><div><dt className="text-[#777166]">期限</dt><dd>{formatDate(commitment.dueDate)}</dd></div><div><dt className="text-[#777166]">次回確認</dt><dd>{formatDate(commitment.nextReviewOn)}</dd></div></dl><p className="mt-3 text-[11px] leading-5 text-[#69665d]">{sxNormalizePublicName(commitment.commitmentText)}</p>{kind === "counterparty_promise" && commitment.evidence && <p className="mt-1 text-[11px] text-[#205f49]">一次根拠: {sxNormalizePublicName(commitment.evidence)}</p>}</article>; })}{commitments.length === 0 && <p className="rounded-lg border border-dashed border-[#d6cebf] p-4 text-xs text-[#777166]">この分類の記録はまだないよ。</p>}</div></div>;
          })}
        </div>
      </div>
      <div className="mt-5 border-t border-[#e4ddd0] pt-4"><h3 className="text-sm font-semibold text-[#24231f]">更新履歴</h3><div className="mt-3 grid gap-2 md:grid-cols-2">{management.history.slice(0, 8).map((item) => <div key={item.id} className="rounded-lg border border-[#e4ddd0] p-3 text-[11px]"><p className="font-semibold text-[#24231f]">{item.summary}</p><p className="mt-1 text-[#777166]">{auditEntityLabel(item.entityType)} / {formatDate(item.changedOn)} / {displayActor(item.changedBy, memberNames)}</p></div>)}</div>{management.history.length === 0 && <p className="mt-3 rounded-lg border border-dashed border-[#d6cebf] p-4 text-xs text-[#777166]">更新履歴はまだないよ。</p>}</div>
    </section>
  );
}

/**
 * ゲート詳細モーダル。タイムラインの行クリックで開く。旧実装はページ下部の
 * `#selected-management-context` へスクロールしていたが、図から視線が飛ぶためモーダルへ移した。
 * 中身は既存の SelectedMilestoneContext をそのまま使い、編集導線（ゲート編集 / 論点追加）も維持する。
 */
function MilestoneDetailModal({ milestone, milestoneLabelMap, issues, partners, canManage, onEdit, onCreate, onClose }: {
  milestone: SxManagementMilestone;
  milestoneLabelMap: ReadonlyMap<string, string>;
  issues: SxManagementIssue[];
  partners: SxManagementPartner[];
  canManage: boolean;
  onEdit: (resource: ManagementResource, id: string) => void;
  onCreate: (resource: ManagementResource, initialValues?: Record<string, string>) => void;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    closeRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end bg-[#24231f]/35 p-0 sm:place-items-center sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label={`${nominalizeSxActionLabel(displayManagementText(milestone.title))}の詳細`}
      data-testid="sx-milestone-detail-modal"
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-[#d6cebf] bg-[#fffdf7] p-5 shadow-[0_24px_80px_rgba(61,56,44,0.22)] sm:max-w-4xl sm:rounded-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4 border-b border-[#e4ddd0] pb-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold tracking-[0.16em] text-[#38745d]">ゲート詳細</p>
            <h2 className="mt-1 text-lg font-semibold text-[#24231f]">{nominalizeSxActionLabel(displayManagementText(milestone.title))}</h2>
            <p className="mt-1 text-[11px] text-[#69665d]">予定 {formatDate(milestone.plannedEnd)} / 予測 {formatDate(milestone.forecastEnd)} / {milestone.dateCertainty === "provisional" ? "仮日程" : "確定日程"} / 担当 {milestone.ownerLabel}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {canManage && <EditAction canManage={canManage} label="日程・担当を編集" onClick={() => onEdit("milestone", milestone.id)} />}
            <button ref={closeRef} type="button" onClick={onClose} className="min-h-11 rounded-md border border-[#d6cebf] px-3 py-2 text-xs font-semibold text-[#69665d] hover:bg-[#f8f5ec] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38745d]">閉じる</button>
          </div>
        </div>
        {milestone.forecastChangeReason && (
          <p className="mt-3 rounded-md border border-[#e4ddd0] bg-[#f8f5ec] px-3 py-2 text-[11px] leading-5 text-[#69665d]">予測日の根拠: {displayManagementText(milestone.forecastChangeReason)}</p>
        )}
        <SelectedMilestoneContext milestone={milestone} milestoneLabelMap={milestoneLabelMap} issues={issues} partners={partners} canManage={canManage} onEdit={onEdit} onCreate={onCreate} />
      </div>
    </div>
  );
}

function SelectedMilestoneContext({ milestone: rawMilestone, milestoneLabelMap, issues, partners, canManage, onEdit, onCreate }: { milestone: SxManagementMilestone; milestoneLabelMap: ReadonlyMap<string, string>; issues: SxManagementIssue[]; partners: SxManagementPartner[]; canManage: boolean; onEdit: (resource: ManagementResource, id: string) => void; onCreate: (resource: ManagementResource, initialValues?: Record<string, string>) => void }) {
  const evidenceKind: Record<string, string> = { supporting: "根拠", counter: "反証", missing: "不足", observation: "観測" };
  const validationStatus: Record<string, string> = { planned: "計画", running: "実施中", completed: "完了", blocked: "停止", cancelled: "取消" };
  const actionStatus: Record<string, string> = { open: "未着手", in_progress: "進行中", completed: "完了", blocked: "停止" };
  const commitmentStatus: Record<string, string> = { open: "未着手", in_progress: "進行中", completed: "完了", blocked: "停止", cancelled: "取消" };
  const milestone = { ...rawMilestone, title: nominalizeSxActionLabel(displayManagementText(rawMilestone.title)), nextDeliverable: nominalizeSxActionLabel(displayManagementText(rawMilestone.nextDeliverable)), maxIssue: displayManagementText(rawMilestone.maxIssue), completionCriteria: displayManagementText(rawMilestone.completionCriteria) };
  const dependencyLabels = milestoneLabels(milestone.dependencySlugs, milestoneLabelMap);
  return (
    <div id="selected-management-context" className="mt-4 rounded-lg border border-[#9fc6b4] bg-[#f1f6f2] p-4 text-xs text-[#514e47]" tabIndex={-1} aria-label="選択中の経営文脈">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-semibold tracking-[0.14em] text-[#38745d]">選択中の経営文脈</p><h3 className="mt-1 text-sm font-semibold text-[#24231f]">{displayManagementText(milestone.title)}</h3><p className="mt-1 text-[11px] text-[#69665d]">担当 {milestone.ownerLabel} / 計算した状態 {statusLabel(milestone.derivedStatus)} / 確認 {formatDate(milestone.lastVerifiedAt)} / 確度 {confidenceLabel(milestone.confidence)}</p></div><div className="flex flex-wrap items-center gap-2"><span className="text-[10px] text-[#777166]">依存 {milestone.dependencySlugs.length}件 / KPI {milestone.linkedKpiIds.length}件</span>{canManage && <><EditAction canManage={canManage} label="ゲートを編集" onClick={() => onEdit("milestone", milestone.id)} /><button type="button" onClick={() => onCreate("issue", { milestone_id: milestone.id, outcome_id: milestone.outcomeId, track: milestone.track })} className="min-h-11 rounded-md border border-[#38745d] px-3 py-2 text-[11px] font-semibold text-[#205f49] hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38745d]">このゲートに論点を追加</button></>}</div></div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_1fr_0.9fr]">
        <div className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-semibold">論点 → 仮説 → 根拠 → 検証 → 判断</h4>{canManage && <button type="button" onClick={() => onCreate("issue", { milestone_id: milestone.id, outcome_id: milestone.outcomeId, track: milestone.track })} className="min-h-11 rounded-md border border-[#cfc7b9] px-3 py-2 text-[11px] font-semibold">論点を追加</button>}</div>{issues.length === 0 && <p className="rounded-lg border border-dashed border-[#b7c8d2] p-3 text-[11px]">関連論点未登録</p>}{issues.map((issue) => <article key={issue.id} className="rounded-lg border border-[#c9d9cf] bg-[#fffdf7] p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex flex-wrap items-center gap-2"><Badge tone={issue.knowledgeType === "fact" ? "border-[#b7c8d2] bg-[#eef3f5] text-[#315f7d]" : issue.knowledgeType === "decision_needed" ? "border-[#e3c994] bg-[#fbf1dc] text-[#765022]" : "border-[#c9bfd0] bg-[#f1edf3] text-[#5f4a66]"}>{ISSUE_KIND_LABELS[issue.knowledgeType]}</Badge><span className="font-semibold text-[#24231f]">{issue.title}</span></div>{canManage && <EditAction canManage={canManage} onClick={() => onEdit("issue", issue.id)} />}</div><p className="mt-2 leading-5">現在の仮説: {issue.hypothesis}</p><p className="mt-2 text-[11px] text-[#69665d]">担当 {issue.ownerLabel} / 期限 {formatDate(issue.dueDate)} / 確認 {formatDate(issue.lastVerifiedAt)} / 状態 {statusLabel(issue.status)} / 確度 {confidenceLabel(issue.confidence)}</p><div className="mt-3 space-y-2 border-t border-[#e4ddd0] pt-3"><div className="flex items-center justify-between gap-2"><p className="font-semibold">仮説 {issue.hypotheses.length}件</p>{canManage && <button type="button" onClick={() => onCreate("hypothesis", { issue_id: issue.id })} className="min-h-11 rounded-md border border-[#cfc7b9] px-2.5 py-2 text-[10px] font-semibold">仮説を追加</button>}</div>{issue.hypotheses.map((hypothesis) => <div key={hypothesis.id} className="rounded-md bg-[#f8f5ec] p-2.5"><div className="flex items-start justify-between gap-2"><p className="leading-5">{hypothesis.statement}</p>{canManage && <EditAction canManage={canManage} onClick={() => onEdit("hypothesis", hypothesis.id)} />}</div><p className="mt-1 text-[10px] text-[#777166]">{hypothesisStatusLabel(hypothesis.status)} / {hypothesis.ownerLabel} / 期限 {formatDate(hypothesis.dueDate)} / 確度 {confidenceLabel(hypothesis.confidence)} / 確認 {formatDate(hypothesis.lastVerifiedAt)}</p></div>)}{issue.hypotheses.length === 0 && <p className="text-[11px] text-[#8c3329]">仮説未登録</p>}</div><div className="mt-3 space-y-2 border-t border-[#e4ddd0] pt-3"><div className="flex items-center justify-between gap-2"><p className="font-semibold">根拠・反証・不足 {issue.evidence.length}件</p>{canManage && <button type="button" onClick={() => onCreate("evidence", { issue_id: issue.id, hypothesis_id: issue.hypotheses[0]?.id || "" })} className="min-h-11 rounded-md border border-[#cfc7b9] px-2.5 py-2 text-[10px] font-semibold">根拠を追加</button>}</div>{issue.evidence.map((evidence) => <div key={evidence.id} className="rounded-md bg-[#f8f5ec] p-2.5"><div className="flex items-start justify-between gap-2"><p><span className="font-semibold">{evidenceKind[evidence.kind] || "未確認"}</span> {evidence.summary}</p>{canManage && <EditAction canManage={canManage} onClick={() => onEdit("evidence", evidence.id)} />}</div><p className="mt-1 text-[10px] text-[#777166]">{evidence.sourceLabel} / {formatDate(evidence.observedOn)} / 確度 {confidenceLabel(evidence.confidence)} / 確認 {formatDate(evidence.lastVerifiedAt)}</p></div>)}{issue.evidence.length === 0 && <p className="text-[11px] text-[#8c3329]">根拠未登録</p>}</div><div className="mt-3 space-y-2 border-t border-[#e4ddd0] pt-3"><div className="flex items-center justify-between gap-2"><p className="font-semibold">次の検証 {issue.validationRuns.length}件</p>{canManage && <button type="button" onClick={() => onCreate("validation", { hypothesis_id: issue.hypotheses[0]?.id || "" })} className="min-h-11 rounded-md border border-[#cfc7b9] px-2.5 py-2 text-[10px] font-semibold">検証を追加</button>}</div>{issue.validationRuns.map((run) => <div key={run.id} className="rounded-md bg-[#f8f5ec] p-2.5"><div className="flex items-start justify-between gap-2"><p><Badge tone={run.status === "blocked" ? STATUS_TONE.blocked : "border-[#b7c8d2] bg-[#eef3f5] text-[#315f7d]"}>{validationStatus[run.status] || "未確認"}</Badge> <span className="ml-1">{run.method}</span></p>{canManage && <EditAction canManage={canManage} onClick={() => onEdit("validation", run.id)} />}</div><p className="mt-1 text-[10px] text-[#777166]">担当 {run.ownerLabel} / 期限 {formatDate(run.dueDate)} / 確度 {confidenceLabel(run.confidence)}{run.resultSummary ? ` / 結果 ${run.resultSummary}` : ""}</p></div>)}{issue.validationRuns.length === 0 && <p className="text-[11px] text-[#8c3329]">検証予定未登録</p>}</div><div className="mt-3 space-y-2 border-t border-[#e4ddd0] pt-3"><div className="flex items-center justify-between gap-2"><p className="font-semibold">意思決定 {issue.decisions.length}件</p>{canManage && <button type="button" onClick={() => onCreate("decision", { issue_id: issue.id })} className="min-h-11 rounded-md border border-[#cfc7b9] px-2.5 py-2 text-[10px] font-semibold">判断を追加</button>}</div>{issue.decisions.map((decision) => <div key={decision.id} className="rounded-md bg-[#f8f5ec] p-2.5"><div className="flex items-start justify-between gap-2"><p>{decision.status === "decided" ? "決定済み" : decision.status === "deferred" ? "保留" : "意思決定待ち"} / {nominalizeSxActionLabel(decision.title)}</p>{canManage && <EditAction canManage={canManage} onClick={() => onEdit("decision", decision.id)} />}</div><p className="mt-1 text-[10px] text-[#777166]">理由 {decision.rationale} / 決定者 {decision.decidedBy || "未確認"} / 決定日 {formatDate(decision.decidedOn)}</p>{decision.actionItems.map((action) => <div key={action.id} className="mt-1 flex items-center justify-between gap-2 border-l-2 border-[#bf7b2c] pl-2 text-[10px]"><p>次アクション: {nominalizeSxActionLabel(action.title)} / {actionStatus[action.status]} / {action.ownerLabel} / {formatDate(action.dueDate)} / 次回 {formatDate(action.nextReviewOn)}</p>{canManage && <EditAction canManage={canManage} onClick={() => onEdit("action", action.id)} />}</div>)}</div>)}{issue.decisions.length === 0 && <p className="text-[11px] text-[#8c3329]">意思決定未登録</p>}</div></article>)}</div>
        <div className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-semibold">関係先・約束</h4>{canManage && <><EditAction canManage={canManage} onClick={() => onEdit("partner", partners[0]?.id || "")} />{partners[0] && <button type="button" onClick={() => onCreate("commitment", { partner_id: partners[0].id })} className="min-h-11 rounded-md border border-[#cfc7b9] px-3 py-2 text-[11px] font-semibold">約束を追加</button>}</>}</div>{partners.length === 0 && <p className="rounded-lg border border-dashed border-[#b7c8d2] p-3 text-[11px]">関連機関未登録</p>}{partners.map((partner) => { const display = sxPartnerDisplay(partner); return <article key={partner.id} className={`rounded-lg border bg-[#fffdf7] p-3 ${display.lowPriority ? "border-[#d6cebf] opacity-75" : "border-[#c9d9cf]"}`}><div className="flex items-start justify-between gap-2"><p className="font-semibold text-[#24231f]">{display.name}{display.lowPriority && <span className="ml-2 text-[9px] font-semibold text-[#777166]">優先度低・保留</span>}</p>{canManage && <EditAction canManage={canManage} onClick={() => onEdit("partner", partner.id)} />}</div><p className="mt-1 text-[11px]">{display.lowPriority ? "補助候補（重要経路外）" : sxNormalizePublicName(partner.roleLabel)} / {display.lowPriority ? "保留" : PARTNER_STAGE_LABELS[partner.relationshipStage]} / {partner.agreementState === "agreed" ? "合意済み" : partner.agreementState === "partial" ? "一部合意" : "未合意"}</p><p className="mt-1 text-[11px]">担当 {sxNormalizePublicName(partner.ownerLabel)} / 期限 {formatDate(partner.dueDate)} / 接点 {formatDate(partner.lastContactDate)} / 確度 {confidenceLabel(partner.confidence)}</p><p className="mt-2 leading-5">合意済み: {sxNormalizePublicName(partner.agreedScope)}</p><p className="mt-1 leading-5 text-[#8c3329]">未合意: {sxNormalizePublicName(partner.unagreedScope)}</p><div className="mt-3 space-y-2 border-t border-[#e4ddd0] pt-3">{partner.commitments.map((commitment) => <div key={commitment.id} className="rounded-md bg-[#f8f5ec] p-2.5"><div className="flex items-start justify-between gap-2"><p>{commitmentStatus[commitment.status]} / {commitment.commitmentKind === "counterparty_promise" ? "相手の約束" : "SX側の次アクション"} / {nominalizeSxActionLabel(sxNormalizePublicName(commitment.title))}</p>{canManage && <EditAction canManage={canManage} onClick={() => onEdit("commitment", commitment.id)} />}</div><p className="mt-1 text-[10px] text-[#777166]">{commitment.commitmentKind === "counterparty_promise" ? `相手 ${commitment.counterpartyOwner ? sxNormalizePublicName(commitment.counterpartyOwner) : "未確認"} / 約束日 ${formatDate(commitment.promisedOn)}` : `SX ${commitment.sxOwner ? sxNormalizePublicName(commitment.sxOwner) : "未確認"}`} / 期限 {formatDate(commitment.dueDate)} / 次回 {formatDate(commitment.nextReviewOn)} / 確度 {confidenceLabel(commitment.confidence)}</p><p className="mt-1 text-[11px] leading-5">{sxNormalizePublicName(commitment.commitmentText)}</p>{commitment.commitmentKind === "counterparty_promise" && commitment.evidence && <p className="mt-1 text-[10px] text-[#205f49]">一次根拠: {sxNormalizePublicName(commitment.evidence)}</p>}</div>)}{partner.commitments.length === 0 && <p className="text-[11px] text-[#8c3329]">約束履歴未登録</p>}</div></article>; })}</div>
        <div className="space-y-3"><h4 className="font-semibold text-[#24231f]">前提・依存</h4><div className="rounded-lg border border-[#c9d9cf] bg-[#fffdf7] p-3"><p className="leading-5">{dependencyLabels.join(" / ") || "依存先なし"}</p><p className="mt-2 font-semibold">{milestone.isBlocked ? "停止" : milestone.reasonCodes.includes("dependency_waiting") ? "依存待ち" : "接続確認済み"}</p><p className="mt-1 text-[11px] text-[#777166]">前任 {milestone.predecessorIds.length}件 / 後続 {milestone.successorIds.length}件 / 完了条件 {milestone.completionCriteria}</p></div><div className="rounded-lg border border-[#c9d9cf] bg-[#fffdf7] p-3"><p className="font-semibold text-[#24231f]">このゲートの次の成果</p><p className="mt-1 leading-5">{milestone.nextDeliverable}</p><p className="mt-2 text-[11px] text-[#8c3329]">最大論点: {milestone.maxIssue}</p><p className="mt-1 text-[11px] text-[#777166]">予定 {formatDate(milestone.plannedEnd)} / 予測 {formatDate(milestone.forecastEnd)} / 差分 {milestone.deltaDays == null ? "未算定" : `${milestone.deltaDays}日`} / {milestone.dateCertainty === "provisional" ? "仮置き" : "確定"}</p></div></div>
      </div>
    </div>
  );
}

export function ProjectWorkspaceDashboard({ bundle, access }: { bundle: ProjectWorkspaceBundle; access: SharedWorkspaceAccess }) {
  const [workspace, setWorkspace] = useState(bundle);
  const [selectedTrack, setSelectedTrack] = useState<SxTrackKey | null>(null);
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ resource: ManagementResource; id: string } | null>(null);
  const [creating, setCreating] = useState<{ resource: ManagementResource; initialValues?: Record<string, string> } | null>(null);
  const [activeSection, setActiveSection] = useState("management-summary");
  const [milestoneDetailId, setMilestoneDetailId] = useState<string | null>(null);
  const [workspaceNotice, setWorkspaceNotice] = useState<string | null>(null);
  const management = workspace.sxManagement;
  const memberNames = useMemo(() => new Map(workspace.members.map((member) => [member.memberId, member.displayName])), [workspace.members]);
  const milestoneLabelMap = useMemo(() => buildMilestoneLabelMap(management.milestones), [management.milestones]);
  const editRecord = editing ? recordFor(management, editing.resource, editing.id) : undefined;
  const visibleIssues = selectedTrack ? management.issues.filter((issue) => issue.track === selectedTrack) : management.issues;
  const visiblePartners = selectedTrack ? management.partners.filter((partner) => partner.track === selectedTrack) : management.partners;
  const maxEvidence = Math.max(1, ...workspace.evidenceByMonth.map((item) => item.count));
  const visibleTrend = workspace.weeklyTrend.slice(-6);
  const maxTrend = Math.max(1, ...visibleTrend.flatMap((item) => [item.plannedHours, item.actualHours]));
  const selectedLabel = selectedTrack ? TRACK_LABELS[selectedTrack] : "全体";
  const selectedMilestone = selectedMilestoneId ? management.milestones.find((milestone) => milestone.id === selectedMilestoneId) || null : null;
  const milestoneDetail = milestoneDetailId ? management.milestones.find((milestone) => milestone.id === milestoneDetailId) || null : null;
  const projectId = workspace.project.projectId;

  // タイムライン行クリック: 下方向スクロールではなくモーダルで詳細を開く（選択状態は既存どおり保つ）。
  function openMilestoneDetail(nextMilestoneId: string | null) {
    selectMilestoneAndTrack(nextMilestoneId);
    setMilestoneDetailId(nextMilestoneId);
  }
  function selectMilestoneAndTrack(nextMilestoneId: string | null) {
    setSelectedMilestoneId(nextMilestoneId);
    setSelectedTrack(nextMilestoneId ? management.milestones.find((item) => item.id === nextMilestoneId)?.track || null : null);
  }

  const issueGroups = useMemo(() => ({
    fact: visibleIssues.filter((issue) => issue.knowledgeType === "fact").length,
    hypothesis: visibleIssues.filter((issue) => issue.knowledgeType === "hypothesis").length,
    decisionNeeded: visibleIssues.filter((issue) => issue.decisions.some((decision) => decision.status !== "decided") || issue.knowledgeType === "decision_needed").length,
    decided: visibleIssues.reduce((sum, issue) => sum + issue.decisions.filter((decision) => decision.status === "decided").length, 0),
  }), [visibleIssues]);
  const importantMilestones = management.milestones.filter((milestone) => milestone.criticality === "critical" || milestone.criticality === "high");
  const gateMissing = importantMilestones.length === 0 ? 1 : importantMilestones.filter((milestone) => !milestone.ownerLabel.trim() || milestone.ownerLabel.includes("未確認") || !milestone.plannedEnd || !milestone.completionCriteria.trim()).length;
  const kpiMissing = management.kpis.length === 0 ? 1 : management.kpis.filter((kpi) => kpi.actual == null || !kpi.measurementDate).length;
  const technicalMissing = management.technicalTests.length === 0 ? 1 : management.technicalTests.filter((test) => test.actual == null || !test.measuredOn).length;
  const fundingMissing = management.fundingSnapshots.length === 0 ? 1 : management.fundingSnapshots.reduce((sum, snapshot) => sum + [snapshot.requiredAmount, snapshot.securedAmount, snapshot.cashCondition].filter((value) => value == null || value === "").length, 0);
  const roleMissing = management.organizationRoles.length === 0 ? 1 : management.organizationRoles.filter((role) => role.required && (role.vacancy || !role.dueDate)).length;
  const researchTeamConfirmed = management.organizationRoles.some((role) => /研究/.test(role.roleName) && !role.vacancy && role.candidate);
  const operationChecks = [
    { label: "重要ゲートの担当・期限・完了条件確認", missing: gateMissing },
    { label: "重要KPI・技術試験の実測", missing: kpiMissing + technicalMissing },
    { label: "資金必要額・確保額・着金条件", missing: fundingMissing },
    { label: "必須役割・研究側メンバー", missing: roleMissing + (researchTeamConfirmed ? 0 : 1) },
  ];
  const operationReady = operationChecks.every((check) => check.missing === 0);
  const effectiveJudgment = operationReady ? management.judgment : {
    ...management.judgment,
    key: "unassessed" as const,
    label: "未評価" as const,
    reasons: ["運用準備が未完了", ...management.judgment.reasons].slice(0, 3),
  };

  useEffect(() => {
    const sectionIds = ["management-summary", "management-plan", "management-proof", "management-issues", "management-partners", "management-capacity"];
    const sections = sectionIds.map((id) => document.getElementById(id)).filter((section): section is HTMLElement => Boolean(section));
    if (sections.length === 0) return;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top)[0];
      if (visible?.target instanceof HTMLElement) setActiveSection(visible.target.id);
    }, { rootMargin: "-18% 0px -68% 0px", threshold: [0, 0.1, 0.5] });
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!selectedMilestoneId) return;
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement || activeElement instanceof HTMLSelectElement || (activeElement instanceof HTMLElement && activeElement.isContentEditable)) return;
    return () => undefined;
  }, [selectedMilestoneId]);
  const managementNavItems: Array<[string, string]> = [["management-summary", "経営サマリー"], ["management-plan", "計画詳細"], ["management-proof", "技術証明"], ["management-issues", "論点・仮説"], ["management-partners", "関係先"], ["management-capacity", "実行・体制"]];

  return (
    <div className="amd-desk-page-skin sx-management-workspace w-full min-w-0 max-w-full min-h-screen overflow-x-clip px-3 py-4 sm:px-5 lg:px-8 lg:py-7">
      <div className="mx-auto min-w-0 max-w-[1480px] space-y-4">
        <header className="border-b border-[#cfc7b9] pb-2">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px] text-[#777166]">
            <Badge tone="border-[#9fc6b4] bg-[#e8f2eb] text-[#205f49]"><ShieldCheck className="mr-1 h-3.5 w-3.5" aria-hidden="true" />SX / COO共有</Badge>
            <Badge tone="border-[#d6cebf] bg-[#fffdf7] text-[#69665d]">{access.scope === "project" ? "参加PJ限定" : "AMD管理ビュー"}</Badge>
            <span>基準日 {formatDate(management.asOf)}</span>
            {effectiveJudgment.lastVerifiedAt && <span>データ最終確認 {formatDate(effectiveJudgment.lastVerifiedAt)}</span>}
          </div>
          <div className="mt-1.5 min-w-0 lg:grid lg:grid-cols-[300px_minmax(0,1fr)] lg:items-baseline lg:gap-5">
            <h1 className="text-xl font-semibold tracking-tight text-[#24231f] sm:text-2xl">経営航路 <span className="text-[#777166]">/ {workspace.project.projectName}</span></h1>
            <p className="mt-1 text-xs leading-5 text-[#69665d] lg:mt-0">{horizonPeriodLabel(management.horizonMonths)}の設立まで、4本柱・開発テーマ・論点・関係先を同じ時間軸で管制する。</p>
          </div>
        </header>
        {workspaceNotice && <p role="status" aria-live="polite" className="border border-[#9fc6b4] bg-[#e8f2eb] px-3 py-2 text-xs text-[#205f49]">{workspaceNotice}</p>}

        <div className="lg:grid lg:grid-cols-[152px_minmax(0,1fr)] lg:items-start lg:gap-5">
        <nav className="sticky top-0 z-20 mb-4 flex max-w-full flex-nowrap gap-1 overflow-x-auto border-y border-[#d6cebf] bg-[#fffdf7]/95 p-1 backdrop-blur lg:sticky lg:top-4 lg:mb-0 lg:flex-col lg:border-y-0 lg:border-r lg:overflow-x-visible lg:bg-transparent lg:p-0 lg:pr-3" aria-label="経営診断ナビ">
          {managementNavItems.map(([id, label]) => <a key={id} href={`#${id}`} aria-current={activeSection === id ? "page" : undefined} onClick={() => setActiveSection(id)} className={`min-h-[44px] w-auto shrink-0 whitespace-nowrap px-3 py-2 text-center text-[11px] font-semibold hover:bg-[#f8f5ec] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38745d] lg:w-full lg:text-left lg:border-l-[3px] ${activeSection === id ? "bg-[#e8f2eb] text-[#205f49] lg:border-l-[#205f49]" : "text-[#514e47] lg:border-l-transparent"}`}>{label}</a>)}
        </nav>

        <main className="min-w-0 space-y-4">

        <section id="management-summary" className="scroll-mt-20" aria-label="経営状況図: 判定・統合タイムライン・次の経営介入">
          <h2 className="sr-only">判定・統合タイムライン・意思決定待ち・次の経営介入を一続きで表示する経営状況図</h2>
          <div className="min-w-0">
            <SxExecutiveControlDeck management={management} judgment={effectiveJudgment} selectedMilestoneId={selectedMilestoneId} onSelectMilestone={openMilestoneDetail} onEditMilestone={(id) => setEditing({ resource: "milestone", id })} onCreateMilestone={(prefill) => {
              const outcome = prefill.outcomeId
                ? management.outcomes.find((item) => item.id === prefill.outcomeId)
                : undefined;
              setCreating({
                resource: "milestone",
                initialValues: {
                  ...(prefill.timelineKind ? { timeline_kind: prefill.timelineKind } : {}),
                  ...(prefill.plannedDate ? { planned_start: prefill.plannedDate, planned_end: prefill.plannedDate } : {}),
                  ...(prefill.outcomeId ? { outcome_id: prefill.outcomeId } : {}),
                  ...(outcome?.objectiveId ? { objective_id: outcome.objectiveId } : {}),
                  ...(prefill.track || outcome?.track ? { track: prefill.track || outcome!.track } : {}),
                },
              });
            }} />
          </div>
        </section>

        <section id="management-plan" tabIndex={-1} className="scroll-mt-20" aria-label="計画詳細">
          {management.hasData && (
            <details className="rounded-lg border border-[#e4ddd0] bg-[#fffdf7] p-3">
              <summary className="flex min-h-11 cursor-pointer select-none items-center text-xs font-semibold text-[#514e47] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38745d]">全マイルストーン詳細表を表示（完了条件・依存・日程未登録分を含む）</summary>
              <div className="mt-3">
                {management.canManage && (
                  <div className="mb-3 flex flex-wrap items-center gap-2" data-testid="sx-plan-manual-edit">
                    <span className="text-[11px] text-[#69665d]">図とこの表のデータは手動で追加・修正できる。</span>
                    <button type="button" onClick={() => setCreating({ resource: "milestone" })} className="min-h-11 rounded-md border border-[#38745d] px-3 py-2 text-[11px] font-semibold text-[#205f49] hover:bg-[#e8f2eb] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38745d]">マイルストーンを追加</button>
                    <button type="button" onClick={() => setCreating({ resource: "dependency" })} className="min-h-11 rounded-md border border-[#cfc7b9] px-3 py-2 text-[11px] font-semibold text-[#514e47] hover:bg-[#f8f5ec] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38745d]">依存関係を追加</button>
                    {selectedMilestone && <button type="button" onClick={() => setEditing({ resource: "milestone", id: selectedMilestone.id })} className="min-h-11 rounded-md border border-[#cfc7b9] px-3 py-2 text-[11px] font-semibold text-[#514e47] hover:bg-[#f8f5ec] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38745d]">選択中「{nominalizeSxActionLabel(displayManagementText(selectedMilestone.title))}」を編集</button>}
                  </div>
                )}
                <Timeline management={management} selectedMilestoneId={selectedMilestoneId} onSelect={selectMilestoneAndTrack} />
              </div>
            </details>
          )}
          {selectedTrack && !selectedMilestone && <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-[#e4ddd0] bg-[#f8f5ec] p-3 text-xs text-[#69665d]"><span className="font-semibold text-[#24231f]">選択中: {selectedLabel}</span><span>論点 {visibleIssues.length}件</span><span>関係先 {visiblePartners.length}件</span></div>}
        </section>

        <section id="management-proof" tabIndex={-1} className="scroll-mt-20" aria-label="技術証明: 三つの証明と7開発テーマ">
          <SxProofOutcomes management={management} />
          <div className="mt-2"><SxDevelopmentThemeBoard management={management} /></div>
        </section>

        <section id="management-issues" className="rounded-xl border border-[#d6cebf] bg-[#fffdf7]/95 p-5 sm:p-6" aria-labelledby="issues-heading">
          <SectionHeader headingId="issues-heading" kicker="論点・仮説台帳" title="論点・仮説台帳" description="事実・仮説・意思決定待ちを分類し、根拠・反証/不足・次の検証・担当・期限・意思決定を分けて管理する。" action={<div className="flex flex-wrap items-center gap-2 text-[10px] text-[#777166]"><span>事実 {issueGroups.fact}</span><span>仮説 {issueGroups.hypothesis}</span><span>意思決定待ち {issueGroups.decisionNeeded}</span><span>決定済み {issueGroups.decided}</span><EditAction canManage={management.canManage} label="論点を追加" onClick={() => setCreating({ resource: "issue", initialValues: selectedMilestone ? { milestone_id: selectedMilestone.id, outcome_id: selectedMilestone.outcomeId, track: selectedMilestone.track } : undefined })} /></div>} />
          {visibleIssues.length === 0 ? (
            <div className="mt-4 rounded-lg border border-dashed border-[#d6cebf] px-4 py-8 text-center text-sm text-[#777166]">{selectedTrack ? `${selectedLabel}の論点は未登録。` : "論点・仮説は未登録。"}</div>
          ) : (
            <>
              <div className="mt-4 hidden overflow-x-auto lg:block">
                <table data-testid="sx-issue-ledger-table" className="w-full min-w-[1100px] border-collapse text-xs leading-5">
                  <thead>
                    <tr className="border-y border-[#d6cebf] bg-[#f8f5ec] text-left text-[10px] font-semibold text-[#777166]">
                      <th scope="col" className="px-3 py-2">論点 / 分類</th>
                      <th scope="col" className="px-3 py-2">現在の仮説</th>
                      <th scope="col" className="px-3 py-2">根拠</th>
                      <th scope="col" className="px-3 py-2">反証・不足</th>
                      <th scope="col" className="px-3 py-2">次の検証</th>
                      <th scope="col" className="px-3 py-2">担当 / 期限</th>
                      <th scope="col" className="px-3 py-2">関連ゲート</th>
                      {management.canManage && <th scope="col" className="px-3 py-2">操作</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleIssues.map((issue) => (
                      <tr key={issue.id} id={`sx-issue-${issue.id}`} data-sx-anchor={`sx-issue-${issue.id}`} tabIndex={-1} className="scroll-mt-24 border-b border-[#e4ddd0]">
                        <td className="px-3 py-2 align-top"><p className="font-semibold text-[#24231f]">{issue.title}</p><p className="mt-1 text-[10px] text-[#777166]">{TRACK_LABELS[issue.track]} / 確認 {formatDate(issue.lastVerifiedAt)}</p><p className="mt-1 flex flex-wrap gap-1"><Badge tone={issue.knowledgeType === "fact" ? "border-[#b7c8d2] bg-[#eef3f5] text-[#315f7d]" : issue.knowledgeType === "decision_needed" ? "border-[#e3c994] bg-[#fbf1dc] text-[#765022]" : "border-[#c9bfd0] bg-[#f1edf3] text-[#5f4a66]"}>{ISSUE_KIND_LABELS[issue.knowledgeType]}</Badge>{issue.knowledgeType !== "decision_needed" && issue.status !== "closed" && issue.decisions.some((decision) => decision.status !== "decided") && <Badge tone="border-[#e3c994] bg-[#fbf1dc] text-[#765022]">意思決定待ち</Badge>}</p></td>
                        <td className="px-3 py-2 align-top text-[#514e47]">{issue.hypothesis}</td>
                        <td className="px-3 py-2 align-top text-[#514e47]">{issue.evidenceFor}</td>
                        <td className="px-3 py-2 align-top text-[#8c3329]">{issue.counterevidenceOrMissing}</td>
                        <td className="px-3 py-2 align-top text-[#514e47]">{nominalizeSxActionLabel(issue.nextValidation)}</td>
                        <td className="px-3 py-2 align-top text-[#514e47]"><span className={issue.ownerLabel.includes("未確認") ? "text-[#765022]" : ""}>{issue.ownerLabel}</span><span className="mt-1 block text-[10px] text-[#777166]">{formatDate(issue.dueDate)} / {statusLabel(issue.status)}</span></td>
                        <td className="px-3 py-2 align-top text-[#514e47]">{issue.milestoneSlug ? (milestoneLabelMap.get(issue.milestoneSlug) || "名称未確認") : "未接続"}</td>
                        {management.canManage && <td className="px-3 py-2 align-top"><button type="button" onClick={() => setEditing({ resource: "issue", id: issue.id })} className="inline-flex items-center gap-1 rounded-md border border-[#cfc7b9] px-2 py-1.5 text-[10px] font-semibold text-[#514e47] hover:bg-[#f8f5ec]"><Pencil className="h-3 w-3" aria-hidden="true" />編集</button></td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 divide-y divide-[#e4ddd0] border-y border-[#e4ddd0] lg:hidden">
                {visibleIssues.map((issue) => (
                  <article key={issue.id} data-sx-anchor={`sx-issue-${issue.id}`} tabIndex={-1} className="scroll-mt-24 border-b border-[#e4ddd0] py-3 last:border-b-0">
                    <div className="flex items-start justify-between gap-3"><div className="flex flex-wrap items-center gap-1"><Badge tone={issue.knowledgeType === "fact" ? "border-[#b7c8d2] bg-[#eef3f5] text-[#315f7d]" : issue.knowledgeType === "decision_needed" ? "border-[#e3c994] bg-[#fbf1dc] text-[#765022]" : "border-[#c9bfd0] bg-[#f1edf3] text-[#5f4a66]"}>{ISSUE_KIND_LABELS[issue.knowledgeType]}</Badge>{issue.knowledgeType !== "decision_needed" && issue.status !== "closed" && issue.decisions.some((decision) => decision.status !== "decided") && <Badge tone="border-[#e3c994] bg-[#fbf1dc] text-[#765022]">意思決定待ち</Badge>}<h3 className="mt-2 text-sm font-semibold text-[#24231f]">{issue.title}</h3></div><EditAction canManage={management.canManage} onClick={() => setEditing({ resource: "issue", id: issue.id })} /></div>
                    <dl className="mt-2 grid grid-cols-[88px_minmax(0,1fr)] text-[11px]">
                      <dt className="py-1 text-[#777166]">分類</dt><dd className="py-1">{TRACK_LABELS[issue.track]}</dd>
                      <dt className="py-1 text-[#777166]">現在の仮説</dt><dd className="py-1">{issue.hypothesis}</dd>
                      <dt className="py-1 text-[#777166]">根拠</dt><dd className="py-1">{issue.evidenceFor}</dd>
                      <dt className="py-1 text-[#777166]">反証・不足</dt><dd className="py-1 text-[#8c3329]">{issue.counterevidenceOrMissing}</dd>
                      <dt className="py-1 text-[#777166]">次の検証</dt><dd className="py-1">{nominalizeSxActionLabel(issue.nextValidation)}</dd>
                      <dt className="py-1 text-[#777166]">担当 / 期限</dt><dd className="py-1">{issue.ownerLabel} / {formatDate(issue.dueDate)}</dd>
                      <dt className="py-1 text-[#777166]">関連ゲート</dt><dd className="py-1">{issue.milestoneSlug ? (milestoneLabelMap.get(issue.milestoneSlug) || "名称未確認") : "未接続"}</dd>
                    </dl>
                    <p className="mt-2 text-[10px] text-[#777166]">仮説 {issue.hypotheses.length}件 / 証拠 {issue.evidence.length}件 / 検証 {issue.validationRuns.length}件 / 意思決定 {issue.decisions.length}件 / 確認 {formatDate(issue.lastVerifiedAt)} / 状態 {statusLabel(issue.status)} / 確度 {confidenceLabel(issue.confidence)}</p>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>

        <section id="management-partners" className="rounded-xl border border-[#d6cebf] bg-[#fffdf7]/95 p-5 sm:p-6" aria-labelledby="partners-heading">
          <SectionHeader
            headingId="partners-heading"
            kicker="関係先管理"
            title="関係先リスト"
            description="PoC先を含む全関係先を一つの台帳で管理する。PoC属性と役割を組み合わせて絞り込み、進行状況・直近接点・現在ボールを同じ行で比較できる。"
            action={<EditAction canManage={management.canManage} label="PoC候補を追加" onClick={() => setCreating({ resource: "partner", initialValues: { role_label: "PoC候補先（排液提供）", primary_track: "business_development", relationship_stage: "candidate" } })} />}
          />
          <SxPartnerPipeline
            management={management}
            projectId={projectId}
            onManagementChange={(nextManagement) =>
              setWorkspace((current) => ({ ...current, sxManagement: nextManagement }))
            }
          />
        </section>

        <details id="management-ledger" className="scroll-mt-20 rounded-xl border border-[#d6cebf] bg-[#fffdf7]/95 p-5 sm:p-6" data-testid="sx-management-ledger">
          <summary className="flex min-h-11 cursor-pointer select-none flex-col gap-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38745d]">
            <span className="text-[10px] font-semibold tracking-[0.16em] text-[#38745d]">低頻度・詳細編集</span>
            <span id="management-ledger-heading" className="text-lg font-semibold tracking-tight text-[#24231f]">管理台帳・編集を表示（運用準備 / 4本柱 / KPI / 意思決定 / 判断ループ / 測定・資金・体制 / 非表示履歴）</span>
          </summary>
          <div className="mt-4 space-y-6">
            <div aria-labelledby="readiness-heading">
              <div className="flex items-center justify-between gap-3">
                <div><p className="text-[10px] font-semibold tracking-[0.16em] text-[#38745d]">運用準備</p><h3 id="readiness-heading" className="mt-1 text-base font-semibold text-[#24231f]">{operationReady ? "運用準備 完了" : "運用準備 未完了"}</h3></div>
              </div>
              <p className="mt-2 text-xs leading-5 text-[#514e47]">重要な共有情報が揃うまで、経営判定を合格扱いにしないフェイルクローズの確認欄だよ。</p>
              {management.canManage && <div className="mt-3"><button type="button" onClick={() => setCreating({ resource: "issue" })} className="min-h-11 rounded-lg bg-[#205f49] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#174b3a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#205f49]">新規追加</button></div>}
              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                {operationChecks.map((check) => <div key={check.label} className={`rounded-lg border p-3 ${check.missing === 0 ? "border-[#9fc6b4] bg-white" : "border-[#e3c994] bg-[#fbf1dc]"}`}><div className="flex items-start justify-between gap-2"><p className="text-xs font-semibold leading-5 text-[#24231f]">{check.label}</p><span className="shrink-0 text-[11px] font-semibold">{check.missing === 0 ? "準備済み" : "未確認"}</span></div><p className="mt-2 text-[11px] text-[#765022]">不足 {check.missing}件</p></div>)}
              </div>
              {management.canManage && <div className="mt-4 border-t border-[#e4ddd0] pt-3"><p className="text-[11px] font-semibold text-[#38745d]">経営台帳の更新</p><div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">{CREATE_RESOURCES.map((resource) => <button key={resource} type="button" onClick={() => setCreating({ resource })} className="min-h-11 rounded-md border border-[#b7c8d2] bg-white px-2 py-2 text-[11px] font-semibold text-[#315f7d] hover:bg-[#eef3f5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38745d]">{RESOURCE_LABELS[resource]}</button>)}</div></div>}
            </div>

            <div className="border-t border-[#e4ddd0] pt-5" aria-labelledby="tracks-heading">
              <SectionHeader headingId="tracks-heading" kicker="4本柱" title="4本柱の詳細比較表" description="4本とも同じ管理型で、ゲート・状態・予定/予測・差分・進捗・担当・次の成果・最大論点・鮮度を並べてるよ。状態は期限・根拠・阻害条件から計算し、根拠のない手入力で順調にしない。" action={selectedTrack ? <button type="button" aria-pressed={selectedTrack === null} aria-controls="selected-management-context" onClick={() => { setSelectedTrack(null); setSelectedMilestoneId(null); }} className="min-h-11 rounded-md border border-[#d6cebf] px-3 py-2 text-xs font-semibold text-[#69665d] hover:bg-[#f8f5ec] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38745d]">全体に戻す</button> : undefined} />
              <div className="hidden overflow-x-auto lg:block">
                <div className="min-w-[1120px]">
                  <div className="grid grid-cols-[140px_190px_76px_100px_100px_76px_150px_230px] border-y border-[#d6cebf] bg-[#f8f5ec] text-[10px] font-semibold text-[#777166]"><div className="px-3 py-2.5">柱</div><div className="px-3 py-2.5">現在ゲート</div><div className="px-3 py-2.5">状態</div><div className="px-3 py-2.5">予定日</div><div className="px-3 py-2.5">予測日</div><div className="px-3 py-2.5">進捗</div><div className="px-3 py-2.5">担当 / 鮮度</div><div className="px-3 py-2.5">次の成果 / 最大論点</div></div>
                  {management.tracks.map((track) => <button key={track.key} type="button" aria-pressed={selectedTrack === track.key} aria-controls="selected-management-context" onClick={() => { const next = selectedTrack === track.key ? null : track.key; setSelectedTrack(next); setSelectedMilestoneId(next ? track.milestoneId : null); }} className={`grid w-full grid-cols-[140px_190px_76px_100px_100px_76px_150px_230px] border-b border-[#e4ddd0] text-left transition hover:bg-[#f8f5ec] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38745d] ${selectedTrack === track.key ? "bg-[#f5f2ea]" : ""}`}>
                    <div className="border-l-4 px-3 py-4" style={{ borderLeftColor: track.accent }}><span className="font-semibold text-[#24231f]">{track.label}</span><span className="mt-1 block text-[10px] text-[#777166]">{track.dateCertainty === "provisional" ? "日付は仮置き" : "日付確認済み"}</span></div>
                    <div className="px-3 py-4 text-xs leading-5 text-[#514e47]">{track.gate}</div>
                    <div className="px-3 py-4"><Badge tone={STATUS_TONE[track.status] || STATUS_TONE.unassessed}>{track.statusLabel}</Badge></div>
                    <div className="px-3 py-4 text-xs text-[#514e47]">{formatDate(track.plannedEnd)}</div>
                    <div className="px-3 py-4 text-xs font-semibold text-[#24231f]">{formatDate(track.forecastEnd)}</div>
                    <div className="px-3 py-4">{track.status === "unassessed" ? <span className="font-mono text-xs font-semibold text-[#55506d]">進捗未評価</span> : <><span className="font-mono text-xs font-semibold text-[#24231f]">{track.progressPct}%</span><span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-[#e8e2d6]"><span className="block h-full rounded-full bg-[#38745d]" style={{ width: `${track.progressPct}%` }} /></span></>}</div>
                    <div className="px-3 py-4 text-xs leading-5 text-[#514e47]"><span className={track.ownerLabel.includes("未確認") ? "font-semibold text-[#8c3329]" : ""}>{track.ownerLabel}</span><span className="mt-1 block text-[10px] text-[#777166]">確認 {formatDate(track.lastVerifiedAt)} / 確度 {confidenceLabel(track.confidence)}</span></div>
                    <div className="px-3 py-4 text-xs leading-5"><span className="block text-[#24231f]">{nominalizeSxActionLabel(track.nextDeliverable)}</span><span className="mt-1 block text-[#8c3329]">論点: {track.maxIssue}</span></div>
                  </button>)}
                </div>
              </div>
              <div className="space-y-3 lg:hidden">
                {management.tracks.map((track) => <button key={track.key} type="button" aria-pressed={selectedTrack === track.key} aria-controls="selected-management-context" onClick={() => { const next = selectedTrack === track.key ? null : track.key; setSelectedTrack(next); setSelectedMilestoneId(next ? track.milestoneId : null); }} className={`min-h-28 w-full rounded-lg border p-4 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38745d] ${selectedTrack === track.key ? "border-[#38745d] bg-[#f1f6f2]" : "border-[#d6cebf] bg-[#fffdf7]"}`}><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-semibold tracking-[0.14em] text-[#765022]">{track.label}</p><h3 className="mt-1 text-sm font-semibold text-[#24231f]">{track.gate}</h3></div><Badge tone={STATUS_TONE[track.status] || STATUS_TONE.unassessed}>{track.statusLabel}</Badge></div><dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[11px]"><div><dt className="text-[#777166]">予定 / 予測</dt><dd className="font-semibold">{formatDate(track.plannedEnd)} / {formatDate(track.forecastEnd)}</dd></div><div><dt className="text-[#777166]">差分</dt><dd className={track.deltaDays && track.deltaDays > 0 && track.dateCertainty !== "provisional" ? "font-semibold text-[#8c3329]" : "font-semibold"}>{formatDeltaLabel(track.deltaDays, track.dateCertainty)}</dd></div><div><dt className="text-[#777166]">担当 / 確認日</dt><dd>{track.ownerLabel} / {formatDate(track.lastVerifiedAt)}</dd></div><div><dt className="text-[#777166]">進捗 / 確度</dt><dd>{track.status === "unassessed" ? "進捗未評価" : `${track.progressPct}%`} / {confidenceLabel(track.confidence)}</dd></div></dl><div className="mt-3 border-t border-[#e4ddd0] pt-2 text-xs"><p>次の成果: {nominalizeSxActionLabel(track.nextDeliverable)}</p><p className="mt-1 text-[#8c3329]">最大論点: {track.maxIssue}</p></div></button>)}
              </div>
            </div>

            <div className="border-t border-[#e4ddd0] pt-5">
              <ObjectiveKpiSection management={management} onEdit={(resource, id) => setEditing({ resource, id })} />
            </div>

            <div className="border-t border-[#e4ddd0] pt-5" aria-labelledby="decision-heading">
              <SectionHeader headingId="decision-heading" kicker="意思決定の記録" title="意思決定の記録" description="今週決めることの背景・期限・担当・決定内容を、論点台帳と分けて残すよ。" />
              <div className="grid gap-3 lg:grid-cols-3">{management.decisions.map((decision) => { const decisionDisplayTitle = nominalizeSxActionLabel(decision.title); return <div key={decision.id} className="rounded-lg border border-[#e4ddd0] bg-[#f8f5ec] p-4"><div className="flex items-start justify-between gap-3"><Badge tone={decision.status === "decided" ? STATUS_TONE.completed : decision.status === "deferred" ? STATUS_TONE.attention : "border-[#e3c994] bg-[#fbf1dc] text-[#765022]"}>{decision.status === "decided" ? "決定済み" : decision.status === "deferred" ? "保留" : "未決"}</Badge>{management.canManage && <button type="button" onClick={() => setEditing({ resource: "decision", id: decision.id })} className="rounded-md border border-[#cfc7b9] p-1.5 text-[#69665d] hover:bg-[#fffdf7]" aria-label={`${decisionDisplayTitle}を編集`}><Pencil className="h-3.5 w-3.5" aria-hidden="true" /></button>}</div><h3 className="mt-3 text-sm font-semibold leading-5 text-[#24231f]">{decisionDisplayTitle}</h3><p className="mt-2 text-xs leading-5 text-[#69665d]">{decision.context}</p><p className="mt-3 text-[11px] text-[#777166]">期限 {formatDate(decision.dueDate)} / {decision.ownerLabel}</p>{decision.decisionText && <p className="mt-2 border-t border-[#e4ddd0] pt-2 text-xs leading-5 text-[#205f49]">決定: {decision.decisionText}</p>}</div>; })}</div>
              {management.decisions.length === 0 && <p className="rounded-lg border border-dashed border-[#d6cebf] px-4 py-8 text-center text-sm text-[#777166]">決定事項はまだないよ。</p>}
            </div>

            <div className="border-t border-[#e4ddd0] pt-5">
              <DecisionLoopSection management={management} memberNames={memberNames} onEdit={(resource, id) => setEditing({ resource, id })} />
            </div>

            <div className="border-t border-[#e4ddd0] pt-5">
              <MeasurementSection management={management} memberNames={memberNames} onEdit={(resource, id) => setEditing({ resource, id })} />
            </div>

            {management.canManage && <div className="border-t border-[#e4ddd0] pt-5"><DeletedManagementSection projectId={projectId} onRestored={(nextManagement) => setWorkspace((current) => ({ ...current, sxManagement: nextManagement }))} /></div>}
          </div>
        </details>

        <section id="management-capacity" tabIndex={-1} className="rounded-xl border border-[#d6cebf] bg-[#fffdf7]/95 p-5 sm:p-6" aria-labelledby="capacity-heading">
          <SectionHeader headingId="capacity-heading" kicker="CAPACITY / WEEKLY EFFORT" title="実行能力と週次エフォート" description="週次エフォートは補助面。体制の不足と入力データの鮮度を確認する。AMD OS側の入力対象と研究側メンバーを混同しない。" />
          <div className="grid items-start gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-lg border border-[#e3c994] bg-[#fbf1dc] p-4"><div className="flex items-start gap-3"><UsersRound className="mt-0.5 h-5 w-5 shrink-0 text-[#bf7b2c]" aria-hidden="true" /><div><p className="text-sm font-semibold text-[#765022]">研究側メンバー未確認</p><p className="mt-1 text-xs leading-5 text-[#765022]">現在のAMD OS参加メンバー {workspace.memberCount}人は入力対象で、研究チーム全体の人数・役割を示さない。責任者と研究側の体制を確認するまで、経営判定を「順調」にしない。</p></div></div></div>
            <div className="rounded-lg border border-[#e4ddd0] bg-[#f8f5ec] p-4"><div className="flex items-center justify-between gap-3"><span className="text-xs font-semibold text-[#777166]">今週の入力</span><span className="text-right text-sm font-semibold text-[#24231f]">予定 {hours(workspace.effort.plannedHours)}h / 実績 {hours(workspace.effort.actualHours)}h<span className="mt-1 block text-[10px] font-normal text-[#777166]">Calendar {hours(workspace.effort.calendarHours)}h / 手入力・取込 {hours(workspace.effort.enteredHours)}h</span></span></div><p className="mt-1 text-[11px] leading-4 text-[#777166]">Calendar実績は予定の開始・終了だけから集計。Gmail・Slack・Driveは活動証跡として使い、時間換算しない。</p><div className="mt-3"><CategoryBand categories={workspace.effort.categories} muted={!workspace.effort.hasEntries} /></div>{workspace.effort.links.length > 0 && <div className="mt-3 border-t border-[#e4ddd0] pt-3"><p className="text-[10px] font-semibold text-[#777166]">経営台帳への接続</p><div className="mt-2 space-y-1.5">{workspace.effort.links.slice(0, 4).map((link, index) => <p key={`${link.milestoneId || link.track || "unlinked"}-${index}`} className="text-[11px] leading-5 text-[#69665d]">{link.track ? TRACK_LABELS[link.track as SxTrackKey] || "柱未確認" : "柱未接続"} / {link.milestoneTitle || "ゲート未接続"} / {link.deliverableLabel || "次の成果未確認"}（実績 {hours(link.actualHours)}h）</p>)}</div></div>}{!workspace.effort.hasEntries && <p className="mt-2 text-[11px] text-[#765022]">今週の時間は未確定。</p>}{workspace.effort.actualHours === 0 && workspace.evidenceCount > 0 && <p className="mt-2 rounded-md border border-[#e3c994] bg-[#fbf1dc] px-2.5 py-1.5 text-[11px] leading-4 text-[#765022]">抽出済みの活動証跡が{workspace.evidenceCount}件あるのに工数が0時間。0時間と断定せず「工数未算定（取得範囲未完了）」として扱う。経営判定にはこの数値を混ぜていない。</p>}</div>
          </div>
          <details className="mt-4 rounded-lg border border-[#e4ddd0] bg-[#fffdf7]" data-testid="sx-effort-entry-details">
            <summary className="flex min-h-11 cursor-pointer select-none flex-wrap items-center gap-x-3 gap-y-0.5 px-4 py-2 text-xs font-semibold text-[#514e47] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38745d]">
              週次エフォートの入力・メンバー別内訳を開く
              <span className="text-[10px] font-normal text-[#777166]">今週実績 {hours(workspace.effort.actualHours)}h ・ 入力 {workspace.members.filter((member) => member.actualHours > 0 || member.plannedHours > 0).length}/{workspace.members.length}名</span>
            </summary>
            <div className="px-4 pb-4">
          <div className="mt-2 rounded-lg border border-[#e4ddd0] p-4"><div className="mb-4 flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-[#24231f]">週次エフォートを確定</p><p className="mt-1 text-[11px] text-[#777166]">{access.canEditEffort ? (access.scope === "project" ? "自分の予定・実績だけ更新できる。" : "AMD管理ビューではPJの入力対象を更新できる。") : "共有ワークスペースからは閲覧のみ。入力はAMDメンバーが行う。"}</p></div><CalendarClock className="h-5 w-5 text-[#777166]" aria-hidden="true" /></div>{access.canEditEffort && <EffortEntryForm projectId={projectId} currentWeekStart={workspace.currentWeekStart} currentMemberId={access.memberId} accessScope={access.scope} members={workspace.members.map((member) => ({ memberId: member.memberId, displayName: member.displayName }))} managementMilestones={management.milestones.map((milestone) => ({ id: milestone.id, title: milestone.title, track: milestone.track }))} />}</div>
          <div className="mt-5 hidden overflow-x-auto lg:block"><table className="w-full min-w-[860px] border-collapse text-sm"><thead><tr className="border-y border-[#d6cebf] bg-[#f8f5ec] text-left text-[10px] font-semibold text-[#777166]"><th className="px-3 py-2.5">入力対象</th><th className="px-3 py-2.5">今週の配分</th><th className="px-3 py-2.5 text-right">予定</th><th className="px-3 py-2.5 text-right">実績の内訳</th><th className="px-3 py-2.5 text-right">抽出活動</th><th className="px-3 py-2.5 text-right">最終活動</th></tr></thead><tbody>{workspace.members.map((member) => { const categoryTotal = EFFORT_CATEGORIES.reduce((sum, item) => sum + member.categories[item.key], 0); return <tr key={member.memberId} className="border-b border-[#e4ddd0]"><td className="px-3 py-3"><span className="font-semibold text-[#24231f]">{member.displayName}</span><span className="mt-1 block text-[10px] text-[#777166]">{member.roleLabel || "役割未確認"}{member.isLead ? " / リード" : ""}</span></td><td className="px-3 py-3">{categoryTotal > 0 ? <div className="flex h-6 min-w-64 overflow-hidden rounded bg-[#ece7dc]">{EFFORT_CATEGORIES.map((item) => { const value = member.categories[item.key]; if (value <= 0) return null; return <div key={item.key} className="grid min-w-8 place-items-center text-[9px] font-semibold text-white" style={{ width: `${Math.max(8, (value / categoryTotal) * 100)}%`, background: CATEGORY_STYLE[item.key].background }} title={`${item.label}: ${hours(value)}h`}>{item.shortLabel}</div>; })}</div> : <span className="text-xs text-[#777166]">時間未入力</span>}</td><td className="px-3 py-3 text-right text-xs text-[#514e47]">{hours(member.plannedHours)}h</td><td className="px-3 py-3 text-right text-xs font-semibold text-[#24231f]"><span className="block">{hours(member.actualHours)}h</span><span className="mt-0.5 block text-[10px] font-normal text-[#777166]">Calendar {hours(member.calendarHours)} / 手入力・取込 {hours(member.enteredHours)}</span></td><td className="px-3 py-3 text-right text-xs text-[#514e47]">{member.evidenceCount}件</td><td className="px-3 py-3 text-right text-xs text-[#777166]">{formatActivityDate(member.lastActivityAt)}</td></tr>; })}</tbody></table>{workspace.members.length === 0 && <p className="py-6 text-center text-sm text-[#777166]">このPJの入力対象メンバーは未登録。</p>}</div><div className="mt-5 space-y-3 lg:hidden">{workspace.members.map((member) => <article key={member.memberId} className="rounded-lg border border-[#e4ddd0] bg-[#f8f5ec] p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-semibold text-[#24231f]">{member.displayName}</h3><p className="mt-1 text-[11px] text-[#777166]">{member.roleLabel || "役割未確認"}{member.isLead ? " / リード" : ""}</p></div><span className="text-right text-[11px] font-semibold text-[#24231f]">実績 {hours(member.actualHours)}h<span className="mt-0.5 block text-[10px] font-normal text-[#777166]">Calendar {hours(member.calendarHours)} / 手入力・取込 {hours(member.enteredHours)}</span></span></div><div className="mt-3"><CategoryBand categories={member.categories} muted={member.actualHours === 0 && member.plannedHours === 0} /></div><p className="mt-2 text-[11px] text-[#69665d]">予定 {hours(member.plannedHours)}h / 抽出活動 {member.evidenceCount}件 / 最終活動 {formatActivityDate(member.lastActivityAt)}</p></article>)}{workspace.members.length === 0 && <p className="rounded-lg border border-dashed border-[#d6cebf] p-4 text-center text-sm text-[#777166]">このPJの入力対象メンバーは未登録。</p>}</div>
            </div>
          </details>
        </section>

        <section className="grid min-w-0 gap-5 xl:grid-cols-[1.05fr_0.95fr]" aria-label="活動データの鮮度と予定実績推移">
          <div className="min-w-0 overflow-hidden rounded-xl border border-[#d6cebf] bg-[#fffdf7]/95 p-5 sm:p-6"><SectionHeader kicker="活動データの鮮度" title="活動データの鮮度" description="共有するのは抽出済み活動の件数・情報源の種類・最終日だけ。本文や生データは返してないよ。" action={<Database className="h-5 w-5 text-[#777166]" aria-hidden="true" />} /><div className="flex min-w-0 h-36 items-end gap-3 overflow-hidden border-b border-[#d6cebf] pb-3">{workspace.evidenceByMonth.map((item) => <div key={item.ym} className="flex min-w-0 h-full flex-1 flex-col justify-end gap-2 text-center"><span className="text-[10px] font-semibold text-[#514e47]">{item.count}</span><div className="mx-auto w-full max-w-10 rounded-t bg-[#5f879e]" style={{ height: `${Math.max(item.count ? 8 : 2, (item.count / maxEvidence) * 100)}%` }} /><span className="text-[10px] text-[#777166]">{compactYm(item.ym)}</span></div>)}</div><div className="mt-4 flex flex-wrap gap-2">{workspace.evidenceBySource.map((item) => <span key={`${item.source}-${item.scope}`} className="rounded-full border border-[#d6cebf] bg-[#f8f5ec] px-2.5 py-1 text-[11px] text-[#69665d]">{sourceLabel(item.source)} {item.count}件 / {item.scope === "member" ? "メンバー帰属" : "PJ全体"} / 最終 {formatActivityDate(item.lastObservedAt)}</span>)}</div><p className="mt-4 flex items-start gap-2 text-[11px] leading-5 text-[#777166]"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#256c55]" aria-hidden="true" />共有範囲を安全な集計へ限定してるよ。</p></div>
          <div className="min-w-0 overflow-hidden rounded-xl border border-[#d6cebf] bg-[#fffdf7]/95 p-5 sm:p-6"><SectionHeader kicker="6週間の推移" title="予定と実績の推移" description="活動の量は成果の代わりにせず、入力の鮮度を見る補助線として置いてるよ." action={<Activity className="h-5 w-5 text-[#777166]" aria-hidden="true" />} /><div className="flex min-w-0 h-36 items-end gap-3 overflow-hidden sm:gap-6">{visibleTrend.map((item) => <div key={item.weekStart} className="flex min-w-0 h-full flex-1 flex-col justify-end"><div className="flex flex-1 items-end justify-center gap-1 sm:gap-2"><div className="w-3 rounded-t bg-[#b7c8d2] sm:w-5" style={{ height: `${Math.max(item.plannedHours ? 4 : 1, (item.plannedHours / maxTrend) * 100)}%` }} title={`予定 ${hours(item.plannedHours)}h`} /><div className="w-3 rounded-t bg-[#38745d] sm:w-5" style={{ height: `${Math.max(item.actualHours ? 4 : 1, (item.actualHours / maxTrend) * 100)}%` }} title={`実績 ${hours(item.actualHours)}h`} /></div><div className="mt-2 border-t border-[#d6cebf] pt-2 text-center text-[10px] text-[#777166]">{formatDate(item.weekStart)}</div></div>)}</div><div className="mt-3 flex justify-end gap-4 text-[10px] text-[#777166]"><span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-[#b7c8d2]" />予定</span><span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-[#38745d]" />実績</span></div></div>
        </section>

        </main>
        </div>
      </div>
      {milestoneDetail && (
        <MilestoneDetailModal
          milestone={milestoneDetail}
          milestoneLabelMap={milestoneLabelMap}
          issues={management.issues.filter((issue) => milestoneDetail.relatedIssueSlugs.includes(issue.slug))}
          partners={management.partners.filter((partner) => milestoneDetail.relatedPartnerSlugs.includes(partner.slug))}
          canManage={management.canManage}
          onEdit={(resource, id) => { setMilestoneDetailId(null); setEditing({ resource, id }); }}
          onCreate={(resource, initialValues) => { setMilestoneDetailId(null); setCreating({ resource, initialValues }); }}
          onClose={() => setMilestoneDetailId(null)}
        />
      )}
      {creating && <AddPanel projectId={projectId} management={management} resource={creating.resource} initialValues={creating.initialValues} onClose={() => setCreating(null)} onSaved={(nextManagement) => { setWorkspace((current) => ({ ...current, sxManagement: nextManagement })); setCreating(null); }} />}
      {editing && editRecord && <EditPanel projectId={projectId} resource={editing.resource} record={editRecord} onClose={() => setEditing(null)} onSaved={(nextManagement) => { setWorkspace((current) => ({ ...current, sxManagement: nextManagement })); setEditing(null); }} onConflict={(nextManagement) => { setWorkspace((current) => ({ ...current, sxManagement: nextManagement })); setEditing(null); setWorkspaceNotice("他の人が先に更新したため、最新内容に更新して編集を閉じたよ"); window.setTimeout(() => setWorkspaceNotice(null), 5000); }} />}
    </div>
  );
}
