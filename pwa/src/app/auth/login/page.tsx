"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const REQUIRED_GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/gmail.readonly",
].join(" ");

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(new URLSearchParams(window.location.search).get("error"));
  }, []);

  const handleLogin = async () => {
    const supabase = createClient();
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next") || "/dashboard";
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        scopes: REQUIRED_GOOGLE_SCOPES,
        queryParams: {
          hd: "team-armada.jp", // Restrict to Google Workspace domain
          access_type: "offline",
          prompt: "consent",
          include_granted_scopes: "true",
        },
      },
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            <span className="text-primary">◈</span> AMD OS
          </h1>
          <p className="text-sm text-muted-foreground">
            Team ARMADA Business Operating System
          </p>
        </div>
        {error === "calendar_required" && (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-left text-xs text-amber-800">
            Google Calendarの共有が必要。ログイン時の権限確認でCalendarをONにして続行して。
          </div>
        )}
        {error === "auth_failed" && (
          <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-left text-xs text-red-700">
            ログインに失敗。もう一度Google Workspaceでログインして。
          </div>
        )}
        <button
          onClick={handleLogin}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors w-full"
        >
          Google Workspace でログイン
        </button>
      </div>
    </div>
  );
}
