import type { ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import styles from "./DdNavigationFeedback.module.css";

/** リンクを押した時点で、次の本文を取得していることを画面内に示す。 */
export function DdNavigationFeedback({ children }: { children: ReactNode }) {
  return <div className={styles.container}>
    <div className={styles.content}>{children}</div>
    <div className={styles.feedback} role="status" data-testid="dd-navigation-feedback">
      <div className={styles.message}>
        <LoaderCircle className="h-5 w-5 shrink-0 animate-spin text-[#027FDC]" aria-hidden="true" />
        <span>ページを読み込み中…</span>
      </div>
    </div>
  </div>;
}
