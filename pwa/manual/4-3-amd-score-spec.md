# AMD Score 詳細仕様

AMD Score は、PJ / SU の価値・成熟度を数値化する指標。現行画面の主表示は **PRS Primary** (`P x R x S`)。M / X / F と 7 軸 Cobb-Douglas は legacy AMD comparison として残し、PRS の根拠・履歴比較・旧モデル確認に使う。

> 実装者向けの AMD Score 確定仕様は [/spec/4-2-amd-score-current-spec](/spec/4-2-amd-score-current-spec) へ移行済み。理論導出は `/bzm`、日常画面での読み方はこの章に残す。

## AMD Score と Management Score の違い

| 名前 | 対象 | 目的 |
|---|---|---|
| **AMD Score** | PJ / SU | その PJ が立ち上がる価値・成熟度を見る |
| **AMD Management Score** | AMD 全社 | 今月の会社経営状態を見る |

混ぜない。PJ の価値評価は AMD Score、会社全体の健康度は AMD Management Score。

## 現行 primary: PRS

$$
\mathrm{Score}_{\mathrm{PRS}} = K_{\mathrm{PRS}} \cdot P \cdot R \cdot S
$$

$$
P = (P_{\mathrm{input}}+1)^{\alpha_P}
$$

$$
R = \prod_{x \in \{\mathrm{TRL},\mathrm{BRL},\mathrm{GRL},\mathrm{SRL},\mathrm{HRL}\}} (x+1)^{\alpha_x}
$$

$$
S = (\sigma_{\mathrm{SU}}+1)^{\alpha_\sigma} \cdot (\mathrm{FRL}+1)^{\alpha_F} \cdot (R_{\mathrm{net}}+1)^{\alpha_{R_{\mathrm{net}}}}
$$

$$
K_{\mathrm{PRS}} = \frac{100{,}000}{10^{\sum_{x \in \mathcal{A}_{\mathrm{PRS}}}\alpha_x}}
$$

P / R_net は `amd_score_inputs.prs_potential` / `amd_score_inputs.prs_r_net` に nullable で保存する。未入力は「review pending」として扱い、0点に丸めたり legacy AMD を主表示へ戻したりしない。

### K / P / R / S のざっくり意味

PRS は、「このPJが大きくなる可能性があるか」「そこへ届く準備があるか」「届くまで生き残れるか」を分けて見るための読み方。

| 記号 | 意味 | ざっくり言うと |
|---|---|---|
| `K_PRS` | 校正係数 | スコアの物差し。全active axisが9点の時に100,000になるように合わせる倍率 |
| `P` | Potential | 当たった時の大きさ。市場・事業・社会インパクトの天井 |
| `R` | Reach | そこまで届く準備。技術・事業・制度・社会受容・人材が揃っているか |
| `S` | Survival | 途中で死なない力。マクロの追い風、founder readiness、純残存力 |

足し算ではなく積にしているのは、P/R/S が「どれか1つ高ければOK」ではないから。ポテンシャルが大きくても届く準備がなければ立ち上がらないし、準備があっても生き残れなければ途中で止まる。逆に3つが同時に揃うと、score は一気に伸びる。

なので PRS は「強みの合計点」ではなく、「立ち上がるための必要条件がどれだけ同時に揃っているか」を見るモデル。`K_PRS` はその値をOS上で見やすいスケールへ合わせるだけで、PJの実力そのものは `P` / `R` / `S` が持っている。

## スコア詳細ページに出ているもの

`/venture-map/amd-score/{projectId}` と PJ コックピットの `スコア詳細` タブは、次の順番で読む。

| 表示 | 読み方 | 算出 / 入力 |
|---|---|---|
| `PRS Primary` | いまの AMD Score 正本 | `Score_PRS = K_PRS * P * R * S` |
| `INPUT NEEDED` | PRS未完成 | `P` / `R_net` のどちらかが未入力。legacyを代わりに主表示しない |
| `P Potential` | 事業ポテンシャル | `prs_potential` を人がレビューして保存。計算上は `(P_input+1)^alpha_P` |
| `R_net` | 純残存力 | `prs_r_net` を人がレビューして保存。計算上は `(R_net+1)^alpha_R_net` |
| `R reach` | 到達力 | TRL / BRL / GRL / SRL / HRL の積 |
| `S survival` | 生存力 | `sigma_SU` / FRL / `R_net` の積 |
| `PRS history` | PRSの時系列 | P/R_netまで揃っている過去行だけを log scale で描く |
| `Legacy AMD comparison` | 旧モデル比較 | M-X-F / 7軸の旧スコア。現行primaryではない |
| `M / X / F バランス` | 旧モデルの内訳 | M=Macrotrend、X=XRL、F=FRL |
| `Triple Helix Matrix` | Mの根拠 | `mu_A` / `mu_I` / `mu_G`、観測値、loading、coverage |
| `FRL — Founder Readiness Level` | founder readiness の根拠 | ALQ 4因子 / Grit / Resilience / FRL notes / final FRL |
| `XRL 観測チェックリスト` | XRL値の根拠 | レベル別チェックから達成レベルを算出し、保存時に `trl..hrl` へ反映 |
| `律速` | 最初に手当てすべき軸 | 限界感度が最大の軸 |

