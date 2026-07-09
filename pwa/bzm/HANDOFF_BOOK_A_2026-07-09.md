# HANDOFF_BOOK_A_2026-07-09.md — Book A 出版準備 引き継ぎ

*最終更新: 2026-07-09 / トピック: 出版方針の確定 (自費出版+監修体制) + 第2章の起草 (ステージ4 まで)*

## このセッションでやったこと (詳細は各正本 md の Changelog)

1. **出版方針を確定 → PF-015**: Book A は**自費出版を基本線** (出版社を通さない。知り合い・連携先への直販 + Kindle 一般販売。目的 = 「本を出せるレベルにある」ことを見せること)。著者体制は**単著 (まさ) + 監修複数** (石原先生は監修でも可、NIMS 松本さんら監修候補は広い) を許容。※P1 論文の石原先生「共著」方針 (D-061) は不変。
2. **分量帯域を上方改訂 → PF-016**: 章 15,000〜18,000字 (数理章 Ch6-10 は 22,000字まで) / 総 480〜550p。旧 414p/440p 設計を上書き。字数上限は「水増し検出」であり切り詰めゲートではない。→ 第1章の「2割超過」論点は解消。
3. **制作モデルミックスを確定 (PF-016 に併記)**: 段落 outline/draft/must_fix反映 = Sonnet 5 / adversarial verify = Opus 4.8 / 統合判断 (synth・裁定・記帳) = えいみ本体 (Fable)。コストを skeleton 時の 1/5 前後に圧縮。
4. **glossary §5 新設**: 開示レベル Lv1-4 の3冊共通仮定義 + 「戻る条件 (現場語) / 復帰条件 (第10章の形式語)」の2語併存を明文化 (第2章が正準初出)。
5. **第2章を起草**: ステージ1 (節 skeleton、9節16,300字) → ステージ2 (まさ確定) → ステージ3-4 (outline + draft、計 約17,800字) 完了。ステージ5 (5 persona 敵対検証) は **3/5 で中断** (student/auditor が JSON 出力失敗)。
6. **商標調査ワーカー (別セッション) 完了**: 「Before Zero」系 商標 **全0件** / ディープテック起業の書籍区分に登録なし / 書名重複なし → K7 タイトル確定の追い風。BOOKS_PORTFOLIO §7-16 に記帳済み。

## リポ状態

- **対象リポ**: `amd-os` (GitHub `masa-teamarmada/amd-os`)、正本は `origin/main:pwa/bzm/`。ローカル checkout に bzm は無い。**読む/書く手順は下記 migration prompt 参照**。
- **origin/main HEAD**: 商標ワーカーの `b58450f2` の上に、この handoff の commit が乗る (未 push なら次アクションで push)。
- **未コミット**: この handoff bundle (BOOK_A_CH2_DRAFT_v1.md 新規 / L3 更新 / この HANDOFF / SESSION_MIGRATION_PROMPT.md)。
- **第2章の本文 v1**: `pwa/bzm/BOOK_A_CH2_DRAFT_v1.md` に退避済み (WIP・非正本)。正本 `book-a-ch-2.md` はまだ無い。UI (bzm-chapters.ts) 未登録。

## 未解決タスク (次セッション、優先順)

1. 🔥 **第2章の verify を完成させる** — resume で student/auditor を live 実行 → must_fix 全反映 (手順は L3 `BOOK_A_CHAPTER_2_PROGRESS.md` の「resume 手順」)。
2. **第2章を正本化** — 完成本文を `book-a-ch-2.md` に昇格 → `pwa/src/app/(app)/bzm/bzm-chapters.ts` に登録 (part=book-a、slug=book-a-ch-2、status=in-progress) → `pwa/src/lib/build-info.ts` の BUILD_VERSION bump → AMD OS `/bzm/book-a-ch-2` で表示確認 → `BOOK_A_CH2_DRAFT_v1.md` を削除。
3. **まさ詳細レビュー (ステージ6)** — 第2章の申し送り論点1 (第1章章末予告との接続、第1章側の一文微修正案) と論点3 (B面の語彙割り当ての言い切り) を draft を見せて確定。第1章のステージ6 (段落確定) も未了なので併せて。
4. **第3章の起草** — 同じ pipeline (skeleton → まさ確定 → outline/draft = Sonnet → verify = Opus → 裁定 = 本体)。TOC 仕様は `BOOK_A_MASTER_PLAN.md` §9 Ch 3。
5. (低優先) 石原先生への打診パッケージ (Book A 監修 + P1 共著の1パッケージ、D-061/PF-015)。えいみドラフト可。まさ着手指示待ち。

## 次セッション最初のアクション

**まず handoff bundle を push** (未 push なら) → **第2章の verify を resume** (L3 の resume 手順) → 完成 → 正本化 → まさレビュー。**本体は Opus 4.8 セッション推奨** (Fable 本体は文脈読み直しコストが高い。統合判断は Opus で十分、品質ゲートは 5 persona verify + まさ確定)。

## ポインタ (正本)

- L1 上位: `pwa/bzm/BOOKS_PORTFOLIO.md` (PF-001〜016、§5 露出台帳、§7 次アクション、§8 論文ポートフォリオ)
- L1 Book A 専用: `pwa/bzm/BOOK_A_MASTER_PLAN.md` (15章 TOC v1、§7 制作 pipeline+モデルミックス、§9 章別詳細)
- L3 第1章: `pwa/bzm/BOOK_A_CHAPTER_1_PROGRESS.md` (v1 完成、ステージ6 まさレビュー待ち、申し送り4論点)
- L3 第2章: `pwa/bzm/BOOK_A_CHAPTER_2_PROGRESS.md` (ステージ4完了、resume 手順、取得済み findings)
- 用語正本: `pwa/bzm/terminology_glossary.md` (§5 開示Lv1-4、戻る/復帰条件)
- 判例 (L2): `pwa/bzm/BOOK_DECISIONS.md` (D-014 章 pipeline、D-056〜061)
- 第2章 WIP本文: `pwa/bzm/BOOK_A_CH2_DRAFT_v1.md` (次セッションで削除予定)
- 制作 workflow run: skeleton = `wf_9112e84f-9ca` / draft = `wf_ea405cb2-201` (resume 対象)

## このセッションで作った branch/worktree

- なし (bzm 編集は origin/main ベースの一時 worktree で行い、commit → push origin HEAD:main。新規ブランチは作っていない)。
