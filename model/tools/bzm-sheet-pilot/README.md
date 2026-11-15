# BZM 1.0 評価記録の試作

教科書 BZM 1.0（原稿 v1.2.2、書庫 b63a642）の §9.5 / 第12〜14章の「節目の決定木」を、入力から再計算して Google Sheets に追記専用で記録する試作。

## 範囲
- 計算するのは §9.5 の固定の決定木（節目 8・15・27・39 か月、不成立後のライセンス）。§4〜7 の月次の全体シミュレーションは含まない。
- 9.5.1 の ICV 151.9 / rNPV 12.69 は、固定入力に対するこの決定木の算術の結果。
- 条件と限界は末尾の「制限」に書く。
- 旧版（BZM 3.0 内部版）は `legacy-*` コマンドとして残る。既定コマンドは旧版の指標・状態を扱わない。

## 数値の確認状況
- 検証用のコードは、表 14.1 の全行と表 14.2 の全代替案を丸める前の値で独立に再計算し、著者の Python との差は 0。
- 教科書の数値は、コミット dbbbd8a 以降変わっていない。
- 基準値は、初回 ICV 151.9 / rNPV 12.69。基準日から 3 か月後に出来事 E-03（二社目の需要家の合意）を反映すると、同じ月の更新前が 152.7 / 13.00、更新後が 157.7 / 13.62。
- テストは `bzm1.test.mjs` が表 14.1 の全行（節目 4・出来事 9）と初期値、上の 3 か月の前後を確認する。
- 架空の議事録を Google Docs で更新し、実際の Sheets に評価日・3・5・8 か月目の評価を追記した。8 か月目の通過記録を、評価日に固定した予測（62%）と同じ予測 ID で照合した。
- 抽出対象の6件を3回の呼び出しで確認した。入力6,288、出力922トークン。実課金額は請求明細で未確認。

## 計算
- 入力はすべて単位つき（億円/年、万円/月、確率、月、年率）。欠けた値は 0 にせず `missing_input` で止まる。
- 自由資金（保有資金）、将来の正味価値、使途限定資金は別々に出す。民間割引率と産業割引率も別。
- 節目の成否確率 p、不成立後のライセンス確率 l、売上・購入費・人件費、(売上−購入費)×正味比率、ライセンスの条件付き価値を、原典 `評価額の推移_計算.py` と同じ式で計算する。
- 入力の組が複数あるときは、組ごとに ICV と rNPV を出し、外側で重み付き平均と 10/50/90% 点を出す。1 組だけなら分位点は「未計算」と表示する。
- 不確かな入力は §13.3.1 に従い、別 ID の評価者 2 名が独立に初期分布 → 根拠交換（日付・共有資料）→ 各 1 回の再推定（変更なしも可）→ 等重み混合。
- 混合の厳密さは入力の形で変わる。
  - 離散点で与えた分布: 量ごとの積と 0.5/0.5 の混合は厳密。
  - 5 分位点（下限・10%・50%・90%・上限）で与えた連続分布: 量ごとの要約（平均・10/50/90% 点・CDF）は §18.6.7 の周辺 CDF・分位点から厳密に出す。評価値（ICV・rNPV）への投影だけは、区分線形の区間ごとの中点で n 点（既定 10）に離散化した数値計算で、方法を「中点の数値投影」と明記する。連続分布の入力でだけ近似が入り、離散点は厳密。
  - 本書の版は v1.2.2。
- 教科書の固定値は `textbook-plan-input.json` のように `teaching: true`・出所つきの明細で入れる。評価者は作らない。

## 入力ファイル（plan への標準入力）
- `base.inputs`: 評価日・節目・各入力・月次の営業収支（`flowsMonthly` は 1 か月目から最終月まで隙間なく）。
- `base.provenance`: 全入力の出所・観測か見積か・教材かどうか。欠けると止まる。
- `registry`: §12.2 の 9 列（事象ID、日付、種類、要旨、出所タグ、契約主体、反映先、変更内容、記録者）＋確認（`review`）・根拠引用・入力変更。
  - 事象から確率を自動で決める式はない。`inputChanges` に人が確認した値を明記する。
  - `review.decision` が `adopt` になるまで評価に入らない。基準日より後の事象・確認・根拠は入らない。
