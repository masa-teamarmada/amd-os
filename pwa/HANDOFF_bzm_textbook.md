# HANDOFF — BZM 教科書ワークストリーム

> 最終更新: 2026-05-30 / トピック: 巻末資料 (9-1〜9-4) 完成・6-1 透明性ノート論文水準化・論文化設計 (bzm_paper.md) 完了。次は論文本文起稿とデータ図生成。
> ⚠️ payment-confirm の引き継ぎは別ファイル `HANDOFF_pwa_rebuild.md` (codex 正本)。混ぜない。

## このワークストリームの目的

BZM (Before Zero Model) を **学会発表・論文化まで見据えた厳密版** にする。Web 教科書 (`pwa/bzm/*.md`, 全10章) とアカデミック論文 (国内ベンチャー学会 / JASVE 向け・日本語・IMRaD) を **並行育成**。コンテンツ正本は `pwa/bzm/*.md`、ページ実装 `pwa/src/app/(app)/bzm/`、レンダラ `BzmMarkdown` (KaTeX)。

## 最新セッション要約 (2026-05-30)

- **6-1 A/B 決着**: まさ B 確定 (期待値のまま運用 + 透明性ノート)。透明性ノートを論文水準に書き直し (期待値=専門家事前情報の明示、数式妥当性は別経路で検証済の切り分け、将来 A 移行プラン)。BUGS の `[bzm/retrofit-table-inconsistency]` クローズ。
- **巻末資料 9-1〜9-4 を新設**: 9-1 統合参考文献 / 9-2 記号一覧 / 9-3 用語集 / 9-4 ERS 全 8 軸 rubric 付録。`bzm-chapters.ts` の BZM_PARTS に "appendix" part 追加、BZM_CHAPTERS に 4 章追加。
- **7-1 を self-contained 化**: ERS rubric を「design 正本参照」から巻末付録 9-4 へ。本書だけで機関評価を再現可能に。
- **論文化設計 `pwa/design/bzm_paper.md` 新設**: 教科書 14 章 × IMRaD 対応表、JASVE 論文骨子 (要旨〜結論〜付録)、図版方針 (データ図はえいみが matplotlib/OS スクショ、概念図 G1/G3 は外部生成依頼)。design/README.md にも登録。
- commit: `f35c2b3` → `720720d` (6-1+巻末3点) → `a704728` (ERS 付録) → 論文設計 (本 commit)。BUILD_VERSION v0.10.6。deploy 成功。

### 前セッション (2026-05-29)

- 既存 10 章すべてに **例題・導出・章末まとめ・練習問題** を追加し教科書品質に増補 (詳細は `design_log/sessions_2026-05.md` の 2026-05-29 エントリ)。
- 5-1 練習問題 #1 の誤問 (再現不能) を自己完結な計算問題に修正。

## リポ状態

- branch: `feat/bzm-textbook`、未 push commit なし (HEAD `f35c2b3`)。
- 作業ツリーは他セッションの dirty を多数含む (gas/ design/ manual/ payment-confirm 等)。**`git add .` / broad revert 禁止**。BZM 作業は `pwa/bzm/*.md` + `build-info.ts` のみ個別 stage。

## ✅ 完了タスク (2026-05-29〜30 で #1〜#6 全消化)

- #1 6-1 透明性ノート論文水準化 (B 確定) ✅
- #2 巻末3点セット (9-1 参考文献 / 9-2 記号一覧 / 9-3 用語集) ✅
- #3 教科書 14 章 × IMRaD 対応設計 → `design/bzm_paper.md` §1 ✅
- #4 ERS 全8軸 rubric 付録化 (9-4) + 7-1 self-contained ✅
- #5 図版方針確定 → `design/bzm_paper.md` §3 ✅
- #6 論文骨子 (IMRaD・日本語・JASVE) → `design/bzm_paper.md` §2 ✅

6-1 A/B は **まさ B 確定**。詳細は `BUGS.md` の `[bzm/retrofit-table-inconsistency]` (クローズ済)。

## 次セッションの最初の一手 (論文本文フェーズ)

教科書 (`pwa/bzm/*.md` 全14章) は学会発表水準。次は **論文本文の起稿とデータ図生成**:

1. **論文ドラフト起稿場所を決める** (候補: `before-zero/paper/` or `pwa/design/bzm_paper_draft.md`)。`design/bzm_paper.md` §2 の骨子に沿って IMRaD 本文を書く。
2. **データ図 F1〜F5 生成** (matplotlib or OS `/venture-map/*` スクショ) → `pwa/public/bzm/`。これはえいみ完結。
3. **概念図 G1 (二層構造フロー) / G3 (Triple Helix 螺旋) は外部生成依頼** (まさ)。⚠️ 画像生成 MCP 手元に無い → SVG/CSS でごまかさない (AGENTS ルール)。データ図 (F系) はコード生成 OK。
4. **先行研究の文中引用を精緻化** (教科書は「著者(年)」止まり、論文は主張ごとに厳密化)。

詳細はすべて `design/bzm_paper.md` を参照。

## ポインタ

- 正本コンテンツ (教科書 全14章): `pwa/bzm/*.md`
- 論文化設計 (IMRaD対応・骨子・図版方針): `pwa/design/bzm_paper.md` ⭐
- AMD Score / theory 正本: `before-zero/theory/amd_score.md`、`pwa/design/amd_score.md`
- セッション詳細: `pwa/design_log/sessions_2026-05.md` (2026-05-29)
- バグ・教訓: `pwa/BUGS.md` (`[bzm/retrofit-table-inconsistency]`)
- deploy: `bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh` (直 `npx vercel` 禁止)、deploy 前に必ず BUILD_VERSION bump。
