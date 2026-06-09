# AMD Score 実装仕様

> **この章は何か**: AMD Score の PWA 実装、DB、route、計算境界の確定仕様。理論導出は `/bzm`、詳細履歴は `pwa/design/amd_score.md` にも残す。

## 定義

AMD Score の現行 primary model は PRS (`P x R x S`)。2026-06-06 の PRS primary 化以降、PWA の主表示は PRS を前面に出し、旧 7 軸 Cobb-Douglas / M-X-F は legacy AMD comparison と evidence chain として残す。

```text
AMD Score primary = K_prs * P * R * S
R = product((X_i + 1) ^ alpha_i), X = {TRL, BRL, GRL, SRL, HRL}
S = (sigma_SU + 1) ^ alpha_sigma * (FRL + 1) ^ alpha_F * (R_net + 1) ^ alpha_R_net
P = Potential
```

P/R_net が未入力の場合、PRS は `status='missing'` / review pending として score を出さない。legacy AMD score を primary に戻して欠損を隠さない。

## Legacy AMD / M-X-F の位置づけ

旧モデルは Before Zero Theory v3.2 の 7 軸 Cobb-Douglas 統合指標。現行 primary ではなく、比較・履歴・根拠表示用に保持する。

```text
AMD Score = K * product((X_i + 1) ^ alpha_i)
X = {sigma_SU, TRL, BRL, GRL, SRL, HRL, FRL}
K = 100000 / 10 ^ sum(alpha)
```

Shallow Tech mode では legacy AMD / PRS reach の TRL 軸を除外し、K を再校正する。

## Legacy 3 要素表示

legacy AMD / M-X-F では 7 軸を次の 3 要素で見せる。これは現行 primary score ではなく、PRS の R/S の根拠と比較用ブロックとして読む。

| 要素 | 意味 |
|---|---|
| M | Macrotrend / Triple Helix。`sigma_SU` |
| X | 会社に帰属する XRL。TRL / BRL / GRL / SRL / HRL |
| F | Founder / 経営チーム readiness。FRL |

FRL は XRL に飲み込まない。AMD Studio の哲学上、FRL と `sigma_SU` は独立した重要軸として扱う。

## 実装ファイル

| file | 契約 |
|---|---|
| `pwa/src/lib/amd-score.ts` | legacy AMD 計算、PRS 計算、alpha default、K、bottleneck、FRL CES |
| `pwa/src/lib/amd-score-derived.ts` | DB row から PRS primary snapshot / legacy comparison / history series を作る |
| `pwa/src/lib/amd-score-data.ts` | `amd_score_inputs` / `amd_score_alpha` data access |
| `pwa/src/components/venture-map/AmdScoreView.tsx` | 個別 PJ 詳細。PRS Primary を先頭に出し、legacy AMD / M-X-F を comparison として残す |
| `pwa/src/components/venture-map/AmdScoreList.tsx` | 一覧。主表示は PRS primary |
| `pwa/src/components/cockpit/*AmdScore*` | cockpit PRS primary chip / score detail / legacy comparison |

## DB 契約

| table | 用途 |
|---|---|
| `amd_score_inputs` | project_id + evaluated_at ごとの PRS input (`prs_potential`, `prs_r_net`) と legacy 7 軸入力、notes、FRL cap |
| `amd_score_alpha` | alpha weights の version 管理 |
| `amd_score_revisions` | 軸値の修正依頼履歴 |
| `project_xrl_log` | XRL 時系列評価ログ |
| `project_xrl_evidence` | L2⑧ XRL 根拠 |

`amd_score_inputs` の列名を書く前に `pwa/design/db_schema.md` を確認する。

## FRL 境界

FRL の 2 レイヤー CES 実装仕様は `/spec/4-1-frl-ces-current-spec` を正本にする。

- `frl` = F_character
- `frl_cap` = F_capability
- `frl_cap_amd` = AMD 寄与
- `resolveFrl()` 経由で最終 FRL を作る

