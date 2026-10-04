import Link from "next/link";
import type { DdPackageView } from "@/lib/dd-package-server";

// 他のPJ領域と同じ「分類 → 子タブ → 本文」。DDの子タブは認可済みの掲載項目だけ。
export function DdNavigation({ view, slug, sectionKey, itemId }: {
  view: DdPackageView;
  slug: string;
  sectionKey: string;
  itemId?: string;
}) {
  const base = `/dd/${encodeURIComponent(slug)}`;
  const section = view.sections.find((entry) => entry.key === sectionKey) ?? view.sections[0];
  return (
    <div className="space-y-2">
      <nav aria-label="DDパッケージの分類" className="grid grid-cols-2 gap-1 rounded-xl border border-[#bfc0c7] bg-[#f5f5f7] p-1 sm:grid-cols-4 lg:grid-cols-7">
        {view.sections.map((entry) => (
          <Link key={entry.key} href={`${base}?section=${entry.key}`} aria-current={entry.key === section.key ? "page" : undefined}
            className={`flex min-h-11 items-center justify-center rounded-lg border px-2 text-center text-[12.5px] font-semibold sm:min-h-9 ${entry.key === section.key ? "border-[#bcdcf6] bg-white text-[#0267b2]" : "border-transparent text-[#6e6e73] hover:bg-white"}`}>
            {entry.label}
          </Link>
        ))}
      </nav>
      <nav aria-label={`${section.label}の表示切り替え`} className="flex flex-wrap gap-1 rounded-lg border border-[#d2d2d7] bg-white p-1">
        <Link href={`${base}?section=${section.key}`} aria-current={!itemId ? "page" : undefined}
          className={`inline-flex min-h-11 items-center rounded-md px-3 text-[12.5px] sm:min-h-8 ${!itemId ? "bg-[#eef6fd] font-semibold text-[#0267b2]" : "text-[#6e6e73] hover:bg-[#f5f5f7]"}`}>一覧</Link>
        {section.items.map((item) => (
          <Link key={item.itemId} href={`${base}/items/${item.itemId}`} aria-current={itemId === item.itemId ? "page" : undefined}
            className={`inline-flex min-h-11 max-w-full items-center rounded-md px-3 text-[12.5px] sm:min-h-8 ${itemId === item.itemId ? "bg-[#eef6fd] font-semibold text-[#0267b2]" : "text-[#6e6e73] hover:bg-[#f5f5f7]"}`}>
            <span className="break-words">{item.title}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
