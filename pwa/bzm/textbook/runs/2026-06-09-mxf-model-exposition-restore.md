# Textbook MXF model exposition restore

Date: 2026-06-09 JST

## Trigger

まさから、ナラティブ化の過程で以前作ったMXF/BZMモデルの数式・説明が薄くなっているため、現行ストーリーを活かしつつ、ストーリーの合間に解説を挟む構成で旧コンテンツを復活させる方針を受領。

## Scope

本文の物語構造は維持し、Method AppendixとModel Noteを厚くした。

Edited public manuscript:

- `pwa/bzm/public-manuscript/16-readiness-axes-field-guide.md`
- `pwa/bzm/public-manuscript/17-macro-alignment-and-triple-helix.md`
- `pwa/bzm/public-manuscript/18-founder-readiness-field-first.md`
- `pwa/bzm/public-manuscript/19-integrated-score-as-next-action.md`
- `pwa/bzm/public-manuscript/21-institution-readiness-as-nursery.md`
- `pwa/bzm/public-manuscript/26-method-how-to-read-the-model.md`
- `pwa/bzm/public-manuscript/27-method-notation-and-scale.md`
- `pwa/bzm/public-manuscript/28-method-macro-alignment.md`
- `pwa/bzm/public-manuscript/29-method-readiness-axes.md`
- `pwa/bzm/public-manuscript/30-method-founder-function.md`
- `pwa/bzm/public-manuscript/31-method-integrated-readiness.md`
- `pwa/bzm/public-manuscript/33-method-institutional-nursery.md`

## Restored model content

- `MXFモデル` / `M×X×F` の読み方をM0/M5へ明示。
- `M`: `mu_A` / `mu_I` / `mu_G` / `sigma_SU`、観測量、状態空間モデル、固有値、GO gateをM2へ復活。
- `X`: TRL / BRL / GRL / SRL / HRL、`X = product((x + 1)^alpha_x)`、顧客準備度をBRLへ含める理由、TRLを外す場合をM3へ復活。
- `F`: `F_character`、`F_capability`、ALQ/Grit/Resilience、CES合成をM4へ復活。
- `S`: `S = K * product((X_i + 1)^alpha_i)`、`S = k * M * X * F`、base alpha、K校正、手計算例、律速 `alpha_i / (X_i + 1)` をM5へ復活。
- `ERS`: 八軸、加重和、`s = (lv - 1) / 4`、`A_k`、`ERS`、例をM7へ復活。

## Narrative integration

- Ch16に、五つの準備度から`X`へ降りるModel Noteを補強。
- Ch17に、追い風の位相差から`M`へ降りるModel Noteを追加。
- Ch18に、創業者機能の配置から`F`へ降りるModel Noteを追加。
- Ch19に、RESOURCE_SHIFTから`M×X×F`、感度、律速へ降りるModel Noteを補強。
- Ch21に、個別案件と苗床を分ける場面からERSへ降りるModel Noteを追加。

## Deliberate constraints

- Prologue〜Epilogueの物語線は崩していない。
- 旧内部語や会社紹介には戻していない。
- `AMD Score` という公開名への回帰ではなく、公開本文では `統合準備度` / `MXFモデル` として復活。
- Field Toolkit本文、manifest、route、UIは未変更。
- Vercel push/deployなし。approval gate対象。

## Verification

- `git diff --check`: passed.
- conflict marker scan on changed public manuscript / run note / ledger files: no hits.
- changed public manuscript forbidden term scan: no hits.
- old template scan on changed public manuscript files: no hits.
- markdown table scan: narrative body files Ch16/17/18/19/21 no hits. Method Appendix files intentionally include compact explanatory tables for notation, weights, and ERS axes.
- H1 count for changed public manuscript files: all exactly one.

## Next actions

1. `MXF exposition cold-reader review`: ストーリーと解説の切り替わりが自然か、Model Noteが重すぎないかを読む。
2. `Technical notation review`: `sigma_SU`、状態空間、CES、統合準備度、ERSの式の精度と表記ゆれを確認。
3. `Model Appendix layout/readability pass`: 式・表・Model NoteをWeb上で読みやすくする。code/manifest/UI変更ならlocal build必須。push/deployはdeploy bundle承認後のみ。
