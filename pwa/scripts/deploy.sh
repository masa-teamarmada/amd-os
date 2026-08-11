#!/usr/bin/env bash
# AMD OS PWA — 本番反映 = main push (Vercel Git 自動 deploy) + Build 完了 macOS 通知
#
# 2026-06-12 以降の正本フロー (まさ確定 A案):
#   本番反映 = origin/main への push。Vercel が main push を自動 production build する。
#   Vercel CLI による直接 deploy (`npx vercel --prod` / `npx vercel deploy`) は全面廃止。
#   main 以外の branch push は pwa/vercel.json の ignoreCommand により build されない。
#   これにより「まさが画面で見る OS = origin/main」が常に成立し、
#   未 push worktree からの deploy による正本巻き戻り事故を構造的に排除する。
#
# 使い方:
#   AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh
#   bash pwa/scripts/deploy.sh --dry-run   (検査と rollback guard のみ、push しない)
#
# 動作:
#   1. main checkout / clean tree / origin/main との整合を検査
#   2. critical UI / spec rollback guard (test:critical-ui)
#   3. rollback guard (deploy-version-guard.cjs)
#   4. git push origin main → Vercel 自動 build 発火
#   5. 新しい production deployment が Ready になるまで polling (最大 15 分)
#   6. 完了 → macOS 通知 (Glass 音) / 失敗 → Basso 音
#
# Claude / えいみ / Codex 向けルール:
#   - PWA の本番反映は必ずこのスクリプト経由。`npx vercel` 直接実行は禁止
#   - 原則、deploy 前の承認待ちで止めない。AMD_OS_VERCEL_DEPLOY_APPROVED=1 は誤実行防止の明示スイッチとして使う
#   - main 以外のブランチ作成は全面禁止 (リポ全体ルール、2026-06-12 まさ確定)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SCOPE="armada0130"
PROJECT="amd-os-pwa"
APP_URL="https://amd-os-pwa.vercel.app"
DRY_RUN=0

cd "$REPO_ROOT"

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run)
      DRY_RUN=1
      ;;
    --help)
      cat <<'EOF'
Usage: bash pwa/scripts/deploy.sh [--dry-run]

本番反映 = git push origin main (Vercel Git 自動 deploy)。
--dry-run は push せず、main/clean/origin 整合検査と rollback guard だけ実行する。
CLI 直接 deploy (--prod / --preview) は 2026-06-12 に廃止済み。
EOF
      exit 0
      ;;
    --prod|--production|--preview)
      cat <<'EOF' >&2
⛔ Vercel CLI 直接 deploy は 2026-06-12 に廃止された。
本番反映は main への push (= このスクリプトの通常実行) で行う。
preview deploy は運用しない (main 以外の branch は ignoreCommand で build されない)。
EOF
      exit 1
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
  shift
done

BRANCH=$(git branch --show-current)
if [ "$BRANCH" != "main" ]; then
  cat <<EOF >&2
⛔ main 以外からの deploy は禁止 (current branch: ${BRANCH:-detached})。
このリポは main 直運用。branch を main に戻してから実行する。
EOF
  exit 1
fi

if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  cat <<'EOF' >&2
⛔ tracked ファイルに未コミット変更がある。
deploy = push origin main なので、未コミット変更は本番に乗らない。
commit してから再実行する。
EOF
  git status --short --untracked-files=no >&2
  exit 1
fi

echo "Fetching origin/main ..."
git fetch origin main

if ! git merge-base --is-ancestor origin/main HEAD; then
  cat <<'EOF' >&2
⛔ origin/main にローカルに無い commit がある (別マシン / 別セッションの push)。
先に取り込んでから再実行する:
  git pull --ff-only origin main
EOF
  exit 1
fi

echo "Running critical UI / spec rollback guard ..."
(cd "$REPO_ROOT/pwa" && npm run test:critical-ui)
(cd "$REPO_ROOT/pwa" && npm run test:three-party-project-view)
(cd "$REPO_ROOT/pwa" && npm run test:sx-shared-control-migration)

echo "Running deploy rollback guard ..."
node "$SCRIPT_DIR/deploy-version-guard.cjs" --target production --app-url "$APP_URL" --repo-root "$REPO_ROOT"

GIT_SHA=$(git rev-parse --short=12 HEAD)
BUILD_VERSION=$(node -e "const fs=require('fs'); const m=fs.readFileSync('pwa/src/lib/build-info.ts','utf8').match(/BUILD_VERSION\\s*=\\s*['\\\"]([^'\\\"]+)['\\\"]/); if(!m) process.exit(1); console.log(m[1]);")
UNPUSHED=$(git rev-list origin/main..HEAD --count)