### P / R_net の決まり方

詳細ページの入力欄で保存すると、最新の `amd_score_inputs` row に `prs_potential` / `prs_r_net` として保存される。通常表示では、対象 row の値を先に読み、無ければ同じPJの過去保存値、さらに同じPJの最新保存値を見にいく。それでも無ければ null のまま review pending。

空欄は 0 ではなく null。ここがすごく大事。

### R reach の決まり方

$$
C_x = (x+1)^{\alpha_x}
$$

$$
R = C_{\mathrm{TRL}} \cdot C_{\mathrm{BRL}} \cdot C_{\mathrm{GRL}} \cdot C_{\mathrm{SRL}} \cdot C_{\mathrm{HRL}}
$$

Shallow Tech モードでは TRL を外して、K も TRL 抜きで再校正する。

### S survival の決まり方

$$
\sigma_{\mathrm{SU}} = \sqrt[3]{(\mu_A+1)(\mu_I+1)(\mu_G+1)} - 1
$$

$$
S = (\sigma_{\mathrm{SU}}+1)^{\alpha_\sigma}
\cdot (\mathrm{FRL}_{\mathrm{final}}+1)^{\alpha_F}
\cdot (R_{\mathrm{net}}+1)^{\alpha_{R_{\mathrm{net}}}}
$$

`sigma_SU` は Triple Helix の学・産・官の合成。FRL は founder readiness。`R_net` は人がレビューして入れる純残存力。

### Triple Helix Matrix の読み方

観測モデルが使える場合、観測値 `y_p` を過去16 quarterで 0-9 に正規化し、loading `c_{xp}` で `mu_A` / `mu_I` / `mu_G` に集約する。

$$
\tilde{y}_p = 9 \cdot \frac{y_p - \min_t y_p}{\max_t y_p - \min_t y_p}
$$

$$
\mu_x = \frac{\sum_p c_{xp}\tilde{y}_p}{\sum_p c_{xp}}
$$

画面の `c`, `ỹ`, `c·ỹ`, `データ被覆率` はこの計算の途中経過。欠落している観測量は推測で補完しない。

### FRL 6因子の読み方

FRL自動算出モードでは ALQ 4因子平均、Grit、Resilience から推定する。未入力の因子は 0 扱いではなく、入力済みの重みだけで正規化する。

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

FRL capability layer (`frl_cap`) がある時は `/spec/4-1-frl-ces-current-spec` の CES で final FRL を作る。

$$
\mathrm{FRL}_{\mathrm{final}}
= \left(a(F_{\mathrm{char}}+1)^\rho + (1-a)(F_{\mathrm{cap}}+1)^\rho\right)^{1/\rho} - 1
$$

### XRL 観測チェックリストの読み方

各軸の達成レベルは、Lv.1から順に「全項目チェック済み」が続く最大レベル。

$$
\mathrm{level}_a =
\max\left\{l \mid \forall j \le l,\ \forall k \in \mathrm{checklist}_{a,j},\ \mathrm{checked}_{a,j,k}=\mathrm{true}\right\}
$$

保存すると `xrl_checklist` JSONB と同時に `trl` / `brl` / `grl` / `srl` / `hrl` の生値も更新される。

## Legacy AMD / M-X-F

旧モデルでは 7 軸の積を、画面では次の 3 大要素で見せていた。これは現行 primary ではなく、legacy comparison / evidence 用の読み方。

$$
\mathrm{Score}_{\mathrm{legacy}}
= K_{\mathrm{legacy}} \cdot \prod_{i \in \mathcal{A}_{\mathrm{legacy}}}(X_i+1)^{\alpha_i}
$$

