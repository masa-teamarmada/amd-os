import { ddContentHash } from "@/lib/dd-confidentiality-server";
import { notFound, redirect } from "next/navigation";
import { resolveDdPackageAccess } from "@/lib/dd-access";
import { loadDdPackageView, recordDdAccessEvent } from "@/lib/dd-package-server";
import { DdViewerShell } from "@/components/dd/DdViewerShell";
import { DdPackageTop } from "@/components/dd/DdPackageTop";
import { hasDdCapability } from "@/lib/dd-package-core";
import { DD_PAGE_KEYS, type DdPageKey } from "@/lib/dd-pages";
import { loadDdProjectPage } from "@/lib/dd-project-pages-server";

export const dynamic = "force-dynamic";

// DDトップ。権限の確認（毎回DBを引き直す）より前に、パッケージの有無が分かる応答を返さない。
export default async function DdPackagePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ tab?: string; section?: string }> }) {
  const { slug } = await params;
  const access = await resolveDdPackageAccess(slug);
  if (!access) notFound();

  const { section, tab } = await searchParams;
  if (tab === "financial-projection") redirect(`/dd/${encodeURIComponent(access.slug)}?tab=monthly-trial`);
  // 認可後、選択された正本ページと監査記録を並行して読む。
  // 旧section URLだけはlive項目からページを解決する互換経路を使う。
  const selectedPage = tab && DD_PAGE_KEYS.includes(tab) ? tab : section ? undefined : "company";
  const [view, initialPage] = await Promise.all([
    loadDdPackageView(access, { mode: selectedPage === "documents" ? "documents" : selectedPage ? "header" : "full" }),
    selectedPage && selectedPage !== "documents" ? loadDdProjectPage(access.projectId, selectedPage) : Promise.resolve(undefined),
  ]);
  if (!view) notFound();

  const legacyPage = view.sections.find((row) => row.key === section)?.items[0]?.pageKey;
  const pageKey = selectedPage ?? legacyPage ?? "company";
  const canonicalPage = initialPage ?? (pageKey === "documents" ? undefined : await loadDdProjectPage(access.projectId, pageKey));

  await recordDdAccessEvent(access, "dd_package_viewed", { pageKey, contentHash: ddContentHash(canonicalPage ?? view.sections) });

  return (
    <DdViewerShell access={access} projectName={view.projectName} pageKey={pageKey as DdPageKey}>
      <DdPackageTop view={view} slug={access.slug} sectionKey={section} tab={pageKey} canonicalPage={canonicalPage} canDownload={hasDdCapability(access, "dd.download")} />
    </DdViewerShell>
  );
}
