import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentMemberAccess } from "@/lib/project-workspace";
import {
  DD_CAPABILITY_LABEL,
  DD_GRANT_STATUS_LABEL,
  DD_PACKAGE_STATUS_LABEL,
  normalizeDdCapabilities,
  type DdGrantStatus,
  type DdPackageStatus,
} from "@/lib/dd-package-core";
import { formatDdDate } from "@/lib/dd-format";

// 外部アクセス台帳（/admin/access）の中の、DD閲覧権限の一覧。ここは読むだけで、付与・停止・失効は各DDパッケージの管理画面で行う。
// DDの閲覧権限はワークスペース・機関の所属とは別の付与なので、上の3区分とは混ぜずに別の表で出す。
export async function DdGrantLedger() {
  // /admin の枠でも admin を確かめているが、この部品だけを別の場所へ置いても開かないよう、ここでも確かめる。
  const member = await getCurrentMemberAccess();
  if (!member?.isAdmin) return null;
  const db = createAdminClient();
  const [packagesRes, grantsRes] = await Promise.all([
    db.from("dd_packages").select("id,project_id,slug,title,status").order("created_at"),
    db
      .from("dd_package_grants")
      .select("id,package_id,user_account_id,status,capabilities,organization_name,expires_at,updated_at")
      .order("updated_at", { ascending: false })
      .limit(1000),
  ]);
  if (packagesRes.error || grantsRes.error) {
    return (
      <p role="alert" className="mt-6 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        DD閲覧権限の一覧を読み込めなかった。付与の状態は変わっていない。再読み込みする。
      </p>
    );
  }
  const packages = (packagesRes.data ?? []) as Array<{ id: string; project_id: string; slug: string; title: string; status: DdPackageStatus }>;
  const grants = (grantsRes.data ?? []) as Array<{
    id: string;
    package_id: string;
    user_account_id: string;
    status: DdGrantStatus;
    capabilities: unknown;
    organization_name: string | null;
    expires_at: string | null;
    updated_at: string;
  }>;
  const accountIds = Array.from(new Set(grants.map((grant) => grant.user_account_id)));
  const { data: accounts } = accountIds.length > 0
    ? await db.from("workspace_user_accounts").select("id,email").in("id", accountIds)
    : { data: [] as Array<{ id: string; email: string }> };
  const emailById = new Map((accounts ?? []).map((account) => [String(account.id), String(account.email)]));
  const packageById = new Map(packages.map((pkg) => [pkg.id, pkg]));

  return (
    <section className="mt-8 space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">DD閲覧権限（投資家・金融機関）</h2>
        <span className="text-xs text-muted-foreground">
          ワークスペース・機関の所属とは別の付与。DDの権限だけではワークスペースにもコックピットにも入れない。付与・停止・失効は各パッケージの管理画面で行う。
        </span>
      </div>
      <ul className="flex flex-wrap gap-2 text-xs">
        {packages.map((pkg) => (
          <li key={pkg.id} className="rounded border border-border px-2 py-1">
            <span className="font-semibold">{pkg.title}</span>
            <span className="ml-1 text-muted-foreground">{DD_PACKAGE_STATUS_LABEL[pkg.status]}</span>
            <Link href={`/project/${encodeURIComponent(pkg.project_id)}/dd?tab=manage`} className="ml-2 text-[#0267b2] hover:underline">管理</Link>
          </li>
        ))}
      </ul>
      {grants.length === 0 ? (
        <p className="text-xs text-muted-foreground">DDの閲覧権限はまだ誰にも付与していない。</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-xs">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="px-2 py-1 font-medium">メールアドレス・所属</th>
                <th className="px-2 py-1 font-medium">パッケージ</th>
                <th className="px-2 py-1 font-medium">状態</th>
                <th className="px-2 py-1 font-medium">できる操作</th>
                <th className="px-2 py-1 font-medium">期限</th>
              </tr>
            </thead>
            <tbody>
              {grants.map((grant) => (
                <tr key={grant.id} className="border-t border-border">
                  <td className="px-2 py-1.5">
                    {emailById.get(grant.user_account_id) ?? "（アカウント不明）"}
                    {grant.organization_name && <span className="ml-1 text-muted-foreground">{grant.organization_name}</span>}
                  </td>
                  <td className="px-2 py-1.5">{packageById.get(grant.package_id)?.title ?? "—"}</td>
                  <td className="px-2 py-1.5">{DD_GRANT_STATUS_LABEL[grant.status]}</td>
                  <td className="px-2 py-1.5">
                    {normalizeDdCapabilities(grant.capabilities).map((capability) => DD_CAPABILITY_LABEL[capability]).join("・")}
                  </td>
                  <td className="px-2 py-1.5">{grant.expires_at ? formatDdDate(grant.expires_at) : "なし"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
