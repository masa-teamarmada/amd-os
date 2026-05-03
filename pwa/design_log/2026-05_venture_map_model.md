# AMD Venture Map — 数理モデル設計書

作成: 2026-05-03  
対象: AMD OS Venture Map (`/venture-map`) の数理モデル・データパイプライン正本。  
他セッションでモデルを議論・改訂する際はこのファイルを起点にする。

---

## 背景と設計思想

AMD（チームアルマダ）は深技術（deep-tech）スタートアップスタジオ。
過去 9社の SU（スタートアップ）立ち上げ経験から、**「マクロ波の何処に投入するか」が SU の生存を大きく左右する**という仮説を持っている。

従来は定性的・経験的に判断していたものを、**定量化・LLM 自動更新する仕組み**として AMD OS に組み込んだのがこのモデル。

---

## モデル全体像

```
政策シグナル P_i(t)
公募予算     B_i(t)    →  M_i(t): マクロ指数  →  T_i(t): 事業化適温度  →  σ_SU: 投入シグナル
VC投資額     V_i(t)
政策言及数   R_i(t)

論文数 N_i(t) ──────→  D_i(t): 論文-政策乖離  →  変曲点検出  →  投入タイミング補正
```

---

## 数式 ① — マクロトレンド指数

$$
M_i(t) = \alpha_i \int_{t-\tau}^{t} P_i(s)\, e^{-\lambda_i (t-s)}\, ds \;+\; \beta_i\, B_i(t) \;+\; \gamma_i\, V_i(t) \;+\; \delta_i\, R_i(t)
$$

### 変数定義

| 記号 | 意味 | 現在のデータソース |
|---|---|---|
| $M_i(t)$ | レーン $i$ の時刻 $t$ におけるマクロ指数 (0-1) | `macro_index_log.index_value` |
| $P_i(s)$ | 政策密度（時刻 $s$ における政策シグナル数） | Atlas `atlas_signals` 集計 → `policy_density` |
| $B_i(t)$ | 公募予算・グラント配分額 | 未投入（当面 $\beta$ で吸収） |
| $V_i(t)$ | VC 投資額 | 未投入（当面 $\gamma$ で吸収、`invest` は仮値） |
| $R_i(t)$ | 政策言及数（ニュース等でのレーン関連言及） | Atlas `policy_mention_count` |
| $\tau$ | 過去参照窓（固定: 24ヶ月） | グローバル定数 |
| $\lambda_i$ | 政策効果の減衰率（小さいほど効果が長続き） | `macro_lane_weights.lambda` |

### 積分項の意味

$\int_{t-\tau}^{t} P_i(s)\, e^{-\lambda_i (t-s)}\, ds$ は「過去の政策シグナルが指数的に減衰しながら現在に累積効果を与える」式。

- $\lambda$ が小さい（例: life = 0.10）→ AMED予算は一度通ると数年効く
- $\lambda$ が大きい（例: materials = 0.22）→ 経済安保政策は風化が早い

---

## 数式 ② — 事業化適温度

$$
T_i(t) = M_i(t) \cdot S_i^{\,\kappa} \cdot \bigl(1 - C_i(t)\bigr)^{\eta_i}
$$

### 変数定義

| 記号 | 意味 | 現在の扱い |
|---|---|---|
| $T_i(t)$ | レーン $i$ の時刻 $t$ における事業化適温度 (0-1) | View B の「総合温度」の基底 |
| $S_i$ | シーズ成熟度（レーン固有の定数） | 未実装、$\kappa = 0.7$ で固定 |
| $\kappa$ | シーズ成熟度の効き方（固定: 0.7） | グローバル定数 |
| $C_i(t)$ | 競合密度（既存 SU/企業の密度） | 未投入、当面 0 扱い |
| $\eta_i$ | 競合密度の効き方（大きいほど競合に敏感） | `macro_lane_weights.eta` |

### $\eta_i$ の設計意図

robo レーンは「競合が増えやすい（農業ロボはすでに多い）」ため $\eta$ を高めに設定。
失敗 SU（burnout / ue_fail）があったレーンは過去のボトルネックを反映して $\eta$ を上げる。

---

## 数式 ③ — 論文-政策乖離と変曲点検出

$$
D_i(t) = \frac{dN_i}{dt} - \frac{dM_i}{dt}
$$

$$
D_i'(t) = \frac{d^2 N_i}{dt^2} - \frac{d^2 M_i}{dt^2}
$$

### 解釈

