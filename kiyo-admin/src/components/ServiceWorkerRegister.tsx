"use client";

import { useEffect } from "react";

/** インストール可能にするためだけの service worker 登録。キャッシュはしない（public/sw.js 参照）。 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("[sw] register failed", err);
    });
  }, []);

  return null;
}
