# SESSION MIGRATION PROMPT — AMD OS PoC Matching

```text
cd /Users/masa/projects/AMD/amd-os

あなたは、株式会社チームアルマダの社内OS「AMD OS」のPoC Matching機能を引き継ぐえいみ。
目的は、かるちゃんとのPoCビジネスMTGを起点に作った `/poc` を、シーズとPoC先の実務的な案件化台帳として育てること。

## 最初に読む順

1. /Users/masa/projects/AGENTS.common.md
2. /Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md
3. /Users/masa/projects/AMD/amd-os/AGENTS.md
4. /Users/masa/projects/AMD/amd-os/CLAUDE.md
5. /Users/masa/projects/AMD/amd-os/pwa/AGENTS.md
6. /Users/masa/projects/AMD/amd-os/pwa/CLAUDE.md
7. /Users/masa/projects/AMD/amd-os/HANDOFF.md
8. /Users/masa/projects/AMD/amd-os/pwa/design/README.md
9. /Users/masa/projects/AMD/amd-os/pwa/design/poc_matching.md
10. /Users/masa/projects/AMD/amd-os/pwa/design/FEATURE_REGISTRY.md
11. /Users/masa/projects/AMD/amd-os/pwa/design/SPEC_pwa.md
12. /Users/masa/projects/AMD/amd-os/pwa/manual/2-5-research-assets-quick-start.md
13. /Users/masa/projects/AMD/amd-os/pwa/manual/5-1-research-assets-vc-seeds-scholar-spec.md
14. /Users/masa/projects/AMD/amd-os/pwa/manual/9-3-appendix-changelog.md
15. /Users/masa/projects/AMD/amd-os/pwa/BUGS.md

DBへ触る作業では、必ず /Users/masa/projects/AMD/amd-os/pwa/design/db_schema.md で `seeds` / `poc_companies` / `poc_matches` の実列を確認してから書く。

## 状態スナップショット

- cwd: /Users/masa/projects/AMD/amd-os
- branch: main
- HEAD / origin/main: closeout時点で同期済み。次セッション開始時に `git rev-parse HEAD` / `git rev-parse origin/main` で最新commitを確認する。
- production: https://amd-os-pwa.vercel.app
- production build-info確認済み: v3.47.13 / git_branch=main / dirty=false。docs-only closeout pushで `git_sha` だけ更新されることがあるため、次セッション開始時に `/api/build-info` を再確認する。
- PoC accepted commits are ancestors of current main:
  - 0306c5e5 Replace PoC matrix with tagged candidate queue
  - 000f08c3 Show PoC destination candidates as comparison table
- 現在の未コミット差分はPoC外:
  - pwa/bzm/book-a-ch-1.md: active Book A session / other-worker。触らない。
- このPoCセッションで作ったbranch/worktreeはなし。local registered worktreeはroot 1件。
- Book A司令塔08の旧root promptは、PoC handoffのため /Users/masa/projects/AMD/amd-os/SESSION_MIGRATION_PROMPT_BOOK_A_COMMANDER08.md に退避済み。BZM側ポインタは /Users/masa/projects/AMD/amd-os/pwa/bzm/SESSION_MIGRATION_PROMPT.md。

## 現在のPoC設計

- `/poc` は、一次入力を `シーズ` と `PoC先` の2つにする。
- `シーズ` は `seeds` が正本。PoC画面から追加しても同じ正本に入る。
- `PoC先` は `poc_companies` が正本。企業、事業所、組合、自治体、施設カテゴリのようなカテゴリ候補も扱える。
- 案件候補は `poc_matches`。シーズとPoC先の掛け合わせから、相性仮説、ヒアリング論点、PoC目標、謝礼、契約、資金、収益分配、状態、優先度を持つ。
- 全面 `シーズ x PoC先` マトリクスは作らない。100 x 500 のように巨大化し、ほとんど空白になるため。
- 先にタグ付き `PoC先候補リスト` を整備し、業界タグ、地域、規模感、状態などで候補を絞る。
- `PoC先候補リスト` は比較表で表示する。列は `PoC先 / タグ / 規模・地域 / 状態 / PoC相性 / 謝礼・履歴 / 案件数 / 担当・次アクション`。
- シーズごとの `案件化キュー` に上位候補だけを出し、候補の `案件化` から `poc_matches` を作る。
- Notion、Gmail、Slack、Drive、Webの本文・URLをこの台帳へ直接保存しない。`source_ref` は `2026-07-09 PoCサービスMTG` のような短い参照名に留める。

## 次タスク

まさからPoCの続きとして指示が来たら、まず再実装ではなくデータ拡充と重複整理から始める。

1. read-onlyで `/api/build-info`、git状態、`pwa/design/db_schema.md` のPoC関連列を確認する。
2. 既存OS内のSX/KUTE等の接点から、PoC先候補にできるものを洗い出す。
3. 追加前に `poc_companies` を検索し、実名・カテゴリ・タグの重複を避ける。
4. 議事録に具体社名がない場合は、無理に実名企業を作らず、カテゴリ候補として入れる。
5. 追加候補には、業界タグ、地域、規模感、PoC相性、謝礼・履歴、担当、次アクション、短いsource_refを入れる。
6. UIを変える場合は、`pwa/design/poc_matching.md`、`FEATURE_REGISTRY.md`、`pwa/manual/2-5`、`pwa/manual/5-1`、`pwa/manual/9-3` を同じ作業で同期する。
7. `/poc` route、GlobalNav導線、シーズ追加、PoC先追加、候補先比較表、案件化キューを消す変更はしない。変える必要があるなら、先に仕様正本と回帰テストの意図を読む。

## 運用ルール

- main一本。新branch/worktreeは作らない。
- dirtyを理由にbranchを切らない。既存dirtyは触らず、今回対象のファイルだけを明示stageする。
- `git add .` / `git add -A`は禁止。
- PWAのコードや画面を変えたら `pwa/src/lib/build-info.ts` をpatch bumpする。
- PWA本番反映が必要な変更は、`AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh` でpushとVercel build監視まで行う。
- 直接 `npx vercel` は使わない。
- 検証の基本は、対象eslint、`npm run test:critical-ui`、`npx tsc --noEmit`、`npm run build`、本番 `/api/build-info`。
- 認証が必要な画面で無理にログイン突破しない。安全に見られない場合は、型・build・重要導線チェックと本番build-infoで確認範囲を明記する。
- raw議事録、URL、secret、個人情報は最終報告やdurable artifactへ出さない。

## closeout 注意

このpromptだけで次セッションはPoC作業に入れる。
ただし、現時点のshared checkoutにはPoC外の未コミット差分が1件あるため、archive判定は `do not archive`。
PoC側はmain/productionに統合済みで、PoC固有の未解決実装はない。
```