## Bottleneck

律速軸は寄与度の小ささではなく、限界感度で見る。

```text
dS/dX_i = alpha_i * S / (X_i + 1)
bottleneck = argmax alpha_i / (X_i + 1)
```

`argmin(contribution share)` に戻さない。

## Route / UI

| route | 役割 |
|---|---|
| `/venture-map/amd-score` | 全 SU PJ の PRS primary 一覧。legacy AMD は comparison |
| `/venture-map/amd-score/[projectId]` | PRS primary 入力 / PRS history / legacy M-X-F / FRL / XRL evidence |
| `/venture-map/amd-score/retrofit` | PRS review queue + legacy alpha 重み調整 |
| `/project/[projectId]/cockpit` | PRS primary chip / score detail tab / legacy AMD comparison |

## PRS primary

PRS (`P x R x S`) は現行 primary model。legacy 7軸 AMD Score / M-X-F は comparison と evidence 用に保持する。

| 要素 | 実装上の扱い |
|---|---|
| `P` | Potential / 潜在規模。`amd_score_inputs.prs_potential` に nullable で保存 |
| `R` | Reach / Readiness。TRL / BRL / GRL / SRL / HRL の contribution product |
| `S` | Survival。`sigma_SU` / FRL / `R_net` の contribution product |
| `R_net` | 収益化指数。粗利 - 運営コスト - 本命から奪うリソース毀損。`amd_score_inputs.prs_r_net` に nullable で保存 |

実装ファイル:

| file | 契約 |
|---|---|
| `pwa/src/lib/amd-score.ts` | `PRS_ALPHA_DEFAULT` / `calculatePrsScore()`。P/R_net missing 時は score を返さず `status='missing'` |
| `pwa/src/lib/amd-score-derived.ts` | `resolvePrsInputs()` / `derivePrsComponents()` / `buildPrimaryScoreSnapshot()` / `computePrsScoreSeries()`。stored P/R_net を優先し、過去 row は最新 reviewed project-level PRS input から back-calculate する |
| `pwa/src/components/venture-map/AmdScoreView.tsx` | detail 上で P / R_net を保存し、PRS を primary、legacy AMD を comparison として表示する |
| `pwa/src/components/venture-map/AmdScoreRetrofit.tsx` | PRS review queue。missing PJ の棚卸しと legacy α 比較 |

禁止事項:

- P/R_net missing を 0 扱いして primary score を偽装すること
- PRS missing 時に legacy AMD を primary として見せること
- legacy M-X-F / 7軸を primary へ戻すこと
- 既存7軸の履歴を破壊的に再計算すること

P/R_net rubric の厳密化と全 PJ の埋め切りは継続レビュー対象だが、UI 上の primary model は PRS とする。

## 変更ゲート

- 計算式・alpha・FRL・bottleneck を変えたら `/spec` と `pwa/design/amd_score.md` の両方を更新する。
- DB列追加は migration + `pwa/design/db_schema.md` 再生成を同じ作業単位に含める。
- UI 導線を消す前に `pwa/design/FEATURE_REGISTRY.md` と critical UI test を確認する。

## Appendix: legacy MXF / 7軸モデル

このセクションは過去モデルの保存場所。legacy MXF (= M-X-F / 7軸 Cobb-Douglas) は、現行 primary ではない。

保持する理由:

- PRS の R/S の根拠として、TRL/BRL/GRL/SRL/HRL、sigma_SU、FRL の evidence chain が必要。
- 2026-05 以前の score history / retrofit / alpha review を読み解く比較対象になる。
- score-detail で sigma / Triple Helix matrix、FRL、XRL checklist を消すと PRS の根拠も失われる。

読ませ方:

- UI 文言は `Legacy AMD comparison` / `legacy M-X-F` / `comparison only` とする。
- 主表示・章 summary・操作導線では `PRS Primary` を先に置く。
- legacy 値しかない場合も PRS を missing / review pending として止め、legacy 値を primary に昇格しない。
