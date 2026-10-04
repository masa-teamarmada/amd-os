import { notFound } from "next/navigation";
import { resolveDdPackageAccess } from "@/lib/dd-access";
import { loadDdPackageView, recordDdAccessEvent } from "@/lib/dd-package-server";
import { DdViewerShell } from "@/components/dd/DdViewerShell";
import { DdPackageTop } from "@/components/dd/DdPackageTop";
import { hasDdCapability } from "@/lib/dd-package-core";

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
  return (
    <DdViewerShell access={access} projectName={view.projectName}>
      <DdPackageTop view={view} slug={access.slug} sectionKey={section} tab={tab} canDownload={hasDdCapability(access, "dd.download")} />
    </DdViewerShell>
  );
}
