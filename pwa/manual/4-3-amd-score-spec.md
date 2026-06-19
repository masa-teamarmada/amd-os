# AMD Score 詳細仕様

AMD Score は、PJ / SU の価値・成熟度を数値化する指標。現行画面の主表示は **PRS Primary** (`P x R x S`)。M / X / F と 7 軸 Cobb-Douglas は **legacy AMD comparison** として残し、PRS の根拠・履歴比較・旧モデル確認に使う。

> 実装者向けの確定仕様は [/spec/4-2-amd-score-current-spec](/spec/4-2-amd-score-current-spec)。理論導出は `/bzm`、日常画面での読み方はこの章に置く。

## 先にここだけ読む

AMD Score は PJ / SU の価値評価。AMD 全社の健康度を見る AMD Management Score とは別物。

PRS は、PJ が立ち上がるための3つの必要条件を掛け合わせるモデル。

| 要素 | 意味 | 何を見るか | 主なデータ |
|---|---|---|---|
| `P` | Potential | 当たった時の市場・事業・社会インパクトの天井 | `amd_score_inputs.prs_potential` |
| `R` | Reach / Readiness | その天井へ届くための会社側 readiness | TRL / BRL / GRL / SRL / HRL |
| `S` | Survival | 届くまで走り切るための生存力 | `sigma_SU` / FRL / `prs_r_net` |

足し算ではなく掛け算にするのは、3つが「どれか1つ高ければOK」ではないから。Potential が大きくても Reach が低ければ届かない。Reach が高くても Survival が低ければ途中で止まる。Survival が高くても Potential が小さければ、AMD Score は大きくならない。積にすると、弱い要素が自然に全体を抑え、3つが同時に揃った時だけ score が伸びる。

`P` / `R_net` が未入力なら、PRS は `INPUT NEEDED` / review pending として止める。legacy AMD score を代わりに主表示へ戻さない。

## Primary Formula

$$
\mathrm{Score}_{\mathrm{PRS}}
= K_{\mathrm{PRS}} \cdot P \cdot R \cdot S
$$

$$
P = (P_{\mathrm{input}}+1)^{\alpha_P}
$$

$$
R =
\prod_{x \in \{\mathrm{TRL},\mathrm{BRL},\mathrm{GRL},\mathrm{SRL},\mathrm{HRL}\}}
(x+1)^{\alpha_x}
$$

$$
S =
(\sigma_{\mathrm{SU}}+1)^{\alpha_\sigma}
\cdot(\mathrm{FRL}_{\mathrm{final}}+1)^{\alpha_F}
\cdot(R_{\mathrm{net}}+1)^{\alpha_{R_{\mathrm{net}}}}
$$

$$
K_{\mathrm{PRS}}
= \frac{100{,}000}{10^{\sum_{x \in \mathcal{A}_{\mathrm{PRS}}}\alpha_x}}
$$

$$
\mathcal{A}_{\mathrm{PRS}}
= \{P,\mathrm{TRL},\mathrm{BRL},\mathrm{GRL},\mathrm{SRL},\mathrm{HRL},
\sigma_{\mathrm{SU}},\mathrm{FRL},R_{\mathrm{net}}\}
$$

全active axis が 9 点の時に `100,000` になるように `K_PRS` で校正する。`K_PRS` は価値入力ではなく、スコアの物差しをそろえる倍率。Shallow Tech mode では `TRL=null` として `R` から TRL を外し、`K_PRS` も active axes だけで再校正する。

## パラメータ一覧

