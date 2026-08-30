# PAPER_P1_SM_V2_GLOSSARY.md — v2 補足資料の共通契約（記号・用語・版）

作成: 2026-08-30。**v2 の補足資料 SM-A〜SM-G を書く全員（えいみ・worker）がこれに従う。**

補足資料は節ごとに並列で書く。並列で最初に壊れるのは、同じ概念が節ごとに違う英語になることなので、
記号と用語をここで固定する。**この表に無い語を英語で新しく作らない。** 必要になったらこの表に足してから使う。

供給元の正本は日本語（`../model/MODEL_VERSION_LEDGER.md`）、成果物は英語。
**訳ではなく、稿がすでに使っている英語へ合わせる作業**であることに注意する。

> **この表自体の訂正履歴（2026-08-30）**: 初版で英訳を6件誤っていた——$\ell_t$（失効を「受託の稼ぎ」と誤訳）、
> $\beta_i$（権利の解決率を「金融商品の係数」と誤訳）、$d_{f,g}$（空席の遅延を「ゲート距離」と誤訳）、
> $Q(h)$（累積確率を「履歴の乗数」と誤訳）、$\mathcal F$（機能の分解表を「ゲート族」と誤訳）、
> $P_o$（区分ごとの条件付き価値を「経路の確率」と誤訳）。いずれも並列で書いていた worker と検収が見つけ、正本を引いて確認のうえ直した。
> **記号は閉包表の並びから推測せず、その記号を定義している節を必ず開いて確認すること。**

---

## 1. 版の規律（最優先）

数値を書き写す前に、**その数値がどの版のものか**を必ず確認する。今日この点で2件の事故が見つかっている。

| 版 | 何 |
|---|---|
| **`a149fc30`** | **本稿の凍結版。**承認 #2026-08-29-1・-2・-3 と入力の置き直しを含む。SM に載せる数値は原則すべてこれ |
| `34aaa284` | 承認 #-3 の前。**図4の両腕だけ**がここ（二つの前提の比較なので係数をそろえる必要があるため）。それ以外に使わない |
| `91385d77` | さらに前。**もう使わない。**稿から全部消してある。見つけたら報告する |

- 正本の §6.I-11-2（縮退検査表）は #-3 で取り直されている。**古い版の表が手元の資料に残っていることがある。**
- 正本の §6.I-11-4（弾力性）と §6.I-11-5（報告の幅）は、**正本自身が「改訂前の実装で測った値のまま」と明記している。**
  SM-C に載せるときはこの但し書きを必ず添える。稿の §7.6 も同じ扱いをしている。
- M4 到達率を外部統計へ合わせていた共通倍率の**較正は切れている**（#-1 で水準が上がったため）。
  絶対水準を書くときは必ずこの事実を添える。稿の §7.5 に書いてある書き方に合わせる。

## 2. 記号（正本 §5.10 の閉包表 → 稿の英語）

式に現れる量はすべてこの表にあり、この表の量はすべて式か過程の定義に現れる（正本 §5.10 の閉包性）。

### 2.1 時間と観測状態 $x_t$

| 記号 | 稿の英語 | 備考 |
|---|---|---|
| $t,\ T$ | month index; evaluation horizon | $T = 240$ months。案件共通の約束 |
| $x_t$ | the observable state | 9成分。下の順序で書く |
| $g_t$ | the next stage gate | |
| $s^{\mathrm{f}}_t,\ s^{\mathrm{r}}_t$ | free and use-restricted cash balances (yen) | 参照実装は1本に畳んでいる（近似。稿 §4.2 が開示） |
| $R_t$ | the unresolved rights and approvals | each with its committee calendar |
| $\iota_t$ | the incorporation flag | |
| $\chi_t$ | the state of any contract-work lock-in | |
| $A_t$ | the set of *active applications* | uses that have passed their market gate and are generating value |
| $n_t$ | the history of attempts | |
| $\varsigma_t$ | a regulatory-review countdown | |
| $\mu^{\mathrm{f}}_t,\ \mu^{\mathrm{r}}_t$ | burn on the free / restricted account | |
| $y_t$ | sales | **参照実装に無い**（近似 A10）。稿 §4.2 が開示 |
| $z^{\mathrm{f}}_t,\ z^{\mathrm{r}}_t$ | funding inflows to each account | |
| $\ell_t$ | fiscal-year expiry of use-restricted funds | 正本 §5.2 は $\ell_t$ を「年度末の期限による使途制限資金の失効（繰越できない分）」と定義し、遷移式でも $-\ell_t$ と引いている。稿 §4.2 も「fiscal-year expiry」が残高を減らす側だと書いている。**contract earnings は $\ell_t$ ではなく $\rho_t r$**（次行） |
| $\rho_t\, r$ | contract earnings | 自由資金の遷移式の $+\rho_t r$。$\rho_t$ 単体は §2.3 の contract-work share |
| $\lambda^{\mathrm{obs}}$ | obsolescence hazard | |

