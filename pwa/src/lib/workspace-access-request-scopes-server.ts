import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { accessRequestScopeChoices } from "./workspace-access-request-scopes";

export async function loadAccessRequestScopeChoices(db: SupabaseClient) {
  const [workspaces, projects, packages] = await Promise.all([
    db.from("institution_workspaces").select("slug,name,status").eq("status", "active").order("name").limit(101),
    db.from("projects").select("project_id,project_name").order("project_id").limit(101),
    db.from("dd_packages").select("id,title,project_id,status").eq("status", "open").order("title").limit(101),
  ]);
  if (workspaces.error || projects.error || packages.error) throw new Error("access_request_scope_lookup_failed");
  const choices = accessRequestScopeChoices({ institutionWorkspaces: workspaces.data ?? [], projects: projects.data ?? [], ddPackages: packages.data ?? [] });
  if (!choices.length || choices.length > 100) throw new Error("access_request_scope_choice_limit");
  return choices;
}
