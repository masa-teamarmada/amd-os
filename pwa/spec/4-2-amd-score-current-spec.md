# AMD Score 実装仕様

> **この章は何か**: AMD Score の PWA 実装、DB、route、計算境界の確定仕様。理論導出は `/bzm`、詳細履歴は `pwa/design/amd_score.md` にも残す。

## 定義

AMD Score の現行 primary model は PRS (`M x P x R x S`)。PWA の主表示は PRS を前面に出し、旧 7 軸 Cobb-Douglas / M-X-F は legacy AMD comparison と evidence chain として残す。名称は当面「**PRS (M·P·R·S)**」と併記し、MPRS への全面改称はまさ判断待ち (2026-07-16)。

> **2026-07-16 まさ確定 — σ_SU を S から分離、M·P·R·S 4因子へ**: 旧 S = σ_SU × FRL × R_net から σ_SU を独立項 M へ格上げし、S を自走力 (FRL × R_net) に純化した。「この会社は死なないか (予測、環境込み)」と「この会社は自走できるか (診断、内部要因のみ)」の二問が S に同居していたのを解消するため。フラット Cobb-Douglas の結合則により**総合スコア数値・α・K・履歴データは完全不変**。変わるのは breakdown のグルーピング・表示ラベル・律速診断の読みだけ。決定の正本は `/Users/masa/projects/AMD/BZSF/before_zero_theory.md` の「2026-07-16 セッション」節。数値不変の回帰テスト: `npm run test:prs-mprs-grouping` ([`scripts/check_prs_mprs_grouping.mts`](../scripts/check_prs_mprs_grouping.mts))。

$$
\mathrm{Score}_{\mathrm{PRS}} = K_{\mathrm{PRS}} \cdot M \cdot P \cdot R \cdot S
$$

$$
M = (\sigma_{\mathrm{SU}} + 1)^{\alpha_\sigma}
$$

$$
P = (P_{\mathrm{input}} + 1)^{\alpha_P}
$$

$$
R = \prod_{x \in \{\mathrm{TRL},\mathrm{BRL},\mathrm{GRL},\mathrm{SRL},\mathrm{HRL}\}} (x + 1)^{\alpha_x}
$$

$$
S = (\mathrm{FRL} + 1)^{\alpha_F} \cdot (R_{\mathrm{net}} + 1)^{\alpha_{R_{\mathrm{net}}}}
$$

$$
K_{\mathrm{PRS}} = \frac{100{,}000}{10^{\sum_{x \in \mathcal{A}_{\mathrm{PRS}}}\alpha_x}}
$$

where:

$$
\mathcal{A}_{\mathrm{PRS}} = \{P,\mathrm{TRL},\mathrm{BRL},\mathrm{GRL},\mathrm{SRL},\mathrm{HRL},\sigma_{\mathrm{SU}},\mathrm{FRL},R_{\mathrm{net}}\}
$$

軸集合 $\mathcal{A}_{\mathrm{PRS}}$・α・K は再グルーピング前と同一 (= スコア数値不変の機械的裏付け)。

`P` / `R_net` が未入力の場合は `status='missing'` / review pending とし、0点に丸めたり legacy AMD を primary として代替表示したりしない。

### Conceptual meaning of K / M / P / R / S

PRS (M·P·R·S) は「追い風が吹いているか」「大きくなりうるか」「届く準備があるか」「自走できるか」を別々の必要条件として扱うモデル。各要素は足し算の部分点ではなく、PJ / SU が立ち上がるために同時に必要なレバーとして読む。

