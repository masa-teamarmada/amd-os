import { notFound } from "next/navigation";
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

  const view = await loadDdPackageView(access);
  if (!view) notFound();

  await recordDdAccessEvent(access, "dd_package_viewed");

  const { section, tab } = await searchParams;
  const legacyPage = view.sections.find((row) => row.key === section)?.items[0]?.pageKey;
  const pageKey = (tab && DD_PAGE_KEYS.includes(tab) ? tab : legacyPage) ?? "company";
  const canonicalPage = pageKey === "documents" ? undefined : await loadDdProjectPage(access.projectId, pageKey);
  return (
    <DdViewerShell access={access} projectName={view.projectName} pageKey={pageKey as DdPageKey}>
      <DdPackageTop view={view} slug={access.slug} sectionKey={section} tab={pageKey} canonicalPage={canonicalPage} canDownload={hasDdCapability(access, "dd.download")} />
    </DdViewerShell>
  );
}
