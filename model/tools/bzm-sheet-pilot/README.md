# BZMの評価記録と予測の照合

Google Docs の更新 → AI が候補を抽出 → 人が採用 → BZM 3.0 で評価 → 専用 Google Sheets へ追記する試作。
Node標準ライブラリで動く。評価には、今のAMD OSで承認済みのBZM 3.0内部版を使う。

```
node model/tools/bzm-sheet-pilot/pilot.mjs <extract|plan|read|init|apply>
node --test model/tools/bzm-sheet-pilot/
```

## 流れ

1. `init` — 空のファイルに 4 タブ（「評価履歴」「観測」「予測・実績」「処理記録」）とヘッダを作る requests を返す。
2. `read` — Docs 本文と Sheets の状態を読む（`GOOGLE_ACCESS_TOKEN` が必要）。
3. `extract` — 前回の状態と比べて、新規・変更の段落だけから候補を作る。
4. 人が採用する候補 ID を選ぶ。
5. `plan` — 採用分で BZM を再評価し、Sheets への追記 requests を返す。
6. `apply` — 保存直前に状態を読み直し、一致したときだけ 1 回の `batchUpdate` で書く。

## 入力契約（document）

### extract

```json
{ "doc": {"id": "...", "title": "...", "revision": "...", "text": "段落は空行で区切る"},
  "state": null,
  "model": "gemini-3.1-flash-lite",
  "rates": {"input": 0.0, "output": 0.0} }
```

- `state` は前回 `extract` が返した `snapshot`（初回は null）。`plan` が成功して保存した後の `state.doc` と同じもの。
- `rates` は米ドル／100万トークン。入出力の実測使用量に指定した単価を掛けて返す。請求額を取得する機能はない。
- `GEMINI_API_KEY` がある場合だけ Gemini を 1 回呼ぶ（1 回に送る段落は合計 10000 バイトまで、出力 4096 トークン、思考レベル minimal、30 秒、再試行なし）。超過分は次回に繰り越す。
- 出力: `delta`（追加・削除・送信数）, `candidates`, `rejected`（落とした理由の件数）, `usage`, `llm.status`, `snapshot`。
- 候補は、同じ段落に実在する原文引用・値・出来事の日付・名称を持つ。引用が段落に無い候補は捨てる。予定・見込みは `status: "planned"` になり、`plan` で採用できない。
- 同じ段落の版は一度抽出したら再抽出しない。呼び出しが失敗した版は抽出済みにしない。
- 指示文は `prompt.md`（`--prompt` で差し替え可）。

### plan

```json
{ "extract": "<extract の出力>",
  "state": null,
  "approved": ["候補ID"],
  "base": {"type": "F2", "reg": "REG0", "gate": "T2", "incorporated": false},
  "asOf": "2026-11-15T00:00:00Z",
  "forecast": {"question": "", "probability": 0.6, "deadline": "2026-12-31", "criterion": "", "event": ""},
  "actual": {"forecastId": "", "candidateId": "", "outcome": "yes"},
  "tabs": {"評価履歴": 0, "観測": 1, "予測・実績": 2, "処理記録": 3},
  "spreadsheetId": "..." }
```

