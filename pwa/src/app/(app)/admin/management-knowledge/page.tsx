import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import {
  AdminManagementKnowledgeClient,
  type ManagementKnowledgeEntry,
  type ManagementKnowledgeProject,
} from "@/components/admin/AdminManagementKnowledgeClient";

export const metadata: Metadata = { title: { absolute: "Admin 経営ノウハウ - AMD OS" } };

export default async function AdminManagementKnowledgePage() {
  const supabase = await createClient();

  const [{ data: projectData }, { data: knowledgeData, error }] = await Promise.all([
    supabase
      .from("projects")
      .select("project_id, project_name, status")
      .order("status")
      .order("project_name"),
    supabase
      .from("management_knowledge_entries")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(500),
  ]);

  const projects: ManagementKnowledgeProject[] = (projectData ?? []).map((project) => ({
    projectId: project.project_id,
    projectName: project.project_name,
    status: project.status ?? null,
  }));

  const entries: ManagementKnowledgeEntry[] = (knowledgeData ?? []).map((entry) => ({
    id: entry.id,
    projectId: entry.project_id ?? null,
    title: entry.title,
    category: entry.category,
    routeType: entry.route_type ?? null,
    maturity: entry.maturity,
    tags: entry.tags ?? [],
    summary: entry.summary ?? "",
    bodyMd: entry.body_md ?? "",
    reusableWhen: entry.reusable_when ?? null,
    nextCheck: entry.next_check ?? null,
    sourceKind: entry.source_kind,
    sourceRef: entry.source_ref ?? null,
    sourceExcerpt: entry.source_excerpt ?? null,
    confidence: Number(entry.confidence ?? 0.5),
    status: entry.status,
    metadataJson: entry.metadata_json ?? {},
    createdBy: entry.created_by ?? null,
    updatedBy: entry.updated_by ?? null,
    archivedAt: entry.archived_at ?? null,
    createdAt: entry.created_at,
    updatedAt: entry.updated_at,
  }));

  if (error) console.error("AdminManagementKnowledgePage:", error.message);

  return (
    <AdminManagementKnowledgeClient
      initialEntries={entries}
      projects={projects}
      initialError={error?.message ?? null}
    />
  );
}
