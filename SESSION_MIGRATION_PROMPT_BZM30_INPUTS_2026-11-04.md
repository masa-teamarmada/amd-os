# 引っ越しプロンプト — BZM 3.0 の入力の実データ化と、入力を動かす画面

作成: 2026-11-04 JST。前回の実作業は 2026-08-30〜31、その後2か月空いている。
**2か月のあいだにモデルが改訂され、案件が21件から42件へ増えている。下の「状態」を鵜呑みにせず、着手前に実物を見ること。**

---

## 読む順（この順で全部読む）

1. `/Users/masa/projects/AGENTS.common.md` — えいみ共通ルールの正本
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md` — AMD 横断の記憶
3. `/Users/masa/.claude/projects/-Users-masa-projects-AMD-amd-os/memory/MEMORY.md` — このPJの記憶
4. `AGENTS.md` の「Vercel」節（78〜90行目あたり）— **反映を飛ばす仕組みの正本**
5. `model/cases/SCORES.md` — スコア一覧。**表は現在値、下の各節は 2026-08-30 時点の記述**
6. `model/cases/README.md` — 入力の置き方の規約（「残高と支出は同じ側で揃える」「天井は担える範囲で絞る」）
7. `model/README.md` — 変更の運用規約（提案→承認→APPROVALS記録→反映→relock）
8. `model/APPROVALS.md` の **#2026-09-02-1**（最新。反実仮想の控除を外した回）
9. `model/MODEL_VERSION_LEDGER.md`（= モデルページ `/model` の正本）の §5.2 / §5.3 / §5.4 / §6.I-9-1 / §6.I-9-2 / §7.1 / §7.2
10. `pwa/design_log/sessions_2026-08.md` の末尾「2026-08-30〜31」節 — 前回やったこと全部
11. `pwa/spec/4-8-bzm30-seed-score-panel-current-spec.md` — スコアパネルと入力を動かす画面の仕様
12. `BUGS.md` と `pwa/BUGS.md` — 事故の記録

**`HANDOFF.md` は読まなくていい。** 2026-10-23 の別件（経営会議の管理画面）の引き継ぎになっている。
BZM の現在地はこのプロンプトと上の 5・10。

---

## 状態（2026-11-04 00:50 JST 時点で実測）

- **git**: `main` 一本、`origin/main` と完全同期（ahead 0 / behind 0）、未push なし、dirty なし。最新 `e0e2497c4`
- **モデル**: 承認 **#2026-09-02-1** が最新。**2026-09-02 に反実仮想の控除（この案件が無くても他者が実現していた分の差し引き）をモデルから外した**ので、2026-08-30 までの版より全体の水準が一桁上がっている
- **スコア**: `seed_bzm30_scores` の最新行は `approval_ref='2026-09-02-1'`、再計算は 2026-09-06。**42件**（8月末は21件）
- **上位**（2026-11-04 時点）: LiSTie 1,275.7億 / OptQC 1,021.4億 / CryoX 856.1億 / 165〜220nm次世代クリーンUV面光源 833.1億 / マテリアル・コンセプト 359.7億 / KENQ 290.2億
- **曲線**: `seed_bzm30_sensitivity` は **19件ぶん・1,000行しか入っていない**（最終計算 2026-09-06）。42件に対して23件が欠けている
- **画面**: `/seeds/sensitivity`（シーズ一覧の右上「入力を動かして見る」）は生きている。曲線の無い案件は「計算中」と表示する
- **本番**: `https://amd-os-pwa.vercel.app`。反映の確認は `curl -s https://amd-os-pwa.vercel.app/api/build-info`

---

## 次のタスク（優先順）

### 1. 曲線を42件へ揃える（機械作業・最優先）

19件で止まっているので、入力を動かす画面が半分以上「計算中」のまま。まさが使えない。

```
node model/tools/bzm30_sensitivity.cjs --list | xargs -P 6 -n 1 <1件ずつ走らせる小さなsh>
```

- **1件あたり1〜7時間かかる案件がある**（会社化前・段階1 のものが重い）。バックグラウンドで投げて turn を終える
- `xargs` へ `sh -c '...{}...'` を直接渡すと「command line cannot be assembled, too long」で全部落ちる。1件を受け取る小さな `.sh` を作って `-n 1` で渡す
- 書き込みの再試行は実装済み（`TypeError: fetch failed` は戻り値の error ではなく **throw** で来る。try/catch で受けないと数時間の計算を捨てる）
- 計算が終わったら `/seeds/sensitivity` を実際に開いて「計算中」が消えたことを見る

### 2. 提案5（資本の種類: SHA未締結・支配権の集中）

`model/proposals/2026-08-28_bzm30-organization-input.md` の提案5。**未承認のまま**。
ORLIB（経営者が67%を持ち、出資したトヨタ紡織CVCが株主間契約を結んでいない）とティエムの
M&A・知財売却の出口が、実態より開いたまま出ている。実装は軽いが、
**「時間が経てば解ける残件として持つか、解けない状態として持つか」の設計判断**が要る。
まさに骨格を2案で見せて決めてもらう（抽象的なA/B/Cの要約ではなく、正本へ入れる実際の文面を見せる）。

### 3. JOYCLE（p09）の6月以降の月次資料

