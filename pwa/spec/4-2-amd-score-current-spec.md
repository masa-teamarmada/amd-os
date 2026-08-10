# AMD Score 実装仕様

> **この章は何か**: AMD Score の PWA 実装、DB、route、計算境界の確定仕様。理論導出は `/bzm`、詳細履歴は `pwa/design/amd_score.md` にも残す。

> **2026-07-29 主張境界**: この章が確定するのは現行PWAの計算・表示契約であり、SPSの予測妥当性または因果妥当性ではない。現行SPSは9軸の診断指数で、企業価値、期待事業価値、成功確率、生存確率を表す検証済みモデルではない。点数差・点数比と`alpha`を経済的な間隔または弾力性として解釈しない。SPS順位とbottleneckだけでGO、NO_GO、投資額、投入人月を決めない。BZM 2.0の改訂要件は [`BZM_2_0_REVISION_REQUIREMENTS.md`](../bzm/BZM_2_0_REVISION_REQUIREMENTS.md) を参照する。

## 定義

AMD Score の現行 primary model は **SPS = Seed Prospect Score (シーズ有望度)**。表示構造は `M x P x R x S` の4因子で、実計算は9軸を一層で乗法集約する。PWA の主表示は SPS を前面に出し、旧 7 軸 Cobb-Douglas / M-X-F は legacy AMD comparison と evidence chain として残す。

> **呼称の正本 (2026-07-11 まさ確定、[`pwa/bzm/terminology_glossary.md`](../bzm/terminology_glossary.md) §1.5)**: 旧称 PRS は廃止済み。SPS は和名「シーズ有望度」の略であって成分の頭字ではないため、4因子化しても名称は壊れず、MPRS への改称は不要 (まさ再確認 2026-07-16)。コード変数 (`calculatePrsScore` / `PrsComponentBreakdown` 等)・DB 列 (`prs_potential` / `prs_r_net`)・テストコマンド (`test:prs-mprs-grouping`) は内部識別子として据え置き、**表示テキスト・文書の呼称のみ SPS を使う**。アーカイブ・過去ログ内の「PRS」は「= 現 SPS」と読む。

> **2026-07-16 まさ確定 — σ_SU を S から分離、M·P·R·S 4因子へ**: 旧 S = σ_SU × FRL × R_net から σ_SU を独立項 M へ格上げし、S を自走力 (FRL × R_net) に純化した。「この会社は死なないか (予測、環境込み)」と「この会社は自走できるか (診断、内部要因のみ)」の二問が S に同居していたのを解消するため。フラット Cobb-Douglas の結合則により**総合スコア数値・α・K・履歴データは完全不変**。変わるのは breakdown のグルーピング・表示ラベル・律速診断の読みだけ。決定の正本は `/Users/masa/projects/AMD/BZSF/before_zero_theory.md` の「2026-07-16 セッション」節。数値不変の回帰テスト: `npm run test:prs-mprs-grouping` ([`scripts/check_prs_mprs_grouping.mts`](../scripts/check_prs_mprs_grouping.mts))。

$$
\mathrm{Score}_{\mathrm{SPS}} = K_{\mathrm{SPS}} \cdot M \cdot P \cdot R \cdot S
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
K_{\mathrm{SPS}} = \frac{100{,}000}{10^{\sum_{x \in \mathcal{A}_{\mathrm{SPS}}}\alpha_x}}
$$

where:

$$
\mathcal{A}_{\mathrm{SPS}} = \{P,\mathrm{TRL},\mathrm{BRL},\mathrm{GRL},\mathrm{SRL},\mathrm{HRL},\sigma_{\mathrm{SU}},\mathrm{FRL},R_{\mathrm{net}}\}
$$

軸集合 $\mathcal{A}_{\mathrm{SPS}}$・α・K は再グルーピング前と同一 (= スコア数値不変の機械的裏付け)。

`P` / `R_net` が未入力の場合は `status='missing'` / review pending とし、0点に丸めたり legacy AMD を primary として代替表示したりしない。

