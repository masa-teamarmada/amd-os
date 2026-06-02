# Textbook P0 consequence rewrite

Date: 2026-06-02 JST

## Executive summary

P0 enrichmentで追加した paid evidence / payment refusal / budget-owner absence / repeat-back / RESOURCE_SHIFT が、まだ「責任ある説明にsceneが付いたdraft」に見えるというruthless editor reviewを受け、対象章を局所改稿した。

今回の目的は、全体再設計ではなく、追加素材が部屋、資料、関係、次の行動を実際に変える場面へ進むことだった。

## Source basis

- `pwa/bzm/textbook/AUTHOR_DIRECTIVES.md`
- `pwa/bzm/textbook/PUBLICATION_POSITIONING.md`
- `pwa/bzm/textbook/runs/2026-06-02-p0-narrative-enrichment-rewrite.md`
- `pwa/bzm/textbook/runs/2026-06-02-p0-enrichment-ruthless-editor-review.md`
- `pwa/bzm/textbook/runs/2026-06-02-deep-os-source-mining-for-missing-book-content.md`
- `pwa/bzm/textbook/runs/2026-06-02-page-turner-case-source-mining-v2.md`

## Changed chapters

- Ch01: 強く書かれた `顧客候補` が支援制度メモや面接練習へ写り、後から弱く戻す痛みを追加した。payment refusalは、研究価値の否定ではなく、予算者不在と次の確認対象を教える地図として場面化した。
- Ch06: すぐ払われる短期受託を断る判断に、支援者の正当な反論、研究者の実験計画への負荷、WAIT条件の厳格化を追加した。
- Ch08: bad-news ownerを、若い事業化人材の自己申告ではなく、弱い事実を戻す権限をめぐる小さな衝突として追加した。
- Ch09: 投資家が古い資料の `顧客候補` 表現を突き、差し替えた正直さ自体が問われる場面を追加した。面談後も研究者と支援者の間に薄い距離が残るようにした。
- Ch10: 学習ログが即時修復ではなく、壊れかけた関係を壊れていないことにしないための道具であることを追加した。
- Ch13: repeat-backをCh04の繰り返しにしないため、悪い知らせを九十日の仕事へ変えられるかに焦点を移した。候補者の不安も残した。
- Ch18: repeat-backは新しいテストではなく、既出行動を理論語へ翻訳する最後の確認だと明示し、重複感を抑えた。
- Ch19: Jカーブ/IPO一律化批判に、投資家経験者の正当な反論を追加した。RESOURCE_SHIFTでは、投資家紹介、スライド、短期受託を切ることで誰かの準備や期待が曇る代償を明示した。

## Author directive retention

まさ直指示の次の要素を削らず、場面内で保持した。

- 生存確率
- 稼げる体質
- 早すぎる会社化への警戒
- 小さなpaid evidenceとpayment refusal
- 小銭稼ぎへの批判も受け止めたうえで、全シーズをJカーブ/IPOへ押し込むことへの違和感

## Public safety

公開本文では、特定企業紹介や内部運用語へ戻さず、匿名composite caseとして処理した。追加箇所は、研究者、若い事業化人材、支援者、投資家経験者、外部経営候補、研究機関の局所合理性を悪役化しないようにした。

## Verification

- `git diff --check`: passed
- conflict marker scan: no hits
- changed public manuscript forbidden term scan: no hits
- old template / markdown table scan: no hits
- H1 count for changed public manuscript files: all exactly one
- `npm run build`: not run. Markdown-only manuscript/run-note/ledger change; no route, manifest, or code touched. Production deploy also not run to preserve deployment quota.
- `git diff --cached --check`: passed

## Remaining editorial risks

- Ch01/06/09/19は代償が増えたが、次のcold-readerで「説明の上に摩擦を足した」だけに見えないかを確認する必要がある。
- Ch13/18のrepeat-back arcは圧縮したが、support boundary / founder readiness overlap passでさらに統合できる可能性がある。
- Ch22〜Ch24は別途Field Toolkit reference-modeの設計が必要。

## Next actions

1. `P0 consequence cold-reader/editor review`: 今回の追加がreader pullを上げたか、場面の代償として読めるか確認する。
2. `support boundary and actor rationality pass`: 支援者、投資家、大学、外部経営候補が悪役化していないかを章横断で見る。
3. `Field Toolkit reference-mode cleanup`: Ch22〜Ch24を本編の続きではなく、読者が引ける付録として整える。
