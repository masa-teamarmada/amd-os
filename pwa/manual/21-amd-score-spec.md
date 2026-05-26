# AMD Score 詳細仕様

AMD Score は、PJ / SU の価値・成熟度を数値化する指標。日常画面では cockpit の上段に M / X / F として表示されるが、設計上は Before Zero Theory v3.2 の 7 軸 Cobb-Douglas 指標。

## AMD Score と Management Score の違い

| 名前 | 対象 | 目的 |
|---|---|---|
| **AMD Score** | PJ / SU | その PJ が立ち上がる価値・成熟度を見る |
| **AMD Management Score** | AMD 全社 | 今月の会社経営状態を見る |

混ぜない。PJ の価値評価は AMD Score、会社全体の健康度は AMD Management Score。

## 基本式

```text
AMD Score = K · Π (X_i + 1)^α_i

X = {σ_SU, TRL, BRL, GRL, SRL, HRL, FRL}

σ_SU = ((μ_A+1)(μ_I+1)(μ_G+1))^(1/3) - 1
K    = 100,000 / 10^Σα
```

全軸が 9 の IPO 級 PJ が 100,000 になるように K を校正する。Shallow Tech mode では TRL 軸を除外し、6 軸で K を再校正する。

## UI 表示の M / X / F

理論上は 7 軸の積だが、画面では次の 3 大要素で見せる。

```text
S = k · M · X · F

M = (σ_SU+1)^α_σ
X = Π_{x ∈ {TRL,BRL,GRL,SRL,HRL}} (x+1)^α_x
F = (FRL+1)^α_F
```

| UI | 意味 | 構成 |
|---|---|---|
| M | Macrotrend / Triple Helix | 学術 μ_A、産業 μ_I、政府 μ_G |
| X | 会社側 readiness | TRL / BRL / GRL / SRL / HRL |
| F | Founder / CEO readiness | FRL |

まさの言語化では「マクロトレンドの流れがあり、会社の XRL が整い、それを FRL 高い CEO が牽引する」。

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

```text
∂S/∂X_i = α_i · S / (X_i + 1)
bottleneck = argmax_i α_i / (X_i + 1)
```

単に値が低い軸ではない。α が大きく、かつ現在値が低い軸が最も効く。

## データソース

| データ | 主な source |
|---|---|
| μ_A | `papers_log`, scholar ingest, OpenAlex |
| μ_I / μ_G | `atlas_signals`, `macro_index_log`, Atlas / Macrotrend |
| TRL/BRL/GRL/SRL/HRL | `project_xrl_log`, `project_xrl_evidence`, `amd_score_inputs.xrl_notes` |
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
| `各 PJ cockpit` | 現在の score、M/X/F、XRL、経時グラフ |
| `/venture-map/amd-score` | PJ / SU 一覧 |
| `/venture-map/amd-score/{projectId}` | 詳細。式、M/X/F、FRL、根拠 notes |
| `/venture-map/amd-score/retrofit` | α 重み調整と simulation |

## 関連設計 md

- [`pwa/design/amd_score.md`](../design/amd_score.md)
- [`pwa/design/xrl_evidence.md`](../design/xrl_evidence.md)
- [`pwa/design/score_revision_feedback_loop.md`](../design/score_revision_feedback_loop.md)
- [`pwa/design/macrotrend_atlas_seeds_architecture.md`](../design/macrotrend_atlas_seeds_architecture.md)
