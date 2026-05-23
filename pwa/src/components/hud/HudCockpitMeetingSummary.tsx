"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchProjectMeetingSummaries, type ProjectMeetingSummary } from "@/lib/supabase-data";
import { HudCockpitMeetingDetailModal } from "./HudCockpitMeetingDetailModal";

interface Props {
  projectId: string;
}

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

function formatDateLabel(iso: string): string {
  const d = new Date(iso + "T00:00:00+09:00");
  if (isNaN(d.getTime())) return iso;
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const w = WEEKDAYS[d.getDay()];
  return `${m}/${day} (${w})`;
}

function formatTimeLabel(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function formatYmLabel(ym: string): string {
  if (!ym || ym.length < 6) return ym;
  return `${ym.slice(0, 4)}年${Number(ym.slice(4, 6))}月`;
}

function ymOf(meetingDate: string): string {
  return meetingDate.slice(0, 4) + meetingDate.slice(5, 7);
}

function todayMinus365IsoDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 365);
  return d.toISOString().slice(0, 10);
}

interface MeetingGroup {
  ym: string;
  items: ProjectMeetingSummary[];
}

function groupByYm(items: ProjectMeetingSummary[]): MeetingGroup[] {
  const map = new Map<string, ProjectMeetingSummary[]>();
  for (const item of items) {
    const ym = item.ym || ymOf(item.meetingDate);
    const arr = map.get(ym) || [];
    arr.push(item);
    map.set(ym, arr);
  }
  return Array.from(map.entries())
    .map(([ym, items]) => ({ ym, items }))
    .sort((a, b) => b.ym.localeCompare(a.ym));
}

export function HudCockpitMeetingSummary({ projectId }: Props) {
  const [recentItems, setRecentItems] = useState<ProjectMeetingSummary[]>([]);
  const [olderItems, setOlderItems] = useState<ProjectMeetingSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOlder, setShowOlder] = useState(false);
  const [olderLoading, setOlderLoading] = useState(false);
  const [olderLoaded, setOlderLoaded] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<ProjectMeetingSummary | null>(null);

  const sinceDate = useMemo(() => todayMinus365IsoDate(), []);

  useEffect(() => {
    setLoading(true);
    fetchProjectMeetingSummaries(projectId, { sinceDate })
      .then(setRecentItems)
      .finally(() => setLoading(false));
  }, [projectId, sinceDate]);

  async function loadOlder() {
    if (olderLoaded) {
      setShowOlder((v) => !v);
      return;
    }
    setOlderLoading(true);
    setShowOlder(true);
    const all = await fetchProjectMeetingSummaries(projectId, {});
    const older = all.filter((i) => i.meetingDate < sinceDate);
    setOlderItems(older);
    setOlderLoaded(true);
    setOlderLoading(false);
  }

  const recentGroups = useMemo(() => groupByYm(recentItems), [recentItems]);
  const olderGroups = useMemo(() => groupByYm(olderItems), [olderItems]);

  return (
    <section className="relative overflow-hidden border border-cyan-300/35 bg-slate-950/88 px-4 py-3.5 text-cyan-50 shadow-[0_0_20px_rgba(34,211,238,0.12)]">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.08)_1px,transparent_1px)] bg-[length:100%_8px]" />
      <div className="relative mb-3 flex items-center gap-2">
        <h3 className="text-[12px] font-black uppercase tracking-[0.18em] text-cyan-100">MTG Summary</h3>
        <span className="h-px flex-1 bg-cyan-300/35" />
        <span className="text-[10px] font-bold tabular-nums text-cyan-200/80">{String(recentItems.length).padStart(2, "0")}</span>
      </div>

      {loading ? (
        <p className="relative text-[12px] text-cyan-100/68">読み込み中...</p>
      ) : recentItems.length === 0 && !showOlder ? (
        <div className="relative space-y-2">
          <p className="text-[12px] text-cyan-100/68">直近1年の議事録データなし</p>
          <button onClick={loadOlder} className="text-[11px] font-bold text-cyan-200 hover:text-white">
            それより前を表示
          </button>
        </div>
      ) : (
        <div className="relative flex max-h-[480px] flex-col gap-3 overflow-y-auto pr-1">
          {recentGroups.map((g) => (
            <MeetingGroupBlock key={g.ym} group={g} onSelect={setSelectedMeeting} />
          ))}

          <div className="border-t border-cyan-300/18 pt-1">
            <button onClick={loadOlder} className="text-[11px] font-bold text-cyan-200 hover:text-white" disabled={olderLoading}>
              {olderLoading ? "読み込み中..." : showOlder ? "▲ それより前を隠す" : "▼ それより前を表示"}
            </button>
          </div>

          {showOlder && olderGroups.length > 0 && (
            <div className="flex flex-col gap-3 pt-1">
              {olderGroups.map((g) => (
                <MeetingGroupBlock key={g.ym} group={g} onSelect={setSelectedMeeting} />
              ))}
            </div>
          )}

          {showOlder && olderLoaded && olderGroups.length === 0 && (
            <p className="pt-1 text-[11px] text-cyan-100/60">それより前の議事録データはありません</p>
          )}
        </div>
      )}

      <HudCockpitMeetingDetailModal
        meeting={selectedMeeting}
        open={selectedMeeting !== null}
        onOpenChange={(open) => { if (!open) setSelectedMeeting(null); }}
      />
    </section>
  );
}

interface GroupProps {
  group: MeetingGroup;
  onSelect: (m: ProjectMeetingSummary) => void;
}

function MeetingGroupBlock({ group, onSelect }: GroupProps) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2 text-[11px] font-black tracking-[0.12em] text-cyan-200/76">
        <span>{formatYmLabel(group.ym)}</span>
        <span className="h-px flex-1 bg-cyan-300/18" />
        <span className="tabular-nums">{group.items.length}</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {group.items.map((item) => (
          <MeetingRow key={item.meetingId} item={item} onClick={() => onSelect(item)} />
        ))}
      </div>
    </div>
  );
}

interface RowProps {
  item: ProjectMeetingSummary;
  onClick: () => void;
}

function MeetingRow({ item, onClick }: RowProps) {
  const dateLabel = formatDateLabel(item.meetingDate);
  const timeLabel = formatTimeLabel(item.meetingStartAt);

  return (
    <button
      onClick={onClick}
      className="w-full text-left border border-cyan-300/22 bg-slate-900/66 px-3 py-2 transition-colors hover:border-cyan-200/55 hover:bg-cyan-300/8"
    >
      <div className="flex items-start gap-2">
        <span className="w-[64px] shrink-0 font-mono text-[11px] tabular-nums text-cyan-200/72">{dateLabel}</span>
        {timeLabel && <span className="w-[36px] shrink-0 font-mono text-[11px] tabular-nums text-cyan-200/72">{timeLabel}</span>}
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12px] font-bold text-cyan-50">{item.title}</div>
          {item.summaryShort && (
            <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-cyan-50/70">{item.summaryShort}</p>
          )}
        </div>
        <span className="shrink-0 text-[10px] text-cyan-200/70 mt-0.5">↗</span>
      </div>
    </button>
  );
}
