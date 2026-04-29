"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: "⬡" },
  { href: "/projects", label: "Projects", icon: "◈" },
  { href: "/milestones", label: "Milestones", icon: "◎" },
  { href: "/billing", label: "Billing", icon: "¥" },
  { href: "/protocols", label: "Protocols", icon: "⚙" },
  { href: "/reports", label: "Reports", icon: "▤" },
  { href: "/members", label: "Members", icon: "◉" },
  { href: "/settings", label: "Settings", icon: "⊕" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
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
      if (!session?.user) {
        router.push("/login");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-white text-gray-900 flex overflow-hidden">
      {/* Sidebar */}
      <aside className="w-52 bg-gray-50 border-r border-gray-200 flex flex-col shrink-0">
        <div className="px-4 py-3 border-b border-gray-200">
          <h1 className="text-base font-bold tracking-tight text-gray-900">
            AMD OS
          </h1>
          <p className="text-[10px] text-gray-400 mt-0.5 font-mono">v2</p>
        </div>
        <nav className="flex-1 p-1.5 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <a
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs transition-colors ${
                  isActive
                    ? "bg-blue-50 text-blue-700 font-medium"
                    : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                <span className="text-sm w-4 text-center opacity-60">
                  {item.icon}
                </span>
                {item.label}
              </a>
            );
          })}
        </nav>
        <div className="px-3 py-2 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-gray-400 truncate max-w-[120px]">
              {user?.email}
            </span>
            <button
              onClick={handleSignOut}
              className="text-[10px] text-gray-400 hover:text-gray-700 cursor-pointer"
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-white">{children}</main>
    </div>
  );
}
