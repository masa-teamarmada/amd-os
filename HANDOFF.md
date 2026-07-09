# AMD OS Handoff

Last updated: 2026-07-09 23:06 JST
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
- Current main line includes `49cd543d fix(pwa): align invoice issuance prerequisites`, `daccb19f docs: close out monthly agreement density polish`, `f29fc560 docs: include poc dirty build marker in handoff`, `0306c5e5 Replace PoC matrix with tagged candidate queue`, and `a38f6b12 docs: update monthly closeout handoff state`.
- Product UI state: `d8934395` and later main descendants。
- Disposable deploy clone: `/tmp/amd-os-deploy-monthly-compact` で closeout docs を作成。push後に clean / `origin/main` aligned へ戻す。
- Canonical root checkout `/Users/masa/projects/AMD/amd-os` は `origin/main` と aligned。POC matching bundle は `0306c5e5` で取り込み済み。月初合意 lane の未コミット残はない。

## Dirty State

Monthly agreement lane: none known.

Canonical root checkout has no tracked dirty files at this closeout. The previous `/admin/invoices` freee取引先 bundle was integrated by `49cd543d`; the previous `/poc` matching UI/docs bundle was integrated by `0306c5e5`.

| path | status | class | owner guess | resolution action | risk |
|---|---:|---|---|---|---|
| none | clean | n/a | n/a | n/a | none |

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
- Canonical root dirty cleanup: none observed at closeout.

## First Next Action

月初合意を再開するなら、まず production `/api/build-info` と `origin/main` を合わせたうえで、`/monthly-agreement?ym=202607&memberId=ID...` または強制モーダルで実データを開き、スクショ基準で「右側の空白」「不要な改行」「1行で済む情報が2行になっていないか」を確認する。

If continuing POC matching, start from committed main state `0306c5e5` / `v0.39.36`. Run targeted checks, and stage only the next bundle plus required spec/manual updates.

## Pointers

- UI: `pwa/src/components/monthly-agreement/MonthlyAgreementExperience.tsx`
- Gate overlay: `pwa/src/components/monthly-agreement/MonthlyAgreementGateOverlay.tsx`
- Spec: `pwa/spec/3-14-monthly-work-agreement-current-spec.md`
- Manual: `pwa/manual/2-2-member-workflows-quick-start.md`, `pwa/manual/6-6-member-billing-prompts-spec.md`, `pwa/manual/7-1-reward-calc-spec.md`
- Changelog: `pwa/manual/9-3-appendix-changelog.md`, `pwa/spec/6-1-appendix-changelog.md`
- Process lesson: `pwa/BUGS.md`
- Session log: `pwa/design_log/sessions_2026-07.md`
