"use client";

/**
 * コックピット「Slack」タブ。
 *
 * Slackと同じ読み方ができることを狙う: チャンネルを選び、上が古く下が新しい
 * 時系列で、日付で区切って、同じ人の連続発言はまとめる。
 * SolvioraX のようなフリープランのワークスペースは90日で履歴が消えるため、
 * その後はここが唯一の読み場所になる。
 *
 * 読み込みは必ず lib/slack/slack-messages-client.ts (参照系キャッシュ) 経由。
 */

import { useEffect, useMemo, useState } from "react";
import { loadSlackMessages, peekSlackMessages } from "@/lib/slack/slack-messages-client";
import type { SlackMessageItem, SlackMessagesResult } from "@/lib/slack/slack-messages-types";

interface Props {
  projectId: string;
}

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];
const ALL_CHANNELS = "__all__";

function ymLabel(ym: string) {
  if (!/^\d{6}$/.test(ym)) return ym;
  return `${ym.slice(0, 4)}年${Number(ym.slice(4, 6))}月`;
}

function jstOf(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getTime() + 9 * 60 * 60 * 1000);
}

function dayKey(iso: string) {
  const jst = jstOf(iso);
  if (!jst) return "";
  return `${jst.getUTCFullYear()}-${String(jst.getUTCMonth() + 1).padStart(2, "0")}-${String(jst.getUTCDate()).padStart(2, "0")}`;
}

function dayLabel(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  if (!y) return key;
  const date = new Date(Date.UTC(y, m - 1, d));
  return `${y}年${m}月${d}日（${WEEKDAYS[date.getUTCDay()]}）`;
}

function timeLabel(iso: string) {
  const jst = jstOf(iso);
  if (!jst) return "";
  return `${String(jst.getUTCHours()).padStart(2, "0")}:${String(jst.getUTCMinutes()).padStart(2, "0")}`;
}

/** Slackのts (epoch秒) から時刻。親と日が違う返信には日付も付ける。 */
function replyTimeLabel(ts: string, parentIso: string) {
  const seconds = Number.parseFloat(String(ts || ""));
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  const jst = new Date(seconds * 1000 + 9 * 60 * 60 * 1000);
  const hhmm = `${String(jst.getUTCHours()).padStart(2, "0")}:${String(jst.getUTCMinutes()).padStart(2, "0")}`;
  const parent = jstOf(parentIso);
  const sameDay =
    !!parent &&
    parent.getUTCFullYear() === jst.getUTCFullYear() &&
    parent.getUTCMonth() === jst.getUTCMonth() &&
    parent.getUTCDate() === jst.getUTCDate();
  return sameDay ? hhmm : `${jst.getUTCMonth() + 1}/${jst.getUTCDate()} ${hhmm}`;
}

function collectedLabel(iso: string | null) {
  const jst = iso ? jstOf(iso) : null;
  if (!jst) return null;
  return `${jst.getUTCMonth() + 1}/${jst.getUTCDate()} ${String(jst.getUTCHours()).padStart(2, "0")}:${String(jst.getUTCMinutes()).padStart(2, "0")}`;
}

/**
 * Slackの絵文字コードを絵文字へ。よく使うものだけ持ち、知らないコードは
 * `:name:` のまま残す (ワークスペース独自の絵文字もあるため)。
 */
