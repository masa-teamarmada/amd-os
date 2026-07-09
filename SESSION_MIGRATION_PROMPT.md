# SESSION MIGRATION PROMPT - AMD OS Japanese culture admin move closeout

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
8. /Users/masa/projects/AMD/amd-os/pwa/spec/2-1-pwa-runtime-routes.md
9. /Users/masa/projects/AMD/amd-os/pwa/spec/2-2-pwa-surface-inventory-current-spec.md
10. /Users/masa/projects/AMD/amd-os/pwa/design/FEATURE_REGISTRY.md
11. /Users/masa/projects/AMD/amd-os/pwa/design/SPEC_pwa.md
12. /Users/masa/projects/AMD/amd-os/pwa/design/os_manual.md
13. /Users/masa/projects/AMD/amd-os/pwa/manual/2-6-admin-ops.md
14. /Users/masa/projects/AMD/amd-os/pwa/manual/9-3-appendix-changelog.md
15. /Users/masa/projects/AMD/amd-os/pwa/spec/6-1-appendix-changelog.md
16. /Users/masa/projects/AMD/amd-os/pwa/BUGS.md
17. /Users/masa/projects/AMD/amd-os/pwa/design_log/sessions_2026-07.md

状態スナップショット:
- canonical repo: /Users/masa/projects/AMD/amd-os
- branch: main
- branch rule: 新規branch禁止。mainへ直接commit/push。
- product commit: 1327db6b Move Japanese culture map into admin
- product deploy build-info: v0.39.18 / 1327db6b4c2709bf261910868eead7168667a68e / main / dirty=false
- final handoff docs commit may be newer than 1327db6b. Start by running:
  - git status -sb --untracked-files=all
  - git log -3 --oneline
  - git worktree list
  - curl -fsS https://amd-os-pwa.vercel.app/api/build-info
- worktree registry before handoff refresh: /Users/masa/projects/AMD/amd-os [main] only
- local branches before handoff refresh: main only

このセッションで完了したこと:
- 日本文化マップの実画面を /admin/japanese-culture-map へ移動した。
- 旧 /japanese-culture-map は互換 redirect として残した。
- 未ログイン時は auth gate が先に走るため、旧routeは /auth/login?next=%2Fjapanese-culture-map に入る。ログイン後に旧routeへ戻った場合は admin route へ redirect される想定。
- GlobalNav の一般「資料」から日本文化を外し、admin group に /admin/japanese-culture-map を追加した。
- AdminSidebar と app layout title mapping に 日本文化 / 日本文化マップ を追加した。
- pwa/design/os_manual.md、pwa/design/SPEC_pwa.md、pwa/design/FEATURE_REGISTRY.md、pwa/spec/2-1-pwa-runtime-routes.md、pwa/spec/2-2-pwa-surface-inventory-current-spec.md、pwa/manual/2-6-admin-ops.md、manual/spec changelog を同期した。
- BUILD_VERSION は v0.39.18。
- npm run test:critical-ui、npx tsc --noEmit、npm run build は通過。
- deploy.sh で main push / Vercel production Ready まで確認し、production /api/build-info は v0.39.18 / 1327db6b... / dirty=false。

次タスク:
- 日本文化マップについては既知の未実装なし。
- 必要なら login-capable browser で /admin/japanese-culture-map の admin sidebar / map rendering / old-route authenticated redirect を目視する。
- 別レーンの持ち越し: /admin/ms-overview に「実支払へ合わせる」admin UI を実装する。支払済み月の実支払証跡、member別差額、freee wallet transaction ids、budget impact、reserve 承認を同じ flow で扱う。

運用ルール:
- /Users/masa/projects/AGENTS.common.md を最初に読む。
- AMD配下では AMD level memory /Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md も冒頭で読む。
- dirty は branch/worktree 作成理由にしない。
- git add . は使わず対象ファイルだけstageする。
- PWAコード変更時は build version を確認し、必要なら bump する。
- PWA本番反映は main push = Vercel自動deploy。AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh を使い、最後に /api/build-info で current sha / dirty=false を確認する。
- handoff時は恒久仕様を pwa/manual / pwa/spec / pwa/design / BUGS / design_log に分け、HANDOFFだけに残さない。
```