| 記号 / 列 | 範囲 | 意味 | 算出・入力方法 | ベースデータ |
|---|---:|---|---|---|
| `P_input` / `prs_potential` | 0-9 / null | 事業ポテンシャル。成功時の規模・市場・社会インパクトの天井 | 詳細画面でレビュー保存。未入力は null | 事業仮説、Venture narrative、PL hearing、Atlas/市場根拠、まさ判断 |
| `TRL` | 0-9 / null | Technology Readiness。技術成熟度 | XRL checklist または `amd_score_inputs.trl` | 内閣府 SIP 原典準拠チェックリスト、技術進捗、PoC、特許、論文 |
| `BRL` | 0-9 | Business Readiness。事業化成熟度 | XRL checklist または `amd_score_inputs.brl` | 顧客ヒアリング、LOI、売上、商談、事業設計 |
| `GRL` | 0-9 | Governance / Government Readiness。制度・規制成熟度 | XRL checklist または `amd_score_inputs.grl` | 規制、許認可、制度、政策、補助金 |
| `SRL` | 0-9 | Social Readiness。社会受容・市場受容 | XRL checklist または `amd_score_inputs.srl` | 社会受容、ステークホルダー反応、導入抵抗、倫理・安全性 |
| `HRL` | 0-9 | Human Readiness。組織・人材 readiness | XRL checklist / 関連メンバー評価 | `project_founding_members`, `project_venture_members`, メンバー構成 |
| `mu_A` | 0-9 | Academic momentum。学術側の追い風 | 観測モデルまたは人間レビュー | `papers_log`, scholar ingest, OpenAlex, 研究活動 |
| `mu_I` | 0-9 | Industry momentum。産業側の追い風 | 観測モデルまたは人間レビュー | `atlas_signals`, VC/企業投資、業界実装、競争環境 |
| `mu_G` | 0-9 | Government momentum。政策・制度側の追い風 | 観測モデルまたは人間レビュー | 政策、規制、補助金、公募、政府文書 |
| `sigma_SU` | 0-9 | Triple Helix 合成値。学・産・官の追い風 | `mu_A` / `mu_I` / `mu_G` から算出 | 上記3系列 |
| `FRL_final` | 0-9 | Founder Readiness。創業者・経営中核の readiness | `resolveFrl()`。`frl_cap` があれば CES、なければ `frl` | ALQ 4因子、Grit、Resilience、経営実行力、AMD寄与 |
| `R_net` / `prs_r_net` | 0-9 / null | 純残存力。粗利・運営コスト・本命PJへの資源毀損を見た生存力 | 詳細画面でレビュー保存。未入力は null | 収益化見込み、運営コスト、リソース毀損、事業優先度 |
| `alpha_x` | 正数 | 各軸の重み / 弾力性 | `PRS_ALPHA_DEFAULT` または `amd_score_alpha` | retrofit / review |

## PRS Input Resolution

`P` と `R_net` は、表示時に次の順で解決する。

1. 画面入力中の draft
2. 対象 `amd_score_inputs` row の `prs_potential` / `prs_r_net`
3. 同一PJで `evaluated_at <= target.evaluated_at` の過去 row に保存済みの値
4. 同一PJの最新 project-level row に保存済みの値
5. null

null は 0 ではない。null の場合は `missingAxes` に入り、PRS score は `null` のまま。これで「情報がないのに低い点を付ける」「legacy score を勝手に primary に戻す」事故を防ぐ。

## R の算出

R は、会社側の到達 readiness。

$$
C_x=(x+1)^{\alpha_x}
$$

$$
R=C_{\mathrm{TRL}}\cdot C_{\mathrm{BRL}}\cdot C_{\mathrm{GRL}}\cdot
C_{\mathrm{SRL}}\cdot C_{\mathrm{HRL}}
$$

XRL の各軸は、原則として XRL 観測チェックリストから作る。各軸の達成レベルは、Lv.1 から順に「全項目チェック済み」が続く最大レベル。

$$
\mathrm{level}_a =
\max\left\{l \mid
\forall j \le l,\ \forall k \in \mathrm{checklist}_{a,j},\
\mathrm{checked}_{a,j,k}=\mathrm{true}
\right\}
$$

保存すると `amd_score_inputs.xrl_checklist` JSONB と同時に `trl` / `brl` / `grl` / `srl` / `hrl` の生値も更新される。定義の正本は [`src/lib/xrl-level-definitions.ts`](../src/lib/xrl-level-definitions.ts)。原典は内閣府 SIP「サーキュラーエコノミーシステムの構築」2023 公募要領。

## S の算出

S は、到達するまで走り切るための生存力。

$$
\sigma_{\mathrm{SU}}
= \sqrt[3]{(\mu_A+1)(\mu_I+1)(\mu_G+1)} - 1
$$

$$
S =
(\sigma_{\mathrm{SU}}+1)^{\alpha_\sigma}
\cdot(\mathrm{FRL}_{\mathrm{final}}+1)^{\alpha_F}
\cdot(R_{\mathrm{net}}+1)^{\alpha_{R_{\mathrm{net}}}}
$$

`sigma_SU` は Triple Helix の学・産・官の合成。幾何平均にしているのは、学術だけ・産業だけ・政策だけの片寄りではなく、3つが揃うほど高くなるようにするため。

### Triple Helix 観測モデル

観測モデルが使える場合、観測値 `y_p` を過去16 quarterで 0-9 に正規化し、loading `c_{xp}` で `mu_A` / `mu_I` / `mu_G` に集約する。

$$
\tilde{y}_p
= 9 \cdot \frac{y_p-\min_t y_p}{\max_t y_p-\min_t y_p}
$$

$$
\mu_x
= \frac{\sum_p c_{xp}\tilde{y}_p}{\sum_p c_{xp}},
\qquad x \in \{A,I,G\}
$$

