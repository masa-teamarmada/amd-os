---
id: question-portfolio-allocation-method-unknown
title: "ポートフォリオ資源配分方式は未確定(unknown)"
kind: question
layer: portfolio
status: unknown
summary: "SPS順位に従う資源配分が他の配分方法より高い成果を生むかは未検証であり、競合リスク・因果推論・状態空間・ポートフォリオ最適化を含む配分方式はデータ基盤(必要な事象数と独立評価)が整うまで導入しない。ポートフォリオ層の出力(予算・人月・相関・共通資産・撤退価値・公的目的)自体は六層構造に定義済みだが、配分アルゴリズムはunknownの状態にある。"
source_ref: "BZM_2_0_REVISION_REQUIREMENTS.md#2-現行bzmの主張境界; BZM_2_0_REVISION_REQUIREMENTS.md#データ蓄積後"
relations:
  - type: depends_on
    target: concept-ecr-three-layers
  - type: depends_on
    target: concept-prospective-case-registration
---

## 内容

現行SPSについて、「SPS順位に従う資源配分が、他の配分方法より高い成果を生む」という主張はまだ検証されていない。

競合リスク、因果推論、状態空間、ポートフォリオ最適化は、必要な事象数と独立評価が得られた後に導入する。データ基盤より先に数理を複雑化しない。

六層構造のポートフォリオ層は、予算、人月、相関、共通資産、撤退価値、公的目的という出力の形は定義されているが、その配分アルゴリズムや最適化手法は、前向き案件登録とAMD介入ログの蓄積後にはじめて設計対象になる。現時点では`unknown`として扱い、`not_started`(まだ着手していない)と区別する。
