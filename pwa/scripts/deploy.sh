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
#   - Vercel quota hard gate 中は、このスクリプトも実行しない。
#   - deploy bundle承認後だけ `AMD_OS_VERCEL_DEPLOY_APPROVED=1` を付けて実行する。

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SCOPE="armada0130"
PROJECT="amd-os-pwa"
APP_URL="https://amd-os-pwa.vercel.app"

cd "$REPO_ROOT"

if [ "${AMD_OS_VERCEL_DEPLOY_APPROVED:-}" != "1" ]; then
  cat <<'EOF'
⛔ Vercel deploy is currently hard-gated.

Reason:
  Vercel daily deployment quota has been exhausted by repeated small deploys.

Current rule:
  Do not run preview or production deploys for wording, markdown, CSS,
  comments, logs, or micro UI changes.
  Do not push branches that may trigger Vercel auto-deploy.
  Bundle worker results and deploy once only after explicit approval.

Required before deploy:
  - bundle name
  - included changes
  - excluded changes
  - local verification
  - planned deploy count
  - push target
  - rollback plan
  - route/production inspection plan

If the bundle is approved, rerun with:
  AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh
EOF
  exit 1
fi

echo "▶ Vercel deploy triggering ..."
START_TS=$(date +%s)
if ! DEPLOY_OUTPUT=$(npx vercel --prod --yes --archive=tgz --cwd "$REPO_ROOT" 2>&1); then
  echo "$DEPLOY_OUTPUT"
  osascript -e 'display notification "Deploy trigger failed" with title "AMD OS PWA — Deploy" sound name "Basso"' 2>/dev/null || true
  exit 1
fi
echo "$DEPLOY_OUTPUT"

# deployment URL を抽出 (preview/production 区別なく直近の URL)
DEPLOY_URL=$(echo "$DEPLOY_OUTPUT" | grep -oE 'https://amd-os-[a-z0-9]+-armada0130\.vercel\.app' | head -1)

echo ""
echo "▶ Waiting for production build to be Ready ..."
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
      MSG="${MIN}分${SEC}秒で完了 → ${APP_URL}"
      echo "✅ $MSG"
      echo "   User-facing URL: ${APP_URL}"
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
