import type { DdEmptyPageKey } from "@/lib/dd-pages";
import { PROJECT_PAGE_LABELS } from "@/lib/project-formats";

/** 新しい資料区分の共通空状態。既存の説明記事を資料登録済みとは扱わない。 */
export function ProjectDiligenceSection({ page }: { page: DdEmptyPageKey }) {
  return (
    <div data-testid="project-diligence-empty" data-page={page} className="space-y-3 py-3">
      <h2 className="text-lg font-semibold leading-7">{PROJECT_PAGE_LABELS[page]}</h2>
      <p className="text-sm text-[#6e6e73]">資料未登録</p>
    </div>
  );
}
