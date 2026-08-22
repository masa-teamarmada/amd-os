---
id: concept-phi-gh-counterexample
title: "反例関数 Φ(g,h)=gh"
kind: concept
layer: cross-layer
status: established
summary: "Φ(g,h)=ghは∂Φ/∂h=gを持ち、g=0の境界で機関感応度がゼロ、g>0の内部で正となる。これは旧・二層非可換性定理(Book A版)の公理A1〜A4を同時に満たす単調関数であり、旧定理の反例になる。"
source_ref: "BZM_2_0_REVISION_REQUIREMENTS.md#41-二層非可換性定理を撤回する; book-a-ch-12.md#113-機関は案件を救えるか"
relations:
  - type: refutes
    target: claim-old-two-layer-noncommutativity-theorem
---

## 内容

$$\Phi(g,h)=gh$$

$$\frac{\partial\Phi}{\partial h}=g$$

この関数では、$g=0$の境界で機関感応度がゼロとなり、$g>0$の内部で正となる。したがって、現行の公理と証明から不可能性は導けない。

ただし、$\Phi(g,h)=gh$はBook A版への反例であり、P1論文草稿が置く追加条件(案件段階による機関比較の反転、残り道程による案件比較の反転)を持つP1版を単独で反証するものではない。この区別により、旧定理の撤回とP1版の再検証要求は別の帰結として扱う。
