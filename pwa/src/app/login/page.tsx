"use client";

import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const handleGoogleLogin = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/callback`,
        queryParams: {
          hd: "team-armada.jp",
        },
      },
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-8">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 tracking-tight">
            AMD OS
          </h1>
          <p className="text-gray-400 mt-2 text-sm">
            Team ARMADA Operating System
          </p>
        </div>
        <button
          onClick={handleGoogleLogin}
          className="px-8 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors cursor-pointer"
        >
          Sign in with Google
        </button>
      </div>
    </div>
  );
}