const EMOJI: Record<string, string> = {
  smile: "\u{1F604}", smiley: "\u{1F603}", grinning: "\u{1F600}", blush: "\u{1F60A}",
  wink: "\u{1F609}", laughing: "\u{1F606}", joy: "\u{1F602}", sweat_smile: "\u{1F605}",
  thinking_face: "\u{1F914}", cry: "\u{1F622}", sob: "\u{1F62D}", sunglasses: "\u{1F60E}",
  pray: "\u{1F64F}", bow: "\u{1F647}", raised_hands: "\u{1F64C}", clap: "\u{1F44F}",
  "+1": "\u{1F44D}", thumbsup: "\u{1F44D}", "-1": "\u{1F44E}", thumbsdown: "\u{1F44E}",
  ok_hand: "\u{1F44C}", muscle: "\u{1F4AA}", point_up: "\u{261D}\u{FE0F}", wave: "\u{1F44B}",
  eyes: "\u{1F440}", tada: "\u{1F389}", confetti_ball: "\u{1F38A}", sparkles: "\u{2728}",
  fire: "\u{1F525}", rocket: "\u{1F680}", star: "\u{2B50}", heart: "\u{2764}\u{FE0F}",
  white_check_mark: "\u{2705}", heavy_check_mark: "\u{2714}\u{FE0F}", x: "\u{274C}",
  warning: "\u{26A0}\u{FE0F}", bulb: "\u{1F4A1}", memo: "\u{1F4DD}", pencil: "\u{270F}\u{FE0F}",
  bow_and_arrow: "\u{1F3F9}", mag: "\u{1F50D}", chart_with_upwards_trend: "\u{1F4C8}",
  calendar: "\u{1F4C5}", clock3: "\u{1F553}", hourglass: "\u{231B}", bell: "\u{1F514}",
  mail: "\u{2709}\u{FE0F}", phone: "\u{1F4DE}", office: "\u{1F3E2}", handshake: "\u{1F91D}",
  moneybag: "\u{1F4B0}", yen: "\u{1F4B4}", books: "\u{1F4DA}", robot_face: "\u{1F916}",
  see_no_evil: "\u{1F648}", sweat: "\u{1F613}", sleepy: "\u{1F62A}", zzz: "\u{1F4A4}",
  100: "\u{1F4AF}", ok: "\u{1F197}", new: "\u{1F195}", sos: "\u{1F198}",
};

function withEmoji(text: string) {
  return text.replace(/:([a-z0-9_+-]+):/g, (match, name: string) => EMOJI[name] ?? match);
}

function speaker(item: { userName: string | null; user: string | null; isBot: boolean }) {
  if (item.userName) return item.userName;
  if (item.isBot) return "BOT";
  return item.user || "不明";
}

/** 名前の頭文字。Slackのアバター位置に置く。 */
function initial(name: string) {
  return name.replace(/^@/, "").slice(0, 1).toUpperCase();
}

function avatarColor(seed: string) {
  const palette = ["#4a6fa5", "#5c8a6b", "#a5734a", "#8a5c7d", "#4a8a8a", "#7d6ba5"];
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) % 997;
  return palette[hash % palette.length];
}

function isImage(mimetype: string | null) {
  return !!mimetype && mimetype.startsWith("image/");
}

function FileList({ files }: { files: SlackMessageItem["files"] }) {
  if (!files.length) return null;
  return (
    <ul className="mt-1.5 flex flex-col gap-1">
      {files.map((file, index) => {
        const label = file.name || "ファイル";
        const icon = isImage(file.mimetype) ? "🖼" : "📄";
        const body = (
          <span className="flex items-center gap-1.5 rounded-md border border-[#e5e5e7] bg-[#fafafa] px-2 py-1">
            <span aria-hidden>{icon}</span>
            <span className="truncate text-[11.5px] text-[#3c3c43]">{label}</span>
            {file.permalink && <span className="text-[10px] text-[#86868b]">Slackで開く ↗</span>}
          </span>
        );
        return (
          <li key={index} className="max-w-[420px]">
            {file.permalink ? (
              <a href={file.permalink} target="_blank" rel="noopener noreferrer" className="block hover:opacity-80">
                {body}
              </a>
            ) : (
              body
            )}
          </li>
        );
      })}
    </ul>
  );
}

