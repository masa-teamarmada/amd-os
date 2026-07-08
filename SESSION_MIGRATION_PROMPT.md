# SESSION MIGRATION PROMPT - AMD OS D-10 closeout state

```text
cd /Users/masa/projects/AMD/amd-os

読む順:
1. /Users/masa/projects/AGENTS.common.md
2. /Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md
3. HANDOFF.md
4. CLAUDE.md
5. pwa/AGENTS.md
6. pwa/CLAUDE.md
7. pwa/manual/1-1-intro.md
8. pwa/spec/1-1-overview.md
9. pwa/spec/1-2-document-layer-migration-map.md
10. pwa/spec/1-3-reconstruction-coverage-audit.md
11. pwa/spec/3-1-l2-data-extraction-current-spec.md
12. pwa/spec/5-3-automation-responsibility-current-spec.md
13. pwa/spec/5-8-l1-l3-codex-migration-current-spec.md
14. pwa/design/L2_DATA.md
15. pwa/design/mypage.md
16. pwa/BUGS.md
17. pwa/design_log/sessions_2026-07.md

状態スナップショット:
- canonical repo: /Users/masa/projects/AMD/amd-os
- branch: main
- D-10 accepted implementation commit: 0910a201b895792e5195553cf2e7234119fd2c29 (Move D-10 synthesis to Codex automation)
- closeout start HEAD / origin/main: 3e3494c3fb96c372d848906c09359af6b0094b1f
- production: https://amd-os-pwa.vercel.app
- production /api/build-info observed during closeout:
  - build_version: v0.39.7
  - git_sha: 3e3494c3fb96c372d848906c09359af6b0094b1f
  - git_branch: main
  - dirty: false
- registered worktree: /Users/masa/projects/AMD/amd-os [main] only
- local branches: main only
- local main vs origin/main at closeout start: ahead 0 / behind 0
- unrelated dirty file exists: pwa/scripts/atlas_signal_review_tool.mjs. It adds retryable handling when Atlas ingest returns disabled. It is not D-10 work; do not stage/revert it from a D-10 session.

直近で完了した成果:
- MyPage「今週やったこと」の変な行を修正済み。
- 原因: 2026-07-01以降、背景Anthropicが封鎖されたことで D-10 route fallback が保存され、fallback title が Gmail本文冒頭 / HTML / runner marker をそのまま使っていた。
- 修正: D-10は PWA route 内の Anthropic合成を使わず、Codex automation `amd-os-l2-2` が合成する。
- current path:
  1. GET /api/cron/member-weekly-activities?mode=evidence&interactive=1
  2. Codex automation が全 evidence group を活動文へ合成
  3. POST /api/cron/member-weekly-activities { windowKey, activities[] }
  4. member_activities(source='member_weekly') に raw_metadata.synthesis_method='codex' で保存
- legacy GET `/api/cron/member-weekly-activities?interactive=1` は保存に使わない。ALLOW_PWA_LLM_CRONS=1 で復活させない。
- Current week production data is already repaired manually: 22 rows, all codex, known bad-pattern count 0.

検証済み:
- npm run lint -- src/app/api/cron/member-weekly-activities/route.ts src/lib/operations-catalog.ts
- npx tsc --noEmit --pretty false
- npm run build
- git diff --check
- AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh
- production /api/build-info 確認
- legacy GET smoke: disabled true / saved 0
- evidence mode smoke: evidence groups returned without Anthropic synthesis
- DB readback: current week total 22 / synthesis_method=codex 22 / bad-pattern count 0

次タスク:
- D-10本体は完了。
- まだ残る実務タスクは `/mypage` の「いますぐ抽出」ボタン。現状の refresh route は古い legacy GET を呼ぶので、今はD-10修復ボタンとして機能しない。次はボタンを Codex automation / request queue に接続する。
- Windows MMO Task Scheduler launcher を復活させるなら、Macと同じ evidence -> Codex synthesis -> POST 方式へ更新する。legacy interactive GET 一発実行には戻さない。
- unrelated dirty `pwa/scripts/atlas_signal_review_tool.mjs` は Atlas lane のWIPとして扱う。D-10のcloseoutで触らない。

運用ルール:
- /Users/masa/projects/AGENTS.common.md を最初に読む。
- AMD配下PJでは AMD level memory (/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md) も冒頭で読む。
- AMD OSでは branch を作らない。main で直接 commit & push。
- dirty は branch/worktree 作成理由にしない。git add . は使わず、対象ファイルだけ stage。
- PWAコード変更時は src/lib/build-info.ts の BUILD_VERSION を bump する。
- PWA本番反映は main push = Vercel自動deploy。通常は AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh を使う。CLI直接 deployは禁止。
- handoff時は、新仕様を pwa/manual / pwa/spec / pwa/design / BUGS / design_log へ分けて記録し、HANDOFFだけに恒久仕様を残さない。
- D-10のような背景LLM処理は定額内Codex automationへ移す。PWA/Vercel routeで有料LLM synthesisを復活させない。
```
