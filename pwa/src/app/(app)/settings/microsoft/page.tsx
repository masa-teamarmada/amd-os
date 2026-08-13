"use client";

/**
 * Microsoft 365 連携テスト画面。
 *
 * 目的: 石原先生のM365から進捗を取る前に、まさ自身のMicrosoftアカウントで
 * 「委任同意が通るか」「予定が読めるか」を本人が確かめる (まさ確定 2026-08-13)。
 * ここで得たいのは機能ではなく判定 — 大学テナントで同じことをしたときに
 * 管理者承認が要るかどうかの見立てを立てる材料。
 */

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type MsEvent = {
  id: string;
  subject: string;
  start: string | null;
  end: string | null;
  isAllDay: boolean;
  location: string | null;
  organizer: string | null;
  attendeeCount: number;
};

type CalendarResponse = {
  connected?: boolean;
  account?: { label: string | null; kind: string | null; authorizedAt: string | null; scopes: string[] };
  events?: MsEvent[];
  error?: string;
  detail?: string;
};

const ACCOUNT_KIND_LABEL: Record<string, string> = {
  personal: "個人用Microsoftアカウント",
  work_school: "職場・学校アカウント（Entra IDテナント）",
  unknown: "種別不明",
};

function formatRange(event: MsEvent): string {
  if (!event.start) return "日時未取得";
  const start = new Date(event.start);
  const startText = `${start.getMonth() + 1}/${start.getDate()} ${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`;
  if (event.isAllDay) return `${start.getMonth() + 1}/${start.getDate()} 終日`;
  if (!event.end) return startText;
  const end = new Date(event.end);
  return `${startText}〜${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`;
}

export default function MicrosoftSettingsPage() {
  const params = useSearchParams();
  const result = params.get("ms_result");
  const errorCode = params.get("ms_error");
  const errorDetail = params.get("ms_detail");

  const [data, setData] = useState<CalendarResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ms/calendar?days=28", { cache: "no-store" });
      setData((await res.json()) as CalendarResponse);
    } catch (error) {
      setData({ error: "fetch_failed", detail: error instanceof Error ? error.message : String(error) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const notConfigured = data?.error === "not_configured" || result === "not_configured";
  const connected = data?.connected === true;

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8">
      <h1 className="text-xl font-bold">Microsoft 365 連携テスト</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        自分のMicrosoftアカウントで、予定の読み取りが成立するかを確かめる面。ここで通れば、同じ手順を石原先生に1回だけお願いできる。
        パスワードはMicrosoftの画面で入力され、AMD側へは渡らない。読むのは予定の件名・日時・場所・主催者だけで、本文とメールは対象外。
      </p>

      {result === "connected" && (
        <div className="mt-4 rounded-md border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          連携できた。判定: このアカウントでは<strong>管理者承認なしでユーザー同意だけで通った</strong>。
        </div>
      )}
      {result === "denied" && (
        <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">同意が完了しなかった（{errorCode || "理由不明"}）</p>
          {errorDetail && <p className="mt-1 whitespace-pre-wrap break-words text-xs">{errorDetail}</p>}
          <p className="mt-2 text-xs">
            {errorCode === "consent_required" || errorCode === "admin_consent_required" || (errorDetail || "").includes("AADSTS65001") || (errorDetail || "").includes("admin")
              ? "テナント側がユーザー同意を制限している状態。大学で同じ結果が出たら、情報部門への申請が必要という判定になる。"
              : "拒否ボタンを押した場合もここに来る。もう一度試せる。"}
          </p>
        </div>
      )}
      {result === "token_failed" && (
        <div className="mt-4 rounded-md border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          <p className="font-semibold">トークン交換に失敗した</p>
          {errorDetail && <p className="mt-1 whitespace-pre-wrap break-words text-xs">{errorDetail}</p>}
        </div>
      )}

      {notConfigured ? (
        <div className="mt-6 rounded-md border border-border bg-muted/30 px-4 py-4 text-sm">
          <p className="font-semibold">まだアプリ登録が済んでいない</p>
          <p className="mt-2 text-muted-foreground">
            Microsoft側のアプリ登録（無料）と、その ID / シークレットの登録が要る。手順は
            <code className="mx-1 rounded bg-muted px-1">AMD/ehm-os/EHM_OS_M365_SETUP_GUIDE_20260814.md</code>
            にある。
          </p>
        </div>
      ) : (
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <a
            href="/api/ms/auth/start?next=/settings/microsoft"
            className="rounded-md border border-primary/40 bg-primary/5 px-4 py-2 text-sm text-primary hover:bg-primary/10"
          >
            {connected ? "連携をやり直す" : "Microsoftアカウントを連携する"}
          </a>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-md border border-border bg-white px-4 py-2 text-sm hover:bg-muted/40"
          >
            予定を読み直す
          </button>
        </div>
      )}

      {connected && data?.account && (
        <div className="mt-6 rounded-md border border-border bg-white px-4 py-3 text-sm">
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            <span>
              <span className="text-muted-foreground">アカウント</span> {data.account.label || "表示名なし"}
            </span>
            <span>
              <span className="text-muted-foreground">種別</span>{" "}
              {ACCOUNT_KIND_LABEL[data.account.kind || "unknown"] || "種別不明"}
            </span>
            <span>
              <span className="text-muted-foreground">許可した範囲</span> {data.account.scopes.join(" / ") || "未取得"}
            </span>
          </div>
          {data.account.kind === "personal" && (
            <p className="mt-2 text-xs text-muted-foreground">
              個人用アカウントでの成功は「実装が正しく動く」ことの証明にはなるが、大学テナントの同意制限を再現したことにはならない。
              大学側の可否は、石原先生に1回試してもらうまで確定しない。
            </p>
          )}
        </div>
      )}

      <section className="mt-8">
        <h2 className="text-base font-semibold">読み取れた予定（前後28日・最大50件）</h2>
        {loading ? (
          <p className="mt-3 text-sm text-muted-foreground">読み込み中…</p>
        ) : data?.error && !notConfigured ? (
          <div className="mt-3 rounded-md border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            <p className="font-semibold">読み取りに失敗した（{data.error}）</p>
            {data.detail && <p className="mt-1 whitespace-pre-wrap break-words text-xs">{data.detail}</p>}
          </div>
        ) : !connected ? (
          <p className="mt-3 text-sm text-muted-foreground">まだ連携していない。</p>
        ) : (data.events?.length ?? 0) === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            連携はできているが、この期間に予定がない。カレンダーに予定を1件入れて「予定を読み直す」を押すと確かめられる。
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">日時</th>
                  <th className="py-2 pr-3 font-medium">件名</th>
                  <th className="py-2 pr-3 font-medium">場所</th>
                  <th className="py-2 pr-3 font-medium">主催</th>
                  <th className="py-2 font-medium">出席</th>
                </tr>
              </thead>
              <tbody>
                {(data.events ?? []).map((event) => (
                  <tr key={event.id} className="border-b border-border/60 align-top">
                    <td className="py-2 pr-3 whitespace-nowrap tabular-nums">{formatRange(event)}</td>
                    <td className="py-2 pr-3">{event.subject}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{event.location || "—"}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{event.organizer || "—"}</td>
                    <td className="py-2 tabular-nums text-muted-foreground">{event.attendeeCount}</td>
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
