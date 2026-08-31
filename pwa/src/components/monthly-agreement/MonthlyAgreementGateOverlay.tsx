"use client";

import { useCallback, useEffect, useState, type MouseEvent } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import type { MonthlyWorkAgreementBundle } from "@/lib/monthly-work-agreement-types";

const MonthlyAgreementExperience = dynamic(
  () => import("@/components/monthly-agreement/MonthlyAgreementExperience").then((mod) => mod.MonthlyAgreementExperience),
  { ssr: false },
);

type MonthlyAgreementGateOverlayProps = {
  bundle: MonthlyWorkAgreementBundle;
};

export function MonthlyAgreementGateOverlay({ bundle }: MonthlyAgreementGateOverlayProps) {
  const router = useRouter();
  const pathname = usePathname();
  const gateKey = `${pathname}:${bundle.ym}:${bundle.currentHash}`;
  const [closedGateKey, setClosedGateKey] = useState<string | null>(null);
  const open = closedGateKey !== gateKey;
  const close = useCallback(() => setClosedGateKey(gateKey), [gateKey]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  const onBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    close();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-3 backdrop-blur-[2px] sm:p-5 lg:p-8"
      role="dialog"
      aria-modal="true"
      aria-label="月初合意"
      onClick={onBackdropClick}
    >
      <div className="flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-[#d1d1d6] bg-[#f5f5f7] shadow-2xl">
        <MonthlyAgreementExperience
          mode="modal"
          initialBundle={bundle}
          onDismiss={close}
          onResolved={() => {
            close();
            router.refresh();
          }}
        />
      </div>
    </div>
  );
}