### Conceptual meaning of K / M / P / R / S

SPS (M·P·R·S) は「追い風が吹いているか」「大きくなりうるか」「届く準備があるか」「自走できるか」を別々の必要条件として扱うモデル。各要素は足し算の部分点ではなく、PJ / SU が立ち上がるために同時に必要なレバーとして読む。

| 記号 | 意味 | ざっくり解釈 | 主な入力 |
|---|---|---|---|
| `K_SPS` | Calibration constant | スコアの物差しを合わせるための倍率。全active axisが9点なら100,000になるように正規化する | alpha set / Shallow Tech mode |
| `M` | マクロ追い風 (Macrotrend) | いま、この分野に吹いている風。案件の属性ではなく時変の環境状態・タイミングの変数 | `sigma_SU` (Triple Helix: `mu_A` / `mu_I` / `mu_G`) |
| `P` | Potential | そもそも当たった時にどれくらい大きな事業・市場・社会インパクトになりうるか | `prs_potential` |
| `R` | Reach | そのポテンシャルへ到達するための会社側 readiness がどこまで揃っているか | TRL / BRL / GRL / SRL / HRL |
| `S` | 自走力 (Survival = FRL × R_net) | 外の資金がどれだけ止まっても、自分の力で走り続けられる体質があるか | final FRL / `R_net` |

積を取る理由は、SPS の4要素が代替可能な加点項目ではないため。Potential が大きくても Reach が弱ければ届かない。Macrotrend が吹いていても Survival (自走力) が低ければ「環境で延命しているだけ」になる。積にすると、どれか1つが弱い時に全体scoreも自然に抑えられ、4要素が同時に揃った時だけ大きく伸びる。

M と S を分けた効果は診断にある。旧構造では σ_SU の高さが自走力の欠如をマスクしていた (追い風型 PJ の S が高く出て「自走できていない」事実が見えなかった)。分離後は「M 高 × S 低 = 環境で延命、自走は未達」「M 低 × S 高 = 無風でも走れる体質」を別々に読める。M と P の分離基準は「案件の属性か、環境の状態か」— P はこの案件が当たったときの天井 (案件固有)、M はいまこの分野に吹いている風 (案件のものではない時変の環境)。

`K_SPS` はこの構造を壊さないための校正係数であり、事業価値そのものの入力ではない。`M` / `P` / `R` / `S` の相対構造を保ったまま、全軸9点の理想状態を `100,000` に合わせる。

## BZM 2.0観測台帳

PJコックピットのスコア詳細は、現行運用SPSの前にBZM 2.0観測画面を表示する。

二つのモデルは式、尺度、検証状態が異なるため、同じスコアとして合算または置換しない。

観測画面の式は、理論正本`pwa/bzm/sps-2-0-reachability-model.md`に従う。

$$
\mathbf{SPS}=q\mathbf P
$$

$$
q(\mathbf z)
=
\Pr\!\left(
T_C(\mathbf z)<T_Y(\mathbf z),\quad
T_C(\mathbf z)\le H_v
\mid \mathbf Z_\tau=\mathbf z
\right)
$$

トップ式の直下は、`q`、`P`、BZM 2.0の`SPS`を同じ代入列で表示する。`P`はベクトルであり、現行運用SPSの値を流用しない。`P`が未着手・欠測、または尺度・合成規則が未登録なら、最終出力は0ではなく`未測定`とし、阻害理由を同時表示する。

到達競争式の直下は、`Z`、`T_C`、`T_Y`、`H_v`、`q`の現在の判定値を同じ表へ置く。式と現在値を別区画へ離さず、共通状態が時計と到達見込みを条件づける構造を監査できるようにする。

`bzm_2_model_revisions`はPJ別の測定版を追記する。

`bzm_2_parameter_observations`は版ごとのパラメータ値、欠測、出所、影響先、条件を追記する。

`parameter_key`を行として持つため、`Z_policy`のような共通状態を列追加なしで登録できる。

