# FRL CES 実装仕様

> **この章は何か**: AMD Score の FRL (= Founder Readiness Level) を、資質 `F_character` と経営実行力 `F_capability` の 2 レイヤーで扱う現行実装仕様。理論導出は `/bzm/4-1-frl-founder-readiness`、画面の読み方は `/manual/4-4-frl-related-members-score-spec` に置く。

## 現行仕様

FRL は AMD Score の PRS primary では **S (Survival)** を構成する創業者・経営チーム readiness。legacy 7 軸 / M-X-F comparison では F 軸として残る。2026-05-30 #101 で、旧 6 因子 FRL を次の 2 レイヤーへ分けた。

| レイヤー | DB / 実装 | 意味 |
|---|---|---|
| `F_character` | `amd_score_inputs.frl` | CEO 資質。ALQ 4 次元 + Grit + Resilience。委譲不可 |
| `F_capability` | `amd_score_inputs.frl_cap` | 経営実行力。経験 ≫ 知識。COO/CFO/AMD で補完可 |
| AMD 寄与 | `amd_score_inputs.frl_cap_amd` | AMD メンバーが押し上げた経営実行力。AMD 提供価値の定量化用 |

最終 FRL は CES で合成する。

```text
FRL + 1 = [ a(F_character + 1)^rho + (1-a)(F_capability + 1)^rho ]^(1/rho)
初期値: a = 0.6, rho = -2
```

- `rho < 0` なので、片方が低いと最終 FRL が低い側へ引っ張られる。
- `frl_cap` が `NULL` の場合は後方互換として `frl` をそのまま最終 FRL にする。
- `rho` が 0 に極めて近い場合は Cobb-Douglas 極限へ fallback する。

## 実装ファイル

| ファイル | 契約 |
|---|---|
| `pwa/src/lib/amd-score.ts` | `computeFrlCES()`、`FRL_CES_A_DEFAULT=0.6`、`FRL_CES_RHO_DEFAULT=-2` |
| `pwa/src/lib/amd-score-derived.ts` | `resolveFrl()`。全 `calculateAmdScore` 呼び出し元はここ経由で最終 FRL を作る |
| `pwa/src/lib/amd-score-data.ts` | `frl_cap`, `frl_cap_amd`, `frl_cap_notes`, `frl_ces_a`, `frl_ces_rho` を row / payload / select に配線 |
| `pwa/design/db_schema.md` | `amd_score_inputs` の列正本。列を書く前に必ずここを確認する |

## DB 契約

`amd_score_inputs` の FRL 2 レイヤー化で使う列は本番 DB に存在する。

| column | type | nullable | 用途 |
|---|---|---|---|
| `frl` | `float4` | yes | `F_character`。旧 FRL 値を後方互換で保持 |
| `frl_cap` | `float4` | yes | `F_capability`。経営実行力 0-9 |
| `frl_cap_amd` | `float4` | yes | AMD メンバー寄与分 |
| `frl_cap_notes` | `text` | yes | `F_capability` の根拠 |
| `frl_ces_a` | `float4` | yes | CES の資質側重み。NULL なら 0.6 |
| `frl_ces_rho` | `float4` | yes | CES の rho。NULL なら -2 |

## 運用境界

- 理論・数式導出・例題は `/bzm/4-1-frl-founder-readiness` に置く。
- 画面での読み方、関連メンバー/HRL の説明、トラブル時の確認手順は `/manual/4-4-frl-related-members-score-spec` に置く。
- 実装仕様・DB列・関数契約はこの章を正本にする。
- `frl_cap_amd` は AMD 提供価値を示す重要指標。migration 111 で active/current 4 PJ (CTB/LST/CX/SX) は first pass backfill 済み。
- 終了済み / historical PJ は current `project_founding_members.status='active'` だけでは当時の AMD 寄与を表せないため、timeline-specific row で別途整理する。

## 検証観点

- `frl_cap = NULL` の既存行で、最終 FRL が `frl` と一致する。
- `frl=4, frl_cap=2, a=0.6, rho=-2` のように経営実行力が低い行で、最終 FRL が `frl` より下がる。
- `AmdScoreList`、`AmdScoreRetrofit`、`CyberspaceView` など AMD Score を再計算する箇所が `resolveFrl()` を使う。
- `amd_score_inputs` の列名は `pwa/design/db_schema.md` と一致する。
