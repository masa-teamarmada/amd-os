# SESSION MIGRATION PROMPT — 日本文化マップ admin 導線 closeout

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
8. /Users/masa/projects/AMD/amd-os/pwa/spec/2-1-pwa-runtime-routes.md
9. /Users/masa/projects/AMD/amd-os/pwa/spec/2-2-pwa-surface-inventory-current-spec.md
10. /Users/masa/projects/AMD/amd-os/pwa/design/FEATURE_REGISTRY.md
11. /Users/masa/projects/AMD/amd-os/pwa/manual/2-6-admin-ops.md
12. /Users/masa/projects/AMD/amd-os/pwa/BUGS.md
13. /Users/masa/projects/AMD/amd-os/pwa/design_log/sessions_2026-07.md

状態スナップショット:
- まさ指摘「日本文化ページはadminに移動させたはずなのに、またトップに戻ってる」は対応済み。
- 原因は、2026-07-09 の admin 移動 commit が旧「資料」グループからは外した一方、共通左サイドナビ `GlobalNav` の Admin group に `日本文化 -> /admin/japanese-culture-map` を残したこと。後続で巻き戻ったのではなく、移動時点から共通ナビ入口が残存していた。
- 機能修正 commit: `7758389a fix(pwa): keep japanese culture map admin-only`。
- 本番 version: `v3.40.2`。
- closeout / handoff docs の main commit が機能修正後に積まれている可能性がある。埋め込み SHA を current truth にせず、次回開始時に `git log -1 --oneline` と `https://amd-os-pwa.vercel.app/api/build-info` を照合する。
- build-info は `git_branch=main`, `dirty=false`, `git_sha` が現在の `origin/main` と一致していれば正しい。
- `GlobalNav` から「日本文化」を削除済み。`AdminSidebar` には `日本文化 -> /admin/japanese-culture-map` を残している。
- 旧 `/japanese-culture-map` route は互換用 redirect として残す。ページ本体は `/admin/japanese-culture-map`。
- `test:critical-ui` に、`GlobalNav.tsx` へ `日本文化` / `/admin/japanese-culture-map` / `/japanese-culture-map` が戻ったら落ちる guard を追加済み。
- 仕様・マニュアル・事故記録は `FEATURE_REGISTRY.md`, `manual/2-6-admin-ops.md`, `manual/9-3-appendix-changelog.md`, `spec/6-1-appendix-changelog.md`, `design/os_manual.md`, `BUGS.md` に反映済み。

検証済み:
- `npm run test:critical-ui`
- `npx tsc --noEmit`
- `npm run build`
- `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` (clean deploy clone から push/build監視)

現時点の dirty:
- 次回開始時は `git status -sb --untracked-files=all` と closeout inventory を正本にする。
- この closeout 時点では、日本文化 nav 修正とは別に Materials / research assets lane、`pwa/design/atlas_routine.md`、`pwa/bzm/2026-07-14_frontmatter_gairei_draft_v1.md` などの未整理差分が見えていた。
- それらは日本文化 nav 修正には混ぜない。owner ごとに commit/deploy または revert 判断する。

次タスク:
1. まず `git fetch origin main`, `git status -sb --untracked-files=all`, `git log -1 --oneline`, `curl -fsS https://amd-os-pwa.vercel.app/api/build-info` を実行して current truth を確認する。
2. もし日本文化がトップ/共通左ナビに再表示されたら、最初に `pwa/src/components/nav/GlobalNav.tsx` を見る。`npm run test:critical-ui` が落ちるはず。
3. admin 画面内の導線を変える場合は、`pwa/design/FEATURE_REGISTRY.md` と `pwa/manual/2-6-admin-ops.md` を先に更新し、manual/spec changelog と BUGS も同期する。
4. 残 dirty は別件として owner を分ける。`git add .` は使わず、対象ファイルだけ stage する。

確立済みルール:
- 日本文化マップの唯一のUI入口は `pwa/src/components/admin/AdminSidebar.tsx`。
- `GlobalNav` の一般「資料」グループにも共通 Admin group にも戻さない。
- 旧 `/japanese-culture-map` は削除せず、ブックマーク互換の redirect として `/admin/japanese-culture-map` へ送る。
- PWAの本番反映は `main` push = Vercel production deploy。直接 `npx vercel deploy` は使わない。
- dirty があっても branch は切らない。今回のように deploy script が tracked dirty で止まる場合は、clean deploy clone で対象 commit だけを反映し、root main は origin/main に揃える。
- raw本文、secret、個人情報、Drive URL を handoff / BUGS / design_log に出さない。
```
