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
