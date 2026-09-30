import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentMemberAccess } from "@/lib/project-workspace";
import { getWorkspaceAccessCandidateSession } from "@/lib/workspace-access-session";
import {
  DD_CAPABILITIES,
  buildDdViewerScope,
  isDdSlug,
  type DdAccountRow,
  type DdGrantRow,
  type DdGrantStatus,
  type DdPackageStatus,
  type DdViewerAccess,
  type DdViewerScope,
} from "@/lib/dd-package-core";

// DD（投資家・金融機関向けの開示面）の入口判定。
//
// - 外部アカウントは、署名 cookie を読んだあと毎回 DB を引き直す（停止・失効・期限切れ・パッケージの受付終了は次のリクエストで効く）。
// - DDへ入れる根拠は dd_package_grants だけ。project_access_memberships / institution_workspace_memberships はここでは読まない。
// - AMD の admin は、未公開（draft）を含むすべてのパッケージを管理者プレビューとして開ける。admin 以外の内部メンバーは DD を開けない。
// - どの失敗も null に倒す。呼び出し側は「見つからない」として閉じ、パッケージの有無を漏らさない。

type PackageRow = { id: string; slug: string; project_id: string; title: string; status: DdPackageStatus };
type GrantRowRaw = {
  id: string;
  package_id: string;
  status: DdGrantStatus;
  capabilities: unknown;
  expires_at: string | null;
};

const PACKAGE_FIELDS = "id,slug,project_id,title,status";

/** 付与行に、同じ時点で読んだパッケージ行を結び付ける。パッケージが読めない付与は package=null（数えない）。 */
function attachPackages(grants: GrantRowRaw[], packages: PackageRow[]): DdGrantRow[] {
  const byId = new Map(packages.map((pkg) => [pkg.id, pkg]));
  return grants.map((grant) => ({
    id: grant.id,
    status: grant.status,
    capabilities: grant.capabilities,
    expires_at: grant.expires_at,
    package: byId.get(grant.package_id) ?? null,
  }));
}

async function loadGrantsWithPackages(accountId: string): Promise<DdGrantRow[]> {
  const db = createAdminClient();
  const { data: grants, error: grantError } = await db
    .from("dd_package_grants")
    .select("id,package_id,status,capabilities,expires_at")
    .eq("user_account_id", accountId);
  if (grantError) throw new Error(`dd grant lookup: ${grantError.message}`);
  const rows = (grants ?? []) as GrantRowRaw[];
  if (rows.length === 0) return [];
  const { data: packages, error: packageError } = await db
    .from("dd_packages")
    .select(PACKAGE_FIELDS)
    .in("id", Array.from(new Set(rows.map((row) => row.package_id))));
  if (packageError) throw new Error(`dd package lookup: ${packageError.message}`);
  return attachPackages(rows, (packages ?? []) as PackageRow[]);
}

export async function resolveDdViewerScopeForAccount(
  accountId: string,
  normalizedEmail: string,
  nowMs: number = Date.now(),
): Promise<DdViewerScope | null> {
  const db = createAdminClient();
  const [{ data: account, error: accountError }, grants] = await Promise.all([
    db
      .from("workspace_user_accounts")
      .select("id,email_normalized,auth_user_id,status")
      .eq("id", accountId)
      .maybeSingle<DdAccountRow>(),
    loadGrantsWithPackages(accountId),
  ]);
  if (accountError) throw new Error(`dd account lookup: ${accountError.message}`);
  return buildDdViewerScope(account ?? null, normalizedEmail, grants, nowMs);
}

/** 署名 cookie の外部アカウントについて、今見られる DD パッケージの一覧（DB 再検証済み）。 */
export async function resolveDdViewerScope(): Promise<DdViewerScope | null> {
  const session = await getWorkspaceAccessCandidateSession();
  if (!session) return null;
  return resolveDdViewerScopeForAccount(session.accountId, session.email);
}

async function loadPackageBySlug(slug: string): Promise<PackageRow | null> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("dd_packages")
    .select(PACKAGE_FIELDS)
    .eq("slug", slug)
    .maybeSingle<PackageRow>();
  if (error) throw new Error(`dd package lookup: ${error.message}`);
  return data ?? null;
}

/**
 * 1つのパッケージを開いてよいかを決める。ページ・ファイル配信・ダウンロードのすべてがここを通る。
 * 順序: AMD admin（管理者プレビュー） → 外部アカウントの DD 閲覧権限。どちらでもなければ null。
 */
export async function resolveDdPackageAccess(slug: string): Promise<DdViewerAccess | null> {
  if (!isDdSlug(slug)) return null;

  const member = await getCurrentMemberAccess();
  if (member?.isAdmin) {
    const pkg = await loadPackageBySlug(slug);
    if (!pkg) return null;
    return {
      principal: "internal_admin",
      memberId: member.memberId,
      email: member.email,
      packageId: pkg.id,
      slug: pkg.slug,
      projectId: pkg.project_id,
      title: pkg.title,
      packageStatus: pkg.status,
      capabilities: DD_CAPABILITIES,
      preview: true,
    };
  }

  const scope = await resolveDdViewerScope();
  const pkg = scope?.packages.find((item) => item.slug === slug);
  if (!scope || !pkg) return null;
  return {
    principal: "workspace_account",
    accountId: scope.accountId,
    email: scope.email,
    grantId: pkg.grantId,
    packageId: pkg.packageId,
    slug: pkg.slug,
    projectId: pkg.projectId,
    title: pkg.title,
    packageStatus: "open",
    capabilities: pkg.capabilities,
    preview: false,
  };
}

/** /api/auth/email-start と /auth/callback が使う。ログイン可否の判定に要る列だけを読む。 */
export async function loadDdGrantsForLogin(accountId: string): Promise<DdGrantRow[]> {
  return loadGrantsWithPackages(accountId);
}
