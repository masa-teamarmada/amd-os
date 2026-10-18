import { LoaderCircle } from "lucide-react";
import styles from "./NavigationProgressIndicator.module.css";

/** ファビコンと同じ遷移状態を、独立PWAの画面内でも表示する。 */
export function NavigationProgressIndicator() {
  return <span className={styles.indicator} role="status" data-testid="navigation-progress">
    <LoaderCircle className="h-4 w-4 animate-spin text-[#027FDC]" aria-hidden="true" />
    <span className="sr-only">ページを読み込み中</span>
  </span>;
}