| 項目 | 保存規則 |
|---|---|
| 版 | `project_id + revision_key`と`project_id + revision_order`を一意にする |
| 情報締切 | `information_cutoff`へ保存し、後の結果で過去入力を書き換えない |
| 欠測 | `value_status=missing`または`not_started`、`value_json=null`とする。0へ変換しない |
| 出所 | 計算、文書、記録、ヒアリング、仮定、複合を区別し、欠測以外は`evidence_ref`を必須にする |
| 共通状態 | `affects`へ影響工程と時計を保存し、`condition_json`へ条件づけた入力を保存する |
| PJ文脈 | `parameter_group=context`へ現行状態、設立、AMD支援を保存する。共通状態の式へ混ぜず、過去予測へ遡及利用しない |
| 前向き検証 | `forward_validation_count`として版に保存し、計算済みと検証済みを分ける |

`Z_policy`は独立加点ではない。

LSTでは`#2=90%`と`#6=60%`を`Z_policy=present`へ条件づけ、`affects`に`#2`、`#6`、`T_C`、`T_Y`、`q`を保存する。

反実仮想となる`Z_policy=absent`の工程入力は欠測なので、ロビイングの追加効果を計算しない。

APIの`/api/project/[projectId]/amd-score-detail`は、既存payloadへ`bzm2`を追加する。

`fetchBzm2Observatory()`は版と観測を取得し、パラメータごとに最新値と履歴を組み立てる。

`Bzm2ModelObservatory`は数式記号をLaTeXで組む。たとえば`T_C`という生文字列を表示せず、$T_C$として下付きを含めて描画する。トップ式と到達競争式にはそれぞれ現在の代入・判定値を直下へ置き、最終SPSを算出できない場合は未測定理由を表示する。共通状態、時計、入力、資金、品質の台帳は、記号と変数名、現在値、測定状態・出所、反映先、履歴を同じ圧縮表へ並べる。各行の詳細で説明、出所参照、版別の値・状態・情報締切を確認する。$q$の版推移は初期状態で閉じ、必要なときだけ開く。

台帳が未適用または取得不能でも既存スコア詳細を失敗させず、BZM 2.0側だけを欠測表示にする。

初期データは、撤回済みSX v0.1を除外し、SX v0.2からv0.5とLST v0.1事前登録を投入する。

SXとLST以外で現行SPSを持つ10PJは`measurement_status=data_collection`でv0.1を作り、2026-08-10の情報締切までに構造化DBから確認できたPJ文脈、政策支援、現行SPS入力、証拠被覆、資金調達履歴を凍結する。

`data_collection`は計算前の観測収集中を表す。依存グラフ、時間分布、現在現金、バーン、計画期限が未接続なら、記録数が多くても`q`は欠測のままにする。

現行SPS入力は`quality.current_sps_input`として保持するが、`prs_potential`をBZM 2.0の`P`へ、XRLを条件付き確率へ自動変換しない。

資金調達ラウンドの既知合計は`cash.funding_history`として保持するが、`C_0`または`T_Y`へ読み替えない。

現行PJ状態は`context.lifecycle`として保持し、予測時点より後の結果を過去入力へ混入させない。

初期データの投入は既存の一次資料と構造化DBを画面用台帳へ写す処理であり、新しい確率の推定ではない。

この画面は読み取り専用である。

パラメータの更新は、凍結入力または事前登録の新しい版を作り、同じ版の観測行を追加する処理として行う。

## Legacy AMD / M-X-F の位置づけ

legacy AMD / M-X-F では 7 軸を次の 3 要素で見せる。これは現行 primary score ではなく、SPS の R/S の根拠と比較用ブロックとして読む。

| 要素 | 意味 |
|---|---|
| M | Macrotrend / Triple Helix。`sigma_SU` |
| X | 会社に帰属する XRL。TRL / BRL / GRL / SRL / HRL |
| F | Founder / 経営チーム readiness。FRL |

FRL は XRL に飲み込まない。AMD Studio の哲学上、FRL と `sigma_SU` は独立した重要軸として扱う。旧計算式は巻末 Appendix に保存する。