| 条件 | 意味 | AMD 行動 |
|---|---|---|
| $D > 0$ | 論文先行（研究が政策より進んでいる） | シーズ仕込み期 → スカウト強化 |
| $D < 0$ | 政策先行（政策が研究を引っ張っている） | 研究集中要請 → 大学連携強化 |
| $D'$ が極大 | 論文-政策の加速度差が最大 = 領域転換点接近 | 投下シグナル（要議論: 極大が最適か議論余地あり） |

### 現在の実装

- $N_i(t)$ = OpenAlex 論文数（`papers_log`、年次）
- $M_i(t)$ = `macro_index_log`（月次、2010-2025 は Sonnet 推定値）
- 微分は View A 上で視覚的に確認するのみ（数値計算は未実装）

---

## 数式 ④ — 設立タイミングシグナル

$$
\sigma_{\mathrm{SU}} = \frac{1}{\Delta t}\int_{t_0 - \Delta t}^{t_0} T_i(s)\, ds \;+\; \mu \cdot \left.\frac{d^2 M_i}{dt^2}\right|_{t_0}
$$

### 変数定義

| 記号 | 意味 | 現在の扱い |
|---|---|---|
| $\sigma_{\mathrm{SU}}$ | 時刻 $t_0$ における SU 投入シグナル強度 | 未実装（View B の総合温度が代替） |
| $\Delta t$ | 統合窓（固定: 6ヶ月） | グローバル定数 |
| $\mu$ | 加速度ボーナスの重み（固定: 0.15） | グローバル定数 |

### 意図

「波の積分平均が高い期間 + マクロが加速中（二次微分がプラス）」のタイミングが最適投入点というアイデア。

$D'$ の極大との関係が未整理（**次セッションで要議論**）。

---

## 重みパラメータ α/β/γ/δ/λ/η

### 制約条件

$$
\alpha_i + \beta_i + \gamma_i + \delta_i = 1.00 \quad (\pm 0.02)
$$

$$
\alpha_i, \beta_i, \gamma_i, \delta_i \in [0.05,\, 0.60]
\quad \lambda_i \in [0.05,\, 0.40]
\quad \eta_i \in [0.50,\, 2.00]
$$

### 現在の推定値（Sonnet 4.6 による最新推定）

| レーン | α (政策) | β (予算) | γ (投資) | δ (言及) | λ (減衰) | η (競合) |
|---|---|---|---|---|---|---|
| gx_energy | 高め | 中 | 中 | 中 | 中 | 中 |
| gx_circular | 最高 | 中 | 低 | 中 | 低 | 高め |
| materials | 中 | 中 | 高め | 中 | 高め | 低 |
| life | 低め | 突出して高 | 低 | 中 | 最低 | 中 |
| robo | バランス | バランス | バランス | バランス | 中 | 最高 |

実際の数値は Supabase `macro_lane_weights` テーブルの最新行を参照（毎日 18:30 UTC に更新）。

### 更新ロジック

Vercel cron → `/api/cron/relearn-lane-weights` → Sonnet 4.6 が以下を参照して推定:
- `macro_index_log`（月次マクロ指数の実績）
- `papers_log`（論文数トレンド）
- `ventures`（9社の outcome_pattern × 設立時期）

---

## XRL フレームワーク（AMD の SU 評価軸）

内閣府 SIP 第3期の XRL 体系を AMD が採用。

| 指標 | 意味 | 満点 |
|---|---|---|
| TRL | Technology Readiness Level（技術成熟度） | 9 |
| BRL | Business Readiness Level（事業化成熟度） | 9 |
| HRL | Human Readiness Level（市場・受容成熟度） | 9 |
| GRL | Governance Readiness Level（規制・ガバナンス） | 9 |
| SRL | Society Readiness Level（社会受容） | 9 |

現在 AMD OS が主に使うのは **TRL / BRL / HRL** の3軸。

### 過去 SU のボトルネック実績

| SU | アウトカム | ボトルネック | 教訓 |
|---|---|---|---|
| ティエムファクトリ | burnout | HRL2 | 市場形成が致命的に低かった。TRL5 まで行っても HRL2 では資金切れ |
| Yellow Duck | ue_fail | BRL2 | PoC 達成も事業化構造が固まらなかった。UE 不成立 |
| JOYCLE | deep_pivot | BRL3 | 技術の deep 化は成功したが BRL の出口（産廃契約）未完で終了 |

---

## データパイプライン

