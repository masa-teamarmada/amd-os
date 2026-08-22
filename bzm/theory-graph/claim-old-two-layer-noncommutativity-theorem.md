---
id: claim-old-two-layer-noncommutativity-theorem
title: "旧・二層非可換性定理(Book A版)"
kind: claim
layer: cross-layer
status: refuted
summary: "Book A第11章の旧証明は、境界で機関感応度がゼロ、内部で正になる単調な合成関数は存在しないと主張していたが、Φ(g,h)=ghが反例となるため、現行の公理と証明から不可能性は導けない。2026-07-29付でBOOK_DECISIONS.md D-062により撤回された。"
source_ref: "BOOK_DECISIONS.md#d-062; book-a-ch-12.md#113-機関は案件を救えるか"
relations:
  - type: depends_on
    target: measure-sps-diagnostic-index
  - type: depends_on
    target: concept-ecr-three-layers
---

## 内容

旧版は、案件側の総合点$g$が消える境界では機関側の総合点$h$への感応がゼロとなり、案件が生きている内部では正となる増加関数は存在しないとした(公理A1〜A4による証明)。

しかし$\Phi(g,h)=gh$は、$g=0$の境界で機関感応度$\partial\Phi/\partial h = g$がゼロとなり、$g>0$の内部で正となるため反例になる。したがって、境界と内部で感応が変わるという事実だけから合成関数の不存在は導けない。

BOOK_DECISIONS.md D-062は、Book A版の旧「二層非可換性定理」と公理A1〜A4による証明を撤回し、D-004の中核命題一括指定・P-008e・P-010・D-007(Theorem 3先行の書き順)を上書きした。撤回後もBook A第11章は測定分離原則の章として維持される。