| 記号 | 意味 | ざっくり解釈 | 主な入力 |
|---|---|---|---|
| `K_PRS` | Calibration constant | スコアの物差しを合わせるための倍率。全active axisが9点なら100,000になるように正規化する | alpha set / Shallow Tech mode |
| `M` | マクロ追い風 (Macrotrend) | いま、この分野に吹いている風。案件の属性ではなく時変の環境状態・タイミングの変数 | `sigma_SU` (Triple Helix: `mu_A` / `mu_I` / `mu_G`) |
| `P` | Potential | そもそも当たった時にどれくらい大きな事業・市場・社会インパクトになりうるか | `prs_potential` |
| `R` | Reach | そのポテンシャルへ到達するための会社側 readiness がどこまで揃っているか | TRL / BRL / GRL / SRL / HRL |
| `S` | 自走力 (Survival = FRL × R_net) | 外の資金がどれだけ止まっても、自分の力で走り続けられる体質があるか | final FRL / `R_net` |

積を取る理由は、PRS の4要素が代替可能な加点項目ではないため。Potential が大きくても Reach が弱ければ届かない。Macrotrend が吹いていても Survival (自走力) が低ければ「環境で延命しているだけ」になる。積にすると、どれか1つが弱い時に全体scoreも自然に抑えられ、4要素が同時に揃った時だけ大きく伸びる。

M と S を分けた効果は診断にある。旧構造では σ_SU の高さが自走力の欠如をマスクしていた (追い風型 PJ の S が高く出て「自走できていない」事実が見えなかった)。分離後は「M 高 × S 低 = 環境で延命、自走は未達」「M 低 × S 高 = 無風でも走れる体質」を別々に読める。M と P の分離基準は「案件の属性か、環境の状態か」— P はこの案件が当たったときの天井 (案件固有)、M はいまこの分野に吹いている風 (案件のものではない時変の環境)。

`K_PRS` はこの構造を壊さないための校正係数であり、事業価値そのものの入力ではない。`M` / `P` / `R` / `S` の相対構造を保ったまま、全軸9点の理想状態を `100,000` に合わせる。

## Legacy AMD / M-X-F の位置づけ

legacy AMD / M-X-F では 7 軸を次の 3 要素で見せる。これは現行 primary score ではなく、PRS の R/S の根拠と比較用ブロックとして読む。

| 要素 | 意味 |
|---|---|
| M | Macrotrend / Triple Helix。`sigma_SU` |
| X | 会社に帰属する XRL。TRL / BRL / GRL / SRL / HRL |
| F | Founder / 経営チーム readiness。FRL |

FRL は XRL に飲み込まない。AMD Studio の哲学上、FRL と `sigma_SU` は独立した重要軸として扱う。旧計算式は巻末 Appendix に保存する。

## 実装ファイル

| file | 契約 |
|---|---|
| `pwa/src/lib/amd-score.ts` | PRS/legacy score 計算、alpha default、K、bottleneck、FRL CES |
| `pwa/src/lib/amd-score-derived.ts` | DB row から PRS primary と legacy comparison の derived score を作る |
| `pwa/src/lib/amd-score-data.ts` | `amd_score_inputs` / `amd_score_alpha` data access |
| `pwa/src/components/venture-map/AmdScoreView.tsx` | 個別 PJ 詳細。PRS Primary を先頭に出し、legacy AMD / M-X-F を comparison として残す |
| `pwa/src/components/venture-map/AmdScoreList.tsx` | 一覧。PRS primary を主表示し、legacy AMD は比較列 |
| `pwa/src/components/cockpit/*AmdScore*` | cockpit chip / breakdown modal。PRS status を主語にする |

## DB 契約

| table | 用途 |
|---|---|
| `amd_score_inputs` | project_id + evaluated_at ごとの PRS input (`prs_potential`, `prs_r_net`) と legacy 7 軸入力、notes、FRL cap |
| `amd_score_alpha` | alpha weights の version 管理 |
| `amd_score_revisions` | 軸値の修正依頼履歴 |
| `project_xrl_log` | XRL 時系列評価ログ |
| `project_xrl_evidence` | L2M-2 XRL 根拠 |

`amd_score_inputs` の列名を書く前に `pwa/design/db_schema.md` を確認する。

## Data Derivation Contract

PRS primary は、次のデータを同じ `amd_score_inputs` row から組み立てる。`P` / `R_net` だけは nullable review input なので、未入力なら score を出さず `missingAxes` を返す。

