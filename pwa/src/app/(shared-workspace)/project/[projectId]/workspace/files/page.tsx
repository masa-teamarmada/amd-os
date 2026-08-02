import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveProjectDocumentAccess } from "@/lib/workspace-document-access";
import { WorkspaceDocumentRoom } from "@/components/workspace-documents/WorkspaceDocumentRoom";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return { title: "PJ 資料室" };
}

export default async function ProjectWorkspaceFilesPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const access = await resolveProjectDocumentAccess(projectId);
  if (!access) notFound();

  const db = createAdminClient();
  const { data: project, error } = await db
    .from("projects")
    .select("project_name")
    .eq("project_id", projectId)
    .maybeSingle();
  if (error || !project) notFound();

  const [{ data: institutionProject }, { data: seedProject }] = await Promise.all([
    db.from("institution_projects").select("institution_id").eq("project_id", projectId).maybeSingle(),
    db.from("seed_projects").select("seed_id").eq("project_id", projectId).maybeSingle(),
  ]);
  const [{ data: institution }, { data: seed }] = await Promise.all([
    institutionProject?.institution_id
      ? db.from("institutions").select("name,short_name").eq("institution_id", institutionProject.institution_id).maybeSingle()
      : Promise.resolve({ data: null }),
    seedProject?.seed_id
      ? db.from("seeds").select("title").eq("id", seedProject.seed_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const projectName = String(project.project_name);
  const scopeTrail = [
    institution ? String(institution.short_name || institution.name) : null,
    seed ? String(seed.title) : null,
    projectName,
  ].filter((label): label is string => Boolean(label));

  return (
    <WorkspaceDocumentRoom
      scopeKind="project"
      scopeId={projectId}
      scopeName={projectName}
      scopeTrail={scopeTrail}
      returnHref={access.principal === "internal_member"
        ? `/project/${encodeURIComponent(projectId)}/cockpit`
        : `/project/${encodeURIComponent(projectId)}/workspace`}
      returnLabel={access.principal === "internal_member" ? "コックピットへ戻る" : "PJ概要へ戻る"}
    />
  );
}
