"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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
  Lightbulb,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Target,
  X,
} from "lucide-react";
import type { CurrentMemberAccess, ProjectWorkspaceBundle } from "@/lib/project-workspace";
import type {
  SxConfidence,
  SxActionItem,
  SxDecisionRecord,
  SxHypothesis,
  SxManagementBundle,
  SxManagementIssue,
  SxTrackKey,
} from "@/lib/sx-management";
import { deriveSxUnifiedTimeline } from "@/lib/sx-executive-control-deck";
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
import styles from "./weekly-control.module.css";

type StageKey = SxWeeklyIssueStage;
type ViewFilter = "all" | "attention" | "stale" | "overdue";
type EditorState =
  | { kind: "create_issue" }
  | { kind: "edit_issue"; issue: SxManagementIssue }
  | { kind: "create_hypothesis"; issue: SxManagementIssue }
  | { kind: "edit_hypothesis"; issue: SxManagementIssue; hypothesis: SxHypothesis }
  | { kind: "create_evidence"; issue: SxManagementIssue; hypothesis?: SxHypothesis }
  | { kind: "create_validation"; issue: SxManagementIssue; hypothesis: SxHypothesis }
  | { kind: "create_decision"; issue: SxManagementIssue; hypothesis?: SxHypothesis }
  | { kind: "edit_decision"; issue: SxManagementIssue; decision: SxDecisionRecord }
  | { kind: "create_action"; issue: SxManagementIssue; decision: SxDecisionRecord }
  | { kind: "edit_action"; issue: SxManagementIssue; decision: SxDecisionRecord; action: SxActionItem };

type FormField = {
  key: string;
  label: string;
  type?: "text" | "textarea" | "date" | "select" | "checkbox";
  required?: boolean;
  span?: boolean;
  options?: Array<{ value: string; label: string }>;
  help?: string;
};

