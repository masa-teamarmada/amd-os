# 次セッションへの引き継ぎ（2026-09-10 論点・仮説リストの手動並び替え／完了後）

あなたは、株式会社チームアルマダのAMD OSを引き継ぐ「えいみ」。cwdは `/Users/masa/projects/AMD/amd-os` に固定し、`pwa/` をcwdにしない。

## 読む順

1. `/Users/masa/projects/AGENTS.common.md`（えいみ共通ルールの正本）
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md`（AMD横断memory）
3. `/Users/masa/projects/AMD/amd-os/HANDOFF.md`（現在地。H が今回のセッション、E が次の本命タスク）
4. `/Users/masa/projects/AMD/amd-os/AGENTS.md`（PJ固有の技術ルール、deploy 手順）
5. 今回の続きをやるなら `pwa/spec/3-16-project-weekly-control-current-spec.md`「並び順（手動、2026-09-10 まさ指示）」節
6. `pwa/BUGS.md`（末尾の教訓）

## 状態スナップショット

- **origin/main**: `2d151029`（design_log）。今回のセッションで push したのは `0052a0b2`（並び替え本体）→ `bce7a614`（端まで運べる自動スクロール）→ `2d151029`（design_log）。
- **本番**: `https://amd-os-pwa.vercel.app` は `bce7a614` を配信中（`/api/build-info` で確認済み）。`v3.100.33`。
- **正規checkout `/Users/masa/projects/AMD/amd-os`**: 着手時から **22 behind、38ファイル dirty、未push 2件**（`315a81af` / `4edc01d2`）のまま。**これは別セッションの作業中の状態で、今回のセッションは一切触っていない**（作業前と同じ38件へ戻して閉じた）。
  - このcheckoutで作業を始める前に、必ず `git fetch` して behind を確認する。behind のまま migration 番号を採るとぶつかる（今回 389/390 が既に origin にあり 391 へ振り直した）。
  - dirty の中身は別セッションのもの。`git add .` を絶対に使わない。
  - **`pre-commit` hook（critical UI）が、着手時点で既に赤い**。原因は別セッションが作業中の `pwa/scripts/check_pwa_critical_ui.cjs`（`"objective-structure": "目的構造"` の期待を追加済み）と `pwa/src/components/cockpit/CockpitView.tsx`（実装がまだ）の不一致。`origin/main` では緑。自分の変更が原因かどうかは、使い捨てクリーンクローンで `origin/main` を検査して切り分ける。
- **使い捨てクリーンクローン**: `/private/tmp/claude-501/-Users-masa-projects-AMD-amd-os/<session>/scratchpad/clean`（このセッション専用。次セッションでは自分で作り直す）。`pwa/node_modules` と `pwa/.env.local` を正規checkoutへ symlink すると、そのまま `tsc` / `eslint` / 契約テストが走る。

## 今回入れたもの（触るときの前提）

- 論点・仮説リストの表示順の第一キーは `project_management_issues.sort_order`。純関数 `sxWeeklyIssueOrder()` / `sxReorderIssueList()`（`pwa/src/lib/sx-weekly-control.ts`）が正本で、テストは `pwa/scripts/test_sx_weekly_control.mjs`。
- 保存は `reorder_project_management_issues`（`pwa/scripts/migrations/391_atomic_project_issue_reorder.sql`、本番適用済み）。**`expected_version` は取らない** — `project_management_issues` には version を進める touch トリガーが無い（183 の FOREACH 配列に issues が入っていない）。タスク側の `reorder_project_management_tasks` と混同しない。
- **並び替えは `last_verified_at` / `source_kind` を触らない**。触ると「更新切れ」判定が並べ替えただけで解除され、論点の鮮度が嘘になる。
- 検査は `npm run test:issue-reorder`。`pwa/scripts/deploy.sh` が本番反映前に走らせる。

## 次のタスク（まさから来ている本命）

**E. PJ別 利益構造ダッシュボード（`/admin/project-profitability`）の白紙からの作り直し。**
前セッションが報酬モデルの前提を読まずに実装して、まさから11点の指摘を受けた。指摘の全文と、実データで裏を取った事実は
`SESSION_MIGRATION_PROMPT_PROJECT_PROFITABILITY_2026-08-30.md` にある。**着手前に必ずこれを読む**。
`budget_yen` は請求額ではない（65%後の配分枠）、お金の集計は年ではなくシーズン（`value_plan_cycles`）で切る、pt消化は期間月数で按分する — このあたりは正本 `pwa/manual/7-1-reward-calc-spec.md` を**全文** Read してから触る（お金・キャッシュ系は hook が拾い読みを止める）。

## このPJで確立している運用ルール（守る）

- **本番反映 = `origin/main` への push**。`npx vercel` の直接 deploy は禁止。通常は `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh`。反映確認は `/api/build-info` の `git_sha` を **`git merge-base --is-ancestor` で祖先判定**する（特定shaの一致待ちは他セッションの反映で外れる）。上限つきで回す。
- **1機能=1commit、編集したら即commit**。`main` 一本、branch と worktree を作らない。push 直前にもう一度 `git fetch`。
- **本番DBで更新系の実走確認をするなら、先に変更前の値を控えて、終わったら戻す**（今回 SXの論点の並びを戻せなくした。memory `feedback_restore_production_data_after_test.md`）。作成系は作った行と `project_management_update_history` の対応行を両方消す。
- ワーカーを走らせるなら `model` を必ず明記（`haiku` か `sonnet`）。省略は起動セッションのモデル継承＝最上位。
- 画面を変えたら **desktop 実寸（1440px）で実走確認**。スマホ幅は対象外（まさはスマホではSwift版を使う）。ローカルの認証必須ページは、service role でセッションを起こして cookie 注入 → Playwright（手順は memory `reference_local_pwa_screenshot_auth.md`）。
- 仕様を変えたら同じ作業単位で正本へ反映する。AMD OS は `pwa/spec/*`（設計）と `pwa/manual/*`（画面の説明）の両方＋各 appendix changelog。業務導線は `pwa/design/FEATURE_REGISTRY.md`、**画面の追加・削除・改名は `ios/DESIGN.md` も**更新する。
- PWA実装を変えたら、対象の回帰テスト、`npx tsc --noEmit`、`npx eslint <変更ファイル>`、`npm run build` を通す。共有checkoutで dev server が動いていると `.next` がぶつかるので、`npm run build` は使い捨てクリーンクローン側で走らせる。
