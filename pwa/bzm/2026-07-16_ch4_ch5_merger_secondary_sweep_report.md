# Book A Ch4+Ch5 統合 章番号二次掃討レポート

作成: 2026-07-16 12:48 JST  
対象: Book A TOC v3 (Ch4+Ch5 統合、16→15章化) の一次実装後に残った周辺文書の章番号残存

## 1. 実装方針

本掃討は、`2026-07-16_ch4_ch5_merger_execution_report.md` の一次実装後に残った周辺文書の機械整合である。本文正本 `book-a-ch-1.md`〜`book-a-ch-10.md`、図版・matplotlib・SVG・PWAコード、COMMANDER_TASKS の日付つきログ、PF-014 正本記録は対象外にした。

分類は行・セクション単位で行った。現行計画の見出し・固定フレーズは(B)機械整合、過去HANDOFF・L3進捗本文・日付つきログは(A)履歴保存、Book A以外のモノグラフ/P1/廃案企画は(C)対象外とした。

## 2. MASTER_PLAN 見出しと現行計画の修正

`BOOK_A_MASTER_PLAN.md` §9 の見出し8箇所を新番号へ修正した。

- Ch7→Ch6: マクロ追い風の計測
- Ch8→Ch7: 生存の動学
- Ch9→Ch8: 統合スコアと律速診断
- Ch11→Ch10: 苗床を測る
- Ch12→Ch11: 二層非可換性
- Ch13→Ch12: ラウンドテーブル
- Ch14→Ch13: CEOという難問
- Ch15→Ch14: 出口ポートフォリオ

あわせて、同ファイルの現行計画として一意に読める箇所を修正した。

- 「本書16回」2箇所を「本書15回」へ修正。
- 統合スコア章の「図解と判定は第5章」を「第9章」へ修正。
- RT章の「第16回総合演習」を「第15回総合演習」へ修正。
- 出口ポートフォリオ章の「第4・9章」を「第4・8章」へ修正。
- 終章の「16回分の道具」を「15回分の道具」へ修正。
- §8 リスク一覧の Ch16 / Ch6-10 / Ch9 / Ch7-8 / Ch12 / Ch13 / Ch8-13 / 16回1:1 を、Ch15 / Ch5-9 / Ch8 / Ch6-7 / Ch11 / Ch12 / Ch7-12 / 15回1:1 へ修正。

## 3. 峰フレーズの修正

数式強度曲線の固定フレーズ5箇所を修正した。

- `BOOK_A_CHAPTER_6_PROGRESS.md`: 峰 (Ch 6-10) → 峰 (Ch 5-9)
- `BOOK_A_CHAPTER_9_PROGRESS.md`: 峰 (Ch 6-10) → 峰 (Ch 5-9)
- `BOOK_A_CHAPTER_10_PROGRESS.md`: 峰 (Ch 6-10) → 峰 (Ch 5-9)
- `BOOK_A_PUBLISHING_PLAN.md` §1: `Ch6-10 が峰` → `Ch5-9 が峰`
- `BOOK_A_PUBLISHING_PLAN.md` §3: Ch14/Ch6-10/Ch6 or Ch8 を Ch13/Ch5-9/Ch5 or Ch7 へ一括修正。

`★峰1`、`★峰2`、`二峰性`、単一章内の「章の数理の峰」は章番号レンジではないため不触。

## 4. MASTER_PLAN 本文相互参照の分類

`rg -n "第[0-9]+章|Ch [0-9]+" BOOK_A_MASTER_PLAN.md` で洗い出し、以下のように分類した。

### 修正済み

- §8 リスク一覧: 現行TOCの運用リスクとして一意に新番号へ変換できるため修正。
- §9 章別詳細の見出し・章内固定句: §2記載の通り修正。

### 履歴保存で不触

- §5 場面クレーム台帳の Ch2/3/5/6/8/9/16 等。
- §6 K1-K8 本文の Ch11/13/15 等。
- PF-014由来の v1/v2 決定記録に対応する章番号。

これらは当時のTOC v1/v2での意思決定記録であり、同セクション内に「遡及改番しない」趣旨の注記があるため、本文は書き換えなかった。

### 要人間確認として残した項目

