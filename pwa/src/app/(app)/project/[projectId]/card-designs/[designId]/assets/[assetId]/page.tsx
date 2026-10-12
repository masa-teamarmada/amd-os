import { notFound } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  amieCardAccess,
  amieCardCanRead,
} from "@/lib/project-card-designs-server";
import { PdfCanvas } from "@/components/project-card-designs/PdfCanvas";

export const dynamic = "force-dynamic";
export default async function CardPdfPage({
  params,
}: {
  params: Promise<{ projectId: string; designId: string; assetId: string }>;
}) {
  const member = await amieCardAccess();
  if (!member) notFound();
  const { projectId, designId, assetId } = await params;
  const db = createAdminClient();
  const { data: design } = await db
    .from("project_card_designs")
    .select("owner_project_id,brand_label")
    .eq("design_id", designId)
    .maybeSingle();
  if (!design || design.owner_project_id !== projectId || !amieCardCanRead(member, design.owner_project_id)) notFound();
  const { data: asset } = await db
    .from("project_card_design_assets")
    .select("project_id,version_id,file_name,mime_type")
    .eq("asset_id", assetId)
    .maybeSingle();
  if (
    !asset ||
    asset.mime_type !== "application/pdf" ||
    !amieCardCanRead(member, asset.project_id)
  )
    notFound();
  const { data: version } = await db
    .from("project_card_design_versions")
    .select("design_id,revision_label")
    .eq("version_id", asset.version_id)
    .maybeSingle();
  if (version?.design_id !== designId) notFound();
  return (
    <main className="mx-auto max-w-4xl p-4 md:p-6">
      <Link
        href={`/project/${design.owner_project_id}/cockpit?tab=card-designs`}
        className="text-sm underline"
      >
        名刺案へ戻る
      </Link>
      <h1 className="my-3 text-xl font-semibold">
        {design.brand_label} · {version.revision_label}
      </h1>
      <p className="mb-4 text-sm text-muted-foreground">{asset.file_name}</p>
      <PdfCanvas
        title={asset.file_name}
        pdfUrl={`/api/project-card-designs/${designId}/assets/${assetId}/open?download=1`}
      />
    </main>
  );
}
