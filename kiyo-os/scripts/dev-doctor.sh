#!/usr/bin/env bash
# きよOS: 開発環境が整っているかを見るだけのスクリプト。何も壊しません。
#
#   bash scripts/dev-doctor.sh

set -uo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

ok()   { echo "  ✅ $*"; }
warn() { echo "  ⚠️  $*"; }
ng()   { echo "  ❌ $*"; }

echo ""
echo "==== きよOS 環境チェック ===="
echo ""

echo "[1] 必要なソフト"
command -v git  >/dev/null && ok "git  $(git --version | awk '{print $3}')"  || ng "git が入っていません"
command -v node >/dev/null && ok "node $(node -v)"                           || ng "Node.js が入っていません"
command -v npm  >/dev/null && ok "npm  $(npm -v)"                            || ng "npm が入っていません"

if command -v node >/dev/null; then
  major="$(node -v | sed 's/^v//' | cut -d. -f1)"
  [ "$major" -ge 22 ] || warn "Node は v22 以上が必要です（今: $(node -v)）"
fi

echo ""
echo "[2] リポジトリの状態"
branch="$(git branch --show-current 2>/dev/null || echo '?')"
[ "$branch" = "main" ] && ok "ブランチ: main" || warn "ブランチが main ではありません: $branch"

hooks="$(git config --get core.hooksPath || true)"
[ "$hooks" = ".githooks" ] && ok "ブランチ作成の防止 hook: 有効" \
  || warn "hook が未設定です → bash scripts/install-main-only-git-hook.sh を1回実行してください"

if git remote get-url origin >/dev/null 2>&1; then
  ok "リモート: $(git remote get-url origin)"
else
  ng "リモート origin がありません"
fi

echo ""
echo "[3] 同期の状態"
if git fetch origin main --quiet 2>/dev/null; then
  behind="$(git rev-list --count HEAD..origin/main 2>/dev/null || echo '?')"
  ahead="$(git rev-list --count origin/main..HEAD 2>/dev/null || echo '?')"
  [ "$behind" = "0" ] && ok "最新です" \
    || warn "$behind 件遅れています → git pull --ff-only origin main してから作業してください"
  [ "$ahead" = "0" ] && ok "push し忘れなし" \
    || warn "$ahead 件 push されていません → git push origin main してください"
else
  warn "リモートに繋がりませんでした（ネットワーク？）"
fi

dirty="$(git status --porcelain | wc -l | tr -d ' ')"
[ "$dirty" = "0" ] && ok "保存していない変更なし" || warn "$dirty 件、まだ commit していない変更があります"

echo ""
echo "[4] 依存パッケージ"
[ -d node_modules ] && ok "インストール済み" || warn "未インストール → npm install を実行してください"

echo ""
echo "[5] 環境変数"
if [ -f .env.local ]; then
  ok ".env.local あり"
else
  warn ".env.local なし（今は無くても動きます。ダミーデータで表示されます）"
fi

echo ""
echo "==== ここまで ===="
echo "⚠️ が出ていても、たいていは動きます。分からなければ、この出力をそのまま えいみ に貼ってください。"
echo ""
