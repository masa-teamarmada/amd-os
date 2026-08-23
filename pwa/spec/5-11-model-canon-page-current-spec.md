# モデル正本ページ 仕様

> **この章は何か**: `/model`（モデル正本の層）の確定実装仕様。
> とくに `/model/formulas`（BZM 2.2 の現行の式）が、式をコードへ書き写さずに正本 md から取り出す仕組みを定める。

## 目的と非目的

- 「いま現行なのはどの式か」を、正本を通読せずに1画面で確定させる。
- 画面はモデル定義を**持たない**。表示するのは正本 md から取り出したものだけにする。
- 新しい概念・変数・式をこの層で作らない。作れるのは `model/README.md` の承認手順だけ。
- スコアの合成・順位づけ・投資判断はしない。BZM 2.2 は前向き検証0件の pilot である。

## 3層のどこに何を置くか

| 層 | 置き場 | 中身 |
|---|---|---|
| 教科書 | `amd-os/bzm/` → `/bzm` | 本の原稿。解説、比喩、章立て |
| 設計書 | `pwa/spec/` → `/spec` | 実装仕様。DB契約、API、UI仕様（この文書） |
| モデル | `amd-os/model/` → `/model` | モデルそのものの正本と版数台帳 |

2026-08-22 まさ確定「教科書は本の原稿が書かれるべきところ、モデルは別の場所に記録」に基づく分離である。

## 画面構成

| route | 内容 |
|---|---|
| `/model` | 現在の正式版（系列カード）、版の系譜、文書棚 |
| `/model/formulas` | **BZM 2.2 の現行の式の一覧**（本章の主題） |
| `/model/[slug]` | 台帳・確定文書・提案・撤回の md 本文 |

いずれも `model/layout.tsx` で `members.is_admin` 限定。
確定していないモデルや提案中の概念も並ぶため、まさと実装者以外には出さない。

`/model/formulas` は `[slug]` より優先される静的 route である。
`model-data.ts` の側ナビ「台帳」グループの先頭に `slug: "formulas"` として並ぶ。

## `/model/formulas` の式の取り出し方

### 式をコードへ書き写さない

正本 `bzm/bzm-2-2-strategic-slack-and-propulsion.md` は `model/LOCK.json` で sha256 凍結されている。
TeX を TS や JSON へ複製すると、凍結した正本と画面が別々に動きうる。
これは `model/README.md` (e) が禁じている二重管理そのものなので、画面側は式を持たない。

`pwa/src/app/(app)/model/formula-canon.ts` が持つのはポインタだけである。

| フィールド | 意味 |
|---|---|
| `section` | 正本 md の見出しテキスト（`##` / `###` を外したもの）と完全一致 |
| `group` | その見出しの中で何番目の数式グループか（1始まり） |
| `expect` | 取り出した TeX に必ず含まれる断片。取り違えの検出用 |
| `label` | 画面の表示名。正本の呼び方に合わせ、新しい命名をしない |
| `lead` / `tail` | 導入文・定義文として残す段落数 |

TeX と記号の説明は表示のたびに md から読む。
正本が変われば画面も変わる。

### 数式グループの定義

`pwa/src/lib/model-formula-extract.ts` が md を `##` / `###` の節へ割り、各節を地の文と `$$ … $$` の交互列へ分解する。

**直前に地の文がある `$$ … $$` を1グループの先頭とし、地の文を挟まずに続く `$$ … $$` は同じグループへ足す。**

正本が「次で表す。」の後に2本並べて書いている式（$\tau_{\mathcal T}$ と $\tau_{\mathcal F}$、$V^*$ と $\pi^*$）を、1つの定義として扱うためである。

閉じられていない `$$` は数式として採らない。壊れた md から誤抽出しないため。

### 説明文の重複を消す

正本は「A を次で表す。$$…$$ 次に B を次で表す。$$…$$」と鎖状に書いてある。
そのまま出すと、ある式の直後の地の文が次の式の導入文と同一になり、同じ一文が2枚のカードに並ぶ。
後ろのカードの導入文を残し、前のカードの説明文からその分を落とす（`dedupeAdjacentProse`）。

### ずれたら気づける仕組み

見出しの改名や節内の式の増減・並べ替えで、ポインタは黙って別の式を指しうる。
モデル正本の画面が黙って別の式を出すのは、`model/LOCK.json` の3層ロックが防ごうとしている事故そのものである。

- 解決できなかった式は画面に**赤いカード**として理由つきで出す。黙って消さない。
- `npm run test:model-formula-canon`（`scripts/check_model_formula_canon.mts`）が落ちる。
  検査は (1) 全ポインタの解決、(2) `expect` の断片一致、(3) 正本に増えた未収録式の検出（`UNCOVERED_BASELINE` のラチェット）。
- `deploy.sh` が本番反映前に実行する。
- `check_pwa_critical_ui.cjs` が、抽出経路（`readModelCanonFile` / `expect:`）と導線が消えていないことを見る。

未収録の基準線を動かすときは、その式を一覧へ載せるか、載せない理由をスクリプトへ書く。

## 収録範囲

正本の §4・§5・§6・§7・§9・§15・§16 に置かれた **32式**を、6層に並べる。