```
外部データ取得
  OpenAlex API  ──→  papers_log（年次・5レーン・2010-2026）
  Atlas シグナル ──→  atlas_signals ──→  macro_index_log（月次・2026-01〜）
  Sonnet 推定   ──→  macro_index_log（月次・2010-2025、週次 cron で更新）

モデル学習
  macro_index_log + papers_log + ventures
  ──→  Sonnet 4.6  ──→  macro_lane_weights（α/β/γ/δ/λ/η）

フロントエンド
  Supabase  ──→  Server Component  ──→  VentureMapView（View A/B/C）
                                  ──→  SuDetailView（XRL × マクロ重ね）
```

### Supabase テーブル一覧

| テーブル | 内容 | 更新頻度 |
|---|---|---|
| `ventures` | 9社の基本情報・outcome_pattern | 手動 |
| `ventures_xrl_log` | 各社の TRL/BRL/HRL 時系列 | 手動（推定値） |
| `macro_index_log` | レーン別月次マクロ指数 | cron（日次 / 週次） |
| `macro_lane_weights` | α/β/γ/δ/λ/η の最新推定値 | cron（毎日 18:30 UTC） |
| `papers_log` | レーン別年次論文数 | cron（年1回程度） |
| `seeds` | 予兆シーズ在庫 | 手動 |

---

## 未解決の論点（次セッション向け）

1. **$D'$ 極大 = 最適投入点 か？**  
   論文の加速度とマクロの加速度の差が最大になる点が「次の波の入口」という仮説。ただし「まだ早すぎる可能性」「極大より少し後に投入すべきでは」は未検討。

2. **$\sigma_{\mathrm{SU}}$ の積分窓 $\Delta t$ の最適化**  
   現在 6ヶ月固定。レーンによって波の周期が異なる（エネルギー政策は5年サイクル、規制は2年サイクル等）ため、$\Delta t$ もレーン依存にすべきか。

3. **$C_i(t)$ 競合密度の定量化**  
   現在 0 扱い。J-Startup や IPA などのオープンデータから「同領域のスタートアップ数の時系列」を取れれば $C_i$ を実数値にできる。

4. **XRL の $\kappa$ チューニング**  
   $S_i^{\kappa}$ のシーズ成熟度項。現在 $\kappa = 0.7$ の固定値。ティエムの失敗（TRL3 で設立）を考えると TRL に下限閾値を設けるルールの方が単純で有効かもしれない。

5. **$B_i(t)$ 予算データの投入**  
   NEDO / AMED の公募予算額は e-Gov や JST の公開データから取れる可能性がある。$\beta$ が突出して高い life レーンで効果が大きい。

---

## グローバル定数（現時点固定値）

| 定数 | 値 | 意味 |
|---|---|---|
| $\tau$ | 24ヶ月 | 政策の過去参照窓 |
| $\kappa$ | 0.7 | シーズ成熟度の指数 |
| $\mu$ | 0.15 | マクロ加速度ボーナスの重み |
| $\Delta t$ | 6ヶ月 | $\sigma_{\mathrm{SU}}$ の統合窓 |

---

## 関連ファイル

| ファイル | 内容 |
|---|---|
| `pwa/src/components/venture-map/VentureMapView.tsx` | フロントエンド（View A/B/C） |
| `pwa/src/components/venture-map/SuDetailView.tsx` | SU 個別ビュー（XRL × マクロ） |
| `pwa/src/lib/venture-map-data.ts` | Supabase アクセス層 |
| `pwa/src/app/api/cron/relearn-lane-weights/route.ts` | α/β/γ/δ/λ/η 再学習 cron |
| `pwa/src/app/api/cron/macro-backfill-historical/route.ts` | 2010-2025 推定 cron |
| `pwa/scripts/migrations/006_venture_map.sql` | テーブル DDL |
| `pwa/scripts/migrations/006_venture_map_seeds.sql` | 9社 + 初期重み シード |
| `pwa/scripts/migrations/007_ventures_xrl_log_seeds.sql` | XRL 時系列シード |
| `pwa/design_log/2026-05_su_knowledge_tiem_jc.md` | ティエム・JC 詳細背景 |
| `pwa/design_log/2026-05_venture_map_theory_strategy.pptx` | v0.1→v0.2 改訂プロセスの図解 |

---

## v0.2 改訂版 — 批判 18 点を反映 (2026-05-04)

### 背景

v0.1（式①〜④）を AMD メンバーへの共有・学術発表を見越して精査した結果、**18 点の批判**が浮上。
線形結合の前提崩壊、単位不整合（致命）、二階微分のノイズ問題、リスク項の欠如などを含む。

