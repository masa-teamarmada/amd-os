import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentMemberAccess } from "@/lib/project-workspace";
import { resolveSharedWorkspaceAccess } from "@/lib/project-shared-workspace-access";
import { memberSurfacePermission } from "@/lib/project-surface-permissions";
import { resolveDdPackageAccess } from "@/lib/dd-access";
import { getSurfaceByPath } from "@/lib/surface-catalog";
import { allowedProjectPageLabel, deduplicatePageViewers, PAGE_VIEWING_EXPIRY_MS, type PageViewingInput, type PageViewingSnapshot } from "@/lib/page-viewing-core";

type Context = { actorKey: string; actorLabel: string; resourceKey: string; title: string; ownHistoryOnly: boolean };

async function accountLabel(id: string) {
  const { data, error } = await createAdminClient().from("workspace_user_accounts").select("display_name").eq("id", id).maybeSingle();
  if (error) throw new Error("page viewer identity lookup failed");
  // Registered display names only. Never expose the email used for authentication.
  return String(data?.display_name || "氏名未登録");
}

/** Every request revalidates the existing surface-specific authorization. */
export async function resolvePageViewingContext(input: PageViewingInput): Promise<Context | null> {
  const db = createAdminClient();
  const member = await getCurrentMemberAccess();
  let actorKey = member ? `member:${member.memberId}` : "";
  let actorLabel = member?.codeName || member?.displayName || "";
  let title: string;
  let label = input.pageLabel;
  let ownHistoryOnly = false;
  const projectMatch = input.pathname.match(/^\/project\/([a-zA-Z0-9_-]+)\/(cockpit|workspace)(\/files)?$/);
  const ddMatch = input.pathname.match(/^\/dd\/([a-zA-Z0-9_-]+)(?:\/items\/([a-zA-Z0-9_-]+))?$/);
  const ddAdminMatch = input.pathname.match(/^\/project\/([a-zA-Z0-9_-]+)\/dd$/);
  if (projectMatch) {
    const [, projectId, surface, files] = projectMatch;
    if (files && surface !== "workspace") return null;
    if (surface === "cockpit") {
      if (!member || !memberSurfacePermission(member, projectId, "cockpit")) return null;
    } else {
      const access = await resolveSharedWorkspaceAccess(projectId);
      if (!access) return null;
      if (access.principal === "workspace_account") {
        actorKey = `account:${access.accountId}`;
        actorLabel = await accountLabel(access.accountId);
        ownHistoryOnly = true;
      }
    }
    const { data: project, error } = await db.from("projects").select("project_name,project_category").eq("project_id", projectId).maybeSingle();
    if (error) throw new Error("page viewer project lookup failed");
    if (!project) return null;
    label = files ? "資料室" : allowedProjectPageLabel(surface as "cockpit" | "workspace", label, { projectId, projectCategory: project.project_category }, ownHistoryOnly) || "";
    if (!label) return null;
    title = `${project.project_name}｜${surface === "cockpit" ? "コックピット" : "ワークスペース"}｜${label}`;
  } else if (ddMatch) {
    const access = await resolveDdPackageAccess(ddMatch[1]);
    if (!access) return null;
    if (access.principal === "workspace_account") {
      actorKey = `account:${access.accountId}`;
      actorLabel = await accountLabel(access.accountId);
      ownHistoryOnly = true;
    }
    if (ddMatch[2]) {
      const { data: item, error } = await db.from("dd_package_items").select("package_id,is_published,status").eq("id", ddMatch[2]).maybeSingle();
      if (error) throw new Error("page viewer DD item lookup failed");
      if (!item || item.package_id !== access.packageId || item.status !== "active" || (!access.preview && !item.is_published)) return null;
    }
    label = allowedProjectPageLabel("dd", label, { projectId: access.projectId }) || "";
    if (!label) return null;
    title = `${access.title}｜DD｜${label}`;
  } else if (ddAdminMatch) {
    if (!member || !memberSurfacePermission(member, ddAdminMatch[1], "dd")) return null;
    title = "DDパッケージ管理";
    label = "";
  } else {
    if (!member || (member.scope !== "portfolio" && input.pathname !== "/my-projects")) return null;
    const surface = getSurfaceByPath(input.pathname);
    if (!surface || surface.status === "deprecated" || ["login", "admin-fallback", "project-cockpit", "dd-packages", "institution-workspace", "external-workspaces"].includes(surface.id)) return null;
    if (input.pathname.startsWith("/admin") && !member.isAdmin) return null;
    // Personal and finance screens carry a per-person namespace.
    ownHistoryOnly = ["mypage", "monthly-agreement", "contracts-member", "reimburse", "notifications", "my-projects"].includes(surface.id);
    label = "";
    title = surface.title;
  }
  if (!actorKey) return null;
  const resourceKey = JSON.stringify([input.pathname, label, ownHistoryOnly && !projectMatch && !ddMatch ? actorKey : ""]);
  return { actorKey, actorLabel, resourceKey, title, ownHistoryOnly };
}

export async function readPageViewingSnapshot(context: Context, includeHistory: boolean): Promise<PageViewingSnapshot> {
  const db = createAdminClient();
  const { data: rows, error } = await db.from("os_page_viewer_sessions")
    .select("actor_key,actor_label").eq("resource_key", context.resourceKey).eq("active", true)
    .gt("last_seen_at", new Date(Date.now() - PAGE_VIEWING_EXPIRY_MS).toISOString()).order("last_seen_at", { ascending: false }).limit(201);
  if (error) throw new Error("page viewers read failed");
  const snapshot: PageViewingSnapshot = { title: context.title, viewers: deduplicatePageViewers((rows ?? []).slice(0, 200), context.actorKey), ownHistoryOnly: context.ownHistoryOnly, truncated: (rows?.length ?? 0) > 200 };
  if (includeHistory) {
    let query = db.from("os_page_viewing_visits").select("visit_id,actor_key,actor_label,started_at,last_seen_at").eq("resource_key", context.resourceKey).order("started_at", { ascending: false }).limit(50);
    if (context.ownHistoryOnly) query = query.eq("actor_key", context.actorKey);
    const { data: visits, error: historyError } = await query;
    if (historyError) throw new Error("page visits read failed");
    snapshot.history = (visits ?? []).map(v => ({ id: v.visit_id, label: v.actor_label, self: v.actor_key === context.actorKey, startedAt: v.started_at, lastSeenAt: v.last_seen_at }));
  }
  return snapshot;
}