| 層 | 正本 | 内容 |
|---|---|---|
| 1. 状態 | §4 | 八層状態 $\mathbf s_t$、未確定事象への信念 $\mathbf b_t$ |
| 2. 行動と制約 | §5 | 制御 $\mathbf z_t$、制約の三値 $\sigma_j$、$g_j$、$\Gamma_{\mathrm{exec}}^{\mathrm{reg}}$、$\Gamma_{\mathrm{open}}^{\mathrm{reg}}$、余裕 $m_j$、$\Gamma_{\mathrm{portfolio}}^{\mathrm{reg}}$ |
| 3. 遷移と推進力 | §6 | 物理遷移 $\mathbb P^{\mathrm{stress}}_{\delta}$、限界投資価値 $\Delta J_{u_d}$ |
| 4. 戦略余力 | §7 | $\tau_{\mathcal T}$ / $\tau_{\mathcal F}$、$q_{\mathrm{rob}}^{-}$、$\mathcal K_{\mathcal T}^{-}$、$T_Y^{2.2,\pi_d^*}$、$\rho_{\ell}^{*}$、評価契約 $\Theta_v$ |
| 5. 価値評価 | §9 | 終端境界、行動価値 $J_{u_d}^*$、$V_{u_d}^*$ と $\pi_d^*$、強制終端、視点別 $V_r^{\pi_d^*}$ |
| 6. pilot画面の四記号 | §15・§16 | $d_t$ / $W_t$、$J$、$P$、$Q$、$S$、gate通過値 $p_i$ の条件、分岐時の $J$、四記号の完全式、$J\neq QP$ の差 |

層の見出しと導入文は画面の道案内であり、モデル定義ではない。

**収録しない式**（`UNCOVERED_BASELINE`）: §15「pilot画面のイベントと月次試算」の2式と、§15 の $J-QP$。
前者は現行の式ではなく pilot 画面の操作契約、後者は §16 に同じ式があるためである。

## 表示の不変条件

- 画面上部に版と用途境界を出す。
  「前向き検証0件、本実装前（pilot 画面は内部 shadow 試算）。測定済みの $q$ または $q_{\mathrm{rob}}$、PJ間比較、投資判断、資源配分に使わない。」
- 第6層の導入文で、$J$・$P$・$Q$・$S$ が理論式そのものではなく画面用の射影であることを明示する。$S$ を単独で「戦略余力」と呼ばない。
- SPS の $P^{\mathrm{ind}}$・$q$ と BZM の $P$・$Q$ は別量である。同じ文字でも読み替えない。
- 各式に正本の見出しと行番号を添え、`/model/[slug]#<anchor>` でその節へ跳べるようにする。
- 数式と表は各自の `overflow-x-auto` の中で横スクロールさせる。ページ本体は横スクロールさせない。

### 見出しアンカー

`BzmMarkdown` は `{#id}` 記法のない見出しにも、見出しテキストから決まる id を振る。
日本語見出しは英数 slug 化すると全部ハイフンへ潰れて衝突するので、FNV-1a の 32bit ハッシュを使う（`h-xxxxxxxx`）。

id の生成は `pwa/src/lib/heading-anchor.ts` の `headingAnchorId` 1本に集約する。
描画側（`BzmMarkdown`）とリンク生成側（`formula-canon`）が同じ関数を使わないと、id が静かにずれてリンクが死ぬ。

`{#var-sps}` のように明示 id を持つ見出し（版数台帳の変数説明）は、従来どおりその id を優先する。

## 参照系データとしての扱い

モデル定義は読み取り専用で、更新はまさの承認を経た relock のときだけである。
`AGENTS.common.reference.md`「参照系データの体感速度」と [5-10 参照系データのキャッシュ仕様](5-10-reference-data-caching-current-spec.md) の分類では**参照系**にあたる。

`pwa/src/lib/model-canon-source.ts` が正本 md / json をプロセス内へ5分保持する（サーバのプロセス内スナップショット）。
`model-data.ts` の `loadModelCurrent` / `getModelMarkdownSource` と `formula-canon.ts` は、この1本を通す。
書き込み経路から捨てられるよう `invalidateModelCanonCache()` を export する。

`MODEL_CURRENT_JSON_PATH` による上書きパスは検証用なので、キャッシュを通さず毎回素で読む。

## 実装ファイル

| ファイル | 役割 |
|---|---|
| `src/app/(app)/model/formulas/page.tsx` | 画面。`data-testid="model-formulas"` |
| `src/app/(app)/model/formula-canon.ts` | ポインタ表と解決（式は持たない） |
| `src/lib/model-formula-extract.ts` | md → 節 → 数式グループの純粋関数 |
| `src/lib/model-canon-source.ts` | 正本ファイルのプロセス内スナップショット |
| `src/lib/heading-anchor.ts` | 見出しアンカー id の生成（描画側と共有） |
| `scripts/check_model_formula_canon.mts` | ポインタ検査（`deploy.sh` から実行） |
| `next.config.ts` | `/model/formulas/page` の `outputFileTracingIncludes`。`../bzm/**/*.md` を明示しないと本番だけ ENOENT |

## 未実装・未確認

- SPS 系列の式の一覧はこの画面に無い。現行式は [版数台帳](../../model/MODEL_VERSION_LEDGER.md) §2 にある。
- 正本 `bzm/bzm-2-2-strategic-slack-and-propulsion.md` :1272 に LaTeX の誤記がある
  （`\Delta_{mathrm{sim}}J=J(\bar z_{mathrm{sim}})-J(\bar z_{mathrm{reg}})` の `\mathrm` のバックスラッシュ3箇所欠落）。
  ロック対象ファイルなので、まさの承認と relock を経るまで直していない。当該式は収録範囲外のためこの画面には出ない。
