# HANDOFF — BZM 教科書 / AMD Score モデルワークストリーム

> 最終更新: 2026-05-31 (Codex/eimi) / トピック: **FRL_cap_amd first pass。active/current PJ 3件に反映、CTBはfrozenのためAMD activeなしに補正**。
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

## 直近セッション要約 (2026-05-31) — FRL_cap_amd first pass

- live DB で `project_founding_members.status` 実値を確認: `active` / `tentative` / `invalid` / `left`。対象9PJでは `category='amd' AND status='active'` が0件だった。
- 算定式は `frl_cap_amd = F_cap(全員) - F_cap(AMD抜き)`。`status='active'` + 実意思決定/PM/資金調達/事業計画へのコミットで見る。HRL と違い、F_cap では VC/シリアルアントレ等も算定候補。
- migration 111 で active/current row に first pass を入れた後、まさ指示「CTBもfrozenだし、amd activeは無し」で migration 112 を追加。p06 CTB は `frl_cap=3`, `frl_cap_amd=0`, AMD row は `left` に補正。active/current 反映は p07 LST / p20 CX / p21 SX の3件。

| PJ | F_cap(全員)案 | F_cap(AMD抜き)案 | `frl_cap_amd`案 | DB反映 | AMD紐付け |
|---|---:|---:|---:|---|---|
| p03 tiem | 2 | 2 | 0 | 未反映 | AMD設立前。紐付けなし |
| p04 KT | 5 | 4 | 1 | 保留 | まさ=COO/体制構築候補。ただし current row はAMD関与終了後なので timeline化して反映 |
| p06 CTB | 3 | 3 | 0 | migration 112 | frozen。AMD activeなし (`まさ` row は left) |
| p07 LST | 6 | 5 | 1 | migration 111 | まさ=COO/CEO据付/体制構築を active 化 |
| p09 JC | 3 | 2 | 1 | 保留 | まさ/うめ/きよ候補。ただし AMD関与終結 row なので timeline化して反映 |
| p11 BWE | 3 | 2 | 1 | 保留 | まさ候補。ただし 2026-04-30 退任/移譲 row なので timeline化して反映 |
| p18 YD | 2 | 2 | 0 | 未反映 | 資金調達サポートのみで押し上げ無し案 |
| p20 CX | 5 | 3 | 2 | migration 111 | まさ/あき/きよ/りりを active 化 |
| p21 SX | 4 | 3 | 1 | migration 111 | まさ/かる/ちこ/きよを active 化 |

次の一手: ended PJ (p04/p09/p11) は「現在の active state」ではなく、AMD関与時点の `amd_score_inputs` row を追加/選定して `frl_cap_amd` を入れる。p07/p20/p21 は今後 F_cap 編集 UI でまさ修正できるようにする。p06 CTB は frozen 中なので current active AMD 寄与は 0 のまま扱う。

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
