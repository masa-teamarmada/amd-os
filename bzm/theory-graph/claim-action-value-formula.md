---
id: claim-action-value-formula
title: "行動優先度をSPS感度から分離するActionValue式"
kind: claim
layer: decision
status: design-choice
summary: "現行のα_i/(X_i+1)は現在の式と符号化におけるスコア感度に過ぎず、費用・所要時間・成功確率・依存関係・統制権の喪失を含まない。BZM 2.0の行動候補はActionValue(a)=p_aΔO_a+I_a+V_option,a−C_cash,a−C_time,a−C_control,a−C_opportunity,aを別表で持ち、小標本ではレンジと根拠を並べる。"
source_ref: "BZM_2_0_REVISION_REQUIREMENTS.md#43-行動優先度をsps感度から分離する"
relations:
  - type: depends_on
    target: concept-sps-ordinal-scale
  - type: challenges
    target: measure-sps-diagnostic-index
---

## 内容

現行の$\alpha_i/(X_i+1)$は、現在の式と符号化におけるスコア感度を示す。この値は、軸を動かす費用、所要時間、成功確率、依存関係、統制権の喪失を含まない。

BZM 2.0の行動候補は、少なくとも次の要素を別表で持つ。

$$\mathrm{ActionValue}(a)=p_a\Delta O_a+I_a+V_{option,a}-C_{cash,a}-C_{time,a}-C_{control,a}-C_{opportunity,a}$$

各記号は、次の意味を持つ。

- $p_a$:行動が意図した変化を起こす確率。
- $\Delta O_a$:観測したい外部成果の変化。
- $I_a$:意思決定に必要な情報を得る価値。
- $V_{option,a}$:新たに得る選択肢または失わずに済む選択肢の価値。
- $C$:現金、時間、統制権、他の機会を失う費用。

小標本では各項を一つの精密な金額へ合成せず、レンジと根拠を並べる。この主張は、SPS感度をそのまま行動優先度として使う運用を明示的に否定する。
