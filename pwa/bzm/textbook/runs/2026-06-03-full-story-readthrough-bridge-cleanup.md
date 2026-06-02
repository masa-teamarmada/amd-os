# Textbook full-story readthrough bridge cleanup

Date: 2026-06-03 JST

## Executive summary

Prologue〜Epilogueがつながった状態で一気読みしたとき、本文のところどころに章設計の看板が残っていた。今回は物語の筋を変えず、章末の `次の章では` / `この章で` / `Act I` などのメタな橋を、次の場面へ自然に引っ張る文へ置き換えた。

目的は、読者にアウトラインを見せず、物語の声のまま読み進めてもらうこと。

## Scope

- `pwa/bzm/public-manuscript/03-support-can-isolate-researchers.md`
- `pwa/bzm/public-manuscript/10-turning-failure-into-learning.md`
- `pwa/bzm/public-manuscript/12-readiness-axes.md`
- `pwa/bzm/public-manuscript/14-institution-as-nursery.md`
- `pwa/bzm/public-manuscript/15-why-model-the-field.md`
- `pwa/bzm/public-manuscript/16-readiness-axes-field-guide.md`
- `pwa/bzm/public-manuscript/18-founder-readiness-field-first.md`
- `pwa/bzm/public-manuscript/20-retrofit-validation-as-learning.md`
- `pwa/bzm/textbook/COMMANDER_TASKS.md`

## Changes

- Ch03: reader-facing `Act I` languageを削除し、研究者CEO/外部CEOの粗い二択が次に戻ってくる余韻へ変更。
- Ch10: `次の章では` 型の説明を、受信箱に公募・企業・投資家の風が届く場面へ変更。
- Ch12: `あとでTRL...` の講義感を弱め、名前よりも準備を割る機能を前に出した。章末も人を見る言葉の荒さへ接続。
- Ch14: `ERS` を置く説明ブロックを削り、これまでの紙が同じ現場を別角度から見せていたことへ接続。
- Ch15: BZM登場を講義の入口ではなく、次に「準備できている」を割る必要へ接続。
- Ch16: 章末の次章予告を、外の締切が止まらない余韻へ変更。
- Ch18: `次章では` を削り、案件の輪郭が見えたが低さが残る、という終わりへ変更。
- Ch20: 見出しと章末を、次章予告ではなく「研究者へ戻してはいけない」未解決へ変更。
- Prologue / Ch01 / Ch02 / Ch09 / Ch11 / Ch13 / Ch17 / Ch19: 残っていた強い章予告を、次の場面や問いが自然に立ち上がる文へ変更。
- Ch08 / Ch11 / Ch12 / Ch14 / Ch17 / Ch18: 残った `この章で` / `あとで` 型のメタ表現を、場面の時間や自然な命名へ置換。

## Acceptance check

- Prologue〜Epilogueの物語声を壊さず、章末の講義看板だけを圧縮。
- 新しい理論説明や式は追加していない。
- author directiveは保持。
- markdown tableは追加していない。
- public forbidden termsを入れていない。

## Next actions

1. `full-story cold-reader review Prologue-Epilogue`: 一気読みで読者の引っかかりが残る箇所を批評する。
2. `Ch13/18 final repetition check`: 外部候補と創業者機能の反復がまだ気になるか確認する。
3. `model exposition placement brief`: 物語完成後に、モデル説明をどこへ追加するかを別設計する。
