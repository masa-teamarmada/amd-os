import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import {
  AdminPrivateWikiClient,
  type PrivateWikiEntry,
  type PrivateWikiProject,
} from "@/components/admin/AdminPrivateWikiClient";

export const metadata: Metadata = { title: { absolute: "Admin 裏wiki - AMD OS" } };

export default async function AdminPrivateWikiPage() {
  const supabase = await createClient();

  const [{ data: projectData }, { data: wikiData, error }] = await Promise.all([
    supabase
      .from("projects")
      .select("project_id, project_name, status")
      .order("status")
      .order("project_name"),
    supabase
      .from("private_wiki_entries")
      .select("*")
      .order("project_id", { ascending: true, nullsFirst: true })
      .order("updated_at", { ascending: false })
      .limit(500),
  ]);

  const projects: PrivateWikiProject[] = (projectData ?? []).map((project) => ({
    projectId: project.project_id,
    projectName: project.project_name,
    status: project.status ?? null,
  }));

  const entries: PrivateWikiEntry[] = (wikiData ?? []).map((entry) => ({
    id: entry.id,
    projectId: entry.project_id ?? null,
    personName: entry.person_name,
    personKind: entry.person_kind,
    affiliation: entry.affiliation ?? null,
    relationshipContext: entry.relationship_context ?? null,
    birthdayLabel: entry.birthday_label ?? null,
    originLabel: entry.origin_label ?? null,
    residenceLabel: entry.residence_label ?? null,
    contactContext: entry.contact_context ?? null,
    familyNote: entry.family_note ?? null,
    tabooNote: entry.taboo_note ?? null,
    memoBody: entry.memo_body ?? "",
    sourceKind: entry.source_kind,
    sourceRef: entry.source_ref ?? null,
    sourceExcerpt: entry.source_excerpt ?? null,
    confidence: Number(entry.confidence ?? 0.5),
    visibility: entry.visibility ?? "admin_private",
    status: entry.status,
    createdBy: entry.created_by ?? null,
    updatedBy: entry.updated_by ?? null,
    archivedAt: entry.archived_at ?? null,
    createdAt: entry.created_at,
    updatedAt: entry.updated_at,
  }));

  if (error) console.error("AdminPrivateWikiPage:", error.message);

  return (
    <AdminPrivateWikiClient
      initialEntries={entries}
      projects={projects}
      initialError={error?.message ?? null}
    />
  );
}