| PRS要素 | 実装値 | 算出 / 解決順 | ベースデータ |
|---|---|---|---|
| `M` | `computeSigmaSU(mu_A, mu_I, mu_G)` の contribution | `((mu_A+1)(mu_I+1)(mu_G+1))^(1/3)-1`、`M=(σ_SU+1)^ασ` | `papers_log`, scholar/OpenAlex, `atlas_signals`, `macro_index_log`, policy/news/investment signals |
| `P` | `prs_potential` | detail draft -> row value -> past persisted row -> latest project-level row -> null | 事業仮説、Venture narrative、PL hearing、Atlas/市場根拠、まさレビュー |
| `R` | TRL / BRL / GRL / SRL / HRL contribution product | `xrl_checklist` 保存値または row の `trl..hrl` | `project_xrl_log`, `project_xrl_evidence`, `amd_score_inputs.xrl_checklist`, XRL notes |
| `S:FRL` | `resolveFrl(row)` | `frl_cap` があれば CES、無ければ `frl` | ALQ 4因子、Grit、Resilience、F_capability、`project_founding_members` |
| `S:R_net` | `prs_r_net` | detail draft -> row value -> past persisted row -> latest project-level row -> null | 収益化見込み、粗利、運営コスト、本命PJへのリソース毀損 |

`resolvePrsInputs()` は stored row -> prior row -> latest reviewed project-level PRS input の順で P/R_net を解決し、過去 row の PRS history を back-calculate する。null は 0 にしない。

LaTeX canonical formula:

$$
\mathrm{Score}_{\mathrm{PRS}}
= K_{\mathrm{PRS}}
\cdot (P_{\mathrm{input}}+1)^{\alpha_P}
\cdot \prod_{x \in \{\mathrm{TRL},\mathrm{BRL},\mathrm{GRL},\mathrm{SRL},\mathrm{HRL}\}}(x+1)^{\alpha_x}
\cdot(\sigma_{\mathrm{SU}}+1)^{\alpha_\sigma}
\cdot(\mathrm{FRL}_{\mathrm{final}}+1)^{\alpha_F}
\cdot(R_{\mathrm{net}}+1)^{\alpha_{R_{\mathrm{net}}}}
$$

$$
K_{\mathrm{PRS}}
= \frac{100{,}000}{10^{\sum_{x \in \mathcal{A}_{\mathrm{PRS}}}\alpha_x}}
$$

$$
\sigma_{\mathrm{SU}}
= \sqrt[3]{(\mu_A+1)(\mu_I+1)(\mu_G+1)} - 1
$$

## FRL 境界

FRL の 2 レイヤー CES 実装仕様は `/spec/4-1-frl-ces-current-spec` を正本にする。

- `frl` = F_character
- `frl_cap` = F_capability
- `frl_cap_amd` = AMD 寄与
- `resolveFrl()` 経由で最終 FRL を作る

## Bottleneck

律速軸は寄与度の小ささではなく、限界感度で見る。

$$
\frac{\partial \mathrm{Score}}{\partial Z_i}
= \frac{\alpha_i \cdot \mathrm{Score}}{Z_i + 1}
$$

$$
\mathrm{bottleneck} = \arg\max_i \frac{\alpha_i}{Z_i + 1}
$$

`argmin(contribution share)` に戻さない。

## Route / UI

| route | 役割 |
|---|---|
| `/venture-map/amd-score` | 全 SU PJ の PRS primary 一覧。legacy AMD は comparison 列 |
| `/project/[projectId]/cockpit?tab=score-detail` | PRS primary 入力 / PRS history / R_net / legacy M-X-F / FRL panel / XRL チェックリストの正規画面 |
| `/venture-map/amd-score/[projectId]` | 旧個別URLから cockpit score detail への互換 redirect (`p99` デモを除く) |
| `/venture-map/amd-score/retrofit` | PRS review queue + legacy alpha 調整 |
| `/project/[projectId]/cockpit` | PRS primary status chip / legacy AMD comparison / 進捗管理 |

