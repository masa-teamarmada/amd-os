"use client";

type Page = { key: string; label: string; onHover?: () => void };
type Group = { key: string; label: string; children: Page[] };

/** 分類を選ぶと、その分類のページだけを直下に展開する。 */
export function ProjectPageMenu({ groups, activeGroup, activePage, onGroup, onPage, label, testPrefix }: {
  groups: Group[]; activeGroup?: string; activePage: string;
  onGroup: (key: string) => void; onPage: (key: string) => void;
  label: string; testPrefix?: string;
}) {
  return <nav aria-label={label} data-testid={testPrefix ? `${testPrefix}-group-navigation` : undefined} className="space-y-1 border-t border-[#d2d2d7] pt-3">
    {groups.map((group) => {
      const selected = activeGroup === group.key;
      return <div key={group.key}>
        <button type="button" data-space-page={group.children.length === 1 ? "" : undefined} data-cockpit-group={testPrefix === "cockpit" ? group.key : undefined}
          aria-expanded={group.children.length > 1 ? selected : undefined} aria-current={selected ? "true" : undefined}
          onClick={() => onGroup(group.key)}
          className={`flex min-h-11 w-full items-center rounded-md px-3 text-left text-[13px] font-semibold transition-colors hover:bg-[#f5f5f7] focus-visible:outline-2 focus-visible:outline-[#027FDC] ${selected ? "bg-[#eef6fd] text-[#0267b2]" : "text-[#6e6e73]"}`}>{group.label}</button>
        {selected && group.children.length > 1 && <div aria-label={`${group.label}の表示切り替え`} data-testid={testPrefix ? `${testPrefix}-child-navigation` : undefined} className="ml-3 mt-1 space-y-1 border-l border-[#d2d2d7] pl-2">
          {group.children.map((page) => <button key={page.key} type="button" data-space-page data-cockpit-tab={testPrefix === "cockpit" ? page.key : undefined}
            aria-current={activePage === page.key ? "page" : undefined} onClick={() => onPage(page.key)} onMouseEnter={page.onHover} onFocus={page.onHover}
            className={`flex min-h-11 w-full items-center rounded-md px-3 text-left text-[12.5px] transition-colors hover:bg-[#f5f5f7] focus-visible:outline-2 focus-visible:outline-[#027FDC] ${activePage === page.key ? "bg-[#f5f5f7] font-semibold text-[#1d1d1f]" : "text-[#6e6e73]"}`}>{page.label}</button>)}
        </div>}
      </div>;
    })}
  </nav>;
}
