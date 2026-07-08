# SESSION MIGRATION PROMPT - AMD OS finance cockpit + MS guard closeout

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
- snapshot before this handoff docs refresh:
  - HEAD / origin/main: 2d64a3faa8571d1e7cb26d928712bf700eaefdba
  - local main vs origin/main: ahead 0 / behind 0
  - production /api/build-info: v0.39.13 / 2d64a3faa8571d1e7cb26d928712bf700eaefdba / main / dirty:false
- latest product commits already included in production:
  - 0eee5780 Show cockpit season finance cash balance
  - cb584019 chore(pwa): bump build version for MS guard
  - 2d64a3fa docs(closeout): clarify handoff production state
- production: https://amd-os-pwa.vercel.app
- registered worktree: /Users/masa/projects/AMD/amd-os [main] only
- local branches: main only
- always re-run git status/log/build-info before work, because this prompt may itself be committed after the snapshot above and parallel WIP changed during closeout.

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
  - production build-info observed as v0.39.12 / 0eee5780... / dirty:false before later MS commits
- MS Overview guard:
  - npm run test:critical-ui
  - npm run test:deploy-version-guard
  - npx tsc --noEmit
  - deploy rollback guard
  - production build-info observed as v0.39.13 / dirty:false
  - old personal-name card wording rg zero matches
- closeout:
  - git status / HEAD / origin/main / ahead-behind / worktree list / production build-info checked

未解決 / dirty:
- 以下19ファイルは、この accepted release 後も dirty。今回の handoff では触らない。
  - pwa/src/app/api/admin/ms-overview/route.ts
  - pwa/src/components/admin/AdminMsOverviewClient.tsx
  - pwa/src/lib/admin/ms-overview-calc.ts
  - pwa/src/app/(app)/project/[projectId]/cockpit/page.tsx
  - pwa/src/app/(app)/institutions/[institutionId]/cockpit/page.tsx
  - pwa/src/components/cockpit/CockpitNudge.tsx
  - pwa/src/components/cockpit/CockpitView.tsx
  - pwa/src/components/dashboard/CyberHudWallDashboard.tsx
  - pwa/src/lib/build-info.ts
  - pwa/scripts/check_pwa_critical_ui.cjs
  - pwa/manual/2-3-pj-cockpit.md
  - pwa/spec/3-8-cockpit-current-spec.md
  - pwa/design/FEATURE_REGISTRY.md
  - pwa/design/cockpit.md
  - pwa/design/proactive_operating_loop.md
  - pwa/manual/9-3-appendix-changelog.md
  - pwa/spec/6-1-appendix-changelog.md
  - pwa/scheduled-tasks/amd-os-l6-meeting-prep-worker/SKILL.md
  - pwa/scripts/atlas_signal_review_tool.mjs
- MS系3ファイルは「設計額を丸め済み1pt単価ではなく budget × pt比で出す」方向のWIPに見える。採用するなら spec/manual/BUGS/changelog 同期、BUILD_VERSION bump、test、deploy が必要。
- Cockpit系14ファイルは `CockpitNudge` / つくよみメモを消すWIPに見える。manual/spec/FEATURE_REGISTRY/changelog/critical-ui も動いている。採用するなら feature removal として認証後 cockpit 目視、test、deploy が必要。`pwa/src/lib/build-info.ts` の v0.39.14 bump もこの bundle として扱う。
- L6 prep SKILL は prep資料をHTML主成果物へ寄せるWIPに見える。採用するなら関連仕様の同期が必要。
- Atlas script は ingest disabled を retryable として outbox に残すWIPに見える。Atlas lane で検証して commit/revert 判断する。

次タスク:
1. まず git status と production build-info を再確認する。
2. dirty 19ファイルを lane 別に処理する。git add . は使わない。
3. PJ cockpit の表示を続けるなら、認証後の cockpit 画面で `今シーズン収支` と月次の `収支` を目視確認する。
4. MS系3ファイルを進めるなら、finance math なので仕様同期とテストなしで出さない。
5. Cockpit nudge removal を進めるなら、消してよい業務導線かを FEATURE_REGISTRY / manual で確認してから出す。
6. 同じMSカードが見えると言われたら、まず画面左上 version / /api/build-info が v0.39.13 以上か確認する。

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
```