## PRS primary

PRS (`M x P x R x S`) を主表示とする。legacy 7軸 AMD Score / M×X×F は comparison と evidence 用に保持する。

| 要素 | 実装上の扱い |
|---|---|
| `M` | マクロ追い風 (Macrotrend)。`sigma_SU` の contribution。`PrsComponentBreakdown.macro` (2026-07-16 S から分離) |
| `P` | Potential / 潜在規模。`amd_score_inputs.prs_potential` に nullable で保存 |
| `R` | Reach / Readiness。TRL / BRL / GRL / SRL / HRL の contribution product |
| `S` | 自走力 (Survival = FRL × R_net)。final FRL / `R_net` の contribution product |
| `R_net` | 収益化指数。粗利 - 運営コスト - 本命から奪うリソース毀損。`amd_score_inputs.prs_r_net` に nullable で保存 |

実装ファイル:

| file | 契約 |
|---|---|
| `pwa/src/lib/amd-score.ts` | `PRS_ALPHA_DEFAULT` / `calculatePrsScore()`。P/R_net missing 時は score を返さず `status='missing'` |
| `pwa/src/lib/amd-score-derived.ts` | `derivePrsComponents()` / `buildPrimaryScoreSnapshot()`。stored P/R_net を優先し、主表示と legacy comparison を同じ row から作る |
| `pwa/src/components/venture-map/AmdScoreView.tsx` | cockpit score detail 上で P / R_net を保存し、PRS を primary、legacy AMD を comparison として表示 |
| `pwa/src/components/venture-map/AmdScoreRetrofit.tsx` | PRS review queue。missing PJ の棚卸しと legacy α 比較 |

禁止事項:

- P/R_net missing を 0 扱いして primary score を偽装すること
- PRS missing 時に legacy AMD を primary として見せること
- 既存7軸の履歴再計算

P/R_net rubric の厳密化と全 PJ の埋め切りは継続レビュー対象だが、UI 上の primary model は PRS とする。

legacy 値しかない PJ でも、primary を legacy AMD へ戻さない。画面上は PRS review pending とし、legacy は `Legacy AMD comparison` / `legacy M-X-F` / `comparison only` の文脈で表示する。

## Score detail 表示契約

cockpit の `スコア詳細` embedded view は、次の値をすべて説明可能な形で表示する。ここにある項目を UI に出す場合、算出式または入力元をこの章にも残す。旧 `/venture-map/amd-score/[projectId]` は同じ内容を別表示せず、この cockpit tab へ redirect する。

| UI表示 | 現行の位置づけ | 算出 / 取得元 |
|---|---|---|
| `PRS Primary` score | 現行 primary | `calculatePrsScore()` の `Score_PRS`。`P` と `R_net` がある時だけ表示 |
| `INPUT NEEDED` / missing axes | review pending | `missingAxes`。`P` / `R_net` が null または非数なら score は null |
| `P Potential` | primary input | `amd_score_inputs.prs_potential`。空欄保存は null |
| `R_net` | primary input | `amd_score_inputs.prs_r_net`。空欄保存は null |
| `M` breakdown / `M マクロ追い風` | PRS component | `(sigma_SU + 1)^{alpha_sigma}`。`PrsComponentBreakdown.macro` |
| `P` breakdown | PRS component | `(P_input + 1)^{alpha_P}` |
| `R` breakdown / `R reach` | PRS component | TRL / BRL / GRL / SRL / HRL の contribution product |
| `S` breakdown / `S 自走力 (Survival = FRL × R_net)` | PRS component | final FRL / `R_net` の contribution product (σ_SU は `M` へ分離済み) |
| `PRS history` | primary history | `computePrsScoreSeries()`。`status='ready'` の行だけ採用し、Y軸は log scale |
| `Legacy AMD comparison` | legacy comparison | `calculateAmdScore()`。PRS missing の代替 primary ではない |
| `Legacy AMD` hero score | legacy comparison | `K_legacy * M * X * F` |
| `M / X / F バランス` | legacy evidence | `breakdownFromResult()` の `M`, `X`, `F` |
| `K`, `Σα`, `σ_SU`, `lane` | score metadata | `calculateAmdScore()` / `calculatePrsScore()` と `project_ventures.lane` |
| `律速` | action hint | 限界感度 `argmax alpha_i / (Z_i+1)`。現行画面では legacy comparison の bottleneck を併記 |
| `Triple Helix Matrix` | `sigma_SU` evidence | `triple-helix-observations` 由来の `mu_A` / `mu_I` / `mu_G`、C行列、観測値、被覆率 |
| `XRL 観測チェックリスト` | XRL evidence / writer | `xrl_checklist` JSONB から達成レベルを算出し、保存時に `trl..hrl` も更新 |
| `FRL — Founder Readiness Level` | final FRL evidence | ALQ 4因子 / Grit / Resilience / FRL notes と final FRL |

