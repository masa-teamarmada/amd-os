# HANDOFF — BZM 教科書 / AMD Score モデルワークストリーム

> 最終更新: 2026-05-30 (#101) / トピック: **FRL を 資質 F_character × 経営実行力 F_capability の CES 補完合成に再設計 → 教科書/正本/DB/コード/本番 deploy まで一気通貫完了**。
> ⚠️ payment-confirm の引き継ぎは別ファイル `HANDOFF_pwa_rebuild.md` (codex 正本)。混ぜない。
> 🚨 **モデル議論の正本は `/Users/masa/projects/knowledge/before_zero_theory.md`** (monorepo 外)。経営知識・モデル議論を `pwa/design/` に書くのは AGENTS.common 違反。各PJ=`knowledge/{pj}.md`、XRL/F_cap rubric=`knowledge/xrl_rubric.md`。
> 📊 グラフは **matplotlib** で統一 (memory `feedback_graphs_matplotlib`)。

## このワークストリームの目的

BZM (Before Zero Model) を **学会発表・論文化まで見据えた厳密版** にする。Web 教科書 (`pwa/bzm/*.md`) + アカデミック論文 (JASVE向け) を並行育成。モデル定義の議論正本は `knowledge/before_zero_theory.md` (monorepo外)。本番実装は AMD Score (`pwa/src/lib/amd-score.ts` + venture-map/amd-score ページ)。

## 直近セッション要約 (#101) — FRL 2 レイヤー化 (CES)

詳細は [design_log/sessions_2026-05.md](design_log/sessions_2026-05.md) の「#101」エントリ。要点:

- **FRL = CES(F_character, F_capability)** に再設計。F_character (資質・委譲不可=既存`frl`) × F_capability (経営実行力・CxO/AMDで補完可=新`frl_cap`)。合成は **CES ρ<0 (補完性)**=「どちらか一定以下なら FRL 大崩れ」(まさ確定)。Cobb-Douglas では作れないので CES 導入。**S 全体は Cobb-Douglas、FRL 内部だけ CES** の二層。初期 a=0.6/ρ=-2/α_F=1.5据置 (retrofit 校正待ち)。
- **AMD 価値の定量化** (まさ着眼の本丸): `frl_cap_amd` で `F_cap(全員) − F_cap(AMD除く)` = AMD が経営 readiness を押し上げた分。
- 実装完了: migration 110 (本番適用済) / `computeFrlCES` + `resolveFrl` / List・Retrofit・Cyberspace 配線 / F_cap 9PJ 初期投入 (えいみ推測) / 設計正本4ファイル更新。tsc・build・deploy 成功。

## リポ状態

- **branch: `main` 直運用**。今セッションの commit はすべて push 済 (最終 `6f6ce43`)。未 push なし。
- 作業ツリー: FRL 関連は全 commit 済で clean。他セッションの dirty (spec/ 等) が残るが本ワークストリーム外。**`git add .` 禁止、対象のみ個別 add**。
- 本番: v0.12.x deploy 済 (FRL CES 反映)。F_cap=NULL の PJ は従来挙動 (後方互換) なので既存スコアは不変。

## 次セッションの最初の一手

**【最重要】AMD の提供価値の定量評価 (`frl_cap_amd`) を埋める** ← まさが特に重視。
- 今回 `project_founding_members` に AMD メンバー (category='amd') が `status='active'` で居らず算出不能 → 全 PJ で `frl_cap_amd` は NULL のまま。
- やること: (1) AMD メンバーを founding_members に紐付ける整理 (category='amd' が active 化されてない問題の解消)、(2) `F_cap_amd = F_cap(全員) − F_cap(AMD抜きのbest-of)` を各 PJ に投入。特に CTB(p06)/CryoX(p20)/SX(p21) は AMD 伴走が濃いので寄与が大きいはず。
- 設計は `knowledge/before_zero_theory.md`「FRL を F_char × F_cap に分離」§AMD価値、rubric は `knowledge/xrl_rubric.md` の F_cap セクション参照。

**その後の FRL 校正・UI タスク**:
- CES の a/ρ を 9PJ retrofit で校正 (a=0.6/ρ=-2 は仮置き)。
- F_cap を全 PJ の経時各点に展開 (今回は最新行のみ)。まさが画面で F_cap を修正する運用 (XRL チェックリストと同じ、Tsukuyomi 不使用)。
- **F_cap 編集 UI**: スコア詳細ページ (`AmdScoreView.tsx` の FrlAlqPanel 近辺) に F_capability スライダー + notes を追加。

**並行して残る UI 整理タスク (前セッションからの持ち越し)**:
- #1 スコア詳細ページの HUD版汚染を分離 (現状UIを HUD版に移し、通常版を実装)。対象 `venture-map/amd-score/[projectId]/page.tsx` + `AmdScoreView.tsx`。
- #2 スコア詳細をコックピットに移植 (タブ化)。上部に AMDスコア+XRLグラフ常時表示、下を「進捗管理」「スコア詳細」2タブ。スコア内訳モーダル廃止。対象 `CockpitVentureStatus.tsx` + `CockpitAmdScoreBreakdownModal.tsx`。
- P・収益化指数 (R_net) を本番 AMD Score に2軸追加 (`amd-score.ts`)。重み αP/αR_net 校正。論文/教科書に P×R×S 反映。

## ポインタ

- **モデル議論の正本** ⭐⭐⭐: `/Users/masa/projects/knowledge/before_zero_theory.md`
- **XRL/F_cap 判定 rubric**: `/Users/masa/projects/knowledge/xrl_rubric.md` (XRL 実装版は `src/lib/xrl-level-definitions.ts` が正)
- 各PJ固有 (P/R_net生データ含む): `/Users/masa/projects/knowledge/{tiem,LST,ctb,jc,BWE,KT,yd,cx,sx}.md`
- AMD Score 実装: `pwa/src/lib/amd-score.ts` (`computeFrlCES`) / `amd-score-derived.ts` (`resolveFrl`) / `amd-score-data.ts`
- 教科書 FRL: `pwa/bzm/4-1-frl-founder-readiness.md` §4 / マニュアル: `pwa/manual/4-4-frl-related-members-score-spec.md`
- AMD Score 設計: `pwa/design/amd_score.md` / 理論正本: `/Users/masa/projects/AMD/before-zero/theory/amd_score.md`
- セッション詳細: `pwa/design_log/sessions_2026-05.md` / バグ・教訓: `pwa/BUGS.md`
- deploy: `bash pwa/scripts/deploy.sh` (直 npx vercel 禁止)、deploy 前に BUILD_VERSION bump。DDL: `python3 -X utf8 scripts/apply_ddl.py scripts/migrations/NNN.sql`。