### 決定

**18 点 すべて採用** し、v0.2 改訂版に反映する。各式の改訂後形を以下に正本として記録する。

### 批判の全体像（18 点）

#### 式①（マクロトレンド指数）
- **1.1** P→B→V→R の因果連鎖がある中で線形結合する前提が崩れている → **各項に独立ラグ・独立減衰率**
- **1.2** 政策のみ過去履歴の不整合 → **B/V/R も指数減衰積分に統一**
- **1.3** 閾値・飽和効果が抜けている → **シグモイド σ で包む**
- **1.4** レーン間波及が抜けている → **主要ペアに相互作用項 $\omega_{ij}$**

#### 式②（事業化適温度→事業化期待値）
- **2.1** $S_i$ が時定数で時間変化しない → **$S_i(t)$ を時間関数化**（累積論文数の S 字フィット等）
- **2.2** 各項の単位・レンジが不明確 → **全項を $[0, 1]$ に正規化を明記**
- **2.3** 競合密度 $\eta$ の意味づけが弱い → **同質競合度 $d_i \in [0, 1]$ を分離して導入**
- **2.4** 「適温度」メタファーが曖昧 → **$\mathbb{E}[\mathrm{launch}]$（事業化期待値）に概念再定義**

#### 式③（論文-政策乖離）
- **3.1** 単位不整合（致命的）→ **対数微分（相対成長率）で単位を揃える**
- **3.2** 二階微分のノイズが爆発する → **カーネルスムージング後に微分**（$\tilde{N}, \tilde{M}$）
- **3.3** 論文先行の判定材料が弱い → **論文質 $q_i(t)$（Top-10% 引用比率）と政策コミット強度 $c_i(t)$（法律 > 戦略 > 提言）で加重**
- **3.4** $D'$ 極大 = 最適投入点ではない → **$D'$ 極大は先行指標、$\sigma_{\mathrm{SU}}$ 最大点が実行点**（時間順序: $D'$ 極大 → $\ddot{M}$ 単独極大 → $\sigma_{\mathrm{SU}}$ 最大）

#### 式④（投入シグナル σ_SU）
- **4.1** 二項の単位が違うまま足し算 → **$\ddot{M}$ を典型値 $\ddot{M}^*$ で正規化**
- **4.2** $\Delta t$ 6ヶ月固定はレーンに不適 → **$\Delta t_i$ をレーン依存に**（規制 6 ヶ月、エネルギー 1 年など波長スケール）
- **4.3** $D'$ がシグナルに入っていない → **3 軸（$\langle T \rangle$, $\ddot{M}$, $D'$）を独立に重ね合わせ**
- **4.4** リスク項が抜けている → **平均-分散最適化（$-\rho \cdot \mathrm{Var}[T]$）で AMD のリスク許容度を反映**

#### 全体構造
- **5.1** フィードバックがない（フィードフォワード一直線）→ **動的システム ODE 化**（中長期）
- **5.2** 「Sonnet 推定」のままでは学術的に弱い → **Bayesian system identification 化**（事前分布構成 + 観測尤度 + 事後分布）

---

### 改訂後の数式 v0.2

#### 数式①' — 改訂版マクロトレンド指数

$$
M_i(t) \;=\; \sigma\!\left( \sum_{X \in \{P, B, V, R\}} \int_{t-\tau}^{t} w_i^{X}\, X_i(s)\, e^{-\lambda_i^{X}(t-s)}\, ds \;+\; \sum_{j \neq i} \omega_{ij}\, M_j(t - \tau_{ij}) \right)
$$

- $\sigma$: シグモイド関数（閾値・飽和効果）
- $X \in \{P, B, V, R\}$: 政策・予算・VC・言及をすべて減衰積分で扱う
- $w_i^X$: 変数別重み（$\sum w = 1$ 制約）
- $\lambda_i^X$: 変数別減衰率（B 系列は長め、R 系列は短め）
- $\omega_{ij}$: レーン $j$ → レーン $i$ への波及重み（疎行列）
- $\tau_{ij}$: レーン間ラグ

#### 数式②' — 改訂版 事業化期待値

$$
\mathbb{E}[\mathrm{launch}_i](t) \;=\; M_i(t) \,\cdot\, S_i(t)^{\kappa} \,\cdot\, \bigl(1 - d_i\, C_i(t)\bigr)^{\eta_i}
$$

