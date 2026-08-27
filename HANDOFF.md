# HANDOFF

最終更新: 2026-08-27 JST
対象: **シーズのスコアを BZM 3.0 へ差し替え。案件ごとの入力を OS のデータから埋め直す作業が途中**

## 今回のセッション（2026-08-27）

まさ「シーズリストの各シーズをクリックしたときに出てくるモーダルの中の計算式を『一次選別スクリーニング』なんていう
存在しないスクリーニング方法にせずに BZM3.0 の SPS 算出のモデルを入れてほしい」から始まり、
**画面の差し替え → 21件の算出 → 入力が不十分と判明 → 金額を伏せる**まで進んだ。

1. **シーズ詳細に BZM 3.0 のパネル**（式17本・係数73件・格子72通り・入力の充足表）。式はモデルページの正本から、
   係数の値は参照実装から取り、画面が数字を書き起こさない
2. **旧SPS（一次選別スクリーニング帯）を全撤去** — シーズ一覧の列、シーズ詳細、PJコックピットのスコア詳細タブ
3. **案件ごとの入力を DB へ**（migration 331。用途ごとの天井 / 工程の型・証拠水準・観測状態 / 算出結果）
4. **21件を算出したが、入力が不十分だったので金額を伏せた**（`BZM30_SCORES_PUBLISHED = false`）

実装の履歴は [design_log/sessions_2026-08.md](pwa/design_log/sessions_2026-08.md)、
仕様は [pwa/spec 4-8](pwa/spec/4-8-bzm30-seed-score-panel-current-spec.md)、
事故と教訓は [BUGS.md](BUGS.md)。

## いま止まっているところ

**21件のスコアを、OS にある全データから入力を埋め直して再計算する。** これが次の主タスク。

読んだのは `project_xrl_log` と `monthly_reports` 1か月分だけ。`project_id` を持つテーブルは **165ある**。
資金繰り・月次損益・議事録・契約・知財・創業メンバー・補助金・メディア掲載は**一度も開いていない**。
実データと突き合わせたら大きくずれていた（詳細は BUGS.md の2件目）。

### 埋まっていないパラメータ（21件すべてで null）

| パラメータ | 効き先 | OS のどこにあるか |
|---|---|---|
| 手元資金 `free_cash_yen` | 撤退の確率を直接動かす | `project_monthly_cashflow`（p07のみ）/ 議事録の残高記述 / 取締役会資料 |
| バーンレート | 同上（既定値は実績の 1/2〜1/3） | `project_pl_monthly`（p09・p20・p21・p24）/ 議事録 |
| 担い手 `evangelist_e` | 前進・採択・申し出の三か所 | `project_founding_members` / `project_venture_members` / `project_management_organization_roles` / 議事録の実働記録 |
| 専有可能性 `kappa_ip` | 取り分・競合消失・申し出 | `project_ip_assets`（p10に13件） |
| 自走力 `self_revenue_yen_month` | 資本自立と受託の連鎖 | `contracts`（p07に84件、p11に69件、p09に49件）/ `project_pl_monthly` の売上 |
| 追い風 `sigma` | 採択・申し出・競合消失 | `project_grants` / `project_media_mentions` |
| 権利残件 `rights_open` | 前進・会社化・申し出を塞ぐ | `project_ip_deadlines` / `project_important_documents` |
| 単位採算 `unit_margin_positive` | 経済性の乗数 | `project_cost_models`（p07・p21） |

### PJ別のデータ量（議事録 / 契約 / 資金 / 創業メンバー / 知財）

p21 SolvioraX 158/7/69/19/– ・ p07 LiSTie 66/84/12/1/– ・ p20 CryoX 45/10/60/25/– ・
p11 Blue Water 31/69/–/19/– ・ p06 CTB 24/24/–/15/– ・ p09 JOYCLE 24/49/10/18/– ・
p26 VasculaX 16/1/–/4/– ・ p29 KENQ 9/1/–/–/– ・ p24 CLG 7/2/6/–/– ・ p10 SE 5/6/–/–/13

p31 と 熱電（seed-a1390f71）は OS にデータが無い。

## 未解決（まさの判断待ち）

1. **休眠を入れるか** — 会社化前の資金切れでは死なない、という改訂。別セッションが提案を書いている
   （`model/proposals/2026-08-27_bzm30-dormancy.md`）。**未承認のまま参照実装の既定に入っている**ので、
   いまの算出は承認済みの版（`git show 40aebfe9:model/tools/bzm30_forward.cjs`）で走らせている
2. **旧SPS の DB データ（`seed_screening_bands` 998行）を物理削除するか** — 画面からは全部消した。
   消すと戻せないので確認待ち
3. **置き換え分 δ_u の解釈**（p21 産業排水・p02 動画制作）— 天井を保留にしている理由

## 分担（まさ確定 2026-08-27）

- **別セッション**: BZM 3.0 のモデル本体を作る（参照実装・正本・自動算出の設計 `pwa/spec/5-12`）
- **このセッション**: 現状のモデルでパラメータを埋める

同じ checkout を共有しているので、長い計算の前後で `git log --oneline -5 origin/main` を見る。
計算の入力になる `model/tools/bzm30_forward.cjs` が変わっていたら、計算をやり直す。

## 次にやること（この順）

1. `information_schema` で PJ × テーブルの件数表を出し、**どれを読むかを決めてから**着手する
2. PJ ごとに、上の表のテーブルを順に開いて8つのパラメータを判定し、根拠を1件ずつ `*_reason` / `note` に残す
3. `node model/tools/bzm30_score_seeds.cjs <seed_id> --impl <承認済みの版>` で再計算
4. `BZM30_SCORES_PUBLISHED = true` に戻し、`model/cases/SCORES.md` を `bzm30_scores_md.cjs` の出力で貼り替える

## 検証（このセッションで実際に走らせたもの）

```
npx tsc --noEmit                     # pwa/ で
npx eslint <触ったファイル>
npm run build                         # exit 0
npm run test:critical-ui              # pre-commit で強制的に走る（2026-08-27〜）
npm run test:reference-data-cache
npm run test:seed-list-display / test:current-sps-only / test:seed-screening-bands
node pwa/scripts/model_lock.cjs relock --approval <id>   # モデル正本を触ったとき
```

本番は `https://amd-os-pwa.vercel.app`。push すると Vercel が自動でデプロイする。
`curl -s https://amd-os-pwa.vercel.app/api/build-info` で git_sha を確認する。
