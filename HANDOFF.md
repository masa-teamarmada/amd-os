# AMD OS Handoff

Last updated: 2026-07-23 JST

Target: `/Users/masa/projects/AMD/amd-os`

Topic: PoC Matching 候補先比較表 closeout

## Latest Session Summary

- `/poc` は、`シーズ` と `PoC先` を一次入力にして、タグで候補先を絞り、シーズごとの案件化キューから `poc_matches` を作る画面として実装済み。
- まさの指摘どおり、全面 `シーズ x PoC先` マトリクスは作らない。100 x 500 のような空白だらけの表になるため、先にタグ付き `PoC先候補リスト` を整備する。
- `PoC先候補リスト` はカードではなく比較表。列は `PoC先 / タグ / 規模・地域 / 状態 / PoC相性 / 謝礼・履歴 / 案件数 / 担当・次アクション`。
- Notion議事録由来のPoC情報は、本文・URLではなく、短い参照名、構造化メモ、候補カテゴリ、次アクションとして扱う。
- 実装commit `0306c5e5` と `000f08c3` は現在のmainに含まれている。現在のproductionは後続変更込みの `v3.47.13 / e4ea6759` で、PoC比較表の変更も祖先commitとして含む。
- 詳細な実施記録と設計同期表は [`pwa/design_log/sessions_2026-07.md`](pwa/design_log/sessions_2026-07.md) の「PoC Matching 候補先比較表 closeout」節を参照。

## Repo State

- branch: `main`
- HEAD / origin/main: `e4ea6759535ac920ae7155c78f5b43231bf0fadb` / `e4ea6759535ac920ae7155c78f5b43231bf0fadb`
- local main: ahead 0 / behind 0
- production: `v3.47.13` / `e4ea6759535ac920ae7155c78f5b43231bf0fadb` / `git_branch=main` / `dirty=false` / deployed at `2026-07-22T06:26:02.079Z`
- PoC accepted commits: `0306c5e5 Replace PoC matrix with tagged candidate queue`, `000f08c3 Show PoC destination candidates as comparison table`
- local branch: `main` のみ / registered worktree: root 1件
- このPoCセッションが作ったbranch/worktree: 0
- root `SESSION_MIGRATION_PROMPT.md` はPoC再開用へ更新。Book A司令塔08の旧promptは [`SESSION_MIGRATION_PROMPT_BOOK_A_COMMANDER08.md`](SESSION_MIGRATION_PROMPT_BOOK_A_COMMANDER08.md) に退避し、BZM側ポインタも更新済み。

### 現在の未コミット変更（PoC外・変更禁止）

| path | owner / class | 次の処理 |
|---|---|---|
| `pwa/bzm/book-a-ch-1.md` | active Book A session / other-worker | Book A司令塔または本文workerが採否・commit・closeoutを行う。PoC側からは触らない |
| `pwa/supabase/.temp/cli-latest` | Supabase CLI local metadata / deploy-link-local | Supabase CLI ownerがtracked管理の要否を裁定する。PoC側からは触らない |
| `HANDOFF_ADMIN_OPERATING_CALENDAR_2026-07-23.md` | AMD運営カレンダー closeout lane / other-worker | 当該laneがcommitするか、不要なら削除判断する。PoC側からは触らない |
| `SESSION_MIGRATION_PROMPT_ADMIN_OPERATING_CALENDAR_2026-07-23.md` | AMD運営カレンダー closeout lane / other-worker | 当該laneがcommitするか、不要なら削除判断する。PoC側からは触らない |

## Unresolved Tasks

- PoC比較表の未完了実装: なし。
- 次にPoCを進めるなら、既存OS内のSX/KUTE等の接点からPoC先候補を追加する。ただし重複確認を先に行い、議事録に実名がない場合は無理に実名企業を作らない。
- 既存dirty 2件はPoC外。上表のownerが解消するまでshared checkout全体は `do not archive`。

## First Next Action

PoC Matchingの続きとして開始する場合は、`SESSION_MIGRATION_PROMPT.md` を使う。最初にmain/production/DB schemaをread-onlyで再確認し、まさから新しいフィードバックが無ければ再実装せず、PoC先候補データの追加・重複整理から入る。

## Pointers

- 仕様正本: [`pwa/design/poc_matching.md`](pwa/design/poc_matching.md)
- PWA全体仕様: [`pwa/design/SPEC_pwa.md`](pwa/design/SPEC_pwa.md)
- 回帰契約: [`pwa/design/FEATURE_REGISTRY.md`](pwa/design/FEATURE_REGISTRY.md)
- OSマニュアル: [`pwa/manual/2-5-research-assets-quick-start.md`](pwa/manual/2-5-research-assets-quick-start.md), [`pwa/manual/5-1-research-assets-vc-seeds-scholar-spec.md`](pwa/manual/5-1-research-assets-vc-seeds-scholar-spec.md), [`pwa/manual/9-3-appendix-changelog.md`](pwa/manual/9-3-appendix-changelog.md)
- DB schema: [`pwa/design/db_schema.md`](pwa/design/db_schema.md)
- バグ/教訓: [`pwa/BUGS.md`](pwa/BUGS.md)
- session log: [`pwa/design_log/sessions_2026-07.md`](pwa/design_log/sessions_2026-07.md)

## Verification Evidence

- 2026-07-10 PoC実装時: `eslint src/app/(app)/poc/page.tsx`
- 2026-07-10 PoC実装時: `npm run test:critical-ui`
- 2026-07-10 PoC実装時: `./node_modules/.bin/tsc --project tsconfig.json --noEmit`
- 2026-07-10 PoC実装時: `npm run build`
- 2026-07-10 PoC実装時: production `v0.39.37 / 000f08c3 / dirty=false`
- 2026-07-23 closeout: `git merge-base --is-ancestor 000f08c3 HEAD` passed
- 2026-07-23 closeout: production `v3.47.13 / e4ea6759 / dirty=false`
