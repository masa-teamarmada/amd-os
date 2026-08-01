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

type Audience = "armada" | "institution";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<"portfolio" | "project" | null>(null);
  const [audience, setAudience] = useState<Audience>("armada");
  const [next, setNext] = useState("/");
  const [email, setEmail] = useState("");
  const [emailSubmitting, setEmailSubmitting] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  useEffect(() => {
    // Query string is a browser-owned return value (OAuth error / external link); read after mount.
    const params = new URLSearchParams(window.location.search);
    setError(params.get("error"));
    setNext(params.get("next") || "/");
    setAudience(params.get("audience") === "institution" || params.has("workspace") ? "institution" : "armada");
  }, []);

  const handleLogin = async (loginScope: "portfolio" | "project") => {
    setSubmitting(loginScope);
    const supabase = createClient();
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

  const handleEmailSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setEmailSubmitting(true);
    try {
      await fetch("/api/auth/email-start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, next }),
      });
    } catch {
      // Network failure still shows the generic message below — never reveal
      // whether the address is registered based on request outcome.
    } finally {
      setEmailSubmitting(false);
      setEmailSent(true);
    }
  };

  const emailForm = (
    <form onSubmit={handleEmailSubmit} className="space-y-3 text-left">
      <label htmlFor="workspace-email" className="block text-xs font-medium text-muted-foreground">
        研究機関・PJ関係者向けメールアドレス
      </label>
      <input
        id="workspace-email"
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@example.com"
        className="block min-h-11 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
      />
      <button
        type="submit"
        disabled={emailSubmitting}
        className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {emailSubmitting ? "送信中…" : "ログインリンクを送る"}
      </button>
    </form>
  );

  const googleButtons = (
    <div className="space-y-3">
      <button
        onClick={() => handleLogin("portfolio")}
        disabled={submitting !== null}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
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
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-border bg-background px-6 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
      >
        {submitting === "project" ? "接続中…" : "参加PJだけを見る"}
      </button>
      <p className="text-left text-[11px] leading-relaxed text-muted-foreground">
        PJ限定ログインでは、招待されたPJの共有ダッシュボードだけが表示されるよ。
      </p>
    </div>
  );

  if (emailSent) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-4 text-center">
          <h1 className="text-lg font-semibold">メールを確認してね</h1>
          <p className="text-sm text-muted-foreground">
            登録済みのメールアドレスなら、ログインリンクを送ったよ。届いていない場合は、入力したアドレスか迷惑メールフォルダを確認してね。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
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
        {(error === "workspace_account_not_found"
          || error === "workspace_no_access"
          || error === "workspace_activation_failed"
          || error === "workspace_account_conflict"
          || error === "workspace_auth_failed") && (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-left text-xs text-amber-800">
            このメールでのログインを完了できなかったよ。招待メールのリンクか、担当者からの案内を確認してね。
          </div>
        )}

        {audience === "institution" ? (
          <div className="space-y-5">
            {emailForm}
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              ARMADAメンバーはこちら
              <span className="h-px flex-1 bg-border" />
            </div>
            {googleButtons}
          </div>
        ) : (
          <div className="space-y-5">
            {googleButtons}
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              研究機関・PJ関係者の方はこちら
              <span className="h-px flex-1 bg-border" />
            </div>
            {emailForm}
          </div>
        )}
      </div>
    </div>
  );
}
