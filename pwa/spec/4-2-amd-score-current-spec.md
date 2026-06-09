# AMD Score 実装仕様

> **この章は何か**: AMD Score の PWA 実装、DB、route、計算境界の確定仕様。理論導出は `/bzm`、詳細履歴は `pwa/design/amd_score.md` にも残す。

## 定義

AMD Score の現行 primary model は PRS (`P x R x S`)。PWA の主表示は PRS を前面に出し、旧 7 軸 Cobb-Douglas / M-X-F は legacy AMD comparison と evidence chain として残す。

```text
AMD Score primary = K_prs * P * R * S
R = product((X_i + 1) ^ alpha_i), X = {TRL, BRL, GRL, SRL, HRL}
S = (sigma_SU + 1)^alpha_sigma * (FRL + 1)^alpha_F * (R_net + 1)^alpha_R_net
P = Potential
```

`P` / `R_net` が未入力の場合は `status='missing'` / review pending とし、0点に丸めたり legacy AMD を primary として代替表示したりしない。

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
| `/venture-map/amd-score` | 全 SU PJ の PRS primary 一覧。legacy AMD は comparison 列 |
| `/venture-map/amd-score/[projectId]` | PRS primary 入力 / PRS history / legacy M-X-F / FRL panel |
| `/venture-map/amd-score/retrofit` | PRS review queue + legacy alpha 調整 |
| `/project/[projectId]/cockpit` | PRS primary status chip / legacy AMD comparison |

## PRS primary

PRS (`P x R x S`) を主表示へ切り替えた。legacy 7軸 AMD Score / M×X×F は comparison と evidence 用に保持する。

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
| `pwa/src/lib/amd-score-derived.ts` | `derivePrsComponents()` / `buildPrimaryScoreSnapshot()`。stored P/R_net を優先し、主表示と legacy comparison を同じ row から作る |
| `pwa/src/components/venture-map/AmdScoreView.tsx` | detail 上で P / R_net を保存し、PRS を primary、legacy AMD を comparison として表示 |
| `pwa/src/components/venture-map/AmdScoreRetrofit.tsx` | PRS review queue。missing PJ の棚卸しと legacy α 比較 |

禁止事項:

- P/R_net missing を 0 扱いして primary score を偽装すること
- PRS missing 時に legacy AMD を primary として見せること
- 既存7軸の履歴再計算

P/R_net rubric の厳密化と全 PJ の埋め切りは継続レビュー対象だが、UI 上の primary model は PRS とする。

legacy 値しかない PJ でも、primary を legacy AMD へ戻さない。画面上は PRS review pending とし、legacy は `Legacy AMD comparison` / `legacy M-X-F` / `comparison only` の文脈で表示する。

## Appendix: legacy MXF / 7軸モデル

このセクションは過去モデルの保存場所。legacy MXF (= M-X-F / 7軸 Cobb-Douglas) は、現行 primary ではない。

```text
Legacy AMD Score = K * product((X_i + 1) ^ alpha_i)
X = {sigma_SU, TRL, BRL, GRL, SRL, HRL, FRL}
K = 100000 / 10 ^ sum(alpha)
```

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
