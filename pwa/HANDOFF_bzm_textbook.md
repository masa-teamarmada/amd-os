# HANDOFF — BZM 教科書ワークストリーム

> 最終更新: 2026-05-30 (後半3) / トピック: **XRL判定を内閣府SIP原典準拠に刷新+観測チェックリストUIをスコア詳細ページに実装、全11PJ初期投入完了**。次は UI 構造の整理 (#1 HUD汚染分離 / #2 コックピット移植)。
> ⚠️ payment-confirm の引き継ぎは別ファイル `HANDOFF_pwa_rebuild.md` (codex 正本)。混ぜない。
> 🚨 **モデル議論の正本は `/Users/masa/projects/knowledge/before_zero_theory.md`** (monorepo 外)。経営知識・モデル議論を `pwa/design/` に書くのは AGENTS.common 違反。ティエム=`knowledge/tiem.md`、各PJ=`knowledge/{pj}.md`、XRL rubric=`knowledge/xrl_rubric.md`。
> 📊 グラフは **matplotlib** で統一 (memory `feedback_graphs_matplotlib`)。

## このワークストリームの目的

BZM (Before Zero Model) を **学会発表・論文化まで見据えた厳密版** にする。Web 教科書 (`pwa/bzm/*.md`) + アカデミック論文 (JASVE向け) を並行育成。**モデル定義の議論正本は `knowledge/before_zero_theory.md` (monorepo外)**。本番実装は AMD Score (`pwa/src/lib/amd-score.ts` + venture-map/amd-score ページ)。

## 直近セッション要約 (2026-05-30 後半3)

詳細は [design_log/sessions_2026-05.md](design_log/sessions_2026-05.md) の「#99 後半」エントリ。要点:

- **収益化指数 (R_net) 確定**: 旧「ライスワーク実益/RW」廃止。系統I(つなぎ)/II(本命先行収益)を**区別しない**=事業が生む純キャッシュ貢献。生存条件式 `B−R_net≤F`。
- **全9PJのP/R_net/XRL収集**(L2+Web+口述、捏造なし)。`knowledge/LST.md`新規。9PJ横断retrofitスクリプト [prxs_9pj_inputs.py](scripts/prxs_9pj_inputs.py)。
- **XRL判定を内閣府SIP原典準拠に刷新** (本セッション主成果):
  - 原典PDF(内閣府SIP2023公募要領 図2-6)に完全準拠で [xrl-level-definitions.ts](src/lib/xrl-level-definitions.ts) 書換え。**TRL/BRL=9段階, GRL/SRL/HRL=8段階**。各レベルに観測 `checklist[]`。
  - `amd_score_inputs.xrl_checklist` (JSONB, migration 109) 追加。
  - スコア詳細ページに [XrlChecklistPanel.tsx](src/components/venture-map/XrlChecklistPanel.tsx) 設置。チェック→達成レベル自動算出(積み上げ式)→保存。運用=えいみ初期入力→まさ修正(Tsukuyomi不使用)。
  - 全11PJ初期投入済 ([seed_xrl_checklist.mjs](scripts/seed_xrl_checklist.mjs))。まさ確認「現実との乖離は意外と少ない」。

## リポ状態

- **branch: `main` 直運用**。今セッションの commit はすべて push 済 (最終 `44a904d`)。未 push なし。
- 作業ツリー dirty: `build-info.ts` (v0.11.4 へ別更新、要 commit) / `public/bzm/_prxs_9pj.png` (検証用図、配信外)。**`git add .` 禁止、対象のみ個別 add**。
- 本番: v0.11.3 deploy 済 (XRLチェックリスト反映)。次 deploy で build-info v0.11.4 反映。

## 次セッションの最初の一手 (まさ指示の UI 整理が最優先)

**#1 スコア詳細ページの HUD版汚染を分離**
- 現状のスコア詳細ページ UI が HUD版に汚染されている。現状UIは **HUD版側に新たに設置**した上で、**通常版のスコア詳細ページを実装**する。
- 対象: `src/app/(app)/venture-map/amd-score/[projectId]/page.tsx` + `AmdScoreView.tsx`、HUD系 (`/hud/dashboard` 等) を確認。

**#2 スコア詳細をコックピットに移植 (タブ化)**
- 現状スコア詳細はコックピットと別ページ → **コックピット内に移植**。
- コックピット上部の **AMDスコアグラフ + XRLグラフだけ常時表示**にし、それより下を「**進捗管理**」「**スコア詳細**」の2タブに分ける。
- 現状表示中のものは「進捗管理」タブへ。「スコア詳細」タブにスコア詳細ページの中身を**全部移植**。
- スコアクリックで出る「スコア内訳」モーダルは **完全廃止**でOK。
- 対象: `src/components/cockpit/CockpitVentureStatus.tsx` + スコア内訳モーダル (`CockpitAmdScoreBreakdownModal.tsx`)。

**その後 (モデル校正フェーズ)**
3. まさが各PJのXRLチェックリストを画面で修正 (初期投入はえいみ案)。特に GRL/SRL が旧定義で高めに出てる PJ (CTB GRL8, BWE GRL8/SRL7 等) を原典準拠で見直し。
4. P・収益化指数を本番 AMD Score に2軸追加 (`amd-score.ts`)。重み αP/α収益化指数 の校正。多元スケール=スケールごとに α を変える方針 (まさ)。
5. 論文/教科書側に P×R×S・収益化指数・原典準拠XRL を反映。

## ポインタ

- **モデル議論の正本** ⭐⭐⭐: `/Users/masa/projects/knowledge/before_zero_theory.md`
- **XRL判定 rubric (議論用)**: `/Users/masa/projects/knowledge/xrl_rubric.md` (実装版は `src/lib/xrl-level-definitions.ts` が正)
- 各PJ固有 (P/R_net生データ含む): `/Users/masa/projects/knowledge/{tiem,LST,ctb,jc,BWE,KT,yd,cx,sx}.md`
- XRL原典: 共有ドライブ `ARMADA/a1_all/データベース/XRLの元文献.pdf` (内閣府SIP2023公募要領 図2-6)
- AMD Score 実装仕様: `pwa/design/amd_score.md` / 理論正本: `/Users/masa/projects/AMD/before-zero/theory/amd_score.md`
- 教科書: `pwa/bzm/*.md` / 論文: `pwa/design/bzm_paper_draft.md` / 図: `pwa/scripts/bzm_figures.py`
- セッション詳細: `pwa/design_log/sessions_2026-05.md` / バグ: `pwa/BUGS.md`
- deploy: `bash pwa/scripts/deploy.sh` (直 npx vercel 禁止)、deploy 前に BUILD_VERSION bump。DDL: `python3 -X utf8 scripts/apply_ddl.py scripts/migrations/NNN.sql`。
