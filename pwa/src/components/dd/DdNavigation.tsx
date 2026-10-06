import Link from "next/link";
import { DD_ITEM_PAGES } from "@/lib/project-formats";
import type { DdPageKey } from "@/lib/dd-pages";

/** DDの資料目録を、グループや開閉を挟まず一段で表示する。 */
export function DdNavigation({ slug, pageKey }: { slug: string; pageKey: DdPageKey }) {
  const base = `/dd/${encodeURIComponent(slug)}`;
  return (
    <nav aria-label="DDパッケージの資料目録" data-testid="dd-item-navigation" className="space-y-1 border-t border-[#d2d2d7] pt-3">
      {DD_ITEM_PAGES.map((item) => (
        <Link key={item.key} href={`${base}?tab=${item.key}`} aria-current={pageKey === item.key ? "page" : undefined}
          className={`flex min-h-11 items-center rounded-md px-3 py-2 text-[13px] leading-5 break-words hover:bg-[#f5f5f7] focus-visible:outline-2 focus-visible:outline-[#027FDC] ${pageKey === item.key ? "bg-[#eef6fd] font-semibold text-[#0267b2]" : "text-[#6e6e73]"}`}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
