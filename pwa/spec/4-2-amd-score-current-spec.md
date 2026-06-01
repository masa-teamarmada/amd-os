# AMD Score 実装仕様

> **この章は何か**: AMD Score の PWA 実装、DB、route、計算境界の確定仕様。理論導出は `/bzm`、詳細履歴は `pwa/design/amd_score.md` にも残す。

## 定義

AMD Score は Before Zero Theory v3.2 の 7 軸 Cobb-Douglas 統合指標。

```text
AMD Score = K * product((X_i + 1) ^ alpha_i)
X = {sigma_SU, TRL, BRL, GRL, SRL, HRL, FRL}
K = 100000 / 10 ^ sum(alpha)
```

Shallow Tech mode では TRL 軸を除外し、K を再校正する。

## 3 要素表示

UI では 7 軸を次の 3 要素で見せる。

| 要素 | 意味 |
|---|---|
| M | Macrotrend / Triple Helix。`sigma_SU` |
| X | 会社に帰属する XRL。TRL / BRL / GRL / SRL / HRL |
| F | Founder / 経営チーム readiness。FRL |

FRL は XRL に飲み込まない。AMD Studio の哲学上、FRL と `sigma_SU` は独立した重要軸として扱う。

## 実装ファイル

| file | 契約 |
|---|---|
| `pwa/src/lib/amd-score.ts` | score 計算、alpha default、K、bottleneck、FRL CES |
| `pwa/src/lib/amd-score-derived.ts` | DB row から表示/計算用の derived score を作る |
| `pwa/src/lib/amd-score-data.ts` | `amd_score_inputs` / `amd_score_alpha` data access |
| `pwa/src/components/venture-map/AmdScoreView.tsx` | 個別 PJ 詳細 |
| `pwa/src/components/venture-map/AmdScoreList.tsx` | 一覧 |
| `pwa/src/components/cockpit/*AmdScore*` | cockpit chip / breakdown modal |

## DB 契約

| table | 用途 |
|---|---|
| `amd_score_inputs` | project_id + evaluated_at ごとの 7 軸入力、notes、FRL cap |
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
| `/venture-map/amd-score` | 全 SU PJ の AMD Score 一覧 |
| `/venture-map/amd-score/[projectId]` | 個別 score / M-X-F / 経時 / FRL panel |
| `/venture-map/amd-score/retrofit` | alpha 重み調整 + retrofit。PRS候補の比較/シミュレーションも同じ画面に置く |
| `/project/[projectId]/cockpit` | AMD Score chip / breakdown modal |

## PRS候補 比較レイヤー

PRS (`P x R x S`) は、現行7軸AMD Scoreの正式置換ではない。2026-06-01時点では `/venture-map/amd-score/retrofit` 上の比較/シミュレーション層として扱う。

| 要素 | 実装上の扱い |
|---|---|
| `P` | Potential / 潜在規模。DB列は未採用。retrofit画面の保存しない仮入力でのみ試算する |
| `R` | Reach / Readiness。TRL / BRL / GRL / SRL / HRL の contribution product |
| `S` | Survival。`sigma_SU` / FRL / `R_net` の contribution product |
| `R_net` | 収益化指数。粗利 - 運営コスト - 本命から奪うリソース毀損。DB列は未採用 |

実装ファイル:

| file | 契約 |
|---|---|
| `pwa/src/lib/amd-score.ts` | `PRS_ALPHA_DEFAULT` / `calculatePrsScore()`。P/R_net missing 時は score を返さず `status='missing'` |
| `pwa/src/lib/amd-score-derived.ts` | `derivePrsComponents()`。`amd_score_inputs` row と保存しない仮P/R_netからPRS候補を作る |
| `pwa/src/components/venture-map/AmdScoreRetrofit.tsx` | 「PRS候補 比較レイヤー」。仮P/R_netをONにした時だけ全PJ共通の試算値を表に出す |

禁止事項:

- `calculateAmdScore()` の置換
- `amd_score_inputs` への `p` / `r_net` 列追加
- 既存7軸の履歴再計算
- PRS候補値の本番DB write

正式採用・DB schema化・P/R_net rubric確定・9PJ retrofit表の確定は BZM review required。

## 変更ゲート

- 計算式・alpha・FRL・bottleneck を変えたら `/spec` と `pwa/design/amd_score.md` の両方を更新する。
- DB列追加は migration + `pwa/design/db_schema.md` 再生成を同じ作業単位に含める。
- UI 導線を消す前に `pwa/design/FEATURE_REGISTRY.md` と critical UI test を確認する。
