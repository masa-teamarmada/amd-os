#!/usr/bin/env bash
# きよOS: ブランチ作成を防ぐ hook を有効化する。clone 後に 1 回だけ実行する。
#
#   bash scripts/install-main-only-git-hook.sh
#
# Windows (PowerShell) から実行する場合:
#   & "C:\Program Files\Git\bin\bash.exe" scripts/install-main-only-git-hook.sh

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

if [ ! -d .git ]; then
  echo "❌ ここは git リポジトリではありません: $repo_root" >&2
  exit 1
fi

chmod +x .githooks/reference-transaction
git config core.hooksPath .githooks

echo "✅ 有効にしました。"
echo "   hooksPath = $(git config --get core.hooksPath)"
echo ""
echo "   これで、うっかりブランチを作ろうとすると止まります。"
echo "   main への commit / push はいつも通りできます。"
