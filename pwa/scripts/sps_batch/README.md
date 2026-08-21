# sps_batch — SPS 初回評価バッチの補助資材

`scripts/sps_initial_assessment_tool.mjs` へ渡す payload を、20 件ずつ手作業で組むための最小資材。
判断の基準（q 帯・P 帯の較正、型別の書き分け）は `pwa/bzm/SPS_INITIAL_ASSESSMENT_PLAYBOOK.md` が正本。
ここには手順と検査だけを置く。

## ファイル

| ファイル | 役割 |
|---|---|
| `header.py` | `genNN.py` の先頭 8 行。要因名・要因順・`SIG`（評価者と日付）・`add()` の定義 |
| `tail.py` | `genNN.py` の末尾。帯の計算・全項目の長さ検査・prepare 出力との突合・payload 書き出し |
| `check.py` | 構文検査＋非日本語文字の混入検査＋`seed_id` の実 UUID への突合と自動修正 |

## 手順（1 バッチ = 20 件）

```sh
export SP=<このセッションの scratchpad>
cd /Users/masa/projects/AMD/amd-os/pwa
N=23   # バッチ番号

# 1. 未評価の残数を見る
node scripts/sps_initial_assessment_tool.mjs status

# 2. 20 件を取り出す
node scripts/sps_initial_assessment_tool.mjs prepare --limit 20 --output "$SP/p$N.json"
python3 -c "
import json,io,os
d=json.load(io.open(os.environ['SP']+'/p$N.json',encoding='utf-8'))
for x in d['inputs']:
    s=x['source_facts']['seed']
    print(x['seed_id'][:8],'|',(s.get('domain_lane') or '')[:11].ljust(11),'|',(s.get('org_name') or '')[:22].ljust(22),'|',(s.get('title') or '')[:46])
print('count:',len(d['inputs']))
"

# 3. gen を組む（header.py の SIG の日付を当日に直してから使う）
cp scripts/sps_batch/header.py "$SP/gen$N.py"
cat >> "$SP/gen$N.py" <<'PYEOF'
（20 件分の add(...) を書く。seed_id は先頭 8 文字 + "-0000-0000-0000-000000000000" のプレースホルダで可）
PYEOF

# 4. 検査（RESULT: OK になるまで先へ進まない）
python3 scripts/sps_batch/check.py "$SP/gen$N.py" "$SP/p$N.json"

# 5. tail を連結して payload を作る（二重連結の防止に grep -c を必ず見る）
grep -c 'proposals' "$SP/gen$N.py"          # 0 であること
cat scripts/sps_batch/tail.py >> "$SP/gen$N.py"
python3 "$SP/gen$N.py" "$SP/p$N.json" "$SP/payload$N.json"

# 6. 投入
node scripts/sps_initial_assessment_tool.mjs submit --file "$SP/payload$N.json" --prepared "$SP/p$N.json" > "$SP/submit$N.json" 2>&1
ok=0; ng=0
for id in $(python3 -c "import json;print(' '.join(json.load(open('$SP/submit$N.json'))['candidate_ids']))"); do
  r=$(node scripts/sps_initial_assessment_tool.mjs apply --candidate-id $id --actor eimi-claude 2>&1)
  if echo "$r" | grep -q '"applied":true'; then ok=$((ok+1)); else ng=$((ng+1)); echo "NG $id"; fi
done
echo "applied ok=$ok ng=$ng"
```

## 落とし穴（実際に踏んだもの）

- **`seed_id` の捏造**：文脈圧縮を跨ぐと UUID の後半が失われる。`check.py` の突合を飛ばして `submit` しない。
- **applyループの grep**：パターンは `'"applied":true'`（空白なし）。空白を入れると全件 NG の誤判定になる。
- **Bash はシェル状態を持ち越さない**：`$SP` を使うコマンドは同じ呼び出しの中で `export SP=...` を先に書く。`cd` も毎回書く。
- **`python` は無い**。必ず `python3`。
- **prepare の `--limit` は 100 が上限**。残数は `status` で見る。
- **prepare 出力の seed 情報は `source_facts.seed` の下**にある。`x['title']` では取れない。
- **`Math.round` と `round()` の丸めが違う**。`tail.py` が `math.floor(x + 0.5)` を使っているのはそのため。触らない。
- **`scratchpad` から `@supabase/supabase-js` は import できない**。診断は `scripts/_diag_tmp.mjs` に置いて実行し、直後に消す。
