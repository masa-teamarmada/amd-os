"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { ProjectWorkspaceBundle } from "@/lib/project-workspace";
import type {
  SxManagementBundle,
  SxManagementIssue,
  SxManagementMilestone,
  SxTask,
} from "@/lib/sx-management";
import type { EditorState } from "./SxWeeklyControlDashboard";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { THEME_HUB_MEETING_WRITE_ENABLED, THEME_HUB_MEETING_WRITE_BLOCKED_MESSAGE } from "@/lib/theme-hub-rollout";
import styles from "./project-theme-routes.module.css";
import { ThemeHistory } from "./ThemeHistory";

type ThemeData = ProjectWorkspaceBundle["themes"][number];
type MilestoneData = ThemeData["milestones"][number];
type MeetingData = ThemeData["meetings"][number];
type DeliverableData = ThemeData["deliverables"][number];
type AllMeetingData = ProjectWorkspaceBundle["allMeetings"][number];
type MemberData = ProjectWorkspaceBundle["members"][number];
type WorkspaceDocumentOption = { documentId: string; displayName: string; mimeType: string };

const SOURCE_LABEL: Record<string, string> = {
  routine_auto: "予定進行",
  pm_manual: "手動確定",
  pm_confirmed: "PM確定",
  pm_rejected: "修正なしで確定",
  criteria_toggle: "達成条件で確定",
  tsukuyomi_revision: "承認済み修正",
  manual: "手動記録",
  meeting_summary: "会議記録",
  calendar: "予定記録",
  gmail: "メール記録",
  slack: "Slack記録",
  drive: "資料記録",
  notion: "Notion記録",
};

const PM_LOCKED_SOURCES = new Set([
  "pm_manual",
  "pm_confirmed",
  "pm_rejected",
  "criteria_toggle",
  "tsukuyomi_revision",
]);

const TASK_STATUS_LABEL: Record<string, string> = {
  not_started: "未着手",
  unassessed: "進捗未登録",
  on_track: "進行中",
  attention: "要確認",
  at_risk: "遅れ懸念",
  blocked: "停止",
  completed: "完了",
};

const ISSUE_STATUS_LABEL: Record<string, string> = {
  open: "未着手",
  validating: "検証中",
  decided: "決定済み",
  closed: "終了",
  on_hold: "保留",
};

const DECISION_STATUS_LABEL: Record<string, string> = {
  open: "判断待ち",
  decided: "決定済み",
  deferred: "先送り",
};

const DELIVERABLE_STATUS_LABEL: Record<string, string> = {
  planned: "予定",
  in_progress: "作成中",
  submitted: "提出済み",
  linked: "資料ひもづけ済み",
  cancelled: "取りやめ",
};

const RELATION_LABEL: Record<string, string> = {
  relates_to: "関連する",
  discussed_in: "会議で話した",
  produced: "この作業から生まれた",
  resolved_by: "これで解決した",
};

// root review (second pass): raw draft/file DB identifiers must never leak to the screen —
// project_meeting_summaries.prep_status (093_meeting_workflow_orchestration.sql: "draft /
// nudging / ready / facilitator_needed / completed など") and workspace_documents.entry_kind
// (216_workspace_document_rooms.sql: file/link/folder).
const PREP_STATUS_LABEL: Record<string, string> = {
  draft: "準備中",
  nudging: "催促中",
  ready: "準備完了",
  facilitator_needed: "進行役未定",
  completed: "完了",
};
function prepStatusLabel(value: string | null): string {
  if (!value) return "準備状態未確認";
  return PREP_STATUS_LABEL[value] ?? value;
}
const ENTRY_KIND_LABEL: Record<string, string> = {
  file: "資料",
  link: "リンク",
  folder: "フォルダ",
};
function entryKindLabel(value: string): string {
  return ENTRY_KIND_LABEL[value] ?? value;
}

const LINK_KIND_LABEL: Record<string, string> = {
  meeting: "MTG",
  document: "資料",
  deliverable: "予定成果物",
  issue: "論点",
  task: "タスク",
  milestone: "運用マイルストーン",
  decision: "決定",
};

// project-theme-hub.ts の CANONICAL_FK_PAIRS と同じ組み合わせ。issue<->milestone / decision->
// issue / task->milestone は既に実FKで結ばれているので、work_linkへ複製しない。
const CANONICAL_FK_PAIRS = new Set([
  "issue:milestone", "milestone:issue",
  "decision:issue", "issue:decision",
  "task:milestone", "milestone:task",
]);

function formatDate(isoString: string | null | undefined): string {
  if (!isoString) return "更新未確認";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "更新未確認";
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).format(date);
}

// root review (UI completion phase, point 18): new Date().toISOString().slice(0,10) is UTC, not
// JST — between 00:00 and 08:59 JST it reports YESTERDAY's date, so "next MTG" / "overdue" checks
// silently used the wrong day for nine hours every night.
function todayJst(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function formatYmd(value: string | null | undefined): string {
  if (!value) return "未登録";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return value;
  return `${m[1]}/${m[2]}/${m[3]}`;
}

function clampProgressPct(value: number): number {
  const clamped = Math.max(0, Math.min(100, value));
  return Math.round(clamped);
}

function getProgressDateLabel(milestone: MilestoneData): string {
  if (milestone.progressConfirmedAt) return formatDate(milestone.progressConfirmedAt);
  if (milestone.progressRecordedAt) return formatDate(milestone.progressRecordedAt);
  if (milestone.progressYm && /^\d{6}$/.test(milestone.progressYm)) {
    return `${milestone.progressYm.slice(0, 4)}年${Number(milestone.progressYm.slice(4, 6))}月の月次値`;
  }
  return "更新未確認";
}

function getSourceLabel(source: string | null): string {
  if (!source) return "根拠未確認";
  return SOURCE_LABEL[source] || "未確定記録";
}

function formatTargetYm(targetYm: string | null): string {
  if (!targetYm || !/^\d{6}$/.test(targetYm)) return "目標月 未設定";
  const year = targetYm.slice(0, 4);
  const monthNum = parseInt(targetYm.slice(4, 6), 10);
  return `目標 ${year}年${monthNum}月`;
}

function getProgressLineClass(source: string | null): string {
  if (source === "routine_auto") return styles.routineAuto;
  if (source && PM_LOCKED_SOURCES.has(source)) return styles.confirmed;
  return styles.unconfirmed;
}

function MilestoneRow({ milestone, themeAccent }: { milestone: MilestoneData; themeAccent: string }) {
  const sourceLabel = getSourceLabel(milestone.progressSource);
  const isRoutineAuto = milestone.progressSource === "routine_auto";
  const isConfirmed = milestone.progressSource !== null && PM_LOCKED_SOURCES.has(milestone.progressSource);
  const clampedProgress = clampProgressPct(milestone.progressPct);
  const progressKindLabel = isRoutineAuto ? "予定進行" : isConfirmed ? "確定進捗" : "未確定進捗";

  return (
    <li className={styles.milestoneItem}>
      <div className={styles.milestoneGate} style={{ "--accent-color": themeAccent } as CSSProperties}>
        <div className={styles.gateMark} />
      </div>
      <div className={styles.milestoneContent}>
        <div className={styles.milestoneHeader}>
          <h4 className={styles.milestoneName}>{milestone.title}</h4>
          <span className={`${styles.sourceLabel} ${isRoutineAuto ? styles.routineAutoLabel : ""}`}>{sourceLabel}</span>
        </div>

        <div className={styles.progressBar}>
          <div
            className={`${styles.progressFill} ${getProgressLineClass(milestone.progressSource)}`}
            style={{
              width: `${clampedProgress}%`,
              "--accent-color": themeAccent,
            } as CSSProperties}
            role="progressbar"
            aria-valuenow={clampedProgress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${milestone.title}: ${progressKindLabel} ${clampedProgress}%`}
          />
        </div>

        <div className={styles.milestoneDetails}>
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>{progressKindLabel}</span>
            <span className={styles.detailValue}>{clampedProgress}%</span>
          </div>
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>更新日</span>
            <span className={styles.detailValue}>{getProgressDateLabel(milestone)}</span>
          </div>
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>根拠</span>
            <span className={styles.detailValue}>{sourceLabel}</span>
          </div>
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>{formatTargetYm(milestone.targetYm)}</span>
          </div>
        </div>
      </div>
    </li>
  );
}

// --- テーマ配下データの抽出ヘルパー ---------------------------------------
// root review (UI completion phase, point 11): 旧実装はtheme.taskIds/operationalMilestoneIds/
// issueIds(project-workspace.tsが都度フェッチ時に計算したスナップショット)から引いていたため、
// 共有ダッシュボードのエディタ(タスク/MS/論点の新規作成・編集)がsxManagementだけ更新すると、
// テーマハブ側は次のrefreshBundle()まで新規レコードを一切表示できなかった。project-workspace.ts
// の所属計算(taskは track一致 または 親運用MSのtrack一致、運用MSはtrack一致、論点はtrack一致)
// をここでも再計算し、常にライブのsxManagement propから直接引く。sxManagementは共有ダッシュボード
// の既存保存フロー(楽観更新+突き合わせ)で、テーマハブ発でない保存も含め常に最新に保たれている
// ので、これは「所属をコピーで再計算しない」原則に反しない — 正本のtrack/FKそのものを毎回
// 素直に読み直しているだけで、work_linkのような複製テーブルを作っていない。

function themeTasks(theme: ThemeData, sx: SxManagementBundle): SxTask[] {
  const milestoneTrackById = new Map(sx.milestones.map((m) => [m.id, m.track]));
  return sx.tasks.filter((task) => {
    const trackKey = task.track ?? (task.milestoneId ? milestoneTrackById.get(task.milestoneId) : null) ?? null;
    return trackKey === theme.themeKey;
  });
}

function themeMilestonesOperational(theme: ThemeData, sx: SxManagementBundle): SxManagementMilestone[] {
  return sx.milestones.filter((milestone) => milestone.track === theme.themeKey);
}

function themeIssues(theme: ThemeData, sx: SxManagementBundle): SxManagementIssue[] {
  return sx.issues.filter((issue) => issue.track === theme.themeKey);
}

function themeDecisions(theme: ThemeData, sx: SxManagementBundle) {
  const issueIds = new Set(themeIssues(theme, sx).map((issue) => issue.id));
  return sx.decisions.filter((decision) => decision.issueId != null && issueIds.has(decision.issueId));
}

function themeSummary(theme: ThemeData, sx: SxManagementBundle) {
  const tasks = themeTasks(theme, sx).filter((t) => t.status !== "completed");
  const opMs = themeMilestonesOperational(theme, sx).filter((m) => m.status !== "completed");
  const deliverables = theme.deliverables.filter((d) => d.status === "planned" || d.status === "in_progress");
  const dueDates: string[] = [];
  for (const t of tasks) if (t.plannedEnd) dueDates.push(t.plannedEnd);
  for (const m of opMs) if (m.plannedEnd) dueDates.push(m.plannedEnd);
  for (const d of deliverables) if (d.dueOn) dueDates.push(d.dueOn);
  dueDates.sort();
  const nearestDeadline = dueDates[0] ?? null;

  const today = todayJst();
  const futureMeetings = [...theme.meetings]
    .filter((m) => m.meetingDate >= today)
    .sort((a, b) => a.meetingDate.localeCompare(b.meetingDate));
  const nextMeeting = futureMeetings[0] ?? null;

  const openIssues = themeIssues(theme, sx).filter((i) => i.status === "open" || i.status === "validating");

  return { nearestDeadline, nextMeeting, openIssueCount: openIssues.length };
}

// --- 共通フェッチヘルパー --------------------------------------------------

class ThemeHubClientError extends Error {}

async function themeHubFetch(
  projectId: string,
  trackKey: string,
  method: "POST" | "PATCH",
  body: unknown,
): Promise<{ id?: string; meetingId?: string }> {
  const res = await fetch(`/api/project-workspace/${encodeURIComponent(projectId)}/theme/${encodeURIComponent(trackKey)}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}) as Record<string, unknown>);
  if (!res.ok || json.ok !== true) {
    throw new ThemeHubClientError(typeof json.error === "string" ? json.error : "保存できなかったよ");
  }
  return json as { id?: string; meetingId?: string };
}

