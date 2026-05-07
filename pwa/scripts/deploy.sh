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

set -e

REPO_ROOT="/Users/masa/projects/AMD/amd-os"
SCOPE="armada0130"
PROJECT="amd-os-pwa"

cd "$REPO_ROOT"

echo "▶ Vercel deploy triggering ..."
START_TS=$(date +%s)
DEPLOY_OUTPUT=$(npx vercel --prod --yes --cwd "$REPO_ROOT" 2>&1)
echo "$DEPLOY_OUTPUT"

# trigger 自体が失敗した場合
if [ $? -ne 0 ]; then
  osascript -e 'display notification "Deploy trigger failed" with title "AMD OS PWA — Deploy" sound name "Basso"' 2>/dev/null || true
  exit 1
fi

# deployment URL を抽出 (preview/production 区別なく直近の URL)
DEPLOY_URL=$(echo "$DEPLOY_OUTPUT" | grep -oE 'https://amd-os-[a-z0-9]+-armada0130\.vercel\.app' | head -1)

echo ""
echo "▶ Waiting for production build to be Ready ..."
echo "  (URL: ${DEPLOY_URL:-unknown})"

# 最大 10 分 polling
MAX_TRIES=120
TRY=0
while [ $TRY -lt $MAX_TRIES ]; do
  STATUS=$(npx vercel ls --scope "$SCOPE" "$PROJECT" 2>/dev/null \
    | awk -v url="$DEPLOY_URL" '$3 == url {print $5; exit}')

  # URL マッチで取れなかった場合は最新の Production 行をフォールバック
  if [ -z "$STATUS" ]; then
    STATUS=$(npx vercel ls --scope "$SCOPE" "$PROJECT" 2>/dev/null \
      | awk '$6 == "Production" {print $5; exit}')
  fi

  case "$STATUS" in
    Ready)
      DURATION=$(( $(date +%s) - START_TS ))
      MIN=$((DURATION / 60))
      SEC=$((DURATION % 60))
      MSG="${MIN}分${SEC}秒で完了 → ${DEPLOY_URL:-amd-os-pwa.vercel.app}"
      echo "✅ $MSG"
      osascript -e "display notification \"$MSG\" with title \"AMD OS PWA — Deploy 完了\" sound name \"Glass\"" 2>/dev/null || true
      exit 0
      ;;
    Error|Canceled)
      MSG="Build $STATUS"
      echo "❌ $MSG"
      osascript -e "display notification \"$MSG\" with title \"AMD OS PWA — Deploy 失敗\" sound name \"Basso\"" 2>/dev/null || true
      exit 1
      ;;
    Building|Queued|Initializing|"")
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
