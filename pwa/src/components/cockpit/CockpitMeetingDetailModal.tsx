"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pencil, Save } from "lucide-react";
import type { ProjectMeetingSummary } from "@/lib/supabase-data";
import { MarkdownView } from "./MarkdownView";
import { MeetingAssetsPanel } from "./MeetingAssetsPanel";

interface Props {
  meeting: ProjectMeetingSummary | null;
  prepMeeting?: ProjectMeetingSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMeetingUpdated?: (meeting: ProjectMeetingSummary) => void;
}

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

function formatHeaderDate(meetingDate: string, meetingStartAt: string | null): string {
  const d = new Date(meetingDate + "T00:00:00+09:00");
  if (isNaN(d.getTime())) return meetingDate;
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const w = WEEKDAYS[d.getDay()];
  let result = `${y}年${m}月${day}日 (${w})`;
  if (meetingStartAt) {
    const t = new Date(meetingStartAt);
    if (!isNaN(t.getTime())) {
      const hh = String(t.getHours()).padStart(2, "0");
      const mm = String(t.getMinutes()).padStart(2, "0");
      result += ` ${hh}:${mm}`;
    }
  }
  return result;
}

function isDialogueMeeting(meeting: ProjectMeetingSummary): boolean {
  return meeting.meetingId.startsWith("dialogue:") || meeting.sourceKinds === "dialogue";
}

function isUpcomingMeeting(meeting: ProjectMeetingSummary): boolean {
  const sourceKinds = sourceKindTokens(meeting.sourceKinds);
  return sourceKinds.has("upcoming") && !sourceKinds.has("upcoming_tentative");
}

function isPrepMeeting(meeting: ProjectMeetingSummary): boolean {
  const sourceKinds = sourceKindTokens(meeting.sourceKinds);
  return meeting.meetingId.startsWith("upcoming:") || sourceKinds.has("upcoming") || sourceKinds.has("upcoming_tentative");
}

function sourceKindTokens(sourceKinds: string | null): Set<string> {
  return new Set((sourceKinds || "").split("+").map((v) => v.trim()).filter(Boolean));
}

function notionTranscriptLink(meeting: ProjectMeetingSummary): { href: string; label: string; tone: "notion" | "calendar" } | null {
  if (isDialogueMeeting(meeting)) return null;
  if (meeting.notionUrl) return { href: meeting.notionUrl, label: "Notion文字起こしを開く", tone: "notion" };
  if (isUpcomingMeeting(meeting) && meeting.sourceUrl) return { href: meeting.sourceUrl, label: "CalendarからNotionを開始", tone: "calendar" };
  return null;
}

