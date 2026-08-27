# 次セッションへの引っ越しプロンプト

cwd: `/Users/masa/projects/AMD/amd-os`

---

AMD OS の作業を続けて。**シーズの産業創出価値（BZM 3.0）の入力を、OS にある全データから埋め直す**のが今回のタスク。

## 読む順（この順で全部読む）

1. `/Users/masa/projects/AGENTS.common.md` — えいみ共通ルールの正本
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md` — AMD 配下の記憶
3. `HANDOFF.md` — 現在地・止まっているところ・未解決
4. `BUGS.md` — 今回の事故2件（guard の消し忘れ / OSのデータを読まずに算出した件）。**同じことを繰り返さない**
5. `pwa/spec/4-8-bzm30-seed-score-panel-current-spec.md` — 画面とテーブルの仕様
6. `model/README.md` の (g)(h) — 参照実装と算出ツールの使い方
7. `model/cases/SCORES.md` — 伏せた金額と、ずれの一覧

## 状態

- git: `main` 一本、origin と同期済み（HEAD は「産業創出価値の金額を画面から伏せる」）
- 本番: `https://amd-os-pwa.vercel.app`。push すれば Vercel が自動デプロイ
- 画面: シーズ一覧の金額は「入力を埋め直し中」、シーズ詳細のスコアは伏せた状態で本番に出ている。
  **入力の充足の表・式17本・係数73件は伏せていない**
- DB: 21件分の入力が `seed_bzm30_inputs` / `seed_value_ceilings` に入っている。
  算出結果は `seed_bzm30_scores`（伏せているだけで消していない）
- **`pwa/src` を触った commit は `check_pwa_critical_ui.cjs` が pre-commit で強制的に走る**（迂回不可）

## タスク

**21件の PJ について、OS にある全データを読んで BZM 3.0 の入力を埋め直し、再計算する。**

前のセッションは `project_xrl_log` と `monthly_reports` 1か月分しか読まずに入力を決めて、まさに指摘された:

> OSのそのPJのすべての情報を見てって言ったはず。
> そうしないと、そもそも全パラメータの数値を決めるとか無理じゃないの？
> 全部見てって言ったのに一部しか見てない理由が分からん。

`project_id` を持つテーブルは **165ある**。実データと突き合わせたら、使っていた値は大きくずれていた:

- LiSTie の手元資金: 入れた値 1.5億 / 資金繰り表の実績 2.24億
- CLG のバーンレート: 使った既定値 月400万 / 実績 月800〜1,200万
- CLG のランウェイ: 見ていなかった / 取締役会で「入金がなければ12月末、判断期限は11月末」。人員削減の交渉中
- JOYCLE のバーンレート: 既定値 月400万 / 実績 月866万
- SE の資金の経路: 既定は民間調達あり / 議事録では「民間投資だけでは立ち上がらない。国費を原資とする」

### 手順

1. **まずデータの棚卸し。** `information_schema.columns` で `project_id` を持つテーブルを列挙し、
   PJ × テーブルの件数表を出す。読むテーブルを決めてから着手する。読まないと決めたものは、その理由を残す
2. PJ ごとに、次の8つを判定して `seed_bzm30_inputs` へ入れる。**根拠を1件ずつ `*_reason` / `note` に残す**
   - 手元資金 / バーンレート / 担い手 / 専有可能性 / 自走力 / 追い風 / 権利残件 / 単位採算
   - どこに何があるかは `HANDOFF.md` の表
3. `node model/tools/bzm30_score_seeds.cjs <seed_id> --impl <承認済みの版>` で再計算（1件2〜3分。並列5〜6で回す）
   - **承認済みの版**: `git show 40aebfe9:model/tools/bzm30_forward.cjs > /tmp/bzm30_forward_approved.cjs`
   - 休眠（会社化前の資金切れでは死なない）が未承認のまま既定に入っているので、それを避けるため
4. `pwa/src/lib/bzm30/seed-inputs.ts` の `BZM30_SCORES_PUBLISHED` を `true` に戻す
5. `node model/tools/bzm30_scores_md.cjs` の出力で `model/cases/SCORES.md` の表を貼り替える
6. commit → push → 本番で確認

### まさへの確認が要るもの（勝手に決めない）

- 休眠を入れるか（未承認のまま参照実装の既定に入っている）
- 旧SPS の DB データ（`seed_screening_bands` 998行）を物理削除するか
- 置き換え分 δ_u の解釈（p21 産業排水・p02 動画制作。天井を保留にしている）

**それ以外は確認で止まらずに進める。** まさ 2026-08-27「その確認しないと進められないわけじゃないでしょ？
進めといてくれたらもう終わってたのに」。

## このPJで守るルール

- **分担**: 別セッションが BZM 3.0 のモデル本体（参照実装・正本・自動算出の設計 `pwa/spec/5-12`）を作っている。
  こっちは**現状のモデルでパラメータを埋める**。モデルの式や係数は触らない
- **同じ checkout を共有している。** 長い計算の前後で `git log --oneline -5 origin/main` を見る。
  計算の入力になる `model/tools/bzm30_forward.cjs` が変わっていたら計算をやり直す（前回40分捨てた）
- **モデル正本（`model/MODEL_VERSION_LEDGER.md` ほか LOCK 対象）を触ったら relock**:
  `node pwa/scripts/model_lock.cjs relock --approval <承認ID>`
- **未承認の値を画面に出さない**（`model/README.md` (b)）。承認済みの版で計算し、どの版で計算したかを
  `seed_bzm30_scores.inputs.impl` に残す
- **画面から要素を消したら、その存在を要求している guard も同時に外す。** pre-commit で強制されるが、
  落ちてから直すのではなく最初から見る
- **検証**: `npx tsc --noEmit` / `npx eslint` / `npm run build` / `npm run test:critical-ui` /
  `npm run test:reference-data-cache`。commit・push・deploy まで進めて本番で確認する
- **`next dev` は `pwa/AGENTS.md` を勝手に書き換える。** dev サーバを起動したら commit 前に
  `git diff pwa/AGENTS.md` を見て戻す
- **並列でDBへ書くと `fetch failed` が出る。** 算出ツールにはリトライが入っているが、
  新しく書くときも同じ手当てをする
- **長い処理はバックグラウンドで投げたら turn を終える。** 投げた直後に確認しても実時間は進まない
