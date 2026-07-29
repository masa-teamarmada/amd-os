# AMD OS Handoff

Last updated: 2026-07-29 JST

Target: `/Users/masa/projects/AMD/amd-os`

Topic: SX MS予算不足の誤判定と「会社留保」水増しの修正closeout

## Latest Session Summary

- `/admin/ms-overview` のSXで `MS編集停止中` と予算不足5,370,277円が出る不具合を修正し、本番反映まで完了した。
- 原因は、月次フローの `companyReserveYen` に、翌月へ繰り越される月末残高スナップショット `stockYen` を各月分足していたこと。SXでは実配賦3,085,723円に同じ残高の重複5,983,802円が加わり、9,069,525円へ膨らんでいた。
- 支払区分は役員かどうかではなく `members.exclude_from_payout_notice` だけを正本にした。あき・りりは非役員でも支払対象外で、対象外メンバーへの割当は65%のPJ予算内の非現金配賦として扱う。
- AMD運営費30%とクローザー報酬5%は65%PJ予算の外側であり、`companyReserveYen` の意味ではない。UI表示も「会社留保」から「対象外配賦」へ改めた。
- SXの13pt未配賦は将来MS用の意図的なバッファ。予算不足や保存停止の条件にしない。
- 実装履歴と全検証は [`pwa/design_log/sessions_2026-07.md`](pwa/design_log/sessions_2026-07.md) の「2026-07-29 — SX MS予算不足」節にある。

## Repo / Production State

- canonical branch: `main`
- accepted implementation commit: `700a438e8393e17e791bbb05070fe88a15b17d50` (`fix(pwa): correct MS noncash allocation budget guard`)
- implementation commitは `origin/main` とproductionへ反映済み。closeout文書commitはこのHANDOFFを含む現在のmain HEADとして別に積まれるため、次セッション開始時に `git rev-parse HEAD` と `/api/build-info` を読み直す。
- accepted production build: `v3.51.17` / `git_branch=main` / `dirty=false`
- accepted SX current truth: client 10,480,000円 / buffer 1,800,000円 / PJ budget 5,642,000円 / cash payout 1,942,752円 / 対象外配賦 3,085,723円 / obligation 5,028,475円 / 期末未払0円 / 残予算613,525円。
- no DB/payment mutation: 今回はコード・仕様・検査・表示だけを変更し、報酬行や支払データは書き換えていない。
- worktrees: root checkout 1件のみ。clean detached worktree `b108` は状態・空patchを `/Users/masa/.codex/cleanup_archives/` に保全後、registryから削除済み。
- shared checkoutで見つかったW-Prep拡張7日窓の別差分は、owner task `W-Prep Launch` が必要な8文書へ同期し、`f936e278 docs(pwa): extend W-Prep launch window` としてmain・productionへ反映済み。SX実装/closeout commitには混ぜていない。

## Unresolved Tasks

- SX MS予算不足修正: なし。
- 13pt: 意図的な未配賦バッファとして確定。追加配分しない。
- 別ownerのW-Prep差分も `f936e278` でcloseout済み。SX側の未解決タスクはない。

## First Next Action

SXで再び保存停止が出た場合だけ、最初にproduction `/api/build-info`、対象cycleの `budgetImpact`、全月の `companyReserveYen`、最終月の支払対象メンバー `stockYen` をread-onlyで確認する。`stockYen` を期間合計せず、全PJを同じshared backend pathで横断監査する。再発がなければ追加実装は不要。

## Pointers

- finance設計正本: [`pwa/design/season_budget_actual.md`](pwa/design/season_budget_actual.md)
- MS overview仕様: [`pwa/manual/6-8-admin-ms-overview-spec.md`](pwa/manual/6-8-admin-ms-overview-spec.md)
- 報酬計算正本: [`pwa/manual/7-1-reward-calc-spec.md`](pwa/manual/7-1-reward-calc-spec.md)
- member支払区分: [`pwa/manual/6-6-member-billing-prompts-spec.md`](pwa/manual/6-6-member-billing-prompts-spec.md)
- 変更履歴: [`pwa/manual/9-3-appendix-changelog.md`](pwa/manual/9-3-appendix-changelog.md)
- バグ・教訓: [`pwa/BUGS.md`](pwa/BUGS.md)
- 開発履歴: [`pwa/design_log/sessions_2026-07.md`](pwa/design_log/sessions_2026-07.md)
- 次セッション用prompt: [`SESSION_MIGRATION_PROMPT.md`](SESSION_MIGRATION_PROMPT.md)

## Verification Evidence

- `npm run test:cockpit-season-finance-reserve`: PASS
- `npm run test:ms-overview-reward-reserve`: PASS
- `npm run test:critical-ui`: PASS
- `npx tsc --noEmit`: PASS
- `npm run build`: PASS
- productionのSX admin MS overviewを実データで確認し、`MS編集停止中` が消え、残予算613,525円・期末未払0円を確認した。
- 390px幅では既存のadmin wide-layout由来の横クリップを確認したが、今回の変更起因ではないため別課題とした。

## Closeout Classification

- work type: `development`
- durable note: design/manual正本、`pwa/BUGS.md` の2026-07-29 finance/admin-ms項目、`pwa/design_log/sessions_2026-07.md`
- design_log: 更新あり。理由は製品コード・finance計算・UI・検査・deployの実装履歴だから。
- main alignment: `main aligned`
- production alignment: accepted implementation `700a438e` / `v3.51.17` はproduction反映済み。closeout文書commitの最終SHAはcloseout後の `/api/build-info` で再確認する。
- archive condition: SX側はcloseout済み。最終closeout文書commitのpush・production SHA・live dirty inventoryを確認して判定する。
