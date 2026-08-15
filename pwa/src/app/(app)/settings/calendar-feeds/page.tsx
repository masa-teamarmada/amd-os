"use client";

/**
 * 予定表の公開URL(ICS)の登録・確認画面。
 *
 * 委任同意(OAuth)は愛媛大テナントで弾かれたので、当面の入口はこちら
 * (2026-08-15判定 / EHM_OS_M365_VERDICT_20260815.md)。
 * URLは登録後は画面に出さない。知っていれば認証なしで相手の予定が読めるため。
 */

import { useCallback, useEffect, useState } from "react";

type FeedSource = {
  id: string;
  projectId: string;
  ownerLabel: string;
  urlFingerprint: string;
  provider: string;
  visibilityLevel: string;
  status: string;
  consentNote: string | null;
  lastFetchedAt: string | null;
  lastFetchStatus: string | null;
  lastEventCount: number | null;
};

type FeedEvent = {
  id: string;
  sourceId: string;
  summary: string;
  location: string | null;
  startsAt: string | null;
  endsAt: string | null;
  isAllDay: boolean;
  linkState: string;
};

const VISIBILITY_LABEL: Record<string, string> = {
  availability_only: "予定が入っている時間のみ",
  title_location: "タイトルと場所",
  full_details: "すべての詳細",
};

const STATUS_LABEL: Record<string, string> = {
  active: "取り込み中",
  paused: "一時停止",
  revoked: "停止",
};

function formatWhen(event: FeedEvent): string {
  if (!event.startsAt) return "日時未取得";
  const start = new Date(event.startsAt);
  const md = `${start.getMonth() + 1}/${start.getDate()}`;
  if (event.isAllDay) return `${md} 終日`;
  const hm = `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`;
  return `${md} ${hm}`;
}

