# SESSION MIGRATION PROMPT - AMD OS admin finance cockpit flows

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
8. /Users/masa/projects/AMD/amd-os/pwa/design/FEATURE_REGISTRY.md
9. /Users/masa/projects/AMD/amd-os/pwa/spec/3-8-cockpit-current-spec.md
10. /Users/masa/projects/AMD/amd-os/pwa/manual/2-3-pj-cockpit.md
11. /Users/masa/projects/AMD/amd-os/pwa/manual/6-5-admin-payouts-reward-notice-spec.md
12. /Users/masa/projects/AMD/amd-os/pwa/manual/6-8-admin-ms-overview-spec.md
13. /Users/masa/projects/AMD/amd-os/pwa/manual/7-1-reward-calc-spec.md

状態:
- repo: /Users/masa/projects/AMD/amd-os
- branch: main
- build version: v0.39.22
- normal deploy path: AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh

完了内容:
- ZMP OkuDoor の未払残を外部メンバー分だけに分離。
- 役員の未充当繰越は会社留保側の内部検算へ移動。
- /admin/invoices を請求書発行の主入口にし、/admin/billing は redirect。
- milestone_change_events と cockpit の MS変更履歴を追加。

検証済み:
- git diff --check
- npm run test:critical-ui
- ./node_modules/typescript/bin/tsc --noEmit --pretty false
- npm run build

次に確認すること:
- git status -sb --untracked-files=all
- git log --oneline --decorate -5
- curl -fsS https://amd-os-pwa.vercel.app/api/build-info
```
