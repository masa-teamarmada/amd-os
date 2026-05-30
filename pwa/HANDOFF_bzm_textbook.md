# HANDOFF — BZM 教科書ワークストリーム

> 最終更新: 2026-05-30 / トピック: データ図 F1/F2/F4/F5 生成・教科書4章＋論文ドラフトへ埋め込み・v0.10.7 デプロイ。次は F3＋概念図 G1/G3＋論文本文の精緻化。
> ⚠️ payment-confirm の引き継ぎは別ファイル `HANDOFF_pwa_rebuild.md` (codex 正本)。混ぜない。

## このワークストリームの目的

BZM (Before Zero Model) を **学会発表・論文化まで見据えた厳密版** にする。Web 教科書 (`pwa/bzm/*.md`, 全14章) とアカデミック論文 (国内ベンチャー学会 / JASVE 向け・日本語・IMRaD) を **並行育成**。コンテンツ正本は `pwa/bzm/*.md`、ページ実装 `pwa/src/app/(app)/bzm/`、レンダラ `BzmMarkdown` (KaTeX + `img`)。

## 最新セッション要約 (2026-05-30 後半)

- **データ図 F1/F2/F4/F5 を matplotlib で生成** (`pwa/scripts/bzm_figures.py`、`pwa/public/bzm/f{1,2,4,5}.png`)。F1=σ_SU シフト幾何平均 vs min 律、F2=複素固有値の減衰螺旋、F4=ERS 8軸レーダー (例題7-1)、F5=軸別限界感度と律速軸。**F3 (retrofit 時系列) は実データ確定待ちでスキップ** (= 捏造を避ける)。
- **教科書4章＋論文ドラフトへ図埋め込み**: 2-1 (図2-1/F1)、2-2 (図2-2/F2)、5-1 (図5-1/F5)、7-1 (図7-1/F4)、`pwa/design/bzm_paper_draft.md` (図1〜4)。`/bzm/*.png` は middleware matcher で auth 除外済 → 静的配信される。
- **図はデータ可視化であり画像生成ごまかしではない** (数式・実データからの matplotlib プロット)。AGENTS 「画像生成ごまかし禁止」は概念図 (G1/G3) に適用、データ図 (F系) はコード生成 OK と `design/bzm_paper.md` §3 で切り分け済。
- BUILD_VERSION **v0.10.7**、deploy.sh で本番反映成功 (2分59秒)。
- **before-zero/ 正本場所の誤認を修正**: 理論正本 `before-zero/theory/*.md` は実在 (= monorepo の外 `/Users/masa/projects/AMD/before-zero/theory/`、`amd-os/` と兄弟)。要約に「存在しない」と誤情報が刷り込まれ毎セッション誤認していた → メモリ `feedback_read_full_theory_md.md` に場所を固定。
- ⚠️ **巻き込みコミット事故**: 上記 figure チャンク 11 ファイルが別セッションの `481113f` (cockpit 修正) に混入して push 済み。内容欠損なし・本番反映済みで実害なし、履歴は放置。詳細 `BUGS.md [git/cross-session-bundling]`。

### 前セッション (2026-05-30 前半 / 2026-05-29)

- 巻末資料 9-1〜9-4 新設、6-1 透明性ノート論文水準化、論文化設計 `design/bzm_paper.md` 新設 (教科書14章×IMRaD対応・JASVE骨子・図版方針)。論文本文ドラフト `design/bzm_paper_draft.md` 起稿 (IMRaD全節)。詳細 `design_log/sessions_2026-05.md`。
- 10章すべてに例題・導出・章末まとめ・練習問題を追加し教科書品質に増補。

## リポ状態

- branch: `feat/bzm-textbook`、未 push commit なし (origin と up to date)。HEAD `481113f`。
- 作業ツリーは他セッションの dirty を多数含む (gas/ design/ manual/ payment-confirm 等)。**`git add .` / broad revert 禁止**。BZM 作業は対象ファイルのみ個別 stage → 即 push (= 巻き込み事故の再発防止)。

## ✅ 完了タスク

- #1〜#6 (6-1透明性ノート / 巻末3点 / IMRaD対応 / ERS付録 / 図版方針 / 論文骨子) ✅
- #7 データ図 F1〜F5 生成 ✅ (F3 のみ実データ待ちで保留)

## 次セッションの最初の一手 (論文本文フェーズ)

教科書 (全14章) は学会発表水準、データ図も4枚埋め込み済み。次の残件:

1. **F3 (retrofit 時系列図)**: ティエム等の retrofit 実データが確定したら matplotlib で生成 → `pwa/public/bzm/f3_*.png` → 6-1 と論文 §4 に埋め込む。数値が固まるまで作らない (= 捏造回避)。
2. **概念図 G1 (二層構造フロー) / G3 (Triple Helix 螺旋) は外部生成依頼** (まさ)。⚠️ 画像生成 MCP 手元に無い → SVG/CSS でごまかさない (AGENTS ルール)。まさが ChatGPT/Imagen 等で生成 → PNG をくれれば `pwa/public/bzm/` 配置。
3. **先行研究の文中引用を精緻化** (`design/bzm_paper_draft.md` §2)。教科書は「著者(年)」止まり、論文は主張ごとに厳密化。
4. **論文本文 (`bzm_paper_draft.md`) の査読前ブラッシュ**: 限界4点・考察・付録ABC の詰め。

詳細はすべて `design/bzm_paper.md` を参照。

## ポインタ

- 正本コンテンツ (教科書 全14章): `pwa/bzm/*.md`
- 論文化設計 (IMRaD対応・骨子・図版方針): `pwa/design/bzm_paper.md` ⭐
- 論文本文ドラフト (日本語IMRaD): `pwa/design/bzm_paper_draft.md`
- データ図ジェネレータ: `pwa/scripts/bzm_figures.py` → `pwa/public/bzm/f{1,2,4,5}.png`
- AMD Score / theory 正本: `/Users/masa/projects/AMD/before-zero/theory/amd_score.md` (= monorepo の**外**)、`pwa/design/amd_score.md`、`pwa/design/institution_readiness.md`
- セッション詳細: `pwa/design_log/sessions_2026-05.md`
- バグ・教訓: `pwa/BUGS.md` (`[git/cross-session-bundling]` / `[bzm/retrofit-table-inconsistency]`)
- deploy: `bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh` (直 `npx vercel` 禁止)、deploy 前に必ず BUILD_VERSION bump。
