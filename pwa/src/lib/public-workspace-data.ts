import "server-only";

import { createClient as createServiceClient } from "@supabase/supabase-js";

// Public top-page listing only. institution_workspaces has no anon/authenticated RLS
// policy (see scripts/migrations/212_workspace_access_foundation.sql section 9 — admin +
// service_role only), so this must always go through the service role client, and the
// DTO returned here must stay limited to what's safe to show an anonymous visitor:
// slug/name + institutions.name/type/region. Never add description, seed/project counts,
// ECR/AMD Score, or any other institution_assessments-derived figure to this surface.
export type PublicInstitutionWorkspace = {
  slug: string;
  name: string;
  institution: {
    name: string;
    type: string;
    region: string | null;
  };
};

type PublicWorkspaceRow = {
  slug: string;
  name: string;
  institutions: { name: string; type: string; region: string | null } | null;
};

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Supabase service role env vars are required");
  return createServiceClient(url, serviceKey);
}

export async function getPublicInstitutionWorkspaces(): Promise<PublicInstitutionWorkspace[]> {
  const service = getServiceClient();

  const { data, error } = await service
    .from("institution_workspaces")
    .select("slug,name,institutions(name,type,region)")
    .eq("status", "active")
    .eq("is_publicly_listed", true)
    .order("name", { ascending: true })
    .returns<PublicWorkspaceRow[]>();

  if (error) {
    console.warn("[public-workspace-data] failed to load public workspaces:", error.message);
    return [];
  }

  return (data ?? [])
    .filter((row): row is PublicWorkspaceRow & { institutions: NonNullable<PublicWorkspaceRow["institutions"]> } => row.institutions !== null)
    .map((row) => ({
      slug: row.slug,
      name: row.name,
      institution: {
        name: row.institutions.name,
        type: row.institutions.type,
        region: row.institutions.region,
      },
    }));
}
