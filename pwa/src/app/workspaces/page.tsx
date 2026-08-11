import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { resolveWorkspaceAccess } from "@/lib/workspace-access-resolver";
import { externalWorkspaceRoleCapabilityLabel } from "@/lib/workspace-capabilities";

// External access hub for workspace_account principals. Institution membership never
// implies project access here — the projects section is scoped strictly to the
// project_access_memberships rows already resolved onto scopeSummary.projects.
export const dynamic = "force-dynamic";

type AuthorizedProject = {
  projectId: string;
  projectName: string;
  status: string;
  role: "manager" | "contributor" | "readonly";
};

type AuthorizedProjectLoad =
  | { status: "ok"; projects: AuthorizedProject[] }
  | { status: "error"; projects: [] };

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Supabase service role env vars are required");
  return createServiceClient(url, serviceKey);
}

async function getAuthorizedProjects(
  memberships: Array<{ projectId: string; role: "manager" | "contributor" | "readonly" }>,
): Promise<AuthorizedProjectLoad> {
  if (memberships.length === 0) return { status: "ok", projects: [] };

  try {
    const service = getServiceClient();
    const { data, error } = await service
      .from("projects")
      .select("project_id,project_name,status")
      .in("project_id", memberships.map((m) => m.projectId));

    if (error) {
      console.error("[workspaces] failed to load authorized projects:", error.message);
      return { status: "error", projects: [] };
    }

    const roleByProjectId = new Map(memberships.map((m) => [m.projectId, m.role]));
    return {
      status: "ok",
      projects: (data ?? [])
        .filter((row) => roleByProjectId.has(row.project_id))
        .map((row) => ({
          projectId: row.project_id,
          projectName: row.project_name,
          status: row.status,
          role: roleByProjectId.get(row.project_id)!,
        })),
    };
  } catch (error) {
    console.error("[workspaces] failed to initialize authorized project load:", error instanceof Error ? error.message : String(error));
    return { status: "error", projects: [] };
  }
}

export default async function WorkspacesPage() {
  // DB-revalidated every request — a stale/tampered cookie must never grant access.
  const scopeSummary = await resolveWorkspaceAccess();
  if (!scopeSummary) {
    redirect(`/auth/login?next=${encodeURIComponent("/workspaces")}&audience=institution`);
  }

  const projectLoad = await getAuthorizedProjects(scopeSummary.projects);

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-[#faf8f2] text-[#26251f]">
      <div className="sticky top-0 z-40 border-b border-[#e4ddcd] bg-[#faf8f2]/95 px-4 py-2.5 backdrop-blur sm:px-6" role="banner">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
            <span className="rounded-full border border-[#c7c0e0] bg-[#ecebf7] px-2.5 py-1 text-[#4338ca]">外部アクセス</span>
            <span className="text-[#26251f]">{scopeSummary.email}</span>
          </div>
          <Link
            href="/auth/logout"
            className="inline-flex min-h-11 items-center rounded-md border border-[#e4ddcd] px-3 py-2 text-[11px] font-semibold text-[#5c584d] hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#4338ca]"
          >
            ログアウト
          </Link>
        </div>
      </div>

      <div className="mx-auto flex max-w-3xl flex-col gap-10 px-4 py-10 sm:px-6">
        <section aria-labelledby="institution-workspaces-heading" className="space-y-4">
          <h2 id="institution-workspaces-heading" className="text-sm font-semibold text-[#4338ca]">
            研究機関ワークスペース
          </h2>
          {scopeSummary.institutionWorkspaces.length === 0 ? (
            <p className="text-sm text-[#5c584d]">参加中の研究機関ワークスペースはありません。</p>
          ) : (
            <ul className="divide-y divide-[#e4ddcd] rounded-lg border border-[#e4ddcd] bg-white">
              {scopeSummary.institutionWorkspaces.map((workspace) => (
                <li key={workspace.slug}>
                  <Link
                    href={`/workspace/${encodeURIComponent(workspace.slug)}`}
                    className="flex min-h-11 items-center justify-between gap-3 px-4 py-3 text-sm transition-colors hover:bg-[#f4f1e7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#4338ca]"
                  >
                    <span className="font-medium">{workspace.name}</span>
                    <span className="text-xs text-[#8a8574]">{externalWorkspaceRoleCapabilityLabel(workspace.role)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="projects-heading" className="space-y-4">
          <h2 id="projects-heading" className="text-sm font-semibold text-[#4338ca]">
            プロジェクト
          </h2>
          {projectLoad.status === "error" ? (
            <div role="alert" className="rounded-lg border border-[#d4a7a0] bg-[#fff4f2] px-4 py-4 text-sm text-[#7f2f27]">
              <p className="font-semibold">プロジェクト一覧を読み込めなかったよ。</p>
              <p className="mt-1 text-xs">参加状況が0件になったわけではないよ。時間を置いて再読み込みしてね。</p>
            </div>
          ) : projectLoad.projects.length === 0 ? (
            <p className="text-sm text-[#5c584d]">参加中のプロジェクトはありません。</p>
          ) : (
            <ul className="divide-y divide-[#e4ddcd] rounded-lg border border-[#e4ddcd] bg-white">
              {projectLoad.projects.map((project) => (
                <li key={project.projectId}>
                  <Link
                    href={`/project/${encodeURIComponent(project.projectId)}/workspace`}
                    className="flex min-h-11 items-center justify-between gap-3 px-4 py-3 text-sm transition-colors hover:bg-[#f4f1e7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#4338ca]"
                  >
                    <span className="font-medium">{project.projectName}</span>
                    <span className="text-xs text-[#8a8574]">
                      {externalWorkspaceRoleCapabilityLabel(project.role)} ・ PJ管理情報は閲覧のみ
                      {project.status !== "active" ? ` ・ ${project.status}` : ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
