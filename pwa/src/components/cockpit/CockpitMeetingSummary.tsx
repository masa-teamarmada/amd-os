"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { fetchProjectMeetingSummaries, type ProjectMeetingSummary } from "@/lib/supabase-data";
import {
  groupUpcomingMeetingsBySeries,
  isPrepMeeting,
  isTentativePrepMeeting,
  isUpcomingMeeting,
  type UpcomingMeetingSeries,
} from "@/lib/meeting-series";
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

export function CockpitMeetingSummary({ projectId }: Props) {
  const [recentItems, setRecentItems] = useState<ProjectMeetingSummary[]>([]);
  const [olderItems, setOlderItems] = useState<ProjectMeetingSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showOlder, setShowOlder] = useState(false);
  const [olderLoading, setOlderLoading] = useState(false);
  const [olderLoaded, setOlderLoaded] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<ProjectMeetingSummary | null>(null);

  const sinceDate = useMemo(() => todayMinus365IsoDate(), []);
  // /project/[id]/cockpit?meeting=<meeting_id> で開いた場合、対象 meeting の詳細モーダルを auto-open
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const deepLinkMeetingId = searchParams.get("meeting");
  // 一度 auto-open した meeting_id を記憶しておき、閉じた後の再 auto-open を防ぐ (#10 まさ 2026-05-24)
  const autoOpenedRef = useRef<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchProjectMeetingSummaries(projectId, { sinceDate })
      .then(setRecentItems)
      .finally(() => setLoading(false));
  }, [projectId, sinceDate]);

  async function reloadRecentMeetings() {
    setRefreshing(true);
    try {
      const next = await fetchProjectMeetingSummaries(projectId, { sinceDate });
      setRecentItems(next);
      setOlderLoaded(false);
      setOlderItems([]);
      setShowOlder(false);
      const selectedId = selectedMeeting?.meetingId;
      if (selectedId) {
        const updated = next.find((item) => item.meetingId === selectedId);
        if (updated) setSelectedMeeting(updated);
      }
    } finally {
      setRefreshing(false);
    }
  }

  // recent items 取得後に deep link meeting を auto-open (= 同じ meeting_id に対しては 1 回だけ)
  useEffect(() => {
    if (!deepLinkMeetingId || loading || selectedMeeting) return;
    // 一度 auto-open 済みなら、閉じた後の再 open はしない (#10)
    if (autoOpenedRef.current === deepLinkMeetingId) return;
    const hit = recentItems.find((m) => m.meetingId === deepLinkMeetingId);
    if (hit) {
      autoOpenedRef.current = deepLinkMeetingId;
      setSelectedMeeting(hit);
      return;
    }
    // recent に無ければ older を読み込む
    if (!olderLoaded && !olderLoading) {
      setOlderLoading(true);
      fetchProjectMeetingSummaries(projectId, {}).then((all) => {
        setOlderItems(all.filter((i) => i.meetingDate < sinceDate));
        setOlderLoaded(true);
        setOlderLoading(false);
        const olderHit = all.find((m) => m.meetingId === deepLinkMeetingId);
        if (olderHit) {
          autoOpenedRef.current = deepLinkMeetingId;
          setSelectedMeeting(olderHit);
        }
      });
    } else if (olderLoaded) {
      const olderHit = olderItems.find((m) => m.meetingId === deepLinkMeetingId);
      if (olderHit) {
        autoOpenedRef.current = deepLinkMeetingId;
        setSelectedMeeting(olderHit);
      }
    }
  }, [deepLinkMeetingId, loading, recentItems, olderItems, olderLoaded, olderLoading, projectId, sinceDate, selectedMeeting]);

  function meetingUrl(meetingId: string): string {
    const params = new URLSearchParams(searchParams.toString());
    params.set("meeting", meetingId);
    // cockpit には月次系 modal も query で開く導線があるため、MTG詳細リンクでは単一 modal 状態に寄せる。
    params.delete("ym");
    params.delete("step");
    const next = params.toString();
    return next ? `${pathname}?${next}` : pathname;
  }

  function openSelectedMeeting(meeting: ProjectMeetingSummary) {
    // 手動 open も auto-open 済みとして記憶する。これをしないと、閉じた直後 (router.replace で
    // ?meeting= が消える前) に auto-open effect が再発火して同じ MTG を開き直す (#10 まさ 2026-05-29)
    autoOpenedRef.current = meeting.meetingId;
    setSelectedMeeting(meeting);
    router.replace(meetingUrl(meeting.meetingId), { scroll: false });
  }

  // モーダルを閉じる時の handler — URL の ?meeting= を消して、再 auto-open を防ぐ
  const closeSelectedMeeting = () => {
    setSelectedMeeting(null);
    if (deepLinkMeetingId) {
      // ?meeting= 以外のクエリは保持しつつ meeting だけ remove
      const params = new URLSearchParams(searchParams.toString());
      params.delete("meeting");
      const next = params.toString();
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    }
  };

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
  const prepRows = useMemo(
    () => [...recentItems, ...olderItems].filter(isPrepMeeting),
    [recentItems, olderItems]
  );
  const upcomingSeries = useMemo(
    () => groupUpcomingMeetingsBySeries(
      recentItems.filter((item) => isUpcomingMeeting(item) && item.meetingDate >= today)
    ),
    [recentItems, today]
  );
  const tentativeItems = useMemo(
    () => recentItems
      .filter(isTentativePrepMeeting)
      .sort((a, b) => {
        const ag = a.generatedAt || "";
        const bg = b.generatedAt || "";
        if (ag !== bg) return bg.localeCompare(ag);
        return b.meetingDate.localeCompare(a.meetingDate);
      }),
    [recentItems]
  );
  const pastRecentItems = useMemo(
    () => recentItems.filter((item) => !isPrepMeeting(item) && item.meetingDate <= today),
    [recentItems, today]
  );
  const recentGroups = useMemo(() => groupByYm(pastRecentItems), [pastRecentItems]);
  const olderGroups = useMemo(
    () => groupByYm(olderItems.filter((item) => !isPrepMeeting(item))),
    [olderItems]
  );

  function applyMeetingUpdate(updated: ProjectMeetingSummary) {
    setSelectedMeeting(updated);
    setRecentItems((items) => {
      const exists = items.some((item) => item.meetingId === updated.meetingId);
      const next = exists
        ? items.map((item) => item.meetingId === updated.meetingId ? updated : item)
        : [updated, ...items];
      return next.sort((a, b) => b.meetingDate.localeCompare(a.meetingDate));
    });
    setOlderItems((items) => items.map((item) => item.meetingId === updated.meetingId ? updated : item));
  }

  const selectedPrepMeeting = useMemo(() => {
    if (!selectedMeeting || isUpcomingMeeting(selectedMeeting)) return null;
    const eventId = selectedMeeting.calendarEventId || selectedMeeting.meetingId;
    if (!eventId) return null;
    return prepRows.find((item) => item.calendarEventId === eventId || item.meetingId === `upcoming:${eventId}`) ?? null;
  }, [prepRows, selectedMeeting]);

  return (
    <section className="bg-white rounded-xl border border-[#e5e5e7] px-4 py-3.5">
      <div className="mb-2.5 flex items-baseline justify-between gap-2">
        <h3 className="text-[13px] font-medium">MTGサマリ</h3>
        <div className="flex items-center gap-1.5">
          {(upcomingSeries.length > 0 || tentativeItems.length > 0) && (
            <>
            {upcomingSeries.length > 0 && (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                予定 {upcomingSeries.length}
              </span>
            )}
            {tentativeItems.length > 0 && (
              <span className="rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-[10px] font-medium text-stone-700">
                調整中 {tentativeItems.length}
              </span>
            )}
            </>
          )}
          <button
            type="button"
            onClick={reloadRecentMeetings}
            disabled={refreshing || loading}
            className="rounded border border-[#d2d2d7] bg-white px-2 py-0.5 text-[10px] font-medium text-[#3c3c43] hover:bg-[#f5f5f7] disabled:opacity-50"
          >
            {refreshing ? "再読込中" : "メモ再読込"}
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-[12px] text-[#86868b]">読み込み中...</p>
      ) : upcomingSeries.length === 0 && tentativeItems.length === 0 && pastRecentItems.length === 0 && !showOlder ? (
        <div className="space-y-2">
          <p className="text-[12px] text-[#86868b]">直近1年の議事録・予定MTGデータなし</p>
          <button
            onClick={loadOlder}
            className="text-[11px] text-[#007aff] hover:underline"
          >
            それより前を表示
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3 max-h-[480px] overflow-y-auto">
          {upcomingSeries.length > 0 && (
            <UpcomingMeetingBlock
              title="予定MTG / 準備中"
              helper="決めること・準備物"
              series={upcomingSeries}
              onSelect={openSelectedMeeting}
            />
          )}

          {tentativeItems.length > 0 && (
            <UpcomingMeetingBlock
              title="日程調整中MTG"
              helper="日程未定・仮置き"
              items={tentativeItems}
              onSelect={openSelectedMeeting}
              tone="tentative"
            />
          )}

          {recentGroups.map((g) => (
            <MeetingGroupBlock
              key={g.ym}
              group={g}
              onSelect={openSelectedMeeting}
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
                  onSelect={openSelectedMeeting}
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
        prepMeeting={selectedPrepMeeting}
        open={selectedMeeting !== null}
        onOpenChange={(open) => { if (!open) closeSelectedMeeting(); }}
        onMeetingUpdated={applyMeetingUpdate}
      />
    </section>
  );
}

interface UpcomingMeetingBlockProps {
  title: string;
  helper: string;
  series?: UpcomingMeetingSeries[];
  items?: ProjectMeetingSummary[];
  onSelect: (m: ProjectMeetingSummary) => void;
  tone?: "scheduled" | "tentative";
}

function UpcomingMeetingBlock({
  title,
  helper,
  series,
  items = [],
  onSelect,
  tone = "scheduled",
}: UpcomingMeetingBlockProps) {
  const blockClass = tone === "tentative"
    ? "rounded-lg border border-stone-200 bg-stone-50/75 px-2.5 py-2"
    : "rounded-lg border border-amber-200 bg-amber-50/45 px-2.5 py-2";
  const titleClass = tone === "tentative"
    ? "text-[12px] font-semibold text-stone-800"
    : "text-[12px] font-semibold text-amber-950";
  const helperClass = tone === "tentative"
    ? "text-[10px] text-stone-600"
    : "text-[10px] text-amber-800";

  return (
    <div className={blockClass}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className={titleClass}>{title}</div>
        <div className={helperClass}>{helper}</div>
      </div>
      <div className="flex flex-col gap-1.5">
        {series?.map((group) => (
          <MeetingRow
            key={group.key}
            item={group.next}
            series={group}
            onClick={() => onSelect(group.next)}
          />
        ))}
        {!series && items.map((item) => (
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
  series?: UpcomingMeetingSeries;
}

function MeetingRow({ item, onClick, series }: RowProps) {
  const isDialogue = item.meetingId.startsWith("dialogue:") || item.sourceKinds === "dialogue";
  const isUpcoming = isUpcomingMeeting(item);
  const isPrep = isPrepMeeting(item);
  const isTentativePrep = isTentativePrepMeeting(item);
  const dateLabel = isTentativePrep ? "未定" : formatDateLabel(item.meetingDate);
  const timeLabel = isTentativePrep ? "" : formatTimeLabel(item.meetingStartAt);
  const sourceLink = item.sourceUrl || item.notionUrl;
  const sourceLabel = isUpcoming
    ? "Calendar"
    : isDialogue
    ? null  // dialogue は外部ソースを持たないので原則 null
    : item.sourceUrl
      ? (item.sourceKinds || "source")
      : item.notionUrl
        ? "Notion"
        : null;

  return (
    <div className={`group w-full rounded-lg border transition-colors flex items-start gap-2 px-3 py-2 ${
      isUpcoming
        ? "border-amber-200 bg-white hover:bg-amber-50 hover:border-amber-300"
        : isPrep
          ? "border-stone-200 bg-stone-50 hover:bg-stone-100 hover:border-stone-300"
        : "border-[#f0f0f2] hover:bg-[#fafafa] hover:border-[#d2d2d7]"
    }`}>
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
            {isUpcoming && (
              <span className="text-[9px] px-1 py-px rounded bg-amber-100 border border-amber-200 text-amber-800 shrink-0">
                {series?.kind === "series" ? "シリーズ" : "予定MTG"}
              </span>
            )}
            {!isUpcoming && isPrep && (
              <span className="text-[9px] px-1 py-px rounded bg-stone-100 border border-stone-200 text-stone-700 shrink-0">
                日程調整中
              </span>
            )}
            {isDialogue && (
              <span className="text-[9px] px-1 py-px rounded bg-violet-50 border border-violet-200 text-violet-800 shrink-0">
                提案整理
              </span>
            )}
            <span className="truncate">{item.title}</span>
          </div>
          {item.summaryShort && (
            <p className="mt-0.5 text-[11px] text-[#3c3c43] line-clamp-2 leading-snug">
              {item.summaryShort}
            </p>
          )}
          {series?.kind === "series" && series.hiddenCount > 0 && (
            <p className="mt-0.5 text-[10px] font-medium text-amber-800">
              同シリーズ +{series.hiddenCount}
            </p>
          )}
        </div>
      </button>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <NotionTranscriptCta meeting={item} compact />
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

function NotionTranscriptCta({
  meeting,
  compact = false,
}: {
  meeting: ProjectMeetingSummary;
  compact?: boolean;
}) {
  if (isDialogueMeetingId(meeting)) return null;

  if (meeting.notionUrl) {
    return (
      <a
        href={meeting.notionUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className={compact
          ? "text-[10px] font-medium text-emerald-700 hover:underline whitespace-nowrap"
          : "inline-flex items-center rounded border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-800 hover:bg-emerald-100"}
        title={`Notionメモを別タブで開く: ${meeting.notionUrl}`}
      >
        Notion文字起こし ↗
      </a>
    );
  }

  if (isUpcomingMeeting(meeting) && meeting.sourceUrl) {
    return (
      <a
        href={meeting.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className={compact
          ? "text-[10px] font-medium text-amber-800 hover:underline whitespace-nowrap"
          : "inline-flex items-center rounded border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-900 hover:bg-amber-100"}
        title={`Calendar予定を別タブで開く: ${meeting.sourceUrl}`}
      >
        Calendarから開始 ↗
      </a>
    );
  }

  return (
    <span
      className={compact
        ? "text-[10px] text-[#86868b] whitespace-nowrap"
        : "inline-flex items-center rounded border border-[#e5e5e7] bg-[#f5f5f7] px-2.5 py-1 text-[11px] text-[#86868b]"}
      title="project_meeting_summaries.notion_url が未連携"
    >
      Notion未連携
    </span>
  );
}

function isDialogueMeetingId(meeting: ProjectMeetingSummary): boolean {
  return meeting.meetingId.startsWith("dialogue:") || meeting.sourceKinds === "dialogue";
}
