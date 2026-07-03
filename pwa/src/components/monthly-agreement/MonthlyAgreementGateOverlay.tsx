"use client";

import { useEffect, useState, type MouseEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { MonthlyAgreementExperience } from "@/components/monthly-agreement/MonthlyAgreementExperience";
import type { MonthlyWorkAgreementBundle } from "@/lib/monthly-work-agreement-types";

type MonthlyAgreementGateOverlayProps = {
  bundle: MonthlyWorkAgreementBundle;
};

export function MonthlyAgreementGateOverlay({ bundle }: MonthlyAgreementGateOverlayProps) {
  const router = useRouter();
  const pathname = usePathname();
  const gateKey = `${pathname}:${bundle.ym}:${bundle.currentHash}`;
  const [dismissedGateKey, setDismissedGateKey] = useState<string | null>(null);
  const open = dismissedGateKey !== gateKey;

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const onBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    setDismissedGateKey(gateKey);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] bg-black/45 p-2 backdrop-blur-[2px] sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label="月初合意"
      onClick={onBackdropClick}
    >
      <div className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden rounded-lg border border-[#d1d1d6] bg-[#f5f5f7] shadow-2xl">
        <MonthlyAgreementExperience
          mode="modal"
          initialBundle={bundle}
          onResolved={() => {
            setDismissedGateKey(gateKey);
            router.refresh();
          }}
        />
      </div>
    </div>
  );
}
