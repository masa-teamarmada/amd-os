# Textbook Ch19 RESOURCE_SHIFT artifact pass

Date: 2026-06-02 JST

## Executive summary

P0 consequence cold-reader/editor reviewで残ったCh19のRESOURCE_SHIFT課題を、散文説明ではなく、会議室で読めるA4メモとして本文内に具体化した。

今回の目的は、読者がCh19を読み終えたあとに「何を切り、誰が困り、何に時間が戻ったか」を言える状態にすることだった。Jカーブ/IPO側の合理的な反論は弱めず、大きな挑戦を小さく畳む危険も残した。

## Source basis

- `pwa/bzm/textbook/PUBLICATION_POSITIONING.md`
- `pwa/bzm/textbook/AUTHOR_DIRECTIVES.md`
- `pwa/bzm/textbook/runs/2026-06-02-p0-consequence-cold-reader-editor-review.md`
- `pwa/bzm/textbook/runs/2026-06-02-p0-consequence-commander-review.md`
- `pwa/bzm/textbook/runs/2026-06-02-ch08-13-18-overlap-compression.md`
- `pwa/bzm/public-manuscript/19-integrated-score-as-next-action.md`
- `pwa/bzm/public-manuscript/20-retrofit-validation-as-learning.md`

## Changes

- Ch19: RESOURCE_SHIFT節に、横向きA4の「RESOURCE_SHIFTメモ」を追加した。投資家紹介、市場規模スライド、肩書き打診、短期受託について、切る活動、曇る人、戻る時間/資源、下げる不確実性、九十日後の見直し日を本文内の紙として見せた。
- Ch19: RESOURCE_SHIFTが単なる整理や消極判断ではなく、誰かの準備した前進を一度止める判断であることを、メモが置かれたあとの会議の反応で補強した。
- Ch20: Ch19で減らした投資家紹介の代償を一文だけ運び、RESOURCE_SHIFTのコストが次章の証拠ルール更新へ残るようにした。

## Acceptance check

- 読者はCh19後に、投資家紹介二件、市場規模スライド磨き込み、肩書き打診、短期受託を切ったと説明できる。
- 読者は、紹介を準備していた支援者、面接の勢いを気にする外部経営候補、実験費を心配する研究者が曇ったと説明できる。
- 読者は、面談準備、資料作業、候補者面談、研究者の週二日が、予算経路、病院負荷、研究者の守る線、実環境評価条件の確認へ戻ったと説明できる。
- RESOURCE_SHIFTは表ではなく、本文内のA4メモとして読める。
- Jカーブ/IPO側の反論は維持した。大きく伸びる案件を小さく畳む危険は合理的な反論として残っている。
- Ch01/06/08/09/10/13/18のgainsには触っていない。

## Verification

- `git diff --check`: passed
- `git diff --cached --check`: passed
- conflict marker scan: no hits
- changed public manuscript forbidden term scan: no hits
- old template / markdown table scan: no hits
- H1 count for changed public manuscript files: all exactly one
- build: not run. Markdown-only manuscript/run-note/ledger change; no route, manifest, or code touched. Production deploy also not run to preserve deployment quota.

## Next actions

1. Field Toolkit reference-mode cleanup: Ch22〜Ch24を本編の続きではなく、読者が引ける参照道具として分離する。
2. support boundary pass: 支援者・大学・外部人材・若い事業化人材の合理性が章横断で保たれているかを確認する。
3. Ch00〜Ch24 surgical residue pass: 説明残り、理論名の出すタイミング、tool densityを通読で整える。
