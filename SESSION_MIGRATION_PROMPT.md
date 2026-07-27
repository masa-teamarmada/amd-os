# SESSION MIGRATION PROMPT — AMD OS admin月初合意

```text
cd /Users/masa/projects/AMD/amd-os

あなたは、株式会社チームアルマダの社内OS「AMD OS」を引き継ぐえいみ。
今回の受領済み作業は、admin月初合意画面の対象月選択を手入力からプルダウンへ変え、202606の「対象外」が何を意味するか画面で説明できるようにしたこと。これは main と production に反映済みで、次セッションは同じ実装をやり直さない。

## 最初に読む順

1. /Users/masa/projects/AGENTS.common.md
2. /Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md
3. /Users/masa/projects/AMD/amd-os/AGENTS.md
4. /Users/masa/projects/AMD/amd-os/CLAUDE.md
5. /Users/masa/projects/AMD/amd-os/pwa/AGENTS.md
6. /Users/masa/projects/AMD/amd-os/pwa/CLAUDE.md
7. /Users/masa/projects/AMD/amd-os/HANDOFF.md
8. /Users/masa/projects/AMD/amd-os/pwa/spec/1-1-overview.md
9. /Users/masa/projects/AMD/amd-os/pwa/spec/1-2-document-layer-migration-map.md
10. /Users/masa/projects/AMD/amd-os/pwa/spec/3-14-monthly-work-agreement-current-spec.md
11. /Users/masa/projects/AMD/amd-os/pwa/design/README.md
12. /Users/masa/projects/AMD/amd-os/pwa/design/FEATURE_REGISTRY.md
13. /Users/masa/projects/AMD/amd-os/pwa/manual/6-6-member-billing-prompts-spec.md
14. /Users/masa/projects/AMD/amd-os/pwa/manual/9-3-appendix-changelog.md
15. /Users/masa/projects/AMD/amd-os/pwa/BUGS.md
16. /Users/masa/projects/AMD/amd-os/pwa/design_log/sessions_2026-07.md の「2026-07-28 — admin月初合意」節

## 状態スナップショット

- cwd: `/Users/masa/projects/AMD/amd-os`
- canonical branch: `main`
- accepted HEAD / origin/main: `c760851c` / `c760851c`。local main ahead 0 / behind 0。
- accepted production: `https://amd-os-pwa.vercel.app`、`v3.51.3`、`git_sha=c760851c8be7bc4c4570ca144580bf5c2cb00a4c`、`git_branch=main`、`dirty=false`。
- shared checkoutの未コミットWIPでは `pwa/src/lib/build-info.ts` が `v3.51.5` になっているが、これは未採用・未反映の別作業。production versionは `v3.51.3` のままなので、次のversionを決めるときはlocal WIP値を鵜呑みにせず、採用範囲とmainの最新値を確認する。
- accepted commit: `c760851c fix(pwa): select monthly agreement month`
- 対象月は日本語表記のプルダウン。2020年1月から現在月の12か月先まで選択できる。
- 2026年6月以前の表示には「月初合意の導入前・移行月。合意保存不要・未合意による支払い停止なし」の説明が出る。
- 202606の `not_required` は欠損ではなく、2026年7月の本運用開始前の移行月判定。支払gateでは移行月を合意済み扱いで通すが、実際の合意行は偽造しない。
- registered worktreeはroot 1件、local branchはmainのみ。新しいbranch/worktreeは作らない。

## 現在の別作業WIP（今回の受領済み成果と混ぜない）

