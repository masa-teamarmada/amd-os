"use client";

import type { ComponentProps } from "react";
import { CockpitMonthlyModal } from "../cockpit/CockpitMonthlyModal";

type Props = ComponentProps<typeof CockpitMonthlyModal>;

export function HudCockpitMonthlyModal(props: Props) {
  return (
    <>
      <CockpitMonthlyModal {...props} />
      <style jsx global>{`
        [data-slot="dialog-overlay"] {
          background: rgba(0, 8, 18, 0.74) !important;
          backdrop-filter: blur(12px);
        }
        [data-slot="dialog-content"] {
          background:
            radial-gradient(circle at 14% 0%, rgba(34, 211, 238, 0.18), transparent 34%),
            radial-gradient(circle at 88% 12%, rgba(244, 114, 182, 0.12), transparent 30%),
            linear-gradient(rgba(34, 211, 238, 0.075) 1px, transparent 1px),
            linear-gradient(90deg, rgba(34, 211, 238, 0.055) 1px, transparent 1px),
            #020817 !important;
          background-size: 100% 100%, 100% 100%, 34px 34px, 34px 34px, auto !important;
          color: rgba(236, 254, 255, 0.94) !important;
          border: 1px solid rgba(103, 232, 249, 0.42) !important;
          border-radius: 0 !important;
          box-shadow:
            0 0 44px rgba(34, 211, 238, 0.24),
            inset 0 0 42px rgba(34, 211, 238, 0.09) !important;
          font-family: var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, monospace !important;
        }
        [data-slot="dialog-content"]::before,
        [data-slot="dialog-content"]::after {
          content: "";
          position: absolute;
          pointer-events: none;
          z-index: 1;
        }
        [data-slot="dialog-content"]::before {
          inset: 7px;
          border: 1px solid rgba(103, 232, 249, 0.26);
          clip-path: polygon(0 18px, 18px 0, calc(100% - 18px) 0, 100% 18px, 100% calc(100% - 18px), calc(100% - 18px) 100%, 18px 100%, 0 calc(100% - 18px));
        }
        [data-slot="dialog-content"]::after {
          inset: 0;
          background: linear-gradient(180deg, rgba(103, 232, 249, 0.14), transparent 18%, transparent 84%, rgba(103, 232, 249, 0.10));
          mix-blend-mode: screen;
          opacity: 0.72;
        }
        [data-slot="dialog-content"] .bg-white,
        [data-slot="dialog-content"] [class*="bg-white"],
        [data-slot="dialog-content"] [class*="bg-muted"],
        [data-slot="dialog-content"] [class*="bg-background"],
        [data-slot="dialog-content"] [class*="bg-popover"] {
          background-color: rgba(2, 8, 23, 0.78) !important;
        }
        [data-slot="dialog-content"] [class*="bg-amber-50"] {
          background-color: rgba(120, 53, 15, 0.20) !important;
        }
        [data-slot="dialog-content"] [class*="bg-blue-50"],
        [data-slot="dialog-content"] [class*="bg-cyan-50"] {
          background-color: rgba(8, 47, 73, 0.34) !important;
        }
        [data-slot="dialog-content"] [class*="bg-emerald-50"],
        [data-slot="dialog-content"] [class*="bg-green-50"] {
          background-color: rgba(6, 78, 59, 0.24) !important;
        }
        [data-slot="dialog-content"] [class*="bg-red-50"],
        [data-slot="dialog-content"] [class*="bg-rose-50"] {
          background-color: rgba(127, 29, 29, 0.22) !important;
        }
        [data-slot="dialog-content"] [class*="border"],
        [data-slot="dialog-content"] table,
        [data-slot="dialog-content"] tr,
        [data-slot="dialog-content"] td,
        [data-slot="dialog-content"] th {
          border-color: rgba(103, 232, 249, 0.24) !important;
        }
        [data-slot="dialog-content"] .text-muted-foreground,
        [data-slot="dialog-content"] [class*="text-muted"],
        [data-slot="dialog-content"] [class*="text-slate"],
        [data-slot="dialog-content"] [class*="text-[#86868b]"],
        [data-slot="dialog-content"] [class*="text-neutral"] {
          color: rgba(186, 230, 253, 0.68) !important;
        }
        [data-slot="dialog-content"] h1,
        [data-slot="dialog-content"] h2,
        [data-slot="dialog-content"] h3,
        [data-slot="dialog-content"] strong,
        [data-slot="dialog-content"] [class*="font-semibold"],
        [data-slot="dialog-content"] [class*="font-bold"] {
          color: rgba(236, 254, 255, 0.98) !important;
          text-shadow: 0 0 12px rgba(103, 232, 249, 0.34);
        }
        [data-slot="dialog-content"] input,
        [data-slot="dialog-content"] textarea,
        [data-slot="dialog-content"] select {
          background: rgba(2, 8, 23, 0.84) !important;
          color: rgba(236, 254, 255, 0.94) !important;
          border-color: rgba(103, 232, 249, 0.34) !important;
        }
        [data-slot="dialog-content"] button {
          border-radius: 0 !important;
        }
      `}</style>
    </>
  );
}
