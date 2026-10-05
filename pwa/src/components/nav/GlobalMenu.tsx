"use client";

import { useState, type ReactNode } from "react";
import { Ellipsis, X } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import styles from "./global-menu.module.css";

export function GlobalMenu({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <Sheet open={open} onOpenChange={setOpen}>
    <SheetTrigger aria-label="全体メニューを開く" title="全体メニュー" data-testid="global-menu-trigger" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-[#374151] hover:bg-[#e8edf3] focus-visible:outline-2 focus-visible:outline-[#027FDC] sm:h-9 sm:w-9">
      <Ellipsis className="h-5 w-5" aria-hidden="true" />
    </SheetTrigger>
    <SheetContent side="left" showCloseButton={false} style={{ width: "min(288px, calc(100vw - 32px))", maxWidth: "none" }} className="gap-0">
      <div className="flex min-h-14 shrink-0 items-center justify-between border-b border-[#d2d2d7] px-4">
        <SheetTitle>全体メニュー</SheetTitle>
        <SheetClose aria-label="全体メニューを閉じる" className="flex h-11 w-11 items-center justify-center rounded-md hover:bg-[#f5f5f7]"><X className="h-5 w-5" /></SheetClose>
      </div>
      <div data-global-menu className={`min-h-0 flex-1 ${styles.body}`} onClick={(event) => {
        if ((event.target as HTMLElement).closest("a")) setOpen(false);
      }}>{children}</div>
    </SheetContent>
  </Sheet>;
}
