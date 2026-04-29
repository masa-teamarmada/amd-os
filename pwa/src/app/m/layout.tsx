"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import BottomTabs from "@/components/mobile/BottomTabs";
import type { User } from "@supabase/supabase-js";

export default function MobileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
      setLoading(false);
    };
    getUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) router.push("/login");
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-gray-400 text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-sm border-b border-gray-100">
        <div className="flex items-center justify-between px-4 h-11">
          <h1 className="text-sm font-bold tracking-tight">
            AMD OS <span className="text-[10px] text-gray-400 font-mono">billing</span>
          </h1>
          <span className="text-[10px] text-gray-400 truncate max-w-[140px]">
            {user?.email?.split("@")[0]}
          </span>
        </div>
      </header>

      {/* Main content (with bottom padding for tabs) */}
      <main className="pb-20">{children}</main>

      {/* Bottom tabs */}
      <BottomTabs />
    </div>
  );
}