$$
\mathcal{A}_{\mathrm{legacy}}
= \{\sigma_{\mathrm{SU}},\mathrm{TRL},\mathrm{BRL},\mathrm{GRL},\mathrm{SRL},\mathrm{HRL},\mathrm{FRL}\}
$$

$$
\mathrm{Score}_{\mathrm{legacy}} = K_{\mathrm{legacy}} \cdot M \cdot X \cdot F
$$

$$
M = (\sigma_{\mathrm{SU}}+1)^{\alpha_\sigma}
$$

$$
X = \prod_{x \in \{\mathrm{TRL},\mathrm{BRL},\mathrm{GRL},\mathrm{SRL},\mathrm{HRL}\}} (x+1)^{\alpha_x}
$$

$$
F = (\mathrm{FRL}+1)^{\alpha_F}
$$

| UI | 意味 | 構成 |
|---|---|---|
| M | Macrotrend / Triple Helix | 学術 μ_A、産業 μ_I、政府 μ_G |
| X | 会社側 readiness | TRL / BRL / GRL / SRL / HRL |
| F | Founder / CEO readiness | FRL |

まさの言語化では「マクロトレンドの流れがあり、会社の XRL が整い、それを FRL 高い CEO が牽引する」。この M-X-F は PRS の R/S evidence chain と legacy comparison として読む。

## 軸の意味

| 軸 | 読み方 | 見るもの |
|---|---|---|
| μ_A | Academic | 論文、研究活動、学術的盛り上がり |
| μ_I | Industry | 企業投資、業界実装、競争環境 |
| μ_G | Government | 政策、規制、補助金、公的支援 |
| TRL | Technology Readiness | 技術成熟度 |
| BRL | Business Readiness | 事業化成熟度 |
| GRL | Governance / Government Readiness | 規制・制度成熟度 |
| SRL | Social Readiness | 社会受容・市場受容 |
| HRL | Human Readiness | チーム・人材・創業コア |
| FRL | Founder Readiness | CEO / founder のリーダーシップ |

## α の base case

| 軸 | α | 意味 |
|---|---:|---|
| FRL | 1.5 | founder quality を重視 |
| σ_SU | 1.3 | Macrotrend に乗っているかを重視 |
| HRL | 1.1 | Deeptech では人材・組織が律速になりやすい |
| TRL | 1.0 | 技術中核 |
| BRL | 0.6 | 事業検証 |
| GRL | 0.3 | 規制・制度 |
| SRL | 0.2 | 社会受容 |

α は `amd_score_alpha` でバージョン管理する。日常 UI では直接触らず、retrofit / review 専用画面で扱う。

## 律速軸

律速軸は「1 段階上げた時に score が一番増える軸」。

$$
\frac{\partial \mathrm{Score}}{\partial Z_i}
= \frac{\alpha_i \cdot \mathrm{Score}}{Z_i + 1}
$$

$$
\mathrm{bottleneck} = \arg\max_i \frac{\alpha_i}{Z_i + 1}
$$

単に値が低い軸ではない。α が大きく、かつ現在値が低い軸が最も効く。

## データソース

| データ | 主な source |
|---|---|
| μ_A | `papers_log`, scholar ingest, OpenAlex |
| μ_I / μ_G | `atlas_signals`, `macro_index_log`, Atlas / Macrotrend |
| TRL/BRL/GRL/SRL/HRL | `project_xrl_log`, `project_xrl_evidence`, `amd_score_inputs.xrl_notes` / `amd_score_inputs.xrl_checklist` (観測チェックリスト) |
| FRL | `amd_score_inputs.frl_*`, ALQ / Grit / Resilience |
| annotation | `project_events`, 経営ハイライト |

`amd_score_inputs` には未来予測 row も入るため、現在値を出す時は **`evaluated_at <= today` の最新行**を使う。経時グラフは未来予測も表示してよい。

## 根拠 notes の優先順

| 軸 | 優先順 |
|---|---|
| XRL 5 軸 | `amd_score_inputs.xrl_notes` -> `project_xrl_log.source_note` -> 仮置き |
| μ_A | `amd_score_inputs.mu_notes.a` -> `scholar` / `papers_log` -> 仮置き |
| μ_I / μ_G | `amd_score_inputs.mu_notes.i/g` -> `atlas_signals` -> 仮置き |
| FRL | `amd_score_inputs.frl_notes` -> 仮置き |

値だけでなく、なぜその値なのかを残すことが重要。

## XRL 観測チェックリスト (2026-05-30 追加)

