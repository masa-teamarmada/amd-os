# sps_batch — SPS 初回評価バッチの補助資材

`scripts/sps_initial_assessment_tool.mjs` へ渡す payload を、20 件ずつ手作業で組むための最小資材。
判断の基準（q 帯・P 帯の較正、型別の書き分け）は `bzm/SPS_INITIAL_ASSESSMENT_PLAYBOOK.md` が正本。
ここには手順と検査だけを置く。

## ファイル

| ファイル | 役割 |
|---|---|
| `header.py` | `genNN.py` の先頭 8 行。要因名・要因順・`SIG`（評価者と日付）・`add()` の定義 |
| `tail.py` | `genNN.py` の末尾。帯の計算・全項目の長さ検査・prepare 出力との突合・payload 書き出し |
| `check.py` | 構文検査＋非日本語文字の混入検査＋`seed_id` の実 UUID への突合と自動修正 |
| `show.py` | prepare 出力の **1 件だけ** を表示する。並列運用の必須手順（下の「1 件だけ表示する」参照） |
| `apply.sh` | `submit` 出力の `candidate_ids` を 1 件ずつ `apply` し、`applied ok=N ng=M` を出す |
| `audit.mjs` | 投入済みの評価を **1 件ずつ読み返す** 監査ビュー（下の「投入後の監査」参照） |

## セッションの cwd

**セッションの cwd は `/Users/masa/projects/AMD/amd-os`（モノレポのルート）にする。`pwa/` を cwd にしない。**
`pwa/AGENTS.md` の先頭には `next dev` が書き戻す
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
- **億円は整数か .5 刻みだけ**。`tail.py` が `pl * OKU` で円へ直すので、`2.3` のような値は
  `Math.round` 側と桁が合わず `p_lower_yen` が安全整数から外れる。`0.5` 刻みに丸めて置く。
- **列名は 2 つのテーブルで違う**。`sps_initial_assessment_candidates`（staging）は
  `assessment_ruleset_version` / `proposal_summary` / `semantic_fingerprint` を持つ。
  `seed_screening_bands`（台帳）は同じものが **`ruleset_version`** で、
  `proposal_summary` と `semantic_fingerprint` は **無い**。SQL を書く前にどちらを見ているか確かめる。
- **`.env` は last-wins**。`pwa/.env.production.local` → `pwa/.env.local` → ルートの
  `.env.production.local` → `.env.local` の順に読み、**後から読んだ方で上書きする**
  （`sps_initial_assessment_tool.mjs` の `env()` が正本）。first-wins で書くと URL と key が
  別ファイル由来になって `Invalid API key` になる。

## 並列運用（サブエージェントで分担する場合）

1 ラウンドで 20〜100 件を複数エージェントへ分担させるときの取り決め。
2026-08-22 に実地で確認した（prepared を共有し、8/20 件だけの payload を submit → apply まで完走）。
**同日に残り 193 件をこの型で 5 ラウンド流し、ok 193 / ng 0 で未評価を 0 にした。**

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

### 実証済みのラウンド構成（Workflow で回す場合）

**1 ラウンド = prepare 40 件 → 4 エージェント × 10 件。** 2026-08-22 に 193 件をこれで完走させた
（40/40/40/40/33 の 5 ラウンド、エージェント 27 体、エラー 0、ok 193 / ng 0、約 30 分）。

Workflow スクリプトの本体からは Bash が叩けないので、**`prepare` はラウンド先頭に
「prepare 専用エージェント」を 1 体だけ順次実行させて叩かせる**。返させるのは
`prepared のパス` と `inputs の件数` と `実行前の remaining` の 3 つだけ。
そのあと担当 index を `0:10 / 10:20 / 20:30 / 30:40` で割って 4 体を `parallel` で走らせ、
**全員の `applied ok=N ng=M` が揃ってから**次のラウンドの `prepare` へ進む。

- 端数のラウンドは `Math.floor((n*i)/4)` 〜 `Math.floor((n*(i+1))/4)` で割る（33 件なら `0:8 / 8:16 / 16:24 / 24:33`）。
- `prepare` が 0 件を返したらループを終える。`ok` の合計が 0 のラウンドが出たら、そこで止めて原因を見る。
- 各エージェントへ渡す文言は上の「エージェントへの指示に必ず入れる文言」をそのまま入れる。
  加えて **PLAYBOOK と この README を最初に全文読ませる**（帯の較正が読まれないと水準がばらつく）。
- 帯の水準は毎ラウンド同じ PLAYBOOK から引かせる。ラウンドを跨いだ引き継ぎメモは作らない
  （前ラウンドの値へ寄せると台帳全体が緩やかに漂流する）。

### 投入後の監査

```sh
node scripts/sps_batch/audit.mjs --since 2026-08-22T06:00 --list   # 一覧（index / 段階 / q / P / 所属 / 題目）
node scripts/sps_batch/audit.mjs --since 2026-08-22T06:00 --index 7  # 1 件の全文（seed の生情報 + 評価 + 11 要因）
node scripts/sps_batch/audit.mjs --seed <uuid>                      # seed_id 直指定
```

読むのは `sps_initial_assessment_candidates` の `status='applied'` 行。**1 件ずつ表示する**
（並列運用と同じ理由で、まとめてダンプすると読み落とす）。

`--since` は**必ず自分のバッチの開始時刻へ切る**。同じ日に別セッションが走っていることがあり、
日付だけで切ると他人の行が混ざる。切り分けは `created_at` を分単位で数えて、
自分の件数と一致する窓を取ればよい（2026-08-22 は 04:36–05:24 が別セッションの 108 件、
06:17–06:42 が当セッションの 193 件で、合計 301 件だった）。


