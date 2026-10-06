"use client";

import { useEffect, useId, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import styles from "./ProjectNavigation.module.css";

type Page = { key: string; label: string; onHover?: () => void };
type Group = { key: string; label: string; children: Page[] };

/** 分類の開閉はページ選択と分離する。開いている分類はほかの分類を開いても保つ。 */
export function ProjectPageMenu({ groups, activeGroup, activePage, onGroup, onPage, label, testPrefix }: {
  groups: Group[]; activeGroup?: string; activePage: string;
  onGroup: (key: string) => void; onPage: (key: string) => void;
  label: string; testPrefix?: string;
}) {
  const id = useId();
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => activeGroup ? { [activeGroup]: true } : {});
  useEffect(() => {
    if (activeGroup) setExpanded((current) => current[activeGroup] ? current : { ...current, [activeGroup]: true });
  }, [activeGroup, activePage]);
  return <nav aria-label={label} data-testid={testPrefix ? `${testPrefix}-group-navigation` : undefined} className={styles.menu}>
    {groups.map((group) => {
      const hasChildren = group.children.length > 1;
      const open = Boolean(expanded[group.key]);
      const childId = `${id}-${group.key}`;
      return <div key={group.key}>
        <button type="button" data-space-page={!hasChildren ? "" : undefined} data-cockpit-group={testPrefix === "cockpit" ? group.key : undefined}
          aria-expanded={hasChildren ? open : undefined} aria-controls={hasChildren ? childId : undefined}
          aria-current={!hasChildren && activeGroup === group.key ? "page" : undefined}
          onClick={() => hasChildren ? setExpanded((current) => ({ ...current, [group.key]: !current[group.key] })) : onGroup(group.key)}
          className={`${styles.row} ${styles.group}`}>
          {group.label}{hasChildren && (open ? <ChevronDown aria-hidden="true" className={`${styles.chevron} h-4 w-4`} /> : <ChevronRight aria-hidden="true" className={`${styles.chevron} h-4 w-4`} />)}
        </button>
        {hasChildren && <div id={childId} hidden={!open} aria-label={`${group.label}の表示切り替え`} data-testid={testPrefix ? `${testPrefix}-child-navigation` : undefined} className={styles.children}>
          {group.children.map((page) => <button key={page.key} type="button" data-space-page data-cockpit-tab={testPrefix === "cockpit" ? page.key : undefined}
            aria-current={activePage === page.key ? "page" : undefined} onClick={() => onPage(page.key)} onMouseEnter={page.onHover} onFocus={page.onHover}
            className={styles.row}>{page.label}</button>)}
        </div>}
      </div>;
    })}
  </nav>;
}