### 2.2 案件パラメータ $\theta$（13量。直接は測れず、期間中は変わらないと置く）

| 記号 | 稿の英語 |
|---|---|
| $c$ | conversion capacity |
| $e$ | the fill prospect of the evangelist function |
| $\sigma$ | sector momentum |
| $\tau_{\mathrm{proc}}$ | process type |
| $\psi$ | technical-core validity |
| $\kappa_{\mathrm{IP}}$ | appropriability |
| $\{w_u\}$ | willingness-to-pay caps |
| $\{\bar P_u\}$ | annual domestic value-added ceilings |
| $\{\delta_u\}$ | displacement shares |
| $\{\alpha_u(\cdot)\}$ | counterfactual schedules |
| $\{L_u\}$ | acceleration horizons（$L_u = 36$ months が既定） |
| $\{\underline{c}_u\}$ | production-cost floors |
| $r$ | self-propulsion |
| $B_0(\theta)$ | the prior over project parameters |

### 2.3 過程・規則・価値

| 記号 | 稿の英語 |
|---|---|
| $\kappa_g,\ \eta_t,\ d_{f,g},\ \mathcal F,\ \gamma,\ \rho_t$ | gate coefficients; carrier-fill factor; **vacancy delay coefficient**; **the decomposition of management-team functions**; drag term; contract-work share |
| | 訂正 2026-08-30: $\mathcal F$ を the gate family と書いていたのは誤り。正本は「経営チームが持つべき機能の分解表」。稿は gate family という語を一度も使っていない |
| | 訂正 2026-08-30: $d_{f,g}$ を gate distance と書いていたのは誤り。正本は「機能 $f$ の空席がもたらす遅延係数（0〜1）、ゲートごとに添字づける」と定義しており、距離ではない |
| $\phi,\ \nu^{\mathrm{win}},\ \nu_k,\ \nu_c,\ \beta_i,\ \psi_g$ | award rate; window-arrival rate; offer-arrival rates; contract-arrival rate; rights-resolution rates; gate-specific technical-core loading |
| $t_q,\ m_q$ | the quiet period and its multiplier |
| $\lambda^{\mathrm{comp}},\ \lambda^{\mathrm{dem}}$ | competitor-preemption and demand-disappearance hazards |
| $\pi^{\mathrm{plan}},\ \pi^{*}$ | the registered plan; the optimal policy |
| $\Pi(\omega)$ | the value of scenario $\omega$ |
| $d$ | the social discount rate（$d = 2.0\%$） |
| $\phi_u$ | the share parameter（appropriability に増加。**価値の積み上げにしか入らない**——稿 §5.2） |
| $C(x_T,\theta)$ | the continuation term |
| $m_u = w_u - \underline{c}_u$ | the unit margin |
| $v(\theta)$ | the value conditional on project parameters |
| $V$ | the score |
| $q_o,\ P_o,\ Q(h)$ | terminal-class probabilities; **the value conditional on ending in class $o$**; **the cumulative probability of reaching capital self-sufficiency by month $h$** |
| | 訂正 2026-08-30: $P_o$ を path probabilities と書いていたのは誤り。正本 §5.8 は $P_o(\theta)=\mathbb E[\Pi\mid\theta,o]$「区分ごとの条件付き価値」で、確率ではない |
| $m_n$ | the history multiplier | 較正可能になるまで **1 に固定**（正本 §6.I）。稿 §6.4 の「失敗が無料」はこれ |
| | 訂正 2026-08-30: $Q(h)$ を history multiplier と書いていたのは誤り。正本 §5.8 は「経過月 $h$ までに資本自立へ届く累積確率」と定義している。history multiplier は $m_n$ |

## 3. 用語（日本語の正本 → 稿の英語）

**左の日本語を見たら、右の英語をそのまま使う。**言い換えない。

