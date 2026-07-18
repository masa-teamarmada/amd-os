import Link from "next/link";
import { ArrowRight, FlaskConical } from "lucide-react";
import { getCurrentMemberAccess } from "@/lib/project-workspace";

export default async function MyProjectsPage() {
  const access = await getCurrentMemberAccess();

  return (
    <div className="amd-desk-page-skin min-h-screen px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 max-w-2xl">
          <p className="mb-2 text-xs font-semibold tracking-[0.14em] text-[#256c55]">PROJECT WORKSPACE</p>
          <h1 className="text-2xl font-semibold tracking-tight text-[#24231f] sm:text-3xl">参加しているプロジェクト</h1>
          <p className="mt-3 text-sm leading-6 text-[#69665d]">
            ここには参加設定されたPJだけが表示されるよ。ほかのPJやAMD社内の管理情報は表示されない。
          </p>
        </div>

        {access && access.projects.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {access.projects.map((project) => (
              <Link
                key={project.projectId}
                href={`/project/${encodeURIComponent(project.projectId)}/workspace`}
                className="group rounded-xl border border-[#d9d2c3] bg-[#fffdf7]/90 p-5 transition hover:-translate-y-0.5 hover:border-[#256c55]/50 hover:shadow-[0_10px_30px_rgba(46,54,45,0.08)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#dfeee6] text-[#256c55]">
                    <FlaskConical className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <ArrowRight className="h-4 w-4 text-[#928d82] transition-transform group-hover:translate-x-1 group-hover:text-[#256c55]" aria-hidden="true" />
                </div>
                <h2 className="mt-6 text-lg font-semibold text-[#24231f]">{project.projectName}</h2>
                <p className="mt-1 font-mono text-xs text-[#928d82]">{project.projectId}</p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-[#c7bfaf] bg-[#fffdf7]/70 px-6 py-12 text-center">
            <p className="text-sm font-medium text-[#24231f]">参加PJがまだ設定されてないよ</p>
            <p className="mt-2 text-xs text-[#69665d]">PJ管理者にメンバー設定を確認してもらってね。</p>
          </div>
        )}
      </div>
    </div>
  );
}
