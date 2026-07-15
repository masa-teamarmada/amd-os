# Book A Ch4+Ch5 統合 機械実装レポート

作成: 2026-07-16 JST  
範囲: Book A 現行 Ch4(P) + Ch5(R) 統合に伴う 16→15章化の機械整合。統合章本文の執筆・正式タイトル確定は対象外。

## 1. 実装方針

- 新Ch4 は統合章とし、slug は `book-a-ch-4-5` を採用した。
- 既存 slug は原則不変。旧Ch6〜16 は slug を動かさず、新Ch5〜15として表示番号・本文見出し・前方参照だけを繰り上げた。
- `book-a-ch-4.md` / `book-a-ch-5.md` は物理マージせず、タイトル直下に統合対象注記だけを追加した。
- 白紙構想・柏木構想などの履歴 md は本文を遡及改変せず、冒頭注記で統合後の読み替えを示した。

## 2. 章番号対応

| 新章 | slug | 旧章 |
|---:|---|---|
| 1 | `book-a-ch-1` | 旧Ch1 |
| 2 | `book-a-ch-2` | 旧Ch2 |
| 3 | `book-a-ch-3` | 旧Ch3 |
| 4 | `book-a-ch-4-5` | 旧Ch4(P)+旧Ch5(R) |
| 5 | `book-a-ch-6` | 旧Ch6 |
| 6 | `book-a-ch-7` | 旧Ch7 |
| 7 | `book-a-ch-8` | 旧Ch8 |
| 8 | `book-a-ch-9` | 旧Ch9 |
| 9 | `book-a-ch-10` | 旧Ch10 |
| 10 | `book-a-ch-11` | 旧Ch11 |
| 11 | `book-a-ch-12` | 旧Ch12 |
| 12 | `book-a-ch-13` | 旧Ch13 |
| 13 | `book-a-ch-13-5` | 旧Ch14 CEO章 |
| 14 | `book-a-ch-14` | 旧Ch15 出口ポートフォリオ |
| 15 | `book-a-ch-15` | 旧Ch16 検証と限界 |

## 3. 変更ファイル

| 区分 | ファイル |
|---|---|
| 上位・正本 | `BOOKS_PORTFOLIO.md`, `BOOK_A_MASTER_PLAN.md`, `BOOK_A_STORY_WORLD.md`, `BOOK_A_NARRATIVE_DESIGN.md`, `BOOK_A_CHARACTER_NAMES.md` |
| 司令塔・履歴 | `COMMANDER_TASKS.md`, `9-5-appendix-changelog.md`, 本レポート |
| OS目次 | `pwa/src/app/(app)/bzm/bzm-chapters.ts` |
| 本文前方参照 | `book-a-ch-1.md`〜`book-a-ch-10.md` |
| 履歴注記 | `2026-07-13_narrative_rebuild_ch2_v4.md`, `2026-07-13_narrative_rebuild_ch4_ch5_v1.md`, `2026-07-13_narrative_rebuild_ch6_v1.md`, `2026-07-14_narrative_rebuild_ch4_v2.md`, `2026-07-14_kashiwagi_central_redesign_v1.md`, `2026-07-14_kashiwagi_weaving_pass_v1.md` |

## 4. 前方参照 grep カウント

対象: `book-a-ch-1.md`〜`book-a-ch-10.md`。before は作業前 `HEAD`、after は本実装後。

| pattern | before | after |
|---|---:|---:|
| 第4章 | 18 | 1 |
| 第5章 | 24 | 23 |
| 第6章 | 22 | 23 |
| 第7章 | 21 | 27 |
| 第8章 | 27 | 23 |
| 第9章 | 23 | 15 |
| 第10章 | 14 | 7 |
| 第11章 | 7 | 7 |
| 第12章 | 6 | 3 |
| 第13章 | 3 | 4 |
| 第14章 | 8 | 6 |
| 第15章 | 7 | 7 |
| 第16章 | 0 | 0 |
| Ch4 | 0 | 2 |
| Ch5 | 0 | 2 |

after の第5章以降は、新しい章番号として残るものを含む。`第16章` / `Ch16` の本文10ファイル内残存は 0 件。

## 5. 曖昧判断

- 旧Ch4(P)固有の参照は `統合章前半(P)` または `統合章の P 節` に寄せた。
- 旧Ch5(R)固有の参照は `統合章後半(R)` に寄せた。
- 文脈が P/R どちらにも限定されない参照は `統合章` とした。
- `第6章` 以降の明示章番号は、図番号・表番号・節番号を除き、旧Ch6→新Ch5の対応表に従って繰り上げた。
- 白紙構想 md の `Ch4/Ch5` 表記は履歴文として温存し、冒頭注記で統合章前半/後半への読み替えを示した。

## 6. 残タスク

- 統合章の正式タイトル確定。
- 統合章本文の物理マージ・新規執筆。
- 統合章本文確定後の `book-a-ch-4.md` / `book-a-ch-5.md` 廃止・リダイレクト方針の再裁定。