function useStableClientToken(): string {
  const [token] = useState(() => crypto.randomUUID());
  return token;
}

// --- テーマ選択行 -----------------------------------------------------------

function ThemeSelectorRow({
  theme,
  themeIndex,
  active,
  summary,
  onSelect,
}: {
  theme: ThemeData;
  themeIndex: number;
  active: boolean;
  summary: ReturnType<typeof themeSummary>;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={`${styles.themeSelectorRow} ${active ? styles.themeSelectorRowActive : ""}`}
      style={{ "--accent-color": theme.accent } as CSSProperties}
      onClick={onSelect}
      aria-pressed={active}
    >
      <span className={styles.themeSelectorName}>
        {String(themeIndex + 1).padStart(2, "0")} {theme.label}
      </span>
      <span className={styles.themeSelectorStat}>
        <span className={styles.themeSelectorStatLabel}>直近期限</span>
        <span className={styles.themeSelectorStatValue}>{summary.nearestDeadline ? formatYmd(summary.nearestDeadline) : "未登録"}</span>
      </span>
      <span className={styles.themeSelectorStat}>
        <span className={styles.themeSelectorStatLabel}>次回MTG</span>
        <span className={styles.themeSelectorStatValue}>{summary.nextMeeting ? formatYmd(summary.nextMeeting.meetingDate) : "未登録"}</span>
      </span>
      <span className={styles.themeSelectorStat}>
        <span className={styles.themeSelectorStatLabel}>未決の論点</span>
        <span className={styles.themeSelectorStatValue}>{summary.openIssueCount}件</span>
      </span>
    </button>
  );
}

// --- テーマの目的/現状/次の焦点 編集 -----------------------------------------