const TRACKS: Array<{ key: SxTrackKey; label: string; short: string; accent: string }> = [
  { key: "business_development", label: "事業開発", short: "事業", accent: "#315f7d" },
  { key: "technology_development", label: "技術開発", short: "技術", accent: "#38745d" },
  { key: "funding", label: "資金調達", short: "資金", accent: "#b56d20" },
  { key: "organizational_building", label: "体制構築", short: "体制", accent: "#76637b" },
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

function formatDate(value: string | null | undefined) {
  if (!value) return "未設定";
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${Number(match[2])}/${Number(match[3])}` : value;
}

function trackMeta(track: SxTrackKey) {
  return TRACKS.find((item) => item.key === track) || TRACKS[0];
}

function issueStatusLabel(status: SxManagementIssue["status"]) {
  return ({ open: "未解決", validating: "検証中", decided: "判断済み", closed: "完了", on_hold: "保留" } as const)[status] || status;
}

function hypothesisStatusLabel(status: SxHypothesis["status"]) {
  return ({ open: "未着手", validating: "検証中", validated: "検証済み", rejected: "棄却", decided: "判断済み", on_hold: "保留" } as const)[status] || status;
}

function confidenceLabel(confidence: SxConfidence) {
  return ({ high: "高", medium: "中", low: "低", unknown: "未確認" } as const)[confidence];
}

function issueKindLabel(kind: SxManagementIssue["knowledgeType"]) {
  return ({ fact: "事実", hypothesis: "仮説", decision_needed: "判断要", decision: "旧分類" } as const)[kind] || kind;
}

function statusTone(status: string) {
  if (["closed", "decided", "validated", "rejected", "completed"].includes(status)) return styles.toneResolved;
  if (["validating", "running"].includes(status)) return styles.toneValidating;
  if (["blocked"].includes(status)) return styles.toneDanger;
  if (["on_hold"].includes(status)) return styles.toneMuted;
  return styles.toneOpen;
}

function fieldValue(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return value == null ? "" : String(value);
}

function editorInitialValues(editor: EditorState, access: CurrentMemberAccess, asOf: string): Record<string, string> {
  if (editor.kind === "create_issue") return {
    track: "business_development",
    milestone_id: "",
    title: "",
    knowledge_type: "hypothesis",
    status: "open",
    owner_label: access.displayName,
    due_date: "",
    confidence: "unknown",
  };
  if (editor.kind === "edit_issue") return {
    title: editor.issue.title,
    knowledge_type: editor.issue.knowledgeType === "decision" ? "decision_needed" : editor.issue.knowledgeType,
    status: editor.issue.status === "decided" ? "closed" : editor.issue.status,
    owner_label: editor.issue.ownerLabel,
    due_date: editor.issue.dueDate || "",
    confidence: editor.issue.confidence,
  };
  if (editor.kind === "create_hypothesis") return {
    statement: "",
    status: "open",
    owner_label: sxWeeklyValueMissing(editor.issue.ownerLabel) ? access.displayName : editor.issue.ownerLabel,
    due_date: editor.issue.dueDate || "",
    confidence: "unknown",
  };
  if (editor.kind === "edit_hypothesis") return {
    statement: editor.hypothesis.statement,
    status: editor.hypothesis.status,
    owner_label: editor.hypothesis.ownerLabel,
    due_date: editor.hypothesis.dueDate || "",
    confidence: editor.hypothesis.confidence,
  };
  if (editor.kind === "create_evidence") return {
    hypothesis_id: editor.hypothesis?.id || "",
    evidence_kind: "observation",
    summary: "",
    observed_on: asOf,
    source_label: "週次管制画面",
    confidence: "unknown",
  };
  if (editor.kind === "create_validation") return {
    validation_kind: "",
    planned_on: asOf,
    due_date: editor.hypothesis.dueDate || "",
    status: "planned",
    owner_label: sxWeeklyValueMissing(editor.hypothesis.ownerLabel) ? access.displayName : editor.hypothesis.ownerLabel,
    method: "",
    confidence: "unknown",
  };
  if (editor.kind === "edit_decision") return {
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
  if (editor.kind === "create_action") return {
    title: "",
    owner_label: sxWeeklyValueMissing(editor.decision.ownerLabel) ? access.displayName : editor.decision.ownerLabel,
    due_date: editor.decision.dueDate || "",
    completion_criteria: "",
    next_review_on: "",
    status: "open",
    completion_note: "",
    completed_at: "",
  };
  if (editor.kind === "edit_action") return {
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
    owner_label: sxWeeklyValueMissing(editor.issue.ownerLabel) ? access.displayName : editor.issue.ownerLabel,
    due_date: editor.issue.dueDate || "",
    is_this_week: "true",
    confidence: "unknown",
  };
}

function editorDefinition(editor: EditorState, management: SxManagementBundle): { title: string; eyebrow: string; resource: string; method: "POST" | "PATCH"; id?: string; fields: FormField[] } {
  const confidence: FormField = { key: "confidence", label: "確度", type: "select", options: CONFIDENCE_OPTIONS };
  if (editor.kind === "create_issue") return {
    title: "論点を起票",
    eyebrow: "忘れないための入口",
    resource: "issue",
    method: "POST",
    fields: [
      { key: "track", label: "柱", type: "select", required: true, options: TRACKS.map((track) => ({ value: track.key, label: track.label })) },
      { key: "milestone_id", label: "関連ゲート", type: "select", options: [{ value: "", label: "未接続" }, ...management.milestones.map((milestone) => ({ value: milestone.id, label: `${trackMeta(milestone.track).short}｜${milestone.title}` }))] },
      { key: "title", label: "論点", type: "textarea", required: true, span: true, help: "何が分からず、何を決められないのかを一文で" },
      { key: "knowledge_type", label: "分類", type: "select", required: true, options: [{ value: "fact", label: "事実確認" }, { value: "hypothesis", label: "仮説" }, { value: "decision_needed", label: "意思決定待ち" }] },
      { key: "status", label: "状態", type: "select", required: true, options: [{ value: "open", label: "未解決" }, { value: "validating", label: "検証中" }, { value: "on_hold", label: "保留" }, { value: "closed", label: "完了" }] },
      { key: "owner_label", label: "担当", required: true },
      { key: "due_date", label: "期限", type: "date" },
      confidence,
    ],
  };
  if (editor.kind === "edit_issue") return {
    title: "論点を更新",
    eyebrow: "更新すると確認日も今日になる",
    resource: "issue",
    method: "PATCH",
    id: editor.issue.id,
    fields: [
      { key: "title", label: "論点", type: "textarea", required: true, span: true },
      { key: "knowledge_type", label: "分類", type: "select", required: true, options: [{ value: "fact", label: "事実確認" }, { value: "hypothesis", label: "仮説" }, { value: "decision_needed", label: "意思決定待ち" }] },
      { key: "status", label: "状態", type: "select", required: true, options: [{ value: "open", label: "未解決" }, { value: "validating", label: "検証中" }, { value: "on_hold", label: "保留" }, { value: "closed", label: "完了" }] },
      { key: "owner_label", label: "担当", required: true },
      { key: "due_date", label: "期限", type: "date" },
      confidence,
    ],
  };
  if (editor.kind === "create_hypothesis" || editor.kind === "edit_hypothesis") return {
    title: editor.kind === "create_hypothesis" ? "仮説を追加" : "仮説を更新",
    eyebrow: "論点を検証可能な文へ分ける",
    resource: "hypothesis",
    method: editor.kind === "create_hypothesis" ? "POST" : "PATCH",
    id: editor.kind === "edit_hypothesis" ? editor.hypothesis.id : undefined,
    fields: [
      { key: "statement", label: "仮説", type: "textarea", required: true, span: true, help: "反証できる形で書く" },
      { key: "status", label: "状態", type: "select", required: true, options: [{ value: "open", label: "未着手" }, { value: "validating", label: "検証中" }, { value: "validated", label: "検証済み" }, { value: "rejected", label: "棄却" }, { value: "decided", label: "判断済み" }, { value: "on_hold", label: "保留" }] },
      { key: "owner_label", label: "担当", required: true },
      { key: "due_date", label: "期限", type: "date" },
      confidence,
    ],
  };
  if (editor.kind === "create_evidence") return {
    title: "根拠・反証を追加",
    eyebrow: "判断材料を論点へ戻す",
    resource: "evidence",
    method: "POST",
    fields: [
      { key: "hypothesis_id", label: "関連仮説", type: "select", options: [{ value: "", label: "論点全体" }, ...editor.issue.hypotheses.map((hypothesis) => ({ value: hypothesis.id, label: hypothesis.statement }))] },
      { key: "evidence_kind", label: "種類", type: "select", required: true, options: [{ value: "supporting", label: "支持" }, { value: "counter", label: "反証" }, { value: "missing", label: "不足" }, { value: "observation", label: "観測" }] },
      { key: "summary", label: "確認できたこと", type: "textarea", required: true, span: true },
      { key: "observed_on", label: "確認日", type: "date" },
      { key: "source_label", label: "確認元", required: true },
      confidence,
    ],
  };
  if (editor.kind === "create_validation") return {
    title: "次の検証を設定",
    eyebrow: "仮説を放置しない約束",
    resource: "validation",
    method: "POST",
    fields: [
      { key: "validation_kind", label: "検証の種類", required: true, help: "例: 顧客ヒアリング、再現試験" },
      { key: "status", label: "状態", type: "select", required: true, options: [{ value: "planned", label: "計画" }, { value: "running", label: "実施中" }, { value: "completed", label: "完了" }, { value: "blocked", label: "停止" }, { value: "cancelled", label: "取消" }] },
      { key: "planned_on", label: "予定日", type: "date" },
      { key: "due_date", label: "期限", type: "date" },
      { key: "owner_label", label: "担当", required: true },
      confidence,
      { key: "method", label: "方法・合格条件", type: "textarea", required: true, span: true },
    ],
  };
  if (editor.kind === "edit_decision") return {
    title: "判断を更新",
    eyebrow: "決定・保留まで会議の結果を閉じる",
    resource: "decision",
    method: "PATCH",
    id: editor.decision.id,
    fields: [
      { key: "title", label: "決めること", type: "textarea", required: true, span: true },
      { key: "context", label: "背景", type: "textarea", required: true, span: true },
      { key: "rationale", label: "判断基準", type: "textarea", required: true, span: true },
      { key: "status", label: "状態", type: "select", required: true, options: [{ value: "open", label: "判断待ち" }, { value: "decided", label: "決定済み" }, { value: "deferred", label: "保留" }] },
      { key: "decision_text", label: "決定内容", type: "textarea", span: true, help: "決定済みにする場合は必須" },
      { key: "decided_by", label: "決定者", help: "決定済みにする場合は必須" },
      { key: "decided_on", label: "決定日", type: "date", help: "決定済みにする場合は必須" },
      { key: "owner_label", label: "判断を取りに行く担当", required: true },
      { key: "due_date", label: "期限", type: "date" },
      { key: "is_this_week", label: "今週決める", type: "checkbox" },
      confidence,
    ],
  };
  if (editor.kind === "create_action" || editor.kind === "edit_action") return {
    title: editor.kind === "create_action" ? "決定後の行動を追加" : "決定後の行動を更新",
    eyebrow: "決めただけで終わらせない",
    resource: "action",
    method: editor.kind === "create_action" ? "POST" : "PATCH",
    id: editor.kind === "edit_action" ? editor.action.id : undefined,
    fields: [
      { key: "title", label: "次の行動", type: "textarea", required: true, span: true },
      { key: "owner_label", label: "担当", required: true },
      { key: "due_date", label: "期限", type: "date" },
      { key: "completion_criteria", label: "完了条件", type: "textarea", required: true, span: true },
      { key: "next_review_on", label: "次回確認日", type: "date" },
      { key: "status", label: "状態", type: "select", required: true, options: [{ value: "open", label: "未着手" }, { value: "in_progress", label: "実行中" }, { value: "blocked", label: "停止" }, { value: "completed", label: "完了" }] },
      { key: "completion_note", label: "完了メモ", type: "textarea", span: true, help: "完了にする場合は必須" },
      { key: "completed_at", label: "完了日", type: "date", help: "完了にする場合は必須" },
    ],
  };
  return {
    title: "判断を会議へ載せる",
    eyebrow: "判断待ちを明示する",
    resource: "decision",
    method: "POST",
    fields: [
      { key: "title", label: "決めること", type: "textarea", required: true, span: true },
      { key: "context", label: "背景", type: "textarea", required: true, span: true },
      { key: "rationale", label: "判断基準", type: "textarea", required: true, span: true },
      { key: "owner_label", label: "判断を取りに行く担当", required: true },
      { key: "due_date", label: "期限", type: "date" },
      { key: "is_this_week", label: "今週決める", type: "checkbox" },
      confidence,
    ],
  };
}

function IssueEditor({ editor, management, access, projectId, onClose, onSaved }: {
  editor: EditorState;
  management: SxManagementBundle;
  access: CurrentMemberAccess;
  projectId: string;
  onClose: () => void;
  onSaved: (bundle: SxManagementBundle, message: string) => void;
}) {
  const definition = editorDefinition(editor, management);
  const [values, setValues] = useState<Record<string, string>>(() => editorInitialValues(editor, access, management.asOf));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    const missingRequired = definition.fields.find((field) => field.required && !fieldValue(values, field.key).trim());
    if (missingRequired) {
      setError(`${missingRequired.label}を入力してね`);
      return;
    }
    if (editor.kind === "edit_decision" && values.status === "decided" && (!values.decision_text?.trim() || !values.decided_by?.trim() || !values.decided_on)) {
      setError("決定済みにするには、決定内容・決定者・決定日を入れてね");
      return;
    }
    if ((editor.kind === "create_action" || editor.kind === "edit_action") && values.status === "completed" && (!values.completion_note?.trim() || !values.completed_at)) {
      setError("完了にするには、完了メモと完了日を入れてね");
      return;
    }
    setSaving(true);
    const isPatch = definition.method === "PATCH";
    const fields: Record<string, unknown> = Object.fromEntries(Object.entries(values).map(([key, value]) => {
      if (["due_date", "planned_on", "observed_on", "decided_on", "next_review_on", "completed_at"].includes(key)) return [key, value || null];
      if (key === "is_this_week") return [key, value === "true"];
      return [key, value];
    }));
    if (editor.kind === "create_issue") fields.slug = `weekly-${Date.now().toString(36)}`;
    if (editor.kind === "create_hypothesis") fields.issue_id = editor.issue.id;
    if (editor.kind === "create_evidence") fields.issue_id = editor.issue.id;
    if (editor.kind === "create_validation") fields.hypothesis_id = editor.hypothesis.id;
    if (editor.kind === "create_decision") {
      fields.issue_id = editor.issue.id;
      if (editor.hypothesis) fields.hypothesis_id = editor.hypothesis.id;
      fields.status = "open";
    }
    if (editor.kind === "create_action") fields.decision_id = editor.decision.id;
    try {
      const response = await fetch(`/api/project-workspace/${encodeURIComponent(projectId)}/management`, {
        method: definition.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isPatch
          ? { resource: definition.resource, id: definition.id, patch: fields }
          : { resource: definition.resource, fields }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "保存できなかったよ");
      onSaved(body.bundle as SxManagementBundle, `${definition.title}を保存したよ`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "保存できなかったよ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.editorBackdrop} role="dialog" aria-modal="true" aria-label={definition.title} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className={styles.editorPanel}>
        <header className={styles.editorHeader}>
          <div>
            <p className={styles.eyebrow}>{definition.eyebrow}</p>
            <h2>{definition.title}</h2>
          </div>
          <button type="button" className={styles.iconButton} onClick={onClose} aria-label="閉じる"><X aria-hidden="true" /></button>
        </header>
        <div className={styles.editorContext}>
          {"issue" in editor && <><span>対象論点</span><strong>{editor.issue.title}</strong></>}
          {"hypothesis" in editor && <><span>対象仮説</span><strong>{editor.hypothesis?.statement}</strong></>}
          {"decision" in editor && <><span>対象判断</span><strong>{editor.decision.title}</strong></>}
        </div>
        <div className={styles.formGrid}>
          {definition.fields.map((field) => (
            <label key={field.key} className={field.span ? styles.fieldSpan : styles.field}>
              <span>{field.label}{field.required && <b>必須</b>}</span>
              {field.type === "textarea" ? (
                <textarea rows={field.key === "title" ? 2 : 4} required={field.required} value={fieldValue(values, field.key)} onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))} />
              ) : field.type === "select" ? (
                <select required={field.required} value={fieldValue(values, field.key)} onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}>
                  {field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              ) : field.type === "checkbox" ? (
                <span className={styles.checkboxRow}><input type="checkbox" checked={values[field.key] === "true"} onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.checked ? "true" : "false" }))} />今回の週次会議で扱う</span>
              ) : (
                <input type={field.type || "text"} required={field.required} value={fieldValue(values, field.key)} onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))} />
              )}
              {field.help && <small>{field.help}</small>}
            </label>
          ))}
        </div>
        {error && <p className={styles.formError} role="alert">{error}</p>}
        <footer className={styles.editorFooter}>
          <button type="button" className={styles.secondaryButton} onClick={onClose}>キャンセル</button>
          <button type="button" className={styles.primaryButton} disabled={saving} onClick={save}>{saving ? <RefreshCw className={styles.spin} aria-hidden="true" /> : <Check aria-hidden="true" />}保存</button>
        </footer>
      </section>
    </div>
  );
}

function IssueCard({ issue, asOf, canManage, onEdit }: {
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
    <article className={styles.issueCard} data-attention={attention || undefined}>
      <div className={styles.cardAccent} style={{ background: track.accent }} />
      <div className={styles.issueCardHead}>
        <div className={styles.badgeRow}>
          <span className={styles.trackBadge} style={{ color: track.accent, borderColor: `${track.accent}55` }}>{track.short}</span>
          <span className={`${styles.statusBadge} ${statusTone(issue.status)}`}>{issueStatusLabel(issue.status)}</span>
          {stale && <span className={`${styles.statusBadge} ${styles.toneDanger}`}>更新切れ</span>}
          {overdue && <span className={`${styles.statusBadge} ${styles.toneDanger}`}>期限超過</span>}
        </div>
        {canManage && <button type="button" className={styles.miniIconButton} onClick={() => onEdit({ kind: "edit_issue", issue })} aria-label={`${issue.title}を編集`}><Pencil aria-hidden="true" /></button>}
      </div>
      <p className={styles.issueType}>{issueKindLabel(issue.knowledgeType)}</p>
      <h3>{issue.title}</h3>
      <dl className={styles.cardMeta}>
        <div><dt>担当</dt><dd data-missing={sxWeeklyValueMissing(issue.ownerLabel) || undefined}>{sxWeeklyValueMissing(issue.ownerLabel) ? "未設定" : issue.ownerLabel}</dd></div>
        <div><dt>次の期限</dt><dd data-missing={!nextDueDate || undefined}>{formatDate(nextDueDate)}</dd></div>
        <div><dt>最終更新</dt><dd data-missing={stale || undefined}>{formatDate(lastActivity)}</dd></div>
      </dl>
      <div className={styles.nextMove}>
        <span>次の動き</span>
        <strong>{nextMove?.label || (issue.hypotheses.length === 0 ? "検証可能な仮説を置く" : "次の検証を設定")}</strong>
      </div>
      <details className={styles.issueDetails}>
        <summary><span>仮説 {issue.hypotheses.length}</span><span>根拠 {issue.evidence.length}</span><span>検証 {issue.validationRuns.length}</span><span>行動 {issue.actionItems.filter((action) => action.status !== "completed").length}</span><ChevronDown aria-hidden="true" /></summary>
        <div className={styles.detailBody}>
          <section>
            <div className={styles.detailTitle}><h4>仮説</h4>{canManage && <button type="button" onClick={() => onEdit({ kind: "create_hypothesis", issue })}><Plus aria-hidden="true" />追加</button>}</div>
            {issue.hypotheses.length === 0 ? <p className={styles.emptyLine}>まだ仮説がない</p> : issue.hypotheses.map((hypothesis) => (
              <div className={styles.hypothesisRow} key={hypothesis.id}>
                <div><span className={`${styles.statusBadge} ${statusTone(hypothesis.status)}`}>{hypothesisStatusLabel(hypothesis.status)}</span><p>{hypothesis.statement}</p><small>{hypothesis.ownerLabel || "担当未設定"} · {formatDate(hypothesis.dueDate)} · 確度 {confidenceLabel(hypothesis.confidence)}</small></div>
                {canManage && <div className={styles.rowActions}><button type="button" onClick={() => onEdit({ kind: "create_validation", issue, hypothesis })}>検証</button><button type="button" onClick={() => onEdit({ kind: "edit_hypothesis", issue, hypothesis })}>編集</button></div>}
              </div>
            ))}
          </section>
          <section>
            <div className={styles.detailTitle}><h4>判断材料</h4>{canManage && <button type="button" onClick={() => onEdit({ kind: "create_evidence", issue })}><Plus aria-hidden="true" />追加</button>}</div>
            {issue.evidence.length === 0 ? <p className={styles.emptyLine}>根拠・反証が未登録</p> : issue.evidence.map((evidence) => <p className={styles.evidenceLine} key={evidence.id}><b>{({ supporting: "支持", counter: "反証", missing: "不足", observation: "観測" } as const)[evidence.kind]}</b>{evidence.summary}</p>)}
          </section>
          {(issue.decisions.length > 0 || issue.actionItems.length > 0) && <section>
            <div className={styles.detailTitle}><h4>判断・決定後の行動</h4></div>
            {issue.decisions.map((decision) => <div className={styles.decisionLine} key={decision.id}>
              <div className={styles.decisionHead}><span className={`${styles.statusBadge} ${statusTone(decision.status)}`}>{decision.status === "decided" ? "決定済み" : decision.status === "deferred" ? "保留" : "判断待ち"}</span>{canManage && <span className={styles.inlineActions}><button type="button" onClick={() => onEdit({ kind: "edit_decision", issue, decision })}>編集</button>{decision.status === "decided" && <button type="button" onClick={() => onEdit({ kind: "create_action", issue, decision })}>次の行動</button>}</span>}</div>
              <b>{decision.title}</b>{decision.decisionText && <small>{decision.decisionText}</small>}
            </div>)}
            {issue.actionItems.map((action) => {
              const decision = issue.decisions.find((candidate) => candidate.id === action.decisionId);
              return <div className={styles.actionLine} key={action.id}><ArrowRight aria-hidden="true" /><span><b>{action.title}</b><small>{action.status === "completed" ? "完了" : action.ownerLabel || "担当未設定"} · {formatDate(action.dueDate)} · 次回 {formatDate(action.nextReviewOn)}</small></span>{canManage && decision && <button type="button" onClick={() => onEdit({ kind: "edit_action", issue, decision, action })}>編集</button>}</div>;
            })}
          </section>}
          {canManage && <div className={styles.detailActions}><button type="button" onClick={() => onEdit({ kind: "create_decision", issue })}><Target aria-hidden="true" />判断を会議へ載せる</button></div>}
        </div>
      </details>
    </article>
  );
}

export function SxWeeklyControlDashboard({ bundle, access }: { bundle: ProjectWorkspaceBundle; access: CurrentMemberAccess }) {
  const [management, setManagement] = useState(bundle.sxManagement);
  const [trackFilter, setTrackFilter] = useState<SxTrackKey | "all">("all");
  const [viewFilter, setViewFilter] = useState<ViewFilter>("all");
  const [query, setQuery] = useState("");
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string | null>(null);

  const allIssues = useMemo(() => [...management.issues].sort((left, right) => sxWeeklyIssueAttentionScore(right, management.asOf) - sxWeeklyIssueAttentionScore(left, management.asOf) || (sxWeeklyIssueNextDueDate(left) || "9999").localeCompare(sxWeeklyIssueNextDueDate(right) || "9999")), [management]);
  const counts = useMemo(() => ({
    attention: allIssues.filter((issue) => sxWeeklyIssueNeedsAttention(issue, management.asOf)).length,
    stale: allIssues.filter((issue) => sxWeeklyIssueIsStale(issue, management.asOf) && sxWeeklyIssueStage(issue) !== "resolved").length,
    overdue: allIssues.filter((issue) => sxWeeklyIssueIsOverdue(issue, management.asOf)).length,
    decisions: management.decisions.filter((decision) => decision.status === "open").length,
  }), [allIssues, management]);
  const visibleIssues = useMemo(() => allIssues.filter((issue) => {
    if (trackFilter !== "all" && issue.track !== trackFilter) return false;
    if (viewFilter === "attention" && !sxWeeklyIssueNeedsAttention(issue, management.asOf)) return false;
    if (viewFilter === "stale" && !sxWeeklyIssueIsStale(issue, management.asOf)) return false;
    if (viewFilter === "overdue" && !sxWeeklyIssueIsOverdue(issue, management.asOf)) return false;
    const normalized = query.trim().toLowerCase();
    if (!normalized) return true;
    return `${issue.title} ${issue.ownerLabel} ${issue.hypotheses.map((hypothesis) => hypothesis.statement).join(" ")}`.toLowerCase().includes(normalized);
  }), [allIssues, management.asOf, query, trackFilter, viewFilter]);
  const stageGroups = useMemo(() => Object.fromEntries(STAGES.map((stage) => [stage.key, visibleIssues.filter((issue) => sxWeeklyIssueStage(issue) === stage.key)])) as Record<StageKey, SxManagementIssue[]>, [visibleIssues]);
  const pendingDecisions = management.decisions.filter((decision) => decision.status === "open").sort((left, right) => Number(right.isThisWeek) - Number(left.isThisWeek) || (left.dueDate || "9999").localeCompare(right.dueDate || "9999")).slice(0, 3);
  const interventions = allIssues.filter((issue) => sxWeeklyIssueNeedsAttention(issue, management.asOf)).slice(0, 3);
  const enteredMembers = bundle.members.filter((member) => member.plannedHours > 0 || member.actualHours > 0).length;
  const timeline = useMemo(() => deriveSxUnifiedTimeline({
    today: management.asOf,
    milestones: management.milestones,
    criticalPathSlugs: management.judgment.criticalPathSlugs,
    dagValid: management.judgment.dagValid,
    tracks: management.tracks.map((track) => ({ key: track.key, label: track.label, shortLabel: track.shortLabel, accent: track.accent, deltaDays: track.deltaDays, dateCertainty: track.dateCertainty, maxIssue: track.maxIssue })),
    objectiveTargetDate: management.objective?.targetDate ?? null,
    interventionRows: [],
    pinCount: 0,
  }), [management]);
  const selectedMilestone = management.milestones.find((milestone) => milestone.id === selectedMilestoneId) ?? null;

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
              <span className={styles.productBadge}><ShieldCheck aria-hidden="true" />SX / 週次管制</span>
              <span className={styles.previewBadge}>抽出接続前 · 現行台帳の仮表示</span>
              <span className={styles.scopeBadge}>{access.scope === "project" ? "参加PJ限定" : "AMD管理ビュー"}</span>
            </div>
            <div className={styles.headerActions}>
              <Link href={`/project/${encodeURIComponent(bundle.project.projectId)}/workspace`}><ExternalLink aria-hidden="true" />既存ワークスペース</Link>
              {management.canManage && <button type="button" onClick={() => setEditor({ kind: "create_issue" })}><Plus aria-hidden="true" />論点を起票</button>}
            </div>
          </div>
          <div className={styles.titleRow}>
            <div>
              <p className={styles.eyebrow}>{sxWeeklyWeekRangeLabel(bundle.currentWeekStart)} / WEEKLY CONTROL</p>
              <h1>週次管制 <span>/ {bundle.project.projectName}</span></h1>
            </div>
            <div className={styles.readinessStamp}>
              <span>画面</span><strong>運用準備中</strong><small>情報抽出は次工程</small>
            </div>
          </div>
          <nav className={styles.sectionNav} aria-label="週次管制ナビ">
            <a href="#weekly-change">週次差分</a>
            <a href="#project-gantt">ガント</a>
            <a href="#issue-hypothesis">論点・仮説</a>
            <a href="#input-readiness">データ接続</a>
          </nav>
        </header>

        <section className={styles.statusBand} aria-label="週次の注意状況">
          <div><span>判断待ち</span><strong>{counts.decisions}</strong><small>現行台帳</small></div>
          <div data-alert={counts.attention > 0 || undefined}><span>要フォロー</span><strong>{counts.attention}</strong><small>担当・期限・検証を確認</small></div>
          <div data-alert={counts.stale > 0 || undefined}><span>更新切れ</span><strong>{counts.stale}</strong><small>7日以上未確認</small></div>
          <div data-alert={counts.overdue > 0 || undefined}><span>期限超過</span><strong>{counts.overdue}</strong><small>未完了のみ</small></div>
          <div><span>今週入力</span><strong>{enteredMembers}<em>/{bundle.members.length}</em></strong><small>現行工数台帳</small></div>
        </section>

        <section id="weekly-change" className={styles.section}>
          <div className={styles.sectionHeading}>
            <div><h2>週次差分・判断・介入</h2></div>
          </div>
          <div className={styles.flowRail}>
            <article className={styles.flowStep}>
              <div className={styles.flowNumber}>01</div><div className={styles.flowIcon}><GitBranch aria-hidden="true" /></div>
              <p className={styles.flowKicker}>先週 → 今週</p><h3>先週からの差分</h3>
              <ul className={styles.placeholderList}>
                <li><span>完了した成果</span><b>抽出接続待ち</b></li>
                <li><span>予測日の変更</span><b>抽出接続待ち</b></li>
                <li><span>新しい詰まり</span><b>抽出接続待ち</b></li>
              </ul>
            </article>
            <article className={styles.flowStep}>
              <div className={styles.flowNumber}>02</div><div className={styles.flowIcon}><Target aria-hidden="true" /></div>
              <p className={styles.flowKicker}>今回の会議</p><h3>今週の判断</h3>
              <div className={styles.flowItems}>{pendingDecisions.length > 0 ? pendingDecisions.map((decision) => <div key={decision.id}><span>{trackMeta(decision.track).short}</span><p>{decision.title}</p><small>{decision.ownerLabel || "担当未設定"} · {formatDate(decision.dueDate)}</small></div>) : <p className={styles.emptyState}>判断対象の抽出待ち</p>}</div>
            </article>
            <article className={styles.flowStep}>
              <div className={styles.flowNumber}>03</div><div className={styles.flowIcon}><ArrowRight aria-hidden="true" /></div>
              <p className={styles.flowKicker}>決定 → 介入</p><h3>決定後の介入</h3>
              <div className={styles.flowItems}>{interventions.length > 0 ? interventions.map((issue) => <div key={issue.id}><span>{sxWeeklyIssueIsOverdue(issue, management.asOf) ? "期限超過" : sxWeeklyIssueIsStale(issue, management.asOf) ? "更新切れ" : "要整理"}</span><p>{issue.title}</p><small>{sxWeeklyValueMissing(issue.ownerLabel) ? "担当を置く" : issue.ownerLabel} · {sxWeeklyIssueNextDueDate(issue) ? formatDate(sxWeeklyIssueNextDueDate(issue)) : "期限を置く"}</small></div>) : <p className={styles.emptyState}>介入候補の抽出待ち</p>}</div>
            </article>
          </div>
        </section>

        <section id="project-gantt" className={styles.section}>
          <div className={styles.sectionHeading}>
            <div><h2>全体ガント</h2></div>
            <p>基準日 {formatDate(management.asOf)}</p>
          </div>
          <div className={styles.ganttFrame}>
            <SxUnifiedTimeline timeline={timeline} asOf={management.asOf} selectedMilestoneId={selectedMilestoneId} onSelectMilestone={setSelectedMilestoneId} canManage={false} onEditMilestone={() => {}} onCreateMilestone={() => {}} showPins={false} />
          </div>
          {selectedMilestone && <div className={styles.ganttSelection} aria-live="polite">
            <div><span>選択中</span><strong>{selectedMilestone.title}</strong></div>
            <dl>
              <div><dt>ゲート</dt><dd>{selectedMilestone.gate || "未設定"}</dd></div>
              <div><dt>担当</dt><dd>{selectedMilestone.ownerLabel || "担当未設定"}</dd></div>
              <div><dt>予定</dt><dd>{formatDate(selectedMilestone.plannedEnd)}</dd></div>
              <div><dt>予測</dt><dd>{formatDate(selectedMilestone.forecastEnd)}</dd></div>
            </dl>
            <Link href={`/project/${encodeURIComponent(bundle.project.projectId)}/workspace#management-plan`}>計画詳細<ArrowRight aria-hidden="true" /></Link>
          </div>}
        </section>

        <section id="issue-hypothesis" className={styles.section}>
          <div className={styles.issueHeading}>
            <div><h2>論点・仮説リスト</h2></div>
            {management.canManage && <button type="button" className={styles.primaryButton} onClick={() => setEditor({ kind: "create_issue" })}><Plus aria-hidden="true" />論点を起票</button>}
          </div>
          <div className={styles.controls}>
            <div className={styles.searchBox}><Search aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="論点・仮説・担当で検索" aria-label="論点・仮説を検索" /></div>
            <div className={styles.filterGroup} aria-label="状態フィルター">
              {([['all', `すべて ${allIssues.length}`], ['attention', `要フォロー ${counts.attention}`], ['stale', `更新切れ ${counts.stale}`], ['overdue', `期限超過 ${counts.overdue}`]] as Array<[ViewFilter, string]>).map(([key, label]) => <button type="button" key={key} data-active={viewFilter === key || undefined} onClick={() => setViewFilter(key)}>{label}</button>)}
            </div>
            <select className={styles.trackSelect} value={trackFilter} onChange={(event) => setTrackFilter(event.target.value as SxTrackKey | "all")} aria-label="柱で絞り込み"><option value="all">4本柱すべて</option>{TRACKS.map((track) => <option key={track.key} value={track.key}>{track.label}</option>)}</select>
          </div>
          <div className={styles.issueBoard}>
            {STAGES.map((stage) => <section className={styles.stageColumn} key={stage.key}>
              <header><span>{stage.index}</span><div><h3>{stage.label}</h3></div><strong>{stageGroups[stage.key].length}</strong></header>
              <div className={styles.stageCards}>{stageGroups[stage.key].map((issue) => <IssueCard key={issue.id} issue={issue} asOf={management.asOf} canManage={management.canManage} onEdit={setEditor} />)}{stageGroups[stage.key].length === 0 && <div className={styles.columnEmpty}><CircleDot aria-hidden="true" /><p>{query || viewFilter !== "all" || trackFilter !== "all" ? "条件に合う論点なし" : "この段階の論点なし"}</p></div>}</div>
            </section>)}
          </div>
        </section>

        <section id="input-readiness" className={styles.inputSection}>
          <div><h2>データ接続状況</h2></div>
          <div className={styles.inputCards}>
            <article><FileSearch aria-hidden="true" /><div><span>週次差分</span><strong>接続待ち</strong><small>完了・予測変更・新しい詰まり</small></div></article>
            <article><FlaskConical aria-hidden="true" /><div><span>論点・仮説</span><strong>{management.issues.length}件</strong><small>現行管理台帳から仮表示</small></div></article>
            <article><CalendarClock aria-hidden="true" /><div><span>人員配分</span><strong>{bundle.effort.actualHours.toFixed(1)}h</strong><small>入力 {enteredMembers}/{bundle.members.length}名 · 現行工数台帳</small></div></article>
            <article><Lightbulb aria-hidden="true" /><div><span>検証履歴</span><strong>{management.validationRuns.length}件</strong><small>次の検証と結果の接続口</small></div></article>
          </div>
        </section>
        <footer className={styles.pageFooter}><span>基準日 {formatDate(management.asOf)} · 表示値は現行台帳の仮表示</span><Link href={`/project/${encodeURIComponent(bundle.project.projectId)}/workspace#management-plan`}>計画詳細を既存画面で開く<ArrowRight aria-hidden="true" /></Link></footer>
      </div>
      {notice && <div className={styles.toast} role="status"><Check aria-hidden="true" />{notice}</div>}
      {editor && <IssueEditor key={`${editor.kind}-${"issue" in editor ? editor.issue.id : "new"}-${"hypothesis" in editor ? editor.hypothesis?.id || "" : ""}-${"decision" in editor ? editor.decision.id : ""}-${"action" in editor ? editor.action.id : ""}`} editor={editor} management={management} access={access} projectId={bundle.project.projectId} onClose={() => setEditor(null)} onSaved={handleSaved} />}
    </main>
  );
}
