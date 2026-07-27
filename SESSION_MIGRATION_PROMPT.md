# SESSION MIGRATION PROMPT — AMD OS admin月初合意

```text
cd /Users/masa/projects/AMD/amd-os

あなたは、株式会社チームアルマダの社内OS「AMD OS」を引き継ぐえいみ。
今回の受領済み作業は、admin月初合意画面の対象月選択を手入力からプルダウンへ変え、202606の「対象外」が何を意味するか画面で説明できるようにしたこと。これは `6dd7d130` としてmain・productionへ反映済みで、次セッションは同じ実装をやり直さない。別 worker の予定額変更理由 `0330c547` とSX資金計画画面 `8d1fbada` は `origin/main` に入っているが未レビューで、productionには未deploy。

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
- deployed production HEAD: `6dd7d130`。`origin/main`は`b78e4fff`まで進み、その履歴には`0330c547`、`8d1fbada`、`a3b278bb`とhandoff更新commit群が含まれる。local HEADは`c9865236`でoriginよりhandoff更新1commit先行。productionは未deployのまま採否判断を待つ。
- accepted production: `https://amd-os-pwa.vercel.app`、`v3.51.3`、`git_sha=6dd7d1307e85179d6a2cd521d82fdd686827b4fe`、`git_branch=main`、`dirty=false`。
- local `pwa/src/lib/build-info.ts` は別workerの`a3b278bb`上で`v3.51.6`。productionは`v3.51.3`のままなので、local値を鵜呑みにせず、レビュー後にversionを確定する。
- accepted commit: `c760851c fix(pwa): select monthly agreement month`
- 対象月は日本語表記のプルダウン。2020年1月から現在月の12か月先まで選択できる。
- 2026年6月以前の表示には「月初合意の導入前・移行月。合意保存不要・未合意による支払い停止なし」の説明が出る。
- 202606の `not_required` は欠損ではなく、2026年7月の本運用開始前の移行月判定。支払gateでは移行月を合意済み扱いで通すが、実際の合意行は偽造しない。
- registered worktreeはroot 1件、local branchはmainのみ。新しいbranch/worktreeは作らない。

## 現在の別作業commit / WIP（今回の受領済み成果と混ぜない）

別 worker の「予定額変更理由」実装は `0330c547 feat(pwa): require amount change reasons for agreements` としてcommit済み。SX資金計画画面の変更は `8d1fbada fix(pwa): polish SX capital policy plan` としてcommit済み。いずれも今回のプルダウンcommit・本番反映には含めていない。

別 worker の再読み込みボタン型修正・変更履歴・build version更新は `a3b278bb fix(pwa): restore monthly agreement reload typing` としてcommit済み。これは `0330c547` の月初合意変更と、`8d1fbada` のSX資金計画画面変更とは別の未レビューcommitとして保全する。

これは今回のプルダウンcommit・本番deployには含まれていない。`0330c547` は予定額変更理由の保存と合意停止を含み、`8d1fbada` はSX資金計画画面の表示・判定・検査・仕様同期を含み、`a3b278bb` は再読み込みボタン型修正・変更履歴・build version更新を含むため、まさの採否判断なしにpush・revertしない。採用する場合は、まず現行mainとの差分全体を読み、migration適用状況、`npm run test:monthly-agreement-diff`、`npm run test:critical-ui`、`npx tsc --noEmit`、対象eslint、`npm run build`を通し、production`v3.51.3`より新しいbuild versionへ整理してからdeployする。

## 次タスク

1. 開始時に `git status -sb --untracked-files=all`、`git log --oneline origin/main..HEAD`、`git diff --stat`、`git diff --name-only --diff-filter=U`、`curl -fsS https://amd-os-pwa.vercel.app/api/build-info` をread-onlyで確認する。
2. `0330c547`、`8d1fbada`、`a3b278bb`をそれぞれ採用するか、まず全commit差分をレビューする。前者はDB schema/migration・合意API・admin画面のblocking契約、次はSX画面の判定契約、後者はreloadイベント型とbuild version契約を確認する。変更理由は自動推測せず、現在snapshotに紐づく人間の理由だけを保存する。
3. 採用する場合は、テスト・build・本番versionを確認後、まさの明示判断を得てdeploy scriptでpushする。採用しない場合は、対象commitとWIPを所有者と照合してからrecoverableな保全または安全な削除を別closeoutで行う。
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
