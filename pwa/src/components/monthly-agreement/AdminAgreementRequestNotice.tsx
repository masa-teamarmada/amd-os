"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type OpenRequestSummary = {
  count: number;
  months: Array<{ ym: string; count: number; memberId: string | null }>;
};

export function AdminAgreementRequestNotice({ pathname }: { pathname: string }) {
  const [summary, setSummary] = useState<OpenRequestSummary | null>(null);

  useEffect(() => {
    let active = true;
    const load = () => {
      if (document.hidden) return;
      fetch("/api/admin/monthly-work-agreements/open-requests", { cache: "no-store" })
        .then((response) => response.ok ? response.json() : null)
        .then((payload) => {
          if (active && payload?.ok) setSummary({ count: payload.count, months: payload.months });
        })
        .catch(() => {});
    };
    load();
    window.addEventListener("focus", load);
    window.addEventListener("monthly-agreement-request-updated", load);
    return () => {
      active = false;
      window.removeEventListener("focus", load);
      window.removeEventListener("monthly-agreement-request-updated", load);
    };
  }, [pathname]);

  if (!summary?.count || !summary.months?.length) return null;

  return (
    <div role="status" aria-live="polite" className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-950">
      <span className="font-semibold">月初合意の修正要望が未対応：{summary.count}件</span>
      <span>対象月：</span>
      {summary.months.map((month) => (
        <Link
          key={month.ym}
          href={`/admin/monthly-work-agreements?ym=${encodeURIComponent(month.ym)}${month.memberId ? `&q=${encodeURIComponent(month.memberId)}` : ""}`}
          className="font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-900"
        >
          {month.ym.slice(0, 4)}年{Number(month.ym.slice(4, 6))}月 {month.count}件
        </Link>
      ))}
    </div>
  );
}
