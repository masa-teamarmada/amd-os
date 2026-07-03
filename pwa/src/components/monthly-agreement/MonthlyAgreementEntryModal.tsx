"use client";

import Link from "next/link";
import { useEffect, useRef, type KeyboardEvent } from "react";
import { AlertTriangle, ArrowRight, FileCheck2 } from "lucide-react";

export type MonthlyAgreementEntryGate = {
  ym: string;
  memberId: string;
  status: "pending" | "needs_reagreement";
  projectCount: number;
  expectedRewardYen: number;
  stockYen: number;
  href: string;
};

function formatYm(ym: string) {
  return `${ym.slice(0, 4)}年${Number(ym.slice(4, 6))}月`;
}

function formatYen(value: number) {
  return `¥${Math.round(value).toLocaleString()}`;
}

export function MonthlyAgreementEntryModal({
  gate,
}: {
  gate: MonthlyAgreementEntryGate | null;
}) {
  const modalRef = useRef<HTMLDivElement>(null);
  const actionRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!gate) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    modalRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [gate]);

  if (!gate) return null;

  const isUpdate = gate.status === "needs_reagreement";
  const title = isUpdate
    ? "今月の条件が更新されています"
    : "今月の遂行内容と予定報酬の確認が残っています";
  const keepFocusInModal = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;
    event.preventDefault();
    actionRef.current?.focus();
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 px-4 py-6 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="monthly-agreement-entry-title"
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        onKeyDown={keepFocusInModal}
        className="max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-xl border border-[#d6d6dc] bg-white p-5 text-[#1d1d1f] shadow-[0_24px_80px_rgba(0,0,0,0.24)] outline-none sm:p-6"
      >
        <div className="flex items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-full bg-sky-50 text-sky-700 ring-1 ring-sky-100">
            {isUpdate ? <AlertTriangle className="size-5" /> : <FileCheck2 className="size-5" />}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-[#86868b]">{formatYm(gate.ym)} 月初確認</p>
            <h2 id="monthly-agreement-entry-title" className="mt-1 text-[20px] font-semibold leading-tight">
              {title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#515154]">
              この確認が完了するまで、他画面の操作は一時停止します。開こうとした画面は背景に残ります。
            </p>
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="rounded-lg border border-[#e5e5e7] bg-[#f5f5f7] px-3 py-2">
            <dt className="text-[11px] font-medium text-[#6e6e73]">対象PJ</dt>
            <dd className="mt-1 text-base font-semibold">{gate.projectCount}件</dd>
          </div>
          <div className="rounded-lg border border-[#e5e5e7] bg-[#f5f5f7] px-3 py-2">
            <dt className="text-[11px] font-medium text-[#6e6e73]">予定報酬</dt>
            <dd className="mt-1 text-base font-semibold">{formatYen(gate.expectedRewardYen)}</dd>
          </div>
          <div className="rounded-lg border border-[#e5e5e7] bg-[#f5f5f7] px-3 py-2">
            <dt className="text-[11px] font-medium text-[#6e6e73]">未払い残</dt>
            <dd className="mt-1 text-base font-semibold">{formatYen(gate.stockYen)}</dd>
          </div>
        </dl>

        <Link
          ref={actionRef}
          href={gate.href}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#1d1d1f] px-4 py-3 text-sm font-semibold text-white transition hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007aff] focus-visible:ring-offset-2"
        >
          月初合意を確認する
          <ArrowRight className="size-4" />
        </Link>
        <p className="mt-3 text-center text-[12px] leading-relaxed text-[#6e6e73]">
          合意後は通常どおりOSを操作できます。
        </p>
      </div>
    </div>
  );
}
