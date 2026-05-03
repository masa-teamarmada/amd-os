"use client";

import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const handleLogin = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          hd: "team-armada.jp", // Restrict to Google Workspace domain
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
