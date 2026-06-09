#!/usr/bin/env bash
# AMD OS PWA — 本番 deploy + Build 完了 macOS 通知
#
# 使い方: ./pwa/scripts/deploy.sh   (リポ root から実行)
#
# 動作:
#   1. Vercel CLI で production deploy をトリガー (build queue に投入)
#   2. Build が "Ready" になるまで polling (最大 10 分)
#   3. 完了したら macOS 通知センターで「ピコン」と通知
#   4. 失敗したら警告音 + エラー通知
#
# Claude / えいみ向けルール:
#   - 今後 PWA を deploy するときは必ずこのスクリプト経由で行う
#   - 直接 `npx vercel --prod --yes ...` を叩かない (通知が出ないので)
#   - Vercel deploy approval gate 中は、deploy bundleを作って
#     askuserquestionで承認を取った後だけ実行する。
#   - 承認後だけ `AMD_OS_VERCEL_DEPLOY_APPROVED=1` を付けて実行する。

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SCOPE="armada0130"
PROJECT="amd-os-pwa"
APP_URL="https://amd-os-pwa.vercel.app"
TARGET="production"
DRY_RUN=0

cd "$REPO_ROOT"

while [ $# -gt 0 ]; do
  case "$1" in
    --prod|--production)
      TARGET="production"
      ;;
    --preview)
      TARGET="preview"
      ;;
    --dry-run)
      DRY_RUN=1
      ;;
    --help)
      cat <<'EOF'
Usage: bash pwa/scripts/deploy.sh [--prod|--preview] [--dry-run]

Default is production deploy. --dry-run runs the rollback guard and build stamp
preparation only; it never calls Vercel.
EOF
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
  shift
done

if [ "$TARGET" != "production" ] && [ "$TARGET" != "preview" ]; then
  echo "Invalid target: $TARGET" >&2
  exit 1
fi

echo "Running deploy rollback guard ..."
node "$SCRIPT_DIR/deploy-version-guard.cjs" --target "$TARGET" --app-url "$APP_URL" --repo-root "$REPO_ROOT"

BUILD_STAMP_GIT_SHA=$(git rev-parse --short=12 HEAD)
BUILD_STAMP_GIT_BRANCH=$(git branch --show-current)
if [ -z "$BUILD_STAMP_GIT_BRANCH" ]; then
  BUILD_STAMP_GIT_BRANCH=$(git name-rev --name-only --no-undefined HEAD 2>/dev/null || echo "detached")
fi
if [ "$BUILD_STAMP_GIT_BRANCH" = "undefined" ]; then
  BUILD_STAMP_GIT_BRANCH="detached"
fi
if [ -n "$(git status --porcelain --untracked-files=all)" ]; then
  BUILD_STAMP_DIRTY="true"
else
  BUILD_STAMP_DIRTY="false"
fi
BUILD_STAMP_DEPLOYED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
BUILD_STAMP_VERSION=$(node -e "const fs=require('fs'); const m=fs.readFileSync('pwa/src/lib/build-info.ts','utf8').match(/BUILD_VERSION\\s*=\\s*['\\\"]([^'\\\"]+)['\\\"]/); if(!m) process.exit(1); console.log(m[1]);")

echo "Build stamp"
echo "  BUILD_VERSION: $BUILD_STAMP_VERSION"
echo "  GIT_SHA: $BUILD_STAMP_GIT_SHA"
echo "  GIT_BRANCH: $BUILD_STAMP_GIT_BRANCH"
echo "  DEPLOYED_AT: $BUILD_STAMP_DEPLOYED_AT"
echo "  DIRTY: $BUILD_STAMP_DIRTY"

if [ "$DRY_RUN" = "1" ]; then
  echo "Dry run complete. Vercel was not called."
  exit 0
fi

if [ "${AMD_OS_VERCEL_DEPLOY_APPROVED:-}" != "1" ]; then
  cat <<'EOF'
⛔ Vercel deploy requires approval.

Current rule:
  Vercel deploy is allowed again, but only after Masa approves a deploy bundle.
  This applies to production deploys, preview deploys, and pushes that may
  trigger Vercel auto-deploy.

Required deploy bundle:
  - included changes
  - excluded changes
  - local build/test/browser verification
  - planned deploy count
  - push/deploy target
  - rollback plan
  - production inspection plan

Do not deploy one-off wording, markdown, CSS, comments, logs, or micro UI changes.

If the bundle is approved, rerun with:
  AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh
EOF
  exit 1
fi

DEPLOY_ARGS=(--yes --archive=tgz --cwd "$REPO_ROOT")
if [ "$TARGET" = "production" ]; then
  DEPLOY_ARGS+=(--prod)
else
  DEPLOY_ARGS+=(--target preview)