## 実装ファイル

| file | 契約 |
|---|---|
| `pwa/src/lib/amd-score.ts` | SPS/legacy score 計算、alpha default、K、bottleneck、FRL CES |
| `pwa/src/lib/amd-score-derived.ts` | DB row から SPS primary と legacy comparison の derived score を作る |
| `pwa/src/lib/amd-score-data.ts` | `amd_score_inputs` / `amd_score_alpha` data access |
| `pwa/src/lib/bzm-2-observatory.ts` | BZM 2.0の必須記号、版、パラメータ履歴を組み立てる純粋契約 |
| `pwa/src/lib/bzm-2-observatory-data.ts` | BZM 2.0観測台帳のserver-side read。取得不能時は欠測payloadを返す |
| `pwa/src/components/cockpit/Bzm2ModelObservatory.tsx` | LaTeX数式、現在値、共通状態の影響先、初期折りたたみのq版推移、圧縮表のパラメータ台帳と行内履歴を表示 |
| `pwa/src/components/venture-map/AmdScoreView.tsx` | 個別 PJ 詳細。SPS Primary を先頭に出し、legacy AMD / M-X-F を comparison として残す |
| `pwa/src/components/venture-map/AmdScoreList.tsx` | 一覧。SPS primary を主表示し、legacy AMD は比較列 |
| `pwa/src/components/cockpit/*AmdScore*` | cockpit chip / breakdown modal。SPS status を主語にする |

## DB 契約

| table | 用途 |
|---|---|
| `amd_score_inputs` | project_id + evaluated_at ごとの SPS input (`prs_potential`, `prs_r_net`) と legacy 7 軸入力、notes、FRL cap |
| `amd_score_alpha` | alpha weights の version 管理 |
| `amd_score_revisions` | 軸値の修正依頼履歴 |
| `bzm_2_model_revisions` | PJ別BZM 2.0測定版、情報締切、検証件数、変更理由 |
| `bzm_2_parameter_observations` | 版ごとのBZM 2.0パラメータ、欠測、出所、条件、影響先 |
| `project_xrl_log` | XRL 時系列評価ログ |
| `project_xrl_evidence` | L2M-2 XRL 根拠 |

`amd_score_inputs` の列名を書く前に `pwa/design/db_schema.md` を確認する。

## Data Derivation Contract

SPS primary は、次のデータを同じ `amd_score_inputs` row から組み立てる。`P` / `R_net` だけは nullable review input なので、未入力なら score を出さず `missingAxes` を返す。

| SPS要素 | 実装値 | 算出 / 解決順 | ベースデータ |
|---|---|---|---|
| `M` | `computeSigmaSU(mu_A, mu_I, mu_G)` の contribution | `((mu_A+1)(mu_I+1)(mu_G+1))^(1/3)-1`、`M=(σ_SU+1)^ασ` | `papers_log`, scholar/OpenAlex, `atlas_signals`, `macro_index_log`, policy/news/investment signals |
| `P` | `prs_potential` | detail draft -> row value -> past persisted row -> latest project-level row -> null | 事業仮説、Venture narrative、PL hearing、Atlas/市場根拠、まさレビュー |
| `R` | TRL / BRL / GRL / SRL / HRL contribution product | `xrl_checklist` 保存値または row の `trl..hrl` | `project_xrl_log`, `project_xrl_evidence`, `amd_score_inputs.xrl_checklist`, XRL notes |
| `S:FRL` | `resolveFrl(row)` | `frl_cap` があれば CES、無ければ `frl` | ALQ 4因子、Grit、Resilience、F_capability、`project_founding_members` |
| `S:R_net` | `prs_r_net` | detail draft -> row value -> past persisted row -> latest project-level row -> null | 収益化見込み、粗利、運営コスト、本命PJへのリソース毀損 |

`resolvePrsInputs()` は stored row -> prior row -> latest reviewed project-level SPS input の順で P/R_net を解決し、過去 row の SPS history を back-calculate する。null は 0 にしない。

LaTeX canonical formula:

$$
\mathrm{Score}_{\mathrm{SPS}}
= K_{\mathrm{SPS}}
\cdot (P_{\mathrm{input}}+1)^{\alpha_P}
\cdot \prod_{x \in \{\mathrm{TRL},\mathrm{BRL},\mathrm{GRL},\mathrm{SRL},\mathrm{HRL}\}}(x+1)^{\alpha_x}
\cdot(\sigma_{\mathrm{SU}}+1)^{\alpha_\sigma}
\cdot(\mathrm{FRL}_{\mathrm{final}}+1)^{\alpha_F}
\cdot(R_{\mathrm{net}}+1)^{\alpha_{R_{\mathrm{net}}}}
$$

$$
K_{\mathrm{SPS}}
= \frac{100{,}000}{10^{\sum_{x \in \mathcal{A}_{\mathrm{SPS}}}\alpha_x}}
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
| `/venture-map/amd-score` | 全 SU PJ の SPS primary 一覧。legacy AMD は comparison 列 |
| `/project/[projectId]/cockpit?tab=score-detail` | BZM 2.0観測画面 / 現行SPS primary入力 / SPS history / R_net / legacy M-X-F / FRL panel / XRLチェックリストの正規画面 |
| `/venture-map/amd-score/[projectId]` | 旧個別URLから cockpit score detail への互換 redirect (`p99` デモを除く) |
| `/venture-map/amd-score/retrofit` | SPS review queue + legacy alpha 調整 |
| `/project/[projectId]/cockpit` | SPS primary status chip / legacy AMD comparison / 進捗管理 |

## SPS primary

SPS (`M x P x R x S`) を主表示とする。legacy 7軸 AMD Score / M×X×F は comparison と evidence 用に保持する。

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
| `pwa/src/lib/amd-score.ts` | `SPS_ALPHA_DEFAULT` / `calculatePrsScore()`。P/R_net missing 時は score を返さず `status='missing'` |
| `pwa/src/lib/amd-score-derived.ts` | `derivePrsComponents()` / `buildPrimaryScoreSnapshot()`。stored P/R_net を優先し、主表示と legacy comparison を同じ row から作る |
| `pwa/src/components/venture-map/AmdScoreView.tsx` | cockpit score detail 上で P / R_net を保存し、SPS を primary、legacy AMD を comparison として表示 |
| `pwa/src/components/venture-map/AmdScoreRetrofit.tsx` | SPS review queue。missing PJ の棚卸しと legacy α 比較 |

禁止事項:

- P/R_net missing を 0 扱いして primary score を偽装すること
- SPS missing 時に legacy AMD を primary として見せること
- 既存7軸の履歴再計算

P/R_net rubric の厳密化と全 PJ の埋め切りは継続レビュー対象だが、UI 上の primary model は SPS とする。

legacy 値しかない PJ でも、primary を legacy AMD へ戻さない。画面上は SPS review pending とし、legacy は `Legacy AMD comparison` / `legacy M-X-F` / `comparison only` の文脈で表示する。

## Score detail 表示契約

cockpit の `スコア詳細` embedded view は、次の値をすべて説明可能な形で表示する。ここにある項目を UI に出す場合、算出式または入力元をこの章にも残す。旧 `/venture-map/amd-score/[projectId]` は同じ内容を別表示せず、この cockpit tab へ redirect する。