echo "Deploy bundle"
echo "  BUILD_VERSION: $BUILD_VERSION"
echo "  GIT_SHA: $GIT_SHA"
echo "  push する commit 数: $UNPUSHED"

if [ "$DRY_RUN" = "1" ]; then
  echo "Dry run complete. push していない。"
  exit 0
fi

if [ "$UNPUSHED" = "0" ]; then
  cat <<'EOF' >&2
⛔ origin/main との差分が無い (push する commit が無い)。
同一 commit の再 build が必要なら Vercel dashboard の Redeploy、
緊急の巻き戻しなら `npx vercel promote <deployment-id> --scope armada0130 --yes` を使う。
EOF
  exit 1
fi

if [ "${AMD_OS_VERCEL_DEPLOY_APPROVED:-}" != "1" ]; then
  cat <<'EOF'
⛔ 本番反映 (main push) には明示スイッチが必要。

2026-06-12 以降は原則ノンストップ運用。deploy 前の承認待ちで止めない。
誤実行防止のため、実行時は以下の環境変数を付ける:

  AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh

deploy bundle (含める変更 / 除外する変更 / local build・test 確認結果 /
push 先 / rollback 方法 / 本番確認方法) は事後報告として残す。
微細な md / 文言 / CSS を 1 件ずつ deploy する運用は禁止。複数の成果を束ねて 1 回で push する。
EOF
  exit 1
fi

get_latest_prod_line() {
  npx vercel ls "$PROJECT" --scope "$SCOPE" 2>&1 | grep "Production" | head -1
}

BASELINE_URL=$(get_latest_prod_line | grep -oE 'https://[^ ]+' || true)
echo "  現行 production deployment: ${BASELINE_URL:-unknown}"

EXPECTED_SHA_FULL=$(git rev-parse HEAD)

echo "▶ git push origin main (= Vercel 自動 production build 発火) ..."
START_TS=$(date +%s)
git push origin main

echo ""
echo "▶ 新しい production build が Ready になるのを待つ (最大 15 分) ..."
echo "  一次判定: $APP_URL/api/build-info の git_sha == $EXPECTED_SHA_FULL"

MAX_TRIES=90
TRY=0
while [ $TRY -lt $MAX_TRIES ]; do
  # 一次判定: 本番 alias が新 commit を返したら成功。
  # vercel ls は非 tty / background 実行で空応答になることがある (2026-06-12 初走行で確認)
  # ため、ユーザーが実際に見る production alias の build stamp を正とする。
  INFO=$(curl -s --max-time 10 "$APP_URL/api/build-info" || true)
  LIVE_SHA=$(echo "$INFO" | grep -oE '"git_sha":"[^"]*"' | cut -d'"' -f4 || true)

  if [ -n "$LIVE_SHA" ] && [ "$LIVE_SHA" = "$EXPECTED_SHA_FULL" ]; then
    DURATION=$(( $(date +%s) - START_TS ))
    MIN=$((DURATION / 60))
    SEC=$((DURATION % 60))
    MSG="${MIN}分${SEC}秒で完了 ($BUILD_VERSION) → ${APP_URL}"
    echo "✅ $MSG"
    echo "   live git_sha: $LIVE_SHA"
    osascript -e "display notification \"$MSG\" with title \"AMD OS PWA — Deploy 完了\" sound name \"Glass\"" 2>/dev/null || true
    exit 0
  fi

  # 二次判定 (best effort): 新 deployment の build Error / Canceled を早期検知
  LINE=$(get_latest_prod_line || true)
  URL=$(echo "$LINE" | grep -oE 'https://[^ ]+' || true)
  STATUS=$(echo "$LINE" | grep -oE 'Ready|Error|Canceled|Building|Queued|Initializing' | head -1 || true)
  if [ -n "$URL" ] && [ "$URL" != "$BASELINE_URL" ]; then
    case "$STATUS" in
      Error|Canceled)
        MSG="Build $STATUS ($URL)"
        echo "❌ $MSG"
        osascript -e "display notification \"$MSG\" with title \"AMD OS PWA — Deploy 失敗\" sound name \"Basso\"" 2>/dev/null || true
        exit 1
        ;;
    esac
  fi

  sleep 10
  TRY=$((TRY + 1))
done

osascript -e 'display notification "Build polling timed out (15 分)" with title "AMD OS PWA — Deploy" sound name "Funk"' 2>/dev/null || true
echo "⚠ polling timeout。push 自体は完了している。Vercel dashboard で build 状態を確認する。" >&2
exit 1