fi
DEPLOY_ARGS+=(
  --build-env "NEXT_PUBLIC_AMD_OS_GIT_SHA=$BUILD_STAMP_GIT_SHA"
  --build-env "NEXT_PUBLIC_AMD_OS_GIT_BRANCH=$BUILD_STAMP_GIT_BRANCH"
  --build-env "NEXT_PUBLIC_AMD_OS_DEPLOYED_AT=$BUILD_STAMP_DEPLOYED_AT"
  --build-env "NEXT_PUBLIC_AMD_OS_DIRTY=$BUILD_STAMP_DIRTY"
  --meta "amd_os_build_version=$BUILD_STAMP_VERSION"
  --meta "amd_os_git_sha=$BUILD_STAMP_GIT_SHA"
  --meta "amd_os_git_branch=$BUILD_STAMP_GIT_BRANCH"
  --meta "amd_os_dirty=$BUILD_STAMP_DIRTY"
)

echo "▶ Vercel $TARGET deploy triggering ..."
START_TS=$(date +%s)
if ! DEPLOY_OUTPUT=$(npx vercel "${DEPLOY_ARGS[@]}" 2>&1); then
  echo "$DEPLOY_OUTPUT"
  osascript -e 'display notification "Deploy trigger failed" with title "AMD OS PWA — Deploy" sound name "Basso"' 2>/dev/null || true
  exit 1
fi
echo "$DEPLOY_OUTPUT"

# deployment URL を抽出 (preview/production 区別なく直近の URL)
DEPLOY_URL=$(echo "$DEPLOY_OUTPUT" | grep -oE 'https://amd-os-[a-z0-9]+-armada0130\.vercel\.app' | head -1)

echo ""
echo "▶ Waiting for $TARGET build to be Ready ..."
echo "  (URL: ${DEPLOY_URL:-unknown})"

# 最大 10 分 polling。
#
# 注意: `vercel ls` は pipe 経由 (非 tty) だと URL だけしか出力しない (status 列が出ない)。
# 過去のバグ: grep ベースで status を取ろうとしたが、行に URL しかないので Ready が
# 永遠に検出できず timeout していた。
# → `vercel inspect <url>` で個別 deployment の status を取る方式に変更。
MAX_TRIES=120
TRY=0
while [ $TRY -lt $MAX_TRIES ]; do
  if [ -n "$DEPLOY_URL" ]; then
    INSPECT_OUTPUT=$(npx vercel inspect "$DEPLOY_URL" --scope "$SCOPE" 2>&1)
  else
    INSPECT_OUTPUT=""
  fi

  if echo "$INSPECT_OUTPUT" | grep -qE 'status[[:space:]]+.*Ready'; then
    STATUS="Ready"
  elif echo "$INSPECT_OUTPUT" | grep -qE 'status[[:space:]]+.*Error'; then
    STATUS="Error"
  elif echo "$INSPECT_OUTPUT" | grep -qE 'status[[:space:]]+.*Canceled'; then
    STATUS="Canceled"
  elif echo "$INSPECT_OUTPUT" | grep -qE 'status[[:space:]]+.*(Building|Queued|Initializing)'; then
    STATUS="Building"
  else
    STATUS=""
  fi

  case "$STATUS" in
    Ready)
      DURATION=$(( $(date +%s) - START_TS ))
      MIN=$((DURATION / 60))
      SEC=$((DURATION % 60))
      if [ "$TARGET" = "production" ]; then
        MSG="${MIN}分${SEC}秒で完了 → ${APP_URL}"
      else
        MSG="${MIN}分${SEC}秒でpreview完了 → ${DEPLOY_URL:-unknown}"
      fi
      echo "✅ $MSG"
      if [ "$TARGET" = "production" ]; then
        echo "   User-facing URL: ${APP_URL}"
      fi
      echo "   Inspect-only deployment URL: ${DEPLOY_URL:-unknown}"
      osascript -e "display notification \"$MSG\" with title \"AMD OS PWA — Deploy 完了\" sound name \"Glass\"" 2>/dev/null || true
      exit 0
      ;;
    Error|Canceled)
      MSG="Build $STATUS"
      echo "❌ $MSG"
      osascript -e "display notification \"$MSG\" with title \"AMD OS PWA — Deploy 失敗\" sound name \"Basso\"" 2>/dev/null || true
      exit 1
      ;;
    Building|Queued|"")
      ;;
    *)
      echo "  status=$STATUS (waiting...)"
      ;;
  esac

  sleep 5
  TRY=$((TRY + 1))
done

osascript -e 'display notification "Build polling timed out (10 分)" with title "AMD OS PWA — Deploy" sound name "Funk"' 2>/dev/null || true
exit 1