### PRS input resolution

`P` と `R_net` は UI draft がある時は draft を優先し、通常表示では次の順で解決する。

1. 対象 `amd_score_inputs` row の `prs_potential` / `prs_r_net`
2. 同一PJで `evaluated_at <= target.evaluated_at` の過去 row に保存済みの値
3. 同一PJの最新 project-level row に保存済みの値
4. null

null の場合は missing とし、0 へ丸めない。

### PRS expanded formula

$$
\mathrm{Score}_{\mathrm{PRS}}
= K_{\mathrm{PRS}}
\cdot (\sigma_{\mathrm{SU}}+1)^{\alpha_\sigma}
\cdot (P_{\mathrm{input}}+1)^{\alpha_P}
\cdot \prod_{x \in \{\mathrm{TRL},\mathrm{BRL},\mathrm{GRL},\mathrm{SRL},\mathrm{HRL}\}}(x+1)^{\alpha_x}
\cdot (\mathrm{FRL}+1)^{\alpha_F}
\cdot (R_{\mathrm{net}}+1)^{\alpha_{R_{\mathrm{net}}}}
$$

フラット Cobb-Douglas なので因子の掛け順・グルーピングは数値に影響しない (M·P·R·S 再グルーピングでスコアが不変な根拠)。Shallow Tech mode では `TRL=null` として R から TRL を除外し、`K_PRS` も active axes の alpha sum で再校正する。

### Triple Helix / Macrotrend (= PRS の M)

$$
\sigma_{\mathrm{SU}} = \sqrt[3]{(\mu_A+1)(\mu_I+1)(\mu_G+1)} - 1
$$

$$
M = (\sigma_{\mathrm{SU}}+1)^{\alpha_\sigma}
$$

観測モデルがある場合は、直近 quarter の観測値 `y_p` を過去16 quarterで 0-9 正規化し、loading `c_{xp}` で各 hidden state に集約する。

$$
\tilde{y}_p = 9 \cdot \frac{y_p - \min_t y_p}{\max_t y_p - \min_t y_p}
$$

$$
\mu_x = \frac{\sum_p c_{xp}\tilde{y}_p}{\sum_p c_{xp}},
\qquad x \in \{A,I,G\}
$$

UIの `c`, `ỹ`, `c·ỹ`, `coverage` は、この観測モデルの説明要素として表示する。観測値欠落時は推測で埋めず、coverage note に残す。

### XRL / Reach

各 XRL axis contribution:

$$
C_x = (x+1)^{\alpha_x}
$$

Reach:

$$
R = C_{\mathrm{TRL}} \cdot C_{\mathrm{BRL}} \cdot C_{\mathrm{GRL}} \cdot C_{\mathrm{SRL}} \cdot C_{\mathrm{HRL}}
$$

`XRL 観測チェックリスト` の達成レベルは、下から見て全項目が checked の連続最大レベル。

$$
\mathrm{level}_a =
\max\left\{l \mid \forall j \le l,\ \forall k \in \mathrm{checklist}_{a,j},\ \mathrm{checked}_{a,j,k}=\mathrm{true}\right\}
$$

