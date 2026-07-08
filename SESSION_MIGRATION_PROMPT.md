# SESSION MIGRATION PROMPT - AMD OS clean closeout

```text
cd /Users/masa/projects/AMD/amd-os

読む順:
1. /Users/masa/projects/AGENTS.common.md
2. /Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md
3. HANDOFF.md
4. CLAUDE.md
5. AGENTS.md
6. pwa/AGENTS.md
7. pwa/CLAUDE.md
8. pwa/manual/1-1-intro.md
9. pwa/spec/1-1-overview.md
10. pwa/spec/1-2-document-layer-migration-map.md
11. pwa/spec/1-3-reconstruction-coverage-audit.md
12. pwa/design/README.md
13. pwa/design/FEATURE_REGISTRY.md
14. pwa/manual/2-3-pj-cockpit.md
15. pwa/spec/3-8-cockpit-current-spec.md
16. pwa/manual/6-8-admin-ms-overview-spec.md
17. pwa/BUGS.md
18. pwa/design_log/sessions_2026-07.md

状態スナップショット:
- canonical repo: /Users/masa/projects/AMD/amd-os
- branch: main
- latest product commit before final docs-only closeout: e5d3771a8154359a48e2a37325b9543b9e880d4c (fix: remove tsukuyomi memo from cockpit)
- this prompt may itself be inside a later docs-only closeout commit; re-check `git log -3 --oneline`.
- expected local state after closeout:
  - HEAD / origin/main: same
  - ahead 0 / behind 0
  - git status: clean
  - registered worktree: /Users/masa/projects/AMD/amd-os [main] only
  - local branches: main only
- production: https://amd-os-pwa.vercel.app
- expected production /api/build-info after final docs deploy:
  - build_version: v0.39.14 or newer
  - git_sha: current origin/main HEAD
  - git_branch: main
  - dirty: false
- always re-run git status/log/build-info before work.

直近で完了した成果:
- PJ cockpit の月次 season finance table から、メンバー向け表示の 会社留保 / 役員報酬相当額 column を削除した。
- 同じ表の visible last column を、義務残の「残」から現金主義の「収支」に変更した。
- 現金主義の収支定義: 収支 = クライアント支払 - バッファ - メンバー支払。
- 会社留保 / final unpaid / final remaining は、内部の不足検知・安全計算には残す。メンバー向け表示には出さない。
- SX p21 で見えた `未払残` と `予算残` が同額だったのは、hidden safety calc の義務未払いがそのまま残に出ていたため。予算オーバーを cash loss として表示するものではなかった。
- /admin/ms-overview の上段メトリクスから、個人名同士を比べるカードを削除した。
- current MS Overview 4枚:
  1. 合計pt
  2. 本契約pt
  3. 別財布pt
  4. 保存前支払検算 budgetImpact 由来の PJ予算残 / 不足額 / 予算不足 / 原資超過
- 4枚目を個人名カードへ戻す変更は禁止。3枚化も禁止。
- `e5d3771a fix: remove tsukuyomi memo from cockpit` で、通常PJ / institution cockpit から `CockpitNudge` / `tsukuyomi_nudge_queue` 由来カードが削除された。BUILD_VERSION は v0.39.14。

仕様同期済み:
- pwa/manual/2-3-pj-cockpit.md
- pwa/spec/3-8-cockpit-current-spec.md
- pwa/design/FEATURE_REGISTRY.md
- pwa/manual/6-8-admin-ms-overview-spec.md
- pwa/manual/9-3-appendix-changelog.md
- pwa/spec/6-1-appendix-changelog.md
- pwa/BUGS.md
- pwa/design_log/sessions_2026-07.md
- root HANDOFF.md
- root SESSION_MIGRATION_PROMPT.md

検証済み:
- PJ cockpit cash-basis change:
  - npx tsc --noEmit
  - npm run test:critical-ui
  - npm run build
  - AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh
  - production build-info observed as v0.39.12 / 0eee5780... / dirty:false before later commits
- MS Overview guard:
  - npm run test:critical-ui
  - npm run test:deploy-version-guard
  - npx tsc --noEmit
  - deploy rollback guard
  - production build-info observed as v0.39.13 / dirty:false
  - old personal-name card wording rg zero matches
- Cockpit Tsukuyomi memo removal:
  - committed as e5d3771a
  - this handoff session did not re-run that bundle's tests; verify from that worker if detailed proof is needed
- closeout:
  - git status / HEAD / origin/main / ahead-behind / worktree list / production build-info checked

未解決 / dirty:
- none at final closeout.
- During handoff, parallel WIP briefly appeared as 19 dirty files. That bundle was committed separately as e5d3771a before final closeout docs refresh. Do not treat the older dirty inventory as current truth.

次タスク:
1. まず git status と production build-info を再確認する。
2. PJ cockpit の表示を続けるなら、認証後の cockpit 画面で `今シーズン収支` と月次の `収支` を目視確認する。
3. MS finance math を進めるなら、新しい bundle として扱い、仕様同期とテストなしで出さない。
4. 同じMSカードが見えると言われたら、まず画面左上 version / /api/build-info が v0.39.13 以上か確認する。
5. cockpit につくよみメモが残って見えると言われたら、画面左上 version / /api/build-info が v0.39.14 以上か確認する。

運用ルール:
- /Users/masa/projects/AGENTS.common.md を最初に読む。
- AMD配下PJでは AMD level memory (/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md) も冒頭で読む。
- AMD OSでは branch を作らない。main で直接 commit & push。
- dirty は branch/worktree 作成理由にしない。git add . は使わず、対象ファイルだけ stage。
- PWAコード変更時は pwa/src/lib/build-info.ts の BUILD_VERSION を bump する。
- PWA本番反映は main push = Vercel自動deploy。通常は AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh を使う。CLI直接 deployは禁止。
- handoff時は、新仕様を pwa/manual / pwa/spec / pwa/design / BUGS / design_log へ分けて記録し、HANDOFFだけに恒久仕様を残さない。
- PJ cockpit の member-facing finance table は cash-basis 収支表示。会社留保 / 役員報酬相当額は出さない。
- /admin/ms-overview の上段メトリクスは 4枚固定。4枚目は budgetImpact の安全状態カード。個人名カードへ戻さない。
- 通常PJ / institution cockpit には旧 `CockpitNudge` / つくよみメモカードを戻さない。
```