- 採用済みの明細は書換え・削除不可。予測は保存後に固定、実績は確認済みの観測だけで後から付ける。

### 最小の例（出来事 1 件の登録簿）
`registry` の 1 件は次の形。値は教材の仮定で、実在の評価ではない。
```json
{ "eventId": "E-03", "date": "2026-04-01", "type": null, "teaching": true,
  "summary": "二社目の需要家が試験の実施に合意", "sourceTag": "文書", "contractParty": null,
  "targets": ["プロジェクトパラメータ"], "changeText": "有償の試験へ進む確率 0.74→0.78",
  "recordedBy": "教科書の通し事例",
  "inputChanges": [{ "path": "p.15", "to": 0.78, "unit": "確率", "kind": "estimate",
    "estimate": { "by": "教科書の通し事例", "rationale": "支払上限の証拠（関心が二社）" } }],
  "source": { "fixture": true, "citation": "BZM 1.0 教科書 §14 出来事3か月" },
  "review": { "decision": "adopt", "basis": "textbook_fixture", "teaching": true } }
```
教材以外の通常の明細で、点推定（`kind: "estimate"`）の E-03 のような例を置くことは禁止する（評価者 2 名の分布 `pool` が必須）。例を示すときは、上のように `teaching: true` の教科書の例として明示するか、資料に書かれた確定値を `observation` の実績として入れる。
教材の `date` は基準日 2026-01-01 からの経過月で配置した抽象的な日付で、実際の出来事の日付ではない。通し事例は 1 か月目〜39 か月目のうち、節目 4 件と出来事 9 件を並べる。実運用の明細は `teaching` を付けず、`source` に `docId`・`revision`・`quote`（400 字以内）、`review` に確認者 `reviewer` と確認日 `reviewedAt` を書く。

## 認証情報
- `GOOGLE_ACCESS_TOKEN`: Google Sheets / Docs を読み書きできるアクセストークン。環境変数で渡す（値をファイルや履歴に書かない）。`read` と `apply --apply` で使う。
- `GEMINI_API_KEY`: `extract` だけが使う。環境変数で渡す。未設定のとき `extract` は呼び出しを省略し、`llm.status` は `no_api_key` になる。
- どちらも標準出力・履歴ファイルには出ない。

## 手順（所有者が実行）
書込みは単一の指定シート 1 枚だけ。`apply` は毎回 `--spreadsheet "$SHEET_ID"` を付け、計画の `spreadsheetId` と一致しなければ止まる。`--apply` を付けない `apply` は書込みなしの確認になる。
```sh
cd /Users/masa/projects/AMD/amd-os/model/tools/bzm-sheet-pilot
export SHEET_ID='指定シートのID'        # GOOGLE_ACCESS_TOKEN は別途環境変数に設定済みとする
node pilot.mjs read --sheet "$SHEET_ID" > read.json
node pilot.mjs init < read.json > init.json
node pilot.mjs apply --spreadsheet "$SHEET_ID" --apply < init.json        # 4タブを作る（空のファイルだけ）
node pilot.mjs read --sheet "$SHEET_ID" > read.json
node pilot.mjs plan --read read.json --as-of 2026-01-01T12:00:00+09:00 < textbook-plan-input.json > plan1.json
node pilot.mjs apply --spreadsheet "$SHEET_ID" --apply < plan1.json       # 初回（ICV 151.9 / rNPV 12.69）
node pilot.mjs read --sheet "$SHEET_ID" > read.json
node pilot.mjs plan --read read.json --as-of 2026-04-01T12:00:00+09:00 < textbook-plan-input.json > plan2.json
node pilot.mjs apply --spreadsheet "$SHEET_ID" --apply < plan2.json       # 更新後（同月・更新前 152.7 / 13.00 → 157.7 / 13.62）
node pilot.mjs replay < textbook-plan-input.json                          # 表 14.1/14.2 を再計算
```
- `init` は 1 タブだけの空のファイルにだけ使える。評価履歴のタブは見出しの列数（30）に合わせて 26 列から広げてから見出しを書く。
- `plan` は前回の状態をシートから読み、入力が同じなら書込みなし（`no_change`）になる。