export default function CalendarFeedsPage() {
  const [sources, setSources] = useState<FeedSource[]>([]);
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const [projectId, setProjectId] = useState("p30");
  const [ownerLabel, setOwnerLabel] = useState("");
  const [feedUrl, setFeedUrl] = useState("");
  const [visibility, setVisibility] = useState("title_location");
  const [consentNote, setConsentNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/calendar-feeds", { cache: "no-store" });
      const json = (await res.json()) as { sources?: FeedSource[]; events?: FeedEvent[]; error?: string };
      if (json.error) {
        setMessage({ kind: "error", text: json.error });
      } else {
        setSources(json.sources ?? []);
        setEvents(json.events ?? []);
      }
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : String(error) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const register = async () => {
    if (!feedUrl.trim() || !ownerLabel.trim()) {
      setMessage({ kind: "error", text: "提供者と公開URLは必須" });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/calendar-feeds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "register",
          project_id: projectId,
          owner_label: ownerLabel,
          feed_url: feedUrl,
          visibility_level: visibility,
          consent_note: consentNote || null,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string; sync?: { ok: boolean; eventCount: number; error: string | null } };
      if (!res.ok || json.error) {
        setMessage({ kind: "error", text: json.error || `登録に失敗した (HTTP ${res.status})` });
      } else if (json.sync && !json.sync.ok) {
        setMessage({ kind: "error", text: `登録はできたが取り込みに失敗した: ${json.sync.error ?? "原因不明"}` });
      } else {
        setMessage({ kind: "ok", text: `登録して取り込んだ。予定 ${json.sync?.eventCount ?? 0} 件` });
        setFeedUrl("");
        setOwnerLabel("");
        setConsentNote("");
      }
      await load();
    } finally {
      setBusy(false);
    }
  };

  const sync = async (sourceId: string) => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/calendar-feeds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync", source_id: sourceId }),
      });
      const json = (await res.json()) as { ok?: boolean; sync?: { eventCount: number; inserted: number; updated: number; disappeared: number; error: string | null } };
      if (json.ok && json.sync) {
        setMessage({
          kind: "ok",
          text: `取り込んだ。全${json.sync.eventCount}件 (新規${json.sync.inserted} / 更新${json.sync.updated} / 消えた${json.sync.disappeared})`,
        });
      } else {
        setMessage({ kind: "error", text: json.sync?.error || "取り込みに失敗した" });
      }
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8">
      <h1 className="text-xl font-bold">予定表の取り込み（公開URL）</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Outlookの「予定表を公開する」で発行したICSのURLを登録すると、AMD OSがその予定を読む。認証も管理者承認も要らない経路。
        愛媛大テナントでは委任同意（アプリへの許可）が管理者承認必須で弾かれるため、当面はこちらを使う。
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        読むのは件名・日時・場所だけ。公開範囲を「タイトルと場所」にすると本文はICSに含まれない。
        <strong className="text-foreground">登録後、URLは画面に出さない</strong>
        （URLを知っていれば誰でも認証なしで予定を読めるため）。提供者が「公開取り消し」を押せば即座に無効になる。
      </p>

      {message && (
        <div
          className={`mt-4 rounded-md border px-4 py-3 text-sm ${
            message.kind === "ok"
              ? "border-emerald-300 bg-emerald-50 text-emerald-900"
              : "border-rose-300 bg-rose-50 text-rose-900"
          }`}
        >
          {message.text}
        </div>
      )}

      <section className="mt-8 rounded-md border border-border bg-white p-4">
        <h2 className="text-base font-semibold">公開URLを登録する</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="text-muted-foreground">PJ</span>
            <input
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
              className="mt-1 w-full rounded-md border border-border px-3 py-2"
              placeholder="p30"
            />
          </label>
          <label className="text-sm">
            <span className="text-muted-foreground">提供者（誰の予定表か）</span>
            <input
              value={ownerLabel}
              onChange={(event) => setOwnerLabel(event.target.value)}
              className="mt-1 w-full rounded-md border border-border px-3 py-2"
              placeholder="石原先生"
            />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="text-muted-foreground">公開URL（ICS）</span>
            <input
              value={feedUrl}
              onChange={(event) => setFeedUrl(event.target.value)}
              className="mt-1 w-full rounded-md border border-border px-3 py-2 font-mono text-xs"
              placeholder="https://outlook.office365.com/owa/calendar/.../calendar.ics"
            />
          </label>
          <label className="text-sm">
            <span className="text-muted-foreground">公開範囲（相手がOutlookで選んだもの）</span>
            <select
              value={visibility}
              onChange={(event) => setVisibility(event.target.value)}
              className="mt-1 w-full rounded-md border border-border px-3 py-2"
            >
              <option value="title_location">タイトルと場所</option>
              <option value="availability_only">予定が入っている時間のみ</option>
              <option value="full_details">すべての詳細</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="text-muted-foreground">許諾の記録（誰がいつ同意したか）</span>
            <input
              value={consentNote}
              onChange={(event) => setConsentNote(event.target.value)}
              className="mt-1 w-full rounded-md border border-border px-3 py-2"
              placeholder="2026-08-15 本人がOutlookで発行"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={() => void register()}
          disabled={busy}
          className="mt-4 rounded-md border border-primary/40 bg-primary/5 px-4 py-2 text-sm text-primary hover:bg-primary/10 disabled:opacity-50"
        >
          登録して取り込む
        </button>
      </section>

      <section className="mt-8">
        <h2 className="text-base font-semibold">登録済み</h2>
        {loading ? (
          <p className="mt-3 text-sm text-muted-foreground">読み込み中…</p>
        ) : sources.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">まだ登録がない。</p>
        ) : (
          <div className="mt-3 space-y-3">
            {sources.map((source) => (
              <div key={source.id} className="rounded-md border border-border bg-white px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="font-semibold">{source.ownerLabel}</span>
                  <span className="text-xs text-muted-foreground">{source.projectId}</span>
                  <span className="text-xs rounded border border-border px-1.5 py-0.5">
                    {VISIBILITY_LABEL[source.visibilityLevel] || source.visibilityLevel}
                  </span>
                  <span className="text-xs rounded border border-border px-1.5 py-0.5">
                    {STATUS_LABEL[source.status] || source.status}
                  </span>
                  <span className="text-xs font-mono text-muted-foreground">URL {source.urlFingerprint}</span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  最終取り込み: {source.lastFetchedAt ? new Date(source.lastFetchedAt).toLocaleString("ja-JP") : "未実施"}
                  {" / "}
                  結果: {source.lastFetchStatus || "—"}
                  {" / "}
                  件数: {source.lastEventCount ?? "—"}
                </div>
                {source.consentNote && (
                  <div className="mt-1 text-xs text-muted-foreground">許諾: {source.consentNote}</div>
                )}
                <button
                  type="button"
                  onClick={() => void sync(source.id)}
                  disabled={busy}
                  className="mt-2 rounded-md border border-border bg-white px-3 py-1.5 text-xs hover:bg-muted/40 disabled:opacity-50"
                >
                  いま取り込む
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-base font-semibold">取り込んだ予定</h2>
        {events.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">まだ取り込んだ予定がない。</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">日時</th>
                  <th className="py-2 pr-3 font-medium">件名</th>
                  <th className="py-2 pr-3 font-medium">場所</th>
                  <th className="py-2 font-medium">業務との紐づけ</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id} className="border-b border-border/60 align-top">
                    <td className="py-2 pr-3 whitespace-nowrap tabular-nums">{formatWhen(event)}</td>
                    <td className="py-2 pr-3">{event.summary}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{event.location || "—"}</td>
                    <td className="py-2 text-muted-foreground">
                      {event.linkState === "unlinked" ? "未紐づけ" : event.linkState}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
