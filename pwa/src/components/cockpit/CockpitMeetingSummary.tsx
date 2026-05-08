"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchProjectMeetingSummaries, type ProjectMeetingSummary } from "@/lib/supabase-data";

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
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

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

  function toggleExpanded(meetingId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(meetingId)) next.delete(meetingId);
      else next.add(meetingId);
      return next;
    });
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
              expanded={expanded}
              onToggle={toggleExpanded}
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
                  expanded={expanded}
                  onToggle={toggleExpanded}
                />
              ))}
            </div>
          )}

          {showOlder && olderLoaded && olderGroups.length === 0 && (
            <p className="text-[11px] text-[#86868b] pt-1">それより前の議事録データはありません</p>
          )}
        </div>
      )}
    </section>
  );
}

interface GroupProps {
  group: MeetingGroup;
  expanded: Set<string>;
  onToggle: (meetingId: string) => void;
}

function MeetingGroupBlock({ group, expanded, onToggle }: GroupProps) {
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
            isOpen={expanded.has(item.meetingId)}
            onClick={() => onToggle(item.meetingId)}
          />
        ))}
      </div>
    </div>
  );
}

interface RowProps {
  item: ProjectMeetingSummary;
  isOpen: boolean;
  onClick: () => void;
}

function MeetingRow({ item, isOpen, onClick }: RowProps) {
  const dateLabel = formatDateLabel(item.meetingDate);
  const timeLabel = formatTimeLabel(item.meetingStartAt);
  const hasTopics =
    item.decided.length > 0 ||
    item.progress.length > 0 ||
    item.nextActions.length > 0 ||
    item.risks.length > 0;

  return (
    <div className="border border-[#f0f0f2] rounded-lg px-3 py-2 hover:bg-[#fafafa] transition-colors">
      <button
        onClick={onClick}
        className="w-full text-left flex items-start gap-2"
      >
        <span className="text-[11px] text-[#86868b] shrink-0 tabular-nums w-[64px]">
          {dateLabel}
        </span>
        {timeLabel && (
          <span className="text-[11px] text-[#86868b] shrink-0 tabular-nums w-[36px]">
            {timeLabel}
          </span>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-medium truncate">{item.title}</div>
          {item.summaryShort && !isOpen && (
            <p className="mt-0.5 text-[11px] text-[#3c3c43] line-clamp-2 leading-snug">
              {item.summaryShort}
            </p>
          )}
        </div>
        <span className={`text-[10px] text-[#86868b] shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`}>
          ▶
        </span>
      </button>

      {isOpen && (
        <div className="mt-2 border-t border-[#f0f0f2] pt-2 space-y-2">
          {item.summaryShort && (
            <p className="text-[12px] text-[#1d1d1f] leading-relaxed">
              📝 {item.summaryShort}
            </p>
          )}

          <TopicSection emoji="✅" label="決まったこと" items={item.decided} />
          <TopicSection emoji="📈" label="進んだこと" items={item.progress} />
          <TopicSection emoji="🎯" label="次やること" items={item.nextActions} />
          <TopicSection emoji="⚠️" label="リスク" items={item.risks} />

          {!hasTopics && !item.summaryShort && (
            <p className="text-[11px] text-[#86868b]">サマリ未生成</p>
          )}

          {item.notionUrl && (
            <div className="pt-1">
              <a
                href={item.notionUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-[#007aff] hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                Notion で開く ↗
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface TopicProps {
  emoji: string;
  label: string;
  items: string[];
}

function TopicSection({ emoji, label, items }: TopicProps) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <div className="text-[11px] font-medium text-[#3c3c43] mb-1">
        {emoji} {label}
      </div>
      <ul className="space-y-0.5 pl-4">
        {items.map((it, idx) => (
          <li key={idx} className="text-[11px] text-[#1d1d1f] leading-snug list-disc">
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}
