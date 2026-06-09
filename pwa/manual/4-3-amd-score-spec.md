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

```text
AMD Score primary = K_prs · P · R · S

P = Potential / 潜在規模
R = Reach / Readiness = TRL / BRL / GRL / SRL / HRL の contribution product
S = Survival = σ_SU / FRL / R_net の contribution product
R_net = 収益化指数
```

P / R_net は `amd_score_inputs.prs_potential` / `amd_score_inputs.prs_r_net` に nullable で保存する。未入力の PJ は review pending とし、0点に丸めたり legacy AMD を主表示へ戻したりしない。

## Legacy AMD / M-X-F

旧モデルは、Before Zero Theory v3.2 の 7 軸 Cobb-Douglas 指標。現行 primary ではなく、比較・根拠・過去履歴用に残す。

```text
S = k · M · X · F

M = (σ_SU+1)^α_σ
X = Π_{x ∈ {TRL,BRL,GRL,SRL,HRL}} (x+1)^α_x
F = (FRL+1)^α_F

σ_SU = ((μ_A+1)(μ_I+1)(μ_G+1))^(1/3) - 1
K    = 100,000 / 10^Σα
```

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
PRS Primary / PRS history / legacy M-X-F / 律速軸を表示
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

## PRS primary の読み方

`P x R x S` が現行の主モデル。legacy 7軸 AMD Score は M-X-F comparison と evidence 用に残す。

- `P`: Potential / 潜在規模
- `R`: Reach / Readiness。TRL / BRL / GRL / SRL / HRL
- `S`: Survival。σ_SU / FRL / R_net
- `R_net`: 収益化指数。粗利 - 運営コスト - 本命から奪うリソース毀損

P / R_net が入っている PJ は PRS score を主表示する。未入力の場合は `INPUT NEEDED` / review pending とし、legacy AMD を primary に戻さない。詳細画面では P / R_net を保存でき、PRS history は過去 row に explicit PRS input が無い場合も最新 reviewed project-level PRS input を使って back-calculate する。

P/R_net rubric の厳密化と全 PJ の埋め切りは継続レビュー対象。

## Appendix: legacy MXF / 7軸モデル

legacy MXF (= M-X-F / 7軸 Cobb-Douglas) は過去モデル。削除しないが、現行 primary として読まない。

- `M`: Macrotrend / Triple Helix。σ_SU、μ_A、μ_I、μ_G。
- `X`: XRL。TRL / BRL / GRL / SRL / HRL。
- `F`: Founder readiness。FRL。
- 使い道: PRS の R/S evidence、過去 score history、alpha review、旧表示との比較。
- 禁止: legacy score を PRS missing の代替 primary にすること、M-X-F を章 summary や cockpit 主表示の主語へ戻すこと。

## 関連設計 md

- [`pwa/design/amd_score.md`](../design/amd_score.md)
- [`pwa/design/xrl_evidence.md`](../design/xrl_evidence.md)
- [`pwa/design/score_revision_feedback_loop.md`](../design/score_revision_feedback_loop.md)
- [`pwa/design/macrotrend_atlas_seeds_architecture.md`](../design/macrotrend_atlas_seeds_architecture.md)
