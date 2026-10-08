"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLoginApp } from "@/components/auth/LoginAppContext";
import { resolveLoginEntry } from "@/lib/login-entry";

const PORTFOLIO_GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/gmail.readonly",
].join(" ");

export default function LoginPage() {
  // 書斎のアドレスでは「書斎」として出し、AMD メンバーのログインだけを置く（書斎は管理者限定）
  const loginApp = useLoginApp();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [next, setNext] = useState("/");
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [useCode, setUseCode] = useState(false);

  useEffect(() => {
    // Query string is a browser-owned return value (OAuth error / external link); read after mount.
    const params = new URLSearchParams(window.location.search);
    setError(params.get("error"));
    setUseCode(["workspace_auth_failed", "workspace_code_failed"].includes(params.get("error") || ""));
    setNext(params.get("next") || "/");
  }, []);

  const handleLogin = async (loginEmail?: string) => {
    setSubmitting(true);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}&login_scope=portfolio`,
        scopes: PORTFOLIO_GOOGLE_SCOPES,
        queryParams: {
          hd: "team-armada.jp",
          access_type: "offline",
          prompt: "consent",
          include_granted_scopes: "true",
          ...(loginEmail ? { login_hint: loginEmail } : {}),
        },
      },
    });
    if (signInError) {
      setError("auth_failed");
      setSubmitting(false);
    }
  };

  const handleEmailSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    const entry = resolveLoginEntry(email);
    if (!entry) return;
    setError(null);
    setSubmitting(true);
    try {
      if (entry.method === "google") {
        await handleLogin(entry.email);
        return;
      }
      const response = await fetch("/api/auth/email-start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: entry.email, next }),
      });
      if (!response.ok) throw new Error("email_start_failed");
      setEmailSent(true);
      setUseCode(true);
    } catch {
      // A transport failure says nothing about whether this email has access.
      setError("connection_failed");
    } finally {
      setSubmitting(false);
    }
  };

  const emailForm = (
    <form action={useCode ? "/auth/callback" : undefined} method={useCode ? "post" : undefined}
      onSubmit={useCode ? undefined : handleEmailSubmit} className="space-y-4 text-left" aria-busy={submitting}>
      <input type="hidden" name="next" value={next} />
      <div className="space-y-2">
        <label htmlFor="workspace-email" className="block text-sm font-medium">
          メールアドレス
        </label>
        <input
          id="workspace-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={320}
          aria-describedby="login-email-help"
          disabled={submitting}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          className="block h-12 w-full min-w-0 rounded-md border border-border bg-background px-3 py-2 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-50"
        />
      </div>
      {useCode && (
        <div className="space-y-2">
          <label htmlFor="workspace-code" className="block text-sm font-medium">メールのログインコード</label>
          <input id="workspace-code" name="token" type="text" required inputMode="numeric"
            autoComplete="one-time-code" minLength={6} maxLength={10} pattern="[0-9]{6,10}"
            aria-describedby="login-email-help" placeholder="メールに届いた数字"
            className="block h-12 w-full min-w-0 rounded-md border border-border bg-background px-3 py-2 font-mono text-base outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30" />
        </div>
      )}
      <button
        type="submit"
        disabled={submitting}
        className="inline-flex h-12 w-full items-center justify-center rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
      >
        {submitting ? "接続中…" : useCode ? "ログインする" : "続ける"}
      </button>
      <p id="login-email-help" className="text-xs leading-relaxed text-muted-foreground">
        {useCode ? "最新のメールにある数字を入力してください。コードは別のブラウザでも使えます。" : "メールのボタン、またはログインコードで入れます。"}
      </p>
      <button type="button" onClick={() => { setUseCode(!useCode); setEmailSent(false); setError(null); }}
        className="min-h-11 w-full px-3 text-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring">
        {useCode ? "新しいログインメールを受け取る" : "メールのコードでログイン"}
      </button>
    </form>
  );

  if (emailSent) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 py-12">
        <div className="w-full min-w-0 max-w-sm space-y-4 text-center">
          <h1 className="text-xl font-semibold">メールを確認してください</h1>
          <p className="text-sm leading-relaxed text-muted-foreground" role="status">
            届いたメールの「ログインする」を押すか、下にログインコードを入力してください。
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">届かない場合は迷惑メールフォルダを確認してください。閲覧権限がない場合は、管理者の承認後にもう一度ログインしてください。</p>
          {emailForm}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full min-w-0 max-w-sm space-y-8 text-center">
        <div className="space-y-2">
          {loginApp === "shosai" ? (
            <>
              <h1 className="text-2xl font-semibold tracking-tight">書斎</h1>
              <p className="text-sm text-muted-foreground">執筆中の本と論文を、ページ送りで通読</p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-semibold tracking-tight">
                <span className="text-primary">◈</span> AMD OS
              </h1>
              <p className="text-sm text-muted-foreground">
                {useCode ? "メールのコードでログイン" : "メールアドレスを入力してログイン"}
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground">招待されたメールアドレスを使ってください。</p>
            </>
          )}
        </div>
        {error === "calendar_required" && (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-left text-xs text-amber-800">
            Google Calendarの共有が必要。ログイン時の権限確認でCalendarをONにして続行して。
          </div>
        )}
        {error === "auth_failed" && (
          <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-left text-xs text-red-700">
            {loginApp === "shosai"
              ? "ログインを完了できませんでした。もう一度ログインしてください。"
              : "ログインを完了できませんでした。メールアドレスを入力して、もう一度続けてください。"}
          </div>
        )}
        {error === "connection_failed" && (
          <div role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-left text-xs text-red-700">
            接続できませんでした。通信状態を確認して、もう一度続けてください。
          </div>
        )}
        {error === "domain_not_allowed" && (
          <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-left text-xs text-red-700">
            AMDメンバー用ログインは team-armada.jp のアカウントだけ使えるよ。
          </div>
        )}
        {error === "member_not_registered" && (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-left text-xs text-amber-800">
            このGoogleアカウントはまだAMD OSに登録されてないよ。PJ管理者に招待を頼んでください。
          </div>
        )}
        {error === "project_membership_required" && (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-left text-xs text-amber-800">
            PJ限定アカウントに有効なPJ参加設定がないよ。管理者側の設定を確認してください。
          </div>
        )}
        {(error === "workspace_account_not_found"
          || error === "workspace_no_access"
          || error === "workspace_activation_failed"
          || error === "workspace_account_conflict") && (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-left text-xs text-amber-800">
            このメールでのログインを完了できませんでした。招待されたメールアドレスか、管理者側の閲覧許可を確認してください。
          </div>
        )}
        {error === "workspace_auth_failed" && (
          <div role="alert" className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-left text-sm text-amber-800">
            リンクでログインを完了できませんでした。新しいメールを受け取り、メールのボタンを押さずにログインコードを入力してください。
          </div>
        )}

        {error === "workspace_code_failed" && (
          <div role="alert" className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-left text-sm text-amber-800">
            コードを確認できませんでした。最新のメールのコードを使ってください。期限切れの場合は、新しいログインメールを受け取ってください。
          </div>
        )}

        {loginApp === "shosai" ? (
          <div className="space-y-3">
            <button
              onClick={() => handleLogin()}
              disabled={submitting}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {submitting ? "接続中…" : "AMDメンバーとしてログイン"}
            </button>
            <p className="text-left text-[11px] leading-relaxed text-muted-foreground">
              AMD OS と同じ Google アカウントでログインします。書斎を開けるのは管理者だけです。
            </p>
          </div>
        ) : (
          emailForm
        )}
      </div>
    </div>
  );
}