UI の `c`, `ỹ`, `c·ỹ`, `coverage` はこの途中経過。観測値が欠けている時は推測で埋めず、coverage note に残す。

### FRL final

FRL は、創業者・経営中核の readiness。`frl_cap` が無い行では `frl` をそのまま final FRL とする。`frl_cap` がある行では CES で `F_char` と `F_cap` を合成する。

$$
\overline{\mathrm{ALQ}_4}
= \mathrm{avg}(
\mathrm{SelfAwareness},
\mathrm{RelationalTransparency},
\mathrm{BalancedProcessing},
\mathrm{InternalizedMoral}
)
$$

$$
F_{\mathrm{char}}
=
\frac{
0.6\cdot\overline{\mathrm{ALQ}_4}
+0.2\cdot\mathrm{Grit}
+0.2\cdot\mathrm{Resilience}
}{\sum \mathrm{available\ weights}}
$$

$$
\mathrm{FRL}_{\mathrm{final}}
=
\left(
a(F_{\mathrm{char}}+1)^\rho
+(1-a)(F_{\mathrm{cap}}+1)^\rho
\right)^{1/\rho}-1
$$

既定値は `a=0.6`, `rho=-2`。`rho<0` にすることで、資質と実行力のどちらかが低い時に FRL が大きく下がる補完性を表す。S 全体は Cobb-Douglas 的に代替余地があるが、FRL 内部だけは CES で「両方必要」を表現する。

## Alpha Weights

現行の PRS default は `pwa/src/lib/amd-score.ts` の `PRS_ALPHA_DEFAULT`。

| 軸 | alpha | 読み方 |
|---|---:|---|
| `P` | 1.0 | Potential を標準重みで見る |
| `TRL` | 1.0 | 技術中核 |
| `BRL` | 0.6 | 事業検証 |
| `GRL` | 0.3 | 規制・制度 |
| `SRL` | 0.2 | 社会受容 |
| `HRL` | 1.1 | Deeptech では人材・組織が律速になりやすい |
| `sigma_SU` | 1.3 | Macrotrend に乗っているかを重視 |
| `FRL` | 1.5 | founder quality を最重視 |
| `R_net` | 0.8 | 純残存力を Survival に効かせる |

`amd_score_alpha` は legacy alpha の version 管理に使う。PRS weight の恒久変更をする時は、manual / spec / design と UI 表示を同じ作業単位で同期する。

## 律速軸

律速軸は「1 段階上げた時に score が一番増える軸」。

$$
\frac{\partial \mathrm{Score}}{\partial Z_i}
= \frac{\alpha_i \cdot \mathrm{Score}}{Z_i+1}
$$

$$
\mathrm{bottleneck}
= \arg\max_i \frac{\alpha_i}{Z_i+1}
$$

単に値が低い軸ではない。alpha が大きく、現在値が低い軸が最も効く。現行画面では legacy comparison の bottleneck も併記するが、主表示の判断は PRS primary を先に読む。

## 画面に出ているもの

| 表示 | 位置づけ | 算出 / 取得元 |
|---|---|---|
| `PRS Primary` | 現行 primary | `calculatePrsScore()`。`P` / `R_net` が揃った時だけ score を出す |
| `INPUT NEEDED` | review pending | `missingAxes`。`P` / `R_net` のどちらかが null |
| `P Potential` | primary input | `amd_score_inputs.prs_potential` |
| `R_net` | primary input | `amd_score_inputs.prs_r_net` |
| `R reach` | PRS component | TRL / BRL / GRL / SRL / HRL の contribution product |
| `S survival` | PRS component | `sigma_SU` / final FRL / `R_net` の contribution product |
| `PRS history` | primary history | `computePrsScoreSeries()`。`status='ready'` の行だけ採用 |
| `Legacy AMD comparison` | legacy comparison | 旧 7 軸 Cobb-Douglas。PRS missing の代替 primary ではない |
| `M / X / F バランス` | legacy evidence | `M=sigma_SU`, `X=5 XRL`, `F=FRL` |
| `Triple Helix Matrix` | `sigma_SU` evidence | `mu_A` / `mu_I` / `mu_G`、C行列、観測値、被覆率 |
| `FRL panel` | founder evidence | ALQ 4因子 / Grit / Resilience / F_cap / notes |
| `XRL checklist` | XRL evidence / writer | チェックリストから達成レベルを算出し、`trl..hrl` へ反映 |

## データソース