export function CockpitMeetingDetailModal({ meeting, prepMeeting = null, open, onOpenChange, onMeetingUpdated }: Props) {
  const meetingId = meeting?.meetingId ?? null;
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setEditing(false);
  }, [meetingId]);

  if (!meeting) return null;
  const dialogue = isDialogueMeeting(meeting);
  const upcoming = isUpcomingMeeting(meeting);
  const prep = isPrepMeeting(meeting);
  const notionLink = notionTranscriptLink(meeting);
  const sourceLink = meeting.sourceUrl || meeting.notionUrl;
  // dialogue 以外は元ソースを「Notion / Drive / Slack / Gmail / Calendar」と sourceKinds から推測
  const sourceLabel = upcoming
    ? "Calendar"
    : dialogue
    ? null
    : meeting.sourceUrl
      ? (meeting.sourceKinds || "元ソース")
      : meeting.notionUrl
        ? "Notion"
        : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-[1100px] w-[92vw] max-h-[88vh] overflow-y-auto !bg-white p-0 shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
        <header className="sticky top-0 z-10 border-b border-[#e5e5e7] bg-white/95 px-5 py-3 backdrop-blur">
          <div className="text-[11px] text-[#86868b] tabular-nums flex items-center gap-2 flex-wrap">
            <span>{formatHeaderDate(meeting.meetingDate, meeting.meetingStartAt)}</span>
            {dialogue ? (
              <span className="rounded bg-violet-50 border border-violet-200 px-1.5 py-0.5 text-[10px] text-violet-800">
                提案整理
              </span>
            ) : upcoming ? (
              <span className="rounded bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[10px] text-amber-800">
                予定MTG
              </span>
            ) : prep ? (
              <span className="rounded bg-stone-50 border border-stone-200 px-1.5 py-0.5 text-[10px] text-stone-700">
                日程調整中
              </span>
            ) : meeting.sourceKinds ? (
              <span className="rounded bg-[#f5f5f7] px-1.5 py-0.5 text-[10px] text-[#3c3c43]">{meeting.sourceKinds}</span>
            ) : null}
          </div>
          <DialogTitle className="mt-1 text-[15px] font-semibold leading-snug">{meeting.title}</DialogTitle>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {notionLink ? (
              <a
                href={notionLink.href}
                target="_blank"
                rel="noopener noreferrer"
                className={notionLink.tone === "notion"
                  ? "inline-flex items-center rounded border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-800 hover:bg-emerald-100"
                  : "inline-flex items-center rounded border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-900 hover:bg-amber-100"}
              >
                {notionLink.label} ↗
              </a>
            ) : !dialogue ? (
              <span
                className="inline-flex items-center rounded border border-[#e5e5e7] bg-[#f5f5f7] px-2.5 py-1 text-[11px] text-[#86868b]"
                title="project_meeting_summaries.notion_url が未連携"
              >
                Notion未連携
              </span>
            ) : null}
            {sourceLink && sourceLabel && sourceLink !== notionLink?.href && (
              <a
                href={sourceLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-[#007aff] hover:underline"
              >
                {sourceLabel} で開く ↗
              </a>
            )}
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              className={editing
                ? "inline-flex items-center gap-1.5 rounded border border-[#1d1d1f] bg-[#1d1d1f] px-2.5 py-1 text-[11px] font-medium text-white hover:bg-[#3c3c43]"
                : "inline-flex items-center gap-1.5 rounded border border-[#d2d2d7] bg-white px-2.5 py-1 text-[11px] font-medium text-[#1d1d1f] hover:bg-[#f5f5f7]"}
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{editing ? "編集を閉じる" : "表示内容を編集"}</span>
            </button>
          </div>
        </header>

        {prep ? (
          <UpcomingMeetingBody meeting={meeting} editing={editing} onMeetingUpdated={onMeetingUpdated} />
        ) : dialogue ? (
          <DialogueMeetingBody meeting={meeting} editing={editing} onMeetingUpdated={onMeetingUpdated} />
        ) : (
          <RegularMeetingBody meeting={meeting} prepMeeting={prepMeeting} editing={editing} onMeetingUpdated={onMeetingUpdated} />
        )}

        <MeetingAssetsPanel
          meeting={meeting}
          onMeetingUpdated={onMeetingUpdated}
        />
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// upcoming meeting = 予定MTG / 準備ブリーフ。
// 開催前に「何を決めるか」「何を用意するか」を同じ MTG サマリ欄に置く。
// ============================================================

function UpcomingMeetingBody({
  meeting,
  editing,
  onMeetingUpdated,
}: {
  meeting: ProjectMeetingSummary;
  editing: boolean;
  onMeetingUpdated?: (meeting: ProjectMeetingSummary) => void;
}) {
  const [copied, setCopied] = useState(false);
  const scheduled = isUpcomingMeeting(meeting);

  async function copyCodexPrompt() {
    const prompt = buildMeetingPrepCodexPrompt(meeting);
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  if (editing) {
    return <MeetingPrepInlineEditor key={meeting.meetingId} meeting={meeting} onMeetingUpdated={onMeetingUpdated} />;
  }

  return (
    <div className="px-5 py-4 space-y-6">
      <PrepWorkerSection meeting={meeting} />
      {meeting.narrativeMd && (
        <section className="rounded-lg border border-amber-200 bg-amber-50/55 px-4 py-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-[13px] font-bold text-amber-950">初見ブリーフ</h3>
            <span className="rounded-full border border-amber-200 bg-white px-2 py-0.5 text-[10px] text-amber-800">
              {scheduled ? "準備中" : "日程調整中"}
            </span>
          </div>
          <div className="text-[13px] leading-relaxed text-amber-950 [&_h2]:mt-3 [&_h2]:mb-1 [&_h2]:border-b [&_h2]:border-amber-300 [&_h2]:pb-1 [&_h2]:text-[14px] [&_h2]:font-bold [&_p]:my-2">
            <MarkdownView source={meeting.narrativeMd} memberLinks />
          </div>
        </section>
      )}

      {!meeting.narrativeMd && meeting.summaryShort && (
        <UpcomingBriefSection title="まず読む">
          <MarkdownView source={meeting.summaryShort} memberLinks />
        </UpcomingBriefSection>
      )}

      <UpcomingProseSection
        label="会議後に残したい状態"
        helper="何を決めたと言えれば、このMTGを終えてよいか。"
        items={meeting.decided}
      />
      <UpcomingProseSection
        label="いまの状況"
        helper="初めて読む人が、なぜこのMTGが必要なのかを掴むための前提。"
        items={meeting.progress}
      />
      <UpcomingProseSection
        label="当日までに揃えるもの"
        helper="資料、質問、こちらのスタンス。相手に渡すものと、こちらが判断する材料を分けて考える。"
        items={meeting.nextActions}
      />
      <UpcomingProseSection
        label="必ず確認すること"
        helper="会議前に必ず確認しておく前提、相手に聞くこと、あとでOS上の扱いに迷いそうな点。"
        items={meeting.risks}
      />

      <div className="flex flex-wrap items-center gap-2 border-t border-[#e5e5e7] pt-3">
        <button
          type="button"
          onClick={copyCodexPrompt}
          className="rounded border border-amber-300 bg-white px-3 py-1.5 text-[11px] font-medium text-amber-900 hover:bg-amber-50"
        >
          Codex相談メモをコピー
        </button>
        {copied && <span className="text-[11px] text-amber-800">コピーしたよ</span>}
      </div>
    </div>
  );
}

// MTG Prep Worker (= 自動準備セッション、migration 150) の section
// 仕様: pwa/spec/3-3-meeting-flow-current-spec.md「MTG Prep Worker」節
function PrepWorkerSection({ meeting }: { meeting: ProjectMeetingSummary }) {
  const status = meeting.prepWorkerStatus ?? null;
  const score = meeting.prepReadinessScore ?? null;
  const url = meeting.prepWorkerSessionUrl ?? null;
  const draft = meeting.prepDraftMd ?? null;
  const reasons = meeting.prepReadinessReasons ?? null;

  if (!status && score == null && !url && !draft) return null;

  let scoreLabel = "—";
  let scoreClass = "border-stone-200 bg-stone-50 text-stone-700";
  if (score != null) {
    scoreLabel = String(score);
    if (score >= 80) scoreClass = "border-emerald-200 bg-emerald-50 text-emerald-800";
    else if (score >= 50) scoreClass = "border-amber-200 bg-amber-50 text-amber-800";
    else scoreClass = "border-rose-200 bg-rose-50 text-rose-800";
  }

  const statusLabel: Record<string, string> = {
    spawning: "起動中",
    preparing: "準備中",
    ready: "準備OK",
    failed: "起動失敗",
  };

  return (
    <section className="rounded-lg border border-emerald-200 bg-emerald-50/40 px-4 py-3">
      <div className="mb-2 flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-[13px] font-bold text-emerald-950">MTG Prep Worker</h3>
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${scoreClass} whitespace-nowrap`}>
            readiness {scoreLabel}
          </span>
          {status && (
            <span className="text-[10px] px-1.5 py-0.5 rounded border border-emerald-200 bg-white text-emerald-800 whitespace-nowrap">
              {statusLabel[status] || status}
            </span>
          )}
          {url && status !== "failed" && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded border border-emerald-300 bg-emerald-100 px-2.5 py-1 text-[11px] font-medium text-emerald-900 hover:bg-emerald-200"
              title="Codex Cloud で worker session を開く"
            >
              ▶ Prep セッションを開く ↗
            </a>
          )}
        </div>
      </div>
      {reasons && (
        <details className="mb-2">
          <summary className="text-[11px] text-emerald-800 cursor-pointer hover:underline">readiness 内訳</summary>
          <pre className="mt-1 text-[10px] leading-snug text-emerald-900 whitespace-pre-wrap break-words">
            {JSON.stringify(reasons, null, 2)}
          </pre>
        </details>
      )}
      {draft && (
        <div className="text-[12px] leading-relaxed text-emerald-950 [&_h1]:text-[14px] [&_h1]:font-bold [&_h1]:mt-2 [&_h1]:mb-1 [&_h2]:text-[13px] [&_h2]:font-bold [&_h2]:mt-2 [&_h2]:mb-1 [&_h2]:border-b [&_h2]:border-emerald-300 [&_h2]:pb-1 [&_p]:my-2 [&_ul]:my-1 [&_ul]:pl-5 [&_ul]:list-disc">
          <MarkdownView source={draft} />
        </div>
      )}
      {!draft && (
        <p className="text-[11px] text-emerald-800">
          worker draft はまだ届いてないよ。session を開けば対話で詰められるよ。
        </p>
      )}
    </section>
  );
}

function UpcomingBriefSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50/55 px-4 py-3">
      <h3 className="mb-2 text-[13px] font-bold text-amber-950">{title}</h3>
      <div className="text-[13px] leading-relaxed text-amber-950">{children}</div>
    </section>
  );
}

function UpcomingProseSection({
  label,
  helper,
  items,
}: {
  label: string;
  helper: string;
  items: string[];
}) {
  if (!items || items.length === 0) return null;
  return (
    <section className="border-t border-[#e5e5e7] pt-4">
      <h3 className="text-[13px] font-bold text-[#1d1d1f]">{label}</h3>
      {helper && <p className="mt-1 text-[11px] leading-relaxed text-[#86868b]">{helper}</p>}
      <div className="mt-3 space-y-3 text-[13px] leading-relaxed text-[#1d1d1f] [&_strong]:font-bold [&_strong]:text-black [&_mark]:bg-amber-100 [&_p]:my-0">
        {items.map((item, idx) => (
          <div key={idx} className="rounded-md bg-[#fafafa] px-3 py-2">
            <MarkdownView source={item} memberLinks />
          </div>
        ))}
      </div>
    </section>
  );
}

function buildMeetingPrepCodexPrompt(meeting: ProjectMeetingSummary): string {
  return [
    `# MTG準備: ${meeting.title}`,
    "",
    `project_id: ${meeting.projectId}`,
    `meeting_id: ${meeting.meetingId}`,
    `date: ${meeting.meetingDate}`,
    meeting.meetingStartAt ? `start: ${meeting.meetingStartAt}` : "",
    "",
    "## このMTGの狙い",
    meeting.summaryShort || "(未記入)",
    "",
    "## このMTGで決めること",
    formatPromptList(meeting.decided),
    "",
    "## 前提・持ち込みたい現状",
    formatPromptList(meeting.progress),
    "",
    "## それまでに用意するもの",
    formatPromptList(meeting.nextActions),
    "",
    "## 必ず確認すること",
    formatPromptList(meeting.risks),
    "",
    "## えいみ準備メモ",
    meeting.narrativeMd || "(未記入)",
  ].filter(Boolean).join("\n");
}

function formatPromptList(items: string[]): string {
  return items.length > 0 ? items.join("\n\n") : "(未記入)";
}

function MeetingPrepInlineEditor({
  meeting,
  onMeetingUpdated,
}: {
  meeting: ProjectMeetingSummary;
  onMeetingUpdated?: (meeting: ProjectMeetingSummary) => void;
}) {
  const [title, setTitle] = useState(meeting.title);
  const [summaryShort, setSummaryShort] = useState(meeting.summaryShort);
  const [decided, setDecided] = useState(arrayToBlockText(meeting.decided));
  const [progress, setProgress] = useState(arrayToBlockText(meeting.progress));
  const [nextActions, setNextActions] = useState(arrayToBlockText(meeting.nextActions));
  const [risks, setRisks] = useState(arrayToBlockText(meeting.risks));
  const [narrativeMd, setNarrativeMd] = useState(meeting.narrativeMd || "");
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const hasNarrative = !!meeting.narrativeMd?.trim();

  async function save() {
    setSaving(true);
    setNote(null);
    try {
      const res = await fetch("/api/meeting-prep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meeting_id: meeting.meetingId,
          project_id: meeting.projectId,
          meeting_date: meeting.meetingDate,
          meeting_start_at: meeting.meetingStartAt,
          title,
          calendar_event_id: meeting.calendarEventId,
          source_url: meeting.sourceUrl,
          summary_short: summaryShort,
          decided: blockTextToArray(decided),
          progress: blockTextToArray(progress),
          next_actions: blockTextToArray(nextActions),
          risks: blockTextToArray(risks),
          narrative_md: narrativeMd,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNote(`保存失敗: ${json.error || res.status}`);
        return;
      }
      if (json.meeting) onMeetingUpdated?.(json.meeting as ProjectMeetingSummary);
      setNote("保存したよ");
      window.setTimeout(() => setNote(null), 1800);
    } catch (e) {
      setNote(`保存失敗: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="px-5 py-4 space-y-5">
      <InlineTextField label="タイトル" value={title} onChange={setTitle} rows={1} tone="amber" />
      {hasNarrative && (
        <InlineTextField label="一覧カードサマリ" value={summaryShort} onChange={setSummaryShort} rows={3} tone="amber" />
      )}

      {hasNarrative ? (
        <InlineEditSection title="初見ブリーフ" tone="amber">
          <InlineTextarea
            ariaLabel="初見ブリーフ"
            value={narrativeMd}
            onChange={setNarrativeMd}
            rows={10}
            tone="amber"
          />
        </InlineEditSection>
      ) : (
        <InlineEditSection title="まず読む" tone="amber">
          <InlineTextarea
            ariaLabel="まず読む"
            value={summaryShort}
            onChange={setSummaryShort}
            rows={5}
            tone="amber"
          />
        </InlineEditSection>
      )}

      <InlineEditSection title="会議後に残したい状態" helper="何を決めたと言えれば、このMTGを終えてよいか。" tone="amber">
        <InlineTextarea ariaLabel="会議後に残したい状態" value={decided} onChange={setDecided} rows={5} tone="amber" />
      </InlineEditSection>
      <InlineEditSection title="いまの状況" helper="初めて読む人が、なぜこのMTGが必要なのかを掴むための前提。" tone="amber">
        <InlineTextarea ariaLabel="いまの状況" value={progress} onChange={setProgress} rows={4} tone="amber" />
      </InlineEditSection>
      <InlineEditSection title="当日までに揃えるもの" helper="資料、質問、こちらのスタンス。相手に渡すものと、こちらが判断する材料を分けて考える。" tone="amber">
        <InlineTextarea ariaLabel="当日までに揃えるもの" value={nextActions} onChange={setNextActions} rows={5} tone="amber" />
      </InlineEditSection>
      <InlineEditSection title="必ず確認すること" helper="会議前に必ず確認しておく前提、相手に聞くこと、あとでOS上の扱いに迷いそうな点。" tone="amber">
        <InlineTextarea ariaLabel="必ず確認すること" value={risks} onChange={setRisks} rows={4} tone="amber" />
      </InlineEditSection>

      <SaveRow onSave={save} saving={saving} disabled={!title.trim()} note={note} tone="amber" />
    </div>
  );
}

function arrayToBlockText(items: string[]): string {
  return items.join("\n\n");
}

function blockTextToArray(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
}

function InlineTextField({
  label,
  value,
  onChange,
  rows,
  tone = "default",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows: number;
  tone?: "default" | "amber";
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-[#3c3c43]">{label}</span>
      <InlineTextarea ariaLabel={label} value={value} onChange={onChange} rows={rows} tone={tone} />
    </label>
  );
}

function MeetingSummaryInlineEditor({
  meeting,
  variant,
  onMeetingUpdated,
}: {
  meeting: ProjectMeetingSummary;
  variant: "regular" | "dialogue";
  onMeetingUpdated?: (meeting: ProjectMeetingSummary) => void;
}) {
  const [title, setTitle] = useState(meeting.title);
  const [summaryShort, setSummaryShort] = useState(meeting.summaryShort);
  const [decided, setDecided] = useState(arrayToBlockText(meeting.decided));
  const [progress, setProgress] = useState(arrayToBlockText(meeting.progress));
  const [nextActions, setNextActions] = useState(arrayToBlockText(meeting.nextActions));
  const [risks, setRisks] = useState(arrayToBlockText(meeting.risks));
  const [narrativeMd, setNarrativeMd] = useState(meeting.narrativeMd || "");
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const hasNarrative = !!meeting.narrativeMd?.trim();

  async function save() {
    setSaving(true);
    setNote(null);
    try {
      const res = await fetch("/api/meeting-summary/manual-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meeting_id: meeting.meetingId,
          title,
          summary_short: summaryShort,
          decided: blockTextToArray(decided),
          progress: blockTextToArray(progress),
          next_actions: blockTextToArray(nextActions),
          risks: blockTextToArray(risks),
          narrative_md: narrativeMd,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.ok === false) {
        setNote(`保存失敗: ${json.error || res.status}`);
        return;
      }
      if (json.meeting) onMeetingUpdated?.(json.meeting as ProjectMeetingSummary);
      setNote("保存したよ");
      window.setTimeout(() => setNote(null), 1800);
    } catch (e) {
      setNote(`保存失敗: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setSaving(false);
    }
  }

  const rawLabels = variant === "dialogue"
    ? {
        summary: "背景・議題",
        progress: "議論の中で進んだこと",
        decided: "チームへの提案案",
        nextActions: "次の一手",
        risks: "気になっていること / 残課題",
      }
    : {
        summary: "サマリ",
        progress: "進んだこと",
        decided: "決まったこと",
        nextActions: "次やること",
        risks: "リスク",
      };

  return (
    <div className="px-5 py-4 space-y-5">
      <InlineTextField label="タイトル" value={title} onChange={setTitle} rows={1} />
      {hasNarrative && (
        <InlineTextField label="一覧カードサマリ" value={summaryShort} onChange={setSummaryShort} rows={4} />
      )}

      {hasNarrative ? (
        <InlineEditSection title={variant === "dialogue" ? "提案整理本文" : "議事録"}>
          <InlineTextarea
            ariaLabel={variant === "dialogue" ? "提案整理本文" : "議事録"}
            value={narrativeMd}
            onChange={setNarrativeMd}
            rows={14}
          />
        </InlineEditSection>
      ) : (
        <>
          <InlineEditSection title={rawLabels.summary}>
            <InlineTextarea ariaLabel={rawLabels.summary} value={summaryShort} onChange={setSummaryShort} rows={5} />
          </InlineEditSection>
          <InlineEditSection title={rawLabels.decided}>
            <InlineTextarea ariaLabel={rawLabels.decided} value={decided} onChange={setDecided} rows={5} />
          </InlineEditSection>
          <InlineEditSection title={rawLabels.progress}>
            <InlineTextarea ariaLabel={rawLabels.progress} value={progress} onChange={setProgress} rows={4} />
          </InlineEditSection>
          <InlineEditSection title={rawLabels.nextActions}>
            <InlineTextarea ariaLabel={rawLabels.nextActions} value={nextActions} onChange={setNextActions} rows={5} />
          </InlineEditSection>
          <InlineEditSection title={rawLabels.risks}>
            <InlineTextarea ariaLabel={rawLabels.risks} value={risks} onChange={setRisks} rows={4} />
          </InlineEditSection>
        </>
      )}

      <SaveRow onSave={save} saving={saving} disabled={!title.trim()} note={note} />
    </div>
  );
}

function InlineEditSection({
  title,
  helper,
  tone = "default",
  children,
}: {
  title: string;
  helper?: string;
  tone?: "default" | "amber";
  children: React.ReactNode;
}) {
  const titleClass = tone === "amber" ? "text-amber-950 border-amber-300" : "text-[#1d1d1f] border-[#e5e5e7]";
  const helperClass = tone === "amber" ? "text-amber-800" : "text-[#86868b]";
  return (
    <section>
      <h3 className={`mb-2 border-b pb-1 text-[14px] font-bold ${titleClass}`}>{title}</h3>
      {helper && <p className={`mb-2 text-[11px] leading-relaxed ${helperClass}`}>{helper}</p>}
      {children}
    </section>
  );
}

function InlineTextarea({
  ariaLabel,
  value,
  onChange,
  rows,
  tone = "default",
}: {
  ariaLabel: string;
  value: string;
  onChange: (value: string) => void;
  rows: number;
  tone?: "default" | "amber";
}) {
  const className = tone === "amber"
    ? "w-full rounded border border-amber-200 bg-amber-50/20 px-2.5 py-2 text-[12px] leading-relaxed text-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-amber-400"
    : "w-full rounded border border-[#d2d2d7] bg-[#fbfbfd] px-2.5 py-2 text-[12px] leading-relaxed text-[#1d1d1f] focus:outline-none focus:ring-1 focus:ring-[#007aff]";
  return (
    <textarea
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      className={className}
    />
  );
}

function SaveRow({
  onSave,
  saving,
  disabled,
  note,
  tone = "default",
}: {
  onSave: () => void;
  saving: boolean;
  disabled?: boolean;
  note: string | null;
  tone?: "default" | "amber";
}) {
  const buttonClass = tone === "amber"
    ? "inline-flex items-center gap-1.5 rounded bg-amber-600 px-3 py-1.5 text-[11px] font-medium text-white disabled:opacity-50"
    : "inline-flex items-center gap-1.5 rounded bg-[#1d1d1f] px-3 py-1.5 text-[11px] font-medium text-white disabled:opacity-50";
  const noteClass = tone === "amber" ? "text-[11px] text-amber-800" : "text-[11px] text-[#3c3c43]";
  return (
    <div className="flex items-center gap-2 border-t border-[#e5e5e7] pt-3">
      <button type="button" onClick={onSave} disabled={saving || disabled} className={buttonClass}>
        <Save className="h-3.5 w-3.5" aria-hidden="true" />
        <span>{saving ? "保存中..." : "保存"}</span>
      </button>
      {note && <span className={noteClass}>{note}</span>}
    </div>
  );
}

// ============================================================
// 通常の MTG (Notion / Drive / Slack / Gmail / Calendar 抽出)
// ============================================================

function RegularMeetingBody({
  meeting,
  prepMeeting,
  editing,
  onMeetingUpdated,
}: {
  meeting: ProjectMeetingSummary;
  prepMeeting?: ProjectMeetingSummary | null;
  editing: boolean;
  onMeetingUpdated?: (meeting: ProjectMeetingSummary) => void;
}) {
  const hasTopics =
    meeting.decided.length > 0 ||
    meeting.progress.length > 0 ||
    meeting.nextActions.length > 0 ||
    meeting.risks.length > 0;
  const hasNarrative = !!meeting.narrativeMd?.trim();

  if (editing) {
    return <MeetingSummaryInlineEditor key={meeting.meetingId} meeting={meeting} variant="regular" onMeetingUpdated={onMeetingUpdated} />;
  }

  return (
    <div className="px-5 py-4 space-y-6">
      {hasNarrative ? (
        <section>
          <h3 className="mb-2 flex items-baseline gap-1.5 border-b border-[#e5e5e7] pb-1 text-[14px] font-bold text-[#1d1d1f]">
            <span>議事録</span>
          </h3>
          <article className="text-[14px] leading-relaxed text-[#1d1d1f] [&_strong]:font-bold [&_strong]:text-black [&_mark]:bg-amber-100">
            <MarkdownView source={meeting.narrativeMd!} memberLinks />
          </article>
        </section>
      ) : meeting.summaryShort ? (
        <SummarySection emoji="📝" label="サマリ">
          <MarkdownView source={meeting.summaryShort} memberLinks />
        </SummarySection>
      ) : null}

      {prepMeeting && <PreparationArchive prepMeeting={prepMeeting} />}

      {!hasNarrative && (
        <>
          <TopicList emoji="✅" label="決まったこと" items={meeting.decided} accent="emerald" />
          <TopicList emoji="📈" label="進んだこと" items={meeting.progress} accent="blue" />
          <TopicList emoji="🎯" label="次やること" items={meeting.nextActions} accent="amber" />
          <TopicList emoji="⚠️" label="リスク" items={meeting.risks} accent="rose" />
        </>
      )}

      {!hasTopics && !meeting.summaryShort && (
        <p className="text-[12px] text-[#86868b]">
          {meeting.sourceKinds === "none" ? "議事録なし" : "議事録あり・抽出空 (本文薄い or LLM 失敗)"}
        </p>
      )}
    </div>
  );
}

function PreparationArchive({ prepMeeting }: { prepMeeting: ProjectMeetingSummary }) {
  return (
    <details className="rounded-md border border-amber-200 bg-amber-50/35">
      <summary className="cursor-pointer px-3 py-2 text-[12px] font-semibold text-amber-950">
        MTG準備情報
      </summary>
      <div className="space-y-4 border-t border-amber-100 px-3 py-3">
        {prepMeeting.narrativeMd && (
          <section className="text-[13px] leading-relaxed text-amber-950">
            <MarkdownView source={prepMeeting.narrativeMd} memberLinks />
          </section>
        )}
        {!prepMeeting.narrativeMd && prepMeeting.summaryShort && (
          <section className="text-[13px] leading-relaxed text-amber-950">
            <MarkdownView source={prepMeeting.summaryShort} memberLinks />
          </section>
        )}
        <UpcomingProseSection
          label="会議後に残したい状態"
          helper=""
          items={prepMeeting.decided}
        />
        <UpcomingProseSection
          label="いまの状況"
          helper=""
          items={prepMeeting.progress}
        />
        <UpcomingProseSection
          label="当日までに揃えるもの"
          helper=""
          items={prepMeeting.nextActions}
        />
        <UpcomingProseSection
          label="必ず確認すること"
          helper=""
          items={prepMeeting.risks}
        />
      </div>
    </details>
  );
}

// ============================================================
// dialogue meeting = 提案前の論点整理セッション。
// 「決定」と断定せず、チームへの提案案として読めるニュアンスにする。
// 初めて読んだ人でも背景 → 議論 → 提案 → 残課題 が分かるよう、各セクション頭に
// 1 行の説明を必ず置く構成 (#6 まさ確定 2026-05-23)。
// ============================================================

function DialogueMeetingBody({
  meeting,
  editing,
  onMeetingUpdated,
}: {
  meeting: ProjectMeetingSummary;
  editing: boolean;
  onMeetingUpdated?: (meeting: ProjectMeetingSummary) => void;
}) {
  if (editing) {
    return <MeetingSummaryInlineEditor key={meeting.meetingId} meeting={meeting} variant="dialogue" onMeetingUpdated={onMeetingUpdated} />;
  }
  // narrative_md があればそれを正本として 1 本のストーリーで見せる。
  // raw 配列 (decided/progress/...) は narrative の下に「元データ」として小さく出す。
  if (meeting.narrativeMd && meeting.narrativeMd.trim().length > 0) {
    return <DialogueNarrativeBody meeting={meeting} />;
  }
  return <DialogueRawBody meeting={meeting} />;
}

function DialogueNarrativeBody({ meeting }: { meeting: ProjectMeetingSummary }) {
  // まさ #6-2nd (2026-05-24): raw データ折りたたみは廃止。表を含めて narrative_md 本文にすべて入る前提。
  return (
    <div className="px-5 py-4">
      <article className="text-[14px] leading-relaxed text-[#1d1d1f]">
        <MarkdownView source={meeting.narrativeMd!} memberLinks />
      </article>
    </div>
  );
}

function DialogueRawBody({ meeting }: { meeting: ProjectMeetingSummary }) {
  const hasTopics =
    meeting.decided.length > 0 ||
    meeting.progress.length > 0 ||
    meeting.nextActions.length > 0 ||
    meeting.risks.length > 0;

  return (
    <div className="px-5 py-4 space-y-7">
      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
        ⓘ この dialogue meeting はまだ narrative 化されていません。下記は raw データです。
        narrative は <code className="bg-amber-100 px-1 rounded">POST /api/dialogue-meeting/narrate</code> で生成できます (admin or CRON_SECRET)。
      </div>

      <SummarySection emoji="📝" label="背景・議題">
        {meeting.summaryShort ? (
          <MarkdownView source={meeting.summaryShort} memberLinks />
        ) : (
          <p className="text-[12px] text-[#86868b] italic">
            背景メモなし。このセッションの経緯やコンテキストは記録されなかった。
          </p>
        )}
      </SummarySection>

      <NarrativeSection
        emoji="📈"
        label="議論の中で進んだこと"
        intro="このセッションで論点が前進した／新しく見えてきたことのリスト。事実上の合意点ではなく、議論の中で詰まった内容。"
        items={meeting.progress}
        accent="blue"
        emptyHint="議論で前進した項目は記録されていません。"
      />

      <NarrativeSection
        emoji="💬"
        label="チームへの提案案"
        intro={
          "提案前の論点整理セッションで整理した、チームに出す提案案。" +
          "チームで議論したうえで採否を判断する前提。"
        }
        items={meeting.decided}
        accent="emerald"
        emptyHint="提案として残された方針はありません。"
      />

      <NarrativeSection
        emoji="🎯"
        label="次の一手"
        intro="次回会議までに動くこと。担当が明確なら名前と期限を併記、未定なら「要相談」として残す。"
        items={meeting.nextActions}
        accent="amber"
        emptyHint="次の一手は明示されていません。"
      />

      <NarrativeSection
        emoji="⚠️"
        label="気になっていること / 残課題"
        intro="まだ提案や決定にはなっていないが、議論中に出てきたリスク・違和感・未解消の論点。"
        items={meeting.risks}
        accent="rose"
        emptyHint="残課題はありません。"
      />

      {!hasTopics && !meeting.summaryShort && (
        <p className="text-[12px] text-[#86868b]">
          この dialogue meeting には議論ログが残されていません。
        </p>
      )}
    </div>
  );
}

// ============================================================
// 共通: セクション
// ============================================================

interface SummarySectionProps {
  emoji: string;
  label: string;
  children: React.ReactNode;
}

function SummarySection({ emoji, label, children }: SummarySectionProps) {
  return (
    <section>
      <h3 className="mb-2 flex items-baseline gap-1.5 text-[14px] font-bold text-[#1d1d1f] border-b border-[#e5e5e7] pb-1">
        <span>{emoji}</span>
        <span>{label}</span>
      </h3>
      <div className="text-[13px] leading-relaxed text-[#1d1d1f] [&_strong]:font-bold [&_strong]:text-black [&_mark]:bg-amber-100">{children}</div>
    </section>
  );
}

interface TopicProps {
  emoji: string;
  label: string;
  items: string[];
  accent: "emerald" | "blue" | "amber" | "rose";
}

const ACCENT_BORDER: Record<TopicProps["accent"], string> = {
  emerald: "border-emerald-400",
  blue: "border-blue-400",
  amber: "border-amber-400",
  rose: "border-rose-400",
};
const ACCENT_BULLET: Record<TopicProps["accent"], string> = {
  emerald: "text-emerald-500",
  blue: "text-blue-500",
  amber: "text-amber-500",
  rose: "text-rose-500",
};

/**
 * #5 まさ指示 (2026-05-23): 旧 TopicSection は各箇条書きを個別フレームで囲んでいて
 * 視覚的に重く読みづらかった。フレーム廃止 + 太字 / マーカー 等の Markdown を活かして
 * 強弱だけで読ませる構成へ。
 */
function TopicList({ emoji, label, items, accent }: TopicProps) {
  if (!items || items.length === 0) return null;
  return (
    <section>
      <h3 className={`mb-2 flex items-baseline gap-2 text-[14px] font-bold text-[#1d1d1f] border-b-2 ${ACCENT_BORDER[accent]} pb-1`}>
        <span>{emoji}</span>
        <span>{label}</span>
        <span className="text-[10px] font-normal text-[#86868b] tabular-nums">({items.length})</span>
      </h3>
      <ul className="space-y-1.5 pl-1 text-[13px] leading-relaxed text-[#1d1d1f]">
        {items.map((it, idx) => (
          <li key={idx} className="flex gap-2 items-start">
            <span className={`mt-1.5 shrink-0 text-[10px] ${ACCENT_BULLET[accent]}`}>●</span>
            <div className="flex-1 min-w-0 [&_strong]:font-bold [&_strong]:text-black [&_mark]:bg-amber-100 [&_h1]:text-[15px] [&_h1]:font-bold [&_h2]:text-[14px] [&_h2]:font-bold">
              <MarkdownView source={it} memberLinks />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * #6 まさ指示 (2026-05-23): dialogue meeting は箇条書きベースだと初見で読めない。
 * セクション頭に必ず 1 行の説明 (intro) を入れて、何が書かれている欄か / どう読めば
 * いいかを明示する。中身は TopicList と同じく強弱で読ませる。
 */
interface NarrativeProps extends TopicProps {
  intro: string;
  emptyHint?: string;
}

function NarrativeSection({ emoji, label, intro, items, accent, emptyHint }: NarrativeProps) {
  const hasItems = items && items.length > 0;
  return (
    <section>
      <h3 className={`mb-1 flex items-baseline gap-2 text-[14px] font-bold text-[#1d1d1f] border-b-2 ${ACCENT_BORDER[accent]} pb-1`}>
        <span>{emoji}</span>
        <span>{label}</span>
        {hasItems && <span className="text-[10px] font-normal text-[#86868b] tabular-nums">({items.length})</span>}
      </h3>
      <p className="mb-2 text-[11px] leading-relaxed text-[#86868b]">{intro}</p>
      {hasItems ? (
        <ul className="space-y-1.5 pl-1 text-[13px] leading-relaxed text-[#1d1d1f]">
          {items.map((it, idx) => (
            <li key={idx} className="flex gap-2 items-start">
              <span className={`mt-1.5 shrink-0 text-[10px] ${ACCENT_BULLET[accent]}`}>●</span>
              <div className="flex-1 min-w-0 [&_strong]:font-bold [&_strong]:text-black [&_mark]:bg-amber-100 [&_h1]:text-[15px] [&_h1]:font-bold [&_h2]:text-[14px] [&_h2]:font-bold">
                <MarkdownView source={it} memberLinks />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[12px] text-[#86868b] italic">{emptyHint || "-"}</p>
      )}
    </section>
  );
}
