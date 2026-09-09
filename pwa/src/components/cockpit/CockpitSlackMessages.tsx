"use client";

/**
 * コックピット「Slack」タブ。
 *
 * 毎朝の取り込みが貯めたSlackの会話を、そのまま読める形で並べる。
 * SolvioraX のようなフリープランのワークスペースは90日で履歴が消えるため、
 * その後はここが唯一の読み場所になる。
 *
 * 読み込みは必ず lib/slack/slack-messages-client.ts (参照系キャッシュ) 経由。
 */

import { useEffect, useMemo, useState } from "react";
import {
  loadSlackMessages,
  peekSlackMessages,
} from "@/lib/slack/slack-messages-client";
import type { SlackMessageItem, SlackMessagesResult } from "@/lib/slack/slack-messages-types";

interface Props {
  projectId: string;
}

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

function ymLabel(ym: string) {
  if (!/^\d{6}$/.test(ym)) return ym;
  return `${ym.slice(0, 4)}年${Number(ym.slice(4, 6))}月`;
}

function jstDate(iso: string) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dayKey(iso: string) {
  const date = jstDate(iso);
  if (!date) return "";
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return `${jst.getUTCFullYear()}-${String(jst.getUTCMonth() + 1).padStart(2, "0")}-${String(jst.getUTCDate()).padStart(2, "0")}`;
}

function dayLabel(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  if (!y) return key;
  const date = new Date(Date.UTC(y, m - 1, d));
  return `${m}月${d}日（${WEEKDAYS[date.getUTCDay()]}）`;
}

function timeLabel(iso: string) {
  const date = jstDate(iso);
  if (!date) return "";
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return `${String(jst.getUTCHours()).padStart(2, "0")}:${String(jst.getUTCMinutes()).padStart(2, "0")}`;
}

function collectedLabel(iso: string | null) {
  const date = iso ? jstDate(iso) : null;
  if (!date) return null;
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return `${jst.getUTCMonth() + 1}/${jst.getUTCDate()} ${String(jst.getUTCHours()).padStart(2, "0")}:${String(jst.getUTCMinutes()).padStart(2, "0")}`;
}

function speaker(item: { userName: string | null; user: string | null; isBot: boolean }) {
  if (item.userName) return item.userName;
  if (item.isBot) return "BOT";
  return item.user || "不明";
}

function MessageBody({ text }: { text: string }) {
  if (!text) return <p className="text-[12px] text-[#86868b]">（本文なし）</p>;
  return <p className="whitespace-pre-wrap break-words text-[12.5px] leading-[1.65] text-[#1d1d1f]">{text}</p>;
}

