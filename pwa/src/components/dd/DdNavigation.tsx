"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { DD_ITEM_PAGES, DD_NAVIGATION_GROUPS } from "@/lib/project-formats";
import type { DdPageKey } from "@/lib/dd-pages";
import styles from "@/components/nav/ProjectNavigation.module.css";

/** 初期は全分類を展開。検索は閉じた分類も横断し、本文や開示条件は変えない。 */
export function DdNavigation({ slug, pageKey }: { slug: string; pageKey: DdPageKey }) {
  const base = `/dd/${encodeURIComponent(slug)}`;
  const id = useId();
  const [query, setQuery] = useState("");
  const [closedGroups, setClosedGroups] = useState<string[]>([]);
  useEffect(() => {
    const currentGroup = DD_NAVIGATION_GROUPS.find((group) => group.pages.some((key) => key === pageKey));
    if (currentGroup) setClosedGroups((closed) => closed.filter((key) => key !== currentGroup.key));
  }, [pageKey]);
  const searching = Boolean(query.trim());
  const matches = (label: string) => label.toLocaleLowerCase("ja").includes(query.trim().toLocaleLowerCase("ja"));
  const count = DD_ITEM_PAGES.filter((item) => matches(item.label)).length;
  return <nav aria-label="DDパッケージの資料目録" data-testid="dd-item-navigation" className={`${styles.menu} ${styles.dd}`}>
    <div className={styles.searchWrap}>
      <label htmlFor={id} className="sr-only">資料名で検索</label>
      <input id={id} type="search" placeholder="資料名で検索" value={query} onChange={(event) => setQuery(event.target.value)} className={styles.search} />
    </div>
    <div className={styles.items}>
      {DD_NAVIGATION_GROUPS.filter((group) => group.key !== "disclosure").map((group) => {
        const items = group.pages.flatMap((key) => DD_ITEM_PAGES.filter((item) => item.key === key && matches(item.label)));
        if (!items.length) return null;
        const expanded = searching || !closedGroups.includes(group.key);
        const Chevron = expanded ? ChevronDown : ChevronRight;
        const groupId = `${id}-${group.key}`;
        return <div key={group.key}>
          <button type="button" aria-expanded={expanded} aria-controls={groupId} disabled={searching} className={`${styles.row} ${styles.group}`} onClick={() => setClosedGroups((closed) => closed.includes(group.key) ? closed.filter((key) => key !== group.key) : [...closed, group.key])}>
            {group.label}<Chevron className={styles.chevron} size={14} aria-hidden="true" />
          </button>
          <div id={groupId} hidden={!expanded} className={styles.children}>
            {items.map((item) => <Link key={item.key} href={`${base}?tab=${item.key}`} aria-current={pageKey === item.key ? "page" : undefined} className={styles.row}>{item.label}</Link>)}
          </div>
        </div>;
      })}
      {count === 0 && <p className="px-3 py-4 text-sm text-[#6e6e73]">該当する資料はありません</p>}
    </div>
    <div className={styles.ddDisclosure}>
      <Link href={`${base}?tab=documents`} aria-current={pageKey === "documents" ? "page" : undefined} className={styles.row}>開示資料一覧</Link>
    </div>
    <p aria-live="polite" className={styles.count}>{query.trim() ? `${count} / ` : ""}{DD_ITEM_PAGES.length}資料</p>
  </nav>;
}
