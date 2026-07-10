# SESSION MIGRATION PROMPT - AMD OS board nav active PJ flyout

```text
cd /Users/masa/projects/AMD/amd-os

読む順:
1. /Users/masa/projects/AGENTS.common.md
2. /Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md
3. /Users/masa/projects/AMD/amd-os/HANDOFF.md
4. /Users/masa/projects/AMD/amd-os/CLAUDE.md
5. /Users/masa/projects/AMD/amd-os/AGENTS.md
6. /Users/masa/projects/AMD/amd-os/pwa/AGENTS.md
7. /Users/masa/projects/AMD/amd-os/pwa/CLAUDE.md
8. /Users/masa/projects/AMD/amd-os/pwa/manual/1-1-intro.md
9. /Users/masa/projects/AMD/amd-os/pwa/spec/1-3-reconstruction-coverage-audit.md
10. /Users/masa/projects/AMD/amd-os/pwa/spec/2-1-pwa-runtime-routes.md
11. /Users/masa/projects/AMD/amd-os/pwa/design/FEATURE_REGISTRY.md
12. /Users/masa/projects/AMD/amd-os/pwa/BUGS.md
13. /Users/masa/projects/AMD/amd-os/pwa/design_log/sessions_2026-07.md

状態スナップショット:
- repo: /Users/masa/projects/AMD/amd-os
- canonical branch: main。新規 branch / worker worktree は禁止。
- PWA board-flyout baseline: `0221beaa fix(pwa): constrain board flyout viewport height` / `v0.39.43` 以降。
- current production at handoff: https://amd-os-pwa.vercel.app/api/build-info = `v0.39.45` / `0665b5e6a2f04709f3378ffcd7900d7598f27d31` / `main` / `dirty=false`。ボード修正 commit は ancestor として含まれる。docs closeout commits `1a378944` / `5c2d5913` は main push 済みだが、production はまだ docs commit までは進んでいない。
- root checkout had unrelated dirty at handoff: monthly-agreement UI/docs/guard files, iOS Settings/BZM resources, and an untracked monthly-agreement mock preview page。これは board/nav 作業には混ぜない。
- worktree inventory showed one extra clean detached temp worktree under `/private/tmp/.../wt-ch7`, HEAD `cd195848`。`origin/main` に含まれるが、別BZM lane由来の可能性があるため勝手に削除していない。
- direct browser visual verification from eimi's in-app browser was blocked by auth login. Masa verified the logged-in UI and said: 「今度はいけた！」。

完了内容:
- 左メニュー `ボード` hover/focus で、全アクティブPJのサブリストを右側に出す導線を実装済み。
- 初回 `v0.39.41` ではフライアウトが左ナビの scroll/overflow 領域内にあり、開いても右側がクリップされて見えなかった。
- `22e77d9a` で `createPortal` を使い、`board-nav-flyout` を `document.body` 直下の fixed layer へ移した。
- `0221beaa` で viewport 下端基準の `maxHeight` を持たせ、PJ一覧部分だけがスクロールするようにした。
- `fetchActiveProjectsForNav()` は `projects.status='active'` の軽量一覧を読み、各行は `/project/{projectId}/cockpit` へリンクする。
- ボード本体の `/dashboard` リンクは維持。hover / focus で開き、マウス移動時に閉じにくい短い close delay が入っている。
- `pwa/design/FEATURE_REGISTRY.md`、`pwa/spec/2-1-pwa-runtime-routes.md`、`pwa/manual/2-1-member-quick-start.md`、manual/spec changelog、`pwa/BUGS.md`、`pwa/design_log/sessions_2026-07.md` に同期済み。
- `pwa/scripts/check_pwa_critical_ui.cjs` は `アクティブPJ`、`fetchActiveProjectsForNav`、`board-nav-flyout`、`createPortal` を guard する。

検証済み:
- Board-flyout implementation sequence: `npm run test:critical-ui`、`npx tsc --noEmit`、`npm run build` passed。
- Closeout docs refresh: `npm run test:critical-ui` passed、`git diff --cached --check` passed。
- `npx prettier --check` は mixed docs set で formatting 指摘あり。別laneの未stage hunkが同居していたため、この closeout では自動整形していない。
- `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh` で `22e77d9a` / `v0.39.42` を本番反映確認。
- `0221beaa` / `v0.39.43` も production `/api/build-info` で確認。
- 後続 main build `v0.39.45` / `0665b5e6` でも board flyout commits は ancestor として含まれる。

次タスク:
- Board hover flyout の既知残はなし。
- もし追加修正するなら、`pwa/src/components/nav/GlobalNav.tsx` の `BoardNavLink` を起点にし、親ナビの overflow に切られない上位レイヤー表示を維持する。
- monthly-agreement / iOS / BZM dirty は別lane。触るなら `git status -sb --untracked-files=all` と対象pathの diff を読んで、その lane として target stage / commit / deploy する。
- clean detached BZM temp worktree `/private/tmp/.../wt-ch7` を消す場合は、別lane owner確認またはまさ承認を取る。HEAD `cd195848` は main ancestor。

運用ルール:
- まず /Users/masa/projects/AGENTS.common.md から読む。AMD OS では root/pwa AGENTS/CLAUDE と該当 spec/manual も先読みする。
- PWA本番反映は main push = Vercel自動deploy。直接 `npx vercel deploy` は使わない。必要な時は `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh`。
- dirtyを理由にbranch/worktreeを作らない。既存dirtyは戻さず、今回の対象ファイルだけ明示 stage する。`git add .`は禁止。
- hover/flyout/menu系UIは、親の `overflow`、scroll container、stacking context を必ず確認する。サイドバー外へ出すUIは親内 `absolute` ではなく上位レイヤーを基本にする。
- closeout時は `bash /Users/masa/.codex/skills/closeout/scripts/closeout_inventory.sh /Users/masa/projects/AMD/amd-os`、production `/api/build-info`、worktree/branch、dirty classification を必ず取り直す。
```
