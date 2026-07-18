"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const PORTFOLIO_GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/gmail.readonly",
].join(" ");

const PROJECT_GOOGLE_SCOPES = ["openid", "email", "profile"].join(" ");

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<"portfolio" | "project" | null>(null);

  useEffect(() => {
    // Query string is a browser-owned OAuth return value; initialize it after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError(new URLSearchParams(window.location.search).get("error"));
  }, []);

  const handleLogin = async (loginScope: "portfolio" | "project") => {
    setSubmitting(loginScope);
    const supabase = createClient();
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next") || "/";
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}&login_scope=${loginScope}`,
        scopes: loginScope === "portfolio" ? PORTFOLIO_GOOGLE_SCOPES : PROJECT_GOOGLE_SCOPES,
        queryParams: loginScope === "portfolio"
          ? {
              hd: "team-armada.jp",
              access_type: "offline",
              prompt: "consent",
              include_granted_scopes: "true",
            }
          : {
              prompt: "select_account",
            },
      },
    });
    if (signInError) {
      setError("auth_failed");
      setSubmitting(null);
    }
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
        {error === "domain_not_allowed" && (
          <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-left text-xs text-red-700">
            AMDメンバー用ログインは team-armada.jp のアカウントだけ使えるよ。
          </div>
        )}
        {error === "member_not_registered" && (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-left text-xs text-amber-800">
            このGoogleアカウントはまだAMD OSに登録されてないよ。PJ管理者に招待を頼んでね。
          </div>
        )}
        {error === "project_membership_required" && (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-left text-xs text-amber-800">
            PJ限定アカウントに有効なPJ参加設定がないよ。管理者側の設定を確認してね。
          </div>
        )}
        <div className="space-y-3">
          <button
            onClick={() => handleLogin("portfolio")}
            disabled={submitting !== null}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {submitting === "portfolio" ? "接続中…" : "AMDメンバーとしてログイン"}
          </button>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            PJメンバーはこちら
            <span className="h-px flex-1 bg-border" />
          </div>
          <button
            onClick={() => handleLogin("project")}
            disabled={submitting !== null}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-border bg-background px-6 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            {submitting === "project" ? "接続中…" : "参加PJだけを見る"}
          </button>
          <p className="text-left text-[11px] leading-relaxed text-muted-foreground">
            PJ限定ログインでは、招待されたPJの共有ダッシュボードだけが表示されるよ。
          </p>
        </div>
      </div>
    </div>
  );
}
