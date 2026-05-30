# ドキュメント3層移行マップ

> **この章は何か**: 既存の `pwa/manual/`, `pwa/design/`, `pwa/bzm/`, `pwa/spec/` を、マニュアル / 設計書 / テキストブックの 3 層へ分け直すための作業台。移行完了までは、既存ファイルを消さず、章単位で正本の置き場所を切り替える。

## 分類ルール

| 層 | 書くもの | 書かないもの |
|---|---|---|
| マニュアル (`/manual`) | 使い方、画面の見方、月次オペ、運用者が何を押すか | DB列、API契約、cron実装詳細、数式導出 |
| 設計書 (`/spec`) | 確定実装仕様、route/API/DB/cron、状態遷移、判定ロジック、保全すべき業務導線 | ユーザー向け手順、理論導出、論文化メモ |
| テキストブック (`/bzm`) | Before Zero Model、数式導出、rubric導出、例題、参考文献 | PWA実装手順、運用UIの押し方 |

## 現行ファイルの衝突マップ

| 領域 | 現在の重複/衝突 | 移行先 | 優先度 |
|---|---|---|---|
| ドキュメント統制 | `pwa/spec/1-1-overview.md` は `pwa/design/` 廃止と言う一方、`pwa/AGENTS.md` / `pwa/CLAUDE.md` / `pwa/design/README.md` は `pwa/design/` を設計正本として読む | `pwa/spec/1-1`, 本章, `pwa/AGENTS.md`, `pwa/CLAUDE.md`, `pwa/design/README.md` で「移行中」と明記 | P0 |
| PWA全体仕様 | `pwa/design/SPEC_pwa.md` が route/API/cron の正本。`/spec` には overview しかない | ランタイム/route/API境界は `/spec/2-1-pwa-runtime-routes` へ移行開始。移行完了までは `design/SPEC_pwa.md` も更新 | P1 |
| L2データ/抽出 | `pwa/design/L2_DATA.md` と `pwa/manual/3-2-data-and-extraction.md` / `8-3-l2-extraction-routines-spec.md` が重い実装仕様を共有 | L2/outbox/採否契約は `/spec/3-1-l2-data-extraction-current-spec` へ移行開始。運用者向け早見表は `/manual` に残す | P1 |
| FRL / AMD Score | `pwa/bzm/4-1-*` に理論、`pwa/manual/4-4-*spec.md` に CES式/DB列、`pwa/design/amd_score.md` に実装仕様が混在 | FRL CES の実装契約は `/spec/4-1-frl-ces-current-spec` へ移行済み。導出は `/bzm`、画面の読み方は `/manual` | P1 |
| 報酬/請求/支払 | `pwa/manual/6-*spec.md` と `7-1-reward-calc-spec.md` に DB/計算/実装契約が多い。`pwa/design/routine.md` / `SPEC_pwa.md` と重複 | DB/計算/状態遷移は `/spec`、月次オペ手順は `/manual` | P2 |
| 外部探索/Atlas/Seeds/VC | `pwa/manual/4-2`, `5-1`, `5-2` と `pwa/design/atlas.md`, `seeds.md`, `vc_list.md`, `venture_map_*` が重複 | route/API/DB/保全導線は `/spec`、探索画面の使い方は `/manual` | P2 |
| BZM論文化 | `pwa/design/bzm_paper*.md` は論文設計で、教科書正本 `pwa/bzm/*.md` と目的が違う | 論文化メモは当面 `design/` に残し、理論正本は `/bzm` に限定 | P3 |

## 章移行の優先順位

1. **P0: 整合文言** — `design/` を今すぐ消した扱いにしない。移行完了前の事故を防ぐ。
2. **P1: PWA全体仕様** — `/spec/2-1-pwa-runtime-routes` へ移行開始済み。次は API group / cron group / DB model を章分割する。
3. **P1: L2データ/抽出** — `/spec/3-1-l2-data-extraction-current-spec` へ移行開始済み。L2 ① monthly_reports は `/spec/3-2-monthly-reports-current-spec`、L2 ⑥ MTGフローは `/spec/3-3-meeting-flow-current-spec` へ個別章化済み。次は L2 ⑦/⑧/⑨ の個別章化。
4. **P1: FRL / AMD Score** — #101 の CES 実装仕様は `/spec/4-1-frl-ces-current-spec` へ移行済み。次は AMD Score 全体仕様のうち route/UI/API 境界を切り出す。
5. **P2: 報酬・請求・支払** — 業務影響が大きいので、`manual` から仕様を抜く前に spec 側の検証観点を作る。

## 移行ゲート

- 既存 `pwa/manual/*.md` と `pwa/design/*.md` は削除しない。
- `/spec` に移した章は、元ファイル冒頭へ「詳細仕様は `/spec/...`」のリンクを置き、重複本文を段階的に薄くする。
- DB列・API・cron・状態遷移を書く前に `pwa/design/db_schema.md` と実装コードを確認する。
- UI導線を変える変更では `tsc --noEmit` と `npm run build` を通す。
- 章移行だけの docs 変更でも、`/spec` 目次とリンクが壊れていないか確認する。
