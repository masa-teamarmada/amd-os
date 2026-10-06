"use client";

import { MarkdownView } from "@/components/cockpit/MarkdownView";
import type { ProjectProductDescriptionData } from "@/lib/project-product-description";
import { splitProductDescriptionLayout } from "@/lib/project-product-description-layout";
import styles from "./ProjectProductDescription.module.css";

export function ProjectProductDescription({ data, founding = false }: { data: ProjectProductDescriptionData | null; founding?: boolean }) {
  if (!data) return (
    <div data-testid="project-diligence-empty" data-page={founding ? "founding-background" : "product-description"} className="space-y-3 py-3">
      <h2 className="text-lg font-semibold leading-7">{founding ? "創業の背景と社会課題" : "製品説明資料"}</h2>
      <p className="text-sm text-[#6e6e73]">資料未登録</p>
    </div>
  );
  // 投資実務家が装置・用途・成立条件を比較する連続した資料面。
  // 白地と細罫線、本文12px、4px刻み。図のSVG内文字には本文CSSを適用しない。
  const layout = splitProductDescriptionLayout(data.bodyMd);
  return (
    <article data-testid={founding ? "project-founding-background" : "project-product-description"} className={`min-w-0 ${styles.document}`}>
      <h2 className={styles.title}>{data.title}</h2>
      <p className={styles.summary}>{data.summary}</p>
      {layout.figures.length > 0 && <div className={styles.gallery}>{layout.figures.map((source, index) => <figure key={index}><MarkdownView source={source} /></figure>)}</div>}
      {layout.lead && <MarkdownView source={layout.lead} />}
      <div className={styles.sections}>
        {layout.sections.map((section, index) => <section key={index} className={`${styles.section} ${founding || section.wide ? styles.wide : ""}`}><MarkdownView source={section.source} /></section>)}
      </div>
      <aside className={styles.sources} aria-label="資料の根拠">
        <h3 className="font-medium">資料の根拠</h3>
        <ul className="list-disc">{data.sourceRefs.map(ref => <li key={ref}>{ref}</li>)}</ul>
      </aside>
    </article>
  );
}