残高が **2026-05-31 実績から自社バーンで3か月前送りした推定値のまま**。
JOYCLE は「資金の崖」に乗っている案件で、残高を17.6%減らすと価値が35%落ちる帯にいる。
実残高が取れれば大きく動く（追加5,000万円規模の調達を株主へ依頼していたので、着金していれば上振れ）。
当時 Drive にも OS にも6月以降の月次資料が無かった。**いまは入っているかもしれないので、まず探す**。

### 4. CryoX（p20）と KENQ（p29）の天井の積み直し

どちらも上位なのに天井の確度が「低」のまま。順位の確度がここで決まる。
CryoX の天井の内訳は `seed_value_ceilings` の note にある（量子コンピュータの冷却508億 ほか4つの足し合わせ）。
量子コンピュータの部品別の市場規模は経済産業省の資料で積み直すのが宿題。

### 5. 提案4（機能の補完性）

同じ提案 md の提案4。CryoX の一体感（《組織》に positive の観測あり）の入れ先。乗数から。

### 6. 置き換え分の割合の確定（p21 7割・p02 8割・p05 5割は暫定）／旧SPS の DB 物理削除（持ち越し）

---

## 2026-08-30 に決着済み（蒸し返さない）

- **OPTMASS（p01）の天井は絞らない。** まさの裁定——ティエムのモノリスは SU 側の開発が資金で止まるが、
  透明太陽電池のボトルネックは電極側にあり OPTMASS の戦略余力では止まらない。
  「延命×届かない天井」の見分けは、**案件の側に残っている開発が資金で止まるかどうか**で決める。
  理由は `seed_value_ceilings` の note に記録済み
- **CryoX の設立後の計画支出は月150万円のまま**（まさ 2026-08-29「設立後いきなりバーンレートを550万まで
  一気に上げるなんて自殺行為」）。Drive の `p20_cx/ピッチ資料/CryoX財務計画.pdf`（2026-08-26・末永晃理さん作成）は
  2027年に装置1台しか作らないのに製造人員4名（年6,000万円）を置く前提で月778万円になっている。
  **まさが末永さんへ修正を伝える**と言った件。**2026-11-04 時点で直ったかどうかは未確認**

---

## このPJで守るルール

### モデル

- **正本はモデルページ本体ただ一つ**（`model/MODEL_VERSION_LEDGER.md`）。定義・式・値はここに書き、別ファイルへ切り出さない
- **提案 → まさへ実際の変更文面を見せる → 承認 → `model/APPROVALS.md` へ引用のまま記録 → 反映 →
  `node pwa/scripts/model_lock.cjs relock --approval <id>`**。ロックを先に書き換えて後から承認を取る順序の逆転はしない
- **未承認の値を画面に出さない。** いま未承認で残っているのは提案4・5・8
- **空欄を作らない。** 精度が低くても数値を置き、導出・確度・感度を書く
- **入力を置いたら順位の上位下位をまさに見せて違和感を聞く。** 2026-08-29 の改訂5点のうち3点はこの往復から出た
- 推定値には「何の推定か」を reason に書く（相場からの置き／逆算／実データ）。相場からの置きが実データと
  10倍ずれた例が2件ある（CrestecBio 月1,500万→133万、LiSTie 月4,196万→1,538万）

### 算出と検証

```
node model/tools/bzm30_score_seeds.cjs --list | xargs -P 6 -I{} node model/tools/bzm30_score_seeds.cjs {}
node model/tools/bzm30_scores_md.cjs    # 出力を model/cases/SCORES.md の表へ貼る。手で数字を書かない
cd pwa && npx tsc --noEmit && npx eslint <触ったファイル> && npm run build
npm run test:critical-ui && npm run test:reference-data-cache && npm run check:bzm30-sensitivity-base
```

- **長い計算はバックグラウンドで投げて turn を終える。** 投げた直後に確認しても実時間は進まない
- **実装ファイルを編集する前に、それを require している並列ジョブを止める**

### 共有 checkout

- 5〜10セッションが同じ作業場所を共有している。**編集したら即コミット**（stage 放置は他セッションの commit に巻き込まれる）
- `git add .` を使わない。触ったファイルだけ名指しで add。add の前に `git diff --cached --name-only` を見る
- 着手前と push 直前に `git fetch origin` して `git rev-list --left-right --count origin/main...HEAD` を見る
- `bzm/` は論文セッションが触っていることが多い。触る前に dirty を確認する

### 本番への反映

- **`pwa/` と、画面に出る文書（`pwa/manual`・`pwa/spec`・`bzm/`・`model/` の本文）を触る push は反映が1件走る。束ねて1回**
- **画面に出ない場所だけの commit は、件名へ `[skip ci]` が自動で付いて反映が飛ぶ**
  （`.githooks/prepare-commit-msg` が判定。一覧は `pwa/scripts/deploy_skip.mjs` の `SCREEN_INVISIBLE`）
- `node pwa/scripts/deploy_skip.mjs --explain` で、いまの push が反映を要するかどうかが分かる
- 新しく clone した作業場所では、commit の前に `git config core.hooksPath .githooks` を設定する

### まさへの報告

ファイル名・テーブル名・関数名・commit番号を本文に並べない。まさが開く画面で何がどう変わるか、
それでまさが何をできるようになったかで書く。判断してほしいことは選択肢を先に短く出す。