| 正本（日本語） | 稿の英語 |
|---|---|
| 工程の型（F1/F2/F3/F4） | process type — process / device / software / service |
| 規制（REG-0/1/2） | regulatory regime |
| ゲート | (stage) gate |
| 担い手の機能 | the carrier functions（充足率 = carrier-fill factor） |
| 天井 | ceiling（年額の純増 = annual domestic value added） |
| 押しのけ | displacement |
| 反実仮想 | counterfactual |
| 前倒し分 / 立地分 | the acceleration wedge / the location wedge |
| 追加性 | additionality |
| 産業創出価値 | industrial value creation（尺度は net domestic value added） |
| 変換能力 | conversion capacity |
| 無風期間 | the quiet period |
| 自走力 | self-propulsion |
| 資本自立 | capital self-sufficiency |
| 用途転換 | application pivot |
| 撤退 / 清算 / 未決着 | withdrawal / liquidation / undecided continuation |
| 四経路 | the four routes |
| 継続価値（の比率） | the continuation value (share) |
| 証拠水準 | evidence grade（失効する = expiring） |
| 単位採算 | unit economics |
| 有償PoC | a paid proof-of-concept |
| バーンレート | the burn rate |
| 自由資金 / 使途制限資金 | free funds / use-restricted funds |
| 事前分布 | the prior |
| 弾力性 | elasticity |
| 縮退検査 | the degenerate-cell check |
| 登録された計画 | the registered plan |
| 評価版 | the evaluation version |
| 二重採点 | dual scoring |
| 記録のみ条件 | the default condition（**"records-only" と書かない**——稿 §7.2 が既定条件と呼び直している） |
| 聞き取り込み条件 | the elicited condition |
| 単独マスク | single-withholding |

## 3.5 正本の節番号を稿の節番号として写さない（2026-08-30 追加）

**正本の日本語は、正本自身の節番号で相互参照している。稿の節番号とは対応しない。**

| 正本の中の参照 | 実際の中身 | 稿では |
|---|---|---|
| 正本 §5.4 | 担い手の充足の計算 | 稿 §5.4 は「反実仮想の部分識別」——**別物** |
| 正本 §5.7-2 | 撤退の四経路 | 稿では §4.5 |

正本の `§5.6` `§5.9` なども同様。**正本の節番号を機械的に持ち込むと、読者を稿の無関係な節へ送る。**
参照を書くときは、稿の該当箇所を実際に開いて確認する。確認できない参照は**書かずに落として報告する**。

## 4. 書き方の規約

- **数値**: 円は yen。桁は稿に合わせ、$V$ は有効数字2桁で読む（格子収束誤差 0.3% が理由）。
  10億円 = JPY billion。億は使わない。
- **順位**: 点の順位を外向きに書かない。四分位帯で書く（稿 §4.7 の規則）。
- **実装と仕様のずれ**: 正本が「参照実装に未実装」「近似 An として宣言する」と書いている箇所は、
  **必ずその旨を残す。**消して滑らかにしない。近似は A1〜A16 まで正本にそろっている。
- **「実装済み」と読める書き方をしない。** 実装を見ていない機能を現在形で書かない。
  これは本稿の査読で6件見つかった型で、直した後も1件再発している。
- 稿が既に書いている文をそのまま SM へ複製しない。SM は本文が参照する詳細を置く場所。

## 5. 節の分担と供給元

| 節 | 中身 | 供給元 | 担当 |
|---|---|---|---|
| SM-A | 記号と式の全文 | 正本 §5（特に §5.2〜§5.8・§5.10） | worker |
| SM-B | ゲート表・担い手表・登録簿の形式・計画規則の雛形 | 正本 §6.B / §6.R | worker |
| SM-C | 係数表と根拠等級・近似 A1〜A16・弾力性表 | 正本 §6.I（特に I-11-4/-5）と近似表 | worker |
| SM-D | 標本の層別・二重採点の手順・分類規則と照合・案件別の比と順位・天井感度 | `paper_p1_dual_scoring.md` `paper_p1_input_classification.md` `CLASSIFICATION_FREEZE.md` | えいみ |
| SM-E | 設計命題の導出ログと監査記録 | `S5_REVISION_PLAN_V2.md` と稿 §3 | えいみ |
| SM-F | 較正計画・識別の制約・反証条件の登録簿 | 正本 §5.9 / §6.I と稿 §8.4 | worker |
| SM-G | 版の凍結（ハッシュ・承認・凍結入力・図の生成とデータ） | 凍結記録・DB・`paper_p1_figures_v2.py` | えいみ |

**旧 `PAPER_P1_SM.md`（v1）は流用しない。**中身は撤回済みの定理の証明で、v2 が要求する内容と別物。
参照するなら記号表（SM-E）だけだが、BZM 3.0 で記号が変わっているので実質は書き直し。

## 6. 守ること

- **`model/` 配下は読むだけ。絶対に書き換えない**（別セッションがロックしている）
- 本番テーブルへ書き込まない
- 凍結ファイル（`paper_p1_input_classification.json` / `.md`）は sha256 を保つため書き換えない。
  訂正は `CLASSIFICATION_FREEZE.md` の末尾へ足す
- 正本に無い事実を書かない。数字を推測で埋めない。**足りないものは「足りない」と書く**
