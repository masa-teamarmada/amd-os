import { DdEntryGate } from "@/components/dd/DdEntryGate";
import { loadDdNdaContext, hasDdNdaConfirmation } from "@/lib/dd-nda-server";
import { ddNdaReturnPath } from "@/lib/dd-nda";
import { ddContentHash } from "@/lib/dd-confidentiality-server";
import { notFound, redirect } from "next/navigation";
import { requireDdPageSession } from "@/lib/dd-page-session";
import { resolveDdPackageAccess } from "@/lib/dd-access";
import { loadDdPackageView, recordDdAccessEvent } from "@/lib/dd-package-server";
import { DdViewerShell } from "@/components/dd/DdViewerShell";
import { DdPackageTop } from "@/components/dd/DdPackageTop";
import { hasDdCapability, isDdSlug } from "@/lib/dd-package-core";
import { DD_PAGE_KEYS, type DdPageKey } from "@/lib/dd-pages";
import { loadDdProjectPage } from "@/lib/dd-project-pages-server";
import { canEditProjectSurface } from "@/lib/project-surface-access";

export const dynamic = "force-dynamic";

// DDトップ。権限の確認（毎回DBを引き直す）より前に、パッケージの有無が分かる応答を返さない。
export default async function DdPackagePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ tab?: string; section?: string; returnTo?: string; fresh?: string }> }) {
  const { slug } = await params;
  if (!isDdSlug(slug)) notFound();
  const { section, tab, returnTo, fresh } = await searchParams;
  const query = new URLSearchParams();
  if (tab) query.set("tab", tab);
  if (section) query.set("section", section);
  await requireDdPageSession(`/dd/${encodeURIComponent(slug)}${query.size ? `?${query}` : ""}`);
  const access = await resolveDdPackageAccess(slug, { requireNdaConfirmation: false });
  if (!access) notFound();
  if (!await hasDdNdaConfirmation(access)) {
    const nda = await loadDdNdaContext(access);
    return <DdEntryGate slug={slug} title={access.title} {...nda} returnTo={ddNdaReturnPath(slug, returnTo ?? `/dd/${encodeURIComponent(slug)}${query.size ? `?${query}` : ""}`)} />;
  }

  if (tab === "financial-projection") redirect(`/dd/${encodeURIComponent(access.slug)}?tab=monthly-trial`);
  // 認可後、選択された正本ページと監査記録を並行して読む。
  // 旧section URLだけはlive項目からページを解決する互換経路を使う。
  const selectedPage = tab && DD_PAGE_KEYS.includes(tab) ? tab : section ? undefined : "company";
  const [view, initialPage] = await Promise.all([
    loadDdPackageView(access, { mode: selectedPage === "documents" ? "documents" : selectedPage ? "header" : "full" }),
    selectedPage && selectedPage !== "documents" ? loadDdProjectPage(access.projectId, selectedPage, fresh === "1") : Promise.resolve(undefined),
  ]);
  if (!view) notFound();

  const legacyPage = view.sections.find((row) => row.key === section)?.items[0]?.pageKey;
  const pageKey = selectedPage ?? legacyPage ?? "company";
  const canonicalPage = initialPage ?? (pageKey === "documents" ? undefined : await loadDdProjectPage(access.projectId, pageKey, fresh === "1"));
  const canEditPocList = pageKey === "poc-list" && access.principal !== "workspace_account" && hasDdCapability(access, "dd.edit") &&
    (await canEditProjectSurface(access.projectId, "cockpit") || await canEditProjectSurface(access.projectId, "workspace"));

  await recordDdAccessEvent(access, "dd_package_viewed", { pageKey, contentHash: ddContentHash(canonicalPage ?? view.sections) });

  return (
    <DdViewerShell access={access} projectName={view.projectName} pageKey={pageKey as DdPageKey}>
      <DdPackageTop view={view} slug={access.slug} sectionKey={section} tab={pageKey} canonicalPage={canonicalPage} canEditPocList={canEditPocList} canDownload={hasDdCapability(access, "dd.download")} />
    </DdViewerShell>
  );
}