| データ | 主な source | 保存先 / 参照先 |
|---|---|---|
| `P` | 事業仮説、Venture narrative、PL hearing、まさレビュー | `amd_score_inputs.prs_potential` |
| `R_net` | 収益化見込み、粗利、運営コスト、リソース毀損 | `amd_score_inputs.prs_r_net` |
| `mu_A` | 論文、研究活動、OpenAlex | `papers_log`, scholar ingest, `amd_score_inputs.mu_A` |
| `mu_I` / `mu_G` | 政策、投資、ニュース、業界実装 | `atlas_signals`, `macro_index_log`, `amd_score_inputs.mu_I/mu_G` |
| `TRL/BRL/GRL/SRL/HRL` | XRL checklist、XRL evidence、進捗ログ | `project_xrl_log`, `project_xrl_evidence`, `amd_score_inputs.xrl_checklist` |
| `FRL` | ALQ / Grit / Resilience / 経営実行力 | `amd_score_inputs.frl_*`, `project_founding_members` |
| annotation | score 変化の根拠イベント | `project_events`, 経営ハイライト |

`amd_score_inputs` には未来予測 row も入るため、現在値を出す時は **`evaluated_at <= today` の最新行**を使う。経時グラフは未来予測も表示してよい。

## 根拠 notes の優先順

| 軸 | 優先順 |
|---|---|
| XRL 5 軸 | `amd_score_inputs.xrl_notes` -> `project_xrl_log.source_note` -> 仮置き |
| `mu_A` | `amd_score_inputs.mu_notes.a` -> `scholar` / `papers_log` -> 仮置き |
| `mu_I` / `mu_G` | `amd_score_inputs.mu_notes.i/g` -> `atlas_signals` -> 仮置き |
| FRL | `amd_score_inputs.frl_notes` / `frl_cap_notes` -> 仮置き |
| P / R_net | detail input notes / review rationale -> 仮置き |

値だけでなく、なぜその値なのかを残すことが重要。根拠が無い値は「高い/低い」ではなく「review pending」として扱う。

## 更新フロー

```text
XRL / Macrotrend / FRL / P / R_net の根拠が増える
        ↓
amd_score_inputs に評価 row または PRS input を保存
        ↓
cockpit / venture-map が today 以前の最新 row を読む
        ↓
PRS Primary / PRS history / legacy M-X-F / evidence を表示
        ↓
まさが違和感を持ったら詳細画面・Tsukuyomi・修正依頼 loop で直す
```

## Legacy AMD / M-X-F Appendix

legacy MXF (= M-X-F / 7 軸 Cobb-Douglas) は過去モデル。削除しないが、現行 primary として読まない。

$$
\mathrm{Score}_{\mathrm{legacy}}
= K_{\mathrm{legacy}}
\cdot
\prod_{i \in \mathcal{A}_{\mathrm{legacy}}}(X_i+1)^{\alpha_i}
$$

$$
\mathcal{A}_{\mathrm{legacy}}
= \{\sigma_{\mathrm{SU}},\mathrm{TRL},\mathrm{BRL},\mathrm{GRL},\mathrm{SRL},\mathrm{HRL},\mathrm{FRL}\}
$$

$$
\mathrm{Score}_{\mathrm{legacy}}
= K_{\mathrm{legacy}}\cdot M\cdot X\cdot F
$$

$$
M=(\sigma_{\mathrm{SU}}+1)^{\alpha_\sigma}
$$

$$
X=\prod_{x \in \{\mathrm{TRL},\mathrm{BRL},\mathrm{GRL},\mathrm{SRL},\mathrm{HRL}\}}(x+1)^{\alpha_x}
$$

$$
F=(\mathrm{FRL}_{\mathrm{final}}+1)^{\alpha_F}
$$

| legacy 要素 | 意味 | 現行 PRS での読み方 |
|---|---|---|
| `M` | Macrotrend / Triple Helix | `S` の `sigma_SU` evidence |
| `X` | 5 XRL readiness | `R` の evidence |
| `F` | Founder readiness | `S` の FRL evidence |

保存目的:

- 過去の retrofit / score history を読み解く
- PRS の R/S の根拠として XRL / sigma_SU / FRL を残す
- 旧画面・旧説明との比較対象にする

禁止:

- legacy score を PRS missing の代替 primary にする
- M-X-F を章 summary や cockpit 主表示の主語へ戻す
- 既存 7 軸履歴を破壊的に再計算する

## 関連

- [`pwa/spec/4-2-amd-score-current-spec.md`](../spec/4-2-amd-score-current-spec.md)
- [`pwa/design/amd_score.md`](../design/amd_score.md)
- [`pwa/design/xrl_evidence.md`](../design/xrl_evidence.md)
- [`pwa/design/score_revision_feedback_loop.md`](../design/score_revision_feedback_loop.md)
- [`pwa/design/macrotrend_atlas_seeds_architecture.md`](../design/macrotrend_atlas_seeds_architecture.md)
