---
id: decision-wait-return-conditions
title: "WAITに復帰条件・再判定日・責任者・待機中作業を持たせる"
kind: decision
layer: decision
status: design-choice
summary: "GO・WAIT・NO_GO・HOLDを分け、WAITには復帰条件、再判定日、責任者、待機中作業を持たせる。これはBZM 1.xから2.0へ継承する維持要素であり、閾値が校正できていない目的別GOゲートの受け皿になる。"
source_ref: "BZM_2_0_REVISION_REQUIREMENTS.md#3-維持する理論要素; BZM_2_0_REVISION_REQUIREMENTS.md#44-goを目的別ゲートへ変更する"
relations:
  - type: supports
    target: decision-purpose-specific-go-gates
  - type: depends_on
    target: concept-time-fixed-validation-record
---

## 内容

BZM 1.xから2.0へ継承する維持要素のうち、次の2点が本決定の根拠になる。

- `GO`、`WAIT`、`NO_GO`、`HOLD`を分ける。
- WAITに復帰条件、再判定日、責任者、待機中作業を持たせる。

閾値を校正できていない間は、二値のGOではなく`条件付きGO`とWAITを使う。WAITは単なる保留ではなく、復帰条件・再判定日・責任者・待機中作業という4要素を持つことで、判断を介入政策として運用可能にする。判断後の介入・担当・工数・費用・観測期間は、検証用履歴として時点固定で記録する。
