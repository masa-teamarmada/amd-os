import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentMemberAccess } from "@/lib/project-workspace";
import { resolveDdViewerScope } from "@/lib/dd-access";
import { getWorkspaceAccessCandidateSession } from "@/lib/workspace-access-session";
import { DD_PACKAGE_STATUS_LABEL, type DdPackageStatus } from "@/lib/dd-package-core";

export const dynamic = "force-dynamic";

// DDの入口。外部アカウントは、閲覧できるパッケージが1つならそのトップへ、複数なら一覧を出す。
// AMD admin は全パッケージの管理者プレビューと管理画面への入口を見る。admin 以外の内部メンバーは開けない。
export default async function DdHomePage() {
  const member = await getCurrentMemberAccess();
  if (member) {
    if (!member.isAdmin) notFound();
    const db = createAdminClient();
    const { data, error } = await db
      .from("dd_packages")
      .select("id,slug,title,project_id,status,updated_at")
      .order("created_at");
    if (error) throw new Error(`dd package list: ${error.message}`);
    const packages = (data ?? []) as Array<{ id: string; slug: string; title: string; project_id: string; status: DdPackageStatus }>;
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 text-[#1d1d1f] sm:px-6">
        <h1 className="text-[18px] font-semibold">DDパッケージ（管理者）</h1>
        <p className="mt-1 text-[12px] text-[#6e6e73]">投資家・金融機関向けの開示面。管理者は未公開のパッケージもプレビューできる。</p>
        <table className="mt-4 w-full border-collapse text-[13px]">
          <thead>
            <tr className="text-left text-[11px] text-[#6e6e73]">
              <th className="px-2 py-1.5 font-medium">パッケージ</th>
              <th className="px-2 py-1.5 font-medium">状態</th>
              <th className="px-2 py-1.5 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {packages.map((pkg) => (
              <tr key={pkg.id} className="border-t border-[#f0f0f2]">
                <td className="px-2 py-2 font-semibold">{pkg.title}</td>
                <td className="px-2 py-2 text-[12px] text-[#424245]">{DD_PACKAGE_STATUS_LABEL[pkg.status]}</td>
                <td className="px-2 py-2 text-[12px]">
                  <Link href={`/dd/${encodeURIComponent(pkg.slug)}`} className="mr-3 text-[#0267b2] hover:underline">プレビュー</Link>
                  <Link href={`/project/${encodeURIComponent(pkg.project_id)}/dd`} className="text-[#0267b2] hover:underline">管理</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const scope = await resolveDdViewerScope();
  if (!scope) {
    // 署名済みの外部セッションがあるのに閲覧できるものが無い（停止・失効・期限切れ・受付終了）なら、存在を示さず閉じる。
    if (await getWorkspaceAccessCandidateSession()) notFound();
    redirect(`/auth/login?audience=institution&next=${encodeURIComponent("/dd")}`);
  }
  if (scope.packages.length === 1) redirect(`/dd/${encodeURIComponent(scope.packages[0].slug)}`);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 text-[#1d1d1f] sm:px-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-[18px] font-semibold">閲覧できるDD資料</h1>
        <a href="/auth/logout" className="rounded border border-[#d2d2d7] px-2 py-1 text-[12px] hover:bg-[#f5f5f7]">ログアウト</a>
      </div>
      <p className="mt-1 text-[12px] text-[#6e6e73]">{scope.email}</p>
      <ul className="mt-4 divide-y divide-[#f0f0f2] rounded-lg border border-[#e5e5e7]">
        {scope.packages.map((pkg) => (
          <li key={pkg.packageId} className="px-3 py-2.5">
            <Link href={`/dd/${encodeURIComponent(pkg.slug)}`} className="text-[14px] font-semibold text-[#0267b2] hover:underline">
              {pkg.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
