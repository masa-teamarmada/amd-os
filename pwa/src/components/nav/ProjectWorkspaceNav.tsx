"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DoorOpen, FlaskConical, Layers3, LogOut, UserRound } from "lucide-react";
import { BUILD_VERSION } from "@/lib/build-info";
import type { ProjectNavItem } from "@/lib/project-workspace-types";
import { cn } from "@/lib/utils";

export function ProjectWorkspaceNav({
  userCodeName,
  projects,
}: {
  userCodeName: string;
  projects: ProjectNavItem[];
}) {
  const pathname = usePathname() || "";

  const signOut = () => {
    window.location.assign("/auth/project-logout");
  };

  return (
    <aside className="fixed inset-x-0 bottom-0 z-50 flex h-16 w-full shrink-0 items-center border-t border-[#d9d2c3] bg-[#fffdf7]/95 px-2 py-1 backdrop-blur lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:flex-col lg:items-stretch lg:border-r lg:border-t-0 lg:px-4 lg:py-3">
      <Link
        href={projects.length === 1 ? `/project/${encodeURIComponent(projects[0].projectId)}/workspace` : "/my-projects"}
        className="mb-4 hidden h-12 items-center justify-center gap-3 rounded-lg px-2 text-[#24231f] transition-colors hover:bg-[#f1eee4] lg:flex lg:justify-start"
        title={`AMD OS PJ workspace / ${BUILD_VERSION}`}
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#215c49] text-white">
          <FlaskConical className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="hidden min-w-0 lg:block">
          <span className="block truncate text-sm font-semibold">PJ Workspace</span>
          <span className="block font-mono text-[10px] text-[#8b8578]">{BUILD_VERSION}</span>
        </span>
      </Link>

      <nav className="flex min-w-0 flex-1 items-center justify-center gap-1 overflow-x-auto lg:min-h-0 lg:flex-col lg:items-stretch lg:justify-start lg:space-y-1 lg:overflow-y-auto" aria-label="参加プロジェクト">
        <p className="hidden px-3 pb-1 text-[11px] font-semibold text-[#8b8578] lg:block">参加PJ</p>
        {projects.length > 1 && (
          <Link
            href="/my-projects"
            className={cn(
              "flex min-h-12 min-w-16 flex-col items-center justify-center gap-1 rounded-md px-2 text-[10px] font-medium transition-colors lg:h-9 lg:min-h-0 lg:min-w-0 lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:text-sm",
              pathname === "/my-projects" ? "bg-[#245f84] text-white" : "text-[#69665d] hover:bg-[#f1eee4] hover:text-[#24231f]",
            )}
          >
            <Layers3 className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>PJ一覧</span>
          </Link>
        )}
        {projects.map((project) => {
          const href = `/project/${encodeURIComponent(project.projectId)}/workspace`;
          const active = pathname === href;
          return (
            <Link
              key={project.projectId}
              href={href}
              title={project.projectName}
              className={cn(
                "flex min-h-12 min-w-16 flex-col items-center justify-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-colors lg:min-h-9 lg:min-w-0 lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:py-2 lg:text-sm",
                active ? "bg-[#245f84] text-white" : "text-[#69665d] hover:bg-[#f1eee4] hover:text-[#24231f]",
              )}
            >
              <DoorOpen className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="max-w-20 truncate lg:max-w-none">{project.projectName}</span>
            </Link>
          );
        })}
      </nav>

      <div className="flex shrink-0 items-center border-l border-[#d9d2c3] pl-1 lg:mt-auto lg:block lg:space-y-1 lg:border-l-0 lg:border-t lg:pl-0 lg:pt-2">
        <div className="hidden h-9 items-center justify-center gap-3 rounded-md px-2 text-sm text-[#69665d] lg:flex lg:justify-start lg:px-3">
          <UserRound className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="hidden min-w-0 truncate lg:inline">{userCodeName}</span>
        </div>
        <button
          type="button"
          onClick={signOut}
          className="flex h-12 min-w-14 flex-col items-center justify-center gap-1 rounded-md px-2 text-[10px] font-medium text-[#69665d] transition-colors hover:bg-[#f1eee4] hover:text-[#24231f] lg:h-9 lg:w-full lg:min-w-0 lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:text-sm"
        >
          <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>ログアウト</span>
        </button>
      </div>
    </aside>
  );
}