- $M_i, S_i, C_i \in [0, 1]$ に正規化
- $S_i(t)$: 時間関数（累積論文数のロジスティックフィット等）
- $d_i \in [0, 1]$: 同質競合度（1 は完全代替）
- $\eta_i$: 競合密度の効き方
- 概念定義は「適温度」から「事業化期待値（$\mathbb{E}[\mathrm{launch}]$）」へ変更

#### 数式③' — 改訂版 論文-政策乖離

$$
D_i(t) \;=\; q_i(t)\, \frac{d \log \tilde{N}_i}{dt} \;-\; c_i(t)\, \frac{d \log \tilde{M}_i}{dt}
$$

- $\tilde{N}_i, \tilde{M}_i$: カーネルスムージング後の信号
- 対数微分により両項とも年率の無次元成長率（単位整合）
- $q_i(t) \in [0, 1]$: 論文の質（Top-10% 引用比率）
- $c_i(t) \in [0, 1]$: 政策コミット強度（法律 > 戦略 > 提言）
- $D'_i(t)$ は先行指標として運用、投入実行点は $\sigma_{\mathrm{SU}, i}$ 最大点

#### 数式④' — 改訂版 投入シグナル

$$
\sigma_{\mathrm{SU},\, i}(t_0) \;=\; \langle T_i \rangle_{\Delta t_i} \;+\; \mu_M \frac{\ddot{M}_i|_{t_0}}{\ddot{M}^{*}_i} \;+\; \mu_D \frac{D'_i|_{t_0}}{{D'_i}^{*}} \;-\; \rho \cdot \mathrm{Var}[T_i]_{\Delta t_i}
$$

- $\Delta t_i$: レーン依存統合窓
- $\ddot{M}^*_i, {D'_i}^*$: 各レーンの典型加速度・典型乖離値（正規化用）
- $\mu_M, \mu_D$: 加速度ボーナス・乖離ボーナスの重み
- $\rho$: AMD のリスク許容度（平均-分散最適化）

---

### 影響範囲

- **`pwa/src/app/api/cron/relearn-lane-weights/route.ts`** — 推定対象パラメータの拡張（$w_i^X$, $\lambda_i^X$, $\omega_{ij}$, $d_i$, $q_i$, $c_i$, $\Delta t_i$, $\ddot{M}^*_i$, $\rho$ 等）。事前分布の構成を Bayesian 枠組みで再設計。
- **`macro_lane_weights` テーブル** — カラム拡張（変数別の重み・減衰率を保持）。schema migration 必要。
- **`papers_log` テーブル** — 引用数・Top 引用比率カラム追加（$q_i$ 算出のため）。
- **AMD OS View（A/B/C）** — $D, D'$ の表示を対数微分ベース・スムージング適用版に切り替え。
- **`amd_os_vision.md`** — モデル定義が v0.2 に更新されたことを反映するか検討。
- **本ファイル** — 「マクロトレンド・タイミング論」の正本ドキュメントとして v0.2 でモデル定義が正式に置き換わる（v0.1 のセクションは履歴として残置）。

### 次アクション（優先度順）

1. **★★★ 単位整合修正**（3.1, 1.2, 4.1）を最優先で `relearn-lane-weights` cron に反映
2. **★★ パラメータ拡張**に伴う `macro_lane_weights` schema migration（migration 008）
3. **★★ スムージング層**（3.2）を `papers_log` 取得時の前処理に挿入
4. **★ リスク項 $\rho$** の運用値を 9 社 retrofit から推定
5. **★ Bayesian 推定枠組み**（5.2）への書き換え（学会発表前に必須）
6. v0.2 ベースで **NIMS 試験導入**（2026 Q2）のテストケース構築

### 参照

- **v0.2 の図解とプロセス記録**: `pwa/design_log/2026-05_venture_map_theory_strategy.pptx` Slide 7-11
- **批判 18 点の詳細解説 (メンバー向け)**: `pwa/design_log/2026-05_venture_map_v01_critique_explained.md` — 数学に詳しくないメンバーでも理解できるよう、各批判の問題点・修正方針・対応理由を丁寧に解説
- **議論ログ**: えいみ × まさ チャット（2026-05-03 〜 04）

---

## Changelog

| 日付 | 変更 | 理由 | 担当 |
|---|---|---|---|
| 2026-05-03 | 初版作成（v0.1 数式①〜④定義） | AMD venture map 数理モデル正本化 | まさ |
| 2026-05-04 | v0.2 改訂セクション追加（18 点採用） | 線形結合・単位整合・リスク項などの根本改訂 | えいみ |
