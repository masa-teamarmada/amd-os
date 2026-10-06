"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { DD_ITEM_PAGES } from "@/lib/project-formats";
import type { DdPageKey } from "@/lib/dd-pages";
import styles from "@/components/nav/ProjectNavigation.module.css";

/** DDの資料目録は一段。資料名で絞り込んでも常設の目録・本文は変更しない。 */
export function DdNavigation({ slug, pageKey }: { slug: string; pageKey: DdPageKey }) {
  const base = `/dd/${encodeURIComponent(slug)}`;
  const id = useId();
  const [query, setQuery] = useState("");
  const matches = (label: string) => label.toLocaleLowerCase("ja").includes(query.trim().toLocaleLowerCase("ja"));
  const count = DD_ITEM_PAGES.filter((item) => matches(item.label)).length;
  return <nav aria-label="DDパッケージの資料目録" data-testid="dd-item-navigation" className={`${styles.menu} ${styles.dd}`}>
    <div className={styles.searchWrap}>
      <label htmlFor={id} className="sr-only">資料名で検索</label>
      <input id={id} type="search" placeholder="資料名で検索" value={query} onChange={(event) => setQuery(event.target.value)} className={styles.search} />
    </div>
    <div className={styles.items}>
      {DD_ITEM_PAGES.map((item) => matches(item.label) && <Link key={item.key} href={`${base}?tab=${item.key}`} aria-current={pageKey === item.key ? "page" : undefined} className={styles.row}>{item.label}</Link>)}
      {count === 0 && <p className="px-3 py-4 text-sm text-[#6e6e73]">該当する資料はありません</p>}
    </div>
    <p aria-live="polite" className={styles.count}>{query.trim() ? `${count} / ` : ""}{DD_ITEM_PAGES.length}資料</p>
  </nav>;
}
