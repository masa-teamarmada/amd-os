#!/bin/bash
# AMD OS — Claude Code on the web (クラウドコンテナ) 用 SessionStart hook
#
# 目的:
#   web セッションでも lint / tsc / test:* / build がセッション開始直後から
#   そのまま走る状態にする。これが無いと node_modules が無いところから始まり、
#   えいみが「確認できないので未検証のまま報告する」に落ちる (2026-08-27 実測)。
#
# まさの Mac では何もしない:
#   Mac 側は SETUP_NEW_MAC.md と scripts/install-main-only-git-hook.sh で別に
#   整えてある。とくに core.hooksPath は Mac では .githooks を指していて、
#   ここで上書きすると branch 作成禁止フックを無効化してしまう。

set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

REPO_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
cd "$REPO_ROOT"

# 1. pwa の依存 (このリポで package.json を持つのは pwa/ だけ)。
#    npm ci ではなく npm install。コンテナは hook 完走後の状態がキャッシュされるので、
#    差分が無い再実行は速く終わる。
echo "[session-start] npm install (pwa) ..."
npm --prefix "$REPO_ROOT/pwa" install --no-audit --no-fund

# 2. git hooks。
#    .githooks をそのまま core.hooksPath に指定してはいけない。
#    .githooks/reference-transaction は refs/heads/main 以外の branch 作成を
#    拒否するため、web セッションに割り当てられる claude/* branch が作れず
#    セッションごと壊れる (2026-08-27 に使い捨て clone で実測確認)。
#    model lock の pre-commit だけを web 用ディレクトリ経由で有効にする。
if [ -x "$REPO_ROOT/.claude/hooks/git/pre-commit" ]; then
  git config core.hooksPath ".claude/hooks/git"
  echo "[session-start] git hooks: model lock の pre-commit のみ有効化"
fi

# 3. セッション env。
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  # 同一セッションで hook が複数回走っても env file に重複行を積まない。
  grep -qxF 'export NEXT_TELEMETRY_DISABLED=1' "$CLAUDE_ENV_FILE" 2>/dev/null \
    || echo 'export NEXT_TELEMETRY_DISABLED=1' >> "$CLAUDE_ENV_FILE"
fi

echo "[session-start] done"
