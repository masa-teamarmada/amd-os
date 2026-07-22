# AMD OS Handoff

Last updated: 2026-07-22 JST

Target: `/Users/masa/projects/AMD/amd-os`

Topic: KUTEコックピットの研究者別シーズ表示とcloseout

## Latest Session Summary

- KUTE (`project_id=p25`) の連携シーズ比較を、研究者ごとの見出し帯＋シーズ行へ変更した。
- DBの `seeds` は「技術×用途」1件につき1行のまま維持し、統合・削除・複製・migrationは行っていない。
- 2026-07-21確認時の工学院大学データは研究者7名・シーズ9件。高橋義典先生は実際には3シーズあり、表示上は1グループの直下に3行を保持する。
- グループ境界は同一機関＋NFKC/空白正規化済み研究者名。研究者名未登録は1シーズ1グループとして誤統合を防ぐ。
- 実装commit `ece458b4` はmainへpush済み。本番 `v3.47.10` で確認後、後続mainを含む現在のproduction `v3.47.13 / b4e66414` にも含まれている。
- 詳細な実施記録と設計同期表は [`pwa/design_log/sessions_2026-07.md`](pwa/design_log/sessions_2026-07.md) の「KUTEコックピット研究者グルーピング」節を参照。

## Repo State

- branch: `main`
- handoff作成前baseline HEAD / origin/main: `c45a8654` / `c45a8654`（ahead 0 / behind 0）。handoff bundleの最終commitは `git log -1 --format=%H -- HANDOFF.md` で確認する。
- handoff作成前production: `v3.47.13` / `b4e664146a9e3576b5f094740770a2e7760618ee` / `git_branch=main` / `dirty=false`。handoff bundle push後は `/api/build-info` を再確認する。
- KUTE accepted commit: `ece458b49589dee3eb47c5476967113f40e6980f`
- local branch: `main` のみ / registered worktree: root 1件
- このKUTEセッションが作ったbranch/worktree: 0

### 現在の未コミット変更（KUTE外・変更禁止）

| path | owner / class | 次の処理 |
|---|---|---|
| `pwa/bzm/book-a-ch-1.md` | active Book A session `bzm-54` / other-worker | `bzm-54` が採否・commit・closeoutを行う |
| `HANDOFF_H1_BACKGROUND_2026-07-22.md` / `SESSION_MIGRATION_PROMPT_H1_BACKGROUND.md` | H-1 background closeout lane / other-worker | H-1 ownerが2ファイルを同じhandoff bundleでcommit/pushする |
| `pwa/supabase/.temp/cli-latest` | Supabase CLI cache / deploy-link-local | 次のSupabase CLI ownerがtracked管理の要否を裁定する。KUTEからは触らない |

## Unresolved Tasks

- KUTE研究者グルーピングの未完了実装: なし。
- 既知のモデル境界: 研究者マスタ/研究者IDは未導入。敬称・姓名表記・別名など意味的な表記揺れは自動統合しない。必要性が出た時点で研究者正本を別設計する。
- 既存dirty 4件はKUTE外。上表のownerが解消するまでshared checkout全体は `do not archive`。

## First Next Action

KUTEの続きとして開始する場合は、rootのBook A用 `SESSION_MIGRATION_PROMPT.md` を上書きせず、[`SESSION_MIGRATION_PROMPT_KUTE_COCKPIT.md`](SESSION_MIGRATION_PROMPT_KUTE_COCKPIT.md) を使う。最初にmain/production/KUTE件数をread-onlyで再確認し、まさから新しいフィードバックが無ければ再実装しない。

## Pointers

- 仕様正本: [`pwa/design/seeds.md`](pwa/design/seeds.md)
- cockpit設計: [`pwa/design/cockpit.md`](pwa/design/cockpit.md)
- 回帰契約: [`pwa/design/FEATURE_REGISTRY.md`](pwa/design/FEATURE_REGISTRY.md)
- OSマニュアル: [`pwa/manual/2-3-pj-cockpit.md`](pwa/manual/2-3-pj-cockpit.md)
- バグ/教訓: [`pwa/BUGS.md`](pwa/BUGS.md)
- session log: [`pwa/design_log/sessions_2026-07.md`](pwa/design_log/sessions_2026-07.md)
- KUTE migration prompt: [`SESSION_MIGRATION_PROMPT_KUTE_COCKPIT.md`](SESSION_MIGRATION_PROMPT_KUTE_COCKPIT.md)

## Verification Evidence

- `npm run test:kute-seeds-scope`
- `npm run test:seed-sps-score`
- `npx tsc --noEmit`
- 対象eslint、`npm run test:critical-ui`、`npm run build`
- Playwright desktop 1440×1100 / mobile 390×844: body横overflowなし、表だけ横スクロール、console/page error 0
- production Playwright: 研究者7グループ・シーズ9行・高橋先生1グループ直下3行

## Prompt Boundary

rootの `SESSION_MIGRATION_PROMPT.md` はBook A司令塔08のcanonical startup promptで、active Book A作業を守るためKUTEでは変更しない。KUTEの同内容promptはroot直下の `SESSION_MIGRATION_PROMPT_KUTE_COCKPIT.md` に分離する。