- §9 Ch6: `λ_x(σ_SU, ECR) への前方参照で第5章に接続`
- §9 Ch10: `完全版は第5章とモノグラフ`
- §9 Ch11: `Goodhart 回避の KPI 設計条件 lite (第5章へ接続)`
- §9 Ch12: `RT は第5章 λ_x(σ_SU, ECR) のブラックボックス...`
- §9 Ch13: `Ch 6 の F-CES`、`第5章 §6.7 表6-4`、`理論接続は第5章 §6.7`
- §9 Ch14: `Goodhart 回避 KPI (第5章の系の適用)`

これらは単純な旧番号シフトでは、接続先の理論概念・節番号・Book A内章番号のどれを優先すべきかが確定しないため、今回の機械掃討では不触にした。

## 5. L3進捗とHANDOFFへの注記

`BOOK_A_CHAPTER_1_PROGRESS.md`〜`BOOK_A_CHAPTER_10_PROGRESS.md` の10ファイルすべてに、TOC v3の章番号読み替え注記を冒頭追加した。本文は履歴保存対象として原則不触にし、例外は峰フレーズ3箇所のみ。

以下のHANDOFF 6本に冒頭注記を追加した。

- `HANDOFF_BOOK_A_2026-07-10.md`
- `HANDOFF_BOOK_A_2026-07-11.md`
- `HANDOFF_BOOK_A_2026-07-13.md`
- `HANDOFF_BOOK_A_2026-07-16.md`
- `HANDOFF_BZM_2026-07-02.md`
- `HANDOFF_BZM_BOOK_2026-07-02.md`

`HANDOFF_PF020_2026-07-12.md` は「Ch4事故」が歴史的インシデント名であり、注記も含め不触。`HANDOFF_P1_2026-07-03.md` はP1スコープのため不触。

## 6. PUBLISHING_PLAN の分割対応

`BOOK_A_PUBLISHING_PLAN.md` は前半の現行計画のみ(B)として修正した。

- §1 の体裁行: `Ch6-10 が峰` → `Ch5-9 が峰`
- §3 の検証サンプル選定行: Ch14/Ch6-10/Ch6 or Ch8 を Ch13/Ch5-9/Ch5 or Ch7 に修正

`## 4. 組版技術検証ログ` 以下は日付つき実施記録であるため不触。2026-07-15時点の Ch8 実測ログは当時の呼称のまま保存する。

## 7. 対象外確認

- `BOOKS_PORTFOLIO.md`: PF-014 は v1→v2→v3 の変遷を正しく記録済み。不触。
- `COMMANDER_TASKS.md`: 冒頭が TOC v3 同期済み。日付つき journal は不触。
- `pwa/manual/*.md` / `pwa/spec/*.md`: Book A章番号掃討対象の残存なし。別レーンのdirtyは不触。
- `pwa/scheduled-tasks/amd-os-l10-textbook-insight-extract/SKILL.md`: Book A章番号掃討対象の残存なし。
- `pwa/scheduled-tasks/amd-os-l6-meeting-extract/SKILL.md`: 別レーンdirtyのため不触。
- `HANDOFF_PF020_2026-07-12.md`: 不触。
- `HANDOFF_P1_2026-07-03.md`: 不触。
- `book-a-ch-1.md`〜`book-a-ch-10.md`: 一次実装済みのため不触。
- 図版・SVG・matplotlib・組版migration prompt群: 並行セッション競合リスクのため不触。
- `pwa/design/atlas_routine.md`、`2026-07-14_frontmatter_gairei_draft_v1.md`: 別レーンdirtyのため不触。

## 8. 検証

- `rg "峰 \(Ch 6-10\)|Ch6-10 が峰|Ch6 or Ch8|Ch14 ほぼゼロ|16回1:1"` は対象ファイル群で0件。
- `rg "2026-07-16 章番号の読み替え" BOOK_A_CHAPTER_*_PROGRESS.md HANDOFF_*.md` で、PROGRESS 10本 + 対象HANDOFF 6本の注記を確認。
- `rg "^### Ch " BOOK_A_MASTER_PLAN.md` で、Ch1〜Ch15の見出しが重複なしの15章構成になっていることを確認。

## 9. 残タスク

機械掃討としての必須作業は完了。残るのは §4 の「要人間確認」6系統で、次回の章別設計レビュー時に、理論概念の接続先と節番号の扱いを決めてから本文修正する。
