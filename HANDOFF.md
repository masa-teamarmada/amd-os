# AMD OS Handoff

Last updated: 2026-07-10 17:56 JST
Target: `/Users/masa/projects/AMD/amd-os`
Topic: 左メニュー `ボード` の全アクティブPJフライアウト修正 / closeout

## Summary

- 左メニュー `ボード` hover/focus で、全アクティブPJを右側サブリストとして表示する導線は本番反映済み。
- 初回実装 `v0.39.41` では、フライアウトが左ナビのスクロール領域内にあり、親の overflow で右側がクリップされて見えなかった。
- 修正 commit: `22e77d9a fix(pwa): unclip board nav flyout`。`createPortal` で `document.body` 直下の固定レイヤーへ移し、ナビ内 overflow に切られないようにした。
- 仕上げ commit: `0221beaa fix(pwa): constrain board flyout viewport height`。画面下端ではPJ一覧部分だけがスクロールする高さ制御を追加。
- 実画面の hover は、まさが「今度はいけた！」と確認済み。
- まさの受入確認時点の production `/api/build-info`: `v0.39.45` / `8799b2d772568b5fe5b247f54b9834e762057234` / `main` / `dirty=false`。
- closeout 最終確認時点の production `/api/build-info`: `v0.39.45` / `0665b5e6a2f04709f3378ffcd7900d7598f27d31` / `main` / `dirty=false`。今回の docs closeout は main へ push 済みだが、production はまだ docs closeout までは進んでいない。ボード修正 commit は ancestor として含まれる。
- 詳細ログ: `pwa/design_log/sessions_2026-07.md` の `2026-07-10 — 左メニュー ボード 全アクティブPJフライアウト表示修正 / v0.39.41-v0.39.45`。

## Repo State

- Canonical repo: `/Users/masa/projects/AMD/amd-os`
- Branch policy: `main` only。今回も新規 branch は作っていない。
- Current local/main before this handoff docs commit: `0665b5e6 docs(bzm): Book A Ch7 ステージ3-4 完了 — draft v1 17,977字・機械検査0件、verify 起動`; `origin/main` aligned before staging this docs refresh.
- PWA board-flyout baseline: `0221beaa` / `v0.39.43` 以降。
- This handoff/closeout docs refresh is docs-only; final pushed SHA is reported in chat.
- Worktree inventory showed one extra clean detached temp worktree for BZM Ch7 under `/private/tmp/.../wt-ch7`; its HEAD `cd195848` is already an ancestor of `origin/main`. It was not created by this session and was not removed without explicit cleanup approval.

## Dirty State

Board flyout fix: none. Accepted code/docs are in `origin/main`.

Known unrelated dirty at handoff time:

| path | status | class | owner guess | resolution action | risk |
|---|---:|---|---|---|---|
| `pwa/src/components/monthly-agreement/MonthlyAgreementExperience.tsx` | M | other-worker | monthly-agreement UI lane | do not stage in board-flyout handoff; owner should finish/commit or explicitly revert | medium |
| `pwa/manual/*`, `pwa/spec/*`, `pwa/scripts/check_pwa_critical_ui.cjs`, `pwa/src/lib/*` | M | other-worker | monthly-agreement / guard / infra lane | leave untouched; inspect and stage only within that lane | medium |
| `ios/AMDOS.xcodeproj/project.pbxproj`, `ios/AMDOS/Features/Settings/SettingsView.swift`, `ios/AMDOS/Resources/BZM/*` | M / untracked | other-worker | iOS / BZM resource lane | leave untouched; do not fold into board-flyout closeout | medium |
| `pwa/src/app/mock/monthly-agreement-layout-preview/page.tsx` | untracked | other-worker | monthly-agreement UI preview lane | leave untouched | low |

## Verification / Deploy

- Board-flyout implementation verification included `npm run test:critical-ui`, `npx tsc --noEmit`, and `npm run build` during the fix/deploy sequence.
- Closeout docs refresh verification: `npm run test:critical-ui` passed and `git diff --cached --check` passed.
- `npx prettier --check` on the mixed docs set flagged formatting; it was not auto-fixed because the same files also contained unrelated unstaged hunks from other lanes.
- `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh` ran for `22e77d9a` and confirmed production `v0.39.42`.
- `0221beaa` / `v0.39.43` was also observed live via production `/api/build-info`.
- Later production moved to `v0.39.45` / `0665b5e6`; board flyout commits remain included.
- Direct auth-gated browser verification was not possible from the in-app browser because it stopped at `/auth/login`. The final visual acceptance came fromまさ's logged-in browser report.

## Unresolved Tasks

- Board hover flyout: none known.
- Optional cleanup: decide whether to remove the clean detached BZM temp worktree under `/private/tmp/.../wt-ch7`. It is main-aligned but likely belongs to a separate BZM lane, so it was not removed in this handoff.
- Unrelated monthly-agreement dirty file remains owned by that lane.

## First Next Action

If continuing board/nav work:

1. Read production `/api/build-info` and confirm it is at least `v0.39.45` / `0665b5e6` or a later main build.
2. Inspect `pwa/src/components/nav/GlobalNav.tsx`, especially `BoardNavLink`, `data-testid="board-nav-flyout"`, and `fetchActiveProjectsForNav`.
3. If changing flyout geometry, keep it outside the nav scroll container and keep the dashboard link behavior intact.

If doing general closeout:

1. Run `bash /Users/masa/.codex/skills/closeout/scripts/closeout_inventory.sh /Users/masa/projects/AMD/amd-os`.
2. Classify any unrelated dirty files separately; do not mix monthly-agreement UI changes into board/nav commits.

## Pointers

- UI: `pwa/src/components/nav/GlobalNav.tsx`
- Data helper: `pwa/src/lib/supabase-data.ts`
- Critical UI guard: `pwa/scripts/check_pwa_critical_ui.cjs`
- Route/spec: `pwa/spec/2-1-pwa-runtime-routes.md`
- Feature registry: `pwa/design/FEATURE_REGISTRY.md`
- Manual: `pwa/manual/2-1-member-quick-start.md`
- Changelog: `pwa/manual/9-3-appendix-changelog.md`, `pwa/spec/6-1-appendix-changelog.md`
- Process lessons: `pwa/BUGS.md`
- Session log: `pwa/design_log/sessions_2026-07.md`
