# 理論・論文の材料の置き場 — 照合結果と移し先の案（2026-09-22）

> **状態**: 案。移動・削除はまさの承認後に行う。この文書を作る過程では何も動かしていない。
>
> **発端**: まさ 2026-09-22「BZSFはファンドのディレクトリでは。一緒にした方がいいか。その場合 before-zero は廃止した方がいい」。
>
> **対象**: A = `/Users/masa/projects/AMD/before-zero/`（5〜7月の旧理論プロジェクト。ローカルだけの記録で送り先なし、7/11 以降更新なし）、B = `/Users/masa/projects/AMD/BZSF/`（ファンドの器）、C = `/Users/masa/projects/AMD/amd-os/bzm/`（論文・理論・教科書の家。モデルの現行正本は `amd-os/model/MODEL_VERSION_LEDGER.md`）。
>
> **案**: 論文と理論は C、B は資金の話だけ、A は `AMD/_archive/before-zero_2026-07/` へ。

## 1. 要点

1. A の作業ファイル20本は、C（amd-os 全体）に完全一致の複製が1本も無い。
2. A の理論3本（状態空間モデル、事前分布、データ仕様）と8社の振り返りデータは、OSの画面の出典表示、定期処理とDB定義のコメント、現役の設計文書 `pwa/design/amd_score.md` が今も指している。この4本はアーカイブの対象から外し、C へ移して指し先を直す。
3. B の理論系（旧理論の議論記録、ラウンドテーブル理論、旧モデルの全体解説、因果図3点）は C に複製が無い。BZM 1.x〜2.x の履歴として C の `legacy/` へ。ラウンドテーブル理論は SOL の設計文書と互いに参照している。
4. 削除候補: 完全一致の重複（B の理論の再検証、因果図の片方の組）、C に新しい版がある旧版（A の人物名台帳）、論文の現在地の旧版（B の 9/21 版）。
5. 置き場の判断が要るもの: SU の参入障壁と開示の境界のメモ、学会の入会書類（個人情報を含む）。

## 2. ファイルごとの照合と移し先の案

判定の根拠は、sha256 による完全一致の確認と、見出し・式・用語の検索（読み取りのみ）。

### A: before-zero/

| ファイル | 何か | C への反映 | 案 | 移すときに直す参照 |
|---|---|---|---|---|
| `theory/state_space_model.md` | 状態空間モデル v3.2（5/5） | 未反映 | C `legacy/before-zero/theory/` | `pwa/src/lib/{state-space,kalman-bvar,triple-helix,triple-helix-observations}.ts`、`pwa/src/app/api/cron/*/route.ts`（5本）、`pwa/src/components/venture-map/{AmdScoreFormulaPanel,TripleHelixMatrix}.tsx`、`pwa/src/app/(app)/scholar/page.tsx`、migration 036・037・043 のコメント、`pwa/design/{amd_score,bzm_paper_draft,SPEC_pwa}.md`、`bzm/legacy/` の3本、`bzm/BOOK_A_CHAPTER_7_PROGRESS.md` |
| `theory/bvar_prior.md` | 事前分布の設計（5/5） | 係数の数値だけ migration 038 に転記済み。式と理由づけは未反映 | 同上 | migration 038・043、上と同じ設計文書・コード |
| `theory/data_specification.md` | 観測量の定義とデータ仕様（5/5〜6） | 未反映（観測量の名前だけ migration 038 に残る） | 同上 | `scholar/page.tsx`、cron 4本、migration 036・037・038 |
| `retrofit/su_timelines.ts` | 8社の振り返りデータ（5/6 の聞き取り） | 未反映。現行の案件ファイル `model/cases/` とは粒度が別 | C `legacy/before-zero/retrofit/` | `pwa/design/amd_score.md`（相対リンク）、`bzm/PAPER_P1_PROGRESS.md` |
| `theory/sem_diagrams/*.svg`（3点） | 因果図の初期案 | 未反映。B の同名3点と完全一致 | C へ1組だけ | 埋め込みの参照なし |
| `critique_logs/*.md`（4本） | 5〜6月の経済学者批判、既知の穴、聞き取りの発見、割引率の批判 | 要旨だけ上の理論と B の議論記録に吸収 | C `legacy/before-zero/critique_logs/` | B `before_zero_theory.md` の変更履歴が1本を出典として指す |
| `README.md`・`AGENTS.md`・`HANDOFF.md` | 旧プロジェクトの入口と引き継ぎ（HANDOFF は 6/25 に終了と移行先を宣言） | 履歴 | アーカイブ | なし |
| `papers/jp/*.html`（2本） | 旧7軸モデル時代の論文草稿の日本語版とやさしい解説版（7/3〜5） | 本文は現行の論文と別物 | アーカイブ | なし |
| `BOOK_A_CHARACTER_NAMES.md`（未記録） | 人物名台帳の 7/13 版 | C に 7/16 版があり、その C 版も 7/20 に失効 | 削除候補 | なし |
| `papers/jsrpim/*`（2本） | 学会の入会書類（個人情報を含むため中身は開いていない） | 対象外 | まさの判断 | なし |
| `.git` | ローカルの記録（2件、送り先なし） | — | アーカイブへ一緒に | — |

