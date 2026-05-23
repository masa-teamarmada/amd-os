"use client";

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ProjectMeetingSummary } from "@/lib/supabase-data";
import { MarkdownView } from "@/components/cockpit/MarkdownView";

interface Props {
  meeting: ProjectMeetingSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

export function HudCockpitMeetingDetailModal({ meeting, open, onOpenChange }: Props) {
  if (!meeting) return null;

  const hasTopics =
    meeting.decided.length > 0 ||
    meeting.progress.length > 0 ||
    meeting.nextActions.length > 0 ||
    meeting.risks.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-[1100px] w-[92vw] max-h-[88vh] overflow-y-auto p-0 border border-cyan-300/35 bg-slate-950/96 text-cyan-50 shadow-[0_0_28px_rgba(34,211,238,0.18)]">
        <header className="sticky top-0 z-10 border-b border-cyan-300/22 bg-slate-950/95 px-5 py-3 backdrop-blur">
          <div className="font-mono text-[11px] tabular-nums text-cyan-200/80">
            {formatHeaderDate(meeting.meetingDate, meeting.meetingStartAt)}
            {meeting.sourceKinds && (
              <span className="ml-2 border border-cyan-300/40 bg-cyan-300/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-cyan-100">
                {meeting.sourceKinds}
              </span>
            )}
          </div>
          <DialogTitle className="mt-1 text-[15px] font-black leading-snug text-cyan-50">
            {meeting.title}
          </DialogTitle>
          {meeting.notionUrl && (
            <a
              href={meeting.notionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block text-[11px] font-bold text-cyan-200 hover:text-white"
            >
              Notion で開く ↗
            </a>
          )}
        </header>

        <div className="space-y-5 px-5 py-4">
          {meeting.summaryShort && (
            <Section label="SUMMARY">
              <MarkdownView source={meeting.summaryShort} tone="hud" />
            </Section>
          )}

          <TopicSection label="DECIDED / 決まったこと" items={meeting.decided} tone="cyan" />
          <TopicSection label="PROGRESS / 進んだこと" items={meeting.progress} tone="emerald" />
          <TopicSection label="NEXT / 次やること" items={meeting.nextActions} tone="amber" />
          <TopicSection label="RISKS / リスク" items={meeting.risks} tone="rose" />

          {!hasTopics && !meeting.summaryShort && (
            <p className="text-[12px] text-cyan-100/60">
              {meeting.sourceKinds === "none" ? "議事録なし" : "議事録あり・抽出空 (本文薄い or LLM 失敗)"}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface SectionProps {
  label: string;
  children: React.ReactNode;
}

function Section({ label, children }: SectionProps) {
  return (
    <section>
      <h3 className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-cyan-200">
        {label}
      </h3>
      <div className="border border-cyan-300/22 bg-slate-900/66 px-4 py-3">{children}</div>
    </section>
  );
}

interface TopicProps {
  label: string;
  items: string[];
  tone: "cyan" | "emerald" | "amber" | "rose";
}

const TONE: Record<TopicProps["tone"], { head: string; border: string }> = {
  cyan: { head: "text-cyan-200", border: "border-l-[3px] border-cyan-300/70" },
  emerald: { head: "text-emerald-200", border: "border-l-[3px] border-emerald-300/70" },
  amber: { head: "text-amber-200", border: "border-l-[3px] border-amber-300/70" },
  rose: { head: "text-rose-200", border: "border-l-[3px] border-rose-300/70" },
};

function TopicSection({ label, items, tone }: TopicProps) {
  if (!items || items.length === 0) return null;
  const t = TONE[tone];
  return (
    <section>
      <h3 className={`mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] ${t.head}`}>
        <span>{label}</span>
        <span className="text-[10px] tabular-nums text-cyan-200/60">({items.length})</span>
      </h3>
      <div className="space-y-2">
        {items.map((it, idx) => (
          <div
            key={idx}
            className={`border border-cyan-300/22 bg-slate-900/72 px-4 py-3 ${t.border}`}
          >
            <MarkdownView source={it} tone="hud" />
          </div>
        ))}
      </div>
    </section>
  );
}