| UI表示 | 現行の位置づけ | 算出 / 取得元 |
|---|---|---|
| `SPS Primary` score | 現行 primary | `calculatePrsScore()` の `Score_SPS`。`P` と `R_net` がある時だけ表示 |
| `INPUT NEEDED` / missing axes | review pending | `missingAxes`。`P` / `R_net` が null または非数なら score は null |
| `P Potential` | primary input | `amd_score_inputs.prs_potential`。空欄保存は null |
| `R_net` | primary input | `amd_score_inputs.prs_r_net`。空欄保存は null |
| `M` breakdown / `M マクロ追い風` | SPS component | `(sigma_SU + 1)^{alpha_sigma}`。`PrsComponentBreakdown.macro` |
| `P` breakdown | SPS component | `(P_input + 1)^{alpha_P}` |
| `R` breakdown / `R reach` | SPS component | TRL / BRL / GRL / SRL / HRL の contribution product |
| `S` breakdown / `S 自走力 (Survival = FRL × R_net)` | SPS component | final FRL / `R_net` の contribution product (σ_SU は `M` へ分離済み) |
| `SPS history` | primary history | `computePrsScoreSeries()`。`status='ready'` の行だけ採用し、Y軸は log scale |
| `Legacy AMD comparison` | legacy comparison | `calculateAmdScore()`。SPS missing の代替 primary ではない |
| `Legacy AMD` hero score | legacy comparison | `K_legacy * M * X * F` |
| `M / X / F バランス` | legacy evidence | `breakdownFromResult()` の `M`, `X`, `F` |
| `K`, `Σα`, `σ_SU`, `lane` | score metadata | `calculateAmdScore()` / `calculatePrsScore()` と `project_ventures.lane` |
| `律速` | action hint | 限界感度 `argmax alpha_i / (Z_i+1)`。現行画面では legacy comparison の bottleneck を併記 |
| `Triple Helix Matrix` | `sigma_SU` evidence | `triple-helix-observations` 由来の `mu_A` / `mu_I` / `mu_G`、C行列、観測値、被覆率 |
| `XRL 観測チェックリスト` | XRL evidence / writer | `xrl_checklist` JSONB から達成レベルを算出し、保存時に `trl..hrl` も更新 |
| `FRL — Founder Readiness Level` | final FRL evidence | ALQ 4因子 / Grit / Resilience / FRL notes と final FRL |

### SPS input resolution

`P` と `R_net` は UI draft がある時は draft を優先し、通常表示では次の順で解決する。

1. 対象 `amd_score_inputs` row の `prs_potential` / `prs_r_net`
2. 同一PJで `evaluated_at <= target.evaluated_at` の過去 row に保存済みの値
3. 同一PJの最新 project-level row に保存済みの値
4. null

null の場合は missing とし、0 へ丸めない。

### SPS expanded formula

$$
\mathrm{Score}_{\mathrm{SPS}}
= K_{\mathrm{SPS}}
\cdot (\sigma_{\mathrm{SU}}+1)^{\alpha_\sigma}
\cdot (P_{\mathrm{input}}+1)^{\alpha_P}
\cdot \prod_{x \in \{\mathrm{TRL},\mathrm{BRL},\mathrm{GRL},\mathrm{SRL},\mathrm{HRL}\}}(x+1)^{\alpha_x}
\cdot (\mathrm{FRL}+1)^{\alpha_F}
\cdot (R_{\mathrm{net}}+1)^{\alpha_{R_{\mathrm{net}}}}
$$

フラット Cobb-Douglas なので因子の掛け順・グルーピングは数値に影響しない (M·P·R·S 再グルーピングでスコアが不変な根拠)。Shallow Tech mode では `TRL=null` として R から TRL を除外し、`K_SPS` も active axes の alpha sum で再校正する。

### Triple Helix / Macrotrend (= SPS の M)

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

S = 自走力 (Survival = FRL × R_net)。σ_SU は 2026-07-16 に独立項 M へ分離した (上の「Triple Helix / Macrotrend (= SPS の M)」参照)。

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
- SPS の R/S components の evidence chain
- alpha tuning / historical comparison
- 旧画面・旧説明との対応確認

主表示・章 summary・操作導線では `SPS Primary` を先に置く。M-X-F / 7軸を現行 primary へ戻す変更は不可。

## 変更ゲート

- 計算式・alpha・FRL・bottleneck を変えたら `/spec` と `pwa/design/amd_score.md` の両方を更新する。
- DB列追加は migration + `pwa/design/db_schema.md` 再生成を同じ作業単位に含める。
- UI 導線を消す前に `pwa/design/FEATURE_REGISTRY.md` と critical UI test を確認する。