## テスト
リポジトリのルートから実行する。
```sh
node --test model/tools/bzm-sheet-pilot/*.test.mjs
```
`model/tools/bzm-sheet-pilot` に移動して実行する場合は `node --test *.test.mjs`。

## Docs からの抽出（`extract`）
Google Docs の本文から、§12.2 の事象の候補を作る。候補は登録簿に入らない。
1. `read --doc <docId>` が本文と版（revisionId）を段落に分けて返す。
2. `extract` が段落ごとの SHA-256 を取り、前回の状態（`state`）と比べて、新しい段落・消えた段落・未抽出の段落を数える。同じ段落版は再抽出しない。
3. 未抽出の段落だけを上限バイト数までまとめ、Gemini へ送る（モデルは入力の `model`、省略時 `gemini-3.1-flash-lite`）。応答は決まった JSON の形式に限る。
4. 応答の候補を検査し、通らない候補は `rejected` に理由別の件数で残る（検査の詳細は `book-observation.mjs` の `validateBookCandidates`）。
5. 出力の `snapshot`（資料 ID・版・段落ハッシュ・抽出済みの印）を、次回の `extract` の入力 `state` に渡す。
   - `plan` に渡す `extract` は、抽出器の出力（`extraction`・`snapshot`・`llm`・`usage`・`delta`）を元の形のまま含める。`llm.status` が `ok`、または送信 0 件の `skipped` のときだけ検査に通る。`no_api_key`・`timeout`・`invalid` などでは位置を進めない。
   - 進めた位置は状態の `extract.cursor`（資料 ID・版・段落ごとの件数・抽出済みの印・抽出器）に保存する。ハッシュはこの位置から作るため、同じ版で変更がなければ変わらない。
   - 使ったモデル・プロンプトのハッシュ・生成設定・使用量は、状態の `extract.audit` と「処理記録」に残る。資料の本文は残さない。
```sh
node pilot.mjs read --doc "$DOC_ID" > doc.json        # {"doc": {...}} が出る
# doc.json の "doc" を {"doc": ..., "state": 前回の snapshot または null} の形にして渡す
node pilot.mjs extract < extract-input.json > candidates.json
```
6. 人が `candidates.json` の候補を読み、採用するものだけを `registry` の明細にする。確認者・確認日（`review.decision: "adopt"`）を人が書く。この確認の後でだけ `plan` が評価に入れる。LLM の出力が直接、評価や登録簿を変えることはない。

## 制限
- 節目の不成立（`passed:false`）の経路は未対応（`gate_failure_not_supported`）。
- 事象が節目と同じ月の場合は評価できない（`event_on_gate_month`）。
- 全節目を越える経路だけを再計算する。月次の全体シミュレーション（第4〜7章）の結果は出さない。
- 評価値への投影は、離散点では厳密、5 分位点の区分線形では中点の数値投影（近似）。量ごとの要約は §18.6.7 に従い厳密。同時分布の組は 2000 まで。
- 固定入力 1 組のとき分位点は計算しない。
- 評価者の混合は、実在の別 ID の評価者 2 名が独立に入力した場合にだけ意味を持つ。教材の通し事例には混合を入れていない。
- 実際の利用者による評価は未検証。実際の Docs・Sheets を使った確認には、上の架空議事録を使った。

## 旧版（BZM 3.0 内部版）
`legacy-extract` / `legacy-plan` / `legacy-init` と `pilot.test.mjs`。旧状態を新コマンドへ渡すと `legacy_state_rejected` で止まる。
