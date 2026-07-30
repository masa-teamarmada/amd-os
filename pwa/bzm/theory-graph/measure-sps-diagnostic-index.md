---
id: measure-sps-diagnostic-index
title: "SPSは案件の診断指数であり、それ単独でGO/NO_GO/投資額/人月を決めない"
kind: measure
layer: evidence
status: established
summary: "現行SPSは9軸の観察値を現行の符号化・重み・乗法集約規則によって束ねた診断指数である。SPS単独でGO、NO_GO、投資額、投入人月は決めない。ECRも機関成果の予測値や機関間ランキングとしては扱わない。"
source_ref: "BZM_2_0_REVISION_REQUIREMENTS.md#2-現行bzmの主張境界"
relations:
  - type: depends_on
    target: concept-sps-ordinal-scale
---

## 内容

2026-07-29時点の現行SPSは、9軸の観察値を現行の符号化、重み、乗法集約規則によって束ねた診断指数である。したがってSPSは単独でGO、NO_GO、投資額、投入人月を決めない。現行ECRも、機関成果の予測値または機関間ランキングとしては扱わない。

$$\mathrm{SPS} = K \cdot \prod_{i=1}^{9} (X_i+1)^{\alpha_i}$$

乗法集約は、技術・顧客・制度・人のどれか一つが弱ければ全体を抑える律速構造を表すために採用された設計上の仮定である。ECRの加重和とは異なる演算だが、その違いが対象の現実的な性質を正確に写像していることや、乗法が他の集約規則より高い予測・判断性能を持つことは未検証である。
