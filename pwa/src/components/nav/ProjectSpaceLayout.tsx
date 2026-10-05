"use client";

import { useState, type ReactNode } from "react";
import { PanelLeft, X } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger, SheetClose } from "@/components/ui/sheet";

/** 3スペース共通の左ナビ。狭い画面でも本文を縮めず、左から開く。 */
export function ProjectSpaceLayout({ navigation, children }: { navigation?: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  if (!navigation) return <div className="min-w-0 space-y-3">{children}</div>;
  return (
    <div data-testid="project-space-layout" className="grid min-w-0 items-start gap-4 md:grid-cols-[208px_minmax(0,1fr)]">
      <aside aria-label="スペースメニュー" className="sticky top-3 hidden max-h-[calc(100dvh-24px)] min-w-0 space-y-4 overflow-y-auto border-r border-[#d2d2d7] pr-3 md:block">{navigation}</aside>
      <div className="min-w-0 space-y-3 md:col-start-2">
        <div className="md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger className="inline-flex min-h-11 items-center gap-2 rounded-md border border-[#d2d2d7] bg-white px-3 text-[13px] font-semibold text-[#374151] hover:bg-[#f5f5f7] focus-visible:outline-2 focus-visible:outline-[#027FDC]">
              <PanelLeft className="h-4 w-4" aria-hidden="true" />スペースメニュー
            </SheetTrigger>
            <SheetContent side="left" showCloseButton={false} style={{ width: "min(288px, calc(100vw - 32px))", maxWidth: "none" }} className="gap-0">
              <div className="flex min-h-14 items-center justify-between border-b border-[#d2d2d7] px-4">
                <SheetTitle>スペースメニュー</SheetTitle>
                <SheetClose aria-label="スペースメニューを閉じる" className="flex h-11 w-11 items-center justify-center rounded-md hover:bg-[#f5f5f7]"><X className="h-5 w-5" /></SheetClose>
              </div>
              <div className="min-h-0 space-y-4 overflow-y-auto p-4" onClick={(event) => {
                if ((event.target as HTMLElement).closest("a, [data-space-page]")) setOpen(false);
              }}>{navigation}</div>
            </SheetContent>
          </Sheet>
        </div>
        {children}
      </div>
    </div>
  );
}
