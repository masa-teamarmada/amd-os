import { notFound } from "next/navigation";
import { resolveDdPackageAccess } from "@/lib/dd-access";
import { loadDdPackageView, recordDdAccessEvent } from "@/lib/dd-package-server";
import { DdViewerShell } from "@/components/dd/DdViewerShell";
import { DdPackageTop } from "@/components/dd/DdPackageTop";

export const dynamic = "force-dynamic";

// DDトップ。権限の確認（毎回DBを引き直す）より前に、パッケージの有無が分かる応答を返さない。
export default async function DdPackagePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await resolveDdPackageAccess(slug);
  if (!access) notFound();

  const view = await loadDdPackageView(access);
  if (!view) notFound();

  await recordDdAccessEvent(access, "dd_package_viewed");

  return (
    <DdViewerShell access={access}>
      <DdPackageTop view={view} slug={access.slug} />
    </DdViewerShell>
  );
}
