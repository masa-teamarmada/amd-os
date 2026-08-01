import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentMemberAccess, memberHome } from "@/lib/project-workspace";
import { resolveWorkspaceAccess } from "@/lib/workspace-access-resolver";
import { getPublicInstitutionWorkspaces } from "@/lib/public-workspace-data";
import { INSTITUTION_TYPE_LABEL } from "@/lib/ers";

export default async function Home() {
  // Already-authenticated principals skip the public landing entirely — this page only
  // needs to greet anonymous visitors. Order matters: internal member session first
  // (unchanged pre-existing behavior), then external workspace_account session.
  const memberAccess = await getCurrentMemberAccess();
  if (memberAccess) redirect(memberHome(memberAccess));

  const workspaceAccess = await resolveWorkspaceAccess();
  if (workspaceAccess) redirect("/workspaces");

  const workspaces = await getPublicInstitutionWorkspaces();

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-[#faf8f2] text-[#26251f]">
      <div className="mx-auto flex max-w-3xl flex-col gap-10 px-4 py-16 sm:px-6">
        <header className="space-y-2 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#4338ca]">AMD OS</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Team ARMADA Business Operating System
          </h1>
        </header>

        <section aria-labelledby="institution-workspaces-heading" className="space-y-4">
          <h2 id="institution-workspaces-heading" className="text-sm font-semibold text-[#4338ca]">
            研究機関ワークスペース
          </h2>
          {workspaces.length === 0 ? (
            <p className="text-sm text-[#5c584d]">現在公開中のワークスペースはありません。</p>
          ) : (
            <ul className="divide-y divide-[#e4ddcd] rounded-lg border border-[#e4ddcd] bg-white">
              {workspaces.map((workspace) => (
                <li key={workspace.slug}>
                  <Link
                    href={`/auth/login?audience=institution&workspace=${encodeURIComponent(workspace.slug)}&next=${encodeURIComponent(`/workspace/${workspace.slug}`)}`}
                    className="flex min-h-11 items-center justify-between gap-3 px-4 py-3 text-sm transition-colors hover:bg-[#f4f1e7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#4338ca]"
                  >
                    <span className="font-medium">{workspace.name}</span>
                    <span className="text-xs text-[#8a8574]">
                      {INSTITUTION_TYPE_LABEL[workspace.institution.type] ?? workspace.institution.type}
                      {workspace.institution.region ? ` ・ ${workspace.institution.region}` : ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section
          aria-labelledby="armada-heading"
          className="space-y-3 rounded-lg border border-[#e4ddcd] bg-white px-4 py-5 text-center"
        >
          <h2 id="armada-heading" className="text-sm font-semibold text-[#4338ca]">
            ARMADAメンバー
          </h2>
          <p className="text-sm text-[#5c584d]">社内メンバーはこちらからログインしてください。</p>
          <Link
            href="/auth/login?audience=armada"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-[#4338ca] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#3730a3] sm:w-auto"
          >
            ARMADAメンバーとしてログイン
          </Link>
        </section>
      </div>
    </div>
  );
}
