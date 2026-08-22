# Textbook full-story cold-reader review Prologue-Epilogue

Date: 2026-06-03 JST

## Executive verdict

Prologue〜Epilogueは、いまのnarrative方針で一冊の物語として最後まで読める段階に入った。

販売前の完成原稿とまでは言わない。ただし、以前の「章ごとの正しい説明」「表とチェックリストの束」ではなく、ひとつの強すぎた一文が、顧客証拠、開示、会社化、CEO機能、WAIT、資本面談、学習ログ、追い風、準備度、理論地図、研究機関の苗床を通り、最後に弱いまま送れる一文へ戻る本になっている。

次に本文を触るなら、全体再rewriteではなく、数箇所のline-level polishと、モデル説明をどこに置くかの別設計に分けるべきである。

## What now works

- Prologueの `少しだけ強すぎた一文` とEpilogueの `少しだけ弱くなった一文` が、読書体験の背骨になっている。
- 若い事業化人材が、単なる解説者ではなく、失敗し、言葉を弱く戻し、責任の空白を拾い、最後に別案件へ学びを持ち越す人物になった。
- 研究者は、抽象的な「支援対象」ではなく、強い言葉によって黙り、弱い文なら送れると言える存在として残っている。
- Ch05の送信予約、Ch09の投資家面談、Ch19のRESOURCE_SHIFTメモ、Ch21の三つの紙、Epilogueの送信ボタンが、page-turnerの山として機能している。
- author directiveの生存確率、稼げる体質、早すぎる起業、Jカーブ/IPO一律化への違和感は、Ch01/06/19/Epilogueで消えずに残っている。

## Remaining fatigue

- Ch12〜Ch14は、物語化された後でも少し密度が高い。準備度、外部候補、研究機関の土壌が続くため、中盤で読者が一度息継ぎしたくなる。
- Ch16〜Ch18は、理論語を後ろへ下げたが、TRL/BRL/GRL/SRL/HRL、sigma_SU、FRL/F_character/F_capability が連続して出る。読めるが、販売前には各章一箇所だけ、名前より紙の動作を強める余地がある。
- Ch22〜Ch24はField Toolkitとして分離済みだが、Web表示上で本編と同じ見た目だと、読者には続きの章に見える可能性がある。本文よりUI/TOC側の見せ方で解決する方がよい。

## Do not rewrite

- Prologueの導入は維持する。会社紹介や理論説明から始めない。
- Ch05の送信予約十七分前は維持する。現状の最も強い場面の一つである。
- Ch19のRESOURCE_SHIFTメモは維持する。終盤の判断が、点数ではなく引き算として見える。
- Ch21の三つの紙からEpilogueへ渡る構造は維持する。ここを説明へ戻すと、物語の終わりが弱くなる。
- Epilogueの `この文なら、送れます` と最後の送信ボタンは維持する。

## Next surgical orders

1. `Ch12-Ch14 breath pass`
   - 全体rewriteは禁止。
   - 各章一箇所だけ、説明が続く段落を会議室の紙、予定、PDF、沈黙へ戻す。
   - 目的は情報量削減ではなく、中盤の息継ぎを作ること。

2. `Ch16-Ch18 theory aftertaste pass`
   - 理論名を削らない。
   - ただし名前を出した直後に、読者が見える紙やメモへ一文戻す。
   - 目的はモデル説明の入口を残しつつ、narrative voiceを保つこと。

3. `Field Toolkit layout/readability pass`
   - Ch22〜Ch24本文の大改稿ではなく、route/TOC/heading/visual treatmentで付録感を出す。
   - 触る場合はmanifest/code変更になる可能性があるため、local build必須。production deployはquota温存方針に従う。

4. `model exposition placement brief`
   - 式やモデル説明は、いまの物語本文へ無理に差し込まない。
   - Ch15〜Ch21の後、または各Part末の短い `Model note` として置く案を比較する。
   - 目的は、物語を壊さず論理の骨格を足すこと。

## Acceptance gate

- Prologue〜Epilogueを一冊の物語として扱う方針は継続可。
- 次の本文作業は、全体再設計ではなくsurgical polishに限定する。
- モデル式/理論説明は次フェーズで別設計する。
- author directive retentionは維持されている。
- Field Toolkitは本編の終章ではなく、Epilogue後の参照道具として扱う。
