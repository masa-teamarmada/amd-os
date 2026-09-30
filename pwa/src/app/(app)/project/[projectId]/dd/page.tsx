import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentMemberAccess } from "@/lib/project-workspace";
import { loadDdAdminState } from "@/lib/dd-package-server";
import { listDdSourceCandidates } from "@/lib/dd-sources";
import { DdAdminPanel } from "@/components/dd/DdAdminPanel";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// PJのDDパッケージの管理画面（AMD admin 限定）。掲載項目の選択・公開・取り下げと、閲覧権限の招待・停止・失効を行う。
// 外部アカウント・PJ限定メンバー・admin 以外の内部メンバーには「見つからない」を返す。
export default async function ProjectDdAdminPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const member = await getCurrentMemberAccess();
  if (!member?.isAdmin || member.scope !== "portfolio") notFound();

  const [state, candidates] = await Promise.all([loadDdAdminState(projectId), listDdSourceCandidates(projectId)]);
  if (!state) {
    return (
      <div className="space-y-2 text-[13px] text-[#1d1d1f]">
        <h1 className="text-[18px] font-semibold">DDパッケージ</h1>
        <p className="text-[#6e6e73]">このPJにはDDパッケージがまだない。</p>
        <Link href={`/project/${encodeURIComponent(projectId)}/cockpit`} className="text-[#0267b2] hover:underline">
          コックピットへ戻る
        </Link>
      </div>
    );
  }

  return <DdAdminPanel state={state} candidates={candidates} projectId={projectId} />;
}
