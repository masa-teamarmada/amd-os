"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type ConnectorAuthNotification = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  meta: {
    connector?: string;
    reason?: string;
    reauth_url?: string;
    reauth_app_url?: string;
    reauth_install_url?: string;
  } | null;
  read_at: string | null;
  dismissed_at: string | null;
  created_at: string;
  updated_at: string;
};

export function ConnectorAuthRealtimeNotify() {
  const supabase = useMemo(() => createClient(), []);
  const [item, setItem] = useState<ConnectorAuthNotification | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported"
  );
  const seenRef = useRef(new Set<string>());

  const openReauth = useCallback(async (n: ConnectorAuthNotification) => {
    await supabase
      .from("app_notifications")
      .update({ read_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", n.id);

    const url = reauthUrl(n) || n.link || "/notifications";
    if (url.startsWith("http://") || url.startsWith("https://")) {
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      window.location.href = url;
    }
    setItem(null);
  }, [supabase]);

  useEffect(() => {
    let cancelled = false;

    const show = (next: ConnectorAuthNotification) => {
      if (next.kind !== "connector_auth" || next.read_at || next.dismissed_at) return;
      const key = `${next.id}:${next.updated_at}`;
      if (seenRef.current.has(key)) return;
      seenRef.current.add(key);
      setItem(next);
      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        const notification = new Notification(next.title, {
          body: compactBody(next),
          tag: `connector-auth-${next.id}`,
          requireInteraction: true,
        });
        notification.onclick = () => {
          window.focus();
          openReauth(next);
          notification.close();
        };
      }
    };

    const loadLatest = async () => {
      const { data } = await supabase
        .from("app_notifications")
        .select("id,kind,title,body,link,meta,read_at,dismissed_at,created_at,updated_at")
        .eq("kind", "connector_auth")
        .is("read_at", null)
        .is("dismissed_at", null)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled && data) show(data as ConnectorAuthNotification);
    };

    loadLatest();
    const interval = window.setInterval(loadLatest, 10_000);
    const channel = supabase
      .channel("connector-auth-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "app_notifications", filter: "kind=eq.connector_auth" },
        (payload) => show(payload.new as ConnectorAuthNotification)
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "app_notifications", filter: "kind=eq.connector_auth" },
        (payload) => show(payload.new as ConnectorAuthNotification)
      )
      .subscribe();

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [openReauth, supabase]);

  if (!item) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[90] w-[min(360px,calc(100vw-2rem))] rounded-[8px] border border-red-300 bg-white p-3 text-sm shadow-xl">
      <div className="flex items-start gap-3">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-red-50 text-red-600">
          !
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-red-700">{item.title}</div>
          {item.body && (
            <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs text-muted-foreground">
              {item.body}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => openReauth(item)}
              className="rounded-[6px] bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
            >
              再認証を開く
            </button>
            {permission === "default" && (
              <button
                onClick={async () => {
                  const next = await Notification.requestPermission();
                  setPermission(next);
                }}
                className="rounded-[6px] border border-border px-3 py-1.5 text-xs hover:bg-muted"
              >
                ブラウザ通知を許可
              </button>
            )}
            <button
              onClick={() => setItem(null)}
              className="rounded-[6px] border border-border px-3 py-1.5 text-xs hover:bg-muted"
            >
              閉じる
            </button>
          </div>
        </div>
      </div>
    </div>
  );

}

function reauthUrl(n: ConnectorAuthNotification) {
  return n.meta?.reauth_url || n.meta?.reauth_install_url || n.meta?.reauth_app_url || "";
}

function compactBody(n: ConnectorAuthNotification) {
  const body = n.body || n.meta?.reason || "タップして再認証を開いてね。";
  return body.length > 180 ? `${body.slice(0, 177)}...` : body;
}
