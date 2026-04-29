"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ProfilePage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setEmail(user?.email || "");
    });
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <div className="px-4 py-6">
      <h2 className="text-lg font-bold mb-4">Profile</h2>

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <div className="text-xs text-gray-400 mb-1">Email</div>
        <div className="text-sm">{email}</div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <a
          href="/"
          className="text-sm text-blue-600"
        >
          PC版ダッシュボードを開く →
        </a>
      </div>

      <button
        onClick={handleSignOut}
        className="w-full border border-gray-300 text-gray-600 rounded-xl py-3 text-sm font-medium active:bg-gray-50"
      >
        サインアウト
      </button>
    </div>
  );
}
