---
id: decision-purpose-specific-go-gates
title: "GOを目的別ゲートへ変更する"
kind: decision
layer: decision
status: design-choice
summary: "現行のマクロ追い風と有効TRLだけでは会社化または資源投入の十分条件にならない。GOは用途ごとに必要な条件(再現性・有償需要・知財・利益相反・決定権・経営機能・資金経路・選択肢の得失)を明示するゲートへ変更する。閾値を校正できていない間は二値のGOではなく条件付きGOとWAITを使う。"
source_ref: "BZM_2_0_REVISION_REQUIREMENTS.md#44-goを目的別ゲートへ変更する"
relations:
  - type: operationalizes
    target: concept-measurement-separation-principle
  - type: depends_on
    target: decision-wait-return-conditions
---

## 内容

現行のマクロ追い風と有効TRLだけでは、会社化または資源投入の十分条件にならない。GOは、用途ごとに必要な条件を明示する。最低限のゲート候補は次のとおりである。

1. 技術再現性と統合可能性。
2. 有償需要または予算保有者の拘束力ある行動。
3. 知財帰属、ライセンス見通し、FTO、秘密情報管理。
4. 兼業、利益相反、規制、輸出管理。
5. 提案権、同意権、拒否権、署名権。
6. 経営機能の責任者と研究者時間。
7. 月別の資金経路と次の資金条件。
8. 会社化によって得る選択肢と失う選択肢。

閾値を校正できていない間は、二値のGOではなく`条件付きGO`とWAITを使う。NISTのTRL検討報告が指摘するとおり、TRLは主観性を持ち適用先と評価者によって変わるため、TRL単独をGOの十分条件にしない。
