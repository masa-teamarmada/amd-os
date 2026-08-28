# HANDOFF

最終更新: 2026-08-28 JST
対象: **シーズの産業創出価値（BZM 3.0）。入力を埋め切り、天井を SAM で組み直した。次はモデル本体の2点に着手する**

## 今回のセッション（2026-08-27〜28）

**21件の入力を OS の全データ・まさからの聞き取り・ネット調査から埋め、天井を SAM で組み直して画面へ戻した。**

1. **棚卸し** — `project_id` を持つ165テーブルのうち99を読み、66を理由つきで読まないと決めた（[INVENTORY.md](model/cases/INVENTORY.md)）
2. **空欄をゼロに** — 全21件・全12項目に値と根拠。根拠はパラメータ1件ずつの欄へ（migration 332）
3. **天井を TAM → SOM → SAM** — シェアは天井に入れない（モデル側の取り分が担うので二重計上）
4. **金額を画面へ戻した**（`BZM30_SCORES_PUBLISHED = true`）

スコアの一覧と読み方は [model/cases/SCORES.md](model/cases/SCORES.md)、実装の履歴は
[design_log/sessions_2026-08.md](pwa/design_log/sessions_2026-08.md)、事故は [BUGS.md](BUGS.md)。

**いまの上位**: OptQC 574億 / LiSTie 154億 / マテリアル・コンセプト 88億 / CryoX 74億 / JOYCLE 45億。
**下位**: 翔エンジニアリング 4,949万 / ORLIB 3,547万 / 熱電 532万 / ZEO 203万 / r3kt 37万。

## いま止まっているところ

**まさ 2026-08-28「組織の評価ができていないことと『これ以上ゲートを越えない』の両方をモデルに入れるところに着手しよう」。
これが次のタスク。** 提案は書いてある（未承認）: [model/proposals/2026-08-28_bzm30-organization-input.md](model/proposals/2026-08-28_bzm30-organization-input.md)

優先順位（提案の中で更新済み）:

1. **変換能力 $c$ を案件ごとに受け取る（提案7）** — **正本の要件1に挙げた量が実装に入っていない。**
   §5.3 に測り方（投入した資金と月数に対して越えたゲートの数の比）まで書いてあるのに、
   参照実装は `cNodes` を全案件共通で回すだけ。設立前に獲得した資金がどれだけ案件の資産へ変換されたかも、
   ゾンビ化（これ以上ゲートを越えない）も、これで表せる。実装は `cNodes` の差し替えだけで軽い
2. **案件ごとのバーンレート（提案6）** — 実績が既定の2〜37倍ずれている。値は `burn_rate_yen_month` に入っている
3. **八機能の充足（提案1〜3）** — 組織の中心。**機能2（技術の核）が「空席にならない」と規約で固定**されていて、
   ORLIB の「誰も電池を作れない」を表せない。計算量が2倍（1件5〜6分）
4. **権利残件に資本の種類（提案5）** — SHA未締結・支配権の集中。実装は軽いが設計の判断が要る
5. **機能の補完性（提案4）** — CEOとCTOの関係、チームの一体感。較正の材料が無いので乗数から

## まさの判断待ち

1. **休眠の承認** — `model/proposals/2026-08-27_bzm30-dormancy.md`（別セッションが起票、**未承認**）。
   「会社化前の資金切れでは死なない。研究室は大学の基盤で存続し、次の公的資金を待つ」という改訂。
   **未承認なので、いまの算出は承認済みの版（`git show 40aebfe9:model/tools/bzm30_forward.cjs`）で走らせている。**
   承認されると会社設立前の6件（CryoX・SolvioraX・VasculaX・KENQ・ZEO・熱電）の残高の感度が消えるので、全件やり直しになる
2. **組織の入力の提案7件**（上記）
3. **置き換え分の割合** — p21 SolvioraX 7割・p02 r3kt 8割・p05 マテリアル・コンセプト 5割はいずれも暫定。純増が2〜4倍動く
4. **旧SPS の DB データ（`seed_screening_bands` 998行）を物理削除するか** — 画面からは消えている

## この作業で分かった、OS の運用の穴

**開催日を過ぎても中身が空の会議カードが26件・10PJ分**（2026-07-09〜08-26）。
LiSTie 8/26経営会議、SolvioraX経営会議、CLG取締役会を含む。議事録はNotionにあるのにカードが更新されていない。
塞ぐための別セッション用プロンプトは [SESSION_PROMPT_MEETING_CAPTURE.md](SESSION_PROMPT_MEETING_CAPTURE.md)。

**`NOTION_API_KEY` はローカルの `.env.local` に無い**ので、手元のセッションからNotionを取りに行けない。

## 分担（まさ確定 2026-08-27）

- **別セッション**: BZM 3.0 のモデル本体（参照実装・正本・自動算出の設計 `pwa/spec/5-12`）
- **このセッション**: 現状のモデルでパラメータを埋める → **今回で完了。次はモデル本体側へ着手する**

同じ checkout を5〜10セッションが共有している。長い計算の前後で `git log --oneline -5 origin/main` を見る。
計算の入力になる `model/tools/bzm30_forward.cjs` が変わっていたら計算をやり直す。

## 最初の次アクション

`model/proposals/2026-08-28_bzm30-organization-input.md` の**提案7（変換能力 $c$）から着手する。**
`model/MODEL_VERSION_LEDGER.md` の §5.3 と §6.I-9-1 を読み、`cNodes` を `init.c` で差し替える形を実装して、
21件に $c$ を置いて再計算する。まさの承認を取ってから正本へ統合する（`model/README.md` (c) の手順）。

## 検証（このセッションで実際に走らせたもの）

```
cd pwa && npx tsc --noEmit
npx eslint <触ったファイル>
npm run build                         # exit 0
npm run test:critical-ui              # pre-commit で強制的に走る
npm run test:reference-data-cache
npm run test:seed-list-display / test:current-sps-only / test:seed-screening-bands
node pwa/scripts/model_lock.cjs relock --approval <id>   # モデル正本を触ったとき
```

算出: `node model/tools/bzm30_score_seeds.cjs <seed_id> --impl /tmp/bzm30_forward_approved.cjs`（1件0.5〜6分・並列6）。
承認済みの版は `git show 40aebfe9:model/tools/bzm30_forward.cjs > /tmp/bzm30_forward_approved.cjs` で取り出す。
表の貼り替えは `node model/tools/bzm30_scores_md.cjs` の出力を `model/cases/SCORES.md` へ。

本番は `https://amd-os-pwa.vercel.app`。push すると Vercel が自動でデプロイする。
`curl -s https://amd-os-pwa.vercel.app/api/build-info` で `git_sha` を確認する。