function MessageRow({ item, grouped }: { item: SlackMessageItem; grouped: boolean }) {
  const [openReplies, setOpenReplies] = useState(false);
  const name = speaker(item);
  return (
    <div className={`group flex gap-2.5 px-2 ${grouped ? "py-0.5" : "pt-2 pb-0.5"} hover:bg-[#fafafa]`}>
      <div className="w-8 shrink-0 pt-0.5">
        {grouped ? (
          <span className="block text-right text-[10px] leading-5 text-transparent group-hover:text-[#c7c7cc]">
            {timeLabel(item.at)}
          </span>
        ) : (
          <span
            className="flex h-8 w-8 items-center justify-center rounded-md text-[12px] font-semibold text-white"
            style={{ backgroundColor: avatarColor(name) }}
            aria-hidden
          >
            {initial(name)}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        {!grouped && (
          <div className="flex items-baseline gap-2">
            <span className="text-[13px] font-semibold text-[#1d1d1f]">{name}</span>
            <span className="text-[11px] text-[#86868b]">{timeLabel(item.at)}</span>
            {item.permalink && (
              <a
                href={item.permalink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-[#007aff] opacity-0 transition-opacity hover:underline group-hover:opacity-100"
              >
                Slackで開く ↗
              </a>
            )}
          </div>
        )}
        {item.text ? (
          <p className="whitespace-pre-wrap break-words text-[13px] leading-[1.7] text-[#1d1d1f]">
            {withEmoji(item.text)}
          </p>
        ) : item.files.length === 0 ? (
          <p className="text-[12px] text-[#86868b]">（本文なし）</p>
        ) : null}
        <FileList files={item.files} />
        {item.replies.length > 0 && (
          <div className="mt-1">
            <button
              type="button"
              onClick={() => setOpenReplies((prev) => !prev)}
              className="text-[11.5px] font-medium text-[#007aff] hover:underline"
            >
              {openReplies ? "返信を閉じる" : `${item.replies.length}件の返信`}
            </button>
            {openReplies && (
              <div className="mt-1.5 flex flex-col gap-2 border-l-2 border-[#e5e5e7] pl-2.5">
                {item.replies.map((reply) => {
                  const replyName = speaker(reply);
                  return (
                    <div key={reply.ts} className="flex gap-2">
                      <span
                        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-semibold text-white"
                        style={{ backgroundColor: avatarColor(replyName) }}
                        aria-hidden
                      >
                        {initial(replyName)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-[12px] font-semibold text-[#1d1d1f]">{replyName}</span>
                          <span className="text-[10.5px] text-[#86868b]">{replyTimeLabel(reply.ts, item.at)}</span>
                        </div>
                        <p className="whitespace-pre-wrap break-words text-[12.5px] leading-[1.65] text-[#3c3c43]">
                          {withEmoji(reply.text)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="flex flex-col gap-3 px-2 py-2">
      {[0, 1, 2, 3].map((index) => (
        <div key={index} className="flex gap-2.5">
          <div className="h-8 w-8 shrink-0 rounded-md bg-[#f5f5f7]" />
          <div className="flex-1">
            <div className="mb-1.5 h-3 w-28 rounded bg-[#f5f5f7]" />
            <div className="mb-1 h-3 w-full rounded bg-[#f5f5f7]" />
            <div className="h-3 w-2/3 rounded bg-[#f5f5f7]" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CockpitSlackMessages({ projectId }: Props) {
  const [ym, setYm] = useState<string | undefined>(undefined);
  const [data, setData] = useState<SlackMessagesResult | undefined>(() => peekSlackMessages(projectId));
  const [loading, setLoading] = useState(!data);
  const [error, setError] = useState<string | null>(null);
  const [channelId, setChannelId] = useState<string>("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    const cached = peekSlackMessages(projectId, ym);
    if (cached) {
      setData(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }
    loadSlackMessages(projectId, ym)
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : "読み込みに失敗した");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, ym]);

  // Slackと同じく既定は1チャンネル。混ぜて読むと話が追えない。
  useEffect(() => {
    if (!data?.channels.length) return;
    setChannelId((current) => {
      if (current === ALL_CHANNELS) return current;
      if (current && data.channels.some((channel) => channel.channelId === current)) return current;
      return data.channels[0].channelId;
    });
  }, [data]);

  const filtered = useMemo(() => {
    const messages = data?.messages ?? [];
    // Slackと同じで、スレッド返信はチャンネルのタイムラインに出さず親の中だけで見せる。
    // ただし親がこの月に無い返信は、行き場が無くなるのでそのまま出す。
    const rootTs = new Set(
      messages.filter((item) => !item.threadTs || item.threadTs === item.ts).map((item) => item.ts),
    );
    const needle = query.trim().toLowerCase();
    const picked = messages.filter((item) => {
      if (item.threadTs && item.threadTs !== item.ts && rootTs.has(item.threadTs)) return false;
      if (channelId && channelId !== ALL_CHANNELS && item.channelId !== channelId) return false;
      if (!needle) return true;
      if (item.text.toLowerCase().includes(needle)) return true;
      if (speaker(item).toLowerCase().includes(needle)) return true;
      return item.replies.some((reply) => reply.text.toLowerCase().includes(needle));
    });
    // Slackと同じ並び: 上が古く、下が新しい
    return picked.slice().sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  }, [data, channelId, query]);

  const days = useMemo(() => {
    const map = new Map<string, SlackMessageItem[]>();
    for (const item of filtered) {
      const key = dayKey(item.at);
      const bucket = map.get(key) ?? [];
      bucket.push(item);
      map.set(key, bucket);
    }
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  }, [filtered]);

  const months = data?.months ?? [];
  const activeYm = data?.ym ?? ym ?? "";
  const collected = collectedLabel(data?.lastCollectedAt ?? null);
  const activeChannel = data?.channels.find((channel) => channel.channelId === channelId);

  return (
    <section className="bg-white rounded-xl border border-[#e5e5e7] px-4 py-3.5">
      <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[13px] font-medium">
          Slackの会話
          {activeChannel && <span className="ml-1.5 text-[12px] text-[#86868b]">#{activeChannel.channelName}</span>}
        </h3>
        <div className="flex items-center gap-2">
          {collected && <span className="text-[10px] text-[#86868b]">最終取り込み {collected}</span>}
          {months.length > 0 && (
            <select
              value={activeYm}
              onChange={(event) => setYm(event.target.value)}
              className="rounded border border-[#d2d2d7] bg-white px-2 py-0.5 text-[11px] text-[#3c3c43]"
            >
              {months.map((month) => (
                <option key={month} value={month}>
                  {ymLabel(month)}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {data && data.channels.length > 0 && (
        <div className="mb-2 flex flex-wrap items-center gap-1.5 border-b border-[#f0f0f2] pb-2">
          {data.channels.map((channel) => (
            <button
              key={channel.channelId}
              type="button"
              onClick={() => setChannelId(channel.channelId)}
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                channelId === channel.channelId
                  ? "bg-[#1d1d1f] text-white"
                  : "bg-[#f5f5f7] text-[#3c3c43] hover:bg-[#ececf0]"
              }`}
              title={channel.workspaceLabel ? `${channel.workspaceLabel}.slack.com` : undefined}
            >
              #{channel.channelName} {channel.count}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setChannelId(ALL_CHANNELS)}
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
              channelId === ALL_CHANNELS
                ? "bg-[#1d1d1f] text-white"
                : "bg-[#f5f5f7] text-[#3c3c43] hover:bg-[#ececf0]"
            }`}
          >
            まとめて見る
          </button>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="本文・発言者で絞り込む"
            className="ml-auto w-52 rounded border border-[#d2d2d7] px-2 py-0.5 text-[11px] text-[#1d1d1f] placeholder:text-[#c7c7cc]"
          />
        </div>
      )}

      {loading && !data && <Skeleton />}
      {error && <p className="text-[12px] text-[#d70015]">{error}</p>}

      {data && !loading && data.messages.length === 0 && (
        <p className="text-[12px] text-[#86868b]">
          この月に取り込んだ会話はありません。取り込む部屋はPJ設定で決まります。
        </p>
      )}

      {data && data.messages.length > 0 && filtered.length === 0 && (
        <p className="text-[12px] text-[#86868b]">絞り込み条件に合う会話がありません。</p>
      )}

      {days.length > 0 && (
        <div className="flex flex-col">
          {days.map(([key, items]) => (
            <div key={key} className="flex flex-col">
              <div className="sticky top-0 z-10 my-1.5 flex items-center gap-2 bg-white py-1">
                <span className="h-px flex-1 bg-[#f0f0f2]" />
                <span className="rounded-full border border-[#e5e5e7] px-2.5 py-0.5 text-[11px] font-medium text-[#3c3c43]">
                  {dayLabel(key)}
                </span>
                <span className="h-px flex-1 bg-[#f0f0f2]" />
              </div>
              {items.map((item, index) => {
                const previous = items[index - 1];
                // Slackと同じで、同じ人の続けての発言は名前を省く (5分以内)
                const sameSpeaker =
                  !!previous &&
                  speaker(previous) === speaker(item) &&
                  previous.channelId === item.channelId &&
                  new Date(item.at).getTime() - new Date(previous.at).getTime() < 5 * 60 * 1000;
                return <MessageRow key={item.itemId} item={item} grouped={sameSpeaker} />;
              })}
            </div>
          ))}
        </div>
      )}

      {data?.truncated && (
        <p className="mt-2 text-[11px] text-[#86868b]">件数が多いため一部だけ表示しています。</p>
      )}
    </section>
  );
}
