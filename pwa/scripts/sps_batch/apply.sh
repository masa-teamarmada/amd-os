#!/bin/sh
# 使い方: sh scripts/sps_batch/apply.sh <submitNN.json> [actor]
# submit 出力の candidate_ids を 1 件ずつ apply する。
# grep のパターンは '"applied":true'（空白なし）。空白を入れると全件 NG の誤判定になる。
set -u
f="$1"
actor="${2:-eimi-claude}"
ok=0
ng=0
for id in $(python3 -c "import json,sys;print(' '.join(json.load(open(sys.argv[1]))['candidate_ids']))" "$f"); do
  r=$(node scripts/sps_initial_assessment_tool.mjs apply --candidate-id "$id" --actor "$actor" 2>&1)
  if echo "$r" | grep -q '"applied":true'; then
    ok=$((ok + 1))
  else
    ng=$((ng + 1))
    echo "NG $id"
  fi
done
echo "applied ok=$ok ng=$ng"
