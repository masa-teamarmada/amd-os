/**
 * AMD OS PWA build info
 *
 * コード修正で deploy するたびに必ず patch を bump up する。
 * 画面左上 (GlobalNav / AdminSidebar) に表示され、
 * キャッシュが効いてリロードが効いてないことを目視で判別できるようにするための運用ルール。
 *
 * 仕様は pwa/CLAUDE.md の「🔢 build version の bump up」セクションを参照。
 */
export const BUILD_VERSION = "v3.83.2";

export type PublicBuildInfo = {
  build_version: string;
  git_sha: string;
  git_branch: string;
  deployed_at: string;
  dirty: boolean;
};

// CLI deploy 廃止 (2026-06-12) 後は Vercel Git deploy のシステム環境変数を一次ソースにする。
// 旧 NEXT_PUBLIC_AMD_OS_* は CLI deploy 時代の注入値で、互換のため先に見る。
const GIT_SHA =
  process.env.NEXT_PUBLIC_AMD_OS_GIT_SHA ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
  "unknown";
const GIT_BRANCH =
  process.env.NEXT_PUBLIC_AMD_OS_GIT_BRANCH ||
  process.env.VERCEL_GIT_COMMIT_REF ||
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF ||
  "unknown";
const DEPLOYED_AT = process.env.NEXT_PUBLIC_AMD_OS_DEPLOYED_AT || "unknown";
const DIRTY = process.env.NEXT_PUBLIC_AMD_OS_DIRTY === "true";

export function getPublicBuildInfo(): PublicBuildInfo {
  return {
    build_version: BUILD_VERSION,
    git_sha: GIT_SHA,
    git_branch: GIT_BRANCH,
    deployed_at: DEPLOYED_AT,
    dirty: DIRTY,
  };
}
