# SESSION MIGRATION PROMPT - AMD OS MS Overview guard closeout

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
14. pwa/manual/6-8-admin-ms-overview-spec.md
15. pwa/BUGS.md
16. pwa/design_log/sessions_2026-07.md

状態スナップショット:
- canonical repo: /Users/masa/projects/AMD/amd-os
- branch: main
- accepted product release: cb584019ca8710b684322688069c42bf1012d652 (chore(pwa): bump build version for MS guard)
- latest handoff docs commit: current origin/main HEAD. Re-check with `git log -1 --oneline` because this prompt is part of that docs commit itself.
- production: https://amd-os-pwa.vercel.app
- production /api/build-info observed after handoff docs deploy:
  - build_version: v0.39.13
  - git_sha: current origin/main HEAD
  - git_branch: main
  - dirty: false
- registered worktree: /Users/masa/projects/AMD/amd-os [main] only
- local branches: main only
- local main vs origin/main before handoff refresh: ahead 0 / behind 0
- always re-run git status/log/build-info before work.

直近で完了した成果:
- /admin/ms-overview の上段メトリクスから、個人名同士を比べるカードを削除した。
- 直前に一度3枚化してしまったが、まさから「本来4枚だった」と指摘があり、正しく4枚構成へ戻した。
- current 4枚:
  1. 合計pt
  2. 本契約pt
  3. 別財布pt
  4. 保存前支払検算 budgetImpact 由来の PJ予算残 / 不足額 / 予算不足 / 原資超過
- 4枚目を個人名カードへ戻す変更は禁止。3枚化も禁止。
- 旧カードを連想させる文言は current tree から削除済み。禁止語 rg はゼロ件確認済み。
- 仕様同期済み:
  - pwa/manual/6-8-admin-ms-overview-spec.md
  - pwa/design/FEATURE_REGISTRY.md
  - pwa/manual/9-3-appendix-changelog.md
  - pwa/spec/6-1-appendix-changelog.md
  - pwa/BUGS.md
  - pwa/design_log/sessions_2026-07.md
- BUILD_VERSION は v0.39.13 まで上げ、本番 /api/build-info で確認済み。

検証済み:
- npm run test:critical-ui
- npm run test:deploy-version-guard
- npx tsc --noEmit
- node pwa/scripts/deploy-version-guard.cjs --target production --app-url https://amd-os-pwa.vercel.app --repo-root /Users/masa/projects/AMD/amd-os
- curl -sS https://amd-os-pwa.vercel.app/api/build-info
- 旧カード禁止語セットの検索: current tree でゼロ件確認済み

未解決 / dirty:
- 以下5ファイルは、この MSカード回帰防止の accepted release 後も dirty。今回の handoff では触らない。
  - pwa/src/app/api/admin/ms-overview/route.ts
  - pwa/src/components/admin/AdminMsOverviewClient.tsx
  - pwa/src/lib/admin/ms-overview-calc.ts
  - pwa/scheduled-tasks/amd-os-l6-meeting-prep-worker/SKILL.md
  - pwa/scripts/atlas_signal_review_tool.mjs
- MS系3ファイルは「設計額を丸め済み1pt単価ではなく budget × pt比で出す」方向のWIPに見える。採用するなら spec/manual/BUGS/changelog 同期、BUILD_VERSION bump、test、deploy が必要。
- L6 prep SKILL は prep資料をHTML主成果物へ寄せるWIPに見える。採用するなら関連仕様の同期が必要。
- Atlas script は ingest disabled を retryable として outbox に残すWIPに見える。Atlas lane で検証して commit/revert 判断する。

次タスク:
1. まず git status と production build-info を再確認する。
2. 禁止語 rg を再実行し、旧カード文言が復活していないことを見る。
3. dirty 5ファイルを lane 別に処理する。特に MS系3ファイルは finance math なので、採用するなら仕様同期とテストなしで出さない。
4. このカード回帰防止そのものは完了済み。まさに同じカードが見えると言われたら、まず画面左上 version / /api/build-info が v0.39.13 以上か確認する。

運用ルール:
- /Users/masa/projects/AGENTS.common.md を最初に読む。
- AMD配下PJでは AMD level memory (/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md) も冒頭で読む。
- AMD OSでは branch を作らない。main で直接 commit & push。
- dirty は branch/worktree 作成理由にしない。git add . は使わず、対象ファイルだけ stage。
- PWAコード変更時は src/lib/build-info.ts の BUILD_VERSION を bump する。
- PWA本番反映は main push = Vercel自動deploy。通常は AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh を使う。CLI直接 deployは禁止。
- handoff時は、新仕様を pwa/manual / pwa/spec / pwa/design / BUGS / design_log へ分けて記録し、HANDOFFだけに恒久仕様を残さない。
- /admin/ms-overview の上段メトリクスは 4枚固定。4枚目は budgetImpact の安全状態カード。個人名カードへ戻さない。
```
