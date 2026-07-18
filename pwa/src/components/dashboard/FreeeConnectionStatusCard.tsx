"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Landmark,
  Unplug,
} from "lucide-react";

type ConnectionState = "connected" | "attention" | "unlinked";

type FreeeConnectionStatus = {
  ok: boolean;
  checkedAt: string;
  state: ConnectionState;
  plImportedAt: string | null;
  cashBalanceImportedAt: string | null;
};

const UNAVAILABLE: FreeeConnectionStatus = {
  ok: false,
  checkedAt: new Date(0).toISOString(),
  state: "attention",
  plImportedAt: null,
  cashBalanceImportedAt: null,
};

const STATE_META: Record<
  ConnectionState,
  { label: string; description: string; className: string; icon: typeof CheckCircle2 }
> = {
  connected: {
    label: "正常",
    description: "P/Lと口座残高の実績が24時間以内に更新されている。",
    className: "bg-emerald-50 text-emerald-700",
    icon: CheckCircle2,
  },
  attention: {
    label: "要確認",
    description: "P/Lまたは口座残高の更新証跡を確認できない。",
    className: "bg-amber-50 text-amber-800",
    icon: AlertTriangle,
  },
  unlinked: {
    label: "未連携",
    description: "freeeの認可情報が見つからない。",
    className: "bg-slate-100 text-slate-700",
    icon: Unplug,
  },
};

function timeLabel(value: string | null) {
  if (!value) return "更新記録なし";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "更新時刻を確認できない";
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  }).format(date);
}

/** 月次試算表に使うfreee実績の更新証跡を、dashboardで分けて確認する。 */
export function FreeeConnectionStatusCard() {
  const [data, setData] = useState<FreeeConnectionStatus | null>(null);
  const [noAccess, setNoAccess] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard/freee-connection-status")
      .then(async (response) => ({
        response,
        body: await response.json().catch(() => null),
      }))
      .then(({ response, body }) => {
        if (cancelled) return;
        if (response.status === 401 || response.status === 403) {
          setNoAccess(true);
          return;
        }
        setData(response.ok && body?.ok ? (body as FreeeConnectionStatus) : UNAVAILABLE);
      })
      .catch(() => {
        if (!cancelled) setData(UNAVAILABLE);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (noAccess) return null;
  if (!data)
    return <div className="h-28 animate-pulse rounded-lg border border-border bg-muted/20" />;

  const meta = STATE_META[data.state];
  const StateIcon = meta.icon;
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border/70 px-3 py-2.5">
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${meta.className}`}
        >
          <StateIcon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">freee連携</h2>
          <p className="text-[11px] text-muted-foreground">
            月次試算表に入る実績データの更新状態
          </p>
        </div>
        <Link
          href="/management-score"
          className="ml-auto inline-flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground hover:underline"
        >
          月次試算表 <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="grid grid-cols-1 divide-y divide-border/70 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(180px,0.8fr)] sm:divide-x sm:divide-y-0">
        <SyncEvidence label="P/L同期" value={data.plImportedAt} />
        <SyncEvidence label="口座残高同期" value={data.cashBalanceImportedAt} />
        <div className="flex min-w-0 items-center gap-2 px-3 py-2.5">
          <Landmark className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <div className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${meta.className}`}>
              {meta.label}
            </div>
            <p className="mt-1 text-[10px] leading-snug text-muted-foreground">{meta.description}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function SyncEvidence({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0 px-3 py-2.5">
      <div className="text-xs font-medium">{label}</div>
      <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
        <Clock3 className="h-3 w-3 shrink-0" />
        <span className="truncate">{timeLabel(value)}</span>
      </div>
    </div>
  );
}