function MessageCard({ item }: { item: SlackMessageItem }) {
  const [openReplies, setOpenReplies] = useState(false);
  return (
    <article className="rounded-lg border border-[#f0f0f2] bg-white px-3 py-2.5">
      <div className="mb-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-[12px] font-medium text-[#1d1d1f]">{speaker(item)}</span>
        <span className="text-[11px] text-[#86868b]">{timeLabel(item.at)}</span>
        <span className="rounded-full bg-[#f5f5f7] px-1.5 py-0.5 text-[10px] text-[#6e6e73]">#{item.channelName}</span>
        {item.permalink && (
          <a
            href={item.permalink}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-[11px] text-[#007aff] hover:underline"
          >
            Slackで開く ↗
          </a>
        )}
      </div>
      <MessageBody text={item.text} />
      {item.files.length > 0 && (
        <ul className="mt-1.5 flex flex-wrap gap-1.5">
          {item.files.map((file, index) => (
            <li key={index} className="text-[11px] text-[#6e6e73]">
              {file.permalink ? (
                <a href={file.permalink} target="_blank" rel="noopener noreferrer" className="text-[#007aff] hover:underline">
                  📎 {file.name || "ファイル"}
                </a>
              ) : (
                <span>📎 {file.name || "ファイル"}</span>
              )}
            </li>
          ))}
        </ul>
      )}
      {item.replies.length > 0 && (
        <div className="mt-2 border-t border-[#f5f5f7] pt-1.5">
          <button
            type="button"
            onClick={() => setOpenReplies((prev) => !prev)}
            className="text-[11px] text-[#007aff] hover:underline"
          >
            {openReplies ? "スレッドを閉じる" : `スレッド返信 ${item.replies.length}件を見る`}
          </button>
          {openReplies && (
            <div className="mt-1.5 flex flex-col gap-1.5 border-l-2 border-[#f0f0f2] pl-2.5">
              {item.replies.map((reply) => (
                <div key={reply.ts}>
                  <span className="mr-1.5 text-[11px] font-medium text-[#3c3c43]">{speaker(reply)}</span>
                  <span className="whitespace-pre-wrap break-words text-[12px] leading-[1.6] text-[#3c3c43]">{reply.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function Skeleton() {
  return (
    <div className="flex flex-col gap-2">
      {[0, 1, 2, 3].map((index) => (
        <div key={index} className="rounded-lg border border-[#f0f0f2] bg-white px-3 py-2.5">
          <div className="mb-2 h-3 w-32 rounded bg-[#f5f5f7]" />
          <div className="mb-1 h-3 w-full rounded bg-[#f5f5f7]" />
          <div className="h-3 w-2/3 rounded bg-[#f5f5f7]" />
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

  const filtered = useMemo(() => {
    const messages = data?.messages ?? [];
    const needle = query.trim().toLowerCase();
    return messages.filter((item) => {
      if (channelId && item.channelId !== channelId) return false;
      if (!needle) return true;
      if (item.text.toLowerCase().includes(needle)) return true;
      if (speaker(item).toLowerCase().includes(needle)) return true;
      return item.replies.some((reply) => reply.text.toLowerCase().includes(needle));
    });
  }, [data, channelId, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, SlackMessageItem[]>();
    for (const item of filtered) {
      const key = dayKey(item.at);
      const bucket = map.get(key) ?? [];
      bucket.push(item);
      map.set(key, bucket);
    }
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [filtered]);

  const months = data?.months ?? [];
  const activeYm = data?.ym ?? ym ?? "";
  const collected = collectedLabel(data?.lastCollectedAt ?? null);

  return (
    <section className="bg-white rounded-xl border border-[#e5e5e7] px-4 py-3.5">
      <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[13px] font-medium">Slackの会話</h3>
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
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setChannelId("")}
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
              channelId === "" ? "bg-[#1d1d1f] text-white" : "bg-[#f5f5f7] text-[#3c3c43] hover:bg-[#ececf0]"
            }`}
          >
            すべて {data.messages.length}
          </button>
          {data.channels.map((channel) => (
            <button
              key={channel.channelId}
              type="button"
              onClick={() => setChannelId(channel.channelId)}
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                channelId === channel.channelId
                  ? "bg-[#1d1d1f] text-white"
                  : "bg-[#f5f5f7] text-[#3c3c43] hover:bg-[#ececf0]"
              }`}
              title={channel.workspaceLabel ? `${channel.workspaceLabel}.slack.com` : undefined}
            >
              #{channel.channelName} {channel.count}
            </button>
          ))}
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
          この月に取り込んだ会話はありません。取り込み対象のチャンネルは管理画面のプロジェクト設定で決まります。
        </p>
      )}

      {data && data.messages.length > 0 && filtered.length === 0 && (
        <p className="text-[12px] text-[#86868b]">絞り込み条件に合う会話がありません。</p>
      )}

      {grouped.length > 0 && (
        <div className="flex flex-col gap-3">
          {grouped.map(([key, items]) => (
            <div key={key} className="flex flex-col gap-1.5">
              <div className="text-[11px] font-medium text-[#86868b]">{dayLabel(key)}</div>
              {items.map((item) => (
                <MessageCard key={item.itemId} item={item} />
              ))}
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