function EditProfileDialog({
  projectId,
  trackKey,
  profile,
  onClose,
  onSaved,
}: {
  projectId: string;
  trackKey: string;
  profile: ThemeData["profile"];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [purposeMd, setPurposeMd] = useState(profile?.purposeMd ?? "");
  const [currentStateMd, setCurrentStateMd] = useState(profile?.currentStateMd ?? "");
  const [nextFocusNote, setNextFocusNote] = useState(profile?.nextFocusNote ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      await themeHubFetch(projectId, trackKey, "PATCH", {
        resource: "profile",
        fields: { purpose_md: purposeMd, current_state_md: currentStateMd, next_focus_note: nextFocusNote },
        expected_version: profile ? profile.version : null,
      });
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存できなかったよ");
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className={`sm:max-w-lg ${styles.scrollDialog}`}>
        <DialogHeader>
          <DialogTitle>テーマの目的・現状を編集</DialogTitle>
          <DialogDescription>目的・現状・次の焦点。空欄は「未登録」として表示されるよ。</DialogDescription>
        </DialogHeader>
        <div className={`${styles.formGrid} ${styles.scrollDialogBody}`}>
          {error && <div className={styles.formError} role="alert">{error}</div>}
          <div className={styles.formField}>
            <label className={styles.formLabel} htmlFor="theme-purpose">目的</label>
            <Textarea id="theme-purpose" value={purposeMd} onChange={(e) => setPurposeMd(e.target.value)} disabled={saving} rows={3} />
          </div>
          <div className={styles.formField}>
            <label className={styles.formLabel} htmlFor="theme-state">現状</label>
            <Textarea id="theme-state" value={currentStateMd} onChange={(e) => setCurrentStateMd(e.target.value)} disabled={saving} rows={3} />
          </div>
          <div className={styles.formField}>
            <label className={styles.formLabel} htmlFor="theme-focus">次の焦点</label>
            <Textarea id="theme-focus" value={nextFocusNote} onChange={(e) => setNextFocusNote(e.target.value)} disabled={saving} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>キャンセル</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "保存中…" : "保存する"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- MTG作成/編集 -----------------------------------------------------------

function MeetingFormDialog({
  projectId,
  trackKey,
  meeting,
  readOnly,
  onClose,
  onSaved,
}: {
  projectId: string;
  trackKey: string;
  meeting: MeetingData | null;
  /** root review (second pass): canManage=false viewers must reach a real read-only detail view
   * (title/date/prep/outcome visible), never a live Save/Remove dialog — blocking the click
   * entirely is not an acceptable substitute. */
  readOnly: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const clientToken = useStableClientToken();
  const [title, setTitle] = useState(meeting?.title ?? "");
  const [meetingDate, setMeetingDate] = useState(meeting?.meetingDate ?? "");
  const [prepDraftMd, setPrepDraftMd] = useState(meeting?.prepDraftMd ?? "");
  const [summaryShort, setSummaryShort] = useState(meeting?.summaryShort ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!title.trim() || !meetingDate) {
      setError("タイトルと日付は必須だよ");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (meeting) {
        await themeHubFetch(projectId, trackKey, "PATCH", {
          resource: "meeting",
          id: meeting.meetingId,
          fields: { title, meeting_date: meetingDate, prep_draft_md: prepDraftMd || null, summary_short: summaryShort },
          expected_updated_at: meeting.meetingUpdatedAt,
        });
      } else {
        await themeHubFetch(projectId, trackKey, "POST", {
          resource: "meeting",
          fields: { title, meeting_date: meetingDate, prep_draft_md: prepDraftMd || null, summary_short: summaryShort, client_token: clientToken },
        });
      }
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存できなかったよ");
      setSaving(false);
    }
  }

  async function unlink() {
    if (!meeting) return;
    if (!window.confirm("このMTGをテーマから外すよ。記録自体は残るよ。よい?")) return;
    setSaving(true);
    setError(null);
    try {
      await themeHubFetch(projectId, trackKey, "PATCH", {
        resource: "meeting",
        id: meeting.meetingId,
        delete: true,
        expected_version: meeting.linkVersion,
      });
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "外せなかったよ");
      setSaving(false);
    }
  }

  // Safe partial release: MTG create/edit stays disabled until root has an approved, scoped
  // resolution for project_meeting_summaries' existing anon-readable read policy. Read/unlink/
  // canonical-card navigation are unaffected — see src/lib/theme-hub-rollout.ts.
  const writeBlocked = !THEME_HUB_MEETING_WRITE_ENABLED;
  const fieldsDisabled = saving || readOnly || writeBlocked;
  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className={`sm:max-w-lg ${styles.scrollDialog}`}>
        <DialogHeader>
          <DialogTitle>{readOnly || writeBlocked ? "MTGの内容" : meeting ? "MTGを編集" : "MTGを記録"}</DialogTitle>
          <DialogDescription>タイトル・日付・準備・会議後の概要は同じ会議記録として保存されるよ。</DialogDescription>
        </DialogHeader>
        <div className={`${styles.formGrid} ${styles.scrollDialogBody}`}>
          {error && <div className={styles.formError} role="alert">{error}</div>}
          {writeBlocked && <div className={styles.formError} role="alert">{THEME_HUB_MEETING_WRITE_BLOCKED_MESSAGE}</div>}
          {meeting && !readOnly && (
            <a
              href={`/project/${encodeURIComponent(projectId)}/cockpit?meeting=${encodeURIComponent(meeting.meetingId)}`}
              target="_blank"
              rel="noreferrer"
              className={styles.detailRowSub}
            >
              コックピットのMTGカードで開く
            </a>
          )}
          <div className={styles.formField}>
            <label className={styles.formLabel} htmlFor="mtg-title">タイトル *</label>
            <Input id="mtg-title" value={title} onChange={(e) => setTitle(e.target.value)} disabled={fieldsDisabled} required />
          </div>
          <div className={styles.formField}>
            <label className={styles.formLabel} htmlFor="mtg-date">日付 *</label>
            <Input id="mtg-date" type="date" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} disabled={fieldsDisabled} required />
          </div>
          <div className={styles.formField}>
            <label className={styles.formLabel} htmlFor="mtg-prep">準備</label>
            <Textarea id="mtg-prep" value={prepDraftMd} onChange={(e) => setPrepDraftMd(e.target.value)} disabled={fieldsDisabled} rows={3} />
          </div>
          <div className={styles.formField}>
            <label className={styles.formLabel} htmlFor="mtg-summary">会議後の概要</label>
            <Textarea id="mtg-summary" value={summaryShort} onChange={(e) => setSummaryShort(e.target.value)} disabled={fieldsDisabled} rows={3} />
          </div>
        </div>
        <DialogFooter>
          {!readOnly && meeting && (
            <Button variant="ghost" onClick={unlink} disabled={saving}>このテーマから外す</Button>
          )}
          {readOnly || writeBlocked ? (
            <Button variant="outline" onClick={onClose}>閉じる</Button>
          ) : (
            <>
              <Button variant="outline" onClick={onClose} disabled={saving}>キャンセル</Button>
              <Button onClick={submit} disabled={saving}>{saving ? "保存中…" : "保存する"}</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- 既存レコード選択(共通の検索リスト) -------------------------------------

function SearchPickerList<T>({
  items,
  getLabel,
  getKey,
  onPick,
  emptyLabel,
  placeholder,
  disabled = false,
}: {
  items: T[];
  getLabel: (item: T) => string;
  getKey: (item: T) => string;
  onPick: (item: T) => void;
  emptyLabel: string;
  placeholder: string;
  /** root review (UI completion phase, point 15): pick() had no in-flight guard, so a double
   * click (or two different rows clicked in quick succession) could fire two concurrent writes
   * before the dialog closed. Disabled while the caller's own save is in flight. */
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return items;
    return items.filter((item) => getLabel(item).includes(q));
  }, [items, query, getLabel]);
  return (
    <div className={styles.formGrid}>
      <Input placeholder={placeholder} value={query} onChange={(e) => setQuery(e.target.value)} disabled={disabled} aria-label={placeholder} />
      <div className={styles.pickerList}>
        {filtered.length === 0 && <div className={styles.detailEmpty}>{emptyLabel}</div>}
        {filtered.map((item) => (
          <button key={getKey(item)} type="button" className={styles.pickerRow} disabled={disabled} onClick={() => onPick(item)}>
            {getLabel(item)}
          </button>
        ))}
      </div>
    </div>
  );
}

// --- 既存MTGを紐付け ---------------------------------------------------------

function LinkMeetingDialog({
  projectId,
  trackKey,
  allMeetings,
  alreadyLinkedIds,
  onClose,
  onSaved,
}: {
  projectId: string;
  trackKey: string;
  allMeetings: AllMeetingData[];
  alreadyLinkedIds: Set<string>;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const candidates = useMemo(
    () => [...allMeetings].filter((m) => !alreadyLinkedIds.has(m.meetingId)).sort((a, b) => b.meetingDate.localeCompare(a.meetingDate)),
    [allMeetings, alreadyLinkedIds],
  );

  async function pick(meeting: AllMeetingData) {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await themeHubFetch(projectId, trackKey, "POST", { resource: "meeting_link", fields: { meeting_id: meeting.meetingId } });
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "紐付けられなかったよ");
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className={`sm:max-w-lg ${styles.scrollDialog}`}>
        <DialogHeader>
          <DialogTitle>既存のMTGを紐付け</DialogTitle>
          <DialogDescription>PJの全MTG({allMeetings.length}件)から選べるよ。1件のMTGは複数のテーマに紐付けられるよ。</DialogDescription>
        </DialogHeader>
        {error && <div className={styles.formError} role="alert">{error}</div>}
        <SearchPickerList
          items={candidates}
          getKey={(m) => m.meetingId}
          getLabel={(m) => `${formatYmd(m.meetingDate)} ${m.title}`}
          onPick={pick}
          emptyLabel="該当するMTGがないよ"
          placeholder="タイトルで検索"
          disabled={saving}
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>閉じる</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- 既存の資料を紐付け(テーマ本体 / 予定成果物への紐付け 共通) -----------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function useWorkspaceDocuments(projectId: string, active: boolean) {
  const [documents, setDocuments] = useState<WorkspaceDocumentOption[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  const retry = () => setRetryTick((t) => t + 1);
  useEffect(() => {
    if (!active) return;
    void retryTick;
    let cancelled = false;
    // surface未指定(既定=cockpit)にする(root review, UI completion phase, point 17): テーマ
    // ハブは内部の作業画面なので、権限のある内部メンバーには workspace_shared 限定ではなく
    // 実際に読める全社内資料を見せる — 紐付けたいだけの下書きを無理に外部共有させない。
    // route側がaccess.canReadInternalを見て未読み込み権限のメンバーには自動でworkspace_shared
    // へ絞るので、ここでは常に同じURLで呼んで安全。
    fetch(`/api/workspace-documents?scope_kind=project&scope_id=${encodeURIComponent(projectId)}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (json.ok) {
          setLoadError(null);
          setDocuments(
            (json.documents as Array<{ documentId: string; displayName: string; mimeType: string; entryKind?: string }>)
              // root review point 6: 月次帳票などの仮想entry(documentIdがworkspace_documentsの
              // 実uuidでない)はdocument_linkのFKが必ず拒否する。ここで先に弾いて、選べるのに
              // 保存できないという体験を避ける。folder(entry_kind)も紐付け対象ではない。
              .filter((d) => UUID_RE.test(d.documentId) && d.entryKind !== "folder")
              .map((d) => ({ documentId: d.documentId, displayName: d.displayName, mimeType: d.mimeType })),
          );
        } else {
          setLoadError(typeof json.error === "string" ? json.error : "資料一覧を読み込めなかったよ");
        }
      })
      .catch(() => !cancelled && setLoadError("資料一覧を読み込めなかったよ"));
    return () => {
      cancelled = true;
    };
  }, [projectId, active, retryTick]);
  return { documents, loadError, retry };
}

function LinkDocumentDialog({
  projectId,
  trackKey,
  alreadyLinkedIds,
  onClose,
  onSaved,
}: {
  projectId: string;
  trackKey: string;
  alreadyLinkedIds: Set<string>;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { documents, loadError, retry } = useWorkspaceDocuments(projectId, true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const candidates = useMemo(() => (documents ?? []).filter((d) => !alreadyLinkedIds.has(d.documentId)), [documents, alreadyLinkedIds]);

  async function pick(doc: WorkspaceDocumentOption) {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await themeHubFetch(projectId, trackKey, "POST", { resource: "document_link", fields: { document_id: doc.documentId } });
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "紐付けられなかったよ");
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className={`sm:max-w-lg ${styles.scrollDialog}`}>
        <DialogHeader>
          <DialogTitle>既存の資料を紐付け</DialogTitle>
          <DialogDescription>読める内部資料から選べるよ。1件の資料は複数のテーマに紐付けられるよ。</DialogDescription>
        </DialogHeader>
        {(error || loadError) && <div className={styles.formError} role="alert">{error || loadError}</div>}
        {documents === null && !loadError ? (
          <div className={styles.detailEmpty}>読み込み中…</div>
        ) : loadError ? (
          <Button variant="outline" size="sm" onClick={retry}>もう一度読み込む</Button>
        ) : (
          <SearchPickerList
            items={candidates}
            getKey={(d) => d.documentId}
            getLabel={(d) => d.displayName}
            onPick={pick}
            emptyLabel="該当する資料がないよ"
            placeholder="資料名で検索"
            disabled={saving}
          />
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>閉じる</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- 予定成果物 作成/編集 -----------------------------------------------------

function DeliverableFormDialog({
  projectId,
  trackKey,
  deliverable,
  members,
  readOnly,
  onClose,
  onSaved,
}: {
  projectId: string;
  trackKey: string;
  deliverable: DeliverableData | null;
  members: MemberData[];
  readOnly: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const clientToken = useStableClientToken();
  const [title, setTitle] = useState(deliverable?.title ?? "");
  const [descriptionMd, setDescriptionMd] = useState(deliverable?.descriptionMd ?? "");
  const [ownerMemberId, setOwnerMemberId] = useState(deliverable?.ownerMemberId ?? "");
  const [dueOn, setDueOn] = useState(deliverable?.dueOn ?? "");
  const [status, setStatus] = useState(deliverable?.status ?? "planned");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickingDocument, setPickingDocument] = useState(false);
  const { documents, loadError: documentLoadError, retry: retryDocuments } = useWorkspaceDocuments(projectId, pickingDocument);

  async function submit() {
    if (!title.trim()) {
      setError("タイトルは必須だよ");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (deliverable) {
        await themeHubFetch(projectId, trackKey, "PATCH", {
          resource: "deliverable",
          id: deliverable.id,
          fields: {
            title, description_md: descriptionMd || null, owner_member_id: ownerMemberId || null,
            due_on: dueOn || null, status,
          },
          expected_version: deliverable.version,
        });
      } else {
        await themeHubFetch(projectId, trackKey, "POST", {
          resource: "deliverable",
          fields: { title, description_md: descriptionMd || null, owner_member_id: ownerMemberId || null, due_on: dueOn || null, client_token: clientToken },
        });
      }
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存できなかったよ");
      setSaving(false);
    }
  }

  async function linkDocument(doc: WorkspaceDocumentOption) {
    if (!deliverable || saving) return;
    setSaving(true);
    setError(null);
    try {
      // root review (UI completion phase, point 16): this used to send ONLY
      // linked_document_id/status, so any unsaved title/owner/due edit sitting in the form behind
      // this picker silently vanished the moment a document was picked (pickPresent on the server
      // only writes keys it's actually sent, so the edited values in `title`/`ownerMemberId`/
      // `dueOn` state here never reached the DB — the user would see them, then lose them). Same
      // PATCH now carries the full current editable field set atomically.
      await themeHubFetch(projectId, trackKey, "PATCH", {
        resource: "deliverable",
        id: deliverable.id,
        fields: {
          title, description_md: descriptionMd || null, owner_member_id: ownerMemberId || null,
          due_on: dueOn || null, linked_document_id: doc.documentId, status: "linked",
        },
        expected_version: deliverable.version,
      });
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ひもづけられなかったよ");
      setSaving(false);
    }
  }

  async function unlinkDocument() {
    // root review point 16: "give proper unlink/replace handling" — status='linked' without a
    // file is rejected by the DB CHECK, so reverting must go back to a real pre-file status too.
    if (!deliverable || saving) return;
    setSaving(true);
    setError(null);
    try {
      await themeHubFetch(projectId, trackKey, "PATCH", {
        resource: "deliverable",
        id: deliverable.id,
        fields: {
          title, description_md: descriptionMd || null, owner_member_id: ownerMemberId || null,
          due_on: dueOn || null, linked_document_id: null, status: "planned",
        },
        expected_version: deliverable.version,
      });
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "外せなかったよ");
      setSaving(false);
    }
  }

  async function remove() {
    if (!deliverable) return;
    if (!window.confirm("この予定成果物を削除するよ。よい?")) return;
    setSaving(true);
    setError(null);
    try {
      await themeHubFetch(projectId, trackKey, "PATCH", { resource: "deliverable", id: deliverable.id, delete: true, expected_version: deliverable.version });
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "削除できなかったよ");
      setSaving(false);
    }
  }

  if (pickingDocument) {
    return (
      <Dialog open onOpenChange={(open) => !open && setPickingDocument(false)}>
        <DialogContent className={`sm:max-w-lg ${styles.scrollDialog}`}>
          <DialogHeader>
            <DialogTitle>資料をひもづける</DialogTitle>
          </DialogHeader>
          {(error || documentLoadError) && <div className={styles.formError} role="alert">{error || documentLoadError}</div>}
          {documents === null && !documentLoadError ? (
            <div className={styles.detailEmpty}>読み込み中…</div>
          ) : documentLoadError ? (
            <Button variant="outline" size="sm" onClick={retryDocuments}>
              もう一度読み込む
            </Button>
          ) : (
            <SearchPickerList
              items={documents ?? []}
              getKey={(d) => d.documentId}
              getLabel={(d) => d.displayName}
              onPick={linkDocument}
              emptyLabel="資料が見つからないよ"
              placeholder="資料名で検索"
              disabled={saving}
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPickingDocument(false)} disabled={saving}>戻る</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  const fieldsDisabled = saving || readOnly;
  // "linked" is only a valid status when a document is actually attached — the DB CHECK
  // (status <> 'linked' OR linked_document_id IS NOT NULL) already rejects offering it without
  // one, but the select should never present a choice the server will reject either (root
  // review, second pass: "status select offers linked without a linked doc").
  const statusOptions = Object.entries(DELIVERABLE_STATUS_LABEL).filter(
    ([value]) => value !== "linked" || deliverable?.linkedDocumentId,
  );
  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className={`sm:max-w-lg ${styles.scrollDialog}`}>
        <DialogHeader>
          <DialogTitle>{readOnly ? "予定成果物の内容" : deliverable ? "予定成果物を編集" : "予定成果物を追加"}</DialogTitle>
          <DialogDescription>ファイルが無くても予定として追加できるよ。後から既存資料をひもづけられるよ。</DialogDescription>
        </DialogHeader>
        <div className={`${styles.formGrid} ${styles.scrollDialogBody}`}>
          {error && <div className={styles.formError} role="alert">{error}</div>}
          <div className={styles.formField}>
            <label className={styles.formLabel} htmlFor="deliv-title">タイトル *</label>
            <Input id="deliv-title" value={title} onChange={(e) => setTitle(e.target.value)} disabled={fieldsDisabled} required />
          </div>
          <div className={styles.dialogFieldRow}>
            <div className={styles.formField}>
              <label className={styles.formLabel} htmlFor="deliv-owner">担当</label>
              <select id="deliv-owner" className={styles.formSelect} value={ownerMemberId} onChange={(e) => setOwnerMemberId(e.target.value)} disabled={fieldsDisabled}>
                <option value="">未登録</option>
                {members.map((m) => (
                  <option key={m.memberId} value={m.memberId}>{m.displayName}</option>
                ))}
              </select>
            </div>
            <div className={styles.formField}>
              <label className={styles.formLabel} htmlFor="deliv-due">期限</label>
              <Input id="deliv-due" type="date" value={dueOn} onChange={(e) => setDueOn(e.target.value)} disabled={fieldsDisabled} />
            </div>
          </div>
          {deliverable && (
            <div className={styles.formField}>
              <label className={styles.formLabel} htmlFor="deliv-status">状態</label>
              <select id="deliv-status" className={styles.formSelect} value={status} onChange={(e) => setStatus(e.target.value)} disabled={fieldsDisabled}>
                {statusOptions.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          )}
          <div className={styles.formField}>
            <label className={styles.formLabel} htmlFor="deliv-desc">補足</label>
            <Textarea id="deliv-desc" value={descriptionMd} onChange={(e) => setDescriptionMd(e.target.value)} disabled={fieldsDisabled} rows={3} />
          </div>
          {deliverable && (
            <div>
              {!readOnly && (
                <Button variant="outline" size="sm" onClick={() => setPickingDocument(true)} disabled={saving}>
                  既存の資料をひもづける
                </Button>
              )}
              {deliverable.linkedDocumentId && (
                <>
                  <a
                    href={`/workspace-document/${encodeURIComponent(deliverable.linkedDocumentId)}`}
                    target="_blank"
                    rel="noreferrer"
                    className={styles.detailRowSub}
                    style={{ marginLeft: readOnly ? 0 : "0.75rem" }}
                  >
                    ひもづけ済みの資料を開く
                  </a>
                  {!readOnly && (
                    <Button variant="ghost" size="sm" onClick={unlinkDocument} disabled={saving} style={{ marginLeft: "0.5rem" }}>
                      資料のひもづけを外す
                    </Button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          {readOnly ? (
            <Button variant="outline" onClick={onClose}>閉じる</Button>
          ) : (
            <>
              {deliverable && <Button variant="ghost" onClick={remove} disabled={saving}>削除する</Button>}
              <Button variant="outline" onClick={onClose} disabled={saving}>キャンセル</Button>
              <Button onClick={submit} disabled={saving}>{saving ? "保存中…" : "保存する"}</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- 作業間の関連を作る -------------------------------------------------------

type LinkEndpointOption = { id: string; label: string };

function optionsForKind(
  kind: string,
  theme: ThemeData,
  sx: SxManagementBundle,
): LinkEndpointOption[] {
  switch (kind) {
    case "meeting":
      return theme.meetings.map((m) => ({ id: m.meetingId, label: `${formatYmd(m.meetingDate)} ${m.title}` }));
    case "document":
      return theme.documents.map((d) => ({ id: d.documentId, label: d.displayName }));
    case "deliverable":
      return theme.deliverables.map((d) => ({ id: d.id, label: d.title }));
    case "issue":
      return themeIssues(theme, sx).map((i) => ({ id: i.id, label: i.title }));
    case "task":
      return themeTasks(theme, sx).map((t) => ({ id: t.id, label: t.title }));
    case "milestone":
      return themeMilestonesOperational(theme, sx).map((m) => ({ id: m.id, label: m.title }));
    case "decision":
      return themeDecisions(theme, sx).map((d) => ({ id: d.id, label: d.title }));
    default:
      return [];
  }
}

function CreateWorkLinkDialog({
  projectId,
  trackKey,
  theme,
  sxManagement,
  onClose,
  onSaved,
}: {
  projectId: string;
  trackKey: string;
  theme: ThemeData;
  sxManagement: SxManagementBundle;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const clientToken = useStableClientToken();
  const [fromKind, setFromKind] = useState("meeting");
  const [fromId, setFromId] = useState("");
  const [toKind, setToKind] = useState("issue");
  const [toId, setToId] = useState("");
  const [relation, setRelation] = useState("relates_to");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fromOptions = useMemo(() => optionsForKind(fromKind, theme, sxManagement), [fromKind, theme, sxManagement]);
  const toOptions = useMemo(() => optionsForKind(toKind, theme, sxManagement), [toKind, theme, sxManagement]);
  // root review (UI completion phase, point 12): "Existing record picker must ... not offer
  // canonical FK pairs that API rejects." Mirrors project-theme-hub.ts's CANONICAL_FK_PAIRS —
  // those pairs already have a real FK/bridge (issue<->milestone, decision->issue, task->
  // milestone) maintained by the existing management route, so a work_link would just be a
  // second, driftable copy of the same fact.
  const rejectedPair = CANONICAL_FK_PAIRS.has(`${fromKind}:${toKind}`);

  async function submit() {
    if (!fromId || !toId) {
      setError("両方選んでね");
      return;
    }
    if (rejectedPair) {
      setError("この組み合わせは既存の管理画面(課題・タスク・マイルストーン)の接続を使ってね");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await themeHubFetch(projectId, trackKey, "POST", {
        resource: "work_link",
        fields: { from_kind: fromKind, from_id: fromId, to_kind: toKind, to_id: toId, relation, client_token: clientToken },
      });
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "関連を作れなかったよ");
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className={`sm:max-w-lg ${styles.scrollDialog}`}>
        <DialogHeader>
          <DialogTitle>作業間の関連を作る</DialogTitle>
          <DialogDescription>このテーマに含まれる記録どうしを関連づけるよ。両側から見えるようになるよ。</DialogDescription>
        </DialogHeader>
        <div className={`${styles.formGrid} ${styles.scrollDialogBody}`}>
          {error && <div className={styles.formError} role="alert">{error}</div>}
          {!error && rejectedPair && (
            <div className={styles.formError} role="alert">この組み合わせは既存の管理画面(課題・タスク・マイルストーン)の接続を使ってね</div>
          )}
          <div className={styles.dialogFieldRow}>
            <div className={styles.formField}>
              <label className={styles.formLabel} htmlFor="link-from-kind">起点の種類</label>
              <select id="link-from-kind" className={styles.formSelect} value={fromKind} onChange={(e) => { setFromKind(e.target.value); setFromId(""); }} disabled={saving}>
                {Object.entries(LINK_KIND_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <div className={styles.formField}>
              <label className={styles.formLabel} htmlFor="link-from-id">起点</label>
              <select id="link-from-id" className={styles.formSelect} value={fromId} onChange={(e) => setFromId(e.target.value)} disabled={saving}>
                <option value="">選んでね</option>
                {fromOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </div>
          </div>
          <div className={styles.dialogFieldRow}>
            <div className={styles.formField}>
              <label className={styles.formLabel} htmlFor="link-to-kind">先の種類</label>
              <select id="link-to-kind" className={styles.formSelect} value={toKind} onChange={(e) => { setToKind(e.target.value); setToId(""); }} disabled={saving}>
                {Object.entries(LINK_KIND_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <div className={styles.formField}>
              <label className={styles.formLabel} htmlFor="link-to-id">先</label>
              <select id="link-to-id" className={styles.formSelect} value={toId} onChange={(e) => setToId(e.target.value)} disabled={saving}>
                <option value="">選んでね</option>
                {toOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </div>
          </div>
          <div className={styles.formField}>
            <label className={styles.formLabel} htmlFor="link-relation">関係</label>
            <select id="link-relation" className={styles.formSelect} value={relation} onChange={(e) => setRelation(e.target.value)} disabled={saving}>
              {Object.entries(RELATION_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>キャンセル</Button>
          <Button onClick={submit} disabled={saving || rejectedPair}>{saving ? "保存中…" : "関連を作る"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- 参照専用ガード ----------------------------------------------------------
// root review (UI completion phase, point 14): canManage=false viewers could still click every
// row and reach a live save/remove dialog — API denial alone is not an acceptable read-only UI.
// Every row that would otherwise open an editor/dialog renders as a plain non-interactive block
// when canManage is false, instead of a clickable control.

// Every row stays clickable — the destination itself is what must be read-only, not the click.
// IssueEditor (SxWeeklyControlDashboard) now gates its own fields/Save on management.canManage
// (fieldset disabled + save() early-return), and IssueWorkbench already gated its own actions.
// The theme hub's own custom dialogs (meeting/deliverable) take an explicit readOnly prop below.
function RowButton({
  className,
  onClick,
  children,
}: {
  className: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button type="button" className={className} onClick={onClick}>
      {children}
    </button>
  );
}

// --- 記録を追加(typed menu) ---------------------------------------------------

type ActiveDialog =
  | { kind: "edit_profile" }
  | { kind: "create_meeting" }
  | { kind: "edit_meeting"; meeting: MeetingData }
  | { kind: "link_meeting" }
  | { kind: "link_document" }
  | { kind: "create_deliverable" }
  | { kind: "edit_deliverable"; deliverable: DeliverableData }
  | { kind: "create_work_link" };

function AddRecordMenu({
  onPick,
}: {
  onPick: (kind: "task" | "milestone" | "issue" | "meeting" | "link_meeting" | "deliverable" | "link_document" | "work_link") => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button size="sm">記録を追加</Button>} />
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onPick("task")}>タスクを追加</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onPick("milestone")}>運用マイルストーンを追加</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onPick("deliverable")}>予定成果物を追加</DropdownMenuItem>
        {THEME_HUB_MEETING_WRITE_ENABLED && (
          <DropdownMenuItem onClick={() => onPick("meeting")}>MTGを記録</DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => onPick("link_meeting")}>既存のMTGを紐付け</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onPick("issue")}>論点を追加</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onPick("link_document")}>既存の資料を紐付け</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onPick("work_link")}>作業間の関連を作る</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// --- メイン ------------------------------------------------------------------

export function ProjectThemeRoutes({
  projectId,
  themes,
  sxManagement,
  allMeetings,
  members,
  canManage,
  onOpenEditor,
  onManagementChange,
  onOpenIssueWorkbench,
}: {
  projectId: string;
  themes: ProjectWorkspaceBundle["themes"];
  sxManagement: SxManagementBundle;
  allMeetings: ProjectWorkspaceBundle["allMeetings"];
  members: ProjectWorkspaceBundle["members"];
  canManage: boolean;
  currentMemberId: string;
  onOpenEditor?: (editor: EditorState) => void;
  onManagementChange?: (next: SxManagementBundle) => void;
  /** root review (point 13): edit_issue is a bare field editor, not the rich issue detail view
   * (discussions/hypotheses/decisions/actions together). Theme hub issue rows must open the same
   * IssueWorkbench the issues tab uses, not a copy — this callback is that tab's own
   * setSelectedIssueId, passed straight through. */
  onOpenIssueWorkbench?: (issueId: string) => void;
}) {
  const [localThemes, setLocalThemes] = useState(themes);
  const [localAllMeetings, setLocalAllMeetings] = useState(allMeetings);
  const [selectedThemeKey, setSelectedThemeKey] = useState<string | null>(themes[0]?.themeKey ?? null);
  const [activeDialog, setActiveDialog] = useState<ActiveDialog | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const refreshingRef = useRef(false);

  // 親から渡されるbundleが再フェッチされたとき(themesタブ以外の操作起点でも)、
  // ローカルの表示コピーを最新化する。選択中テーマは維持する。
  useEffect(() => {
    setLocalThemes(themes);
  }, [themes]);
  useEffect(() => {
    setLocalAllMeetings(allMeetings);
  }, [allMeetings]);

  const selectedTheme = localThemes.find((t) => t.themeKey === selectedThemeKey) ?? localThemes[0] ?? null;

  async function refreshBundle() {
    if (refreshingRef.current) return false;
    refreshingRef.current = true;
    try {
      const res = await fetch(`/api/project-workspace/${encodeURIComponent(projectId)}`, { cache: "no-store" });
      const json = await res.json();
      if (json.ok) {
        setLocalThemes(json.bundle.themes);
        setLocalAllMeetings(json.bundle.allMeetings);
        onManagementChange?.(json.bundle.sxManagement);
        return true;
      } else {
        setNotice(typeof json.error === "string" ? json.error : "最新の内容を読み込めなかったよ");
      }
    } catch {
      setNotice("最新の内容を読み込めなかったよ。画面を再読み込みしてね");
    } finally {
      refreshingRef.current = false;
    }
    return false;
  }

  async function handleSaved() {
    await refreshBundle();
    setActiveDialog(null);
  }

  if (!selectedTheme) {
    return (
      <section className={styles.container}>
        <header className={styles.pageHeader}>
          <h2 className={styles.pageTitle}>テーマ</h2>
          <p className={styles.pageDescription}>テーマが未設定だよ</p>
        </header>
      </section>
    );
  }

  const themeIndex = localThemes.findIndex((t) => t.themeKey === selectedTheme.themeKey);
  const tasks = themeTasks(selectedTheme, sxManagement);
  const opMilestones = themeMilestonesOperational(selectedTheme, sxManagement);
  const issues = themeIssues(selectedTheme, sxManagement);
  const decisions = themeDecisions(selectedTheme, sxManagement);
  const linkedMeetingIds = new Set(selectedTheme.meetings.map((m) => m.meetingId));
  const linkedDocumentIds = new Set(selectedTheme.documents.map((d) => d.documentId));

  type NextItem = { key: string; kind: string; title: string; meta: string; date: string | null; onClick: () => void };
  const nextItems: NextItem[] = [];
  for (const t of tasks.filter((t) => t.status !== "completed")) {
    nextItems.push({
      key: `task:${t.id}`, kind: "仕事", title: t.title,
      meta: `${t.ownerLabel || "担当未確認"} / ${t.plannedEnd ? formatYmd(t.plannedEnd) : "期限未登録"}`,
      date: t.plannedEnd,
      onClick: () => onOpenEditor?.({ kind: "edit_task", task: t, hubOrigin: true }),
    });
  }
  for (const d of selectedTheme.deliverables.filter((d) => d.status === "planned" || d.status === "in_progress")) {
    nextItems.push({
      key: `deliv:${d.id}`, kind: "資料", title: d.title,
      meta: `${d.ownerMemberId ? members.find((m) => m.memberId === d.ownerMemberId)?.displayName ?? "担当未確認" : "担当未確認"} / ${d.dueOn ? formatYmd(d.dueOn) : "期限未登録"}`,
      date: d.dueOn,
      onClick: () => setActiveDialog({ kind: "edit_deliverable", deliverable: d }),
    });
  }
  {
    const today = todayJst();
    for (const m of selectedTheme.meetings.filter((m) => m.meetingDate >= today)) {
      nextItems.push({
        key: `mtg:${m.meetingId}`, kind: "MTG", title: m.title,
        meta: formatYmd(m.meetingDate),
        date: m.meetingDate,
        onClick: () => setActiveDialog({ kind: "edit_meeting", meeting: m }),
      });
    }
  }
  for (const i of issues.filter((i) => i.status === "open" || i.status === "validating")) {
    nextItems.push({
      key: `issue:${i.id}`, kind: "論点", title: i.title,
      meta: `${ISSUE_STATUS_LABEL[i.status] ?? i.status} / ${i.dueDate ? formatYmd(i.dueDate) : "期限未登録"}`,
      date: i.dueDate,
      onClick: () => onOpenIssueWorkbench?.(i.id),
    });
  }
  for (const d of decisions.filter((d) => d.status === "open")) {
    const issue = issues.find((i) => i.id === d.issueId);
    if (!issue) continue;
    nextItems.push({
      key: `decision:${d.id}`, kind: "判断", title: d.title,
      meta: `${d.dueDate ? formatYmd(d.dueDate) : "期限未登録"}`,
      date: d.dueDate,
      onClick: () => onOpenIssueWorkbench?.(issue.id),
    });
  }
  nextItems.sort((a, b) => {
    if (a.date && b.date) return a.date.localeCompare(b.date);
    if (a.date) return -1;
    if (b.date) return 1;
    return 0;
  });

  function pickAddRecord(kind: "task" | "milestone" | "issue" | "meeting" | "link_meeting" | "deliverable" | "link_document" | "work_link") {
    if (!selectedTheme) return;
    switch (kind) {
      case "task":
        // allowStandalone: p19 has no lane-backed milestone yet for any theme, so the shared
        // editor's own "no basis to place a task in this lane" gate must be bypassed here (root
        // review, UI completion phase, point 9) — track is derived from the lane directly instead.
        onOpenEditor?.({ kind: "create_task", laneKey: selectedTheme.themeKey, allowStandalone: true, hubOrigin: true });
        return;
      case "milestone":
        // 運用マイルストーン(migration 20260901093000): objective/outcome階層が未構築でも
        // timeline_kind='milestone' の単一予定日(planned_start=planned_end)として置ける。
        // allowStandaloneはtask同様、p19に既存の柱基準outcomeが無いことによる同じ回避。
        onOpenEditor?.({ kind: "create_milestone", track: selectedTheme.themeKey, laneKey: selectedTheme.themeKey, timelineKind: "milestone", plannedDate: null, outcomeId: null, allowStandalone: true, hubOrigin: true });
        return;
      case "issue":
        onOpenEditor?.({ kind: "create_issue", track: selectedTheme.themeKey });
        return;
      case "meeting":
        setActiveDialog({ kind: "create_meeting" });
        return;
      case "link_meeting":
        setActiveDialog({ kind: "link_meeting" });
        return;
      case "deliverable":
        setActiveDialog({ kind: "create_deliverable" });
        return;
      case "link_document":
        setActiveDialog({ kind: "link_document" });
        return;
      case "work_link":
        setActiveDialog({ kind: "create_work_link" });
    }
  }

  // root review (UI completion phase, point 12): 関連の両端は種類ラベルだけでなく実タイトルを
  // 出し、それぞれ実際のカノニカルレコードへ遷移できること。
  // root review (release checkpoint, point 6): a work_link is canonical-global — the backend
  // (project-workspace.ts themesForEndpoint) deliberately surfaces it under every theme either
  // endpoint actually belongs to, not just the theme the link row happened to be created under.
  // Looking up a meeting/document/deliverable ONLY in the currently selected theme's own lists
  // therefore mislabels a real, already-authorized record as "(このテーマ外の...)" whenever its
  // owning theme differs from the one currently open. Search every theme in the same access-
  // scoped bundle instead — no new privilege, the data was already in the response.
  function resolveLinkEndpoint(kind: string, id: string, allThemes: ThemeData[], sx: SxManagementBundle): { label: string; onClick: (() => void) | null } {
    switch (kind) {
      case "meeting": {
        const meeting = allThemes.flatMap((t) => t.meetings).find((m) => m.meetingId === id);
        return { label: meeting?.title ?? "(見つからないMTG)", onClick: meeting ? () => setActiveDialog({ kind: "edit_meeting", meeting }) : null };
      }
      case "document": {
        const doc = allThemes.flatMap((t) => t.documents).find((d) => d.documentId === id);
        return { label: doc?.displayName ?? "(見つからない資料)", onClick: doc ? () => window.open(`/workspace-document/${encodeURIComponent(doc.documentId)}`, "_blank") : null };
      }
      case "deliverable": {
        const deliverable = allThemes.flatMap((t) => t.deliverables).find((d) => d.id === id);
        return { label: deliverable?.title ?? "(見つからない予定成果物)", onClick: deliverable ? () => setActiveDialog({ kind: "edit_deliverable", deliverable }) : null };
      }
      case "issue": {
        const issue = sx.issues.find((i) => i.id === id);
        return { label: issue?.title ?? "(論点が見つからない)", onClick: issue ? () => onOpenIssueWorkbench?.(issue.id) : null };
      }
      case "task": {
        const task = sx.tasks.find((t) => t.id === id);
        return { label: task?.title ?? "(タスクが見つからない)", onClick: task ? () => onOpenEditor?.({ kind: "edit_task", task, hubOrigin: true }) : null };
      }
      case "milestone": {
        const milestone = sx.milestones.find((m) => m.id === id);
        return { label: milestone?.title ?? "(マイルストーンが見つからない)", onClick: milestone ? () => onOpenEditor?.({ kind: "edit_milestone", milestone, hubOrigin: true }) : null };
      }
      case "decision": {
        const decision = sx.decisions.find((d) => d.id === id);
        return { label: decision?.title ?? "(決定が見つからない)", onClick: decision?.issueId ? () => onOpenIssueWorkbench?.(String(decision.issueId)) : null };
      }
      default:
        return { label: id, onClick: null };
    }
  }

  return (
    <section className={styles.container}>
      <header className={styles.pageHeader}>
        <h2 className={styles.pageTitle}>テーマ</h2>
        <p className={styles.pageDescription}>{localThemes.length}つのテーマごとに、いま動いている仕事と成果目標の現在地を追う</p>
      </header>

      {notice && <div className={styles.formError} role="alert">{notice}</div>}

      <div className={styles.themeSelector}>
        {localThemes.map((theme, index) => (
          <ThemeSelectorRow
            key={theme.themeKey}
            theme={theme}
            themeIndex={index}
            active={theme.themeKey === selectedTheme.themeKey}
            summary={themeSummary(theme, sxManagement)}
            onSelect={() => setSelectedThemeKey(theme.themeKey)}
          />
        ))}
      </div>

      <div className={styles.themePanel} style={{ "--accent-color": selectedTheme.accent } as CSSProperties}>
        <div className={styles.themeStateCard}>
          <div className={styles.themeStateHeader}>
            <h3 className={styles.themeName}>
              {String(themeIndex + 1).padStart(2, "0")} {selectedTheme.label}
            </h3>
            {canManage && (
              <Button size="sm" variant="outline" onClick={() => setActiveDialog({ kind: "edit_profile" })}>
                目的・現状を編集
              </Button>
            )}
          </div>
          <div className={styles.themeStateGrid}>
            <div className={styles.themeStateBlock}>
              <span className={styles.themeStateLabel}>目的</span>
              <span className={`${styles.themeStateValue} ${!selectedTheme.profile?.purposeMd ? styles.themeStateValueEmpty : ""}`}>
                {selectedTheme.profile?.purposeMd || "未登録"}
              </span>
            </div>
            <div className={styles.themeStateBlock}>
              <span className={styles.themeStateLabel}>現状</span>
              <span className={`${styles.themeStateValue} ${!selectedTheme.profile?.currentStateMd ? styles.themeStateValueEmpty : ""}`}>
                {selectedTheme.profile?.currentStateMd || "未登録"}
              </span>
            </div>
            <div className={styles.themeStateBlock}>
              <span className={styles.themeStateLabel}>次の焦点</span>
              <span className={`${styles.themeStateValue} ${!selectedTheme.profile?.nextFocusNote ? styles.themeStateValueEmpty : ""}`}>
                {selectedTheme.profile?.nextFocusNote || "未登録"}
              </span>
            </div>
          </div>
        </div>

        <ThemeHistory
          key={selectedTheme.themeKey}
          rows={selectedTheme.profile?.historyRows ?? []}
          canManage={canManage}
          sources={[
            ...selectedTheme.meetings.map(meeting => ({ kind: "meeting" as const, id: meeting.meetingId, label: `${formatYmd(meeting.meetingDate)} ${meeting.title}`, onOpen: () => setActiveDialog({ kind: "edit_meeting", meeting }) })),
            ...selectedTheme.documents.map(document => ({ kind: "document" as const, id: document.documentId, label: document.displayName, onOpen: () => window.open(`/workspace-document/${encodeURIComponent(document.documentId)}`, "_blank", "noopener,noreferrer") })),
          ]}
          onSave={async rows => {
            await themeHubFetch(projectId, selectedTheme.themeKey, "PATCH", { resource: "profile", fields: { history_rows: rows }, expected_version: selectedTheme.profile?.version ?? null });
          }}
          onRefresh={async () => {
            if (!(await refreshBundle())) throw new Error("保存は完了したけど、最新表示を読み込めなかったよ。もう一度読み込んでね。");
          }}
        />

        <div className={styles.nextWorkCard}>
          <div className={styles.nextWorkHeader}>
            <h4 className={styles.detailGroupTitle}>次にやること</h4>
            {canManage && <AddRecordMenu onPick={pickAddRecord} />}
          </div>
          <ol className={styles.nextWorkList}>
            {nextItems.length === 0 && <li className={styles.nextWorkEmpty}>登録された次の仕事はまだ無いよ</li>}
            {nextItems.slice(0, 12).map((item) => (
              <li key={item.key}>
                <RowButton className={styles.nextWorkRow} onClick={item.onClick}>
                  <span className={styles.nextWorkKind}>{item.kind}</span>
                  <span className={styles.nextWorkTitle}>{item.title}</span>
                  <span className={styles.nextWorkMeta}>{item.meta}</span>
                </RowButton>
              </li>
            ))}
          </ol>
        </div>

        <div className={styles.detailGroup}>
          <div className={styles.detailGroupHeader}>
            <h4 className={styles.detailGroupTitle}>仕事・資料</h4>
          </div>
          <ul className={styles.detailRowList}>
            {tasks.length === 0 && selectedTheme.deliverables.length === 0 && (
              <li className={styles.detailEmpty}>タスク・予定成果物はまだ無いよ</li>
            )}
            {tasks.map((t) => (
              <li key={t.id} className={styles.detailRow}>
                <RowButton className={styles.detailRowMain} onClick={() => onOpenEditor?.({ kind: "edit_task", task: t, hubOrigin: true })}>
                  <span className={styles.detailRowTitle}>{t.title}</span>
                  <span className={styles.detailRowSub}>タスク / {TASK_STATUS_LABEL[t.status] ?? t.status} / {t.ownerLabel || "担当未確認"} / {t.plannedEnd ? formatYmd(t.plannedEnd) : "期限未登録"}</span>
                </RowButton>
              </li>
            ))}
            {selectedTheme.deliverables.map((d) => (
              <li key={d.id} className={styles.detailRow}>
                <RowButton className={styles.detailRowMain} onClick={() => setActiveDialog({ kind: "edit_deliverable", deliverable: d })}>
                  <span className={styles.detailRowTitle}>{d.title}</span>
                  <span className={styles.detailRowSub}>
                    予定成果物 / {DELIVERABLE_STATUS_LABEL[d.status] ?? d.status} / {d.ownerMemberId ? members.find((m) => m.memberId === d.ownerMemberId)?.displayName ?? "担当未確認" : "担当未確認"} / {d.dueOn ? formatYmd(d.dueOn) : "期限未登録"}
                  </span>
                </RowButton>
                {d.linkedDocumentId && (
                  <a href={`/workspace-document/${encodeURIComponent(d.linkedDocumentId)}`} target="_blank" rel="noreferrer" className={styles.detailRowSub}>
                    資料を開く
                  </a>
                )}
              </li>
            ))}
            {selectedTheme.documents.map((doc) => (
              <li key={doc.linkId} className={styles.detailRow}>
                <a
                  href={`/workspace-document/${encodeURIComponent(doc.documentId)}`}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.detailRowMain}
                >
                  <span className={styles.detailRowTitle}>{doc.displayName}</span>
                  <span className={styles.detailRowSub}>{entryKindLabel(doc.entryKind)}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.detailGroup}>
          <div className={styles.detailGroupHeader}>
            <h4 className={styles.detailGroupTitle}>MTG</h4>
          </div>
          <ul className={styles.detailRowList}>
            {selectedTheme.meetings.length === 0 && <li className={styles.detailEmpty}>紐付いたMTGはまだ無いよ</li>}
            {[...selectedTheme.meetings].sort((a, b) => b.meetingDate.localeCompare(a.meetingDate)).map((m) => (
              <li key={m.linkId} className={styles.detailRow}>
                <RowButton className={styles.detailRowMain} onClick={() => setActiveDialog({ kind: "edit_meeting", meeting: m })}>
                  <span className={styles.detailRowTitle}>{m.title}</span>
                  <span className={styles.detailRowSub}>{formatYmd(m.meetingDate)} / {prepStatusLabel(m.prepStatus)}{m.summaryShort ? ` / ${m.summaryShort.slice(0, 40)}` : ""}</span>
                </RowButton>
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.detailGroup}>
          <div className={styles.detailGroupHeader}>
            <h4 className={styles.detailGroupTitle}>論点・判断</h4>
          </div>
          <ul className={styles.detailRowList}>
            {issues.length === 0 && <li className={styles.detailEmpty}>論点はまだ無いよ</li>}
            {issues.map((issue) => {
              const issueDecisions = decisions.filter((d) => d.issueId === issue.id);
              // 議論(issue_discussions)・仮説・決定・アクションは全部この論点の中で完結する既存の
              // ワークベンチ(issuesタブと同一コンポーネント)を開く。ここではコピー編集フォームを
              // 作らない(root review: edit_issueは単なる項目編集で議論/アクションが出ない)。
              return (
                <li key={issue.id} className={styles.detailRow} style={{ flexDirection: "column", alignItems: "stretch", gap: "0.3rem" }}>
                  <RowButton className={styles.detailRowMain} onClick={() => onOpenIssueWorkbench?.(issue.id)}>
                    <span className={styles.detailRowTitle}>{issue.title}</span>
                    <span className={styles.detailRowSub}>
                      論点 / {ISSUE_STATUS_LABEL[issue.status] ?? issue.status} / {issue.ownerLabel || "担当未確認"} / 議論{issue.discussions.length}件・決定{issueDecisions.length}件
                    </span>
                  </RowButton>
                  {issueDecisions.map((decision) => (
                    <RowButton
                      key={decision.id}
                      className={styles.detailRowMain}
                      onClick={() => onOpenIssueWorkbench?.(issue.id)}
                    >
                      <span className={styles.detailRowTitle} style={{ paddingLeft: "1rem" }}>└ {decision.title}</span>
                      <span className={styles.detailRowSub}>判断 / {DECISION_STATUS_LABEL[decision.status] ?? decision.status}</span>
                    </RowButton>
                  ))}
                </li>
              );
            })}
          </ul>
        </div>

        <div className={styles.detailGroup}>
          <div className={styles.detailGroupHeader}>
            <h4 className={styles.detailGroupTitle}>運用マイルストーン</h4>
          </div>
          <ul className={styles.detailRowList}>
            {opMilestones.length === 0 && <li className={styles.detailEmpty}>運用マイルストーンはまだ無いよ</li>}
            {opMilestones.map((m) => (
              <li key={m.id} className={styles.detailRow}>
                <RowButton className={styles.detailRowMain} onClick={() => onOpenEditor?.({ kind: "edit_milestone", milestone: m, hubOrigin: true })}>
                  <span className={styles.detailRowTitle}>{m.title}</span>
                  <span className={styles.detailRowSub}>{TASK_STATUS_LABEL[m.status] ?? m.status} / {m.plannedStart ? formatYmd(m.plannedStart) : "予定日未登録"}</span>
                </RowButton>
              </li>
            ))}
          </ul>
        </div>

        {selectedTheme.workLinks.length > 0 && (
          <div className={styles.detailGroup}>
            <div className={styles.detailGroupHeader}>
              <h4 className={styles.detailGroupTitle}>関連</h4>
            </div>
            <ul className={styles.detailRowList}>
              {selectedTheme.workLinks.map((link) => {
                const from = resolveLinkEndpoint(link.fromKind, link.fromId, localThemes, sxManagement);
                const to = resolveLinkEndpoint(link.toKind, link.toId, localThemes, sxManagement);
                return (
                  <li key={link.id} className={styles.detailRow}>
                    <div className={styles.detailRowMain} style={{ cursor: "default" }}>
                      <span className={styles.detailRowTitle}>
                        {from.onClick ? (
                          <button type="button" className={styles.pickerRow} style={{ display: "inline", padding: 0, minHeight: "auto" }} onClick={from.onClick}>{from.label}</button>
                        ) : from.label}
                        {" "}({LINK_KIND_LABEL[link.fromKind] ?? link.fromKind}) → {" "}
                        {to.onClick ? (
                          <button type="button" className={styles.pickerRow} style={{ display: "inline", padding: 0, minHeight: "auto" }} onClick={to.onClick}>{to.label}</button>
                        ) : to.label}
                        {" "}({LINK_KIND_LABEL[link.toKind] ?? link.toKind})
                      </span>
                      <span className={styles.detailRowSub}>{RELATION_LABEL[link.relation] ?? link.relation}</span>
                    </div>
                    {canManage && (
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => {
                          if (!window.confirm("この関連を外すよ。この記録が他のテーマにも出ている場合、そこからも見えなくなるよ。よい?")) return;
                          themeHubFetch(projectId, selectedTheme.themeKey, "PATCH", {
                            resource: "work_link", id: link.id, delete: true, expected_version: link.version,
                          }).then(refreshBundle).catch((err) => setNotice(err instanceof Error ? err.message : "外せなかったよ"));
                        }}
                      >
                        外す
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <details className={styles.historySection}>
          <summary className={styles.historySummary}>過去のMTG履歴を見る</summary>
          <ul className={styles.detailRowList}>
            {(() => {
              const today = todayJst();
              const past = [...selectedTheme.meetings].filter((m) => m.meetingDate < today).sort((a, b) => b.meetingDate.localeCompare(a.meetingDate));
              if (past.length === 0) return <li className={styles.detailEmpty}>過去のMTGはまだ無いよ</li>;
              return past.map((m) => (
                <li key={m.linkId} className={styles.detailRow}>
                  <RowButton className={styles.detailRowMain} onClick={() => setActiveDialog({ kind: "edit_meeting", meeting: m })}>
                    <span className={styles.detailRowTitle}>{m.title}</span>
                    <span className={styles.detailRowSub}>{formatYmd(m.meetingDate)}</span>
                  </RowButton>
                </li>
              ));
            })()}
          </ul>
        </details>

        <div className={styles.financialSection}>
          <h3 className={styles.financialSectionTitle}>成果目標</h3>
          <div className={styles.themeMetric}>成果目標 {selectedTheme.milestones.length} 件</div>
          <ol className={styles.milestoneList}>
            {selectedTheme.milestones.map((milestone) => (
              <MilestoneRow key={milestone.milestoneId} milestone={milestone} themeAccent={selectedTheme.accent} />
            ))}
          </ol>
        </div>
      </div>

      {activeDialog?.kind === "edit_profile" && (
        <EditProfileDialog
          projectId={projectId}
          trackKey={selectedTheme.themeKey}
          profile={selectedTheme.profile}
          onClose={() => setActiveDialog(null)}
          onSaved={handleSaved}
        />
      )}
      {(activeDialog?.kind === "create_meeting" || activeDialog?.kind === "edit_meeting") && (
        <MeetingFormDialog
          projectId={projectId}
          trackKey={selectedTheme.themeKey}
          meeting={activeDialog.kind === "edit_meeting" ? activeDialog.meeting : null}
          readOnly={!canManage}
          onClose={() => setActiveDialog(null)}
          onSaved={handleSaved}
        />
      )}
      {activeDialog?.kind === "link_meeting" && (
        <LinkMeetingDialog
          projectId={projectId}
          trackKey={selectedTheme.themeKey}
          allMeetings={localAllMeetings}
          alreadyLinkedIds={linkedMeetingIds}
          onClose={() => setActiveDialog(null)}
          onSaved={handleSaved}
        />
      )}
      {activeDialog?.kind === "link_document" && (
        <LinkDocumentDialog
          projectId={projectId}
          trackKey={selectedTheme.themeKey}
          alreadyLinkedIds={linkedDocumentIds}
          onClose={() => setActiveDialog(null)}
          onSaved={handleSaved}
        />
      )}
      {(activeDialog?.kind === "create_deliverable" || activeDialog?.kind === "edit_deliverable") && (
        <DeliverableFormDialog
          projectId={projectId}
          // A deliverable found via resolveLinkEndpoint's cross-theme search (point 6 above) may
          // belong to a DIFFERENT theme than the one currently selected — project_theme_hub.ts's
          // updateDeliverable/deleteDeliverable filter by track_key, so sending the wrong one
          // matches zero rows and reports a false "someone else updated this first" 409. Resolve
          // the deliverable's own owning theme; only fall back to the selected theme for a
          // genuine new create (no existing deliverable to look up yet).
          trackKey={
            activeDialog.kind === "edit_deliverable"
              ? (localThemes.find((t) => t.deliverables.some((d) => d.id === activeDialog.deliverable.id))?.themeKey ?? selectedTheme.themeKey)
              : selectedTheme.themeKey
          }
          deliverable={activeDialog.kind === "edit_deliverable" ? activeDialog.deliverable : null}
          members={members}
          readOnly={!canManage}
          onClose={() => setActiveDialog(null)}
          onSaved={handleSaved}
        />
      )}
      {activeDialog?.kind === "create_work_link" && (
        <CreateWorkLinkDialog
          projectId={projectId}
          trackKey={selectedTheme.themeKey}
          theme={selectedTheme}
          sxManagement={sxManagement}
          onClose={() => setActiveDialog(null)}
          onSaved={handleSaved}
        />
      )}
    </section>
  );
}
