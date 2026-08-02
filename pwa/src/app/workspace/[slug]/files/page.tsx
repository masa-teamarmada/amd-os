import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveInstitutionDocumentAccess } from "@/lib/workspace-document-access";
import { WorkspaceDocumentRoom } from "@/components/workspace-documents/WorkspaceDocumentRoom";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return { title: "研究機関 資料室" };
}

export default async function InstitutionWorkspaceFilesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await resolveInstitutionDocumentAccess(slug);
  if (!access) notFound();

  const db = createAdminClient();
  const { data: workspace, error } = await db
    .from("institution_workspaces")
    .select("name")
    .eq("id", access.workspaceId)
    .maybeSingle();
  if (error || !workspace) notFound();

  return (
    <WorkspaceDocumentRoom
      scopeKind="institution"
      scopeId={slug}
      scopeName={String(workspace.name)}
      returnHref={`/workspace/${encodeURIComponent(slug)}`}
      returnLabel="機関概要へ戻る"
    />
  );
}