保存時は `amd_score_inputs.xrl_checklist` に JSONB を保存し、同じ row の `trl`, `brl`, `grl`, `srl`, `hrl` を `level_a` で上書きする。

### FRL / Survival (自走力)

FRL 自動算出モードでは、入力済み component の重みだけを使って正規化する。全 component が null の場合は null。

$$
\overline{\mathrm{ALQ}_4}
= \mathrm{avg}(\mathrm{SelfAwareness},\mathrm{RelationalTransparency},\mathrm{BalancedProcessing},\mathrm{InternalizedMoral})
$$

$$
\mathrm{FRL}_{6f}
= \frac{0.6 \cdot \overline{\mathrm{ALQ}_4}
 + 0.2 \cdot \mathrm{Grit}
 + 0.2 \cdot \mathrm{Resilience}}
{\sum \mathrm{available\ weights}}
$$

final FRL は `/spec/4-1-frl-ces-current-spec` の `resolveFrl()` に従い、`frl_cap` がある場合は CES で `F_character` と `F_capability` を合成する。

$$
\mathrm{FRL}_{\mathrm{final}}
= \left(a(F_{\mathrm{char}}+1)^\rho + (1-a)(F_{\mathrm{cap}}+1)^\rho\right)^{1/\rho} - 1
$$

$$
S = (\mathrm{FRL}_{\mathrm{final}}+1)^{\alpha_F}
\cdot (R_{\mathrm{net}}+1)^{\alpha_{R_{\mathrm{net}}}}
$$

S = 自走力 (Survival = FRL × R_net)。σ_SU は 2026-07-16 に独立項 M へ分離した (上の「Triple Helix / Macrotrend (= PRS の M)」参照)。

## Appendix: legacy MXF / 7軸モデル

このセクションは過去モデルの保存場所。legacy MXF (= M-X-F / 7軸 Cobb-Douglas) は、現行 primary ではない。

$$
\mathrm{Score}_{\mathrm{legacy}}
= K_{\mathrm{legacy}} \cdot \prod_{i \in \mathcal{A}_{\mathrm{legacy}}}(X_i+1)^{\alpha_i}
$$

$$
\mathcal{A}_{\mathrm{legacy}}
= \{\sigma_{\mathrm{SU}},\mathrm{TRL},\mathrm{BRL},\mathrm{GRL},\mathrm{SRL},\mathrm{HRL},\mathrm{FRL}\}
$$

$$
K_{\mathrm{legacy}} = \frac{100{,}000}{10^{\sum_{i \in \mathcal{A}_{\mathrm{legacy}}}\alpha_i}}
$$

UI 表示上は次に分解する。

$$
\mathrm{Score}_{\mathrm{legacy}} = K_{\mathrm{legacy}} \cdot M \cdot X \cdot F
$$

$$
M = (\sigma_{\mathrm{SU}}+1)^{\alpha_\sigma},\quad
X = \prod_{x \in \{\mathrm{TRL},\mathrm{BRL},\mathrm{GRL},\mathrm{SRL},\mathrm{HRL}\}}(x+1)^{\alpha_x},\quad
F = (\mathrm{FRL}+1)^{\alpha_F}
$$

Shallow Tech mode では TRL 軸を除外し、K を再校正する。

legacy M-X-F は次の目的で残す。

- 過去の retrofit / score history の再読
- PRS の R/S components の evidence chain
- alpha tuning / historical comparison
- 旧画面・旧説明との対応確認

主表示・章 summary・操作導線では `PRS Primary` を先に置く。M-X-F / 7軸を現行 primary へ戻す変更は不可。

## 変更ゲート

- 計算式・alpha・FRL・bottleneck を変えたら `/spec` と `pwa/design/amd_score.md` の両方を更新する。
- DB列追加は migration + `pwa/design/db_schema.md` 再生成を同じ作業単位に含める。
- UI 導線を消す前に `pwa/design/FEATURE_REGISTRY.md` と critical UI test を確認する。
