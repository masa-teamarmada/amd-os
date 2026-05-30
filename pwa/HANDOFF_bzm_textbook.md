# HANDOFF — BZM 教科書ワークストリーム

> 最終更新: 2026-05-30 (後半4) / トピック: **FRL を 資質 F_character × 経営実行力 F_capability の CES 補完合成に再設計 → 本番実装 → deploy 完了 (v0.11.5)**。前半3トピック (XRL原典準拠+チェックリストUI) は完了済。次は UI 構造の整理 (#1 HUD汚染分離 / #2 コックピット移植) と FRL 校正。
> ⚠️ payment-confirm の引き継ぎは別ファイル `HANDOFF_pwa_rebuild.md` (codex 正本)。混ぜない。
> 🚨 **モデル議論の正本は `/Users/masa/projects/knowledge/before_zero_theory.md`** (monorepo 外)。経営知識・モデル議論を `pwa/design/` に書くのは AGENTS.common 違反。ティエム=`knowledge/tiem.md`、各PJ=`knowledge/{pj}.md`、XRL rubric=`knowledge/xrl_rubric.md`。
> 📊 グラフは **matplotlib** で統一 (memory `feedback_graphs_matplotlib`)。

## このワークストリームの目的

BZM (Before Zero Model) を **学会発表・論文化まで見据えた厳密版** にする。Web 教科書 (`pwa/bzm/*.md`) + アカデミック論文 (JASVE向け) を並行育成。**モデル定義の議論正本は `knowledge/before_zero_theory.md` (monorepo外)**。本番実装は AMD Score (`pwa/src/lib/amd-score.ts` + venture-map/amd-score ページ)。

## 直近セッション要約 (2026-05-30 後半4) — FRL 2 レイヤー化 (CES)

まさ問題提起「FRL に経営の知識・経験も入れるべき (知識軽・経験重)。ただし CEO 本人でなく COO 等 CxO が補完してもよい」を反映。FRL を 2 レイヤーに分離:

- **F_character** (資質・委譲不可) = 既存 6 因子 (ALQ4 + Grit + Resilience) = 既存 `frl` 列
- **F_capability** (経営実行力・CxO/AMD で補完可) = 経験 ≫ 知識 = 新 `frl_cap` 列
- 合成は **CES (補完性 ρ<0)**: 「どちらかが一定以下なら FRL 大崩れ」(まさ確定)。Cobb-Douglas の代替性では作れないので CES 導入 (理論 §1/§14-5 が予告していた拡張の初適用)。**S 全体は Cobb-Douglas のまま、FRL 内部だけ CES** の二層。初期 a=0.6 / ρ=-2 / α_F=1.5 据置 (retrofit 校正待ち)。
- **AMD 価値の定量化**: `frl_cap_amd` (AMD メンバー寄与分) で `F_cap(全員) − F_cap(AMD除く)` = AMD 提供価値。

実施 (すべて push/deploy 済):
1. 設計正本: `knowledge/before_zero_theory.md` (新セクション+残論点「S内部構造」解決) / `pwa/bzm/4-1-frl-founder-readiness.md` §4 全面改稿 / `pwa/manual/4-4` / `knowledge/xrl_rubric.md` (F_char/F_cap 2 rubric)
2. migration 110 (本番適用済): `amd_score_inputs` に `frl_cap` / `frl_cap_amd` / `frl_cap_notes` / `frl_ces_a` / `frl_ces_rho` 追加
3. `amd-score.ts`: `computeFrlCES(fChar, fCap, a, rho)` 追加 (ρ≈0 で Cobb-Douglas フォールバック)。`amd-score-derived.ts`: `resolveFrl(row)` 追加 (frl_cap あれば CES、なければ frl=後方互換)。List/Retrofit/Cyberspace を resolveFrl 経由に統一
4. **F_cap 9PJ 初期投入済** (えいみ推測、`project_founding_members`+knowledge md ベース)。CES 検算 OK (例: p03 ティエム F_char 4.0 → 経営経験乏しい F_cap 2.0 → FRL 2.82 に低下、まさの意図どおり)
5. v0.11.5 deploy 完了、本番疎通確認済

⚠️ **次セッションがやる FRL 校正タスク**:
- **CES の a / ρ を 9PJ retrofit で校正** (a=0.6/ρ=-2 は仮置き)
- **frl_cap_amd の投入**: 今回は founding_members に AMD メンバー (category='amd') が approved で居らず算出不能 → 全 NULL (notes に「要精査」明記)。AMD メンバーを founding_members に追加 or 別途取得して F_cap_amd を埋める
- **F_cap を全 PJ の経時各点に展開** (今回は最新行のみ)。まさが画面で各 F_cap を修正する運用 (XRL チェックリストと同じ、Tsukuyomi 不使用)
- **F_cap 編集 UI**: 現状 F_cap を画面から編集する UI が未実装。スコア詳細ページ (FrlAlqPanel 近辺) に F_capability スライダー+notes を追加するのが次の UI タスク

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
