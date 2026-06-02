# Textbook Ch08/13/18 overlap compression

Date: 2026-06-02 JST

## Executive summary

P0 consequence cold-reader/editor reviewで指摘されたCh08/13/18の重複を、全体rewriteではなく局所圧縮で処理した。

目的は、Ch08を「弱い事実を戻す権限」の章として終わらせ、Ch13を外部経営候補の行動場面に寄せ、Ch18を同じ面談の再演ではなく理論語への翻訳に寄せることだった。

## Source basis

- `pwa/bzm/textbook/PUBLICATION_POSITIONING.md`
- `pwa/bzm/textbook/AUTHOR_DIRECTIVES.md`
- `pwa/bzm/textbook/runs/2026-06-02-p0-consequence-rewrite.md`
- `pwa/bzm/textbook/runs/2026-06-02-p0-consequence-cold-reader-editor-review.md`
- `pwa/bzm/textbook/runs/2026-06-02-p0-consequence-commander-review.md`
- `pwa/bzm/public-manuscript/08-who-carries-what.md`
- `pwa/bzm/public-manuscript/13-founder-readiness-field-language.md`
- `pwa/bzm/public-manuscript/18-founder-readiness-field-first.md`

## Changes

- Ch08: authority conflictと30日行動メモを保持し、研究者・大学・外部経営候補・支援者の広い役割列挙を圧縮した。章末は、若い事業化人材が「探索担当は関心あり。予算者未確認。評価条件未確定」と弱い事実を戻す行動に変えた。
- Ch13: external candidate behavior sceneを主担当にした。支払い拒否を強い言葉へ寄せる失敗、弱い言葉への修復、候補者の局所合理性、最初の90日で何を持つかを残した。role-paper proseは短い機能メモへ圧縮した。
- Ch18: 同じmeeting/repeat-backを再演せず、Ch13で見た行動にFRL / F_character / F_capabilityという名前を置くlean chapterへ寄せた。人格評価ではなく、配置設計として読ませる構成にした。

## Actor rationality

支援者、大学、外部経営候補、若い事業化人材を悪役化しないようにした。

- 支援者の「弱く見える資料への不安」は、面接資料や前進感を守る合理性として残した。
- 外部経営候補の強い言葉は、資金調達や採用の場で身についた武器として扱い、単純な不誠実さにしなかった。
- 大学や研究機関は遅さではなく、開示と制度の順番を守る役割として扱った。
- 若い事業化人材は肩書きではなく、弱い事実を戻す権限と記録・翻訳の機能として扱った。

## Acceptance check

- Ch08 after-read: 読者は、弱い事実を戻す権限が若い事業化人材へ渡ったと説明できる。
- Ch13/18 role split: Ch13は外部経営候補の行動scene、Ch18はその行動を理論語へ翻訳する章に分かれた。
- 説明/役割列挙/同型repeat-backを削減し、markdown tableは追加していない。
- Ch01/06/09/10/19のP0 consequence gainsは触っていない。

## Verification

- `git diff --check`: passed
- `git diff --cached --check`: passed
- conflict marker scan: no hits
- changed public manuscript forbidden term scan: no hits
- old template / markdown table scan: no hits
- H1 count for changed public manuscript files: all exactly one
- build: not run. Markdown-only manuscript/run-note/ledger change; no route, manifest, or code touched. Production deploy also not run to preserve deployment quota.

## Next actions

1. `Ch19 RESOURCE_SHIFT artifact pass`: subtraction memoを具体artifact化し、Ch20/21へ一つだけ代償を運ぶ。
2. `Field Toolkit reference-mode cleanup`: Ch22〜Ch24を本編の続きではなく、読者が引ける参照道具として分離する。
3. `support boundary pass`: 支援者・大学・外部人材・若い事業化人材の合理性が章横断で保たれているかを確認する。
