# Textbook P0 consequence commander review

Date: 2026-06-02 JST

## Executive verdict

司令塔レビューでは、`9290057 docs(textbook): rewrite p0 consequence scenes` を **通過** とする。

これは完成判定ではない。P0 enrichmentの弱点だった「責任ある説明にsceneが付いたdraft」感を一段下げ、paid evidence / payment refusal / RESOURCE_SHIFT が、資料、部屋、関係、次の条件を実際に変える方向へ進んだ、という通過である。

main narrative全体のpublication gateはまだ開けない。別視点の cold-reader/editor review では7.4/10で前進判定、ただしCh08/13/18のoverlap compressionが次の最小scopeとされた。

## Review target

- branch: `codex/textbook-p0-consequence-rewrite`
- commit: `9290057 docs(textbook): rewrite p0 consequence scenes`
- worktree: `/private/tmp/amd-os-textbook-p0-consq.iVqYFT`
- source run note: `pwa/bzm/textbook/runs/2026-06-02-p0-consequence-rewrite.md`

## What passed

Ch01は、強すぎる `顧客候補` が支援制度メモや面接練習へ移動し、後から弱く戻す痛みが入った。これにより、単に「弱い証拠を弱いまま置くべき」と説明する章ではなく、強い一文が人と資料を先へ連れて行く章になった。

Ch06は、短期受託を断る判断に、支援者の正当な反論と研究者の迷いが入った。paid evidenceを単純に肯定せず、「何を明らかにする支払いか」「何を盗む支払いか」を分けられている。

Ch09は、投資家が古い資料の `顧客候補` 表現を突くことで、差し替えた正直さ自体が問われる場面になった。面談後も研究者と支援者の間に薄い距離が残るため、学習がきれいごとで終わらない。

Ch10は、学習ログを即時修復の道具にせず、壊れかけた関係を壊れていないことにしない道具として補強した。

Ch19は、Jカーブ/IPO側の正当な反論を置いたうえで、RESOURCE_SHIFTが投資家紹介、市場規模スライド、短期受託を切る判断として見えるようになった。反ベンチャーの説教に寄りにくくなっている。

## Remaining risks

P0 consequence rewriteは、局所的には前進している。ただし、まだ「読み始めたら止まらない」水準を証明したわけではない。

残るリスクは三つある。

1. Ch01/06/09/19の追加が、冷読者にはまだ「説明の後に摩擦を追加した」ように見える可能性がある。
2. Ch13/18のrepeat-back arcは圧縮されたが、Ch04から続く同型反復は残る可能性がある。
3. Ch22〜Ch24はField Toolkitとして分離されつつあるが、reference-modeとしてはまだ散文の続きに見える可能性がある。

## Commander decision

`9290057` は司令塔レビュー通過。差し戻しではない。

その後の cold-reader/editor review も通過寄りで受領する。

- review worker thread: `019e889a-ffe0-76a0-8ff2-318b1807a33f`
- review commit: `9d04979 Add P0 consequence cold-reader review`
- review note: `pwa/bzm/textbook/runs/2026-06-02-p0-consequence-cold-reader-editor-review.md`
- score: 7.4/10

cold-readerの判定では、Ch01/06/09/19は前進、特にCh09の旧版/新版を投資家に突かれる場面が最も強いpage-turner。ただしCh08は責任論へ戻り、Ch13/18はrepeat-back arcがまだ重複する。

したがって、main merge / deployへ進む前に、次は全体rewriteではなくCh08/13/18だけのoverlap compression and actor-rationality passへ進める。

次のcritic / rewriteで見ること:

- actor rationalityが守られているか。
- support boundary / founder readiness overlapが読み疲れを生んでいないか。
- Ch08のauthority conflictが一般論へ戻らず、変わった行動として終わるか。
- Ch13がexternal candidate behavior sceneを担い、Ch18がlean theory translationへ寄るか。

## Verification reviewed

The rewrite worker reported and this commander review accepted:

- `git diff --check`: passed
- `git diff --cached --check`: passed before commit
- conflict marker scan: no hits
- changed public manuscript forbidden term scan: no hits
- old template / markdown table scan: no hits
- changed public manuscript H1 count: all exactly one
- deployなし: quota温存 / markdown-only / route・manifest・code未変更

This review adds only markdown review/ledger updates and does not change public manuscript text.

## Next actions

1. Start `Textbook Ch08/13/18 overlap compression and actor-rationality pass`.
2. Then run `Ch19 RESOURCE_SHIFT artifact pass`.
3. Then run `Field Toolkit reference-mode cleanup`.
4. Decide main merge after the Ch08/13/18 pass or after Ch19 artifact pass, depending on diff size and review result.