XRL の各軸レベルを「案件ごとにブレずに」判定するため、**内閣府 SIP「サーキュラーエコノミーシステムの構築」2023 公募要領 (図2-6) の原典定義に完全準拠**したレベル定義 + 観測チェックリストを持つ。

- **段階数は軸で違う (原典どおり)**: TRL / BRL = **9 段階**、GRL / SRL / HRL = **8 段階** (後者は慶應義塾大学 栗野研究室 提案)。AMD が勝手な基準を作らない (= 仕組みの信頼性の根幹)。
- 定義の正本は [`src/lib/xrl-level-definitions.ts`](../src/lib/xrl-level-definitions.ts)。各レベルに原典の `label` / `description` と、それを観測可能項目に分解した `checklist[]` を持つ。
- **判定ロジック**: 達成レベル = 下から見て「全項目チェック済みの連続最大レベル」(積み上げ式)。途中のレベルが欠けたらそこで止まる。
- **UI**: スコア詳細ページ (`/venture-map/amd-score/{projectId}`) の **XRL 観測チェックリストパネル**。5 軸タブ → レベル別にチェック項目を表示 → チェックすると達成レベルを自動算出 → 保存で `amd_score_inputs.xrl_checklist` (JSONB `{axis:{level:[bool,...]}}`) に保存し、XRL 生値 (trl..hrl) も達成レベルで上書きする。
- **運用**: えいみ (Claude/Codex) が全 PJ に初期チェックを投入 → まさが画面で修正する (Tsukuyomi は使わない、まさ確定 2026-05-30)。初期投入は [`scripts/seed_xrl_checklist.mjs`](../scripts/seed_xrl_checklist.mjs)。
- 原典 PDF: 共有ドライブ `ARMADA/a1_all/データベース/XRLの元文献.pdf`。

## 更新フロー

```text
XRL / Macrotrend / FRL の根拠が増える
        ↓
amd_score_inputs に評価 row を追加
        ↓
cockpit / venture-map が今日以前の最新 row を読む
        ↓
M / X / F / AMD Score / 律速軸を表示
        ↓
まさが違和感を持ったら Tsukuyomi へ修正依頼
```

今後の設計では、経営ハイライトに `score_impact_summary` を付け、AMD Score のどの軸にどう効いたかを 1 行で表示する予定。

## 画面

| 画面 | 役割 |
|---|---|
| `各 PJ cockpit` | PRS primary status、legacy AMD comparison、XRL、経時グラフ |
| `/venture-map/amd-score` | PJ / SU 一覧。主表示は PRS、legacy AMD は比較欄 |
| `/venture-map/amd-score/{projectId}` | 詳細。PRS primary 入力、PRS history、legacy M-X-F、FRL、根拠 notes、**XRL 観測チェックリスト** |
| `/venture-map/amd-score/retrofit` | PRS review queue と legacy α 重み調整 |

## PRS primary

`P x R x S` を主表示に切り替えた。legacy 7軸 AMD Score は M/X/F comparison と evidence 用に残す。

- `P`: Potential / 潜在規模
- `R`: Reach / Readiness。TRL / BRL / GRL / SRL / HRL
- `S`: Survival。σ_SU / FRL / R_net
- `R_net`: 収益化指数。粗利 - 運営コスト - 本命から奪うリソース毀損

P / R_net は `amd_score_inputs.prs_potential` / `amd_score_inputs.prs_r_net` に nullable で保存する。未入力は `not enough data` ではなく「review pending」として扱い、0点に丸めたり legacy AMD を主表示へ戻したりしない。

入力導線は各 PJ detail に置く。retrofit 画面は ready / missing を俯瞰し、legacy α を comparison として調整する。

## Appendix: legacy MXF / 7軸モデル

legacy MXF (= M-X-F / 7軸 Cobb-Douglas) は過去モデル。削除しないが、現行 primary として読まない。

- 保存目的: 過去の retrofit / score history、PRS の R/S 根拠、旧画面との比較。
- UI 文言: `Legacy AMD comparison` / `legacy M-X-F` / `comparison only`。
- 禁止: legacy score を PRS missing の代替 primary にすること、M-X-F を章 summary や cockpit 主表示の主語へ戻すこと。

## 関連設計 md

- [`pwa/design/amd_score.md`](../design/amd_score.md)
- [`pwa/design/xrl_evidence.md`](../design/xrl_evidence.md)
- [`pwa/design/score_revision_feedback_loop.md`](../design/score_revision_feedback_loop.md)
- [`pwa/design/macrotrend_atlas_seeds_architecture.md`](../design/macrotrend_atlas_seeds_architecture.md)
