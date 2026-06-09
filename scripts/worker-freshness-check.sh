#!/usr/bin/env bash
# AMD OS worker freshness gate.
#
# Read-only preflight for visible workers. Run before code edits/deploy:
#
#   AMD_OS_MIN_BUILD_VERSION=v0.16.20 scripts/worker-freshness-check.sh
#
# Optional:
#   AMD_OS_BASE_REF=origin/codex/prs-docs-v01618 scripts/worker-freshness-check.sh
#
# The script never changes git state. It only reads HEAD, BUILD_VERSION, refs,
# and dirty status, then exits non-zero when the checkout is too old.

set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BUILD_INFO_PATH="pwa/src/lib/build-info.ts"

cd "$REPO_ROOT" || exit 1

version_from_content() {
  sed -n 's/.*BUILD_VERSION = "\([^"]*\)".*/\1/p' | head -1
}

version_from_ref() {
  git show "$1:$BUILD_INFO_PATH" 2>/dev/null | version_from_content
}

version_to_number() {
  local version="${1#v}"
  local major minor patch
  IFS=. read -r major minor patch <<EOF
$version
EOF
  if [ -z "${major:-}" ] || [ -z "${minor:-}" ] || [ -z "${patch:-}" ]; then
    echo ""
    return
  fi
  printf "%06d%06d%06d\n" "$major" "$minor" "$patch" 2>/dev/null || echo ""
}

version_lt() {
  local left_num right_num
  left_num="$(version_to_number "$1")"
  right_num="$(version_to_number "$2")"
  [ -n "$left_num" ] && [ -n "$right_num" ] && [ "$left_num" -lt "$right_num" ]
}

current_version="$(version_from_content < "$BUILD_INFO_PATH")"
current_head="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
current_branch="$(git branch --show-current 2>/dev/null || true)"
dirty_count="$(git status --porcelain=v1 | wc -l | tr -d ' ')"
min_version="${AMD_OS_MIN_BUILD_VERSION:-}"
base_ref="${AMD_OS_BASE_REF:-}"

max_ref=""
max_version=""
while read -r ref; do
  version="$(version_from_ref "$ref")"
  [ -n "$version" ] || continue
  if [ -z "$max_version" ] || version_lt "$max_version" "$version"; then
    max_version="$version"
    max_ref="$ref"
  fi
done <<EOF
$(git for-each-ref --format='%(refname:short)' refs/heads refs/remotes/origin 2>/dev/null)
EOF

origin_main_version="$(version_from_ref origin/main)"
base_version=""
if [ -n "$base_ref" ]; then
  base_version="$(version_from_ref "$base_ref")"
fi

echo "AMD OS worker freshness check"
echo "  cwd: $REPO_ROOT"
echo "  branch: ${current_branch:-detached}"
echo "  head: $current_head"
echo "  local BUILD_VERSION: ${current_version:-missing}"
echo "  dirty files: $dirty_count"
echo "  origin/main BUILD_VERSION: ${origin_main_version:-missing}"
echo "  max ref BUILD_VERSION: ${max_version:-missing}${max_ref:+ ($max_ref)}"
if [ -n "$min_version" ]; then
  echo "  required minimum: $min_version"
fi
if [ -n "$base_ref" ]; then
  echo "  required base ref: $base_ref (${base_version:-BUILD_VERSION missing})"
fi

failures=0

if [ -z "$current_version" ]; then
  echo "FAIL: local BUILD_VERSION is missing."
  failures=$((failures + 1))
fi

if [ -n "$min_version" ] && [ -n "$current_version" ] && version_lt "$current_version" "$min_version"; then
  echo "FAIL: local BUILD_VERSION $current_version is older than required $min_version."
  failures=$((failures + 1))
fi

if [ -n "$base_ref" ]; then
  if ! git merge-base --is-ancestor "$base_ref" HEAD 2>/dev/null; then
    echo "FAIL: HEAD does not contain required base ref $base_ref."
    failures=$((failures + 1))
  fi
fi

if [ -n "$max_version" ] && [ -n "$current_version" ] && version_lt "$current_version" "$max_version"; then
  echo "WARN: local BUILD_VERSION $current_version is older than max known $max_version ($max_ref)."
fi

if [ "$dirty_count" -gt 0 ]; then
  echo "WARN: worktree is dirty; classify dirty ownership before editing or rebasing."
fi

if [ "$failures" -gt 0 ]; then
  echo "Result: STALE. Stop before implementation/deploy and rebase, switch base, or create a fresh worktree."
  exit 1
fi

echo "Result: OK for freshness gate. Continue with normal dirty/current-truth checks."
