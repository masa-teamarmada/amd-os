---
id: concept-time-fixed-validation-record
title: "検証用履歴を時点固定する"
kind: concept
layer: evidence
status: design-choice
summary: "予測時点より後に確認されたPまたはR_netを過去の予測入力へ補完しない。運用画面の便宜的な補完と、検証用の時点固定データを分離する。検証用記録は判定時点・利用可能だった証拠・モデル版・採点者・判断・介入・観測期間を変更不能な一組として保存する。"
source_ref: "BZM_2_0_REVISION_REQUIREMENTS.md#47-検証用履歴を時点固定する"
relations:
  - type: supports
    target: concept-prospective-case-registration
  - type: tests
    target: measure-sps-diagnostic-index
---

## 内容

予測時点より後に確認されたPまたはR_netを、過去の予測入力へ補完しない。運用画面の便宜的な補完と、検証用の時点固定データを分離する。

検証用記録は、次の項目を変更不能な一組として保存する。

- 判定時点。
- 利用可能だった証拠。
- モデル版、重み、欠測規則。
- 採点者と採点前の独立性。
- GO、WAIT、NO_GO、HOLDの判断。
- 判断後の介入、担当、工数、費用。
- 観測期間と結果。

2026-07-28の読み取り専用確認では、AMD Score入力107行のうちPとR_netまで揃う行は13行、92行は後日の値補完を含み将来日付の評価行も存在した。この不足は時点固定の欠如がもたらす検証不能の具体例である。
