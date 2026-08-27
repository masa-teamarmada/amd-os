"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// pwa と違い Calendar / Gmail スコープは要求しない。支払通知書に不要なので。
const REQUIRED_GOOGLE_SCOPES = ["openid", "email", "profile"].join(" ");

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(new URLSearchParams(window.location.search).get("error"));
  }, []);

  const handleLogin = async () => {
    const supabase = createClient();
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next") || "/";
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        scopes: REQUIRED_GOOGLE_SCOPES,
        queryParams: {
          hd: "team-armada.jp",
        },
      },
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">◈ きよあどみ</h1>
          <p className="text-sm text-slate-500">Team ARMADA 管理業務</p>
        </div>
        {error === "domain_not_allowed" && (
          <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-left text-xs text-red-700">
            team-armada.jp のアカウントでログインして。
          </div>
        )}
        {error === "auth_failed" && (
          <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-left text-xs text-red-700">
            ログインに失敗。もう一度 Google Workspace でログインして。
          </div>
        )}
        <button
          onClick={handleLogin}
          className="w-full rounded-md bg-slate-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-700"
        >
          Google Workspace でログイン
        </button>
      </div>
    </div>
  );
}
