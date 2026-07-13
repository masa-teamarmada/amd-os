#!/usr/bin/env bash
# git_dirty_guard.sh — 未コミット dirty / 未push commit を検知して Claude に可視化する。
#
# 目的 (まさ 2026-06-20): 「完成した作業がコミットされず dirty で放置され、
# 次セッションが後始末に時間とトークンを浪費する」構造を断つ。
#   - SessionStart: セッション冒頭に dirty + 未push を要約表示 (後始末の即可視化)。
#   - Stop:         応答終了時に dirty があれば静かに注意 (コミット忘れ防止)。ブロックしない。
#
# 引数 $1 = "session_start" | "stop" でメッセージ文言を出し分ける。
# 出力は JSON。additionalContext に Claude 向けの注意を入れる。常に exit 0 (止めない)。

MODE="${1:-stop}"
REPO="$(git rev-parse --show-toplevel 2>/dev/null)"
if [ -z "$REPO" ]; then
  echo '{}'
  exit 0
fi
cd "$REPO" || { echo '{}'; exit 0; }

DIRTY="$(git status -s 2>/dev/null)"
UNPUSHED="$(git log --branches --not --remotes --oneline 2>/dev/null | head -20)"

if [ -z "$DIRTY" ] && [ -z "$UNPUSHED" ]; then
  echo '{}'
  exit 0
fi

DIRTY_COUNT="$(printf '%s' "$DIRTY" | grep -c . )"
UNPUSHED_COUNT="$(printf '%s' "$UNPUSHED" | grep -c . )"

if [ "$MODE" = "session_start" ]; then
  HEADER="🧹 前セッションの未処理が残っています (後始末を最初に判断してください、まさには質問しない)"
else
  HEADER="🧹 未コミットの変更があります (完成分はコミット/push、未完は明示的にWIP判断。まさに「どれをコミット?」と聞かない)"
fi

# additionalContext 本文を組み立て (改行は \n でエスケープして JSON 文字列化は python に任せる)
BODY="$HEADER"
BODY="$BODY"$'\n\n'"未コミット変更 ($DIRTY_COUNT 件):"$'\n'"$DIRTY"
if [ -n "$UNPUSHED" ]; then
  BODY="$BODY"$'\n\n'"未push commit ($UNPUSHED_COUNT 件):"$'\n'"$UNPUSHED"
fi
BODY="$BODY"$'\n\n'"判断指針: 完成して正本反映済み=コミット / 別worker由来=触らず帰属を明記 / 自分の未完=WIPとして次アクション化 / 一時ファイル(_接頭辞・検証スクリプト等)=削除。まさに「どれをコミット?」と質問せず、えいみが判断して処理する。AGENTS.common.md「えいみができることは全部えいみがやる」「確認質問で止まらない」に従う。"

EVENT="Stop"
[ "$MODE" = "session_start" ] && EVENT="SessionStart"

python3 - "$EVENT" "$BODY" <<'PY'
import json, sys
event, body = sys.argv[1], sys.argv[2]
print(json.dumps({
    "hookSpecificOutput": {
        "hookEventName": event,
        "additionalContext": body,
    }
}, ensure_ascii=False))
PY
exit 0
