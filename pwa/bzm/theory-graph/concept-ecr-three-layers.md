---
id: concept-ecr-three-layers
title: "ECRを三つの測定層(自前ストック・実効サービス・流量成果)へ分ける"
kind: concept
layer: institution
status: design-choice
summary: "現行ECRは機関が自前で保有する制度と装置の診断として残しつつ、機関能力を自前ストック・実効サービス・流量成果の三層に分けて表示する。ECR表示にはcoverage、confidence、evidence freshness、評価者間一致を付け、機関間の単一順位は作らない。"
source_ref: "BZM_2_0_REVISION_REQUIREMENTS.md#51-ecrを三つの測定層へ分ける"
relations:
  - type: defines
    target: decision-amd-stakeholder-capacity-ledger
---

## 内容

現行ECRは、機関が自前で保有する制度と装置の診断として残す。機関能力は、次の三層を別々に表示する。

1. 自前ストック:規程、人員、予算、雛形、ファンド。
2. 実効サービス:外部連携を含む利用可能性、権限、費用、応答期限、継続条件。
3. 流量成果:処理時間、完了率、滞留、差戻し、事故、研究者負荷。

ECR表示には、値だけでなくcoverage、confidence、evidence freshness、評価者間一致を付ける。機関間の単一順位は作らない。

大学技術移転のパネル研究(Sallan & Lordan)は、TTO資源の保有だけでなく経験学習と開示経験を分けて調べており、自前ストックと運用成果を同一視しない考え方の参考になる。ただし、この研究はBZMの三層区分や各軸を直接検証したものではない。ECRは3機関・7スナップショットを持つが、同一時点の独立した複数評価者による採点はまだなく、成果妥当性は現時点で確認できていない。
