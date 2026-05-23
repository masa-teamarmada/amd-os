"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchProjectMeetingSummaries, type ProjectMeetingSummary } from "@/lib/supabase-data";
import { CockpitMeetingDetailModal } from "./CockpitMeetingDetailModal";

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

export function CockpitMeetingSummary({ projectId }: Props) {
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
    <section className="bg-white rounded-xl border border-[#e5e5e7] px-4 py-3.5">
      <h3 className="text-[13px] font-medium mb-2.5">MTGサマリ</h3>

      {loading ? (
        <p className="text-[12px] text-[#86868b]">読み込み中...</p>
      ) : recentItems.length === 0 && !showOlder ? (
        <div className="space-y-2">
          <p className="text-[12px] text-[#86868b]">直近1年の議事録データなし</p>
          <button
            onClick={loadOlder}
            className="text-[11px] text-[#007aff] hover:underline"
          >
            それより前を表示
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3 max-h-[480px] overflow-y-auto">
          {recentGroups.map((g) => (
            <MeetingGroupBlock
              key={g.ym}
              group={g}
              onSelect={setSelectedMeeting}
            />
          ))}

          <div className="pt-1 border-t border-[#f0f0f2]">
            <button
              onClick={loadOlder}
              className="text-[11px] text-[#007aff] hover:underline"
              disabled={olderLoading}
            >
              {olderLoading
                ? "読み込み中..."
                : showOlder
                  ? "▲ それより前を隠す"
                  : "▼ それより前を表示"}
            </button>
          </div>

          {showOlder && olderGroups.length > 0 && (
            <div className="flex flex-col gap-3 pt-1">
              {olderGroups.map((g) => (
                <MeetingGroupBlock
                  key={g.ym}
                  group={g}
                  onSelect={setSelectedMeeting}
                />
              ))}
            </div>
          )}

          {showOlder && olderLoaded && olderGroups.length === 0 && (
            <p className="text-[11px] text-[#86868b] pt-1">それより前の議事録データはありません</p>
          )}
        </div>
      )}

      <CockpitMeetingDetailModal
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
      <div className="text-[12px] font-medium text-[#86868b] mb-1.5">
        {formatYmLabel(group.ym)}
      </div>
      <div className="flex flex-col gap-1.5">
        {group.items.map((item) => (
          <MeetingRow
            key={item.meetingId}
            item={item}
            onClick={() => onSelect(item)}
          />
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
  const isDialogue = item.meetingId.startsWith("dialogue:") || item.sourceKinds === "dialogue";
  const sourceLink = item.sourceUrl || item.notionUrl;
  const sourceLabel = isDialogue
    ? null  // dialogue は外部ソースを持たないので原則 null
    : item.sourceUrl
      ? (item.sourceKinds || "source")
      : item.notionUrl
        ? "Notion"
        : null;

  return (
    <div className="group w-full border border-[#f0f0f2] rounded-lg hover:bg-[#fafafa] hover:border-[#d2d2d7] transition-colors flex items-start gap-2 px-3 py-2">
      <button
        onClick={onClick}
        className="text-left flex items-start gap-2 flex-1 min-w-0"
      >
        <span className="text-[11px] text-[#86868b] shrink-0 tabular-nums w-[64px] mt-0.5">
          {dateLabel}
        </span>
        {timeLabel && (
          <span className="text-[11px] text-[#86868b] shrink-0 tabular-nums w-[36px] mt-0.5">
            {timeLabel}
          </span>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-medium truncate flex items-center gap-1.5">
            {isDialogue && (
              <span className="text-[9px] px-1 py-px rounded bg-violet-50 border border-violet-200 text-violet-800 shrink-0">
                まさ×えいみ
              </span>
            )}
            <span className="truncate">{item.title}</span>
          </div>
          {item.summaryShort && (
            <p className="mt-0.5 text-[11px] text-[#3c3c43] line-clamp-2 leading-snug">
              {item.summaryShort}
            </p>
          )}
        </div>
      </button>
      <div className="flex flex-col items-end gap-1 shrink-0">
        {sourceLink && sourceLabel && (
          <a
            href={sourceLink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-[10px] text-[#007aff] hover:underline whitespace-nowrap"
            title={`元ソースを別タブで開く: ${sourceLink}`}
          >
            {sourceLabel} ↗
          </a>
        )}
      </div>
    </div>
  );
}