shared checkoutには、別 worker の「予定額変更理由」実装が未コミットで残っている。変更対象は `pwa/design/FEATURE_REGISTRY.md`、`pwa/design/db_schema.md`、`pwa/manual/6-6-member-billing-prompts-spec.md`、`pwa/manual/9-3-appendix-changelog.md`、`pwa/scripts/check_monthly_agreement_diff.mts`、`pwa/scripts/check_pwa_critical_ui.cjs`、`pwa/spec/3-14-monthly-work-agreement-current-spec.md`、`pwa/spec/6-1-appendix-changelog.md`、月初合意の画面/API/コンポーネント/lib一式、`pwa/scripts/migrations/197_member_monthly_work_agreement_amount_change_reasons.sql`、`pwa/src/app/api/admin/monthly-work-agreements/amount-change-reasons/route.ts`。

このsnapshot後に、別のSX画面作業由来と見られる `pwa/design/cockpit.md`、`pwa/manual/2-3-pj-cockpit.md`、`pwa/spec/3-8-cockpit-current-spec.md`、`pwa/src/components/cockpit/CapitalPlanMatrix.tsx`、`pwa/src/components/cockpit/CockpitBusinessPlan.tsx`、`pwa/src/lib/sx-business-plan.ts` などの未コミット差分も現れた。月初合意WIPとは別ownerとして、採否・commit・破棄を別closeoutで扱う。

これは今回のプルダウンcommit・本番deployには含まれていない。所有者は同時実行された月初合意理由入力 workerとSX画面 workerと推定する。次の判断は「採用して別commitへ進める」か「まさの明示判断後にrecoverableな形で破棄する」か。`git reset --hard`、`git checkout --`、`git clean`、`git add .`は禁止。採用する場合は、まず現行mainとの差分全体を読み、migration適用状況、`npm run test:monthly-agreement-diff`、`npm run test:critical-ui`、`npx tsc --noEmit`、対象eslint、`npm run build`を通し、本番`v3.51.3`より新しいbuild versionへ整理してから、対象ファイルだけをstageしてcommitし、deploy scriptで本番反映する。

## 次タスク

1. 開始時に `git status -sb --untracked-files=all`、`git diff --stat`、`git diff --name-only --diff-filter=U`、`curl -fsS https://amd-os-pwa.vercel.app/api/build-info` をread-onlyで確認する。
2. 予定額変更理由WIPを続けるなら、まず全差分とDB schema/migrationをレビューする。変更理由は自動推測せず、現在snapshotに紐づく人間の理由だけを保存する設計なので、合意APIとadmin画面の両側のblocking契約を確認する。
3. 採用しない場合は、対象ファイルを所有者と照合してから、まさの判断を取り、recoverableな保全または安全な削除を別closeoutで行う。今回のセッションでは触らない。
4. 月選択だけの追加実装は不要。すでにproductionで確認済み。

## 確立済みの運用ルール

- main一本。新branch/worktreeを作らない。dirtyを理由にbranchを切らない。
- 既存dirtyは戻さず、今回の対象ファイルだけを明示stageする。`git add .` / `git add -A`は禁止。
- PWAの本番反映は `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh`。直接 `npx vercel` や生のPWA pushは使わない。
- コードをdeployするなら、build versionをpatch bumpし、対象eslint、critical UI、`tsc --noEmit`、build、本番 `/api/build-info` を確認する。
- DB列名は想像せず、`pwa/design/db_schema.md`を先に読む。migrationは `pwa/scripts/migrations/` に残し、適用時は `python -X utf8 pwa/scripts/apply_ddl.py ...` の正本手順を使う。
- 認証が必要な画面はログイン突破をしない。型・build・重要UI検査と本番build-infoで確認範囲を明記する。
- raw議事録、URL、secret、個人情報はhandoffや報告へ持ち込まない。

## 今回の検証

- `npm run test:critical-ui`: PASS
- `npx eslint 'src/app/(app)/admin/monthly-work-agreements/page.tsx'`: PASS
- `npm run build`: PASS（既存 `next.config.ts` のNFT追跡warningのみ）
- deploy scriptをclean cloneで実行: Vercel ReadyまでPASS
- production `/api/build-info`: v3.51.3 / accepted SHA / dirty=false
```
