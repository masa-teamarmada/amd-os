"use client";

import { usePathname } from "next/navigation";

const TABS = [
  { href: "/m", label: "Home", icon: "⬡" },
  { href: "/m/reimburse", label: "立替", icon: "📎" },
  { href: "/m/profile", label: "Profile", icon: "◉" },
];

export default function BottomTabs() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-2 pb-[env(safe-area-inset-bottom)] z-50">
      <div className="flex justify-around items-center h-14">
        {TABS.map((tab) => {
          const isActive =
            tab.href === "/m"
              ? pathname === "/m"
              : pathname.startsWith(tab.href);
          return (
            <a
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-lg transition-colors ${
                isActive
                  ? "text-blue-600"
                  : "text-gray-400 active:text-gray-600"
              }`}
            >
              <span className="text-lg">{tab.icon}</span>
              <span className="text-[10px] font-medium">{tab.label}</span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}
