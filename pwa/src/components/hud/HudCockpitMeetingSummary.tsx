"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchProjectMeetingSummaries, type ProjectMeetingSummary } from "@/lib/supabase-data";
import {
  groupUpcomingMeetingsBySeries,
  isPrepMeeting,
  isUpcomingMeeting,
  type UpcomingMeetingSeries,
} from "@/lib/meeting-series";
import { HudCockpitMeetingDetailModal } from "./HudCockpitMeetingDetailModal";

interface Props {
  projectId: string;
}

const EMPTY_MEETING_SUMMARIES: ProjectMeetingSummary[] = [];
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

function todayJstIsoDate(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
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
  const [recentState, setRecentState] = useState<{ projectId: string | null; items: ProjectMeetingSummary[] }>({
    projectId: null,
    items: [],
  });
  const [olderItems, setOlderItems] = useState<ProjectMeetingSummary[]>([]);
  const [showOlder, setShowOlder] = useState(false);
  const [olderLoading, setOlderLoading] = useState(false);
  const [olderLoaded, setOlderLoaded] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<ProjectMeetingSummary | null>(null);

  const sinceDate = useMemo(() => todayMinus365IsoDate(), []);
  const loading = recentState.projectId !== projectId;
  const recentItems = loading ? EMPTY_MEETING_SUMMARIES : recentState.items;

  useEffect(() => {
    let cancelled = false;
    fetchProjectMeetingSummaries(projectId, { sinceDate })
      .then((items) => {
        if (!cancelled) setRecentState({ projectId, items });
      });
    return () => {
      cancelled = true;
    };
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

  const today = useMemo(() => todayJstIsoDate(), []);
  const upcomingSeries = useMemo(
    () => groupUpcomingMeetingsBySeries(
      recentItems.filter((item) => isUpcomingMeeting(item) && item.meetingDate >= today)
    ),
    [recentItems, today]
  );
  const pastRecentItems = useMemo(
    () => recentItems.filter((item) => !isPrepMeeting(item) && item.meetingDate <= today),
    [recentItems, today]
  );
  const visibleCount = upcomingSeries.length + pastRecentItems.length;
  const recentGroups = useMemo(() => groupByYm(pastRecentItems), [pastRecentItems]);
  const olderGroups = useMemo(() => groupByYm(olderItems.filter((item) => !isPrepMeeting(item))), [olderItems]);

  return (
    <section className="relative overflow-hidden border border-cyan-300/35 bg-slate-950/88 px-4 py-3.5 text-cyan-50 shadow-[0_0_20px_rgba(34,211,238,0.12)]">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.08)_1px,transparent_1px)] bg-[length:100%_8px]" />
      <div className="relative mb-3 flex items-center gap-2">
        <h3 className="text-[12px] font-black uppercase tracking-[0.18em] text-cyan-100">MTG Summary</h3>
        <span className="h-px flex-1 bg-cyan-300/35" />
        <span className="text-[10px] font-bold tabular-nums text-cyan-200/80">{String(visibleCount).padStart(2, "0")}</span>
      </div>

      {loading ? (
        <p className="relative text-[12px] text-cyan-100/68">読み込み中...</p>
      ) : visibleCount === 0 && !showOlder ? (
        <div className="relative space-y-2">
          <p className="text-[12px] text-cyan-100/68">直近1年の議事録データなし</p>
          <button onClick={loadOlder} className="text-[11px] font-bold text-cyan-200 hover:text-white">
            それより前を表示
          </button>
        </div>
      ) : (
        <div className="relative flex max-h-[480px] flex-col gap-3 overflow-y-auto pr-1">
          {upcomingSeries.length > 0 && (
            <UpcomingSeriesBlock series={upcomingSeries} onSelect={setSelectedMeeting} />
          )}

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

function UpcomingSeriesBlock({
  series,
  onSelect,
}: {
  series: UpcomingMeetingSeries[];
  onSelect: (m: ProjectMeetingSummary) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2 text-[11px] font-black tracking-[0.12em] text-amber-200/86">
        <span>予定MTG</span>
        <span className="h-px flex-1 bg-amber-300/22" />
        <span className="tabular-nums">{series.length}</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {series.map((group) => (
          <MeetingRow key={group.key} item={group.next} series={group} onClick={() => onSelect(group.next)} />
        ))}
      </div>
    </div>
  );
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
  series?: UpcomingMeetingSeries;
}

function MeetingRow({ item, onClick, series }: RowProps) {
  const dateLabel = formatDateLabel(item.meetingDate);
  const timeLabel = formatTimeLabel(item.meetingStartAt);
  const isUpcoming = isUpcomingMeeting(item);

  return (
    <button
      onClick={onClick}
      className={`w-full text-left border px-3 py-2 transition-colors ${
        isUpcoming
          ? "border-amber-300/28 bg-amber-300/8 hover:border-amber-200/55 hover:bg-amber-300/12"
          : "border-cyan-300/22 bg-slate-900/66 hover:border-cyan-200/55 hover:bg-cyan-300/8"
      }`}
    >
      <div className="flex items-start gap-2">
        <span className={`w-[64px] shrink-0 font-mono text-[11px] tabular-nums ${isUpcoming ? "text-amber-100/78" : "text-cyan-200/72"}`}>{dateLabel}</span>
        {timeLabel && <span className={`w-[36px] shrink-0 font-mono text-[11px] tabular-nums ${isUpcoming ? "text-amber-100/78" : "text-cyan-200/72"}`}>{timeLabel}</span>}
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5 text-[12px] font-bold text-cyan-50">
            {isUpcoming && (
              <span className="shrink-0 border border-amber-300/35 bg-amber-300/12 px-1 py-px text-[9px] font-black text-amber-100">
                {series?.kind === "series" ? "SERIES" : "NEXT"}
              </span>
            )}
            <span className="truncate">{item.title}</span>
          </div>
          {item.summaryShort && (
            <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-cyan-50/70">{item.summaryShort}</p>
          )}
          {series?.kind === "series" && series.hiddenCount > 0 && (
            <p className="mt-0.5 text-[10px] font-bold text-amber-100/80">同シリーズ +{series.hiddenCount}</p>
          )}
        </div>
        <span className="shrink-0 text-[10px] text-cyan-200/70 mt-0.5">↗</span>
      </div>
    </button>
  );
}
