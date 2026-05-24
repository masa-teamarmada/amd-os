"use client";

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ProjectMeetingSummary } from "@/lib/supabase-data";
import { MarkdownView } from "./MarkdownView";

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

function isDialogueMeeting(meeting: ProjectMeetingSummary): boolean {
  return meeting.meetingId.startsWith("dialogue:") || meeting.sourceKinds === "dialogue";
}

export function CockpitMeetingDetailModal({ meeting, open, onOpenChange }: Props) {
  if (!meeting) return null;
  const dialogue = isDialogueMeeting(meeting);
  const sourceLink = meeting.sourceUrl || meeting.notionUrl;
  // dialogue 以外は元ソースを「Notion / Drive / Slack / Gmail / Calendar」と sourceKinds から推測
  const sourceLabel = dialogue
    ? null
    : meeting.sourceUrl
      ? (meeting.sourceKinds || "元ソース")
      : meeting.notionUrl
        ? "Notion"
        : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-[1100px] w-[92vw] max-h-[88vh] overflow-y-auto p-0">
        <header className="sticky top-0 z-10 border-b border-[#e5e5e7] bg-white/95 px-5 py-3 backdrop-blur">
          <div className="text-[11px] text-[#86868b] tabular-nums flex items-center gap-2 flex-wrap">
            <span>{formatHeaderDate(meeting.meetingDate, meeting.meetingStartAt)}</span>
            {dialogue ? (
              <span className="rounded bg-violet-50 border border-violet-200 px-1.5 py-0.5 text-[10px] text-violet-800">
                💬 まさ × えいみ 経営会議
              </span>
            ) : meeting.sourceKinds ? (
              <span className="rounded bg-[#f5f5f7] px-1.5 py-0.5 text-[10px] text-[#3c3c43]">{meeting.sourceKinds}</span>
            ) : null}
          </div>
          <DialogTitle className="mt-1 text-[15px] font-semibold leading-snug">{meeting.title}</DialogTitle>
          {sourceLink && sourceLabel && (
            <a
              href={sourceLink}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block text-[11px] text-[#007aff] hover:underline"
            >
              {sourceLabel} で開く ↗
            </a>
          )}
        </header>

        {dialogue ? (
          <DialogueMeetingBody meeting={meeting} />
        ) : (
          <RegularMeetingBody meeting={meeting} />
        )}
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// 通常の MTG (Notion / Drive / Slack / Gmail / Calendar 抽出)
// ============================================================

function RegularMeetingBody({ meeting }: { meeting: ProjectMeetingSummary }) {
  const hasTopics =
    meeting.decided.length > 0 ||
    meeting.progress.length > 0 ||
    meeting.nextActions.length > 0 ||
    meeting.risks.length > 0;

  return (
    <div className="px-5 py-4 space-y-6">
      {meeting.summaryShort && (
        <SummarySection emoji="📝" label="サマリ">
          <MarkdownView source={meeting.summaryShort} />
        </SummarySection>
      )}

      <TopicList emoji="✅" label="決まったこと" items={meeting.decided} accent="emerald" />
      <TopicList emoji="📈" label="進んだこと" items={meeting.progress} accent="blue" />
      <TopicList emoji="🎯" label="次やること" items={meeting.nextActions} accent="amber" />
      <TopicList emoji="⚠️" label="リスク" items={meeting.risks} accent="rose" />

      {!hasTopics && !meeting.summaryShort && (
        <p className="text-[12px] text-[#86868b]">
          {meeting.sourceKinds === "none" ? "議事録なし" : "議事録あり・抽出空 (本文薄い or LLM 失敗)"}
        </p>
      )}
    </div>
  );
}

// ============================================================
// dialogue MTG = まさ × えいみ 経営会議
//
// 「決まったこと」「進んだこと」のラベルだと、まさが 1 人で AI と決めたように
// 読めてチーム士気を下げる → 「2 人で話して出した提案 (チームへの相談)」と
// ニュアンスを変える。
// 初めて読んだ人でも背景 → 議論 → 提案 → 残課題 が分かるよう、各セクション頭に
// 1 行の説明を必ず置く構成 (#6 まさ確定 2026-05-23)。
// ============================================================

function DialogueMeetingBody({ meeting }: { meeting: ProjectMeetingSummary }) {
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
        <MarkdownView source={meeting.narrativeMd!} />
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
          <MarkdownView source={meeting.summaryShort} />
        ) : (
          <p className="text-[12px] text-[#86868b] italic">
            背景メモなし。まさ × えいみで議論した経緯やコンテキストはこのセッションで残されなかった。
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
        label="2人で出した提案（チームへの相談）"
        intro={
          "まさ × えいみで議論した結果として「こうしてはどうか」とチームに出す提案。" +
          "まさ1人で勝手に決めたわけではなく、チームで議論したうえで採否を判断する前提。"
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
              <MarkdownView source={it} />
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
                <MarkdownView source={it} />
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