- `state` は `処理記録!B2` の JSON（`read` の `sheet.state`）。
- 評価は、採用済みの現金残高または毎月支出が 1 件以上あるときに行う。円 → 万円（現金・支出）、円 → 億円（年額純増）に換算して BZM に渡す。年額純増が無いと億円の値は空欄。評価履歴の「年額純増(億円・推定前提)」は、採用した試算値であり実績ではない。
- 評価の重複判定は、直前の評価（`state.lastEval`）と同じ入力・版・モデルかどうかだけで行う。A → B → A と入力が戻れば再計算して追記する。採用済みの候補を再度渡しても追記しない。
- 評価に関係ない新規段落を AI が正常に処理した場合は、評価履歴を追記せず、処理記録だけに追記して状態（カーソル）を保存する（`summary.status` = `cursor_only`）。既に処理した版の再実行は API 呼び出しも書き込みも 0。呼び出し失敗や繰り越した段落は未抽出のまま残る。
- 未採用の候補を保留する機能は無い。1 回の `plan` で採用を確定する。採用しなかった候補は次回以降の抽出に出ない。
- `extract` に渡す `state` は、`read` の `sheet.state.doc`。
- 日付の判定は日本時間（JST）の暦日。`event_date` が `asOf` の日より後の候補は採用しない（`future_event_date`）。
- `forecast` は保存後に上書きできない（同じ ID で確率や基準を変えるとエラー）。
- `actual` は、予測保存より後（日付で後）で `asOf` 以前の、採用済み `trial_result` 候補だけを参照できる。候補の名称は予測の `event` と一致する必要がある（不一致は `trial_name_mismatch`）。達成 → yes、不達 → no。予測期限より後の達成は yes にできない。不達による no は、`asOf` が予測期限の日以降のときだけ確定できる（`no_before_deadline`）。同じ予測への二重記録は不可。
- 実績の行の「系統」列は「利用者が固定した予測」。評価履歴の BZM 数値とは別のタブ。
- `extract` は、年額純増の採用済み試算（例:「見込みを1.2億円から1.35億円へ改めることを決定」）を `status: "actual"` で出す。この actual は「モデル入力として使う承認済みの見積を採用した」事実を表し、実績金額ではない。他のカテゴリの見込み・予定は引き続き `planned`。
- 出力: `state`（次の保存用）, `requests`（`appendCells` と状態セルの `updateCells`）, `summary`, `prevStateHash`。

### apply

```
node pilot.mjs apply --spreadsheet <ID> [--apply] < plan出力.json
```

`--apply` が無いと何も書かない。`--apply` があり、ID が plan の `spreadsheetId` と一致し、保存直前に読み直した状態が plan 作成時と同じときだけ書く。コネクタ経由でも、`requests` をそのまま反映できる。

## モデルの固定

`model/LOCK.json` に載っている `bzm30_forward.cjs` の SHA-256 と実ファイルを照合し、不一致なら止まる。`model_version.cjs` は LOCK.json に載っていないため、SHA は評価履歴の「ロックSHA」に加え、`plan` の `summary.lock.modelVersionFileSha` に記録するだけで照合しない。承認番号は `LOCK.json` の `approval_ref`。

## 試作の範囲

- 1プロジェクトにつき、専用スプシ一冊とGoogleドキュメント一冊を使う。初回、更新ともに担当者が実行する。利用者のGoogle認証画面と定期実行は別途作る。
- スプシの履歴は1人の書き手が更新する。行と状態を保存する直前に、他の書き込みがないことを確認する。スプシ所有者はセルを直接変更できる。
- `asOf` は評価と予測を扱う基準日時。実用時は現在時刻を使う。再現用の架空ケースにはテスト上の日時を使える。
- `read` / `apply` でGoogleのAPIを直接呼ぶ場合は、対象ファイルに使える短期のGoogleアクセストークンが必要。試作の実ファイル検証はGoogle Workspaceの連携機能を通じ、同じ書き込み要求を適用する。
- 製品として定期実行する前に、文書の編集・削除や表の扱い、抽出料金の月上限、複数担当者による同時更新を検証する。

## 実ファイルでの確認（2026-11-15）

- 架空の外観検査PJで、初回の評価・利用者予測をスプシに保存してから、同じGoogleドキュメントに結果を追記した。2回目に追加5段落だけを抽出し、評価と実績を追記した。3回目はAI呼び出し・追記ともに0件。
- 10〜90%点と中央値は承認済み計算で出した。2回目は同一入力で先に得た参照計算の金額を突き合わせて保存した。計算時間はこの例で約10分／評価。
- Gemini 3.1 Flash-Liteで、初回の架空議事録20件は対象11件のうち10件。修正後は同じ資料で11件、新しい架空議事録8件で対象5件を抽出した。いずれの比較も誤検出0件。件数と実測使用量、料金換算は試作スプシの「抽出検証」に保存した。
