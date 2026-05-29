# HANDOFF — BZM 教科書ワークストリーム

> 最終更新: 2026-05-29 / トピック: BZM 教科書 全10章を教科書品質に増補完了、巻末3点セット以降が次の自走対象。
> ⚠️ payment-confirm の引き継ぎは別ファイル `HANDOFF_pwa_rebuild.md` (codex 正本)。混ぜない。

## このワークストリームの目的

BZM (Before Zero Model) を **学会発表・論文化まで見据えた厳密版** にする。Web 教科書 (`pwa/bzm/*.md`, 全10章) とアカデミック論文 (国内ベンチャー学会 / JASVE 向け・日本語・IMRaD) を **並行育成**。コンテンツ正本は `pwa/bzm/*.md`、ページ実装 `pwa/src/app/(app)/bzm/`、レンダラ `BzmMarkdown` (KaTeX)。

## 最新セッション要約 (2026-05-29)

- 既存 10 章すべてに **例題・導出・章末まとめ・練習問題** を追加し教科書品質に増補 (詳細は `design_log/sessions_2026-05.md` の 2026-05-29 エントリ)。
- 5-1 練習問題 #1 の誤問 (再現不能) を自己完結な計算問題に修正。
- 6-1 retrofit 表の整合性問題を発見・透明性ノート追記 → **まさの A/B 判断待ち** (下記)。
- commit `de97c62` → `f35c2b3`、push 済。BUILD_VERSION v0.10.4。deploy 成功 (`byvyl0ye3`)。

## リポ状態

- branch: `feat/bzm-textbook`、未 push commit なし (HEAD `f35c2b3`)。
- 作業ツリーは他セッションの dirty を多数含む (gas/ design/ manual/ payment-confirm 等)。**`git add .` / broad revert 禁止**。BZM 作業は `pwa/bzm/*.md` + `build-info.ts` のみ個別 stage。

## ⚠️ 未解決: まさの A/B 判断待ち (最優先で聞く)

6-1 retrofit 表の headline score 列が各軸値から再計算できない行が複数ある (2009/2011/2012-10/2014)。表値=専門家事前情報による期待値 (theory 正本 §335-358 で確認済)。どちらで運用するか:

- **A**: 全行を軸値から AMD Score 数式で再計算し自己整合させる (headline 数値が変わる)。
- **B (暫定採用中)**: 期待値のまま、本文の透明性ノートで「表値=期待値であり軸値からの計算結果ではない」と明示して運用。

詳細は `BUGS.md` の `[bzm/retrofit-table-inconsistency]`。

## 未解決タスク (順番はまさに一任、指定なければ #3 から自走)

- #2 (in_progress): 本の完全目次 + 論文構成 (IMRaD) の対応設計。
- **#3 (next default): 巻末3点セット新設 — 統合参考文献・記号一覧・用語集。**
- #4: ERS 全8軸 rubric を付録化 + theory 参照を本文に取り込み自己完結化。
- #5: 図版方針確定 (二層構造図・状態空間螺旋・ERS レーダー等)。⚠️ 画像生成 MCP は手元に無い → 本物の図が要るなら外部生成して `pwa/public/` 配置。SVG/CSS で誤魔化さない (AGENTS ルール)。
- #6: 論文ドラフト骨子 (国内ベンチャー学会向け・日本語・IMRaD)。

## 次セッションの最初の一手

1. まさに 6-1 retrofit 表の A/B を確認。
2. 指定がなければ #3 (巻末3点セット) から着手。

## ポインタ

- 正本コンテンツ: `pwa/bzm/*.md`
- AMD Score / theory 正本: `before-zero/theory/amd_score.md`、`pwa/design/amd_score.md`
- セッション詳細: `pwa/design_log/sessions_2026-05.md` (2026-05-29)
- バグ・教訓: `pwa/BUGS.md` (`[bzm/retrofit-table-inconsistency]`)
- deploy: `bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh` (直 `npx vercel` 禁止)、deploy 前に必ず BUILD_VERSION bump。
