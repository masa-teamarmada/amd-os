"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type OpenRequestSummary = {
  count: number;
  latest: { ym: string; member_id: string } | null;
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
          if (active && payload?.ok) setSummary({ count: payload.count, latest: payload.latest });
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

  if (!summary?.count || !summary.latest) return null;
  const month = `${summary.latest.ym.slice(0, 4)}年${Number(summary.latest.ym.slice(4, 6))}月`;
  const href = `/admin/monthly-work-agreements?ym=${encodeURIComponent(summary.latest.ym)}${summary.count === 1 ? `&q=${encodeURIComponent(summary.latest.member_id)}` : ""}`;

  return (
    <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-950">
      <span className="font-semibold">月初合意の修正要望が未対応：{summary.count}件</span>
      <span>最新は{month}。内容と金額への影響を確認。</span>
      <Link href={href} className="font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-900">
        修正要望を確認
      </Link>
    </div>
  );
}
