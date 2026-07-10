# SESSION MIGRATION PROMPT — 月初合意モーダル closeout

```text
cd /Users/masa/projects/AMD/amd-os

最初に読む順:
1. /Users/masa/projects/AGENTS.common.md
2. /Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md
3. /Users/masa/projects/AMD/amd-os/HANDOFF.md
4. /Users/masa/projects/AMD/amd-os/CLAUDE.md
5. /Users/masa/projects/AMD/amd-os/AGENTS.md
6. /Users/masa/projects/AMD/amd-os/pwa/AGENTS.md
7. /Users/masa/projects/AMD/amd-os/pwa/CLAUDE.md
8. /Users/masa/projects/AMD/amd-os/pwa/spec/3-14-monthly-work-agreement-current-spec.md
9. /Users/masa/projects/AMD/amd-os/pwa/manual/2-2-member-workflows-quick-start.md
10. /Users/masa/projects/AMD/amd-os/pwa/manual/6-6-member-billing-prompts-spec.md
11. /Users/masa/projects/AMD/amd-os/pwa/manual/7-1-reward-calc-spec.md
12. /Users/masa/projects/AMD/amd-os/pwa/BUGS.md
13. /Users/masa/projects/AMD/amd-os/pwa/design_log/sessions_2026-07.md

現在の正本:
- `main` / `origin/main` は handoff時点で `932e7e6fd9c371afad4e76a4a9b3a8a1136ade79`、ahead / behind は 0 / 0。
- production は `v3.39.62 / 932e7e6fd9c371afad4e76a4a9b3a8a1136ade79 / main / dirty=false`。作業開始時に必ず `/api/build-info` を取り直す。
- rootには `pwa/src/components/admin/AdminProjectsTable.tsx` の未コミット差分がある。admin PJ のSlack設定レーンなので、月初合意作業へ混ぜず、戻さず、stageしない。
- 登録worktreeは main checkout 1つだけ。今回の一時cloneは証跡を残して削除済み。

月初合意で確定した仕様:
1. 合意前に必ず確認するのは「PJごとの担当内容」と「その対価としての予定額」の2点だけ。
2. 未合意または条件更新ありのままでは、その稼働月の支払いに進めない。警告文と `確認して合意` の直下で明示する。
3. 月次の到達目標は現在のsnapshotに無い。`milestones[].title` はMS名なので、目標として表示しない。
4. PJごとに `担当内容` を一度だけ置き、右に `milestones[].taskDescription` を複数並べる。taskDescriptionが無い時だけMS名をfallbackにする。
5. 予定額合計と全PJの予定額は必須枠に集約。数値表は内容幅に合わせ、カラムの間を不必要に広げない。
6. `確認して合意` を主ボタンにし、`修正要望` はその右に小さく置く。修正要望の常設カードは置かない。
7. 必須枠より下は独立カードではなく `参考情報` の短い区切り。`支払い状況と対象PJ` は初期閉じで、開いた時だけ合計とPJ別内訳を出す。下段へ同じPJ情報を重複表示しない。

実装と検証:
- UI: `pwa/src/components/monthly-agreement/MonthlyAgreementExperience.tsx`
- 実装commit: `66572734 fix(pwa): simplify monthly agreement scope`。current main のancestor。
- `npx tsc --noEmit`、対象ESLint、Prettier、`npm run test:critical-ui`、`npm run build`、デスクトップ/390pxブラウザ確認を通過済み。
- 仕様/マニュアル/BUGS/design log/changelogは同期済み。変更する時は必ず同じ層を更新する。

次に作業を始める時:
1. `git status -sb`、`git worktree list`、`git log -1 --oneline` と production build-info を取り直す。
2. 新しいUI feedbackが来た時だけ、まずsnapshotにその概念のデータがあるかを確認してからラベルを増やす。データに無い「到達目標」「発注条件」は表示しない。
3. UI変更なら、広い空白・重複カード・主従が逆のボタン配置を先に疑う。必要なら一時mockでブラウザ確認し、routeとmiddlewareの一時変更は同じセッションで必ず消す。
4. 対象ファイルだけstageしてcommit。既存dirtyは残す。`git add .` は禁止。
5. PWA本番反映があるコード変更は、`AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh` でpush・production確認まで行う。直接 `npx vercel` は使わない。
```