---

## 是正ラウンド（意味づけ欠落の直し）

2026-08-22 までに投入した band のうち 370 件は、11 因子すべての `assessment`
（意味づけの一行）が空のまま入っている。原因は初期の検証関数が `evidence` だけを
必須にしていたこと。migration 318 で穴を塞ぎ、同時に「追記で直す」経路を開いた。

`seed_screening_bands` は凍結・追記専用のため既存行は書き換えられない。直し方は
**同じ版タプルで新しい band を追記して、表示上の最新を差し替える**（表示は
`assessed_at DESC, id DESC` の最新1行を読む）。

### 手順（通常ラウンドとの差分だけ）

1. `prepare` に `--remediate` を付ける。対象は「最新 band の assessment が全空」かつ
   「pending 候補が無い」シーズだけが返る。出力に `mode: "remediation"` と、各 input に
   `supersedes_assessment_id` が入る。

   ```
   node scripts/sps_initial_assessment_tool.mjs prepare --remediate --limit 100 --out /tmp/pR1.json
   ```

2. gen 側の `SIG` を是正用に上書きする（末尾に `/ 意味づけ欠落の是正再評価` を足す）。

3. **11 因子すべてに空でない `assessment` を書く。** 是正モードでは1つでも空だと
   `check` ではなく DB 側の検証関数が弾く（`quality remediation requires a non-empty
   assessment on all 11 factors`）。通常ラウンドは「1つ以上」で通るが、是正は全件必須。

4. あとは通常どおり `check.py` → `tail.py` → `submit` → `apply.sh`。

### 落とし穴（是正ラウンド固有）

- `supersedes_assessment_id` は prepared の中にある。**gen 側に書かない。**
  tool が prepared から拾って候補行に載せる。
- 追記の間に別の band が入ると `apply` が
  `a newer band was appended after this remediation candidate` で止まる。
  その場合は prepare からやり直す。
- 残数は `status` の `defective` で見る。`remaining` は未評価（0 のまま）。

### 是正ラウンドの回し方（実証済み）

**1ラウンド = `prepare --remediate --limit 100` を親が1回だけ → 5エージェント × 20件。**

`--limit` は 100 でクランプされるので 200 は取れない。そして
**pending の除外は submit された後にしか効かない**ため、走っているエージェントが submit する前に
もう一度 `prepare` を叩くと**まったく同じ100件が返る**。ラウンドを重ねる時は、
全員の `applied ok=N ng=M` が揃ってから次の `prepare` を叩く。

投入後は `node scripts/sps_batch/audit_remediation.mjs --since <ISO時刻>` で構造監査する。
端点の再計算一致・11因子の順序と欠落・意味づけの充足と長さ・署名・意味づけ一行の使い回し・
11因子が丸ごと一致する組・段階と帯の分布が出る。

#### エージェントへ渡す文言（ひな型）

担当範囲 `A:B` と作業ファイル名だけ差し替えて使う。

```
SPS初回評価の「意味づけ欠落」是正ラウンド。担当は prepared の index A:B（20件）。

【cwd】/Users/masa/projects/AMD/amd-os（モノレポのルート）。pwa/ を cwd にしない。
各コマンドは先頭で `cd /Users/masa/projects/AMD/amd-os/pwa` する。

【最初に読む】
1. pwa/scripts/sps_batch/README.md（末尾の「是正ラウンド」節が正本）
2. pwa/scripts/sps_batch/sample_remediation.py（水準の見本。同じ粒度・同じ文体で書く）
3. pwa/scripts/sps_batch/header.py（FN / ORDER / E / add / SIG の定義）

【今回直すもの】既存 band は evidence は入っているが assessment（意味づけの一行）が全部空。
同じ版タプルで新しい band を追記して差し替える。11因子すべてに空でない assessment を書く。

【使うファイル】prepared（絶対に加工しない。読むだけ）/ 自分の gen / payload / submit 出力

【手順】
1. header.py をコピーし、末尾に是正用 SIG を書いて上書きし、その下に add(...) を20個書く。
2. `python3 scripts/sps_batch/show.py <prepared> <index>` で1件ずつ読む。
   同時に複数シーズを絶対に読まない。1件表示 → 1件 add() → 次の1件。
3. `python3 scripts/sps_batch/check.py <gen> <prepared> A:B` が RESULT: OK になるまで直す。
4. `cat <gen> scripts/sps_batch/tail.py > /tmp/fullN.py && python3 -X utf8 /tmp/fullN.py <prepared> <payload>`
5. `node scripts/sps_initial_assessment_tool.mjs submit --file <payload> --prepared <prepared> > <submit出力> 2>&1`
6. `sh scripts/sps_batch/apply.sh <submit出力> eimi-claude`

【評価の規律】根拠のない値は null のまま。採択年度・金額・実施期間を推測で埋めない。
P は億円単位の整数で pl/pu、q は % の小数で ql/qu。SPS は tail.py が計算する。
assessment は短い断定の一行。evidence は事実、assessment はそこから何が言えるか。
ev は ORDER の順で11個。日本語だけ。

【規律】git 操作は一切しない。prepared は加工しない。RESULT: OK になるまで submit しない。
診断用スクリプトを作ったら直後に消す。

【返すもの】`applied ok=N ng=M` の1行と、NG があればその candidate_id だけ。評価本文は返さない。
```
