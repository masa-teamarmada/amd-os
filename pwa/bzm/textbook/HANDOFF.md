# HANDOFF — BZM教科書 (章頭ストーリー型)

> Last updated: 2026-06-13 / セッション topic: 教科書を章頭ストーリー型へ全面差し替え + 全16章を本番公開

## このセッションの要約

`/bzm` の教科書を「ナラティブ一本線」から **章頭ストーリー型** (冒頭ストーリー → 解説=メイン(数式・図を章内) → 匿名化実例 → 章末の問い) へ全面差し替え、**全16章を本番公開** (v0.19.4)。PRS×戦略余力モデル (2026-06-12 確立) に沿った内容で、worker 10本並列で14章を量産、序章は司令塔直書き。詳細は [`design_log/sessions_2026-06.md`](../../design_log/sessions_2026-06.md) の 2026-06-13 エントリ。

## リポ状態
- HEAD = `212a5729` (origin/main と完全同期、未push・未commit ゼロ)
- 本番 = v0.19.4 / git_sha 212a5729 一致確認済
- 旧教科書24章 → `pwa/bzm/legacy/` (退避・git保全)、旧ナラティブ26章 → `/bzm/public` で閲覧継続

## 本の構成 (正本 = `pwa/bzm/*.md` + 目次 `src/app/(app)/bzm/bzm-chapters.ts`)
- 序章: `preface`
- 第I部 現場: `field-before-zero` / `field-clocks` / `field-gates` / `field-who-carries` (数式なし)
- 第II部 Before Zero Model: `why-valuation-fails` / `model-overview` / `p-potential` / `r-readiness` / `s-survival` / `score-and-bottleneck` / `strategic-slack` / `model-critiques` / `retrofit-verification`
- 第III部 苗床: `nursery-ers`
- 第IV部 ツールキット: `field-toolkit`
- 巻末: `9-5-appendix-changelog`

## 未解決タスク (次セッション、優先順)
1. **概念図系の図版** — 二層アーキテクチャ / 進化系譜 / 三因子概念図など。matplotlib(ポンチ絵)か外部画像生成かは**まさ判断待ち**。各章本文に `> 図版 TODO` プレースホルダ多数。データ図 (f6-f9) は `pwa/scripts/bzm_figures.py` 方式で生成済み。
2. **通し編集** — 序章→巻末の cold-reader (章間重複・接続・用語ゆれ)。
3. **巻末資料の再構築** — 参考文献・記号・用語。料率相場の出典確定 (`strategic-slack.md` / `p-potential.md` 内の「出典注 TODO」)。
4. **D-7 Textbook Insights 受け皿再設計** — 新教科書向けの追記先章。現状は applier が `pwa/bzm/legacy/` へ fallback する暫定 (`spec/3-13` 注記)。
5. **出版パッケージ** — タイトル確定・組版・出典固め。

## 最初の次アクション
まさに図版の生成方法 (matplotlib ポンチ絵 / 外部画像生成) を確認 → 決まったら概念図を作って各章の `> 図版 TODO` を置換。並行で通し編集の cold-reader worker を立てられる。

## ポインタ
- 出版方針・章型・匿名化ルール: [`PUBLICATION_STRATEGY.md`](PUBLICATION_STRATEGY.md) §0 / [`PUBLICATION_POSITIONING.md`](PUBLICATION_POSITIONING.md)
- まさ直出し思想 (生存確率と稼げる体質 / KPIを交渉力に置く): [`AUTHOR_DIRECTIVES.md`](AUTHOR_DIRECTIVES.md)
- 司令塔タスク台帳: [`COMMANDER_TASKS.md`](COMMANDER_TASKS.md)
- 理論正本 (PRS×戦略余力): `BZSF/before_zero_theory.md` + `BZSF/PRS_STRATEGIC_SLACK_OVERVIEW_20260612.html` (モデル議論は Before Zero Model discussion セッション側)
- 交渉セオリー正本: `knowledge/license_negotiation.md`
- 変更履歴: [`../9-5-appendix-changelog.md`](../9-5-appendix-changelog.md)

## 運用ルール (このリポ)
- main 一本 (ブランチ作成禁止)。commit したら即 push。
- deploy = `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` (main push = Vercel自動build)。原則ノンストップ・事後報告。
- md push でも critical-ui guard が走る: **丸数字 (circled number) は禁止** ((N) で書く)。
- 章を追加したら `bzm-chapters.ts` の BZM_PARTS / BZM_CHAPTERS に同 commit で登録 (未登録だと左ナビに出ない)。
- 公開本文に禁止語 (AMD / まさ / 内部運用語 / 実名 PJ) を入れない。事例は匿名化必須。
