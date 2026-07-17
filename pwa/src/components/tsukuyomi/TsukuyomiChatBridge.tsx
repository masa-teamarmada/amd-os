"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const TsukuyomiChatDrawer = dynamic(
  () => import("./TsukuyomiChatDrawer").then((mod) => mod.TsukuyomiChatDrawer),
  { ssr: false },
);

export function TsukuyomiChatBridge() {
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    function onOpenRequest(e: Event) {
      const ce = e as CustomEvent<{ message?: string }>;
      const msg = ce.detail?.message;
      if (typeof msg === "string" && msg.length > 0) {
        try {
          window.localStorage.setItem("tsukuyomi:pending-prefill", msg);
        } catch {
          /* ignore */
        }
      }
      setChatOpen(true);
    }

    window.addEventListener("tsukuyomi:open", onOpenRequest);
    return () => window.removeEventListener("tsukuyomi:open", onOpenRequest);
  }, []);

  return chatOpen ? <TsukuyomiChatDrawer onClose={() => setChatOpen(false)} /> : null;
}
