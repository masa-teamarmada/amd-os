# HANDOFF — BZM 教科書 / モデルワークストリーム

> 最終更新: 2026-08-20 JST (Fable/えいみ) / トピック: **SPS 2.0 領域定義 §7/§8 に Fund I プロ投資家限定の前提更新を追記**
> ⚠️ payment-confirm の引き継ぎは別ファイル `HANDOFF_pwa_rebuild.md` (別ワークストリーム、混ぜない)。
> 🚨 **モデル議論の正本は monorepo 内 `pwa/bzm/` 配下**。旧記述にあった `/Users/masa/projects/knowledge/before_zero_theory.md` は現存しない (2026-08-20 確認、削除済みか移設済みで詳細未確認)。各PJ知識は `/Users/masa/projects/knowledge/{pj}.md`、XRL/F_cap rubric は `/Users/masa/projects/knowledge/xrl_rubric.md`。
> 📊 グラフは **matplotlib** で統一 (memory `feedback_graphs_matplotlib`)。

## このワークストリームの目的

BZM (Before Zero Model) を学会発表・論文化まで見据えた厳密版にする。Web 教科書 (`pwa/bzm/*.md`) + アカデミック論文を並行育成。本番実装は AMD Score (`pwa/src/lib/amd-score.ts` + venture-map/amd-score ページ)。

BZM 配下は複数のサブワークストリームに分岐しており、それぞれ専用の migration prompt を持つ。**このファイルは「BZM教科書」統合窓口だが、2026-05-31〜2026-08-20 の間は更新が止まっていた**。直近の実質的な変更履歴は `pwa/bzm/9-5-appendix-changelog.md` の日次エントリのほうが確実。

- モデル定義・数式: `pwa/bzm/SESSION_MIGRATION_PROMPT_BZM_MODEL_20260816.md` (最新、`_20260815.md` は前版)
- BZM コース (教材): `pwa/bzm/SESSION_MIGRATION_PROMPT_BZM_COURSE.md`
- Ch7 ワーカー closeout: `pwa/bzm/SESSION_MIGRATION_PROMPT_CH7_WORKER_CLOSE.md`
- 命名整理: `pwa/bzm/SESSION_MIGRATION_PROMPT_NAMING.md`
- ファンド設計 (BZSF、monorepo 外): `/Users/masa/projects/AMD/BZSF/` 配下 (直近は `SESSION_MIGRATION_PROMPT_BZSF_FUND_20260815.md` — パス未確認、着手前に `ls` で確認)

## 直近セッション概要 (2026-08-20)

まさから「設立前出資はプロ投資家限定に前提が変わったが、早期EXIT圧力はかけさせないルールで説明したうえで出資してもらう」という方針転換の共有を受け、`pwa/bzm/sps-2-0-domain-definition.md` §7/§8 へ追記した。

- §7 末尾に「追記（2026-08-20）— Fund I はプロ投資家限定で始まる」節を追加。
- §8 末尾に、圧力遮断の担保方法を「誘因の不在（投資家属性に非依存で不変）」と「経路の不在（受動的構造遮断→規約による明示遮断＋事前説明・同意へ書き直しが要る）」に分けて4段落追記。
- 既存本文は §9 の変更規律（既存本文は書き換えず追記方式）に従い一切書き換えていない。
- `pwa/bzm/9-5-appendix-changelog.md` に1行追記。
- `build-info.ts` の BUILD_VERSION を bump、commit `82d22b6d` として `deploy.sh` 経由で本番反映済み（v3.83.8。その後別セッション=SPS帯UI実装担当がv3.83.9へ進めたが無関係な並行作業）。

このセッションはコード・UI・DB 変更を伴わない理論・ファンド設計コンテンツの追記のみ。依頼は完結している。

## 過去セッション要約 (2026-05-31 時点、FRL 2レイヤー化 / CES) — アーカイブ

FRL = CES(F_character, F_capability) 化と `frl_cap_amd` (AMD価値の定量化) の実装は 2026-05 に完了・本番デプロイ済み (migration 110〜112)。9PJ 別の反映状況表など実装細部は `pwa/design_log/sessions_2026-05.md` の「#101」エントリと `git log -p pwa/HANDOFF_bzm_textbook.md` (旧版) を参照。

2026-05-31 時点で残っていた「次の一手」候補。**その後 3 ヶ月近く経過しており現在の有効性は未確認** — 着手前に `pwa/bzm/9-5-appendix-changelog.md` と AMD Score 実装を突き合わせて再確認すること:
- CES の a/ρ を 9PJ retrofit で校正 (a=0.6/ρ=-2 は仮置きのままの可能性)。
- F_cap 編集 UI (`AmdScoreView.tsx` の FrlAlqPanel 近辺) の実装状況。
- P・収益化指数 (R_net) を本番 AMD Score に統合する件の進捗。

## ポインタ

- 教科書 SPS 2.0 領域定義 (今回追記箇所): `pwa/bzm/sps-2-0-domain-definition.md` §7/§8
- 変更履歴: `pwa/bzm/9-5-appendix-changelog.md`
- モデルセッション直近状態: `pwa/bzm/SESSION_MIGRATION_PROMPT_BZM_MODEL_20260816.md`
- 教科書 FRL: `pwa/bzm/4-1-frl-founder-readiness.md` §4 / マニュアル: `pwa/manual/4-4-frl-related-members-score-spec.md`
- AMD Score 実装: `pwa/src/lib/amd-score.ts` (`computeFrlCES`) / `amd-score-derived.ts` (`resolveFrl`) / `amd-score-data.ts`
- AMD Score 設計: `pwa/design/amd_score.md`
- XRL/F_cap 判定 rubric: `/Users/masa/projects/knowledge/xrl_rubric.md` (実装版は `src/lib/xrl-level-definitions.ts`)
- 各PJ固有知識: `/Users/masa/projects/knowledge/{pj}.md`
- セッション詳細: `pwa/design_log/sessions_2026-05.md` / バグ・教訓: `pwa/BUGS.md`
- deploy: `bash pwa/scripts/deploy.sh` (直 npx vercel 禁止)、deploy 前に BUILD_VERSION bump。DDL: `python3 -X utf8 scripts/apply_ddl.py scripts/migrations/NNN.sql`。

## 未解決タスク

- 今回追記した「Fund I プロ投資家限定」の前提が BZSF 側のファンド仕様書と整合しているかは未確認。次回 BZSF 側作業時に突き合わせ推奨。
- FRL CES 校正 / F_cap 編集 UI / R_net 統合 (上記アーカイブ節参照) は 2026-05-31 時点で未完了。現在の状態は未確認。

## 次の一手

特になし。今回の依頼 (Fund I プロ投資家限定の前提追記) は完結済み。次にこのワークストリームへ触るセッションは、まず `pwa/bzm/9-5-appendix-changelog.md` の直近日付と該当する `SESSION_MIGRATION_PROMPT_BZM_*.md` を見て、どのサブワークストリームが最新かを把握してから着手する。
