/**
 * AMD OS PWA build info
 *
 * コード修正で deploy するたびに必ず patch を bump up する。
 * 画面左上 (GlobalNav の "AMD OS" ロゴ直下) に表示され、
 * キャッシュが効いてリロードが効いてないことを目視で判別できるようにするための運用ルール。
 *
 * 仕様は pwa/CLAUDE.md の「🔢 build version の bump up」セクションを参照。
 */
export const BUILD_VERSION = "v0.15.18";

export type PublicBuildInfo = {
  build_version: string;
  git_sha: string;
  git_branch: string;
  deployed_at: string;
  dirty: boolean;
};

const GIT_SHA = process.env.NEXT_PUBLIC_AMD_OS_GIT_SHA || "unknown";
const GIT_BRANCH = process.env.NEXT_PUBLIC_AMD_OS_GIT_BRANCH || "unknown";
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