### B: BZSF/（理論・論文寄りのものだけ）

| ファイル | 何か | C への反映 | 案 | 移すときに直す参照 |
|---|---|---|---|---|
| `before_zero_theory.md` | BZM 1.x〜2.x の理論の議論記録（5/4〜7/20）。9軸のスコアは 8/15 に退役、3.0 は 8/24 にゼロから再構築 | 未反映 | C `legacy/` | `pwa/src/lib/amd-score.ts` のコメント、`pwa/design/amd_score.md`、C の6〜7月の文書多数（「理論正本」として）、`rt_roundtable_theory.md` |
| `rt_roundtable_theory.md` | ラウンドテーブル理論 v0.2（7/1〜2）。BZM 3.0 は「別の理論」として未統合 | 未反映 | C `legacy/`（3.0 へ取り込む意思があれば理論グラフの隣） | `AMD/SOL/SX_SIER_RT_DESIGN_20260701.md`（相互参照）、C の7月の文書 |
| `PRS_STRATEGIC_SLACK_OVERVIEW_20260612.html` | 旧モデルの全体解説（6/12） | 未反映 | C `legacy/` | C の6月の章（「理論正本」として） |
| `before_zero_theory_sem_v0.{1,2,3}.svg` | A の因果図と完全一致 | — | 削除候補 | なし |
| `BZM_THEORY_REAUDIT_2026-08-13.md` | C の同名ファイルと完全一致 | 反映済み | 削除候補 | なし |
| `PAPER1_DESIGN_STATUS_2026-09-21.md` | 論文の現在地の旧版 | `bzm/PAPER1_DESIGN_STATUS_2026-09-22.md` が置き換え | 削除候補 | なし |
| `DTSU_STSU_MOAT_DISCLOSURE_BOUNDARY_20260608.{md,docx}` | SU の参入障壁と、PoC・市場調査での開示の境界のメモ | 参照なし | まさの判断（`knowledge/` が近い） | なし |
| `BZSF_PREREGISTRATION_RULE_DRAFT_2026-08-16.md`・`BZSF_PARTICIPATORY_VALIDATION_CONCEPT_2026-08-15.md` | ファンドの配分規則と商品の構想 | — | B に残す | なし |
| 残りの `BZSF_*` ほか | 資金・法務・商品の文書 | — | B に残す | — |

## 3. 注意点

- `before_zero_theory.md` と `rt_roundtable_theory.md` は 9/14 17:33:37 に同じ秒で更新されている。SOL の文書名を EWIR から SIER へ差し替えた跡で、変更履歴に記載がなく、EWIR の表記も残る。理論の中身は変わっていない。B は記録の仕組みの外なので、誰が当てたかは確かめられない。
- OS の画面の出典表示（ベンチャーマップの式の説明、論文件数の画面）は `theory/state_space_model.md §4.1` のような短い書き方で、ファイルを移しても画面は壊れない。表示の文字列を新しい置き場に合わせるなら、画面の改修として別に行う。
- `pwa/design/amd_score.md` は、存在しない `before-zero/theory/amd_score.md` を理論正本として指している。今回の移動と関係なく、すでに切れている。
- 過去の作業日誌（`pwa/design_log/sessions_2026-05*.md`）は追記だけの記録なので書き換えない。5月の日誌には、この3本がリポジトリに無いため説明を自己完結の例で済ませた記録がある。

## 4. 承認後の手順（案）

1. C に `bzm/legacy/before-zero/` を作り、A の理論3本・振り返りデータ・批判の記録・因果図を移して記録に入れる
2. B の理論系3本を `bzm/legacy/` へ移す
3. 設計文書とコメントの指し先を直す（画面の表示文字列は別の改修）
4. 削除候補を消す
5. A の残り（入口文書、旧草稿、ローカルの記録）を `AMD/_archive/before-zero_2026-07/` へ
6. SOL の設計文書の参照を直す（SOL の作業と調整）
