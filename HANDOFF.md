# AMD OS Handoff

Last updated: 2026-07-09 22:51 JST
Target: `/Users/masa/projects/AMD/amd-os`
Topic: 月初合意モーダルの情報密度改善 / closeout

## Summary

- 月初合意モーダルの情報密度改善は、まさ確認で「これならいい」と受け入れ済み。
- Product commits: `f13de200 fix(pwa): tighten monthly agreement modal density` と `d8934395 fix(pwa): widen monthly agreement unpaid flow`。
- 現行の受け入れ済みUIは `v0.39.34` / `d89343957fd51ce637fb08aa83aad369d1013a1c` に含まれる。
- 主なUI変更: 更新警告と合意ボタンを横並び化、上部指標を小型カード化、説明レールと修正要望を同じ帯に配置、PJカード上段を `予定額 / 支払 / 未払残` の3列へ圧縮。
- `今月の約束` は契約書とズレるため使わず、`今月の発注条件` / `発注条件と予定額` に寄せた。
- 未払い推移は長い棒グラフや縦積みカードではなく、左に項目・右に稼働月を置く横長マトリクスへ変更。行は `前月残 / 当月発生 / 支払対象 / 支払 / 月末残`。
- MS一覧は、行数が多いコンパクト表示では2列へ分割し、MS名と担当割合の間の無駄な空きを減らした。
- 詳細ログ: `pwa/design_log/sessions_2026-07.md` の `2026-07-09 — 月初合意モーダル情報密度改善 / v0.39.30-v0.39.34`。

## Repo State

- Canonical repo: `/Users/masa/projects/AMD/amd-os`
- Branch policy: `main` only。今回も新規 branch / git worktree は作っていない。
- Current main line includes `49cd543d fix(pwa): align invoice issuance prerequisites` and `daccb19f docs: close out monthly agreement density polish` before this dirty-inventory correction.
- Product UI state: `d8934395` and later main descendants。
- Disposable deploy clone: `/tmp/amd-os-deploy-monthly-compact` で closeout docs を作成。push後に clean / `origin/main` aligned へ戻す。
- Canonical root checkout `/Users/masa/projects/AMD/amd-os` は `daccb19f` へ fast-forward 済み。残dirtyは別worker由来の POC matching 系だけなので、この月初合意 lane では触らない。

## Dirty State

Monthly agreement lane: none known.

Uncommitted changes in canonical root checkout are separate active WIP from another session. Final closeout inventory after fast-forward observed only the `/poc` matching UI/docs bundle. The previous `/admin/invoices` freee取引先 bundle was integrated by `49cd543d`.

| path | status | class | owner guess | resolution action | risk |
|---|---:|---|---|---|---|
| `pwa/src/app/(app)/poc/page.tsx` | M | other-worker | POC matching worker | POC UI/docs bundleとして完成・検証・commit | 中: POC画面のWIPが宙に浮く |
| `pwa/design/poc_matching.md`, `pwa/manual/2-5-research-assets-quick-start.md`, `pwa/manual/5-1-research-assets-vc-seeds-scholar-spec.md` | M | other-worker | POC matching worker | POC仕様変更とUIを同一commitにまとめる | 中 |
| `pwa/design/FEATURE_REGISTRY.md`, `pwa/scripts/check_pwa_critical_ui.cjs` | M | other-worker | POC matching worker | POC UI/specと回帰ガードを同一bundleで確認して commit | 中 |

Resolution owner: next POC matching session. Monthly-agreement closeoutでは巻き込まない。

## Verification / Deploy

Product laneで実行済み:

- `git diff --check`
- `npx tsc --noEmit`
- targeted eslint
- `npm run build`
- temporary visual-check routeで wide / desktop / narrow / mobile screenshot確認。routeはcommit前に削除。
- `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh`
- production `/api/build-info` read-back

Final accepted production snapshot before docs refresh:

- `v0.39.34`
- `d89343957fd51ce637fb08aa83aad369d1013a1c`
- `git_branch=main`
- `dirty=false`

## Unresolved Tasks

- 月初合意モーダル密度改善: none known after まさ acceptance.
- 次に触る場合の注意: CSS差分だけで「コンパクト化できた」と判断しない。実データ・本番相当の横幅で、上部警告、指標、修正要望、PJヘッダ、MS表、未払い表を1つずつ見て余白を潰す。
- Canonical root dirty cleanup: POC matching worker担当。月初合意 lane の残タスクではない。

## First Next Action

月初合意を再開するなら、まず production `/api/build-info` と `origin/main` を合わせたうえで、`/monthly-agreement?ym=202607&memberId=ID...` または強制モーダルで実データを開き、スクショ基準で「右側の空白」「不要な改行」「1行で済む情報が2行になっていないか」を確認する。

If continuing the current repo for active WIP instead, finish the POC matching bundle. Run targeted checks, and stage only that bundle plus required spec/manual updates.

## Pointers

- UI: `pwa/src/components/monthly-agreement/MonthlyAgreementExperience.tsx`
- Gate overlay: `pwa/src/components/monthly-agreement/MonthlyAgreementGateOverlay.tsx`
- Spec: `pwa/spec/3-14-monthly-work-agreement-current-spec.md`
- Manual: `pwa/manual/2-2-member-workflows-quick-start.md`, `pwa/manual/6-6-member-billing-prompts-spec.md`, `pwa/manual/7-1-reward-calc-spec.md`
- Changelog: `pwa/manual/9-3-appendix-changelog.md`, `pwa/spec/6-1-appendix-changelog.md`
- Process lesson: `pwa/BUGS.md`
- Session log: `pwa/design_log/sessions_2026-07.md`
