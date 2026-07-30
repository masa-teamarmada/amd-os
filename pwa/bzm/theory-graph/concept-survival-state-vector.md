---
id: concept-survival-state-vector
title: "生存を状態ベクトルとして扱う"
kind: concept
layer: prediction
status: design-choice
summary: "現金、moat、信用、選択肢、集中力は完全代替ではなく、月換算して単純加算した値は支払能力や存続期間を直接表さない。BZM 2.0では月次現金残高、資金トランシェ、利用可能時間、技術証拠の鮮度、顧客コミットメント期限、知財・規制の状態、残された選択肢を分離した状態として扱う。"
source_ref: "BZM_2_0_REVISION_REQUIREMENTS.md#46-生存を状態ベクトルとして扱う"
relations:
  - type: supports
    target: decision-wait-return-conditions
  - type: depends_on
    target: concept-time-fixed-validation-record
---

## 内容

現金、moat、信用、選択肢、集中力は完全代替ではない。これらを月換算して単純加算した値は、支払能力または存続期間を直接表さない。BZM 2.0では、次の状態を分離する。

- 月次現金残高と確定支払。
- 資金トランシェ、コベナンツ、希薄化。
- 研究者と経営者の利用可能時間。
- 技術証拠の鮮度と再現性。
- 顧客コミットメントの有効期限。
- 知財と規制の状態。
- 残された選択肢。

生存確率を推定する場合は、対象事象、期間、支援方針を明記する。

$$S^{\pi}(t)=\Pr(\text{対象到達が資金枯渇または撤退より先}\mid \text{時点固定状態},\pi)$$

ここで$\pi$は支援方針であり、Sを案件固有の不変値とはみなさない。
