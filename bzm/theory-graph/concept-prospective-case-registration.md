---
id: concept-prospective-case-registration
title: "前向き検証(全案件の連続登録と事前固定)"
kind: concept
layer: evidence
status: design-choice
summary: "全スクリーニング案件を連続登録し、採択・不採択・記録不足・WAIT・NO_GOを分母から落とさない。モデル版、採点規約、重み、欠測処理、アウトカム、観測期間を事前に固定し、結果を知らない独立した二名以上が判定時点までの資料だけで採点する。"
source_ref: "BZM_2_0_REVISION_REQUIREMENTS.md#81-登録と時点固定; BZM_2_0_REVISION_REQUIREMENTS.md#82-採点信頼性"
relations:
  - type: operationalizes
    target: concept-time-fixed-validation-record
  - type: tests
    target: decision-purpose-specific-go-gates
---

## 内容

全スクリーニング案件を連続登録する。採択、不採択、記録不足、WAIT、NO_GOを分母から落とさない。モデル版、採点規約、重み、欠測処理、アウトカム、観測期間を事前に固定する。

結果を知らない独立した二名以上が、判定時点までの資料だけで採点する。軸ごとの一致率を報告し、協議後の点数だけを残さない。

現行SPSは、基礎発生率、TRL単独、専門家判断、単純加法、readinessの最小値と比較し、校正曲線、基礎発生率に対するBrier Skill Score、log-loss、順位安定性、意思決定純便益を分けて報告する。理論と証拠を結び付ける起業家教育の無作為化比較試験(Camuffo et al.)は、理論を捨てるのではなく検証可能な仮説と観察へ接続する方向を支持しており、この前向き検証設計を支える先行研究になる。

90日の実行順では、独立再採点の実施、前向き案件登録の開始、AMD介入ログの開始が挙げられている。データ蓄積後、競合リスク・因果推論・状態空間・ポートフォリオ最適化は必要な事象数と独立評価が得られてから導入する。
