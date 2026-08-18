# AMD OS Handoff

最終更新: 2026-08-19 JST

対象: `/seeds` の会社名表示とPJ識別

作業種別: development

## 今回の到達点

- `/seeds` の独立「PJ状態」列を廃止し、一覧の列名を「会社名」に統一した。
- 会社名は枠なし太字で表示する。会社名の正本は `seed_projects.venture_name`、未設立は `会社名（未設立）`、会社名が無いときは `未設立` とする。
- `PJ` は会社名セルの右上に置く小さな丸バッジだけで識別する。`PJ化済み`、PJのactive/ended、`協議中`、`スピンアウト済み`はこの一覧へ表示しない。
- 正本データを訂正し、p21は `SolvioraX`、p20は `CryoX`。両者の `commercialization_stage='pre_incorporation'` は維持した。
- 実装は `8e28447c fix(seeds): emphasize company names`。本番はv3.81.2 / git SHA `8e28447c` で確認済み。その後、管理カレンダー同期のv3.81.3もmainへ統合済み。

## 仕様・検証

- 詳細仕様: `pwa/design/seeds.md`
- 利用者向け説明: `pwa/manual/5-1-research-assets-vc-seeds-scholar-spec.md`
- 変更履歴: `pwa/manual/9-3-appendix-changelog.md`
- 実装履歴: `pwa/design_log/sessions_2026-08.md`
- DB訂正migration: `pwa/scripts/migrations/289_seed_company_names_sx_cx.sql`（本番適用・読戻し済み）
- 実行済み: `npm run test:seed-list-display`、`npm run test:kute-seeds-scope`、`npx tsc --noEmit`、`npm run test:critical-ui`、`npm run build`。
- 本番desktop/mobileで「会社名」列、SolvioraX/CryoXの未設立表記、枠なし太字、右上PJバッジ、旧ラベル不在を確認済み。

## Repo・本番状態

- canonical path: `/Users/masa/projects/AMD/amd-os`
- branch: `main`、HEAD/origin/main: `f0dec491`、ahead/behind: `0/0`
- 最新commit `f0dec491` は別作業の管理カレンダーGoogle同期。今回のシーズ修正はその直前の`8e28447c`に含まれる。
- worktree: 本体1個のみ。local branch: `main`のみ。

## 既存dirty（今回の作業外）

| path | status | owner | 次の判断条件 | リスク |
|---|---:|---|---|---|
| `docs/corporate/` の5ファイル | staged A | corporate文書担当 | 法人文書の正本性・生成物を確認して対象だけcommit | 中 |
| `pwa/scripts/diagnose-cash-inflow.mts`、`pwa/scripts/refresh-live-monthly-pl.mts` | staged A | finance担当 | 実行条件と安全弁を確認して対象だけcommit | 中 |
| `pwa/manual/4-3-amd-score-spec.md`、`pwa/spec/4-2-amd-score-current-spec.md` | unstaged M | AMD Score担当 | 仕様差分を確認してcommitまたはrevertを判断 | 低 |

上記はすべて別作業。stage/revert/delete/実行しない。

## 未解決

- 今回のシーズ一覧依頼は完了。残作業なし。
- 新しい依頼を優先する。シーズ一覧を再変更する場合は、まず `pwa/design/seeds.md` と上記の表示契約テストを読む。

## 次セッションで最初にすること

`AGENTS.common.md`から読み、`git fetch --all --prune`、ahead/behind、dirtyの所有者を確認する。今回と無関係なdirtyを触らず、新しい依頼へ進む。
