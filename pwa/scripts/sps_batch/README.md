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
| `show.py` | prepare 出力の **1 件だけ** を表示する。並列運用の必須手順（下の「1 件だけ表示する」参照） |
| `apply.sh` | `submit` 出力の `candidate_ids` を 1 件ずつ `apply` し、`applied ok=N ng=M` を出す |

## セッションの cwd

**セッションの cwd は `/Users/masa/projects/AMD/amd-os`（モノレポのルート）にする。`pwa/` を cwd にしない。**
`pwa/CLAUDE.md` は `@AGENTS.md` を展開し、その `pwa/AGENTS.md` の先頭には `next dev` が書き戻す
「This is NOT the Next.js you know」ブロックが入る。pwa を cwd にすると毎セッションこれを読み込む。
各コマンドの中で `cd .../pwa` を書いて入るが、これは相対パスのためではない。
**このツール群がディレクトリ位置に依存するのは 1 点だけ**で、`@supabase/supabase-js` が
`pwa/node_modules` にしかないこと（repo ルートに `node_modules` は無い）。`node` をそこで起動するために入る。
ツール本体の `ROOT` は自分の位置から解決し（`sps_initial_assessment_tool.mjs:9`）、`.env` はルート直下と
`pwa/` の両方を探す。`check.py` / `tail.py` は引数でパスを受けるだけ。
つまり `pwa/` ごと移設・改名しても、`node_modules` が同じ階層に来ていれば SPS 作業は壊れない。

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
sh scripts/sps_batch/apply.sh "$SP/submit$N.json"   # -> applied ok=N ng=M
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

## 並列運用（サブエージェントで分担する場合）

1 ラウンドで 20〜100 件を複数エージェントへ分担させるときの取り決め。
2026-08-22 に実地で確認した（prepared を共有し、8/20 件だけの payload を submit → apply まで完走）。

### 親（司令塔）がやること

- **`prepare` は親が 1 ラウンドに 1 回だけ叩く。** このツールにロックが無いため、
  複数エージェントが並列に `prepare` すると同じ未評価シーズが二重に配られる。
- 取り出した `p$N.json` の **index 範囲**（`inputs` の並び順）でエージェントへ分担を割り当てる。
  例：10 件ずつ 2 エージェントなら `0:10` と `10:20`。
- 各エージェントの完了報告（`applied ok=… ng=…`）を集めてから、次のラウンドの `prepare` を叩く。
- ラウンドの前後で `status` を見て、`remaining` が担当件数どおりに減ったことを確認する。

### 各エージェントがやること

- **`p$N.json` は絶対に加工しない。** `prepared_hash` は本体から再計算して照合される
  （`sps_initial_assessment_tool.mjs`）。inputs を切り出した prepared を渡すと
  `prepared_hash mismatch` で submit ごと弾かれる。全員が同じファイルを `--prepared` に渡す。
- **payload は prepared の部分集合でよい。** submit の検証は封筒と各行の中身だけを見て、
  行と入力の突合は `find` で引く。担当分だけを書いた payload がそのまま通る。
- **ファイル名にエージェント番号を必ず入れる。** `gen$N_a$A.py` / `payload$N_a$A.json` /
  `submit$N_a$A.json`。同じ scratchpad を共有すると上書き事故になる。
- 検査は担当範囲を渡す：`python3 scripts/sps_batch/check.py "$SP/gen$N_a$A.py" "$SP/p$N.json" 0:10`
  第 3 引数は prepare 出力 `inputs` の index 範囲（**B は含まない**）。省略すると全件が担当。
  担当漏れ（`not covered`）と担当外の混入（`out of duty`）の両方で NG になる。
- `tail.py` が出す `prepared seeds not covered:` は**表示だけで失敗にしない**。
  並列では他エージェントの担当分がここへ出るのが正常。担当漏れの判定は `check.py` が持つ。
- 完了報告は `applied ok=N ng=M` の 1 行と、NG があればその candidate_id だけ。評価本文は返さない。

### エージェントへの指示に必ず入れる文言

- **同時に複数シーズを読まない。** 1 件だけ表示 → その 1 件の `add()` を書く → 次の 1 件、を厳密に繰り返す。
  20 件をまとめてダンプして読むと、文脈が膨らんで seed_id の後半が失われる（実際に起きた）。
- `check.py` が `RESULT: OK` になるまで submit しない。
- KPI は**残シーズ数を減らすこと**。判断に迷ったら PLAYBOOK の帯の範囲内で置き、根拠のない値は null のまま残す。

### 1 件だけ表示する

```sh
python3 scripts/sps_batch/show.py "$SP/p$N.json" $I
```

`seed` の全項目に加えて `funding` / `news` / `projects` も出す。採択制度と年度は `funding` に入っているので、
段階仮説（PLAYBOOK §3）はここを見て決める。`amount_jpy` が `null` なら金額は推測せず `null` のまま残す。
