"use client";

import { useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useModalContainment } from "./useModalContainment";

export function ProjectContentModal({ title, subtitle, children, footer, onClose }: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useModalContainment({ dialogRef, initialFocusRef: closeRef, onClose });
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] grid place-items-center bg-[#1d1d1f]/45 p-3 sm:p-6" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
        className="flex max-h-[calc(100dvh-24px)] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-[#d2d2d7] bg-white text-[#1d1d1f] shadow-xl sm:max-h-[calc(100dvh-48px)]">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[#e5e5e7] px-4 py-3 sm:px-6 sm:py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="break-words text-lg font-semibold leading-7">{title}</h2>
            {subtitle && <p className="mt-1 text-sm text-[#6e6e73]">{subtitle}</p>}
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="閉じる"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-[#d2d2d7] hover:bg-[#f5f5f7] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007aff]">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain break-words px-4 py-4 sm:px-6 sm:py-6">{children}</div>
        {footer && <footer className="shrink-0 border-t border-[#e5e5e7] px-4 py-3 sm:px-6">{footer}</footer>}
      </section>
    </div>, document.body,
  );
}
