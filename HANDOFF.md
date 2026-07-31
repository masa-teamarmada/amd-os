# AMD OS Handoff

Last updated: 2026-07-31 JST

Topic: 資本政策表の金額可読性と株主構成の色識別

## Latest Session Summary

- `CapitalPlanMatrix` の金額・株数を3桁ごとのカンマで表示し、カンマ付き入力も受け付ける。自動算出の金額は省略記号で隠さず、セル内折り返しで全額を読める。
- FD比率の縦積み棒と凡例を、見分けやすいカテゴリ配色・凡例外周・segment境界線へ更新した。色は株主識別専用で、状態意味には使わない。
- 実装履歴は [`pwa/design_log/sessions_2026-07.md`](pwa/design_log/sessions_2026-07.md)、現行仕様は [`pwa/spec/3-8-cockpit-current-spec.md`](pwa/spec/3-8-cockpit-current-spec.md) と [`pwa/design/FEATURE_REGISTRY.md`](pwa/design/FEATURE_REGISTRY.md)、利用者向け説明は [`pwa/manual/2-3-pj-cockpit.md`](pwa/manual/2-3-pj-cockpit.md) に同期済み。

## Repo / Production State

- canonical branch: `main`。資本政策表の実装commitは `e58b1d89`（数値表示）と `23055bed`（色識別）。次セッション開始時はHEAD / `origin/main` / production SHAをread-onlyで取り直す。
- production UI は `v3.52.4`。今回の文書同期は同versionのまま反映済みで、ユーザー表示の実装は上記2 commitにある。
- DB・API・保存形式・資本政策計算ロジックの変更はない。branch / worktreeの新規作成もない。

## Unresolved Tasks

- 実装の未解決はなし。
- まさから資本政策表の追加フィードバックがあった場合だけ、表示対象・画面幅・意図した判別を確認してから調整する。

## First Next Action

新しいフィードバックが来たら、まずproduction `/project/p21/cockpit?tab=business-plan` の資本政策表をdesktopと390px幅で確認する。数値を省略して読めなくしたり、色を状態意味に流用したり、表そのものをモバイルで隠したりしない。

## Pointers

- 仕様: [`pwa/spec/3-8-cockpit-current-spec.md`](pwa/spec/3-8-cockpit-current-spec.md)
- 設計規約: [`pwa/design/FEATURE_REGISTRY.md`](pwa/design/FEATURE_REGISTRY.md)
- OSマニュアル: [`pwa/manual/2-3-pj-cockpit.md`](pwa/manual/2-3-pj-cockpit.md)
- 再発防止: [`pwa/BUGS.md`](pwa/BUGS.md)
- 実装履歴: [`pwa/design_log/sessions_2026-07.md`](pwa/design_log/sessions_2026-07.md)

## Verification / Closeout

- 実装時に `npm run test:company-overview-cap-table`、`npx tsc --noEmit`、`npm run build`、`npm run test:critical-ui` が成功。productionでdesktop / 390px幅、console error 0件、ページ横あふれなしを確認済み。
- work type: `development`。design_logは実装・検証・本番確認を残すため更新。BUGSは表示上の可読性不良の症状・原因・再発防止を追記。
- main alignment: `main aligned`（closeout時に `origin/main` との差分 0）。
