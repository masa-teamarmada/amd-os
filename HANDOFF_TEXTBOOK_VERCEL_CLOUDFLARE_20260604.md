# HANDOFF - Textbook / Vercel Approval Gate / Cloudflare Reader

- Last updated: 2026-06-04 JST
- Canonical root: `/Users/masa/projects/AMD/amd-os`
- Session topic: Textbook下書き閲覧をCloudflare Pagesへ逃がし、Vercel deployをapproval gateへ移行
- Current branch observed: `codex/bzm-vercel-quota-gate`

## Latest Session Summary

- Vercel daily deploy quota消費事故を受け、Textbook下書き確認をPWA productionから切り離した。
- Cloudflare Pages project `textbook-draft` を作成し、横スライド式Textbook static readerをdeployした。
- 公開URL: `https://textbook-draft.pages.dev/`
- 2026-06-04のまさ判断でVercel deployは再開OK。ただし、production/preview deployやVercel auto-deploy対象pushの直前は、deploy bundle付き `askuserquestion` 承認が必須。
- `pwa/scripts/deploy.sh` は `AMD_OS_VERCEL_DEPLOY_APPROVED=1` なしではVercelに入る前に停止する。
- 詳細ログ: `pwa/design_log/sessions_2026-06.md` の `2026-06-04 — Vercel deploy approval gate / Cloudflare Textbook reader / Claude handoff`

## Repo State

- HEAD at handoff close: run `git log --oneline -1` in `/Users/masa/projects/AMD/amd-os`
- Important local commits not pushed:
  - `d79679a docs(textbook): record cloudflare draft reader deploy`
  - `7f60f22 docs(textbook): freeze vercel deploys for quota gate`
  - `43165dd docs(textbook): switch vercel deploy gate to approval`
  - `2da7dc9 docs: update Vercel deploy approval gate`
  - latest handoff commit: run `git log --oneline -1`
- Current uncommitted Textbook/Vercel docs sync: none.
- Other existing untracked files to classify before commit/push:
  - `HANDOFF_CLAUDE_MIGRATION_20260604.md`
  - `SESSION_MIGRATION_PROMPT_CLAUDE_20260604.md`
  - `pwa/supabase/postgres.sql`

## Current Rules

- Textbook本文md編集と台帳更新は通常どおり進めてOK。
- Vercel production deploy / preview deploy / Vercel自動deployを起こす可能性があるpushは、deploy bundleが準備できた時点で `askuserquestion` 承認を取る。
- deploy bundle must include: included changes, excluded changes, local build/test/browser verification, planned deploy count, push/deploy target, rollback plan, production inspection method.
- 微細UI、軽微CSS、md、コメント、ログ文言を1件ずつdeployしない。
- deploy bundleが準備できたら `push/deployはまだしてない` で止まらず、必ず実際に `askuserquestion` を投げる。
- 承認待ちは `approval pending` として台帳に残す。未分類blockerにしない。承認待ちで止めるのはそのdeploy bundleのpush/deployだけで、local実装、local build/test、レビュー、台帳更新、次タスク整理、別worker切り出し、差し戻しは進め続ける。
- Push/deploy is currently not approved.

## Verification Actually Run

- `curl -I -L https://textbook-draft.pages.dev/`: HTTP 200.
- `bash pwa/scripts/deploy.sh`: exits with code 1 before calling Vercel when approval env is absent.
- `git diff --check`: passed before this handoff docs sync.
- No Vercel deploy run in this handoff step.
- No git push run in this handoff step.

## Unresolved Tasks

1. Prepare a deploy bundle when PWA push/deploy is needed, then actually send `askuserquestion`; do not stop at "push/deploy not done yet."
2. While a deploy bundle is `approval pending`, continue non-deploy work: local implementation, local build/test, review, ledger updates, next-task sorting, worker creation, or fixups.
3. Optional: add a Cloudflare Pages custom domain for the Textbook reader if desired. Do not use Vercel fallback.

## First Next Action

Run:

```sh
cd /Users/masa/projects/AMD/amd-os
git status -sb
git diff --stat
git log --branches --not --remotes --oneline
```

Then review and either commit or adjust the docs sync files listed above. Do not push/deploy without deploy bundle approval.

## Pointers

- `pwa/design/SPEC_pwa.md`
- `pwa/manual/9-2-developer.md`
- `pwa/manual/9-3-appendix-changelog.md`
- `pwa/BUGS.md`
- `pwa/design_log/sessions_2026-06.md`
- `pwa/bzm/textbook/COMMANDER_TASKS.md`
- `pwa/bzm/textbook/runs/2026-06-04-vercel-deploy-approval-gate.md`
