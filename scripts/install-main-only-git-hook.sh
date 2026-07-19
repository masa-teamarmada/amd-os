#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
hooks_path="$repo_root/.githooks"
hook_file="$hooks_path/reference-transaction"

if [ ! -x "$hook_file" ]; then
  printf '%s\n' "main-only hook が実行可能ではありません: $hook_file" >&2
  exit 1
fi

git -C "$repo_root" config --local core.hooksPath "$hooks_path"
configured_path="$(git -C "$repo_root" config --local --get core.hooksPath)"

if [ "$configured_path" != "$hooks_path" ]; then
  printf '%s\n' "main-only hook の設定に失敗しました。" >&2
  exit 1
fi

printf '%s\n' "AMD OS main-only hook: active ($configured_path)"
